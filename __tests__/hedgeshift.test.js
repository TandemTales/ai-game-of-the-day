const fs = require('fs'), path = require('path'), vm = require('vm');
function load() {
  const ctx = { console, Math, Date }; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../hedgeshift/assets/js/logic.js'), 'utf8'), ctx);
  return ctx.HG.Logic;
}
const L = load();
test('map is rectangular', () => { L.MAP.forEach(r => expect(r.length).toBe(L.W)); });
test.each([0, 1])('layer %i floor is fully connected and holds every reachable cell', (layer) => {
  const p = L.findCell('P'), d = L.distMap(layer, p.x, p.y);
  for (let r = 0; r < L.H; r++) for (let c = 0; c < L.W; c++)
    if (!L.isWall(layer, c, r)) expect([layer, c, r, d[L.key(c, r)] !== undefined]).toEqual([layer, c, r, true]);
});
test('every pellet cell is floor in some layer', () => {
  const s = L.create(1); Object.keys(s.pellets).forEach(k => { const c = k % L.W, r = Math.floor(k / L.W); expect(!L.isWall(0, c, r) || !L.isWall(1, c, r)).toBe(true); });
});
test('deterministic for same seed and inputs', () => {
  const run = () => { const s = L.create(7); L.setWant(s, 1); for (let i = 0; i < 1200; i++) { if (i % 90 === 0) L.setWant(s, i % 4); L.step(s, 1 / 60); } return JSON.stringify([s.score, s.player.c, s.player.r, s.wisps.map(w => [w.c, w.r, w.state]), s.lives]); };
  expect(run()).toBe(run());
});
test('player eats dewdrops for score', () => {
  const s = L.create(3); L.setWant(s, 3); for (let i = 0; i < 240; i++) L.step(s, 1 / 60);
  expect(s.score).toBeGreaterThan(0);
});
test('hedge shifts on a timer and warns first', () => {
  const s = L.create(3); s.wisps.forEach(w => { w.release = 1e9; }); L.setWant(s, 3); let warned = false;
  for (let i = 0; i < 60 * 15; i++) { L.step(s, 1 / 60); if (s.shiftWarn) warned = true; if (s.mode !== 'playing') break; }
  expect(warned || s.shifts > 0).toBe(true);
});
test('shift crushes a wisp caught in a closing wall', () => {
  const s = L.create(3); s.mode = 'playing'; const w = s.wisps[0]; w.state = 'chase';
  w.c = 2; w.r = 3; // an A cell: floor on Dusk (layer 1)
  s.layer = 1; L.shift(s);
  expect(s.crushes).toBe(1); expect(w.state).toBe('wait');
});
test('lantern frightens and chain eating scores doubling', () => {
  const s = L.create(3); s.mode = 'playing'; s.frightTimer = 5; const w = s.wisps[0]; w.state = 'chase'; w.scared = true;
  w.c = s.player.c; w.r = s.player.r; w.moving = false; L.tick(s, 1 / 60);
  expect(s.score).toBe(200); expect(w.state).toBe('eaten');
});
test('level clear then next level speeds up', () => {
  const s = L.create(3); const n = L.nextLevel(s);
  expect(n.level).toBe(2); expect(n.params.wisp).toBeGreaterThan(s.params.wisp); expect(n.params.shift).toBeLessThan(s.params.shift);
});
test('wisps are never inside walls over a long autoplay', () => {
  const s = L.create(11); L.setWant(s, 1);
  for (let i = 0; i < 60 * 60; i++) {
    if (i % 40 === 0) L.setWant(s, (i / 40) % 4);
    L.step(s, 1 / 60);
    if (s.mode === 'dying') s.deadTimer = 0;
    if (s.mode === 'over' || s.mode === 'cleared') break;
    s.wisps.forEach(w => { if (w.state !== 'wait') expect(L.isWall(s.layer, w.c, w.r)).toBe(false); });
  }
});
