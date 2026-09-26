'use strict';
// Viewport and authored-state captures for the Drowned Crown. Boss phase and
// result shots are declared fixtures; they prove rendering/layout, not legal play.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const { chromium } = require(process.env.PW_PLAYWRIGHT || 'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(process.env.PW_SHOTS || 'node_modules/.cache/prism-warden/crown-visual');
const sizes = ['320x568', '390x844', '844x390', '768x1024', '1440x900', '3840x2160'];
const rooms = ['descent', 'galleries', 'circuit', 'archive', 'lighthouse', 'crown'];
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, data) => {
    if (error) return res.writeHead(404).end();
    const ext = path.extname(file);
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' })[ext] || 'text/html');
    res.end(data);
  });
});

async function setRoom(page, room) {
  await page.evaluate(id => {
    const s = PW.game;
    PW.enterRoom(s, id); s.status = 'playing';
    s.player.invulnerable = 99; s.player.prism = 'carried'; s.player.lightCharge = 1;
    s.flags.prism = true; s.flags['stored-light'] = true;
    if (s.escort) s.escort.invulnerable = 99;
  }, room);
}
async function captureBoss(page, state, file) {
  await page.evaluate(kind => {
    const s = PW.game, e = s.enemies.find(enemy => enemy.type === 'crown');
    s.status = 'playing'; s.shots = []; s.rings = [];
    s.player.x = 456; s.player.y = 384; s.player.invulnerable = 99; s.player.lightCharge = 1;
    e.hp = 6; e.stage = 1; e.exposed = 0; e.phase = 'guarded'; e.attackPhase = 'idle'; e.attackTimer = 2;
    if (kind === 'stage1-telegraph') { e.attackPhase = 'telegraph'; e.attackTimer = 1.4; e.aimX = -1; e.aimY = 0; }
    if (kind === 'stage1-open') { e.exposed = 3.4; e.phase = 'exposed'; }
    if (kind === 'stage2-guarded' || kind === 'stage2-open') { e.stage = 2; e.hp = 4; e.phase = kind === 'stage2-open' ? 'exposed' : 'sealed'; e.exposed = kind === 'stage2-open' ? 3.4 : 0; }
    if (kind === 'stage3-windup') { e.stage = 3; e.hp = 2; e.phase = 'eclipse-windup'; e.timer = 1.35; }
    if (kind === 'stage3-pulse') { e.stage = 3; e.hp = 2; e.phase = 'eclipse-recover'; e.timer = .9; s.rings.push({ x: e.x, y: e.y, r: 48, maxR: 324, speed: 210, life: .8, hostile: true, owner: e.id, hitPlayer: false, hitEscort: false, kind: 'eclipse' }); }
    if (kind === 'stage3-open') { e.stage = 3; e.hp = 2; e.phase = 'exposed'; e.exposed = 3.4; }
    if (kind === 'final-result') {
      e.hp = 0; e.phase = 'defeated'; s.flags['pickup:keeper-archive'] = true;
      s.flags['nacre-freed'] = true; s.flags['ilex-evacuated'] = true;
      s.rescue.freed = true; s.escort.arrived = true; s.beacon.lit = true; s.beacon.reached = true;
      s.cleared.E5 = true; s.status = 'won';
    }
  }, state);
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(output, file) });
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PW_CHROME || 'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe' });
  const report = [];
  try {
    for (const size of sizes) {
      const [width, height] = size.split('x').map(Number), touch = width < 1000;
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch });
      const errors = [], external = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('request', request => { if (!request.url().startsWith(`http://127.0.0.1:${server.address().port}/`)) external.push(request.url()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/prism-warden/index.html`);
      await page.screenshot({ path: path.join(output, `${size}-ready.png`) });
      await page.locator('#begin').click();
      for (const room of rooms) {
        await setRoom(page, room); await page.waitForTimeout(1400);
        assert(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), `${size} ${room}: no horizontal overflow`);
        await page.screenshot({ path: path.join(output, `${size}-${room}.png`) });
      }
      await setRoom(page, 'crown');
      if (touch) {
        for (const id of ['slash', 'dash', 'prism', 'burst']) {
          const box = await page.locator('#' + id).boundingBox();
          assert(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${size}: visible 44px ${id}`);
        }
      }
      for (const state of ['stage1-telegraph', 'stage1-open', 'stage2-guarded', 'stage2-open', 'stage3-windup', 'stage3-pulse', 'stage3-open', 'final-result']) {
        await captureBoss(page, state, `${size}-${state}.png`);
        if (state === 'final-result') assert.equal((await page.locator('#objective').textContent()).trim(), 'The channels are safe', `${size}: result replaces active objective`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), `${size} ${state}: no horizontal overflow`);
      }
      if (touch && height > width) {
        const message = await page.locator('#message').boundingBox(), controls = await page.locator('#touchControls').boundingBox();
        assert(message && controls && message.y + message.height <= controls.y - 8, `${size}: quest copy clears the touch dock`);
      }
      if (touch && height <= 480) assert.equal(await page.locator('#message').isVisible(), false, `${size}: no redundant landscape copy over the scene`);
      assert.deepEqual(errors, [], `${size}: browser console`);
      assert.deepEqual(external, [], `${size}: no external requests`);
      report.push({ size, touch, errors, external, status: 'PASS' });
      await page.close();
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
