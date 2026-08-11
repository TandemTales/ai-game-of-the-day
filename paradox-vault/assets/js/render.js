/* =====================================================================
   PARADOX VAULT — render.js
   Layered world renderer: baked static scene, dynamic actors/devices,
   a light-accumulation buffer, and a post chain (bloom, vignette,
   chromatic aberration, grain).
   Owner: lead.

   Layer order per frame
     0  baked static  (floor, decals, wall bodies, AO)   [cached per vault]
     1  ground particles / floor decals (dynamic)
     2  devices below actors (plates, medallions, exit pad, terminals)
     3  actors (echoes -> sentries -> player), sorted by y
     4  props with height (columns, vitrines) that occlude actors
     5  beams + holograms
     6  light buffer composited (screen)
     7  darkness/vignette (multiply)
     8  air particles
     9  post: bloom, aberration, grain, letter FX
   ===================================================================== */
(function (global) {
  'use strict';
  var PV = global.PV;
  var T = PV.TILE;
  var P = PV.PALETTE;

  var R = PV.Render = {};

  var view = { w: 0, h: 0, dpr: 1 };
  var cam = { x: 0, y: 0, scale: 1, tScale: 1, shake: 0, shakeX: 0, shakeY: 0, kick: 0 };
  var main = null, mctx = null;

  /* offscreen buffers */
  var Static = null;      // baked vault
  var Light = null;       // light accumulation (half res)
  var Bloom = null, Bloom2 = null;
  var Scene = null;       // full-res composite before post

  var texWarned = false;
  function TX(name) {
    if (!PV.Textures || !PV.Textures.ready) return null;
    try { return PV.Textures.get(name); } catch (e) {
      if (!texWarned) { texWarned = true; console.warn('[PV.Render] texture lookup failed', e); }
      return null;
    }
  }
  var patCache = Object.create(null);
  function PAT(ctx, name) {
    var c = TX(name);
    if (!c) return null;
    var k = name;
    if (!patCache[k]) patCache[k] = ctx.createPattern(c, 'repeat');
    return patCache[k];
  }

  var FALLBACK = {
    'floor.marble': '#151922', 'floor.marbleGold': '#1c1b18', 'floor.granite': '#12151b',
    'floor.carpet': '#3a1520', 'floor.parquet': '#2b1d12', 'floor.grate': '#171b21',
    'wall.stone': '#0d1017', 'glass.frosted': 'rgba(150,200,220,0.16)'
  };

  /* ==================================================================
     Setup / resize
     ================================================================== */
  R.init = function (canvas) {
    main = canvas;
    mctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    R.resize();
    global.addEventListener('resize', R.resize);
    if (global.visualViewport) global.visualViewport.addEventListener('resize', R.resize);
  };

  R.resize = function () {
    if (!main) return;
    var rect = main.getBoundingClientRect();
    var cssW = Math.max(240, Math.round(rect.width || global.innerWidth));
    var cssH = Math.max(240, Math.round(rect.height || global.innerHeight));
    var dpr = PV.dpr();
    /* cap total pixels so 4K + high dpr does not melt a laptop GPU */
    var maxPx = PV.quality.tier >= 2 ? 4200000 : 2400000;
    var px = cssW * cssH * dpr * dpr;
    if (px > maxPx) dpr = Math.max(1, dpr * Math.sqrt(maxPx / px));

    view.w = cssW; view.h = cssH; view.dpr = dpr;
    main.width = Math.round(cssW * dpr);
    main.height = Math.round(cssH * dpr);

    var bw = main.width, bh = main.height;
    Scene = PV.makeCanvas(bw, bh, { alpha: false });
    Light = PV.makeCanvas(Math.round(bw / 2), Math.round(bh / 2));
    Bloom = PV.makeCanvas(Math.round(bw / 4), Math.round(bh / 4));
    Bloom2 = PV.makeCanvas(Math.round(bw / 4), Math.round(bh / 4));
    grainTile = null;
    PV.emit('render:resize', { w: cssW, h: cssH, dpr: dpr });
  };

  /* ==================================================================
     Camera
     ================================================================== */
  R.frameCamera = function (world, dt, focusX, focusY) {
    var vw = view.w, vh = view.h;
    /* Fit the vault with a small margin, then bias towards the larger of the
       two fits so ultrawide windows are not mostly empty. */
    var pad = 0.45;   // tiles of margin
    var wantW = (world.vault.w + pad * 2) * T;
    var wantH = (world.vault.h + pad * 2) * T;
    var fitW = vw / wantW, fitH = vh / wantH;
    var fit = Math.min(fitW, fitH);
    /* pull up to 22% of the way toward the looser fit — crops a sliver of the
       margin on the long axis but makes the vault dominate the frame */
    fit = PV.lerp(fit, Math.max(fitW, fitH), 0.22);
    var minScale = PV.isMobile ? 0.34 : 0.50;
    var maxScale = 2.4;
    var s = PV.clamp(fit, minScale, maxScale);
    cam.tScale = s;
    cam.scale = PV.damp(cam.scale || s, s, 8, dt);

    var halfW = vw / (2 * cam.scale), halfH = vh / (2 * cam.scale);
    var worldW = world.vault.w * T, worldH = world.vault.h * T;

    var tx, ty;
    if (worldW + pad * T * 2 <= halfW * 2) tx = worldW / 2;
    else tx = PV.clamp(focusX, halfW - pad * T, worldW - halfW + pad * T);
    if (worldH + pad * T * 2 <= halfH * 2) ty = worldH / 2;
    else ty = PV.clamp(focusY, halfH - pad * T, worldH - halfH + pad * T);

    cam.x = PV.damp(cam.x || tx, tx, 9, dt);
    cam.y = PV.damp(cam.y || ty, ty, 9, dt);

    /* shake */
    cam.shake = Math.max(0, cam.shake - dt * 2.6);
    var mag = cam.shake * cam.shake * 13;
    var t = PV.now() * 0.001;
    cam.shakeX = Math.sin(t * 47.3) * mag + Math.sin(t * 91.7) * mag * 0.5;
    cam.shakeY = Math.cos(t * 53.1) * mag + Math.cos(t * 87.3) * mag * 0.5;
  };
  R.shake = function (amt) { cam.shake = Math.min(1.4, cam.shake + amt); };
  R.camera = cam;
  R.view = view;

  function applyWorldTransform(ctx, scaleBoost) {
    var dpr = view.dpr;
    var s = cam.scale * (scaleBoost || 1);
    ctx.setTransform(
      s * dpr, 0, 0, s * dpr,
      (view.w / 2 - (cam.x + cam.shakeX) * s) * dpr,
      (view.h / 2 - (cam.y + cam.shakeY) * s) * dpr
    );
  }
  R.applyWorldTransform = applyWorldTransform;

  R.screenToWorld = function (sx, sy) {
    return {
      x: (sx - view.w / 2) / cam.scale + cam.x,
      y: (sy - view.h / 2) / cam.scale + cam.y
    };
  };

  /* ==================================================================
     Static bake — floors, walls, decals. Once per vault.
     ================================================================== */
  var bakedId = null;

  R.invalidate = function () { bakedId = null; };

  R.bake = function (world) {
    var v = world.vault;
    var W = v.w * T, H = v.h * T;
    Static = PV.makeCanvas(W, H, { alpha: false });
    var g = Static.ctx;

    g.fillStyle = P.void;
    g.fillRect(0, 0, W, H);

    PV.setSeed(1337 + v.index * 7919);

    /* ---------- floors ----------
       Filled per MATERIAL, not per tile: each material's tiles are collected
       into one clip region and the pattern is laid across the whole vault in
       a single pass. That is what kills the "checkerboard" look you get from
       drawing a 128px texture into each 64px cell. */
    drawFloors(g, v, W, H);

    /* ---------- floor decals ---------- */
    for (var i = 0; i < v.objects.length; i++) {
      var o = v.objects[i];
      if (o.t === 'medallion') {
        var med = TX('decal.medallion');
        if (med) {
          var d = o.r * 2 * T;
          g.save();
          g.globalAlpha = 0.92;
          g.drawImage(med, o.x * T - d / 2, o.y * T - d / 2, d, d);
          g.restore();
        } else {
          drawFallbackMedallion(g, o.x * T, o.y * T, o.r * T);
        }
      }
    }

    /* scattered wear */
    var wearCount = Math.floor(v.w * v.h * 0.10);
    for (var k = 0; k < wearCount; k++) {
      var wx = PV.rand() * W, wy = PV.rand() * H;
      var tx = Math.floor(wx / T), ty = Math.floor(wy / T);
      var tt = v.grid[ty * v.w + tx];
      if (!tt || tt.solid || tt.isVoid) continue;
      var fam = PV.rand() < 0.45 ? 'decal.crack' : 'decal.scuff';
      var dec = PV.Textures && PV.Textures.ready ? PV.Textures.variant(fam, PV.randInt(0, 3)) : null;
      if (!dec) continue;
      var sc = PV.randRange(0.6, 1.5) * T / 64;
      g.save();
      g.globalAlpha = PV.randRange(0.10, 0.30);
      g.translate(wx, wy);
      g.rotate(PV.rand() * PV.TAU);
      g.drawImage(dec, -dec.width * sc / 2, -dec.height * sc / 2, dec.width * sc, dec.height * sc);
      g.restore();
    }

    /* ---------- wall drop shadows onto the floor ---------- */
    g.save();
    g.globalCompositeOperation = 'multiply';
    for (var y2 = 0; y2 < v.h; y2++) {
      for (var x2 = 0; x2 < v.w; x2++) {
        var tt2 = v.grid[y2 * v.w + x2];
        if (!tt2.solid || tt2.isVoid) continue;
        var grd = g.createLinearGradient(x2 * T, y2 * T + T, x2 * T, y2 * T + T + T * 0.85);
        grd.addColorStop(0, 'rgba(0,0,0,0.62)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fillRect(x2 * T - T * 0.12, y2 * T + T, T * 1.24, T * 0.85);
      }
    }
    g.restore();

    /* ---------- wall bodies ----------
       Same trick as the floor: one continuous stone pass clipped to the wall
       footprint, then per-tile bevels and trim on top. */
    g.save();
    g.beginPath();
    var anyWall = false;
    for (var y3 = 0; y3 < v.h; y3++) {
      for (var x3 = 0; x3 < v.w; x3++) {
        var t3 = v.grid[y3 * v.w + x3];
        if (!t3.solid || t3.isVoid || t3.kind === 'glass') continue;
        g.rect(x3 * T, y3 * T, T, T);
        anyWall = true;
      }
    }
    if (anyWall) {
      g.clip();
      var wtex = TX('wall.stone');
      if (wtex) {
        var wpat = g.createPattern(wtex, 'repeat');
        g.fillStyle = wpat;
        g.fillRect(0, 0, W, H);
        g.save();
        g.globalAlpha = 0.18;
        g.translate(W * 0.5, H * 0.5); g.rotate(-0.31); g.scale(2.6, 2.6); g.translate(-W * 0.5, -H * 0.5);
        g.fillStyle = wpat; g.fillRect(-W, -H, W * 3, H * 3);
        g.restore();
      } else {
        g.fillStyle = '#0e1118';
        g.fillRect(0, 0, W, H);
      }
      /* walls read heavier and cooler than the floor */
      g.fillStyle = 'rgba(11,15,25,0.42)';
      g.fillRect(0, 0, W, H);
      var wl = g.createLinearGradient(0, 0, W * 0.6, H);
      wl.addColorStop(0, 'rgba(132,164,214,0.20)');
      wl.addColorStop(1, 'rgba(0,0,0,0.30)');
      g.fillStyle = wl;
      g.fillRect(0, 0, W, H);
    }
    g.restore();

    for (var y4 = 0; y4 < v.h; y4++) {
      for (var x4 = 0; x4 < v.w; x4++) {
        var t4 = v.grid[y4 * v.w + x4];
        if (!t4.solid) continue;
        if (t4.isVoid) { g.fillStyle = P.void; g.fillRect(x4 * T, y4 * T, T, T); continue; }
        if (t4.kind === 'glass') { drawGlassTile(g, v, x4, y4); continue; }
        drawWallTile(g, v, x4, y4);
      }
    }

    /* ---------- global grade: subtle corner darkening ---------- */
    var vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.max(W, H) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.26)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);

    bakedId = v.index + ':' + v.id;
  };

  /* Screen-space environment behind the vault. Keeps ultrawide windows from
     reading as "the game failed to fill the screen". */
  var bdCache = null, bdKey = '';
  function backdropTile() {
    if (bdCache) return bdCache;
    var S = 256;
    var c = PV.makeCanvas(S, S);
    var g = c.ctx;
    g.fillStyle = 'rgba(0,0,0,0)';
    g.fillRect(0, 0, S, S);
    /* art-deco lattice: nested chevrons + hairlines */
    g.strokeStyle = 'rgba(150,180,225,0.030)';
    g.lineWidth = 1;
    for (var i = 0; i < 5; i++) {
      var k = i * 26 + 14;
      g.beginPath();
      g.moveTo(0, k); g.lineTo(S - k, S); g.stroke();
      g.beginPath();
      g.moveTo(k, 0); g.lineTo(S, S - k); g.stroke();
    }
    g.strokeStyle = 'rgba(201,162,39,0.026)';
    g.lineWidth = 2;
    g.strokeRect(S * 0.5 - 46, S * 0.5 - 46, 92, 92);
    g.strokeRect(S * 0.5 - 30, S * 0.5 - 30, 60, 60);
    g.beginPath();
    g.moveTo(S * 0.5, S * 0.5 - 60); g.lineTo(S * 0.5 + 60, S * 0.5);
    g.lineTo(S * 0.5, S * 0.5 + 60); g.lineTo(S * 0.5 - 60, S * 0.5);
    g.closePath(); g.stroke();
    bdCache = c.canvas;
    return bdCache;
  }

  function drawBackdrop(g, world, time) {
    var W = Scene.canvas.width, H = Scene.canvas.height;
    var grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#0b0f18');
    grd.addColorStop(0.45, '#080b12');
    grd.addColorStop(1, '#04060a');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);

    /* parallaxed deco lattice */
    var tile = backdropTile();
    var pat = g.createPattern(tile, 'repeat');
    if (pat) {
      var px = (-cam.x * cam.scale * 0.35) % 256;
      var py = (-cam.y * cam.scale * 0.35) % 256;
      g.save();
      g.translate(px, py);
      g.fillStyle = pat;
      g.fillRect(-256, -256, W + 512, H + 512);
      g.restore();
    }

    /* slow atmospheric haze so the void has depth */
    var hx = W * (0.5 + 0.10 * Math.sin(time * 0.11));
    var hy = H * (0.42 + 0.08 * Math.cos(time * 0.09));
    var hz = g.createRadialGradient(hx, hy, 0, hx, hy, Math.max(W, H) * 0.62);
    hz.addColorStop(0, 'rgba(58,84,128,0.10)');
    hz.addColorStop(0.6, 'rgba(30,44,70,0.06)');
    hz.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hz;
    g.fillRect(0, 0, W, H);
  }

  /* Slab layouts per material: how big a "stone" is, in tiles. */
  var SLAB = {
    marble: 2, marbleGold: 2, granite: 1, carpet: 0, parquet: 0, grate: 1
  };

  function drawFloors(g, v, W, H) {
    /* group tiles by material kind */
    var groups = Object.create(null);
    for (var y = 0; y < v.h; y++) {
      for (var x = 0; x < v.w; x++) {
        var t = v.grid[y * v.w + x];
        if (t.solid || t.isVoid) continue;
        (groups[t.kind] || (groups[t.kind] = { tex: t.tex, tiles: [] })).tiles.push(x, y);
      }
    }

    for (var kind in groups) {
      var grp = groups[kind];
      g.save();
      /* clip to this material's footprint */
      g.beginPath();
      for (var i = 0; i < grp.tiles.length; i += 2) {
        g.rect(grp.tiles[i] * T, grp.tiles[i + 1] * T, T, T);
      }
      g.clip();

      var tex = TX(grp.tex);
      if (tex) {
        var pat = g.createPattern(tex, 'repeat');
        /* Draw the 128px source at 128 world px (= 2 tiles) in one continuous
           pass so veining flows across the whole room. */
        g.fillStyle = pat;
        g.fillRect(0, 0, W, H);
        /* Second, larger, rotated pass at low alpha breaks the 128px period
           so the eye cannot lock onto the repeat. */
        g.save();
        g.globalAlpha = 0.14;
        g.translate(W * 0.5, H * 0.5);
        g.rotate(0.42);
        g.scale(3.1, 3.1);
        g.translate(-W * 0.5, -H * 0.5);
        g.fillStyle = pat;
        g.fillRect(-W, -H, W * 3, H * 3);
        g.restore();
      } else {
        g.fillStyle = FALLBACK[grp.tex] || '#141821';
        g.fillRect(0, 0, W, H);
      }

      /* low-frequency lighting/soiling variation across the room */
      var vg2 = g.createRadialGradient(W * 0.38, H * 0.32, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
      vg2.addColorStop(0, 'rgba(255,255,255,0.05)');
      vg2.addColorStop(0.6, 'rgba(0,0,0,0.04)');
      vg2.addColorStop(1, 'rgba(0,0,0,0.16)');
      g.fillStyle = vg2;
      g.fillRect(0, 0, W, H);

      /* slab joints — deliberate masonry, at slab scale not tile scale */
      var step = SLAB[kind];
      if (step) {
        var s = step * T;
        g.lineWidth = 1;
        for (var gx = 0; gx <= W; gx += s) {
          g.strokeStyle = 'rgba(0,0,0,0.34)';
          g.beginPath(); g.moveTo(gx + 0.5, 0); g.lineTo(gx + 0.5, H); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,0.05)';
          g.beginPath(); g.moveTo(gx + 1.5, 0); g.lineTo(gx + 1.5, H); g.stroke();
        }
        for (var gy = 0; gy <= H; gy += s) {
          g.strokeStyle = 'rgba(0,0,0,0.34)';
          g.beginPath(); g.moveTo(0, gy + 0.5); g.lineTo(W, gy + 0.5); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,0.05)';
          g.beginPath(); g.moveTo(0, gy + 1.5); g.lineTo(W, gy + 1.5); g.stroke();
        }
      }
      g.restore();
    }

    /* contact AO: darken floor tiles that touch a wall, on the touching side */
    g.save();
    for (var y2 = 0; y2 < v.h; y2++) {
      for (var x2 = 0; x2 < v.w; x2++) {
        var tt = v.grid[y2 * v.w + x2];
        if (tt.solid || tt.isVoid) continue;
        var px = x2 * T, py = y2 * T, d = T * 0.42;
        if (x2 > 0 && v.grid[y2 * v.w + x2 - 1].solid) aoEdge(g, px, py, d, T, 'l');
        if (x2 < v.w - 1 && v.grid[y2 * v.w + x2 + 1].solid) aoEdge(g, px, py, d, T, 'r');
        if (y2 > 0 && v.grid[(y2 - 1) * v.w + x2].solid) aoEdge(g, px, py, d, T, 't');
        if (y2 < v.h - 1 && v.grid[(y2 + 1) * v.w + x2].solid) aoEdge(g, px, py, d, T, 'b');
      }
    }
    g.restore();
  }

  function aoEdge(g, px, py, d, size, side) {
    var grd;
    if (side === 'l') { grd = g.createLinearGradient(px, py, px + d, py); }
    else if (side === 'r') { grd = g.createLinearGradient(px + size, py, px + size - d, py); }
    else if (side === 't') { grd = g.createLinearGradient(px, py, px, py + d); }
    else { grd = g.createLinearGradient(px, py + size, px, py + size - d); }
    grd.addColorStop(0, 'rgba(0,0,0,0.46)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(px, py, size, size);
  }

  function drawWallTile(g, v, x, y) {
    var px = x * T, py = y * T;
    var top = TX('wall.stone');
    var openN = !v.grid[(y - 1) * v.w + x] || !v.grid[(y - 1) * v.w + x].solid;
    var openS = y + 1 < v.h && !v.grid[(y + 1) * v.w + x].solid;
    var openW = x > 0 && !v.grid[y * v.w + (x - 1)].solid;
    var openE = x + 1 < v.w && !v.grid[y * v.w + (x + 1)].solid;

    /* body is already laid down as one continuous stone pass; this adds the
       per-tile edge treatment that makes each block read as raised */

    /* bevel: light from upper-left */
    var bw = Math.max(3, T * 0.09);
    if (openN || openW) {
      var lg = g.createLinearGradient(px, py, px + bw * 2, py + bw * 2);
      lg.addColorStop(0, 'rgba(148,168,200,0.30)');
      lg.addColorStop(1, 'rgba(148,168,200,0)');
      g.fillStyle = lg;
      if (openN) g.fillRect(px, py, T, bw);
      if (openW) g.fillRect(px, py, bw, T);
    }
    if (openS || openE) {
      g.fillStyle = 'rgba(0,0,0,0.55)';
      if (openS) g.fillRect(px, py + T - bw, T, bw);
      if (openE) g.fillRect(px + T - bw, py, bw, T);
    }

    /* brass hairline course at the base of exposed south faces */
    if (openS) {
      g.fillStyle = 'rgba(201,162,39,0.28)';
      g.fillRect(px, py + T - bw - 2, T, 2);
      g.fillStyle = 'rgba(255,225,150,0.16)';
      g.fillRect(px, py + T - bw - 3, T, 1);
    }
    /* engraved deco groove on wide wall faces */
    if (openS && (x + y) % 2 === 0) {
      g.strokeStyle = 'rgba(255,255,255,0.05)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(px + T * 0.22, py + T * 0.34); g.lineTo(px + T * 0.78, py + T * 0.34);
      g.moveTo(px + T * 0.30, py + T * 0.50); g.lineTo(px + T * 0.70, py + T * 0.50);
      g.stroke();
    }
  }

  function drawGlassTile(g, v, x, y) {
    var px = x * T, py = y * T;
    var tex = TX('glass.frosted');
    g.save();
    g.globalAlpha = 0.55;
    if (tex) g.drawImage(tex, (x % 2) * 64, (y % 2) * 64, 64, 64, px, py, T, T);
    else { g.fillStyle = 'rgba(150,200,220,0.18)'; g.fillRect(px, py, T, T); }
    g.restore();
    g.strokeStyle = 'rgba(180,225,240,0.28)';
    g.lineWidth = 2;
    g.strokeRect(px + 1, py + 1, T - 2, T - 2);
    g.fillStyle = 'rgba(201,162,39,0.35)';
    g.fillRect(px, py + T * 0.46, T, 3);
  }

  function drawFallbackMedallion(g, cx, cy, r) {
    g.save();
    g.translate(cx, cy);
    for (var i = 0; i < 24; i++) {
      g.rotate(PV.TAU / 24);
      g.fillStyle = i % 2 ? 'rgba(201,162,39,0.14)' : 'rgba(201,162,39,0.06)';
      g.beginPath(); g.moveTo(0, 0);
      g.arc(0, 0, r, -0.13, 0.13); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(255,215,110,0.30)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, r * 0.94, 0, PV.TAU); g.stroke();
    g.beginPath(); g.arc(0, 0, r * 0.42, 0, PV.TAU); g.stroke();
    g.restore();
  }

  /* ==================================================================
     Frame
     ================================================================== */
  R.draw = function (world, dt, hud) {
    if (!main) return;
    var time = PV.now() * 0.001;
    if (bakedId !== (world.vault.index + ':' + world.vault.id)) R.bake(world);

    var sctx = Scene.ctx;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    drawBackdrop(sctx, world, time);

    applyWorldTransform(sctx);
    sctx.imageSmoothingEnabled = true;

    /* 0 — baked static, seated on a soft outer glow so it reads as a solid
       structure sitting inside a larger dark building */
    var VW = world.vault.w * T, VH = world.vault.h * T;
    sctx.save();
    sctx.shadowColor = 'rgba(0,0,0,0.85)';
    sctx.shadowBlur = T * 1.6;
    sctx.fillStyle = 'rgba(4,6,10,1)';
    sctx.fillRect(0, 0, VW, VH);
    sctx.restore();
    sctx.drawImage(Static.canvas, 0, 0);

    /* 1 — ground particles */
    if (PV.Particles) PV.Particles.draw(sctx, 'ground');

    /* 2 — flat devices */
    drawExit(sctx, world, time);
    drawPlates(sctx, world, time);
    drawTerminals(sctx, world, time);
    drawReceivers(sctx, world, time);
    drawVents(sctx, world, time);
    drawDoors(sctx, world, time);

    /* 3/4 — actors + props, y-sorted */
    drawSortedActors(sctx, world, time);

    /* 5 — beams + emitters */
    drawLasers(sctx, world, time);
    drawMirrors(sctx, world, time);

    /* 6 — lighting */
    buildLight(world, time, hud);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'multiply';
    sctx.drawImage(darkMask(world), 0, 0, Scene.canvas.width, Scene.canvas.height);
    sctx.globalCompositeOperation = 'screen';
    sctx.drawImage(Light.canvas, 0, 0, Scene.canvas.width, Scene.canvas.height);
    sctx.globalCompositeOperation = 'source-over';

    /* 7 — sentry vision cones sit above light so they always read */
    applyWorldTransform(sctx);
    drawVisionCones(sctx, world, time);

    /* 8 — air particles */
    if (PV.Particles) PV.Particles.draw(sctx, 'air');
    drawRelicsGlow(sctx, world, time);

    sctx.setTransform(1, 0, 0, 1, 0, 0);

    /* 9 — post */
    post(world, time, hud);
  };

  /* ------------------------------------------------------------------
     Devices
     ------------------------------------------------------------------ */
  function drawExit(g, world, time) {
    var e = world.exit; if (!e) return;
    var x = e.x * T, y = e.y * T, w = e.w * T, h = e.h * T;
    var pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
    var ready = world.relicsHeldByAny === 0 ? 1 : 1;
    g.save();
    /* pad plate */
    var grd = g.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, 'rgba(255,215,110,0.10)');
    grd.addColorStop(1, 'rgba(255,215,110,0.03)');
    g.fillStyle = grd;
    g.fillRect(x, y, w, h);
    /* chevrons */
    g.strokeStyle = 'rgba(255,215,110,' + (0.25 + pulse * 0.35) + ')';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var t = ((time * 0.55 + i / 3) % 1);
      var yy = y + h * (1 - t) * 0.8 + h * 0.1;
      g.globalAlpha = Math.sin(t * Math.PI) * 0.9;
      g.beginPath();
      g.moveTo(x + w * 0.28, yy + h * 0.10);
      g.lineTo(x + w * 0.50, yy - h * 0.04);
      g.lineTo(x + w * 0.72, yy + h * 0.10);
      g.stroke();
    }
    g.globalAlpha = 1;
    /* corner brackets */
    g.strokeStyle = 'rgba(255,225,150,' + (0.5 + pulse * 0.3) + ')';
    g.lineWidth = 3;
    var c = Math.min(w, h) * 0.26;
    bracket(g, x + 4, y + 4, c, 1, 1);
    bracket(g, x + w - 4, y + 4, c, -1, 1);
    bracket(g, x + 4, y + h - 4, c, 1, -1);
    bracket(g, x + w - 4, y + h - 4, c, -1, -1);
    g.restore();
  }
  function bracket(g, x, y, c, sx, sy) {
    g.beginPath();
    g.moveTo(x + c * sx, y); g.lineTo(x, y); g.lineTo(x, y + c * sy);
    g.stroke();
  }

  function drawPlates(g, world, time) {
    for (var i = 0; i < world.plates.length; i++) {
      var p = world.plates[i];
      var x = p.x * T, y = p.y * T, r = p.r * T;
      g.save();
      g.translate(x, y);
      /* recess */
      g.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(g, -r, -r, r * 2, r * 2, r * 0.28); g.fill();
      /* plate */
      var depth = p.on ? 0.86 : 1;
      g.save();
      g.scale(depth, depth);
      var grd = g.createLinearGradient(-r, -r, r, r);
      if (p.on) { grd.addColorStop(0, '#7fffe8'); grd.addColorStop(1, '#12a08f'); }
      else { grd.addColorStop(0, '#6d7787'); grd.addColorStop(1, '#333b48'); }
      g.fillStyle = grd;
      roundRect(g, -r * 0.86, -r * 0.86, r * 1.72, r * 1.72, r * 0.22); g.fill();
      g.strokeStyle = p.on ? 'rgba(180,255,240,0.9)' : 'rgba(180,200,225,0.35)';
      g.lineWidth = 2; g.stroke();
      /* engraved cross */
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-r * 0.45, 0); g.lineTo(r * 0.45, 0);
      g.moveTo(0, -r * 0.45); g.lineTo(0, r * 0.45);
      g.stroke();
      g.restore();
      if (p.on) {
        g.globalCompositeOperation = 'lighter';
        var pg = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
        pg.addColorStop(0, 'rgba(80,255,230,0.42)');
        pg.addColorStop(1, 'rgba(80,255,230,0)');
        g.fillStyle = pg;
        g.fillRect(-r * 2.4, -r * 2.4, r * 4.8, r * 4.8);
      }
      g.restore();
    }
  }

  function drawTerminals(g, world, time) {
    for (var i = 0; i < world.terminals.length; i++) {
      var t = world.terminals[i];
      var x = t.x * T, y = t.y * T;
      var pct = t.progress / t.hold;
      g.save();
      g.translate(x, y);
      /* pedestal */
      g.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(g, -T * 0.36, -T * 0.30, T * 0.72, T * 0.66, 6); g.fill();
      var grd = g.createLinearGradient(0, -T * 0.3, 0, T * 0.36);
      grd.addColorStop(0, '#4d5666'); grd.addColorStop(1, '#232a35');
      g.fillStyle = grd;
      roundRect(g, -T * 0.32, -T * 0.30, T * 0.64, T * 0.58, 5); g.fill();
      g.strokeStyle = 'rgba(201,162,39,0.55)'; g.lineWidth = 1.5; g.stroke();
      /* screen */
      g.fillStyle = t.on ? 'rgba(30,255,190,0.28)' : 'rgba(30,180,255,0.14)';
      roundRect(g, -T * 0.24, -T * 0.22, T * 0.48, T * 0.30, 3); g.fill();
      /* scan bars */
      g.save();
      g.beginPath(); roundRect(g, -T * 0.24, -T * 0.22, T * 0.48, T * 0.30, 3); g.clip();
      g.fillStyle = t.on ? 'rgba(120,255,220,0.55)' : 'rgba(120,220,255,0.42)';
      for (var b = 0; b < 4; b++) {
        var yy = -T * 0.20 + b * T * 0.07;
        var wdt = T * 0.40 * (0.35 + 0.65 * ((Math.sin(time * 5 + b * 1.7 + t.x) + 1) / 2));
        if (t.busy || t.on) g.fillRect(-T * 0.22, yy, wdt, 2);
      }
      g.restore();
      /* progress ring */
      if (pct > 0.001) {
        g.strokeStyle = t.on ? '#7dffd0' : '#5ff0ff';
        g.lineWidth = 4; g.lineCap = 'round';
        g.beginPath();
        g.arc(0, T * 0.02, T * 0.46, -Math.PI / 2, -Math.PI / 2 + PV.TAU * Math.min(1, pct));
        g.stroke();
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = 'rgba(120,255,230,0.35)'; g.lineWidth = 9;
        g.stroke();
      }
      g.restore();
    }
  }

  function drawReceivers(g, world, time) {
    for (var i = 0; i < world.receivers.length; i++) {
      var r = world.receivers[i];
      var x = r.x * T, y = r.y * T;
      g.save(); g.translate(x, y);
      g.fillStyle = 'rgba(10,14,22,0.85)';
      g.beginPath(); g.arc(0, 0, T * 0.34, 0, PV.TAU); g.fill();
      g.strokeStyle = 'rgba(155,108,255,0.8)'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, T * 0.34, 0, PV.TAU); g.stroke();
      var c = r.charge;
      g.fillStyle = 'rgba(' + Math.round(120 + 110 * c) + ',' + Math.round(90 + 150 * c) + ',255,' + (0.35 + 0.6 * c) + ')';
      g.beginPath(); g.arc(0, 0, T * (0.10 + 0.14 * c), 0, PV.TAU); g.fill();
      if (c > 0.05) {
        g.globalCompositeOperation = 'lighter';
        var pg = g.createRadialGradient(0, 0, 0, 0, 0, T * 1.6 * c);
        pg.addColorStop(0, 'rgba(160,120,255,' + (0.5 * c) + ')');
        pg.addColorStop(1, 'rgba(160,120,255,0)');
        g.fillStyle = pg; g.fillRect(-T * 2, -T * 2, T * 4, T * 4);
      }
      g.restore();
    }
  }

  function drawVents(g, world, time) {
    for (var i = 0; i < world.vents.length; i++) {
      var v = world.vents[i];
      g.save();
      g.translate(v.x * T, v.y * T);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(g, -T * 0.42, -T * 0.42, T * 0.84, T * 0.84, 4); g.fill();
      g.strokeStyle = 'rgba(140,160,190,0.5)'; g.lineWidth = 2;
      for (var s = -2; s <= 2; s++) {
        g.beginPath(); g.moveTo(-T * 0.34, s * T * 0.15); g.lineTo(T * 0.34, s * T * 0.15); g.stroke();
      }
      g.restore();
    }
  }

  function drawDoors(g, world, time) {
    for (var i = 0; i < world.doors.length; i++) {
      var d = world.doors[i];
      var a = d.anim;
      for (var k = 0; k < d.tiles.length; k++) {
        var tl = d.tiles[k];
        var x = tl.x * T, y = tl.y * T;
        g.save();
        /* frame */
        g.fillStyle = 'rgba(6,9,14,0.9)';
        g.fillRect(x, y, T, T);
        g.strokeStyle = 'rgba(201,162,39,0.55)';
        g.lineWidth = 3;
        g.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3);
        /* two sliding leaves */
        var travel = (T / 2) * a;
        var horiz = d.axis === 'h';
        g.save();
        g.beginPath(); g.rect(x, y, T, T); g.clip();
        for (var s = 0; s < 2; s++) {
          var off = (s === 0 ? -1 : 1) * travel;
          var lx = horiz ? x : x + off;
          var ly = horiz ? y + off : y;
          var lw = horiz ? T : T / 2;
          var lh = horiz ? T / 2 : T;
          if (horiz) { ly = y + (s === 0 ? -travel : T / 2 + travel); }
          else { lx = x + (s === 0 ? -travel : T / 2 + travel); ly = y; }
          var grd = g.createLinearGradient(lx, ly, lx + lw, ly + lh);
          grd.addColorStop(0, '#3b4351'); grd.addColorStop(0.5, '#20262f'); grd.addColorStop(1, '#171c24');
          g.fillStyle = grd;
          g.fillRect(lx, ly, lw, lh);
          g.fillStyle = 'rgba(201,162,39,0.5)';
          if (horiz) g.fillRect(lx, s === 0 ? ly + lh - 3 : ly, lw, 3);
          else g.fillRect(s === 0 ? lx + lw - 3 : lx, ly, 3, lh);
          /* engraved deco chevron */
          g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 2;
          g.beginPath();
          if (horiz) { g.moveTo(lx + T * 0.25, ly + lh * 0.5); g.lineTo(lx + T * 0.5, ly + lh * 0.25); g.lineTo(lx + T * 0.75, ly + lh * 0.5); }
          else { g.moveTo(lx + lw * 0.5, ly + T * 0.25); g.lineTo(lx + lw * 0.25, ly + T * 0.5); g.lineTo(lx + lw * 0.5, ly + T * 0.75); }
          g.stroke();
        }
        g.restore();
        /* status light */
        var col = d.open ? '#7dffd0' : '#ff6a5c';
        g.fillStyle = col;
        g.beginPath(); g.arc(x + T * 0.5, y + T * 0.5, 3.2, 0, PV.TAU); g.fill();
        g.globalCompositeOperation = 'lighter';
        var lg = g.createRadialGradient(x + T * 0.5, y + T * 0.5, 0, x + T * 0.5, y + T * 0.5, T * 0.6);
        lg.addColorStop(0, PV.rgba(col === '#7dffd0' ? '#7dffd0' : '#ff6a5c', 0.35));
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = lg; g.fillRect(x - T * 0.2, y - T * 0.2, T * 1.4, T * 1.4);
        g.restore();
      }
    }
  }

  /* ------------------------------------------------------------------
     Lasers & mirrors
     ------------------------------------------------------------------ */
  function drawLasers(g, world, time) {
    g.save();
    for (var i = 0; i < world.lasers.length; i++) {
      var L = world.lasers[i];
      /* emitter housing */
      var ex = (L.x + 0.5) * T, ey = (L.y + 0.5) * T;
      g.save(); g.translate(ex, ey);
      g.fillStyle = '#1a1f28';
      roundRect(g, -T * 0.28, -T * 0.28, T * 0.56, T * 0.56, 5); g.fill();
      g.strokeStyle = 'rgba(190,205,230,0.35)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = L.on ? '#ff5c72' : '#40202a';
      g.beginPath(); g.arc(L.dx * T * 0.2, L.dy * T * 0.2, T * 0.11, 0, PV.TAU); g.fill();
      g.restore();

      if (!L.on || !L.path.length) continue;
      var hot = L.beamKind === 'soft' ? '#b98cff' : '#ff506b';
      var core = L.beamKind === 'soft' ? '#eadcff' : '#fff0f2';

      /* outer bloom pass */
      g.globalCompositeOperation = 'lighter';
      for (var pass = 0; pass < 3; pass++) {
        var wdt = [T * 0.36, T * 0.16, T * 0.05][pass];
        var alpha = [0.16, 0.32, 0.95][pass];
        g.strokeStyle = pass === 2 ? core : PV.rgba(hot, alpha);
        if (pass === 2) g.globalAlpha = 0.95; else g.globalAlpha = 1;
        g.lineWidth = wdt;
        g.lineCap = 'round';
        g.beginPath();
        for (var s = 0; s < L.path.length; s++) {
          var seg = L.path[s];
          g.moveTo(seg.x1 * T, seg.y1 * T);
          g.lineTo(seg.x2 * T, seg.y2 * T);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
      /* travelling energy pips */
      for (var s2 = 0; s2 < L.path.length; s2++) {
        var sg = L.path[s2];
        var len = PV.dist(sg.x1, sg.y1, sg.x2, sg.y2);
        var n = Math.max(1, Math.floor(len * 1.2));
        for (var q = 0; q < n; q++) {
          var tq = ((q / n) + (time * 0.55)) % 1;
          var px = PV.lerp(sg.x1, sg.x2, tq) * T, py = PV.lerp(sg.y1, sg.y2, tq) * T;
          g.fillStyle = PV.rgba(core, 0.55);
          g.beginPath(); g.arc(px, py, T * 0.045, 0, PV.TAU); g.fill();
        }
      }
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  }

  function drawMirrors(g, world, time) {
    for (var i = 0; i < world.mirrors.length; i++) {
      var m = world.mirrors[i];
      var x = m.x * T, y = m.y * T, r = m.radius * T;
      g.save();
      g.translate(x, y);
      /* shadow */
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath(); g.ellipse(2, r * 0.5, r * 1.05, r * 0.5, 0, 0, PV.TAU); g.fill();
      /* brass frame */
      g.rotate(m.ori === '/' ? -Math.PI / 4 : Math.PI / 4);
      var grd = g.createLinearGradient(-r, 0, r, 0);
      grd.addColorStop(0, '#8a6f1c'); grd.addColorStop(0.45, '#e8c964'); grd.addColorStop(1, '#6b5514');
      g.fillStyle = grd;
      roundRect(g, -r * 1.25, -r * 0.30, r * 2.5, r * 0.60, r * 0.18); g.fill();
      /* mirror face */
      var mg = g.createLinearGradient(-r, -r * 0.2, r, r * 0.2);
      mg.addColorStop(0, '#d8f3ff'); mg.addColorStop(0.4, '#7fb6cc'); mg.addColorStop(0.6, '#e9fbff'); mg.addColorStop(1, '#5f8ea3');
      g.fillStyle = mg;
      roundRect(g, -r * 1.12, -r * 0.16, r * 2.24, r * 0.32, r * 0.10); g.fill();
      /* specular sweep */
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,255,255,' + (0.15 + 0.15 * Math.sin(time * 1.7 + i)) + ')';
      roundRect(g, -r * 1.12, -r * 0.16, r * 0.7, r * 0.32, r * 0.1); g.fill();
      g.restore();
      m.fxHit = Math.max(0, m.fxHit - 0.06);
    }
  }

  /* ------------------------------------------------------------------
     Actors, sentries and props (y-sorted)
     ------------------------------------------------------------------ */
  var sortBuf = [];
  function drawSortedActors(g, world, time) {
    sortBuf.length = 0;
    var i;
    for (i = 0; i < world.echoes.length; i++) {
      var e = world.echoes[i];
      if (e.active || e.tick < e.rec.length) sortBuf.push({ y: e.y, k: 'echo', o: e });
    }
    for (i = 0; i < world.sentries.length; i++) sortBuf.push({ y: world.sentries[i].y, k: 'sentry', o: world.sentries[i] });
    for (i = 0; i < world.relics.length; i++) {
      var rl = world.relics[i];
      if (!rl.banked) sortBuf.push({ y: rl.y, k: 'relic', o: rl });
    }
    for (i = 0; i < world.props.length; i++) sortBuf.push({ y: world.props[i].y, k: 'prop', o: world.props[i] });
    if (world.player && world.player.alive) sortBuf.push({ y: world.player.y, k: 'player', o: world.player });

    sortBuf.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < sortBuf.length; i++) {
      var it = sortBuf[i];
      if (it.k === 'echo') drawEcho(g, it.o, time);
      else if (it.k === 'sentry') drawSentry(g, it.o, time);
      else if (it.k === 'relic') drawRelic(g, it.o, time);
      else if (it.k === 'prop') drawProp(g, it.o, time);
      else drawPlayer(g, it.o, world, time);
    }
  }

  function contactShadow(g, x, y, r, a) {
    g.save();
    var grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(0,0,0,' + a + ')');
    grd.addColorStop(0.6, 'rgba(0,0,0,' + a * 0.45 + ')');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(x, y, r, r * 0.52, 0, 0, PV.TAU); g.fill();
    g.restore();
  }

  /* ------------------------------------------------------------------
     The thief.

     Drawn from primitives in a local frame where +Y is "forward" (the
     direction the character faces), so limb maths reads naturally: the
     whole figure is rotated by `facing + PI/2` on the way in. Body parts
     are stacked back-to-front: coat tail, legs, torso, arms, shoulders,
     head, hat, then the rim light.
     ------------------------------------------------------------------ */
  function drawFigure(g, x, y, facing, opt, gait, speed) {
    var s = opt.scale || 1;
    var R0 = T * 0.40 * s;
    gait = gait || 0;
    speed = speed || 0;
    var stride = PV.clamp(speed / 5.0, 0, 1);
    var swing = Math.sin(gait) * stride;
    var bounce = Math.abs(Math.cos(gait)) * stride * R0 * 0.055;

    g.save();
    g.translate(x, y - bounce);

    /* dark separation halo so the silhouette always reads on a busy floor */
    if (opt.halo !== false) {
      var hg = g.createRadialGradient(0, 0, R0 * 0.62, 0, 0, R0 * 1.85);
      hg.addColorStop(0, 'rgba(0,0,0,0.40)');
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = hg;
      g.fillRect(-R0 * 2, -R0 * 2, R0 * 4, R0 * 4);
    }

    g.rotate(facing + Math.PI / 2);   /* local +Y == forward */

    var W = R0 * 0.62;    /* half shoulder width */
    var D = R0 * 0.44;    /* half body depth     */

    /* ---- coat tail, trailing behind and flaring with speed ---- */
    g.fillStyle = opt.coatDark;
    g.beginPath();
    g.moveTo(-W * 0.95, -D * 0.15);
    g.quadraticCurveTo(-W * (1.25 + stride * 0.35), -D * (1.5 + stride * 1.1),
      -W * 0.25 + swing * W * 0.30, -D * (2.0 + stride * 1.3));
    g.quadraticCurveTo(W * 0.25 + swing * W * 0.30, -D * (2.15 + stride * 1.3),
      W * (1.25 + stride * 0.35), -D * (1.5 + stride * 1.1));
    g.lineTo(W * 0.95, -D * 0.15);
    g.closePath();
    g.fill();

    /* ---- legs ---- */
    var legL = -swing, legR = swing;
    g.fillStyle = opt.legs;
    legEllipse(g, -W * 0.40, D * 0.28 + legL * R0 * 0.30, R0 * 0.17, R0 * 0.30);
    legEllipse(g, W * 0.40, D * 0.28 + legR * R0 * 0.30, R0 * 0.17, R0 * 0.30);
    /* shoes catch the key light */
    g.fillStyle = opt.shoe;
    legEllipse(g, -W * 0.40, D * 0.40 + legL * R0 * 0.34, R0 * 0.13, R0 * 0.17);
    legEllipse(g, W * 0.40, D * 0.40 + legR * R0 * 0.34, R0 * 0.13, R0 * 0.17);

    /* ---- torso ---- */
    var bodyG = g.createLinearGradient(-W, -D, W * 0.6, D);
    bodyG.addColorStop(0, opt.coatLight);
    bodyG.addColorStop(0.5, opt.coat);
    bodyG.addColorStop(1, opt.coatDark);
    g.fillStyle = bodyG;
    g.beginPath();
    /* a rounded trapezoid: broad shoulders tapering to the waist */
    g.moveTo(-W, -D * 0.55);
    g.quadraticCurveTo(-W * 1.06, D * 0.30, -W * 0.66, D * 0.62);
    g.lineTo(W * 0.66, D * 0.62);
    g.quadraticCurveTo(W * 1.06, D * 0.30, W, -D * 0.55);
    g.quadraticCurveTo(0, -D * 1.05, -W, -D * 0.55);
    g.closePath();
    g.fill();

    /* coat opening + gold trim down the front */
    g.strokeStyle = opt.trim;
    g.lineWidth = Math.max(1, R0 * 0.055);
    g.beginPath();
    g.moveTo(0, -D * 0.72); g.lineTo(0, D * 0.58);
    g.stroke();
    g.fillStyle = opt.trim;
    g.beginPath(); g.arc(0, -D * 0.18, R0 * 0.045, 0, PV.TAU); g.fill();
    g.beginPath(); g.arc(0, D * 0.20, R0 * 0.045, 0, PV.TAU); g.fill();

    /* ---- arms, swinging opposite the legs ---- */
    g.fillStyle = opt.coat;
    armEllipse(g, -W * 1.00, -legL * R0 * 0.24, R0 * 0.16, R0 * 0.26, -0.22);
    armEllipse(g, W * 1.00, -legR * R0 * 0.24, R0 * 0.16, R0 * 0.26, 0.22);
    g.fillStyle = opt.skin;
    g.beginPath(); g.arc(-W * 1.02, -legL * R0 * 0.24 + R0 * 0.22, R0 * 0.10, 0, PV.TAU); g.fill();
    g.beginPath(); g.arc(W * 1.02, -legR * R0 * 0.24 + R0 * 0.22, R0 * 0.10, 0, PV.TAU); g.fill();

    /* ---- shoulder yoke ---- */
    g.strokeStyle = opt.trim;
    g.lineWidth = Math.max(1, R0 * 0.07);
    g.beginPath();
    g.moveTo(-W * 0.94, -D * 0.50);
    g.quadraticCurveTo(0, -D * 0.94, W * 0.94, -D * 0.50);
    g.stroke();

    /* ---- head ---- */
    g.fillStyle = opt.skin;
    g.beginPath(); g.arc(0, -D * 0.95, R0 * 0.30, 0, PV.TAU); g.fill();
    /* scarf over the lower face */
    g.fillStyle = opt.scarf;
    g.beginPath();
    g.ellipse(0, -D * 0.80, R0 * 0.30, R0 * 0.17, 0, 0, PV.TAU);
    g.fill();

    /* ---- fedora: brim then crown, lit from the upper-left ---- */
    var brimG = g.createLinearGradient(-R0 * 0.5, -D * 1.4, R0 * 0.4, -D * 0.5);
    brimG.addColorStop(0, opt.hatTop);
    brimG.addColorStop(1, opt.hat);
    g.fillStyle = brimG;
    g.beginPath();
    g.ellipse(0, -D * 1.00, R0 * 0.52, R0 * 0.44, 0, 0, PV.TAU);
    g.fill();
    g.fillStyle = opt.hatTop;
    g.beginPath();
    g.ellipse(0, -D * 1.10, R0 * 0.31, R0 * 0.26, 0, 0, PV.TAU);
    g.fill();
    /* pinched crease */
    g.strokeStyle = opt.hat;
    g.lineWidth = Math.max(1, R0 * 0.05);
    g.beginPath();
    g.moveTo(-R0 * 0.10, -D * 1.22); g.lineTo(-R0 * 0.10, -D * 0.99);
    g.moveTo(R0 * 0.10, -D * 1.22); g.lineTo(R0 * 0.10, -D * 0.99);
    g.stroke();
    /* hat band */
    g.strokeStyle = opt.trim;
    g.lineWidth = Math.max(1, R0 * 0.07);
    g.beginPath();
    g.ellipse(0, -D * 1.02, R0 * 0.34, R0 * 0.29, 0, 0, PV.TAU);
    g.stroke();

    /* ---- eyes: the only bright point, so the facing reads instantly ---- */
    g.fillStyle = opt.eye;
    g.beginPath(); g.ellipse(-R0 * 0.11, -D * 0.86, R0 * 0.055, R0 * 0.038, 0, 0, PV.TAU); g.fill();
    g.beginPath(); g.ellipse(R0 * 0.11, -D * 0.86, R0 * 0.055, R0 * 0.038, 0, 0, PV.TAU); g.fill();

    /* ---- rim light, always from world upper-left ---- */
    g.save();
    g.rotate(-(facing + Math.PI / 2));
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = opt.rim;
    g.lineWidth = Math.max(1.2, R0 * 0.10);
    g.lineCap = 'round';
    g.beginPath();
    g.ellipse(0, -R0 * 0.12, R0 * 0.70, R0 * 0.74, 0, Math.PI * 0.80, Math.PI * 1.70);
    g.stroke();
    g.restore();

    g.restore();
  }

  function legEllipse(g, x, y, rx, ry) {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, PV.TAU); g.fill();
  }
  function armEllipse(g, x, y, rx, ry, rot) {
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, PV.TAU); g.fill();
  }

  function drawPlayer(g, p, world, time) {
    var x = p.x * T, y = p.y * T;
    var sp = PV.len(p.vx, p.vy);

    contactShadow(g, x, y + T * 0.32, T * 0.44, 0.58);

    /* dash after-images */
    if (p.dashT > 0) {
      for (var i = 1; i <= 3; i++) {
        g.save();
        g.globalAlpha = 0.22 * (1 - i / 4);
        drawFigure(g, x - p.vx * T * 0.018 * i, y - p.vy * T * 0.018 * i, p.facing, PLAYER_STYLE, p.gait, sp);
        g.restore();
      }
    }

    drawFigure(g, x, y, p.facing, PLAYER_STYLE, p.gait, sp);

    /* carried relic is held out in front, in both hands */
    if (p.carrying) {
      var cx = x + Math.cos(p.facing) * T * 0.30;
      var cy = y + Math.sin(p.facing) * T * 0.30 - T * 0.22 + Math.sin(time * 3) * T * 0.02;
      drawRelicSprite(g, cx, cy, p.carrying.kind, T * 0.46, time, 1);
    }
  }

  var PLAYER_STYLE = {
    coat: '#3f4d73', coatLight: '#7888b4', coatDark: '#171d2f',
    trim: 'rgba(240,200,90,0.95)', hat: '#1b2234', hatTop: '#39445f',
    skin: '#d8b892', scarf: '#5a2030', legs: '#232a3e', shoe: '#0e1220',
    eye: '#fff6d0', rim: 'rgba(185,225,255,0.90)', scale: 1
  };

  var ECHO_STYLE = {
    coat: 'rgba(34,150,178,0.60)', coatLight: 'rgba(130,245,255,0.62)', coatDark: 'rgba(10,68,94,0.55)',
    trim: 'rgba(170,252,255,0.80)', hat: 'rgba(14,86,112,0.60)', hatTop: 'rgba(44,158,188,0.58)',
    skin: 'rgba(150,238,255,0.58)', scarf: 'rgba(70,200,225,0.50)',
    legs: 'rgba(20,110,140,0.55)', shoe: 'rgba(10,70,95,0.6)',
    eye: 'rgba(230,255,255,0.95)', rim: 'rgba(130,248,255,0.60)', scale: 0.97
  };

  function drawEcho(g, e, time) {
    var x = e.x * T, y = e.y * T;
    var fade = e.active ? 1 : 0;
    if (!e.active) return;
    var scan = 0.72 + 0.28 * Math.sin(time * 40 + e.index * 2.3);
    var glitch = e.desync;

    var esp = PV.len(e.vx, e.vy);
    g.save();
    contactShadow(g, x, y + T * 0.30, T * 0.36, 0.30);

    /* trailing after-image */
    g.globalAlpha = 0.16;
    drawFigure(g, x - e.vx * T * 0.02, y - e.vy * T * 0.02, e.facing, ECHO_STYLE, e.gait, esp);
    g.globalAlpha = 1;

    /* chromatic split grows with desync */
    var split = (0.6 + glitch * 4.5);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.32 * scan;
    g.save(); g.translate(-split, 0);
    drawFigureTint(g, x, y, e.facing, 'rgba(255,60,120,0.55)');
    g.restore();
    g.save(); g.translate(split, 0);
    drawFigureTint(g, x, y, e.facing, 'rgba(60,255,220,0.55)');
    g.restore();
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    g.globalAlpha = (0.62 + 0.28 * scan) * (1 - glitch * 0.25);
    drawFigure(g, x, y, e.facing, ECHO_STYLE, e.gait, esp);
    g.globalAlpha = 1;

    /* scanlines clipped to the figure bounds */
    g.save();
    g.beginPath();
    g.ellipse(x, y - T * 0.08, T * 0.44, T * 0.52, 0, 0, PV.TAU);
    g.clip();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(120,240,255,0.10)';
    var off = (time * 90) % 6;
    for (var sy = -T * 0.6; sy < T * 0.6; sy += 6) {
      g.fillRect(x - T * 0.5, y + sy + off, T, 2);
    }
    g.restore();

    /* index tag ring */
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(95,240,255,' + (0.30 + 0.2 * scan) + ')';
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, y + T * 0.28, T * 0.34, T * 0.16, 0, 0, PV.TAU); g.stroke();
    g.restore();

    if (e.carrying) {
      drawRelicSprite(g, x + Math.cos(e.facing) * T * 0.30,
        y + Math.sin(e.facing) * T * 0.30 - T * 0.22, e.carrying.kind, T * 0.42, time, 0.55);
    }
    g.restore();
  }

  function drawFigureTint(g, x, y, facing, color) {
    var R0 = T * 0.30;
    g.fillStyle = color;
    g.beginPath(); g.ellipse(x, y, R0 * 0.98, R0 * 0.86, facing, 0, PV.TAU); g.fill();
    var fx = Math.cos(facing), fy = Math.sin(facing);
    g.beginPath(); g.ellipse(x + fx * R0 * 0.30, y + fy * R0 * 0.30 - R0 * 0.22, R0 * 0.55, R0 * 0.46, facing, 0, PV.TAU); g.fill();
  }

  function drawSentry(g, s, time) {
    var x = s.x * T, y = s.y * T;
    contactShadow(g, x, y + T * 0.30, T * 0.44, 0.55);
    var alarm = s.suspicion;

    g.save();
    g.translate(x, y);
    g.rotate(s.dirAngle + Math.PI / 2);

    /* hover skirt */
    var skirt = g.createRadialGradient(0, T * 0.12, 0, 0, T * 0.12, T * 0.5);
    skirt.addColorStop(0, 'rgba(120,190,255,0.20)');
    skirt.addColorStop(1, 'rgba(120,190,255,0)');
    g.fillStyle = skirt;
    g.beginPath(); g.ellipse(0, T * 0.14, T * 0.5, T * 0.22, 0, 0, PV.TAU); g.fill();

    /* chassis */
    var bg = g.createLinearGradient(-T * 0.3, -T * 0.34, T * 0.3, T * 0.3);
    bg.addColorStop(0, '#59657a'); bg.addColorStop(0.5, '#333c4c'); bg.addColorStop(1, '#1b212c');
    g.fillStyle = bg;
    roundRect(g, -T * 0.30, -T * 0.36, T * 0.60, T * 0.68, T * 0.16); g.fill();
    g.strokeStyle = 'rgba(201,162,39,0.5)'; g.lineWidth = 2; g.stroke();

    /* head / lens */
    g.fillStyle = '#0d1016';
    roundRect(g, -T * 0.20, -T * 0.44, T * 0.40, T * 0.26, T * 0.10); g.fill();
    var lens = PV.mixHex('#5ff0ff', '#ff4a3c', alarm);
    g.fillStyle = lens;
    g.beginPath(); g.ellipse(0, -T * 0.31, T * 0.12, T * 0.075, 0, 0, PV.TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
    var lg = g.createRadialGradient(0, -T * 0.31, 0, 0, -T * 0.31, T * 0.55);
    lg.addColorStop(0, PV.rgba(lens, 0.55));
    lg.addColorStop(1, PV.rgba(lens, 0));
    g.fillStyle = lg; g.fillRect(-T * 0.6, -T * 0.9, T * 1.2, T * 1.2);
    g.globalCompositeOperation = 'source-over';

    /* shoulder vanes */
    g.fillStyle = '#242c38';
    roundRect(g, -T * 0.44, -T * 0.16, T * 0.14, T * 0.34, 3); g.fill();
    roundRect(g, T * 0.30, -T * 0.16, T * 0.14, T * 0.34, 3); g.fill();

    /* alert klaxon */
    if (alarm > 0.05) {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,90,60,' + (0.25 + 0.5 * alarm * (0.6 + 0.4 * Math.sin(time * 14))) + ')';
      g.beginPath(); g.arc(0, -T * 0.44, T * 0.09, 0, PV.TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  }

  function drawVisionCones(g, world, time) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < world.sentries.length; i++) {
      var s = world.sentries[i];
      var x = s.x * T, y = s.y * T;
      var range = s.cone.range * T;
      var a0 = s.dirAngle - s.cone.angle, a1 = s.dirAngle + s.cone.angle;
      var col = s.suspicion > 0.5 ? [255, 90, 70] : (s.suspicion > 0.12 ? [255, 190, 90] : [120, 200, 255]);
      var base = 0.055 + s.suspicion * 0.14;

      /* raycast the silhouette so the cone respects walls */
      g.beginPath();
      g.moveTo(x, y);
      var STEPS = 34;
      for (var k = 0; k <= STEPS; k++) {
        var a = PV.lerp(a0, a1, k / STEPS);
        var d = castRay(world, s.x, s.y, a, s.cone.range);
        g.lineTo(x + Math.cos(a) * d * T, y + Math.sin(a) * d * T);
      }
      g.closePath();
      var grd = g.createRadialGradient(x, y, 0, x, y, range);
      grd.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (base * 2.4) + ')');
      grd.addColorStop(0.55, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + base + ')');
      grd.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)');
      g.fillStyle = grd;
      g.fill();

      /* sweeping scan line inside the cone */
      var sweep = a0 + (a1 - a0) * (0.5 + 0.5 * Math.sin(time * 1.9 + i * 2.1));
      var sd = castRay(world, s.x, s.y, sweep, s.cone.range);
      g.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (0.10 + s.suspicion * 0.25) + ')';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(sweep) * sd * T, y + Math.sin(sweep) * sd * T); g.stroke();
    }
    g.restore();
  }

  function castRay(world, x, y, ang, maxD) {
    var dx = Math.cos(ang), dy = Math.sin(ang);
    var step = 0.22, d = 0;
    while (d < maxD) {
      d += step;
      if (PV.opaqueAt(world, Math.floor(x + dx * d), Math.floor(y + dy * d))) return d - step * 0.5;
    }
    return maxD;
  }

  /* ------------------------------------------------------------------
     Relics + props
     ------------------------------------------------------------------ */
  function drawRelic(g, r, time) {
    if (r.held) return;
    var x = r.x * T, y = r.y * T;
    var bob = Math.sin(time * 1.8 + r.id) * T * 0.07;
    contactShadow(g, x, y + T * 0.26, T * 0.30, 0.45);
    /* pedestal */
    g.save();
    g.fillStyle = 'rgba(12,16,24,0.85)';
    g.beginPath(); g.ellipse(x, y + T * 0.20, T * 0.30, T * 0.13, 0, 0, PV.TAU); g.fill();
    g.strokeStyle = 'rgba(201,162,39,0.5)'; g.lineWidth = 2; g.stroke();
    g.restore();
    drawRelicSprite(g, x, y - T * 0.16 + bob, r.kind, T * 0.62 * (r.heavy ? 1.25 : 1), time, 1);
  }

  function drawRelicSprite(g, x, y, kind, size, time, alpha) {
    var tex = TX('icon.relic.' + kind);
    g.save();
    g.globalAlpha = alpha === undefined ? 1 : alpha;
    if (tex) {
      g.drawImage(tex, x - size / 2, y - size / 2, size, size);
    } else {
      /* fallback jewel */
      var grd = g.createLinearGradient(x - size / 2, y - size / 2, x + size / 2, y + size / 2);
      grd.addColorStop(0, '#fff0b8'); grd.addColorStop(0.5, '#e8b93a'); grd.addColorStop(1, '#7a5c10');
      g.fillStyle = grd;
      g.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = -Math.PI / 2 + i * PV.TAU / 6;
        var px = x + Math.cos(a) * size * 0.42, py = y + Math.sin(a) * size * 0.42;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,240,190,0.7)'; g.lineWidth = 2; g.stroke();
    }
    g.restore();
  }

  function drawRelicsGlow(g, world, time) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < world.relics.length; i++) {
      var r = world.relics[i];
      if (r.banked) continue;
      var x = (r.held ? r.held.x : r.x) * T;
      var y = (r.held ? r.held.y - 0.42 : r.y - 0.16) * T;
      var pulse = 0.55 + 0.45 * Math.sin(time * 2.4 + i);
      var rad = T * (r.heavy ? 2.2 : 1.4) * (0.85 + 0.15 * pulse);
      var grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(255,214,120,' + (0.085 * pulse) + ')');
      grd.addColorStop(0.4, 'rgba(255,190,80,' + (0.030 * pulse) + ')');
      grd.addColorStop(1, 'rgba(255,180,60,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      /* sparkle cross */
      if (!r.held) {
        var sp = (0.4 + 0.6 * Math.abs(Math.sin(time * 1.3 + i * 2))) * T * 0.9;
        g.strokeStyle = 'rgba(255,240,200,' + (0.22 * pulse) + ')';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x - sp, y); g.lineTo(x + sp, y);
        g.moveTo(x, y - sp); g.lineTo(x, y + sp);
        g.stroke();
      }
    }
    g.restore();
  }

  function drawProp(g, p, time) {
    var x = p.x * T, y = p.y * T;
    var tex = TX('prop.' + p.kind);
    if (tex) {
      var w = tex.width * (T / 64) * 0.92, h = tex.height * (T / 64) * 0.92;
      contactShadow(g, x, y + h * 0.30, w * 0.45, 0.5);
      g.drawImage(tex, x - w / 2, y - h * 0.62, w, h);
      return;
    }
    /* fallbacks */
    contactShadow(g, x, y + T * 0.28, T * 0.42, 0.5);
    g.save();
    g.translate(x, y);
    if (p.kind === 'column') {
      var cg = g.createLinearGradient(-T * 0.34, 0, T * 0.34, 0);
      cg.addColorStop(0, '#39404e'); cg.addColorStop(0.4, '#8b93a5'); cg.addColorStop(0.65, '#5b6474'); cg.addColorStop(1, '#2a303c');
      g.fillStyle = cg;
      g.beginPath(); g.ellipse(0, -T * 0.1, T * 0.36, T * 0.34, 0, 0, PV.TAU); g.fill();
      g.strokeStyle = 'rgba(201,162,39,0.6)'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(0, -T * 0.1, T * 0.36, T * 0.34, 0, 0, PV.TAU); g.stroke();
      for (var f = -3; f <= 3; f++) {
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(f * T * 0.09, -T * 0.4); g.lineTo(f * T * 0.09, T * 0.2); g.stroke();
      }
    } else if (p.kind === 'crate') {
      g.fillStyle = '#4a3720';
      roundRect(g, -T * 0.36, -T * 0.36, T * 0.72, T * 0.72, 4); g.fill();
      g.strokeStyle = '#6d5330'; g.lineWidth = 4; g.stroke();
      g.strokeStyle = 'rgba(180,150,90,0.35)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-T * 0.3, -T * 0.3); g.lineTo(T * 0.3, T * 0.3); g.moveTo(T * 0.3, -T * 0.3); g.lineTo(-T * 0.3, T * 0.3); g.stroke();
    } else if (p.kind === 'plant') {
      g.fillStyle = '#2a2016';
      g.beginPath(); g.ellipse(0, T * 0.16, T * 0.24, T * 0.14, 0, 0, PV.TAU); g.fill();
      for (var l = 0; l < 9; l++) {
        var a = l / 9 * PV.TAU + Math.sin(time * 0.6 + l) * 0.06;
        g.fillStyle = l % 2 ? '#245c39' : '#1c4a2e';
        g.save(); g.rotate(a);
        g.beginPath(); g.ellipse(0, -T * 0.28, T * 0.09, T * 0.28, 0, 0, PV.TAU); g.fill();
        g.restore();
      }
    } else if (p.kind === 'bench') {
      g.fillStyle = '#3a2a18';
      roundRect(g, -T * 0.62, -T * 0.20, T * 1.24, T * 0.40, 6); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(g, -T * 0.60, -T * 0.18, T * 1.20, T * 0.12, 5); g.fill();
      g.strokeStyle = 'rgba(201,162,39,0.4)'; g.lineWidth = 2; g.stroke();
    } else if (p.kind === 'vitrine') {
      g.fillStyle = 'rgba(20,26,34,0.85)';
      roundRect(g, -T * 0.34, -T * 0.44, T * 0.68, T * 0.80, 4); g.fill();
      g.fillStyle = 'rgba(150,215,240,0.13)';
      roundRect(g, -T * 0.30, -T * 0.40, T * 0.60, T * 0.66, 3); g.fill();
      g.strokeStyle = 'rgba(201,162,39,0.55)'; g.lineWidth = 2.5; g.stroke();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.beginPath(); g.moveTo(-T * 0.28, T * 0.24); g.lineTo(T * 0.02, -T * 0.38); g.lineTo(T * 0.16, -T * 0.38); g.lineTo(-T * 0.14, T * 0.24); g.closePath(); g.fill();
    }
    g.restore();
  }

  /* ==================================================================
     Lighting
     ================================================================== */
  var darkCache = null, darkKey = '';
  function darkMask(world) {
    var k = world.vault.id + ':' + Scene.canvas.width;
    if (darkCache && darkKey === k) return darkCache.canvas;
    var c = PV.makeCanvas(64, 64, { alpha: false });
    /* Uniform ambient floor — the light buffer adds everything back on top.
       Keep this bright enough that unlit geometry still reads as material,
       not as a black hole. */
    c.ctx.fillStyle = '#666d7e';
    c.ctx.fillRect(0, 0, 64, 64);
    darkCache = c; darkKey = k;
    return c.canvas;
  }

  function buildLight(world, time, hud) {
    var lc = Light.ctx;
    var lw = Light.canvas.width, lh = Light.canvas.height;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = '#000';
    lc.fillRect(0, 0, lw, lh);

    var s = cam.scale * view.dpr * 0.5;
    lc.setTransform(s, 0, 0, s,
      (view.w / 2 - (cam.x + cam.shakeX) * cam.scale) * view.dpr * 0.5,
      (view.h / 2 - (cam.y + cam.shakeY) * cam.scale) * view.dpr * 0.5);
    lc.globalCompositeOperation = 'lighter';

    var i;

    /* skylights: soft shafts of moonlight */
    for (i = 0; i < world.skylights.length; i++) {
      var sk = world.skylights[i];
      var x = sk.x * T, y = sk.y * T, w = sk.w * T, h = sk.h * T;
      var flick = 0.92 + 0.08 * Math.sin(time * 0.7 + i);
      var grd = lc.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.72);
      var inten = sk.intensity * flick;
      grd.addColorStop(0, 'rgba(150,190,235,' + (0.34 * inten) + ')');
      grd.addColorStop(0.5, 'rgba(110,150,205,' + (0.15 * inten) + ')');
      grd.addColorStop(1, 'rgba(70,100,160,0)');
      lc.fillStyle = grd;
      lc.fillRect(x - w * 0.5, y - h * 0.5, w * 2, h * 2);
      /* window mullion pattern */
      var caus = TX('decal.caustic');
      if (caus) {
        lc.save();
        lc.globalAlpha = 0.22 * inten;
        lc.drawImage(caus, x, y, w, h);
        lc.restore();
      }
    }

    /* lamps */
    for (i = 0; i < world.lamps.length; i++) {
      var L = world.lamps[i];
      var lx = L.x * T, ly = L.y * T, lr = L.radius * T;
      var fl = 0.94 + 0.06 * Math.sin(time * (3.1 + i * 0.7) + i * 2.3) + 0.02 * Math.sin(time * 17 + i);
      var g2 = lc.createRadialGradient(lx, ly, 0, lx, ly, lr);
      g2.addColorStop(0, PV.rgba(L.color, 0.62 * L.intensity * fl));
      g2.addColorStop(0.35, PV.rgba(L.color, 0.30 * L.intensity * fl));
      g2.addColorStop(1, PV.rgba(L.color, 0));
      lc.fillStyle = g2;
      lc.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
    }

    /* player + echo lanterns (donut profile — see lightRing) */
    lightRing(lc, world.player.x * T, world.player.y * T,
      T * (world.player.carrying ? PV.TUNE.lightRadiusCarry : PV.TUNE.lightRadiusBase),
      world.player.carrying ? '#ffd76e' : '#9fc4ff', 0.34, T * 0.55);
    for (i = 0; i < world.echoes.length; i++) {
      var e = world.echoes[i];
      if (!e.active) continue;
      lightRing(lc, e.x * T, e.y * T, T * 1.6, '#5ff0ff', 0.22, T * 0.48);
    }

    /* device lights */
    for (i = 0; i < world.plates.length; i++) {
      if (world.plates[i].on) lightBlob(lc, world.plates[i].x * T, world.plates[i].y * T, T * 1.6, '#4affd8', 0.45);
    }
    for (i = 0; i < world.terminals.length; i++) {
      var tm = world.terminals[i];
      lightBlob(lc, tm.x * T, tm.y * T, T * 1.3, tm.on ? '#7dffd0' : '#4fb8ff', 0.25 + 0.3 * (tm.progress / tm.hold));
    }
    for (i = 0; i < world.relics.length; i++) {
      var rl = world.relics[i];
      if (rl.banked) continue;
      var rx = (rl.held ? rl.held.x : rl.x) * T, ry = (rl.held ? rl.held.y - 0.4 : rl.y - 0.16) * T;
      lightRing(lc, rx, ry, T * (rl.heavy ? 2.6 : 1.8), '#ffd76e', 0.24, T * 0.46);
    }
    /* laser beams cast light */
    for (i = 0; i < world.lasers.length; i++) {
      var La = world.lasers[i];
      if (!La.on) continue;
      lc.strokeStyle = PV.rgba(La.beamKind === 'soft' ? '#9b6cff' : '#ff3b58', 0.30);
      lc.lineWidth = T * 0.9;
      lc.lineCap = 'round';
      lc.beginPath();
      for (var q = 0; q < La.path.length; q++) {
        var sg = La.path[q];
        lc.moveTo(sg.x1 * T, sg.y1 * T);
        lc.lineTo(sg.x2 * T, sg.y2 * T);
      }
      lc.stroke();
    }
    /* exit pad */
    if (world.exit) lightBlob(lc, world.exit.cx * T, world.exit.cy * T, T * 2.6, '#ffd76e', 0.30 + 0.12 * Math.sin(time * 2.4));

    /* alarm wash */
    if (world.alert > 0.02) {
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = 'lighter';
      var pulse = 0.5 + 0.5 * Math.sin(time * 7);
      lc.fillStyle = 'rgba(' + Math.round(90 * world.alert) + ',' + Math.round(12 * world.alert) + ',' + Math.round(20 * world.alert) + ',' + (0.35 + 0.4 * pulse) * world.alert + ')';
      lc.fillRect(0, 0, lw, lh);
    }
  }

  function lightBlob(lc, x, y, r, color, a) {
    var g2 = lc.createRadialGradient(x, y, 0, x, y, r);
    g2.addColorStop(0, PV.rgba(color, a));
    g2.addColorStop(0.45, PV.rgba(color, a * 0.32));
    g2.addColorStop(1, PV.rgba(color, 0));
    lc.fillStyle = g2;
    lc.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* A light that a SUBJECT is carrying: it must illuminate the room without
     blowing out the subject standing at its centre, so the profile is a
     donut with a dark core. */
  function lightRing(lc, x, y, r, color, a, holeR) {
    var h = PV.clamp(holeR / r, 0.02, 0.9);
    var g2 = lc.createRadialGradient(x, y, 0, x, y, r);
    g2.addColorStop(0, PV.rgba(color, a * 0.34));
    g2.addColorStop(h, PV.rgba(color, a * 0.52));
    g2.addColorStop(h + (1 - h) * 0.20, PV.rgba(color, a * 0.72));
    g2.addColorStop(h + (1 - h) * 0.55, PV.rgba(color, a * 0.26));
    g2.addColorStop(1, PV.rgba(color, 0));
    lc.fillStyle = g2;
    lc.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* ==================================================================
     Post processing
     ================================================================== */
  var grainTile = null;
  function getGrain() {
    if (grainTile) return grainTile;
    var tex = TX('noise.grain');
    if (tex) { grainTile = tex; return grainTile; }
    var c = PV.makeCanvas(128, 128);
    var id = c.ctx.createImageData(128, 128);
    for (var i = 0; i < id.data.length; i += 4) {
      var v = 128 + (Math.random() * 2 - 1) * 42;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 30;
    }
    c.ctx.putImageData(id, 0, 0);
    grainTile = c.canvas;
    return grainTile;
  }

  function post(world, time, hud) {
    var W = main.width, H = main.height;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.globalCompositeOperation = 'source-over';
    mctx.globalAlpha = 1;

    var rewind = world.rewindFx || 0;

    /* base */
    if (rewind > 0.01) {
      /* chromatic aberration + slight scale during a rewind */
      var off = rewind * W * 0.006;
      var sc = 1 + rewind * 0.02;
      mctx.fillStyle = '#000';
      mctx.fillRect(0, 0, W, H);
      mctx.globalCompositeOperation = 'lighter';
      drawChannel(mctx, Scene.canvas, -off, 0, sc, 'rgba(255,0,60,1)');
      drawChannel(mctx, Scene.canvas, 0, 0, sc, 'rgba(0,255,120,1)');
      drawChannel(mctx, Scene.canvas, off, 0, sc, 'rgba(60,120,255,1)');
      mctx.globalCompositeOperation = 'source-over';
    } else {
      mctx.drawImage(Scene.canvas, 0, 0);
    }

    /* bloom */
    if (PV.quality.bloom) {
      var bc = Bloom.ctx, bw = Bloom.canvas.width, bh = Bloom.canvas.height;
      bc.setTransform(1, 0, 0, 1, 0, 0);
      bc.globalCompositeOperation = 'source-over';
      bc.clearRect(0, 0, bw, bh);
      bc.drawImage(Scene.canvas, 0, 0, bw, bh);
      /* bright pass: x^4 via two self-multiplies isolates real highlights
         instead of blooming every mid-tone */
      bc.globalCompositeOperation = 'multiply';
      bc.drawImage(Bloom.canvas, 0, 0);
      bc.drawImage(Bloom.canvas, 0, 0);
      bc.globalCompositeOperation = 'source-over';

      /* separable-ish blur by successive offset draws */
      var b2 = Bloom2.ctx;
      b2.setTransform(1, 0, 0, 1, 0, 0);
      b2.clearRect(0, 0, bw, bh);
      b2.globalAlpha = 0.25;
      for (var k = 0; k < 4; k++) {
        var a = (k % 2 === 0) ? 1 : -1;
        var d = 1.6 * (1 + Math.floor(k / 2));
        b2.drawImage(Bloom.canvas, a * d, 0);
        b2.drawImage(Bloom.canvas, 0, a * d);
      }
      b2.globalAlpha = 1;

      mctx.globalCompositeOperation = 'lighter';
      mctx.globalAlpha = PV.quality.tier >= 2 ? 0.46 : 0.34;
      mctx.drawImage(Bloom2.canvas, 0, 0, W, H);
      mctx.globalAlpha = 1;
      mctx.globalCompositeOperation = 'source-over';
    }

    /* vignette */
    var vg = TX('vignette.soft');
    if (vg) {
      mctx.globalAlpha = 0.42;
      mctx.drawImage(vg, 0, 0, W, H);
      mctx.globalAlpha = 1;
    } else {
      var grd = mctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.40)');
      mctx.fillStyle = grd;
      mctx.fillRect(0, 0, W, H);
    }

    /* alarm edge */
    if (world.alert > 0.02) {
      var ag = mctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.30, W / 2, H / 2, Math.max(W, H) * 0.62);
      ag.addColorStop(0, 'rgba(255,40,30,0)');
      ag.addColorStop(1, 'rgba(255,40,30,' + (0.30 * world.alert * (0.6 + 0.4 * Math.sin(time * 8))) + ')');
      mctx.fillStyle = ag;
      mctx.fillRect(0, 0, W, H);
    }

    /* time-low warning */
    if (hud && hud.secondsLeft < 5 && world.phase === 'playing') {
      var warn = (1 - hud.secondsLeft / 5);
      var wg = mctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.max(W, H) * 0.64);
      wg.addColorStop(0, 'rgba(255,170,40,0)');
      wg.addColorStop(1, 'rgba(255,170,40,' + (0.22 * warn * (0.5 + 0.5 * Math.sin(time * 9))) + ')');
      mctx.fillStyle = wg; mctx.fillRect(0, 0, W, H);
    }

    /* film grain */
    if (PV.quality.grain) {
      var gt = getGrain();
      mctx.globalCompositeOperation = 'overlay';
      mctx.globalAlpha = 0.16;
      var ox = (Math.floor(time * 24) * 61) % 128;
      var oy = (Math.floor(time * 24) * 97) % 128;
      var pat = mctx.createPattern(gt, 'repeat');
      mctx.save();
      mctx.translate(-ox, -oy);
      mctx.fillStyle = pat;
      mctx.fillRect(0, 0, W + 128, H + 128);
      mctx.restore();
      mctx.globalAlpha = 1;
      mctx.globalCompositeOperation = 'source-over';
    }

    /* scanline overlay during rewind */
    if (rewind > 0.01) {
      mctx.globalAlpha = 0.10 * rewind;
      mctx.fillStyle = '#7ff';
      for (var y = (Math.floor(time * 700) % 8); y < H; y += 8) mctx.fillRect(0, y, W, 2);
      mctx.globalAlpha = 1;
    }

    /* touch stick */
    if (PV.Input.stick.active) drawStick(mctx);
  }

  function drawChannel(ctx, src, dx, dy, scale, tint) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.42;
    var W = ctx.canvas.width, H = ctx.canvas.height;
    var w = W * scale, h = H * scale;
    ctx.drawImage(src, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h);
    ctx.restore();
  }

  function drawStick(ctx) {
    var s = PV.Input.stick;
    var d = view.dpr;
    var cx = s.cx * d, cy = s.cy * d, R0 = s.radius * d;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,215,110,0.30)';
    ctx.lineWidth = 2 * d;
    ctx.beginPath(); ctx.arc(cx, cy, R0, 0, PV.TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,110,0.06)';
    ctx.beginPath(); ctx.arc(cx, cy, R0, 0, PV.TAU); ctx.fill();
    var kx = cx + s.dx * d, ky = cy + s.dy * d;
    var kg = ctx.createRadialGradient(kx, ky, 0, kx, ky, R0 * 0.42);
    kg.addColorStop(0, 'rgba(255,235,180,0.55)');
    kg.addColorStop(1, 'rgba(255,215,110,0.05)');
    ctx.fillStyle = kg;
    ctx.beginPath(); ctx.arc(kx, ky, R0 * 0.42, 0, PV.TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,200,0.6)';
    ctx.lineWidth = 2 * d;
    ctx.beginPath(); ctx.arc(kx, ky, R0 * 0.42, 0, PV.TAU); ctx.stroke();
    ctx.restore();
  }

  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }
  R.roundRect = roundRect;

})(window);
