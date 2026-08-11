/* =====================================================================
   PARADOX VAULT — core.js
   Engine layer: constants, math, seeded RNG, storage, event bus,
   input (keyboard / mouse / touch + virtual stick), RAF loop.
   Owner: lead. See SPEC.md §2/§3.
   ===================================================================== */
(function (global) {
  'use strict';

  var PV = global.PV || (global.PV = {});

  /* ------------------------------------------------------------------
     Constants
     ------------------------------------------------------------------ */
  PV.TILE = 64;
  PV.FIXED_DT = 1 / 120;
  PV.LOOP_TICKS = 2640;          // 22.0 s at 120Hz
  PV.VERSION = '1.0.0';

  PV.PALETTE = {
    void:      '#05070b',
    floorA:    '#12151c',
    floorB:    '#191d26',
    wall:      '#0b0e14',
    wallLit:   '#2a3140',
    wallEdge:  '#3d4657',
    brass:     '#c9a227',
    brassDark: '#7d6416',
    gold:      '#ffd76e',
    goldHot:   '#fff3c4',
    holo:      '#5ff0ff',
    holoDim:   '#1d7f92',
    holoDeep:  '#0b3f52',
    violet:    '#9b6cff',
    laser:     '#ff3b58',
    laserDim:  '#8f1226',
    alarm:     '#ff5a3c',
    relic:     '#ffcf5c',
    ink:       '#04060a',
    paper:     '#efe6d2',
    steel:     '#8d97a8',
    steelDark: '#4a5262',
    oxblood:   '#4a1420',
    teal:      '#2ad4c8'
  };

  /* ------------------------------------------------------------------
     Math
     ------------------------------------------------------------------ */
  PV.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  PV.lerp = function (a, b, t) { return a + (b - a) * t; };
  PV.smoothstep = function (a, b, x) {
    var t = PV.clamp((x - a) / (b - a || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  };
  PV.smootherstep = function (a, b, x) {
    var t = PV.clamp((x - a) / (b - a || 1e-6), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  /* frame-rate independent exponential approach */
  PV.damp = function (a, b, lambda, dt) {
    return PV.lerp(a, b, 1 - Math.exp(-lambda * dt));
  };
  PV.len = function (x, y) { return Math.sqrt(x * x + y * y); };
  PV.dist = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); };
  PV.dist2 = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  PV.angleLerp = function (a, b, t) {
    var d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  };
  PV.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };
  PV.TAU = Math.PI * 2;

  /* ------------------------------------------------------------------
     Seeded RNG (mulberry32) — deterministic level generation
     ------------------------------------------------------------------ */
  var _seed = 0x9e3779b9 >>> 0;
  PV.setSeed = function (n) { _seed = (n >>> 0) || 1; };
  PV.rand = function () {
    _seed = (_seed + 0x6D2B79F5) >>> 0;
    var t = _seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  PV.randRange = function (a, b) { return a + PV.rand() * (b - a); };
  PV.randInt = function (a, b) { return Math.floor(a + PV.rand() * (b - a + 1)); };
  PV.pick = function (arr) { return arr[Math.floor(PV.rand() * arr.length) % arr.length]; };
  PV.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(PV.rand() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  /* stable hash for texture / decoration variation */
  PV.hash2 = function (x, y) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  PV.now = function () {
    return (global.performance && global.performance.now) ? global.performance.now() : Date.now();
  };

  /* ------------------------------------------------------------------
     Storage (never throws — private browsing / file:// safe)
     ------------------------------------------------------------------ */
  var NS = 'pv1:';
  var _memStore = {};
  var _hasLS = (function () {
    try { global.localStorage.setItem(NS + '__t', '1'); global.localStorage.removeItem(NS + '__t'); return true; }
    catch (e) { return false; }
  })();
  PV.store = {
    get: function (k, def) {
      try {
        var raw = _hasLS ? global.localStorage.getItem(NS + k) : _memStore[k];
        if (raw === null || raw === undefined) return def;
        return JSON.parse(raw);
      } catch (e) { return def; }
    },
    set: function (k, v) {
      try {
        var raw = JSON.stringify(v);
        if (_hasLS) global.localStorage.setItem(NS + k, raw); else _memStore[k] = raw;
      } catch (e) { /* ignore */ }
    },
    del: function (k) {
      try { if (_hasLS) global.localStorage.removeItem(NS + k); else delete _memStore[k]; } catch (e) {}
    }
  };

  /* ------------------------------------------------------------------
     Event bus
     ------------------------------------------------------------------ */
  var _handlers = Object.create(null);
  PV.on = function (evt, fn) {
    (_handlers[evt] || (_handlers[evt] = [])).push(fn);
    return fn;
  };
  PV.off = function (evt, fn) {
    var a = _handlers[evt]; if (!a) return;
    var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  };
  PV.emit = function (evt, payload) {
    var a = _handlers[evt]; if (!a) return;
    for (var i = 0; i < a.length; i++) {
      try { a[i](payload); } catch (e) { if (global.console) console.error('[PV] handler error for ' + evt, e); }
    }
  };

  /* ------------------------------------------------------------------
     Device / canvas helpers
     ------------------------------------------------------------------ */
  PV.isTouch = ('ontouchstart' in global) || (global.navigator && global.navigator.maxTouchPoints > 0);
  PV.isMobile = PV.isTouch && Math.min(global.screen ? screen.width : 9999, global.screen ? screen.height : 9999) < 900;
  PV.dpr = function () { return PV.clamp(global.devicePixelRatio || 1, 1, 3); };

  PV.makeCanvas = function (w, h, opts) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    var ctx = c.getContext('2d', opts || { alpha: true });
    return { canvas: c, ctx: ctx };
  };

  /* ------------------------------------------------------------------
     Input
     ------------------------------------------------------------------ */
  var Input = PV.Input = {
    axis: { x: 0, y: 0 },
    raw: { x: 0, y: 0 },
    pointer: { x: 0, y: 0, down: false },
    stick: { active: false, cx: 0, cy: 0, dx: 0, dy: 0, radius: 62, id: -1 },
    lastKind: PV.isTouch ? 'touch' : 'key',
    enabled: true,
    _down: Object.create(null),
    _edge: Object.create(null),
    _virtual: Object.create(null),
    _keys: Object.create(null),
    _canvas: null
  };

  var KEYMAP = {
    'KeyW': 'up', 'ArrowUp': 'up',
    'KeyS': 'down', 'ArrowDown': 'down',
    'KeyA': 'left', 'ArrowLeft': 'left',
    'KeyD': 'right', 'ArrowRight': 'right',
    'Space': 'action', 'KeyE': 'action', 'Enter': 'action',
    'KeyR': 'rewind', 'ShiftLeft': 'dash', 'ShiftRight': 'dash',
    'Escape': 'pause', 'KeyP': 'pause',
    'KeyM': 'mute', 'Backspace': 'restart'
  };

  function setDown(name, v) {
    if (!name) return;
    var was = !!Input._down[name];
    Input._down[name] = !!v;
    if (v && !was) { Input._edge[name] = true; Input._edge.any = true; }
  }

  Input.virtual = function (name, v) { Input._virtual[name] = !!v; setDown(name, v); Input.lastKind = 'touch'; };
  Input.down = function (name) { return !!Input._down[name]; };
  Input.pressed = function (name) { return !!Input._edge[name]; };
  Input.consume = function (name) { Input._edge[name] = false; };

  Input.init = function (rootEl, canvasEl) {
    Input._canvas = canvasEl;

    /* ---- keyboard ---- */
    global.addEventListener('keydown', function (e) {
      if (!Input.enabled) return;
      var n = KEYMAP[e.code];
      if (n) {
        Input.lastKind = 'key';
        if (!e.repeat) setDown(n, true);
        if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
      }
    }, { passive: false });

    global.addEventListener('keyup', function (e) {
      var n = KEYMAP[e.code];
      if (n) setDown(n, false);
    });

    global.addEventListener('blur', function () {
      for (var k in Input._down) Input._down[k] = false;
      Input.stick.active = false; Input.stick.id = -1;
      Input.stick.dx = Input.stick.dy = 0;
      PV.emit('input:blur');
    });

    if (!canvasEl) return;

    /* ---- pointer (mouse + touch unified) ---- */
    function localPos(e) {
      var r = canvasEl.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
    }

    function onDown(e) {
      if (!Input.enabled) return;
      var p = localPos(e);
      Input.pointer.x = p.x; Input.pointer.y = p.y; Input.pointer.down = true;
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        Input.lastKind = 'touch';
        /* Left 60% of the screen drives the floating stick. The UI layer owns
           the on-screen buttons and reports through Input.virtual(). */
        if (p.x < p.w * 0.62 && Input.stick.id === -1) {
          Input.stick.active = true;
          Input.stick.id = e.pointerId;
          Input.stick.cx = p.x; Input.stick.cy = p.y;
          Input.stick.dx = 0; Input.stick.dy = 0;
        }
      } else {
        Input.lastKind = 'mouse';
      }
      try { canvasEl.setPointerCapture(e.pointerId); } catch (err) {}
    }

    function onMove(e) {
      var p = localPos(e);
      Input.pointer.x = p.x; Input.pointer.y = p.y;
      if (Input.stick.active && e.pointerId === Input.stick.id) {
        var dx = p.x - Input.stick.cx, dy = p.y - Input.stick.cy;
        var d = PV.len(dx, dy);
        var R = Input.stick.radius;
        /* let the stick base trail the finger so long drags never clip */
        if (d > R) {
          var over = d - R;
          Input.stick.cx += (dx / d) * over;
          Input.stick.cy += (dy / d) * over;
          dx = p.x - Input.stick.cx; dy = p.y - Input.stick.cy;
          d = R;
        }
        Input.stick.dx = dx; Input.stick.dy = dy;
        e.preventDefault();
      }
    }

    function onUp(e) {
      Input.pointer.down = false;
      if (e.pointerId === Input.stick.id) {
        Input.stick.active = false; Input.stick.id = -1;
        Input.stick.dx = 0; Input.stick.dy = 0;
      }
      try { canvasEl.releasePointerCapture(e.pointerId); } catch (err) {}
    }

    canvasEl.addEventListener('pointerdown', onDown, { passive: false });
    canvasEl.addEventListener('pointermove', onMove, { passive: false });
    canvasEl.addEventListener('pointerup', onUp);
    canvasEl.addEventListener('pointercancel', onUp);
    canvasEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    /* Kill iOS double-tap zoom / rubber-band inside the play area */
    canvasEl.addEventListener('touchstart', function (e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    canvasEl.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  };

  var DEADZONE = 0.16;

  Input.update = function () {
    var ax = 0, ay = 0;

    if (Input.stick.active) {
      var R = Input.stick.radius;
      ax = Input.stick.dx / R;
      ay = Input.stick.dy / R;
    } else {
      if (Input._down.left) ax -= 1;
      if (Input._down.right) ax += 1;
      if (Input._down.up) ay -= 1;
      if (Input._down.down) ay += 1;
    }

    var m = PV.len(ax, ay);
    if (m < DEADZONE) {
      ax = ay = 0; m = 0;
    } else {
      /* rescale past the deadzone so slow walking is still possible on touch */
      var t = PV.clamp((m - DEADZONE) / (1 - DEADZONE), 0, 1);
      /* mild curve for finer low-speed control */
      t = t * t * 0.35 + t * 0.65;
      ax = (ax / m) * t; ay = (ay / m) * t;
    }
    Input.raw.x = ax; Input.raw.y = ay;
    Input.axis.x = ax; Input.axis.y = ay;
  };

  Input.lateUpdate = function () {
    for (var k in Input._edge) Input._edge[k] = false;
  };

  /* ------------------------------------------------------------------
     Main loop — decoupled update/render with a hard dt clamp
     ------------------------------------------------------------------ */
  PV.Loop = (function () {
    var running = false, rafId = 0, last = 0;
    var fpsAcc = 0, fpsFrames = 0;
    var api = {
      fps: 60,
      frame: 0,
      /* smoothed ms/frame, for the perf-adaptive quality controller */
      msAvg: 16.7
    };

    function tick(t) {
      if (!running) return;
      rafId = global.requestAnimationFrame(tick);
      var dt = (t - last) / 1000;
      last = t;
      if (!(dt > 0)) dt = 1 / 60;
      var ms = dt * 1000;
      api.msAvg = api.msAvg * 0.92 + ms * 0.08;
      fpsAcc += dt; fpsFrames++;
      if (fpsAcc >= 0.5) { api.fps = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0; }
      dt = Math.min(dt, 1 / 20);
      api.frame++;

      Input.update();
      try { api._update(dt); } catch (e) { console.error('[PV] update', e); }
      try { api._render(dt); } catch (e) { console.error('[PV] render', e); }
      Input.lateUpdate();
    }

    api.start = function (update, render) {
      api._update = update; api._render = render;
      if (running) return;
      running = true; last = PV.now();
      rafId = global.requestAnimationFrame(tick);
    };
    api.stop = function () { running = false; global.cancelAnimationFrame(rafId); };
    api.running = function () { return running; };
    return api;
  })();

  /* ------------------------------------------------------------------
     Small shared utilities used across modules
     ------------------------------------------------------------------ */
  PV.rgba = function (hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };
  PV.mixHex = function (a, b, t) {
    var pa = parseInt(a.replace('#', ''), 16), pb = parseInt(b.replace('#', ''), 16);
    var r = Math.round(PV.lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
    var g = Math.round(PV.lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
    var bl = Math.round(PV.lerp(pa & 255, pb & 255, t));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  };
  PV.fmtTime = function (sec) {
    sec = Math.max(0, sec);
    var s = Math.floor(sec), cs = Math.floor((sec - s) * 100);
    return s + '.' + (cs < 10 ? '0' : '') + cs;
  };
  PV.fmtNum = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  /* Quality tier — modules read this to scale their own cost.
     game.js adjusts it at runtime from PV.Loop.msAvg. */
  PV.quality = {
    tier: PV.isMobile ? 1 : 2,   // 0 = low, 1 = medium, 2 = high
    bloom: true,
    grain: true,
    shadows: true,
    maxParticles: PV.isMobile ? 1200 : 2500
  };

})(window);
