/* =====================================================================
   ZEPHYR CIRCUIT — track.js
   The centerline spline, baked into flat arrays, and the queries the rest
   of the game makes against it.
   Owner: lead. See SPEC.md §1 — read that before changing anything here.

   Classic script, no three.js. Positions are plain numbers, never
   Vector3s, because this file is loaded into a `vm` context by the tests.

   Coordinate convention matches three.js: right-handed, +Y up. A kart's
   forward is its tangent; its right is cross(tangent, up).
   ===================================================================== */
(function (global) {
  'use strict';

  var ZC = global.ZC || (global.ZC = {});
  var T = ZC.Track = {};

  /* Target arc length of one baked segment, in metres. Small enough that
     a segment is effectively straight (so projection onto it is exact
     enough), large enough that a 2km circuit is only ~1300 segments. */
  var SEGMENT_LEN = 1.5;

  /* Dense samples per control-point span, before arc-length resampling.
     The spline is sampled far finer than it is stored; the resample is
     what makes every downstream query O(1). */
  var DENSE_PER_SPAN = 48;

  /* ------------------------------------------------------------------
     Uniform Catmull-Rom through a closed loop of control points.
     `a`..`d` are the four points around the span; `u` is 0..1 across it.
     ------------------------------------------------------------------ */
  function catmull(a, b, c, d, u) {
    var u2 = u * u, u3 = u2 * u;
    return 0.5 * (
      (2 * b) +
      (-a + c) * u +
      (2 * a - 5 * b + 4 * c - d) * u2 +
      (-a + 3 * b - 3 * c + d) * u3
    );
  }

  function wrapIndex(i, n) { return ((i % n) + n) % n; }

  /* Rodrigues: rotate vector v around unit axis k by angle `ang`.
     Writes into `out` (a 3-array) to avoid allocating during the bake. */
  function rotateAround(vx, vy, vz, kx, ky, kz, ang, out) {
    var c = Math.cos(ang), s = Math.sin(ang);
    var dot = kx * vx + ky * vy + kz * vz;
    /* v*cos + (k x v)*sin + k*(k.v)*(1-cos) */
    var cx = ky * vz - kz * vy;
    var cy = kz * vx - kx * vz;
    var cz = kx * vy - ky * vx;
    out[0] = vx * c + cx * s + kx * dot * (1 - c);
    out[1] = vy * c + cy * s + ky * dot * (1 - c);
    out[2] = vz * c + cz * s + kz * dot * (1 - c);
    return out;
  }

  /* ------------------------------------------------------------------
     bake(def) -> track

     Deterministic: the same definition always produces byte-identical
     arrays. The test suite asserts that, because the AI racing line and
     every lap time depend on it.
     ------------------------------------------------------------------ */
  T.bake = function (def) {
    var pts = def.points;
    var n = pts.length;
    if (n < 4) throw new Error('[ZC] a track needs at least 4 control points');

    /* ---- 1. dense sample the closed spline ---- */
    var dense = [];
    for (var i = 0; i < n; i++) {
      var p0 = pts[wrapIndex(i - 1, n)], p1 = pts[i];
      var p2 = pts[wrapIndex(i + 1, n)], p3 = pts[wrapIndex(i + 2, n)];
      for (var k = 0; k < DENSE_PER_SPAN; k++) {
        var u = k / DENSE_PER_SPAN;
        dense.push({
          x: catmull(p0.x, p1.x, p2.x, p3.x, u),
          y: catmull(p0.y, p1.y, p2.y, p3.y, u),
          z: catmull(p0.z, p1.z, p2.z, p3.z, u),
          /* width and bank are interpolated on the same basis, so a
             widening or a camber change eases in rather than stepping */
          w: catmull(p0.w, p1.w, p2.w, p3.w, u),
          bank: catmull(p0.bank || 0, p1.bank || 0, p2.bank || 0, p3.bank || 0, u)
        });
      }
    }
    var dn = dense.length;

    /* ---- 2. cumulative arc length around the loop ---- */
    var cum = new Float64Array(dn + 1);
    for (i = 0; i < dn; i++) {
      var a = dense[i], b = dense[(i + 1) % dn];
      var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      cum[i + 1] = cum[i] + Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    var total = cum[dn];

    /* ---- 3. resample at uniform arc length ----
       Uniform spacing is what lets every later query index by
       `s / ds` instead of searching. It is the whole reason this step
       exists. */
    var count = Math.max(8, Math.round(total / SEGMENT_LEN));
    var ds = total / count;

    var px = new Float32Array(count), py = new Float32Array(count), pz = new Float32Array(count);
    var halfWidth = new Float32Array(count), bank = new Float32Array(count);
    var sArr = new Float32Array(count);

    var cursor = 0;
    for (i = 0; i < count; i++) {
      var target = i * ds;
      while (cursor < dn - 1 && cum[cursor + 1] < target) cursor++;
      var span = cum[cursor + 1] - cum[cursor];
      var f = span > 1e-9 ? (target - cum[cursor]) / span : 0;
      var d0 = dense[cursor], d1 = dense[(cursor + 1) % dn];
      px[i] = d0.x + (d1.x - d0.x) * f;
      py[i] = d0.y + (d1.y - d0.y) * f;
      pz[i] = d0.z + (d1.z - d0.z) * f;
      halfWidth[i] = d0.w + (d1.w - d0.w) * f;
      bank[i] = d0.bank + (d1.bank - d0.bank) * f;
      sArr[i] = target;
    }

    /* ---- 4. per-segment frame: tangent, right, up ----
       Run as a closure because auto-camber needs the curvature, and
       curvature needs the frame: build the frame flat, measure the
       corners, then rebuild the frame with the camber those corners
       imply. Hand-authoring `bank` per control point is possible but it
       drifts out of step with the geometry the moment anyone moves a
       point, and a corner banked the wrong way is vicious to debug. */
    var tx = new Float32Array(count), ty = new Float32Array(count), tz = new Float32Array(count);
    var rx = new Float32Array(count), ry = new Float32Array(count), rz = new Float32Array(count);
    var nx = new Float32Array(count), ny = new Float32Array(count), nz = new Float32Array(count);
    var curvature = new Float32Array(count);
    var tmp = [0, 0, 0];

    function buildFrames() {
    for (i = 0; i < count; i++) {
      var i0 = wrapIndex(i - 1, count), i1 = wrapIndex(i + 1, count);
      /* central difference — a forward difference biases the frame half a
         segment ahead, which shows up as the road visibly lagging the
         kart through tight corners */
      var vx = px[i1] - px[i0], vy = py[i1] - py[i0], vz = pz[i1] - pz[i0];
      var vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      tx[i] = vx / vl; ty[i] = vy / vl; tz[i] = vz / vl;

      /* right = tangent x worldUp, then re-derive up so the frame is
         orthonormal even where the road climbs */
      var wx = tx[i], wy = ty[i], wz = tz[i];
      var cx = wy * 0 - wz * 1;      // (w x (0,1,0)).x  = wy*0 - wz*1
      var cy = wz * 0 - wx * 0;      // = 0
      var cz = wx * 1 - wy * 0;      // = wx
      var cl = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
      cx /= cl; cy /= cl; cz /= cl;

      /* up = right x tangent */
      var ux = cy * wz - cz * wy;
      var uy = cz * wx - cx * wz;
      var uz = cx * wy - cy * wx;

      /* apply camber by rolling the frame about the tangent */
      if (bank[i] !== 0) {
        rotateAround(cx, cy, cz, wx, wy, wz, bank[i], tmp);
        cx = tmp[0]; cy = tmp[1]; cz = tmp[2];
        rotateAround(ux, uy, uz, wx, wy, wz, bank[i], tmp);
        ux = tmp[0]; uy = tmp[1]; uz = tmp[2];
      }

      rx[i] = cx; ry[i] = cy; rz[i] = cz;
      nx[i] = ux; ny[i] = uy; nz[i] = uz;
    }
    }

    /* signed curvature: how fast the tangent swings toward `right`.
       Positive = turning right. AI braking and camera lean read this. */
    function buildCurvature() {
      for (var i = 0; i < count; i++) {
        var j = wrapIndex(i + 1, count);
        var dtx = (tx[j] - tx[i]) / ds, dty = (ty[j] - ty[i]) / ds, dtz = (tz[j] - tz[i]) / ds;
        curvature[i] = dtx * rx[i] + dty * ry[i] + dtz * rz[i];
      }
    }

    buildFrames();
    buildCurvature();

    if (def.autoBank) {
      /* Positive camber rolls the road's right side down, which is what a
         right-hand turn (positive curvature) wants. Smoothed over a wide
         window so camber eases in and out over tens of metres rather than
         stepping between segments. */
      var maxBank = def.maxBank === undefined ? 0.20 : def.maxBank;
      var gain = def.autoBank === true ? 3.2 : def.autoBank;
      var raw = new Float32Array(count);
      for (i = 0; i < count; i++) {
        raw[i] = Math.max(-maxBank, Math.min(maxBank, curvature[i] * gain * 100));
      }
      var win = Math.max(1, Math.round(18 / ds));
      for (i = 0; i < count; i++) {
        var acc = 0;
        for (var k2 = -win; k2 <= win; k2++) acc += raw[wrapIndex(i + k2, count)];
        bank[i] = acc / (win * 2 + 1);
      }
      buildFrames();
      buildCurvature();
    }

    var track = {
      id: def.id,
      name: def.name,
      theme: def.theme || 'sky',
      laps: def.laps || 3,
      parTime: def.parTime || 90,
      count: count,
      ds: ds,
      length: total,
      px: px, py: py, pz: pz,
      tx: tx, ty: ty, tz: tz,
      rx: rx, ry: ry, rz: rz,
      nx: nx, ny: ny, nz: nz,
      halfWidth: halfWidth,
      bank: bank,
      s: sArr,
      curvature: curvature,
      checkpoints: ZC.CHECKPOINTS,
      checkpointLen: total / ZC.CHECKPOINTS,
      /* the drop below the road at which a kart counts as fallen */
      voidY: def.voidY === undefined ? -40 : def.voidY
    };
    return track;
  };

  /* ------------------------------------------------------------------
     Index helpers. Uniform arc-length spacing makes these O(1).
     ------------------------------------------------------------------ */
  T.wrapS = function (track, s) {
    var L = track.length;
    return ((s % L) + L) % L;
  };
  T.segAt = function (track, s) {
    return wrapIndex(Math.floor(T.wrapS(track, s) / track.ds), track.count);
  };

  /* Interpolated frame at an arbitrary arc length. `out` is reused by the
     caller so the frame loop never allocates. */
  T.frameAt = function (track, s, out) {
    out = out || {};
    var w = T.wrapS(track, s);
    var f = w / track.ds;
    var i = Math.floor(f) % track.count;
    var j = wrapIndex(i + 1, track.count);
    var u = f - Math.floor(f);

    out.x = track.px[i] + (track.px[j] - track.px[i]) * u;
    out.y = track.py[i] + (track.py[j] - track.py[i]) * u;
    out.z = track.pz[i] + (track.pz[j] - track.pz[i]) * u;
    out.tx = track.tx[i] + (track.tx[j] - track.tx[i]) * u;
    out.ty = track.ty[i] + (track.ty[j] - track.ty[i]) * u;
    out.tz = track.tz[i] + (track.tz[j] - track.tz[i]) * u;
    out.rx = track.rx[i] + (track.rx[j] - track.rx[i]) * u;
    out.ry = track.ry[i] + (track.ry[j] - track.ry[i]) * u;
    out.rz = track.rz[i] + (track.rz[j] - track.rz[i]) * u;
    out.nx = track.nx[i] + (track.nx[j] - track.nx[i]) * u;
    out.ny = track.ny[i] + (track.ny[j] - track.ny[i]) * u;
    out.nz = track.nz[i] + (track.nz[j] - track.nz[i]) * u;
    out.halfWidth = track.halfWidth[i] + (track.halfWidth[j] - track.halfWidth[i]) * u;
    out.curvature = track.curvature[i] + (track.curvature[j] - track.curvature[i]) * u;
    out.seg = i;

    /* normalise the tangent: lerping two unit vectors shortens them, and
       the error is worst exactly where it matters, in tight corners */
    var tl = Math.sqrt(out.tx * out.tx + out.ty * out.ty + out.tz * out.tz) || 1;
    out.tx /= tl; out.ty /= tl; out.tz /= tl;
    return out;
  };

  /* World position at (arc length, normalised lateral offset).
     Grid slots, AI lines and item boxes are all authored in these terms
     rather than in world space, so they follow the road automatically. */
  var _f = {};
  T.pointAt = function (track, s, t, out) {
    out = out || {};
    var fr = T.frameAt(track, s, _f);
    var d = t * fr.halfWidth;
    out.x = fr.x + fr.rx * d;
    out.y = fr.y + fr.ry * d;
    out.z = fr.z + fr.rz * d;
    out.yaw = Math.atan2(fr.tx, fr.tz);
    return out;
  };

  /* ------------------------------------------------------------------
     project(track, x, y, z, hint) — the query everything uses.

     `hint` is the caller's previous segment index. Karts move
     continuously, so the search only sweeps a window around the hint.
     Pass -1 to force a full scan; that is for placing a kart from
     nothing, not for anything that runs per tick.
     ------------------------------------------------------------------ */
  var WINDOW = 40;

  function projectOntoSegment(track, i, x, y, z, res) {
    var count = track.count;
    var j = wrapIndex(i + 1, count);
    var ax = track.px[i], ay = track.py[i], az = track.pz[i];
    var bx = track.px[j], by = track.py[j], bz = track.pz[j];
    var ex = bx - ax, ey = by - ay, ez = bz - az;
    var elen2 = ex * ex + ey * ey + ez * ez;
    var u = elen2 > 1e-9 ? ((x - ax) * ex + (y - ay) * ey + (z - az) * ez) / elen2 : 0;
    if (u < 0) u = 0; else if (u > 1) u = 1;
    var cx = ax + ex * u, cy = ay + ey * u, cz = az + ez * u;
    var dx = x - cx, dy = y - cy, dz = z - cz;
    res.d2 = dx * dx + dy * dy + dz * dz;
    res.u = u;
    return res;
  }

  var _pr = { d2: 0, u: 0 };

  T.project = function (track, x, y, z, hint, out) {
    out = out || {};
    var count = track.count;
    var best = -1, bestD2 = Infinity, bestU = 0;
    var i, idx;

    if (hint === undefined || hint < 0) {
      /* Coarse-to-fine full scan. Sampling every 8th segment first turns
         an O(N) sweep into O(N/8 + 16) with no loss of correctness at
         these segment lengths. */
      var stride = 8;
      var coarse = -1, coarseD2 = Infinity;
      for (i = 0; i < count; i += stride) {
        projectOntoSegment(track, i, x, y, z, _pr);
        if (_pr.d2 < coarseD2) { coarseD2 = _pr.d2; coarse = i; }
      }
      for (i = coarse - stride; i <= coarse + stride; i++) {
        idx = wrapIndex(i, count);
        projectOntoSegment(track, idx, x, y, z, _pr);
        if (_pr.d2 < bestD2) { bestD2 = _pr.d2; best = idx; bestU = _pr.u; }
      }
    } else {
      for (i = hint - WINDOW; i <= hint + WINDOW; i++) {
        idx = wrapIndex(i, count);
        projectOntoSegment(track, idx, x, y, z, _pr);
        if (_pr.d2 < bestD2) { bestD2 = _pr.d2; best = idx; bestU = _pr.u; }
      }
    }

    var j = wrapIndex(best + 1, count);
    var u = bestU;

    /* interpolate the frame across the winning segment */
    var cx = track.px[best] + (track.px[j] - track.px[best]) * u;
    var cy = track.py[best] + (track.py[j] - track.py[best]) * u;
    var cz = track.pz[best] + (track.pz[j] - track.pz[best]) * u;
    var frx = track.rx[best] + (track.rx[j] - track.rx[best]) * u;
    var fry = track.ry[best] + (track.ry[j] - track.ry[best]) * u;
    var frz = track.rz[best] + (track.rz[j] - track.rz[best]) * u;
    var hw = track.halfWidth[best] + (track.halfWidth[j] - track.halfWidth[best]) * u;

    /* lateral distance along the (banked) right vector */
    var lat = (x - cx) * frx + (y - cy) * fry + (z - cz) * frz;

    out.seg = best;
    out.s = T.wrapS(track, track.s[best] + u * track.ds);
    out.lateral = lat;
    out.t = hw > 1e-6 ? lat / hw : 0;
    out.halfWidth = hw;
    out.onRoad = Math.abs(out.t) <= 1;
    /* The road surface directly under the query point. Because `right`
       already carries the camber, stepping along it gives the height
       change for free — no separate banking maths needed. */
    out.surfaceY = cy + fry * lat;
    out.centerX = cx; out.centerY = cy; out.centerZ = cz;
    out.tx = track.tx[best]; out.ty = track.ty[best]; out.tz = track.tz[best];
    out.rx = frx; out.ry = fry; out.rz = frz;
    out.curvature = track.curvature[best];
    return out;
  };

  /* ------------------------------------------------------------------
     Checkpoints.

     Arc length alone cannot count a lap — a kart reversing over the line
     would score one, and a corner cut would shorten one. Requiring every
     checkpoint in order is what makes both impossible, and it means the
     track needs no separate anti-cheat geometry.
     ------------------------------------------------------------------ */
  T.checkpointAt = function (track, s) {
    var i = Math.floor(T.wrapS(track, s) / track.checkpointLen);
    return i >= track.checkpoints ? track.checkpoints - 1 : i;
  };

  /* Signed progress from `from` to `to` around the loop, choosing the
     short way. Used to tell "moved forward" from "crossed the line". */
  T.deltaS = function (track, from, to) {
    var L = track.length;
    var d = to - from;
    while (d > L * 0.5) d -= L;
    while (d < -L * 0.5) d += L;
    return d;
  };

  /* Total progress for placement: laps completed plus position round. */
  T.progress = function (track, lap, s) {
    return lap * track.length + T.wrapS(track, s);
  };

  T.SEGMENT_LEN = SEGMENT_LEN;

})(window);
