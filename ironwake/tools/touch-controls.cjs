'use strict';
// Native CDP touch events exercise the DOM handlers and real animation frames.
// Empty-arena and stopped-frame fixtures isolate controls; this is NOT a campaign
// playthrough, physical-device check, or evidence that the game is enjoyable.
const fs = require('fs'), path = require('path'), http = require('http');
const assert = require('assert/strict');
const { chromium } = require(process.env.IW_PLAYWRIGHT || 'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(process.env.IW_SHOTS || 'node_modules/.cache/ironwake/sep11-controls');
const sizes = (process.env.IW_VIEWPORTS || '320x568,390x844,844x390').split(',').map(s => s.split('x').map(Number));
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, data) => {
    if (error) return res.writeHead(404).end();
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(data);
  });
});
const report = { kind: 'native-touch-control-fixtures', fullCampaign: false, viewports: [] };

async function center(page, selector) {
  const box = await page.locator(selector).boundingBox();
  assert(box, selector + ' is visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function arena(page) {
  await page.evaluate(() => {
    const s = IW.runtime.state;
    s.buildings = []; s.enemies = []; s.hazards = []; s.pickups = [];
    s.projectiles = []; s.effects = []; s.stage = 0;
    Object.assign(s.objectives[0], { type: 'reach', x: 90, z: 90, done: false });
    Object.assign(s.player, { x: 0, z: 0, heat: 0, overheated: false, fireCooldown: 0, punchCooldown: 0, dashCooldown: 0, dashing: 0 });
  });
}

async function snapshot(page) {
  return page.evaluate(() => {
    const { state: s, input: i, renderer: r } = IW.runtime, p = s.player;
    const origin = r.project(p.x, p.z), tip = r.project(p.x + Math.sin(p.angle) * 3, p.z + Math.cos(p.angle) * 3);
    const bullet = s.projectiles.filter(b => b.owner === 'player').at(-1);
    return {
      x: p.x, z: p.z, angle: p.angle, aimX: i.aimX, aimZ: i.aimZ,
      screenDirection: { x: tip.x - origin.x, y: tip.y - origin.y },
      bullet: bullet && { id: bullet.id, vx: bullet.vx, vz: bullet.vz },
      heat: p.heat, punchCooldown: p.punchCooldown, dashCooldown: p.dashCooldown,
      fire: i.fire, moveX: i.moveX, moveZ: i.moveZ,
      heldActions: ['fire', 'punch', 'rip', 'vent', 'dash', 'interact'].filter(k => i[k]),
      paused: IW.runtime.paused, time: s.time
    };
  });
}

function aligned(actual, expected, message) {
  const dot = (actual.x * expected.x + actual.y * expected.y) / (Math.hypot(actual.x, actual.y) * Math.hypot(expected.x, expected.y));
  assert(dot > .97, `${message}: direction cosine ${dot}`);
}

async function runViewport(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
  const page = await context.newPage(), cdp = await context.newCDPSession(page);
  const errors = [], touches = new Map(), nativeIds = new Map(), checks = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (['warning', 'error'].includes(m.type())) errors.push(m.text()); });
  async function dispatch(type) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...touches].map(([id, p]) => ({ id, ...p })) }); }
  async function down(id, point) {
    touches.set(id, point); await dispatch('touchStart');
    nativeIds.set(id, await page.evaluate(() => window.controlFixturePointerEvents.filter(e => e.type === 'pointerdown').at(-1).id));
  }
  async function move(id, point) { touches.set(id, point); await dispatch('touchMove'); }
  async function up(id) {
    const mark = await page.evaluate(() => window.controlFixturePointerEvents.length);
    const point = touches.get(id);
    touches.delete(id);
    // Installed Chromium 1155 needs the ended contact for a partial touchEnd:
    // touchMove with an omitted contact emits no pointerup here. This differs
    // from current CDP documentation; assert the observed DOM event below so a
    // browser-version change cannot silently weaken the ownership regression.
    if (touches.size) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id, ...point }] });
    else await dispatch('touchEnd');
    const released = await page.evaluate(mark => window.controlFixturePointerEvents.slice(mark).filter(e => e.type === 'pointerup').map(e => e.id), mark);
    assert.deepEqual(released, [nativeIds.get(id)], 'native pointerup releases exactly the intended contact');
    nativeIds.delete(id);
  }
  async function releaseAll() { if (!touches.size) return; touches.clear(); await dispatch('touchEnd'); }
  async function tap(selector) { await page.locator(selector).scrollIntoViewIfNeeded(); await down(99, await center(page, selector)); await up(99); }
  async function quiet(label) {
    await page.waitForTimeout(150);
    const s = await snapshot(page);
    assert(!s.paused, label + ': simulation resumed for ghost-input checks');
    assert.deepEqual(s.heldActions, [], label + ': held actions clear');
    assert.equal(s.moveX, 0, label + ': movement X clear');
    assert.equal(s.moveZ, 0, label + ': movement Z clear');
    assert.equal(s.heat, 0, label + ': queued fire/punch did not execute');
    assert.equal(s.punchCooldown, 0, label + ': queued punch clear');
    assert.equal(s.dashCooldown, 0, label + ': queued boost clear');
    assert.equal(s.x, 0, label + ': old stick cannot move');
    assert.equal(s.z, 0, label + ': old stick cannot move');
    assert(!s.bullet, label + ': no ghost projectile');
  }
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/ironwake/index.html`);
    await page.waitForFunction(() => window.IW?.runtime);
    await page.evaluate(() => {
      window.controlFixturePointerEvents = [];
      for (const type of ['pointerdown', 'pointerup']) document.addEventListener(type, e => window.controlFixturePointerEvents.push({ type, id: e.pointerId }), true);
    });
    // Observe the world point in the same camera frame as the game's handler.
    // Picking before dispatch would race the following camera's easing.
    await page.evaluate(() => document.addEventListener('pointerdown', e => {
      if (e.target.id === 'scene') window.controlFixturePick = IW.runtime.renderer.pick(e.clientX, e.clientY);
    }, true));
    if (process.env.IW_TRACE) await page.evaluate(() => {
      window.touchTrace = [];
      for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture', 'pointermove']) document.addEventListener(type, e => {
        window.touchTrace.push({ type, id: e.pointerId, kind: e.pointerType, target: e.target.id || e.target.dataset.action, x: e.clientX, y: e.clientY });
      }, true);
    });
    await tap('#start');
    await arena(page);
    await page.waitForTimeout(200);
    const stick = await center(page, '#stick'), fire = await center(page, '[data-action=fire]');
    // A battlefield tap establishes a fixed world target without firing.
    const battlefield = { x: width * .62, y: height * .50 };
    assert.equal(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.id, battlefield), 'scene', 'tap fixture hits battlefield');
    await down(1, battlefield); await up(1); await page.waitForTimeout(60);
    const target = await page.evaluate(() => window.controlFixturePick);
    let s = await snapshot(page);
    assert(Math.hypot(s.aimX - target.x, s.aimZ - target.z) < .1, 'battlefield tap sets aim');
    assert(!s.bullet, 'battlefield tap does not shoot');
    checks.push('battlefield tap aim');

    await down(1, { x: stick.x + 25, y: stick.y });
    await down(2, fire);
    await page.waitForTimeout(100);
    s = await snapshot(page);
    assert(s.x > 0 && s.fire && s.bullet, 'two native touches move and fire');
    assert(Math.hypot(s.aimX - target.x, s.aimZ - target.z) < .1, 'undragged FIRE preserves tap target');
    await move(2, { x: fire.x + 5, y: fire.y });
    await page.waitForTimeout(50);
    s = await snapshot(page);
    assert(Math.hypot(s.aimX - target.x, s.aimZ - target.z) < .1, 'small thumb jitter preserves tap target');
    checks.push('two-thumb fire and movement; deadzone preserves tap aim');

    const cardinal = [ { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 } ];
    for (const direction of cardinal) {
      const distance = Math.min(70, direction.y > 0 ? height - fire.y - 2 : Infinity, direction.x > 0 ? width - fire.x - 2 : Infinity);
      const next = { x: fire.x + direction.x * distance, y: fire.y + direction.y * distance };
      const before = await snapshot(page);
      await move(2, next);
      await page.waitForTimeout(360);
      s = await snapshot(page);
      assert(s.x > before.x && s.fire, 'movement/fire continue while retargeting');
      aligned(s.screenDirection, direction, 'mech follows screen drag');
      assert(s.bullet && s.bullet.id !== before.bullet?.id, 'retarget produces a new projectile');
      aligned({ x: s.bullet.vx, y: s.bullet.vz }, { x: Math.sin(s.angle), y: Math.cos(s.angle) }, 'new projectile follows mech aim');
    }
    checks.push('four-direction captured FIRE drag changes real projectile direction while moving');

    // Drag out over the battlefield; capture must keep firing and retain ownership.
    await move(2, { x: fire.x, y: fire.y - 90 });
    await page.waitForTimeout(80);
    const owned = await snapshot(page);
    await down(3, battlefield);
    await move(3, { x: battlefield.x - 35, y: battlefield.y + 25 });
    await page.waitForTimeout(80);
    s = await snapshot(page);
    aligned({ x: Math.sin(s.angle), y: Math.cos(s.angle) }, { x: Math.sin(owned.angle), y: Math.cos(owned.angle) }, 'third battlefield pointer cannot steal FIRE direction');
    assert(s.fire, 'captured FIRE remains held outside button');
    await up(3);
    await down(3, fire);
    await move(3, { x: fire.x + 40, y: fire.y });
    await page.waitForTimeout(80);
    s = await snapshot(page);
    aligned({ x: Math.sin(s.angle), y: Math.cos(s.angle) }, { x: Math.sin(owned.angle), y: Math.cos(owned.angle) }, 'second FIRE pointer cannot steal direction');
    await up(3);
    assert((await snapshot(page)).fire, 'releasing second FIRE pointer cannot release owner');
    await page.screenshot({ path: path.join(output, `${width}x${height}-two-thumb.png`) });
    await releaseAll(); await page.waitForTimeout(80);
    s = await snapshot(page);
    assert(!s.fire && s.moveX === 0 && s.moveZ === 0, 'native touch release clears movement/fire');
    checks.push('outside-button capture and unrelated-pointer isolation; release');

    // Suspend frames before native action presses so each lifecycle boundary must
    // discard BOTH queued and held inputs. These are deliberate lifecycle fixtures.
    for (const boundary of ['pause', 'blur', 'resize', 'retry']) {
      await arena(page);
      await page.evaluate(() => IW.runtime.stop());
      // Let the already scheduled callback observe running=false before resume.
      await page.waitForTimeout(60);
      const currentStick = await center(page, '#stick');
      await down(1, { x: currentStick.x + 25, y: currentStick.y });
      await down(2, await center(page, '[data-action=fire]'));
      await down(3, await center(page, '[data-action=punch]'));
      await down(4, await center(page, '[data-action=dash]'));
      if (boundary === 'pause') await page.keyboard.press('Escape');
      if (boundary === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      if (boundary === 'resize') await page.setViewportSize({ width: width + 1, height });
      if (boundary === 'retry') {
        // The defeat transition must clear queued actions before retry can start.
        await page.evaluate(() => { IW.runtime.state.status = 'lost'; IW.runtime.resume(); });
        await page.waitForFunction(() => !document.querySelector('#results').hidden);
        await releaseAll();
        await tap('#retry');
        await arena(page);
      } else {
        await move(2, { x: fire.x - 60, y: fire.y - 60 });
        if (boundary === 'pause' || boundary === 'blur') {
          assert(await page.evaluate(() => IW.runtime.paused), boundary + ' pauses');
          // The original fingers remain down. Secondary touches do not synthesize
          // a browser click, so use the ordinary map hotkey to resume with them held.
          await page.keyboard.press('Escape');
        }
        await page.evaluate(() => IW.runtime.resume());
      }
      await quiet(boundary);
      await releaseAll();
      if (boundary === 'resize') await page.setViewportSize({ width, height });
      checks.push(boundary + ' discards held and queued controls');
    }
    // Native cancellation also relinquishes ownership; a fresh tap can aim again.
    await down(1, { x: stick.x + 25, y: stick.y }); await down(2, fire);
    await move(2, { x: fire.x - 55, y: fire.y - 55 });
    touches.clear(); await dispatch('touchCancel'); await page.waitForTimeout(60);
    s = await snapshot(page);
    assert(!s.fire && s.moveX === 0 && s.moveZ === 0, 'native cancellation clears held controls');
    await down(1, battlefield); await up(1); await page.waitForTimeout(60);
    const retarget = await page.evaluate(() => window.controlFixturePick);
    s = await snapshot(page);
    assert(Math.hypot(s.aimX - retarget.x, s.aimZ - retarget.z) < .1, 'cancelled FIRE no longer owns aim');
    checks.push('native touchCancel releases aim ownership');

    // Desktop controls must still aim at a world point after touch aim was used.
    await arena(page); await page.waitForTimeout(80);
    await page.mouse.move(battlefield.x, battlefield.y);
    await page.keyboard.down('d'); await page.mouse.down();
    const mouseTarget = await page.evaluate(() => window.controlFixturePick);
    await page.waitForTimeout(150);
    s = await snapshot(page);
    assert(s.x > 0 && s.fire && s.bullet, 'keyboard movement and left mouse fire remain available');
    assert(Math.hypot(s.aimX - mouseTarget.x, s.aimZ - mouseTarget.z) < .1, 'mouse aim remains a fixed world target while moving');
    await page.mouse.up(); await page.keyboard.up('d');
    await page.mouse.click(battlefield.x, battlefield.y, { button: 'right' });
    await page.waitForTimeout(60);
    assert((await snapshot(page)).punchCooldown > 0, 'right mouse still punches');
    checks.push('desktop world-point mouse aim, fire, right-click punch and keyboard movement');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, 'no horizontal overflow');
    assert.deepEqual(errors, [], 'browser console/page errors');
    await page.screenshot({ path: path.join(output, `${width}x${height}-released.png`) });
    report.viewports.push({ width, height, checks, errors, passed: true });
    console.log(`${width}x${height}: ${checks.length} native control checks passed`);
  } catch (error) {
    if (process.env.IW_TRACE) console.log(JSON.stringify(await page.evaluate(() => window.touchTrace)));
    report.viewports.push({ width, height, checks, errors, passed: false, failure: error.stack });
    await page.screenshot({ path: path.join(output, `${width}x${height}-failure.png`) }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, executablePath: process.env.IW_CHROME || 'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe' });
    for (const [width, height] of sizes) await runViewport(browser, width, height);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    report.completedAt = new Date().toISOString();
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
