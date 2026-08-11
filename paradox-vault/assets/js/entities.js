/* =====================================================================
   PARADOX VAULT — entities.js
   Deterministic, fixed-step simulation of actors and vault devices.
   Owner: lead. See SPEC.md §8.

   DETERMINISM CONTRACT
   Everything in this file that runs inside fixedUpdate() must be a pure
   function of (previous state, recorded input, tick). No Math.random, no
   performance.now, no dt other than PV.FIXED_DT. Echo playback depends on it.
   Cosmetic-only fields are prefixed `fx` and may use wall-clock time.
   ===================================================================== */
(function (global) {
  'use strict';
  var PV = global.PV;
  var T = PV.TILE;
  var FD = PV.FIXED_DT;

  /* ------------------------------------------------------------------
     Tuning
     ------------------------------------------------------------------ */
  var TUNE = {
    accel: 46,          // tiles/s^2
    maxSpeed: 6.4,      // tiles/s
    friction: 22,
    carrySpeedMul: 0.86,
    radius: 0.30,       // tiles
    dashSpeed: 13.5,
    dashTime: 0.16,
    dashCooldown: 0.85,
    mirrorRadius: 0.40,
    mirrorPush: 3.2,
    interactRange: 1.15,
    alertRise: 0.55,    // per second fully-seen
    alertFall: 0.32,
    lightRadiusBase: 2.2,
    lightRadiusCarry: 3.4
  };
  PV.TUNE = TUNE;

  /* ------------------------------------------------------------------
     Tile queries
     ------------------------------------------------------------------ */
  function tileAt(vault, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= vault.w || ty >= vault.h) return PV.Levels.TERRAIN[' '];
    return vault.grid[ty * vault.w + tx];
  }
  function solidAt(world, tx, ty) {
    var t = tileAt(world.vault, tx, ty);
    if (t.solid) return true;
    /* closed doors are solid */
    var d = world.doorAt[ty * world.vault.w + tx];
    if (d && !d.open) return true;
    return false;
  }
  function opaqueAt(world, tx, ty) {
    var t = tileAt(world.vault, tx, ty);
    if (t.isVoid) return true;
    if (t.solid && !t.seeThrough) return true;
    var d = world.doorAt[ty * world.vault.w + tx];
    if (d && !d.open) return true;
    return false;
  }
  function surfaceAt(vault, x, y) {
    var t = tileAt(vault, Math.floor(x), Math.floor(y));
    return t.surface || 'hard';
  }
  PV.tileAt = tileAt;
  PV.solidAt = solidAt;
  PV.opaqueAt = opaqueAt;
  PV.surfaceAt = surfaceAt;

  /* Circle vs solid tiles, axis separated. Returns true if it touched. */
  function collideTiles(world, a) {
    var r = a.radius, hit = false;
    var minX, maxX, minY, maxY, tx, ty;

    /* X axis */
    minY = Math.floor(a.y - r); maxY = Math.floor(a.y + r);
    minX = Math.floor(a.x - r); maxX = Math.floor(a.x + r);
    for (ty = minY; ty <= maxY; ty++) {
      for (tx = minX; tx <= maxX; tx++) {
        if (!solidAt(world, tx, ty)) continue;
        var cx = PV.clamp(a.x, tx, tx + 1);
        var cy = PV.clamp(a.y, ty, ty + 1);
        var dx = a.x - cx, dy = a.y - cy;
        var d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        var d = Math.sqrt(d2);
        if (d < 1e-6) {
          /* dead centre inside a tile — push out along the shallowest axis */
          var toL = a.x - tx, toR = tx + 1 - a.x, toT = a.y - ty, toB = ty + 1 - a.y;
          var m = Math.min(toL, toR, toT, toB);
          if (m === toL) a.x = tx - r; else if (m === toR) a.x = tx + 1 + r;
          else if (m === toT) a.y = ty - r; else a.y = ty + 1 + r;
        } else {
          var push = (r - d) / d;
          a.x += dx * push; a.y += dy * push;
          /* kill velocity into the surface */
          var nx = dx / d, ny = dy / d;
          var vn = a.vx * nx + a.vy * ny;
          if (vn < 0) { a.vx -= nx * vn; a.vy -= ny * vn; }
        }
        hit = true;
      }
    }
    return hit;
  }

  /* ------------------------------------------------------------------
     Actor — the player and every echo share this movement code so that
     replaying identical inputs reproduces identical motion.
     ------------------------------------------------------------------ */
  function Actor(x, y, isEcho, index) {
    this.x = x; this.y = y;
    this.spawnX = x; this.spawnY = y;
    this.vx = 0; this.vy = 0;
    this.radius = TUNE.radius;
    this.facing = -Math.PI / 2;
    this.isEcho = !!isEcho;
    this.index = index | 0;
    this.alive = true;
    this.active = true;         // echoes deactivate once their tape runs out
    this.carrying = null;       // relic ref
    this.dashT = 0;
    this.dashCd = 0;
    this.interacting = false;
    this.holdTarget = null;
    this.desync = 0;            // 0..1 how far off-script this echo has drifted
    this.stepAccum = 0;
    this.speedMul = 1;
    /* Distance-driven gait phase. Distance rather than time so the walk cycle
       stays in step with the feet at every speed, and it stays deterministic. */
    this.gait = 0;
    /* cosmetic */
    this.fxBob = 0;
    this.fxTrail = [];
    this.fxSpawnT = 0;
  }

  Actor.prototype.reset = function () {
    this.x = this.spawnX; this.y = this.spawnY;
    this.vx = this.vy = 0;
    this.alive = true; this.active = true;
    this.carrying = null;
    this.dashT = this.dashCd = 0;
    this.desync = 0; this.stepAccum = 0; this.gait = 0;
    this.fxTrail.length = 0;
    this.fxSpawnT = 0;
    this.facing = -Math.PI / 2;
  };

  /* inp: {x, y, action, dash} — already normalized */
  Actor.prototype.step = function (world, inp) {
    if (!this.alive || !this.active) return;

    var ax = inp.x, ay = inp.y;
    var mag = PV.len(ax, ay);
    if (mag > 1) { ax /= mag; ay /= mag; mag = 1; }

    this.speedMul = this.carrying ? (this.carrying.heavy ? 0.78 : TUNE.carrySpeedMul) : 1;

    /* dash */
    if (this.dashCd > 0) this.dashCd -= FD;
    if (this.dashT > 0) {
      this.dashT -= FD;
    } else if (inp.dash && this.dashCd <= 0 && mag > 0.2 && !this.carrying) {
      this.dashT = TUNE.dashTime;
      this.dashCd = TUNE.dashCooldown;
      this.vx = ax * TUNE.dashSpeed;
      this.vy = ay * TUNE.dashSpeed;
      if (!this.isEcho) PV.emit('player:dash', { x: this.x, y: this.y, dx: ax, dy: ay });
    }

    if (this.dashT <= 0) {
      var maxS = TUNE.maxSpeed * this.speedMul;
      if (mag > 0.001) {
        this.vx += ax * TUNE.accel * FD;
        this.vy += ay * TUNE.accel * FD;
        var sp = PV.len(this.vx, this.vy);
        if (sp > maxS) { this.vx = this.vx / sp * maxS; this.vy = this.vy / sp * maxS; }
        this.facing = Math.atan2(ay, ax);
      } else {
        var f = Math.max(0, 1 - TUNE.friction * FD);
        this.vx *= f; this.vy *= f;
        if (Math.abs(this.vx) < 0.02) this.vx = 0;
        if (Math.abs(this.vy) < 0.02) this.vy = 0;
      }
    }

    /* vents */
    for (var i = 0; i < world.vents.length; i++) {
      var v = world.vents[i];
      if (!v.on) continue;
      var dvx = this.x - v.x, dvy = this.y - v.y;
      var dd = PV.len(dvx, dvy);
      if (dd < v.reach) {
        var fall = 1 - dd / v.reach;
        this.vx += v.dx * v.power * fall * 18 * FD;
        this.vy += v.dy * v.power * fall * 18 * FD;
      }
    }

    var px = this.x, py = this.y;
    this.x += this.vx * FD;
    this.y += this.vy * FD;

    /* pushable mirrors */
    for (var m = 0; m < world.mirrors.length; m++) {
      var mi = world.mirrors[m];
      var mdx = mi.x - this.x, mdy = mi.y - this.y;
      var md = PV.len(mdx, mdy);
      var minD = this.radius + mi.radius;
      if (md < minD && md > 1e-6) {
        var over = (minD - md);
        var nx = mdx / md, ny = mdy / md;
        /* push the mirror, and slide the actor */
        mi.x += nx * over * 0.85;
        mi.y += ny * over * 0.85;
        collideTiles(world, mi);
        this.x -= nx * over * 0.35;
        this.y -= ny * over * 0.35;
        mi.fxPush = 1;
      }
    }

    collideTiles(world, this);

    /* footsteps (cosmetic but ticked deterministically) */
    var moved = PV.dist(px, py, this.x, this.y);
    this.gait += moved * 5.1;
    this.stepAccum += moved;
    if (this.stepAccum > 0.62) {
      this.stepAccum = 0;
      if (!this.isEcho) {
        PV.emit('player:step', { x: this.x, y: this.y, surface: surfaceAt(world.vault, this.x, this.y) });
      }
      if (world.onStep) world.onStep(this);
    }
  };

  /* ------------------------------------------------------------------
     Echo — an Actor driven by a recorded input tape
     ------------------------------------------------------------------ */
  function Echo(rec, spawnX, spawnY, index) {
    Actor.call(this, spawnX, spawnY, true, index);
    this.rec = rec;                 // Recording
    this.tick = 0;
    this.expected = null;           // recorded position, for desync detection
  }
  Echo.prototype = Object.create(Actor.prototype);
  Echo.prototype.constructor = Echo;

  Echo.prototype.reset = function () {
    Actor.prototype.reset.call(this);
    this.tick = 0;
  };

  var _inp = { x: 0, y: 0, action: false, dash: false };

  Echo.prototype.advance = function (world) {
    if (this.tick >= this.rec.length) {
      this.active = false;
      this.vx = this.vy = 0;
      return;
    }
    this.rec.read(this.tick, _inp);
    this.step(world, _inp);
    this.interacting = _inp.action;

    /* desync: how far from the recorded path are we? */
    var ex = this.rec.px[this.tick] / 256, ey = this.rec.py[this.tick] / 256;
    var drift = PV.dist(this.x, this.y, ex, ey);
    var target = PV.clamp((drift - 0.35) / 1.4, 0, 1);
    if (target > this.desync) {
      var was = this.desync;
      this.desync = Math.min(1, this.desync + FD * 2.2);
      if (was < 0.5 && this.desync >= 0.5) PV.emit('echo:desync', { x: this.x, y: this.y });
    } else {
      this.desync = Math.max(target, this.desync - FD * 0.5);
    }

    this.tick++;
  };

  /* ------------------------------------------------------------------
     Recording — compact input tape + a position track for desync checks
     ------------------------------------------------------------------ */
  function Recording(maxTicks) {
    this.cap = maxTicks;
    this.length = 0;
    this.ix = new Int8Array(maxTicks);
    this.iy = new Int8Array(maxTicks);
    this.ib = new Uint8Array(maxTicks);
    this.px = new Int32Array(maxTicks);   // world tiles * 256
    this.py = new Int32Array(maxTicks);
  }
  Recording.prototype.write = function (t, x, y, action, dash, wx, wy) {
    if (t >= this.cap) return;
    this.ix[t] = Math.round(PV.clamp(x, -1, 1) * 127);
    this.iy[t] = Math.round(PV.clamp(y, -1, 1) * 127);
    this.ib[t] = (action ? 1 : 0) | (dash ? 2 : 0);
    this.px[t] = Math.round(wx * 256);
    this.py[t] = Math.round(wy * 256);
    if (t + 1 > this.length) this.length = t + 1;
  };
  Recording.prototype.read = function (t, out) {
    out.x = this.ix[t] / 127;
    out.y = this.iy[t] / 127;
    out.action = (this.ib[t] & 1) !== 0;
    out.dash = (this.ib[t] & 2) !== 0;
    return out;
  };

  /* ------------------------------------------------------------------
     Devices
     ------------------------------------------------------------------ */
  function Plate(o) {
    this.t = 'plate'; this.x = o.x; this.y = o.y; this.sig = o.sig;
    this.r = 0.55; this.on = false; this.fxPress = 0;
  }
  Plate.prototype.update = function (world) {
    var on = false;
    var A = world.allActors;
    for (var i = 0; i < A.length; i++) {
      var a = A[i];
      if (!a.alive || !a.active) continue;
      if (PV.dist2(a.x, a.y, this.x, this.y) < this.r * this.r) { on = true; break; }
    }
    if (on !== this.on) {
      this.on = on;
      PV.emit(on ? 'device:activate' : 'device:deactivate', { kind: 'plate', x: this.x, y: this.y });
    }
    world.signals[this.sig] = world.signals[this.sig] || on;
  };

  function Lever(o) {
    this.t = 'lever'; this.x = o.x; this.y = o.y; this.sig = o.sig;
    this.on = !!o.start; this.cool = 0;
  }
  Lever.prototype.update = function (world) {
    if (this.cool > 0) this.cool -= FD;
    var A = world.allActors;
    for (var i = 0; i < A.length; i++) {
      var a = A[i];
      if (!a.alive || !a.active || !a.interacting) continue;
      if (PV.dist2(a.x, a.y, this.x, this.y) < TUNE.interactRange * TUNE.interactRange && this.cool <= 0) {
        this.on = !this.on; this.cool = 0.4;
        PV.emit(this.on ? 'device:activate' : 'device:deactivate', { kind: 'lever', x: this.x, y: this.y });
        break;
      }
    }
    if (this.on) world.signals[this.sig] = true;
  };

  function Terminal(o) {
    this.t = 'terminal'; this.x = o.x; this.y = o.y; this.sig = o.sig;
    this.hold = o.hold || 3.0; this.face = o.face || 'down';
    this.progress = 0; this.on = false; this.busy = false; this.fxBeep = 0;
  }
  Terminal.prototype.update = function (world) {
    var A = world.allActors, working = false;
    for (var i = 0; i < A.length; i++) {
      var a = A[i];
      if (!a.alive || !a.active || !a.interacting) continue;
      if (PV.dist2(a.x, a.y, this.x, this.y) < 1.35 * 1.35) { working = true; break; }
    }
    this.busy = working;
    var wasOn = this.on;
    if (working) {
      this.progress = Math.min(this.hold, this.progress + FD);
    } else {
      this.progress = Math.max(0, this.progress - FD * 1.8);
    }
    this.on = this.progress >= this.hold;
    if (this.on) world.signals[this.sig] = true;
    if (this.on !== wasOn) {
      PV.emit(this.on ? 'device:activate' : 'device:deactivate', { kind: 'terminal', x: this.x, y: this.y });
    }
  };

  function Receiver(o) {
    this.t = 'receiver'; this.x = o.x; this.y = o.y; this.sig = o.sig;
    this.face = o.face || 'down'; this.on = false; this.charge = 0;
  }
  Receiver.prototype.update = function (world) {
    var was = this.on;
    this.on = this.lit === true;
    this.charge = PV.damp(this.charge, this.on ? 1 : 0, 10, FD);
    if (this.on) world.signals[this.sig] = true;
    if (this.on !== was) PV.emit(this.on ? 'device:activate' : 'device:deactivate', { kind: 'receiver', x: this.x, y: this.y });
    this.lit = false;
  };

  function Door(o, vault) {
    this.t = 'door'; this.x = o.x; this.y = o.y;
    this.axis = o.axis || 'h';   // 'h' = spans horizontally, 'v' = spans vertically
    this.span = o.span || 1;
    this.sig = o.sig;
    this.open = false; this.anim = 0;
    this.tiles = [];
    for (var i = 0; i < this.span; i++) {
      var tx = this.axis === 'h' ? (this.x + i) : this.x;
      var ty = this.axis === 'h' ? this.y : (this.y + i);
      this.tiles.push({ x: tx, y: ty });
    }
  }
  Door.prototype.update = function (world) {
    var want = PV.Levels.evalSignal(this.sig, world.signals);
    if (want !== this.open) {
      this.open = want;
      PV.emit(want ? 'device:activate' : 'device:deactivate', { kind: 'door', x: this.x + 0.5, y: this.y + 0.5 });
    }
    this.anim = PV.damp(this.anim, this.open ? 1 : 0, 11, FD);
  };

  function Laser(o) {
    this.t = 'laser'; this.x = o.x; this.y = o.y;
    this.dir = o.dir; this.len = o.len || 8;
    this.sig = o.sig || null;            // optional gate: beam is on when sig true
    this.blink = o.blink || null;        // [onSec, offSec, phaseSec]
    this.beamKind = o.beamKind || 'lethal';
    this.on = true; this.time = 0;
    this.path = [];                      // [{x1,y1,x2,y2}] in tile units
    var D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[o.dir] || [1, 0];
    this.dx = D[0]; this.dy = D[1];
  }
  Laser.prototype.update = function (world) {
    this.time += FD;
    var on = true;
    if (this.blink) {
      var period = this.blink[0] + this.blink[1];
      var p = (this.time + this.blink[2]) % period;
      on = p < this.blink[0];
    }
    if (this.sig) on = on && PV.Levels.evalSignal(this.sig, world.signals);
    if (on !== this.on) {
      this.on = on;
      PV.emit(on ? 'device:activate' : 'device:deactivate', { kind: 'laser', x: this.x + 0.5, y: this.y + 0.5 });
    }
    this.path.length = 0;
    if (!on) return;

    /* march the beam in small steps, reflecting off mirrors */
    var cx = this.x + 0.5 + this.dx * 0.5;
    var cy = this.y + 0.5 + this.dy * 0.5;
    var dx = this.dx, dy = this.dy;
    var segX = cx, segY = cy;
    var STEP = 0.12;
    var travelled = 0, maxTravel = this.len + 24;
    var bounces = 0;

    while (travelled < maxTravel && bounces < 6) {
      cx += dx * STEP; cy += dy * STEP; travelled += STEP;

      var tx = Math.floor(cx), ty = Math.floor(cy);
      if (tx < 0 || ty < 0 || tx >= world.vault.w || ty >= world.vault.h) break;
      var tile = tileAt(world.vault, tx, ty);
      var blockedByDoor = false;
      var dd = world.doorAt[ty * world.vault.w + tx];
      if (dd && !dd.open) blockedByDoor = true;
      if ((tile.solid && !tile.lightThrough) || blockedByDoor) break;

      /* mirror hit? */
      var reflected = false;
      for (var m = 0; m < world.mirrors.length; m++) {
        var mi = world.mirrors[m];
        if (PV.dist2(cx, cy, mi.x, mi.y) < mi.radius * mi.radius) {
          this.path.push({ x1: segX, y1: segY, x2: mi.x, y2: mi.y });
          /* '/' maps (dx,dy) -> (-dy,-dx);  '\' maps -> (dy,dx) */
          var ndx, ndy;
          if (mi.ori === '/') { ndx = -dy; ndy = -dx; } else { ndx = dy; ndy = dx; }
          dx = ndx; dy = ndy;
          cx = mi.x + dx * (mi.radius + 0.06);
          cy = mi.y + dy * (mi.radius + 0.06);
          segX = cx; segY = cy;
          mi.fxHit = 1;
          bounces++;
          reflected = true;
          break;
        }
      }
      if (reflected) continue;

      /* receiver hit? */
      for (var r = 0; r < world.receivers.length; r++) {
        var rc = world.receivers[r];
        if (PV.dist2(cx, cy, rc.x, rc.y) < 0.42 * 0.42) { rc.lit = true; }
      }
    }
    this.path.push({ x1: segX, y1: segY, x2: cx, y2: cy });
  };
  Laser.prototype.hits = function (ax, ay, ar) {
    if (!this.on) return false;
    for (var i = 0; i < this.path.length; i++) {
      var s = this.path[i];
      if (segCircle(s.x1, s.y1, s.x2, s.y2, ax, ay, ar + 0.05)) return true;
    }
    return false;
  };

  function segCircle(x1, y1, x2, y2, cx, cy, r) {
    var dx = x2 - x1, dy = y2 - y1;
    var l2 = dx * dx + dy * dy;
    var t = l2 > 1e-9 ? PV.clamp(((cx - x1) * dx + (cy - y1) * dy) / l2, 0, 1) : 0;
    var px = x1 + dx * t, py = y1 + dy * t;
    return PV.dist2(px, py, cx, cy) <= r * r;
  }

  function Mirror(o) {
    this.t = 'mirror'; this.x = o.x; this.y = o.y;
    this.radius = TUNE.mirrorRadius;
    this.ori = o.ori || '/';
    this.vx = 0; this.vy = 0;
    this.homeX = o.x; this.homeY = o.y;
    this.fxHit = 0; this.fxPush = 0;
  }

  function Vent(o) {
    this.t = 'vent'; this.x = o.x; this.y = o.y;
    var D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[o.dir] || [0, 1];
    this.dx = D[0]; this.dy = D[1];
    this.power = o.power || 1; this.reach = 3.2; this.on = true;
    this.sig = o.sig || null; this.time = 0;
  }
  Vent.prototype.update = function (world) {
    this.time += FD;
    this.on = this.sig ? PV.Levels.evalSignal(this.sig, world.signals) : true;
  };

  function Relic(o, i) {
    this.t = 'relic'; this.x = o.x; this.y = o.y;
    this.homeX = o.x; this.homeY = o.y;
    this.kind = o.kind || 'orb';
    this.value = o.value || 1;
    this.heavy = !!o.heavy;
    this.name = o.name || null;
    this.id = i;
    this.held = null;   // actor
    this.banked = false;
    this.fxSpin = 0;
  }
  Relic.prototype.reset = function () {
    this.x = this.homeX; this.y = this.homeY;
    this.held = null; this.banked = false;
  };

  function Sentry(o) {
    this.t = 'sentry';
    this.route = o.route.slice();
    this.x = o.x; this.y = o.y;
    this.spawnX = o.x; this.spawnY = o.y;
    this.speed = o.speed || 2.4;
    this.cone = { range: o.cone.range, angle: o.cone.angle };
    this.leg = 0; this.dirAngle = 0;
    this.radius = 0.34;
    this.suspicion = 0;
    this.sawAt = null;
    this.pauseT = 0;
    this.fxScan = 0;
  }
  Sentry.prototype.reset = function () {
    this.x = this.spawnX; this.y = this.spawnY;
    this.leg = 0; this.suspicion = 0; this.sawAt = null; this.pauseT = 0;
  };
  Sentry.prototype.update = function (world) {
    /* patrol */
    if (this.pauseT > 0) {
      this.pauseT -= FD;
    } else {
      var target = this.route[(this.leg + 1) % this.route.length];
      var dx = target[0] - this.x, dy = target[1] - this.y;
      var d = PV.len(dx, dy);
      if (d < 0.09) {
        this.leg = (this.leg + 1) % this.route.length;
        this.pauseT = 0.55;
      } else {
        var sp = this.speed * (this.suspicion > 0.35 ? 1.35 : 1);
        var mv = Math.min(d, sp * FD);
        this.x += dx / d * mv; this.y += dy / d * mv;
        this.dirAngle = PV.angleLerp(this.dirAngle, Math.atan2(dy, dx), 1 - Math.exp(-10 * FD));
      }
    }
    /* sweep the head slightly while paused so cones feel alive */
    if (this.pauseT > 0) this.dirAngle += Math.sin(world.tick * FD * 2.4 + this.spawnX) * 0.012;

    /* vision */
    var seen = 0, seenAt = null;
    var A = world.allActors;
    for (var i = 0; i < A.length; i++) {
      var a = A[i];
      if (!a.alive || !a.active) continue;
      var vis = this.canSee(world, a);
      if (vis > seen) { seen = vis; seenAt = a; }
    }
    if (seen > 0) {
      this.suspicion = Math.min(1, this.suspicion + TUNE.alertRise * seen * FD * 2.2);
      this.sawAt = seenAt;
      if (this.suspicion > 0.55 && !this._pinged) {
        this._pinged = true;
        PV.emit('sentry:spot', { x: this.x, y: this.y });
      }
    } else {
      this.suspicion = Math.max(0, this.suspicion - TUNE.alertFall * FD);
      if (this.suspicion < 0.2) this._pinged = false;
    }
    world.alertTarget = Math.max(world.alertTarget, this.suspicion);
  };
  Sentry.prototype.canSee = function (world, a) {
    var dx = a.x - this.x, dy = a.y - this.y;
    var d = PV.len(dx, dy);
    var reach = this.cone.range * (a.carrying ? 1.25 : 1) * (a.isEcho ? 0.88 : 1);
    if (d > reach || d < 1e-4) return 0;
    var ang = Math.atan2(dy, dx);
    var diff = Math.abs(((ang - this.dirAngle + Math.PI * 3) % PV.TAU) - Math.PI);
    var half = this.cone.angle;
    if (diff > half) {
      /* close-range "hearing" bubble */
      if (d < 1.5) return 0.6;
      return 0;
    }
    if (!lineOfSight(world, this.x, this.y, a.x, a.y)) return 0;
    var edge = 1 - PV.smoothstep(half * 0.65, half, diff);
    var falloff = 1 - PV.smoothstep(reach * 0.6, reach, d);
    return PV.clamp(0.35 + 0.65 * edge * falloff, 0, 1);
  };

  function lineOfSight(world, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var d = PV.len(dx, dy);
    var steps = Math.ceil(d / 0.28);
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      var px = x1 + dx * t, py = y1 + dy * t;
      if (opaqueAt(world, Math.floor(px), Math.floor(py))) return false;
    }
    return true;
  }
  PV.lineOfSight = lineOfSight;

  function Exit(o) {
    this.t = 'exit'; this.x = o.x; this.y = o.y; this.w = o.w || 2; this.h = o.h || 2;
    this.cx = o.x + this.w / 2; this.cy = o.y + this.h / 2;
    this.fxPulse = 0;
  }
  Exit.prototype.contains = function (a) {
    return a.x > this.x && a.x < this.x + this.w && a.y > this.y && a.y < this.y + this.h;
  };

  PV.Entities = {
    Actor: Actor, Echo: Echo, Recording: Recording,
    Plate: Plate, Lever: Lever, Terminal: Terminal, Receiver: Receiver,
    Door: Door, Laser: Laser, Mirror: Mirror, Vent: Vent,
    Relic: Relic, Sentry: Sentry, Exit: Exit,
    collideTiles: collideTiles,
    segCircle: segCircle,
    TUNE: TUNE
  };

})(window);
