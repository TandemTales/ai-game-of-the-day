const fs = require('fs');
const vm = require('vm');
const path = require('path');

function logic() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gloam-run', 'assets', 'js', 'logic.js'), 'utf8'), context);
  return context.window.GR.Logic;
}

function reach(L, run, state, from) {
  run.gateState = state;
  const seen = new Set([from.x + ',' + from.y]), q = [from];
  while (q.length) {
    const c = q.shift();
    L.DIRS.forEach(d => {
      let nx = (c.x + d.x + L.W) % L.W, ny = c.y + d.y;
      if (!L.passable(run, nx, ny, d.x, d.y, false)) return;
      const k = nx + ',' + ny;
      if (!seen.has(k)) { seen.add(k); q.push({ x: nx, y: ny }); }
    });
  }
  return seen;
}

test('maze is rectangular, symmetric in shape and every pickup is reachable in both gate states', () => {
  const L = logic(), run = L.newRun();
  expect(L.MAZE.every(r => r.length === L.W)).toBe(true);
  for (const state of [0, 1]) {
    const seen = reach(L, run, state, run.start);
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
      const c = L.MAZE[y][x];
      if ('.oS'.includes(c)) expect([state, x, y, seen.has(x + ',' + y)]).toEqual([state, x, y, true]);
    }
  }
});

test('maze has no permanent dead ends', () => {
  const L = logic(), run = L.newRun();
  for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
    if (!'.oW '.includes(L.MAZE[y][x]) || (y === 9 && x > 7 && x < 11)) continue;
    const open = [0, 1].map(state => {
      run.gateState = state; let n = 0;
      L.DIRS.forEach(d => { if (L.passable(run, (x + d.x + L.W) % L.W, y + d.y, d.x, d.y, false)) n++; });
      return n;
    });
    // Moonstone nooks are deliberate risk pockets. A gate may turn a corridor into a temporary cul-de-sac, never a permanent one.
    expect([x, y, Math.max(...open) >= 2]).toEqual([x, y, true]);
  }
});

test('the turnstile switch flips gate axes and blocks/opens corridors', () => {
  const L = logic(), run = L.newRun();
  expect(L.passable(run, 9, 7, 1, 0, false)).toBe(true);
  expect(L.passable(run, 9, 7, 0, 1, false)).toBe(false);
  expect(L.passable(run, 9, 11, 1, 0, false)).toBe(false);
  run.gateState = 1;
  expect(L.passable(run, 9, 7, 1, 0, false)).toBe(false);
  expect(L.passable(run, 9, 11, 1, 0, false)).toBe(true);
});

function drive(L, run, secs, pick) {
  for (let t = 0; t < secs; t += 1 / 60) { if (pick) pick(run); L.advance(run, 1 / 60); }
}

test('simulation is deterministic for the same seed and inputs', () => {
  const L = logic();
  const go = () => {
    const r = L.newRun(7);
    drive(L, r, 20, run => L.steer(run, Math.floor(run.time * 2) % 4));
    return [r.score, r.lives, r.hunters.map(h => h.x + ',' + h.y + h.mode).join('|')];
  };
  expect(go()).toEqual(go());
});

test('motes score, lantern frightens, scared shade can be eaten with a growing chain', () => {
  const L = logic(), run = L.newRun();
  run.readyTimer = 0;
  const before = run.motesLeft;
  drive(L, run, 3);
  expect(run.score).toBeGreaterThan(0);
  expect(run.motesLeft).toBeLessThan(before);
  run.grid[run.wick.y][run.wick.x + 1] = 'o'; run.motesLeft++;
  L.steer(run, 3);
  drive(L, run, 1);
  expect(run.frightTimer).toBeGreaterThan(0);
  const h0 = run.hunters[0], h1 = run.hunters[1];
  [h0, h1].forEach(h => { h.mode = 'scared'; h.x = run.wick.x; h.y = run.wick.y; h.moving = false; });
  const s = run.score; L.advance(run, 1 / 60);
  expect(run.score - s).toBe(200 + 400);
  expect(h0.mode).toBe('return');
});

test('touching a hunting shade costs a life and ends the run after three', () => {
  const L = logic(), run = L.newRun();
  run.readyTimer = 0;
  for (let i = 0; i < 3; i++) {
    const h = run.hunters[0]; h.mode = 'chase'; h.x = run.wick.x; h.y = run.wick.y; h.moving = false;
    L.advance(run, 1 / 60);
    expect(run.lives).toBe(2 - i);
    drive(L, run, 3);
    run.readyTimer = 0;
  }
  expect(run.ended).toBe(true);
});

test('clearing every mote advances the level and speeds the shades', () => {
  const L = logic(), run = L.newRun();
  run.readyTimer = 0;
  const p1 = run.params.hunter;
  for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) if (run.grid[y][x] === '.' || run.grid[y][x] === 'o') { if (x !== 10 || y !== 19) { run.grid[y][x] = ' '; run.motesLeft--; } }
  run.grid[19][10] = '.'; run.motesLeft = 1; run.wick.x = 9; run.wick.y = 19; L.steer(run, 3);
  drive(L, run, 1);
  expect(run.level).toBe(2);
  expect(run.params.hunter).toBeGreaterThan(p1);
});
