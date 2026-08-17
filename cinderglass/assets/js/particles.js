/* =====================================================================
   CINDERGLASS — particles.js
   VFX drawn above the grid: embers lifting off hot matter, steam wisps,
   and sparks under the brush.
   Owner: agent-particles (this first pass written by the lead — it is a
   working floor, not the finished article).

   Particles live in *cell* space, not pixels, so they keep their scale
   when the chamber is letterboxed differently on a phone and a desktop.
   ===================================================================== */
(function (global) {
  'use strict';

  var CG = global.CG || (global.CG = {});
  var MAT = CG.Materials;
  var P = CG.Particles = {};

  var MAX = 1400;
  var px, py, vx, vy, life, maxLife, size, kind, count;

  var KIND_EMBER = 0, KIND_STEAM = 1, KIND_SPARK = 2;

  P.init = function () {
    px = new Float32Array(MAX); py = new Float32Array(MAX);
    vx = new Float32Array(MAX); vy = new Float32Array(MAX);
    life = new Float32Array(MAX); maxLife = new Float32Array(MAX);
    size = new Float32Array(MAX); kind = new Uint8Array(MAX);
    count = 0;
  };
  P.reset = function () { count = 0; };

  function spawn(x, y, dx, dy, ttl, sz, k) {
    if (count >= Math.min(MAX, CG.quality.maxParticles)) return;
    var i = count++;
    px[i] = x; py[i] = y; vx[i] = dx; vy[i] = dy;
    life[i] = ttl; maxLife[i] = ttl; size[i] = sz; kind[i] = k;
  }

  P.brush = function (cx, cy, r, torch) {
    if (CG.quality.tier < 1) return;
    var n = torch ? 2 : 1;
    for (var i = 0; i < n; i++) {
      var a = CG.rand() * CG.TAU, d = Math.sqrt(CG.rand()) * r;
      spawn(cx + Math.cos(a) * d, cy + Math.sin(a) * d,
        (CG.rand() - 0.5) * 3, torch ? -4 - CG.rand() * 4 : 2 + CG.rand() * 2,
        0.35 + CG.rand() * 0.35, 0.16 + CG.rand() * 0.22,
        torch ? KIND_SPARK : KIND_STEAM);
    }
  };

  /* Sample the world for cells that should be throwing something off.
     Sampling rather than scanning: a full 11k-cell sweep every frame just
     to find a few dozen emitters is not worth the budget, and a random
     sample looks identical once the particles are in flight. */
  P.update = function (sim, dt) {
    var samples = CG.quality.tier >= 2 ? 260 : (CG.quality.tier === 1 ? 140 : 0);
    var W = sim.W, H = sim.H, mat = sim.mat, temp = sim.temp;
    var STEAM = MAT.ID.STEAM, EMBER = MAT.ID.EMBER, BLAZE = MAT.ID.BLAZE;

    for (var s = 0; s < samples; s++) {
      var i = (CG.rand() * sim.N) | 0;
      var id = mat[i];
      if (id === 0) continue;
      var x = i % W, y = (i / W) | 0;
      var t = temp[i];

      if (id === STEAM) {
        if (CG.rand() < 0.05) spawn(x, y, (CG.rand() - 0.5) * 2, -3 - CG.rand() * 3,
          0.9 + CG.rand() * 0.8, 1.0 + CG.rand(), KIND_STEAM);
      } else if (id === EMBER || id === BLAZE) {
        if (CG.rand() < 0.12) spawn(x, y, (CG.rand() - 0.5) * 3, -6 - CG.rand() * 6,
          0.5 + CG.rand() * 0.6, 0.6 + CG.rand() * 0.6, KIND_EMBER);
      } else if (t > 900 && MAT.BY_ID[id].emissive > 0.5) {
        if (CG.rand() < 0.05) spawn(x, y, (CG.rand() - 0.5) * 2, -5 - CG.rand() * 5,
          0.6 + CG.rand() * 0.7, 0.5 + CG.rand() * 0.5, KIND_EMBER);
      }
    }

    for (var k = 0; k < count; k++) {
      life[k] -= dt;
      if (life[k] <= 0) {
        var last = --count;
        px[k] = px[last]; py[k] = py[last]; vx[k] = vx[last]; vy[k] = vy[last];
        life[k] = life[last]; maxLife[k] = maxLife[last];
        size[k] = size[last]; kind[k] = kind[last];
        k--;
        continue;
      }
      px[k] += vx[k] * dt;
      py[k] += vy[k] * dt;
      vy[k] += (kind[k] === KIND_STEAM ? -1.5 : -2.5) * dt;   // buoyancy
      vx[k] *= (1 - 1.4 * dt);
    }
  };

  P.draw = function (ctx, view, time) {
    if (!count) return;
    var sc = view.scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < count; k++) {
      var f = life[k] / maxLife[k];
      var x = view.x + px[k] * sc, y = view.y + py[k] * sc;
      var r = size[k] * sc * (0.4 + f * 0.8);
      if (kind[k] === KIND_STEAM) {
        ctx.globalAlpha = f * 0.16;
        ctx.fillStyle = '#cfe2ee';
      } else if (kind[k] === KIND_EMBER) {
        ctx.globalAlpha = f * 0.85;
        ctx.fillStyle = f > 0.6 ? '#ffe9b0' : '#ff7a2f';
      } else {
        ctx.globalAlpha = f * 0.45;
        ctx.fillStyle = '#ffd39b';
      }
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.6, r), 0, CG.TAU);
      ctx.fill();
    }
    ctx.restore();
  };

})(window);
