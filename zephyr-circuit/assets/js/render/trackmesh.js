/* =====================================================================
   ZEPHYR CIRCUIT — render/trackmesh.js
   Builds the road ribbon, the kerbs, the island it sits on, and the
   underside falling away into the sky.
   Owner: agent-render (this first pass written by the lead).

   All geometry is generated once at load from the baked centreline. It is
   the same arrays the physics uses, so the road you see and the road you
   drive on cannot drift apart.
   ===================================================================== */
import * as THREE from 'three';
import { PALETTE } from './scene.js';

const ZC = window.ZC;

/* How far past the road edge the ground continues. Must match
   ZC.Kart.TUNE.vergeLimit, or a kart drives on visible ground that the
   physics thinks is thin air. */
const VERGE = 1.85;

/* Radial rings from the island rim in to its middle. More rings means
   better lighting on a big landmass; 5 is enough at this scale. */
const ISLAND_RINGS = 5;
const APRON = 34;          // metres of ground outside the verge
const RIM_DROP = 5;        // how far the rim sits below the road
const KEEL = 120;          // how far the island's point hangs below

const THEMES = {
  dawn: { accent: 0x65dce3, trim: 0xffc75f, foliage: 0x5d985e, water: 0x72dff2 },
  dusk: { accent: 0xff86cb, trim: 0x8eeaff, foliage: 0x76518b, water: 0x85bdff },
  noon: { accent: 0xffd15c, trim: 0x63e7d1, foliage: 0x4d9776, water: 0x8cebf2 },
};

function colr(hex) { return new THREE.Color(hex); }

/* Deterministic value noise so the terrain is identical every load and
   the shape a player learns is the shape they get back. */
function noise2(x, z) {
  return ZC.hash2(Math.round(x * 0.35), Math.round(z * 0.35)) - 0.5;
}

function seeded(i, salt) {
  return ZC.hash2((i * 37 + salt * 101) | 0, (i * 91 - salt * 53) | 0);
}

function trackInfo(track) {
  let cx = 0, cy = 0, cz = 0, vote = 0;
  for (let i = 0; i < track.count; i++) {
    cx += track.px[i]; cy += track.py[i]; cz += track.pz[i];
    if ((i & 15) === 0) vote += track.rx[i] * track.px[i] + track.rz[i] * track.pz[i] > 0 ? -1 : 1;
  }
  const innerSign = vote >= 0 ? 1 : -1;
  return {
    cx: cx / track.count, cy: cy / track.count - 6, cz: cz / track.count,
    innerSign, outerSign: -innerSign,
    theme: THEMES[track.theme] || THEMES.dawn,
  };
}

export function buildTrack(track) {
  const info = trackInfo(track);
  const group = new THREE.Group();
  group.add(buildIsland(track));
  group.add(buildRoad(track));
  group.add(buildSurfaceDetail(track, info));
  group.add(buildVerge(track, info));
  group.add(buildKerbs(track));
  group.add(buildWaterfalls(track, info));
  group.add(buildScenery(track, info));
  group.add(buildStartLine(track, info));
  group.name = 'trackWorld';
  return group;
}

/* ------------------------------------------------------------------
   The road: one quad per baked segment, vertex-coloured. Smooth-shaded,
   because faceting a road surface reads as corrugation.
   ------------------------------------------------------------------ */
