// Zephyr Circuit headless audio render + analysis harness.
//
//   node zephyr-circuit/tools/audioscope.js <outDir> [--scenarios a,b,c]
//                                           [--seconds 20] [--url ...]
//
// Serve the repo root first (any static server):
//   npx --yes http-server -p 8900 -c-1 --silent .
//
// Loads the game in headless Chromium, asks `ZC.Audio.__renderOffline()` to
// build the full audio graph into an OfflineAudioContext and render a
// scenario, pulls the raw PCM back out, and writes for each scenario:
//
//   <scenario>.spectrogram.png   log-frequency STFT, 30..16000 Hz
//   <scenario>.waveform.png      peak/RMS envelope over time
//   <scenario>.wav               the render itself, for a human to listen to
//   report.json                  peak, RMS, dBFS, clipping, DC offset,
//                                silence ratio, spectral centroid/rolloff,
//                                per-second RMS, stereo width
//
// WHY THIS EXISTS: audio cannot be judged from a screenshot and cannot be
// heard in a sandbox. A spectrogram makes the things that actually separate
// shipped game audio from a synth doodle visible: whether the engine has
// harmonic structure that moves with RPM or is one sliding tone, whether the
// music has a bass/mid/lead layer separation or is a single voice, whether
// one-shots have transients, and whether anything is clipping or DC-offset.
//
// The ffmpeg shipped in the Playwright bundle is a minimal build with no
// showspectrumpic/showwavespic, so the STFT and the PNG encoding are done
// here in pure Node against zlib.
//
// Playwright resolution matches tools/screenshot.js: set ZC_PLAYWRIGHT to an
// absolute path if playwright is not resolvable from the repo, and ZC_CHROME
// to a Chromium binary if the bundled download is unavailable.

const { chromium } = require(process.env.ZC_PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const args = process.argv.slice(2);
const outDir = args[0] || 'audio-out';
function flag(name, def) {
  const i = args.indexOf('--' + name);
  return i === -1 ? def : args[i + 1];
}

const url = flag('url', 'http://127.0.0.1:8900/zephyr-circuit/index.html');
const seconds = parseFloat(flag('seconds', '20'));
const scenarios = flag('scenarios', 'race,menu,drift,results').split(',')
  .map(s => s.trim()).filter(Boolean);

/* ------------------------------------------------------------------ */
/* PNG encoding (truecolour, no filtering) — enough for a diagnostic.  */
/* ------------------------------------------------------------------ */
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// rgb: Uint8Array of width*height*3
function writePng(file, width, height, rgb) {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filter: none
    rgb.copy
      ? rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3)
      : Buffer.from(rgb.buffer, y * width * 3, width * 3).copy(raw, y * (width * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

/* ------------------------------------------------------------------ */
/* WAV writing — so a human can actually listen to the render.        */
/* ------------------------------------------------------------------ */
function writeWav(file, chans, rate) {
  const n = chans[0].length, ch = chans.length;
  const data = Buffer.alloc(n * ch * 2);
  let o = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      let v = Math.max(-1, Math.min(1, chans[c][i]));
      data.writeInt16LE(Math.round(v * 32767), o); o += 2;
    }
  }
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8);
  hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20);
  hdr.writeUInt16LE(ch, 22); hdr.writeUInt32LE(rate, 24);
  hdr.writeUInt32LE(rate * ch * 2, 28); hdr.writeUInt16LE(ch * 2, 32);
  hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([hdr, data]));
}

/* ------------------------------------------------------------------ */
/* Radix-2 FFT, in place, on separate re/im arrays.                    */
/* ------------------------------------------------------------------ */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

/* magma-ish ramp: black -> purple -> orange -> white */
function colormap(v) {
  v = Math.max(0, Math.min(1, v));
  const stops = [
    [0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129],
    [181, 54, 122], [229, 80, 100], [251, 135, 97], [254, 194, 135], [252, 253, 191],
  ];
  const f = v * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  const t = f - i;
  return [
    Math.round(stops[i][0] + (stops[i + 1][0] - stops[i][0]) * t),
    Math.round(stops[i][1] + (stops[i + 1][1] - stops[i][1]) * t),
    Math.round(stops[i][2] + (stops[i + 1][2] - stops[i][2]) * t),
  ];
}

const WIN = 2048, HOP = 512;

