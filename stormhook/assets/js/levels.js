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
      w: 84, h: 16,
      stormSpeed: 44, stormLead: 13, parTime: 42,
      solid: [
        [0, 0, 84, 2],                       // continuous ceiling: always something to grab
        [0, 14, 15, 2],                      // floor, with two gaps
        [22, 14, 15, 2],
        [45, 14, 39, 2],
        [26, 2, 2, 5],                       // hanging pylons — rope wraps on these
        [55, 2, 2, 6],
        [70, 2, 2, 4]
      ],
      girders: [[16, 9, 5], [38, 8, 6], [62, 10, 5]],
      cores: [[10, 10], [18, 7], [24, 6], [31, 9], [40, 6], [49, 8], [59, 5], [66, 9], [75, 7]],
      hazards: [],
      spawn: [3, 12],
      beacon: [80, 12]
    },

    {
      id: 'chain-yard',
      name: 'The Chain Yard',
      hint: 'The ceiling is broken here. Look ahead and pick your next anchor before you release the last one.',
      w: 96, h: 17,
      stormSpeed: 62, stormLead: 12, parTime: 48,
      solid: [
        [0, 0, 20, 2],                       // ceiling in islands — you must plan ahead
        [26, 0, 16, 2],
        [48, 0, 14, 2],
        [68, 0, 28, 2],
        [0, 15, 12, 2],                      // sparser floor, longer chasms
        [18, 15, 9, 2],
        [36, 15, 8, 2],
        [52, 15, 7, 2],
        [66, 15, 30, 2],
        [12, 2, 2, 6],
        [33, 2, 2, 7],
        [55, 2, 2, 5],
        [74, 2, 2, 8],
        [86, 2, 2, 4]
      ],
      girders: [[21, 8, 4], [43, 6, 5], [44, 11, 4], [62, 9, 5], [80, 7, 5]],
      cores: [[8, 11], [15, 6], [22, 6], [29, 9], [35, 5], [41, 10],
              [46, 5], [53, 9], [59, 6], [64, 11], [71, 6], [78, 10], [85, 6], [90, 9]],
      hazards: [[38, 14], [39, 14], [54, 14], [55, 14]],
      spawn: [3, 13],
      beacon: [92, 13]
    },

    {
      id: 'foundry-spine',
      name: 'Foundry Spine',
      hint: 'Reel in at the bottom of an arc to whip yourself out of it. Speed is the only thing that beats the front.',
      w: 108, h: 19,
      stormSpeed: 78, stormLead: 11, parTime: 55,
      solid: [
        [0, 0, 24, 2],
        [30, 0, 12, 2],
        [50, 0, 10, 2],
        [66, 0, 14, 2],
        [86, 0, 22, 2],
        [0, 17, 10, 2],
        [16, 17, 7, 2],
        [30, 17, 6, 2],
        [44, 17, 6, 2],
        [60, 17, 6, 2],
        [74, 17, 7, 2],
        [90, 17, 18, 2],
        [10, 2, 2, 9],                       // deep pylons: heavy wrapping
        [36, 2, 2, 10],
        [54, 2, 2, 8],
        [70, 2, 2, 11],
        [93, 2, 2, 7],
        [20, 11, 6, 2],                      // mid-air hulls to swing under and over
        [46, 9, 7, 2],
        [78, 12, 7, 2]
      ],
      girders: [[26, 7, 4], [42, 13, 5], [58, 5, 5], [62, 12, 5], [82, 6, 5], [96, 10, 6]],
      cores: [[6, 13], [13, 6], [19, 8], [24, 5], [28, 12], [34, 6], [40, 9],
              [45, 5], [51, 13], [57, 9], [63, 6], [68, 13], [73, 7], [79, 8],
              [84, 13], [89, 6], [95, 13], [101, 8]],
      hazards: [[12, 16], [13, 16], [37, 16], [38, 16], [52, 16], [53, 16],
                [66, 16], [67, 16], [85, 16], [86, 16]],
      spawn: [3, 15],
      beacon: [104, 15]
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
