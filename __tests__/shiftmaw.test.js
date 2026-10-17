const L = require('../shiftmaw/assets/js/levels.js');
const Sim = require('../shiftmaw/assets/js/sim.js');
const D = L.DIRS;

function runBot(seed, seconds, opts) {
  const s = Sim.create({ seed });
  const dt = Sim.FIXED;
  for (let i = 0, n = Math.floor(seconds / dt); i < n && s.state !== 'over'; i++) {
    if (s.state === 'play' && s.p.prog === 0) {
      // greedy: head to nearest mote by BFS in current phase, avoid active ghosts' tiles
      const m = s.m, f = L.distField(m, s.p.tx, s.p.ty, s.phase, 'p');
      let best = -1, bd = 1e9;
      for (let d = 0; d < 4; d++) {
        const nx = L.wrapX(m, s.p.tx + D[d].x), ny = s.p.ty + D[d].y;
        if (L.solid(m, nx, ny, s.phase, 'p')) continue;
        const nf = L.distField(m, nx, ny, s.phase, 'p');
        let md = 1e9;
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const c = m.grid[y][x]; if ((c === '.' || c === 'o') && nf[y * m.w + x] >= 0 && nf[y * m.w + x] < md) md = nf[y * m.w + x]; }
        let danger = 0;
        s.ghosts.forEach(g => { if (g.state === 'active' && !g.fright && Math.abs(g.tx - nx) + Math.abs(g.ty - ny) < 3) danger += 50; });
        if (md + danger < bd) { bd = md + danger; best = d; }
      }
      Sim.setWant(s, best);
    }
    Sim.update(s, dt);
    if (opts && opts.each) opts.each(s);
  }
  return s;
}

describe('shiftmaw levels', () => {
  test('every maze parses and is fully solvable in both phases', () => {
    L.MAZES.forEach((_, i) => { const m = L.get(i); expect(L.validate(m)).toEqual([]); expect(m.motes).toBeGreaterThan(80); });
  });
  test('maze has A and B walls so phase flips matter', () => {
    const m = L.get(0); let a = 0, b = 0;
    m.grid.forEach(r => r.forEach(c => { if (c === 'A') a++; if (c === 'B') b++; }));
    expect(a).toBeGreaterThan(3); expect(b).toBeGreaterThan(3);
  });
  test('phase walls are solid only in their phase; nest only passable to ghosts', () => {
    const m = L.get(0);
    expect(L.solid(m, 9, 1, 0, 'p')).toBe(true); expect(L.solid(m, 9, 1, 1, 'p')).toBe(false);
    expect(L.solid(m, 5, 3, 1, 'p')).toBe(true); expect(L.solid(m, 5, 3, 0, 'p')).toBe(false);
    expect(L.solid(m, m.door.x, m.door.y, 0, 'p')).toBe(true);
    expect(L.solid(m, m.door.x, m.door.y, 0, 'n')).toBe(false);
    expect(L.solid(m, m.door.x, m.door.y, 0, 'g')).toBe(true);
  });
});

