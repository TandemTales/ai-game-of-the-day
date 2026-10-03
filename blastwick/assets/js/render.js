/* Blastwick - procedural canvas renderer, sprite baking, particles. */
(function (root) {
  'use strict';
  var BW = root.BW = root.BW || {};
  var C = BW.C, W = BW.W, H = BW.H;

  var COLORS = [
    { body: '#46b6ff', dark: '#1d6fb8', light: '#b8e6ff' },   // player: azure
    { body: '#ff5a6e', dark: '#b3243a', light: '#ffc2ca' },   // rival: crimson
    { body: '#ffc247', dark: '#b9780f', light: '#fff0b8' },   // rival: amber
    { body: '#8be05a', dark: '#3f8a22', light: '#d8ffc0' }    // rival: moss
  ];
  BW.COLORS = COLORS;

  var R = BW.Render = {
    T: 48, ox: 0, oy: 0, spr: {}, parts: [], texts: [], shake: 0, flash: 0, time: 0, rings: []
  };

  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function noise(g, T, n, a, seed) {
    var s = seed || 1;
    for (var i = 0; i < n; i++) {
      s = (s * 16807) % 2147483647;
      var x = (s % 1000) / 1000 * T; s = (s * 16807) % 2147483647;
      var y = (s % 1000) / 1000 * T;
      g.fillStyle = 'rgba(' + (s % 2 ? '255,255,255' : '0,0,0') + ',' + a + ')';
      g.fillRect(x, y, 1.5, 1.5);
    }
  }

  function bake(T) {
    var S = R.spr = {}, g, c, i, grad;
    // floor tiles (two variants for checker)
    for (i = 0; i < 2; i++) {
      c = mk(T, T); g = c.getContext('2d');
      grad = g.createLinearGradient(0, 0, T, T);
      grad.addColorStop(0, i ? '#2a2f4a' : '#262b45'); grad.addColorStop(1, i ? '#222640' : '#1f233b');
      g.fillStyle = grad; g.fillRect(0, 0, T, T);
      g.strokeStyle = 'rgba(120,150,255,0.10)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, T - 1, T - 1);
      g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(2, 2, T - 4, 2);
      noise(g, T, 26, 0.05, 7 + i);
      S['floor' + i] = c;
    }
    // hard wall: steel block with bevel and rivets
    c = mk(T, T); g = c.getContext('2d');
    grad = g.createLinearGradient(0, 0, 0, T); grad.addColorStop(0, '#7d86a8'); grad.addColorStop(1, '#4b5373');
    g.fillStyle = grad; rr(g, 1, 1, T - 2, T - 2, T * 0.1); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(3, 3, T - 6, T * 0.08);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(3, T - 3 - T * 0.1, T - 6, T * 0.1);
    g.strokeStyle = 'rgba(20,24,44,0.7)'; g.lineWidth = 1.5; rr(g, 1, 1, T - 2, T - 2, T * 0.1); g.stroke();
    g.strokeStyle = 'rgba(20,24,44,0.4)'; g.beginPath(); g.moveTo(T * 0.2, T * 0.5); g.lineTo(T * 0.8, T * 0.5); g.moveTo(T * 0.5, T * 0.2); g.lineTo(T * 0.5, T * 0.8); g.stroke();
    [[0.16, 0.16], [0.84, 0.16], [0.16, 0.84], [0.84, 0.84]].forEach(function (p) {
      g.fillStyle = '#c3cae6'; g.beginPath(); g.arc(p[0] * T, p[1] * T, T * 0.04, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(p[0] * T + 1, p[1] * T + 1, T * 0.03, 0, 6.3); g.fill();
    });
    noise(g, T, 40, 0.06, 3);
    S.wall = c;
    // crate
    c = mk(T, T); g = c.getContext('2d');
    grad = g.createLinearGradient(0, 0, 0, T); grad.addColorStop(0, '#c98b4a'); grad.addColorStop(1, '#8f5a2a');
    g.fillStyle = grad; rr(g, 2, 2, T - 4, T - 4, 4); g.fill();
    g.strokeStyle = 'rgba(60,30,10,0.55)'; g.lineWidth = 1;
    for (i = 1; i < 4; i++) { g.beginPath(); g.moveTo(3, i * T / 4); g.lineTo(T - 3, i * T / 4); g.stroke(); }
    g.strokeStyle = '#5b3516'; g.lineWidth = Math.max(3, T * 0.09); rr(g, 3, 3, T - 6, T - 6, 3); g.stroke();
    g.beginPath(); g.moveTo(5, 5); g.lineTo(T - 5, T - 5); g.moveTo(T - 5, 5); g.lineTo(5, T - 5); g.stroke();
    g.fillStyle = 'rgba(255,230,180,0.25)'; g.fillRect(4, 4, T - 8, 2);
    noise(g, T, 50, 0.07, 11);
    S.crate = c;
    // mirrors, two orientations
    [C.MIRROR_A, C.MIRROR_B].forEach(function (kind) {
      var m = mk(T, T), g2 = m.getContext('2d'), p = T * 0.12;
      // pedestal
      g2.fillStyle = '#1a1f38'; rr(g2, p * 0.5, p * 0.5, T - p, T - p, 6); g2.fill();
      g2.strokeStyle = 'rgba(120,230,255,0.5)'; g2.lineWidth = 1.5; rr(g2, p * 0.5, p * 0.5, T - p, T - p, 6); g2.stroke();
      // crystal slab along the diagonal
      var a = kind === C.MIRROR_A ? [T - p, p, p, T - p] : [p, p, T - p, T - p];
      g2.save();
      g2.shadowColor = '#5ff4ff'; g2.shadowBlur = T * 0.3;
      var lg = g2.createLinearGradient(a[0], a[1], a[2], a[3]);
      lg.addColorStop(0, '#e8ffff'); lg.addColorStop(0.5, '#6fe8ff'); lg.addColorStop(1, '#c78bff');
      g2.strokeStyle = lg; g2.lineWidth = T * 0.2; g2.lineCap = 'round';
      g2.beginPath(); g2.moveTo(a[0], a[1]); g2.lineTo(a[2], a[3]); g2.stroke();
      g2.restore();
      g2.strokeStyle = 'rgba(255,255,255,0.85)'; g2.lineWidth = T * 0.04; g2.lineCap = 'round';
      g2.beginPath(); g2.moveTo(a[0] + (a[2] - a[0]) * 0.2, a[1] + (a[3] - a[1]) * 0.2 - T * 0.04); g2.lineTo(a[0] + (a[2] - a[0]) * 0.5, a[1] + (a[3] - a[1]) * 0.5 - T * 0.04); g2.stroke();
      S['mirror' + kind] = m;
    });
    // bomb
    c = mk(T, T); g = c.getContext('2d');
    var rad = T * 0.34, cx = T / 2, cy = T * 0.58;
    grad = g.createRadialGradient(cx - rad * 0.4, cy - rad * 0.4, rad * 0.1, cx, cy, rad);
    grad.addColorStop(0, '#6b7390'); grad.addColorStop(0.5, '#262b40'); grad.addColorStop(1, '#0b0d18');
    g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, rad, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.ellipse(cx - rad * 0.4, cy - rad * 0.45, rad * 0.22, rad * 0.12, -0.6, 0, 6.3); g.fill();
    g.fillStyle = '#9aa3c4'; rr(g, cx - rad * 0.28, cy - rad * 1.18, rad * 0.56, rad * 0.3, 3); g.fill();
    S.bomb = c;
    // shadow
    c = mk(T, T); g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.38)'; g.beginPath(); g.ellipse(T / 2, T * 0.82, T * 0.3, T * 0.12, 0, 0, 6.3); g.fill();
    S.shadow = c;
    // glow sprite
    c = mk(64, 64); g = c.getContext('2d');
    grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    S.glow = c;
    // powerup icons
    var PU = { bomb: ['#ffd23f', 'B'], range: ['#ff7a3d', 'R'], speed: ['#5fe3ff', 'S'], shield: ['#c78bff', '◆'] };
    Object.keys(PU).forEach(function (k) {
      var u = mk(T, T), g3 = u.getContext('2d');
      g3.shadowColor = PU[k][0]; g3.shadowBlur = T * 0.25;
      g3.fillStyle = '#12162a'; g3.beginPath(); g3.arc(T / 2, T / 2, T * 0.32, 0, 6.3); g3.fill();
      g3.lineWidth = T * 0.07; g3.strokeStyle = PU[k][0]; g3.stroke();
      g3.shadowBlur = 0; g3.fillStyle = PU[k][0]; g3.font = '900 ' + Math.round(T * 0.36) + 'px system-ui,sans-serif';
      g3.textAlign = 'center'; g3.textBaseline = 'middle'; g3.fillText(PU[k][1], T / 2, T / 2 + 1);
      S['pu_' + k] = u;
    });
  }

  R.resize = function (canvas) {
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(cw * dpr)); canvas.height = Math.max(1, Math.round(ch * dpr));
    var T = Math.max(16, Math.floor(Math.min(canvas.width / W, canvas.height / H)));
    R.T = T; R.ox = Math.floor((canvas.width - T * W) / 2); R.oy = Math.floor((canvas.height - T * H) / 2);
    bake(T);
  };

  /* -------- particles -------- */
  function spark(x, y, col, n, spd, life, size) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, s = spd * (0.3 + Math.random());
      R.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), max: life, col: col, size: size * (0.5 + Math.random()), kind: 'spark', g: 0 });
    }
  }
  R.onEvents = function (events, world) {
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.type === 'explode') {
        for (var k = 0; k < e.cells.length; k++) {
          var cc = e.cells[k];
          spark(cc.x + 0.5, cc.y + 0.5, cc.ref ? '#7ff6ff' : '#ffb347', 3, 3.2, 0.7, 0.07);
          if (Math.random() < 0.5) R.parts.push({ x: cc.x + 0.5, y: cc.y + 0.5, vx: (Math.random() - 0.5) * 0.6, vy: -0.3 - Math.random() * 0.6, life: 1.1, max: 1.1, col: '#555', size: 0.35, kind: 'smoke', g: 0 });
        }
        R.shake = Math.min(1, R.shake + 0.35 + e.cells.length * 0.01);
        if (e.ref) R.flash = 0.35;
      } else if (e.type === 'bounce') {
        // ring is spawned per mirror cell below
      } else if (e.type === 'crate') {
        spark(e.x + 0.5, e.y + 0.5, '#c98b4a', 10, 4, 0.8, 0.1);
        spark(e.x + 0.5, e.y + 0.5, '#8f5a2a', 6, 3, 0.8, 0.12);
      } else if (e.type === 'death') {
        spark(e.x, e.y, COLORS[e.id].body, 26, 5, 1.1, 0.1);
        spark(e.x, e.y, '#fff', 10, 6, 0.5, 0.06);
        R.shake = 1;
        if (e.points) R.texts.push({ x: e.x, y: e.y - 0.4, t: 0, text: '+' + e.points + (e.bank ? ' BANK SHOT!' : (e.chain > 2 ? ' CHAIN x' + e.chain : '')), col: e.bank ? '#7ff6ff' : '#ffe27a' });
      } else if (e.type === 'pickup') {
        spark(e.x + 0.5, e.y + 0.5, '#fff', 12, 3, 0.6, 0.06);
        R.texts.push({ x: e.x + 0.5, y: e.y, t: 0, text: e.kind.toUpperCase() + '+', col: '#fff' });
      } else if (e.type === 'collapse') {
        spark(e.x + 0.5, e.y + 0.5, '#9aa3c4', 14, 3, 0.8, 0.1); R.shake = Math.min(1, R.shake + 0.2);
      } else if (e.type === 'place') {
        R.rings.push({ x: e.x + 0.5, y: e.y + 0.5, t: 0, col: '#ffffff', r: 0.5 });
      }
      if (e.type === 'explode' && e.ref) {
        for (var m = 0; m < e.cells.length; m++) if (e.cells[m].mirror) R.rings.push({ x: e.cells[m].x + 0.5, y: e.cells[m].y + 0.5, t: 0, col: '#7ff6ff', r: 1.1 });
      }
    }
  };

  R.update = function (dt) {
    R.time += dt; R.shake = Math.max(0, R.shake - dt * 2.4); R.flash = Math.max(0, R.flash - dt * 1.6);
    var i, p;
    for (i = R.parts.length - 1; i >= 0; i--) {
      p = R.parts[i]; p.life -= dt;
      if (p.life <= 0) { R.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
    }
    for (i = R.texts.length - 1; i >= 0; i--) { R.texts[i].t += dt; if (R.texts[i].t > 1.4) R.texts.splice(i, 1); }
    for (i = R.rings.length - 1; i >= 0; i--) { R.rings[i].t += dt; if (R.rings[i].t > 0.5) R.rings.splice(i, 1); }
    if (R.parts.length > 700) R.parts.splice(0, R.parts.length - 700);
  };

  function drawActor(g, a, T, time) {
    var x = R.ox + a.x * T, y = R.oy + a.y * T, col = COLORS[a.id];
    if (!a.alive) {
      var k = Math.min(1, a.deadT / 0.6); if (k >= 1) return;
      g.save(); g.globalAlpha = 1 - k; g.translate(x, y); g.rotate(k * 6); g.scale(1 - k * 0.5, 1 - k * 0.5);
      drawBody(g, a, T, col, 0, true); g.restore(); return;
    }
    if (a.invuln > 0 && Math.floor(time * 14) % 2 === 0) g.globalAlpha = 0.45;
    g.drawImage(R.spr.shadow, x - T / 2, y - T * 0.82 + T * 0.3 - T * 0.02 + 0, T, T);
    var bob = a.moving ? Math.abs(Math.sin(a.anim * 2.2)) * T * 0.06 : Math.sin(time * 3 + a.id) * T * 0.012;
    g.save(); g.translate(x, y - bob); drawBody(g, a, T, col, bob, false); g.restore();
    if (a.shield > 0) {
      g.strokeStyle = 'rgba(199,139,255,' + (0.6 + Math.sin(time * 8) * 0.25) + ')'; g.lineWidth = 3;
      g.beginPath(); g.arc(x, y - T * 0.05, T * 0.46, 0, 6.3); g.stroke();
    }
    g.globalAlpha = 1;
  }
  function drawBody(g, a, T, col, bob, dead) {
    var r = T * 0.34;
    // legs
    var step = a.moving ? Math.sin(a.anim * 2.2) * T * 0.07 : 0;
    g.fillStyle = col.dark;
    rr(g, -r * 0.7 + step, r * 0.55, r * 0.55, r * 0.5, 3); g.fill();
    rr(g, r * 0.15 - step, r * 0.55, r * 0.55, r * 0.5, 3); g.fill();
    // body
    var grad = g.createLinearGradient(0, -r, 0, r);
    grad.addColorStop(0, col.light); grad.addColorStop(0.35, col.body); grad.addColorStop(1, col.dark);
    g.fillStyle = grad; rr(g, -r, -r * 1.05, r * 2, r * 1.8, r * 0.7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.5; rr(g, -r, -r * 1.05, r * 2, r * 1.8, r * 0.7); g.stroke();
    // visor
    var ex = a.fx * r * 0.28, ey = a.fy * r * 0.2;
    g.fillStyle = '#101428'; rr(g, -r * 0.78 + ex, -r * 0.55 + ey, r * 1.56, r * 0.8, r * 0.35); g.fill();
    g.fillStyle = dead ? '#ff4' : '#9ff4ff';
    g.shadowColor = '#9ff4ff'; g.shadowBlur = 6;
    g.beginPath(); g.arc(-r * 0.3 + ex, -r * 0.15 + ey, r * 0.13, 0, 6.3); g.arc(r * 0.3 + ex, -r * 0.15 + ey, r * 0.13, 0, 6.3); g.fill();
    g.shadowBlur = 0;
    // antenna with wick spark
    g.strokeStyle = '#ddd'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -r * 1.05); g.lineTo(r * 0.15, -r * 1.5); g.stroke();
    g.fillStyle = a.isPlayer ? '#fff' : col.light; g.beginPath(); g.arc(r * 0.15, -r * 1.55, r * 0.14, 0, 6.3); g.fill();
  }

  R.draw = function (g, w, canvas) {
    var T = R.T, ox = R.ox, oy = R.oy, x, y, i, time = R.time;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    var sh = R.shake * T * 0.18;
    if (sh > 0.1) g.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    // floor + walls
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var c = w.cells[y * W + x], px = ox + x * T, py = oy + y * T;
      if (c === C.WALL) { g.drawImage(R.spr.floor0, px, py); g.drawImage(R.spr.wall, px, py); }
      else g.drawImage(R.spr['floor' + ((x + y) & 1)], px, py);
    }
    // collapse warning
    if (w.t > BW.COLLAPSE_START - 8 && w.state === 'play') {
      g.fillStyle = 'rgba(255,60,60,' + (0.06 + 0.05 * Math.sin(time * 6)) + ')'; g.fillRect(ox, oy, W * T, H * T);
    }
    // powerups
    for (i = 0; i < w.powerups.length; i++) {
      var p = w.powerups[i], bob = Math.sin(time * 4 + i) * T * 0.04;
      g.globalAlpha = 0.85; g.drawImage(R.spr.glow, ox + p.x * T - T * 0.1, oy + p.y * T - T * 0.1 + bob, T * 1.2, T * 1.2); g.globalAlpha = 1;
      g.drawImage(R.spr['pu_' + p.kind], ox + p.x * T, oy + p.y * T + bob);
    }
    // crates + mirrors + bombs + actors, back to front
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        var cc = w.cells[y * W + x];
        if (cc === C.CRATE) g.drawImage(R.spr.crate, ox + x * T, oy + y * T);
        else if (cc === C.MIRROR_A || cc === C.MIRROR_B) {
          g.drawImage(R.spr['mirror' + cc], ox + x * T, oy + y * T);
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25 + 0.2 * Math.sin(time * 3 + x * 1.7 + y);
          g.drawImage(R.spr.glow, ox + x * T - T * 0.2, oy + y * T - T * 0.2, T * 1.4, T * 1.4); g.restore();
        }
      }
      for (i = 0; i < w.bombs.length; i++) if (w.bombs[i].y === y) drawBomb(g, w.bombs[i], T, time);
      for (i = 0; i < w.actors.length; i++) if (Math.floor(w.actors[i].y) === y && w.actors[i].alive) drawActor(g, w.actors[i], T, time);
    }
    for (i = 0; i < w.actors.length; i++) if (!w.actors[i].alive) drawActor(g, w.actors[i], T, time);
    // flames (additive)
    g.save(); g.globalCompositeOperation = 'lighter';
    for (i = 0; i < w.flames.length; i++) {
      var f = w.flames[i], k = f.t / f.max, fx = ox + (f.x + 0.5) * T, fy = oy + (f.y + 0.5) * T;
      var s = T * (1.5 + (1 - k) * 0.4) * (0.85 + 0.15 * Math.sin(time * 40 + i));
      g.globalAlpha = Math.min(1, k * 1.6);
      g.drawImage(tinted(f.ref ? 'cyan' : 'fire'), fx - s / 2, fy - s / 2, s, s);
      g.globalAlpha = Math.min(1, k * 2);
      g.drawImage(R.spr.glow, fx - T * 0.45, fy - T * 0.45, T * 0.9, T * 0.9);
    }
    g.restore();
    // rings, particles, texts
    for (i = 0; i < R.rings.length; i++) {
      var rg = R.rings[i], rk = rg.t / 0.5;
      g.strokeStyle = rg.col; g.globalAlpha = 1 - rk; g.lineWidth = 3;
      g.beginPath(); g.arc(ox + rg.x * T, oy + rg.y * T, T * (0.3 + rk * rg.r), 0, 6.3); g.stroke(); g.globalAlpha = 1;
    }
    for (i = 0; i < R.parts.length; i++) {
      var q = R.parts[i], a = Math.max(0, q.life / q.max);
      if (q.kind === 'smoke') { g.globalAlpha = a * 0.35; g.fillStyle = q.col; g.beginPath(); g.arc(ox + q.x * T, oy + q.y * T, T * q.size * (2 - a), 0, 6.3); g.fill(); }
      else { g.globalAlpha = a; g.fillStyle = q.col; var sz = T * q.size; g.fillRect(ox + q.x * T - sz / 2, oy + q.y * T - sz / 2, sz, sz); }
    }
    g.globalAlpha = 1;
    g.font = '900 ' + Math.round(T * 0.4) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round';
    for (i = 0; i < R.texts.length; i++) {
      var tx = R.texts[i], ta = Math.max(0, 1 - tx.t / 1.4);
      g.globalAlpha = ta; g.lineWidth = 4; g.strokeStyle = '#000'; g.fillStyle = tx.col;
      var yy = oy + (tx.y - tx.t * 0.9) * T; g.strokeText(tx.text, ox + tx.x * T, yy); g.fillText(tx.text, ox + tx.x * T, yy);
    }
    g.globalAlpha = 1;
    // vignette + flash
    g.setTransform(1, 0, 0, 1, 0, 0);
    var vg = vignette(canvas); g.drawImage(vg, 0, 0, canvas.width, canvas.height);
    if (R.flash > 0) { g.fillStyle = 'rgba(127,246,255,' + R.flash * 0.35 + ')'; g.fillRect(0, 0, canvas.width, canvas.height); }
  };

  function drawBomb(g, b, T, time) {
    var cx = R.ox + (b.x + 0.5) * T, cy = R.oy + (b.y + 0.5) * T, k = 1 - b.t / BW.FUSE;
    var pulse = 1 + Math.sin(time * (8 + k * 30)) * (0.04 + k * 0.05);
    g.drawImage(R.spr.shadow, cx - T / 2, cy - T / 2 + T * 0.02, T, T);
    g.save(); g.translate(cx, cy + T * 0.06); g.scale(pulse, pulse); g.translate(-cx, -cy - T * 0.06);
    g.drawImage(R.spr.bomb, cx - T / 2, cy - T / 2);
    if (b.t < 0.7 && Math.floor(time * 18) % 2) { g.globalAlpha = 0.45; g.globalCompositeOperation = 'lighter'; g.drawImage(R.spr.bomb, cx - T / 2, cy - T / 2); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
    g.restore();
    // fuse spark
    var sx = cx + T * 0.05, sy = cy - T * 0.42;
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(R.spr.glow, sx - T * 0.22, sy - T * 0.22, T * 0.44, T * 0.44);
    g.restore();
    g.fillStyle = '#fff'; g.fillRect(sx - 1 + Math.sin(time * 50) * 2, sy - 1 + Math.cos(time * 43) * 2, 2.5, 2.5);
  }

  var tintCache = {}, vigCache = null;
  function tinted(kind) {
    var key = kind + R.T; if (tintCache[key]) return tintCache[key];
    var s = 64, c = mk(s, s), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (kind === 'cyan') { gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.2, '#a8fbff'); gr.addColorStop(0.5, 'rgba(60,200,255,0.65)'); gr.addColorStop(1, 'rgba(120,60,255,0)'); }
    else { gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.2, '#ffd36a'); gr.addColorStop(0.5, 'rgba(255,110,30,0.7)'); gr.addColorStop(1, 'rgba(200,30,0,0)'); }
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    return tintCache[key] = c;
  }
  function vignette(canvas) {
    if (vigCache && vigCache.width === canvas.width && vigCache.height === canvas.height) return vigCache;
    var c = mk(canvas.width, canvas.height), g = c.getContext('2d');
    var gr = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,10,0.55)');
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    return vigCache = c;
  }
  R.resetCaches = function () { tintCache = {}; vigCache = null; };
})(window);
