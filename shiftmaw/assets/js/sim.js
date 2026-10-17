/* Shiftmaw simulation: pure game rules, no DOM. Fixed-step, deterministic given a seed.
   Events are pushed to s.events ({t:'mote',...}); the shell drains them for audio/VFX. */
(function (global) {
  'use strict';
  var SM = global.SM = global.SM || {};
  var L = SM.Levels || (typeof require !== 'undefined' ? require('./levels.js') : null);
  var DIRS = L.DIRS, solid = L.solid, wrapX = L.wrapX;
  var UP = 0, LEFT = 1, DOWN = 2, RIGHT = 3;
  function opp(d) { return (d + 2) & 3; }

  var GHOSTS = [
    { id: 'brume', name: 'Brume', color: '#ff5a7a', scatter: 'tr', release: 0 },
    { id: 'wick', name: 'Wick', color: '#ffb25a', scatter: 'tl', release: 3.5 },
    { id: 'murk', name: 'Murk', color: '#6fe0ff', scatter: 'br', release: 8 },
    { id: 'dawdle', name: 'Dawdle', color: '#c58bff', scatter: 'bl', release: 13 }
  ];
  var FRUITS = [
    { name: 'Glowberry', pts: 100, c: '#ff4d6d' }, { name: 'Peachbell', pts: 300, c: '#ffb08a' },
    { name: 'Moonplum', pts: 500, c: '#a678ff' }, { name: 'Sunpear', pts: 700, c: '#d7ff6a' },
    { name: 'Starfig', pts: 1000, c: '#7ad7ff' }, { name: 'Emberleaf', pts: 2000, c: '#ff8a3d' },
    { name: 'Dewcrown', pts: 3000, c: '#6dffc4' }, { name: 'Heartbloom', pts: 5000, c: '#ff7ad9' }
  ];
  var MAX_CHARGE = 3, MOTES_PER_CHARGE = 50, FLIP_COOLDOWN = 0.45;

  function rng(s) { // mulberry32
    s.seed = (s.seed + 0x6D2B79F5) | 0;
    var t = Math.imul(s.seed ^ (s.seed >>> 15), 1 | s.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function levelParams(level) {
    var l = Math.min(level, 20) - 1;
    return {
      playerSpeed: 7.4 + Math.min(l, 8) * 0.12,
      ghostSpeed: 6.5 + Math.min(l, 12) * 0.22,
      frightSpeed: 4.2,
      tunnelSpeed: 3.8,
      eatenSpeed: 13,
      frightTime: Math.max(2.2, 7 - l * 0.75),
      releaseScale: Math.max(0.35, 1 - l * 0.12),
      modes: l === 0 ? [7, 20, 7, 20, 5, 20, 5, Infinity] : [Math.max(3, 6 - l * 0.4), 24, Math.max(3, 6 - l * 0.4), 26, 4, 30, 3, Infinity]
    };
  }

  function emit(s, t, o) { o = o || {}; o.t = t; s.events.push(o); }

  function newEntity(x, y) { return { tx: x, ty: y, dir: -1, want: -1, prog: 0 }; }
  function px(e) { var d = e.dir >= 0 ? DIRS[e.dir] : { x: 0, y: 0 }; return e.tx + d.x * e.prog; }
  function py(e) { var d = e.dir >= 0 ? DIRS[e.dir] : { x: 0, y: 0 }; return e.ty + d.y * e.prog; }
  function occupied(e) { // the tile an entity "is in" for pinching: nearest one
    if (e.dir < 0 || e.prog < 0.5) return { x: e.tx, y: e.ty };
    return { x: wrapX(s_m, e.tx + DIRS[e.dir].x), y: e.ty + DIRS[e.dir].y };
  }
  var s_m = null;

  function resetActors(s) {
    var m = s.m, i;
    s.p = newEntity(m.start.x, m.start.y);
    s.p.dir = -1; s.p.want = -1; s.p.face = LEFT; s.p.mouth = 0; // waits for the first input
    s.ghosts = [];
    var nx = m.door.x, ny = m.door.y + 1;
    var spots = [{ x: m.door.x, y: m.door.y - 1, st: 'active' }, { x: nx - 1, y: ny }, { x: nx, y: ny }, { x: nx + 1, y: ny }];
    for (i = 0; i < 4; i++) {
      var sp = spots[i], e = newEntity(sp.x, sp.y);
      e.id = GHOSTS[i].id; e.idx = i; e.state = sp.st || 'nest';
      e.dir = i === 0 ? LEFT : -1; e.fright = false; e.releaseAt = GHOSTS[i].release * s.par.releaseScale;
      s.ghosts.push(e);
    }
    s.mode = 'scatter'; s.modeIdx = 0; s.modeT = 0; s.frightT = 0; s.eatChain = 0;
    s.phase = 0; s.phaseAnim = 1; s.flipCd = 0; s.pinchChain = 0;
    s.fruit = null; s.actorClock = 0;
  }

  function startLevel(s, level) {
    s.level = level; s.par = levelParams(level); s.m = L.get(level - 1); s_m = s.m;
    s.motesLeft = s.m.motes + s.m.blooms; s.eaten = 0; s.pickups = {};
    s.fruitSpawned = 0; s.fruitDef = FRUITS[Math.min(level - 1, FRUITS.length - 1)];
    s.charge = 1; s.levelStats = { pinches: 0 };
    resetActors(s);
    s.state = 'ready'; s.stateT = 0;
    emit(s, 'ready', { level: level });
  }

  function create(opts) {
    opts = opts || {};
    var s = { seed: opts.seed == null ? 12345 : opts.seed, events: [], score: 0, lives: 3, time: 0, nextLife: 10000,
      stats: { pinches: 0, bestChain: 0, ghostsEaten: 0, flips: 0, fruit: 0 }, grid: null };
    startLevel(s, opts.level || 1);
    return s;
  }

  function isSolidFor(s, x, y, phase, kind) { return solid(s.m, x, y, phase, kind); }

  function addScore(s, n, x, y, kind) {
    s.score += n;
    if (s.score >= s.nextLife) { s.nextLife += 20000; s.lives++; emit(s, 'life', {}); }
    if (x != null) emit(s, 'pop', { n: n, x: x, y: y, kind: kind || 'score' });
  }

  function eatAt(s, x, y) {
    var m = s.m, c = m.grid[y][x];
    if (c === '.' || c === 'o') {
      m.grid[y][x] = ' '; s.motesLeft--; s.eaten++;
      if (c === '.') {
        addScore(s, 10); emit(s, 'mote', { x: x, y: y, n: s.eaten });
        if (s.eaten % MOTES_PER_CHARGE === 0 && s.charge < MAX_CHARGE) { s.charge++; emit(s, 'charge', { x: x, y: y }); }
      } else {
        addScore(s, 50, x, y, 'bloom');
        if (s.charge < MAX_CHARGE) s.charge++;
        s.frightT = s.par.frightTime; s.eatChain = 0;
        for (var i = 0; i < s.ghosts.length; i++) {
          var g = s.ghosts[i];
          if (g.state === 'active') { g.fright = true; if (g.prog > 0) reverse(g); else g.dir = g.dir >= 0 ? opp(g.dir) : g.dir; }
        }
        emit(s, 'bloom', { x: x, y: y });
      }
      if (s.fruitSpawned < 2 && s.eaten >= (s.fruitSpawned === 0 ? 40 : 100) && !s.fruit) {
        s.fruit = { x: m.fruit.x, y: m.fruit.y, t: 9.5 }; s.fruitSpawned++; emit(s, 'fruitspawn', {});
      }
      if (s.motesLeft <= 0) { s.state = 'clear'; s.stateT = 0; emit(s, 'clear', {}); }
    }
    if (s.fruit && s.fruit.x === x && s.fruit.y === y) {
      addScore(s, s.fruitDef.pts, x, y, 'fruit'); s.stats.fruit++; emit(s, 'fruit', { x: x, y: y, def: s.fruitDef }); s.fruit = null;
    }
  }

  function reverse(e) { // swap direction mid-edge without teleporting
    var d = DIRS[e.dir];
    e.tx = wrapX(s_m, e.tx + d.x); e.ty += d.y; e.prog = 1 - e.prog; e.dir = opp(e.dir);
  }

  /* generic mover: chooser(e) is asked for a direction at each tile centre */
  function move(s, e, dist, kind, chooser, onArrive) {
    var guard = 0;
    while (dist > 1e-9 && guard++ < 8) {
      if (e.dir < 0 || e.prog === 0) {
        var nd = chooser(e);
        if (nd < 0) { e.dir = -1; e.prog = 0; return; }
        e.dir = nd;
      }
      var left = 1 - e.prog, step = dist < left ? dist : left;
      e.prog += step; dist -= step;
      if (e.prog >= 1 - 1e-9) {
        var d = DIRS[e.dir];
        e.tx = wrapX(s.m, e.tx + d.x); e.ty += d.y; e.prog = 0;
        if (onArrive) onArrive(e);
      }
    }
  }

  function free(s, e, d, kind) {
    var nx = wrapX(s.m, e.tx + DIRS[d].x), ny = e.ty + DIRS[d].y;
    return !isSolidFor(s, nx, ny, s.phase, kind);
  }

  function stepPlayer(s, dt) {
    var p = s.p;
    if (p.dir >= 0 && p.want >= 0 && p.want === opp(p.dir) && p.prog > 0) reverse(p);
    var chooser = function (e) {
      if (e.want >= 0 && free(s, e, e.want, 'p')) { e.face = e.want; return e.want; }
      if (e.dir >= 0 && free(s, e, e.dir, 'p')) return e.dir;
      return -1;
    };
    var before = p.dir >= 0 && p.prog > 0 || p.dir >= 0;
    move(s, p, s.par.playerSpeed * dt, 'p', chooser, function (e) { eatAt(s, e.tx, e.ty); });
    if (p.dir >= 0) { p.face = p.dir; p.mouth += dt * 14; }
  }

  function targetFor(s, g) {
    var m = s.m, p = s.p, pd = p.dir >= 0 ? p.dir : p.face, v = DIRS[pd] || { x: 0, y: 0 };
    var corners = { tl: { x: 1, y: 1 }, tr: { x: m.w - 2, y: 1 }, bl: { x: 1, y: m.h - 2 }, br: { x: m.w - 2, y: m.h - 2 } };
    if (g.state === 'eaten') return { x: m.door.x, y: m.door.y };
    if (g.state === 'leaving') return { x: m.door.x, y: m.door.y - 1 };
    if (s.mode === 'scatter') return corners[GHOSTS[g.idx].scatter];
    switch (g.idx) {
      case 0: return { x: p.tx, y: p.ty };
      case 1: return { x: p.tx + v.x * 4, y: p.ty + v.y * 4 };
      case 2: var b = s.ghosts[0], ax = p.tx + v.x * 2, ay = p.ty + v.y * 2; return { x: ax + (ax - b.tx), y: ay + (ay - b.ty) };
      default:
        var dx = g.tx - p.tx, dy = g.ty - p.ty;
        return dx * dx + dy * dy > 49 ? { x: p.tx, y: p.ty } : corners.bl;
    }
  }

  function clampT(m, t) { return { x: Math.max(0, Math.min(m.w - 1, t.x)), y: Math.max(0, Math.min(m.h - 1, t.y)) }; }

  function ghostChooser(s, g) {
    var kind = (g.state === 'active') ? 'g' : 'n';
    var opts = [], i, back = g.dir >= 0 ? opp(g.dir) : -1;
    for (i = 0; i < 4; i++) if (i !== back && free(s, g, i, kind)) opts.push(i);
    if (!opts.length) { if (back >= 0 && free(s, g, back, kind)) return back; return -1; }
    if (opts.length === 1) return opts[0];
    if (g.fright && g.state === 'active') return opts[Math.floor(rng(s) * opts.length)];
    var t = clampT(s.m, targetFor(s, g)), field = L.distField(s.m, t.x, t.y, s.phase, kind), best = -1, bd = 1e9;
    for (i = 0; i < opts.length; i++) { // tie-break order up,left,down,right
      var nx = wrapX(s.m, g.tx + DIRS[opts[i]].x), ny = g.ty + DIRS[opts[i]].y, dd = field[ny * s.m.w + nx];
      if (dd < 0) dd = 900;
      if (dd < bd) { bd = dd; best = opts[i]; }
    }
    return best;
  }

  function stepGhost(s, g, dt) {
    var par = s.par, m = s.m;
    if (g.state === 'nest') { // bob in place until released
      g.bob = (g.bob || 0) + dt;
      if (s.actorClock >= g.releaseAt) { g.state = 'leaving'; g.dir = -1; g.prog = 0; }
      return;
    }
    if (g.state === 'leaving' && g.tx === m.door.x && g.ty === m.door.y - 1) { g.state = 'active'; g.dir = LEFT; g.prog = 0; }
    var speed = par.ghostSpeed;
    if (g.state === 'eaten') speed = par.eatenSpeed;
    else if (g.state === 'leaving') speed = 4.5;
    else if (g.fright) speed = par.frightSpeed;
    else if (L.isTunnelRow(m, g.ty) && (g.tx < 4 || g.tx > m.w - 5)) speed = par.tunnelSpeed;
    move(s, g, speed * dt, 'g', function (e) { return ghostChooser(s, e); }, function (e) {
      if (e.state === 'eaten' && e.tx === m.door.x && e.ty === m.door.y) {
        e.state = 'nest'; e.fright = false; e.releaseAt = s.actorClock + 1.2; e.ty = m.door.y + 1; e.tx = m.door.x; e.dir = -1; e.prog = 0;
        emit(s, 'respawn', {});
      } else if (e.state === 'leaving' && e.tx === m.door.x && e.ty === m.door.y - 1) {
        e.state = 'active';
      }
    });
  }

  /* player's flip: returns true if the phase changed */
  function flip(s) {
    if (s.state !== 'play') return false;
    if (s.charge < 1 || s.flipCd > 0) { emit(s, 'flipdeny', { why: s.charge < 1 ? 'charge' : 'cooldown' }); return false; }
    var np = s.phase ^ 1, o = occupied(s.p);
    var p = s.p, tiles = [{ x: p.tx, y: p.ty }];
    if (p.dir >= 0 && p.prog > 0) tiles.push({ x: wrapX(s.m, p.tx + DIRS[p.dir].x), y: p.ty + DIRS[p.dir].y });
    for (var i = 0; i < tiles.length; i++) if (isSolidFor(s, tiles[i].x, tiles[i].y, np, 'p')) { emit(s, 'flipdeny', { why: 'blocked' }); return false; }
    s.charge--; s.phase = np; s.phaseAnim = 0; s.flipCd = FLIP_COOLDOWN; s.stats.flips++; s.pinchChain = 0;
    emit(s, 'flip', { phase: np });
    for (var gi = 0; gi < s.ghosts.length; gi++) {
      var g = s.ghosts[gi];
      if (g.state === 'nest' || g.state === 'eaten') continue;
      var oc = occupied(g);
      if (isSolidFor(s, oc.x, oc.y, np, 'n')) { // pinched inside a wall
        var pts = 400 * Math.pow(2, Math.min(s.pinchChain, 3));
        s.pinchChain++; s.stats.pinches++; s.levelStats.pinches++; s.stats.ghostsEaten++;
        if (s.pinchChain > s.stats.bestChain) s.stats.bestChain = s.pinchChain;
        addScore(s, pts, oc.x, oc.y, 'pinch'); emit(s, 'pinch', { x: oc.x, y: oc.y, n: s.pinchChain, id: g.id, color: GHOSTS[gi].color });
        g.state = 'eaten'; g.fright = false;
      } else if (g.dir >= 0 && g.prog > 0) { // about to enter a wall: turn back
        var nx = wrapX(s.m, g.tx + DIRS[g.dir].x), ny = g.ty + DIRS[g.dir].y;
        if (isSolidFor(s, nx, ny, np, g.state === 'active' ? 'g' : 'n')) reverse(g);
      }
    }
    return true;
  }

  function setWant(s, d) { s.p.want = d; }

  function collide(s) {
    var p = s.p, x = px(p), y = py(p);
    for (var i = 0; i < s.ghosts.length; i++) {
      var g = s.ghosts[i];
      if (g.state !== 'active' && g.state !== 'leaving') continue;
      var gx = px(g), gy = py(g), dx = gx - x, dy = gy - y;
      if (Math.abs(dx) > s.m.w / 2) dx = s.m.w - Math.abs(dx);
      if (dx * dx + dy * dy < 0.36) {
        if (g.fright) {
          var pts = 200 * Math.pow(2, Math.min(s.eatChain, 3)); s.eatChain++;
          s.stats.ghostsEaten++; g.state = 'eaten'; g.fright = false;
          addScore(s, pts, g.tx, g.ty, 'ghost'); emit(s, 'eatghost', { x: gx, y: gy, color: GHOSTS[i].color, n: s.eatChain });
        } else if (s.state === 'play') {
          s.state = 'dying'; s.stateT = 0; emit(s, 'die', { x: x, y: y }); return;
        }
      }
    }
  }

  function update(s, dt) {
    s.time += dt; s.stateT += dt;
    if (s.phaseAnim < 1) s.phaseAnim = Math.min(1, s.phaseAnim + dt / 0.28);
    if (s.state === 'ready') { if (s.stateT >= 2.0) { s.state = 'play'; s.stateT = 0; emit(s, 'go', {}); } return; }
    if (s.state === 'dying') {
      if (s.stateT >= 1.8) {
        s.lives--;
        if (s.lives <= 0) { s.state = 'over'; s.stateT = 0; emit(s, 'over', { score: s.score }); }
        else { resetActors(s); s.state = 'ready'; s.stateT = 0; emit(s, 'ready', { level: s.level }); }
      }
      return;
    }
    if (s.state === 'clear') {
      if (!s.clearPaid) { s.clearPaid = true; var b = s.charge * 500; if (b) addScore(s, b, s.m.start.x, s.m.start.y, 'bonus'); s.charge = 0; }
      if (s.stateT >= 2.6) { s.clearPaid = false; startLevel(s, s.level + 1); }
      return;
    }
    if (s.state !== 'play') return;
    s.actorClock += dt;
    if (s.flipCd > 0) s.flipCd = Math.max(0, s.flipCd - dt);
    if (s.frightT > 0) {
      s.frightT -= dt;
      if (s.frightT <= 0) { s.frightT = 0; for (var i = 0; i < s.ghosts.length; i++) s.ghosts[i].fright = false; }
    } else {
      s.modeT += dt; var lim = s.par.modes[s.modeIdx];
      if (s.modeT >= lim && s.modeIdx < s.par.modes.length - 1) {
        s.modeIdx++; s.modeT = 0; s.mode = s.modeIdx % 2 === 0 ? 'scatter' : 'chase';
        for (var j = 0; j < s.ghosts.length; j++) { var g = s.ghosts[j]; if (g.state === 'active' && g.dir >= 0) { if (g.prog > 0) reverse(g); else g.dir = opp(g.dir); } }
      }
    }
    if (s.fruit) { s.fruit.t -= dt; if (s.fruit.t <= 0) s.fruit = null; }
    stepPlayer(s, dt);
    if (s.state !== 'play') return;
    for (var k = 0; k < s.ghosts.length; k++) stepGhost(s, s.ghosts[k], dt);
    collide(s);
  }

  var FIXED = 1 / 120;
  function advance(s, dt) { // fixed-step accumulate
    s.acc = (s.acc || 0) + Math.min(dt, 0.1);
    while (s.acc >= FIXED) { update(s, FIXED); s.acc -= FIXED; }
  }

  SM.Sim = { create: create, update: update, advance: advance, flip: flip, setWant: setWant, px: px, py: py, occupied: function (e) { s_m = s_m; return occupied(e); },
    GHOSTS: GHOSTS, FRUITS: FRUITS, MAX_CHARGE: MAX_CHARGE, FIXED: FIXED, UP: UP, LEFT: LEFT, DOWN: DOWN, RIGHT: RIGHT, levelParams: levelParams, startLevel: startLevel };
  if (typeof module !== 'undefined') module.exports = SM.Sim;
})(typeof window !== 'undefined' ? window : globalThis);