describe('shiftmaw sim', () => {
  test('is deterministic for a seed', () => {
    const a = runBot(7, 30), b = runBot(7, 30);
    expect(a.score).toBe(b.score); expect(a.eaten).toBe(b.eaten); expect(a.p.tx).toBe(b.p.tx);
  });
  test('bot eats motes, scores, never leaves the maze or enters walls', () => {
    const s = runBot(3, 40, { each(s) {
      const x = Sim.px(s.p), y = Sim.py(s.p);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(s.m.h);
      expect(L.solid(s.m, s.p.tx, s.p.ty, s.phase, 'p')).toBe(false);
    } });
    expect(s.eaten).toBeGreaterThan(20); expect(s.score).toBeGreaterThan(200);
  });
  test('ghosts leave the nest and become active', () => {
    const seen = new Set();
    runBot(5, 40, { each(s) { s.lives = 9; s.ghosts.forEach(g => { if (g.state === 'active') seen.add(g.id); }); } });
    expect(seen.size).toBe(4);
  });
  test('flip needs charge, has cooldown, and costs one charge', () => {
    const s = Sim.create({ seed: 1 });
    expect(Sim.flip(s)).toBe(false); // not in play yet
    for (let i = 0; i < 300; i++) Sim.update(s, Sim.FIXED);
    expect(s.state).toBe('play'); expect(s.charge).toBe(1);
    expect(Sim.flip(s)).toBe(true); expect(s.phase).toBe(1); expect(s.charge).toBe(0);
    expect(Sim.flip(s)).toBe(false);
  });
  test('flip is refused if it would entomb the player', () => {
    const s = Sim.create({ seed: 1 });
    for (let i = 0; i < 300; i++) Sim.update(s, Sim.FIXED);
    s.p.tx = 5; s.p.ty = 3; s.p.dir = -1; s.p.prog = 0; s.p.want = -1; // standing on a B wall tile (open in phase 0)
    s.charge = 2;
    expect(Sim.flip(s)).toBe(false); expect(s.phase).toBe(0); expect(s.charge).toBe(2);
  });
  test('flipping pinches a ghost standing in a closing wall and chains the bonus', () => {
    const s = Sim.create({ seed: 1 });
    for (let i = 0; i < 300; i++) Sim.update(s, Sim.FIXED);
    s.charge = 3; s.p.tx = 1; s.p.ty = 19; s.p.dir = -1; s.p.prog = 0; s.p.want = -1;
    const g1 = s.ghosts[0], g2 = s.ghosts[1];
    [g1, g2].forEach(g => { g.state = 'active'; g.fright = false; g.dir = -1; g.prog = 0; });
    g1.tx = 5; g1.ty = 3; g2.tx = 13; g2.ty = 3; // both stand on B tiles
    const before = s.score;
    expect(Sim.flip(s)).toBe(true);
    expect(g1.state).toBe('eaten'); expect(g2.state).toBe('eaten');
    expect(s.score - before).toBe(400 + 800);
    expect(s.stats.bestChain).toBe(2);
  });
  test('touching a hunting ghost costs a life; game ends at zero lives', () => {
    const s = Sim.create({ seed: 2 });
    for (let i = 0; i < 300; i++) Sim.update(s, Sim.FIXED);
    const g = s.ghosts[0]; g.state = 'active'; g.fright = false; g.tx = s.p.tx; g.ty = s.p.ty; g.dir = -1; g.prog = 0;
    Sim.update(s, Sim.FIXED); expect(s.state).toBe('dying');
    for (let i = 0; i < 400; i++) Sim.update(s, Sim.FIXED);
    expect(s.lives).toBe(2); expect(s.state).toBe('ready');
    s.lives = 1; s.state = 'dying'; s.stateT = 5; Sim.update(s, Sim.FIXED);
    expect(s.state).toBe('over');
  });
  test('bloom frightens ghosts, which can be eaten for 200/400', () => {
    const s = Sim.create({ seed: 2 });
    for (let i = 0; i < 300; i++) Sim.update(s, Sim.FIXED);
    const g = s.ghosts[0]; g.state = 'active'; g.dir = -1; g.prog = 0; g.tx = 8; g.ty = 17;
    s.p.tx = 2; s.p.ty = 15; s.p.dir = 1; s.p.prog = 0.999; s.p.want = 1;
    Sim.update(s, 0.01);
    expect(s.frightT).toBeGreaterThan(0); expect(g.fright).toBe(true); expect(s.charge).toBe(2);
    g.tx = s.p.tx; g.ty = s.p.ty; g.prog = 0; g.dir = -1;
    const sc = s.score; Sim.update(s, Sim.FIXED);
    expect(s.score - sc).toBe(200); expect(g.state).toBe('eaten');
  });
  test('clearing the board advances the level and converts spare charge to bonus', () => {
    const s = Sim.create({ seed: 4 });
    for (let i = 0; i < 300; i++) Sim.update(s, Sim.FIXED);
    s.m.grid.forEach(r => r.forEach((c, x) => { }));
    let left = [];
    s.m.grid.forEach((r, y) => r.forEach((c, x) => { if (c === '.' || c === 'o') left.push([x, y]); }));
    left.slice(1).forEach(([x, y]) => { s.m.grid[y][x] = ' '; s.motesLeft--; });
    const [x, y] = left[0];
    s.p.tx = x - 0; s.p.ty = y; s.p.dir = -1; s.p.prog = 0;
    // step the player onto the last mote through public rules
    s.p.tx = x; s.p.ty = y;
    const eat = Sim.update; s.m.grid[y][x] = '.'; // ensure present
    s.p.want = 1; s.p.dir = 1; s.p.prog = 0.999; s.p.tx = x + 1;
    Sim.update(s, 0.01);
    expect(s.state).toBe('clear');
    const sc = s.score, ch = s.charge;
    for (let i = 0; i < 400; i++) Sim.update(s, Sim.FIXED);
    expect(s.level).toBe(2); expect(s.score - sc).toBe(ch * 500);
  });
});
