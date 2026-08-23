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
  group.add(buildAsphaltBreakup(track));
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

  /* A neutral graphite reads as asphalt after the warm sky grade. The old
     PALETTE.road value was dark enough that the racing line and kerbs did all
     the material work by themselves. */
  const road = colr(0x4d4a54);
  const roadDark = colr(0x302f38);
  const c = new THREE.Color();

  for (let i = 0; i < n; i++) {
    const hw = track.halfWidth[i];
    for (let side = 0; side < 2; side++) {
      const d = (side === 0 ? -1 : 1) * hw;
      const o = (i * 2 + side) * 3;
      verts[o] = track.px[i] + track.rx[i] * d;
      verts[o + 1] = track.py[i] + track.ry[i] * d + 0.02;
      verts[o + 2] = track.pz[i] + track.rz[i] * d;

      /* Subtle longitudinal aggregate variation. The larger breakup pass
         below carries the readable slabs, while this keeps the base from
         becoming one flat value between them. */
      const edge = side === 0 ? 0.045 : 0.075;
      c.copy(roadDark).lerp(road, 0.68 + edge + noise2(verts[o], verts[o + 2]) * 0.16);
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
   Asphalt breakup. A road at this scale needs broad value changes as well
   as the racing line: shallow irregular slabs, brake repairs and aggregate
   edges give the player a material to read without a texture fetch.
   ------------------------------------------------------------------ */
function buildAsphaltBreakup(track) {
  const verts = [], cols = [], idx = [];
  const base = colr(0x4d4a54);
  const dark = colr(0x25242d);
  const light = colr(0x68636d);
  const c = new THREE.Color();
  let v = 0;

  const push = (i, d, lift, color) => {
    const o = verts.length;
    verts.push(
      track.px[i] + track.rx[i] * d + track.nx[i] * lift,
      track.py[i] + track.ry[i] * d + track.ny[i] * lift,
      track.pz[i] + track.rz[i] * d + track.nz[i] * lift);
    cols.push(color.r, color.g, color.b);
    return o / 3;
  };

  /* Place a patch roughly every 10m, with deliberately uneven spacing and
     length. A patch can cross a corner, but never crosses the road edge. */
  const stride = 7;
  for (let i = 0; i < track.count; i += stride) {
    if (seeded(i, 201) < 0.23) continue;
    const j = (i + 2 + Math.floor(seeded(i, 202) * 5)) % track.count;
    const hw0 = track.halfWidth[i], hw1 = track.halfWidth[j];
    const centre = (seeded(i, 203) - 0.5) * 0.95;
    const width = 1.2 + seeded(i, 204) * 3.6;
    const half = width * 0.5;
    const d0 = Math.max(-hw0 + 0.7, Math.min(hw0 - 0.7, centre * hw0));
    const d1 = Math.max(-hw1 + 0.7, Math.min(hw1 - 0.7, centre * hw1));
    const palette = seeded(i, 205);
    c.copy(base).lerp(palette < 0.42 ? dark : light, 0.15 + seeded(i, 206) * 0.2);
    const a = push(i, d0 - half, 0.065, c);
    const b = push(i, d0 + half, 0.065, c);
    const c0 = c.clone().lerp(base, 0.16 + seeded(i, 207) * 0.12);
    const d = push(j, d1 - half * (0.82 + seeded(i, 208) * 0.25), 0.065, c0);
    const e = push(j, d1 + half * (0.82 + seeded(i, 209) * 0.25), 0.065, c0);
    idx.push(a, b, d, b, e, d);
    v += 4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.98, metalness: 0, side: THREE.DoubleSide,
  }));
  mesh.receiveShadow = true;
  mesh.name = 'asphaltBreakup';
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

/* Road → kerb → compacted shoulder → groundcover → island is a deliberate
   value and material ladder. Keeping the shoulder and groundcover as separate
   strips makes the safe edge legible even when the camera is low and moving. */
function buildVerge(track, info) {
  const group = new THREE.Group();
  const shoulder = track.theme === 'dusk' ? 0x655964
    : (track.theme === 'noon' ? 0x8e8568 : 0x887565);
  const shoulderDark = track.theme === 'dusk' ? 0x4b414e
    : (track.theme === 'noon' ? 0x6d654f : 0x66594d);
  group.add(makeVergeStrip(track, info, 'shoulder', 1.38, 4.45,
    shoulder, shoulderDark, 0.02, 0.07));
  group.add(makeVergeStrip(track, info, 'groundcover', 4.45, VERGE,
    PALETTE.grass, PALETTE.grassDark, -0.01, 0.22));
  group.add(buildGroundcover(track, info));
  group.name = 'verges';
  return group;
}

function makeVergeStrip(track, info, name, innerExtra, outerDistance,
  baseHex, darkHex, lift, outerDrop) {
  const verts = [], cols = [], idx = [];
  const base = colr(baseHex), dark = colr(darkHex), c = new THREE.Color();
  let v = 0;
  for (let side = 0; side < 2; side++) {
    const sign = side ? 1 : -1;
    for (let i = 0; i < track.count; i++) {
      const j = (i + 1) % track.count;
      const add = (k, d, outer) => {
        const x = track.px[k] + track.rx[k] * d;
        const z = track.pz[k] + track.rz[k] * d;
        verts.push(x, track.py[k] + track.ry[k] * d + lift - (outer ? outerDrop : 0), z);
        const variation = noise2(x * 1.3, z * 1.3);
        c.copy(outer ? dark : base).lerp(outer ? base : dark,
          outer ? 0.18 + variation * 0.12 : 0.1 + variation * 0.08);
        cols.push(c.r, c.g, c.b);
      };
      const inner0 = track.halfWidth[i] + innerExtra;
      const inner1 = track.halfWidth[j] + innerExtra;
      const outer0 = name === 'groundcover' ? track.halfWidth[i] * outerDistance : track.halfWidth[i] + outerDistance;
      const outer1 = name === 'groundcover' ? track.halfWidth[j] * outerDistance : track.halfWidth[j] + outerDistance;
      add(i, sign * inner0, false); add(i, sign * outer0, true);
      add(j, sign * inner1, false); add(j, sign * outer1, true);
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); v += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: name === 'shoulder' ? 0.92 : 1, side: THREE.DoubleSide,
  }));
  mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

