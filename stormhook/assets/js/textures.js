/* =====================================================================
   STORMHOOK — textures.js   [OWNER: agent-textures]

   Procedural material baking. Everything the renderer stamps is drawn
   into an offscreen canvas ONCE at boot; nothing is fetched.

   FIRST PASS (lead-authored scaffold, 2026-08-27). This exists so the
   vertical slice boots and reads clearly. It is deliberately plain and
   is the polish target for agent-textures — see PROGRESS.md.
   ===================================================================== */
(function (global) {
  'use strict';

  var SH = global.SH || (global.SH = {});
  var T = SH.Textures = {};
  var bank = {};

  T.bakeMs = 0;

  function noiseTile(size, base, spread, seed) {
    var m = SH.makeCanvas(size, size);
    var ctx = m.ctx;
    if (!ctx) return m.canvas;
    SH.setSeed(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    var img = ctx.getImageData(0, 0, size, size);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (SH.rand() - 0.5) * spread;
      d[i] = SH.clamp(d[i] + n, 0, 255);
      d[i + 1] = SH.clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = SH.clamp(d[i + 2] + n, 0, 255);
    }
    ctx.putImageData(img, 0, 0);
    return m.canvas;
  }

  /* A hull plate: riveted iron with a lit top edge and a dark underside,
     so a stack of them reads as a solid mass lit from above. */
  function hullPlate(size, seed, lit) {
    var m = SH.makeCanvas(size, size);
    var c = m.ctx;
    if (!c) return m.canvas;
    var P = SH.PALETTE;
    SH.setSeed(seed);

    c.drawImage(noiseTile(size, lit ? P.hullLit : P.hull, 26, seed), 0, 0);

    /* Panel seams */
    c.strokeStyle = 'rgba(0,0,0,0.32)';
    c.lineWidth = Math.max(1, size / 24);
    c.strokeRect(c.lineWidth / 2, c.lineWidth / 2, size - c.lineWidth, size - c.lineWidth);

    /* Top highlight / bottom shade */
    var g = c.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.02)');
    g.addColorStop(1, 'rgba(0,0,0,0.34)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);

    /* Rivets */
    var r = Math.max(1, size * 0.035);
    var inset = size * 0.16;
    var pts = [[inset, inset], [size - inset, inset], [inset, size - inset], [size - inset, size - inset]];
    for (var i = 0; i < pts.length; i++) {
      c.beginPath();
      c.arc(pts[i][0], pts[i][1], r, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,240,210,0.20)';
      c.fill();
      c.beginPath();
      c.arc(pts[i][0] + r * 0.35, pts[i][1] + r * 0.35, r * 0.7, 0, Math.PI * 2);
      c.fillStyle = 'rgba(0,0,0,0.30)';
      c.fill();
    }

    /* A little rust bloom so no two plates read identically. */
    var blooms = 2 + Math.floor(SH.rand() * 3);
    for (var b = 0; b < blooms; b++) {
      var bx = SH.rand() * size, by = SH.rand() * size, br = size * (0.10 + SH.rand() * 0.18);
      var rg = c.createRadialGradient(bx, by, 0, bx, by, br);
      rg.addColorStop(0, 'rgba(138,74,44,0.30)');
      rg.addColorStop(1, 'rgba(138,74,44,0)');
      c.fillStyle = rg;
      c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill();
    }
    return m.canvas;
  }

  /* A thin structural beam, drawn to fill one tile width. */
  function girder(size) {
    var m = SH.makeCanvas(size, size);
    var c = m.ctx;
    if (!c) return m.canvas;
    var P = SH.PALETTE;
    var th = size * 0.42, top = size * 0.29;

    var g = c.createLinearGradient(0, top, 0, top + th);
    g.addColorStop(0, P.iron);
    g.addColorStop(0.35, P.hullLit);
    g.addColorStop(1, P.hullDark);
    c.fillStyle = g;
    c.fillRect(0, top, size, th);

    c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.lineWidth = Math.max(1, size / 32);
    c.strokeRect(0, top, size, th);

    /* Lattice web */
    c.strokeStyle = 'rgba(0,0,0,0.30)';
    c.beginPath();
    for (var x = 0; x <= size; x += size / 3) {
      c.moveTo(x, top); c.lineTo(x + size / 6, top + th);
      c.moveTo(x + size / 6, top); c.lineTo(x, top + th);
    }
    c.stroke();

    c.fillStyle = 'rgba(255,236,200,0.22)';
    c.fillRect(0, top, size, Math.max(1, size * 0.05));
    return m.canvas;
  }

  function glowSprite(size, inner, outer) {
    var m = SH.makeCanvas(size, size);
    var c = m.ctx;
    if (!c) return m.canvas;
    var g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.45, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    return m.canvas;
  }

  T.init = function () {
    var t0 = (global.performance && global.performance.now) ? global.performance.now() : 0;
    var S = 64;
    bank.hull0 = hullPlate(S, 11, false);
    bank.hull1 = hullPlate(S, 29, false);
    bank.hull2 = hullPlate(S, 47, false);
    bank.hullLit = hullPlate(S, 63, true);
    bank.girder = girder(S);
    bank.glowCore = glowSprite(96, 'rgba(190,255,244,0.95)', 'rgba(111,240,214,0.35)');
    bank.glowBeacon = glowSprite(160, 'rgba(255,240,200,0.95)', 'rgba(255,215,110,0.30)');
    bank.glowSpark = glowSprite(48, 'rgba(220,248,255,0.95)', 'rgba(127,208,255,0.30)');
    var t1 = (global.performance && global.performance.now) ? global.performance.now() : 0;
    T.bakeMs = t1 - t0;
  };

  T.get = function (name) { return bank[name] || null; };

  /* Deterministic per-tile variant pick, so a hull looks the same every
     frame and every run. */
  T.hullFor = function (tx, ty, lit) {
    if (lit) return bank.hullLit;
    var h = (tx * 73856093 ^ ty * 19349663) >>> 0;
    return bank['hull' + (h % 3)] || bank.hull0;
  };

})(typeof window !== 'undefined' ? window : this);
