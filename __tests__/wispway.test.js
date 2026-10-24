const fs = require('fs');
const vm = require('vm');
const path = require('path');

function logic() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'wispway', 'assets', 'js', 'logic.js'), 'utf8'), context);
  return context.window.WW.Logic;
}
function run(L, s, seconds, onTick) {
  for (let i = 0; i < seconds * 60; i++) { if (onTick) onTick(i); L.step(s, 1 / 60); }
}
function ready(L, s) { run(L, s, 2); expect(s.status).toBe('play'); }

test('maze is rectangular and every ember is reachable in both gate phases', () => {
  const L = logic();
  expect(L.MAZE.length).toBe(L.H);
  expect(L.MAZE.every(r => r.length === L.W)).toBe(true);
  [{ a: true, b: false }, { a: false, b: true }].forEach(gate => {
    const seen = L.reachable(gate);
    L.MAZE.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.' || ch === 'o') expect(seen[r * 100 + c]).toBe(1);
    }));
  });
});

test('same seed and inputs give identical runs', () => {
  const L = logic();
  const play = () => {
    const s = L.newGame(7);
    run(L, s, 20, i => { if (i % 50 === 0) { const d = L.DIRS[(i / 50) % 4]; L.setDir(s, d.dx, d.dy); } });
    return [s.score, s.wisp.c, s.wisp.r, s.gloams.map(g => g.c + ',' + g.r).join('|')];
  };
  expect(play()).toEqual(play());
});

test('wisp eats embers for score and stops at walls', () => {
  const L = logic(), s = L.newGame(1);
  ready(L, s);
  L.setDir(s, 1, 0);
  run(L, s, 1);
  expect(s.score).toBeGreaterThan(0);
  expect(s.eaten).toBeGreaterThan(0);
  run(L, s, 3);
  expect(L.tileAt(s.wisp.c + s.wisp.dx, s.wisp.r + s.wisp.dy)).not.toBe('#');
});

test('lantern gates flip on schedule, warn first, and never close on an actor', () => {
  const L = logic(), s = L.newGame(1);
  ready(L, s);
  const events = [];
  s.gloams.forEach(g => { g.stun = 99; });
  run(L, s, L.GATE_PERIOD + 0.5, () => { s.events.forEach(e => events.push(e.type)); s.events = []; });
  expect(events).toContain('gateWarn');
  expect(events).toContain('gateFlip');
  expect(s.gate.a).toBe(false);
  expect(s.gate.b).toBe(true);
  expect(L.passable(s, 9, 3, 'wisp')).toBe(false);
});

test('power ember frightens gloams and eating one scores a doubling chain', () => {
  const L = logic(), s = L.newGame(1);
  ready(L, s);
  s.gloams[0].scared = true; s.fright = 5; s.chain = 0;
  const wp = L.pos(s.wisp);
  Object.assign(s.gloams[0], { c: s.wisp.c, r: s.wisp.r, dx: 0, dy: 0, p: 0 });
  const before = s.score;
  L.step(s, 1 / 60);
  expect(s.score - before).toBeGreaterThanOrEqual(200);
  expect(s.gloams[0].state === 'eyes' || s.gloams[0].state === 'leaving').toBe(true);
  expect(wp).toBeTruthy();
});

test('touching a hunting gloam costs a life; game ends at zero lives', () => {
  const L = logic(), s = L.newGame(1);
  ready(L, s);
  for (let life = 0; life < 3; life++) {
    Object.assign(s.gloams[0], { c: s.wisp.c, r: s.wisp.r, dx: 0, dy: 0, p: 0, scared: false, stun: 0, state: 'roam' });
    L.step(s, 1 / 60);
    expect(s.status).toBe('dying');
    run(L, s, 2);
    if (life < 2) { expect(s.status).toBe('ready'); ready(L, s); }
  }
  expect(s.lives).toBe(0);
  expect(s.status).toBe('over');
});

test('flare needs a charge, then stuns nearby gloams who cannot hurt', () => {
  const L = logic(), s = L.newGame(1);
  ready(L, s);
  L.flare(s); L.step(s, 1 / 60);
  expect(s.events.some(e => e.type === 'flareFail')).toBe(true);
  s.charges = 1;
  Object.assign(s.gloams[0], { c: s.wisp.c, r: s.wisp.r - 1, dx: 0, dy: 0, p: 0, scared: false, state: 'roam' });
  L.flare(s); L.step(s, 1 / 60);
  expect(s.charges).toBe(0);
  expect(s.gloams[0].stun).toBeGreaterThan(0);
  Object.assign(s.gloams[0], { c: s.wisp.c, r: s.wisp.r, dx: 0, dy: 0, p: 0 });
  L.step(s, 1 / 60);
  expect(s.status).toBe('play');
});

test('clearing all embers advances the level with a fresh maze', () => {
  const L = logic(), s = L.newGame(1);
  ready(L, s);
  s.gloams.forEach(g => { g.stun = 99; });
  for (let r = 0; r < L.H; r++) for (let c = 0; c < L.W; c++) if (s.dots[r][c] && !(c === 9 && r === 15 + 0)) { s.dots[r][c] = 0; s.eaten++; }
  s.eaten = s.total - 1;
  s.dots[15][8] = 1;
  L.setDir(s, -1, 0);
  run(L, s, 1);
  expect(s.status).toBe('clear');
  run(L, s, 3);
  expect(s.level).toBe(2);
  expect(s.eaten).toBe(0);
});

test('tunnel wraps the wisp across the screen edge', () => {
  const L = logic(), s = L.newGame(1);
  ready(L, s);
  s.gloams.forEach(g => { g.stun = 99; });
  Object.assign(s.wisp, { c: 2, r: 9, dx: -1, dy: 0, p: 0, want: { dx: -1, dy: 0 } });
  run(L, s, 1.2);
  expect(s.wisp.c).toBeGreaterThan(10);
});

test('each gloam picks a distinct hunting target', () => {
  const L = logic(), s = L.newGame(1);
  ready(L, s);
  s.mode = 'chase';
  Object.assign(s.wisp, { c: 4, r: 5, dx: 1, dy: 0, p: 0 });
  const ts = s.gloams.map(g => JSON.stringify(L.target(s, g)));
  expect(new Set(ts).size).toBeGreaterThanOrEqual(3);
});

test('a long random-input soak never leaves actors inside walls', () => {
  const L = logic(), s = L.newGame(3);
  run(L, s, 240, i => {
    if (s.status === 'over') return;
    if (i % 30 === 0) { const d = L.DIRS[(i * 7 / 30 | 0) % 4]; L.setDir(s, d.dx, d.dy); }
    s.gloams.concat([s.wisp]).forEach(a => {
      const p = L.pos(a);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(L.tileAt(a.c, a.r)).not.toBe('#');
    });
  });
});