function buildRoad(track) {
  const n = track.count;
  const verts = new Float32Array(n * 2 * 3);
  const cols = new Float32Array(n * 2 * 3);
  const idx = [];

  const road = colr(PALETTE.road);
  const roadDark = colr(PALETTE.roadDark);
  const c = new THREE.Color();

  for (let i = 0; i < n; i++) {
    const hw = track.halfWidth[i];
    for (let side = 0; side < 2; side++) {
      const d = (side === 0 ? -1 : 1) * hw;
      const o = (i * 2 + side) * 3;
      verts[o] = track.px[i] + track.rx[i] * d;
      verts[o + 1] = track.py[i] + track.ry[i] * d + 0.02;
      verts[o + 2] = track.pz[i] + track.rz[i] * d;

      /* subtle wear: darker toward the middle where the line runs */
      const wear = 0.5 + 0.5 * Math.abs(side === 0 ? -1 : 1);
      c.copy(roadDark).lerp(road, 0.55 + wear * 0.25 + noise2(verts[o], verts[o + 2]) * 0.22);
      cols[o] = c.r; cols[o + 1] = c.g; cols[o + 2] = c.b;
    }
  }

  /* Winding matters and is easy to get backwards here. `right` is
     cross(tangent, worldUp), so for a road running toward -Z the right
     edge is +X and the NEXT segment is at -Z. Wound the other way the
     road's normals point at the ground and the entire ribbon is
     back-face culled — which is exactly what happened: the circuit
     rendered with kerbs and a start line and no road between them. */
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = i * 2, b = i * 2 + 1, d = j * 2, e = j * 2 + 1;
    idx.push(a, b, d, b, e, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  /* Double-sided as insurance: a kart that falls off the island looks
     back up at the underside of the road on the way down. */
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.94, metalness: 0.015,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'road';
  return mesh;
}

/* ------------------------------------------------------------------
   Surface language. A broad rubbered-in groove shows where eight karts
   have been braking, while the broken accent ribbon communicates the
   quick line at racing speed. Both are batched meshes built once.
   ------------------------------------------------------------------ */
function buildSurfaceDetail(track, info) {
  const group = new THREE.Group();
  const offsets = new Float32Array(track.count);
  for (let i = 0; i < track.count; i++) {
    const before = (i - 16 + track.count) % track.count;
    const after = (i + 20) % track.count;
    const curve = track.curvature[i] * 0.55 + track.curvature[after] * 0.3 + track.curvature[before] * 0.15;
    offsets[i] = Math.max(-0.58, Math.min(0.58, curve * 78));
  }
  group.add(makeRoadRibbon(track, offsets, 3.4, 0.036, 0x17151d, 0.28, null, 'rubbered-line'));
  group.add(makeRoadRibbon(track, offsets, 0.34, 0.058, info.theme.accent, 0.84,
    (s) => s % 15 < 8.2, 'racing-line'));

  /* short, offset repair patches break up the single-value road without
     spending a texture sample or another object per patch */
  const patches = new Float32Array(track.count);
  for (let i = 0; i < track.count; i++) patches[i] = Math.sin(track.s[i] * 0.031) * 0.3;
  group.add(makeRoadRibbon(track, patches, 1.7, 0.031, 0x25232b, 0.22,
    (s) => s % 73 > 58, 'road-patches'));
  group.name = 'surfaceDetail';
  return group;
}

function makeRoadRibbon(track, offsets, width, lift, color, opacity, keep, name) {
  const verts = [], idx = [];
  let v = 0;
  const push = (i, d) => {
    verts.push(
      track.px[i] + track.rx[i] * d + track.nx[i] * lift,
      track.py[i] + track.ry[i] * d + track.ny[i] * lift,
      track.pz[i] + track.rz[i] * d + track.nz[i] * lift);
  };
  for (let i = 0; i < track.count; i++) {
    const j = (i + 1) % track.count;
    if (keep && (!keep(track.s[i]) || !keep(track.s[j]))) continue;
    const di = offsets[i] * track.halfWidth[i], dj = offsets[j] * track.halfWidth[j];
    push(i, di - width * 0.5); push(i, di + width * 0.5);
    push(j, dj - width * 0.5); push(j, dj + width * 0.5);
    idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); v += 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
  }));
  mesh.name = name;
  mesh.renderOrder = 2;
  return mesh;
}

/* Road → kerb → rough shoulder → island is a deliberate value ladder.
   The previous shell left the shoulder to whichever island face happened
   to show through, so the safe edge dissolved on narrow screens. */
function buildVerge(track, info) {
  const verts = [], cols = [], idx = [];
  const grass = colr(PALETTE.grass), dark = colr(PALETTE.grassDark);
  const soil = colr(track.theme === 'dusk' ? 0x6d526d : (track.theme === 'noon' ? 0x887a4f : 0x71804e));
  const c = new THREE.Color();
  let v = 0;
  for (let side = 0; side < 2; side++) {
    const sign = side ? 1 : -1;
    for (let i = 0; i < track.count; i++) {
      const j = (i + 1) % track.count;
      const add = (k, d, outer) => {
        const x = track.px[k] + track.rx[k] * d;
        const z = track.pz[k] + track.rz[k] * d;
        verts.push(x, track.py[k] + track.ry[k] * d + 0.018 - (outer ? 0.22 : 0), z);
        c.copy(outer ? dark : soil).lerp(grass, outer ? 0.26 : 0.68 + noise2(x, z) * 0.18);
        cols.push(c.r, c.g, c.b);
      };
      add(i, sign * (track.halfWidth[i] + 1.38), false);
      add(i, sign * track.halfWidth[i] * VERGE, true);
      add(j, sign * (track.halfWidth[j] + 1.38), false);
      add(j, sign * track.halfWidth[j] * VERGE, true);
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); v += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, side: THREE.DoubleSide,
  }));
  mesh.name = 'verges'; mesh.receiveShadow = true;
  return mesh;
}

