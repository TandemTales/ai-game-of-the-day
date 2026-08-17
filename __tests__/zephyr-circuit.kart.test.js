/* =====================================================================
   Zephyr Circuit — kart physics.

   The two things worth protecting here are the feel numbers (a kart that
   accelerates or corners wrongly is not fixable by art) and the two hard
   invariants from SPEC.md §2: no Math.random, fixed timestep.
   ===================================================================== */
'use strict';

const { loadZC } = require('./zephyr-circuit.harness');

const LOGIC = ['core.js', 'track.js', 'tracks.js', 'kart.js'];

function fresh() {
  const ZC = loadZC(LOGIC);
  return { ZC, track: ZC.Tracks.get(0) };
}

/* A crude "stay near the centreline" driver. Deliberately not good: if a
   chamber only completes under expert input, that is worth knowing. */
function makeDriver(ZC, track, opts) {
  opts = opts || {};
  const look = opts.look === undefined ? 20 : opts.look;
  const gain = opts.gain === undefined ? 2.6 : opts.gain;
  const frame = {};
  return function (kart) {
    ZC.Track.frameAt(track, kart.s + look + kart.speed * 0.55, frame);
    const want = Math.atan2(frame.x - kart.x, frame.z - kart.z);
    const steer = ZC.clamp(ZC.angleDelta(kart.travelYaw, want) * gain, -1, 1);
    return {
      throttle: 1, brake: 0, steer,
      drift: !!opts.drift && Math.abs(steer) > 0.55 && kart.speed > 16
    };
  };
}

function race(ZC, track, kart, driver, seconds) {
  const dt = ZC.STEP_DT;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    ZC.Kart.step(kart, driver(kart), track, dt);
    if (kart.finished) break;
  }
  return kart;
}

describe('kart invariants', () => {
  test('step() never calls Math.random()', () => {
    const { ZC, track } = fresh();
    const kart = ZC.Kart.create({ id: 'p' });
    ZC.Kart.placeOnGrid(kart, track, 0, 8);
    const driver = makeDriver(ZC, track, { drift: true });

    const real = Math.random;
    let called = 0;
    Math.random = () => { called++; return real(); };
    try { race(ZC, track, kart, driver, 30); } finally { Math.random = real; }
    expect(called).toBe(0);
  });

  test('the same inputs from the same seed produce the same race', () => {
    function run() {
      const { ZC, track } = fresh();
      ZC.setSeed(1234);
      const kart = ZC.Kart.create({ id: 'p' });
      ZC.Kart.placeOnGrid(kart, track, 3, 8);
      const dt = ZC.STEP_DT;
      for (let i = 0; i < 120 * 40; i++) {
        ZC.Kart.step(kart, {
          throttle: 1, brake: 0,
          steer: Math.sin(i * 0.013) * 0.8,
          drift: (i % 400) < 160
        }, track, dt);
      }
      return [kart.x, kart.z, kart.s, kart.lap, kart.speed].join('|');
    }
    expect(run()).toBe(run());
  });

  test('a kart placed on the grid starts on the road, stationary, facing forward', () => {
    const { ZC, track } = fresh();
    for (let place = 0; place < 8; place++) {
      const kart = ZC.Kart.create({ id: 'k' + place });
      ZC.Kart.placeOnGrid(kart, track, place, 8);
      expect(kart.speed).toBe(0);
      expect(kart.onRoad).toBe(true);
      expect(kart.lap).toBe(0);
      expect(Math.abs(kart.y - kart.surfaceY)).toBeLessThan(0.01);
      /* facing along the road, not across it */
      const frame = ZC.Track.frameAt(track, kart.s, {});
      const roadYaw = Math.atan2(frame.tx, frame.tz);
      expect(Math.abs(ZC.angleDelta(kart.travelYaw, roadYaw))).toBeLessThan(0.3);
    }
  });
});

