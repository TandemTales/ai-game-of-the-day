(function (root) {
  'use strict';
  var BW = root.BW = root.BW || {};
  var W = 15, H = 13, FUSE = 2.4, FLAME = 0.45, PRESSURE_MAX = 100;
  BW.W = W; BW.H = H;
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  BW.rng = rng;
  // tiles: 0 floor, 1 wall, 2 crate
  function makeLevel(seed, stage) {
    var r = rng(seed), t = [], x, y;
    var density = Math.min(0.78, 0.55 + stage * 0.04);
    for (y = 0; y < H; y++) { t[y] = []; for (x = 0; x < W; x++) {
      var wall = x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0);
      t[y][x] = wall ? 1 : (r() < density ? 2 : 0);
    } }
    var spawns = [[1, 1], [W - 2, H - 2], [W - 2, 1], [1, H - 2]];
    spawns.forEach(function (s) { [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]].forEach(function (d) {
      var X = s[0] + d[0], Y = s[1] + d[1]; if (t[Y] && t[Y][X] === 2) t[Y][X] = 0; }); });
    return { tiles: t, spawns: spawns };
  }
  BW.makeLevel = makeLevel;

  function newGame(seed, stage) {
    stage = stage || 1;
    var lv = makeLevel(seed, stage), g = {
      seed: seed, stage: stage, rand: rng(seed ^ 0x9e3779b9), tiles: lv.tiles, time: 0, timeLimit: 150,
      bombs: [], flames: [], items: {}, actors: [], pressure: 0, quake: 0, score: 0, over: false, won: false,
      events: [], combo: 0, comboT: 0
    };
    lv.spawns.forEach(function (s, i) {
      g.actors.push({ id: i, human: i === 0, x: s[0], y: s[1], px: s[0], py: s[1], alive: true, maxBombs: 1, power: 2,
        speed: 5.2, fuseSkill: 0, placed: 0, moving: null, ai: { think: 0, goal: null }, kills: 0, shield: 0 });
    });
    return g;
  }
  BW.newGame = newGame;

  function bombAt(g, x, y) { for (var i = 0; i < g.bombs.length; i++) if (g.bombs[i].x === x && g.bombs[i].y === y) return g.bombs[i]; return null; }
  function flameAt(g, x, y) { for (var i = 0; i < g.flames.length; i++) if (g.flames[i].x === x && g.flames[i].y === y) return true; return false; }
  BW.bombAt = bombAt; BW.flameAt = flameAt;
  function blocked(g, x, y, actor) {
    if (x < 0 || y < 0 || x >= W || y >= H) return true;
    if (g.tiles[y][x]) return true;
    var b = bombAt(g, x, y); if (b && !(actor && b.walkOff === actor.id)) return true;
    return false;
  }
  BW.blocked = blocked;

  function placeBomb(g, a) {
    if (!a.alive || a.placed >= a.maxBombs || bombAt(g, a.x, a.y)) return false;
    g.bombs.push({ x: a.x, y: a.y, t: FUSE, owner: a.id, power: a.power, walkOff: a.id });
    a.placed++; g.pressure = Math.min(PRESSURE_MAX, g.pressure + 14);
    g.events.push({ type: 'place', x: a.x, y: a.y, owner: a.id });
    return true;
  }
  BW.placeBomb = placeBomb;

  function addFlame(g, x, y, owner) { g.flames.push({ x: x, y: y, t: FLAME, owner: owner }); }
  function detonate(g, b, chain) {
    var i = g.bombs.indexOf(b); if (i < 0) return; g.bombs.splice(i, 1);
    var o = g.actors[b.owner]; if (o) o.placed = Math.max(0, o.placed - 1);
    g.events.push({ type: 'boom', x: b.x, y: b.y, chain: chain });
    addFlame(g, b.x, b.y, b.owner);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      for (var k = 1; k <= b.power; k++) {
        var x = b.x + d[0] * k, y = b.y + d[1] * k;
        if (g.tiles[y][x] === 1) break;
        addFlame(g, x, y, b.owner);
        if (g.tiles[y][x] === 2) { g.tiles[y][x] = 0; crateBroken(g, x, y, b.owner); break; }
        var other = bombAt(g, x, y); if (other) { other.t = 0; break; }
        if (g.items[x + ',' + y]) { delete g.items[x + ',' + y]; break; }
      }
    });
    if (chain) { g.combo++; g.comboT = 1.5; }
  }
  function crateBroken(g, x, y, owner) {
    if (owner === 0) g.score += 10 * (1 + Math.min(g.combo, 8));
    g.events.push({ type: 'crate', x: x, y: y });
    var r = g.rand();
    if (r < 0.32) g.items[x + ',' + y] = r < 0.13 ? 'bomb' : r < 0.24 ? 'fire' : 'speed';
  }
  BW.detonate = detonate;

  function quake(g) {
    g.quake = 1; g.pressure = 0; g.events.push({ type: 'quake' });
    g.bombs.slice().forEach(function (b) { b.t = 0; });
  }

  function kill(g, a, byOwner) {
    if (!a.alive) return;
    if (a.shield > 0) return;
    a.alive = false; g.events.push({ type: 'death', id: a.id, x: a.x, y: a.y });
    if (byOwner !== undefined && byOwner !== a.id) {
      var k = g.actors[byOwner]; k.kills++;
      if (byOwner === 0) g.score += 250 + 50 * Math.min(g.combo, 6);
    }
  }

  function tryMove(g, a, dx, dy) {
    if (a.moving || !a.alive) return false;
    var nx = a.x + dx, ny = a.y + dy;
    if (blocked(g, nx, ny, a)) return false;
    a.moving = { fx: a.x, fy: a.y, tx: nx, ty: ny, p: 0 }; a.x = nx; a.y = ny;
    return true;
  }
  BW.tryMove = tryMove;

  function pickup(g, a) {
    var k = a.x + ',' + a.y, it = g.items[k]; if (!it) return;
    delete g.items[k];
    if (it === 'bomb') a.maxBombs = Math.min(6, a.maxBombs + 1);
    if (it === 'fire') a.power = Math.min(8, a.power + 1);
    if (it === 'speed') a.speed = Math.min(8, a.speed + 0.6);
    if (a.human) g.score += 25;
    g.events.push({ type: 'pickup', id: a.id, item: it });
  }

  // AI: danger map + BFS to safety / targets
  function dangerMap(g, horizon) {
    var d = {}, i;
    function mark(x, y, t) { var k = x + ',' + y; if (d[k] === undefined || t < d[k]) d[k] = t; }
    g.bombs.forEach(function (b) {
      mark(b.x, b.y, b.t);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) {
        for (var k = 1; k <= b.power; k++) { var x = b.x + dd[0] * k, y = b.y + dd[1] * k;
          if (g.tiles[y][x] === 1) break; mark(x, y, b.t); if (g.tiles[y][x] === 2 || bombAt(g, x, y)) break; }
      });
    });
    for (i = 0; i < g.flames.length; i++) mark(g.flames[i].x, g.flames[i].y, 0);
    return d;
  }
  BW.dangerMap = dangerMap;
  function bfs(g, a, goalFn, danger) {
    var q = [[a.x, a.y, null]], seen = {}; seen[a.x + ',' + a.y] = 1;
    while (q.length) {
      var c = q.shift();
      if ((c[0] !== a.x || c[1] !== a.y) && goalFn(c[0], c[1])) return c[2];
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var i = 0; i < 4; i++) {
        var x = c[0] + dirs[i][0], y = c[1] + dirs[i][1], k = x + ',' + y;
        if (seen[k] || blocked(g, x, y, a)) continue;
        if (danger[k] !== undefined && danger[k] < 0.6 && !(c[0] === a.x && c[1] === a.y && danger[a.x + ',' + a.y] !== undefined)) continue;
        seen[k] = 1; q.push([x, y, c[2] || dirs[i]]);
      }
    }
    return null;
  }
  function aiStep(g, a, dt) {
    a.ai.think -= dt; if (a.ai.think > 0 || a.moving) return; a.ai.think = 0.08 + g.rand() * 0.1;
    var danger = dangerMap(g), here = danger[a.x + ',' + a.y];
    if (here !== undefined) {
      var m = bfs(g, a, function (x, y) { return danger[x + ',' + y] === undefined; }, danger);
      if (m) tryMove(g, a, m[0], m[1]); return;
    }
    var foes = g.actors.filter(function (o) { return o.alive && o.id !== a.id; });
    var near = foes.some(function (o) { return Math.abs(o.x - a.x) + Math.abs(o.y - a.y) <= a.power + 1 && (o.x === a.x || o.y === a.y); });
    var crateAdj = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { return g.tiles[a.y + d[1]][a.x + d[0]] === 2; });
    if ((near || crateAdj) && a.placed < a.maxBombs && g.rand() < 0.7) {
      // only bomb if an escape exists
      var snap = placeBomb(g, a);
      if (snap) { var d2 = dangerMap(g), esc = bfs(g, a, function (x, y) { return d2[x + ',' + y] === undefined; }, d2);
        if (!esc) { var b = g.bombs.pop(); a.placed--; g.pressure -= 14; } else { tryMove(g, a, esc[0], esc[1]); return; } }
    }
    var mv = bfs(g, a, function (x, y) {
      if (g.items[x + ',' + y]) return true;
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var t = g.tiles[y + d[1]][x + d[0]]; return t === 2; }) ||
        foes.some(function (o) { return o.x === x && o.y === y; });
    }, danger);
    if (mv) tryMove(g, a, mv[0], mv[1]);
  }

  function step(g, dt, input) {
    if (g.over) return;
    g.time += dt; g.events.length = 0;
    if (g.comboT > 0) { g.comboT -= dt; if (g.comboT <= 0) g.combo = 0; }
    if (g.quake > 0) g.quake = Math.max(0, g.quake - dt * 2);
    var h = g.actors[0];
    if (input && h.alive) {
      if (input.dx || input.dy) tryMove(g, h, input.dx, input.dy);
      if (input.bomb) placeBomb(g, h);
    }
    for (var i = 1; i < g.actors.length; i++) if (g.actors[i].alive) aiStep(g, g.actors[i], dt);
    g.actors.forEach(function (a) {
      if (a.shield > 0) a.shield -= dt;
      if (a.moving) { a.moving.p += dt * a.speed; var p = Math.min(1, a.moving.p);
        a.px = a.moving.fx + (a.moving.tx - a.moving.fx) * p; a.py = a.moving.fy + (a.moving.ty - a.moving.fy) * p;
        if (a.moving.p >= 1) { a.moving = null; a.px = a.x; a.py = a.y; pickup(g, a); } }
      else { a.px = a.x; a.py = a.y; }
      g.bombs.forEach(function (b) { if (b.walkOff === a.id && (a.x !== b.x || a.y !== b.y) && !(a.moving && a.moving.fx === b.x && a.moving.fy === b.y)) b.walkOff = -1; });
    });
    g.bombs.forEach(function (b) { b.t -= dt; });
    if (g.pressure >= PRESSURE_MAX) quake(g);
    var guard = 0;
    while (guard++ < 50) { var due = g.bombs.filter(function (b) { return b.t <= 0; }); if (!due.length) break;
      due.forEach(function (b) { detonate(g, b, due.length > 1 || g.quake > 0.5 || b.t < 0 && false); }); }
    g.flames.forEach(function (f) { f.t -= dt; });
    g.flames = g.flames.filter(function (f) { return f.t > 0; });
    g.actors.forEach(function (a) { if (a.alive) for (var j = 0; j < g.flames.length; j++) if (g.flames[j].x === a.x && g.flames[j].y === a.y) { kill(g, a, g.flames[j].owner); break; } });
    // pressure bleeds slowly when board is quiet
    if (!g.bombs.length) g.pressure = Math.max(0, g.pressure - dt * 10);
    var humanAlive = h.alive, foesAlive = g.actors.slice(1).filter(function (a) { return a.alive; }).length;
    if (!humanAlive) { g.over = true; g.won = false; }
    else if (!foesAlive) { g.over = true; g.won = true; g.score += Math.max(0, Math.round((g.timeLimit - g.time) * 5)) + 500; }
    else if (g.time >= g.timeLimit) { g.over = true; g.won = false; }
  }
  BW.step = step;
  if (typeof module !== 'undefined') module.exports = BW;
})(typeof window !== 'undefined' ? window : globalThis);
