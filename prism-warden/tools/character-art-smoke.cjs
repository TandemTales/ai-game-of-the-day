'use strict';
// Browser art inspection: actual renderer, with a test-only hook for its actor pass.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const { chromium } = require(process.env.PW_PLAYWRIGHT || (process.platform === 'win32' ? 'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright' : '/opt/node22/lib/node_modules/playwright'));
const root = path.resolve(__dirname, '../..');
const output = path.resolve(process.env.PW_SHOTS || 'node_modules/.cache/prism-warden/character-art');
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
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/sera-keeper-')) assets.push({ url: response.url(), status: response.status() });
    });
    await page.route('**/assets/js/render.js', route => {
      const source = fs.readFileSync(path.join(root, 'prism-warden/assets/js/render.js'), 'utf8');
      return route.fulfill({ contentType: 'text/javascript', body: source.replace("})(typeof window", 'PW.inspectSera = { drawPlayer, drawPlayerFx, sprites: seraSprites };\n})(typeof window') });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/prism-warden/` + 'index.html');
    await page.waitForFunction(() => Object.keys(PW.inspectSera.sprites).length === 8);
    const report = await page.evaluate(directions => {
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#25383c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const seen = new Set(), counts = [];
      for (let row = 0; row < 3; row++) {
        directions.forEach((direction, i) => {
          const a = Math.PI / 2 + i * Math.PI / 4;
          const state = PW.create(), p = state.player;
          Object.assign(p, { x: 0, y: 0, aimX: Math.cos(a), aimY: Math.sin(a), reflecting: row === 1, slashTime: row === 2 ? .11 : 0 });
          const before = JSON.stringify(state);
          let images = 0;
          const original = ctx.drawImage;
          ctx.drawImage = function (image, ...args) { images++; seen.add(image); return original.call(this, image, ...args); };
          ctx.save(); ctx.translate(80 + i * 160, 158 + row * 232); ctx.scale(2, 2);
          PW.inspectSera.drawPlayer(ctx, p, state, 1);
          PW.inspectSera.drawPlayerFx(ctx, p, 1);
          ctx.restore(); ctx.drawImage = original;
          if (JSON.stringify(state) !== before) throw new Error('Art mutated simulation');
          counts.push({ direction, row, images });
          ctx.fillStyle = '#f0e5cb'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(direction.toUpperCase() + ' / ' + ['idle', 'mirror', 'slash'][row], 80 + i * 160, 220 + row * 232);
        });
      }
      window.characterSheet = canvas.toDataURL('image/png');
      return { counts, uniqueSprites: seen.size };
    }, directions);
    assert.equal(report.uniqueSprites, 8, 'eight distinct painted directions');
    assert(report.counts.every(x => x.images === 1), 'every facing and action uses one painted body');
    fs.writeFileSync(path.join(output, 'directions.png'), Buffer.from((await page.evaluate(() => window.characterSheet)).split(',')[1], 'base64'));
    // Capture the complete game renderer at desktop and portrait sizes with each facing.
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      for (const direction of directions) {
        const png = await page.evaluate(({ width, height, index }) => {
          const s = PW.create(); s.status = 'playing'; s.time = 1; s.transition = 0;
          const a = Math.PI / 2 + index * Math.PI / 4;
          Object.assign(s.player, { aimX: Math.cos(a), aimY: Math.sin(a) });
          const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          PW.draw(ctx, s, width, height, 1);
          const pixels = ctx.getImageData(0, 0, width, height).data, colors = new Set();
          for (let y = 0; y < height; y += 20) for (let x = 0; x < width; x += 20) {
            const offset = (y * width + x) * 4;
            colors.add(`${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`);
          }
          if (colors.size < 30) throw new Error('Scene capture is blank or covered by a transition');
          return canvas.toDataURL('image/png');
        }, { width, height, index: directions.indexOf(direction) });
        fs.writeFileSync(path.join(output, `${width}x${height}-${direction}.png`), Buffer.from(png.split(',')[1], 'base64'));
      }
    }
    // Confirm a failed direction retains its drawable fallback without losing the other views.
    await page.route('**/sera-keeper-e-v1.png', route => route.fulfill({ status: 404, body: '' }));
    await page.reload();
    await page.waitForFunction(() => Object.keys(PW.inspectSera.sprites).length === 7);
    const fallbackImages = await page.evaluate(() => {
      const s = PW.create(); s.player.aimX = 1; s.player.aimY = 0;
      const ctx = document.createElement('canvas').getContext('2d');
      let images = 0; ctx.drawImage = () => { images++; };
      PW.inspectSera.drawPlayer(ctx, s.player, s, 1);
      return images;
    });
    assert.equal(fallbackImages, 0);
    assert.deepEqual(errors, []);
    assert.equal(assets.filter(a => a.status === 200).length >= 8, true);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ ...report, errors, assets, fallback: 'PASS' }, null, 2));
    console.log(`PASS: eight directions, mirror/slash, two viewport sizes, state purity and failed-asset fallback. Evidence: ${output}`);
  } finally { await browser?.close(); server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
