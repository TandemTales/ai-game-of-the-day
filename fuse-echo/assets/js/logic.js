/* Fuse Echo — pure game model. No DOM. Deterministic given a seed.
   Everything hangs off window.FE (or the vm context global in tests). */
(function (global) {
  'use strict';
  var FE = global.FE = global.FE || {};

  var W = 15, H = 13;
  var FUSE = 2.2, BLAST_LIFE = 0.45, ECHO_DELAY = 1.6, ECHO_LIFE = 0.45;
  var STEP = 1 / 60;
  var R = 0.36; // entity half-size in tiles

  FE.W = W; FE.H = H; FE.FUSE = FUSE; FE.BLAST_LIFE = BLAST_LIFE;
  FE.ECHO_DELAY = ECHO_DELAY; FE.ECHO_LIFE = ECHO_LIFE; FE.STEP = STEP;
  FE.FLOOR = 0; FE.WALL = 1; FE.CRATE = 2;

  /* ---------------- RNG ---------------- */
  function Rng(seed) { this.s = (seed >>> 0) || 1; }
  Rng.prototype.next = function () {
    var t = this.s += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
  FE.Rng = Rng;

  /* ---------------- arena ---------------- */
  var SPAWNS = [[1, 1], [W - 2, H - 2], [W - 2, 1], [1, H - 2]];
  FE.SPAWNS = SPAWNS;

  function isWall(x, y) {
    return x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1 || (x % 2 === 0 && y % 2 === 0);
  }
  FE.isWall = isWall;

  function nearSpawn(x, y) {
    for (var i = 0; i < SPAWNS.length; i++) {
      if (Math.abs(x - SPAWNS[i][0]) + Math.abs(y - SPAWNS[i][1]) <= 2) return true;
    }
    return false;
  }

  function makeGrid(rng, density) {
    var g = [];
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var v = 0;
        if (isWall(x, y)) v = 1;
        else if (!nearSpawn(x, y) && rng.next() < density) v = 2;
        g.push(v);
      }
    }
    return g;
  }

  /* ---------------- state ---------------- */
  var PLAYER_COLORS = ['#3ee6ff', '#ff5a7a', '#ffd23e', '#9d7bff'];

  function newEntity(id, tx, ty, isBot) {
    return {
      id: id, bot: !!isBot, x: tx + 0.5, y: ty + 0.5, alive: true,
      speed: 3.6, maxBombs: 1, range: 2, bombsOut: 0,
      face: 1, moving: false, walkT: 0, inv: 0, deadT: 0,
      color: PLAYER_COLORS[id % 4],
      // bot brain
      tx: tx, ty: ty, think: 0, dirx: 0, diry: 0, goalBomb: false, aggr: 0.5,
      // input
      ix: 0, iy: 0, wantBomb: false
    };
  }

  /* round: 1-based. carry: {maxBombs, range, speed} from previous rounds */
  FE.newGame = function (seed, opts) {
    opts = opts || {};
    var st = {
      seed: seed >>> 0, rng: new Rng(seed),
      round: 0, lives: opts.lives || 3, score: 0, kills: 0, best: 0,
      time: 0, state: 'menu', events: [], carry: { maxBombs: 1, range: 2, speed: 3.6 },
      roundTime: 0, banner: 0
    };
    return st;
  };

  FE.startRound = function (st, round) {
    st.round = round;
    st.rng = new Rng(st.seed * 31 + round * 977);
    var density = Math.min(0.62, 0.46 + round * 0.02);
    st.grid = makeGrid(st.rng, density);
    st.bombs = []; st.blasts = []; st.echoes = []; st.powerups = []; st.fx = [];
    st.hidden = {}; // powerups hidden under crates: "x,y" -> type
    for (var i = 0; i < st.grid.length; i++) {
      if (st.grid[i] === 2 && st.rng.next() < 0.3) {
        var r = st.rng.next();
        st.hidden[i] = r < 0.4 ? 'bomb' : r < 0.8 ? 'flame' : 'speed';
      }
    }
    var p = newEntity(0, SPAWNS[0][0], SPAWNS[0][1], false);
    p.maxBombs = st.carry.maxBombs; p.range = st.carry.range; p.speed = st.carry.speed;
    p.inv = 2;
    st.player = p;
    st.ents = [p];
    var nBots = Math.min(3, 1 + Math.ceil(round / 2));
    for (var b = 0; b < nBots; b++) {
      var sp = SPAWNS[b + 1];
      var bot = newEntity(b + 1, sp[0], sp[1], true);
      bot.speed = Math.min(4.4, 2.8 + round * 0.15);
      bot.range = 2 + (round > 3 ? 1 : 0);
      bot.maxBombs = round > 5 ? 2 : 1;
      bot.aggr = Math.min(0.95, 0.35 + round * 0.08);
      bot.think = st.rng.next() * 0.5;
      st.ents.push(bot);
    }
    st.state = 'play'; st.roundTime = 0; st.banner = 2.2; st.chainId = 0;
    st.clearT = 0; st.deathT = 0; st.roundKills = 0;
    st.events.push({ t: 'round', round: round });
  };

  /* ---------------- helpers ---------------- */
  function idx(x, y) { return y * W + x; }
  function cellAt(st, x, y) { return (x < 0 || y < 0 || x >= W || y >= H) ? 1 : st.grid[idx(x, y)]; }
  function bombAt(st, x, y) {
    for (var i = 0; i < st.bombs.length; i++) if (st.bombs[i].x === x && st.bombs[i].y === y) return st.bombs[i];
    return null;
  }
  FE.cellAt = cellAt; FE.bombAt = bombAt;

  /* A cell blocks entity e? bombs block unless e is still standing "inside" them. */
  function solidFor(st, e, x, y) {
    var c = cellAt(st, x, y);
    if (c !== 0) return true;
    var b = bombAt(st, x, y);
    if (b && !(b.pass && b.pass[e.id])) return true;
    return false;
  }

  function blastCells(st, bx, by, range) {
    var cells = [[bx, by]], crates = [];
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var d = 0; d < 4; d++) {
      for (var k = 1; k <= range; k++) {
        var x = bx + dirs[d][0] * k, y = by + dirs[d][1] * k;
        var c = cellAt(st, x, y);
        if (c === 1) break;
        cells.push([x, y]);
        if (c === 2) { crates.push([x, y]); break; }
      }
    }
    return { cells: cells, crates: crates };
  }
  FE.blastCells = blastCells;

  /* ---------------- bombs ---------------- */
  FE.placeBomb = function (st, e) {
    if (!e.alive || e.bombsOut >= e.maxBombs) return false;
    var tx = Math.floor(e.x), ty = Math.floor(e.y);
    if (bombAt(st, tx, ty) || cellAt(st, tx, ty) !== 0) return false;
    var pass = {};
    for (var i = 0; i < st.ents.length; i++) {
      var o = st.ents[i];
      if (o.alive && Math.floor(o.x) === tx && Math.floor(o.y) === ty) pass[o.id] = true;
    }
    st.bombs.push({ x: tx, y: ty, t: FUSE, range: e.range, owner: e.id, pass: pass, chain: 0 });
    e.bombsOut++;
    st.events.push({ t: 'place', id: e.id, x: tx, y: ty });
    return true;
  };

  function detonate(st, bomb, chain) {
    var i = st.bombs.indexOf(bomb);
    if (i < 0) return;
    st.bombs.splice(i, 1);
    var owner = st.ents[bomb.owner];
    if (owner) owner.bombsOut = Math.max(0, owner.bombsOut - 1);
    var bc = blastCells(st, bomb.x, bomb.y, bomb.range);
    var id = ++st.chainId;
    st.blasts.push({ cells: bc.cells, t: BLAST_LIFE, life: BLAST_LIFE, owner: bomb.owner, chain: chain, id: id, kind: 'blast', bx: bomb.x, by: bomb.y });
    // destroy crates
    for (var c = 0; c < bc.crates.length; c++) {
      var cx = bc.crates[c][0], cy = bc.crates[c][1], ci = idx(cx, cy);
      if (st.grid[ci] === 2) {
        st.grid[ci] = 0;
        if (bomb.owner === 0) st.score += 10 * Math.max(1, chain);
        st.events.push({ t: 'crate', x: cx, y: cy });
        if (st.hidden[ci]) {
          st.powerups.push({ x: cx, y: cy, type: st.hidden[ci], t: 0 });
          delete st.hidden[ci];
        }
      }
    }
    // echo: same pattern, later
    st.echoes.push({ cells: bc.cells.slice(), t: ECHO_DELAY, owner: bomb.owner, chain: chain, bx: bomb.x, by: bomb.y });
    st.events.push({ t: 'boom', x: bomb.x, y: bomb.y, chain: chain, cells: bc.cells.length });
    // chain: any bomb in the cells goes off too
    for (var k = 0; k < bc.cells.length; k++) {
      var b2 = bombAt(st, bc.cells[k][0], bc.cells[k][1]);
      if (b2) detonate(st, b2, chain + 1);
    }
    // powerups in blast are destroyed
    for (var p = st.powerups.length - 1; p >= 0; p--) {
      var pu = st.powerups[p];
      if (pu.t > 0.25 && inCells(bc.cells, pu.x, pu.y)) {
        st.powerups.splice(p, 1);
        st.events.push({ t: 'puburn', x: pu.x, y: pu.y });
      }
    }
  }

  function inCells(cells, x, y) {
    for (var i = 0; i < cells.length; i++) if (cells[i][0] === x && cells[i][1] === y) return true;
    return false;
  }

  /* ---------------- danger map (used by bots and UI hints) ---------------- */
  FE.dangerMap = function (st, extraBomb) {
    var m = new Array(W * H), i, j;
    for (i = 0; i < m.length; i++) m[i] = 0;
    function mark(cells, v) { for (var k = 0; k < cells.length; k++) m[idx(cells[k][0], cells[k][1])] = Math.max(m[idx(cells[k][0], cells[k][1])], v); }
    for (i = 0; i < st.blasts.length; i++) mark(st.blasts[i].cells, 3);
    for (i = 0; i < st.echoes.length; i++) mark(st.echoes[i].cells, 2);
    var bombs = st.bombs.slice();
    if (extraBomb) bombs.push(extraBomb);
    for (i = 0; i < bombs.length; i++) {
      var bc = blastCells(st, bombs[i].x, bombs[i].y, bombs[i].range);
      mark(bc.cells, 1);
    }
    // chain reaction: bombs inside danger spread danger
    var changed = true, guard = 0;
    while (changed && guard++ < 8) {
      changed = false;
      for (j = 0; j < bombs.length; j++) {
        if (m[idx(bombs[j].x, bombs[j].y)] > 0 && !bombs[j]._spread) {
          bombs[j]._spread = true;
          var bc2 = blastCells(st, bombs[j].x, bombs[j].y, bombs[j].range);
          mark(bc2.cells, 1); changed = true;
        }
      }
    }
    for (j = 0; j < bombs.length; j++) delete bombs[j]._spread;
    return m;
  };

  /* ---------------- movement ---------------- */
  function collides(st, e, nx, ny) {
    var x0 = Math.floor(nx - R), x1 = Math.floor(nx + R), y0 = Math.floor(ny - R), y1 = Math.floor(ny + R);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) if (solidFor(st, e, x, y)) return true;
    return false;
  }

  function moveEntity(st, e, dx, dy, dt) {
    e.moving = false;
    if (!dx && !dy) return;
    var sp = e.speed * dt;
    var mvx = dx * sp, mvy = dy * sp;
    // move axis by axis with corner assist
    if (mvx) {
      if (!collides(st, e, e.x + mvx, e.y)) { e.x += mvx; e.moving = true; }
      else {
        var cy = Math.floor(e.y) + 0.5, off = cy - e.y;
        if (Math.abs(off) > 0.001 && Math.abs(off) <= 0.42) {
          var ny = e.y + Math.sign(off) * Math.min(Math.abs(off), sp);
          if (!collides(st, e, e.x, ny)) { e.y = ny; e.moving = true; }
        }
      }
      e.face = mvx > 0 ? 1 : -1;
    } else if (mvy) {
      if (!collides(st, e, e.x, e.y + mvy)) { e.y += mvy; e.moving = true; }
      else {
        var cx = Math.floor(e.x) + 0.5, offx = cx - e.x;
        if (Math.abs(offx) > 0.001 && Math.abs(offx) <= 0.42) {
          var nx = e.x + Math.sign(offx) * Math.min(Math.abs(offx), sp);
          if (!collides(st, e, nx, e.y)) { e.x = nx; e.moving = true; }
        }
      }
    }
    if (e.moving) e.walkT += dt * e.speed;
    // clear bomb pass flags once the entity has left the bomb cell
    for (var i = 0; i < st.bombs.length; i++) {
      var b = st.bombs[i];
      if (b.pass[e.id]) {
        if (Math.abs(e.x - (b.x + 0.5)) > 0.5 + R || Math.abs(e.y - (b.y + 0.5)) > 0.5 + R) delete b.pass[e.id];
      }
    }
  }

  /* ---------------- bot AI ---------------- */
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function bfs(st, e, sx, sy, danger, maxDepth, stopFn, blockedExtra, fleeing) {
    var dist = {}, prev = {}, q = [[sx, sy]], head = 0;
    dist[idx(sx, sy)] = 0;
    while (head < q.length) {
      var cur = q[head++], cd = dist[idx(cur[0], cur[1])];
      if (stopFn(cur[0], cur[1], cd)) return { x: cur[0], y: cur[1], prev: prev, dist: dist };
      if (cd >= maxDepth) continue;
      for (var d = 0; d < 4; d++) {
        var nx = cur[0] + DIRS[d][0], ny = cur[1] + DIRS[d][1], ni = idx(nx, ny);
        if (dist[ni] !== undefined) continue;
        if (cellAt(st, nx, ny) !== 0) continue;
        if (bombAt(st, nx, ny)) continue;
        if (blockedExtra && blockedExtra(nx, ny)) continue;
        if (danger[ni] > 0) {
          if (!fleeing) continue;
          if (danger[ni] >= 2 && cd >= 1) continue;
        }
        dist[ni] = cd + 1; prev[ni] = idx(cur[0], cur[1]);
        q.push([nx, ny]);
      }
    }
    return null;
  }

  function firstStep(res, sx, sy) {
    var i = idx(res.x, res.y), start = idx(sx, sy), safety = 0;
    while (res.prev[i] !== undefined && res.prev[i] !== start && safety++ < 200) i = res.prev[i];
    return [i % W, Math.floor(i / W)];
  }

  function botThink(st, e) {
    var tx = Math.floor(e.x), ty = Math.floor(e.y);
    var danger = FE.dangerMap(st);
    var here = danger[idx(tx, ty)];
    e.goalBomb = false;
    var target = null;
    if (here > 0) {
      // flee: nearest cell with no danger
      var res = bfs(st, e, tx, ty, danger, 9, function (x, y) { return danger[idx(x, y)] === 0; }, null, true);
      if (res) { target = firstStep(res, tx, ty); }
      else target = [tx, ty];
    } else {
      // consider bombing
      var wantBomb = false;
      if (e.bombsOut < e.maxBombs && !bombAt(st, tx, ty)) {
        var bc = blastCells(st, tx, ty, e.range);
        var hitsCrate = bc.crates.length > 0;
        var hitsPlayer = false;
        for (var i = 0; i < st.ents.length; i++) {
          var o = st.ents[i];
          if (o !== e && o.alive && inCells(bc.cells, Math.floor(o.x), Math.floor(o.y))) hitsPlayer = true;
        }
        if ((hitsPlayer && st.rng.next() < 0.5 + e.aggr * 0.5) || (hitsCrate && st.rng.next() < 0.35 + e.aggr * 0.3)) {
          // is there an escape if we place here?
          var fake = { x: tx, y: ty, range: e.range };
          var d2 = FE.dangerMap(st, fake);
          var esc = bfs(st, e, tx, ty, d2, 6, function (x, y, dd) { return dd > 0 && d2[idx(x, y)] === 0; },
            function (x, y) { return x === tx && y === ty; }, true);
          if (esc) wantBomb = true;
        }
      }
      if (wantBomb) { FE.placeBomb(st, e); e.think = 0.05; return; }
      // wander towards goal: powerup > player (aggr) > nearest crate
      var goalFn;
      var pl = st.player;
      var seekPlayer = pl.alive && st.rng.next() < e.aggr;
      goalFn = function (x, y) {
        for (var p = 0; p < st.powerups.length; p++) if (st.powerups[p].x === x && st.powerups[p].y === y) return true;
        return false;
      };
      var res2 = bfs(st, e, tx, ty, danger, 7, goalFn);
      if (!res2) {
        if (seekPlayer) {
          var px = Math.floor(pl.x), py = Math.floor(pl.y);
          res2 = bfs(st, e, tx, ty, danger, 40, function (x, y) { return Math.abs(x - px) + Math.abs(y - py) <= 1; });
        }
        if (!res2) {
          res2 = bfs(st, e, tx, ty, danger, 40, function (x, y) {
            for (var d = 0; d < 4; d++) if (cellAt(st, x + DIRS[d][0], y + DIRS[d][1]) === 2 && !(x === tx && y === ty)) return true;
            return false;
          });
        }
      }
      if (res2 && (res2.x !== tx || res2.y !== ty)) target = firstStep(res2, tx, ty);
      else {
        // random safe neighbour
        var opts = [];
        for (var d = 0; d < 4; d++) {
          var nx = tx + DIRS[d][0], ny = ty + DIRS[d][1];
          if (cellAt(st, nx, ny) === 0 && !bombAt(st, nx, ny) && danger[idx(nx, ny)] === 0) opts.push([nx, ny]);
        }
        if (opts.length) target = opts[st.rng.int(0, opts.length - 1)];
        else target = [tx, ty];
        // standing adjacent to a crate with nothing to do: bomb it
      }
    }
    e.tx = target[0]; e.ty = target[1];
    e.think = 0.0;
  }

  function botUpdate(st, e, dt) {
    var cx = Math.floor(e.x), cy = Math.floor(e.y);
    var gx = e.tx + 0.5, gy = e.ty + 0.5;
    e.think -= dt;
    var atGoal = Math.abs(e.x - gx) < 0.06 && Math.abs(e.y - gy) < 0.06;
    if (atGoal && e.think <= 0) { botThink(st, e); gx = e.tx + 0.5; gy = e.ty + 0.5; }
    else if (e.think <= -0.35) { botThink(st, e); gx = e.tx + 0.5; gy = e.ty + 0.5; } // stuck guard
    var dx = gx - e.x, dy = gy - e.y, ix = 0, iy = 0;
    // align on the perpendicular axis first so we stay in lanes
    if (Math.abs(dx) > 0.05 && Math.abs(dy) < 0.4 && Math.abs(dy) > 0.02 && cx === e.tx) { iy = Math.sign(dy); }
    else if (Math.abs(dx) > 0.05) ix = Math.sign(dx);
    else if (Math.abs(dy) > 0.05) iy = Math.sign(dy);
    // overshoot protection: snap when very close
    var step = e.speed * dt;
    if (ix && Math.abs(dx) < step) { e.x = gx; ix = 0; }
    if (iy && Math.abs(dy) < step) { e.y = gy; iy = 0; }
    moveEntity(st, e, ix, iy, dt);
  }

  /* ---------------- score/kill ---------------- */
  function killEntity(st, e, blast) {
    if (!e.alive || e.inv > 0) return;
    e.alive = false; e.deadT = 0;
    st.events.push({ t: 'death', id: e.id, x: e.x, y: e.y, player: !e.bot });
    if (e.bot) {
      var ch = Math.max(1, (blast.chain || 0) + 1);
      var echo = blast.kind === 'echo';
      var pts = 500 * ch * (echo ? 2 : 1);
      if (blast.owner === 0 || echo) st.score += pts;
      st.kills++; st.roundKills++;
      st.events.push({ t: 'kill', x: e.x, y: e.y, pts: pts, chain: ch, echo: echo });
    }
  }

  /* ---------------- step ---------------- */
  FE.step = function (st, dt) {
    if (st.state !== 'play') return;
    var i, e;
    st.time += dt; st.roundTime += dt;
    if (st.banner > 0) st.banner -= dt;

    // player input
    var p = st.player;
    if (p.alive) {
      moveEntity(st, p, p.ix, p.iy, dt);
      if (p.wantBomb) { FE.placeBomb(st, p); p.wantBomb = false; }
    }
    if (p.inv > 0) p.inv -= dt;
    // bots
    var freezeBots = st.banner > 1.2;
    for (i = 1; i < st.ents.length; i++) {
      e = st.ents[i];
      if (!e.alive) { e.deadT += dt; continue; }
      if (!freezeBots) botUpdate(st, e, dt);
    }
    if (!p.alive) p.deadT += dt;

    // pickups
    for (i = 0; i < st.ents.length; i++) {
      e = st.ents[i];
      if (!e.alive) continue;
      for (var k = st.powerups.length - 1; k >= 0; k--) {
        var pu = st.powerups[k];
        if (Math.floor(e.x) === pu.x && Math.floor(e.y) === pu.y) {
          if (pu.type === 'bomb') e.maxBombs = Math.min(5, e.maxBombs + 1);
          else if (pu.type === 'flame') e.range = Math.min(7, e.range + 1);
          else e.speed = Math.min(5.4, e.speed + 0.5);
          if (!e.bot) {
            st.score += 100;
            st.carry.maxBombs = e.maxBombs; st.carry.range = e.range; st.carry.speed = e.speed;
          }
          st.powerups.splice(k, 1);
          st.events.push({ t: 'pickup', type: pu.type, x: pu.x, y: pu.y, player: !e.bot });
        }
      }
    }
    for (i = 0; i < st.powerups.length; i++) st.powerups[i].t += dt;

    // bombs
    for (i = st.bombs.length - 1; i >= 0; i--) {
      var b = st.bombs[i];
      if (!b) continue;
      b.t -= dt;
      if (b.t <= 0) detonate(st, b, 0);
    }
    // echoes
    for (i = st.echoes.length - 1; i >= 0; i--) {
      var ec = st.echoes[i];
      ec.t -= dt;
      if (ec.t <= 0) {
        st.echoes.splice(i, 1);
        st.blasts.push({ cells: ec.cells, t: ECHO_LIFE, life: ECHO_LIFE, owner: ec.owner, chain: ec.chain, id: ++st.chainId, kind: 'echo', bx: ec.bx, by: ec.by });
        st.events.push({ t: 'echo', x: ec.bx, y: ec.by });
        for (var c = 0; c < ec.cells.length; c++) {
          var bb = bombAt(st, ec.cells[c][0], ec.cells[c][1]);
          if (bb) detonate(st, bb, ec.chain + 1);
        }
      }
    }
    // blasts hurt
    for (i = st.blasts.length - 1; i >= 0; i--) {
      var bl = st.blasts[i];
      bl.t -= dt;
      for (var j = 0; j < st.ents.length; j++) {
        e = st.ents[j];
        if (e.alive && inCells(bl.cells, Math.floor(e.x), Math.floor(e.y))) killEntity(st, e, bl);
      }
      if (bl.t <= 0) st.blasts.splice(i, 1);
    }

    // round end
    var botsAlive = 0;
    for (i = 1; i < st.ents.length; i++) if (st.ents[i].alive) botsAlive++;
    if (!p.alive) {
      st.deathT += dt;
      if (st.deathT > 1.6) {
        st.lives--;
        if (st.lives <= 0) { st.state = 'over'; st.best = Math.max(st.best, st.score); st.events.push({ t: 'over', score: st.score }); }
        else { st.carry.maxBombs = Math.max(1, st.carry.maxBombs - 0); FE.startRound(st, st.round); }
      }
    } else if (botsAlive === 0) {
      st.clearT += dt;
      if (st.clearT > 1.4) {
        var tb = Math.max(0, Math.round((90 - st.roundTime) * 10));
        var bonus = 1000 + tb + (p.inv > 0 ? 0 : 0);
        st.score += bonus;
        st.events.push({ t: 'clear', bonus: bonus, timeBonus: tb, round: st.round });
        st.state = 'clear';
      }
    }
  };

  FE.nextRound = function (st) { FE.startRound(st, st.round + 1); };

  FE.setInput = function (st, ix, iy, bomb) {
    var p = st.player;
    if (!p) return;
    p.ix = ix; p.iy = iy;
    if (bomb) p.wantBomb = true;
  };

  FE.drainEvents = function (st) { var ev = st.events; st.events = []; return ev; };

  FE.inCells = inCells;
})(typeof window !== 'undefined' ? window : globalThis);
