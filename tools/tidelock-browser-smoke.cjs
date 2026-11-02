const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'node_modules/.cache/tidelock/browser-smoke');
fs.mkdirSync(out, { recursive: true });
const api = [], results = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const item = { method: req.method, url: url.pathname + url.search }; api.push(item);
    let body = ''; req.on('data', d => body += d); req.on('end', () => {
      if (body) item.body = JSON.parse(body);
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ rank: 1, success: true }));
    }); return;
  }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  });
});
async function snapshot(page) {
  return page.evaluate(() => ({ mode: TL.Game.getMode(), player: { ...TL.Game.getState().player },
    score: TL.Game.getState().score, time: TL.Game.getState().time,
    overflow: document.documentElement.scrollWidth > innerWidth,
    controls: [...document.querySelectorAll('.deck button')].map(b => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x, y: r.y }; }) }));
}
async function hold(page, key, duration) {
  await page.keyboard.down(key); await page.waitForTimeout(duration); await page.keyboard.up(key);
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(edge) ? edge : undefined });
  try {
    for (const [width, height] of [[320,568],[390,844],[844,390],[768,1024],[1440,900],[3840,2160]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
      const errors = [], external = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => { if (['warning','error'].includes(m.type())) errors.push(m.text()); });
      page.on('request', r => { if (!r.url().startsWith(url)) external.push(r.url()); });
      page.on('dialog', d => d.accept('Chart QA'));
      await page.goto(url + '/tidelock/index.html');
      await page.screenshot({ path: path.join(out, `${width}x${height}-title.png`) });
      const panelFits = await page.evaluate(() => {
        const p = document.querySelector('.playfield').getBoundingClientRect(), b = document.querySelector('#start').getBoundingClientRect();
        return b.y >= p.y && b.bottom <= p.bottom && b.x >= p.x && b.right <= p.right;
      });
      assert(panelFits, 'title CTA fits the chart ' + width);
      await page.locator('#start').click();
      const before = await snapshot(page); assert.equal(before.mode, 'playing');
      await hold(page, 'ArrowRight', 260);
      let after = await snapshot(page); assert(after.player.x > before.player.x, 'real keyboard steering');
      const stopped = after.player.x; await page.waitForTimeout(200);
      assert.equal((await snapshot(page)).player.x, stopped, 'keyup stops movement');
      await page.locator('[data-dir="down"]').tap();
      assert((await snapshot(page)).player.y > after.player.y, 'native touch direction');
      await page.locator('#pulse').tap();
      assert(await page.evaluate(() => TL.Game.getState().freeze > 0), 'native touch pulse');
      await page.screenshot({ path: path.join(out, `${width}x${height}-play.png`) });
      await page.locator('#pause').click(); const paused = await snapshot(page);
      await page.waitForTimeout(180); assert.equal((await snapshot(page)).time, paused.time);
      await page.locator('#start').click(); assert.equal((await snapshot(page)).mode, 'playing');
      const m = await snapshot(page); assert.equal(m.overflow, false);
      m.controls.forEach(b => { assert(b.w >= 44 && b.h >= 44, '44px control target'); assert(b.x >= 0 && b.x + b.w <= width + 1); });
      assert.deepEqual(errors, []); assert.deepEqual(external, []);
      results.push({ viewport: [width, height], ...m, errors, external });
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
    const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('dialog', d => d.accept('Chart QA'));
    await page.goto(url + '/tidelock/index.html'); await page.locator('#start').click();
    // Actual inputs secure the first chart with moving, unmodified storms.
    await hold(page, 'ArrowUp', 1120); // reach northern shore
    await hold(page, 'ArrowRight', 1070); // safe-shore x~13
    await hold(page, 'ArrowDown', 2090); // first cable reconnects south
    assert(await page.evaluate(() => TL.Game.getState().score > 0), 'input-earned capture score');
    await page.screenshot({ path: path.join(out, 'input-capture.png') });
    // Topology/transition proof: freeze fixtures are explicitly separate from live input evidence.
    await page.evaluate(() => {
      const s = TL.Game.getState(), L = TL.Logic;
      s.enemies.forEach(e => { e.x = 29; e.y = 12; e.vx = 0; e.vy = 0; });
      function go(dx,dy,n) { for(let i=0;i<n;i++) L.move(s,dx,dy); }
      go(0,-1,s.player.y); go(1,0,22-s.player.x); go(0,1,24);
    });
    await page.waitForFunction(() => TL.Game.getMode() === 'clear');
    await page.screenshot({ path: path.join(out, 'chart-clear.png') });
    const earned = await page.evaluate(() => TL.Game.getState().score);
    await page.locator('#start').click(); assert.equal(await page.evaluate(() => TL.Game.getState().stage), 1);
    assert.equal(await page.evaluate(() => TL.Game.getState().score), earned);
    await page.evaluate(() => { TL.Game.getState().time = 0.01; });
    await page.waitForFunction(() => TL.Game.getMode() === 'end');
    await page.waitForFunction(() => document.getElementById('panel').hidden === false);
    await page.waitForTimeout(150); await page.screenshot({ path: path.join(out, 'gameover.png') });
    assert.equal(api.length, 2); assert.equal(api[0].method, 'GET'); assert(api[0].url.includes('gameId=tidelock'));
    assert.equal(api[1].method, 'POST'); assert.equal(api[1].body.gameId, 'tidelock'); assert.equal(api[1].body.score, earned);
    await page.locator('#start').click(); assert.equal(await page.evaluate(() => TL.Game.getState().score), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(out, 'resize.png') }); assert.equal((await snapshot(page)).overflow, false);
    assert.deepEqual(errors, []); await page.close();
    const offline = await browser.newPage(); await offline.goto('file:///' + path.join(root, 'tidelock/index.html').replace(/\\/g, '/'));
    await offline.locator('#start').click(); assert.equal(await offline.evaluate(() => TL.Game.getMode()), 'playing');
    await offline.close();
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ results, api, checks: 'keyboard, native touch, release, pulse, pause, input capture, fixture chart advance/loss, replay, rank-before-submit, file boot' }, null, 2));
    console.log(JSON.stringify({ viewports: results.length, checks: 'PASS', api }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
