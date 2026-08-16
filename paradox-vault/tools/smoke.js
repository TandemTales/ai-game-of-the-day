// Paradox Vault — integration smoke test in a real browser.
//
//   node paradox-vault/tools/smoke.js [--url ...] [--vaults N]
//
// Serve the repo root first:
//   npx --yes http-server -p 8900 -c-1 --silent .
//
// WHY THIS EXISTS, SEPARATELY FROM THE JEST SUITE
// __tests__/paradox-vault.harness.js only loads core.js, levels.js and
// entities.js — the pure-logic modules. render.js, ui.js, particles.js,
// audio.js and game.js need a real canvas and DOM, so jest cannot see them
// at all. Anything that throws inside those files is invisible to `npm test`.
//
// The screenshot harness does not cover it either: it boots ONE vault with
// ?vault=1&auto=1 and photographs it, so any code path that only runs on a
// vault transition, a rewind, or a run ending is never executed.
//
// That gap is not hypothetical. A `ReferenceError: propCache is not defined`
// in R.invalidate() — called by startVault() on EVERY vault change — would
// have shipped a game that hard-crashed the instant a player finished vault 1,
// while both the jest suite and the screenshot sweep stayed green.
//
// So this walks the whole campaign and pulls the signature levers, asserting
// only that nothing throws and the console stays clean.
//
// Exits non-zero on failure so it can gate a release.
const { chromium } = require(process.env.PV_PLAYWRIGHT || 'playwright');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i === -1 ? d : args[i + 1]; };
const url = flag('url', 'http://127.0.0.1:8900/paradox-vault/index.html?vault=1&auto=1');
const vaultCount = parseInt(flag('vaults', '10'), 10);

// The arcade's analytics tag is blocked by the sandbox proxy on every game
// page. It is not a game defect, so it is the one tolerated console error.
const IGNORE = /googletagmanager|ERR_TUNNEL_CONNECTION_FAILED|ERR_BLOCKED_BY_CLIENT/;

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PV_CHROME || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
           '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const issues = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    if (IGNORE.test(m.text())) return;
    issues.push(m.type().toUpperCase() + ': ' + m.text());
  });
  page.on('pageerror', (e) => issues.push('PAGEERROR: ' + (e && e.message)));

  const steps = [];
  const fail = (msg) => { steps.push({ ok: false, msg }); };
  const pass = (msg, extra) => { steps.push({ ok: true, msg, ...(extra || {}) }); };

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const booted = await page.evaluate(() => ({
    phase: PV.Game.state.phase,
    bakeMs: PV.Textures && PV.Textures.bakeMs,
    vault: PV.Game.state.vault && PV.Game.state.vault.name,
  }));
  booted.phase === 'playing'
    ? pass('boots to playing', { vault: booted.vault, bakeMs: booted.bakeMs })
    : fail('did not reach phase "playing" (got ' + booted.phase + ')');

  /* ---- the signature mechanic ---- */
  const rew = await page.evaluate(async () => {
    const before = { echoes: PV.Game.world.echoes.length, left: PV.Game.state.echoesLeft, loop: PV.Game.state.loopIndex };
    PV.Game.rewind();
    await new Promise((r) => setTimeout(r, 700));
    return { before, after: { echoes: PV.Game.world.echoes.length, left: PV.Game.state.echoesLeft, loop: PV.Game.state.loopIndex } };
  }).catch((e) => ({ error: String(e) }));

  if (rew.error) fail('rewind threw: ' + rew.error);
  else if (rew.after.echoes === rew.before.echoes + 1 &&
           rew.after.left === rew.before.left - 1 &&
           rew.after.loop === rew.before.loop + 1) {
    pass('rewind spawns exactly one echo and costs exactly one', rew);
  } else fail('rewind accounting wrong: ' + JSON.stringify(rew));

  /* ---- every vault transition ---- */
  for (let i = 2; i <= vaultCount; i++) {
    const r = await page.evaluate(async () => {
      PV.Game.nextVault();
      await new Promise((res) => setTimeout(res, 150));
      const w = PV.Game.world, s = PV.Game.state;
      return {
        phase: s.phase, index: s.vaultIndex, name: s.vault && s.vault.name,
        relics: w.relics.length, sentries: w.sentries.length, actors: w.allActors.length,
      };
    }).catch((e) => ({ error: String(e && e.message || e) }));

    if (r.error) { fail('vault ' + i + ' transition threw: ' + r.error); break; }
    if (r.index !== i - 1) { fail('vault ' + i + ' index wrong: ' + r.index); break; }
    pass('vault ' + i + ' "' + r.name + '" builds', { relics: r.relics, sentries: r.sentries });
  }

  /* ---- a rewind inside a late vault, where sentries and lasers exist ---- */
  const lateRew = await page.evaluate(async () => {
    PV.Game.rewind();
    await new Promise((r) => setTimeout(r, 700));
    return { phase: PV.Game.state.phase, echoes: PV.Game.world.echoes.length };
  }).catch((e) => ({ error: String(e && e.message || e) }));
  lateRew.error ? fail('late-vault rewind threw: ' + lateRew.error)
                : pass('rewind works in a late vault', lateRew);

  /* ---- the run can end ---- */
  const over = await page.evaluate(async () => {
    PV.Game.retireRun();
    await new Promise((r) => setTimeout(r, 500));
    return { phase: PV.Game.state.phase };
  }).catch((e) => ({ error: String(e && e.message || e) }));
  over.error ? fail('retireRun threw: ' + over.error)
             : (over.phase === 'gameover' ? pass('run ends cleanly') : fail('run did not reach gameover: ' + over.phase));

  /* ---- report ---- */
  for (const s of steps) {
    console.log((s.ok ? '  ok   ' : '  FAIL ') + s.msg +
      (s.vault ? '  [' + s.vault + ']' : '') +
      (s.relics !== undefined ? '  relics:' + s.relics + ' sentries:' + s.sentries : '') +
      (s.bakeMs !== undefined ? '  bakeMs:' + Math.round(s.bakeMs) : ''));
  }
  if (issues.length) {
    console.log('\nConsole issues:');
    for (const i of [...new Set(issues)]) console.log('  ' + i);
  }

  const failed = steps.filter((s) => !s.ok).length;
  console.log('\n' + (steps.length - failed) + '/' + steps.length + ' checks passed, ' +
              issues.length + ' console issue(s)');

  await browser.close();
  process.exit(failed || issues.length ? 1 : 0);
})();
