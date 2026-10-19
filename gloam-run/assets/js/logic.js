(function (global) {
  'use strict';
  var GR = global.GR = global.GR || {};
  // Legend: # hedge, . mote, o lantern, S moonstone switch, a/b turnstile gate
  // (a = open east-west, b = open north-south), - shade door, H shade spawn, W wick spawn.
  var MAZE = [
    '###################',
    '#........#........#',
    '#o##.###.#.###.##o#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.###.#.###.####',
    '####.#...a...#.####',
    '####.#.##-##.#.####',
    '.......#HHH#.......',
    '####.#.#####.#.####',
    '####.#...b...#.####',
    '####.#.#####.#.####',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#oS#...........#So#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#........W........#',
    '###################'
  ];
  var W = MAZE[0].length, H = MAZE.length;
  var DIRS = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }]; // up, left, down, right
  var TURN_SECONDS = 0; // gates only rotate on switches
  var HUNTER_NAMES = ['Gloaming', 'Dusk', 'Vesper', 'Murk'];

  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function cell(x, y) {
    if (y < 0 || y >= H) return '#';
    if (x < 0) x += W; else if (x >= W) x -= W;
    return MAZE[y][x];
  }
  function levelParams(level) {
    var l = Math.min(level, 12) - 1;
    return { wick: 5.6 + l * .12, hunter: 4.7 + l * .22, frightened: Math.max(2.5, 7 - l * .5),
      scatter: Math.max(2, 7 - l * .4), chase: 14 + l * 1.5 };
  }
  function newRun(seed) {
    var run = { seed: seed || 20261019, level: 1, score: 0, lives: 3, motes: 0, eaten: 0, bestChain: 0,
      time: 0, ended: false, last: '', gateState: 0, switchArmed: true, rand: rng(seed || 20261019),
      chain: 0, flashes: [], events: [], bloom: null, bloomsTaken: 0, readyTimer: 1.6, deathTimer: 0,
      frightTimer: 0, modeTimer: 0, modeIndex: 0 };
    loadLevel(run, true); return run;
  }
  function loadLevel(run, first) {
    run.grid = MAZE.map(function (r) { return r.split(''); });
    run.motesLeft = 0; run.gates = [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var c = run.grid[y][x];
      if (c === '.' || c === 'o') run.motesLeft++;
      if (c === 'a' || c === 'b') run.gates.push({ x: x, y: y, base: c === 'a' ? 0 : 1 });
      if (c === 'W') { run.grid[y][x] = ' '; run.start = { x: x, y: y }; }
    }
    run.totalMotes = run.motesLeft; run.collected = 0; run.gateState = 0; run.bloomsTaken = 0; run.bloom = null;
    run.params = levelParams(run.level);
    resetActors(run);
  }
  function resetActors(run) {
    run.wick = { x: run.start.x, y: run.start.y, dir: 3, want: 3, t: 0, nx: run.start.x, ny: run.start.y, moving: false };
    var homes = [{ x: 9, y: 7 }, { x: 8, y: 9 }, { x: 9, y: 9 }, { x: 10, y: 9 }];
    var corners = [{ x: 17, y: 0 }, { x: 1, y: 0 }, { x: 17, y: 20 }, { x: 1, y: 20 }];
    run.hunters = homes.map(function (h, i) {
      return { id: i, name: HUNTER_NAMES[i], x: h.x, y: h.y, nx: h.x, ny: h.y, t: 0, dir: i === 0 ? 1 : 0,
        moving: false, mode: i === 0 ? 'out' : 'house', release: i * 3.2, corner: corners[i], eaten: false };
    });
    run.frightTimer = 0; run.chain = 0; run.modeTimer = 0; run.modeIndex = 0; run.readyTimer = 1.6;
  }
  function gateAxis(run, g) { return (g.base + run.gateState) % 2; } // 0 east-west, 1 north-south
  function passable(run, x, y, dx, dy, forHunter, fromHouse) {
    if (x < 0) x += W; else if (x >= W) x -= W;
    if (y < 0 || y >= H) return false;
    var c = run.grid[y][x];
    if (c === '#') return false;
    if (c === '-') return !!forHunter;
    if (c === 'H' || (y === 9 && x >= 8 && x <= 10)) return !!forHunter;
    if (c === 'a' || c === 'b') {
      var axis = (c === 'a' ? 0 : 1) + run.gateState; axis %= 2;
      return axis === 0 ? dy === 0 : dx === 0;
    }
    return true;
  }
  function canMove(run, ent, d, forHunter) {
    return passable(run, ent.x + DIRS[d].x, ent.y + DIRS[d].y, DIRS[d].x, DIRS[d].y, forHunter);
  }
  // Gate cells also block entry along the wrong axis from the neighbouring side.
  function toggleGates(run) {
    run.gateState = (run.gateState + 1) % 2; run.events.push({ type: 'gates', state: run.gateState });
    // A Shade or Wick inside a gate cell when it turns is swept to the nearest free tile in its heading.
  }
  function eat(run, x, y) {
    var c = run.grid[y][x];
    if (c === '.') { run.grid[y][x] = ' '; run.score += 10; run.motesLeft--; run.collected++; run.events.push({ type: 'mote', x: x, y: y }); }
    else if (c === 'o') {
      run.grid[y][x] = ' '; run.score += 50; run.motesLeft--; run.collected++; run.chain = 0;
      run.frightTimer = run.params.frightened;
      run.hunters.forEach(function (h) { if (!h.eaten && h.mode !== 'house') { h.mode = 'scared'; h.dir = (h.dir + 2) % 4; } });
      run.events.push({ type: 'lantern', x: x, y: y });
    } else if (c === 'S') {
      if (run.switchArmed) { run.switchArmed = false; toggleGates(run); run.score += 25; }
    }
    if (c !== 'S') { /* leaving a switch re-arms it */ }
    if (run.collected === 70 || run.collected === 150) {
      run.bloom = { x: 9, y: 11, life: 9, value: 500 * Math.min(run.level, 8) };
      run.events.push({ type: 'bloom-spawn' });
    }
    if (run.motesLeft <= 0) { run.score += 1000 * run.level; run.events.push({ type: 'clear' }); nextLevel(run); }
  }
  function nextLevel(run) {
    run.level++; run.last = 'LEVEL ' + run.level; loadLevel(run);
  }
  function targetFor(run, h) {
    var w = run.wick, d = DIRS[w.dir];
    if (h.mode === 'return') return { x: 9, y: 7 };
    if (h.mode === 'scatter') return h.corner;
    if (h.id === 0) return { x: w.x, y: w.y };
    if (h.id === 1) return { x: w.x + d.x * 4, y: w.y + d.y * 4 };
    if (h.id === 2) {
      var g = run.hunters[0], ax = w.x + d.x * 2, ay = w.y + d.y * 2;
      return { x: ax * 2 - g.x, y: ay * 2 - g.y };
    }
    var dist = (h.x - w.x) * (h.x - w.x) + (h.y - w.y) * (h.y - w.y);
    return dist > 64 ? { x: w.x, y: w.y } : h.corner;
  }
  function chooseHunterDir(run, h) {
    var opts = [], i, back = (h.dir + 2) % 4;
    for (i = 0; i < 4; i++) {
      if (i === back) continue;
      if (canMove(run, h, i, true)) opts.push(i);
    }
    if (!opts.length) { return canMove(run, h, back, true) ? back : h.dir; }
    if (h.mode === 'scared') return opts[Math.floor(run.rand() * opts.length)];
    var t = targetFor(run, h), best = opts[0], bd = 1e9;
    opts.forEach(function (d) {
      var nx = h.x + DIRS[d].x, ny = h.y + DIRS[d].y;
      var dd = (nx - t.x) * (nx - t.x) + (ny - t.y) * (ny - t.y);
      if (dd < bd - 1e-9) { bd = dd; best = d; }
    });
    return best;
  }
  function wrap(x) { return x < 0 ? x + W : x >= W ? x - W : x; }
  function stepWick(run, dt) {
    var w = run.wick, speed = run.params.wick * (run.frightTimer > 0 ? 1.1 : 1);
    var budget = dt * speed;
    while (budget > 1e-9) {
      if (!w.moving) {
        var pick = -1;
        if (canMove(run, w, w.want, false)) pick = w.want;
        else if (canMove(run, w, w.dir, false)) pick = w.dir;
        if (pick < 0) return;
        w.dir = pick; w.moving = true; w.t = 0;
      }
      var need = 1 - w.t;
      if (budget < need) { w.t += budget; return; }
      budget -= need; w.t = 0; w.moving = false;
      w.x = wrap(w.x + DIRS[w.dir].x); w.y += DIRS[w.dir].y;
      if (run.grid[w.y][w.x] !== 'S') run.switchArmed = true;
      eat(run, w.x, w.y);
      if (run.bloom && run.bloom.x === w.x && run.bloom.y === w.y) {
        run.score += run.bloom.value; run.events.push({ type: 'bloom', value: run.bloom.value }); run.bloom = null; run.bloomsTaken++;
      }
      if (run.readyTimer > 0 || run.deathTimer > 0) return;
    }
  }
  function stepHunter(run, h, dt) {
    if (h.mode === 'house') {
      if (run.time >= h.release) { h.mode = 'out'; h.x = 9; h.y = 9; h.nx = 9; h.ny = 9; h.t = 0; h.moving = false; h.dir = 0; }
      return;
    }
    var speed = run.params.hunter;
    if (h.mode === 'scared') speed *= .55;
    if (h.mode === 'return') speed = 11;
    if (h.id === 0 && h.mode !== 'scared' && h.mode !== 'return' && run.motesLeft < 20) speed *= 1.12;
    var budget = dt * speed;
    while (budget > 1e-9) {
      if (!h.moving) {
        h.dir = chooseHunterDir(run, h);
        if (!canMove(run, h, h.dir, true)) return;
        h.moving = true; h.t = 0;
      }
      var need = 1 - h.t;
      if (budget < need) { h.t += budget; return; }
      budget -= need; h.t = 0; h.moving = false;
      h.x = wrap(h.x + DIRS[h.dir].x); h.y += DIRS[h.dir].y;
      if (h.mode === 'return' && h.x === 9 && h.y === 7) { h.mode = 'out'; h.eaten = false; }
    }
  }
  function pos(e) { return { x: e.x + (e.moving ? DIRS[e.dir].x * e.t : 0), y: e.y + (e.moving ? DIRS[e.dir].y * e.t : 0) }; }
  function collide(run) {
    var wp = pos(run.wick);
    for (var i = 0; i < run.hunters.length; i++) {
      var h = run.hunters[i];
      if (h.mode === 'house' || h.mode === 'return') continue;
      var hp = pos(h), d = Math.abs(wp.x - hp.x) + Math.abs(wp.y - hp.y);
      if (Math.min(d, Math.abs(Math.abs(wp.x - hp.x) - W) + Math.abs(wp.y - hp.y)) < .55) {
        if (h.mode === 'scared') {
          run.chain++; run.bestChain = Math.max(run.bestChain, run.chain);
          var pts = 200 * Math.pow(2, Math.min(run.chain - 1, 3));
          run.score += pts; run.eaten++; h.mode = 'return'; h.eaten = true;
          run.events.push({ type: 'eat', value: pts, x: hp.x, y: hp.y });
          run.last = '+' + pts;
        } else { die(run); return; }
      }
    }
  }
  function die(run) {
    run.deathTimer = 1.6; run.lives--; run.events.push({ type: 'die' });
  }
  function updateModes(run, dt) {
    if (run.frightTimer > 0) {
      run.frightTimer -= dt;
      if (run.frightTimer <= 0) { run.frightTimer = 0; run.chain = 0;
        run.hunters.forEach(function (h) { if (h.mode === 'scared') h.mode = run.modeIndex % 2 ? 'chase' : 'scatter'; }); }
      return;
    }
    run.modeTimer += dt;
    var limit = run.modeIndex % 2 === 0 ? run.params.scatter : run.params.chase;
    if (run.modeTimer >= limit && run.modeIndex < 7) {
      run.modeTimer = 0; run.modeIndex++;
      var m = run.modeIndex % 2 ? 'chase' : 'scatter';
      run.hunters.forEach(function (h) { if (h.mode === 'out' || h.mode === 'chase' || h.mode === 'scatter') h.mode = m; });
    }
    run.hunters.forEach(function (h) { if (h.mode === 'out') h.mode = run.modeIndex % 2 ? 'chase' : 'scatter'; });
  }
  function advance(run, dt) {
    if (run.ended) return;
    dt = Math.min(dt, .05);
    if (run.deathTimer > 0) {
      run.deathTimer -= dt;
      if (run.deathTimer <= 0) {
        if (run.lives <= 0) { run.ended = true; return; }
        resetActors(run);
      }
      return;
    }
    if (run.readyTimer > 0) { run.readyTimer -= dt; return; }
    run.time += dt;
    if (run.bloom) { run.bloom.life -= dt; if (run.bloom.life <= 0) run.bloom = null; }
    updateModes(run, dt);
    stepWick(run, dt);
    run.hunters.forEach(function (h) { stepHunter(run, h, dt); });
    collide(run);
  }
  function steer(run, d) {
    var w = run.wick;
    if (d < 0 || d > 3) return;
    w.want = d;
    if (w.moving && d === (w.dir + 2) % 4) { // reverse mid-corridor
      w.x = wrap(w.x + DIRS[w.dir].x); w.y += DIRS[w.dir].y; w.t = 1 - w.t; w.dir = d;
    }
  }
  GR.Logic = { MAZE: MAZE, W: W, H: H, DIRS: DIRS, newRun: newRun, advance: advance, steer: steer,
    passable: passable, pos: pos, loadLevel: loadLevel, levelParams: levelParams, gateAxis: gateAxis, rng: rng };
})(window);
