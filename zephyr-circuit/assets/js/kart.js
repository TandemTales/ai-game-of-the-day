/* =====================================================================
   ZEPHYR CIRCUIT — kart.js
   Kart physics: throttle, steering, drift, boost, gravity, lap counting.
   Owner: lead. See SPEC.md §2.

   Arcade, not simulation. `step()` is a pure function of
   (kart, input, track, dt) — it reads and writes the kart and nothing
   else, so the whole field can be stepped in a test with no renderer.

   Two invariants that must survive any tuning pass:
     * step() never calls Math.random(). Seeded ZC.rand() only.
     * step() is called at a FIXED dt. Drift charge accrues per step, so a
       variable timestep would make the skill mechanic frame-rate
       dependent and the leaderboard meaningless.
   ===================================================================== */
(function (global) {
  'use strict';

  var ZC = global.ZC || (global.ZC = {});
  var T = ZC.Track;
  var K = ZC.Kart = {};

  /* ------------------------------------------------------------------
     Tuning. Every number that decides how the game feels lives here.
     ------------------------------------------------------------------ */
  var TUNE = K.TUNE = {
    maxSpeed:      27,      // m/s on tarmac, ~97 km/h
    accel:         11,      // m/s^2
    brakeDecel:    24,
    coastDrag:     3.5,
    reverseSpeed:  -6,

    offroadMax:    11,      // hard cap once a wheel is off the road
    offroadDrag:   14,

    boostSpeed:    38,
    boostAccel:    34,

    /* Steering is a yaw RATE, shaped by speed. A kart that turns as hard
       at walking pace as at top speed feels broken at both ends. */
    steerMax:      2.05,    // rad/s at the sweet spot
    steerRampTo:   8,       // speed at which full authority arrives
    steerFadeFrom: 18,      // speed where it starts to wash out
    steerFadeTo:   30,
    steerFadeAmt:  0.36,

    /* Item hits. A spin has to be long enough to cost a place and short
       enough that it never feels like the game took the controller away:
       a shade over a second is where every kart racer lands. */
    spinRate:      13.0,    // rad/s the shell whips round while spun out
    spinSteerBack: 5.5,     // how fast control returns as it ends

    driftMinSpeed: 12,
    driftSlip:     0.44,    // radians the body yaws past its travel
    driftSlipRate: 4.2,
    driftSteerIn:  1.55,    // steering authority into the slide
    driftSteerOut: 0.42,    // and away from it
    driftGrip:     0.90,    // speed retained per second while sliding

    /* Charge thresholds in seconds of genuine slide, and the boost each
       tier pays out. Charge only accrues while actually sliding, so
       holding drift down a straight earns nothing.

       These were measured against the corners the game actually has, not
       guessed. At the first cut — 0.80/1.70/2.70 — the strongest AI
       driver never once got past tier 1 on any of the three circuits: its
       longest genuine slide was 1.29 seconds, because a kart carrying
       speed through a 100m-radius corner is only in it for about a
       second. Two thirds of the drift mechanic was unreachable content.
       They now sit inside the range the circuits produce: tier 1 arrives
       quickly enough to feel like a reward for trying, tier 2 is a
       well-taken corner, and tier 3 needs a slide held longer than the
       AI manages — a genuine ceiling rather than a locked door. Re-measure
       these if the circuits ever change shape. */
    driftTiers:    [0.42, 0.95, 1.65],
    driftBoosts:   [0.55, 0.95, 1.50],

    gravity:       26,
    /* How far past the road edge still has ground under it. A sky island
       needs a real shoulder: at 1.34 there was barely 3m of margin before
       the void, and a merely untidy line fell off the world. */
    vergeLimit:    1.85,
    respawnDelay:  1.4,
    kartRadius:    1.5
  };

  /* ------------------------------------------------------------------
     Construction
     ------------------------------------------------------------------ */
  K.create = function (opts) {
    opts = opts || {};
    return {
      id: opts.id || 'kart',
      name: opts.name || 'Racer',
      isPlayer: !!opts.isPlayer,
      colour: opts.colour || 0xff7a2f,

      x: 0, y: 0, z: 0,
      travelYaw: 0,          // direction of motion
      bodyYaw: 0,            // where the shell points (travel + slip)
      speed: 0,
      vy: 0,
      slip: 0,

      drift: { active: false, dir: 0, charge: 0, tier: 0 },
      boost: 0,              // seconds of boost remaining

      /* item state. items.js owns the rules; the fields live here so the
         kart stays the one struct that describes a racer, and so a hit
         can be applied without items.js being loaded at all. */
      item: null,            // id of the held item, or null
      itemRoll: 0,           // seconds left on the roulette before it settles
      spin: 0,               // seconds of lost control after a hit
      spinAngle: 0,          // extra body yaw while spun out, for the renderer
      shield: 0,             // seconds of Aegis remaining
      hits: 0,
      _itemHeld: false,      // player's item button, for edge detection
      _aiItemAt: 0,

      seg: 0, s: 0, t: 0,
      onRoad: true, grounded: true,
      surfaceY: 0,

      lap: 0,                // laps COMPLETED
      cpNext: 0,             // next checkpoint index required
      place: 1,
      progress: 0,

      falling: false, respawnTimer: 0, falls: 0,

      raceTime: 0, lapStart: 0, lapTimes: [], bestLap: 0,
      finished: false, finishTime: 0,

      /* scratch so step() allocates nothing */
      _proj: {}
    };
  };

  /* Drop a kart onto its grid slot, facing along the road. */
  K.placeOnGrid = function (kart, track, place, fieldSize) {
    var slot = ZC.Tracks.gridSlot(track, place, fieldSize);
    var p = T.pointAt(track, slot.s, slot.t);
    kart.x = p.x; kart.y = p.y; kart.z = p.z;
    kart.travelYaw = p.yaw;
    kart.bodyYaw = p.yaw;
    kart.speed = 0; kart.vy = 0; kart.slip = 0;
    kart.drift.active = false; kart.drift.charge = 0; kart.drift.tier = 0;
    kart.boost = 0;
    kart.lap = 0; kart.cpNext = 0;
    kart.falling = false; kart.respawnTimer = 0; kart.falls = 0;
    kart.raceTime = 0; kart.lapStart = 0; kart.lapTimes = []; kart.bestLap = 0;
    kart.finished = false; kart.finishTime = 0;
    kart.item = null; kart.itemRoll = 0; kart.hits = 0;
    kart.spin = 0; kart.spinAngle = 0; kart.shield = 0;
    kart._itemHeld = false; kart._aiItemAt = 0;
    /* full scan once, here — every later projection rides the hint */
    var pr = T.project(track, kart.x, kart.y, kart.z, -1, kart._proj);
    kart.seg = pr.seg; kart.s = pr.s; kart.t = pr.t;
    kart.surfaceY = pr.surfaceY;
    kart.y = pr.surfaceY;
    kart.progress = T.progress(track, kart.lap, kart.s);
    return kart;
  };

  /* Put a fallen kart back on the centerline at its last checkpoint. */
  K.respawn = function (kart, track) {
    var cp = Math.max(0, kart.cpNext - 1);
    var s = T.wrapS(track, cp * track.checkpointLen);
    var p = T.pointAt(track, s, 0);
    kart.x = p.x; kart.y = p.y + 0.6; kart.z = p.z;
    kart.travelYaw = p.yaw; kart.bodyYaw = p.yaw;
    kart.speed = 0; kart.vy = 0; kart.slip = 0;
    kart.drift.active = false; kart.drift.charge = 0; kart.drift.tier = 0;
    kart.boost = 0;
    /* A kart fished out of the void comes back under control: it keeps
       whatever item it was holding, but not a spin it was in when it went
       over the edge. Being punished twice for the same mistake is the
       oldest bad feeling in the genre. */
    kart.spin = 0; kart.spinAngle = 0;
    kart.falling = false; kart.respawnTimer = 0;
    var pr = T.project(track, kart.x, kart.y, kart.z, -1, kart._proj);
    kart.seg = pr.seg; kart.s = pr.s; kart.t = pr.t;
    kart.surfaceY = pr.surfaceY;
  };

  /* Steering authority as a function of speed. Zero when stationary —
     a kart that pirouettes on the spot reads as broken — rising to full
     by `steerRampTo`, then washing out at speed so the car settles. */
  function steerFactor(v) {
    var ramp = ZC.clamp01(v / TUNE.steerRampTo);
    var fade = ZC.clamp01((v - TUNE.steerFadeFrom) / (TUNE.steerFadeTo - TUNE.steerFadeFrom));
    return ramp * (1 - TUNE.steerFadeAmt * fade);
  }
  K.steerFactor = steerFactor;

  function tierFor(charge) {
    var t = 0;
    for (var i = 0; i < TUNE.driftTiers.length; i++) {
      if (charge >= TUNE.driftTiers[i]) t = i + 1;
    }
    return t;
  }
  K.tierFor = tierFor;

  /* ------------------------------------------------------------------
     One fixed step.
     ------------------------------------------------------------------ */
  K.step = function (kart, input, track, dt) {
    if (kart.finished) { kart.speed = ZC.damp(kart.speed, 0, 1.6, dt); }

    kart.raceTime += dt;

    /* ---- fallen: wait, then get fished out ---- */
    if (kart.falling) {
      kart.vy -= TUNE.gravity * dt;
      kart.y += kart.vy * dt;
      kart.x += Math.sin(kart.travelYaw) * kart.speed * dt;
      kart.z += Math.cos(kart.travelYaw) * kart.speed * dt;
      kart.speed = ZC.damp(kart.speed, 0, 0.8, dt);
      kart.respawnTimer -= dt;
      if (kart.respawnTimer <= 0) K.respawn(kart, track);
      return kart;
    }

    /* ---- spun out by an item ----
       Control is taken away, but momentum is not: a spun kart keeps
       travelling the way it was pointed, which is what makes a hit on the
       approach to a corner genuinely dangerous and a hit on a straight
       merely expensive. The shell whips round; the direction of TRAVEL is
       left alone, so the chase camera does not spin with it. */
    var spinning = kart.spin > 0;
    if (spinning) {
      kart.spin -= dt;
      kart.spinAngle += TUNE.spinRate * dt;
      if (kart.spin <= 0) {
        kart.spin = 0;
        ZC.emit('kart:spinEnd', kart);
      }
    } else if (kart.spinAngle !== 0) {
      /* unwind to zero rather than snapping, so the shell settles */
      kart.spinAngle = ZC.moveToward(kart.spinAngle, 0, TUNE.spinSteerBack * dt);
      if (Math.abs(kart.spinAngle) < 0.02) kart.spinAngle = 0;
    }

    var steer = spinning ? 0 : (input.steer || 0);
    var throttle = (kart.finished || spinning) ? 0 : (input.throttle || 0);
    var brake = (kart.finished || spinning) ? 0 : (input.brake || 0);

    /* ---- drift state ---- */
    var d = kart.drift;
    var wantDrift = !spinning && !!input.drift && kart.speed > TUNE.driftMinSpeed && kart.grounded;

    if (wantDrift && !d.active && Math.abs(steer) > 0.25) {
      d.active = true;
      d.dir = ZC.sign(steer);
      d.charge = 0;
      d.tier = 0;
      ZC.emit('kart:driftStart', kart);
    } else if (d.active && (spinning || !input.drift || kart.speed < TUNE.driftMinSpeed * 0.6)) {
      /* release: pay out the boost the slide earned */
      if (d.tier > 0) {
        kart.boost = Math.max(kart.boost, TUNE.driftBoosts[d.tier - 1]);
        ZC.emit('kart:boost', { kart: kart, tier: d.tier });
      }
      d.active = false; d.charge = 0; d.tier = 0;
    }

    /* ---- steering ---- */
    var authority = steerFactor(kart.speed);
    var yawRate;
    if (d.active) {
      /* asymmetric while sliding: you can tighten the slide hard and
         only feebly straighten it, which is what makes a drift a
         commitment rather than a free turn */
      var into = (ZC.sign(steer) === d.dir) ? TUNE.driftSteerIn : TUNE.driftSteerOut;
      var base = d.dir * 0.42 + steer * 0.58;
      yawRate = TUNE.steerMax * authority * base * into;
    } else {
      yawRate = TUNE.steerMax * authority * steer;
    }
    /* Subtracted, not added: increasing yaw turns LEFT (see
       ZC.steerToward), and positive steer is right. */
    if (kart.grounded) kart.travelYaw -= yawRate * dt;

    /* body slip: the shell yaws past the direction of travel */
    /* Same sign flip: in a right-hand drift (dir = +1) the shell points
       further right than the direction of travel, and further right is a
       lower yaw. */
    var slipTarget = d.active ? -d.dir * TUNE.driftSlip : 0;
    kart.slip = ZC.damp(kart.slip, slipTarget, TUNE.driftSlipRate, dt);
    kart.bodyYaw = kart.travelYaw + kart.slip + kart.spinAngle;

    /* charge only while genuinely sliding */
    if (d.active && Math.abs(kart.slip) > TUNE.driftSlip * 0.5 && kart.speed > TUNE.driftMinSpeed) {
      d.charge += dt;
      var nt = tierFor(d.charge);
      if (nt !== d.tier) { d.tier = nt; ZC.emit('kart:driftTier', { kart: kart, tier: nt }); }
    }

    /* ---- longitudinal ---- */
    var boosting = kart.boost > 0;
    if (boosting) kart.boost -= dt;

    var cap = kart.onRoad ? TUNE.maxSpeed : TUNE.offroadMax;
    if (boosting) cap = TUNE.boostSpeed;

    if (boosting) {
      kart.speed = ZC.moveToward(kart.speed, cap, TUNE.boostAccel * dt);
    } else if (brake > 0 && kart.speed > 0) {
      kart.speed -= TUNE.brakeDecel * brake * dt;
      if (kart.speed < TUNE.reverseSpeed) kart.speed = TUNE.reverseSpeed;
    } else if (throttle > 0) {
      if (kart.speed > cap) {
        kart.speed = ZC.moveToward(kart.speed, cap, TUNE.offroadDrag * dt);
      } else {
        /* accelerate hard from low speed, tapering as the cap nears.
           Clamped to the cap: without it the last step of the ramp
           overshoots by whatever fraction of accel*dt is left over, and
           a kart quietly sits above its own stated top speed. */
        var head = 1 - ZC.clamp01(kart.speed / Math.max(1, cap));
        kart.speed = Math.min(cap,
          kart.speed + TUNE.accel * (0.35 + 0.65 * head) * throttle * dt);
      }
    } else {
      kart.speed = ZC.moveToward(kart.speed, 0, TUNE.coastDrag * dt);
    }

    if (!kart.onRoad && kart.speed > TUNE.offroadMax && !boosting) {
      kart.speed = ZC.moveToward(kart.speed, TUNE.offroadMax, TUNE.offroadDrag * dt);
    }
    /* a slide scrubs speed — that is the cost the boost pays back */
    if (d.active) kart.speed *= Math.pow(TUNE.driftGrip, dt);

    /* ---- integrate ---- */
    kart.x += Math.sin(kart.travelYaw) * kart.speed * dt;
    kart.z += Math.cos(kart.travelYaw) * kart.speed * dt;

    /* ---- where are we on the road? ---- */
    var pr = T.project(track, kart.x, kart.y, kart.z, kart.seg, kart._proj);
    var prevS = kart.s;
    kart.seg = pr.seg;
    kart.s = pr.s;
    kart.t = pr.t;
    kart.surfaceY = pr.surfaceY;
    kart.onRoad = Math.abs(pr.t) <= 1;

    var hasGround = Math.abs(pr.t) <= TUNE.vergeLimit;

    /* ---- vertical ----

       The kart STICKS to the road within a tolerance rather than only
       landing on it. That tolerance is the whole reason this game can
       have hills.

       The obvious version — snap only when the next step would put you
       through the surface — quietly breaks on any descent. Going downhill
       the road drops away underneath a kart that is exactly on it, so it
       is above the surface every single step, never satisfies the snap,
       and free-falls the whole hill. Which would be survivable, except
       that being airborne also removes steering: `grounded` gates the yaw
       integration, so the kart flies down the slope with the controls
       disconnected. On the first circuit with real elevation the AI was
       airborne for 48% of the lap and ran off the road on every descent,
       and it looked exactly like a bad racing line rather than like
       physics.

       The tolerance scales with speed, because the faster you go the
       further the road falls away between two steps. Convex crests still
       launch a kart — that needs a rising vy, which no tolerance affects. */
    if (hasGround) {
      var snapTol = 0.3 + kart.speed * dt * 2;
      if (kart.vy <= 0 && kart.y - pr.surfaceY <= snapTol) {
        kart.y = pr.surfaceY;
        kart.vy = 0;
        kart.grounded = true;
      } else {
        kart.vy -= TUNE.gravity * dt;
        kart.y += kart.vy * dt;
        if (kart.y <= pr.surfaceY) {
          kart.y = pr.surfaceY;
          kart.vy = 0;
          kart.grounded = true;
        } else {
          kart.grounded = false;
        }
      }
    } else {
      /* over the void — nothing to stand on */
      kart.vy -= TUNE.gravity * dt;
      kart.y += kart.vy * dt;
      kart.grounded = false;
      if (kart.y < track.voidY) {
        kart.falling = true;
        kart.respawnTimer = TUNE.respawnDelay;
        kart.falls++;
        kart.drift.active = false; kart.drift.charge = 0; kart.drift.tier = 0;
        ZC.emit('kart:fell', kart);
        return kart;
      }
    }

    /* ---- checkpoints and laps ----
       Arc length alone cannot count a lap: reversing over the line would
       score one, and cutting a corner would shorten one. Requiring every
       checkpoint in order makes both impossible. */
    var cp = T.checkpointAt(track, kart.s);
    if (kart.cpNext < track.checkpoints) {
      if (cp === kart.cpNext) kart.cpNext++;
    } else if (cp === 0 && T.deltaS(track, prevS, kart.s) > -track.length * 0.5) {
      kart.lap++;
      kart.cpNext = 1;
      var lapTime = kart.raceTime - kart.lapStart;
      kart.lapStart = kart.raceTime;
      kart.lapTimes.push(lapTime);
      if (!kart.bestLap || lapTime < kart.bestLap) kart.bestLap = lapTime;
      ZC.emit('kart:lap', { kart: kart, lap: kart.lap, time: lapTime });
      if (kart.lap >= track.laps && !kart.finished) {
        kart.finished = true;
        kart.finishTime = kart.raceTime;
        ZC.emit('kart:finish', kart);
      }
    }

    kart.progress = T.progress(track, kart.lap, kart.s);
    return kart;
  };

  /* ------------------------------------------------------------------
     Item effects on a kart.

     These live here, not in items.js, because they are the only two ways
     anything outside this file may reach into a kart's physics — keeping
     them together is what stops item code growing its own private notion
     of what a boost is.
     ------------------------------------------------------------------ */

  /* Take a hit. Returns TRUE if the kart was actually spun, FALSE if an
     Aegis ate it — the caller wants to know, because a blocked hit still
     consumes the projectile and still deserves a bang. */
  K.hit = function (kart, seconds, speedKeep, source) {
    if (!kart || kart.finished || kart.falling) return false;
    if (kart.shield > 0) {
      kart.shield = 0;
      ZC.emit('kart:shieldBreak', { kart: kart, source: source });
      return false;
    }
    /* already spinning: top the timer up rather than stacking, so being
       caught in a Squall on top of a Dart is not a five-second sentence */
    kart.spin = Math.max(kart.spin, seconds === undefined ? 1.15 : seconds);
    kart.speed *= (speedKeep === undefined ? 0.34 : speedKeep);
    kart.drift.active = false; kart.drift.charge = 0; kart.drift.tier = 0;
    kart.boost = 0;
    kart.hits = (kart.hits || 0) + 1;
    ZC.emit('kart:hit', { kart: kart, source: source });
    return true;
  };

  /* Grant a boost. Never shortens one already running — collecting a
     small boost mid-drift-boost must not be a downgrade. */
  K.giveBoost = function (kart, seconds) {
    if (!kart || kart.finished) return;
    kart.boost = Math.max(kart.boost, seconds);
    ZC.emit('kart:boost', { kart: kart, tier: 0, source: 'item' });
  };

  /* Push two overlapping karts apart. Deliberately not a physical
     collision: kart racers want a nudge that never spins you, because a
     realistic impact at the back of the grid is unrecoverable and no fun. */
  K.separate = function (a, b) {
    var dx = b.x - a.x, dz = b.z - a.z;
    var d2 = dx * dx + dz * dz;
    var minD = TUNE.kartRadius * 2;
    if (d2 > minD * minD || d2 < 1e-6) return false;
    var d = Math.sqrt(d2);
    var push = (minD - d) * 0.5;
    var ux = dx / d, uz = dz / d;
    a.x -= ux * push; a.z -= uz * push;
    b.x += ux * push; b.z += uz * push;
    /* the one being leaned on loses a little speed, the leaner does not */
    if (a.speed > b.speed) b.speed *= 0.985; else a.speed *= 0.985;
    return true;
  };

  K.speedKmh = function (kart) { return Math.max(0, kart.speed) * 3.6; };

})(window);
