'use strict';
const { loadPW } = require('../prism-warden/tools/aqueduct-pilot.cjs');
const tick = (PW, s, n, input = {}) => { for (let i = 0; i < n; i++) PW.step(s, input, 1 / 60); };
const start = PW => { const s = PW.create({ room: 'crown' }); s.status = 'playing'; s.player.invulnerable = 99; return s; };

test('legal E1-E5 actions reach both rescues and the final beacon without injected health or circuits', () => {
  const PW=loadPW(),s=require('../prism-warden/tools/crown-pilot.cjs').play(PW);
  expect(s.status).toBe('won'); expect(s.player.hp).toBeGreaterThan(0);
  for(const id of ['E1','E2','E3','E4','E5'])expect(s.cleared[id]).toBe(true);
  expect(s.flags['nacre-freed']).toBe(true);expect(s.flags['ilex-evacuated']).toBe(true);
  expect(s.receivers.filter(r=>r.id.startsWith('crown-')).every(r=>r.active)).toBe(true);
});

test('Archive burst crossing connects the north bank to the record without falling', () => {
  const PW=loadPW(),s=PW.create({room:'archive'});s.status='playing';
  // Tool ownership and north-bank position are explicit fixtures; movement uses step.
  s.flags['stored-light']=true;s.player.lightCharge=1;s.player.x=512;s.player.y=292;
  tick(PW,s,1,{burst:true,my:1});tick(PW,s,62,{my:1});
  expect(s.player.y).toBeGreaterThan(456);expect(s.hits).toBe(0);expect(s.player.hp).toBe(6);
});

