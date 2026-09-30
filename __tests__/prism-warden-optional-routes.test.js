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

function step(PW, s, input = {}, frames = 1) {
  for (let i = 0; i < frames && s.status === 'playing'; i++) PW.step(s, input, 1 / 60);
}

function walkQuench(PW, s, x, y, input = {}, limit = 900) {
  const startRoom = s.roomId;
  for (let i = 0; i < limit && s.status === 'playing' && s.roomId === startRoom; i++) {
    const dx = x - s.player.x, dy = y - s.player.y, d = Math.hypot(dx, dy);
    if (d < 6) return true;
    step(PW, s, Object.assign({ mx: dx / d, my: dy / d, ax: dx / d, ay: dy / d }, input));
  }
  return s.roomId !== startRoom || Math.hypot(x - s.player.x, y - s.player.y) < 10;
}

function quenchTurret(s) { return s.enemies.find(e => e.id === 'quench-turret'); }
function quenchTurrets(s) { return s.enemies.filter(e => /^quench.*turret/.test(e.id)); }
function aimAtQuenchTurret(s) {
  const e = quenchTurret(s), dx = e.x - s.player.x, dy = e.y - s.player.y, d = Math.hypot(dx, dy) || 1;
  return { ax: dx / d, ay: dy / d };
}

function enterQuenchFiringPocket(PW, s) {
  // Route around the upper plinth to the exposed lane, then approach its
  // turret from the south so the shot-cut and return controls have LOS.
  expect(walkQuench(PW, s, 512, 312)).toBe(true);
  expect(walkQuench(PW, s, 720, 312)).toBe(true);
  expect(walkQuench(PW, s, 720, 404)).toBe(true);
  expect(walkQuench(PW, s, 580, 404)).toBe(true);
}

test.each([
  ['quench', /take.*glass edge.*slash.*return.*quench valve/i],
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
  expect(objectives.valve).toMatch(/take.*glass edge.*slash.*return.*quench valve/i);
  expect(objectives.edge).toMatch(/take.*glass edge/i);
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

test('Quench gives a covered landing, safe Glass Edge pickup, and a real northern retreat', () => {
  const PW = loadPW(), s = fixture(PW, 'quench'), room = PW.roomDef('quench');
  const turrets = room.enemies.filter(e => /^quench.*turret/.test(e.id));
  const pickup = room.pickups.find(p => p.id === 'kiln-edge');
  const start = room.spawn, d = Math.hypot(start.x - pickup.x, start.y - pickup.y);
  expect(d).toBeGreaterThan(s.player.r + 20);
  expect(d).toBeLessThanOrEqual(45);
  expect(turrets).toHaveLength(2);
  expect(turrets.every(e => e.disabledBy === 'quench-valve')).toBe(true);
  expect(room.exits.map(e => e.to)).toEqual(expect.arrayContaining(['furnace', 'bridge']));
  for (const turret of turrets) {
    const dist = Math.hypot(start.x - turret.x, start.y - turret.y);
    const blockedEntry = PW.raySegment(turret.x, turret.y, (start.x - turret.x) / dist,
      (start.y - turret.y) / dist, room.walls, dist).rect;
    expect(blockedEntry).toBeTruthy();
  }

  step(PW, s, {}, 210);
  expect(s.flags['kiln-edge']).not.toBe(true);
  expect(s.score).toBe(0);
  expect(s.shots.filter(shot => !shot.friendly)).toHaveLength(0);
  expect(walkQuench(PW, s, pickup.x, pickup.y)).toBe(true);
  expect(s.flags['kiln-edge']).toBe(true);
  expect(s.shots.filter(shot => !shot.friendly)).toHaveLength(0);
  expect(walkQuench(PW, s, 512, 70)).toBe(true);
  expect(s.roomId).toBe('furnace');
});

test('Quench supports aimed shot cuts, a recoverable hit, returned-shot jam, and valve shutdown', () => {
  const PW = loadPW();

  // Isolated fresh room entry, ordinary movement, no injected equipment flag.
  const cut = fixture(PW, 'quench');
  step(PW, cut, {}, 210);
  enterQuenchFiringPocket(PW, cut);
  let cuts = 0;
  for (let i = 0; i < 60 * 14 && !cuts && cut.status === 'playing'; i++) {
    const aim = aimAtQuenchTurret(cut);
    const shot = cut.shots.find(s => !s.friendly);
    const near = shot && Math.hypot(shot.x - cut.player.x, shot.y - cut.player.y) <= 76;
    const before = cut.particles.filter(p => p.kind === 'slash').length;
    step(PW, cut, Object.assign(aim, {
      reflect: false,
      slash: !!near && cut.player.slashCooldown <= 0 && !cut._slashHeld
    }));
    if (cut.particles.filter(p => p.kind === 'slash').length > before) cuts++;
  }
  expect(cuts).toBeGreaterThan(0);
  expect(cut.returns).toBe(0);
  expect(quenchTurret(cut).phase).not.toBe('jammed');
  expect(cut.player.hp).toBeGreaterThan(0);

  // Walk directly into the first live lane without defense, take a real hit,
  // retreat behind the entrance plinth, then return and make the intended jam.
  const recovery = fixture(PW, 'quench');
  step(PW, recovery, {}, 210);
  enterQuenchFiringPocket(PW, recovery);
  const startingHp = recovery.player.hp;
  for (let i = 0; i < 60 * 12 && recovery.player.hp === startingHp && recovery.status === 'playing'; i++) {
    step(PW, recovery, { ax: 1, ay: 0, reflect: false, slash: false });
  }
  expect(recovery.player.hp).toBeLessThan(startingHp);
  expect(recovery.player.hp).toBeGreaterThan(0);
  // Retreat below the middle slab, round its west end, then shelter north of
  // the center plinth where both firing lanes are screened.
  expect(walkQuench(PW, recovery, 720, 420)).toBe(true);
  expect(walkQuench(PW, recovery, 380, 420)).toBe(true);
  expect(walkQuench(PW, recovery, 380, 312)).toBe(true);
  expect(walkQuench(PW, recovery, 512, 312)).toBe(true);
  const retreatHp = recovery.player.hp;
  step(PW, recovery, {}, 120);
  expect(recovery.player.hp).toBe(retreatHp);
  enterQuenchFiringPocket(PW, recovery);

  for (let i = 0; i < 60 * 12 && quenchTurret(recovery).phase !== 'jammed' && recovery.status === 'playing'; i++) {
    step(PW, recovery, Object.assign({ reflect: true, slash: false }, aimAtQuenchTurret(recovery)));
  }
  expect(quenchTurret(recovery).phase).toBe('jammed');
  expect(recovery.returns).toBeGreaterThan(0);

  expect(walkQuench(PW, recovery, 840, 330, { reflect: false })).toBe(true);
  expect(walkQuench(PW, recovery, 840, 340, { reflect: false })).toBe(true);
  step(PW, recovery, { ax: 0, ay: 1, slash: true });
  expect(recovery.flags['quench-valve']).toBe(true);
  expect(quenchTurret(recovery).phase).toBe('silent');
  expect(quenchTurrets(recovery).every(e => e.phase === 'silent')).toBe(true);
  expect(recovery.gates.find(g => g.id === 'quench-side-gate').open).toBe(true);
  expect(walkQuench(PW, recovery, 990, 384, { reflect: false })).toBe(true);
  expect(recovery.roomId).toBe('bridge');
  expect(recovery.player.hp).toBeGreaterThan(0);
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
