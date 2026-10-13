/* Blastwick - canvas renderer, procedural art, particles. Owner: render. Namespace: BW.Render */
(function (g) {
  'use strict';
  var BW = g.BW = g.BW || {};
  var L = BW.Logic, T = L.T, W = L.W, H = L.H;
  var KCOL = { cross: ['#ff6a3d', '#ffd36b'], diag: ['#3db8ff', '#c4f0ff'], ring: ['#ffc83d', '#fff6c2'] };
  var cache = { ts: 0 };
  var parts = [], texts = [], shake = 0, flash = 0, flashCol = '#fff';

  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function noise(c, ts, n, col, seed) {
    var a = seed; for (var i = 0; i < n; i++) {
      a = (a * 1664525 + 1013904223) >>> 0; var x = (a % ts), y = ((a >>> 8) % ts);
      c.fillStyle = col; c.fillRect(x, y, Math.max(1, ts / 24), Math.max(1, ts / 24));
    }
  }

  function buildSprites(ts) {
    cache = { ts: ts };
    var c, g2;
    [0, 1].forEach(function (v) {
      var s = mk(ts, ts); c = s.getContext('2d');
      g2 = c.createLinearGradient(0, 0, ts, ts);
      g2.addColorStop(0, v ? '#2a2f55' : '#262b4d'); g2.addColorStop(1, v ? '#20244a' : '#1c2042');
      c.fillStyle = g2; c.fillRect(0, 0, ts, ts);
      noise(c, ts, 14, 'rgba(255,255,255,0.05)', 11 + v * 7);
      c.strokeStyle = 'rgba(120,140,255,0.08)'; c.strokeRect(0.5, 0.5, ts - 1, ts - 1);
      cache['floor' + v] = s;
    });
    // pillar: carved obsidian with glowing rune
    var p = mk(ts, ts); c = p.getContext('2d');
    g2 = c.createLinearGradient(0, 0, 0, ts); g2.addColorStop(0, '#6a6f9c'); g2.addColorStop(1, '#2d3156');
    c.fillStyle = g2; rr(c, 1, 1, ts - 2, ts - 2, ts * 0.14); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.18)'; rr(c, 3, 3, ts - 6, ts * 0.18, ts * 0.08); c.fill();
    c.fillStyle = '#1b1e3b'; rr(c, ts * 0.18, ts * 0.28, ts * 0.64, ts * 0.58, ts * 0.1); c.fill();
    c.strokeStyle = '#7fa2ff'; c.lineWidth = Math.max(1.5, ts / 18); c.globalAlpha = 0.7;
    c.beginPath(); c.moveTo(ts * 0.5, ts * 0.38); c.lineTo(ts * 0.34, ts * 0.72); c.lineTo(ts * 0.66, ts * 0.72); c.closePath(); c.stroke();
    cache.pillar = p;
    // crate
    var s = mk(ts, ts); c = s.getContext('2d');
    g2 = c.createLinearGradient(0, 0, 0, ts); g2.addColorStop(0, '#c98b4a'); g2.addColorStop(1, '#8a5527');
    c.fillStyle = g2; rr(c, 2, 2, ts - 4, ts - 4, ts * 0.12); c.fill();
    c.strokeStyle = '#5a3416'; c.lineWidth = Math.max(2, ts / 12);
    rr(c, 3, 3, ts - 6, ts - 6, ts * 0.1); c.stroke();
    c.lineWidth = Math.max(1.5, ts / 16); c.beginPath();
    c.moveTo(ts * 0.18, ts * 0.18); c.lineTo(ts * 0.82, ts * 0.82); c.moveTo(ts * 0.82, ts * 0.18); c.lineTo(ts * 0.18, ts * 0.82); c.stroke();
    c.fillStyle = 'rgba(255,230,170,0.35)'; rr(c, 5, 5, ts - 10, ts * 0.12, 3); c.fill();
    noise(c, ts, 30, 'rgba(60,30,10,0.35)', 99);
    cache.soft = s;
  }

  /* ---------- particles ---------- */
  function spark(x, y, col, n, spd, life, size) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, v = spd * (0.3 + Math.random());
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: life * (0.5 + Math.random() * 0.7), life: life, c: col, s: size * (0.6 + Math.random() * 0.8), g: 0 });
    }
  }
  function text(x, y, s, col, big) { texts.push({ x: x, y: y, s: s, c: col, t: 1.1, big: big }); }

  function handleEvents(st) {
    st.events.forEach(function (e) {
      if (e.type === 'boom') {
        var col = KCOL[e.kind];
        e.cells.forEach(function (c) { spark(c.x + 0.5, c.y + 0.5, col[1], 3, 3.2, 0.5, 0.09); spark(c.x + 0.5, c.y + 0.5, col[0], 2, 1.6, 0.8, 0.14); });
        shake = Math.min(1, shake + 0.35 + e.depth * 0.12); flash = 0.12 + e.depth * 0.04; flashCol = col[1];
      } else if (e.type === 'crate') {
        spark(e.x + 0.5, e.y + 0.5, '#c98b4a', 8, 3, 0.7, 0.1);
      } else if (e.type === 'kill') {
        spark(e.x, e.y, '#d6a8ff', 16, 3.5, 0.8, 0.1);
        text(e.x, e.y, '+' + e.pts, e.mult > 1 ? '#ffe36b' : '#fff', e.mult > 1);
      } else if (e.type === 'chain') {
        text(e.x, e.y - 0.8, 'CHAIN x' + e.n + '  +' + e.bonus, '#ff9ad0', true);
      } else if (e.type === 'death') {
        spark(e.x, e.y, '#fff', 24, 4, 0.9, 0.1); shake = 1;
      } else if (e.type === 'pickup') {
        spark(st.player.x, st.player.y, '#7dffb3', 14, 2.5, 0.6, 0.08);
      } else if (e.type === 'tide') { shake = Math.min(1, shake + 0.6); }
    });
  }

  function stepFx(dt) {
    var i;
    for (i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.t -= dt; if (p.t <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
    }
    for (i = texts.length - 1; i >= 0; i--) { texts[i].t -= dt; texts[i].y -= dt * 0.7; if (texts[i].t <= 0) texts.splice(i, 1); }
    shake = Math.max(0, shake - dt * 2.4); flash = Math.max(0, flash - dt);
    if (parts.length > 700) parts.splice(0, parts.length - 700);
  }

  /* ---------- layout ---------- */
  function layout(cw, ch, touch) {
    var hud = Math.max(46, Math.min(70, ch * 0.075));
    var bottom = touch ? Math.min(150, ch * 0.2) : 0;
    var availH = ch - hud - bottom - 6, availW = cw - 8;
    var ts = Math.max(12, Math.floor(Math.min(availW / W, availH / H)));
    var bw = ts * W, bh = ts * H;
    return { ts: ts, ox: Math.floor((cw - bw) / 2), oy: Math.floor(hud + 3 + Math.max(0, (availH - bh) / 2)), hud: hud, bottom: bottom, cw: cw, ch: ch };
  }

  /* ---------- drawing ---------- */
  function drawBomb(c, b, ts, time) {
    var col = KCOL[b.kind], x = (b.x + 0.5) * ts, y = (b.y + 0.55) * ts;
    var pulse = 1 + Math.sin(time * (8 + (2.4 - b.t) * 6)) * 0.07 * (b.t < 1 ? 2 : 1);
    var r = ts * 0.32 * pulse;
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(x, y + r * 0.9, r * 0.9, r * 0.35, 0, 0, 6.283); c.fill();
    var gr = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, col[1]); gr.addColorStop(0.35, col[0]); gr.addColorStop(1, '#1a1020');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
    if (b.kind === 'diag') { c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = ts / 18; c.beginPath(); c.moveTo(x - r * 0.4, y - r * 0.4); c.lineTo(x + r * 0.4, y + r * 0.4); c.moveTo(x + r * 0.4, y - r * 0.4); c.lineTo(x - r * 0.4, y + r * 0.4); c.stroke(); }
    else if (b.kind === 'ring') { c.strokeStyle = 'rgba(80,40,0,0.7)'; c.lineWidth = ts / 18; c.beginPath(); c.arc(x, y, r * 0.5, 0, 6.283); c.stroke(); }
    else { c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = ts / 18; c.beginPath(); c.moveTo(x - r * 0.45, y); c.lineTo(x + r * 0.45, y); c.moveTo(x, y - r * 0.45); c.lineTo(x, y + r * 0.45); c.stroke(); }
    // fuse
    var fx = x + r * 0.5, fy = y - r * 1.0;
    c.strokeStyle = '#d9c9a0'; c.lineWidth = ts / 14; c.beginPath(); c.moveTo(x + r * 0.2, y - r * 0.85); c.quadraticCurveTo(x + r * 0.5, y - r * 1.2, fx, fy); c.stroke();
    c.save(); c.globalCompositeOperation = 'lighter';
    var fr = ts * (0.14 + Math.random() * 0.06);
    var sg = c.createRadialGradient(fx, fy, 0, fx, fy, fr * 2.4);
    sg.addColorStop(0, '#fff'); sg.addColorStop(0.3, '#ffd36b'); sg.addColorStop(1, 'rgba(255,100,0,0)');
    c.fillStyle = sg; c.beginPath(); c.arc(fx, fy, fr * 2.4, 0, 6.283); c.fill(); c.restore();
  }

  function drawFlame(c, f, ts) {
    var col = KCOL[f.kind], k = f.t / L.FLAME_T, x = f.x * ts, y = f.y * ts;
    c.save(); c.globalCompositeOperation = 'lighter';
    var gr = c.createRadialGradient(x + ts / 2, y + ts / 2, 0, x + ts / 2, y + ts / 2, ts * 0.75);
    gr.addColorStop(0, 'rgba(255,255,255,' + (0.95 * k) + ')');
    gr.addColorStop(0.4, hexA(col[1], 0.8 * k)); gr.addColorStop(1, hexA(col[0], 0));
    c.fillStyle = gr; c.fillRect(x - ts * 0.25, y - ts * 0.25, ts * 1.5, ts * 1.5); c.restore();
  }
  function hexA(h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }

  function drawHero(c, p, ts, time, st) {
    if (p.dead > 0) return;
    if (p.inv > 0 && Math.floor(time * 14) % 2 === 0) return;
    var x = p.x * ts, y = p.y * ts, bob = p.moving ? Math.abs(Math.sin(p.anim)) * ts * 0.06 : Math.sin(time * 3) * ts * 0.015;
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(x, y + ts * 0.3, ts * 0.28, ts * 0.1, 0, 0, 6.283); c.fill();
    var by = y - bob;
    // body: wax-candle sprite
    var gr = c.createLinearGradient(x - ts * 0.25, 0, x + ts * 0.25, 0);
    gr.addColorStop(0, '#ffe9c4'); gr.addColorStop(0.6, '#f5d4a0'); gr.addColorStop(1, '#c9955a');
    c.fillStyle = gr; rr(c, x - ts * 0.24, by - ts * 0.12, ts * 0.48, ts * 0.42, ts * 0.16); c.fill();
    // face
    var dx = p.dir === 'left' ? -1 : p.dir === 'right' ? 1 : 0, dy = p.dir === 'up' ? -1 : p.dir === 'down' ? 1 : 0;
    if (p.dir !== 'up') {
      c.fillStyle = '#2a1a10';
      c.beginPath(); c.arc(x - ts * 0.09 + dx * ts * 0.05, by + ts * 0.06, ts * 0.04, 0, 6.283); c.arc(x + ts * 0.09 + dx * ts * 0.05, by + ts * 0.06, ts * 0.04, 0, 6.283); c.fill();
    }
    // wick + flame (hat)
    c.strokeStyle = '#3a2a20'; c.lineWidth = ts / 18; c.beginPath(); c.moveTo(x, by - ts * 0.12); c.lineTo(x, by - ts * 0.24); c.stroke();
    c.save(); c.globalCompositeOperation = 'lighter';
    var fl = ts * (0.2 + Math.sin(time * 18) * 0.03);
    var fg = c.createRadialGradient(x, by - ts * 0.34, 0, x, by - ts * 0.34, fl * 1.7);
    fg.addColorStop(0, '#fff'); fg.addColorStop(0.35, '#ffd36b'); fg.addColorStop(1, 'rgba(255,90,0,0)');
    c.fillStyle = fg; c.beginPath(); c.arc(x, by - ts * 0.34, fl * 1.7, 0, 6.283); c.fill(); c.restore();
    if (st.shield) {
      c.strokeStyle = 'rgba(125,255,179,0.8)'; c.lineWidth = ts / 12; c.beginPath(); c.arc(x, by, ts * 0.46, 0, 6.283); c.stroke();
    }
  }

  function drawEnemy(c, e, ts, time) {
    var x = e.x * ts, y = e.y * ts + Math.sin(e.phase * 4) * ts * 0.04;
    var s = e.alive ? 1 : Math.max(0, e.dying / 0.5);
    var hunter = e.kind === 'hunter', main = hunter ? '#ff4d7d' : '#a77bff', glow = hunter ? '#ffb3c8' : '#e0d0ff';
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0, ts * 0.32, ts * 0.25, ts * 0.08, 0, 0, 6.283); c.fill();
    var gr = c.createRadialGradient(-ts * 0.08, -ts * 0.1, ts * 0.04, 0, 0, ts * 0.36);
    gr.addColorStop(0, glow); gr.addColorStop(0.5, main); gr.addColorStop(1, '#2a1650');
    c.fillStyle = gr;
    c.beginPath(); c.arc(0, -ts * 0.04, ts * 0.32, Math.PI, 0);
    for (var i = 4; i >= 0; i--) c.lineTo(-ts * 0.32 + (4 - i) * ts * 0.16, ts * 0.3 + (i % 2 ? -ts * 0.08 : 0) + Math.sin(time * 8 + i) * ts * 0.02);
    c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-ts * 0.12, -ts * 0.06, ts * 0.075, 0, 6.283); c.arc(ts * 0.12, -ts * 0.06, ts * 0.075, 0, 6.283); c.fill();
    var lx = Math.sign(BW._px - e.x) * ts * 0.025, ly = Math.sign(BW._py - e.y) * ts * 0.025;
    c.fillStyle = '#1a0a30'; c.beginPath(); c.arc(-ts * 0.12 + lx, -ts * 0.06 + ly, ts * 0.04, 0, 6.283); c.arc(ts * 0.12 + lx, -ts * 0.06 + ly, ts * 0.04, 0, 6.283); c.fill();
    if (hunter) { c.strokeStyle = '#2a0a20'; c.lineWidth = ts / 18; c.beginPath(); c.moveTo(-ts * 0.2, -ts * 0.17); c.lineTo(-ts * 0.04, -ts * 0.11); c.moveTo(ts * 0.2, -ts * 0.17); c.lineTo(ts * 0.04, -ts * 0.11); c.stroke(); }
    c.restore();
  }

  var PICK = { bomb: ['B', '#ff8a4d'], range: ['R', '#ffd24d'], speed: ['S', '#4dd2ff'], shield: ['◈', '#7dffb3'], life: ['♥', '#ff6aa0'], diag: ['✕', '#3db8ff'], ring: ['◎', '#ffc83d'] };
  function drawPickup(c, pk, ts, time) {
    var d = PICK[pk.kind], x = (pk.x + 0.5) * ts, y = (pk.y + 0.5) * ts + Math.sin(time * 4 + pk.x) * ts * 0.04;
    c.save(); c.globalCompositeOperation = 'lighter';
    var gr = c.createRadialGradient(x, y, 0, x, y, ts * 0.5); gr.addColorStop(0, hexA(d[1], 0.55)); gr.addColorStop(1, hexA(d[1], 0));
    c.fillStyle = gr; c.fillRect(x - ts / 2, y - ts / 2, ts, ts); c.restore();
    c.fillStyle = '#10142e'; c.beginPath(); c.arc(x, y, ts * 0.28, 0, 6.283); c.fill();
    c.strokeStyle = d[1]; c.lineWidth = ts / 14; c.stroke();
    c.fillStyle = d[1]; c.font = 'bold ' + Math.floor(ts * 0.34) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(d[0], x, y + 1);
  }

  function draw(ctx, st, lay, time, dt) {
    var ts = lay.ts;
    if (cache.ts !== ts) buildSprites(ts);
    handleEvents(st); stepFx(dt);
    BW._px = st.player.x; BW._py = st.player.y;
    ctx.fillStyle = '#080a1c'; ctx.fillRect(0, 0, lay.cw, lay.ch);
    // backdrop glow
    var bg = ctx.createRadialGradient(lay.cw / 2, lay.ch / 2, 10, lay.cw / 2, lay.ch / 2, Math.max(lay.cw, lay.ch) * 0.7);
    bg.addColorStop(0, '#1b1f4a'); bg.addColorStop(1, '#05060f'); ctx.fillStyle = bg; ctx.fillRect(0, 0, lay.cw, lay.ch);

    ctx.save();
    var sx = (Math.random() - 0.5) * shake * ts * 0.35, sy = (Math.random() - 0.5) * shake * ts * 0.35;
    ctx.translate(lay.ox + sx, lay.oy + sy);
    var x, y;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var t = st.grid[y][x];
      if (t === T.WATER) {
        ctx.fillStyle = '#0a2a52'; ctx.fillRect(x * ts, y * ts, ts, ts);
        ctx.fillStyle = 'rgba(120,200,255,' + (0.12 + 0.08 * Math.sin(time * 2 + x + y)) + ')';
        ctx.fillRect(x * ts, y * ts + ts * (0.3 + 0.2 * Math.sin(time * 1.5 + x)), ts, ts * 0.08);
        continue;
      }
      ctx.drawImage(cache['floor' + ((x + y) & 1)], x * ts, y * ts);
      if (t === T.PILLAR) ctx.drawImage(cache.pillar, x * ts, y * ts);
    }
    // tide warning
    if (st.tideWarn) {
      ctx.fillStyle = 'rgba(80,170,255,' + (0.18 + 0.14 * Math.sin(time * 14)) + ')';
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        if (Math.min(x, y, W - 1 - x, H - 1 - y) === st.tideWarn && st.grid[y][x] !== T.WATER) ctx.fillRect(x * ts, y * ts, ts, ts);
      }
    }
    // exit
    if (st.exit && st.grid[st.exit.y][st.exit.x] === T.FLOOR) {
      var ex = (st.exit.x + 0.5) * ts, ey = (st.exit.y + 0.5) * ts;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var open = st.exitOpen, pr = ts * (0.4 + 0.06 * Math.sin(time * 5));
      var eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, pr * 1.4);
      eg.addColorStop(0, open ? 'rgba(160,255,200,0.95)' : 'rgba(120,120,160,0.4)'); eg.addColorStop(1, 'rgba(60,200,140,0)');
      ctx.fillStyle = eg; ctx.fillRect(ex - ts, ey - ts, ts * 2, ts * 2); ctx.restore();
      ctx.strokeStyle = open ? '#9dffd0' : '#666b90'; ctx.lineWidth = ts / 10; ctx.beginPath(); ctx.arc(ex, ey, pr * 0.8, 0, 6.283); ctx.stroke();
    }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (st.grid[y][x] === T.SOFT) ctx.drawImage(cache.soft, x * ts, y * ts);
    st.pickups.forEach(function (pk) { drawPickup(ctx, pk, ts, time); });
    st.bombs.forEach(function (b) { drawBomb(ctx, b, ts, time); });
    st.enemies.forEach(function (e) { drawEnemy(ctx, e, ts, time); });
    drawHero(ctx, st.player, ts, time, st);
    st.flames.forEach(function (f) { drawFlame(ctx, f, ts); });
    // particles
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, p.t / p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x * ts, p.y * ts, p.s * ts, 0, 6.283); ctx.fill(); });
    ctx.restore();
    // vignette on board edge
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    texts.forEach(function (t) {
      ctx.globalAlpha = Math.min(1, t.t * 2); ctx.fillStyle = t.c; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 4;
      ctx.font = '900 ' + Math.floor(ts * (t.big ? 0.5 : 0.36)) + 'px system-ui,sans-serif';
      ctx.strokeText(t.s, t.x * ts, t.y * ts); ctx.fillText(t.s, t.x * ts, t.y * ts);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
    if (flash > 0) { ctx.save(); ctx.globalAlpha = flash * 0.9; ctx.fillStyle = flashCol; ctx.globalCompositeOperation = 'lighter'; ctx.fillRect(0, 0, lay.cw, lay.ch); ctx.restore(); }
  }

  function clearFx() { parts.length = 0; texts.length = 0; shake = 0; flash = 0; }

  BW.Render = { layout: layout, draw: draw, clearFx: clearFx, KCOL: KCOL, PICK: PICK, rr: rr };
})(typeof window !== 'undefined' ? window : globalThis);
