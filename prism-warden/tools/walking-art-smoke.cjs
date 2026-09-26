'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const { chromium } = require(process.env.PW_PLAYWRIGHT || (process.platform === 'win32' ? 'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright' : '/opt/node22/lib/node_modules/playwright'));
const root = path.resolve(__dirname, '../..');
const output = path.resolve(process.env.PW_SHOTS || 'node_modules/.cache/prism-warden/walking-art');
const directions = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'];
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, data) => {
    if (error) return res.writeHead(404).end();
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(data);
  });
});
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME || (process.platform === 'win32' ? 'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe' : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome') });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], assets = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().includes('/sera-walk-')) assets.push({ url: r.url(), status: r.status() }); });
    await page.route('**/assets/js/render.js', route => {
      const source = fs.readFileSync(path.join(root, 'prism-warden/assets/js/render.js'), 'utf8');
      return route.fulfill({ contentType: 'text/javascript', body: source.replace('})(typeof window', 'PW.inspectWalk = { drawPlayer, drawPlayerFx, frame: seraWalkFrame, sprites: seraSprites, walks: seraWalkSprites };\n})(typeof window') });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/prism-warden/index.html`);
    await page.waitForFunction(() => Object.keys(PW.inspectWalk.walks).length === 8 && Object.keys(PW.inspectWalk.sprites).length === 8);
    const report = await page.evaluate(directions => {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
      const ctx = canvas.getContext('2d'), counts = [], seen = new Set();
      for (const mode of ['walk', 'mirror', 'slash']) {
        directions.forEach((direction, i) => {
          const s = PW.create(); s.status = 'playing'; s.transition = 0;
          const a = Math.PI / 2 + i * Math.PI / 4, ax = Math.cos(a), ay = Math.sin(a);
          const frames = new Set(), used = new Set();
          PW.inspectWalk.drawPlayer(ctx, s.player, s, s.time);
          for (let tick = 0; tick < 90; tick++) {
            PW.step(s, { mx: ax, my: ay, ax, ay, reflect: mode === 'mirror', slash: mode === 'slash' && tick % 24 === 0 }, 1 / 60);
            const before = JSON.stringify(s), original = ctx.drawImage;
            ctx.drawImage = function (image, ...args) { used.add(image); seen.add(image); return original.call(this, image, ...args); };
            PW.inspectWalk.drawPlayer(ctx, s.player, s, s.time);
            ctx.drawImage = original;
            frames.add(PW.inspectWalk.frame(s.player, s.time));
            if (JSON.stringify(s) !== before) throw new Error('Rendering mutated the simulation');
          }
          const painted = [...used].filter(image => PW.inspectWalk.walks[direction].includes(image));
          if (painted.length !== 6) throw new Error(`${direction}/${mode}: used ${painted.length} walk frames`);
          PW.step(s, {}, 1 / 60); PW.inspectWalk.drawPlayer(ctx, s.player, s, s.time);
          if (PW.inspectWalk.frame(s.player, s.time) !== -1) throw new Error('Did not return to idle');
          counts.push({ direction, mode, frames: painted.length });
        });
      }
      return { counts, uniqueDrawnImages: seen.size };
    }, directions);
    assert.equal(report.counts.length, 24);
    // Animated turnaround uses the real actor renderer at its game size and 2x size.
    await page.evaluate(directions => {
      const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 560;
      const states = directions.map((direction, i) => {
        const s = PW.create(), a = Math.PI / 2 + i * Math.PI / 4;
        Object.assign(s.player, { x: 0, y: 0, aimX: Math.cos(a), aimY: Math.sin(a) });
        PW.inspectWalk.frame(s.player, 0); return s;
      });
      window.walkPreviewFrame = index => {
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#25383c'; ctx.fillRect(0, 0, 960, 560);
        const walking = index < 48;
        states.forEach((s, i) => {
          const p = s.player;
          if (walking) { p.x += p.aimX * 190 / 30; p.y += p.aimY * 190 / 30; }
          ctx.save(); ctx.translate(120 + i % 4 * 240, 190 + Math.floor(i / 4) * 280); ctx.scale(2, 2); ctx.translate(-p.x, -p.y);
          PW.inspectWalk.drawPlayer(ctx, p, s, (index + 1) / 30); ctx.restore();
          ctx.fillStyle = '#f2ead6'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(directions[i].toUpperCase() + ' · ' + (walking ? 'WALK' : 'IDLE'), 120 + i % 4 * 240, 248 + Math.floor(i / 4) * 280);
        });
        return canvas.toDataURL('image/png');
      };
    }, directions);
    for (let i = 0; i < 60; i++) {
      const png = await page.evaluate(i => window.walkPreviewFrame(i), i);
      fs.writeFileSync(path.join(output, `preview-${String(i).padStart(3, '0')}.png`), Buffer.from(png.split(',')[1], 'base64'));
    }
    // A missing walk sheet must keep the approved idle art usable during movement.
    await page.route('**/sera-walk-e-v1.png', route => route.fulfill({ status: 404, body: '' }));
    await page.reload();
    await page.waitForFunction(() => Object.keys(PW.inspectWalk.walks).length === 7 && Object.keys(PW.inspectWalk.sprites).length === 8);
    const fallback = await page.evaluate(() => {
      const s = PW.create(), ctx = document.createElement('canvas').getContext('2d');
      s.player.aimX = 1; s.player.aimY = 0;
      PW.inspectWalk.drawPlayer(ctx, s.player, s, 0); s.player.x += 20;
      let image; ctx.drawImage = source => { image = source; };
      PW.inspectWalk.drawPlayer(ctx, s.player, s, .1);
      return image === PW.inspectWalk.sprites.e;
    });
    assert(fallback); assert.deepEqual(errors, []);
    assert.equal(new Set(assets.filter(a => a.status === 200).map(a => a.url)).size, 8);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ ...report, errors, assets, fallback }, null, 2));
    console.log(`PASS: all 48 frames through movement/guard/slash inputs, stop-to-idle, state purity and missing-atlas fallback. Evidence: ${output}`);
  } finally { await browser?.close(); server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
