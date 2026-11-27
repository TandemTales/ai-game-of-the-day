const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const routes = require('./turntide-routes.cjs');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'node_modules/.cache/turntide-links/browser');
const api = [];
const errors = [];
const ext = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/leaderboard/')) {
    let data = '';
    req.on('data', part => { data += part; });
    req.on('end', () => {
      api.push({ path: url.pathname, method: req.method, query: Object.fromEntries(url.searchParams), body: data ? JSON.parse(data) : null });
      res.writeHead(200, { 'Content-Type':'application/json' }).end(JSON.stringify({ ok: true, rank: 1 }));
    });
    return;
  }
  const file = path.resolve(root, '.' + url.pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': ext[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
function observe(page) {
  page.on('pageerror', err => errors.push(String(err)));
  page.on('console', msg => { if (['warning','error'].includes(msg.type())) errors.push(msg.text()); });
  page.on('request', req => { if (!/^(http:\/\/127\.0\.0\.1|file:|data:)/.test(req.url())) errors.push(req.url()); });
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('turntide-links-tour-v1')));
async function playStroke(page, route, touch, options = {}) {
  const [club, angle, power] = route;
  const aim = await page.evaluate(({ angle }) => {
    const saved = JSON.parse(localStorage.getItem('turntide-links-tour-v1'));
    const lie = saved ? saved.lie : TL.Links.start(TL.holes[0], 0);
    const r = angle * Math.PI / 180;
    const dx = Math.cos(r), dy = Math.sin(r);
    const roomX = dx > 0 ? (715 - lie.x) / dx : (5 - lie.x) / dx;
    const roomY = dy > 0 ? (445 - lie.y) / dy : (5 - lie.y) / dy;
    const distance = Math.min(Math.abs(roomX), Math.abs(roomY));
    return { x: lie.x + distance * dx, y: lie.y + distance * dy };
  }, { angle });
  const canvas = page.locator('#chart');
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  const x = bounds.x + aim.x / 720 * bounds.width;
  const y = bounds.y + aim.y / 450 * bounds.height;
  if (touch) await page.touchscreen.tap(x,y);
  else await page.mouse.click(x,y);
  const action = async selector => touch ? page.locator(selector).tap() : page.locator(selector).click();
  await action('#' + club);
  const slider = page.locator('#power');
  await slider.focus();
  await slider.press('Home');
  for (let i = 1; i < power; i++) await slider.press('ArrowRight');
  assert.equal(await slider.inputValue(), String(power));
  if (options.keyboard) { await canvas.focus(); await page.keyboard.press('Space'); }
  else await action('#strike');
  if (options.reload) await page.reload();
  await page.waitForFunction(() => !document.getElementById('strike').disabled || !document.getElementById('result-panel').hidden);
  return saved(page);
}
async function run() {
  fs.mkdirSync(out, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(edge) ? edge : undefined });
    const url = 'http://127.0.0.1:' + server.address().port + '/turntide-links/index.html';
    const sizes = [[320,568],[390,844],[844,390],[768,1024],[1440,900],[3840,2160]];
    for (const [width,height] of sizes) {
      const page = await browser.newPage({ viewport: { width,height }, hasTouch: width < 1000 });
      observe(page);
      await page.goto(url);
      await page.screenshot({ path: path.join(out, width + 'x' + height + '.png') });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('#book summary').click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width:390, height:844 }, hasTouch: true });
    observe(page);
    await page.goto(url);
    await page.locator('#chart').focus();
    const angle = await page.locator('#bearing').textContent();
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await page.locator('#bearing').textContent(), angle);
    const order = ['bell','dune','raftLow','highQuay'];
    let journal;
    for (const [i, name] of order.entries()) {
      assert.equal(await page.locator('#hole-number').textContent(), 'Gull Post · Hole 0' + (i+1) + ' / 04');
      for (const [j, stroke] of routes[name].entries()) {
        journal = await playStroke(page, stroke, true, { reload: i === 0 && j === 0, keyboard: i === 1 && j === 0 });
        if (i === 2 && j === 0) {
          assert.equal(journal.lie.level,1);
          assert(journal.lie.marked);
          assert.match(await page.locator('#notice').textContent(), /Pontoon carried/);
          await page.screenshot({ path: path.join(out, 'pontoon-ride.png') });
        }
      }
      assert(journal.lie.holed && journal.lie.marked, 'completion and stamp ' + name + ': ' + JSON.stringify(journal.lie));
      await page.locator('#advance').tap();
      if (i < 3) await page.reload();
    }
    assert.equal(journal.lie.passage, 'quay');
    assert.equal(await page.locator('#total').textContent(), '5,600');
    await page.locator('#keeper').fill('Gull QA');
    await page.locator('#post').tap();
    await page.waitForFunction(() => document.getElementById('board-message').textContent.includes('Score posted'));
    assert.deepEqual(api.map(item => [item.method,item.path]), [['GET','/api/leaderboard/rank'],['POST','/api/leaderboard/submit']]);
    assert.deepEqual(api[0].query, { gameId:'turntide-links',score:'5600' });
    assert.deepEqual(api[1].body, { gameId:'turntide-links',score:5600,name:'Gull QA' });
    await page.locator('#book').screenshot({ path: path.join(out,'scorecard.png') });
    await page.locator('#hole-picker').selectOption('4');
    await page.locator('#replay').tap();
    for (const stroke of routes.drainSand) journal = await playStroke(page, stroke, true);
    assert(journal.lie.holed && journal.lie.passage === 'sandbar');
    await page.reload();
    assert.equal((await saved(page)).cards[4].leastStrokes, 2);
    assert.equal(await page.locator('#total').textContent(), '5,600');
    await page.close();
    const offline = await browser.newPage();
    observe(offline);
    await offline.goto(pathToFileURL(path.join(root,'turntide-links/index.html')).href);
    for (const stroke of routes.bell) journal = await playStroke(offline, stroke, false);
    assert(journal.lie.holed);
    assert(await offline.locator('#post').isDisabled());
    assert.deepEqual(errors, []);
    console.log('PASS: 6 viewport captures, 4 stamped touch holes, 5,600 points, both ferry routes, mid-shot reload, keyboard stroke, local rank/submit and file:// hole-out.');
    console.log(out);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(err => { console.error(err); process.exitCode = 1; });
