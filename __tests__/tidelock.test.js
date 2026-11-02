const fs = require('fs');
const path = require('path');
const vm = require('vm');
function load() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../tidelock/assets/js/logic.js'), 'utf8'), { window, Math, Number, Array });
  return window.TL.Logic;
}
function walk(L, s, dx, dy, n) { for (let i = 0; i < n; i++) L.move(s, dx, dy); }
function park(s, x = 28, y = 12) { s.enemies.forEach(e => { e.x = x; e.y = y; e.vx = 0; e.vy = 0; }); }
function split(L, s, x) {
  walk(L, s, 0, -1, s.player.y);
  walk(L, s, Math.sign(x - s.player.x), 0, Math.abs(x - s.player.x));
  walk(L, s, 0, 1, L.H - 1);
}
test('seeded charts and live simulation are reproducible', () => {
  const L = load(), a = L.newGame(23), b = L.newGame(23);
  for (let i = 0; i < 200; i++) { L.tick(a, 0.02); L.tick(b, 0.02); }
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  expect(JSON.stringify(a.enemies)).not.toBe(JSON.stringify(L.newGame(24).enemies));
});
test('safe boundaries constrain movement and invalid diagonal input', () => {
  const L = load(), s = L.newGame();
  expect(L.move(s, -1, 0)).toBe(false); expect(L.move(s, 1, 1)).toBe(false);
  walk(L, s, 0, -1, 100); expect(s.player).toEqual({ x: 0, y: 0 }); expect(s.trail).toHaveLength(0);
});
test('reconnection fills only storm-free water and rescues buoys exactly once', () => {
  const L = load(), s = L.newGame(); park(s); split(L, s, 12);
  expect(s.cells[L.index(7, 6)]).toBe(1); expect(s.cells[L.index(28, 12)]).toBe(0);
  expect(s.rescued).toBe(2); expect(s.charges).toBe(3); expect(s.trail).toHaveLength(0);
  expect(s.ratio).toBeCloseTo(12 / 31); expect(s.score).toBe(12 * 23 * 10 + 500);
  const score = s.score; walk(L, s, -1, 0, 5); expect(s.score).toBe(score);
});
test('flood fill preserves both regions when storms occupy both sides', () => {
  const L = load(), s = L.newGame(); s.enemies = [{ x: 5, y: 5, vx: 0, vy: 0 }, { x: 27, y: 17, vx: 0, vy: 0 }];
  split(L, s, 16); expect(s.cells[L.index(5, 5)]).toBe(0); expect(s.cells[L.index(27, 17)]).toBe(0);
  expect(s.ratio).toBeCloseTo(1 / 31);
});
test('cable can retract, while crossing itself loses a cable and respawns safely', () => {
  const L = load(), s = L.newGame(); park(s);
  walk(L, s, 1, 0, 3); L.move(s, -1, 0); expect(s.trail).toHaveLength(2);
  L.move(s, 0, 1); L.move(s, 1, 0); L.move(s, 0, -1); L.move(s, -1, 0);
  expect(s.lives).toBe(2); expect(s.trail).toHaveLength(0); expect(s.player).toEqual({ x: 0, y: 12 });
});
test('a live storm cuts exposed cable, never claimed land', () => {
  const L = load(), s = L.newGame(); park(s);
  walk(L, s, 1, 0, 5); Object.assign(s.enemies[0], { x: 3, y: 12 }); L.tick(s, 0.02);
  expect(s.lives).toBe(2); expect(s.trail).toHaveLength(0);
  for (let i = 0; i < 60; i++) L.tick(s, 0.02);
  expect(s.lives).toBe(2);
});
test('pulse consumes a charge, freezes motion and expires while clock continues', () => {
  const L = load(), s = L.newGame(), before = JSON.stringify(s.enemies);
  expect(L.pulse(s)).toBe(true); expect(L.pulse(s)).toBe(false);
  for (let i = 0; i < 50; i++) L.tick(s, 0.02);
  expect(JSON.stringify(s.enemies)).toBe(before); expect(s.time).toBeCloseTo(89);
  for (let i = 0; i < 100; i++) L.tick(s, 0.02);
  expect(s.freeze).toBe(0); expect(s.charges).toBe(0); expect(JSON.stringify(s.enemies)).not.toBe(before);
});
test('all five charts have a legal capture path; score carries into final victory', () => {
  const L = load(), s = L.newGame(); let score = 0;
  for (let stage = 0; stage < 5; stage++) {
    park(s); split(L, s, 22); expect(s.clear).toBe(true); expect(s.ratio).toBeGreaterThanOrEqual(0.6);
    expect(s.score).toBeGreaterThan(score); score = s.score;
    if (stage < 4) { expect(L.next(s)).toBe(true); expect(s.stage).toBe(stage + 1); expect(s.ratio).toBe(0); }
  }
  expect(s.over).toBe(true); expect(s.won).toBe(true); expect(L.next(s)).toBe(false);
  const frozen = JSON.stringify(s); L.move(s, 1, 0); L.tick(s, 0.05); expect(JSON.stringify(s)).toBe(frozen);
});
test('timer loss and zero cables end play; fresh run resets all progress', () => {
  const L = load(), s = L.newGame(); s.time = 0.01; L.tick(s, 0.02);
  expect(s.over).toBe(true); expect(s.won).toBe(false);
  const b = L.newGame(); park(b, 1, 12); b.lives = 1; L.move(b, 1, 0);
  expect(b.over).toBe(true); expect(b.lives).toBe(0);
  expect(L.newGame().score).toBe(0); expect(L.newGame().charges).toBe(1);
});
test('storms stay out of claimed cells during long seeded runs', () => {
  const L = load();
  for (let seed = 1; seed <= 8; seed++) {
    const s = L.newGame(seed); park(s); split(L, s, 12);
    s.enemies.forEach(e => { e.vx = -3.7; e.vy = 2.9; });
    for (let i = 0; i < 1500; i++) {
      L.tick(s, 0.05); s.enemies.forEach(e => expect(s.cells[L.index(Math.round(e.x), Math.round(e.y))]).toBe(0));
    }
  }
});