test('Drowned Crown graph, physical exits, discoveries and Observatory continuation are authored', () => {
  const PW = loadPW(), region = PW.regionById('drowned-crown');
  expect(region.rooms.map(room => room.id)).toEqual(['descent', 'galleries', 'circuit', 'lighthouse', 'crown', 'archive']);
  expect(region.challenges.map(challenge => challenge.id)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5']);
  expect(PW.roomDef('twins').beacon.next.room).toBe('descent');
  const shoal = PW.roomDef('circuit');
  expect(shoal.name).toBe('Switchback Shoal');
  expect(shoal.tide.period).toBe(12);
  expect(shoal.water.map(channel => channel.when)).toEqual(['high', 'low', 'high', 'low']);
  expect(shoal.rescue).toBeUndefined();
  expect(shoal.clearWhen).toEqual({ defeated: ['circuit-sentinel'] });
  expect(PW.roomDef('archive').pickups[0].text).toContain('Switchback Shoal');
  expect(region.discoveries.find(item => item.flag === 'ilex-evacuated').hint).toContain('east evacuation landing');
  expect(PW.roomDef('crown').rescue).toMatchObject({ flag: 'nacre-freed', completes: false });
  expect(PW.roomDef('crown').escort.flag).toBe('ilex-evacuated');
  expect(PW.roomDef('crown').gates.find(g => g.id === 'final-evacuation-gate').opensWhen.flags).toEqual(['nacre-freed', 'ilex-evacuated']);
  const graph = PW.routeGraph(region.id), seen = new Set(['descent']), queue = ['descent'];
  while (queue.length) for (const next of graph[queue.shift()]) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  expect(seen.size).toBe(region.rooms.length);
  for (const { id } of region.rooms) {
    const room = PW.roomDef(id);
    expect(room.region).toBe(region.id);
    for (const exit of room.exits) {
      expect(PW.roomDef(exit.to)).toBeTruthy();
      expect(PW.roomDef(exit.to).exits.some(back => back.to === id)).toBe(true);
      expect(exit.spawn.x).toBeGreaterThanOrEqual(0);
      expect(exit.spawn.x).toBeLessThan(room.w);
      expect(exit.spawn.y).toBeGreaterThanOrEqual(0);
      expect(exit.spawn.y).toBeLessThan(room.h);
    }
  }
});

test('Crown rescue and escort copy matches the east evacuation path', () => {
  const room = loadPW().roomDef('crown');
  expect(room.intro).toContain('guide Ilex east');
  expect(room.rescue.text).toContain('east evacuation landing');
  expect(room.escort.text).toContain('east evacuation landing');
  expect(room.objectives.rescue).toContain('guide Ilex east');
  expect(room.escortExit.x).toBeGreaterThan(room.escort.x);
});

test('Switchback Shoal can be traversed from its authored spawn on the normal tide cycle', () => {
  const PW = loadPW(), s = PW.create({ room: 'circuit' });
  s.status = 'playing'; s.player.hp = 5; s.player.invulnerable = 99;
  const checkpoints = [[300, 404], [360, 320], [520, 320], [560, 496], [700, 496], [700, 404], [920, 384]];
  const tides = new Set();
  for (const [tx, ty] of checkpoints) {
    let frames = 0;
    while (Math.hypot(tx - s.player.x, ty - s.player.y) > 18 && frames < 60 * 15) {
      const dx = tx - s.player.x, dy = ty - s.player.y, d = Math.hypot(dx, dy) || 1;
      PW.step(s, { mx: dx / d, my: dy / d }, 1 / 60);
      tides.add(s.tide.high ? 'high' : 'low'); frames++;
      expect(s.status).toBe('playing');
    }
    expect(Math.hypot(tx - s.player.x, ty - s.player.y)).toBeLessThanOrEqual(18);
  }
  expect(tides).toEqual(new Set(['high', 'low']));
  expect(s.gates.find(g => g.id === 'circuit-lighthouse-lock').open).toBe(false);
  expect(s.flags['nacre-freed']).toBeUndefined();
});

test('Keeper stages require named artillery, a live circuit floor change, then a close burst interrupt', () => {
  const PW = loadPW(), s = start(PW), keeper = s.enemies.find(e => e.type === 'crown');
  expect(keeper).toMatchObject({ stage: 1, hp: 6 });
  s.player.x = 700; s.player.y = 384;
  s.shots = [{ id: 901, x: 650, y: 384, vx: 300, vy: 0, friendly: false, life: 3, r: 7, owner: 'not-crown-artillery' }];
  tick(PW, s, 45, { ax: -1, ay: 0, reflect: true });
  expect(keeper.exposed).toBe(0);
  s.shots = [{ id: 902, x: 650, y: 384, vx: 300, vy: 0, friendly: false, life: 3, r: 7, owner: 'crown-artillery' }];
  tick(PW, s, 45, { ax: -1, ay: 0, reflect: true });
  expect(keeper.exposed).toBeGreaterThan(0);
  s.player.x = 460; s.player.y = 384; s.player.slashCooldown = 0;
  tick(PW, s, 1, { ax: 1, ay: 0, slash: true });
  expect(keeper).toMatchObject({ stage: 2, hp: 4, phase: 'sealed' });

  s.receivers.forEach(receiver => { receiver.active = true; receiver.charge = 1; receiver.latch = true; });
  let floor = s.breakwaters.map(b => `${b.id}:${b.risen ? 1 : 0}`).join('|');
  keeper.floorSignature = floor;
  let openingSeen = false;
  for (let i = 0; i < 60 * 10 && !openingSeen; i++) { PW.step(s, {}, 1 / 60); openingSeen = keeper.exposed > 0; }
  expect(openingSeen).toBe(true);
  s.player.x = 460; s.player.y = 384;
  s.player.slashCooldown = 0;
  tick(PW, s, 1, { ax: 1, ay: 0, slash: true });
  expect(keeper).toMatchObject({ stage: 3, hp: 2, phase: 'eclipse-windup' });

  s.flags['stored-light'] = true; s.player.lightCharge = 1;
  tick(PW, s, 1, { ax: 1, ay: 0, burst: true });
  expect(s.burstTime).toBeGreaterThan(0);
  expect(keeper.exposed).toBeGreaterThan(0);
  s.player.slashCooldown = 0;
  tick(PW, s, 1, { ax: 1, ay: 0, slash: true });
  expect(keeper.hp).toBe(0);
  expect(s.status).toBe('playing');
  expect(s.cleared.E5).toBe(false);
  expect(s.beacon.reached).toBe(false);
});

test('Keeper defeat frees Nacre, escorts Ilex, and clears E5 only at the gated beacon', () => {
  const PW = loadPW(), s = start(PW);
  const keeper = s.enemies.find(e => e.type === 'crown');
  keeper.hp = 0; keeper.phase = 'defeated'; s.flags['defeated:eclipse-keeper'] = true;
  tick(PW, s, 1);
  expect(s.gates.find(g => g.id === 'nacre-cage-gate').open).toBe(true);
  expect(s.gates.find(g => g.id === 'final-evacuation-gate').open).toBe(false);
  s.player.x = 808; s.player.y = 168;
  tick(PW, s, 1);
  expect(s.flags['nacre-freed']).toBe(true);
  expect(s.status).toBe('playing');
  expect(s.gates.find(g => g.id === 'final-evacuation-gate').open).toBe(false);
  s.player.x = 248; s.player.y = 624; s.escort.invulnerable = 99;
  for (const [x, y] of [[248, 624], [376, 624], [520, 624], [664, 656], [744, 656], [808, 624]]) {
    s.player.x = x; s.player.y = y; tick(PW, s, 60 * 2);
  }
  expect(s.flags['ilex-evacuated']).toBe(true);
  expect(s.gates.find(g => g.id === 'final-evacuation-gate').open).toBe(true);
  s.player.x = 808; s.player.y = 384;
  tick(PW, s, 60, { mx: 1, ax: 1 });
  expect(s.status).toBe('won');
  expect(s.cleared.E5).toBe(true);
  expect(s.beacon.reached).toBe(true);
});
