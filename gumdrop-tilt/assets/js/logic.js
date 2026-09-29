/* Gumdrop Tilt - deterministic rules. Classic script, one global: GT. No DOM access. */
(function (root) {
  'use strict';
  var W = 6, H = 12, COLORS = 5, SPAWN_X = 2, SPAWN_Y = 1;
  var CHAIN_BONUS = [0, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512];
  var GROUP_BONUS = [0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 10];
  var COLOR_BONUS = [0, 0, 3, 6, 12, 24];
  var TILT_EVERY = 8;   // pieces locked between tilts
  var TILT_WARN = 2;    // warning shown when this many pieces remain
  var POP_TIME = 0.34, SETTLE_TIME = 0.16, TILT_TIME = 0.55;

  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function makeGrid() { var g = []; for (var y = 0; y < H; y++) { g.push([]); for (var x = 0; x < W; x++) g[y].push(-1); } return g; }
  function nextPair(st) { return [Math.floor(st.rand() * COLORS), Math.floor(st.rand() * COLORS)]; }

  function createState(seed) {
    var st = { seed: seed | 0, rand: rng(seed | 0), grid: makeGrid(), score: 0, status: 'ready', phase: 'play', timer: 0,
      chain: 0, maxChain: 0, pieces: 0, sinceTilt: 0, tiltDir: 0, tiltPending: false, popping: [], events: [], fallTimer: 0,
      piece: null, queue: [], lastPop: 0, tiltChains: 0 };
    st.tiltDir = st.rand() < 0.5 ? -1 : 1;
    st.queue = [nextPair(st), nextPair(st)];
    return st;
  }
  function emit(st, type, data) { st.events.push({ type: type, data: data || null }); }
  function start(st) { if (st.status !== 'ready') return false; st.status = 'playing'; spawn(st); return true; }

  function spawn(st) {
    var pair = st.queue.shift(); st.queue.push(nextPair(st));
    st.piece = { x: SPAWN_X, y: SPAWN_Y, rot: 0, a: pair[0], b: pair[1] }; // a = pivot, b = satellite
    st.fallTimer = 0;
    if (!fits(st, st.piece)) { gameOver(st); }
  }
  function offs(rot) { return [[0, -1], [1, 0], [0, 1], [-1, 0]][((rot % 4) + 4) % 4]; }
  function cellsOf(p) { var o = offs(p.rot); return [{ x: p.x, y: p.y, c: p.a }, { x: p.x + o[0], y: p.y + o[1], c: p.b }]; }
  function fits(st, p) {
    var cs = cellsOf(p);
    for (var i = 0; i < 2; i++) { var c = cs[i]; if (c.x < 0 || c.x >= W || c.y >= H) return false; if (c.y >= 0 && st.grid[c.y][c.x] !== -1) return false; }
    return true;
  }
  function canAct(st) { return st.status === 'playing' && st.phase === 'play' && !!st.piece; }
  function move(st, dx) { if (!canAct(st)) return false; var p = { x: st.piece.x + dx, y: st.piece.y, rot: st.piece.rot, a: st.piece.a, b: st.piece.b }; if (!fits(st, p)) return false; st.piece = p; emit(st, 'move'); return true; }
  function rotate(st, dir) {
    if (!canAct(st)) return false; var q = st.piece, r = q.rot + (dir < 0 ? -1 : 1), kicks = [[0, 0], [-1, 0], [1, 0], [0, -1]];
    for (var i = 0; i < kicks.length; i++) { var p = { x: q.x + kicks[i][0], y: q.y + kicks[i][1], rot: ((r % 4) + 4) % 4, a: q.a, b: q.b }; if (fits(st, p)) { st.piece = p; emit(st, 'rotate'); return true; } }
    return false;
  }
  function stepDown(st) { var p = { x: st.piece.x, y: st.piece.y + 1, rot: st.piece.rot, a: st.piece.a, b: st.piece.b }; if (fits(st, p)) { st.piece = p; return true; } return false; }
  function softDrop(st) { if (!canAct(st)) return false; if (stepDown(st)) { st.score += 1; st.fallTimer = 0; return true; } lock(st); return false; }
  function hardDrop(st) { if (!canAct(st)) return 0; var n = 0; while (stepDown(st)) n++; st.score += n * 2; emit(st, 'hard'); lock(st); return n; }
  function fallInterval(st) { return Math.max(0.09, 0.85 - st.pieces * 0.012); }

  function lock(st) {
    var cs = cellsOf(st.piece), over = false;
    for (var i = 0; i < 2; i++) { if (cs[i].y < 0) over = true; else st.grid[cs[i].y][cs[i].x] = cs[i].c; }
    st.piece = null; st.pieces++; st.sinceTilt++; st.chain = 0; st.tiltChains = 0; emit(st, 'lock');
    if (over) { gameOver(st); return; }
    if (st.sinceTilt >= TILT_EVERY - TILT_WARN && !st.tiltPending) { st.tiltPending = true; emit(st, 'tiltWarn', st.tiltDir); }
    beginSettle(st, 0.001);
  }
  function gameOver(st) { st.status = 'lost'; st.piece = null; emit(st, 'gameover'); }

  function gravityDown(st) {
    var moved = false;
    for (var x = 0; x < W; x++) { var w = H - 1; for (var y = H - 1; y >= 0; y--) { var c = st.grid[y][x]; if (c !== -1) { if (w !== y) { st.grid[w][x] = c; st.grid[y][x] = -1; moved = true; } w--; } } }
    return moved;
  }
  function slide(st, dir) { // pack every row toward the wall in direction dir (-1 left, +1 right)
    var moved = false;
    for (var y = 0; y < H; y++) {
      var row = st.grid[y].filter(function (c) { return c !== -1; }), out = [];
      for (var i = 0; i < W - row.length; i++) out.push(-1);
      var packed = dir < 0 ? row.concat(out) : out.concat(row);
      for (var x = 0; x < W; x++) { if (st.grid[y][x] !== packed[x]) moved = true; st.grid[y][x] = packed[x]; }
    }
    return moved;
  }
  function findGroups(grid) {
    var seen = makeGrid(), groups = [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var c = grid[y][x]; if (c === -1 || seen[y][x] !== -1) continue;
      var stack = [[x, y]], cells = []; seen[y][x] = 1;
      while (stack.length) { var p = stack.pop(); cells.push(p); var d = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (var k = 0; k < 4; k++) { var nx = p[0] + d[k][0], ny = p[1] + d[k][1]; if (nx >= 0 && nx < W && ny >= 0 && ny < H && grid[ny][nx] === c && seen[ny][nx] === -1) { seen[ny][nx] = 1; stack.push([nx, ny]); } } }
      if (cells.length >= 4) groups.push({ color: c, cells: cells });
    }
    return groups;
  }
  function beginSettle(st, t) { st.phase = 'settle'; st.timer = t == null ? SETTLE_TIME : t; }
  function popGroups(st) {
    var groups = findGroups(st.grid); if (!groups.length) return false;
    st.chain++; if (st.tiltPhaseActive) st.tiltChains++; if (st.chain > st.maxChain) st.maxChain = st.chain;
    var n = 0, gb = 0, colors = {}, cnt = 0;
    groups.forEach(function (g) { n += g.cells.length; gb += GROUP_BONUS[Math.min(g.cells.length, GROUP_BONUS.length - 1)]; if (!colors[g.color]) { colors[g.color] = 1; cnt++; } });
    var mult = Math.max(1, (CHAIN_BONUS[Math.min(st.chain, CHAIN_BONUS.length - 1)] || 0) + gb + COLOR_BONUS[Math.min(cnt, 5)]);
    if (st.tiltPhaseActive) mult *= 2; // tilt-driven chains pay double
    var gained = 10 * n * mult; st.score += gained; st.lastPop = gained;
    st.popping = [];
    groups.forEach(function (g) { g.cells.forEach(function (p) { st.popping.push({ x: p[0], y: p[1], c: g.color }); st.grid[p[1]][p[0]] = -1; }); });
    st.phase = 'pop'; st.timer = POP_TIME; emit(st, 'pop', { chain: st.chain, n: n, gained: gained, tilt: !!st.tiltPhaseActive });
    return true;
  }
  function afterResolve(st) {
    st.tiltPhaseActive = false;
    if (st.tiltPending && st.sinceTilt >= TILT_EVERY) {
      st.tiltPending = false; st.sinceTilt = 0; st.phase = 'tilt'; st.timer = TILT_TIME; st.chain = 0;
      slide(st, st.tiltDir); emit(st, 'tilt', st.tiltDir); st.tiltDir = st.rand() < 0.5 ? -1 : 1; st.tiltPhaseActive = true; return;
    }
    var allClear = st.grid.every(function (r) { return r.every(function (c) { return c === -1; }); });
    if (allClear && st.pieces > 1) { st.score += 3000; emit(st, 'allclear'); }
    st.phase = 'play'; spawn(st);
  }
  function update(st, dt) {
    if (st.status !== 'playing') return;
    if (st.phase === 'play') {
      st.fallTimer += dt; var iv = fallInterval(st);
      while (st.fallTimer >= iv && st.phase === 'play' && st.piece) { st.fallTimer -= iv; if (!stepDown(st)) { lock(st); break; } }
      return;
    }
    st.timer -= dt; if (st.timer > 0) return;
    if (st.phase === 'settle') { gravityDown(st); if (!popGroups(st)) afterResolve(st); }
    else if (st.phase === 'pop') { st.popping = []; beginSettle(st); }
    else if (st.phase === 'tilt') { beginSettle(st); }
  }
  function advance(st, seconds) { var step = 1 / 60, n = Math.ceil(seconds / step); for (var i = 0; i < n; i++) update(st, step); }
  function ghost(st) { if (!st.piece) return null; var p = { x: st.piece.x, y: st.piece.y, rot: st.piece.rot, a: st.piece.a, b: st.piece.b }; while (true) { var q = { x: p.x, y: p.y + 1, rot: p.rot, a: p.a, b: p.b }; if (!fits(st, q)) break; p = q; } return cellsOf(p); }
  function drainEvents(st) { var e = st.events; st.events = []; return e; }

  root.GT = { W: W, H: H, COLORS: COLORS, TILT_EVERY: TILT_EVERY, TILT_WARN: TILT_WARN, createState: createState, start: start, move: move, rotate: rotate,
    softDrop: softDrop, hardDrop: hardDrop, update: update, advance: advance, findGroups: findGroups, cellsOf: cellsOf, ghost: ghost,
    drainEvents: drainEvents, slide: slide, gravityDown: gravityDown, fits: fits };
})(typeof globalThis !== 'undefined' ? globalThis : this);
