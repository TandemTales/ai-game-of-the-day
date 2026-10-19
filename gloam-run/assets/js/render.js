(function (global) {
  'use strict';
  var GR = global.GR = global.GR || {}, L = GR.Logic, T = 30;
  var COLORS = ['#ff6f91', '#ffb347', '#a78bfa', '#5eead4'];
  var parts = [], texts = [], hedgeCache = null, shake = 0, lastGate = 0;
  function hedgeLayer() {
    if (hedgeCache) return hedgeCache;
    var c = document.createElement('canvas'); c.width = L.W * T; c.height = L.H * T;
    var g = c.getContext('2d'), x, y;
    var bg = g.createRadialGradient(c.width / 2, c.height / 2, 40, c.width / 2, c.height / 2, c.height * .7);
    bg.addColorStop(0, '#12221f'); bg.addColorStop(1, '#050b0d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    for (y = 0; y < L.H; y++) for (x = 0; x < L.W; x++) {
      var ch = L.MAZE[y][x];
      if (ch !== '#') continue;
      g.save(); g.shadowColor = '#3ee28a'; g.shadowBlur = 8;
      g.fillStyle = '#0f3a2c'; rr(g, x * T + 2, y * T + 2, T - 4, T - 4, 9); g.fill(); g.restore();
      var lg = g.createLinearGradient(0, y * T, 0, y * T + T); lg.addColorStop(0, '#1f6b46'); lg.addColorStop(1, '#0d2f27');
      g.fillStyle = lg; rr(g, x * T + 3, y * T + 3, T - 6, T - 6, 8); g.fill();
      for (var i = 0; i < 5; i++) { // leaf flecks, deterministic
        var sx = x * T + 6 + ((x * 7 + y * 13 + i * 11) % 18), sy = y * T + 6 + ((x * 5 + y * 3 + i * 17) % 18);
        g.fillStyle = i % 2 ? '#2f9a62aa' : '#55d68a66'; g.beginPath(); g.ellipse(sx, sy, 3.2, 1.6, (i + x) % 3, 0, 6.3); g.fill();
      }
    }
    hedgeCache = c; return c;
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function burst(x, y, color, n, speed) {
    for (var i = 0; i < n; i++) { var a = i / n * 6.283 + Math.random(), s = speed * (.4 + Math.random());
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .6 + Math.random() * .4, max: 1, c: color }); }
  }
  function consume(run) {
    var ev = run.events.splice(0);
    ev.forEach(function (e) {
      if (e.type === 'mote') burst(e.x * T + 15, e.y * T + 15, '#ffe9a3', 4, 40);
      else if (e.type === 'lantern') { burst(e.x * T + 15, e.y * T + 15, '#9be7ff', 22, 140); shake = 5; }
      else if (e.type === 'eat') { burst(e.x * T + 15, e.y * T + 15, '#9be7ff', 24, 160); texts.push({ x: e.x * T + 15, y: e.y * T + 15, s: String(e.value), life: 1 }); shake = 8; }
      else if (e.type === 'die') { burst(run.wick.x * T + 15, run.wick.y * T + 15, '#ffd966', 40, 180); shake = 12; }
      else if (e.type === 'gates') { lastGate = 1; shake = 6; }
      else if (e.type === 'bloom') texts.push({ x: 9 * T + 15, y: 11 * T + 15, s: '+' + e.value, life: 1.2 });
    });
  }
  function drawGate(g, run, gt, time) {
    var cx = gt.x * T + 15, cy = gt.y * T + 15, ax = L.gateAxis(run, gt), open = ax;
    var vertCorridor = L.MAZE[gt.y - 1][gt.x] !== '#' && L.MAZE[gt.y + 1][gt.x] !== '#';
    var passes = vertCorridor ? ax === 1 : ax === 0; // is the corridor currently passable
    g.save(); g.translate(cx, cy);
    g.rotate(ax * Math.PI / 2 + (lastGate > 0 ? (1 - lastGate) * 0 + lastGate * -1.2 : 0));
    g.shadowColor = passes ? '#6df7b8' : '#ff5c7a'; g.shadowBlur = 12;
    g.fillStyle = passes ? '#6df7b8' : '#ff5c7a'; rr(g, -13, -3, 26, 6, 3); g.fill();
    g.fillStyle = '#10201b'; g.beginPath(); g.arc(0, 0, 5, 0, 6.3); g.fill();
    g.restore();
  }
  function drawWick(g, run, time) {
    var p = L.pos(run.wick), x = p.x * T + 15, y = p.y * T + 15, w = run.wick;
    if (run.deathTimer > 0) { var k = 1 - run.deathTimer / 1.6; g.globalAlpha = Math.max(0, 1 - k); g.save(); g.translate(x, y); g.rotate(k * 9); g.scale(1 - k * .8, 1 - k * .8);
      g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(0, 0, 8, 0, 6.3); g.fill(); g.restore(); g.globalAlpha = 1; return; }
    var rg = g.createRadialGradient(x, y, 2, x, y, 30); rg.addColorStop(0, '#fff3b088'); rg.addColorStop(1, '#fff3b000');
    g.fillStyle = rg; g.fillRect(x - 30, y - 30, 60, 60);
    var flap = Math.sin(time * 40) * .5 + .5, a = Math.atan2(L.DIRS[w.dir].y, L.DIRS[w.dir].x);
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = '#d9f7ffaa'; g.beginPath(); g.ellipse(-3, -6, 8, 3 + flap * 3, -.6, 0, 6.3); g.fill();
    g.beginPath(); g.ellipse(-3, 6, 8, 3 + flap * 3, .6, 0, 6.3); g.fill();
    g.fillStyle = '#3b2a1a'; rr(g, -9, -3.5, 14, 7, 3.5); g.fill();
    g.shadowColor = '#ffe27a'; g.shadowBlur = 14; g.fillStyle = '#ffe27a'; g.beginPath(); g.ellipse(-8, 0, 5.5, 4.5, 0, 0, 6.3); g.fill();
    g.shadowBlur = 0; g.fillStyle = '#2b1d12'; g.beginPath(); g.arc(5, -2, 1.3, 0, 6.3); g.arc(5, 2, 1.3, 0, 6.3); g.fill();
    g.restore();
  }
  function drawShade(g, run, h, time) {
    if (h.mode === 'return') { var q = L.pos(h); drawEyes(g, q.x * T + 15, q.y * T + 15, h.dir, '#fff'); return; }
    var p = L.pos(h), x = p.x * T + 15, y = p.y * T + 15 + Math.sin(time * 6 + h.id) * 1.2;
    var scared = h.mode === 'scared', flash = scared && run.frightTimer < 2 && Math.floor(time * 6) % 2;
    var col = scared ? (flash ? '#ffffff' : '#4b6bff') : COLORS[h.id];
    g.save(); g.shadowColor = col; g.shadowBlur = 14; g.fillStyle = col;
    g.beginPath(); g.arc(x, y - 1, 11, Math.PI, 0); g.lineTo(x + 11, y + 11);
    for (var i = 0; i < 4; i++) g.lineTo(x + 11 - (i + .5) * 5.5, y + 7 + (i % 2 ? 0 : 3)), g.lineTo(x + 11 - (i + 1) * 5.5, y + 11);
    g.closePath(); g.fill(); g.restore();
    if (scared) { g.fillStyle = flash ? '#4b6bff' : '#fff'; g.beginPath(); g.arc(x - 4, y - 2, 2, 0, 6.3); g.arc(x + 4, y - 2, 2, 0, 6.3); g.fill();
      g.strokeStyle = g.fillStyle; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 6, y + 4); g.lineTo(x - 3, y + 2); g.lineTo(x, y + 4); g.lineTo(x + 3, y + 2); g.lineTo(x + 6, y + 4); g.stroke(); }
    else drawEyes(g, x, y - 2, h.dir, '#fff');
  }
  function drawEyes(g, x, y, dir, c) {
    var d = L.DIRS[dir];
    [-4, 4].forEach(function (ox) { g.fillStyle = c; g.beginPath(); g.ellipse(x + ox, y, 3.4, 4.2, 0, 0, 6.3); g.fill();
      g.fillStyle = '#10142a'; g.beginPath(); g.arc(x + ox + d.x * 1.6, y + d.y * 1.8, 1.8, 0, 6.3); g.fill(); });
  }
  function draw(canvas, run, time, ui) {
    var g = canvas.getContext('2d'), dt = 1 / 60;
    canvas.width = canvas.width === L.W * T ? canvas.width : L.W * T; canvas.height = L.H * T;
    consume(run);
    g.save();
    if (shake > .2) { g.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake *= .88; }
    g.drawImage(hedgeLayer(), 0, 0);
    if (lastGate > 0) lastGate = Math.max(0, lastGate - .05);
    var x, y, pulse = .5 + Math.sin(time * 5) * .5;
    for (y = 0; y < L.H; y++) for (x = 0; x < L.W; x++) {
      var c = run.grid[y][x], cx = x * T + 15, cy = y * T + 15;
      if (c === '.') { g.fillStyle = '#ffe9a3'; g.shadowColor = '#ffd966'; g.shadowBlur = 6; g.beginPath(); g.arc(cx, cy, 2.6, 0, 6.3); g.fill(); g.shadowBlur = 0; }
      else if (c === 'o') { g.save(); g.shadowColor = '#9be7ff'; g.shadowBlur = 16 + pulse * 10; g.fillStyle = '#d6f6ff';
        g.beginPath(); g.arc(cx, cy, 6.5 + pulse * 1.5, 0, 6.3); g.fill(); g.strokeStyle = '#9be7ff'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 10 + pulse * 2, 0, 6.3); g.stroke(); g.restore(); }
      else if (c === 'S') { g.save(); g.translate(cx, cy); g.rotate(time); g.shadowColor = '#c4a7ff'; g.shadowBlur = 14; g.fillStyle = '#b79bff';
        g.beginPath(); for (var k = 0; k < 6; k++) g.lineTo(Math.cos(k * 1.047) * 9, Math.sin(k * 1.047) * 9); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.globalAlpha = .7; g.beginPath(); g.arc(-2, -2, 2.5, 0, 6.3); g.fill(); g.restore(); }
      else if (c === '-') { g.fillStyle = '#ff9fb8'; g.fillRect(x * T + 2, y * T + 12, T - 4, 6); }
    }
    run.gates.forEach(function (gt) { drawGate(g, run, gt, time); });
    if (run.bloom) { var bx = run.bloom.x * T + 15, by = run.bloom.y * T + 15; g.save(); g.shadowColor = '#ff8ad8'; g.shadowBlur = 14;
      for (var pi = 0; pi < 6; pi++) { g.fillStyle = pi % 2 ? '#ff8ad8' : '#ffc4ef'; g.beginPath(); g.ellipse(bx + Math.cos(pi * 1.047 + time) * 6, by + Math.sin(pi * 1.047 + time) * 6, 5, 3, pi * 1.047 + time, 0, 6.3); g.fill(); }
      g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(bx, by, 3.5, 0, 6.3); g.fill(); g.restore(); }
    run.hunters.forEach(function (h) { if (h.mode !== 'house' || true) drawShade(g, run, h, time); });
    drawWick(g, run, time);
    parts = parts.filter(function (p) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96;
      if (p.life <= 0) return false; g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.c; g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); g.globalAlpha = 1; return true; });
    g.font = '700 14px system-ui, sans-serif'; g.textAlign = 'center';
    texts = texts.filter(function (t) { t.life -= dt; t.y -= .6; if (t.life <= 0) return false; g.globalAlpha = Math.min(1, t.life * 2);
      g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeText(t.s, t.x, t.y); g.fillText(t.s, t.x, t.y); g.globalAlpha = 1; return true; });
    g.restore();
    var vg = g.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * .3, canvas.width / 2, canvas.height / 2, canvas.height * .75);
    vg.addColorStop(0, '#0000'); vg.addColorStop(1, '#000a'); g.fillStyle = vg; g.fillRect(0, 0, canvas.width, canvas.height);
    if (run.readyTimer > 0 && ui.mode === 'playing') { g.font = '800 28px Georgia, serif'; g.fillStyle = '#ffe9a3'; g.shadowColor = '#000'; g.shadowBlur = 8; g.fillText('READY', canvas.width / 2, 12 * T + 8); g.shadowBlur = 0; }
  }
  GR.Render = { draw: draw, T: T };
})(window);
