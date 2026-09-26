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
  const SCALE_HERO = 1.4, SCALE_ILEX = 1.2, SCALE_DIVER = 1.08, SCALE_SENTINEL = 1.24;

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
    let targetX = num(p.x, W / 2), targetY = num(p.y, H / 2);
    const weaver = s && roomId(s) === 'weaver' && arr(s.enemies).find(e =>
      /glass[-_ ]?weaver/i.test(String(e && e.id || '')) && num(e && e.hp, 0) > 0);
    if (weaver && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(weaver.x) && Number.isFinite(weaver.y)) {
      const px = p.x, py = p.y, bx = weaver.x, by = weaver.y;
      // Keep the player and Weaver's silhouette in frame while centering their encounter.
      const playerMarginX = 34, bossMarginX = 42, playerMarginY = 18, bossBottomMargin = 40;
      const hudTop = compactCanvasHud(width, height) ? 132 / scale : 0;
      const bossTopMargin = Math.max(54, hudTop + 78);
      const spanX = Math.max(px + playerMarginX, bx + bossMarginX) - Math.min(px - playerMarginX, bx - bossMarginX);
      const spanY = Math.max(py + playerMarginY, by + bossBottomMargin) - Math.min(py - playerMarginY, by - bossTopMargin);
      const focusX = clamp((w - spanX) / Math.min(96, w * .28), 0, 1);
      const focusY = clamp((h - spanY) / Math.min(90, h * .18), 0, 1);
      // Start exactly at player-follow on the fit boundary; extra safe margin eases toward the encounter midpoint.
      targetX = px + ((px + bx) / 2 - px) * focusX;
      const encounterY = (py + by) / 2 - Math.min(36, h * .06);
      targetY = py + (encounterY - py) * focusY;
    }
    return {
      x: W > w ? clamp(targetX - w / 2, 0, W - w) : (W - w) / 2,
      y: H > h ? clamp(targetY - h / 2, 0, H - h) : (H - h) / 2, w, h, scale
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
  // Three small solid ellipses give actors a grounded contact core without per-frame blur.
  function contactShadow(ctx, x, y, rx, ry, strength) {
    const a = clamp(strength, 0, 1);
    // Upper-left key: the diffuse skirt and tighter core fall down-right.
    ellipse(ctx, x + 9, y + 8, rx * 1.16, ry * 1.08, `rgba(2,7,10,${.25 * a})`);
    ellipse(ctx, x + 5, y + 5, rx * .76, ry * .68, `rgba(0,3,6,${.48 * a})`);
    ellipse(ctx, x + 2, y + 2, rx * .42, ry * .4, `rgba(0,1,3,${.68 * a})`);
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
  const cycleZone = z => z.when === 'cycle' && Number.isFinite(z.flipIn);
  const tideZone = z => z.when === 'high' || z.when === 'low';
  // Will this zone flip at the imminent tide (or its own cycle) change?
  function zoneFlipSoon(z, s) {
    if (z.held) return true;
    if (cycleZone(z)) return z.flipIn < 1.5;
    if (!tideOn(s) || !tideZone(z) || tideWarn(s) <= 0) return false;
    return true;
  }
  function zoneWarn(z, s) { return cycleZone(z) ? clamp(1 - z.flipIn / 1.5, 0, 1) : tideWarn(s); }
  function zoneRemain(z, s) { return cycleZone(z) ? Math.max(0, z.flipIn) : Math.max(0, (1 - tideWarn(s)) * 1.5); }
  function tideDepth(z, s) {
    if (!tideOn(s) || !tideZone(z)) return 1;
    const lv = clamp(num(s.tide.level, tideHigh(s) ? 1 : 0), 0, 1);
    return z.when === 'high' ? lv : 1 - lv;
  }
  function sanctZone(s) { return s.sanctuaryZone || (s.sanctuary && typeof s.sanctuary === 'object' ? s.sanctuary : null); }
  function enemyType(e) { return e.type || 'sentinel'; }
  function sentinelName(e) {
    const id = String(e && e.id || '');
    if (id === 'circuit-sentinel') return 'CROWN SENTINEL';
    return /glass[-_ ]?weaver/i.test(id) ? 'GLASS WEAVER' : /verger/i.test(id) ? 'TOWER VERGER' : 'BELL SENTINEL';
  }
  // The placeable prism moves; keep it out of anything baked into the static layer.
  function staticMirrors(s) { return arr(s.mirrors).filter(m => m && !m.portable); }
  function roomName(id) {
    if (PW.ROOMS && PW.ROOMS[id] && PW.ROOMS[id].name) return PW.ROOMS[id].name;
    for (const region of arr(PW.REGIONS)) for (const r of arr(region.rooms)) if (r.id === id) return r.name;
    return String(id || '').replace(/-/g, ' ');
  }
  const ROOM_ORDER = ['cloister', 'sluice', 'sanctuary', 'shutters', 'bell-tower', 'beacon', 'spillway', 'roots', 'channels', 'quay', 'ferry', 'reservoir'];
  const OPTIONAL_ROOMS = ['sanctuary', 'ferry'];

  // ---------------------------------------------------------------- themes
  const KILN_THEME = { grade: ['#ffe5bd', '#291b39'], floor: 'kiln', stone: [220, 13, 30], joint: '#0c1012', moss: 0, puddles: 0, top: [207, 16, 34], face: [215, 22, 22], wall: 'basalt', ambient: [150, 164, 180], void: '#080a10', vignette: .42, decor: 'kiln', water: [196, 72, 24], title: 'The furnace below the tide' };
  const kilnTheme = title => Object.assign({}, KILN_THEME, { title });
  const NIGHT_THEME = { grade: ['#d4dcff', '#433769'], floor: 'octa', stone: [230, 20, 39], joint: '#171b32', moss: 0, puddles: 0, top: [228, 18, 49], face: [238, 22, 26], wall: 'basalt', ambient: [183, 192, 220], void: '#080b1a', vignette: .22, decor: 'observatory', water: [230, 30, 22], title: 'Carry a little daylight into the night' };
  const nightTheme = title => Object.assign({}, NIGHT_THEME, { title });
  const CROWN_THEME = { grade: ['#f4d9a0', '#142444'], floor: 'crown', stone: [205, 25, 32], joint: '#101829', moss: 0, puddles: 0, top: [214, 20, 38], face: [226, 22, 24], wall: 'basalt', ambient: [132, 154, 198], void: '#050a17', vignette: .34, decor: 'crown', water: [204, 82, 28], title: 'The eclipse engine above the sea' };
  const crownTheme = title => Object.assign({}, CROWN_THEME, { title });
  const THEMES = {
    cloister: { grade: ['#ffe2b0', '#1d5a6a'], floor: 'flag', stone: [96, 9, 41], joint: '#1b2523', moss: .6, puddles: 5, top: [44, 16, 58], face: [38, 16, 33], wall: 'ashlar', ambient: [134, 140, 154], void: '#081b23', vignette: .5, decor: 'cloister', water: [185, 60, 26], title: 'The drowned cloister' },
    sluice: { grade: ['#cfe8f0', '#12384a'], floor: 'slate', stone: [203, 13, 33], joint: '#0e171c', moss: .45, puddles: 11, top: [200, 9, 45], face: [205, 14, 25], wall: 'slate', ambient: [112, 128, 150], void: '#05131b', vignette: .58, decor: 'sluice', water: [188, 64, 24], title: 'Where the sea is let in' },
    sanctuary: { grade: ['#ffd28a', '#2a4a2a'], floor: 'octa', stone: [36, 18, 43], joint: '#211c14', moss: 1.3, puddles: 2, top: [68, 12, 47], face: [58, 14, 26], wall: 'ashlar', ambient: [100, 92, 98], void: '#0a130e', vignette: .7, decor: 'sanctuary', water: [165, 55, 24], title: 'Candles still burn' },
    shutters: { grade: ['#c8c8ff', '#1a1f3a'], floor: 'octa', stone: [222, 11, 31], joint: '#0c0f15', moss: .1, puddles: 4, top: [224, 9, 37], face: [228, 14, 19], wall: 'basalt', ambient: [92, 100, 130], void: '#06080e', vignette: .7, decor: 'shutters', water: [200, 60, 24], title: 'The keepers’ passages' },
    'bell-tower': { grade: ['#ffc890', '#4a2418'], floor: 'planks', stone: [27, 32, 31], joint: '#1a100a', moss: .04, puddles: 0, top: [12, 30, 39], face: [10, 32, 22], wall: 'brick', ambient: [134, 110, 100], void: '#100908', vignette: .62, decor: 'bell', water: [190, 60, 24], title: 'Two bells, one light' },
    beacon: { grade: ['#f0e6d0', '#34486a'], floor: 'cobble', stone: [30, 6, 36], joint: '#0b1014', moss: .35, puddles: 7, top: [212, 7, 33], face: [214, 12, 16], wall: 'rock', ambient: [150, 158, 182], void: '#040b12', vignette: .72, decor: 'beacon', water: [195, 60, 20], title: 'The abbey’s last light' },
    // Region 2 — Verdant Aqueduct: warm travertine arcades swallowed by roots, jade canals, canopy light.
    spillway: { grade: ['#fff2b8', '#1c4a2c'], floor: 'travertine', stone: [42, 26, 50], joint: '#1e2414', moss: 1.1, puddles: 3, top: [40, 20, 52], face: [32, 24, 30], wall: 'aqueduct', ambient: [170, 174, 138], void: '#0a1a10', vignette: .5, decor: 'verdant', sub: 'spillway', water: [166, 62, 30], title: 'Where the abbey drains into the green' },
    roots: { grade: ['#fbeeb0', '#20432a'], floor: 'travertine', stone: [36, 22, 45], joint: '#1a2012', moss: 1.5, puddles: 1, top: [44, 18, 47], face: [30, 22, 27], wall: 'aqueduct', ambient: [160, 168, 128], void: '#08160d', vignette: .55, decor: 'verdant', sub: 'roots', water: [162, 60, 27], title: 'The bridges grew themselves' },
    channels: { grade: ['#ffe6b0', '#1a4436'], floor: 'spicatum', stone: [20, 36, 42], joint: '#23160e', moss: .9, puddles: 2, top: [36, 22, 49], face: [26, 26, 28], wall: 'aqueduct', ambient: [170, 170, 140], void: '#0a1810', vignette: .5, decor: 'verdant', sub: 'channels', water: [168, 64, 28], title: 'The canals turn on their stones' },
    quay: { grade: ['#fff0c0', '#1e4238'], floor: 'planks', stone: [34, 24, 44], joint: '#141a12', moss: .8, puddles: 0, top: [42, 18, 50], face: [34, 22, 28], wall: 'aqueduct', ambient: [168, 172, 146], void: '#08160f', vignette: .52, decor: 'verdant', sub: 'quay', water: [170, 58, 26], title: 'The ferrymen’s landing' },
    reservoir: { grade: ['#ffeab0', '#1a3a26'], floor: 'travertine', stone: [46, 22, 52], joint: '#1a1c12', moss: 1.3, puddles: 2, top: [46, 14, 46], face: [36, 18, 26], wall: 'aqueduct', ambient: [164, 170, 132], void: '#07130b', vignette: .56, decor: 'verdant', sub: 'reservoir', water: [164, 56, 24], title: 'The hart drinks here' },
    ferry: { grade: ['#ffd89a', '#23402a'], floor: 'planks', stone: [30, 30, 32], joint: '#1a120a', moss: .9, puddles: 0, top: [38, 20, 46], face: [30, 24, 26], wall: 'aqueduct', ambient: [132, 136, 112], void: '#08130c', vignette: .66, decor: 'verdant', sub: 'ferry', water: [168, 56, 25], title: 'A lantern on the water' },
    lock: kilnTheme('The reservoir lock'),
    furnace: kilnTheme('Read the furnace pulse'),
    anneal: kilnTheme('A bridge made by heat'),
    bridge: kilnTheme('A bridge made by heat'),
    cart: kilnTheme('Keep the cooling cart moving'),
    rail: kilnTheme('Keep the cooling cart moving'),
    foundry: kilnTheme('Two temperatures, one circuit'),
    weaver: Object.assign(kilnTheme('The glass remembers the blow'), { ambient: [222, 232, 240], vignette: .14 }),
    quench: kilnTheme('The quench valve'),
    'optional-quench': kilnTheme('The quench valve'),
    stars: nightTheme('The road appears in borrowed light'),
    'obs-shutters': nightTheme('The shutters keep their own time'),
    shade: nightTheme('Split the light; break the ambush'),
    telescope: nightTheme('Turn the lens; guide the keeper'),
    twins: nightTheme('Two shields, one luminous thread'),
    'obs-chart': nightTheme('The chart the keepers left behind'),
    'shade-vault': nightTheme('A reward beyond the shadow'),
    descent: crownTheme('Descend through the drowned crown'),
    galleries: crownTheme('The galleries turn by starlight'),
    circuit: crownTheme('Read the tide; cross the shoals'),
    archive: Object.assign(crownTheme('The keepers’ sealed archive'), { grade: ['#f1d3a1', '#18223b'], ambient: [150, 151, 190] }),
    lighthouse: crownTheme('A lighthouse over the void'),
    crown: Object.assign(crownTheme('The eclipse engine at the crown'), { grade: ['#ffe3a6', '#1c2b4b'], ambient: [152, 164, 201], vignette: .28 })
  };
  function regionOf(s) { return (s.room && s.room.region) || s.regionId || ''; }
  function beaconName(s) {
    const names = {
      'tidal-abbey': 'ABBEY BEACON',
      'verdant-aqueduct': 'AQUEDUCT BEACON',
      'glass-kiln': 'KILN BEACON',
      'night-observatory': 'OBSERVATORY BEACON',
      'drowned-crown': 'CROWN BEACON'
    };
    return names[regionOf(s)] || 'BEACON';
  }
  function themeFor(s) { return THEMES[roomId(s)] || (regionOf(s) === 'drowned-crown' ? CROWN_THEME : regionOf(s) === 'night-observatory' ? NIGHT_THEME : regionOf(s) === 'glass-kiln' ? KILN_THEME : regionOf(s) === 'verdant-aqueduct' ? THEMES.spillway : THEMES.cloister); }

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
  function floorCrown(g, W, H, rng, th) {
    // The drowned observatory uses broad, jointed basalt fields rather than
    // small repeating pavers. Their offset bevel and directional sheen expose
    // the height of each slab while leaving generous quiet ground for combat.
    g.fillStyle = '#0a1222'; g.fillRect(0, 0, W, H);
    const field = g.createLinearGradient(0, 0, W, H);
    field.addColorStop(0, '#28334b'); field.addColorStop(.34, '#202b42');
    field.addColorStop(.68, '#17223a'); field.addColorStop(1, '#111a30');
    g.fillStyle = field; g.fillRect(0, 0, W, H);
    const bw = 156, bh = 120;
    for (let row = -1, y = -bh; y < H + bh; row++, y += bh) {
      const stagger = (row & 1) ? bw * .5 : 0;
      for (let col = -1, x = -bw + stagger; x < W + bw; col++, x += bw) {
        const jx = (rng() - .5) * 8, jy = (rng() - .5) * 7;
        const px = x + jx, py = y + jy, w = bw - 4 - rng() * 9, h = bh - 5 - rng() * 8;
        const cutX = 16 + rng() * 8, cutY = 13 + rng() * 8;
        const top = [[px + cutX, py], [px + w - cutX * .72, py + 1], [px + w, py + cutY],
          [px + w - 1, py + h - cutY * .8], [px + w - cutX, py + h], [px + cutX * .65, py + h - 1],
          [px, py + h - cutY], [px + 1, py + cutY]];
        const lift = 5 + rng() * 3;
        const underside = top.map(p => [p[0] + 1.8, p[1] + lift]);
        poly(g, underside, 'rgba(1,5,13,.4)');
        for (let i = 0; i < top.length; i++) {
          const next = (i + 1) % top.length;
          const pts = [top[i], top[next], underside[next], underside[i]];
          const lower = i >= 2 && i <= 5;
          poly(g, pts, lower ? 'rgba(5,9,20,.76)' : 'rgba(10,16,30,.66)', 'rgba(2,6,14,.62)', .65);
        }
        const hue = 214 + rng() * 20, sat = 17 + rng() * 11, lum = 24 + rng() * 8;
        const cap = g.createLinearGradient(px, py, px + w * .82, py + h);
        cap.addColorStop(0, hsl(hue - 4, sat, lum + 13)); cap.addColorStop(.34, hsl(hue, sat, lum + 4));
        cap.addColorStop(.76, hsl(hue + 2, sat + 2, lum - 2)); cap.addColorStop(1, hsl(hue + 2, sat + 4, lum - 9));
        poly(g, top, cap, 'rgba(4,8,17,.88)', 1.2);
        // Directional polish and long mineral striae break the large material into depth planes.
        line(g, top[0][0] + 4, top[0][1] + 4, top[1][0] - 5, top[1][1] + 4, 'rgba(242,220,178,.27)', 1.25);
        line(g, top[1][0] - 3, top[1][1] + 4, top[2][0] - 3, top[2][1] + 13, 'rgba(211,224,255,.12)', 1);
        const veinX = px + 24 + rng() * (w - 48), veinY = py + 26 + rng() * (h - 52);
        line(g, veinX, veinY, veinX + 18 + rng() * 24, veinY + (rng() - .5) * 4, 'rgba(126,171,215,.16)', .85);
        if (rng() < .38) {
          const cx = px + 34 + rng() * (w - 68), cy = py + 24 + rng() * (h - 48);
          ellipse(g, cx, cy, 17 + rng() * 15, 3 + rng() * 2, null, 'rgba(177,203,230,.13)', .8, -.08);
        }
      }
    }
    // A quiet cross-grain adds a crafted direction to the otherwise open slabs.
    const sheen = g.createLinearGradient(0, 0, W * .86, H * .42);
    sheen.addColorStop(0, 'rgba(218,221,255,.11)'); sheen.addColorStop(.42, 'rgba(190,211,245,.035)'); sheen.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sheen; g.fillRect(0, 0, W, H);
    const shade = g.createLinearGradient(0, H * .25, 0, H);
    shade.addColorStop(0, 'rgba(2,7,18,0)'); shade.addColorStop(1, 'rgba(2,7,18,.22)');
    g.fillStyle = shade; g.fillRect(0, 0, W, H);
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
  // Grass blades sprouting from a joint or crack.
  function tuft(g, x, y, rng, size, alpha) {
    const n = 4 + Math.floor(rng() * 4);
    for (let b = 0; b < n; b++) {
      const bx = x + (rng() - .5) * size * .8, lean = (rng() - .5) * size * .9, hgt = size * (.5 + rng() * .7);
      g.beginPath(); g.moveTo(bx, y); g.quadraticCurveTo(bx + lean * .3, y - hgt * .6, bx + lean, y - hgt);
      g.strokeStyle = hsl(78 + rng() * 38, 40 + rng() * 20, 26 + rng() * 22, alpha); g.lineWidth = .9 + rng() * .8; g.stroke();
    }
  }
  function floorTravertine(g, W, H, rng, th) {
    // Big Roman travertine slabs: pitted, banded, grass pushing up through the joints.
    g.fillStyle = hsl(th.stone[0] + 30, 30, Math.max(6, th.stone[2] - 30)); g.fillRect(0, 0, W, H);
    const slabs = [];
    for (let y = 0; y < H;) {
      const rh = 46 + Math.floor(rng() * 24);
      for (let x = -rng() * 90; x < W;) {
        const rw = 64 + rng() * 76;
        stone(g, x + 2.2, y + 2.2, rw - 4.4, rh - 4.4, jit(th.stone, rng, 8, 10, 10), rng, { hi: .13, lo: .26, rim: .12, jit: 3.4, speck: 260, crack: .26, chip: .3 });
        for (let i = 0, n = rw * rh / 240; i < n; i++) ellipse(g, x + 6 + rng() * (rw - 12), y + 6 + rng() * (rh - 12), .7 + rng() * 2.2, .5 + rng() * .9, 'rgba(46,34,16,.3)');
        if (rng() < .7) for (let k = 0; k < 3; k++) {
          const by = y + 8 + rng() * (rh - 16); g.beginPath(); g.moveTo(x + 5, by);
          for (let q = 1; q <= 5; q++) g.lineTo(x + 5 + (rw - 10) * q / 5, by + Math.sin(q * 1.9 + k) * 1.6);
          g.strokeStyle = rng() < .5 ? 'rgba(255,244,210,.08)' : 'rgba(70,52,26,.1)'; g.lineWidth = 1.4; g.stroke();
        }
        slabs.push([x, y, rw, rh]);
        x += rw;
      }
      y += rh;
    }
    for (const [x, y, rw, rh] of slabs) {
      if (rng() < .5 * th.moss) for (let i = 0; i < 3; i++) tuft(g, x + 8 + rng() * (rw - 16), y + 2.5, rng, 6 + rng() * 5, .85);
      if (rng() < .35 * th.moss) for (let i = 0; i < 2; i++) tuft(g, x + 2, y + 10 + rng() * (rh - 16), rng, 5 + rng() * 4, .8);
      if (rng() < .22 * th.moss) mossClump(g, x + (rng() < .5 ? 3 : rw - 3), y + (rng() < .5 ? 3 : rh - 3), 5 + rng() * 5, rng, .7);
    }
  }
  function floorSpicatum(g, W, H, rng, th) {
    // Opus spicatum / basket-weave brick paving of the canal walks.
    g.fillStyle = hsl(th.stone[0], th.stone[1] * .6, Math.max(6, th.stone[2] - 26)); g.fillRect(0, 0, W, H);
    const S = 32;
    for (let y = 0; y < H; y += S) for (let x = 0; x < W; x += S) {
      const hz = ((x / S | 0) + (y / S | 0)) % 2 === 0;
      for (let k = 0; k < 2; k++) {
        const bx = hz ? x + 1.2 : x + 1.2 + k * 16, by = hz ? y + 1.2 + k * 16 : y + 1.2;
        stone(g, bx, by, hz ? 29.6 : 13.6, hz ? 13.6 : 29.6, jit(th.stone, rng, 10, 12, 11), rng, { jit: .7, hi: .12, lo: .24, rim: .1, speck: 70, crack: .04, chip: .08 });
      }
    }
    for (let i = 0; i < 40; i++) { // damp algae blooms in low spots
      const x = rng() * W, y = rng() * H, r = 30 + rng() * 80, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `hsla(${100 + rng() * 40},45%,24%,${.18 + rng() * .14})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  function floorKiln(g, W, H, rng, th, s) {
    // Fractured refractory basalt: shared, jittered sites make irregular slabs whose
    // seams meet cleanly without falling into repeated horizontal courses.
    g.fillStyle = '#1b2227'; g.fillRect(0, 0, W, H);
    const plates = [];
    const sites = [], sx = 72, sy = 58, neighborReach = 400;
    for (let row = -2; row <= Math.ceil(H / sy) + 1; row++) {
      for (let col = -2; col <= Math.ceil(W / sx) + 1; col++) {
        const stagger = (row & 1) ? sx * (.28 + rng() * .32) : 0;
        const siteX = col * sx + stagger + (rng() - .5) * 34, siteY = row * sy + (rng() - .5) * 30;
        const gridRow = row + 2, gridCol = col + 2;
        const blockRow = Math.floor(gridRow / 4), blockCol = Math.floor(gridCol / 4);
        const cluster = hashStr('kiln-large:' + blockRow + ':' + blockCol) % 100;
        const largePlatePocket = ((blockRow + blockCol) & 1) === 0 && cluster < 30 && gridRow % 4 > 0 && gridRow % 4 < 3 && gridCol % 4 > 0 && gridCol % 4 < 3;
        if (!largePlatePocket) {
          sites.push({ x: siteX, y: siteY });
          const smallHash = hashStr('kiln-small:' + row + ':' + col);
          if (smallHash % 100 >= 78 && smallHash % 100 < 94) {
            const signX = (smallHash & 1) ? 1 : -1, signY = (smallHash & 2) ? 1 : -1;
            sites.push({ x: siteX + signX * sx * .27 + (rng() - .5) * 6, y: siteY + signY * sy * .24 + (rng() - .5) * 6 });
          }
        }
      }
    }
    function clipCell(points, nx, ny, limit) {
      const out = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        const da = nx * a[0] + ny * a[1] - limit, db = nx * b[0] + ny * b[1] - limit;
        const insideA = da <= 0, insideB = db <= 0;
        if (insideA !== insideB) {
          const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
        if (insideB) out.push(b);
      }
      return out;
    }
    function cellPath(points) {
      g.beginPath(); points.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
    }
    for (let i = 0; i < sites.length; i++) {
      const p = sites[i]; let points = [[0, 0], [W, 0], [W, H], [0, H]];
      for (let j = 0; j < sites.length && points.length; j++) {
        if (i === j) continue;
        const q = sites[j], nx = q.x - p.x, ny = q.y - p.y;
        if (nx * nx + ny * ny > neighborReach * neighborReach) continue;
        points = clipCell(points, nx, ny, (q.x * q.x + q.y * q.y - p.x * p.x - p.y * p.y) * .5);
      }
      if (points.length < 3) continue;
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (const pt of points) { x0 = Math.min(x0, pt[0]); y0 = Math.min(y0, pt[1]); x1 = Math.max(x1, pt[0]); y1 = Math.max(y1, pt[1]); }
      const w = x1 - x0, h = y1 - y0;
      if (w < 8 || h < 8) continue;
      const plate = { x: x0, y: y0, w, h, points };
      plates.push(plate);
      cellPath(points); g.fillStyle = hsl(24 + rng() * 18, 15 + rng() * 20, 34 + rng() * 16); g.fill();
      g.save(); cellPath(points); g.clip();
      const shade = g.createLinearGradient(x0, y0, x0 + w * .45, y1);
      shade.addColorStop(0, 'rgba(255,247,226,.18)'); shade.addColorStop(.44, 'rgba(255,255,255,0)'); shade.addColorStop(1, 'rgba(0,0,0,.25)');
      g.fillStyle = shade; g.fillRect(x0, y0, w, h);
      // Low-frequency mineral patches widen each slab's value range beyond the seams.
      if (rng() < .82) {
        const fx = x0 + w * (.16 + rng() * .48), fy = y0 + h * (.18 + rng() * .44);
        const fw = Math.min(w * .48, 14 + rng() * 22), fh = Math.min(h * .38, 7 + rng() * 11);
        const cut = Math.min(fw, fh) * (.12 + rng() * .18);
        g.beginPath(); g.moveTo(fx, fy + cut); g.lineTo(fx + fw * .25, fy); g.lineTo(fx + fw - cut, fy + fh * .12);
        g.lineTo(fx + fw, fy + fh * .62); g.lineTo(fx + fw * .67, fy + fh); g.lineTo(fx + cut * .5, fy + fh * .8); g.closePath();
        g.fillStyle = rng() < .56 ? `rgba(218,205,178,${.1 + rng() * .09})` : `rgba(13,21,27,${.08 + rng() * .08})`; g.fill();
      }
      const grain = Math.min(60, Math.floor(w * h / 190));
      for (let n = 0; n < grain; n++) {
        const bright = rng() < .46, sz = .7 + rng() * 1.7;
        g.fillStyle = bright ? 'rgba(235,242,238,.12)' : 'rgba(2,7,10,.14)';
        g.fillRect(x0 + rng() * w, y0 + rng() * h, sz, sz);
      }
      if (rng() < .4) {
        const edge = Math.floor(rng() * points.length), a = points[edge], b = points[(edge + 1) % points.length];
        const start = .12 + rng() * .22, end = .58 + rng() * .28;
        line(g, a[0] + (b[0] - a[0]) * start, a[1] + (b[1] - a[1]) * start,
          a[0] + (b[0] - a[0]) * end, a[1] + (b[1] - a[1]) * end, 'rgba(235,233,221,.13)', .9);
      }
      // Broken, branching mineral fractures stay clipped inside their own slab.
      if (rng() < .36 && w > 22 && h > 18) {
        let fx = x0 + w * (.2 + rng() * .6), fy = y0 + h * (.2 + rng() * .6);
        const fracture = [[fx, fy]], targetX = x0 + w * (.2 + rng() * .6), targetY = y0 + h * (.2 + rng() * .6);
        const steps = 3 + Math.floor(rng() * 3);
        for (let k = 1; k <= steps; k++) {
          const t = k / steps;
          fx = targetX * t + (x0 + w * (.2 + rng() * .6)) * (1 - t);
          fy = targetY * t + (y0 + h * (.2 + rng() * .6)) * (1 - t);
          fracture.push([fx, fy]);
        }
        g.beginPath(); fracture.forEach((pt, k) => k ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1]));
        g.strokeStyle = 'rgba(3,7,10,.58)'; g.lineWidth = 1.15; g.stroke();
        g.beginPath(); fracture.forEach((pt, k) => k ? g.lineTo(pt[0] + .5, pt[1] - .65) : g.moveTo(pt[0] + .5, pt[1] - .65));
        g.strokeStyle = 'rgba(211,166,112,.34)'; g.lineWidth = .75; g.stroke();
        if (rng() < .5) {
          const pt = fracture[1 + Math.floor(rng() * (fracture.length - 1))];
          line(g, pt[0], pt[1], pt[0] + (rng() - .5) * w * .28, pt[1] + (rng() - .5) * h * .32, 'rgba(3,7,10,.54)', .9);
        }
      }
      if (rng() < .055) {
        const mx = x0 + w * (.2 + rng() * .6), my = y0 + h * (.2 + rng() * .6), length = Math.min(w, h) * (.15 + rng() * .2);
        line(g, mx - length * .5, my, mx + length * .5, my + (rng() - .5) * 2, 'rgba(5,8,9,.58)', 1.35);
        line(g, mx - length * .5 + 1, my - 1, mx + length * .5 - 1, my - 1, 'rgba(202,159,108,.34)', .8);
      }
      g.restore();
      cellPath(points); g.strokeStyle = 'rgba(1,5,8,.48)'; g.lineWidth = .95; g.stroke();
      let area = 0;
      for (let edge = 0; edge < points.length; edge++) {
        const a = points[edge], b = points[(edge + 1) % points.length]; area += a[0] * b[1] - b[0] * a[1];
      }
      const orientation = area >= 0 ? 1 : -1;
      const largePlate = Math.abs(area) * .5 > 5200;
      for (let edge = 0; edge < points.length; edge++) {
        const a = points[edge], b = points[(edge + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
        const nx = orientation * dy / length, ny = -orientation * dx / length;
        const light = nx * -.55 + ny * -.83;
        if (light > .18) {
          line(g, a[0], a[1], b[0], b[1], `rgba(214,228,229,${.08 + light * .1})`, .8);
          if (largePlate) line(g, a[0] - nx * 1.6, a[1] - ny * 1.6, b[0] - nx * 1.6, b[1] - ny * 1.6, 'rgba(246,231,198,.23)', .85);
        } else if (largePlate && light < -.18) {
          // A close down-right seam shadow lets the broad slab lift off its neighbors.
          line(g, a[0] + 1.7, a[1] + 1.7, b[0] + 1.7, b[1] + 1.7, 'rgba(0,4,9,.26)', 1.6);
        }
      }
    }
    const shade = g.createRadialGradient(W * .5, H * .48, 30, W * .5, H * .48, Math.max(W, H) * .72);
    shade.addColorStop(0, 'rgba(70,100,115,.025)'); shade.addColorStop(1, 'rgba(0,0,0,.1)');
    g.fillStyle = shade; g.fillRect(0, 0, W, H);
    paintKilnMaterial(g, s, W, H, plates);
    // Broad upper-left key light separates the floor plane from down-right shadows.
    const key = g.createLinearGradient(0, 0, W, H);
    key.addColorStop(0, 'rgba(220,230,236,.13)'); key.addColorStop(.42, 'rgba(160,182,195,.035)'); key.addColorStop(1, 'rgba(0,3,9,.17)');
    g.fillStyle = key; g.fillRect(0, 0, W, H);
  }
  function drawWeaverForecourt(g, s) {
    if (roomId(s) !== 'weaver') return;
    // A flush, irregular refractory apron ties the two crucible blocks to the
    // Weaver's hearth. Its floor-level joints stay legible as walkable paving.
    const apron = [[416, 263], [438, 235], [510, 229], [534, 242], [561, 224], [588, 224], [629, 239], [654, 230], [684, 244], [724, 236], [752, 245], [790, 234], [821, 243], [865, 233], [934, 239], [958, 262], [949, 290], [960, 314], [949, 342], [959, 367], [946, 388], [957, 416], [949, 447], [961, 476], [946, 490], [958, 512], [937, 538], [916, 529], [891, 546], [863, 534], [838, 550], [810, 536], [779, 549], [744, 535], [716, 544], [700, 538], [684, 531], [671, 515], [651, 505], [633, 513], [617, 534], [600, 543], [588, 556], [555, 540], [520, 554], [485, 541], [440, 548], [416, 522], [426, 492], [414, 466], [424, 438], [416, 426], [424, 398], [414, 368], [425, 338]];
    const shadow = apron.map(p => [p[0] + 8, p[1] + 11]);
    poly(g, shadow, 'rgba(0,3,7,.38)');
    const bed = g.createLinearGradient(420, 230, 944, 548);
    bed.addColorStop(0, '#3c4442'); bed.addColorStop(.3, '#343d3e'); bed.addColorStop(.68, '#303a3c'); bed.addColorStop(1, '#283235');
    poly(g, apron, bed, 'rgba(6,12,15,.62)', 1.6);
    g.save(); g.beginPath(); apron.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip();
    if (kilnMaterial) paintKilnRectMaterial(g, 416, 224, 542, 332, rngFor(hashStr('weaver-connected-forecourt')), .25);
    if (!kilnApronMaterial) loadKilnApronMaterial();
    if (kilnApronMaterial) {
      const iw = kilnApronMaterial.naturalWidth || kilnApronMaterial.width;
      const ih = kilnApronMaterial.naturalHeight || kilnApronMaterial.height;
      if (iw > 0 && ih > 0) {
        // Register the full sheet on the modeled hearth; its edge branches
        // continue under the irregular apron rim, while the opaque hearth pass
        // above replaces the asset's center ring without a half-image seam.
        const scale = .5, dw = iw * scale, dh = ih * scale;
        const dx = 800 - dw * .5, dy = 384 - dh * .5;
        g.save(); g.globalAlpha = .2; g.globalCompositeOperation = 'soft-light';
        g.drawImage(kilnApronMaterial, 0, 0, iw, ih, dx, dy, dw, dh);
        // Screen blend carries the authored amber flecks across the charcoal
        // stone without letting the dark half of the source crush the floor.
        g.globalAlpha = .11; g.globalCompositeOperation = 'screen';
        g.drawImage(kilnApronMaterial, 0, 0, iw, ih, dx, dy, dw, dh);
        g.restore();
      }
    }
    const bloom = g.createRadialGradient(682, 347, 26, 690, 376, 294);
    bloom.addColorStop(0, 'rgba(207,156,102,.19)'); bloom.addColorStop(.48, 'rgba(130,112,91,.075)'); bloom.addColorStop(1, 'rgba(5,11,16,.025)');
    g.fillStyle = bloom; g.fillRect(416, 224, 542, 332);
    // Light pools from the two crucibles meet in the hearth; this source-led
    // falloff warms the east basin while leaving its outer stones in shadow.
    const hearthReturn = g.createRadialGradient(774, 370, 8, 800, 384, 205);
    hearthReturn.addColorStop(0, 'rgba(255,195,129,.21)');
    hearthReturn.addColorStop(.38, 'rgba(248,159,94,.16)');
    hearthReturn.addColorStop(.72, 'rgba(210,119,73,.085)');
    hearthReturn.addColorStop(1, 'rgba(207,112,70,0)');
    ellipse(g, 800, 384, 207, 138, hearthReturn);
    // Local heat pools tint the feed paths and the floor at their hearthward ends.
    for (const [x, y, rx, ry, strength] of [[558, 270, 92, 64, .32], [558, 494, 90, 63, .28], [684, 350, 98, 73, .27]]) {
      const spill = g.createRadialGradient(x - rx * .2, y - ry * .25, 2, x, y, rx);
      spill.addColorStop(0, `rgba(255,187,119,${strength})`);
      spill.addColorStop(.38, `rgba(247,143,83,${strength * .56})`);
      spill.addColorStop(1, 'rgba(218,104,63,0)');
      ellipse(g, x, y, rx, ry, spill);
    }
    // Asymmetric raking spill reaches both shoulders of the existing grooves;
    // the long soft fields taper before the unlit arena edge.
    for (const [x, y, rx, ry, strength, angle] of [
      [604, 286, 104, 60, .14, .36], [672, 326, 91, 65, .12, .42],
      [604, 476, 104, 60, .13, -.36], [672, 436, 91, 65, .115, -.42]
    ]) {
      const bounce = g.createRadialGradient(x - 18, y - 19, 1, x, y, rx);
      bounce.addColorStop(0, `rgba(255,197,133,${strength})`);
      bounce.addColorStop(.46, `rgba(239,145,88,${strength * .58})`);
      bounce.addColorStop(1, 'rgba(218,104,63,0)');
      ellipse(g, x, y, rx, ry, bounce, null, 0, angle);
    }
    // Small, fixed mineral blooms break the smooth pools into lit basalt faces.
    for (const [x, y, rx, ry, angle, strength] of [
      [570, 253, 31, 14, .1, .09], [609, 315, 36, 18, .22, .1], [651, 291, 28, 13, .16, .075], [681, 349, 32, 17, .18, .09],
      [570, 501, 29, 13, -.1, .085], [612, 453, 36, 17, -.2, .095], [651, 483, 28, 14, -.15, .075], [679, 420, 32, 17, -.16, .085]
    ]) {
      const mote = g.createRadialGradient(x - rx * .28, y - ry * .3, 1, x, y, rx);
      mote.addColorStop(0, `rgba(244,182,117,${strength})`);
      mote.addColorStop(.5, `rgba(201,128,77,${strength * .48})`);
      mote.addColorStop(1, 'rgba(201,128,77,0)');
      ellipse(g, x, y, rx, ry, mote, null, 0, angle);
    }
    // Two broad, recessed heat-feed seams join the existing columns to the hearth.
    g.lineCap = 'round';
    line(g, 535, 271, 614, 284, 'rgba(4,10,13,.3)', 23);
    line(g, 614, 284, 666, 317, 'rgba(4,10,13,.3)', 23);
    line(g, 666, 317, 696, 344, 'rgba(4,10,13,.3)', 23);
    line(g, 535, 493, 614, 479, 'rgba(4,10,13,.3)', 23);
    line(g, 614, 479, 666, 447, 'rgba(4,10,13,.3)', 23);
    line(g, 666, 447, 696, 424, 'rgba(4,10,13,.3)', 23);
    line(g, 535, 268, 614, 281, 'rgba(214,168,116,.22)', 2.1);
    line(g, 614, 281, 666, 314, 'rgba(214,168,116,.22)', 2.1);
    line(g, 666, 314, 696, 341, 'rgba(214,168,116,.22)', 2.1);
    line(g, 535, 490, 614, 476, 'rgba(214,168,116,.18)', 2.1);
    line(g, 614, 476, 666, 444, 'rgba(214,168,116,.18)', 2.1);
    line(g, 666, 444, 696, 421, 'rgba(214,168,116,.18)', 2.1);
    // Narrow emissive cores sit inside the recessed channels, ramping brighter
    // as each feed reaches the hearth; all marks remain floor-level and cached.
    for (const points of [
      [[535, 268], [614, 281], [666, 314], [696, 341]],
      [[535, 490], [614, 476], [666, 444], [696, 421]]
    ]) {
      const first = points[0], last = points[points.length - 1];
      const channel = g.createLinearGradient(first[0], first[1], last[0], last[1]);
      channel.addColorStop(0, 'rgba(223,139,83,.38)');
      channel.addColorStop(.4, 'rgba(255,159,89,.56)');
      channel.addColorStop(.82, 'rgba(255,201,133,.72)');
      channel.addColorStop(1, 'rgba(255,231,177,.6)');
      g.beginPath(); points.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = channel; g.lineWidth = 6; g.stroke();
      const core = g.createLinearGradient(first[0], first[1], last[0], last[1]);
      core.addColorStop(0, 'rgba(255,206,148,.1)'); core.addColorStop(.62, 'rgba(255,214,157,.42)'); core.addColorStop(1, 'rgba(255,239,203,.72)');
      g.strokeStyle = core; g.lineWidth = 1.8; g.stroke();
    }
    // Tight contact pools anchor the lower-right faces of the two existing crucibles.
    for (const [x, y] of [[533, 354], [533, 578]]) {
      const contact = g.createRadialGradient(x - 7, y - 3, 1, x + 3, y + 4, 58);
      contact.addColorStop(0, 'rgba(0,3,8,.32)'); contact.addColorStop(.46, 'rgba(0,3,8,.15)'); contact.addColorStop(1, 'rgba(0,3,8,0)');
      ellipse(g, x + 4, y + 4, 61, 17, contact);
    }
    // Broken paving joints and mineral bands vary the apron without a tile grid.
    for (const [x1, y1, x2, y2] of [[432, 246, 582, 246], [590, 232, 620, 244], [432, 535, 580, 542], [592, 548, 625, 534], [942, 276, 942, 334], [942, 454, 942, 502]]) {
      line(g, x1, y1, x2, y2, 'rgba(2,8,12,.42)', 2.2);
      line(g, x1 + 1, y1 - 1, x2 - 1, y2 - 1, 'rgba(233,214,181,.13)', .9);
    }
    // Upper-left ash wash and down-right soot occlusion seat the two blocks.
    for (const [x, y, rx, ry] of [[510, 270, 83, 57], [510, 494, 83, 57], [790, 383, 176, 124]]) {
      const shade = g.createRadialGradient(x - rx * .28, y - ry * .36, 2, x, y, Math.max(rx, ry));
      shade.addColorStop(0, 'rgba(224,189,144,.065)'); shade.addColorStop(.56, 'rgba(3,8,12,.018)'); shade.addColorStop(1, 'rgba(0,3,6,.09)');
      ellipse(g, x + 5, y + 7, rx, ry, shade);
    }
    g.restore();
    // A soft northwest rim light marks the laid stone field but leaves it flush.
    poly(g, [[416, 263], [438, 235], [510, 229], [534, 242], [561, 224], [588, 224], [629, 239], [654, 230], [684, 244], [724, 236], [752, 245]], null, 'rgba(255,229,188,.2)', 2);

    // Fitted, uneven basalt buttresses replace a continuous retaining-wall
    // frame. The west and south breaks preserve broad walk-in lanes.
    const bankRuns = [
      [[438, 235], [588, 224]],
      [[661, 239], [755, 239]],
      [[865, 239], [934, 239], [958, 262]],
      [[958, 262], [958, 326]],
      [[958, 389], [958, 431]],
      [[958, 478], [958, 512], [937, 538], [904, 538]],
      [[818, 538], [700, 538]],
      [[588, 556], [520, 552]],
      [[466, 550], [440, 548], [416, 522]],
      [[416, 338], [416, 294], [416, 263], [438, 235]],
      [[416, 426], [416, 474], [416, 522]]
    ];
    const moved = (points, dx, dy) => points.map(p => [p[0] + dx, p[1] + dy]);
    let bankId = 0;
    for (const run of bankRuns) for (let edge = 0; edge < run.length - 1; edge++) {
      const a = run[edge], b = run[edge + 1], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
      const tx = dx / length, ty = dy / length, nx = -ty, ny = tx;
      let along = 1;
      while (along < length - 5) {
        const seed = hashStr('forecourt-buttress:' + bankId++), blockLength = 29 + seed % 1900 / 100;
        const u0 = along + 1.5 + (seed % 3), u1 = Math.min(length - 1.5, u0 + blockLength);
        const span = u1 - u0;
        if (span < 12) break;
        const half = 6.5 + (seed >>> 5) % 500 / 100, bevel = Math.min(5.5, span * .18);
        const irregular = ((seed >>> 12) % 100) / 100 * 2.2 - 1.1;
        const normalShift = ((seed >>> 6) % 100) / 100 * 7 - 3.5;
        const point = (u, n) => [a[0] + tx * u + nx * (n + normalShift), a[1] + ty * u + ny * (n + normalShift)];
        const top = [
          point(u0 + bevel, -half + irregular * .35), point(u0 + span * .34, -half - irregular * .25),
          point(u1 - bevel, -half + irregular * .2), point(u1, -half * .18), point(u1 - bevel * .6, half - irregular * .4),
          point(u0 + span * .62, half + irregular * .3), point(u0 + bevel, half - irregular * .15), point(u0, half * .18)
        ];
        const cx = (a[0] + tx * (u0 + u1) * .5), cy = (a[1] + ty * (u0 + u1) * .5);
        poly(g, moved(top, 9, 14), 'rgba(0,2,6,.58)');
        // Only southeast-facing sides receive a visible drop face.
        let area = 0;
        for (let i = 0; i < top.length; i++) { const p = top[i], q = top[(i + 1) % top.length]; area += p[0] * q[1] - q[0] * p[1]; }
        const orient = area >= 0 ? 1 : -1;
        for (let i = 0; i < top.length; i++) {
          const p = top[i], q = top[(i + 1) % top.length], ex = q[0] - p[0], ey = q[1] - p[1], el = Math.hypot(ex, ey) || 1;
          const outX = orient * ey / el, outY = -orient * ex / el;
          if (outX * .55 + outY * .83 > .18) {
            const face = g.createLinearGradient(p[0], p[1], p[0] + 8, p[1] + 12);
            face.addColorStop(0, 'rgba(113,99,76,.96)'); face.addColorStop(.55, 'rgba(58,63,60,.98)'); face.addColorStop(1, 'rgba(20,29,32,.98)');
            poly(g, [p, q, [q[0] + 7, q[1] + 11], [p[0] + 7, p[1] + 11]], face, 'rgba(4,9,12,.74)', .9);
          }
        }
        const base = 39 + (seed >>> 18) % 9, tone = 38 + (seed >>> 23) % 8;
        const cap = g.createLinearGradient(cx - 6, cy - 9, cx + 7, cy + 12);
        cap.addColorStop(0, hsl(35 + seed % 11, 18, Math.min(60, tone + 11)));
        cap.addColorStop(.46, hsl(32 + seed % 13, 15, base));
        cap.addColorStop(1, hsl(195, 12, Math.max(20, base - 15)));
        poly(g, top, cap, 'rgba(3,8,11,.82)', 1.15);
        for (let i = 0; i < top.length; i++) {
          const p = top[i], q = top[(i + 1) % top.length], ex = q[0] - p[0], ey = q[1] - p[1], el = Math.hypot(ex, ey) || 1;
          const outX = orient * ey / el, outY = -orient * ex / el, keyLight = outX * -.55 + outY * -.83;
          if (keyLight > .24) line(g, p[0], p[1], q[0], q[1], 'rgba(255,232,194,.46)', 1.25);
          else if (keyLight < -.2) line(g, p[0] + 1.2, p[1] + 1.8, q[0] + 1.2, q[1] + 1.8, 'rgba(0,3,8,.72)', 1.5);
        }
        if ((seed & 3) === 0) line(g, cx - tx * span * .13, cy - ty * span * .13, cx + tx * span * .08, cy + ty * span * .08, 'rgba(226,180,128,.3)', 1.2);
        along = u1 + 3 + ((seed >>> 9) % 5);
      }
    }
  }
  const FLOORS = { flag: floorFlag, slate: floorSlate, octa: floorOcta, planks: floorPlanks, cobble: floorCobble, travertine: floorTravertine, spicatum: floorSpicatum, kiln: floorKiln, crown: floorCrown };

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
    for (const r of arr(s.exits).concat(arr(s.gates), arr(s.water), arr(s.breakwaters), arr(s.shutters), arr(s.bridges), arr(s.growth), arr(s.dams))) if (finiteRect(r)) out.push({ x: r.x - 26, y: r.y - 26, w: r.w + 52, h: r.h + 52 });
    for (const p of emittersOf(s).concat(arr(s.receivers), staticMirrors(s), arr(s.pickups), arr(s.levers), s.beacon ? [s.beacon] : [], s.rescue ? [s.rescue] : []))
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
    const kilnLight = th.floor === 'kiln';
    const crownLight = th.decor === 'crown';
    const faceDepth = kilnLight ? 56 : crownLight ? 40 : FH;
    // Ambient occlusion: soft drop shadow and tight contact shadow on the floor.
    g.save();
    g.shadowColor = 'rgba(2,8,12,.7)'; g.shadowBlur = 26 * k; g.shadowOffsetX = (kilnLight ? 11 : 0) * k; g.shadowOffsetY = 14 * k; g.fillStyle = '#05090b';
    for (const w of walls) g.fillRect(w.x, w.y, w.w, w.h + faceDepth);
    g.shadowBlur = 7 * k; g.shadowOffsetX = (kilnLight ? 3 : 0) * k; g.shadowOffsetY = 4 * k; g.shadowColor = 'rgba(0,4,6,.8)';
    for (const w of walls) g.fillRect(w.x, w.y, w.w, w.h + faceDepth);
    g.restore();
    const faces = wallFaces(walls);
    const wallMaterialRng = rngFor(hashStr('kiln-wall-inlays:' + roomId(s)));
    // South faces.
    g.save(); g.beginPath(); for (const f of faces) g.rect(f.x, f.y - .5, f.w, faceDepth + .5); g.clip();
    const fg = g.createLinearGradient(0, 0, 0, 1);
    for (const f of faces) {
      const faceLift = kilnLight ? 18 : crownLight ? 14 : 8, faceShade = kilnLight ? 1 : crownLight ? -17 : -9;
      const gr = g.createLinearGradient(0, f.y, 0, f.y + faceDepth);
      gr.addColorStop(0, hsl(th.face[0], th.face[1], th.face[2] + faceLift)); gr.addColorStop(1, hsl(th.face[0], th.face[1], th.face[2] + faceShade));
      g.fillStyle = gr; g.fillRect(f.x, f.y, f.w, faceDepth);
      if (th.floor === 'kiln') {
        const faceKey = g.createLinearGradient(0, f.y - 2, W, f.y + faceDepth);
        faceKey.addColorStop(0, 'rgba(255,242,214,.22)'); faceKey.addColorStop(.42, 'rgba(255,240,215,.025)'); faceKey.addColorStop(1, 'rgba(0,2,7,.34)');
        g.fillStyle = faceKey; g.fillRect(f.x, f.y, f.w, faceDepth);
        // A narrow lit bevel and a deep far edge make the skirt read as raised stone.
        const bevel = g.createLinearGradient(f.x, 0, f.x + 10, 0);
        bevel.addColorStop(0, 'rgba(255,241,210,.32)'); bevel.addColorStop(1, 'rgba(255,241,210,0)');
        g.fillStyle = bevel; g.fillRect(f.x, f.y + 1, 10, faceDepth - 2);
        const farEdge = g.createLinearGradient(f.x + f.w - 8, 0, f.x + f.w, 0);
        farEdge.addColorStop(0, 'rgba(0,2,8,0)'); farEdge.addColorStop(1, 'rgba(0,2,8,.46)');
        g.fillStyle = farEdge; g.fillRect(f.x + f.w - 8, f.y, 8, faceDepth);
      }
      if (crownLight) {
        const faceKey = g.createLinearGradient(f.x, f.y, f.x + f.w * .65, f.y + faceDepth);
        faceKey.addColorStop(0, 'rgba(213,224,255,.16)'); faceKey.addColorStop(.4, 'rgba(106,151,207,.045)'); faceKey.addColorStop(1, 'rgba(2,6,16,.42)');
        g.fillStyle = faceKey; g.fillRect(f.x, f.y, f.w, faceDepth);
        const bevel = g.createLinearGradient(f.x, 0, f.x + 13, 0);
        bevel.addColorStop(0, 'rgba(213,225,255,.3)'); bevel.addColorStop(1, 'rgba(213,225,255,0)');
        g.fillStyle = bevel; g.fillRect(f.x + 1, f.y + 1, 13, faceDepth - 2);
        const bronze = g.createLinearGradient(0, f.y + 3, 0, f.y + 9);
        bronze.addColorStop(0, 'rgba(255,216,157,.28)'); bronze.addColorStop(1, 'rgba(255,216,157,0)');
        g.fillStyle = bronze; g.fillRect(f.x + 2, f.y + 2, f.w - 4, 8);
      }
      if (th.floor === 'kiln' && th.wall === 'basalt' && kilnMaterial) {
        for (let y = f.y + 4; y < f.y + faceDepth - 3; y += 11) {
          for (let x = f.x + 3; x < f.x + f.w - 4;) {
            const pw = Math.min(f.x + f.w - 3 - x, 18 + wallMaterialRng() * 22);
            if (wallMaterialRng() < .32) paintKilnRectMaterial(g, x, y, pw, Math.min(7, f.y + faceDepth - 2 - y), wallMaterialRng, .28);
            x += pw + 3 + wallMaterialRng() * 5;
          }
        }
      }
      if (th.wall === 'rock') {
        for (let x = f.x; x < f.x + f.w; x += 9 + rng() * 10) {
          ellipse(g, x, f.y + 4 + rng() * 8, 6 + rng() * 6, 4 + rng() * 3, hsl(th.face[0], th.face[1], th.face[2] + (rng() - .3) * 10), 'rgba(0,0,0,.35)', 1);
        }
      } else if (th.wall === 'aqueduct') {
        // Roman arcade: coursed ashlar pierced by small dark arches.
        for (let y = f.y + 7; y < f.y + faceDepth - 1; y += 7) line(g, f.x, y, f.x + f.w, y, 'rgba(30,18,6,.3)', 1);
        let row = 0;
        for (let y = f.y; y < f.y + faceDepth - 1; y += 7, row++) for (let x = f.x + (row % 2) * 11; x < f.x + f.w; x += 22) line(g, x, y + .5, x, y + 6.5, 'rgba(30,18,6,.28)', 1);
        const span = 36;
        const n = Math.floor((f.w - 8) / span);
        const x0 = f.x + (f.w - n * span) / 2;
        for (let i = 0; i < n; i++) {
          const ax = x0 + i * span + 8, aw = span - 16, ar = aw / 2, top = f.y + 6 + ar;
          g.beginPath(); g.moveTo(ax, f.y + faceDepth); g.lineTo(ax, top); g.arc(ax + ar, top, ar, Math.PI, 0); g.lineTo(ax + aw, f.y + faceDepth); g.closePath();
          const ag = g.createLinearGradient(0, f.y + 6, 0, f.y + faceDepth); ag.addColorStop(0, 'rgba(4,10,6,.95)'); ag.addColorStop(1, 'rgba(10,26,16,.85)');
          g.fillStyle = ag; g.fill();
          g.beginPath(); g.arc(ax + ar, top, ar + 2.2, Math.PI, 0); g.strokeStyle = hsl(th.face[0], th.face[1], th.face[2] + 22, .7); g.lineWidth = 2.4; g.stroke();
          for (let v = 0; v < 5; v++) { const va = Math.PI + v * Math.PI / 4; line(g, ax + ar + Math.cos(va) * ar, top + Math.sin(va) * ar, ax + ar + Math.cos(va) * (ar + 3.6), top + Math.sin(va) * (ar + 3.6), 'rgba(30,18,6,.5)', 1); }
          if (rng() < .7) tuft(g, ax + ar + (rng() - .5) * 6, f.y + faceDepth, rng, 6, .9);
        }
      } else if (th.wall === 'crown') {
        // Tall basalt faces carry a few recessed eclipse seals instead of the
        // abbey's close brick courses; each niche catches the same cool key.
        for (let y = f.y + 15; y < f.y + faceDepth - 2; y += 16) line(g, f.x + 2, y, f.x + f.w - 2, y, 'rgba(2,6,16,.32)', 1);
        for (let x = f.x + 34; x < f.x + f.w - 22; x += 82) {
          rrect(g, x - 11, f.y + 8, 22, Math.min(23, faceDepth - 11), 3);
          g.fillStyle = 'rgba(4,10,23,.62)'; g.fill(); g.strokeStyle = 'rgba(153,188,231,.25)'; g.lineWidth = 1; g.stroke();
          circle(g, x, f.y + 18, 4.5, '#182841', 'rgba(238,203,145,.58)', 1);
          poly(g, [[x, f.y + 13], [x + 3, f.y + 18], [x, f.y + 22], [x - 3, f.y + 18]], '#9acbe6', 'rgba(237,247,255,.75)', .8);
        }
      } else {
        const course = th.wall === 'brick' ? 5.3 : kilnLight ? 11 : 8;
        for (let y = f.y + course; y < f.y + faceDepth - 1; y += course) line(g, f.x, y, f.x + f.w, y, 'rgba(0,0,0,.35)', 1);
        let row = 0;
        for (let y = f.y; y < f.y + faceDepth - 1; y += course, row++) {
          const bw = th.wall === 'brick' ? 12 : th.wall === 'slate' ? 26 : 20;
          for (let x = f.x + (row % 2) * bw / 2; x < f.x + f.w; x += bw + (th.wall === 'brick' ? 0 : rng() * 8)) {
            line(g, x, y + .5, x, y + course - .5, 'rgba(0,0,0,.32)', 1);
            line(g, x + 1, y + 1, x + bw - 3, y + 1, 'rgba(255,240,220,.09)', 1);
          }
        }
      }
      if (th.decor === 'sluice') for (let x = f.x + 8; x < f.x + f.w; x += 14 + rng() * 22) { g.fillStyle = 'rgba(10,20,26,.28)'; g.fillRect(x, f.y + 2, 3 + rng() * 5, faceDepth - 2); }
      if (th.decor === 'shutters') { line(g, f.x, f.y + 6, f.x + f.w, f.y + 6, '#7a5a2e', 2); line(g, f.x, f.y + 5, f.x + f.w, f.y + 5, 'rgba(255,210,140,.35)', .7); }
      if (th.decor === 'sluice' || th.decor === 'beacon') { g.fillStyle = 'rgba(52,96,70,.55)'; g.fillRect(f.x, f.y + faceDepth - 4, f.w, 4); }
      line(g, f.x, f.y + faceDepth - .5, f.x + f.w, f.y + faceDepth - .5, 'rgba(0,0,0,.55)', 1.5);
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
    } else if (th.wall === 'crown') {
      let row = 0;
      for (let y = -30; y < H + 30; y += 36, row++) for (let x = -48 + (row % 2) * 24; x < W + 48; x += 48) {
        if (!walls.some(w => inRect(x + 24, y + 18, w, 30))) continue;
        const bw = 46, bh = 34;
        stone(g, x + 2, y + 2, bw - 4, bh - 4, jit(th.top, rng, 5, 6, 10), rng,
          { jit: .7, speck: 145, crack: .025, hi: .24, lo: .34, rim: .2 });
        line(g, x + 6, y + 4, x + bw - 7, y + 4, 'rgba(232,239,255,.26)', 1.1);
        if ((row + Math.round(x / 48)) % 4 === 0) {
          circle(g, x + bw / 2, y + bh / 2, 4.2, '#121b2a', 'rgba(232,193,133,.55)', 1);
          circle(g, x + bw / 2, y + bh / 2, 1.4, '#a2d5ef');
        }
      }
    } else {
      const bw = th.wall === 'brick' ? 18 : th.wall === 'slate' ? 36 : th.wall === 'basalt' ? 30 : th.wall === 'aqueduct' ? 42 : 34;
      const bh = th.wall === 'brick' ? 9 : th.wall === 'slate' ? 18 : th.wall === 'aqueduct' ? 21 : 24;
      let row = 0;
      for (let y = 0; y < H; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < W; x += bw) {
        if (!walls.some(w => inRect(x + bw / 2, y + bh / 2, w, bw))) continue;
        stone(g, x + 1, y + 1, bw - 2, bh - 2, jit(th.top, rng, 7, 8, 9), rng, { jit: th.wall === 'basalt' ? .8 : 1.5, speck: 70, crack: .08, hi: .16, lo: .3 });
        if (th.floor === 'kiln' && th.wall === 'basalt' && kilnMaterial && wallMaterialRng() < .22)
          paintKilnRectMaterial(g, x + 2, y + 2, bw - 4, bh - 4, wallMaterialRng, .2);
      }
    }
    if (th.floor === 'kiln') {
      const topKey = g.createLinearGradient(0, 0, W, H);
      topKey.addColorStop(0, 'rgba(255,244,220,.13)'); topKey.addColorStop(.46, 'rgba(255,245,225,.015)'); topKey.addColorStop(1, 'rgba(0,3,9,.23)');
      g.fillStyle = topKey; g.fillRect(0, 0, W, H);
    }
    // Inner edge shading: the parts of wide walls far from the floor are in shade.
    g.restore();
    // A narrow static contact band anchors each exposed wall skirt to the floor.
    for (const f of faces) {
      const groundY = f.y + faceDepth - 1, contact = g.createLinearGradient(0, groundY, 0, groundY + 16);
      contact.addColorStop(0, 'rgba(0,3,7,.36)'); contact.addColorStop(.35, 'rgba(0,3,7,.18)'); contact.addColorStop(1, 'rgba(0,3,7,0)');
      g.fillStyle = contact; g.fillRect(f.x, groundY, f.w, 16);
      if (kilnLight) line(g, f.x, groundY + 1.4, f.x + f.w, groundY + 1.4, 'rgba(206,166,119,.18)', 1);
    }
    // Rim lights and outlines, only on edges exposed to floor.
    for (const w of walls) {
      for (const [a, b] of edgeSegs(walls, w, 'top')) {
        line(g, w.x + a, w.y + .8, w.x + b, w.y + .8, hsl(th.top[0], th.top[1], th.top[2] + 20, .75), 1.6);
        if (b - a > 6) line(g, w.x + a + 2, w.y + 2.5, w.x + b - 2, w.y + 2.5, hsl(th.top[0], th.top[1], th.top[2] + 11, .3), 1.1);
        line(g, w.x + a, w.y - .4, w.x + b, w.y - .4, 'rgba(0,0,0,.55)', 1);
      }
      for (const [a, b] of edgeSegs(walls, w, 'bottom')) {
        if (th.floor === 'kiln') line(g, w.x + a, w.y + w.h - .8, w.x + b, w.y + w.h - .8, 'rgba(0,3,8,.52)', 1.8);
        else line(g, w.x + a, w.y + w.h - .8, w.x + b, w.y + w.h - .8, hsl(th.top[0], th.top[1], th.top[2] + 26, .9), 1.8);
      }
      for (const [a, b] of edgeSegs(walls, w, 'left')) {
        line(g, w.x + .8, w.y + a, w.x + .8, w.y + b, hsl(th.top[0], th.top[1], th.top[2] + 14, .6), 1.3);
        line(g, w.x - .5, w.y + a, w.x - .5, w.y + b + faceDepth, 'rgba(0,0,0,.5)', 1);
        if (kilnLight) line(g, w.x + 1.8, w.y + a, w.x + 1.8, w.y + b + faceDepth, 'rgba(255,239,207,.2)', 1.1);
      }
      for (const [a, b] of edgeSegs(walls, w, 'right')) {
        line(g, w.x + w.w - .8, w.y + a, w.x + w.w - .8, w.y + b, 'rgba(0,0,0,.35)', 1.6);
        line(g, w.x + w.w + .5, w.y + a, w.x + w.w + .5, w.y + b + faceDepth, 'rgba(0,0,0,.5)', 1);
      }
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
    if (th.decor === 'verdant') verdantWalls(g, s, th, rng, walls, faces, meta, onExit);
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
  // ---------------------------------------------------------------- Verdant Aqueduct static art
  function leafBlob(g, x, y, r, rng, hue, light, alpha) {
    // A rounded cluster of leaves lit from the top-left.
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU, d = rng() * r * .6, rr = r * (.35 + rng() * .3);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .8;
      const lift = (px - x) * -.4 + (py - y) * -.6;
      ellipse(g, px, py, rr, rr * .82, hsl(hue + (rng() - .5) * 16, 42 + rng() * 14, clamp(light + lift / r * 10 + (rng() - .5) * 6, 6, 70), alpha), null, 0, rng() * 3);
    }
    for (let i = 0; i < 4; i++) ellipse(g, x - r * .3 + (rng() - .5) * r * .5, y - r * .35 + (rng() - .5) * r * .3, r * .16, r * .1, hsl(hue - 10, 60, light + 24, alpha * .8), null, 0, -.6);
  }
  function bush(g, x, y, r, rng) {
    ellipse(g, x + r * .25, y + r * .45, r * 1.05, r * .6, 'rgba(0,10,4,.4)');
    leafBlob(g, x, y + r * .15, r, rng, 105, 17, 1);
    leafBlob(g, x - r * .1, y - r * .05, r * .8, rng, 98, 27, 1);
    leafBlob(g, x - r * .25, y - r * .25, r * .45, rng, 88, 38, .95);
  }
  function hangingVine(g, x, y, len, rng, root) {
    let vx = x, vy = y; g.beginPath(); g.moveTo(vx, vy);
    const pts = [];
    for (let i = 0; i < 6; i++) { vx += (rng() - .5) * (root ? 3 : 5); vy += len / 6; g.lineTo(vx, vy); pts.push([vx, vy]); }
    g.strokeStyle = root ? '#3a2616' : '#2c4a1e'; g.lineWidth = root ? 2.6 : 1.4; g.stroke();
    if (root) { g.strokeStyle = 'rgba(190,150,100,.35)'; g.lineWidth = .8; g.stroke(); }
    for (const [px, py] of pts) {
      if (root) { if (rng() < .4) line(g, px, py, px + (rng() - .5) * 8, py + 3 + rng() * 5, '#3a2616', .9); }
      else ellipse(g, px + (rng() - .5) * 5, py, 2.8, 1.8, hsl(90 + rng() * 30, 48, 28 + rng() * 16), null, 0, rng() * 3);
    }
  }
  function verdantWalls(g, s, th, rng, walls, faces, meta, onExit) {
    // Moss blanket and scrub on the wall tops, heaviest along edges that face the floor.
    for (const w of walls) {
      const n = Math.floor(w.w * w.h / 420 * th.moss);
      for (let i = 0; i < n; i++) mossClump(g, w.x + rng() * w.w, w.y + rng() * w.h, 4 + rng() * 7, rng, .55 + rng() * .3);
    }
    // Specus: the aqueduct's own water channel runs along the crown of thick walls.
    for (const w of walls) {
      if (Math.min(w.w, w.h) < 36 || Math.max(w.w, w.h) < 120) continue;
      const horiz = w.w >= w.h, cw = 10;
      const r = horiz ? { x: w.x + 10, y: w.y + w.h / 2 - cw / 2, w: w.w - 20, h: cw } : { x: w.x + w.w / 2 - cw / 2, y: w.y + 10, w: cw, h: w.h - 20 };
      g.fillStyle = 'rgba(20,14,6,.6)'; g.fillRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
      g.fillStyle = hsl(th.top[0], th.top[1], th.top[2] + 12); g.fillRect(r.x - 2, r.y - 2, r.w + 4, 2); g.fillRect(r.x - 2, r.y - 2, 2, r.h + 4);
      const wg = horiz ? g.createLinearGradient(0, r.y, 0, r.y + r.h) : g.createLinearGradient(r.x, 0, r.x + r.w, 0);
      wg.addColorStop(0, hsl(th.water[0], th.water[1] * .6, th.water[2] - 16)); wg.addColorStop(.5, hsl(th.water[0], th.water[1] * .7, th.water[2] - 2)); wg.addColorStop(1, hsl(th.water[0], th.water[1] * .6, th.water[2] - 14));
      g.fillStyle = wg; g.fillRect(r.x, r.y, r.w, r.h);
      for (let d = 6; d < (horiz ? r.w : r.h) - 6; d += 9 + rng() * 14) {
        if (horiz) line(g, r.x + d, r.y + 3 + rng() * 6, r.x + d + 6, r.y + 3 + rng() * 6, 'rgba(210,255,235,.25)', 1);
        else line(g, r.x + 3 + rng() * 6, r.y + d, r.x + 3 + rng() * 6, r.y + d + 6, 'rgba(210,255,235,.25)', 1);
      }
      meta.channels.push(r);
    }
    // Scrub and saplings rooted in the masonry.
    for (const w of walls) {
      const n = Math.floor((w.w + w.h) / 90 * th.moss);
      for (let i = 0; i < n; i++) {
        const x = w.x + 6 + rng() * Math.max(1, w.w - 12), y = w.y + 6 + rng() * Math.max(1, w.h - 12);
        if (onExit(x, y) || meta.channels.some(c => inRect(x, y, c, 6))) continue;
        bush(g, x, y, Math.min(11, Math.min(w.w, w.h) * .42) * (.7 + rng() * .5), rng);
      }
    }
    // Ivy and roots spilling down the arcade faces.
    for (const f of faces) for (let x = f.x + 8; x < f.x + f.w - 8; x += 12 + rng() * 26) {
      if (onExit(x, f.y)) continue;
      const root = rng() < (th.sub === 'roots' || th.sub === 'reservoir' ? .5 : .28);
      hangingVine(g, x, f.y - 2, 10 + rng() * (FH + 8), rng, root);
      if (rng() < .5) mossClump(g, x, f.y - 2, 4 + rng() * 4, rng, .9);
    }
    if (th.sub === 'spillway') {
      for (const f of faces) {
        if (f.w < 120) continue;
        for (let x = f.x + 80; x < f.x + f.w - 50; x += 220) {
          if (onExit(x, f.y)) continue;
          // stone lion-mouth spout
          circle(g, x, f.y + 9, 8, hsl(th.face[0], th.face[1], th.face[2] + 18), 'rgba(20,10,4,.7)', 1.4);
          ellipse(g, x, f.y + 12, 4, 3, '#0a1208');
          meta.spouts.push({ x, y: f.y + 14, rgb: '170,245,215' });
        }
      }
    }
    if (th.sub === 'quay' || th.sub === 'ferry') {
      for (const f of faces) {
        if (f.w < 110) continue;
        for (let x = f.x + 60; x < f.x + f.w - 40; x += th.sub === 'ferry' ? 150 : 210) {
          if (onExit(x, f.y)) continue;
          line(g, x, f.y + 1, x, f.y + 8, '#2a1a0c', 1.4);
          rrect(g, x - 5, f.y + 8, 10, 12, 2); g.fillStyle = '#3a2a14'; g.fill(); g.strokeStyle = '#140c04'; g.lineWidth = 1; g.stroke();
          g.fillStyle = '#ffe2a0'; g.fillRect(x - 3, f.y + 10, 6, 8);
          meta.lights.push({ x, y: f.y + 22, r: 140, rgb: WARM, a: .45, flicker: 1 });
          meta.lanterns.push({ x, y: f.y + 14 });
        }
      }
    }
  }
  function surfaceRoot(g, x, y, ang, len, width, rng, clear) {
    // A gnarled surface root crawling out from the masonry.
    const pts = [[x, y]];
    let a = ang;
    for (let i = 1; i <= 8; i++) {
      a += (rng() - .5) * .5;
      const px = pts[i - 1][0] + Math.cos(a) * len / 8, py = pts[i - 1][1] + Math.sin(a) * len / 8;
      if (clear.some(r => inRect(px, py, r))) break;
      pts.push([px, py]);
    }
    if (pts.length < 3) return;
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < pts.length; i++) {
        const wdt = width * (1 - i / (pts.length + 1));
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        if (pass === 0) line(g, ax + 1.5, ay + 2.5, bx + 1.5, by + 2.5, 'rgba(10,8,2,.35)', wdt + 2);
        else if (pass === 1) { g.lineCap = 'round'; line(g, ax, ay, bx, by, '#3b2717', wdt); g.lineCap = 'butt'; }
        else line(g, ax - wdt * .18, ay - wdt * .25, bx - wdt * .18, by - wdt * .25, 'rgba(200,160,110,.28)', Math.max(.8, wdt * .28));
      }
    }
    for (let i = 2; i < pts.length - 1; i++) if (rng() < .35) mossClump(g, pts[i][0], pts[i][1] - 1, 3 + rng() * 3, rng, .85);
    if (pts.length > 4 && rng() < .7) { const [bx, by] = pts[Math.floor(pts.length / 2)]; surfaceRoot(g, bx, by, a + (rng() < .5 ? .9 : -.9), len * .45, width * .5, rng, clear); }
  }
  function verdantDecals(g, s, th, rng, W, H, meta) {
    const walls = arr(s.walls).filter(finiteRect), kc = keepClear(s);
    const free = (x, y, pad) => !walls.some(w => inRect(x, y, w, pad || 0)) && !arr(s.water).some(z => inRect(x, y, z, 6));
    // Surface roots crawling out from the walls.
    const nRoots = th.sub === 'roots' ? 26 : th.sub === 'reservoir' ? 20 : th.sub === 'quay' || th.sub === 'ferry' ? 6 : 12;
    for (let i = 0, made = 0; i < nRoots * 30 && made < nRoots; i++) {
      const w = walls[Math.floor(rng() * walls.length)];
      if (!w) break;
      const side = Math.floor(rng() * 4);
      const x = side === 0 ? w.x + rng() * w.w : side === 1 ? w.x + w.w + 1 : side === 2 ? w.x + rng() * w.w : w.x - 1;
      const y = side === 0 ? w.y + w.h + 1 : side === 1 ? w.y + rng() * w.h : side === 2 ? w.y - 1 : w.y + rng() * w.h;
      if (!free(x + (side === 1 ? 4 : side === 3 ? -4 : 0), y + (side === 0 ? 4 : side === 2 ? -4 : 0)) || kc.some(r => inRect(x, y, r))) continue;
      const ang = [Math.PI / 2, 0, -Math.PI / 2, Math.PI][side] + (rng() - .5) * .9;
      surfaceRoot(g, x, y, ang, 60 + rng() * 110, 5 + rng() * 5, rng, kc.concat(walls.filter(o => o !== w)));
      made++;
    }
    // Grass fringe hugging every wall, sparser in the open.
    for (let i = 0; i < 520; i++) {
      const x = rng() * W, y = rng() * H;
      if (!free(x, y, 2)) continue;
      const d = wallDist(x, y, walls);
      if (d > 16 + rng() * rng() * 220) continue;
      tuft(g, x, y, rng, 6 + rng() * 7, .9);
    }
    // Fallen leaves and blossoms.
    for (let i = 0; i < 170; i++) {
      const x = rng() * W, y = rng() * H;
      if (!free(x, y, 2)) continue;
      const hue = rng() < .7 ? 70 + rng() * 40 : 30 + rng() * 20;
      ellipse(g, x, y, 2.6 + rng() * 1.8, 1.4 + rng() * .8, hsl(hue, 50, 30 + rng() * 22, .8), 'rgba(20,14,4,.3)', .6, rng() * 3);
      if (rng() < .08) for (let k = 0; k < 5; k++) circle(g, x + Math.cos(k * 1.26) * 2.4, y + Math.sin(k * 1.26) * 2.4, 1.4, rng() < .5 ? '#f4efd8' : '#f2c8e0');
    }
    // Ferns near walls.
    for (const p of spots(s, rng, 12, 8, 36, 90, W, H)) {
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k - 3) * .42, L = 14 + rng() * 10;
        const ex = p.x + Math.cos(a) * L, ey = p.y + Math.sin(a) * L * .8;
        g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo((p.x + ex) / 2 + Math.cos(a + 1.2) * 4, (p.y + ey) / 2 + Math.sin(a + 1.2) * 4, ex, ey);
        g.strokeStyle = hsl(96 + rng() * 20, 45, 30 + rng() * 12); g.lineWidth = 1.2; g.stroke();
        for (let q = .25; q < 1; q += .15) {
          const qx = p.x + (ex - p.x) * q, qy = p.y + (ey - p.y) * q;
          ellipse(g, qx, qy, 3.2 * (1.1 - q), 1.3, hsl(100 + rng() * 20, 48, 28 + rng() * 16), null, 0, a + 1.4);
          ellipse(g, qx, qy, 3.2 * (1.1 - q), 1.3, hsl(100 + rng() * 20, 48, 24 + rng() * 16), null, 0, a - 1.4);
        }
      }
    }
    if (th.sub === 'ferry' || th.sub === 'quay') { // coiled mooring rope, flat on the boards
      for (const p of spots(s, rng, th.sub === 'ferry' ? 4 : 3, 14, 40, 160, W, H)) {
        for (let r = 10; r > 2; r -= 2.4) circle(g, p.x, p.y, r, null, '#b89a62', 2.2);
        circle(g, p.x, p.y, 11, null, 'rgba(0,0,0,.3)', 1);
      }
    }
    // Canopy gaps: pools of warm light baked into the light map.
    for (let i = 0; i < 34; i++) {
      const x = rng() * W, y = rng() * H;
      meta.lights.push({ x, y, r: 36 + rng() * 80, rgb: '255,238,170', a: .18 + rng() * .2 });
    }
    for (let i = 0; i < 3; i++) meta.lights.push({ x: W * (.2 + rng() * .6), y: H * (.2 + rng() * .6), r: 200 + rng() * 80, rgb: '255,230,160', a: .22 });
  }
  function verdantExterior(g, th, rng, W, H) {
    // Beyond the walls: the forest canopy seen from above.
    g.fillStyle = '#081a0e'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 180; i++) {
      const x = rng() * W, y = rng() * H, r = 16 + rng() * 34;
      leafBlob(g, x, y, r, rng, 100 + rng() * 30, 10 + rng() * 10, 1);
      if (rng() < .5) leafBlob(g, x - r * .2, y - r * .25, r * .55, rng, 92 + rng() * 20, 20 + rng() * 10, .95);
    }
  }
  function beds(g, s, th, rng, W, H) {
    for (const z of arr(s.water).filter(finiteRect)) {
      const big = z.w * z.h > 150000;
      g.save(); g.beginPath(); g.rect(z.x, z.y, z.w, z.h); g.clip();
      if (th.decor === 'verdant') {
        // Canal bed: silted flagstones under weed, fading into jade depth.
        g.fillStyle = '#12261c'; g.fillRect(z.x, z.y, z.w, z.h);
        for (let y = z.y; y < z.y + z.h; y += 34) for (let x = z.x + ((y - z.y) / 34 % 2) * 17; x < z.x + z.w; x += 34) {
          g.fillStyle = hsl(150 + rng() * 20, 18, 16 + rng() * 6); g.fillRect(x + 1.5, y + 1.5, 31, 31);
        }
        for (let i = 0; i < z.w * z.h / 700; i++) {
          const x = z.x + rng() * z.w, y = z.y + rng() * z.h, len = 6 + rng() * 14;
          g.strokeStyle = hsl(95 + rng() * 40, 45, 22 + rng() * 14, .75); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y);
          g.quadraticCurveTo(x + (rng() - .5) * len, y - len * .5, x + (rng() - .5) * len * .6, y - len); g.stroke();
        }
        for (let i = 0; i < z.w * z.h / 1400; i++) circle(g, z.x + rng() * z.w, z.y + rng() * z.h, 1 + rng() * 2.4, hsl(40, 20, 30 + rng() * 20, .6));
        const gr = g.createLinearGradient(0, z.y, 0, z.y + 30); gr.addColorStop(0, 'rgba(0,8,4,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(z.x, z.y, z.w, 30);
        const gl = g.createLinearGradient(z.x, 0, z.x + 20, 0); gl.addColorStop(0, 'rgba(0,8,4,.5)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gl; g.fillRect(z.x, z.y, 20, z.h);
      } else if (big) {
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
      if (th.decor === 'verdant') {
        // Dressed coping stones along the canal lip, softened by moss.
        g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; g.strokeRect(z.x - 5.5, z.y - 5.5, z.w + 11, z.h + 11);
        g.strokeStyle = hsl(th.top[0], th.top[1], th.top[2] + 14); g.lineWidth = 4; g.strokeRect(z.x - 2.5, z.y - 2.5, z.w + 5, z.h + 5);
        g.strokeStyle = 'rgba(255,245,215,.25)'; g.lineWidth = 1; g.strokeRect(z.x - 4, z.y - 4, z.w + 8, z.h + 8);
        for (let d = 0; d < 2 * (z.w + z.h); d += 22 + rng() * 40) {
          const p = d < z.w ? [z.x + d, z.y - 3] : d < z.w + z.h ? [z.x + z.w + 3, z.y + d - z.w] : d < 2 * z.w + z.h ? [z.x + z.w - (d - z.w - z.h), z.y + z.h + 3] : [z.x - 3, z.y + z.h - (d - 2 * z.w - z.h)];
          if (rng() < .6) mossClump(g, p[0], p[1], 3 + rng() * 4, rng, .85); else tuft(g, p[0], p[1], rng, 6, .9);
        }
      } else if (!big) {
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
    for (const m of staticMirrors(s)) {
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
    if (th.decor === 'verdant') verdantDecals(g, s, th, rng, W, H, meta);
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
    if (th.decor === 'kiln') {
      // Old annealing sockets: dark iron mouths ringed in hand-set copper.
      for (const p of spots(s, rng, 4, 34, 150, 260, W, H)) {
        circle(g, p.x, p.y + 2, 19, 'rgba(0,0,0,.38)');
        circle(g, p.x, p.y, 14, '#1a1a1c', '#8d6746', 2.2);
        circle(g, p.x, p.y, 9, '#101417', 'rgba(216,157,97,.46)', 1.2);
        for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8;
          line(g, p.x + Math.cos(a) * 5, p.y + Math.sin(a) * 5, p.x + Math.cos(a) * 11, p.y + Math.sin(a) * 11, 'rgba(213,151,90,.48)', 1.2);
        }
        circle(g, p.x, p.y, 3.2, '#7c3927', 'rgba(255,147,82,.48)', 1);
        meta.lights.push({ x: p.x, y: p.y, r: 105, rgb: '255,112,57', a: .24, flicker: 1 });
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
    if (th.decor === 'verdant') verdantExterior(g, th, rng, W, H);
    else if (sea) {
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
    if (th.decor === 'verdant' && hasDoc) { // canopy shade baked into the light map: free at runtime
      const tile = leafShadowTile();
      l.globalAlpha = .7;
      for (let y = 0; y < H; y += 320) for (let x = 0; x < W; x += 320) l.drawImage(tile, x, y);
      l.globalAlpha = 1;
    }
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
  let kilnMaterial = null, kilnMaterialState = 'idle';
  let kilnApronMaterial = null, kilnApronMaterialState = 'idle';
  function loadKilnApronMaterial() {
    if (!hasDoc || typeof Image === 'undefined' || kilnApronMaterialState !== 'idle') return;
    kilnApronMaterialState = 'loading';
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        kilnApronMaterial = img; kilnApronMaterialState = 'ready';
        // Rebuild the cached Weaver apron after the local art becomes available.
        staticCache.clear();
      } else kilnApronMaterialState = 'failed';
    };
    img.onerror = () => { kilnApronMaterialState = 'failed'; };
    img.decoding = 'async';
    img.src = 'assets/img/kiln-apron-lit-v1.png';
  }
  function loadKilnMaterial() {
    if (!hasDoc || typeof Image === 'undefined' || kilnMaterialState !== 'idle') return;
    kilnMaterialState = 'loading';
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        kilnMaterial = img; kilnMaterialState = 'ready';
        // The first static canvas may have baked the procedural fallback while this loaded.
        staticCache.clear();
      } else kilnMaterialState = 'failed';
    };
    img.onerror = () => { kilnMaterialState = 'failed'; };
    img.decoding = 'async';
    img.src = 'assets/img/kiln-basalt-mosaic-v1.png';
  }
  let seraSprite = null, seraLitSprite = null, seraSpriteState = 'idle';
  function keySeraSprite(img) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!hasDoc || !(iw > 0 && ih > 0)) return null;
    const canvas = makeCanvas(iw, ih), g = canvas.getContext('2d');
    if (!g) return null;
    g.drawImage(img, 0, 0, iw, ih);
    // Bake the kiln's upper-left key into the alpha mask once, keeping transparent margins clear.
    g.globalCompositeOperation = 'source-atop';
    const key = g.createLinearGradient(0, 0, iw, ih);
    key.addColorStop(0, 'rgba(255,239,207,.34)');
    key.addColorStop(.4, 'rgba(255,249,228,.08)');
    key.addColorStop(.68, 'rgba(13,22,30,.08)');
    key.addColorStop(1, 'rgba(2,8,15,.38)');
    g.fillStyle = key; g.fillRect(0, 0, iw, ih);
    g.globalCompositeOperation = 'source-over';
    return canvas;
  }
  function loadSeraSprite() {
    if (!hasDoc || typeof Image === 'undefined' || seraSpriteState !== 'idle') return;
    seraSpriteState = 'loading';
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        seraSprite = img; seraLitSprite = keySeraSprite(img); seraSpriteState = 'ready';
      } else seraSpriteState = 'failed';
    };
    img.onerror = () => { seraSpriteState = 'failed'; };
    img.decoding = 'async';
    img.src = 'assets/img/sera-keeper-topdown-v3.png';
  }
  let weaverSprite = null, weaverLitSprite = null, weaverSpriteState = 'idle';
  function keyWeaverSprite(img) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!hasDoc || !(iw > 0 && ih > 0)) return null;
    const canvas = makeCanvas(iw, ih), g = canvas.getContext('2d');
    if (!g) return null;
    g.drawImage(img, 0, 0, iw, ih);
    g.globalCompositeOperation = 'source-atop';
    const key = g.createLinearGradient(0, 0, iw, ih);
    key.addColorStop(0, 'rgba(255,239,207,.16)');
    key.addColorStop(.48, 'rgba(255,249,228,.025)');
    key.addColorStop(1, 'rgba(2,8,15,.24)');
    g.fillStyle = key; g.fillRect(0, 0, iw, ih);
    g.globalCompositeOperation = 'source-over';
    return canvas;
  }
  function loadWeaverSprite() {
    if (!hasDoc || typeof Image === 'undefined' || weaverSpriteState !== 'idle') return;
    weaverSpriteState = 'loading';
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        weaverSprite = img; weaverLitSprite = keyWeaverSprite(img); weaverSpriteState = 'ready';
      } else weaverSpriteState = 'failed';
    };
    img.onerror = () => { weaverSpriteState = 'failed'; };
    img.decoding = 'async';
    img.src = 'assets/img/glass-weaver-boss-v1.png';
  }
  function paintKilnRectMaterial(g, x, y, w, h, rng, alpha) {
    if (!kilnMaterial || w < 3 || h < 3) return;
    const iw = kilnMaterial.naturalWidth || kilnMaterial.width, ih = kilnMaterial.naturalHeight || kilnMaterial.height;
    if (!(iw > 0 && ih > 0)) return;
    const cropW = Math.min(iw, w * (2.2 + rng() * .8));
    const cropH = Math.min(ih, h * (2.2 + rng() * .8));
    const sx = rng() * Math.max(0, iw - cropW), sy = rng() * Math.max(0, ih - cropH);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = alpha;
    g.drawImage(kilnMaterial, sx, sy, cropW, cropH, x, y, w, h);
    // A restrained directional glaze reinforces the material's shallow relief.
    const relief = g.createLinearGradient(x, y, x + w * .45, y + h);
    relief.addColorStop(0, 'rgba(245,247,238,.13)');
    relief.addColorStop(.48, 'rgba(255,255,255,0)');
    relief.addColorStop(1, 'rgba(0,3,8,.23)');
    g.globalAlpha = 1; g.fillStyle = relief; g.fillRect(x, y, w, h);
    g.restore();
  }
  function paintKilnMaterial(g, s, W, H, plates) {
    if (!kilnMaterial) { loadKilnMaterial(); return; }
    const iw = kilnMaterial.naturalWidth || kilnMaterial.width, ih = kilnMaterial.naturalHeight || kilnMaterial.height;
    if (!(iw > 0 && ih > 0 && W > 0 && H > 0 && Array.isArray(plates))) return;
    // Independently sampled slabs keep the generated material from reading as a tile.
    const materialRng = rngFor(hashStr('kiln-tile-inlays:' + roomId(s)));
    for (const plate of plates) {
      if (materialRng() > .58) continue;
      const x = plate.x, y = plate.y, w = plate.w, h = plate.h;
      if (w < 8 || h < 8) continue;
      g.save(); g.beginPath();
      if (Array.isArray(plate.points) && plate.points.length > 2) {
        plate.points.forEach((point, i) => i ? g.lineTo(point[0], point[1]) : g.moveTo(point[0], point[1]));
      } else {
        const cut = Math.min(w, h) * .18;
        g.moveTo(x + cut, y); g.lineTo(x + w - cut, y); g.lineTo(x + w, y + cut);
        g.lineTo(x + w, y + h - cut); g.lineTo(x + w - cut, y + h); g.lineTo(x + cut, y + h);
        g.lineTo(x, y + h - cut); g.lineTo(x, y + cut);
      }
      g.closePath(); g.clip();
      paintKilnRectMaterial(g, x, y, w, h, materialRng, .64);
      // Selected slabs catch a cool upper-left rim and hold a deeper lower edge.
      let area = 0;
      for (let i = 0; i < plate.points.length; i++) {
        const a = plate.points[i], b = plate.points[(i + 1) % plate.points.length];
        area += a[0] * b[1] - b[0] * a[1];
      }
      const orientation = area >= 0 ? 1 : -1;
      for (let i = 0; i < plate.points.length; i++) {
        const a = plate.points[i], b = plate.points[(i + 1) % plate.points.length];
        const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
        const nx = orientation * dy / length, ny = -orientation * dx / length;
        const light = nx * -.55 + ny * -.83;
        if (light > .16) line(g, a[0], a[1], b[0], b[1], `rgba(224,239,239,${.12 + light * .13})`, 1.8);
        else if (light < -.2) line(g, a[0], a[1], b[0], b[1], 'rgba(0,3,8,.3)', 2.4);
      }
      g.restore();
    }
  }
  const geoSig = new WeakMap();
  function signature(s) {
    const key = s.walls;
    if (key && typeof key === 'object' && geoSig.has(key)) return geoSig.get(key);
    const pick = a => arr(a).map(o => [o.x, o.y, o.w, o.h, o.dx, o.dy].map(v => (Number.isFinite(v) ? Math.round(v) : '')).join(',')).join(';');
    const sig = [roomId(s), pick(s.walls), pick(s.water), pick(s.breakwaters), pick(s.shutters), pick(emittersOf(s)), pick(s.receivers), pick(staticMirrors(s)), pick(s.exits), pick(s.pickups), pick(s.bridges), pick(s.growth), pick(s.dams), pick(s.levers),
      s.beacon ? pick([s.beacon]) : '', sanctZone(s) ? pick([sanctZone(s)]) : ''].join('|');
    const h = roomId(s) + ':' + hashStr(sig).toString(36);
    if (key && typeof key === 'object') geoSig.set(key, h);
    return h;
  }
  function drawWeaverColumnDetails(g, s) {
    if (roomId(s) !== 'weaver') return;
    const columns = arr(s.walls).filter(w => finiteRect(w) && w.x === 472 && w.w === 80 && w.h === 44 && (w.y === 250 || w.y === 474));
    for (const w of columns) {
      const x = w.x, y = w.y, faceY = y + w.h, faceH = 56;
      // These inset courses sit wholly on the two existing crucible blocks.
      const cap = g.createLinearGradient(x + 4, y + 2, x + w.w - 4, y + w.h - 2);
      cap.addColorStop(0, 'rgba(190,164,126,.32)'); cap.addColorStop(.3, 'rgba(72,78,77,.14)'); cap.addColorStop(1, 'rgba(3,9,13,.46)');
      rrect(g, x + 2, y + 2, w.w - 4, w.h - 4, 4); g.fillStyle = cap; g.fill();
      g.strokeStyle = 'rgba(4,9,12,.8)'; g.lineWidth = 2; g.stroke();
      g.save(); rrect(g, x + 2, y + 2, w.w - 4, w.h - 4, 4); g.clip();
      const capBounce = g.createRadialGradient(x + w.w - 10, y + w.h - 9, 1, x + w.w - 12, y + w.h - 12, 42);
      capBounce.addColorStop(0, 'rgba(255,190,126,.36)'); capBounce.addColorStop(.5, 'rgba(224,125,73,.17)'); capBounce.addColorStop(1, 'rgba(224,125,73,0)');
      g.fillStyle = capBounce; g.fillRect(x + 40, y + 10, 38, 31); g.restore();
      rrect(g, x + 8, y + 7, w.w - 16, w.h - 14, 3);
      const inset = g.createLinearGradient(x + 8, y + 7, x + w.w - 8, y + w.h - 7);
      inset.addColorStop(0, 'rgba(11,20,23,.82)'); inset.addColorStop(.5, 'rgba(28,37,39,.62)'); inset.addColorStop(1, 'rgba(4,10,14,.88)');
      g.fillStyle = inset; g.fill(); g.strokeStyle = 'rgba(190,151,101,.46)'; g.lineWidth = 1; g.stroke();
      line(g, x + 11, y + 9, x + w.w - 13, y + 9, 'rgba(255,228,184,.56)', 1.5);
      line(g, x + 10, y + 10, x + 10, y + w.h - 11, 'rgba(255,231,190,.32)', 1.35);
      line(g, x + 13, y + w.h - 9, x + w.w - 10, y + w.h - 9, 'rgba(0,2,5,.56)', 1.5);
      for (const px of [x + 13, x + w.w - 13]) {
        circle(g, px, y + 13, 1.8, '#c99d61', 'rgba(18,15,10,.8)', .8);
        circle(g, px, y + w.h - 13, 1.8, '#887151', 'rgba(12,14,14,.8)', .8);
      }

      const face = g.createLinearGradient(x + 1, faceY, x + w.w - 1, faceY + faceH);
      face.addColorStop(0, 'rgba(145,122,91,.23)'); face.addColorStop(.38, 'rgba(43,43,40,.2)'); face.addColorStop(1, 'rgba(2,7,10,.4)');
      g.fillStyle = face; g.fillRect(x + 3, faceY + 2, w.w - 6, faceH - 4);
      g.save(); g.beginPath(); g.rect(x + 3, faceY + 2, w.w - 6, faceH - 4); g.clip();
      const reflectedFeed = g.createRadialGradient(x + w.w - 4, faceY + 16, 1, x + w.w - 8, faceY + 22, 66);
      reflectedFeed.addColorStop(0, 'rgba(255,186,116,.34)'); reflectedFeed.addColorStop(.45, 'rgba(232,133,74,.17)'); reflectedFeed.addColorStop(1, 'rgba(232,133,74,0)');
      g.fillStyle = reflectedFeed; g.fillRect(x + 24, faceY + 2, w.w - 27, faceH - 4); g.restore();
      rrect(g, x + 9, faceY + 8, w.w - 18, 37, 3);
      g.fillStyle = 'rgba(5,12,16,.3)'; g.fill(); g.strokeStyle = 'rgba(185,150,102,.32)'; g.lineWidth = 1; g.stroke();
      line(g, x + 10, faceY + 9, x + w.w - 10, faceY + 9, 'rgba(255,224,177,.42)', 1.35);
      line(g, x + 8, faceY + 19, x + w.w - 8, faceY + 19, 'rgba(2,5,8,.46)', 1);
      line(g, x + 8, faceY + 39, x + w.w - 8, faceY + 39, 'rgba(2,5,8,.38)', 1);
      line(g, x + 4, faceY + faceH - 2, x + w.w - 4, faceY + faceH - 2, 'rgba(0,2,5,.62)', 2);
      line(g, x + 4, faceY + 3, x + 4, faceY + faceH - 3, 'rgba(255,231,192,.2)', 1.5);
      line(g, x + w.w - 4, faceY + 3, x + w.w - 4, faceY + faceH - 3, 'rgba(0,2,5,.42)', 1.5);
      // A tight down-right heel shadow anchors the existing raised face.
      const heel = g.createRadialGradient(x + w.w * .64, faceY + faceH, 1, x + w.w * .64, faceY + faceH + 4, 48);
      heel.addColorStop(0, 'rgba(0,3,7,.28)'); heel.addColorStop(.46, 'rgba(0,3,7,.12)'); heel.addColorStop(1, 'rgba(0,3,7,0)');
      ellipse(g, x + w.w * .62 + 5, faceY + faceH + 3, 52, 12, heel);
    }
  }
  function crownArenaArchitecture(g, s, W, H, meta) {
    const cx = W / 2, cy = H / 2;
    meta.lights.push({ x: cx, y: cy, r: 330, rgb: '112,160,236', a: .25 });
    meta.lights.push({ x: cx, y: cy, r: 150, rgb: '255,190,118', a: .1 });
    if (roomId(s) !== 'crown') {
      // Shared wayfinding grooves make the final region feel like one place;
      // keep them faint so moving beams and authored room mechanisms stay clear.
      g.save(); g.globalAlpha = .34;
      for (const r of [112, 184, 272]) {
        ellipse(g, cx, cy, r * 1.14, r * .78, null, 'rgba(166,193,235,.14)', 1.25);
      }
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12, x1 = cx + Math.cos(a) * 275, y1 = cy + Math.sin(a) * 188;
        const x2 = cx + Math.cos(a) * 294, y2 = cy + Math.sin(a) * 201;
        line(g, x1, y1, x2, y2, 'rgba(225,196,146,.24)', 2);
      }
      g.restore();
      return;
    }

    // The Crown Lens is built around a broad raised astrolabe dais. Its bevels,
    // dark cast skirt, inlaid circuits and central well give the Keeper a clear
    // focal ground plane without placing collision geometry into the room.
    const points = n => Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + i * TAU / n;
      return [cx + Math.cos(a) * 190, cy + Math.sin(a) * 166];
    });
    const outer = points(16), skirt = outer.map(p => [p[0] + 5, p[1] + 17]);
    poly(g, outer.map(p => [p[0] + 9, p[1] + 21]), 'rgba(0,3,10,.62)');
    poly(g, skirt, '#10182a', '#060b15', 2.4);
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length, face = [outer[i], outer[j], skirt[j], skirt[i]];
      const light = i >= 5 && i <= 11;
      poly(g, face, light ? '#27334a' : '#172238', 'rgba(3,8,17,.76)', 1);
      if (light) line(g, outer[i][0], outer[i][1], outer[j][0], outer[j][1], 'rgba(230,215,181,.44)', 1.35);
    }
    const top = g.createRadialGradient(cx - 42, cy - 65, 18, cx + 10, cy + 9, 220);
    top.addColorStop(0, '#596680'); top.addColorStop(.26, '#414f69'); top.addColorStop(.68, '#303e58'); top.addColorStop(1, '#202d47');
    poly(g, outer, top, 'rgba(6,10,19,.96)', 2.3);
    ellipse(g, cx, cy, 185, 160, null, 'rgba(219,196,153,.62)', 2.1);
    ellipse(g, cx, cy, 173, 148, null, 'rgba(143,185,229,.38)', 1.2);
    ellipse(g, cx, cy, 145, 125, 'rgba(17,27,46,.38)', 'rgba(9,15,29,.72)', 1.3);
    ellipse(g, cx, cy, 135, 116, null, 'rgba(220,191,141,.34)', 1.1);
    ellipse(g, cx, cy, 93, 80, 'rgba(16,24,42,.32)', 'rgba(149,180,218,.36)', 1.2);

    // Alternating meridian marks and lens-shaped inlays read as craft at full size,
    // while their low contrast keeps them quiet under the player and Keeper.
    for (let i = 0; i < 32; i++) {
      const a = i * TAU / 32, cs = Math.cos(a), sn = Math.sin(a);
      const r1 = i % 4 === 0 ? 151 : 158, r2 = 168;
      line(g, cx + cs * r1, cy + sn * r1 * .86, cx + cs * r2, cy + sn * r2 * .86,
        i % 4 === 0 ? 'rgba(241,213,164,.72)' : 'rgba(166,197,234,.34)', i % 4 === 0 ? 2 : 1);
    }
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + i * TAU / 8, cs = Math.cos(a), sn = Math.sin(a);
      const x = cx + cs * 151, y = cy + sn * 129;
      const rx = -sn, ry = cs;
      poly(g, [[x + cs * 9, y + sn * 8], [x + rx * 5, y + ry * 5], [x - cs * 9, y - sn * 8], [x - rx * 5, y - ry * 5]],
        'rgba(15,24,41,.72)', 'rgba(223,194,145,.62)', 1.1);
      circle(g, cx + cs * 181, cy + sn * 158, 3, '#c9a66d', 'rgba(246,225,183,.7)', .8);
    }
    ellipse(g, cx, cy, 70, 59, 'rgba(7,12,25,.44)', 'rgba(177,202,237,.42)', 1.4);
    ellipse(g, cx, cy, 56, 46, null, 'rgba(244,192,126,.52)', 1.2);
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + Math.PI / 4, cs = Math.cos(a), sn = Math.sin(a);
      const x = cx + cs * 112, y = cy + sn * 95;
      line(g, cx + cs * 74, cy + sn * 63, x, y, 'rgba(181,207,235,.28)', 1.4);
      circle(g, x, y, 4, '#263b58', 'rgba(226,196,147,.7)', 1.1);
      circle(g, x, y, 1.3, '#acdff5');
    }
    // Two separate keeper seals are tied visually into the dais's radial system.
    for (const [x, y] of [[320, 608], [704, 160]]) {
      ellipse(g, x, y, 40, 32, 'rgba(5,10,21,.26)', 'rgba(146,181,224,.35)', 1.2);
      ellipse(g, x, y, 32, 25, null, 'rgba(232,197,144,.5)', 1.2);
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4 + Math.PI / 4;
        const px = x + Math.cos(a) * 34, py = y + Math.sin(a) * 26;
        circle(g, px, py, 1.7, '#a8d7ef');
      }
    }
  }
  function getStatic(s, th, k, W, H) {
    const key = signature(s) + '@' + k;
    let st = staticCache.get(key);
    if (st) return st;
    const canvas = makeCanvas(W * k, H * k), g = canvas.getContext('2d');
    const meta = { k, lights: [], candles: [], braziers: [], spouts: [], channels: [], lanterns: [] };
    const rng = rngFor(hashStr(roomId(s)));
    g.scale(k, k);
    g.fillStyle = th.void; g.fillRect(0, 0, W, H);
    (FLOORS[th.floor] || floorFlag)(g, W, H, rng, th, s);
    if (th.decor === 'observatory') {
      // Fine brass survey rings distinguish the region without darkening its playable ground.
      const cx = W / 2, cy = H / 2;
      for (const r of [130, 248, 365]) {
        circle(g, cx, cy, r, null, 'rgba(234,212,162,.22)', 2);
        for (let i = 0; i < 36; i++) {
          const a = i * TAU / 36, len = i % 3 ? 5 : 13;
          line(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a) * (r - len), cy + Math.sin(a) * (r - len), 'rgba(232,219,183,.28)', 1.2);
        }
      }
    }
    drawWeaverForecourt(g, s);
    decals(g, s, th, rng, W, H, meta);
    beds(g, s, th, rng, W, H);
    inlays(g, s, th);
    if (th.decor === 'crown') crownArenaArchitecture(g, s, W, H, meta);
    exterior(g, s, th, rng, W, H);
    drawWalls(g, s, th, rng, W, H, meta);
    drawWeaverColumnDetails(g, s);
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
  function drawNightPaths(ctx, s, t) {
    if (!s.darkness) return;
    // Keep the banks readable, but reveal the route through the gulf only with stored light.
    for (const z of arr(s.voids).filter(finiteRect)) {
      ctx.fillStyle = '#070a18'; ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = '#b78cb1'; ctx.lineWidth = 3; ctx.strokeRect(z.x, z.y, z.w, z.h);
      for (let x = z.x + 12; x < z.x + z.w - 6; x += 29) {
        line(ctx, x - 4, z.y + 5, x + 2, z.y + 11, '#bf9da8', 2);
        line(ctx, x - 4, z.y + z.h - 11, x + 2, z.y + z.h - 5, '#bf9da8', 2);
      }
    }
    const paths = arr(s.starPaths).filter(finiteRect);
    // The HUD owns the shared timer; label only the nearest lit segment in the world.
    const nearestLitPath = paths.filter(p => !p.alignTo && p.active).slice().sort((a, b) => {
      const player = s.player || { x: 0, y: 0 };
      return rectDist(player.x, player.y, a) - rectDist(player.x, player.y, b);
    })[0];
    if (paths.some(p => !p.alignTo && !p.active) && s.player) {
      const landing = arr(s.rechargePads).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
        .slice().sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y))[0];
      if (landing) labels.push({ x: landing.x, y: landing.y - num(landing.r, 32) - 18, text: 'BURST TO REVEAL PATH', color: '#c2f0ff', size: 11 });
    }
    for (const p of paths) {
      const active = !!p.active, held = !!p.held, time = Math.max(0, num(s.burstTime, 0));
      // Telescope bridges remain mechanically legible; inactive burst routes disclose no interior geometry.
      if (!p.alignTo && !active) continue;
      const warning = active && !p.alignTo && time > 0 && time < 1.5;
      const color = held || warning ? '#ffd29a' : active ? '#b4f5ff' : '#ce9eab';
      ctx.save();
      if (warning) ctx.globalAlpha = .65 + .35 * time / 1.5;
      ctx.fillStyle = active ? '#455a85' : '#111528'; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = color; ctx.lineWidth = active ? 3 : 2; ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
      const horiz = p.w >= p.h, length = horiz ? p.w : p.h;
      for (let d = 15; d < length; d += 28) {
        const x = horiz ? p.x + d : p.x + p.w / 2, y = horiz ? p.y + p.h / 2 : p.y + d;
        if (active) {
          circle(ctx, x, y, 3.4, '#edfcff');
          line(ctx, x - 6, y, x + 6, y, '#bdefff', 1);
          line(ctx, x, y - 6, x, y + 6, '#bdefff', 1);
          if (d + 28 < length) line(ctx, x + (horiz ? 7 : 0), y + (horiz ? 0 : 7), x + (horiz ? 21 : 0), y + (horiz ? 0 : 21), '#9dcfef', 1.4);
        } else {
          line(ctx, x - 4, y - 4, x + 4, y + 4, '#ad849b', 1.5);
          line(ctx, x + 4, y - 4, x - 4, y + 4, '#ad849b', 1.5);
        }
      }
      ctx.restore();
      const label = held ? 'HELD · REACH THE EDGE' : p.alignTo ? (active ? 'LENS ALIGNED · CROSS' : 'TURN THE LENS') : `STAR PATH · ${time.toFixed(1)}s`;
      if (p.alignTo || held || p === nearestLitPath) labels.push({ x: p.x + p.w / 2, y: p.y - 12, text: label, color, size: 11 });
    }
    for (const p of arr(s.rechargePads)) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const r = num(p.r, 32);
      circle(ctx, p.x, p.y, r, '#243d58', '#a8edff', 2.5);
      circle(ctx, p.x, p.y, r - 7, null, '#708eab', 1.5);
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        line(ctx, p.x + Math.cos(a) * (r - 3), p.y + Math.sin(a) * (r - 3), p.x + Math.cos(a) * (r + 4), p.y + Math.sin(a) * (r + 4), '#e0eeff', 2);
      }
      poly(ctx, [[p.x, p.y - 14], [p.x + 8, p.y], [p.x, p.y + 14], [p.x - 8, p.y]], '#d7f7ff', '#92c5ed', 2);
      glowQueue.push([p.x, p.y, r * 1.6, COOL, .28 + .06 * Math.sin(t * 3)]);
      labels.push({ x: p.x, y: p.y + r + 13, text: 'RECHARGE LIGHT', color: '#c2f0ff', size: 10 });
    }
    for (const m of arr(s.mirrors)) {
      const paths = arr(s.starPaths).filter(p => p.alignTo && p.alignTo.mirror === m.id);
      if (!paths.length) continue;
      circle(ctx, m.x, m.y, 40, null, '#bba983', 2);
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        circle(ctx, m.x + Math.cos(a) * 40, m.y + Math.sin(a) * 40, 3, paths.some(p => p.alignTo.index === i && p.active) ? '#befff2' : '#807796');
      }
      labels.push({ x: m.x, y: m.y + 53, text: 'TELESCOPE · TURN TO ALIGN', color: '#e5d9b5', size: 10 });
    }
    if (num(s.burstTime, 0) > 0 && s.burstOrigin) {
      const p = s.burstOrigin, f = clamp(num(s.burstTime, 0) / 6, 0, 1);
      circle(ctx, p.x, p.y, 38 + (1 - f) * 70, null, `rgba(180,229,255,${f * .45})`, 2);
    }
  }
  function drawNightEnemyFloor(ctx, e, s, t) {
    if (num(e.hp, 0) <= 0) return;
    if (enemyType(e) === 'twin' && e.shielded) {
      const other = arr(s.enemies).find(n => n.id === e.linked && num(n.hp, 0) > 0);
      if (other && String(e.id) < String(other.id)) {
        line(ctx, e.x, e.y - 12, other.x, other.y - 12, '#17203e', 8);
        ctx.save(); ctx.setLineDash([9, 7]); ctx.lineDashOffset = -t * 18;
        line(ctx, e.x, e.y - 12, other.x, other.y - 12, '#d3baff', 3); ctx.restore();
        labels.push({ x: (e.x + other.x) / 2, y: (e.y + other.y) / 2 - 26, text: 'LINKED SHIELDS · BURST THE THREAD', color: '#e4ceff', size: 10 });
      }
    }
    if (/windup|telegraph|dash/.test(e.phase || '')) {
      const a = Math.atan2(num(e.aimY, 0), num(e.aimX, 1));
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      poly(ctx, [[0, -20], [180, -27], [200, 0], [180, 27], [0, 20]], 'rgba(255,105,129,.24)', '#ffbbbc', 2);
      for (let x = 40; x < 180; x += 40) { line(ctx, x - 8, -9, x + 5, 0, '#ffe4d5', 2); line(ctx, x + 5, 0, x - 8, 9, '#ffe4d5', 2); }
      ctx.restore();
    }
  }
  function drawNightEnemy(ctx, e, s, t) {
    const twin = enemyType(e) === 'twin', alive = num(e.hp, 0) > 0;
    if (!alive) { ellipse(ctx, e.x, e.y, twin ? 26 : 18, 9, '#302c4e', '#8d85af', 1.5); return; }
    const exposed = num(e.exposed, 0) > 0 || e.phase === 'exposed', shielded = !!e.shielded && !exposed;
    const warning = /windup|telegraph|dash/.test(e.phase || '');
    const pale = exposed ? '#baffdf' : warning ? '#ffc3b6' : '#ddd5ff';
    contactShadow(ctx, e.x, e.y + 9, twin ? 28 : 21, 10, .85);
    ctx.save(); ctx.translate(e.x, e.y + Math.sin(t * 3 + e.x) * 2);
    if (twin) ctx.scale(1.25, 1.25);
    poly(ctx, [[0, -38], [15, -23], [12, -8], [24, 18], [9, 12], [0, 21], [-11, 12], [-23, 18], [-13, -10], [-15, -23]], exposed ? '#446b73' : '#393754', '#b0a5dc', 2);
    poly(ctx, [[0, -32], [10, -21], [0, -5], [-10, -21]], '#101a31', pale, 1.5);
    line(ctx, -6, -20, -2, -19, pale, 3); line(ctx, 2, -19, 6, -20, pale, 3);
    poly(ctx, [[0, -5], [6, 2], [0, 10], [-6, 2]], pale, '#101b31', 1.5);
    if (twin) { line(ctx, -15, -30, 15, -30, '#e4c6ff', 2); for (const x of [-13, 0, 13]) line(ctx, x, -30, x, -40 + (x ? 4 : 0), '#e4c6ff', 2); }
    if (shielded) { ellipse(ctx, 0, -8, 31, 41, 'rgba(159,139,228,.1)', '#cfbaff', 2.5); circle(ctx, 0, -8, 35, null, '#9a85c6', 1); }
    ctx.restore();
    hpPips(ctx, e.x, e.y + (twin ? 35 : 29), num(e.hp, 0), num(e.maxHp, twin ? 5 : 3));
    labels.push({ x: e.x, y: e.y - (twin ? 67 : 51), text: exposed ? 'EXPOSED · STRIKE' : twin ? (shielded ? 'TWIN · SHIELDED' : 'TWIN · STRIKE') : 'SHADE · REVEAL WITH LIGHT', color: pale, size: 10 });
  }
  let floodLabel = null;
  function glassWhenHot(g) { return g.when === 'hot'; }
  function drawGlass(ctx, s, t) {
    let nearest = null;
    const player = s.player;
    for (const g of arr(s.glass).filter(finiteRect)) {
      const hotWhen = glassWhenHot(g), active = !!g.active, bridge = g.mode === 'bridge', solid = g.mode === 'solid' || bridge, hot = hotWhen;
      const warn = clamp(num(g.warning, 0), 0, 1), cx = g.x + g.w / 2, cy = g.y + g.h / 2;
      const color = hot ? '255,111,48' : '95,197,255';
      ctx.save();
      ctx.fillStyle = active ? `rgba(${color},${solid ? .19 : .31})` : `rgba(${color},.035)`;
      ctx.fillRect(g.x, g.y, g.w, g.h);
      if (active && solid) {
        // A cut, annealed slab: a colored body, beveled edges and wide optical facets.
        const grad = ctx.createLinearGradient(g.x, g.y, g.x + g.w, g.y + g.h);
        grad.addColorStop(0, 'rgba(121,224,255,.34)'); grad.addColorStop(.34, 'rgba(164,125,255,.22)');
        grad.addColorStop(.66, 'rgba(255,174,105,.2)'); grad.addColorStop(1, 'rgba(106,229,223,.3)');
        ctx.fillStyle = grad; ctx.fillRect(g.x + 2, g.y + 2, Math.max(0, g.w - 4), Math.max(0, g.h - 4));
        ctx.save(); ctx.beginPath(); ctx.rect(g.x + 2, g.y + 2, Math.max(0, g.w - 4), Math.max(0, g.h - 4)); ctx.clip();
        const step = Math.max(22, Math.min(44, Math.min(g.w, g.h) * .35));
        for (let x = g.x - g.h; x < g.x + g.w; x += step) {
          poly(ctx, [[x, g.y], [x + step * .55, g.y], [x + g.h * .42, g.y + g.h], [x + g.h * .05, g.y + g.h]], 'rgba(223,249,255,.075)');
        }
        if (g.w > 30 && g.h > 24) {
          for (let y = g.y + 18; y < g.y + g.h - 8; y += 28) line(ctx, g.x + 5, y, g.x + g.w - 5, y + Math.sin(y * .07) * 2, 'rgba(222,249,255,.17)', 1);
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(12,27,36,.88)'; ctx.lineWidth = 6; ctx.strokeRect(g.x + 1, g.y + 1, g.w - 2, g.h - 2);
        ctx.strokeStyle = bridge ? 'rgba(181,241,255,.98)' : 'rgba(199,246,255,.88)'; ctx.lineWidth = bridge ? 2.3 : 1.7; ctx.strokeRect(g.x + 4, g.y + 4, g.w - 8, g.h - 8);
        line(ctx, g.x + 7, g.y + 6, g.x + g.w - 10, g.y + 6, 'rgba(255,255,255,.7)', 1.1);
        if (bridge) {
          // Raised, walkable span: bright twin deck rails and cross joints distinguish it from a cover slab.
          const horiz = g.w >= g.h, span = horiz ? g.w : g.h, across = horiz ? g.h : g.w;
          const stride = Math.max(18, span / 22), rail = 'rgba(169,239,255,.96)';
          for (const edge of [4, Math.max(4, across - 4)]) {
            if (horiz) line(ctx, g.x + 5, g.y + edge, g.x + g.w - 5, g.y + edge, rail, 2.3);
            else line(ctx, g.x + edge, g.y + 5, g.x + edge, g.y + g.h - 5, rail, 2.3);
          }
          for (let d = stride; d < span - 5; d += stride) {
            if (horiz) line(ctx, g.x + d, g.y + 5, g.x + d, g.y + g.h - 5, 'rgba(222,250,255,.4)', 1.1);
            else line(ctx, g.x + 5, g.y + d, g.x + g.w - 5, g.y + d, 'rgba(222,250,255,.4)', 1.1);
          }
          // Faceted lead-in catches light and makes the span read as a path underfoot.
          if (horiz) poly(ctx, [[g.x + 5, g.y + 5], [g.x + 16, g.y + 5], [g.x + 29, cy], [g.x + 16, g.y + g.h - 5], [g.x + 5, g.y + g.h - 5]], 'rgba(224,250,255,.2)');
          else poly(ctx, [[g.x + 5, g.y + 5], [g.x + g.w - 5, g.y + 5], [cx, g.y + 18], [g.x + 5, g.y + 31]], 'rgba(224,250,255,.2)');
        }
        for (const [fx, fy] of [[g.x + 7, g.y + 7], [g.x + g.w - 7, g.y + 7], [g.x + 7, g.y + g.h - 7], [g.x + g.w - 7, g.y + g.h - 7]]) {
          circle(ctx, fx, fy, 2.1, '#d9fbff', 'rgba(72,143,174,.9)', .8);
        }
        glowQueue.push([cx, cy, Math.min(72, Math.max(28, Math.min(g.w, g.h) * .55)), '134,205,255', .27]);
      } else if (active) {
        // Active hazard glass is visibly molten (or cryogenic), with moving convection lines.
        const grad = ctx.createLinearGradient(g.x, g.y, g.x + g.w * .3, g.y + g.h);
        if (hot) { grad.addColorStop(0, 'rgba(255,221,129,.55)'); grad.addColorStop(.22, 'rgba(255,104,42,.74)'); grad.addColorStop(.7, 'rgba(186,42,26,.73)'); grad.addColorStop(1, 'rgba(80,22,24,.58)'); }
        else { grad.addColorStop(0, 'rgba(196,250,255,.42)'); grad.addColorStop(.35, 'rgba(76,183,245,.56)'); grad.addColorStop(1, 'rgba(35,70,156,.55)'); }
        ctx.fillStyle = grad; ctx.fillRect(g.x + 2, g.y + 2, Math.max(0, g.w - 4), Math.max(0, g.h - 4));
        ctx.save(); ctx.beginPath(); ctx.rect(g.x + 2, g.y + 2, Math.max(0, g.w - 4), Math.max(0, g.h - 4)); ctx.clip();
        const alongX = g.w >= g.h, span = alongX ? g.w : g.h, across = alongX ? g.h : g.w;
        const rows = Math.min(11, Math.max(3, Math.ceil(across / 11)));
        for (let i = 0; i < rows; i++) {
          const base = (i + .5) * across / rows, amp = Math.min(5, across / 12);
          ctx.beginPath();
          for (let u = 0, stride = Math.max(12, span / 48); u <= span; u += stride) {
            const wave = Math.sin(u * .055 - t * 7 + i * 1.9) * amp;
            const x = alongX ? g.x + u : g.x + base + wave, y = alongX ? g.y + base + wave : g.y + u;
            u ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.strokeStyle = hot ? `rgba(255,${i % 2 ? 203 : 143},83,${.18 + .1 * Math.sin(t * 4 + i)})` : `rgba(200,249,255,${.23 + .08 * Math.sin(t * 4 + i)})`;
          ctx.lineWidth = i % 3 === 0 ? 2 : 1; ctx.stroke();
        }
        ctx.restore();
        const pulse = .7 + .3 * Math.sin(t * (hot ? 10 : 6) + cx * .03);
        ctx.strokeStyle = warn > 0 ? `rgba(255,244,200,${.48 + .45 * warn})` : hot ? `rgba(255,184,102,${.62 * pulse})` : 'rgba(171,237,255,.67)';
        ctx.lineWidth = warn > 0 ? 3.4 : 2.2; ctx.strokeRect(g.x + 2, g.y + 2, g.w - 4, g.h - 4);
        for (let i = 0; hot && i < 4; i++) {
          const ph = (t * .23 + i * .271 + cx * .001) % 1;
          const sx = g.x + 7 + ph * Math.max(1, g.w - 14), sy = g.y + 4 + ((i * 37 + ph * 29) % Math.max(8, g.h - 8));
          const composite = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
          bloom(ctx, sx, sy, 3.5 + (1 - ph) * 2, '255,194,103', .42 * (1 - ph));
          ctx.globalCompositeOperation = composite;
        }
        glowQueue.push([cx, cy, Math.min(80, Math.max(32, Math.min(g.w, g.h) * .6)), color, hot ? .48 : .28]);
      } else {
        // Inactive paths stay legible as etched traces without implying a safe platform.
        ctx.save(); ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 9;
        ctx.strokeStyle = warn > 0 ? `rgba(255,174,93,${.38 + .42 * warn})` : hot ? 'rgba(212,119,83,.36)' : 'rgba(118,180,211,.35)';
        ctx.lineWidth = warn > 0 ? 2.5 : 1.5; ctx.strokeRect(g.x + 2, g.y + 2, g.w - 4, g.h - 4); ctx.restore();
        if (warn > 0) {
          const pulse = .12 + .18 * (.5 + .5 * Math.sin(t * 18));
          ctx.fillStyle = `rgba(255,158,76,${pulse})`; ctx.fillRect(g.x + 2, g.y + 2, g.w - 4, g.h - 4);
        }
      }
      if (player && Number.isFinite(player.x) && Number.isFinite(player.y)) {
        const d = Math.hypot(player.x - cx, player.y - cy);
        if (d < 148 && (!nearest || d < nearest.d)) {
          const modeText = active ? (bridge ? 'GLASS BRIDGE' : solid ? 'ANNEALED GLASS' : hot ? 'MOLTEN GLASS' : 'FROST GLASS') : warn > 0 ? (hot ? 'HEATING' : 'FREEZING') : 'GLASS TRACE';
          nearest = { d, x: cx, y: g.y - 18, text: modeText, color: active && solid ? '#cbf5ff' : active ? (hot ? '#ffc07c' : '#aeeaff') : '#c3c4d0' };
        }
      }
      ctx.restore();
    }
    if (nearest) labels.push({ x: nearest.x, y: nearest.y, text: nearest.text, color: nearest.color, size: 10 });
  }
  function drawWater(ctx, s, t, th) {
    const tile = caustics();
    floodLabel = null;
    for (const z of arr(s.water).filter(finiteRect)) {
      const deep = zoneActive(z, s), soon = zoneFlipSoon(z, s), depth = tideDepth(z, s), w = zoneWarn(z, s), verdant = th.decor === 'verdant';
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
      if (deep && verdant) verdantSurface(ctx, z, t);
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
        const remain = zoneRemain(z, s);
        ctx.save(); ctx.strokeStyle = deep ? 'rgba(200,235,255,.7)' : `rgba(255,${160 + 60 * Math.sin(t * 14)},90,.9)`; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.lineDashOffset = t * 30;
        ctx.strokeRect(z.x + 1.5, z.y + 1.5, z.w - 3, z.h - 3); ctx.restore();
        const pl = s.player || { x: 0, y: 0 };
        const lx = clamp(pl.x, z.x + 44, z.x + z.w - 44), ly = clamp(pl.y, z.y + 14, z.y + z.h - 14);
        const d = Math.hypot(lx - pl.x, ly - pl.y);
        if (!deep && (!floodLabel || d < floodLabel.d)) floodLabel = { d, x: lx, y: ly, text: `FLOOD ${remain.toFixed(1)}s`, color: '#ffc27a', size: 11 };
        else if (deep && cycleZone(z) && (!floodLabel || d < floodLabel.d)) floodLabel = { d, x: lx, y: ly, text: `DRAINS ${remain.toFixed(1)}s`, color: '#bff5e0', size: 11 };
      }
    }
  }
  function drawWeaverLoomFloor(ctx, s) {
    if (roomId(s) !== 'weaver') return;
    // The Weaver stands in a recessed forge well, surrounded by a low, walkable
    // basalt rim. The extrusion, asymmetric bevel and masonry joints give it
    // weight without adding gameplay blockers or target-like spokes.
    const outer = [[692, 382], [704, 345], [728, 318], [768, 306], [830, 306], [870, 318], [895, 343], [908, 379], [897, 417], [874, 443], [833, 458], [770, 458], [730, 444], [704, 418]];
    const shifted = (points, dx, dy) => points.map(p => [p[0] + dx, p[1] + dy]);
    const inner = [[730, 382], [739, 354], [757, 335], [781, 326], [817, 326], [841, 335], [859, 354], [868, 382], [859, 409], [841, 428], [817, 437], [781, 437], [757, 428], [739, 409]];
    ctx.save();
    poly(ctx, shifted(outer, 10, 18), 'rgba(0,3,6,.54)');
    poly(ctx, shifted(outer, 3, 9), '#242b2d', 'rgba(0,3,7,.74)', 2.5);
    const top = ctx.createLinearGradient(700, 310, 900, 454);
    top.addColorStop(0, '#59605b'); top.addColorStop(.32, '#394347'); top.addColorStop(.72, '#293438'); top.addColorStop(1, '#171f23');
    poly(ctx, outer, top, 'rgba(4,9,12,.9)', 2.2);
    // One stable, broad crop of the local basalt mosaic gives the rim authored material.
    ctx.save(); ctx.beginPath(); outer.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.clip();
    if (kilnMaterial) paintKilnRectMaterial(ctx, 692, 306, 216, 152, rngFor(hashStr('weaver-hearth-mosaic')), .27);
    const key = ctx.createLinearGradient(700, 310, 900, 450);
    key.addColorStop(0, 'rgba(255,228,184,.22)'); key.addColorStop(.38, 'rgba(250,230,194,.025)'); key.addColorStop(1, 'rgba(0,4,9,.34)');
    ctx.fillStyle = key; ctx.fillRect(692, 306, 216, 152); ctx.restore();
    // North/west cap bevel catches the kiln key; the far edge falls into cool shade.
    poly(ctx, [[692, 382], [704, 345], [728, 318], [768, 306], [830, 306], [870, 318]], null, 'rgba(255,231,191,.5)', 3.2);
    poly(ctx, [[870, 318], [895, 343], [908, 379], [897, 417], [874, 443], [833, 458], [770, 458]], null, 'rgba(0,3,8,.7)', 3.2);
    // Course joints on the broad apron make it masonry rather than a floor decal.
    line(ctx, 736, 324, 774, 312, 'rgba(3,8,11,.6)', 2);
    line(ctx, 774, 312, 774, 316, 'rgba(226,205,169,.24)', .9);
    line(ctx, 832, 312, 868, 324, 'rgba(3,8,11,.55)', 2);
    line(ctx, 736, 438, 774, 451, 'rgba(0,3,7,.58)', 2);
    line(ctx, 832, 451, 868, 438, 'rgba(0,3,7,.56)', 2);

    // Recessed inner hearth: a deep, faceted well with a lit upper-left coping.
    const well = ctx.createLinearGradient(740, 330, 858, 434);
    well.addColorStop(0, '#273334'); well.addColorStop(.42, '#172225'); well.addColorStop(1, '#0b1217');
    poly(ctx, inner, well, 'rgba(5,10,13,.9)', 2);
    poly(ctx, [[730, 382], [739, 354], [757, 335], [781, 326], [817, 326], [841, 335], [859, 354]], null, 'rgba(255,221,174,.43)', 2.4);
    poly(ctx, [[859, 354], [868, 382], [859, 409], [841, 428], [817, 437], [781, 437]], null, 'rgba(0,3,8,.66)', 2.5);
    // Soot-dark basin and an uneven annealed-glass seam sit beneath the boss.
    const basin = ctx.createRadialGradient(785, 364, 5, 800, 386, 68);
    basin.addColorStop(0, 'rgba(101,88,68,.68)'); basin.addColorStop(.58, 'rgba(46,42,36,.62)'); basin.addColorStop(1, 'rgba(2,8,12,.08)');
    ellipse(ctx, 800, 384, 62, 42, basin);
    // Directional annealed-glass reflections bridge the feed mouths and the
    // hearth rim; each soft pool remains asymmetric and leaves the walk lanes legible.
    for (const [x, y, rx, ry, strength] of [[773, 369, 78, 50, .24], [823, 400, 68, 45, .17]]) {
      const bounce = ctx.createRadialGradient(x - rx * .28, y - ry * .34, 1, x, y, rx);
      bounce.addColorStop(0, `rgba(255,204,145,${strength})`);
      bounce.addColorStop(.34, `rgba(255,166,95,${strength * .7})`);
      bounce.addColorStop(.78, `rgba(211,104,62,${strength * .22})`);
      bounce.addColorStop(1, 'rgba(211,104,62,0)');
      ellipse(ctx, x, y, rx, ry, bounce);
    }
    // Kiln heat reflects in broken glass patches, strongest to the lit northwest
    // and trailing into a softer copper sheen toward the southeast.
    const heatNW = ctx.createRadialGradient(779, 371, 1, 789, 382, 62);
    heatNW.addColorStop(0, 'rgba(255,221,165,.7)'); heatNW.addColorStop(.28, 'rgba(255,177,103,.48)');
    heatNW.addColorStop(.68, 'rgba(224,111,65,.2)'); heatNW.addColorStop(1, 'rgba(224,111,65,0)');
    ellipse(ctx, 790, 382, 60, 39, heatNW);
    const heatSE = ctx.createRadialGradient(818, 398, 1, 813, 390, 52);
    heatSE.addColorStop(0, 'rgba(246,147,83,.46)'); heatSE.addColorStop(.56, 'rgba(208,104,61,.23)'); heatSE.addColorStop(1, 'rgba(208,104,61,0)');
    ellipse(ctx, 810, 391, 51, 33, heatSE);
    line(ctx, 756, 385, 769, 392, 'rgba(255,220,168,.55)', 1.5);
    line(ctx, 769, 392, 780, 386, 'rgba(192,225,205,.38)', 1.2);
    line(ctx, 821, 390, 835, 397, 'rgba(255,191,127,.45)', 1.4);
    line(ctx, 835, 397, 846, 391, 'rgba(176,217,203,.32)', 1.1);
    ctx.restore();
  }
  function drawBreakwaters(ctx, s, t, th) {
    if (floodLabel) { labels.push(floodLabel); floodLabel = null; }
    for (const b of arr(s.breakwaters).filter(finiteRect)) {
      const up = zoneActive(b, s), soon = zoneFlipSoon(b, s), w = zoneWarn(b, s);
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
        contactShadow(ctx, px + 2, py + 6, 13, 7, .8);
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
      if (!barred && !near) labels.push({ x: lx, y: ly, text: (dx < 0 ? '‹ ' : '') + roomName(e.to).toUpperCase() + (dx >= 0 ? ' ›' : ''), color: '#cdeee2', size: 10, dim: true, avoidThermal: true });
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
    contactShadow(ctx, e.x + 3, e.y + 8, 28, 15, .85);
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
    if (kind === 'pump') { drawPump(ctx, r, t, s); return; }
    contactShadow(ctx, r.x + 3, r.y + 10, 27, 13, .9);
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
    if (m.portable) { drawPortablePrism(ctx, m, t, s); return; }
    const dirs = arr(m.dirs).filter(d => Array.isArray(d) && d.length >= 2);
    const idx = clamp(Math.floor(num(m.index, 0)), 0, Math.max(0, dirs.length - 1));
    const out = dirs[idx] || [1, 0];
    const inc = incomingDir(m, s);
    const lit = typeof m.lit === 'boolean' ? m.lit : !!inc;
    contactShadow(ctx, m.x + 3, m.y + 10, 22, 11, .9);
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
    contactShadow(ctx, e.x + 3, e.y + 10, 26, 13, .9);
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
  function crownStage(e) {
    const stage = num(e && e.stage, 0);
    return stage === 1 || stage === 2 || stage === 3 ? stage : 0;
  }
  function crownExposed(e) { return num(e && e.exposed, 0) > 0 || !!(e && e.phase === 'exposed'); }
  function drawCrownFloor(ctx, e, s, t) {
    if (num(e.hp, 1) <= 0) return;
    const stage = crownStage(e) || 1;
    const phase = String(e.phase || '').toLowerCase();
    const attack = String(e.attackPhase || '').toLowerCase();
    const open = crownExposed(e);
    const pulse = .78 + .18 * Math.sin(t * 11);

    // Stage three is an outward eclipse pulse. The dashed rings stay floor-level
    // and decorative: they explain its timing without becoming collision geometry.
    if (stage === 3 && !open && (phase === 'eclipse-windup' || phase === 'eclipse-recover')) {
      const winding = phase === 'eclipse-windup';
      const timer = Math.max(0, num(e.timer, 0));
      const progress = winding ? clamp(1 - timer / 1.35, 0, 1) : 1;
      const r = Math.max(58, num(e.r, 34) + 34 + progress * 104);
      const alpha = winding ? .42 + .16 * pulse : .14;
      const rgb = '255,174,104';
      ctx.save();
      ctx.lineWidth = winding ? 2.4 : 1.5;
      ctx.setLineDash(winding ? [10, 8] : [4, 10]);
      ctx.lineDashOffset = -t * (winding ? 38 : 14);
      circle(ctx, e.x, e.y, r, null, `rgba(${rgb},${alpha})`, winding ? 2.4 : 1.5);
      ctx.setLineDash([]);
      circle(ctx, e.x, e.y, Math.max(34, r - 27), null, `rgba(255,225,184,${alpha * .55})`, 1.2);
      for (let i = 0; i < 8; i++) {
        const a = t * .16 + i * TAU / 8, cs = Math.cos(a), sn = Math.sin(a);
        line(ctx, e.x + cs * (r - 7), e.y + sn * (r - 7), e.x + cs * (r + 6), e.y + sn * (r + 6), `rgba(255,226,187,${alpha * .9})`, 1.6);
      }
      ctx.restore();
      if (winding) {
        glowQueue.push([e.x, e.y, 36 + progress * 18, '255,173,99', .2 + progress * .1]);
        circle(ctx, e.x, e.y, Math.max(16, num(e.r, 34) * .68), 'rgba(17,14,28,.19)', 'rgba(255,221,171,.24)', 1);
      }
      return;
    }

    // In the shell and circuit stages the Keeper sends a three-shot volley.
    // Aim is supplied by the simulation only while telegraphing; the player-facing
    // fallback helps older or incomplete state snapshots without changing rules.
    if (open || attack !== 'telegraph' || (stage !== 1 && stage !== 2)) return;
    const player = s.player || {};
    let ax = num(e.aimX, num(player.x, e.x + 1) - e.x), ay = num(e.aimY, num(player.y, e.y) - e.y);
    const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
    const spread = stage === 1 ? .075 : .18;
    const distance = stage === 1 ? 250 : 230;
    const start = Math.max(20, num(e.r, 34) + 8);
    const rgb = stage === 1 ? '255,177,105' : '150,222,255';
    const locked = !!e.attackLocked;
    const strength = locked ? .86 : .58 + .08 * pulse;
    ctx.save(); ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const a = Math.atan2(ay, ax) + i * spread;
      const ux = Math.cos(a), uy = Math.sin(a), x1 = e.x + ux * start, y1 = e.y + uy * start;
      const x2 = e.x + ux * distance, y2 = e.y + uy * distance;
      ctx.setLineDash(locked ? [12, 7] : [7, 9]); ctx.lineDashOffset = -t * (locked ? 52 : 34);
      line(ctx, x1, y1, x2, y2, `rgba(${rgb},${strength * .28})`, i === 0 ? 8 : 5);
      line(ctx, x1, y1, x2, y2, `rgba(${rgb},${strength})`, i === 0 ? 2.5 : 1.65);
      if (stage === 1) {
        // Three close brass sight-lines read as a deliberate, returnable volley.
        const side = -uy * 4, sx = ux * 4;
        circle(ctx, x2, y2, i === 0 ? 5 : 3.5, null, `rgba(255,230,190,${strength})`, 1.35);
        if (i === 0) line(ctx, x2 - side, y2 + sx, x2 + side, y2 - sx, `rgba(255,239,211,${strength})`, 1.5);
      } else {
        // Wider cold fan marks the later circuit-stage volley and its endpoints.
        const px = -uy, py = ux;
        poly(ctx, [[x2 + ux * 7, y2 + uy * 7], [x2 + px * 5, y2 + py * 5],
          [x2 - ux * 7, y2 - uy * 7], [x2 - px * 5, y2 - py * 5]],
        `rgba(185,237,255,${strength * .2})`, `rgba(215,248,255,${strength})`, 1.2);
      }
    }
    if (locked) {
      const lx = e.x + ax * distance, ly = e.y + ay * distance;
      circle(ctx, lx, ly, 10 + Math.sin(t * 18) * 1.4, null, `rgba(${rgb},.9)`, 1.5);
    }
    ctx.restore();
  }
  function drawWeaverWarning(ctx, e, t) {
    const phase = e.phase || '';
    if (phase !== 'weave-telegraph' && phase !== 'weave-attack') return;
    const d = Math.hypot(num(e.aimX, 0), num(e.aimY, 0)) || 1;
    const dx = num(e.aimX, -1) / d, dy = num(e.aimY, 0) / d;
    const px = -dy, py = dx, telegraph = phase === 'weave-telegraph';
    const pulse = .72 + .18 * Math.sin(t * 11);
    ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash(telegraph ? [9, 8] : []); ctx.lineDashOffset = -t * 34;
    for (let i = -2; i <= 2; i++) {
      const lateral = i * 64, x1 = e.x + dx * 38 + px * lateral, y1 = e.y + dy * 38 + py * lateral;
      const x2 = x1 + dx * 286, y2 = y1 + dy * 286;
      if (telegraph) {
        line(ctx, x1, y1, x2, y2, `rgba(126,218,255,.68)`, 2.7);
      } else {
        // During the volley these are broken motion traces; the actual shards carry the danger.
        const center = i === 0, segments = center ? [[46, 72], [122, 146], [218, 244]] : [[52, 74], [216, 238]];
        for (const [from, to] of segments) {
          const ax = x1 + dx * from, ay = y1 + dy * from, bx = x1 + dx * to, by = y1 + dy * to;
          line(ctx, ax, ay, bx, by, `rgba(42,150,255,${(center ? .22 : .14) * pulse})`, center ? 7 : 5);
          line(ctx, ax, ay, bx, by, `rgba(126,218,255,${(center ? .58 : .4) * pulse})`, center ? 2.8 : 2.2);
        }
      }
      if (telegraph) {
        const gx = x1 + dx * 120, gy = y1 + dy * 120;
        if (i === 0) {
          glowQueue.push([gx, gy, 20, '132,225,255', .62]);
          circle(ctx, gx, gy, 12, 'rgba(45,142,191,.68)', '#f5ffff', 2);
          poly(ctx, [[gx - 13, gy], [gx - 4, gy - 10], [gx + 15, gy], [gx - 4, gy + 10]],
            '#c7f5ff', '#ffffff', 2);
          line(ctx, gx - 5, gy, gx + 8, gy, 'rgba(255,255,255,.95)', 1.6);
        } else {
          poly(ctx, [[gx + px * 4, gy + py * 4], [gx + dx * 6, gy + dy * 6], [gx - px * 4, gy - py * 4], [gx - dx * 4, gy - dy * 4]],
            'rgba(208,245,255,.16)', 'rgba(180,229,245,.38)', .8);
        }
      }
    }
    ctx.restore();
  }
  function drawWeaverCrown(ctx, e, t, exposed) {
    const palette = exposed ? ['#d4fff5', '#64eed3'] : ['#e6fcff', '#67bde0'];
    for (let i = 0; i < 5; i++) {
      const a = t * .42 + i * Math.PI * 2 / 5, x = e.x + Math.cos(a) * 39, y = e.y - 7 + Math.sin(a) * 31;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
      const shard = ctx.createLinearGradient(0, -12, 0, 11); shard.addColorStop(0, palette[0]); shard.addColorStop(.45, palette[1]); shard.addColorStop(1, 'rgba(28,72,105,.9)');
      poly(ctx, [[0, -12], [5, -3], [4, 6], [0, 11], [-4, 6], [-5, -3]], shard, 'rgba(223,250,255,.9)', 1.15);
      line(ctx, 0, -8, 0, 7, 'rgba(248,255,255,.58)', .8);
      ctx.restore();
      glowQueue.push([x, y, 13, exposed ? '145,255,226' : '142,220,255', .68]);
    }
  }
  function drawSentinel(ctx, e, s, t, width, height) {
    const hp = num(e.hp, 0);
    if (hp <= 0) { // toppled bell husk
      contactShadow(ctx, e.x + 3, e.y + 8, 30, 12, .85);
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
    const glassWeaver = /glass[-_ ]?weaver/i.test(String(e.id || ''));
    if (glassWeaver) loadWeaverSprite();
    const paintedWeaver = glassWeaver ? (weaverLitSprite || weaverSprite) : null;
    const weaverW = paintedWeaver && (paintedWeaver.naturalWidth || paintedWeaver.width);
    const weaverH = paintedWeaver && (paintedWeaver.naturalHeight || paintedWeaver.height);
    const useWeaverSprite = !!(weaverW > 0 && weaverH > 0);
    const bob = dormant ? 0 : Math.sin(t * 3) * 1.5;
    const eye = lunge ? RED : warn ? '255,180,120' : dormant ? '120,140,150' : '160,230,230';
    contactShadow(ctx, e.x + 4, e.y + 18, 32, 13, 1);
    ctx.save(); ctx.translate(e.x, e.y + bob); ctx.scale(SCALE_SENTINEL, SCALE_SENTINEL);
    if (lunge) circle(ctx, 0, -8, 36, null, '#ff977e', 3);
    if (useWeaverSprite) {
      const artH = 64, artW = artH * weaverW / weaverH;
      // The artwork's feet meet the existing ground anchor; the compact frame leaves room for the crown and threads.
      ctx.drawImage(paintedWeaver, 0, 0, weaverW, weaverH, -artW / 2, -40, artW, artH);
      if (exposed) {
        // Keep the exposed core readable over the sprite's amber chest crystal.
        circle(ctx, 0, -10, 9, 'rgba(4,25,24,.84)', 'rgba(201,255,238,.92)', 1.3);
        const core = ctx.createRadialGradient(0, -13, 1, 0, -10, 8);
        core.addColorStop(0, '#ffffff'); core.addColorStop(.55, '#b2ffdb'); core.addColorStop(1, '#3ad29a');
        poly(ctx, [[0, -18], [5, -10], [0, -2], [-5, -10]], core, 'rgba(229,255,245,.92)', .8);
      }
    } else {
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
    const bellPts = [[-11, -30], [11, -30], [16, -16], [20, 4], [24, 16], [-24, 16], [-20, 4], [-16, -16]];
    poly(ctx, bellPts, bg, '#0e1614', 2);
    ctx.save(); ctx.beginPath(); bellPts.forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])); ctx.closePath(); ctx.clip();
    const bellVolume = ctx.createLinearGradient(-20, -28, 22, 16);
    bellVolume.addColorStop(0, 'rgba(244,255,235,.2)'); bellVolume.addColorStop(.46, 'rgba(209,255,226,.015)'); bellVolume.addColorStop(1, 'rgba(0,7,5,.38)');
    ctx.fillStyle = bellVolume; ctx.fillRect(-25, -32, 52, 52); ctx.restore();
    line(ctx, -13, -26, -18, -12, 'rgba(229,255,236,.5)', 1.7);
    line(ctx, 20, -12, 24, 12, 'rgba(0,5,4,.7)', 2.2);
    if (glassWeaver) {
      // Flared bell shoulders break the emblem silhouette into a lit shell and recessed sides.
      const armor = ctx.createLinearGradient(-22, -29, 22, -10);
      armor.addColorStop(0, 'rgba(255,239,201,.42)'); armor.addColorStop(.38, 'rgba(145,211,184,.3)'); armor.addColorStop(1, 'rgba(4,20,25,.46)');
      poly(ctx, [[-17, -24], [-10, -29], [-5, -21], [-8, -12], [-18, -10], [-21, -16]], armor, 'rgba(11,31,30,.95)', 1.8);
      poly(ctx, [[17, -24], [10, -29], [5, -21], [8, -12], [18, -10], [21, -16]], armor, 'rgba(8,24,29,.95)', 1.8);
      line(ctx, -17, -23, -10, -27, 'rgba(255,248,224,.82)', 1.35);
      line(ctx, -10, -27, -5.8, -21, 'rgba(224,255,239,.54)', 1);
      line(ctx, -20, -15, -17, -10.8, 'rgba(0,8,13,.72)', 1.8);
      line(ctx, 17, -23, 10, -27, 'rgba(215,243,226,.48)', 1.2);
      line(ctx, 20, -15, 17, -10.8, 'rgba(0,8,13,.78)', 1.8);
    }
    ellipse(ctx, 0, 16, 24, 6, '#1c2a26', '#0e1614', 1.6);
    line(ctx, -19, 2, 19, 2, 'rgba(10,20,18,.55)', 2); line(ctx, -17, -2, 17, -2, 'rgba(200,240,220,.25)', 1);
    for (let i = 0; i < 5; i++) circle(ctx, -14 + i * 7, 9, 1.6, '#c8a860');
    // stone mask with glowing eye slit
    poly(ctx, [[-10, -30], [10, -30], [12, -22], [8, -14], [-8, -14], [-12, -22]], '#a8a894', '#1a1e1a', 1.6);
    line(ctx, -7, -22, 7, -22, '#10161a', 4.5);
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
    }
    ctx.restore();
    if (glassWeaver) { drawWeaverWarning(ctx, e, t); drawWeaverCrown(ctx, e, t, exposed); }
    if (!dormant) glowQueue.push([e.x, e.y + (bob - 22) * SCALE_SENTINEL, 22, eye, .7]);
    if (exposed) glowQueue.push([e.x, e.y + bob, 64, MINT, .6]);
    // health bar
    const landscapeWeaver = glassWeaver && width <= 1000 && height <= 480;
    const cardY = landscapeWeaver ? e.y + 42 : e.y - 58;
    const maxHp = num(e.maxHp, hp) || 1;
    ctx.fillStyle = 'rgba(6,14,18,.85)'; rrect(ctx, e.x - 30, cardY, 60, 7, 3); ctx.fill();
    ctx.fillStyle = exposed ? '#8ff2ce' : '#eda984'; rrect(ctx, e.x - 29, cardY + 1, 58 * clamp(hp / maxHp, 0, 1), 5, 2.5); ctx.fill();
    labels.push({ x: e.x, y: landscapeWeaver ? e.y + 59 : e.y - 70, text: exposed ? 'ARMOR OPEN — STRIKE' : lunge ? 'DODGE • UNBLOCKABLE' : glassWeaver && e.phase === 'weave-telegraph' ? 'GLASS THREADS' : warn ? 'RETURN THE SHOT' : sentinelName(e), color: exposed ? '#8ff2ce' : lunge ? '#ffb79c' : glassWeaver && e.phase === 'weave-telegraph' ? '#c8f0ff' : '#e5d7bd', size: 10 });
  }
  function crownPrism(ctx, x, y, a, fill, edge, size) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const h = size || 1;
    poly(ctx, [[0, -12 * h], [7 * h, -3 * h], [5 * h, 7 * h], [0, 12 * h], [-5 * h, 7 * h], [-7 * h, -3 * h]], fill, edge, 1.35);
    line(ctx, 0, -8 * h, 0, 7 * h, 'rgba(255,255,255,.58)', 1);
    line(ctx, -4 * h, -2 * h, 0, -8 * h, 'rgba(255,255,255,.44)', .8);
    ctx.restore();
  }
  function drawCrown(ctx, e, s, t, width, height) {
    const hp = num(e.hp, 0), stage = crownStage(e), form = stage || 1;
    const open = crownExposed(e), phase = String(e.phase || '').toLowerCase();
    const attack = String(e.attackPhase || '').toLowerCase();
    const dead = hp <= 0 || phase === 'defeated';
    const size = clamp(num(e.r, 34) / 34, .9, 1.28);
    const telegraph = !open && ((stage < 3 && attack === 'telegraph') || phase === 'eclipse-windup');
    const hot = form === 1 ? '#e9bd68' : form === 2 ? '#83d4e9' : '#ffc17b';
    const edge = form === 1 ? '#fff0bc' : form === 2 ? '#dcf7ff' : '#ffe5bc';
    const core = open ? '#b9ffe4' : (form === 1 ? '#f08a59' : form === 2 ? '#bba6ff' : '#ff9d66');
    const dark = '#101a27';
    const bob = dead ? 0 : (telegraph ? Math.sin(t * 13) * 1.2 : Math.sin(t * 2.2) * .7);

    contactShadow(ctx, e.x + 3, e.y + 13, 38 * size, 15 * size, .94);
    if (dead) {
      ctx.save(); ctx.translate(e.x, e.y + 4); ctx.rotate(.48);
      circle(ctx, 0, 0, 25 * size, '#1a2430', '#080d14', 2);
      poly(ctx, [[-5, -24], [5, -21], [17, -9], [12, 4], [0, 14], [-15, 7], [-19, -5]], '#3a4650', '#111a21', 1.5);
      line(ctx, -13, -12, 12, 10, '#b68e64', 2); line(ctx, 10, -15, -10, 12, '#586674', 1.4);
      ctx.restore();
      return;
    }

    ctx.save(); ctx.translate(e.x, e.y + bob); ctx.scale(size, size);
    const aura = ctx.createRadialGradient(0, -4, 2, 0, -4, 60);
    aura.addColorStop(0, open ? 'rgba(137,255,213,.3)' : form === 2 ? 'rgba(120,195,255,.22)' : form === 3 ? 'rgba(255,166,99,.2)' : 'rgba(255,192,111,.22)');
    aura.addColorStop(.5, open ? 'rgba(104,238,193,.12)' : 'rgba(126,170,224,.08)');
    aura.addColorStop(1, 'rgba(100,150,220,0)');
    ellipse(ctx, 0, -4, 60, 47, aura);
    // A low dark disk grounds all three forms while keeping the player silhouette clear.
    circle(ctx, 0, 1, form === 3 ? 27 : 31, 'rgba(7,13,22,.88)', 'rgba(5,10,18,.95)', 2.2);
    ellipse(ctx, 0, 6, 24, 13, 'rgba(0,4,10,.42)');

    if (form === 1) {
      // Stage one reads as a sealed, heavy brass shell: broad shoulders and a
      // crenellated crown make the armored silhouette distinct at gameplay scale.
      const shell = ctx.createLinearGradient(-28, -32, 26, 28);
      shell.addColorStop(0, '#fff0b2'); shell.addColorStop(.22, '#c69a54'); shell.addColorStop(.55, '#755534'); shell.addColorStop(1, '#2a2630');
      poly(ctx, [[0, -39], [12, -31], [28, -30], [24, -18], [35, -7], [27, 2], [31, 16], [13, 21], [0, 29], [-13, 21], [-31, 16], [-27, 2], [-35, -7], [-24, -18], [-28, -30], [-12, -31]], shell, '#1a1b22', 2.2);
      poly(ctx, [[0, -33], [8, -25], [22, -23], [18, -11], [25, -3], [18, 8], [10, 15], [0, 20], [-10, 15], [-18, 8], [-25, -3], [-18, -11], [-22, -23], [-8, -25]], 'rgba(29,34,39,.92)', 'rgba(255,229,170,.72)', 1.2);
      poly(ctx, [[-22, -20], [-8, -27], [-4, -15], [-11, -6], [-24, -5], [-28, -11]], '#8b693f', '#f0d594', 1.15);
      poly(ctx, [[22, -20], [8, -27], [4, -15], [11, -6], [24, -5], [28, -11]], '#604f3d', '#e1c17f', 1.15);
      line(ctx, -23, -18, -11, -24, 'rgba(255,245,208,.8)', 1.5);
      line(ctx, 23, -18, 11, -24, 'rgba(255,245,208,.5)', 1.1);
      // Returned artillery exposes the seam, so keep a readable vertical armor split.
      line(ctx, 0, -24, 0, 15, open ? 'rgba(190,255,228,.92)' : 'rgba(10,15,20,.84)', open ? 2.4 : 2);
      poly(ctx, [[0, -13], [10, -1], [0, 12], [-10, -1]], open ? '#8bf0ca' : '#bd7648', edge, 1.35);
      line(ctx, -5, -2, 0, -9, 'rgba(255,248,222,.7)', 1);
    } else if (form === 2) {
      // Stage two sheds the shell into four separated circuit keys around a
      // recessed center; the open gaps keep this ring unlike stage one's armor.
      ctx.save(); ctx.rotate(-.18);
      ctx.setLineDash([4, 7]); ctx.lineDashOffset = -t * 10;
      circle(ctx, 0, -2, 32, null, 'rgba(131,220,245,.44)', 1.5);
      ctx.setLineDash([]); ctx.restore();
      const orbit = .10 * Math.sin(t * 1.2);
      const keys = [[0, -32], [32, -1], [0, 29], [-32, -1]];
      for (let i = 0; i < keys.length; i++) {
        const [kx, ky] = keys[i];
        const pulse = .84 + .16 * Math.sin(t * 4 + i * 1.5);
        ctx.save(); ctx.translate(kx, ky); ctx.rotate((i % 2 ? .28 : -.28) + orbit * (i % 2 ? 1 : -1));
        rrect(ctx, -8, -10, 16, 20, 3); ctx.fillStyle = i % 2 ? '#1d3445' : '#233b4c'; ctx.fill();
        ctx.strokeStyle = `rgba(183,238,255,${pulse})`; ctx.lineWidth = 1.5; ctx.stroke();
        line(ctx, -3, -5, 3, 5, '#b7f2ff', 1.4); line(ctx, 3, -5, -3, 5, 'rgba(228,250,255,.56)', 1);
        ctx.restore();
      }
      poly(ctx, [[0, -22], [17, -3], [10, 16], [0, 23], [-10, 16], [-17, -3]], '#1b283a', '#607f9c', 1.8);
      poly(ctx, [[0, -15], [8, -2], [0, 12], [-8, -2]], open ? '#94f4d6' : '#806bbb', edge, 1.3);
      line(ctx, -13, -2, -7, -2, 'rgba(174,230,255,.76)', 1.25);
      line(ctx, 7, -2, 13, -2, 'rgba(174,230,255,.76)', 1.25);
    } else {
      // Stage three is lighter and asymmetric: three orbiting prisms frame an
      // exposed eclipse core instead of another closed armored body.
      const orbitAngle = t * .58;
      ctx.save(); ctx.rotate(orbitAngle * .35);
      ctx.setLineDash([3, 8]); ctx.lineDashOffset = -t * 15;
      circle(ctx, 0, -2, 36, null, 'rgba(255,201,141,.5)', 1.4);
      ctx.setLineDash([]); ctx.restore();
      const shards = 3;
      for (let i = 0; i < shards; i++) {
        const a = orbitAngle + i * TAU / shards - Math.PI / 2;
        const radius = 33 + Math.sin(t * 3 + i * 2) * 2;
        const sx = Math.cos(a) * radius, sy = Math.sin(a) * radius - 2;
        crownPrism(ctx, sx, sy, a + Math.PI / 2, i === 1 ? '#c18452' : '#594760', edge, 1.05);
        glowQueue.push([e.x + sx * size, e.y + sy * size + bob, 9, open ? '150,255,220' : '255,184,120', .32]);
      }
      circle(ctx, 0, -2, 22, '#131624', '#574b5c', 1.8);
      circle(ctx, 0, -3, 16, open ? 'rgba(129,242,201,.24)' : 'rgba(233,126,80,.16)', open ? '#a7ffdf' : '#ffca8b', 1.5);
      poly(ctx, [[0, -17], [8, -4], [0, 10], [-8, -4]], open ? '#a0f7d6' : '#dc8658', edge, 1.4);
      line(ctx, 0, -12, 0, 7, 'rgba(255,255,255,.65)', 1);
    }

    // Thin reflected rims keep each silhouette legible against the dark floor.
    if (open) {
      circle(ctx, 0, -3, form === 3 ? 21 : 15, null, 'rgba(175,255,225,.76)', 1.45);
    } else if (telegraph) {
      circle(ctx, 0, -3, 37, null, `rgba(${form === 2 ? '151,222,255' : '255,182,111'},${.48 + .15 * Math.sin(t * 15)})`, 1.6);
    }
    ctx.restore();

    glowQueue.push([e.x, e.y - 8, form === 3 ? 26 : 22, open ? '139,255,213' : form === 2 ? '119,203,245' : '255,189,111', open ? .68 : .42]);
    if (open) glowQueue.push([e.x, e.y - 3, 52, '145,255,220', .44]);

    const status = open ? 'CORE OPEN · STRIKE' :
      stage === 1 ? (attack === 'telegraph' ? 'THREE SHOTS · DODGE' : 'RETURN ARTILLERY · STRIKE') :
      stage === 2 ? (attack === 'telegraph' ? 'THREE SHOTS · DODGE' : 'LIGHT BOTH CIRCUITS') :
      phase === 'eclipse-windup' ? 'BURST THROUGH THE RING' : 'ECLIPSE KEEPER';
    const statusColor = open ? '#9ff5d2' : telegraph ? '#ffd4a6' : form === 2 ? '#c3f1ff' : '#f1d7ad';
    labels.push({ x: e.x, y: e.y - 57, text: status, color: statusColor, size: 10 });
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
      contactShadow(ctx, e.x + 4, e.y + 12, 40, 16, .85);
      ellipse(ctx, e.x, e.y, 30, 24, '#5a4a30', '#1a1206', 2); circle(ctx, e.x - 8, e.y - 4, 7, '#1a2226', '#c8a060', 2);
      return;
    }
    if (st.submerged) return;
    const rise = st.surfacing ? clamp(1 - num(e.timer, .4) / .8, 0, 1) : st.diving ? clamp(num(e.timer, .3) / .6, 0, 1) : 1;
    const bob = Math.sin(t * 2.2) * 2;
    ctx.save(); ctx.globalAlpha = .35 + .65 * rise;
    contactShadow(ctx, e.x + 5, e.y + 22, 46, 16, .9 * rise);
    ctx.translate(e.x, e.y + bob + (1 - rise) * 16); ctx.scale(SCALE_DIVER, SCALE_DIVER);
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
    contactShadow(ctx, 1, 11, 11, 4.5, .85);
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
    if (r.flag && r.flag !== 'ilex') { drawFerrymen(ctx, r, s, t); return; }
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
    contactShadow(ctx, p.x, p.y + 10, 10 - bob * .5, 4, .75);
    ctx.save(); ctx.translate(p.x, p.y - 8 + bob);
    if (p.kind === 'stored-light') {
      circle(ctx, 0, 0, 18, '#2b355c', '#ccbfe7', 2);
      poly(ctx, [[0, -15], [9, 0], [0, 15], [-9, 0]], '#e1f9ff', '#9ce2ff', 2);
      line(ctx, -21, 0, -15, 0, '#dff7ff', 2); line(ctx, 15, 0, 21, 0, '#dff7ff', 2);
      ctx.restore(); glowQueue.push([p.x, p.y - 8 + bob, 55, COOL, .65]);
    } else if (p.kind === 'heart') {
      const hg = ctx.createLinearGradient(-10, -10, 10, 10); hg.addColorStop(0, '#ffb0b8'); hg.addColorStop(.5, '#e83a5a'); hg.addColorStop(1, '#7a1028');
      ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-14, -1, -9, -13, 0, -5); ctx.bezierCurveTo(9, -13, 14, -1, 0, 9); ctx.closePath();
      ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = '#2a0610'; ctx.lineWidth = 1.8; ctx.stroke();
      line(ctx, -6, -4, -3, -6, 'rgba(255,255,255,.85)', 1.6);
      ctx.restore(); glowQueue.push([p.x, p.y - 8 + bob, 34, '255,110,130', .55]);
    } else if (p.kind === 'prism') {
      ctx.restore();
      drawPrismCrystal(ctx, p.x, p.y - 12 + bob, 1.3, t);
      glowQueue.push([p.x, p.y - 12 + bob, 60, PRISM, .75], [p.x, p.y - 14 + bob, 16, '255,255,255', .8]);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const q = i * TAU / 6 + t * .6; line(ctx, p.x + Math.cos(q) * 20, p.y - 12 + bob + Math.sin(q) * 20, p.x + Math.cos(q) * 34, p.y - 12 + bob + Math.sin(q) * 34, `rgba(${PRISM},.35)`, 2); }
      ctx.restore();
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
    if (pl && Math.hypot(pl.x - p.x, pl.y - p.y) < 150) labels.push({ x: p.x, y: p.y + 22, text: (p.kind === 'stored-light' ? 'Stored light' : p.kind === 'prism' ? 'Sun prism' : p.text || (p.kind === 'heart' ? 'Heart vessel' : 'Keeper chart')).toUpperCase(), color: p.kind === 'prism' ? '#ffd2f0' : '#f6e6bc', size: 9 });
  }
  function beaconLit(s) { return !!(s.beacon && (s.beacon.lit || s.status === 'won')); }
  function beaconReady(s) {
    const req = arr(s.beacon && s.beacon.requires);
    return req.every(id => { const e = arr(s.enemies).find(x => x.id === id); return !e || num(e.hp, 0) <= 0; });
  }
  function drawBeacon(ctx, s, t) {
    const b = s.beacon, lit = beaconLit(s), ready = beaconReady(s);
    ctx.save(); ctx.translate(b.x, b.y);
    contactShadow(ctx, 3, 12, 34, 14, .9);
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
    } else labels.push({ x: b.x, y: b.y + 34, text: beaconName(s), color: '#c8d0d8', size: 10, dim: true });
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
    contactShadow(ctx, 1, 12, 11, 4.5, 1);
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
    if (facingUp) loadSeraSprite();
    if (facingUp && seraSprite) {
      // The authored north-facing sprite shares the vector pose's foot anchor and modest silhouette.
      if (!slashing) drawSword();
      const paintedSprite = seraLitSprite || seraSprite;
      const iw = paintedSprite.naturalWidth || paintedSprite.width, ih = paintedSprite.naturalHeight || paintedSprite.height;
      if (iw > 0 && ih > 0) ctx.drawImage(paintedSprite, 0, 0, iw, ih, -24.15, -41.1, 48.3, 58);
      if (p.reflecting) {
        // The painted bronze mirror remains visible; this inlay carries its live reflection state.
        ellipse(ctx, -10.8, -11, 2.3, 6.1, 'rgba(116,255,231,.45)', 'rgba(236,255,249,.95)', 1.2);
        line(ctx, -11.6, -13.5, -10.2, -16, 'rgba(255,255,255,.95)', 1.1);
        poly(ctx, [[-10.8, -12.5], [-9.9, -11], [-10.8, -9.5], [-11.7, -11]], '#fff8d9');
      }
      if (slashing) drawSword();
    } else {
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
    const tunicPts = [[-7.5, -10], [7.5, -10], [9, 6], [0, 8], [-9, 6]];
    poly(ctx, tunicPts, tg, INK, 1.7);
    // Broad, clipped upper-left key and quiet far-side falloff give the small coat a rounder read.
    ctx.save(); ctx.beginPath(); tunicPts.forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])); ctx.closePath(); ctx.clip();
    const tunicVolume = ctx.createLinearGradient(-9, -10, 9, 8);
    tunicVolume.addColorStop(0, 'rgba(227,255,239,.34)'); tunicVolume.addColorStop(.38, 'rgba(203,255,243,.06)'); tunicVolume.addColorStop(1, 'rgba(0,13,22,.34)');
    ctx.fillStyle = tunicVolume; ctx.fillRect(-10, -11, 20, 20); ctx.restore();
    line(ctx, -7.1, -8.6, -8, 4.8, 'rgba(221,255,239,.42)', 1.2);
    line(ctx, 8, -6, 8.5, 5.3, 'rgba(0,13,18,.52)', 1.4);
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
    }
    ctx.restore();
    const H = SCALE_HERO;
    if (p.prism === 'carried') { // the sun prism rides at Sera's shoulder
      const cx = p.x - ax * 10 * H + 12, cy = p.y - 34 * H + Math.sin(t * 3) * 1.5;
      drawPrismCrystal(ctx, cx, cy, .62, t);
      glowQueue.push([cx, cy, 22, PRISM, .6]);
    }
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

  // ---------------------------------------------------------------- Region 2 entities (Verdant Aqueduct)
  const PRISM = '255,128,214', JADE = '120,255,200', EMBER = '255,150,70';
  function unitOr(x, y, fx, fy) { const L = Math.hypot(x, y); return L > 1e-6 ? [x / L, y / L] : [fx, fy]; }
  function verdantSurface(ctx, z, t) {
    // Lily pads drifting on their moorings plus slow flow streaks.
    const rng = rngFor(hashStr(String(z.id || '') + z.x + ',' + z.y));
    const n = Math.min(10, Math.floor(z.w * z.h / 7000));
    for (let i = 0; i < n; i++) {
      const bx = z.x + 14 + rng() * (z.w - 28), by = z.y + 14 + rng() * (z.h - 28), r = 6 + rng() * 6, rot = rng() * TAU;
      const x = bx + Math.sin(t * .5 + i) * 2, y = by + Math.cos(t * .4 + i * 1.7) * 1.5;
      ellipse(ctx, x + 1.5, y + 2, r, r * .8, 'rgba(0,20,10,.35)');
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, rot + .35, rot + TAU - .1); ctx.closePath();
      ctx.fillStyle = hsl(100 + i * 7 % 30, 45, 30 + (i % 3) * 5); ctx.fill(); ctx.strokeStyle = 'rgba(10,30,10,.6)'; ctx.lineWidth = 1; ctx.stroke();
      line(ctx, x, y, x + Math.cos(rot + 2) * r * .8, y + Math.sin(rot + 2) * r * .8, 'rgba(200,240,160,.35)', 1);
      if (i % 4 === 1) { circle(ctx, x + 2, y - 2, 2.6, '#f7e8f0', '#b07090', .8); circle(ctx, x + 2, y - 2, 1, '#f0d060'); }
    }
    const horiz = z.w >= z.h, L = horiz ? z.w : z.h, D = horiz ? z.h : z.w;
    for (let i = 0; i < L * D / 2600; i++) {
      const u = ((i * 131.7 + t * 22) % L), v = (i * 53.3) % D, len = 10 + (i % 4) * 5;
      const a = .12 + .1 * Math.sin(t * 1.3 + i);
      if (horiz) line(ctx, z.x + u, z.y + v, z.x + u + len, z.y + v + Math.sin(i) * 1.5, `rgba(210,255,235,${a})`, 1.2);
      else line(ctx, z.x + v, z.y + u, z.x + v + Math.sin(i) * 1.5, z.y + u + len, `rgba(210,255,235,${a})`, 1.2);
    }
  }

  // Root bridges: living decks that sag, darken and finally sink under load.
  function drawBridges(ctx, s, t, th) {
    for (const b of arr(s.bridges).filter(finiteRect)) {
      const load = clamp(num(b.load, 0), 0, 1), sunk = !!b.sunk, horiz = b.w >= b.h;
      const L = horiz ? b.w : b.h, D = horiz ? b.h : b.w;
      ctx.save();
      if (horiz) ctx.translate(b.x, b.y); else { ctx.translate(b.x + b.w, b.y); ctx.rotate(Math.PI / 2); }
      const shake = !sunk && load > .7 ? Math.sin(t * 50) * (load - .7) * 3 : 0;
      const sagY = (u) => horiz && !sunk ? Math.sin(Math.PI * u / L) * load * 9 : 0;
      if (sunk) ctx.globalAlpha = .45;
      // water shadow under the deck
      ctx.fillStyle = 'rgba(0,14,8,.45)'; ctx.fillRect(4, 6, L - 8, D);
      const slatW = 9, n = Math.ceil(L / slatW);
      for (let i = 0; i < n; i++) {
        const u = i * slatW, f = Math.sin(Math.PI * (u + slatW / 2) / L) * load;
        const inset = D * .1 * f, dy = sagY(u + slatW / 2) + shake;
        const lgt = sunk ? 16 : 38 - f * 24 + ((i * 7) % 5) - 2;
        ctx.fillStyle = hsl(28 + (i * 13) % 10, 34, lgt);
        ctx.fillRect(u + .8, 2 + inset + dy, slatW - 1.6, D - 4 - inset * 2);
        ctx.fillStyle = `rgba(255,230,190,${sunk ? .04 : .16 - f * .1})`; ctx.fillRect(u + .8, 2 + inset + dy, slatW - 1.6, 2);
        ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(u + slatW - 2.2, 2 + inset + dy, 1.4, D - 4 - inset * 2);
      }
      if (!sunk && load > .45) { // water lapping over the sagging middle
        const a = (load - .45) * .9, gw = ctx.createLinearGradient(0, 0, L, 0);
        gw.addColorStop(0, `hsla(${th.water[0]},${th.water[1]}%,${th.water[2] + 6}%,0)`); gw.addColorStop(.5, `hsla(${th.water[0]},${th.water[1]}%,${th.water[2] + 6}%,${a})`); gw.addColorStop(1, `hsla(${th.water[0]},${th.water[1]}%,${th.water[2] + 6}%,0)`);
        ctx.fillStyle = gw; ctx.fillRect(0, 0, L, D);
      }
      // two braided root cables along the edges
      for (const edge of [3, D - 3]) {
        for (const [col, wdt, off] of [['#1e1208', 6, 1], ['#4a301a', 4, 0], ['rgba(210,170,120,.35)', 1.2, -1]]) {
          ctx.beginPath();
          for (let u = 0; u <= L; u += 8) { const y = edge + sagY(u) + shake + off + Math.sin(u * .25) * 1.2 * (edge < D / 2 ? 1 : -1); u ? ctx.lineTo(u, y) : ctx.moveTo(u, y); }
          ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.stroke();
        }
      }
      // sprouting leaves along the cables
      for (let u = 10; u < L - 6; u += 23) {
        const e2 = (u / 23 | 0) % 2 ? 2 : D - 2;
        ellipse(ctx, u, e2 + sagY(u), 3.4, 2, sunk ? 'rgba(80,120,70,.6)' : hsl(100, 50, 32 + (u % 3) * 4), null, 0, u);
      }
      // anchor knots at both ends
      for (const u of [0, L]) for (const v of [3, D - 3]) { // root knots gripping the banks
        const dir = u ? 1 : -1;
        for (let r = 0; r < 3; r++) { ctx.beginPath(); ctx.moveTo(u, v); ctx.quadraticCurveTo(u + dir * 6, v + (r - 1) * 5, u + dir * (9 + r * 3), v + (r - 1) * 8); ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 3; ctx.stroke(); }
        circle(ctx, u, v, 5.5, '#4a301a', '#140a04', 1.4); circle(ctx, u - 1.5, v - 1.5, 2, 'rgba(210,170,120,.35)');
      }
      ctx.globalAlpha = 1;
      if (!sunk && load > .25) { // ripples pushed out from the sagging middle
        for (let k = 0; k < 2; k++) {
          const ph = (t * 1.6 + k / 2) % 1;
          for (const side of [-1, 1]) {
            ctx.beginPath(); ctx.ellipse(L / 2, side < 0 ? 0 : D, L * (.18 + ph * .22) * load, 5 + ph * 8, 0, side < 0 ? Math.PI : 0, side < 0 ? TAU : Math.PI);
            ctx.strokeStyle = `rgba(210,255,235,${.55 * (1 - ph) * load})`; ctx.lineWidth = 1.5; ctx.stroke();
          }
        }
      }
      if (!sunk && load > .6) { // danger rim: about to go under
        const a = (load - .6) / .4 * (.55 + .45 * Math.sin(t * 18));
        ctx.strokeStyle = `rgba(255,170,90,${a})`; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]); ctx.lineDashOffset = t * 30;
        ctx.strokeRect(1, 1, L - 2, D - 2); ctx.setLineDash([]);
      }
      if (sunk) { // water washing over the drowned deck
        const [wh, ws, wl] = th.water;
        ctx.fillStyle = hsl(wh, ws, wl + 4, .45); ctx.fillRect(0, 0, L, D);
        for (let i = 0; i < 6; i++) { const ph = (t * .9 + i / 6) % 1; circle(ctx, (i * 53 + 17) % L, D * (.2 + (i * .37) % .6) - ph * 4, 1.4 + ph * 2, null, `rgba(220,255,240,${.7 * (1 - ph)})`, 1); }
        ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 10; ctx.strokeStyle = 'rgba(210,255,235,.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(2, 2, L - 4, D - 4); ctx.setLineDash([]);
      }
      ctx.restore();
      if (sunk) labels.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, text: 'SUNK', color: '#bff5e0', size: 10, dim: true });
    }
  }

  // Brambles: cached sprites (alive mass / cut stumps) so the thorns cost one drawImage.
  const bramCache = new Map();
  function brambleSprite(w, h, seed, cut) {
    const key = w + 'x' + h + ':' + seed + ':' + (cut ? 1 : 0);
    let c = bramCache.get(key);
    if (c) return c;
    const P = 14;
    c = makeCanvas((w + P * 2) * 2, (h + P * 2) * 2); const g = c.getContext('2d'); g.scale(2, 2); g.translate(P, P);
    const rng = rngFor(seed);
    if (!cut) {
      // Chunky lobed thicket: dark outline, three-tone lobes, a few bold thorned canes.
      const lobes = [];
      const step = 20;
      for (let y = 8; y < h - 2; y += step) for (let x = 8; x < w - 2; x += step) lobes.push([Math.min(w - 6, x + (rng() - .5) * 8), Math.min(h - 6, y + (rng() - .5) * 8), 11 + rng() * 7]);
      for (const [x, y, r] of lobes) circle(g, x, y + 2, r + 3, '#0a0806');
      for (const [x, y, r] of lobes) circle(g, x, y, r, '#1c3414');
      for (const [x, y, r] of lobes) circle(g, x - r * .18, y - r * .22, r * .78, '#2e5222');
      for (const [x, y, r] of lobes) { circle(g, x - r * .35, y - r * .42, r * .38, '#4e7a32'); ellipse(g, x - r * .45, y - r * .52, r * .16, r * .09, '#8ab85a', null, 0, -.6); }
      const canes = Math.max(3, Math.round(w * h / 1100));
      for (let i = 0; i < canes; i++) {
        const x0 = rng() * w, y0 = h * (.5 + rng() * .5), x1 = rng() * w, y1 = rng() * h * .5, cx = (x0 + x1) / 2 + (rng() - .5) * 30, cy = Math.min(y0, y1) - 10 - rng() * 14;
        const path = () => { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); };
        path(); g.strokeStyle = '#140608'; g.lineWidth = 5.5; g.lineCap = 'round'; g.stroke();
        path(); g.strokeStyle = '#7a2a3a'; g.lineWidth = 3; g.stroke();
        path(); g.strokeStyle = 'rgba(255,190,200,.35)'; g.lineWidth = 1; g.stroke(); g.lineCap = 'butt';
        for (let q = .12; q < .95; q += .16) {
          const it = 1 - q, px = it * it * x0 + 2 * it * q * cx + q * q * x1, py = it * it * y0 + 2 * it * q * cy + q * q * y1;
          const tx = 2 * it * (cx - x0) + 2 * q * (x1 - cx), ty = 2 * it * (cy - y0) + 2 * q * (y1 - cy), tl = Math.hypot(tx, ty) || 1;
          const sd = (q * 7 | 0) % 2 ? 1 : -1, nx = -ty / tl * sd, ny = tx / tl * sd, ux = tx / tl, uy = ty / tl;
          poly(g, [[px - ux * 2.4, py - uy * 2.4], [px + nx * 7 + ux * 2, py + ny * 7 + uy * 2], [px + ux * 2.4, py + uy * 2.4]], '#f0e2c0', '#140608', 1);
        }
      }
      for (let i = 0; i < Math.max(2, Math.round(w * h / 1600)); i++) { const x = 6 + rng() * (w - 12), y = 6 + rng() * (h - 12); circle(g, x, y, 3, '#c42040', '#2a0610', 1); circle(g, x - 1, y - 1, 1, '#ffd8e0'); }
      for (let i = 0; i < (w + h) / 9; i++) { // bold rim spikes
        const u = rng(), side = Math.floor(rng() * 4);
        const x = side % 2 ? (side === 1 ? w + 2 : -2) : u * w, y = side % 2 ? u * h : (side === 0 ? -2 : h + 2);
        const ox = side === 1 ? 1 : side === 3 ? -1 : 0, oy = side === 0 ? -1 : side === 2 ? 1 : 0, L = 6 + rng() * 5;
        poly(g, [[x - oy * 3, y - ox * 3], [x + ox * L, y + oy * L], [x + oy * 3, y + ox * 3]], '#e8d8b4', '#140608', 1);
      }
    } else {
      g.fillStyle = 'rgba(30,20,10,.35)'; g.fillRect(-2, -2, w + 4, h + 4);
      for (let i = 0; i < w * h / 150; i++) { // clippings
        const x = rng() * w, y = rng() * h, a = rng() * TAU;
        line(g, x, y, x + Math.cos(a) * 6, y + Math.sin(a) * 6, hsl(340, 24, 26), 1.4);
        if (rng() < .5) ellipse(g, x, y, 2.4, 1.3, hsl(80 + rng() * 30, 30, 22), null, 0, a);
      }
      for (let i = 0; i < Math.max(3, w * h / 420); i++) { // cut stems
        const x = 4 + rng() * (w - 8), y = 4 + rng() * (h - 8);
        ellipse(g, x + 1, y + 2, 4.5, 2.4, 'rgba(0,0,0,.4)');
        g.fillStyle = '#3a1a1c'; g.fillRect(x - 2.4, y - 5, 4.8, 5);
        ellipse(g, x, y - 5, 2.6, 1.5, '#e8d8b0', '#3a1a1c', .8);
      }
    }
    bramCache.set(key, c);
    if (bramCache.size > 40) bramCache.delete(bramCache.keys().next().value);
    return c;
  }
  function drawGrowth(ctx, gr, s, t) {
    const seed = hashStr(String(gr.id || '') + gr.x + ',' + gr.y), P = 14;
    const alive = gr.alive !== false, timer = num(gr.timer, 0), regrow = num(gr.regrow, 5);
    const sprite = c => hasDoc && ctx.drawImage(brambleSprite(Math.round(gr.w), Math.round(gr.h), seed, c), gr.x - P, gr.y - P, gr.w + P * 2, gr.h + P * 2);
    if (alive) {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; rrect(ctx, gr.x + 3, gr.y + 8, gr.w, gr.h, 10); ctx.fill();
      sprite(false);
      return;
    }
    sprite(true);
    if (regrow > 0 && timer < 1) { // regrowing: shoots climb back, outline pulses
      const q = clamp(1 - timer, 0, 1), pulse = .5 + .5 * Math.sin(t * 16);
      ctx.save(); ctx.globalAlpha = .25 + .45 * q;
      ctx.beginPath(); ctx.rect(gr.x - P, gr.y + gr.h - (gr.h + P * 2) * q, gr.w + P * 2, (gr.h + P * 2) * q + P); ctx.clip();
      sprite(false); ctx.restore();
      ctx.save(); ctx.setLineDash([7, 5]); ctx.lineDashOffset = t * 30;
      ctx.strokeStyle = `rgba(255,140,90,${.5 + .5 * pulse})`; ctx.lineWidth = 2.5; rrect(ctx, gr.x - 3, gr.y - 3, gr.w + 6, gr.h + 6, 8); ctx.stroke(); ctx.restore();
      labels.push({ x: gr.x + gr.w / 2, y: gr.y + gr.h / 2, text: gr.held ? 'HELD BACK' : 'REGROWING', color: '#ffb48a', size: 10 });
    } else if (regrow > 0 && Number.isFinite(timer) && timer > 0) {
      const cx = gr.x + gr.w / 2, cy = gr.y + gr.h / 2, f = clamp(timer / regrow, 0, 1);
      circle(ctx, cx, cy, 8, 'rgba(10,20,12,.6)');
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 7, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.closePath(); ctx.fillStyle = 'rgba(190,240,170,.7)'; ctx.fill();
    }
  }

  function drawLever(ctx, l, s, t) {
    const pulled = !!l.pulled, x = l.x, y = l.y;
    ellipse(ctx, x + 3, y + 10, 20, 8, 'rgba(0,0,0,.45)');
    // stone plinth
    rrect(ctx, x - 16, y - 4, 32, 14, 3); ctx.fillStyle = '#4a4232'; ctx.fill(); ctx.strokeStyle = '#140e06'; ctx.lineWidth = 1.4; ctx.stroke();
    rrect(ctx, x - 16, y - 10, 32, 10, 3); ctx.fillStyle = '#8a7a5a'; ctx.fill(); ctx.strokeStyle = '#140e06'; ctx.lineWidth = 1.4; ctx.stroke();
    line(ctx, x - 14, y - 9, x + 14, y - 9, 'rgba(255,245,215,.35)', 1);
    rrect(ctx, x - 10, y - 7, 20, 4, 2); ctx.fillStyle = '#140e06'; ctx.fill();
    mossClump(ctx, x - 12, y + 6, 4, rngFor(hashStr(String(l.id || x))), .7);
    // handle
    const ang = pulled ? .8 : -.8, hx = x + Math.sin(ang) * 26, hy = y - 6 - Math.cos(ang) * 26;
    line(ctx, x, y - 5, hx, hy, '#140a04', 5.5); line(ctx, x, y - 5, hx, hy, '#7a5230', 3.2); line(ctx, x - 1, y - 6, hx - 1, hy, 'rgba(255,220,170,.35)', 1);
    circle(ctx, x, y - 5, 3.6, '#b08a4a', '#140a04', 1.2);
    const knob = pulled ? '#8ff2ce' : '#f0c060';
    circle(ctx, hx, hy, 5, knob, '#140a04', 1.4); circle(ctx, hx - 1.6, hy - 1.6, 1.6, 'rgba(255,255,255,.8)');
    // status lamp on the plinth
    circle(ctx, x + 11, y + 3, 2.6, pulled ? '#8ff2ce' : '#ffb050', '#140a04', .8);
    glowQueue.push([hx, hy, pulled ? 16 : 22 + 4 * Math.sin(t * 4), pulled ? MINT : SUN, pulled ? .35 : .6]);
    const p = s.player;
    if (!pulled && p) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 90) labels.push({ x, y: y - 46, text: 'SLASH TO PULL', color: '#ffe6b0', size: 10 });
      else if (d < 300) labels.push({ x, y: y + 24, text: 'LEVER', color: '#e8d8b0', size: 9, dim: true });
    }
  }

  function drawDam(ctx, d, s, t) {
    const maxHp = Math.max(1, num(d.maxHp, Math.max(2, num(d.hp, 2)))), hp = num(d.hp, maxHp), broken = !!d.broken || hp <= 0;
    const horiz = d.w >= d.h, L = horiz ? d.w : d.h, D = horiz ? d.h : d.w;
    const rng = rngFor(hashStr(String(d.id || '') + d.x + ',' + d.y));
    ctx.save();
    if (horiz) ctx.translate(d.x, d.y); else { ctx.translate(d.x + d.w, d.y); ctx.rotate(Math.PI / 2); }
    if (broken) {
      // Rubble: scattered log ends with the canal rushing through the gap.
      ctx.fillStyle = 'rgba(0,10,6,.35)'; ctx.fillRect(0, 0, L, D);
      for (let i = 0; i < 14; i++) {
        const u = ((i * 37.3 + t * 70) % (L + 20)) - 10, v = (i * 13.7) % D;
        line(ctx, u, v, u + 8, v, `rgba(220,255,240,${.35 + .25 * Math.sin(i + t * 4)})`, 1.4);
      }
      for (let i = 0; i < Math.max(5, L / 16); i++) {
        const u = rng() * L, v = D * (-.3 + rng() * 1.6), a = (rng() - .5) * 2, len = 12 + rng() * 16;
        ctx.save(); ctx.translate(u, v); ctx.rotate(a);
        ellipse(ctx, 2, 4, len / 2, 4, 'rgba(0,0,0,.35)');
        rrect(ctx, -len / 2, -4, len, 8, 4); ctx.fillStyle = hsl(28, 36, 26 + rng() * 10); ctx.fill(); ctx.strokeStyle = '#140a04'; ctx.lineWidth = 1.2; ctx.stroke();
        ellipse(ctx, len / 2, 0, 2.4, 4, '#c8a878', '#140a04', .8);
        poly(ctx, [[-len / 2, -3], [-len / 2 - 5, -1], [-len / 2, 1], [-len / 2 - 4, 3]], '#d8c098');
        ctx.restore();
      }
      ctx.restore();
      return;
    }
    const face = 12;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(3, 6, L, D + face);
    // front face (visible drop) — only meaningful for horizontal dams
    if (horiz) {
      const fg = ctx.createLinearGradient(0, D, 0, D + face); fg.addColorStop(0, '#5a3a1e'); fg.addColorStop(1, '#2a180a');
      ctx.fillStyle = fg; ctx.fillRect(0, D - 2, L, face);
      for (let u = 6; u < L; u += 13) ellipse(ctx, u, D + face / 2 - 1, 4.8, face / 2 - 1, '#6a4a2a', '#1a0e04', 1);
    }
    const logs = Math.max(2, Math.round(D / 10)), lh = D / logs;
    for (let i = 0; i < logs; i++) {
      const y = i * lh, jag = hp < maxHp && i === Math.floor(logs / 2);
      const lg = ctx.createLinearGradient(0, y, 0, y + lh);
      lg.addColorStop(0, '#a07848'); lg.addColorStop(.35, '#7a5430'); lg.addColorStop(1, '#3a2412');
      ctx.fillStyle = lg;
      if (jag) { // the struck log is split and sagging
        ctx.fillRect(0, y + 1, L * .42, lh - 1); ctx.fillRect(L * .58, y + 2.5, L * .42, lh - 1);
        poly(ctx, [[L * .42, y + 1], [L * .47, y + lh * .3], [L * .44, y + lh * .6], [L * .5, y + lh], [L * .42, y + lh]], '#e8cfa0');
        poly(ctx, [[L * .58, y + 2.5], [L * .53, y + lh * .4], [L * .56, y + lh * .7], [L * .5, y + lh + 1.5], [L * .58, y + lh + 1.5]], '#e8cfa0');
      } else ctx.fillRect(0, y + .5, L, lh - 1);
      for (let k = 0; k < 3; k++) { const gy = y + 2 + rng() * (lh - 4); line(ctx, 4 + rng() * 10, gy, L - 4 - rng() * 10, gy + (rng() - .5) * 1.5, 'rgba(30,16,6,.35)', .8); }
      for (const u of [0, L]) { ellipse(ctx, u, y + lh / 2, 3.4, lh / 2 - .5, '#c8a878', '#1a0e04', 1); circle(ctx, u, y + lh / 2, 1.2, '#7a5430'); }
    }
    for (let u = L * .2; u < L; u += L * .3) { // rope lashings
      line(ctx, u, -1, u, D + 1, '#1a0e04', 4); line(ctx, u, -1, u, D + 1, '#c8a86a', 2.4);
      for (let v = 2; v < D; v += 4) line(ctx, u - 1.2, v, u + 1.2, v + 2, 'rgba(90,60,20,.6)', .8);
    }
    line(ctx, 0, .8, L, .8, 'rgba(255,230,190,.35)', 1.2);
    if (hp < maxHp) { // leaking: jets through the split and a hairline crack
      ctx.beginPath(); ctx.moveTo(L * .3, 0); ctx.lineTo(L * .38, D * .4); ctx.lineTo(L * .5, D * .5); ctx.lineTo(L * .62, D * .7); ctx.lineTo(L * .7, D);
      ctx.strokeStyle = '#140a04'; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const ph = (t * 2.2 + i / 6) % 1, u = L * (.44 + (i % 3) * .06);
        circle(ctx, u + (i - 3) * ph * 4, D + ph * (horiz ? 22 : 16), 1.6 + ph, `rgba(200,255,235,${.8 * (1 - ph)})`);
      }
    }
    ctx.restore();
    // hp notches: how many charges this dam can still take
    const cx = d.x + d.w / 2, cy = d.y - 12;
    for (let i = 0; i < maxHp; i++) {
      const px = cx + (i - (maxHp - 1) / 2) * 11;
      rrect(ctx, px - 4, cy - 3, 8, 6, 2); ctx.fillStyle = i < hp ? '#e8c07a' : 'rgba(20,12,6,.8)'; ctx.fill(); ctx.strokeStyle = '#140a04'; ctx.lineWidth = 1; ctx.stroke();
    }
    if (hp < maxHp) labels.push({ x: cx, y: cy - 12, text: 'CRACKED', color: '#ffd2a0', size: 9 });
  }

  // Seed mortar: bark plate on the facing side, soft glowing back.
  function mortarFacing(e) {
    const f = Array.isArray(e.facing) ? e.facing : [num(e.facingX, 0), num(e.facingY, 1)];
    return unitOr(num(f[0], 0), num(f[1], 1), 0, 1);
  }
  const mortarDead = e => num(e.hp, 1) <= 0 || e.phase === 'defeated';
  function drawMortarFloor(ctx, e, s, t) {
    if (mortarDead(e)) return;
    const [fx, fy] = mortarFacing(e), fa = Math.atan2(fy, fx), half = Math.acos(.3);
    const p = s.player, near = p && Math.hypot(p.x - e.x, p.y - e.y) < 220;
    const behind = p && ((p.x - e.x) * fx + (p.y - e.y) * fy) / (Math.hypot(p.x - e.x, p.y - e.y) || 1) < .3;
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1, .82);
    // the soft flank arc, where a slash lands
    ctx.beginPath(); ctx.arc(0, 0, 58, fa + half, fa + TAU - half); ctx.arc(0, 0, 30, fa + TAU - half, fa + half, true); ctx.closePath();
    ctx.fillStyle = `rgba(150,255,190,${near ? (behind ? .22 : .12 + .06 * Math.sin(t * 6)) : .06})`; ctx.fill();
    ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 14;
    ctx.beginPath(); ctx.arc(0, 0, 58, fa + half, fa + TAU - half); ctx.strokeStyle = `rgba(170,255,200,${near ? .7 : .3})`; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    // the armoured front, hatched
    ctx.beginPath(); ctx.arc(0, 0, 50, fa - half, fa + half); ctx.arc(0, 0, 30, fa + half, fa - half, true); ctx.closePath();
    ctx.fillStyle = 'rgba(90,50,20,.22)'; ctx.fill();
    ctx.restore();
  }
  function drawMortar(ctx, e, s, t) {
    const [fx, fy] = mortarFacing(e), fa = Math.atan2(fy, fx);
    const rng = rngFor(hashStr(String(e.id || 'm')));
    contactShadow(ctx, e.x + 3, e.y + 12, 28, 12, .9);
    for (let i = 0; i < 6; i++) { // root foot
      const a = i * TAU / 6 + rng(), L = 22 + rng() * 10;
      ctx.beginPath(); ctx.moveTo(e.x, e.y + 4); ctx.quadraticCurveTo(e.x + Math.cos(a) * L * .6, e.y + 4 + Math.sin(a) * L * .4 - 4, e.x + Math.cos(a) * L, e.y + 6 + Math.sin(a) * L * .55);
      ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#5a3e22'; ctx.lineWidth = 2; ctx.stroke();
    }
    if (mortarDead(e)) {
      ctx.save(); ctx.translate(e.x, e.y - 2);
      ellipse(ctx, 0, 0, 17, 12, '#4a4a30', '#141408', 1.6);
      poly(ctx, [[-6, -10], [0, -2], [5, -11], [3, 2], [-4, 3]], '#1a1a0e');
      ctx.restore();
      return;
    }
    const tele = /telegraph|aim|windup/.test(e.phase || '');
    const prog = tele ? clamp(1 - num(e.timer, .5) / .5, 0, 1) : 0;
    const sw = 1.2 * (1 + .14 * prog + .03 * Math.sin(t * 3 + e.x));
    ctx.save(); ctx.translate(e.x, e.y - 8); ctx.scale(sw, sw);
    // pod body
    const bg = ctx.createRadialGradient(-6, -8, 2, 0, 0, 22);
    bg.addColorStop(0, '#d8f08a'); bg.addColorStop(.4, '#78b040'); bg.addColorStop(.85, '#2e5a1c'); bg.addColorStop(1, '#16300c');
    ellipse(ctx, 0, 0, 19, 17, bg, '#0c1a06', 2);
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .5; ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(Math.cos(a) * 20, 0, Math.cos(a) * 10, 14); ctx.strokeStyle = 'rgba(20,50,10,.45)'; ctx.lineWidth = 1.1; ctx.stroke(); }
    // vulnerable back: a translucent seed-heart
    const bx = -fx * 10, by = -fy * 8, pulse = .6 + .4 * Math.sin(t * 4);
    const hg = ctx.createRadialGradient(bx, by, 1, bx, by, 10); hg.addColorStop(0, '#fffbd0'); hg.addColorStop(.5, `rgba(200,255,140,${.8 * pulse})`); hg.addColorStop(1, 'rgba(120,200,80,0)');
    circle(ctx, bx, by, 10, hg);
    // bark plate on the facing side
    ctx.beginPath(); ctx.ellipse(0, 0, 25, 22, 0, fa - 1.3, fa + 1.3); ctx.ellipse(0, 0, 14, 12, 0, fa + 1.1, fa - 1.1, true); ctx.closePath();
    const pg = ctx.createLinearGradient(-20, -20, 20, 20); pg.addColorStop(0, '#9a7048'); pg.addColorStop(.5, '#5a3a1e'); pg.addColorStop(1, '#2a180a');
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = '#120a02'; ctx.lineWidth = 2; ctx.stroke();
    for (let k = -3; k <= 3; k++) { const a = fa + k * .34; line(ctx, Math.cos(a) * 15, Math.sin(a) * 13, Math.cos(a) * 24, Math.sin(a) * 21, 'rgba(20,10,2,.55)', 1.3); }
    ctx.beginPath(); ctx.ellipse(0, 0, 24, 21, 0, fa - 1.2, fa - .2); ctx.strokeStyle = 'rgba(255,220,170,.4)'; ctx.lineWidth = 1.2; ctx.stroke();
    // mouth / muzzle crown on top
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + .3; ctx.save(); ctx.translate(0, -15); ctx.rotate(a); poly(ctx, [[0, -2], [8, -4], [11, 0], [8, 4], [0, 2]], tele ? '#e86a48' : '#8ab848', '#1a2a0a', 1); ctx.restore(); }
    circle(ctx, 0, -15, 5, tele ? `rgb(255,${160 - prog * 100},80)` : '#1a1206', '#0c0802', 1.2);
    ctx.restore();
    glowQueue.push([e.x + bx, e.y - 8 + by, 20, '200,255,150', .35 * pulse]);
    if (tele) glowQueue.push([e.x, e.y - 23, 18 + prog * 22, EMBER, .5 + prog * .5]);
    const pl = s.player;
    if (pl && Math.hypot(pl.x - e.x, pl.y - e.y) < 200) {
      const front = ((pl.x - e.x) * fx + (pl.y - e.y) * fy) / (Math.hypot(pl.x - e.x, pl.y - e.y) || 1) >= .3;
      labels.push({ x: e.x, y: e.y - 44, text: front ? 'BARK PLATE — FLANK IT' : 'STRIKE THE BACK', color: front ? '#e8c8a0' : '#b8ffcc', size: 10 });
    }
    const maxHp = Math.max(1, num(e.maxHp, num(e.hp, 2)));
    if (num(e.hp, maxHp) < maxHp) hpPips(ctx, e.x, e.y + 22, num(e.hp, 0), maxHp);
  }
  // Lobbed seeds: parabola above a ground shadow, landing reticle closing on the target.
  function lobState(l) {
    const flight = Math.max(.05, num(l.flight, 1.1)), p = clamp(num(l.t, 0) / flight, 0, 1);
    const x0 = num(l.x0, num(l.tx, 0)), y0 = num(l.y0, num(l.ty, 0)), tx = num(l.tx, x0), ty = num(l.ty, y0);
    const peak = Math.min(110, 46 + Math.hypot(tx - x0, ty - y0) * .15);
    return { p, x0, y0, tx, ty, peak, gx: x0 + (tx - x0) * p, gy: y0 + (ty - y0) * p, h: 4 * peak * p * (1 - p), r: num(l.r, 46) };
  }
  function drawLobsFloor(ctx, s, t) {
    for (const l of arr(s.lobs)) {
      const L = lobState(l);
      if (!Number.isFinite(L.tx)) continue;
      const outer = L.r * (1 + 1.3 * (1 - L.p)), flash = L.p > .82 && Math.sin(t * 40) > 0;
      ctx.save(); ctx.translate(L.tx, L.ty);
      ctx.fillStyle = `rgba(255,70,40,${.08 + .26 * L.p + (flash ? .12 : 0)})`; circle(ctx, 0, 0, L.r, ctx.fillStyle);
      circle(ctx, 0, 0, L.r, null, `rgba(255,120,90,${.35 + .5 * L.p})`, 1.6);
      circle(ctx, 0, 0, outer, null, `rgba(255,${flash ? 240 : 170},120,${.5 + .5 * L.p})`, 2 + 2 * L.p);
      ctx.rotate(t * 2);
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); line(ctx, outer - 8, 0, outer + 6, 0, `rgba(255,200,150,${.6 + .4 * L.p})`, 2.4); }
      ctx.restore();
      // remaining flight path, dotted
      ctx.save(); ctx.setLineDash([2, 7]);
      ctx.beginPath();
      for (let q = L.p; q <= 1.001; q += .05) { const x = L.x0 + (L.tx - L.x0) * q, y = L.y0 + (L.ty - L.y0) * q - 4 * L.peak * q * (1 - q); q === L.p ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.strokeStyle = 'rgba(255,220,170,.35)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
      ellipse(ctx, L.gx, L.gy, 5 + 7 * L.p, 2.5 + 3.5 * L.p, `rgba(0,0,0,${.2 + .35 * L.p})`);
    }
  }
  function drawLobsAir(ctx, s, t) {
    for (const l of arr(s.lobs)) {
      const L = lobState(l);
      if (!Number.isFinite(L.gx)) continue;
      const x = L.gx, y = L.gy - L.h - 8;
      for (let i = 1; i <= 3; i++) { const q = Math.max(0, L.p - i * .035); circle(ctx, L.x0 + (L.tx - L.x0) * q, L.y0 + (L.ty - L.y0) * q - 4 * L.peak * q * (1 - q) - 8, 3.2 - i * .7, `rgba(210,240,150,${.4 - i * .1})`); }
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 9);
      ellipse(ctx, 0, 0, 7.5, 5.2, rg(ctx, -2, -2, 8, '#e8e08a', '#5a6a1c'), '#1a1a06', 1.4);
      line(ctx, -5, 0, 5, 0, 'rgba(60,40,10,.6)', 1.2);
      ctx.restore();
      glowQueue.push([x, y, 16, '220,255,140', .5]);
    }
  }

  // Root Hart: antlered stag of wood and moss, drawn top-down along its heading.
  const hartTrails = new Map();
  function hartState(e) {
    const ph = e.phase || '';
    const dead = num(e.hp, 1) <= 0 || ph === 'defeated';
    return { ph, dead, dormant: ph === 'dormant', stalk: ph === 'stalk', aim: ph === 'aim', charge: ph === 'charge',
      exposed: !dead && (ph === 'exposed' || e.exposed === true || num(e.exposed, 0) > 0), daze: ph === 'daze', recover: ph === 'recover', locked: !!e.locked };
  }
  function hartDir(e, s, st) {
    const p = s.player;
    if ((st.stalk || st.dormant) && p && !st.dead && st.stalk) return unitOr(p.x - e.x, p.y - e.y, 1, 0);
    let ax = num(e.aimX, NaN), ay = num(e.aimY, NaN);
    if (Number.isFinite(ax) && Number.isFinite(ay)) {
      if (Math.hypot(ax, ay) > 2) { ax -= e.x; ay -= e.y; }
      if (Math.hypot(ax, ay) > 1e-6) return unitOr(ax, ay, 1, 0);
    }
    return p ? unitOr(p.x - e.x, p.y - e.y, 1, 0) : [1, 0];
  }
  function hartSolids(s) {
    return arr(s.walls).filter(finiteRect).concat(arr(s.gates).filter(g => !g.open && finiteRect(g)),
      arr(s.dams).filter(d => finiteRect(d) && !d.broken && num(d.hp, 2) > 0),
      arr(s.growth).filter(g => finiteRect(g) && g.alive !== false),
      arr(s.breakwaters).filter(b => finiteRect(b) && zoneActive(b, s)), arr(s.shutters).filter(sh => finiteRect(sh) && sh.open === false));
  }
  function drawHartFloor(ctx, e, s, t) {
    const st = hartState(e);
    const id = e.id || 'hart';
    let tr = hartTrails.get(id);
    if (!tr || t < tr.t) { tr = { pts: [], t }; hartTrails.set(id, tr); }
    if (st.charge) { if (!tr.pts.length || Math.hypot(tr.pts[tr.pts.length - 1][0] - e.x, tr.pts[tr.pts.length - 1][1] - e.y) > 6) tr.pts.push([e.x, e.y, t]); }
    tr.t = t;
    tr.pts = tr.pts.filter(q => t - q[2] < (st.charge ? .5 : .35));
    if (st.dead) return;
    const R = num(e.r, 34), [dx, dy] = hartDir(e, s, st), a = Math.atan2(dy, dx);
    if (st.aim || st.charge) {
      const solids = hartSolids(s);
      const hit = PW.raySegment ? PW.raySegment(e.x, e.y, dx, dy, solids, 720) : { x: e.x + dx * 700, y: e.y + dy * 700 };
      const L = Math.hypot(hit.x - e.x, hit.y - e.y);
      const dam = arr(s.dams).find(d => finiteRect(d) && !d.broken && num(d.hp, 2) > 0 && rectDist(hit.x, hit.y, d) < 4);
      const locked = st.locked || st.charge, pulse = .5 + .5 * Math.sin(t * (locked ? 26 : 10));
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      if (locked) {
        ctx.fillStyle = `rgba(255,40,30,${.3 + .12 * pulse})`; rrect(ctx, R * .5, -R, Math.max(0, L - R * .5), R * 2, 8); ctx.fill();
        ctx.strokeStyle = '#ff5a44'; ctx.lineWidth = 3.2; ctx.stroke();
        for (let x = R + 10; x < L - 14; x += 34) { line(ctx, x - 9, -14, x + 5, 0, '#ffe0d0', 3.4); line(ctx, x + 5, 0, x - 9, 14, '#ffe0d0', 3.4); }
      } else {
        const prog = clamp(1 - num(e.timer, .9) / .9, 0, 1);
        const lg = ctx.createLinearGradient(R * .5, 0, L, 0); lg.addColorStop(0, `rgba(255,150,60,${.16 + .1 * prog})`); lg.addColorStop(1, 'rgba(255,150,60,.05)');
        ctx.fillStyle = lg; rrect(ctx, R * .5, -R, Math.max(0, L - R * .5), R * 2, 8); ctx.fill();
        ctx.setLineDash([12, 8]); ctx.lineDashOffset = -t * 50; ctx.strokeStyle = `rgba(255,180,100,${.55 + .35 * pulse})`; ctx.lineWidth = 2.4; ctx.stroke(); ctx.setLineDash([]);
        for (let x = R + 10; x < L - 14; x += 44) { line(ctx, x - 7, -10, x + 3, 0, 'rgba(255,210,160,.55)', 2.2); line(ctx, x + 3, 0, x - 7, 10, 'rgba(255,210,160,.55)', 2.2); }
      }
      ctx.restore();
      // impact marker: gold when the charge will strike a dam
      ctx.save(); ctx.translate(hit.x, hit.y);
      const ic = dam ? '255,214,120' : '255,110,90';
      for (let i = 0; i < 8; i++) { const q = i * TAU / 8 + t * (dam ? 1.5 : 0); line(ctx, Math.cos(q) * 8, Math.sin(q) * 8, Math.cos(q) * (16 + 4 * pulse), Math.sin(q) * (16 + 4 * pulse), `rgba(${ic},.9)`, 2.6); }
      ctx.restore();
      if (dam) labels.push({ x: hit.x - dx * 26, y: hit.y - dy * 26 - 8, text: 'HITS THE DAM', color: '#ffe0a0', size: 10 });
      if (!st.charge) labels.push({ x: e.x, y: e.y - R * 3.8, text: locked ? 'LOCKED — SIDESTEP' : 'CHARGE AIMING', color: locked ? '#ff9c86' : '#ffc890', size: 11 });
    }
    if (tr.pts.length) { // charge streak
      const pts = tr.pts.concat([[e.x, e.y, t]]);
      ctx.save(); ctx.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        const f = i / pts.length;
        line(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], `rgba(255,120,70,${.35 * f})`, R * 1.6 * f);
        line(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], `rgba(255,230,190,${.4 * f})`, 4);
      }
      ctx.restore();
      for (let i = 0; i < pts.length - 1; i += 2) { const q = pts[i], ph = clamp((t - q[2]) / .5, 0, 1); circle(ctx, q[0] + Math.sin(i * 2.1) * 14, q[1] + 16 + Math.cos(i) * 6 - ph * 10, 6 + ph * 12, `rgba(170,140,100,${.35 * (1 - ph)})`); }
    }
    if (st.exposed) {
      const pulse = .5 + .5 * Math.sin(t * 6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ellipse(ctx, e.x, e.y + 6, R * 1.8 + pulse * 6, R * 1.1 + pulse * 4, null, `rgba(140,255,210,${.35 + .3 * pulse})`, 3);
      ctx.restore();
    }
  }
  const hartFlip = new Map();
  function hartAntler(ctx, far, glow, t) {
    // One antler: a pale branching beam sweeping up and back, leaf buds on every tine.
    const bx = far ? 4 : 0, by = far ? -2 : 0;
    const main = [[bx, by], [bx - 10, by - 22], [bx - 4, by - 44], [bx - 16, by - 62]];
    const tines = [[1, 12, -14], [2, 16, -8], [2, -14, -10], [3, 10, -12], [3, -12, -6]];
    const path = () => {
      ctx.beginPath(); ctx.moveTo(main[0][0], main[0][1]);
      ctx.bezierCurveTo(main[1][0], main[1][1], main[2][0], main[2][1], main[3][0], main[3][1]);
      for (const [i, dx, dy] of tines) {
        const q = i / 3, it = 1 - q;
        const px = it * it * it * main[0][0] + 3 * it * it * q * main[1][0] + 3 * it * q * q * main[2][0] + q * q * q * main[3][0];
        const py = it * it * it * main[0][1] + 3 * it * it * q * main[1][1] + 3 * it * q * q * main[2][1] + q * q * q * main[3][1];
        ctx.moveTo(px, py); ctx.quadraticCurveTo(px + dx * .3, py + dy * .8, px + dx, py + dy);
      }
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    path(); ctx.strokeStyle = '#1a1006'; ctx.lineWidth = 7.5; ctx.stroke();
    path(); ctx.strokeStyle = far ? '#9a8866' : '#e2d2a6'; ctx.lineWidth = 4.2; ctx.stroke();
    if (!far) { path(); ctx.strokeStyle = 'rgba(255,250,230,.5)'; ctx.lineWidth = 1.2; ctx.stroke(); }
    ctx.lineCap = 'butt';
    const tips = [main[3]];
    for (const [i, dx, dy] of tines) {
      const q = i / 3, it = 1 - q;
      tips.push([it * it * it * main[0][0] + 3 * it * it * q * main[1][0] + 3 * it * q * q * main[2][0] + q * q * q * main[3][0] + dx,
        it * it * it * main[0][1] + 3 * it * it * q * main[1][1] + 3 * it * q * q * main[2][1] + q * q * q * main[3][1] + dy]);
    }
    tips.forEach(([x, y], i) => {
      ellipse(ctx, x, y, 4.2, 2.6, hsl(96 + i * 6, 58, far ? 28 : 40), '#0c1a06', .9, -.6 + i);
      if (glow) circle(ctx, x + 1, y - 1, 1.7, `rgb(${glow})`);
    });
    return tips;
  }
  function drawHart(ctx, e, s, t) {
    // Side-on stag of bark and root, flipped to its heading; antlers lower into a ram when aiming.
    const st = hartState(e), [dx, dy] = hartDir(e, s, st);
    const m = track(e, t), R = num(e.r, 34), k = R / 34 * 1.2, id = e.id || 'hart';
    let flip = hartFlip.get(id) || 1;
    if (Math.abs(dx) > .25) flip = dx < 0 ? -1 : 1;
    hartFlip.set(id, flip);
    const moving = m.speed > 8 && !st.dormant && !st.dead;
    const gait = moving ? m.phase * (st.charge ? .45 : .6) : 0;
    const eyeRGB = st.dead || st.dormant ? null : st.exposed ? '150,255,215' : st.daze ? '255,230,150' : (st.aim || st.charge) ? '255,60,40' : '255,196,110';
    const ram = st.aim || st.charge ? 1 : 0, low = st.dormant ? 1 : 0;
    const bob = moving ? Math.abs(Math.sin(gait)) * 2 : Math.sin(t * 1.6) * .8;
    contactShadow(ctx, e.x, e.y + 12 * k, 56 * k, 16 * k, .85);
    const fore = st.dead || st.dormant ? 1 : .62 + .38 * Math.abs(dx); // foreshorten when heading up/down the screen
    ctx.save(); ctx.translate(e.x, e.y + 10 * k); ctx.scale(flip * k * fore, k);
    if (st.charge) ctx.translate(Math.sin(t * 40) * 1.2, 0);
    if (st.dead) { ctx.translate(0, 4); ctx.rotate(-.06); }
    const bodyY = st.dead ? -12 : low ? -16 : -40 - bob;
    const bark = (x, y, r) => { const g = ctx.createRadialGradient(x - r * .4, y - r * .6, 2, x, y, r * 1.3); g.addColorStop(0, st.dead ? '#9a927c' : '#b48c5c'); g.addColorStop(.5, st.dead ? '#5e5646' : '#6e4c2c'); g.addColorStop(1, '#26160a'); return g; };
    // legs: far pair first (darker), near pair after the body
    const legs = (far) => {
      if (st.dead) return;
      const col = far ? '#2a1a0c' : '#4e341e';
      for (const [hx, ph, hind] of [[22, 0, false], [-24, Math.PI, true]]) {
        const phase = gait + ph + (far ? Math.PI : 0), sw = moving ? Math.sin(phase) * (st.charge ? 14 : 9) : 0;
        const x0 = hx + (far ? 5 : 0), y0 = bodyY + 10;
        let kx, ky, fx, fy;
        if (low) { kx = x0 + (hind ? -12 : 12); ky = -6; fx = x0 + (hind ? 6 : 20); fy = -2; }
        else { kx = x0 + sw * .5 + (hind ? -7 : 4); ky = y0 + 16; fx = x0 + sw + (hind ? 2 : 0); fy = (moving ? -Math.max(0, Math.cos(phase)) * 5 : 0); }
        ctx.lineCap = 'round';
        line(ctx, x0, y0, kx, ky, '#120a04', hind ? 12 : 10); line(ctx, kx, ky, fx, fy, '#120a04', 6);
        line(ctx, x0, y0, kx, ky, col, hind ? 8 : 6.5); line(ctx, kx, ky, fx, fy, col, 3.2);
        if (!far) line(ctx, x0 - 1.5, y0, kx - 1.5, ky, 'rgba(230,190,140,.28)', 1.4);
        ctx.lineCap = 'butt';
        ellipse(ctx, fx + 1, fy, 4, 2.6, '#0c0602');
      }
    };
    legs(true);
    // torso: hindquarter, barrel, deep chest
    ellipse(ctx, -24, bodyY - 2, 20, 17, bark(-24, bodyY - 2, 20), '#0c0602', 2.4);
    ellipse(ctx, 0, bodyY, 34, 17, bark(0, bodyY, 34), '#0c0602', 2.4);
    ellipse(ctx, 20, bodyY - 1, 19, 19, bark(20, bodyY - 1, 19), '#0c0602', 2.4);
    ellipse(ctx, 0, bodyY + 1, 30, 13, bark(0, bodyY, 30));
    ctx.beginPath(); ctx.ellipse(0, bodyY, 34, 17, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.strokeStyle = 'rgba(255,236,190,.55)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(20, bodyY - 1, 19, 19, 0, Math.PI * 1.2, Math.PI * 1.85); ctx.stroke();
    for (let i = 0; i < 5; i++) { // root strands wrapping the flank
      const x = -30 + i * 13; ctx.beginPath(); ctx.moveTo(x, bodyY - 15); ctx.bezierCurveTo(x + 7, bodyY - 5, x - 5, bodyY + 5, x + 3, bodyY + 15);
      ctx.strokeStyle = '#2a180a'; ctx.lineWidth = 2.6; ctx.stroke(); ctx.strokeStyle = 'rgba(220,180,130,.22)'; ctx.lineWidth = .9; ctx.stroke();
    }
    const mr = rngFor(hashStr(String(id)));
    for (let i = 0; i < 16; i++) { // moss mantle along the spine
      const x = -40 + i * 4.6, y = bodyY - 15 + Math.abs(x) * .06 + (mr() - .5) * 4;
      ellipse(ctx, x, y, 5.5 + mr() * 3, 3.4 + mr() * 2, hsl(92 + mr() * 26, 50, (st.dead ? 22 : 30) + mr() * 14), null, 0, mr() * 3);
    }
    for (let i = 0; i < 4; i++) circle(ctx, -30 + i * 16, bodyY - 17 + (mr() - .5) * 3, 2, i % 2 ? '#f4e8f0' : '#f0d060');
    // heartwood in the chest
    const cx = 20, cy = bodyY + 2;
    poly(ctx, [[cx - 8, cy - 9], [cx + 1, cy - 12], [cx + 8, cy - 4], [cx + 5, cy + 8], [cx - 4, cy + 10], [cx - 9, cy + 2]], '#1a0c04', '#0c0602', 1.4);
    const cg = ctx.createRadialGradient(cx, cy, 1, cx, cy, 12);
    if (st.exposed) { cg.addColorStop(0, '#ffffff'); cg.addColorStop(.45, '#b0ffe4'); cg.addColorStop(1, '#22c890'); }
    else if (st.dead) { cg.addColorStop(0, '#3a2a1a'); cg.addColorStop(1, '#1a0c04'); }
    else { cg.addColorStop(0, '#ffcf80'); cg.addColorStop(1, '#6a1a06'); }
    const open = st.exposed ? 1 : .55;
    poly(ctx, [[cx - 5 * open, cy - 7], [cx + 1, cy - 9 * open], [cx + 5 * open, cy - 3], [cx + 3 * open, cy + 6], [cx - 3 * open, cy + 7], [cx - 6 * open, cy + 1]], cg);
    if (st.exposed) for (let i = 0; i < 4; i++) line(ctx, cx, cy, cx + Math.cos(i * 1.6 + .3) * 16, cy + Math.sin(i * 1.6 + .3) * 16, 'rgba(200,255,230,.8)', 1.4);
    legs(false);
    // neck, head and antlers pivot at the withers; aiming lowers them into a ram
    const pivotX = 28, pivotY = bodyY - 10;
    ctx.save(); ctx.translate(pivotX, pivotY);
    ctx.rotate(st.dead ? 1.1 : low ? .55 : ram ? 1.3 : (moving ? Math.sin(gait * 2) * .04 : Math.sin(t * .9) * .03));
    poly(ctx, [[-10, 4], [-4, -12], [8, -30], [20, -30], [16, -12], [10, 8]], bark(6, -12, 18), '#0c0602', 2.2);
    for (let i = 0; i < 4; i++) ellipse(ctx, -2 + i * 5, -8 - i * 6, 4, 2.6, hsl(98, 45, 30 + i * 3), null, 0, -.9);
    const hx = 20, hy = -36;
    ctx.save(); ctx.translate(hx + 3, hy - 9); hartAntler(ctx, true, st.exposed ? '190,255,220' : null, t); ctx.restore();
    ellipse(ctx, hx, hy, 14, 9, bark(hx, hy, 14), '#0c0602', 2);
    poly(ctx, [[hx + 6, hy - 6], [hx + 26, hy + 1], [hx + 24, hy + 8], [hx + 6, hy + 8]], '#8a6a46', '#0c0602', 1.8);
    circle(ctx, hx + 24, hy + 3, 2.6, '#140a04');
    poly(ctx, [[hx - 8, hy - 5], [hx - 22, hy - 14], [hx - 10, hy - 1]], '#6e4c2c', '#0c0602', 1.4);
    if (eyeRGB) { circle(ctx, hx + 5, hy - 2, 3, `rgb(${eyeRGB})`, '#0c0602', 1); circle(ctx, hx + 4.4, hy - 3, 1, '#fff'); }
    else line(ctx, hx + 2, hy - 2, hx + 8, hy - 1, '#0c0602', 1.8);
    ctx.save(); ctx.translate(hx - 2, hy - 7);
    const tips = hartAntler(ctx, false, st.exposed ? '190,255,220' : null, t);
    ctx.restore();
    if (st.dead) for (let i = 0; i < tips.length; i += 2) { const [x, y] = tips[i]; for (let q = 0; q < 5; q++) circle(ctx, hx - 2 + x + Math.cos(q * 1.26) * 3, hy - 7 + y + Math.sin(q * 1.26) * 3, 2, '#f6d8e8'); circle(ctx, hx - 2 + x, hy - 7 + y, 1.6, '#f0c040'); }
    ctx.restore();
    ctx.restore();
    // head position in world space (for glow and stars), recomputed from the same pose
    const na = st.dead ? 1.1 : low ? .55 : ram ? 1.3 : 0;
    const lx = pivotX + Math.cos(na) * hx - Math.sin(na) * hy, ly = pivotY + Math.sin(na) * hx + Math.cos(na) * hy;
    const hwx = e.x + flip * k * fore * lx, hwy = e.y + 10 * k + k * ly;
    const cwx = e.x + flip * k * fore * cx, cwy = e.y + 10 * k + k * cy;
    if (eyeRGB) glowQueue.push([hwx + flip * 5 * k, hwy - 2 * k, st.aim || st.charge ? 36 : 20, eyeRGB, .75]);
    if (st.exposed) glowQueue.push([cwx, cwy, 100, JADE, .8], [cwx, cwy, 30, '255,255,240', .85]);
    else if (!st.dead && !st.dormant) glowQueue.push([cwx, cwy, 26, EMBER, .35 + .1 * Math.sin(t * 3)]);
    if (st.daze) {
      for (let i = 0; i < 4; i++) {
        const q = t * 3 + i * TAU / 4, sx = hwx + Math.cos(q) * 26, sy = hwy - 34 * k + Math.sin(q) * 8;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 4 + i);
        const pts = []; for (let j = 0; j < 10; j++) { const r = j % 2 ? 2.8 : 7, qa = j * Math.PI / 5 - Math.PI / 2; pts.push([Math.cos(qa) * r, Math.sin(qa) * r]); }
        poly(ctx, pts, '#ffe68a', '#5a3a08', 1.2); ctx.restore();
        glowQueue.push([sx, sy, 10, '255,230,140', .6]);
      }
    }
    const top = e.y - 130 * k < 70 ? e.y + R + 26 : e.y - 130 * k;
    if (st.dormant) {
      for (let i = 0; i < 3; i++) { const ph = (t * .5 + i / 3) % 1; text(ctx, 'z', hwx + flip * (8 + ph * 14), hwy - 18 - ph * 22, 9 + ph * 5, `rgba(220,240,210,${.8 * (1 - ph)})`); }
      labels.push({ x: e.x, y: e.y + R + 14, text: 'THE ROOT HART SLEEPS', color: '#d8e8c8', size: 10, dim: true });
    }
    if (st.exposed) labels.push({ x: e.x, y: top, text: 'HEARTWOOD OPEN — STRIKE', color: '#9ff5d2', size: 11 });
    else if (st.daze) labels.push({ x: e.x, y: top, text: 'DAZED — NO OPENING', color: '#ffe0a0', size: 10 });
  }

  // Pump receiver: stone cistern and water wheel; the fill ring never drains.
  function beamEndsAt(s, x, y, r) { return arr(s.beams).some(b => Number.isFinite(b.x2) && Math.hypot(b.x2 - x, b.y2 - y) < r); }
  function drawPump(ctx, r, t, s) {
    const charge = clamp(num(r.charge, 0), 0, 1), full = !!r.active || charge >= 1;
    const lit = typeof r.lit === 'boolean' ? r.lit : beamEndsAt(s, r.x, r.y, num(r.r, 20) + 10);
    contactShadow(ctx, r.x + 4, r.y + 12, 34, 15, .9);
    // cistern
    ellipse(ctx, r.x, r.y + 6, 27, 17, '#3a3426', '#0c0a06', 1.6);
    ctx.fillStyle = '#3a3426'; ctx.fillRect(r.x - 27, r.y, 54, 6);
    ellipse(ctx, r.x, r.y, 27, 17, '#9a8a64', '#0c0a06', 1.6);
    ellipse(ctx, r.x, r.y, 21, 12.5, '#1a2218', 'rgba(255,245,215,.25)', 1);
    const lv = .25 + .75 * charge;
    ellipse(ctx, r.x, r.y + 1, 20 * lv, 11.5 * lv, `rgba(80,220,170,${.35 + .5 * charge})`);
    if (charge > .05) line(ctx, r.x - 10 * lv, r.y - 3 * lv, r.x - 2 * lv, r.y - 5 * lv, 'rgba(230,255,245,.7)', 1.2);
    // water wheel on posts behind the basin
    const spin = t * (lit ? 4 : full ? 1.2 : 0);
    line(ctx, r.x - 14, r.y - 4, r.x - 14, r.y - 30, '#2a1a0c', 4); line(ctx, r.x + 14, r.y - 4, r.x + 14, r.y - 30, '#2a1a0c', 4);
    ctx.save(); ctx.translate(r.x, r.y - 26);
    for (let i = 0; i < 8; i++) {
      const q = spin + i * TAU / 8, c = Math.cos(q), sn = Math.sin(q);
      rrect(ctx, -11, sn * 15 - 2.4, 22, 4.8, 1.5); ctx.fillStyle = hsl(30, 40, c > 0 ? 42 : 24); ctx.fill(); ctx.strokeStyle = '#140a04'; ctx.lineWidth = .8; ctx.stroke();
    }
    ellipse(ctx, -11, 0, 2.5, 15, null, '#3a2412', 2.2); ellipse(ctx, 11, 0, 2.5, 15, null, '#5a3a1c', 2.2);
    line(ctx, -14, 0, 14, 0, '#b08a4a', 3); circle(ctx, 0, 0, 3, '#d8b068', '#140a04', 1);
    ctx.restore();
    if (lit || full) for (let i = 0; i < 5; i++) { const ph = (t * 1.8 + i / 5) % 1; circle(ctx, r.x - 8 + i * 4, r.y - 12 + ph * 14, 1.5, `rgba(200,255,235,${.8 * (1 - ph)})`); }
    // fill ring
    const R = 38;
    ctx.beginPath(); ctx.arc(r.x, r.y, R, 0, TAU); ctx.strokeStyle = 'rgba(6,20,14,.75)'; ctx.lineWidth = 7; ctx.stroke();
    for (let i = 0; i < 12; i++) { const q = -Math.PI / 2 + i * TAU / 12; line(ctx, r.x + Math.cos(q) * (R - 3), r.y + Math.sin(q) * (R - 3), r.x + Math.cos(q) * (R + 3), r.y + Math.sin(q) * (R + 3), 'rgba(160,220,190,.35)', 1); }
    if (charge > 0) { ctx.beginPath(); ctx.arc(r.x, r.y, R, -Math.PI / 2, -Math.PI / 2 + TAU * charge); ctx.strokeStyle = full ? '#9ff5d2' : '#4ee0b0'; ctx.lineWidth = 4.5; ctx.stroke(); }
    glowQueue.push([r.x, r.y - 4, full ? 80 : 30 + charge * 40, JADE, full ? .6 : lit ? .5 : .15 + charge * .3]);
    if (!full) labels.push({ x: r.x, y: r.y + R + 12, text: `PUMP ${Math.floor(charge * 100)}%`, color: '#b8f5dc', size: 10 });
  }

  // The placeable sun prism: crystal on a small tripod with a glowing aim notch.
  function drawPortablePrism(ctx, m, t, s) {
    const dirs = arr(m.dirs).filter(d => Array.isArray(d) && d.length >= 2);
    const idx = clamp(Math.floor(num(m.index, 0)), 0, Math.max(0, dirs.length - 1));
    const out = dirs[idx] || [1, 0], oa = Math.atan2(out[1], out[0]);
    const lit = typeof m.lit === 'boolean' ? m.lit : !!incomingDir(m, s);
    // floor compass: eight notches, the chosen one bright
    for (let i = 0; i < dirs.length; i++) {
      const q = Math.atan2(dirs[i][1], dirs[i][0]), cur = i === idx;
      const r0 = cur ? 20 : 25, r1 = cur ? 40 : 30;
      line(ctx, m.x + Math.cos(q) * r0, m.y + 4 + Math.sin(q) * r0 * .8, m.x + Math.cos(q) * r1, m.y + 4 + Math.sin(q) * r1 * .8, cur ? `rgba(${PRISM},.95)` : 'rgba(255,220,240,.35)', cur ? 3.2 : 1.6);
    }
    ctx.save(); ctx.translate(m.x + Math.cos(oa) * 44, m.y + 4 + Math.sin(oa) * 44 * .8); ctx.rotate(oa);
    poly(ctx, [[8, 0], [-4, -6], [-1, 0], [-4, 6]], `rgb(${PRISM})`, '#2a0a20', 1.2); ctx.restore();
    glowQueue.push([m.x + Math.cos(oa) * 40, m.y + 4 + Math.sin(oa) * 32, 14, PRISM, .8]);
    contactShadow(ctx, m.x + 3, m.y + 8, 17, 7, .9);
    // tripod
    const apex = [m.x, m.y - 16];
    for (const [fx, fy] of [[-13, 7], [13, 7], [0, -3]]) { line(ctx, apex[0], apex[1], m.x + fx, m.y + fy, '#140a04', 3.6); line(ctx, apex[0], apex[1], m.x + fx, m.y + fy, '#8a6a3a', 2); circle(ctx, m.x + fx, m.y + fy, 1.8, '#3a2a14'); }
    ellipse(ctx, apex[0], apex[1], 8, 3.4, '#c8a050', '#2a1a06', 1.4);
    // aim arm with lit notch
    line(ctx, apex[0], apex[1], apex[0] + out[0] * 14, apex[1] + out[1] * 10, '#2a1a06', 3.4);
    line(ctx, apex[0], apex[1], apex[0] + out[0] * 14, apex[1] + out[1] * 10, '#e8c070', 1.6);
    circle(ctx, apex[0] + out[0] * 14, apex[1] + out[1] * 10, 2.6, `rgb(${PRISM})`, '#2a0a20', 1);
    // the crystal: tall hexagonal prism, faceted and iridescent
    const bob = Math.sin(t * 2.4) * 1.2, cy = apex[1] - 12 + bob;
    ctx.save(); ctx.translate(apex[0], cy);
    const pg = ctx.createLinearGradient(-8, -16, 8, 12);
    pg.addColorStop(0, '#ffffff'); pg.addColorStop(.25, '#ffc8ec'); pg.addColorStop(.5, '#c8b0ff'); pg.addColorStop(.75, '#a8f0ff'); pg.addColorStop(1, '#ffe0a8');
    poly(ctx, [[0, -17], [7, -9], [7, 7], [0, 13], [-7, 7], [-7, -9]], pg, '#3a0a30', 1.6);
    poly(ctx, [[0, -17], [0, 13], [-7, 7], [-7, -9]], 'rgba(120,40,140,.22)');
    poly(ctx, [[0, -17], [7, -9], [0, -4], [-7, -9]], 'rgba(255,255,255,.45)');
    line(ctx, -3.5, -8, -3.5, 6, 'rgba(255,255,255,.85)', 1.3);
    ctx.restore();
    glowQueue.push([apex[0], cy, lit ? 56 : 30, PRISM, lit ? .8 : .45], [apex[0], cy - 4, 10, '255,255,255', .8]);
    const p = s.player;
    if (p && Math.hypot(p.x - m.x, p.y - m.y) < 80) labels.push({ x: m.x, y: m.y - 58, text: 'SLASH TO TURN', color: '#ffd2f0', size: 10 });
    else if (!lit) labels.push({ x: m.x, y: m.y + 24, text: 'SUN PRISM', color: '#ffd2f0', size: 9 });
  }
  function drawPrismCrystal(ctx, x, y, sz, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sz, sz); ctx.rotate(Math.sin(t * 1.8) * .12);
    const pg = ctx.createLinearGradient(-7, -14, 7, 10);
    pg.addColorStop(0, '#ffffff'); pg.addColorStop(.3, '#ffc8ec'); pg.addColorStop(.6, '#c8b0ff'); pg.addColorStop(1, '#a8f0ff');
    poly(ctx, [[0, -14], [6, -7], [6, 6], [0, 11], [-6, 6], [-6, -7]], pg, '#3a0a30', 1.6 / sz);
    poly(ctx, [[0, -14], [0, 11], [-6, 6], [-6, -7]], 'rgba(120,40,140,.22)');
    line(ctx, -3, -6, -3, 5, 'rgba(255,255,255,.85)', 1.2 / sz);
    ctx.restore();
  }
  function drawFerrymen(ctx, r, s, t) {
    const people = [[-14, 2, '#3a6a8a'], [12, -2, '#8a4a3a']];
    for (const [ox, oy, coat] of people) {
      const x = r.x + ox, y = r.y + oy, bob = r.freed ? Math.abs(Math.sin(t * 4 + ox)) * 2 : 0;
      contactShadow(ctx, x + 1, y + 12, 10, 4, .85);
      ctx.save(); ctx.translate(x, y - bob);
      poly(ctx, [[-7, -7], [7, -7], [9, 9], [-9, 9]], rg(ctx, -4, -5, 16, coat, '#1a2430'), INK, 1.5);
      circle(ctx, 0, -12, 6, rg(ctx, -2, -14, 8, '#ffdcb8', '#c8946a'), INK, 1.3);
      ellipse(ctx, 0, -16, 11, 4, rg(ctx, -4, -18, 12, '#e8d09a', '#8a6a3a'), INK, 1.3);
      ellipse(ctx, 0, -18, 4.5, 3, '#d8c08a', INK, 1);
      ctx.restore();
    }
    if (!r.freed) { // bramble snare around them
      ctx.save(); ctx.strokeStyle = '#3a1a1e'; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(r.x, r.y - 2, 30 - i * 2, 16 + i * 2, i * .5, 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
    labels.push({ x: r.x, y: r.y + 30, text: r.freed ? 'FERRYMEN • SAFE' : 'TRAPPED FERRYMEN', color: '#9ff5d2', size: 10 });
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
  function beamRGB(kind) { return kind === 'reflected' ? MINT : kind === 'split' ? SPLIT : kind === 'prism' ? PRISM : kind === 'hot' ? '255,92,43' : kind === 'cold' ? '104,204,255' : SUN; }
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
      if (b.kind === 'prism' && L > 1) { // chromatic fringes mark prism light
        const nx = -(b.y2 - b.y1) / L * 3.2, ny = (b.x2 - b.x1) / L * 3.2;
        line(ctx, b.x1 + nx, b.y1 - 6 + ny, b.x2 + nx, b.y2 - 6 + ny, 'rgba(120,200,255,.55)', 1.4);
        line(ctx, b.x1 - nx, b.y1 - 6 - ny, b.x2 - nx, b.y2 - 6 - ny, 'rgba(255,190,90,.55)', 1.4);
      }
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
      const thread = b.kind === 'glass-thread';
      const owner = thread && arr(s.enemies).find(e => e.id === b.owner);
      let centerThread = false;
      if (thread && owner && Number.isFinite(owner.aimX) && Number.isFinite(owner.aimY)) {
        const aimLen = Math.hypot(owner.aimX, owner.aimY) || 1;
        const lateral = (b.x - owner.x) * (-owner.aimY / aimLen) + (b.y - owner.y) * (owner.aimX / aimLen);
        centerThread = Math.abs(lateral) < 22 || !!b.friendly;
      }
      const rgb = b.friendly ? MINT : thread ? (centerThread ? '184,247,255' : '126,193,230') : '255,130,80';
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      const trail = thread ? (centerThread ? 42 : 24) : 26;
      line(ctx, b.x - ux * trail, b.y - uy * trail - 6, b.x, b.y - 6,
        `rgba(${rgb},${thread ? centerThread ? .9 : .42 : .35})`, thread ? (centerThread ? 11 : 5.5) : 8);
      bloom(ctx, b.x, b.y - 6, thread ? (centerThread ? 47 : 22) : 26, rgb, centerThread ? 1 : thread ? .48 : .82);
      bloom(ctx, b.x, b.y + 6, thread ? (centerThread ? 30 : 15) : 22, rgb, centerThread ? .46 : thread ? .16 : .25);
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'butt';
      ellipse(ctx, b.x, b.y + 6, 5, 2.5, 'rgba(0,0,0,.35)');
      if (thread) {
        ctx.save(); ctx.translate(b.x, b.y - 6); ctx.rotate(Math.atan2(uy, ux));
        if (centerThread) {
          circle(ctx, 0, 0, 21, 'rgba(48,145,194,.52)', 'rgba(244,254,255,.98)', 2.3);
          poly(ctx, [[-31, 0], [-9, -16], [29, 0], [-9, 16]], b.friendly ? '#b8ffe6' : '#e6fcff', '#ffffff', 2.8);
          poly(ctx, [[-9, -16], [3, 0], [-9, 16], [-2, 0]], b.friendly ? '#69e9c3' : '#70dfff', 'rgba(244,255,255,.95)', 1.2);
          line(ctx, -4, 0, 20, 0, 'rgba(255,255,255,1)', 2.1);
          line(ctx, 9, -5, 15, 0, 'rgba(255,255,255,.95)', 1.2);
        } else {
          poly(ctx, [[-13, 0], [-4, -6], [13, 0], [-4, 6]], b.friendly ? '#b8ffe6' : '#a9e5ff', '#f1fdff', 1.5);
          line(ctx, -3, 0, 6, 0, 'rgba(255,255,255,.75)', 1);
        }
        ctx.restore();
      } else {
        circle(ctx, b.x, b.y - 6, 5.5, b.friendly ? '#b8ffe6' : '#ffb07a', '#fff4d8', 1.6);
        circle(ctx, b.x - 1.5, b.y - 7.5, 1.8, '#ffffff');
      }
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
    // World-space labels are kept inside the visible view (portrait phones show a narrow slice of the room).
    const screenW = v.w * v.scale, screenH = v.h * v.scale;
    const compactLandscape = screenW <= 1000 && screenH <= 480;
    const placed = [], m = 6 / Math.max(.5, Math.min(1.5, v.scale));
    for (const l of labels) {
      const size = l.size || 10;
      ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      const hw = ctx.measureText(l.text).width / 2 + size * .2;
      let x = l.x, y = l.y;
      // anchors whose text would be wholly off-screen belong to off-screen objects: skip, don't drag them in
      if (x + hw < v.x || x - hw > v.x + v.w || y + size < v.y || y - size > v.y + v.h) continue;
      if (v.w > 2 * (hw + m)) x = clamp(x, v.x + m + hw, v.x + v.w - m - hw);
      for (const p of placed) if (Math.abs(p.x - x) < 70 && Math.abs(p.y - y) < 13) y = p.y - 14;
      if (l.avoidThermal && compactLandscape) {
        const sx = (x - v.x) * v.scale, sy = (y - v.y) * v.scale, shw = hw * v.scale, shh = size * v.scale * .7;
        if (sx + shw > 12 && sx - shw < 178 && sy + shh > 114 && sy - shh < 160) y = v.y + 174 / v.scale;
      }
      const top = v.y + m + size * .7, bot = v.y + v.h - m - size * .7;
      if (y < top) { y = top; for (const p of placed) if (Math.abs(p.x - x) < 70 && Math.abs(p.y - y) < 13) y = p.y + 14; }
      y = Math.min(y, bot);
      placed.push({ x, y });
      ctx.globalAlpha = l.dim ? .8 : 1;
      text(ctx, l.text, x, y, size, l.color);
    }
    ctx.globalAlpha = 1;
    labels = [];
  }

  // ---------------------------------------------------------------- atmosphere (screen space)
  function atmosphere(ctx, s, th, t, v, width, height) {
    const sx = x => (x - v.x) * v.scale, sy = y => (y - v.y) * v.scale;
    ctx.save();
    if (th.decor === 'crown') {
      // The observatory's key light moves slowly across the view like light
      // leaking through a rotating lens, with sparse blue motes for scale.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const base = width * (.13 + i * .38), sway = Math.sin(t * .22 + i * 2.1) * width * .055;
        const x0 = base + sway, x1 = x0 - width * (.17 + i * .025);
        const gr = ctx.createLinearGradient(x0, 0, x1, height);
        gr.addColorStop(0, i === 1 ? 'rgba(255,211,156,.075)' : 'rgba(140,187,255,.055)');
        gr.addColorStop(.46, i === 1 ? 'rgba(255,210,164,.026)' : 'rgba(139,180,255,.022)');
        gr.addColorStop(1, 'rgba(105,147,220,0)');
        poly(ctx, [[x0 - 9, 0], [x0 + 34, 0], [x1 + width * .1, height], [x1 - width * .04, height]], gr);
      }
      const keeper = arr(s.enemies).find(e => enemyType(e) === 'crown' && num(e.hp, 0) > 0);
      if (keeper) {
        const x = sx(keeper.x), y = sy(keeper.y - 4);
        if (x > -100 && x < width + 100 && y > -100 && y < height + 100)
          bloom(ctx, x, y, 82 * v.scale, crownExposed(keeper) ? '135,255,218' : '138,174,255', .24);
      }
      for (let i = 0; i < 22; i++) {
        const x = ((i * 137.7 + t * (2.2 + (i % 4) * .5)) % (width + 40)) - 20;
        const y = ((i * 83.1 + Math.sin(t * .35 + i) * 11 + t * 1.7) % (height + 24)) - 12;
        const a = .11 + .09 * Math.sin(t * .7 + i * 1.3);
        circle(ctx, x, y, i % 5 === 0 ? 1.5 : .8, `rgba(201,224,255,${a})`);
      }
    } else if (th.decor === 'beacon') {
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
    } else if (th.decor === 'verdant') {
      verdantAtmosphere(ctx, s, th, t, v, width, height);
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
  // Canopy shade: a tileable map of leaf shadow, baked into verdant light maps.
  let leafTile = null;
  function leafShadowTile() {
    if (leafTile || !hasDoc) return leafTile;
    const S = 320, c = makeCanvas(S, S), g = c.getContext('2d'), rng = rngFor(911);
    for (let i = 0; i < 70; i++) {
      const x = rng() * S, y = rng() * S, r = 18 + rng() * 44;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        const gr = g.createRadialGradient(x + ox, y + oy, r * .2, x + ox, y + oy, r);
        gr.addColorStop(0, 'rgba(6,24,10,.55)'); gr.addColorStop(1, 'rgba(6,24,10,0)');
        g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
    leafTile = c; return c;
  }
  const canopyCache = { key: '', c: null };
  function canopyFrame(w, h) {
    // Overhanging foliage in the screen corners: foreground depth without covering play.
    const key = w + 'x' + h;
    if (canopyCache.key === key) return canopyCache.c;
    const c = makeCanvas(w, h), g = c.getContext('2d'), rng = rngFor(4242), m = Math.min(w, h);
    const corners = [[0, 0, 1], [w, 0, 1], [0, h, .7], [w, h, .7]];
    for (const [cx, cy, sc] of corners) {
      const R = m * .2 * sc;
      for (let i = 0; i < 26; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * R, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * .8, r = R * (.12 + rng() * .14);
        leafBlob(g, x, y, r, rng, 100 + rng() * 25, 8 + (1 - d / R) * 4 + rng() * 8, .97);
      }
      for (let i = 0; i < 10; i++) { // lit leaf edges catching the sun
        const a = rng() * TAU, d = R * (.55 + rng() * .4), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * .8;
        ellipse(g, x, y, 5 + rng() * 5, 2.4 + rng() * 2, hsl(78 + rng() * 20, 55, 30 + rng() * 14, .85), null, 0, rng() * 3);
      }
    }
    for (let i = 0; i < Math.round(w / 90); i++) { // hanging tendrils from the top edge
      const x = rng() * w; if (x > w * .3 && x < w * .7 && rng() < .6) continue;
      const len = m * (.04 + rng() * .08); g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (rng() - .5) * 16, len * .6, x + (rng() - .5) * 10, len);
      g.strokeStyle = 'rgba(14,36,16,.9)'; g.lineWidth = 2; g.stroke();
      for (let q = .2; q < 1; q += .2) ellipse(g, x + (rng() - .5) * 8, len * q, 4, 2.4, hsl(100, 45, 14 + rng() * 10), null, 0, rng() * 3);
    }
    canopyCache.key = key; canopyCache.c = c; return c;
  }
  function verdantAtmosphere(ctx, s, th, t, v, width, height) {
    ctx.globalCompositeOperation = 'lighter';
    const sx = x => (x - v.x) * v.scale;
    for (let i = 0; i < 3; i++) { // god rays through canopy gaps
      const x0 = sx(120 + i * 340), sway = Math.sin(t * .25 + i * 1.7) * 18 * v.scale, a = .045 + .02 * Math.sin(t * .4 + i);
      const gr = ctx.createLinearGradient(x0, 0, x0 + 200 * v.scale, height);
      gr.addColorStop(0, `rgba(255,236,170,${a})`); gr.addColorStop(1, 'rgba(255,236,170,0)');
      poly(ctx, [[x0 + sway, 0], [x0 + 60 * v.scale + sway, 0], [x0 + 330 * v.scale + sway, height], [x0 + 190 * v.scale + sway, height]], gr);
    }
    for (let i = 0; i < 24; i++) { // pollen motes
      const x = ((i * 131.3 + Math.sin(t * .4 + i) * 40 + t * 6) % width + width) % width, y = ((i * 77.7 + t * 5 * (1 + i % 3)) % height + height) % height;
      bloom(ctx, x, y, 4 * v.scale, i % 4 ? '255,240,170' : '200,255,190', .35 + .25 * Math.sin(t * 2 + i));
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 9; i++) { // falling leaves
      const ph = (t * .07 + i * .113) % 1, x = ((i * 211.7 + Math.sin(t * .8 + i) * 30 * v.scale + ph * 80) % width + width) % width, y = ph * (height + 40) - 20;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 1.5 + i); ctx.scale(v.scale, v.scale * (.4 + .6 * Math.abs(Math.sin(t * 2 + i))));
      ellipse(ctx, 0, 0, 4.2, 2.2, i % 3 ? 'rgba(170,200,80,.85)' : 'rgba(220,160,60,.85)', 'rgba(30,40,10,.5)', .6);
      ctx.restore();
    }
  }
  function compactCanvasHud(width, height) {
    return width <= 600 || (width <= 1000 && height <= 480);
  }
  function tideGauge(ctx, s, t, width, height) {
    if (!tideOn(s)) return;
    const lv = clamp(num(s.tide.level, 0), 0, 1), w = tideWarn(s), high = tideHigh(s);
    const compact = compactCanvasHud(width, height), portrait = height > width;
    const storedCard = !!(s.darkness && s.player && s.flags && s.flags['stored-light']);
    const W = portrait && width < 360 ? 116 : 138, H = 36;
    const compactLandscape = width <= 1000 && height <= 480;
    const x = portrait && storedCard ? 12 : storedCard && !compactLandscape ? width - 168 - 12 - 8 - W : width - W - 12;
    const y = compact ? 100 : width < 640 && arr(s.enemies).some(e => (enemyType(e) === 'diver' || enemyType(e) === 'hart') && num(e.hp, 0) > 0) ? 50 : 12;
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
  function thermalGauge(ctx, s, t, width, height) {
    const th = s.thermal;
    if (!th || regionOf(s) !== 'glass-kiln') return;
    const hot = !!th.hot, phase = clamp(num(th.phase, 0), 0, 1), flipIn = Math.max(0, num(th.flipIn, 0));
    const compact = compactCanvasHud(width, height), compactLandscape = width <= 1000 && height <= 480;
    const W = 166, H = 46, x = compactLandscape ? 12 : Math.max(12, width - W - 12), y = compact ? (compactLandscape ? 114 : (tideOn(s) ? 145 : 100)) : 12, rgb = hot ? '255,128,66' : '115,203,255';
    ctx.save();
    rrect(ctx, x, y, W, H, 8); ctx.fillStyle = 'rgba(8,12,18,.86)'; ctx.fill();
    ctx.strokeStyle = hot ? 'rgba(255,145,84,.58)' : 'rgba(134,211,255,.55)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(224,226,234,.75)'; ctx.fillText('KILN CYCLE', x + 10, y + 11);
    ctx.font = '800 12px system-ui, sans-serif'; ctx.fillStyle = hot ? '#ffca9d' : '#c7efff';
    ctx.fillText(hot ? 'HOT PHASE' : 'COOL PHASE', x + 10, y + 27);
    ctx.textAlign = 'right'; ctx.font = '700 10px system-ui, sans-serif'; ctx.fillStyle = 'rgba(240,238,230,.88)';
    ctx.fillText(`FLIP IN ${flipIn.toFixed(1)}s`, x + W - 10, y + 27);
    rrect(ctx, x + 10, y + 36, W - 20, 4, 2); ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fill();
    rrect(ctx, x + 10, y + 36, (W - 20) * phase, 4, 2); ctx.fillStyle = `rgba(${rgb},.92)`; ctx.fill();
    ctx.restore();
  }
  function bossBar(ctx, s, t, width, height) {
    const boss = arr(s.enemies).find(e => (enemyType(e) === 'diver' || ((enemyType(e) === 'hart' || enemyType(e) === 'crown') && e.phase !== 'dormant' && e.phase !== 'defeated')) && num(e.hp, 0) > 0);
    if (!boss) return;
    const type = enemyType(boss), hart = type === 'hart', crown = type === 'crown';
    const stage = crownStage(boss), opened = crown ? crownExposed(boss) : hart ? hartState(boss).exposed : diverState(boss).exposed;
    const max = num(boss.maxHp, hart ? 8 : crown ? 6 : 10) || 10, hp = num(boss.hp, 0);
    const compact = compactCanvasHud(width, height), compactLandscape = width <= 1000 && height <= 480;
    const compactPortrait = width <= 820 && height > width, hasThermal = !!s.thermal && regionOf(s) === 'glass-kiln';
    const panelOffset = compact ? (tideOn(s) ? 45 : 0) + (hasThermal ? 55 : 0) : 0;
    const W = Math.min(360, width - 180), x = (width - W) / 2;
    const y = compactPortrait ? 188 + panelOffset : compactLandscape ? 124 : compact ? 112 + panelOffset : 16;
    const name = hart ? 'THE ROOT HART' : crown ? 'THE ECLIPSE KEEPER' : 'THE BELL DIVER';
    const trim = hart ? '#8ab860' : crown ? (stage === 2 ? '#8bcde4' : stage === 3 ? '#e4a569' : '#c8a060') : '#c8a060';
    const fill = opened ? '#8ff2ce' : crown ? (stage === 2 ? '#74cbe2' : stage === 3 ? '#e9a66e' : '#e8785a') : '#e8785a';
    ctx.save();
    text(ctx, name, width / 2, y, 11, hart ? '#d8f0b8' : crown && stage === 2 ? '#c8f3ff' : '#f0d8a8');
    rrect(ctx, x, y + 9, W, 11, 5); ctx.fillStyle = 'rgba(8,16,20,.85)'; ctx.fill(); ctx.strokeStyle = trim; ctx.lineWidth = 1.3; ctx.stroke();
    const seg = W / max;
    for (let i = 0; i < max; i++) {
      if (i < hp) { ctx.fillStyle = fill; ctx.fillRect(x + 2 + i * seg, y + 11, seg - 2, 7); }
    }
    ctx.restore();
  }
  function lightGauge(ctx, s, width, height) {
    if (!s.darkness || !s.player || !(s.flags && s.flags['stored-light'])) return;
    const p = s.player, charge = clamp(num(p.lightCharge, 0), 0, 1), burst = Math.max(0, num(s.burstTime, 0));
    const compact = compactCanvasHud(width, height), landscape = width <= 1000 && height <= 480;
    const W = 168, H = 48, x = landscape ? 12 : Math.max(12, width - W - 12), y = compact ? (landscape ? 114 : 100) : 12;
    ctx.save(); rrect(ctx, x, y, W, H, 8); ctx.fillStyle = 'rgba(11,18,39,.94)'; ctx.fill(); ctx.strokeStyle = '#a6bee4'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d6eaff'; ctx.fillText(burst > 0 ? `PATHS REVEALED · ${burst.toFixed(1)}s` : 'STORED LIGHT', x + 9, y + 12);
    ctx.fillStyle = charge >= 1 ? '#c7ffe2' : '#d1d7eb';
    ctx.fillText(charge >= 1 ? 'READY · USE BURST' : p.lightCharging ? 'RECHARGING' : 'FIND A SUN PAD', x + 9, y + 27);
    ctx.fillStyle = '#283452'; ctx.fillRect(x + 9, y + 38, W - 18, 4);
    ctx.fillStyle = charge >= 1 ? '#b9ffde' : '#acdfff'; ctx.fillRect(x + 9, y + 38, (W - 18) * charge, 4);
    ctx.restore();
  }
  function objectiveTargets(s, W, H) {
    const out = [];
    const o = s.objective;
    if (o && typeof o === 'object' && Number.isFinite(o.x) && Number.isFinite(o.y)) { out.push({ x: o.x, y: o.y, label: String(o.label || o.text || 'OBJECTIVE').toUpperCase().slice(0, 18), color: '#f3ca78' }); return out; }
    const enemies = arr(s.enemies).filter(e => num(e.hp, 0) > 0);
    if (s.darkness) {
      const p = s.player || {};
      const pickup = arr(s.pickups).find(k => k.kind === 'stored-light' && !k.taken);
      if (pickup) return [{ x: pickup.x, y: pickup.y, label: 'STORED LIGHT', color: '#c5edff' }];
      if (num(p.lightCharge, 0) < 1 && num(s.burstTime, 0) <= 0 && arr(s.rechargePads).length) {
        const pad = arr(s.rechargePads).slice().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        return [{ x: pad.x, y: pad.y, label: 'RECHARGE', color: '#c5edff' }];
      }
      const twin = enemies.find(e => enemyType(e) === 'twin');
      if (twin) return [{ x: twin.x, y: twin.y, label: twin.shielded ? 'TWIN SHIELD' : 'TWIN EXPOSED', color: '#e1c7ff' }];
    }
    const boss = enemies.find(e => enemyType(e) === 'diver' || enemyType(e) === 'hart' || enemyType(e) === 'crown');
    if (boss) {
      const ty = enemyType(boss), stage = crownStage(boss);
      const label = ty === 'hart' ? 'ROOT HART' : ty === 'crown' ? (stage === 2 ? 'KEEPER CIRCUITS' : stage === 3 ? 'ECLIPSE KEEPER' : 'RETURN ARTILLERY') : 'BELL DIVER';
      out.push({ x: boss.x, y: boss.y, label, color: ty === 'crown' ? (stage === 2 ? '#bceeff' : '#ffcf91') : '#efb38e' }); return out;
    }
    const seals = arr(s.receivers).filter(r => !r.active && receiverKind(r) !== 'sanctuary');
    if (seals.length) {
      for (const r of seals.slice(0, 2)) out.push({ x: r.x, y: r.y, label: receiverKind(r) === 'bell' ? 'BELL' : receiverKind(r) === 'pump' ? 'PUMP' : 'SUN SEAL', color: receiverKind(r) === 'pump' ? '#9ff5d2' : '#f3ca78' });
      const p = s.player || { x: 0, y: 0 };
      const sun = arr(s.beams).find(b => b.kind === 'sun');
      if (sun && segDist(p.x, p.y, sun.x1, sun.y1, sun.x2, sun.y2) > 80) {
        const L = Math.hypot(sun.x2 - sun.x1, sun.y2 - sun.y1) || 1, tt = clamp(((p.x - sun.x1) * (sun.x2 - sun.x1) + (p.y - sun.y1) * (sun.y2 - sun.y1)) / (L * L), 0, 1);
        out.push({ x: sun.x1 + (sun.x2 - sun.x1) * tt, y: sun.y1 + (sun.y2 - sun.y1) * tt, label: 'SUNBEAM', color: '#ffd98a' });
      }
      return out;
    }
    const awake = enemies.find(e => enemyType(e) === 'sentinel' && e.phase !== 'dormant');
    if (awake) { out.push({ x: awake.x, y: awake.y, label: sentinelName(awake), color: '#efb38e' }); return out; }
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
    const fwd = exits.filter(e => ROOM_ORDER.indexOf(e.to) > here && !OPTIONAL_ROOMS.includes(e.to)).sort((a, b) => ROOM_ORDER.indexOf(a.to) - ROOM_ORDER.indexOf(b.to))[0] || exits.find(e => !arr(s.visited).includes(e.to));
    if (fwd) out.push({ x: fwd.x + fwd.w / 2, y: fwd.y + fwd.h / 2, label: roomName(fwd.to).toUpperCase().slice(0, 16), color: '#cdeee2' });
    return out;
  }
  function edgeArrows(ctx, s, v, width, height, t) {
    const { W, H } = dims(s);
    const indicators = [];
    for (const o of objectiveTargets(s, W, H)) {
      const x = (o.x - v.x) * v.scale, y = (o.y - v.y) * v.scale;
      if (x > 20 && x < width - 20 && y > 20 && y < height - 20) continue;
      ctx.font = '700 10px system-ui, sans-serif';
      const tw = Math.min(ctx.measureText(o.label).width + 14, Math.max(40, width - 12));
      const margin = Math.min(tw / 2 + 6, Math.max(0, width / 2 - 4));
      const cx = clamp(x, margin, width - margin);
      let cy = clamp(y, 64, Math.max(64, height - 80));
      for (const prev of indicators) if (Math.abs(cx - prev.x) < 96 && Math.abs(cy - prev.y) < 44) cy = prev.y + 44 <= height - 38 ? prev.y + 44 : prev.y - 44;
      const compactLandscape = width <= 1000 && height <= 480;
      const labelCrossesThermal = cx + tw / 2 > 12 && cx - tw / 2 < 178 && cy + 30 > 114 && cy + 12 < 160;
      if (compactLandscape && labelCrossesThermal) cy = Math.max(cy, 174);
      indicators.push({ x: cx, y: cy });
      const a = Math.atan2(y - cy, x - cx), pulse = 1 + .08 * Math.sin(t * 5);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.scale(pulse, pulse);
      poly(ctx, [[15, 0], [-2, -8], [2, 0], [-2, 8]], o.color, '#081820', 2);
      ctx.restore();
      rrect(ctx, cx - tw / 2, cy + 12, tw, 18, 9); ctx.fillStyle = 'rgba(8,24,32,.85)'; ctx.fill(); ctx.strokeStyle = o.color; ctx.lineWidth = 1; ctx.stroke();
      text(ctx, o.label, cx, cy + 21.5, 10, o.color);
    }
  }
  function titleCard(ctx, s, t, width, height) {
    const id = roomId(s);
    if (roomMemo.id !== id || t < roomMemo.since) { roomMemo.id = id; roomMemo.since = t; }
    const age = Number.isFinite(s.roomTime) ? s.roomTime : t - roomMemo.since;
    const compactMobile = width < 600 || (width < 1000 && height < 500);
    const lifetime = compactMobile ? 1.2 : 2.8;
    const fadeIn = compactMobile ? .22 : .5, fadeOut = compactMobile ? .28 : .7;
    if (age > lifetime || !s.room || s.status === 'ready') return;
    const a = clamp(Math.min(age / fadeIn, (lifetime - age) / fadeOut), 0, 1);
    const th = themeFor(s);
    ctx.save(); ctx.globalAlpha = a;
    const cy = compactMobile ? (height < 500 ? 128 : width < 420 ? 128 : clamp(height * .18, 142, 166)) : Math.max(70, height * .2);
    const gr = ctx.createLinearGradient(0, cy - 40, 0, cy + 40);
    gr.addColorStop(0, 'rgba(4,12,16,0)'); gr.addColorStop(.5, 'rgba(4,12,16,.55)'); gr.addColorStop(1, 'rgba(4,12,16,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, cy - 44, width, 88);
    const reg = typeof PW.regionById === 'function' && PW.regionById(regionOf(s));
    const rn = (reg && reg.name ? reg.name : 'Tidal Abbey').toUpperCase();
    const ch = rn + ' · ' + (s.room.challenge || 'OPTIONAL');
    text(ctx, ch, width / 2, cy - 18, 10, '#c8b890');
    ctx.font = `600 ${Math.min(30, width / 14)}px Georgia, "Times New Roman", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4ecd6'; ctx.fillText(s.room.name || roomName(id), width / 2, cy + 6);
    if (!compactMobile) { ctx.font = 'italic 13px Georgia, "Times New Roman", serif'; ctx.fillStyle = 'rgba(220,230,220,.8)'; ctx.fillText(th.title, width / 2, cy + 28); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- frame
  // Static layer density: 2x covers phones and laptops; very large displays get 3x.
  function bucket(k, devW) { return clamp(Math.round(k * 4) / 4, .5, devW > 2400 ? 3 : 2); }
  function kilnWorldWash(ctx, W, H) {
    // Fixed in world coordinates so basalt, cast shadows, props and actors share one key.
    const key = ctx.createLinearGradient(0, 0, W, H);
    key.addColorStop(0, 'rgba(255,226,184,.11)');
    key.addColorStop(.38, 'rgba(255,241,218,.025)');
    key.addColorStop(.62, 'rgba(18,23,34,.025)');
    key.addColorStop(1, 'rgba(4,9,18,.13)');
    ctx.fillStyle = key; ctx.fillRect(0, 0, W, H);
    // A quiet north-to-south veil sets the outer masonry back from the playable floor.
    const depth = ctx.createLinearGradient(0, 0, 0, H);
    depth.addColorStop(0, 'rgba(9,18,30,.055)');
    depth.addColorStop(.38, 'rgba(9,18,30,.018)');
    depth.addColorStop(.66, 'rgba(9,18,30,0)');
    depth.addColorStop(1, 'rgba(229,182,120,.025)');
    ctx.fillStyle = depth; ctx.fillRect(0, 0, W, H);
  }
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
      for (const l of st.meta.lanterns) { bloom(ctx, l.x, l.y, 10 + Math.sin(t * 11 + l.x) * 1.2, '255,220,140', .95); bloom(ctx, l.x, l.y + 6, 46, WARM, .22 + .05 * Math.sin(t * 7 + l.x)); }
      for (const c of st.meta.channels) { // light running along the aqueduct crowns
        const horiz = c.w >= c.h, L = horiz ? c.w : c.h;
        for (let d = (t * 24) % 120; d < L; d += 120) bloom(ctx, horiz ? c.x + d : c.x + c.w / 2, horiz ? c.y + c.h / 2 : c.y + d, 7, '200,255,230', .18);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const sp of st.meta.spouts) { // water pouring from sluice spouts
        const rgb = sp.rgb || '190,230,245';
        for (let i = 0; i < 3; i++) line(ctx, sp.x - 4 + i * 4, sp.y, sp.x - 4 + i * 4 + Math.sin(t * 9 + i) * .6, sp.y + 14, `rgba(${rgb},.55)`, 1.6);
        ellipse(ctx, sp.x, sp.y + 16, 8 + Math.sin(t * 8) * 1.5, 3, null, sp.rgb ? `rgba(${rgb},.5)` : 'rgba(210,240,250,.5)', 1.2);
      }
    }
    drawWater(ctx, s, t, th);
    drawNightPaths(ctx, s, t);
    drawWeaverLoomFloor(ctx, s);
    drawGlass(ctx, s, t);
    drawBridges(ctx, s, t, th);
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
      else if (ty === 'mortar') drawMortarFloor(ctx, e, s, t);
      else if (ty === 'hart') drawHartFloor(ctx, e, s, t);
      else if (ty === 'crown') drawCrownFloor(ctx, e, s, t);
      else if (ty === 'shade' || ty === 'twin') drawNightEnemyFloor(ctx, e, s, t);
      else drawSentinelFloor(ctx, e, s, t);
    }
    drawLobsFloor(ctx, s, t);
    // y-sorted props and actors
    const items = [];
    for (const e of emittersOf(s)) if (Number.isFinite(e.x)) items.push([e.y, () => drawEmitter(ctx, e, t)]);
    for (const r of arr(s.receivers)) if (Number.isFinite(r.x)) items.push([r.y, () => drawReceiver(ctx, r, t, s)]);
    for (const m of arr(s.mirrors)) if (Number.isFinite(m.x)) items.push([m.y, () => drawMirror(ctx, m, t, s)]);
    for (const p of arr(s.pickups)) if (Number.isFinite(p.x)) items.push([p.y, () => drawPickup(ctx, p, s, t)]);
    for (const e of arr(s.enemies)) {
      if (!Number.isFinite(e.x)) continue;
      const ty = enemyType(e);
      items.push([e.y, ty === 'shade' || ty === 'twin' ? () => drawNightEnemy(ctx, e, s, t) : ty === 'turret' ? () => drawTurret(ctx, e, s, t) : ty === 'diver' ? () => drawDiver(ctx, e, s, t) : ty === 'mortar' ? () => drawMortar(ctx, e, s, t) : ty === 'hart' ? () => drawHart(ctx, e, s, t) : ty === 'crown' ? () => drawCrown(ctx, e, s, t, width, height) : () => drawSentinel(ctx, e, s, t, width, height)]);
    }
    for (const gr of arr(s.growth)) if (finiteRect(gr)) items.push([gr.alive === false ? gr.y : gr.y + gr.h - 10, () => drawGrowth(ctx, gr, s, t)]);
    for (const d of arr(s.dams)) if (finiteRect(d)) items.push([d.broken || num(d.hp, 2) <= 0 ? d.y : d.y + d.h, () => drawDam(ctx, d, s, t)]);
    for (const l of arr(s.levers)) if (l && Number.isFinite(l.x) && Number.isFinite(l.y)) items.push([l.y, () => drawLever(ctx, l, s, t)]);
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
    drawLobsAir(ctx, s, t);
    drawRings(ctx, s, t);
    ctx.globalCompositeOperation = 'lighter';
    drawBeamCores(ctx, s, t);
    flushGlow(ctx);
    drawParticles(ctx, s);
    ctx.globalCompositeOperation = 'source-over';
    drawShots(ctx, s, t);
    if (th.floor === 'kiln') kilnWorldWash(ctx, W, H);
    drawLabels(ctx, v);
    ctx.restore();
    // screen space
    atmosphere(ctx, s, th, t, v, width, height);
    if (hasDoc) {
      ctx.drawImage(vignette(Math.round(width), Math.round(height), th.vignette, th.decor === 'verdant' ? '2,10,4' : '2,8,12'), 0, 0, width, height);
      if (th.decor === 'verdant') ctx.drawImage(canopyFrame(Math.round(width), Math.round(height)), 0, 0, width, height);
    }
    titleCard(ctx, s, t, width, height);
    tideGauge(ctx, s, t, width, height);
    thermalGauge(ctx, s, t, width, height);
    if (!(width <= 1000 && height <= 480)) lightGauge(ctx, s, width, height);
    bossBar(ctx, s, t, width, height);
    edgeArrows(ctx, s, v, width, height, t);
    const tr = clamp(num(s.transition, 0), 0, 1);
    if (tr > 0) { ctx.fillStyle = `rgba(2,8,12,${tr})`; ctx.fillRect(0, 0, width, height); }
    ctx.restore();
  };
})(typeof window !== 'undefined' ? window : globalThis);
