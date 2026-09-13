const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console };
vm.createContext(ctx);
for (const file of ['logic', 'campaign']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, `../ironwake/assets/js/${file}.js`), 'utf8'), ctx);
}
const IW = ctx.IW, DT = 1 / 60;

function encounter() {
  const s = IW.createCampaignState(1);
  IW.start(s);
  const e = s.enemies.find(enemy => enemy.type === 'hunter');
  // Preserve the authored hunter stats; isolate its observable attack from other
  // enemies, objectives, pickups and terrain. Terrain tests add explicit cover.
  s.enemies = [e]; s.buildings = []; s.hazards = []; s.pickups = []; s.objectives = [];
  Object.assign(e, { x: 0, z: 0, cooldown: 0 });
  Object.assign(s.player, { x: 8, z: 0 });
  return { s, e };
}
function frames(s, n, input = {}, dt = DT) {
  for (let i = 0; i < n; i++) IW.step(s, input, dt);
}
function phase(e) { return e.hunterAttack && e.hunterAttack.phase; }
function until(s, predicate, input = {}, dt = DT) {
  let count = 0;
  while (!predicate() && count < 600) { IW.step(s, input, dt); count++; }
  expect(predicate()).toBe(true);
  return count * dt;
}
function warn(fixture) {
  IW.step(fixture.s, {}, DT);
  expect(phase(fixture.e)).toBe('windup');
  return fixture;
}
function position(e) { return { x: e.x, z: e.z }; }
function cover(status) {
  return { id: 'test-cover', x: 4, z: status === 'standing' ? 0 : -3,
    w: .1, d: status === 'standing' ? 6 : 1, h: 6, hp: 100, maxHp: 100,
    status, fallX: 0, fallZ: 1, fallProgress: status === 'standing' ? 0 : 1, hitIds: [] };
}

