/* =====================================================================
   STORMHOOK — core.js   [OWNER: lead]

   Engine floor: math, seeded RNG, storage, event bus, the RAF loop, and
   the input layer. No gameplay lives here.

   Classic script. Everything hangs off window.SH.
   ===================================================================== */
(function (global) {
  'use strict';

  var SH = global.SH || (global.SH = {});

  SH.TILE = 48;

  /* ------------------------------------------------------------------
     Palette. Gameplay + UI code uses these names; art modules are free
     to use richer internal ramps of their own.
     ------------------------------------------------------------------ */
  SH.PALETTE = {
    skyTop:   '#0a1420',
    skyMid:   '#12283c',
    skyLow:   '#1d3b4e',
    stormA:   '#2b1230',
    stormB:   '#5a1f4a',
    hullDark: '#141c26',
    hull:     '#27313f',
    hullLit:  '#3d4a5c',
    iron:     '#5c6675',
    rust:     '#8a4a2c',
    brass:    '#c79a4b',
    cable:    '#d8c9a8',
    coreGlow: '#6ff0d6',
    beacon:   '#ffd76e',
    sparkA:   '#bff4ff',
    sparkB:   '#7fd0ff',
    danger:   '#ff5a53',
    ink:      '#05080d',
    paper:    '#e9f1f7'
  };

  /* ------------------------------------------------------------------
     Tuning. One flat object — SPEC §5. Physics reads it live so it can
     be retuned from the console without a reload.
     ------------------------------------------------------------------ */
  SH.TUNE = {
    gravity:       2100,
    airDrag:       0.06,
    leanAccel:     900,
    maxAirSpeed:   1500,
    maxRange:      620,
    reelSpeed:     340,
    winchSpeed:    520,
    minLen:        46,
    maxLen:        640,
    dashSpeed:     980,
    dashCooldown:  0.55,
    groundFriction: 4,
    comboAirTime:  0.6,
    comboMax:      12,
    coreValue:     120,
    beaconBonus:   1500
  };

  /* ------------------------------------------------------------------
     Math
     ------------------------------------------------------------------ */
  SH.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  SH.lerp = function (a, b, t) { return a + (b - a) * t; };
  SH.smoothstep = function (a, b, t) {
    if (b === a) return 0;
    var x = SH.clamp((t - a) / (b - a), 0, 1);
    return x * x * (3 - 2 * x);
  };
  /* Frame-rate independent exponential approach. */
  SH.damp = function (a, b, lambda, dt) {
    return SH.lerp(a, b, 1 - Math.exp(-lambda * dt));
  };
  SH.len = function (x, y) { return Math.sqrt(x * x + y * y); };
  SH.dist = function (ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  };
  SH.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };
  SH.approach = function (a, b, d) {
    if (a < b) return Math.min(a + d, b);
    if (a > b) return Math.max(a - d, b);
    return b;
  };

  /* ------------------------------------------------------------------
     Seeded RNG (mulberry32). Deterministic — tests depend on this.
     ------------------------------------------------------------------ */
  var _seed = 0x9e3779b9 >>> 0;
  SH.setSeed = function (n) { _seed = (n >>> 0) || 1; };
  SH.rand = function () {
    _seed = (_seed + 0x6D2B79F5) >>> 0;
    var t = _seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  SH.randRange = function (a, b) { return a + SH.rand() * (b - a); };
  SH.randInt = function (a, b) { return Math.floor(a + SH.rand() * (b - a + 1)); };
  SH.pick = function (arr) { return arr[Math.floor(SH.rand() * arr.length) % arr.length]; };

  /* ------------------------------------------------------------------
     Formatting
     ------------------------------------------------------------------ */
  SH.fmtNum = function (n) {
    n = Math.round(Number(n) || 0);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  SH.fmtTime = function (sec) {
    sec = Math.max(0, Number(sec) || 0);
    var m = Math.floor(sec / 60);
    var s = sec - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  };

  /* ------------------------------------------------------------------
     Storage — namespaced, and a no-op rather than a throw when the
     browser blocks localStorage (private mode, file:// in some builds).
     ------------------------------------------------------------------ */
  var NS = 'stormhook:';
  SH.store = {
    get: function (k, dflt) {
      try {
        var raw = global.localStorage.getItem(NS + k);
        return raw == null ? dflt : JSON.parse(raw);
      } catch (e) { return dflt; }
    },
    set: function (k, v) {
      try { global.localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {}
    },
    del: function (k) {
      try { global.localStorage.removeItem(NS + k); } catch (e) {}
    }
  };

  /* ------------------------------------------------------------------
     Event bus
     ------------------------------------------------------------------ */
  var _bus = {};
  SH.on = function (evt, fn) { (_bus[evt] || (_bus[evt] = [])).push(fn); };
  SH.off = function (evt, fn) {
    var a = _bus[evt]; if (!a) return;
    var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  };
  SH.emit = function (evt, payload) {
    var a = _bus[evt]; if (!a) return;
    for (var i = 0; i < a.length; i++) {
      try { a[i](payload); } catch (e) { if (global.console) console.error(e); }
    }
  };

  /* ------------------------------------------------------------------
     Canvas helper
     ------------------------------------------------------------------ */
  SH.makeCanvas = function (w, h) {
    var c = (global.document && global.document.createElement)
      ? global.document.createElement('canvas') : { width: 0, height: 0, getContext: function () { return null; } };
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return { canvas: c, ctx: c.getContext ? c.getContext('2d') : null };
  };

  /* ------------------------------------------------------------------
     Main loop. Owns RAF; game.js supplies update(dt) and render(alpha).
     ------------------------------------------------------------------ */
  SH.Loop = {
    fps: 0,
    msAvg: 0,
    running: false,
    _raf: 0,
    _last: 0,
    _acc: 0,
    _frames: 0,
    _fpsT: 0,

    start: function (update, render) {
      var L = this;
      if (L.running) L.stop();
      L.running = true;
      L._last = (global.performance && global.performance.now) ? global.performance.now() : Date.now();
      L._frames = 0; L._fpsT = 0;

      function tick(now) {
        if (!L.running) return;
        L._raf = global.requestAnimationFrame(tick);
        var t0 = now;
        var dt = (now - L._last) / 1000;
        L._last = now;
        if (!isFinite(dt) || dt < 0) dt = 0;
        dt = Math.min(dt, 1 / 20);          // SPEC §1: clamp long frames

        try { update(dt); } catch (e) { console.error(e); L.stop(); return; }
        try { render(dt); } catch (e) { console.error(e); L.stop(); return; }

        var t1 = (global.performance && global.performance.now) ? global.performance.now() : Date.now();
        L.msAvg = L.msAvg ? L.msAvg * 0.92 + (t1 - t0) * 0.08 : (t1 - t0);
        L._frames++; L._fpsT += dt;
        if (L._fpsT >= 0.5) { L.fps = Math.round(L._frames / L._fpsT); L._frames = 0; L._fpsT = 0; }
      }
      L._raf = global.requestAnimationFrame(tick);
    },

    stop: function () {
      this.running = false;
      if (this._raf && global.cancelAnimationFrame) global.cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
  };

  /* ------------------------------------------------------------------
     Input.

     The whole control scheme is "point at a thing and hold". There is no
     virtual d-pad on touch and there never will be — see SPEC §2.

       desktop : mouse aims, left button latches and holds, W/S reel,
                 A/D lean, Space dash, R restart, P pause, M mute.
       touch   : the touch point aims; touchstart latches; dragging that
                 finger vertically reels; a second finger dashes.
     ------------------------------------------------------------------ */
  var Input = SH.Input = {
    aim: { x: 0, y: 0 },
    aimWorld: { x: 0, y: 0 },
    hook: false,
    hookPressed: false,
    hookReleased: false,
    reel: 0,
    lean: 0,
    dashPressed: false,
    isTouch: false,
    _down: {},          // raw map — tools and tests write straight into this
    _prevHook: false,
    _dashLatch: false,
    _el: null,
    _touchId: null,
    _touchStartY: 0,
    _touchReel: 0,
    _bound: false
  };

  function keyName(e) {
    var k = e.key;
    if (!k) return '';
    if (k === ' ' || k === 'Spacebar') return 'space';
    if (k.length === 1) return k.toLowerCase();
    return k.toLowerCase();          // arrowleft, shift, escape, ...
  }

  Input.attach = function (el) {
    if (this._bound) return;
    this._bound = true;
    this._el = el;
    var D = this._down;
    var self = this;

    function localPoint(clientX, clientY) {
      var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0 };
      return { x: clientX - r.left, y: clientY - r.top };
    }

    /* --- keyboard --- */
    global.addEventListener('keydown', function (e) {
      var k = keyName(e);
      if (!k) return;
      if (k === 'space' || k.indexOf('arrow') === 0) e.preventDefault();
      D[k] = true;
      SH.emit('key', k);
    }, { passive: false });

    global.addEventListener('keyup', function (e) {
      var k = keyName(e);
      if (k) D[k] = false;
    });

    /* Never leave a key stuck down when the tab loses focus. */
    global.addEventListener('blur', function () {
      for (var k in D) if (Object.prototype.hasOwnProperty.call(D, k)) D[k] = false;
      self._touchId = null;
    });

    /* --- mouse --- */
    el.addEventListener('mousemove', function (e) {
      var p = localPoint(e.clientX, e.clientY);
      self.aim.x = p.x; self.aim.y = p.y;
    });
    el.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      var p = localPoint(e.clientX, e.clientY);
      self.aim.x = p.x; self.aim.y = p.y;
      D.hook = true;
    });
    global.addEventListener('mouseup', function (e) {
      if (e.button !== 0) return;
      D.hook = false;
    });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* Wheel reels the line — a nice desktop affordance. Decays in endFrame. */
    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      self._wheel = SH.clamp(self._wheel + SH.sign(e.deltaY), -1, 1);
    }, { passive: false });

    /* --- touch --- */
    function touchStart(e) {
      self.isTouch = true;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (self._touchId == null) {
          self._touchId = t.identifier;
          var p = localPoint(t.clientX, t.clientY);
          self.aim.x = p.x; self.aim.y = p.y;
          self._touchStartY = p.y;
          self._touchReel = 0;
          D.hook = true;
        } else {
          /* Any second finger is the dash. */
          D.dash = true;
        }
      }
      e.preventDefault();
    }
    function touchMove(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier !== self._touchId) continue;
        var p = localPoint(t.clientX, t.clientY);
        self.aim.x = p.x; self.aim.y = p.y;
        /* Vertical drag past a dead zone reels: up = in, down = out. */
        var dy = p.y - self._touchStartY;
        var DEAD = 26;
        self._touchReel = dy < -DEAD ? -1 : (dy > DEAD ? 1 : 0);
      }
      e.preventDefault();
    }
    function touchEnd(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === self._touchId) {
          self._touchId = null;
          self._touchReel = 0;
          D.hook = false;
        } else {
          D.dash = false;
        }
      }
      e.preventDefault();
    }
    el.addEventListener('touchstart', touchStart, { passive: false });
    el.addEventListener('touchmove', touchMove, { passive: false });
    el.addEventListener('touchend', touchEnd, { passive: false });
    el.addEventListener('touchcancel', touchEnd, { passive: false });
  };

  Input._wheel = 0;

  /* Derive the frame's logical input from the raw map. Called once per
     frame by game.js before the fixed-step loop runs. */
  Input.beginFrame = function () {
    var D = this._down;

    this.hook = !!D.hook;
    this.hookPressed = this.hook && !this._prevHook;
    this.hookReleased = !this.hook && this._prevHook;

    var lean = 0;
    if (D.a || D.arrowleft) lean -= 1;
    if (D.d || D.arrowright) lean += 1;
    this.lean = lean;

    var reel = 0;
    if (D.w || D.arrowup) reel -= 1;
    if (D.s || D.arrowdown) reel += 1;
    if (!reel) reel = this._touchReel;
    if (!reel) reel = this._wheel;
    this.reel = SH.clamp(reel, -1, 1);

    var dashHeld = !!(D.space || D.shift || D.dash);
    this.dashPressed = dashHeld && !this._dashLatch;
    this._dashLatch = dashHeld;
  };

  Input.endFrame = function () {
    this._prevHook = this.hook;
    this._wheel = 0;
    this.hookPressed = false;
    this.hookReleased = false;
    this.dashPressed = false;
  };

  /* Full reset — used between runs and by the test harness. */
  Input.reset = function () {
    var D = this._down;
    for (var k in D) if (Object.prototype.hasOwnProperty.call(D, k)) D[k] = false;
    this.hook = this.hookPressed = this.hookReleased = false;
    this.reel = 0; this.lean = 0; this.dashPressed = false;
    this._prevHook = false; this._dashLatch = false;
    this._wheel = 0; this._touchReel = 0; this._touchId = null;
  };

})(typeof window !== 'undefined' ? window : this);
