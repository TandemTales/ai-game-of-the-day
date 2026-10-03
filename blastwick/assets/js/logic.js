/* Blastwick - pure game logic. No DOM. Everything hangs off window.BW. */
(function (root) {
  'use strict';
  var BW = root.BW = root.BW || {};

  var W = 15, H = 13;
  var C = { FLOOR: 0, WALL: 1, CRATE: 2, MIRROR_A: 3, MIRROR_B: 4 }; // A = '/', B = '\'
  var FUSE = 2.4, FLAME_T = 0.55, BASE_SPEED = 4.1, HALF = 0.34;
  var COLLAPSE_START = 95, COLLAPSE_STEP = 1.1;
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  BW.W = W; BW.H = H; BW.C = C; BW.FUSE = FUSE; BW.FLAME_T = FLAME_T;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  BW.rng = mulberry32;

  function idx(x, y) { return y * W + x; }
  function inb(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  function cellAt(w, x, y) { return inb(x, y) ? w.cells[idx(x, y)] : C.WALL; }
  function isMirror(c) { return c === C.MIRROR_A || c === C.MIRROR_B; }
  BW.cellAt = cellAt; BW.isMirror = isMirror;

  var SPAWNS = [[1, 1], [W - 2, H - 2], [W - 2, 1], [1, H - 2]];
  BW.SPAWNS = SPAWNS;

  function nearSpawn(x, y, d) {
    for (var i = 0; i < SPAWNS.length; i++) {
      if (Math.abs(SPAWNS[i][0] - x) + Math.abs(SPAWNS[i][1] - y) <= d) return true;
    }
    return false;
  }

  /* Reflect a travel direction off a mirror. '/' swaps and negates, '\' swaps. */
  function reflect(dx, dy, c) {
    return c === C.MIRROR_A ? [-dy, -dx] : [dy, dx];
  }
  BW.reflect = reflect;

  function generateArena(seed, round) {
    var rnd = mulberry32(seed * 7919 + round * 104729 + 17);
    var cells = new Uint8Array(W * H);
    var crateP = Math.min(0.78, 0.58 + round * 0.035);
    var x, y;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var c = C.FLOOR;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) c = C.WALL;
      else if (x % 2 === 0 && y % 2 === 0) c = C.WALL;
      else if (!nearSpawn(x, y, 2) && rnd() < crateP) c = C.CRATE;
      cells[idx(x, y)] = c;
    }
    // mirrors replace some open cells; keep them out of spawn zones
    var want = Math.min(3 + round, 9), tries = 0;
    while (want > 0 && tries++ < 400) {
      x = 1 + Math.floor(rnd() * (W - 2)); y = 1 + Math.floor(rnd() * (H - 2));
      if (cells[idx(x, y)] === C.WALL || nearSpawn(x, y, 3)) continue;
      cells[idx(x, y)] = rnd() < 0.5 ? C.MIRROR_A : C.MIRROR_B;
      want--;
    }
    return cells;
  }
  BW.generateArena = generateArena;

  function makeActor(id, isPlayer, round) {
    var s = SPAWNS[id];
    return {
      id: id, isPlayer: isPlayer, x: s[0] + 0.5, y: s[1] + 0.5, fx: 0, fy: 1,
      alive: true, maxBombs: 1, range: 2, speed: BASE_SPEED, moving: false,
      deadT: 0, kills: 0, anim: 0, shield: 0, invuln: isPlayer ? 1.2 : 0.4,
      ai: isPlayer ? null : { path: null, think: Math.random() * 0.3, mode: 'idle', skill: Math.min(1, 0.45 + round * 0.1) }
    };
  }

  /* opts: {seed, round, score, lives, powerups(for player carry-over)} */
  BW.createWorld = function (opts) {
    opts = opts || {};
    var round = opts.round || 1, seed = opts.seed == null ? 1 : opts.seed;
    var w = {
      round: round, seed: seed, cells: generateArena(seed, round), bombs: [], flames: [], powerups: [],
      actors: [], events: [], t: 0, state: 'play', endT: 0, score: opts.score || 0, lives: opts.lives == null ? 3 : opts.lives,
      rnd: mulberry32(seed * 31 + round * 977 + 5), collapseI: 0, collapseT: COLLAPSE_START, collapseCells: null,
      crates: 0, bankShots: 0, bestChain: 0, kills: 0, nextBomb: 1
    };
    for (var i = 0; i < 4; i++) w.actors.push(makeActor(i, i === 0, round));
    var p = opts.carry;
    if (p) { w.actors[0].maxBombs = p.maxBombs; w.actors[0].range = p.range; w.actors[0].speed = p.speed; }
    // spiral order for sudden-death collapse
    var order = [], x0 = 1, y0 = 1, x1 = W - 2, y1 = H - 2;
    while (x0 <= x1 && y0 <= y1) {
      var a; for (a = x0; a <= x1; a++) order.push([a, y0]);
      for (a = y0 + 1; a <= y1; a++) order.push([x1, a]);
      if (y1 > y0) for (a = x1 - 1; a >= x0; a--) order.push([a, y1]);
      if (x1 > x0) for (a = y1 - 1; a > y0; a--) order.push([x0, a]);
      x0++; y0++; x1--; y1--;
    }
    w.collapseCells = order;
    return w;
  };

  function solidFor(w, a, cx, cy) {
    var c = cellAt(w, cx, cy);
    if (c !== C.FLOOR) return true;
    for (var i = 0; i < w.bombs.length; i++) {
      var b = w.bombs[i];
      if (b.x === cx && b.y === cy && b.pass.indexOf(a.id) < 0) return true;
    }
    return false;
  }
  function blockedAt(w, a, x, y) {
    var x0 = Math.floor(x - HALF), x1 = Math.floor(x + HALF), y0 = Math.floor(y - HALF), y1 = Math.floor(y + HALF);
    for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) if (solidFor(w, a, cx, cy)) return true;
    return false;
  }

  function moveActor(w, a, mx, my, dt) {
    a.moving = false;
    if (!a.alive) return;
    var l = Math.hypot(mx, my);
    if (l < 0.15) return;
    mx /= l; my /= l;
    // dominant-axis movement keeps grid-like feel
    if (Math.abs(mx) >= Math.abs(my)) my = 0; else mx = 0;
    a.fx = mx; a.fy = my; a.moving = true; a.anim += dt * a.speed;
    var d = a.speed * dt;
    var nx = a.x + mx * d, ny = a.y + my * d;
    if (!blockedAt(w, a, nx, ny)) { a.x = nx; a.y = ny; }
    else {
      // corner assist: slide toward the lane centre if the lane ahead is open
      if (mx !== 0) {
        var row = Math.floor(a.y), ahead = Math.floor(a.x + mx * (HALF + 0.05 + d));
        if (!solidFor(w, a, ahead, row)) {
          var cy = row + 0.5, dy = Math.max(-d, Math.min(d, cy - a.y));
          if (!blockedAt(w, a, a.x, a.y + dy)) a.y += dy;
        }
      } else {
        var col = Math.floor(a.x), ay = Math.floor(a.y + my * (HALF + 0.05 + d));
        if (!solidFor(w, a, col, ay)) {
          var cx = col + 0.5, dx = Math.max(-d, Math.min(d, cx - a.x));
          if (!blockedAt(w, a, a.x + dx, a.y)) a.x += dx;
        }
      }
    }
  }

  /* Blast footprint with mirror reflection. Returns {cells:[{x,y,ref,mirror}], crates:[[x,y]]} */
  function computeBlast(w, bx, by, range) {
    var cells = [{ x: bx, y: by, ref: false, mirror: false }], crates = [], seen = {};
    seen[bx + ',' + by] = 1;
    for (var d = 0; d < 4; d++) {
      var dx = DIRS[d][0], dy = DIRS[d][1], cx = bx, cy = by, rem = range, ref = false;
      while (rem > 0) {
        cx += dx; cy += dy; rem--;
        var c = cellAt(w, cx, cy);
        if (c === C.WALL) break;
        var key = cx + ',' + cy;
        if (c === C.CRATE) { if (!seen[key]) { crates.push([cx, cy]); seen[key] = 1; cells.push({ x: cx, y: cy, ref: ref, mirror: false, crate: true }); } break; }
        if (isMirror(c)) {
          var r = reflect(dx, dy, c); dx = r[0]; dy = r[1]; ref = true;
          cells.push({ x: cx, y: cy, ref: true, mirror: true });
          continue;
        }
        if (!seen[key]) { seen[key] = 1; cells.push({ x: cx, y: cy, ref: ref, mirror: false }); }
      }
    }
    return { cells: cells, crates: crates };
  }
  BW.computeBlast = function (w, x, y, r) { return computeBlast(w, x, y, r); };

  function bombAt(w, x, y) {
    for (var i = 0; i < w.bombs.length; i++) if (w.bombs[i].x === x && w.bombs[i].y === y) return w.bombs[i];
    return null;
  }
  BW.bombAt = bombAt;

  function placeBomb(w, a) {
    if (!a.alive) return false;
    var cx = Math.floor(a.x), cy = Math.floor(a.y);
    if (bombAt(w, cx, cy) || cellAt(w, cx, cy) !== C.FLOOR) return false;
    var mine = 0, i;
    for (i = 0; i < w.bombs.length; i++) if (w.bombs[i].owner === a.id) mine++;
    if (mine >= a.maxBombs) return false;
    var pass = [];
    for (i = 0; i < w.actors.length; i++) {
      var o = w.actors[i];
      if (o.alive && Math.abs(o.x - (cx + 0.5)) < 0.5 + HALF && Math.abs(o.y - (cy + 0.5)) < 0.5 + HALF) pass.push(o.id);
    }
    w.bombs.push({ x: cx, y: cy, t: FUSE, owner: a.id, range: a.range, pass: pass, chain: 0, uid: w.nextBomb++ });
    w.events.push({ type: 'place', x: cx, y: cy, owner: a.id });
    return true;
  }

  function killActor(w, v, flame) {
    if (!v.alive || v.invuln > 0) return;
    if (v.shield > 0) { v.shield = 0; v.invuln = 1; w.events.push({ type: 'shield', id: v.id }); return; }
    v.alive = false; v.deadT = 0;
    var owner = flame ? w.actors[flame.owner] : null;
    var info = { type: 'death', id: v.id, x: v.x, y: v.y, killer: owner ? owner.id : -1, bank: !!(flame && flame.ref), chain: flame ? flame.chain : 0, ownBlast: !!owner && owner.id === v.id };
    if (owner && owner.id !== v.id) {
      owner.kills++;
      if (owner.isPlayer) {
        var pts = 1000 + (flame.ref ? 500 : 0) + Math.max(0, flame.chain - 1) * 250;
        w.score += pts; w.kills++;
        if (flame.ref) w.bankShots++;
        info.points = pts;
      }
    }
    w.events.push(info);
  }

  function explode(w, bomb, chain) {
    var i = w.bombs.indexOf(bomb);
    if (i < 0) return;
    w.bombs.splice(i, 1);
    chain = chain || 1;
    if (chain > w.bestChain) w.bestChain = chain;
    var blast = computeBlast(w, bomb.x, bomb.y, bomb.range);
    var reflected = false, k;
    for (k = 0; k < blast.cells.length; k++) {
      var bc = blast.cells[k];
      if (bc.ref) reflected = true;
      w.flames.push({ x: bc.x, y: bc.y, t: FLAME_T, max: FLAME_T, owner: bomb.owner, ref: bc.ref, chain: chain, mirror: bc.mirror });
      var ob = bombAt(w, bc.x, bc.y);
      if (ob) { ob.t = Math.min(ob.t, 0.06); ob.chain = Math.max(ob.chain, chain + 1); }
      for (var p = w.powerups.length - 1; p >= 0; p--) if (w.powerups[p].x === bc.x && w.powerups[p].y === bc.y && w.powerups[p].age > 0.4) { w.events.push({ type: 'puburn', x: bc.x, y: bc.y }); w.powerups.splice(p, 1); }
    }
    var owner = w.actors[bomb.owner];
    for (k = 0; k < blast.crates.length; k++) {
      var cr = blast.crates[k];
      w.cells[idx(cr[0], cr[1])] = C.FLOOR;
      w.crates++;
      if (owner && owner.isPlayer) w.score += 50;
      w.events.push({ type: 'crate', x: cr[0], y: cr[1] });
      var r = w.rnd();
      if (r < 0.34) {
        var kinds = ['bomb', 'range', 'speed', 'shield'], wts = [0.34, 0.34, 0.22, 0.10], acc = 0, kd = 'bomb', rr = w.rnd();
        for (var q = 0; q < 4; q++) { acc += wts[q]; if (rr < acc) { kd = kinds[q]; break; } }
        w.powerups.push({ x: cr[0], y: cr[1], kind: kd, age: 0 });
      }
    }
    w.events.push({ type: 'explode', x: bomb.x, y: bomb.y, ref: reflected, cells: blast.cells, chain: chain, owner: bomb.owner });
    if (reflected) w.events.push({ type: 'bounce', x: bomb.x, y: bomb.y });
    // blast hits immediately
    flameKill(w);
  }

  function flameKill(w) {
    for (var i = 0; i < w.actors.length; i++) {
      var a = w.actors[i]; if (!a.alive) continue;
      var cx = Math.floor(a.x), cy = Math.floor(a.y);
      for (var f = 0; f < w.flames.length; f++) {
        if (w.flames[f].x === cx && w.flames[f].y === cy) { killActor(w, a, w.flames[f]); break; }
      }
    }
  }

  function pickups(w, a) {
    if (!a.alive) return;
    for (var i = w.powerups.length - 1; i >= 0; i--) {
      var p = w.powerups[i];
      if (Math.floor(a.x) === p.x && Math.floor(a.y) === p.y) {
        if (p.kind === 'bomb') a.maxBombs = Math.min(6, a.maxBombs + 1);
        else if (p.kind === 'range') a.range = Math.min(9, a.range + 1);
        else if (p.kind === 'speed') a.speed = Math.min(6.6, a.speed + 0.45);
        else if (p.kind === 'shield') a.shield = 1;
        if (a.isPlayer) w.score += 100;
        w.events.push({ type: 'pickup', id: a.id, kind: p.kind, x: p.x, y: p.y });
        w.powerups.splice(i, 1);
      }
    }
  }

  /* ---------------- AI ---------------- */
  function dangerMap(w, extra) {
    var m = new Uint8Array(W * H), i, k;
    var list = w.bombs.slice();
    if (extra) list.push(extra);
    for (i = 0; i < list.length; i++) {
      var b = list[i], bl = computeBlast(w, b.x, b.y, b.range);
      for (k = 0; k < bl.cells.length; k++) m[idx(bl.cells[k].x, bl.cells[k].y)] = 1;
    }
    for (i = 0; i < w.flames.length; i++) m[idx(w.flames[i].x, w.flames[i].y)] = 2;
    return m;
  }

  function walkable(w, x, y) {
    return cellAt(w, x, y) === C.FLOOR && !bombAt(w, x, y);
  }

  /* BFS to first cell satisfying goal(x,y). avoid = danger map (cells to avoid unless start). */
  function bfs(w, sx, sy, goal, avoid, minBlock) {
    var prev = new Int16Array(W * H).fill(-2), q = [idx(sx, sy)], qi = 0;
    prev[q[0]] = -1;
    while (qi < q.length) {
      var cur = q[qi++], cx = cur % W, cy = (cur / W) | 0;
      if ((cx !== sx || cy !== sy) && goal(cx, cy)) {
        var path = [], n = cur;
        while (n !== -1) { path.push([n % W, (n / W) | 0]); n = prev[n]; }
        path.reverse(); path.shift();
        return path;
      }
      for (var d = 0; d < 4; d++) {
        var nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
        if (!inb(nx, ny)) continue;
        var ni = idx(nx, ny);
        if (prev[ni] !== -2 || !walkable(w, nx, ny)) continue;
        if (avoid && avoid[ni] >= (minBlock || 1)) continue;
        prev[ni] = cur; q.push(ni);
      }
    }
    return null;
  }

  function aiThink(w, a, dt) {
    var ai = a.ai, cx = Math.floor(a.x), cy = Math.floor(a.y), input = { mx: 0, my: 0, bomb: false };
    ai.think -= dt;
    var danger = dangerMap(w), here = danger[idx(cx, cy)];
    var targetCell = ai.path && ai.path.length ? ai.path[0] : null;
    if (ai.think <= 0) {
      ai.think = 0.12 + (1 - ai.skill) * 0.25;
      ai.path = null; ai.mode = 'idle';
      if (here) {
        ai.path = bfs(w, cx, cy, function (x, y) { return !danger[idx(x, y)]; }, danger, 2) || null;
        ai.mode = 'flee';
        // avoid walking through other cells in flames
        if (ai.path) for (var s = 0; s < ai.path.length; s++) if (danger[idx(ai.path[s][0], ai.path[s][1])] === 2) { ai.path = null; break; }
      } else {
        // decide whether to drop a bomb
        var wantBomb = false;
        if (a.alive && countBombs(w, a.id) < a.maxBombs && walkable(w, cx, cy)) {
          var fake = { x: cx, y: cy, range: a.range };
          var bl = computeBlast(w, cx, cy, a.range), value = 0, k, j;
          for (k = 0; k < bl.cells.length; k++) {
            for (j = 0; j < w.actors.length; j++) {
              var o = w.actors[j];
              if (o.id !== a.id && o.alive && Math.floor(o.x) === bl.cells[k].x && Math.floor(o.y) === bl.cells[k].y) value += 6;
              if (o.id === a.id) { /* self handled by escape test */ }
            }
          }
          value += bl.crates.length * 1.5;
          var dd = dangerMap(w, fake);
          var esc = bfs(w, cx, cy, function (x, y) { return !dd[idx(x, y)]; }, dd, 2);
          // an escape route must exist and be short enough to outrun the fuse
          if (value > 0 && esc && esc.length * (1 / a.speed) < FUSE - 0.5) {
            if (value >= 6 || w.rnd() < 0.35 + ai.skill * 0.4) wantBomb = true;
          }
        }
        if (wantBomb) { input.bomb = true; ai.think = 0.05; }
        else {
          // head toward nearest enemy (higher skill) or crate
          var hunt = ai.skill > 0.6 && w.rnd() < ai.skill;
          ai.path = bfs(w, cx, cy, function (x, y) {
            if (danger[idx(x, y)]) return false;
            if (hunt) {
              for (var j2 = 0; j2 < w.actors.length; j2++) {
                var o2 = w.actors[j2];
                if (o2.id !== a.id && o2.alive && Math.abs(Math.floor(o2.x) - x) + Math.abs(Math.floor(o2.y) - y) <= 1) return true;
              }
            }
            for (var d = 0; d < 4; d++) if (cellAt(w, x + DIRS[d][0], y + DIRS[d][1]) === C.CRATE) return true;
            return false;
          }, danger) || null;
          ai.mode = 'seek';
        }
      }
      targetCell = ai.path && ai.path.length ? ai.path[0] : null;
    }
    if (targetCell) {
      var tx = targetCell[0] + 0.5, ty = targetCell[1] + 0.5;
      var ddx = tx - a.x, ddy = ty - a.y;
      if (Math.abs(ddx) < 0.08 && Math.abs(ddy) < 0.08) { ai.path.shift(); }
      else if (Math.abs(ddx) > 0.06 && Math.abs(ddy) > 0.06) {
        // align to lane first
        if (Math.abs(ddx) > Math.abs(ddy)) input.my = Math.sign(ddy) * 0.5; else input.mx = Math.sign(ddx) * 0.5;
        if (Math.abs(ddx) > Math.abs(ddy)) { input.mx = Math.sign(ddx); input.my = 0; } else { input.my = Math.sign(ddy); input.mx = 0; }
      } else { input.mx = Math.abs(ddx) > 0.06 ? Math.sign(ddx) : 0; input.my = Math.abs(ddy) > 0.06 ? Math.sign(ddy) : 0; }
    }
    return input;
  }
  function countBombs(w, id) { var n = 0; for (var i = 0; i < w.bombs.length; i++) if (w.bombs[i].owner === id) n++; return n; }

  /* ---------------- Step ---------------- */
  /* input: player input {mx,my,bomb}. */
  BW.step = function (w, dt, input) {
    var i, a;
    w.events.length = 0;
    w.t += dt;
    for (i = 0; i < w.actors.length; i++) {
      a = w.actors[i];
      if (a.invuln > 0) a.invuln -= dt;
      if (!a.alive) { a.deadT += dt; continue; }
      var inp = a.isPlayer ? (input || {}) : (w.state === 'play' ? aiThink(w, a, dt) : {});
      moveActor(w, a, inp.mx || 0, inp.my || 0, dt);
      if (inp.bomb) placeBomb(w, a);
      pickups(w, a);
    }
    // release bomb pass-through once actors step off
    for (i = 0; i < w.bombs.length; i++) {
      var b = w.bombs[i];
      for (var p = b.pass.length - 1; p >= 0; p--) {
        var o = w.actors[b.pass[p]];
        if (!o.alive || Math.abs(o.x - (b.x + 0.5)) >= 0.5 + HALF || Math.abs(o.y - (b.y + 0.5)) >= 0.5 + HALF) b.pass.splice(p, 1);
      }
    }
    for (i = 0; i < w.powerups.length; i++) w.powerups[i].age += dt;
    // bombs
    for (i = w.bombs.length - 1; i >= 0; i--) { if (w.bombs[i]) w.bombs[i].t -= dt; }
    var guard = 0, fired = true;
    while (fired && guard++ < 60) {
      fired = false;
      for (i = 0; i < w.bombs.length; i++) {
        if (w.bombs[i].t <= 0) { explode(w, w.bombs[i], w.bombs[i].chain || 1); fired = true; break; }
      }
    }
    for (i = w.flames.length - 1; i >= 0; i--) { w.flames[i].t -= dt; if (w.flames[i].t <= 0) w.flames.splice(i, 1); }
    flameKill(w);
    // sudden death collapse
    if (w.state === 'play') {
      w.collapseT -= dt;
      if (w.collapseT <= 0 && w.collapseI < w.collapseCells.length) {
        w.collapseT = COLLAPSE_STEP;
        var cc = w.collapseCells[w.collapseI++];
        var cur = cellAt(w, cc[0], cc[1]);
        if (cur !== C.WALL) {
          w.cells[idx(cc[0], cc[1])] = C.WALL;
          var ob = bombAt(w, cc[0], cc[1]); if (ob) w.bombs.splice(w.bombs.indexOf(ob), 1);
          for (i = 0; i < w.actors.length; i++) {
            a = w.actors[i];
            if (a.alive && Math.floor(a.x) === cc[0] && Math.floor(a.y) === cc[1]) { a.shield = 0; a.invuln = 0; killActor(w, a, null); }
          }
          w.events.push({ type: 'collapse', x: cc[0], y: cc[1] });
        }
      }
    }
    // outcome
    if (w.state === 'play') {
      var player = w.actors[0], rivals = 0;
      for (i = 1; i < w.actors.length; i++) if (w.actors[i].alive) rivals++;
      if (!player.alive) { w.state = 'lost'; w.endT = 0; }
      else if (rivals === 0) {
        w.state = 'won'; w.endT = 0;
        var tb = Math.max(0, Math.round((COLLAPSE_START + 30 - w.t) * 10));
        w.timeBonus = tb; w.roundBonus = 500 * w.round;
        w.score += tb + w.roundBonus;
        w.events.push({ type: 'won' });
      }
    } else w.endT += dt;
    return w;
  };

  BW.COLLAPSE_START = COLLAPSE_START;
  BW.carryOf = function (w) { var p = w.actors[0]; return { maxBombs: p.maxBombs, range: p.range, speed: p.speed }; };
  BW.dangerMap = dangerMap;
})(typeof window !== 'undefined' ? window : globalThis);
