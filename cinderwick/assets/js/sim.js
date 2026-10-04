/* Cinderwick simulation: pure game rules, no DOM. Deterministic given a seed. */
(function (root) {
  'use strict';
  var CW = root.CW;
  var T = CW.T, W = CW.W, H = CW.H;
  var HALF = 0.34;            // player half-size (tiles)
  var BOMB_FUSE = 3.0;        // seconds on the live tail bomb
  var FLAME_LIFE = 0.55;
  var SPARK_SPEED = 11;       // tiles per second along a fuse cord
  var MAX_CORD = 18;          // longest cord that can be laid
  var CHAIN_WINDOW = 1.6;
  var LEVEL_TIME = 180;

  function idx(x, y) { return y * W + x; }

  // ---------- level generation ----------
  function buildLevel(level, seed) {
    var rng = CW.makeRng(seed * 7919 + level * 104729 + 13);
    var tiles = new Array(W * H), x, y;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var wall = x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0);
      tiles[idx(x, y)] = wall ? T.WALL : (rng() < Math.min(0.72, 0.52 + level * 0.03) ? T.CRATE : T.FLOOR);
    }
    var safe = [[1, 1], [2, 1], [1, 2]];
    safe.forEach(function (s) { tiles[idx(s[0], s[1])] = T.FLOOR; });
    function far(x, y, d) { return Math.abs(x - 1) + Math.abs(y - 1) >= d; }
    // critters stand on cleared floor away from the start
    var critters = [], slugs = 3 + level, chasers = Math.max(0, level - 1), n, tries;
    function place(kind) {
      for (tries = 0; tries < 300; tries++) {
        var cx = 1 + Math.floor(rng() * (W - 2)), cy = 1 + Math.floor(rng() * (H - 2));
        if (tiles[idx(cx, cy)] === T.WALL || !far(cx, cy, 7)) continue;
        if (critters.some(function (c) { return c.tx === cx && c.ty === cy; })) continue;
        tiles[idx(cx, cy)] = T.FLOOR;
        critters.push({ id: critters.length + 1, kind: kind, x: cx + 0.5, y: cy + 0.5, tx: cx, ty: cy,
          fx: cx, fy: cy, dir: [1, 0], alive: true, speed: kind === 'chaser' ? 1.9 + level * 0.1 : 1.3 + level * 0.08, stun: 0 });
        return;
      }
    }
    for (n = 0; n < slugs; n++) place('slug');
    for (n = 0; n < chasers; n++) place('chaser');
    // exit hides under the farthest-ish crate
    var crates = [];
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) if (tiles[idx(x, y)] === T.CRATE && far(x, y, 10)) crates.push({ x: x, y: y });
    if (!crates.length) { tiles[idx(W - 2, H - 2)] = T.CRATE; crates.push({ x: W - 2, y: H - 2 }); }
    var ex = crates[Math.floor(rng() * crates.length)];
    return { tiles: tiles, critters: critters, exit: { x: ex.x, y: ex.y, revealed: false }, rng: rng };
  }

  function newGame(opts) {
    opts = opts || {};
    var g = {
      seed: opts.seed || 1, level: opts.level || 1, score: opts.score || 0,
      lives: opts.lives == null ? 3 : opts.lives,
      player: null, events: [], status: 'play', time: 0, bestChain: 0, kills: 0,
      stats: { maxBombs: 3, range: 2, speed: 3.6 }
    };
    if (opts.stats) g.stats = { maxBombs: opts.stats.maxBombs, range: opts.stats.range, speed: opts.stats.speed };
    loadLevel(g);
    return g;
  }

  function loadLevel(g) {
    var L = buildLevel(g.level, g.seed);
    g.tiles = L.tiles; g.critters = L.critters; g.exit = L.exit; g.rng = L.rng;
    g.bombs = []; g.cords = []; g.sparks = []; g.flames = []; g.pickups = []; g.popups = [];
    g.nextId = 1; g.tail = null;
    g.chain = { count: 0, t: 0 };
    g.timeLeft = LEVEL_TIME; g.hurryT = 0; g.status = 'play'; g.levelT = 0;
    g.player = { x: 1.5, y: 1.5, fx: 1, fy: 0, alive: true, invuln: 2, trail: [], tx: 1, ty: 1, moving: false, deadT: 0 };
    g.events.push({ type: 'level', level: g.level });
  }

  // ---------- queries ----------
  function bombAt(g, x, y) {
    for (var i = 0; i < g.bombs.length; i++) if (g.bombs[i].x === x && g.bombs[i].y === y) return g.bombs[i];
    return null;
  }
  function solidFor(g, x, y, ent) {
    if (x < 0 || y < 0 || x >= W || y >= H) return true;
    var t = g.tiles[idx(x, y)];
    if (t !== T.FLOOR) return true;
    var b = bombAt(g, x, y);
    if (b && !(ent && ent.walkOff && ent.walkOff[b.id])) return true;
    return false;
  }
  function overlaps(g, px, py, ent) {
    var x0 = Math.floor(px - HALF), x1 = Math.floor(px + HALF), y0 = Math.floor(py - HALF), y1 = Math.floor(py + HALF);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) if (solidFor(g, x, y, ent)) return true;
    return false;
  }

  // ---------- player ----------
  function movePlayer(g, p, dx, dy, dt) {
    var sp = g.stats.speed * dt;
    if (dx && dy) { dy = 0; } // one axis at a time keeps lanes readable
    if (dx || dy) { p.fx = Math.sign(dx) || 0; p.fy = Math.sign(dy) || 0; p.moving = true; } else p.moving = false;
    if (!dx && !dy) return;
    var nx = p.x + dx * sp, ny = p.y + dy * sp;
    if (!overlaps(g, nx, ny, p)) { p.x = nx; p.y = ny; return; }
    // corner assist: slide toward the lane centre when the way ahead is free there
    if (dx) {
      var cy = Math.floor(p.y) + 0.5, d = cy - p.y;
      if (Math.abs(d) > 0.001 && Math.abs(d) < 0.46) {
        var step = Math.min(Math.abs(d), sp) * Math.sign(d);
        if (!overlaps(g, p.x, p.y + step, p)) p.y += step;
      }
    } else {
      var cx = Math.floor(p.x) + 0.5, e = cx - p.x;
      if (Math.abs(e) > 0.001 && Math.abs(e) < 0.46) {
        var st = Math.min(Math.abs(e), sp) * Math.sign(e);
        if (!overlaps(g, p.x + st, p.y, p)) p.x += st;
      }
    }
  }

  function updateWalkOff(g, p) {
    if (!p.walkOff) return;
    for (var id in p.walkOff) {
      var b = null;
      for (var i = 0; i < g.bombs.length; i++) if (g.bombs[i].id == id) b = g.bombs[i];
      if (!b || Math.abs(p.x - (b.x + 0.5)) >= 0.5 + HALF || Math.abs(p.y - (b.y + 0.5)) >= 0.5 + HALF) delete p.walkOff[id];
    }
  }

  function trackTrail(g, p) {
    var tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (tx === p.tx && ty === p.ty) return;
    p.tx = tx; p.ty = ty;
    for (var i = 0; i < p.trail.length; i++) if (p.trail[i].x === tx && p.trail[i].y === ty) { p.trail.length = i + 1; return; }
    p.trail.push({ x: tx, y: ty });
    if (p.trail.length > MAX_CORD + 6) p.trail.shift();
  }

  function placeBomb(g) {
    var p = g.player;
    if (!p.alive || g.status !== 'play') return false;
    var bx = Math.floor(p.x), by = Math.floor(p.y);
    if (g.bombs.length >= g.stats.maxBombs || bombAt(g, bx, by) || g.tiles[idx(bx, by)] !== T.FLOOR) return false;
    var b = { id: g.nextId++, x: bx, y: by, fuse: BOMB_FUSE, dormant: false, range: g.stats.range, age: 0 };
    var prev = g.tail && g.bombs.indexOf(g.tail) >= 0 ? g.tail : null;
    if (prev) {
      // the cord is the route the player actually walked, tip to tip
      var path = [{ x: prev.x, y: prev.y }];
      p.trail.forEach(function (t) { if (!(t.x === prev.x && t.y === prev.y) && !(t.x === bx && t.y === by)) path.push({ x: t.x, y: t.y }); });
      path.push({ x: bx, y: by });
      if (path.length - 1 <= MAX_CORD && path.length > 1) {
        g.cords.push({ id: g.nextId++, a: prev.id, b: b.id, path: path, burning: false });
        prev.dormant = true;
        g.events.push({ type: 'cord', x: bx, y: by, len: path.length });
      }
    }
    g.bombs.push(b); g.tail = b;
    p.walkOff = p.walkOff || {}; p.walkOff[b.id] = true;
    p.trail = [{ x: bx, y: by }]; p.tx = bx; p.ty = by;
    g.events.push({ type: 'place', x: bx, y: by });
    return true;
  }

  function strike(g) {
    var t = g.tail;
    if (t && g.bombs.indexOf(t) >= 0 && g.status === 'play') {
      if (t.fuse > 0.25) { t.fuse = 0.25; g.events.push({ type: 'strike', x: t.x, y: t.y }); }
      return true;
    }
    // no tail: light the oldest dormant bomb instead
    return false;
  }

  // ---------- explosions ----------
  function addPopup(g, x, y, text) { g.popups.push({ x: x, y: y, text: text, t: 0.9 }); }
  function mult(g) { return Math.max(1, g.chain.count); }
  function award(g, base, x, y, label) {
    var pts = base * mult(g);
    g.score += pts;
    addPopup(g, x, y, (label || '') + '+' + pts);
    return pts;
  }

  function detonate(g, b) {
    var i = g.bombs.indexOf(b);
    if (i < 0) return;
    g.bombs.splice(i, 1);
    if (g.tail === b) g.tail = null;
    g.chain.count++; g.chain.t = CHAIN_WINDOW;
    if (g.chain.count > g.bestChain) g.bestChain = g.chain.count;
    g.events.push({ type: 'explode', x: b.x, y: b.y, chain: g.chain.count });
    var cells = [{ x: b.x, y: b.y }], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    dirs.forEach(function (d) {
      for (var k = 1; k <= b.range; k++) {
        var x = b.x + d[0] * k, y = b.y + d[1] * k, t = g.tiles[idx(x, y)];
        if (t === T.WALL) break;
        cells.push({ x: x, y: y, dx: d[0], dy: d[1], k: k, end: k === b.range });
        if (t === T.CRATE) {
          g.tiles[idx(x, y)] = T.FLOOR;
          award(g, 10, x + 0.5, y + 0.5);
          g.events.push({ type: 'crate', x: x, y: y });
          if (g.exit.x === x && g.exit.y === y) { g.exit.revealed = true; g.events.push({ type: 'exit', x: x, y: y }); }
          else if (g.rng() < 0.28) {
            var kinds = ['range', 'bomb', 'speed'];
            g.pickups.push({ x: x, y: y, kind: kinds[Math.floor(g.rng() * 3)], age: 0 });
          }
          break;
        }
        var ob = bombAt(g, x, y);
        if (ob) { ob.fuse = Math.min(ob.fuse, 0.06); ob.dormant = false; break; }
      }
    });
    cells.forEach(function (c) { g.flames.push({ x: c.x, y: c.y, t: FLAME_LIFE, life: FLAME_LIFE, dx: c.dx || 0, dy: c.dy || 0, tip: !!c.end }); });
    // spark runs down every cord attached to this bomb
    g.cords.forEach(function (c) {
      if (c.burning || (c.a !== b.id && c.b !== b.id)) return;
      c.burning = true; c.from = c.a === b.id ? 'a' : 'b'; c.t = 0;
      g.sparks.push(c);
    });
  }

  function updateSparks(g, dt) {
    for (var i = g.sparks.length - 1; i >= 0; i--) {
      var c = g.sparks[i];
      c.t += dt;
      if (c.t * SPARK_SPEED >= c.path.length - 1) {
        var targetId = c.from === 'a' ? c.b : c.a;
        for (var j = 0; j < g.bombs.length; j++) if (g.bombs[j].id === targetId) { g.bombs[j].fuse = Math.min(g.bombs[j].fuse, 0.05); g.bombs[j].dormant = false; }
        g.sparks.splice(i, 1);
        var ci = g.cords.indexOf(c); if (ci >= 0) g.cords.splice(ci, 1);
        g.events.push({ type: 'spark', x: c.path[c.from === 'a' ? c.path.length - 1 : 0].x, y: c.path[c.from === 'a' ? c.path.length - 1 : 0].y });
      }
    }
    // cords whose bombs vanished without a spark (should not happen) are dropped
    g.cords = g.cords.filter(function (c) {
      return c.burning || (g.bombs.some(function (b) { return b.id === c.a; }) && g.bombs.some(function (b) { return b.id === c.b; }));
    });
  }

  // ---------- critters ----------
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function critterFree(g, x, y) { return !solidFor(g, x, y, null); }
  function chaseDir(g, c) {
    // breadth-first search to the player's tile; returns first step
    var p = g.player, sx = c.tx, sy = c.ty, gx = Math.floor(p.x), gy = Math.floor(p.y);
    var seen = {}, q = [[sx, sy, null]]; seen[sx + ',' + sy] = 1;
    for (var qi = 0; qi < q.length && qi < 400; qi++) {
      var n = q[qi];
      if (n[0] === gx && n[1] === gy) return n[2];
      for (var d = 0; d < 4; d++) {
        var nx = n[0] + DIRS[d][0], ny = n[1] + DIRS[d][1], key = nx + ',' + ny;
        if (seen[key] || !critterFree(g, nx, ny)) continue;
        seen[key] = 1; q.push([nx, ny, n[2] || DIRS[d]]);
      }
    }
    return null;
  }
  function updateCritters(g, dt) {
    g.critters.forEach(function (c) {
      if (!c.alive) return;
      if (c.stun > 0) { c.stun -= dt; return; }
      var dist = c.speed * dt * (g.hurry ? 1.25 : 1);
      var cx = c.fx + 0.5, cy = c.fy + 0.5;
      // c.fx/fy = tile we are heading to; tx/ty = tile we last left
      var dxv = cx - c.x, dyv = cy - c.y, len = Math.hypot(dxv, dyv);
      if (len > dist) { c.x += dxv / len * dist; c.y += dyv / len * dist; return; }
      c.x = cx; c.y = cy; c.tx = c.fx; c.ty = c.fy;
      var dir = null;
      if (c.kind === 'chaser' && Math.hypot(g.player.x - c.x, g.player.y - c.y) < 7 && g.player.alive) dir = chaseDir(g, c);
      if (dir && critterFree(g, c.tx + dir[0], c.ty + dir[1])) { c.dir = dir; }
      else {
        var opts = DIRS.filter(function (d) { return critterFree(g, c.tx + d[0], c.ty + d[1]) && !(d[0] === -c.dir[0] && d[1] === -c.dir[1]); });
        if (critterFree(g, c.tx + c.dir[0], c.ty + c.dir[1]) && (opts.length < 3 || g.rng() < 0.7)) { /* keep going */ }
        else if (opts.length) c.dir = opts[Math.floor(g.rng() * opts.length)];
        else c.dir = [-c.dir[0], -c.dir[1]];
      }
      if (critterFree(g, c.tx + c.dir[0], c.ty + c.dir[1])) { c.fx = c.tx + c.dir[0]; c.fy = c.ty + c.dir[1]; }
    });
  }

  function killPlayer(g) {
    var p = g.player;
    if (!p.alive || p.invuln > 0) return;
    p.alive = false; p.deadT = 1.4; g.lives--;
    g.chain.count = 0;
    g.events.push({ type: 'death', x: p.x, y: p.y });
  }

  // ---------- main step ----------
  function step(g, dt, input) {
    input = input || {};
    if (g.status === 'over') return;
    var p = g.player, i;
    g.time += dt; g.levelT += dt;
    if (g.status === 'play') {
      g.timeLeft -= dt;
      if (g.timeLeft <= 0) {
        g.timeLeft = 0; g.hurry = true; g.hurryT -= dt;
        if (g.hurryT <= 0) {
          g.hurryT = 6;
          for (var tries = 0; tries < 80; tries++) {
            var hx = 1 + Math.floor(g.rng() * (W - 2)), hy = 1 + Math.floor(g.rng() * (H - 2));
            if (g.tiles[idx(hx, hy)] === T.FLOOR && Math.abs(hx - p.x) + Math.abs(hy - p.y) > 6) {
              g.critters.push({ id: g.critters.length + 1, kind: 'chaser', x: hx + 0.5, y: hy + 0.5, tx: hx, ty: hy, fx: hx, fy: hy, dir: [1, 0], alive: true, speed: 2.4, stun: 0 });
              g.events.push({ type: 'hurry' }); break;
            }
          }
        }
      }
      if (p.alive) {
        p.invuln = Math.max(0, p.invuln - dt);
        movePlayer(g, p, input.dx || 0, input.dy || 0, dt);
        updateWalkOff(g, p); trackTrail(g, p);
        if (input.bomb) placeBomb(g);
        if (input.strike) strike(g);
      } else {
        p.deadT -= dt;
        if (p.deadT <= 0) {
          if (g.lives < 0) { g.status = 'over'; g.events.push({ type: 'over' }); return; }
          p.alive = true; p.x = 1.5; p.y = 1.5; p.invuln = 2.5; p.trail = []; p.tx = 1; p.ty = 1; p.walkOff = {};
          g.events.push({ type: 'respawn' });
        }
      }
    }
    // bombs
    for (i = g.bombs.length - 1; i >= 0; i--) {
      var b = g.bombs[i]; b.age += dt;
      if (!b.dormant) { b.fuse -= dt; if (b.fuse <= 0) detonate(g, b); }
    }
    updateSparks(g, dt);
    // flames
    for (i = g.flames.length - 1; i >= 0; i--) {
      var f = g.flames[i]; f.t -= dt;
      if (f.t <= 0) { g.flames.splice(i, 1); continue; }
      var ob = bombAt(g, f.x, f.y);
      if (ob && ob.fuse > 0.06) { ob.fuse = 0.06; ob.dormant = false; }
      for (var pi = g.pickups.length - 1; pi >= 0; pi--) if (g.pickups[pi].x === f.x && g.pickups[pi].y === f.y) g.pickups.splice(pi, 1);
      if (p.alive && Math.floor(p.x) === f.x && Math.floor(p.y) === f.y) killPlayer(g);
      g.critters.forEach(function (c) {
        if (c.alive && Math.floor(c.x) === f.x && Math.floor(c.y) === f.y) {
          c.alive = false; g.kills++;
          award(g, 100, c.x, c.y);
          g.events.push({ type: 'kill', x: c.x, y: c.y, kind: c.kind });
        }
      });
    }
    // critters
    updateCritters(g, dt);
    if (p.alive) g.critters.forEach(function (c) {
      if (c.alive && Math.abs(c.x - p.x) < 0.55 && Math.abs(c.y - p.y) < 0.55) killPlayer(g);
    });
    // pickups
    if (p.alive) for (i = g.pickups.length - 1; i >= 0; i--) {
      var k = g.pickups[i]; k.age += dt;
      if (Math.floor(p.x) === k.x && Math.floor(p.y) === k.y) {
        if (k.kind === 'range') g.stats.range = Math.min(7, g.stats.range + 1);
        if (k.kind === 'bomb') g.stats.maxBombs = Math.min(8, g.stats.maxBombs + 1);
        if (k.kind === 'speed') g.stats.speed = Math.min(5.4, g.stats.speed + 0.35);
        g.score += 50;
        g.events.push({ type: 'pickup', kind: k.kind, x: k.x, y: k.y });
        addPopup(g, k.x + 0.5, k.y + 0.5, k.kind === 'range' ? 'RANGE' : k.kind === 'bomb' ? '+BOMB' : 'SPEED');
        g.pickups.splice(i, 1);
      }
    }
    // chain window
    if (g.chain.count && !g.flames.length && !g.sparks.length) {
      g.chain.t -= dt; if (g.chain.t <= 0) g.chain.count = 0;
    }
    for (i = g.popups.length - 1; i >= 0; i--) { g.popups[i].t -= dt; if (g.popups[i].t <= 0) g.popups.splice(i, 1); }
    // exit
    var alive = g.critters.filter(function (c) { return c.alive; }).length;
    g.exitOpen = g.exit.revealed && alive === 0;
    if (g.status === 'play' && p.alive && g.exitOpen && Math.floor(p.x) === g.exit.x && Math.floor(p.y) === g.exit.y) {
      var bonus = Math.floor(g.timeLeft) * 5;
      g.score += 500 + bonus + g.lives * 250;
      g.status = 'won'; g.winBonus = bonus;
      g.events.push({ type: 'win', bonus: bonus });
    }
  }

  function nextLevel(g) { g.level++; loadLevel(g); }

  CW.Sim = { newGame: newGame, step: step, placeBomb: placeBomb, strike: strike, nextLevel: nextLevel,
    buildLevel: buildLevel, bombAt: bombAt, idx: idx, SPARK_SPEED: SPARK_SPEED, BOMB_FUSE: BOMB_FUSE, LEVEL_TIME: LEVEL_TIME, HALF: HALF };
})(typeof window !== 'undefined' ? window : globalThis);
