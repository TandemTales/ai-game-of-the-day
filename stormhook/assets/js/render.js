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

  /* Framing rules: never show fewer than this many tiles across or down,
     never more than MAX_TILES_X. Derived in resize(). */
  var MIN_TILES_X = 14, MIN_TILES_Y = 14, MAX_TILES_X = 30, MAX_SCALE = 3;

  R.init = function (canvas) {
    cv = canvas;
    ctx = cv.getContext('2d');
    R.resize();
    SH.setSeed(0xBEEF01);
    stars = [];
    for (var i = 0; i < 90; i++) {
      stars.push({ x: SH.rand(), y: SH.rand() * 0.7, r: SH.randRange(0.6, 1.9), a: SH.randRange(0.15, 0.6),
                   p: SH.randRange(0, 6.28) });
    }
  };

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
    if (!world) return;

    /* Lead the camera in the direction of travel so a fast player can
       see what they are swinging into. */
    var p = world.p;
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
    g.addColorStop(0.55, P.skyMid);
    g.addColorStop(1, P.skyLow);
    ctx.fillStyle = g;
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

    if (!world) return;
    /* Three parallax cloud bands. */
    var bands = [
      { d: 0.12, y: 0.30, h: 0.26, c: 'rgba(30,58,80,0.55)' },
      { d: 0.26, y: 0.46, h: 0.30, c: 'rgba(22,44,64,0.6)' },
      { d: 0.48, y: 0.62, h: 0.38, c: 'rgba(14,30,46,0.7)' }
    ];
    for (var b = 0; b < bands.length; b++) {
      var bd = bands[b];
      var off = -(camera.x * bd.d) % (W * 1.5);
      ctx.fillStyle = bd.c;
      for (var k = -1; k <= 2; k++) {
        var bx = off + k * W * 1.5;
        ctx.beginPath();
        ctx.moveTo(bx, H);
        for (var t = 0; t <= 1.0001; t += 0.05) {
          var wobble = Math.sin(t * 9 + b * 2.1) * 0.35 + Math.sin(t * 21 + b) * 0.16;
          ctx.lineTo(bx + t * W * 1.5, H * (bd.y + wobble * bd.h * 0.5));
        }
        ctx.lineTo(bx + W * 1.5, H);
        ctx.closePath();
        ctx.fill();
      }
    }
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
        } else {
          var lit = !SH.Physics.solidAt(world, tx, ty - 1);
          ctx.drawImage(SH.Textures.hullFor(tx, ty, lit), sp.x, sp.y, size, size);
        }
      }
    }
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
    var r = p.r * S;
    var speed = SH.len(p.vx, p.vy);
    var ang = Math.atan2(p.vy, p.vx);

    ctx.save();
    ctx.translate(sp.x, sp.y);

    /* Motion streak — cheap, and it sells speed. */
    if (speed > 260) {
      ctx.save();
      ctx.rotate(ang);
      var g = ctx.createLinearGradient(0, 0, -speed * 0.06 * S, 0);
      g.addColorStop(0, 'rgba(127,208,255,0.45)');
      g.addColorStop(1, 'rgba(127,208,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.7); ctx.lineTo(-speed * 0.06 * S, 0); ctx.lineTo(0, r * 0.7);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    /* Coat: leans into the direction of travel. */
    var lean = SH.clamp(p.vx / 700, -0.6, 0.6);
    ctx.rotate(lean * 0.5);

    ctx.fillStyle = '#1b2836';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.78, r * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = SH.PALETTE.rust;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.15, r * 0.62, r * 0.80, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Visor, facing the aim point. */
    var av = Math.atan2(world.aim.y - p.y, world.aim.x - p.x);
    ctx.save();
    ctx.rotate(-lean * 0.5);
    ctx.fillStyle = SH.PALETTE.sparkA;
    ctx.beginPath();
    ctx.arc(Math.cos(av) * r * 0.30, Math.sin(av) * r * 0.30 - r * 0.28, r * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

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

  function stormFront(world) {
    var sx = worldToScreen(world.storm.x, 0).x;
    if (sx < -40) return;
    var w = Math.max(0, sx);

    var g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(43,18,48,0.98)');
    g.addColorStop(0.72, 'rgba(90,31,74,0.85)');
    g.addColorStop(1, 'rgba(150,60,120,0.05)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, H);

    /* Lightning veins along the leading edge. */
    SH.setSeed(Math.floor(time * 7) * 977 + 13);
    ctx.strokeStyle = 'rgba(230,190,255,0.75)';
    ctx.lineWidth = 2;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      var y = SH.rand() * H, x = sx - SH.rand() * 30;
      ctx.moveTo(x, y);
      for (var k = 0; k < 7; k++) {
        x -= SH.randRange(6, 26);
        y += SH.randRange(-34, 34);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,220,255,0.5)';
    ctx.fillRect(sx - 2, 0, 3, H);
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
      SH.setSeed(Math.floor(time * 120));
      var k = camera.shake * 10;
      ctx.translate(SH.randRange(-k, k), SH.randRange(-k, k));
    }

    sky(world);
    if (world) {
      tiles(world);
      hazards(world);
      beacon(world);
      cores(world);
      if (SH.Particles && SH.Particles.draw) SH.Particles.draw(ctx, camera, worldToScreen);
      rope(world);
      if (!world.dead) player(world);
      stormFront(world);
    }
    vignette();
  };

})(typeof window !== 'undefined' ? window : this);
