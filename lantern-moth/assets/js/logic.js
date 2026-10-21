(function (global) {
  'use strict';
  var LM = global.LM = global.LM || {};
  // # hedge, . seed, o lantern, ' ' empty, D spider-pen door, A/B swinging gates.
  var TOP = [
    '#################',
    '#o......#......o#',
    '#.##.##.#.##.##.#',
    '#...A.......A...#',
    '#.##.#.###.#.##.#',
    '#....#.   .#....#',
    '####.#.#D#.#.####'];
  var MAZE = TOP.slice();
  MAZE.push('#.....#   #.....#');
  for (var i = TOP.length - 1; i >= 0; i--) {
    MAZE.push(TOP[i].replace('D', '#').replace(/A/g, 'B'));
  }
  var W = 17, H = MAZE.length, DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  var GATE_PERIOD = 8, GATE_WARN = 1.6, PEN = { c: 8, r: 7 }, DOOR = { c: 8, r: 6 }, OUT = { c: 8, r: 5 };
  var START = { c: 8, r: 11 };
  var SCATTER = [{ c: 15, r: 0 }, { c: 1, r: 0 }, { c: 15, r: 14 }, { c: 1, r: 14 }];
  var NAMES = ['Stalker', 'Weaver', 'Shade', 'Drifter'];

  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function cell(c, r) { return r < 0 || r >= H || c < 0 || c >= W ? '#' : MAZE[r][c]; }
  // Gate A is open on even swings, gate B on odd swings; the swing is previewed GATE_WARN seconds early.
  function gatePhase(t) { return Math.floor(t / GATE_PERIOD) % 2; }
  function gateOpen(run, ch) { return ch === 'A' ? gatePhase(run.t) === 1 : gatePhase(run.t) === 0; }
  function gateWarn(t) { return GATE_PERIOD - (t % GATE_PERIOD) < GATE_WARN; }
  function passable(run, c, r, spider) {
    var ch = cell(c, r);
    if (ch === '#') return false;
    if (ch === 'D') return !!spider;
    if (ch === 'A' || ch === 'B') return gateOpen(run, ch);
    return true;
  }
  function freshBoard() {
    var seeds = {}, count = 0;
    for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) {
      var ch = MAZE[r][c];
      if (ch === '.' || ch === 'o') { seeds[c + ',' + r] = ch; count++; }
    }
    return { seeds: seeds, left: count, total: count };
  }
  function mover(c, r, dir) { return { c: c, r: r, tc: c, tr: r, p: 0, dir: dir, x: c, y: r }; }
  function place(m) { m.x = m.c + (m.tc - m.c) * m.p; m.y = m.r + (m.tr - m.r) * m.p; }
  function resetActors(run) {
    run.moth = mover(START.c, START.r, 3); run.moth.moving = false; run.want = 3;
    run.spiders = [0, 1, 2, 3].map(function (i) {
      var s = mover(i === 0 ? OUT.c : PEN.c + (i === 1 ? -1 : i === 2 ? 0 : 1), i === 0 ? OUT.r : PEN.r, 3);
      s.id = i; s.name = NAMES[i]; s.state = i === 0 ? 'hunt' : 'pen';
      s.release = run.t + (i === 0 ? 0 : i * 3.2 / (1 + run.level * 0.08)); s.edible = false;
      return s;
    });
    run.power = 0; run.chain = 0;
  }
  function newRun(seed) {
    var run = { seed: seed || 1, level: 1, score: 0, lives: 3, t: 0, state: 'ready', timer: 1.2, over: false,
      events: [], nextLife: 10000, stats: { seeds: 0, spiders: 0, best: 0 } };
    run.rand = rng(run.seed); run.board = freshBoard(); resetActors(run); return run;
  }
  function emit(run, type, extra) { run.events.push({ type: type, data: extra }); }
  function add(run, n) {
    run.score += n;
    while (run.score >= run.nextLife) { run.lives++; run.nextLife += 10000; emit(run, 'life'); }
  }
  function setDir(run, d) { if (d >= 0 && d < 4) run.want = d; if (run.state === 'ready') run.state = 'play'; }
  function speedOf(run, s) {
    var k = 1 + Math.min(run.level - 1, 8) * 0.04;
    if (!s) return 5.6 * k;
    if (s.state === 'eyes') return 10;
    if (s.edible) return 3.2;
    return 4.9 * k;
  }
  function phaseMode(run) { // hunt vs scatter: short scatter breaks early in each cycle
    var cyc = (run.t - run.modeStart) % 27;
    return cyc < Math.max(2, 6 - run.level * 0.5) ? 'scatter' : 'hunt';
  }
  function targetFor(run, s) {
    var m = run.moth, d = DIRS[m.dir], mc = Math.round(m.x), mr = Math.round(m.y);
    if (s.state === 'eyes') return PEN;
    if (s.state === 'leaving') return OUT;
    if (phaseMode(run) === 'scatter') return SCATTER[s.id];
    if (s.id === 0) return { c: mc, r: mr };
    if (s.id === 1) return { c: mc + d[0] * 4, r: mr + d[1] * 4 };
    if (s.id === 2) {
      var a = run.spiders[0], pc = mc + d[0] * 2, pr = mr + d[1] * 2;
      return { c: pc * 2 - Math.round(a.x), r: pr * 2 - Math.round(a.y) };
    }
    var dist = Math.hypot(mc - s.c, mr - s.r);
    return dist > 6 ? { c: mc, r: mr } : SCATTER[3];
  }
  function chooseSpiderDir(run, s) {
    var opts = [];
    for (var d = 0; d < 4; d++) {
      var nc = s.c + DIRS[d][0], nr = s.r + DIRS[d][1];
      if (!passable(run, nc, nr, true)) continue;
      if (cell(nc, nr) === 'D' && s.state === 'hunt') continue;
      opts.push(d);
    }
    if (!opts.length) return -1;
    var back = (s.dir + 2) % 4, fwd = opts.filter(function (d) { return d !== back; });
    if (fwd.length) opts = fwd;
    if (s.edible && s.state === 'hunt') return opts[Math.floor(run.rand() * opts.length)];
    var t = targetFor(run, s), best = opts[0], bd = Infinity;
    opts.forEach(function (d) {
      var dd = Math.pow(s.c + DIRS[d][0] - t.c, 2) + Math.pow(s.r + DIRS[d][1] - t.r, 2);
      if (dd < bd) { bd = dd; best = d; }
    });
    return best;
  }
  function stepMoth(run, dt) {
    var m = run.moth, budget = speedOf(run) * dt;
    if (m.moving && run.want === (m.dir + 2) % 4) { // instant reversal mid-corridor
      var c = m.c, r = m.r; m.c = m.tc; m.r = m.tr; m.tc = c; m.tr = r; m.p = 1 - m.p; m.dir = run.want;
    }
    while (budget > 0) {
      if (!m.moving) {
        var nd = run.want, nc = m.c + DIRS[nd][0], nr = m.r + DIRS[nd][1];
        if (!passable(run, nc, nr, false)) {
          nd = m.dir; nc = m.c + DIRS[nd][0]; nr = m.r + DIRS[nd][1];
          if (!passable(run, nc, nr, false)) break;
        }
        m.dir = nd; m.tc = nc; m.tr = nr; m.p = 0; m.moving = true;
      }
      var need = 1 - m.p;
      if (budget < need) { m.p += budget; budget = 0; break; }
      budget -= need; m.c = m.tc; m.r = m.tr; m.p = 0; m.moving = false;
      eat(run, m.c, m.r);
      if (run.state !== 'play') break;
    }
    place(m);
  }
  function eat(run, c, r) {
    var key = c + ',' + r, kind = run.board.seeds[key];
    if (!kind) return;
    delete run.board.seeds[key]; run.board.left--; run.stats.seeds++;
    if (kind === 'o') {
      add(run, 50); run.power = Math.max(2.5, 7 - run.level * 0.5); run.chain = 0;
      run.spiders.forEach(function (s) { if (s.state === 'hunt') { s.edible = true; s.dir = (s.dir + 2) % 4; } });
      emit(run, 'lantern');
    } else { add(run, 10); emit(run, 'seed'); }
    if (run.board.left <= 0) { run.state = 'clear'; run.timer = 2; add(run, 500 + run.level * 100); emit(run, 'clear'); }
  }
  function stepSpider(run, s, dt) {
    if (s.state === 'pen') {
      s.x = s.c + Math.sin(run.t * 6 + s.id) * 0.12; s.y = s.r;
      if (run.t >= s.release) { s.state = 'leaving'; s.c = PEN.c; s.r = PEN.r; s.tc = s.c; s.tr = s.r; s.p = 0; s.dir = 0; }
      return;
    }
    var budget = speedOf(run, s) * dt;
    while (budget > 0) {
      if (s.tc === s.c && s.tr === s.r) {
        var d = chooseSpiderDir(run, s);
        if (d < 0) break;
        s.dir = d; s.tc = s.c + DIRS[d][0]; s.tr = s.r + DIRS[d][1]; s.p = 0;
      }
      var need = 1 - s.p;
      if (budget < need) { s.p += budget; budget = 0; break; }
      budget -= need; s.c = s.tc; s.r = s.tr; s.p = 0;
      if (s.state === 'leaving' && s.c === OUT.c && s.r === OUT.r) s.state = 'hunt';
      if (s.state === 'eyes' && s.c === PEN.c && s.r === PEN.r) {
        s.state = 'pen'; s.edible = false; s.release = run.t + 1.2; budget = 0; s.tc = s.c; s.tr = s.r;
      }
    }
    place(s);
  }
  function collide(run) {
    var m = run.moth;
    for (var i = 0; i < run.spiders.length; i++) {
      var s = run.spiders[i];
      if (s.state === 'pen' || s.state === 'eyes' || Math.hypot(s.x - m.x, s.y - m.y) > 0.62) continue;
      if (s.edible) {
        run.chain++; var pts = 200 * Math.pow(2, run.chain - 1); add(run, pts);
        s.state = 'eyes'; s.edible = false; run.stats.spiders++; emit(run, 'eat', { points: pts, x: s.x, y: s.y });
      } else {
        run.lives--; run.state = 'dying'; run.timer = 1.6; emit(run, 'death'); return;
      }
    }
  }
  function nextLevel(run) {
    run.level++; run.board = freshBoard(); run.modeStart = run.t; resetActors(run); run.state = 'ready'; run.timer = 1;
  }
  function step(run, dt) {
    if (run.over) return;
    var wasWarn = gateWarn(run.t), wasPhase = gatePhase(run.t);
    run.t += dt;
    if (run.modeStart === undefined) run.modeStart = 0;
    if (gatePhase(run.t) !== wasPhase) emit(run, 'gate'); else if (!wasWarn && gateWarn(run.t)) emit(run, 'warn');
    if (run.state === 'ready') { place(run.moth); return; }
    if (run.state === 'clear') { run.timer -= dt; if (run.timer <= 0) nextLevel(run); return; }
    if (run.state === 'dying') {
      run.timer -= dt;
      if (run.timer <= 0) {
        if (run.lives <= 0) { run.over = true; run.state = 'over'; emit(run, 'over'); }
        else { resetActors(run); run.state = 'ready'; }
      }
      return;
    }
    if (run.power > 0) {
      run.power -= dt;
      if (run.power <= 0) run.spiders.forEach(function (s) { s.edible = false; });
    }
    stepMoth(run, dt);
    if (run.state !== 'play') return;
    run.spiders.forEach(function (s) { stepSpider(run, s, dt); });
    collide(run);
  }
  LM.Logic = { MAZE: MAZE, W: W, H: H, DIRS: DIRS, GATE_PERIOD: GATE_PERIOD, GATE_WARN: GATE_WARN, START: START,
    PEN: PEN, newRun: newRun, step: step, setDir: setDir, cell: cell, passable: passable, gateOpen: gateOpen,
    gateWarn: gateWarn, gatePhase: gatePhase, speedOf: speedOf };
})(window);
