(function (global) {
  'use strict';
  var WW = global.WW = global.WW || {};
  var L = WW.Logic, R = WW.Render = {};
  var CELL = 32, W = L.W * CELL, H = L.H * CELL;
  var COLORS = { cinder: '#ff6b4a', mire: '#5de0b0', hush: '#b48cff', dusk: '#ffb347' };
  var staticLayer = null, parts = [], popups = [], shake = 0, stars = [];
  R.CELL = CELL; R.W = W; R.H = H;

  function isWall(c, r) { var ch = L.tileAt(c, r); return ch === '#'; }

  function buildStatic() {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var bg = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, H * 0.75);
    bg.addColorStop(0, '#1b1233'); bg.addColorStop(1, '#07050f');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // floor tiles
    for (var r = 0; r < L.H; r++) for (var c = 0; c < L.W; c++) {
      if (!isWall(c, r)) {
        g.fillStyle = (c + r) % 2 ? '#150e27' : '#120b22'; g.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
    // walls: glowing rounded blocks with edge lines facing floors
    g.save(); g.shadowColor = '#7a5cff'; g.shadowBlur = 14;
    for (r = 0; r < L.H; r++) for (c = 0; c < L.W; c++) {
      if (!isWall(c, r)) continue;
      var edge = !isWall(c - 1, r) || !isWall(c + 1, r) || !isWall(c, r - 1) || !isWall(c, r + 1) ||
        !isWall(c - 1, r - 1) || !isWall(c + 1, r + 1) || !isWall(c + 1, r - 1) || !isWall(c - 1, r + 1);
      if (!edge) continue;
      var grad = g.createLinearGradient(c * CELL, r * CELL, c * CELL, (r + 1) * CELL);
      grad.addColorStop(0, '#4a3a8f'); grad.addColorStop(1, '#2a1f5c');
      g.fillStyle = grad;
      var x = c * CELL + 2, y = r * CELL + 2, w = CELL - 4, h = CELL - 4;
      g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, 7) : g.rect(x, y, w, h); g.fill();
    }
    g.restore();
    // bevel highlight
    g.strokeStyle = 'rgba(190,170,255,0.45)'; g.lineWidth = 1.5;
    for (r = 0; r < L.H; r++) for (c = 0; c < L.W; c++) {
      if (!isWall(c, r)) continue;
      var e2 = !isWall(c - 1, r) || !isWall(c + 1, r) || !isWall(c, r - 1) || !isWall(c, r + 1);
      if (!e2) continue;
      g.beginPath(); g.roundRect ? g.roundRect(c * CELL + 4, r * CELL + 4, CELL - 8, CELL - 8, 5) : g.rect(c * CELL + 4, r * CELL + 4, CELL - 8, CELL - 8); g.stroke();
    }
    // ghost house door
    g.fillStyle = '#ff9bd0'; g.fillRect(L.DOOR.c * CELL + 2, L.DOOR.r * CELL + CELL / 2 - 2, CELL - 4, 4);
    for (r = 0; r < 60; r++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() });
    return cv;
  }

  function wallLight(g, t) {
    var a = 0.05 + 0.03 * Math.sin(t * 0.8);
    g.fillStyle = 'rgba(120,90,255,' + a + ')'; g.fillRect(0, 0, W, H);
  }

  function drawGates(g, s, t) {
    for (var r = 0; r < L.H; r++) for (var c = 0; c < L.W; c++) {
      var ch = L.MAZE[r].charAt(c);
      if (ch !== 'a' && ch !== 'b') continue;
      var open = s.gate[ch], x = c * CELL, y = r * CELL;
      var closing = s.warn && open, opening = s.warn && !open;
      var pulse = 0.5 + 0.5 * Math.sin(t * 14);
      var hue = ch === 'a' ? '#ffb347' : '#5de0ff';
      g.save();
      if (!open || closing) {
        g.globalAlpha = closing ? 0.35 + 0.65 * pulse : 1;
        g.shadowColor = hue; g.shadowBlur = 16; g.fillStyle = hue;
        for (var k = 0; k < 3; k++) g.fillRect(x + 4 + k * 10, y + 3, 4, CELL - 6);
        g.fillRect(x + 2, y + 3, CELL - 4, 3); g.fillRect(x + 2, y + CELL - 6, CELL - 4, 3);
      } else {
        g.globalAlpha = opening ? 0.3 + 0.7 * pulse : 0.45;
        g.strokeStyle = hue; g.setLineDash([3, 5]); g.lineWidth = 2; g.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);
      }
      g.restore();
    }
  }

  function drawDots(g, s, t) {
    for (var r = 0; r < L.H; r++) for (var c = 0; c < L.W; c++) {
      var v = s.dots[r][c]; if (!v) continue;
      var x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
      if (v === 1) {
        g.fillStyle = '#ffd98a'; g.shadowColor = '#ffb347'; g.shadowBlur = 8;
        g.beginPath(); g.arc(x, y, 3, 0, 6.283); g.fill();
      } else {
        var p = 7 + 2 * Math.sin(t * 6);
        var rg = g.createRadialGradient(x, y, 1, x, y, p + 8);
        rg.addColorStop(0, '#fff'); rg.addColorStop(0.4, '#ffe08a'); rg.addColorStop(1, 'rgba(255,170,60,0)');
        g.shadowBlur = 0; g.fillStyle = rg; g.beginPath(); g.arc(x, y, p + 8, 0, 6.283); g.fill();
      }
    }
    g.shadowBlur = 0;
  }

  function drawWisp(g, s, t) {
    var p = L.pos(s.wisp), x = (p.x + 0.5) * CELL, y = (p.y + 0.5) * CELL;
    var dying = s.status === 'dying';
    var k = dying ? Math.max(0, s.statusTimer / 1.5) : 1;
    var rr = CELL * 0.36 * (0.6 + 0.4 * k) + 1.5 * Math.sin(t * 10);
    var lg = g.createRadialGradient(x, y, 2, x, y, CELL * 1.7);
    lg.addColorStop(0, 'rgba(255,240,180,' + (0.5 * k) + ')'); lg.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = lg; g.beginPath(); g.arc(x, y, CELL * 1.7, 0, 6.283); g.fill();
    var og = g.createRadialGradient(x - 3, y - 3, 1, x, y, rr);
    og.addColorStop(0, '#ffffff'); og.addColorStop(0.5, '#fff1a8'); og.addColorStop(1, '#ffb73d');
    g.fillStyle = og; g.shadowColor = '#ffd36a'; g.shadowBlur = 20;
    g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill(); g.shadowBlur = 0;
    // flame tail opposite movement
    var dx = s.wisp.dx || (s.lastDir ? s.lastDir.dx : 0), dy = s.wisp.dy || (s.lastDir ? s.lastDir.dy : 0);
    g.fillStyle = 'rgba(255,190,70,0.6)';
    g.beginPath(); g.moveTo(x - dy * rr * 0.8, y + dx * rr * 0.8); g.lineTo(x + dy * rr * 0.8, y - dx * rr * 0.8);
    g.lineTo(x - dx * rr * 2.2 + Math.sin(t * 20) * 2, y - dy * rr * 2.2); g.fill();
    // eyes
    g.fillStyle = '#2a1030';
    g.beginPath(); g.arc(x + dx * 3 - 4 * (dy ? 1 : 0.0) - (dy ? 0 : 0) + (dy ? -3 : 0), y + dy * 3 + (dx ? -3 : -2), 2, 0, 6.283);
    g.arc(x + dx * 3 + (dy ? 3 : 0), y + dy * 3 + (dx ? 3 : -2), 2, 0, 6.283); g.fill();
  }

  function drawGloam(g, s, gl, t) {
    var p = L.pos(gl), x = (p.x + 0.5) * CELL, y = (p.y + 0.5) * CELL, r = CELL * 0.42;
    var col = COLORS[gl.name], eyes = gl.state === 'eyes';
    var scared = gl.scared, flash = scared && s.fright < 2 && Math.floor(t * 8) % 2;
    if (gl.state === 'house' && Math.floor(t * 3 + gl.i) % 2) y -= 2;
    if (!eyes) {
      var body = gl.stun > 0 ? '#9aa4c8' : scared ? (flash ? '#ffffff' : '#3b4bd1') : col;
      g.save(); g.shadowColor = scared ? '#5568ff' : col; g.shadowBlur = 16; g.fillStyle = body;
      g.beginPath(); g.arc(x, y - 2, r, Math.PI, 0);
      var wob = Math.sin(t * 12 + gl.i) * 2;
      g.lineTo(x + r, y + r - 2);
      for (var k = 0; k < 4; k++) {
        var x0 = x + r - k * (r / 2), x1 = x0 - r / 4, x2 = x0 - r / 2;
        g.quadraticCurveTo(x1, y + r + 3 + (k % 2 ? -wob : wob), x2, y + r - 2);
      }
      g.closePath(); g.fill(); g.restore();
      if (gl.stun > 0) {
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath();
        g.arc(x, y - r - 4, 5 + Math.sin(t * 20), 0, 6.283); g.stroke();
      }
    }
    // eyes look toward movement
    var ex = (gl.dx || 0) * 2.5, ey = (gl.dy || 0) * 2.5;
    if (scared && !eyes) {
      g.fillStyle = '#fff'; g.fillRect(x - 6, y - 6, 3, 3); g.fillRect(x + 3, y - 6, 3, 3);
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 7, y + 5);
      for (var z = 0; z < 5; z++) g.lineTo(x - 7 + z * 3.5, y + (z % 2 ? 3 : 6)); g.stroke();
    } else {
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(x - 5, y - 4, 4, 5, 0, 0, 6.283); g.ellipse(x + 5, y - 4, 4, 5, 0, 0, 6.283); g.fill();
      g.fillStyle = '#18102e';
      g.beginPath(); g.arc(x - 5 + ex, y - 4 + ey, 2, 0, 6.283); g.arc(x + 5 + ex, y - 4 + ey, 2, 0, 6.283); g.fill();
    }
  }

  function drawFruit(g, s, t) {
    if (!s.fruit) return;
    var x = (s.fruit.c + 0.5) * CELL, y = (s.fruit.r + 0.5) * CELL + Math.sin(t * 4) * 2;
    if (s.fruit.t < 2 && Math.floor(t * 8) % 2) return;
    g.save(); g.shadowColor = '#7dff9a'; g.shadowBlur = 14; g.fillStyle = '#7dff9a';
    g.beginPath(); g.moveTo(x, y - 11); g.quadraticCurveTo(x + 13, y - 2, x, y + 11); g.quadraticCurveTo(x - 13, y - 2, x, y - 11); g.fill();
    g.fillStyle = '#ffffff88'; g.fillRect(x - 1, y - 12, 2, 24); g.restore();
  }

  R.burst = function (x, y, color, n, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, v = (0.3 + Math.random()) * speed;
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, max: 0.9, color: color });
    }
  };
  R.event = function (e) {
    var cx = function (c) { return (c + 0.5) * CELL; };
    if (e.type === 'ember') R.burst(cx(e.c), cx(e.r), '#ffd98a', 3, 40);
    else if (e.type === 'power') R.burst(cx(e.c), cx(e.r), '#ffffff', 22, 120);
    else if (e.type === 'eatGloam') { R.burst(cx(e.x), cx(e.y), '#7f95ff', 26, 160); popups.push({ x: cx(e.x), y: cx(e.y), text: String(e.points), life: 1 }); shake = 6; }
    else if (e.type === 'fruit') { R.burst(cx(e.c), cx(e.r), '#7dff9a', 20, 130); popups.push({ x: cx(e.c), y: cx(e.r), text: String(e.points), life: 1 }); }
    else if (e.type === 'death') { shake = 12; }
    else if (e.type === 'gateFlip') { shake = 5; }
    else if (e.type === 'flare') { shake = 4; }
  };

  R.draw = function (canvas, s, t, dt) {
    var g = canvas.getContext('2d');
    if (!staticLayer) staticLayer = buildStatic();
    if (canvas.width !== W) canvas.width = W; if (canvas.height !== H) canvas.height = H;
    g.save();
    if (shake > 0.2) { g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); shake *= 0.88; } else shake = 0;
    g.drawImage(staticLayer, 0, 0);
    g.fillStyle = '#fff';
    stars.forEach(function (st) { g.globalAlpha = 0.1 + 0.15 * Math.sin(t * 2 + st.s * 9); g.fillRect(st.x, st.y, 1.5, 1.5); });
    g.globalAlpha = 1;
    wallLight(g, t);
    drawDots(g, s, t);
    drawGates(g, s, t);
    drawFruit(g, s, t);
    s.gloams.forEach(function (gl) { if (s.status !== 'dying') drawGloam(g, s, gl, t); });
    drawWisp(g, s, t);
    if (s.flareFx > 0) {
      var wp = L.pos(s.wisp), fx = (wp.x + 0.5) * CELL, fy = (wp.y + 0.5) * CELL, k = 1 - s.flareFx / 0.6;
      g.strokeStyle = 'rgba(255,240,180,' + (1 - k) + ')'; g.lineWidth = 6 * (1 - k) + 1;
      g.beginPath(); g.arc(fx, fy, 3.4 * CELL * k, 0, 6.283); g.stroke();
      g.fillStyle = 'rgba(255,240,200,' + 0.25 * (1 - k) + ')'; g.fillRect(0, 0, W, H);
    }
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; g.globalAlpha = p.life / p.max; g.fillStyle = p.color;
      g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    g.globalAlpha = 1;
    g.font = '900 16px system-ui, sans-serif'; g.textAlign = 'center';
    for (i = popups.length - 1; i >= 0; i--) {
      var q = popups[i]; q.life -= dt; if (q.life <= 0) { popups.splice(i, 1); continue; }
      g.globalAlpha = Math.min(1, q.life * 2); g.fillStyle = '#9fb4ff'; g.fillText(q.text, q.x, q.y - (1 - q.life) * 30);
    }
    g.globalAlpha = 1;
    if (s.status === 'ready') {
      g.font = '900 28px Georgia, serif'; g.fillStyle = '#ffe9a8'; g.shadowColor = '#ffb347'; g.shadowBlur = 18;
      g.fillText('LEVEL ' + s.level, W / 2, 12 * CELL + 6); g.shadowBlur = 0;
    }
    // vignette
    var vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.restore();
  };
})(window);
