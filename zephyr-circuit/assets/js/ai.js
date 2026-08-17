/* =====================================================================
   ZEPHYR CIRCUIT — ai.js
   Computer drivers.
   Owner: agent-ai (this first pass written by the lead).

   The whole driver is: aim at a point down the road, brake for what is
   coming, drift when the corner is worth it. Everything it needs is a
   query against the baked centreline, so it costs almost nothing per
   kart and it cannot desync from the geometry.
   ===================================================================== */
(function (global) {
  'use strict';

  var ZC = global.ZC || (global.ZC = {});
  var T = ZC.Track;
  var AI = ZC.AI = {};

  /* Per-driver personality. Skill scales the lot, so one number moves a
     racer between "wobbles about" and "quick". */
  AI.makeBrain = function (opts) {
    opts = opts || {};
    var skill = ZC.clamp01(opts.skill === undefined ? 0.7 : opts.skill);
    return {
      skill: skill,
      /* preferred lateral line — some drivers hug the inside, some sit wide */
      line: opts.line === undefined ? (ZC.rand() - 0.5) * 0.7 : opts.line,
      /* Skill has to be monotonic: every one of these must make a driver
         BETTER as it rises. The first cut raised aggression with skill —
         more lookahead, more gain, more nerve, a lower drift threshold —
         and the fastest-rated driver finished last, sliding wide into the
         void. Skill now buys precision and judgement, not recklessness. */
      lookahead: 18 + skill * 8,
      gain: 2.35 + skill * 0.55,
      cornerNerve: 0.60 + skill * 0.38,
      wobbleAmp: (1 - skill) * 0.16,
      driftSkill: skill,
      /* a slow wander so a pack of AI does not drive like one object */
      wobblePhase: ZC.rand() * ZC.TAU,
      wobbleRate: 0.35 + ZC.rand() * 0.5,
      _frame: {},
      _out: { throttle: 1, brake: 0, steer: 0, drift: false, item: false }
    };
  };

  /* Worst curvature over the next `dist` metres — what to brake for. */
  function curvatureAhead(track, s, dist) {
    var steps = 8;
    var worst = 0;
    for (var i = 1; i <= steps; i++) {
      var seg = T.segAt(track, s + (dist * i) / steps);
      var k = Math.abs(track.curvature[seg]);
      if (k > worst) worst = k;
    }
    return worst;
  }

  /* Curvature at the corner we are about to enter, signed. */
  function cornerAhead(track, s, dist) {
    return track.curvature[T.segAt(track, s + dist)];
  }

  /* A corner has to be at least this bent to be worth sliding through.
     0.016 is a ~62m radius. */
  var DRIFT_K = 0.016;

  AI.drive = function (kart, brain, track, time) {
    var out = brain._out;
    var TUNE = ZC.Kart.TUNE;

    /* aim further down the road the faster we are going */
    var look = brain.lookahead + kart.speed * 0.6;
    var fr = T.frameAt(track, kart.s + look, brain._frame);

    /* the corner being entered, for both braking and the drift decision */
    var kSigned = cornerAhead(track, kart.s, 10 + kart.speed * 0.35);
    var kNow = Math.abs(kSigned);
    var inside = ZC.sign(kSigned);

    /* ---- should we be sliding? ----
       Keyed on the corner, not on instantaneous steering: steering angle
       spikes on every twitch, and drifting off a twitch is what put the
       first version into the void. */
    var minDriftSpeed = TUNE.driftMinSpeed + 4;
    if (kart.drift.active) {
      /* hold until the corner genuinely opens, but never throw away a
         slide before it has banked at least one tier */
      out.drift = (kNow > DRIFT_K * 0.55 && kart.speed > TUNE.driftMinSpeed) ||
        kart.drift.tier < 1;
    } else {
      /* less confident drivers only take the obvious corners */
      var need = DRIFT_K * (1 + (1 - brain.driftSkill) * 2.4);
      out.drift = kNow > need && kart.speed > minDriftSpeed;
    }

    /* ---- the line ----
       A sliding kart travels wider than it points, so aim further inside
       while drifting or it exits over the edge. */
    var wobble = Math.sin(time * brain.wobbleRate + brain.wobblePhase) * brain.wobbleAmp;
    var wantT = brain.line + wobble;
    if (out.drift || kart.drift.active) {
      wantT += inside * (0.30 + brain.driftSkill * 0.14);
    }
    wantT = ZC.clamp(wantT, -0.78, 0.78);

    var tx = fr.x + fr.rx * wantT * fr.halfWidth;
    var tz = fr.z + fr.rz * wantT * fr.halfWidth;
    var want = Math.atan2(tx - kart.x, tz - kart.z);
    out.steer = ZC.clamp(ZC.angleDelta(kart.travelYaw, want) * brain.gain, -1, 1);
    out.item = false;

    /* ---- braking ----
       The limit is not a friction circle: this kart has no lateral
       acceleration budget, it has a maximum yaw RATE. To hold curvature k
       at speed v you need yaw rate v*k, and the kart supplies
       steerMax * steerFactor(v), so the fastest it can hold the corner is
       steerMax * steerFactor(v) / k. Treating steerMax as an acceleration
       (sqrt(a/k)) is dimensionally wrong and lands two thirds too slow —
       the first cut braked to 9 m/s for corners it could take flat, and
       turned 40-second laps into 1:25. */
    var kBrake = curvatureAhead(track, kart.s, 28 + kart.speed * 1.5);
    var safe = 999;
    if (kBrake > 1e-4) {
      safe = (TUNE.steerMax * ZC.Kart.steerFactor(kart.speed) * brain.cornerNerve) / kBrake;
    }

    if (kart.speed > safe * 1.15) {
      out.throttle = 0; out.brake = 1;
    } else if (kart.speed > safe) {
      out.throttle = 0; out.brake = 0;
    } else {
      out.throttle = 1; out.brake = 0;
    }

    return out;
  };

})(window);