/* Low groundcover is clustered rather than evenly painted around the loop.
   It gives the shoulder's outer edge a soft, readable transition into the
   larger trees and landmarks without adding one object per tuft. */
function buildGroundcover(track, info) {
  const group = new THREE.Group();
  const clusters = 14, perCluster = 6;
  const tuftCount = clusters * perCluster;
  const rockCount = clusters * 2;
  const tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.42, 1.15, 5),
    new THREE.MeshStandardMaterial({ color: info.theme.foliage, roughness: 1, flatShading: true }), tuftCount);
  const rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.72, 0),
    new THREE.MeshStandardMaterial({ color: 0x65584e, roughness: 1, flatShading: true }), rockCount);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const sc = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let tuftIndex = 0, rockIndex = 0;
  for (let cluster = 0; cluster < clusters; cluster++) {
    const base = Math.floor(((cluster + 0.25 + seeded(cluster, 301) * 0.42) / clusters) * track.count);
    const sign = (cluster & 1) ? info.outerSign : info.innerSign;
    for (let j = 0; j < perCluster; j++) {
      const salt = cluster * 17 + j;
      const i = (base + Math.floor((seeded(salt, 302) - 0.5) * 13) + track.count) % track.count;
      const coverWidth = Math.max(1.2, track.halfWidth[i] * VERGE - track.halfWidth[i] - 4.7);
      const d = sign * (track.halfWidth[i] + 4.7 + seeded(salt, 303) * coverWidth);
      const x = track.px[i] + track.rx[i] * d + track.tx[i] * (seeded(salt, 304) - 0.5) * 3.5;
      const y = track.py[i] + track.ry[i] * d;
      const z = track.pz[i] + track.rz[i] * d + track.tz[i] * (seeded(salt, 304) - 0.5) * 3.5;
      const size = 0.56 + seeded(salt, 305) * 0.86;
      q.setFromAxisAngle(up, seeded(salt, 306) * Math.PI * 2);
      sc.set(size * (0.72 + seeded(salt, 307) * 0.42), size, size * (0.72 + seeded(salt, 308) * 0.42));
      p.set(x, y + 0.45 * size, z); m.compose(p, q, sc); tuft.setMatrixAt(tuftIndex++, m);
    }
    for (let j = 0; j < 2; j++) {
      const salt = cluster * 23 + j;
      const i = (base + Math.floor((seeded(salt, 309) - 0.5) * 11) + track.count) % track.count;
      const d = sign * (track.halfWidth[i] + 5.0 + seeded(salt, 310) * 7.5);
      const x = track.px[i] + track.rx[i] * d + track.tx[i] * (seeded(salt, 311) - 0.5) * 4;
      const y = track.py[i] + track.ry[i] * d;
      const z = track.pz[i] + track.rz[i] * d + track.tz[i] * (seeded(salt, 311) - 0.5) * 4;
      const size = 0.52 + seeded(salt, 312) * 0.75;
      q.setFromAxisAngle(up, seeded(salt, 313) * Math.PI * 2);
      sc.set(size * 1.35, size * 0.72, size); p.set(x, y + size * 0.35, z);
      m.compose(p, q, sc); rock.setMatrixAt(rockIndex++, m);
    }
  }
  tuft.instanceMatrix.needsUpdate = true; rock.instanceMatrix.needsUpdate = true;
  tuft.castShadow = true; rock.castShadow = true;
  group.add(tuft, rock); group.name = 'groundcoverClusters';
  return group;
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
   Waterfalls. Four background falls establish the island scale, while one
   oversized fall sits on a mandatory racing section as a chase-camera hero
   vista. Its chute, wet contact, foaming lip and plunge basin make it read as
   a place in the island instead of a decal hanging in the sky.
   ------------------------------------------------------------------ */
