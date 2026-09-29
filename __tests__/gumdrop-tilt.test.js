const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGT() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'gumdrop-tilt', 'assets', 'js', 'logic.js'), 'utf8');
  const context = { console, Math };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'gumdrop-tilt/logic.js' });
  return context.GT;
}
const GT = loadGT();
const empty = () => Array.from({ length: GT.H }, () => Array(GT.W).fill(-1));

describe('Gumdrop Tilt rules', () => {
  test('same seed gives same piece queue', () => {
    const a = GT.createState(5), b = GT.createState(5);
    GT.start(a); GT.start(b);
    expect(a.piece).toEqual(b.piece);
    expect(a.queue).toEqual(b.queue);
  });

  test('findGroups needs four connected', () => {
    const g = empty();
    g[11][0] = g[11][1] = g[11][2] = 1;
    expect(GT.findGroups(g)).toHaveLength(0);
    g[10][2] = 1;
    expect(GT.findGroups(g)[0].cells).toHaveLength(4);
  });

  test('pieces move, rotate and stay in bounds', () => {
    const s = GT.createState(1); GT.start(s);
    for (let i = 0; i < 10; i++) GT.move(s, -1);
    expect(s.piece.x).toBe(0);
    expect(GT.rotate(s, 1)).toBe(true);
    for (const c of GT.cellsOf(s.piece)) expect(c.x >= 0 && c.x < GT.W).toBe(true);
  });

  test('hard drop locks and scores', () => {
    const s = GT.createState(2); GT.start(s);
    const n = GT.hardDrop(s);
    expect(n).toBeGreaterThan(5);
    expect(s.pieces).toBe(1);
    expect(s.score).toBeGreaterThan(0);
  });

  test('a four-group pops, cascades into a chain and scores', () => {
    const s = GT.createState(3); GT.start(s);
    s.piece = null; s.phase = 'settle'; s.timer = 0;
    // colour 1 four-group whose removal drops colour 2 to complete a second group
    const g = s.grid;
    for (let y = 8; y <= 11; y++) g[y][0] = 1;
    g[7][0] = 2; g[6][0] = 2; g[11][1] = 2; g[10][1] = 2;
    GT.update(s, 0.01);
    expect(s.chain).toBe(1);
    GT.advance(s, 1.5);
    expect(s.maxChain).toBe(2);
    expect(s.score).toBe(360);
    expect(s.grid.every(r => r.every(c => c === -1))).toBe(true);
  });

  test('slide packs rows toward the wall preserving order', () => {
    const s = GT.createState(4);
    s.grid[11][1] = 3; s.grid[11][4] = 2;
    GT.slide(s, -1);
    expect(s.grid[11].slice(0, 2)).toEqual([3, 2]);
    GT.slide(s, 1);
    expect(s.grid[11].slice(-2)).toEqual([3, 2]);
  });

  test('tilt fires after the interval and rearranges the stack', () => {
    const s = GT.createState(9); GT.start(s);
    const events = [];
    for (let i = 0; i < GT.TILT_EVERY && s.status === 'playing'; i++) {
      GT.hardDrop(s); GT.advance(s, 6); events.push(...GT.drainEvents(s).map(e => e.type));
      if (i % 2) { s.grid = empty(); } // keep the jar from overflowing while we count drops
    }
    expect(events).toContain('tiltWarn');
    expect(events).toContain('tilt');
  });

  test('stacking to the top ends the game', () => {
    const s = GT.createState(11); GT.start(s);
    for (let i = 0; i < 60 && s.status === 'playing'; i++) { GT.hardDrop(s); GT.advance(s, 0.5); }
    expect(['lost', 'playing']).toContain(s.status);
    const t = GT.createState(12); GT.start(t);
    for (let y = 0; y < GT.H; y++) t.grid[y][2] = y % 5;
    t.grid[1][2] = 4; t.grid[2][2] = 0;
    t.phase = 'play'; GT.hardDrop(t); GT.advance(t, 3);
    expect(t.status).toBe('lost');
  });
});
