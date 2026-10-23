(function (global) {
  'use strict';
  var FW = global.FW, L = FW.Logic, TS = 56, W = L.W, H = L.H, T = L.T;
  var parts = [], floats = [], last = 0, texCache = null;
  var PAL = { floorA: '#2a2f3d', floorB: '#262b38', wall: '#4b5468', wallHi: '#7a859c', brass: '#d9a441', crate: '#a8692f',
    crateDk: '#6e3f18', fire: '#ffb347', fire2: '#ff5a2a', prism: '#7ae6ff', prism2: '#c58bff' };

  function ctxOf(c) { return c.getContext('2d'); }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  function floorTex() {
    if (texCache) return texCache;
    var c = document.createElement('canvas'); c.width = W * TS; c.height = H * TS; var g = ctxOf(c);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      g.fillStyle = (x + y) % 2 ? PAL.floorA : PAL.floorB; g.fillRect(x * TS, y * TS, TS, TS);
      g.strokeStyle = '#ffffff0b'; g.strokeRect(x * TS + .5, y * TS + .5, TS - 1, TS - 1);
      g.fillStyle = '#0003'; [[6, 6], [TS - 6, 6], [6, TS - 6], [TS - 6, TS - 6]].forEach(function (p) {
        g.beginPath(); g.arc(x * TS + p[0], y * TS + p[1], 1.6, 0, 7); g.fill(); });
    }
    texCache = c; return c;
  }

  function wall(g, x, y) {
    var px = x * TS, py = y * TS, gr = g.createLinearGradient(px, py, px, py + TS);
    gr.addColorStop(0, PAL.wallHi); gr.addColorStop(.12, PAL.wall); gr.addColorStop(1, '#2a3040');
    g.fillStyle = '#10131b'; g.fillRect(px, py + 5, TS, TS - 5);
    g.fillStyle = gr; rr(g, px + 1, py + 1, TS - 2, TS - 6, 6); g.fill();
    g.strokeStyle = '#0006'; g.strokeRect(px + 7.5, py + 7.5, TS - 15, TS - 20);
    g.fillStyle = '#d8dff0aa';
    [[8, 8], [TS - 8, 8], [8, TS - 13], [TS - 8, TS - 13]].forEach(function (p) { g.beginPath(); g.arc(px + p[0], py + p[1], 2, 0, 7); g.fill(); });
  }
  function crate(g, x, y, t) {
    var px = x * TS + 3, py = y * TS + 3, s = TS - 6;
    g.fillStyle = '#0006'; g.fillRect(px + 2, py + s - 2, s, 6);
    var gr = g.createLinearGradient(px, py, px + s, py + s);
    gr.addColorStop(0, '#c88542'); gr.addColorStop(1, PAL.crateDk);
    g.fillStyle = gr; rr(g, px, py, s, s, 5); g.fill();
    g.strokeStyle = PAL.brass; g.lineWidth = 3; g.strokeRect(px + 4, py + 4, s - 8, s - 8);
    g.beginPath(); g.moveTo(px + 4, py + 4); g.lineTo(px + s - 4, py + s - 4); g.moveTo(px + s - 4, py + 4); g.lineTo(px + 4, py + s - 4);
    g.strokeStyle = '#3a200a99'; g.lineWidth = 2; g.stroke();
    g.fillStyle = PAL.brass; g.beginPath(); g.arc(px + s / 2, py + s / 2, 4, 0, 7); g.fill(); g.lineWidth = 1;
  }
  function prism(g, x, y, tile, t) {
    var cx = x * TS + TS / 2, cy = y * TS + TS / 2, pulse = .6 + .4 * Math.sin(t * 3 + x + y);
    var glow = g.createRadialGradient(cx, cy, 2, cx, cy, TS * .8);
    glow.addColorStop(0, 'rgba(122,230,255,' + (.35 * pulse) + ')'); glow.addColorStop(1, 'rgba(122,230,255,0)');
    g.fillStyle = glow; g.fillRect(x * TS - 10, y * TS - 10, TS + 20, TS + 20);
    g.fillStyle = '#141a28'; rr(g, x * TS + 4, y * TS + 4, TS - 8, TS - 8, 8); g.fill();
    g.strokeStyle = PAL.brass; g.lineWidth = 2; rr(g, x * TS + 4, y * TS + 4, TS - 8, TS - 8, 8); g.stroke();
    var a = tile === T.PRISM_A, gr = g.createLinearGradient(cx - 18, cy - 18, cx + 18, cy + 18);
    gr.addColorStop(0, PAL.prism); gr.addColorStop(.5, '#ffffff'); gr.addColorStop(1, PAL.prism2);
    g.fillStyle = gr; g.beginPath();
    if (a) { g.moveTo(cx - 16, cy + 16); g.lineTo(cx + 16, cy - 16); g.lineTo(cx + 20, cy - 12); g.lineTo(cx - 12, cy + 20); }
    else { g.moveTo(cx - 16, cy - 16); g.lineTo(cx + 16, cy + 16); g.lineTo(cx + 12, cy + 20); g.lineTo(cx - 20, cy - 12); }
    g.closePath(); g.fill(); g.lineWidth = 1;
  }
  function bomb(g, b, t) {
    var cx = b.x * TS + TS / 2, cy = b.y * TS + TS / 2 + 3, urgency = 1 - b.fuse / L.FUSE;
    var sc = 1 + .07 * Math.sin(t * (6 + urgency * 22));
    g.save(); g.translate(cx, cy); g.scale(sc, sc);
    g.fillStyle = '#0005'; g.beginPath(); g.ellipse(0, 15, 15, 5, 0, 0, 7); g.fill();
    var gr = g.createRadialGradient(-6, -7, 2, 0, 0, 19); gr.addColorStop(0, '#6a7490'); gr.addColorStop(1, '#10131c');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 17, 0, 7); g.fill();
    g.strokeStyle = PAL.brass; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 17, -.6, .9); g.stroke();
    g.fillStyle = urgency > .6 && Math.floor(t * 10) % 2 ? '#ff4d3a' : PAL.brass; g.fillRect(-4, -23, 8, 8);
    g.strokeStyle = '#c9b48a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -23); g.quadraticCurveTo(7, -29, 12, -26); g.stroke();
    g.fillStyle = '#fff2a8'; g.beginPath(); g.arc(12, -26, 3 + Math.random() * 2, 0, 7); g.fill();
    g.restore();
  }
  function flame(g, f, t) {
    var a = Math.max(0, f.t / L.FLAME), cx0 = f.x * TS + TS / 2, cy0 = f.y * TS + TS / 2;
    f.cells.forEach(function (c) {
      var cx = c.x * TS + TS / 2, cy = c.y * TS + TS / 2, r = TS * (.55 + .2 * a);
      var gr = g.createRadialGradient(cx, cy, 2, cx, cy, r);
      gr.addColorStop(0, 'rgba(255,255,230,' + a + ')'); gr.addColorStop(.35, 'rgba(255,190,70,' + a * .95 + ')');
      gr.addColorStop(1, 'rgba(255,70,30,0)');
      g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    });
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    f.segments.forEach(function (s) {
      g.strokeStyle = 'rgba(255,200,90,' + a * .6 + ')'; g.lineWidth = 22 * a + 4;
      g.beginPath(); g.moveTo(s[0] * TS + TS / 2, s[1] * TS + TS / 2); g.lineTo(s[2] * TS + TS / 2, s[3] * TS + TS / 2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,' + a + ')'; g.lineWidth = 8 * a + 1; g.stroke();
    });
    f.bends.forEach(function (b) {
      var r = TS * (1.1 - .3 * a), gr2 = g.createRadialGradient(b.x * TS + TS / 2, b.y * TS + TS / 2, 2, b.x * TS + TS / 2, b.y * TS + TS / 2, r);
      gr2.addColorStop(0, 'rgba(160,240,255,' + a + ')'); gr2.addColorStop(1, 'rgba(120,120,255,0)');
      g.fillStyle = gr2; g.fillRect(b.x * TS + TS / 2 - r, b.y * TS + TS / 2 - r, r * 2, r * 2);
    });
    g.restore();
  }
  function actor(g, a, t, hero, s) {
    var x = a.fx * TS + TS / 2, y = a.fy * TS + TS / 2, bob = Math.sin(t * 14 + a.fx * 3 + a.fy * 3) * (a.moving ? 2 : .6);
    if (!a.alive && !hero) { var k = Math.max(0, a.dead / .5); if (k <= 0) return; g.globalAlpha = k; }
    if (hero && s.invuln > 0 && Math.floor(t * 14) % 2) g.globalAlpha = .4;
    g.save(); g.translate(x, y + bob);
    g.fillStyle = '#0005'; g.beginPath(); g.ellipse(0, 18 - bob, 15, 5, 0, 0, 7); g.fill();
    var body = hero ? '#3fd0c9' : a.type === 'wander' ? '#d96a4a' : a.type === 'chaser' ? '#c24bd6' : '#e8c23a';
    var gr = g.createLinearGradient(0, -18, 0, 16); gr.addColorStop(0, hero ? '#9ff5ee' : '#ffffff55'); gr.addColorStop(.15, body); gr.addColorStop(1, '#0006');
    g.fillStyle = body; rr(g, -15, -14, 30, 30, 10); g.fill(); g.fillStyle = gr; rr(g, -15, -14, 30, 30, 10); g.fill();
    g.fillStyle = '#10131c'; rr(g, -11, -9, 22, 13, 5); g.fill();
    var d = L.DIRS[a.dir || 3], ex = d[0] * 2, ey = d[1] * 1.5;
    g.fillStyle = hero ? '#bfffff' : '#ff6a5a';
    g.fillRect(-7 + ex, -5 + ey, 4, 5); g.fillRect(3 + ex, -5 + ey, 4, 5);
    g.strokeStyle = PAL.brass; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -14); g.lineTo(0, -21); g.stroke();
    g.fillStyle = hero ? PAL.brass : '#fff'; g.beginPath(); g.arc(0, -22, 3, 0, 7); g.fill();
    if (!hero && a.type === 'bomber') { g.fillStyle = '#10131c'; g.fillRect(-9, 7, 18, 5); g.fillStyle = '#ff4d3a'; g.fillRect(-2, 7, 4, 5); }
    if (!hero && a.type === 'chaser') { g.fillStyle = '#10131c'; g.fillRect(-13, 8, 8, 5); g.fillRect(5, 8, 8, 5); }
    g.restore(); g.globalAlpha = 1;
  }
  function pickup(g, p, t) {
    if (p.hidden > 0) return;
    var cx = p.x * TS + TS / 2, cy = p.y * TS + TS / 2 + Math.sin(t * 4 + p.x) * 3, col = p.kind === 'range' ? '#ff7a45' : p.kind === 'bomb' ? '#9ab7ff' : '#7dff8c';
    g.fillStyle = col + '44'; g.beginPath(); g.arc(cx, cy, 20, 0, 7); g.fill();
    g.fillStyle = '#141a28'; g.beginPath(); g.arc(cx, cy, 14, 0, 7); g.fill(); g.strokeStyle = col; g.lineWidth = 3; g.stroke(); g.lineWidth = 1;
    g.fillStyle = col; g.font = '800 15px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(p.kind === 'range' ? '✹' : p.kind === 'bomb' ? '●' : '»', cx, cy + 1);
  }

  function burst(x, y, n, cols, spd) {
    for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = (.3 + Math.random()) * spd;
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: .5 + Math.random() * .6, max: 1.1, c: cols[i % cols.length], r: 2 + Math.random() * 3 }); }
  }
  function float(x, y, text, color) { floats.push({ x: x, y: y, text: text, c: color || '#fff', t: 1.1 }); }

  function consume(s) {
    s.events.forEach(function (e) {
      if (e.type === 'boom') burst(e.x * TS + TS / 2, e.y * TS + TS / 2, 26, ['#ffd27a', '#ff7a2a', '#fff'], 220);
      else if (e.type === 'crate') burst(e.x * TS + TS / 2, e.y * TS + TS / 2, 14, ['#c88542', '#6e3f18', '#d9a441'], 150);
      else if (e.type === 'kill') { burst(e.x * TS + TS / 2, e.y * TS + TS / 2, 24, ['#fff', '#ffe08a', '#ff6a5a'], 200); float(e.x * TS + TS / 2, e.y * TS, '+' + L.ENEMY[e.kind].pts); }
      else if (e.type === 'multi') float(6.5 * TS, 5 * TS, e.n + 'x MULTI-KILL!', '#ffd24a');
      else if (e.type === 'chain') float(6.5 * TS, 4 * TS, 'CHAIN x' + e.n, '#7ae6ff');
      else if (e.type === 'bend') float(6.5 * TS, 6 * TS, 'PRISM BEND!', '#c58bff');
      else if (e.type === 'hurt') burst(s.player.fx * TS + TS / 2, s.player.fy * TS + TS / 2, 30, ['#9ff5ee', '#fff'], 240);
    });
  }

  function view(canvas) { return { s: Math.min(canvas.width / (W * TS), canvas.height / (H * TS)) }; }

  function draw(canvas, s, time) {
    var g = ctxOf(canvas), dt = Math.min(.05, time - last); last = time; if (dt < 0) dt = 0;
    var sc = Math.min(canvas.width / (W * TS), canvas.height / (H * TS));
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#090c14'; g.fillRect(0, 0, canvas.width, canvas.height);
    var ox = (canvas.width - W * TS * sc) / 2, oy = (canvas.height - H * TS * sc) / 2;
    var sh = s.shake * 6; g.translate(ox + (Math.random() - .5) * sh, oy + (Math.random() - .5) * sh); g.scale(sc, sc);
    consume(s);
    g.drawImage(floorTex(), 0, 0);
    var x, y;
    s.pickups.forEach(function (p) { pickup(g, p, time); });
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var t = s.grid[y * W + x];
      if (t === T.WALL) wall(g, x, y); else if (t === T.CRATE) crate(g, x, y, time); else if (t === T.PRISM_A || t === T.PRISM_B) prism(g, x, y, t, time);
    }
    s.bombs.forEach(function (b) { bomb(g, b, time); });
    s.enemies.forEach(function (e) { actor(g, e, time, false, s); });
    if (s.player.alive) actor(g, s.player, time, true, s);
    s.flames.forEach(function (f) { flame(g, f, time); });
    parts = parts.filter(function (p) { p.life -= dt; return p.life > 0; });
    parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); });
    g.globalAlpha = 1;
    floats = floats.filter(function (f) { f.t -= dt; return f.t > 0; });
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 22px system-ui,sans-serif';
    floats.forEach(function (f) { g.globalAlpha = Math.min(1, f.t * 2); g.lineWidth = 4; g.strokeStyle = '#000a'; g.strokeText(f.text, f.x, f.y - (1.1 - f.t) * 36); g.fillStyle = f.c; g.fillText(f.text, f.x, f.y - (1.1 - f.t) * 36); });
    g.globalAlpha = 1;
    var vg = g.createRadialGradient(W * TS / 2, H * TS / 2, H * TS * .35, W * TS / 2, H * TS / 2, W * TS * .62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = vg; g.fillRect(0, 0, W * TS, H * TS);
    if (s.timeLeft < 20 && s.phase === 'play') { g.fillStyle = 'rgba(255,40,20,' + (.06 + .06 * Math.sin(time * 8)) + ')'; g.fillRect(0, 0, W * TS, H * TS); }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  FW.Render = { draw: draw, view: view, TS: TS };
})(window);
