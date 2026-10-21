const fs = require('fs');
const vm = require('vm');
const path = require('path');

function logic() {
  const context = { window: {}, Math };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'lantern-moth', 'assets', 'js', 'logic.js'), 'utf8'), context);
  return context.window.LM.Logic;
}
function play(L, run, seconds) { for (let i = 0; i < seconds * 60; i++) L.step(run, 1 / 60); }

test('maze is rectangular and the start and pen door are valid', () => {
  const L = logic();
  expect(L.H).toBe(15);
  L.MAZE.forEach(row => expect(row.length).toBe(17));
  expect(L.cell(L.START.c, L.START.r)).toBe('.');
  expect(L.cell(8, 6)).toBe('D');
});

test('every seed is reachable with either gate set open', () => {
  const L = logic();
  [0, 8].forEach(t => {
    const run = L.newRun(1); run.t = t;
    const seen = new Set([L.START.c + ',' + L.START.r]), q = [[L.START.c, L.START.r]];
    while (q.length) {
      const [c, r] = q.pop();
      L.DIRS.forEach(([dx, dy]) => {
        const k = (c + dx) + ',' + (r + dy);
        if (!seen.has(k) && L.passable(run, c + dx, r + dy, false)) { seen.add(k); q.push([c + dx, r + dy]); }
      });
    }
    Object.keys(run.board.seeds).forEach(k => expect(seen.has(k)).toBe(true));
  });
});

test('gates alternate on a fixed beat and warn before swinging', () => {
  const L = logic(), run = L.newRun(1);
  expect(L.gateOpen(run, 'B')).toBe(true);
  expect(L.gateOpen(run, 'A')).toBe(false);
  run.t = L.GATE_PERIOD + 0.01;
  expect(L.gateOpen(run, 'A')).toBe(true);
  expect(L.gateWarn(L.GATE_PERIOD - 0.5)).toBe(true);
  expect(L.gateWarn(1)).toBe(false);
});

test('moth eats seeds and scores; walls block movement', () => {
  const L = logic(), run = L.newRun(1);
  L.setDir(run, 1); play(L, run, 0.6);
  expect(run.score).toBeGreaterThan(0);
  expect(run.moth.x).toBeGreaterThan(L.START.c);
  L.setDir(run, 0); play(L, run, 3);
  expect(L.cell(Math.round(run.moth.x), Math.floor(run.moth.y - 0.4))).not.toBe('#');
});

test('simulation is deterministic for the same input script', () => {
  const L = logic();
  const go = () => {
    const run = L.newRun(7);
    [1, 0, 3, 2, 1, 0].forEach(d => { L.setDir(run, d); play(L, run, 1.3); });
    return [run.score, run.lives, run.t.toFixed(3), run.spiders.map(s => s.c + ',' + s.r + s.state).join('|')];
  };
  expect(go()).toEqual(go());
});

test('a lantern frightens spiders and eating one chains points', () => {
  const L = logic(), run = L.newRun(1);
  run.state = 'play'; run.board.seeds['9,11'] = 'o';
  L.setDir(run, 1); play(L, run, 0.3);
  expect(run.power).toBeGreaterThan(0);
  expect(run.spiders[0].edible).toBe(true);
  const s = run.spiders[0]; s.x = run.moth.x; s.y = run.moth.y; s.c = s.tc = Math.round(s.x); s.r = s.tr = Math.round(s.y); s.p = 0;
  const before = run.score; L.step(run, 1 / 60);
  expect(run.score - before).toBe(200);
  expect(s.state).toBe('eyes');
});

test('an unfrightened spider costs a life and three losses end the run', () => {
  const L = logic(), run = L.newRun(1);
  run.state = 'play';
  for (let n = 0; n < 3; n++) {
    const s = run.spiders[0]; s.x = run.moth.x; s.y = run.moth.y; s.c = s.tc = Math.round(s.x); s.r = s.tr = Math.round(s.y); s.p = 0;
    L.step(run, 1 / 60);
    expect(run.state).toBe('dying');
    play(L, run, 2);
    if (n < 2) { expect(run.state).toBe('ready'); run.state = 'play'; }
  }
  expect(run.over).toBe(true);
});

test('clearing every seed advances the level', () => {
  const L = logic(), run = L.newRun(1);
  run.state = 'play'; Object.keys(run.board.seeds).forEach(k => { if (k !== '7,11') delete run.board.seeds[k]; });
  run.board.left = 1; L.setDir(run, 3); play(L, run, 0.5);
  expect(run.state).toBe('clear');
  play(L, run, 2.5);
  expect(run.level).toBe(2);
  expect(run.board.left).toBeGreaterThan(50);
});