function buildWaterfalls(track, info) {
  const group = new THREE.Group();
  const fractions = track.id === 'thermal-spire' ? [0.10, 0.38, 0.64, 0.84]
    : (track.id === 'cirrus-run' ? [0.16, 0.44, 0.69, 0.90] : [0.12, 0.34, 0.61, 0.82]);
  const heroFraction = track.id === 'thermal-spire' ? 0.27
    : (track.id === 'cirrus-run' ? 0.25 : 0.28);
  group.add(makeFalls(track, info, fractions, 1, info.theme.water, 0.66));
  group.add(makeFalls(track, info, fractions, 0.42, 0xe3ffff, 0.76));
  group.add(makeFalls(track, info, [heroFraction], 1.55, info.theme.water, 0.78, 'heroWaterfallSheet'));
  group.add(makeFalls(track, info, [heroFraction], 0.62, 0xf0ffff, 0.88, 'heroWaterfallCore'));
  group.add(makeFalls(track, info, [heroFraction], 0.16, 0xffffff, 0.94, 'heroWhitewater'));
  group.add(buildWaterfallFeatures(track, info, heroFraction));

  const mistFractions = fractions.concat([heroFraction]);
  const mist = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 5),
    new THREE.MeshBasicMaterial({ color: 0xe5ffff, transparent: true, opacity: 0.46, depthWrite: false }),
    mistFractions.length * 5 + 4);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  let instance = 0;
  for (let f = 0; f < mistFractions.length; f++) {
    const i = Math.floor(track.count * mistFractions[f]) % track.count;
    const hero = f === mistFractions.length - 1;
    const mistPerFall = hero ? 9 : 5;
    const rim = track.halfWidth[i] * VERGE + APRON;
    for (let j = 0; j < mistPerFall; j++) {
      const d = info.outerSign * (rim + 3 + seeded(j, i) * (hero ? 7 : 5));
      const along = (j - 2) * 2.2;
      const p = new THREE.Vector3(
        track.px[i] + track.rx[i] * d + track.tx[i] * along,
        track.py[i] + track.ry[i] * d - (hero ? 75 : 69) - seeded(j, i + 2) * (hero ? 12 : 9),
        track.pz[i] + track.rz[i] * d + track.tz[i] * along);
      sc.set((hero ? 4.2 : 3.2) + seeded(j, i + 3) * (hero ? 4.5 : 3.5),
        1.1 + seeded(j, i + 4) * (hero ? 1.4 : 1),
        2.5 + seeded(j, i + 5) * (hero ? 3.8 : 2.8));
      m.compose(p, q, sc); mist.setMatrixAt(instance++, m);
    }
  }
  mist.instanceMatrix.needsUpdate = true;
  mist.name = 'waterfallMist'; group.add(mist);
  group.name = 'waterfalls';
  return group;
}

