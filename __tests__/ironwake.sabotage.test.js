const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console };
vm.createContext(ctx);
for (const file of ['logic', 'campaign']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, `../ironwake/assets/js/${file}.js`), 'utf8'), ctx);
}
const IW = ctx.IW;

function game(chapter = 0) {
  const s = IW.createCampaignState(chapter);
  IW.start(s);
  // Keep authored actors, positions, collision and objective assignments. Suppress
  // firing only where a test isolates the interaction from incoming damage.
  s.enemies.forEach(e => { e.cooldown = 10000; });
  return s;
}
function frames(s, input, count) {
  for (let i = 0; i < count; i++) IW.step(s, input, 1 / 60);
}
function moveTo(s, point) { Object.assign(s.player, { x: point.x, z: point.z }); }
function relay(s) { return s.pickups.find(c => c.id === 'battery-relay-0'); }
function battery(s) { return s.enemies.filter(e => /^c0-s3-/.test(e.id)); }
function recoverArchive(s) {
  moveTo(s, s.pickups.find(c => c.id === 'cache-0-0'));
  IW.step(s, {}, 1 / 60);
}
function sabotage(s) {
  recoverArchive(s);
  moveTo(s, relay(s));
  frames(s, { interact: true }, 301);
}
function snapshot(s) { return JSON.parse(JSON.stringify(IW.campaignSave(s))); }

