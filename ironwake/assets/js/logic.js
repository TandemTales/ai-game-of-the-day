(function (root) {
  'use strict';
  var IW = root.IW = root.IW || {};
  var BOUNDS = { minX: -36, maxX: 36, minZ: -24, maxZ: 24 };
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  function effect(s, type, x, z, life, extras) {
    var e = { id: ++s.nextId, type: type, x: x, z: z, life: life, maxLife: life };
    Object.keys(extras || {}).forEach(function (key) { e[key] = extras[key]; });
    s.effects.push(e);
  }
  function building(id, x, z, w, d, h, hp) {
    return { id: id, x: x, z: z, w: w, d: d, h: h, hp: hp, maxHp: hp, status: 'standing', fallX: 0, fallZ: -1, fallProgress: 0, hitIds: [] };
  }
  function enemy(id, type, x, z) {
    var hp = type === 'tank' ? 240 : 90;
    return { id: id, type: type, x: x, z: z, hp: hp, maxHp: hp, angle: Math.PI / 2, alive: true, disabled: false, weaponTaken: false, escaped: false, cooldown: type === 'tank' ? 3.5 : 2.5, radius: type === 'tank' ? 1.6 : 1.2 };
  }
  function createState(seed) {
    return {
      seed: seed == null ? 7 : seed >>> 0, status: 'ready', time: 0, timeLeft: 100,
      score: 0, kills: 0, collapseKills: 0, message: 'BREAK THE TOWER INTO THE CONVOY', nextId: 100,
      player: { x: -10, z: 10, angle: Math.PI, hp: 160, heat: 0, overheated: false, weapon: 'cannon', fireCooldown: 0, punchCooldown: 0, venting: false, radius: 1.1 },
      buildings: [building('tower-a', -10, 2, 4, 4, 15, 80), building('tower-b', 4, 2, 4, 4, 15, 80), building('tower-c', 18, 2, 4, 4, 15, 80), building('cover-a', -25, 3, 5, 5, 6, 130), building('cover-b', 25, -15, 6, 5, 8, 130), building('cover-c', -3, -17, 6, 5, 7, 130)],
      enemies: [enemy('tank-a', 'tank', -12, -6), enemy('tank-b', 'tank', -26, -6), enemy('tank-c', 'tank', -40, -6), enemy('escort-a', 'escort', -5, 8), enemy('escort-b', 'escort', 12, -1), enemy('escort-c', 'escort', -20, -11)],
      projectiles: [], effects: [], convoyTotal: 3, convoyDestroyed: 0, escaped: 0
    };
  }
  function start(s) {
    if (!s || s.status === 'playing') return false;
    var fresh = createState(s.seed);
    Object.keys(s).forEach(function (key) { delete s[key]; });
    Object.keys(fresh).forEach(function (key) { s[key] = fresh[key]; });
    s.status = 'playing';
    return true;
  }

  // The renderer rotates a rectangular tower around its ground-level base.
  // Intersect that rotated volume with a horizontal actor/projectile height.
  // Its low footprint grows with the fall; the full projected length is never
  // lethal or solid before the visible tower reaches that height.
  function buildingFootprint(b, height) {
    if (b.status === 'standing') return { x: b.x, z: b.z, dirX: 0, dirZ: 1, halfWidth: b.w / 2, back: b.d / 2, front: b.d / 2 };
    var angle = b.fallProgress * Math.PI / 2;
    var sin = Math.sin(angle), cos = Math.cos(angle);
    var halfDepth = b.d / 2;
    var projectedFront = b.h * sin + halfDepth * cos;
    var lowFront = cos < .0001 ? projectedFront : (Math.max(0, height) * sin + halfDepth) / cos;
    return { x: b.x, z: b.z, dirX: b.fallX, dirZ: b.fallZ, halfWidth: b.w / 2, back: halfDepth * cos, front: Math.min(projectedFront, lowFront) };
  }
  function inFootprint(point, b, radius, height) {
    if (height > b.h && b.status === 'standing') return false;
    var f = buildingFootprint(b, height), dx = point.x - f.x, dz = point.z - f.z;
    var along = dx * f.dirX + dz * f.dirZ;
    var across = dx * f.dirZ - dz * f.dirX;
    return Math.abs(across) < f.halfWidth + radius && along > -f.back - radius && along < f.front + radius;
  }
  function obstructed(s, point, radius, height) {
    return s.buildings.some(function (b) { return inFootprint(point, b, radius, height); });
  }
  function overlapDepth(s, point, radius) {
    return s.buildings.reduce(function (sum, b) {
      var f = buildingFootprint(b, 0), dx = point.x - f.x, dz = point.z - f.z;
      var along = dx * f.dirX + dz * f.dirZ, across = dx * f.dirZ - dz * f.dirX;
      var depth = Math.min(f.halfWidth + radius - Math.abs(across), along + f.back + radius, f.front + radius - along);
      return sum + Math.max(0, depth);
    }, 0);
  }
  function movePlayer(s, dx, dz) {
    var p = s.player;
    var x = clamp(p.x + dx, BOUNDS.minX + p.radius, BOUNDS.maxX - p.radius);
    // A new collapse can engulf the mech. Permit escape from that overlap,
    // while preventing a player outside cover from walking into it.
    if (overlapDepth(s, { x: x, z: p.z }, p.radius) <= overlapDepth(s, p, p.radius)) p.x = x;
    var z = clamp(p.z + dz, BOUNDS.minZ + p.radius, BOUNDS.maxZ - p.radius);
    if (overlapDepth(s, { x: p.x, z: z }, p.radius) <= overlapDepth(s, p, p.radius)) p.z = z;
  }
  function aimDirection(s, input) {
    var p = s.player, dx = input.aimX - p.x, dz = input.aimZ - p.z;
    if (Number.isFinite(dx) && Number.isFinite(dz) && Math.hypot(dx, dz) > .01) p.angle = Math.atan2(dx, dz);
    return { x: Math.sin(p.angle), z: Math.cos(p.angle) };
  }
  function addHeat(s, amount) {
    var p = s.player;
    p.heat = Math.min(100, p.heat + amount);
    if (p.heat >= 100) { p.overheated = true; s.message = 'OVERHEATED — HOLD VENT IN COVER'; }
  }
  function collapse(s, b, dx, dz) {
    if (b.status !== 'standing') return;
    var length = Math.hypot(dx, dz) || 1;
    b.hp = 0; b.status = 'falling'; b.fallX = dx / length; b.fallZ = dz / length; b.fallProgress = 0;
    s.message = 'TIMBER — CLEAR THE FALL LINE';
    effect(s, 'collapse', b.x, b.z, 2, { radius: b.w, angle: Math.atan2(b.fallX, b.fallZ) });
  }
  function damageBuilding(s, b, amount, dx, dz) {
    if (b.status !== 'standing') return;
    b.hp = Math.max(0, b.hp - amount);
    effect(s, 'impact', b.x, b.z, .24);
    if (b.hp === 0) collapse(s, b, dx, dz);
  }
  function damageEnemy(s, e, amount, byCollapse) {
    if (!e.alive) return;
    e.hp = Math.max(0, e.hp - amount);
    effect(s, 'impact', e.x, e.z, .22);
    if (e.hp > 0) return;
    e.alive = false;
    e.disabled = e.type === 'escort' && !byCollapse;
    s.kills += 1;
    if (e.type === 'tank') { s.convoyDestroyed += 1; s.score += 1000; }
    else s.score += 150;
    if (byCollapse) { s.collapseKills += 1; s.score += 750; }
    s.message = e.disabled ? 'ESCORT DISABLED — GET CLOSE AND RIP ITS GUN' : byCollapse ? 'COLLAPSE KILL +750' : 'CONVOY ARMOR DESTROYED';
    effect(s, 'explosion', e.x, e.z, .9, { radius: e.type === 'tank' ? 3 : 2 });
  }
  function damagePlayer(s, amount) {
    s.player.hp = Math.max(0, s.player.hp - amount);
    effect(s, 'hit', s.player.x, s.player.z, .35);
  }
  function shoot(s, owner, x, z, dx, dz, damage, speed, heavy) {
    var length = Math.hypot(dx, dz) || 1;
    var projectile = { id: ++s.nextId, x: x + dx / length * 1.65, z: z + dz / length * 1.65, y: 1.8, vx: dx / length * speed, vz: dz / length * speed, owner: owner, life: 2.3, damage: damage, heavy: !!heavy };
    s.projectiles.push(projectile);
    effect(s, 'muzzle', projectile.x, projectile.z, .13, { angle: Math.atan2(dx, dz), owner: owner });
  }
  function punch(s, dir) {
    var p = s.player, candidates = [];
    s.enemies.forEach(function (e) { if (e.alive) candidates.push({ target: e, building: false, radius: e.radius }); });
    s.buildings.forEach(function (b) { if (b.status === 'standing') candidates.push({ target: b, building: true, radius: 0 }); });
    candidates = candidates.filter(function (candidate) {
      var t = candidate.target, dx = t.x - p.x, dz = t.z - p.z, length = Math.hypot(dx, dz);
      candidate.distance = length;
      return length <= 8 + candidate.radius && (length < .01 || (dx * dir.x + dz * dir.z) / length >= .72);
    }).sort(function (a, b) { return a.distance - b.distance; });
    p.punchCooldown = 1.05;
    addHeat(s, 18);
    effect(s, 'punch', p.x + dir.x * 3, p.z + dir.z * 3, .28, { angle: p.angle, radius: 4 });
    if (!candidates.length) return;
    var hit = candidates[0];
    if (hit.building) damageBuilding(s, hit.target, 90, dir.x, dir.z);
    else damageEnemy(s, hit.target, 90, false);
  }
  function rip(s) {
    var p = s.player;
    var target = s.enemies.filter(function (e) { return e.disabled && !e.weaponTaken && distance(p, e) <= 4.5; }).sort(function (a, b) { return distance(p, a) - distance(p, b); })[0];
    if (!target) return false;
    target.weaponTaken = true; p.weapon = 'heavy'; s.score += 200;
    s.message = 'HEAVY GUN RIPPED — HIGH DAMAGE, WATCH THE HEAT';
    effect(s, 'rip', target.x, target.z, .8);
    return true;
  }
  function updatePlayer(s, input, dt) {
    var p = s.player, dir = aimDirection(s, input);
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.punchCooldown = Math.max(0, p.punchCooldown - dt);
    p.venting = !!input.vent;
    p.heat = Math.max(0, p.heat - (p.venting ? 42 : 5) * dt);
    if (p.overheated && p.heat <= 35) p.overheated = false;
    if (input.rip) rip(s);
    if (p.venting) return;
    var mx = clamp(Number(input.moveX) || 0, -1, 1), mz = clamp(Number(input.moveZ) || 0, -1, 1);
    var length = Math.max(1, Math.hypot(mx, mz));
    movePlayer(s, mx / length * 7.2 * dt, mz / length * 7.2 * dt);
    if (p.overheated) return;
    if (input.punch && p.punchCooldown <= 0) punch(s, dir);
    if (input.fire && p.fireCooldown <= 0 && !p.overheated) {
      var heavy = p.weapon === 'heavy';
      p.fireCooldown = heavy ? .16 : .28;
      shoot(s, 'player', p.x, p.z, dir.x, dir.z, heavy ? 38 : 24, 58, heavy);
      addHeat(s, heavy ? 10 : 14);
    }
  }
  function updateBuildings(s, dt) {
    s.buildings.forEach(function (b) {
      if (b.status !== 'falling') return;
      b.fallProgress = Math.min(1, b.fallProgress + dt / 2);
      s.enemies.forEach(function (e) {
        if (e.alive && b.hitIds.indexOf(e.id) < 0 && inFootprint(e, b, e.radius * .65, 2)) {
          b.hitIds.push(e.id); damageEnemy(s, e, 999, true);
        }
      });
      if (b.hitIds.indexOf('player') < 0 && inFootprint(s.player, b, s.player.radius * .65, 3)) {
        b.hitIds.push('player'); damagePlayer(s, 65); s.message = 'CRUSHED — STAY OUT OF THE FALL LINE';
      }
      if (b.fallProgress >= 1) { b.status = 'rubble'; effect(s, 'dust', b.x + b.fallX * b.h / 2, b.z + b.fallZ * b.h / 2, 1.4, { radius: b.h / 2 }); }
    });
  }
  function updateEnemies(s, dt) {
    s.enemies.forEach(function (e) {
      if (!e.alive) return;
      if (e.type === 'tank') {
        var next = { x: e.x + dt, z: e.z };
        if (!obstructed(s, next, e.radius, 0)) e.x = next.x;
        if (e.x > 34) { e.alive = false; e.escaped = true; s.escaped += 1; return; }
      }
      var dx = s.player.x - e.x, dz = s.player.z - e.z, d = Math.hypot(dx, dz);
      e.angle = Math.atan2(dx, dz);
      e.cooldown = Math.max(0, e.cooldown - dt);
      if (e.cooldown <= 0 && d < (e.type === 'tank' ? 28 : 22)) {
        shoot(s, e.id, e.x, e.z, dx, dz, e.type === 'tank' ? 12 : 7, e.type === 'tank' ? 21 : 27, false);
        e.cooldown = e.type === 'tank' ? 2.4 : 1.3;
      }
    });
  }
  function updateProjectiles(s, dt) {
    s.projectiles.forEach(function (p) {
      p.life -= dt;
      if (p.life <= 0) return;
      var steps = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vz) * dt / .35));
      for (var i = 0; i < steps && p.life > 0; i += 1) {
        p.x += p.vx * dt / steps; p.z += p.vz * dt / steps;
        var cover = s.buildings.find(function (b) { return inFootprint(p, b, .12, p.y); });
        if (cover) {
          p.life = 0;
          // Enemy fire uses the same cover volume without demolishing it.
          if (p.owner === 'player') {
            damageBuilding(s, cover, p.damage, p.vx, p.vz);
            if (cover.status === 'rubble') s.message = 'RUBBLE BLOCKS FIRE — FLANK AROUND THE TOWER';
          }
          else effect(s, 'spark', p.x, p.z, .18);
          break;
        }
        if (p.owner === 'player') {
          var target = s.enemies.find(function (e) { return e.alive && distance(e, p) < e.radius + .2; });
          if (target) { damageEnemy(s, target, p.damage, false); p.life = 0; }
        } else if (distance(s.player, p) < s.player.radius + .15) { damagePlayer(s, p.damage); p.life = 0; }
      }
    });
    s.projectiles = s.projectiles.filter(function (p) { return p.life > 0; });
  }
  function finish(s, status, message) {
    s.status = status; s.message = message;
    s.player.venting = false;
    if (status === 'won') s.score += Math.round(s.player.hp * 5 + s.timeLeft * 10);
  }
  function step(s, input, dt) {
    if (!s || s.status !== 'playing') return s;
    dt = clamp(Number.isFinite(dt) ? dt : 1 / 60, 0, .05);
    if (!dt) return s;
    input = input || {};
    s.time += dt; s.timeLeft = Math.max(0, s.timeLeft - dt);
    s.effects.forEach(function (e) { e.life -= dt; });
    s.effects = s.effects.filter(function (e) { return e.life > 0; });
    updatePlayer(s, input, dt);
    updateBuildings(s, dt);
    updateEnemies(s, dt);
    updateProjectiles(s, dt);
    if (s.player.hp <= 0) finish(s, 'lost', 'MECH DISABLED');
    else if (s.escaped > 0) finish(s, 'lost', 'CONVOY ESCAPED THE BLOCK');
    else if (s.convoyDestroyed === s.convoyTotal) finish(s, 'won', 'CONVOY BROKEN — BLOCK SECURED');
    else if (s.timeLeft <= 0) finish(s, 'lost', 'INTERCEPTION WINDOW CLOSED');
    return s;
  }
  IW.BOUNDS = BOUNDS;
  IW.createState = createState;
  IW.start = start;
  IW.step = step;
  IW.buildingFootprint = buildingFootprint;
  IW.inFootprint = inFootprint;
}(typeof globalThis !== 'undefined' ? globalThis : window));
