'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
function load() {
  const s = { console, Math, Date, JSON, Uint8Array, Int16Array };
  s.window = s; s.globalThis = s;
  vm.createContext(s);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'blastwick', 'assets', 'js', 'logic.js'), 'utf8'), s);
  return s.BW;
}
const BW = load();
const C = BW.C;

function blank() {
  const w = BW.createWorld({ seed: 3, round: 1 });
  for (let y = 1; y < BW.H - 1; y++) for (let x = 1; x < BW.W - 1; x++) w.cells[y * BW.W + x] = (x % 2 === 0 && y % 2 === 0) ? C.WALL : C.FLOOR;
  return w;
}

test('arena is deterministic and spawns are clear', () => {
  const a = BW.createWorld({ seed: 9, round: 2 }), b = BW.createWorld({ seed: 9, round: 2 });
  expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
  for (const s of BW.SPAWNS) {
    expect(BW.cellAt(a, s[0], s[1])).toBe(C.FLOOR);
    expect(BW.cellAt(a, s[0] + (s[0] < 7 ? 1 : -1), s[1])).toBe(C.FLOOR);
    expect(BW.cellAt(a, s[0], s[1] + (s[1] < 6 ? 1 : -1))).toBe(C.FLOOR);
  }
});

test('blast stops at walls and destroys one crate', () => {
  const w = blank();
  w.cells[1 * BW.W + 3] = C.CRATE; w.cells[1 * BW.W + 4] = C.CRATE;
  const bl = BW.computeBlast(w, 1, 1, 5);
  expect(bl.crates).toEqual([[3, 1]]);
});

test('mirror reflects blast 90 degrees', () => {
  const w = blank();
  w.cells[1 * BW.W + 3] = C.MIRROR_B; // '\' : east -> south
  const bl = BW.computeBlast(w, 1, 1, 5);
  const hit = bl.cells.filter(c => c.x === 3 && c.y === 3);
  expect(hit.length).toBe(1);
  expect(hit[0].ref).toBe(true);
  w.cells[1 * BW.W + 3] = C.MIRROR_A; // '/' : east -> north (wall) 
  const bl2 = BW.computeBlast(w, 1, 1, 5);
  expect(bl2.cells.filter(c => c.x === 3 && c.y === 3).length).toBe(0);
});

test('banked blast kills rival and scores bonus', () => {
  const w = blank();
  w.cells[1 * BW.W + 3] = C.MIRROR_B;
  const p = w.actors[0], r = w.actors[1];
  w.actors.forEach((a, i) => { if (i > 1) a.alive = false; });
  r.x = 3.5; r.y = 3.5; r.invuln = 0; p.invuln = 0;
  w.bombs.push({ x: 1, y: 1, t: 0.01, owner: 0, range: 5, pass: [], chain: 0, uid: 1 });
  p.x = 1.5; p.y = 11.5; // away from blast
  BW.step(w, 0.05, {});
  expect(r.alive).toBe(false);
  expect(w.score).toBeGreaterThanOrEqual(1500);
  expect(w.bankShots).toBe(1);
});

test('chain reactions detonate neighbouring bombs', () => {
  const w = blank();
  w.actors.forEach((a, i) => { if (i > 0) a.alive = false; });
  w.actors[0].x = 13.5; w.actors[0].y = 11.5;
  w.bombs.push({ x: 1, y: 1, t: 0.01, owner: 0, range: 3, pass: [], chain: 0, uid: 1 });
  w.bombs.push({ x: 3, y: 1, t: 2, owner: 0, range: 2, pass: [], chain: 0, uid: 2 });
  BW.step(w, 0.05, {}); BW.step(w, 0.05, {});
  expect(w.bombs.length).toBe(0);
});

test('player movement is blocked by walls and bomb pass-through works', () => {
  const w = blank(); const p = w.actors[0];
  for (let i = 0; i < 60; i++) BW.step(w, 1 / 60, { mx: -1, my: 0 });
  expect(p.x).toBeGreaterThanOrEqual(1.3);
  BW.step(w, 1 / 60, { bomb: true });
  expect(w.bombs.length).toBe(1);
  for (let i = 0; i < 20; i++) BW.step(w, 1 / 60, { mx: 1, my: 0 });
  expect(p.x).toBeGreaterThan(1.9);
  for (let i = 0; i < 60; i++) BW.step(w, 1 / 60, { mx: -1, my: 0 });
  expect(p.x).toBeGreaterThan(2.0); // bomb now solid behind us
});

test('AI-only simulation finishes with no exceptions and sudden death resolves', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const w = BW.createWorld({ seed, round: 1 + (seed % 4) });
    w.actors[0].isPlayer = false;
    w.actors[0].ai = { path: null, think: 0, mode: 'idle', skill: 0.8 };
    for (let i = 0; i < 60 * 240 && w.state === 'play'; i++) BW.step(w, 1 / 60, {});
    expect(['won', 'lost']).toContain(w.state);
  }
});

test('AI uses bombs on its own', () => {
  const w = BW.createWorld({ seed: 4, round: 3 });
  let placed = 0;
  for (let i = 0; i < 60 * 30; i++) { BW.step(w, 1 / 60, {}); w.events.forEach(e => { if (e.type === 'place' && e.owner > 0) placed++; }); }
  expect(placed).toBeGreaterThan(2);
});
