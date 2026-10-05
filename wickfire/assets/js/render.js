/* WICKFIRE - procedural canvas renderer, particles and screen shake. */
(function (global) {
  'use strict';
  var WF = global.WF = global.WF || {};
  var R = WF.render = {};
  var cv, cx, dpr = 1, vw = 0, vh = 0, ts = 32, bx = 0, by = 0, sprites = null, lit = null, litc = null;
  var parts = [], pops = [], shake = 0, flash = 0;
  var KIND_COL = { range: '#ff7a3d', bombs: '#7fd1ff', speed: '#9dff7a', fuse: '#ffd23d' };
  var KIND_LET = { range: 'R', bombs: 'B', speed: 'S', fuse: 'F' };
  R.hudH = 52; R.reserveBottom = 0;

  R.init = function (canvas) { cv = canvas; cx = cv.getContext('2d'); };
  R.layout = function (w, h, reserveBottom) {
    dpr = Math.min(global.devicePixelRatio || 1, 2.5);
    vw = w; vh = h; R.reserveBottom = reserveBottom || 0;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var availH = h - R.hudH - R.reserveBottom - 6;
    ts = Math.max(12, Math.floor(Math.min((w - 8) / WF.W, availH / WF.H)));
    bx = Math.floor((w - ts * WF.W) / 2); by = R.hudH + Math.floor((availH - ts * WF.H) / 2) + 3;
    buildSprites();
    litc = document.createElement('canvas'); litc.width = Math.ceil(ts * WF.W / 4); litc.height = Math.ceil(ts * WF.H / 4);
    lit = litc.getContext('2d');
  };
  R.geom = function () { return { ts: ts, bx: bx, by: by, w: vw, h: vh }; };

  function rnd(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function buildSprites() {
    var S = Math.round(ts * dpr), r, c, x, i;
    sprites = { floor: [], wall: [], crate: [], S: S };
    for (var v = 0; v < 4; v++) {
      c = mk(S, S); x = c.getContext('2d'); r = rnd(11 + v * 97);
      x.fillStyle = (v % 2) ? '#2a2630' : '#2f2a36'; x.fillRect(0, 0, S, S);
      for (i = 0; i < S * 0.9; i++) { x.fillStyle = 'rgba(' + (r() > 0.5 ? '255,255,255' : '0,0,0') + ',' + (0.03 + r() * 0.05) + ')'; x.fillRect(r() * S, r() * S, 1 + r() * S * 0.08, 1 + r() * S * 0.08); }
      x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = Math.max(1, S * 0.03); x.strokeRect(0.5, 0.5, S - 1, S - 1);
      sprites.floor.push(c);
    }
    for (v = 0; v < 3; v++) {
      c = mk(S, S); x = c.getContext('2d'); r = rnd(500 + v * 31);
      var g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#5b6270'); g.addColorStop(1, '#2e333d');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(0, 0, S, S * 0.08); x.fillRect(0, 0, S * 0.08, S);
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(0, S * 0.92, S, S * 0.08); x.fillRect(S * 0.92, 0, S * 0.08, S);
      for (i = 0; i < 40; i++) { x.fillStyle = 'rgba(0,0,0,' + (0.05 + r() * 0.1) + ')'; x.fillRect(S * 0.1 + r() * S * 0.8, S * 0.1 + r() * S * 0.8, 1 + r() * 3, 1 + r() * 2); }
      x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = Math.max(1, S * 0.025);
      x.beginPath(); x.moveTo(S * 0.15, S * 0.5 + (r() - 0.5) * S * 0.3); x.lineTo(S * 0.5, S * 0.45); x.lineTo(S * 0.85, S * 0.55); x.stroke();
      sprites.wall.push(c);
    }
    for (v = 0; v < 3; v++) {
      c = mk(S, S); x = c.getContext('2d'); r = rnd(900 + v * 13);
      var m = S * 0.07;
      x.fillStyle = '#6b4a2a'; x.fillRect(m, m, S - 2 * m, S - 2 * m);
      for (i = 0; i < 4; i++) {
        var py = m + i * (S - 2 * m) / 4;
        var gg = x.createLinearGradient(0, py, 0, py + (S - 2 * m) / 4);
        gg.addColorStop(0, '#a37445'); gg.addColorStop(1, '#7a5430');
        x.fillStyle = gg; x.fillRect(m, py, S - 2 * m, (S - 2 * m) / 4 - 1);
        for (var k = 0; k < 6; k++) { x.fillStyle = 'rgba(60,35,15,' + (0.1 + r() * 0.15) + ')'; x.fillRect(m + r() * (S - 2 * m), py + r() * S * 0.15, S * 0.1 + r() * S * 0.2, 1); }
      }
      x.strokeStyle = '#3a2a18'; x.lineWidth = Math.max(2, S * 0.06); x.strokeRect(m, m, S - 2 * m, S - 2 * m);
      x.strokeStyle = '#2a2a30'; x.lineWidth = Math.max(2, S * 0.07);
      x.beginPath(); x.moveTo(m, m); x.lineTo(S - m, S - m); x.stroke();
      x.fillStyle = '#9aa0ad';
      [[m, m], [S - m, m], [m, S - m], [S - m, S - m]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], S * 0.05, 0, 7); x.fill(); });
      sprites.crate.push(c);
    }
  }

  /* ---- particles -------------------------------------------------- */
  function burst(x, y, n, col, spd, life, grav, size) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, s = spd * (0.3 + Math.random());
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.7), max: life, col: col, g: grav || 0, sz: (size || 3) * (0.6 + Math.random() * 0.8) });
    }
  }
  R.onEvents = function (evs) {
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i], cxp = e.x + 0.5, cyp = e.y + 0.5;
      if (e.type === 'boom') { shake = Math.min(1, shake + 0.45); flash = 0.35; burst(cxp, cyp, 26, '#ffb347', 6, 0.6, 2, 3); burst(cxp, cyp, 10, '#ff4d2e', 4, 0.8, 0, 5); }
      else if (e.type === 'crate') burst(cxp, cyp, 14, '#a37445', 5, 0.7, 14, 3);
      else if (e.type === 'spark') burst(cxp, cyp, 3, '#ffe28a', 3, 0.35, 0, 2);
      else if (e.type === 'kill') { burst(cxp, cyp, 20, '#b6ff6a', 5, 0.7, 6, 3.5); pops.push({ x: cxp, y: cyp, text: '+', t: 0 }); }
      else if (e.type === 'death') { shake = 1; burst(cxp, cyp, 40, '#ffd7a0', 7, 1, 4, 3.5); }
      else if (e.type === 'pickup') burst(cxp, cyp, 14, KIND_COL[e.kind] || '#fff', 4, 0.6, 0, 3);
      else if (e.type === 'cut') burst(cxp, cyp, 8, '#ffffff', 5, 0.3, 0, 2);
      else if (e.type === 'score') pops.push({ x: 7.5, y: 6.5, text: '+' + e.pts + (e.multi > 1 ? ' x' + e.multi : ''), t: 0 });
      else if (e.type === 'chain') pops.push({ x: 7.5, y: 4.5, text: (e.fuse ? 'FUSE ' : '') + 'CHAIN x' + e.n + '  +' + e.bonus, t: 0, big: true });
    }
  };

  /* ---- drawing ---------------------------------------------------- */
  function px(tx) { return bx + tx * ts; }
  function py(ty) { return by + ty * ts; }
  function lerpPos(e) {
    var p = e.prog >= 1 ? 1 : e.prog < 0 ? 0 : e.prog;
    p = p * p * (3 - 2 * p);
    return { x: e.fx + (e.tx - e.fx) * p, y: e.fy + (e.ty - e.fy) * p };
  }

  function drawBomb(b, now, g) {
    var x = px(b.x) + ts / 2, y = py(b.y) + ts / 2, pulse = 1 + Math.sin(now * (6 + (WF.BOMB_TIME - b.t) * 6)) * 0.07;
    var r = ts * 0.34 * pulse;
    cx.fillStyle = 'rgba(0,0,0,0.35)'; cx.beginPath(); cx.ellipse(x, y + r * 0.9, r * 0.9, r * 0.35, 0, 0, 7); cx.fill();
    var gr = cx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, '#6a6f80'); gr.addColorStop(0.5, '#1e2029'); gr.addColorStop(1, '#07070a');
    cx.fillStyle = gr; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
    cx.strokeStyle = '#8a6a3a'; cx.lineWidth = Math.max(2, ts * 0.07); cx.beginPath(); cx.moveTo(x + r * 0.3, y - r * 0.8); cx.quadraticCurveTo(x + r * 0.7, y - r * 1.3, x + r * 0.5, y - r * 1.6); cx.stroke();
    var fl = (now * 30) % 1;
    cx.fillStyle = fl > 0.5 ? '#fff3a0' : '#ff9a3a'; cx.beginPath(); cx.arc(x + r * 0.5, y - r * 1.6, ts * 0.08 + fl * ts * 0.04, 0, 7); cx.fill();
    if (b.owner === 'e') { cx.strokeStyle = '#ff4d6d'; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y, r + 3, 0, 7); cx.stroke(); }
  }

  function drawFuse(f, now) {
    var ts_ = f.tiles; if (ts_.length < 1) return;
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < ts_.length; i++) {
        var t = ts_[i], x = px(t.x) + ts / 2, y = py(t.y) + ts / 2;
        var prev = ts_[i - 1];
        if (!prev) continue;
        var ax = px(prev.x) + ts / 2, ay = py(prev.y) + ts / 2;
        var burnt = t.state === 2 || prev.state === 2;
        var burning = t.state === 1 || prev.state === 1;
        cx.strokeStyle = pass === 0 ? 'rgba(0,0,0,0.45)' : (burnt ? '#2a2420' : burning ? '#ff8a2a' : (f.detached ? '#c9a15c' : '#e7c27a'));
        cx.lineWidth = pass === 0 ? ts * 0.2 : ts * 0.12;
        cx.beginPath(); cx.moveTo(ax, ay + (pass === 0 ? 2 : 0)); cx.lineTo(x, y + (pass === 0 ? 2 : 0)); cx.stroke();
      }
    }
    for (var j = 0; j < ts_.length; j++) {
      var tt = ts_[j]; if (tt.state !== 1) continue;
      var sx = px(tt.x) + ts / 2, sy = py(tt.y) + ts / 2, k = Math.random();
      var grd = cx.createRadialGradient(sx, sy, 0, sx, sy, ts * 0.6);
      grd.addColorStop(0, 'rgba(255,240,160,0.95)'); grd.addColorStop(0.4, 'rgba(255,140,40,0.6)'); grd.addColorStop(1, 'rgba(255,60,0,0)');
      cx.fillStyle = grd; cx.beginPath(); cx.arc(sx, sy, ts * (0.5 + k * 0.1), 0, 7); cx.fill();
    }
    if (f.detached && f.ttl < 3) { /* fading fuse: flicker handled by alpha above */ }
  }

  function drawFire(fr, now) {
    var x = px(fr.x), y = py(fr.y), a = Math.min(1, fr.t / 0.25);
    var gr = cx.createRadialGradient(x + ts / 2, y + ts / 2, 0, x + ts / 2, y + ts / 2, ts * 0.8);
    gr.addColorStop(0, 'rgba(255,250,200,' + a + ')'); gr.addColorStop(0.35, 'rgba(255,170,50,' + a * 0.95 + ')'); gr.addColorStop(1, 'rgba(255,50,10,0)');
    cx.fillStyle = gr; cx.fillRect(x - ts * 0.3, y - ts * 0.3, ts * 1.6, ts * 1.6);
    cx.fillStyle = 'rgba(255,230,140,' + a * 0.55 + ')'; cx.fillRect(x + ts * 0.08, y + ts * 0.08, ts * 0.84, ts * 0.84);
  }

  function drawPowerup(u, now) {
    var x = px(u.x) + ts / 2, y = py(u.y) + ts / 2 + Math.sin(now * 3 + u.x) * ts * 0.04, r = ts * 0.32;
    var gr = cx.createRadialGradient(x, y, 0, x, y, ts * 0.7); gr.addColorStop(0, KIND_COL[u.kind] + 'aa'); gr.addColorStop(1, KIND_COL[u.kind] + '00');
    cx.fillStyle = gr; cx.fillRect(x - ts, y - ts, ts * 2, ts * 2);
    cx.fillStyle = '#1a1a22'; cx.strokeStyle = KIND_COL[u.kind]; cx.lineWidth = Math.max(2, ts * 0.07);
    cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); cx.stroke();
    cx.fillStyle = KIND_COL[u.kind]; cx.font = 'bold ' + Math.round(ts * 0.4) + 'px system-ui,sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(KIND_LET[u.kind], x, y + 1);
  }

  function drawMiner(p, g, now) {
    var pos = lerpPos(p), x = px(pos.x) + ts / 2, y = py(pos.y) + ts / 2;
    var moving = p.prog < 1, bob = moving ? Math.sin(now * 22) * ts * 0.03 : Math.sin(now * 3) * ts * 0.01;
    if (p.inv > 0 && Math.floor(now * 14) % 2) cx.globalAlpha = 0.45;
    var s = ts * 0.4;
    cx.fillStyle = 'rgba(0,0,0,0.35)'; cx.beginPath(); cx.ellipse(x, y + s * 0.95, s * 0.8, s * 0.3, 0, 0, 7); cx.fill();
    // body
    cx.fillStyle = '#3b6ea8'; roundRect(x - s * 0.6, y - s * 0.1 + bob, s * 1.2, s * 1.0, s * 0.3); cx.fill();
    cx.fillStyle = '#d9a35c'; cx.fillRect(x - s * 0.6, y + s * 0.35 + bob, s * 1.2, s * 0.12);
    // face
    cx.fillStyle = '#f0c9a0'; cx.beginPath(); cx.arc(x, y - s * 0.25 + bob, s * 0.6, 0, 7); cx.fill();
    var ex = (p.dir === 1 ? 0.15 : p.dir === 3 ? -0.15 : 0) * s, ey = (p.dir === 2 ? 0.1 : p.dir === 0 ? -0.1 : 0) * s;
    cx.fillStyle = '#1a1a1a'; cx.beginPath(); cx.arc(x - s * 0.22 + ex, y - s * 0.25 + ey + bob, s * 0.08, 0, 7); cx.arc(x + s * 0.22 + ex, y - s * 0.25 + ey + bob, s * 0.08, 0, 7); cx.fill();
    // helmet + lamp
    cx.fillStyle = '#f2b632'; cx.beginPath(); cx.arc(x, y - s * 0.45 + bob, s * 0.68, Math.PI, 0); cx.fill();
    cx.fillRect(x - s * 0.78, y - s * 0.47 + bob, s * 1.56, s * 0.12);
    cx.fillStyle = '#fffbe0'; cx.beginPath(); cx.arc(x + ex * 1.5, y - s * 0.78 + bob, s * 0.17, 0, 7); cx.fill();
    cx.globalAlpha = 1;
  }
  function roundRect(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }

  var ECOL = { wander: ['#7ac74f', '#3f7a22'], chase: ['#e0524d', '#8a2320'], bomber: ['#a56bd6', '#5a3180'] };
  function drawEnemy(e, now) {
    var pos = lerpPos(e), x = px(pos.x) + ts / 2, y = py(pos.y) + ts / 2;
    var col = ECOL[e.type], s = ts * 0.4;
    if (!e.alive) { var a = Math.max(0, 1 - e.dying * 2.5); if (a <= 0) return; cx.globalAlpha = a; s *= 1 + e.dying * 1.2; }
    var squish = 1 + Math.sin(now * 8 + e.id) * 0.07;
    cx.fillStyle = 'rgba(0,0,0,0.35)'; cx.beginPath(); cx.ellipse(x, y + s * 0.85, s * 0.8, s * 0.28, 0, 0, 7); cx.fill();
    var gr = cx.createRadialGradient(x - s * 0.3, y - s * 0.3, s * 0.1, x, y, s * 1.1); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
    cx.fillStyle = gr; cx.beginPath(); cx.ellipse(x, y + s * 0.1, s * 0.95 / squish, s * 0.85 * squish, 0, 0, 7); cx.fill();
    if (e.type === 'chase') { cx.fillStyle = col[1]; cx.beginPath(); cx.moveTo(x - s * 0.6, y - s * 0.5); cx.lineTo(x - s * 0.35, y - s * 1.0); cx.lineTo(x - s * 0.1, y - s * 0.6); cx.moveTo(x + s * 0.6, y - s * 0.5); cx.lineTo(x + s * 0.35, y - s * 1.0); cx.lineTo(x + s * 0.1, y - s * 0.6); cx.fill(); }
    if (e.type === 'bomber') { cx.fillStyle = '#222'; cx.fillRect(x - s * 0.7, y - s * 0.75, s * 1.4, s * 0.3); cx.fillStyle = '#ff7a3d'; cx.fillRect(x - s * 0.15, y - s * 0.95, s * 0.3, s * 0.25); }
    var dx = (e.tx - e.fx) * s * 0.12, dy = (e.ty - e.fy) * s * 0.12;
    cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x - s * 0.35, y - s * 0.1, s * 0.25, 0, 7); cx.arc(x + s * 0.35, y - s * 0.1, s * 0.25, 0, 7); cx.fill();
    cx.fillStyle = e.type === 'chase' ? '#ffe0e0' : '#111'; cx.beginPath(); cx.arc(x - s * 0.35 + dx, y - s * 0.1 + dy, s * 0.11, 0, 7); cx.arc(x + s * 0.35 + dx, y - s * 0.1 + dy, s * 0.11, 0, 7); cx.fill();
    cx.globalAlpha = 1;
  }

  R.draw = function (g, now, dt, ui) {
    if (!cx || !sprites) return;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = '#0a0810'; cx.fillRect(0, 0, vw, vh);
    var i, x, y;
    shake = Math.max(0, shake - dt * 2.6); flash = Math.max(0, flash - dt * 2);
    var sx = (Math.random() - 0.5) * shake * ts * 0.35, sy = (Math.random() - 0.5) * shake * ts * 0.35;
    cx.save(); cx.translate(sx, sy);
    if (g) {
      for (y = 0; y < WF.H; y++) for (x = 0; x < WF.W; x++) {
        var t = g.grid[y * WF.W + x], v = (x * 7 + y * 13) % 4;
        cx.drawImage(sprites.floor[v], px(x), py(y), ts, ts);
        if (t === 1) cx.drawImage(sprites.wall[(x + y) % 3], px(x), py(y), ts, ts);
      }
      g.fuses.forEach(function (f) { drawFuse(f, now); });
      g.powerups.forEach(function (u) { drawPowerup(u, now); });
      g.bombs.forEach(function (b) { drawBomb(b, now, g); });
      // crates drawn after floor pieces so they overlap bombs correctly
      for (y = 0; y < WF.H; y++) for (x = 0; x < WF.W; x++) if (g.grid[y * WF.W + x] === 2) cx.drawImage(sprites.crate[(x * 3 + y) % 3], px(x), py(y), ts, ts);
      g.enemies.forEach(function (e) { drawEnemy(e, now); });
      if (g.player.alive) drawMiner(g.player, g, now);
      g.fires.forEach(function (f) { drawFire(f, now); });
      // lighting: darkness with light pools
      if (lit) {
        var lw = litc.width, lh = litc.height, k = 0.25;
        lit.globalCompositeOperation = 'source-over'; lit.clearRect(0, 0, lw, lh); lit.fillStyle = 'rgba(8,5,16,0.6)'; lit.fillRect(0, 0, lw, lh);
        lit.globalCompositeOperation = 'destination-out';
        function pool(tx, ty, rad, a) {
          var cxp = (tx + 0.5) * ts * k, cyp = (ty + 0.5) * ts * k, r = rad * ts * k;
          var gr = lit.createRadialGradient(cxp, cyp, 0, cxp, cyp, r); gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          lit.fillStyle = gr; lit.fillRect(cxp - r, cyp - r, r * 2, r * 2);
        }
        var base = g.player.alive ? lerpPos(g.player) : { x: 7, y: 6 };
        pool(base.x, base.y, 5.5, 0.95);
        g.bombs.forEach(function (b) { pool(b.x, b.y, 2.6, 0.7); });
        g.fires.forEach(function (f) { pool(f.x, f.y, 3, 0.9); });
        g.fuses.forEach(function (f) { f.tiles.forEach(function (t) { if (t.state === 1) pool(t.x, t.y, 2.4, 0.8); }); });
        g.powerups.forEach(function (u) { pool(u.x, u.y, 1.8, 0.6); });
        g.enemies.forEach(function (e) { if (e.alive) { var p = lerpPos(e); pool(p.x, p.y, 1.6, 0.45); } });
        cx.imageSmoothingEnabled = true;
        cx.drawImage(litc, px(0), py(0), ts * WF.W, ts * WF.H);
        lit.globalCompositeOperation = 'source-over';
      }
    }
    // particles
    for (i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
      cx.globalAlpha = Math.max(0, p.life / p.max); cx.fillStyle = p.col;
      cx.fillRect(px(p.x) - p.sz / 2, py(p.y) - p.sz / 2, p.sz, p.sz);
    }
    cx.globalAlpha = 1;
    cx.restore();
    if (flash > 0) { cx.fillStyle = 'rgba(255,200,120,' + flash * 0.25 + ')'; cx.fillRect(0, 0, vw, vh); }
    // score pops
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    for (i = pops.length - 1; i >= 0; i--) {
      var q = pops[i]; q.t += dt; if (q.t > 1.4) { pops.splice(i, 1); continue; }
      cx.globalAlpha = Math.min(1, (1.4 - q.t) * 2); cx.font = '800 ' + Math.round(ts * (q.big ? 0.8 : 0.55)) + 'px system-ui,sans-serif';
      cx.lineWidth = 4; cx.strokeStyle = '#1a0e05'; cx.fillStyle = q.big ? '#ffd23d' : '#fff';
      var qx = px(q.x), qy = py(q.y) - q.t * ts * 0.9; cx.strokeText(q.text, qx, qy); cx.fillText(q.text, qx, qy);
    }
    cx.globalAlpha = 1;
    if (g) drawHud(g, ui);
    // vignette
    var vg = cx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); cx.fillStyle = vg; cx.fillRect(0, 0, vw, vh);
  };

  function drawHud(g, ui) {
    var h = R.hudH, w = vw, small = w < 520;
    var gr = cx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1d1620'); gr.addColorStop(1, '#120d16');
    cx.fillStyle = gr; cx.fillRect(0, 0, w, h);
    cx.fillStyle = '#c0732a'; cx.fillRect(0, h - 2, w, 2);
    cx.textBaseline = 'middle'; cx.textAlign = 'left';
    var f = small ? 13 : 16;
    cx.fillStyle = '#ffd23d'; cx.font = '800 ' + (f + 6) + 'px system-ui,sans-serif';
    cx.fillText(String(g.score).replace(/\B(?=(\d{3})+(?!\d))/g, ','), 12, h * 0.38);
    cx.fillStyle = '#b8aab0'; cx.font = '600 ' + (f - 3) + 'px system-ui,sans-serif';
    cx.fillText('LEVEL ' + g.level + (g.stats.bestChain > 1 ? '  ·  BEST CHAIN ' + g.stats.bestChain : ''), 12, h * 0.78);
    cx.textAlign = 'center'; cx.fillStyle = g.timeLeft < 20 ? '#ff5a4d' : '#f4ead8'; cx.font = '800 ' + (f + 4) + 'px system-ui,sans-serif';
    var tl = Math.max(0, Math.ceil(g.timeLeft)); cx.fillText(Math.floor(tl / 60) + ':' + ('0' + tl % 60).slice(-2), w * 0.5, h * 0.38);
    var p = g.player; cx.font = '700 ' + (f - 3) + 'px system-ui,sans-serif'; cx.fillStyle = '#9fb8d0';
    cx.fillText('RNG ' + p.range + '  BOMB ' + p.maxBombs + '  SPD ' + p.speed + '  FUSE ' + p.fuseLen, w * 0.5, h * 0.78);
    cx.textAlign = 'right';
    for (var i = 0; i < 3; i++) { cx.fillStyle = i < g.lives ? '#ff5a4d' : '#3a2a30'; cx.beginPath(); cx.arc(w - 18 - i * 22, h * 0.38, 8, 0, 7); cx.fill(); }
    var alive = g.enemies.filter(function (e) { return e.alive; }).length;
    cx.fillStyle = '#b8aab0'; cx.font = '600 ' + (f - 3) + 'px system-ui,sans-serif'; cx.fillText(alive + ' FOES', w - 12, h * 0.78);
  }

  /* touch control art; geometry supplied by main.js */
  R.drawControls = function (c) {
    if (!c) return;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.globalAlpha = 0.85;
    cx.fillStyle = 'rgba(255,255,255,0.08)'; cx.strokeStyle = 'rgba(255,255,255,0.35)'; cx.lineWidth = 2;
    cx.beginPath(); cx.arc(c.pad.x, c.pad.y, c.pad.r, 0, 7); cx.fill(); cx.stroke();
    cx.fillStyle = 'rgba(255,210,61,0.8)'; cx.beginPath(); cx.arc(c.pad.x + c.stick.x * c.pad.r * 0.5, c.pad.y + c.stick.y * c.pad.r * 0.5, c.pad.r * 0.38, 0, 7); cx.fill();
    [c.bomb, c.cut].forEach(function (b, i) {
      cx.fillStyle = b.down ? 'rgba(255,122,61,0.85)' : 'rgba(255,255,255,0.12)'; cx.strokeStyle = 'rgba(255,255,255,0.4)';
      cx.beginPath(); cx.arc(b.x, b.y, b.r, 0, 7); cx.fill(); cx.stroke();
      cx.fillStyle = '#fff'; cx.font = '800 ' + Math.round(b.r * 0.38) + 'px system-ui,sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(i === 0 ? 'BOMB' : 'CUT', b.x, b.y);
    });
    cx.globalAlpha = 1;
  };
})(window);
