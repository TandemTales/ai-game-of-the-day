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

function colr(hex) { return new THREE.Color(hex); }

/* Deterministic value noise so the terrain is identical every load and
   the shape a player learns is the shape they get back. */
function noise2(x, z) {
  return ZC.hash2(Math.round(x * 0.35), Math.round(z * 0.35)) - 0.5;
}

export function buildTrack(track) {
  const group = new THREE.Group();
  group.add(buildIsland(track));
  group.add(buildRoad(track));
  group.add(buildKerbs(track));
  group.add(buildStartLine(track));
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
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'road';
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
   Start/finish line — the one piece of the circuit a player has to be
   able to find instantly.
   ------------------------------------------------------------------ */
function buildStartLine(track) {
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
