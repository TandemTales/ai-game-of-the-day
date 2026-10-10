/* SHIFTWICK logic: pure simulation, no DOM. Classic script on global SW. */
(function (g) {
  'use strict';
  var SW = g.SW = g.SW || {};
  var W = 21, H = 15;
  SW.W = W; SW.H = H;
  var DIRS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
  SW.DIRS = DIRS;

  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  SW.rng = rng;

  /* ---------- maze generation ---------- */
  SW.generate = function (seed) {
    var r = rng(seed), x, y, wall = [];
    for (y = 0; y < H; y++) { wall.push([]); for (x = 0; x < W; x++) wall[y].push(1); }
    var stack = [[1, 1]]; wall[1][1] = 0;
    while (stack.length) {
      var c = stack[stack.length - 1], opts = [];
      for (var d = 0; d < 4; d++) {
        var nx = c[0] + DIRS[d].x * 2, ny = c[1] + DIRS[d].y * 2;
        if (nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && wall[ny][nx]) opts.push(d);
      }
      if (!opts.length) { stack.pop(); continue; }
      var dd = opts[Math.floor(r() * opts.length)];
      wall[c[1] + DIRS[dd].y][c[0] + DIRS[dd].x] = 0;
      wall[c[1] + DIRS[dd].y * 2][c[0] + DIRS[dd].x * 2] = 0;
      stack.push([c[0] + DIRS[dd].x * 2, c[1] + DIRS[dd].y * 2]);
    }
    // braid: knock walls between lattice cells to make loops (chase games need loops)
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      if (!wall[y][x]) continue;
      var horiz = (y % 2 === 1 && x % 2 === 0), vert = (y % 2 === 0 && x % 2 === 1);
      if ((horiz || vert) && r() < 0.34) wall[y][x] = 0;
    }
    // central den: row 7, cols 8..12 open, with gate row opening
    var cy = (H - 1) >> 1, cx = (W - 1) >> 1;
    for (x = cx - 2; x <= cx + 2; x++) { wall[cy][x] = 0; wall[cy - 1][x] = (x === cx ? 0 : 1); wall[cy + 1][x] = 1; }
    wall[cy - 1][cx] = 0; wall[cy - 2][cx] = 0;
    // guarantee connectivity of everything open to the player start
    var seen = flood(wall, 1, 1);
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) if (!wall[y][x] && !seen[y][x]) wall[y][x] = 1;
    return wall;
  };
  function flood(wall, sx, sy) {
    var seen = [], x, y, q = [[sx, sy]];
    for (y = 0; y < H; y++) { seen.push([]); for (x = 0; x < W; x++) seen[y].push(false); }
    seen[sy][sx] = true;
    while (q.length) {
      var c = q.pop();
      for (var d = 0; d < 4; d++) {
        var nx = c[0] + DIRS[d].x, ny = c[1] + DIRS[d].y;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && !wall[ny][nx] && !seen[ny][nx]) { seen[ny][nx] = true; q.push([nx, ny]); }
      }
    }
    return seen;
  }
  SW.flood = flood;

  /* ---------- state ---------- */
  var SCATTER = [{ x: W - 2, y: 1 }, { x: 1, y: 1 }, { x: W - 2, y: H - 2 }, { x: 1, y: H - 2 }];
  var SHADE_NAMES = ['Hound', 'Lurker', 'Drifter', 'Warden'];

  SW.create = function (opts) {
    opts = opts || {};
    var s = { seed: opts.seed || 12345, level: 0, score: 0, lives: 3, combo: 0, comboT: 0, time: 0, over: false, events: [], eatChain: 0 };
    SW.loadLevel(s, 0);
    return s;
  };

  SW.loadLevel = function (s, level) {
    s.level = level;
    s.wall = SW.generate(s.seed + level * 7919);
    s.pel = []; s.total = 0;
    var seen = flood(s.wall, 1, 1), x, y, cx = (W - 1) >> 1, cy = (H - 1) >> 1;
    for (y = 0; y < H; y++) { s.pel.push([]); for (x = 0; x < W; x++) {
      var p = (!s.wall[y][x] && seen[y][x] && !(y === cy && Math.abs(x - cx) <= 2) && !(x === cx && y >= cy - 2 && y <= cy)) ? 1 : 0;
      s.pel[y].push(p); if (p) s.total++;
    } }
    s.pel[1][1] = 0; s.total--;
    // power pellets in the open tiles nearest each corner
    var corners = [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]];
    corners.forEach(function (c) {
      var best = null, bd = 1e9;
      for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) if (s.pel[y][x] === 1) {
        var d = Math.abs(x - c[0]) + Math.abs(y - c[1]); if (d < bd) { bd = d; best = [x, y]; }
      }
      if (best) s.pel[best[1]][best[0]] = 2;
    });
    s.remaining = s.total;
    s.charges = 2; s.chargeT = 0; s.maxCharges = 3;
    s.mode = 'scatter'; s.modeT = 0; s.frightT = 0; s.anim = null;
    resetActors(s);
  };

  function mkActor(x, y) { return { tx: x, ty: y, dx: 0, dy: 0, t: 0 }; }
  function resetActors(s) {
    var cx = (W - 1) >> 1, cy = (H - 1) >> 1;
    s.p = mkActor(1, 1); s.p.want = null; s.p.dead = 0;
    s.shades = [];
    for (var i = 0; i < 4; i++) {
      var a = mkActor(cx - 1 + (i % 3), cy); a.id = i; a.name = SHADE_NAMES[i]; a.state = 'den'; a.release = 1.2 + i * 2.4 - Math.min(i, s.level) * 0.8; a.dazed = 0;
      if (i === 0) { a.tx = cx; a.ty = cy - 2; a.state = 'roam'; a.release = 0; a.dy = 1 * 0; }
      s.shades.push(a);
    }
  }
  SW.respawnActors = resetActors;

  function open(s, x, y) { return x >= 0 && y >= 0 && x < W && y < H && !s.wall[y][x]; }
  SW.open = open;
  SW.pSpeed = function (s) { return 5.4 + Math.min(s.level, 6) * 0.2; };
  SW.sSpeed = function (s, a) {
    if (a.state === 'eyes') return 11;
    if (a.dazed > 0) return 2.8;
    return 4.5 + Math.min(s.level, 8) * 0.28 + (a.id === 0 ? 0.25 : 0);
  };

  /* ---------- movement ---------- */
  function choose(s, a, target, random) {
    var best = -1, bd = 1e9, opts = [], rev = -1;
    for (var d = 0; d < 4; d++) if (a.dx === -DIRS[d].x && a.dy === -DIRS[d].y && (a.dx || a.dy)) rev = d;
    for (d = 0; d < 4; d++) {
      var nx = a.tx + DIRS[d].x, ny = a.ty + DIRS[d].y;
      if (!open(s, nx, ny) || d === rev) continue;
      if (a.state !== 'eyes' && a.state !== 'leave' && inDen(nx, ny)) continue;
      opts.push(d);
    }
    if (!opts.length && rev >= 0 && open(s, a.tx + DIRS[rev].x, a.ty + DIRS[rev].y)) opts.push(rev);
    if (!opts.length) { a.dx = a.dy = 0; return; }
    if (random) best = opts[Math.floor(s.rand() * opts.length)];
    else for (var i = 0; i < opts.length; i++) {
      var dx = a.tx + DIRS[opts[i]].x - target.x, dy = a.ty + DIRS[opts[i]].y - target.y, dist = dx * dx + dy * dy;
      if (dist < bd) { bd = dist; best = opts[i]; }
    }
    a.dx = DIRS[best].x; a.dy = DIRS[best].y;
  }
  function inDen(x, y) { var cx = (W - 1) >> 1, cy = (H - 1) >> 1; return y === cy && Math.abs(x - cx) <= 2; }

  function shadeTarget(s, a) {
    var p = s.p;
    if (a.state === 'eyes') return { x: (W - 1) >> 1, y: ((H - 1) >> 1) };
    if (a.state === 'leave') return { x: (W - 1) >> 1, y: ((H - 1) >> 1) - 2 };
    if (s.mode === 'scatter' && a.dazed <= 0) return SCATTER[a.id];
    switch (a.id) {
      case 0: return { x: p.tx, y: p.ty };
      case 1: return { x: p.tx + p.dx * 4, y: p.ty + p.dy * 4 };
      case 2: { var h = s.shades[0]; return { x: p.tx * 2 - h.tx, y: p.ty * 2 - h.ty }; }
      default: { var dd = Math.abs(a.tx - p.tx) + Math.abs(a.ty - p.ty); return dd > 8 ? { x: p.tx, y: p.ty } : SCATTER[3]; }
    }
  }

  function stepActor(s, a, speed, dt, onArrive) {
    var moves = 0;
    if (!a.dx && !a.dy) { onArrive(a); if (!a.dx && !a.dy) return; }
    a.t += speed * dt;
    while (a.t >= 1 && moves++ < 4) {
      a.tx += a.dx; a.ty += a.dy; a.t -= 1;
      onArrive(a);
      if (!a.dx && !a.dy) { a.t = 0; break; }
    }
  }

  function playerArrive(s, a) {
    var p = a;
    // eat
    var v = s.pel[p.ty][p.tx];
    if (v) {
      s.pel[p.ty][p.tx] = 0; s.remaining--;
      s.comboT = 1.0; s.combo++;
      var mult = Math.min(5, 1 + Math.floor(s.combo / 12));
      s.score += (v === 2 ? 50 : 10) * mult;
      s.events.push({ type: v === 2 ? 'power' : 'ember', x: p.tx, y: p.ty, mult: mult });
      if (v === 2) { s.frightT = Math.max(5, 8 - s.level * 0.5); s.eatChain = 0; s.shades.forEach(function (sh) { if (sh.state === 'roam' || sh.state === 'leave') { sh.dazed = s.frightT; sh.dx = -sh.dx; sh.dy = -sh.dy; } }); s.charges = Math.min(s.maxCharges, s.charges + 1); }
      if (s.remaining <= 0) { s.cleared = true; }
    }
    var tryD = p.want;
    if (tryD && open(s, p.tx + tryD.x, p.ty + tryD.y)) { p.dx = tryD.x; p.dy = tryD.y; }
    else if (!open(s, p.tx + p.dx, p.ty + p.dy)) { p.dx = p.dy = 0; }
  }
  function shadeArrive(s, a) {
    if (a.state === 'eyes' && a.tx === ((W - 1) >> 1) && a.ty === ((H - 1) >> 1) - 2) { a.state = 'leave'; a.dazed = 0; }
    if (a.state === 'leave' && a.ty <= ((H - 1) >> 1) - 2) { a.state = 'roam'; }
    choose(s, a, shadeTarget(s, a), a.dazed > 0 && a.state === 'roam');
  }

  /* ---------- the Shift ---------- */
  // axis 'row' shifts interior of row y by dir (+1 right / -1 left); 'col' shifts interior of col x (+1 down / -1 up)
  SW.shiftLine = function (s, axis, idx, dir) {
    var n, i, tmp, w;
    if (axis === 'row') {
      if (idx < 1 || idx > H - 2) return false;
      n = W - 2;
      w = rot(s.wall[idx].slice(1, W - 1), dir); for (i = 0; i < n; i++) s.wall[idx][i + 1] = w[i];
      w = rot(s.pel[idx].slice(1, W - 1), dir); for (i = 0; i < n; i++) s.pel[idx][i + 1] = w[i];
    } else {
      if (idx < 1 || idx > W - 2) return false;
      n = H - 2;
      var cw = [], cp = [];
      for (i = 1; i < H - 1; i++) { cw.push(s.wall[i][idx]); cp.push(s.pel[i][idx]); }
      cw = rot(cw, dir); cp = rot(cp, dir);
      for (i = 0; i < n; i++) { s.wall[i + 1][idx] = cw[i]; s.pel[i + 1][idx] = cp[i]; }
    }
    return true;
  };
  function rot(a, dir) { var n = a.length, o = new Array(n); for (var i = 0; i < n; i++) o[(i + dir + n) % n] = a[i]; return o; }

  function snap(a) { if (a.t >= 0.5) { a.tx += a.dx; a.ty += a.dy; } a.t = 0; }

  SW.tryShift = function (s, dirIdx) {
    if (s.over || s.p.dead > 0 || s.charges < 1 || s.anim) return false;
    var d = DIRS[dirIdx], axis = d.x ? 'row' : 'col', dir = d.x ? d.x : d.y;
    snap(s.p); s.shades.forEach(snap);
    var idx = axis === 'row' ? s.p.ty : s.p.tx;
    if (idx < 1 || idx > (axis === 'row' ? H - 2 : W - 2)) return false;
    // Entities in the line ride with their tile.
    var riders = [s.p].concat(s.shades).filter(function (a) { return axis === 'row' ? a.ty === idx : a.tx === idx; });
    var n = axis === 'row' ? W - 2 : H - 2;
    SW.shiftLine(s, axis, idx, dir);
    var stunned = 0;
    riders.forEach(function (a) {
      if (axis === 'row') a.tx = 1 + ((a.tx - 1 + dir + n) % n); else a.ty = 1 + ((a.ty - 1 + dir + n) % n);
      if (a !== s.p && a.state !== 'eyes' && a.state !== 'den') { a.dazed = Math.max(a.dazed, 3.2); stunned++; }
    });
    // any actor now facing a wall must pick a fresh heading
    [s.p].concat(s.shades).forEach(function (a) { if (!open(s, a.tx + a.dx, a.ty + a.dy)) { if (a === s.p) a.dx = a.dy = 0; else { a.dx = a.dy = 0; choose(s, a, shadeTarget(s, a), true); } } });
    s.charges--;
    s.anim = { axis: axis, idx: idx, dir: dir, t: 0, dur: 0.2 };
    s.score += stunned * 100;
    s.events.push({ type: 'shift', axis: axis, idx: idx, dir: dir, stunned: stunned });
    return true;
  };

  /* ---------- tick ---------- */
  SW.step = function (s, dt) {
    if (s.over) return;
    if (!s.rand) s.rand = rng(s.seed ^ 0x9e3779b9);
    s.time += dt;
    if (s.anim) { s.anim.t += dt / s.anim.dur; if (s.anim.t >= 1) s.anim = null; }
    if (s.p.dead > 0) { s.p.dead -= dt; if (s.p.dead <= 0) { s.lives--; if (s.lives <= 0) { s.over = true; s.events.push({ type: 'over' }); } else { resetActors(s); s.frightT = 0; s.events.push({ type: 'respawn' }); } } return; }
    if (s.comboT > 0) { s.comboT -= dt; if (s.comboT <= 0) s.combo = 0; }
    s.chargeT += dt; if (s.chargeT >= 9) { s.chargeT = 0; if (s.charges < s.maxCharges) { s.charges++; s.events.push({ type: 'charge' }); } }
    s.modeT += dt;
    var cyc = s.mode === 'scatter' ? 6 : 18;
    if (s.modeT > cyc) { s.mode = s.mode === 'scatter' ? 'chase' : 'scatter'; s.modeT = 0; }
    if (s.frightT > 0) s.frightT = Math.max(0, s.frightT - dt);
    // player
    var p = s.p;
    if (p.want && !p.dx && !p.dy && open(s, p.tx + p.want.x, p.ty + p.want.y)) { p.dx = p.want.x; p.dy = p.want.y; }
    // allow instant reversal
    if (p.want && (p.dx || p.dy) && p.want.x === -p.dx && p.want.y === -p.dy && p.t > 0) { p.tx += p.dx; p.ty += p.dy; p.dx = -p.dx; p.dy = -p.dy; p.t = 1 - p.t; if (p.t >= 1) p.t = 0.999; }
    stepActor(s, p, SW.pSpeed(s), dt, function (a) { playerArrive(s, a); });
    // shades
    for (var i = 0; i < s.shades.length; i++) {
      var a = s.shades[i];
      if (a.state === 'den') { a.release -= dt; if (a.release <= 0) { a.state = 'leave'; a.tx = (W - 1) >> 1; a.ty = (H - 1) >> 1; a.dx = a.dy = 0; } continue; }
      if (a.dazed > 0 && a.state === 'roam') { a.dazed = Math.max(0, a.dazed - dt); }
      if (a.state === 'leave' && a.dazed > 0) a.dazed = Math.max(0, a.dazed - dt);
      stepActor(s, a, SW.sSpeed(s, a), dt, function (x) { shadeArrive(s, x); });
    }
    // collisions
    for (i = 0; i < s.shades.length; i++) {
      a = s.shades[i];
      if (a.state === 'den' || a.state === 'eyes') continue;
      var ax = a.tx + a.dx * a.t, ay = a.ty + a.dy * a.t, px = p.tx + p.dx * p.t, py = p.ty + p.dy * p.t;
      if (Math.abs(ax - px) + Math.abs(ay - py) < 0.62) {
        if (a.dazed > 0) {
          s.eatChain++; var pts = 200 * Math.pow(2, Math.min(3, s.eatChain - 1));
          s.score += pts; a.state = 'eyes'; a.dazed = 0; s.events.push({ type: 'snuff', x: ax, y: ay, pts: pts });
        } else {
          p.dead = 1.4; s.combo = 0; s.events.push({ type: 'die', x: px, y: py }); return;
        }
      }
    }
    if (s.cleared) {
      s.cleared = false;
      s.score += 500 + s.level * 100;
      s.events.push({ type: 'clear', level: s.level });
      SW.loadLevel(s, s.level + 1);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
