/* =====================================================================
   ZEPHYR CIRCUIT — render/fx.js
   Particles and screen effects: drift sparks, boost trails, speed lines,
   dust, impacts, respawn.
   Owner: agent-particles. See SPEC.md §0.

   ESM. Reads window.ZC and the karts it is handed; never writes to ZC.

   ---------------------------------------------------------------------
   CONTRACT — main.js (lead) calls exactly these. Do not change the
   signatures; if you need more, report it and the lead will wire it.

     createFX(scene, track) -> fx
       Build every buffer and material ONCE, here. The frame loop must not
       allocate: no `new THREE.Vector3()` in update(), no geometry
       rebuilds, no material creation. Use pooled BufferGeometry with
       pre-allocated attributes and move the live count, or InstancedMesh
       with a per-frame instance count.

     fx.update(ctx)
       ctx = { karts, player, camera, dt, time, phase }
         karts   the full field, ZC.Race.state.karts, in roster order
         player  the kart the camera is following (may be an AI in attract)
         camera  the live THREE.PerspectiveCamera
         dt      seconds since the last frame, already clamped to <= 1/20
         time    seconds since page load, monotonic
         phase   ZC.Race.state.phase
     fx.setQuality(tier)   0 low, 1 medium, 2 high. Scale particle budgets.
     fx.dispose()          free geometry/materials when the scene rebuilds.
                           Also remove any ZC.on listeners you registered.

   ---------------------------------------------------------------------
   Kart fields (the real ones — see kart.js K.create):
     x, y, z, travelYaw (direction of motion), bodyYaw (where the shell
     points), speed, vy, slip, grounded, onRoad, surfaceY, seg, s,
     t (normalised lateral, |t|>1 is off-road),
     drift:{active,dir,charge,tier}, boost (seconds remaining),
     item, itemRoll, spin, spinAngle, shield, falling, respawnTimer,
     lap, place, finished, colour, id, isPlayer

   Events already emitted by the logic half — subscribe with ZC.on(name,
   fn); this is cheaper and more exact than diffing state:
     kart:driftStart {kart}      kart:driftTier {kart, tier}
     kart:boost {kart, ...}      kart:fell {kart}
     kart:hit {kart, source}     kart:spinEnd {kart}
     kart:shieldBreak {kart}     kart:lap {kart}
     kart:finish {kart}
     item:pickup / item:use / item:hit / item:expire / item:boxReturn
     race:countdown / race:go / race:results
   Register listeners in createFX and drop them in dispose(). Do the work
   in update() — a listener should only push into a queue or spawn from a
   pool, never build geometry.

   =====================================================================
   HOW THIS FILE IS PUT TOGETHER

   Everything is a `THREE.Points` cloud over a pre-sized BufferGeometry.
   There are four pooled layers (sparks / glow / smoke / bits) that differ
   only in texture and blend mode, three fixed-slot layers (per-kart
   flares, per-kart spin stars, camera speed lines) whose points are
   written in place every frame, and one wrapping cloud of atmosphere
   motes.

   The pools use swap-remove: live particles are kept packed at the front
   of the arrays and `geometry.setDrawRange(0, count)` moves. Nothing is
   allocated after createFX returns — spawning writes into slots that
   already exist, and a pool that is full simply drops the request.

   Points are squares, which is why every particle carries a rotation and
   the fragment shader spins gl_PointCoord: a drift spark that is a
   perfectly axis-aligned star eight hundred times in a row reads as a
   texture, not as debris.
   ===================================================================== */
import * as THREE from 'three';

const ZC = window.ZC;

/* Visual randomness is local to this effect instance. A fixed input/update
   sequence therefore produces the same particles without perturbing the
   gameplay RNG (and without making screenshot diffs depend on ambient state). */
function makePRNG(seed) {
  let s = seed >>> 0;
  return function random() {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function trackSeed(track) {
  const id = String((track && (track.id || track.name)) || 'zephyr-circuit');
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ------------------------------------------------------------------
   Procedural textures. Everything in this game is generated at boot —
   there are no asset files — so the soft falloff a spark needs comes out
   of a canvas and into a CanvasTexture.
   ------------------------------------------------------------------ */
function pixelTexture(size, fn) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    const ny = ((y + 0.5) / size) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) / size) * 2 - 1;
      let a = fn(nx, ny);
      if (a < 0) a = 0; else if (a > 1) a = 1;
      const i = (y * size + x) * 4;
      d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
      d[i + 3] = (a * 255) | 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/* A four-point glint with a blown-out core. The core is deliberately
   tiny and the spikes deliberately long: what sells a spark at 40px on a
   phone is the flare, not the dot. */
function makeSparkTexture() {
  return pixelTexture(64, (nx, ny) => {
    const r2 = nx * nx + ny * ny;
    let a = Math.exp(-r2 / 0.014) * 1.25;                    // core
    const fall = Math.max(0, 1 - Math.sqrt(r2));
    const f2 = fall * fall;
    a += Math.exp(-(ny * ny) / 0.0016) * f2 * 0.85;          // horizontal spike
    a += Math.exp(-(nx * nx) / 0.0016) * f2 * 0.85;          // vertical spike
    const d1 = (nx - ny) * 0.7071, d2 = (nx + ny) * 0.7071;
    a += Math.exp(-(d1 * d1) / 0.0009) * f2 * 0.42;
    a += Math.exp(-(d2 * d2) / 0.0009) * f2 * 0.42;
    a += Math.exp(-r2 / 0.20) * 0.18;                        // halo
    return a;
  });
}

function makeGlowTexture() {
  return pixelTexture(64, (nx, ny) => {
    const r = Math.sqrt(nx * nx + ny * ny);
    const f = Math.max(0, 1 - r);
    return f * f * (0.55 + 0.45 * f * f) * 1.15;
  });
}

/* A long soft bar. Used for speed lines and for the stretched core of a
   boost flame, rotated per particle into whatever direction it needs. */
function makeStreakTexture() {
  return pixelTexture(64, (nx, ny) => {
    const along = Math.max(0, 1 - Math.abs(nx));
    const a = Math.pow(along, 1.5) * Math.exp(-(ny * ny) / 0.0014);
    return a * 1.15;
  });
}

/* A broader directional ribbon for tyre haze. Unlike the round smoke map,
   this stays attached to the slip direction before it blooms away. */
function makeSlipTexture() {
  return pixelTexture(64, (nx, ny) => {
    const along = Math.max(0, 1 - Math.abs(nx));
    const edge = Math.exp(-(ny * ny) / 0.035);
    return Math.pow(along, 1.8) * edge * 0.72;
  });
}

/* An angular chip for debris: a soft-edged diamond, so a shard reads as a
   shard and not as another round puff. */
function makeShardTexture() {
  return pixelTexture(32, (nx, ny) => {
    const d = Math.abs(nx) * 0.85 + Math.abs(ny);
    return d > 0.92 ? 0 : Math.min(1, (0.92 - d) * 6);
  });
}

/* Smoke wants structure, not a gaussian — a gaussian blob scaled up is
   just fog. Stack a dozen offset lobes and mask the result to a circle. */
function makeSmokeTexture(random) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  const half = size / 2;
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + random() * 1.1;
    const rad = (i === 0) ? 0 : (0.06 + random() * 0.18) * size;
    const px = half + Math.cos(ang) * rad;
    const py = half + Math.sin(ang) * rad;
    const rr = (0.24 + random() * 0.16) * size;
    const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, 'rgba(255,255,255,0.20)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.10)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  /* mask to a soft disc so the square edge never shows */
  ctx.globalCompositeOperation = 'destination-in';
  const m = ctx.createRadialGradient(half, half, 0, half, half, half);
  m.addColorStop(0, 'rgba(255,255,255,1)');
  m.addColorStop(0.45, 'rgba(255,255,255,0.92)');
  m.addColorStop(0.78, 'rgba(255,255,255,0.45)');
  m.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = m;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/* ------------------------------------------------------------------
   The particle shader.

   gl_PointSize is derived properly from the projection rather than from
   three's `scale` fudge, so a particle authored in metres keeps its size
   when the chase camera opens its field of view under boost — which it
   does, by fourteen degrees, every time you drift-boost.
   ------------------------------------------------------------------ */
const PARTICLE_VERT = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  attribute float aRot;
  attribute vec3 aColor;
  uniform float uScale;      // drawingBufferHeight * 0.5
  uniform float uMaxPx;
  uniform float uFogDensity;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRot;
  varying float vFog;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vRot = aRot;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = max(0.05, -mv.z);
    float fd = uFogDensity * d;
    vFog = 1.0 - exp(-fd * fd);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(uMaxPx, aSize * uScale * projectionMatrix[1][1] / d);
  }
