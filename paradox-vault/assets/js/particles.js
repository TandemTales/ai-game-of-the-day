/* =====================================================================
   PARADOX VAULT — particles.js
   Pooled, allocation-free VFX particle system.  See SPEC.md §5.
   Owner: agent-particles.

   Design notes
   ------------
   * Storage is parallel typed arrays (SoA).  No particle objects exist.
   * A free-list + dense active-index list gives O(1) alloc / O(1) kill.
   * When the pool is at PV.quality.maxParticles (read LIVE, it changes at
     runtime) we evict the oldest particle of equal-or-lower priority
     instead of dropping the new emit or growing the pool.
   * ALL sprite art is baked once at init() into small offscreen canvases,
     pre-tinted into a fixed set of colour variants.  update()/draw() never
     touch createRadialGradient, filter, string building, or object literals.
   * draw() batches by (layer, blend) into four pre-allocated index buckets
     so globalCompositeOperation is assigned at most twice per layer.
   * Randomness uses a PRIVATE rng so particle emission can never perturb
     PV.rand()'s deterministic stream (echo replay / level gen depend on it).
   ===================================================================== */
(function (global) {
  'use strict';

  var PV = global.PV || (global.PV = {});
  var M = Math;
  var TAU = M.PI * 2;

  /* ------------------------------------------------------------------
     Private RNG (mulberry32) — never touches PV.rand()
     ------------------------------------------------------------------ */
  var _rs = 0x1f83d9ab >>> 0;
  function rnd() {
    _rs = (_rs + 0x6D2B79F5) >>> 0;
    var t = _rs;
    t = M.imul(t ^ (t >>> 15), t | 1);
    t ^= t + M.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rr(a, b) { return a + rnd() * (b - a); }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /* ------------------------------------------------------------------
     Colour variants.  [core, mid, outer]
     ------------------------------------------------------------------ */
  var C_GOLD = 0, C_AMBER = 1, C_RED = 2, C_CRIMSON = 3, C_CYAN = 4,
      C_VIOLET = 5, C_TEAL = 6, C_WHITE = 7, C_PALE = 8, C_SMOKEL = 9,
      C_SMOKED = 10, C_STEAM = 11, C_BRASS = 12, C_INK = 13;
  var NCOL = 14;

  /* Cores are deliberately TINTED, never pure white: these sprites are drawn
     with 'lighter', so overlapping cores reach white on their own.  A pure
     white core desaturates the whole effect and blows out under bloom. */
  var COLORS = [
    ['#fff4cf', '#ffbe2e', '#8e2f00'],  /* gold    - hot spark        */
    ['#ffd089', '#ff7d14', '#3e0e00'],  /* amber   - cooling spark    */
    ['#ffdccf', '#ff5533', '#7d0c1f'],  /* red     - hot alarm spark  */
    ['#ff9c86', '#ff2444', '#2c0208'],  /* crimson - cooling alarm    */
    ['#d6ffff', '#3ae6ff', '#05384f'],  /* cyan                       */
    ['#e3d2ff', '#8b4dff', '#1b0642'],  /* violet                     */
    ['#ccfff4', '#1fd2c4', '#033430'],  /* teal                       */
    ['#ffffff', '#dce8fb', '#5d6a7e'],  /* white                      */
    ['#f6efdd', '#c9bfa6', '#453f30'],  /* pale    - floor dust       */
    ['#a9b0bd', '#5b6270', '#1b1f27'],  /* smokeLt                    */
    ['#616874', '#2b3038', '#080a0e'],  /* smokeDk                    */
    ['#ffffff', '#dbe6f4', '#8593a8'],  /* steam                      */
    ['#ffeaa8', '#c9a227', '#4a3708'],  /* brass                      */
    ['#8f5fd8', '#3a1a6e', '#06030f']   /* ink     - energy discharge */
  ];

  var COLNAME = {
    gold: C_GOLD, amber: C_AMBER, red: C_RED, crimson: C_CRIMSON,
    cyan: C_CYAN, violet: C_VIOLET, teal: C_TEAL, white: C_WHITE,
    pale: C_PALE, smoke: C_SMOKED, smokeLight: C_SMOKEL, steam: C_STEAM,
    brass: C_BRASS, ink: C_INK
  };

  /* ------------------------------------------------------------------
     Sprite kinds
     ------------------------------------------------------------------ */
  var SP_DOT = 0, SP_CORE = 1, SP_STREAK = 2, SP_SHARD = 3,
      SP_PUFF0 = 4, SP_PUFF1 = 5, SP_PUFF2 = 6, SP_RING = 7,
      SP_FOILL = 8, SP_FOILD = 9, SP_SPLAT = 10, SP_GLASS = 11,
      SP_SHOCK = 12, SP_FLARE = 13;
  var NSPR = 14;

  /* which colour variants get baked for each sprite kind */
  var SPR_COLS = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],          /* DOT    */
    [C_GOLD, C_AMBER, C_RED, C_CRIMSON, C_CYAN, C_VIOLET, C_TEAL, C_WHITE, C_STEAM, C_BRASS],
    [C_GOLD, C_AMBER, C_RED, C_CRIMSON, C_CYAN, C_VIOLET, C_TEAL, C_WHITE],
    [C_CYAN, C_VIOLET, C_TEAL, C_WHITE, C_GOLD],             /* SHARD  */
    [C_SMOKEL, C_SMOKED, C_STEAM, C_WHITE, C_VIOLET],
    [C_SMOKEL, C_SMOKED, C_STEAM, C_WHITE, C_VIOLET],
    [C_SMOKEL, C_SMOKED, C_STEAM, C_WHITE, C_VIOLET],
    [C_GOLD, C_RED, C_CYAN, C_VIOLET, C_TEAL, C_WHITE],      /* RING   */
    [C_GOLD, C_TEAL, C_BRASS, C_WHITE, C_VIOLET, C_RED],     /* FOIL L */
    [C_GOLD, C_TEAL, C_BRASS, C_WHITE, C_VIOLET, C_RED],     /* FOIL D */
    [C_INK, C_VIOLET, C_RED, C_CYAN],                        /* SPLAT  */
    [C_WHITE, C_CYAN, C_GOLD],                               /* GLASS  */
    [C_CYAN, C_VIOLET, C_WHITE, C_GOLD],                     /* SHOCK  */
    [C_CYAN, C_VIOLET, C_WHITE, C_GOLD]                      /* FLARE  */
  ];

  /* sprites[spriteKind][colorIdx] -> HTMLCanvasElement */
  var sprites = new Array(NSPR);

  /* ------------------------------------------------------------------
     Particle types
     ------------------------------------------------------------------ */
  var T_DUST = 0, T_SPARKG = 1, T_SPARKR = 2, T_HOLO = 3, T_SMOKE = 4,
      T_GLASS = 5, T_EMBER = 6, T_MOTES = 7, T_RIPPLE = 8, T_CHRONO = 9,
      T_STEAM = 10, T_CONFETTI = 11, T_BLOOD = 12,
      /* internal, driven by the chrono composite */
      T_FLASH = 13, T_SHOCK = 14, T_AFTER = 15;
  var NTYPE = 16;

  var TYPENAME = {
    dust: T_DUST, sparkGold: T_SPARKG, sparkRed: T_SPARKR,
    holoShard: T_HOLO, smoke: T_SMOKE, glassShard: T_GLASS,
    emberFloat: T_EMBER, motes: T_MOTES, ripple: T_RIPPLE,
    chrono: T_CHRONO, steam: T_STEAM, confetti: T_CONFETTI,
    bloodless: T_BLOOD
  };
  var TYPELIST = ['dust', 'sparkGold', 'sparkRed', 'holoShard', 'smoke',
    'glassShard', 'emberFloat', 'motes', 'ripple', 'chrono', 'steam',
    'confetti', 'bloodless'];

  /* 0 = ground (under actors), 1 = air */
  var LAYER = new Uint8Array([0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1]);
  /* 0 = source-over, 1 = lighter */
  var BLEND = new Uint8Array([0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 1, 1]);
  /* eviction priority — a new particle may only evict prio <= its own */
  var PRIO = new Uint8Array([50, 140, 145, 150, 100, 120, 40, 30, 120,
                             210, 100, 130, 120, 220, 210, 205]);

  /* ------------------------------------------------------------------
     Pool storage
     ------------------------------------------------------------------ */
  var CAP = 2500;

  var px, py, vx, vy, life, maxLife, size, size2, rot, vrot,
      ph, vph, tx, ty, birth, delay, seed;
  var ptype, pcol, pcol2, pspr;
  var freeList, freeCount = 0;
  var active, activeCount = 0, slotAt;
  var bGN, bGA, bAN, bAA;          /* draw buckets */
  var nGN = 0, nGA = 0, nAN = 0, nAA = 0;
  var bucketsDirty = true;
  var birthSeq = 0, scanCursor = 0;
  var capNow = CAP;
  var time = 0;
  var inited = false;
  var warned = false;

  function allocPool() {
    px = new Float32Array(CAP); py = new Float32Array(CAP);
    vx = new Float32Array(CAP); vy = new Float32Array(CAP);
    life = new Float32Array(CAP); maxLife = new Float32Array(CAP);
    size = new Float32Array(CAP); size2 = new Float32Array(CAP);
    rot = new Float32Array(CAP); vrot = new Float32Array(CAP);
    ph = new Float32Array(CAP); vph = new Float32Array(CAP);
    tx = new Float32Array(CAP); ty = new Float32Array(CAP);
    birth = new Float64Array(CAP); delay = new Float32Array(CAP);
    seed = new Float32Array(CAP);
    ptype = new Uint8Array(CAP); pcol = new Uint8Array(CAP);
    pcol2 = new Uint8Array(CAP); pspr = new Uint8Array(CAP);

    freeList = new Int32Array(CAP);
    active = new Int32Array(CAP);
    slotAt = new Int32Array(CAP);
    bGN = new Int32Array(CAP); bGA = new Int32Array(CAP);
    bAN = new Int32Array(CAP); bAA = new Int32Array(CAP);

    for (var i = 0; i < CAP; i++) freeList[i] = CAP - 1 - i;
    freeCount = CAP;
    activeCount = 0;
  }

  /* ==================================================================
     SPRITE BAKING  (init only)
     ================================================================== */
  function rgba(hex, a) { return PV.rgba(hex, a < 0 ? 0 : (a > 1 ? 1 : a)); }
  function mix(a, b, t) { return PV.mixHex(a, b, clamp01(t)); }

  function bakeDot(s, C) {
    var o = PV.makeCanvas(s, s), c = o.ctx, r = s * 0.5;
    var g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0.00, rgba(C[0], 1));
    g.addColorStop(0.16, rgba(C[0], 0.86));
    g.addColorStop(0.38, rgba(C[1], 0.50));
    g.addColorStop(0.66, rgba(C[2], 0.17));
    g.addColorStop(0.86, rgba(C[2], 0.05));
    g.addColorStop(1.00, rgba(C[2], 0));
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    return o.canvas;
  }

  function bakeCore(s, C) {
    var o = PV.makeCanvas(s, s), c = o.ctx, r = s * 0.5;
    /* wide soft halo */
    var g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0.00, rgba(C[1], 0.55));
    g.addColorStop(0.22, rgba(C[1], 0.34));
    g.addColorStop(0.52, rgba(C[2], 0.13));
    g.addColorStop(1.00, rgba(C[2], 0));
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    /* hot core */
    c.globalCompositeOperation = 'lighter';
    var cr = r * 0.34;
    var g2 = c.createRadialGradient(r, r, 0, r, r, cr);
    g2.addColorStop(0.00, rgba('#ffffff', 1));
    g2.addColorStop(0.30, rgba(C[0], 0.95));
    g2.addColorStop(0.65, rgba(C[1], 0.45));
    g2.addColorStop(1.00, rgba(C[1], 0));
    c.fillStyle = g2; c.fillRect(0, 0, s, s);
    return o.canvas;
  }

  /* elongated teardrop, head at the RIGHT edge (x ~= 0.94 * w) */
  var STREAK_W = 160, STREAK_H = 40, STREAK_HEAD = 0.94;
  function bakeStreak(C) {
    var w = STREAK_W, h = STREAK_H;
    var o = PV.makeCanvas(w, h), c = o.ctx, cy = h * 0.5;
    c.globalCompositeOperation = 'lighter';
    var x0 = h * 0.22, x1 = w - h * 0.25, N = 52, i, t, x, rad, a, col, g;
    for (i = 0; i <= N; i++) {
      t = i / N;
      x = x0 + (x1 - x0) * t;
      rad = (0.07 + 0.93 * M.pow(t, 0.9)) * (h * 0.47);
      a = M.pow(t, 2.1) * 0.62;
      col = t < 0.62 ? mix(C[2], C[1], t / 0.62) : mix(C[1], C[0], (t - 0.62) / 0.38);
      g = c.createRadialGradient(x, cy, 0, x, cy, rad);
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(0.45, rgba(col, a * 0.48));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(x - rad, cy - rad, rad * 2, rad * 2);
    }
    /* hot filament down the spine — tinted, NOT white, so the trail keeps its
       identity; only the last few pixels of the head go near-white */
    var lg = c.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0.00, rgba(C[2], 0));
    lg.addColorStop(0.40, rgba(C[1], 0.22));
    lg.addColorStop(0.80, rgba(C[1], 0.60));
    lg.addColorStop(1.00, rgba(C[0], 0.78));
    c.fillStyle = lg;
    c.fillRect(0, cy - h * 0.05, w, h * 0.10);
    c.globalAlpha = 0.40;
    c.fillRect(0, cy - h * 0.125, w, h * 0.25);
    c.globalAlpha = 1;
    /* head: a tight tinted core with only a small white pip */
    var hx = w * STREAK_HEAD, hr = h * 0.50;
    var hg = c.createRadialGradient(hx, cy, 0, hx, cy, hr);
    hg.addColorStop(0.00, rgba(C[0], 0.98));
    hg.addColorStop(0.26, rgba(C[1], 0.72));
    hg.addColorStop(0.58, rgba(C[1], 0.26));
    hg.addColorStop(1.00, rgba(C[1], 0));
    c.fillStyle = hg;
    c.fillRect(hx - hr, cy - hr, hr * 2, hr * 2);
    var pr = h * 0.17;
    var pg = c.createRadialGradient(hx, cy, 0, hx, cy, pr);
    pg.addColorStop(0.00, rgba('#ffffff', 0.92));
    pg.addColorStop(1.00, rgba('#ffffff', 0));
    c.fillStyle = pg;
    c.fillRect(hx - pr, cy - pr, pr * 2, pr * 2);
    return o.canvas;
  }

  /* ---- anamorphic lens flare: soft core + long horizontal bar + short
     vertical bar + a faint diagonal cross.  Used for the chrono terminal
     flash so it never reads as a plain round blob. ------------------- */
  var FLARE_S = 256;
  function bakeFlare(C) {
    var s = FLARE_S, o = PV.makeCanvas(s, s), c = o.ctx, r = s * 0.5;
    c.globalCompositeOperation = 'lighter';
    /* soft bloom */
    var g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0.00, rgba(C[0], 0.90));
    g.addColorStop(0.06, rgba(C[0], 0.62));
    g.addColorStop(0.16, rgba(C[1], 0.30));
    g.addColorStop(0.40, rgba(C[1], 0.10));
    g.addColorStop(0.72, rgba(C[2], 0.03));
    g.addColorStop(1.00, rgba(C[2], 0));
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    /* bars */
    var i, ang, bw, bh, lg2;
    for (i = 0; i < 4; i++) {
      ang = i === 0 ? 0 : (i === 1 ? M.PI * 0.5 : (i === 2 ? M.PI * 0.25 : -M.PI * 0.25));
      bw = i === 0 ? r * 1.98 : (i === 1 ? r * 0.82 : r * 0.46);
      bh = i === 0 ? s * 0.052 : (i === 1 ? s * 0.030 : s * 0.016);
      c.save(); c.translate(r, r); c.rotate(ang);
      lg2 = c.createLinearGradient(-bw, 0, bw, 0);
      lg2.addColorStop(0.00, rgba(C[1], 0));
      lg2.addColorStop(0.24, rgba(C[1], 0.16));
      lg2.addColorStop(0.50, rgba(C[0], i === 0 ? 0.80 : 0.55));
      lg2.addColorStop(0.76, rgba(C[1], 0.16));
      lg2.addColorStop(1.00, rgba(C[1], 0));
      c.fillStyle = lg2;
      /* taper the bar vertically with three stacked passes */
      c.globalAlpha = 0.5; c.fillRect(-bw, -bh, bw * 2, bh * 2);
      c.globalAlpha = 0.7; c.fillRect(-bw, -bh * 0.5, bw * 2, bh);
      c.globalAlpha = 1.0; c.fillRect(-bw, -bh * 0.17, bw * 2, bh * 0.34);
      c.globalAlpha = 1;
      c.restore();
    }
    /* white pip dead centre */
    var pr = s * 0.035;
    var pg = c.createRadialGradient(r, r, 0, r, r, pr);
    pg.addColorStop(0, rgba('#ffffff', 1));
    pg.addColorStop(1, rgba('#ffffff', 0));
    c.fillStyle = pg; c.fillRect(r - pr, r - pr, pr * 2, pr * 2);
    return o.canvas;
  }

  function bakeShard(s, C) {
    var o = PV.makeCanvas(s, s), c = o.ctx, r = s * 0.5;
    /* soft bloom behind the shard */
    var g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0.00, rgba(C[1], 0.34));
    g.addColorStop(0.42, rgba(C[1], 0.12));
    g.addColorStop(1.00, rgba(C[2], 0));
    c.fillStyle = g; c.fillRect(0, 0, s, s);

    c.save();
    c.translate(r, r);
    c.beginPath();
    c.moveTo(0, -s * 0.44);
    c.lineTo(s * 0.155, -s * 0.06);
    c.lineTo(s * 0.055, s * 0.45);
    c.lineTo(-s * 0.135, s * 0.03);
    c.closePath();
    var lg = c.createLinearGradient(-s * 0.15, -s * 0.4, s * 0.16, s * 0.4);
    lg.addColorStop(0.00, rgba(C[0], 0.85));
    lg.addColorStop(0.30, rgba(C[1], 0.62));
    lg.addColorStop(0.75, rgba(C[2], 0.42));
    lg.addColorStop(1.00, rgba(C[1], 0.55));
    c.fillStyle = lg;
    c.shadowColor = rgba(C[1], 0.9);
    c.shadowBlur = s * 0.10;
    c.fill();
    c.shadowBlur = 0;
    /* thin bright edge */
    c.lineWidth = M.max(1, s * 0.028);
    c.strokeStyle = rgba(C[0], 0.95);
    c.stroke();
    /* inner specular sliver */
    c.beginPath();
    c.moveTo(-s * 0.005, -s * 0.36);
    c.lineTo(s * 0.052, -s * 0.03);
    c.lineTo(s * 0.012, s * 0.32);
    c.strokeStyle = rgba('#ffffff', 0.55);
    c.lineWidth = M.max(1, s * 0.018);
    c.stroke();
    c.restore();
    return o.canvas;
  }

  /* Volumetric puff: a lumpy cluster of lobes lit from the upper-left with a
     real light/shadow range, plus a second pass of small high-frequency lobes
     around the silhouette so the edge is fibrous instead of a soft circle. */
  function bakePuff(s, C, variant) {
    var o = PV.makeCanvas(s, s), c = o.ctx, r = s * 0.5;
    var i, ang, rad, bx, by, br, lt, col, g, a;
    _rs = (0x51ed270b + variant * 0x9e3779b9 + C[1].charCodeAt(2) * 7919) >>> 0;

    /* 1. big body lobes */
    for (i = 0; i < 13; i++) {
      ang = rnd() * TAU;
      rad = M.pow(rnd(), 0.6) * s * 0.24;
      bx = r + M.cos(ang) * rad;
      by = r + M.sin(ang) * rad * 0.92;
      br = s * (0.135 + rnd() * 0.145);
      lt = clamp01(0.5 - ((bx - r) * 0.85 + (by - r) * 1.15) / (s * 0.55));
      col = mix(C[2], C[0], 0.06 + lt * lt * 1.05);
      a = 0.30 + rnd() * 0.26;
      g = c.createRadialGradient(bx - br * 0.22, by - br * 0.24, br * 0.05, bx, by, br);
      g.addColorStop(0.00, rgba(col, a));
      g.addColorStop(0.40, rgba(col, a * 0.72));
      g.addColorStop(0.74, rgba(mix(col, C[2], 0.5), a * 0.28));
      g.addColorStop(1.00, rgba(C[2], 0));
      c.fillStyle = g;
      c.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    /* 2. fine edge lobes -> fibrous silhouette */
    for (i = 0; i < 22; i++) {
      ang = rnd() * TAU;
      rad = s * (0.24 + rnd() * 0.13);
      bx = r + M.cos(ang) * rad;
      by = r + M.sin(ang) * rad * 0.94;
      br = s * (0.045 + rnd() * 0.085);
      lt = clamp01(0.5 - ((bx - r) * 0.85 + (by - r) * 1.15) / (s * 0.55));
      col = mix(C[2], C[0], 0.04 + lt * lt * 1.0);
      a = 0.14 + rnd() * 0.20;
      g = c.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0.00, rgba(col, a));
      g.addColorStop(0.50, rgba(col, a * 0.55));
      g.addColorStop(1.00, rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    /* 3. key rim light from the upper-left */
    c.globalCompositeOperation = 'lighter';
    var rl = c.createRadialGradient(r * 0.66, r * 0.62, 0, r * 0.70, r * 0.66, r * 0.80);
    rl.addColorStop(0.00, rgba(C[0], 0.24));
    rl.addColorStop(0.42, rgba(C[0], 0.10));
    rl.addColorStop(1.00, rgba(C[0], 0));
    c.fillStyle = rl; c.fillRect(0, 0, s, s);
    /* 4. occlude the lower-right so the puff has a shaded side */
    c.globalCompositeOperation = 'source-atop';
    var sh = c.createRadialGradient(r * 1.34, r * 1.38, r * 0.10, r * 1.30, r * 1.34, r * 1.25);
    sh.addColorStop(0.00, rgba(C[2], 0.55));
    sh.addColorStop(0.55, rgba(C[2], 0.20));
    sh.addColorStop(1.00, rgba(C[2], 0));
    c.fillStyle = sh; c.fillRect(0, 0, s, s);
    /* 5. soften the outer edge without flattening it */
    c.globalCompositeOperation = 'destination-in';
    var mg = c.createRadialGradient(r, r, 0, r, r, r);
    mg.addColorStop(0.00, 'rgba(0,0,0,1)');
    mg.addColorStop(0.62, 'rgba(0,0,0,1)');
    mg.addColorStop(0.86, 'rgba(0,0,0,0.55)');
    mg.addColorStop(1.00, 'rgba(0,0,0,0)');
    c.fillStyle = mg; c.fillRect(0, 0, s, s);
    return o.canvas;
  }

  /* Rings are the easiest thing in a particle system to get wrong: a
     constant-width stroked arc reads as flat vector art.  These are baked as
     a soft radial band whose *alpha varies around the circumference* (so the
     rim breaks up), with a faint inner wash and a fine bright crest that is
     itself dashed by an angular modulation. */
  var RING_R = 0.80;
  function bakeRingGeneric(s, C, opts_thin, opts_spokes, seedN) {
    var o = PV.makeCanvas(s, s), c = o.ctx, r = s * 0.5;
    var band = opts_thin ? 0.055 : 0.105;    /* half-width as a fraction of r */
    var g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0.00, rgba(C[2], 0));
    g.addColorStop(M.max(0, RING_R - band * 3.4), rgba(C[2], 0));
    g.addColorStop(M.max(0.01, RING_R - band * 1.9), rgba(C[2], 0.10));
    g.addColorStop(RING_R - band * 0.75, rgba(C[1], 0.42));
    g.addColorStop(RING_R, rgba(C[0], 0.92));
    g.addColorStop(RING_R + band * 0.85, rgba(C[1], 0.34));
    g.addColorStop(M.min(0.995, RING_R + band * 2.1), rgba(C[2], 0.08));
    g.addColorStop(1.00, rgba(C[2], 0));
    c.fillStyle = g; c.fillRect(0, 0, s, s);

    c.globalCompositeOperation = 'lighter';
    /* crest, drawn as many short arcs of varying alpha so the rim is alive */
    _rs = (0x2f9a1b77 + seedN * 0x9e3779b9) >>> 0;
    var i, N = 96, a0, a1, aa;
    c.lineWidth = M.max(1, s * (opts_thin ? 0.006 : 0.010));
    for (i = 0; i < N; i++) {
      a0 = (i / N) * TAU; a1 = ((i + 1.06) / N) * TAU;
      aa = 0.20 + 0.80 * M.pow(rnd(), 1.5);
      c.strokeStyle = rgba(i % 3 === 0 ? C[0] : C[1], aa * 0.55);
      c.beginPath(); c.arc(r, r, r * RING_R, a0, a1); c.stroke();
    }
    /* optional radiating spokes for the chrono shock ring */
    if (opts_spokes) {
      var ang, len, lw, sg;
      for (i = 0; i < 46; i++) {
        ang = rnd() * TAU;
        len = r * (0.10 + rnd() * 0.16);
        lw = s * (0.002 + rnd() * 0.006);
        c.save(); c.translate(r, r); c.rotate(ang);
        sg = c.createLinearGradient(r * RING_R - len, 0, r * RING_R + len * 0.35, 0);
        sg.addColorStop(0, rgba(C[1], 0));
        sg.addColorStop(0.72, rgba(C[0], 0.40));
        sg.addColorStop(1, rgba(C[1], 0));
        c.fillStyle = sg;
        c.fillRect(r * RING_R - len, -lw, len * 1.35, lw * 2);
        c.restore();
      }
    }
    return o.canvas;
  }
  function bakeRing(s, C) { return bakeRingGeneric(s, C, true, false, 3); }
  function bakeShock(s, C) { return bakeRingGeneric(s, C, false, true, 11); }

  function bakeFoil(w, h, C, lit) {
    var o = PV.makeCanvas(w, h), c = o.ctx;
    var top = lit ? mix(C[0], C[1], 0.25) : mix(C[1], '#000000', 0.62);
    var bot = lit ? mix(C[1], C[2], 0.45) : mix(C[2], '#000000', 0.35);
    var pad = 2;
    c.beginPath();
    var x = pad, y = pad, ww = w - pad * 2, hh = h - pad * 2, rad = M.min(ww, hh) * 0.12;
    c.moveTo(x + rad, y);
    c.lineTo(x + ww - rad, y); c.quadraticCurveTo(x + ww, y, x + ww, y + rad);
    c.lineTo(x + ww, y + hh - rad); c.quadraticCurveTo(x + ww, y + hh, x + ww - rad, y + hh);
    c.lineTo(x + rad, y + hh); c.quadraticCurveTo(x, y + hh, x, y + hh - rad);
    c.lineTo(x, y + rad); c.quadraticCurveTo(x, y, x + rad, y);
    c.closePath();
    var lg = c.createLinearGradient(0, 0, w * 0.7, h);
    lg.addColorStop(0.00, rgba(top, 1));
    lg.addColorStop(0.48, rgba(mix(top, bot, 0.5), 1));
    lg.addColorStop(1.00, rgba(bot, 1));
    c.fillStyle = lg;
    c.fill();
    c.save();
    c.clip();
    /* foil sheen band */
    var sg = c.createLinearGradient(0, h, w, 0);
    sg.addColorStop(0.00, rgba('#ffffff', 0));
    sg.addColorStop(0.42, rgba('#ffffff', 0));
    sg.addColorStop(0.54, rgba('#ffffff', lit ? 0.55 : 0.16));
    sg.addColorStop(0.64, rgba('#ffffff', 0));
    sg.addColorStop(1.00, rgba('#ffffff', 0));
    c.fillStyle = sg; c.fillRect(0, 0, w, h);
    /* subtle crease */
    c.fillStyle = rgba('#000000', lit ? 0.16 : 0.28);
    c.fillRect(0, h * 0.5 - 0.5, w, 1);
    c.restore();
    /* edges */
    c.lineWidth = 1;
    c.strokeStyle = rgba(lit ? '#ffffff' : C[1], lit ? 0.5 : 0.30);
    c.stroke();
    return o.canvas;
  }

  function bakeSplat(s, C) {
    var o = PV.makeCanvas(s, s), c = o.ctx, r = s * 0.5;
    _rs = (0x77aa31c1 + C[1].charCodeAt(3) * 104729) >>> 0;
    var i, ang, rad, bx, by, br, g;
    /* soft outer discharge glow */
    g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0.00, rgba(C[0], 0.28));
    g.addColorStop(0.40, rgba(C[0], 0.12));
    g.addColorStop(1.00, rgba(C[0], 0));
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    /* core lobes */
    for (i = 0; i < 7; i++) {
      ang = (i / 7) * TAU + rnd() * 0.7;
      rad = i === 0 ? 0 : M.pow(rnd(), 0.7) * s * 0.20;
      bx = r + M.cos(ang) * rad; by = r + M.sin(ang) * rad;
      br = s * (i === 0 ? 0.24 : 0.07 + rnd() * 0.13);
      g = c.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0.00, rgba(C[2], 0.92));
      g.addColorStop(0.55, rgba(C[1], 0.72));
      g.addColorStop(0.86, rgba(C[1], 0.24));
      g.addColorStop(1.00, rgba(C[1], 0));
      c.fillStyle = g;
      c.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    /* radiating specks + hot rim */
    c.globalCompositeOperation = 'lighter';
    for (i = 0; i < 11; i++) {
      ang = rnd() * TAU;
      rad = s * (0.24 + rnd() * 0.21);
      bx = r + M.cos(ang) * rad; by = r + M.sin(ang) * rad;
      br = s * (0.012 + rnd() * 0.035);
      g = c.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, rgba(C[0], 0.75));
      g.addColorStop(1, rgba(C[0], 0));
      c.fillStyle = g;
      c.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    c.beginPath();
    c.arc(r, r, s * 0.235, 0, TAU);
    c.strokeStyle = rgba(C[0], 0.40);
    c.lineWidth = M.max(1, s * 0.014);
    c.stroke();
    return o.canvas;
  }

  function bakeGlass(s, C) {
    var o = PV.makeCanvas(s, s), c = o.ctx, r = s * 0.5;
    c.save();
    c.translate(r, r);
    c.beginPath();
    c.moveTo(-s * 0.06, -s * 0.42);
    c.lineTo(s * 0.20, s * 0.02);
    c.lineTo(-s * 0.02, s * 0.41);
    c.lineTo(-s * 0.19, -s * 0.02);
    c.closePath();
    var lg = c.createLinearGradient(-s * 0.2, -s * 0.4, s * 0.2, s * 0.4);
    lg.addColorStop(0.00, rgba(C[0], 0.72));
    lg.addColorStop(0.35, rgba(C[1], 0.34));
    lg.addColorStop(0.70, rgba(C[2], 0.22));
    lg.addColorStop(1.00, rgba(C[1], 0.48));
    c.fillStyle = lg;
    c.shadowColor = rgba(C[1], 0.8);
    c.shadowBlur = s * 0.09;
    c.fill();
    c.shadowBlur = 0;
    c.lineWidth = M.max(1, s * 0.026);
    c.strokeStyle = rgba('#ffffff', 0.9);
    c.stroke();
    /* specular streak */
    c.beginPath();
    c.moveTo(-s * 0.045, -s * 0.33);
    c.lineTo(s * 0.06, s * 0.02);
    c.lineTo(-s * 0.005, s * 0.30);
    c.strokeStyle = rgba('#ffffff', 0.8);
    c.lineWidth = M.max(1, s * 0.02);
    c.stroke();
    c.restore();
    return o.canvas;
  }

  function bakeAll() {
    var i, k, cols, ci, first;
    for (k = 0; k < NSPR; k++) sprites[k] = new Array(NCOL);

    for (k = 0; k < NSPR; k++) {
      cols = SPR_COLS[k];
      for (i = 0; i < cols.length; i++) {
        ci = cols[i];
        var C = COLORS[ci];
        switch (k) {
          case SP_DOT:   sprites[k][ci] = bakeDot(64, C); break;
          case SP_CORE:  sprites[k][ci] = bakeCore(64, C); break;
          case SP_STREAK: sprites[k][ci] = bakeStreak(C); break;
          case SP_SHARD: sprites[k][ci] = bakeShard(72, C); break;
          case SP_PUFF0: sprites[k][ci] = bakePuff(128, C, 0); break;
          case SP_PUFF1: sprites[k][ci] = bakePuff(128, C, 1); break;
          case SP_PUFF2: sprites[k][ci] = bakePuff(128, C, 2); break;
          case SP_RING:  sprites[k][ci] = bakeRing(160, C); break;
          case SP_FOILL: sprites[k][ci] = bakeFoil(72, 46, C, true); break;
          case SP_FOILD: sprites[k][ci] = bakeFoil(72, 46, C, false); break;
          case SP_SPLAT: sprites[k][ci] = bakeSplat(112, C); break;
          case SP_GLASS: sprites[k][ci] = bakeGlass(64, C); break;
          case SP_SHOCK: sprites[k][ci] = bakeShock(256, C); break;
          case SP_FLARE: sprites[k][ci] = bakeFlare(C); break;
        }
      }
      /* never allow a null lookup in draw() */
      first = sprites[k][SPR_COLS[k][0]];
      for (i = 0; i < NCOL; i++) if (!sprites[k][i]) sprites[k][i] = first;
    }
  }

  /* ==================================================================
     POOL MANAGEMENT
     ================================================================== */
  function refreshCap() {
    var q = PV.quality;
    var m = (q && typeof q.maxParticles === 'number') ? (q.maxParticles | 0) : CAP;
    capNow = m < 0 ? 0 : (m > CAP ? CAP : m);
  }

  function kill(i) {
    var a = slotAt[i];
    var last = active[--activeCount];
    active[a] = last; slotAt[last] = a;
    freeList[freeCount++] = i;
    life[i] = 0;
    bucketsDirty = true;
  }

  function evict(prio) {
    var n = activeCount;
    if (n === 0) return false;
    var w = n < 128 ? n : 128;
    var best = -1, bestPrio = 999, bestBirth = 1e18, s, i, p;
    for (s = 0; s < w; s++) {
      scanCursor++; if (scanCursor >= n) scanCursor = 0;
      i = active[scanCursor];
      p = PRIO[ptype[i]];
      if (p > prio) continue;
      if (p < bestPrio || (p === bestPrio && birth[i] < bestBirth)) {
        best = i; bestPrio = p; bestBirth = birth[i];
      }
    }
    if (best < 0) return false;
    kill(best);
    return true;
  }

  function alloc(prio) {
    if (activeCount >= capNow) { if (!evict(prio)) return -1; }
    if (freeCount === 0) { if (!evict(prio)) return -1; }
    var i = freeList[--freeCount];
    slotAt[i] = activeCount;
    active[activeCount++] = i;
    birth[i] = ++birthSeq;
    delay[i] = 0;
    vrot[i] = 0; rot[i] = 0; ph[i] = 0; vph[i] = 0;
    tx[i] = 0; ty[i] = 0; size2[i] = 0;
    bucketsDirty = true;
    return i;
  }

  /* ==================================================================
     EMISSION
     ================================================================== */
  /* emit-scope parameters, module level so no closures/objects are made */
  var eCount, eScale, eColor, eAngle, eSpread, eLife, eSpeed, eDx, eDy,
      eHasAngle, eHasColor;
  var _colorCache = Object.create(null);

  function resolveColor(v) {
    if (typeof v === 'number') return (v | 0) % NCOL;
    if (typeof v !== 'string') return -1;
    var c = _colorCache[v];
    if (c !== undefined) return c;
    var idx = COLNAME[v];
    if (typeof idx !== 'number') {
      /* hex -> nearest baked variant (computed once, then cached) */
      idx = -1;
      var h = v.charAt(0) === '#' ? v.substring(1) : v;
      if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      if (h.length >= 6) {
        var n = parseInt(h.substring(0, 6), 16);
        if (!isNaN(n)) {
          var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
          var bestD = 1e9, i;
          for (i = 0; i < NCOL; i++) {
            var m2 = parseInt(COLORS[i][1].substring(1), 16);
            var dr = ((m2 >> 16) & 255) - r, dg = ((m2 >> 8) & 255) - g, db = (m2 & 255) - b;
            var d = dr * dr + dg * dg + db * db;
            if (d < bestD) { bestD = d; idx = i; }
          }
        }
      }
    }
    _colorCache[v] = idx;
    return idx;
  }

  function dirX(a) { return M.cos(a); }
  function dirY(a) { return M.sin(a); }

  function spawn(type, x, y) {
    var i = alloc(PRIO[type]);
    if (i < 0) return -1;
    var sd = rnd();
    ptype[i] = type;
    px[i] = x; py[i] = y;
    vx[i] = eDx; vy[i] = eDy;
    seed[i] = sd;
    ph[i] = sd * TAU;
    pspr[i] = SP_DOT;
    pcol[i] = C_WHITE; pcol2[i] = C_WHITE;

    var ang, spd, s, k;

    switch (type) {

      case T_DUST:
        /* kicked backwards and outwards from the sole, scattered over a small
           patch so 4 particles read as a puff rather than one dot */
        ang = (eHasAngle ? eAngle : 0) + rr(-1, 1) * (eSpread > 0 ? eSpread * 0.5 : M.PI);
        spd = (eSpeed > 0 ? eSpeed : 58) * rr(0.25, 1.15);
        vx[i] += dirX(ang) * spd; vy[i] += dirY(ang) * spd * 0.66;
        px[i] += rr(-7, 7) * eScale; py[i] += rr(-4, 5) * eScale;
        size[i] = rr(5.5, 16) * eScale;
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 0.75) * rr(0.65, 1.6);
        vrot[i] = rr(0.9, 2.4);               /* per-particle expansion rate */
        pspr[i] = SP_DOT;
        pcol[i] = pcol2[i] = eHasColor ? eColor : (sd < 0.74 ? C_PALE : C_BRASS);
        break;

      case T_SPARKG:
      case T_SPARKR:
        ang = (eHasAngle ? eAngle : rnd() * TAU) + rr(-0.5, 0.5) * (eSpread > 0 ? eSpread : TAU * 0.55);
        /* pow() biases most sparks slow and a few very fast — that spread of
           speeds is what makes a burst read as an explosion, not a starburst */
        spd = (eSpeed > 0 ? eSpeed : 470) * M.pow(rnd(), 0.5) * rr(0.30, 1.35);
        vx[i] += dirX(ang) * spd; vy[i] += dirY(ang) * spd;
        px[i] += rr(-4, 4); py[i] += rr(-4, 4);
        size[i] = rr(3.4, 8.6) * eScale;
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 0.72) * rr(0.45, 1.7);
        pspr[i] = SP_STREAK;
        if (type === T_SPARKG) { pcol[i] = sd < 0.30 ? C_BRASS : C_GOLD; pcol2[i] = C_AMBER; }
        else { pcol[i] = C_RED; pcol2[i] = C_CRIMSON; }
        if (eHasColor) { pcol[i] = eColor; pcol2[i] = eColor; }
        break;

      case T_HOLO:
        ang = (eHasAngle ? eAngle : rnd() * TAU) + rr(-0.5, 0.5) * (eSpread > 0 ? eSpread : TAU);
        spd = (eSpeed > 0 ? eSpeed : 165) * M.pow(rnd(), 0.6) * rr(0.3, 1.5);
        vx[i] += dirX(ang) * spd; vy[i] += dirY(ang) * spd * 0.85;
        px[i] += rr(-10, 10) * eScale; py[i] += rr(-10, 10) * eScale;
        size[i] = rr(22, 62) * eScale;
        size2[i] = rr(0.20, 0.60);            /* width ratio — thin slivers */
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 0.95) * rr(0.55, 1.7);
        rot[i] = rnd() * TAU; vrot[i] = rr(-5.0, 5.0);
        vph[i] = rr(26, 62);                  /* scanline frequency */
        pspr[i] = SP_SHARD;
        k = eHasColor ? eColor : (sd < 0.58 ? C_CYAN : (sd < 0.86 ? C_TEAL : C_VIOLET));
        pcol[i] = k; pcol2[i] = C_WHITE;
        break;

      case T_SMOKE:
        ang = (eHasAngle ? eAngle : -M.PI * 0.5) + rr(-0.5, 0.5) * (eSpread > 0 ? eSpread : 1.9);
        spd = (eSpeed > 0 ? eSpeed : 46) * rr(0.15, 1.4);
        vx[i] += dirX(ang) * spd; vy[i] += dirY(ang) * spd;
        px[i] += rr(-16, 16) * eScale; py[i] += rr(-13, 13) * eScale;
        /* very wide size spread => overlapping puffs at different scales */
        size[i] = rr(20, 78) * eScale;
        size2[i] = rr(1.5, 3.4);              /* expansion factor */
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 1.7) * rr(0.55, 1.65);
        rot[i] = rnd() * TAU; vrot[i] = rr(-1.0, 1.0);
        pspr[i] = SP_PUFF0 + ((sd * 2.999) | 0);
        pcol[i] = eHasColor ? eColor : C_SMOKEL;
        pcol2[i] = eHasColor ? eColor : C_SMOKED;
        delay[i] = rnd() * 0.16;
        break;

      case T_GLASS:
        ang = (eHasAngle ? eAngle : rnd() * TAU) + rr(-0.5, 0.5) * (eSpread > 0 ? eSpread : TAU);
        spd = (eSpeed > 0 ? eSpeed : 420) * M.pow(rnd(), 0.55) * rr(0.35, 1.45);
        vx[i] += dirX(ang) * spd; vy[i] += dirY(ang) * spd;
        size[i] = rr(11, 30) * eScale;
        size2[i] = rr(0.45, 1.10);
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 1.1) * rr(0.6, 1.7);
        rot[i] = rnd() * TAU; vrot[i] = rr(-15, 15);
        vph[i] = rr(9, 19);                   /* specular flash frequency */
        pspr[i] = SP_GLASS;
        pcol[i] = eHasColor ? eColor : (sd < 0.66 ? C_WHITE : C_CYAN);
        pcol2[i] = C_WHITE;
        break;

      case T_EMBER:
        ang = (eHasAngle ? eAngle : rnd() * TAU) + rr(-0.5, 0.5) * TAU;
        spd = (eSpeed > 0 ? eSpeed : 20) * rr(0.2, 1.2);
        vx[i] += dirX(ang) * spd; vy[i] += dirY(ang) * spd * 0.6;
        if (eSpread > 0) { s = M.sqrt(rnd()) * eSpread; px[i] += M.cos(ang) * s; py[i] += M.sin(ang) * s * 0.8; }
        size[i] = rr(4.5, 13) * eScale;
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 3.4) * rr(0.6, 1.7);
        vph[i] = rr(3.0, 8.0);
        pspr[i] = SP_CORE;
        pcol[i] = pcol2[i] = eHasColor ? eColor : (sd < 0.5 ? C_GOLD : (sd < 0.88 ? C_AMBER : C_BRASS));
        break;

      case T_MOTES:
        /* `spread` is a WORLD-PIXEL RADIUS here (game.js seeds one emit per
           skylight and expects the motes to fill it), not an angle. */
        ang = rnd() * TAU;
        if (eSpread > 0) {
          s = M.sqrt(rnd()) * eSpread;
          px[i] += M.cos(ang) * s; py[i] += M.sin(ang) * s * 0.82;
        }
        spd = (eSpeed > 0 ? eSpeed : 11) * rr(0.1, 1);
        ang = rnd() * TAU;
        vx[i] += dirX(ang) * spd; vy[i] += dirY(ang) * spd;
        size[i] = rr(3.0, 9.5) * eScale;
        size2[i] = rr(5, 17);                 /* bob amplitude */
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 11) * rr(0.5, 1.7);
        vph[i] = rr(0.8, 3.1);                /* twinkle rate  */
        vrot[i] = rr(0.25, 0.85);             /* twinkle depth */
        ph[i] = rnd() * TAU;                  /* twinkle phase */
        pspr[i] = sd < 0.34 ? SP_CORE : SP_DOT;
        pcol[i] = pcol2[i] = eHasColor ? eColor : (sd < 0.62 ? C_GOLD : (sd < 0.88 ? C_BRASS : C_PALE));
        break;

      case T_RIPPLE:
        size[i] = rr(3, 9) * eScale;
        size2[i] = (eSpeed > 0 ? eSpeed : 46) * eScale * rr(0.72, 1.30);
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 0.85) * rr(0.75, 1.25);
        size2[i] += size[i];
        pspr[i] = SP_RING;
        pcol[i] = pcol2[i] = eHasColor ? eColor : (sd < 0.62 ? C_CYAN : C_TEAL);
        break;

      case T_CHRONO:
        /* spawned on a ring, converges on (tx,ty) — set up by emitChrono */
        size[i] = rr(3.0, 9.5) * eScale;
        life[i] = maxLife[i] = 1.15;
        pspr[i] = SP_STREAK;
        pcol[i] = sd < 0.52 ? C_CYAN : (sd < 0.88 ? C_VIOLET : C_TEAL);
        pcol2[i] = pcol[i];
        break;

      case T_STEAM:
        ang = (eHasAngle ? eAngle : -M.PI * 0.5) + rr(-0.5, 0.5) * (eSpread > 0 ? eSpread : 0.75);
        spd = (eSpeed > 0 ? eSpeed : 240) * rr(0.4, 1.4);
        vx[i] += dirX(ang) * spd; vy[i] += dirY(ang) * spd;
        px[i] += rr(-6, 6) * eScale; py[i] += rr(-6, 6) * eScale;
        size[i] = rr(13, 44) * eScale;
        size2[i] = rr(2.2, 4.6);
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 1.15) * rr(0.6, 1.6);
        rot[i] = rnd() * TAU; vrot[i] = rr(-1.6, 1.6);
        pspr[i] = SP_PUFF0 + ((sd * 2.999) | 0);
        pcol[i] = eHasColor ? eColor : C_STEAM;
        pcol2[i] = eHasColor ? eColor : C_WHITE;
        delay[i] = rnd() * 0.08;
        break;

      case T_CONFETTI:
        ang = (eHasAngle ? eAngle : -M.PI * 0.5) + rr(-0.5, 0.5) * (eSpread > 0 ? eSpread : 2.5);
        spd = (eSpeed > 0 ? eSpeed : 430) * M.pow(rnd(), 0.62) * rr(0.5, 1.45);
        vx[i] += dirX(ang) * spd; vy[i] += dirY(ang) * spd;
        size[i] = rr(7, 19) * eScale;
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 2.6) * rr(0.6, 1.6);
        rot[i] = rnd() * TAU; vrot[i] = rr(-6.5, 6.5);
        ph[i] = rnd() * TAU; vph[i] = rr(5.0, 15.0) * (rnd() < 0.5 ? -1 : 1);
        pspr[i] = SP_FOILL;
        k = eHasColor ? eColor : (sd < 0.40 ? C_GOLD : (sd < 0.70 ? C_TEAL : (sd < 0.90 ? C_BRASS : C_WHITE)));
        pcol[i] = k; pcol2[i] = k;
        delay[i] = rnd() * 0.10;
        break;

      case T_BLOOD:
        size[i] = rr(26, 56) * eScale;
        size2[i] = rr(0.80, 1.22);
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 0.9) * rr(0.8, 1.45);
        rot[i] = rnd() * TAU;
        pspr[i] = SP_SPLAT;
        pcol[i] = eHasColor ? eColor : C_INK;
        pcol2[i] = C_VIOLET;
        break;

      case T_FLASH:
        size[i] = rr(40, 60) * eScale;
        size2[i] = rr(-0.5, 0.5);             /* flare tilt */
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 0.5);
        pspr[i] = SP_FLARE;
        pcol[i] = pcol2[i] = eHasColor ? eColor : C_WHITE;
        break;

      case T_SHOCK:
        size[i] = 2;
        size2[i] = (eSpeed > 0 ? eSpeed : 200) * eScale;
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 0.6);
        vrot[i] = 1;                          /* 1 = fat shock, 0 = thin ripple */
        pspr[i] = SP_SHOCK;
        pcol[i] = pcol2[i] = eHasColor ? eColor : C_CYAN;
        break;

      case T_AFTER:
        size[i] = rr(120, 200) * eScale;
        size2[i] = rr(1.3, 2.0);
        life[i] = maxLife[i] = (eLife > 0 ? eLife : 1.3);
        pspr[i] = SP_DOT;
        pcol[i] = pcol2[i] = eHasColor ? eColor : C_CYAN;
        break;
    }
    return i;
  }

  var DEFCOUNT = new Uint8Array([
    8,   /* dust      */
    14,  /* sparkGold */
    14,  /* sparkRed  */
    12,  /* holoShard */
    6,   /* smoke     */
    12,  /* glassShard*/
    3,   /* emberFloat*/
    10,  /* motes     */
    1,   /* ripple    */
    46,  /* chrono    */
    7,   /* steam     */
    40,  /* confetti  */
    1,   /* bloodless */
    1, 1, 1
  ]);

  /* ==================================================================
     THE SIGNATURE REWIND EFFECT
     ------------------------------------------------------------------
     Timeline (seconds from the emit call):
       0.00 .. 0.36  streaks released in 6 waves on a wide ring, launched
                     mostly TANGENTIALLY so they spiral rather than fall
                     straight in; a constant inward acceleration makes them
                     visibly speed up and (because the sprite is stretched by
                     speed) elongate as they converge.
       0.00 .. 0.44  two huge soft rings contract into the singularity, and a
                     dim gravity-well haze sits at the centre.
       0.44          IMPACT: three anamorphic flares (cyan -> violet -> white)
                     one frame apart, so it punches instead of fading up.
       0.45 ..       outgoing shock rings, a shard spray, and a slow violet /
                     cyan afterimage that lingers for ~1.5 s.
     ================================================================== */
  var CHRONO_IMPACT = 0.44;
  function emitChrono(x, y) {
    var n = eCount, i, w, ang, R, s, spd, tang, ix, iy, id, dirn;
    var radius = (eSpeed > 0 ? eSpeed : 250) * eScale;
    var waves = 6;
    var baseCol = eHasColor ? eColor : -1;
    var sv = eSpeed, sc = eScale, hc = eHasColor, ec = eColor,
        lf = eLife, sp = eSpread, ha = eHasAngle, ea = eAngle;

    /* ---- converging streaks ---------------------------------------- */
    for (i = 0; i < n; i++) {
      w = i % waves;
      /* golden-angle placement: no visible spokes, no clumping */
      ang = i * 2.39996 + rr(-0.13, 0.13);
      R = radius * rr(0.62, 1.34);
      ix = x + M.cos(ang) * R;
      iy = y + M.sin(ang) * R * 0.90;
      eDx = 0; eDy = 0;
      id = spawn(T_CHRONO, ix, iy);
      if (id < 0) break;
      tx[id] = x; ty[id] = y;
      /* two counter-rotating shells read as real orbital motion */
      dirn = (i % 3) ? 1 : -1;
      tang = ang + M.PI * 0.5 * dirn;
      spd = rr(150, 340);
      vx[id] = M.cos(tang) * spd - M.cos(ang) * rr(0, 60);
      vy[id] = M.sin(tang) * spd - M.sin(ang) * rr(0, 60);
      /* stagger the release AND vary the pull so arrivals smear over ~0.2s
         around the impact rather than all landing on one frame */
      delay[id] = w * 0.042 + rnd() * 0.030;
      vrot[id] = rr(0.80, 1.30);             /* per-particle pull multiplier */
      if (baseCol >= 0) pcol[id] = pcol2[id] = baseCol;
      life[id] = maxLife[id] = 1.25;
    }

    /* ---- slow chrono dust dragged in behind the streaks ------------- */
    eDx = 0; eDy = 0;
    for (i = 0; i < 22; i++) {
      ang = rnd() * TAU;
      R = radius * rr(0.5, 1.6);
      id = spawn(T_CHRONO, x + M.cos(ang) * R, y + M.sin(ang) * R * 0.9);
      if (id < 0) break;
      tx[id] = x; ty[id] = y;
      tang = ang + M.PI * 0.5 * ((i % 2) ? 1 : -1);
      spd = rr(60, 150);
      vx[id] = M.cos(tang) * spd; vy[id] = M.sin(tang) * spd;
      size[id] = rr(1.6, 3.4) * sc;
      vrot[id] = rr(0.34, 0.62);             /* much weaker pull -> lags */
      delay[id] = rnd() * 0.22;
      pcol[id] = pcol2[id] = baseCol >= 0 ? baseCol : (rnd() < 0.5 ? C_CYAN : C_VIOLET);
      life[id] = maxLife[id] = 1.4;
    }

    eSpeed = 0; eHasColor = true; eSpread = 0; eHasAngle = false;

    /* ---- anticipation: rings contracting into the singularity ------- */
    for (i = 0; i < 3; i++) {
      eColor = i === 1 ? C_VIOLET : (i === 2 ? C_TEAL : C_CYAN);
      eLife = 0.44;
      id = spawn(T_SHOCK, x, y);
      if (id >= 0) {
        size[id] = radius * (1.05 + i * 0.30);
        size2[id] = radius * 0.03;
        delay[id] = i * 0.055;
        life[id] = maxLife[id] = CHRONO_IMPACT - i * 0.055;
        vrot[id] = 0;                        /* thin, since it is contracting */
      }
    }
    /* the well itself: a dim violet haze that brightens as things fall in */
    eLife = CHRONO_IMPACT + 0.06; eColor = C_VIOLET;
    id = spawn(T_AFTER, x, y);
    if (id >= 0) { size[id] = radius * 0.42 * sc; size2[id] = -0.55; ph[id] = 1; }

    /* ---- IMPACT: three anamorphic flares, one frame apart ----------- */
    eLife = 0.50; eColor = C_CYAN;
    id = spawn(T_FLASH, x, y);
    if (id >= 0) { delay[id] = CHRONO_IMPACT; size[id] = 190 * sc; size2[id] = 0; }
    eLife = 0.62; eColor = C_VIOLET;
    id = spawn(T_FLASH, x, y);
    if (id >= 0) { delay[id] = CHRONO_IMPACT + 0.016; size[id] = 300 * sc; size2[id] = 0.55; }
    eLife = 0.34; eColor = C_WHITE;
    id = spawn(T_FLASH, x, y);
    if (id >= 0) { delay[id] = CHRONO_IMPACT + 0.008; size[id] = 96 * sc; size2[id] = -0.3; }

    /* ---- outgoing shock rings -------------------------------------- */
    eLife = 0.55; eColor = C_WHITE;
    id = spawn(T_SHOCK, x, y);
    if (id >= 0) { delay[id] = CHRONO_IMPACT + 0.01; size[id] = 8; size2[id] = radius * 1.30; }
    eLife = 0.80; eColor = C_CYAN;
    id = spawn(T_SHOCK, x, y);
    if (id >= 0) { delay[id] = CHRONO_IMPACT + 0.05; size[id] = 6; size2[id] = radius * 2.05; }
    eLife = 1.05; eColor = C_VIOLET;
    id = spawn(T_SHOCK, x, y);
    if (id >= 0) { delay[id] = CHRONO_IMPACT + 0.12; size[id] = 4; size2[id] = radius * 3.10; }

    /* ---- residual afterimage --------------------------------------- */
    eLife = 1.6; eColor = C_CYAN;
    id = spawn(T_AFTER, x, y);
    if (id >= 0) { delay[id] = CHRONO_IMPACT; size[id] = 150 * sc; size2[id] = 1.9; ph[id] = 0; }
    eLife = 1.15; eColor = C_VIOLET;
    id = spawn(T_AFTER, x, y);
    if (id >= 0) { delay[id] = CHRONO_IMPACT + 0.04; size[id] = 250 * sc; size2[id] = 1.3; ph[id] = 0; }

    /* ---- shard spray thrown out by the collapse -------------------- */
    eHasColor = false; eSpeed = 430; eLife = 0.75; eSpread = TAU;
    for (i = 0; i < 16; i++) {
      eDx = 0; eDy = 0;
      id = spawn(T_HOLO, x, y);
      if (id >= 0) delay[id] = CHRONO_IMPACT + rnd() * 0.06;
    }
    /* ---- a few violet sparks so the impact has grit ---------------- */
    eSpeed = 620; eLife = 0.55; eHasColor = true; eColor = C_VIOLET;
    for (i = 0; i < 14; i++) {
      eDx = 0; eDy = 0;
      id = spawn(T_SPARKG, x, y);
      if (id >= 0) {
        delay[id] = CHRONO_IMPACT + rnd() * 0.04;
        pcol[id] = rnd() < 0.5 ? C_CYAN : C_VIOLET;
        pcol2[id] = C_VIOLET;
      }
    }

    eSpeed = sv; eScale = sc; eHasColor = hc; eColor = ec;
    eLife = lf; eSpread = sp; eHasAngle = ha; eAngle = ea;
  }

  function emitBloodless(x, y) {
    var i, id, ang, r;
    id = spawn(T_BLOOD, x, y);
    if (id >= 0) size[id] = size[id] * 1.25;
    for (i = 0; i < 5; i++) {
      ang = rnd() * TAU; r = rr(6, 26) * eScale;
      eDx = M.cos(ang) * rr(8, 34); eDy = M.sin(ang) * rr(8, 34);
      id = spawn(T_BLOOD, x + M.cos(ang) * r, y + M.sin(ang) * r);
      if (id >= 0) {
        size[id] *= rr(0.22, 0.5);
        life[id] = maxLife[id] = maxLife[id] * rr(0.6, 1.0);
        delay[id] = rnd() * 0.05;
      }
    }
  }

  /* ==================================================================
     PUBLIC API
     ================================================================== */
  var Particles = PV.Particles = {
    count: 0,
    capacity: CAP,
    types: TYPELIST,
    ready: false
  };

  Particles.init = function () {
    if (inited) return;
    if (!PV.makeCanvas) { return; }
    inited = true;
    allocPool();
    bakeAll();
    refreshCap();
    Particles.ready = true;
  };

  Particles.clear = function () {
    if (!inited) return;
    while (activeCount > 0) kill(active[activeCount - 1]);
    nGN = nGA = nAN = nAA = 0;
    bucketsDirty = true;
  };

  Particles.emit = function (type, x, y, opts) {
    if (!inited) Particles.init();
    if (!inited) return;
    var t = TYPENAME[type];
    if (typeof t !== 'number') {
      if (!warned && global.console) { warned = true; console.warn('[PV.Particles] unknown type: ' + type); }
      return;
    }
    refreshCap();
    if (capNow <= 0) return;

    eScale = 1; eColor = 0; eHasColor = false; eAngle = 0; eHasAngle = false;
    eSpread = 0; eLife = 0; eSpeed = 0; eDx = 0; eDy = 0;
    eCount = DEFCOUNT[t];

    if (opts) {
      if (opts.count !== undefined) eCount = opts.count | 0;
      if (opts.scale !== undefined) eScale = +opts.scale || 1;
      if (opts.angle !== undefined) { eAngle = +opts.angle; eHasAngle = true; }
      if (opts.spread !== undefined) eSpread = +opts.spread;
      if (opts.life !== undefined) eLife = +opts.life;
      if (opts.speed !== undefined) eSpeed = +opts.speed;
      if (opts.dx !== undefined) eDx = +opts.dx;
      if (opts.dy !== undefined) eDy = +opts.dy;
      if (opts.color !== undefined && opts.color !== null) {
        var ci = resolveColor(opts.color);
        if (ci >= 0) { eColor = ci; eHasColor = true; }
      }
      if (!eHasAngle && (eDx !== 0 || eDy !== 0) &&
          (t === T_SPARKG || t === T_SPARKR || t === T_STEAM || t === T_DUST || t === T_GLASS)) {
        eAngle = M.atan2(eDy, eDx); eHasAngle = true;
        /* dx/dy read as a direction hint here, not inherited velocity */
        eDx *= 0.25; eDy *= 0.25;
      }
    }
    if (eCount < 0) eCount = 0;
    if (eCount > CAP) eCount = CAP;

    if (t === T_CHRONO) { emitChrono(x, y); return; }
    if (t === T_BLOOD) { emitBloodless(x, y); return; }

    var bdx = eDx, bdy = eDy;
    for (var i = 0; i < eCount; i++) {
      eDx = bdx; eDy = bdy;
      if (spawn(t, x, y) < 0) break;
    }
   
  };

  /* ==================================================================
     UPDATE
     ================================================================== */
  Particles.update = function (dt) {
    if (!inited) return;
    if (!(dt > 0)) return;
    if (dt > 0.05) dt = 0.05;
    time += dt;
    refreshCap();

    var k = 0, i, t, d, s, dx, dy, dist, inv, dr, n1;

    while (k < activeCount) {
      i = active[k];

      if (delay[i] > 0) {
        delay[i] -= dt;
        k++;
        continue;
      }

      t = ptype[i];
      life[i] -= dt;
      if (life[i] <= 0) { kill(i); continue; }

      switch (t) {

        case T_DUST:
          d = 1 - 4.2 * dt; if (d < 0) d = 0;
          vx[i] *= d; vy[i] *= d;
          vy[i] -= 9 * dt;                                 /* faint updraft */
          vx[i] += M.sin(time * 1.7 + ph[i]) * 7 * dt;
          break;

        case T_SPARKG:
        case T_SPARKR:
          vy[i] += 620 * dt;                               /* real gravity   */
          vx[i] += M.sin(time * 31 + ph[i]) * 55 * dt;     /* air turbulence */
          d = 1 - 1.9 * dt; if (d < 0) d = 0;              /* decelerating   */
          vx[i] *= d; vy[i] *= d;
          break;

        case T_HOLO:
          d = 1 - 2.1 * dt; if (d < 0) d = 0;
          vx[i] *= d; vy[i] *= d;
          vy[i] -= 14 * dt;
          rot[i] += vrot[i] * dt;
          vrot[i] *= (1 - 0.7 * dt);
          break;

        case T_SMOKE:
          vy[i] -= 26 * dt;                                /* buoyancy */
          vx[i] += M.sin(time * 0.85 + ph[i]) * 20 * dt;
          vy[i] += M.cos(time * 0.63 + ph[i] * 1.7) * 9 * dt;
          d = 1 - 1.25 * dt; if (d < 0) d = 0;
          vx[i] *= d; vy[i] *= d;
          rot[i] += vrot[i] * dt;
          break;

        case T_GLASS:
          d = 1 - 5.6 * dt; if (d < 0) d = 0;
          vx[i] *= d; vy[i] *= d;
          rot[i] += vrot[i] * dt;
          vrot[i] *= (1 - 5.2 * dt);
          break;

        case T_EMBER:
          vy[i] -= 11 * dt;                                /* buoyancy */
          vx[i] += M.sin(time * 0.9 + ph[i]) * M.cos(time * 0.41 + ph[i] * 1.9) * 22 * dt;
          vy[i] += M.sin(time * 0.55 + ph[i] * 2.3) * 14 * dt;
          d = 1 - 0.75 * dt; if (d < 0) d = 0;
          vx[i] *= d; vy[i] *= d;
          break;

        case T_MOTES:
          vx[i] += M.sin(time * 0.43 + ph[i]) * M.cos(time * 0.27 + ph[i] * 2.1) * 9 * dt;
          vy[i] += (M.sin(time * vph[i] * 0.32 + ph[i]) * 5 - 1.2) * dt;
          d = 1 - 0.85 * dt; if (d < 0) d = 0;
          vx[i] *= d; vy[i] *= d;
          break;

        case T_RIPPLE:
        case T_SHOCK:
          d = 1 - 6 * dt; if (d < 0) d = 0;
          vx[i] *= d; vy[i] *= d;
          break;

        case T_CHRONO:
          dx = tx[i] - px[i]; dy = ty[i] - py[i];
          dist = M.sqrt(dx * dx + dy * dy);
          if (dist < 6) { kill(i); continue; }
          inv = 1 / dist;
          /* Constant inward acceleration + a 1/r term.  The constant part
             guarantees they all arrive; the 1/r part makes the last stretch
             violently fast, which is what sells the collapse. */
          s = (2250 + 38000 * inv) * vrot[i];
          if (s > 26000) s = 26000;
          vx[i] += dx * inv * s * dt;
          vy[i] += dy * inv * s * dt;
          /* light tangential drag only — keeps the spiral from unwinding */
          d = 1 - 1.15 * dt; if (d < 0) d = 0;
          vx[i] *= d; vy[i] *= d;
          break;

        case T_STEAM:
          vy[i] -= 40 * dt;
          vx[i] += M.sin(time * 1.4 + ph[i]) * 26 * dt;
          d = 1 - 2.1 * dt; if (d < 0) d = 0;
          vx[i] *= d; vy[i] *= d;
          rot[i] += vrot[i] * dt;
          break;

        case T_CONFETTI:
          vy[i] += 200 * dt;
          ph[i] += vph[i] * dt;
          vx[i] += M.sin(ph[i]) * 62 * dt;
          vy[i] += M.cos(ph[i] * 0.7) * 22 * dt;
          d = 1 - 1.85 * dt; if (d < 0) d = 0;
          vx[i] *= d; vy[i] *= d;
          rot[i] += vrot[i] * dt;
          break;

        case T_BLOOD:
        case T_FLASH:
        case T_AFTER:
          d = 1 - 8 * dt; if (d < 0) d = 0;
          vx[i] *= d; vy[i] *= d;
          break;
      }

      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      k++;
    }

    /* runtime quality drop — shed the cheapest/oldest until under cap */
    n1 = 0;
    while (activeCount > capNow && n1 < 256) { if (!evict(255)) break; n1++; }

   
    bucketsDirty = true;
  };

  function rebuildBuckets() {
    nGN = nGA = nAN = nAA = 0;
    var k, i, t;
    for (k = 0; k < activeCount; k++) {
      i = active[k];
      if (delay[i] > 0) continue;
      t = ptype[i];
      if (LAYER[t] === 0) {
        if (BLEND[t] === 0) bGN[nGN++] = i; else bGA[nGA++] = i;
      } else {
        if (BLEND[t] === 0) bAN[nAN++] = i; else bAA[nAA++] = i;
      }
    }
    bucketsDirty = false;
  }

  /* ==================================================================
     DRAW
     ================================================================== */
  function drawBucket(ctx, arr, n) {
    var k, i, t, a, sz, w, h, age, il, sp, c, spd, st, r, cs, img;

    for (k = 0; k < n; k++) {
      i = arr[k];
      t = ptype[i];
      il = maxLife[i];
      age = il > 0 ? 1 - life[i] / il : 1;
      if (age < 0) age = 0; else if (age > 1) age = 1;

      switch (t) {

        /* ---------------- ground: floor dust ---------------- */
        case T_DUST:
          a = M.pow(1 - age, 1.6) * (age < 0.10 ? age / 0.10 : 1) * 0.80;
          if (a <= 0.004) continue;
          sz = size[i] * (0.62 + age * vrot[i]);
          ctx.globalAlpha = a;
          img = sprites[SP_DOT][pcol[i]];
          ctx.drawImage(img, px[i] - sz, py[i] - sz, sz * 2, sz * 2);
          continue;

        /* ---------------- sparks ---------------- */
        case T_SPARKG:
        case T_SPARKR:
          /* hot white core -> gold -> deep amber: the sprite carries the
             gradient, `c` walks the baked variants over the lifetime */
          a = (1 - age * age * age);
          a *= 0.62 + 0.38 * M.sin(time * 52 + ph[i] * 5.1);   /* flicker */
          if (a <= 0.004) continue;
          spd = M.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
          h = size[i] * (1 - age * 0.55);
          if (h < 0.35) continue;
          w = h * (2.0 + spd * 0.052);
          if (w > h * 34) w = h * 34;
          c = age < 0.34 ? pcol[i] : pcol2[i];
          ctx.globalAlpha = a > 1 ? 1 : a;
          ctx.save();
          ctx.translate(px[i], py[i]);
          ctx.rotate(M.atan2(vy[i], vx[i]));
          ctx.drawImage(sprites[SP_STREAK][c], -w * STREAK_HEAD, -h * 0.5, w, h);
          ctx.restore();
          /* short-lived hot bloom on the head only */
          if (age < 0.40) {
            sz = h * (1.35 - age);
            ctx.globalAlpha = (a * (1 - age / 0.40)) * 0.75;
            ctx.drawImage(sprites[SP_CORE][pcol[i]], px[i] - sz, py[i] - sz, sz * 2, sz * 2);
          }
          continue;

        /* ---------------- holo shards ---------------- */
        case T_HOLO:
          a = (age < 0.06 ? age / 0.06 : 1) * M.pow(1 - age, 0.85) * 1.15;
          /* high frequency scanline flicker + occasional dropout */
          a *= 0.46 + 0.54 * (0.5 + 0.5 * M.sin(ph[i] + time * vph[i]));
          if (M.sin(ph[i] * 3.3 + time * 21) > 0.86) a *= 0.18;
          if (a <= 0.004) continue;
          h = size[i] * (1 - age * 0.22);
          /* the sliver squashes across its short axis as it flickers, which
             reads as a hologram losing sync */
          w = h * size2[i] * (0.72 + 0.28 * M.cos(time * vph[i] * 0.61 + ph[i]));
          ctx.globalAlpha = a > 1 ? 1 : a;
          ctx.save();
          ctx.translate(px[i], py[i]);
          ctx.rotate(rot[i]);
          ctx.drawImage(sprites[SP_SHARD][pcol[i]], -w * 0.5, -h * 0.5, w, h);
          ctx.restore();
          continue;

        /* ---------------- smoke ---------------- */
        case T_SMOKE:
          a = (age < 0.11 ? age / 0.11 : 1) * M.pow(1 - age, 1.35) * 0.92;
          if (a <= 0.004) continue;
          sz = size[i] * (0.42 + age * size2[i]);
          /* darkens as it cools and thins */
          c = age < 0.30 ? pcol[i] : pcol2[i];
          ctx.globalAlpha = a;
          ctx.save();
          ctx.translate(px[i], py[i]);
          ctx.rotate(rot[i]);
          /* slight non-uniform scale so the puff is never a circle */
          ctx.drawImage(sprites[pspr[i]][c], -sz, -sz * (0.86 + size2[i] * 0.06), sz * 2, sz * 2 * (0.86 + size2[i] * 0.06));
          ctx.restore();
          continue;

        /* ---------------- glass ---------------- */
        case T_GLASS:
          a = 1 - age * age;
          if (a <= 0.004) continue;
          h = size[i] * (1 + (1 - (age < 0.1 ? age / 0.1 : 1)) * 0.55);
          w = h * size2[i];
          ctx.globalAlpha = a;
          ctx.save();
          ctx.translate(px[i], py[i]);
          ctx.rotate(rot[i]);
          ctx.drawImage(sprites[SP_GLASS][pcol[i]], -w * 0.5, -h * 0.5, w, h);
          /* specular catch — the facet flares as it tumbles through the key */
          cs = M.sin(time * vph[i] + ph[i] * 2.7);
          cs = cs * cs; cs *= cs; cs *= cs;                 /* sin^8: sharp */
          st = cs * (1 - age) * 0.95 + (age < 0.14 ? (1 - age / 0.14) * 0.8 : 0);
          if (st > 0.02) {
            ctx.globalAlpha = st > 1 ? 1 : st;
            ctx.drawImage(sprites[SP_GLASS][C_WHITE], -w * 0.62, -h * 0.62, w * 1.24, h * 1.24);
          }
          ctx.restore();
          continue;

        /* ---------------- embers ---------------- */
        case T_EMBER:
          a = (age < 0.14 ? age / 0.14 : 1) * (age > 0.7 ? (1 - age) / 0.3 : 1);
          a *= 0.5 + 0.5 * M.sin(time * vph[i] + ph[i]);
          a = a * 0.9;
          if (a <= 0.004) continue;
          sz = size[i] * (0.85 + 0.25 * M.sin(time * vph[i] * 0.7 + ph[i]));
          ctx.globalAlpha = a;
          ctx.drawImage(sprites[SP_CORE][pcol[i]], px[i] - sz, py[i] - sz, sz * 2, sz * 2);
          continue;

        /* ---------------- ambient motes ---------------- */
        case T_MOTES:
          a = (age < 0.08 ? age / 0.08 : 1) * (age > 0.78 ? (1 - age) / 0.22 : 1);
          cs = M.sin(ph[i] + time * vph[i]);
          a *= 0.18 + 0.82 * (cs * cs);
          if (a <= 0.004) continue;
          sz = size[i] * (0.8 + 0.35 * cs);
          r = M.sin(time * vph[i] * 0.37 + ph[i] * 1.3) * size2[i];
          ctx.globalAlpha = a * 0.9;
          ctx.drawImage(sprites[SP_DOT][pcol[i]], px[i] - sz, py[i] + r - sz, sz * 2, sz * 2);
          continue;

        /* ---------------- rings ---------------- */
        case T_RIPPLE:
        case T_SHOCK:
          st = 1 - (1 - age) * (1 - age) * (1 - age);
          r = size[i] + (size2[i] - size[i]) * st;
          if (r < 1) continue;
          a = M.pow(1 - age, 1.7) * (age < 0.06 ? age / 0.06 : 1);
          if (t === T_SHOCK) a *= 1.15;
          if (a <= 0.004) continue;
          sz = r / RING_R;
          ctx.globalAlpha = a > 1 ? 1 : a;
          ctx.drawImage(sprites[SP_RING][pcol[i]], px[i] - sz, py[i] - sz, sz * 2, sz * 2);
          continue;

        /* ---------------- chrono convergence ---------------- */
        case T_CHRONO:
          spd = M.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
          a = (age < 0.10 ? age / 0.10 : 1);
          a *= 0.35 + 0.65 * (spd > 900 ? 1 : spd / 900);
          a *= 0.85 + 0.15 * M.sin(time * 39 + ph[i] * 3.7);
          if (a <= 0.004) continue;
          h = size[i];
          w = h * (2.0 + spd * 0.028);
          if (w > h * 30) w = h * 30;
          c = spd > 760 ? pcol2[i] : pcol[i];
          ctx.globalAlpha = a > 1 ? 1 : a;
          ctx.save();
          ctx.translate(px[i], py[i]);
          ctx.rotate(M.atan2(vy[i], vx[i]));
          ctx.drawImage(sprites[SP_STREAK][c], -w * STREAK_HEAD, -h * 0.5, w, h);
          ctx.restore();
          sz = h * 1.25;
          ctx.globalAlpha = (a > 1 ? 1 : a) * 0.75;
          ctx.drawImage(sprites[SP_CORE][c], px[i] - sz, py[i] - sz, sz * 2, sz * 2);
          continue;

        /* ---------------- steam ---------------- */
        case T_STEAM:
          a = (age < 0.10 ? age / 0.10 : 1) * M.pow(1 - age, 1.3) * 0.5;
          if (a <= 0.004) continue;
          sz = size[i] * (0.5 + age * size2[i]);
          c = age < 0.5 ? pcol2[i] : pcol[i];
          ctx.globalAlpha = a;
          ctx.save();
          ctx.translate(px[i], py[i]);
          ctx.rotate(rot[i]);
          ctx.drawImage(sprites[pspr[i]][c], -sz, -sz, sz * 2, sz * 2);
          ctx.restore();
          continue;

        /* ---------------- confetti (fake-3D tumble) ---------------- */
        case T_CONFETTI:
          a = age > 0.8 ? (1 - age) / 0.2 : 1;
          if (a <= 0.004) continue;
          cs = M.cos(ph[i]);
          h = size[i];
          w = h * 1.55 * (cs < 0 ? -cs : cs) + h * 0.10;
          sp = cs >= 0 ? SP_FOILL : SP_FOILD;
          ctx.globalAlpha = a;
          ctx.save();
          ctx.translate(px[i], py[i]);
          ctx.rotate(rot[i]);
          ctx.drawImage(sprites[sp][pcol[i]], -w * 0.5, -h * 0.5, w, h);
          ctx.restore();
          continue;

        /* ---------------- energy discharge splat ---------------- */
        case T_BLOOD:
          a = (age < 0.07 ? age / 0.07 : 1) * M.pow(1 - age, 1.4) * 0.95;
          if (a <= 0.004) continue;
          sz = size[i] * (0.55 + 0.45 * (age < 0.09 ? age / 0.09 : 1) + age * 0.18);
          ctx.globalAlpha = a;
          ctx.save();
          ctx.translate(px[i], py[i]);
          ctx.rotate(rot[i]);
          ctx.drawImage(sprites[SP_SPLAT][pcol[i]], -sz, -sz * size2[i], sz * 2, sz * 2 * size2[i]);
          ctx.restore();
          continue;

        /* ---------------- chrono terminal flash ---------------- */
        case T_FLASH:
          st = 1 - (1 - age) * (1 - age) * (1 - age);
          sz = size[i] * (0.12 + 2.35 * st);
          a = M.pow(1 - age, 2.1) * (age < 0.05 ? age / 0.05 : 1);
          if (a <= 0.004) continue;
          ctx.globalAlpha = a;
          ctx.drawImage(sprites[SP_CORE][pcol[i]], px[i] - sz, py[i] - sz, sz * 2, sz * 2);
          continue;

        /* ---------------- chrono afterimage ---------------- */
        case T_AFTER:
          a = M.pow(1 - age, 2.4) * 0.42;
          if (a <= 0.004) continue;
          sz = size[i] * (0.7 + age * size2[i]);
          ctx.globalAlpha = a;
          ctx.drawImage(sprites[SP_DOT][pcol[i]], px[i] - sz, py[i] - sz, sz * 2, sz * 2);
          continue;
      }
    }
  }

  Particles.draw = function (ctx, layer) {
    if (!inited || !ctx) return;
    if (bucketsDirty) rebuildBuckets();

    var ground = (layer === 'ground');
    var nn = ground ? nGN : nAN;
    var na = ground ? nGA : nAA;
    if (nn === 0 && na === 0) return;

    var pAlpha = ctx.globalAlpha;
    var pComp = ctx.globalCompositeOperation;

    if (nn > 0) {
      if (pComp !== 'source-over') ctx.globalCompositeOperation = 'source-over';
      drawBucket(ctx, ground ? bGN : bAN, nn);
    }
    if (na > 0) {
      ctx.globalCompositeOperation = 'lighter';
      drawBucket(ctx, ground ? bGA : bAA, na);
      ctx.globalCompositeOperation = pComp;
    } else if (nn > 0 && pComp !== 'source-over') {
      ctx.globalCompositeOperation = pComp;
    }
    ctx.globalAlpha = pAlpha;
  };

  /* ------------------------------------------------------------------
     Debug / benchmark helper: spawn n mixed particles
     ------------------------------------------------------------------ */
  var _o = { count: 1, scale: 1 };
  var STRESS_MIX = [T_MOTES, T_SPARKG, T_SMOKE, T_HOLO, T_EMBER, T_CONFETTI,
                    T_DUST, T_SPARKR, T_GLASS, T_STEAM, T_MOTES, T_SPARKG];

  Particles.stress = function (n, x, y, w, h) {
    if (!inited) Particles.init();
    n = (n | 0) || 500;
    x = (x === undefined) ? 0 : x;
    y = (y === undefined) ? 0 : y;
    w = (w === undefined) ? 900 : w;
    h = (h === undefined) ? 560 : h;
    refreshCap();
    _o.count = 1; _o.scale = 1;
    for (var i = 0; i < n; i++) {
      var t = STRESS_MIX[i % STRESS_MIX.length];
      eScale = 1; eColor = 0; eHasColor = false; eAngle = 0; eHasAngle = false;
      eSpread = 0; eLife = 0; eSpeed = 0; eDx = 0; eDy = 0;
      eCount = 1;
      if (spawn(t, x + rnd() * w, y + rnd() * h) < 0) break;
    }
   
  };

  /* live count as a real property */
  try {
    Object.defineProperty(Particles, 'count', {
      get: function () { return activeCount; },
      enumerable: true
    });
  } catch (e) { /* older engines: the field is kept up to date manually */ }

})(window);
