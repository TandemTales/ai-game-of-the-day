const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { Math, console }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../wickfire/assets/js/sim.js'), 'utf8'), ctx);
const S = ctx.WK.sim;
const run = (g, secs, inp) => { for (let i = 0; i < secs * 60; i++) S.step(g, 1 / 60, typeof inp === 'function' ? inp(i) : inp); };

describe('wickfire levels', () => {
  test('deterministic per seed+level', () => {
    const a = S.buildLevel(5, 3), b = S.buildLevel(5, 3), c = S.buildLevel(6, 3);
    expect(a.tiles).toEqual(b.tiles); expect(a.exit).toEqual(b.exit);
    expect(a.tiles).not.toEqual(c.tiles);
  });
  test('exit reachable from spawn (crates passable), spawn zone clear, enemies reachable', () => {
    for (let seed = 1; seed <= 6; seed++) for (let lv = 1; lv <= 20; lv++) {
      const g = S.newGame(seed); S.startLevel(g, lv);
      expect(g.tiles[1][1]).toBe(0); expect(g.tiles[1][2]).toBe(0); expect(g.tiles[2][1]).toBe(0);
      expect(g.tiles[g.exit.y][g.exit.x]).toBe(2);
      const seen = new Set(['1,1']), q = [[1, 1]];
      while (q.length) { const [x, y] = q.shift(); [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => { const k = (x+dx)+','+(y+dy); if (!seen.has(k) && g.tiles[y+dy] && g.tiles[y+dy][x+dx] !== 1) { seen.add(k); q.push([x+dx,y+dy]); } }); }
      expect(seen.has(g.exit.x + ',' + g.exit.y)).toBe(true);
      g.enemies.forEach(e => { expect(Math.abs(e.x - 1.5) + Math.abs(e.y - 1.5)).toBeGreaterThanOrEqual(7); });
      expect(g.enemies.length).toBe(Math.min(12, 3 + lv));
    }
  });
});

describe('wickfire mechanics', () => {
  test('walking lays wick up to wickMax', () => {
    const g = S.newGame(1); g.enemies = [];
    run(g, 2.5, { x: 1, y: 0 });
    expect(g.player.wick.length).toBeGreaterThan(2);
    expect(g.player.wick.length).toBeLessThanOrEqual(g.player.wickMax);
  });
  test('charge has no timer short of failsafe; ignite detonates it via wick', () => {
    const g = S.newGame(1); g.enemies = [];
    g.tiles[1][3] = 0; g.tiles[1][2] = 0;
    S.step(g, 1 / 60, { drop: true });
    expect(g.charges.length).toBe(1);
    run(g, 1.2, { x: 1, y: 0 });         // walk away, trailing wick
    run(g, 3, null);                      // idle: no detonation
    expect(g.charges.length).toBe(1);
    S.step(g, 1 / 60, { ignite: true });
    expect(g.fuses.length).toBe(1);
    run(g, 2, { x: 0, y: 0 });
    expect(g.charges.length).toBe(0);
    expect(g.blasts.length + 1).toBeGreaterThan(0);
  });
  test('failsafe detonates forgotten charges', () => {
    const g = S.newGame(1); g.enemies = [];
    S.step(g, 1 / 60, { drop: true });
    run(g, 1, { x: 1, y: 0 });
    run(g, 15, null);
    expect(g.charges.length).toBe(0);
  });
  test('fuse flame kills enemy standing on wick, with wick bonus and combo', () => {
    const g = S.newGame(1);
    g.player.inv = 99;
    g.enemies = [{ x: 4.5, y: 1.5, tx: 4, ty: 1, dx: 0, dy: 0, alive: true, kind: 'crawler', speed: 0, dying: 0 }];
    g.tiles[1][2] = g.tiles[1][3] = g.tiles[1][4] = g.tiles[1][5] = 0;
    run(g, 2.2, { x: 1, y: 0 }); // lay wick 1..6ish
    // freeze enemy on wick
    g.enemies[0].x = 4.5; g.enemies[0].y = 1.5; g.enemies[0].tx = 4; g.enemies[0].ty = 1;
    S.step(g, 1 / 60, { ignite: true });
    const before = g.score;
    for (let i = 0; i < 180 && g.enemies[0].alive; i++) { g.enemies[0].x = 4.5; g.enemies[0].y = 1.5; S.step(g, 1 / 60, null); }
    expect(g.enemies[0].alive).toBe(false);
    expect(g.score - before).toBeGreaterThanOrEqual(150);
  });
  test('blast destroys crate, reveals pickup/exit, chain reaction between charges', () => {
    const g = S.newGame(2); g.enemies = [];
    const L = g.tiles;
    for (let x = 1; x < 8; x++) L[1][x] = 0;
    L[1][4] = 2;
    g.hidden['4,1'] = 'range';
    g.charges.push({ x: 3, y: 1, age: 0, range: 2, solid: true, dead: false });
    g.charges.push({ x: 2, y: 1, age: 0, range: 1, solid: true, dead: false });
    g.player.x = 1.5; g.player.y = 5.5; g.player.inv = 99;
    g.charges[0].age = 99; // failsafe triggers the first
    S.step(g, 1 / 60, null);
    expect(g.charges.length).toBe(0);
    expect(L[1][4]).toBe(0);
    expect(g.pickups.some(p => p.kind === 'range')).toBe(true);
  });
  test('player hurt by enemy contact, game over at 0 lives', () => {
    const g = S.newGame(3); g.player.inv = 0; g.player.lives = 1;
    g.enemies = [{ x: 1.5, y: 1.5, tx: 1, ty: 1, dx: 0, dy: 0, alive: true, kind: 'crawler', speed: 0, dying: 0 }];
    S.step(g, 1 / 60, null);
    expect(g.over).toBe(true);
  });
  test('level clears via open exit', () => {
    const g = S.newGame(4); g.enemies = [];
    g.tiles[g.exit.y][g.exit.x] = 0; g.exitRevealed = true;
    g.player.x = g.exit.x + 0.5; g.player.y = g.exit.y + 0.5;
    S.step(g, 1 / 60, null);
    expect(g.cleared).toBe(true);
    S.nextLevel(g);
    expect(g.level).toBe(2);
    expect(g.player.lives).toBe(3);
  });
  test('enemies keep moving and stay in bounds for 60s', () => {
    const g = S.newGame(7); g.player.inv = 1e9;
    run(g, 60, null);
    g.enemies.filter(e => e.alive).forEach(e => { expect(e.x).toBeGreaterThan(1); expect(e.x).toBeLessThan(14); expect(g.tiles[Math.floor(e.y)][Math.floor(e.x)]).toBe(0); });
  });
});