function makeFalls(track, info, fractions, widthScale, color, opacity, explicitName) {
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
  mesh.name = explicitName || (widthScale < 0.5 ? 'waterfallCore' : 'waterfallSheet');
  mesh.renderOrder = 1;
  return mesh;
}

function buildWaterfallFeatures(track, info, fraction) {
  const group = new THREE.Group();
  const i = Math.floor(track.count * fraction) % track.count;
  const hw = track.halfWidth[i];
  const startD = info.outerSign * (hw + 4.45);
  const lipD = info.outerSign * (hw * VERGE + APRON - 1);
  const topY = track.py[i] + track.ry[i] * lipD - RIM_DROP + 1;
  const fall = 68 + seeded(i, 32) * 22;
  const yaw = Math.atan2(track.tx[i], track.tz[i]);

  group.add(makeRockChannel(track, info, i, startD, lipD));
  group.add(makeWetChannel(track, info, i, startD, lipD));

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x4b4140, roughness: 0.96, flatShading: true,
  });
  const wetMat = new THREE.MeshStandardMaterial({
    color: info.theme.water, emissive: info.theme.water, emissiveIntensity: 0.12,
    roughness: 0.2, metalness: 0.05, transparent: true, opacity: 0.88,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xf4ffff, transparent: true, opacity: 0.88, depthWrite: false,
    side: THREE.DoubleSide,
  });

  const basinD = lipD + info.outerSign * 1.8;
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 10.8, 1.8, 9), rockMat);
  basin.position.set(
    track.px[i] + track.rx[i] * basinD,
    topY - 1.55,
    track.pz[i] + track.rz[i] * basinD);
  basin.rotation.y = yaw; basin.scale.set(1.1, 1, 0.78); basin.castShadow = true;
  basin.name = 'waterfallRockBasin'; group.add(basin);

  const pool = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 5.8, 0.22, 10), wetMat);
  pool.position.set(basin.position.x, topY - 0.68, basin.position.z);
  pool.rotation.y = yaw; pool.scale.set(1.35, 1, 0.78); pool.name = 'waterfallWetBasin'; group.add(pool);
  group.add(makeWhitewaterCrown(track, info, i, lipD, topY, foamMat));

  /* A low-poly ledge catches the eye at the end of the fall and prevents the
     stream from dissolving into fog. It is intentionally oversized only for
     the hero vista; the other falls remain distant scale dressing. */
  const plungeD = lipD + info.outerSign * 1.5;
  const plungeY = topY - fall - 1.8;
  const plunge = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), rockMat);
  plunge.position.set(
    track.px[i] + track.rx[i] * plungeD,
    plungeY,
    track.pz[i] + track.rz[i] * plungeD);
  plunge.rotation.y = yaw + 0.35; plunge.scale.set(6.8, 1.25, 4.4); plunge.castShadow = true;
  plunge.name = 'waterfallPlungeRock'; group.add(plunge);

  const plungePool = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.3, 0.3, 10), wetMat);
  plungePool.position.set(plunge.position.x, plungeY + 1.15, plunge.position.z);
  plungePool.rotation.y = yaw; plungePool.scale.set(1.45, 1, 0.82); group.add(plungePool);
  const foam = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.5, 5, 14), foamMat);
  foam.position.set(plunge.position.x, plungeY + 1.42, plunge.position.z);
  foam.rotation.y = yaw; foam.scale.set(1.48, 1, 0.82); foam.name = 'waterfallPlungeFoam'; group.add(foam);

  const boulderCount = 12;
  const boulders = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.25, 0), rockMat, boulderCount);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const sc = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let j = 0; j < boulderCount; j++) {
    const t = (j + 0.5) / boulderCount;
    const d = startD + (lipD - startD) * t;
    const side = j & 1 ? 1 : -1;
    const width = 3.9 + t * 3.1;
    const x = track.px[i] + track.rx[i] * d + track.tx[i] * side * width;
    const y = track.py[i] + track.ry[i] * d - 0.15 + seeded(j, 415) * 0.38;
    const z = track.pz[i] + track.rz[i] * d + track.tz[i] * side * width;
    const size = 0.62 + seeded(j, 416) * 0.82;
    q.setFromAxisAngle(up, seeded(j, 417) * Math.PI * 2);
    sc.set(size * 1.25, size * (0.8 + seeded(j, 418) * 0.5), size);
    p.set(x, y + size * 0.4, z); m.compose(p, q, sc); boulders.setMatrixAt(j, m);
  }
  boulders.instanceMatrix.needsUpdate = true; boulders.castShadow = true;
  boulders.name = 'waterfallChannelBoulders'; group.add(boulders);
  group.name = 'waterfallHeroVista';
  return group;
}

