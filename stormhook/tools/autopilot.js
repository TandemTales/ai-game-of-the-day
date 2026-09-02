/* =====================================================================
   STORMHOOK — autopilot.js   [OWNER: lead]

   A scripted player. Given a live `world`, it returns the input frame a
   competent human would press. It is NOT shipped — `index.html` never
   loads it. It exists so the test suite can assert the thing that
   actually matters and that nothing else checks: **that a level can be
   traversed by playing it.**

   Everything else we have is a proxy. The design tests assert anchor
   continuity, which says "something is in reach here", not "a body with
   this gravity and this rope can actually get there". `tools/smoke.js`
   clears levels by teleporting the player onto the beacon, which tests
   the transition plumbing and nothing about the route. Only a bot that
   swings the whole way closes that gap.

   The policy, which is deliberately simple enough to reason about:

     detached → fan a raycast overhead, pick the anchor that is furthest
                forward at a rope length that gives a usable arc, latch;
     attached → pump (lean into the direction of travel), reel in while
                descending to add energy to the swing, and release once
                past the pivot and rising, which converts the arc into
                forward-and-up flight.

   The one non-obvious part is the anti-strand rule. An earlier version
   of this bot covered ~76% of level 1 and then hung motionless under an
   anchor forever, because its release condition needed a speed it no
   longer had. A hanging player can always restart a swing with lean
   alone, so when the bot notices it is attached and slow it stops
   waiting for the release condition and pumps deliberately until the
   arc is worth releasing.

   Usable from Node (`require`) and from a browser page (`SH.Autopilot`).
   ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.SH) root.SH.Autopilot = api;
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var DEG = Math.PI / 180;

  function TILE(SH) { return SH.TILE; }

  /* A fresh bot memory. One per run — the policy is stateful. */
  function makeState() {
    return {
      ticks: 0,
      slowTicks: 0,        // consecutive ticks attached and under-speed
      pumpDir: 1,          // which way we are deliberately pumping
      lastX: -Infinity,
      stuckTicks: 0,       // consecutive ticks without forward progress
      forceRelease: 0,     // ticks left in a deliberate bail-out
      bails: 0,
      launches: 0
    };
  }

  /* Fan a raycast through the upper half-plane and pick an anchor.

     Scoring wants three things at once: as far forward as possible (this
     is a race), a rope length near the middle of the usable band (a very
     short rope gives a tight useless arc, a maximal one often clips the
     ceiling), and a bias against anchors we are already almost underneath. */
  function pickAnchor(SH, w) {
    var P = SH.Physics, T = SH.TUNE, p = w.p;
    var best = null, bestScore = -Infinity;
    var ideal = (T.minLen + T.maxLen) * 0.42;

    for (var a = -175; a <= -5; a += 4) {
      var r = a * DEG;
      var hit = P.rayCast(w, p.x, p.y, Math.cos(r), Math.sin(r), T.maxRange);
      if (!hit) continue;

      var dx = hit.x - p.x, dy = hit.y - p.y;
      /* Must be genuinely overhead, not merely "not below". An earlier
         threshold of 32px let the bot latch the lip of the very chasm it
         was falling into: the anchor was 43px up, the swing had nowhere
         to go, and it wedged against the pit wall for the rest of the
         run. Two and a half tiles of clearance is the difference between
         an anchor and a handhold. */
      if (dy > -2.5 * TILE(SH)) continue;
      var d = SH.len(dx, dy);
      /* Refuse handholds. A rope shorter than ~3 tiles wraps onto its own
         anchor's corner almost immediately and leaves the player pinned
         against it with no arc to swing through. */
      if (d < Math.max(T.minLen + 24, 2.8 * TILE(SH)) || d > T.maxLen) continue;

      /* Forward reach dominates, but height is what pays for the next
         chasm, so a high anchor is worth real points and length quality
         is only the tie-break. Without the altitude term the bot always
         took the nearest thing ahead, sank a little on every swing, and
         eventually ran out of air over a gap. */
      var score = dx * 1.4 + (-dy) * 0.9 - Math.abs(d - ideal) * 0.5;
      if (score > bestScore) { bestScore = score; best = hit; }
    }
    return best;
  }

  /* The input frame for one tick. Mutates `w.aim` — that is how a real
     player aims too, and physics.fireHook reads it. */
  function step(SH, w, st) {
    var inp = {
      hook: false, hookPressed: false, hookReleased: false,
      reel: 0, lean: 0, dashPressed: false
    };
    var p = w.p, hk = w.hook, T = SH.TUNE;
    st.ticks++;

    /* Progress watchdog, used only for reporting a strand. */
    if (p.x > st.lastX + 1) { st.lastX = p.x; st.stuckTicks = 0; }
    else st.stuckTicks++;

    /* Wedge recovery, and the most important rule in this file.

       A taut rope wrapped onto a corner can pin the player against that
       corner with no arc left to swing through. Reeling in there makes it
       worse — it pulls them harder into the geometry — which is exactly
       how the previous policy stranded itself for thirty seconds. The only
       move that works is the one a human makes without thinking: let go,
       fall clear, and grab something else. */
    if (st.forceRelease > 0) {
      st.forceRelease--;
      inp.lean = 1;
      return inp;                          // hook stays false: fall clear
    }
    if (hk.attached && st.stuckTicks > 45) {
      st.forceRelease = 30;
      st.slowTicks = 0;
      st.stuckTicks = 0;
      st.bails++;
      inp.lean = 1;
      return inp;
    }

    if (!hk.attached) {
      st.slowTicks = 0;
      /* Always drive forward in the air; free flight is where the run is won. */
      inp.lean = 1;

      /* Do NOT grab again while still climbing out of the last launch.
         Latching mid-ascent is the single worst thing this bot can do: the
         rope constraint deletes the radial component of velocity, so an
         instant re-latch throws away exactly the speed the swing just
         built. A human waits out the arc and grabs on the way down, and
         so does this. The earlier version of this policy re-latched every
         tick it could and averaged one real launch per level as a result. */
      /* ...but grab immediately, climbing or not, once we have sunk into
         the lower third of the band. Down there the next thing ahead is a
         chasm or a hazard, and altitude is the only currency that clears
         either. */
      var sinking = p.y > 8.5 * TILE(SH);
      if (p.vy > -20 || sinking) {
        var anchor = pickAnchor(SH, w);
        if (anchor) {
          w.aim.x = anchor.x;
          w.aim.y = anchor.y;
          inp.hook = true;
        }
      }
      return inp;
    }

    /* ---- attached ---- */
    var piv = hk.pivots[hk.pivots.length - 1];
    var speed = SH.len(p.vx, p.vy);
    inp.hook = true;

    /* Reeling in while descending converts rope length into speed. Paying
       out while rising keeps the arc wide instead of stalling at the top. */
    inp.reel = p.vy > 0 ? -1 : 1;

    /* Every hazard in the game sits on the deck at y=11, so the bottom of
       the band is where runs end. Low on the rope, climbing beats speed:
       reel in hard regardless of which way we are moving. */
    if (p.y > 9.5 * TILE(SH)) inp.reel = -1;

    /* Pump. Leaning into the direction of travel adds energy every swing,
       exactly as a child does on a playground swing. At the bottom of the
       arc vx passes through zero, and a sign() there would dither and
       cancel its own work, so we latch a pump direction and hold it. */
    if (Math.abs(p.vx) > 40) st.pumpDir = p.vx >= 0 ? 1 : -1;
    inp.lean = st.pumpDir;

    /* Anti-strand: hanging slow under an anchor is the failure mode that
       stranded the previous bot at 76% of level 1. Keep pumping, never
       release — a release here would just drop us with no speed. */
    if (speed < 90) st.slowTicks++; else st.slowTicks = 0;
    if (st.slowTicks > 8) {
      inp.reel = 1;                       // pay out: slack lets gravity restart the arc
      return inp;
    }

    /* Release: past the pivot, still rising, carrying real speed. That is
       the top-of-arc launch that converts a swing into distance. */
    if (p.x > piv.x + 8 && p.vy < -30 && p.vx > 110) {
      inp.hook = false;
      st.launches++;
    }
    return inp;
  }

  /* Drive a world to its beacon (or to death, or to the tick budget).
     Returns a report rather than throwing, so callers can assert on it. */
  function fly(SH, world, maxTicks, dt) {
    var st = makeState();
    var n = maxTicks || 120 * 90;
    var d = dt || 1 / 120;
    for (var i = 0; i < n; i++) {
      SH.Physics.step(world, step(SH, world, st), d);
      if (world.dead || world.cleared) break;
    }
    var spawnX = SH.Levels.get(world.level).grid ? 0 : 0;
    return {
      cleared: !!world.cleared,
      dead: !!world.dead,
      cause: world.deathCause || null,
      ticks: st.ticks,
      seconds: world.time,
      x: world.p.x,
      beaconX: world.beacon.x,
      progress: world.p.x / world.beacon.x,
      launches: st.launches,
      bails: st.bails,
      longestStall: st.stuckTicks,
      spawnX: spawnX
    };
  }

  return { makeState: makeState, step: step, fly: fly, pickAnchor: pickAnchor };
}));