describe('Ironwake optional Breakwater battery sabotage', () => {
  test('the authored relay has an accessible footprint and requires the ferry archive', () => {
    const s = game(), r = relay(s);
    expect(r).toMatchObject({ type: 'relay', x: 12, z: -45, locked: true, taken: false, progress: 0, duration: 5 });
    expect(s.buildings.some(b => IW.inFootprint(r, b, s.player.radius, 0))).toBe(false);
    expect(battery(s)).toHaveLength(2);
    expect(battery(s).every(e => e.type === 'artillery' && e.alive)).toBe(true);
    moveTo(s, r);
    frames(s, { interact: true }, 360);
    expect(r.taken).toBe(false);
    expect(r.progress).toBe(0);
    expect(s.score).toBe(0);
    expect(s.kills).toBe(0);
    recoverArchive(s);
    expect(r.locked).toBe(false);
    expect(s.totals.intel).toEqual(['cache-0-0']);
    expect(s.score).toBe(600);
    moveTo(s, r);
    frames(s, {}, 360);
    expect(r.taken).toBe(false);
    expect(r.progress).toBe(0);
    expect(s.score).toBe(600);
  });

  test('a full uninterrupted five-second hold disables only the authored battery and scores once', () => {
    const s = game();
    recoverArchive(s);
    moveTo(s, relay(s));
    const otherIds = s.enemies.filter(e => !battery(s).includes(e)).map(e => e.id);
    frames(s, { interact: true }, 297);
    expect(relay(s).taken).toBe(false);
    expect(relay(s).progress).toBeCloseTo(4.95);
    expect(battery(s).every(e => e.alive)).toBe(true);
    frames(s, { interact: true }, 4);
    expect(relay(s)).toMatchObject({ taken: true, progress: 5 });
    expect(battery(s).every(e => !e.alive && e.hp === 0 && e.disabled)).toBe(true);
    expect(s.enemies.filter(e => otherIds.includes(e.id)).every(e => e.alive && e.hp === e.maxHp)).toBe(true);
    expect(s.kills).toBe(2);
    expect(s.score).toBe(900);
    expect(s.stage).toBe(0);
    frames(s, { interact: true }, 360);
    expect(s.kills).toBe(2);
    expect(s.score).toBe(900);
    moveTo(s, battery(s)[0]);
    IW.step(s, { rip: true }, 1 / 60);
    expect(s.player.weapon).toBe('rail');
    expect(battery(s)[0].weaponTaken).toBe(true);
  });

  test.each(['release', 'leave'])('%s discards partial progress rather than banking it', interruption => {
    const s = game();
    recoverArchive(s);
    moveTo(s, relay(s));
    frames(s, { interact: true }, 240);
    expect(relay(s).progress).toBeCloseTo(4);
    if (interruption === 'leave') s.player.x = relay(s).x + 6.01;
    IW.step(s, { interact: interruption === 'leave' }, 1 / 60);
    expect(relay(s).progress).toBe(0);
    moveTo(s, relay(s));
    frames(s, { interact: true }, 120);
    expect(relay(s).taken).toBe(false);
    expect(relay(s).progress).toBeCloseTo(2);
    frames(s, { interact: true }, 181);
    expect(relay(s).taken).toBe(true);
  });

  test('six meters is in range and a long frame cannot bypass the hold timer', () => {
    const s = game();
    recoverArchive(s);
    moveTo(s, { x: relay(s).x + 6, z: relay(s).z });
    IW.step(s, { interact: true }, 20);
    expect(relay(s).progress).toBeCloseTo(.05);
    expect(relay(s).taken).toBe(false);
  });

  test('an artillery piece killed in combat is not resurrected or rewarded twice', () => {
    const s = game(), gun = battery(s)[0];
    moveTo(s, { x: gun.x, z: gun.z + 3 });
    frames(s, { punch: true, aimX: gun.x, aimZ: gun.z }, 75);
    expect(gun).toMatchObject({ alive: false, hp: 0, disabled: true });
    expect(s.kills).toBe(1);
    expect(s.score).toBe(150);
    sabotage(s);
    expect(gun).toMatchObject({ alive: false, hp: 0, disabled: true });
    expect(s.kills).toBe(2);
    expect(s.score).toBe(900);
  });

  test('a shell launched just before the relay is cut still lands and damages the mech', () => {
    const s = game();
    recoverArchive(s);
    moveTo(s, relay(s));
    frames(s, { interact: true }, 294);
    const gun = battery(s)[0];
    gun.cooldown = 0;
    IW.step(s, { interact: true }, 1 / 60);
    const strike = s.strikes.find(b => b.sourceId === gun.id);
    expect(strike).toBeDefined();
    const hp = s.player.hp;
    frames(s, { interact: true }, 6);
    expect(relay(s).taken).toBe(true);
    expect(gun.alive).toBe(false);
    expect(s.strikes).toContain(strike);
    expect(strike.life).toBeGreaterThan(0);
    frames(s, {}, 100);
    expect(s.player.hp).toBe(hp - gun.artilleryDamage);
    expect(s.strikes).toHaveLength(0);
    frames(s, {}, 300);
    expect(s.strikes).toHaveLength(0);
    expect(s.player.hp).toBe(hp - gun.artilleryDamage);
  });

  test('identical interrupted holds, combat warnings and completion remain deterministic', () => {
    const a = game(), b = game();
    for (const s of [a, b]) {
      recoverArchive(s);
      moveTo(s, relay(s));
      battery(s).forEach(e => { e.cooldown = 1; });
      frames(s, { interact: true }, 120);
      frames(s, {}, 1);
      frames(s, { interact: true }, 301);
    }
    expect(a).toEqual(b);
    expect(relay(a).taken).toBe(true);
  });

  test.each(['partial', 'complete'])('%s sabotage rolls back with unbanked intel and score on retry and reload', progress => {
    const s = game();
    recoverArchive(s);
    moveTo(s, relay(s));
    frames(s, { interact: true }, progress === 'partial' ? 120 : 301);
    const restored = IW.restoreCampaign(snapshot(s));
    s.status = 'lost';
    IW.start(s);
    for (const reset of [s, restored]) {
      expect(relay(reset)).toMatchObject({ locked: true, taken: false, progress: 0 });
      expect(reset.totals.intel).toEqual([]);
      expect(reset.score).toBe(0);
      expect(reset.kills).toBe(0);
      expect(battery(reset).every(e => e.alive && e.hp === e.maxHp && !e.disabled)).toBe(true);
    }
  });

  test('won reload preserves the sabotage debrief while retry and chapter advance isolate its state', () => {
    const s = game();
    sabotage(s);
    s.status = 'won';
    const save = snapshot(s), won = IW.restoreCampaign(save);
    expect(relay(won)).toMatchObject({ taken: true, progress: 5 });
    expect(won.score).toBe(900);
    expect(won.kills).toBe(2);
    IW.start(won);
    expect(relay(won)).toMatchObject({ locked: true, taken: false, progress: 0 });
    expect(won.score).toBe(0);
    const next = IW.restoreCampaign(save);
    expect(IW.advance(next, 'armor')).toBe(true);
    expect(next.chapter).toBe(1);
    expect(relay(next)).toBeUndefined();
    expect(next.totals.intel).toEqual(['cache-0-0']);
    expect(next.totals.kills).toBe(2);
    expect(next.score).toBe(900);
    IW.start(next);
    next.status = 'lost';
    IW.start(next);
    expect(next.totals.kills).toBe(2);
    expect(next.score).toBe(900);
    expect(relay(game())).toMatchObject({ locked: true, taken: false, progress: 0 });
    for (let chapter = 1; chapter < 5; chapter++) expect(relay(game(chapter))).toBeUndefined();
  });

  test('the normal objective chain has no new archive or relay completion gate', () => {
    const s = game();
    // This fixture isolates the objective gates after their combat prerequisites
    // have been met; it does not claim to demonstrate a playable combat route.
    s.enemies.forEach(e => { e.alive = false; e.hp = 0; });
    for (const objective of s.objectives) {
      moveTo(s, objective);
      frames(s, { interact: true }, objective.type === 'hold' ? 421 : 1);
      expect(objective.done).toBe(true);
    }
    expect(s.status).toBe('won');
    expect(s.totals.intel).toEqual([]);
    expect(relay(s)).toMatchObject({ locked: true, taken: false, progress: 0 });
  });
});
