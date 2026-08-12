/* =====================================================================
   PARADOX VAULT — textures.js
   Procedural material + decal baking. Owner: agent-textures. SPEC.md §4.
   No external images, no network. Canvas2D + hand-written tileable noise.
   ===================================================================== */
(function (global) {
  'use strict';

  var PV = global.PV || (global.PV = {});
  var TEX = {};
  PV.Textures = TEX;
  TEX.ready = false;
  TEX.bakeMs = 0;
  TEX.names = [];

  var cache = {};
  var variantCache = {};
  var patternCache = {};
  var warned = {};
  var fallbackCanvas = null;
  var TAU = Math.PI * 2;

  /* ------------------------------------------------------------------
     small math (locals are faster than property lookups in hot loops)
     ------------------------------------------------------------------ */
  function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lp(a, b, t) { return a + (b - a) * t; }
  function ss(a, b, x) {
    var t = (x - a) / (b - a || 1e-6);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * (3 - 2 * t);
  }
  function fract(v) { return v - Math.floor(v); }

  function rgbOf(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixRGB(a, b, t, out) {
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  }

  /* ------------------------------------------------------------------
     hashing / rng
     ------------------------------------------------------------------ */
  function hashStr(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rngFrom(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* stable 0..1 from an integer triple */
  function h3(x, y, s) {
    var n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967296;
  }

  /* ------------------------------------------------------------------
     TILEABLE NOISE TOOLKIT
     Every generator below is periodic on the tile. Value noise is
     sampled on a torus: the integer lattice coordinates are wrapped
     modulo the lattice period, and every octave's period divides the
     tile size, so the field is *exactly* continuous across the seam.
     ------------------------------------------------------------------ */
  var LAT = {};
  var FIELDS = {};
  function lattice(px, py, seed) {
    var k = px + 'x' + py + ':' + seed;
    var L = LAT[k];
    if (L) return L;
    L = new Float32Array(px * py);
    var r = rngFrom(hashStr('pv-lat-' + k));
    for (var i = 0; i < L.length; i++) L[i] = r();
    LAT[k] = L;
    return L;
  }

  /* quintic-interpolated toroidal value noise; x,y are in lattice units */
  function latAt(L, px, py, x, y) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    var ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    var uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    var x0 = ix % px; if (x0 < 0) x0 += px;
    var y0 = iy % py; if (y0 < 0) y0 += py;
    var x1 = x0 + 1; if (x1 === px) x1 = 0;
    var y1 = y0 + 1; if (y1 === py) y1 = 0;
    var r0 = y0 * px, r1 = y1 * px;
    var a = L[r0 + x0], b = L[r0 + x1], c = L[r1 + x0], d = L[r1 + x1];
    var t = a + (b - a) * ux, u = c + (d - c) * ux;
    return t + (u - t) * uy;
  }

  /* fBm at an arbitrary tile-space coordinate (0..1 spans the tile) */
  function fbmA(x, y, px, py, oct, gain, seed) {
    var sum = 0, amp = 1, norm = 0, i;
    for (i = 0; i < oct; i++) {
      sum += amp * latAt(lattice(px, py, seed + i * 37), px, py, x * px, y * py);
      norm += amp; amp *= gain; px *= 2; py *= 2;
    }
    return sum / norm;
  }
  function fbm(x, y, p, oct, gain, seed) { return fbmA(x, y, p, p, oct, gain, seed); }

  /* ridged multifractal — sharp crests, used for the marble filaments */
  function ridgedA(x, y, px, py, oct, gain, seed) {
    var sum = 0, amp = 1, norm = 0, w = 1, i, n;
    for (i = 0; i < oct; i++) {
      n = latAt(lattice(px, py, seed + i * 53), px, py, x * px, y * py);
      n = 1 - Math.abs(n * 2 - 1);
      n = n * n;
      sum += amp * n * w;
      w = n * 1.5; if (w > 1) w = 1;
      norm += amp; amp *= gain; px *= 2; py *= 2;
    }
    return sum / norm;
  }
  function ridged(x, y, p, oct, gain, seed) { return ridgedA(x, y, p, p, oct, gain, seed); }

  /* domain-warped fBm: f(p + w*g(p)); both f and g share the tile period
     so the composition is still exactly periodic. */
  function warpedRidged(x, y, p, oct, gain, seed, warpAmt, warpP) {
    var wx = (fbm(x, y, warpP, 3, 0.5, seed + 911) - 0.5) * warpAmt;
    var wy = (fbm(x, y, warpP, 3, 0.5, seed + 1777) - 0.5) * warpAmt;
    return ridged(x + wx, y + wy, p, oct, gain, seed);
  }

  /* whole-image fBm — one tight pass per octave, far cheaper than
     calling fbmA() per pixel. Rectangular periods give anisotropy. */
  function addOct(dst, N, px, py, amp, seed) {
    var L = lattice(px, py, seed);
    var sx = px / N, sy = py / N;
    var xi0 = new Int32Array(N), xi1 = new Int32Array(N), xw = new Float32Array(N);
    var x, y, g, i0, f, a0;
    for (x = 0; x < N; x++) {
      g = x * sx; i0 = Math.floor(g); f = g - i0;
      a0 = i0 % px; if (a0 < 0) a0 += px;
      xi0[x] = a0; xi1[x] = (a0 + 1 === px) ? 0 : a0 + 1;
      xw[x] = f * f * f * (f * (f * 6 - 15) + 10);
    }
    for (y = 0; y < N; y++) {
      var gy = y * sy, j0 = Math.floor(gy), fy = gy - j0;
      var wy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
      var b0 = j0 % py; if (b0 < 0) b0 += py;
      var b1 = (b0 + 1 === py) ? 0 : b0 + 1;
      var r0 = b0 * px, r1 = b1 * px, o = y * N;
      for (var x2 = 0; x2 < N; x2++) {
        var i00 = xi0[x2], i01 = xi1[x2], wx = xw[x2];
        var a = L[r0 + i00], b = L[r0 + i01], c = L[r1 + i00], d = L[r1 + i01];
        var t = a + (b - a) * wx, u = c + (d - c) * wx;
        dst[o + x2] += amp * (t + (u - t) * wy);
      }
    }
  }
  function fieldFbm(N, px, py, oct, gain, seed) {
    var f = new Float32Array(N * N), amp = 1, norm = 0, i;
    for (i = 0; i < oct; i++) {
      addOct(f, N, px, py, amp, seed + i * 37);
      norm += amp; amp *= gain; px *= 2; py *= 2;
    }
    var inv = 1 / norm;
    for (i = 0; i < f.length; i++) f[i] *= inv;
    return f;
  }

  /* Whole-image ridged multifractal. Same construction as ridgedA() but
     evaluated one octave at a time over the entire tile, which turns
     ~11 lattice lookups *per pixel* into ~4 tight linear passes. */
  function fieldRidged(N, px, py, oct, gain, seed) {
    var n2 = N * N;
    var sum = new Float32Array(n2), w = new Float32Array(n2), tmp = new Float32Array(n2);
    var amp = 1, norm = 0, i, o;
    for (i = 0; i < n2; i++) w[i] = 1;
    for (o = 0; o < oct; o++) {
      if (o) { for (i = 0; i < n2; i++) tmp[i] = 0; }
      addOct(tmp, N, px, py, 1, seed + o * 53);
      for (i = 0; i < n2; i++) {
        var n = 1 - Math.abs(tmp[i] * 2 - 1);
        n *= n;
        sum[i] += amp * n * w[i];
        var ww = n * 1.5;
        w[i] = ww > 1 ? 1 : ww;
      }
      norm += amp; amp *= gain; px *= 2; py *= 2;
    }
    var inv = 1 / norm;
    for (i = 0; i < n2; i++) sum[i] *= inv;
    return sum;
  }

  /* Resample a field through a (tileable) displacement pair. Both the field
     and the offsets are periodic on the tile, so the result still tiles. */
  function warpField(src, N, wx, wy, ampPx, ox, oy) {
    var out = new Float32Array(N * N);
    ox = ox || 0; oy = oy || 0;
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var i = y * N + x;
        out[i] = bilWrap(src, N, x + ox + (wx[i] - 0.5) * ampPx, y + oy + (wy[i] - 0.5) * ampPx);
      }
    }
    return out;
  }

  /* shared-field cache: several materials want the same base noise at
     different scales/offsets — generate it once. Cleared after init(). */
  function F(key, gen) {
    var f = FIELDS[key];
    if (!f) { f = FIELDS[key] = gen(); }
    return f;
  }

  /* Upsample a small field to a bigger one, wrapped + bilinear. */
  function upField(src, n, N) {
    var out = new Float32Array(N * N), s = n / N;
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) out[y * N + x] = bilWrap(src, n, x * s, y * s);
    }
    return out;
  }

  /* cheap toroidal Worley — module-level outputs to avoid per-pixel GC.
     The feature point of every cell is hashed ONCE into a table: the naive
     form costs 18 h3() calls per sample and five materials sample it per
     pixel, which made it the second-hottest thing in the whole bake. */
  var WCELL = {};
  function wcells(C, seed) {
    var k = C + ':' + seed;
    var t = WCELL[k];
    if (t) return t;
    var n = C * C, i, j, o;
    var px = new Float32Array(n), py = new Float32Array(n);
    for (j = 0; j < C; j++) {
      for (i = 0; i < C; i++) {
        o = j * C + i;
        px[o] = h3(i, j, seed);
        py[o] = h3(i, j, seed + 9871);
      }
    }
    t = WCELL[k] = { x: px, y: py };
    return t;
  }
  var _wf1 = 0, _wf2 = 0;
  var _wcC = -1, _wcS = 0, _wcX = null, _wcY = null;
  function worley(x, y, C, seed) {
    if (C !== _wcC || seed !== _wcS) {
      var t = wcells(C, seed);
      _wcC = C; _wcS = seed; _wcX = t.x; _wcY = t.y;
    }
    var TX = _wcX, TY = _wcY;
    var gx = x * C, gy = y * C;
    var ix = Math.floor(gx), iy = Math.floor(gy);
    var best = 1e9, best2 = 1e9, i, j;
    for (j = -1; j <= 1; j++) {
      var cy = iy + j;
      var wy = cy % C; if (wy < 0) wy += C;
      var row = wy * C, dy = cy - gy;
      for (i = -1; i <= 1; i++) {
        var cx = ix + i;
        var wx = cx % C; if (wx < 0) wx += C;
        var o = row + wx;
        var ddx = cx + TX[o] - gx, ddy = dy + TY[o];
        var d = ddx * ddx + ddy * ddy;
        if (d < best) { best2 = best; best = d; } else if (d < best2) best2 = d;
      }
    }
    _wf1 = Math.sqrt(best); _wf2 = Math.sqrt(best2);
    return _wf1;
  }

  /* bilinear sample of a float field with power-of-two wrap */
  function bilWrap(f, N, x, y) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    var M = N - 1;
    var x0 = ix & M, x1 = (ix + 1) & M, y0 = (iy & M) * N, y1 = ((iy + 1) & M) * N;
    var a = f[y0 + x0], b = f[y0 + x1], c = f[y1 + x0], d = f[y1 + x1];
    var t = a + (b - a) * fx, u = c + (d - c) * fx;
    return t + (u - t) * fy;
  }

  /* Line-integral convolution: smear a field along a direction field.
     The kernel is symmetric so a sign flip in the direction field across
     the seam is harmless — that is what keeps the swirled brass tileable. */
  function lic(src, N, dirFn, taps, step) {
    var out = new Float32Array(N * N);
    var d = [0, 0];
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        dirFn(x, y, d);
        var sum = 0, wsum = 0;
        for (var k = -taps; k <= taps; k++) {
          var w = 1 - Math.abs(k) / (taps + 1);
          sum += w * bilWrap(src, N, x + d[0] * k * step, y + d[1] * k * step);
          wsum += w;
        }
        out[y * N + x] = sum / wsum;
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------
     SURFACE + LIGHTING
     Height field -> normal (wrapped gradient, so the lighting is seamless
     too) -> lambert + blinn-phong, per-material exponent/tint, edge AO,
     tone curve, per-pixel grain.
     ------------------------------------------------------------------ */
  var LX = -0.549, LY = -0.549, LZ = 0.629;     /* light: upper-left, above */
  var HX = -0.304, HY = -0.304, HZ = 0.903;     /* half-vector with V=(0,0,1) */

  function ones(n) { var a = new Float32Array(n); a.fill(1); return a; }

  function surfWH(W, H) {
    var n2 = W * H;
    return {
      N: W, W: W, H: H, n2: n2,
      h: new Float32Array(n2),
      alb: new Float32Array(n2 * 3),
      ao: ones(n2),
      spec: ones(n2),
      alpha: null
    };
  }
  function surf(N) { return surfWH(N, N); }

  /* pow(x, e) lookup over x in 0..1 — the Blinn-Phong term is the single
     hottest math op in the whole bake, and 12 materials all pay it. */
  var LUTN = 1024;
  var powLuts = {};
  function powLut(e) {
    var key = e.toFixed(3);
    var L = powLuts[key];
    if (L) return L;
    L = new Float32Array(LUTN + 1);
    for (var i = 0; i <= LUTN; i++) L[i] = Math.pow(i / LUTN, e);
    powLuts[key] = L;
    return L;
  }

  function shade(s, o) {
    o = o || {};
    var N = s.W || s.N, HH = s.H || s.N, M = N - 1, MY = HH - 1, n2 = s.n2;
    var cv = PV.makeCanvas(N, HH);
    var img = cv.ctx.createImageData(N, HH);
    var data = img.data;
    var h = s.h, alb = s.alb, ao = s.ao, sp = s.spec, alpha = s.alpha;
    var hS = o.hSpec || h;
    var bump = o.bump === undefined ? 2.4 : o.bump;
    var bumpS = o.bumpSpec === undefined ? bump : o.bumpSpec;
    var amb = o.amb === undefined ? 0.47 : o.amb;
    var dif = o.dif === undefined ? 0.84 : o.dif;
    var ex = o.exp === undefined ? 32 : o.exp;
    var si = o.si === undefined ? 0.35 : o.si;
    var tint = o.tint || [255, 246, 232];
    var s2 = o.spec2 || null;
    var s2m = s2 ? s2.mask : null;
    var s2e = s2 ? s2.exp : 60, s2i = s2 ? s2.si : 0.6;
    var s2t = s2 ? s2.tint : [255, 214, 128];
    var grain = o.grain === undefined ? 3.2 : o.grain;
    var contrast = o.contrast === undefined ? 0.16 : o.contrast;
    var lift = o.lift === undefined ? 0 : o.lift;
    var tr = tint[0] / 255, tg = tint[1] / 255, tb = tint[2] / 255;
    var t2r = s2t[0] / 255, t2g = s2t[1] / 255, t2b = s2t[2] / 255;
    var LUT = powLut(ex), LUT2 = s2m ? powLut(s2e) : null;

    for (var y = 0; y < HH; y++) {
      var yn = y * N, yu = ((y - 1) & MY) * N, yd = ((y + 1) & MY) * N;
      for (var x = 0; x < N; x++) {
        var i = yn + x, xl = (x - 1) & M, xr = (x + 1) & M;
        /* --- diffuse normal --- */
        var nx = (h[yn + xl] - h[yn + xr]) * bump;
        var ny = (h[yu + x] - h[yd + x]) * bump;
        var inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
        nx *= inv; ny *= inv;
        var nz = inv;
        var ndl = nx * LX + ny * LY + nz * LZ;
        if (ndl < 0) ndl = 0;
        var lum = (amb + dif * ndl) * ao[i];

        /* --- specular normal (may come from a stretched height field) --- */
        var sx2, sy2, sz2;
        if (hS !== h || bumpS !== bump) {
          sx2 = (hS[yn + xl] - hS[yn + xr]) * bumpS;
          sy2 = (hS[yu + x] - hS[yd + x]) * bumpS;
          var iv2 = 1 / Math.sqrt(sx2 * sx2 + sy2 * sy2 + 1);
          sx2 *= iv2; sy2 *= iv2; sz2 = iv2;
        } else { sx2 = nx; sy2 = ny; sz2 = nz; }
        var ndh = sx2 * HX + sy2 * HY + sz2 * HZ;
        if (ndh < 0) ndh = 0; else if (ndh > 1) ndh = 1;
        var li = (ndh * LUTN) | 0;
        var spv = LUT[li] * si * sp[i];

        var r = alb[i * 3] * lum + spv * 255 * tr;
        var g = alb[i * 3 + 1] * lum + spv * 255 * tg;
        var b = alb[i * 3 + 2] * lum + spv * 255 * tb;

        if (s2m) {
          var sv2 = LUT2[li] * s2i * s2m[i];
          r += sv2 * 255 * t2r; g += sv2 * 255 * t2g; b += sv2 * 255 * t2b;
        }

        /* --- tone curve + grain --- */
        var gn = (h3(x, y, 7717) - 0.5) * grain;
        var cr = r / 255, cg = g / 255, cb = b / 255;
        cr = cr + contrast * (cr * cr * (3 - 2 * cr) - cr) + lift;
        cg = cg + contrast * (cg * cg * (3 - 2 * cg) - cg) + lift;
        cb = cb + contrast * (cb * cb * (3 - 2 * cb) - cb) + lift;

        var p = i * 4;
        data[p] = cr * 255 + gn;
        data[p + 1] = cg * 255 + gn;
        data[p + 2] = cb * 255 + gn;
        data[p + 3] = alpha ? alpha[i] * 255 : 255;
      }
    }
    cv.ctx.putImageData(img, 0, 0);
    return cv.canvas;
  }

  /* ------------------------------------------------------------------
     canvas helpers
     ------------------------------------------------------------------ */
  function hi(ctx) {
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    return ctx;
  }
  /* draw at 2x into a scratch canvas whose user space is the final size */
  function scratch2x(w, h) {
    var c = PV.makeCanvas(w * 2, h * 2);
    hi(c.ctx);
    c.ctx.scale(2, 2);
    c.w = w; c.h = h;
    return c;
  }
  function down(srcCanvas, w, h) {
    var o = PV.makeCanvas(w, h);
    hi(o.ctx);
    o.ctx.drawImage(srcCanvas, 0, 0, w, h);
    return o.canvas;
  }

  /* automatic rim light: keep only the band of the silhouette on one
     side, tint it, and screen it back over the sprite. */
  function rimLight(cnv, dx, dy, color, alpha, blend) {
    var w = cnv.width, h = cnv.height;
    var b = PV.makeCanvas(w, h);
    b.ctx.drawImage(cnv, 0, 0);
    b.ctx.globalCompositeOperation = 'destination-out';
    b.ctx.drawImage(cnv, dx, dy);
    b.ctx.globalCompositeOperation = 'source-in';
    b.ctx.fillStyle = color;
    b.ctx.fillRect(0, 0, w, h);
    var c = cnv.getContext('2d');
    c.save();
    c.globalCompositeOperation = blend || 'lighter';
    c.globalAlpha = alpha;
    c.drawImage(b.canvas, 0, 0);
    c.restore();
  }

  /* soft baked contact shadow (props) */
  function contactShadow(ctx, cx, cy, rx, ry, a) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(0,0,0,' + a + ')');
    g.addColorStop(0.45, 'rgba(0,0,0,' + (a * 0.6) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* classic metal ramp across a direction (art-deco brass) */
  function metalGrad(ctx, x0, y0, x1, y1, dark, mid, hot) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0.00, hot);
    g.addColorStop(0.16, mid);
    g.addColorStop(0.34, dark);
    g.addColorStop(0.52, mid);
    g.addColorStop(0.66, hot);
    g.addColorStop(0.82, mid);
    g.addColorStop(1.00, dark);
    return g;
  }
  var BR_DARK = '#3c2d0b', BR_MID = '#a8842a', BR_HOT = '#f7e6ae', BR_DEEP = '#241a06';

  function brassFor(ctx, x, y, w, h) {
    return metalGrad(ctx, x, y, x + w * 0.35, y + h, BR_DARK, BR_MID, BR_HOT);
  }

  /* per-pixel multiply/overlay of a noise field onto an existing canvas */
  function noiseOverlay(cnv, amount, px, py, oct, seed, warm) {
    var w = cnv.width, h = cnv.height;
    var ctx = cnv.getContext('2d');
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    /* always a 128 field, wrapped — props are small and this is grunge,
       nobody can see the 128px repeat through the sprite art */
    var N = 128;
    var f = F('ov.' + px + '.' + py + '.' + oct + '.' + seed, function () {
      return fieldFbm(N, px, py, oct, 0.55, seed);
    });
    for (var y = 0; y < h; y++) {
      var yo = (y & 127) * N;
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        if (d[i + 3] === 0) continue;
        var n = (f[yo + (x & 127)] - 0.5) * 2 * amount;
        var g = (h3(x, y, 313) - 0.5) * amount * 26;
        d[i] = d[i] * (1 + n) + g + (warm ? n * 8 : 0);
        d[i + 1] = d[i + 1] * (1 + n) + g;
        d[i + 2] = d[i + 2] * (1 + n * 1.05) + g - (warm ? n * 6 : 0);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /* ==================================================================
     TILING MATERIALS (128x128, seamless)
     ================================================================== */

  /* --- shared floor slab helper: wrapped distance to the grout lines --- */
  function groutDist(x, y, cell) {
    var dx = x % cell; if (dx > cell * 0.5) dx = cell - dx;
    var dy = y % cell; if (dy > cell * 0.5) dy = cell - dy;
    return dx < dy ? dx : dy;
  }

  /* Polished near-black marble.
     Design notes, learned the hard way: this tile is laid as a *continuous
     pattern* across a whole room, so anything with strong local contrast
     turns into a visible 128px grid the instant your eye finds it. So:
       * the albedo range is deliberately tiny (#0b0e13 .. #2c3542);
       * there is no bright core, no speck population, no built-in grout —
         render.js draws the slab joints itself at slab scale;
       * what sells the material is the *specular*, not the albedo: an
         almost flat height field with fine orange-peel, a broad low-power
         sheen and a tight high-power glint on the vein ridges. */
  function bakeMarble(gold) {
    var N = 128, n2 = N * N, s = surf(N);
    var sd = gold ? 400 : 0;

    /* --- domain warp (shared between the two marbles, different offsets) --- */
    var wx = F('mw.x' + sd, function () { return fieldFbm(N, 3, 3, 3, 0.5, 11 + sd); });
    var wy = F('mw.y' + sd, function () { return fieldFbm(N, 3, 3, 3, 0.5, 29 + sd); });

    /* --- three vein generations, warped, coarse -> capillary.
       Uniform density everywhere is what keeps the repeat invisible: it is
       localised *blobs*, not contrast, that let the eye lock onto a 128px
       grid, so every generation is a thin net that covers the whole tile. */
    var g1 = warpField(fieldRidged(N, 4, 4, 4, 0.50, 101 + sd), N, wx, wy, 22, 0, 0);
    var g2 = warpField(fieldRidged(N, 9, 9, 3, 0.48, 211 + sd), N, wx, wy, 11, 37, 19);
    var g3 = warpField(fieldRidged(N, 19, 19, 2, 0.45, 317 + sd), N, wx, wy, 5, 71, 53);

    /* --- base stone body: faint calcite clouding + surface micro-relief --- */
    var mot = F('m.mot' + sd, function () { return fieldFbm(N, 5, 5, 3, 0.55, 41 + sd); });
    var micro = F('m.micro', function () { return fieldFbm(N, 40, 40, 2, 0.5, 53); });

    var base1 = rgbOf('#090c11'), base2 = rgbOf('#161b24');
    var vHalo = rgbOf('#28313e'), vBody = rgbOf('#4b5768'), vEdge = rgbOf('#77879b');
    var gold1 = rgbOf('#6b5219'), gold2 = rgbOf('#c19b3e');
    var tmp = [0, 0, 0];
    var goldMask = gold ? new Float32Array(n2) : null;
    var veinSpec = new Float32Array(n2);

    var gv = gold ? warpField(fieldRidged(N, 11, 11, 3, 0.48, 613), N, wx, wy, 8, 23, 91) : null;

    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var i = y * N + x;

        /* primary filaments, secondary branches, capillaries */
        var c1 = ss(0.70, 0.94, g1[i]);
        var h1 = ss(0.48, 0.82, g1[i]);
        var c2 = ss(0.74, 0.96, g2[i]);
        var c3 = ss(0.80, 0.99, g3[i]);

        var vein = cl(c1 * 0.90 + c2 * 0.60 + c3 * 0.34, 0, 1);
        var halo = h1;

        var m = mot[i];
        mixRGB(base1, base2, cl(0.30 + (m - 0.5) * 0.85 + (micro[i] - 0.5) * 0.30, 0, 1), tmp);
        mixRGB(tmp, vHalo, halo * 0.40, tmp);
        mixRGB(tmp, vBody, vein * 0.70, tmp);
        mixRGB(tmp, vEdge, vein * vein * vein * 0.34, tmp);

        /* nearly flat: polished stone has relief only where the softer
           calcite vein has worn a hair below the surface */
        var hgt = (micro[i] - 0.5) * 0.34 + (m - 0.5) * 0.10 - vein * 0.20;
        /* keep the sheen modulation high-frequency — a low-frequency
           specular blob is the single most visible tiling artefact there is */
        var spv = 0.74 + (micro[i] - 0.5) * 0.30 - vein * 0.16;
        veinSpec[i] = vein * (0.6 + 0.4 * micro[i]);

        if (gold) {
          var gc = ss(0.80, 0.97, gv[i]);
          var gh = ss(0.64, 0.86, gv[i]) * 0.30;
          mixRGB(tmp, gold1, cl(gh + gc * 0.5, 0, 1) * 0.85, tmp);
          mixRGB(tmp, gold2, gc * 0.85, tmp);
          goldMask[i] = gc;
          hgt += gc * 0.10;
        }

        s.ao[i] = 1 - halo * 0.05;
        s.spec[i] = spv;
        s.h[i] = hgt;
        s.alb[i * 3] = tmp[0]; s.alb[i * 3 + 1] = tmp[1]; s.alb[i * 3 + 2] = tmp[2];
      }
    }
    /* two speculars: broad polish sheen + a tight glint that only rides the
       veins, which is what makes it read "wet stone" instead of "grey noise" */
    return shade(s, {
      bump: 1.15, exp: 18, si: 0.16, tint: [188, 208, 232],
      amb: 0.50, dif: 0.82, contrast: 0.13, grain: 2.0,
      spec2: gold
        ? { mask: goldMask, exp: 64, si: 0.62, tint: [255, 214, 130] }
        : { mask: veinSpec, exp: 70, si: 0.34, tint: [206, 226, 250] }
    });
  }

  function bakeGranite() {
    var N = 128, s = surf(N);
    var mot = fieldFbm(N, 4, 4, 4, 0.55, 907);
    var mid = fieldFbm(N, 16, 16, 3, 0.5, 911);
    var b1 = rgbOf('#15181d'), b2 = rgbOf('#282d35');
    var quartz = rgbOf('#9aa3b0'), mica = rgbOf('#cfd6e0'), dark = rgbOf('#070809');
    var tmp = [0, 0, 0];
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var i = y * N + x, u = x / N, v = y / N;
        mixRGB(b1, b2, cl(mot[i] * 1.1 + mid[i] * 0.35 - 0.15, 0, 1), tmp);

        /* three speckle populations */
        worley(u, v, 42, 31);
        var sp1 = 1 - ss(0.0, 0.30, _wf1);
        worley(u + 0.37, v + 0.11, 26, 77);
        var sp2 = 1 - ss(0.0, 0.22, _wf1);
        var dust = h3(x, y, 991);
        var fleck = dust > 0.988 ? (dust - 0.988) / 0.012 : 0;

        mixRGB(tmp, dark, sp2 * 0.55, tmp);
        mixRGB(tmp, quartz, sp1 * 0.30, tmp);
        mixRGB(tmp, mica, fleck * 0.42, tmp);

        var hgt = mot[i] * 0.25 + sp1 * 0.35 - sp2 * 0.2 + fleck * 0.5 + (dust - 0.5) * 0.12;

        /* no built-in joints: render.js lays the slab grid at slab scale */
        s.ao[i] = 1;
        s.spec[i] = 0.4 + sp1 * 1.1 + fleck * 1.6;
        s.h[i] = hgt;
        s.alb[i * 3] = tmp[0]; s.alb[i * 3 + 1] = tmp[1]; s.alb[i * 3 + 2] = tmp[2];
      }
    }
    return shade(s, {
      bump: 2.0, exp: 14, si: 0.10, tint: [225, 232, 240],
      amb: 0.52, dif: 0.78, contrast: 0.12, grain: 5.0
    });
  }

  /* Herringbone parquet.
     Work in the 45-degree lattice u=x+y, v=y-x. A herringbone of planks
     2W x W tiles that lattice with period 4W; picking W=32 gives period
     128 in u and v, which is exactly our tile, so the pattern is
     seamless and the planks run at the proper 45 degrees. */
  function bakeParquet() {
    var N = 128, s = surf(N), W = 32, P = 4 * W;
    var warmF = fieldFbm(N, 4, 4, 3, 0.5, 1201);
    var sweep = fieldFbm(N, 2, 2, 2, 0.5, 1301);
    var dirt = fieldFbm(N, 8, 8, 3, 0.5, 1409);
    var GRA = F('wood.grain', function () { return fieldFbm(N, 6, 48, 3, 0.5, 1500); });
    var FIG = F('wood.fig', function () { return fieldFbm(N, 3, 3, 3, 0.5, 1600); });
    var w1 = rgbOf('#2a1a10'), w2 = rgbOf('#5a3a22'), w3 = rgbOf('#7d5530');
    var wdark = rgbOf('#150c07');
    var tmp = [0, 0, 0];
    var INV2 = 1 / Math.SQRT2;

    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var i = y * N + x;
        var u = (x + y) % P;
        var v = (y - x) % P; if (v < 0) v += P;
        var ci = (u / W) | 0, cj = (v / W) | 0;
        var k = (ci + cj) & 3;
        var oi, oj, horiz, pw, ph;
        if (k === 0) { oi = ci; oj = cj; horiz = 1; }
        else if (k === 1) { oi = ci - 1; oj = cj; horiz = 1; }
        else if (k === 2) { oi = ci; oj = cj; horiz = 0; }
        else { oi = ci; oj = cj - 1; horiz = 0; }
        pw = horiz ? 2 * W : W; ph = horiz ? W : 2 * W;
        var lu = u - oi * W, lv = v - oj * W;
        var pid = h3(((oi % 4) + 4) % 4, ((oj % 4) + 4) % 4, horiz ? 17 : 23);
        var pid2 = h3(((oi % 4) + 4) % 4, ((oj % 4) + 4) % 4, horiz ? 71 : 91);

        /* along / across the plank, in plank units */
        var al = horiz ? lu : lv;
        var ac = horiz ? lv : lu;
        var alen = horiz ? pw : ph;
        var awid = W;

        /* grain: stretched noise along the plank + cathedral figure.
           Both come from precomputed anisotropic fields sampled at ~1px
           stride with a per-plank offset — same look, ~8x cheaper than
           evaluating multi-octave fBm per pixel. */
        var grain = bilWrap(GRA, N, al + pid * 211.7, ac + pid2 * 97.3);
        var rings = Math.abs(Math.sin((ac * 0.55 + grain * 5.5 + pid * 9) * 1.05));
        rings = rings * rings * rings;
        var fig = bilWrap(FIG, N, al * 0.5 + pid * 57.1, ac * 0.4 + pid2 * 131.9);

        var tone = 0.30 + (pid - 0.5) * 0.34 + (fig - 0.5) * 0.30 + (warmF[i] - 0.5) * 0.18;
        mixRGB(w1, w2, cl(tone, 0, 1), tmp);
        mixRGB(tmp, w3, cl((grain - 0.55) * 1.5, 0, 1) * 0.55, tmp);
        mixRGB(tmp, wdark, rings * 0.55 + (1 - grain) * 0.18, tmp);

        /* bevel: distance to plank edge, converted to real pixels */
        var de = Math.min(al, alen - al, ac, awid - ac) * INV2;
        var bev = 1 - ss(0.0, 2.6, de);
        var seam = 1 - ss(0.0, 0.9, de);
        mixRGB(tmp, wdark, seam * 0.75, tmp);

        var hgt = 0.55 + (grain - 0.5) * 0.14 - rings * 0.10 - bev * 0.85 - seam * 0.7
          + (pid - 0.5) * 0.10;

        s.h[i] = hgt;
        s.ao[i] = (1 - 0.30 * bev - 0.32 * seam) * (0.94 + dirt[i] * 0.12);
        s.spec[i] = (0.45 + 1.05 * sweep[i]) * (1 - seam * 0.9) * (0.75 + rings * 0.5);
        s.alb[i * 3] = tmp[0]; s.alb[i * 3 + 1] = tmp[1]; s.alb[i * 3 + 2] = tmp[2];
      }
    }
    return shade(s, {
      bump: 2.6, exp: 46, si: 0.55, tint: [255, 236, 200],
      amb: 0.46, dif: 0.86, contrast: 0.17, grain: 3.4
    });
  }

  /* Deep oxblood wool carpet.
     Three scales, all of which have to be present or it reads as flat paint:
       1. the WEAVE — a plain over/under of 4px warp and weft yarns, each yarn
          crowned (lit) in the middle and shadowed in the gutters;
       2. the FIBRE — high-frequency noise *along* each yarn's own direction,
          which is what makes wool look fuzzy rather than plastic;
       3. the PILE — a low-frequency direction field that leans the whole nap
          one way or the other, so the sheen drifts in soft bands. */
  function bakeCarpet() {
    var N = 128, n2 = N * N, s = surf(N);
    var Q = 4;                                        /* yarn pitch, px */
    var pile = fieldFbm(N, 4, 4, 2, 0.5, 2101);       /* nap direction */
    var blotch = fieldFbm(N, 7, 7, 3, 0.5, 2203);     /* dye unevenness */
    var fibW = fieldFbm(N, 64, 5, 2, 0.5, 2301);      /* fibre across warp (runs y) */
    var fibF = fieldFbm(N, 5, 64, 2, 0.5, 2311);      /* fibre across weft (runs x) */
    var fuzz = fieldFbm(N, 96, 96, 2, 0.5, 2333);     /* loose surface fuzz */

    var c0 = rgbOf('#230a11'), c1 = rgbOf('#40121d'), c2 = rgbOf('#6b1f2e');
    var c3 = rgbOf('#8c3040');
    var decoC = rgbOf('#9a6a3a'), decoHot = rgbOf('#c79a55');
    var tmp = [0, 0, 0];
    var hSpec = new Float32Array(n2);

    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var i = y * N + x;

        /* --- weave --- */
        var cx = (x / Q) | 0, cy = (y / Q) | 0;
        var weft = ((cx + cy) & 1) === 0;              /* this cell shows weft */
        var fx = (x % Q) + 0.5, fy = (y % Q) + 0.5;
        /* crown of the yarn that is on top here */
        var crown = weft ? Math.sin(Math.PI * fy / Q) : Math.sin(Math.PI * fx / Q);
        /* the yarn passing underneath dips away in the other axis */
        var under = weft ? Math.sin(Math.PI * fx / Q) : Math.sin(Math.PI * fy / Q);
        crown = crown * crown;                        /* rounder yarn */

        var fib = weft ? fibF[i] : fibW[i];
        var yarnId = h3(weft ? cy : cx, weft ? 3 : 7, 4477);

        /* --- colour: dye lot per yarn + fibre + dye blotching --- */
        var tone = 0.30 + (blotch[i] - 0.5) * 0.34 + (yarnId - 0.5) * 0.22
          + (fib - 0.5) * 0.62 + (fuzz[i] - 0.5) * 0.30;
        mixRGB(c1, c2, cl(tone, 0, 1), tmp);
        /* lit crown / shadowed gutter — this is the weave you actually see */
        mixRGB(tmp, c3, cl((crown - 0.45) * 1.7, 0, 1) * 0.42, tmp);
        mixRGB(tmp, c0, (1 - crown) * 0.55 + (1 - under) * 0.12, tmp);

        /* --- deco motif, woven not painted: it recolours the yarns --- */
        var dx = Math.abs(fract(x / 64) - 0.5), dy = Math.abs(fract(y / 64) - 0.5);
        var dd = dx + dy;
        var motif = 0;
        motif += (1 - ss(0.012, 0.034, Math.abs(dd - 0.40))) * 0.80;
        motif += (1 - ss(0.010, 0.028, Math.abs(dd - 0.30))) * 0.50;
        motif += (1 - ss(0.012, 0.032, Math.abs(dd - 0.115))) * 0.66;
        motif += (dd < 0.055 ? 1 : 0) * 0.55;
        /* quantise to the yarn grid so the pattern is made *of* threads */
        motif = cl(motif, 0, 1) * (0.45 + 0.55 * crown) * (0.7 + 0.6 * yarnId);
        mixRGB(tmp, decoC, motif * 0.46, tmp);
        mixRGB(tmp, decoHot, motif * motif * crown * 0.22, tmp);

        /* --- relief + anisotropic sheen --- */
        var nap = (pile[i] - 0.5);
        s.h[i] = crown * 0.62 + (fib - 0.5) * 0.55 + (fuzz[i] - 0.5) * 0.42
          + (h3(x, y, 88) - 0.5) * 0.30 + motif * 0.10 + under * 0.06;
        /* the specular normal only sees the fibre + nap, never the weave —
           that is what gives wool its soft directional sheen */
        hSpec[i] = (fib - 0.5) * 0.9 + nap * 0.5 + (fuzz[i] - 0.5) * 0.25;
        s.ao[i] = 0.80 + crown * 0.22 + nap * 0.10;
        s.spec[i] = 0.42 + fib * 0.55 + nap * 0.45 + motif * 0.5;
        s.alb[i * 3] = tmp[0]; s.alb[i * 3 + 1] = tmp[1]; s.alb[i * 3 + 2] = tmp[2];
      }
    }
    return shade(s, {
      bump: 1.9, hSpec: hSpec, bumpSpec: 1.3,
      exp: 4, si: 0.10, tint: [255, 206, 196],
      amb: 0.54, dif: 0.76, contrast: 0.12, grain: 5.0
    });
  }

  function bakeGrate() {
    var N = 128, s = surf(N);
    var streak = fieldFbm(N, 3, 96, 4, 0.5, 3101);
    var streak2 = fieldFbm(N, 2, 128, 3, 0.5, 3107);
    var bl = fieldFbm(N, 4, 4, 3, 0.5, 3203);
    var st1 = rgbOf('#3d434e'), st2 = rgbOf('#79828f'), stHot = rgbOf('#aab3c0');
    var holeC = rgbOf('#04060a');
    var tmp = [0, 0, 0];
    var R = 10.0;

    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var i = y * N + x;
        var st = streak[i] * 0.7 + streak2[i] * 0.3;
        var tone = 0.30 + (st - 0.5) * 1.05 + (bl[i] - 0.5) * 0.35;
        mixRGB(st1, st2, cl(tone, 0, 1), tmp);
        mixRGB(tmp, stHot, cl((st - 0.72) * 3, 0, 1) * 0.35, tmp);

        var hgt = 0.5 + (st - 0.5) * 0.30 + (bl[i] - 0.5) * 0.12;
        var spv = 0.6 + st * 1.1;
        var aov = 1;

        /* staggered perforations: 32px grid, odd rows offset 16 (y period 64) */
        var row = (y / 32) | 0;
        var offx = (row & 1) ? 16 : 0;
        var hx = ((x - offx) % 32 + 32) % 32 - 16;
        var hy = (y % 32) - 16;
        var rr = Math.sqrt(hx * hx + hy * hy);
        if (rr < R + 3.5) {
          var inside = 1 - ss(R - 1.2, R + 0.9, rr);
          if (inside > 0) {
            /* bore wall: the far (lower-right) wall catches the light */
            var ang = Math.atan2(hy, hx);
            var facing = 0.5 + 0.5 * Math.cos(ang - 0.785);
            var wall = ss(R - 4.5, R - 0.5, rr);
            var depth = 0.06 + wall * 0.42 * facing;
            mixRGB(tmp, holeC, inside * (1 - depth * 0.9), tmp);
            hgt -= inside * 3.4;
            aov = 1 - inside * 0.72;
            spv = spv * (1 - inside * 0.85) + inside * wall * facing * 0.9;
          }
          /* chamfer ring just outside the bore reads as a rim */
          var rim = (1 - ss(0.0, 2.4, Math.abs(rr - (R + 1.6))));
          hgt += rim * 0.30;
        }
        s.h[i] = hgt;
        s.ao[i] = aov;
        s.spec[i] = spv;
        s.alb[i * 3] = tmp[0]; s.alb[i * 3 + 1] = tmp[1]; s.alb[i * 3 + 2] = tmp[2];
      }
    }
    return shade(s, {
      bump: 3.4, exp: 30, si: 0.55, tint: [225, 238, 255],
      amb: 0.44, dif: 0.88, contrast: 0.18, grain: 3.0
    });
  }

  function bakeWallStone() {
    var N = 128, s = surf(N);
    var mot = fieldFbm(N, 4, 4, 4, 0.55, 4101);
    var fine = fieldFbm(N, 24, 24, 3, 0.5, 4107);
    var jag = fieldFbm(N, 16, 16, 3, 0.5, 4211);
    /* Heavy dark limestone. The renderer darkens walls further, so the
       source has to already be *stone* dark — a light grey brick that gets
       multiplied down just reads as flat grey, which is how walls end up
       floating instead of carrying weight. */
    var b1 = rgbOf('#0c0f14'), b2 = rgbOf('#252b35'), mortar = rgbOf('#05070a');
    var tmp = [0, 0, 0];
    var BW = 64, BH = 32;

    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var i = y * N + x, u = x / N, v = y / N;
        var row = Math.floor(y / BH);
        var offx = (row & 1) ? BW * 0.5 : 0;
        var bx = ((x - offx) % BW + BW) % BW;
        var by = y % BH;
        var bi = Math.floor(((x - offx) % N + N) % N / BW);
        var tint = h3(bi, row, 4321);

        /* jagged mortar joints */
        var j = (jag[i] - 0.5) * 2.2;
        var dEdge = Math.min(bx, BW - bx, by, BH - by) + j;
        var joint = 1 - ss(1.2, 3.2, dEdge);
        var near = 1 - ss(0.0, 9.0, dEdge);

        worley(u, v, 30, 4401);
        var pit = 1 - ss(0.0, 0.16, _wf1);
        var pore = h3(x, y, 4501);

        var tone = 0.28 + (mot[i] - 0.5) * 0.75 + (tint - 0.5) * 0.32 + (fine[i] - 0.5) * 0.30;
        mixRGB(b1, b2, cl(tone, 0, 1), tmp);
        mixRGB(tmp, mortar, joint * 0.88, tmp);

        var hgt = 0.55 + (mot[i] - 0.5) * 0.30 + (fine[i] - 0.5) * 0.28
          + (tint - 0.5) * 0.20 - pit * 0.55 + (pore - 0.5) * 0.22 - joint * 1.5;
        s.h[i] = hgt;
        s.ao[i] = (1 - 0.34 * near * near - 0.30 * joint) * (1 - pit * 0.28);
        s.spec[i] = (0.5 + fine[i] * 0.8) * (1 - joint * 0.8);
        s.alb[i * 3] = tmp[0]; s.alb[i * 3 + 1] = tmp[1]; s.alb[i * 3 + 2] = tmp[2];
      }
    }
    return shade(s, {
      bump: 2.3, exp: 12, si: 0.10, tint: [225, 232, 245],
      amb: 0.48, dif: 0.84, contrast: 0.15, grain: 4.5
    });
  }

  function bakeWallPanel() {
    var N = 128, s = surf(N);
    var warmF = fieldFbm(N, 3, 3, 3, 0.5, 5101);
    var sweep = fieldFbm(N, 2, 2, 2, 0.5, 5117);
    var PG = fieldFbm(N, 40, 4, 4, 0.55, 5200);   /* tight vertical grain */
    var PF = fieldFbm(N, 3, 2, 3, 0.5, 5300);     /* broad figure */
    var w1 = rgbOf('#241509'), w2 = rgbOf('#4d3018'), w3 = rgbOf('#6d4a26');
    var wdark = rgbOf('#120a04');
    var brass = rgbOf('#c9a227'), brassHot = rgbOf('#ffe9a8');
    var tmp = [0, 0, 0];
    var brassMask = new Float32Array(N * N);

    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var i = y * N + x;
        /* wrapped distance to the tile border = the stile/rail frame */
        var dx = Math.min(x, N - 1 - x), dy = Math.min(y, N - 1 - y);
        var d = Math.min(dx, dy);

        /* vertical wood grain, tighter across the panel */
        var g = PG[i];
        var rings = Math.abs(Math.sin((x * 0.42 + g * 7.0) * 1.0));
        rings = rings * rings; rings = rings * rings;
        var fig = PF[i];

        var tone = 0.30 + (fig - 0.5) * 0.40 + (g - 0.5) * 0.35 + (warmF[i] - 0.5) * 0.18;
        mixRGB(w1, w2, cl(tone, 0, 1), tmp);
        mixRGB(tmp, w3, cl((g - 0.6) * 1.6, 0, 1) * 0.5, tmp);
        mixRGB(tmp, wdark, rings * 0.55, tmp);

        /* relief: frame high (d<7), ogee bevel 7..15, recessed field */
        var hgt, ao = 1, spv = 0.5 + sweep[i] * 1.0;
        if (d < 6.5) {
          hgt = 1.0 + (g - 0.5) * 0.08;
        } else if (d < 15) {
          var t = (d - 6.5) / 8.5;
          hgt = 1.0 - 0.72 * (t * t * (3 - 2 * t));
          ao = 1 - 0.22 * t;
        } else {
          hgt = 0.28 + (g - 0.5) * 0.12 - rings * 0.06;
          ao = 0.82 + ss(15, 34, d) * 0.18;
        }

        /* brass inlay hairline inside the field */
        var bl = 1 - ss(0.0, 1.3, Math.abs(d - 19.5));
        if (bl > 0.02) {
          mixRGB(tmp, brass, bl * 0.92, tmp);
          mixRGB(tmp, brassHot, bl * bl * 0.35, tmp);
          hgt += bl * 0.28;
          brassMask[i] = bl;
          spv += bl * 1.4;
        }
        /* engraved hairline just inside the bevel */
        var el = 1 - ss(0.0, 0.9, Math.abs(d - 15.6));
        hgt -= el * 0.35;
        mixRGB(tmp, wdark, el * 0.5, tmp);

        s.h[i] = hgt;
        s.ao[i] = ao;
        s.spec[i] = spv;
        s.alb[i * 3] = tmp[0]; s.alb[i * 3 + 1] = tmp[1]; s.alb[i * 3 + 2] = tmp[2];
      }
    }
    return shade(s, {
      bump: 2.4, exp: 42, si: 0.42, tint: [255, 234, 198],
      amb: 0.46, dif: 0.86, contrast: 0.17, grain: 3.2,
      spec2: { mask: brassMask, exp: 70, si: 0.9, tint: [255, 220, 140] }
    });
  }

  function bakeConcrete() {
    var N = 128, s = surf(N);
    var mot = fieldFbm(N, 4, 4, 4, 0.55, 6101);
    var fine = fieldFbm(N, 32, 32, 2, 0.5, 6107);
    var stain = fieldFbm(N, 3, 12, 3, 0.5, 6211);   /* vertical run-off */
    var b1 = rgbOf('#1a1d22'), b2 = rgbOf('#343a42'), dark = rgbOf('#0c0e12');
    var tmp = [0, 0, 0];

    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var i = y * N + x, u = x / N, v = y / N;
        var board = (y / 32) | 0;
        var by = y % 32;
        var bt = h3(0, board, 6301);
        var seam = (1 - ss(0.0, 1.6, Math.min(by, 32 - by)));

        worley(u, v, 34, 6401);
        var agg = 1 - ss(0.0, 0.20, _wf1);
        worley(u + 0.5, v + 0.27, 60, 6421);
        var pit = 1 - ss(0.0, 0.13, _wf1);
        var sp = h3(x, y, 6501);

        var tone = 0.30 + (mot[i] - 0.5) * 0.62 + (bt - 0.5) * 0.22
          + (fine[i] - 0.5) * 0.22 - (stain[i] - 0.5) * 0.30;
        mixRGB(b1, b2, cl(tone, 0, 1), tmp);
        mixRGB(tmp, dark, pit * 0.7 + seam * 0.55, tmp);
        mixRGB(tmp, b2, agg * 0.16, tmp);

        var hgt = 0.5 + (mot[i] - 0.5) * 0.22 + (fine[i] - 0.5) * 0.30
          + agg * 0.18 - pit * 0.9 - seam * 1.1 + (sp - 0.5) * 0.18
          + (bt - 0.5) * 0.10;

        /* form-tie holes on a 64px grid */
        var tx = (x % 64) - 32, ty = (y % 64) - 32;
        var tr = Math.sqrt(tx * tx + ty * ty);
        var tie = 1 - ss(3.2, 5.0, tr);
        if (tie > 0) {
          hgt -= tie * 1.5;
          mixRGB(tmp, dark, tie * 0.75, tmp);
        }
        var ring = 1 - ss(0.0, 1.6, Math.abs(tr - 5.6));
        hgt += ring * 0.30;

        s.h[i] = hgt;
        s.ao[i] = (1 - 0.35 * seam - 0.30 * pit - tie * 0.45) * (0.96 + agg * 0.06);
        s.spec[i] = (0.4 + fine[i] * 0.7) * (1 - seam * 0.6);
        s.alb[i * 3] = tmp[0]; s.alb[i * 3 + 1] = tmp[1]; s.alb[i * 3 + 2] = tmp[2];
      }
    }
    return shade(s, {
      bump: 2.1, exp: 8, si: 0.07, tint: [230, 236, 245],
      amb: 0.52, dif: 0.78, contrast: 0.13, grain: 5.0
    });
  }

  function bakeBrushedMetal() {
    var N = 128, s = surf(N);
    /* heavy anisotropy: fast variation across y, slow along x = streaks */
    var streak = fieldFbm(N, 2, 64, 4, 0.55, 7101);
    var streakF = fieldFbm(N, 2, 128, 2, 0.5, 7107);   /* micro streaks for spec */
    var broad = fieldFbm(N, 3, 6, 3, 0.5, 7203);
    var m1 = rgbOf('#333944'), m2 = rgbOf('#8b95a4'), hot = rgbOf('#c9d2de');
    var tmp = [0, 0, 0];
    var hSpec = new Float32Array(N * N);

    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var i = y * N + x;
        var st = streak[i] * 0.62 + streakF[i] * 0.38;
        var tone = 0.34 + (st - 0.5) * 1.10 + (broad[i] - 0.5) * 0.40;
        mixRGB(m1, m2, cl(tone, 0, 1), tmp);
        mixRGB(tmp, hot, cl((st - 0.76) * 3.4, 0, 1) * 0.45, tmp);

        /* long scratches spanning the full width keep tiling intact */
        var scr = 0;
        var band = h3(0, y, 7777);
        if (band > 0.972) scr = (band - 0.972) / 0.028;
        mixRGB(tmp, hot, scr * 0.35, tmp);

        s.h[i] = (st - 0.5) * 0.55 + (broad[i] - 0.5) * 0.18 + scr * 0.35;
        hSpec[i] = (streakF[i] - 0.5) * 1.5 + (st - 0.5) * 0.4;
        s.spec[i] = 0.55 + st * 1.0 + scr * 0.8;
        s.ao[i] = 0.97 + (broad[i] - 0.5) * 0.06;
        s.alb[i * 3] = tmp[0]; s.alb[i * 3 + 1] = tmp[1]; s.alb[i * 3 + 2] = tmp[2];
      }
    }
    return shade(s, {
      bump: 2.2, hSpec: hSpec, bumpSpec: 3.6,
      exp: 22, si: 0.62, tint: [222, 236, 255],
      amb: 0.44, dif: 0.86, contrast: 0.18, grain: 2.6
    });
  }

  function bakeBrass() {
    var N = 128, s = surf(N);
    var fineN = fieldFbm(N, 32, 32, 3, 0.55, 8101);
    var patina = fieldFbm(N, 3, 3, 4, 0.55, 8203);
    var broad = fieldFbm(N, 2, 2, 2, 0.5, 8301);

    /* Circular brushing: smear fine noise along a *periodic* swirl field
       (Taylor-Green style), so the streaks curve like a spun brass plate
       yet the field is exactly tile-periodic. */
    var k = TAU / N;
    var dirFn = function (x, y, out) {
      var u = x * k, v = y * k;
      var vx = Math.sin(u) * Math.cos(v);
      var vy = -Math.cos(u) * Math.sin(v);
      var m = Math.sqrt(vx * vx + vy * vy);
      if (m < 1e-4) { out[0] = 0.7071; out[1] = 0.7071; }
      else { out[0] = vx / m; out[1] = vy / m; }
    };
    var brushed = lic(fineN, N, dirFn, 5, 1.7);
    var brushed2 = lic(fieldFbm(N, 64, 64, 2, 0.5, 8117), N, dirFn, 4, 1.1);

    var b1 = rgbOf('#4a3708'), b2 = rgbOf('#c39a2c'), bhot = rgbOf('#ffeeb4');
    var pat = rgbOf('#3f4a24');
    var tmp = [0, 0, 0];
    var mask = new Float32Array(N * N);

    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var i = y * N + x;
        var br = brushed[i] * 0.65 + brushed2[i] * 0.35;
        var tone = 0.40 + (br - 0.5) * 1.5 + (broad[i] - 0.5) * 0.35;
        mixRGB(b1, b2, cl(tone, 0, 1), tmp);
        mixRGB(tmp, bhot, cl((br - 0.62) * 2.6, 0, 1) * 0.4, tmp);
        mixRGB(tmp, pat, cl((patina[i] - 0.66) * 2.4, 0, 1) * 0.30, tmp);

        s.h[i] = (br - 0.5) * 1.0 + (broad[i] - 0.5) * 0.15;
        s.spec[i] = (0.5 + br * 1.2) * (1 - cl((patina[i] - 0.66) * 2.4, 0, 1) * 0.5);
        mask[i] = s.spec[i] * 0.8;
        s.ao[i] = 0.96 + (broad[i] - 0.5) * 0.08;
        s.alb[i * 3] = tmp[0]; s.alb[i * 3 + 1] = tmp[1]; s.alb[i * 3 + 2] = tmp[2];
      }
    }
    return shade(s, {
      bump: 3.0, exp: 26, si: 0.50, tint: [255, 226, 150],
      amb: 0.44, dif: 0.88, contrast: 0.19, grain: 2.6,
      spec2: { mask: mask, exp: 110, si: 0.85, tint: [255, 244, 205] }
    });
  }

  function bakeFrostedGlass() {
    var N = 128, s = surf(N);
    var fineN = fieldFbm(N, 42, 42, 3, 0.5, 9101);
    var blob = fieldFbm(N, 4, 4, 3, 0.5, 9203);
    /* diagonal streaks: (x+y) and (y-x) are both tile-periodic, so
       sampling a field in that frame stays seamless */
    var STK = fieldFbm(N, 2, 26, 3, 0.55, 9311);
    s.alpha = new Float32Array(N * N);
    var g1 = rgbOf('#9fc3d2'), g2 = rgbOf('#e6f4fb');
    var tmp = [0, 0, 0];

    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var i = y * N + x;
        /* diagonal streaks: (x+y) and (y-x) are both tile-periodic,
           so sampling noise in that frame stays seamless */
        var streak = bilWrap(STK, N, x + y, y - x + N);
        var v = 0.35 + (blob[i] - 0.5) * 0.85 + (streak - 0.5) * 0.75 + (fineN[i] - 0.5) * 0.5;
        mixRGB(g1, g2, cl(v, 0, 1), tmp);
        s.h[i] = (fineN[i] - 0.5) * 0.7 + (streak - 0.5) * 0.55 + (blob[i] - 0.5) * 0.2;
        s.spec[i] = 0.6 + streak * 0.9;
        s.ao[i] = 1;
        s.alpha[i] = cl(0.10 + blob[i] * 0.22 + (streak - 0.5) * 0.16 + (fineN[i] - 0.5) * 0.10, 0.04, 0.46);
        s.alb[i * 3] = tmp[0]; s.alb[i * 3 + 1] = tmp[1]; s.alb[i * 3 + 2] = tmp[2];
      }
    }
    return shade(s, {
      bump: 2.0, exp: 34, si: 0.45, tint: [240, 252, 255],
      amb: 0.62, dif: 0.62, contrast: 0.10, grain: 3.0
    });
  }

  /* ------------------------------------------------------------------
     noise textures
     ------------------------------------------------------------------ */
  function bakeGrain() {
    var N = 256;
    var cv = PV.makeCanvas(N, N);
    var img = cv.ctx.createImageData(N, N);
    var d = img.data;
    var clump = fieldFbm(N, 64, 64, 2, 0.5, 12101);
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var i = y * N + x;
        /* three hashes ~ bell distribution, like real film grain */
        var g = (h3(x, y, 1) + h3(x, y, 2) + h3(x, y, 3)) / 3 - 0.5;
        var a = Math.abs(g) * 2;
        a = a * a * (0.55 + clump[i] * 0.9);
        var p = i * 4;
        d[p] = 255; d[p + 1] = 255; d[p + 2] = 255;
        d[p + 3] = cl(a * 300, 0, 190);
      }
    }
    cv.ctx.putImageData(img, 0, 0);
    return cv.canvas;
  }

  /* Blue noise via high-pass + rank equalisation (wrapped, so it tiles). */
  function bakeBlueNoise() {
    var N = 128, n2 = N * N, M = N - 1;
    var w = new Float32Array(n2), i, x, y;
    var r = rngFrom(13371);
    for (i = 0; i < n2; i++) w[i] = r();
    var tmp = new Float32Array(n2), hp = new Float32Array(n2);
    /* 18-bit value + 14-bit index packed into a Uint32 so the rank pass can
       use a typed numeric sort (about 4x faster than the Float64 version) */
    var packed = new Uint32Array(n2);
    var K = [0.06136, 0.24477, 0.38774, 0.24477, 0.06136];

    for (var it = 0; it < 2; it++) {
      /* separable wrapped blur */
      for (y = 0; y < N; y++) {
        var yn = y * N;
        for (x = 0; x < N; x++) {
          var sum = 0;
          for (var k = -2; k <= 2; k++) sum += K[k + 2] * w[yn + ((x + k) & M)];
          tmp[yn + x] = sum;
        }
      }
      for (y = 0; y < N; y++) {
        for (x = 0; x < N; x++) {
          var s2 = 0;
          for (var k2 = -2; k2 <= 2; k2++) s2 += K[k2 + 2] * tmp[(((y + k2) & M) * N) + x];
          hp[y * N + x] = w[y * N + x] - s2;
        }
      }
      /* rank-equalise: pack value+index into a double, sort, redistribute */
      for (i = 0; i < n2; i++) {
        var q = ((hp[i] + 1) * 131071) | 0;
        if (q < 0) q = 0; else if (q > 262143) q = 262143;
        packed[i] = q * 16384 + i;
      }
      packed.sort();
      for (i = 0; i < n2; i++) w[packed[i] & 16383] = i / (n2 - 1);
    }
    var cv = PV.makeCanvas(N, N);
    var img = cv.ctx.createImageData(N, N);
    var d = img.data;
    for (i = 0; i < n2; i++) {
      var v = w[i] * 255;
      d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
    }
    cv.ctx.putImageData(img, 0, 0);
    return cv.canvas;
  }

  /* ==================================================================
     DECALS / SPRITES
     ================================================================== */

  function bakeCrack(vi) {
    var S = 128;
    var c = scratch2x(S, S);
    var ctx = c.ctx;
    var rnd = rngFrom(hashStr('decal.crack#' + vi));
    var cxs = [], i;

    function limb(x, y, ang, len, wid, depth) {
      var steps = Math.max(3, Math.round(len / 4));
      var px = x, py = y;
      for (var k = 0; k < steps; k++) {
        var t = k / steps;
        ang += (rnd() - 0.5) * 0.85;
        var seg = len / steps;
        var nx = px + Math.cos(ang) * seg, ny = py + Math.sin(ang) * seg;
        var w0 = wid * (1 - t) + 0.18;
        /* lit far wall of the fissure, offset down-right */
        ctx.strokeStyle = 'rgba(196,204,218,0.13)';
        ctx.lineWidth = w0 * 1.15;
        ctx.beginPath(); ctx.moveTo(px + 0.8, py + 0.8); ctx.lineTo(nx + 0.8, ny + 0.8); ctx.stroke();
        ctx.strokeStyle = 'rgba(2,3,5,0.82)';
        ctx.lineWidth = w0;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
        /* chips */
        if (rnd() < 0.16) {
          ctx.fillStyle = 'rgba(6,8,12,0.5)';
          ctx.beginPath();
          ctx.ellipse(nx, ny, 1.2 + rnd() * 2.2, 0.8 + rnd() * 1.4, rnd() * 3.14, 0, TAU);
          ctx.fill();
        }
        if (depth > 0 && rnd() < 0.22) cxs.push([nx, ny, ang + (rnd() < 0.5 ? 1 : -1) * (0.5 + rnd() * 0.7), len * 0.42, w0 * 0.7, depth - 1]);
        px = nx; py = ny;
      }
    }

    ctx.lineCap = 'round';
    var roots = 1 + (vi % 2);
    for (i = 0; i < roots; i++) {
      var a = rnd() * TAU;
      var cx = 64 + Math.cos(a + 3.14) * (14 + rnd() * 16);
      var cy = 64 + Math.sin(a + 3.14) * (14 + rnd() * 16);
      limb(cx, cy, a, 42 + rnd() * 26, 2.1 + rnd() * 0.9, 2);
    }
    var guard = 0;
    while (cxs.length && guard++ < 60) {
      var b = cxs.shift();
      limb(b[0], b[1], b[2], b[3], b[4], b[5]);
    }

    /* feather the sprite edge so it never shows a hard box */
    var out = down(c.canvas, S, S);
    var octx = out.getContext('2d');
    octx.globalCompositeOperation = 'destination-in';
    var g = octx.createRadialGradient(64, 64, 24, 64, 64, 63);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.72, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    octx.fillStyle = g;
    octx.fillRect(0, 0, S, S);
    return out;
  }

  function bakeScuff(vi) {
    var S = 128, n2 = S * S;
    var cv = PV.makeCanvas(S, S);
    var img = cv.ctx.createImageData(S, S);
    var d = img.data;
    /* one shared field set for all four variants, read at different
       wrapped offsets — the blobs differ, the noise cost is paid once */
    var f = F('scuff.a', function () { return fieldFbm(S, 3, 3, 4, 0.55, 15000); });
    var f2 = F('scuff.b', function () { return fieldFbm(S, 8, 8, 3, 0.5, 15051); });
    var wxF = F('scuff.w', function () { return fieldFbm(S, 2, 2, 2, 0.5, 15071); });
    var ox = (vi * 37) & 127, oy = (vi * 83) & 127;
    var rnd = rngFrom(hashStr('decal.scuff#' + vi));
    var blobs = [];
    for (var b = 0; b < 3; b++) {
      blobs.push([28 + rnd() * 72, 28 + rnd() * 72, 22 + rnd() * 26, 16 + rnd() * 22, rnd() * TAU]);
    }
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var i = y * S + x;
        var ni = (((y + oy) & 127) * S) + ((x + ox) & 127);
        var m = 0;
        for (var k = 0; k < blobs.length; k++) {
          var bb = blobs[k];
          var dx = x - bb[0], dy = y - bb[1];
          var ca = Math.cos(bb[4]), sa = Math.sin(bb[4]);
          var rx = (dx * ca + dy * sa) / bb[2], ry = (-dx * sa + dy * ca) / bb[3];
          var dd = Math.sqrt(rx * rx + ry * ry) + (wxF[ni] - 0.5) * 0.55;
          m = Math.max(m, 1 - ss(0.25, 1.0, dd));
        }
        var n = f[ni] * 0.7 + f2[ni] * 0.3;
        var a = m * cl((n - 0.32) * 1.7, 0, 1);
        a = a * a * 0.62;
        /* fade to the sprite border */
        var eF = 1 - ss(46, 63, Math.sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64)));
        a *= eF;
        var p = i * 4;
        var tintv = 26 + n * 22;
        d[p] = tintv; d[p + 1] = tintv * 0.92; d[p + 2] = tintv * 0.86;
        d[p + 3] = a * 255;
      }
    }
    cv.ctx.putImageData(img, 0, 0);
    return cv.canvas;
  }

  /* ---------------- deco vocabulary helpers ---------------- */
  function hairline(ctx, cx, cy, r, w, style) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
    ctx.lineWidth = w; ctx.strokeStyle = style; ctx.stroke();
  }
  function ziggurat(ctx, cx, cy, w, h, steps, ang, fill) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.fillStyle = fill;
    for (var i = 0; i < steps; i++) {
      var t = i / steps;
      var ww = w * (1 - t * 0.72);
      var hh = h / steps;
      ctx.fillRect(-ww / 2, -h + i * hh, ww, hh * 0.86);
    }
    ctx.restore();
  }

  function bakeMedallion() {
    var S = 256, C = S / 2;
    var c = scratch2x(S, S);
    var ctx = c.ctx;
    var LA = -2.356;   /* light comes from the upper-left */

    function litBrass(a, base) {
      var t = 0.5 - 0.5 * Math.cos(a - LA);
      var v = cl(base + t * 0.85, 0, 1);
      if (v < 0.35) return PV.mixHex(BR_DEEP, BR_DARK, v / 0.35);
      if (v < 0.72) return PV.mixHex(BR_DARK, BR_MID, (v - 0.35) / 0.37);
      return PV.mixHex(BR_MID, BR_HOT, (v - 0.72) / 0.28);
    }

    /* --- ground disc --- */
    var bg = ctx.createRadialGradient(C - 22, C - 26, 8, C, C, 126);
    bg.addColorStop(0, '#1d1116');
    bg.addColorStop(0.55, '#120a0e');
    bg.addColorStop(1, '#07070a');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(C, C, 126, 0, TAU); ctx.fill();

    /* --- outer brass rim --- */
    ctx.save();
    ctx.beginPath(); ctx.arc(C, C, 126, 0, TAU); ctx.arc(C, C, 113, 0, TAU, true);
    ctx.fillStyle = metalGrad(ctx, C - 120, C - 120, C + 110, C + 126, BR_DARK, BR_MID, BR_HOT);
    ctx.fill('evenodd');
    ctx.restore();
    hairline(ctx, C, C, 126, 0.9, 'rgba(255,238,190,0.55)');
    hairline(ctx, C, C, 113, 0.8, 'rgba(20,14,4,0.75)');
    hairline(ctx, C, C, 119.5, 0.6, 'rgba(28,20,6,0.5)');

    /* --- bead ring --- */
    var i, a;
    for (i = 0; i < 84; i++) {
      a = i / 84 * TAU;
      ctx.fillStyle = litBrass(a, 0.05);
      ctx.beginPath();
      ctx.arc(C + Math.cos(a) * 107, C + Math.sin(a) * 107, 2.1, 0, TAU);
      ctx.fill();
    }
    hairline(ctx, C, C, 100, 1.0, 'rgba(190,150,60,0.55)');

    /* --- chevron band --- */
    ctx.lineCap = 'butt';
    for (i = 0; i < 40; i++) {
      a = i / 40 * TAU;
      var a2 = (i + 0.5) / 40 * TAU;
      ctx.strokeStyle = litBrass(a, -0.02);
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(C + Math.cos(a) * 78, C + Math.sin(a) * 78);
      ctx.lineTo(C + Math.cos(a2) * 96, C + Math.sin(a2) * 96);
      ctx.lineTo(C + Math.cos(a + TAU / 40) * 78, C + Math.sin(a + TAU / 40) * 78);
      ctx.stroke();
    }
    hairline(ctx, C, C, 76, 1.1, 'rgba(200,160,66,0.6)');
    hairline(ctx, C, C, 73, 0.6, 'rgba(18,12,4,0.7)');

    /* --- radial sunburst --- */
    var RAYS = 48;
    for (i = 0; i < RAYS; i++) {
      a = i / RAYS * TAU;
      var half = TAU / RAYS * 0.5;
      var ro = (i & 1) ? 62 : 70;
      var ri = 30;
      ctx.beginPath();
      ctx.moveTo(C + Math.cos(a - half * 0.62) * ri, C + Math.sin(a - half * 0.62) * ri);
      ctx.lineTo(C + Math.cos(a - half * 0.94) * ro, C + Math.sin(a - half * 0.94) * ro);
      ctx.lineTo(C + Math.cos(a + half * 0.94) * ro, C + Math.sin(a + half * 0.94) * ro);
      ctx.lineTo(C + Math.cos(a + half * 0.62) * ri, C + Math.sin(a + half * 0.62) * ri);
      ctx.closePath();
      ctx.fillStyle = litBrass(a, (i & 1) ? -0.10 : 0.02);
      ctx.fill();
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(12,8,2,0.55)';
      ctx.stroke();
    }

    /* --- cardinal ziggurats --- */
    for (i = 0; i < 4; i++) {
      a = i / 4 * TAU - Math.PI / 2;
      var zx = C + Math.cos(a) * 100, zy = C + Math.sin(a) * 100;
      ziggurat(ctx, zx, zy, 26, 20, 3, a + Math.PI / 2, litBrass(a, 0.16));
      ziggurat(ctx, zx, zy, 26, 20, 3, a - Math.PI / 2, litBrass(a, -0.06));
    }

    /* --- centre rosette --- */
    for (i = 0; i < 16; i++) {
      a = i / 16 * TAU;
      var hw = TAU / 16 * 0.42;
      ctx.beginPath();
      ctx.moveTo(C, C);
      ctx.lineTo(C + Math.cos(a - hw) * 30, C + Math.sin(a - hw) * 30);
      ctx.lineTo(C + Math.cos(a) * 33, C + Math.sin(a) * 33);
      ctx.lineTo(C + Math.cos(a + hw) * 30, C + Math.sin(a + hw) * 30);
      ctx.closePath();
      ctx.fillStyle = litBrass(a, (i & 1) ? -0.08 : 0.10);
      ctx.fill();
    }
    hairline(ctx, C, C, 30, 1.0, 'rgba(255,236,180,0.35)');

    /* --- cabochon --- */
    var cg = ctx.createRadialGradient(C - 5, C - 6, 1, C, C, 17);
    cg.addColorStop(0, '#7d2c3c');
    cg.addColorStop(0.45, '#4a1420');
    cg.addColorStop(1, '#1c070d');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(C, C, 17, 0, TAU); ctx.fill();
    hairline(ctx, C, C, 17.5, 1.6, metalGrad(ctx, C - 18, C - 18, C + 18, C + 18, BR_DARK, BR_MID, BR_HOT));
    ctx.fillStyle = 'rgba(255,225,235,0.42)';
    ctx.beginPath(); ctx.ellipse(C - 5.5, C - 6.5, 4.6, 3.0, -0.7, 0, TAU); ctx.fill();

    var out = down(c.canvas, S, S);
    /* wear + micro-grain, then a soft directional sheen */
    noiseOverlay(out, 0.09, 24, 24, 3, 4242, true);
    var octx = out.getContext('2d');
    octx.save();
    octx.globalCompositeOperation = 'source-atop';
    var lg = octx.createLinearGradient(20, 14, 210, 240);
    lg.addColorStop(0, 'rgba(255,246,220,0.16)');
    lg.addColorStop(0.42, 'rgba(255,255,255,0)');
    lg.addColorStop(1, 'rgba(0,0,0,0.22)');
    octx.fillStyle = lg;
    octx.fillRect(0, 0, S, S);
    octx.restore();
    return out;
  }

  function bakeRug() {
    var W = 512, H = 384;
    var c = scratch2x(W, H);
    var ctx = c.ctx;
    var FR = 22;                 /* fringe zone on the short ends */
    var x0 = FR, x1 = W - FR, y0 = 6, y1 = H - 6;
    var iw = x1 - x0, ih = y1 - y0;
    var GOLD = '#c9a227', GOLD_HOT = '#ffe9a8', GOLD_DK = '#7d6416';
    var OX = '#3d1019', OX_D = '#2a0a11', OX_L = '#5d1c28';

    /* fringe first, so the body overlaps its header */
    var rnd = rngFrom(99137);
    ctx.lineCap = 'round';
    for (var side = 0; side < 2; side++) {
      var sx = side ? x1 : x0;
      var dir = side ? 1 : -1;
      for (var f = 0; f < 118; f++) {
        var fy = y0 + 6 + f * ((ih - 12) / 117) + (rnd() - 0.5) * 1.2;
        var len = 12 + rnd() * 7;
        var curl = (rnd() - 0.5) * 7;
        var sh = 0.72 + rnd() * 0.28;
        ctx.strokeStyle = 'rgba(' + Math.round(206 * sh) + ',' + Math.round(188 * sh) + ',' + Math.round(146 * sh) + ',0.92)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, fy);
        ctx.quadraticCurveTo(sx + dir * len * 0.6, fy + curl * 0.4, sx + dir * len, fy + curl);
        ctx.stroke();
      }
    }

    /* body */
    ctx.fillStyle = OX;
    ctx.fillRect(x0, y0, iw, ih);

    /* header band over the fringe roots */
    for (var s2 = 0; s2 < 2; s2++) {
      var hx = s2 ? x1 - 7 : x0;
      ctx.fillStyle = GOLD_DK;
      ctx.fillRect(hx, y0, 7, ih);
      ctx.fillStyle = 'rgba(255,233,168,0.35)';
      ctx.fillRect(hx, y0, 7, 1.2);
    }

    function band(inset, w, style) {
      ctx.strokeStyle = style; ctx.lineWidth = w;
      ctx.strokeRect(x0 + inset, y0 + inset, iw - inset * 2, ih - inset * 2);
    }
    band(10, 4, GOLD_DK);
    band(10, 1.1, 'rgba(255,233,168,0.35)');
    band(20, 1.4, GOLD);
    band(30, 5, GOLD_DK);
    band(44, 1.2, GOLD);
    band(50, 0.7, 'rgba(255,233,168,0.28)');

    /* greek-key / stepped meander in the outer band */
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6;
    var step = 22;
    function meander(px, py, dx, dy, count) {
      ctx.beginPath();
      for (var i = 0; i < count; i++) {
        var ax = px + dx * step * i, ay = py + dy * step * i;
        var nx2 = -dy, ny2 = dx;
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + nx2 * 7, ay + ny2 * 7);
        ctx.lineTo(ax + nx2 * 7 + dx * 13, ay + ny2 * 7 + dy * 13);
        ctx.lineTo(ax + dx * 13, ay + dy * 13);
        ctx.lineTo(ax + dx * 13 + nx2 * 3.5, ay + dy * 13 + ny2 * 3.5);
      }
      ctx.stroke();
    }
    meander(x0 + 34, y0 + 34, 1, 0, Math.floor((iw - 68) / step));
    meander(x1 - 34, y1 - 34, -1, 0, Math.floor((iw - 68) / step));
    meander(x0 + 34, y1 - 34, 0, -1, Math.floor((ih - 68) / step));
    meander(x1 - 34, y0 + 34, 0, 1, Math.floor((ih - 68) / step));

    /* inner field */
    var fx0 = x0 + 52, fy0 = y0 + 52, fw = iw - 104, fh = ih - 104;
    ctx.fillStyle = OX_D;
    ctx.fillRect(fx0, fy0, fw, fh);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
    ctx.strokeRect(fx0, fy0, fw, fh);

    /* corner ziggurats in the field */
    var cxs = [[fx0 + 30, fy0 + 30, 0], [fx0 + fw - 30, fy0 + 30, Math.PI / 2],
    [fx0 + fw - 30, fy0 + fh - 30, Math.PI], [fx0 + 30, fy0 + fh - 30, -Math.PI / 2]];
    for (var q = 0; q < 4; q++) {
      ziggurat(ctx, cxs[q][0], cxs[q][1], 34, 26, 4, cxs[q][2] + Math.PI, GOLD_DK);
      ziggurat(ctx, cxs[q][0], cxs[q][1], 22, 17, 3, cxs[q][2] + Math.PI, GOLD);
    }

    /* central deco medallion: stepped lozenge + sunburst fan */
    var mcx = W / 2, mcy = H / 2;
    ctx.save();
    ctx.translate(mcx, mcy);
    for (var L = 0; L < 3; L++) {
      var rw = 150 - L * 26, rh = 96 - L * 18;
      ctx.beginPath();
      ctx.moveTo(0, -rh); ctx.lineTo(rw, 0); ctx.lineTo(0, rh); ctx.lineTo(-rw, 0);
      ctx.closePath();
      ctx.strokeStyle = (L & 1) ? GOLD : GOLD_DK;
      ctx.lineWidth = L === 0 ? 3 : 1.6;
      ctx.stroke();
      if (L === 1) { ctx.fillStyle = 'rgba(93,28,40,0.55)'; ctx.fill(); }
    }
    var RAYS = 32;
    for (var i2 = 0; i2 < RAYS; i2++) {
      var a = i2 / RAYS * TAU;
      var hw = TAU / RAYS * 0.36;
      var rr = 74;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - hw) * rr * 1.35, Math.sin(a - hw) * rr * 0.86);
      ctx.lineTo(Math.cos(a) * rr * 1.45, Math.sin(a) * rr * 0.92);
      ctx.lineTo(Math.cos(a + hw) * rr * 1.35, Math.sin(a + hw) * rr * 0.86);
      ctx.closePath();
      ctx.fillStyle = (i2 & 1) ? 'rgba(125,100,22,0.85)' : 'rgba(201,162,39,0.9)';
      ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 20, 0, 0, TAU);
    ctx.fillStyle = OX_L; ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = GOLD_HOT; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 9, 0, 0, TAU);
    ctx.fillStyle = GOLD_DK; ctx.fill();
    ctx.restore();

    /* side chevrons filling the field */
    ctx.strokeStyle = 'rgba(201,162,39,0.5)'; ctx.lineWidth = 1.5;
    for (var cvi = 0; cvi < 2; cvi++) {
      var bx = cvi ? fx0 + fw - 26 : fx0 + 26;
      ctx.beginPath();
      for (var yy = fy0 + 40; yy < fy0 + fh - 40; yy += 16) {
        ctx.moveTo(bx - 9, yy); ctx.lineTo(bx, yy + 8); ctx.lineTo(bx + 9, yy);
      }
      ctx.stroke();
    }

    var out = down(c.canvas, W, H);
    /* woven fibre + pile shading */
    var octx = out.getContext('2d');
    var img = octx.getImageData(0, 0, W, H);
    var d = img.data;
    /* fibre fields at 256 (they wrap under the ornament, nobody can see it)
       instead of 512 — a quarter of the noise work for the same look */
    var NN = 256;
    var pile = fieldFbm(NN, 3, 3, 3, 0.5, 7311);
    var fibH = fieldFbm(NN, 64, 8, 2, 0.5, 7411);
    var fibV = fieldFbm(NN, 8, 64, 2, 0.5, 7421);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var p = (y * W + x) * 4;
        if (d[p + 3] === 0) continue;
        var ni = (y & 255) * NN + (x & 255);
        var over = (((x >> 1) + (y >> 1)) & 1) === 0;
        var fib = over ? fibH[ni] : fibV[ni];
        var bumpv = over ? Math.sin(Math.PI * ((y & 1) + 0.5) / 2) : Math.sin(Math.PI * ((x & 1) + 0.5) / 2);
        var pv = bilWrap(pile, NN, x * 0.5, y * 0.5);
        var m = 0.80 + (pv - 0.5) * 0.30 + (fib - 0.5) * 0.34 + bumpv * 0.12
          + (h3(x, y, 55) - 0.5) * 0.09;
        /* edge AO so it sits on the floor */
        var eg = Math.min(ss(0, 16, x - FR + 8), ss(0, 16, W - FR + 8 - x), ss(0, 12, y), ss(0, 12, H - y));
        m *= 0.72 + 0.28 * eg;
        d[p] *= m; d[p + 1] *= m; d[p + 2] *= m;
      }
    }
    octx.putImageData(img, 0, 0);
    return out;
  }

  function bakeDust() {
    var S = 64;
    var cv = PV.makeCanvas(S, S);
    var ctx = cv.ctx;
    var g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,248,228,0.95)');
    g.addColorStop(0.25, 'rgba(248,238,214,0.55)');
    g.addColorStop(0.55, 'rgba(226,214,190,0.18)');
    g.addColorStop(1, 'rgba(210,200,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return cv.canvas;
  }

  function bakeCaustic() {
    var S = 256, n2 = S * S;
    var cv = PV.makeCanvas(S, S);
    var img = cv.ctx.createImageData(S, S);
    var d = img.data;
    /* built at half res (it is a soft blob, nothing is sharp) and sampled up */
    var n = 128;
    var wx = fieldFbm(n, 3, 3, 3, 0.5, 8801);
    var wy = fieldFbm(n, 3, 3, 3, 0.5, 8807);
    var RF = warpField(fieldRidged(n, 4, 4, 4, 0.55, 8901), n, wx, wy, 64, 0, 0);
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var i = y * S + x;
        var r = bilWrap(RF, n, x * 0.5, y * 0.5);
        var band = Math.pow(cl((r - 0.34) * 1.55, 0, 1), 1.6);
        var dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2);
        var fall = 1 - ss(0.15, 1.0, Math.sqrt(dx * dx + dy * dy));
        var a = band * fall * fall;
        var p = i * 4;
        d[p] = 255;
        d[p + 1] = 246 - band * 16;
        d[p + 2] = 214 - band * 40;
        d[p + 3] = cl(a * 240, 0, 235);
      }
    }
    cv.ctx.putImageData(img, 0, 0);
    return cv.canvas;
  }

  function bakeVignette() {
    var S = 512;
    var cv = PV.makeCanvas(S, S);
    var img = cv.ctx.createImageData(S, S);
    var d = img.data;
    var C = S / 2;
    /* radially symmetric — precompute alpha against squared radius so the
       inner loop is two multiplies and a table read, no sqrt, no pow */
    var RN = 1024, RL = new Float32Array(RN + 1);
    for (var q = 0; q <= RN; q++) {
      var rr = Math.sqrt(q / RN) / Math.SQRT2;
      var t = ss(0.26, 0.98, rr);
      RL[q] = t * Math.sqrt(t) * 0.92;
    }
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var i = y * S + x;
        var dx = (x - C) / C, dy = (y - C) / C;
        var q2 = (dx * dx + dy * dy) * 0.5 * RN;   /* r2 normalised by 2 */
        var a = RL[q2 > RN ? RN : (q2 | 0)];
        a += (h3(x, y, 4) - 0.5) * 0.012;      /* dither: kills banding */
        var p = i * 4;
        d[p] = 3; d[p + 1] = 4; d[p + 2] = 7;
        d[p + 3] = cl(a * 255, 0, 255);
      }
    }
    cv.ctx.putImageData(img, 0, 0);
    return cv.canvas;
  }

  /* ==================================================================
     RELIC ICONS — silhouette, metal, rim light, gem, sparkle
     ================================================================== */
  function goldGrad(ctx, x0, y0, x1, y1) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0.00, '#fff3c4');
    g.addColorStop(0.18, '#f0cd6a');
    g.addColorStop(0.42, '#c9a227');
    g.addColorStop(0.62, '#8a6c17');
    g.addColorStop(0.82, '#c9a227');
    g.addColorStop(1.00, '#5d470d');
    return g;
  }
  function steelGrad(ctx, x0, y0, x1, y1) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0.00, '#eef4ff');
    g.addColorStop(0.22, '#b3bece');
    g.addColorStop(0.5, '#6e7a8b');
    g.addColorStop(0.72, '#98a4b4');
    g.addColorStop(1.00, '#3d4553');
    return g;
  }
  function gem(ctx, cx, cy, r, deep, mid, bright) {
    var i, a;
    ctx.save();
    ctx.beginPath();
    for (i = 0; i < 8; i++) {
      a = i / 8 * TAU - Math.PI / 8;
      var rr = r * ((i & 1) ? 0.94 : 1);
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    var g = ctx.createRadialGradient(cx - r * 0.32, cy - r * 0.38, r * 0.06, cx, cy, r * 1.08);
    g.addColorStop(0, bright);
    g.addColorStop(0.34, mid);
    g.addColorStop(1, deep);
    ctx.fillStyle = g;
    ctx.fill();
    /* facets */
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 0.6;
    for (i = 0; i < 8; i++) {
      a = i / 8 * TAU - Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.3, cy - r * 0.36, r * 0.30, r * 0.19, -0.7, 0, TAU);
    ctx.fill();
    ctx.restore();
    /* setting */
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = goldGrad(ctx, cx - r, cy - r, cx + r, cy + r);
    ctx.beginPath();
    for (i = 0; i < 8; i++) {
      a = i / 8 * TAU - Math.PI / 8;
      var rr2 = r * ((i & 1) ? 0.94 : 1);
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2);
      else ctx.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2);
    }
    ctx.closePath();
    ctx.stroke();
    /* caustic sparkle */
    sparkle(ctx, cx - r * 0.26, cy - r * 0.32, r * 1.15);
  }
  function sparkle(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (var k = 0; k < 2; k++) {
      ctx.save();
      ctx.rotate(k * Math.PI / 4);
      var l = s * (k ? 0.5 : 1);
      var w = s * (k ? 0.05 : 0.075);
      ctx.beginPath();
      ctx.moveTo(0, -l); ctx.lineTo(w, 0); ctx.lineTo(0, l); ctx.lineTo(-w, 0);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-l, 0); ctx.lineTo(0, -w); ctx.lineTo(l, 0); ctx.lineTo(0, w);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.085, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function engrave(ctx, path, alpha) {
    ctx.save();
    ctx.strokeStyle = 'rgba(60,40,6,' + alpha + ')';
    ctx.lineWidth = 0.9;
    path();
    ctx.restore();
  }

  function finishIcon(c, S) {
    var out = down(c.canvas, S, S);
    rimLight(out, 1.6, 1.7, 'rgba(255,247,214,1)', 0.55, 'lighter');
    rimLight(out, -1.5, -1.6, 'rgba(120,190,220,1)', 0.22, 'lighter');
    return out;
  }

  function bakeCrown() {
    var S = 128, c = scratch2x(S, S), ctx = c.ctx;
    var cx = 64;
    /* band */
    ctx.beginPath();
    ctx.moveTo(20, 74); ctx.lineTo(108, 74);
    ctx.lineTo(104, 98); ctx.quadraticCurveTo(64, 108, 24, 98);
    ctx.closePath();
    ctx.fillStyle = goldGrad(ctx, 20, 68, 100, 104);
    ctx.fill();
    /* points */
    var pts = [[24, 74, 30], [44, 74, 46], [64, 74, 56], [84, 74, 46], [104, 74, 30]];
    ctx.beginPath();
    ctx.moveTo(20, 76);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      ctx.lineTo(p[0] - 8, 76 - (p[2] - 74) * 0.0);
      ctx.lineTo(p[0], 76 - (p[2] - 20));
      ctx.lineTo(p[0] + 8, 76);
    }
    ctx.lineTo(108, 76);
    ctx.closePath();
    ctx.fillStyle = goldGrad(ctx, 18, 20, 96, 86);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,42,6,0.55)'; ctx.lineWidth = 1; ctx.stroke();
    /* band engraving */
    ctx.strokeStyle = 'rgba(255,243,196,0.35)';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(22, 80); ctx.quadraticCurveTo(64, 88, 106, 80); ctx.stroke();
    ctx.strokeStyle = 'rgba(52,36,4,0.6)';
    ctx.beginPath(); ctx.moveTo(22, 92); ctx.quadraticCurveTo(64, 100, 106, 92); ctx.stroke();
    /* chevron engraving on the band */
    ctx.strokeStyle = 'rgba(52,36,4,0.45)';
    for (i = 0; i < 8; i++) {
      var bx = 28 + i * 10.4;
      ctx.beginPath(); ctx.moveTo(bx, 84); ctx.lineTo(bx + 5, 90); ctx.lineTo(bx + 10, 84); ctx.stroke();
    }
    /* pearls on the tips */
    for (i = 0; i < pts.length; i++) {
      var pp = pts[i];
      var py = 76 - (pp[2] - 20) - 4;
      var g = ctx.createRadialGradient(pp[0] - 1.4, py - 1.6, 0.4, pp[0], py, 5);
      g.addColorStop(0, '#fffdf2'); g.addColorStop(0.5, '#e8dcb8'); g.addColorStop(1, '#8f7c48');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(pp[0], py, 4.4, 0, TAU); ctx.fill();
    }
    /* gems */
    gem(ctx, 64, 86, 9, '#3a0d5c', '#8b3fd6', '#e6c6ff');
    gem(ctx, 40, 86, 6, '#5c0d1c', '#d63f5a', '#ffc6cf');
    gem(ctx, 88, 86, 6, '#0d4a5c', '#3fc4d6', '#c6f4ff');
    return finishIcon(c, S);
  }

  function bakeOrb() {
    var S = 128, c = scratch2x(S, S), ctx = c.ctx;
    var cx = 64, cy = 70, R = 40;
    /* sphere */
    var g = ctx.createRadialGradient(cx - 15, cy - 17, 3, cx, cy, R);
    g.addColorStop(0, '#ffeeb8');
    g.addColorStop(0.28, '#e0b34c');
    g.addColorStop(0.62, '#a37f1e');
    g.addColorStop(0.88, '#5c460c');
    g.addColorStop(1, '#332506');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    /* meridian bands */
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(48,34,4,0.55)';
    for (var i = -3; i <= 3; i++) {
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(i) * 11 + 2, R, 0, 0, TAU);
      ctx.stroke();
    }
    /* equator band */
    ctx.fillStyle = goldGrad(ctx, cx - R, cy - 8, cx + R, cy + 10);
    ctx.beginPath(); ctx.ellipse(cx, cy + 2, R + 2, 8.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,243,196,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy + 2, R + 2, 8.5, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,28,4,0.5)';
    for (i = 0; i < 10; i++) {
      var bx = cx - R + i * (R * 2 / 9);
      ctx.beginPath(); ctx.moveTo(bx, cy - 5); ctx.lineTo(bx, cy + 9); ctx.stroke();
    }
    /* terminator shading */
    var sg = ctx.createRadialGradient(cx - 16, cy - 18, 4, cx + 6, cy + 8, R * 1.25);
    sg.addColorStop(0, 'rgba(255,255,255,0.18)');
    sg.addColorStop(0.5, 'rgba(0,0,0,0)');
    sg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = sg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();
    /* finial */
    ctx.fillStyle = goldGrad(ctx, 56, 12, 74, 34);
    ctx.fillRect(61, 18, 6, 16);
    ctx.fillRect(54, 22, 20, 5.5);
    ctx.beginPath(); ctx.arc(64, 16, 4.2, 0, TAU); ctx.fill();
    /* front gem */
    gem(ctx, cx - 2, cy - 12, 11, '#062f3d', '#2ad4c8', '#ddfffb');
    return finishIcon(c, S);
  }

  function bakeMask() {
    var S = 128, c = scratch2x(S, S), ctx = c.ctx;
    /* face silhouette */
    ctx.beginPath();
    ctx.moveTo(64, 116);
    ctx.bezierCurveTo(34, 100, 24, 76, 26, 50);
    ctx.bezierCurveTo(28, 26, 44, 16, 64, 16);
    ctx.bezierCurveTo(84, 16, 100, 26, 102, 50);
    ctx.bezierCurveTo(104, 76, 94, 100, 64, 116);
    ctx.closePath();
    ctx.fillStyle = goldGrad(ctx, 24, 12, 96, 116);
    ctx.fill();
    ctx.strokeStyle = 'rgba(52,36,4,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    /* cheek engraving */
    ctx.strokeStyle = 'rgba(52,36,4,0.45)'; ctx.lineWidth = 1;
    for (var i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(34 + i * 3.2, 74 + i * 2.4);
      ctx.quadraticCurveTo(44 + i * 3, 92 + i, 56 - i * 1.2, 100 - i * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(94 - i * 3.2, 74 + i * 2.4);
      ctx.quadraticCurveTo(84 - i * 3, 92 + i, 72 + i * 1.2, 100 - i * 1.5);
      ctx.stroke();
    }
    /* deco headdress rays */
    for (i = 0; i < 9; i++) {
      var a = -Math.PI / 2 + (i - 4) * 0.20;
      var rl = (i % 2 ? 30 : 38);
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(a - 0.055) * 24, 52 + Math.sin(a - 0.055) * 24);
      ctx.lineTo(64 + Math.cos(a) * (24 + rl), 52 + Math.sin(a) * (24 + rl));
      ctx.lineTo(64 + Math.cos(a + 0.055) * 24, 52 + Math.sin(a + 0.055) * 24);
      ctx.closePath();
      ctx.fillStyle = (i & 1) ? '#8a6c17' : '#d9b23c';
      ctx.fill();
    }
    /* brow bar */
    ctx.fillStyle = goldGrad(ctx, 30, 44, 98, 58);
    ctx.beginPath();
    ctx.moveTo(30, 52); ctx.quadraticCurveTo(64, 42, 98, 52);
    ctx.lineTo(98, 58); ctx.quadraticCurveTo(64, 49, 30, 58);
    ctx.closePath(); ctx.fill();
    /* eyes */
    ctx.fillStyle = '#0a0c11';
    for (var e = 0; e < 2; e++) {
      var ex = e ? 82 : 46;
      ctx.save();
      ctx.translate(ex, 66);
      ctx.rotate(e ? 0.16 : -0.16);
      ctx.beginPath();
      ctx.moveTo(-11, 0); ctx.quadraticCurveTo(0, -7.5, 11, 0);
      ctx.quadraticCurveTo(0, 5.5, -11, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,190,0.5)'; ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    /* mouth line */
    ctx.strokeStyle = 'rgba(20,14,4,0.7)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(52, 94); ctx.quadraticCurveTo(64, 99, 76, 94); ctx.stroke();
    /* third-eye gem */
    gem(ctx, 64, 38, 8.5, '#0d4a20', '#3fd66a', '#d6ffd9');
    return finishIcon(c, S);
  }

  function bakeBlade() {
    var S = 128, c = scratch2x(S, S), ctx = c.ctx;
    ctx.save();
    ctx.translate(64, 64);
    ctx.rotate(-0.42);
    /* blade */
    ctx.beginPath();
    ctx.moveTo(0, -58);
    ctx.lineTo(9, -30); ctx.lineTo(10, 6); ctx.lineTo(-10, 6); ctx.lineTo(-9, -30);
    ctx.closePath();
    ctx.fillStyle = steelGrad(ctx, -12, -50, 12, 6);
    ctx.fill();
    /* fuller */
    ctx.beginPath();
    ctx.moveTo(0, -52); ctx.lineTo(3.2, -28); ctx.lineTo(3.2, 3); ctx.lineTo(-3.2, 3);
    ctx.lineTo(-3.2, -28); ctx.closePath();
    ctx.fillStyle = 'rgba(28,34,44,0.55)'; ctx.fill();
    /* lit edge */
    ctx.strokeStyle = 'rgba(240,248,255,0.75)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(0, -57); ctx.lineTo(-8.6, -29); ctx.lineTo(-9.6, 5); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,26,36,0.6)';
    ctx.beginPath(); ctx.moveTo(0, -57); ctx.lineTo(8.6, -29); ctx.lineTo(9.6, 5); ctx.stroke();
    /* crossguard */
    ctx.fillStyle = goldGrad(ctx, -26, 2, 26, 16);
    ctx.beginPath();
    ctx.moveTo(-26, 6); ctx.lineTo(26, 6); ctx.lineTo(20, 14); ctx.lineTo(-20, 14);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(-24, 10, 4.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(24, 10, 4.4, 0, TAU); ctx.fill();
    /* grip */
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath();
    ctx.moveTo(-6.5, 14); ctx.lineTo(6.5, 14); ctx.lineTo(5.5, 44); ctx.lineTo(-5.5, 44);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(201,162,39,0.85)'; ctx.lineWidth = 1.6;
    for (var i = 0; i < 6; i++) {
      var yy = 17 + i * 4.7;
      ctx.beginPath(); ctx.moveTo(-6.2, yy); ctx.lineTo(6.2, yy + 2.4); ctx.stroke();
    }
    /* pommel */
    ctx.fillStyle = goldGrad(ctx, -10, 42, 10, 58);
    ctx.beginPath(); ctx.ellipse(0, 48, 9, 8, 0, 0, TAU); ctx.fill();
    ctx.restore();
    gem(ctx, 64 + Math.sin(0.42) * 48, 64 + Math.cos(0.42) * 48, 6.4, '#5c0d1c', '#e0455f', '#ffd0d6');
    return finishIcon(c, S);
  }

  function bakeChalice() {
    var S = 128, c = scratch2x(S, S), ctx = c.ctx;
    /* bowl */
    ctx.beginPath();
    ctx.moveTo(28, 34);
    ctx.lineTo(100, 34);
    ctx.bezierCurveTo(98, 66, 84, 80, 64, 82);
    ctx.bezierCurveTo(44, 80, 30, 66, 28, 34);
    ctx.closePath();
    ctx.fillStyle = goldGrad(ctx, 26, 28, 96, 82);
    ctx.fill();
    /* interior */
    ctx.beginPath();
    ctx.ellipse(64, 34, 36, 8.5, 0, 0, TAU);
    var ig = ctx.createLinearGradient(40, 26, 90, 44);
    ig.addColorStop(0, '#2a1c04'); ig.addColorStop(0.5, '#120c02'); ig.addColorStop(1, '#3a2a08');
    ctx.fillStyle = ig; ctx.fill();
    ctx.strokeStyle = 'rgba(255,243,196,0.55)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(64, 34, 36, 8.5, 0, 0, TAU); ctx.stroke();
    /* engraved band on the bowl */
    ctx.strokeStyle = 'rgba(52,36,4,0.5)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(29.5, 46); ctx.quadraticCurveTo(64, 56, 98.5, 46); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,243,196,0.28)';
    ctx.beginPath(); ctx.moveTo(30.5, 50); ctx.quadraticCurveTo(64, 60, 97.5, 50); ctx.stroke();
    for (var i = 0; i < 7; i++) {
      var t = (i + 0.5) / 7;
      var bx = 32 + t * 64, by = 60 + Math.sin(t * Math.PI) * 8;
      ctx.strokeStyle = 'rgba(52,36,4,0.4)';
      ctx.beginPath(); ctx.moveTo(bx - 4, by); ctx.lineTo(bx, by + 5); ctx.lineTo(bx + 4, by); ctx.stroke();
    }
    /* knop + stem */
    ctx.fillStyle = goldGrad(ctx, 56, 78, 74, 104);
    ctx.fillRect(59, 80, 10, 12);
    ctx.beginPath(); ctx.ellipse(64, 92, 9.5, 7, 0, 0, TAU); ctx.fill();
    ctx.fillRect(60, 96, 8, 10);
    /* foot */
    ctx.beginPath();
    ctx.moveTo(40, 118); ctx.lineTo(88, 118);
    ctx.quadraticCurveTo(76, 104, 68, 104);
    ctx.lineTo(60, 104);
    ctx.quadraticCurveTo(52, 104, 40, 118);
    ctx.closePath();
    ctx.fillStyle = goldGrad(ctx, 38, 100, 88, 120);
    ctx.fill();
    ctx.fillStyle = 'rgba(52,36,4,0.35)';
    ctx.fillRect(40, 115.5, 48, 2.5);
    /* gems */
    gem(ctx, 64, 62, 8, '#5c0d1c', '#d63f5a', '#ffc6cf');
    gem(ctx, 42, 56, 5, '#3a0d5c', '#8b3fd6', '#e6c6ff');
    gem(ctx, 86, 56, 5, '#0d4a5c', '#3fc4d6', '#c6f4ff');
    return finishIcon(c, S);
  }

  /* ==================================================================
     PROPS — consistent 3/4 top-down, light upper-left, baked contact AO
     ================================================================== */
  function bakeColumn() {
    var W = 128, H = 256;
    var c = scratch2x(W, H), ctx = c.ctx;
    contactShadow(ctx, 64, 226, 58, 22, 0.6);

    /* shaft */
    var sg = ctx.createLinearGradient(20, 0, 108, 0);
    sg.addColorStop(0, '#1b1f27');
    sg.addColorStop(0.16, '#454d5c');
    sg.addColorStop(0.34, '#6d7789');
    sg.addColorStop(0.6, '#3b424f');
    sg.addColorStop(0.85, '#22262f');
    sg.addColorStop(1, '#12151b');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(28, 66); ctx.lineTo(100, 66); ctx.lineTo(104, 220); ctx.lineTo(24, 220);
    ctx.closePath(); ctx.fill();

    /* flutes */
    for (var i = 0; i < 9; i++) {
      var t = (i + 0.5) / 9;
      var fx = 28 + t * 72;
      var lit = Math.pow(1 - Math.abs(t - 0.28), 2);
      ctx.strokeStyle = 'rgba(8,10,14,0.55)';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(fx, 66); ctx.lineTo(fx + (t - 0.5) * 8, 220); ctx.stroke();
      ctx.strokeStyle = 'rgba(190,205,228,' + (0.05 + lit * 0.20) + ')';
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(fx + 2.4, 66); ctx.lineTo(fx + 2.4 + (t - 0.5) * 8, 220); ctx.stroke();
    }

    /* capital: three stepped deco tiers seen from slightly above */
    function tier(cyy, rx, ry, hgt, cols) {
      ctx.beginPath();
      ctx.ellipse(64, cyy, rx, ry, 0, 0, Math.PI);
      ctx.lineTo(64 - rx, cyy);
      ctx.closePath();
      var g = ctx.createLinearGradient(64 - rx, 0, 64 + rx, 0);
      g.addColorStop(0, cols[0]); g.addColorStop(0.3, cols[1]); g.addColorStop(1, cols[2]);
      ctx.fillStyle = g;
      ctx.fillRect(64 - rx, cyy, rx * 2, hgt);
      ctx.beginPath();
      ctx.ellipse(64, cyy + hgt, rx, ry, 0, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(64, cyy, rx, ry, 0, 0, TAU);
      var tg = ctx.createLinearGradient(64 - rx, cyy - ry, 64 + rx, cyy + ry);
      tg.addColorStop(0, cols[3]); tg.addColorStop(0.45, cols[1]); tg.addColorStop(1, cols[0]);
      ctx.fillStyle = tg; ctx.fill();
      ctx.strokeStyle = 'rgba(8,10,14,0.5)'; ctx.lineWidth = 1;
      ctx.stroke();
    }
    tier(56, 50, 15, 12, ['#1a1e26', '#5b6373', '#262b34', '#8b95a6']);
    tier(40, 44, 13, 10, ['#1a1e26', '#525a69', '#22262e', '#7d8798']);
    /* brass collar */
    ctx.beginPath(); ctx.ellipse(64, 30, 38, 11, 0, 0, TAU);
    ctx.fillStyle = metalGrad(ctx, 26, 20, 102, 42, BR_DARK, BR_MID, BR_HOT);
    ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,236,180,0.45)'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(64, 30, 24, 7, 0, 0, TAU);
    ctx.fillStyle = 'rgba(10,12,16,0.55)'; ctx.fill();
    /* base */
    ctx.beginPath(); ctx.ellipse(64, 220, 54, 17, 0, 0, TAU);
    var bgg = ctx.createLinearGradient(10, 200, 118, 240);
    bgg.addColorStop(0, '#8b95a6'); bgg.addColorStop(0.4, '#3a414e'); bgg.addColorStop(1, '#14171d');
    ctx.fillStyle = bgg; ctx.fill();
    ctx.strokeStyle = 'rgba(8,10,14,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(64, 216, 44, 13, 0, 0, TAU);
    ctx.fillStyle = 'rgba(120,132,150,0.20)'; ctx.fill();

    var out = down(c.canvas, W, H);
    noiseOverlay(out, 0.10, 24, 24, 3, 3311, false);
    rimLight(out, 1.6, 1.6, 'rgba(200,220,255,1)', 0.16, 'lighter');
    return out;
  }

  function bakeCrate() {
    var S = 128;
    var c = scratch2x(S, S), ctx = c.ctx;
    contactShadow(ctx, 66, 112, 50, 16, 0.62);
    /* front face */
    var fg = ctx.createLinearGradient(16, 40, 112, 112);
    fg.addColorStop(0, '#4a301a');
    fg.addColorStop(0.5, '#33200f');
    fg.addColorStop(1, '#1c1108');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(18, 46); ctx.lineTo(110, 46); ctx.lineTo(110, 110); ctx.lineTo(18, 110);
    ctx.closePath(); ctx.fill();
    /* top face (3/4) */
    var tg = ctx.createLinearGradient(20, 12, 108, 50);
    tg.addColorStop(0, '#8a5c33');
    tg.addColorStop(0.45, '#65401f');
    tg.addColorStop(1, '#3d2612');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(18, 46); ctx.lineTo(34, 16); ctx.lineTo(112, 16); ctx.lineTo(110, 46);
    ctx.closePath(); ctx.fill();
    /* planks */
    ctx.strokeStyle = 'rgba(12,7,3,0.6)'; ctx.lineWidth = 1.2;
    for (var i = 1; i < 4; i++) {
      var py = 46 + i * 16;
      ctx.beginPath(); ctx.moveTo(18, py); ctx.lineTo(110, py); ctx.stroke();
      ctx.strokeStyle = 'rgba(180,140,96,0.13)';
      ctx.beginPath(); ctx.moveTo(18, py + 1.4); ctx.lineTo(110, py + 1.4); ctx.stroke();
      ctx.strokeStyle = 'rgba(12,7,3,0.6)';
    }
    for (i = 1; i < 4; i++) {
      var px = 18 + i * 24;
      ctx.beginPath();
      ctx.moveTo(px, 46); ctx.lineTo(px + 12 - i * 2, 16); ctx.stroke();
    }
    /* steel bands */
    function band(y, h2) {
      var g = ctx.createLinearGradient(18, y, 110, y + h2);
      g.addColorStop(0, '#9aa4b2'); g.addColorStop(0.35, '#59616f'); g.addColorStop(1, '#2c323c');
      ctx.fillStyle = g;
      ctx.fillRect(18, y, 92, h2);
      ctx.fillStyle = 'rgba(230,240,255,0.22)';
      ctx.fillRect(18, y, 92, 1.1);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(18, y + h2 - 1.1, 92, 1.1);
      for (var b = 0; b < 5; b++) {
        var bx2 = 24 + b * 21;
        ctx.fillStyle = 'rgba(200,214,232,0.4)';
        ctx.beginPath(); ctx.arc(bx2, y + h2 / 2, 1.5, 0, TAU); ctx.fill();
      }
    }
    band(56, 7); band(92, 7);
    /* corner brackets */
    ctx.fillStyle = 'rgba(120,132,150,0.55)';
    ctx.fillRect(18, 46, 5, 64); ctx.fillRect(105, 46, 5, 64);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(23, 46, 2, 64); ctx.fillRect(103, 46, 2, 64);
    /* stencil mark */
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.strokeStyle = '#d8c48c'; ctx.lineWidth = 2;
    ctx.strokeRect(46, 68, 34, 20);
    ctx.beginPath(); ctx.moveTo(52, 74); ctx.lineTo(60, 84); ctx.lineTo(68, 74); ctx.lineTo(76, 84);
    ctx.stroke();
    ctx.restore();

    var out = down(c.canvas, S, S);
    noiseOverlay(out, 0.13, 20, 20, 3, 5511, true);
    rimLight(out, 1.5, 1.5, 'rgba(255,226,180,1)', 0.20, 'lighter');
    return out;
  }

  function bakePlant() {
    var S = 128;
    var c = scratch2x(S, S), ctx = c.ctx;
    contactShadow(ctx, 66, 110, 40, 13, 0.62);
    var rnd = rngFrom(60613);
    /* fronds under */
    function frond(a, len, wid, col1, col2) {
      ctx.save();
      ctx.translate(64, 74);
      ctx.rotate(a);
      var g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, col1); g.addColorStop(0.6, col2); g.addColorStop(1, col1);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.55, -wid, len, -wid * 0.18);
      ctx.quadraticCurveTo(len * 0.6, 0, len, wid * 0.18);
      ctx.quadraticCurveTo(len * 0.55, wid, 0, 0);
      ctx.fill();
      /* serrations + rib */
      ctx.strokeStyle = 'rgba(6,14,8,0.5)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
      ctx.lineWidth = 0.7;
      for (var k = 1; k < 9; k++) {
        var t = k / 9;
        var xx = t * len, ww = wid * Math.sin(t * Math.PI) * 0.95;
        ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx + len * 0.06, -ww); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx + len * 0.06, ww); ctx.stroke();
      }
      ctx.restore();
    }
    var nF = 13;
    for (var i = 0; i < nF; i++) {
      var a = i / nF * TAU + rnd() * 0.2;
      var lit = 0.5 - 0.5 * Math.cos(a - (-2.356));
      var len = 34 + rnd() * 14;
      var c1 = PV.mixHex('#132a19', '#28502f', lit);
      var c2 = PV.mixHex('#204227', '#63a05a', lit);
      frond(a, len, 8 + rnd() * 4, c1, c2);
    }
    /* soil */
    ctx.beginPath(); ctx.ellipse(64, 76, 22, 9, 0, 0, TAU);
    ctx.fillStyle = '#1a1208'; ctx.fill();
    /* pot: brass, 3/4 */
    var pg = ctx.createLinearGradient(40, 74, 92, 112);
    pg.addColorStop(0, '#f0d38a'); pg.addColorStop(0.22, '#c39a2c');
    pg.addColorStop(0.6, '#7a5e14'); pg.addColorStop(1, '#3a2c08');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(42, 76); ctx.lineTo(86, 76); ctx.lineTo(80, 108);
    ctx.quadraticCurveTo(64, 114, 48, 108);
    ctx.closePath(); ctx.fill();
    /* rim */
    ctx.beginPath(); ctx.ellipse(64, 76, 23, 8, 0, 0, TAU);
    ctx.fillStyle = metalGrad(ctx, 41, 68, 88, 84, BR_DARK, BR_MID, BR_HOT);
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(64, 76.5, 18.5, 6, 0, 0, TAU);
    ctx.fillStyle = '#140e05'; ctx.fill();
    /* pot deco bands */
    ctx.strokeStyle = 'rgba(40,28,4,0.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(44.5, 86); ctx.quadraticCurveTo(64, 92, 83.5, 86); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,238,190,0.30)';
    ctx.beginPath(); ctx.moveTo(45, 89); ctx.quadraticCurveTo(64, 95, 83, 89); ctx.stroke();

    var out = down(c.canvas, S, S);
    noiseOverlay(out, 0.10, 26, 26, 3, 7711, true);
    rimLight(out, 1.4, 1.4, 'rgba(255,240,200,1)', 0.18, 'lighter');
    return out;
  }

  function bakeBench() {
    var W = 192, H = 96;
    var c = scratch2x(W, H), ctx = c.ctx;
    contactShadow(ctx, 98, 76, 84, 16, 0.55);
    /* legs (brass) */
    function leg(x, y) {
      var g = ctx.createLinearGradient(x - 5, y, x + 6, y + 20);
      g.addColorStop(0, '#e6c76e'); g.addColorStop(0.4, '#a8842a'); g.addColorStop(1, '#3c2d0b');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.lineTo(x + 3, y + 18); ctx.lineTo(x - 3, y + 18);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(x, y + 18, 4.5, 2, 0, 0, TAU); ctx.fill();
    }
    leg(30, 58); leg(162, 58); leg(44, 62); leg(148, 62);
    /* seat slab */
    var sg = ctx.createLinearGradient(16, 16, 176, 62);
    sg.addColorStop(0, '#6a4526'); sg.addColorStop(0.35, '#4a2f18');
    sg.addColorStop(0.75, '#33200f'); sg.addColorStop(1, '#1e1309');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(18, 30); ctx.lineTo(174, 30); ctx.lineTo(180, 58); ctx.lineTo(12, 58);
    ctx.closePath(); ctx.fill();
    /* top face */
    var tg2 = ctx.createLinearGradient(18, 14, 174, 34);
    tg2.addColorStop(0, '#8a5f34'); tg2.addColorStop(0.4, '#63401f'); tg2.addColorStop(1, '#3f2814');
    ctx.fillStyle = tg2;
    ctx.beginPath();
    ctx.moveTo(18, 30); ctx.lineTo(26, 16); ctx.lineTo(168, 16); ctx.lineTo(174, 30);
    ctx.closePath(); ctx.fill();
    /* slats */
    ctx.strokeStyle = 'rgba(10,6,2,0.65)'; ctx.lineWidth = 1.4;
    for (var i = 1; i < 5; i++) {
      var t = i / 5;
      var xa = 26 + t * 142, xb = 18 + t * 156;
      ctx.beginPath(); ctx.moveTo(xa, 16); ctx.lineTo(xb, 30); ctx.lineTo(xb + (t - 0.5) * 6, 58); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,160,110,0.13)';
      ctx.beginPath(); ctx.moveTo(xa + 1.6, 16); ctx.lineTo(xb + 1.6, 30); ctx.stroke();
      ctx.strokeStyle = 'rgba(10,6,2,0.65)';
    }
    /* brass end caps */
    ctx.fillStyle = metalGrad(ctx, 12, 20, 30, 58, BR_DARK, BR_MID, BR_HOT);
    ctx.beginPath();
    ctx.moveTo(18, 30); ctx.lineTo(26, 16); ctx.lineTo(30, 16); ctx.lineTo(23, 30);
    ctx.lineTo(17, 58); ctx.lineTo(12, 58); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(174, 30); ctx.lineTo(168, 16); ctx.lineTo(164, 16); ctx.lineTo(169, 30);
    ctx.lineTo(175, 58); ctx.lineTo(180, 58); ctx.closePath(); ctx.fill();
    /* front edge highlight */
    ctx.fillStyle = 'rgba(220,190,150,0.16)';
    ctx.fillRect(18, 30, 156, 1.4);

    var out = down(c.canvas, W, H);
    noiseOverlay(out, 0.11, 24, 12, 3, 8811, true);
    rimLight(out, 1.4, 1.4, 'rgba(255,236,196,1)', 0.18, 'lighter');
    return out;
  }

  function bakeVitrine() {
    var S = 128;
    var c = scratch2x(S, S), ctx = c.ctx;
    contactShadow(ctx, 66, 112, 48, 15, 0.6);
    /* plinth */
    var pg = ctx.createLinearGradient(18, 86, 110, 116);
    pg.addColorStop(0, '#3a2718'); pg.addColorStop(0.4, '#26180d'); pg.addColorStop(1, '#140c06');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(20, 92); ctx.lineTo(108, 92); ctx.lineTo(104, 112); ctx.lineTo(24, 112);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = metalGrad(ctx, 18, 88, 110, 96, BR_DARK, BR_MID, BR_HOT);
    ctx.fillRect(20, 88, 88, 5);
    /* interior floor */
    var ig = ctx.createLinearGradient(24, 30, 104, 92);
    ig.addColorStop(0, '#1b2027'); ig.addColorStop(1, '#090c11');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.moveTo(24, 88); ctx.lineTo(104, 88); ctx.lineTo(98, 34); ctx.lineTo(30, 34);
    ctx.closePath(); ctx.fill();
    /* glass body */
    ctx.fillStyle = 'rgba(150,205,225,0.10)';
    ctx.beginPath();
    ctx.moveTo(22, 90); ctx.lineTo(106, 90); ctx.lineTo(100, 30); ctx.lineTo(28, 30);
    ctx.closePath(); ctx.fill();
    /* top face */
    ctx.fillStyle = 'rgba(180,225,240,0.16)';
    ctx.beginPath();
    ctx.moveTo(28, 30); ctx.lineTo(100, 30); ctx.lineTo(94, 18); ctx.lineTo(34, 18);
    ctx.closePath(); ctx.fill();
    /* reflections */
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(22, 90); ctx.lineTo(106, 90); ctx.lineTo(100, 30); ctx.lineTo(28, 30);
    ctx.closePath(); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(190,230,255,0.13)';
    ctx.beginPath(); ctx.moveTo(30, 92); ctx.lineTo(58, 28); ctx.lineTo(70, 28); ctx.lineTo(42, 92); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(190,230,255,0.08)';
    ctx.beginPath(); ctx.moveTo(56, 92); ctx.lineTo(84, 28); ctx.lineTo(89, 28); ctx.lineTo(61, 92); ctx.closePath(); ctx.fill();
    ctx.restore();
    /* brass frame edges */
    ctx.strokeStyle = metalGrad(ctx, 20, 16, 108, 94, BR_DARK, BR_MID, BR_HOT);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(22, 90); ctx.lineTo(28, 30); ctx.lineTo(100, 30); ctx.lineTo(106, 90);
    ctx.moveTo(28, 30); ctx.lineTo(34, 18); ctx.lineTo(94, 18); ctx.lineTo(100, 30);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(34, 18); ctx.lineTo(94, 18); ctx.stroke();

    var out = down(c.canvas, S, S);
    rimLight(out, 1.4, 1.4, 'rgba(230,245,255,1)', 0.20, 'lighter');
    return out;
  }

  /* ==================================================================
     PUBLIC API
     ================================================================== */
  function reg(name, canvas) {
    cache[name] = canvas;
    if (TEX.names.indexOf(name) < 0) TEX.names.push(name);
  }

  function makeFallback() {
    var cv = PV.makeCanvas(8, 8);
    var g = cv.ctx;
    g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 8, 8);
    g.fillStyle = '#000000';
    g.fillRect(0, 0, 4, 4); g.fillRect(4, 4, 4, 4);
    return cv.canvas;
  }

  TEX.get = function (name) {
    var c = cache[name];
    if (c) return c;
    if (!warned[name]) {
      warned[name] = true;
      if (global.console) console.warn('[PV.Textures] unknown texture "' + name + '" — using fallback checker');
    }
    if (!fallbackCanvas) fallbackCanvas = makeFallback();
    return fallbackCanvas;
  };

  TEX.has = function (name) { return !!cache[name]; };

  TEX.variant = function (name, i) {
    var list = variantCache[name];
    if (!list || !list.length) return TEX.get(name);
    var n = list.length;
    var k = ((i | 0) % n + n) % n;
    return list[k];
  };

  TEX.pattern = function (ctx, name) {
    var p = patternCache[name];
    if (p) return p;
    p = ctx.createPattern(TEX.get(name), 'repeat');
    patternCache[name] = p;
    return p;
  };

  TEX.init = function () {
    if (TEX.ready) return;
    var t0 = PV.now();
    var prof = TEX.profile = {};
    function T_(name, fn) {
      var a = PV.now();
      var r = fn();
      prof[name] = (prof[name] || 0) + (PV.now() - a);
      reg(name, r);
      return r;
    }

    /* --- tiling materials --- */
    T_('floor.marble', function () { return bakeMarble(false); });
    T_('floor.marbleGold', function () { return bakeMarble(true); });
    T_('floor.granite', bakeGranite);
    T_('floor.parquet', bakeParquet);
    T_('floor.carpet', bakeCarpet);
    T_('floor.grate', bakeGrate);
    T_('wall.stone', bakeWallStone);
    T_('wall.panel', bakeWallPanel);
    T_('wall.concrete', bakeConcrete);
    T_('metal.brushed', bakeBrushedMetal);
    T_('metal.brass', bakeBrass);
    T_('glass.frosted', bakeFrostedGlass);
    T_('noise.grain', bakeGrain);
    T_('noise.blue', bakeBlueNoise);

    /* --- decal families with deterministic variants --- */
    var i, list;
    list = [];
    for (i = 0; i < 4; i++) { list.push(T_('decal.crack.' + i, (function (k) { return function () { return bakeCrack(k); }; })(i))); }
    variantCache['decal.crack'] = list;
    reg('decal.crack', list[0]);

    list = [];
    for (i = 0; i < 4; i++) { list.push(T_('decal.scuff.' + i, (function (k) { return function () { return bakeScuff(k); }; })(i))); }
    variantCache['decal.scuff'] = list;
    reg('decal.scuff', list[0]);

    T_('decal.medallion', bakeMedallion);
    T_('decal.rug', bakeRug);
    T_('decal.dust', bakeDust);
    T_('decal.caustic', bakeCaustic);

    /* --- relic icons --- */
    T_('icon.relic.crown', bakeCrown);
    T_('icon.relic.orb', bakeOrb);
    T_('icon.relic.mask', bakeMask);
    T_('icon.relic.blade', bakeBlade);
    T_('icon.relic.chalice', bakeChalice);

    /* --- props --- */
    T_('prop.column', bakeColumn);
    T_('prop.crate', bakeCrate);
    T_('prop.plant', bakePlant);
    T_('prop.bench', bakeBench);
    T_('prop.vitrine', bakeVitrine);

    T_('vignette.soft', bakeVignette);

    LAT = {};              /* drop the noise lattices, they are not needed again */
    FIELDS = {};
    WCELL = {};
    _wcC = -1; _wcX = null; _wcY = null;
    TEX.bakeMs = PV.now() - t0;
    TEX.ready = true;
    if (global.console) console.log('[PV.Textures] baked ' + TEX.names.length + ' textures in ' + TEX.bakeMs.toFixed(1) + 'ms');
  };

  /* material list helpers for the renderer / debug harness */
  TEX.tiling = ['floor.marble', 'floor.marbleGold', 'floor.granite', 'floor.parquet',
    'floor.carpet', 'floor.grate', 'wall.stone', 'wall.panel', 'wall.concrete',
    'metal.brushed', 'metal.brass', 'glass.frosted', 'noise.grain', 'noise.blue'];

})(window);
