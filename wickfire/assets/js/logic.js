/* WICKFIRE - pure game logic. No DOM. Runs in a vm context for tests.
   Everything hangs off the global namespace WF. */
(function (global) {
  'use strict';
  var WF = global.WF = global.WF || {};

  var W = 15, H = 13;
  var T_FLOOR = 0, T_WALL = 1, T_CRATE = 2;
  var BOMB_TIME = 2.3, FIRE_TIME = 0.45;
  var BURN_SPREAD = 0.07, BURN_LIFE = 0.35, DETACHED_TTL = 14;
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  WF.W = W; WF.H = H;
  WF.T = { FLOOR: T_FLOOR, WALL: T_WALL, CRATE: T_CRATE };
  WF.BOMB_TIME = BOMB_TIME; WF.FIRE_TIME = FIRE_TIME; WF.BURN_LIFE = BURN_LIFE;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  WF.rng = mulberry32;

  function idx(x, y) { return y * W + x; }
  function inb(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }

  /* ---- level construction ---------------------------------------- */
  WF.levelInfo = function (level) {
    return {
      enemies: Math.min(3 + level, 9),
      crateDensity: Math.min(0.5 + level * 0.02, 0.62),
      time: 150,
      types: level < 2 ? ['wander'] : level < 4 ? ['wander', 'chase'] : ['wander', 'chase', 'bomber']
    };
  };

  WF.createGame = function (seed, level, carry) {
    level = level || 1;
    var rnd = mulberry32((seed || 1) * 7919 + level * 104729);
    var info = WF.levelInfo(level);
    var g = {
      seed: seed, level: level, rnd: rnd, time: 0, timeLeft: info.time,
      grid: new Uint8Array(W * H), status: 'playing', statusT: 0,
      bombs: [], fires: [], fuses: [], powerups: [], enemies: [], events: [],
      score: carry ? carry.score : 0,
      lives: carry ? carry.lives : 3,
      stats: carry ? carry.stats : { crates: 0, kills: 0, chains: 0, bestChain: 0 },
      nextId: 1
    };
    var x, y;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var wall = x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0);
      g.grid[idx(x, y)] = wall ? T_WALL : (rnd() < info.crateDensity ? T_CRATE : T_FLOOR);
    }
    [[1, 1], [2, 1], [1, 2]].forEach(function (p) { g.grid[idx(p[0], p[1])] = T_FLOOR; });
    var pu = carry && carry.pw ? carry.pw : { range: 2, bombs: 1, speed: 0, fuse: 6 };
    g.player = {
      fx: 1, fy: 1, tx: 1, ty: 1, prog: 1, alive: true, inv: 1.5,
      range: pu.range, maxBombs: pu.bombs, speed: pu.speed, fuseLen: pu.fuse, dir: 1
    };
    g.trail = newFuse(g, [{ x: 1, y: 1 }], false);
    g.fuses.push(g.trail);
    // enemies
    var tries = 0;
    while (g.enemies.length < info.enemies && tries++ < 500) {
      x = 1 + Math.floor(rnd() * (W - 2)); y = 1 + Math.floor(rnd() * (H - 2));
      if (g.grid[idx(x, y)] !== T_FLOOR) continue;
      if (Math.abs(x - 1) + Math.abs(y - 1) < 7) continue;
      if (enemyAt(g, x, y)) continue;
      var type = info.types[Math.floor(rnd() * info.types.length)];
      g.enemies.push({
        id: g.nextId++, type: type, fx: x, fy: y, tx: x, ty: y, prog: 1, alive: true, dir: 0,
        wait: rnd() * 0.5, bombCd: 3 + rnd() * 3, dying: 0
      });
    }
    // a few enemy cells are always carved free of crates so they can move
    g.enemies.forEach(function (e) {
      DIRS.forEach(function (d) {
        var nx = e.tx + d[0], ny = e.ty + d[1];
        if (inb(nx, ny) && g.grid[idx(nx, ny)] === T_CRATE && rnd() < 0.5) g.grid[idx(nx, ny)] = T_FLOOR;
      });
    });
    return g;
  };

  function newFuse(g, tiles, detached) {
    return {
      id: g.nextId++, detached: detached, ttl: DETACHED_TTL,
      tiles: tiles.map(function (t) { return { x: t.x, y: t.y, state: t.state || 0, t: t.t || 0, spread: !!t.spread }; })
    };
  }

  function curTile(e) { return e.prog < 0.5 ? { x: e.fx, y: e.fy } : { x: e.tx, y: e.ty }; }
  WF.curTile = curTile;
  function enemyAt(g, x, y) {
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i]; if (!e.alive) continue;
      if ((e.tx === x && e.ty === y) || (e.fx === x && e.fy === y)) return e;
    }
    return null;
  }
  function bombAt(g, x, y) {
    for (var i = 0; i < g.bombs.length; i++) if (g.bombs[i].x === x && g.bombs[i].y === y) return g.bombs[i];
    return null;
  }
  WF.bombAt = bombAt;
  function fireAt(g, x, y) {
    for (var i = 0; i < g.fires.length; i++) if (g.fires[i].x === x && g.fires[i].y === y) return true;
    return false;
  }
  function burningFuseAt(g, x, y) {
    for (var i = 0; i < g.fuses.length; i++) {
      var ts = g.fuses[i].tiles;
      for (var j = 0; j < ts.length; j++) if (ts[j].x === x && ts[j].y === y && ts[j].state === 1) return true;
    }
    return false;
  }
  WF.hazardAt = function (g, x, y) { return fireAt(g, x, y) || burningFuseAt(g, x, y); };

  /* ---- passability ------------------------------------------------ */
  function passable(g, x, y, ent) {
    if (!inb(x, y)) return false;
    if (g.grid[idx(x, y)] !== T_FLOOR) return false;
    var b = bombAt(g, x, y);
    if (b && !(ent && b.pass && b.pass.indexOf(ent) >= 0)) return false;
    return true;
  }
  WF.passable = passable;

  /* ---- bombs / blasts -------------------------------------------- */
  WF.dropBomb = function (g) {
    var p = g.player; if (!p.alive || g.status !== 'playing') return false;
    var c = curTile(p);
    if (g.bombs.filter(function (b) { return b.owner === 'p'; }).length >= p.maxBombs) return false;
    if (bombAt(g, c.x, c.y)) return false;
    g.bombs.push({ x: c.x, y: c.y, t: BOMB_TIME, range: p.range, owner: 'p', pass: [p] });
    g.events.push({ type: 'place', x: c.x, y: c.y });
    return true;
  };

  function explode(g, b, ctx) {
    var i = g.bombs.indexOf(b); if (i >= 0) g.bombs.splice(i, 1);
    ctx.count++;
    g.events.push({ type: 'boom', x: b.x, y: b.y, range: b.range });
    addFire(g, b.x, b.y, ctx);
    for (var d = 0; d < 4; d++) {
      for (var r = 1; r <= b.range; r++) {
        var x = b.x + DIRS[d][0] * r, y = b.y + DIRS[d][1] * r;
        if (!inb(x, y)) break;
        var t = g.grid[idx(x, y)];
        if (t === T_WALL) break;
        if (t === T_CRATE) { destroyCrate(g, x, y); addFire(g, x, y, ctx); break; }
        addFire(g, x, y, ctx);
      }
    }
  }
  function addFire(g, x, y, ctx) {
    var found = false;
    for (var i = 0; i < g.fires.length; i++) if (g.fires[i].x === x && g.fires[i].y === y) { g.fires[i].t = FIRE_TIME; found = true; }
    if (!found) g.fires.push({ x: x, y: y, t: FIRE_TIME });
    var b = bombAt(g, x, y);
    if (b && b.t > 0) b.t = 0; // chain
    igniteFuseAt(g, x, y, ctx);
  }
  function destroyCrate(g, x, y) {
    g.grid[idx(x, y)] = T_FLOOR;
    g.score += 10; g.stats.crates++;
    g.events.push({ type: 'crate', x: x, y: y });
    if (g.rnd() < 0.28) {
      var kinds = ['range', 'bombs', 'speed', 'fuse'];
      g.powerups.push({ x: x, y: y, kind: kinds[Math.floor(g.rnd() * kinds.length)] });
    }
  }
  function igniteFuseAt(g, x, y, ctx) {
    g.fuses.forEach(function (f) {
      f.tiles.forEach(function (t) {
        if (t.x === x && t.y === y && t.state === 0) ignite(g, t, ctx);
      });
    });
  }
  function ignite(g, t, ctx) {
    t.state = 1; t.t = 0; t.spread = false;
    g.events.push({ type: 'spark', x: t.x, y: t.y });
    var b = bombAt(g, t.x, t.y);
    if (b && b.t > 0) { b.t = 0; b.viaFuse = true; if (ctx) ctx.fuseHit = true; }
  }

  function updateFuses(g, dt, ctx) {
    g.fuses.forEach(function (f) {
      var ts = f.tiles, i;
      for (i = 0; i < ts.length; i++) {
        var t = ts[i];
        if (t.state !== 1) continue;
        t.t += dt;
        if (!t.spread && t.t >= BURN_SPREAD) {
          t.spread = true;
          [i - 1, i + 1].forEach(function (k) { if (ts[k] && ts[k].state === 0) ignite(g, ts[k], ctx); });
        }
        if (t.t >= BURN_LIFE) t.state = 2;
      }
      if (f.detached) f.ttl -= dt;
    });
    // prune: detached fuses that are all spent or expired; spent tiles on trail (except head)
    g.fuses = g.fuses.filter(function (f) {
      if (f === g.trail) return true;
      if (f.ttl <= 0) return false;
      return f.tiles.some(function (t) { return t.state !== 2; });
    });
    g.trail.tiles = g.trail.tiles.filter(function (t, i, a) { return t.state !== 2 || i === a.length - 1; });
    if (!g.trail.tiles.length) {
      var c = curTile(g.player);
      g.trail.tiles.push({ x: c.x, y: c.y, state: 0, t: 0, spread: false });
    }
  }

  WF.cutFuse = function (g) {
    var tr = g.trail, p = g.player;
    if (!p.alive || g.status !== 'playing' || tr.tiles.length < 2) return false;
    var head = tr.tiles[tr.tiles.length - 1];
    var rest = tr.tiles.slice(0, -1);
    var det = newFuse(g, rest, true);
    // preserve burning state
    det.tiles.forEach(function (t, i) { var s = rest[i]; t.state = s.state; t.t = s.t; t.spread = s.spread; });
    g.fuses.push(det);
    tr.tiles = [{ x: head.x, y: head.y, state: head.state === 1 ? 0 : head.state, t: 0, spread: false }];
    g.events.push({ type: 'cut', x: head.x, y: head.y });
    return true;
  };

  function pushTrail(g, x, y) {
    var ts = g.trail.tiles;
    for (var i = 0; i < ts.length; i++) {
      if (ts[i].x === x && ts[i].y === y) { ts.length = i; break; } // loop closed: shorten
    }
    ts.push({ x: x, y: y, state: 0, t: 0, spread: false });
    var max = g.player.fuseLen + 1;
    while (ts.length > max) ts.shift();
  }

  /* ---- movement --------------------------------------------------- */
  function moveSpeed(p) { return 0.16 - 0.016 * p.speed > 0.085 ? 0.16 - 0.016 * p.speed : 0.085; }
  WF.stepTime = moveSpeed;

  function advance(e, dt, stepT) {
    if (e.prog < 1) e.prog = Math.min(1, e.prog + dt / stepT);
  }

  function updatePlayer(g, dt, input) {
    var p = g.player;
    if (!p.alive) return;
    if (p.inv > 0) p.inv -= dt;
    var st = moveSpeed(p);
    advance(p, dt, st);
    if (p.prog >= 1) { p.fx = p.tx; p.fy = p.ty; }
    if (p.prog >= 1 && input && (input.dx || input.dy)) {
      var dx = input.dx, dy = input.dy;
      if (dx && dy) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
      var nx = p.tx + Math.sign(dx), ny = p.ty + Math.sign(dy);
      if (passable(g, nx, ny, p)) {
        p.fx = p.tx; p.fy = p.ty; p.tx = nx; p.ty = ny; p.prog = 0;
        p.dir = dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 2 : 0;
        pushTrail(g, nx, ny);
      }
    }
    // release bomb pass-through once the player has left the tile
    var c = curTile(p);
    g.bombs.forEach(function (b) {
      if (b.pass && b.pass.length && (b.x !== c.x || b.y !== c.y) && p.prog >= 0.5) b.pass = [];
    });
    // powerups
    for (var i = g.powerups.length - 1; i >= 0; i--) {
      var u = g.powerups[i];
      if (u.x === c.x && u.y === c.y) {
        g.powerups.splice(i, 1);
        if (u.kind === 'range') p.range = Math.min(p.range + 1, 8);
        if (u.kind === 'bombs') p.maxBombs = Math.min(p.maxBombs + 1, 6);
        if (u.kind === 'speed') p.speed = Math.min(p.speed + 1, 5);
        if (u.kind === 'fuse') p.fuseLen = Math.min(p.fuseLen + 2, 16);
        g.score += 50;
        g.events.push({ type: 'pickup', kind: u.kind, x: u.x, y: u.y });
      }
    }
  }

  /* ---- enemies ---------------------------------------------------- */
  var ENEMY = {
    wander: { step: 0.34, pts: 100 },
    chase: { step: 0.26, pts: 200 },
    bomber: { step: 0.30, pts: 300 }
  };
  WF.ENEMY = ENEMY;

  function bfsDir(g, e, goal, maxDepth) {
    var start = idx(e.tx, e.ty), seen = {}, q = [[e.tx, e.ty, -1, 0]];
    seen[start] = 1;
    while (q.length) {
      var n = q.shift();
      if (n[0] === goal.x && n[1] === goal.y) return n[2];
      if (n[3] >= maxDepth) continue;
      for (var d = 0; d < 4; d++) {
        var x = n[0] + DIRS[d][0], y = n[1] + DIRS[d][1];
        if (!inb(x, y) || seen[idx(x, y)]) continue;
        if (g.grid[idx(x, y)] !== T_FLOOR || bombAt(g, x, y)) continue;
        seen[idx(x, y)] = 1;
        q.push([x, y, n[2] < 0 ? d : n[2], n[3] + 1]);
      }
    }
    return -1;
  }

  function updateEnemy(g, e, dt) {
    var def = ENEMY[e.type];
    advance(e, dt, def.step);
    if (e.prog >= 1) { e.fx = e.tx; e.fy = e.ty; }
    if (e.prog < 1) return;
    e.wait -= dt; if (e.wait > 0) return;
    var opts = [], d;
    for (d = 0; d < 4; d++) {
      var nx = e.tx + DIRS[d][0], ny = e.ty + DIRS[d][1];
      if (passable(g, nx, ny, null) && !enemyAt(g, nx, ny) && !WF.hazardAt(g, nx, ny)) opts.push(d);
    }
    // flee imminent blasts
    var danger = dangerTiles(g);
    var here = danger[idx(e.tx, e.ty)];
    var pick = -1;
    if (here) {
      var safe = opts.filter(function (o) { return !danger[idx(e.tx + DIRS[o][0], e.ty + DIRS[o][1])]; });
      if (safe.length) pick = safe[Math.floor(g.rnd() * safe.length)];
      else if (opts.length) pick = opts[Math.floor(g.rnd() * opts.length)];
    } else {
      opts = opts.filter(function (o) { return !danger[idx(e.tx + DIRS[o][0], e.ty + DIRS[o][1])]; });
      if (e.type !== 'wander' && g.player.alive) {
        var pc = curTile(g.player);
        var dist = Math.abs(pc.x - e.tx) + Math.abs(pc.y - e.ty);
        if (dist <= (e.type === 'chase' ? 12 : 7)) {
          var bd = bfsDir(g, e, pc, 16);
          if (bd >= 0 && opts.indexOf(bd) >= 0) pick = bd;
        }
      }
      if (pick < 0 && opts.length) {
        // prefer to keep going straight
        if (opts.indexOf(e.dir) >= 0 && g.rnd() < 0.7) pick = e.dir;
        else pick = opts[Math.floor(g.rnd() * opts.length)];
      }
      if (e.type === 'bomber') {
        e.bombCd -= def.step;
        if (e.bombCd <= 0 && (g.rnd() < 0.5 || nearPlayer(g, e, 3)) && !bombAt(g, e.tx, e.ty) &&
            g.bombs.filter(function (b) { return b.owner === 'e'; }).length < 2) {
          g.bombs.push({ x: e.tx, y: e.ty, t: BOMB_TIME, range: 2, owner: 'e', pass: [e] });
          e.bombCd = 5 + g.rnd() * 4;
          g.events.push({ type: 'place', x: e.tx, y: e.ty });
        }
      }
    }
    if (pick >= 0) {
      e.dir = pick; e.fx = e.tx; e.fy = e.ty;
      e.tx += DIRS[pick][0]; e.ty += DIRS[pick][1]; e.prog = 0;
    }
    e.wait = 0;
  }
  function nearPlayer(g, e, r) {
    var c = curTile(g.player);
    return Math.abs(c.x - e.tx) + Math.abs(c.y - e.ty) <= r;
  }

  function dangerTiles(g) {
    var out = {};
    g.bombs.forEach(function (b) {
      if (b.t > 1.2) return;
      out[idx(b.x, b.y)] = 1;
      for (var d = 0; d < 4; d++) for (var r = 1; r <= b.range; r++) {
        var x = b.x + DIRS[d][0] * r, y = b.y + DIRS[d][1] * r;
        if (!inb(x, y) || g.grid[idx(x, y)] !== T_FLOOR) break;
        out[idx(x, y)] = 1;
      }
    });
    return out;
  }

  /* ---- main step -------------------------------------------------- */
  WF.step = function (g, dt, input) {
    g.events.length = 0;
    if (g.status !== 'playing') { g.statusT += dt; return g; }
    g.time += dt; g.timeLeft -= dt;
    var ctx = { count: 0, fuseHit: false };

    updatePlayer(g, dt, input);

    // timers
    g.bombs.forEach(function (b) {
      b.t -= dt;
      var e;
      if (b.pass && b.pass.length) b.pass = b.pass.filter(function (o) {
        var c = curTile(o); return c.x === b.x && c.y === b.y;
      });
    });
    // explode, chain-resolved in same tick
    var guard = 0;
    var exploded = [];
    while (guard++ < 200) {
      var ready = g.bombs.filter(function (b) { return b.t <= 0; })[0];
      if (!ready) break;
      exploded.push(ready);
      explode(g, ready, ctx);
    }
    updateFuses(g, dt, ctx);
    // fuses ignited by fire during updateFuses may detonate more bombs
    guard = 0;
    while (guard++ < 200) {
      var r2 = g.bombs.filter(function (b) { return b.t <= 0; })[0];
      if (!r2) break;
      explode(g, r2, ctx);
    }
    g.fires.forEach(function (f) { f.t -= dt; });
    g.fires = g.fires.filter(function (f) { return f.t > 0; });

    // chain scoring
    if (ctx.count >= 2 || ctx.fuseHit) {
      var n = ctx.count;
      var bonus = n * n * 25;
      g.score += bonus; g.stats.chains++;
      if (n > g.stats.bestChain) g.stats.bestChain = n;
      g.chainMul = Math.max(1, n);
      g.events.push({ type: 'chain', n: n, bonus: bonus, fuse: ctx.fuseHit });
    }

    // enemies
    g.enemies.forEach(function (e) {
      if (!e.alive) { e.dying += dt; return; }
      updateEnemy(g, e, dt);
    });
    // hazards
    var kills = 0;
    g.enemies.forEach(function (e) {
      if (!e.alive) return;
      var c = curTile(e);
      if (WF.hazardAt(g, c.x, c.y)) {
        e.alive = false; e.dying = 0; kills++;
        g.events.push({ type: 'kill', x: c.x, y: c.y, enemy: e.type });
      }
    });
    if (kills) {
      var mul = kills, pts = 0;
      g.enemies.filter(function (e) { return !e.alive && e.dying === 0; }).forEach(function (e) { pts += ENEMY[e.type].pts; });
      g.score += pts * mul; g.stats.kills += kills;
      g.events.push({ type: 'score', pts: pts * mul, multi: kills });
    }
    var p = g.player;
    if (p.alive) {
      var pc = curTile(p);
      var hit = WF.hazardAt(g, pc.x, pc.y) && p.inv <= 0;
      if (!hit && p.inv <= 0) {
        for (var i = 0; i < g.enemies.length; i++) {
          var e = g.enemies[i]; if (!e.alive) continue;
          var ec = curTile(e);
          if (ec.x === pc.x && ec.y === pc.y) { hit = true; break; }
        }
      }
      if (hit) killPlayer(g);
    }
    if (g.timeLeft <= 0 && p.alive) { g.timeLeft = 0; killPlayer(g); }

    if (g.status === 'playing' && p.alive && !g.enemies.some(function (e) { return e.alive; })) {
      var tb = Math.floor(g.timeLeft) * 5;
      g.score += tb + 500;
      g.timeBonus = tb;
      g.status = 'clear'; g.statusT = 0;
      g.events.push({ type: 'clear', bonus: tb + 500 });
    }
    return g;
  };

  function killPlayer(g) {
    var p = g.player;
    p.alive = false;
    g.lives--;
    g.events.push({ type: 'death', x: curTile(p).x, y: curTile(p).y });
    g.status = g.lives > 0 ? 'dead' : 'over';
    g.statusT = 0;
  }

  /* Respawn after a death: same level layout, player back at start with a
     brief invulnerability; keeps power-ups collected. */
  WF.respawn = function (g) {
    var p = g.player;
    p.alive = true; p.fx = p.tx = 1; p.fy = p.ty = 1; p.prog = 1; p.inv = 2.5;
    g.bombs = []; g.fires = [];
    g.fuses = []; g.trail = newFuse(g, [{ x: 1, y: 1 }], false); g.fuses.push(g.trail);
    g.timeLeft = Math.max(g.timeLeft, 60);
    g.enemies.forEach(function (e) {
      if (e.alive && Math.abs(e.tx - 1) + Math.abs(e.ty - 1) < 4) { // push away from spawn
        e.alive = false; e.dying = 9;
        var q = findFree(g, 8);
        if (q) { e.alive = true; e.dying = 0; e.fx = e.tx = q.x; e.fy = e.ty = q.y; e.prog = 1; }
      }
    });
    g.status = 'playing'; g.statusT = 0;
  };
  function findFree(g, minDist) {
    for (var t = 0; t < 200; t++) {
      var x = 1 + Math.floor(g.rnd() * (W - 2)), y = 1 + Math.floor(g.rnd() * (H - 2));
      if (g.grid[idx(x, y)] === T_FLOOR && Math.abs(x - 1) + Math.abs(y - 1) >= minDist && !enemyAt(g, x, y)) return { x: x, y: y };
    }
    return null;
  }

  WF.carry = function (g) {
    var p = g.player;
    return { score: g.score, lives: g.lives, stats: g.stats, pw: { range: p.range, bombs: p.maxBombs, speed: p.speed, fuse: p.fuseLen } };
  };

  /* ---- level solvability helper (used by tests) ------------------- */
  // True when every enemy can reach the player's start once crates are blasted
  // (treating crates as passable) - i.e. the board has no sealed pockets.
  WF.connected = function (g) {
    var seen = {}, q = [[1, 1]]; seen[idx(1, 1)] = 1;
    while (q.length) {
      var n = q.shift();
      for (var d = 0; d < 4; d++) {
        var x = n[0] + DIRS[d][0], y = n[1] + DIRS[d][1];
        if (!inb(x, y) || seen[idx(x, y)] || g.grid[idx(x, y)] === T_WALL) continue;
        seen[idx(x, y)] = 1; q.push([x, y]);
      }
    }
    return g.enemies.every(function (e) { return seen[idx(e.tx, e.ty)]; });
  };
})(typeof window !== 'undefined' ? window : globalThis);