/* ------------------------------------------------------------------
   Kerbs: red/white banding along both road edges. They are the single
   most useful piece of art in a racing game — they tell you where the
   limit of the road is at a glance and at speed.
   ------------------------------------------------------------------ */
function buildKerbs(track) {
  const n = track.count;
  const verts = [];
  const cols = [];
  const idx = [];
  const a = colr(PALETTE.kerbA), b = colr(PALETTE.kerbB);
  const width = 1.4;
  let v = 0;

  for (let side = 0; side < 2; side++) {
    const sgn = side === 0 ? -1 : 1;
    const first = v;
    for (let i = 0; i < n; i++) {
      const hw = track.halfWidth[i];
      /* stripe every ~3.5m of arc */
      const stripe = (Math.floor(track.s[i] / 3.5) % 2 === 0) ? a : b;
      for (let k = 0; k < 2; k++) {
        const d = sgn * (hw + k * width);
        verts.push(
          track.px[i] + track.rx[i] * d,
          track.py[i] + track.ry[i] * d + 0.05,
          track.pz[i] + track.rz[i] * d);
        cols.push(stripe.r, stripe.g, stripe.b);
        v++;
      }
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const p0 = first + i * 2, p1 = first + i * 2 + 1;
      const q0 = first + j * 2, q1 = first + j * 2 + 1;
      if (sgn < 0) idx.push(p0, q0, p1, p1, q0, q1);
      else idx.push(p0, p1, q0, p1, q1, q0);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    vertexColors: true, side: THREE.DoubleSide,
  }));
  mesh.receiveShadow = true;
  mesh.name = 'kerbs';
  return mesh;
}

/* ------------------------------------------------------------------
   The island.

   The circuit is authored star-shaped about the origin (see tracks.js),
   which is what makes this tractable: the inner half can be a simple
   radial fan from the middle out to the road, with no triangulation
   needed and no risk of self-overlap.
   ------------------------------------------------------------------ */