describe('driving feel', () => {
  test('reaches top speed in a believable time and does not exceed it', () => {
    const { ZC, track } = fresh();
    const kart = ZC.Kart.create({ id: 'p' });
    ZC.Kart.placeOnGrid(kart, track, 0, 8);
    const driver = makeDriver(ZC, track);
    const dt = ZC.STEP_DT;

    let at4 = 0;
    for (let i = 0; i < 120 * 12; i++) {
      ZC.Kart.step(kart, driver(kart), track, dt);
      if (i === 120 * 4 - 1) at4 = kart.speed;
    }
    /* 0 to near top in about four seconds */
    expect(at4).toBeGreaterThan(ZC.Kart.TUNE.maxSpeed * 0.9);
    expect(kart.speed).toBeLessThanOrEqual(ZC.Kart.TUNE.maxSpeed + 0.01);
  });

  test('a stationary kart cannot pirouette', () => {
    const { ZC, track } = fresh();
    const kart = ZC.Kart.create({ id: 'p' });
    ZC.Kart.placeOnGrid(kart, track, 0, 8);
    const before = kart.travelYaw;
    for (let i = 0; i < 120; i++) {
      ZC.Kart.step(kart, { throttle: 0, brake: 0, steer: 1, drift: false }, track, ZC.STEP_DT);
    }
    expect(Math.abs(ZC.angleDelta(before, kart.travelYaw))).toBeLessThan(0.02);
  });

  test('steering authority rises off idle then washes out at speed', () => {
    const { ZC } = fresh();
    const f = ZC.Kart.steerFactor;
    expect(f(0)).toBe(0);
    expect(f(8)).toBeCloseTo(1, 5);
    expect(f(16)).toBeCloseTo(1, 5);
    expect(f(27)).toBeLessThan(1);
    expect(f(27)).toBeGreaterThan(0.6);
  });

  test('going off the road caps speed hard', () => {
    const { ZC, track } = fresh();
    const kart = ZC.Kart.create({ id: 'p' });
    ZC.Kart.placeOnGrid(kart, track, 0, 8);
    const driver = makeDriver(ZC, track);
    race(ZC, track, kart, driver, 6);
    expect(kart.speed).toBeGreaterThan(20);

    /* shove it onto the verge and hold the throttle down */
    const p = ZC.Track.pointAt(track, kart.s, 1.5);
    kart.x = p.x; kart.y = p.y; kart.z = p.z;
    for (let i = 0; i < 120 * 4; i++) {
      ZC.Kart.step(kart, { throttle: 1, brake: 0, steer: 0, drift: false }, track, ZC.STEP_DT);
    }
    if (!kart.falling) {
      expect(kart.onRoad).toBe(false);
      expect(kart.speed).toBeLessThanOrEqual(ZC.Kart.TUNE.offroadMax + 0.5);
    }
  });

  test('driving off the island edge drops the kart and respawns it on the road', () => {
    const { ZC, track } = fresh();
    const kart = ZC.Kart.create({ id: 'p' });
    ZC.Kart.placeOnGrid(kart, track, 0, 8);
    race(ZC, track, kart, makeDriver(ZC, track), 5);

    /* teleport it well past the shoulder, over nothing */
    const p = ZC.Track.pointAt(track, kart.s, 4.0);
    kart.x = p.x; kart.y = p.y; kart.z = p.z;
    for (let i = 0; i < 120 * 8; i++) {
      ZC.Kart.step(kart, { throttle: 1, brake: 0, steer: 0, drift: false }, track, ZC.STEP_DT);
    }
    expect(kart.falls).toBeGreaterThan(0);
    expect(kart.falling).toBe(false);          // fished out again
    expect(kart.onRoad).toBe(true);
  });

  test('respawn puts a kart on the centreline facing along the road', () => {
    const { ZC, track } = fresh();
    const kart = ZC.Kart.create({ id: 'p' });
    ZC.Kart.placeOnGrid(kart, track, 0, 8);
    race(ZC, track, kart, makeDriver(ZC, track), 12);
    kart.speed = 25;

    ZC.Kart.respawn(kart, track);
    expect(Math.abs(kart.t)).toBeLessThan(0.05);
    expect(kart.speed).toBe(0);
    expect(kart.drift.charge).toBe(0);
    const frame = ZC.Track.frameAt(track, kart.s, {});
    const roadYaw = Math.atan2(frame.tx, frame.tz);
    expect(Math.abs(ZC.angleDelta(kart.travelYaw, roadYaw))).toBeLessThan(0.2);
  });
});

