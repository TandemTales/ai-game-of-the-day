// Paradox Vault headless screenshot + smoke harness.
//
//   node paradox-vault/tools/screenshot.js <outDir> [--vp WxH] [--url ...]
//                                          [--script drive.js] [--wait ms]
//
// Serve the repo root first (any static server):
//   npx --yes http-server -p 8900 -c-1 --silent .
//
// Writes <outDir>/<viewport>.png for each viewport plus <outDir>/report.json
// containing measured fps, console errors/warnings, any non-local network
// request, and a horizontal-scroll check.
//
// Playwright resolution: set PV_PLAYWRIGHT to an absolute path if playwright
// is installed globally rather than in this repo, e.g.
//   PV_PLAYWRIGHT=/opt/node22/lib/node_modules/playwright node ...
// Set PV_CHROME to a Chromium binary if the bundled download is unavailable.
//
// NOTE ON FPS: if this runs on a machine without GPU acceleration the browser
// falls back to software rasterisation (swiftshader) and the fps figure will be
// far below what real hardware gives. Treat it as a *relative* number for
// comparing changes, not as a verdict on whether the game hits 60fps.
const { chromium } = require(process.env.PV_PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const outDir = args[0] || 'out';
function flag(name, def) {
  const i = args.indexOf('--' + name);
  return i === -1 ? def : args[i + 1];
}

const VIEWPORTS = {
  '320x568':  { width: 320,  height: 568,  isMobile: true,  dsf: 2 },
  '390x844':  { width: 390,  height: 844,  isMobile: true,  dsf: 3 },
  '844x390':  { width: 844,  height: 390,  isMobile: true,  dsf: 3 },
  '768x1024': { width: 768,  height: 1024, isMobile: true,  dsf: 2 },
  '1440x900': { width: 1440, height: 900,  isMobile: false, dsf: 1 },
  '3840x2160':{ width: 3840, height: 2160, isMobile: false, dsf: 1 },
};

const only = flag('vp', null);
const url = flag('url', 'http://127.0.0.1:8900/paradox-vault/index.html?vault=1&auto=1');
const waitMs = parseInt(flag('wait', '2500'), 10);
const driveFile = flag('script', null);
const drive = driveFile ? fs.readFileSync(driveFile, 'utf8') : null;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.PV_CHROME || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
           '--autoplay-policy=no-user-gesture-required', '--mute-audio',
           '--font-render-hinting=none'],
  });

  const report = {};
  const names = only ? [only] : Object.keys(VIEWPORTS);

  for (const name of names) {
    const vp = VIEWPORTS[name];
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dsf,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      userAgent: vp.isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined,
    });
    const page = await ctx.newPage();
    const msgs = [];
    page.on('console', m => {
      const t = m.type();
      if (t === 'error' || t === 'warning') msgs.push(t.toUpperCase() + ': ' + m.text());
    });
    page.on('pageerror', e => msgs.push('PAGEERROR: ' + (e && e.message)));
    const requests = [];
    page.on('request', r => {
      const u = r.url();
      if (!u.startsWith('http://127.0.0.1:8900') && !u.startsWith('data:') && !u.startsWith('blob:')) {
        requests.push(u);
      }
    });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      msgs.push('NAV FAIL: ' + e.message);
    }

    // Wait for the game to leave boot.
    let phase = null;
    try {
      await page.waitForFunction(
        () => window.PV && window.PV.Game && window.PV.Game.state &&
              window.PV.Game.state.phase && window.PV.Game.state.phase !== 'boot',
        { timeout: 15000 });
    } catch (e) {
      msgs.push('NEVER LEFT BOOT within 15s');
    }

    if (drive) {
      try { await page.evaluate(drive); } catch (e) { msgs.push('DRIVE FAIL: ' + e.message); }
    }

    await page.waitForTimeout(waitMs);

    // Measure fps over ~1.5s of real frames.
    let stats = {};
    try {
      stats = await page.evaluate(() => new Promise(res => {
        let n = 0; const t0 = performance.now();
        function tick() {
          n++;
          if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
          else {
            const S = (window.PV && PV.Game && PV.Game.state) || {};
            res({
              fps: Math.round(n / ((performance.now() - t0) / 1000)),
              phase: S.phase,
              scrollW: document.documentElement.scrollWidth,
              innerW: window.innerWidth,
              scrollH: document.documentElement.scrollHeight,
              innerH: window.innerHeight,
              particles: (window.PV && PV.Particles && PV.Particles.count) || 0,
              bakeMs: (window.PV && PV.Textures && PV.Textures.bakeMs) || null,
              loopIndex: S.loopIndex, echoes: S.echoes && S.echoes.length,
              tick: S.tick,
            });
          }
        }
        requestAnimationFrame(tick);
      }));
    } catch (e) { msgs.push('STATS FAIL: ' + e.message); }

    await page.screenshot({ path: path.join(outDir, name + '.png'), timeout: 120000 });
    report[name] = {
      console: msgs,
      external: requests,
      ...stats,
      hScroll: stats.scrollW > stats.innerW,
    };
    console.log(name, JSON.stringify(report[name]));
    await ctx.close();
  }

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