function spectrogram(mono, rate, file, width, height) {
  const frames = Math.max(1, Math.floor((mono.length - WIN) / HOP));
  const bins = WIN / 2;
  const hann = new Float32Array(WIN);
  for (let i = 0; i < WIN; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (WIN - 1));

  // magnitudes[frame][bin], computed once then resampled into the image
  const mags = new Float32Array(frames * bins);
  const re = new Float64Array(WIN), im = new Float64Array(WIN);
  const centroid = new Float32Array(frames);
  const rolloff = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const off = f * HOP;
    for (let i = 0; i < WIN; i++) { re[i] = mono[off + i] * hann[i]; im[i] = 0; }
    fft(re, im);
    let wsum = 0, fsum = 0, total = 0;
    for (let b = 0; b < bins; b++) {
      const m = Math.sqrt(re[b] * re[b] + im[b] * im[b]) / (WIN / 2);
      mags[f * bins + b] = m;
      const hz = b * rate / WIN;
      wsum += m; fsum += m * hz; total += m;
    }
    centroid[f] = wsum > 1e-9 ? fsum / wsum : 0;
    let acc = 0, target = total * 0.85, r = 0;
    for (let b = 0; b < bins; b++) { acc += mags[f * bins + b]; if (acc >= target) { r = b * rate / WIN; break; } }
    rolloff[f] = r;
  }

  // log-frequency axis, 30 Hz .. min(16k, nyquist)
  const fMin = 30, fMax = Math.min(16000, rate / 2);
  const lMin = Math.log(fMin), lMax = Math.log(fMax);
  const rgb = Buffer.alloc(width * height * 3);
  const DB_FLOOR = -96;
  for (let x = 0; x < width; x++) {
    const f = Math.min(frames - 1, Math.floor(x * frames / width));
    const fNext = Math.min(frames, Math.max(f + 1, Math.floor((x + 1) * frames / width)));
    for (let y = 0; y < height; y++) {
      // y=0 is the top of the image = high frequency
      const hz0 = Math.exp(lMin + (lMax - lMin) * (height - 1 - y) / (height - 1));
      const hz1 = Math.exp(lMin + (lMax - lMin) * (height - y) / (height - 1));
      const b0 = Math.max(0, Math.min(bins - 1, Math.floor(hz0 * WIN / rate)));
      const b1 = Math.max(b0 + 1, Math.min(bins, Math.ceil(hz1 * WIN / rate)));
      let peak = 0;
      for (let ff = f; ff < fNext; ff++) {
        for (let b = b0; b < b1; b++) {
          const m = mags[ff * bins + b];
          if (m > peak) peak = m;
        }
      }
      const db = 20 * Math.log10(peak + 1e-12);
      const v = (db - DB_FLOOR) / (0 - DB_FLOOR);
      const c = colormap(v);
      const o = (y * width + x) * 3;
      rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2];
    }
  }
  // horizontal gridlines at decade-ish frequencies, dim grey
  for (const hz of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
    if (hz < fMin || hz > fMax) continue;
    const y = Math.round((height - 1) * (1 - (Math.log(hz) - lMin) / (lMax - lMin)));
    for (let x = 0; x < width; x += 6) {
      const o = (y * width + x) * 3;
      rgb[o] = Math.min(255, rgb[o] + 70);
      rgb[o + 1] = Math.min(255, rgb[o + 1] + 70);
      rgb[o + 2] = Math.min(255, rgb[o + 2] + 70);
    }
  }
  writePng(file, width, height, rgb);

  let cSum = 0, rSum = 0;
  for (let f = 0; f < frames; f++) { cSum += centroid[f]; rSum += rolloff[f]; }
  return {
    frames,
    meanCentroidHz: Math.round(cSum / frames),
    meanRolloff85Hz: Math.round(rSum / frames),
    centroidTrackHz: Array.from({ length: Math.min(24, frames) },
      (_, i) => Math.round(centroid[Math.floor(i * frames / Math.min(24, frames))])),
  };
}

function waveform(chans, rate, file, width, height) {
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) { rgb[i * 3] = 12; rgb[i * 3 + 1] = 14; rgb[i * 3 + 2] = 20; }
  const n = chans[0].length;
  const mid = height / 2;
  for (let x = 0; x < width; x++) {
    const a = Math.floor(x * n / width), b = Math.min(n, Math.floor((x + 1) * n / width));
    let lo = 0, hi = 0, sq = 0, cnt = 0;
    for (let i = a; i < b; i++) {
      let v = 0;
      for (let c = 0; c < chans.length; c++) v += chans[c][i];
      v /= chans.length;
      if (v < lo) lo = v; if (v > hi) hi = v;
      sq += v * v; cnt++;
    }
    const rms = cnt ? Math.sqrt(sq / cnt) : 0;
    const y0 = Math.max(0, Math.min(height - 1, Math.round(mid - hi * mid)));
    const y1 = Math.max(0, Math.min(height - 1, Math.round(mid - lo * mid)));
    for (let y = y0; y <= y1; y++) {
      const o = (y * width + x) * 3;
      rgb[o] = 90; rgb[o + 1] = 190; rgb[o + 2] = 235;
    }
    const r0 = Math.max(0, Math.min(height - 1, Math.round(mid - rms * mid)));
    const r1 = Math.max(0, Math.min(height - 1, Math.round(mid + rms * mid)));
    for (let y = r0; y <= r1; y++) {
      const o = (y * width + x) * 3;
      rgb[o] = 250; rgb[o + 1] = 210; rgb[o + 2] = 120;
    }
  }
  // 0 dBFS ceiling markers
  for (let x = 0; x < width; x += 4) {
    for (const y of [0, height - 1]) {
      const o = (y * width + x) * 3;
      rgb[o] = 220; rgb[o + 1] = 60; rgb[o + 2] = 60;
    }
  }
  writePng(file, width, height, rgb);
}

