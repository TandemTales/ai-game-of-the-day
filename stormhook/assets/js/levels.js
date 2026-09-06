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
    },

    {
      id: 'tidewall-gantries',
      name: 'Tidewall Gantries',
      hint: 'Every ceiling gap has one gantry in it. Latch it on the way past, not after you have fallen.',
      w: 112, h: 14,
      stormSpeed: 92, stormLead: 12, parTime: 58,
      solid: [
        [0, 0, 22, 2],                       // ceiling in six spans, five gaps
        [28, 0, 14, 2],
        [48, 0, 12, 2],
        [66, 0, 12, 2],
        [84, 0, 10, 2],
        [100, 0, 12, 2],
        [0, 12, 10, 2],                      // floor: seven islands over long water
        [16, 12, 6, 2],
        [30, 12, 6, 2],
        [44, 12, 5, 2],
        [58, 12, 6, 2],
        [72, 12, 5, 2],
        [86, 12, 6, 2],
        [98, 12, 14, 2],
        [12, 2, 2, 6],                       // pylons, alternating depth
        [34, 2, 2, 7],
        [52, 2, 2, 6],
        [70, 2, 2, 7],
        [88, 2, 2, 6],
        [104, 2, 2, 5],
        [24, 9, 6, 2],                       // drifting hulls: swing over or under
        [46, 8, 6, 2],
        [64, 10, 5, 2],
        [82, 8, 6, 2]
      ],
      /* One gantry inside every ceiling gap keeps anchor continuity; the
         rest sit on the fast line to reward a player who never lands. */
      girders: [[22, 5, 6], [42, 4, 6], [60, 6, 6], [78, 4, 6], [94, 5, 6],
                [18, 7, 5], [38, 9, 5], [56, 4, 5], [74, 9, 5], [92, 8, 5]],
      cores: [[6, 9], [14, 5], [19, 6], [25, 6], [31, 8], [37, 5], [43, 7],
              [49, 5], [55, 9], [61, 8], [67, 7], [73, 5], [79, 9], [85, 5],
              [91, 7], [97, 6], [102, 9], [107, 6]],
      hazards: [[18, 11], [19, 11], [32, 11], [33, 11], [46, 11], [47, 11],
                [60, 11], [61, 11], [74, 11], [75, 11], [88, 11], [89, 11]],
      spawn: [3, 10],
      beacon: [108, 10]
    },

    {
      id: 'drowned-foundry',
      name: 'The Drowned Foundry',
      hint: 'The front is faster than you can swing lazily. Release at the bottom, reel at the top, never touch the deck.',
      w: 124, h: 14,
      stormSpeed: 108, stormLead: 12, parTime: 55,
      solid: [
        [0, 0, 18, 2],                       // the most broken ceiling in the run
        [24, 0, 12, 2],
        [42, 0, 10, 2],
        [58, 0, 12, 2],
        [76, 0, 10, 2],
        [92, 0, 12, 2],
        [110, 0, 14, 2],
        [0, 12, 9, 2],                       // barely any deck left to land on
        [15, 12, 5, 2],
        [28, 12, 5, 2],
        [40, 12, 5, 2],
        [53, 12, 5, 2],
        [66, 12, 5, 2],
        [80, 12, 5, 2],
        [94, 12, 5, 2],
        [106, 12, 18, 2],
        [10, 2, 2, 7],                       // the deepest pylons in the campaign
        [30, 2, 2, 8],
        [46, 2, 2, 7],
        [62, 2, 2, 8],
        [80, 2, 2, 7],
        [96, 2, 2, 8],
        [114, 2, 2, 6],
        [20, 9, 6, 2],                       // foundry hulls stacked at two heights
        [38, 7, 6, 2],
        [56, 9, 6, 2],
        [72, 6, 6, 2],
        [88, 9, 6, 2],
        [102, 7, 6, 2]
      ],
      girders: [[18, 5, 6], [36, 4, 6], [52, 5, 6], [70, 3, 6], [86, 4, 6],
                [104, 5, 6], [14, 8, 4], [34, 10, 4], [50, 9, 4], [66, 10, 4],
                [84, 8, 4], [100, 10, 4]],
      cores: [[5, 9], [12, 5], [17, 7], [22, 6], [27, 8], [33, 5], [37, 9],
              [43, 6], [48, 9], [54, 7], [59, 5], [64, 8], [69, 9], [75, 4],
              [79, 9], [85, 6], [90, 7], [95, 5], [99, 8], [105, 9], [111, 6],
              [117, 8]],
      hazards: [[16, 11], [17, 11], [29, 11], [30, 11], [41, 11], [42, 11],
                [54, 11], [55, 11], [67, 11], [68, 11], [81, 11], [82, 11],
                [95, 11], [96, 11]],
      spawn: [3, 10],
      beacon: [120, 10]
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