function makeRockChannel(track, info, i, startD, lipD) {
  const verts = [], cols = [], idx = [];
  const bands = [-1, -0.5, 0, 0.5, 1];
  const rings = [];
  const bank = colr(0x65534a), wetRock = colr(0x3e4b4e), c = new THREE.Color();
  const sections = 6;
  for (let r = 0; r < sections; r++) {
    const t = r / (sections - 1);
    const d = startD + (lipD - startD) * t;
    const width = 4.1 + t * 3.5;
    const baseY = track.py[i] + track.ry[i] * d - 0.14 - Math.sin(t * Math.PI) * 0.42;
    const ring = [];
    for (let k = 0; k < bands.length; k++) {
      const across = bands[k] * width;
      const wet = Math.abs(bands[k]) < 0.51;
      const x = track.px[i] + track.rx[i] * d + track.tx[i] * across;
      const z = track.pz[i] + track.rz[i] * d + track.tz[i] * across;
      const y = baseY + Math.abs(bands[k]) * 0.56 + noise2(x * 0.7, z * 0.7) * 0.07;
      c.copy(wet ? wetRock : bank).lerp(wet ? bank : wetRock, seeded(r * 7 + k, 419) * 0.15);
      verts.push(x, y, z); cols.push(c.r, c.g, c.b); ring.push(verts.length / 3 - 1);
    }
    rings.push(ring);
  }
  for (let r = 0; r < sections - 1; r++) stitch(idx, rings[r], rings[r + 1], bands.length, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.98, flatShading: true, side: THREE.DoubleSide,
  }));
  mesh.receiveShadow = true; mesh.name = 'waterfallRockChannel';
  return mesh;
}

function makeWetChannel(track, info, i, startD, lipD) {
  const verts = [], idx = [];
  const sections = 6, width = 0.95;
  for (let r = 0; r < sections; r++) {
    const t = r / (sections - 1);
    const d = startD + (lipD - startD) * t;
    const y = track.py[i] + track.ry[i] * d + 0.02 - Math.sin(t * Math.PI) * 0.18;
    const w = width + t * 0.35;
    for (let side = -1; side <= 1; side += 2) {
      verts.push(
        track.px[i] + track.rx[i] * d + track.tx[i] * side * w,
        y + 0.04,
        track.pz[i] + track.rz[i] * d + track.tz[i] * side * w);
    }
  }
  for (let r = 0; r < sections - 1; r++) {
    const a = r * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: info.theme.water, emissive: info.theme.water, emissiveIntensity: 0.13,
    roughness: 0.18, metalness: 0.03, transparent: true, opacity: 0.8,
    depthWrite: false, side: THREE.DoubleSide,
  }));
  mesh.renderOrder = 2; mesh.name = 'waterfallWetContact';
  return mesh;
}

