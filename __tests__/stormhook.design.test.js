/* =====================================================================
   Stormhook — design invariants.

   The simulation suite proves the rope works. This one proves the LEVELS
   work: that a player who can swing can actually get from the spawn to
   the beacon, and that every core is worth reaching.

   Why not just flood-fill like a walking game would? Because this game
   has no walking. Reachability here is a question about *anchors*: at
   every point along the run there has to be latchable geometry within
   maxRange, or the player arrives with nothing to grab and the level is
   over regardless of skill. That is the invariant these tests encode,
   and it is the one that a level edit is most likely to break silently.
   ===================================================================== */
'use strict';

const { loadSH, input, run, FIXED_DT } = require('./stormhook.harness');

const { SH } = loadSH();
const TILE = SH.TILE;
const LEVELS = [];
for (let i = 0; i < SH.Levels.count(); i++) LEVELS.push(SH.Levels.get(i));

/* Can a player standing at world (x,y) latch onto anything? Fan a ray out
   over the upper half-plane; the hook is only useful upward in practice. */
function anchorsFrom(world, x, y) {
  let n = 0;
  for (let deg = -170; deg <= -10; deg += 5) {
    const a = (deg * Math.PI) / 180;
    const hit = SH.Physics.rayCast(world, x, y, Math.cos(a), Math.sin(a), SH.TUNE.maxRange);
    if (hit) n++;
  }
  return n;
}

describe('level geometry', () => {
  test.each(LEVELS.map((l, i) => [l.name, i]))(
    '%s: spawn, beacon and every core sit in open air', (name, i) => {
      const w = SH.Physics.makeWorld(i);
      expect(SH.Physics.solidAtPoint(w, w.p.x, w.p.y)).toBe(false);
      expect(SH.Physics.solidAtPoint(w, w.beacon.x, w.beacon.y)).toBe(false);
      w.cores.forEach((c) => {
        expect({ core: [c.tx, c.ty], solid: SH.Physics.solidAtPoint(w, c.x, c.y) })
          .toEqual({ core: [c.tx, c.ty], solid: false });
      });
      w.hazards.forEach((h) => {
        expect({ hz: [h.tx, h.ty], solid: SH.Physics.solidAtPoint(w, h.x, h.y) })
          .toEqual({ hz: [h.tx, h.ty], solid: false });
      });
    });

  test.each(LEVELS.map((l, i) => [l.name, i]))(
    '%s: is 14 tiles tall, so the whole play band is always on screen', (name, i) => {
      /* render.js frames exactly 14 tiles vertically. A level taller than
         that would hide anchors off the top of the screen. */
      expect(LEVELS[i].h).toBe(14);
    });

  test.each(LEVELS.map((l, i) => [l.name, i]))(
    '%s: a hazard is never floating in mid-air', (name, i) => {
      const lv = LEVELS[i];
      const w = SH.Physics.makeWorld(i);
      w.hazards.forEach((h) => {
        expect({ hz: [h.tx, h.ty], grounded: SH.Levels.solidAt(lv, h.tx, h.ty + 1) })
          .toEqual({ hz: [h.tx, h.ty], grounded: true });
      });
    });
});

describe('anchor continuity — the real solvability invariant', () => {
  /* Walk the full width of each level and check that from the middle of
     the play band there is always something within reach overhead. A
     column with no anchor is a column where the run ends. */
  test.each(LEVELS.map((l, i) => [l.name, i]))(
    '%s: every column of the run has a latchable anchor in range', (name, i) => {
      const w = SH.Physics.makeWorld(i);
      const x0 = w.p.x, x1 = w.beacon.x;
      const dead = [];
      for (let x = x0; x <= x1; x += TILE / 2) {
        /* Sample at three heights across the band a swing actually uses. */
        const heights = [5.5, 8, 10.5].map((t) => t * TILE);
        const ok = heights.some((y) => anchorsFrom(w, x, y) > 0);
        if (!ok) dead.push(Math.round(x / TILE));
      }
      expect({ level: name, columnsWithNoAnchor: dead })
        .toEqual({ level: name, columnsWithNoAnchor: [] });
    });

  test.each(LEVELS.map((l, i) => [l.name, i]))(
    '%s: every core has an anchor within reach of it', (name, i) => {
      const w = SH.Physics.makeWorld(i);
      const unreachable = w.cores
        .filter((c) => anchorsFrom(w, c.x, c.y) === 0)
        .map((c) => [c.tx, c.ty]);
      expect({ level: name, coresWithNoAnchor: unreachable })
        .toEqual({ level: name, coresWithNoAnchor: [] });
    });

  test.each(LEVELS.map((l, i) => [l.name, i]))(
    '%s: the beacon has an anchor within reach of it', (name, i) => {
      const w = SH.Physics.makeWorld(i);
      expect({ level: name, anchors: anchorsFrom(w, w.beacon.x, w.beacon.y) > 0 })
        .toEqual({ level: name, anchors: true });
    });
});

describe('the storm is a real clock, not decoration', () => {
  test.each(LEVELS.map((l, i) => [l.name, i]))(
    '%s: standing still loses the run', (name, i) => {
      const w = SH.Physics.makeWorld(i);
      run(SH, w, 120 * 200);                  // do nothing for up to 200s
      expect(w.dead).toBe(true);
      expect(w.deathCause).toBe('storm');
    });

  test.each(LEVELS.map((l, i) => [l.name, i]))(
    '%s: par time is beatable by the storm — the front does not outrun par', (name, i) => {
      const lv = LEVELS[i];
      const w = SH.Physics.makeWorld(i);
      /* Where is the front when the par clock runs out, and is the beacon
         still ahead of it? If not, par is a lie no player can hit. */
      const frontAtPar = w.storm.x + lv.stormSpeed * lv.parTime;
      expect({ level: name, beaconStillAhead: w.beacon.x > frontAtPar })
        .toEqual({ level: name, beaconStillAhead: true });
    });

  test('difficulty climbs across the campaign', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].stormSpeed).toBeGreaterThan(LEVELS[i - 1].stormSpeed);
    }
  });
});

describe('the campaign profile', () => {
  test('prints, and every level carries enough salvage to matter', () => {
    const rows = LEVELS.map((lv, i) => {
      const w = SH.Physics.makeWorld(i);
      const runLen = (w.beacon.x - w.p.x) / TILE;
      return {
        '#': i + 1,
        level: lv.name,
        'tiles wide': lv.w,
        'run (tiles)': Math.round(runLen),
        cores: lv.coreCount,
        'storm px/s': lv.stormSpeed,
        'par (s)': lv.parTime,
        'req. avg px/s': Math.round((w.beacon.x - w.p.x) / lv.parTime),
      };
    });
    // eslint-disable-next-line no-console
    console.table(rows);
    rows.forEach((r) => {
      expect(r.cores).toBeGreaterThanOrEqual(8);
      /* Par must demand real speed, but stay under what a swing can do. */
      expect(r['req. avg px/s']).toBeGreaterThan(60);
      expect(r['req. avg px/s']).toBeLessThan(SH.TUNE.maxAirSpeed * 0.5);
    });
  });
});