function buildIsland(track) {
  const n = track.count;
  const verts = [];
  const cols = [];
  const idx = [];

  const grass = colr(PALETTE.grass);
  const grassDark = colr(PALETTE.grassDark);
  const rock = colr(PALETTE.rock);
  const rockDark = colr(PALETTE.rockDark);
  const c = new THREE.Color();

  /* which side of the road faces the middle of the island */
  let innerSign = 0;
  for (let i = 0; i < n; i += 16) {
    const dot = track.rx[i] * track.px[i] + track.rz[i] * track.pz[i];
    innerSign += dot > 0 ? -1 : 1;
  }
  innerSign = innerSign >= 0 ? 1 : -1;

  /* the island's middle: the average of the road, dropped a little so
     the interior dishes gently rather than reading as a flat table */
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += track.px[i]; cy += track.py[i]; cz += track.pz[i]; }
  cx /= n; cy = cy / n - 6; cz /= n;

  const push = (x, y, z, col) => {
    verts.push(x, y, z);
    cols.push(col.r, col.g, col.b);
    return verts.length / 3 - 1;
  };

  /* ---- 1. inner fan: island middle out to the inner road edge ---- */
  const centreIdx = push(cx, cy, cz, grassDark);
  const innerRing = [];
  for (let i = 0; i < n; i++) {
    const d = innerSign * (track.halfWidth[i] + 0.3);
    innerRing.push(push(
      track.px[i] + track.rx[i] * d,
      track.py[i] + track.ry[i] * d,
      track.pz[i] + track.rz[i] * d,
      grass));
  }
  /* intermediate rings so the interior is lit, not one giant fan */
  let prevRing = innerRing;
  for (let r = ISLAND_RINGS - 1; r >= 1; r--) {
    const f = r / ISLAND_RINGS;
    const ring = [];
    for (let i = 0; i < n; i++) {
      const d = innerSign * (track.halfWidth[i] + 0.3);
      const ex = track.px[i] + track.rx[i] * d;
      const ey = track.py[i] + track.ry[i] * d;
      const ez = track.pz[i] + track.rz[i] * d;
      const x = cx + (ex - cx) * f;
      const z = cz + (ez - cz) * f;
      const y = cy + (ey - cy) * f + noise2(x, z) * 5 * (1 - f);
      c.copy(grassDark).lerp(grass, f * 0.8 + 0.1);
      ring.push(push(x, y, z, c));
    }
    stitch(idx, ring, prevRing, n, innerSign > 0);
    prevRing = ring;
  }
  /* cap the very middle */
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (innerSign > 0) idx.push(centreIdx, prevRing[j], prevRing[i]);
    else idx.push(centreIdx, prevRing[i], prevRing[j]);
  }

  /* ---- 2. outer apron: outer road edge -> verge -> rim ---- */
  const outSign = -innerSign;
  const edgeRing = [], vergeRing = [], rimRing = [];
  for (let i = 0; i < n; i++) {
    const hw = track.halfWidth[i];
    const mk = (dist, drop, col) => {
      const d = outSign * dist;
      const x = track.px[i] + track.rx[i] * d;
      const y = track.py[i] + track.ry[i] * d - drop;
      const z = track.pz[i] + track.rz[i] * d;
      return push(x, y + noise2(x, z) * drop * 0.5, z, col);
    };
    edgeRing.push(mk(hw + 0.3, 0, grass));
    vergeRing.push(mk(hw * VERGE, 0.4, grassDark));
    c.copy(grassDark).lerp(rock, 0.55);
    rimRing.push(mk(hw * VERGE + APRON, RIM_DROP, c));
  }
  stitch(idx, edgeRing, vergeRing, n, outSign < 0);
  stitch(idx, vergeRing, rimRing, n, outSign < 0);

  /* ---- 3. the keel: the rim falling away to a point below ---- */
  let prev = rimRing;
  const KEEL_RINGS = 4;
  for (let r = 1; r <= KEEL_RINGS; r++) {
    const f = r / KEEL_RINGS;
    const ring = [];
    for (let i = 0; i < n; i++) {
      const hw = track.halfWidth[i];
      const shrink = 1 - f * f * 0.82;
      const d = outSign * (hw * VERGE + APRON) * shrink;
      const x = cx + (track.px[i] + track.rx[i] * d - cx) * shrink;
      const z = cz + (track.pz[i] + track.rz[i] * d - cz) * shrink;
      /* noise scaled down with depth AND with ring index: the first
         cut used a flat 14m amplitude on rings that are only a few metres
         apart near the rim, which turned the underside into needles */
      const rough = 9 * (1 - f) * (1 - f);
      const y = track.py[i] - RIM_DROP - KEEL * f * f + noise2(x * 1.7, z * 1.7) * rough;
      c.copy(rock).lerp(rockDark, f * 0.9);
      ring.push(push(x, y, z, c));
    }
    stitch(idx, prev, ring, n, outSign < 0);
    prev = ring;
  }
  /* close the keel to a single point */
  const tipIdx = push(cx, cy - RIM_DROP - KEEL * 1.16, cz, rockDark);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (outSign < 0) idx.push(tipIdx, prev[i], prev[j]);
    else idx.push(tipIdx, prev[j], prev[i]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  /* Double-sided on purpose. A floating island is seen from above while
     racing and from below while falling off it, and a one-sided island
     vanishes from underneath. It also makes the mesh immune to a winding
     mistake in any one of the six ring stitches below — the first cut had
     the interior wound backwards, so the whole middle of the circuit was
     invisible and what showed through was the rock underside. */
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    vertexColors: true, flatShading: true, side: THREE.DoubleSide,
  }));
  mesh.receiveShadow = true;
  mesh.name = 'island';
  return mesh;
}

/* Two parallel rings of n vertices -> a quad strip between them. */
function stitch(idx, ringA, ringB, n, flip) {
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = ringA[i], b = ringA[j], c = ringB[i], d = ringB[j];
    if (flip) idx.push(a, c, b, b, c, d);
    else idx.push(a, b, c, b, d, c);
  }
}

