/* =====================================================================
   ZEPHYR CIRCUIT — core.js
   Engine layer: constants, math, seeded RNG, storage, event bus, input.
   Owner: lead. See SPEC.md §0.

   Classic script. Knows nothing about three.js and must stay that way —
   this file is loaded into a `vm` context by the test harness.
   ===================================================================== */
(function (global) {
  'use strict';

  var ZC = global.ZC || (global.ZC = {});

  ZC.VERSION = '0.1.0';

  /* Physics runs fixed-step. Drift charge accumulates per step, so a
     variable timestep would make the skill mechanic frame-rate dependent
     and the leaderboard meaningless. */
  ZC.STEP_HZ = 120;
  ZC.STEP_DT = 1 / 120;
  ZC.MAX_CATCHUP = 8;

  ZC.GRAVITY = 26;              // m/s², tuned for arcade feel not realism
  ZC.CHECKPOINTS = 24;

  /* ------------------------------------------------------------------
     Math
     ------------------------------------------------------------------ */
  ZC.TAU = Math.PI * 2;
  ZC.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  ZC.clamp01 = function (v) { return v < 0 ? 0 : (v > 1 ? 1 : v); };
  ZC.lerp = function (a, b, t) { return a + (b - a) * t; };
  ZC.smoothstep = function (a, b, x) {
    var t = ZC.clamp01((x - a) / ((b - a) || 1e-6));
    return t * t * (3 - 2 * t);
  };
  ZC.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };
  ZC.damp = function (a, b, lambda, dt) {
    return ZC.lerp(a, b, 1 - Math.exp(-lambda * dt));
  };
  /* shortest signed angular difference, b - a, wrapped to (-PI, PI] */
  ZC.angleDelta = function (a, b) {
    var d = (b - a) % ZC.TAU;
    if (d > Math.PI) d -= ZC.TAU;
    if (d < -Math.PI) d += ZC.TAU;
    return d;
  };
  ZC.angleLerp = function (a, b, t) { return a + ZC.angleDelta(a, b) * t; };
  ZC.moveToward = function (a, b, maxDelta) {
    var d = b - a;
    if (Math.abs(d) <= maxDelta) return b;
    return a + ZC.sign(d) * maxDelta;
  };
  ZC.len2 = function (x, z) { return Math.sqrt(x * x + z * z); };

  /* ------------------------------------------------------------------
     Seeded RNG (mulberry32).

     Nothing in the simulation may call Math.random(): the same inputs
     replayed from the same seed have to produce the same race, or the
     tests cannot assert anything about a field of eight karts.
     ------------------------------------------------------------------ */
  var _seed = 0x9e3779b9 >>> 0;
  ZC.setSeed = function (n) { _seed = (n >>> 0) || 1; };
  ZC.getSeed = function () { return _seed; };
  ZC.rand = function () {
    _seed = (_seed + 0x6D2B79F5) >>> 0;
    var t = _seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  ZC.randRange = function (a, b) { return a + ZC.rand() * (b - a); };
  ZC.randInt = function (a, b) { return Math.floor(a + ZC.rand() * (b - a + 1)); };
  ZC.pick = function (arr) { return arr[Math.floor(ZC.rand() * arr.length) % arr.length]; };
  ZC.hashStr = function (s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    return (h ^ 0x5bf03635) >>> 0;
  };

  ZC.now = function () {
    return (global.performance && global.performance.now) ? global.performance.now() : Date.now();
  };

  /* ------------------------------------------------------------------
     Storage (never throws — private browsing safe)
     ------------------------------------------------------------------ */
  var NS = 'zc1:';
  var _mem = {};
  var _hasLS = (function () {
    try {
      global.localStorage.setItem(NS + '__t', '1');
      global.localStorage.removeItem(NS + '__t');
      return true;
    } catch (e) { return false; }
  })();
  ZC.store = {
    get: function (k, def) {
      try {
        var raw = _hasLS ? global.localStorage.getItem(NS + k) : _mem[k];
        if (raw === null || raw === undefined) return def;
        return JSON.parse(raw);
      } catch (e) { return def; }
    },
    set: function (k, v) {
      try {
        var raw = JSON.stringify(v);
        if (_hasLS) global.localStorage.setItem(NS + k, raw); else _mem[k] = raw;
      } catch (e) {}
    },
    del: function (k) {
      try { if (_hasLS) global.localStorage.removeItem(NS + k); else delete _mem[k]; } catch (e) {}
    }
  };

  /* ------------------------------------------------------------------
     Event bus
     ------------------------------------------------------------------ */
  var _handlers = Object.create(null);
  ZC.on = function (evt, fn) { (_handlers[evt] || (_handlers[evt] = [])).push(fn); return fn; };
  ZC.off = function (evt, fn) {
    var a = _handlers[evt]; if (!a) return;
    var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  };
  ZC.emit = function (evt, payload) {
    var a = _handlers[evt]; if (!a) return;
    for (var i = 0; i < a.length; i++) {
      try { a[i](payload); } catch (e) { if (global.console) console.error('[ZC] ' + evt, e); }
    }
  };

  /* ------------------------------------------------------------------
     Device
     ------------------------------------------------------------------ */
  ZC.isTouch = ('ontouchstart' in global) ||
    (global.navigator && global.navigator.maxTouchPoints > 0);
  ZC.isMobile = ZC.isTouch && Math.min(
    global.screen ? screen.width : 9999,
    global.screen ? screen.height : 9999) < 900;
  ZC.dpr = function () { return ZC.clamp(global.devicePixelRatio || 1, 1, 2.5); };

  /* ------------------------------------------------------------------
     Input.

     Everything — keys, touch zones, gamepad — collapses into this one
     struct, so nothing downstream ever branches on device. See SPEC §4.
     ------------------------------------------------------------------ */
  var Input = ZC.Input = {
    state: {
      throttle: 0,      // 0..1
      brake: 0,         // 0..1
      steer: 0,         // -1 left .. +1 right
      drift: false,
      item: false,
      look: false
    },
    lastKind: ZC.isTouch ? 'touch' : 'key',
    enabled: true,
    /* Touch auto-accelerates: a phone player cannot hold three controls
       at once, and every shipped mobile kart racer does this. */
    autoThrottle: ZC.isTouch,
    _down: Object.create(null),
    _edge: Object.create(null),
    _virtual: Object.create(null),
    _padIndex: -1
  };

  var KEYMAP = {
    'KeyW': 'up', 'ArrowUp': 'up',
    'KeyS': 'down', 'ArrowDown': 'down',
    'KeyA': 'left', 'ArrowLeft': 'left',
    'KeyD': 'right', 'ArrowRight': 'right',
    'ShiftLeft': 'drift', 'ShiftRight': 'drift', 'Space': 'drift',
    'KeyE': 'item', 'ControlLeft': 'item', 'ControlRight': 'item',
    'KeyC': 'look',
    'Escape': 'pause', 'KeyP': 'pause',
    'KeyM': 'mute', 'KeyR': 'restart'
  };

  function setDown(name, v) {
    if (!name) return;
    var was = !!Input._down[name];
    Input._down[name] = !!v;
    if (v && !was) { Input._edge[name] = true; Input._edge.any = true; }
  }

  Input.virtual = function (name, v) {
    Input._virtual[name] = !!v;
    Input.lastKind = 'touch';
  };
  Input.down = function (n) { return !!Input._down[n]; };
  Input.pressed = function (n) { return !!Input._edge[n]; };
  Input.consume = function (n) { Input._edge[n] = false; };

  Input.init = function (canvasEl) {
    global.addEventListener('keydown', function (e) {
      if (!Input.enabled) return;
      var n = KEYMAP[e.code];
      if (!n) return;
      Input.lastKind = 'key';
      if (!e.repeat) setDown(n, true);
      if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    }, { passive: false });

    global.addEventListener('keyup', function (e) {
      var n = KEYMAP[e.code];
      if (n) setDown(n, false);
    });

    global.addEventListener('blur', function () {
      for (var k in Input._down) Input._down[k] = false;
      for (var v in Input._virtual) Input._virtual[v] = false;
      ZC.emit('input:blur');
    });

    global.addEventListener('gamepadconnected', function (e) {
      Input._padIndex = e.gamepad.index;
      ZC.emit('input:gamepad', true);
    });
    global.addEventListener('gamepaddisconnected', function () {
      Input._padIndex = -1;
      ZC.emit('input:gamepad', false);
    });

    if (canvasEl) {
      canvasEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      canvasEl.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
      document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    }
  };

  function pollGamepad(s) {
    if (Input._padIndex < 0 || !global.navigator || !navigator.getGamepads) return false;
    var pad = navigator.getGamepads()[Input._padIndex];
    if (!pad) return false;

    var ax = pad.axes[0] || 0;
    var dead = 0.16;
    var steer = Math.abs(ax) < dead ? 0 :
      ZC.sign(ax) * ((Math.abs(ax) - dead) / (1 - dead));

    var rt = pad.buttons[7] ? pad.buttons[7].value : 0;
    var lt = pad.buttons[6] ? pad.buttons[6].value : 0;
    var a = pad.buttons[0] && pad.buttons[0].pressed;
    var x = pad.buttons[2] && pad.buttons[2].pressed;

    var active = Math.abs(ax) > dead || rt > 0.05 || lt > 0.05 || a || x;
    if (!active) return false;

    Input.lastKind = 'pad';
    s.steer = steer;
    s.throttle = Math.max(rt, a ? 1 : 0);
    s.brake = pad.buttons[1] && pad.buttons[1].pressed ? 1 : 0;
    s.drift = lt > 0.25;
    s.item = !!x;
    return true;
  }

  /* Steering ramps rather than snapping: a digital key that instantly
     pins the wheel makes a kart impossible to hold on a line. Touch and
     stick input are already analogue and are passed through. */
  var STEER_RATE = 4.4;        // per second, to full lock
  var STEER_RETURN = 6.5;
  var keySteer = 0;

  Input.update = function (dt) {
    var s = Input.state;
    var V = Input._virtual;

    if (pollGamepad(s)) return s;

    var want = 0;
    if (Input._down.left || V.left) want -= 1;
    if (Input._down.right || V.right) want += 1;

    if (want !== 0) {
      keySteer = ZC.moveToward(keySteer, want, STEER_RATE * dt);
    } else {
      keySteer = ZC.moveToward(keySteer, 0, STEER_RETURN * dt);
    }
    s.steer = ZC.clamp(keySteer, -1, 1);

    var braking = Input._down.down || V.brake;
    if (Input.autoThrottle || V.throttle) {
      s.throttle = braking ? 0 : 1;
    } else {
      s.throttle = Input._down.up ? 1 : 0;
    }
    s.brake = braking ? 1 : 0;
    s.drift = !!(Input._down.drift || V.drift);
    s.item = !!(Input._down.item || V.item);
    s.look = !!(Input._down.look || V.look);
    return s;
  };

  Input.lateUpdate = function () {
    for (var k in Input._edge) Input._edge[k] = false;
  };

  /* ------------------------------------------------------------------
     Formatting
     ------------------------------------------------------------------ */
  ZC.fmtNum = function (n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  /* Lap times read as 1:23.45 — the format every racing game uses. */
  ZC.fmtLap = function (sec) {
    if (!isFinite(sec) || sec <= 0) return '--:--.--';
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    var cs = Math.floor((sec * 100) % 100);
    return m + ':' + (s < 10 ? '0' : '') + s + '.' + (cs < 10 ? '0' : '') + cs;
  };
  ZC.ordinal = function (n) {
    var v = n % 100;
    if (v >= 11 && v <= 13) return n + 'th';
    return n + (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  };

  /* Quality tier — the render layer reads this to scale its own cost.
     render/main.js adjusts it at runtime from measured frame time. */
  ZC.quality = {
    tier: ZC.isMobile ? 1 : 2,      // 0 low, 1 medium, 2 high
    shadows: !ZC.isMobile,
    bloom: true,
    fxaa: !ZC.isMobile,
    drawDistance: ZC.isMobile ? 420 : 900
  };

})(window);
