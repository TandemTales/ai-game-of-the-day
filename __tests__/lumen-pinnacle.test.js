const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadLP() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'lumen-pinnacle', 'assets', 'js', 'game.js'), 'utf8');
  const context = { console, Math, globalThis: {}, setTimeout, clearTimeout };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'lumen-pinnacle/assets/js/game.js' });
  return context.LP;
}

describe('Lumen Pinnacle deterministic table slice', () => {
  const LP = loadLP();

  test('creates a ready three-ball table with stable seed state', () => {
    const first = LP.createState(42);
    const second = LP.createState(42);
    expect(first.status).toBe('ready');
    expect(first.ballsRemaining).toBe(3);
    expect(first.balls[0]).toEqual(second.balls[0]);
    expect(first.targets).toEqual([false, false, false]);
  });

  test('start launches the main ball and resets the score contract', () => {
    const state = LP.createState(7);
    expect(LP.start(state)).toBe(true);
    expect(state.status).toBe('playing');
    expect(state.score).toBe(0);
    expect(state.balls[0].active).toBe(true);
    expect(state.balls[0].vy).toBeLessThan(0);
    expect(LP.start(state)).toBe(false);
  });

  test('fixed-step motion applies gravity and keeps the ball inside side rails', () => {
    const state = LP.createState(8);
    LP.start(state);
    state.balls[0].x = 69;
    state.balls[0].vx = -500;
    const beforeY = state.balls[0].y;
    LP.step(state, {}, 1 / 60);
    expect(state.balls[0].x).toBeGreaterThanOrEqual(80);
    expect(state.balls[0].vx).toBeGreaterThan(0);
    expect(state.balls[0].y).toBeLessThan(beforeY);
  });

  test('both flipper inputs raise their independent flippers', () => {
    const state = LP.createState(9);
    LP.start(state);
    LP.step(state, { left: true, right: false }, 1 / 30);
    expect(state.flippers.left).toBeGreaterThan(0);
    expect(state.flippers.right).toBe(0);
    LP.step(state, { left: false, right: true }, 1 / 30);
    expect(state.flippers.right).toBeGreaterThan(0);
  });

  test('all three prism targets award points, reset the bank, and trigger multiball', () => {
    const state = LP.createState(10);
    LP.start(state);
    state.balls[0].active = false;
    state.targets.forEach((_, index) => {
      state.balls[0].active = true;
      state.balls[0].x = LP.targets[index].x + LP.targets[index].w / 2;
      state.balls[0].y = LP.targets[index].y - 8;
      state.balls[0].vx = 0;
      state.balls[0].vy = 400;
      state.balls[0].hitCooldown = 0;
      LP.step(state, {}, 1 / 60);
    });
    expect(state.score).toBeGreaterThan(0);
    expect(state.multiplier).toBe(2);
    expect(state.multiballTimer).toBeGreaterThan(0);
    expect(state.balls.filter(ball => ball.bonus)).toHaveLength(2);
    expect(state.targets).toEqual([false, false, false]);
  });

  test('draining the main ball uses the ball reserve and ends the run at zero', () => {
    const state = LP.createState(11);
    LP.start(state);
    state.respawnTimer = 0.2;
    for (let remaining = 2; remaining >= 0; remaining -= 1) {
      state.balls[0].active = false;
      state.balls[0].y = 1110;
      state.respawnTimer = 0.2;
      LP.step(state, {}, 1 / 60);
      if (remaining > 0) {
        state.respawnTimer = 0;
        LP.step(state, {}, 1 / 60);
        expect(state.ballsRemaining).toBe(remaining);
      }
    }
    expect(state.ballsRemaining).toBe(0);
    expect(state.status).toBe('over');
  });

  test('score math respects multiplier and score formatting', () => {
    expect(LP.scoreFor(250, 3)).toBe(750);
    expect(LP.scoreFor(250, 0)).toBe(250);
    expect(LP.formatScore(42)).toBe('000042');
  });

  test('leaderboard submission uses the game id and rank-first URL', () => {
    expect(LP.GAME_ID).toBe('lumen-pinnacle');
    const source = fs.readFileSync(path.join(__dirname, '..', 'lumen-pinnacle', 'assets', 'js', 'game.js'), 'utf8');
    expect(source).toContain("'/api/leaderboard/rank?gameId='");
    expect(source).toContain("fetch('/api/leaderboard/submit'");
  });
});
