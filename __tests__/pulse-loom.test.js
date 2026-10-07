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

test('movements build rhythmic density without simultaneous touch inputs', () => {
  const L = logic(), notes = L.chart();
  const counts = [0, 1, 2, 3].map(section => notes.filter(n =>
    Math.floor(n.beat / 32) === section).length);
  expect(counts).toEqual([14, 32, 32, 48]);
  expect(notes[0].beat).toBe(4);
  expect(notes.every((n, i) => i === 0 || n.beat - notes[i - 1].beat >= .5)).toBe(true);
  expect(notes.some(n => n.beat % 1 === .5)).toBe(true);
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

test('audio clock schedules the opening beat before a delayed frame and does not duplicate it', async () => {
  const starts = [];
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const source = kind => ({ frequency: param(), gain: param(), connect() {},
    start(when) { starts.push({ kind, when }); }, stop() {} });
  const clock = { currentTime: 10, state: 'running', sampleRate: 1000, destination: {},
    createGain: () => source('gain'), createDynamicsCompressor: () => ({
      threshold: param(), ratio: param(), connect() {} }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(180) }),
    createOscillator: () => source('oscillator'), createBufferSource: () => source('noise'),
    createBiquadFilter: () => ({ frequency: param(), connect() {} }) };
  const context = { window: { AudioContext: function () { return clock; } } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'pulse-loom', 'assets', 'js', 'audio.js'), 'utf8'), context);
  const A = context.window.PL.Audio, L = logic();
  const lead = await A.begin();
  expect(lead).toBeGreaterThan(0);
  const opening = starts.filter(s => Math.abs(s.when - (10 + lead)) < 0.0001).length;
  expect(opening).toBeGreaterThan(0);
  A.schedule(-lead, L.BEAT);
  expect(starts.filter(s => Math.abs(s.when - (10 + lead)) < 0.0001)).toHaveLength(opening);
  clock.currentTime = 10 + L.BEAT;
  A.schedule(L.BEAT - lead, L.BEAT);
  expect(starts.some(s => Math.abs(s.when - (10 + lead + L.BEAT)) < 0.0001)).toBe(true);
});

test('audio reports unavailable when the browser has no AudioContext', async () => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'pulse-loom', 'assets', 'js', 'audio.js'), 'utf8'), context);
  const A = context.window.PL.Audio;
  expect(await A.begin()).toBe(0);
  expect(A.status()).toBe('unavailable');
});