`;

const PARTICLE_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uFogColor;
  uniform float uFogMix;     // 1 = tint toward fog (smoke), 0 = fade out (additive)
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRot;
  varying float vFog;
  void main() {
    /* Every texture is transparent at its border and clamped, so a
       rotated sample that lands outside simply reads zero — no discard
       test, which would otherwise chop the ends off a diagonal streak. */
    vec2 uv = gl_PointCoord - 0.5;
    float cs = cos(vRot), sn = sin(vRot);
    uv = vec2(uv.x * cs - uv.y * sn, uv.x * sn + uv.y * cs) + 0.5;
    float a = texture2D(uMap, uv).a * vAlpha;
    if (a < 0.004) discard;
    vec3 col = mix(vColor, uFogColor, vFog * uFogMix);
    a *= 1.0 - vFog * (1.0 - uFogMix);
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------ */
export function createFX(scene, track) {
  const random = makePRNG(trackSeed(track));
  /* ---------------- quality budgets ---------------- */
  const TIERS = [
    { rate: 0.34, live: 0.30, cull: 55,  motes: 0,   streaks: 7,  size: 1.30, smoke: 0.45 },
    { rate: 0.66, live: 0.62, cull: 95,  motes: 190, streaks: 13, size: 1.12, smoke: 0.80 },
    { rate: 1.00, live: 1.00, cull: 150, motes: 384, streaks: 22, size: 1.00, smoke: 1.00 },
  ];
  let Q = TIERS[2];

  const fogColor = new THREE.Color(0xd98a58);
  let fogDensity = 0.00055;
  if (scene && scene.fog) {
    if (scene.fog.color) fogColor.copy(scene.fog.color);
    if (scene.fog.density !== undefined) fogDensity = scene.fog.density;
  }

  const textures = [];
  const TEX = {
    spark: makeSparkTexture(),
    glow: makeGlowTexture(),
    streak: makeStreakTexture(),
    slip: makeSlipTexture(),
    shard: makeShardTexture(),
    smoke: makeSmokeTexture(random),
  };
  for (const k in TEX) textures.push(TEX[k]);

  const materials = [];
  const geometries = [];
  const objects = [];

  function makeMaterial(map, additive, fogMix, maxPx) {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uScale: { value: 400 },
        uMaxPx: { value: maxPx || 420 },
        uFogDensity: { value: fogDensity },
        uFogColor: { value: fogColor },
        uFogMix: { value: fogMix },
      },
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    materials.push(m);
    return m;
  }

  /* ---------------- pooled layer ----------------
     Parallel typed arrays, swap-remove, packed draw range. */
  function makeLayer(capacity, map, additive, fogMix, renderOrder, maxPx) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(capacity * 3);
    const col = new Float32Array(capacity * 3);
    const siz = new Float32Array(capacity);
    const alp = new Float32Array(capacity);
    const rot = new Float32Array(capacity);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    geometries.push(geo);

    const mat = makeMaterial(map, additive, fogMix, maxPx);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = renderOrder;
    pts.matrixAutoUpdate = false;
    scene.add(pts);
    objects.push(pts);

    return {
      capacity, count: 0, geo, mat, pts,
      pos, col, siz, alp, rot,
      vx: new Float32Array(capacity),
      vy: new Float32Array(capacity),
      vz: new Float32Array(capacity),
      age: new Float32Array(capacity),
      life: new Float32Array(capacity),
      s0: new Float32Array(capacity),
      s1: new Float32Array(capacity),
      c0: new Float32Array(capacity * 3),
      c1: new Float32Array(capacity * 3),
      a0: new Float32Array(capacity),
      aIn: new Float32Array(capacity),
      aPow: new Float32Array(capacity),
      rotV: new Float32Array(capacity),
      grav: new Float32Array(capacity),
      drag: new Float32Array(capacity),
      liveCap: capacity,
    };
  }

  function swapDown(L, i) {
    const j = L.count - 1;
    if (i !== j) {
      const i3 = i * 3, j3 = j * 3;
      L.pos[i3] = L.pos[j3]; L.pos[i3 + 1] = L.pos[j3 + 1]; L.pos[i3 + 2] = L.pos[j3 + 2];
      L.col[i3] = L.col[j3]; L.col[i3 + 1] = L.col[j3 + 1]; L.col[i3 + 2] = L.col[j3 + 2];
      L.c0[i3] = L.c0[j3]; L.c0[i3 + 1] = L.c0[j3 + 1]; L.c0[i3 + 2] = L.c0[j3 + 2];
      L.c1[i3] = L.c1[j3]; L.c1[i3 + 1] = L.c1[j3 + 1]; L.c1[i3 + 2] = L.c1[j3 + 2];
      L.siz[i] = L.siz[j]; L.alp[i] = L.alp[j]; L.rot[i] = L.rot[j];
      L.vx[i] = L.vx[j]; L.vy[i] = L.vy[j]; L.vz[i] = L.vz[j];
      L.age[i] = L.age[j]; L.life[i] = L.life[j];
      L.s0[i] = L.s0[j]; L.s1[i] = L.s1[j];
      L.a0[i] = L.a0[j]; L.aIn[i] = L.aIn[j]; L.aPow[i] = L.aPow[j];
      L.rotV[i] = L.rotV[j]; L.grav[i] = L.grav[j]; L.drag[i] = L.drag[j];
    }
    L.count--;
  }

  /* One reused parameter block. Callers fill it and call emit(); nothing
     is allocated, and the call sites stay readable instead of being a
     twenty-argument function. */
  const P = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    life: 0.5, s0: 0.3, s1: 0.3,
    r0: 1, g0: 1, b0: 1, r1: 1, g1: 1, b1: 1,
    a0: 1, aIn: 0.04, aPow: 1.4,
    rot: 0, rotV: 0, grav: 0, drag: 0,
  };
  function resetP() {
    P.x = 0; P.y = 0; P.z = 0; P.vx = 0; P.vy = 0; P.vz = 0;
    P.life = 0.5; P.s0 = 0.3; P.s1 = 0.3;
    P.r0 = 1; P.g0 = 1; P.b0 = 1; P.r1 = 1; P.g1 = 1; P.b1 = 1;
    P.a0 = 1; P.aIn = 0.04; P.aPow = 1.4;
    P.rot = 0; P.rotV = 0; P.grav = 0; P.drag = 0;
  }

  function emit(L) {
    if (L.count >= L.liveCap) return false;
    const i = L.count++;
    const i3 = i * 3;
    L.pos[i3] = P.x; L.pos[i3 + 1] = P.y; L.pos[i3 + 2] = P.z;
    L.vx[i] = P.vx; L.vy[i] = P.vy; L.vz[i] = P.vz;
    L.age[i] = 0; L.life[i] = P.life;
    L.s0[i] = P.s0; L.s1[i] = P.s1;
    L.c0[i3] = P.r0; L.c0[i3 + 1] = P.g0; L.c0[i3 + 2] = P.b0;
    L.c1[i3] = P.r1; L.c1[i3 + 1] = P.g1; L.c1[i3 + 2] = P.b1;
    L.col[i3] = P.r0; L.col[i3 + 1] = P.g0; L.col[i3 + 2] = P.b0;
    L.a0[i] = P.a0; L.aIn[i] = P.aIn; L.aPow[i] = P.aPow;
    L.siz[i] = P.s0; L.alp[i] = 0;
    L.rot[i] = P.rot; L.rotV[i] = P.rotV;
    L.grav[i] = P.grav; L.drag[i] = P.drag;
    return true;
  }

  function stepLayer(L, dt) {
    const { pos, col, siz, alp, rot } = L;
    let i = 0;
    while (i < L.count) {
      const a = (L.age[i] += dt);
      const life = L.life[i];
      if (a >= life) { swapDown(L, i); continue; }
      const u = a / life;
      const i3 = i * 3;

      let vx = L.vx[i], vy = L.vy[i], vz = L.vz[i];
      vy += L.grav[i] * dt;
      const dg = L.drag[i];
      if (dg > 0) {
        let f = 1 - dg * dt;
        if (f < 0) f = 0;
        vx *= f; vy *= f; vz *= f;
      }
      L.vx[i] = vx; L.vy[i] = vy; L.vz[i] = vz;
      pos[i3] += vx * dt; pos[i3 + 1] += vy * dt; pos[i3 + 2] += vz * dt;

      siz[i] = L.s0[i] + (L.s1[i] - L.s0[i]) * u;
      col[i3] = L.c0[i3] + (L.c1[i3] - L.c0[i3]) * u;
      col[i3 + 1] = L.c0[i3 + 1] + (L.c1[i3 + 1] - L.c0[i3 + 1]) * u;
      col[i3 + 2] = L.c0[i3 + 2] + (L.c1[i3 + 2] - L.c0[i3 + 2]) * u;

      const inT = L.aIn[i];
      const rise = (inT > 0 && u < inT) ? (u / inT) : 1;
      const fall = Math.pow(1 - u, L.aPow[i]);
      alp[i] = L.a0[i] * rise * fall;
      rot[i] += L.rotV[i] * dt;
      i++;
    }
  }

  function uploadLayer(L) {
    const n = L.count;
    L.geo.setDrawRange(0, n);
    if (n === 0 && L._wasEmpty) return;
    L._wasEmpty = (n === 0);
    const at = L.geo.attributes;
    at.position.needsUpdate = true;
    at.aColor.needsUpdate = true;
    at.aSize.needsUpdate = true;
    at.aAlpha.needsUpdate = true;
    at.aRot.needsUpdate = true;
  }

  /* Capacities are sized for tier 2 and never change; setQuality moves
     `liveCap` and the spawn rates, so dropping to phone quality costs a
     multiply rather than a reallocation. */
  const sparks = makeLayer(2200, TEX.spark, true, 0, 9, 300);
  const glow = makeLayer(1200, TEX.glow, true, 0, 8, 640);
  const flame = makeLayer(700, TEX.streak, true, 0, 9, 520);
  const smoke = makeLayer(900, TEX.smoke, false, 1, 4, 512);
  const slipSmoke = makeLayer(620, TEX.slip, false, 1, 5, 460);
  const bits = makeLayer(420, TEX.shard, false, 1, 6, 200);
  const pools = [sparks, glow, flame, smoke, slipSmoke, bits];

  /* ---------------- fixed-slot layers ---------------- */
  const MAXK = 16;

  /* Per-kart continuous flares: 2 rear-wheel contact patches + 2
     exhausts. These are what give the sparks and the boost a bright,
     stable anchor instead of a cloud of unattached dots. */
  const FLARE_PER_KART = 4;
  const flares = (() => {
    const cap = MAXK * FLARE_PER_KART;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(cap * 3);
    const col = new Float32Array(cap * 3);
    const siz = new Float32Array(cap);
    const alp = new Float32Array(cap);
    const rot = new Float32Array(cap);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
    geo.setDrawRange(0, cap);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    geometries.push(geo);
    const mat = makeMaterial(TEX.spark, true, 0, 640);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 10;
    pts.matrixAutoUpdate = false;
    scene.add(pts);
    objects.push(pts);
    return { geo, pos, col, siz, alp, rot, cap };
  })();

  /* Twin exhaust jets use a streak texture, not the wheel-core glow map.
     Keeping these in their own fixed slots prevents boost from becoming a
     circular bloom that erases the kart silhouette. */
  const JET_PER_KART = 2;
  const jets = (() => {
    const cap = MAXK * JET_PER_KART;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(cap * 3);
    const col = new Float32Array(cap * 3);
    const siz = new Float32Array(cap);
    const alp = new Float32Array(cap);
    const rot = new Float32Array(cap);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
    geo.setDrawRange(0, cap);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    geometries.push(geo);
    const mat = makeMaterial(TEX.streak, true, 0, 720);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 10;
    pts.matrixAutoUpdate = false;
    scene.add(pts);
    objects.push(pts);
    return { geo, pos, col, siz, alp, rot, cap };
  })();

  /* Spun-out karts get stars orbiting the driver's head. It is the oldest
     visual shorthand in the genre and it is instantly readable from the
     back of the field, which a spinning shell alone is not. */
  const STARS_PER_KART = 3;
  const stars = (() => {
    const cap = MAXK * STARS_PER_KART;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(cap * 3);
    const col = new Float32Array(cap * 3);
    const siz = new Float32Array(cap);
    const alp = new Float32Array(cap);
    const rot = new Float32Array(cap);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
    geo.setDrawRange(0, cap);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    geometries.push(geo);
    const mat = makeMaterial(TEX.spark, true, 0, 260);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 11;
    pts.matrixAutoUpdate = false;
    scene.add(pts);
    objects.push(pts);
    return { geo, pos, col, siz, alp, rot, cap };
  })();

  /* Speed lines live in world space but are placed from the camera basis
     each frame, which keeps them in one Points cloud with everything else
     and needs no second scene or second pass. */
  const SPEED_CAP = 64;
  const speed = (() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(SPEED_CAP * 3);
    const col = new Float32Array(SPEED_CAP * 3);
    const siz = new Float32Array(SPEED_CAP);
    const alp = new Float32Array(SPEED_CAP);
    const rot = new Float32Array(SPEED_CAP);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    geometries.push(geo);
    const mat = makeMaterial(TEX.streak, true, 0, 4096);
    mat.depthTest = false;
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 40;
    pts.matrixAutoUpdate = false;
    scene.add(pts);
    objects.push(pts);
    /* stable per-line angle / radius / phase so they do not shimmer */
    const ang = new Float32Array(SPEED_CAP);
    const rad = new Float32Array(SPEED_CAP);
    const ph = new Float32Array(SPEED_CAP);
    const spd = new Float32Array(SPEED_CAP);
    for (let i = 0; i < SPEED_CAP; i++) {
      ang[i] = random() * Math.PI * 2;
      /* Keep the focal third clean. Peripheral streaks convey speed
         without competing with the braking point or the kart. */
      rad[i] = 0.56 + random() * 0.72;
      ph[i] = random();
      spd[i] = 0.9 + random() * 1.5;
    }
    return { geo, pos, col, siz, alp, rot, ang, rad, ph, spd };
  })();

  /* Golden-hour motes. Cheap, static-topology, and wrapped around the
     camera so the cloud is always where the player is looking. */
  const MOTE_CAP = 384;
  const MOTE_BOX = 62;
  const motes = (() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MOTE_CAP * 3);
    const col = new Float32Array(MOTE_CAP * 3);
    const siz = new Float32Array(MOTE_CAP);
    const alp = new Float32Array(MOTE_CAP);
    const rot = new Float32Array(MOTE_CAP);
    for (let i = 0; i < MOTE_CAP; i++) {
      const i3 = i * 3;
      pos[i3] = (random() - 0.5) * MOTE_BOX * 2;
      pos[i3 + 1] = (random() - 0.5) * MOTE_BOX;
      pos[i3 + 2] = (random() - 0.5) * MOTE_BOX * 2;
      const w = 0.75 + random() * 0.25;
      col[i3] = 1.15 * w; col[i3 + 1] = 0.86 * w; col[i3 + 2] = 0.52 * w;
      siz[i] = 0.10 + random() * 0.22;
      alp[i] = 0;
      rot[i] = random() * 6.28;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
    geo.setDrawRange(0, MOTE_CAP);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    geometries.push(geo);
    const mat = makeMaterial(TEX.glow, true, 0, 90);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    pts.matrixAutoUpdate = false;
    scene.add(pts);
    objects.push(pts);
    const seed = new Float32Array(MOTE_CAP);
    for (let i = 0; i < MOTE_CAP; i++) seed[i] = random() * 100;
    return { geo, pos, col, siz, alp, rot, seed, live: MOTE_CAP };
  })();

  /* ------------------------------------------------------------------
     Drift palette. The whole skill loop is legible because these change,
     hard, at each threshold — a player should never have to look at a HUD
     to know whether releasing now pays 0.55s or 1.50s.
       tier 0  pale blue scrub (charging, nothing banked yet)
       tier 1  blue
       tier 2  orange
       tier 3  pink
     Core values run well over 1.0 so the bloom pass blows the middle of
     each spark to white and leaves the hue in the falloff.
     ------------------------------------------------------------------ */
  const TIER_COL = [
    [0.70, 0.95, 1.35, 0.12, 0.24, 0.42],
    [0.12, 1.65, 3.90, 0.02, 0.25, 1.80],
    [4.20, 1.55, 0.06, 1.65, 0.15, 0.01],
    [4.30, 0.18, 3.40, 1.10, 0.02, 1.60],
  ];
  /* the tail colour on its own, for rings and flashes that never show a
     white core */
  const TIER_TAIL = [
    [0.35, 0.55, 0.85, 0.08, 0.16, 0.30],
    [0.03, 0.65, 1.70, 0.02, 0.12, 0.80],
    [1.80, 0.55, 0.03, 0.70, 0.05, 0.01],
    [1.80, 0.04, 1.20, 0.45, 0.02, 0.80],
  ];

  /* ------------------------------------------------------------------
     Per-kart scratch. Fixed size, never reallocated.
     ------------------------------------------------------------------ */
  const kPrevGround = new Uint8Array(MAXK);
  const kPrevFall = new Uint8Array(MAXK);
  const kPrevVy = new Float32Array(MAXK);
  const kSparkAcc = new Float32Array(MAXK);
  const kContactAcc = new Float32Array(MAXK);
  const kSmokeAcc = new Float32Array(MAXK);
  const kDustAcc = new Float32Array(MAXK);
  const kTrailAcc = new Float32Array(MAXK);
  const kWakeAcc = new Float32Array(MAXK);
  const kGritAcc = new Float32Array(MAXK);
  const kBoostPop = new Float32Array(MAXK);
  const kDriftPop = new Float32Array(MAXK);
  const kStarPhase = new Float32Array(MAXK);
  for (let i = 0; i < MAXK; i++) { kPrevGround[i] = 1; kStarPhase[i] = random() * 6.28; }

  /* camera basis, refreshed once per frame */
  let cRX = 1, cRY = 0, cRZ = 0;
  let cUX = 0, cUY = 1, cUZ = 0;
  let cFX = 0, cFY = 0, cFZ = -1;
  let cPX = 0, cPY = 0, cPZ = 0;

  function rnd(a, b) { return a + random() * (b - a); }

  /* A point sprite is screen-aligned, so a streak that should follow a
     world-space direction has to be rotated by that direction PROJECTED
     onto the camera's right/up axes. Getting this wrong is what makes
     boost flames look like confetti. */
  function screenAngle(vx, vy, vz) {
    const sx = vx * cRX + vy * cRY + vz * cRZ;
    const sy = vx * cUX + vy * cUY + vz * cUZ;
    if (sx === 0 && sy === 0) return 0;
    return -Math.atan2(sy, sx);
  }

  /* Palettes shared by the event bursts, hoisted so a listener allocates
     nothing even though it is not on the frame path. */
  const COL_HOT = [3.4, 2.9, 1.1, 1.6, 0.35, 0.02];
  const COL_IMPACT = [4.2, 2.1, 0.18, 1.0, 0.03, 0.01];
  const COL_CYAN = [0.8, 2.9, 3.4, 0.05, 0.5, 1.4];
  const COL_ARRIVE = [1.4, 2.9, 3.4, 0.2, 0.6, 1.4];
  const COL_GOLD = [3.2, 2.6, 0.9, 1.4, 0.7, 0.1];
  const COL_GOLD_SOFT = [2.6, 2.2, 1.0, 1.0, 0.6, 0.2];
  const COL_DEFLECT = [0.9, 2.8, 3.3, 0.1, 0.5, 1.3];
  const COL_PUFF = [2.2, 1.9, 1.4, 0.7, 0.5, 0.3];
  const COL_DUSTLIT = [2.4, 2.0, 1.3, 0.8, 0.4, 0.1];
  const COL_FALL = [2.6, 2.0, 1.2, 0.8, 0.3, 0.1];
  const COL_LAP = [3.0, 2.7, 1.4, 1.2, 0.8, 0.2];

  /* ------------------------------------------------------------------
     Spawn helpers. Each one is a burst; none of them allocate.
     ------------------------------------------------------------------ */

  /* A flat ring of light on the ground — the shape every kart racer uses
     to say "something just happened here". */
  function ring(x, y, z, n, r0, r1, spdOut, life, col, size, up) {
    const a0 = random() * 6.28;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * 6.28;
      const ca = Math.cos(a), sa = Math.sin(a);
      resetP();
      P.x = x + ca * r0; P.y = y + 0.12; P.z = z + sa * r0;
      P.vx = ca * spdOut; P.vz = sa * spdOut; P.vy = (up || 0.6) * rnd(0.4, 1.2);
      P.life = life * rnd(0.85, 1.15);
      P.s0 = size; P.s1 = size * 2.1;
      P.r0 = col[0]; P.g0 = col[1]; P.b0 = col[2];
      P.r1 = col[3]; P.g1 = col[4]; P.b1 = col[5];
      P.a0 = 0.9; P.aPow = 1.6; P.drag = 2.2;
      P.rot = a;
      emit(glow);
    }
    /* one bright flash in the middle, so the ring has a source */
    resetP();
    P.x = x; P.y = y + 0.35; P.z = z;
    P.life = 0.20; P.s0 = r1 * 1.5; P.s1 = r1 * 0.4;
    P.r0 = 3.2; P.g0 = 3.0; P.b0 = 2.8;
    P.r1 = col[0]; P.g1 = col[1]; P.b1 = col[2];
    P.a0 = 1; P.aPow = 1.1; P.aIn = 0;
    emit(glow);
  }

  function sparkBurst(x, y, z, n, spd, col, size, life, grav) {
    for (let i = 0; i < n; i++) {
      const th = random() * 6.28;
      const cp = random() * 1.6 - 0.25;      // biased upward
      const cc = Math.cos(cp), ss = Math.sin(cp);
      const v = spd * rnd(0.35, 1.0);
      resetP();
      P.x = x; P.y = y; P.z = z;
      P.vx = Math.cos(th) * cc * v;
      P.vy = ss * v;
      P.vz = Math.sin(th) * cc * v;
      P.life = life * rnd(0.6, 1.25);
      P.s0 = size * rnd(0.7, 1.5); P.s1 = P.s0 * 0.18;
      P.r0 = col[0]; P.g0 = col[1]; P.b0 = col[2];
      P.r1 = col[3]; P.g1 = col[4]; P.b1 = col[5];
      P.a0 = 1; P.aPow = 1.3; P.aIn = 0;
      P.rot = random() * 6.28; P.rotV = rnd(-9, 9);
      P.grav = grav === undefined ? -20 : grav;
      P.drag = 1.4;
      emit(sparks);
    }
  }

  function smokePuff(x, y, z, n, spd, r, g, b, size, life, alpha) {
    const cap = Q.smoke;
    const m = Math.max(1, Math.round(n * cap));
    for (let i = 0; i < m; i++) {
      const th = random() * 6.28;
      const v = spd * rnd(0.2, 1);
      resetP();
      P.x = x + rnd(-0.3, 0.3); P.y = y + rnd(0, 0.4); P.z = z + rnd(-0.3, 0.3);
      P.vx = Math.cos(th) * v; P.vz = Math.sin(th) * v; P.vy = rnd(0.4, 2.0);
      P.life = life * rnd(0.7, 1.3);
      P.s0 = size * rnd(0.6, 1.1) * Q.size;
      P.s1 = P.s0 * rnd(2.4, 4.0);
      P.r0 = r; P.g0 = g; P.b0 = b;
      P.r1 = r * 0.55; P.g1 = g * 0.55; P.b1 = b * 0.6;
      P.a0 = alpha; P.aIn = 0.18; P.aPow = 1.7;
      P.rot = random() * 6.28; P.rotV = rnd(-1.4, 1.4);
      P.grav = 0.4; P.drag = 1.6;
      emit(smoke);
    }
  }

  function debris(x, y, z, n, spd, r, g, b, size) {
    for (let i = 0; i < n; i++) {
      const th = random() * 6.28;
      const v = spd * rnd(0.3, 1);
      resetP();
      P.x = x; P.y = y + 0.2; P.z = z;
      P.vx = Math.cos(th) * v; P.vy = rnd(2, 8); P.vz = Math.sin(th) * v;
      P.life = rnd(0.5, 1.1);
      P.s0 = size * rnd(0.6, 1.4); P.s1 = P.s0 * 0.8;
      P.r0 = r; P.g0 = g; P.b0 = b;
      P.r1 = r * 0.7; P.g1 = g * 0.7; P.b1 = b * 0.7;
      P.a0 = 0.95; P.aPow = 2.2; P.aIn = 0;
      P.rot = random() * 6.28; P.rotV = rnd(-16, 16);
      P.grav = -22; P.drag = 0.5;
      emit(bits);
    }
  }

  /* ------------------------------------------------------------------
     Events. Listeners spawn straight out of the pools — no geometry, no
     allocation — so there is no queue to drain.
     ------------------------------------------------------------------ */
  const listeners = [];
  function on(name, fn) { ZC.on(name, fn); listeners.push([name, fn]); }

  function kartOf(p) { return (p && p.kart) ? p.kart : p; }

  /* Where the authored boost flame is, in kart-local metres. Keep y/z in
     lockstep with render/karts.js' centered flame part (y=.50,
     z=rearZ-1.12); the two pooled cores stay inside its .34m footprint. */
  const EX_X = 0.10, EX_Y = 0.50, EX_Z = -1.12;
  const WH_Y = 0.06;
  /* Mirrors render/karts.js' authored rear axle instead of pretending all
     eight silhouettes share the scaffold kart's wheelbase. */
  const CONTACT = {
    kestrel: [0.94, -1.08], mantis: [0.98, -1.05], cobalt: [1.22, -1.10],
    ember: [1.00, -1.20], saffron: [1.08, -0.94], thistle: [1.05, -1.04],
    pewter: [1.12, -1.08], moss: [1.08, -1.02],
  };
  const DEFAULT_CONTACT = CONTACT.kestrel;
  function contactOf(k) { return CONTACT[k.id] || DEFAULT_CONTACT; }

  /* local -> world, matching render/karts.js' YXZ root pose. The old FX
     anchor only used body yaw, which made rear contacts lift off the tyres
     on banked corners and during a slide lean. No allocation: writes to _w. */
  const _w = { x: 0, y: 0, z: 0 };
  function toWorld(k, lx, ly, lz, yaw) {
    const y = (yaw === undefined) ? k.bodyYaw : yaw;
    const proj = k._proj;
    const pitch = (proj && proj.ty !== undefined) ? Math.asin(ZC.clamp(proj.ty, -1, 1)) : 0;
    const roadRoll = (proj && proj.ry !== undefined) ? -Math.asin(ZC.clamp(proj.ry, -1, 1)) : 0;
    const roll = -(k.slip || 0) * 0.45 + roadRoll;
    const sy = Math.sin(y), cy = Math.cos(y);
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    const sr = Math.sin(roll), cr = Math.cos(roll);
    /* Euler YXZ: roll local space, then pitch, then body yaw. */
    const xr = cr * lx - sr * ly;
    const yr = sr * lx + cr * ly;
    const yp = cp * yr - sp * lz;
    const zp = sp * yr + cp * lz;
    _w.x = k.x + cy * xr + sy * zp;
    _w.y = k.y + yp;
    _w.z = k.z - sy * xr + cy * zp;
  }

  on('kart:driftStart', (p) => {
    const k = kartOf(p); if (!k) return;
    const cp = contactOf(k);
    const dir = k.drift.dir || 1;
    for (let s = 0; s < 2; s++) {
      /* Put the first visible puff on the inside rear tyre. The second is a
         quieter mirror, so the slide has a source rather than two floating
         clouds with no relationship to the kart. */
      const side = s === 0 ? dir : -dir;
      toWorld(k, side * cp[0], WH_Y + 0.015, cp[1]);
      smokePuff(_w.x, _w.y, _w.z, s === 0 ? 6 : 3, 1.6, 0.82, 0.80, 0.80, 0.48, 0.62, s === 0 ? 0.34 : 0.20);
    }
  });

  on('kart:driftTier', (p) => {
    const k = kartOf(p); if (!k) return;
    const tier = (p && p.tier !== undefined) ? p.tier : k.drift.tier;
    if (tier <= 0) return;
    const c = TIER_COL[Math.min(3, tier)];
    kDriftPop[idxOf(k)] = 1;
    /* A hard, unmissable pop at the exact frame the colour changes. This
       is the feedback the whole mechanic hangs on. */
    const cp = contactOf(k);
    const dir = k.drift.dir || 1;
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? dir : -dir;
      toWorld(k, side * cp[0], WH_Y + 0.035, cp[1]);
      sparkBurst(_w.x, _w.y, _w.z, 8 + tier * 4, 7 + tier * 1.5, c, 0.20, 0.26, -14);
      const tail = TIER_TAIL[Math.min(3, tier)];
      resetP();
      P.x = _w.x; P.y = _w.y; P.z = _w.z;
      P.life = 0.18; P.s0 = 0.56 + tier * 0.18; P.s1 = 0.10;
      P.r0 = tail[0]; P.g0 = tail[1]; P.b0 = tail[2];
      P.r1 = tail[3]; P.g1 = tail[4]; P.b1 = tail[5];
      P.a0 = 1; P.aPow = 1.2; P.aIn = 0;
      emit(glow);
    }
  });

  on('kart:boost', (p) => {
    const k = kartOf(p); if (!k) return;
    kBoostPop[idxOf(k)] = 1;
    const fx = Math.sin(k.travelYaw), fz = Math.cos(k.travelYaw);
    const kvx = fx * k.speed, kvz = fz * k.speed;
    const cp = contactOf(k);
    for (let exhaust = 0; exhaust < 2; exhaust++) {
      const sx = exhaust === 0 ? -EX_X : EX_X;
      toWorld(k, sx, EX_Y, cp[1] + EX_Z);
      const ex = _w.x, ey = _w.y, ez = _w.z;
      /* the flame cone itself — velocity is mostly the kart's own, so the
         burst stays a cone bolted to the exhaust rather than a fireball
         the kart drives out of */
      for (let i = 0; i < 6; i++) {
        const t = i / 6;
        resetP();
        P.x = ex + rnd(-0.08, 0.08); P.y = ey + rnd(-0.07, 0.07); P.z = ez + rnd(-0.08, 0.08);
        const v = rnd(15, 25);
        P.vx = kvx * 0.42 - fx * v + rnd(-1.6, 1.6);
        P.vz = kvz * 0.42 - fz * v + rnd(-1.6, 1.6);
        P.vy = rnd(-0.5, 2.2);
        P.life = rnd(0.14, 0.32);
        P.s0 = rnd(0.16, 0.30); P.s1 = P.s0 * 2.0;
        P.r0 = 1.9; P.g0 = 2.15 - t * 0.25; P.b0 = 2.45 - t * 0.65;
        P.r1 = 1.45; P.g1 = 0.38; P.b1 = 0.03;
        P.a0 = 0.66; P.aPow = 1.65; P.aIn = 0;
        P.rot = screenAngle(-fx, P.vy * 0.02, -fz) + rnd(-0.08, 0.08);
        P.drag = 2.0;
        emit(flame);
      }
      /* A compact hot source makes the authored exhaust origin survive the
         first few frames before the directional trail separates from it. */
      resetP();
      P.x = ex; P.y = ey; P.z = ez;
      P.life = 0.16; P.s0 = 0.54; P.s1 = 0.10;
      P.r0 = 3.4; P.g0 = 3.2; P.b0 = 2.5;
      P.r1 = 1.8; P.g1 = 0.55; P.b1 = 0.04;
      P.a0 = 0.9; P.aPow = 1.1; P.aIn = 0;
      emit(glow);
    }
  });

  on('kart:hit', (p) => {
    const k = kartOf(p); if (!k) return;
    /* One-frame contact flash, then a radial spark crown and a separate
       rearward cone of physical debris. No lingering cloud: an impact
       must not be mistaken for boost exhaust. */
    /* The flash is on the kart root, while the shock ring is on the road
       under that root. Together they establish a collision event instead
       of another free-floating orange burst. */
    toWorld(k, 0, WH_Y + 0.02, 0.02);
    const groundX = _w.x, groundY = _w.y, groundZ = _w.z;
    ring(groundX, groundY, groundZ, 14, 0.28, 1.9, 10, 0.25, COL_IMPACT, 0.38, 0.75);
    toWorld(k, 0, 0.82, 0);
    const hitX = _w.x, hitY = _w.y, hitZ = _w.z;
    resetP();
    P.x = hitX; P.y = hitY; P.z = hitZ;
    P.life = 0.15; P.s0 = 2.05; P.s1 = 0.12;
    P.r0 = 4.8; P.g0 = 3.8; P.b0 = 1.25;
    P.r1 = COL_IMPACT[3]; P.g1 = COL_IMPACT[4]; P.b1 = COL_IMPACT[5];
    P.a0 = 0.92; P.aIn = 0; P.aPow = 1.1;
    emit(glow);
    sparkBurst(hitX, hitY, hitZ, 14, 10, COL_IMPACT, 0.24, 0.28, -18);
    const fx = Math.sin(k.travelYaw), fz = Math.cos(k.travelYaw);
    const rx = Math.cos(k.travelYaw), rz = -Math.sin(k.travelYaw);
    for (let q = 0; q < 12; q++) {
      const back = rnd(8, 16), side = rnd(-5, 5);
      resetP();
      P.x = hitX + rnd(-0.10, 0.10); P.y = hitY + rnd(-0.12, 0.18); P.z = hitZ + rnd(-0.10, 0.10);
      P.vx = -fx * back + rx * side; P.vz = -fz * back + rz * side; P.vy = rnd(2, 8);
      P.life = rnd(0.28, 0.50); P.s0 = rnd(0.18, 0.34); P.s1 = P.s0 * 0.14;
      P.r0 = 0.95; P.g0 = 0.52; P.b0 = 0.10;
      P.r1 = 0.16; P.g1 = 0.05; P.b1 = 0.01;
      P.a0 = 1; P.aIn = 0; P.aPow = 1.5;
      P.rot = random() * 6.28; P.rotV = rnd(-18, 18); P.grav = -22; P.drag = 0.6;
      emit(bits);
    }
  });

  on('kart:shieldBreak', (p) => {
    const k = kartOf(p); if (!k) return;
    const CY = COL_CYAN;
    /* a shell, not a puff: the shards go out along a sphere */
    for (let i = 0; i < 30; i++) {
      const th = random() * 6.28;
      const cp = random() * 2 - 1;
      const sc = Math.sqrt(Math.max(0, 1 - cp * cp));
      const v = rnd(6, 13);
      resetP();
      P.x = k.x + Math.cos(th) * sc * 1.1;
      P.y = k.y + 0.8 + cp * 1.1;
      P.z = k.z + Math.sin(th) * sc * 1.1;
      P.vx = Math.cos(th) * sc * v; P.vy = cp * v * 0.7 + 1.5; P.vz = Math.sin(th) * sc * v;
      P.life = rnd(0.30, 0.62);
      P.s0 = rnd(0.16, 0.36); P.s1 = P.s0 * 0.3;
      P.r0 = CY[0]; P.g0 = CY[1]; P.b0 = CY[2];
      P.r1 = CY[3]; P.g1 = CY[4]; P.b1 = CY[5];
      P.a0 = 1; P.aPow = 1.4; P.aIn = 0;
      P.rot = random() * 6.28; P.rotV = rnd(-12, 12);
      P.grav = -9; P.drag = 1.6;
      emit(sparks);
    }
    ring(k.x, k.y, k.z, 20, 1.4, 4.2, 13, 0.38, CY, 0.6, 1.4);
  });

  on('kart:fell', (p) => {
    const k = kartOf(p); if (!k) return;
    smokePuff(k.x, k.y, k.z, 12, 3.5, 0.78, 0.70, 0.62, 0.9, 1.1, 0.4);
    debris(k.x, k.y, k.z, 10, 5, 0.36, 0.28, 0.22, 0.24);
    sparkBurst(k.x, k.y, k.z, 16, 8, COL_FALL, 0.28, 0.5, -6);
  });

  on('item:pickup', (p) => {
    const k = kartOf(p); if (!k) return;
    sparkBurst(k.x, k.y + 0.9, k.z, 16, 6, COL_GOLD, 0.28, 0.45, -6);
    resetP();
    P.x = k.x; P.y = k.y + 0.9; P.z = k.z;
    P.life = 0.26; P.s0 = 2.4; P.s1 = 0.3;
    P.r0 = 3.0; P.g0 = 2.5; P.b0 = 1.2;
    P.r1 = 1.0; P.g1 = 0.6; P.b1 = 0.1;
    P.a0 = 0.9; P.aPow = 1.3; P.aIn = 0;
    emit(glow);
  });

  on('item:boxReturn', (b) => {
    if (!b || b.x === undefined) return;
    sparkBurst(b.x, (b.y || 0) + 0.8, b.z, 12, 5, COL_GOLD_SOFT, 0.24, 0.5, -4);
  });

  on('item:hit', (p) => {
    if (!p || p.x === undefined) return;
    const col = p.blocked ? COL_DEFLECT : COL_HOT;
    sparkBurst(p.x, p.y + 0.4, p.z, p.blocked ? 22 : 18, 11, col, 0.32, 0.4, -14);
    ring(p.x, p.y, p.z, 10, 0.6, 2.2, 8, 0.28, col, 0.45, 0.8);
  });

  on('item:expire', (p) => {
    if (!p || p.x === undefined) return;
    smokePuff(p.x, (p.y || 0) + 0.3, p.z, 5, 2.0, 0.7, 0.68, 0.7, 0.5, 0.7, 0.3);
    sparkBurst(p.x, (p.y || 0) + 0.3, p.z, 8, 5, COL_PUFF, 0.22, 0.35, -10);
  });

  on('race:go', () => {
    const st = ZC.Race && ZC.Race.state;
    if (!st || !st.karts) return;
    for (const k of st.karts) {
      const cp = contactOf(k);
      for (const sx of [-EX_X, EX_X]) {
        toWorld(k, sx, EX_Y, cp[1] + EX_Z);
        smokePuff(_w.x, _w.y, _w.z, 6, 2.6, 0.8, 0.78, 0.78, 0.7, 0.9, 0.35);
      }
      for (const side of [-1, 1]) {
        toWorld(k, side * cp[0], WH_Y, cp[1]);
        smokePuff(_w.x, _w.y, _w.z, 5, 2.2, 0.82, 0.80, 0.78, 0.7, 1.0, 0.35);
      }
    }
  });

  on('kart:lap', (p) => {
    const k = kartOf(p);
    if (!k || !k.isPlayer) return;
    sparkBurst(k.x, k.y + 1.4, k.z, 14, 7, COL_LAP, 0.3, 0.6, -8);
  });

  on('kart:finish', (p) => {
    const k = kartOf(p); if (!k) return;
    confettiAt(k.x, k.y + 2.2, k.z, 56);
  });

  on('race:results', () => {
    const st = ZC.Race && ZC.Race.state;
    if (!st || !st.karts) return;
    for (const k of st.karts) {
      if (k.place === 1) confettiAt(k.x, k.y + 3.0, k.z, 70);
    }
  });

  function confettiAt(x, y, z, n) {
    for (let i = 0; i < n; i++) {
      const th = random() * 6.28;
      const v = rnd(2, 9);
      const h = random();
      resetP();
      P.x = x + rnd(-1.5, 1.5); P.y = y + rnd(-0.5, 1.5); P.z = z + rnd(-1.5, 1.5);
      P.vx = Math.cos(th) * v; P.vy = rnd(4, 12); P.vz = Math.sin(th) * v;
      P.life = rnd(1.1, 2.2);
      P.s0 = rnd(0.16, 0.30); P.s1 = P.s0;
      /* four festival colours, no texture needed */
      if (h < 0.25) { P.r0 = 1.6; P.g0 = 0.35; P.b0 = 0.45; }
      else if (h < 0.5) { P.r0 = 1.6; P.g0 = 1.3; P.b0 = 0.3; }
      else if (h < 0.75) { P.r0 = 0.35; P.g0 = 1.3; P.b0 = 1.6; }
      else { P.r0 = 1.4; P.g0 = 0.5; P.b0 = 1.5; }
      P.r1 = P.r0 * 0.8; P.g1 = P.g0 * 0.8; P.b1 = P.b0 * 0.8;
      P.a0 = 1; P.aPow = 1.1; P.aIn = 0;
      P.rot = random() * 6.28; P.rotV = rnd(-14, 14);
      P.grav = -13; P.drag = 0.9;
      emit(bits);
    }
  }

  /* index of a kart within the live field, for the per-kart scratch */
  let liveKarts = null;
  function idxOf(k) {
    if (!liveKarts) return 0;
    const i = liveKarts.indexOf(k);
    return (i >= 0 && i < MAXK) ? i : 0;
  }

  /* ------------------------------------------------------------------
     Continuous emission, per kart, per frame.
     ------------------------------------------------------------------ */
  function driveKart(k, i, dt, dist, time, focus) {
    /* Full rate on anything close enough to look at, tapering only for
       karts far down the road. */
    const near = dist < 26 ? 1 : 26 / dist;
    const hero = k === focus ? 1 : 0.12;
    const focusKart = k === focus;
    const cp = contactOf(k);
    const grounded = k.grounded && !k.falling;
    const spd = k.speed;
    const spdF = ZC.clamp01(spd / 27);

    /* ---- drift sparks and tyre smoke ---- */
    const d = k.drift;
    if (d.active && grounded && spd > 8) {
      const tier = Math.min(3, d.tier);
      const c = TIER_COL[tier];

      /* how close the charge is to the next threshold — the sparks swell
         as the payout approaches, which is a second channel of the same
         information as the colour */
      const tiers = ZC.Kart.TUNE.driftTiers;
      let lo = 0, hi = tiers[0];
      if (tier === 1) { lo = tiers[0]; hi = tiers[1]; }
      else if (tier === 2) { lo = tiers[1]; hi = tiers[2]; }
      else if (tier === 3) { lo = tiers[2]; hi = tiers[2] + 1.2; }
      const swell = ZC.clamp01((d.charge - lo) / Math.max(0.001, hi - lo));

      const baseRate = (tier === 0 ? 42 : 115 + tier * 45) * (0.75 + 0.25 * spdF);
      kSparkAcc[i] += baseRate * Q.rate * near * hero * dt * (0.8 + 0.45 * swell);

      const fxT = Math.sin(k.travelYaw), fzT = Math.cos(k.travelYaw);
      const rxB = Math.cos(k.bodyYaw), rzB = -Math.sin(k.bodyYaw);
      /* The kart's own velocity. Inheriting most of it is the single
         thing that turns a dotted line strung out across the tarmac into
         a cone that hugs the wheel: without it a spark is dumped into
         world space and the kart leaves it behind at 25 m/s. */
      const kvx = fxT * spd, kvz = fzT * spd;

      let n = kSparkAcc[i] | 0;
      if (n > 44) n = 44;
      kSparkAcc[i] -= n;
      for (let q = 0; q < n; q++) {
        /* both rear wheels spark; the inside one throws roughly twice as
           much, which is what makes the direction of the slide readable */
        const inside = (q === 0 || random() < 0.72) ? d.dir : -d.dir;
        const sx = inside * cp[0];
        toWorld(k, sx + rnd(-0.015, 0.015), WH_Y + rnd(0, 0.018), cp[1] + rnd(-0.022, 0.022));
        /* a third of them are the long stragglers that give the plume
           depth; the rest stay in the dense head at the tyre */
        const far = random() < 0.16;
        const v = far ? rnd(5, 10) : rnd(1.5, 4.5);
        const out = inside * (far ? rnd(2.5, 6) : rnd(0.35, 2));
        resetP();
        P.x = _w.x; P.y = _w.y; P.z = _w.z;
        P.vx = kvx * 0.52 - fxT * v + rxB * out + rnd(-1.0, 1.0);
        P.vz = kvz * 0.52 - fzT * v + rzB * out + rnd(-1.0, 1.0);
        P.vy = rnd(0.8, 3.6) + swell * 1.2 + (far ? 1.5 : 0);
        P.life = (far ? rnd(0.16, 0.30) : rnd(0.08, 0.16));
        const s = (0.14 + tier * 0.045 + swell * 0.055) * rnd(0.75, 1.35) * Q.size * (focusKart ? 1.32 : 0.82);
        P.s0 = s; P.s1 = s * 0.14;
        P.r0 = c[0]; P.g0 = c[1]; P.b0 = c[2];
        P.r1 = c[3]; P.g1 = c[4]; P.b1 = c[5];
        P.a0 = 1; P.aPow = 1.2; P.aIn = 0;
        P.rot = screenAngle(P.vx - kvx, P.vy, P.vz - kvz) + rnd(-0.16, 0.16);
        P.rotV = rnd(-3, 3);
        P.grav = -19; P.drag = 2.4;
        /* Most of the plume is tapered along its actual trajectory; a few
           glints retain the crackling, high-energy silhouette. */
        emit(random() < (focusKart ? 0.35 : 0.55) ? flame : sparks);

        /* Every third spark gets a soft lit body behind it. This is the
           difference between "some orange dots" and a cone with a bright
           middle and a coloured falloff, which is what MK8 actually
           draws. */
        if (random() < 0.04) {
          resetP();
          P.x = _w.x; P.y = _w.y + 0.04; P.z = _w.z;
          P.vx = kvx * 0.72 - fxT * v * 0.5 + rxB * out * 0.5;
          P.vz = kvz * 0.72 - fzT * v * 0.5 + rzB * out * 0.5;
          P.vy = rnd(0.5, 3.0);
          P.life = rnd(0.10, 0.24);
          P.s0 = (0.14 + tier * 0.045) * rnd(0.75, 1.20) * Q.size; P.s1 = P.s0 * 1.35;
          P.r0 = c[0] * 0.45; P.g0 = c[1] * 0.45; P.b0 = c[2] * 0.45;
          P.r1 = c[3] * 0.35; P.g1 = c[4] * 0.35; P.b1 = c[5] * 0.35;
          P.a0 = 0.55; P.aPow = 1.7; P.aIn = 0.12;
          emit(glow);
        }
      }

      /* A short-lived hot contact core is deliberately emitted at the inside
         rear tyre every frame. The moving sparks sell energy; this anchored
         core sells ownership. Without it, the first visible spark can be
         several pixels behind the kart and the effect reads as a detached
         orange trail in a chase frame. */
      kContactAcc[i] += 18 * Q.rate * near * hero * dt * (0.75 + 0.25 * swell);
      let nc = kContactAcc[i] | 0;
      if (nc > 2) nc = 2;
      kContactAcc[i] -= nc;
      for (let q = 0; q < nc; q++) {
        const side = d.dir * (q === 0 ? cp[0] : -cp[0]);
        toWorld(k, side, WH_Y + 0.026, cp[1]);
        resetP();
        P.x = _w.x; P.y = _w.y; P.z = _w.z;
        P.vx = kvx * 0.18; P.vz = kvz * 0.18; P.vy = 0.12;
        P.life = 0.075; P.s0 = (0.22 + tier * 0.035) * Q.size;
        P.s1 = P.s0 * 0.28;
        P.r0 = c[0] * 1.18; P.g0 = c[1] * 1.18; P.b0 = c[2] * 1.18;
        P.r1 = c[3]; P.g1 = c[4]; P.b1 = c[5];
        P.a0 = focusKart ? 0.92 : 0.22; P.aIn = 0; P.aPow = 1.1;
        P.rot = 0; P.rotV = 0; P.grav = 0; P.drag = 0;
        emit(glow);
      }

      /* tyre smoke — a drifting kart lays rubber whether or not it has
         banked a tier yet, and the smoke is what makes the slide read
         from three karts back */
      kSmokeAcc[i] += 34 * Q.rate * near * (focusKart ? 1 : 0.14) * dt * (0.5 + 0.5 * spdF);
      let ns = kSmokeAcc[i] | 0;
      if (ns > 4) ns = 4;
      kSmokeAcc[i] -= ns;
      for (let q = 0; q < ns; q++) {
        /* q=0 is always the inside rear contact. It is the visual proof of
           ownership; the quieter second puff can mirror to the other tyre. */
        const side = q === 0 ? d.dir : (random() < 0.5 ? -1 : 1);
        const sx = side * cp[0];
        toWorld(k, sx, WH_Y + 0.018, cp[1]);
        resetP();
        P.x = _w.x; P.y = _w.y + 0.03; P.z = _w.z;
        /* Inherit road speed, then peel toward the outside of the slide.
           The relative motion is what leaves a surface-linked ribbon. */
        const outside = -d.dir * rnd(0.7, 2.0);
        P.vx = kvx * 0.46 - fxT * rnd(0.2, 1.4) + rxB * outside;
        P.vz = kvz * 0.46 - fzT * rnd(0.2, 1.4) + rzB * outside;
        P.vy = rnd(0.18, 0.75);
        P.life = rnd(0.38, 0.62);
        P.s0 = rnd(0.28, 0.40) * Q.size * (focusKart ? 1.10 : 0.82); P.s1 = P.s0 * 3.0;
        P.r0 = 0.84 + tier * 0.025; P.g0 = 0.86; P.b0 = 0.88 + tier * 0.045;
        P.r1 = 0.42; P.g1 = 0.44; P.b1 = 0.48;
        P.a0 = focusKart ? 0.24 : 0.10; P.aIn = 0.10; P.aPow = 1.7;
        P.rot = screenAngle(P.vx - kvx, P.vy, P.vz - kvz) + rnd(-0.10, 0.10);
        P.rotV = rnd(-0.3, 0.3); P.grav = 0.24; P.drag = 1.1;
        emit(slipSmoke);
      }
      /* One cool, centreline wake belongs only to the focus kart. It starts
         at the rear axle, stays low, and trails opposite travel, so a viewer
         can answer "whose wake is that?" from the frame alone. */
      if (focusKart && spd > 18) {
        kWakeAcc[i] += 26 * Q.rate * near * dt * (0.45 + 0.55 * spdF);
        let nw = kWakeAcc[i] | 0;
        if (nw > 3) nw = 3;
        kWakeAcc[i] -= nw;
        for (let q = 0; q < nw; q++) {
          toWorld(k, 0, WH_Y + 0.028, cp[1] - 0.04);
          resetP();
          P.x = _w.x; P.y = _w.y; P.z = _w.z;
          const back = rnd(3.5, 7.5);
          P.vx = kvx * 0.36 - fxT * back;
          P.vz = kvz * 0.36 - fzT * back;
          P.vy = rnd(0.08, 0.34);
          P.life = rnd(0.30, 0.46);
          P.s0 = rnd(0.16, 0.24) * Q.size; P.s1 = P.s0 * rnd(2.4, 3.4);
          P.r0 = 0.28; P.g0 = 0.54; P.b0 = 0.78;
          P.r1 = 0.08; P.g1 = 0.17; P.b1 = 0.28;
          P.a0 = 0.24; P.aIn = 0.08; P.aPow = 1.45;
          P.rot = screenAngle(-fxT, P.vy * 0.03, -fzT) + rnd(-0.08, 0.08);
          P.rotV = rnd(-0.2, 0.2); P.grav = 0.08; P.drag = 1.0;
          emit(slipSmoke);
        }
      } else {
        kWakeAcc[i] *= 0.5;
      }
    } else {
      kSparkAcc[i] = 0;
      kContactAcc[i] = 0;
      kWakeAcc[i] *= 0.5;
    }

    /* Boost ends the drift state immediately, but its authored exhaust still
       needs a readable owner. Keep the same low rear-axle wake alive for the
       focus kart during the boost itself rather than leaving a generic blue
       streak in screen space. */
    if (focusKart && grounded && !d.active && k.boost > 0 && spd > 18) {
      const fxT = Math.sin(k.travelYaw), fzT = Math.cos(k.travelYaw);
      const kvx = fxT * spd, kvz = fzT * spd;
      kWakeAcc[i] += 24 * Q.rate * near * dt;
      let nw = kWakeAcc[i] | 0;
      if (nw > 2) nw = 2;
      kWakeAcc[i] -= nw;
      for (let q = 0; q < nw; q++) {
        toWorld(k, 0, WH_Y + 0.028, cp[1] - 0.04);
        resetP();
        P.x = _w.x; P.y = _w.y; P.z = _w.z;
        const back = rnd(4.5, 8.5);
        P.vx = kvx * 0.32 - fxT * back; P.vz = kvz * 0.32 - fzT * back;
        P.vy = rnd(0.08, 0.30); P.life = rnd(0.28, 0.40);
        P.s0 = rnd(0.17, 0.25) * Q.size; P.s1 = P.s0 * rnd(2.5, 3.4);
        P.r0 = 0.25; P.g0 = 0.50; P.b0 = 0.78;
        P.r1 = 0.06; P.g1 = 0.15; P.b1 = 0.28;
        P.a0 = 0.22; P.aIn = 0.08; P.aPow = 1.45;
        P.rot = screenAngle(-fxT, P.vy * 0.03, -fzT) + rnd(-0.08, 0.08);
        P.rotV = rnd(-0.2, 0.2); P.grav = 0.08; P.drag = 1.0;
        emit(slipSmoke);
      }
    }

    /* ---- off-road dirt ---- */
    if (grounded && Math.abs(k.t) > 1 && spd > 2.5) {
      kDustAcc[i] += 46 * Q.rate * near * dt * (0.35 + 0.65 * spdF);
      let n = kDustAcc[i] | 0;
      if (n > 5) n = 5;
      kDustAcc[i] -= n;
      for (let q = 0; q < n; q++) {
        const sx = (random() < 0.5 ? -1 : 1) * cp[0];
        toWorld(k, sx, WH_Y, cp[1]);
        smokePuff(_w.x, _w.y, _w.z, 1, 1.8, 0.62, 0.50, 0.34, 0.75, 1.15, 0.40);
        if (random() < 0.45) debris(_w.x, _w.y, _w.z, 1, 3.5, 0.30, 0.24, 0.16, 0.14);
      }
    } else {
      kDustAcc[i] *= 0.5;
    }

    /* ---- grit off the road at speed ---- */
    if (grounded && k.onRoad && spd > 11 && !d.active) {
      kGritAcc[i] += 26 * Q.rate * near * dt * spdF;
      let n = kGritAcc[i] | 0;
      if (n > 3) n = 3;
      kGritAcc[i] -= n;
      const fxT = Math.sin(k.travelYaw), fzT = Math.cos(k.travelYaw);
      for (let q = 0; q < n; q++) {
        const sx = (random() < 0.5 ? -1 : 1) * cp[0];
        toWorld(k, sx, WH_Y, cp[1]);
        resetP();
        P.x = _w.x; P.y = _w.y; P.z = _w.z;
        P.vx = fxT * spd * 0.35 + rnd(-1, 1);
        P.vz = fzT * spd * 0.35 + rnd(-1, 1);
        P.vy = rnd(0.6, 2.2);
        P.life = rnd(0.5, 1.0);
        P.s0 = 0.42 * rnd(0.7, 1.3) * Q.size; P.s1 = P.s0 * 3.4;
        P.r0 = 0.72; P.g0 = 0.66; P.b0 = 0.62;
        P.r1 = 0.40; P.g1 = 0.36; P.b1 = 0.35;
        P.a0 = 0.16; P.aIn = 0.2; P.aPow = 1.6;
        P.rot = random() * 6.28; P.rotV = rnd(-1, 1);
        P.grav = 0.3; P.drag = 1.8;
        emit(smoke);
      }
    }

    /* ---- boost trail ---- */
    if (k.boost > 0) {
      const fxT = Math.sin(k.travelYaw), fzT = Math.cos(k.travelYaw);
      const kvx = fxT * spd, kvz = fzT * spd;
      kTrailAcc[i] += (focusKart ? 124 : 100) * Q.rate * near * (focusKart ? 1 : 0.16) * dt;
      let n = kTrailAcc[i] | 0;
      if (n > 12) n = 12;
      kTrailAcc[i] -= n;
      for (let q = 0; q < n; q++) {
        const sx = (random() < 0.5 ? -EX_X : EX_X);
        toWorld(k, sx, EX_Y + rnd(-0.05, 0.05), cp[1] + EX_Z);
        /* the flame is attached to the kart, so it keeps most of the
           kart's velocity and only slides backwards out of the pipe */
        const v = rnd(16, 27);
        resetP();
        P.x = _w.x; P.y = _w.y; P.z = _w.z;
        P.vx = kvx * 0.40 - fxT * v + rnd(-1.0, 1.0);
        P.vz = kvz * 0.40 - fzT * v + rnd(-1.0, 1.0);
        P.vy = rnd(-0.2, 1.4);
        P.life = rnd(0.12, 0.26);
        const flameScale = focusKart ? 1.15 : 0.70;
        P.s0 = rnd(0.14, 0.28) * Q.size * flameScale; P.s1 = P.s0 * 2.7;
        P.r0 = 1.90; P.g0 = 2.15; P.b0 = 2.45;
        P.r1 = 1.45; P.g1 = 0.38; P.b1 = 0.03;
        P.a0 = focusKart ? 0.66 : 0.42; P.aPow = 1.55; P.aIn = 0;
        P.rot = screenAngle(-fxT, P.vy * 0.02, -fzT) + rnd(-0.08, 0.08);
        P.drag = 2.2;
        emit(flame);
      }
    } else {
      kTrailAcc[i] = 0;
    }

    /* ---- landing ---- */
    if (grounded && !kPrevGround[i] && kPrevVy[i] < -3.5) {
      const mag = ZC.clamp01(-kPrevVy[i] / 16);
      smokePuff(k.x, k.y, k.z, 6 + (mag * 8) | 0, 3.0, 0.78, 0.74, 0.70, 0.8, 0.85, 0.35);
      debris(k.x, k.y, k.z, 4 + (mag * 8) | 0, 4.5, 0.32, 0.27, 0.2, 0.16);
      sparkBurst(k.x, k.y + 0.1, k.z, 6, 5, COL_DUSTLIT, 0.22, 0.3, -18);
    }

    /* ---- respawn: the teleport has to read as an arrival ---- */
    if (!k.falling && kPrevFall[i]) {
      const CY = COL_ARRIVE;
      ring(k.x, k.y, k.z, 20, 0.4, 3.6, 10, 0.5, CY, 0.55, 0.4);
      smokePuff(k.x, k.y, k.z, 12, 2.6, 0.85, 0.86, 0.9, 0.8, 1.0, 0.42);
      for (let q = 0; q < 20; q++) {
        const th = random() * 6.28;
        const r = rnd(0.2, 1.5);
        resetP();
        P.x = k.x + Math.cos(th) * r; P.y = k.y - 0.5; P.z = k.z + Math.sin(th) * r;
        P.vy = rnd(7, 20); P.vx = rnd(-1, 1); P.vz = rnd(-1, 1);
        P.life = rnd(0.35, 0.7);
        P.s0 = rnd(0.16, 0.34); P.s1 = P.s0 * 0.2;
        P.r0 = CY[0]; P.g0 = CY[1]; P.b0 = CY[2];
        P.r1 = CY[3]; P.g1 = CY[4]; P.b1 = CY[5];
        P.a0 = 1; P.aPow = 1.4; P.aIn = 0;
        P.rot = random() * 6.28; P.rotV = rnd(-8, 8);
        P.drag = 1.2;
        emit(sparks);
      }
    }

    kPrevGround[i] = grounded ? 1 : 0;
    kPrevFall[i] = k.falling ? 1 : 0;
    kPrevVy[i] = k.vy;
  }

  /* ------------------------------------------------------------------
     Fixed-slot writers
     ------------------------------------------------------------------ */
  function writeFlares(karts, n, time, dt, focus) {
    const pos = flares.pos, col = flares.col, siz = flares.siz, alp = flares.alp, rot = flares.rot;
    for (let i = 0; i < MAXK; i++) {
      const base = i * FLARE_PER_KART;
      const k = (i < n) ? karts[i] : null;
      if (!k) {
        for (let s = 0; s < FLARE_PER_KART; s++) { alp[base + s] = 0; siz[base + s] = 0; }
        continue;
      }
      kBoostPop[i] = Math.max(0, kBoostPop[i] - dt * 4.5);
      kDriftPop[i] = Math.max(0, kDriftPop[i] - dt * 4.0);

      /* 0,1 — bright spark cores locked to the rear wheel contacts while
         drifting. The focus kart gets a deliberate silhouette hit; the
         quieter rival scale keeps the road from becoming a light carpet. */
      const d = k.drift;
      const sparking = d.active && k.grounded && !k.falling && k.speed > 8;
      const tier = Math.min(3, d.tier);
      const cp = contactOf(k);
      let swell = 0;
      if (sparking) {
        const thresholds = ZC.Kart.TUNE.driftTiers;
        let lo = 0, hi = thresholds[0];
        if (tier === 1) { lo = thresholds[0]; hi = thresholds[1]; }
        else if (tier === 2) { lo = thresholds[1]; hi = thresholds[2]; }
        else if (tier === 3) { lo = thresholds[2]; hi = thresholds[2] + 1.2; }
        swell = ZC.clamp01((d.charge - lo) / Math.max(0.001, hi - lo));
      }
      for (let s = 0; s < 2; s++) {
        const idx = base + s;
        const i3 = idx * 3;
        if (!sparking) { alp[idx] = 0; siz[idx] = 0; continue; }
        const side = s === 0 ? -cp[0] : cp[0];
        const bias = (Math.sign(side) === d.dir) ? 1 : 0.30;
        toWorld(k, side, WH_Y + 0.025, cp[1]);
        pos[i3] = _w.x; pos[i3 + 1] = _w.y; pos[i3 + 2] = _w.z;
        const flick = 0.78 + 0.22 * Math.sin(time * 47 + i * 2.1 + s * 3.1);
        const ct = TIER_COL[tier];
        col[i3] = ct[0] * 0.72; col[i3 + 1] = ct[1] * 0.72; col[i3 + 2] = ct[2] * 0.72;
        const focusScale = k === focus ? 2.02 : 0.14;
        siz[idx] = (0.32 + tier * 0.10 + swell * 0.13 + kDriftPop[i] * 0.22) * bias * flick * focusScale * Q.size;
        alp[idx] = (tier === 0 ? 0.48 : 0.94) * bias * flick * focusScale;
        rot[idx] = 0;
      }

      /* 2,3 — a fixed hot source at the authored rear flame. The streak
         layer carries the direction; this point-sprite core makes the
         direction's origin survive a chase-camera read. */
      const boosting = (k.boost > 0 || kBoostPop[i] > 0.01) && !k.falling;
      for (let s = 0; s < 2; s++) {
        const idx = base + 2 + s;
        const i3 = idx * 3;
        if (!boosting) { alp[idx] = 0; siz[idx] = 0; continue; }
        toWorld(k, s === 0 ? -EX_X : EX_X, EX_Y, cp[1] + EX_Z);
        pos[i3] = _w.x; pos[i3 + 1] = _w.y; pos[i3 + 2] = _w.z;
        const flick = 0.86 + 0.14 * Math.sin(time * 51 + i * 2.3 + s * 2.1);
        const focusScale = k === focus ? 1.20 : 0.16;
        col[i3] = 3.2; col[i3 + 1] = 1.55; col[i3 + 2] = 0.16;
        siz[idx] = (0.42 + kBoostPop[i] * 0.28) * flick * focusScale * Q.size;
        alp[idx] = 0.82 * flick * focusScale;
        rot[idx] = 0;
      }
    }
    const at = flares.geo.attributes;
    at.position.needsUpdate = true; at.aColor.needsUpdate = true;
    at.aSize.needsUpdate = true; at.aAlpha.needsUpdate = true; at.aRot.needsUpdate = true;
  }

  function writeJets(karts, n, focus, time) {
    const pos = jets.pos, col = jets.col, siz = jets.siz, alp = jets.alp, rot = jets.rot;
    for (let i = 0; i < MAXK; i++) {
      const base = i * JET_PER_KART;
      const k = (i < n) ? karts[i] : null;
      const on = k && (k.boost > 0 || kBoostPop[i] > 0.01) && !k.falling;
      const cp = k ? contactOf(k) : DEFAULT_CONTACT;
      for (let s = 0; s < JET_PER_KART; s++) {
        const idx = base + s, i3 = idx * 3;
        if (!on) { alp[idx] = 0; siz[idx] = 0; continue; }
        const side = s === 0 ? -EX_X : EX_X;
        toWorld(k, side, EX_Y, cp[1] + EX_Z);
        pos[i3] = _w.x; pos[i3 + 1] = _w.y; pos[i3 + 2] = _w.z;
        const flick = 0.84 + 0.16 * Math.sin(time * 57 + i * 1.9 + s * 2.7);
        const focusScale = k === focus ? 1.18 : 0.16;
        col[i3] = 1.75; col[i3 + 1] = 2.05; col[i3 + 2] = 2.40;
        siz[idx] = (1.85 + kBoostPop[i] * 0.65) * flick * focusScale * Q.size;
        alp[idx] = 0.86 * flick * focusScale;
        const fx = Math.sin(k.travelYaw), fz = Math.cos(k.travelYaw);
        rot[idx] = screenAngle(-fx, 0.04, -fz);
      }
    }
    const at = jets.geo.attributes;
    at.position.needsUpdate = true; at.aColor.needsUpdate = true;
    at.aSize.needsUpdate = true; at.aAlpha.needsUpdate = true; at.aRot.needsUpdate = true;
  }

  function writeStars(karts, n, time, dt) {
    const pos = stars.pos, col = stars.col, siz = stars.siz, alp = stars.alp, rot = stars.rot;
    for (let i = 0; i < MAXK; i++) {
      const base = i * STARS_PER_KART;
      const k = (i < n) ? karts[i] : null;
      const on = k && (k.spin > 0) && !k.falling;
      if (!on) {
        for (let s = 0; s < STARS_PER_KART; s++) { alp[base + s] = 0; siz[base + s] = 0; }
        continue;
      }
      kStarPhase[i] += dt * 7.5;
      const fade = ZC.clamp01(k.spin / 0.25);
      for (let s = 0; s < STARS_PER_KART; s++) {
        const idx = base + s, i3 = idx * 3;
        const a = kStarPhase[i] + (s / STARS_PER_KART) * 6.283;
        pos[i3] = k.x + Math.cos(a) * 0.95;
        pos[i3 + 1] = k.y + 2.05 + Math.sin(a * 2) * 0.16;
        pos[i3 + 2] = k.z + Math.sin(a) * 0.95;
        col[i3] = 3.2; col[i3 + 1] = 2.5; col[i3 + 2] = 0.6;
        const tw = 0.75 + 0.25 * Math.sin(time * 15 + s * 2.0);
        siz[idx] = 0.52 * tw;
        alp[idx] = fade * tw;
        rot[idx] = a * 0.6;
      }
    }
    const at = stars.geo.attributes;
    at.position.needsUpdate = true; at.aColor.needsUpdate = true;
    at.aSize.needsUpdate = true; at.aAlpha.needsUpdate = true; at.aRot.needsUpdate = true;
  }

  /* Speed lines. The chase camera already opens its FOV with speed;
     these are the other half of the trick — radial streaks racing out
     past the edges of the frame. */
  let speedAmt = 0;
  function writeSpeed(player, camera, dt, time) {
    let want = 0;
    const boosted = !!(player && player.boost > 0);
    if (player) {
      want = ZC.clamp01((player.speed - 24) / 7) * 0.22;
      if (boosted) want = Math.min(0.72, want + 0.48);
      if (player.falling || player.spin > 0) want *= 0.25;
    }
    speedAmt = ZC.damp(speedAmt, want, want > speedAmt ? 13 : 5, dt);

    const live = (speedAmt < 0.02) ? 0 : Math.min(Q.streaks, Math.ceil(Q.streaks * ZC.clamp01(speedAmt)));
    speed.geo.setDrawRange(0, live);
    if (live === 0) return;

    const pos = speed.pos, col = speed.col, siz = speed.siz, alp = speed.alp, rot = speed.rot;
    /* half-height of the frame at the plane the streaks sit on */
    const dPlane = 2.2;
    const halfH = Math.tan((camera.fov * Math.PI / 180) * 0.5) * dPlane;
    const halfW = halfH * camera.aspect;
    const reach = Math.sqrt(halfH * halfH + halfW * halfW);
    /* The road's vanishing point is the travel vector projected onto this
       camera plane. On banked corners it is not the screen centre. */
    let vanishX = 0, vanishY = 0;
    if (player) {
      const fx = Math.sin(player.travelYaw), fz = Math.cos(player.travelYaw);
      const vx = fx * cRX + fz * cRZ;
      const vy = fx * cUX + fz * cUZ;
      const vz = fx * cFX + fz * cFZ;
      if (vz > 0.12) {
        vanishX = ZC.clamp(vx / vz * dPlane, -halfW * 0.42, halfW * 0.42);
        vanishY = ZC.clamp(vy / vz * dPlane, -halfH * 0.36, halfH * 0.36);
      }
    }

    for (let i = 0; i < live; i++) {
      const i3 = i * 3;
      /* each streak sweeps outward on its own loop */
      let u = (speed.ph[i] + time * speed.spd[i] * (0.5 + speedAmt * 1.4)) % 1;
      const a = speed.ang[i] + Math.sin(time * 0.6 + i) * 0.05;
      const rr = (0.34 + u * u * 1.08) * reach * speed.rad[i];
      const sx = Math.cos(a) * rr;
      const sy = Math.sin(a) * rr;
      const px = vanishX + sx, py = vanishY + sy;
      pos[i3] = cPX + cFX * dPlane + cRX * px + cUX * py;
      pos[i3 + 1] = cPY + cFY * dPlane + cRY * px + cUY * py;
      pos[i3 + 2] = cPZ + cFZ * dPlane + cRZ * px + cUZ * py;
      /* warm at cruising speed, whiter under boost */
      const hot = ZC.clamp01((speedAmt - 0.45) / 0.5);
      col[i3] = boosted ? 2.10 : 1.25;
      col[i3 + 1] = boosted ? 0.98 + 0.22 * hot : 0.72 + 0.16 * hot;
      col[i3 + 2] = boosted ? 0.12 + 0.20 * hot : 0.18 + 0.12 * hot;
      /* fade in from the middle, out at the rim */
      const env = Math.sin(Math.min(1, u) * Math.PI);
      const lineScale = boosted ? 1.05 : 0.82;
      siz[i] = (0.07 + u * 0.18) * ZC.clamp01(speedAmt) * dPlane * 0.34 * lineScale;
      alp[i] = (boosted ? 0.38 : 0.26) * env * ZC.clamp01(speedAmt);
      rot[i] = -a;
    }
    const at = speed.geo.attributes;
    at.position.needsUpdate = true; at.aColor.needsUpdate = true;
    at.aSize.needsUpdate = true; at.aAlpha.needsUpdate = true; at.aRot.needsUpdate = true;
  }

  function writeMotes(dt, time) {
    const live = motes.live;
    motes.geo.setDrawRange(0, live);
    if (live === 0) return;
    const pos = motes.pos, alp = motes.alp, seed = motes.seed;
    const H = MOTE_BOX, HY = MOTE_BOX * 0.5;
    for (let i = 0; i < live; i++) {
      const i3 = i * 3;
      const s = seed[i];
      pos[i3] += Math.sin(time * 0.32 + s) * 0.42 * dt;
      pos[i3 + 1] += (0.22 + Math.sin(time * 0.5 + s * 1.7) * 0.3) * dt;
      pos[i3 + 2] += Math.cos(time * 0.27 + s * 1.3) * 0.42 * dt;
      /* wrap around the camera so the cloud is always in front of you */
      let dx = pos[i3] - cPX;
      if (dx > H) pos[i3] -= H * 2; else if (dx < -H) pos[i3] += H * 2;
      let dy = pos[i3 + 1] - cPY;
      if (dy > HY) pos[i3 + 1] -= HY * 2; else if (dy < -HY) pos[i3 + 1] += HY * 2;
      let dz = pos[i3 + 2] - cPZ;
      if (dz > H) pos[i3 + 2] -= H * 2; else if (dz < -H) pos[i3 + 2] += H * 2;
      /* dim at the edge of the box so nothing pops as it wraps */
      dx = pos[i3] - cPX; dy = pos[i3 + 1] - cPY; dz = pos[i3 + 2] - cPZ;
      const dist2 = dx * dx + dy * dy + dz * dz;
      const near = ZC.clamp01(1 - dist2 / (H * H));
      alp[i] = 0.70 * near * near * (0.45 + 0.55 * Math.sin(time * 1.6 + s * 3.1));
    }
    const at = motes.geo.attributes;
    at.position.needsUpdate = true;
    at.aAlpha.needsUpdate = true;
  }

  /* ------------------------------------------------------------------
     Frame
     ------------------------------------------------------------------ */
  let uScale = 400;

  function update(ctx) {
    const dt = ctx.dt;
    if (!(dt > 0)) return;
    const camera = ctx.camera;
    const karts = ctx.karts;
    const time = ctx.time;

    /* camera basis, straight out of the world matrix — no Vector3 */
    const e = camera.matrixWorld.elements;
    cRX = e[0]; cRY = e[1]; cRZ = e[2];
    cUX = e[4]; cUY = e[5]; cUZ = e[6];
    cFX = -e[8]; cFY = -e[9]; cFZ = -e[10];
    cPX = e[12]; cPY = e[13]; cPZ = e[14];

    /* keep gl_PointSize honest across resizes and device pixel ratios */
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const wantScale = Math.max(1, window.innerHeight * dpr) * 0.5;
    if (Math.abs(wantScale - uScale) > 0.5) {
      uScale = wantScale;
      for (let i = 0; i < materials.length; i++) materials[i].uniforms.uScale.value = uScale;
    }

    const n = (karts && karts.length) ? Math.min(karts.length, MAXK) : 0;
    liveKarts = n ? karts : null;
    if (n) {
      for (let i = 0; i < n; i++) {
        const k = karts[i];
        const dx = k.x - cPX, dy = k.y - cPY, dz = k.z - cPZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < Q.cull) driveKart(k, i, dt, dist, time, ctx.player);
        else {
          kPrevGround[i] = (k.grounded && !k.falling) ? 1 : 0;
          kPrevFall[i] = k.falling ? 1 : 0;
          kPrevVy[i] = k.vy;
        }
      }
    }
    /* Write even for an empty field so a transient race rebuild cannot
       leave boost anchors or spin stars frozen in the old scene state. */
    writeFlares(karts, n, time, dt, ctx.player);
    writeJets(karts, n, ctx.player, time);
    writeStars(karts, n, time, dt);

    for (let i = 0; i < pools.length; i++) {
      stepLayer(pools[i], dt);
      uploadLayer(pools[i]);
    }

    writeSpeed(ctx.player, camera, dt, time);
    writeMotes(dt, time);
  }

  function setQuality(tier) {
    const t = (tier | 0);
    Q = TIERS[t < 0 ? 0 : (t > 2 ? 2 : t)];
    for (let i = 0; i < pools.length; i++) {
      const L = pools[i];
      L.liveCap = Math.max(16, Math.round(L.capacity * Q.live));
      if (L.count > L.liveCap) L.count = L.liveCap;
    }
    motes.live = Math.min(MOTE_CAP, Q.motes);
    for (let i = 0; i < MOTE_CAP; i++) if (i >= motes.live) motes.alp[i] = 0;
    motes.geo.attributes.aAlpha.needsUpdate = true;
  }

  function dispose() {
    for (const [name, fn] of listeners) ZC.off(name, fn);
    listeners.length = 0;
    for (const o of objects) { if (o.parent) o.parent.remove(o); }
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of textures) t.dispose();
    objects.length = 0;
    liveKarts = null;
  }

  setQuality(ZC.quality ? ZC.quality.tier : 2);

  return { update, setQuality, dispose };
}