describe('drift and boost', () => {
  test('holding drift down a straight earns nothing', () => {
    const { ZC, track } = fresh();
    const kart = ZC.Kart.create({ id: 'p' });
    ZC.Kart.placeOnGrid(kart, track, 0, 8);
    const driver = makeDriver(ZC, track);
    race(ZC, track, kart, driver, 4);
    /* drift held, but steering straight: no slide, so no charge */
    for (let i = 0; i < 120 * 2; i++) {
      ZC.Kart.step(kart, { throttle: 1, brake: 0, steer: 0, drift: true }, track, ZC.STEP_DT);
    }
    expect(kart.drift.tier).toBe(0);
  });

  test('drifting the circuit\'s corners charges through all three tiers', () => {
    /* Holding full lock on the spot is not a valid way to test this: the
       kart circles off the road, where the speed cap falls below the
       drift minimum and the slide cancels itself. Drift the real corners. */
    const { ZC, track } = fresh();
    const kart = ZC.Kart.create({ id: 'p' });
    ZC.Kart.placeOnGrid(kart, track, 0, 8);
    const steerDriver = makeDriver(ZC, track);

    const seen = new Set();
    let maxSlip = 0;
    const dt = ZC.STEP_DT;
    for (let i = 0; i < 120 * 90; i++) {
      const inp = steerDriver(kart);
      inp.drift = kart.speed > 16 && Math.abs(inp.steer) > 0.35;
      ZC.Kart.step(kart, inp, track, dt);
      seen.add(kart.drift.tier);
      maxSlip = Math.max(maxSlip, Math.abs(kart.slip));
    }
    expect(Array.from(seen).sort()).toEqual([0, 1, 2, 3]);
    expect(maxSlip).toBeGreaterThan(ZC.Kart.TUNE.driftSlip * 0.8);
  });

  test('releasing a charged drift pays a boost above normal top speed', () => {
    const { ZC, track } = fresh();
    const kart = ZC.Kart.create({ id: 'p' });
    ZC.Kart.placeOnGrid(kart, track, 0, 8);
    const steerDriver = makeDriver(ZC, track);
    const dt = ZC.STEP_DT;

    let peak = 0, bestBoost = 0, bestTier = 0;
    for (let i = 0; i < 120 * 90; i++) {
      const inp = steerDriver(kart);
      inp.drift = kart.speed > 16 && Math.abs(inp.steer) > 0.35;
      ZC.Kart.step(kart, inp, track, dt);
      bestTier = Math.max(bestTier, kart.drift.tier);
      bestBoost = Math.max(bestBoost, kart.boost);
      peak = Math.max(peak, kart.speed);
    }
    expect(bestTier).toBe(3);
    expect(bestBoost).toBeGreaterThan(1);
    expect(peak).toBeGreaterThan(ZC.Kart.TUNE.maxSpeed * 1.15);
  });

  test('drifting is faster than not drifting — the whole point of the mechanic', () => {
    const { ZC, track } = fresh();

    function lapTime(drift) {
      const kart = ZC.Kart.create({ id: 'p' });
      ZC.Kart.placeOnGrid(kart, track, 0, 8);
      race(ZC, track, kart, makeDriver(ZC, track, { drift }), 200);
      return kart.bestLap;
    }
    const plain = lapTime(false);
    const drifting = lapTime(true);
    expect(plain).toBeGreaterThan(0);
    expect(drifting).toBeGreaterThan(0);
    expect(drifting).toBeLessThan(plain - 1.0);   // at least a second a lap
  });
});