/* ------------------------------------------------------------------
   Four landmark waterfalls per island. The broad translucent sheet, pale
   core and instanced mist layer create depth from racing distance. They
   are static geometry: no shader clock and no frame-loop allocation.
   ------------------------------------------------------------------ */
function buildWaterfalls(track, info) {
  const group = new THREE.Group();
  const fractions = track.id === 'thermal-spire' ? [0.10, 0.38, 0.64, 0.84]
    : (track.id === 'cirrus-run' ? [0.16, 0.44, 0.69, 0.90] : [0.12, 0.34, 0.61, 0.82]);
  group.add(makeFalls(track, info, fractions, 1, info.theme.water, 0.66));
  group.add(makeFalls(track, info, fractions, 0.42, 0xe3ffff, 0.76));

  const mist = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 5),
    new THREE.MeshBasicMaterial({ color: 0xe5ffff, transparent: true, opacity: 0.46, depthWrite: false }),
    fractions.length * 5);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  let instance = 0;
  for (let f = 0; f < fractions.length; f++) {
    const i = Math.floor(track.count * fractions[f]) % track.count;
    const rim = track.halfWidth[i] * VERGE + APRON;
    for (let j = 0; j < 5; j++) {
      const d = info.outerSign * (rim + 3 + seeded(j, i) * 5);
      const along = (j - 2) * 2.2;
      const p = new THREE.Vector3(
        track.px[i] + track.rx[i] * d + track.tx[i] * along,
        track.py[i] + track.ry[i] * d - 69 - seeded(j, i + 2) * 9,
        track.pz[i] + track.rz[i] * d + track.tz[i] * along);
      sc.set(3.2 + seeded(j, i + 3) * 3.5, 1.1 + seeded(j, i + 4), 2.5 + seeded(j, i + 5) * 2.8);
      m.compose(p, q, sc); mist.setMatrixAt(instance++, m);
    }
  }
  mist.instanceMatrix.needsUpdate = true;
  mist.name = 'waterfallMist'; group.add(mist);
  group.name = 'waterfalls';
  return group;
}

function makeFalls(track, info, fractions, widthScale, color, opacity) {
  const verts = [], cols = [], idx = [];
  const top = colr(0xf4ffff), bottom = colr(color), c = new THREE.Color();
  let v = 0;
  for (let f = 0; f < fractions.length; f++) {
    const i = Math.floor(track.count * fractions[f]) % track.count;
    const d = info.outerSign * (track.halfWidth[i] * VERGE + APRON - 1);
    const x = track.px[i] + track.rx[i] * d;
    const y = track.py[i] + track.ry[i] * d - RIM_DROP + 1;
    const z = track.pz[i] + track.rz[i] * d;
    const width = (7.5 + seeded(i, 31) * 4.5) * widthScale;
    const fall = 68 + seeded(i, 32) * 22;
    for (let row = 0; row <= 7; row++) {
      const t = row / 7, bow = Math.sin(t * Math.PI) * 5 * info.outerSign;
      const taper = 1 - t * 0.28;
      c.copy(top).lerp(bottom, 0.25 + t * 0.75);
      for (let side = -1; side <= 1; side += 2) {
        verts.push(x + track.tx[i] * side * width * taper + track.rx[i] * bow,
          y - fall * t,
          z + track.tz[i] * side * width * taper + track.rz[i] * bow);
        cols.push(c.r, c.g, c.b);
      }
      if (row < 7) { idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); v += 2; }
    }
    v += 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
  }));
  mesh.name = widthScale < 0.5 ? 'waterfallCore' : 'waterfallSheet';
  mesh.renderOrder = 1;
  return mesh;
}

/* ------------------------------------------------------------------
   Theme identity and depth staging. A unique central silhouette anchors
   each circuit; instanced growth and small satellite islands layer the
   road edge against the sky without creating a draw-call forest.
   ------------------------------------------------------------------ */
function buildScenery(track, info) {
  const group = new THREE.Group();
  group.add(buildLandmark(track, info));
  group.add(buildGrowth(track, info));
  group.add(buildSatelliteIslands(track, info));
  group.name = 'scenery';
  return group;
}

