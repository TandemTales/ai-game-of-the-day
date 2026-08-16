/* =====================================================================
   Paradox Vault — headless simulation harness.

   Loads the game's logic modules (core, levels, entities) as classic
   scripts inside a `vm` context under a minimal browser shim, so the real
   gameplay code can be driven and asserted on without a browser.

   Only the pure-logic modules are loaded. textures/particles/audio/render/
   ui/game are art and integration layers that need a real canvas and DOM;
   the mechanics worth pinning down all live in the three loaded here.
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'paradox-vault', 'assets', 'js');

/* A canvas 2d context stub. core.js's makeCanvas() is called by art code we
   do not load, but PALETTE setup and a few helpers may still touch it, so
   every method is a no-op that returns something plausible rather than
   throwing. */
function stubCtx() {
  const noop = () => {};
  const ctx = new Proxy({}, {
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
  return ctx;
}

function makeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    style: {}, dataset: {}, children: [], classList: {
      add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false,
    },
    width: 300, height: 150,
    appendChild(c) { this.children.push(c); return c; },
    removeChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect() { return { x: 0, y: 0, width: 1280, height: 720, top: 0, left: 0, right: 1280, bottom: 720 }; },
    getContext() { return stubCtx(); },
    focus() {}, blur() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  return el;
}

/**
 * Build a fresh sandbox with core.js + levels.js + entities.js loaded.
 * Each call is fully isolated, so a test that mutates PV state cannot leak
 * into another test.
 */
function loadPV(opts) {
  opts = opts || {};

  const storage = new Map();
  const win = {};

  const sandbox = {
    window: win,
    self: win,
    globalThis: win,
    console: opts.captureConsole ? { log: () => {}, warn: () => {}, error: () => {} } : console,
    Math, JSON, Date, Object, Array, String, Number, Boolean, Error, RegExp, Symbol, Proxy, Map, Set,
    Int8Array, Uint8Array, Uint8ClampedArray, Int32Array, Uint32Array, Float32Array, Float64Array,
    isNaN, isFinite, parseInt, parseFloat,
    setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    requestAnimationFrame: (fn) => setTimeout(() => fn(0), 16),
    cancelAnimationFrame: clearTimeout,
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 720,
    navigator: { userAgent: opts.userAgent || 'node', maxTouchPoints: 0, language: 'en-US' },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
      clear: () => storage.clear(),
    },
    location: { href: 'http://localhost/paradox-vault/', search: opts.search || '', protocol: 'http:' },
    matchMedia: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {}, removeEventListener() {},
    document: {
      createElement: makeElement,
      documentElement: makeElement('html'),
      body: makeElement('body'),
      head: makeElement('head'),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {}, removeEventListener() {},
directionality: 'ltr',
    },
  };

  /* the shim object IS the window the scripts see */
  Object.assign(win, sandbox);
  sandbox.window = win;

  vm.createContext(sandbox);

  const loaded = [];
  for (const name of ['core', 'levels', 'entities']) {
    const file = path.join(JS_DIR, name + '.js');
    const code = fs.readFileSync(file, 'utf8');
    try {
      vm.runInContext(code, sandbox, { filename: file });
      loaded.push(name);
    } catch (e) {
      throw new Error('failed loading ' + name + '.js: ' + e.stack);
    }
  }

  const PV = sandbox.PV || win.PV;
  if (!PV) throw new Error('PV global was never created (loaded: ' + loaded.join(', ') + ')');
  return { PV, sandbox, window: win };
}

/* ---------------------------------------------------------------------
   A minimal world good enough to run Actor.step / device updates against.
   Mirrors the shape game.js's buildWorld produces, but built here so the
   tests do not depend on the integration layer.
   --------------------------------------------------------------------- */
function makeWorld(PV, vault) {
  const E = PV.Entities;
  const w = {
    vault,
    tick: 0,
    ticksLeft: 0,
    loopTicks: Math.round(vault.loopSeconds / PV.FIXED_DT),
    signals: Object.create(null),
    doorAt: new Array(vault.w * vault.h),
    plates: [], levers: [], terminals: [], receivers: [], doors: [],
    lasers: [], mirrors: [], vents: [], relics: [], sentries: [],
    props: [], lamps: [], skylights: [],
    echoes: [], allActors: [],
    exit: null,
    player: new E.Actor(vault.spawn.x, vault.spawn.y, false, -1),
    alert: 0, alertTarget: 0,
    rewindFx: 0,
    phase: 'playing',
    desyncs: 0,
    caught: 0,
    relicsHeldByAny: 0,
    onStep: null,
  };

  for (const o of vault.objects) {
    switch (o.t) {
      case 'plate': w.plates.push(new E.Plate(o)); break;
      case 'lever': w.levers.push(new E.Lever(o)); break;
      case 'terminal': w.terminals.push(new E.Terminal(o)); break;
      case 'receiver': w.receivers.push(new E.Receiver(o)); break;
      case 'door': w.doors.push(new E.Door(o, vault)); break;
      case 'laser': w.lasers.push(new E.Laser(o)); break;
      case 'mirror': w.mirrors.push(new E.Mirror(o)); break;
      case 'vent': w.vents.push(new E.Vent(o)); break;
      case 'relic': w.relics.push(new E.Relic(o, w.relics.length)); break;
      case 'sentry': w.sentries.push(new E.Sentry(o)); break;
      case 'exit': w.exit = new E.Exit(o); break;
      case 'prop': w.props.push({ x: o.x, y: o.y, kind: o.kind }); break;
      case 'lamp': w.lamps.push(o); break;
      case 'skylight': w.skylights.push(o); break;
      default: break;
    }
  }

  for (const dr of w.doors) {
    for (const tl of dr.tiles) {
      if (tl.x >= 0 && tl.y >= 0 && tl.x < vault.w && tl.y < vault.h) {
        w.doorAt[tl.y * vault.w + tl.x] = dr;
      }
    }
  }
  if (!w.exit) {
    w.exit = new E.Exit({ x: Math.floor(vault.spawn.x) - 1, y: Math.floor(vault.spawn.y) - 1, w: 2, h: 2 });
  }

  w.allActors.length = 0;
  w.allActors.push(w.player);
  return w;
}

/** Walk `inputs` (array of {x,y,action,dash}) through an actor, one fixed tick each. */
function driveActor(PV, world, actor, inputs) {
  const trail = [];
  for (let i = 0; i < inputs.length; i++) {
    actor.step(world, inputs[i]);
    trail.push([actor.x, actor.y]);
  }
  return trail;
}

/** Flood fill the walkable tiles reachable from a start tile. */
function reachable(vault, sx, sy) {
  const w = vault.w, h = vault.h;
  const seen = new Uint8Array(w * h);
  const q = [[Math.floor(sx), Math.floor(sy)]];
  const solid = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    return !!vault.grid[y * w + x].solid;
  };
  if (solid(q[0][0], q[0][1])) return seen;
  seen[q[0][1] * w + q[0][0]] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nb) {
      if (solid(nx, ny)) continue;
      const i = ny * w + nx;
      if (seen[i]) continue;
      seen[i] = 1;
      q.push([nx, ny]);
    }
  }
  return seen;
}

module.exports = { loadPV, makeWorld, driveActor, reachable, stubCtx };
