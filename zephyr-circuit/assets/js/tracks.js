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
    /* Par is what the time bonus is scaled against, so it has to be a
       time a good run actually beats by a margin. A strong AI lap of this
       circuit is 107s; par at 115 made the 500-point bonus cap
       mathematically unreachable (it would need 75s) and paid barely a
       fifth of it for an excellent run. Set roughly 16% above a strong
       run so the bonus is a real part of the score. Re-measure with
       tools: a solo hot lap at skill 0.95 is the reference. */
    parTime: 125,
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

  /* -----------------------------------------------------------------
     Polar authoring.

     Gullwing Bay was authored in cartesian and it took two attempts,
     because "keep the loop star-shaped about the origin" is a rule you
     have to hold in your head the whole time and it is invisible in a
     column of x/z numbers. Authored in polar it is not a rule at all: a
     bearing that only ever decreases CANNOT produce a loop that crosses
     itself, so the guarantee is structural rather than remembered.

     A circuit is then a list of [bearing°, radius m, height m, halfWidth],
     read anticlockwise. Character comes from the radius column — a
     collapse from 180m to 110m over two entries is a corner that
     tightens, which is the only interesting kind — and from the height
     column, which is cheaper than extra corners and does more.

     Bearing is measured the same way yaw is, atan2(x, z), so a bearing of
     0 is +z and it agrees with everything else in the game.
     ----------------------------------------------------------------- */
  var RAD = Math.PI / 180;
  function ring(rows) {
    var pts = [];
    for (var i = 0; i < rows.length; i++) {
      var a = rows[i][0] * RAD, r = rows[i][1];
      pts.push({ x: r * Math.sin(a), y: rows[i][2], z: r * Math.cos(a), w: rows[i][3] });
    }
    return pts;
  }

  /* -----------------------------------------------------------------
     2. THERMAL SPIRE — the climb.

     40 metres of elevation on a circuit under a kilometre long, which
     makes it the one where the road disappears over a crest and you have
     to remember what is on the other side. The spiral tightens as it
     climbs (180m radius down to 105m) so the corners get harder exactly
     as the kart gets slower, then everything is given back on the plunge
     — a fast, opening, downhill run where a drift boost carries further
     than it has any right to.
     ----------------------------------------------------------------- */
  var THERMAL_SPIRE = {
    id: 'thermal-spire',
    name: 'Thermal Spire',
    theme: 'dusk',
    laps: 3,
    parTime: 128,   // strong AI run 110s
    voidY: -60,
    autoBank: true,
    maxBank: 0.19,
    /* Bearings are evenly spaced and the gap that closes the loop is the
       same size as all the others. That is not tidiness: the first draft
       ran 0 to -352 in 24° steps, which left only 8° to get back to the
       start, and a Catmull-Rom fed one span a third the length of its
       neighbours overshoots hard. It put an 8-metre-radius kink across
       the start line — tighter than the road is wide, which folds the
       surface onto itself and breaks projection. Keep the spacing even. */
    points: ring([
      /* bearing, radius, height, halfWidth */
      [   0, 176,  0, 12.5 ],   // start / finish, on the wide lower shelf
      [ -24, 180,  1, 12   ],
      [ -48, 172,  5, 11.5 ],

      /* the spiral: radius collapses as the road climbs */
      [ -72, 150, 11, 11.5 ],
      [ -96, 128, 19, 11   ],
      [-120, 118, 26, 11   ],   // tightest point, and the steepest
      [-144, 128, 32, 11   ],

      /* the summit shelf — opens out, crests, and goes blind */
      [-168, 158, 36, 11.5 ],
      [-192, 180, 38, 12   ],
      [-216, 172, 35, 11.5 ],

      /* the plunge: tightening again, downhill, with room to get it wrong */
      [-240, 142, 26, 11.5 ],
      [-264, 122, 16, 11   ],   // the hairpin at the bottom of the drop
      [-288, 134,  8, 11   ],

      /* and the run home, opening all the way */
      [-312, 160,  3, 11   ],
      [-336, 186,  0, 12.5 ]
    ])
  };

  /* -----------------------------------------------------------------
     3. CIRRUS RUN — the fast one.

     The finale, and deliberately the least technical: two long fast arcs
     joined by a pair of hard direction changes. Its whole idea is that
     top speed matters here in a way it does not on the other two, so a
     saved Updraft is worth more and a Thunderhead in the wrong place is
     worth much more. Wide road throughout — 26m at the widest — because
     the passing has to happen somewhere.
     ----------------------------------------------------------------- */
  var CIRRUS_RUN = {
    id: 'cirrus-run',
    name: 'Cirrus Run',
    theme: 'noon',
    laps: 3,
    parTime: 143,   // strong AI run 123s — the longest lap of the three
    voidY: -60,
    autoBank: true,
    maxBank: 0.18,
    points: ring([
      [   0, 205,  6, 13   ],   // start / finish, flat out
      [ -26, 208,  8, 13   ],
      [ -52, 200, 10, 12.5 ],
      [ -78, 183, 12, 12   ],   // the long right-hander, barely a lift

      /* first direction change: the radius halves in 50 metres */
      [-102, 132, 12, 11   ],
      [-124, 108,  9, 10   ],
      [-146, 128,  5, 10.5 ],

      /* the back straight, downhill and dead fast */
      [-172, 186,  2, 12.5 ],
      [-198, 210,  0, 13   ],
      [-224, 206,  0, 13   ],

      /* second direction change, tighter than the first and uphill */
      [-248, 150,  3, 11   ],
      [-270, 112,  8, 10   ],
      [-292, 122, 11, 10   ],

      /* out of the last corner onto the run to the line */
      [-316, 168, 10, 12   ],
      [-340, 200,  8, 13   ]
    ])
  };

  TR.LIST = [GULLWING_BAY, THERMAL_SPIRE, CIRRUS_RUN];

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