function makeWhitewaterCrown(track, info, i, lipD, topY, material) {
  const verts = [], idx = [];
  let v = 0;
  for (let j = 0; j < 7; j++) {
    const salt = i + j * 19;
    const along = (seeded(salt, 420) - 0.5) * 6.4;
    const half = 0.38 + seeded(salt, 421) * 0.5;
    const run = 2.3 + seeded(salt, 422) * 3.6;
    const baseD = lipD + info.outerSign * (seeded(salt, 423) * 0.7);
    const tipD = lipD + info.outerSign * run;
    const baseY = topY + 0.14 + seeded(salt, 424) * 0.22;
    const tipY = topY - 0.45 - seeded(salt, 425) * 0.7;
    verts.push(
      track.px[i] + track.rx[i] * baseD + track.tx[i] * (along - half), baseY,
      track.pz[i] + track.rz[i] * baseD + track.tz[i] * (along - half),
      track.px[i] + track.rx[i] * baseD + track.tx[i] * (along + half), baseY,
      track.pz[i] + track.rz[i] * baseD + track.tz[i] * (along + half),
      track.px[i] + track.rx[i] * tipD + track.tx[i] * along, tipY,
      track.pz[i] + track.rz[i] * tipD + track.tz[i] * along);
    idx.push(v, v + 1, v + 2); v += 3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 3; mesh.name = 'waterfallFoamLip';
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
  group.add(buildRoadsideProps(track, info));
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
  const clusterCount = 12, perCluster = 4, count = clusterCount * perCluster;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.65, 0.95, 4.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x614535, roughness: 1 }), count);
  const crownGeo = track.theme === 'dusk' ? new THREE.ConeGeometry(3.2, 9, 6)
    : (track.theme === 'noon' ? new THREE.DodecahedronGeometry(3.6, 0) : new THREE.ConeGeometry(4.2, 8, 7));
  const crown = new THREE.InstancedMesh(crownGeo,
    new THREE.MeshStandardMaterial({ color: info.theme.foliage, roughness: 0.95, flatShading: true }), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let j = 0; j < count; j++) {
    const cluster = Math.floor(j / perCluster);
    const member = j % perCluster;
    const base = Math.floor(((cluster + 0.2 + seeded(cluster, 41) * 0.5) / clusterCount) * track.count);
    const i = (base + Math.floor((member - 1.5) * 4 + (seeded(j, 42) - 0.5) * 8) + track.count) % track.count;
    const sign = cluster & 1 ? info.innerSign : info.outerSign;
    const d = sign * (track.halfWidth[i] + 8 + seeded(j, 43) * 17);
    const along = (seeded(j, 44) - 0.5) * 10;
    const x = track.px[i] + track.rx[i] * d + track.tx[i] * along;
    const y = track.py[i] + track.ry[i] * d;
    const z = track.pz[i] + track.rz[i] * d + track.tz[i] * along;
    const size = 0.7 + seeded(j, 45) * 0.72;
    q.setFromAxisAngle(up, seeded(j, 46) * Math.PI * 2);
    sc.set(size, size, size); p.set(x, y + 2.25 * size, z); m.compose(p, q, sc); trunk.setMatrixAt(j, m);
    p.y = y + (track.theme === 'dusk' ? 7 : 6.2) * size;
    sc.set(size * (0.85 + seeded(j, 47) * 0.35), size, size * (0.85 + seeded(j, 48) * 0.35));
    m.compose(p, q, sc); crown.setMatrixAt(j, m);
  }
  trunk.instanceMatrix.needsUpdate = true; crown.instanceMatrix.needsUpdate = true;
  trunk.castShadow = true; crown.castShadow = true;
  group.add(trunk, crown); group.name = 'tracksideGrowth';
  return group;
}