describe('lap counting', () => {
  test('a crude driver completes the race, on the road, in a sane time', () => {
    const { ZC, track } = fresh();
    const kart = ZC.Kart.create({ id: 'p' });
    ZC.Kart.placeOnGrid(kart, track, 0, 8);
    race(ZC, track, kart, makeDriver(ZC, track), 240);

    expect(kart.finished).toBe(true);
    expect(kart.lap).toBe(track.laps);
    expect(kart.lapTimes.length).toBe(track.laps);
    expect(kart.falls).toBe(0);
    for (const t of kart.lapTimes) {
      expect(t).toBeGreaterThan(25);
      expect(t).toBeLessThan(75);
    }
  });

  test('a lap cannot be scored by reversing back over the line', () => {
    const { ZC, track } = fresh();
    const kart = ZC.Kart.create({ id: 'p' });
    ZC.Kart.placeOnGrid(kart, track, 0, 8);
    /* creep forward over the line, then reverse back and forth across it */
    race(ZC, track, kart, makeDriver(ZC, track), 3);
    const lapAfterStart = kart.lap;
    for (let cycle = 0; cycle < 6; cycle++) {
      for (let i = 0; i < 120 * 2; i++) {
        ZC.Kart.step(kart, { throttle: 0, brake: 1, steer: 0, drift: false }, track, ZC.STEP_DT);
      }
      for (let i = 0; i < 120 * 2; i++) {
        ZC.Kart.step(kart, { throttle: 1, brake: 0, steer: 0, drift: false }, track, ZC.STEP_DT);
      }
    }
    expect(kart.lap).toBe(lapAfterStart);
  });

  test('skipping checkpoints cannot shorten a lap', () => {
    const { ZC, track } = fresh();
    const kart = ZC.Kart.create({ id: 'p' });
    ZC.Kart.placeOnGrid(kart, track, 0, 8);
    race(ZC, track, kart, makeDriver(ZC, track), 3);

    /* teleport most of the way round, skipping the middle of the lap */
    const p = ZC.Track.pointAt(track, track.length * 0.9, 0);
    kart.x = p.x; kart.y = p.y; kart.z = p.z;
    kart.travelYaw = p.yaw;
    ZC.Track.project(track, kart.x, kart.y, kart.z, -1, kart._proj);
    kart.seg = kart._proj.seg;

    const before = kart.lap;
    race(ZC, track, kart, makeDriver(ZC, track), 30);
    /* crossing the line with checkpoints unvisited must not score */
    expect(kart.lap).toBe(before);
  });

  test('placement compares laps first, then distance round', () => {
    const { ZC, track } = fresh();
    expect(ZC.Track.progress(track, 1, 10)).toBeGreaterThan(ZC.Track.progress(track, 0, track.length - 1));
    expect(ZC.Track.progress(track, 2, 5)).toBeGreaterThan(ZC.Track.progress(track, 2, 4));
  });
});

describe('kart separation', () => {
  test('overlapping karts are pushed apart without spinning either', () => {
    const { ZC } = fresh();
    const a = ZC.Kart.create({ id: 'a' });
    const b = ZC.Kart.create({ id: 'b' });
    a.x = 0; a.z = 0; a.travelYaw = 0.5; a.speed = 20;
    b.x = 1; b.z = 0; b.travelYaw = 0.5; b.speed = 18;
    expect(ZC.Kart.separate(a, b)).toBe(true);
    const gap = Math.hypot(b.x - a.x, b.z - a.z);
    expect(gap).toBeGreaterThan(1.0);
    /* a nudge must never change anyone's heading */
    expect(a.travelYaw).toBe(0.5);
    expect(b.travelYaw).toBe(0.5);
  });

  test('karts that are not touching are left alone', () => {
    const { ZC } = fresh();
    const a = ZC.Kart.create({ id: 'a' });
    const b = ZC.Kart.create({ id: 'b' });
    a.x = 0; a.z = 0; b.x = 20; b.z = 0;
    expect(ZC.Kart.separate(a, b)).toBe(false);
    expect(b.x).toBe(20);
  });
});
