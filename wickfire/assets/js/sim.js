/* Wickfire simulation: pure logic, no DOM. Classic script on window.WK (or global in vm tests). */
(function (root) {
  'use strict';
  var WK = root.WK = root.WK || {};

  var W = 15, H = 11;
  var T_FLOOR = 0, T_WALL = 1, T_CRATE = 2;
  var FUSE_SPEED = 7;          // tiles/sec the flame travels along a wick
  var FLAME_LIFE = 0.45;       // seconds a burning wick tile stays lethal
  var BLAST_LIFE = 0.55;
  var FAILSAFE = 14;           // seconds before an unlit charge self-detonates
  var HALF = 0.34;             // actor half-extent in tiles

  // Seeded RNG (mulberry32) so levels are deterministic per (seed, level).
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function inb(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }

  function buildLevel(seed, level) {
    var r = rng(seed * 7919 + level * 104729 + 13);
    var tiles = [], y, x;
    for (y = 0; y < H; y++) {
      var row = [];
      for (x = 0; x < W; x++) {
        var wall = (x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0));
        row.push(wall ? T_WALL : T_FLOOR);
      }
      tiles.push(row);
    }
    var density = Math.min(0.72, 0.5 + level * 0.025);
    var crates = [];
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      if (tiles[y][x] !== T_FLOOR) continue;
      if (x + y <= 4) continue; // spawn safe zone around (1,1)
      if (r() < density) { tiles[y][x] = T_CRATE; crates.push({ x: x, y: y }); }
    }
    // hidden exit under a far crate, powerups under others
    var far = crates.filter(function (c) { return c.x + c.y > (W + H) * 0.55; });
    var ex = far[Math.floor(r() * far.length)] || crates[crates.length - 1];
    var hidden = {};
    hidden[ex.x + ',' + ex.y] = 'exit';
    var kinds = ['range', 'charge', 'speed', 'wick', 'life'];
    crates.forEach(function (c) {
      var k = c.x + ',' + c.y;
      if (hidden[k]) return;
      var p = r();
      if (p < 0.2) hidden[k] = kinds[Math.min(3, Math.floor(r() * 4))];
      else if (p < 0.215) hidden[k] = 'life';
    });
    return { tiles: tiles, hidden: hidden, exit: { x: ex.x, y: ex.y }, rand: r };
  }

  function newGame(seed) {
    var g = {
      seed: seed || 1, level: 0, score: 0, time: 0, over: false, events: [],
      combo: 0, comboT: 0, best: 0,
      player: null
    };
    startLevel(g, 1);
    return g;
  }

  function startLevel(g, level, keep) {
    var L = buildLevel(g.seed, level);
    g.level = level; g.tiles = L.tiles; g.hidden = L.hidden; g.exit = L.exit; g.exitOpen = false; g.exitRevealed = false;
    g.rand = L.rand; g.levelTime = 0; g.cleared = false;
    g.charges = []; g.fuses = []; g.blasts = []; g.pickups = []; g.enemies = []; g.particles = [];
    var old = g.player;
    g.player = {
      x: 1.5, y: 1.5, dir: 3, moving: false, alive: true,
      lives: old ? old.lives : 3, maxCharges: old ? old.maxCharges : 1, range: old ? old.range : 2,
      speed: old ? old.speed : 3.6, wickMax: old ? old.wickMax : 8, inv: 2, wick: [], lastTile: null,
      stepT: 0
    };
    if (!old) g.score = g.score || 0;
    addWick(g, 1, 1);
    g.player.lastTile = 1 + ',' + 1;
    // enemies
    var n = Math.min(12, 3 + level);
    var tries = 0;
    while (g.enemies.length < n && tries++ < 2000) {
      var x = 1 + Math.floor(g.rand() * (W - 2)), y = 1 + Math.floor(g.rand() * (H - 2));
      if (g.tiles[y][x] !== T_FLOOR || x + y < 9) continue;
      var hunter = level >= 3 && g.rand() < Math.min(0.6, 0.15 + level * 0.06);
      g.enemies.push({
        x: x + 0.5, y: y + 0.5, dx: 0, dy: 0, tx: x, ty: y, alive: true, kind: hunter ? 'hunter' : 'crawler',
        speed: (hunter ? 1.9 : 1.5) + Math.min(1.2, level * 0.08), dying: 0, think: 0
      });
    }
    g.events.push({ t: 'level', level: level });
  }

  // ---------- wick ----------
  function addWick(g, x, y) {
    var p = g.player;
    for (var i = 0; i < p.wick.length; i++) if (p.wick[i].x === x && p.wick[i].y === y) return;
    p.wick.push({ x: x, y: y, state: 0, igniteAt: null, burnEnd: 0 });
    while (p.wick.length > p.wickMax) p.wick.shift();
  }
  function wickAt(g, x, y) {
    var i, j, f;
    for (i = 0; i < g.fuses.length; i++) {
      f = g.fuses[i];
      for (j = 0; j < f.tiles.length; j++) if (f.tiles[j].x === x && f.tiles[j].y === y && f.tiles[j].state < 2) return f.tiles[j];
    }
    var w = g.player.wick;
    for (j = 0; j < w.length; j++) if (w[j].x === x && w[j].y === y) return w[j];
    return null;
  }
  function ignite(g) {
    var p = g.player;
    if (!p.alive || p.wick.length < 2) return false;
    var f = { tiles: p.wick };
    p.wick = [];
    g.fuses.push(f);
    f.tiles[0].igniteAt = g.time;
    g.events.push({ t: 'ignite', x: f.tiles[0].x, y: f.tiles[0].y });
    var px = Math.floor(p.x), py = Math.floor(p.y);
    addWick(g, px, py);
    return true;
  }
  function igniteTile(g, tile) {
    if (tile.state === 0 && tile.igniteAt === null) tile.igniteAt = g.time;
  }

  // ---------- charges / blasts ----------
  function dropCharge(g) {
    var p = g.player;
    if (!p.alive) return false;
    var x = Math.floor(p.x), y = Math.floor(p.y);
    var mine = g.charges.filter(function (c) { return !c.dead; });
    if (mine.length >= p.maxCharges) return false;
    for (var i = 0; i < mine.length; i++) if (mine[i].x === x && mine[i].y === y) return false;
    addWick(g, x, y);
    g.charges.push({ x: x, y: y, age: 0, range: p.range, solid: false, dead: false });
    g.events.push({ t: 'drop', x: x, y: y });
    return true;
  }
  function chargeAt(g, x, y) {
    for (var i = 0; i < g.charges.length; i++) { var c = g.charges[i]; if (!c.dead && c.x === x && c.y === y) return c; }
    return null;
  }
  function detonate(g, c) {
    if (c.dead) return;
    c.dead = true;
    var cells = [{ x: c.x, y: c.y }], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    dirs.forEach(function (d) {
      for (var k = 1; k <= c.range; k++) {
        var x = c.x + d[0] * k, y = c.y + d[1] * k;
        if (!inb(x, y) || g.tiles[y][x] === T_WALL) break;
        cells.push({ x: x, y: y });
        if (g.tiles[y][x] === T_CRATE) { destroyCrate(g, x, y); break; }
      }
    });
    cells.forEach(function (cl) {
      g.blasts.push({ x: cl.x, y: cl.y, life: BLAST_LIFE, max: BLAST_LIFE });
      var t = wickAt(g, cl.x, cl.y); if (t) igniteTile(g, t);
      var o = chargeAt(g, cl.x, cl.y); if (o) g._chain.push(o);
    });
    g.events.push({ t: 'boom', x: c.x, y: c.y, range: c.range });
  }
  function destroyCrate(g, x, y) {
    g.tiles[y][x] = T_FLOOR;
    g.score += 10;
    var k = g.hidden[x + ',' + y];
    if (k === 'exit') { g.exitRevealed = true; }
    else if (k) g.pickups.push({ x: x, y: y, kind: k, t: 0 });
    g.events.push({ t: 'crate', x: x, y: y });
  }
  function killEnemy(g, e, how) {
    if (!e.alive) return;
    e.alive = false; e.dying = 0.5;
    g.combo = g.comboT > 0 ? g.combo + 1 : 1;
    g.comboT = 2.2;
    g.best = Math.max(g.best, g.combo);
    var pts = 100 * g.combo + (how === 'wick' ? 50 : 0);
    g.score += pts;
    g.events.push({ t: 'kill', x: e.x, y: e.y, pts: pts, combo: g.combo, how: how });
  }
  function hurtPlayer(g) {
    var p = g.player;
    if (!p.alive || p.inv > 0) return;
    p.lives--; g.combo = 0; g.comboT = 0;
    g.events.push({ t: 'hurt', x: p.x, y: p.y });
    if (p.lives <= 0) { p.alive = false; g.over = true; g.events.push({ t: 'over' }); }
    else { p.inv = 2.5; }
  }

  // ---------- movement ----------
  function solidFor(g, x, y, ignoreCharge) {
    if (!inb(x, y)) return true;
    var t = g.tiles[y][x];
    if (t !== T_FLOOR) return true;
    var c = chargeAt(g, x, y);
    return !!(c && c.solid);
  }
  function tryMove(g, a, dx, dy) {
    // axis separated with corner sliding
    var nx = a.x + dx, ny = a.y;
    if (!boxHits(g, nx, ny)) a.x = nx;
    else if (dx !== 0) { var cy = Math.floor(a.y) + 0.5; if (Math.abs(a.y - cy) > 0.02 && !boxHits(g, nx, a.y + Math.sign(cy - a.y) * Math.min(Math.abs(dx), Math.abs(cy - a.y)))) a.y += Math.sign(cy - a.y) * Math.min(Math.abs(dx), Math.abs(cy - a.y)); }
    nx = a.x; ny = a.y + dy;
    if (!boxHits(g, nx, ny)) a.y = ny;
    else if (dy !== 0) { var cx = Math.floor(a.x) + 0.5; if (Math.abs(a.x - cx) > 0.02 && !boxHits(g, a.x + Math.sign(cx - a.x) * Math.min(Math.abs(dy), Math.abs(cx - a.x)), ny)) a.x += Math.sign(cx - a.x) * Math.min(Math.abs(dy), Math.abs(cx - a.x)); }
  }
  function boxHits(g, x, y) {
    var x0 = Math.floor(x - HALF), x1 = Math.floor(x + HALF), y0 = Math.floor(y - HALF), y1 = Math.floor(y + HALF);
    for (var j = y0; j <= y1; j++) for (var i = x0; i <= x1; i++) if (solidFor(g, i, j)) return true;
    return false;
  }

  function enemyBlocked(g, x, y) {
    if (!inb(x, y) || g.tiles[y][x] !== T_FLOOR) return true;
    var c = chargeAt(g, x, y);
    return !!c;
  }
  var DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function enemyThink(g, e) {
    var cx = Math.floor(e.x), cy = Math.floor(e.y), opts = [], i, d;
    for (i = 0; i < 4; i++) {
      d = DIRS[i];
      if (!enemyBlocked(g, cx + d[0], cy + d[1])) opts.push(i);
    }
    if (!opts.length) { e.tx = cx; e.ty = cy; return; }
    var pick;
    var p = g.player;
    var back = e.last !== undefined ? (e.last + 2) % 4 : -1;
    var fwd = opts.filter(function (o) { return o !== back; });
    if (!fwd.length) fwd = opts;
    if (e.kind === 'hunter' && p.alive) {
      // BFS toward player, falling back to random
      var step = bfsStep(g, cx, cy, Math.floor(p.x), Math.floor(p.y));
      pick = step >= 0 ? step : fwd[Math.floor(g.rand() * fwd.length)];
    } else {
      pick = (e.last !== undefined && fwd.indexOf(e.last) >= 0 && g.rand() < 0.65) ? e.last : fwd[Math.floor(g.rand() * fwd.length)];
    }
    e.last = pick; e.tx = cx + DIRS[pick][0]; e.ty = cy + DIRS[pick][1];
  }
  function bfsStep(g, sx, sy, gx, gy) {
    if (sx === gx && sy === gy) return -1;
    var seen = {}, q = [[sx, sy, -1]], qi = 0;
    seen[sx + ',' + sy] = 1;
    while (qi < q.length && qi < 400) {
      var cur = q[qi++];
      for (var i = 0; i < 4; i++) {
        var nx = cur[0] + DIRS[i][0], ny = cur[1] + DIRS[i][1], k = nx + ',' + ny;
        if (seen[k] || enemyBlocked(g, nx, ny)) continue;
        seen[k] = 1;
        var first = cur[2] < 0 ? i : cur[2];
        if (nx === gx && ny === gy) return first;
        q.push([nx, ny, first]);
      }
    }
    return -1;
  }

  // ---------- main step ----------
  function step(g, dt, input) {
    if (g.over) return;
    g.time += dt; g.levelTime += dt;
    var p = g.player, i, j;
    if (g.comboT > 0) { g.comboT -= dt; if (g.comboT <= 0) g.combo = 0; }
    if (p.inv > 0) p.inv -= dt;
    g._chain = [];

    // player
    if (p.alive && input) {
      var mx = input.x || 0, my = input.y || 0, m = Math.hypot(mx, my);
      p.moving = m > 0.15;
      if (p.moving) {
        mx /= Math.max(1, m); my /= Math.max(1, m);
        // dominant-axis bias keeps movement lane-like, as in classic grid blasters
        if (Math.abs(mx) > Math.abs(my) * 1.25) my = 0; else if (Math.abs(my) > Math.abs(mx) * 1.25) mx = 0;
        p.dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 0 : 2) : (my > 0 ? 1 : 3);
        tryMove(g, p, mx * p.speed * dt, my * p.speed * dt);
        p.stepT += dt * p.speed;
      }
      var tx = Math.floor(p.x), ty = Math.floor(p.y), key = tx + ',' + ty;
      if (key !== p.lastTile) { p.lastTile = key; addWick(g, tx, ty); }
      if (input.drop) dropCharge(g);
      if (input.ignite) ignite(g);
    }
    // charges become solid once the player has left their tile
    for (i = 0; i < g.charges.length; i++) {
      var c = g.charges[i]; if (c.dead) continue;
      c.age += dt;
      if (!c.solid && (Math.floor(p.x) !== c.x || Math.floor(p.y) !== c.y)) {
        // only solid if the actor's box no longer overlaps
        if (Math.abs(p.x - (c.x + 0.5)) > 0.5 + HALF || Math.abs(p.y - (c.y + 0.5)) > 0.5 + HALF) c.solid = true;
      }
      if (c.age > FAILSAFE) g._chain.push(c);
    }

    // fuses
    for (i = 0; i < g.fuses.length; i++) {
      var f = g.fuses[i];
      for (j = 0; j < f.tiles.length; j++) {
        var t = f.tiles[j];
        if (t.state === 0 && t.igniteAt !== null && g.time >= t.igniteAt) {
          t.state = 1; t.burnEnd = g.time + FLAME_LIFE;
          g.events.push({ t: 'flame', x: t.x, y: t.y });
          [f.tiles[j - 1], f.tiles[j + 1]].forEach(function (n) { if (n && n.state === 0 && n.igniteAt === null) n.igniteAt = g.time + 1 / FUSE_SPEED; });
          var cc = chargeAt(g, t.x, t.y); if (cc) g._chain.push(cc);
        } else if (t.state === 1 && g.time >= t.burnEnd) t.state = 2;
      }
    }
    g.fuses = g.fuses.filter(function (f2) { return f2.tiles.some(function (t2) { return t2.state < 2; }); });

    // resolve chain reactions
    var guard = 0;
    while (g._chain.length && guard++ < 200) detonate(g, g._chain.shift());
    g.charges = g.charges.filter(function (c2) { return !c2.dead; });

    // hazards: set of lethal tiles
    var lethal = {}, how = {};
    g.blasts.forEach(function (b) { lethal[b.x + ',' + b.y] = 1; how[b.x + ',' + b.y] = 'blast'; });
    g.fuses.forEach(function (f2) { f2.tiles.forEach(function (t2) { if (t2.state === 1) { var k = t2.x + ',' + t2.y; if (!lethal[k]) { lethal[k] = 1; how[k] = 'wick'; } } }); });
    g.blasts.forEach(function (b) { b.life -= dt; });
    g.blasts = g.blasts.filter(function (b) { return b.life > 0; });

    // enemies
    for (i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (!e.alive) { e.dying -= dt; continue; }
      var ex = Math.floor(e.x), ey = Math.floor(e.y);
      if (lethal[ex + ',' + ey]) { killEnemy(g, e, how[ex + ',' + ey]); continue; }
      // move toward target tile centre
      var gx = e.tx + 0.5, gy = e.ty + 0.5, ddx = gx - e.x, ddy = gy - e.y, dist = Math.hypot(ddx, ddy);
      var stepLen = e.speed * dt;
      if (dist <= stepLen || (e.tx === ex && e.ty === ey && dist < 0.02)) {
        e.x = gx; e.y = gy;
        enemyThink(g, e);
      } else {
        e.x += ddx / dist * stepLen; e.y += ddy / dist * stepLen;
      }
      if (enemyBlocked(g, e.tx, e.ty) && !(e.tx === Math.floor(e.x) && e.ty === Math.floor(e.y))) { e.tx = Math.floor(e.x); e.ty = Math.floor(e.y); }
      if (p.alive && Math.abs(e.x - p.x) < 0.55 && Math.abs(e.y - p.y) < 0.55) hurtPlayer(g);
    }
    g.enemies = g.enemies.filter(function (e2) { return e2.alive || e2.dying > 0; });

    // player hazards
    if (p.alive && lethal[Math.floor(p.x) + ',' + Math.floor(p.y)]) hurtPlayer(g);

    // pickups
    for (i = g.pickups.length - 1; i >= 0; i--) {
      var pk = g.pickups[i]; pk.t += dt;
      if (lethal[pk.x + ',' + pk.y] && pk.t > 0.3) { g.pickups.splice(i, 1); continue; }
      if (p.alive && Math.floor(p.x) === pk.x && Math.floor(p.y) === pk.y) {
        applyPickup(g, pk.kind); g.pickups.splice(i, 1);
        g.events.push({ t: 'pickup', kind: pk.kind, x: pk.x, y: pk.y });
      }
    }

    // exit
    var alive = g.enemies.filter(function (e3) { return e3.alive; }).length;
    g.exitOpen = g.exitRevealed && alive === 0;
    if (g.exitOpen && p.alive && Math.floor(p.x) === g.exit.x && Math.floor(p.y) === g.exit.y && !g.cleared) {
      g.cleared = true;
      var bonus = Math.max(0, Math.round(1500 - g.levelTime * 8)) + g.level * 100 + p.lives * 150;
      g.score += bonus;
      g.events.push({ t: 'clear', bonus: bonus, level: g.level });
    }
  }
  function applyPickup(g, k) {
    var p = g.player;
    if (k === 'range') p.range = Math.min(8, p.range + 1);
    else if (k === 'charge') p.maxCharges = Math.min(5, p.maxCharges + 1);
    else if (k === 'speed') p.speed = Math.min(5.4, p.speed + 0.4);
    else if (k === 'wick') p.wickMax = Math.min(20, p.wickMax + 3);
    else if (k === 'life') p.lives = Math.min(5, p.lives + 1);
    g.score += 25;
  }
  function nextLevel(g) { startLevel(g, g.level + 1); }

  WK.sim = {
    W: W, H: H, T_FLOOR: T_FLOOR, T_WALL: T_WALL, T_CRATE: T_CRATE,
    FUSE_SPEED: FUSE_SPEED, FLAME_LIFE: FLAME_LIFE, BLAST_LIFE: BLAST_LIFE,
    rng: rng, buildLevel: buildLevel, newGame: newGame, startLevel: startLevel, step: step,
    dropCharge: dropCharge, ignite: ignite, nextLevel: nextLevel, wickAt: wickAt, chargeAt: chargeAt, bfsStep: bfsStep
  };
})(typeof window !== 'undefined' ? window : globalThis);
