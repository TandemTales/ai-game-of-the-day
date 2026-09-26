'use strict';
const { loadPW } = require('../prism-warden/tools/aqueduct-pilot.cjs');
const tick = (PW, s, n, input = {}) => { for (let i = 0; i < n; i++) PW.step(s, input, 1 / 60); };
function start(PW, room = 'stars') { const s = PW.create({ room }); s.status = 'playing'; return s; }

test('Observatory authored exits and five challenges agree with its connected manifest', () => {
  const PW = loadPW(), region = PW.regionById('night-observatory');
  expect(PW.roomDef('weaver').beacon.next.room).toBe('stars');
  expect(region.challenges.map(c => c.id)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5']);
  const graph = PW.routeGraph(region.id);
  for (const { id } of region.rooms) {
    const room = PW.roomDef(id);
    expect(room.region).toBe(region.id);
    for (const exit of room.exits || []) {
      expect(PW.roomDef(exit.to)).toBeTruthy();
      expect(graph[id]).toContain(exit.to);
    }
  }
  expect(PW.roomDef('twins').beacon.next.room).toBe('descent');
});

test('burst requires acquisition and full charge, consumes once on press, and expires', () => {
  const PW = loadPW(), s = start(PW, 'obs-shutters');
  tick(PW, s, 1, { burst: true });
  expect(s.burstTime || 0).toBe(0);
  s.flags['stored-light'] = true; s.player.lightCharge = .5;
  tick(PW, s, 1); tick(PW, s, 1, { burst: true });
  expect(s.burstTime || 0).toBe(0);
  s.player.lightCharge = 1;
  tick(PW, s, 1); tick(PW, s, 1, { burst: true });
  expect(s.burstTime).toBeGreaterThan(5);
  expect(s.player.lightCharge).toBeLessThan(.05);
  const score = s.score;
  s.player.invulnerable = 99;
  tick(PW, s, 400, { burst: true });
  expect(s.burstTime).toBe(0);
  expect(s.score).toBe(score);
});

test('safe light wells refill charge without granting score or passive challenge completion', () => {
  const PW = loadPW(), s = start(PW);
  s.flags['stored-light'] = true; s.player.lightCharge = 0;
  const pad = s.rechargePads[0];
  s.player.x = pad.x; s.player.y = pad.y;
  tick(PW, s, 150);
  expect(s.player.lightCharge).toBeCloseTo(1);
  const score = s.score;
  tick(PW, s, 300);
  expect(s.score).toBe(score);
  expect(s.cleared.D1).toBe(false);
});

test('Observatory retries restore burst resource and score rather than duplicate rewards', () => {
  const PW = loadPW(), s = start(PW, 'obs-shutters');
  const before = JSON.parse(s._entry);
  s.flags['stored-light'] = true; s.player.lightCharge = 1;
  tick(PW, s, 1, { burst: true }); s.score += 999;
  PW.retryRoom(s);
  expect(s.score).toBe(before.score);
  expect(s.player.lightCharge).toBe(before.player.lightCharge);
  expect(s.flags['stored-light']).toBe(before.flags['stored-light']);
});

test('idle play cannot solve any of the five Observatory challenges', () => {
  const PW = loadPW();
  for (const room of ['stars', 'obs-shutters', 'shade', 'telescope', 'twins']) {
    const s = start(PW, room); tick(PW, s, 1800);
    for (const id of ['D1', 'D2', 'D3', 'D4', 'D5']) expect(s.cleared[id]).toBe(false);
  }
});

test('unlit gaps return to permanent land; a burst supports traversal only while lit', () => {
  const PW = loadPW(), s = start(PW, 'stars');
  // Controlled collision fixture isolates the temporal bridge from authored combat.
  s.voids = [{ x: 260, y: 150, w: 180, h: 450 }];
  s.starPaths = [{ id: 'test-span', x: 260, y: 350, w: 180, h: 70, when: 'always', active: false }];
  s.enemies = []; s.walls = []; s.player.x = 235; s.player.y = 384;
  tick(PW, s, 1); const land = { x: s.player.x, y: s.player.y }, hp = s.player.hp;
  tick(PW, s, 8, { mx: 1, dash: true });
  expect(s.player.x).toBeLessThan(260);
  expect(s.player.hp).toBeLessThanOrEqual(hp);
  s.flags['stored-light'] = true; s.player.lightCharge = 1;
  s.player.x = land.x; s.player.y = land.y; s.player.dashTime = 0;
  tick(PW, s, 1); tick(PW, s, 25, { mx: 1, burst: true });
  expect(s.player.x).toBeGreaterThan(260);
  tick(PW, s, 400);
  expect(s.player.x).toBeLessThan(260);
});

test('paired twins need a light interrupt; burst opens armor without dealing passive damage', () => {
  const PW = loadPW(), s = start(PW, 'twins');
  const [a, b] = s.enemies.filter(e => e.type === 'twin');
  expect(a.linked).toBe(b.id); expect(b.linked).toBe(a.id);
  s.walls = []; s.gates = []; s.player.invulnerable = 99;
  s.player.x = (a.x + b.x) / 2; s.player.y = (a.y + b.y) / 2;
  tick(PW, s, 1);
  expect(a.shielded).toBe(true); expect(b.shielded).toBe(true);
  const hp = [a.hp, b.hp], score = s.score;
  s.flags['stored-light'] = true; s.player.lightCharge = 1;
  tick(PW, s, 1, { burst: true });
  expect(a.exposed).toBeGreaterThan(3); expect(b.exposed).toBeGreaterThan(3);
  expect([a.hp, b.hp]).toEqual(hp); expect(s.score).toBe(score);
  tick(PW, s, 260);
  expect(a.shielded).toBe(true); expect(b.shielded).toBe(true);
});

test('five Observatory encounters continue deterministically into the Drowned Crown without optional refuges', () => {
  const { play } = require('../prism-warden/tools/observatory-pilot.cjs');
  const a = play(loadPW()), b = play(loadPW());
  expect(a.status).toBe('cleared');
  expect(a.roomId).toBe('twins');
  expect(a.next.room).toBe('descent');
  expect(a.cleared).toMatchObject({ D1: true, D2: true, D3: true, D4: true, D5: true });
  expect(a.player.hp).toBeGreaterThan(0);
  expect(a.flags['sky-chart']).toBeUndefined(); expect(a.flags['shade-freed']).toBeUndefined();
  expect(a.beacon.reached).toBe(true);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
}, 60000);

test('optional discoveries open distinct protected recharge refuges, neither required for the beacon', () => {
  const PW = loadPW(), s = start(PW, 'twins');
  tick(PW, s, 1);
  expect(s.gates.filter(g => g.open)).toHaveLength(0);
  s.flags['sky-chart'] = true; tick(PW, s, 1);
  expect(s.gates.find(g => g.id === 'chart-refuge').open).toBe(true);
  expect(s.gates.find(g => g.id === 'shade-refuge').open).toBe(false);
  s.flags['shade-freed'] = true; tick(PW, s, 1);
  expect(s.gates.every(g => g.open)).toBe(true);
  expect(s.beacon.requires).toEqual(['star-twin-dawn', 'star-twin-dusk']);
});
