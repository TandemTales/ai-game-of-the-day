(function (global) {
  'use strict';
  var LM = global.LM = global.LM || {}, L = LM.Logic, T = 48, W = L.W * T, H = L.H * T;
  var DIRS = L.DIRS, bg = null, bgKey = '', parts = [], pops = [], seedRand = 12345;
  function r() { seedRand = (seedRand * 1664525 + 1013904223) >>> 0; return seedRand / 4294967296; }
  function isWall(c, rr) { var ch = L.cell(c, rr); return ch === '#' || ch === 'D'; }
  function buildBackground() {
    var c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
    seedRand = 99;
    var f = g.createLinearGradient(0, 0, 0, H); f.addColorStop(0, '#0d1620'); f.addColorStop(1, '#09111a');
    g.fillStyle = f; g.fillRect(0, 0, W, H);
    for (var i = 0; i < 700; i++) { g.fillStyle = 'rgba(' + (60 + r() * 40 | 0) + ',' + (90 + r() * 50 | 0) + ',80,' + (0.04 + r() * 0.06) + ')';
      g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
    for (var rr = 0; rr < L.H; rr++) for (var cc = 0; cc < L.W; cc++) {
      if (!isWall(cc, rr)) continue;
      var x = cc * T, y = rr * T, p = 3;
      g.save(); g.shadowColor = 'rgba(80,255,150,0.45)'; g.shadowBlur = 14;
      var gr = g.createLinearGradient(x, y, x, y + T); gr.addColorStop(0, '#1f5a35'); gr.addColorStop(1, '#0f3a24');
      g.fillStyle = gr;
      var rad = 14; g.beginPath();
      var u = isWall(cc, rr - 1), d = isWall(cc, rr + 1), l = isWall(cc - 1, rr), rt = isWall(cc + 1, rr);
      var x0 = x + (l ? 0 : p), x1 = x + T - (rt ? 0 : p), y0 = y + (u ? 0 : p), y1 = y + T - (d ? 0 : p);
      var tl = !u && !l ? rad : 2, tr = !u && !rt ? rad : 2, br = !d && !rt ? rad : 2, bl = !d && !l ? rad : 2;
      g.moveTo(x0 + tl, y0); g.lineTo(x1 - tr, y0); g.quadraticCurveTo(x1, y0, x1, y0 + tr);
      g.lineTo(x1, y1 - br); g.quadraticCurveTo(x1, y1, x1 - br, y1); g.lineTo(x0 + bl, y1);
      g.quadraticCurveTo(x0, y1, x0, y1 - bl); g.lineTo(x0, y0 + tl); g.quadraticCurveTo(x0, y0, x0 + tl, y0);
      g.fill(); g.restore();
      for (var k = 0; k < 14; k++) { // leaf flecks
        var lx = x + 4 + r() * (T - 8), ly = y + 4 + r() * (T - 8);
        g.fillStyle = r() < 0.5 ? 'rgba(120,230,140,0.35)' : 'rgba(5,30,18,0.5)';
        g.beginPath(); g.ellipse(lx, ly, 3 + r() * 3, 1.5 + r() * 1.5, r() * 3, 0, 6.3); g.fill();
      }
      g.strokeStyle = 'rgba(140,255,170,0.25)'; g.lineWidth = 1.5; g.stroke();
    }
    var cx = 8 * T + T / 2, cy = 7 * T + T / 2;
    var pen = g.createRadialGradient(cx, cy, 4, cx, cy, 70); pen.addColorStop(0, 'rgba(180,60,255,0.28)'); pen.addColorStop(1, 'rgba(180,60,255,0)');
    g.fillStyle = pen; g.fillRect(cx - 80, cy - 80, 160, 160);
    return c;
  }
  function burst(x, y, color, n, speed) {
    for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, s = (0.4 + Math.random()) * speed;
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, max: 0.9, color: color }); }
  }
  function drawGate(g, run, c, rr, ch, time) {
    var x = c * T, y = rr * T, open = L.gateOpen(run, ch), warn = L.gateWarn(run.t), pulse = 0.5 + 0.5 * Math.sin(time * 18);
    var closing = open && warn, opening = !open && warn;
    g.save();
    g.shadowColor = open && !closing ? 'rgba(120,255,160,0.7)' : 'rgba(255,90,70,0.9)'; g.shadowBlur = 12;
    g.fillStyle = '#2a7a4a';
    g.beginPath(); g.arc(x + 6, y + T / 2, 6, 0, 6.3); g.arc(x + T - 6, y + T / 2, 6, 0, 6.3); g.fill();
    var amt = open ? (closing ? 0.35 + 0.35 * pulse : 0.12) : (opening ? 0.6 + 0.3 * pulse : 1);
    g.strokeStyle = closing || opening ? 'rgba(255,' + (120 + 80 * pulse | 0) + ',90,1)' : (open ? '#4fae6c' : '#c8584a');
    g.lineWidth = 4; g.lineCap = 'round';
    for (var i = 0; i < 3; i++) { var yy = y + 10 + i * 14; g.beginPath(); g.moveTo(x + 8, yy); g.lineTo(x + 8 + (T - 16) * amt, yy);
      g.moveTo(x + T - 8, yy); g.lineTo(x + T - 8 - (T - 16) * amt, yy); g.stroke(); }
    if (!open) { g.strokeStyle = 'rgba(255,180,160,0.8)'; g.lineWidth = 1.5;
      for (var j = 0; j < 4; j++) { var tx = x + 14 + j * 7; g.beginPath(); g.moveTo(tx, y + 6); g.lineTo(tx + 3, y + 2); g.moveTo(tx, y + T - 6); g.lineTo(tx + 3, y + T - 2); g.stroke(); } }
    g.restore();
  }
  function drawSeed(g, x, y, kind, time) {
    if (kind === 'o') {
      var s = 1 + 0.12 * Math.sin(time * 5), gl = g.createRadialGradient(x, y, 2, x, y, 26 * s);
      gl.addColorStop(0, 'rgba(255,200,90,0.85)'); gl.addColorStop(1, 'rgba(255,140,40,0)');
      g.fillStyle = gl; g.fillRect(x - 30, y - 30, 60, 60);
      g.fillStyle = '#ffb347'; g.fillRect(x - 6, y - 11, 12, 3); g.fillRect(x - 6, y + 8, 12, 3);
      g.fillStyle = '#ffe8a8'; g.beginPath(); g.roundRect ? g.roundRect(x - 8, y - 8, 16, 16, 5) : g.rect(x - 8, y - 8, 16, 16); g.fill();
    } else {
      var a = 0.6 + 0.4 * Math.sin(time * 3 + x * 0.1 + y * 0.07);
      g.fillStyle = 'rgba(200,255,120,' + (0.22 * a) + ')'; g.beginPath(); g.arc(x, y, 9, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(235,255,170,' + (0.7 + 0.3 * a) + ')'; g.beginPath(); g.arc(x, y, 3.2, 0, 6.3); g.fill();
    }
  }
  function drawMoth(g, run, time) {
    var m = run.moth, x = m.x * T + T / 2, y = m.y * T + T / 2;
    var ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][m.dir];
    var dead = run.state === 'dying', k = dead ? Math.max(0, run.timer / 1.6) : 1;
    var flap = 0.45 + 0.55 * Math.abs(Math.sin(time * (m.moving ? 22 : 9)));
    g.save(); g.translate(x, y); g.rotate(ang + (dead ? (1 - k) * 8 : 0)); g.scale(k, k);
    var gl = g.createRadialGradient(0, 0, 2, 0, 0, 30); gl.addColorStop(0, 'rgba(255,240,180,0.7)'); gl.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = gl; g.fillRect(-32, -32, 64, 64);
    g.fillStyle = 'rgba(255,248,225,0.95)';
    [-1, 1].forEach(function (sd) {
      g.beginPath(); g.moveTo(-2, sd * 2);
      g.bezierCurveTo(-8, sd * 24 * flap, -22, sd * 22 * flap, -16, sd * 5);
      g.bezierCurveTo(-16, sd * 3, -8, sd * 2, -2, sd * 2); g.fill();
      g.fillStyle = 'rgba(210,180,120,0.8)'; g.beginPath(); g.arc(-12, sd * 13 * flap, 3, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(255,248,225,0.95)';
    });
    g.fillStyle = '#6b4a2a'; g.beginPath(); g.ellipse(-2, 0, 11, 4.5, 0, 0, 6.3); g.fill();
    g.beginPath(); g.arc(9, 0, 4.2, 0, 6.3); g.fill();
    g.strokeStyle = '#d9c9a0'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(11, -1); g.quadraticCurveTo(18, -9, 22, -6);
    g.moveTo(11, 1); g.quadraticCurveTo(18, 9, 22, 6); g.stroke();
    g.restore();
  }
  var COLORS = ['#ff4d6d', '#ff9f43', '#c06bff', '#42d9c8'];
  function drawSpider(g, run, s, time) {
    if (s.state === 'pen' && false) return;
    var x = s.x * T + T / 2, y = s.y * T + T / 2, edible = s.edible, flash = edible && run.power < 2 && Math.floor(time * 8) % 2;
    g.save(); g.translate(x, y);
    if (s.state !== 'eyes') {
      var col = edible ? (flash ? '#ffffff' : '#4a6bff') : COLORS[s.id];
      g.shadowColor = col; g.shadowBlur = 14; g.strokeStyle = edible ? '#9fb4ff' : '#1a1020'; g.lineWidth = 2.5; g.lineCap = 'round';
      for (var i = 0; i < 8; i++) { var side = i < 4 ? -1 : 1, q = i % 4, a = (q - 1.5) * 0.55, wig = Math.sin(time * 14 + i * 1.7) * 3;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(side * 12, (q - 1.5) * 7 + wig); g.lineTo(side * 21, (q - 1.5) * 10 + 6 + wig * 0.6 + a); g.stroke(); }
      g.fillStyle = edible ? '#2438a8' : '#1c1226'; g.beginPath(); g.ellipse(0, 3, 11, 12, 0, 0, 6.3); g.fill();
      g.fillStyle = col; g.beginPath(); g.ellipse(0, 3, 6, 8, 0, 0, 6.3); g.globalAlpha = 0.65; g.fill(); g.globalAlpha = 1;
      g.shadowBlur = 0; g.fillStyle = '#12091a'; g.beginPath(); g.arc(0, -8, 7, 0, 6.3); g.fill();
    }
    var d = DIRS[s.dir]; g.fillStyle = edible ? '#fff' : '#ffe9e9';
    if (s.state === 'eyes') g.shadowColor = '#fff', g.shadowBlur = 8;
    [-3.5, 3.5].forEach(function (ex) { g.beginPath(); g.arc(ex, -8, 3, 0, 6.3); g.fill(); });
    g.fillStyle = '#111'; [-3.5, 3.5].forEach(function (ex) { g.beginPath(); g.arc(ex + d[0] * 1.4, -8 + d[1] * 1.4, 1.5, 0, 6.3); g.fill(); });
    g.restore();
  }
  LM.Render = {
    W: W, H: H, T: T,
    consume: function (run, events) {
      events.forEach(function (e) {
        if (e.type === 'seed') burst(run.moth.x * T + T / 2, run.moth.y * T + T / 2, '#e6ffaa', 3, 40);
        else if (e.type === 'lantern') burst(run.moth.x * T + T / 2, run.moth.y * T + T / 2, '#ffc15a', 26, 140);
        else if (e.type === 'eat') { burst(e.data.x * T + T / 2, e.data.y * T + T / 2, '#8fb0ff', 30, 160);
          pops.push({ x: e.data.x * T + T / 2, y: e.data.y * T + T / 2, text: String(e.data.points), life: 1 }); }
        else if (e.type === 'death') burst(run.moth.x * T + T / 2, run.moth.y * T + T / 2, '#fff2c0', 40, 170);
      });
    },
    draw: function (canvas, run, time, dt) {
      var g = canvas.getContext('2d');
      if (!bg) bg = buildBackground();
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      g.drawImage(bg, 0, 0);
      for (var rr = 0; rr < L.H; rr++) for (var c = 0; c < L.W; c++) {
        var ch = L.cell(c, rr);
        if (ch === 'A' || ch === 'B') drawGate(g, run, c, rr, ch, time);
        var sd = run.board.seeds[c + ',' + rr];
        if (sd) drawSeed(g, c * T + T / 2, rr * T + T / 2, sd, time);
      }
      run.spiders.forEach(function (s) { drawSpider(g, run, s, time); });
      if (!(run.state === 'dying' && run.timer <= 0)) drawMoth(g, run, time);
      parts = parts.filter(function (p) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; return p.life > 0; });
      parts.forEach(function (p) { g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, 2.6, 0, 6.3); g.fill(); });
      g.globalAlpha = 1;
      pops = pops.filter(function (p) { p.life -= dt; p.y -= 30 * dt; return p.life > 0; });
      g.font = 'bold 22px system-ui,sans-serif'; g.textAlign = 'center';
      pops.forEach(function (p) { g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = '#bcd0ff'; g.fillText(p.text, p.x, p.y); });
      g.globalAlpha = 1;
      // night: darkness with a lit pool around the moth, wider while a lantern burns
      var m = run.moth, mx = m.x * T + T / 2, my = m.y * T + T / 2, rad = run.power > 0 ? 440 : 300;
      var v = g.createRadialGradient(mx, my, 60, mx, my, rad); v.addColorStop(0, 'rgba(2,6,14,0)'); v.addColorStop(1, 'rgba(2,6,14,0.62)');
      g.fillStyle = v; g.fillRect(0, 0, W, H);
      if (run.state === 'clear') { g.fillStyle = 'rgba(255,240,190,' + (0.25 * Math.sin(time * 10) ** 2) + ')'; g.fillRect(0, 0, W, H); }
    }
  };
})(window);
