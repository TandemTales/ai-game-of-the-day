/* Cinderwick renderer: procedural foundry art on a 2D canvas.
 * Classic script. Exposes CW.Render = { init, reset, update, fx, draw }.
 * All textures are baked once per tile size into offscreen canvases; the per-frame
 * work is blits, a handful of paths and additive glow sprites. */
(function (root) {
  'use strict';
  var CW = root.CW = root.CW || {};
  var TAU = Math.PI * 2;
  var MAXP = 400;

  // ---------------------------------------------------------------- helpers
  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  function rngFor(seed) {
    if (CW.makeRng) return CW.makeRng(seed);
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rr(x, px, py, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    x.beginPath(); x.moveTo(px + r, py);
    x.lineTo(px + w - r, py); x.quadraticCurveTo(px + w, py, px + w, py + r);
    x.lineTo(px + w, py + h - r); x.quadraticCurveTo(px + w, py + h, px + w - r, py + h);
    x.lineTo(px + r, py + h); x.quadraticCurveTo(px, py + h, px, py + h - r);
    x.lineTo(px, py + r); x.quadraticCurveTo(px, py, px + r, py);
    x.closePath();
  }
  function rivet(x, cx, cy, r) {
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.beginPath(); x.arc(cx + r * 0.3, cy + r * 0.45, r * 1.05, 0, TAU); x.fill();
    var g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#d8c4ac'); g.addColorStop(0.5, '#75665a'); g.addColorStop(1, '#2c2420');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  }
  function hazard(x, rx, ry, rw, rh, stripe) {
    x.save(); x.beginPath(); x.rect(rx, ry, rw, rh); x.clip();
    x.fillStyle = '#f0b723'; x.fillRect(rx, ry, rw, rh);
    x.fillStyle = '#1b1411';
    for (var sx = -rh * 2; sx < rw + rh * 2; sx += stripe * 2) {
      x.beginPath(); x.moveTo(rx + sx, ry + rh); x.lineTo(rx + sx + stripe, ry + rh);
      x.lineTo(rx + sx + stripe + rh, ry); x.lineTo(rx + sx + rh, ry); x.closePath(); x.fill();
    }
    x.restore();
  }

  // ---------------------------------------------------------------- state
  var R = {
    canvas: null, ctx: null, ok: false,
    S: 0, dpr: 0, A: null,           // size-dependent assets
    G: {},                            // glow sprites
    parts: [], lights: [], decals: [], cur: 0,
    flash: 0, flashCol: '#ffd9a0',
    lastG: null, walk: 0, acc: {}, flip: {}, celebrate: 0, t: 0,
    cache: {}, lm: null, lmx: null
  };

  // ---------------------------------------------------------------- sprites (size independent)
  function bakeGlow(name, r, g, b) {
    var c = mk(64, 64), x = c.getContext('2d');
    var gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
    gr.addColorStop(0.22, 'rgba(' + r + ',' + g + ',' + b + ',0.62)');
    gr.addColorStop(0.55, 'rgba(' + r + ',' + g + ',' + b + ',0.2)');
    gr.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    R.G[name] = c;
  }
  function bakeSoft(name, stops) {
    var c = mk(64, 64), x = c.getContext('2d');
    var gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (var i = 0; i < stops.length; i++) gr.addColorStop(stops[i][0], stops[i][1]);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    R.G[name] = c;
  }
  function bakeArm(name, outer, vertical) {
    var L = 96, Hh = 96, c = mk(vertical ? Hh : L, vertical ? L : Hh), x = c.getContext('2d');
    var gr = vertical ? x.createLinearGradient(0, 0, c.width, 0) : x.createLinearGradient(0, 0, 0, c.height);
    if (outer) {
      gr.addColorStop(0, 'rgba(255,40,0,0)'); gr.addColorStop(0.16, 'rgba(255,60,10,0.5)');
      gr.addColorStop(0.34, 'rgba(255,130,30,0.95)'); gr.addColorStop(0.5, 'rgba(255,190,60,1)');
      gr.addColorStop(0.66, 'rgba(255,130,30,0.95)'); gr.addColorStop(0.84, 'rgba(255,60,10,0.5)');
      gr.addColorStop(1, 'rgba(255,40,0,0)');
    } else {
      gr.addColorStop(0.18, 'rgba(255,220,110,0)'); gr.addColorStop(0.36, 'rgba(255,215,100,0.9)');
      gr.addColorStop(0.5, 'rgba(255,255,235,1)'); gr.addColorStop(0.64, 'rgba(255,215,100,0.9)');
      gr.addColorStop(0.82, 'rgba(255,220,110,0)');
    }
    x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
    R.G[name] = c;
  }
  function bakeSprites() {
    bakeGlow('warm', 255, 150, 55); bakeGlow('hot', 255, 226, 140); bakeGlow('white', 255, 255, 240);
    bakeGlow('red', 255, 55, 35); bakeGlow('teal', 70, 232, 205); bakeGlow('gold', 255, 205, 80);
    bakeGlow('blue', 150, 175, 255);
    bakeSoft('smoke', [[0, 'rgba(58,48,44,0.9)'], [0.5, 'rgba(42,34,32,0.45)'], [1, 'rgba(30,24,22,0)']]);
    bakeSoft('dust', [[0, 'rgba(176,150,120,0.8)'], [0.5, 'rgba(140,118,96,0.35)'], [1, 'rgba(120,100,80,0)']]);
    bakeSoft('scorch', [[0, 'rgba(8,4,3,0.85)'], [0.45, 'rgba(14,7,5,0.5)'], [0.8, 'rgba(14,7,5,0.12)'], [1, 'rgba(14,7,5,0)']]);
    bakeSoft('shade', [[0, 'rgba(0,0,0,0.5)'], [0.7, 'rgba(0,0,0,0.2)'], [1, 'rgba(0,0,0,0)']]);
    bakeArm('armOH', true, false); bakeArm('armIH', false, false);
    bakeArm('armOV', true, true); bakeArm('armIV', false, true);
    R.lm = mk(CW.W * 5, CW.H * 5); R.lmx = R.lm.getContext('2d');
  }

  // ---------------------------------------------------------------- size dependent bake
  function bakeFloor(S, v, rng) {
    var c = mk(S, S), x = c.getContext('2d'), odd = v & 1, i;
    var g = x.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, odd ? '#45352d' : '#4b3932'); g.addColorStop(1, odd ? '#33261f' : '#382a24');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (i = 0; i < 3; i++) {
      var bx = rng() * S, by = rng() * S, br = S * (0.3 + rng() * 0.35);
      var bg = x.createRadialGradient(bx, by, 0, bx, by, br);
      bg.addColorStop(0, 'rgba(0,0,0,0.2)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = bg; x.fillRect(0, 0, S, S);
    }
    if (v >= 2) { // diamond tread
      x.strokeStyle = 'rgba(255,214,170,0.075)'; x.lineWidth = Math.max(1, S * 0.035); x.lineCap = 'round';
      for (var r = 0; r < 4; r++) for (var q = 0; q < 4; q++) {
        var cx = (q + 0.5) * S / 4, cy = (r + 0.5) * S / 4, a = ((r + q) & 1) ? 0.75 : -0.75, d = S * 0.065;
        x.beginPath(); x.moveTo(cx - Math.cos(a) * d, cy - Math.sin(a) * d); x.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); x.stroke();
      }
    }
    var dot = Math.max(1, S / 32);
    for (i = 0; i < S * 0.9; i++) {
      x.fillStyle = rng() < 0.55 ? 'rgba(0,0,0,0.2)' : 'rgba(255,225,190,0.07)';
      x.fillRect(rng() * S, rng() * S, dot, dot);
    }
    x.strokeStyle = 'rgba(255,225,190,0.07)'; x.lineWidth = Math.max(1, S * 0.015);
    for (i = 0; i < 3; i++) {
      var sx = rng() * S, sy = rng() * S, an = rng() * Math.PI;
      x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(an) * S * 0.3, sy + Math.sin(an) * S * 0.3); x.stroke();
    }
    var lw = Math.max(1, S * 0.04);
    x.strokeStyle = 'rgba(255,225,190,0.15)'; x.lineWidth = lw;
    x.beginPath(); x.moveTo(lw * 1.5, S - lw * 1.5); x.lineTo(lw * 1.5, lw * 1.5); x.lineTo(S - lw * 1.5, lw * 1.5); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.32)';
    x.beginPath(); x.moveTo(S - lw * 1.5, lw * 1.5); x.lineTo(S - lw * 1.5, S - lw * 1.5); x.lineTo(lw * 1.5, S - lw * 1.5); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.7)'; x.lineWidth = lw * 0.9; x.strokeRect(lw * 0.45, lw * 0.45, S - lw * 0.9, S - lw * 0.9);
    var ri = S * 0.15, rad = Math.max(1, S * 0.038);
    rivet(x, ri, ri, rad); rivet(x, S - ri, ri, rad); rivet(x, ri, S - ri, rad); rivet(x, S - ri, S - ri, rad);
    return c;
  }

  function bakeWall(S, kind, rng) { // kind 0 pillar, 1 edge horizontal, 2 edge vertical
    var c = mk(S, S), x = c.getContext('2d'), i;
    var fh = Math.round(S * 0.8), lip = S - fh, lw = Math.max(1, S * 0.04);
    var g = x.createLinearGradient(0, 0, 0, fh);
    if (kind === 0) { g.addColorStop(0, '#8d7866'); g.addColorStop(1, '#5f4e46'); }
    else { g.addColorStop(0, '#5e4d46'); g.addColorStop(1, '#3d312d'); }
    x.fillStyle = g; x.fillRect(0, 0, S, fh);
    for (i = 0; i < fh; i += 2) { x.fillStyle = (i & 2) ? 'rgba(255,240,220,0.035)' : 'rgba(0,0,0,0.04)'; x.fillRect(0, i, S, 1); }
    var dot = Math.max(1, S / 34);
    for (i = 0; i < S * 0.8; i++) { x.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.2)' : 'rgba(255,235,210,0.08)'; x.fillRect(rng() * S, rng() * fh, dot, dot); }
    var q = S * 0.12, pw = S - q * 2, ph = fh - q * 2;
    if (kind === 0) {
      var pg = x.createLinearGradient(0, q, 0, q + ph);
      pg.addColorStop(0, '#6d5a4e'); pg.addColorStop(1, '#85705f');
      x.fillStyle = pg; rr(x, q, q, pw, ph, S * 0.06); x.fill();
      x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = lw; x.stroke();
      x.strokeStyle = 'rgba(255,235,210,0.22)'; x.lineWidth = Math.max(1, lw * 0.7);
      x.beginPath(); x.moveTo(q + S * 0.04, q + ph - S * 0.05); x.lineTo(q + S * 0.04, q + S * 0.04); x.lineTo(q + pw - S * 0.05, q + S * 0.04); x.stroke();
      // ember stain bottom
      var eg = x.createRadialGradient(S / 2, fh, 0, S / 2, fh, S * 0.6);
      eg.addColorStop(0, 'rgba(255,120,40,0.2)'); eg.addColorStop(1, 'rgba(255,120,40,0)');
      x.fillStyle = eg; x.fillRect(0, 0, S, fh);
      var rp = q + S * 0.1, rrad = Math.max(1, S * 0.05);
      // grime streaks
      x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = Math.max(1, S * 0.03);
      x.beginPath(); x.moveTo(rp, rp + rrad); x.lineTo(rp + S * 0.01, rp + S * 0.28); x.moveTo(S - rp, rp + rrad); x.lineTo(S - rp - S * 0.01, rp + S * 0.2); x.stroke();
      rivet(x, rp, rp, rrad); rivet(x, S - rp, rp, rrad); rivet(x, rp, fh - rp, rrad); rivet(x, S - rp, fh - rp, rrad);
      // glyph: small cross-hair vent
      x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = Math.max(1, S * 0.03);
      for (i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(S * 0.36, fh / 2 + i * S * 0.07); x.lineTo(S * 0.64, fh / 2 + i * S * 0.07); x.stroke(); }
    } else {
      var hz = S * 0.2;
      if (kind === 1) hazard(x, 0, fh / 2 - hz / 2, S, hz, hz * 0.8); else {
        x.save(); x.translate(S / 2 + hz / 2, 0); x.rotate(Math.PI / 2); x.scale(1, -1); x.restore();
        hazard(x, S / 2 - hz / 2, 0, hz, fh, hz * 0.8);
      }
      x.fillStyle = 'rgba(0,0,0,0.25)';
      if (kind === 1) { x.fillRect(0, fh / 2 + hz / 2, S, S * 0.04); } else { x.fillRect(S / 2 + hz / 2, 0, S * 0.04, fh); }
      var er = S * 0.14, erad = Math.max(1, S * 0.042);
      rivet(x, er, er, erad); rivet(x, S - er, er, erad); rivet(x, er, fh - er, erad); rivet(x, S - er, fh - er, erad);
      x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, 0, S, fh);
    }
    // bevel
    x.strokeStyle = 'rgba(255,240,215,0.5)'; x.lineWidth = lw;
    x.beginPath(); x.moveTo(lw / 2, fh - lw / 2); x.lineTo(lw / 2, lw / 2); x.lineTo(S - lw / 2, lw / 2); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.5)';
    x.beginPath(); x.moveTo(S - lw / 2, lw / 2); x.lineTo(S - lw / 2, fh - lw / 2); x.stroke();
    // front lip
    var lg = x.createLinearGradient(0, fh, 0, S);
    lg.addColorStop(0, '#4e3d35'); lg.addColorStop(1, '#1f1713');
    x.fillStyle = lg; x.fillRect(0, fh, S, lip);
    x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(0, fh, S, Math.max(1, lw * 0.7));
    x.fillStyle = 'rgba(255,200,150,0.12)'; x.fillRect(0, fh + Math.max(1, lw * 0.7), S, Math.max(1, lw * 0.5));
    for (i = 1; i < 4; i++) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(S * i / 4, fh, Math.max(1, lw * 0.5), lip); }
    x.strokeStyle = 'rgba(0,0,0,0.65)'; x.lineWidth = Math.max(1, lw * 0.6); x.strokeRect(0, 0, S, S);
    return c;
  }

  function bakeCrate(S, v, pad, rng) {
    var T = S + pad * 2, c = mk(T, T), x = c.getContext('2d'), i;
    var ins = Math.max(1, S * 0.05), bw = S - ins * 2, bh = S - ins * 2;
    var X0 = pad + ins, Y0 = pad + ins, th = Math.round(bh * 0.78), fh = bh - th;
    var lw = Math.max(1, S * 0.04);
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.65)'; x.shadowBlur = S * 0.16; x.shadowOffsetY = S * 0.07; x.shadowOffsetX = S * 0.03;
    x.fillStyle = '#4a2b12'; rr(x, X0, Y0, bw, bh, S * 0.05); x.fill();
    x.restore();
    // top planks
    var np = 4, pw = bw / np, cols = ['#c98238', '#b97532', '#d08c40', '#b06b2d'];
    for (i = 0; i < np; i++) {
      var g = x.createLinearGradient(0, Y0, 0, Y0 + th);
      var cc = cols[(i + v) % 4];
      g.addColorStop(0, cc); g.addColorStop(1, '#8a5122');
      x.fillStyle = g; x.fillRect(X0 + i * pw, Y0, pw, th);
      x.strokeStyle = 'rgba(70,32,8,0.3)'; x.lineWidth = Math.max(1, S * 0.015);
      for (var k = 0; k < 3; k++) {
        var gx = X0 + i * pw + pw * (0.2 + rng() * 0.6);
        x.beginPath(); x.moveTo(gx, Y0 + th * 0.05); x.quadraticCurveTo(gx + (rng() - 0.5) * pw * 0.4, Y0 + th * 0.5, gx, Y0 + th * 0.95); x.stroke();
      }
      x.fillStyle = 'rgba(40,18,4,0.7)'; x.fillRect(X0 + i * pw, Y0, Math.max(1, S * 0.02), th);
    }
    // knot
    x.fillStyle = 'rgba(60,28,6,0.5)'; x.beginPath(); x.ellipse(X0 + bw * (0.2 + rng() * 0.6), Y0 + th * (0.25 + rng() * 0.5), S * 0.04, S * 0.06, 0, 0, TAU); x.fill();
    // front face
    var fg = x.createLinearGradient(0, Y0 + th, 0, Y0 + bh);
    fg.addColorStop(0, '#7b4620'); fg.addColorStop(1, '#4b2a12');
    x.fillStyle = fg; x.fillRect(X0, Y0 + th, bw, fh);
    for (i = 1; i < np; i++) { x.fillStyle = 'rgba(30,14,4,0.7)'; x.fillRect(X0 + i * pw, Y0 + th, Math.max(1, S * 0.02), fh); }
    // iron
    var bandW = S * 0.1;
    function band(bx, by, w, h) {
      var bg = (w > h) ? x.createLinearGradient(0, by, 0, by + h) : x.createLinearGradient(bx, 0, bx + w, 0);
      bg.addColorStop(0, '#7f8791'); bg.addColorStop(0.5, '#59606a'); bg.addColorStop(1, '#2f343c');
      x.fillStyle = bg; x.fillRect(bx, by, w, h);
      x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = Math.max(1, S * 0.015); x.strokeRect(bx, by, w, h);
    }
    if (v === 0) { // X brace
      x.save(); x.beginPath(); x.rect(X0, Y0, bw, th); x.clip();
      x.strokeStyle = '#2f343c'; x.lineWidth = bandW * 1.1; x.lineCap = 'butt';
      x.beginPath(); x.moveTo(X0, Y0); x.lineTo(X0 + bw, Y0 + th); x.moveTo(X0 + bw, Y0); x.lineTo(X0, Y0 + th); x.stroke();
      x.strokeStyle = '#6a727c'; x.lineWidth = bandW * 0.65;
      x.beginPath(); x.moveTo(X0, Y0); x.lineTo(X0 + bw, Y0 + th); x.moveTo(X0 + bw, Y0); x.lineTo(X0, Y0 + th); x.stroke();
      x.restore();
    } else if (v === 1) {
      band(X0 + bw * 0.2 - bandW / 2, Y0, bandW, th); band(X0 + bw * 0.8 - bandW / 2, Y0, bandW, th);
    } else {
      band(X0, Y0 + th * 0.5 - bandW / 2, bw, bandW);
      x.save(); rr(x, X0 + bw * 0.3, Y0 + th * 0.22, bw * 0.4, th * 0.56, S * 0.04); x.clip();
      hazard(x, X0 + bw * 0.3, Y0 + th * 0.22, bw * 0.4, th * 0.56, S * 0.09); x.restore();
      x.strokeStyle = 'rgba(0,0,0,0.7)'; x.lineWidth = Math.max(1, S * 0.025); rr(x, X0 + bw * 0.3, Y0 + th * 0.22, bw * 0.4, th * 0.56, S * 0.04); x.stroke();
    }
    // frame
    band(X0, Y0, bw, bandW * 0.85); band(X0, Y0 + th - bandW * 0.85, bw, bandW * 0.85);
    band(X0, Y0, bandW * 0.85, th); band(X0 + bw - bandW * 0.85, Y0, bandW * 0.85, th);
    var rv = Math.max(1, S * 0.03), o = bandW * 0.42;
    rivet(x, X0 + o, Y0 + o, rv); rivet(x, X0 + bw - o, Y0 + o, rv); rivet(x, X0 + o, Y0 + th - o, rv); rivet(x, X0 + bw - o, Y0 + th - o, rv);
    if (v !== 0) hazard(x, X0, Y0 + th + Math.max(1, fh * 0.2), bw, Math.max(2, fh * 0.6), Math.max(2, S * 0.07));
    // bevel + outline
    x.strokeStyle = 'rgba(255,230,180,0.5)'; x.lineWidth = lw * 0.8;
    x.beginPath(); x.moveTo(X0 + lw / 2, Y0 + th); x.lineTo(X0 + lw / 2, Y0 + lw / 2); x.lineTo(X0 + bw, Y0 + lw / 2); x.stroke();
    x.strokeStyle = 'rgba(25,12,4,0.9)'; x.lineWidth = Math.max(1, lw * 0.8); rr(x, X0, Y0, bw, bh, S * 0.05); x.stroke();
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(X0, Y0 + th, bw, Math.max(1, S * 0.02));
    return c;
  }

  function bakeBomb(S, dormant) {
    var B = Math.round(S * 1.3), c = mk(B, B), x = c.getContext('2d');
    var cx = B / 2, cy = B * 0.6, Rb = S * 0.36, lw = Math.max(1, S * 0.045);
    var g = x.createRadialGradient(cx - Rb * 0.38, cy - Rb * 0.42, Rb * 0.05, cx, cy, Rb * 1.1);
    if (dormant) { g.addColorStop(0, '#6d8590'); g.addColorStop(0.3, '#3b4b55'); g.addColorStop(0.75, '#182229'); g.addColorStop(1, '#090e12'); }
    else { g.addColorStop(0, '#8a8d9b'); g.addColorStop(0.28, '#4d505d'); g.addColorStop(0.72, '#1d1e26'); g.addColorStop(1, '#09090d'); }
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, Rb, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(8,4,3,0.95)'; x.lineWidth = lw; x.stroke();
    // bounce light
    x.strokeStyle = dormant ? 'rgba(70,214,193,0.4)' : 'rgba(255,140,50,0.55)'; x.lineWidth = lw * 0.9;
    x.beginPath(); x.arc(cx, cy, Rb - lw * 0.9, 0.15, 1.35); x.stroke();
    // belt
    x.strokeStyle = dormant ? '#2d8a85' : '#c18a38'; x.lineWidth = Math.max(1, S * 0.05);
    x.beginPath(); x.ellipse(cx, cy + Rb * 0.18, Rb * 0.98, Rb * 0.3, 0, 0.12, Math.PI - 0.12); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = Math.max(1, S * 0.015);
    x.beginPath(); x.ellipse(cx, cy + Rb * 0.18 + S * 0.03, Rb * 0.98, Rb * 0.3, 0, 0.12, Math.PI - 0.12); x.stroke();
    // specular
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.ellipse(cx - Rb * 0.38, cy - Rb * 0.45, Rb * 0.2, Rb * 0.12, -0.7, 0, TAU); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.8)'; x.beginPath(); x.arc(cx - Rb * 0.5, cy - Rb * 0.32, Math.max(1, S * 0.02), 0, TAU); x.fill();
    if (dormant) {
      x.fillStyle = 'rgba(10,40,50,0.28)'; x.beginPath(); x.arc(cx, cy, Rb, 0, TAU); x.fill();
      var pg = x.createLinearGradient(0, cy - Rb - S * 0.1, 0, cy - Rb + S * 0.05);
      pg.addColorStop(0, '#8f979e'); pg.addColorStop(1, '#3c444c');
      x.fillStyle = pg; rr(x, cx - S * 0.13, cy - Rb - S * 0.07, S * 0.26, S * 0.12, S * 0.04); x.fill();
      x.strokeStyle = 'rgba(0,0,0,0.85)'; x.lineWidth = Math.max(1, S * 0.03); x.stroke();
      x.fillStyle = '#58f0da'; x.beginPath(); x.arc(cx, cy - Rb - S * 0.01, S * 0.04, 0, TAU); x.fill();
    } else {
      var cg = x.createLinearGradient(cx - S * 0.1, 0, cx + S * 0.1, 0);
      cg.addColorStop(0, '#f1cf7d'); cg.addColorStop(0.5, '#c18a38'); cg.addColorStop(1, '#6a4716');
      x.fillStyle = cg; rr(x, cx - S * 0.09, cy - Rb - S * 0.08, S * 0.18, S * 0.12, S * 0.03); x.fill();
      x.strokeStyle = 'rgba(0,0,0,0.85)'; x.lineWidth = Math.max(1, S * 0.03); x.stroke();
      // wick
      x.lineCap = 'round';
      x.strokeStyle = '#2a1a10'; x.lineWidth = Math.max(2, S * 0.07);
      x.beginPath(); x.moveTo(cx, cy - Rb - S * 0.06); x.quadraticCurveTo(cx + S * 0.02, cy - Rb - S * 0.2, cx + S * 0.15, cy - Rb - S * 0.2 + 0); x.stroke();
      x.strokeStyle = '#d6bb85'; x.lineWidth = Math.max(1, S * 0.045);
      x.beginPath(); x.moveTo(cx, cy - Rb - S * 0.06); x.quadraticCurveTo(cx + S * 0.02, cy - Rb - S * 0.2, cx + S * 0.15, cy - Rb - S * 0.2); x.stroke();
      x.setLineDash([Math.max(1, S * 0.03), Math.max(1, S * 0.03)]); x.strokeStyle = '#7a5a30'; x.lineWidth = Math.max(1, S * 0.045);
      x.beginPath(); x.moveTo(cx, cy - Rb - S * 0.06); x.quadraticCurveTo(cx + S * 0.02, cy - Rb - S * 0.2, cx + S * 0.15, cy - Rb - S * 0.2); x.stroke();
      x.setLineDash([]);
    }
    return { c: c, B: B, cx: cx, cy: cy, Rb: Rb };
  }

  function bakeAssets(S, dpr) {
    var Wd = CW.W, Hd = CW.H, A = { S: S, dpr: dpr }, i, x, y;
    var rng = rngFor(1234);
    var pad = Math.round(S * 0.5);
    A.pad = pad; A.cpad = Math.round(S * 0.18);
    A.floor = []; for (i = 0; i < 4; i++) A.floor.push(bakeFloor(S, i, rng));
    A.wall = bakeWall(S, 0, rng); A.edgeH = bakeWall(S, 1, rng); A.edgeV = bakeWall(S, 2, rng);
    A.crate = []; for (i = 0; i < 3; i++) A.crate.push(bakeCrate(S, i, A.cpad, rng));
    A.bomb = bakeBomb(S, false); A.dorm = bakeBomb(S, true);
    // arena (floors, walls, AO, cracks)
    var ac = mk(Wd * S + pad * 2, Hd * S + pad * 2), a = ac.getContext('2d');
    var cc = mk(Wd * S + pad * 2, Hd * S + pad * 2), k = cc.getContext('2d');
    a.save(); a.shadowColor = 'rgba(0,0,0,0.9)'; a.shadowBlur = pad * 0.9; a.fillStyle = '#000';
    a.fillRect(pad, pad, Wd * S, Hd * S); a.restore();
    function isWall(tx, ty) { return tx < 0 || ty < 0 || tx >= Wd || ty >= Hd || tx === 0 || ty === 0 || tx === Wd - 1 || ty === Hd - 1 || (tx % 2 === 0 && ty % 2 === 0); }
    var crng = rngFor(777);
    for (y = 0; y < Hd; y++) for (x = 0; x < Wd; x++) {
      var px = pad + x * S, py = pad + y * S;
      if (isWall(x, y)) {
        var edge = (x === 0 || y === 0 || x === Wd - 1 || y === Hd - 1);
        a.drawImage(!edge ? A.wall : (y === 0 || y === Hd - 1 ? A.edgeH : A.edgeV), px, py);
        continue;
      }
      a.drawImage(A.floor[((x + y) & 1) | (((x * 7 + y * 3) % 5 < 2) ? 2 : 0)], px, py);
      // ambient occlusion from walls above / left
      var ag;
      if (isWall(x, y - 1)) {
        ag = a.createLinearGradient(0, py, 0, py + S * 0.42);
        ag.addColorStop(0, 'rgba(0,0,0,0.7)'); ag.addColorStop(1, 'rgba(0,0,0,0)');
        a.fillStyle = ag; a.fillRect(px, py, S, S * 0.42);
      }
      if (isWall(x - 1, y)) {
        ag = a.createLinearGradient(px, 0, px + S * 0.3, 0);
        ag.addColorStop(0, 'rgba(0,0,0,0.5)'); ag.addColorStop(1, 'rgba(0,0,0,0)');
        a.fillStyle = ag; a.fillRect(px, py, S * 0.3, S);
      }
      if (isWall(x + 1, y)) {
        ag = a.createLinearGradient(px + S, 0, px + S * 0.78, 0);
        ag.addColorStop(0, 'rgba(0,0,0,0.3)'); ag.addColorStop(1, 'rgba(0,0,0,0)');
        a.fillStyle = ag; a.fillRect(px + S * 0.7, py, S * 0.3, S);
      }
      // lava crack
      if (crng() < 0.3) {
        var e1 = Math.floor(crng() * 4), e2 = (e1 + 1 + Math.floor(crng() * 3)) % 4;
        var ep = function (e) { return e === 0 ? [0.5, 0] : e === 1 ? [1, 0.5] : e === 2 ? [0.5, 1] : [0, 0.5]; };
        var p1 = ep(e1), p2 = ep(e2), pts = [p1], n = 3 + Math.floor(crng() * 2);
        for (i = 1; i <= n; i++) {
          var f = i / (n + 1);
          pts.push([p1[0] + (p2[0] - p1[0]) * f + (crng() - 0.5) * 0.28, p1[1] + (p2[1] - p1[1]) * f + (crng() - 0.5) * 0.28]);
        }
        pts.push(p2);
        var stroke = function (ctx, w, col) {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
          for (var j = 0; j < pts.length; j++) { var X = px + pts[j][0] * S, Y = py + pts[j][1] * S; if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
          ctx.stroke();
        };
        stroke(a, Math.max(1.5, S * 0.07), 'rgba(0,0,0,0.75)');
        stroke(k, Math.max(3, S * 0.2), 'rgba(255,70,10,0.18)');
        stroke(k, Math.max(2, S * 0.1), 'rgba(255,110,25,0.5)');
        stroke(k, Math.max(1, S * 0.045), 'rgba(255,200,90,0.95)');
      }
    }
    A.arena = ac; A.crack = cc;
    return A;
  }

  function ensure(S, dpr) {
    if (R.A && R.A.S === S && R.A.dpr === dpr) return;
    R.A = bakeAssets(S, dpr);
    R.cache = {};
  }

  // ---------------------------------------------------------------- particles
  function P(o) {
    if (R.parts.length >= MAXP) {
      if (!o.prio) return;
      R.parts[(R.cur++) % MAXP] = o; return;
    }
    R.parts.push(o);
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function glowP(x, y, z, vx, vy, vz, life, r, spr, a, g, prio) {
    P({ k: 'glow', x: x, y: y, z: z, vx: vx, vy: vy, vz: vz, t: 0, life: life, r: r, a: a, spr: spr, g: g, drag: 1.2, fl: Math.random() * 6, prio: prio });
  }
  function smokeP(x, y, z, r, life, a, spr) {
    P({ k: 'smoke', x: x, y: y, z: z, vx: rnd(-0.3, 0.3), vy: rnd(-0.2, 0.2), vz: rnd(0.4, 1.0), t: 0, life: life, r: r, a: a, spr: spr || 'smoke', g: 0, drag: 0.8, grow: 1.6 });
  }
  function streakP(x, y, z, ang, sp, life, col, g, prio) {
    P({ k: 'streak', x: x, y: y, z: z, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.7, vz: rnd(1, 4), t: 0, life: life, col: col, a: 1, g: g, drag: 0.6, prio: prio });
  }
  function ringP(x, y, r0, r1, life, col, lw, a) {
    P({ k: 'ring', x: x, y: y, z: 0, r: r0, r1: r1, t: 0, life: life, col: col, lw: lw, a: a, prio: true });
  }
  function lightP(x, y, r, life, a, spr) { R.lights.push({ x: x, y: y, r: r, t: 0, life: life, a: a, spr: spr || 'warm' }); if (R.lights.length > 24) R.lights.shift(); }
  function chunkP(x, y) {
    var cols = ['#c98238', '#a8662c', '#6b3c18', '#59606a', '#e0a050'];
    P({ k: 'chunk', x: x, y: y, z: 0.2, vx: rnd(-2.6, 2.6), vy: rnd(-1.6, 1.6), vz: rnd(2.5, 5.5), t: 0, life: rnd(0.8, 1.3), r: rnd(0.06, 0.13), a: 1,
      g: 14, drag: 0.2, rot: rnd(0, TAU), vr: rnd(-12, 12), col: cols[Math.floor(Math.random() * cols.length)], prio: true });
  }
  function burst(x, y, n, spr, sp, up, life, r) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, s = rnd(sp * 0.3, sp);
      glowP(x, y, 0.2, Math.cos(a) * s, Math.sin(a) * s * 0.7, rnd(up * 0.3, up), rnd(life * 0.6, life), rnd(r * 0.6, r), spr, 1, 5, true);
    }
  }
  function sparks(x, y, n, col, sp) {
    for (var i = 0; i < n; i++) streakP(x, y, 0.2, Math.random() * TAU, rnd(sp * 0.4, sp), rnd(0.25, 0.6), col, 7, true);
  }

  function fx(e) {
    if (!e || !R.ok) return;
    try {
      var t = e.type, cx = (e.x || 0) + 0.5, cy = (e.y || 0) + 0.5, n, i, g = R.lastG, p;
      switch (t) {
        case 'place':
          for (i = 0; i < 3; i++) smokeP(cx + rnd(-0.2, 0.2), cy + 0.2, 0.05, rnd(0.18, 0.3), rnd(0.5, 0.9), 0.5, 'dust');
          sparks(cx, cy + 0.1, 6, '#ffd890', 3);
          ringP(cx, cy + 0.25, 0.1, 0.8, 0.35, '#cdb08a', 0.06, 0.55);
          break;
        case 'cord':
          sparks(cx, cy, 10, '#ffe7a0', 4);
          ringP(cx, cy, 0.1, 1.1, 0.4, '#ffcf70', 0.06, 0.7);
          lightP(cx, cy, 1.8, 0.35, 0.5, 'gold');
          break;
        case 'explode':
          n = Math.min(e.chain || 1, 8);
          ringP(cx, cy, 0.2, 1.6 + n * 0.3, 0.5, '#ffe2a8', 0.1, 0.95);
          ringP(cx, cy, 0.1, 1.0 + n * 0.22, 0.35, '#ff8a2a', 0.14, 0.85);
          if (R.decals.length > 30) R.decals.shift();
          R.decals.push({ x: cx, y: cy, t: 0, life: 7, r: 1.3 + Math.random() * 0.3 });
          lightP(cx, cy, 4.2 + n * 0.25, 0.55, 0.85, 'warm');
          lightP(cx, cy, 2.6, 0.22, 1, 'white');
          R.flash = Math.max(R.flash, 0.1 + 0.022 * n); R.flashCol = '#ffcf90';
          sparks(cx, cy, 14 + n * 3, '#ffe9a0', 9);
          burst(cx, cy, 10 + n * 3, 'hot', 4.2, 5, 1.5, 0.12);
          burst(cx, cy, 6 + n, 'warm', 3.2, 3.5, 1.2, 0.16);
          for (i = 0; i < 3 + (n >> 1); i++) smokeP(cx + rnd(-0.6, 0.6), cy + rnd(-0.6, 0.6), 0.2, rnd(0.35, 0.6), rnd(1.1, 1.9), 0.6);
          break;
        case 'crate':
          for (i = 0; i < 9; i++) chunkP(cx, cy);
          for (i = 0; i < 3; i++) smokeP(cx + rnd(-0.3, 0.3), cy + rnd(-0.3, 0.3), 0.2, rnd(0.25, 0.4), rnd(0.7, 1.2), 0.55, 'dust');
          burst(cx, cy, 6, 'warm', 2.5, 3, 1, 0.09);
          break;
        case 'kill':
          cx = e.x; cy = e.y;
          ringP(cx, cy, 0.1, 1.3, 0.45, '#ffb04a', 0.09, 0.9);
          burst(cx, cy, 16, 'hot', 3.5, 4, 1.2, 0.1); sparks(cx, cy, 10, '#ff9b3a', 6);
          for (i = 0; i < 3; i++) smokeP(cx + rnd(-0.2, 0.2), cy + rnd(-0.2, 0.2), 0.2, 0.3, 1.2, 0.6);
          glowP(cx, cy, 0.3, 0, 0, 1.2, 1.1, 0.22, 'white', 0.8, -0.5, true);
          lightP(cx, cy, 2.2, 0.35, 0.6, 'warm');
          break;
        case 'pickup':
          var spr = e.kind === 'bomb' ? 'blue' : e.kind === 'speed' ? 'teal' : 'warm';
          ringP(cx, cy, 0.1, 1.2, 0.45, e.kind === 'bomb' ? '#aac0ff' : e.kind === 'speed' ? '#46d6c1' : '#ffa040', 0.07, 0.9);
          burst(cx, cy, 16, spr, 3, 4, 0.9, 0.1); burst(cx, cy, 8, 'white', 2, 3, 0.7, 0.07);
          lightP(cx, cy, 2.2, 0.4, 0.6, spr);
          break;
        case 'death':
          cx = e.x; cy = e.y;
          ringP(cx, cy, 0.2, 2.8, 0.7, '#ff5a3a', 0.14, 1);
          ringP(cx, cy, 0.1, 1.6, 0.45, '#ffffff', 0.1, 1);
          burst(cx, cy, 26, 'warm', 5, 5, 1.6, 0.14); sparks(cx, cy, 18, '#ffffff', 8);
          for (i = 0; i < 6; i++) smokeP(cx + rnd(-0.3, 0.3), cy + rnd(-0.3, 0.3), 0.3, rnd(0.3, 0.5), rnd(1.2, 2), 0.65);
          R.flash = Math.max(R.flash, 0.36); R.flashCol = '#ffffff';
          lightP(cx, cy, 4, 0.5, 1, 'red');
          break;
        case 'win':
          p = g && g.player; R.celebrate = 2.6;
          if (p) { ringP(p.x, p.y, 0.2, 3.5, 0.8, '#46d6c1', 0.14, 1); ringP(p.x, p.y, 0.2, 2.2, 0.6, '#ffd36b', 0.1, 1); lightP(p.x, p.y, 5, 0.8, 0.9, 'teal'); }
          R.flash = Math.max(R.flash, 0.3); R.flashCol = '#c8fff4';
          break;
        case 'strike':
          sparks(cx, cy, 14, '#ffffff', 6);
          ringP(cx, cy, 0.1, 1.0, 0.3, '#ffffff', 0.07, 0.9);
          R.flash = Math.max(R.flash, 0.06); R.flashCol = '#fff2d0';
          lightP(cx, cy, 2.6, 0.2, 0.8, 'white');
          break;
        case 'spark':
          sparks(cx, cy, 9, '#ffe7a0', 5);
          ringP(cx, cy, 0.1, 0.9, 0.3, '#ffcf70', 0.06, 0.8);
          lightP(cx, cy, 2, 0.2, 0.7, 'hot');
          break;
        case 'exit':
          ringP(cx, cy, 0.2, 2.2, 0.6, '#46d6c1', 0.1, 0.95);
          burst(cx, cy, 18, 'teal', 3, 4, 1.2, 0.1);
          lightP(cx, cy, 3.2, 0.7, 0.8, 'teal');
          break;
        case 'respawn':
          ringP(1.5, 1.5, 0.1, 1.8, 0.6, '#46d6c1', 0.1, 0.9); ringP(1.5, 1.5, 0.1, 1.1, 0.4, '#ffffff', 0.07, 0.9);
          burst(1.5, 1.5, 14, 'teal', 2.5, 3.5, 1, 0.09);
          lightP(1.5, 1.5, 3, 0.6, 0.8, 'teal');
          break;
        case 'hurry':
          R.flash = Math.max(R.flash, 0.2); R.flashCol = '#ff2a1a';
          break;
        case 'level':
          R.parts.length = 0; R.lights.length = 0; R.decals.length = 0; R.celebrate = 0; R.flip = {};
          break;
      }
    } catch (err) { /* never break the game for an effect */ }
  }

  function emitAmbient(dt, g) {
    var A = R.acc, i, r;
    function tick(key, rate) { A[key] = (A[key] || 0) + dt * rate; var n = Math.floor(A[key]); A[key] -= n; return Math.min(n, 4); }
    var W = CW.W, H = CW.H, room = R.parts.length < MAXP * 0.7;
    if (!g) return;
    if (room) for (i = tick('amb', 5); i > 0; i--) glowP(rnd(1, W - 1), rnd(1, H - 1), 0.05, rnd(-0.12, 0.12), rnd(-0.1, 0.1), rnd(0.2, 0.5), rnd(2.5, 4.5), rnd(0.03, 0.06), 'warm', 0.5, -0.05, false);
    var bombs = g.bombs || [];
    for (var bi = 0; bi < bombs.length; bi++) {
      var b = bombs[bi];
      if (b.dormant || !room) continue;
      for (i = tick('w' + bi, 22); i > 0; i--) {
        glowP(b.x + 0.65, b.y + 0.12, 0.2, rnd(-1, 1.6), rnd(-1, 0.4), rnd(0.8, 2.2), rnd(0.25, 0.55), rnd(0.035, 0.07), Math.random() < 0.4 ? 'white' : 'hot', 1, 6, false);
      }
    }
    var sp = g.sparks || [];
    for (var si = 0; si < sp.length; si++) {
      var c = sp[si], pos = sparkPos(c);
      if (!pos) continue;
      for (i = tick('s' + si, 70); i > 0; i--) {
        var a = Math.random() * TAU, s = rnd(1.5, 4.5);
        streakP(pos.x, pos.y, 0.15, a, s, rnd(0.15, 0.4), Math.random() < 0.5 ? '#fff3c0' : '#ffb84a', 8, false);
      }
      if (room && Math.random() < dt * 30) smokeP(pos.x, pos.y, 0.1, 0.12, 0.7, 0.3);
    }
    if (g.exit && g.exit.revealed && g.exitOpen && room) {
      for (i = tick('ex', 14); i > 0; i--) glowP(g.exit.x + rnd(0.2, 0.8), g.exit.y + rnd(0.3, 0.8), 0.05, rnd(-0.1, 0.1), rnd(-0.05, 0.05), rnd(0.8, 1.6), rnd(0.8, 1.4), rnd(0.04, 0.08), 'teal', 0.9, -0.2, false);
    }
    var fl = g.flames || [];
    if (room && fl.length) {
      var cnt = tick('fl', Math.min(60, fl.length * 2.2));
      for (i = 0; i < cnt; i++) { var f = fl[Math.floor(Math.random() * fl.length)]; glowP(f.x + rnd(0.2, 0.8), f.y + rnd(0.2, 0.8), 0.2, rnd(-0.2, 0.2), rnd(-0.1, 0.1), rnd(1.2, 2.6), rnd(0.5, 0.9), rnd(0.05, 0.1), Math.random() < 0.5 ? 'hot' : 'warm', 1, -0.5, false); }
    }
    var cr = g.critters || [];
    if (room) for (i = 0; i < cr.length; i++) {
      var q = cr[i];
      if (q.alive && Math.random() < dt * (q.kind === 'chaser' ? 5 : 2.5)) glowP(q.x + rnd(-0.2, 0.2), q.y + rnd(-0.1, 0.1), 0.2, rnd(-0.1, 0.1), 0, rnd(0.4, 0.9), rnd(0.6, 1.0), rnd(0.03, 0.06), 'warm', 0.9, -0.1, false);
    }
    var pl = g.player;
    if (pl && pl.alive && pl.moving && room && Math.random() < dt * 9) smokeP(pl.x - (pl.fx || 0) * 0.2, pl.y + 0.3, 0.02, 0.1, 0.45, 0.28, 'dust');
    if (R.celebrate > 0 && pl) {
      R.celebrate -= dt;
      for (i = tick('cel', 70); i > 0; i--) streakP(pl.x, pl.y, 0.5, Math.random() * TAU, rnd(1, 4), rnd(0.8, 1.4), Math.random() < 0.5 ? '#ffd36b' : '#46d6c1', 7, true);
    }
  }

  function update(dt) {
    if (!R.ok) return;
    try {
      dt = clamp(dt || 0, 0, 0.05);
      var g = R.lastG, i, p;
      if (g && g.player && g.player.moving && g.player.alive) R.walk += dt * 13;
      R.flash = Math.max(0, R.flash - dt * 2.8);
      for (i = R.parts.length - 1; i >= 0; i--) {
        p = R.parts[i]; p.t += dt;
        if (p.t >= p.life) { R.parts[i] = R.parts[R.parts.length - 1]; R.parts.pop(); continue; }
        if (p.k === 'ring') continue;
        var dr = Math.max(0, 1 - (p.drag || 0) * dt);
        p.vx *= dr; p.vy *= dr; p.x += p.vx * dt; p.y += p.vy * dt;
        p.vz -= (p.g || 0) * dt; p.z += p.vz * dt;
        if (p.k === 'chunk') { p.rot += p.vr * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.35; p.vx *= 0.6; p.vy *= 0.6; p.vr *= 0.6; } }
        else if (p.z < 0) p.z = 0;
      }
      for (i = R.lights.length - 1; i >= 0; i--) { R.lights[i].t += dt; if (R.lights[i].t >= R.lights[i].life) R.lights.splice(i, 1); }
      for (i = R.decals.length - 1; i >= 0; i--) { R.decals[i].t += dt; if (R.decals[i].t >= R.decals[i].life) R.decals.splice(i, 1); }
      emitAmbient(dt, g);
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- cords
  function sparkPos(c) {
    if (!c || !c.path || !c.path.length) return null;
    var pts = c.path, n = pts.length, d = clamp((c.t || 0) * (CW.Sim ? CW.Sim.SPARK_SPEED : 11), 0, n - 1);
    var i0 = Math.floor(d), f = d - i0;
    var a = c.from === 'b' ? pts[n - 1 - i0] : pts[i0];
    var b = c.from === 'b' ? pts[Math.max(0, n - 2 - i0)] : pts[Math.min(n - 1, i0 + 1)];
    return { x: a.x + 0.5 + (b.x - a.x) * f, y: a.y + 0.5 + (b.y - a.y) * f, d: d, i0: i0, f: f };
  }

  function roundedPath(ctx, pts, ox, oy, ts, rad) {
    var n = pts.length, i;
    if (!n) return;
    ctx.beginPath(); ctx.moveTo(ox + pts[0].x * ts, oy + pts[0].y * ts);
    for (i = 1; i < n - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      ctx.arcTo(ox + a.x * ts, oy + a.y * ts, ox + (a.x + b.x) * 0.5 * ts, oy + (a.y + b.y) * 0.5 * ts, rad);
    }
    if (n > 1) ctx.lineTo(ox + pts[n - 1].x * ts, oy + pts[n - 1].y * ts);
  }
  function ropeStroke(ctx, pts, ox, oy, ts) {
    if (pts.length < 2) return;
    var rad = ts * 0.34;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save(); ctx.translate(ts * 0.02, ts * 0.06);
    roundedPath(ctx, pts, ox, oy, ts, rad); ctx.strokeStyle = 'rgba(0,0,0,0.42)'; ctx.lineWidth = ts * 0.15; ctx.stroke();
    ctx.restore();
    roundedPath(ctx, pts, ox, oy, ts, rad); ctx.strokeStyle = '#4e3520'; ctx.lineWidth = ts * 0.15; ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.setLineDash([ts * 0.06, ts * 0.06]); ctx.lineDashOffset = 0;
    roundedPath(ctx, pts, ox, oy, ts, rad); ctx.strokeStyle = '#c9a76a'; ctx.lineWidth = ts * 0.12; ctx.stroke();
    ctx.lineDashOffset = ts * 0.06;
    roundedPath(ctx, pts, ox, oy, ts, rad); ctx.strokeStyle = '#8a6a3c'; ctx.lineWidth = ts * 0.12; ctx.stroke();
    ctx.setLineDash([ts * 0.06, ts * 0.06]); ctx.lineDashOffset = 0;
    ctx.save(); ctx.translate(-ts * 0.015, -ts * 0.025);
    roundedPath(ctx, pts, ox, oy, ts, rad); ctx.strokeStyle = 'rgba(255,238,190,0.55)'; ctx.lineWidth = ts * 0.035; ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]); ctx.lineCap = 'round';
  }

  function drawCords(ctx, g, ox, oy, ts, t) {
    var cords = g.cords || [], i, j, c;
    for (i = 0; i < cords.length; i++) {
      c = cords[i];
      if (!c || !c.path || c.path.length < 2) continue;
      var pts = [];
      for (j = 0; j < c.path.length; j++) pts.push({ x: c.path[j].x + 0.5, y: c.path[j].y + 0.5 });
      if (!c.burning) { ropeStroke(ctx, pts, ox, oy, ts); continue; }
      if (c.from === 'b') pts.reverse();
      var sp = sparkPos(c); if (!sp) continue;
      var burnt = pts.slice(0, sp.i0 + 1), rest = pts.slice(sp.i0 + 1);
      burnt.push({ x: sp.x, y: sp.y }); rest.unshift({ x: sp.x, y: sp.y });
      ropeStroke(ctx, rest, ox, oy, ts);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      roundedPath(ctx, burnt, ox, oy, ts, ts * 0.34); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = ts * 0.12; ctx.stroke();
      roundedPath(ctx, burnt, ox, oy, ts, ts * 0.34); ctx.strokeStyle = '#1e140f'; ctx.lineWidth = ts * 0.085; ctx.stroke();
    }
  }
  function drawCordGlow(ctx, g, ox, oy, ts, t) {
    var sps = g.sparks || [], i, j;
    for (i = 0; i < sps.length; i++) {
      var c = sps[i], sp = sparkPos(c); if (!sp) continue;
      var pts = c.path, n = pts.length;
      // glowing embers along the burnt stretch, fading away from the spark
      for (j = 0; j <= sp.i0; j++) {
        var pj = c.from === 'b' ? pts[n - 1 - j] : pts[j];
        var age = sp.d - j, al = clamp(1 - age / 3.2, 0, 1);
        if (al <= 0) continue;
        var fl = 0.7 + 0.3 * Math.sin(t * 24 + j * 2.1);
        ctx.globalAlpha = al * 0.7 * fl;
        var sz = ts * 0.75;
        ctx.drawImage(R.G.warm, ox + (pj.x + 0.5) * ts - sz / 2, oy + (pj.y + 0.5) * ts - sz / 2, sz, sz);
      }
      var X = ox + sp.x * ts, Y = oy + sp.y * ts, fk = 0.8 + 0.2 * Math.sin(t * 60 + i);
      ctx.globalAlpha = 0.9 * fk; var s1 = ts * 2.1;
      ctx.drawImage(R.G.warm, X - s1 / 2, Y - s1 / 2, s1, s1);
      ctx.globalAlpha = 1; var s2 = ts * 1.0;
      ctx.drawImage(R.G.hot, X - s2 / 2, Y - s2 / 2, s2, s2);
      var s3 = ts * 0.42; ctx.drawImage(R.G.white, X - s3 / 2, Y - s3 / 2, s3, s3);
      // flare cross
      ctx.strokeStyle = 'rgba(255,245,200,0.9)'; ctx.lineWidth = Math.max(1, ts * 0.04); ctx.lineCap = 'round';
      var ang = t * 18 + i, L = ts * (0.3 + 0.12 * Math.sin(t * 40));
      ctx.beginPath();
      ctx.moveTo(X - Math.cos(ang) * L, Y - Math.sin(ang) * L); ctx.lineTo(X + Math.cos(ang) * L, Y + Math.sin(ang) * L);
      ctx.moveTo(X - Math.cos(ang + 1.57) * L * 0.8, Y - Math.sin(ang + 1.57) * L * 0.8); ctx.lineTo(X + Math.cos(ang + 1.57) * L * 0.8, Y + Math.sin(ang + 1.57) * L * 0.8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- bombs
  function bombPhase(b) { var u = clamp(3 - b.fuse, 0, 3.2); return 6 * u + 3 * u * u; }
  function drawBomb(ctx, b, ox, oy, ts, t) {
    var A = R.A, sp = b.dormant ? A.dorm : A.bomb, k = ts / A.S;
    var cx = ox + (b.x + 0.5) * ts, by = oy + (b.y + 0.97) * ts;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(cx + ts * 0.03, by - ts * 0.04, ts * 0.34, ts * 0.12, 0, 0, TAU); ctx.fill();
    var s = 1, sq = 1;
    if (!b.dormant) { var ph = bombPhase(b); s = 1 + 0.07 * Math.sin(ph); sq = 1 - 0.05 * Math.sin(ph); }
    else s = 1 + 0.02 * Math.sin(t * 2 + b.x);
    var appear = clamp((b.age || 0) / 0.18, 0, 1); var pop = 1 + (1 - appear) * 0.35 * Math.sin(appear * Math.PI);
    ctx.save();
    ctx.translate(cx, by - ts * 0.04); ctx.scale(s * pop * sq, s * pop / sq);
    // sprite body centre sits at (cx, cy) in its canvas; anchor body base
    var bw = sp.B * k, bodyBaseY = (sp.cy + sp.Rb) * k;
    ctx.drawImage(sp.c, -bw / 2, -bodyBaseY, bw, bw);
    ctx.restore();
  }
  function drawBombGlow(ctx, b, ox, oy, ts, t) {
    var cx = ox + (b.x + 0.5) * ts, cyb = oy + (b.y + 0.6) * ts;
    if (b.dormant) {
      var pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + b.x * 1.3);
      var gs = ts * 1.5; ctx.globalAlpha = 0.18 + 0.1 * pulse; ctx.drawImage(R.G.teal, cx - gs / 2, cyb - gs / 2, gs, gs);
      ctx.globalAlpha = 0.5 + 0.35 * pulse; ctx.strokeStyle = '#46d6c1'; ctx.lineWidth = Math.max(1, ts * 0.045);
      ctx.beginPath(); ctx.ellipse(cx, oy + (b.y + 0.92) * ts, ts * (0.42 + 0.04 * pulse), ts * 0.15 * (1 + 0.1 * pulse), 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.8; var s2 = ts * 0.3; ctx.drawImage(R.G.teal, cx - s2 / 2, oy + (b.y + 0.2) * ts - s2 / 2, s2, s2);
      ctx.globalAlpha = 1; return;
    }
    var ph = bombPhase(b), danger = clamp((1.6 - b.fuse) / 1.6, 0, 1), beat = 0.5 + 0.5 * Math.sin(ph);
    var s = 1 + 0.07 * Math.sin(ph);
    var gs2 = ts * (1.8 + danger * 0.9); ctx.globalAlpha = (0.25 + 0.35 * danger) * (0.6 + 0.4 * beat);
    ctx.drawImage(R.G.red, cx - gs2 / 2, cyb - gs2 / 2, gs2, gs2);
    ctx.globalAlpha = 0.18 + 0.1 * beat; var gw = ts * 2.2; ctx.drawImage(R.G.warm, cx - gw / 2, cyb - gw / 2, gw, gw);
    if (danger > 0) { // body heats up
      ctx.globalAlpha = danger * beat * 0.65; var hs = ts * 0.95; ctx.drawImage(R.G.red, cx - hs / 2, cyb - hs / 2, hs, hs);
    }
    // wick spark
    var tx = cx + ts * 0.15 * s, ty = oy + (b.y + 0.12 - (s - 1) * 0.3) * ts, fk = 0.75 + 0.25 * Math.sin(t * 47 + b.x * 3 + b.y);
    ctx.globalAlpha = fk; var w1 = ts * 0.95; ctx.drawImage(R.G.warm, tx - w1 / 2, ty - w1 / 2, w1, w1);
    ctx.globalAlpha = 1; var w2 = ts * 0.5; ctx.drawImage(R.G.hot, tx - w2 / 2, ty - w2 / 2, w2, w2);
    var w3 = ts * 0.2; ctx.drawImage(R.G.white, tx - w3 / 2, ty - w3 / 2, w3, w3);
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- pickups / exit
  var PK = { range: ['#ff7a2a', '#ffd36b'], bomb: ['#b8c6ff', '#ffffff'], speed: ['#46d6c1', '#c9fff6'] };
  function drawPickup(ctx, k, ox, oy, ts, t) {
    var cx = ox + (k.x + 0.5) * ts, cy = oy + (k.y + 0.55) * ts, age = k.age || 0;
    var sc = age < 0.3 ? 1 + 0.5 * Math.sin(clamp(age / 0.3, 0, 1) * Math.PI) * (1 - age / 0.3) + (clamp(age / 0.3, 0, 1) - 1) * 0.6 : 1;
    sc = clamp(sc, 0.2, 1.4);
    var bob = Math.sin(t * 3.2 + k.x * 1.7 + k.y) * 0.05;
    var col = PK[k.kind] || PK.range;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.32 - bob * 1.5) + ')'; ctx.beginPath();
    ctx.ellipse(cx, cy + ts * 0.3, ts * (0.28 - bob * 0.6) * sc, ts * 0.09 * sc, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(cx, cy + (bob - 0.06) * ts); ctx.scale(ts * sc, ts * sc);
    // octagonal badge
    ctx.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * TAU / 8 + TAU / 16, r = 0.33; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    var bg = ctx.createLinearGradient(0, -0.33, 0, 0.33); bg.addColorStop(0, '#f1cf7d'); bg.addColorStop(0.5, '#b8812f'); bg.addColorStop(1, '#6a4716');
    ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = '#1b0f0b'; ctx.lineWidth = 0.05; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath();
    for (i = 0; i < 8; i++) { var a2 = i * TAU / 8 + TAU / 16, r2 = 0.255; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a2) * r2, Math.sin(a2) * r2); }
    ctx.closePath();
    var ig = ctx.createRadialGradient(0, -0.05, 0.02, 0, 0, 0.27); ig.addColorStop(0, '#2d2220'); ig.addColorStop(1, '#120b0a');
    ctx.fillStyle = ig; ctx.fill(); ctx.strokeStyle = col[0]; ctx.lineWidth = 0.025; ctx.stroke();
    // icon
    if (k.kind === 'range') {
      ctx.fillStyle = col[0]; ctx.beginPath(); ctx.moveTo(0, -0.2); ctx.bezierCurveTo(0.18, -0.06, 0.17, 0.12, 0, 0.18);
      ctx.bezierCurveTo(-0.17, 0.12, -0.16, -0.02, -0.04, -0.1); ctx.bezierCurveTo(-0.04, -0.03, 0.01, 0, 0, -0.2); ctx.fill();
      ctx.fillStyle = col[1]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(0.09, 0.05, 0.08, 0.14, 0, 0.16); ctx.bezierCurveTo(-0.08, 0.14, -0.07, 0.06, 0, 0); ctx.fill();
    } else if (k.kind === 'bomb') {
      ctx.fillStyle = '#d6dcff'; ctx.beginPath(); ctx.arc(-0.01, 0.04, 0.12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4b4f66'; ctx.beginPath(); ctx.arc(0.02, 0.06, 0.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0.05, -0.07); ctx.quadraticCurveTo(0.1, -0.15, 0.14, -0.13); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(-0.19, -0.185, 0.1, 0.025); ctx.fillRect(-0.155, -0.222, 0.025, 0.1);
    } else {
      ctx.fillStyle = col[0]; ctx.beginPath(); ctx.moveTo(0.05, -0.2); ctx.lineTo(-0.1, 0.03); ctx.lineTo(-0.01, 0.03); ctx.lineTo(-0.05, 0.2); ctx.lineTo(0.11, -0.04); ctx.lineTo(0.02, -0.04); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col[1]; ctx.beginPath(); ctx.moveTo(0.04, -0.14); ctx.lineTo(-0.04, 0.0); ctx.lineTo(0.03, 0.0); ctx.lineTo(0.0, 0.1); ctx.lineTo(0.07, -0.04); ctx.lineTo(0.01, -0.04); ctx.closePath(); ctx.fill();
    }
    // shine sweep
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(-0.1, -0.2, 0.1, 0.035, -0.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawExit(ctx, g, ox, oy, ts, t) {
    var e = g.exit, open = !!g.exitOpen, x0 = ox + e.x * ts, y0 = oy + e.y * ts, ins = ts * 0.08;
    ctx.save();
    ctx.fillStyle = '#0a0605'; rr(ctx, x0 + ins, y0 + ins, ts - ins * 2, ts - ins * 2, ts * 0.12); ctx.fill();
    if (open) {
      ctx.save(); rr(ctx, x0 + ins, y0 + ins, ts - ins * 2, ts - ins * 2, ts * 0.12); ctx.clip();
      var cx = x0 + ts / 2, cy = y0 + ts / 2;
      var pg = ctx.createRadialGradient(cx, cy, 0, cx, cy, ts * 0.55);
      pg.addColorStop(0, '#d8fff8'); pg.addColorStop(0.35, '#46d6c1'); pg.addColorStop(0.8, '#0d5c5a'); pg.addColorStop(1, '#06201f');
      ctx.fillStyle = pg; ctx.fillRect(x0, y0, ts, ts);
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (var i = 0; i < 4; i++) {
        var a0 = t * (1.6 + i * 0.35) * (i & 1 ? -1 : 1) + i * 1.7, rad = ts * (0.12 + i * 0.07);
        ctx.strokeStyle = 'rgba(190,255,245,' + (0.75 - i * 0.12) + ')'; ctx.lineWidth = Math.max(1, ts * 0.04);
        ctx.beginPath(); ctx.arc(cx, cy, rad, a0, a0 + 2.2); ctx.stroke();
      }
      ctx.restore();
    } else {
      var lamp = 0.5 + 0.5 * Math.sin(t * 4);
      ctx.fillStyle = '#251612'; ctx.fillRect(x0 + ins, y0 + ins, ts - ins * 2, ts - ins * 2);
      for (var b = 0; b < 4; b++) {
        var bx = x0 + ts * (0.24 + b * 0.173);
        var bgr = ctx.createLinearGradient(bx - ts * 0.04, 0, bx + ts * 0.04, 0); bgr.addColorStop(0, '#8a929c'); bgr.addColorStop(0.5, '#555c66'); bgr.addColorStop(1, '#25292f');
        ctx.fillStyle = bgr; ctx.fillRect(bx - ts * 0.04, y0 + ins, ts * 0.08, ts - ins * 2);
      }
      ctx.fillStyle = 'rgba(255,60,40,' + (0.4 + lamp * 0.5) + ')'; ctx.beginPath(); ctx.arc(x0 + ts * 0.84, y0 + ts * 0.16, ts * 0.05, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = '#1b0f0b'; ctx.lineWidth = Math.max(1, ts * 0.05); rr(ctx, x0 + ins, y0 + ins, ts - ins * 2, ts - ins * 2, ts * 0.12); ctx.stroke();
    ctx.strokeStyle = open ? '#7ff3e2' : '#7a8088'; ctx.lineWidth = Math.max(1, ts * 0.035);
    rr(ctx, x0 + ins * 0.8, y0 + ins * 0.8, ts - ins * 1.6, ts - ins * 1.6, ts * 0.13); ctx.stroke();
  }

  // ---------------------------------------------------------------- characters
  var OUT = '#1b0f0b';
  function fillStroke(ctx, fill, lw) { ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw || 0.045; ctx.lineJoin = 'round'; ctx.stroke(); }

  function drawHero(ctx, g, p, t, ts, ox, oy) {
    var px = ox + p.x * ts, py = oy + p.y * ts, fx = p.fx || 0, fy = p.fy || 0;
    if (!fx && !fy) fy = 1;
    var up = fy < 0 && !fx, side = !!fx, down = !up && !side;
    var el = 0, dead = !p.alive;
    if (dead) { el = Math.max(0, 1.4 - (p.deadT || 0)); if (p.deadT <= 0) return; }
    var won = g.status === 'won';
    var moving = !!p.moving && !dead;
    var walk = R.walk, sw = Math.sin(walk), bob = moving ? -Math.abs(Math.cos(walk)) * 0.05 : -0.012 + 0.012 * Math.sin(t * 3);
    if (won) bob = -Math.abs(Math.sin(t * 8)) * 0.18;
    ctx.save();
    ctx.globalAlpha = 1;
    if (!dead && p.invuln > 0 && (Math.floor(t * 14) & 1)) ctx.globalAlpha = 0.35;
    var feetY = py + ts * 0.32;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,' + (dead ? 0.35 * (1 - el / 1.4) : 0.4) + ')'; ctx.beginPath(); ctx.ellipse(px, feetY, ts * 0.3, ts * 0.1, 0, 0, TAU); ctx.fill();
    ctx.translate(px, feetY);
    var rot = 0, sq = 1;
    if (dead) {
      var k1 = clamp(el / 0.5, 0, 1); rot = (fx >= 0 ? 1 : -1) * k1 * k1 * 1.45; sq = 1 - 0.3 * clamp(el / 0.7, 0, 1);
      if (el > 1.0) ctx.globalAlpha = clamp((1.4 - el) / 0.4, 0, 1);
      ctx.translate(0, -k1 * ts * 0.02);
    }
    ctx.rotate(rot); ctx.scale(ts, ts * sq);
    // legs
    var si, lift, bx;
    for (si = -1; si <= 1; si += 2) {
      var ph = moving ? Math.sin(walk + (si > 0 ? 0 : Math.PI)) : 0;
      lift = moving ? Math.max(0, ph) * 0.09 : 0;
      bx = side ? ph * 0.1 * (moving ? 1 : 0) + si * 0.025 : si * 0.095;
      if (won) lift = 0;
      ctx.beginPath(); rr(ctx, bx - 0.085, -0.115 - lift, 0.17, 0.115, 0.045); fillStroke(ctx, '#3d2519', 0.04);
      ctx.fillStyle = '#e8742a'; ctx.fillRect(bx - 0.075, -0.035 - lift, 0.15, 0.03);
    }
    // torso
    var ty0 = -0.46 + bob;
    ctx.beginPath(); rr(ctx, -0.2, ty0, 0.4, 0.34, 0.1);
    var tg = ctx.createLinearGradient(-0.2, 0, 0.2, 0); tg.addColorStop(0, '#2f86c4'); tg.addColorStop(0.55, '#2766a3'); tg.addColorStop(1, '#193f6e');
    fillStroke(ctx, tg, 0.045);
    if (!up) {
      ctx.fillStyle = '#ffb23a'; ctx.fillRect(-0.12, ty0 + 0.02, 0.05, 0.2); ctx.fillRect(0.07, ty0 + 0.02, 0.05, 0.2);
      ctx.fillStyle = 'rgba(240,236,214,0.85)'; ctx.fillRect(-0.19, ty0 + 0.14, 0.38, 0.03);
    } else {
      ctx.fillStyle = '#ffb23a'; ctx.fillRect(-0.12, ty0 + 0.02, 0.05, 0.22); ctx.fillRect(0.07, ty0 + 0.02, 0.05, 0.22);
      ctx.fillStyle = 'rgba(240,236,214,0.85)'; ctx.fillRect(-0.19, ty0 + 0.14, 0.38, 0.03);
      ctx.fillStyle = '#5a3a22'; rr(ctx, -0.1, ty0 + 0.03, 0.2, 0.15, 0.04); ctx.fill(); // backpack
    }
    // belt + tools
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(-0.2, ty0 + 0.255, 0.4, 0.06); ctx.strokeStyle = OUT; ctx.lineWidth = 0.03; ctx.strokeRect(-0.2, ty0 + 0.255, 0.4, 0.06);
    if (down) { ctx.fillStyle = '#e1b25a'; ctx.fillRect(-0.04, ty0 + 0.25, 0.08, 0.07); }
    var tdir = side ? -fx : 1;
    ctx.save(); ctx.translate(0.2 * tdir, ty0 + 0.31); ctx.rotate(0.25 * tdir);
    ctx.fillStyle = '#8a929c'; ctx.fillRect(-0.025, 0, 0.05, 0.14); ctx.fillStyle = '#d95a2a'; ctx.beginPath(); ctx.arc(0, 0.15, 0.04, 0, TAU); ctx.fill(); ctx.restore();
    // arms
    var asw = moving ? sw * 0.07 : 0;
    var armUp = won ? -0.28 : 0;
    for (si = -1; si <= 1; si += 2) {
      var ax = side ? (si > 0 ? 0.0 : -0.02) : si * 0.245, ay = ty0 + 0.22 + armUp + (side ? asw * si : asw * si * 0.5);
      if (side && si < 0) continue;
      ctx.beginPath(); ctx.arc(ax, ay, 0.07, 0, TAU); fillStroke(ctx, '#ff9a2e', 0.04);
      if (!side) { ctx.strokeStyle = '#2766a3'; ctx.lineWidth = 0.08; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(si * 0.19, ty0 + 0.08); ctx.lineTo(ax, ay - 0.04); ctx.stroke(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.02; }
    }
    // head
    var hy = -0.66 + bob + (moving ? 0 : 0), hr = 0.275, hx = side ? fx * 0.025 : 0;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU);
    if (!up) { fillStroke(ctx, '#f0c39a', 0.045); }
    // face details
    var gx = side ? fx * 0.1 : 0;
    if (up) {
      ctx.beginPath(); ctx.arc(hx, hy, hr + 0.015, 0, TAU);
      var hg = ctx.createRadialGradient(-0.08, hy - 0.1, 0.02, 0, hy, hr + 0.02); hg.addColorStop(0, '#fffaf0'); hg.addColorStop(1, '#cfc3a8');
      fillStroke(ctx, hg, 0.045);
      ctx.strokeStyle = '#2a1d16'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(hx - hr, hy + 0.06); ctx.lineTo(hx + hr, hy + 0.06); ctx.stroke();
      ctx.fillStyle = '#46d6c1'; ctx.fillRect(hx - 0.025, hy - hr, 0.05, 0.14);
    } else {
      // goggles strap
      ctx.fillStyle = '#2a1d16'; ctx.fillRect(hx - hr, hy + 0.02, hr * 2, 0.05);
      if (!side) {
        ctx.fillStyle = 'rgba(224,130,110,0.5)'; ctx.beginPath(); ctx.arc(-0.17, hy + 0.14, 0.04, 0, TAU); ctx.arc(0.17, hy + 0.14, 0.04, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#6a2c1c'; ctx.lineWidth = 0.025; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, hy + 0.15, 0.06, 0.25, Math.PI - 0.25); ctx.stroke();
        for (si = -1; si <= 1; si += 2) {
          ctx.beginPath(); ctx.arc(si * 0.11, hy + 0.045, 0.092, 0, TAU); fillStroke(ctx, '#c58a2e', 0.04);
          ctx.beginPath(); ctx.arc(si * 0.11, hy + 0.045, 0.062, 0, TAU); ctx.fillStyle = '#7fe9f0'; ctx.fill();
          ctx.fillStyle = '#17434d'; ctx.beginPath(); ctx.arc(si * 0.11 + 0.012, hy + 0.055, 0.03, 0, TAU); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(si * 0.11 - 0.022, hy + 0.02, 0.02, 0, TAU); ctx.fill();
        }
      } else {
        ctx.beginPath(); ctx.arc(gx + fx * 0.04, hy + 0.045, 0.1, 0, TAU); fillStroke(ctx, '#c58a2e', 0.04);
        ctx.beginPath(); ctx.arc(gx + fx * 0.04, hy + 0.045, 0.068, 0, TAU); ctx.fillStyle = '#7fe9f0'; ctx.fill();
        ctx.fillStyle = '#17434d'; ctx.beginPath(); ctx.arc(gx + fx * 0.06, hy + 0.055, 0.032, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx + fx * 0.04 - 0.02, hy + 0.02, 0.02, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#6a2c1c'; ctx.lineWidth = 0.025; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx + fx * 0.15, hy + 0.17); ctx.lineTo(hx + fx * 0.2, hy + 0.15); ctx.stroke();
      }
      // helmet dome
      ctx.beginPath(); ctx.arc(hx, hy - 0.02, hr + 0.025, Math.PI + 0.02, TAU - 0.02);
      ctx.quadraticCurveTo(hx, hy - 0.06, hx - hr - 0.025 + 0.0, hy - 0.02); ctx.closePath();
      var dg = ctx.createRadialGradient(hx - 0.08, hy - 0.2, 0.02, hx, hy - 0.05, hr + 0.04); dg.addColorStop(0, '#fffaf0'); dg.addColorStop(1, '#cfc3a8');
      fillStroke(ctx, dg, 0.045);
      ctx.fillStyle = '#46d6c1'; ctx.fillRect(hx - 0.022 + (side ? fx * 0.04 : 0), hy - hr - 0.02, 0.044, 0.15);
      var brx = side ? (fx > 0 ? hx - hr - 0.01 : hx - hr - 0.1) : hx - hr - 0.05, brw = side ? hr * 2 + 0.11 : hr * 2 + 0.1;
      ctx.beginPath(); rr(ctx, brx, hy - 0.045, brw, 0.06, 0.03); fillStroke(ctx, '#e6dcc2', 0.035);
      // lamp
      ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(hx + (side ? fx * 0.17 : 0), hy - 0.13, 0.04, 0, TAU); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 0.025; ctx.stroke();
    }
    // dizzy stars
    if (dead && el > 0.3) {
      for (var s = 0; s < 3; s++) {
        var sa = t * 7 + s * TAU / 3, sx = Math.cos(sa) * 0.28, sy = hy - 0.28 + Math.sin(sa) * 0.07;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(sa * 2); ctx.fillStyle = '#ffd36b'; ctx.beginPath();
        for (var q = 0; q < 8; q++) { var rd = q & 1 ? 0.03 : 0.07, an = q * Math.PI / 4; ctx[q ? 'lineTo' : 'moveTo'](Math.cos(an) * rd, Math.sin(an) * rd); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    ctx.restore();
  }

  function flipFor(c) {
    var f = R.flip[c.id];
    if (f === undefined) f = R.flip[c.id] = 1;
    if (c.dir && c.dir[0]) R.flip[c.id] = f = c.dir[0] < 0 ? -1 : 1;
    return f;
  }

  function drawSlug(ctx, c, t, ts, ox, oy) {
    var f = flipFor(c), ph = t * 6 + (c.id || 0) * 1.7, st = 1 + 0.1 * Math.sin(ph), sqz = 1 - 0.08 * Math.sin(ph);
    var vy = c.dir ? c.dir[1] : 0;
    ctx.save();
    if (c.stun > 0 && (Math.floor(t * 12) & 1)) ctx.globalAlpha = 0.55;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(ox + c.x * ts, oy + (c.y + 0.3) * ts, ts * 0.36, ts * 0.11, 0, 0, TAU); ctx.fill();
    ctx.translate(ox + c.x * ts, oy + (c.y + 0.3) * ts); ctx.scale(ts * f * st, ts * sqz);
    var blobs = [[-0.2, -0.13, 0.15], [-0.04, -0.17, 0.2], [0.17, -0.14, 0.17]];
    var i;
    ctx.fillStyle = OUT; ctx.strokeStyle = OUT; ctx.lineWidth = 0.1; ctx.lineJoin = 'round';
    for (i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(blobs[i][0], blobs[i][1], blobs[i][2], 0, TAU); ctx.fill(); ctx.stroke(); }
    // tail taper
    ctx.beginPath(); ctx.moveTo(-0.3, -0.04); ctx.lineTo(-0.38 - 0.03 * Math.sin(ph), -0.02); ctx.lineTo(-0.28, -0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    var cols = ['#d6461a', '#ef6a20', '#e5561c'];
    for (i = 0; i < 3; i++) { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(blobs[i][0], blobs[i][1], blobs[i][2], 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#d6461a'; ctx.beginPath(); ctx.moveTo(-0.3, -0.04); ctx.lineTo(-0.37 - 0.03 * Math.sin(ph), -0.02); ctx.lineTo(-0.28, -0.18); ctx.closePath(); ctx.fill();
    // belly glow
    ctx.fillStyle = '#ffb84a'; ctx.beginPath(); ctx.ellipse(0, -0.03, 0.34, 0.05, 0, 0, TAU); ctx.fill();
    // highlights
    ctx.fillStyle = '#ff9d42'; ctx.beginPath(); ctx.ellipse(-0.08, -0.26, 0.1, 0.05, -0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.ellipse(0.13, -0.24, 0.05, 0.03, -0.3, 0, TAU); ctx.fill();
    // crust plates
    ctx.fillStyle = '#4a2418';
    ctx.beginPath(); ctx.ellipse(-0.17, -0.22, 0.07, 0.045, 0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.0, -0.31, 0.06, 0.04, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-0.06, -0.12, 0.045, 0.03, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd36b';
    ctx.beginPath(); ctx.arc(-0.12, -0.09, 0.02, 0, TAU); ctx.arc(0.07, -0.1, 0.018, 0, TAU); ctx.fill();
    // eyes on stalks
    var ex = [0.12, 0.24], ey0 = -0.28, look = vy * 0.025;
    for (i = 0; i < 2; i++) {
      var wob = Math.sin(ph + i) * 0.015;
      ctx.strokeStyle = OUT; ctx.lineWidth = 0.075; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex[i] - 0.02, ey0); ctx.lineTo(ex[i] + 0.01, ey0 - 0.14 + wob); ctx.stroke();
      ctx.strokeStyle = '#e5561c'; ctx.lineWidth = 0.04; ctx.stroke();
      ctx.beginPath(); ctx.arc(ex[i] + 0.01, ey0 - 0.16 + wob, 0.075, 0, TAU); fillStroke(ctx, '#fff6dc', 0.035);
      ctx.fillStyle = '#1b0f0b'; ctx.beginPath(); ctx.arc(ex[i] + 0.035, ey0 - 0.155 + wob + look, 0.037, 0, TAU); ctx.fill();
    }
    // mouth
    ctx.strokeStyle = '#3a1408'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.arc(0.26, -0.12, 0.05, 0.3, 1.9); ctx.stroke();
    ctx.restore();
  }

  function drawChaser(ctx, c, t, ts, ox, oy) {
    var f = flipFor(c), ph = t * 10 + (c.id || 0) * 2.3, bob = -Math.abs(Math.sin(ph)) * 0.035;
    ctx.save();
    if (c.stun > 0 && (Math.floor(t * 12) & 1)) ctx.globalAlpha = 0.55;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(ox + c.x * ts, oy + (c.y + 0.31) * ts, ts * 0.4, ts * 0.12, 0, 0, TAU); ctx.fill();
    ctx.translate(ox + c.x * ts, oy + (c.y + 0.31) * ts); ctx.scale(ts * f * 1.05, ts * 1.05);
    var i, leg;
    // far legs
    var lx = [-0.2, 0.2, -0.12, 0.28];
    for (i = 0; i < 4; i++) {
      var near = i < 2, sw = Math.sin(ph + (i & 1) * Math.PI + (near ? 0 : 0.9)) * 0.1;
      leg = lx[i];
      ctx.strokeStyle = near ? OUT : '#0e0908'; ctx.lineWidth = near ? 0.115 : 0.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(leg, -0.25 + bob); ctx.lineTo(leg + sw, -0.04 - Math.max(0, Math.sin(ph + (i & 1) * Math.PI)) * 0.05); ctx.stroke();
      ctx.strokeStyle = near ? '#3a2423' : '#241615'; ctx.lineWidth = near ? 0.07 : 0.06; ctx.stroke();
      ctx.fillStyle = '#ff6a2a'; ctx.beginPath(); ctx.arc(leg + sw, -0.03, 0.04, 0, TAU); ctx.fill();
      if (i === 1) drawChaserBody(ctx, t, ph, bob);
    }
    drawChaserHead(ctx, t, ph, bob);
    ctx.restore();
  }
  function drawChaserBody(ctx, t, ph, bob) {
    // tail flame
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.28, -0.32 + bob); ctx.quadraticCurveTo(-0.45, -0.42, -0.42 + 0.03 * Math.sin(ph), -0.58); ctx.stroke();
    ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 0.05; ctx.stroke();
    ctx.strokeStyle = '#ffe07a'; ctx.lineWidth = 0.02; ctx.stroke();
    // body
    ctx.beginPath(); ctx.ellipse(0, -0.31 + bob, 0.33, 0.21, 0, 0, TAU);
    var bg = ctx.createLinearGradient(0, -0.5, 0, -0.1); bg.addColorStop(0, '#4a2c2a'); bg.addColorStop(1, '#1d1110');
    fillStroke(ctx, bg, 0.055);
    // spikes
    ctx.fillStyle = '#ff6a2a'; ctx.strokeStyle = OUT; ctx.lineWidth = 0.035;
    for (var i = 0; i < 4; i++) {
      var sx = -0.22 + i * 0.12, sh = 0.17 - i * 0.012;
      ctx.beginPath(); ctx.moveTo(sx - 0.055, -0.46 + bob + 0.01 * i); ctx.lineTo(sx + 0.005, -0.46 - sh + bob + 0.01 * i); ctx.lineTo(sx + 0.06, -0.46 + bob + 0.015 * i); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // lava cracks
    var pulse = 0.65 + 0.35 * Math.sin(t * 5 + ph * 0.1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,80,20,' + (0.5 * pulse) + ')'; ctx.lineWidth = 0.06;
    for (var pass = 0; pass < 2; pass++) {
      ctx.beginPath(); ctx.moveTo(-0.2, -0.36 + bob); ctx.lineTo(-0.1, -0.3 + bob); ctx.lineTo(-0.14, -0.22 + bob); ctx.moveTo(0.02, -0.4 + bob); ctx.lineTo(0.08, -0.3 + bob); ctx.lineTo(0.0, -0.24 + bob); ctx.lineTo(0.06, -0.17 + bob);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,210,90,' + pulse + ')'; ctx.lineWidth = 0.025;
    }
    ctx.fillStyle = 'rgba(255,130,40,0.5)'; ctx.beginPath(); ctx.ellipse(0, -0.17 + bob, 0.24, 0.04, 0, 0, TAU); ctx.fill();
  }
  function drawChaserHead(ctx, t, ph, bob) {
    var hx = 0.3, hy = -0.38 + bob + Math.sin(ph * 2) * 0.01;
    ctx.beginPath(); ctx.moveTo(hx + 0.05, hy - 0.2); ctx.lineTo(hx + 0.12, hy - 0.34); ctx.lineTo(hx + 0.17, hy - 0.16); ctx.closePath(); fillStroke(ctx, '#ff6a2a', 0.035);
    ctx.beginPath(); ctx.moveTo(hx - 0.1, hy - 0.2); ctx.lineTo(hx - 0.07, hy - 0.34); ctx.lineTo(hx + 0.0, hy - 0.18); ctx.closePath(); fillStroke(ctx, '#ff6a2a', 0.035);
    ctx.beginPath(); ctx.arc(hx, hy, 0.19, 0, TAU); fillStroke(ctx, '#3d2524', 0.05);
    // snout
    ctx.beginPath(); rr(ctx, hx + 0.02, hy - 0.04, 0.27, 0.15, 0.06); fillStroke(ctx, '#3d2524', 0.045);
    // mouth glow + teeth
    ctx.fillStyle = '#ff9a2e'; ctx.fillRect(hx + 0.07, hy + 0.06, 0.2, 0.035);
    ctx.fillStyle = '#fff3d6';
    for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(hx + 0.1 + i * 0.07, hy + 0.06); ctx.lineTo(hx + 0.13 + i * 0.07, hy + 0.06); ctx.lineTo(hx + 0.115 + i * 0.07, hy + 0.115); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#1b0f0b'; ctx.beginPath(); ctx.arc(hx + 0.27, hy + 0.0, 0.025, 0, TAU); ctx.fill();
    // eye
    ctx.fillStyle = '#ffe23a'; ctx.beginPath(); ctx.moveTo(hx + 0.03, hy - 0.06); ctx.lineTo(hx + 0.17, hy - 0.02); ctx.lineTo(hx + 0.06, hy + 0.025); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.03; ctx.stroke();
    ctx.fillStyle = '#1b0f0b'; ctx.beginPath(); ctx.arc(hx + 0.12, hy - 0.02, 0.016, 0, TAU); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.045; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - 0.01, hy - 0.1); ctx.lineTo(hx + 0.19, hy - 0.045); ctx.stroke();
  }

  // ---------------------------------------------------------------- flames
  function drawFlames(ctx, g, ox, oy, ts, t) {
    var fl = g.flames || [], i, G = R.G;
    for (i = 0; i < fl.length; i++) {
      var f = fl[i], k = clamp(f.t / (f.life || 0.55), 0, 1);
      var env = k > 0.8 ? clamp((1 - k) / 0.2, 0.15, 1) : k < 0.4 ? k / 0.4 : 1;
      var h = (f.x * 7 + f.y * 13) % 11, fk = 1 + 0.12 * Math.sin(t * 38 + h * 1.7);
      var cx = ox + (f.x + 0.5) * ts, cy = oy + (f.y + 0.5) * ts, hot = clamp(k * 1.7 - 0.2, 0, 1);
      var dx = f.dx || 0, dy = f.dy || 0, sz, thick = (0.55 + 0.5 * env) * fk;
      if (!dx && !dy) {
        sz = ts * 2.3 * (0.7 + 0.3 * env); ctx.globalAlpha = env * 0.9; ctx.drawImage(G.warm, cx - sz / 2, cy - sz / 2, sz, sz);
        sz = ts * 1.5 * (0.6 + 0.4 * env) * fk; ctx.globalAlpha = env; ctx.drawImage(G.hot, cx - sz / 2, cy - sz / 2, sz, sz);
        sz = ts * 0.95 * env; ctx.globalAlpha = hot; ctx.drawImage(G.white, cx - sz / 2, cy - sz / 2, sz, sz);
        // star flare
        ctx.globalAlpha = env * 0.8;
        ctx.drawImage(G.armOH, cx - ts * 0.6, cy - ts * 0.5 * thick, ts * 1.2, ts * thick);
        ctx.drawImage(G.armOV, cx - ts * 0.5 * thick, cy - ts * 0.6, ts * thick, ts * 1.2);
        ctx.globalAlpha = env * hot;
        ctx.drawImage(G.armIH, cx - ts * 0.55, cy - ts * 0.3 * thick, ts * 1.1, ts * 0.6 * thick);
        ctx.drawImage(G.armIV, cx - ts * 0.3 * thick, cy - ts * 0.55, ts * 0.6 * thick, ts * 1.1);
      } else {
        var horiz = dx !== 0, len = f.tip ? 0.62 : 1.04, off = f.tip ? 0 : 0;
        var x0, y0, w, hh;
        if (horiz) {
          w = ts * len; hh = ts * 1.1 * thick; y0 = cy - hh / 2;
          x0 = f.tip ? (dx > 0 ? cx - ts * 0.52 : cx - w + ts * 0.52) : cx - w / 2;
          ctx.globalAlpha = env; ctx.drawImage(G.armOH, x0, y0, w, hh);
          ctx.globalAlpha = env * hot; ctx.drawImage(G.armIH, x0, cy - hh * 0.28, w, hh * 0.56);
        } else {
          hh = ts * len; w = ts * 1.1 * thick; x0 = cx - w / 2;
          y0 = f.tip ? (dy > 0 ? cy - ts * 0.52 : cy - hh + ts * 0.52) : cy - hh / 2;
          ctx.globalAlpha = env; ctx.drawImage(G.armOV, x0, y0, w, hh);
          ctx.globalAlpha = env * hot; ctx.drawImage(G.armIV, cx - w * 0.28, y0, w * 0.56, hh);
        }
        sz = ts * (f.tip ? 1.15 : 1.35) * (0.7 + 0.3 * env) * fk; ctx.globalAlpha = env * (f.tip ? 0.95 : 0.5);
        ctx.drawImage(G.warm, cx - sz / 2, cy - sz / 2, sz, sz);
        sz = ts * (f.tip ? 0.8 : 0.7) * env; ctx.globalAlpha = env * hot * 0.9; ctx.drawImage(G.hot, cx - sz / 2, cy - sz / 2, sz, sz);
      }
      // rising tongues
      ctx.globalAlpha = env * 0.85;
      for (var q = 0; q < 3; q++) {
        var ph2 = t * (7 + q * 2.3) + h + q * 2.1, tx = cx + Math.sin(ph2) * ts * 0.22, ty = cy - ((ph2 * 0.37) % 1) * ts * 0.45 - ts * 0.05;
        var ts2 = ts * 0.34 * (1 - ((ph2 * 0.37) % 1) * 0.6); ctx.drawImage(G.hot, tx - ts2 / 2, ty - ts2 / 2, ts2, ts2);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- frame
  function getGrad(ctx, key, make) {
    var c = R.cache[key];
    if (!c) c = R.cache[key] = make(ctx);
    return c;
  }
  function backdrop(ctx, w, h, view, dpr) {
    ctx.fillStyle = '#0b0706'; ctx.fillRect(0, 0, w, h);
    var A = R.A, pat = R.cache.bgpat;
    if (!pat) {
      var ps = Math.max(24, Math.round(72 * dpr)), pc = mk(ps, ps), px = pc.getContext('2d');
      px.fillStyle = '#0f0908'; px.fillRect(0, 0, ps, ps);
      px.strokeStyle = 'rgba(255,150,80,0.05)'; px.lineWidth = Math.max(1, ps / 36);
      px.beginPath(); px.moveTo(0, ps); px.lineTo(ps, 0); px.moveTo(-ps / 2, ps / 2); px.lineTo(ps / 2, -ps / 2); px.moveTo(ps / 2, ps * 1.5); px.lineTo(ps * 1.5, ps / 2); px.stroke();
      px.fillStyle = 'rgba(255,170,100,0.08)'; px.beginPath(); px.arc(ps / 2, ps / 2, Math.max(1, ps / 28), 0, TAU); px.fill();
      px.strokeStyle = 'rgba(0,0,0,0.5)'; px.strokeRect(0, 0, ps, ps);
      pat = R.cache.bgpat = ctx.createPattern(pc, 'repeat');
      R.cache.bgScale = 1 / dpr;
    }
    ctx.save(); ctx.scale(R.cache.bgScale, R.cache.bgScale);
    ctx.fillStyle = pat; ctx.fillRect(0, 0, w * dpr, h * dpr); ctx.restore();
    var g = getGrad(ctx, 'bgglow' + w + 'x' + h, function (c) {
      var gg = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) * 0.5);
      gg.addColorStop(0, 'rgba(120,45,12,0.35)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); return gg;
    });
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }

  function draw(g, view) {
    var ctx = R.ctx;
    if (!ctx || !R.ok || !view || !g) return;
    try {
      R.lastG = g;
      var cv = R.canvas, dpr = view.dpr || 1, w = view.w || cv.clientWidth || 300, h = view.h || cv.clientHeight || 300;
      var t = view.t != null ? view.t : performance.now() / 1000;
      R.t = t;
      var cw = Math.round(w * dpr), ch = Math.round(h * dpr);
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; R.cache = {}; }
      var Wd = CW.W, Hd = CW.H, rc = view.rect || { x: 0, y: 0, w: w, h: h };
      var S = Math.floor(Math.min(rc.w / Wd, rc.h / Hd) * dpr); if (!(S >= 8)) S = 8;
      ensure(S, dpr);
      var A = R.A, ts = S / dpr, G = R.G, i;
      var ox = Math.round((rc.x + (rc.w - ts * Wd) / 2) * dpr) / dpr, oy = Math.round((rc.y + (rc.h - ts * Hd) / 2) * dpr) / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = true;
      backdrop(ctx, w, h, view, dpr);
      // shake
      var sh = clamp(view.shake || 0, 0, 1), sx = 0, sy = 0;
      if (sh > 0) { sx = (Math.sin(t * 91) + Math.sin(t * 53.7 + 1.3)) * 0.5 * sh * ts * 0.2; sy = (Math.cos(t * 77) + Math.sin(t * 61.1)) * 0.5 * sh * ts * 0.2; }
      ctx.save(); ctx.translate(sx, sy);
      var padd = A.pad / dpr;
      ctx.drawImage(A.arena, ox - padd, oy - padd, A.arena.width / dpr, A.arena.height / dpr);
      // lava cracks
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(0.5 + 0.22 * Math.sin(t * 1.6) + 0.1 * Math.sin(t * 4.7 + 1), 0.2, 0.9);
      ctx.drawImage(A.crack, ox - padd, oy - padd, A.crack.width / dpr, A.crack.height / dpr);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      // scorch decals
      for (i = 0; i < R.decals.length; i++) {
        var d = R.decals[i], da = clamp((d.life - d.t) / 3, 0, 1) * 0.75, ds = d.r * 2 * ts;
        ctx.globalAlpha = da; ctx.drawImage(G.scorch, ox + d.x * ts - ds / 2, oy + d.y * ts - ds / 2, ds, ds);
      }
      ctx.globalAlpha = 1;
      if (g.exit && g.exit.revealed) drawExit(ctx, g, ox, oy, ts, t);
      var pk = g.pickups || [];
      for (i = 0; i < pk.length; i++) drawPickup(ctx, pk[i], ox, oy, ts, t);
      drawCords(ctx, g, ox, oy, ts, t);
      // crates
      var tiles = g.tiles, cp = A.cpad / dpr, x, y, T = CW.T;
      if (tiles) for (y = 1; y < Hd - 1; y++) for (x = 1; x < Wd - 1; x++) {
        if (tiles[y * Wd + x] === T.CRATE) ctx.drawImage(A.crate[(x * 3 + y * 5) % 3], ox + x * ts - cp, oy + y * ts - cp, A.crate[0].width / dpr, A.crate[0].height / dpr);
      }
      var bombs = g.bombs || [];
      for (i = 0; i < bombs.length; i++) drawBomb(ctx, bombs[i], ox, oy, ts, t);
      // critters + hero depth sorted
      var ents = [], cr = g.critters || [];
      for (i = 0; i < cr.length; i++) if (cr[i].alive) ents.push({ y: cr[i].y, c: cr[i] });
      if (g.player && (g.player.alive || g.player.deadT > 0)) ents.push({ y: g.player.y + 0.01, p: g.player });
      ents.sort(function (a, b) { return a.y - b.y; });
      for (i = 0; i < ents.length; i++) {
        if (ents[i].p) drawHero(ctx, g, ents[i].p, t, ts, ox, oy);
        else if (ents[i].c.kind === 'chaser') drawChaser(ctx, ents[i].c, t, ts, ox, oy);
        else drawSlug(ctx, ents[i].c, t, ts, ox, oy);
      }
      // smoke + debris
      var pr = R.parts, p, px, py, a, s;
      for (i = 0; i < pr.length; i++) {
        p = pr[i]; if (p.k !== 'smoke') continue;
        var f = p.t / p.life; a = p.a * Math.min(1, f * 6) * (1 - f);
        s = p.r * (1 + (p.grow || 0) * f) * 2 * ts;
        ctx.globalAlpha = a; ctx.drawImage(G[p.spr], ox + p.x * ts - s / 2, oy + (p.y - p.z) * ts - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      for (i = 0; i < pr.length; i++) {
        p = pr[i]; if (p.k !== 'chunk') continue;
        s = p.r * ts; px = ox + p.x * ts; py = oy + (p.y - p.z) * ts;
        ctx.globalAlpha = Math.min(1, (p.life - p.t) * 4);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px - s / 2, oy + p.y * ts + s * 0.3, s, s * 0.4);
        ctx.save(); ctx.translate(px, py); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-s / 2, -s / 3, s, s * 0.66);
        ctx.strokeStyle = 'rgba(30,14,4,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(-s / 2, -s / 3, s, s * 0.66); ctx.restore();
      }
      ctx.globalAlpha = 1;
      // ----- additive light pass
      ctx.globalCompositeOperation = 'lighter';
      drawFlames(ctx, g, ox, oy, ts, t);
      drawCordGlow(ctx, g, ox, oy, ts, t);
      for (i = 0; i < bombs.length; i++) drawBombGlow(ctx, bombs[i], ox, oy, ts, t);
      for (i = 0; i < pk.length; i++) {
        var kk = pk[i], kc = kk.kind === 'bomb' ? G.blue : kk.kind === 'speed' ? G.teal : G.warm, gs = ts * (1.5 + 0.2 * Math.sin(t * 3 + i));
        ctx.globalAlpha = 0.55; ctx.drawImage(kc, ox + (kk.x + 0.5) * ts - gs / 2, oy + (kk.y + 0.5) * ts - gs / 2, gs, gs);
      }
      if (g.exit && g.exit.revealed) {
        var ec = g.exitOpen ? G.teal : G.red, es = ts * (g.exitOpen ? 2.4 : 1.2), ea = g.exitOpen ? 0.55 + 0.2 * Math.sin(t * 3) : 0.2 + 0.15 * Math.sin(t * 4);
        ctx.globalAlpha = ea; ctx.drawImage(ec, ox + (g.exit.x + 0.5) * ts - es / 2, oy + (g.exit.y + 0.5) * ts - es / 2, es, es);
      }
      for (i = 0; i < cr.length; i++) {
        var q = cr[i]; if (!q.alive) continue;
        var cs = ts * (q.kind === 'chaser' ? 1.6 : 1.3), cal = (q.kind === 'chaser' ? 0.4 : 0.3) + 0.1 * Math.sin(t * 4 + i);
        ctx.globalAlpha = cal; ctx.drawImage(q.kind === 'chaser' ? G.red : G.warm, ox + q.x * ts - cs / 2, oy + (q.y + 0.05) * ts - cs / 2, cs, cs);
      }
      var pl = g.player;
      if (pl && pl.alive && g.status !== 'won') { var ls = ts * 3; ctx.globalAlpha = 0.14; ctx.drawImage(G.hot, ox + pl.x * ts - ls / 2, oy + pl.y * ts - ls / 2, ls, ls); }
      for (i = 0; i < R.lights.length; i++) {
        var L = R.lights[i], lk = 1 - L.t / L.life, lsz = L.r * 2 * ts * (0.6 + 0.4 * (1 - lk));
        ctx.globalAlpha = L.a * lk * lk * 0.7; ctx.drawImage(G[L.spr] || G.warm, ox + L.x * ts - lsz / 2, oy + L.y * ts - lsz / 2, lsz, lsz);
      }
      // glowing particles + streaks + rings
      for (i = 0; i < pr.length; i++) {
        p = pr[i]; var fr = p.t / p.life;
        if (p.k === 'glow') {
          s = p.r * 2 * ts * (1 - fr * 0.5); a = p.a * (1 - fr) * (0.75 + 0.25 * Math.sin(p.t * 30 + p.fl));
          ctx.globalAlpha = clamp(a, 0, 1); ctx.drawImage(G[p.spr], ox + p.x * ts - s / 2, oy + (p.y - p.z) * ts - s / 2, s, s);
        } else if (p.k === 'streak') {
          px = ox + p.x * ts; py = oy + (p.y - p.z) * ts;
          ctx.globalAlpha = (1 - fr); ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(1, ts * 0.04); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - p.vx * 0.05 * ts, py - (p.vy - p.vz) * 0.05 * ts); ctx.stroke();
        } else if (p.k === 'ring') {
          var rf = 1 - Math.pow(1 - fr, 2.2), rad = (p.r + (p.r1 - p.r) * rf) * ts;
          ctx.globalAlpha = p.a * (1 - fr); ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(1, p.lw * ts * (1 - fr * 0.7));
          ctx.beginPath(); ctx.ellipse(ox + p.x * ts, oy + p.y * ts, rad, rad * 0.66, 0, 0, TAU); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      // popups
      var pops = g.popups || [];
      if (pops.length) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        for (i = 0; i < pops.length; i++) {
          var pp = pops[i], el = 0.9 - pp.t, txt = String(pp.text), word = /[A-Z]/.test(txt.charAt(txt.length - 1)) || /^[A-Z+]*[A-Z]/.test(txt.replace('+', ''));
          var sc = el < 0.12 ? 0.6 + el / 0.12 * 0.6 : 1.2 - Math.min(0.2, (el - 0.12) * 0.6);
          var fs = ts * (word ? 0.46 : 0.52) * sc;
          ctx.font = '900 ' + fs + 'px Impact, "Arial Black", system-ui, sans-serif';
          var ppx = ox + pp.x * ts, ppy = oy + (pp.y - 0.3 - el * 0.9) * ts;
          ctx.globalAlpha = clamp(pp.t / 0.3, 0, 1);
          ctx.strokeStyle = '#1b0f0b'; ctx.lineWidth = Math.max(2, fs * 0.28); ctx.strokeText(txt, ppx, ppy);
          ctx.fillStyle = word ? '#9ff5e6' : '#ffd36b'; ctx.fillText(txt, ppx, ppy);
          ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.save(); ctx.beginPath(); ctx.rect(ppx - fs * 3, ppy - fs * 0.6, fs * 6, fs * 0.55); ctx.clip(); ctx.fillText(txt, ppx, ppy); ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      // ----- lightmap (ambient darkness carved by light sources)
      var lm = R.lm, lx = R.lmx, LW = lm.width / Wd;
      lx.globalCompositeOperation = 'source-over'; lx.globalAlpha = 1; lx.clearRect(0, 0, lm.width, lm.height);
      lx.fillStyle = 'rgba(12,4,8,0.5)'; lx.fillRect(0, 0, lm.width, lm.height);
      lx.globalCompositeOperation = 'destination-out';
      function carve(cx, cy, r, al) { var d = r * 2 * LW; lx.globalAlpha = al; lx.drawImage(G.white, cx * LW - d / 2, cy * LW - d / 2, d, d); }
      carve(Wd / 2, Hd / 2, 9, 0.22);
      for (i = 0; i < (g.flames || []).length; i++) { var fq = g.flames[i]; carve(fq.x + 0.5, fq.y + 0.5, 2.3, clamp(fq.t / fq.life * 1.5, 0, 1)); }
      for (i = 0; i < bombs.length; i++) carve(bombs[i].x + 0.5, bombs[i].y + 0.5, bombs[i].dormant ? 1.3 : 2.2, bombs[i].dormant ? 0.5 : 0.8);
      for (i = 0; i < (g.sparks || []).length; i++) { var spp = sparkPos(g.sparks[i]); if (spp) carve(spp.x, spp.y, 1.8, 0.9); }
      for (i = 0; i < pk.length; i++) carve(pk[i].x + 0.5, pk[i].y + 0.5, 1.3, 0.7);
      for (i = 0; i < cr.length; i++) if (cr[i].alive) carve(cr[i].x, cr[i].y, 1.5, 0.6);
      if (pl && pl.alive) carve(pl.x, pl.y, 3.2, 0.8);
      if (g.exit && g.exit.revealed) carve(g.exit.x + 0.5, g.exit.y + 0.5, g.exitOpen ? 3 : 1.4, 0.8);
      for (i = 0; i < R.lights.length; i++) { var lq = R.lights[i]; carve(lq.x, lq.y, lq.r, lq.a * (1 - lq.t / lq.life)); }
      lx.globalAlpha = 1; lx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(lm, ox + sx, oy + sy, ts * Wd, ts * Hd);
      // vignette
      var vg = getGrad(ctx, 'vig' + w + 'x' + h, function (c) {
        var gg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.6);
        gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(0.65, 'rgba(8,2,2,0.28)'); gg.addColorStop(1, 'rgba(0,0,0,0.78)'); return gg;
      });
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
      if (g.hurry) {
        var hg = getGrad(ctx, 'hur' + w + 'x' + h, function (c) {
          var gg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.55);
          gg.addColorStop(0, 'rgba(255,30,20,0)'); gg.addColorStop(1, 'rgba(255,30,20,0.55)'); return gg;
        });
        ctx.globalAlpha = 0.45 + 0.4 * Math.sin(t * 6); ctx.fillStyle = hg; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
      }
      if (R.flash > 0.004) { ctx.globalAlpha = clamp(R.flash, 0, 0.5); ctx.fillStyle = R.flashCol; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    } catch (err) {
      try { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } catch (e2) { /* noop */ }
      if (root.console && !R.warned) { R.warned = true; console.error('CW.Render.draw', err); }
    }
  }

  function init(canvas) {
    try {
      R.canvas = canvas; R.ctx = canvas.getContext('2d');
      if (!Object.keys(R.G).length) bakeSprites();
      R.ok = !!R.ctx;
    } catch (e) { R.ok = false; }
    reset();
  }
  function reset() {
    R.parts.length = 0; R.lights.length = 0; R.decals.length = 0; R.flash = 0; R.walk = 0; R.acc = {}; R.flip = {}; R.celebrate = 0; R.cur = 0;
  }

  CW.Render = { init: init, reset: reset, update: update, fx: fx, draw: draw };
})(typeof window !== 'undefined' ? window : globalThis);
