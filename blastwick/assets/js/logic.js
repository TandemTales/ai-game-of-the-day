/* Blastwick - pure simulation (no DOM). Owner: logic. Namespace: BW.Logic */
(function (g) {
  'use strict';
  var BW = g.BW = g.BW || {};

  var W = 15, H = 13;
  var T = { FLOOR: 0, PILLAR: 1, SOFT: 2, WATER: 3 };
  var KINDS = ['cross', 'diag', 'ring'];
  var FUSE = 2.4, FLAME_T = 0.55, CHAIN_DELAY = 0.09;

  /* deterministic RNG (mulberry32) */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function stageConfig(stage) {
    return {
      enemies: Math.min(3 + stage, 11),
      hunterShare: Math.min(0.15 + stage * 0.08, 0.7),
      enemySpeed: Math.min(1.5 + stage * 0.12, 2.8),
      softDensity: 0.62,
      tideDelay: Math.max(40, 75 - stage * 4),
      tideStep: Math.max(3.2, 6 - stage * 0.3)
    };
  }

  function newGame(seed, opts) {
    opts = opts || {};
    var st = {
      seed: seed >>> 0, rand: null, time: 0, stage: 0, score: opts.score || 0,
      lives: opts.lives == null ? 3 : opts.lives,
      maxBombs: opts.maxBombs || 1, range: opts.range || 2, speed: opts.speed || 4.2,
      shield: !!opts.shield, unlocked: opts.unlocked || { cross: true, diag: false, ring: false },
      kind: 'cross', over: false
    };
    st.rand = rng(seed);
    startStage(st, opts.stage || 1);
    return st;
  }

  function startStage(st, stage) {
    var R = st.rand = rng(st.seed + stage * 7919);
    var cfg = stageConfig(stage);
    st.stage = stage; st.cfg = cfg; st.time = 0; st.tideRing = 0; st.tideWarn = false;
    st.grid = [];
    var x, y;
    for (y = 0; y < H; y++) {
      st.grid[y] = [];
      for (x = 0; x < W; x++) {
        var t = T.FLOOR;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0)) t = T.PILLAR;
        else if (R() < cfg.softDensity) t = T.SOFT;
        st.grid[y][x] = t;
      }
    }
    // keep spawn corner clear
    [[1, 1], [2, 1], [1, 2]].forEach(function (c) { st.grid[c[1]][c[0]] = T.FLOOR; });
    st.player = { x: 1.5, y: 1.5, dir: 'down', moving: false, hurt: 0, inv: 2, dead: 0, anim: 0 };
    st.bombs = []; st.flames = []; st.pickups = []; st.enemies = []; st.events = [];
    st.chains = []; st.pending = [];
    st.exit = null; st.exitOpen = false; st.cleared = false; st.clearTimer = 0; st.hidden = {};

    // hidden exit + pickups under soft blocks
    var softs = [];
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (st.grid[y][x] === T.SOFT && (x + y) > 8 && ringOf(x, y) >= 4) softs.push([x, y]);
    shuffle(softs, R);
    var ex = softs.pop();
    st.exit = { x: ex[0], y: ex[1] };
    var drops = ['bomb', 'range', 'speed', 'shield', 'bomb', 'range', 'diag', 'ring', 'life'];
    // diag/ring unlock tokens only if still locked
    for (var i = 0; i < drops.length && softs.length; i++) {
      var d = drops[i];
      if ((d === 'diag' || d === 'ring') && st.unlocked[d]) d = 'range';
      var s = softs.pop();
      st.hidden[s[0] + ',' + s[1]] = d;
    }
    for (i = 0; i < 6 && softs.length; i++) { s = softs.pop(); st.hidden[s[0] + ',' + s[1]] = (R() < 0.5 ? 'bomb' : 'range'); }

    // enemies on free floor far from spawn
    var free = [];
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      if (st.grid[y][x] === T.FLOOR && (x + y) > 9) free.push([x, y]);
    }
    shuffle(free, R);
    for (i = 0; i < cfg.enemies && free.length; i++) {
      var f = free.pop();
      var hunter = R() < cfg.hunterShare;
      st.enemies.push({
        kind: hunter ? 'hunter' : 'wisp', x: f[0] + 0.5, y: f[1] + 0.5, tx: f[0], ty: f[1],
        fx: f[0], fy: f[1], p: 1, speed: cfg.enemySpeed * (hunter ? 1.12 : 1), alive: true, dying: 0, phase: R() * 6
      });
    }
    // carve a few floor tiles around enemies so they can move
    st.enemies.forEach(function (e) {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = e.fx + d[0], ny = e.fy + d[1];
        if (st.grid[ny] && st.grid[ny][nx] === T.SOFT && R() < 0.7) { st.grid[ny][nx] = T.FLOOR; delete st.hidden[nx + ',' + ny]; }
      });
    });
    ensureExitNotFloor(st);
  }

  function ensureExitNotFloor(st) {
    if (st.grid[st.exit.y][st.exit.x] !== T.SOFT) {
      // carved away; relocate under another soft block
      for (var y = H - 2; y > 0; y--) for (var x = W - 2; x > 0; x--) {
        if (st.grid[y][x] === T.SOFT && !st.hidden[x + ',' + y]) { st.exit = { x: x, y: y }; return; }
      }
    }
  }

  function shuffle(a, R) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  }

  function bombAt(st, x, y) {
    for (var i = 0; i < st.bombs.length; i++) if (st.bombs[i].x === x && st.bombs[i].y === y) return st.bombs[i];
    return null;
  }

  /* solid for the player? */
  function solidFor(st, x, y, isPlayer) {
    if (x < 0 || y < 0 || x >= W || y >= H) return true;
    var t = st.grid[y][x];
    if (t === T.PILLAR || t === T.SOFT) return true;
    var b = bombAt(st, x, y);
    if (b && !(isPlayer && b.walk)) return true;
    return false;
  }

  function collides(st, px, py, r) {
    var x0 = Math.floor(px - r), x1 = Math.floor(px + r), y0 = Math.floor(py - r), y1 = Math.floor(py + r);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) if (solidFor(st, x, y, true)) return true;
    return false;
  }

  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function movePlayer(st, ax, ay, dt) {
    var p = st.player, r = 0.34, sp = st.speed;
    p.moving = false;
    if (!ax && !ay) return;
    var len = Math.sqrt(ax * ax + ay * ay);
    if (len > 1) { ax /= len; ay /= len; }
    // pad / stick magnitude gives analog speed; keyboard is 1
    var dx = ax * sp * dt, dy = ay * sp * dt;
    if (Math.abs(ax) > Math.abs(ay)) p.dir = ax > 0 ? 'right' : 'left'; else if (ay) p.dir = ay > 0 ? 'down' : 'up';
    p.moving = true; p.anim += dt * 9;
    var nx = p.x + dx;
    if (dx) {
      if (!collides(st, nx, p.y, r)) p.x = nx;
      else assist(st, p, dx, 0, sp * dt, r);
    }
    var ny = p.y + dy;
    if (dy) {
      if (!collides(st, p.x, ny, r)) p.y = ny;
      else assist(st, p, 0, dy, sp * dt, r);
    }
  }

  /* corner-slide: when blocked, glide toward the open lane's centre */
  function assist(st, p, dx, dy, step, r) {
    if (dx) {
      var row = Math.floor(p.y), off = p.y - (row + 0.5);
      var ahead = Math.floor(p.x + (dx > 0 ? 0.5 + r : -(0.5 + r)));
      if (Math.abs(off) < 0.5 && !solidFor(st, ahead, row, true)) {
        var ny = p.y - Math.sign(off) * Math.min(step, Math.abs(off));
        if (!collides(st, p.x, ny, r)) p.y = ny;
      } else {
        var other = row + (off > 0 ? 1 : -1);
        if (!solidFor(st, ahead, other, true) && Math.abs(off) > 0.15) {
          var ny2 = p.y + Math.sign(off) * step;
          if (!collides(st, p.x, ny2, r)) p.y = ny2;
        }
      }
    } else {
      var col = Math.floor(p.x), offx = p.x - (col + 0.5);
      var aheadY = Math.floor(p.y + (dy > 0 ? 0.5 + r : -(0.5 + r)));
      if (Math.abs(offx) < 0.5 && !solidFor(st, col, aheadY, true)) {
        var nx = p.x - Math.sign(offx) * Math.min(step, Math.abs(offx));
        if (!collides(st, nx, p.y, r)) p.x = nx;
      } else {
        var otherc = col + (offx > 0 ? 1 : -1);
        if (!solidFor(st, otherc, aheadY, true) && Math.abs(offx) > 0.15) {
          var nx2 = p.x + Math.sign(offx) * step;
          if (!collides(st, nx2, p.y, r)) p.x = nx2;
        }
      }
    }
  }

  function placeBomb(st) {
    var p = st.player;
    if (p.dead > 0 || st.over || st.cleared) return false;
    var x = Math.floor(p.x), y = Math.floor(p.y);
    if (bombAt(st, x, y) || st.grid[y][x] !== T.FLOOR) return false;
    var mine = 0;
    st.bombs.forEach(function (b) { if (b.owner === 'p') mine++; });
    if (mine >= st.maxBombs) return false;
    st.bombs.push({ x: x, y: y, t: FUSE, range: st.range, kind: st.kind, owner: 'p', walk: true, id: ++idc });
    st.events.push({ type: 'place', x: x, y: y });
    return true;
  }
  var idc = 0;

  function cycleKind(st) {
    var i = KINDS.indexOf(st.kind);
    for (var n = 1; n <= KINDS.length; n++) {
      var k = KINDS[(i + n) % KINDS.length];
      if (st.unlocked[k]) { st.kind = k; st.events.push({ type: 'kind', kind: k }); return k; }
    }
    return st.kind;
  }

  /* cells a bomb would flame, honouring walls. Returns [{x,y}] (start cell included) */
  function blastCells(st, b) {
    var cells = [{ x: b.x, y: b.y }];
    var r = b.range, i, d;
    function ray(dx, dy, arc) {
      for (i = 1; i <= r; i++) {
        var x = b.x + dx * i, y = b.y + dy * i;
        if (x < 0 || y < 0 || x >= W || y >= H) break;
        var t = st.grid[y][x];
        if (t === T.PILLAR) { if (arc && x > 0 && y > 0 && x < W - 1 && y < H - 1) continue; break; }
        cells.push({ x: x, y: y });
        if (t === T.SOFT) break;
      }
    }
    if (b.kind === 'cross') { ray(1, 0); ray(-1, 0); ray(0, 1); ray(0, -1); }
    else if (b.kind === 'diag') {
      // diagonal rays pass between pillars; always allowed to enter tiles that are not pillars
      ray(1, 1, 1); ray(1, -1, 1); ray(-1, 1, 1); ray(-1, -1, 1);
    } else {
      var rr = Math.max(1.5, r * 0.8 + 0.9);
      for (var y = -3; y <= 3; y++) for (var x = -3; x <= 3; x++) {
        if (!x && !y) continue;
        if (x * x + y * y <= rr * rr) {
          var cx = b.x + x, cy = b.y + y;
          if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
          if (st.grid[cy][cx] === T.PILLAR) continue;
          cells.push({ x: cx, y: cy });
        }
      }
    }
    return cells;
  }

  /* Queue a bomb to explode; chain depth drives score multiplier */
  function detonate(st, b, depth, chainId) {
    if (b.exploding) return;
    b.exploding = true;
    b.depth = depth; b.chain = chainId;
    b.t = Math.min(b.t, depth ? CHAIN_DELAY : 0);
  }

  function explode(st, b) {
    var i, cells = blastCells(st, b), depth = b.depth || 0;
    var chain = st.chains[b.chain];
    if (!chain) { chain = st.chains[b.chain] = { n: 0, max: 0 }; }
    chain.n++; chain.max = Math.max(chain.max, depth);
    st.bombs.splice(st.bombs.indexOf(b), 1);
    st.events.push({ type: 'boom', x: b.x, y: b.y, kind: b.kind, depth: depth, cells: cells });
    var mult = 1 + depth;
    cells.forEach(function (c) {
      st.flames.push({ x: c.x, y: c.y, t: FLAME_T, kind: b.kind });
      if (st.grid[c.y][c.x] === T.SOFT) {
        st.grid[c.y][c.x] = T.FLOOR;
        st.score += 10 * mult;
        st.events.push({ type: 'crate', x: c.x, y: c.y });
        var key = c.x + ',' + c.y;
        if (st.hidden[key]) { st.pickups.push({ x: c.x, y: c.y, kind: st.hidden[key], t: 0 }); delete st.hidden[key]; }
      } else {
        // destroy pickups caught in flames (keep exit safe)
        for (i = st.pickups.length - 1; i >= 0; i--) {
          var pk = st.pickups[i];
          if (pk.x === c.x && pk.y === c.y && pk.t > 0.4) st.pickups.splice(i, 1);
        }
      }
      var ob = bombAt(st, c.x, c.y);
      if (ob && !ob.exploding) detonate(st, ob, depth + 1, b.chain);
    });
    // damage
    st.enemies.forEach(function (e) {
      if (!e.alive) return;
      var ex = Math.floor(e.x), ey = Math.floor(e.y);
      var hit = cells.some(function (c) { return (c.x === ex && c.y === ey) || (c.x === e.tx && c.y === e.ty && e.p < 0.5); });
      if (hit) killEnemy(st, e, mult, b.chain);
    });
    var p = st.player;
    var px = Math.floor(p.x), py = Math.floor(p.y);
    if (cells.some(function (c) { return c.x === px && c.y === py; })) hurtPlayer(st, 'blast');
    st.pending.push(b.chain);
  }

  function killEnemy(st, e, mult, chainId) {
    e.alive = false; e.dying = 0.5;
    var pts = (e.kind === 'hunter' ? 250 : 150) * mult;
    st.score += pts;
    var chain = st.chains[chainId]; if (chain) chain.kills = (chain.kills || 0) + 1;
    st.events.push({ type: 'kill', x: e.x, y: e.y, pts: pts, mult: mult });
  }

  function hurtPlayer(st, why) {
    var p = st.player;
    if (p.dead > 0 || p.inv > 0 || st.cleared || st.over) return;
    if (st.shield) { st.shield = false; p.inv = 1.5; st.events.push({ type: 'shield-break' }); return; }
    st.lives--; p.dead = 1.4;
    st.events.push({ type: 'death', why: why, x: p.x, y: p.y });
    if (st.lives <= 0) { st.over = true; st.events.push({ type: 'gameover' }); }
  }

  function respawn(st) {
    var p = st.player, best = null, bd = 1e9;
    for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++) {
      if (st.grid[y][x] !== T.FLOOR || bombAt(st, x, y)) continue;
      if (ringOf(x, y) <= st.tideRing) continue;
      var d = Math.abs(x - 1) + Math.abs(y - 1) + (ringOf(x, y) <= st.tideRing + 1 ? 6 : 0);
      var near = st.enemies.some(function (e) { return e.alive && Math.abs(e.x - x - 0.5) + Math.abs(e.y - y - 0.5) < 3; });
      if (near) d += 20;
      if (d < bd) { bd = d; best = [x, y]; }
    }
    if (!best) best = [7, 6];
    p.x = best[0] + 0.5; p.y = best[1] + 0.5; p.dead = 0; p.inv = 2.5; p.moving = false;
    st.bombs.forEach(function (b) { if (Math.abs(b.x - best[0]) <= 1 && Math.abs(b.y - best[1]) <= 1) b.walk = true; });
  }

  function enemyPassable(st, x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    var t = st.grid[y][x];
    if (t !== T.FLOOR) return false;
    if (bombAt(st, x, y)) return false;
    for (var i = 0; i < st.flames.length; i++) if (st.flames[i].x === x && st.flames[i].y === y) return false;
    return true;
  }

  function bfsStep(st, sx, sy, gx, gy, maxD) {
    var key = function (x, y) { return y * W + x; };
    var seen = {}, q = [[sx, sy, null, 0]];
    seen[key(sx, sy)] = 1;
    while (q.length) {
      var c = q.shift();
      if (c[0] === gx && c[1] === gy) return c[2];
      if (c[3] >= maxD) continue;
      for (var d = 0; d < 4; d++) {
        var dd = [[1, 0], [-1, 0], [0, 1], [0, -1]][d];
        var nx = c[0] + dd[0], ny = c[1] + dd[1];
        if (seen[key(nx, ny)] || !enemyPassable(st, nx, ny)) continue;
        seen[key(nx, ny)] = 1;
        q.push([nx, ny, c[2] || dd, c[3] + 1]);
      }
    }
    return null;
  }

  function dangerTiles(st) {
    var set = {};
    st.bombs.forEach(function (b) { blastCells(st, b).forEach(function (c) { set[c.x + ',' + c.y] = 1; }); });
    return set;
  }

  function updateEnemy(st, e, dt, danger) {
    if (!e.alive) { e.dying -= dt; return; }
    e.phase += dt;
    var step = e.speed * dt;
    while (step > 0) {
      if (e.p >= 1) {
        // choose next tile
        e.fx = e.tx; e.fy = e.ty; e.p = 0;
        var choice = null, R = st.rand, opts = [];
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nx = e.fx + d[0], ny = e.fy + d[1];
          if (enemyPassable(st, nx, ny)) opts.push(d);
        });
        if (e.kind === 'hunter') {
          var px = Math.floor(st.player.x), py = Math.floor(st.player.y);
          if (st.player.dead <= 0 && Math.abs(px - e.fx) + Math.abs(py - e.fy) < 14) choice = bfsStep(st, e.fx, e.fy, px, py, 14);
        }
        if (!choice && opts.length) {
          var safe = opts.filter(function (d) { return !danger[(e.fx + d[0]) + ',' + (e.fy + d[1])]; });
          var pool = safe.length ? safe : opts;
          // prefer not reversing
          var fwd = pool.filter(function (d) { return !(d[0] === -e.dx && d[1] === -e.dy); });
          if (fwd.length) pool = fwd;
          choice = pool[Math.floor(R() * pool.length)];
        }
        if (!choice) { e.p = 1; e.tx = e.fx; e.ty = e.fy; break; }
        e.dx = choice[0]; e.dy = choice[1]; e.tx = e.fx + choice[0]; e.ty = e.fy + choice[1];
      }
      var need = 1 - e.p, use = Math.min(step, need);
      e.p += use; step -= use;
      e.x = e.fx + 0.5 + (e.tx - e.fx) * e.p;
      e.y = e.fy + 0.5 + (e.ty - e.fy) * e.p;
    }
  }

  function addScore(st, n) { st.score += n; }

  function update(st, dt, input) {
    st.events.length = 0;
    if (st.over) return;
    input = input || {};
    dt = Math.min(dt, 0.05);
    var p = st.player, i;
    st.time += dt;
    if (p.inv > 0) p.inv -= dt;

    if (p.dead > 0) { p.dead -= dt; if (p.dead <= 0 && !st.over) respawn(st); }
    else if (!st.cleared) {
      movePlayer(st, input.ax || 0, input.ay || 0, dt);
      if (input.bomb) placeBomb(st);
      if (input.kind) cycleKind(st);
    }
    // release walk-through of own bombs
    st.bombs.forEach(function (b) {
      if (b.walk && !(Math.abs(p.x - (b.x + 0.5)) < 0.5 + 0.34 && Math.abs(p.y - (b.y + 0.5)) < 0.5 + 0.34)) b.walk = false;
    });

    // bombs
    for (i = st.bombs.length - 1; i >= 0; i--) {
      var b = st.bombs[i];
      b.t -= dt;
      if (b.t <= 0) {
        if (!b.exploding) { b.exploding = true; b.depth = 0; b.chain = ++idc; }
        explode(st, b);
      }
    }
    // chain resolution
    while (st.pending.length) {
      var cid = st.pending.shift();
      var still = st.bombs.some(function (bb) { return bb.chain === cid; });
      var ch = st.chains[cid];
      if (!still && ch && !ch.done) {
        ch.done = true;
        if (ch.n > 1) {
          var bonus = ch.n * ch.n * 25;
          st.score += bonus;
          st.events.push({ type: 'chain', n: ch.n, bonus: bonus, x: p.x, y: p.y });
        }
      }
    }
    // flames
    for (i = st.flames.length - 1; i >= 0; i--) {
      var f = st.flames[i]; f.t -= dt;
      if (f.t <= 0) { st.flames.splice(i, 1); continue; }
      var px = Math.floor(p.x), py = Math.floor(p.y);
      if (f.x === px && f.y === py) hurtPlayer(st, 'flame');
    }

    // enemies
    var danger = dangerTiles(st);
    st.enemies.forEach(function (e) {
      updateEnemy(st, e, dt, danger);
      if (e.alive && p.dead <= 0) {
        var dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < 0.38 * 0.38) hurtPlayer(st, 'enemy');
      }
    });
    st.enemies = st.enemies.filter(function (e) { return e.alive || e.dying > 0; });

    // pickups
    for (i = st.pickups.length - 1; i >= 0; i--) {
      var pk = st.pickups[i]; pk.t += dt;
      if (p.dead <= 0 && Math.floor(p.x) === pk.x && Math.floor(p.y) === pk.y) {
        applyPickup(st, pk.kind); st.pickups.splice(i, 1);
      }
    }

    // exit
    var alive = st.enemies.filter(function (e) { return e.alive; }).length;
    if (!st.exitOpen && alive === 0 && st.grid[st.exit.y][st.exit.x] === T.FLOOR) {
      st.exitOpen = true; st.events.push({ type: 'exit-open' });
    }
    if (st.exitOpen && !st.cleared && p.dead <= 0 && Math.floor(p.x) === st.exit.x && Math.floor(p.y) === st.exit.y) {
      st.cleared = true; st.clearTimer = 1.6;
      var tb = Math.max(0, Math.round((90 - st.time) * 10)) * st.stage;
      st.score += 500 * st.stage + tb;
      st.events.push({ type: 'clear', bonus: 500 * st.stage + tb });
    }
    if (st.cleared) { st.clearTimer -= dt; if (st.clearTimer <= 0) nextStage(st); }

    updateTide(st);
  }

  function nextStage(st) {
    var keep = st;
    var score = st.score, lives = st.lives;
    startStage(st, st.stage + 1);
    st.score = score; st.lives = lives;
    st.events.push({ type: 'stage', stage: st.stage });
    return keep;
  }

  function applyPickup(st, k) {
    var pts = 0;
    if (k === 'bomb') { st.maxBombs = Math.min(st.maxBombs + 1, 6); }
    else if (k === 'range') { st.range = Math.min(st.range + 1, 7); }
    else if (k === 'speed') { st.speed = Math.min(st.speed + 0.5, 6.2); }
    else if (k === 'shield') { st.shield = true; }
    else if (k === 'life') { st.lives = Math.min(st.lives + 1, 6); }
    else if (k === 'diag' || k === 'ring') { st.unlocked[k] = true; st.kind = k; }
    st.score += 50 + pts;
    st.events.push({ type: 'pickup', kind: k });
  }

  /* The tide: after a delay the arena floods ring by ring from the edge */
  function ringOf(x, y) { return Math.min(x, y, W - 1 - x, H - 1 - y); }
  function updateTide(st) {
    var cfg = st.cfg, maxRing = 3;
    st.tideWarn = 0;
    if (st.tideRing >= maxRing) return;
    var since = st.time - cfg.tideDelay - st.tideRing * cfg.tideStep;
    if (since < 0) return;
    var left = cfg.tideStep - 1.4;
    if (since < left) { st.tideWarn = st.tideRing + 1; return; }
    // flood now
    var ring = st.tideRing + 1;
    st.tideRing++;
    floodRing(st, ring - 1).forEach(function (c) {
      var x = c[0], y = c[1];
      if (st.grid[y][x] === T.PILLAR) { st.grid[y][x] = T.WATER; return; }
      st.grid[y][x] = T.WATER;
      delete st.hidden[x + ',' + y];
      st.bombs = st.bombs.filter(function (b) { return !(b.x === x && b.y === y); });
      st.pickups = st.pickups.filter(function (k) { return !(k.x === x && k.y === y); });
    });
    st.events.push({ type: 'tide', ring: ring });
    var p = st.player;
    if (ringOf(Math.floor(p.x), Math.floor(p.y)) <= ring) { st.player.inv = 0; hurtPlayer(st, 'drown'); }
    st.enemies.forEach(function (e) {
      if (e.alive && (ringOf(Math.floor(e.x), Math.floor(e.y)) <= ring || ringOf(e.tx, e.ty) <= ring)) killEnemy(st, e, 1, 0);
    });
  }
  function floodRing(st, ring) {
    var cells = [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (ringOf(x, y) === ring + 1) cells.push([x, y]);
    }
    return cells;
  }

  g.BW.Logic = {
    W: W, H: H, T: T, KINDS: KINDS, FUSE: FUSE, FLAME_T: FLAME_T,
    rng: rng, stageConfig: stageConfig, newGame: newGame, update: update, placeBomb: placeBomb,
    cycleKind: cycleKind, blastCells: blastCells, bombAt: bombAt, movePlayer: movePlayer,
    startStage: startStage, floodRing: floodRing, applyPickup: applyPickup, collides: collides,
    hurtPlayer: hurtPlayer, nextStage: nextStage
  };
})(typeof window !== 'undefined' ? window : globalThis);