/* A small vocabulary of boulders, shrubs and route posts. The placement is
   authored in clusters, with adjacent members sharing a loose segment band,
   so the edge has landmarks and pauses instead of a picket-fence rhythm. */
function buildRoadsideProps(track, info) {
  const group = new THREE.Group();
  const rockCount = 24, shrubCount = 30, postCount = 16;
  const rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.3, 0),
    new THREE.MeshStandardMaterial({ color: 0x665448, roughness: 1, flatShading: true }), rockCount);
  const shrub = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.25, 0),
    new THREE.MeshStandardMaterial({ color: info.theme.foliage, roughness: 0.96, flatShading: true }), shrubCount);
  const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.32, 2.7, 5),
    new THREE.MeshStandardMaterial({ color: info.theme.trim, roughness: 0.48, metalness: 0.18, flatShading: true }), postCount);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const sc = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  const place = (j, count, salt, minExtra, span, alongSpan) => {
    const clusterCount = Math.ceil(count / 3);
    const cluster = Math.floor(j / 3);
    const base = Math.floor(((cluster + 0.18 + seeded(cluster, salt) * 0.55) / clusterCount) * track.count);
    const i = (base + Math.floor((j % 3 - 1) * 5 + (seeded(j + salt, salt + 1) - 0.5) * 9) + track.count) % track.count;
    const sign = cluster & 1 ? info.outerSign : info.innerSign;
    const d = sign * (track.halfWidth[i] + minExtra + seeded(j + salt, salt + 2) * span);
    const along = (seeded(j + salt, salt + 3) - 0.5) * alongSpan;
    return {
      i, x: track.px[i] + track.rx[i] * d + track.tx[i] * along,
      y: track.py[i] + track.ry[i] * d,
      z: track.pz[i] + track.rz[i] * d + track.tz[i] * along,
    };
  };

  for (let j = 0; j < rockCount; j++) {
    const a = place(j, rockCount, 501, 5.2, 10, 13);
    const size = 0.6 + seeded(j, 502) * 1.25;
    q.setFromAxisAngle(up, seeded(j, 503) * Math.PI * 2);
    sc.set(size * (1.1 + seeded(j, 504) * 0.55), size * (0.65 + seeded(j, 505) * 0.5), size);
    p.set(a.x, a.y + sc.y * 0.55, a.z); m.compose(p, q, sc); rock.setMatrixAt(j, m);
  }
  for (let j = 0; j < shrubCount; j++) {
    const a = place(j, shrubCount, 511, 5.7, 11, 16);
    const size = 0.55 + seeded(j, 512) * 1.05;
    q.setFromAxisAngle(up, seeded(j, 513) * Math.PI * 2);
    sc.set(size * (0.72 + seeded(j, 514) * 0.55), size * (0.72 + seeded(j, 515) * 0.45), size);
    p.set(a.x, a.y + sc.y * 0.52, a.z); m.compose(p, q, sc); shrub.setMatrixAt(j, m);
  }
  for (let j = 0; j < postCount; j++) {
    const a = place(j, postCount, 521, 4.9, 8, 9);
    const size = 0.75 + seeded(j, 522) * 0.45;
    q.setFromAxisAngle(up, seeded(j, 523) * Math.PI * 2);
    sc.set(size, size, size); p.set(a.x, a.y + 1.35 * size, a.z);
    m.compose(p, q, sc); post.setMatrixAt(j, m);
  }
  rock.instanceMatrix.needsUpdate = true; shrub.instanceMatrix.needsUpdate = true; post.instanceMatrix.needsUpdate = true;
  rock.castShadow = true; shrub.castShadow = true; post.castShadow = true;
  group.add(rock, shrub, post); group.name = 'clusteredRoadsideProps';
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
