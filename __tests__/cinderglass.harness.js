/* =====================================================================
   Cinderglass — headless simulation harness.

   Loads the game's pure-logic modules (core, materials, sim, levels) as
   classic scripts inside a `vm` context under a minimal browser shim, so
   the real simulation can be driven and asserted on without a browser.

   render/particles/audio/ui/game are art and integration layers that need
   a real canvas and DOM; every mechanic worth pinning down lives in the
   four modules loaded here.
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'cinderglass', 'assets', 'js');

/* A canvas 2d context stub. Nothing in the logic modules draws, but
   core.js exposes makeCanvas() and a stray call must not throw. */
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
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    width: 300, height: 150, innerHTML: '', textContent: '',
    appendChild(c) { this.children.push(c); return c; },
    removeChild: noop, remove: noop, setAttribute: noop,
    getAttribute: () => null, addEventListener: noop, removeEventListener: noop,
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 1280, height: 720, top: 0, left: 0, right: 1280, bottom: 720 }),
    getContext: () => stubCtx(),
    focus: noop, blur: noop, querySelector: () => null, querySelectorAll: () => [],
  };
  function noop() {}
}

/* Build a fresh sandbox with the logic modules loaded. Each call is fully
   isolated, so one test cannot leak simulation state into another. */
function loadCG(files) {
  const sandbox = {};
  const win = sandbox;

  sandbox.window = win;
  sandbox.globalThis = win;
  sandbox.self = win;
  sandbox.console = console;
  sandbox.Math = Math;
  sandbox.Date = Date;
  sandbox.JSON = JSON;
  sandbox.performance = { now: () => Date.now() };
  sandbox.requestAnimationFrame = () => 0;
  sandbox.cancelAnimationFrame = () => {};
  sandbox.setTimeout = setTimeout;
  sandbox.clearTimeout = clearTimeout;
  sandbox.navigator = { maxTouchPoints: 0, userAgent: 'node' };
  sandbox.screen = { width: 1440, height: 900 };
  sandbox.devicePixelRatio = 1;
  sandbox.location = { protocol: 'file:', search: '', href: 'file:///cinderglass/index.html' };
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};
  sandbox.localStorage = (() => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  })();
  sandbox.document = {
    createElement: makeElement,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: makeElement('body'),
    documentElement: makeElement('html'),
  };
  sandbox.fetch = () => Promise.reject(new Error('offline in tests'));

  vm.createContext(sandbox);

  const list = files || ['core.js', 'materials.js', 'sim.js', 'levels.js'];
  for (const f of list) {
    const file = path.join(JS_DIR, f);
    const src = fs.readFileSync(file, 'utf8');
    vm.runInContext(src, sandbox, { filename: file });
  }

  return sandbox.CG;
}

/* Convenience: a fresh sim plus the material id table. */
function newSim(w, h, seed, files) {
  const CG = loadCG(files);
  return { CG, sim: new CG.Sim(w, h, seed === undefined ? 12345 : seed), ID: CG.Materials.ID };
}

module.exports = { loadCG, newSim, JS_DIR };
