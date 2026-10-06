const fs = require('fs');
const vm = require('vm');
const path = require('path');

function logic() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'pulse-loom', 'assets', 'js', 'logic.js'), 'utf8'), context);
  return context.window.PL.Logic;
}

test('chart is deterministic, ordered, finite, and rotates every eight bars', () => {
  const L = logic();
  expect(L.chart()).toEqual(L.chart());
  const notes = L.chart();
  expect(notes.length).toBeGreaterThan(60);
  expect(notes.every((n, i) => n.lane >= 0 && n.lane < 4 &&
    n.time === n.beat * L.BEAT && (i === 0 || n.time > notes[i - 1].time))).toBe(true);
  expect(L.laneFor(0, 31)).toBe(0);
  expect(L.laneFor(0, 32)).toBe(1);
  expect(L.laneFor(0, 64)).toBe(2);
  expect(L.laneFor(0, 96)).toBe(3);
});

test('timing judgment, miss, combo, and replay are coherent', () => {
  const L = logic(), run = L.newRun(), first = run.notes[0];
  expect(L.tap(run, first.lane, first.time)).toBe('PERFECT');
  expect(run.score).toBe(100);
  expect(L.tap(run, first.lane, first.time)).toBe(null);
  L.advance(run, run.notes[1].time + L.WINDOW + .01);
  expect(run.misses).toBeGreaterThan(0);
  expect(run.combo).toBe(0);
  expect(L.newRun().score).toBe(0);
});

test('every note can be reached at its scheduled time', () => {
  const L = logic(), run = L.newRun();
  run.notes.forEach(n => { expect(L.tap(run, n.lane, n.time)).toBe('PERFECT'); });
  expect(run.hits).toBe(run.notes.length);
  expect(run.misses).toBe(0);
  L.advance(run, L.TOTAL_BEATS * L.BEAT + 1.01);
  expect(run.ended).toBe(true);
  expect(run.score).toBeGreaterThan(0);
});

test('perfect run grades S, empty run grades D, stray taps are counted', () => {
  const L = logic(), run = L.newRun();
  expect(L.tap(run, (run.notes[0].lane + 1) % 4, 0)).toBe(null);
  expect(run.stray).toBe(1);
  run.notes.forEach(n => L.tap(run, n.lane, n.time));
  expect(L.grade(run)).toBe('S');
  expect(run.score).toBe(L.maxScore());
  expect(L.accuracy(run)).toBe(1);
  const empty = L.newRun();
  expect(L.grade(empty)).toBe('D');
  expect(L.section(0)).toBe(0);
  expect(L.section(L.TOTAL_BEATS * L.BEAT)).toBe(3);
});
