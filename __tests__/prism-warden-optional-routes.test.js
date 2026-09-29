'use strict';

// These declared regional entry fixtures test connected, state-informed legal
// input routes. They do not establish normal-clock, native-touch or human play.
const { loadPW } = require('../prism-warden/tools/aqueduct-pilot.cjs');
const { createPilot } = require('../prism-warden/tools/optional-pilot.cjs');

function fixture(PW, room) {
  const s = PW.create({ room });
  PW.retryRoom(s); // Public checkpoint start; no earned flags or progress added.
  return s;
}

function advance(PW, s, pilot, done, seconds, observe = () => {}) {
  const visited = [];
  let slashHeld = false;
  for (let frame = 0; frame < seconds * 60 && !done(s); frame++) {
    if (s.status !== 'playing') break;
    if (visited[visited.length - 1] !== s.roomId) visited.push(s.roomId);
    const input = pilot(s);
    input.slash = !!input.slash && !slashHeld;
    slashHeld = input.slash;
    PW.step(s, input, 1 / 60);
    observe(s);
  }
  if (!done(s)) {
    throw new Error(`Optional route stopped in ${s.roomId}: ${s.status}, ` +
      `${s.time.toFixed(2)}s, ${s.player.hp} HP, ${s.objective}; visited ${visited.join(' -> ')}`);
  }
}

test.each([
  ['quench', /pull.*quench valve/i],
  ['shade-vault', /turn.*branch mirrors/i],
  ['obs-chart', /burst.*chart/i],
  ['archive', /burst.*archive/i]
])('%s fresh entry names the unfinished optional task in the HUD', (room, task) => {
  const PW = loadPW(), s = fixture(PW, room);
  expect(s.objective).toMatch(task);
});

test('Sluice entry fixture earns the lit reliquary heart and chart, then rejoins A3', () => {
  const PW = loadPW(), s = fixture(PW, 'sluice');
  const pilot = createPilot(PW);
  let closedReliquary = false, earnedThroughLitGate = false;
  const objectives = {};
  expect(s.flags['pickup:abbey-heart']).toBeUndefined();
  expect(s.flags.chart).toBeUndefined();
  advance(PW, s, pilot, state => state.roomId === 'shutters', 100, state => {
    if (state.roomId !== 'sanctuary') return;
    const gate = state.gates.find(g => g.id === 'reliquary');
    if (!gate.open) closedReliquary = true;
    if (state.flags['lit:chapel']) {
      const phase = !state.flags.chart ? 'chart' : !state.flags['pickup:abbey-heart'] ? 'heart' : 'return';
      objectives[phase] = state.objective;
    }
    if (state.flags['pickup:abbey-heart']) {
      earnedThroughLitGate = gate.open && state.receivers.find(r => r.id === 'chapel').active;
    }
  });
  expect(closedReliquary).toBe(true);
  expect(earnedThroughLitGate).toBe(true);
  expect(objectives.chart).toMatch(/take.*keeper chart/i);
  expect(objectives.heart).toMatch(/collect.*tideglass heart.*lit reliquary/i);
  expect(objectives.return).toMatch(/stair.*bell tower/i);
  expect(s.flags.chart).toBe(true);
  expect(s.flags['lit:chapel']).toBe(true);
  expect(s.flags['pickup:abbey-heart']).toBe(true);
  expect(s.player.maxHp).toBe(7);
  expect(s.cleared.A2).toBe(true);
  expect(s.cleared.A3).toBe(false);
  expect(s.visited).toContain('sanctuary');
});

test('Furnace entry fixture earns Quench and Glass Edge before completing the main bridge crossing', () => {
  const PW = loadPW(), s = fixture(PW, 'furnace');
  const pilot = createPilot(PW);
  let valveOpenedSpur = false, enteredBridgeFromWestBank = false;
  const objectives = {};
  advance(PW, s, pilot, state => state.roomId === 'rail', 160, state => {
    if (state.roomId === 'quench') {
      const phase = !state.flags['quench-valve'] ? 'valve' : !state.flags['kiln-edge'] ? 'edge' : 'return';
      objectives[phase] = state.objective;
    }
    if (state.roomId === 'quench' && state.flags['quench-valve']) {
      valveOpenedSpur = state.gates.find(g => g.id === 'quench-side-gate').open;
    }
    if (state.roomId === 'bridge' && state.flags['quench-valve'] && state.player.x < 300) {
      enteredBridgeFromWestBank = true;
    }
  });
  expect(valveOpenedSpur).toBe(true);
  expect(objectives.valve).toMatch(/pull.*quench valve/i);
  expect(objectives.edge).toMatch(/glass edge/i);
  expect(objectives.edge).not.toMatch(/return spur/i);
  expect(objectives.return).toMatch(/return spur.*west bank/i);
  expect(enteredBridgeFromWestBank).toBe(true);
  expect(s.flags['quench-valve']).toBe(true);
  expect(s.flags['kiln-edge']).toBe(true);
  expect(s.visited).toContain('quench');
  expect(s.cleared.C1).toBe(true);
  expect(s.cleared.C2).toBe(true);
  expect(s.player.hp).toBeGreaterThan(0);
});

