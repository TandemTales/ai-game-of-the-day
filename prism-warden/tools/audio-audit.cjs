'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const { chromium } = require(process.env.PW_PLAYWRIGHT || (process.platform === 'win32'
  ? 'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
  : '/opt/node22/lib/node_modules/playwright'));
const root = path.resolve(__dirname, '../..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404).end(); return; }
    const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'text/html';
    res.setHeader('Content-Type', type); res.end(data); });
});
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME || (process.platform === 'win32'
      ? 'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe'
      : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome') });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/prism-warden/index.html`);
    await page.waitForFunction(() => window.PW?.Audio?._render);
    const result = await page.evaluate(async () => {
      const b = await PW.Audio._render({ seconds: 5,
        music: [{ t: 0, key: 'furnace' }, { t: 2, key: 'weaver-boss' }],
        cues: [[.8, 'thermalHot'], [2.4, 'glassAnneal'], [3.2, 'weaverWake']] });
      const d = b.getChannelData(0), rms = (a, z) => {
        let sum = 0, peak = 0, finite = true, n = 0;
        for (let i = Math.floor(a * b.sampleRate); i < Math.floor(z * b.sampleRate); i++) {
          const x = d[i]; if (!Number.isFinite(x)) finite = false;
          peak = Math.max(peak, Math.abs(x)); sum += x * x; n++;
        }
        return { rms: Math.sqrt(sum / n), peak, finite };
      };
      return { sampleRate: b.sampleRate, duration: b.duration, opening: rms(.2, 1.8), boss: rms(2.2, 4.8) };
    });
    assert(result.opening.finite && result.boss.finite, 'rendered audio contains only finite samples');
    assert(result.opening.peak > .005 && result.boss.peak > .005, 'music and cues produce non-silent audio');
    assert(result.opening.peak < 1 && result.boss.peak < 1, 'master chain keeps rendered peaks below full scale');
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser?.close(); server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
