/* Fuse Echo — canvas renderer, procedural art, particles. Owner: render. */
(function (global) {
  'use strict';
  var FE = global.FE;
  var W = FE.W, H = FE.H;
  var TAU = Math.PI * 2;

  var R = FE.Render = {};
  var canvas, ctx, T = 32, ox = 0, oy = 0, vw = 0, vh = 0, dpr = 1;
  var tex = {};           // baked tile textures
  var parts = [], texts = [], shake = 0, flash = 0, flashCol = '#fff';
  var scorch = [];        // persistent floor marks
  var topInset = 56, bottomInset = 0;

  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function hash(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  /* ---------- baked textures ---------- */
  function bake() {
    var s = Math.max(16, Math.round(T * dpr));
    tex.s = s;
    // floor A / B
    for (var v = 0; v < 2; v++) {
      var c = mk(s, s), g = c.getContext('2d');
      var base = v ? '#16213a' : '#1a2744';
      g.fillStyle = base; g.fillRect(0, 0, s, s);
      var gr = g.createLinearGradient(0, 0, s, s);
      gr.addColorStop(0, 'rgba(120,170,255,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.18)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      for (var i = 0; i < s * 1.2; i++) {
        var px = hash(i, v + 1) * s, py = hash(v + 3, i) * s;
        g.fillStyle = 'rgba(150,190,255,' + (0.03 + hash(i, 9) * 0.05) + ')';
        g.fillRect(px, py, 1 + hash(i, 4) * 2, 1);
      }
      g.strokeStyle = 'rgba(70,120,200,0.22)'; g.lineWidth = Math.max(1, s / 28);
      g.strokeRect(0.5, 0.5, s - 1, s - 1);
      g.fillStyle = 'rgba(80,140,255,0.15)';
      var q = s * 0.06; g.fillRect(q, q, s * 0.1, 2); g.fillRect(q, q, 2, s * 0.1);
      tex['floor' + v] = c;
    }
    // wall
    (function () {
      var c = mk(s, s), g = c.getContext('2d');
      var gr = g.createLinearGradient(0, 0, 0, s);
      gr.addColorStop(0, '#59678c'); gr.addColorStop(1, '#2a3354');
      g.fillStyle = gr; rr(g, 0, 0, s, s, s * 0.14); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.14)'; rr(g, s * 0.06, s * 0.05, s * 0.88, s * 0.14, s * 0.07); g.fill();
      var inner = g.createLinearGradient(0, s * 0.2, 0, s * 0.92);
      inner.addColorStop(0, '#3a4670'); inner.addColorStop(1, '#222a47');
      g.fillStyle = inner; rr(g, s * 0.14, s * 0.22, s * 0.72, s * 0.62, s * 0.1); g.fill();
      g.strokeStyle = 'rgba(94,230,255,0.75)'; g.lineWidth = Math.max(1.2, s / 20);
      g.beginPath(); g.moveTo(s * 0.26, s * 0.54); g.lineTo(s * 0.74, s * 0.54); g.stroke();
      g.fillStyle = 'rgba(94,230,255,0.25)'; g.fillRect(s * 0.26, s * 0.5, s * 0.48, s * 0.08);
      g.fillStyle = '#8fa0cf';
      [[0.1, 0.12], [0.9, 0.12], [0.1, 0.88], [0.9, 0.88]].forEach(function (p) {
        g.beginPath(); g.arc(p[0] * s, p[1] * s, s * 0.04, 0, TAU); g.fill();
      });
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5; rr(g, 0.75, 0.75, s - 1.5, s - 1.5, s * 0.14); g.stroke();
      tex.wall = c;
    })();
    // crates (3 variants)
    for (var cv = 0; cv < 3; cv++) {
      (function (cv) {
        var c = mk(s, s), g = c.getContext('2d');
        var hues = ['#c97b3b', '#b86a33', '#d48a47'];
        g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, s * 0.06, s * 0.1, s * 0.9, s * 0.9, s * 0.12); g.fill();
        var gr = g.createLinearGradient(0, 0, 0, s);
        gr.addColorStop(0, '#f0b36a'); gr.addColorStop(1, hues[cv]);
        g.fillStyle = gr; rr(g, s * 0.04, s * 0.04, s * 0.9, s * 0.88, s * 0.12); g.fill();
        // planks
        g.strokeStyle = 'rgba(80,38,10,0.55)'; g.lineWidth = Math.max(1.2, s / 22);
        for (var k = 1; k < 4; k++) {
          g.beginPath(); g.moveTo(s * 0.06, s * (0.04 + k * 0.22)); g.lineTo(s * 0.92, s * (0.04 + k * 0.22)); g.stroke();
        }
        // grain
        for (var i = 0; i < 40; i++) {
          g.fillStyle = 'rgba(90,40,10,' + (0.06 + hash(i, cv) * 0.1) + ')';
          g.fillRect(hash(i, cv + 7) * s * 0.85 + s * 0.06, hash(cv, i + 2) * s * 0.85 + s * 0.06, 2 + hash(i, 3) * 6, 1);
        }
        // metal frame + straps
        g.strokeStyle = '#4a3320'; g.lineWidth = Math.max(2, s / 12);
        rr(g, s * 0.09, s * 0.09, s * 0.8, s * 0.78, s * 0.08); g.stroke();
        g.strokeStyle = '#7b5733'; g.lineWidth = Math.max(1.2, s / 24);
        g.beginPath(); g.moveTo(s * 0.12, s * 0.12); g.lineTo(s * 0.86, s * 0.84); g.moveTo(s * 0.86, s * 0.12); g.lineTo(s * 0.12, s * 0.84); g.stroke();
        g.fillStyle = '#ffd89a';
        [[0.14, 0.14], [0.84, 0.14], [0.14, 0.82], [0.84, 0.82]].forEach(function (p) {
          g.beginPath(); g.arc(p[0] * s, p[1] * s, s * 0.035, 0, TAU); g.fill();
        });
        // highlight
        g.fillStyle = 'rgba(255,240,200,0.28)'; rr(g, s * 0.08, s * 0.06, s * 0.8, s * 0.1, s * 0.05); g.fill();
        // glowing fuse mark for echo theme
        g.fillStyle = 'rgba(94,230,255,0.9)'; g.beginPath(); g.arc(s * 0.49, s * 0.48, s * 0.07, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(94,230,255,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(s * 0.49, s * 0.48, s * 0.13, 0, TAU); g.stroke();
        tex['crate' + cv] = c;
      })(cv);
    }
    // vignette
    tex.vig = null;
  }

  /* ---------- sizing ---------- */
  R.init = function (cv) {
    canvas = cv; ctx = cv.getContext('2d');
    R.resize();
  };
  R.setInsets = function (top, bottom) { topInset = top; bottomInset = bottom; R.resize(); };
  R.resize = function () {
    if (!canvas) return;
    dpr = Math.min(2, global.devicePixelRatio || 1);
    vw = global.innerWidth; vh = global.innerHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    var availW = vw - 8, availH = vh - topInset - bottomInset - 6;
    T = Math.max(14, Math.floor(Math.min(availW / W, availH / H)));
    ox = Math.floor((vw - T * W) / 2);
    oy = Math.floor(topInset + Math.max(0, (availH - T * H) / 2) + 2);
    bake();
  };
  R.geometry = function () { return { T: T, ox: ox, oy: oy, w: T * W, h: T * H }; };

  /* ---------- fx ---------- */
  function spark(x, y, n, col, spd, life, size, grav) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, s = (0.4 + Math.random() * 0.8) * spd;
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.7), max: life, col: col, size: size * (0.5 + Math.random()), g: grav || 0, kind: 'spark' });
    }
  }
  function smoke(x, y, n) {
    for (var i = 0; i < n; i++) parts.push({ x: x + (Math.random() - 0.5) * 0.5, y: y + (Math.random() - 0.5) * 0.5, vx: (Math.random() - 0.5) * 0.6, vy: -0.3 - Math.random() * 0.6, life: 0.9 + Math.random() * 0.8, max: 1.5, col: 'rgba(140,150,190,', size: 0.3 + Math.random() * 0.3, g: 0, kind: 'smoke' });
  }
  function debris(x, y, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, s = 2 + Math.random() * 4;
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 0.7 + Math.random() * 0.5, max: 1, col: Math.random() < 0.5 ? '#d48a47' : '#8a5428', size: 0.08 + Math.random() * 0.1, g: 9, kind: 'chip', rot: Math.random() * 6 });
    }
  }
  function text(x, y, str, col, big) { texts.push({ x: x, y: y, s: str, col: col, t: 0, big: big }); }

  R.onEvent = function (ev) {
    switch (ev.t) {
      case 'boom':
        shake = Math.min(1, shake + 0.45 + ev.chain * 0.2);
        flash = Math.min(0.5, 0.18 + ev.chain * 0.1); flashCol = '#ffc36b';
        spark(ev.x + 0.5, ev.y + 0.5, 30, '#ffb347', 9, 0.6, 0.1, 0);
        smoke(ev.x + 0.5, ev.y + 0.5, 6);
        scorch.push({ x: ev.x, y: ev.y, a: 0.5 });
        if (scorch.length > 60) scorch.shift();
        break;
      case 'echo':
        shake = Math.min(1, shake + 0.25);
        flash = Math.min(0.5, 0.12); flashCol = '#8f7bff';
        spark(ev.x + 0.5, ev.y + 0.5, 26, '#7df0ff', 8, 0.6, 0.09, 0);
        break;
      case 'crate': debris(ev.x + 0.5, ev.y + 0.5, 9); smoke(ev.x + 0.5, ev.y + 0.5, 2); break;
      case 'pickup': spark(ev.x + 0.5, ev.y + 0.5, 16, ev.type === 'bomb' ? '#ff8a8a' : ev.type === 'flame' ? '#ffd23e' : '#7dffb0', 5, 0.6, 0.08, 0); text(ev.x + 0.5, ev.y, ev.type === 'bomb' ? '+BOMB' : ev.type === 'flame' ? '+FLAME' : '+SPEED', '#fff', false); break;
      case 'puburn': spark(ev.x + 0.5, ev.y + 0.5, 8, '#999', 3, 0.4, 0.06, 0); break;
      case 'death': spark(ev.x, ev.y, 34, ev.player ? '#3ee6ff' : '#ff5a7a', 7, 0.9, 0.1, 3); shake = Math.min(1, shake + 0.4); break;
      case 'kill': text(ev.x, ev.y - 0.3, (ev.echo ? 'ECHO KILL ' : '') + '+' + ev.pts + (ev.chain > 1 ? '  x' + ev.chain : ''), ev.echo ? '#9ff3ff' : '#ffd23e', true); break;
      case 'place': spark(ev.x + 0.5, ev.y + 0.5, 4, '#fff', 2, 0.25, 0.05, 0); break;
    }
  };

  R.reset = function () { parts.length = 0; texts.length = 0; scorch.length = 0; shake = 0; flash = 0; };

  R.updateFx = function (dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'smoke') { p.size += dt * 0.5; }
      else { p.vx *= 0.96; p.vy *= (p.g ? 1 : 0.96); }
      if (p.rot !== undefined) p.rot += dt * 8;
    }
    for (i = texts.length - 1; i >= 0; i--) { texts[i].t += dt; if (texts[i].t > 1.4) texts.splice(i, 1); }
    shake = Math.max(0, shake - dt * 2.2);
    flash = Math.max(0, flash - dt * 1.6);
    for (i = 0; i < scorch.length; i++) scorch[i].a = Math.max(0.12, scorch[i].a - dt * 0.05);
  };

  /* ---------- drawing ---------- */
  function drawBomb(st, b, time) {
    var cx = (b.x + 0.5) * T, cy = (b.y + 0.5) * T;
    var left = b.t / FE.FUSE;
    var pulse = 1 + Math.sin(time * (8 + (1 - left) * 22)) * (0.05 + (1 - left) * 0.08);
    var r = T * 0.34 * pulse;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + T * 0.3, T * 0.3, T * 0.1, 0, 0, TAU); ctx.fill();
    // preview of reach as faint cells
    var g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#6f7aa6'); g.addColorStop(0.5, '#262d4d'); g.addColorStop(1, '#0d1122');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    // glowing core band
    var heat = 1 - left;
    ctx.strokeStyle = 'rgba(255,' + Math.round(120 + 100 * (1 - heat)) + ',60,' + (0.5 + heat * 0.5) + ')';
    ctx.lineWidth = Math.max(1.5, T * 0.07);
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, -0.4, 1.9); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.4, r * 0.16, 0, TAU); ctx.fill();
    // fuse
    ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = Math.max(1.5, T * 0.06);
    ctx.beginPath(); ctx.moveTo(cx + r * 0.3, cy - r * 0.8); ctx.quadraticCurveTo(cx + r * 0.7, cy - r * 1.3, cx + r * 0.5, cy - r * 1.55); ctx.stroke();
    var fx = cx + r * 0.5, fy = cy - r * 1.55;
    var sg = ctx.createRadialGradient(fx, fy, 0, fx, fy, T * 0.25);
    sg.addColorStop(0, 'rgba(255,255,220,1)'); sg.addColorStop(0.3, 'rgba(255,190,60,0.9)'); sg.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(fx, fy, T * (0.18 + 0.06 * Math.sin(time * 40)), 0, TAU); ctx.fill();
  }

  function drawBlastCell(x, y, kind, k, dirX, dirY, time) {
    // k: 1 → 0 (life remaining)
    var cx = (x + 0.5) * T, cy = (y + 0.5) * T;
    var a = Math.min(1, k * 2.2);
    var inner = kind === 'echo' ? '#e8e0ff' : '#fffbe0';
    var mid = kind === 'echo' ? 'rgba(140,110,255,' : 'rgba(255,170,40,';
    var outer = kind === 'echo' ? 'rgba(60,220,255,' : 'rgba(255,70,20,';
    var rad = T * (0.62 + 0.12 * Math.sin(time * 50 + x * 3 + y * 5)) * (0.7 + 0.3 * k);
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, inner); g.addColorStop(0.35, mid + a + ')'); g.addColorStop(1, outer + '0)');
    ctx.fillStyle = g; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    // plasma bar
    ctx.fillStyle = mid + (a * 0.85) + ')';
    var w = T * 0.5 * (0.5 + 0.5 * k);
    rr(ctx, cx - w / 2, cy - w / 2, w, w, w * 0.4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,' + (a * 0.9) + ')';
    var w2 = w * 0.5; rr(ctx, cx - w2 / 2, cy - w2 / 2, w2, w2, w2 * 0.4); ctx.fill();
  }

  function drawEcho(ec, time) {
    var left = ec.t / FE.ECHO_DELAY; // 1 → 0
    var pulse = 0.5 + 0.5 * Math.sin(time * (6 + (1 - left) * 18));
    for (var i = 0; i < ec.cells.length; i++) {
      var x = ec.cells[i][0], y = ec.cells[i][1];
      var cx = (x + 0.5) * T, cy = (y + 0.5) * T;
      var al = 0.18 + (1 - left) * 0.35 + pulse * 0.12;
      ctx.fillStyle = 'rgba(110,230,255,' + al * 0.5 + ')';
      rr(ctx, x * T + T * 0.08, y * T + T * 0.08, T * 0.84, T * 0.84, T * 0.18); ctx.fill();
      ctx.strokeStyle = 'rgba(160,240,255,' + (al + 0.25) + ')'; ctx.lineWidth = Math.max(1.2, T * 0.05);
      ctx.setLineDash([T * 0.16, T * 0.12]); ctx.lineDashOffset = -time * T * 0.6;
      rr(ctx, x * T + T * 0.1, y * T + T * 0.1, T * 0.8, T * 0.8, T * 0.18); ctx.stroke();
      ctx.setLineDash([]);
    }
    // countdown ring on origin
    var ocx = (ec.bx + 0.5) * T, ocy = (ec.by + 0.5) * T;
    ctx.strokeStyle = 'rgba(180,250,255,0.95)'; ctx.lineWidth = Math.max(2, T * 0.1); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(ocx, ocy, T * 0.3, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - left)); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = 'rgba(180,250,255,' + (0.4 + pulse * 0.4) + ')';
    ctx.beginPath(); ctx.arc(ocx, ocy, T * 0.08, 0, TAU); ctx.fill();
  }

  function drawPowerup(p, time) {
    var cx = (p.x + 0.5) * T, cy = (p.y + 0.5) * T + Math.sin(time * 4 + p.x) * T * 0.04;
    var col = p.type === 'bomb' ? '#ff6b6b' : p.type === 'flame' ? '#ffd23e' : '#5dffb0';
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, T * 0.55);
    g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00');
    ctx.fillStyle = g; ctx.fillRect(cx - T * 0.6, cy - T * 0.6, T * 1.2, T * 1.2);
    ctx.fillStyle = '#10162c'; rr(ctx, cx - T * 0.32, cy - T * 0.32, T * 0.64, T * 0.64, T * 0.16); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, T * 0.06); rr(ctx, cx - T * 0.32, cy - T * 0.32, T * 0.64, T * 0.64, T * 0.16); ctx.stroke();
    ctx.fillStyle = col; ctx.strokeStyle = col;
    if (p.type === 'bomb') {
      ctx.beginPath(); ctx.arc(cx, cy + T * 0.03, T * 0.15, 0, TAU); ctx.fill();
      ctx.fillRect(cx + T * 0.02, cy - T * 0.2, T * 0.05, T * 0.1);
    } else if (p.type === 'flame') {
      ctx.beginPath(); ctx.moveTo(cx, cy - T * 0.22); ctx.quadraticCurveTo(cx + T * 0.2, cy, cx, cy + T * 0.2);
      ctx.quadraticCurveTo(cx - T * 0.2, cy, cx, cy - T * 0.22); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(cx - T * 0.18, cy + T * 0.14); ctx.lineTo(cx + T * 0.02, cy - T * 0.2); ctx.lineTo(cx + T * 0.02, cy - T * 0.02);
      ctx.lineTo(cx + T * 0.18, cy - T * 0.02); ctx.lineTo(cx - T * 0.02, cy + T * 0.2); ctx.lineTo(cx - T * 0.02, cy + T * 0.04);
      ctx.lineTo(cx - T * 0.18, cy + T * 0.04); ctx.closePath(); ctx.fill();
    }
  }

  function drawEntity(st, e, time) {
    var x = e.x * T, y = e.y * T;
    var bob = e.moving ? Math.abs(Math.sin(e.walkT * 2.6)) * T * 0.06 : Math.sin(time * 3 + e.id) * T * 0.012;
    var squash = e.moving ? 1 + Math.sin(e.walkT * 5.2) * 0.04 : 1;
    if (!e.alive) {
      var k = Math.min(1, e.deadT / 0.5);
      if (k >= 1) return;
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(x, y); ctx.scale(1 + k * 0.6, 1 - k * 0.8);
      ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(0, 0, T * 0.32, 0, TAU); ctx.fill(); ctx.restore();
      return;
    }
    if (e.inv > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(x, y + T * 0.32, T * 0.3, T * 0.1, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y - bob); ctx.scale(1 / squash, squash);
    var col = e.color;
    // legs
    var lp = Math.sin(e.walkT * 5.2) * T * 0.07 * (e.moving ? 1 : 0);
    ctx.fillStyle = '#1b2240';
    rr(ctx, -T * 0.2, T * 0.14 + lp, T * 0.14, T * 0.2, T * 0.05); ctx.fill();
    rr(ctx, T * 0.06, T * 0.14 - lp, T * 0.14, T * 0.2, T * 0.05); ctx.fill();
    // body
    var gr = ctx.createLinearGradient(0, -T * 0.4, 0, T * 0.25);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.15, col); gr.addColorStop(1, shade(col, -0.45));
    ctx.fillStyle = gr; rr(ctx, -T * 0.3, -T * 0.34, T * 0.6, T * 0.58, T * 0.22); ctx.fill();
    ctx.strokeStyle = 'rgba(8,12,30,0.8)'; ctx.lineWidth = Math.max(1.2, T * 0.05); rr(ctx, -T * 0.3, -T * 0.34, T * 0.6, T * 0.58, T * 0.22); ctx.stroke();
    // visor
    ctx.fillStyle = '#0a1024'; rr(ctx, -T * 0.23, -T * 0.24, T * 0.46, T * 0.22, T * 0.1); ctx.fill();
    var ex = e.face * T * 0.05;
    ctx.fillStyle = e.bot ? '#ffe9a0' : '#7dfcff';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = T * 0.2;
    ctx.beginPath(); ctx.arc(ex - T * 0.09, -T * 0.13, T * 0.045, 0, TAU); ctx.arc(ex + T * 0.09, -T * 0.13, T * 0.045, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // antenna
    ctx.strokeStyle = '#cfd8ff'; ctx.lineWidth = Math.max(1.2, T * 0.04);
    ctx.beginPath(); ctx.moveTo(0, -T * 0.34); ctx.lineTo(Math.sin(time * 5 + e.id) * T * 0.04, -T * 0.5); ctx.stroke();
    ctx.fillStyle = e.bot ? '#ff5a7a' : '#ffd23e';
    ctx.beginPath(); ctx.arc(Math.sin(time * 5 + e.id) * T * 0.04, -T * 0.52, T * 0.05, 0, TAU); ctx.fill();
    // chest light
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-T * 0.08, T * 0.02, T * 0.16, T * 0.05);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function f(v) { return Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt)))); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }

  R.draw = function (st, time) {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // backdrop
    var bg = ctx.createRadialGradient(vw / 2, vh * 0.4, 10, vw / 2, vh * 0.5, Math.max(vw, vh) * 0.8);
    bg.addColorStop(0, '#16224a'); bg.addColorStop(1, '#05070f');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, vw, vh);
    if (!st || !st.grid) return;

    var sx = 0, sy = 0;
    if (shake > 0) { sx = (Math.random() - 0.5) * shake * T * 0.35; sy = (Math.random() - 0.5) * shake * T * 0.35; }
    ctx.save();
    ctx.translate(ox + sx, oy + sy);

    // arena glow frame
    ctx.shadowColor = 'rgba(80,200,255,0.5)'; ctx.shadowBlur = T * 0.8;
    ctx.fillStyle = '#0b1230'; ctx.fillRect(-4, -4, T * W + 8, T * H + 8);
    ctx.shadowBlur = 0;

    var x, y, i;
    // floor
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      ctx.drawImage(tex['floor' + ((x + y) & 1)], x * T, y * T, T, T);
    }
    // scorch
    for (i = 0; i < scorch.length; i++) {
      var sc = scorch[i];
      var sg = ctx.createRadialGradient((sc.x + 0.5) * T, (sc.y + 0.5) * T, 0, (sc.x + 0.5) * T, (sc.y + 0.5) * T, T * 0.7);
      sg.addColorStop(0, 'rgba(0,0,0,' + sc.a * 0.6 + ')'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.fillRect(sc.x * T - T * 0.3, sc.y * T - T * 0.3, T * 1.6, T * 1.6);
    }
    // echoes (under everything dynamic)
    for (i = 0; i < st.echoes.length; i++) drawEcho(st.echoes[i], time);
    // powerups
    for (i = 0; i < st.powerups.length; i++) drawPowerup(st.powerups[i], time);
    // bombs
    for (i = 0; i < st.bombs.length; i++) drawBomb(st, st.bombs[i], time);

    // static blocks and entities sorted by row so walls overlap characters nicely
    var ents = st.ents.slice().sort(function (a, b) { return a.y - b.y; });
    var ei = 0;
    for (y = 0; y < H; y++) {
      while (ei < ents.length && ents[ei].y < y + 1) { drawEntity(st, ents[ei], time); ei++; }
      for (x = 0; x < W; x++) {
        var c = st.grid[y * W + x];
        if (c === 1) {
          // wall drop shadow
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x * T, (y + 1) * T - 1, T, T * 0.18);
          ctx.drawImage(tex.wall, x * T, y * T - T * 0.08, T, T);
        } else if (c === 2) {
          ctx.drawImage(tex['crate' + ((x * 7 + y * 3) % 3)], x * T, y * T - T * 0.06, T, T);
        }
      }
    }
    while (ei < ents.length) { drawEntity(st, ents[ei], time); ei++; }

    // blasts (additive)
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < st.blasts.length; i++) {
      var bl = st.blasts[i], k = bl.t / bl.life;
      for (var j = 0; j < bl.cells.length; j++) drawBlastCell(bl.cells[j][0], bl.cells[j][1], bl.kind, k, 0, 0, time);
    }
    ctx.globalCompositeOperation = 'source-over';

    // particles
    for (i = 0; i < parts.length; i++) {
      var p = parts[i], f = p.life / p.max;
      if (p.kind === 'smoke') {
        ctx.fillStyle = p.col + (f * 0.28) + ')';
        ctx.beginPath(); ctx.arc(p.x * T, p.y * T, p.size * T, 0, TAU); ctx.fill();
      } else if (p.kind === 'chip') {
        ctx.save(); ctx.translate(p.x * T, p.y * T); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, f * 2);
        ctx.fillStyle = p.col; ctx.fillRect(-p.size * T, -p.size * T * 0.6, p.size * 2 * T, p.size * 1.2 * T); ctx.restore();
      } else {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, f * 1.5);
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x * T, p.y * T, Math.max(0.8, p.size * T * f), 0, TAU); ctx.fill();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }
    // floating text
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (i = 0; i < texts.length; i++) {
      var tt = texts[i], fa = 1 - Math.max(0, (tt.t - 0.9) / 0.5);
      ctx.globalAlpha = Math.max(0, fa);
      ctx.font = '800 ' + Math.round(T * (tt.big ? 0.62 : 0.46)) + 'px system-ui, sans-serif';
      var ty = tt.y * T - tt.t * T * 0.9, tx = Math.max(T * 2.5, Math.min(T * W - T * 2.5, tt.x * T));
      ctx.lineWidth = Math.max(3, T * 0.12); ctx.strokeStyle = 'rgba(5,8,20,0.9)'; ctx.strokeText(tt.s, tx, ty);
      ctx.fillStyle = tt.col; ctx.fillText(tt.s, tx, ty);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // screen flash + vignette
    if (flash > 0) { ctx.globalAlpha = flash * 0.5; ctx.fillStyle = flashCol; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1; }
    var vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
  };

  R.toBoard = function (cx, cy) { return { x: (cx - ox) / T, y: (cy - oy) / T }; };
})(window);
