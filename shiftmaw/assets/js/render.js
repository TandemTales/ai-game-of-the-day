/* Shiftmaw renderer: procedural 2.5D maze, sprites, particles and post glow on one canvas. */
(function (global) {
  'use strict';
  var SM = global.SM = global.SM || {};
  var Sim = SM.Sim, DIRS = SM.Levels.DIRS;
  var TAU = Math.PI * 2;

  var PAL = {
    bg0: '#06081a', bg1: '#0d1233',
    floor: '#0a1030', floorAlt: '#0c1438',
    wallTop0: '#2c5bd6', wallTop1: '#1a3a9c', wallEdge: '#79b6ff', wallSide: '#0a1a52',
    A: { top0: '#ffc24a', top1: '#c27a10', edge: '#fff0b0', side: '#6b3e06', glow: '255,190,70' },
    B: { top0: '#b88bff', top1: '#6a3fd0', edge: '#e6d4ff', side: '#2f1a6e', glow: '170,120,255' },
    mote: '#ffe6a8', player: '#ffd23f'
  };

  var R = SM.Render = { canvas: null, ctx: null, w: 0, h: 0, dpr: 1, c: 24, ox: 0, oy: 0, particles: [], pops: [], ripples: [], shake: 0, glow: null, staticLayer: null, staticKey: '', stars: [], padTop: 56, padBottom: 0, t: 0 };

  function makeGlow() {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
  }
  var glowCache = {};
  function glowSprite(color) { // tinted glow sprite
    if (glowCache[color]) return glowCache[color];
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    g.drawImage(R.glow, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, 128, 128);
    return (glowCache[color] = c);
  }
  function glowAt(x, y, r, color, a) {
    var ctx = R.ctx; ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  R.init = function (canvas) {
    R.canvas = canvas; R.ctx = canvas.getContext('2d', { alpha: false }); R.glow = makeGlow();
    for (var i = 0; i < 70; i++) R.stars.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, p: Math.random() * TAU });
    R.resize();
  };

  R.resize = function () {
    var dpr = Math.min(global.devicePixelRatio || 1, 2.5), w = global.innerWidth, h = global.innerHeight;
    R.dpr = dpr; R.w = w; R.h = h;
    R.canvas.width = Math.round(w * dpr); R.canvas.height = Math.round(h * dpr);
    R.staticKey = '';
  };

  R.layout = function (m) {
    var availW = R.w - 12, availH = R.h - R.padTop - R.padBottom - 8;
    R.c = Math.max(8, Math.floor(Math.min(availW / m.w, availH / m.h) * 2) / 2);
    R.ox = Math.round((R.w - R.c * m.w) / 2); R.oy = Math.round(R.padTop + (availH - R.c * m.h) / 2 + 4);
  };

  function rr(ctx, x, y, w, h, tl, tr, br, bl) {
    ctx.beginPath(); ctx.moveTo(x + tl, y); ctx.lineTo(x + w - tr, y); if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr); else ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - br); if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br); else ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + bl, y + h); if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl); else ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + tl); if (tl) ctx.arcTo(x, y, x + tl, y, tl); else ctx.lineTo(x, y); ctx.closePath();
  }
  function isW(m, x, y) { if (y < 0 || y >= m.h) return true; if (x < 0 || x >= m.w) return !SM.Levels.isTunnelRow(m, y); var c = m.grid[y][x]; return c === '#'; }

  /* static layer: floor + permanent walls (cached per maze/size) */
  function buildStatic(m) {
    var c = R.c, dpr = R.dpr, cv = document.createElement('canvas'); cv.width = Math.ceil(m.w * c * dpr) + 8; cv.height = Math.ceil((m.h * c + c) * dpr) + 8;
    var g = cv.getContext('2d'); g.scale(dpr, dpr); g.translate(2, c * 0.2);
    var x, y;
    for (y = 0; y < m.h; y++) for (x = 0; x < m.w; x++) {
      var ch = m.grid[y][x];
      if (ch === '#') continue;
      g.fillStyle = (x + y) & 1 ? PAL.floor : PAL.floorAlt; g.fillRect(x * c, y * c, c, c);
      if (ch === '=' || ch === '-') { g.fillStyle = 'rgba(160,110,255,0.10)'; g.fillRect(x * c, y * c, c, c); }
    }
    var lift = c * 0.2;
    for (y = 0; y < m.h; y++) for (x = 0; x < m.w; x++) {
      if (m.grid[y][x] !== '#') continue;
      var U = isW(m, x, y - 1), Dn = isW(m, x, y + 1), Lf = isW(m, x - 1, y), Rt = isW(m, x + 1, y);
      if (U && Dn && Lf && Rt && isW(m, x - 1, y - 1) && isW(m, x + 1, y - 1) && isW(m, x - 1, y + 1) && isW(m, x + 1, y + 1)) { g.fillStyle = '#050818'; g.fillRect(x * c, y * c - lift, c, c + lift); continue; }
      var r = c * 0.34, px = x * c + 1, py = y * c + 1 - lift, w = c - 2, h = c - 2;
      // side (extrusion)
      if (!Dn) { g.fillStyle = PAL.wallSide; rr(g, px, py + lift, w, h, r * (U || Lf ? 0.3 : 1), r * (U || Rt ? 0.3 : 1), (Dn || Rt) ? 0 : r, (Dn || Lf) ? 0 : r); g.fill(); }
      var gr = g.createLinearGradient(0, py, 0, py + h); gr.addColorStop(0, PAL.wallTop0); gr.addColorStop(1, PAL.wallTop1);
      g.fillStyle = gr; rr(g, px, py, w, h, (U || Lf) ? 0 : r, (U || Rt) ? 0 : r, (Dn || Rt) ? 0 : r, (Dn || Lf) ? 0 : r); g.fill();
      g.strokeStyle = PAL.wallEdge; g.globalAlpha = 0.85; g.lineWidth = Math.max(1, c * 0.06);
      g.beginPath();
      if (!U) { g.moveTo(px + (Lf ? 0 : r), py + 0.5); g.lineTo(px + w - (Rt ? 0 : r), py + 0.5); }
      if (!Lf) { g.moveTo(px + 0.5, py + (U ? 0 : r)); g.lineTo(px + 0.5, py + h - (Dn ? 0 : r)); }
      g.stroke(); g.globalAlpha = 1;
      if (!U && !Lf) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(px + w * 0.32, py + h * 0.28, w * 0.18, h * 0.1, -0.5, 0, TAU); g.fill(); }
    }
    return cv;
  }

  function easeOutBack(t) { var s = 1.70158; t -= 1; return t * t * ((s + 1) * t + s) + 1; }

  function drawPhaseWalls(s, time) {
    var m = s.m, ctx = R.ctx, c = R.c, ph = s.phase, a = s.phaseAnim, x, y, lift = c * 0.2;
    for (y = 0; y < m.h; y++) for (x = 0; x < m.w; x++) {
      var ch = m.grid[y][x]; if (ch !== 'A' && ch !== 'B') continue;
      var pal = ch === 'A' ? PAL.A : PAL.B, solidNow = (ch === 'A') === (ph === 0);
      var h = solidNow ? (a >= 1 ? 1 : Math.max(0, easeOutBack(a))) : (a >= 1 ? 0 : 1 - Math.min(1, a * 1.6));
      var X = R.ox + x * c, Y = R.oy + y * c;
      var pulse = 0.5 + 0.5 * Math.sin(time * 3 + x * 0.7 + y);
      if (h < 0.99) { // sunken socket / inactive outline
        ctx.strokeStyle = 'rgba(' + pal.glow + ',' + (0.28 + 0.2 * pulse) + ')'; ctx.lineWidth = Math.max(1, c * 0.07);
        ctx.setLineDash([c * 0.18, c * 0.14]); rr(ctx, X + c * 0.1, Y + c * 0.1, c * 0.8, c * 0.8, c * 0.2, c * 0.2, c * 0.2, c * 0.2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(' + pal.glow + ',' + (0.05 + 0.04 * pulse) + ')'; ctx.fill();
      }
      if (h > 0.02) {
        var L = lift * h, px = X + 1, py = Y + 1 - L, w = c - 2, hh = c - 2, r = c * 0.28;
        ctx.fillStyle = pal.side; rr(ctx, px, py + L, w, hh, r, r, r, r); ctx.fill();
        var gr = ctx.createLinearGradient(0, py, 0, py + hh); gr.addColorStop(0, pal.top0); gr.addColorStop(1, pal.top1);
        ctx.fillStyle = gr; rr(ctx, px, py, w, hh, r, r, r, r); ctx.fill();
        ctx.strokeStyle = pal.edge; ctx.globalAlpha = 0.9; ctx.lineWidth = Math.max(1, c * 0.07); ctx.stroke(); ctx.globalAlpha = 1;
        // rune
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, c * 0.06); ctx.beginPath();
        if (ch === 'A') { ctx.moveTo(px + w * 0.3, py + hh * 0.68); ctx.lineTo(px + w * 0.5, py + hh * 0.28); ctx.lineTo(px + w * 0.7, py + hh * 0.68); }
        else { ctx.arc(px + w / 2, py + hh / 2, w * 0.2, 0.4, TAU - 0.4); }
        ctx.stroke();
        glowAt(X + c / 2, Y + c / 2 - L, c * 1.15, 'rgb(' + pal.glow + ')', 0.35 * h * (0.7 + 0.3 * pulse));
      }
    }
  }

  function drawMotes(s, time) {
    var m = s.m, ctx = R.ctx, c = R.c, x, y;
    for (y = 0; y < m.h; y++) for (x = 0; x < m.w; x++) {
      var ch = m.grid[y][x]; if (ch !== '.' && ch !== 'o') continue;
      var cx = R.ox + x * c + c / 2, cy = R.oy + y * c + c / 2;
      if (ch === '.') {
        var tw = 0.75 + 0.25 * Math.sin(time * 4 + x * 1.3 + y * 0.9);
        ctx.fillStyle = PAL.mote; ctx.globalAlpha = tw; ctx.beginPath(); ctx.arc(cx, cy, c * 0.095, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        glowAt(cx, cy, c * 0.42, '#ffd878', 0.4 * tw);
      } else {
        var pu = 0.5 + 0.5 * Math.sin(time * 5 + x);
        glowAt(cx, cy, c * 1.1, '#ff8fe0', 0.5 + 0.3 * pu);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * 0.8);
        for (var i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.fillStyle = i & 1 ? '#ff9ee8' : '#ffd1f4'; ctx.beginPath(); ctx.ellipse(0, -c * 0.19, c * 0.09, c * 0.17 * (0.9 + 0.2 * pu), 0, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(0, 0, c * 0.1, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    if (s.fruit) {
      var f = s.fruit, fx = R.ox + f.x * c + c / 2, fy = R.oy + f.y * c + c / 2 + Math.sin(time * 4) * c * 0.06, d = s.fruitDef;
      glowAt(fx, fy, c * 1.1, d.c, 0.6);
      ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(fx, fy, c * 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(fx - c * 0.1, fy - c * 0.1, c * 0.08, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7aff9a'; ctx.lineWidth = c * 0.07; ctx.beginPath(); ctx.moveTo(fx, fy - c * 0.28); ctx.quadraticCurveTo(fx + c * 0.1, fy - c * 0.48, fx + c * 0.25, fy - c * 0.46); ctx.stroke();
    }
  }

  function eachWrap(s, x, y, fn) { fn(x); if (!SM.Levels.isTunnelRow(s.m, Math.round(y))) return; if (x < 1.2) fn(x + s.m.w); if (x > s.m.w - 2.2) fn(x - s.m.w); }

  function drawGhost(s, g, time) {
    var ctx = R.ctx, c = R.c, col = Sim.GHOSTS[g.idx].color, x = Sim.px(g), y = Sim.py(g), bob = g.state === 'nest' ? Math.sin(time * 6 + g.idx) * c * 0.05 : 0;
    var eaten = g.state === 'eaten', fr = g.fright && g.state !== 'eaten';
    var flick = fr && s.frightT < 2 && (Math.floor(time * 8) & 1);
    eachWrap(s, x, y, function (xx) {
      var cx = R.ox + xx * c + c / 2, cy = R.oy + y * c + c / 2 + bob, r = c * 0.43;
      if (!eaten) {
        var body = fr ? (flick ? '#fff4f4' : '#2b3dd0') : col;
        glowAt(cx, cy, c * 1.1, fr ? '#4d6bff' : col, 0.45);
        ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r, Math.PI, 0);
        var sk = cy + r * 0.85, wob = Math.sin(time * 12 + g.idx) * c * 0.04;
        ctx.lineTo(cx + r, sk);
        for (var i = 0; i < 3; i++) { var x0 = cx + r - (i * 2 * r) / 3, x1 = x0 - (2 * r) / 3; ctx.quadraticCurveTo(x0 - r / 3, sk - c * 0.2 + (i & 1 ? wob : -wob), x1, sk); }
        ctx.closePath(); ctx.fill();
        var hl = ctx.createLinearGradient(0, cy - r, 0, cy + r); hl.addColorStop(0, 'rgba(255,255,255,0.35)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)'); ctx.fillStyle = hl; ctx.fill();
      }
      var dv = g.dir >= 0 ? DIRS[g.dir] : { x: 0, y: 0 }, ex = r * 0.4;
      if (fr && !eaten) {
        ctx.fillStyle = flick ? '#c33' : '#ffd9b0';
        ctx.fillRect(cx - ex - 2, cy - r * 0.25, 4, 4); ctx.fillRect(cx + ex - 2, cy - r * 0.25, 4, 4);
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.5; ctx.beginPath();
        for (var j = 0; j < 5; j++) ctx.lineTo(cx - r * 0.6 + j * r * 0.3, cy + r * 0.35 + (j & 1 ? -2 : 2)); ctx.stroke();
      } else {
        for (var side = -1; side <= 1; side += 2) {
          var ex0 = cx + side * ex, ey0 = cy - r * 0.2;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex0, ey0, r * 0.3, r * 0.38, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = eaten ? '#7ad7ff' : '#16204f'; ctx.beginPath(); ctx.arc(ex0 + dv.x * r * 0.14, ey0 + dv.y * r * 0.16, r * 0.15, 0, TAU); ctx.fill();
        }
      }
    });
  }

  function drawPlayer(s, time) {
    var ctx = R.ctx, c = R.c, p = s.p, x = Sim.px(p), y = Sim.py(p), face = p.face, ang = [-Math.PI / 2, Math.PI, Math.PI / 2, 0][face];
    var dying = s.state === 'dying';
    if (s.state === 'over') return;
    var open = 0.12 + 0.3 * Math.abs(Math.sin(p.mouth)), t = dying ? Math.min(1, s.stateT / 1.5) : 0;
    if (dying) { open = 0.1 + t * 3.0; }
    eachWrap(s, x, y, function (xx) {
      var cx = R.ox + xx * c + c / 2, cy = R.oy + y * c + c / 2, r = c * 0.44;
      if (dying && t >= 1) return;
      glowAt(cx, cy, c * 1.7, '#ffcf4a', 0.55 * (1 - t));
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      // wings
      var fl = Math.sin(time * 22) * 0.35;
      ctx.globalAlpha = 0.55 * (1 - t);
      for (var sd = -1; sd <= 1; sd += 2) {
        ctx.save(); ctx.rotate(sd * (1.9 + fl)); ctx.fillStyle = sd < 0 ? '#9fe8ff' : '#c3f2ff';
        ctx.beginPath(); ctx.ellipse(r * 0.9, 0, r * 0.95, r * 0.32, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
      var gr = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r); gr.addColorStop(0, '#fff6b0'); gr.addColorStop(0.5, PAL.player); gr.addColorStop(1, '#f08a14');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, open, TAU - open); ctx.closePath(); ctx.fill();
      // antennae and eye
      ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = Math.max(1, c * 0.05); ctx.beginPath(); ctx.moveTo(r * 0.55, -r * 0.7); ctx.quadraticCurveTo(r * 1.05, -r * 1.2, r * 1.2, -r * 0.95); ctx.moveTo(r * 0.55, r * 0.7); ctx.quadraticCurveTo(r * 1.05, r * 1.2, r * 1.2, r * 0.95); ctx.stroke();
      ctx.fillStyle = '#1a1030'; ctx.beginPath(); ctx.arc(r * 0.18, -r * 0.5, r * 0.13, 0, TAU); ctx.fill();
      ctx.restore();
    });
  }

  function burst(x, y, n, color, speed, life, size) {
    for (var i = 0; i < n; i++) { var a = Math.random() * TAU, v = speed * (0.3 + Math.random() * 0.7); R.particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), max: life, color: color, size: size * (0.6 + Math.random() * 0.8) }); }
  }
  R.cellCentre = function (tx, ty) { return { x: R.ox + tx * R.c + R.c / 2, y: R.oy + ty * R.c + R.c / 2 }; };

  /* Turn sim events into VFX (renderer-owned) */
  R.onEvent = function (e) {
    var c = R.c, p;
    switch (e.t) {
      case 'mote': p = R.cellCentre(e.x, e.y); burst(p.x, p.y, 4, '#ffe6a8', c * 3, 0.35, c * 0.06); break;
      case 'bloom': p = R.cellCentre(e.x, e.y); burst(p.x, p.y, 26, '#ff9ee8', c * 7, 0.7, c * 0.1); R.ripples.push({ x: p.x, y: p.y, t: 0, color: '255,150,230', max: c * 6 }); break;
      case 'charge': p = R.cellCentre(e.x, e.y); R.ripples.push({ x: p.x, y: p.y, t: 0, color: '150,230,255', max: c * 3 }); break;
      case 'flip': R.ripples.push({ x: R.w / 2, y: R.h / 2, t: 0, color: e.phase ? '170,120,255' : '255,190,70', max: Math.max(R.w, R.h) * 0.9, wide: true }); R.shake = Math.max(R.shake, c * 0.18); break;
      case 'pinch': p = R.cellCentre(e.x, e.y); burst(p.x, p.y, 36, e.color, c * 9, 0.8, c * 0.12); burst(p.x, p.y, 14, '#ffffff', c * 5, 0.5, c * 0.08); R.shake = Math.max(R.shake, c * 0.5); break;
      case 'eatghost': p = { x: R.ox + e.x * c + c / 2, y: R.oy + e.y * c + c / 2 }; burst(p.x, p.y, 22, e.color, c * 7, 0.6, c * 0.1); R.shake = Math.max(R.shake, c * 0.25); break;
      case 'fruit': p = R.cellCentre(e.x, e.y); burst(p.x, p.y, 20, e.def.c, c * 6, 0.7, c * 0.1); break;
      case 'die': p = { x: R.ox + e.x * c + c / 2, y: R.oy + e.y * c + c / 2 }; setTimeout(function () { burst(p.x, p.y, 40, '#ffd23f', c * 8, 1, c * 0.12); }, 1400); R.shake = c * 0.4; break;
      case 'pop': p = R.cellCentre(e.x, e.y); R.pops.push({ x: p.x, y: p.y, t: 0, text: String(e.n), kind: e.kind }); break;
    }
  };

  R.draw = function (s, dt, time) {
    var ctx = R.ctx, w = R.w, h = R.h, m = s.m, c = R.c;
    R.layout(m);
    var key = m.name + '|' + c + '|' + R.dpr + '|' + R.ox;
    if (R.staticKey !== key) { R.staticLayer = buildStatic(m); R.staticKey = key; }
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    var bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, PAL.bg0); bg.addColorStop(1, PAL.bg1); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < R.stars.length; i++) { var st = R.stars[i]; ctx.globalAlpha = 0.25 + 0.4 * Math.abs(Math.sin(time * st.z + st.p)); ctx.fillStyle = '#b9c8ff'; ctx.fillRect(st.x * w, (st.y * h + time * 4 * st.z) % h, 1.5 * st.z, 1.5 * st.z); }
    ctx.globalAlpha = 1;
    var sx = 0, sy = 0; if (R.shake > 0.2) { sx = (Math.random() - 0.5) * R.shake; sy = (Math.random() - 0.5) * R.shake; R.shake *= Math.pow(0.001, dt); } else R.shake = 0;
    ctx.save(); ctx.translate(sx, sy);
    // phase aura under the maze
    var ac = s.phase ? '170,120,255' : '255,190,70', ag = ctx.createRadialGradient(w / 2, h / 2, c * 2, w / 2, h / 2, Math.max(w, h) * 0.7);
    ag.addColorStop(0, 'rgba(' + ac + ',0.10)'); ag.addColorStop(1, 'rgba(' + ac + ',0)'); ctx.fillStyle = ag; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(R.staticLayer, R.ox - 2, R.oy - c * 0.2, R.staticLayer.width / R.dpr, R.staticLayer.height / R.dpr);
    drawPhaseWalls(s, time);
    drawMotes(s, time);
    for (var gi = 0; gi < s.ghosts.length; gi++) if (s.ghosts[gi].state !== 'eaten') drawGhost(s, s.ghosts[gi], time);
    for (gi = 0; gi < s.ghosts.length; gi++) if (s.ghosts[gi].state === 'eaten') drawGhost(s, s.ghosts[gi], time);
    drawPlayer(s, time);
    // particles
    for (var k = R.particles.length - 1; k >= 0; k--) {
      var p = R.particles[k]; p.life -= dt; if (p.life <= 0) { R.particles.splice(k, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
      var a = p.life / p.max; ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a), 0, TAU); ctx.fill();
      glowAt(p.x, p.y, p.size * 4, p.color, a * 0.6);
    }
    ctx.globalAlpha = 1;
    for (k = R.ripples.length - 1; k >= 0; k--) {
      var rp = R.ripples[k]; rp.t += dt / (rp.wide ? 0.55 : 0.5); if (rp.t >= 1) { R.ripples.splice(k, 1); continue; }
      ctx.strokeStyle = 'rgba(' + rp.color + ',' + (1 - rp.t) * (rp.wide ? 0.55 : 0.8) + ')'; ctx.lineWidth = (rp.wide ? 6 : 3) * (1 - rp.t) + 1;
      ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.max * rp.t, 0, TAU); ctx.stroke();
    }
    var colors = { pinch: '#ff9ee8', ghost: '#9fe8ff', fruit: '#a8ffb0', bloom: '#ffd1f4', bonus: '#ffe38a', score: '#fff' };
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (k = R.pops.length - 1; k >= 0; k--) {
      var pp = R.pops[k]; pp.t += dt; if (pp.t > 1.1) { R.pops.splice(k, 1); continue; }
      var sc = pp.kind === 'pinch' ? 1.25 : 1, fs = Math.round(c * 0.72 * sc);
      ctx.font = '900 ' + fs + 'px "Trebuchet MS", system-ui, sans-serif'; ctx.globalAlpha = Math.min(1, (1.1 - pp.t) * 2);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(5,8,26,0.9)'; ctx.strokeText(pp.text, pp.x, pp.y - pp.t * c * 1.4);
      ctx.fillStyle = colors[pp.kind] || '#fff'; ctx.fillText(pp.text, pp.x, pp.y - pp.t * c * 1.4);
    }
    ctx.globalAlpha = 1; ctx.restore();
    // vignette
    var vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  };
})(typeof window !== 'undefined' ? window : globalThis);