describe('Ironwake committed hunter rush', () => {
  test('fourteen meters is a reachable attack boundary; farther targets are chased first', () => {
    const edge = encounter(), outside = encounter(), cooling = encounter();
    edge.s.player.x = 14;
    outside.s.player.x = 14.01;
    cooling.e.cooldown = 1;
    IW.step(edge.s, {}, DT);
    IW.step(outside.s, {}, DT);
    IW.step(cooling.s, {}, DT);
    expect(phase(edge.e)).toBe('windup');
    expect(position(edge.e)).toEqual({ x: 0, z: 0 });
    expect(outside.e.hunterAttack).toBeFalsy();
    expect(outside.e.x).toBeGreaterThan(0);
    expect(cooling.e.hunterAttack).toBeFalsy();
    until(edge.s, () => phase(edge.e) === 'recover');
    expect(edge.s.player.hp).toBe(edge.s.player.maxHp - 18);
  });

  test('the warning holds position and deals no damage for at least .9 seconds', () => {
    const { s, e } = warn(encounter()), origin = position(e), hp = s.player.hp;
    frames(s, 54);
    expect(phase(e)).toBe('windup');
    expect(position(e)).toEqual(origin);
    expect(s.player.hp).toBe(hp);
    expect(s.strikes).toHaveLength(0);
    until(s, () => phase(e) === 'rush');
    expect(position(e)).toEqual(origin);
    expect(s.player.hp).toBe(hp);
  });

  test('the warning locks a normalized direction and rush never homes onto a moving target', () => {
    const { s, e } = warn(encounter());
    const direction = { dx: e.hunterAttack.dx, dz: e.hunterAttack.dz }, angle = e.angle;
    expect(Math.hypot(direction.dx, direction.dz)).toBeCloseTo(1);
    expect(direction.dx).toBeGreaterThan(.999);
    expect(direction.dz).toBeCloseTo(0);
    // A large target relocation isolates commitment, including beyond aggro range.
    Object.assign(s.player, { x: -30, z: 60 });
    until(s, () => phase(e) === 'rush');
    while (phase(e) === 'rush') {
      IW.step(s, {}, DT);
      expect(e.hunterAttack).toMatchObject(direction);
      expect(e.angle).toBeCloseTo(angle);
      expect(e.z).toBeCloseTo(0);
    }
    expect(phase(e)).toBe('recover');
    expect(e.x).toBeGreaterThan(5);
    expect(s.player.hp).toBe(s.player.maxHp);
  });

  test('recovery gives at least 1.1 seconds without movement, attacks or contact damage', () => {
    const { s, e } = warn(encounter());
    until(s, () => phase(e) === 'recover');
    const origin = position(e), hp = s.player.hp;
    Object.assign(s.player, origin);
    frames(s, 66);
    expect(phase(e)).toBe('recover');
    expect(position(e)).toEqual(origin);
    expect(s.player.hp).toBe(hp);
    expect(s.strikes).toHaveLength(0);
    until(s, () => !e.hunterAttack);
    expect(e.cooldown).toBeGreaterThan(0);
  });

  test('stationary contact costs exactly 18 armor once, while an ordinary lateral dodge avoids it', () => {
    const idle = warn(encounter()), dodge = warn(encounter());
    until(idle.s, () => phase(idle.e) === 'recover');
    until(dodge.s, () => phase(dodge.e) === 'recover', { moveZ: 1 });
    expect(idle.s.player.hp).toBe(idle.s.player.maxHp - 18);
    expect(dodge.s.player.hp).toBe(dodge.s.player.maxHp);
    expect(dodge.s.player.z).toBeGreaterThan(idle.s.player.z + 5);
    expect(idle.e.hunterAttack.hit).toBe(true);
    expect(idle.s.strikes).toHaveLength(0);
  });

  test('invulnerability consumes the contact and cannot cause deferred damage from the same rush', () => {
    const { s, e } = warn(encounter());
    until(s, () => phase(e) === 'rush');
    s.player.invulnerable = 10;
    until(s, () => e.hunterAttack.hit);
    expect(s.player.hp).toBe(s.player.maxHp);
    s.player.invulnerable = 0;
    // Continue overlapping through every remaining rush frame.
    while (phase(e) === 'rush') {
      Object.assign(s.player, position(e));
      IW.step(s, {}, DT);
      expect(s.player.hp).toBe(s.player.maxHp);
    }
    expect(phase(e)).toBe('recover');
  });

  test.each(['windup', 'rush'])('killing a hunter during %s cancels every future contact', attackPhase => {
    const { s, e } = warn(encounter());
    until(s, () => phase(e) === attackPhase);
    // Terminal combat state is the input to this enemy-update contract.
    e.alive = false; e.hp = 0;
    const origin = position(e), hp = s.player.hp;
    Object.assign(s.player, origin);
    frames(s, 180);
    expect(position(e)).toEqual(origin);
    expect(e.hunterAttack).toBeNull();
    expect(s.player.hp).toBe(hp);
    expect(s.strikes).toHaveLength(0);
  });

  test('lethal contact ends the chapter immediately and later frames cannot resume the attack', () => {
    const { s, e } = warn(encounter());
    s.player.hp = 10;
    until(s, () => s.status === 'lost');
    expect(s.player.hp).toBe(0);
    const snapshot = JSON.parse(JSON.stringify(s));
    frames(s, 120);
    expect(JSON.parse(JSON.stringify(s))).toEqual(snapshot);
    expect(e.hunterAttack.hit).toBe(true);
  });

  test.each(['standing', 'rubble'])('rush cannot cross thin %s cover even on maximum-length frames', status => {
    const { s, e } = warn(encounter()), b = cover(status);
    s.buildings = [b];
    until(s, () => phase(e) === 'rush');
    while (phase(e) === 'rush') {
      IW.step(s, {}, .05);
      expect(IW.inFootprint(e, b, e.radius, 0)).toBe(false);
      expect(e.x).toBeLessThan(b.x);
    }
    expect(phase(e)).toBe('recover');
    expect(s.player.hp).toBe(s.player.maxHp);
    expect(b.status).toBe(status);
  });

  test('rush stops inside actor-radius world bounds and enters recovery', () => {
    const { s, e } = warn(encounter());
    until(s, () => phase(e) === 'rush');
    s.bounds.maxX = 4;
    s.player.z = 30;
    until(s, () => phase(e) === 'recover', {}, .05);
    expect(e.x).toBeGreaterThan(0);
    expect(e.x + e.radius).toBeLessThanOrEqual(s.bounds.maxX);
    expect(s.player.hp).toBe(s.player.maxHp);
  });

  test('large frame requests cannot skip the warning and replayed input is deterministic', () => {
    const a = warn(encounter()), b = warn(encounter());
    for (const { s, e } of [a, b]) {
      IW.step(s, {}, 20);
      expect(phase(e)).toBe('windup');
      expect(position(e)).toEqual({ x: 0, z: 0 });
      frames(s, 40);
      frames(s, 10, { moveZ: 1, dash: true });
      frames(s, 180);
    }
    expect(a.s).toEqual(b.s);
  });

  test.each(['windup', 'rush', 'recover'])('retry and unfinished reload discard %s and restore authored hunters', attackPhase => {
    const { s, e } = warn(encounter());
    until(s, () => phase(e) === attackPhase);
    const restored = IW.restoreCampaign(JSON.parse(JSON.stringify(IW.campaignSave(s))));
    s.status = 'lost'; IW.start(s);
    const fresh = IW.createCampaignState(1);
    for (const reset of [s, restored]) {
      expect(reset.enemies).toEqual(fresh.enemies);
      expect(reset.enemies.filter(enemy => enemy.type === 'hunter').length).toBeGreaterThan(1);
      expect(reset.enemies.filter(enemy => enemy.type === 'hunter').every(enemy => !enemy.hunterAttack)).toBe(true);
      expect(reset.strikes).toHaveLength(0);
      expect(reset.player.hp).toBe(reset.player.maxHp);
    }
  });
});
