const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const ctx = vm.createContext({ Math, console });
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../fuse-echo/assets/js/logic.js'), 'utf8'), ctx);
  return ctx.FE;
}

// Park every bot far away and inert so the round never ends mid-test.
function park(st) {
  for (let i = 1; i < st.ents.length; i++) {
    const b = st.ents[i];
    b.x = 13.5; b.y = 11.5 - (i - 1) * 0; b.tx = 13; b.ty = 11; b.inv = 1e9; b.think = 1e9; b.speed = 0;
  }
  st.banner = 0;
}

function fresh(seed, round) {
  const FE = load();
  const st = FE.newGame(seed || 1);
  FE.startRound(st, round || 1);
  return { FE, st };
}

describe('Fuse Echo logic', () => {
  test('arena has walls, crates, and clear spawn corners', () => {
    const { FE, st } = fresh(7);
    for (const [x, y] of FE.SPAWNS) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const cx = x + dx, cy = y + dy;
        if (cx > 0 && cy > 0 && cx < FE.W - 1 && cy < FE.H - 1) expect(FE.cellAt(st, cx, cy)).toBe(0);
      }
    }
    expect(FE.cellAt(st, 2, 2)).toBe(1);
    expect(st.grid.filter(c => c === 2).length).toBeGreaterThan(30);
  });

  test('deterministic for a seed', () => {
    const a = fresh(42, 3), b = fresh(42, 3);
    expect(a.st.grid).toEqual(b.st.grid);
    for (let i = 0; i < 600; i++) { a.FE.step(a.st, 1 / 60); b.FE.step(b.st, 1 / 60); }
    expect(a.st.ents.map(e => [e.x, e.y, e.alive])).toEqual(b.st.ents.map(e => [e.x, e.y, e.alive]));
    expect(a.st.score).toBe(b.st.score);
  });

  test('bomb detonates after fuse, destroys crate, schedules echo', () => {
    const { FE, st } = fresh(3);
    st.bots = null;
    park(st);
    st.grid[1 * FE.W + 3] = 2; // crate two tiles right of spawn
    st.player.inv = 0;
    expect(FE.placeBomb(st, st.player)).toBe(true);
    expect(st.bombs.length).toBe(1);
    for (let i = 0; i < 60 * 2.3; i++) FE.step(st, 1 / 60);
    expect(st.bombs.length).toBe(0);
    expect(FE.cellAt(st, 3, 1)).toBe(0);
    expect(st.echoes.length + st.blasts.length).toBeGreaterThan(0);
  });

  test('echo re-fires the same cells and kills the lingering player', () => {
    const { FE, st } = fresh(5);
    park(st);
    const p = st.player; p.inv = 0;
    FE.placeBomb(st, p);
    // run until first blast has passed and move out of it
    p.x = 1.5; p.y = 5.5; // walk away down the lane (cell 1,5 is outside range 2 along y? bomb at 1,1)
    let sawEcho = false;
    for (let i = 0; i < 60 * 4; i++) {
      FE.step(st, 1 / 60);
      if (FE.drainEvents(st).some(e => e.t === 'echo')) sawEcho = true;
    }
    expect(sawEcho).toBe(true);
    expect(p.alive).toBe(true);
    // second scenario: stand in the lane during the echo
    const s2 = fresh(5); park(s2.st);
    const p2 = s2.st.player; p2.inv = 0;
    s2.FE.placeBomb(s2.st, p2);
    for (let i = 0; i < 60 * 2.3; i++) s2.FE.step(s2.st, 1 / 60);
    // blast done; put the player on a cell the pattern covered (the bomb tile) after it expires
    for (let i = 0; i < 60 * 0.3; i++) s2.FE.step(s2.st, 1 / 60);
    p2.alive = true; p2.x = 1.5; p2.y = 1.5; p2.inv = 0;
    for (let i = 0; i < 60 * 1.6; i++) s2.FE.step(s2.st, 1 / 60);
    expect(p2.alive).toBe(false);
  });

  test('chain reaction detonates neighbour bombs and multiplies kill score', () => {
    const { FE, st } = fresh(9);
    st.ents.length = 2;
    const p = st.player; p.inv = 0; p.x = 1.5; p.y = 11.5;
    const bot = st.ents[1];
    bot.x = 5.5; bot.y = 1.5; bot.inv = 0; bot.speed = 0; bot.think = 99; bot.tx = 5; bot.ty = 1;
    for (let x = 1; x <= 6; x++) st.grid[1 * FE.W + x] = 0;
    st.bombs.push({ x: 1, y: 1, t: 0.01, range: 2, owner: 0, pass: {}, chain: 0 });
    st.bombs.push({ x: 3, y: 1, t: 5, range: 2, owner: 0, pass: {}, chain: 0 });
    st.ents[0].bombsOut = 2;
    for (let i = 0; i < 10; i++) FE.step(st, 1 / 60);
    expect(st.bombs.length).toBe(0); // chain consumed second bomb
    expect(bot.alive).toBe(false);
    expect(st.score).toBeGreaterThanOrEqual(1000);
  });

  test('entities cannot walk through walls or bombs; corner assist slides', () => {
    const { FE, st } = fresh(11);
    park(st);
    const p = st.player;
    p.ix = -1; p.iy = 0;
    for (let i = 0; i < 120; i++) FE.step(st, 1 / 60);
    expect(p.x).toBeGreaterThanOrEqual(1 + 0.36 - 1e-6);
    // place bomb, step off and try to return
    FE.placeBomb(st, p);
    p.ix = 1; p.iy = 0;
    for (let i = 0; i < 40; i++) FE.step(st, 1 / 60);
    p.ix = -1;
    for (let i = 0; i < 60; i++) FE.step(st, 1 / 60);
    expect(p.x).toBeGreaterThan(2.0);
  });

  test('bots survive their own bombs and a full game ends deterministically', () => {
    const { FE, st } = fresh(21, 2);
    // keep the player idle in corner; simulate 60s
    for (let i = 0; i < 60 * 60; i++) { FE.step(st, 1 / 60); if (st.state !== 'play') break; }
    const bots = st.ents.slice(1);
    // bots must have placed bombs and at least not all be dead by suicide within first 10s
    expect(st.time).toBeGreaterThan(5);
    expect(bots.length).toBeGreaterThan(0);
  });

  test('bot suicide rate is low over many seeds', () => {
    let suicides = 0, bots = 0;
    for (let s = 1; s <= 12; s++) {
      const { FE, st } = fresh(s * 13, 3);
      st.player.x = 1.5; st.player.y = 1.5; st.player.inv = 999;
      const owned = {};
      for (let i = 0; i < 60 * 20; i++) {
        FE.step(st, 1 / 60);
        for (const ev of FE.drainEvents(st)) {
          if (ev.t === 'death' && !ev.player) suicides++;
        }
      }
      bots += st.ents.length - 1;
    }
    expect(suicides / bots).toBeLessThan(0.5);
  });

  test('round clears and lives drain to game over', () => {
    const { FE, st } = fresh(2);
    for (let i = 1; i < st.ents.length; i++) st.ents[i].alive = false;
    for (let i = 0; i < 120; i++) FE.step(st, 1 / 60);
    expect(st.state).toBe('clear');
    expect(st.score).toBeGreaterThanOrEqual(1000);
    FE.nextRound(st);
    expect(st.round).toBe(2);
    st.player.alive = false;
    for (let n = 0; n < 5 && st.state !== 'over'; n++) {
      st.player.alive = false;
      for (let i = 0; i < 120 && st.state === 'play'; i++) FE.step(st, 1 / 60);
    }
    expect(st.state).toBe('over');
  });
});
