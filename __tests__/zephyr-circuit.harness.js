/* =====================================================================
   Zephyr Circuit — headless logic harness.

   Loads the classic-script logic modules into a `vm` context under a
   minimal browser shim, so the real track maths and kart physics can be
   driven and asserted on without a browser or a GPU.

   Only the pure-logic half of the game is loadable here, and that is by
   design (SPEC.md §0): everything under assets/js/render/ is ESM that
   imports three.js, needs a real GPU, and is verified by the screenshot
   sweep instead.
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'zephyr-circuit', 'assets', 'js');

const DEFAULT_MODULES = ['core.js', 'track.js', 'tracks.js', 'kart.js'];

/* A fresh sandbox per call, so one test cannot leak simulation state —
   or a seeded RNG position — into another.

   `opts.globals` is merged into the sandbox before the modules run, which
   is how a test supplies an API the default shim deliberately does not
   have — a recording Web Audio implementation, say. Merged last, so a
   test can also override a default stub. */
function loadSandbox(files, opts) {
  const s = {};

  s.window = s;
  s.globalThis = s;
  s.self = s;
  s.console = console;
  s.Math = Math;
  s.Date = Date;
  s.JSON = JSON;
  s.Float32Array = Float32Array;
  s.Float64Array = Float64Array;
  s.Uint8Array = Uint8Array;
  s.Uint16Array = Uint16Array;
  s.Uint32Array = Uint32Array;
  s.Int8Array = Int8Array;
  s.Array = Array;
  s.Object = Object;
  s.performance = { now: () => Date.now() };
  s.requestAnimationFrame = () => 0;
  s.cancelAnimationFrame = () => {};
  s.setTimeout = setTimeout;
  s.clearTimeout = clearTimeout;
  s.navigator = { maxTouchPoints: 0, userAgent: 'node', getGamepads: () => [] };
  s.screen = { width: 1440, height: 900 };
  s.devicePixelRatio = 1;
  s.location = { protocol: 'http:', search: '', href: 'http://localhost/' };
  s.addEventListener = () => {};
  s.removeEventListener = () => {};

  s.localStorage = (() => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  })();

  const stubEl = () => ({
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(c) { return c; }, removeChild() {}, remove() {},
    setAttribute() {}, getAttribute: () => null,
    addEventListener() {}, removeEventListener() {},
    getContext: () => null,
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 1280, height: 720, top: 0, left: 0 }),
    querySelector: () => null, querySelectorAll: () => [],
  });
  s.document = {
    createElement: stubEl,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: stubEl(),
    documentElement: stubEl(),
  };
  s.fetch = () => Promise.reject(new Error('offline in tests'));

  if (opts && opts.globals) {
    for (const k of Object.keys(opts.globals)) s[k] = opts.globals[k];
  }

  vm.createContext(s);

  for (const f of (files || DEFAULT_MODULES)) {
    const file = path.join(JS_DIR, f);
    vm.runInContext(fs.readFileSync(file, 'utf8'), s, { filename: file });
  }

  return { ZC: s.ZC, sandbox: s };
}

function loadZC(files, opts) { return loadSandbox(files, opts).ZC; }

module.exports = { loadZC, loadSandbox, JS_DIR, DEFAULT_MODULES };
