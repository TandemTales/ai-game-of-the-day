/* Real Chromium smoke and responsive evidence. See ../TESTING.md. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.OO_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(process.env.OO_SHOTS || path.join(root, 'node_modules/.cache/orbit-orchard/latest'));
const sizes = process.env.OO_VIEWPORTS
  ? process.env.OO_VIEWPORTS.split(',').map(size => size.split('x').map(Number))
  : [[320,568],[390,844],[844,390],[768,1024],[1440,900],[3840,2160]];
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  });
});
async function visibleControls(page, selectors) {
  for (const selector of selectors) {
    const node = page.locator(selector);
    await node.scrollIntoViewIfNeeded();
    assert(await node.evaluate(el => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return r.width > 0 && r.height > 0 && (el === hit || el.contains(hit));
    }), `${selector} clipped or obstructed`);
  }
}
async function cardFits(page, selector) {
  assert(await page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/hidden|clip/.test(style.overflow + style.overflowX + style.overflowY)) {
        const p = parent.getBoundingClientRect();
        if (r.left < p.left - 1 || r.right > p.right + 1 || r.top < p.top - 1 || r.bottom > p.bottom + 1) return false;
      }
    }
    return document.documentElement.scrollWidth <= innerWidth;
  }), `${selector} must fit clipping ancestors`);
}
async function main() {
  fs.mkdirSync(output, { recursive:true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless:true, ...(process.env.OO_CHROME ? { executablePath:process.env.OO_CHROME } : {}) });
  const report = [];
  try {
    for (const [width,height] of sizes) {
      const page = await browser.newPage({ viewport:{ width,height }, hasTouch:width < 1000, deviceScaleFactor:1 });
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      page.on('console', message => { if (['error','warning'].includes(message.type())) errors.push(message.text()); });
      const external = [];
      page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) external.push(request.url()); });
      await page.goto(`http://127.0.0.1:${server.address().port}/orbit-orchard/index.html`);
      await page.waitForFunction(() => window.OO && OO.runtime);
      await cardFits(page, '#startCard');
      await visibleControls(page, ['#startButton']);
      await page.evaluate(() => window.scrollTo(0,0));
      await page.screenshot({ path:path.join(output, `${width}x${height}-ready.png`), fullPage:true });
      await page.locator('#startButton').click();
      const before = await page.evaluate(() => OO.runtime.state.player.x);
      await page.keyboard.down('d');
      await page.waitForTimeout(180);
      await page.keyboard.up('d');
      assert(await page.evaluate(x => OO.runtime.state.player.x > x, before), 'keyboard movement');
      await page.keyboard.down('w');
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      assert(await page.evaluate(() => !OO.runtime.state.input.up && !OO.runtime.state.input.pointerActive), 'blur clears held input');
      await page.keyboard.up('w');
      const canvas = await page.locator('canvas').boundingBox();
      await page.mouse.move(canvas.x + canvas.width * .7, canvas.y + canvas.height * .65);
      await page.mouse.down();
      await page.waitForTimeout(200);
      assert(await page.evaluate(() => OO.runtime.state.input.pointerActive), 'pointer drag active');
      await page.mouse.up();
      assert(await page.evaluate(() => !OO.runtime.state.input.pointerActive), 'pointer released');
      if (width < 1000) {
        const cdp = await page.context().newCDPSession(page);
        const point = { x:canvas.x + canvas.width * .3, y:canvas.y + canvas.height * .4 };
        await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[point] });
        await page.waitForTimeout(100);
        assert(await page.evaluate(() => OO.runtime.state.input.pointerActive), 'native touch steering active');
        await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
        assert(await page.evaluate(() => !OO.runtime.state.input.pointerActive), 'native touch released');
        await cdp.detach();
      }
      // Fixed seeded render fixture keeps comparisons repeatable; input checks above use live frames.
      await page.evaluate(() => {
        const s = OO.runtime.state;
        Object.assign(s, OO.createState(42)); OO.start(s);
        for (let i=0;i<90;i++) OO.step(s, { right:true }, 1/60);
        OO.draw(OO.runtime.canvas.getContext('2d'), s);
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => { OO.runtime.stop(); resolve(); }))));
      await page.evaluate(() => window.scrollTo(0,0));
      const arena = await page.locator('canvas').boundingBox();
      assert(Math.abs(arena.width / arena.height - 1.6) < .01, 'canvas keeps native aspect ratio');
      if (height < 620 && width > height) {
        assert(arena.y >= 0 && arena.y + arena.height <= height, 'entire landscape arena fits physical viewport');
        for (const selector of ['#scoreValue','#massValue','#timeValue']) {
          const readout = await page.locator(selector).boundingBox();
          assert(readout.y >= 0 && readout.y + readout.height <= height, `${selector} fits landscape viewport`);
        }
      }
      await page.screenshot({ path:path.join(output, `${width}x${height}-playing.png`), fullPage:true });
      // Reload resumes RAF for real HUD/overlay synchronization and score-form checks.
      await page.reload(); await page.locator('#startButton').click();
      await page.evaluate(() => { OO.runtime.state.timeLeft = .01; });
      await page.waitForFunction(() => OO.runtime.state.status === 'over');
      await cardFits(page, '#gameOverCard');
      await visibleControls(page, ['#playerName', '.submit-btn', '#replayButton']);
      await page.evaluate(() => window.scrollTo(0,0));
      await page.screenshot({ path:path.join(output, `${width}x${height}-over.png`), fullPage:true });
      await page.locator('#playerName').fill('');
      await page.locator('#playerName').pressSequentially('WASD pilot');
      assert.equal(await page.locator('#playerName').inputValue(), 'WASD pilot', 'callsign keyboard must not steer/restart');
      const requests = [];
      await page.route('**/api/leaderboard/**', async route => {
        requests.push({ url:route.request().url(), body:route.request().postData() });
        await route.fulfill({ json:{ rank:7 } });
      });
      await page.locator('#playerName').press('Enter');
      await page.waitForFunction(() => document.querySelector('#scoreResult').textContent.includes('rank #7'));
      assert.equal(requests.length, 2, 'rank before submit');
      assert(requests[0].url.includes('/rank?gameId=orbit-orchard&score='));
      assert.equal(JSON.parse(requests[1].body).name, 'WASD pilot');
      assert.equal(await page.evaluate(() => OO.runtime.state.status), 'over', 'Enter in form must not restart');
      await page.locator('#replayButton').click();
      assert.equal(await page.evaluate(() => OO.runtime.state.status), 'playing');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, 'horizontal overflow');
      assert.deepEqual(errors, [], 'browser console');
      assert.deepEqual(external, [], 'external runtime requests');
      report.push({width,height, keyboard:true, pointer:true, form:true, restart:true, overflow, errors});
      await page.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, viewports:report }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode=1; }).finally(() => server.close());
