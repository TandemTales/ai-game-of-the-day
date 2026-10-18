(function (global) {
  'use strict';
  var GR = global.GR, L = GR.Logic, R = GR.Render = {};
  var T = 32, PAD = 16, SIZE = L.W * T + PAD * 2, parts = [], floaters = [], shake = 0;
  R.SIZE = SIZE;
  var COLORS = { Ember: '#ff6a4a', Thorn: '#d96cff', Mire: '#4de0b0', Drift: '#ffc14d' };
  function px(c) { return PAD + c * T; }
  function burst(x, y, n, color, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, s = (0.3 + Math.random()) * (speed || 60);
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, max: 0.9, color: color });
    }
  }
  R.react = function (g, events) {
    var p = g.player, x = px(p.c + p.dc * p.t) + T / 2, y = px(p.r + p.dr * p.t) + T / 2;
    events.forEach(function (e) {
      if (e === 'ember') burst(x, y, 3, '#ffd37a', 40);
      else if (e === 'flare') { burst(x, y, 40, '#9fe9ff', 160); shake = 5; }
      else if (e === 'hit') { burst(x, y, 50, '#ff5a5a', 200); shake = 12; }
      else if (e === 'eat' && g.lastEat) { burst(px(g.lastEat.c) + T / 2, px(g.lastEat.r) + T / 2, 30, '#ffffff', 180);
        floaters.push({ x: px(g.lastEat.c) + T / 2, y: px(g.lastEat.r), txt: String(g.lastEat.pts), life: 1 }); shake = 4; }
      else if (e === 'flip') { shake = 6; }
      else if (e === 'rune') burst(x, y, 24, '#c58bff', 120);
      else if (e === 'clear') burst(x, y, 80, '#ffe28a', 260);
    });
  };
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function isWall(c, r) { return L.cell(c, r) === '#'; }
  function drawWalls(c, t) {
    for (var r = 0; r < L.H; r++) for (var q = 0; q < L.W; q++) {
      if (!isWall(q, r)) continue;
      var edge = !(isWall(q - 1, r) && isWall(q + 1, r) && isWall(q, r - 1) && isWall(q, r + 1));
      var x = px(q), y = px(r);
      if (!edge) { c.fillStyle = '#04140f'; c.fillRect(x, y, T, T); continue; }
      var g = c.createLinearGradient(x, y, x, y + T);
      g.addColorStop(0, '#2f7a4a'); g.addColorStop(1, '#0f3a2a');
      c.fillStyle = g; rr(c, x + 1.5, y + 1.5, T - 3, T - 3, 9); c.fill();
      c.strokeStyle = '#6fe0a0'; c.globalAlpha = 0.35; c.lineWidth = 1.5; c.stroke(); c.globalAlpha = 1;
      // leaf specks
      c.fillStyle = '#8bf0b4'; c.globalAlpha = 0.25;
      for (var i = 0; i < 4; i++) { c.beginPath(); c.arc(x + 6 + ((q * 7 + r * 13 + i * 9) % 20), y + 6 + ((q * 5 + r * 11 + i * 7) % 20), 1.6, 0, 6.283); c.fill(); }
      c.globalAlpha = 1;
    }
  }
  function drawFloor(c) {
    c.fillStyle = '#071a15'; c.fillRect(0, 0, SIZE, SIZE);
    for (var r = 0; r < L.H; r++) for (var q = 0; q < L.W; q++) {
      if (isWall(q, r)) continue;
      c.fillStyle = (q + r) % 2 ? '#0c2a21' : '#0a2219'; c.fillRect(px(q), px(r), T, T);
    }
  }
  function drawGates(c, g, t) {
    var pending = g.flip > 0, blink = pending && Math.floor(t * 12) % 2;
    for (var r = 0; r < L.H; r++) for (var q = 0; q < L.W; q++) {
      var ch = L.cell(q, r); if (ch !== 'A' && ch !== 'B') continue;
      var open = L.open(q, r, g.state), x = px(q), y = px(r), col = ch === 'A' ? '#ffb23d' : '#a77bff';
      c.fillStyle = '#0a2219'; c.fillRect(x, y, T, T);
      c.save(); c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = open ? 4 : 12; c.lineWidth = 3;
      var willClose = pending && open, willOpen = pending && !open;
      c.globalAlpha = open ? (blink && willClose ? 0.9 : 0.35) : (blink && willOpen ? 0.3 : 1);
      if (open) { c.beginPath(); c.moveTo(x + 3, y + 4); c.lineTo(x + 3, y + T - 4); c.moveTo(x + T - 3, y + 4); c.lineTo(x + T - 3, y + T - 4); c.stroke(); }
      else { for (var i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x + 3, y + 5 + i * 7.5); c.lineTo(x + T - 3, y + 5 + i * 7.5); c.stroke(); } }
      c.restore();
    }
  }
  function drawPads(c, g, t) {
    g.pads.forEach(function (p) {
      var x = px(p.c) + T / 2, y = px(p.r) + T / 2, ready = p.cool <= 0, pulse = 0.5 + 0.5 * Math.sin(t * 4);
      c.save(); c.shadowColor = '#c58bff'; c.shadowBlur = ready ? 14 + pulse * 8 : 2;
      c.strokeStyle = ready ? '#d9b3ff' : '#5a4a70'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(x, y, 11, 0, 6.283); c.stroke();
      c.beginPath(); for (var i = 0; i < 3; i++) { var a = t * 0.8 + i * 2.094; c.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); } c.closePath(); c.stroke();
      c.restore();
    });
  }
  function drawEmbers(c, g, t) {
    for (var r = 0; r < L.H; r++) for (var q = 0; q < L.W; q++) {
      var ch = g.grid[r][q], x = px(q) + T / 2, y = px(r) + T / 2;
      if (ch === '.') {
        var f = 0.8 + 0.2 * Math.sin(t * 5 + q * 1.3 + r);
        var gr = c.createRadialGradient(x, y, 0, x, y, 8); gr.addColorStop(0, 'rgba(255,200,110,' + 0.9 * f + ')'); gr.addColorStop(1, 'rgba(255,120,40,0)');
        c.fillStyle = gr; c.fillRect(x - 8, y - 8, 16, 16);
        c.fillStyle = '#fff1c4'; c.beginPath(); c.arc(x, y, 2.6, 0, 6.283); c.fill();
      } else if (ch === 'o') {
        var s = 8 + 2 * Math.sin(t * 6);
        var g2 = c.createRadialGradient(x, y, 0, x, y, 20); g2.addColorStop(0, 'rgba(170,240,255,.95)'); g2.addColorStop(1, 'rgba(60,170,255,0)');
        c.fillStyle = g2; c.fillRect(x - 20, y - 20, 40, 40);
        c.fillStyle = '#eaffff'; c.beginPath(); c.arc(x, y, s * 0.7, 0, 6.283); c.fill();
      }
    }
  }
  function drawPlayer(c, g, t) {
    var p = g.player, x = px(p.c + p.dc * p.t) + T / 2, y = px(p.r + p.dr * p.t) + T / 2;
    if (p.dead > 0) {
      var k = 1 - p.dead / 1.4; c.save(); c.globalAlpha = 1 - k; c.translate(x, y); c.scale(1 - k * 0.8, 1 - k * 0.8);
    } else { c.save(); c.translate(x, y); }
    var face = L.DIRS[p.face] || L.DIRS[1], bob = Math.sin(t * 16) * (p.dc || p.dr ? 1.2 : 0.3);
    // cloak
    var cg = c.createLinearGradient(0, -12, 0, 12); cg.addColorStop(0, '#ffd37a'); cg.addColorStop(1, '#c4631f');
    c.fillStyle = cg; c.beginPath(); c.moveTo(-10, 12 + bob); c.quadraticCurveTo(-12, -8, 0, -12 + bob); c.quadraticCurveTo(12, -8, 10, 12 + bob); c.closePath(); c.fill();
    c.fillStyle = '#2b1608'; c.beginPath(); c.arc(face.c * 3, -2 + face.r * 3 + bob, 6, 0, 6.283); c.fill();
    c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(face.c * 5 - 2, -2 + face.r * 3 + bob, 1.4, 0, 6.283); c.arc(face.c * 5 + 2, -2 + face.r * 3 + bob, 1.4, 0, 6.283); c.fill();
    // lantern
    var lx = -face.r * 9 - face.c * 0 + 0, ly = 7 + bob;
    lx = face.c !== 0 ? -face.c * 4 : 11; 
    c.shadowColor = '#ffcf6a'; c.shadowBlur = 16; c.fillStyle = '#fff2b8'; c.beginPath(); c.arc(lx, ly, 4.5, 0, 6.283); c.fill();
    c.restore();
  }
  function drawWisp(c, g, w, t) {
    var x = px(w.c + w.dc * w.t) + T / 2, y = px(w.r + w.dr * w.t) + T / 2;
    if (w.state === 'house' && false) return;
    var frightened = w.state === 'frightened', eaten = w.state === 'eaten';
    var warn = frightened && g.fright < 1.6 && Math.floor(t * 8) % 2;
    var col = frightened ? (warn ? '#ffffff' : '#4f7dff') : COLORS[w.name];
    c.save(); c.translate(x, y + Math.sin(t * 6 + w.id) * 1.5);
    if (!eaten) {
      c.shadowColor = col; c.shadowBlur = 14; c.fillStyle = col; c.globalAlpha = 0.92;
      c.beginPath(); c.arc(0, -2, 11, Math.PI, 0); c.lineTo(11, 11);
      for (var i = 0; i < 4; i++) { c.quadraticCurveTo(11 - i * 5.5 - 2.75, 6 + (i % 2 ? 0 : 5) * (1 + Math.sin(t * 9 + i) * 0.3), 11 - (i + 1) * 5.5, 11); }
      c.closePath(); c.fill(); c.globalAlpha = 1; c.shadowBlur = 0;
    }
    var dir = L.DIRS[w.face] || L.DIRS[1];
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-4.5, -3, 3.6, 0, 6.283); c.arc(4.5, -3, 3.6, 0, 6.283); c.fill();
    c.fillStyle = frightened ? '#101a60' : '#10202c'; c.beginPath(); c.arc(-4.5 + dir.c * 1.6, -3 + dir.r * 1.6, 1.8, 0, 6.283); c.arc(4.5 + dir.c * 1.6, -3 + dir.r * 1.6, 1.8, 0, 6.283); c.fill();
    c.restore();
  }
  R.draw = function (canvas, g, t, dt) {
    var c = canvas.getContext('2d'), w = canvas.width, s = w / SIZE;
    c.setTransform(s, 0, 0, s, 0, 0);
    shake = Math.max(0, shake - dt * 30);
    c.save(); if (shake > 0) c.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawFloor(c); drawWalls(c, t); drawGates(c, g, t); drawPads(c, g, t); drawEmbers(c, g, t);
    g.wispList.forEach(function (wi) { drawWisp(c, g, wi, t); });
    drawPlayer(c, g, t);
    parts = parts.filter(function (p) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; return p.life > 0; });
    parts.forEach(function (p) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, 2.2, 0, 6.283); c.fill(); });
    c.globalAlpha = 1;
    floaters = floaters.filter(function (f) { f.life -= dt; f.y -= 24 * dt; return f.life > 0; });
    c.font = '800 16px system-ui,sans-serif'; c.textAlign = 'center';
    floaters.forEach(function (f) { c.globalAlpha = f.life; c.fillStyle = '#fff'; c.fillText(f.txt, f.x, f.y); }); c.globalAlpha = 1;
    // gloam: darkness closes in beyond the lantern
    var p = g.player, lx = px(p.c + p.dc * p.t) + T / 2, ly = px(p.r + p.dr * p.t) + T / 2;
    var dark = c.createRadialGradient(lx, ly, T * 3.5, lx, ly, T * 11); dark.addColorStop(0, 'rgba(2,8,12,0)'); dark.addColorStop(1, 'rgba(2,8,12,0.55)');
    c.fillStyle = dark; c.fillRect(0, 0, SIZE, SIZE);
    c.restore();
  };
})(window);
