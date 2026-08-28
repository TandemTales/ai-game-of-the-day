/* =====================================================================
   Stormhook — headless simulation harness.

   Loads the game's logic modules (core, levels, physics) as classic
   scripts inside a `vm` context under a minimal browser shim, so the real
   gameplay code can be driven and asserted on without a browser.

   Only the pure-logic modules are loaded. textures/particles/audio/
   render/ui/game are art and integration layers that need a real canvas
   and DOM. Know what that means: a crash in any of those keeps
   `npm test` green. That is what tools/smoke.js is for.
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'stormhook', 'assets', 'js');

function stubCtx() {
  const noop = () => {};
  return new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'canvas') return { width: 1, height: 1 };
      if (k === 'createLinearGradient' || k === 'createRadialGradient') {
        return () => ({ addColorStop: noop });
      }
      if (k === 'createPattern') return () => ({});
      if (k === 'getImageData') return (x, y, w, h) => ({
        data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h,
      });
      if (k === 'measureText') return () => ({ width: 0 });
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function makeElement(tag) {
  return {
    tagName: String(tag).toUpperCase(),
    style: {}, dataset: {}, children: [],
    width: 1, height: 1,
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    getContext: () => stubCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }),
    addEventListener: () => {}, removeEventListener: () => {},
    appendChild: (c) => c, setAttribute: () => {}, remove: () => {},
  };
}

/* A fresh, fully isolated SH per call. Tests must not leak state into
   one another — the RNG and the tuning table are both global. */
function loadSH() {
  const store = new Map();
  const sandbox = {
    console,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    document: {
      createElement: makeElement,
      getElementById: () => null,
      querySelector: () => null,
      addEventListener: () => {},
      body: makeElement('body'),
      documentElement: makeElement('html'),
    },
    navigator: { userAgent: 'node', maxTouchPoints: 0 },
    addEventListener: () => {},
    removeEventListener: () => {},
    devicePixelRatio: 1,
    innerWidth: 1280, innerHeight: 720,
    location: { search: '', href: 'file:///stormhook/index.html' },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  const ctx = vm.createContext(sandbox);
  for (const f of ['core.js', 'levels.js', 'physics.js']) {
    const src = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
    vm.runInContext(src, ctx, { filename: f });
  }
  return { SH: sandbox.SH, sandbox, window: sandbox };
}

/* A neutral input frame. Tests mutate a copy of this. */
function input(over) {
  return Object.assign({
    hook: false, hookPressed: false, hookReleased: false,
    reel: 0, lean: 0, dashPressed: false,
  }, over || {});
}

const FIXED_DT = 1 / 120;

/* Run n fixed ticks. `each(world, i)` may return an input object for
   that tick; anything falsy means "no input this tick". */
function run(SH, world, n, each) {
  for (let i = 0; i < n; i++) {
    const inp = (each && each(world, i)) || input();
    SH.Physics.step(world, inp, FIXED_DT);
    if (world.dead || world.cleared) return i + 1;
  }
  return n;
}

/* Snapshot the bits of a world that must be reproducible tick-for-tick. */
function snapshot(w) {
  return {
    x: w.p.x, y: w.p.y, vx: w.p.vx, vy: w.p.vy,
    onGround: w.p.onGround, airTime: w.airTime, combo: w.combo,
    time: w.time, taken: w.cores_taken, dead: w.dead, cleared: w.cleared,
    pivots: w.hook.pivots.map((p) => [p.x, p.y, p.s]),
    len: w.hook.len, attached: w.hook.attached,
  };
}

module.exports = { loadSH, input, run, snapshot, FIXED_DT, JS_DIR };
