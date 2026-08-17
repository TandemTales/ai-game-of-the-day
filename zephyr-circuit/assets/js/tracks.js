/* =====================================================================
   ZEPHYR CIRCUIT — tracks.js
   The track definitions. Control points only; track.js turns them into
   everything else.
   Owner: lead. See SPEC.md §1.1.

   Authoring notes for whoever adds the next circuit:

   * Points are metres. `w` is the road HALF-width, so w:11 is a 22m road
     — wide enough for four karts abreast plus a mistake.
   * Space control points 40-90m apart. Closer than ~25m and the
     Catmull-Rom starts to wobble between them; further than ~100m and you
     lose the ability to shape a corner.
   * Do not hand-author `bank`. Set `autoBank: true` and camber is derived
     from the curvature at bake time, so it can never disagree with the
     geometry after someone nudges a point. `maxBank` caps it; keep that
     under ~0.20 (11 degrees) or karts slide off the high side at low speed.
   * Keep the loop star-shaped about the origin — bearing from the origin
     should change monotonically all the way round. That is what
     guarantees the road cannot cross itself, and the test suite checks
     the resulting clearance.
   * Elevation is cheap and does more for how a circuit reads than extra
     corners do. Vary `y`.
   * Aim for a lap of 800-1200m: at a ~26 m/s top speed that is a 35-50
     second lap, which is the Mario Kart range.
   ===================================================================== */
(function (global) {
  'use strict';

  var ZC = global.ZC || (global.ZC = {});
  var TR = ZC.Tracks = {};

  /* -----------------------------------------------------------------
     1. GULLWING BAY — the opener.

     Laid out as a single ring whose radius from the origin varies but
     whose bearing only ever decreases: that makes the loop star-shaped
     about the origin, which is a cheap geometric guarantee that the road
     can never cross itself. The first draft of this circuit doubled back
     through the middle of the island and overlapped its own surface by
     20m, which made lap counting and the off-track test meaningless in
     that region. `zephyr-circuit.track.test.js` now asserts the
     clearance, so that cannot come back.

     Character comes from radius and elevation, not from crossing: a long
     opening straight, a climb to a blind crest, a hard tightening double
     apex at the far end, and a chicane on the run home.
     ----------------------------------------------------------------- */
  var GULLWING_BAY = {
    id: 'gullwing-bay',
    name: 'Gullwing Bay',
    theme: 'dawn',
    laps: 3,
    parTime: 115,
    voidY: -60,
    /* camber is derived from curvature at bake time — see track.js §4 */
    autoBank: true,
    maxBank: 0.19,
    points: [
      /* start / finish, running east along the top of the island */
      { x:    0, y:  0, z:  195, w: 13 },
      { x:   62, y:  0, z:  170, w: 12.5 },
      { x:  112, y:  2, z:  133, w: 12 },

      /* the climb — long right-hand sweeper gaining 15m */
      { x:  156, y:  6, z:   90, w: 11.5 },
      { x:  180, y: 11, z:   32, w: 11 },
      { x:  178, y: 15, z:  -31, w: 11 },      // crest, blind exit
      { x:  140, y: 15, z:  -81, w: 10.5 },

      /* the double apex: radius collapses from 160m to 100m */
      { x:   82, y: 12, z:  -98, w: 10 },
      { x:   34, y:  8, z:  -95, w: 9.5 },
      { x:  -10, y:  5, z: -104, w: 9.5 },

      /* opening out again, descending back to sea level */
      { x:  -56, y:  3, z: -120, w: 10.5 },
      { x: -106, y:  1, z: -104, w: 11 },
      { x: -142, y:  0, z:  -66, w: 11 },
      { x: -160, y:  0, z:  -14, w: 11.5 },

      /* the chicane home — in, apex, out */
      { x: -152, y:  0, z:   40, w: 11 },
      { x: -108, y:  0, z:   76, w: 10.5 },
      { x:  -95, y:  0, z:  128, w: 11 },
      { x:  -48, y:  0, z:  176, w: 12 }
    ]
  };

  TR.LIST = [GULLWING_BAY];

  TR.byId = function (id) {
    for (var i = 0; i < TR.LIST.length; i++) if (TR.LIST[i].id === id) return TR.LIST[i];
    return null;
  };
  TR.count = function () { return TR.LIST.length; };

  /* Baked tracks are cached: baking is deterministic and not free, and a
     cup replays the same circuit on every retry. */
  var _cache = Object.create(null);
  TR.get = function (indexOrId) {
    var def = (typeof indexOrId === 'number') ? TR.LIST[indexOrId] : TR.byId(indexOrId);
    if (!def) return null;
    if (!_cache[def.id]) _cache[def.id] = ZC.Track.bake(def);
    return _cache[def.id];
  };
  TR.clearCache = function () { _cache = Object.create(null); };

  /* -----------------------------------------------------------------
     Starting grid.

     Slots are authored in track space — arc length behind the line, and
     a normalised lateral offset — so a grid lays itself out correctly on
     any circuit regardless of how the start straight curves.
     ----------------------------------------------------------------- */
  TR.gridSlot = function (track, place, fieldSize) {
    var row = Math.floor(place / 2);
    var side = (place % 2 === 0) ? -0.45 : 0.45;
    /* back from the line, two per row, 7m between rows */
    var s = ZC.Track.wrapS(track, track.length - 12 - row * 7);
    return { s: s, t: side, row: row, fieldSize: fieldSize };
  };

})(window);
