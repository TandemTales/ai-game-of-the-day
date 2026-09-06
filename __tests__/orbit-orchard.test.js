const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadOO() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'orbit-orchard', 'assets', 'js', 'game.js'), 'utf8');
  const context = { console, Math, globalThis: {}, setTimeout, clearTimeout };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'orbit-orchard/assets/js/game.js' });
  return context.OO;
}

describe('Orbit Orchard deterministic vertical slice', () => {
  const OO = loadOO();

  test('creates a stable ready field with a seed, relics, stars, and wells', () => {
    const first = OO.createState(42);
    const second = OO.createState(42);
    expect(first.status).toBe('ready');
    expect(first.relics).toHaveLength(56);
    expect(first.stars).toHaveLength(80);
    expect(first.hazards).toHaveLength(4);
    expect(first.relics[0]).toEqual(second.relics[0]);
    expect(first.relics[55]).toEqual(second.relics[55]);
  });

  test('start resets the run and refuses a second start while playing', () => {
    const state = OO.createState(7);
    state.score = 800;
    expect(OO.start(state)).toBe(true);
    expect(state.status).toBe('playing');
    expect(state.score).toBe(0);
    expect(state.timeLeft).toBe(65);
    expect(OO.start(state)).toBe(false);
  });

  test('keyboard steering accelerates the seed and respects arena bounds', () => {
    const state = OO.createState(9);
    OO.start(state);
    const before = state.player.x;
    OO.step(state, { right: true, left: false, up: false, down: false, pointerActive: false }, 1 / 30);
    expect(state.player.x).toBeGreaterThan(before);
    state.player.x = 950;
    state.player.radius = 16;
    OO.step(state, { right: true, left: false, up: false, down: false, pointerActive: false }, 1 / 30);
    expect(state.player.x).toBeLessThanOrEqual(910);
  });

  test('absorb eligibility requires the relic to be smaller than the seed', () => {
    expect(OO.canAbsorb(20, 18)).toBe(true);
    expect(OO.canAbsorb(20, 20)).toBe(false);
    expect(OO.canAbsorb(20, 22)).toBe(false);
  });

  test('absorbing a relic grows the seed, awards score, and starts a combo', () => {
    const state = OO.createState(11);
    OO.start(state);
    const relic = state.relics[0];
    const beforeRadius = state.player.radius;
    expect(OO.absorb(state, relic)).toBe(true);
    expect(relic.active).toBe(false);
    expect(state.player.radius).toBeGreaterThan(beforeRadius);
    expect(state.score).toBeGreaterThan(0);
    expect(state.combo).toBe(1);
    expect(state.multiplier).toBe(1);
  });

  test('same-color absorption links the constellation and increases the multiplier after four links', () => {
    const state = OO.createState(12);
    OO.start(state);
    for (let i = 0; i < 4; i += 1) {
      state.relics[i].color = 1;
      expect(OO.absorb(state, state.relics[i])).toBe(true);
    }
    expect(state.combo).toBe(4);
    expect(state.multiplier).toBe(2);
    expect(state.score).toBeGreaterThan(0);
  });

  test('a large seed pulls a nearby relic toward itself', () => {
    const state = OO.createState(13);
    OO.start(state);
    const relic = state.relics[0];
    relic.x = state.player.x + 100;
    relic.y = state.player.y;
    relic.radius = 55;
    state.player.radius = 60;
    OO.step(state, { pointerActive: false }, 1 / 60);
    expect(relic.vx).toBeLessThan(0);
  });

  test('gravity wells cost time and push the seed away', () => {
    const state = OO.createState(14);
    OO.start(state);
    const well = state.hazards[0];
    state.player.x = well.x;
    state.player.y = well.y;
    const before = state.timeLeft;
    OO.step(state, { pointerActive: false }, 1 / 60);
    expect(state.timeLeft).toBeLessThan(before);
    expect(state.event.text).toContain('GRAVITY WELL');
  });

  test('timer ends a run cleanly', () => {
    const state = OO.createState(15);
    OO.start(state);
    state.timeLeft = 0.01;
    OO.step(state, { pointerActive: false }, 1 / 30);
    expect(state.status).toBe('over');
    expect(state.event.text).toBe('ORBIT DECAYED');
  });

  test('score and time formatting stay leaderboard-friendly', () => {
    expect(OO.scoreFor(45, 3)).toBe(135);
    expect(OO.scoreFor(45, 0)).toBe(45);
    expect(OO.formatScore(42)).toBe('000042');
    expect(OO.formatTime(65)).toBe('01:05');
  });

  test('leaderboard submission keeps the rank-first API contract', () => {
    expect(OO.GAME_ID).toBe('orbit-orchard');
    const source = fs.readFileSync(path.join(__dirname, '..', 'orbit-orchard', 'assets', 'js', 'game.js'), 'utf8');
    expect(source).toContain("'/api/leaderboard/rank?gameId='");
    expect(source).toContain("fetch('/api/leaderboard/submit'");
  });
});