test('Stars entry fixture carries earned chart and keeper through the Observatory into the Crown Archive', () => {
  const PW = loadPW(), s = fixture(PW, 'stars');
  const pilot = createPilot(PW);
  let vaultOpened = false, keeperFreedBehindLiveSeals = false, domeRefugesOpened = false;
  const objectives = {};
  expect(s.flags['stored-light']).toBeUndefined();
  advance(PW, s, pilot, state => state.status === 'cleared', 250, state => {
    if (state.roomId === 'shade-vault') {
      const gate = state.gates.find(g => g.id === 'shade-vault-lock');
      const phase = state.rescue.freed ? 'vaultReturn' : gate.open ? 'vaultRescue' : 'vaultSeals';
      objectives[phase] = state.objective;
      if (gate.open && state.receivers.every(r => r.active)) vaultOpened = true;
      if (state.rescue.freed) keeperFreedBehindLiveSeals = gate.open && state.receivers.every(r => r.active);
    }
    if (state.roomId === 'obs-chart') objectives[state.flags['sky-chart'] ? 'chartReturn' : 'chartTask'] = state.objective;
    if (state.roomId === 'twins') {
      domeRefugesOpened = ['shade-refuge', 'chart-refuge'].every(id => state.gates.find(g => g.id === id).open);
    }
  });
  expect(s.flags['stored-light']).toBe(true);
  expect(s.flags['sky-chart']).toBe(true);
  expect(s.flags['shade-freed']).toBe(true);
  expect(vaultOpened).toBe(true);
  expect(keeperFreedBehindLiveSeals).toBe(true);
  expect(domeRefugesOpened).toBe(true);
  expect(objectives.vaultSeals).toMatch(/turn.*branch mirrors/i);
  expect(objectives.vaultRescue).toMatch(/free.*keeper/i);
  expect(objectives.vaultReturn).toMatch(/return north.*split-light/i);
  expect(objectives.chartTask).toMatch(/burst.*chart/i);
  expect(objectives.chartReturn).toMatch(/return north/i);
  expect(objectives.chartReturn).not.toMatch(/take.*chart/i);
  for (const id of ['D1', 'D2', 'D3', 'D4', 'D5']) expect(s.cleared[id]).toBe(true);
  expect(s.visited).toEqual(expect.arrayContaining(['obs-chart', 'shade-vault']));
  expect(PW.chooseEquipment(s, 'burst-stun')).toBe(true);
  expect(PW.chooseRestoration(s, 'channels')).toBe(true);
  PW.continueRegion(s);
  expect(s.roomId).toBe('descent');
  let lateConsequences = false;
  advance(PW, s, pilot, state => state.roomId === 'circuit', 150, state => {
    if (state.roomId === 'archive') objectives[state.flags['pickup:keeper-archive'] ? 'archiveReturn' : 'archiveTask'] = state.objective;
    if (state.roomId === 'descent') {
      lateConsequences = ['descent-chart-bypass', 'descent-shade-bypass']
        .every(id => state.gates.find(g => g.id === id).open) &&
        state.enemies.find(e => e.id === 'crown-descent-turret').phase === 'silent';
    }
  });
  // Advance one real frame so newly entered room gates evaluate earned flags.
  PW.step(s, {}, 1 / 60);
  expect(lateConsequences).toBe(true);
  expect(s.visited).toContain('archive');
  expect(s.flags['pickup:keeper-archive']).toBe(true);
  expect(objectives.archiveTask).toMatch(/burst.*archive/i);
  expect(objectives.archiveReturn).toMatch(/return/i);
  expect(objectives.archiveReturn).not.toMatch(/retrieve.*archive/i);
  expect(s.gates.find(g => g.id === 'archive-well-gate').open).toBe(true);
  expect(s.cleared.E1).toBe(true);
  expect(s.cleared.E2).toBe(true);
  expect(s.player.hp).toBeGreaterThan(0);
});
