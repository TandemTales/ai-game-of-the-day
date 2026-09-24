'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadPW() {
  const context = { window: {}, Math, Number };
  vm.createContext(context);
  for (const file of ['regions.js', 'logic.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../prism-warden/assets/js/', file), 'utf8'), context);
  }
  return context.window.PW;
}
function start(PW, room) {
  const state = PW.create({ room });
  state.status = 'playing';
  return state;
}
function tick(PW, state, frames, input = {}) {
  for (let i = 0; i < frames; i++) PW.step(state, input, 1 / 60);
}

test('Glass Kiln challenge graph matches its authored room exits and follows the reservoir', () => {
  const PW = loadPW(), kiln = PW.regionById('glass-kiln');
  expect(kiln.rooms.map(room => room.id)).toEqual(['furnace', 'bridge', 'rail', 'foundry', 'weaver', 'quench']);
  expect(kiln.challenges.map(challenge => challenge.id)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5']);
  expect(PW.roomDef('reservoir').beacon.next.room).toBe('furnace');
  for (const id of kiln.rooms.map(room => room.id)) {
    const room = PW.roomDef(id);
    expect(room.region).toBe('glass-kiln');
    for (const exit of room.exits || []) expect(PW.roomDef(exit.to)).toBeTruthy();
  }
  expect(PW.routeGraph('glass-kiln').quench).toContain('bridge');
});

test('kiln thermal phases and hot/cold glass state replay deterministically', () => {
  const PW = loadPW(), a = start(PW, 'furnace'), b = start(PW, 'furnace');
  expect(a.thermal.hot).toBe(true);
  expect(a.glass.some(g => g.mode === 'hazard' && g.when === 'hot' && g.active)).toBe(true);
  tick(PW, a, 270);
  tick(PW, b, 270);
  expect(a.thermal.hot).toBe(false);
  expect(a.glass.filter(g => g.mode === 'hazard' && g.when === 'cold').every(g => g.active)).toBe(true);
  expect(JSON.stringify(a.thermal)).toBe(JSON.stringify(b.thermal));
  expect(JSON.stringify(a.glass)).toBe(JSON.stringify(b.glass));
});

test('annealed glass blocks movement and active furnace glass gives contact grace', () => {
  const PW = loadPW(), solid = start(PW, 'furnace');
  solid.glass.push({ id: 'test-solid', x: 100, y: 360, w: 22, h: 48, mode: 'solid', when: 'hot', active: false });
  solid.player.x = 60; solid.player.y = 384;
  tick(PW, solid, 12, { mx: 1, ax: 1 });
  expect(solid.player.x).toBeLessThanOrEqual(86.1);

  const hazard = start(PW, 'furnace');
  hazard.glass.push({ id: 'test-hazard', x: 64, y: 356, w: 80, h: 56, mode: 'hazard', when: 'hot', active: false, warning: 0 });
  tick(PW, hazard, 30);
  expect(hazard.hits).toBe(0);
  expect(hazard.glass.find(g => g.id === 'test-hazard').warning).toBeGreaterThan(0);
  tick(PW, hazard, 30);
  expect(hazard.hits).toBe(1);
  expect(hazard.player.hp).toBe(hazard.player.maxHp - 1);
});

test('cold annealed bridge is traversable and cancels the channel water', () => {
  const PW = loadPW(), { wetAt } = require('../prism-warden/tools/aqueduct-pilot.cjs');
  const state = start(PW, 'bridge');
  state.player.x = 500; state.player.y = 384;
  tick(PW, state, 270);
  expect(state.thermal.hot).toBe(false);
  expect(wetAt(state, state.player.x, state.player.y)).toBe(false);
  const x = state.player.x, hp = state.player.hp;
  tick(PW, state, 30, { mx: 1, ax: 1 });
  expect(state.player.x).toBeGreaterThan(x + 20);
  expect(state.player.hp).toBe(hp);
  tick(PW, state, 300);
  expect(state.thermal.hot).toBe(true);
  expect(wetAt(state, 500, 384)).toBe(true);
});

test('idle play cannot clear any Glass Kiln encounter', () => {
  const PW = loadPW();
  for (const room of ['furnace', 'bridge', 'rail', 'foundry', 'weaver', 'quench']) {
    const state = start(PW, room), score = state.score;
    tick(PW, state, 60 * 60);
    expect(state.cleared.C1 || state.cleared.C2 || state.cleared.C3 || state.cleared.C4 || state.cleared.C5).toBe(false);
    expect(state.score).toBe(score);
    expect(['playing', 'lost']).toContain(state.status);
  }
});

test('connected Glass Kiln is solvable through C1-C5 with legal simulation inputs', () => {
  const { play } = require('../prism-warden/tools/kiln-pilot.cjs');
  const result = play(loadPW());
  expect(result.status).toBe('won');
  expect(result.cleared).toMatchObject({ A1: true, A2: true, A3: true, A4: true, A5: true,
    B1: true, B2: true, B3: true, B4: true, B5: true,
    C1: true, C2: true, C3: true, C4: true, C5: true });
  expect(result.roomId).toBe('weaver');
  expect(result.beacon.reached).toBe(true);
  expect(result.player.hp).toBeGreaterThan(0);
  expect(result.retries).toBeUndefined();
  expect((result.kilnLog || []).join('\n')).toContain('END status=won');
}, 600000);
