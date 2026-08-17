/* =====================================================================
   ZEPHYR CIRCUIT — render/karts.js
   Kart shells, wheels, drivers and the drift sparks.
   Owner: agent-models (this first pass written by the lead).

   Every shape is a primitive. There are no model files because none can
   be authored, so the silhouette has to come from proportion and colour:
   a low wide wedge, fat rear tyres, a driver sitting high enough to read
   at distance.
   ===================================================================== */
import * as THREE from 'three';

const ZC = window.ZC;

/* Shared geometry and materials. Eight karts on screen means eight of
   everything unless these are built once and reused. */
const GEO = {};
const MAT = {};

function initShared() {
  if (GEO.body) return;

  GEO.body = new THREE.BoxGeometry(1.7, 0.52, 3.0);
  GEO.nose = new THREE.ConeGeometry(0.78, 1.5, 4);
  GEO.cowl = new THREE.BoxGeometry(1.32, 0.44, 1.1);
  GEO.wingPost = new THREE.BoxGeometry(0.14, 0.42, 0.14);
  GEO.wing = new THREE.BoxGeometry(1.9, 0.11, 0.52);
  GEO.wheel = new THREE.CylinderGeometry(0.42, 0.42, 0.40, 12);
  GEO.wheelRear = new THREE.CylinderGeometry(0.50, 0.50, 0.54, 12);
  GEO.head = new THREE.SphereGeometry(0.30, 10, 8);
  GEO.torso = new THREE.CapsuleGeometry(0.26, 0.34, 3, 8);
  GEO.visor = new THREE.BoxGeometry(0.34, 0.13, 0.28);
  GEO.spark = new THREE.TetrahedronGeometry(0.24);
  GEO.flame = new THREE.ConeGeometry(0.34, 1.5, 7);

  MAT.tyre = new THREE.MeshLambertMaterial({ color: 0x15151b, flatShading: true });
  MAT.trim = new THREE.MeshLambertMaterial({ color: 0x2a2a34, flatShading: true });
  MAT.chrome = new THREE.MeshLambertMaterial({ color: 0x9aa2b4, flatShading: true });
  MAT.visor = new THREE.MeshLambertMaterial({ color: 0x1b2b3a, flatShading: true });
  MAT.skin = new THREE.MeshLambertMaterial({ color: 0xd9a173, flatShading: true });

  /* Drift sparks are additive and unlit so bloom picks them up and they
     read as light rather than as little painted triangles. */
  MAT.sparkTier = [
    new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xff5aa0, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false }),
  ];
  MAT.flame = new THREE.MeshBasicMaterial({
    color: 0x8fd8ff, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

const SPARKS_PER_SIDE = 5;

export function buildKart(colourHex) {
  initShared();
  const g = new THREE.Group();

  const shell = new THREE.MeshLambertMaterial({ color: colourHex, flatShading: true });
  const shellDark = new THREE.MeshLambertMaterial({
    color: new THREE.Color(colourHex).multiplyScalar(0.55), flatShading: true,
  });

  const body = new THREE.Mesh(GEO.body, shell);
  body.position.y = 0.46;
  body.castShadow = true;
  g.add(body);

  const nose = new THREE.Mesh(GEO.nose, shell);
  nose.rotation.x = Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.set(0, 0.42, 2.0);
  nose.castShadow = true;
  g.add(nose);

  const cowl = new THREE.Mesh(GEO.cowl, shellDark);
  cowl.position.set(0, 0.80, -0.62);
  cowl.castShadow = true;
  g.add(cowl);

  /* rear wing, on two posts */
  for (const sx of [-0.62, 0.62]) {
    const post = new THREE.Mesh(GEO.wingPost, MAT.trim);
    post.position.set(sx, 0.86, -1.42);
    g.add(post);
  }
  const wing = new THREE.Mesh(GEO.wing, shellDark);
  wing.position.set(0, 1.09, -1.46);
  wing.castShadow = true;
  g.add(wing);

  /* wheels — fat at the back, which is most of why a kart reads as a
     kart rather than as a car */
  const wheels = [];
  const layout = [
    [-0.92, 0.42, 1.06, GEO.wheel],
    [0.92, 0.42, 1.06, GEO.wheel],
    [-0.98, 0.50, -1.06, GEO.wheelRear],
    [0.98, 0.50, -1.06, GEO.wheelRear],
  ];
  for (const [x, y, z, geo] of layout) {
    const w = new THREE.Mesh(geo, MAT.tyre);
    w.position.set(x, y, z);
    w.rotation.z = Math.PI / 2;
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }

  /* driver */
  const torso = new THREE.Mesh(GEO.torso, shellDark);
  torso.position.set(0, 1.00, -0.10);
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(GEO.head, MAT.skin);
  head.position.set(0, 1.46, -0.06);
  head.castShadow = true;
  g.add(head);
  const visor = new THREE.Mesh(GEO.visor, MAT.visor);
  visor.position.set(0, 1.46, 0.20);
  g.add(visor);

  /* drift sparks, one small fan behind each rear wheel */
  const sparks = [];
  for (const sx of [-1.0, 1.0]) {
    for (let i = 0; i < SPARKS_PER_SIDE; i++) {
      const sp = new THREE.Mesh(GEO.spark, MAT.sparkTier[0]);
      sp.position.set(sx, 0.22, -1.2);
      sp.visible = false;
      sp.userData.side = sx;
      sp.userData.phase = i / SPARKS_PER_SIDE;
      g.add(sp);
      sparks.push(sp);
    }
  }

  /* boost flame out of the back */
  const flame = new THREE.Mesh(GEO.flame, MAT.flame.clone());
  flame.rotation.x = Math.PI / 2;
  flame.position.set(0, 0.5, -2.0);
  flame.visible = false;
  g.add(flame);

  g.userData = { wheels, sparks, flame, spin: 0 };
  return g;
}

/* ------------------------------------------------------------------
   Per-frame sync. Reads the kart, writes the mesh. Never the reverse.
   ------------------------------------------------------------------ */
const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');

export function syncKart(mesh, kart, track, dt, time) {
  mesh.position.set(kart.x, kart.y, kart.z);

  /* The shell points where the body points, not where it is going —
     that gap IS the drift, and hiding it would hide the whole mechanic. */
  const lean = -kart.slip * 0.45;
  const proj = kart._proj;
  /* pitch and roll follow the road surface so a kart on camber leans with
     it instead of standing upright on a tilted road */
  const roll = lean + (proj && proj.ry !== undefined ? Math.asin(ZC.clamp(proj.ry, -1, 1)) * -1 : 0);
  const pitch = proj && proj.ty !== undefined ? Math.asin(ZC.clamp(proj.ty, -1, 1)) : 0;

  _e.set(pitch, kart.bodyYaw, roll);
  _q.setFromEuler(_e);
  mesh.quaternion.slerp(_q, 1 - Math.exp(-18 * dt));

  const ud = mesh.userData;

  /* wheels spin with road speed and the fronts steer */
  ud.spin += kart.speed * dt * 2.2;
  for (let i = 0; i < ud.wheels.length; i++) {
    const w = ud.wheels[i];
    w.rotation.x = ud.spin;
    if (i < 2) w.rotation.y = ZC.clamp(kart.slip * 0.6, -0.5, 0.5);
  }

  /* drift sparks: colour by tier, so the player can see the payout
     building without looking away from the road */
  const tier = kart.drift.tier;
  const sparking = kart.drift.active && tier > 0;
  for (let i = 0; i < ud.sparks.length; i++) {
    const sp = ud.sparks[i];
    sp.visible = sparking;
    if (!sparking) continue;
    sp.material = MAT.sparkTier[Math.min(tier, 3) - 1];
    const ph = (time * 9 + sp.userData.phase * 6.28) % 1;
    sp.position.set(
      sp.userData.side * (1.0 + ph * 0.5),
      0.18 + ph * 0.75,
      -1.2 - ph * 1.5);
    const sc = (1 - ph) * (0.6 + tier * 0.22);
    sp.scale.setScalar(Math.max(0.05, sc));
  }

  /* boost flame */
  const boosting = kart.boost > 0;
  ud.flame.visible = boosting;
  if (boosting) {
    const f = 0.6 + 0.4 * Math.sin(time * 40);
    ud.flame.material.opacity = 0.85 * f;
    ud.flame.scale.set(1, 0.7 + f * 0.9, 1);
  }
}
