(function (global) {
  'use strict';
  var HG = global.HG = global.HG || {};
  var L = HG.Logic, T = 40, particles = [], floaters = [], stars = [], shake = 0, bgCache = null;
  for (var i = 0; i < 60; i++) stars.push({ x: (i * 97 % 600), y: (i * 53 % 600), r: 0.5 + (i % 3) * 0.5, p: i });
  function hash(a, b) { var h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); }
  function size(canvas) { canvas.width = L.W * T; canvas.height = L.H * T; }

  function drawHedge(ctx, c, r, layerNow, closing, t) {
    var x = c * T, y = r * T, jitter = closing ? Math.sin(t * 60 + c * 3 + r) * 1.6 : 0;
    ctx.save(); ctx.translate(jitter, 0);
    var g = ctx.createLinearGradient(x, y, x, y + T);
    g.addColorStop(0, '#2e7a3f'); g.addColorStop(1, '#14452a');
    ctx.fillStyle = g; roundRect(ctx, x + 1, y + 1, T - 2, T - 2, 9); ctx.fill();
    for (var k = 0; k < 9; k++) {
      var h1 = hash(c * 9 + k, r), h2 = hash(r * 7 + k, c + 3);
      ctx.fillStyle = h1 > 0.5 ? 'rgba(120,220,120,0.22)' : 'rgba(0,30,10,0.28)';
      ctx.beginPath(); ctx.ellipse(x + 5 + h1 * (T - 10), y + 5 + h2 * (T - 10), 4.5, 2.6, h1 * 6, 0, 6.3); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(180,255,170,0.25)'; ctx.lineWidth = 1.2; roundRect(ctx, x + 2, y + 2, T - 4, T - 4, 8); ctx.stroke();
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function background(ctx, w, h, t, layer) {
    var g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.8);
    g.addColorStop(0, layer ? '#1c1b4a' : '#1d3a46'); g.addColorStop(1, '#070b1c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    stars.forEach(function (s) { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + s.p); ctx.fillStyle = '#cfe'; ctx.fillRect(s.x % w, s.y % h, s.r, s.r); });
    ctx.globalAlpha = 1;
  }

  function glow(ctx, x, y, r, color, a) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
  }

  function drawFirefly(ctx, s, t) {
    var p = L.entityPos(s.player), x = (p.x + 0.5) * T, y = (p.y + 0.5) * T;
    glow(ctx, x, y, 46, '#ffe36a', 0.7 + 0.2 * Math.sin(t * 8));
    var flap = Math.sin(t * 40) * 0.5, ang = s.player.dir >= 0 ? s.player.dir * Math.PI / 2 : 0;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(200,240,255,0.55)';
    ctx.beginPath(); ctx.ellipse(-5, -9, 14, 6, -0.6 + flap, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -9, 14, 6, 0.6 - flap, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 10, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.ellipse(0, 6, 6, 7, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, -4, 2, 0, 6.3); ctx.arc(3, -4, 2, 0, 6.3); ctx.fill();
    ctx.restore();
    if (Math.random() < 0.5) particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life: 0.6, max: 0.6, c: '#ffe36a', r: 2 });
  }

  var WCOL = ['#ff5d73', '#ff9f43', '#5ad6ff', '#c58bff'];
  function drawWisp(ctx, s, w, t) {
    if (w.state === 'wait' && s.mode === 'ready') { /* still draw at spawn */ }
    var p = L.entityPos(w), x = (p.x + 0.5) * T, y = (p.y + 0.5) * T;
    var scared = w.scared, eaten = w.state === 'eaten';
    var flash = scared && s.frightTimer < 2 && Math.floor(t * 8) % 2;
    if (!eaten) {
      var col = scared ? (flash ? '#ffffff' : '#4a5bff') : WCOL[w.id];
      glow(ctx, x, y, 34, col, 0.5);
      ctx.fillStyle = scared ? col : '#1a1230'; ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x - 13, y + 13);
      for (var k = 0; k < 4; k++) ctx.quadraticCurveTo(x - 13 + k * 6.5 + 3.25, y + 13 + Math.sin(t * 10 + k) * 5 + 4, x - 13 + (k + 1) * 6.5, y + 13);
      ctx.lineTo(x + 13, y - 2); ctx.arc(x, y - 2, 13, 0, Math.PI, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    var look = w.dir >= 0 ? L.DIRS[w.dir] : { x: 0, y: 0 };
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 5, y - 3, 4.2, 0, 6.3); ctx.arc(x + 5, y - 3, 4.2, 0, 6.3); ctx.fill();
    ctx.fillStyle = scared && !eaten ? '#ff3' : '#111';
    ctx.beginPath(); ctx.arc(x - 5 + look.x * 1.8, y - 3 + look.y * 1.8, 2, 0, 6.3); ctx.arc(x + 5 + look.x * 1.8, y - 3 + look.y * 1.8, 2, 0, 6.3); ctx.fill();
  }

  function burst(x, y, color, n, spd) {
    for (var i = 0; i < n; i++) { var a = Math.random() * 6.3, v = (0.3 + Math.random()) * spd;
      particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7, max: 0.7, c: color, r: 2 + Math.random() * 2 }); }
  }
  function onEvent(e) {
    var x = ((e.c || 0) + 0.5) * T, y = ((e.r || 0) + 0.5) * T;
    if (e.t === 'dew') burst(x, y, '#aef', 4, 50);
    else if (e.t === 'lantern') { burst(x, y, '#ffe36a', 24, 140); }
    else if (e.t === 'eatWisp') { burst(x, y, '#7bf', 20, 160); floaters.push({ x: x, y: y, text: String(100 * Math.pow(2, e.chain)), life: 1 }); }
    else if (e.t === 'crush') { burst(x, y, '#5f5', 30, 200); shake = 0.4; floaters.push({ x: x, y: y, text: 'CRUSH +500', life: 1.2 }); }
    else if (e.t === 'shift') shake = 0.25;
    else if (e.t === 'death') { burst(x, y, '#ffe36a', 40, 220); shake = 0.5; }
    else if (e.t === 'squeeze') burst(x, y, '#9f9', 10, 90);
  }

  function draw(canvas, s, dt, t) {
    var ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    ctx.save();
    if (shake > 0) { shake -= dt; ctx.translate((Math.random() - 0.5) * shake * 18, (Math.random() - 0.5) * shake * 18); }
    background(ctx, w, h, t, s.layer);
    var warn = s.shiftWarn && s.mode === 'playing';
    for (var r = 0; r < L.H; r++) for (var c = 0; c < L.W; c++) {
      var ch = L.MAP[r].charAt(c);
      if (L.isWall(s.layer, c, r)) {
        drawHedge(ctx, c, r, s.layer, warn && false, t);
      } else if (ch === 'A' || ch === 'B') {
        // floor that will become hedge: telegraph
        if (warn && ((ch === 'A' && s.layer === 1) || (ch === 'B' && s.layer === 0))) {
          ctx.fillStyle = 'rgba(255,120,80,' + (0.25 + 0.2 * Math.sin(t * 14)) + ')'; ctx.fillRect(c * T + 3, r * T + 3, T - 6, T - 6);
        } else { ctx.fillStyle = 'rgba(160,255,200,0.07)'; ctx.fillRect(c * T + 3, r * T + 3, T - 6, T - 6); }
      }
      // ghost outline of the other layer's hedge on shifting cells
      if (!L.isWall(s.layer, c, r) && (ch === 'A' || ch === 'B')) {
        ctx.strokeStyle = 'rgba(120,255,160,0.35)'; ctx.setLineDash([4, 4]); ctx.strokeRect(c * T + 4, r * T + 4, T - 8, T - 8); ctx.setLineDash([]);
      }
    }
    // pellets
    Object.keys(s.pellets).forEach(function (k) {
      var c = k % L.W, r = Math.floor(k / L.W);
      if (L.isWall(s.layer, c, r)) return;
      var x = (c + 0.5) * T, y = (r + 0.5) * T;
      if (s.pellets[k] === 2) { glow(ctx, x, y, 22, '#ffe9a0', 0.8 + 0.2 * Math.sin(t * 6)); ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(x, y, 7 + Math.sin(t * 6), 0, 6.3); ctx.fill(); }
      else { glow(ctx, x, y, 10, '#9fe8ff', 0.8); ctx.fillStyle = '#e6fbff'; ctx.beginPath(); ctx.arc(x, y, 2.8, 0, 6.3); ctx.fill(); }
    });
    s.wisps.forEach(function (wi) { drawWisp(ctx, s, wi, t); });
    if (s.mode !== 'dying' || s.deadTimer > 0.7) drawFirefly(ctx, s, t);
    // particles
    particles = particles.filter(function (p) { p.life -= dt; return p.life > 0; });
    particles.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill(); });
    ctx.globalAlpha = 1;
    floaters = floaters.filter(function (f) { f.life -= dt; return f.life > 0; });
    ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'center';
    floaters.forEach(function (f) { f.y -= 25 * dt; ctx.globalAlpha = Math.min(1, f.life); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y); });
    ctx.globalAlpha = 1;
    // vignette
    var v = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,10,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    if (warn) { ctx.fillStyle = 'rgba(255,140,80,' + (0.06 + 0.05 * Math.sin(t * 14)) + ')'; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
  }

  HG.Render = { size: size, draw: draw, onEvent: onEvent };
})(typeof window !== 'undefined' ? window : globalThis);
