/* Prism Warden renderer: procedural Canvas2D, data-driven by room.
 * Static ground, walls, props and baked lighting are rendered once per room geometry
 * and pixel density into an offscreen canvas; each frame only composites that layer
 * with animated water, light, actors and effects. Never mutates simulation state. */
(function (root) {
  'use strict';
  const PW = root.PW = root.PW || {};
  const TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const SUN = '255,205,120', MINT = '150,255,214', SPLIT = '205,180,255', RED = '255,96,72', WARM = '255,168,82', COOL = '150,200,255';
  const INK = '#0b1a20';
  const SCALE_HERO = 1.3, SCALE_ILEX = 1.2, SCALE_SENTINEL = 1.15;

  // ---------------------------------------------------------------- camera
  function dims(s) {
    const r = s && s.room;
    return { W: r && r.w > 0 ? r.w : 1024, H: r && r.h > 0 ? r.h : 768 };
  }
  function view(s, width, height) {
    width = Math.max(1, width); height = Math.max(1, height);
    const { W, H } = dims(s);
    const closeScale = width < 650 ? Math.min(width / 500, height / 440) : 0;
    const scale = Math.max(width / W, height / H, closeScale);
    const w = width / scale, h = height / scale;
    const p = s && s.player || { x: 190, y: 540 };
    return {
      x: W > w ? clamp(num(p.x, W / 2) - w / 2, 0, W - w) : (W - w) / 2,
      y: H > h ? clamp(num(p.y, H / 2) - h / 2, 0, H - h) : (H - h) / 2, w, h, scale
    };
  }
  PW.view = view;
  PW.screenToWorld = function (s, w, h, x, y) {
    const v = view(s, w, h);
    return { x: v.x + x / v.scale, y: v.y + y / v.scale };
  };

  // ---------------------------------------------------------------- utilities
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rngFor(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hsl = (h, s, l, a) => a === undefined ? `hsl(${h},${s}%,${l}%)` : `hsla(${h},${s}%,${l}%,${a})`;
  function jit(c, rng, dh, ds, dl) {
    return hsl(c[0] + (rng() - .5) * dh, clamp(c[1] + (rng() - .5) * ds, 0, 100), clamp(c[2] + (rng() - .5) * dl, 0, 100));
  }
  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath(); for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function line(ctx, x, y, x2, y2, color, width) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width || 1; ctx.stroke();
  }
  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function ellipse(ctx, x, y, rx, ry, fill, stroke, lw, rot) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot || 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function text(ctx, str, x, y, size, color, align, weight) {
    ctx.font = `${weight || 700} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2.5, size * .32); ctx.strokeStyle = 'rgba(6,16,22,.92)';
    ctx.strokeText(str, x, y); ctx.fillStyle = color || '#eff7e8'; ctx.fillText(str, x, y);
  }
  // Top-left lit radial gradient for glossy "toy" shading.
  function rg(ctx, x, y, r, c0, c1) {
    const g = ctx.createRadialGradient(x, y, r * .05, x + r * .3, y + r * .35, r * 1.25);
    g.addColorStop(0, c0); g.addColorStop(1, c1); return g;
  }
  const glowCache = new Map();
  function glowSprite(rgb) {
    let c = glowCache.get(rgb);
    if (c) return c;
    c = makeCanvas(96, 96); const g = c.getContext('2d');
    const gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(.18, `rgba(${rgb},.62)`);
    gr.addColorStop(.45, `rgba(${rgb},.2)`); gr.addColorStop(.75, `rgba(${rgb},.05)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 96, 96); glowCache.set(rgb, c); return c;
  }
  // Additive bloom: caller must already be in 'lighter' mode.
  function bloom(ctx, x, y, r, rgb, a) {
    if (!hasDoc || r <= 0 || a <= 0) return;
    ctx.globalAlpha = clamp(a, 0, 1); ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }
  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, ll = dx * dx + dy * dy;
    const t = ll > 1e-6 ? clamp(((px - x1) * dx + (py - y1) * dy) / ll, 0, 1) : 0;
    return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
  }
  function rectDist(px, py, r) {
    return Math.hypot(Math.max(r.x - px, 0, px - (r.x + r.w)), Math.max(r.y - py, 0, py - (r.y + r.h)));
  }
  const arr = v => (Array.isArray(v) ? v : []);
  const finiteRect = r => r && [r.x, r.y, r.w, r.h].every(Number.isFinite);
  const inRect = (x, y, r, pad) => x >= r.x - (pad || 0) && x <= r.x + r.w + (pad || 0) && y >= r.y - (pad || 0) && y <= r.y + r.h + (pad || 0);

  // ---------------------------------------------------------------- room data helpers
  function roomId(s) { return (s.room && s.room.id) || s.roomId || 'cloister'; }
  function emittersOf(s) { return arr(s.emitters).length ? s.emitters : (s.emitter ? [s.emitter] : []); }
  function receiverKind(r) { return r.kind || (r.id === 'sanctuary' ? 'sanctuary' : 'seal'); }
  function tideOn(s) { return !!(s.tide && s.tide.active !== false && (s.tide.active || Number.isFinite(s.tide.level))); }
  function tideHigh(s) { return !!(tideOn(s) && s.tide.high); }
  function tideWarn(s) { return tideOn(s) ? clamp(num(s.tide.warning, 0), 0, 1) : 0; }
  function zoneActive(z, s) {
    if (typeof z.deep === 'boolean') return z.deep;
    if (typeof z.up === 'boolean') return z.up;
    if (typeof z.raised === 'boolean') return z.raised;
    if (typeof z.risen === 'boolean') return z.risen;
    if (typeof z.active === 'boolean') return z.active;
    if (!z.when || z.when === 'always') return true;
    return (z.when === 'high') === tideHigh(s);
  }
  // Will this zone flip at the imminent tide change?
  function zoneFlipSoon(z, s) {
    if (z.held) return true;
    if (!tideOn(s) || !z.when || z.when === 'always' || tideWarn(s) <= 0) return false;
    return true;
  }
  function tideDepth(z, s) {
    if (!tideOn(s) || !z.when || z.when === 'always') return 1;
    const lv = clamp(num(s.tide.level, tideHigh(s) ? 1 : 0), 0, 1);
    return z.when === 'high' ? lv : 1 - lv;
  }
  function sanctZone(s) { return s.sanctuaryZone || (s.sanctuary && typeof s.sanctuary === 'object' ? s.sanctuary : null); }
  function enemyType(e) { return e.type || 'sentinel'; }
  function roomName(id) {
    if (PW.ROOMS && PW.ROOMS[id] && PW.ROOMS[id].name) return PW.ROOMS[id].name;
    for (const region of arr(PW.REGIONS)) for (const r of arr(region.rooms)) if (r.id === id) return r.name;
    return String(id || '').replace(/-/g, ' ');
  }
  const ROOM_ORDER = ['cloister', 'sluice', 'sanctuary', 'shutters', 'bell-tower', 'beacon'];

  // ---------------------------------------------------------------- themes
  const THEMES = {
    cloister: { grade: ['#ffe2b0', '#1d5a6a'], floor: 'flag', stone: [96, 9, 41], joint: '#1b2523', moss: .6, puddles: 5, top: [44, 16, 58], face: [38, 16, 33], wall: 'ashlar', ambient: [134, 140, 154], void: '#081b23', vignette: .5, decor: 'cloister', water: [185, 60, 26], title: 'The drowned cloister' },
    sluice: { grade: ['#cfe8f0', '#12384a'], floor: 'slate', stone: [203, 13, 33], joint: '#0e171c', moss: .45, puddles: 11, top: [200, 9, 45], face: [205, 14, 25], wall: 'slate', ambient: [112, 128, 150], void: '#05131b', vignette: .58, decor: 'sluice', water: [188, 64, 24], title: 'Where the sea is let in' },
    sanctuary: { grade: ['#ffd28a', '#2a4a2a'], floor: 'octa', stone: [36, 18, 43], joint: '#211c14', moss: 1.3, puddles: 2, top: [68, 12, 47], face: [58, 14, 26], wall: 'ashlar', ambient: [100, 92, 98], void: '#0a130e', vignette: .7, decor: 'sanctuary', water: [165, 55, 24], title: 'Candles still burn' },
    shutters: { grade: ['#c8c8ff', '#1a1f3a'], floor: 'octa', stone: [222, 11, 31], joint: '#0c0f15', moss: .1, puddles: 4, top: [224, 9, 37], face: [228, 14, 19], wall: 'basalt', ambient: [92, 100, 130], void: '#06080e', vignette: .7, decor: 'shutters', water: [200, 60, 24], title: 'The keepers’ passages' },
    'bell-tower': { grade: ['#ffc890', '#4a2418'], floor: 'planks', stone: [27, 32, 31], joint: '#1a100a', moss: .04, puddles: 0, top: [12, 30, 39], face: [10, 32, 22], wall: 'brick', ambient: [134, 110, 100], void: '#100908', vignette: .62, decor: 'bell', water: [190, 60, 24], title: 'Two bells, one light' },
    beacon: { grade: ['#f0e6d0', '#34486a'], floor: 'cobble', stone: [30, 6, 36], joint: '#0b1014', moss: .35, puddles: 7, top: [212, 7, 33], face: [214, 12, 16], wall: 'rock', ambient: [150, 158, 182], void: '#040b12', vignette: .72, decor: 'beacon', water: [195, 60, 20], title: 'The abbey’s last light' }
  };
  function themeFor(s) { return THEMES[roomId(s)] || THEMES.cloister; }

  // ---------------------------------------------------------------- static layer
  function stonePath(g, x, y, w, h, rng, j) {
    const c = Math.min(w, h) * .2;
    const pts = [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]];
    g.beginPath();
    pts.forEach((p, i) => { const px = p[0] + (rng() - .5) * j, py = p[1] + (rng() - .5) * j; i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.closePath();
  }
  function stone(g, x, y, w, h, color, rng, o) {
    o = o || {};
    stonePath(g, x, y, w, h, rng, o.jit === undefined ? 3 : o.jit);
    g.fillStyle = color; g.fill();
    const gr = g.createLinearGradient(x, y, x + w * .35, y + h);
    gr.addColorStop(0, `rgba(255,250,232,${o.hi || .14})`); gr.addColorStop(.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(0,0,0,${o.lo || .26})`);
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1; g.stroke();
    // top-left catch light
    g.beginPath(); g.moveTo(x + 3, y + h - 4); g.lineTo(x + 2, y + 3); g.lineTo(x + w - 4, y + 2);
    g.strokeStyle = `rgba(255,248,225,${o.rim || .12})`; g.lineWidth = 1; g.stroke();
    const n = Math.floor(w * h / (o.speck || 160));
    for (let i = 0; i < n; i++) {
      g.fillStyle = rng() < .5 ? 'rgba(0,0,0,.13)' : 'rgba(255,255,240,.08)';
      const sz = .8 + rng() * 1.6; g.fillRect(x + 2 + rng() * (w - 4), y + 2 + rng() * (h - 4), sz, sz);
    }
    if (rng() < (o.crack === undefined ? .16 : o.crack)) {
      let cx = x + w * (.2 + rng() * .6), cy = y + 2; g.beginPath(); g.moveTo(cx, cy);
      for (let i = 0; i < 4; i++) { cx += (rng() - .5) * w * .35; cy += h * (.15 + rng() * .2); g.lineTo(cx, Math.min(cy, y + h - 2)); }
      g.strokeStyle = 'rgba(8,14,14,.45)'; g.lineWidth = .9; g.stroke();
    }
    if (rng() < (o.chip || .18)) { const cx = rng() < .5 ? x + 2 : x + w - 8, cy = rng() < .5 ? y + 2 : y + h - 7; poly(g, [[cx, cy], [cx + 6, cy + 1], [cx + 2, cy + 5]], 'rgba(0,0,0,.3)'); }
  }
  function floorFlag(g, W, H, rng, th) {
    g.fillStyle = hsl(th.stone[0], th.stone[1], Math.max(6, th.stone[2] - 16)); g.fillRect(0, 0, W, H);
    for (let y = 0; y < H;) {
      const rh = 36 + Math.floor(rng() * 18);
      for (let x = -rng() * 60; x < W;) {
        const rw = 42 + rng() * 54;
        stone(g, x + 1.5, y + 1.5, rw - 2.5, rh - 2.5, jit(th.stone, rng, 10, 8, 8), rng, { hi: .09, lo: .2, rim: .08, jit: 2.2 });
        x += rw;
      }
      y += rh;
    }
  }
  function floorSlate(g, W, H, rng, th) {
    g.fillStyle = hsl(th.stone[0], th.stone[1], Math.max(6, th.stone[2] - 16)); g.fillRect(0, 0, W, H);
    let row = 0;
    for (let y = 0; y < H; y += 28, row++) {
      for (let x = row % 2 ? -30 : -4; x < W;) {
        const rw = 44 + rng() * 30;
        stone(g, x + 1.2, y + 1.2, rw - 2.4, 25.6, jit(th.stone, rng, 8, 8, 7), rng, { jit: 1.2, hi: .08, lo: .18, rim: .07, crack: .1 });
        if (rng() < .45) { // wet sheen streak
          g.strokeStyle = 'rgba(200,230,245,.10)'; g.lineWidth = 1.4;
          const sx = x + rng() * rw; g.beginPath(); g.moveTo(sx, y + 6); g.lineTo(sx + 16, y + 26); g.stroke();
        }
        x += rw;
      }
    }
  }
  function floorOcta(g, W, H, rng, th) {
    const S = 48, c = 13;
    g.fillStyle = hsl(th.stone[0], th.stone[1], Math.max(6, th.stone[2] - 16)); g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += S) for (let x = 0; x < W; x += S) {
      const col = jit(th.stone, rng, 7, 8, 8);
      g.beginPath();
      [[x + c, y + 1.5], [x + S - c, y + 1.5], [x + S - 1.5, y + c], [x + S - 1.5, y + S - c], [x + S - c, y + S - 1.5], [x + c, y + S - 1.5], [x + 1.5, y + S - c], [x + 1.5, y + c]]
        .forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.closePath(); g.fillStyle = col; g.fill();
      const gr = g.createLinearGradient(x, y, x + S * .4, y + S);
      gr.addColorStop(0, 'rgba(255,248,230,.15)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.28)');
      g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
      line(g, x + c, y + 3, x + S - c, y + 3, 'rgba(255,245,220,.13)', 1);
      for (let i = 0; i < 12; i++) { g.fillStyle = rng() < .5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,240,.07)'; g.fillRect(x + 4 + rng() * (S - 8), y + 4 + rng() * (S - 8), 1.3, 1.3); }
      // diamond insert at the corner
      const dx = x + S, dy = y + S, d = c * .72, dc = jit([th.stone[0] + 10, th.stone[1] + 8, th.stone[2] - 8], rng, 6, 6, 6);
      poly(g, [[dx, dy - d], [dx + d, dy], [dx, dy + d], [dx - d, dy]], dc, 'rgba(0,0,0,.4)', 1);
      line(g, dx - d + 2, dy - 1, dx - 1, dy - d + 2, 'rgba(255,240,210,.14)', 1);
    }
  }
  function floorPlanks(g, W, H, rng, th) {
    g.fillStyle = hsl(th.stone[0], th.stone[1], Math.max(6, th.stone[2] - 16)); g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 22) {
      for (let x = -rng() * 150; x < W;) {
        const len = 110 + rng() * 170, col = jit(th.stone, rng, 6, 10, 9);
        g.fillStyle = col; g.fillRect(x + 1, y + 1, len - 2, 20);
        const gr = g.createLinearGradient(0, y, 0, y + 22);
        gr.addColorStop(0, 'rgba(255,230,200,.13)'); gr.addColorStop(.4, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.28)');
        g.fillStyle = gr; g.fillRect(x + 1, y + 1, len - 2, 20);
        g.strokeStyle = 'rgba(40,20,10,.35)'; g.lineWidth = .8;
        for (let i = 0; i < 4; i++) {
          const gy = y + 4 + rng() * 14, amp = rng() * 2; g.beginPath(); g.moveTo(x + 4, gy);
          for (let k = 1; k <= 6; k++) g.lineTo(x + 4 + (len - 8) * k / 6, gy + Math.sin(k * 1.7 + i) * amp);
          g.stroke();
        }
        if (rng() < .3) ellipse(g, x + 20 + rng() * (len - 40), y + 11, 4, 2.2, 'rgba(40,20,10,.45)');
        circle(g, x + 6, y + 6, 1.2, '#2a1c14'); circle(g, x + 6, y + 16, 1.2, '#2a1c14');
        x += len;
      }
    }
  }
  function floorCobble(g, W, H, rng, th) {
    g.fillStyle = hsl(th.stone[0], th.stone[1], Math.max(6, th.stone[2] - 16)); g.fillRect(0, 0, W, H);
    const S = 34;
    for (let y = -S; y < H + S; y += S * .82) for (let x = -S; x < W + S; x += S) {
      const ox = x + (rng() - .5) * 12 + ((y / S | 0) % 2) * S * .5, oy = y + (rng() - .5) * 10, r = S * (.46 + rng() * .16);
      g.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * TAU, rr = r * (.82 + rng() * .24);
        const px = ox + Math.cos(a) * rr, py = oy + Math.sin(a) * rr * .86; i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.fillStyle = jit(th.stone, rng, 10, 6, 9); g.fill();
      const gr = g.createRadialGradient(ox - r * .35, oy - r * .45, 1, ox, oy, r * 1.1);
      gr.addColorStop(0, 'rgba(210,225,240,.2)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.35)');
      g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.2; g.stroke();
      if (rng() < .5) { g.strokeStyle = 'rgba(220,240,255,.16)'; g.lineWidth = 1.2; g.beginPath(); g.arc(ox - r * .15, oy - r * .1, r * .6, 3.6, 4.6); g.stroke(); }
    }
  }
  const FLOORS = { flag: floorFlag, slate: floorSlate, octa: floorOcta, planks: floorPlanks, cobble: floorCobble };

  function mossClump(g, x, y, size, rng, alpha) {
    for (let i = 0; i < 7; i++) {
      const a = rng() * TAU, d = rng() * size;
      ellipse(g, x + Math.cos(a) * d, y + Math.sin(a) * d * .7, size * (.25 + rng() * .35), size * (.18 + rng() * .25), hsl(88 + rng() * 30, 35 + rng() * 20, 24 + rng() * 14, alpha));
    }
    for (let i = 0; i < 5; i++) circle(g, x + (rng() - .5) * size * 1.4, y + (rng() - .5) * size, .9, hsl(80, 50, 55, alpha * .8));
  }
  function puddle(g, x, y, rx, ry, rng) {
    g.save(); g.beginPath();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = .8 + rng() * .3; const px = x + Math.cos(a) * rx * r, py = y + Math.sin(a) * ry * r; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath(); g.fillStyle = 'rgba(12,34,44,.55)'; g.fill();
    g.clip();
    const gr = g.createLinearGradient(x - rx, y - ry, x + rx, y + ry); gr.addColorStop(0, 'rgba(170,215,230,.28)'); gr.addColorStop(.5, 'rgba(90,140,160,.06)'); gr.addColorStop(1, 'rgba(170,215,230,.16)');
    g.fillStyle = gr; g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
    line(g, x - rx * .5, y - ry * .2, x + rx * .1, y - ry * .5, 'rgba(230,250,255,.35)', 1.2);
    g.restore();
    ellipse(g, x, y, rx * 1.02, ry * 1.02, null, 'rgba(0,0,0,.25)', 1);
  }
  function grime(g, W, H, rng, n) {
    for (let i = 0; i < n; i++) {
      const x = rng() * W, y = rng() * H, r = 30 + rng() * 110;
      const gr = g.createRadialGradient(x, y, 0, x, y, r), dark = rng() < .6;
      gr.addColorStop(0, dark ? 'rgba(10,14,12,.16)' : 'rgba(255,245,215,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  function wallDist(x, y, walls) { let d = Infinity; for (const w of walls) d = Math.min(d, rectDist(x, y, w)); return d; }
  function keepClear(s) {
    const out = [];
    for (const r of arr(s.exits).concat(arr(s.gates), arr(s.water), arr(s.breakwaters), arr(s.shutters))) if (finiteRect(r)) out.push({ x: r.x - 26, y: r.y - 26, w: r.w + 52, h: r.h + 52 });
    for (const p of emittersOf(s).concat(arr(s.receivers), arr(s.mirrors), arr(s.pickups), s.beacon ? [s.beacon] : [], s.rescue ? [s.rescue] : []))
      if (p && Number.isFinite(p.x)) out.push({ x: p.x - 48, y: p.y - 48, w: 96, h: 96 });
    if (s.escortExit && finiteRect(s.escortExit)) out.push(s.escortExit);
    return out;
  }
  function spots(s, rng, count, minD, maxD, sep, W, H) {
    const walls = arr(s.walls).filter(finiteRect), clear = keepClear(s), got = [];
    for (let tries = 0; tries < count * 60 && got.length < count; tries++) {
      const x = 20 + rng() * (W - 40), y = 20 + rng() * (H - 40);
      if (walls.some(w => inRect(x, y, w))) continue;
      const d = wallDist(x, y, walls);
      if (d < minD || d > maxD) continue;
      if (clear.some(r => inRect(x, y, r))) continue;
      if (got.some(p => Math.hypot(p.x - x, p.y - y) < sep)) continue;
      got.push({ x, y });
    }
    return got;
  }

  function wallFaces(walls) {
    // Visible south faces: bottom edge portions not touching another wall.
    const faces = [];
    for (const w of walls) {
      let start = null;
      for (let x = w.x; x <= w.x + w.w + .01; x += 4) {
        const px = Math.min(x, w.x + w.w - .5);
        const covered = walls.some(o => o !== w && inRect(px, w.y + w.h + 1.5, o));
        if (!covered && start === null) start = px;
        if ((covered || x + 4 > w.x + w.w + .01) && start !== null) {
          const end = covered ? px : w.x + w.w;
          if (end - start > 2) faces.push({ x: start, y: w.y + w.h, w: end - start });
          start = null;
        }
      }
    }
    return faces;
  }
  function edgeSegs(walls, w, side) {
    const segs = []; let start = null;
    const horiz = side === 'top' || side === 'bottom';
    const len = horiz ? w.w : w.h;
    for (let d = 0; d <= len + .01; d += 4) {
      const dd = Math.min(d, len - .5);
      const px = horiz ? w.x + dd : (side === 'left' ? w.x - 1.5 : w.x + w.w + 1.5);
      const py = horiz ? (side === 'top' ? w.y - 1.5 : w.y + w.h + 1.5) : w.y + dd;
      const covered = walls.some(o => o !== w && inRect(px, py, o));
      if (!covered && start === null) start = dd;
      if ((covered || d + 4 > len + .01) && start !== null) { segs.push([start, covered ? dd : len]); start = null; }
    }
    return segs;
  }
  const FH = 28;
  function drawWalls(g, s, th, rng, W, H, meta) {
    const walls = arr(s.walls).filter(finiteRect);
    if (!walls.length) return;
    const k = meta.k;
    // Ambient occlusion: soft drop shadow and tight contact shadow on the floor.
    g.save();
    g.shadowColor = 'rgba(2,8,12,.7)'; g.shadowBlur = 26 * k; g.shadowOffsetY = 14 * k; g.fillStyle = '#05090b';
    for (const w of walls) g.fillRect(w.x, w.y, w.w, w.h + FH);
    g.shadowBlur = 7 * k; g.shadowOffsetY = 4 * k; g.shadowColor = 'rgba(0,4,6,.8)';
    for (const w of walls) g.fillRect(w.x, w.y, w.w, w.h + FH);
    g.restore();
    const faces = wallFaces(walls);
    // South faces.
    g.save(); g.beginPath(); for (const f of faces) g.rect(f.x, f.y - .5, f.w, FH + .5); g.clip();
    const fg = g.createLinearGradient(0, 0, 0, 1);
    for (const f of faces) {
      const gr = g.createLinearGradient(0, f.y, 0, f.y + FH);
      gr.addColorStop(0, hsl(th.face[0], th.face[1], th.face[2] + 8)); gr.addColorStop(1, hsl(th.face[0], th.face[1], th.face[2] - 9));
      g.fillStyle = gr; g.fillRect(f.x, f.y, f.w, FH);
      if (th.wall === 'rock') {
        for (let x = f.x; x < f.x + f.w; x += 9 + rng() * 10) {
          ellipse(g, x, f.y + 4 + rng() * 8, 6 + rng() * 6, 4 + rng() * 3, hsl(th.face[0], th.face[1], th.face[2] + (rng() - .3) * 10), 'rgba(0,0,0,.35)', 1);
        }
      } else {
        const course = th.wall === 'brick' ? 5.3 : 8;
        for (let y = f.y + course; y < f.y + FH - 1; y += course) line(g, f.x, y, f.x + f.w, y, 'rgba(0,0,0,.35)', 1);
        let row = 0;
        for (let y = f.y; y < f.y + FH - 1; y += course, row++) {
          const bw = th.wall === 'brick' ? 12 : th.wall === 'slate' ? 26 : 20;
          for (let x = f.x + (row % 2) * bw / 2; x < f.x + f.w; x += bw + (th.wall === 'brick' ? 0 : rng() * 8)) {
            line(g, x, y + .5, x, y + course - .5, 'rgba(0,0,0,.32)', 1);
            line(g, x + 1, y + 1, x + bw - 3, y + 1, 'rgba(255,240,220,.09)', 1);
          }
        }
      }
      if (th.decor === 'sluice') for (let x = f.x + 8; x < f.x + f.w; x += 14 + rng() * 22) { g.fillStyle = 'rgba(10,20,26,.28)'; g.fillRect(x, f.y + 2, 3 + rng() * 5, FH - 2); }
      if (th.decor === 'shutters') { line(g, f.x, f.y + 6, f.x + f.w, f.y + 6, '#7a5a2e', 2); line(g, f.x, f.y + 5, f.x + f.w, f.y + 5, 'rgba(255,210,140,.35)', .7); }
      if (th.decor === 'sluice' || th.decor === 'beacon') { g.fillStyle = 'rgba(52,96,70,.55)'; g.fillRect(f.x, f.y + FH - 4, f.w, 4); }
      line(g, f.x, f.y + FH - .5, f.x + f.w, f.y + FH - .5, 'rgba(0,0,0,.55)', 1.5);
    }
    void fg;
    g.restore();
    // Top faces clipped to the union so adjoining walls read as one mass.
    g.save(); g.beginPath(); for (const w of walls) g.rect(w.x, w.y, w.w, w.h); g.clip();
    g.fillStyle = hsl(th.top[0], th.top[1], th.top[2] - 12); g.fillRect(0, 0, W, H);
    if (th.wall === 'rock') {
      for (let y = 0; y < H + 30; y += 22) for (let x = -20; x < W + 30; x += 26) {
        const ox = x + (rng() - .5) * 12 + ((y / 22 | 0) % 2) * 13, oy = y + (rng() - .5) * 8;
        if (!walls.some(w => inRect(ox, oy, w, 20))) continue;
        const r = 13 + rng() * 9;
        ellipse(g, ox, oy, r, r * .8, jit(th.top, rng, 8, 6, 12), 'rgba(0,0,0,.45)', 1.2);
        const gr = g.createRadialGradient(ox - r * .4, oy - r * .5, 1, ox, oy, r);
        gr.addColorStop(0, 'rgba(210,225,240,.26)'); gr.addColorStop(1, 'rgba(0,0,0,.2)'); g.fillStyle = gr; g.fill();
      }
    } else {
      const bw = th.wall === 'brick' ? 18 : th.wall === 'slate' ? 36 : th.wall === 'basalt' ? 30 : 34;
      const bh = th.wall === 'brick' ? 9 : th.wall === 'slate' ? 18 : 24;
      let row = 0;
      for (let y = 0; y < H; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < W; x += bw) {
        if (!walls.some(w => inRect(x + bw / 2, y + bh / 2, w, bw))) continue;
        stone(g, x + 1, y + 1, bw - 2, bh - 2, jit(th.top, rng, 7, 8, 9), rng, { jit: th.wall === 'basalt' ? .8 : 1.5, speck: 70, crack: .08, hi: .16, lo: .3 });
      }
    }
    // Inner edge shading: the parts of wide walls far from the floor are in shade.
    g.restore();
    // Rim lights and outlines, only on edges exposed to floor.
    for (const w of walls) {
      for (const [a, b] of edgeSegs(walls, w, 'top')) { line(g, w.x + a, w.y + .8, w.x + b, w.y + .8, hsl(th.top[0], th.top[1], th.top[2] + 20, .75), 1.6); line(g, w.x + a, w.y - .4, w.x + b, w.y - .4, 'rgba(0,0,0,.55)', 1); }
      for (const [a, b] of edgeSegs(walls, w, 'bottom')) line(g, w.x + a, w.y + w.h - .8, w.x + b, w.y + w.h - .8, hsl(th.top[0], th.top[1], th.top[2] + 26, .9), 1.8);
      for (const [a, b] of edgeSegs(walls, w, 'left')) { line(g, w.x + .8, w.y + a, w.x + .8, w.y + b, hsl(th.top[0], th.top[1], th.top[2] + 14, .6), 1.3); line(g, w.x - .5, w.y + a, w.x - .5, w.y + b + FH, 'rgba(0,0,0,.5)', 1); }
      for (const [a, b] of edgeSegs(walls, w, 'right')) { line(g, w.x + w.w - .8, w.y + a, w.x + w.w - .8, w.y + b, 'rgba(0,0,0,.35)', 1.6); line(g, w.x + w.w + .5, w.y + a, w.x + w.w + .5, w.y + b + FH, 'rgba(0,0,0,.5)', 1); }
    }
    wallDecor(g, s, th, rng, walls, faces, W, H, meta);
  }
  function wallDecor(g, s, th, rng, walls, faces, W, H, meta) {
    const cx = W / 2, cy = H / 2;
    if (th.decor === 'cloister' || th.decor === 'sanctuary') {
      // Colonnade capitals along the inner edge of thick walls.
      for (const w of walls) {
        if (Math.min(w.w, w.h) < 34 || Math.max(w.w, w.h) < 160) continue;
        const horiz = w.w >= w.h, n = Math.floor((horiz ? w.w : w.h) / 118);
        for (let i = 0; i < n; i++) {
          const f = (i + .5) / n;
          let x, y;
          if (horiz) { x = w.x + w.w * f; y = cy > w.y + w.h / 2 ? w.y + w.h - 15 : w.y + 15; }
          else { y = w.y + w.h * f; x = cx > w.x + w.w / 2 ? w.x + w.w - 15 : w.x + 15; }
          if (arr(s.exits).some(e => inRect(x, y, e, 30))) continue;
          ellipse(g, x + 3, y + 5, 15, 12, 'rgba(0,0,0,.35)');
          circle(g, x, y, 14, hsl(th.top[0], th.top[1], th.top[2] + 6), 'rgba(0,0,0,.5)', 1.4);
          circle(g, x, y, 10, hsl(th.top[0], th.top[1], th.top[2] - 2), 'rgba(255,245,220,.25)', 1);
          circle(g, x - 3, y - 3, 4, 'rgba(255,248,230,.18)');
          if (rng() < th.moss * .7) mossClump(g, x + (rng() - .5) * 14, y + 6, 6, rng, .8);
        }
      }
    }
    if (th.moss > .3) {
      for (const f of faces) for (let x = f.x + 6; x < f.x + f.w - 6; x += 18 + rng() * 40) {
        if (rng() > th.moss * .6) continue;
        mossClump(g, x, f.y - 3, 5 + rng() * 5, rng, .85);
        if (th.decor === 'sanctuary' && rng() < .7) { // hanging ivy
          let vy = f.y - 2, vx = x; g.strokeStyle = '#2f4d22'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(vx, vy);
          const len = 10 + rng() * 22;
          for (let i = 0; i < 5; i++) { vx += (rng() - .5) * 4; vy += len / 5; g.lineTo(vx, vy); }
          g.stroke();
          for (let i = 0; i < 5; i++) ellipse(g, x + (rng() - .5) * 6, f.y + rng() * len, 2.6, 1.6, hsl(95 + rng() * 25, 45, 30 + rng() * 12), null, 0, rng() * 3);
        }
      }
    }
    if (th.decor === 'bell') {
      for (const w of walls) {
        if (w.w < w.h || w.h < 30) continue;
        for (let x = w.x + 40; x < w.x + w.w - 20; x += 128) {
          g.fillStyle = '#4a2e1c'; g.fillRect(x - 6, w.y + 2, 12, w.h - 4);
          g.fillStyle = 'rgba(255,210,160,.14)'; g.fillRect(x - 6, w.y + 2, 3, w.h - 4);
          g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 3, w.y + 2, 3, w.h - 4);
          circle(g, x, w.y + 8, 1.6, '#c09a5a'); circle(g, x, w.y + w.h - 8, 1.6, '#c09a5a');
        }
      }
    }
    if (th.decor === 'shutters' || th.decor === 'sluice') {
      // Bronze lamps / sluice spouts on north-facing faces.
      for (const f of faces) {
        if (f.w < 90) continue;
        for (let x = f.x + 70; x < f.x + f.w - 40; x += 170) {
          if (arr(s.exits).some(e => inRect(x, f.y, e, 40))) continue;
          if (th.decor === 'shutters') {
            poly(g, [[x - 5, f.y + 2], [x + 5, f.y + 2], [x + 4, f.y + 12], [x - 4, f.y + 12]], '#6d5028', '#2a1c0c', 1);
            circle(g, x, f.y + 8, 3.2, '#fff1c8');
            meta.lights.push({ x, y: f.y + 18, r: 120, rgb: '255,214,150', a: .5, flicker: 1 });
          } else {
            rrect(g, x - 9, f.y + 3, 18, 10, 3); g.fillStyle = '#1c2a30'; g.fill(); g.strokeStyle = '#5d7078'; g.lineWidth = 1.2; g.stroke();
            for (let i = -6; i <= 6; i += 4) line(g, x + i, f.y + 4, x + i, f.y + 12, '#43565c', 1.2);
            meta.spouts.push({ x, y: f.y + 13 });
          }
        }
      }
    }
    if (th.decor === 'beacon') {
      // Barnacles on exposed rock.
      for (const f of faces) for (let x = f.x + 5; x < f.x + f.w; x += 6 + rng() * 14) circle(g, x, f.y + FH - 3 - rng() * 5, 1.4 + rng() * 1.4, 'rgba(220,225,215,.45)', 'rgba(0,0,0,.4)', .6);
    }
    // Set dressing that lives on the masonry itself, so it never reads as a floor obstacle.
    const onExit = (x, y) => arr(s.exits).some(e => inRect(x, y, e, 36)) || arr(s.gates).some(gt => inRect(x, y, gt, 30));
    if (th.decor === 'cloister' || th.decor === 'sluice') {
      for (const f of faces) for (let x = f.x + 20; x < f.x + f.w - 10; x += 40 + rng() * 90) {
        if (onExit(x, f.y)) continue;
        if (th.decor === 'cloister' || rng() < .5) { // draped kelp
          for (let k = 0; k < 3; k++) {
            const x0 = x + k * 4 - 4, len = 10 + rng() * 16;
            g.beginPath(); g.moveTo(x0, f.y - 2); g.quadraticCurveTo(x0 + 3 - rng() * 6, f.y + len * .5, x0 + (rng() - .5) * 5, f.y + len);
            g.strokeStyle = hsl(95 + rng() * 40, 40, 20 + rng() * 12); g.lineWidth = 2.2; g.stroke();
          }
        } else { // hanging chain with a ring
          for (let y = f.y + 1; y < f.y + FH - 4; y += 3.4) ellipse(g, x, y, 1.4, 2, null, '#5a6064', 1);
          circle(g, x, f.y + FH - 3, 3, null, '#7a8084', 1.4);
        }
      }
    }
    if (th.decor === 'bell') {
      for (const f of faces) for (let x = f.x + 60; x < f.x + f.w - 30; x += 180) {
        if (onExit(x, f.y)) continue;
        line(g, x, f.y, x, f.y + 6, '#3a2412', 1.4);
        poly(g, [[x - 3, f.y + 6], [x + 3, f.y + 6], [x + 6, f.y + 16], [x - 6, f.y + 16]], '#b88a40', '#2a1a08', 1.2);
        ellipse(g, x, f.y + 16, 6, 1.8, '#6a4a1c');
      }
    }
    if (th.decor === 'shutters') {
      for (const w of walls) {
        if (w.w < 120 || w.h < 24) continue;
        const y = w.y + Math.min(10, w.h / 2);
        line(g, w.x + 6, y, w.x + w.w - 6, y, '#1c1a16', 6); line(g, w.x + 6, y, w.x + w.w - 6, y, '#8a6a36', 4); line(g, w.x + 6, y - 1, w.x + w.w - 6, y - 1, 'rgba(255,220,160,.35)', 1);
        for (let x = w.x + 40; x < w.x + w.w - 20; x += 96) { rrect(g, x - 4, y - 4, 8, 8, 2); g.fillStyle = '#6a4e24'; g.fill(); g.strokeStyle = '#1c1a16'; g.lineWidth = 1; g.stroke(); }
      }
    }
    if (th.decor === 'sanctuary') {
      for (const w of walls) {
        if (Math.max(w.w, w.h) < 100 || Math.min(w.w, w.h) < 22) continue;
        const horiz = w.w >= w.h, n = Math.floor((horiz ? w.w : w.h) / 150);
        for (let i = 0; i < n; i++) {
          const f = (i + .5) / n, x = horiz ? w.x + w.w * f : w.x + w.w / 2, y = horiz ? w.y + w.h / 2 : w.y + w.h * f;
          if (onExit(x, y)) continue;
          ellipse(g, x, y + 2, 8, 3.5, 'rgba(240,230,200,.45)');
          for (let c = 0; c < 3; c++) { const cx = x + (c - 1) * 4.5, hh = 5 + c * 2; g.fillStyle = '#efe4c8'; g.fillRect(cx - 1.6, y - hh, 3.2, hh); }
          meta.candles.push({ x, y: y + 2 });
          meta.lights.push({ x, y: y - 4, r: 90, rgb: WARM, a: .45, flicker: 1 });
        }
      }
    }
  }
  function beds(g, s, th, rng, W, H) {
    for (const z of arr(s.water).filter(finiteRect)) {
      const big = z.w * z.h > 150000;
      g.save(); g.beginPath(); g.rect(z.x, z.y, z.w, z.h); g.clip();
      if (big) {
        g.fillStyle = 'rgba(10,30,34,.38)'; g.fillRect(z.x, z.y, z.w, z.h);
        for (let i = 0; i < z.w * z.h / 5000; i++) { // seaweed and tide-flat streaks
          const x = z.x + rng() * z.w, y = z.y + rng() * z.h, len = 8 + rng() * 16;
          g.strokeStyle = hsl(90 + rng() * 60, 40, 22 + rng() * 10, .7); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y);
          g.quadraticCurveTo(x + len * .4, y - len * .5, x + len * .2, y - len); g.stroke();
        }
      } else if (th.decor === 'beacon') {
        // Tidal flat: rippled sand, kelp and rock pools, drained at low tide.
        g.fillStyle = '#76684a'; g.fillRect(z.x, z.y, z.w, z.h);
        grime(g, W, H, rngFor(7), 0);
        for (let y = z.y + 4; y < z.y + z.h; y += 7) {
          g.beginPath(); for (let x = z.x; x <= z.x + z.w; x += 8) { const yy = y + Math.sin(x * .07 + y * .3) * 2; x === z.x ? g.moveTo(x, yy) : g.lineTo(x, yy); }
          g.strokeStyle = rng() < .5 ? 'rgba(230,210,160,.16)' : 'rgba(20,16,10,.22)'; g.lineWidth = 1.2; g.stroke();
        }
        for (let i = 0; i < z.w * z.h / 2400; i++) {
          const x = z.x + rng() * z.w, y = z.y + rng() * z.h, r = rng();
          if (r < .5) { const l = 6 + rng() * 12; g.strokeStyle = hsl(80 + rng() * 40, 45, 20 + rng() * 10, .85); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * .6, y - l * .3, x + l, y + l * .2); g.stroke(); }
          else if (r < .8) ellipse(g, x, y, 1.8, 1.2, 'rgba(240,230,210,.6)', null, 0, rng() * 3);
          else { puddle(g, x, y, 8 + rng() * 12, 4 + rng() * 5, rng); }
        }
        const gr = g.createLinearGradient(0, z.y, 0, z.y + 20); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(z.x, z.y, z.w, 20);
      } else {
        g.fillStyle = '#0c2129'; g.fillRect(z.x, z.y, z.w, z.h);
        for (let y = z.y; y < z.y + z.h; y += 30) for (let x = z.x; x < z.x + z.w; x += 30) {
          g.fillStyle = hsl(195, 22, 14 + rng() * 5); g.fillRect(x + 1.5, y + 1.5, 27, 27);
        }
        for (let i = 0; i < z.w * z.h / 900; i++) circle(g, z.x + rng() * z.w, z.y + rng() * z.h, 1 + rng() * 2.2, hsl(190, 12, 22 + rng() * 14, .8));
        const gr = g.createLinearGradient(0, z.y, 0, z.y + 26); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(z.x, z.y, z.w, 26);
        const gl = g.createLinearGradient(z.x, 0, z.x + 18, 0); gl.addColorStop(0, 'rgba(0,0,0,.45)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gl; g.fillRect(z.x, z.y, 18, z.h);
      }
      g.restore();
      if (!big) {
        g.strokeStyle = hsl(th.stone[0], th.stone[1], th.stone[2] + 18, .8); g.lineWidth = 2.2; g.strokeRect(z.x - 1, z.y - 1, z.w + 2, z.h + 2);
        g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; g.strokeRect(z.x - 2.8, z.y - 2.8, z.w + 5.6, z.h + 5.6);
      }
    }
    for (const b of arr(s.breakwaters).filter(finiteRect)) {
      g.fillStyle = 'rgba(4,14,18,.55)'; g.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      g.strokeStyle = 'rgba(160,190,190,.3)'; g.lineWidth = 1; g.strokeRect(b.x - 3.5, b.y - 3.5, b.w + 7, b.h + 7);
    }
    for (const sh of arr(s.shutters).filter(finiteRect)) {
      const vert = sh.h >= sh.w;
      g.fillStyle = 'rgba(0,0,0,.45)';
      if (vert) g.fillRect(sh.x + sh.w / 2 - 5, sh.y, 10, sh.h); else g.fillRect(sh.x, sh.y + sh.h / 2 - 5, sh.w, 10);
      g.strokeStyle = '#8d6a36'; g.lineWidth = 1.4;
      if (vert) { line(g, sh.x + sh.w / 2 - 5, sh.y, sh.x + sh.w / 2 - 5, sh.y + sh.h, '#8d6a36', 1.4); line(g, sh.x + sh.w / 2 + 5, sh.y, sh.x + sh.w / 2 + 5, sh.y + sh.h, '#8d6a36', 1.4); }
      else { line(g, sh.x, sh.y + sh.h / 2 - 5, sh.x + sh.w, sh.y + sh.h / 2 - 5, '#8d6a36', 1.4); line(g, sh.x, sh.y + sh.h / 2 + 5, sh.x + sh.w, sh.y + sh.h / 2 + 5, '#8d6a36', 1.4); }
      // hazard chevrons on the floor either side of the track
      g.save(); g.globalAlpha = .35;
      const n = Math.floor((vert ? sh.h : sh.w) / 22);
      for (let i = 0; i < n; i++) {
        const p = (i + .5) / n;
        const x = vert ? sh.x + sh.w / 2 : sh.x + sh.w * p, y = vert ? sh.y + sh.h * p : sh.y + sh.h / 2;
        for (const side of [-1, 1]) {
          const ox = vert ? side * (sh.w / 2 + 9) : 0, oy = vert ? 0 : side * (sh.h / 2 + 9);
          poly(g, vert ? [[x + ox - 3, y - 5], [x + ox + 3, y - 5], [x + ox + 3, y + 5], [x + ox - 3, y + 5]] : [[x - 5, y + oy - 3], [x + 5, y + oy - 3], [x + 5, y + oy + 3], [x - 5, y + oy + 3]], i % 2 ? '#c89a3c' : '#1a1a18');
        }
      }
      g.restore();
    }
  }
  function inlays(g, s, th) {
    const walls = arr(s.walls).filter(finiteRect);
    for (const e of emittersOf(s)) {
      if (!Number.isFinite(e.x)) continue;
      const dx = num(e.dx, 1), dy = num(e.dy, 0);
      const hit = PW.raySegment ? PW.raySegment(e.x, e.y, dx, dy, walls, 1600) : { x: e.x + dx * 600, y: e.y + dy * 600 };
      const nx = -dy, ny = dx;
      line(g, e.x, e.y, hit.x, hit.y, 'rgba(10,18,18,.55)', 22);
      for (const sd of [-11, 11]) line(g, e.x + nx * sd, e.y + ny * sd, hit.x + nx * sd, hit.y + ny * sd, 'rgba(200,170,100,.55)', 1.6);
      const L = Math.hypot(hit.x - e.x, hit.y - e.y);
      for (let d = 40; d < L - 10; d += 44) { const x = e.x + dx * d, y = e.y + dy * d; poly(g, [[x - dx * 4, y - dy * 4], [x + nx * 3, y + ny * 3], [x + dx * 4, y + dy * 4], [x - nx * 3, y - ny * 3]], 'rgba(220,190,120,.6)'); }
    }
    for (const r of arr(s.receivers)) {
      if (!Number.isFinite(r.x)) continue;
      const kind = receiverKind(r);
      circle(g, r.x, r.y + 4, 44, 'rgba(0,0,0,.18)');
      circle(g, r.x, r.y + 4, 40, null, kind === 'sanctuary' ? 'rgba(140,220,180,.35)' : 'rgba(215,185,115,.4)', 1.6);
      circle(g, r.x, r.y + 4, 33, null, 'rgba(0,0,0,.3)', 1);
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; line(g, r.x + Math.cos(a) * 34, r.y + 4 + Math.sin(a) * 34, r.x + Math.cos(a) * 39, r.y + 4 + Math.sin(a) * 39, 'rgba(215,190,125,.45)', 1.6); }
    }
    for (const m of arr(s.mirrors)) {
      if (!Number.isFinite(m.x)) continue;
      circle(g, m.x, m.y + 3, 31, 'rgba(0,0,0,.2)');
      circle(g, m.x, m.y + 3, 29, null, 'rgba(200,190,150,.35)', 1.4);
      for (const d of arr(m.dirs)) {
        const a = Math.atan2(d[1], d[0]);
        line(g, m.x + Math.cos(a) * 20, m.y + 3 + Math.sin(a) * 20, m.x + Math.cos(a) * 36, m.y + 3 + Math.sin(a) * 36, 'rgba(220,195,130,.45)', 2);
      }
    }
    const sc = sanctZone(s);
    if (sc && Number.isFinite(sc.x)) {
      const r = num(sc.r, 60);
      circle(g, sc.x, sc.y, r, 'rgba(40,70,50,.25)', 'rgba(160,220,170,.35)', 2);
      for (let i = 0; i < 16; i++) { const a = i * TAU / 16; circle(g, sc.x + Math.cos(a) * (r - 7), sc.y + Math.sin(a) * (r - 7), 2, 'rgba(180,230,190,.35)'); }
    }
    if (s.beacon && Number.isFinite(s.beacon.x)) {
      const b = s.beacon;
      circle(g, b.x, b.y + 6, 70, 'rgba(0,0,0,.3)');
      for (let i = 0; i < 20; i++) {
        const a0 = i * TAU / 20, a1 = (i + 1) * TAU / 20;
        g.beginPath(); g.arc(b.x, b.y, 64, a0 + .02, a1 - .02); g.arc(b.x, b.y, 46, a1 - .02, a0 + .02, true); g.closePath();
        g.fillStyle = hsl(th.stone[0], th.stone[1], th.stone[2] + 10 + (i % 3) * 3); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.stroke();
      }
      circle(g, b.x, b.y, 46, hsl(th.stone[0], th.stone[1], th.stone[2] - 4), 'rgba(255,240,210,.2)', 1.5);
    }
  }
  function decals(g, s, th, rng, W, H, meta) {
    const walls = arr(s.walls).filter(finiteRect);
    const free = (x, y, pad) => !walls.some(w => inRect(x, y, w, pad || 0)) && !arr(s.water).some(z => inRect(x, y, z, 6));
    grime(g, W, H, rng, 70);
    // Moss creeping out of joints near walls.
    const mossN = Math.floor(90 * th.moss);
    for (let i = 0; i < mossN; i++) {
      const x = rng() * W, y = rng() * H;
      if (!free(x, y, 2)) continue;
      const d = wallDist(x, y, walls);
      if (d > 30 + rng() * 140) continue;
      mossClump(g, x, y, 4 + rng() * 9, rng, .55 + rng() * .3);
    }
    for (let i = 0; i < th.puddles; i++) {
      const x = 80 + rng() * (W - 160), y = 80 + rng() * (H - 160);
      if (!free(x, y, 30)) continue;
      puddle(g, x, y, 16 + rng() * 26, 7 + rng() * 10, rng);
    }
    if (th.decor === 'sanctuary') {
      for (let i = 0; i < 140; i++) { // grass tufts and flowers
        const x = rng() * W, y = rng() * H;
        if (!free(x, y, 4) || wallDist(x, y, walls) > 160) continue;
        g.strokeStyle = hsl(90 + rng() * 30, 40, 30 + rng() * 15); g.lineWidth = 1;
        for (let b = 0; b < 5; b++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - .5) * 8, y - 4 - rng() * 6); g.stroke(); }
        if (rng() < .3) circle(g, x + 2, y - 5, 1.4, rng() < .5 ? '#f3eed8' : '#e9b7c9');
      }
      for (const p of spots(s, rng, 16, 10, 26, 70, W, H)) {
        meta.candles.push(p);
        ellipse(g, p.x, p.y + 2, 9, 4, 'rgba(240,230,200,.35)');
        for (let c = 0; c < 3; c++) {
          const cx = p.x + (c - 1) * 5, cy = p.y + (c === 1 ? -2 : 1), hh = 7 + c * 2.5;
          g.fillStyle = '#e8dcc0'; g.fillRect(cx - 1.8, cy - hh, 3.6, hh); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(cx + .6, cy - hh, 1.2, hh);
        }
        meta.lights.push({ x: p.x, y: p.y - 6, r: 110, rgb: WARM, a: .55, flicker: 1 });
      }
    }
    if (th.decor === 'cloister') {
      for (let i = 0; i < 60; i++) { // shells, sea-glass, salt rime
        const x = rng() * W, y = rng() * H;
        if (!free(x, y, 3)) continue;
        if (rng() < .5) ellipse(g, x, y, 2.2, 1.4, rng() < .5 ? 'rgba(235,225,205,.55)' : 'rgba(140,220,210,.5)', null, 0, rng() * 3);
        else { g.fillStyle = 'rgba(230,235,225,.08)'; g.beginPath(); g.ellipse(x, y, 12 + rng() * 16, 5 + rng() * 6, rng() * 3, 0, TAU); g.fill(); }
      }
      for (const p of spots(s, rng, 3, 18, 40, 260, W, H)) { // braziers
        meta.braziers.push(p);
        ellipse(g, p.x + 2, p.y + 6, 14, 7, 'rgba(0,0,0,.4)');
        circle(g, p.x, p.y, 11, '#3a3326', '#8c7650', 1.6); circle(g, p.x, p.y, 7.5, '#1c140c');
        meta.lights.push({ x: p.x, y: p.y, r: 170, rgb: WARM, a: .55, flicker: 1 });
      }
    }
    if (th.decor === 'sluice') {
      for (let i = 0; i < 26; i++) { // drain grates and algae slicks
        const x = 60 + rng() * (W - 120), y = 60 + rng() * (H - 120);
        if (!free(x, y, 20)) continue;
        if (rng() < .35) {
          rrect(g, x - 10, y - 10, 20, 20, 3); g.fillStyle = '#0b1418'; g.fill(); g.strokeStyle = '#6a7c80'; g.lineWidth = 1.5; g.stroke();
          for (let k = -6; k <= 6; k += 4) line(g, x + k, y - 8, x + k, y + 8, '#4a5a5e', 1.4);
        } else { g.fillStyle = hsl(140, 35, 22, .35); g.beginPath(); g.ellipse(x, y, 20 + rng() * 30, 6 + rng() * 10, rng() * 3, 0, TAU); g.fill(); }
      }
    }
    if (th.decor === 'shutters') {
      for (let i = 0; i < 40; i++) { const x = rng() * W, y = rng() * H; if (!free(x, y)) continue; line(g, x, y, x + 10 + rng() * 20, y + (rng() - .5) * 6, 'rgba(255,255,255,.05)', 2); }
    }
    if (th.decor === 'bell') {
      // Compass-rose mosaic in the nave.
      const cx = W / 2, cy = H / 2 + 40, R = 118;
      if (free(cx, cy)) {
        circle(g, cx, cy, R + 8, '#2c1e16'); circle(g, cx, cy, R, '#6e6a5c', '#c8a868', 2);
        for (let i = 0; i < 16; i++) {
          const a = i * TAU / 16, r2 = i % 2 ? R * .55 : R * .92;
          poly(g, [[cx, cy], [cx + Math.cos(a - .19) * R * .3, cy + Math.sin(a - .19) * R * .3], [cx + Math.cos(a) * r2, cy + Math.sin(a) * r2], [cx + Math.cos(a + .19) * R * .3, cy + Math.sin(a + .19) * R * .3]], i % 2 ? '#8a5a3a' : (i % 4 ? '#b8a37a' : '#d8c08a'), 'rgba(0,0,0,.35)', 1);
        }
        circle(g, cx, cy, 16, '#c8a868', '#3a2a1a', 2);
        grime(g, W, H, rng, 10);
      }
      for (let i = 0; i < 50; i++) { const x = rng() * W, y = rng() * H; if (!free(x, y)) continue; line(g, x, y, x + (rng() - .5) * 14, y + (rng() - .5) * 4, 'rgba(220,190,120,.3)', 1); } // straw
      for (const p of spots(s, rng, 5, 12, 30, 170, W, H)) { // coiled bell ropes
        for (let r = 9; r > 2; r -= 2.2) circle(g, p.x, p.y, r, null, '#8a6a40', 2.2);
        circle(g, p.x, p.y, 10, null, 'rgba(0,0,0,.35)', 1);
      }
    }
    if (th.decor === 'beacon') {
      for (let i = 0; i < 80; i++) { // lichen and foam lines
        const x = rng() * W, y = rng() * H;
        if (walls.some(w => inRect(x, y, w))) continue;
        if (rng() < .6) { g.fillStyle = hsl(40 + rng() * 30, 60, 45, .35); g.beginPath(); g.ellipse(x, y, 3 + rng() * 7, 2 + rng() * 4, rng() * 3, 0, TAU); g.fill(); }
        else circle(g, x, y, 1.6, 'rgba(230,235,230,.45)');
      }
    }
  }
  function exterior(g, s, th, rng, W, H) {
    // Everything outside the wall ring is the world beyond: open sea or deep shadow.
    const walls = arr(s.walls).filter(finiteRect);
    if (!walls.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const w of walls) { x0 = Math.min(x0, w.x); y0 = Math.min(y0, w.y); x1 = Math.max(x1, w.x + w.w); y1 = Math.max(y1, w.y + w.h); }
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip('evenodd');
    const sea = th.decor === 'cloister' || th.decor === 'sluice' || th.decor === 'beacon';
    g.fillStyle = sea ? '#0b2e3a' : th.void; g.fillRect(0, 0, W, H);
    if (sea) {
      for (let i = 0; i < 260; i++) {
        const x = rng() * W, y = rng() * H, l = 6 + rng() * 16;
        g.strokeStyle = rng() < .3 ? 'rgba(200,235,240,.35)' : 'rgba(90,150,165,.35)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 2.5, x + l, y); g.stroke();
      }
      g.strokeStyle = 'rgba(225,245,245,.5)'; g.lineWidth = 2; g.setLineDash([5, 4]);
      g.strokeRect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6); g.setLineDash([]);
    } else {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,.03)'); gr.addColorStop(1, 'rgba(0,0,0,.2)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    g.restore();
  }
  function bakeLight(g, s, th, W, H, meta, k) {
    const L = makeCanvas(W * k, H * k), l = L.getContext('2d');
    l.scale(k, k);
    const [ar, ag, ab] = th.ambient;
    l.fillStyle = `rgb(${ar},${ag},${ab})`; l.fillRect(0, 0, W, H);
    // Gentle top-left key light gives the room a direction.
    const kg = l.createLinearGradient(0, 0, W, H); kg.addColorStop(0, 'rgba(255,240,215,.14)'); kg.addColorStop(1, 'rgba(0,0,0,.12)');
    l.fillStyle = kg; l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'lighter';
    const lights = meta.lights.slice();
    for (const e of emittersOf(s)) if (Number.isFinite(e.x)) lights.push({ x: e.x + num(e.dx, 1) * 30, y: e.y + num(e.dy, 0) * 30, r: 260, rgb: '255,210,140', a: .5 });
    for (const x of arr(s.exits)) if (finiteRect(x)) lights.push({ x: x.x + x.w / 2, y: x.y + x.h / 2, r: 150, rgb: '200,215,230', a: .3 });
    const sz = sanctZone(s);
    if (sz && Number.isFinite(sz.x)) lights.push({ x: sz.x, y: sz.y, r: 160, rgb: '170,240,190', a: .3 });
    for (const b of meta.braziers) lights.push({ x: b.x, y: b.y, r: 140, rgb: WARM, a: .3 });
    for (const p of lights) {
      const gr = l.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      gr.addColorStop(0, `rgba(${p.rgb},${p.a})`); gr.addColorStop(.5, `rgba(${p.rgb},${p.a * .35})`); gr.addColorStop(1, `rgba(${p.rgb},0)`);
      l.fillStyle = gr; l.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.drawImage(L, 0, 0); g.restore();
  }
  const staticCache = new Map();
  const geoSig = new WeakMap();
  function signature(s) {
    const key = s.walls;
    if (key && typeof key === 'object' && geoSig.has(key)) return geoSig.get(key);
    const pick = a => arr(a).map(o => [o.x, o.y, o.w, o.h, o.dx, o.dy].map(v => (Number.isFinite(v) ? Math.round(v) : '')).join(',')).join(';');
    const sig = [roomId(s), pick(s.walls), pick(s.water), pick(s.breakwaters), pick(s.shutters), pick(emittersOf(s)), pick(s.receivers), pick(s.mirrors), pick(s.exits), pick(s.pickups),
      s.beacon ? pick([s.beacon]) : '', sanctZone(s) ? pick([sanctZone(s)]) : ''].join('|');
    const h = roomId(s) + ':' + hashStr(sig).toString(36);
    if (key && typeof key === 'object') geoSig.set(key, h);
    return h;
  }
  function getStatic(s, th, k, W, H) {
    const key = signature(s) + '@' + k;
    let st = staticCache.get(key);
    if (st) return st;
    const canvas = makeCanvas(W * k, H * k), g = canvas.getContext('2d');
    const meta = { k, lights: [], candles: [], braziers: [], spouts: [] };
    const rng = rngFor(hashStr(roomId(s)));
    g.scale(k, k);
    g.fillStyle = th.void; g.fillRect(0, 0, W, H);
    (FLOORS[th.floor] || floorFlag)(g, W, H, rng, th);
    decals(g, s, th, rng, W, H, meta);
    beds(g, s, th, rng, W, H);
    inlays(g, s, th);
    exterior(g, s, th, rng, W, H);
    drawWalls(g, s, th, rng, W, H, meta);
    bakeLight(g, s, th, W, H, meta, k);
    if (th.grade) { // colour grade baked into the static layer: free at runtime
      g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = .5;
      const gr = g.createLinearGradient(0, 0, W * .6, H); gr.addColorStop(0, th.grade[0]); gr.addColorStop(1, th.grade[1]);
      g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
    }
    st = { canvas, k, meta };
    staticCache.set(key, st);
    while (staticCache.size > 3) staticCache.delete(staticCache.keys().next().value);
    return st;
  }
  // Small caches for dynamic materials.
  let causticTile = null;
  function caustics() {
    if (causticTile || !hasDoc) return causticTile;
    const c = makeCanvas(128, 128), g = c.getContext('2d');
    g.strokeStyle = 'rgba(210,250,255,.9)'; g.lineWidth = 1.3;
    for (let i = 0; i < 6; i++) {
      g.beginPath(); for (let x = 0; x <= 128; x += 4) { const y = i * 21.3 + Math.sin(x / 128 * TAU * 2 + i * 1.7) * 6 + Math.sin(x / 128 * TAU * 3 + i) * 3; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      g.beginPath(); for (let y = 0; y <= 128; y += 4) { const x = i * 21.3 + Math.sin(y / 128 * TAU * 2 + i * 2.3) * 6 + Math.cos(y / 128 * TAU * 3 + i) * 3; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    }
    causticTile = c; return c;
  }
  const blockCache = new Map();
  function blockTop(w, h, th) {
    const key = w + 'x' + h + th.decor;
    let c = blockCache.get(key);
    if (c) return c;
    c = makeCanvas(w * 2, h * 2); const g = c.getContext('2d'); g.scale(2, 2);
    const rng = rngFor(hashStr(key));
    g.fillStyle = '#1a2226'; g.fillRect(0, 0, w, h);
    const bw = 24, bh = 16; let row = 0;
    for (let y = 0; y < h; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < w; x += bw) stone(g, x + 1, y + 1, bw - 2, bh - 2, jit([th.top[0], th.top[1], th.top[2] + 4], rng, 6, 6, 10), rng, { jit: 1, speck: 60, crack: .1, hi: .2 });
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(190,225,235,.22)'); gr.addColorStop(.3, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    blockCache.set(key, c); return c;
  }
  const vigCache = { key: '', c: null };
  function vignette(w, h, strength, tint) {
    const key = w + 'x' + h + ':' + strength + tint;
    if (vigCache.key === key) return vigCache.c;
    const c = makeCanvas(w, h), g = c.getContext('2d');
    const gr = g.createRadialGradient(w / 2, h * .48, Math.min(w, h) * .28, w / 2, h / 2, Math.hypot(w, h) * .62);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.6, `rgba(${tint},${strength * .45})`); gr.addColorStop(1, `rgba(${tint},${strength})`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    vigCache.key = key; vigCache.c = c; return c;
  }

  // ---------------------------------------------------------------- private animation memory
  const motion = new WeakMap();
  function track(o, t) {
    let m = motion.get(o);
    if (!m) { m = { x: o.x, y: o.y, t, phase: 0, speed: 0, still: 0 }; motion.set(o, m); return m; }
    const dt = t - m.t;
    if (dt > 0 && dt < .5) {
      const d = Math.hypot(o.x - m.x, o.y - m.y);
      m.phase += d * .11; m.speed = m.speed * .7 + (d / dt) * .3;
      m.still = d < .05 ? m.still + dt : 0;
    } else if (dt !== 0) { m.speed = 0; }
    m.x = o.x; m.y = o.y; m.t = t;
    return m;
  }
  const roomMemo = { id: null, since: 0 };

  // ---------------------------------------------------------------- dynamic world pieces
  let floodLabel = null;
  function drawWater(ctx, s, t, th) {
    const tile = caustics();
    floodLabel = null;
    for (const z of arr(s.water).filter(finiteRect)) {
      const deep = zoneActive(z, s), soon = zoneFlipSoon(z, s), depth = tideDepth(z, s), w = tideWarn(s);
      const big = z.w * z.h > 150000;
      ctx.save(); ctx.beginPath(); ctx.rect(z.x, z.y, z.w, z.h); ctx.clip();
      const a = deep ? .5 + .38 * clamp(depth, .4, 1) : .03 + .14 * depth;
      const [wh, ws, wl] = th.water;
      ctx.fillStyle = hsl(wh, ws, wl + (deep ? 0 : 12), a); ctx.fillRect(z.x, z.y, z.w, z.h);
      if (deep) {
        const gr = ctx.createLinearGradient(0, z.y, 0, z.y + 40); gr.addColorStop(0, 'rgba(0,10,16,.5)'); gr.addColorStop(1, 'rgba(0,10,16,0)');
        ctx.fillStyle = gr; ctx.fillRect(z.x, z.y, z.w, 40);
      }
      if (tile) {
        ctx.globalCompositeOperation = 'lighter';
        for (let layer = deep ? 0 : 1; layer < 2; layer++) {
          const ox = (t * (layer ? -9 : 13)) % 128, oy = (t * (layer ? 7 : 4)) % 128;
          ctx.globalAlpha = deep ? (layer ? .1 : .14) : .06;
          const sx = Math.floor((z.x - ox) / 128) * 128 + ox, sy = Math.floor((z.y - oy) / 128) * 128 + oy;
          for (let y = sy; y < z.y + z.h; y += 128) for (let x = sx; x < z.x + z.w; x += 128) ctx.drawImage(tile, x, y, 128, 128);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      if (deep) { // surface glints
        for (let i = 0; i < z.w * z.h / 6000; i++) {
          const gx = z.x + ((i * 97.3) % z.w), gy = z.y + ((i * 61.7 + t * 6) % z.h), ph = Math.sin(t * 2 + i * 1.3);
          if (ph > .4) line(ctx, gx, gy, gx + 8, gy, `rgba(220,245,255,${(ph - .4) * .5})`, 1.2);
        }
      }
      if (soon && !deep) { // FLOOD warning
        ctx.fillStyle = `rgba(90,190,230,${.06 + .14 * w * (.6 + .4 * Math.sin(t * 12))})`; ctx.fillRect(z.x, z.y, z.w, z.h);
        ctx.strokeStyle = `rgba(150,220,255,${.08 + .16 * w})`; ctx.lineWidth = 3;
        const off = (t * 40) % 32;
        ctx.beginPath(); for (let d = -z.h - 32 + off; d < z.w + z.h; d += 32) { ctx.moveTo(z.x + d, z.y + z.h); ctx.lineTo(z.x + d + z.h, z.y); } ctx.stroke();
      }
      ctx.restore();
      // edges: foam when deep, warning outline when about to flood
      if (deep && !big) {
        ctx.save(); ctx.setLineDash([10, 7]); ctx.lineDashOffset = -t * 12;
        ctx.strokeStyle = 'rgba(220,245,250,.35)'; ctx.lineWidth = 2; ctx.strokeRect(z.x + 2, z.y + 2, z.w - 4, z.h - 4); ctx.restore();
      }
      if (soon) {
        const remain = Math.max(0, (1 - w) * 1.5);
        ctx.save(); ctx.strokeStyle = deep ? 'rgba(200,235,255,.7)' : `rgba(255,${160 + 60 * Math.sin(t * 14)},90,.9)`; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.lineDashOffset = t * 30;
        ctx.strokeRect(z.x + 1.5, z.y + 1.5, z.w - 3, z.h - 3); ctx.restore();
        const pl = s.player || { x: 0, y: 0 };
        const lx = clamp(pl.x, z.x + 44, z.x + z.w - 44), ly = clamp(pl.y, z.y + 14, z.y + z.h - 14);
        const d = Math.hypot(lx - pl.x, ly - pl.y);
        if (!deep && (!floodLabel || d < floodLabel.d)) floodLabel = { d, x: lx, y: ly, text: `FLOOD ${remain.toFixed(1)}s`, color: '#ffc27a', size: 11 };
      }
    }
  }
  function drawBreakwaters(ctx, s, t, th) {
    if (floodLabel) { labels.push(floodLabel); floodLabel = null; }
    for (const b of arr(s.breakwaters).filter(finiteRect)) {
      const up = zoneActive(b, s), soon = zoneFlipSoon(b, s), w = tideWarn(s);
      if (up) {
        const shake = soon ? Math.sin(t * 60) * w * 1.2 : 0;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(b.x + 3, b.y + 8, b.w, b.h + 10);
        const fh = 12;
        const gr = ctx.createLinearGradient(0, b.y + b.h - fh, 0, b.y + b.h + 2);
        gr.addColorStop(0, hsl(th.face[0], th.face[1], th.face[2] + 10)); gr.addColorStop(1, hsl(th.face[0], th.face[1], th.face[2] - 6));
        ctx.fillStyle = gr; ctx.fillRect(b.x + shake, b.y + b.h - fh + 2, b.w, fh);
        if (hasDoc) ctx.drawImage(blockTop(Math.round(b.w), Math.round(b.h - fh + 2), th), b.x + shake, b.y - fh + 2, b.w, b.h - fh + 2 + (fh - 2));
        ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.2; ctx.strokeRect(b.x + shake, b.y - fh + 2, b.w, b.h + fh - 2 - fh + 2);
        line(ctx, b.x + shake, b.y - fh + 3, b.x + b.w + shake, b.y - fh + 3, 'rgba(220,240,240,.5)', 1.4);
        for (let x = b.x + 6; x < b.x + b.w - 4; x += 11) line(ctx, x + shake, b.y + b.h - fh + 3, x + shake, b.y + b.h - 1 - ((x * 7) % 5), 'rgba(160,210,220,.25)', 1.2); // drip
      } else {
        ctx.fillStyle = `rgba(8,26,32,${.35 + .2 * tideDepth(b, s)})`; ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(170,200,200,.4)'; ctx.lineWidth = 1.4; ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4); ctx.restore();
        if (soon) {
          const pulse = .5 + .5 * Math.sin(t * 16);
          ctx.fillStyle = `rgba(255,150,70,${.12 + .25 * w * pulse})`; ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = `rgba(255,190,110,${.5 + .5 * pulse})`; ctx.lineWidth = 2.5; ctx.strokeRect(b.x, b.y, b.w, b.h);
          for (let i = 0; i < 6; i++) { // dust kicked up
            const px = b.x + ((i * 37 + t * 50) % b.w), py = b.y + b.h * ((i * .37) % 1) - (t * 20 + i * 7) % 12;
            circle(ctx, px, py, 1.6, 'rgba(230,210,170,.55)');
          }
          labels.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, text: 'RISING', color: '#ffc27a', size: 10 });
        }
      }
    }
  }
  function shutterTiming(sh, s) {
    if (Number.isFinite(sh.closesIn) || Number.isFinite(sh.opensIn)) {
      const open = typeof sh.open === 'boolean' ? sh.open : num(sh.closesIn, 0) > 0;
      const period = num(sh.period, 4), openFor = num(sh.openFor, period / 2);
      if (sh.held) return { open, left: 0, frac: 0, held: true };
      return open ? { open, left: num(sh.closesIn, 0), frac: clamp(num(sh.closesIn, 0) / Math.max(.01, openFor), 0, 1) }
        : { open, left: num(sh.opensIn, 0), frac: clamp(num(sh.opensIn, 0) / Math.max(.01, period - openFor), 0, 1) };
    }
    const period = num(sh.period, 0), openFor = num(sh.openFor, 0);
    if (!(period > 0) || !(openFor > 0) || openFor >= period) return null;
    const local = (((num(s.time, 0) + num(sh.offset, 0)) % period) + period) % period;
    const open = local < openFor;
    return { open, left: open ? openFor - local : period - local, frac: open ? 1 - local / openFor : 1 - (local - openFor) / (period - openFor) };
  }
  function drawShutters(ctx, s, t) {
    for (const sh of arr(s.shutters).filter(finiteRect)) {
      const tm = shutterTiming(sh, s);
      const open = typeof sh.open === 'boolean' ? sh.open : (tm ? tm.open : false);
      const synced = tm && tm.open === open;
      const warnClose = open && synced && (tm.held || tm.left < 1);
      const vert = sh.h >= sh.w, len = vert ? sh.h : sh.w;
      const extent = open ? (warnClose ? (tm.held ? .16 : (1 - tm.left) * .18) : 0) : 1;
      const slats = (from, to) => {
        const a = len * from, b = len * to;
        ctx.save();
        if (vert) ctx.translate(sh.x, sh.y); else { ctx.translate(sh.x, sh.y + sh.h); ctx.rotate(-Math.PI / 2); }
        const thick = vert ? sh.w : sh.h;
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(4, a + 6, thick, b - a);
        const gr = ctx.createLinearGradient(0, 0, thick, 0); gr.addColorStop(0, '#5f6670'); gr.addColorStop(.5, '#3b414b'); gr.addColorStop(1, '#262a31');
        ctx.fillStyle = gr; ctx.fillRect(0, a, thick, b - a);
        for (let y = a + 4; y < b; y += 9) { line(ctx, 1, y, thick - 1, y, 'rgba(0,0,0,.5)', 2); line(ctx, 1, y + 1.6, thick - 1, y + 1.6, 'rgba(200,210,220,.14)', 1); }
        line(ctx, 1, a, 1, b, '#b08a4a', 1.6); line(ctx, thick - 1, a, thick - 1, b, '#5a4420', 1.6);
        ctx.restore();
      };
      if (extent >= 1) slats(0, 1);
      else if (extent > 0) { slats(0, extent / 2); slats(1 - extent / 2, 1); }
      // housings at both ends with a status lamp and phase ring
      const ends = vert ? [[sh.x + sh.w / 2, sh.y + 6], [sh.x + sh.w / 2, sh.y + sh.h - 6]] : [[sh.x + 6, sh.y + sh.h / 2], [sh.x + sh.w - 6, sh.y + sh.h / 2]];
      const lampRGB = !open ? RED : warnClose ? '255,170,60' : '140,255,190';
      for (const [hx, hy] of ends) {
        rrect(ctx, hx - 11, hy - 9, 22, 18, 4); ctx.fillStyle = '#2a2d33'; ctx.fill(); ctx.strokeStyle = '#a07c42'; ctx.lineWidth = 1.6; ctx.stroke();
        const blink = warnClose ? (Math.sin(t * 22) > 0 ? 1 : .35) : 1;
        circle(ctx, hx, hy, 4, `rgba(${lampRGB},${blink})`, '#140c06', 1);
        if (tm && synced) { ctx.beginPath(); ctx.arc(hx, hy, 7.5, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(tm.frac, 0, 1)); ctx.strokeStyle = `rgba(${lampRGB},.9)`; ctx.lineWidth = 2; ctx.stroke(); }
      }
      glowQueue.push([ends[0][0], ends[0][1], 22, lampRGB, .55], [ends[1][0], ends[1][1], 22, lampRGB, .55]);
      if (open && !warnClose) {
        ctx.save(); ctx.setLineDash([4, 6]); ctx.lineDashOffset = -t * 20;
        if (vert) line(ctx, sh.x + sh.w / 2, sh.y + 16, sh.x + sh.w / 2, sh.y + sh.h - 16, 'rgba(140,255,190,.35)', 2);
        else line(ctx, sh.x + 16, sh.y + sh.h / 2, sh.x + sh.w - 16, sh.y + sh.h / 2, 'rgba(140,255,190,.35)', 2);
        ctx.restore();
      }
      if (warnClose) {
        const a = .35 + .5 * (Math.sin(t * 22) > 0 ? 1 : 0);
        ctx.fillStyle = 'rgba(255,120,60,.12)'; ctx.fillRect(sh.x - 3, sh.y - 3, sh.w + 6, sh.h + 6);
        ctx.strokeStyle = `rgba(255,150,80,${a})`; ctx.lineWidth = 2; ctx.strokeRect(sh.x - 3, sh.y - 3, sh.w + 6, sh.h + 6);
        labels.push({ x: sh.x + sh.w / 2, y: sh.y + sh.h / 2, text: tm.held ? 'HELD OPEN' : 'CLOSING', color: '#ffb27a', size: 10 });
      }
    }
  }
  function drawGates(ctx, s, t) {
    for (const g of arr(s.gates).filter(finiteRect)) {
      const vert = g.h >= g.w;
      const posts = vert ? [[g.x + g.w / 2, g.y], [g.x + g.w / 2, g.y + g.h]] : [[g.x, g.y + g.h / 2], [g.x + g.w, g.y + g.h / 2]];
      if (g.open) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        if (vert) line(ctx, g.x + g.w / 2, g.y + 10, g.x + g.w / 2, g.y + g.h - 10, 'rgba(120,230,190,.18)', 8);
        else line(ctx, g.x + 10, g.y + g.h / 2, g.x + g.w - 10, g.y + g.h / 2, 'rgba(120,230,190,.18)', 8);
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(g.x + 4, g.y + 8, g.w, g.h);
        ctx.fillStyle = 'rgba(14,28,34,.7)'; ctx.fillRect(g.x, g.y, g.w, g.h);
        const n = Math.max(2, Math.floor((vert ? g.h : g.w) / 14));
        for (let i = 0; i <= n; i++) {
          const f = i / n;
          if (vert) { const y = g.y + g.h * f; line(ctx, g.x + 2, y, g.x + g.w - 2, y, '#1a1208', 5); line(ctx, g.x + 2, y - 1, g.x + g.w - 2, y - 1, '#d8b56e', 2.2); }
          else { const x = g.x + g.w * f; line(ctx, x, g.y + 2, x, g.y + g.h - 2, '#1a1208', 5); line(ctx, x - 1, g.y + 2, x - 1, g.y + g.h - 2, '#d8b56e', 2.2); }
        }
        if (vert) { line(ctx, g.x + 3, g.y, g.x + 3, g.y + g.h, '#7d8e88', 3); line(ctx, g.x + g.w - 3, g.y, g.x + g.w - 3, g.y + g.h, '#3d4a48', 3); }
        else { line(ctx, g.x, g.y + 3, g.x + g.w, g.y + 3, '#7d8e88', 3); line(ctx, g.x, g.y + g.h - 3, g.x + g.w, g.y + g.h - 3, '#3d4a48', 3); }
        // seal emblem
        const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
        circle(ctx, cx, cy, 12, '#2a2418', '#e2c27a', 2);
        poly(ctx, [[cx, cy - 7], [cx + 6, cy], [cx, cy + 7], [cx - 6, cy]], `rgba(255,214,130,${.6 + .3 * Math.sin(t * 3)})`);
      }
      for (const [px, py] of posts) {
        ellipse(ctx, px + 2, py + 6, 13, 7, 'rgba(0,0,0,.4)');
        circle(ctx, px, py, 11, '#4b5a58', '#bca86f', 2); circle(ctx, px - 3, py - 3, 4, 'rgba(255,245,215,.25)');
        circle(ctx, px, py, 4, g.open ? '#aaf5d6' : '#d6b36a');
      }
    }
  }
  function exitSide(e, W, H) {
    if (e.x <= 24) return [-1, 0];
    if (e.x + e.w >= W - 24) return [1, 0];
    if (e.y <= 24) return [0, -1];
    if (e.y + e.h >= H - 24) return [0, 1];
    return [0, -1];
  }
  function drawExits(ctx, s, t, W, H) {
    for (const e of arr(s.exits).filter(finiteRect)) {
      const [dx, dy] = exitSide(e, W, H);
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      // passage darkening outward
      const gr = ctx.createLinearGradient(cx - dx * Math.max(e.w, e.h) / 2, cy - dy * Math.max(e.w, e.h) / 2, cx + dx * Math.max(e.w, e.h) / 2, cy + dy * Math.max(e.w, e.h) / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,4,8,.8)');
      ctx.fillStyle = gr; ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const ph = ((t * .9 + i / 3) % 1), px = cx - dx * 24 + dx * ph * 40, py = cy - dy * 24 + dy * ph * 40, a = Math.sin(ph * Math.PI) * .75;
        ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(dy, dx));
        poly(ctx, [[6, 0], [-4, -9], [-1, 0], [-4, 9]], `rgba(190,240,225,${a})`);
        ctx.restore();
      }
      ctx.restore();
      const lx = cx - dx * (Math.abs(dx) ? e.w / 2 + 74 : 0), ly = cy - dy * (Math.abs(dy) ? e.h / 2 + 30 : 0);
      const barred = arr(s.gates).some(g => !g.open && finiteRect(g) && rectDist(cx, cy, g) < 40);
      const pl = s.player, near = pl && Math.hypot(pl.x - lx, pl.y - ly) < 90;
      if (!barred && !near) labels.push({ x: lx, y: ly, text: (dx < 0 ? '‹ ' : '') + roomName(e.to).toUpperCase() + (dx >= 0 ? ' ›' : ''), color: '#cdeee2', size: 10, dim: true });
    }
    const ee = s.escortExit;
    if (ee && finiteRect(ee)) {
      const pulse = .5 + .5 * Math.sin(t * 3);
      ctx.fillStyle = `rgba(120,230,190,${.08 + .06 * pulse})`; ctx.fillRect(ee.x, ee.y, ee.w, ee.h);
      ctx.save(); ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 16; ctx.strokeStyle = 'rgba(150,255,210,.7)'; ctx.lineWidth = 2; ctx.strokeRect(ee.x + 2, ee.y + 2, ee.w - 4, ee.h - 4); ctx.restore();
      labels.push({ x: ee.x + ee.w / 2, y: ee.y + ee.h / 2, text: 'ILEX’S HATCH', color: '#9ff5d2', size: 10 });
    }
  }
  function drawSanctuaryCircle(ctx, s, t) {
    const sc = sanctZone(s);
    if (!sc || !Number.isFinite(sc.x)) return;
    const rec = arr(s.receivers).find(r => r.id === sc.receiver);
    const lit = typeof sc.active === 'boolean' ? sc.active : rec ? !!rec.active : true;
    const r = num(sc.r, 60);
    if (!lit) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    bloom(ctx, sc.x, sc.y, r * 1.6, '120,240,170', .35);
    ctx.beginPath(); ctx.arc(sc.x, sc.y, r - 3, 0, TAU); ctx.strokeStyle = `rgba(150,255,200,${.45 + .2 * Math.sin(t * 2)})`; ctx.lineWidth = 2.5; ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10 + t * .3, rr = (r * .2) + ((t * 18 + i * 13) % (r * .8)), up = ((t * 20 + i * 9) % 30);
      circle(ctx, sc.x + Math.cos(a) * rr, sc.y + Math.sin(a) * rr * .8 - up, 1.8, `rgba(190,255,215,${.6 - up / 60})`);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- props & actors
  function drawEmitter(ctx, e, t) {
    const dx = num(e.dx, 1), dy = num(e.dy, 0), a = Math.atan2(dy, dx);
    ellipse(ctx, e.x + 3, e.y + 8, 28, 15, 'rgba(0,0,0,.45)');
    ctx.save(); ctx.translate(e.x, e.y);
    circle(ctx, 0, 0, 25, '#3c3a30', '#16120a', 2);
    for (let i = 0; i < 12; i++) { const r = i * TAU / 12 + t * .25; poly(ctx, [[Math.cos(r) * 20, Math.sin(r) * 20], [Math.cos(r + .12) * 26, Math.sin(r + .12) * 26], [Math.cos(r + .24) * 20, Math.sin(r + .24) * 20]], '#c69a4c', '#3a2a10', .8); }
    circle(ctx, 0, 0, 19, '#a47c3c', '#f0d28e', 1.6);
    ctx.rotate(a);
    rrect(ctx, 4, -9, 20, 18, 3); ctx.fillStyle = '#6a5028'; ctx.fill(); ctx.strokeStyle = '#f0d28e'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.rotate(-a);
    const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 14); g.addColorStop(0, '#fffbe6'); g.addColorStop(.5, '#ffd978'); g.addColorStop(1, '#d08a2c');
    circle(ctx, 0, 0, 12, g, '#fff4c8', 1.5);
    ctx.restore();
    glowQueue.push([e.x, e.y, 90, SUN, .8], [e.x, e.y, 36, '255,250,220', .8]);
  }
  function drawReceiver(ctx, r, t, s) {
    const lit = !!r.active, charge = clamp(num(r.charge, 0), 0, 1), kind = receiverKind(r);
    ellipse(ctx, r.x + 3, r.y + 10, 27, 13, 'rgba(0,0,0,.5)');
    // octagonal pedestal
    const oct = (R, dy) => { const p = []; for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + TAU / 16; p.push([r.x + Math.cos(a) * R, r.y + dy + Math.sin(a) * R * .9]); } return p; };
    poly(ctx, oct(24, 6), '#2a3334', '#0c1214', 1.5);
    poly(ctx, oct(24, 0), '#5d6863', '#161e1f', 1.5);
    poly(ctx, oct(19, 0), '#46524f', 'rgba(255,245,220,.2)', 1);
    if (kind === 'bell') {
      const swing = lit ? Math.sin(t * 5) * .22 : 0;
      line(ctx, r.x - 22, r.y - 26, r.x + 22, r.y - 26, '#4a2e1a', 5); line(ctx, r.x - 22, r.y - 27.5, r.x + 22, r.y - 27.5, 'rgba(255,200,150,.25)', 1.2);
      line(ctx, r.x - 20, r.y - 26, r.x - 18, r.y + 4, '#3a2412', 4); line(ctx, r.x + 20, r.y - 26, r.x + 18, r.y + 4, '#3a2412', 4);
      ctx.save(); ctx.translate(r.x, r.y - 24); ctx.rotate(swing);
      const bg = ctx.createLinearGradient(-14, 0, 14, 0);
      bg.addColorStop(0, lit ? '#ffe7a8' : '#8a6a36'); bg.addColorStop(.35, lit ? '#fff6d8' : '#c89c52'); bg.addColorStop(1, lit ? '#d8a050' : '#5a3e1a');
      poly(ctx, [[-6, 2], [6, 2], [9, 12], [14, 24], [15, 28], [-15, 28], [-14, 24], [-9, 12]], bg, '#241406', 1.6);
      ellipse(ctx, 0, 28, 15, 4, lit ? '#fff0c0' : '#3a2410', '#241406', 1.2);
      line(ctx, -12, 22, 12, 22, 'rgba(40,20,5,.5)', 1.2);
      circle(ctx, 0, 30, 3, '#2a1a0a');
      ctx.restore();
      if (lit) for (let i = 0; i < 3; i++) { const ph = (t * .8 + i / 3) % 1; ctx.beginPath(); ctx.arc(r.x, r.y - 6, 20 + ph * 50, -2.6, -.54); ctx.strokeStyle = `rgba(255,225,150,${.5 * (1 - ph)})`; ctx.lineWidth = 2; ctx.stroke(); }
    } else if (kind === 'sanctuary') {
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + (lit ? t * .2 : 0);
        ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(a);
        poly(ctx, [[0, -4], [15, -6], [20, 0], [15, 6], [0, 4]], lit ? '#9ff0c8' : '#6f8f80', '#1a2c24', 1);
        ctx.restore();
      }
      const cg = ctx.createRadialGradient(r.x - 3, r.y - 4, 1, r.x, r.y, 10);
      cg.addColorStop(0, lit ? '#f0fff6' : '#b8c8c0'); cg.addColorStop(1, lit ? '#50d8a0' : '#4a6058');
      poly(ctx, [[r.x, r.y - 11], [r.x + 7, r.y], [r.x, r.y + 9], [r.x - 7, r.y]], cg, '#0e1e18', 1.4);
    } else {
      // sun seal: tilted golden disc with engraved rays
      ctx.save(); ctx.translate(r.x, r.y - 4);
      ellipse(ctx, 0, 3, 17, 15, '#3a2c14');
      const dg = ctx.createRadialGradient(-5, -6, 2, 0, 0, 17);
      dg.addColorStop(0, lit ? '#f4fff8' : '#ffe9b0'); dg.addColorStop(.55, lit ? '#8ff2ce' : '#d8a850'); dg.addColorStop(1, lit ? '#2f9a78' : '#7a5420');
      ellipse(ctx, 0, 0, 16, 14, dg, '#fff0c0', 1.4);
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; line(ctx, Math.cos(a) * 6, Math.sin(a) * 5, Math.cos(a) * 13, Math.sin(a) * 11.5, 'rgba(90,50,10,.45)', 1.2); }
      poly(ctx, [[0, -6], [5, 0], [0, 6], [-5, 0]], lit ? '#ffffff' : '#fff6d8', 'rgba(90,50,10,.6)', 1);
      ctx.restore();
    }
    if (charge > 0 && !lit) {
      ctx.beginPath(); ctx.arc(r.x, r.y, 30, -Math.PI / 2, -Math.PI / 2 + charge * TAU); ctx.strokeStyle = '#1a1206'; ctx.lineWidth = 7; ctx.stroke();
      ctx.beginPath(); ctx.arc(r.x, r.y, 30, -Math.PI / 2, -Math.PI / 2 + charge * TAU); ctx.strokeStyle = '#ffd88a'; ctx.lineWidth = 4; ctx.stroke();
      glowQueue.push([r.x, r.y, 40 + charge * 30, SUN, .25 + charge * .4]);
    }
    if (lit) glowQueue.push([r.x, r.y - 6, 70, kind === 'bell' ? SUN : MINT, .6], [r.x, r.y - 6, 26, '255,255,240', .6]);
    else glowQueue.push([r.x, r.y - 4, 34, kind === 'sanctuary' ? '120,200,170' : SUN, .22 + .1 * Math.sin(t * 2.4)]);
    if (!lit) labels.push({ x: r.x, y: r.y + 44, text: kind === 'bell' ? 'BELL' : kind === 'sanctuary' ? 'SANCTUARY' : (r.id === 'gate' ? 'GATE SEAL' : 'SUN SEAL'), color: kind === 'sanctuary' ? '#bfe9d6' : '#f2dca8', size: 10 });
  }
  function incomingDir(m, s) {
    for (const b of arr(s.beams)) {
      if (Math.hypot(b.x2 - m.x, b.y2 - m.y) < num(m.r, 16) + 4) {
        const L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
        if (L > 1) return [(b.x2 - b.x1) / L, (b.y2 - b.y1) / L];
      }
    }
    return null;
  }
  function drawMirror(ctx, m, t, s) {
    const dirs = arr(m.dirs).filter(d => Array.isArray(d) && d.length >= 2);
    const idx = clamp(Math.floor(num(m.index, 0)), 0, Math.max(0, dirs.length - 1));
    const out = dirs[idx] || [1, 0];
    const inc = incomingDir(m, s);
    const lit = typeof m.lit === 'boolean' ? m.lit : !!inc;
    ellipse(ctx, m.x + 3, m.y + 10, 22, 11, 'rgba(0,0,0,.5)');
    // stone drum
    ellipse(ctx, m.x, m.y + 6, 19, 12, '#2a3232', '#0c1212', 1.4);
    ctx.fillStyle = '#2a3232'; ctx.fillRect(m.x - 19, m.y, 38, 6);
    ellipse(ctx, m.x, m.y, 19, 12, '#6a726c', '#141c1c', 1.4);
    ellipse(ctx, m.x, m.y, 14, 9, '#525c58', 'rgba(255,245,220,.25)', 1);
    if (m.split) {
      // prism crystal
      ctx.save(); ctx.translate(m.x, m.y - 12);
      const pg = ctx.createLinearGradient(-12, -12, 12, 12);
      pg.addColorStop(0, '#fff'); pg.addColorStop(.3, '#bfe8ff'); pg.addColorStop(.55, '#e8c8ff'); pg.addColorStop(.8, '#ffe0b0'); pg.addColorStop(1, '#a0f0e0');
      poly(ctx, [[0, -16], [12, 6], [0, 11], [-12, 6]], pg, '#2a2440', 1.6);
      poly(ctx, [[0, -16], [0, 11], [-12, 6]], 'rgba(60,40,120,.25)');
      line(ctx, -2, -10, -7, 3, 'rgba(255,255,255,.8)', 1.4);
      ctx.restore();
      glowQueue.push([m.x, m.y - 10, lit ? 60 : 26, SPLIT, lit ? .7 : .25]);
      for (const d of dirs) {
        const a = Math.atan2(d[1], d[0]);
        ctx.save(); ctx.translate(m.x + Math.cos(a) * 25, m.y + Math.sin(a) * 25 * .8); ctx.rotate(a);
        poly(ctx, [[5, 0], [-3, -4], [-3, 4]], lit ? '#e8d8ff' : 'rgba(220,210,255,.6)', '#1a1430', 1); ctx.restore();
      }
      if (!lit) labels.push({ x: m.x, y: m.y + 32, text: 'PRISM', color: '#dcd0ff', size: 9 });
      return;
    }
    // Rotating mirror pane; the normal bisects incoming and outgoing light.
    let nx, ny;
    if (inc) { nx = out[0] - inc[0]; ny = out[1] - inc[1]; } else { const a = Math.atan2(out[1], out[0]) + Math.PI * .75; nx = Math.cos(a) + out[0]; ny = Math.sin(a) + out[1]; }
    const nl = Math.hypot(nx, ny);
    const pa = nl < .1 ? Math.atan2(out[1], out[0]) : Math.atan2(ny / nl, nx / nl) + Math.PI / 2;
    ctx.save(); ctx.translate(m.x, m.y - 10); ctx.rotate(pa);
    rrect(ctx, -15, -4, 30, 8, 2); ctx.fillStyle = '#7a5a2a'; ctx.fill(); ctx.strokeStyle = '#1e1408'; ctx.lineWidth = 1.4; ctx.stroke();
    const mg = ctx.createLinearGradient(-13, 0, 13, 0); mg.addColorStop(0, '#9fb8c0'); mg.addColorStop(.4, '#f4fbff'); mg.addColorStop(.6, '#cfe4ea'); mg.addColorStop(1, '#7c98a2');
    ctx.fillStyle = mg; ctx.fillRect(-13, -2.2, 26, 4.4);
    ctx.restore();
    line(ctx, m.x, m.y - 2, m.x, m.y - 8, '#4a3a20', 3);
    // output direction chevron and option ticks
    for (let i = 0; i < dirs.length; i++) {
      const a = Math.atan2(dirs[i][1], dirs[i][0]), cur = i === idx;
      ctx.save(); ctx.translate(m.x + Math.cos(a) * 26, m.y + Math.sin(a) * 26 * .8); ctx.rotate(a);
      if (cur) poly(ctx, [[7, 0], [-4, -6], [-1, 0], [-4, 6]], lit ? '#bfffe6' : '#ffd88a', '#1a1206', 1.2);
      else circle(ctx, 0, 0, 2.2, 'rgba(220,210,180,.5)');
      ctx.restore();
    }
    if (!lit) {
      ctx.save(); ctx.setLineDash([3, 6]); ctx.lineDashOffset = -t * 18;
      line(ctx, m.x + out[0] * 32, m.y + out[1] * 32, m.x + out[0] * 76, m.y + out[1] * 76, 'rgba(255,220,150,.45)', 1.6); ctx.restore();
    }
    glowQueue.push([m.x, m.y - 10, lit ? 30 : 16, lit ? MINT : '220,230,240', lit ? .45 : .18]);
    const p = s.player;
    if (p && Math.hypot(p.x - m.x, p.y - m.y) < 70 && dirs.length > 1) {
      const pulse = .6 + .4 * Math.sin(t * 6);
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(t * 1.6);
      ctx.strokeStyle = `rgba(255,236,180,${.75 * pulse})`; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 33, i * TAU / 3, i * TAU / 3 + 1.4); ctx.stroke(); const a = i * TAU / 3 + 1.4; ctx.save(); ctx.translate(Math.cos(a) * 33, Math.sin(a) * 33); ctx.rotate(a + Math.PI / 2); poly(ctx, [[4, 0], [-3, -4], [-3, 4]], `rgba(255,236,180,${.85 * pulse})`); ctx.restore(); }
      ctx.restore();
      labels.push({ x: m.x, y: m.y - 44, text: 'SLASH TO TURN', color: '#ffe6b0', size: 10 });
    }
  }
  function drawTurret(ctx, e, s, t) {
    const silenced = turretSilent(e);
    const jammed = !silenced && (num(e.jammed, 0) > 0 || e.phase === 'jammed');
    const tele = !silenced && !jammed && /telegraph|aim|charge|windup/.test(e.phase || '');
    let ax = e.aimX, ay = e.aimY;
    if (!Number.isFinite(ax) || !Number.isFinite(ay) || (ax === 0 && ay === 0)) {
      const tgt = (e.targets === 'escort' && s.escort) ? s.escort : s.player;
      ax = tgt ? tgt.x - e.x : -1; ay = tgt ? tgt.y - e.y : 0;
    }
    const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
    const a = Math.atan2(ay, ax) + (jammed ? Math.sin(t * 30) * .08 + .35 : 0);
    ellipse(ctx, e.x + 3, e.y + 10, 26, 13, 'rgba(0,0,0,.5)');
    const oct = (R, dy) => { const p = []; for (let i = 0; i < 8; i++) { const q = i * TAU / 8 + TAU / 16; p.push([e.x + Math.cos(q) * R, e.y + dy + Math.sin(q) * R * .85]); } return p; };
    poly(ctx, oct(23, 7), '#2a2622', '#0a0806', 1.5);
    poly(ctx, oct(23, 0), silenced ? '#3e403c' : '#5a5448', '#14100c', 1.5);
    for (let i = 0; i < 8; i++) { const q = i * TAU / 8 + TAU / 16; circle(ctx, e.x + Math.cos(q) * 19, e.y + Math.sin(q) * 16, 1.4, '#a88a52'); }
    ctx.save(); ctx.translate(e.x, e.y - 6); ctx.rotate(a);
    // bronze bell-mortar barrel
    const bg = ctx.createLinearGradient(0, -9, 0, 9); bg.addColorStop(0, silenced ? '#5a5a50' : '#e0b870'); bg.addColorStop(.5, silenced ? '#3a3a34' : '#9a6e30'); bg.addColorStop(1, '#3a2610');
    poly(ctx, [[-10, -9], [14, -7], [26, -10], [26, 10], [14, 7], [-10, 9]], bg, '#1a1006', 1.6);
    ellipse(ctx, 26, 0, 3.5, 10, '#140c04', '#e8c890', 1.2);
    ctx.restore();
    circle(ctx, e.x, e.y - 6, 10, silenced ? '#44463e' : '#6e5a34', '#1a1006', 1.5);
    const eyeRGB = silenced ? null : jammed ? '140,200,255' : tele ? RED : '255,180,90';
    if (eyeRGB) { circle(ctx, e.x, e.y - 6, 4.5, `rgb(${eyeRGB})`, '#120804', 1); glowQueue.push([e.x, e.y - 6, tele ? 34 : 20, eyeRGB, tele ? .8 : .45]); }
    else circle(ctx, e.x, e.y - 6, 4.5, '#22241e');
    const mx = e.x + Math.cos(a) * 28, my = e.y - 6 + Math.sin(a) * 28;
    if (tele) {
      const prog = clamp(1 - num(e.timer, .5) / 1.0, 0, 1);
      glowQueue.push([mx, my, 16 + prog * 24, RED, .5 + prog * .5]);
    }
    if (jammed) {
      for (let i = 0; i < 6; i++) { // sparks + smoke
        const ph = (t * 3 + i * .37) % 1, sa = i * 2.1 + Math.floor(t * 12) * .7;
        glowQueue.push([mx + Math.cos(sa) * ph * 14, my + Math.sin(sa) * ph * 14 - ph * 6, 5, '180,220,255', 1 - ph]);
        circle(ctx, e.x + Math.sin(i * 3 + t) * 6, e.y - 18 - ph * 30, 4 + ph * 7, `rgba(120,130,135,${.35 * (1 - ph)})`);
      }
      labels.push({ x: e.x, y: e.y - 40, text: 'JAMMED', color: '#bfe2ff', size: 9 });
    }
    if (silenced) for (let i = 0; i < 3; i++) mossClump(ctx, e.x - 12 + i * 11, e.y + 4, 4, rngFor(i + 7), .5);
  }
  function turretSilent(e) { return !!e.silenced || /silen|off|disabled|defeated/.test(e.phase || '') || (e.hp !== undefined && e.hp <= 0 && e.phase !== 'jammed'); }
  function drawTurretAim(ctx, e, s, t) {
    const tele = !turretSilent(e) && num(e.jammed, 0) <= 0 && e.phase !== 'jammed' && /telegraph|aim|charge|windup/.test(e.phase || '');
    if (!tele) return;
    let ax = e.aimX, ay = e.aimY;
    if (!Number.isFinite(ax) || !Number.isFinite(ay)) { const tg = (e.targets === 'escort' && s.escort) ? s.escort : s.player; ax = tg.x - e.x; ay = tg.y - e.y; }
    const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
    const walls = arr(s.walls).concat(arr(s.gates).filter(g => !g.open));
    const hit = PW.raySegment ? PW.raySegment(e.x, e.y, ax, ay, walls, 900) : { x: e.x + ax * 600, y: e.y + ay * 600 };
    const prog = clamp(1 - num(e.timer, .5) / 1.0, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    line(ctx, e.x, e.y, hit.x, hit.y, `rgba(255,70,50,${.08 + .12 * prog})`, 14);
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 60;
    line(ctx, e.x + ax * 30, e.y + ay * 30, hit.x, hit.y, `rgba(255,120,90,${.5 + .4 * prog})`, 2);
    ctx.restore();
    circle(ctx, hit.x, hit.y, 6 + 4 * Math.sin(t * 14), null, 'rgba(255,120,90,.7)', 1.5);
  }
  function drawSentinelFloor(ctx, e, s, t) {
    if (num(e.hp, 1) <= 0) return;
    const p = s.player;
    const lunge = e.phase === 'lunge-windup' || e.phase === 'lunge';
    const warn = !lunge && /telegraph|charge|windup|aim/.test(e.phase || '');
    if (lunge) {
      const a = Math.atan2(num(e.aimY, 0), num(e.aimX, -1));
      const distance = e.phase === 'lunge' ? Math.max(0, num(e.timer, 0) * 450) : 153;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      const alpha = e.phase === 'lunge' ? .42 : .18 + .1 * Math.sin(t * 16);
      ctx.fillStyle = `rgba(255,70,50,${alpha})`; rrect(ctx, 0, -31, distance + 29, 62, 10); ctx.fill();
      ctx.strokeStyle = '#ff9b87'; ctx.lineWidth = 2; ctx.stroke();
      for (let x = 27; x < distance + 12; x += 31) { line(ctx, x - 8, -12, x + 4, 0, '#ffd5ba', 3); line(ctx, x + 4, 0, x - 8, 12, '#ffd5ba', 3); }
      ctx.restore();
    }
    if (warn && p) {
      const a = Number.isFinite(e.aimX) ? Math.atan2(e.aimY, e.aimX) : Math.atan2(p.y - e.y, p.x - e.x);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      const gr = ctx.createLinearGradient(18, 0, 260, 0); gr.addColorStop(0, 'rgba(255,120,80,.32)'); gr.addColorStop(1, 'rgba(255,120,80,0)');
      poly(ctx, [[18, -7], [260, -24], [260, 24], [18, 7]], gr);
      ctx.setLineDash([8, 8]); ctx.lineDashOffset = -t * 40; line(ctx, 18, 0, 265, 0, 'rgba(255,190,150,.75)', 2); ctx.restore();
    }
  }
  function drawSentinel(ctx, e, s, t) {
    const hp = num(e.hp, 0);
    if (hp <= 0) { // toppled bell husk
      ellipse(ctx, e.x + 3, e.y + 8, 30, 12, 'rgba(0,0,0,.45)');
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(1.2);
      poly(ctx, [[-10, -18], [10, -18], [18, 10], [-18, 10]], '#4c5a52', '#1a2220', 2);
      ellipse(ctx, 0, 10, 18, 6, '#26302c'); ctx.restore();
      for (let i = 0; i < 3; i++) circle(ctx, e.x - 20 + i * 18, e.y + 12, 3, '#5a6258');
      return;
    }
    const lunge = e.phase === 'lunge-windup' || e.phase === 'lunge';
    const warn = !lunge && /telegraph|charge|windup|aim/.test(e.phase || '');
    const exposed = num(e.exposed, 0) > 0 || e.phase === 'exposed';
    const dormant = e.phase === 'dormant';
    const bob = dormant ? 0 : Math.sin(t * 3) * 1.5;
    ellipse(ctx, e.x + 4, e.y + 18, 32, 13, 'rgba(0,0,0,.55)');
    ctx.save(); ctx.translate(e.x, e.y + bob); ctx.scale(SCALE_SENTINEL, SCALE_SENTINEL);
    if (lunge) circle(ctx, 0, -8, 36, null, '#ff977e', 3);
    // hammer fists
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(sd * 26, -4 + (warn ? Math.sin(t * 14) * 2 : 0));
      line(ctx, -sd * 8, -6, 0, 0, '#2a302c', 6);
      rrect(ctx, -8, -8, 16, 16, 4); ctx.fillStyle = rg(ctx, -4, -5, 14, '#a8b0a0', '#3a423a'); ctx.fill(); ctx.strokeStyle = '#121614'; ctx.lineWidth = 1.6; ctx.stroke();
      line(ctx, -5, -6, 5, -6, 'rgba(255,245,220,.3)', 1.4);
      ctx.restore();
    }
    // bell body with verdigris
    const bg = ctx.createRadialGradient(-8, -18, 2, 0, 0, 34);
    bg.addColorStop(0, '#b8e0c8'); bg.addColorStop(.35, '#6f9c86'); bg.addColorStop(.75, '#34564a'); bg.addColorStop(1, '#1a2c26');
    poly(ctx, [[-11, -30], [11, -30], [16, -16], [20, 4], [24, 16], [-24, 16], [-20, 4], [-16, -16]], bg, '#0e1614', 2);
    ellipse(ctx, 0, 16, 24, 6, '#1c2a26', '#0e1614', 1.6);
    line(ctx, -19, 2, 19, 2, 'rgba(10,20,18,.55)', 2); line(ctx, -17, -2, 17, -2, 'rgba(200,240,220,.25)', 1);
    for (let i = 0; i < 5; i++) circle(ctx, -14 + i * 7, 9, 1.6, '#c8a860');
    // stone mask with glowing eye slit
    poly(ctx, [[-10, -30], [10, -30], [12, -22], [8, -14], [-8, -14], [-12, -22]], '#a8a894', '#1a1e1a', 1.6);
    line(ctx, -7, -22, 7, -22, '#10161a', 4.5);
    const eye = lunge ? RED : warn ? '255,180,120' : dormant ? '120,140,150' : '160,230,230';
    line(ctx, -5, -22, 5, -22, `rgb(${eye})`, 2.2);
    if (exposed) {
      // bell split open: glowing core
      poly(ctx, [[-4, -10], [4, -10], [8, 4], [0, 12], [-8, 4]], '#14261e', '#0a1410', 1);
      const cg = ctx.createRadialGradient(0, 0, 1, 0, 0, 10); cg.addColorStop(0, '#ffffff'); cg.addColorStop(.5, '#b2ffdb'); cg.addColorStop(1, '#3ad29a');
      poly(ctx, [[0, -8], [6, 1], [0, 10], [-6, 1]], cg);
      line(ctx, -2, -12, -6, 6, '#d8fff0', 1.2); line(ctx, 3, -12, 7, 4, '#d8fff0', 1.2);
    } else {
      poly(ctx, [[0, -9], [7, 1], [0, 10], [-7, 1]], '#c89a58', '#241a0c', 1.6);
    }
    ctx.restore();
    if (!dormant) glowQueue.push([e.x, e.y + (bob - 22) * SCALE_SENTINEL, 22, eye, .7]);
    if (exposed) glowQueue.push([e.x, e.y + bob, 64, MINT, .6]);
    // health bar
    const maxHp = num(e.maxHp, hp) || 1;
    ctx.fillStyle = 'rgba(6,14,18,.85)'; rrect(ctx, e.x - 30, e.y - 58, 60, 7, 3); ctx.fill();
    ctx.fillStyle = exposed ? '#8ff2ce' : '#eda984'; rrect(ctx, e.x - 29, e.y - 57, 58 * clamp(hp / maxHp, 0, 1), 5, 2.5); ctx.fill();
    labels.push({ x: e.x, y: e.y - 70, text: exposed ? 'ARMOR OPEN — STRIKE' : lunge ? 'DODGE • UNBLOCKABLE' : warn ? 'RETURN THE SHOT' : /verger/.test(e.id || '') ? 'TOWER VERGER' : 'BELL SENTINEL', color: exposed ? '#8ff2ce' : lunge ? '#ffb79c' : '#e5d7bd', size: 10 });
  }
  function diverState(e) {
    const ph = e.phase || '';
    const surfacing = /surfac|emerge/.test(ph);
    const diving = /diving/.test(ph);
    const submerged = !surfacing && !diving && (e.submerged === true || /submerg|under/.test(ph));
    const exposed = num(e.exposed, 0) > 0 || ph === 'exposed';
    return { submerged, surfacing, diving, exposed, aiming: ph === 'volley-telegraph' };
  }
  function drawDiverFloor(ctx, e, s, t) {
    if (num(e.hp, 1) <= 0) return;
    const st = diverState(e);
    if (st.submerged) {
      ellipse(ctx, e.x, e.y, 46, 30, 'rgba(0,12,18,.5)');
      ellipse(ctx, e.x, e.y, 30, 19, 'rgba(0,8,12,.45)');
      for (let i = 0; i < 3; i++) { const ph = (t * .6 + i / 3) % 1; ellipse(ctx, e.x, e.y, 30 + ph * 40, 18 + ph * 24, null, `rgba(200,240,255,${.35 * (1 - ph)})`, 1.4); }
      for (let i = 0; i < 7; i++) { const ph = (t * 1.3 + i * .29) % 1; circle(ctx, e.x + Math.sin(i * 2.7 + t) * 20, e.y + Math.cos(i * 1.9) * 12 - ph * 8, 1.5 + ph * 2.5, null, `rgba(220,250,255,${.7 * (1 - ph)})`, 1); }
    }
    if (st.surfacing) {
      const R = 150, pulse = .5 + .5 * Math.sin(t * 18);
      ctx.fillStyle = `rgba(255,70,50,${.08 + .08 * pulse})`; circle(ctx, e.x, e.y, R, ctx.fillStyle);
      ctx.save(); ctx.setLineDash([12, 8]); ctx.lineDashOffset = t * 40; circle(ctx, e.x, e.y, R, null, `rgba(255,140,110,${.6 + .3 * pulse})`, 3); ctx.restore();
      for (let i = 0; i < 3; i++) { const ph = (t * 1.5 + i / 3) % 1; circle(ctx, e.x, e.y, 20 + ph * 50, null, `rgba(220,245,255,${.5 * (1 - ph)})`, 2); }
      labels.push({ x: e.x, y: e.y - R - 12, text: 'SURFACING — GET CLEAR', color: '#ffb79c', size: 11 });
    }
    if (st.diving) for (let i = 0; i < 3; i++) { const ph = (t * 1.2 + i / 3) % 1; ellipse(ctx, e.x, e.y + 8, 30 + ph * 36, 16 + ph * 20, null, `rgba(210,245,255,${.45 * (1 - ph)})`, 1.6); }
    if (st.aiming) {
      const base = Math.atan2(num(e.aimY, 0), num(e.aimX, -1)), locked = !!e.locked;
      const n = [];
      for (let i = 0; i < 5; i++) n.push(base + (i - 2) * .2);
      if (num(e.hp, 10) <= num(e.maxHp, 10) / 2) for (let i = 0; i < 8; i++) n.push(i * Math.PI / 4 + (num(e.volley, 0) % 2) * Math.PI / 8);
      ctx.save(); ctx.setLineDash([6, 8]); ctx.lineDashOffset = -t * 40;
      n.forEach((a, i) => line(ctx, e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, e.x + Math.cos(a) * (i < 5 ? 230 : 150), e.y + Math.sin(a) * (i < 5 ? 230 : 150), `rgba(255,${locked ? 110 : 170},90,${locked ? .85 : .45})`, locked ? 2.4 : 1.6));
      ctx.restore();
    }
  }
  function drawDiver(ctx, e, s, t) {
    const hp = num(e.hp, 0), st = diverState(e);
    if (hp <= 0) {
      ellipse(ctx, e.x + 4, e.y + 12, 40, 16, 'rgba(0,0,0,.45)');
      ellipse(ctx, e.x, e.y, 30, 24, '#5a4a30', '#1a1206', 2); circle(ctx, e.x - 8, e.y - 4, 7, '#1a2226', '#c8a060', 2);
      return;
    }
    if (st.submerged) return;
    const rise = st.surfacing ? clamp(1 - num(e.timer, .4) / .8, 0, 1) : st.diving ? clamp(num(e.timer, .3) / .6, 0, 1) : 1;
    const bob = Math.sin(t * 2.2) * 2;
    ctx.save(); ctx.globalAlpha = .35 + .65 * rise;
    ellipse(ctx, e.x + 5, e.y + 22, 46, 16, 'rgba(0,0,0,.55)');
    ctx.translate(e.x, e.y + bob + (1 - rise) * 16);
    // trailing anemone tentacles
    for (let i = 0; i < 6; i++) {
      const a0 = Math.PI * .15 + i * Math.PI * .14, sway = Math.sin(t * 3 + i) * .25;
      ctx.beginPath(); ctx.moveTo(Math.cos(a0) * 24, 8 + Math.sin(a0) * 10);
      ctx.quadraticCurveTo(Math.cos(a0 + sway) * 40, 20 + Math.sin(a0) * 18, Math.cos(a0 - sway) * 46, 30 + Math.sin(a0) * 16);
      ctx.strokeStyle = '#7a2e3a'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#d06070'; ctx.lineWidth = 2.4; ctx.stroke();
    }
    // brass diving bell helmet
    const hg = ctx.createRadialGradient(-12, -20, 3, 0, -6, 38);
    hg.addColorStop(0, '#fff0c0'); hg.addColorStop(.3, '#d8a850'); hg.addColorStop(.75, '#7a5220'); hg.addColorStop(1, '#2a1a08');
    ctx.beginPath(); ctx.moveTo(-32, 12); ctx.bezierCurveTo(-34, -30, 34, -30, 32, 12); ctx.closePath();
    ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = '#1a1006'; ctx.lineWidth = 2.4; ctx.stroke();
    ellipse(ctx, 0, 12, 33, 8, '#3a2610', '#1a1006', 2);
    for (let i = 0; i < 9; i++) circle(ctx, -28 + i * 7, 11, 1.8, '#f0d090');
    // barnacles
    for (let i = 0; i < 7; i++) circle(ctx, -22 + (i * 13) % 40, -14 + (i * 7) % 18, 2.2, 'rgba(230,230,220,.8)', '#3a3020', .8);
    // portholes
    const portRGB = st.exposed ? MINT : (/volley|attack|fire/.test(e.phase || '') ? '255,150,90' : '255,220,150');
    for (const [px, py, pr] of [[0, -8, 10], [-19, -2, 6], [19, -2, 6]]) {
      circle(ctx, px, py, pr + 2.5, '#5a3a14', '#1a1006', 1.6);
      circle(ctx, px, py, pr, `rgb(${portRGB})`, '#1a1006', 1.2);
      line(ctx, px - pr * .5, py - pr * .4, px - pr * .1, py - pr * .7, 'rgba(255,255,255,.8)', 1.4);
    }
    if (st.exposed) {
      ctx.beginPath(); ctx.moveTo(-6, -24); ctx.lineTo(-2, -14); ctx.lineTo(-8, -6); ctx.lineTo(0, 2);
      ctx.strokeStyle = '#eafff6'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
    glowQueue.push([e.x, e.y - 8 + bob, st.exposed ? 58 : 40, portRGB, st.exposed ? .42 : .4]);
    if (st.exposed) labels.push({ x: e.x, y: e.y - 50, text: 'EXPOSED — STRIKE', color: '#8ff2ce', size: 11 });
    // dripping water
    for (let i = 0; i < 5; i++) { const ph = (t * 1.4 + i * .2) % 1; circle(ctx, e.x - 26 + i * 13, e.y + 14 + ph * 14, 1.4, `rgba(200,240,255,${.7 * (1 - ph)})`); }
  }
  function drawRings(ctx, s, t) {
    for (const r of arr(s.rings)) {
      if (!Number.isFinite(r.x)) continue;
      const R = num(r.r, num(r.radius, 0)), max = num(r.maxR, num(r.max, 150)), f = clamp(R / (max || 150), 0, 1);
      if (r.hostile === false) {
        const rgb = r.kind === 'bell' ? SUN : r.kind === 'mirror' ? '255,236,190' : MINT;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        circle(ctx, r.x, r.y, R, null, `rgba(${rgb},${.8 * (1 - f)})`, 3 * (1 - f) + 1);
        circle(ctx, r.x, r.y, R * .8, null, `rgba(${rgb},${.35 * (1 - f)})`, 1.5);
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.fillStyle = `rgba(255,90,70,${.1 * (1 - f)})`; circle(ctx, r.x, r.y, R, ctx.fillStyle);
      circle(ctx, r.x, r.y, R, null, `rgba(255,230,210,${.9 * (1 - f) + .1})`, 7 * (1 - f) + 2);
      circle(ctx, r.x, r.y, R - 8, null, `rgba(255,120,90,${.6 * (1 - f)})`, 3);
      circle(ctx, r.x, r.y, max, null, 'rgba(255,140,110,.35)', 1.2);
      for (let i = 0; i < 18; i++) { const a = i * TAU / 18 + r.x; circle(ctx, r.x + Math.cos(a) * (R + 4), r.y + Math.sin(a) * (R + 4) - 4 * (1 - f), 2, `rgba(220,245,255,${.7 * (1 - f)})`); }
      ctx.restore();
    }
  }
  function hpPips(ctx, x, y, hp, max) {
    for (let i = 0; i < max; i++) {
      const px = x + (i - (max - 1) / 2) * 9;
      poly(ctx, [[px, y - 4], [px + 3.6, y], [px, y + 4], [px - 3.6, y]], i < hp ? '#9ff5d2' : '#23343a', '#081418', 1.2);
    }
  }
  function drawIlex(ctx, o, t, opts) {
    const m = track(o, t);
    const moving = m.speed > 10;
    const step = moving ? Math.sin(m.phase) * 2 : 0;
    ctx.save(); ctx.translate(o.x, o.y); ctx.scale(SCALE_ILEX, SCALE_ILEX);
    ellipse(ctx, 1, 11, 11, 4.5, 'rgba(0,0,0,.45)');
    circle(ctx, -4, 9 + step, 3, '#2a1c14'); circle(ctx, 4, 9 - step, 3, '#2a1c14');
    // radio pack with antenna
    rrect(ctx, -8, -12, 16, 12, 2.5); ctx.fillStyle = '#5a4630'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    line(ctx, 5, -12, 9, -30, '#2a2a2a', 1.4);
    const blink = Math.sin(t * 5) > .3;
    circle(ctx, 9, -31, 2, blink ? '#ff6a5a' : '#6a2a24');
    // yellow oilskin coat
    poly(ctx, [[-8, -8], [8, -8], [10, 8], [0, 10], [-10, 8]], rg(ctx, -5, -6, 18, '#ffe070', '#b07810'), INK, 1.6);
    circle(ctx, -9, 0, 2.6, '#f0c9a0', INK, 1); circle(ctx, 9, 0, 2.6, '#f0c9a0', INK, 1);
    line(ctx, 0, -6, 0, 9, 'rgba(90,60,10,.6)', 1.2);
    // head: sou'wester hat and goggles
    circle(ctx, 0, -14, 7, rg(ctx, -2, -16, 9, '#ffe2c0', '#d8a47a'), INK, 1.5);
    ellipse(ctx, 0, -18, 10, 4.5, rg(ctx, -4, -20, 12, '#ffd860', '#a87010'), INK, 1.4);
    ellipse(ctx, 0, -20, 6, 4, rg(ctx, -2, -22, 7, '#fff0a0', '#c89020'), INK, 1.2);
    line(ctx, -4, -13, 4, -13, '#3a5a6a', 2.4); circle(ctx, -2.6, -13, 1.6, '#bfe8ff'); circle(ctx, 2.6, -13, 1.6, '#bfe8ff');
    ctx.restore();
    if (blink) glowQueue.push([o.x + 9 * SCALE_ILEX, o.y - 31 * SCALE_ILEX, 10, '255,90,70', .7]);
    if (opts && opts.pips) hpPips(ctx, o.x, o.y - 48, num(o.hp, 4), Math.max(num(o.maxHp, 4), num(o.hp, 4)));
    if (opts && opts.waiting && (typeof opts.waiting === 'string' || m.still > .6)) {
      rrect(ctx, o.x - 36, o.y - 60, 26, 15, 5); ctx.fillStyle = 'rgba(240,248,240,.92)'; ctx.fill();
      for (let i = 0; i < 3; i++) circle(ctx, o.x - 30 + i * 7, o.y - 52.5, 1.6, Math.floor(t * 3) % 3 === i ? '#1a2a30' : '#8a9aa0');
    }
  }
  function drawRescue(ctx, r, s, t) {
    if (r.freed) { drawIlex(ctx, r, t); labels.push({ x: r.x, y: r.y + 30, text: 'ILEX • SAFE', color: '#9ff5d2', size: 10 }); return; }
    drawIlex(ctx, r, t);
    // cage of light bars
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = -2; i <= 2; i++) line(ctx, r.x + i * 8, r.y - 34, r.x + i * 8, r.y + 12, `rgba(140,230,210,${.35 + .15 * Math.sin(t * 3 + i)})`, 2);
    ctx.restore();
    ellipse(ctx, r.x, r.y - 34, 20, 5, null, '#8ad8c0', 2); ellipse(ctx, r.x, r.y + 12, 20, 5, null, '#8ad8c0', 2);
    const guarded = arr(s.enemies).some(e => num(e.hp, 0) > 0 && e.phase !== 'dormant' && enemyType(e) !== 'turret');
    if (!guarded) labels.push({ x: r.x, y: r.y + 30, text: 'KEEPER ILEX', color: '#9ff5d2', size: 10 });
  }
  function drawPickup(ctx, p, s, t) {
    if (p.taken || p.collected || p.picked || p.got) return;
    const bob = Math.sin(t * 2.4 + p.x) * 3;
    ellipse(ctx, p.x, p.y + 10, 10 - bob * .5, 4, 'rgba(0,0,0,.4)');
    ctx.save(); ctx.translate(p.x, p.y - 8 + bob);
    if (p.kind === 'heart') {
      const hg = ctx.createLinearGradient(-10, -10, 10, 10); hg.addColorStop(0, '#ffb0b8'); hg.addColorStop(.5, '#e83a5a'); hg.addColorStop(1, '#7a1028');
      ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-14, -1, -9, -13, 0, -5); ctx.bezierCurveTo(9, -13, 14, -1, 0, 9); ctx.closePath();
      ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = '#2a0610'; ctx.lineWidth = 1.8; ctx.stroke();
      line(ctx, -6, -4, -3, -6, 'rgba(255,255,255,.85)', 1.6);
      ctx.restore(); glowQueue.push([p.x, p.y - 8 + bob, 34, '255,110,130', .55]);
    } else {
      // rolled keeper chart
      ctx.rotate(-.25);
      rrect(ctx, -13, -6, 26, 12, 5); ctx.fillStyle = '#e8d8a8'; ctx.fill(); ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 1.5; ctx.stroke();
      ellipse(ctx, -13, 0, 3, 6, '#c8b078', '#3a2a10', 1.2); ellipse(ctx, 13, 0, 3, 6, '#f4e8c4', '#3a2a10', 1.2);
      ctx.fillStyle = '#b8342a'; ctx.fillRect(-2, -6.5, 4, 13);
      line(ctx, -9, -3, 8, -3, 'rgba(90,60,20,.4)', 1);
      ctx.restore(); glowQueue.push([p.x, p.y - 8 + bob, 30, SUN, .45]);
    }
    const pl = s.player;
    if (pl && Math.hypot(pl.x - p.x, pl.y - p.y) < 150) labels.push({ x: p.x, y: p.y + 22, text: (p.text || (p.kind === 'heart' ? 'Heart vessel' : 'Keeper chart')).toUpperCase(), color: '#f6e6bc', size: 9 });
  }
  function beaconLit(s) { return !!(s.beacon && (s.beacon.lit || s.status === 'won')); }
  function beaconReady(s) {
    const req = arr(s.beacon && s.beacon.requires);
    return req.every(id => { const e = arr(s.enemies).find(x => x.id === id); return !e || num(e.hp, 0) <= 0; });
  }
  function drawBeacon(ctx, s, t) {
    const b = s.beacon, lit = beaconLit(s), ready = beaconReady(s);
    ctx.save(); ctx.translate(b.x, b.y);
    ellipse(ctx, 3, 12, 34, 14, 'rgba(0,0,0,.5)');
    // iron cage brazier with great lens
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + .3; line(ctx, Math.cos(a) * 26, Math.sin(a) * 14 + 6, Math.cos(a) * 18, Math.sin(a) * 10 - 40, '#1e2226', 4); }
    ellipse(ctx, 0, 6, 28, 13, '#3a3e42', '#0c0e10', 2);
    ellipse(ctx, 0, 2, 22, 10, lit ? '#ffcf70' : '#22262a', '#0c0e10', 1.5);
    const lg = ctx.createRadialGradient(-6, -26, 2, 0, -20, 20);
    lg.addColorStop(0, lit ? '#ffffff' : ready ? '#f8f0d0' : '#aab4bc'); lg.addColorStop(.6, lit ? '#ffd070' : ready ? '#c8b890' : '#56626c'); lg.addColorStop(1, lit ? '#e08a2a' : '#2a323a');
    ellipse(ctx, 0, -20, 15, 18, lg, '#0c0e10', 2);
    line(ctx, -6, -30, -2, -34, 'rgba(255,255,255,.7)', 1.6);
    ellipse(ctx, 0, -42, 20, 6, '#2a2e32', '#0c0e10', 1.5);
    ctx.restore();
    if (lit) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) {
        const a = t * .6 + k * Math.PI;
        const gr = ctx.createLinearGradient(b.x, b.y - 20, b.x + Math.cos(a) * 600, b.y - 20 + Math.sin(a) * 600);
        gr.addColorStop(0, 'rgba(255,220,150,.45)'); gr.addColorStop(1, 'rgba(255,220,150,0)');
        poly(ctx, [[b.x, b.y - 20], [b.x + Math.cos(a - .12) * 600, b.y - 20 + Math.sin(a - .12) * 600], [b.x + Math.cos(a + .12) * 600, b.y - 20 + Math.sin(a + .12) * 600]], gr);
      }
      ctx.restore();
      glowQueue.push([b.x, b.y - 20, 190, SUN, .9], [b.x, b.y - 20, 50, '255,255,240', 1]);
      if (!b.reached) labels.push({ x: b.x, y: b.y + 34, text: 'REACH THE BEACON', color: '#ffe0a0', size: 11 });
    } else if (ready) {
      glowQueue.push([b.x, b.y - 20, 60 + 10 * Math.sin(t * 3), SUN, .5]);
      labels.push({ x: b.x, y: b.y + 34, text: 'LIGHT THE BEACON', color: '#ffe0a0', size: 11 });
    } else labels.push({ x: b.x, y: b.y + 34, text: 'ABBEY BEACON', color: '#c8d0d8', size: 10, dim: true });
  }
  function drawPlayer(ctx, p, s, t) {
    const m = track(p, t);
    const a = Math.atan2(num(p.aimY, 0), num(p.aimX, 1));
    const ax = Math.cos(a), ay = Math.sin(a);
    const moving = m.speed > 12;
    const step = moving ? Math.sin(m.phase) : 0;
    const bob = moving ? Math.abs(Math.cos(m.phase)) * 1.4 : Math.sin(t * 2.2) * .5;
    const facingUp = ay < -.45;
    // dash afterimages
    if (num(p.dashTime, 0) > 0) {
      const dx = num(p.dashX, ax), dy = num(p.dashY, ay);
      for (let i = 1; i <= 3; i++) ellipse(ctx, p.x - dx * i * 12, p.y - dy * i * 12 - 6, 11, 15, `rgba(170,240,225,${.28 - i * .07})`);
    }
    ctx.save();
    if (num(p.invulnerable, 0) > 0 && num(p.dashTime, 0) <= 0 && Math.floor(t * 14) % 2) ctx.globalAlpha = .55;
    ctx.translate(p.x, p.y); ctx.scale(SCALE_HERO, SCALE_HERO);
    ellipse(ctx, 1, 12, 13, 5.5, 'rgba(0,0,0,.5)');
    const slashing = num(p.slashTime, 0) > 0;
    const px = -ay, py = ax; // sword-hand side
    const drawShield = () => {
      ctx.save(); ctx.translate(ax * 12, ay * 9 - 8); ctx.rotate(a);
      const refl = !!p.reflecting;
      ellipse(ctx, 0, 0, 5.2, 11.5, '#c8a048', INK, 1.8);
      const sg = ctx.createLinearGradient(0, -10, 0, 10);
      sg.addColorStop(0, refl ? '#ffffff' : '#f2fbfc'); sg.addColorStop(.45, refl ? '#c8fff0' : '#a4c2cc'); sg.addColorStop(1, refl ? '#7ae8c8' : '#56707c');
      ellipse(ctx, 1.2, 0, 3.4, 9.2, sg);
      line(ctx, .5, -6, 2, -2, 'rgba(255,255,255,.9)', 1.2);
      poly(ctx, [[1.5, 1], [3.2, 3.5], [1.5, 6], [-.2, 3.5]], refl ? '#fffbe0' : '#f0c870');
      ctx.restore();
      circle(ctx, ax * 8, ay * 6 - 6, 2.4, '#f0c9a0', INK, 1);
    };
    const drawSword = () => {
      ctx.save(); ctx.translate(px * 9, py * 6 - 5);
      if (slashing) {
        const prog = 1 - clamp(num(p.slashTime, 0) / .22, 0, 1);
        ctx.rotate(a - 1.4 + prog * 2.8);
        line(ctx, 3, 0, 27, 0, INK, 5); line(ctx, 4, 0, 27, 0, '#f2f8f4', 2.6); line(ctx, 5, -.6, 24, -.6, '#ffffff', .8);
        line(ctx, 3, -4, 3, 4, '#c8a050', 2.6);
      } else {
        ctx.rotate(a + 2.3 * (py >= 0 ? 1 : 1));
        line(ctx, 2, 0, 17, 0, INK, 4.5); line(ctx, 3, 0, 17, 0, '#e4ece8', 2.2); line(ctx, 2, -3.2, 2, 3.2, '#c8a050', 2.4);
      }
      ctx.restore();
      circle(ctx, px * 9, py * 6 - 5, 2.4, '#f0c9a0', INK, 1);
    };
    const shieldBehind = facingUp;
    if (shieldBehind) drawShield();
    if (facingUp && !slashing) drawSword();
    // boots
    ellipse(ctx, -4.2, 9 + step * 2, 3.3, 3, '#4a2c1a', INK, 1.2);
    ellipse(ctx, 4.2, 9 - step * 2, 3.3, 3, '#4a2c1a', INK, 1.2);
    ctx.translate(0, -bob);
    const capeSway = moving ? Math.sin(m.phase * .5) * 1.5 : Math.sin(t * 1.6) * .6;
    const cg = ctx.createLinearGradient(-12, -10, 12, 10);
    cg.addColorStop(0, '#fbf3dc'); cg.addColorStop(.6, '#e2d2ac'); cg.addColorStop(1, '#b8a47c');
    if (!facingUp) {
      poly(ctx, [[-9, -10], [9, -10], [12 + capeSway, 7], [0, 8.5], [-12 + capeSway, 7]], cg, INK, 1.6);
    }
    // tunic
    const tg = ctx.createLinearGradient(-9, -10, 9, 8);
    tg.addColorStop(0, '#3cb4aa'); tg.addColorStop(.55, '#1f7c7e'); tg.addColorStop(1, '#155056');
    poly(ctx, [[-7.5, -10], [7.5, -10], [9, 6], [0, 8], [-9, 6]], tg, INK, 1.7);
    line(ctx, -8.6, 1.5, 8.6, 1.5, '#5a3a1e', 2.4); circle(ctx, 0, 1.5, 1.7, '#f0d080');
    line(ctx, -2.5, -9, 0, -4, '#e8dcc0', 1.2); line(ctx, 2.5, -9, 0, -4, '#e8dcc0', 1.2);
    if (facingUp) {
      ellipse(ctx, -9.5, -9, 3.6, 3, '#1f7c7e', INK, 1.2); ellipse(ctx, 9.5, -9, 3.6, 3, '#1f7c7e', INK, 1.2);
      poly(ctx, [[-9, -11], [9, -11], [12.5 + capeSway, 8], [4, 10], [-4, 10], [-12.5 + capeSway, 8]], cg, INK, 1.6);
      for (const fx of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(fx * .6, -5); ctx.quadraticCurveTo(fx * 1.1 + capeSway * .5, 2, fx * 1.5 + capeSway, 9); ctx.strokeStyle = 'rgba(120,90,50,.35)'; ctx.lineWidth = 1.1; ctx.stroke(); }
      const hem = ctx.createLinearGradient(0, 4, 0, 10); hem.addColorStop(0, 'rgba(90,60,30,0)'); hem.addColorStop(1, 'rgba(90,60,30,.35)');
      poly(ctx, [[-12 + capeSway, 4], [12 + capeSway, 4], [12.5 + capeSway, 8], [4, 10], [-4, 10], [-12.5 + capeSway, 8]], hem);
      line(ctx, -12.2 + capeSway, 8, -4, 9.8, '#d8a848', 1.5); line(ctx, 4, 9.8, 12.2 + capeSway, 8, '#d8a848', 1.5);
      poly(ctx, [[-7, -11.5], [7, -11.5], [5.5, -5.5], [0, -4], [-5.5, -5.5]], rg(ctx, -3, -11, 9, '#46b8b0', '#185a5c'), INK, 1.2); // folded hood
    }
    // head
    const hx = ax * 1.2, hy = -16.5;
    ctx.save(); ctx.translate(hx, hy);
    if (facingUp) {
      // braid first so the head overlaps its root
      const bx = capeSway * .6;
      for (let i = 0; i < 4; i++) ellipse(ctx, bx * i / 3, 5 + i * 3.2, 2.6 - i * .2, 2.1, rg(ctx, bx * i / 3 - 1, 4 + i * 3.2, 3, '#e07a45', '#8a3a1c'), INK, 1);
      circle(ctx, bx, 17.5, 1.9, '#8ff2ce', INK, .8);
      circle(ctx, 0, 0, 8.6, rg(ctx, -3, -4, 11, '#ea8a52', '#8a3a1c'), INK, 1.7);
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 2.6, -7.8); ctx.quadraticCurveTo(i * 3.4, -2, i * 2.2, 4); ctx.strokeStyle = 'rgba(70,24,8,.45)'; ctx.lineWidth = .9; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(-1, -1, 6.4, Math.PI * 1.1, Math.PI * 1.55); ctx.strokeStyle = 'rgba(255,220,180,.7)'; ctx.lineWidth = 1.6; ctx.stroke();
    } else {
      circle(ctx, 0, 0, 8.6, rg(ctx, -3, -2, 11, '#ffe2c0', '#d8a47a'), INK, 1.7);
      ctx.beginPath(); ctx.arc(0, 0, 8.8, Math.PI * .98, Math.PI * 2.02); ctx.lineTo(8.8, 1.5);
      ctx.quadraticCurveTo(4 + ax * 2, -2.5, ax * 2, -1); ctx.quadraticCurveTo(-4 + ax * 2, -2.5, -8.8, 1.5); ctx.closePath();
      ctx.fillStyle = rg(ctx, -3, -5, 12, '#ea8a52', '#8a3a1c'); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(-1, -2, 6, Math.PI * 1.15, Math.PI * 1.55); ctx.strokeStyle = 'rgba(255,205,160,.55)'; ctx.lineWidth = 1.6; ctx.stroke();
      const ex = ax * 2.4;
      if (Math.abs(ax) < .92 || ay > 0) { ellipse(ctx, -3 + ex, 2.6, 1.2, 1.7, '#18222a'); ellipse(ctx, 3 + ex, 2.6, 1.2, 1.7, '#18222a'); }
      else ellipse(ctx, ex * 1.4, 2.6, 1.2, 1.7, '#18222a');
      ellipse(ctx, -4.6 + ex, 5, 1.6, .9, 'rgba(230,120,110,.45)'); ellipse(ctx, 4.6 + ex, 5, 1.6, .9, 'rgba(230,120,110,.45)');
      line(ctx, -7.8, -3.2, 7.8, -3.2, '#e8c870', 1.3);
      poly(ctx, [[ex * .6, -6.3], [ex * .6 + 2, -3.6], [ex * .6, -1.2], [ex * .6 - 2, -3.6]], p.reflecting ? '#e8fff8' : '#8ff2ce', INK, .8);
      line(ctx, -ax * 7.5, 2, -ax * 9 + capeSway * .4, 12, INK, 4.6); line(ctx, -ax * 7.5, 2, -ax * 9 + capeSway * .4, 12, '#a84a24', 3);
    }
    ctx.restore();
    if (!shieldBehind) drawShield();
    if (!facingUp || slashing) drawSword();
    ctx.restore();
    const H = SCALE_HERO;
    if (p.reflecting) glowQueue.push([p.x + ax * 14 * H, p.y + (ay * 9 - 8) * H, 34, MINT, .6], [p.x + ax * H, p.y - 22 * H, 8, MINT, .8]);
  }
  function drawPlayerFx(ctx, p, t) {
    const a = Math.atan2(num(p.aimY, 0), num(p.aimX, 1));
    ctx.save(); ctx.translate(p.x, p.y - 8);
    if (p.reflecting) {
      ctx.beginPath(); ctx.arc(0, 0, 30, a - 1, a + 1); ctx.strokeStyle = 'rgba(140,242,211,.85)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 35, a - .8, a + .8); ctx.strokeStyle = 'rgba(200,255,235,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // aim tick keeps facing readable with the shield down
    ctx.rotate(a);
    poly(ctx, [[44, 0], [36, -4.5], [36, 4.5]], p.reflecting ? '#8ff2ce' : 'rgba(230,236,210,.75)', INK, 1);
    if (num(p.slashTime, 0) > 0) {
      const prog = 1 - clamp(num(p.slashTime, 0) / .22, 0, 1);
      const a0 = -1.4, a1 = -1.4 + prog * 2.8;
      ctx.beginPath(); ctx.arc(0, 0, 44, a0, a1); ctx.arc(0, 0, 26, a1, a0, true); ctx.closePath();
      const sg = ctx.createRadialGradient(0, 0, 26, 0, 0, 46); sg.addColorStop(0, 'rgba(255,250,220,0)'); sg.addColorStop(.7, 'rgba(255,246,210,.45)'); sg.addColorStop(1, 'rgba(255,255,240,.9)');
      ctx.fillStyle = sg; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 45, Math.max(a0, a1 - .8), a1); ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- beams, shots, particles
  const stripCache = new Map();
  function beamStrip(rgb) {
    // Cross-section of the light a beam spills on the floor: smooth falloff, no banding.
    let c = stripCache.get(rgb);
    if (c) return c;
    c = makeCanvas(2, 64); const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(.2, `rgba(${rgb},.06)`); gr.addColorStop(.4, `rgba(${rgb},.22)`);
    gr.addColorStop(.5, `rgba(${rgb},.5)`); gr.addColorStop(.6, `rgba(${rgb},.22)`); gr.addColorStop(.8, `rgba(${rgb},.06)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 2, 64); stripCache.set(rgb, c); return c;
  }
  function beamRGB(kind) { return kind === 'reflected' ? MINT : kind === 'split' ? SPLIT : SUN; }
  function drawBeamLight(ctx, s) {
    // Light spilled on the floor around each beam (additive, under actors).
    for (const b of arr(s.beams)) {
      if (![b.x1, b.y1, b.x2, b.y2].every(Number.isFinite)) continue;
      const rgb = beamRGB(b.kind), L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
      if (L < 1 || !hasDoc) continue;
      ctx.save(); ctx.translate(b.x1, b.y1); ctx.rotate(Math.atan2(b.y2 - b.y1, b.x2 - b.x1));
      ctx.drawImage(beamStrip(rgb), 0, 0, 2, 64, 0, -76, L, 152);
      ctx.restore();
      bloom(ctx, b.x2, b.y2, 40, rgb, .3);
    }
  }
  function drawBeamCores(ctx, s, t) {
    for (const b of arr(s.beams)) {
      if (![b.x1, b.y1, b.x2, b.y2].every(Number.isFinite)) continue;
      const rgb = beamRGB(b.kind), L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
      ctx.lineCap = 'round';
      line(ctx, b.x1, b.y1 - 6, b.x2, b.y2 - 6, `rgba(${rgb},.35)`, 9);
      line(ctx, b.x1, b.y1 - 6, b.x2, b.y2 - 6, `rgba(${rgb},.9)`, 3.6);
      line(ctx, b.x1, b.y1 - 6, b.x2, b.y2 - 6, 'rgba(255,255,245,.95)', 1.3);
      ctx.lineCap = 'butt';
      if (L > 1) {
        const ux = (b.x2 - b.x1) / L, uy = (b.y2 - b.y1) / L;
        for (let d = (t * 140) % 46; d < L; d += 46) bloom(ctx, b.x1 + ux * d, b.y1 + uy * d - 6, 7, '255,255,240', .6);
      }
      bloom(ctx, b.x2, b.y2 - 6, 18, '255,255,240', .7);
    }
  }
  function drawShots(ctx, s, t) {
    for (const b of arr(s.shots)) {
      if (!Number.isFinite(b.x)) continue;
      const sp = Math.hypot(num(b.vx, 0), num(b.vy, 0)) || 1, ux = num(b.vx, 0) / sp, uy = num(b.vy, 0) / sp;
      const rgb = b.friendly ? MINT : '255,130,80';
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      line(ctx, b.x - ux * 26, b.y - uy * 26 - 6, b.x, b.y - 6, `rgba(${rgb},.35)`, 8);
      bloom(ctx, b.x, b.y - 6, 26, rgb, .8);
      bloom(ctx, b.x, b.y + 6, 22, rgb, .25);
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'butt';
      ellipse(ctx, b.x, b.y + 6, 5, 2.5, 'rgba(0,0,0,.35)');
      circle(ctx, b.x, b.y - 6, 5.5, b.friendly ? '#b8ffe6' : '#ffb07a', '#fff4d8', 1.6);
      circle(ctx, b.x - 1.5, b.y - 7.5, 1.8, '#ffffff');
    }
  }
  function drawParticles(ctx, s) {
    for (const p of arr(s.particles)) {
      if (!Number.isFinite(p.x)) continue;
      const life = clamp(num(p.life, 0) / num(p.maxLife, .65), 0, 1);
      const rgb = p.kind === 'hit' || p.kind === 'hurt' ? '255,120,90' : p.kind === 'heal' ? '140,255,170' : p.kind === 'dash' ? '200,240,255' : p.kind === 'slash' ? '255,240,200' : p.kind === 'splash' ? '200,240,255' : SUN;
      bloom(ctx, p.x, p.y - 6, 4 + 8 * life, rgb, life);
    }
  }
  function flushGlow(ctx) {
    for (const g of glowQueue) bloom(ctx, g[0], g[1], g[2], g[3], g[4]);
    glowQueue.length = 0;
  }
  let glowQueue = [];
  let labels = [];
  function drawLabels(ctx, v) {
    const placed = [];
    for (const l of labels) {
      let y = l.y;
      for (const p of placed) if (Math.abs(p.x - l.x) < 70 && Math.abs(p.y - y) < 13) y = p.y - 14;
      placed.push({ x: l.x, y });
      ctx.globalAlpha = l.dim ? .8 : 1;
      text(ctx, l.text, l.x, y, l.size || 10, l.color);
    }
    ctx.globalAlpha = 1;
    labels = [];
    void v;
  }

  // ---------------------------------------------------------------- atmosphere (screen space)
  function atmosphere(ctx, s, th, t, v, width, height) {
    const sx = x => (x - v.x) * v.scale, sy = y => (y - v.y) * v.scale;
    ctx.save();
    if (th.decor === 'beacon') {
      ctx.fillStyle = 'rgba(20,30,60,.08)'; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(190,210,235,.28)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 90; i++) {
        const x = ((i * 137.5 + t * 260) % (width + 200)) - 100, y = ((i * 71.3 + t * 900) % (height + 60)) - 30;
        ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 22);
      }
      ctx.stroke();
      const ph = (t % 7.3) / 7.3, flash = ph < .018 ? 1 : ph > .03 && ph < .042 ? .6 : 0;
      if (flash) { ctx.fillStyle = `rgba(215,230,255,${.22 * flash})`; ctx.fillRect(0, 0, width, height); }
    } else if (th.decor === 'bell' || th.decor === 'cloister') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x0 = sx(140 + i * 330), a = th.decor === 'bell' ? .05 : .025, sway = Math.sin(t * .3 + i) * 20;
        const gr = ctx.createLinearGradient(x0, 0, x0 + 260, height);
        gr.addColorStop(0, `rgba(255,220,160,${a})`); gr.addColorStop(1, 'rgba(255,220,160,0)');
        poly(ctx, [[x0 + sway, 0], [x0 + 90 + sway, 0], [x0 + 400 + sway, height], [x0 + 220 + sway, height]], gr);
      }
      for (let i = 0; i < 26; i++) { // dust motes
        const x = ((i * 97.1 + t * 8 * (1 + i % 3)) % width), y = ((i * 53.7 + Math.sin(t * .5 + i) * 30 + t * 4) % height);
        circle(ctx, x, y, 1 + (i % 3) * .5, `rgba(255,236,200,${.18 + .12 * Math.sin(t + i)})`);
      }
    } else if (th.decor === 'sanctuary') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 20; i++) {
        const x = ((i * 131.3 + Math.sin(t * .4 + i) * 40) % width + width) % width, y = ((i * 77.7 - t * 10 * (1 + i % 2)) % height + height) % height;
        bloom(ctx, x, y, 6 * v.scale, i % 3 ? '255,220,140' : '160,255,200', .5 + .3 * Math.sin(t * 2 + i));
      }
    } else if (th.decor === 'sluice' || th.decor === 'shutters') {
      for (let i = 0; i < 2; i++) {
        const x = ((i * 530 + t * 14) % (width + 600)) - 300, y = height * (.3 + i * .4);
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 260);
        gr.addColorStop(0, th.decor === 'sluice' ? 'rgba(180,215,230,.07)' : 'rgba(150,160,200,.05)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.fillRect(x - 260, y - 260, 520, 520);
      }
    }
    ctx.restore();
  }
  function tideGauge(ctx, s, t, width) {
    if (!tideOn(s)) return;
    const lv = clamp(num(s.tide.level, 0), 0, 1), w = tideWarn(s), high = tideHigh(s);
    const x = width - 150, y = width < 640 && arr(s.enemies).some(e => enemyType(e) === 'diver' && num(e.hp, 0) > 0) ? 50 : 12, W = 138, H = 36;
    ctx.save();
    rrect(ctx, x, y, W, H, 8); ctx.fillStyle = 'rgba(6,18,24,.78)'; ctx.fill(); ctx.strokeStyle = w > 0 ? `rgba(255,190,110,${.5 + .5 * Math.sin(t * 12)})` : 'rgba(160,210,220,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    // wave level column
    rrect(ctx, x + 8, y + 7, 12, 22, 3); ctx.fillStyle = '#0c2a34'; ctx.fill();
    ctx.fillStyle = '#56c8e8'; ctx.fillRect(x + 9, y + 28 - 20 * lv, 10, 20 * lv);
    ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9fdcef'; ctx.fillText(high ? 'HIGH TIDE' : 'LOW TIDE', x + 28, y + 13);
    ctx.fillStyle = w > 0 ? '#ffc27a' : 'rgba(200,225,230,.7)';
    ctx.fillText(w > 0 ? (high ? 'EBBING in ' : 'RISING in ') + Math.max(0, (1 - w) * 1.5).toFixed(1) + 's' : 'steady', x + 28, y + 26);
    ctx.restore();
  }
  function bossBar(ctx, s, t, width) {
    const boss = arr(s.enemies).find(e => enemyType(e) === 'diver' && num(e.hp, 0) > 0);
    if (!boss) return;
    const max = num(boss.maxHp, 10) || 10, hp = num(boss.hp, 0);
    const W = Math.min(360, width - 180), x = (width - W) / 2, y = 16;
    ctx.save();
    text(ctx, 'THE BELL DIVER', width / 2, y, 11, '#f0d8a8');
    rrect(ctx, x, y + 9, W, 11, 5); ctx.fillStyle = 'rgba(8,16,20,.85)'; ctx.fill(); ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 1.3; ctx.stroke();
    const seg = W / max;
    for (let i = 0; i < max; i++) {
      if (i < hp) { ctx.fillStyle = diverState(boss).exposed ? '#8ff2ce' : '#e8785a'; ctx.fillRect(x + 2 + i * seg, y + 11, seg - 2, 7); }
    }
    ctx.restore();
  }
  function objectiveTargets(s, W, H) {
    const out = [];
    const o = s.objective;
    if (o && typeof o === 'object' && Number.isFinite(o.x) && Number.isFinite(o.y)) { out.push({ x: o.x, y: o.y, label: String(o.label || o.text || 'OBJECTIVE').toUpperCase().slice(0, 18), color: '#f3ca78' }); return out; }
    const enemies = arr(s.enemies).filter(e => num(e.hp, 0) > 0);
    const boss = enemies.find(e => enemyType(e) === 'diver');
    if (boss) { out.push({ x: boss.x, y: boss.y, label: 'BELL DIVER', color: '#efb38e' }); return out; }
    const seals = arr(s.receivers).filter(r => !r.active && receiverKind(r) !== 'sanctuary');
    if (seals.length) {
      for (const r of seals.slice(0, 2)) out.push({ x: r.x, y: r.y, label: receiverKind(r) === 'bell' ? 'BELL' : 'SUN SEAL', color: '#f3ca78' });
      const p = s.player || { x: 0, y: 0 };
      const sun = arr(s.beams).find(b => b.kind === 'sun');
      if (sun && segDist(p.x, p.y, sun.x1, sun.y1, sun.x2, sun.y2) > 80) {
        const L = Math.hypot(sun.x2 - sun.x1, sun.y2 - sun.y1) || 1, tt = clamp(((p.x - sun.x1) * (sun.x2 - sun.x1) + (p.y - sun.y1) * (sun.y2 - sun.y1)) / (L * L), 0, 1);
        out.push({ x: sun.x1 + (sun.x2 - sun.x1) * tt, y: sun.y1 + (sun.y2 - sun.y1) * tt, label: 'SUNBEAM', color: '#ffd98a' });
      }
      return out;
    }
    const awake = enemies.find(e => enemyType(e) === 'sentinel' && e.phase !== 'dormant');
    if (awake) { out.push({ x: awake.x, y: awake.y, label: 'SENTINEL', color: '#efb38e' }); return out; }
    const guard = enemies.find(e => enemyType(e) === 'sentinel');
    if (s.escort && num(s.escort.hp, 1) > 0 && !s.escort.done && !s.escort.arrived) {
      const p = s.player || s.escort;
      if (Math.hypot(p.x - s.escort.x, p.y - s.escort.y) > 200) out.push({ x: s.escort.x, y: s.escort.y, label: 'ILEX', color: '#9ff5d2' });
      else if (s.escortExit) out.push({ x: s.escortExit.x + s.escortExit.w / 2, y: s.escortExit.y + s.escortExit.h / 2, label: 'HATCH', color: '#9ff5d2' });
      return out;
    }
    if (s.rescue && !s.rescue.freed) { out.push(guard ? { x: guard.x, y: guard.y, label: 'SENTINEL', color: '#efb38e' } : { x: s.rescue.x, y: s.rescue.y, label: 'KEEPER', color: '#9ff5d2' }); return out; }
    if (s.beacon && !beaconLit(s)) { out.push({ x: s.beacon.x, y: s.beacon.y, label: 'BEACON', color: '#ffe0a0' }); return out; }
    const here = ROOM_ORDER.indexOf(roomId(s));
    const exits = arr(s.exits).filter(finiteRect);
    const fwd = exits.filter(e => ROOM_ORDER.indexOf(e.to) > here && e.to !== 'sanctuary').sort((a, b) => ROOM_ORDER.indexOf(a.to) - ROOM_ORDER.indexOf(b.to))[0] || exits.find(e => !arr(s.visited).includes(e.to));
    if (fwd) out.push({ x: fwd.x + fwd.w / 2, y: fwd.y + fwd.h / 2, label: roomName(fwd.to).toUpperCase().slice(0, 16), color: '#cdeee2' });
    return out;
  }
  function edgeArrows(ctx, s, v, width, height, t) {
    const { W, H } = dims(s);
    const indicators = [];
    for (const o of objectiveTargets(s, W, H)) {
      const x = (o.x - v.x) * v.scale, y = (o.y - v.y) * v.scale;
      if (x > 20 && x < width - 20 && y > 20 && y < height - 20) continue;
      const cx = clamp(x, 58, Math.max(58, width - 58));
      let cy = clamp(y, 64, Math.max(64, height - 80));
      for (const prev of indicators) if (Math.abs(cx - prev.x) < 96 && Math.abs(cy - prev.y) < 44) cy = prev.y + 44 <= height - 38 ? prev.y + 44 : prev.y - 44;
      indicators.push({ x: cx, y: cy });
      const a = Math.atan2(y - cy, x - cx), pulse = 1 + .08 * Math.sin(t * 5);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.scale(pulse, pulse);
      poly(ctx, [[15, 0], [-2, -8], [2, 0], [-2, 8]], o.color, '#081820', 2);
      ctx.restore();
      ctx.font = '700 10px system-ui, sans-serif';
      const tw = ctx.measureText(o.label).width + 14;
      rrect(ctx, cx - tw / 2, cy + 12, tw, 18, 9); ctx.fillStyle = 'rgba(8,24,32,.85)'; ctx.fill(); ctx.strokeStyle = o.color; ctx.lineWidth = 1; ctx.stroke();
      text(ctx, o.label, cx, cy + 21.5, 10, o.color);
    }
  }
  function titleCard(ctx, s, t, width, height) {
    const id = roomId(s);
    if (roomMemo.id !== id || t < roomMemo.since) { roomMemo.id = id; roomMemo.since = t; }
    const age = Number.isFinite(s.roomTime) ? s.roomTime : t - roomMemo.since;
    if (age > 2.8 || !s.room || s.status === 'ready') return;
    const a = clamp(Math.min(age / .5, (2.8 - age) / .7), 0, 1);
    const th = themeFor(s);
    ctx.save(); ctx.globalAlpha = a;
    const cy = Math.max(70, height * .2);
    const gr = ctx.createLinearGradient(0, cy - 40, 0, cy + 40);
    gr.addColorStop(0, 'rgba(4,12,16,0)'); gr.addColorStop(.5, 'rgba(4,12,16,.55)'); gr.addColorStop(1, 'rgba(4,12,16,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, cy - 44, width, 88);
    const ch = s.room.challenge ? 'TIDAL ABBEY · ' + s.room.challenge : 'TIDAL ABBEY · OPTIONAL';
    text(ctx, ch, width / 2, cy - 18, 10, '#c8b890');
    ctx.font = `600 ${Math.min(30, width / 14)}px Georgia, "Times New Roman", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4ecd6'; ctx.fillText(s.room.name || roomName(id), width / 2, cy + 6);
    ctx.font = 'italic 13px Georgia, "Times New Roman", serif'; ctx.fillStyle = 'rgba(220,230,220,.8)'; ctx.fillText(th.title, width / 2, cy + 28);
    ctx.restore();
  }

  // ---------------------------------------------------------------- frame
  // Static layer density: 2x covers phones and laptops; very large displays get 3x.
  function bucket(k, devW) { return clamp(Math.round(k * 4) / 4, .5, devW > 2400 ? 3 : 2); }
  PW.draw = function (ctx, state, width, height, dpr) {
    if (!ctx || !width || !height) return;
    const s = state || {}, t = num(s.time, 0), v = view(s, width, height), { W, H } = dims(s);
    const th = themeFor(s);
    dpr = dpr || 1;
    glowQueue = []; labels = [];
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = th.void; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.scale(v.scale, v.scale); ctx.translate(-v.x, -v.y);
    if (hasDoc) {
      const st = getStatic(s, th, bucket(v.scale * dpr, width * dpr), W, H);
      const k = st.k, sx = clamp(v.x, 0, W), sy = clamp(v.y, 0, H), sw = Math.min(v.w, W - sx), sh = Math.min(v.h, H - sy);
      if (sw > 0 && sh > 0) ctx.drawImage(st.canvas, sx * k, sy * k, sw * k, sh * k, sx, sy, sw, sh);
      // flickering flames of baked light sources
      ctx.globalCompositeOperation = 'lighter';
      for (const c of st.meta.candles) {
        for (let i = 0; i < 3; i++) { const fx = c.x + (i - 1) * 5, fy = c.y - (i === 1 ? 11 : 9) - i * 2.5 + 2; bloom(ctx, fx, fy, 5 + Math.sin(t * 13 + i + c.x) * 1, '255,200,110', .95); }
        bloom(ctx, c.x, c.y - 8, 40, WARM, .18 + .05 * Math.sin(t * 7 + c.y));
      }
      for (const b of st.meta.braziers) {
        for (let i = 0; i < 4; i++) { const ph = (t * 1.6 + i * .25) % 1; bloom(ctx, b.x + Math.sin(i * 2 + t * 3) * 3, b.y - 3 - ph * 16, 9 * (1 - ph) + 3, '255,170,70', .9 * (1 - ph)); }
        bloom(ctx, b.x, b.y, 70, WARM, .25 + .06 * Math.sin(t * 9 + b.x));
      }
      for (const l of st.meta.lights) if (l.rgb !== WARM && l.flicker) bloom(ctx, l.x, l.y - 8, 16, l.rgb, .7);
      ctx.globalCompositeOperation = 'source-over';
      for (const sp of st.meta.spouts) { // water pouring from sluice spouts
        for (let i = 0; i < 3; i++) line(ctx, sp.x - 4 + i * 4, sp.y, sp.x - 4 + i * 4 + Math.sin(t * 9 + i) * .6, sp.y + 14, 'rgba(190,230,245,.55)', 1.6);
        ellipse(ctx, sp.x, sp.y + 16, 8 + Math.sin(t * 8) * 1.5, 3, null, 'rgba(210,240,250,.5)', 1.2);
      }
    }
    drawWater(ctx, s, t, th);
    drawExits(ctx, s, t, W, H);
    // additive floor light: beams, sanctuary, lit receivers
    ctx.globalCompositeOperation = 'lighter';
    drawBeamLight(ctx, s);
    if (s.player && Number.isFinite(s.player.x)) bloom(ctx, s.player.x, s.player.y - 6, 130, '255,232,196', .14);
    ctx.globalCompositeOperation = 'source-over';
    drawSanctuaryCircle(ctx, s, t);
    drawBreakwaters(ctx, s, t, th);
    drawShutters(ctx, s, t);
    drawGates(ctx, s, t);
    // floor-level telegraphs
    for (const e of arr(s.enemies)) {
      const ty = enemyType(e);
      if (ty === 'turret') drawTurretAim(ctx, e, s, t);
      else if (ty === 'diver') drawDiverFloor(ctx, e, s, t);
      else drawSentinelFloor(ctx, e, s, t);
    }
    // y-sorted props and actors
    const items = [];
    for (const e of emittersOf(s)) if (Number.isFinite(e.x)) items.push([e.y, () => drawEmitter(ctx, e, t)]);
    for (const r of arr(s.receivers)) if (Number.isFinite(r.x)) items.push([r.y, () => drawReceiver(ctx, r, t, s)]);
    for (const m of arr(s.mirrors)) if (Number.isFinite(m.x)) items.push([m.y, () => drawMirror(ctx, m, t, s)]);
    for (const p of arr(s.pickups)) if (Number.isFinite(p.x)) items.push([p.y, () => drawPickup(ctx, p, s, t)]);
    for (const e of arr(s.enemies)) {
      if (!Number.isFinite(e.x)) continue;
      const ty = enemyType(e);
      items.push([e.y, ty === 'turret' ? () => drawTurret(ctx, e, s, t) : ty === 'diver' ? () => drawDiver(ctx, e, s, t) : () => drawSentinel(ctx, e, s, t)]);
    }
    if (s.escort && Number.isFinite(s.escort.x)) {
      const es = s.escort, pl = s.player;
      const waiting = es.arrived ? null : typeof es.waiting === 'string' ? es.waiting : (pl && Math.hypot(pl.x - es.x, pl.y - es.y) > 220);
      items.push([es.y, () => drawIlex(ctx, es, t, { pips: num(es.hp, 1) > 0, waiting })]);
    }
    if (s.rescue && Number.isFinite(s.rescue.x) && !s.escort) items.push([s.rescue.y, () => drawRescue(ctx, s.rescue, s, t)]);
    if (s.beacon && Number.isFinite(s.beacon.x)) items.push([s.beacon.y, () => drawBeacon(ctx, s, t)]);
    if (s.player && Number.isFinite(s.player.x)) items.push([s.player.y, () => drawPlayer(ctx, s.player, s, t)]);
    items.sort((a, b) => a[0] - b[0]);
    for (const it of items) it[1]();
    if (s.player && Number.isFinite(s.player.x)) drawPlayerFx(ctx, s.player, t);
    drawRings(ctx, s, t);
    ctx.globalCompositeOperation = 'lighter';
    drawBeamCores(ctx, s, t);
    flushGlow(ctx);
    drawParticles(ctx, s);
    ctx.globalCompositeOperation = 'source-over';
    drawShots(ctx, s, t);
    drawLabels(ctx, v);
    ctx.restore();
    // screen space
    atmosphere(ctx, s, th, t, v, width, height);
    if (hasDoc) {
      ctx.drawImage(vignette(Math.round(width), Math.round(height), th.vignette, '2,8,12'), 0, 0, width, height);
    }
    tideGauge(ctx, s, t, width);
    bossBar(ctx, s, t, width);
    edgeArrows(ctx, s, v, width, height, t);
    titleCard(ctx, s, t, width, height);
    const tr = clamp(num(s.transition, 0), 0, 1);
    if (tr > 0) { ctx.fillStyle = `rgba(2,8,12,${tr})`; ctx.fillRect(0, 0, width, height); }
    ctx.restore();
  };
})(typeof window !== 'undefined' ? window : globalThis);
