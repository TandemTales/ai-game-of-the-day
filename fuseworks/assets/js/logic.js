(function (global) {
  'use strict';
  var FW = global.FW = global.FW || {};
  var W = 13, H = 11;
  var T = { FLOOR: 0, WALL: 1, CRATE: 2, PRISM_A: 3, PRISM_B: 4 }; // A is "/", B is "\"
  var DIRS = [[1, 0], [0, -1], [-1, 0], [0, 1]]; // E N W S
  var FUSE = 2.2, FLAME = 0.55, CHAIN_DELAY = 0.09, TIME_LIMIT = 150;
  var SPEED = 4.2, ENEMY = { wander: { speed: 2.6, pts: 100 }, chaser: { speed: 3.2, pts: 250 }, bomber: { speed: 3.4, pts: 500 } };

  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function inb(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  function tileAt(g, x, y) { return inb(x, y) ? g[y * W + x] : T.WALL; }
  function solidTile(t) { return t !== T.FLOOR; }

  // Mirror reflection: "/" swaps E<->N, W<->S; "\" swaps E<->S, W<->N. Dir index: 0 E,1 N,2 W,3 S.
  function reflect(tile, d) {
    if (tile === T.PRISM_A) return [1, 0, 3, 2][d];
    return [3, 2, 1, 0][d];
  }

  // Returns {cells:[{x,y,dist}], crates:[{x,y}], segments:[[x0,y0,x1,y1]], bends:[{x,y}]}.
  function computeBlast(grid, bx, by, range) {
    var cells = [{ x: bx, y: by, dist: 0 }], crates = [], bends = [], segs = [], seen = {};
    seen[bx + ',' + by] = 1;
    for (var d0 = 0; d0 < 4; d0++) {
      var d = d0, x = bx, y = by, sx = bx, sy = by;
      for (var i = 1; i <= range; i++) {
        x += DIRS[d][0]; y += DIRS[d][1];
        var t = tileAt(grid, x, y);
        if (t === T.WALL) { x -= DIRS[d][0]; y -= DIRS[d][1]; break; }
        var k = x + ',' + y;
        if (!seen[k]) { seen[k] = 1; cells.push({ x: x, y: y, dist: i }); }
        if (t === T.CRATE) { crates.push({ x: x, y: y }); break; }
        if (t === T.PRISM_A || t === T.PRISM_B) {
          segs.push([sx, sy, x, y]); bends.push({ x: x, y: y });
          d = reflect(t, d); sx = x; sy = y;
        }
      }
      segs.push([sx, sy, x, y]);
    }
    return { cells: cells, crates: crates, bends: bends, segments: segs };
  }

  function levelSpec(n) {
    var k = Math.min(n, 9);
    var enemies = ['wander', 'wander'];
    if (k >= 2) enemies.push('chaser');
    if (k >= 3) enemies.push('wander');
    if (k >= 4) enemies.push('bomber');
    if (k >= 6) enemies.push('chaser');
    if (k >= 8) enemies.push('bomber');
    return { n: n, enemies: enemies, crates: 0.5 + Math.min(k, 6) * 0.03, prisms: 3 + Math.min(k, 6),
      time: TIME_LIMIT };
  }

  function buildGrid(n, seed) {
    var spec = levelSpec(n);
    for (var attempt = 0; attempt < 40; attempt++) {
      var r = rng(seed * 977 + n * 131 + attempt * 7919), g = new Array(W * H).fill(T.FLOOR), x, y;
      for (y = 0; y < H; y++) for (x = 0; x < W; x++)
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0)) g[y * W + x] = T.WALL;
      var safe = function (x, y) { return (x <= 3 && y <= 2) || (x <= 2 && y <= 3); };
      var junctions = [];
      for (y = 1; y < H - 1; y += 2) for (x = 1; x < W - 1; x += 2) if (!safe(x, y) && !(x > W - 4 && y > H - 4)) junctions.push([x, y]);
      for (var i = junctions.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var tmp = junctions[i]; junctions[i] = junctions[j]; junctions[j] = tmp; }
      for (i = 0; i < spec.prisms && i < junctions.length; i++)
        g[junctions[i][1] * W + junctions[i][0]] = r() < 0.5 ? T.PRISM_A : T.PRISM_B;
      for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++)
        if (g[y * W + x] === T.FLOOR && !safe(x, y) && r() < spec.crates) g[y * W + x] = T.CRATE;
      if (connected(g)) return g;
    }
    // Fallback: no prisms, always connected.
    var f = new Array(W * H).fill(T.FLOOR);
    for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++)
      if (xx === 0 || yy === 0 || xx === W - 1 || yy === H - 1 || (xx % 2 === 0 && yy % 2 === 0)) f[yy * W + xx] = T.WALL;
    return f;
  }

  // Every non-solid-or-crate cell must be reachable from the start treating crates as passable.
  function connected(g) {
    var seen = {}, q = [[1, 1]], total = 0, reached = 0, x, y;
    seen['1,1'] = 1;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) { var t = g[y * W + x]; if (t === T.FLOOR || t === T.CRATE) total++; }
    while (q.length) {
      var c = q.pop(); reached++;
      for (var d = 0; d < 4; d++) {
        var nx = c[0] + DIRS[d][0], ny = c[1] + DIRS[d][1], t2 = tileAt(g, nx, ny);
        if ((t2 === T.FLOOR || t2 === T.CRATE) && !seen[nx + ',' + ny]) { seen[nx + ',' + ny] = 1; q.push([nx, ny]); }
      }
    }
    return reached === total;
  }

  function spawnEnemies(g, spec, r) {
    var spots = [];
    for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++)
      if (g[y * W + x] !== T.WALL && g[y * W + x] !== T.PRISM_A && g[y * W + x] !== T.PRISM_B && x + y >= 12) spots.push([x, y]);
    var out = [];
    spec.enemies.forEach(function (type, i) {
      var s = spots.splice(Math.floor(r() * spots.length), 1)[0];
      g[s[1] * W + s[0]] = T.FLOOR;
      out.push(mkActor('e' + i, s[0], s[1], type));
    });
    return out;
  }

  function mkActor(id, x, y, type) {
    return { id: id, type: type, x: x, y: y, fx: x, fy: y, tx: x, ty: y, moving: false, dir: 0, alive: true,
      think: 0, cool: 1.5 + (id.length % 3), dead: 0 };
  }

  function newGame(opts) {
    opts = opts || {};
    var seed = opts.seed || 1337, n = opts.level || 1;
    var s = { seed: seed, level: n, score: opts.score || 0, lives: opts.lives == null ? 3 : opts.lives,
      power: opts.power || 2, maxBombs: opts.maxBombs || 1, speedLvl: opts.speedLvl || 0,
      t: 0, timeLeft: levelSpec(n).time, phase: 'play', phaseT: 0, shake: 0,
      bombs: [], flames: [], pickups: [], events: [], particles: 0, kills: 0, bestChain: 0, combo: 0,
      want: null, invuln: 2, r: rng(seed + n * 31) };
    s.grid = buildGrid(n, seed);
    s.player = mkActor('p', 1, 1, 'player');
    s.enemies = spawnEnemies(s.grid, levelSpec(n), s.r);
    return s;
  }

  function bombAt(s, x, y) { for (var i = 0; i < s.bombs.length; i++) if (s.bombs[i].x === x && s.bombs[i].y === y) return s.bombs[i]; return null; }
  function blocked(s, a, x, y) {
    if (solidTile(tileAt(s.grid, x, y))) return true;
    var b = bombAt(s, x, y);
    return !!(b && !(b.pass && b.pass[a.id]));
  }

  function setDir(s, dx, dy) { s.want = dx || dy ? (dx > 0 ? 0 : dx < 0 ? 2 : dy < 0 ? 1 : 3) : null; }

  function placeBomb(s) {
    if (s.phase !== 'play' || !s.player.alive) return false;
    var p = s.player, cx = Math.round(p.fx), cy = Math.round(p.fy);
    if (p.moving && Math.abs(p.fx - cx) + Math.abs(p.fy - cy) > 0.5) { cx = p.tx; cy = p.ty; }
    return dropBomb(s, p, cx, cy, s.power, s.maxBombs);
  }
  function dropBomb(s, owner, x, y, power, max) {
    if (bombAt(s, x, y)) return false;
    var mine = s.bombs.filter(function (b) { return b.owner === owner.id; }).length;
    if (mine >= max || solidTile(tileAt(s.grid, x, y))) return false;
    var pass = {}; pass[owner.id] = 1;
    s.enemies.concat([s.player]).forEach(function (a) { if (a.alive && Math.round(a.fx) === x && Math.round(a.fy) === y) pass[a.id] = 1; });
    s.bombs.push({ x: x, y: y, owner: owner.id, power: power, fuse: FUSE, pass: pass, chain: 0 });
    s.events.push({ type: 'place', x: x, y: y });
    return true;
  }

  function detonate(s, b, chain) {
    var i = s.bombs.indexOf(b); if (i < 0) return;
    s.bombs.splice(i, 1);
    var blast = computeBlast(s.grid, b.x, b.y, b.power);
    s.flames.push({ cells: blast.cells, segments: blast.segments, bends: blast.bends, t: FLAME, x: b.x, y: b.y, owner: b.owner, chain: chain });
    if (chain > s.bestChain) s.bestChain = chain;
    s.shake = Math.min(1, s.shake + 0.35);
    s.events.push({ type: 'boom', x: b.x, y: b.y, chain: chain, bends: blast.bends.length });
    if (blast.bends.length) s.events.push({ type: 'bend', n: blast.bends.length });
    blast.crates.forEach(function (c) {
      if (tileAt(s.grid, c.x, c.y) !== T.CRATE) return;
      s.grid[c.y * W + c.x] = T.FLOOR; s.score += 10;
      s.events.push({ type: 'crate', x: c.x, y: c.y });
      if (s.r() < 0.28) s.pickups.push({ x: c.x, y: c.y, kind: ['range', 'bomb', 'speed'][Math.floor(s.r() * 3)], hidden: 0.3 });
    });
    blast.cells.forEach(function (c) {
      var o = bombAt(s, c.x, c.y);
      if (o && o.fuse > CHAIN_DELAY) { o.fuse = CHAIN_DELAY; o.chain = chain + 1; }
      s.pickups = s.pickups.filter(function (p) { return !(p.x === c.x && p.y === c.y && p.hidden <= 0); });
    });
    s.flameKills = 0;
  }

  function inFlame(s, x, y) {
    for (var i = 0; i < s.flames.length; i++) for (var j = 0; j < s.flames[i].cells.length; j++)
      if (s.flames[i].cells[j].x === x && s.flames[i].cells[j].y === y) return s.flames[i];
    return null;
  }

  // Cells that are or will be dangerous: for AI and tests.
  function dangerMap(s) {
    var m = {};
    s.flames.forEach(function (f) { f.cells.forEach(function (c) { m[c.x + ',' + c.y] = 1; }); });
    s.bombs.forEach(function (b) { computeBlast(s.grid, b.x, b.y, b.power).cells.forEach(function (c) { m[c.x + ',' + c.y] = 1; }); });
    return m;
  }

  function stepActor(s, a, dt, speed, chooser) {
    var left = speed * dt;
    while (left > 1e-6) {
      if (!a.moving) {
        var d = chooser(a);
        if (d == null) { a.fx = a.x; a.fy = a.y; return; }
        var nx = a.x + DIRS[d][0], ny = a.y + DIRS[d][1];
        if (blocked(s, a, nx, ny)) { a.dir = d; a.fx = a.x; a.fy = a.y; return; }
        a.dir = d; a.tx = nx; a.ty = ny; a.moving = true;
      }
      var dx = a.tx - a.fx, dy = a.ty - a.fy, dist = Math.abs(dx) + Math.abs(dy);
      if (left >= dist) {
        a.fx = a.tx; a.fy = a.ty; a.x = a.tx; a.y = a.ty; a.moving = false; left -= dist;
        releasePass(s, a);
      } else { a.fx += Math.sign(dx) * left; a.fy += Math.sign(dy) * left; left = 0; }
    }
  }
  function releasePass(s, a) {
    s.bombs.forEach(function (b) { if (b.pass[a.id] && (b.x !== a.x || b.y !== a.y)) delete b.pass[a.id]; });
  }

  function bfs(s, a, sx, sy, goal, avoid) {
    var q = [[sx, sy, -1]], seen = {}; seen[sx + ',' + sy] = 1;
    for (var h = 0; h < q.length; h++) {
      var c = q[h];
      if ((c[0] !== sx || c[1] !== sy) && goal(c[0], c[1])) return c[2];
      for (var d = 0; d < 4; d++) {
        var nx = c[0] + DIRS[d][0], ny = c[1] + DIRS[d][1], k = nx + ',' + ny;
        if (seen[k] || blocked(s, a, nx, ny) || (avoid && avoid[k] && !(goal(nx, ny)))) continue;
        seen[k] = 1; q.push([nx, ny, c[2] === -1 ? d : c[2]]);
      }
    }
    return null;
  }

  function enemyChoose(s, e, danger) {
    var here = danger[e.x + ',' + e.y];
    if (here) {
      var f = bfs(s, e, e.x, e.y, function (x, y) { return !danger[x + ',' + y]; }, null);
      if (f != null) return f;
    }
    var p = s.player, dirs = [], d, nx, ny;
    if ((e.type === 'chaser' || e.type === 'bomber') && p.alive) {
      var chase = bfs(s, e, e.x, e.y, function (x, y) { return x === p.x && y === p.y; }, danger);
      var dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
      if (chase != null && dist <= (e.type === 'bomber' ? 9 : 7)) {
        nx = e.x + DIRS[chase][0]; ny = e.y + DIRS[chase][1];
        if (!danger[nx + ',' + ny]) return chase;
      }
    }
    for (d = 0; d < 4; d++) {
      nx = e.x + DIRS[d][0]; ny = e.y + DIRS[d][1];
      if (!blocked(s, e, nx, ny) && !danger[nx + ',' + ny]) dirs.push(d);
    }
    if (!dirs.length) return null;
    var forward = dirs.indexOf(e.dir) >= 0, back = (e.dir + 2) % 4;
    if (forward && s.r() < 0.75) return e.dir;
    var nb = dirs.filter(function (x) { return x !== back; });
    var pool = nb.length ? nb : dirs;
    return pool[Math.floor(s.r() * pool.length)];
  }

  function enemyBomb(s, e, danger) {
    if (e.type !== 'bomber' || e.cool > 0 || e.moving) return;
    var p = s.player, near = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 3;
    var crateAdj = DIRS.some(function (d) { return tileAt(s.grid, e.x + d[0], e.y + d[1]) === T.CRATE; });
    if (!near && !(crateAdj && s.r() < 0.02)) return;
    var blast = computeBlast(s.grid, e.x, e.y, 2);
    var bad = {}; blast.cells.forEach(function (c) { bad[c.x + ',' + c.y] = 1; });
    var esc = bfs(s, e, e.x, e.y, function (x, y) { return !bad[x + ',' + y] && !danger[x + ',' + y]; }, null);
    if (esc == null) return;
    if (dropBomb(s, e, e.x, e.y, 2, 1)) e.cool = 5 + s.r() * 3;
  }

  function killEnemy(s, e) {
    e.alive = false; e.dead = 0.5; s.kills++;
    s.events.push({ type: 'kill', x: e.fx, y: e.fy, kind: e.type });
  }

  function update(s, dt) {
    s.events.length = 0;
    if (dt > 0.1) dt = 0.1;
    s.t += dt; s.shake = Math.max(0, s.shake - dt * 2.5);
    if (s.phase === 'over' || s.phase === 'paused') return s;
    var i, p = s.player;
    if (s.phase === 'clear') { s.phaseT += dt; if (s.phaseT > 3) s.phase = 'next'; s.flames.forEach(function (f) { f.t -= dt; }); s.flames = s.flames.filter(function (f) { return f.t > 0; }); return s; }
    if (s.phase === 'next') return s;
    s.timeLeft -= dt; if (s.invuln > 0) s.invuln -= dt;
    if (s.timeLeft <= 0 && p.alive) { s.timeLeft = 0; hurt(s, 'time'); }
    // bombs
    for (i = s.bombs.length - 1; i >= 0; i--) {
      var b = s.bombs[i]; b.fuse -= dt;
      if (b.fuse <= 0) detonate(s, b, b.chain);
    }
    // flames
    for (i = s.flames.length - 1; i >= 0; i--) { s.flames[i].t -= dt; if (s.flames[i].t <= 0) s.flames.splice(i, 1); }
    s.pickups.forEach(function (pk) { if (pk.hidden > 0) pk.hidden -= dt; });
    // player
    if (p.alive) {
      stepActor(s, p, dt, SPEED + s.speedLvl * 0.6, function () { return s.want; });
      if (p.moving && s.want != null && s.want === (p.dir + 2) % 4) { // instant reverse
        var ox = p.x, oy = p.y; p.x = p.tx; p.y = p.ty; p.tx = ox; p.ty = oy; p.dir = s.want;
      }
      for (i = 0; i < s.pickups.length; i++) {
        var pk = s.pickups[i];
        if (pk.hidden <= 0 && Math.round(p.fx) === pk.x && Math.round(p.fy) === pk.y) {
          if (pk.kind === 'range') s.power = Math.min(8, s.power + 1);
          else if (pk.kind === 'bomb') s.maxBombs = Math.min(5, s.maxBombs + 1);
          else s.speedLvl = Math.min(4, s.speedLvl + 1);
          s.score += 50; s.pickups.splice(i, 1); s.events.push({ type: 'pickup', kind: pk.kind }); break;
        }
      }
    }
    // enemies
    var danger = dangerMap(s), killed = 0, chainMax = 0;
    s.enemies.forEach(function (e) {
      if (!e.alive) { e.dead -= dt; return; }
      e.cool -= dt;
      var spec = ENEMY[e.type];
      stepActor(s, e, dt, spec.speed, function (a) { return enemyChoose(s, a, danger); });
      enemyBomb(s, e, danger);
      var fl = inFlame(s, Math.round(e.fx), Math.round(e.fy));
      if (fl) { killed++; chainMax = Math.max(chainMax, fl.chain); s.score += spec.pts + fl.chain * 50; killEnemy(s, e); }
      else if (p.alive && s.invuln <= 0 && Math.abs(e.fx - p.fx) + Math.abs(e.fy - p.fy) < 0.7) hurt(s, 'bot');
    });
    if (killed > 1) { s.score += 150 * (killed - 1) * killed / 2 * 1; s.events.push({ type: 'multi', n: killed }); }
    if (chainMax > 0) s.events.push({ type: 'chain', n: chainMax });
    if (p.alive && s.invuln <= 0 && inFlame(s, Math.round(p.fx), Math.round(p.fy))) hurt(s, 'flame');
    if (!p.alive) {
      p.dead -= dt;
      if (p.dead <= 0) {
        if (s.lives <= 0) { s.phase = 'over'; s.events.push({ type: 'over' }); }
        else respawn(s);
      }
    } else if (!s.enemies.some(function (e) { return e.alive; })) {
      s.phase = 'clear'; s.phaseT = 0;
      s.score += 1000 + Math.round(s.timeLeft) * 5 + (s.lives * 250);
      s.events.push({ type: 'clear' });
    }
    return s;
  }

  function hurt(s, why) {
    var p = s.player; if (!p.alive) return;
    p.alive = false; p.dead = 1.4; s.lives--; s.events.push({ type: 'hurt', why: why });
    s.shake = 1;
  }
  function respawn(s) {
    var p = s.player; p.alive = true; p.x = p.fx = p.tx = 1; p.y = p.fy = p.ty = 1; p.moving = false; p.dead = 0;
    s.invuln = 2.5; s.want = null; s.bombs = s.bombs.filter(function (b) { return b.owner !== 'p'; });
    s.flames = []; if (s.timeLeft < 30) s.timeLeft = 30;
    // push any enemy standing at the start corner away
    s.enemies.forEach(function (e) { if (e.alive && e.x + e.y < 6) { e.alive = false; e.dead = 0; s.kills++; } });
    s.events.push({ type: 'respawn' });
  }

  function nextLevel(s) {
    return newGame({ seed: s.seed, level: s.level + 1, score: s.score, lives: Math.min(5, s.lives + 1),
      power: s.power, maxBombs: s.maxBombs, speedLvl: s.speedLvl });
  }

  FW.Logic = { W: W, H: H, T: T, DIRS: DIRS, FUSE: FUSE, FLAME: FLAME, rng: rng, computeBlast: computeBlast, buildGrid: buildGrid,
    connected: connected, levelSpec: levelSpec, newGame: newGame, setDir: setDir, placeBomb: placeBomb, update: update,
    nextLevel: nextLevel, dangerMap: dangerMap, bombAt: bombAt, reflect: reflect, ENEMY: ENEMY };
})(typeof window !== 'undefined' ? window : this);
