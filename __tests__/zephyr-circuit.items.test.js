/* =====================================================================
   Zephyr Circuit — the item game.

   Three properties carry this file:

     * The roulette is a RUBBER BAND. If it is not weighted by position it
       is not an item game, it is a random number generator, and the front
       of the field simply stays at the front. The leader must never draw
       the field-wide item; the tail must draw it often.
     * Everything lives in TRACK SPACE. Boxes, hazards and projectiles are
       (arc length, lateral offset), so they follow the road round a
       corner for free. The failure mode if that regresses is item boxes
       hanging in the void beyond the road edge, so it is asserted
       directly.
     * Items are SEEDED. A drift-boost leaderboard is only meaningful if
       the same inputs produce the same race, and an unseeded roulette
       would quietly break that.
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadZC, JS_DIR } = require('./zephyr-circuit.harness');

const LOGIC = ['core.js', 'track.js', 'tracks.js', 'kart.js', 'items.js'];

function fresh() {
  const ZC = loadZC(LOGIC);
  return { ZC, track: ZC.Tracks.get(0) };
}

/* Put a kart on the road at a given arc length and lateral offset,
   travelling forward. Everything below drives off this. */
function kartAt(ZC, track, id, s, t, speed) {
  const kart = ZC.Kart.create({ id });
  ZC.Kart.placeOnGrid(kart, track, 0, 8);
  const p = ZC.Track.pointAt(track, s, t === undefined ? 0 : t);
  kart.x = p.x; kart.y = p.y; kart.z = p.z;
  kart.travelYaw = p.yaw; kart.bodyYaw = p.yaw;
  kart.speed = speed === undefined ? 20 : speed;
  const pr = ZC.Track.project(track, kart.x, kart.y, kart.z, -1, kart._proj);
  kart.seg = pr.seg; kart.s = pr.s; kart.t = pr.t;
  kart.y = pr.surfaceY; kart.surfaceY = pr.surfaceY;
  kart.progress = ZC.Track.progress(track, kart.lap, kart.s);
  return kart;
}

const IDLE = { throttle: 0, brake: 0, steer: 0, drift: false, item: false };

/* Advance the item simulation without moving anybody, so a test can talk
   about a projectile's flight and nothing else. */
function tickItems(ZC, state, karts, track, seconds) {
  const dt = ZC.STEP_DT;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    ZC.Items.step(state, karts, track, dt);
  }
}

