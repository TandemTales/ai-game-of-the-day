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
    expect(first.relics.length).toBeGreaterThanOrEqual(56);
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

  test.each([[960,600],[600,960]])('view %ix%i keeps every world corner reachable without distortion', (width,height) => {
    const view = OO.createView(width,height);
    for (const point of [{x:0,y:0},{x:960,y:0},{x:0,y:600},{x:960,y:600},{x:277,y:419}]) {
      const screen = OO.worldToView(point,view);
      expect(screen.x).toBeGreaterThanOrEqual(0);
      expect(screen.x).toBeLessThanOrEqual(view.width);
      expect(screen.y).toBeGreaterThanOrEqual(0);
      expect(screen.y).toBeLessThanOrEqual(view.height);
      expect(OO.viewToWorld(screen,view)).toEqual(point);
    }
    const a = OO.worldToView({x:130,y:180},view);
    const b = OO.worldToView({x:170,y:210},view);
    expect(Math.hypot(a.x-b.x,a.y-b.y)).toBe(50);
  });

  test.each(['up','down','left','right'])('portrait %s steering follows the screen direction', direction => {
    const state = OO.createState(42);
    OO.start(state);
    const view = OO.createView(600,960);
    const before = OO.worldToView(state.player,view);
    OO.step(state, OO.screenInput({[direction]:true},view),1/60);
    const after = OO.worldToView(state.player,view);
    const axis = ['left','right'].includes(direction) ? 'x' : 'y';
    expect((after[axis]-before[axis]) * (['up','left'].includes(direction) ? -1 : 1)).toBeGreaterThan(0);
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
    expect(state.event.text).toBe('CONTRACT EXPIRED');
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

describe('Orbit Orchard first delivery contract', () => {
  const OO = loadOO();
  function playing(seed = 42, choice = 'safe') {
    const state = OO.createState(seed);
    OO.start(state);
    OO.chooseContract(state, choice);
    return state;
  }
  function fill(state) {
    state.contract.committed = true;
    for (const relic of state.relics.filter(relic => OO.matchesContract(state, relic)).slice(0, 3)) OO.absorb(state, relic);
  }

  test.each(['safe', 'risky'])('%s has spare seeded eligible targets outside the nursery', choice => {
    for (const seed of [7, 42, 2026]) {
      const state = playing(seed, choice);
      const targets = state.relics.filter(relic => OO.matchesContract(state, relic));
      expect(targets.length).toBeGreaterThanOrEqual(5);
      for (const relic of targets) {
        expect(OO.canAbsorb(state.player.radius, relic.radius)).toBe(true);
        expect(Math.hypot(relic.x - OO.NURSERY.x, relic.y - OO.NURSERY.y)).toBeGreaterThan(OO.NURSERY.radius + 100);
      }
      expect(state.relics).toEqual(playing(seed, choice).relics);
    }
  });

  test('choice defaults safe and is locked after leaving the nursery', () => {
    const state = playing();
    expect(state.contract.choice).toBe('safe');
    expect(OO.chooseContract(state, 'risky')).toBe(true);
    state.player.x = 360;
    OO.step(state, {}, 1 / 60);
    expect(state.contract.committed).toBe(true);
    expect(OO.chooseContract(state, 'safe')).toBe(false);
    expect(state.contract.choice).toBe('risky');
  });

  test('wrong family grants growth without cargo; target cargo caps at three', () => {
    const state = playing();
    state.contract.committed = true;
    const other = state.relics.find(relic => !OO.matchesContract(state, relic));
    const radius = state.player.radius;
    OO.absorb(state, other);
    expect(state.player.radius).toBeGreaterThan(radius);
    expect(state.contract.cargo).toBe(0);
    const targets = state.relics.filter(relic => OO.matchesContract(state, relic));
    for (const relic of targets) OO.absorb(state, relic);
    expect(state.contract.cargo).toBe(3);
  });

  test('starting seed can collect its first target through physical contact', () => {
    const state = playing();
    const target = state.relics.find(relic => OO.matchesContract(state, relic));
    state.relics = [target];
    state.hazards = [];
    state.player.x = target.x;
    state.player.y = target.y;
    OO.step(state, {}, 1 / 60);
    expect(state.contract.cargo).toBe(1);
    expect(target.active).toBe(false);
  });

  test.each(['safe', 'risky'])('%s deposit requires cargo and nursery; rewards exactly once', choice => {
    const state = playing(42, choice);
    expect(OO.deposit(state)).toBe(false);
    fill(state);
    state.player.x = 280;
    expect(OO.deposit(state)).toBe(false);
    state.player.x = OO.NURSERY.x;
    state.player.y = OO.NURSERY.y;
    state.timeLeft = 60;
    const score = state.score;
    expect(OO.deposit(state)).toBe(true);
    expect(state.score).toBe(score + OO.CONTRACTS[choice].bonus);
    expect(state.timeLeft).toBe(65);
    expect(state.contractsCompleted).toBe(1);
    expect(state.outcome).toBe('delivered');
    expect(state.status).toBe('over');
    expect(OO.deposit(state)).toBe(false);
    expect(state.score).toBe(score + OO.CONTRACTS[choice].bonus);
  });

  test('empty field is not victory; expiry keeps points and replay resets the same seed', () => {
    const state = playing();
    state.relics.forEach(relic => { relic.active = false; });
    OO.step(state, {}, 1 / 60);
    expect(state.status).toBe('playing');
    state.score = 1234;
    state.timeLeft = .001;
    OO.step(state, {}, 1 / 60);
    expect(state.status).toBe('over');
    expect(state.outcome).toBe('expired');
    expect(state.score).toBe(1234);
    OO.start(state);
    expect(state.seed).toBe(42);
    expect(state.contract.cargo).toBe(0);
    expect(state.contractsCompleted).toBe(0);
    expect(state.hits).toBe(0);
  });

  test('an idle full-length run cannot harvest by camping at the nursery', () => {
    const state = playing();
    for (let tick = 0; tick < 65 * 60 + 2; tick++) OO.step(state, {}, 1 / 60);
    expect(state.status).toBe('over');
    expect(state.contractsCompleted).toBe(0);
    expect(state.contract.cargo).toBe(0);
  });

  test('repeated damage keeps cargo recoverable without duplicate points or growth', () => {
    const state = playing();
    fill(state);
    const well = state.hazards[0];
    for (let hit = 0; hit < 4; hit++) {
      state.player.x = well.x;
      state.player.y = well.y;
      state.player.vx = 0;
      state.player.vy = 0;
      state.damageGrace = 0;
      state.hazards.forEach(hazard => { hazard.cooldown = 0; });
      const score = state.score, radius = state.player.radius;
      OO.step(state, {}, 1 / 60);
      expect(state.contract.cargo).toBe(2);
      expect(state.hits).toBe(hit + 1);
      const dropped = state.relics.filter(relic => relic.active && relic.recovered).at(-1);
      expect(dropped).toBeDefined();
      for (const hazard of state.hazards) {
        expect(Math.hypot(dropped.x-hazard.x,dropped.y-hazard.y)).toBeGreaterThan(hazard.radius+90);
      }
      expect(OO.absorb(state,dropped)).toBe(false);
      dropped.cooldown = 0;
      expect(OO.absorb(state,dropped)).toBe(true);
      expect(state.contract.cargo).toBe(3);
      expect(state.score).toBe(score);
      expect(state.player.radius).toBe(radius);
    }
  });

  test('overlapping wells share one hit grace; empty cargo still costs four seconds', () => {
    const state = playing();
    state.relics = [];
    const first = state.hazards[0];
    state.hazards[1].x = first.x;
    state.hazards[1].y = first.y;
    state.player.x = first.x;
    state.player.y = first.y;
    OO.step(state, {}, 1 / 60);
    expect(state.hits).toBe(1);
    expect(state.timeLeft).toBeCloseTo(65 - 4 - 1 / 60);
    expect(state.contract.cargo).toBe(0);
    for (let tick = 0; tick < 30; tick++) {
      state.player.x = first.x;
      state.player.y = first.y;
      OO.step(state, {}, 1 / 60);
    }
    expect(state.hits).toBe(1);
  });

  test('three targets grow the seed without exhausting the size progression', () => {
    const state = playing();
    fill(state);
    expect(state.player.radius).toBeGreaterThan(16);
    expect(state.player.radius).toBeLessThan(24);
    expect(state.relics.some(relic => relic.active && !OO.canAbsorb(state.player.radius, relic.radius))).toBe(true);
  });

  test('seeded fields retain a legal growth bridge from starter relics to the largest props', () => {
    // Eligibility proof only: sorting does not establish a timed navigable route.
    for (let seed = 1; seed <= 100; seed++) {
      const state = playing(seed);
      const relics = [...state.relics].sort((a, b) => a.radius - b.radius);
      for (const relic of relics) {
        expect(OO.canAbsorb(state.player.radius, relic.radius)).toBe(true);
        OO.absorb(state, relic);
      }
      expect(state.player.radius).toBeGreaterThan(32 / .96);
      expect(state.player.radius).toBeLessThan(45);
    }
  });

  test.each(['safe', 'risky'])('%s delivery outweighs an ordinary short-trip harvest and records the score split', choice => {
    const state = playing(42, choice);
    state.contract.committed = true;
    const ordinary = state.relics.filter(relic => !relic.target && relic.radius < 15).slice(0, 6);
    for (const relic of ordinary) OO.absorb(state, relic);
    fill(state);
    expect(state.harvestScore).toBe(state.score);
    expect(state.deliveryScore).toBe(0);
    expect(OO.deposit(state)).toBe(true);
    expect(state.deliveryScore).toBeGreaterThan(state.harvestScore);
    expect(state.score).toBe(state.harvestScore + state.deliveryScore);
    const deliveryScore = state.deliveryScore;
    expect(OO.deposit(state)).toBe(false);
    expect(state.deliveryScore).toBe(deliveryScore);
    OO.start(state);
    expect(state.harvestScore).toBe(0);
    expect(state.deliveryScore).toBe(0);
  });

  test('recovered cargo cannot inflate either score category', () => {
    const state = playing();
    fill(state);
    state.contract.cargo = 2;
    const target = state.relics.find(relic => OO.matchesContract(state, relic));
    target.active = true;
    target.recovered = true;
    const harvest = state.harvestScore;
    expect(OO.absorb(state, target)).toBe(true);
    expect(state.harvestScore).toBe(harvest);
    expect(state.deliveryScore).toBe(0);
    expect(state.score).toBe(harvest);
  });
});
