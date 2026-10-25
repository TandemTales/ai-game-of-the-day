(function (global) {
  'use strict';
  var GW = global.GW = global.GW || {};
  var W = 10, H = 20;
  var SHAPES = {
    I: ['....', '####', '....', '....'], O: ['.##.', '.##.', '....', '....'],
    T: ['.#..', '###.', '....', '....'], S: ['.##.', '##..', '....', '....'],
    Z: ['##..', '.##.', '....', '....'], J: ['#...', '###.', '....', '....'],
    L: ['..#.', '###.', '....', '....']
  };
  var COLORS = { I: '#63d9e8', O: '#f5cb63', T: '#bd92fa', S: '#8ee09d',
    Z: '#f17d82', J: '#82a7ef', L: '#efa66d' };
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function random(s) { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
  function refill(s) {
    var bag = Object.keys(SHAPES);
    for (var i = bag.length - 1; i > 0; i--) {
      var j = Math.floor(random(s) * (i + 1)), t = bag[i]; bag[i] = bag[j]; bag[j] = t;
    }
    s.queue.push.apply(s.queue, bag);
  }
  function take(s) { if (s.queue.length < 7) refill(s); return s.queue.shift(); }
  function cells(p) {
    var result = [], rows = SHAPES[p.kind];
    for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) if (rows[y][x] === '#') {
      var rx = x, ry = y;
      for (var n = 0; n < p.rot; n++) { var old = rx; rx = 3 - ry; ry = old; }
      result.push({ x: p.x + rx, y: p.y + ry, gear: p.gear && result.length === 0 });
    }
    return result;
  }
  function valid(s, p) {
    return cells(p).every(function (c) { return c.x >= 0 && c.x < W && c.y < H &&
      (c.y < 0 || !s.board[c.y][c.x]); });
  }
  function spawn(s) {
    s.serial++;
    s.turnScore = s.score;
    s.piece = { kind: take(s), x: 3, y: -1, rot: 0, gear: s.serial % 3 === 0 };
    if (!valid(s, s.piece)) { s.over = true; s.piece = null; }
  }
  function newGame(seed) {
    var s = { seed: seed === undefined ? 1907 : seed >>> 0, board: [], queue: [], piece: null,
      score: 0, lines: 0, level: 1, cogs: 0, combo: -1, serial: 0, over: false,
      elapsed: 0, history: null, last: 'READY' };
    for (var y = 0; y < H; y++) s.board.push(Array(W).fill(null));
    spawn(s); return s;
  }
  function move(s, dx, dy) {
    if (s.over) return false;
    var p = Object.assign({}, s.piece, { x: s.piece.x + dx, y: s.piece.y + dy });
    if (!valid(s, p)) return false;
    s.piece = p; return true;
  }
  function rotate(s) {
    if (s.over) return false;
    for (var i = 0; i < 4; i++) {
      var p = Object.assign({}, s.piece, { rot: (s.piece.rot + 1) % 4,
        x: s.piece.x + [0, -1, 1, -2][i] });
      if (valid(s, p)) { s.piece = p; return true; }
    }
    return false;
  }
  function lock(s) {
    if (s.over) return false;
    var before = clone({ board: s.board, queue: s.queue, piece: s.piece, score: s.score,
      lines: s.lines, level: s.level, combo: s.combo, serial: s.serial, seed: s.seed,
      turnScore: s.turnScore });
    var blocks = cells(s.piece);
    if (blocks.some(function (c) { return c.y < 0; })) {
      s.over = true; s.piece = null; s.last = 'TOP OUT'; return false;
    }
    blocks.forEach(function (c) { s.board[c.y][c.x] = { kind: s.piece.kind, gear: !!c.gear }; });
    var kept = [], cleared = 0, gearCount = 0;
    for (var y = 0; y < H; y++) {
      if (s.board[y].every(Boolean)) {
        cleared++;
        gearCount += s.board[y].filter(function (c) { return c.gear; }).length;
      } else kept.push(s.board[y]);
    }
    while (kept.length < H) kept.unshift(Array(W).fill(null));
    s.board = kept;
    if (cleared) {
      s.combo++;
      s.score += [0, 100, 300, 500, 800][cleared] * s.level + s.combo * 50;
      s.lines += cleared; s.level = 1 + Math.floor(s.lines / 10);
      s.cogs = Math.min(9, s.cogs + gearCount);
      s.last = (cleared === 4 ? 'FOUR-LINE CLEAR' : cleared + ' LINE CLEAR') +
        (gearCount ? ' · +' + gearCount + ' COG' : '');
    } else { s.combo = -1; s.last = 'LOCKED'; }
    s.history = before; s.elapsed = 0; spawn(s); return true;
  }
  function hardDrop(s) {
    if (s.over) return 0;
    var distance = 0;
    while (move(s, 0, 1)) distance++;
    s.score += distance * 2; lock(s); return distance;
  }
  function tick(s, dt) {
    if (s.over) return;
    s.elapsed += Math.min(Math.max(dt, 0), 0.1);
    var interval = Math.max(0.09, 0.8 * Math.pow(0.84, s.level - 1));
    while (s.elapsed >= interval && !s.over) {
      s.elapsed -= interval;
      if (!move(s, 0, 1)) lock(s);
    }
  }
  function rewind(s) {
    if (!s.history || s.cogs < 3) return false;
    var h = s.history, remaining = s.cogs - 3;
    Object.keys(h).forEach(function (key) { s[key] = clone(h[key]); });
    // Retry the piece from its original spawn, not its already-grounded lock
    // position. Remove drop points so replaying it cannot score them twice.
    s.piece.x = 3; s.piece.y = -1; s.piece.rot = 0;
    s.score = s.turnScore;
    s.cogs = remaining; s.over = false; s.history = null; s.elapsed = 0;
    s.last = 'LAST LOCK REWOUND'; return true;
  }
  function ghost(s) {
    if (!s.piece) return null;
    var p = Object.assign({}, s.piece);
    while (valid(s, Object.assign({}, p, { y: p.y + 1 }))) p.y++;
    return p;
  }
  GW.Logic = { W: W, H: H, SHAPES: SHAPES, COLORS: COLORS, newGame: newGame,
    cells: cells, valid: valid, move: move, rotate: rotate, lock: lock, hardDrop: hardDrop,
    tick: tick, rewind: rewind, ghost: ghost };
})(window);
