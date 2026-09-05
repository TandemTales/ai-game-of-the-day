/* =====================================================================
   STORMHOOK — render.js   [OWNER: agent-render]

   World renderer: camera, parallax sky, hull geometry, the rope, the
   player, and the storm front.

   FIRST PASS (lead-authored scaffold, 2026-08-27). Correct and readable,
   not yet beautiful. The camera and worldFromScreen() are integration
   surface — the aim point depends on them — so treat those as contract
   and change them only with care.
   ===================================================================== */
(function (global) {
  'use strict';

  var SH = global.SH || (global.SH = {});
  var R = SH.Render = {};

  var cv = null, ctx = null;
  var W = 1, H = 1, DPR = 1;
  var camera = R.camera = { x: 0, y: 0, scale: 1, shake: 0 };
  var time = 0;
  var stars = [];
  var cloudPuffs = [];
  var wrecks = [];
  var rain = [];
  var windLines = [];
  var lastGround = false, lastAttached = false, lastVy = 0;
  var landingCue = { t: 0, x: 0, y: 0, power: 0 };
  var hookCue = { t: 0, x: 0, y: 0 };

  /* Framing rules: never show fewer than this many tiles across or down,
     never more than MAX_TILES_X. Derived in resize(). */
  var MIN_TILES_X = 14, MIN_TILES_Y = 14, MAX_TILES_X = 32, MAX_SCALE = 3;

  R.init = function (canvas) {
    cv = canvas;
    ctx = cv.getContext('2d');
    R.resize();
    var rnd = localRandom(0xBEEF01);
    stars = [];
    for (var i = 0; i < 90; i++) {
      stars.push({ x: rnd(), y: rnd() * 0.72, r: range(rnd, 0.6, 1.9), a: range(rnd, 0.12, 0.55),
                   p: range(rnd, 0, 6.28) });
    }

    /* Scene dressing is generated once, then wrapped across the viewport.
       Keeping this data local also avoids disturbing the simulation RNG. */
    cloudPuffs = [];
    for (i = 0; i < 38; i++) {
      var layer = i < 13 ? 0 : (i < 28 ? 1 : 2);
      cloudPuffs.push({
        x: rnd(), y: range(rnd, layer === 0 ? 0.10 : 0.20, layer === 2 ? 0.92 : 0.78),
        rx: range(rnd, 90, 250) * (1 + layer * 0.24),
        ry: range(rnd, 22, 62) * (1 + layer * 0.16),
        a: range(rnd, 0.20, 0.52), phase: range(rnd, 0, 6.28), layer: layer,
        depth: [0.018, 0.10, 0.24][layer], drift: range(rnd, 1.5, 8) * (layer + 1)
      });
    }
    wrecks = [];
    for (i = 0; i < 11; i++) {
      var near = i > 6;
      wrecks.push({
        x: rnd(), y: range(rnd, near ? 0.38 : 0.18, near ? 0.82 : 0.62),
        scale: range(rnd, near ? 0.62 : 0.34, near ? 1.20 : 0.72),
        depth: range(rnd, near ? 0.17 : 0.028, near ? 0.32 : 0.085),
        alpha: range(rnd, near ? 0.40 : 0.12, near ? 0.72 : 0.25),
        flip: rnd() > 0.5 ? -1 : 1, broken: range(rnd, -0.2, 0.25)
      });
    }
    rain = [];
    for (i = 0; i < 130; i++) {
      rain.push({ x: rnd(), y: rnd(), z: rnd(), p: range(rnd, 0, 1000) });
    }
    windLines = [];
    for (i = 0; i < 12; i++) {
      windLines.push({ x: rnd(), y: rnd(), len: range(rnd, 0.14, 0.42), p: range(rnd, 0, 6.28) });
    }
  };

  function localRandom(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      var n = state;
      n = Math.imul(n ^ (n >>> 15), n | 1);
      n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
  }

  function range(rnd, a, b) { return a + (b - a) * rnd(); }

  function wrap(v, span) {
    v %= span;
    return v < 0 ? v + span : v;
  }

  function hash01(n) {
    n = (Math.imul(n | 0, 1597334677) ^ 0x68bc21eb) >>> 0;
    n = Math.imul(n ^ (n >>> 15), n | 1) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  R.resize = function () {
    if (!cv) return;
    DPR = Math.min(global.devicePixelRatio || 1, 2);
    var cssW = cv.clientWidth || global.innerWidth || 1;
    var cssH = cv.clientHeight || global.innerHeight || 1;
    W = cssW; H = cssH;
    cv.width = Math.max(1, Math.round(cssW * DPR));
    cv.height = Math.max(1, Math.round(cssH * DPR));
    var TILE = SH.TILE;
    var s = Math.min(W / (MIN_TILES_X * TILE), H / (MIN_TILES_Y * TILE));
    camera.scale = SH.clamp(s, W / (MAX_TILES_X * TILE), MAX_SCALE);
  };

  R.onLevel = function (world) {
    if (!world) return;
    camera.x = world.p.x;
    camera.y = world.p.y;
    camera.shake = 0;
    lastGround = !!world.p.onGround;
    lastAttached = !!world.hook.attached;
    lastVy = world.p.vy;
    landingCue.t = 0;
    hookCue.t = 0;
  };

  /* Screen (CSS px, canvas-relative) -> world. This is what makes the
     aim point land where the player is actually pointing; game.js feeds
     it straight into world.aim every frame. */
  R.worldFromScreen = function (sx, sy) {
    return {
      x: camera.x + (sx - W / 2) / camera.scale,
      y: camera.y + (sy - H / 2) / camera.scale
    };
  };

  R.viewport = function () {
    var hw = W / 2 / camera.scale, hh = H / 2 / camera.scale;
    return { x: camera.x - hw, y: camera.y - hh, w: hw * 2, h: hh * 2 };
  };

  R.update = function (dt, world) {
    time += dt;
    camera.shake = Math.max(0, camera.shake - dt * 3.2);
    landingCue.t = Math.max(0, landingCue.t - dt);
    hookCue.t = Math.max(0, hookCue.t - dt);
    if (!world) return;

    /* Lead the camera in the direction of travel so a fast player can
       see what they are swinging into. */
    var p = world.p;
    if (p.onGround && !lastGround && lastVy > 260) {
      landingCue.t = 0.32;
      landingCue.x = p.x;
      landingCue.y = p.y + p.r;
      landingCue.power = SH.clamp((lastVy - 260) / 720, 0.25, 1);
    }
    if (world.hook.attached && !lastAttached && world.hook.pivots.length) {
      hookCue.t = 0.24;
      hookCue.x = world.hook.pivots[0].x;
      hookCue.y = world.hook.pivots[0].y;
    }
    lastGround = !!p.onGround;
    lastAttached = !!world.hook.attached;
    lastVy = p.vy;
    var leadX = SH.clamp(p.vx * 0.30, -260, 260);
    var leadY = SH.clamp(p.vy * 0.14, -150, 150);
    var tx = p.x + leadX, ty = p.y + leadY;

    camera.x = SH.damp(camera.x, tx, 7, dt);
    camera.y = SH.damp(camera.y, ty, 6, dt);

    /* Keep the level in frame. */
    var hw = W / 2 / camera.scale, hh = H / 2 / camera.scale;
    var lw = world.w * SH.TILE, lh = world.h * SH.TILE;
    camera.x = (lw <= hw * 2) ? lw / 2 : SH.clamp(camera.x, hw, lw - hw);
    camera.y = (lh <= hh * 2) ? lh / 2 : SH.clamp(camera.y, hh, lh - hh);
  };

  R.shake = function (amt) { camera.shake = Math.min(1.4, camera.shake + amt); };

  /* ------------------------------------------------------------------ */
  function sky(world) {
    var P = SH.PALETTE;
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, P.skyTop);
    g.addColorStop(0.48, P.skyMid);
    g.addColorStop(1, P.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* A cold break in the storm gives the scene a focal direction and
       keeps tall portrait skies from reading as unused gradient. */
    var lightX = W * (0.68 - Math.sin(time * 0.03) * 0.04);
    var lightY = H * 0.24;
    var glow = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY,
                                        Math.max(W, H) * 0.62);
    glow.addColorStop(0, 'rgba(116,190,220,0.22)');
    glow.addColorStop(0.28, 'rgba(72,128,158,0.10)');
    glow.addColorStop(1, 'rgba(8,16,27,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    /* Stars, fixed to the sky, fading toward the horizon. */
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = s.a * (0.55 + 0.45 * Math.sin(time * 1.6 + s.p));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#cfe6ff';
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    stormVeils(world);
    cloudLayer(0, world);
    distantWrecks(false, world);
    cloudLayer(1, world);
    distantWrecks(true, world);
    deepFleet(world);
    depthGantries(world);
    windShear(world);
    cloudLayer(2, world);

    /* Atmospheric horizon, deliberately broad on portrait screens. */
    var haze = ctx.createLinearGradient(0, H * 0.42, 0, H);
    haze.addColorStop(0, 'rgba(54,102,123,0)');
    haze.addColorStop(0.58, 'rgba(54,102,123,0.09)');
    haze.addColorStop(1, 'rgba(7,15,24,0.24)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, H * 0.42, W, H * 0.58);
  }

  function stormVeils(world) {
    var pressure = world ? SH.clamp((worldToScreen(world.storm.x, 0).x + W * 0.15) / W, 0, 1) : 0.2;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var y = H * (0.12 + i * 0.14) + Math.sin(time * 0.11 + i) * H * 0.018;
      var vg = ctx.createLinearGradient(0, y, W, y + H * 0.08);
      vg.addColorStop(0, 'rgba(104,50,122,' + (0.05 + pressure * 0.035) + ')');
      vg.addColorStop(0.58, 'rgba(73,145,164,0.09)');
      vg.addColorStop(1, 'rgba(110,190,199,0)');
      ctx.strokeStyle = vg;
      ctx.lineWidth = H * (0.035 + i * 0.014);
      ctx.beginPath();
      ctx.moveTo(-W * 0.12, y);
      ctx.bezierCurveTo(W * 0.18, y - H * 0.10, W * 0.46, y + H * 0.13, W * 1.12, y - H * 0.03);
      ctx.stroke();
    }
    ctx.restore();
  }

  function cloudLayer(layer, world) {
    var span = Math.max(1300, W * 2.35);
    var colors = ['rgba(67,102,119,0.42)', 'rgba(35,67,87,0.58)', 'rgba(14,34,51,0.76)'];
    var under = ['rgba(8,22,34,0.22)', 'rgba(7,18,30,0.34)', 'rgba(4,12,22,0.48)'];
    var worldY = world ? camera.y - world.h * SH.TILE * 0.5 : 0;
    ctx.save();
    for (var i = 0; i < cloudPuffs.length; i++) {
      var c = cloudPuffs[i];
      if (c.layer !== layer) continue;
      var x = wrap(c.x * span - camera.x * c.depth - time * c.drift, span) - span * 0.15;
      var y = c.y * H - worldY * c.depth * 0.24 + Math.sin(time * 0.08 + c.phase) * 8;
      var rx = c.rx * Math.max(0.72, Math.min(1.35, W / 900));
      var ry = c.ry * Math.max(0.85, Math.min(1.5, H / 700));
      ctx.globalAlpha = c.a;
      cloudMass(x, y + ry * 0.18, rx, ry, c.phase, under[layer]);
      ctx.globalAlpha = c.a * 0.82;
      cloudMass(x, y, rx, ry, c.phase, colors[layer]);
      if (layer < 2) {
        ctx.globalAlpha = c.a * 0.18;
        ctx.fillStyle = '#b5deea';
        ctx.beginPath();
        ctx.ellipse(x + rx * 0.12, y - ry * 0.30, rx * 0.62, ry * 0.13, -0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function cloudMass(x, y, rx, ry, phase, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - rx, y + ry * 0.26);
    ctx.bezierCurveTo(x - rx * 0.88, y - ry * 0.35,
                      x - rx * 0.50, y - ry * (0.84 + Math.sin(phase) * 0.10),
                      x - rx * 0.18, y - ry * 0.50);
    ctx.bezierCurveTo(x + rx * 0.05, y - ry * 1.04,
                      x + rx * 0.55, y - ry * 0.72,
                      x + rx * 0.66, y - ry * 0.25);
    ctx.bezierCurveTo(x + rx * 1.02, y - ry * 0.04,
                      x + rx * 0.92, y + ry * 0.54,
                      x + rx * 0.48, y + ry * 0.55);
    ctx.bezierCurveTo(x + rx * 0.08, y + ry * 0.70,
                      x - rx * 0.62, y + ry * 0.62,
                      x - rx, y + ry * 0.26);
    ctx.closePath();
    ctx.fill();
  }

  function distantWrecks(near, world) {
    var span = Math.max(1800, W * 2.8);
    var worldY = world ? camera.y - world.h * SH.TILE * 0.5 : 0;
    for (var i = 0; i < wrecks.length; i++) {
      var wr = wrecks[i];
      if ((wr.depth >= 0.12) !== near) continue;
      var x = wrap(wr.x * span - camera.x * wr.depth, span) - span * 0.12;
      var y = wr.y * H - worldY * wr.depth * 0.18 + Math.sin(time * 0.04 + i) * 4;
      drawWreck(x, y, wr, near);
    }
  }

  /* Tall screens expose a lot more sky than the 14-tile playfield needs.
     These two slow, half-lost hulks turn that extra space into the same
     wreck-field rather than an empty gradient. They are deliberately placed
     at the upper and lower atmospheric edges, leaving the route readable. */
  function deepFleet(world) {
    var span = Math.max(1900, W * 3.1);
    var drift = time * (world && world.level ? world.level.stormSpeed * 0.08 : 4);
    var fleet = [
      { u: 0.14, y: 0.10, scale: 1.18, alpha: 0.23, depth: 0.012, flip: 1, broken: -0.08, near: false },
      { u: 0.70, y: 0.16, scale: 0.82, alpha: 0.18, depth: 0.018, flip: -1, broken: 0.18, near: false },
      { u: 0.34, y: 0.84, scale: 1.34, alpha: 0.38, depth: 0.12, flip: -1, broken: 0.04, near: true },
      { u: 0.92, y: 0.91, scale: 0.94, alpha: 0.30, depth: 0.16, flip: 1, broken: 0.22, near: true }
    ];
    for (var i = 0; i < fleet.length; i++) {
      var wr = fleet[i];
      var x = wrap(wr.u * span - camera.x * wr.depth - drift, span) - span * 0.16;
      var y = wr.y * H + Math.sin(time * 0.035 + i * 2.1) * (nearFloat(wr.near, 7, 13));
      drawWreck(x, y, wr, wr.near);
    }
  }

  function nearFloat(near, a, b) { return near ? b : a; }

  /* Industrial gantries give the open portrait margins a strong silhouette
     and a readable sense of scale. They drift at the same slow depth as the
     fleet, so they belong to the wreck-field without becoming collision
     geometry or competing with latchable surfaces. */
  function depthGantries(world) {
    var span = Math.max(W * 1.38, 520);
    var bands = [
      { y: H * 0.13, h: Math.max(22, H * 0.045), alpha: 0.38, phase: 0.6 },
      { y: H * 0.87, h: Math.max(26, H * 0.052), alpha: 0.52, phase: 2.4 }
    ];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (var i = 0; i < bands.length; i++) {
      var band = bands[i];
      var x = -W * 0.19 + Math.sin(time * 0.035 + band.phase) * W * 0.035;
      var y = band.y + Math.sin(time * 0.04 + band.phase) * 6;
      ctx.globalAlpha = band.alpha;
      ctx.fillStyle = '#183545';
      ctx.strokeStyle = 'rgba(126,190,196,0.72)';
      ctx.lineWidth = Math.max(1, H * 0.0012);
      ctx.fillRect(x, y, span * 0.72, band.h);
      ctx.strokeRect(x, y, span * 0.72, band.h);

      var sections = 7;
      for (var s = 0; s < sections; s++) {
        var sx = x + (s + 0.5) * span * 0.72 / sections;
        ctx.beginPath();
        ctx.moveTo(sx - span * 0.045, y + band.h);
        ctx.lineTo(sx + span * 0.045, y);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'screen';
      for (var l = 0; l < 3; l++) {
        var lx = x + span * (0.12 + l * 0.29);
        var ly = y + band.h * 0.52;
        ctx.fillStyle = 'rgba(255,211,115,0.44)';
        ctx.beginPath(); ctx.arc(lx, ly, Math.max(1.5, H * 0.0022), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,201,98,0.22)';
        ctx.lineWidth = Math.max(1, H * 0.004);
        ctx.beginPath(); ctx.moveTo(lx, ly + band.h * 0.5); ctx.lineTo(lx, ly + band.h * 2.0); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function drawWreck(x, y, wr, near) {
    var s = wr.scale * Math.max(0.72, Math.min(1.25, W / 880));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(wr.flip * s, s);
    ctx.globalAlpha = wr.alpha;
    ctx.fillStyle = near ? '#07131e' : '#102735';
    ctx.strokeStyle = near ? 'rgba(61,91,105,0.55)' : 'rgba(74,113,128,0.32)';
    ctx.lineWidth = near ? 2 : 1.4;

    /* Two torn pressure-hull halves with an exposed spine between them. */
    ctx.beginPath();
    ctx.moveTo(-116, 0); ctx.quadraticCurveTo(-82, -33, -20, -22);
    ctx.lineTo(-7, -8); ctx.lineTo(-17, 1); ctx.lineTo(-4, 12);
    ctx.quadraticCurveTo(-72, 27, -116, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(13, -17); ctx.quadraticCurveTo(70, -28, 112, -2);
    ctx.quadraticCurveTo(80, 27, 20, 17);
    ctx.lineTo(8, 5); ctx.lineTo(19, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(26, wr.broken * 18); ctx.stroke();
    for (var r = -78; r <= 74; r += 38) {
      if (r > -20 && r < 20) continue;
      ctx.beginPath(); ctx.ellipse(r, 0, 10, 21 - Math.abs(r) * 0.06, 0, -1.3, 1.3); ctx.stroke();
    }

    /* Gondola, snapped mast, fins, and hanging rigging sell scale. */
    ctx.beginPath();
    ctx.moveTo(-45, 19); ctx.lineTo(50, 17); ctx.lineTo(38, 31); ctx.lineTo(-34, 34); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(33, -17); ctx.lineTo(58, -48); ctx.lineTo(65, -12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-84, 16); ctx.lineTo(-106, 38); ctx.lineTo(-68, 21); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-18, 30); ctx.quadraticCurveTo(-11, 58, 4, 72);
    ctx.moveTo(28, 27); ctx.quadraticCurveTo(50, 52, 38, 78);
    ctx.moveTo(-62, 21); ctx.quadraticCurveTo(-76, 47, -62, 62);
    ctx.stroke();

    /* A few dead navigation lamps make the silhouette readable as a fleet,
       not just another cloud contour. */
    if (near) {
      ctx.globalCompositeOperation = 'screen';
      for (var l = -1; l <= 1; l++) {
        var lx = l * 34 + (wr.broken || 0) * 18;
        var ly = 22 + Math.abs(l) * 4;
        ctx.fillStyle = 'rgba(255,210,112,' + (0.22 - Math.abs(l) * 0.05) + ')';
        ctx.beginPath(); ctx.arc(lx, ly, 2.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function windShear(world) {
    var speed = world && world.level ? world.level.stormSpeed : 42;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 1;
    for (var i = 0; i < windLines.length; i++) {
      var wv = windLines[i];
      var x = wrap(wv.x * (W + 300) - time * (18 + speed * 0.25) + wv.p * 33, W + 300) - 150;
      var y = wv.y * H + Math.sin(time * 0.5 + wv.p) * 12;
      var len = W * wv.len;
      var wg = ctx.createLinearGradient(x, y, x + len, y);
      wg.addColorStop(0, 'rgba(178,220,229,0)');
      wg.addColorStop(0.58, 'rgba(178,220,229,0.13)');
      wg.addColorStop(1, 'rgba(178,220,229,0)');
      ctx.strokeStyle = wg;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + len * 0.35, y - 11, x + len * 0.72, y + 9, x + len, y - 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function worldToScreen(x, y) {
    return { x: (x - camera.x) * camera.scale + W / 2, y: (y - camera.y) * camera.scale + H / 2 };
  }
  R.worldToScreen = worldToScreen;

  function tiles(world) {
    var TILE = SH.TILE, S = camera.scale;
    var vp = R.viewport();
    var tx0 = Math.max(0, Math.floor(vp.x / TILE) - 1);
    var tx1 = Math.min(world.w - 1, Math.ceil((vp.x + vp.w) / TILE) + 1);
    var ty0 = Math.max(0, Math.floor(vp.y / TILE) - 1);
    var ty1 = Math.min(world.h - 1, Math.ceil((vp.y + vp.h) / TILE) + 1);
    var size = TILE * S + 1;

    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        var c = world.grid[ty].charAt(tx);
        if (c !== '#' && c !== '=') continue;
        var sp = worldToScreen(tx * TILE, ty * TILE);
        if (c === '=') {
          ctx.drawImage(SH.Textures.get('girder'), sp.x, sp.y, size, size);
          girderDetail(tx, ty, sp.x, sp.y, size, S);
        } else {
          var lit = !SH.Physics.solidAt(world, tx, ty - 1);
          ctx.drawImage(SH.Textures.hullFor(tx, ty, lit), sp.x, sp.y, size, size);
          hullDetail(world, tx, ty, sp.x, sp.y, size, S, lit);
        }
      }
    }
  }

  /* Route dressing is deliberately derived from the collision grid. These
     rigs are visual-only, but every one hangs from a real latchable surface,
     so the eye gets a readable chain of salvage landmarks along the same
     route the player is planning. A sparse cadence keeps this cheap on the
     software rasteriser and leaves the actual rope line uncluttered. */
  function routeDressing(world) {
    var TILE = SH.TILE;
    var vp = R.viewport();
    var tx0 = Math.max(2, Math.floor(vp.x / TILE) - 2);
    var tx1 = Math.min(world.w - 3, Math.ceil((vp.x + vp.w) / TILE) + 2);
    var levelSalt = world.level ? world.level.index * 17 : 0;
    var drawn = 0;

    for (var tx = tx0; tx <= tx1; tx++) {
      if ((tx + levelSalt) % 8 !== 3) continue;
      var surfaceY = -1;
      for (var ty = 0; ty < 11; ty++) {
        if (SH.Physics.solidAt(world, tx, ty) && !SH.Physics.solidAt(world, tx, ty + 1)) {
          surfaceY = ty + 1;
          break;
        }
      }
      if (surfaceY < 1 || surfaceY > 11) continue;

      var seed = (Math.imul(tx + 41, 2654435761) ^ Math.imul(surfaceY + 7, 2246822519)) | 0;
      var variant = hash01(seed);
      var anchorX = (tx + 0.5) * TILE;
      var anchorY = surfaceY * TILE;
      /* Ceiling rigs used to sit almost flush with the roof. At the
         player's starting elevation that put their silhouettes above the
         camera, leaving the first route band visually empty. Lower the
         existing suspended landmarks into the swing lane while keeping
         their real latch surface and suspension lines unchanged. */
      var drop = TILE * (surfaceY <= 2 ? (5.00 + variant * 1.20) :
                         (surfaceY >= 8 ? (1.05 + variant * 0.58) :
                          (1.55 + variant * 1.10)));
      var bodyX = anchorX + (hash01(seed + 1) - 0.5) * TILE * 1.4;
      var bodyY = anchorY + drop;
      var bodyW = TILE * (3.15 + hash01(seed + 2) * 1.45);
      var bodyH = TILE * (0.88 + hash01(seed + 3) * 0.34);
      drawSalvageRig(world, bodyX, bodyY, bodyW, bodyH, anchorX, anchorY, variant, seed,
                     surfaceY >= 8);
      drawn++;
      if (drawn >= 3) break;
    }
  }

  function drawSalvageRig(world, x, y, w, h, anchorX, anchorY, variant, seed, nearRoute) {
    var S = camera.scale;
    var TILE = SH.TILE;
    var sp = worldToScreen(x, y);
    var a = worldToScreen(anchorX, anchorY);
    if (sp.x < -w || sp.x > W + w || sp.y < -h * 2 || sp.y > H + h * 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = nearRoute ? 0.86 : 0.72;

    /* Taut suspension lines make the object belong to the ceiling, not float
       like another background sticker. */
    ctx.strokeStyle = 'rgba(108,153,161,0.35)';
    ctx.lineWidth = Math.max(1, 1.15 * S);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(sp.x - w * 0.26 * S, sp.y - h * 0.40 * S);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(sp.x + w * 0.24 * S, sp.y - h * 0.38 * S);
    ctx.stroke();

    /* Broken keel: two unequal pressure-hull sections and an exposed rib. */
    ctx.fillStyle = 'rgba(8,23,34,0.90)';
    ctx.strokeStyle = 'rgba(104,145,151,0.42)';
    ctx.lineWidth = Math.max(1, 1.25 * S);
    ctx.beginPath();
    ctx.moveTo(sp.x - w * 0.52 * S, sp.y - h * 0.08 * S);
    ctx.quadraticCurveTo(sp.x - w * 0.34 * S, sp.y - h * 0.62 * S,
                         sp.x - w * 0.06 * S, sp.y - h * 0.38 * S);
    ctx.lineTo(sp.x + w * 0.02 * S, sp.y - h * 0.12 * S);
    ctx.lineTo(sp.x - w * 0.04 * S, sp.y + h * 0.26 * S);
    ctx.quadraticCurveTo(sp.x - w * 0.30 * S, sp.y + h * 0.58 * S,
                         sp.x - w * 0.52 * S, sp.y - h * 0.08 * S);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sp.x + w * 0.05 * S, sp.y - h * 0.20 * S);
    ctx.quadraticCurveTo(sp.x + w * 0.34 * S, sp.y - h * 0.62 * S,
                         sp.x + w * 0.54 * S, sp.y - h * 0.03 * S);
    ctx.quadraticCurveTo(sp.x + w * 0.34 * S, sp.y + h * 0.54 * S,
                         sp.x + w * 0.06 * S, sp.y + h * 0.25 * S);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    /* A weighted underside gives route-level wrecks a foreground face. The
       darker plane is visual-only, but makes the landmark occlude the weather
       and feel like a real volume hanging in the traversal lane. */
    if (nearRoute) {
      ctx.fillStyle = 'rgba(3,11,18,0.78)';
      ctx.strokeStyle = 'rgba(119,157,159,0.34)';
      ctx.beginPath();
      ctx.moveTo(sp.x - w * 0.45 * S, sp.y + h * 0.15 * S);
      ctx.quadraticCurveTo(sp.x - w * 0.23 * S, sp.y + h * 0.70 * S,
                           sp.x + w * 0.02 * S, sp.y + h * 0.80 * S);
      ctx.quadraticCurveTo(sp.x + w * 0.30 * S, sp.y + h * 0.68 * S,
                           sp.x + w * 0.47 * S, sp.y + h * 0.12 * S);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(185,126,69,0.38)';
    ctx.lineWidth = Math.max(0.8, 1.1 * S);
    ctx.beginPath();
    ctx.moveTo(sp.x - w * 0.34 * S, sp.y - h * 0.33 * S);
    ctx.lineTo(sp.x - w * 0.17 * S, sp.y + h * 0.33 * S);
    ctx.moveTo(sp.x + w * 0.23 * S, sp.y - h * 0.36 * S);
    ctx.lineTo(sp.x + w * 0.40 * S, sp.y + h * 0.27 * S);
    ctx.stroke();

    /* Authored-looking gantry spine: a few broad ribs keep the wreck legible
       at distance without turning this visual dressing into new geometry. */
    ctx.strokeStyle = 'rgba(126,164,169,0.42)';
    ctx.lineWidth = Math.max(1, 1.8 * S);
    ctx.beginPath();
    ctx.moveTo(sp.x - w * 0.42 * S, sp.y - h * 0.46 * S);
    ctx.lineTo(sp.x + w * 0.40 * S, sp.y - h * 0.46 * S);
    ctx.moveTo(sp.x - w * 0.34 * S, sp.y - h * 0.46 * S);
    ctx.lineTo(sp.x - w * 0.28 * S, sp.y + h * 0.38 * S);
    ctx.moveTo(sp.x + w * 0.18 * S, sp.y - h * 0.46 * S);
    ctx.lineTo(sp.x + w * 0.25 * S, sp.y + h * 0.36 * S);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(67,111,123,0.30)';
    ctx.lineWidth = Math.max(0.8, 1.1 * S);
    ctx.beginPath();
    ctx.moveTo(sp.x - w * 0.34 * S, sp.y - h * 0.20 * S);
    ctx.lineTo(sp.x - w * 0.02 * S, sp.y - h * 0.46 * S);
    ctx.moveTo(sp.x + w * 0.18 * S, sp.y - h * 0.46 * S);
    ctx.lineTo(sp.x + w * 0.40 * S, sp.y - h * 0.12 * S);
    ctx.stroke();

    /* A restrained rim ties the landmark to the two live light sources. */
    var p = world.p;
    var beacon = world.beacon;
    var cool = 1 - SH.clamp(SH.dist(x, y, p.x, p.y) / (TILE * 7), 0, 1);
    var warm = 1 - SH.clamp(SH.dist(x, y, beacon.x, beacon.y) / (TILE * 9), 0, 1);
    if (cool > 0.01 || warm > 0.01) {
      ctx.globalCompositeOperation = 'screen';
      ctx.lineWidth = Math.max(0.8, 1.4 * S);
      ctx.strokeStyle = 'rgba(104,211,231,' + (0.10 + cool * 0.24) + ')';
      ctx.beginPath();
      ctx.moveTo(sp.x - w * 0.48 * S, sp.y - h * 0.10 * S);
      ctx.lineTo(sp.x - w * 0.30 * S, sp.y - h * 0.45 * S);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,203,105,' + (0.08 + warm * 0.22) + ')';
      ctx.beginPath();
      ctx.moveTo(sp.x + w * 0.48 * S, sp.y - h * 0.04 * S);
      ctx.lineTo(sp.x + w * 0.31 * S, sp.y - h * 0.40 * S);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    /* A small lamp and broken mast give each landmark a point of interest. */
    var lampX = sp.x + (variant > 0.5 ? -1 : 1) * w * 0.22 * S;
    var lampY = sp.y - h * 0.04 * S;
    ctx.globalCompositeOperation = 'screen';
    var glow = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, 18 * S);
    glow.addColorStop(0, 'rgba(255,211,111,0.62)');
    glow.addColorStop(1, 'rgba(255,171,69,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(lampX - 18 * S, lampY - 18 * S, 36 * S, 36 * S);
    ctx.fillStyle = '#ffd77a';
    ctx.beginPath(); ctx.arc(lampX, lampY, Math.max(1.6, 2.4 * S), 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.strokeStyle = 'rgba(119,167,171,0.34)';
    ctx.lineWidth = Math.max(0.8, 1 * S);
    ctx.beginPath();
    ctx.moveTo(sp.x + w * 0.32 * S, sp.y - h * 0.30 * S);
    ctx.lineTo(sp.x + w * (0.40 + hash01(seed + 4) * 0.12) * S, sp.y - h * (1.0 + hash01(seed + 5) * 0.35) * S);
    ctx.moveTo(sp.x - w * 0.08 * S, sp.y + h * 0.40 * S);
    ctx.quadraticCurveTo(sp.x - w * 0.02 * S, sp.y + h * 0.95 * S,
                         sp.x + w * 0.16 * S, sp.y + h * 1.12 * S);
    ctx.stroke();
    ctx.restore();
  }

  function hullDetail(world, tx, ty, x, y, size, S, topLit) {
    var key = (Math.imul(tx + 17, 73856093) ^ Math.imul(ty + 29, 19349663)) | 0;
    var macro = hash01((Math.imul((tx / 3) | 0, 83492791) ^
                        Math.imul((ty / 2) | 0, 297121507)) | 0);
    var v = (hash01(key) * 7) | 0;

    /* Broad 3x2-tile stains bind individual stamps into sections of hull. */
    if (macro < 0.34) {
      ctx.fillStyle = macro < 0.16 ? 'rgba(83,37,26,0.12)' : 'rgba(7,15,24,0.11)';
      ctx.fillRect(x, y, size, size);
    } else if (macro > 0.82) {
      ctx.fillStyle = 'rgba(104,130,139,0.055)';
      ctx.fillRect(x, y, size, size);
    }

    if (topLit) {
      ctx.fillStyle = 'rgba(149,190,198,0.26)';
      ctx.fillRect(x, y, size, Math.max(1.5, 2.4 * S));
      ctx.fillStyle = 'rgba(81,125,139,0.09)';
      ctx.fillRect(x, y + Math.max(1.5, 2.4 * S), size, Math.max(2, 4 * S));
    }

    ctx.lineCap = 'butt';
    if (v === 0) {
      /* A dark replaced plate interrupts the regular rivet grid. */
      ctx.fillStyle = 'rgba(8,15,23,0.31)';
      ctx.fillRect(x + size * 0.16, y + size * 0.19, size * 0.68, size * 0.57);
      ctx.strokeStyle = 'rgba(104,119,127,0.24)';
      ctx.lineWidth = Math.max(0.8, S);
      ctx.strokeRect(x + size * 0.16, y + size * 0.19, size * 0.68, size * 0.57);
    } else if (v === 1) {
      /* Long repair scar, deliberately crossing the stamp's visual grain. */
      ctx.strokeStyle = 'rgba(10,17,25,0.62)';
      ctx.lineWidth = Math.max(1.5, 2.6 * S);
      ctx.beginPath(); ctx.moveTo(x + size * 0.08, y + size * 0.83);
      ctx.lineTo(x + size * 0.91, y + size * 0.19); ctx.stroke();
      ctx.strokeStyle = 'rgba(142,107,73,0.32)';
      ctx.lineWidth = Math.max(0.7, S);
      ctx.beginPath(); ctx.moveTo(x + size * 0.10, y + size * 0.80);
      ctx.lineTo(x + size * 0.89, y + size * 0.17); ctx.stroke();
    } else if (v === 2) {
      /* Oxidation bloom, irregular and quiet enough not to imply danger. */
      ctx.fillStyle = 'rgba(134,66,39,0.22)';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.20, y + size * 0.30);
      ctx.bezierCurveTo(x + size * 0.46, y + size * 0.12, x + size * 0.76, y + size * 0.29,
                        x + size * 0.66, y + size * 0.53);
      ctx.bezierCurveTo(x + size * 0.52, y + size * 0.71, x + size * 0.16, y + size * 0.60,
                        x + size * 0.20, y + size * 0.30);
      ctx.fill();
    } else if (v === 3 && !SH.Physics.solidAt(world, tx - 1, ty)) {
      ctx.fillStyle = 'rgba(126,160,170,0.20)';
      ctx.fillRect(x, y, Math.max(2, 4 * S), size);
      ctx.fillStyle = 'rgba(4,10,17,0.38)';
      ctx.fillRect(x + Math.max(2, 4 * S), y, Math.max(1, 2 * S), size);
    } else if (v === 4) {
      /* A structural rib gives some tiles a larger-than-panel cadence. */
      ctx.fillStyle = 'rgba(7,14,22,0.30)';
      ctx.fillRect(x + size * 0.43, y, size * 0.15, size);
      ctx.fillStyle = 'rgba(112,127,132,0.19)';
      ctx.fillRect(x + size * 0.43, y, Math.max(1, 2 * S), size);
    }
  }

  function girderDetail(tx, ty, x, y, size, S) {
    if (hash01(Math.imul(tx + 11, 92821) ^ Math.imul(ty + 7, 68917)) < 0.48) return;
    ctx.strokeStyle = 'rgba(183,128,72,0.28)';
    ctx.lineWidth = Math.max(0.8, 1.2 * S);
    ctx.beginPath();
    ctx.moveTo(x + size * 0.13, y + size * 0.72);
    ctx.lineTo(x + size * 0.87, y + size * 0.28);
    ctx.stroke();
  }

  function hazards(world) {
    var S = camera.scale, TILE = SH.TILE;
    for (var i = 0; i < world.hazards.length; i++) {
      var hz = world.hazards[i];
      var sp = worldToScreen(hz.x, hz.y);
      if (sp.x < -60 || sp.x > W + 60) continue;
      var r = TILE * 0.44 * S;
      ctx.save();
      ctx.translate(sp.x, sp.y);
      var pulse = 0.7 + 0.3 * Math.sin(time * 5 + i);
      ctx.fillStyle = 'rgba(255,90,83,' + (0.75 * pulse) + ')';
      ctx.beginPath();
      for (var k = 0; k < 3; k++) {
        var bx = (k - 1) * r * 0.62;
        ctx.moveTo(bx - r * 0.30, r * 0.5);
        ctx.lineTo(bx, -r * 0.62);
        ctx.lineTo(bx + r * 0.30, r * 0.5);
      }
      ctx.fill();
      ctx.restore();
    }
  }

  function cores(world) {
    var S = camera.scale;
    var img = SH.Textures.get('glowCore');
    for (var i = 0; i < world.cores.length; i++) {
      var c = world.cores[i];
      if (c.taken) continue;
      var sp = worldToScreen(c.x, c.y);
      if (sp.x < -80 || sp.x > W + 80) continue;
      var bob = Math.sin(time * 2.4 + i * 1.3) * 5 * S;
      var r = 34 * S * (0.92 + 0.08 * Math.sin(time * 4 + i));
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(img, sp.x - r, sp.y - r + bob, r * 2, r * 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#eafff9';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y + bob, 6 * S, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function beacon(world) {
    var S = camera.scale;
    var sp = worldToScreen(world.beacon.x, world.beacon.y);
    if (sp.x < -200 || sp.x > W + 200) return;
    ctx.globalCompositeOperation = 'lighter';
    var pulse = 0.85 + 0.15 * Math.sin(time * 3);
    var r = 70 * S * pulse;
    ctx.drawImage(SH.Textures.get('glowBeacon'), sp.x - r, sp.y - r, r * 2, r * 2);
    /* Column of light up to the ceiling. */
    var g = ctx.createLinearGradient(sp.x, sp.y, sp.x, 0);
    g.addColorStop(0, 'rgba(255,215,110,0.42)');
    g.addColorStop(1, 'rgba(255,215,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sp.x - 16 * S, 0, 32 * S, sp.y);
    ctx.globalCompositeOperation = 'source-over';
  }

  function rope(world) {
    var info = SH.Physics.ropeInfo(world);
    if (!info) return;
    var p = world.p;
    var pts = [];
    for (var i = 0; i < info.pivots.length; i++) pts.push(worldToScreen(info.pivots[i].x, info.pivots[i].y));
    var pp = worldToScreen(p.x, p.y);

    /* The line extends over ~70ms when first fired, from the player out
       to the anchor, so a latch reads as a shot rather than a snap. */
    var t = SH.clamp(world.hook.t, 0, 1);
    if (t < 1) {
      var a = pts[0];
      pp = worldToScreen(p.x, p.y);
      var ex = SH.lerp(pp.x, a.x, t), ey = SH.lerp(pp.y, a.y, t);
      ctx.strokeStyle = SH.PALETTE.cable;
      ctx.lineWidth = Math.max(1.5, 2.4 * camera.scale);
      ctx.beginPath(); ctx.moveTo(pp.x, pp.y); ctx.lineTo(ex, ey); ctx.stroke();
      return;
    }

    var taut = SH.dist(info.last.x, info.last.y, p.x, p.y) >= info.eff - 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = Math.max(2.5, 4.0 * camera.scale);
    strokePoly(pts, pp);
    ctx.strokeStyle = taut ? '#f2e6c4' : 'rgba(216,201,168,0.75)';
    ctx.lineWidth = Math.max(1.4, 2.2 * camera.scale);
    strokePoly(pts, pp);

    /* Anchor plate */
    var a0 = pts[0];
    ctx.fillStyle = SH.PALETTE.brass;
    ctx.beginPath(); ctx.arc(a0.x, a0.y, 5 * camera.scale, 0, Math.PI * 2); ctx.fill();

    /* Pivot beads make the wrap legible — you can see the rope caught. */
    for (var j = 1; j < pts.length; j++) {
      ctx.fillStyle = '#ffd76e';
      ctx.beginPath(); ctx.arc(pts[j].x, pts[j].y, 3.2 * camera.scale, 0, Math.PI * 2); ctx.fill();
    }
  }

  function strokePoly(pts, end) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  function player(world) {
    var p = world.p, S = camera.scale;
    var sp = worldToScreen(p.x, p.y);
    var r = p.r * S * 1.16;
    var speed = SH.len(p.vx, p.vy);
    var ang = Math.atan2(p.vy, p.vx);
    var ropeData = world.hook.attached ? SH.Physics.ropeInfo(world) : null;
    var targetX = ropeData ? ropeData.last.x : world.aim.x;
    var targetY = ropeData ? ropeData.last.y : world.aim.y;
    var facing = targetX < p.x ? -1 : 1;
    if (Math.abs(targetX - p.x) < 4 && Math.abs(p.vx) > 20) facing = p.vx < 0 ? -1 : 1;
    var bodyLean = SH.clamp(p.vx / 1200, -0.25, 0.25);
    var armAng = Math.atan2(targetY - p.y, targetX - p.x) - bodyLean;
    var trailAng = speed > 80 ? ang + Math.PI - bodyLean : Math.PI * 0.5;

    motionWake(sp.x, sp.y, r, speed, ang, S);

    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(bodyLean);

    /* Bent boots and asymmetric arms make the traversal pose readable even
       when the visual body is only ~20 CSS pixels tall on a phone. */
    var legAng = p.onGround ? Math.PI * 0.52 : trailAng;
    drawLimb(-r * 0.23, r * 0.34, legAng - 0.28, r * 0.95, -0.24, r * 0.27, '#071019');
    drawLimb(r * 0.23, r * 0.34, legAng + 0.31, r * 1.02, 0.26, r * 0.25, '#09131d');
    var shoulderX = facing * r * 0.27;
    var shoulderY = -r * 0.22;
    drawLimb(shoulderX, shoulderY, armAng, r * (ropeData ? 1.22 : 0.92),
             -facing * 0.20, r * 0.24, '#101b25');
    drawLimb(-shoulderX, -r * 0.10, trailAng - facing * 0.30, r * 0.82,
             facing * 0.22, r * 0.22, '#0b151f');

    /* Angular storm coat and split tails, not a collision capsule. */
    var tailX = Math.cos(trailAng) * r * (0.65 + SH.clamp(speed / 1000, 0, 0.55));
    var tailY = Math.sin(trailAng) * r * (0.65 + SH.clamp(speed / 1000, 0, 0.55));
    ctx.fillStyle = '#0b1722';
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, r * 0.22); ctx.lineTo(r * 0.45, r * 0.22);
    ctx.lineTo(r * 0.20 + tailX, r * 0.76 + tailY * 0.38);
    ctx.lineTo(0, r * 0.56);
    ctx.lineTo(-r * 0.28 + tailX * 0.82, r * 0.70 + tailY * 0.46);
    ctx.closePath(); ctx.fill();

    /* Brass winch pack establishes the salvager profession in silhouette. */
    ctx.fillStyle = '#111c25';
    ctx.fillRect(-facing * r * 0.72 - r * 0.25, -r * 0.28, r * 0.48, r * 0.75);
    ctx.fillStyle = '#8f6736';
    ctx.beginPath(); ctx.arc(-facing * r * 0.69, r * 0.05, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d0a85f';
    ctx.lineWidth = Math.max(0.8, r * 0.07);
    ctx.beginPath(); ctx.arc(-facing * r * 0.69, r * 0.05, r * 0.12, 0, Math.PI * 2); ctx.stroke();

    /* Tapered torso, harness, and high collar. */
    var coat = ctx.createLinearGradient(-r * 0.4, -r * 0.5, r * 0.45, r * 0.5);
    coat.addColorStop(0, '#294052');
    coat.addColorStop(0.55, '#172a39');
    coat.addColorStop(1, '#0d1a25');
    ctx.fillStyle = coat;
    ctx.strokeStyle = '#050b12';
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(-r * 0.43, -r * 0.36); ctx.lineTo(r * 0.48, -r * 0.31);
    ctx.lineTo(r * 0.56, r * 0.37); ctx.lineTo(r * 0.20, r * 0.60);
    ctx.lineTo(-r * 0.35, r * 0.52); ctx.lineTo(-r * 0.56, r * 0.04);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.strokeStyle = '#a95f35';
    ctx.lineWidth = Math.max(1.2, r * 0.14);
    ctx.beginPath(); ctx.moveTo(-facing * r * 0.40, -r * 0.27);
    ctx.lineTo(facing * r * 0.32, r * 0.42); ctx.stroke();
    ctx.fillStyle = '#d1a251';
    ctx.fillRect(-r * 0.10, r * 0.03, r * 0.20, r * 0.18);

    /* Hooded pressure helmet with a directional cyan visor. */
    ctx.fillStyle = '#07121c';
    ctx.beginPath(); ctx.arc(0, -r * 0.66, r * 0.50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#263c4b';
    ctx.beginPath(); ctx.arc(-facing * r * 0.06, -r * 0.70, r * 0.39, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.shadowColor = 'rgba(113,226,255,0.78)';
    ctx.shadowBlur = Math.max(2, r * 0.34);
    var visor = ctx.createLinearGradient(-facing * r * 0.35, 0, facing * r * 0.42, 0);
    visor.addColorStop(0, '#3e91ad'); visor.addColorStop(1, '#d6fbff');
    ctx.strokeStyle = visor;
    ctx.lineWidth = Math.max(1.6, r * 0.18);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-facing * r * 0.10, -r * 0.72);
    ctx.lineTo(facing * r * 0.36, -r * 0.67); ctx.stroke();
    ctx.restore();

    /* Warm spill from a nearby extraction beacon rims the storm-facing side. */
    var beaconNear = 1 - SH.clamp(SH.dist(p.x, p.y, world.beacon.x, world.beacon.y) / 430, 0, 1);
    if (beaconNear > 0.01) {
      var beaconSide = world.beacon.x < p.x ? -1 : 1;
      ctx.strokeStyle = 'rgba(255,210,110,' + (0.18 + beaconNear * 0.48) + ')';
      ctx.lineWidth = Math.max(0.8, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(beaconSide * r * 0.34, -r * 0.93);
      ctx.quadraticCurveTo(beaconSide * r * 0.62, -r * 0.10,
                           beaconSide * r * 0.39, r * 0.42);
      ctx.stroke();
    }

    ctx.restore();

    /* Aim reticle — only while unhooked, so it does not clutter a swing. */
    if (!world.hook.attached && !world.dead) {
      var aim = worldToScreen(world.aim.x, world.aim.y);
      var dx = world.aim.x - p.x, dy = world.aim.y - p.y;
      var d = SH.len(dx, dy);
      var inRange = d <= SH.TUNE.maxRange;
      var hit = SH.Physics.rayCast(world, p.x, p.y, dx, dy, SH.TUNE.maxRange);
      ctx.strokeStyle = hit ? 'rgba(255,215,110,0.85)' : 'rgba(233,241,247,0.28)';
      ctx.lineWidth = Math.max(1, 1.4 * S);
      ctx.setLineDash([6 * S, 7 * S]);
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      var end = hit ? worldToScreen(hit.x, hit.y) : aim;
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (hit) {
        ctx.strokeStyle = 'rgba(255,215,110,0.95)';
        ctx.lineWidth = Math.max(1.4, 2 * S);
        ctx.beginPath(); ctx.arc(end.x, end.y, 8 * S, 0, Math.PI * 2); ctx.stroke();
      }
      if (!inRange && !hit) {
        ctx.fillStyle = 'rgba(233,241,247,0.4)';
        ctx.beginPath(); ctx.arc(aim.x, aim.y, 3 * S, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawLimb(x, y, angle, len, bend, width, color) {
    var ex = x + Math.cos(angle) * len;
    var ey = y + Math.sin(angle) * len;
    var mx = (x + ex) * 0.5 + Math.cos(angle + Math.PI * 0.5) * len * bend;
    var my = (y + ey) * 0.5 + Math.sin(angle + Math.PI * 0.5) * len * bend;
    ctx.strokeStyle = '#040a10';
    ctx.lineWidth = width * 1.55;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#9c713d';
    ctx.beginPath(); ctx.arc(ex, ey, width * 0.58, 0, Math.PI * 2); ctx.fill();
  }

  function motionWake(x, y, r, speed, angle, S) {
    if (speed < 330) return;
    var strength = SH.clamp((speed - 330) / 900, 0, 1);
    var len = Math.min(135 * S, (28 + speed * 0.075) * S);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = 'screen';
    var wake = ctx.createLinearGradient(0, 0, -len, 0);
    wake.addColorStop(0, 'rgba(143,224,243,' + (0.20 + strength * 0.24) + ')');
    wake.addColorStop(0.32, 'rgba(105,191,218,' + (0.10 + strength * 0.16) + ')');
    wake.addColorStop(1, 'rgba(71,151,185,0)');
    ctx.strokeStyle = wake;
    ctx.lineCap = 'round';
    for (var i = -1; i <= 1; i++) {
      ctx.lineWidth = Math.max(0.8, (1.5 - Math.abs(i) * 0.35) * S);
      ctx.beginPath();
      ctx.moveTo(-r * 0.35, i * r * 0.52);
      ctx.quadraticCurveTo(-len * 0.42, i * r * 0.74 + Math.sin(time * 13 + i) * r * 0.18,
                           -len, i * r * 0.25);
      ctx.stroke();
    }
    ctx.restore();
  }

  function rainPass(world, foreground) {
    if (!world) return;
    var wind = -145 - (world.level ? world.level.stormSpeed * 0.65 : 30);
    wind -= SH.clamp(world.p.vx * 0.035, -45, 45);
    var fall = foreground ? 920 : 560;
    var margin = 180;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = foreground ? 'rgba(190,226,235,0.22)' : 'rgba(143,188,202,0.13)';
    ctx.lineWidth = foreground ? 1.15 : 0.75;
    ctx.beginPath();
    for (var i = 0; i < rain.length; i++) {
      var d = rain[i];
      if ((d.z > 0.68) !== foreground) continue;
      var speedScale = 0.72 + d.z * 0.55;
      var x = wrap(d.x * (W + margin * 2) + time * wind * speedScale + d.p,
                   W + margin * 2) - margin;
      var y = wrap(d.y * (H + margin * 2) + time * fall * speedScale + d.p * 0.37,
                   H + margin * 2) - margin;
      var len = (foreground ? 34 : 18) * (0.72 + d.z * 0.72);
      var slant = wind / fall * len;
      ctx.moveTo(x, y);
      ctx.lineTo(x + slant, y + len);
    }
    ctx.stroke();
    ctx.restore();
  }

  function worldLighting(world) {
    var S = camera.scale;
    var p = worldToScreen(world.p.x, world.p.y);
    var b = worldToScreen(world.beacon.x, world.beacon.y);
    ctx.save();

    /* Cool overhead occlusion grounds the playfield in the weather while
       a subtle floor fog separates silhouettes from the deepest hull. */
    var shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(2,8,16,0.10)');
    shade.addColorStop(0.42, 'rgba(2,8,16,0)');
    shade.addColorStop(1, 'rgba(2,7,13,0.24)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);

    /* The extraction beacon throws a narrow shaft through the weather. It is
       placed before the surface clip and the beacon sprite, so hulls and
       foreground objects interrupt it like real silhouettes instead of
       receiving a detached UI glow. */
    if (b.x > -240 && b.x < W + 240) {
      ctx.globalCompositeOperation = 'screen';
      var shaft = ctx.createLinearGradient(b.x, b.y, b.x - W * 0.22, 0);
      shaft.addColorStop(0, 'rgba(255,204,104,0.16)');
      shaft.addColorStop(0.44, 'rgba(255,214,126,0.055)');
      shaft.addColorStop(1, 'rgba(255,214,126,0)');
      ctx.fillStyle = shaft;
      ctx.beginPath();
      ctx.moveTo(b.x - 30 * S, b.y);
      ctx.lineTo(b.x - W * 0.32, 0);
      ctx.lineTo(b.x - W * 0.03, 0);
      ctx.lineTo(b.x + 30 * S, b.y);
      ctx.closePath();
      ctx.fill();
    }

    surfaceSpill(world);

    /* Airborne bloom stays quiet; the brighter contribution is clipped to
       nearby hull in surfaceSpill so light feels attached to the wreck. */
    ctx.globalCompositeOperation = 'screen';
    localGlow(p.x, p.y, Math.max(90, 145 * camera.scale),
              'rgba(87,175,202,0.065)', 'rgba(48,112,145,0)');
    localGlow(b.x, b.y, Math.max(140, 230 * camera.scale),
              'rgba(255,202,91,0.075)', 'rgba(255,190,73,0)');
    ctx.restore();
  }

  function surfaceSpill(world) {
    var TILE = SH.TILE, S = camera.scale;
    var vp = R.viewport();
    var tx0 = Math.max(0, Math.floor(vp.x / TILE) - 1);
    var tx1 = Math.min(world.w - 1, Math.ceil((vp.x + vp.w) / TILE) + 1);
    var ty0 = Math.max(0, Math.floor(vp.y / TILE) - 1);
    var ty1 = Math.min(world.h - 1, Math.ceil((vp.y + vp.h) / TILE) + 1);
    var size = TILE * S + 1;
    ctx.save();
    ctx.beginPath();
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        var cell = world.grid[ty].charAt(tx);
        if (cell !== '#' && cell !== '=') continue;
        var sp = worldToScreen(tx * TILE, ty * TILE);
        ctx.rect(sp.x, sp.y, size, size);
      }
    }
    ctx.clip();
    ctx.globalCompositeOperation = 'screen';

    var p = worldToScreen(world.p.x, world.p.y);
    localGlow(p.x, p.y, Math.max(75, 175 * S),
              'rgba(105,209,232,0.32)', 'rgba(51,117,145,0)');
    var b = worldToScreen(world.beacon.x, world.beacon.y);
    localGlow(b.x, b.y, Math.max(120, 280 * S),
              'rgba(255,207,100,0.42)', 'rgba(255,166,55,0)');

    /* Only nearby visible pickups get a spill, bounding gradient cost. */
    var drawn = 0;
    for (var i = 0; i < world.cores.length && drawn < 4; i++) {
      var core = world.cores[i];
      if (core.taken) continue;
      var cp = worldToScreen(core.x, core.y);
      if (cp.x < -100 || cp.x > W + 100 || cp.y < -100 || cp.y > H + 100) continue;
      localGlow(cp.x, cp.y, Math.max(62, 105 * S),
                'rgba(91,238,207,0.23)', 'rgba(38,133,123,0)');
      drawn++;
    }
    ctx.restore();
  }

  function localGlow(x, y, radius, inner, outer) {
    var lg = ctx.createRadialGradient(x, y, 0, x, y, radius);
    lg.addColorStop(0, inner);
    lg.addColorStop(1, outer);
    ctx.fillStyle = lg;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function impactCues() {
    ctx.save();
    ctx.lineCap = 'round';
    if (landingCue.t > 0) {
      var lp = worldToScreen(landingCue.x, landingCue.y);
      var lt = 1 - landingCue.t / 0.32;
      var spread = (18 + 58 * landingCue.power) * camera.scale * (0.35 + lt * 0.65);
      ctx.strokeStyle = 'rgba(157,211,220,' + ((1 - lt) * 0.48) + ')';
      ctx.lineWidth = Math.max(0.8, 2.2 * camera.scale * (1 - lt));
      ctx.beginPath();
      ctx.ellipse(lp.x, lp.y, spread, Math.max(2, spread * 0.16), 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(205,139,78,' + ((1 - lt) * 0.38) + ')';
      for (var i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(lp.x + i * spread * 0.18, lp.y - 1);
        ctx.lineTo(lp.x + i * spread * 0.72, lp.y - spread * 0.20);
        ctx.stroke();
      }
    }
    if (hookCue.t > 0) {
      var hp = worldToScreen(hookCue.x, hookCue.y);
      var ht = 1 - hookCue.t / 0.24;
      var hr = (5 + ht * 18) * camera.scale;
      ctx.strokeStyle = 'rgba(255,219,126,' + ((1 - ht) * 0.70) + ')';
      ctx.lineWidth = Math.max(0.8, (2.6 - ht * 1.4) * camera.scale);
      ctx.beginPath(); ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,236,170,' + ((1 - ht) * 0.35) + ')';
      ctx.beginPath(); ctx.arc(hp.x, hp.y, Math.max(1.5, 4 * camera.scale * (1 - ht)), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function stormFront(world) {
    var sx = worldToScreen(world.storm.x, 0).x;
    if (sx < -40) return;
    var w = Math.max(0, Math.min(W, sx));

    var g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(30,10,39,0.98)');
    g.addColorStop(0.54, 'rgba(66,20,62,0.92)');
    g.addColorStop(0.82, 'rgba(117,42,93,0.56)');
    g.addColorStop(1, 'rgba(180,83,147,0.03)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, H);

    /* Rolling anvils on the advancing wall replace the old ruler-straight
       edge. Their scale increases toward the camera for tangible depth. */
    ctx.save();
    for (var c = 0; c < 13; c++) {
      var cy = (c + 0.35) / 13 * H + Math.sin(c * 2.17 + time * 0.24) * 22;
      var cr = (46 + hash01(c * 17 + 9) * 74) * Math.max(0.72, Math.min(1.25, H / 760));
      var cx = sx - cr * (0.18 + hash01(c * 31 + 4) * 0.46);
      var cg = ctx.createRadialGradient(cx, cy, cr * 0.05, cx, cy, cr);
      cg.addColorStop(0, 'rgba(122,46,103,0.55)');
      cg.addColorStop(0.58, 'rgba(74,22,70,0.48)');
      cg.addColorStop(1, 'rgba(38,10,47,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
    }
    ctx.restore();

    /* Lightning veins along the leading edge. */
    var frameSeed = Math.floor(time * 7) * 977 + 13;
    var flash = hash01(frameSeed) > 0.79 ? 1 : 0.54;
    ctx.save();
    ctx.shadowColor = 'rgba(228,177,255,0.75)';
    ctx.shadowBlur = flash > 0.8 ? 13 : 5;
    ctx.strokeStyle = 'rgba(237,201,255,' + (0.64 * flash) + ')';
    ctx.lineWidth = flash > 0.8 ? 2.6 : 1.5;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      var y = hash01(frameSeed + i * 101) * H;
      var x = sx - hash01(frameSeed + i * 101 + 1) * 30;
      ctx.moveTo(x, y);
      for (var k = 0; k < 7; k++) {
        x -= 6 + hash01(frameSeed + i * 101 + k * 5 + 2) * 20;
        y += -34 + hash01(frameSeed + i * 101 + k * 5 + 3) * 68;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    var edge = ctx.createLinearGradient(sx - 36, 0, sx + 16, 0);
    edge.addColorStop(0, 'rgba(171,74,143,0)');
    edge.addColorStop(0.72, 'rgba(242,190,235,' + (0.18 + flash * 0.19) + ')');
    edge.addColorStop(1, 'rgba(255,224,245,0)');
    ctx.fillStyle = edge;
    ctx.fillRect(sx - 36, 0, 52, H);
  }

  function foregroundScud(world) {
    var drift = time * (world && world.level ? world.level.stormSpeed * 0.17 : 8);
    ctx.save();
    ctx.globalAlpha = 0.26;
    for (var i = 0; i < 5; i++) {
      var x = wrap(i * W * 0.31 - drift, W * 1.55) - W * 0.28;
      var y = H * (0.03 + (i % 2) * 0.82);
      var rx = Math.max(110, W * (0.19 + i * 0.018));
      var ry = Math.max(30, H * 0.07);
      cloudMass(x, y, rx, ry, i * 1.7, i % 2 ? 'rgba(4,11,20,0.44)' : 'rgba(8,22,34,0.48)');
    }
    ctx.restore();
  }

  function vignette() {
    var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35,
                                     W / 2, H / 2, Math.max(W, H) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* ------------------------------------------------------------------ */
  R.draw = function (world) {
    if (!ctx) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (camera.shake > 0.001) {
      var shakeFrame = Math.floor(time * 120);
      var k = camera.shake * 10;
      ctx.translate((-k + hash01(shakeFrame * 2 + 1) * k * 2),
                    (-k + hash01(shakeFrame * 2 + 2) * k * 2));
    }

    sky(world);
    if (world) {
      rainPass(world, false);
      tiles(world);
      routeDressing(world);
      worldLighting(world);
      hazards(world);
      beacon(world);
      cores(world);
      if (SH.Particles && SH.Particles.draw) SH.Particles.draw(ctx, camera, worldToScreen);
      impactCues();
      rope(world);
      if (!world.dead) player(world);
      stormFront(world);
      rainPass(world, true);
      foregroundScud(world);
    }
    vignette();
  };

})(typeof window !== 'undefined' ? window : this);
