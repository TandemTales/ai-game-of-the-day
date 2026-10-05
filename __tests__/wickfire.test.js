const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const ctx = { Math, console, Uint8Array };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'wickfire/assets/js/logic.js'), 'utf8'), ctx);
  return ctx.WF;
}
const WF = load();
const idx = (x, y) => y * WF.W + x;
function blank(level) {
  const g = WF.createGame(5, level || 1);
  for (let y = 1; y < WF.H - 1; y++) for (let x = 1; x < WF.W - 1; x++) if (g.grid[idx(x, y)] === WF.T.CRATE) g.grid[idx(x, y)] = 0;
  g.enemies = [{ id: 99, type: 'wander', fx: 13, fy: 11, tx: 13, ty: 11, prog: 1, alive: true, dir: 0, wait: 99, bombCd: 99, dying: 0 }];
  return g;
}
function run(g, secs, input) { for (let t = 0; t < secs; t += 1 / 60) WF.step(g, 1 / 60, input); }
function walk(g, dx, dy, tiles) {
  for (let i = 0; i < tiles; i++) { WF.step(g, 1 / 60, { dx, dy }); run(g, 0.2, null); }
}

test('levels are deterministic and enemies are reachable', () => {
  for (let lv = 1; lv <= 8; lv++) {
    const a = WF.createGame(42, lv), b = WF.createGame(42, lv);
    expect(Array.from(a.grid)).toEqual(Array.from(b.grid));
    expect(a.enemies.map(e => [e.tx, e.ty, e.type])).toEqual(b.enemies.map(e => [e.tx, e.ty, e.type]));
    expect(WF.connected(a)).toBe(true);
    expect(a.enemies.length).toBeGreaterThan(0);
    expect(a.grid[idx(1, 1)]).toBe(0); expect(a.grid[idx(2, 1)]).toBe(0); expect(a.grid[idx(1, 2)]).toBe(0);
  }
});

test('player moves tile by tile and is blocked by walls', () => {
  const g = blank();
  WF.step(g, 1 / 60, { dx: 1, dy: 0 });
  expect(g.player.tx).toBe(2);
  run(g, 0.3, null);
  WF.step(g, 1 / 60, { dx: 0, dy: 1 }); // (2,2) is a pillar
  expect(g.player.ty).toBe(1);
  expect(g.player.tx).toBe(2);
});

test('bomb blasts crates, stops at walls, and respects range', () => {
  const g = blank();
  g.grid[idx(3, 1)] = WF.T.CRATE; g.grid[idx(4, 1)] = WF.T.CRATE;
  g.player.range = 3; g.player.inv = 0;
  expect(WF.dropBomb(g)).toBe(true);
  expect(WF.dropBomb(g)).toBe(false); // one bomb max
  walk(g, 0, 1, 2); // step down out of the way
  run(g, 2.6, null);
  expect(g.grid[idx(3, 1)]).toBe(0);
  expect(g.grid[idx(4, 1)]).toBe(WF.T.CRATE); // blast stopped at first crate
  expect(g.stats.crates).toBe(1);
});

test('chain reaction detonates neighbouring bombs and scores', () => {
  const g = blank();
  g.player.maxBombs = 3; g.player.inv = 99;
  g.bombs.push({ x: 2, y: 1, t: 0.05, range: 2, owner: 'p', pass: [] });
  g.bombs.push({ x: 4, y: 1, t: 2, range: 2, owner: 'p', pass: [] });
  g.bombs.push({ x: 6, y: 1, t: 2, range: 2, owner: 'p', pass: [] });
  const s0 = g.score;
  run(g, 0.2, null);
  expect(g.bombs.length).toBe(0);
  expect(g.stats.bestChain).toBe(3);
  expect(g.score).toBeGreaterThan(s0);
});

test('fuse: a blast on the trail races to bombs threaded on it', () => {
  const g = blank();
  g.player.inv = 99; g.player.maxBombs = 2;
  WF.dropBomb(g);                 // bomb at (1,1), threaded on the fuse
  walk(g, 1, 0, 3);               // lay fuse to (4,1)
  expect(g.trail.tiles.length).toBe(4);
  WF.cutFuse(g);                  // detach everything behind us
  expect(g.fuses.length).toBe(2);
  expect(g.trail.tiles.length).toBe(1);
  const detached = g.fuses.find(f => f.detached);
  expect(detached.tiles.length).toBe(3);
  // distant ignition: a fire on the far end of the detached fuse
  detached.tiles[2].state = 1; // far end catches fire
  g.bombs.forEach(b => { b.t = 99; });
  run(g, 0.05, null);
  run(g, 0.5, null);
  expect(g.bombs.length).toBe(0);   // bomb at (1,1) detonated through the fuse
  expect(g.events.length >= 0).toBe(true);
});

test('cutting the fuse saves the player from a burning trail', () => {
  const g = blank();
  g.player.inv = 0;
  walk(g, 1, 0, 3);
  // ignite the tail of the attached trail
  g.trail.tiles[0].state = 1;
  WF.cutFuse(g);
  run(g, 1, null);
  expect(g.player.alive).toBe(true);

  const g2 = blank();
  g2.player.inv = 0;
  walk(g2, 1, 0, 3);
  g2.trail.tiles[0].state = 1;
  run(g2, 1, null);
  expect(g2.player.alive).toBe(false);
  expect(g2.lives).toBe(2);
});

test('enemies die to fire, score, and clearing them completes the level', () => {
  const g = blank();
  g.player.inv = 99;
  g.fires.push({ x: 13, y: 11, t: 0.5 });
  const s0 = g.score;
  run(g, 0.1, null);
  expect(g.enemies[0].alive).toBe(false);
  expect(g.status).toBe('clear');
  expect(g.score).toBeGreaterThan(s0 + 100);
});

test('death costs a life, respawn restores play, last life ends the run', () => {
  const g = blank();
  g.player.inv = 0;
  g.fires.push({ x: 1, y: 1, t: 0.5 });
  run(g, 0.1, null);
  expect(g.status).toBe('dead');
  WF.respawn(g);
  expect(g.status).toBe('playing');
  expect(g.player.inv).toBeGreaterThan(0);
  g.lives = 1; g.player.inv = 0; g.fires.push({ x: 1, y: 1, t: 0.5 });
  run(g, 0.1, null);
  expect(g.status).toBe('over');
});

test('simulation of random play is deterministic and never throws', () => {
  function play(seed) {
    const g = WF.createGame(seed, 3); const r = WF.rng(seed);
    for (let i = 0; i < 3000 && g.status !== 'over'; i++) {
      const d = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]][Math.floor(r() * 5)];
      if (r() < 0.05) WF.dropBomb(g);
      if (r() < 0.03) WF.cutFuse(g);
      WF.step(g, 1 / 30, { dx: d[0], dy: d[1] });
      if (g.status === 'dead') WF.respawn(g);
      if (g.status === 'clear') break;
    }
    return g.score + ':' + g.lives + ':' + g.time.toFixed(2);
  }
  expect(play(7)).toBe(play(7));
  expect(play(8)).toBe(play(8));
});
