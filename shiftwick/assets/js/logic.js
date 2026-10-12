/* Shiftwick - pure game logic (no DOM). Classic script; exposes window.SW.
   Deterministic: all randomness flows from state.seed via SW.rng. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var W = 19, H = 21;
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var DIR_LIST = ['up', 'left', 'down', 'right']; // tie-break order
  var OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  var HOUSE = { r0: 9, r1: 11, c0: 7, c1: 11, door: { c: 9, r: 9 }, home: { c: 9, r: 10 } };
  var PLAYER_START = { c: 9, r: 17 };
  var CORNERS = { gloam: { c: 17, r: 1 }, murk: { c: 1, r: 1 }, dusk: { c: 17, r: 19 }, fret: { c: 1, r: 19 } };
  var NAMES = ['gloam', 'murk', 'dusk', 'fret'];

  function rng(state) { // mulberry32 on state.seed
    state.seed = (state.seed + 0x6D2B79F5) | 0;
    var t = state.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function mkRng(seed) { var s = { seed: seed | 0 }; return function () { return rng(s); }; }

  /* ---------------- maze generation ---------------- */
  function inHouseBox(c, r) { return r >= HOUSE.r0 && r <= HOUSE.r1 && c >= HOUSE.c0 && c <= HOUSE.c1; }
  function isHouseInterior(c, r) { return r === 10 && c >= 8 && c <= 10; }

  function generateMaze(seed) {
    var rnd = mkRng(seed);
    var g = [], r, c;
    for (r = 0; r < H; r++) { g.push([]); for (c = 0; c < W; c++) g[r].push(1); }
    // lattice cells at odd coordinates; spanning tree on the left half (cols 1..9)
    var seen = {}, stack = [[9, 1]];
    function key(a, b) { return a + ',' + b; }
    seen[key(9, 1)] = true; g[1][9] = 0;
    while (stack.length) {
      var cur = stack[stack.length - 1], opts = [];
      [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(function (d) {
        var nc = cur[0] + d[0], nr = cur[1] + d[1];
        if (nc >= 1 && nc <= 9 && nr >= 1 && nr <= 19 && !seen[key(nc, nr)]) opts.push([nc, nr, d]);
      });
      if (!opts.length) { stack.pop(); continue; }
      var o = opts[Math.floor(rnd() * opts.length)];
      seen[key(o[0], o[1])] = true;
      g[o[1]][o[0]] = 0; g[cur[1] + o[2][1] / 2][cur[0] + o[2][0] / 2] = 0;
      stack.push([o[0], o[1]]);
    }
    // loops: knock out extra walls between lattice cells (left half)
    for (r = 1; r <= 19; r++) for (c = 1; c <= 9; c++) {
      if ((r + c) % 2 === 1 && g[r][c] === 1 && r % 2 + c % 2 === 1 && rnd() < 0.3) {
        // wall tile between two cells; open if both neighbours open
        var a = r % 2 === 1 ? [c - 1, r] : [c, r - 1], b = r % 2 === 1 ? [c + 1, r] : [c, r + 1];
        if (a[0] >= 1 && b[0] <= 9 && a[1] >= 1 && b[1] <= 19 && g[a[1]][a[0]] === 0 && g[b[1]][b[0]] === 0) g[r][c] = 0;
      }
    }
    // mirror left -> right
    for (r = 0; r < H; r++) for (c = 0; c < 9; c++) g[r][W - 1 - c] = g[r][c];
    // house + ring
    for (r = HOUSE.r0 - 1; r <= HOUSE.r1 + 1; r++) for (c = HOUSE.c0 - 1; c <= HOUSE.c1 + 1; c++) {
      var ring = r === HOUSE.r0 - 1 || r === HOUSE.r1 + 1 || c === HOUSE.c0 - 1 || c === HOUSE.c1 + 1;
      g[r][c] = ring ? 0 : 1;
    }
    for (c = 8; c <= 10; c++) g[10][c] = 0; // interior
    g[HOUSE.door.r][HOUSE.door.c] = 0;
    g[PLAYER_START.r][PLAYER_START.c - 1] = 0; g[PLAYER_START.r][PLAYER_START.c + 1] = 0;
    // remove dead ends (so a pursuer can never trap you in a stub)
    for (var pass = 0; pass < 3; pass++) {
      for (r = 1; r < H - 1; r++) for (c = 1; c < W - 1; c++) {
        if (g[r][c] || inHouseBox(c, r)) continue;
        var n = neighbours(g, c, r);
        if (n.length <= 1) {
          var cand = [];
          DIR_LIST.forEach(function (dn) {
            var wc = c + DIRS[dn][0], wr = r + DIRS[dn][1], fc = c + 2 * DIRS[dn][0], fr = r + 2 * DIRS[dn][1];
            if (wc > 0 && wc < W - 1 && wr > 0 && wr < H - 1 && fc > 0 && fc < W - 1 && fr > 0 && fr < H - 1 &&
                g[wr][wc] === 1 && g[fr][fc] === 0 && !inHouseBox(wc, wr) && !inHouseBox(fc, fr)) cand.push([wc, wr]);
          });
          if (cand.length) { var k = cand[Math.floor(rnd() * cand.length)]; g[k[1]][k[0]] = 0; }
        }
      }
    }
    return g;
  }
  function neighbours(g, c, r) {
    var out = [];
    DIR_LIST.forEach(function (d) {
      var nc = c + DIRS[d][0], nr = r + DIRS[d][1];
      if (nc >= 0 && nc < W && nr >= 0 && nr < H && !g[nr][nc]) out.push(d);
    });
    return out;
  }

  function newBoard(seed) {
    var walls = generateMaze(seed), cells = [], r, c;
    for (r = 0; r < H; r++) {
      cells.push([]);
      for (c = 0; c < W; c++) cells[r].push({ w: walls[r][c] ? 1 : 0, item: 0 });
    }
    var motes = 0;
    for (r = 0; r < H; r++) for (c = 0; c < W; c++) {
      if (!cells[r][c].w && !inHouseBox(c, r)) { cells[r][c].item = 1; motes++; }
    }
    cells[PLAYER_START.r][PLAYER_START.c].item = 0; motes--;
    [[1, 1], [17, 1], [1, 19], [17, 19]].forEach(function (p) {
      var cell = cells[p[1]][p[0]];
      if (!cell.w) { if (cell.item === 1) { } else motes++; cell.item = 2; }
    });
    return { cells: cells, motes: motes };
  }

  /* ---------------- passability / pathing ---------------- */
  function isDoor(c, r) { return c === HOUSE.door.c && r === HOUSE.door.r; }
  function passable(s, e, c, r) {
    if (r < 0 || r >= H || c < 0 || c >= W) return false;
    if (s.cells[r][c].w) return false;
    var houseTile = isHouseInterior(c, r) || isDoor(c, r);
    if (!houseTile) return true;
    if (e.kind === 'player') return false;
    if (isDoor(c, r)) return e.mode === 'leaving' || e.mode === 'eaten' || e.mode === 'house';
    return true; // interior is ghost-only
  }
  function bfsFrom(s, e, tc, tr) { // distance field from target over tiles passable for e
    var dist = [], r, c;
    for (r = 0; r < H; r++) { dist.push([]); for (c = 0; c < W; c++) dist[r].push(-1); }
    var q = [[tc, tr]]; dist[tr][tc] = 0;
    for (var i = 0; i < q.length; i++) {
      var p = q[i];
      for (var d = 0; d < 4; d++) {
        var dd = DIRS[DIR_LIST[d]], nc = p[0] + dd[0], nr = p[1] + dd[1];
        if (nc < 0 || nc >= W || nr < 0 || nr >= H || dist[nr][nc] >= 0) continue;
        if (!passable(s, e, nc, nr)) continue;
        dist[nr][nc] = dist[p[1]][p[0]] + 1; q.push([nc, nr]);
      }
    }
    return dist;
  }
  function nearestOpen(s, e, tc, tr) {
    if (passable(s, e, tc, tr)) return { c: tc, r: tr };
    var best = null, bd = 1e9;
    for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) {
      if (!passable(s, e, c, r) || isHouseInterior(c, r) || isDoor(c, r)) continue;
      var d = (c - tc) * (c - tc) + (r - tr) * (r - tr);
      if (d < bd) { bd = d; best = { c: c, r: r }; }
    }
    return best || { c: PLAYER_START.c, r: PLAYER_START.r };
  }
  /* connectivity: every walkable non-house tile reachable by the player */
  function connected(s, fromC, fromR) {
    var probe = { kind: 'player' }, dist = bfsFrom(s, probe, fromC, fromR), r, c;
    for (r = 0; r < H; r++) for (c = 0; c < W; c++) {
      if (!s.cells[r][c].w && !isHouseInterior(c, r) && !isDoor(c, r) && dist[r][c] < 0) return false;
    }
    return true;
  }

  /* ---------------- level parameters ---------------- */
  function levelParams(level) {
    var l = Math.max(1, level | 0);
    return {
      playerSpeed: Math.min(7.6, 6.2 + 0.18 * (l - 1)),
      ghostSpeed: Math.min(7.4, 5.5 + 0.22 * (l - 1)),
      frightSpeed: 3.6,
      eatenSpeed: 11,
      frightTime: Math.max(1.5, 7 - 0.8 * (l - 1)),
      shiftEvery: Math.max(9, 17 - 1.3 * (l - 1)),
      shiftFirst: 11,
      telegraph: 2.6,
      slideTime: 0.45,
      releaseAt: [0, 2.5, 7, 12],
      seed: 1013 + l * 7919
    };
  }

  /* ---------------- state ---------------- */
  function create(opts) {
    opts = opts || {};
    var s = {
      status: 'ready', // ready | playing | sliding | dying | levelclear | gameover
      level: 1, lives: 3, score: 0, extraGiven: false, time: 0,
      seed: (opts.seed != null ? opts.seed : 1013) | 0,
      events: [], chain: 0, hitThisLevel: false, fruit: null, fruitsSpawned: 0,
      shift: null, nextShift: 0, shiftsSurvived: 0, stats: { motes: 0, ghosts: 0, shifts: 0, perfect: 0 }
    };
    startLevel(s, 1, true);
    return s;
  }
  function makePlayer() {
    return { kind: 'player', x: PLAYER_START.c, y: PLAYER_START.r, dir: 'left', want: 'left', moving: false };
  }
  function makeGhost(name, i) {
    var homeC = [9, 8, 10, 9][i], homeR = i === 0 ? 8 : 10;
    return { kind: 'ghost', name: name, x: homeC, y: homeR, dir: 'left', mode: i === 0 ? 'out' : 'house', release: 0, frightened: false, bob: 0 };
  }
  function startLevel(s, level, fresh) {
    s.level = level; s.params = levelParams(level);
    var b = newBoard(s.params.seed);
    s.cells = b.cells; s.motesLeft = b.motes; s.totalMotes = b.motes;
    s.hitThisLevel = false; s.fruit = null; s.fruitsSpawned = 0; s.shift = null;
    s.pending = null;
    resetActors(s);
    s.nextShift = s.params.shiftFirst;
    s.phaseTime = 0; s.scatter = true; s.frightLeft = 0;
    s.status = 'ready'; s.readyLeft = 1.8;
    s.events.push({ t: 'level', level: level });
  }
  function resetActors(s) {
    s.player = makePlayer();
    s.ghosts = NAMES.map(makeGhost);
    s.ghosts.forEach(function (g, i) { g.release = s.params.releaseAt[i]; });
    s.frightLeft = 0; s.chain = 0;
  }

  /* ---------------- movement ---------------- */
  function speedOf(s, e) {
    var p = s.params;
    if (e.kind === 'player') return p.playerSpeed;
    if (e.mode === 'eaten') return p.eatenSpeed;
    if (e.mode === 'house' || e.mode === 'leaving') return 3.2;
    if (e.frightened) return p.frightSpeed;
    // elastic: ghosts slow down a bit when the player is far to keep tension fair
    return p.ghostSpeed;
  }
  function canGo(s, e, c, r, dir) { return passable(s, e, c + DIRS[dir][0], r + DIRS[dir][1]); }

  function stepEntity(s, e, dist) {
    var guard = 8;
    while (dist > 1e-6 && guard-- > 0) {
      var cx = Math.round(e.x), cy = Math.round(e.y);
      var atCenter = Math.abs(e.x - cx) < 1e-6 && Math.abs(e.y - cy) < 1e-6;
      if (atCenter) {
        e.x = cx; e.y = cy;
        decide(s, e, cx, cy);
        if (!e.moving) return;
      }
      var d = DIRS[e.dir], remain;
      // distance to next center along dir
      if (d[0]) remain = d[0] > 0 ? Math.ceil(e.x + 1e-6) - e.x : e.x - Math.floor(e.x - 1e-6);
      else remain = d[1] > 0 ? Math.ceil(e.y + 1e-6) - e.y : e.y - Math.floor(e.y - 1e-6);
      if (atCenter) remain = 1;
      var mv = Math.min(dist, remain);
      e.x += d[0] * mv; e.y += d[1] * mv; dist -= mv;
      // wrap interior of rows handled by shifts only; no tunnels
      if (Math.abs(e.x - Math.round(e.x)) < 1e-6) e.x = Math.round(e.x);
      if (Math.abs(e.y - Math.round(e.y)) < 1e-6) e.y = Math.round(e.y);
    }
  }
  function decide(s, e, c, r) {
    if (e.kind === 'player') {
      if (e.want && canGo(s, e, c, r, e.want)) { e.dir = e.want; e.moving = true; }
      else if (e.moving && canGo(s, e, c, r, e.dir)) { /* keep going */ }
      else e.moving = false;
      return;
    }
    ghostDecide(s, e, c, r);
  }
  function ghostTarget(s, g) {
    var p = s.player, pd = DIRS[p.dir], pc = Math.round(p.x), pr = Math.round(p.y);
    if (g.mode === 'eaten') return { c: HOUSE.home.c, r: HOUSE.home.r };
    if (g.mode === 'leaving' || g.mode === 'house') return { c: HOUSE.door.c, r: HOUSE.door.r - 1 };
    if (s.scatter && !g.frightened) return CORNERS[g.name];
    switch (g.name) {
      case 'gloam': return { c: pc, r: pr };
      case 'murk': return { c: pc + pd[0] * 4, r: pr + pd[1] * 4 };
      case 'dusk': {
        var gl = s.ghosts[0], ax = pc + pd[0] * 2, ay = pr + pd[1] * 2;
        return { c: ax + (ax - Math.round(gl.x)), r: ay + (ay - Math.round(gl.y)) };
      }
      default: { // fret: shy
        var dx = pc - g.x, dy = pr - g.y;
        return (dx * dx + dy * dy > 49) ? { c: pc, r: pr } : CORNERS.fret;
      }
    }
  }
  function ghostDecide(s, g, c, r) {
    // mode transitions at tile centres
    if (g.mode === 'eaten' && c === HOUSE.home.c && r === HOUSE.home.r) { g.mode = 'house'; g.frightened = false; g.release = s.time + 1.2; g.moving = false; }
    if (g.mode === 'house') {
      if (s.time < g.release) { g.moving = false; return; }
      g.mode = 'leaving';
    }
    if (g.mode === 'leaving' && r === HOUSE.door.r - 1) { g.mode = 'out'; }
    var tgt = ghostTarget(s, g);
    var opts = [];
    DIR_LIST.forEach(function (dn) { if (canGo(s, g, c, r, dn)) opts.push(dn); });
    if (!opts.length) { g.moving = false; return; }
    g.moving = true;
    var nonRev = opts.filter(function (dn) { return dn !== OPP[g.dir]; });
    if (nonRev.length) opts = nonRev;
    if (g.frightened && g.mode === 'out') {
      g.dir = opts[Math.floor(rng(s) * opts.length)];
      return;
    }
    if (opts.length === 1) { g.dir = opts[0]; return; }
    var probe = { kind: 'ghost', mode: g.mode === 'eaten' ? 'eaten' : (g.mode === 'leaving' ? 'leaving' : 'out') };
    var tp = nearestOpen(s, probe, tgt.c, tgt.r);
    var dist = bfsFrom(s, probe, tp.c, tp.r), best = null, bd = 1e9;
    opts.forEach(function (dn) {
      var nc = c + DIRS[dn][0], nr = r + DIRS[dn][1], dv = dist[nr][nc];
      if (dv < 0) dv = 500;
      // scatter / shy behaviour keeps wandering by using the Euclidean tie-break
      var ex = (nc - tgt.c) * (nc - tgt.c) + (nr - tgt.r) * (nr - tgt.r);
      var score = dv + ex * 0.001;
      if (score < bd) { bd = score; best = dn; }
    });
    g.dir = best;
  }

  /* ---------------- sliding rows ---------------- */
  function shiftCandidates(s) {
    var out = [], i;
    for (i = 1; i < H - 1; i++) {
      if (i >= HOUSE.r0 - 1 && i <= HOUSE.r1 + 1) continue;
      out.push({ axis: 'row', index: i });
    }
    for (i = 1; i < W - 1; i++) {
      if (i >= HOUSE.c0 - 1 && i <= HOUSE.c1 + 1) continue;
      out.push({ axis: 'col', index: i });
    }
    return out;
  }
  function lineHasWalls(s, sh) { // a shift that changes nothing is pointless
    var n = sh.axis === 'row' ? W - 2 : H - 2, first = null, varied = false;
    for (var k = 1; k <= n; k++) {
      var cell = sh.axis === 'row' ? s.cells[sh.index][k] : s.cells[k][sh.index];
      var v = cell.w * 3 + cell.item;
      if (first === null) first = v; else if (v !== first) varied = true;
    }
    return varied;
  }
  function applyShift(cells, sh) { // returns new cells array (shallow rows) with line rotated
    var n = sh.axis === 'row' ? W - 2 : H - 2, line = [], k;
    for (k = 1; k <= n; k++) line.push(sh.axis === 'row' ? cells[sh.index][k] : cells[k][sh.index]);
    var out = [];
    for (k = 0; k < n; k++) out[(k + sh.dir + n) % n] = line[k];
    for (k = 1; k <= n; k++) { if (sh.axis === 'row') cells[sh.index][k] = out[k - 1]; else cells[k][sh.index] = out[k - 1]; }
  }
  function chooseShift(s) {
    var cands = shiftCandidates(s).filter(function (c) { return lineHasWalls(s, c); });
    // prefer lines near the player so shifts matter; deterministic via rng
    var p = s.player, scored = cands.map(function (c) {
      var d = c.axis === 'row' ? Math.abs(c.index - p.y) : Math.abs(c.index - p.x);
      return { c: c, k: d + rng(s) * 7 };
    }).sort(function (a, b) { return a.k - b.k; });
    for (var i = 0; i < scored.length; i++) {
      var sh = { axis: scored[i].c.axis, index: scored[i].c.index, dir: rng(s) < 0.5 ? 1 : -1 };
      // trial apply on a copy-of-line basis
      applyShift(s.cells, sh);
      var ok = connected(s, Math.round(snapPos(s.player, sh).c), Math.round(snapPos(s.player, sh).r));
      applyShift(s.cells, { axis: sh.axis, index: sh.index, dir: -sh.dir });
      if (ok) return sh;
    }
    return null;
  }
  function snapPos(e, sh) { // where entity lands after snap + shift
    var c = Math.round(e.x), r = Math.round(e.y);
    if (sh.axis === 'row' && r === sh.index) c = wrapIdx(c, sh.dir, W - 2);
    if (sh.axis === 'col' && c === sh.index) r = wrapIdx(r, sh.dir, H - 2);
    return { c: c, r: r };
  }
  function wrapIdx(i, dir, n) { return ((i - 1 + dir + n) % n) + 1; }

  function beginTelegraph(s) {
    var sh = chooseShift(s);
    if (!sh) { s.nextShift = s.time + 3; return; }
    sh.t = 0; sh.dur = s.params.telegraph;
    s.shift = { phase: 'warn', axis: sh.axis, index: sh.index, dir: sh.dir, t: 0, dur: s.params.telegraph, slide: 0 };
    s.events.push({ t: 'warn', axis: sh.axis, index: sh.index, dir: sh.dir });
  }
  function commitShift(s) {
    var sh = s.shift;
    // snap every actor to its nearest tile centre, then move those on the line
    var actors = [s.player].concat(s.ghosts);
    actors.forEach(function (e) {
      var pos = snapPos(e, sh);
      e.fromX = Math.round(e.x); e.fromY = Math.round(e.y);
      e.x = pos.c; e.y = pos.r;
      if (e.kind === 'player') e.moving = false; else e.moving = false;
    });
    if (s.fruit) { var fp = snapPos({ x: s.fruit.c, y: s.fruit.r }, sh); s.fruit.c = fp.c; s.fruit.r = fp.r; }
    applyShift(s.cells, sh);
    sh.phase = 'slide'; sh.t = 0; sh.dur = s.params.slideTime;
    s.status = 'sliding';
    s.stats.shifts++;
    s.events.push({ t: 'slide', axis: sh.axis, index: sh.index, dir: sh.dir });
    // a shift that drops an actor into a wall is impossible: tiles move with actors
  }

  /* ---------------- main step ---------------- */
  function addScore(s, n, why, x, y) {
    var before = s.score;
    s.score += n;
    if (!s.extraGiven && before < 10000 && s.score >= 10000) { s.extraGiven = true; s.lives++; s.events.push({ t: 'extra' }); }
    s.events.push({ t: 'score', n: n, why: why, x: x, y: y });
  }
  function setDir(s, dir) { if (DIRS[dir]) s.player.want = dir; }

  function step(s, dt) {
    if (!(dt > 0) || !isFinite(dt)) return;
    dt = Math.min(dt, 1 / 20);
    if (s.status === 'gameover') return;
    if (s.status === 'ready') { s.readyLeft -= dt; if (s.readyLeft <= 0) s.status = 'playing'; return; }
    if (s.status === 'dying') { s.dyingLeft -= dt; if (s.dyingLeft <= 0) afterDeath(s); return; }
    if (s.status === 'levelclear') { s.clearLeft -= dt; if (s.clearLeft <= 0) startLevel(s, s.level + 1); return; }
    if (s.status === 'sliding') {
      s.shift.t += dt;
      if (s.shift.t >= s.shift.dur) {
        s.shift = null; s.status = 'playing';
        s.nextShift = s.time + s.params.shiftEvery;
        s.shiftsSurvived++;
        s.events.push({ t: 'slidedone' });
      }
      return;
    }
    s.time += dt;
    // shift scheduling
    if (!s.shift && s.time >= s.nextShift && s.frightLeft <= 0) beginTelegraph(s);
    if (s.shift && s.shift.phase === 'warn') {
      s.shift.t += dt;
      if (s.shift.t >= s.shift.dur) { commitShift(s); return; }
    }
    // scatter/chase cycle
    s.phaseTime += dt;
    var cycle = s.phaseTime % 27;
    var wasScatter = s.scatter;
    s.scatter = cycle < 6 && s.level < 6 ? true : (cycle < 5);
    if (s.time < 4) s.scatter = true;
    if (wasScatter !== s.scatter) reverseGhosts(s);
    // fright timer
    if (s.frightLeft > 0) {
      s.frightLeft -= dt;
      if (s.frightLeft <= 0) { s.frightLeft = 0; s.ghosts.forEach(function (g) { g.frightened = false; }); s.chain = 0; }
    }
    // player
    stepEntity(s, s.player, speedOf(s, s.player) * dt);
    eatAt(s);
    // ghosts
    s.ghosts.forEach(function (g) {
      g.bob += dt;
      if (g.mode === 'house' && s.time < g.release) return;
      stepEntity(s, g, speedOf(s, g) * dt);
    });
    s.ghosts.forEach(function (g) { if (g.mode === 'house' && s.time >= g.release) g.mode = 'leaving'; });
    // fruit
    if (!s.fruit && s.fruitsSpawned < 2 && s.motesLeft <= s.totalMotes - (s.fruitsSpawned ? 150 : 60)) {
      s.fruit = { c: PLAYER_START.c, r: PLAYER_START.r, left: 9.5, kind: Math.min(7, s.level - 1) };
      s.fruitsSpawned++;
      s.events.push({ t: 'fruit' });
    }
    if (s.fruit) { s.fruit.left -= dt; if (s.fruit.left <= 0) s.fruit = null; }
    collide(s);
  }
  function reverseGhosts(s) {
    s.ghosts.forEach(function (g) { if (g.mode === 'out' && g.moving && Math.abs(g.x - Math.round(g.x)) + Math.abs(g.y - Math.round(g.y)) < 1e-6) { /* reverse at centre */ g.dir = OPP[g.dir]; } });
  }
  function eatAt(s) {
    var p = s.player, c = Math.round(p.x), r = Math.round(p.y);
    if (Math.abs(p.x - c) > 0.5 || Math.abs(p.y - r) > 0.5) return;
    var cell = s.cells[r][c];
    if (cell.item === 1) {
      cell.item = 0; s.motesLeft--; s.stats.motes++; addScore(s, 10, 'mote', c, r); s.events.push({ t: 'mote' });
    } else if (cell.item === 2) {
      cell.item = 0; s.motesLeft--; addScore(s, 50, 'ember', c, r);
      s.frightLeft = s.params.frightTime; s.chain = 0;
      s.ghosts.forEach(function (g) { if (g.mode === 'out' || g.mode === 'leaving') { g.frightened = true; if (g.mode === 'out' && g.moving) g.dir = OPP[g.dir]; } });
      s.events.push({ t: 'ember' });
    }
    if (s.fruit && s.fruit.c === c && s.fruit.r === r) {
      var pts = [100, 300, 500, 700, 1000, 2000, 3000, 5000][s.fruit.kind] || 100;
      addScore(s, pts, 'fruit', c, r); s.fruit = null; s.events.push({ t: 'fruitget' });
    }
    if (s.motesLeft <= 0 && s.status === 'playing') {
      s.status = 'levelclear'; s.clearLeft = 2.4;
      var bonus = 500 + (s.hitThisLevel ? 0 : 1000);
      if (!s.hitThisLevel) s.stats.perfect++;
      addScore(s, bonus, 'clear', c, r);
      s.events.push({ t: 'clear', perfect: !s.hitThisLevel });
    }
  }
  function collide(s) {
    if (s.status !== 'playing') return;
    var p = s.player;
    for (var i = 0; i < s.ghosts.length; i++) {
      var g = s.ghosts[i];
      if (g.mode === 'house' || g.mode === 'eaten') continue;
      var dx = g.x - p.x, dy = g.y - p.y;
      if (dx * dx + dy * dy < 0.36) {
        if (g.frightened) {
          g.frightened = false; g.mode = 'eaten'; s.chain++; s.stats.ghosts++;
          var pts = 200 * Math.pow(2, Math.min(3, s.chain - 1));
          addScore(s, pts, 'ghost', g.x, g.y); s.events.push({ t: 'ghost', n: s.chain });
        } else {
          s.status = 'dying'; s.dyingLeft = 1.6; s.hitThisLevel = true;
          s.events.push({ t: 'die' });
          return;
        }
      }
    }
  }
  function afterDeath(s) {
    s.lives--;
    s.shift = null;
    if (s.lives <= 0) { s.status = 'gameover'; s.events.push({ t: 'gameover', score: s.score }); return; }
    resetActors(s);
    s.nextShift = s.time + s.params.shiftEvery;
    s.status = 'ready'; s.readyLeft = 1.6;
  }
  function drainEvents(s) { var e = s.events; s.events = []; return e; }

  SW.W = W; SW.H = H; SW.DIRS = DIRS; SW.OPP = OPP; SW.HOUSE = HOUSE; SW.PLAYER_START = PLAYER_START; SW.NAMES = NAMES;
  SW.generateMaze = generateMaze; SW.newBoard = newBoard; SW.create = create; SW.step = step; SW.setDir = setDir;
  SW.startLevel = startLevel; SW.levelParams = levelParams; SW.connected = connected; SW.passable = passable;
  SW.drainEvents = drainEvents; SW.beginTelegraph = beginTelegraph; SW.commitShift = commitShift;
  SW.isHouseInterior = isHouseInterior; SW.isDoor = isDoor; SW.bfsFrom = bfsFrom; SW.rng = rng;
})(typeof window !== 'undefined' ? window : this);