function buildLandmark(track, info) {
  const group = new THREE.Group();
  group.position.set(info.cx, info.cy + 0.5, info.cz);
  group.name = 'landmark-' + track.id;
  const stone = new THREE.MeshStandardMaterial({ color: 0x574b52, roughness: 0.9 });
  const accent = new THREE.MeshStandardMaterial({
    color: info.theme.accent, emissive: info.theme.accent, emissiveIntensity: 0.9,
    roughness: 0.3, metalness: 0.18,
  });
  const trim = new THREE.MeshStandardMaterial({ color: info.theme.trim, roughness: 0.5, metalness: 0.3 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(15, 21, 6, 10), stone);
  base.position.y = 3; base.castShadow = true; group.add(base);

  if (track.id === 'gullwing-bay') {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 7.2, 35, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8ded1, roughness: 0.8 }));
    tower.position.y = 23.5; tower.castShadow = true; group.add(tower);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 5.5, 6.5, 10), trim);
    stripe.position.y = 21; group.add(stripe);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 5, 12), accent);
    lamp.position.y = 43; group.add(lamp);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 6, 12), stone);
    roof.position.y = 48.5; group.add(roof);
  } else if (track.id === 'thermal-spire') {
    const shards = [[-6, 7, 48], [7, 5, 35], [1, 4, 29], [-10, 3.5, 24]];
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(s[1], s[2], 5), i ? trim : accent);
      crystal.position.set(s[0], 6 + s[2] * 0.5, (i - 1.5) * 4);
      crystal.rotation.z = (i - 1.5) * 0.07; crystal.castShadow = true; group.add(crystal);
    }
  } else {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 5.5, 43, 9), stone);
    mast.position.y = 27.5; mast.castShadow = true; group.add(mast);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(4.5, 10, 7), accent);
    hub.position.set(0, 44, 2); group.add(hub);
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2.2, 19, 0.8), trim);
      blade.position.set(Math.sin(i * Math.PI * 0.4) * 10, 44 + Math.cos(i * Math.PI * 0.4) * 10, 2);
      blade.rotation.z = -i * Math.PI * 0.4; group.add(blade);
    }
  }
  return group;
}

function buildGrowth(track, info) {
  const group = new THREE.Group();
  const count = 48;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.65, 0.95, 4.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x614535, roughness: 1 }), count);
  const crownGeo = track.theme === 'dusk' ? new THREE.ConeGeometry(3.2, 9, 6)
    : (track.theme === 'noon' ? new THREE.DodecahedronGeometry(3.6, 0) : new THREE.ConeGeometry(4.2, 8, 7));
  const crown = new THREE.InstancedMesh(crownGeo,
    new THREE.MeshStandardMaterial({ color: info.theme.foliage, roughness: 0.95, flatShading: true }), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let j = 0; j < count; j++) {
    const i = Math.floor((j + 0.35) * track.count / count) % track.count;
    const sign = j & 1 ? info.innerSign : info.outerSign;
    const d = sign * (track.halfWidth[i] + 8 + seeded(j, 42) * 17);
    const x = track.px[i] + track.rx[i] * d + track.tx[i] * (seeded(j, 43) - 0.5) * 8;
    const y = track.py[i] + track.ry[i] * d;
    const z = track.pz[i] + track.rz[i] * d + track.tz[i] * (seeded(j, 43) - 0.5) * 8;
    const size = 0.7 + seeded(j, 44) * 0.72;
    q.setFromAxisAngle(up, seeded(j, 45) * Math.PI * 2);
    sc.set(size, size, size); p.set(x, y + 2.25 * size, z); m.compose(p, q, sc); trunk.setMatrixAt(j, m);
    p.y = y + (track.theme === 'dusk' ? 7 : 6.2) * size;
    sc.set(size * (0.85 + seeded(j, 46) * 0.35), size, size * (0.85 + seeded(j, 47) * 0.35));
    m.compose(p, q, sc); crown.setMatrixAt(j, m);
  }
  trunk.instanceMatrix.needsUpdate = true; crown.instanceMatrix.needsUpdate = true;
  trunk.castShadow = true; crown.castShadow = true;
  group.add(trunk, crown); group.name = 'tracksideGrowth';
  return group;
}

