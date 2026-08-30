// Stormhook integration smoke test — real browser, whole campaign.
//
//   npx --yes http-server -p 8900 -c-1 --silent .
//   SH_PLAYWRIGHT=/opt/node22/lib/node_modules/playwright \
//   SH_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//   node stormhook/tools/smoke.js
//
// Covers what the jest suite structurally cannot see. The harness loads only
// core/levels/physics; render, ui, particles, audio and game need a real
// canvas and DOM, so a crash in any of them keeps `npm test` green. This
// walks the code paths that only exist in a browser: boot, a real swing
// driven through the input layer, every level transition, the clear and
// gameover screens, and the score-submit modal.
//
// Exits non-zero on any throw or unexpected console output, so it can gate
// a release.
const { chromium } = require(process.env.SH_PLAYWRIGHT || 'playwright');

const args = process.argv.slice(2);
function flag(n, d) { const i = args.indexOf('--' + n); return i === -1 ? d : args[i + 1]; }
const url = flag('url', 'http://127.0.0.1:8900/stormhook/index.html?level=1&auto=1');
const maxLevels = parseInt(flag('levels', '99'), 10);

const problems = [];
function check(cond, msg) { if (!cond) problems.push('FAIL: ' + msg); else console.log('  ok  ' + msg); }

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.SH_CHROME || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
           '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  const console_ = [];
  page.on('console', (m) => {
    const t = m.type();
    if (t !== 'error' && t !== 'warning') return;
    const txt = m.text();
    // The arcade's analytics tag is blocked by the sandbox proxy on every
    // game page in this project. Not a defect of this game.
    if (/googletagmanager|ERR_TUNNEL_CONNECTION_FAILED|ERR_BLOCKED/.test(txt)) return;
    console_.push(t.toUpperCase() + ': ' + txt);
  });
  page.on('pageerror', (e) => console_.push('PAGEERROR: ' + (e && e.message)));

  /* Track what actually failed to load. The leaderboard API only exists on
     Cloudflare Pages (see functions/), so a plain static server 404s it at
     run end — expected here, and not a defect. Anything else 404ing is. */
  const failedUrls = [];
  page.on('response', (r) => { if (r.status() >= 400) failedUrls.push(r.status() + ' ' + r.url()); });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.SH && SH.Game && SH.Game.state.phase !== 'boot',
                             { timeout: 15000 });

  console.log('\n-- boot');
  let st = await page.evaluate(() => ({ phase: SH.Game.state.phase, levels: SH.Levels.count(),
                                        bake: SH.Textures.bakeMs }));
  check(st.phase === 'playing', 'reaches phase "playing" (got ' + st.phase + ')');
  check(st.levels >= 3, 'campaign has ' + st.levels + ' levels');
  check(st.bake >= 0 && st.bake < 2000, 'textures baked in ' + Math.round(st.bake) + 'ms');

  console.log('\n-- a real swing, driven through the input layer');
  await page.evaluate(() => {
    const w = SH.Game.world;
    w.p.x = 30 * SH.TILE; w.p.y = 9.4 * SH.TILE; w.p.vx = 600; w.p.vy = 0;
    w.storm.speed = 0;
    SH.Input.aim.x = innerWidth * 0.62; SH.Input.aim.y = innerHeight * 0.12;
    SH.Input._down.hook = true;
  });
  await page.waitForTimeout(1200);
  let sw = await page.evaluate(() => {
    const w = SH.Game.world;
    return { attached: w.hook.attached, pivots: w.hook.pivots.length,
             speed: Math.hypot(w.p.vx, w.p.vy), air: w.airTime, dead: w.dead };
  });
  check(sw.attached, 'the tether latched and held through the swing');
  check(sw.pivots >= 1, 'rope has ' + sw.pivots + ' pivot(s)');
  check(sw.speed > 150, 'the swing carries real speed (' + Math.round(sw.speed) + ' px/s)');
  check(!sw.dead, 'the player survived the swing');

  console.log('\n-- rope wrapping in a real frame');
  const wrapped = await page.evaluate(() => {
    const w = SH.Game.world;
    // Anchor left of the level-0 pylon (tiles x=26..27), player right of it.
    w.hook.attached = true;
    w.hook.pivots = [{ x: 23 * SH.TILE, y: 2 * SH.TILE + 2, s: 0 }];
    w.hook.len = 700; w.hook.target = 700;
    w.p.x = 30 * SH.TILE; w.p.y = 9 * SH.TILE; w.p.vx = 0; w.p.vy = 0;
    /* Sample every frame: the player falls out of the wrapping geometry
       within a few hundred ms, so a single late reading misses it. */
    return new Promise((res) => {
      let most = 0, n = 0;
      (function tick() {
        most = Math.max(most, SH.Game.world.hook.pivots.length);
        if (++n < 30) requestAnimationFrame(tick); else res(most);
      })();
    });
  });
  check(wrapped > 1, 'the rope wrapped onto the pylon in the live game (' + wrapped + ' pivots)');

  console.log('\n-- level transitions and the clear screen');
  /* Let go first. A tether still anchored from the previous check yanks
     the player straight back off the beacon. */
  await page.evaluate(() => {
    SH.Input._down.hook = false;
    SH.Physics.releaseHook(SH.Game.world);
  });
  const total = await page.evaluate(() => SH.Levels.count());
  for (let i = 0; i < Math.min(total, maxLevels); i++) {
    const r = await page.evaluate(() => {
      SH.Input._down.hook = false;
      SH.Physics.releaseHook(SH.Game.world);
      SH.Game.world.p.x = SH.Game.world.beacon.x;
      SH.Game.world.p.y = SH.Game.world.beacon.y;
      SH.Game.world.p.vx = 0; SH.Game.world.p.vy = 0;
      return new Promise((res) => setTimeout(() => res({
        phase: SH.Game.state.phase, score: SH.Game.state.runScore,
      }), 350));
    });
    check(r.phase === 'clear' || r.phase === 'gameover',
          'level ' + (i + 1) + ' clears (phase ' + r.phase + ', score ' + r.score + ')');
    if (r.phase === 'gameover') break;
    await page.evaluate(() => SH.Game.continueFromClear());
    await page.waitForTimeout(200);
  }

  console.log('\n-- run end');
  const end = await page.evaluate(() => ({ phase: SH.Game.state.phase, score: SH.Game.state.runScore,
                                           cores: SH.Game.state.coresTotal }));
  check(end.phase === 'gameover', 'the run ends in "gameover" (got ' + end.phase + ')');
  check(end.score > 0, 'a score was accumulated (' + end.score + ')');

  console.log('\n-- death and restart');
  await page.evaluate(() => { SH.Game.startRun(0); });
  await page.waitForTimeout(150);
  const died = await page.evaluate(() => {
    SH.Game.world.storm.x = SH.Game.world.p.x + 40;
    return new Promise((res) => setTimeout(() => res({
      phase: SH.Game.state.phase, deaths: SH.Game.state.deaths,
      dead: SH.Game.world && SH.Game.world.dead,
    }), 1600));
  });
  check(died.deaths >= 1, 'the storm killed the player (' + died.deaths + ' death)');
  check(died.phase === 'playing' && !died.dead, 'the level restarted cleanly after death');

  console.log('\n-- layout');
  const lay = await page.evaluate(() => ({
    hScroll: document.documentElement.scrollWidth > window.innerWidth,
    fps: SH.Loop.fps,
  }));
  check(!lay.hScroll, 'no horizontal scrollbar');

  console.log('\n-- network + console');
  const unexpected = failedUrls.filter((u) => !/\/api\/leaderboard\//.test(u));
  check(unexpected.length === 0,
        'no unexpected failed requests' + (unexpected.length ? ': ' + unexpected.join(' | ') : ''));
  const lb = failedUrls.filter((u) => /\/api\/leaderboard\//.test(u));
  if (lb.length) console.log('  --  ' + lb.length + ' leaderboard 404(s), expected off Cloudflare Pages');

  /* Console 404s are only forgiven when every failed request was the
     leaderboard. If something else broke, the noise is real. */
  const noise = unexpected.length ? console_
    : console_.filter((m) => !/404 \(Not Found\)/.test(m));
  check(noise.length === 0, 'console clean' + (noise.length ? ': ' + noise.join(' | ') : ''));

  await browser.close();

  if (problems.length) {
    console.error('\n' + problems.length + ' PROBLEM(S):\n' + problems.join('\n'));
    process.exit(1);
  }
  console.log('\nSMOKE OK');
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
