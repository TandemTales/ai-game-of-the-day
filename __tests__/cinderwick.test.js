const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const ctx = { Math, console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  ['core.js', 'sim.js'].forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'cinderwick', 'assets', 'js', f), 'utf8'), ctx, { filename: f });
  });
  return ctx.CW;
}
const CW = load();
const S = CW.Sim;
const run = (g, secs, input) => { for (let t = 0; t < secs; t += 1 / 60) S.step(g, 1 / 60, input); };
const clearArena = (g) => { for (let i = 0; i < g.tiles.length; i++) if (g.tiles[i] === CW.T.CRATE) g.tiles[i] = CW.T.FLOOR; g.critters.forEach((c) => (c.alive = false)); };

test('levels are deterministic and keep the start corner safe', () => {
  const a = S.buildLevel(3, 42), b = S.buildLevel(3, 42), c = S.buildLevel(3, 43);
  expect(a.tiles).toEqual(b.tiles);
  expect(a.tiles).not.toEqual(c.tiles);
  [[1, 1], [2, 1], [1, 2]].forEach(([x, y]) => expect(a.tiles[S.idx(x, y)]).toBe(CW.T.FLOOR));
});

test('every level hides its exit under a crate and fields critters', () => {
  for (let l = 1; l <= 6; l++) {
    const L = S.buildLevel(l, 7);
    expect(L.tiles[S.idx(L.exit.x, L.exit.y)]).toBe(CW.T.CRATE);
    expect(L.critters.length).toBeGreaterThanOrEqual(3 + l);
    L.critters.forEach((c) => expect(L.tiles[S.idx(c.tx, c.ty)]).toBe(CW.T.FLOOR));
  }
});

test('bombs are capped and cannot stack on a tile', () => {
  const g = S.newGame({ seed: 1 });
  expect(S.placeBomb(g)).toBe(true);
  expect(S.placeBomb(g)).toBe(false);
  expect(g.bombs.length).toBe(1);
});

test('a bomb detonates after its fuse and flames stop at walls', () => {
  const g = S.newGame({ seed: 1 }); clearArena(g);
  S.placeBomb(g);
  g.player.x = 5.5; g.player.y = 1.5; // step away from blast
  run(g, 3.1);
  expect(g.bombs.length).toBe(0);
  expect(g.events.some((e) => e.type === 'explode')).toBe(true);
  expect(g.flames.every((f) => g.tiles[S.idx(f.x, f.y)] !== CW.T.WALL)).toBe(true);
});

test('walking between bombs lays a cord, dormant bombs wait for the spark', () => {
  const g = S.newGame({ seed: 1 }); clearArena(g);
  S.placeBomb(g);
  const first = g.bombs[0];
  run(g, 1.0, { dx: 1 }); // walk east along row 1
  g.player.x = Math.floor(g.player.x) + 0.5;
  S.placeBomb(g);
  expect(g.bombs.length).toBe(2);
  expect(g.cords.length).toBe(1);
  expect(first.dormant).toBe(true);
  expect(g.cords[0].path.length).toBeGreaterThan(2);
  const tailFuse = g.tail.fuse, frozen = first.fuse;
  run(g, 1.0, { dx: 1 });
  expect(first.fuse).toBe(frozen); // dormant bomb never ticks
  expect(g.tail.fuse).toBeLessThan(tailFuse);
});

test('tail blast sparks down the cord and detonates the whole chain with a multiplier', () => {
  const g = S.newGame({ seed: 1 }); clearArena(g);
  S.placeBomb(g);
  run(g, 0.6, { dx: 1 }); g.player.x = Math.floor(g.player.x) + 0.5; S.placeBomb(g);
  run(g, 0.6, { dx: 1 }); g.player.x = Math.floor(g.player.x) + 0.5; S.placeBomb(g);
  expect(g.bombs.length).toBe(3);
  g.player.x = 1.5; g.player.y = 1.5; g.player.invuln = 99; // observer
  S.strike(g);
  run(g, 4);
  expect(g.bombs.length).toBe(0);
  expect(g.bestChain).toBe(3);
});

test('chain multiplier scales kill score', () => {
  const g = S.newGame({ seed: 1 }); clearArena(g);
  g.chain.count = 3;
  const before = g.score;
  const c = g.critters[0]; c.alive = true; c.x = 8.5; c.y = 1.5; c.tx = c.fx = 8; c.ty = c.fy = 1;
  g.flames.push({ x: 8, y: 1, t: 0.5, life: 0.5, dx: 0, dy: 0 });
  g.player.x = 1.5; g.player.y = 1.5;
  S.step(g, 1 / 60);
  expect(g.score - before).toBe(300);
});

test('flames kill the player, costing a life, then respawn with invulnerability', () => {
  const g = S.newGame({ seed: 1 }); clearArena(g);
  g.player.invuln = 0;
  g.flames.push({ x: 1, y: 1, t: 0.5, life: 0.5, dx: 0, dy: 0 });
  S.step(g, 1 / 60);
  expect(g.player.alive).toBe(false);
  expect(g.lives).toBe(2);
  run(g, 1.6);
  expect(g.player.alive).toBe(true);
  expect(g.player.invuln).toBeGreaterThan(0);
});

test('losing the last life ends the game', () => {
  const g = S.newGame({ seed: 1, lives: 0 }); clearArena(g);
  g.player.invuln = 0;
  g.flames.push({ x: 1, y: 1, t: 0.5, life: 0.5, dx: 0, dy: 0 });
  run(g, 3);
  expect(g.status).toBe('over');
});

test('exit opens only when critters are gone, and stepping on it wins the floor', () => {
  const g = S.newGame({ seed: 1 }); clearArena(g);
  g.tiles[S.idx(3, 1)] = CW.T.FLOOR;
  g.exit = { x: 3, y: 1, revealed: true };
  g.critters.push({ id: 99, kind: 'slug', x: 9.5, y: 9.5, tx: 9, ty: 9, fx: 9, fy: 9, dir: [1, 0], alive: true, speed: 0, stun: 0 });
  g.player.x = 3.5; g.player.y = 1.5;
  S.step(g, 1 / 60);
  expect(g.status).toBe('play');
  g.critters[g.critters.length - 1].alive = false;
  S.step(g, 1 / 60);
  expect(g.status).toBe('won');
  const lvl = g.level; S.nextLevel(g); expect(g.level).toBe(lvl + 1); expect(g.status).toBe('play');
});

test('player collides with walls and unwalked bombs', () => {
  const g = S.newGame({ seed: 1 }); clearArena(g);
  run(g, 1.5, { dx: -1 });
  expect(g.player.x).toBeGreaterThanOrEqual(1 + S.HALF - 0.01);
  g.player.x = 1.5; g.player.y = 1.5;
  S.placeBomb(g);
  run(g, 0.5, { dx: 1 }); run(g, 0.2, { dx: -1 });
  expect(g.player.x).toBeGreaterThan(2); // cannot walk back through the bomb
});

test('simulation is deterministic for a scripted input stream', () => {
  const play = () => {
    const g = S.newGame({ seed: 5 });
    for (let t = 0; t < 600; t++) S.step(g, 1 / 60, { dx: t % 120 < 60 ? 1 : 0, dy: t % 120 >= 60 ? 1 : 0, bomb: t % 150 === 0 });
    return JSON.stringify([g.score, g.player.x, g.player.y, g.critters.map((c) => [c.x, c.y])]);
  };
  expect(play()).toBe(play());
});
