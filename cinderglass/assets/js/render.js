/* =====================================================================
   CINDERGLASS — render.js
   World renderer: material colour ramps, emissive lighting, bloom,
   the heat field, and the brush cursor.
   Owner: agent-render (this first pass written by the lead).

   The world is drawn at grid resolution into an ImageData buffer and
   blown up with nearest-neighbour sampling. Cells are the art: a cell is
   ~3px on a phone and ~10px on a desktop, and smoothing them would turn
   a legible material boundary into mush.

   One thing here is gameplay, not decoration: the *heat field*. The
   player's only verb is temperature, so temperature has to be visible.
   Air is tinted toward ember where it is hot and toward frost where it is
   cold, which is what makes the brush feel like it is doing something
   before any matter has changed state.
   ===================================================================== */
(function (global) {
  'use strict';

  var CG = global.CG || (global.CG = {});
  var MAT = CG.Materials;

  var R = CG.Render = {};

  var LUT_STEPS = 64;              // colour ramp resolution per material
  var lut = null;                  // Uint8Array[COUNT * LUT_STEPS * 3]
  var emissiveLut = null;          // Float32Array[COUNT * LUT_STEPS]

  var canvas = null, ctx = null;
  var world = null, worldCtx = null, worldImg = null, worldData = null;
  var glow = null, glowCtx = null, glowImg = null, glowData = null;
  var bloomA = null, bloomACtx = null, bloomB = null, bloomBCtx = null;

  var sim = null;
  var view = { x: 0, y: 0, w: 0, h: 0, scale: 1 };

  /* ------------------------------------------------------------------
     Colour ramp bake. Sampling a lerp per cell per frame is 11k lerps a
     frame for nothing: every material's ramp is fixed, so bake it once.
     ------------------------------------------------------------------ */
  function bakeLuts() {
    var n = MAT.COUNT;
    lut = new Uint8Array(n * LUT_STEPS * 3);
    emissiveLut = new Float32Array(n * LUT_STEPS);

    for (var id = 0; id < n; id++) {
      var m = MAT.BY_ID[id];
      var lo = CG.hexToRgb(m.colorLo), hi = CG.hexToRgb(m.colorHi);
      for (var s = 0; s < LUT_STEPS; s++) {
        var u = s / (LUT_STEPS - 1);
        var o = (id * LUT_STEPS + s) * 3;
        lut[o]     = Math.round(CG.lerp(lo.r, hi.r, u));
        lut[o + 1] = Math.round(CG.lerp(lo.g, hi.g, u));
        lut[o + 2] = Math.round(CG.lerp(lo.b, hi.b, u));

        /* Emissive strength rises over a 500-degree band above glowFrom,
           so a material brightens visibly as it approaches its own
           transition instead of snapping on. */
        var t = CG.lerp(m.rampLo, m.rampHi, u);
        emissiveLut[id * LUT_STEPS + s] =
          m.emissive * CG.smoothstep(m.glowFrom, m.glowFrom + 500, t);
      }
    }
  }

  /* Where a temperature sits on a material's ramp, as a LUT index. */
  function rampIndex(m, t) {
    var u = (t - m.rampLo) / ((m.rampHi - m.rampLo) || 1);
    var s = (u * (LUT_STEPS - 1)) | 0;
    return s < 0 ? 0 : (s > LUT_STEPS - 1 ? LUT_STEPS - 1 : s);
  }

  /* ------------------------------------------------------------------
     Setup
     ------------------------------------------------------------------ */
  R.init = function (canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d', { alpha: false });
    bakeLuts();
  };

  R.setSim = function (s) {
    sim = s;
    if (!sim) return;

    var mk = CG.makeCanvas;
    var w = sim.W, h = sim.H;

    world = mk(w, h); worldCtx = world.ctx; world = world.canvas;
    worldImg = worldCtx.createImageData(w, h);
    worldData = worldImg.data;

    glow = mk(w, h); glowCtx = glow.ctx; glow = glow.canvas;
    glowImg = glowCtx.createImageData(w, h);
    glowData = glowImg.data;

    /* Bloom runs at a quarter of grid resolution and is blurred by being
       bounced between two small canvases. At this size that is a handful
       of microseconds and it costs nothing on a phone. */
    var bw = Math.max(2, w >> 1), bh = Math.max(2, h >> 1);
    var a = mk(bw, bh); bloomA = a.canvas; bloomACtx = a.ctx;
    var b = mk(bw, bh); bloomB = b.canvas; bloomBCtx = b.ctx;

    /* opaque background so the first frame is never a flash of white */
    worldData.fill(255);
  };

  /* Fit the world into the canvas with square cells and letterboxing.
     game.js and ui.js both need this mapping, so it lives on the view. */
  R.layout = function (padTop, padBottom) {
    if (!sim || !canvas) return view;
    var availH = canvas.height - (padTop || 0) - (padBottom || 0);
    var scale = Math.min(canvas.width / sim.W, availH / sim.H);
    /* Snap to whole pixels per cell where we comfortably can: a fractional
       cell size makes neighbouring cells different widths and the material
       boundaries shimmer as things move. */
    if (scale >= 3) scale = Math.floor(scale);
    view.scale = scale;
    view.w = sim.W * scale;
    view.h = sim.H * scale;
    view.x = Math.round((canvas.width - view.w) / 2);
    view.y = Math.round((padTop || 0) + (availH - view.h) / 2);
    return view;
  };
  R.view = function () { return view; };

  /* Canvas pixels -> cell coordinates (may be outside the grid). */
  R.toCell = function (px, py) {
    return {
      x: (px - view.x) / (view.scale || 1),
      y: (py - view.y) / (view.scale || 1)
    };
  };
  R.toScreen = function (cx, cy) {
    return { x: view.x + cx * view.scale, y: view.y + cy * view.scale };
  };

  /* ------------------------------------------------------------------
     The world pass: one write per cell into two buffers — the material
     colour, and the light it throws.
     ------------------------------------------------------------------ */
  var AMBIENT = 18;
  var HOT_TINT = { r: 0x4a, g: 0x16, b: 0x04 };
  var COLD_TINT = { r: 0x0b, g: 0x1e, b: 0x36 };

  function drawWorld(frame) {
    var W = sim.W, H = sim.H, N = sim.N;
    var mat = sim.mat, temp = sim.temp;
    var d = worldData, g = glowData;
    var VOID = 0;

    for (var i = 0; i < N; i++) {
      var id = mat[i];
      var t = temp[i];
      var o = i << 2;
      var r, gg, b, em = 0;

      if (id === VOID) {
        /* The heat field. This is not decoration — the player's whole verb
           is temperature, and without this there is no feedback at all
           until matter changes state. */
        r = 0x07; gg = 0x06; b = 0x0a;
        var dt = t - AMBIENT;
        if (dt > 4) {
          var hw = CG.smoothstep(0, 900, dt) * 0.85;
          r += (HOT_TINT.r - r) * hw;
          gg += (HOT_TINT.g - gg) * hw;
          b += (HOT_TINT.b - b) * hw;
          em = CG.smoothstep(120, 1100, t) * 0.30;
        } else if (dt < -4) {
          var cw = CG.smoothstep(0, 90, -dt) * 0.70;
          r += (COLD_TINT.r - r) * cw;
          gg += (COLD_TINT.g - gg) * cw;
          b += (COLD_TINT.b - b) * cw;
        }
      } else {
        var m = MAT.BY_ID[id];
        var s = rampIndex(m, t);
        var li = (id * LUT_STEPS + s) * 3;
        r = lut[li]; gg = lut[li + 1]; b = lut[li + 2];

        /* Stable per-cell grain. Hashed on position, not on time, so a
           settled pile has texture instead of static. */
        if (m.grain > 0) {
          var x = i % W, y = (i / W) | 0;
          var n = (CG.hash2(x, y) - 0.5) * m.grain;
          r += r * n; gg += gg * n; b += b * n;
        }
        em = emissiveLut[id * LUT_STEPS + s];
      }

      d[o] = r < 0 ? 0 : (r > 255 ? 255 : r);
      d[o + 1] = gg < 0 ? 0 : (gg > 255 ? 255 : gg);
      d[o + 2] = b < 0 ? 0 : (b > 255 ? 255 : b);
      d[o + 3] = 255;

      if (em > 0.01) {
        g[o] = d[o] * em;
        g[o + 1] = d[o + 1] * em;
        g[o + 2] = d[o + 2] * em;
        g[o + 3] = 255;
      } else {
        g[o] = g[o + 1] = g[o + 2] = 0;
        g[o + 3] = 255;
      }
    }

    worldCtx.putImageData(worldImg, 0, 0);
    glowCtx.putImageData(glowImg, 0, 0);
  }

  /* ------------------------------------------------------------------
     Bloom: downsample the light buffer, blur it by bouncing between two
     small canvases, then add it back over the world.
     ------------------------------------------------------------------ */
  function drawBloom() {
    if (!CG.quality.bloom || !bloomA) return;
    var bw = bloomA.width, bh = bloomA.height;

    bloomACtx.clearRect(0, 0, bw, bh);
    bloomACtx.drawImage(glow, 0, 0, bw, bh);

    var passes = CG.quality.tier >= 2 ? 3 : 2;
    for (var p = 0; p < passes; p++) {
      bloomBCtx.clearRect(0, 0, bw, bh);
      bloomBCtx.filter = 'blur(' + (1.6 + p * 1.4) + 'px)';
      bloomBCtx.drawImage(bloomA, 0, 0);
      bloomBCtx.filter = 'none';
      var t = bloomA, tc = bloomACtx;
      bloomA = bloomB; bloomACtx = bloomBCtx;
      bloomB = t; bloomBCtx = tc;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bloomA, view.x, view.y, view.w, view.h);
    ctx.restore();
  }

  /* ------------------------------------------------------------------
     The brush cursor. It has to read against both a black chamber and a
     white-hot pour, so it is drawn as a two-tone ring: a dark outer
     stroke and a bright inner one.
     ------------------------------------------------------------------ */
  function drawBrush(time) {
    var I = CG.Input;
    if (!I.brush.inside && I.lastKind !== 'key') return;

    var cell = R.toCell(I.brush.x, I.brush.y);
    var rCells = I.radius();
    var p = R.toScreen(cell.x, cell.y);
    var rad = rCells * view.scale;
    var torch = I.effectiveTool() === CG.TOOL_TORCH;
    var col = torch ? CG.PALETTE.ember : CG.PALETTE.frost;
    var hot = torch ? CG.PALETTE.emberHot : CG.PALETTE.frostPale;

    ctx.save();
    ctx.lineWidth = Math.max(2, view.scale * 0.35);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(p.x, p.y, rad + ctx.lineWidth * 0.5, 0, CG.TAU); ctx.stroke();

    ctx.lineWidth = Math.max(1.2, view.scale * 0.22);
    ctx.strokeStyle = I.brush.down ? hot : col;
    ctx.globalAlpha = I.brush.down ? 1 : 0.7;
    ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, CG.TAU); ctx.stroke();

    /* a pulse while painting, so held input is obvious on a phone where
       the finger is covering the brush */
    if (I.brush.down) {
      var pulse = 0.5 + 0.5 * Math.sin(time * 9);
      ctx.globalAlpha = 0.16 + pulse * 0.20;
      ctx.fillStyle = hot;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad * 0.92, 0, CG.TAU); ctx.fill();
    }

    /* crosshair, so the keyboard cursor is findable in a busy chamber */
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = hot;
    ctx.lineWidth = Math.max(1, view.scale * 0.14);
    var k = rad * 0.32;
    ctx.beginPath();
    ctx.moveTo(p.x - k, p.y); ctx.lineTo(p.x + k, p.y);
    ctx.moveTo(p.x, p.y - k); ctx.lineTo(p.x, p.y + k);
    ctx.stroke();
    ctx.restore();
  }

  /* A frame around the play area, so the chamber reads as a thing in a
     room rather than a rectangle of pixels that ran out. */
  function drawFrame() {
    var pad = Math.max(2, Math.round(view.scale * 0.5));
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = pad * 2;
    ctx.strokeRect(view.x - pad, view.y - pad, view.w + pad * 2, view.h + pad * 2);
    ctx.strokeStyle = CG.rgba(CG.PALETTE.brassDark, 0.75);
    ctx.lineWidth = Math.max(1, pad * 0.5);
    ctx.strokeRect(view.x - pad * 0.5, view.y - pad * 0.5, view.w + pad, view.h + pad);
    ctx.restore();
  }

  function drawVignette() {
    var g = ctx.createRadialGradient(
      canvas.width * 0.5, canvas.height * 0.5, Math.min(canvas.width, canvas.height) * 0.25,
      canvas.width * 0.5, canvas.height * 0.5, Math.max(canvas.width, canvas.height) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /* ------------------------------------------------------------------
     Frame
     ------------------------------------------------------------------ */
  R.draw = function (time, frame) {
    if (!ctx) return;
    ctx.fillStyle = CG.PALETTE.void;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!sim) return;

    drawWorld(frame);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(world, view.x, view.y, view.w, view.h);
    ctx.restore();

    drawBloom();

    if (CG.Particles && CG.Particles.draw) CG.Particles.draw(ctx, view, time);

    drawFrame();
    drawVignette();
    drawBrush(time);
  };

})(window);
