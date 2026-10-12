'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
function load() {
  const context = { window: {}, Math, Number, isFinite, Object, JSON };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../shiftwick/assets/js/logic.js'), 'utf8'), context);
  return context.window.SW;
}
let SW, s;
beforeEach(() => { SW = load(); s = SW.create({ seed: 5 }); });
function run(sec, fn) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { if (fn) fn(i); SW.step(s, 1 / 60); } }
function skipReady() { run(2); }

test('every level maze is fully connected with a walled border, house and motes', () => {
  for (let l = 1; l <= 12; l++) {
    const t = SW.create(); SW.startLevel(t, l);
    expect(SW.connected(t, SW.PLAYER_START.c, SW.PLAYER_START.r)).toBe(true);
    expect(t.motesLeft).toBeGreaterThan(80);
    expect(t.cells[SW.HOUSE.door.r][SW.HOUSE.door.c].w).toBe(0);
    for (let r = 0; r < SW.H; r++) { expect(t.cells[r][0].w).toBe(1); expect(t.cells[r][SW.W - 1].w).toBe(1); }
  }
});
test('maze generation is deterministic', () => {
  expect(JSON.stringify(SW.generateMaze(77))).toBe(JSON.stringify(SW.generateMaze(77)));
  expect(JSON.stringify(SW.generateMaze(77))).not.toBe(JSON.stringify(SW.generateMaze(78)));
});
test('few dead ends in the level 1 maze', () => {
  const g = SW.generateMaze(SW.levelParams(1).seed);
  let dead = 0;
  for (let r = 1; r < SW.H - 1; r++) for (let c = 1; c < SW.W - 1; c++) {
    if (g[r][c]) continue; let n = 0;
    ['up','down','left','right'].forEach(d => { if (!g[r + SW.DIRS[d][1]][c + SW.DIRS[d][0]]) n++; });
    if (n <= 1) dead++;
  }
  expect(dead).toBeLessThan(8);
});
test('player eats motes for score and stays on open tiles', () => {
  skipReady(); expect(s.status).toBe('playing');
  const before = s.score; SW.setDir(s, 'left'); run(1.5);
  expect(s.score).toBeGreaterThan(before); expect(s.stats.motes).toBeGreaterThan(0);
  expect(s.cells[Math.round(s.player.y)][Math.round(s.player.x)].w).toBe(0);
});
test('idle play earns nothing and the player is caught', () => {
  skipReady(); run(120);
  expect(s.score).toBeLessThan(50);
  expect(s.lives).toBeLessThan(3);
});
test('ghosts leave the house on schedule', () => {
  skipReady(); run(30, () => SW.setDir(s, 'left'));
  s.ghosts.forEach(g => expect(g.mode === 'house').toBe(false));
});
test('eating frightened ghosts scores a doubling chain', () => {
  skipReady();
  s.frightLeft = 5; s.ghosts.forEach(g => { g.mode = 'out'; g.frightened = true; });
  const p = s.player; s.ghosts[0].x = p.x; s.ghosts[0].y = p.y; s.ghosts[1].x = p.x; s.ghosts[1].y = p.y;
  const sc = s.score; SW.step(s, 1 / 60);
  expect(s.score - sc).toBe(200 + 400);
  expect(s.ghosts[0].mode).toBe('eaten');
});
test('touching an active ghost kills; zero lives is game over', () => {
  skipReady();
  s.ghosts[0].mode = 'out'; s.ghosts[0].frightened = false; s.ghosts[0].x = s.player.x; s.ghosts[0].y = s.player.y;
  SW.step(s, 1 / 60); expect(s.status).toBe('dying');
  run(2); expect(s.lives).toBe(2);
  s.lives = 1; skipReady();
  s.ghosts[0].mode = 'out'; s.ghosts[0].x = s.player.x; s.ghosts[0].y = s.player.y;
  SW.step(s, 1 / 60); run(2); expect(s.status).toBe('gameover');
});
test('sliding rows keep the maze connected and every actor on a legal tile', () => {
  for (let seed = 1; seed < 15; seed++) {
    s = SW.create({ seed }); SW.startLevel(s, 1 + (seed % 5)); skipReady();
    for (let k = 0; k < 6; k++) {
      SW.beginTelegraph(s);
      if (!s.shift) continue;
      expect(s.shift.phase).toBe('warn');
      run(s.params.telegraph + 0.1);
      run(1);
      const wall = (e) => s.cells[Math.round(e.y)][Math.round(e.x)].w;
      expect(wall(s.player)).toBe(0);
      s.ghosts.forEach(g => expect(wall(g)).toBe(0));
      expect(SW.connected(s, Math.round(s.player.x), Math.round(s.player.y))).toBe(true);
      s.status = 'playing'; s.lives = 3; s.nextShift = s.time;
    }
  }
});
test('shifts conserve wall and mote counts', () => {
  skipReady();
  const count = () => { let w = 0, m = 0; s.cells.forEach(r => r.forEach(c => { w += c.w; m += c.item ? 1 : 0; })); return [w, m]; };
  const a = count(); SW.beginTelegraph(s); run(s.params.telegraph + 1);
  const b = count(); expect(b[0]).toBe(a[0]); expect(b[1]).toBe(s.motesLeft);
});
test('clearing all motes advances the level with a bonus', () => {
  skipReady();
  s.cells.forEach(r => r.forEach(c => { c.item = 0; }));
  const p = s.player; p.x = 9; p.y = 17; s.cells[17][9].item = 1; s.motesLeft = 1;
  const sc = s.score; SW.step(s, 1 / 60);
  expect(s.status).toBe('levelclear'); expect(s.score - sc).toBe(10 + 500 + 1000);
  run(3); expect(s.level).toBe(2);
});
test('identical inputs replay deterministically', () => {
  const A = SW.create({ seed: 9 }), B = SW.create({ seed: 9 });
  const dirs = ['left', 'up', 'right', 'down'];
  for (let i = 0; i < 3000; i++) { const d = dirs[(i / 70 | 0) % 4]; SW.setDir(A, d); SW.setDir(B, d); SW.step(A, 1 / 60); SW.step(B, 1 / 60); }
  expect(JSON.stringify(A)).toBe(JSON.stringify(B));
});
test('nonfinite dt ignored', () => { SW.step(s, NaN); SW.step(s, -1); expect(s.time).toBe(0); });
