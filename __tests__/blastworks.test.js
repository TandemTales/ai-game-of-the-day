const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../blastworks/assets/js/logic.js'), 'utf8'), ctx);
const BW = ctx.BW;
test('levels are deterministic and spawns are clear', () => {
  const a = BW.makeLevel(7, 1), b = BW.makeLevel(7, 1);
  expect(JSON.stringify(a.tiles)).toBe(JSON.stringify(b.tiles));
  a.spawns.forEach(([x, y]) => { expect(a.tiles[y][x]).toBe(0); expect(a.tiles[y][x + (x === 1 ? 1 : -1)]).toBe(0); });
});
test('bomb detonates after fuse, destroys crate, pressure rises', () => {
  const g = BW.newGame(3, 1), h = g.actors[0];
  g.tiles[1][2] = 2; g.tiles[1][3] = 0;
  expect(BW.placeBomb(g, h)).toBe(true); expect(g.pressure).toBeGreaterThan(0);
  expect(BW.placeBomb(g, h)).toBe(false);
  for (let i = 0; i < 40; i++) BW.step(g, 0.1, null);
  expect(g.bombs.filter(b => b.owner === 0).length).toBe(0); expect(g.tiles[1][2]).toBe(0);
});
test('flame kills standing player', () => {
  const g = BW.newGame(3, 1); BW.placeBomb(g, g.actors[0]);
  for (let i = 0; i < 30; i++) BW.step(g, 0.1, null);
  expect(g.actors[0].alive).toBe(false); expect(g.over).toBe(true);
});
test('quake detonates every bomb', () => {
  const g = BW.newGame(5, 1); g.pressure = 99;
  g.bombs.push({ x: 5, y: 1, t: 2, owner: 1, power: 1 }, { x: 9, y: 1, t: 2, owner: 2, power: 1 });
  g.actors[0].x = g.actors[0].px = 1; g.actors[0].y = 1;
  BW.placeBomb(g, g.actors[1]); BW.step(g, 0.05, null);
  expect(g.bombs.length).toBe(0);
});
test('AI simulation never throws and finishes', () => {
  for (let s = 1; s <= 5; s++) { const g = BW.newGame(s, 2);
    for (let i = 0; i < 3000 && !g.over; i++) BW.step(g, 1 / 30, { dx: 0, dy: 0, bomb: false }); expect(g.over).toBe(true); }
});
