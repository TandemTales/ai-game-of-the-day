/* =====================================================================
   Stormhook — autopilot traversal.

   READ THIS BEFORE STRENGTHENING THE ASSERTIONS.

   `tools/autopilot.js` is a scripted player. It exists to test the one
   property nothing else in the suite tests: that a level can be crossed
   by *playing* it. The design invariants assert anchor continuity, which
   says "something is in reach here", not "a body under this gravity on
   this rope can actually get there". `tools/smoke.js` clears levels by
   teleporting the player onto the beacon, which exercises the transition
   and scoring plumbing and says nothing about the route.

   What this file asserts is deliberately narrower than "the bot clears
   the campaign", because as of 2026-09-01 it does not. Measured:

     1 Shallow Wrecks        crosses the full level (104% of beacon x),
                             then dies to the storm at 101s vs 42s par
     2 The Chain Yard        dies to a deck hazard at 41%
     3 Foundry Spine         dies to a deck hazard at 31%
     4 Tidewall Gantries     dies to a deck hazard at 16%
     5 The Drowned Foundry   falls at 11%

   Those are limits of a ~200-line hand-written policy, not evidence that
   the levels are unclearable — the bot has no route planning, no hazard
   lookahead, and no notion of the storm clock. Do NOT "fix" a red test
   here by weakening a level. Improve the bot, then raise the bar.

   So the two things asserted below are the two that are real today:

     * NO LEVEL CAN PERMANENTLY WEDGE A PLAYER. This is the regression
       test for a bug that genuinely happened: an earlier bot latched a
       corner, pinned itself against it, and hung motionless for thirty
       seconds. A rope solver or a level shape that can trap a moving
       player forever is a defect, and this catches it on all five levels.
     * LEVEL 1 IS TRAVERSABLE BY PLAY, end to end, under the real fixed
       -step simulation and the real input layer.
   ===================================================================== */
'use strict';

const { loadSH } = require('./stormhook.harness.js');
const AP = require('../stormhook/tools/autopilot.js');

const TICKS = 120 * 130;          // 130 simulated seconds, comfortably past par

/* One flight per level, computed once and shared by the tests below. */
function flyAll() {
  const { SH } = loadSH();
  const out = [];
  for (let i = 0; i < SH.Levels.count(); i++) {
    const w = SH.Physics.makeWorld(i);
    out.push({ name: SH.Levels.get(i).name, report: AP.fly(SH, w, TICKS) });
  }
  return out;
}

let RUNS;
beforeAll(() => { RUNS = flyAll(); });

describe('the autopilot can be driven at all', () => {
  test('it produces a legal input frame every tick', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    const st = AP.makeState();
    for (let i = 0; i < 600; i++) {
      const inp = AP.step(SH, w, st);
      expect(typeof inp.hook).toBe('boolean');
      expect([-1, 0, 1]).toContain(inp.reel);
      expect(inp.lean).toBeGreaterThanOrEqual(-1);
      expect(inp.lean).toBeLessThanOrEqual(1);
      SH.Physics.step(w, inp, 1 / 120);
    }
  });

  test('it actually swings rather than falling in a straight line', () => {
    /* If the anchor search or fireHook regressed, the bot would never
       attach and this number would be zero. */
    const total = RUNS.reduce((n, r) => n + r.report.launches, 0);
    expect(total).toBeGreaterThan(8);
  });
});

describe('no level can permanently wedge a player', () => {
  /* The failure this guards against: a taut rope wrapped onto a convex
     corner pinning the player with no arc to swing through, forever.
     The bot bails out of a wedge after 45 stalled ticks, so a longest
     stall anywhere near the tick budget means the bail-out itself failed
     to free it — that is a physics or geometry defect, not a bot tuning
     problem. */
  test('no run stalls for more than two seconds', () => {
    const stalls = RUNS.map((r) => ({
      level: r.name,
      longestStallSeconds: +(r.report.longestStall / 120).toFixed(2),
    }));
    const bad = stalls.filter((s) => s.longestStallSeconds > 2);
    expect({ stalledLevels: bad }).toEqual({ stalledLevels: [] });
  });
});

describe('level 1 is traversable by play, not just by teleport', () => {
  test('Shallow Wrecks: the bot swings the full width of the level', () => {
    const r = RUNS[0].report;
    /* Progress is measured against the beacon's x, so >= 1 means the bot
       carried itself the entire distance under its own swings. */
    expect({ level: RUNS[0].name, crossed: r.progress >= 1 })
      .toEqual({ level: RUNS[0].name, crossed: true });
    expect(r.launches).toBeGreaterThan(4);
  });
});

describe('campaign traversal profile (reported, mostly not yet gated)', () => {
  test('prints how far the bot gets on each level', () => {
    const rows = RUNS.map((r, i) => ({
      '#': i + 1,
      level: r.name,
      outcome: r.report.cleared ? 'CLEARED'
        : r.report.dead ? 'died: ' + r.report.cause : 'ran out of ticks',
      'progress %': +(r.report.progress * 100).toFixed(1),
      't (s)': +r.report.seconds.toFixed(1),
      launches: r.report.launches,
      bails: r.report.bails,
    }));
    // eslint-disable-next-line no-console
    console.table(rows);
    expect(rows).toHaveLength(5);
  });
});