function stats(chans, rate) {
  const n = chans[0].length;
  let peak = 0, sq = 0, dc = 0, clipped = 0;
  for (let c = 0; c < chans.length; c++) {
    const d = chans[c];
    for (let i = 0; i < n; i++) {
      const v = d[i], a = Math.abs(v);
      if (a > peak) peak = a;
      if (a >= 0.999) clipped++;
      sq += v * v; dc += v;
    }
  }
  const total = n * chans.length;
  const rms = Math.sqrt(sq / total);
  // per-second RMS, to show whether anything develops over time
  const perSec = [];
  const step = Math.floor(rate);
  for (let s = 0; s + step <= n; s += step) {
    let q = 0;
    for (let c = 0; c < chans.length; c++)
      for (let i = s; i < s + step; i++) q += chans[c][i] * chans[c][i];
    perSec.push(+(20 * Math.log10(Math.sqrt(q / (step * chans.length)) + 1e-12)).toFixed(1));
  }
  let silent = 0;
  const w = Math.floor(rate / 20);
  for (let s = 0; s + w <= n; s += w) {
    let q = 0;
    for (let i = s; i < s + w; i++) q += chans[0][i] * chans[0][i];
    if (Math.sqrt(q / w) < 0.0005) silent++;
  }
  let width = 0;
  if (chans.length > 1) {
    let d = 0;
    for (let i = 0; i < n; i++) { const s2 = chans[0][i] - chans[1][i]; d += s2 * s2; }
    width = Math.sqrt(d / n);
  }
  return {
    seconds: +(n / rate).toFixed(2),
    peak: +peak.toFixed(4),
    peakDbfs: +(20 * Math.log10(peak + 1e-12)).toFixed(2),
    rms: +rms.toFixed(5),
    rmsDbfs: +(20 * Math.log10(rms + 1e-12)).toFixed(2),
    crestDb: +(20 * Math.log10((peak + 1e-12) / (rms + 1e-12))).toFixed(2),
    clippedSamples: clipped,
    dcOffset: +(dc / total).toFixed(6),
    silentFraction: +(silent / Math.max(1, Math.floor(n / w))).toFixed(3),
    stereoWidthRms: +width.toFixed(4),
    rmsDbfsPerSecond: perSec,
  };
}

/* ------------------------------------------------------------------ */
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.ZC_CHROME || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
           '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const has = await page.evaluate(() =>
    !!(window.ZC && window.ZC.Audio && typeof window.ZC.Audio.__renderOffline === 'function'));
  if (!has) {
    console.error('ZC.Audio.__renderOffline is not available — cannot render. ' +
                  'The audio module must expose it (see PROGRESS.md / the audio brief).');
    await browser.close();
    process.exit(2);
  }

  const report = { url, seconds, consoleErrors: [], scenarios: {} };

  for (const scenario of scenarios) {
    let res;
    try {
      res = await page.evaluate(async ({ scenario, seconds }) => {
        const buf = await window.ZC.Audio.__renderOffline(seconds, { scenario });
        if (!buf) return { error: 'renderOffline returned null' };
        const chans = [];
        for (let c = 0; c < buf.numberOfChannels; c++) {
          chans.push(Array.from(buf.getChannelData(c)));
        }
        return { rate: buf.sampleRate, length: buf.length, chans };
      }, { scenario, seconds });
    } catch (e) {
      res = { error: String(e && e.message || e) };
    }
    if (res.error) {
      console.error(scenario, 'FAILED:', res.error);
      report.scenarios[scenario] = { error: res.error };
      continue;
    }
    const chans = res.chans.map(a => Float32Array.from(a));
    const rate = res.rate;
    const mono = new Float32Array(chans[0].length);
    for (let i = 0; i < mono.length; i++) {
      let v = 0;
      for (let c = 0; c < chans.length; c++) v += chans[c][i];
      mono[i] = v / chans.length;
    }
    const base = path.join(outDir, scenario);
    writeWav(base + '.wav', chans, rate);
    const spec = spectrogram(mono, rate, base + '.spectrogram.png', 1400, 700);
    waveform(chans, rate, base + '.waveform.png', 1400, 280);
    const st = stats(chans, rate);
    report.scenarios[scenario] = Object.assign({ sampleRate: rate, channels: chans.length }, st, spec);
    console.log(scenario, JSON.stringify(report.scenarios[scenario]));
  }

  report.consoleErrors = consoleErrors;
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
