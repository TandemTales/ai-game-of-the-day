/* =====================================================================
   STORMHOOK — levels.js   [OWNER: lead]

   Level data. Authored declaratively as rectangles and points, then
   rasterised once into the char grid that SPEC §4 defines. Everything
   downstream — physics, render, the tests — sees only the grid.

   Authoring by rectangle rather than by 84-character string is
   deliberate: hand-aligned ASCII maps of this width are where off-by-one
   level bugs come from, and a mis-typed column is invisible in review.
   ===================================================================== */
(function (global) {
  'use strict';

  var SH = global.SH || (global.SH = {});
  var L = SH.Levels = {};

  /* ------------------------------------------------------------------
     Rasteriser
     ------------------------------------------------------------------ */
  function build(def) {
    var w = def.w, h = def.h;
    var rows = [];
    for (var y = 0; y < h; y++) rows.push(new Array(w).fill('.'));

    function put(x, y, ch) {
      if (x < 0 || x >= w || y < 0 || y >= h) return;
      rows[y][x] = ch;
    }
    function rect(x, y, rw, rh, ch) {
      for (var j = 0; j < rh; j++) for (var i = 0; i < rw; i++) put(x + i, y + j, ch);
    }

    (def.solid || []).forEach(function (r) { rect(r[0], r[1], r[2], r[3], '#'); });
    (def.girders || []).forEach(function (r) { rect(r[0], r[1], r[2], 1, '='); });
    (def.hazards || []).forEach(function (p) { put(p[0], p[1], '^'); });
    (def.cores || []).forEach(function (p) { put(p[0], p[1], 'o'); });
    put(def.spawn[0], def.spawn[1], 'S');
    put(def.beacon[0], def.beacon[1], 'X');

    return rows.map(function (r) { return r.join(''); });
  }

  /* ------------------------------------------------------------------
     The levels.

     Design rules every level here follows:
       * a latchable surface is always within reach overhead, so the
         player is never stranded with nothing to grab;
       * pylons hang down from the ceiling specifically so the rope
         wraps on them — the wrap mechanic has to be used, not admired;
       * cores sit on the arc a good swing already takes, so the greedy
         line and the fast line are the same line;
       * the storm speed is the difficulty dial.
     ------------------------------------------------------------------ */
  var DEFS = [
    {
      id: 'shallow-wrecks',
      name: 'Shallow Wrecks',
      hint: 'Point and hold to latch. Let go at the bottom of the swing to go far — at the top to go high.',
      w: 84, h: 14,
      stormSpeed: 44, stormLead: 13, parTime: 42,
      solid: [
        [0, 0, 84, 2],                       // continuous ceiling: always something to grab
        [0, 12, 15, 2],                      // floor, with two chasms
        [22, 12, 15, 2],
        [45, 12, 39, 2],
        [26, 2, 2, 4],                       // hanging pylons — the rope wraps on these
        [55, 2, 2, 5],
        [70, 2, 2, 3]
      ],
      girders: [[16, 8, 5], [38, 7, 6], [62, 9, 5]],
      cores: [[10, 9], [18, 6], [24, 5], [31, 8], [40, 5], [49, 7], [59, 4], [66, 8], [75, 6]],
      hazards: [],
      spawn: [3, 10],
      beacon: [80, 10]
    },

    {
      id: 'chain-yard',
      name: 'The Chain Yard',
      hint: 'The ceiling is broken here. Pick your next anchor before you let go of the last one.',
      w: 96, h: 14,
      stormSpeed: 62, stormLead: 13, parTime: 48,
      solid: [
        [0, 0, 20, 2],                       // ceiling in islands — you must plan ahead
        [26, 0, 16, 2],
        [48, 0, 14, 2],
        [68, 0, 28, 2],
        [0, 12, 12, 2],                      // sparser floor, longer chasms
        [18, 12, 9, 2],
        [36, 12, 8, 2],
        [52, 12, 7, 2],
        [66, 12, 30, 2],
        [12, 2, 2, 5],
        [33, 2, 2, 6],
        [55, 2, 2, 4],
        [74, 2, 2, 6],
        [86, 2, 2, 3]
      ],
      /* One girder sits inside every ceiling gap, so a broken ceiling is a
         planning problem rather than a dead end. */
      girders: [[21, 7, 4], [43, 5, 5], [44, 10, 4], [62, 8, 5], [80, 6, 5]],
      cores: [[8, 10], [15, 5], [22, 5], [29, 8], [35, 4], [41, 9],
              [46, 4], [53, 8], [59, 5], [64, 10], [71, 5], [78, 9], [85, 5], [90, 8]],
      hazards: [[38, 11], [39, 11], [54, 11], [55, 11]],
      spawn: [3, 10],
      beacon: [92, 10]
    },

    {
      id: 'foundry-spine',
      name: 'Foundry Spine',
      hint: 'Reel in at the bottom of an arc to whip yourself out of it. Speed is the only thing that beats the front.',
      w: 108, h: 14,
      stormSpeed: 78, stormLead: 12, parTime: 55,
      solid: [
        [0, 0, 24, 2],
        [30, 0, 12, 2],
        [50, 0, 10, 2],
        [66, 0, 14, 2],
        [86, 0, 22, 2],
        [0, 12, 10, 2],
        [16, 12, 7, 2],
        [30, 12, 6, 2],
        [44, 12, 6, 2],
        [60, 12, 6, 2],
        [74, 12, 7, 2],
        [90, 12, 18, 2],
        [10, 2, 2, 6],                       // deep pylons: heavy wrapping
        [36, 2, 2, 7],
        [54, 2, 2, 5],
        [70, 2, 2, 7],
        [93, 2, 2, 5],
        [20, 9, 6, 2],                       // mid-air hulls to swing under and over
        [46, 7, 7, 2],
        [78, 9, 7, 2]
      ],
      girders: [[26, 6, 4], [44, 4, 5], [62, 5, 5], [82, 6, 5], [42, 10, 5], [96, 8, 6]],
      cores: [[6, 9], [13, 6], [19, 7], [24, 6], [28, 10], [34, 5], [40, 8],
              [45, 5], [51, 10], [57, 6], [63, 9], [68, 10], [73, 7], [79, 7],
              [85, 10], [89, 5], [95, 10], [101, 7]],
      hazards: [[17, 11], [18, 11], [32, 11], [33, 11], [46, 11], [47, 11],
                [62, 11], [63, 11], [76, 11], [77, 11]],
      spawn: [3, 10],
      beacon: [104, 10]
    }
  ];

  var CACHE = [];

  L.count = function () { return DEFS.length; };

  L.get = function (i) {
    i = Math.max(0, Math.min(DEFS.length - 1, i | 0));
    if (CACHE[i]) return CACHE[i];
    var d = DEFS[i];
    var grid = build(d);
    CACHE[i] = {
      index: i,
      id: d.id,
      name: d.name,
      hint: d.hint,
      grid: grid,
      w: d.w,
      h: d.h,
      stormSpeed: d.stormSpeed,
      stormLead: d.stormLead,
      parTime: d.parTime,
      coreCount: grid.join('').split('o').length - 1
    };
    return CACHE[i];
  };

  /* Mirrors SH.Physics.solidAt, but usable without a world — the design
     tests and any future level tooling need it. Sealed left and right,
     open above and below. */
  L.solidAt = function (lv, tx, ty) {
    if (tx < 0 || tx >= lv.w) return true;
    if (ty < 0 || ty >= lv.h) return false;
    var c = lv.grid[ty].charAt(tx);
    return c === '#' || c === '=';
  };

  /* Exposed so tests can assert on the authored source, not just the
     rasterised output. */
  L._defs = DEFS;
  L._build = build;

})(typeof window !== 'undefined' ? window : this);
