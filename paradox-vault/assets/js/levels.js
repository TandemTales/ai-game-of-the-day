/* =====================================================================
   PARADOX VAULT — levels.js
   Hand-authored vault layouts + a decoration/variation pass.
   Owner: lead. See SPEC.md §8.

   TERRAIN LEGEND (ASCII, one char per tile)
     '#' wall            '.' polished marble     ',' service granite
     '~' carpet          '=' parquet             ':' steel grate
     '+' glass wall (blocks movement, transmits light & vision)
     ' ' void (outside the building)
     '*' marble with gold inlay (hero floor)

   Objects are declared separately so they can carry configuration.
   Signal expressions:  'a'  'a&b'  'a,b' (OR)  '!a'  '(a,b)&c'
   ===================================================================== */
(function (global) {
  'use strict';
  var PV = global.PV;

  /* ------------------------------------------------------------------
     Signal expression evaluator (tiny recursive-descent parser, cached)
     ------------------------------------------------------------------ */
  var exprCache = Object.create(null);

  function parseExpr(src) {
    var i = 0;
    function peek() { return src[i]; }
    function eat(c) { if (src[i] === c) { i++; return true; } return false; }
    function skip() { while (src[i] === ' ') i++; }

    function atom() {
      skip();
      if (eat('!')) { var n = atom(); return function (S) { return !n(S); }; }
      if (eat('(')) { var e = orExpr(); skip(); eat(')'); return e; }
      var start = i;
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++;
      var name = src.slice(start, i);
      return function (S) { return !!S[name]; };
    }
    function andExpr() {
      var l = atom();
      for (;;) {
        skip();
        if (!eat('&')) return l;
        var r = atom(), ll = l;
        l = (function (a, b) { return function (S) { return a(S) && b(S); }; })(ll, r);
      }
    }
    function orExpr() {
      var l = andExpr();
      for (;;) {
        skip();
        if (!eat(',') && !eat('|')) return l;
        var r = andExpr(), ll = l;
        l = (function (a, b) { return function (S) { return a(S) || b(S); }; })(ll, r);
      }
    }
    return orExpr();
  }

  function evalSignal(expr, signals) {
    if (!expr) return false;
    var f = exprCache[expr] || (exprCache[expr] = parseExpr(expr));
    return f(signals);
  }

  /* ------------------------------------------------------------------
     Vault definitions
     ------------------------------------------------------------------ */
  function V(def) { return def; }

  var VAULTS = [

    /* ================================================================
       1 — THE FOYER · learn to move, take, and extract
       ================================================================ */
    V({
      id: 'foyer',
      name: 'The Grand Foyer',
      wing: 'Ground Floor',
      objective: 'Lift the Sunburst Crown and reach the extraction pad.',
      hint: 'Move with the stick or WASD. Walk over the relic to lift it, then stand on the gold pad.',
      echoes: 3,
      loopSeconds: 22,
      map: [
        '################',
        '#~~~~~~~~~~~~~~#',
        '#~............~#',
        '#~...######...~#',
        '#~...#....#...~#',
        '#~...#.**.#...~#',
        '#~...#.**.#...~#',
        '#~...##..##...~#',
        '#~............~#',
        '#~....P.......~#',
        '#~~~~~~~~~~~~~~#',
        '################'
      ],
      objects: [
        { t: 'relic', x: 7.5, y: 5.5, kind: 'crown', value: 1 },
        { t: 'exit', x: 12, y: 8, w: 2, h: 2 },
        { t: 'skylight', x: 5, y: 3, w: 6, h: 5, intensity: 0.85 },
        { t: 'lamp', x: 2.5, y: 2.5, color: '#ffcf8a', radius: 5.5, intensity: 0.6 },
        { t: 'lamp', x: 13.5, y: 2.5, color: '#ffcf8a', radius: 5.5, intensity: 0.6 },
        { t: 'lamp', x: 2.5, y: 9.5, color: '#ffcf8a', radius: 5.5, intensity: 0.6 },
        { t: 'prop', x: 3.5, y: 4.5, kind: 'column' },
        { t: 'prop', x: 12.5, y: 4.5, kind: 'column' },
        { t: 'prop', x: 3.5, y: 7.5, kind: 'plant' },
        { t: 'prop', x: 12.5, y: 7.5, kind: 'plant' },
        { t: 'prop', x: 8.0, y: 9.5, kind: 'bench' },
        { t: 'medallion', x: 8, y: 5.5, r: 2.6 }
      ]
    }),

    /* ================================================================
       2 — THE PLATE · your first echo
       ================================================================ */
    V({
      id: 'plate',
      name: 'Weighing Room',
      wing: 'Ground Floor',
      objective: 'The gate needs weight on the plate. You will have to be in two places.',
      hint: 'Stand on the plate until the loop ends. Your echo will hold it for you next time.',
      echoes: 3,
      loopSeconds: 20,
      map: [
        '#################',
        '#,,,,,,#........#',
        '#,,,,,,#........#',
        '#,,A,,,#...**...#',
        '#,,,,,,#...**...#',
        '#,,,,,,.........#',
        '#,,,,,,#........#',
        '#,,,,,,#........#',
        '#,,P,,,#........#',
        '#,,,,,,#........#',
        '#################'
      ],
      objects: [
        { t: 'plate', x: 3.5, y: 3.5, sig: 'a' },
        { t: 'door', x: 7, y: 5, axis: 'v', sig: 'a' },
        { t: 'relic', x: 12.0, y: 3.5, kind: 'orb', value: 1 },
        { t: 'exit', x: 1, y: 8, w: 2, h: 2 },
        { t: 'skylight', x: 9, y: 1, w: 6, h: 5, intensity: 0.7 },
        { t: 'lamp', x: 12.5, y: 8.5, color: '#8fd0ff', radius: 6, intensity: 0.45 },
        { t: 'lamp', x: 3.5, y: 1.5, color: '#ffbf7a', radius: 5, intensity: 0.5 },
        { t: 'prop', x: 5.5, y: 6.5, kind: 'crate' },
        { t: 'prop', x: 5.5, y: 7.5, kind: 'crate' },
        { t: 'prop', x: 10.5, y: 8.5, kind: 'vitrine' },
        { t: 'prop', x: 13.5, y: 8.5, kind: 'vitrine' },
        { t: 'medallion', x: 12, y: 3.5, r: 2.2 }
      ]
    }),

    /* ================================================================
       3 — TWIN LOCKS · two plates, one thief
       ================================================================ */
    V({
      id: 'twin',
      name: 'Twin Locks',
      wing: 'Ground Floor',
      objective: 'Both locks must be held at once. Two echoes, one you.',
      hint: 'Rewind early with R (or the ⟲ button) — you do not have to burn the whole loop.',
      echoes: 4,
      loopSeconds: 20,
      map: [
        '##################',
        '#,,,,,#....#,,,,,#',
        '#,,A,,#....#,,B,,#',
        '#,,,,,#....#,,,,,#',
        '#,,,,,#....#,,,,,#',
        '#,,,,,##..##,,,,,#',
        '#,,,,,,,,,,,,,,,,#',
        '#,,,,,,,,P,,,,,,,#',
        '#,,,,,,,,,,,,,,,,#',
        '##################'
      ],
      objects: [
        /* The mask sits in a chamber whose only door needs both locks held. */
        { t: 'plate', x: 3.5, y: 2.5, sig: 'a' },
        { t: 'plate', x: 14.5, y: 2.5, sig: 'b' },
        { t: 'door', x: 8, y: 5, axis: 'h', sig: 'a&b', span: 2 },
        { t: 'relic', x: 9.0, y: 2.0, kind: 'mask', value: 1 },
        { t: 'exit', x: 8, y: 7, w: 2, h: 2 },
        { t: 'skylight', x: 6, y: 0, w: 6, h: 5, intensity: 0.9 },
        { t: 'lamp', x: 3.5, y: 5.5, color: '#ffbf7a', radius: 5, intensity: 0.45 },
        { t: 'lamp', x: 14.5, y: 5.5, color: '#ffbf7a', radius: 5, intensity: 0.45 },
        { t: 'prop', x: 6.5, y: 7.5, kind: 'column' },
        { t: 'prop', x: 11.5, y: 7.5, kind: 'column' },
        { t: 'medallion', x: 9, y: 7.5, r: 2.4 }
      ]
    }),

    /* ================================================================
       4 — BEAM CORRIDOR · pulsing lasers
       ================================================================ */
    V({
      id: 'beams',
      name: 'The Long Gallery',
      wing: 'East Wing',
      objective: 'Time the beams. One touch and the loop collapses.',
      hint: 'Beams pulse. Watch the rhythm before you commit — a wasted loop is cheaper than a burnt one.',
      echoes: 4,
      loopSeconds: 22,
      map: [
        '####################',
        '#==================#',
        '#=................=#',
        '#=................=#',
        '#=................=#',
        '#=................=#',
        '#=................=#',
        '#==================#',
        '####################'
      ],
      objects: [
        { t: 'laser', x: 4, y: 2, dir: 'down', len: 5, blink: [1.6, 1.2, 0.0] },
        { t: 'laser', x: 8, y: 6, dir: 'up', len: 5, blink: [1.6, 1.2, 0.7] },
        { t: 'laser', x: 12, y: 2, dir: 'down', len: 5, blink: [1.4, 1.4, 1.4] },
        { t: 'laser', x: 15, y: 6, dir: 'up', len: 5, blink: [2.2, 1.0, 0.4] },
        { t: 'relic', x: 17.5, y: 4.0, kind: 'blade', value: 1 },
        { t: 'player', x: 2.5, y: 4.5 },
        { t: 'exit', x: 1, y: 2, w: 2, h: 2 },
        { t: 'lamp', x: 2.5, y: 2.0, color: '#8fd0ff', radius: 5, intensity: 0.4 },
        { t: 'lamp', x: 17.5, y: 6.0, color: '#ffbf7a', radius: 5, intensity: 0.5 },
        { t: 'prop', x: 6.5, y: 2.5, kind: 'vitrine' },
        { t: 'prop', x: 10.5, y: 6.5, kind: 'vitrine' },
        { t: 'prop', x: 14.5, y: 2.5, kind: 'vitrine' }
      ]
    }),

    /* ================================================================
       5 — UPLINK · terminals need time you do not have
       ================================================================ */
    V({
      id: 'uplink',
      name: 'Records Uplink',
      wing: 'East Wing',
      objective: 'Two terminals, three seconds each, held at the same moment.',
      hint: 'Hold ACTION next to a terminal. Terminals stay unlocked only while somebody is working them.',
      echoes: 4,
      loopSeconds: 22,
      map: [
        '###################',
        '#,,,,,,,,,,,,,,,,,#',
        '#,::::,,,,,,,::::,#',
        '#,:T,,,,,,,,,,,T:,#',
        '#,::::,,,,,,,::::,#',
        '#,,,,,,#####,,,,,,#',
        '#,,,,,,#***#,,,,,,#',
        '#,,,,,,#***#,,,,,,#',
        '#,,,,,,##.##,,,,,,#',
        '#,,,,,,,,P,,,,,,,,#',
        '#,,,,,,,,,,,,,,,,,#',
        '###################'
      ],
      objects: [
        { t: 'terminal', x: 2.5, y: 3.5, sig: 'a', hold: 3.0, face: 'right' },
        { t: 'terminal', x: 15.5, y: 3.5, sig: 'b', hold: 3.0, face: 'left' },
        { t: 'door', x: 9, y: 8, axis: 'v', sig: 'a&b' },
        { t: 'relic', x: 9.5, y: 6.5, kind: 'chalice', value: 2 },
        { t: 'exit', x: 8, y: 9, w: 2, h: 2 },
        { t: 'skylight', x: 7, y: 5, w: 5, h: 4, intensity: 0.8 },
        { t: 'lamp', x: 2.5, y: 8.5, color: '#5ff0ff', radius: 5, intensity: 0.35 },
        { t: 'lamp', x: 16.5, y: 8.5, color: '#5ff0ff', radius: 5, intensity: 0.35 },
        { t: 'vent', x: 9.5, y: 1.5, dir: 'down', power: 1.0 },
        { t: 'prop', x: 5.5, y: 1.5, kind: 'crate' },
        { t: 'prop', x: 13.5, y: 1.5, kind: 'crate' },
        { t: 'medallion', x: 9.5, y: 6.5, r: 1.6 }
      ]
    }),

    /* ================================================================
       6 — NIGHT WATCH · a sentry with eyes
       ================================================================ */
    V({
      id: 'watch',
      name: 'Night Watch',
      wing: 'East Wing',
      objective: 'A sentry walks the hall. Do not be seen — and neither should your echoes.',
      hint: 'Sentries see echoes too. Sometimes an echo walking the wrong way is exactly the distraction you need.',
      echoes: 4,
      loopSeconds: 24,
      map: [
        '####################',
        '#~~~~~~~~~~~~~~~~~~#',
        '#~....############~#',
        '#~....#..........#~#',
        '#~................#~#',
        '#~....#....A.....#~#',
        '#~....############~#',
        '#~................~#',
        '#~....P...........~#',
        '#~~~~~~~~~~~~~~~~~~#',
        '####################'
      ],
      objects: [
        { t: 'sentry', x: 3.5, y: 7.5, speed: 2.4, route: [[3.5, 7.5], [16.5, 7.5], [16.5, 1.5], [3.5, 1.5]], cone: { range: 6.5, angle: 0.62 } },
        { t: 'plate', x: 11.5, y: 5.5, sig: 'a' },
        { t: 'door', x: 6, y: 4, axis: 'v', sig: '!a', locked: true },
        { t: 'relic', x: 3.5, y: 4.5, kind: 'orb', value: 1 },
        { t: 'relic', x: 15.5, y: 3.5, kind: 'mask', value: 1 },
        { t: 'exit', x: 1, y: 7, w: 2, h: 2 },
        { t: 'lamp', x: 10.0, y: 1.5, color: '#ffbf7a', radius: 6, intensity: 0.5 },
        { t: 'lamp', x: 10.0, y: 8.5, color: '#ffbf7a', radius: 6, intensity: 0.5 },
        { t: 'skylight', x: 7, y: 2, w: 9, h: 5, intensity: 0.55 },
        { t: 'prop', x: 8.5, y: 3.5, kind: 'vitrine' },
        { t: 'prop', x: 13.5, y: 5.5, kind: 'bench' }
      ]
    }),

    /* ================================================================
       7 — REFRACTION · push the mirror
       ================================================================ */
    V({
      id: 'mirror',
      name: 'Hall of Refraction',
      wing: 'North Wing',
      objective: 'Bend the beam into the resonator to drop the cage.',
      hint: 'Walk into a mirror to push it. Beams reflect off mirrors — aim one at the blue receiver.',
      echoes: 5,
      loopSeconds: 24,
      map: [
        '###################',
        '#.................#',
        '#......#..........#',
        '#......#..........#',
        '#.............#####',
        '#.................#',
        '#.............#...#',
        '#.............#####',
        '#........P........#',
        '#.................#',
        '###################'
      ],
      objects: [
        /* The beam runs along row 5. Where the mirror starts, the reflection
           is blocked by the pillar at (7,2)-(7,3); push it two tiles right and
           the corridor at column 9 is clear all the way to the receiver. */
        { t: 'laser', x: 0, y: 5, dir: 'right', len: 18, beamKind: 'soft' },
        { t: 'mirror', x: 7.5, y: 5.5, ori: '/' },
        { t: 'receiver', x: 9.5, y: 1.5, sig: 'a', face: 'down' },
        { t: 'door', x: 14, y: 5, axis: 'v', span: 1, sig: 'a' },
        { t: 'relic', x: 16.5, y: 6.0, kind: 'chalice', value: 2 },
        { t: 'exit', x: 1, y: 8, w: 2, h: 2 },
        { t: 'skylight', x: 4, y: 1, w: 9, h: 6, intensity: 0.6 },
        { t: 'lamp', x: 2.5, y: 2.5, color: '#9b6cff', radius: 6, intensity: 0.4 },
        { t: 'lamp', x: 16.5, y: 5.5, color: '#9b6cff', radius: 5, intensity: 0.45 },
        { t: 'prop', x: 2.5, y: 1.5, kind: 'plant' },
        { t: 'prop', x: 17.5, y: 1.5, kind: 'plant' },
        { t: 'prop', x: 4.5, y: 8.5, kind: 'bench' },
        { t: 'medallion', x: 9.5, y: 8.0, r: 2.0 }
      ]
    }),

    /* ================================================================
       8 — THE GALLERY · everything at once, gently
       ================================================================ */
    V({
      id: 'gallery',
      name: 'Portrait Gallery',
      wing: 'North Wing',
      objective: 'Three pieces. One extraction. Plan the whole route before you spend an echo.',
      hint: 'Score rewards echoes you did NOT spend. A clean two-loop heist beats a messy five.',
      echoes: 5,
      loopSeconds: 24,
      map: [
        '#####################',
        '#~~~~~~~~~~~~~~~~~~~#',
        '#~..######.######..~#',
        '#~..#...#***#...#..~#',
        '#~..#.A.#***#.B.#..~#',
        '#~..#...#***#...#..~#',
        '#~..##.#######.##..~#',
        '#~.................~#',
        '#~........P........~#',
        '#~~~~~~~~~~~~~~~~~~~#',
        '#####################'
      ],
      objects: [
        /* The crown chamber is sealed except for one door at the top, and
           that door needs both side-room plates held at the same moment. */
        { t: 'plate', x: 6.5, y: 4.5, sig: 'a' },
        { t: 'plate', x: 14.5, y: 4.5, sig: 'b' },
        { t: 'door', x: 10, y: 2, axis: 'h', span: 1, sig: 'a&b' },
        { t: 'relic', x: 10.5, y: 4.0, kind: 'crown', value: 3 },
        { t: 'relic', x: 6.5, y: 3.5, kind: 'orb', value: 1 },
        { t: 'relic', x: 14.5, y: 3.5, kind: 'blade', value: 1 },
        { t: 'laser', x: 0, y: 7, dir: 'right', len: 20, blink: [1.5, 1.8, 0.4] },
        { t: 'sentry', x: 3.5, y: 8.5, speed: 2.2, route: [[3.5, 8.5], [17.5, 8.5]], cone: { range: 6, angle: 0.55 } },
        { t: 'exit', x: 1, y: 1, w: 2, h: 2 },
        { t: 'skylight', x: 8, y: 1, w: 6, h: 6, intensity: 0.75 },
        { t: 'lamp', x: 6.5, y: 1.5, color: '#ffbf7a', radius: 5, intensity: 0.45 },
        { t: 'lamp', x: 14.5, y: 1.5, color: '#ffbf7a', radius: 5, intensity: 0.45 },
        { t: 'prop', x: 2.5, y: 5.5, kind: 'column' },
        { t: 'prop', x: 18.5, y: 5.5, kind: 'column' },
        { t: 'medallion', x: 10.5, y: 8.0, r: 2.2 }
      ]
    }),

    /* ================================================================
       9 — DEEP STORAGE · pressure and patrols
       ================================================================ */
    V({
      id: 'storage',
      name: 'Deep Storage',
      wing: 'Sub-Level',
      objective: 'Two sentries, a live grid, and a lock that will not stay shut.',
      hint: 'A held plate can also hold a laser OFF. Read what each signal is wired to.',
      echoes: 5,
      loopSeconds: 24,
      map: [
        '#####################',
        '#,,,,,,,,,,,,,,,,,,,#',
        '#,::::,,,#####,,::::#',
        '#,:A,,,,,#***#,,,,B:#',
        '#,::::,,,#***#,,::::#',
        '#,,,,,,,,##.##,,,,,,#',
        '#,,,,,,,,,,,,,,,,,,,#',
        '#,,,,+++,,,,,+++,,,,#',
        '#,,,,,,,,,P,,,,,,,,,#',
        '#,,,,,,,,,,,,,,,,,,,#',
        '#####################'
      ],
      objects: [
        { t: 'plate', x: 2.5, y: 3.5, sig: 'a' },
        { t: 'plate', x: 18.5, y: 3.5, sig: 'b' },
        { t: 'door', x: 11, y: 5, axis: 'v', sig: 'a&b' },
        { t: 'laser', x: 10, y: 1, dir: 'down', len: 4, sig: '!a' },
        { t: 'laser', x: 1, y: 6, dir: 'right', len: 19, blink: [1.5, 2.0, 0.9] },
        { t: 'relic', x: 11.5, y: 3.5, kind: 'chalice', value: 3 },
        { t: 'relic', x: 5.5, y: 8.5, kind: 'mask', value: 1 },
        { t: 'sentry', x: 6.5, y: 1.5, speed: 2.6, route: [[6.5, 1.5], [14.5, 1.5]], cone: { range: 6, angle: 0.6 } },
        { t: 'sentry', x: 15.5, y: 9.5, speed: 2.2, route: [[15.5, 9.5], [4.5, 9.5]], cone: { range: 6, angle: 0.6 } },
        { t: 'exit', x: 9, y: 8, w: 2, h: 2 },
        { t: 'lamp', x: 10.5, y: 3.5, color: '#ffd76e', radius: 5, intensity: 0.7 },
        { t: 'lamp', x: 3.0, y: 6.5, color: '#5ff0ff', radius: 5, intensity: 0.3 },
        { t: 'lamp', x: 17.5, y: 6.5, color: '#5ff0ff', radius: 5, intensity: 0.3 },
        { t: 'vent', x: 10.5, y: 9.5, dir: 'up', power: 0.9 },
        { t: 'prop', x: 7.5, y: 4.5, kind: 'crate' },
        { t: 'prop', x: 13.5, y: 4.5, kind: 'crate' },
        { t: 'prop', x: 7.5, y: 3.5, kind: 'crate' }
      ]
    }),

    /* ================================================================
       10 — THE PARADOX VAULT · finale
       ================================================================ */
    V({
      id: 'paradox',
      name: 'The Paradox Vault',
      wing: 'The Core',
      objective: 'The Chronomason\'s Heart. Everything you have learned, in one loop chain.',
      hint: 'The Heart is heavy — you move slower carrying it, and you shine brighter.',
      echoes: 6,
      loopSeconds: 26,
      map: [
        '######################',
        '#....................#',
        '#..####..##########..#',
        '#..#..#..#****##..#..#',
        '#..#A.#..#****##.B#..#',
        '#..#..#..#****##..#..#',
        '#..#.##..##..###.##..#',
        '#....................#',
        '#..:::....T.....:::..#',
        '#..:::..........:::..#',
        '#....................#',
        '#.........P..........#',
        '######################'
      ],
      objects: [
        /* Both side vaults AND the uplink terminal must be live at the same
           instant to crack the core. Three things, one thief, six echoes. */
        { t: 'plate', x: 4.5, y: 4.5, sig: 'a' },
        { t: 'plate', x: 17.5, y: 4.5, sig: 'b' },
        { t: 'terminal', x: 10.5, y: 8.5, sig: 'c', hold: 3.5, face: 'up' },
        { t: 'door', x: 11, y: 6, axis: 'h', span: 2, sig: 'a&b&c' },
        { t: 'relic', x: 11.5, y: 4.0, kind: 'crown', value: 5, heavy: true, name: 'The Chronomason\'s Heart' },
        { t: 'relic', x: 5.5, y: 3.5, kind: 'orb', value: 1 },
        { t: 'relic', x: 16.5, y: 3.5, kind: 'blade', value: 1 },
        { t: 'laser', x: 0, y: 7, dir: 'right', len: 21, blink: [1.3, 1.7, 0.5] },
        { t: 'laser', x: 21, y: 1, dir: 'left', len: 20, blink: [1.9, 1.5, 1.1] },
        { t: 'sentry', x: 3.5, y: 10.5, speed: 2.8, route: [[3.5, 10.5], [18.5, 10.5], [18.5, 7.5], [3.5, 7.5]], cone: { range: 6.5, angle: 0.6 } },
        { t: 'sentry', x: 10.5, y: 1.5, speed: 2.4, route: [[10.5, 1.5], [2.5, 1.5], [10.5, 1.5], [19.5, 1.5]], cone: { range: 7, angle: 0.55 } },
        { t: 'exit', x: 2, y: 10, w: 2, h: 2 },
        { t: 'skylight', x: 9, y: 2, w: 6, h: 5, intensity: 1.0 },
        { t: 'lamp', x: 11.5, y: 4.0, color: '#ffd76e', radius: 6, intensity: 0.9 },
        { t: 'lamp', x: 2.0, y: 8.5, color: '#9b6cff', radius: 6, intensity: 0.35 },
        { t: 'lamp', x: 19.5, y: 8.5, color: '#9b6cff', radius: 6, intensity: 0.35 },
        { t: 'vent', x: 11.5, y: 8.5, dir: 'up', power: 1.0 },
        { t: 'prop', x: 7.5, y: 10.5, kind: 'column' },
        { t: 'prop', x: 14.5, y: 10.5, kind: 'column' },
        { t: 'prop', x: 1.5, y: 1.5, kind: 'plant' },
        { t: 'prop', x: 20.5, y: 1.5, kind: 'plant' },
        { t: 'medallion', x: 11.5, y: 4.0, r: 2.4 }
      ]
    })
  ];

  /* ------------------------------------------------------------------
     Parse a vault definition into a runtime-ready structure
     ------------------------------------------------------------------ */
  var TERRAIN = {
    '#': { solid: true, kind: 'wall', tex: 'wall.stone' },
    '+': { solid: true, kind: 'glass', tex: 'glass.frosted', seeThrough: true, lightThrough: true },
    '.': { solid: false, kind: 'marble', tex: 'floor.marble', surface: 'hard' },
    '*': { solid: false, kind: 'marbleGold', tex: 'floor.marbleGold', surface: 'hard' },
    ',': { solid: false, kind: 'granite', tex: 'floor.granite', surface: 'hard' },
    '~': { solid: false, kind: 'carpet', tex: 'floor.carpet', surface: 'soft' },
    '=': { solid: false, kind: 'parquet', tex: 'floor.parquet', surface: 'wood' },
    ':': { solid: false, kind: 'grate', tex: 'floor.grate', surface: 'metal' },
    ' ': { solid: true, kind: 'void', tex: null, isVoid: true }
  };

  /* Chars that are terrain in the map AND imply an object we lay down
     automatically so authoring stays readable. */
  var AUTO = {
    'P': { terrain: '.', obj: { t: 'player' } },
    'A': { terrain: ',', obj: null },   /* label chars — object declared explicitly */
    'B': { terrain: ',', obj: null },
    'T': { terrain: ',', obj: null },
    'M': { terrain: '.', obj: null }
  };

  function parseVault(def, index) {
    var rows = def.map;
    var h = rows.length;
    var w = 0;
    for (var i = 0; i < h; i++) w = Math.max(w, rows[i].length);

    var grid = new Array(w * h);
    var objects = [];
    var spawn = null;

    for (var y = 0; y < h; y++) {
      var line = rows[y];
      for (var x = 0; x < w; x++) {
        var ch = x < line.length ? line[x] : ' ';
        var auto = AUTO[ch];
        if (auto) {
          if (auto.obj && auto.obj.t === 'player') spawn = { x: x + 0.5, y: y + 0.5 };
          ch = auto.terrain;
        }
        var t = TERRAIN[ch] || TERRAIN['.'];
        grid[y * w + x] = t;
      }
    }

    /* explicit objects override / add */
    for (var k = 0; k < def.objects.length; k++) {
      var o = def.objects[k];
      if (o.t === 'player') { spawn = { x: o.x, y: o.y }; continue; }
      objects.push(o);
    }

    if (!spawn) spawn = { x: w / 2, y: h / 2 };

    var relicCount = 0, relicValue = 0;
    for (var r = 0; r < objects.length; r++) {
      if (objects[r].t === 'relic') { relicCount++; relicValue += (objects[r].value || 1); }
    }

    return {
      index: index,
      id: def.id,
      name: def.name,
      wing: def.wing,
      objective: def.objective,
      hint: def.hint,
      echoes: def.echoes,
      loopSeconds: def.loopSeconds || 22,
      w: w, h: h,
      grid: grid,
      objects: objects,
      spawn: spawn,
      relicCount: relicCount,
      relicValue: relicValue
    };
  }

  /* ------------------------------------------------------------------
     Endless remix — after vault 10, replay vaults with harder budgets
     ------------------------------------------------------------------ */
  function remix(baseIndex, cycle) {
    var src = VAULTS[baseIndex];
    var copy = JSON.parse(JSON.stringify(src));
    copy.name = src.name + ' · Lockdown ' + (cycle + 1);
    copy.echoes = Math.max(2, src.echoes - cycle);
    copy.loopSeconds = Math.max(14, src.loopSeconds - cycle * 2);
    copy.objective = 'Lockdown protocol. Fewer echoes, shorter loops.';
    /* speed patrols up and tighten blink windows */
    for (var i = 0; i < copy.objects.length; i++) {
      var o = copy.objects[i];
      if (o.t === 'sentry') { o.speed *= (1 + 0.12 * (cycle + 1)); o.cone.range *= (1 + 0.06 * cycle); }
      if (o.t === 'laser' && o.blink) { o.blink[1] = Math.max(0.55, o.blink[1] * (1 - 0.12 * (cycle + 1))); }
    }
    return copy;
  }

  PV.Levels = {
    count: VAULTS.length,
    /* Get the parsed vault for run position `i` (0-based, unbounded). */
    get: function (i) {
      if (i < VAULTS.length) return parseVault(VAULTS[i], i);
      var over = i - VAULTS.length;
      var cycle = Math.floor(over / VAULTS.length);
      /* Lockdown cycles walk the harder half of the campaign */
      var base = 3 + (over % (VAULTS.length - 3));
      return parseVault(remix(base, cycle), i);
    },
    raw: VAULTS,
    TERRAIN: TERRAIN,
    evalSignal: evalSignal,
    /* difficulty multiplier applied to a vault's score */
    multiplier: function (i) { return 1 + i * 0.15; }
  };

})(window);
