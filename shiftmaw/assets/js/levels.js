/* Shiftmaw levels: maze layouts, parsing, validation, pathing helpers.
   Legend: # permanent wall   A wall solid in phase 0 (Day)   B wall solid in phase 1 (Dusk)
           . mote   o dusk bloom   ' ' empty floor   = nest (ghosts only)   - nest door
           P player start   F fruit spot   T tunnel (wraps; same as floor) */
(function (global) {
  'use strict';
  var SM = global.SM = global.SM || {};

  var MAZES = [
    {
      name: 'The Conservatory',
      rows: [
        '###################',
        '#........A........#',
        '#o##.###.#.###.##o#',
        '#....B.......B....#',
        '#.##.#.#####.#.##.#',
        '#....#...#...#....#',
        '####.### # ###.####',
        '####.#       #.####',
        '####.# ##-## #.####',
        'T    . #===# .    T',
        '####.# ##### #.####',
        '####.#   A   #.####',
        '####.# ##### #.####',
        '#........#........#',
        '#.##.###.#.###.##.#',
        '#o.#..B..P..B..#.o#',
        '##.#.#.#####.#.#.##',
        '#....A...B...A....#',
        '#.######.#.######.#',
        '#........F........#',
        '###################'
      ]
    }
  ];

  function parse(def) {
    var rows = def.rows, h = rows.length, w = rows[0].length, g = [], y, x;
    var m = { name: def.name, w: w, h: h, grid: [], motes: 0, blooms: 0, start: null, fruit: null, nest: [], door: null, tunnels: [] };
    for (y = 0; y < h; y++) {
      g[y] = [];
      if (rows[y].length !== w) throw new Error('row ' + y + ' width ' + rows[y].length + ' != ' + w);
      for (x = 0; x < w; x++) {
        var c = rows[y][x];
        if (c === 'P') { m.start = { x: x, y: y }; c = ' '; }
        if (c === 'F') { m.fruit = { x: x, y: y }; c = ' '; }
        if (c === 'T') { m.tunnels.push({ x: x, y: y }); c = ' '; }
        if (c === '.') m.motes++;
        if (c === 'o') m.blooms++;
        if (c === '=') m.nest.push({ x: x, y: y });
        if (c === '-') m.door = { x: x, y: y };
        g[y][x] = c;
      }
    }
    m.grid = g;
    return m;
  }

  /* Is the tile solid for a mover? kind: 'p' player, 'g' active ghost, 'n' ghost allowed in the nest (waiting, leaving, eaten) */
  function solid(m, x, y, phase, kind) {
    if (y < 0 || y >= m.h) return true;
    if (x < 0 || x >= m.w) { return !(m.tunnels.length && isTunnelRow(m, y)); }
    var c = m.grid[y][x];
    if (c === '#') return true;
    if (c === 'A') return phase === 0;
    if (c === 'B') return phase === 1;
    if (c === '=' || c === '-') return kind !== 'n'; // only ghosts in the nest / leaving / eaten may pass
    return false;
  }
  function isTunnelRow(m, y) { for (var i = 0; i < m.tunnels.length; i++) if (m.tunnels[i].y === y) return true; return false; }
  function wrapX(m, x) { return x < 0 ? x + m.w : (x >= m.w ? x - m.w : x); }

  var DIRS = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }]; // up left down right

  /* BFS distance field from (tx,ty). Returns flat Int16Array (w*h), -1 = unreachable. */
  function distField(m, tx, ty, phase, kind) {
    var w = m.w, h = m.h, d = new Int16Array(w * h), q = [], i, qi = 0;
    for (i = 0; i < d.length; i++) d[i] = -1;
    tx = wrapX(m, tx); if (ty < 0) ty = 0; if (ty >= h) ty = h - 1;
    d[ty * w + tx] = 0; q.push(tx, ty);
    while (qi < q.length) {
      var cx = q[qi++], cy = q[qi++], cd = d[cy * w + cx];
      for (i = 0; i < 4; i++) {
        var nx = wrapX(m, cx + DIRS[i].x), ny = cy + DIRS[i].y;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        if (d[ny * w + nx] !== -1 || solid(m, nx, ny, phase, kind)) continue;
        d[ny * w + nx] = cd + 1; q.push(nx, ny);
      }
    }
    return d;
  }

  /* Validation: every mote/bloom/fruit/start reachable by the player in BOTH phases. */
  function validate(m) {
    var errs = [], ph, y, x;
    if (!m.start) errs.push('no player start');
    if (!m.door) errs.push('no nest door');
    for (ph = 0; ph < 2; ph++) {
      if (!m.start) break;
      var d = distField(m, m.start.x, m.start.y, ph, 'p');
      for (y = 0; y < m.h; y++) for (x = 0; x < m.w; x++) {
        var c = m.grid[y][x];
        if ((c === '.' || c === 'o') && d[y * m.w + x] < 0) errs.push('phase ' + ph + ' unreachable ' + c + ' at ' + x + ',' + y);
        if ((c === 'A' || c === 'B') && false) errs.push('');
      }
      if (m.fruit && d[m.fruit.y * m.w + m.fruit.x] < 0) errs.push('phase ' + ph + ' fruit unreachable');
      if (solid(m, m.start.x, m.start.y, ph, 'p')) errs.push('start solid in phase ' + ph);
    }
    return errs;
  }

  SM.Levels = { MAZES: MAZES, parse: parse, solid: solid, wrapX: wrapX, DIRS: DIRS, distField: distField, validate: validate, isTunnelRow: isTunnelRow,
    get: function (i) { return parse(MAZES[i % MAZES.length]); } };
  if (typeof module !== 'undefined') module.exports = SM.Levels;
})(typeof window !== 'undefined' ? window : globalThis);