describe('the roulette', () => {
  test('every draw is a real item', () => {
    const { ZC } = fresh();
    ZC.setSeed(7);
    for (let place = 1; place <= 8; place++) {
      for (let i = 0; i < 200; i++) {
        const id = ZC.Items.roll(place);
        expect(ZC.Items.DEFS[id]).toBeDefined();
      }
    }
  });

  test('the leader can never draw a Squall', () => {
    const { ZC } = fresh();
    ZC.setSeed(11);
    /* The field-wide item is the strongest thing in the game. A leader
       who can draw it wins twice. */
    for (let place = 1; place <= 3; place++) {
      for (let i = 0; i < 1500; i++) {
        expect(ZC.Items.roll(place)).not.toBe('squall');
      }
    }
  });

  test('the roulette is a rubber band: the back of the grid draws better', () => {
    const { ZC } = fresh();
    ZC.setSeed(3);
    function sample(place, n) {
      const counts = Object.create(null);
      for (let i = 0; i < n; i++) {
        const id = ZC.Items.roll(place);
        counts[id] = (counts[id] || 0) + 1;
      }
      return counts;
    }
    const N = 4000;
    const first = sample(1, N);
    const last = sample(8, N);

    /* the comeback items go to the back */
    expect((last.squall || 0)).toBeGreaterThan(N * 0.2);
    expect((first.squall || 0)).toBe(0);
    expect((last.updraft || 0)).toBeGreaterThan((first.updraft || 0) * 2);

    /* the defensive/area-denial items go to the front */
    expect((first.thunderhead || 0)).toBeGreaterThan((last.thunderhead || 0) * 4);
    expect((first.gust || 0)).toBeGreaterThan((last.gust || 0) * 2);
  });

  test('draws are seeded, not random', () => {
    const { ZC } = fresh();
    function run() {
      ZC.setSeed(1234);
      return Array.from({ length: 40 }, () => ZC.Items.roll(4)).join(',');
    }
    expect(run()).toBe(run());
  });

  test('items.js never calls Math.random()', () => {
    /* Read the source rather than trapping the call: the roulette is only
       drawn on a pickup, and a test that happened not to trigger one
       would pass while the invariant was broken. */
    const src = fs.readFileSync(path.join(JS_DIR, 'items.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')      // the file talks ABOUT the rule
      .replace(/\/\/[^\n]*/g, '');
    expect(src).not.toMatch(/Math\s*\.\s*random/);
  });
});

describe('item boxes', () => {
  test('every box sits on the tarmac, on any circuit', () => {
    const { ZC } = fresh();
    for (let i = 0; i < ZC.Tracks.count(); i++) {
      const track = ZC.Tracks.get(i);
      const state = ZC.Items.createState(track);
      expect(state.boxes.length).toBeGreaterThan(10);
      for (const box of state.boxes) {
        /* |t| <= 1 is the road edge. A box beyond it would hang over the
           void on a sky island and be uncollectable. */
        expect(Math.abs(box.t)).toBeLessThanOrEqual(0.85);
        /* and its world position must agree with the centreline */
        const p = ZC.Track.pointAt(track, box.s, box.t);
        expect(Math.hypot(box.x - p.x, box.y - p.y, box.z - p.z)).toBeLessThan(1e-3);
      }
    }
  });

  test('no row sits on the start line, so nobody is armed on the grid', () => {
    const { ZC, track } = fresh();
    const state = ZC.Items.createState(track);
    for (const box of state.boxes) {
      const gap = Math.min(box.s, track.length - box.s);
      expect(gap).toBeGreaterThan(30);
    }
  });

  test('driving through a box arms the kart, after the roulette settles', () => {
    const { ZC, track } = fresh();
    const state = ZC.Items.createState(track);
    const box = state.boxes[3];
    const kart = kartAt(ZC, track, 'p', box.s, box.t);
    const karts = [kart];

    ZC.Items.step(state, karts, track, ZC.STEP_DT);
    expect(box.alive).toBe(false);
    /* the roulette spins for a beat first — that pause is where the
       tension in a pickup lives */
    expect(kart.item).toBe(null);
    expect(kart.itemRoll).toBeGreaterThan(0);

    tickItems(ZC, state, karts, track, 1.2);
    expect(kart.item).not.toBe(null);
    expect(ZC.Items.DEFS[kart.item]).toBeDefined();
  });

  test('a collected box comes back', () => {
    const { ZC, track } = fresh();
    const state = ZC.Items.createState(track);
    const box = state.boxes[5];
    const kart = kartAt(ZC, track, 'p', box.s, box.t);
    ZC.Items.step(state, karts0(kart), track, ZC.STEP_DT);
    expect(box.alive).toBe(false);
    tickItems(ZC, state, [], track, ZC.Items.TUNE.boxRespawn + 0.2);
    expect(box.alive).toBe(true);
  });

  test('a kart already holding an item drives straight past', () => {
    const { ZC, track } = fresh();
    const state = ZC.Items.createState(track);
    const box = state.boxes[7];
    const kart = kartAt(ZC, track, 'p', box.s, box.t);
    kart.item = 'updraft';
    ZC.Items.step(state, [kart], track, ZC.STEP_DT);
    expect(box.alive).toBe(true);
  });
});

function karts0(k) { return [k]; }

describe('projectiles and hazards', () => {
  test('a Gust runs down the road and spins the kart in front', () => {
    const { ZC, track } = fresh();
    const state = ZC.Items.createState(track);
    const shooter = kartAt(ZC, track, 'a', 100, 0);
    const victim = kartAt(ZC, track, 'b', 160, 0);
    victim.progress = ZC.Track.progress(track, 0, victim.s);
    const karts = [shooter, victim];

    shooter.item = 'gust';
    expect(ZC.Items.use(state, shooter, karts, track)).toBe('gust');
    expect(state.projectiles.length).toBe(1);

    tickItems(ZC, state, karts, track, 2.5);
    expect(victim.spin).toBeGreaterThan(0);
    expect(state.projectiles.length).toBe(0);
    /* and it never doubles back onto whoever fired it */
    expect(shooter.spin).toBe(0);
  });

  test('a projectile cannot hit the kart that fired it', () => {
    const { ZC, track } = fresh();
    const state = ZC.Items.createState(track);
    const shooter = kartAt(ZC, track, 'a', 100, 0);
    shooter.item = 'gust';
    ZC.Items.use(state, shooter, [shooter], track);
    /* it spawns just ahead and immediately overlaps him */
    tickItems(ZC, state, [shooter], track, 0.2);
    expect(shooter.spin).toBe(0);
  });

  test('a Dart slews across the road onto its target line', () => {
    const { ZC, track } = fresh();
    const state = ZC.Items.createState(track);
    const shooter = kartAt(ZC, track, 'a', 100, -0.8);
    const victim = kartAt(ZC, track, 'b', 200, 0.8);
    victim.progress = ZC.Track.progress(track, 0, victim.s);
    const karts = [shooter, victim];

    shooter.item = 'dart';
    ZC.Items.use(state, shooter, karts, track);
    const proj = state.projectiles[0];
    expect(proj.targetId).toBe('b');
    const startGap = Math.abs(proj.t - victim.t);

    tickItems(ZC, state, karts, track, 0.6);
    if (state.projectiles.length) {
      expect(Math.abs(state.projectiles[0].t - victim.t)).toBeLessThan(startGap);
    } else {
      expect(victim.spin).toBeGreaterThan(0);
    }
  });

  test('a Thunderhead is dropped behind and catches whoever follows', () => {
    const { ZC, track } = fresh();
    const state = ZC.Items.createState(track);
    const leader = kartAt(ZC, track, 'a', 200, 0);
    leader.item = 'thunderhead';
    ZC.Items.use(state, leader, [leader], track);
    expect(state.hazards.length).toBe(1);
    /* behind, not in front */
    expect(ZC.Track.deltaS(track, state.hazards[0].s, leader.s)).toBeGreaterThan(0);

    /* the dropper drives away clean */
    tickItems(ZC, state, [leader], track, 2);
    expect(leader.spin).toBe(0);

    const chaser = kartAt(ZC, track, 'b', state.hazards[0].s, state.hazards[0].t);
    ZC.Items.step(state, [leader, chaser], track, ZC.STEP_DT);
    expect(chaser.spin).toBeGreaterThan(0);
    expect(state.hazards.length).toBe(0);
  });

  test('a Squall hits everyone ahead and nobody behind', () => {
    const { ZC, track } = fresh();
    const state = ZC.Items.createState(track);
    const behind = kartAt(ZC, track, 'back', 40, 0);
    const me = kartAt(ZC, track, 'me', 100, 0);
    const ahead1 = kartAt(ZC, track, 'a1', 160, 0);
    const ahead2 = kartAt(ZC, track, 'a2', 300, 0);
    const karts = [behind, me, ahead1, ahead2];
    for (const k of karts) k.progress = ZC.Track.progress(track, 0, k.s);

    me.item = 'squall';
    ZC.Items.use(state, me, karts, track);

    expect(ahead1.spin).toBeGreaterThan(0);
    expect(ahead2.spin).toBeGreaterThan(0);
    expect(behind.spin).toBe(0);
    expect(me.spin).toBe(0);
  });
});

describe('what a hit does to a kart', () => {
  test('a spin costs control and speed, then hands it back', () => {
    const { ZC, track } = fresh();
    const kart = kartAt(ZC, track, 'p', 100, 0, 26);
    kart.drift.active = true; kart.drift.charge = 2; kart.drift.tier = 2;
    kart.boost = 1;

    expect(ZC.Kart.hit(kart, 1.15, 0.34, 'gust')).toBe(true);
    expect(kart.speed).toBeLessThan(26 * 0.4);
    expect(kart.drift.active).toBe(false);
    expect(kart.drift.tier).toBe(0);
    expect(kart.boost).toBe(0);
    expect(kart.hits).toBe(1);

    /* while spun, full throttle and full lock do nothing */
    const yaw0 = kart.travelYaw;
    const input = { throttle: 1, brake: 0, steer: 1, drift: true, item: false };
    for (let i = 0; i < 60; i++) ZC.Kart.step(kart, input, track, ZC.STEP_DT);
    expect(Math.abs(kart.travelYaw - yaw0)).toBeLessThan(0.01);
    expect(kart.drift.active).toBe(false);
    /* but the shell is visibly whipping round */
    expect(Math.abs(kart.spinAngle)).toBeGreaterThan(3);

    /* and it ends */
    for (let i = 0; i < 240; i++) ZC.Kart.step(kart, input, track, ZC.STEP_DT);
    expect(kart.spin).toBe(0);
    expect(kart.speed).toBeGreaterThan(4);
    for (let i = 0; i < 240; i++) ZC.Kart.step(kart, input, track, ZC.STEP_DT);
    expect(kart.spinAngle).toBe(0);
  });

  test('an Aegis eats exactly one hit', () => {
    const { ZC, track } = fresh();
    const kart = kartAt(ZC, track, 'p', 100, 0, 26);
    kart.shield = 8;

    expect(ZC.Kart.hit(kart, 1.15, 0.34, 'gust')).toBe(false);
    expect(kart.spin).toBe(0);
    expect(kart.shield).toBe(0);
    expect(kart.speed).toBeCloseTo(26, 5);

    expect(ZC.Kart.hit(kart, 1.15, 0.34, 'gust')).toBe(true);
    expect(kart.spin).toBeGreaterThan(0);
  });

  test('hits top the timer up rather than stacking into a sentence', () => {
    const { ZC, track } = fresh();
    const kart = kartAt(ZC, track, 'p', 100, 0, 26);
    ZC.Kart.hit(kart, 1.15, 0.34, 'gust');
    ZC.Kart.hit(kart, 1.15, 0.34, 'dart');
    ZC.Kart.hit(kart, 0.72, 0.55, 'squall');
    expect(kart.spin).toBeLessThanOrEqual(1.15);
  });

  test('an Updraft never shortens a drift boost already running', () => {
    const { ZC, track } = fresh();
    const kart = kartAt(ZC, track, 'p', 100, 0, 26);
    kart.boost = 1.5;
    ZC.Kart.giveBoost(kart, ZC.Items.TUNE.updraftBoost);
    expect(kart.boost).toBe(1.5);
    kart.boost = 0.1;
    ZC.Kart.giveBoost(kart, ZC.Items.TUNE.updraftBoost);
    expect(kart.boost).toBe(ZC.Items.TUNE.updraftBoost);
  });

  test('a kart fished out of the void does not come back still spinning', () => {
    const { ZC, track } = fresh();
    const kart = kartAt(ZC, track, 'p', 100, 0, 26);
    kart.item = 'aegis';
    ZC.Kart.hit(kart, 1.15, 0.34, 'gust');
    ZC.Kart.respawn(kart, track);
    expect(kart.spin).toBe(0);
    /* but it keeps the item it was holding */
    expect(kart.item).toBe('aegis');
  });
});

describe('firing', () => {
  test('holding the button down fires once, not once a frame', () => {
    const { ZC, track } = fresh();
    const state = ZC.Items.createState(track);
    const kart = kartAt(ZC, track, 'p', 100, 0);
    kart.item = 'thunderhead';

    ZC.Items.playerStep(state, kart, [kart], track, true);
    ZC.Items.playerStep(state, kart, [kart], track, true);
    ZC.Items.playerStep(state, kart, [kart], track, true);
    expect(state.hazards.length).toBe(1);

    kart.item = 'thunderhead';
    ZC.Items.playerStep(state, kart, [kart], track, true);
    expect(state.hazards.length).toBe(1);   // still held down

    ZC.Items.playerStep(state, kart, [kart], track, false);
    ZC.Items.playerStep(state, kart, [kart], track, true);
    expect(state.hazards.length).toBe(2);   // released and pressed again
  });

  test('a spun-out kart cannot fire', () => {
    const { ZC, track } = fresh();
    const state = ZC.Items.createState(track);
    const kart = kartAt(ZC, track, 'p', 100, 0);
    kart.item = 'updraft';
    kart.spin = 1;
    expect(ZC.Items.use(state, kart, [kart], track)).toBe(null);
    expect(kart.item).toBe('updraft');
  });

  test('an empty slot fires nothing', () => {
    const { ZC, track } = fresh();
    const state = ZC.Items.createState(track);
    const kart = kartAt(ZC, track, 'p', 100, 0);
    expect(ZC.Items.use(state, kart, [kart], track)).toBe(null);
  });

  test('the AI holds a shield until someone is actually behind it', () => {
    const { ZC, track } = fresh();
    const state = ZC.Items.createState(track);
    const alone = kartAt(ZC, track, 'a', 300, 0);
    alone.item = 'aegis';
    alone.progress = ZC.Track.progress(track, 0, alone.s);
    ZC.Items.aiStep(state, [alone], track, 100);
    expect(alone.item).toBe('aegis');          // nobody near: held

    const chaser = kartAt(ZC, track, 'b', 290, 0);
    chaser.progress = ZC.Track.progress(track, 0, chaser.s);
    ZC.Items.aiStep(state, [alone, chaser], track, 100);
    expect(alone.item).toBe(null);             // threat behind: spent
    expect(alone.shield).toBeGreaterThan(0);
  });
});

describe('the item game inside a real race', () => {
  test('items are live by default and dead when the race asks for a clean field', () => {
    const ZC = loadZC(['core.js', 'track.js', 'tracks.js', 'kart.js', 'items.js',
      'ai.js', 'race.js']);
    ZC.Race.load(0, { attract: true });
    expect(ZC.Race.state.items.enabled).toBe(true);
    ZC.Race.load(0, { attract: true, items: false });
    expect(ZC.Race.state.items.enabled).toBe(false);
  });

  test('a field of eight actually plays the item game', () => {
    const ZC = loadZC(['core.js', 'track.js', 'tracks.js', 'kart.js', 'items.js',
      'ai.js', 'race.js']);
    let uses = 0, hits = 0, pickups = 0;
    ZC.on('item:use', () => uses++);
    ZC.on('item:hit', () => hits++);
    ZC.on('item:pickup', () => pickups++);

    ZC.Race.load(0, { attract: true });
    for (let t = 0; t < 120; t += 1 / 60) ZC.Race.update(1 / 60);

    expect(pickups).toBeGreaterThan(8);
    expect(uses).toBeGreaterThan(6);
    expect(hits).toBeGreaterThan(0);
  });

  test('a race with items still replays identically from the same seed', () => {
    function run() {
      const ZC = loadZC(['core.js', 'track.js', 'tracks.js', 'kart.js', 'items.js',
        'ai.js', 'race.js']);
      ZC.Race.load(0, { attract: true });
      for (let t = 0; t < 90; t += 1 / 60) ZC.Race.update(1 / 60);
      return ZC.Race.state.karts
        .map((k) => k.s.toFixed(4) + ':' + k.lap + ':' + (k.item || '-') + ':' + k.hits)
        .join('|');
    }
    expect(run()).toBe(run());
  });

  test('items do not wreck the race: everyone still finishes, nobody is knocked into the void', () => {
    const ZC = loadZC(['core.js', 'track.js', 'tracks.js', 'kart.js', 'items.js',
      'ai.js', 'race.js']);
    ZC.Race.load(0, { attract: true });
    for (let t = 0; t < 400; t += 1 / 60) ZC.Race.update(1 / 60);
    const st = ZC.Race.state;
    for (const k of st.karts) expect(k.finished).toBe(true);
    /* A spin should cost a place, never a lap: being hit into the void
       and respawning is the one outcome that would make items feel
       unfair, so the whole field is held to a low fall count. */
    const falls = st.karts.reduce((n, k) => n + k.falls, 0);
    expect(falls).toBeLessThanOrEqual(2);
  });
});
