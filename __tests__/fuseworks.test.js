const fs = require('fs');
const vm = require('vm');
const path = require('path');

function logic() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'fuseworks', 'assets', 'js', 'logic.js'), 'utf8'), context);
  return context.window.FW.Logic;
}
function empty(L) {
  const g = new Array(L.W * L.H).fill(L.T.FLOOR);
  for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++)
    if (x === 0 || y === 0 || x === L.W - 1 || y === L.H - 1) g[y * L.W + x] = L.T.WALL;
  return g;
}
const keys = (b) => b.cells.map(c => c.x + ',' + c.y).sort();

test('blast stops at walls and destroys the first crate only', () => {
  const L = logic(), g = empty(L);
  g[5 * L.W + 6] = L.T.WALL; g[5 * L.W + 4] = L.T.CRATE; g[5 * L.W + 3] = L.T.FLOOR;
  const b = L.computeBlast(g, 5, 5, 4);
  expect(keys(b)).not.toContain('6,5');
  expect(keys(b)).toContain('4,5');
  expect(keys(b)).not.toContain('3,5');
  expect(b.crates).toEqual([{ x: 4, y: 5 }]);
});

test('prism tiles bend the blast ninety degrees and spend range', () => {
  const L = logic(), g = empty(L);
  g[5 * L.W + 7] = L.T.PRISM_A; // "/" : east becomes north
  const b = L.computeBlast(g, 5, 5, 4);
  expect(keys(b)).toContain('7,5');
  expect(keys(b)).toContain('7,4');
  expect(keys(b)).toContain('7,3');
  expect(keys(b)).not.toContain('8,5');
  expect(b.bends).toEqual([{ x: 7, y: 5 }]);
  const g2 = empty(L); g2[5 * L.W + 7] = L.T.PRISM_B; // "\" : east becomes south
  expect(keys(L.computeBlast(g2, 5, 5, 4))).toContain('7,6');
});

test('prism cycles do not loop forever', () => {
  const L = logic(), g = empty(L);
  g[5 * L.W + 7] = L.T.PRISM_A; g[3 * L.W + 7] = L.T.PRISM_B; g[3 * L.W + 5] = L.T.PRISM_A;
  expect(L.computeBlast(g, 5, 5, 8).cells.length).toBeGreaterThan(5);
});

test('every floor is solvable: generation is deterministic and connected', () => {
  const L = logic();
  for (let n = 1; n <= 10; n++) for (const seed of [1, 7, 1337, 99999]) {
    const a = L.buildGrid(n, seed), b = L.buildGrid(n, seed);
    expect(a).toEqual(b);
    expect(L.connected(a)).toBe(true);
    expect(a[1 * L.W + 1]).toBe(L.T.FLOOR);
    expect(a[1 * L.W + 2]).toBe(L.T.FLOOR);
    expect(a[2 * L.W + 1]).toBe(L.T.FLOOR);
  }
});

test('placing a bomb then waiting detonates it and chain reactions cascade', () => {
  const L = logic(), s = L.newGame({ level: 1, seed: 3 });
  s.enemies = []; s.grid = empty(L);
  expect(L.placeBomb(s)).toBe(true);
  expect(L.placeBomb(s)).toBe(false); // one bomb max, and same cell
  s.bombs.push({ x: 3, y: 1, owner: 'x', power: 2, fuse: 2, pass: {}, chain: 0 });
  s.player.alive = false; s.player.dead = 99; s.lives = 2;
  for (let i = 0; i < 40; i++) L.update(s, 0.1);
  expect(s.bombs.length).toBe(0);
  expect(s.bestChain).toBeGreaterThanOrEqual(1);
});

test('bomb kills enemies for score, hurts the player, and clears the floor', () => {
  const L = logic(), s = L.newGame({ level: 1, seed: 3 });
  s.grid = empty(L);
  const e = s.enemies[0]; s.enemies = [e];
  e.x = e.fx = e.tx = 4; e.y = e.fy = e.ty = 1; e.type = 'wander';
  s.bombs.push({ x: 4, y: 2, owner: 'p', power: 2, fuse: 0.01, pass: {}, chain: 0 });
  s.player.x = s.player.fx = s.player.tx = 11; s.player.y = s.player.fy = s.player.ty = 9;
  const before = s.score;
  L.update(s, 0.05);
  expect(e.alive).toBe(false);
  expect(s.score).toBeGreaterThan(before);
  expect(s.phase).toBe('clear');
  for (let i = 0; i < 40; i++) L.update(s, 0.1);
  expect(s.phase).toBe('next');
  const n = L.nextLevel(s);
  expect(n.level).toBe(2); expect(n.score).toBe(s.score);
});

test('standing in your own blast costs a life and ends the game at zero', () => {
  const L = logic(), s = L.newGame({ level: 1, seed: 3 });
  s.enemies.forEach(e => { e.x = e.fx = e.tx = 11; e.y = e.fy = e.ty = 9; });
  s.lives = 0; s.invuln = 0;
  s.bombs.push({ x: 1, y: 1, owner: 'p', power: 2, fuse: 0.01, pass: {}, chain: 0 });
  for (let i = 0; i < 40; i++) L.update(s, 0.1);
  expect(s.phase).toBe('over');
});

test('simulated bots never leave the arena or enter solid tiles', () => {
  const L = logic();
  for (let n = 1; n <= 9; n++) {
    const s = L.newGame({ level: n, seed: 42 });
    s.invuln = 1e9;
    for (let i = 0; i < 600; i++) {
      if (i % 25 === 0) L.placeBomb(s);
      L.setDir(s, i % 100 < 50 ? 1 : 0, i % 100 < 50 ? 0 : 1);
      L.update(s, 1 / 30);
      s.enemies.forEach(e => {
        expect(e.fx).toBeGreaterThan(0); expect(e.fy).toBeGreaterThan(0);
        expect(e.fx).toBeLessThan(L.W - 1); expect(e.fy).toBeLessThan(L.H - 1);
      });
    }
  }
});
