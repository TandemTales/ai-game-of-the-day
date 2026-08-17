/* =====================================================================
   CINDERGLASS — core.js
   Engine layer: constants, math, seeded RNG, storage, event bus,
   input (keyboard cursor / mouse / touch brush), RAF loop.
   Owner: lead. See SPEC.md §0 and §3.
   ===================================================================== */
(function (global) {
  'use strict';

  var CG = global.CG || (global.CG = {});

  /* ------------------------------------------------------------------
     Constants
     ------------------------------------------------------------------ */
  CG.VERSION = '0.1.0';
  CG.TICK_HZ = 60;                 // simulation ticks per second (fixed)
  CG.TICK_DT = 1 / 60;
  CG.MAX_CATCHUP = 4;              // drop time rather than spiral on a stall

  /* Temperature scale ("degrees cg"): water freezes at 0, boils at 100.
     AMBIENT is what an untouched chamber relaxes toward. */
  CG.AMBIENT = 18;
  CG.TEMP_MIN = -120;
  CG.TEMP_MAX = 2400;

  /* UI / chrome palette. Material colors live in materials.js — do not
     duplicate them here. */
  CG.PALETTE = {
    void:      '#07060a',
    vignette:  '#000000',
    panel:     '#12101a',
    panelEdge: '#2b2536',
    ink:       '#050407',
    paper:     '#f2e9dd',
    paperDim:  '#a99f95',
    ember:     '#ff7a2f',
    emberHot:  '#ffd39b',
    emberDeep: '#7d2c06',
    frost:     '#6fd8ff',
    frostDeep: '#134a63',
    frostPale: '#d9f4ff',
    brass:     '#c9a227',
    brassDark: '#6f5a17',
    good:      '#7ee08a',
    warn:      '#ffc94a',
    bad:       '#ff4d5e',
    glass:     '#bfe6f0'
  };

  /* ------------------------------------------------------------------
     Math
     ------------------------------------------------------------------ */
  CG.TAU = Math.PI * 2;
  CG.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  CG.clamp01 = function (v) { return v < 0 ? 0 : (v > 1 ? 1 : v); };
  CG.lerp = function (a, b, t) { return a + (b - a) * t; };
  CG.invLerp = function (a, b, v) { return (v - a) / ((b - a) || 1e-6); };
  CG.smoothstep = function (a, b, x) {
    var t = CG.clamp01((x - a) / ((b - a) || 1e-6));
    return t * t * (3 - 2 * t);
  };
  CG.smootherstep = function (a, b, x) {
    var t = CG.clamp01((x - a) / ((b - a) || 1e-6));
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  /* frame-rate independent exponential approach */
  CG.damp = function (a, b, lambda, dt) {
    return CG.lerp(a, b, 1 - Math.exp(-lambda * dt));
  };
  CG.len = function (x, y) { return Math.sqrt(x * x + y * y); };
  CG.dist2 = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  CG.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };

  /* ------------------------------------------------------------------
     Seeded RNG (mulberry32).

     The simulation must never call Math.random(): a chamber replayed from
     the same seed with the same inputs has to produce the same world, or
     the solvability tests are meaningless. sim.js draws exclusively from
     CG.rand(). See SPEC.md §1.1.
     ------------------------------------------------------------------ */
  var _seed = 0x9e3779b9 >>> 0;
  CG.setSeed = function (n) { _seed = (n >>> 0) || 1; };
  CG.getSeed = function () { return _seed; };
  CG.rand = function () {
    _seed = (_seed + 0x6D2B79F5) >>> 0;
    var t = _seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  CG.randRange = function (a, b) { return a + CG.rand() * (b - a); };
  CG.randInt = function (a, b) { return Math.floor(a + CG.rand() * (b - a + 1)); };
  CG.pick = function (arr) { return arr[Math.floor(CG.rand() * arr.length) % arr.length]; };
  CG.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(CG.rand() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  /* stable per-cell hash — texture grain that does not flicker between frames */
  CG.hash2 = function (x, y) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  CG.hash3 = function (x, y, z) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  CG.now = function () {
    return (global.performance && global.performance.now) ? global.performance.now() : Date.now();
  };

  /* ------------------------------------------------------------------
     Storage (never throws — private browsing / file:// safe)
     ------------------------------------------------------------------ */
  var NS = 'cg1:';
  var _memStore = {};
  var _hasLS = (function () {
    try {
      global.localStorage.setItem(NS + '__t', '1');
      global.localStorage.removeItem(NS + '__t');
      return true;
    } catch (e) { return false; }
  })();
  CG.store = {
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
  CG.on = function (evt, fn) {
    (_handlers[evt] || (_handlers[evt] = [])).push(fn);
    return fn;
  };
  CG.off = function (evt, fn) {
    var a = _handlers[evt]; if (!a) return;
    var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  };
  CG.emit = function (evt, payload) {
    var a = _handlers[evt]; if (!a) return;
    for (var i = 0; i < a.length; i++) {
      try { a[i](payload); } catch (e) { if (global.console) console.error('[CG] handler error for ' + evt, e); }
    }
  };

  /* ------------------------------------------------------------------
     Device / canvas helpers
     ------------------------------------------------------------------ */
  CG.isTouch = ('ontouchstart' in global) ||
    (global.navigator && global.navigator.maxTouchPoints > 0);
  CG.isMobile = CG.isTouch && Math.min(
    global.screen ? screen.width : 9999,
    global.screen ? screen.height : 9999) < 900;
  CG.dpr = function () { return CG.clamp(global.devicePixelRatio || 1, 1, 3); };

  CG.makeCanvas = function (w, h, opts) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    var ctx = c.getContext('2d', opts || { alpha: true });
    return { canvas: c, ctx: ctx };
  };

  /* ------------------------------------------------------------------
     Input

     Cinderglass has no avatar, so there is no movement stick. The input
     surface is a *brush*: a position in canvas space, a held/not-held
     flag, an active tool and a radius. All three input methods converge
     on that same small struct so game.js never branches on device.
     ------------------------------------------------------------------ */
  var TOOL_TORCH = CG.TOOL_TORCH = 0;
  var TOOL_QUENCH = CG.TOOL_QUENCH = 1;
  CG.BRUSH_RADII = [3, 6, 10];

  var Input = CG.Input = {
    /* brush position in *canvas* pixels; render.js maps it to cell space */
    brush: { x: 0, y: 0, down: false, tool: TOOL_TORCH, size: 1, inside: false },
    /* true while the alternate tool is forced (right mouse button) */
    altHeld: false,
    /* keyboard cursor, in canvas pixels; only used when lastKind === 'key' */
    cursor: { x: 0, y: 0, active: false },
    lastKind: CG.isTouch ? 'touch' : 'mouse',
    enabled: true,
    _down: Object.create(null),
    _edge: Object.create(null),
    _canvas: null
  };

  var KEYMAP = {
    'KeyW': 'up', 'ArrowUp': 'up',
    'KeyS': 'down', 'ArrowDown': 'down',
    'KeyA': 'left', 'ArrowLeft': 'left',
    'KeyD': 'right', 'ArrowRight': 'right',
    'Space': 'paint', 'Enter': 'paint',
    'KeyQ': 'toolPrev', 'KeyE': 'toolNext', 'Tab': 'toolNext',
    'Digit1': 'size1', 'Digit2': 'size2', 'Digit3': 'size3',
    'Escape': 'pause', 'KeyP': 'pause',
    'KeyM': 'mute', 'KeyR': 'restart', 'KeyH': 'hint'
  };

  function setDown(name, v) {
    if (!name) return;
    var was = !!Input._down[name];
    Input._down[name] = !!v;
    if (v && !was) { Input._edge[name] = true; Input._edge.any = true; }
  }

  Input.virtual = function (name, v) { setDown(name, v); Input.lastKind = 'touch'; };
  Input.down = function (name) { return !!Input._down[name]; };
  Input.pressed = function (name) { return !!Input._edge[name]; };
  Input.consume = function (name) { Input._edge[name] = false; };

  Input.setTool = function (t) {
    Input.brush.tool = (t === TOOL_QUENCH) ? TOOL_QUENCH : TOOL_TORCH;
    CG.emit('input:tool', Input.brush.tool);
  };
  Input.toggleTool = function () {
    Input.setTool(Input.brush.tool === TOOL_TORCH ? TOOL_QUENCH : TOOL_TORCH);
  };
  Input.setSize = function (i) {
    Input.brush.size = CG.clamp(i | 0, 0, CG.BRUSH_RADII.length - 1);
    CG.emit('input:size', Input.brush.size);
  };
  /* The tool actually being applied this frame: right-drag paints the
     opposite tool without changing the selection. */
  Input.effectiveTool = function () {
    if (!Input.altHeld) return Input.brush.tool;
    return Input.brush.tool === TOOL_TORCH ? TOOL_QUENCH : TOOL_TORCH;
  };
  Input.radius = function () { return CG.BRUSH_RADII[Input.brush.size]; };

  Input.init = function (canvasEl) {
    Input._canvas = canvasEl;

    /* ---- keyboard ---- */
    global.addEventListener('keydown', function (e) {
      if (!Input.enabled) return;
      var n = KEYMAP[e.code];
      if (!n) return;
      Input.lastKind = 'key';
      Input.cursor.active = true;
      if (!e.repeat) setDown(n, true);
      if (e.code === 'Space' || e.code === 'Tab' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    }, { passive: false });

    global.addEventListener('keyup', function (e) {
      var n = KEYMAP[e.code];
      if (n) setDown(n, false);
    });

    global.addEventListener('blur', function () {
      for (var k in Input._down) Input._down[k] = false;
      Input.brush.down = false;
      Input.altHeld = false;
      CG.emit('input:blur');
    });

    if (!canvasEl) return;

    function localPos(e) {
      var r = canvasEl.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (canvasEl.width / (r.width || 1)),
        y: (e.clientY - r.top) * (canvasEl.height / (r.height || 1))
      };
    }

    function onDown(e) {
      if (!Input.enabled) return;
      var p = localPos(e);
      Input.brush.x = p.x; Input.brush.y = p.y;
      Input.brush.down = true;
      Input.brush.inside = true;
      Input.lastKind = (e.pointerType === 'touch' || e.pointerType === 'pen') ? 'touch' : 'mouse';
      Input.cursor.active = false;
      Input.altHeld = (e.button === 2);
      try { canvasEl.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    }

    function onMove(e) {
      var p = localPos(e);
      Input.brush.x = p.x; Input.brush.y = p.y;
      Input.brush.inside = true;
      if (Input.lastKind === 'key' && (e.movementX || e.movementY)) {
        Input.lastKind = 'mouse';
        Input.cursor.active = false;
      }
      if (Input.brush.down) e.preventDefault();
    }

    function onUp(e) {
      Input.brush.down = false;
      Input.altHeld = false;
      try { canvasEl.releasePointerCapture(e.pointerId); } catch (err) {}
    }

    canvasEl.addEventListener('pointerdown', onDown, { passive: false });
    canvasEl.addEventListener('pointermove', onMove, { passive: false });
    canvasEl.addEventListener('pointerup', onUp);
    canvasEl.addEventListener('pointercancel', onUp);
    canvasEl.addEventListener('pointerleave', function () { Input.brush.inside = false; });
    canvasEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    /* Kill iOS double-tap zoom and rubber-band scrolling inside the play area */
    canvasEl.addEventListener('touchstart', function (e) {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    canvasEl.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  };

  /* Keyboard cursor speed, in canvas px/sec. Scaled by canvas height so it
     feels the same on a phone and on a 4K monitor. */
  var CURSOR_SPEED = 0.55;

  Input.update = function (dt) {
    if (Input.pressed('toolNext') || Input.pressed('toolPrev')) {
      Input.toggleTool();
      Input.consume('toolNext'); Input.consume('toolPrev');
    }
    if (Input.pressed('size1')) { Input.setSize(0); Input.consume('size1'); }
    if (Input.pressed('size2')) { Input.setSize(1); Input.consume('size2'); }
    if (Input.pressed('size3')) { Input.setSize(2); Input.consume('size3'); }

    if (Input.lastKind !== 'key' || !Input._canvas) return;

    var h = Input._canvas.height || 720;
    var v = CURSOR_SPEED * h * dt;
    var dx = 0, dy = 0;
    if (Input._down.left) dx -= 1;
    if (Input._down.right) dx += 1;
    if (Input._down.up) dy -= 1;
    if (Input._down.down) dy += 1;
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    if (dx || dy) {
      Input.brush.x = CG.clamp(Input.brush.x + dx * v, 0, Input._canvas.width);
      Input.brush.y = CG.clamp(Input.brush.y + dy * v, 0, Input._canvas.height);
      Input.brush.inside = true;
    }
    Input.brush.down = !!Input._down.paint;
  };

  Input.lateUpdate = function () {
    for (var k in Input._edge) Input._edge[k] = false;
  };

  /* ------------------------------------------------------------------
     Main loop — decoupled update/render with a hard dt clamp
     ------------------------------------------------------------------ */
  CG.Loop = (function () {
    var running = false, rafId = 0, last = 0;
    var fpsAcc = 0, fpsFrames = 0;
    var api = { fps: 60, frame: 0, msAvg: 16.7 };

    function tick(t) {
      if (!running) return;
      rafId = global.requestAnimationFrame(tick);
      var dt = (t - last) / 1000;
      last = t;
      if (!(dt > 0)) dt = 1 / 60;
      api.msAvg = api.msAvg * 0.92 + (dt * 1000) * 0.08;
      fpsAcc += dt; fpsFrames++;
      if (fpsAcc >= 0.5) { api.fps = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0; }
      dt = Math.min(dt, 1 / 20);
      api.frame++;

      Input.update(dt);
      try { api._update(dt); } catch (e) { console.error('[CG] update', e); }
      try { api._render(dt); } catch (e) { console.error('[CG] render', e); }
      Input.lateUpdate();
    }

    api.start = function (update, render) {
      api._update = update; api._render = render;
      if (running) return;
      running = true; last = CG.now();
      rafId = global.requestAnimationFrame(tick);
    };
    api.stop = function () { running = false; global.cancelAnimationFrame(rafId); };
    api.running = function () { return running; };
    return api;
  })();

  /* ------------------------------------------------------------------
     Shared formatting / color utilities
     ------------------------------------------------------------------ */
  CG.rgba = function (hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };
  CG.hexToRgb = function (hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  CG.mixHex = function (a, b, t) {
    var pa = CG.hexToRgb(a), pb = CG.hexToRgb(b);
    var r = Math.round(CG.lerp(pa.r, pb.r, t));
    var g = Math.round(CG.lerp(pa.g, pb.g, t));
    var bl = Math.round(CG.lerp(pa.b, pb.b, t));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  };
  CG.fmtNum = function (n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  CG.fmtTime = function (sec) {
    sec = Math.max(0, sec);
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  };
  /* Temperature for the HUD readout. */
  CG.fmtTemp = function (t) { return Math.round(t) + '°'; };

  /* Quality tier — modules read this to scale their own cost.
     game.js adjusts it at runtime from CG.Loop.msAvg. */
  CG.quality = {
    tier: CG.isMobile ? 1 : 2,     // 0 = low, 1 = medium, 2 = high
    bloom: true,
    grain: true,
    heatHaze: !CG.isMobile,
    maxParticles: CG.isMobile ? 700 : 1800
  };

})(window);
