/* =====================================================================
   STORMHOOK — particles.js   [OWNER: agent-vfx]

   A flat pooled particle system. World-space positions; the renderer
   passes in its own worldToScreen so VFX always agree with the camera.

   FIRST PASS (lead-authored scaffold, 2026-08-27).
   ===================================================================== */
(function (global) {
  'use strict';

  var SH = global.SH || (global.SH = {});
  var PS = SH.Particles = {};

  var MAX = 900;
  var pool = [];
  var live = 0;

  PS.count = 0;

  function P() {
    return { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, r: 255, g: 255, b: 255,
             grav: 0, drag: 0.9, add: true };
  }

  PS.init = function () {
    pool = new Array(MAX);
    for (var i = 0; i < MAX; i++) pool[i] = P();
    live = 0;
    PS.count = 0;
  };

  PS.clear = function () { live = 0; PS.count = 0; };

  function spawn() {
    if (live >= MAX) return null;
    return pool[live++];
  }

  function emit(n, fn) {
    for (var i = 0; i < n; i++) {
      var p = spawn();
      if (!p) return;
      fn(p, i, n);
    }
  }

  PS.burst = function (kind, x, y, opts) {
    opts = opts || {};
    switch (kind) {
      case 'latch':
        emit(14, function (p) {
          var a = SH.rand() * Math.PI * 2, s = SH.randRange(60, 240);
          p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
          p.life = p.max = SH.randRange(0.18, 0.42); p.size = SH.randRange(1.5, 3.4);
          p.r = 255; p.g = 226; p.b = 150; p.grav = 400; p.drag = 0.86; p.add = true;
        });
        break;

      case 'core':
        var combo = opts.combo || 1;
        emit(18 + Math.min(20, combo * 2), function (p) {
          var a = SH.rand() * Math.PI * 2, s = SH.randRange(70, 330);
          p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 60;
          p.life = p.max = SH.randRange(0.3, 0.8); p.size = SH.randRange(1.6, 4.2);
          p.r = 140; p.g = 255; p.b = 226; p.grav = 260; p.drag = 0.9; p.add = true;
        });
        break;

      case 'dash':
        var dx = opts.dx || 0, dy = opts.dy || 0;
        emit(20, function (p) {
          var a = Math.atan2(-dy, -dx) + SH.randRange(-0.5, 0.5);
          var s = SH.randRange(80, 340);
          p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
          p.life = p.max = SH.randRange(0.16, 0.4); p.size = SH.randRange(1.6, 4);
          p.r = 190; p.g = 235; p.b = 255; p.grav = 120; p.drag = 0.85; p.add = true;
        });
        break;

      case 'clear':
        emit(90, function (p) {
          var a = SH.rand() * Math.PI * 2, s = SH.randRange(90, 520);
          p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 120;
          p.life = p.max = SH.randRange(0.5, 1.5); p.size = SH.randRange(2, 5);
          p.r = 255; p.g = 226; p.b = 130; p.grav = 300; p.drag = 0.93; p.add = true;
        });
        break;

      case 'death':
        emit(60, function (p) {
          var a = SH.rand() * Math.PI * 2, s = SH.randRange(60, 480);
          p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
          p.life = p.max = SH.randRange(0.35, 1.0); p.size = SH.randRange(2, 5);
          p.r = 255; p.g = 110; p.b = 96; p.grav = 500; p.drag = 0.9; p.add = true;
        });
        if (SH.Render && SH.Render.shake) SH.Render.shake(0.9);
        break;

      case 'trail':
        emit(1, function (p) {
          p.x = x; p.y = y;
          p.vx = SH.randRange(-30, 30); p.vy = SH.randRange(-30, 30);
          p.life = p.max = SH.randRange(0.18, 0.34); p.size = SH.randRange(1.4, 3);
          p.r = 150; p.g = 210; p.b = 255; p.grav = 0; p.drag = 0.9; p.add = true;
        });
        break;
    }
    PS.count = live;
  };

  PS.update = function (dt) {
    for (var i = 0; i < live; i++) {
      var p = pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        var last = pool[live - 1];
        pool[live - 1] = p; pool[i] = last;
        live--; i--;
        continue;
      }
      p.vy += p.grav * dt;
      var d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    PS.count = live;
  };

  PS.draw = function (ctx, cam, worldToScreen) {
    if (!live) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < live; i++) {
      var p = pool[i];
      var s = worldToScreen(p.x, p.y);
      var t = p.life / p.max;
      ctx.globalAlpha = SH.clamp(t, 0, 1) * 0.95;
      ctx.fillStyle = 'rgb(' + (p.r | 0) + ',' + (p.g | 0) + ',' + (p.b | 0) + ')';
      var r = p.size * cam.scale * (0.5 + t * 0.5);
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

})(typeof window !== 'undefined' ? window : this);
