(function (global) {
  'use strict';
  var TL = global.TL = global.TL || {}, W = 33, H = 25;
  var charts = ['The Quiet Reach', 'Copper Shoals', 'The Split Current', 'Blackwater Sound', 'The Last Anchorage'];
  function index(x, y) { return y * W + x; }
  function random(s) { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
  function board(s) {
    s.cells = Array(W * H).fill(0);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++)
      if (!x || !y || x === W - 1 || y === H - 1) s.cells[index(x, y)] = 1;
    s.player = { x: 0, y: 12 }; s.anchor = { x: 0, y: 12 }; s.trail = [];
    s.enemies = [];
    for (var i = 0; i < [1, 2, 2, 3, 3][s.stage]; i++) {
      var angle = random(s) * Math.PI * 2;
      s.enemies.push({ x: 21 + random(s) * 8, y: 6 + random(s) * 12,
        vx: Math.cos(angle) * (2.7 + s.stage * 0.4), vy: Math.sin(angle) * (2.7 + s.stage * 0.4) });
    }
    s.buoys = [{ x: 7, y: 6 }, { x: 9, y: 18 }, { x: 17, y: 10 }, { x: 25, y: 5 }, { x: 26, y: 19 }];
    s.time = 90; s.freeze = 0; s.invulnerable = 0; s.ratio = 0; s.clear = false;
    s.last = 'Leave the shore. Reconnect to claim water.'; s.event = 'ready'; s.serial++;
  }
  function newGame(seed) {
    var s = { seed: (seed === undefined ? 731 : seed) >>> 0, score: 0, lives: 3, stage: 0,
      charges: 1, rescued: 0, over: false, won: false, serial: 0 };
    board(s); return s;
  }
  function hit(s) {
    if (s.over || s.clear || s.invulnerable > 0) return false;
    s.lives--; s.trail = []; s.player = { x: s.anchor.x, y: s.anchor.y };
    s.invulnerable = 0.8; s.last = 'Cable lost. Launch again from the shore.';
    s.event = 'hit'; s.serial++;
    if (s.lives <= 0) { s.over = true; s.last = 'The cable went dark.'; }
    return true;
  }
  function capture(s) {
    var seen = Array(W * H).fill(false), queue = [], head = 0;
    s.trail.forEach(function (p) { s.cells[index(p.x, p.y)] = 1; });
    s.enemies.forEach(function (e) {
      var k = index(Math.round(e.x), Math.round(e.y));
      if (!s.cells[k] && !seen[k]) { seen[k] = true; queue.push(k); }
    });
    while (head < queue.length) {
      var k = queue[head++], x = k % W, y = Math.floor(k / W);
      [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(function (p) {
        if (p[0] < 0 || p[0] >= W || p[1] < 0 || p[1] >= H) return;
        var n = index(p[0], p[1]);
        if (!seen[n] && !s.cells[n]) { seen[n] = true; queue.push(n); }
      });
    }
    var gained = s.trail.length, claimed = 0, rescued = 0;
    for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++) {
      var cell = index(x, y);
      if (!s.cells[cell] && !seen[cell]) { s.cells[cell] = 1; gained++; }
      if (s.cells[cell]) claimed++;
    }
    s.buoys.forEach(function (b) {
      if (!b.saved && s.cells[index(b.x, b.y)]) { b.saved = true; rescued++; }
    });
    s.rescued += rescued; s.charges = Math.min(3, s.charges + rescued);
    s.score += gained * 10 + rescued * 250; s.ratio = claimed / ((W - 2) * (H - 2));
    s.trail = []; s.last = '+' + gained * 10 + ' · ' + rescued + ' buoys rescued';
    s.event = 'capture'; s.serial++;
    if (s.ratio >= 0.6) {
      s.clear = true; s.score += Math.ceil(s.time) * 20 + (s.stage + 1) * 500;
      s.last = 'Safe passage secured.'; s.event = 'clear';
      if (s.stage === charts.length - 1) { s.won = true; s.over = true; }
    }
  }
  function move(s, dx, dy) {
    if (s.over || s.clear || Math.abs(dx) + Math.abs(dy) !== 1) return false;
    var x = s.player.x + dx, y = s.player.y + dy;
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    var n = index(x, y), tail = s.trail[s.trail.length - 2];
    if (s.trail.length && tail && tail.x === x && tail.y === y) {
      s.trail.pop(); s.player = { x: x, y: y }; return true;
    }
    if (!s.cells[n]) {
      if (s.trail.some(function (p) { return p.x === x && p.y === y; })) { hit(s); return false; }
      if (!s.trail.length) s.anchor = { x: s.player.x, y: s.player.y };
      // A cable may never seal a storm inside a claimed cell.
      if (s.enemies.some(function (e) { return Math.round(e.x) === x && Math.round(e.y) === y; })) { hit(s); return false; }
      s.trail.push({ x: x, y: y });
    } else if (s.trail.length) capture(s);
    s.player = { x: x, y: y }; return true;
  }
  function pulse(s) {
    if (s.over || s.clear || s.charges <= 0 || s.freeze > 0) return false;
    s.charges--; s.freeze = 2.5; s.event = 'pulse'; s.serial++;
    s.last = 'Storm held · 2.5 seconds'; return true;
  }
  function tick(s, dt) {
    if (s.over || s.clear || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    s.time = Math.max(0, s.time - dt); s.invulnerable = Math.max(0, s.invulnerable - dt);
    var frozen = s.freeze > 0; s.freeze = Math.max(0, s.freeze - dt);
    if (!s.time) { s.over = true; s.last = 'The tide closed in.'; s.event = 'hit'; s.serial++; return; }
    if (frozen) return;
    function blocked(x, y) { return x < 1 || x > W - 2 || y < 1 || y > H - 2 || s.cells[index(Math.round(x), Math.round(y))]; }
    s.enemies.forEach(function (e) {
      var nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
      if (blocked(nx, e.y)) e.vx *= -1; else e.x = nx;
      if (blocked(e.x, ny)) e.vy *= -1; else e.y = ny;
      if (s.trail.some(function (p) { return Math.hypot(p.x - e.x, p.y - e.y) < 0.8; })) hit(s);
    });
  }
  function next(s) {
    if (!s.clear || s.over) return false;
    s.stage++; board(s); return true;
  }
  TL.Logic = { W: W, H: H, charts: charts, index: index, newGame: newGame,
    move: move, tick: tick, pulse: pulse, next: next };
})(window);
