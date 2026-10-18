(function (global) {
  'use strict';
  var GR = global.GR = global.GR || {};
  var L = GR.Logic = {};
  // '#' wall  '.' ember  'o' lantern ember  ' ' floor  'A' shutter open in state 0
  // 'B' shutter open in state 1  'R' rune pad  'P' player  'W' wisp start
  L.MAP = [
    '###################',
    '#o.......#.......o#',
    '#.##.###.#.###.##.#',
    '#........R........#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.###.#.###.####',
    '####.A.......B.####',
    '####.#.##W##.#.####',
    '    ...#WWW#...    ',
    '####.#.#####.#.####',
    '####.#.......#.####',
    '####.#.#####.#.####',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#o.R.#...P...#.R.o#',
    '#.##.#.#####.#.##.#',
    '#........B........#',
    '###################'
  ];
  L.W = 19; L.H = L.MAP.length;
  L.TUNNEL_ROW = 9;
  L.FLIP_PREVIEW = 0.9;
  L.PAD_COOLDOWN = 2.5;
  L.DIRS = [{ c: 0, r: -1 }, { c: -1, r: 0 }, { c: 0, r: 1 }, { c: 1, r: 0 }];
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0; var t = s;
      t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  L.cell = function (c, r) {
    if (r < 0 || r >= L.H) return '#';
    if (c < 0 || c >= L.W) return r === L.TUNNEL_ROW ? ' ' : '#';
    return L.MAP[r].charAt(c);
  };
  L.wrap = function (c) { return (c + L.W) % L.W; };
  // Whether a tile can be entered given the shutter state (0 or 1).
  L.open = function (c, r, state) {
    var ch = L.cell(c, r);
    if (ch === '#') return false;
    if (ch === 'A') return state === 0;
    if (ch === 'B') return state === 1;
    return true;
  };
  var SPEC = [
    { name: 'Ember', kind: 'chase', home: { c: 17, r: 0 }, delay: 0 },
    { name: 'Thorn', kind: 'ambush', home: { c: 1, r: 0 }, delay: 3 },
    { name: 'Mire', kind: 'flank', home: { c: 17, r: 18 }, delay: 7 },
    { name: 'Drift', kind: 'wander', home: { c: 1, r: 18 }, delay: 11 }
  ];
  L.WISPS = SPEC;
  L.levelSpeed = function (level) { return Math.min(1.5, 1 + (level - 1) * 0.07); };
  L.newGame = function (seed) {
    var g = { seed: seed || 1, level: 1, score: 0, lives: 3, over: false, rand: rng(seed || 1),
      time: 0, events: [], best: 0 };
    L.loadLevel(g); return g;
  };
  L.loadLevel = function (g) {
    g.grid = L.MAP.map(function (row) { return row.split(''); });
    g.embers = 0;
    g.pads = [];
    for (var r = 0; r < L.H; r++) for (var c = 0; c < L.W; c++) {
      var ch = g.grid[r][c];
      if (ch === '.' || ch === 'o') g.embers++;
      if (ch === 'R') g.pads.push({ c: c, r: r, cool: 0 });
      if (ch === 'P' || ch === 'W') g.grid[r][c] = ' ';
    }
    g.state = 0; g.flip = 0; g.flipCount = 0; g.chain = 0; g.cleared = false;
    g.speed = L.levelSpeed(g.level);
    L.resetActors(g);
  };
  L.resetActors = function (g) {
    var start = { c: 9, r: 15 };
    g.player = { c: start.c, r: start.r, dc: 0, dr: 0, t: 0, want: null, face: 1, dead: 0 };
    g.wispList = SPEC.map(function (s, i) {
      return { id: i, name: s.name, kind: s.kind, home: s.home, c: 9, r: 9, dc: 0, dr: 0, t: 0,
        state: 'house', release: s.delay / Math.min(2, g.speed), face: 3 };
    });
    g.modeClock = 0; g.fright = 0; g.chain = 0; g.respawn = 0;
  };
  L.setDir = function (g, dir) { g.player.want = dir; };
  function passable(g, c, r) {
    return L.open(L.wrap(c), r, g.state);
  }
  L.passable = function (g, c, r) { return passable(g, c, r); };
  function playerSpeed(g) { return 5.4 * g.speed; }
  function wispSpeed(g, w) {
    var s = 4.9 * g.speed;
    if (w.state === 'eaten') return 11;
    if (w.state === 'frightened') return s * 0.55;
    if (L.cell(w.c, w.r) === ' ' && w.r === L.TUNNEL_ROW && (w.c < 4 || w.c > 14)) return s * 0.6;
    return s;
  }
  function moveActor(g, a, speed, dt, choose, onArrive) {
    var left = dt * speed;
    var guard = 0;
    while (left > 0 && guard++ < 8) {
      if (a.dc === 0 && a.dr === 0) {
        choose(a);
        if (a.dc === 0 && a.dr === 0) return;
      }
      var step = Math.min(left, 1 - a.t);
      a.t += step; left -= step;
      if (a.t >= 1 - 1e-9) {
        a.c = L.wrap(a.c + a.dc); a.r += a.dr; a.t = 0;
        onArrive(a);
        a.dc = 0; a.dr = 0;
      }
    }
  }
  function tryDir(g, a, d) {
    return d && passable(g, a.c + d.c, a.r + d.r);
  }
  function playerChoose(g) {
    var p = g.player;
    if (tryDir(g, p, p.want)) { p.dc = p.want.c; p.dr = p.want.r; }
    else if (p.face !== undefined && tryDir(g, p, L.DIRS[p.face])) { p.dc = L.DIRS[p.face].c; p.dr = L.DIRS[p.face].r; }
    if (p.dc || p.dr) p.face = dirIndex(p.dc, p.dr);
  }
  function dirIndex(c, r) { for (var i = 0; i < 4; i++) if (L.DIRS[i].c === c && L.DIRS[i].r === r) return i; return 1; }
  function playerArrive(g) {
    var p = g.player, ch = g.grid[p.r][p.c];
    if (ch === '.' || ch === 'o') {
      g.grid[p.r][p.c] = ' '; g.embers--;
      if (ch === '.') { g.score += 10; g.events.push('ember'); }
      else {
        g.score += 50; g.events.push('flare'); g.fright = Math.max(2.5, 7 - g.level * 0.6); g.chain = 0;
        g.wispList.forEach(function (w) {
          if (w.state === 'roam') { w.state = 'frightened'; reverse(w); }
        });
      }
      if (g.embers <= 0) { g.cleared = true; g.events.push('clear'); }
    }
    g.pads.forEach(function (pad) {
      if (pad.c === p.c && pad.r === p.r && pad.cool <= 0 && g.flip <= 0) {
        pad.cool = L.PAD_COOLDOWN; g.flip = L.FLIP_PREVIEW; g.events.push('rune');
      }
    });
  }
  function reverse(w) {
    if (w.dc || w.dr) { w.c = L.wrap(w.c + w.dc); w.r += w.dr; w.t = 1 - w.t; w.dc = -w.dc; w.dr = -w.dr;
      if (w.t >= 1) { w.t = 0; } }
  }
  function target(g, w) {
    var p = g.player, d = L.DIRS[p.face] || { c: 0, r: 0 };
    if (w.state === 'eaten') return { c: 9, r: 9 };
    var scatter = (g.modeClock % 24) < 6;
    if (scatter) return w.home;
    switch (w.kind) {
      case 'chase': return { c: p.c, r: p.r };
      case 'ambush': return { c: p.c + d.c * 4, r: p.r + d.r * 4 };
      case 'flank':
        var ch = g.wispList[0], ax = p.c + d.c * 2, ay = p.r + d.r * 2;
        return { c: ax + (ax - ch.c), r: ay + (ay - ch.r) };
      default:
        var dist = Math.hypot(w.c - p.c, w.r - p.r);
        return dist > 6 ? { c: p.c, r: p.r } : w.home;
    }
  }
  function wispChoose(g, w) {
    var opts = [], rev = (w.face + 2) % 4, i, d;
    for (i = 0; i < 4; i++) {
      d = L.DIRS[i];
      if (i === rev) continue;
      if (passable(g, w.c + d.c, w.r + d.r)) opts.push(i);
    }
    if (!opts.length && passable(g, w.c + L.DIRS[rev].c, w.r + L.DIRS[rev].r)) opts.push(rev);
    if (!opts.length) return;
    var pick;
    if (w.state === 'frightened') pick = opts[Math.floor(g.rand() * opts.length)];
    else {
      var t = target(g, w), best = Infinity;
      opts.forEach(function (o) {
        var dd = L.DIRS[o], dist = Math.pow(w.c + dd.c - t.c, 2) + Math.pow(w.r + dd.r - t.r, 2);
        if (dist < best) { best = dist; pick = o; }
      });
    }
    w.face = pick; w.dc = L.DIRS[pick].c; w.dr = L.DIRS[pick].r;
  }
  function loseLife(g) {
    g.player.dead = 1.4; g.lives--; g.events.push('hit');
  }
  function collide(g) {
    var p = g.player;
    g.wispList.forEach(function (w) {
      if (w.state === 'house' || w.state === 'eaten' || g.player.dead > 0) return;
      var px = p.c + p.dc * p.t, py = p.r + p.dr * p.t, wx = w.c + w.dc * w.t, wy = w.r + w.dr * w.t;
      if (Math.hypot(px - wx, py - wy) < 0.6) {
        if (w.state === 'frightened') {
          g.chain++; var pts = 100 * Math.pow(2, g.chain); g.score += pts;
          w.state = 'eaten'; g.events.push('eat'); g.lastEat = { c: w.c, r: w.r, pts: pts };
        } else loseLife(g);
      }
    });
  }
  L.update = function (g, dt) {
    if (g.over || g.cleared) return;
    g.time += dt;
    var p = g.player;
    if (p.dead > 0) {
      p.dead -= dt;
      if (p.dead <= 0) {
        if (g.lives <= 0) { g.over = true; g.events.push('over'); }
        else { var keepEmbers = g.embers; L.resetActors(g); g.embers = keepEmbers; }
      }
      return;
    }
    g.modeClock += dt;
    g.pads.forEach(function (pad) { if (pad.cool > 0) pad.cool -= dt; });
    if (g.flip > 0) {
      g.flip -= dt;
      if (g.flip <= 0) { g.flip = 0; g.state = 1 - g.state; g.flipCount++; g.events.push('flip'); }
    }
    if (g.fright > 0) {
      g.fright -= dt;
      if (g.fright <= 0) g.wispList.forEach(function (w) { if (w.state === 'frightened') w.state = 'roam'; });
    }
    moveActor(g, p, playerSpeed(g), dt, function () { playerChoose(g); }, function () { playerArrive(g); });
    g.wispList.forEach(function (w) {
      if (w.state === 'house') {
        w.release -= dt;
        if (w.release <= 0) { w.state = g.fright > 0 ? 'frightened' : 'roam'; w.c = 9; w.r = 7; w.t = 0; w.dc = 0; w.dr = 0; w.face = 1; }
        return;
      }
      moveActor(g, w, wispSpeed(g, w), dt, function (a) { wispChoose(g, a); }, function (a) {
        if (a.state === 'eaten' && a.c === 9 && a.r === 9) { a.state = 'house'; a.release = 1.5; }
      });
    });
    collide(g);
    if (g.cleared) { g.score += 500; }
  };
  L.nextLevel = function (g) { g.level++; L.loadLevel(g); };
  L.drain = function (g) { var e = g.events; g.events = []; return e; };
})(typeof window !== 'undefined' ? window : this);
