(function (global) {
  'use strict';
  var WW = global.WW = global.WW || {};
  var L = WW.Logic = {};
  // '#' wall, '.' ember, 'o' power ember, ' ' floor, 'H' ghost house, '-' house door,
  // 'a'/'b' lantern gates (open in alternating phases), 'P' wisp start.
  L.MAZE = [
    '###################',
    '#........#........#',
    '#o##.###.#.###.##o#',
    '#........a........#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.###   ###.####',
    '####.#       #.####',
    '####.# ##-## #.####',
    '    .  #HHH#  .    ',
    '####.# ##### #.####',
    '####.#       #.####',
    '####.###   ###.####',
    '#...b....#....b...#',
    '#.##.###.#.###.##.#',
    '#o.#.....P.....#.o#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#........a........#',
    '###################'
  ];
  L.W = 19; L.H = 21; L.TUNNEL_ROW = 9;
  L.HOUSE = { c: 9, r: 9 }; L.DOOR = { c: 9, r: 8 }; L.EXIT = { c: 9, r: 7 };
  L.GATE_PERIOD = 16; L.GATE_WARN = 3;
  L.DIRS = [{ dx: 0, dy: -1 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }];
  L.GLOAMS = ['cinder', 'mire', 'hush', 'dusk'];
  L.SCATTER = { cinder: { c: 17, r: 1 }, mire: { c: 1, r: 1 }, hush: { c: 17, r: 19 }, dusk: { c: 1, r: 19 } };

  L.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  L.tileAt = function (c, r) {
    if (r < 0 || r >= L.H) return '#';
    if (c < 0 || c >= L.W) {
      if (r !== L.TUNNEL_ROW) return '#';
      c = (c + L.W) % L.W;
    }
    return L.MAZE[r].charAt(c);
  };

  // kind: 'wisp' or 'gloam' (gloams may use house tiles).
  L.passable = function (s, c, r, kind) {
    var ch = L.tileAt(c, r);
    if (ch === '#') return false;
    if (ch === 'a' || ch === 'b') return !!s.gate[ch];
    if (ch === 'H' || ch === '-') return kind === 'gloam';
    return true;
  };

  L.wrap = function (c) { return (c + L.W) % L.W; };

  L.pos = function (a) {
    return { x: a.c + a.dx * a.p, y: a.r + a.dy * a.p };
  };

  L.params = function (level) {
    var l = Math.min(level, 12) - 1;
    return {
      wisp: 5.4 + l * 0.12, gloam: 4.7 + l * 0.18, scared: 2.9, eyes: 10,
      fright: Math.max(2.5, 7.5 - l * 0.5),
      modes: l < 2 ? [6, 18, 6, 18, 5, 20, 5] : [5, 18, 5, 20, 4, 24, 3],
      release: [0, 2, 5, 9]
    };
  };

  L.newGame = function (seed) {
    var s = {
      seed: seed >>> 0, rand: L.rng(seed), score: 0, lives: 3, level: 1, extra: false,
      events: [], t: 0, best: 0
    };
    L.startLevel(s);
    return s;
  };

  L.startLevel = function (s) {
    s.dots = []; s.total = 0; s.eaten = 0;
    for (var r = 0; r < L.H; r++) {
      var row = [];
      for (var c = 0; c < L.W; c++) {
        var ch = L.MAZE[r].charAt(c), v = ch === '.' ? 1 : ch === 'o' ? 2 : 0;
        if (v) s.total++;
        row.push(v);
      }
      s.dots.push(row);
    }
    s.gate = { a: true, b: false };
    s.gateTimer = L.GATE_PERIOD; s.warn = false; s.gateFlips = 0;
    s.charges = 0; s.chargeProgress = 0; s.flareFx = 0; s.flareQueued = false;
    s.fruit = null; s.fruitSpawned = 0;
    s.p = L.params(s.level);
    L.resetActors(s);
  };

  L.resetActors = function (s) {
    s.wisp = { c: 9, r: 15, dx: 0, dy: 0, p: 0, want: { dx: 0, dy: 0 } };
    s.gloams = L.GLOAMS.map(function (name, i) {
      var out = i === 0;
      return { name: name, i: i, c: out ? 9 : 8 + (i - 1), r: out ? 7 : 9, dx: out ? -1 : 0, dy: 0, p: 0,
        state: out ? 'roam' : 'house', timer: out ? 0 : s.p.release[i], scared: false, stun: 0, rev: false };
    });
    s.mode = 'scatter'; s.modeIndex = 0; s.modeTimer = s.p.modes[0];
    s.fright = 0; s.chain = 0;
    s.status = 'ready'; s.statusTimer = 1.8; s.events.push({ type: 'ready' });
  };

  L.setDir = function (s, dx, dy) { s.wisp.want = { dx: dx, dy: dy }; };
  L.flare = function (s) { s.flareQueued = true; };

  function dist2(ax, ay, bx, by) { return (ax - bx) * (ax - bx) + (ay - by) * (ay - by); }

  L.bfsStep = function (s, a, tc, tr) {
    // first step direction for a gloam at tile a toward (tc,tr) over gloam-passable tiles
    var seen = {}, queue = [{ c: tc, r: tr }];
    seen[tr * 100 + tc] = 0;
    for (var qi = 0; qi < queue.length; qi++) {
      var n = queue[qi];
      for (var d = 0; d < 4; d++) {
        var nc = L.wrap(n.c + L.DIRS[d].dx), nr = n.r + L.DIRS[d].dy;
        if (nr < 0 || nr >= L.H || seen[nr * 100 + nc] !== undefined) continue;
        if (!L.passable(s, nc, nr, 'gloam')) continue;
        seen[nr * 100 + nc] = seen[n.r * 100 + n.c] + 1;
        queue.push({ c: nc, r: nr });
      }
    }
    var best = null, bd = 1e9;
    for (var k = 0; k < 4; k++) {
      var dir = L.DIRS[k], cc = L.wrap(a.c + dir.dx), rr = a.r + dir.dy;
      var dd = seen[rr * 100 + cc];
      if (dd !== undefined && dd < bd) { bd = dd; best = dir; }
    }
    return best;
  };

  L.target = function (s, g) {
    var w = s.wisp, wp = L.pos(w), wd = (w.dx || w.dy) ? w : s.lastDir || { dx: 0, dy: 0 };
    if (s.mode === 'scatter') return L.SCATTER[g.name];
    var tx = Math.round(wp.x), ty = Math.round(wp.y);
    var dx = w.dx || (s.lastDir ? s.lastDir.dx : 0), dy = w.dy || (s.lastDir ? s.lastDir.dy : 0);
    if (g.name === 'cinder') return { c: tx, r: ty };
    if (g.name === 'mire') return { c: tx + dx * 4, r: ty + dy * 4 };
    if (g.name === 'hush') {
      var c0 = s.gloams[0], px = tx + dx * 2, py = ty + dy * 2;
      return { c: px + (px - c0.c), r: py + (py - c0.r) };
    }
    var gp = L.pos(g);
    return dist2(gp.x, gp.y, wp.x, wp.y) > 36 ? { c: tx, r: ty } : L.SCATTER.dusk;
  };

  function chooseGloam(s, g) {
    var opts = [], i;
    var reverse = (g.dx || g.dy) ? { dx: -g.dx, dy: -g.dy } : null;
    for (i = 0; i < 4; i++) {
      var d = L.DIRS[i];
      if (reverse && d.dx === reverse.dx && d.dy === reverse.dy) continue;
      if (L.passable(s, g.c + d.dx, g.r + d.dy, 'gloam') && !(L.tileAt(g.c + d.dx, g.r + d.dy) === '-' && g.state === 'roam')) opts.push(d);
    }
    if (!opts.length && reverse && L.passable(s, g.c + reverse.dx, g.r + reverse.dy, 'gloam') &&
      !(L.tileAt(g.c + reverse.dx, g.r + reverse.dy) === '-' && g.state === 'roam')) opts.push(reverse);
    if (!opts.length) return { dx: 0, dy: 0 };
    if (g.state === 'eyes') return L.bfsStep(s, g, L.HOUSE.c, L.HOUSE.r) || opts[0];
    if (g.state === 'leaving') return L.bfsStep(s, g, L.EXIT.c, L.EXIT.r) || opts[0];
    if (g.scared) return opts[Math.floor(s.rand() * opts.length)];
    var t = L.target(s, g), best = opts[0], bd = 1e9;
    for (i = 0; i < opts.length; i++) {
      var o = opts[i], dd = dist2(g.c + o.dx, g.r + o.dy, t.c, t.r);
      if (dd < bd) { bd = dd; best = o; }
    }
    return best;
  }

  function advance(s, a, dist, decide) {
    var guard = 0;
    while (dist > 1e-9 && guard++ < 8) {
      if (a.p === 0) {
        var d = decide(a);
        a.dx = d.dx; a.dy = d.dy;
        if (!a.dx && !a.dy) return;
      }
      var step = Math.min(dist, 1 - a.p);
      a.p += step; dist -= step;
      if (a.p >= 1 - 1e-9) {
        a.c = L.wrap(a.c + a.dx); a.r += a.dy; a.p = 0;
        if (a.name === undefined && (a.dx || a.dy)) s.lastDir = { dx: a.dx, dy: a.dy };
        if (a.name !== undefined) { if (a.c === L.HOUSE.c && a.r === L.HOUSE.r && a.state === 'eyes') return; }
      }
    }
  }

  function decideWisp(s) {
    return function (a) {
      var w = a.want;
      if ((w.dx || w.dy) && L.passable(s, a.c + w.dx, a.r + w.dy, 'wisp')) return { dx: w.dx, dy: w.dy };
      if ((a.dx || a.dy) && L.passable(s, a.c + a.dx, a.r + a.dy, 'wisp')) return { dx: a.dx, dy: a.dy };
      return { dx: 0, dy: 0 };
    };
  }

  function gateOccupied(s, ch) {
    var all = [s.wisp].concat(s.gloams);
    for (var i = 0; i < all.length; i++) {
      var a = all[i], tiles = [[a.c, a.r]];
      if (a.dx || a.dy) tiles.push([L.wrap(a.c + a.dx), a.r + a.dy]);
      for (var k = 0; k < tiles.length; k++) if (L.tileAt(tiles[k][0], tiles[k][1]) === ch) return true;
    }
    return false;
  }

  function updateGates(s, dt) {
    s.gateTimer -= dt;
    var warn = s.gateTimer < L.GATE_WARN;
    if (warn && !s.warn) s.events.push({ type: 'gateWarn' });
    s.warn = warn;
    if (s.gateTimer <= 0) {
      var closing = s.gate.a ? 'a' : 'b', opening = closing === 'a' ? 'b' : 'a';
      if (gateOccupied(s, closing)) { s.gateTimer = 0; return; }
      s.gate[closing] = false; s.gate[opening] = true;
      s.gateTimer = L.GATE_PERIOD; s.warn = false; s.gateFlips++;
      s.events.push({ type: 'gateFlip' });
    }
  }

  function updateModes(s, dt) {
    if (s.fright > 0) return;
    if (s.modeIndex >= s.p.modes.length) return;
    s.modeTimer -= dt;
    if (s.modeTimer <= 0) {
      s.modeIndex++;
      s.mode = s.modeIndex % 2 === 0 ? 'scatter' : 'chase';
      s.modeTimer = s.modeIndex < s.p.modes.length ? s.p.modes[s.modeIndex] : Infinity;
      s.gloams.forEach(function (g) { if (g.state === 'roam' && (g.dx || g.dy)) g.rev = true; });
    }
  }

  function addScore(s, n) {
    var before = s.score; s.score += n;
    if (!s.extra && before < 10000 && s.score >= 10000) { s.extra = true; s.lives++; s.events.push({ type: 'life' }); }
  }

  function eatTile(s) {
    var w = s.wisp, pos = L.pos(w), c = L.wrap(Math.round(pos.x)), r = Math.round(pos.y);
    if (r < 0 || r >= L.H) return;
    var v = s.dots[r][c];
    if (v) {
      s.dots[r][c] = 0; s.eaten++;
      s.chargeProgress++;
      if (s.chargeProgress >= 25) { s.chargeProgress = 0; if (s.charges < 2) { s.charges++; s.events.push({ type: 'charge' }); } }
      if (v === 1) { addScore(s, 10); s.events.push({ type: 'ember', c: c, r: r }); }
      else {
        addScore(s, 50); s.events.push({ type: 'power', c: c, r: r });
        s.fright = s.p.fright; s.chain = 0;
        s.gloams.forEach(function (g) {
          if (g.state === 'roam' || g.state === 'leaving') { g.scared = true; if (g.state === 'roam') g.rev = true; }
        });
      }
      if (!s.fruit && s.fruitSpawned < 2 && s.eaten >= (s.fruitSpawned ? 140 : 70)) {
        s.fruit = { c: 9, r: 11, t: 9 }; s.fruitSpawned++; s.events.push({ type: 'fruitSpawn' });
      }
    }
    if (s.fruit && c === s.fruit.c && r === s.fruit.r) {
      var pts = 100 * Math.min(s.level, 10) + 200;
      addScore(s, pts); s.events.push({ type: 'fruit', points: pts, c: c, r: r }); s.fruit = null;
    }
  }

  function doFlare(s) {
    s.flareQueued = false;
    if (s.charges <= 0) { s.events.push({ type: 'flareFail' }); return; }
    s.charges--; s.flareFx = 0.6;
    var wp = L.pos(s.wisp), hit = 0;
    s.gloams.forEach(function (g) {
      if (g.state === 'eyes' || g.state === 'house') return;
      var gp = L.pos(g);
      if (dist2(gp.x, gp.y, wp.x, wp.y) <= 3.4 * 3.4) { g.stun = 2.4; hit++; }
    });
    s.events.push({ type: 'flare', hit: hit });
  }

  function collide(s) {
    var wp = L.pos(s.wisp);
    for (var i = 0; i < s.gloams.length; i++) {
      var g = s.gloams[i];
      if (g.state === 'eyes' || g.state === 'house' || g.stun > 0) continue;
      var gp = L.pos(g);
      if (dist2(gp.x, gp.y, wp.x, wp.y) < 0.36) {
        if (g.scared) {
          s.chain++;
          var pts = 200 * Math.pow(2, Math.min(s.chain, 4) - 1);
          addScore(s, pts); g.state = 'eyes'; g.scared = false;
          s.events.push({ type: 'eatGloam', points: pts, x: gp.x, y: gp.y });
        } else {
          s.status = 'dying'; s.statusTimer = 1.5; s.lives--;
          s.events.push({ type: 'death' });
          return;
        }
      }
    }
  }

  L.step = function (s, dt) {
    s.t += dt;
    if (s.flareFx > 0) s.flareFx = Math.max(0, s.flareFx - dt);
    if (s.status === 'ready') {
      s.statusTimer -= dt;
      if (s.statusTimer <= 0) { s.status = 'play'; s.events.push({ type: 'go' }); }
      return;
    }
    if (s.status === 'dying') {
      s.statusTimer -= dt;
      if (s.statusTimer <= 0) {
        if (s.lives > 0) L.resetActors(s); else { s.status = 'over'; s.events.push({ type: 'over' }); }
      }
      return;
    }
    if (s.status === 'clear') {
      s.statusTimer -= dt;
      if (s.statusTimer <= 0) { s.level++; L.startLevel(s); }
      return;
    }
    if (s.status !== 'play') return;

    updateGates(s, dt);
    updateModes(s, dt);
    if (s.fright > 0) {
      s.fright -= dt;
      if (s.fright <= 0) { s.fright = 0; s.gloams.forEach(function (g) { g.scared = false; }); }
    }
    if (s.flareQueued) doFlare(s);
    if (s.fruit) { s.fruit.t -= dt; if (s.fruit.t <= 0) s.fruit = null; }

    var w = s.wisp, want = w.want;
    // instant reversal mid-corridor
    if (w.p > 0 && (want.dx || want.dy) && want.dx === -w.dx && want.dy === -w.dy) {
      w.c = L.wrap(w.c + w.dx); w.r += w.dy; w.dx = want.dx; w.dy = want.dy; w.p = 1 - w.p;
    }
    advance(s, w, s.p.wisp * dt, decideWisp(s));
    eatTile(s);

    s.gloams.forEach(function (g) {
      if (g.stun > 0) { g.stun = Math.max(0, g.stun - dt); return; }
      if (g.state === 'house') {
        g.timer -= dt;
        if (g.timer <= 0) { g.state = 'leaving'; }
        return;
      }
      var speed = g.state === 'eyes' ? s.p.eyes : g.scared ? s.p.scared : s.p.gloam;
      if (g.rev && g.p === 0) { g.dx = -g.dx; g.dy = -g.dy; g.rev = false; if (L.passable(s, g.c + g.dx, g.r + g.dy, 'gloam')) { /* keep */ } }
      var wasState = g.state;
      advance(s, g, speed * dt, function (a) {
        if (a.rev) { a.rev = false; var rv = { dx: -a.dx, dy: -a.dy }; if ((rv.dx || rv.dy) && L.passable(s, a.c + rv.dx, a.r + rv.dy, 'gloam')) return rv; }
        return chooseGloam(s, a);
      });
      if (g.state === 'eyes' && g.c === L.HOUSE.c && g.r === L.HOUSE.r && g.p === 0) {
        g.state = 'leaving'; g.dx = 0; g.dy = 0;
      } else if (g.state === 'leaving' && g.c === L.EXIT.c && g.r === L.EXIT.r && g.p === 0) {
        g.state = 'roam'; g.dx = -1; g.dy = 0;
      }
      if (wasState === 'eyes' && g.state !== 'eyes') g.scared = false;
    });
    collide(s);

    if (s.status === 'play' && s.eaten >= s.total) {
      s.status = 'clear'; s.statusTimer = 2.2; addScore(s, 500 + s.level * 100);
      s.events.push({ type: 'clear' });
    }
    if (s.score > s.best) s.best = s.score;
  };

  L.drain = function (s) { var e = s.events; s.events = []; return e; };

  // Reachability of every ember with the given gate phase open.
  L.reachable = function (gate) {
    var s = { gate: gate }, seen = {}, q = [{ c: 9, r: 15 }];
    seen[15 * 100 + 9] = 1;
    for (var i = 0; i < q.length; i++) {
      for (var d = 0; d < 4; d++) {
        var nc = L.wrap(q[i].c + L.DIRS[d].dx), nr = q[i].r + L.DIRS[d].dy;
        if (nr < 0 || nr >= L.H || seen[nr * 100 + nc]) continue;
        if (!L.passable(s, nc, nr, 'wisp')) continue;
        seen[nr * 100 + nc] = 1; q.push({ c: nc, r: nr });
      }
    }
    return seen;
  };
})(typeof window !== 'undefined' ? window : this);
