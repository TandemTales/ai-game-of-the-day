(function (global) {
  'use strict';
  var HG = global.HG = global.HG || {};

  // '#' always wall, 'A' wall only on Day layer, 'B' wall only on Dusk layer,
  // '.' dewdrop, 'o' moon lantern, 'W' wisp spawn, 'P' player spawn, ' ' empty.
  var MAP = [
    '###############',
    '#o.....#.....o#',
    '#.##.#.#.#.##.#',
    '#.A...BBB...A.#',
    '#.#.##.#.##.#.#',
    '#....#...#....#',
    '##.#.#.#.#.#.##',
    '.....A.W.A.....',
    '##.#.#.#.#.#.##',
    '#....#.P.#....#',
    '#.#.##.#.##.#.#',
    '#.A...BBB...A.#',
    '#.##.#.#.#.##.#',
    '#o.....#.....o#',
    '###############'
  ];
  var W = MAP[0].length, H = MAP.length;
  var DIRS = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }]; // up,left,down,right
  var FIXED = 1 / 60;
  var SCATTER = [{ x: W - 2, y: 1 }, { x: 1, y: 1 }, { x: W - 2, y: H - 2 }, { x: 1, y: H - 2 }];
  var NAMES = ['stalker', 'ambusher', 'mirror', 'drifter'];

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0; var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isWall(layer, c, r) {
    if (r === 7 && (c < 0 || c >= W)) return false; // wrap tunnel
    if (c < 0 || r < 0 || c >= W || r >= H) return true;
    var ch = MAP[r].charAt(c);
    if (ch === '#') return true;
    if (ch === 'A') return layer === 0;
    if (ch === 'B') return layer === 1;
    return false;
  }
  function wrap(c) { return (c + W) % W; }
  function key(c, r) { return r * W + c; }

  function levelParams(level) {
    var l = level - 1;
    return {
      playerSpeed: 6.2,
      wisp: Math.min(5.0 + l * 0.35, 6.4),
      frightened: Math.max(7 - l * 0.8, 2.5),
      shift: Math.max(14 - l * 1.5, 8),
      wispCount: 4
    };
  }

  function distMap(layer, c, r) {
    var d = {}; var q = [[c, r]]; d[key(c, r)] = 0;
    for (var i = 0; i < q.length; i++) {
      var cur = q[i];
      for (var k = 0; k < 4; k++) {
        var nc = wrap(cur[0] + DIRS[k].x), nr = cur[1] + DIRS[k].y;
        if (isWall(layer, nc, nr) || d[key(nc, nr)] !== undefined) continue;
        d[key(nc, nr)] = d[key(cur[0], cur[1])] + 1; q.push([nc, nr]);
      }
    }
    return d;
  }

  function findCell(ch) {
    for (var r = 0; r < H; r++) { var c = MAP[r].indexOf(ch); if (c >= 0) return { x: c, y: r }; }
  }

  function create(seed, level) {
    level = level || 1;
    var s = {
      seed: seed >>> 0, rand: rng(seed), level: level, params: levelParams(level),
      layer: 0, shiftTimer: 0, shiftWarn: false, shifts: 0,
      time: 0, modeTime: 0, mode: 'ready', // ready, playing, dying, over
      score: 0, lives: 3, combo: 0, chain: 0, frightTimer: 0,
      pellets: {}, pelletsLeft: 0, eaten: 0, events: [], deadTimer: 0, crushes: 0, bestChain: 0
    };
    s.shiftTimer = s.params.shift;
    for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) {
      var ch = MAP[r].charAt(c);
      if (ch === '.' || ch === 'o' || ch === 'A' || ch === 'B') { s.pellets[key(c, r)] = ch === 'o' ? 2 : 1; s.pelletsLeft++; }
    }
    s.player = { c: findCell('P').x, r: findCell('P').y, tc: 0, tr: 0, p: 0, dir: -1, want: -1, moving: false };
    s.wisps = [];
    var spawn = findCell('W');
    for (var i = 0; i < 4; i++) {
      s.wisps.push({ id: i, name: NAMES[i], c: spawn.x, r: spawn.y, tc: 0, tr: 0, p: 0, dir: -1, moving: false,
        state: 'wait', release: i * 2.5, scared: false });
    }
    resetPositions(s);
    return s;
  }

  function resetPositions(s) {
    var pp = findCell('P'), sp = findCell('W');
    var p = s.player; p.c = pp.x; p.r = pp.y; p.p = 0; p.dir = -1; p.want = -1; p.moving = false;
    s.wisps.forEach(function (w, i) {
      w.c = sp.x; w.r = sp.y; w.p = 0; w.dir = -1; w.moving = false; w.state = 'wait';
      w.release = s.time + i * 2.5 + 1; w.scared = false;
    });
    s.frightTimer = 0; s.chain = 0;
  }

  function entityPos(e) {
    if (!e.moving) return { x: e.c, y: e.r };
    var x = e.c + (e.tc - e.c) * e.p; var r = e.r + (e.tr - e.r) * e.p;
    if (Math.abs(e.tc - e.c) > 1) x = e.c + (e.tc > e.c ? -1 : 1) * e.p; // tunnel wrap visual
    return { x: x, y: r };
  }

  function open(s, c, r, k) {
    var nc = c + DIRS[k].x, nr = r + DIRS[k].y;
    if (r === 7 && (nc < 0 || nc >= W)) return true;
    return !isWall(s.layer, nc, nr);
  }
  function neighbor(c, r, k) { return { c: wrap(c + DIRS[k].x), r: r + DIRS[k].y }; }

  function setDir(s, e, k) {
    if (k < 0 || !open(s, e.c, e.r, k)) return false;
    var n = neighbor(e.c, e.r, k);
    e.dir = k; e.tc = n.c; e.tr = n.r; e.p = 0; e.moving = true;
    if (Math.abs(n.c - e.c) > 1) { e.tc = e.c + DIRS[k].x; } // visual only; snapped on arrival
    return true;
  }

  function setWant(s, k) { s.player.want = k; if (s.mode === 'ready') { s.mode = 'playing'; s.events.push({ t: 'start' }); } }

  function wispTarget(s, w) {
    var p = s.player, pk = p.dir >= 0 ? p.dir : 1, T;
    if (w.state === 'eaten') return findCell('W');
    var phase = (s.modeTime % 27) < 7 ? 'scatter' : 'chase';
    if (phase === 'scatter' || w.scared) return SCATTER[w.id];
    if (w.name === 'stalker') T = { x: p.c, y: p.r };
    else if (w.name === 'ambusher') T = { x: p.c + DIRS[pk].x * 4, y: p.r + DIRS[pk].y * 4 };
    else if (w.name === 'mirror') T = { x: W - 1 - p.c, y: H - 1 - p.r };
    else { var d = Math.hypot(p.c - w.c, p.r - w.r); T = d > 6 ? { x: p.c, y: p.r } : SCATTER[w.id]; }
    return T;
  }

  function chooseWispDir(s, w) {
    var best = -1, bestD = Infinity, opts = [], k, rev = w.dir >= 0 ? (w.dir + 2) % 4 : -1;
    for (k = 0; k < 4; k++) if (open(s, w.c, w.r, k) && k !== rev) opts.push(k);
    if (!opts.length && rev >= 0 && open(s, w.c, w.r, rev)) opts.push(rev);
    if (!opts.length) return -1;
    if (w.scared && w.state !== 'eaten') return opts[Math.floor(s.rand() * opts.length)];
    if (w.state === 'eaten') {
      var dm = distMap(s.layer, findCell('W').x, findCell('W').y), bd = Infinity;
      for (k = 0; k < 4; k++) if (open(s, w.c, w.r, k)) {
        var n = neighbor(w.c, w.r, k), dv = dm[key(n.c, n.r)];
        if (dv !== undefined && dv < bd) { bd = dv; best = k; }
      }
      return best >= 0 ? best : opts[0];
    }
    var T = wispTarget(s, w);
    for (var i = 0; i < opts.length; i++) {
      var nn = neighbor(w.c, w.r, opts[i]);
      var dd = (nn.c - T.x) * (nn.c - T.x) + (nn.r - T.y) * (nn.r - T.y);
      if (dd < bestD) { bestD = dd; best = opts[i]; }
    }
    return best;
  }

  function advance(s, e, dist, isPlayer) {
    // Moves entity along edges; calls arrive() at each tile centre.
    while (dist > 0) {
      if (!e.moving) { if (!arrive(s, e, isPlayer)) return; continue; }
      var left = 1 - e.p;
      if (dist < left) { e.p += dist; return; }
      dist -= left; e.c = wrap(e.tc); e.r = e.tr; e.p = 0; e.moving = false;
      if (isPlayer) collect(s);
      if (!arrive(s, e, isPlayer)) return;
    }
  }

  function arrive(s, e, isPlayer) {
    if (isPlayer) {
      var p = s.player;
      if (p.want >= 0 && open(s, p.c, p.r, p.want)) return setDir(s, p, p.want);
      if (p.dir >= 0 && open(s, p.c, p.r, p.dir)) return setDir(s, p, p.dir);
      p.dir = -1; return false;
    }
    var k = chooseWispDir(s, e);
    if (k < 0) return false;
    return setDir(s, e, k);
  }

  function collect(s) {
    var p = s.player, kk = key(p.c, p.r), v = s.pellets[kk];
    if (!v) return;
    delete s.pellets[kk]; s.pelletsLeft--; s.eaten++;
    s.combo++;
    if (v === 2) {
      s.score += 50; s.frightTimer = s.params.frightened; s.chain = 0;
      s.wisps.forEach(function (w) { if (w.state === 'chase') { w.scared = true; w.dir = w.dir >= 0 ? (w.dir + 2) % 4 : w.dir; } });
      s.events.push({ t: 'lantern', c: p.c, r: p.r });
    } else { s.score += 10; s.events.push({ t: 'dew', c: p.c, r: p.r }); }
    if (s.pelletsLeft === 0) {
      s.score += 1000 + s.lives * 250; s.events.push({ t: 'clear' }); s.mode = 'cleared';
    }
  }

  // Applies the layer swap: reconciles entities caught in newly closed walls.
  function shift(s) {
    s.layer = 1 - s.layer; s.shifts++; s.events.push({ t: 'shift', layer: s.layer });
    var p = s.player;
    fixEntity(s, p, true);
    s.wisps.forEach(function (w) {
      if (w.state === 'wait') return;
      var wasBlocked = isWall(s.layer, w.c, w.r) || (w.moving && isWall(s.layer, wrap(w.tc), w.tr));
      if (wasBlocked) {
        s.crushes++; s.score += 500; s.events.push({ t: 'crush', c: w.c, r: w.r });
        var sp = findCell('W'); w.c = sp.x; w.r = sp.y; w.moving = false; w.p = 0; w.dir = -1;
        w.state = 'wait'; w.scared = false; w.release = s.time + 2;
      } else if (w.moving && !open(s, w.c, w.r, w.dir)) { w.moving = false; w.p = 0; }
    });
  }

  function fixEntity(s, e) {
    if (e.moving && isWall(s.layer, wrap(e.tc), e.tr)) { e.moving = false; e.p = 0; }
    if (isWall(s.layer, e.c, e.r)) {
      var dm, best = null, bd = Infinity, sp = findCell('P');
      dm = distMap(s.layer, sp.x, sp.y);
      for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) {
        if (isWall(s.layer, c, r) || dm[key(c, r)] === undefined) continue;
        var d = Math.abs(c - e.c) + Math.abs(r - e.r);
        if (d < bd) { bd = d; best = { c: c, r: r }; }
      }
      e.c = best.c; e.r = best.r; e.moving = false; e.p = 0; e.dir = -1; s.combo = 0;
      s.events.push({ t: 'squeeze', c: e.c, r: e.r });
    }
  }

  function loseLife(s) {
    s.lives--; s.combo = 0; s.events.push({ t: 'death', c: s.player.c, r: s.player.r });
    if (s.lives <= 0) { s.mode = 'over'; s.events.push({ t: 'over' }); }
    else { s.mode = 'dying'; s.deadTimer = 1.4; }
  }

  function checkCollisions(s) {
    var pp = entityPos(s.player);
    for (var i = 0; i < s.wisps.length; i++) {
      var w = s.wisps[i]; if (w.state === 'wait' || w.state === 'eaten') continue;
      var wp = entityPos(w);
      if (Math.hypot(pp.x - wp.x, pp.y - wp.y) > 0.6) continue;
      if (w.scared) {
        s.chain++; s.bestChain = Math.max(s.bestChain, s.chain);
        s.score += 100 * Math.pow(2, s.chain); w.state = 'eaten'; w.scared = false;
        s.events.push({ t: 'eatWisp', c: w.c, r: w.r, chain: s.chain });
      } else { loseLife(s); return; }
    }
  }

  function step(s, dt) {
    var n = 0;
    s.acc = (s.acc || 0) + dt;
    while (s.acc >= FIXED && n++ < 12) { s.acc -= FIXED; tick(s, FIXED); }
  }

  function tick(s, dt) {
    if (s.mode === 'dying') {
      s.deadTimer -= dt;
      if (s.deadTimer <= 0) { resetPositions(s); s.mode = 'ready'; }
      return;
    }
    if (s.mode !== 'playing') return;
    s.time += dt; s.modeTime += dt;
    s.shiftTimer -= dt; s.shiftWarn = s.shiftTimer <= 2;
    if (s.shiftTimer <= 0) { shift(s); s.shiftTimer = s.params.shift; s.shiftWarn = false; }
    if (s.frightTimer > 0) {
      s.frightTimer -= dt;
      if (s.frightTimer <= 0) s.wisps.forEach(function (w) { w.scared = false; });
    }
    advance(s, s.player, s.params.playerSpeed * dt, true);
    if (s.mode !== 'playing') return;
    s.wisps.forEach(function (w) {
      if (w.state === 'wait') {
        if (s.time >= w.release) { w.state = 'chase'; }
        else return;
      }
      var sp = w.state === 'eaten' ? 11 : (w.scared ? s.params.wisp * 0.6 : s.params.wisp);
      advance(s, w, sp * dt, false);
      if (w.state === 'eaten' && !w.moving && w.c === findCell('W').x && w.r === findCell('W').y) {
        w.state = 'wait'; w.release = s.time + 1; w.dir = -1;
      }
    });
    checkCollisions(s);
  }

  function nextLevel(s) {
    var n = create(s.seed + s.level, s.level + 1);
    n.score = s.score; n.lives = Math.min(s.lives + 1, 5); n.crushes = s.crushes; n.bestChain = s.bestChain;
    return n;
  }

  function drainEvents(s) { var e = s.events; s.events = []; return e; }

  HG.Logic = {
    MAP: MAP, W: W, H: H, DIRS: DIRS, FIXED: FIXED, create: create, step: step, tick: tick, setWant: setWant,
    isWall: isWall, entityPos: entityPos, nextLevel: nextLevel, drainEvents: drainEvents, distMap: distMap,
    levelParams: levelParams, findCell: findCell, shift: shift, key: key
  };
})(typeof window !== 'undefined' ? window : globalThis);
