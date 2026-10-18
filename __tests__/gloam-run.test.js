const fs = require('fs');
const vm = require('vm');
const path = require('path');

function logic() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gloam-run', 'assets', 'js', 'logic.js'), 'utf8'), context);
  return context.window.GR.Logic;
}
const sim = (L, g, secs, dir) => { for (let i = 0; i < secs * 60; i++) { if (dir) L.setDir(g, dir(g)); L.update(g, 1 / 60); } };

test('maze is rectangular and every ember, rune and both shutter states are reachable', () => {
  const L = logic();
  expect(L.MAP.every(r => r.length === L.W)).toBe(true);
  const key = (c, r, s) => c + ',' + r + ',' + s, seen = new Set([key(9, 15, 0)]), q = [[9, 15, 0]];
  while (q.length) {
    const [c, r, s] = q.shift(), nxt = [];
    for (const d of L.DIRS) { const nc = L.wrap(c + d.c), nr = r + d.r; if (L.open(nc, nr, s)) nxt.push([nc, nr, s]); }
    if (L.cell(c, r) === 'R') nxt.push([c, r, 1 - s]);
    for (const n of nxt) if (!seen.has(key(...n))) { seen.add(key(...n)); q.push(n); }
  }
  for (let r = 0; r < L.H; r++) for (let c = 0; c < L.W; c++)
    if ('.oR'.includes(L.cell(c, r))) expect(seen.has(key(c, r, 0)) || seen.has(key(c, r, 1))).toBe(true);
});

test('shutters block in exactly one state each', () => {
  const L = logic();
  expect(L.open(5, 7, 0)).toBe(true); expect(L.open(5, 7, 1)).toBe(false);
  expect(L.open(13, 7, 0)).toBe(false); expect(L.open(13, 7, 1)).toBe(true);
});

test('player collects embers and scores; walls block', () => {
  const L = logic(), g = L.newGame(3), total = g.embers;
  L.setDir(g, L.DIRS[1]); sim(L, g, 0.6);
  expect(g.embers).toBeLessThan(total); expect(g.score).toBeGreaterThan(0);
  const p = g.player; L.setDir(g, L.DIRS[0]); sim(L, g, 0.2);
  expect(L.cell(p.c, p.r)).not.toBe('#');
});

test('rune pad previews then flips shutters, with cooldown', () => {
  const L = logic(), g = L.newGame(1);
  g.player.c = 2; g.player.r = 15; g.player.face = 3; L.setDir(g, L.DIRS[3]);
  sim(L, g, 0.4);
  expect(g.flip).toBeGreaterThan(0); expect(g.state).toBe(0);
  sim(L, g, 1.2, () => L.DIRS[3]);
  expect(g.state).toBe(1); expect(g.flipCount).toBe(1);
});

test('simulation is deterministic for a given seed and input script', () => {
  const L = logic(), run = () => {
    const g = L.newGame(7);
    for (let i = 0; i < 1200; i++) { if (i % 90 === 0) L.setDir(g, L.DIRS[(i / 90) % 4]); L.update(g, 1 / 60); }
    return [g.score, g.lives, g.player.c, g.player.r, g.wispList.map(w => w.c + ':' + w.r).join()];
  };
  expect(run()).toEqual(run());
});

test('lantern ember frightens wisps, eating them chains points; contact otherwise costs a life', () => {
  const L = logic(), g = L.newGame(2);
  g.wispList.forEach(w => { w.state = 'roam'; w.c = 17; w.r = 17; });
  g.player.c = 2; g.player.r = 1; g.player.face = 1; L.setDir(g, L.DIRS[1]);
  sim(L, g, 0.3);
  expect(g.fright).toBeGreaterThan(0);
  const w = g.wispList[0]; w.state = 'frightened'; w.c = g.player.c; w.r = g.player.r; w.t = 0; w.dc = 0; w.dr = 0;
  const before = g.score; L.update(g, 1 / 60);
  expect(g.score).toBeGreaterThan(before); expect(w.state).toBe('eaten');
  const g2 = L.newGame(2), w2 = g2.wispList[1];
  w2.state = 'roam'; w2.c = g2.player.c; w2.r = g2.player.r;
  L.update(g2, 1 / 60);
  expect(g2.lives).toBe(2);
});

test('game over after the last life and a cleared maze advances the level', () => {
  const L = logic(), g = L.newGame(4);
  g.lives = 1; g.wispList[0].state = 'roam'; g.wispList[0].c = g.player.c; g.wispList[0].r = g.player.r;
  L.update(g, 1 / 60); sim(L, g, 2);
  expect(g.over).toBe(true);
  const h = L.newGame(4); h.embers = 1; h.grid.forEach(r => r.forEach((ch, i) => { if (ch === '.' || ch === 'o') r[i] = ' '; }));
  h.grid[15][8] = '.'; h.player.face = 1; L.setDir(h, L.DIRS[1]); sim(L, h, 0.5);
  expect(h.cleared).toBe(true); L.nextLevel(h); expect(h.level).toBe(2); expect(h.cleared).toBe(false);
});