function buildSatelliteIslands(track, info) {
  const count = 12, group = new THREE.Group();
  const rocks = new THREE.InstancedMesh(new THREE.ConeGeometry(6, 18, 7),
    new THREE.MeshStandardMaterial({ color: PALETTE.rockDark, roughness: 1, flatShading: true }), count);
  const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(5.8, 6.3, 1.2, 7),
    new THREE.MeshStandardMaterial({ color: info.theme.foliage, roughness: 1, flatShading: true }), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let j = 0; j < count; j++) {
    const i = Math.floor((j + 0.6) * track.count / count) % track.count;
    const d = info.outerSign * (track.halfWidth[i] * VERGE + APRON + 28 + seeded(j, 71) * 38);
    const x = track.px[i] + track.rx[i] * d + track.tx[i] * (seeded(j, 72) - 0.5) * 24;
    const y = track.py[i] - 18 - seeded(j, 73) * 33;
    const z = track.pz[i] + track.rz[i] * d + track.tz[i] * (seeded(j, 72) - 0.5) * 24;
    const size = 0.65 + seeded(j, 74);
    q.setFromAxisAngle(up, seeded(j, 75) * Math.PI * 2); sc.set(size, size, size);
    p.set(x, y - 8 * size, z); m.compose(p, q, sc); rocks.setMatrixAt(j, m);
    p.y = y + 0.5; m.compose(p, q, sc); caps.setMatrixAt(j, m);
  }
  rocks.instanceMatrix.needsUpdate = true; caps.instanceMatrix.needsUpdate = true;
  group.add(rocks, caps); group.name = 'satelliteIslands';
  return group;
}

/* ------------------------------------------------------------------
   Start/finish line — the one piece of the circuit a player has to be
   able to find instantly.
   ------------------------------------------------------------------ */
function buildStartLine(track, info) {
  const group = new THREE.Group();
  const frame = ZC.Track.frameAt(track, 0, {});
  const hw = frame.halfWidth;

  const geo = new THREE.PlaneGeometry(hw * 2, 4, 1, 1);
  const canvasTex = makeCheckerTexture();
  const mat = new THREE.MeshLambertMaterial({ map: canvasTex, transparent: false });
  const line = new THREE.Mesh(geo, mat);
  line.position.set(frame.x, frame.y + 0.06, frame.z);
  line.rotation.order = 'YXZ';
  line.rotation.y = Math.atan2(frame.tx, frame.tz);
  line.rotation.x = -Math.PI / 2;
  group.add(line);

  const gate = new THREE.Group();
  gate.position.set(frame.x, frame.y, frame.z);
  gate.rotation.y = Math.atan2(frame.tx, frame.tz);
  const dark = new THREE.MeshStandardMaterial({ color: 0x292836, roughness: 0.56, metalness: 0.4 });
  const glow = new THREE.MeshStandardMaterial({
    color: info.theme.accent, emissive: info.theme.accent, emissiveIntensity: 0.8,
    roughness: 0.3, metalness: 0.25,
  });
  for (let side = -1; side <= 1; side += 2) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.05, 8, 1.05), dark);
    pillar.position.set(side * (hw + 1.7), 4, 0); pillar.castShadow = true; gate.add(pillar);
    const wing = new THREE.Mesh(new THREE.ConeGeometry(2.5, 7.5, 3), glow);
    wing.position.set(side * (hw + 1.7), 9, 0); wing.rotation.z = side * 0.52; gate.add(wing);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 5.4, 0.8, 0.9), dark);
  beam.position.y = 8.1; gate.add(beam);
  const crest = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.42, 6, 24, Math.PI), glow);
  crest.position.y = 8.1; crest.rotation.z = Math.PI; gate.add(crest);
  group.add(gate);
  group.name = 'startLine';
  return group;
}

/* Procedurally drawn, like every other pixel in the game — nothing is
   fetched at runtime. */
function makeCheckerTexture() {
  const size = 128, squares = 8;
  const cv = document.createElement('canvas');
  cv.width = size * 4; cv.height = size;
  const ctx = cv.getContext('2d');
  const cw = cv.width / (squares * 4), ch = cv.height / 2;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < squares * 4; x++) {
      ctx.fillStyle = ((x + y) % 2 === 0) ? '#f6f0e2' : '#20202a';
      ctx.fillRect(x * cw, y * ch, cw, ch);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
