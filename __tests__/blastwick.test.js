const fs = require('fs'), path = require('path'), vm = require('vm');
function load() {
  const ctx = { console, Math, Date }; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../blastwick/assets/js/logic.js'), 'utf8'), ctx);
  return ctx.BW.Logic;
}
const L = load();
const run = (st, secs, input) => { for (let i = 0; i < secs * 60; i++) L.update(st, 1 / 60, input); };

test('stage generation is deterministic and keeps spawn clear', () => {
  const a = L.newGame(42), b = L.newGame(42);
  expect(JSON.stringify(a.grid)).toBe(JSON.stringify(b.grid));
  expect(a.grid[1][1]).toBe(0); expect(a.grid[1][2]).toBe(0); expect(a.grid[2][1]).toBe(0);
  expect(a.enemies.length).toBeGreaterThan(0);
  expect(a.grid[a.exit.y][a.exit.x]).toBe(L.T.SOFT);
});

test('player cannot walk through pillars or soft blocks', () => {
  const st = L.newGame(1); st.enemies = [];
  run(st, 2, { ax: -1, ay: 0 });
  expect(st.player.x).toBeGreaterThan(1);
  run(st, 2, { ax: 0, ay: -1 });
  expect(st.player.y).toBeGreaterThan(1);
});

test('bomb detonates after fuse, destroys soft block, hurts player in blast', () => {
  const st = L.newGame(3); st.enemies = []; st.player.inv = 0;
  st.grid[1][2] = L.T.SOFT;
  expect(L.placeBomb(st)).toBe(true);
  expect(L.placeBomb(st)).toBe(false); // max one bomb
  run(st, 2.6, {});
  expect(st.grid[1][2]).toBe(L.T.FLOOR);
  expect(st.lives).toBe(2);
});

test('chain reaction detonates neighbouring bombs and awards chain bonus', () => {
  const st = L.newGame(5); st.enemies = []; st.player.x = 13.5; st.player.y = 11.5; st.player.inv = 99;
  for (let x = 1; x < 14; x++) st.grid[1][x] = L.T.FLOOR;
  const mk = (x, t) => st.bombs.push({ x, y: 1, t, range: 2, kind: 'cross', owner: 'p', id: x });
  mk(1, 2.4); mk(3, 9); mk(5, 9); mk(7, 9);
  const s0 = st.score;
  run(st, 3.2, {});
  expect(st.bombs.length).toBe(0);
  expect(st.score - s0).toBeGreaterThanOrEqual(4 * 4 * 25);
});

test('diag and ring blast shapes', () => {
  const st = L.newGame(7);
  for (let y = 1; y < 12; y++) for (let x = 1; x < 14; x++) if (st.grid[y][x] !== L.T.PILLAR) st.grid[y][x] = L.T.FLOOR;
  const d = L.blastCells(st, { x: 5, y: 5, range: 2, kind: 'diag' });
  expect(d.some(c => c.x === 7 && c.y === 7)).toBe(true);
  expect(d.some(c => c.x === 6 && c.y === 6)).toBe(false);
  expect(d.some(c => c.x === 6 && c.y === 5)).toBe(false);
  const r = L.blastCells(st, { x: 5, y: 5, range: 2, kind: 'ring' });
  expect(r.length).toBeGreaterThan(9);
});

test('killing all enemies opens exit; reaching it clears the stage', () => {
  const st = L.newGame(9); st.enemies = [];
  st.grid[st.exit.y][st.exit.x] = L.T.FLOOR;
  L.update(st, 1 / 60, {});
  expect(st.exitOpen).toBe(true);
  st.player.x = st.exit.x + 0.5; st.player.y = st.exit.y + 0.5;
  L.update(st, 1 / 60, {});
  expect(st.cleared).toBe(true);
  run(st, 2, {});
  expect(st.stage).toBe(2);
});

test('tide floods outer rings and respawn avoids water', () => {
  const st = L.newGame(11); st.enemies = []; st.player.x = 7.5; st.player.y = 6.5;
  run(st, st.cfg.tideDelay + st.cfg.tideStep + 1, { });
  expect(st.tideRing).toBeGreaterThanOrEqual(1);
  expect(st.grid[1][1]).toBe(L.T.WATER);
  expect(st.lives).toBe(3);
});

test('solvable: every stage has reachable exit once soft blocks are cleared', () => {
  for (let s = 1; s <= 8; s++) {
    const st = L.newGame(100 + s, { stage: s });
    const seen = {}, q = [[1, 1]]; seen['1,1'] = 1;
    while (q.length) { const [x, y] = q.shift(); [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
      const nx = x + dx, ny = y + dy; if (seen[nx + ',' + ny]) return;
      if (st.grid[ny][nx] === L.T.PILLAR) return; seen[nx + ',' + ny] = 1; q.push([nx, ny]); }); }
    expect(seen[st.exit.x + ',' + st.exit.y]).toBe(1);
  }
});
