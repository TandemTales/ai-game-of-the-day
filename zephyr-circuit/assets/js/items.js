/* =====================================================================
   ZEPHYR CIRCUIT — items.js
   Item boxes, the roulette, projectiles and hazards.
   Owner: lead. See SPEC.md §2.5.

   Classic script: pure logic on window.ZC, unit tested headless. Knows
   nothing about three.js.

   The one idea this file is built on: **everything lives in track space,
   not world space.** A box, a hazard and a projectile are all
   (arc length `s`, normalised lateral offset `t`), and their world
   position is derived from the baked centreline whenever anyone needs to
   draw them. That buys three things for free:

     * A projectile follows the road round a corner without any steering
       logic, because "forward" is `s += v*dt`.
     * Collision is a 1D distance along `s` plus a lateral distance, which
       is O(karts x items) with a tiny constant — no spatial index, no
       broad phase.
     * Item box rows lay themselves out correctly on any circuit and stay
       on the tarmac on banked and climbing sections.

   Nothing here calls Math.random(). Seeded ZC.rand() only, so a race
   replays identically — the drift-boost leaderboard depends on it.
   ===================================================================== */
(function (global) {
  'use strict';

  var ZC = global.ZC || (global.ZC = {});
  var T = ZC.Track;
  var I = ZC.Items = {};

  /* ------------------------------------------------------------------
     Tuning
     ------------------------------------------------------------------ */
  var TUNE = I.TUNE = {
    /* Item box rows. 165m apart is roughly six seconds at racing speed —
       often enough that the item game is always live, rare enough that
       holding an item is still a decision. */
    rowSpacing:    165,
    boxesPerRow:   5,
    boxSpread:     0.62,      // outermost box at |t| = 0.62
    boxRespawn:    3.2,       // seconds before a collected box returns
    boxReach:      3.0,       // metres along s
    boxLateral:    2.4,       // metres across

    projSpeed:     44,        // m/s along the road, absolute not relative
    dartSpeed:     48,
    dartHoming:    2.6,       // how fast a dart slews across the road
    projLife:      7,
    dartLife:      9,
    hazardLife:    24,

    hitReachS:     3.4,       // metres along s for a projectile/hazard hit
    hitLateral:    2.7,       // metres across

    ownerGrace:    0.32,      // a projectile cannot hit whoever fired it
    hazardGrace:   1.1,       // nor a hazard, immediately after dropping

    spinTime:      1.15,      // seconds of lost control on a hit
    spinSpeedKeep: 0.34,      // fraction of speed retained through a spin
    squallSpin:    0.72,      // Squall is a wide net, so it stings less
    squallKeep:    0.55,

    shieldTime:    8.5,
    updraftBoost:  1.25,      // seconds, cf. drift tier 3 at 1.50
    aiUseDelay:    [0.6, 2.4] // AI thinking time before it fires, seconds
  };

  /* ------------------------------------------------------------------
     The item set.

     Six items, and each one answers a different question. An item set
     where two entries solve the same problem is one item too many.

       Gust        — something is in front of me
       Zephyr Dart — something is in front of me and it is far away
       Thunderhead — something is behind me
       Updraft     — nothing is near me and I want the gap
       Aegis       — something is behind me and it is armed
       Squall      — everything is in front of me
     ------------------------------------------------------------------ */
  var ORDER = I.ORDER = ['gust', 'dart', 'thunderhead', 'updraft', 'aegis', 'squall'];

  I.DEFS = {
    gust: {
      id: 'gust', name: 'Gust', kind: 'projectile',
      colour: 0x8fe9ff, glyph: '≈',
      blurb: 'A ribbon of hard air that runs the racing line ahead of you.'
    },
    dart: {
      id: 'dart', name: 'Zephyr Dart', kind: 'projectile',
      colour: 0xff5a6e, glyph: '➤',
      blurb: 'Locks on to the racer directly ahead and does not lose them.'
    },
    thunderhead: {
      id: 'thunderhead', name: 'Thunderhead', kind: 'hazard',
      colour: 0x9a7bd6, glyph: '☁',
      blurb: 'Dropped behind you. Sits on the road until someone finds it.'
    },
    updraft: {
      id: 'updraft', name: 'Updraft', kind: 'self',
      colour: 0xffc94a, glyph: '▲',
      blurb: 'A column of rising air. Instant speed, no charge needed.'
    },
    aegis: {
      id: 'aegis', name: 'Aegis', kind: 'self',
      colour: 0x7ee08a, glyph: '◇',
      blurb: 'A shell of still air. Turns aside one hit.'
    },
    squall: {
      id: 'squall', name: 'Squall', kind: 'field',
      colour: 0xc9d8ff, glyph: '✦',
      blurb: 'Breaks over everyone ahead of you at once. Only the desperate get one.'
    }
  };

  /* Roulette weights by finishing position, 1st at the top.

     The leader can never draw a Squall and almost never draws an Updraft;
     the tail of the field draws little else. That asymmetry IS the item
     game — without it the player in front simply stays in front and the
     other seven karts are scenery. Columns are in ORDER. */
  var WEIGHTS = I.WEIGHTS = [
    /* place 1 */ [30,  5, 40, 10, 15,  0],
    /* place 2 */ [28, 12, 30, 14, 16,  0],
    /* place 3 */ [24, 18, 22, 20, 16,  0],
    /* place 4 */ [20, 22, 16, 24, 14,  4],
    /* place 5 */ [16, 24, 12, 26, 12, 10],
    /* place 6 */ [12, 24,  8, 28, 10, 18],
    /* place 7 */ [ 8, 22,  6, 30,  8, 26],
    /* place 8 */ [ 6, 18,  4, 32,  6, 34]
  ];

  I.weightsFor = function (place) {
    var i = ZC.clamp((place | 0) - 1, 0, WEIGHTS.length - 1);
    return WEIGHTS[i];
  };

  /* Draw an item for a kart in `place`. Seeded, so a race replays. */
  I.roll = function (place) {
    var w = I.weightsFor(place);
    var total = 0, i;
    for (i = 0; i < w.length; i++) total += w[i];
    var r = ZC.rand() * total;
    for (i = 0; i < w.length; i++) {
      r -= w[i];
      if (r <= 0) return ORDER[i];
    }
    return ORDER[0];
  };

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */

  /* Box rows are laid out from the start line backwards so that the row
     nearest the line is a whole spacing away from it — nobody should be
     able to collect an item on the grid before the lights go out. */
  function layoutBoxes(track) {
    var boxes = [];
    var rows = Math.max(2, Math.floor(track.length / TUNE.rowSpacing));
    var spacing = track.length / rows;
    var n = TUNE.boxesPerRow;
    for (var r = 0; r < rows; r++) {
      var s = T.wrapS(track, spacing * (r + 0.5));
      for (var b = 0; b < n; b++) {
        /* spread evenly across the road, symmetric about the centreline */
        var t = (n === 1) ? 0 : (-1 + (2 * b) / (n - 1)) * TUNE.boxSpread;
        var p = T.pointAt(track, s, t);
        boxes.push({
          s: s, t: t, row: r,
          x: p.x, y: p.y, z: p.z,
          alive: true, timer: 0
        });
      }
    }
    return boxes;
  }

  I.createState = function (track) {
    return {
      boxes: layoutBoxes(track),
      projectiles: [],
      hazards: [],
      enabled: true,
      /* rising id so the render layer can match a mesh to a projectile
         across frames without comparing object identity */
      nextId: 1,
      _time: 0
    };
  };

  I.reset = function (state, track) {
    var fresh = I.createState(track);
    state.boxes = fresh.boxes;
    state.projectiles.length = 0;
    state.hazards.length = 0;
    state.nextId = 1;
    state._time = 0;
    return state;
  };

  /* Per-kart item fields live on the kart (kart.js owns the struct), but
     the ones only this file touches are initialised lazily here so an
     older saved kart or a hand-built test kart still works. */
  function ensure(kart) {
    if (kart.item === undefined) kart.item = null;
    if (kart.itemRoll === undefined) kart.itemRoll = 0;
    if (kart._itemHeld === undefined) kart._itemHeld = false;
    if (kart._aiItemAt === undefined) kart._aiItemAt = 0;
  }

  /* ------------------------------------------------------------------
     Firing
     ------------------------------------------------------------------ */

  /* The kart immediately ahead of `kart` on the road — the Dart's target
     and the AI's reason to fire at all. Ahead means greater `progress`,
     which is lap-aware, so the leader legitimately has nobody ahead. */
  I.kartAhead = function (kart, karts) {
    var best = null;
    for (var i = 0; i < karts.length; i++) {
      var k = karts[i];
      if (k === kart || k.finished) continue;
      if (k.progress <= kart.progress) continue;
      if (!best || k.progress < best.progress) best = k;
    }
    return best;
  };

  function spawnProjectile(state, track, kart, def, target) {
    var s = T.wrapS(track, kart.s + 3.5);
    var p = T.pointAt(track, s, kart.t);
    var proj = {
      id: state.nextId++,
      kind: def.id,
      owner: kart.id,
      s: s, t: kart.t,
      x: p.x, y: p.y, z: p.z,
      speed: def.id === 'dart' ? TUNE.dartSpeed : TUNE.projSpeed,
      life: def.id === 'dart' ? TUNE.dartLife : TUNE.projLife,
      age: 0,
      targetId: target ? target.id : null
    };
    state.projectiles.push(proj);
    return proj;
  }

  function spawnHazard(state, track, kart, def) {
    var s = T.wrapS(track, kart.s - 5);
    var p = T.pointAt(track, s, kart.t);
    var hz = {
      id: state.nextId++,
      kind: def.id,
      owner: kart.id,
      s: s, t: kart.t,
      x: p.x, y: p.y, z: p.z,
      life: TUNE.hazardLife,
      age: 0
    };
    state.hazards.push(hz);
    return hz;
  }

  /* Fire whatever the kart is holding. Returns the item id used, or null.
     `karts` is the whole field — Dart and Squall both need it. */
  I.use = function (state, kart, karts, track) {
    ensure(kart);
    if (!state.enabled) return null;
    if (!kart.item || kart.spin > 0 || kart.falling || kart.finished) return null;

    var def = I.DEFS[kart.item];
    if (!def) { kart.item = null; return null; }
    var id = def.id;
    kart.item = null;

    if (id === 'updraft') {
      ZC.Kart.giveBoost(kart, TUNE.updraftBoost);
    } else if (id === 'aegis') {
      kart.shield = TUNE.shieldTime;
    } else if (id === 'thunderhead') {
      spawnHazard(state, track, kart, def);
    } else if (id === 'squall') {
      /* Everyone ahead, all at once. Deliberately not "everyone else":
         a Squall thrown from the back should not also punish the kart
         you just overtook. */
      for (var i = 0; i < karts.length; i++) {
        var k = karts[i];
        if (k === kart || k.finished) continue;
        if (k.progress <= kart.progress) continue;
        ZC.Kart.hit(k, TUNE.squallSpin, TUNE.squallKeep, 'squall');
      }
    } else {
      spawnProjectile(state, track, kart, def,
        id === 'dart' ? I.kartAhead(kart, karts) : null);
    }

    ZC.emit('item:use', { kart: kart, item: id });
    return id;
  };

  /* ------------------------------------------------------------------
     AI item play.

     This lives here rather than in ai.js on purpose: the driving brain
     should stay a pure line-and-braking problem, and an item decision is
     a completely different question asked at a completely different
     rate. Keeping them apart is what stops the driver getting worse
     every time the item set changes.
     ------------------------------------------------------------------ */
  function aiShouldUse(state, kart, karts, time) {
    if (!kart.item) return false;
    var id = kart.item;

    /* a deliberate beat of hesitation, so a field of eight does not fire
       in perfect unison the instant it collects */
    if (time < kart._aiItemAt) return false;

    if (id === 'updraft') {
      /* spend it where it pays: on the straight, at speed, not while
         already boosting or sideways */
      return kart.boost <= 0 && !kart.drift.active &&
        kart.speed > ZC.Kart.TUNE.maxSpeed * 0.72 && kart.onRoad;
    }
    if (id === 'aegis') {
      /* hold a shield until someone is close enough behind to be a
         threat — a shield fired at nothing is a wasted item */
      for (var i = 0; i < karts.length; i++) {
        var k = karts[i];
        if (k === kart || k.finished) continue;
        var gap = kart.progress - k.progress;
        if (gap > 0 && gap < 26) return true;
      }
      return false;
    }
    if (id === 'thunderhead') {
      for (var j = 0; j < karts.length; j++) {
        var b = karts[j];
        if (b === kart || b.finished) continue;
        var d = kart.progress - b.progress;
        if (d > 0 && d < 40) return true;
      }
      return false;
    }
    if (id === 'squall') return true;

    /* gust and dart: only worth firing if there is anyone to hit */
    var ahead = I.kartAhead(kart, karts);
    if (!ahead) return false;
    var lead = ahead.progress - kart.progress;
    if (id === 'dart') return lead < 160;
    /* a Gust runs the line, so it wants a target that is close and
       roughly on the same part of the road */
    return lead < 70 && Math.abs(ahead.t - kart.t) < 0.85;
  }

  /* ------------------------------------------------------------------
     Collision — a 1D gap along the road plus a lateral distance.
     ------------------------------------------------------------------ */
  function overlaps(track, s, t, kart, reachS, lateral) {
    var ds = T.deltaS(track, s, kart.s);
    if (ds > reachS || ds < -reachS) return false;
    var fr = T.frameAt(track, s, _frame);
    var dLat = (kart.t - t) * fr.halfWidth;
    return dLat < lateral && dLat > -lateral;
  }
  var _frame = {};

  /* ------------------------------------------------------------------
     One fixed step.

     Called from race.js after the karts have moved, at the same fixed
     120Hz as the physics — item timers are gameplay, and a variable
     timestep would make a shield last longer on a fast machine.
     ------------------------------------------------------------------ */
  I.step = function (state, karts, track, dt, time) {
    if (!state || !state.enabled) return;
    var i, j, k;
    state._time += dt;
    if (time === undefined) time = state._time;

    /* ---- per-kart timers ---- */
    for (i = 0; i < karts.length; i++) {
      k = karts[i];
      ensure(k);
      if (k.shield > 0) {
        k.shield -= dt;
        if (k.shield <= 0) { k.shield = 0; ZC.emit('item:shieldEnd', k); }
      }
      if (k.itemRoll > 0) {
        /* the roulette spins for a moment before it settles — that pause
           is where all the tension in an item pickup lives */
        k.itemRoll -= dt;
        if (k.itemRoll <= 0) {
          k.itemRoll = 0;
          k.item = I.roll(k.place);
          k._aiItemAt = time + ZC.randRange(TUNE.aiUseDelay[0], TUNE.aiUseDelay[1]);
          ZC.emit('item:settled', { kart: k, item: k.item });
        }
      }
    }

    /* ---- boxes ---- */
    for (i = 0; i < state.boxes.length; i++) {
      var box = state.boxes[i];
      if (!box.alive) {
        box.timer -= dt;
        if (box.timer <= 0) { box.alive = true; ZC.emit('item:boxReturn', box); }
        continue;
      }
      for (j = 0; j < karts.length; j++) {
        k = karts[j];
        if (k.falling || k.finished) continue;
        /* one item at a time: a hold-two design turns the last lap into
           a stockpile fight and doubles the HUD's job */
        if (k.item || k.itemRoll > 0) continue;
        if (!overlaps(track, box.s, box.t, k, TUNE.boxReach, TUNE.boxLateral)) continue;
        box.alive = false;
        box.timer = TUNE.boxRespawn;
        k.itemRoll = 0.9;
        ZC.emit('item:pickup', { kart: k, box: box });
        break;
      }
    }

    /* ---- projectiles ---- */
    for (i = state.projectiles.length - 1; i >= 0; i--) {
      var p = state.projectiles[i];
      p.age += dt;
      p.life -= dt;
      p.s = T.wrapS(track, p.s + p.speed * dt);

      if (p.kind === 'dart' && p.targetId) {
        /* slew across the road toward the target's line. A dart that
           tracked `s` as well would be unavoidable and no fun; tracking
           only the lateral line means it can still be shaken by being
           somewhere it is not looking. */
        for (j = 0; j < karts.length; j++) {
          if (karts[j].id !== p.targetId) continue;
          p.t = ZC.moveToward(p.t, karts[j].t, TUNE.dartHoming * dt);
          break;
        }
      }

      var pp = T.pointAt(track, p.s, p.t);
      p.x = pp.x; p.y = pp.y + 0.9; p.z = pp.z;

      if (p.life <= 0) {
        state.projectiles.splice(i, 1);
        ZC.emit('item:expire', p);
        continue;
      }

      for (j = 0; j < karts.length; j++) {
        k = karts[j];
        if (k.falling || k.finished) continue;
        if (k.id === p.owner && p.age < TUNE.ownerGrace) continue;
        if (!overlaps(track, p.s, p.t, k, TUNE.hitReachS, TUNE.hitLateral)) continue;
        var blocked = !ZC.Kart.hit(k, TUNE.spinTime, TUNE.spinSpeedKeep, p.kind);
        ZC.emit('item:hit', { kart: k, kind: p.kind, blocked: blocked, x: p.x, y: p.y, z: p.z });
        state.projectiles.splice(i, 1);
        break;
      }
    }

    /* ---- hazards ---- */
    for (i = state.hazards.length - 1; i >= 0; i--) {
      var h = state.hazards[i];
      h.age += dt;
      h.life -= dt;
      if (h.life <= 0) { state.hazards.splice(i, 1); ZC.emit('item:expire', h); continue; }

      for (j = 0; j < karts.length; j++) {
        k = karts[j];
        if (k.falling || k.finished) continue;
        if (k.id === h.owner && h.age < TUNE.hazardGrace) continue;
        if (!overlaps(track, h.s, h.t, k, TUNE.hitReachS, TUNE.hitLateral)) continue;
        var stopped = !ZC.Kart.hit(k, TUNE.spinTime, TUNE.spinSpeedKeep, h.kind);
        ZC.emit('item:hit', { kart: k, kind: h.kind, blocked: stopped, x: h.x, y: h.y, z: h.z });
        state.hazards.splice(i, 1);
        break;
      }
    }
  };

  /* Ask the AI karts whether they want to fire. Separate from step() so
     race.js can drive the player from real input in the same place. */
  I.aiStep = function (state, karts, track, time, isAI) {
    if (!state || !state.enabled) return;
    for (var i = 0; i < karts.length; i++) {
      var k = karts[i];
      if (isAI && !isAI(k, i)) continue;
      if (k.finished || k.falling || k.spin > 0) continue;
      ensure(k);
      if (aiShouldUse(state, k, karts, time)) I.use(state, k, karts, track);
    }
  };

  /* Player input is a level, not an edge: hold the button and you would
     empty the slot the moment it refilled. */
  I.playerStep = function (state, kart, karts, track, pressed) {
    if (!state || !state.enabled || !kart) return null;
    ensure(kart);
    var used = null;
    if (pressed && !kart._itemHeld) used = I.use(state, kart, karts, track);
    kart._itemHeld = !!pressed;
    return used;
  };

})(window);
