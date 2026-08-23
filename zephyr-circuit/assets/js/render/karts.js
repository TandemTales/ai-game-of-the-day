/* =====================================================================
   ZEPHYR CIRCUIT — render/karts.js
   Eight procedural kart characters and their animation.
   Owner: agent-models.

   Identity comes from silhouette first and livery second. At chase-camera
   distance the field reads as bird / insect / turbine / hot-rod / sun /
   thorn / armour / forest. Geometry and materials are cached; syncKart
   only mutates existing transforms and allocates nothing.
   ===================================================================== */
import * as THREE from 'three';

const ZC = window.ZC;
const GEO = Object.create(null);
const MAT = Object.create(null);
const RACER_MAT = new Map();

function shared(name, geometry) { geometry.__shared = true; GEO[name] = geometry; }

function initShared() {
  if (GEO.box) return;
  shared('box', new THREE.BoxGeometry(1, 1, 1));
  shared('wedge', new THREE.ConeGeometry(0.5, 1, 4));
  shared('cone', new THREE.ConeGeometry(0.5, 1, 7));
  shared('cyl8', new THREE.CylinderGeometry(0.5, 0.5, 1, 8));
  shared('sphere', new THREE.SphereGeometry(0.5, 8, 6));
  shared('head', new THREE.SphereGeometry(0.5, 10, 7));
  shared('torso', new THREE.CapsuleGeometry(0.5, 0.55, 2, 7));
  shared('octa', new THREE.OctahedronGeometry(0.5, 0));
  shared('wheel', new THREE.CylinderGeometry(0.5, 0.5, 0.42, 10));
  shared('wheelRear', new THREE.CylinderGeometry(0.5, 0.5, 0.54, 10));
  shared('ring', new THREE.TorusGeometry(0.5, 0.095, 5, 12));
  shared('spark', new THREE.TetrahedronGeometry(0.24));
  shared('flame', new THREE.ConeGeometry(0.34, 1.5, 7));

  MAT.tyre = new THREE.MeshLambertMaterial({ color: 0x111219, flatShading: true });
  MAT.trim = new THREE.MeshLambertMaterial({ color: 0x272a34, flatShading: true });
  MAT.chrome = new THREE.MeshLambertMaterial({ color: 0xb7c1d2, flatShading: true });
  MAT.visor = new THREE.MeshLambertMaterial({ color: 0x13283b, emissive: 0x07131d, flatShading: true });
  MAT.light = new THREE.MeshLambertMaterial({ color: 0xf4f0df, flatShading: true });
  for (const k in MAT) MAT[k].__shared = true;
  MAT.sparkTier = [
    new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xff5aa0, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }),
  ];
  MAT.flame = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  MAT.flame.__shared = true;
}

const ACCENT = {
  kestrel: 0xffe6a3, mantis: 0xeaff68, cobalt: 0x80efff, ember: 0xffd04a,
  saffron: 0xfff1a1, thistle: 0xff8ed8, pewter: 0xffc34d, moss: 0xd8ff85,
};
const SKIN = {
  kestrel: 0xc97f58, mantis: 0x7a4a32, cobalt: 0xe6b58d, ember: 0x8d573e,
  saffron: 0xd99568, thistle: 0x6c402f, pewter: 0xb86f4c, moss: 0x4c3028,
};

function materialsFor(id, colourHex) {
  const key = id + ':' + colourHex;
  let m = RACER_MAT.get(key);
  if (m) return m;
  const base = new THREE.Color(colourHex);
  m = {
    shell: new THREE.MeshLambertMaterial({ color: base, flatShading: true }),
    dark: new THREE.MeshLambertMaterial({ color: base.clone().multiplyScalar(0.42), flatShading: true }),
    pale: new THREE.MeshLambertMaterial({ color: base.clone().lerp(new THREE.Color(0xffffff), 0.52), flatShading: true }),
    accent: new THREE.MeshLambertMaterial({ color: ACCENT[id], emissive: ACCENT[id], emissiveIntensity: 0.12, flatShading: true }),
    skin: new THREE.MeshLambertMaterial({ color: SKIN[id], flatShading: true }),
  };
  for (const k in m) m[k].__shared = true;
  RACER_MAT.set(key, m);
  return m;
}

function part(parent, geometry, material, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const p = new THREE.Mesh(geometry, material);
  p.position.set(x, y, z); p.scale.set(sx, sy, sz); p.rotation.set(rx, ry, rz);
  p.castShadow = true; parent.add(p); return p;
}
function bar(parent, material, x, y, z, sx, sy, sz, rz = 0) {
  return part(parent, GEO.box, material, x, y, z, sx, sy, sz, 0, 0, rz);
}

const PROFILES = {
  kestrel: { wheelX: 0.94, frontZ: 1.12, rearZ: -1.08, frontR: 0.39, rearR: 0.50, driverY: 0.70, driverZ: -0.18 },
  mantis:  { wheelX: 0.98, frontZ: 1.12, rearZ: -1.05, frontR: 0.37, rearR: 0.47, driverY: 0.69, driverZ: -0.30 },
  cobalt:  { wheelX: 1.22, frontZ: 1.02, rearZ: -1.10, frontR: 0.46, rearR: 0.55, driverY: 0.80, driverZ: -0.38 },
  ember:   { wheelX: 1.00, frontZ: 1.22, rearZ: -1.20, frontR: 0.40, rearR: 0.60, driverY: 0.72, driverZ: -0.38 },
  saffron: { wheelX: 1.08, frontZ: 0.94, rearZ: -0.94, frontR: 0.48, rearR: 0.53, driverY: 0.78, driverZ: -0.26 },
  thistle: { wheelX: 1.05, frontZ: 1.02, rearZ: -1.04, frontR: 0.38, rearR: 0.49, driverY: 0.72, driverZ: -0.30 },
  pewter:  { wheelX: 1.12, frontZ: 1.08, rearZ: -1.08, frontR: 0.48, rearR: 0.56, driverY: 0.94, driverZ: -0.42 },
  moss:    { wheelX: 1.08, frontZ: 0.98, rearZ: -1.02, frontR: 0.46, rearR: 0.52, driverY: 0.76, driverZ: -0.32 },
};

function addWheels(root, p) {
  const wheels = [];
  for (let i = 0; i < 4; i++) {
    const rear = i >= 2, side = (i & 1) ? 1 : -1;
    const r = rear ? p.rearR : p.frontR;
    wheels.push(part(root, rear ? GEO.wheelRear : GEO.wheel, MAT.tyre,
      side * p.wheelX, r, rear ? p.rearZ : p.frontZ, r * 2, 1, r * 2, 0, 0, Math.PI / 2));
  }
  return wheels;
}

function addDriver(root, m, id, y, z) {
  const rig = new THREE.Group(); rig.position.set(0, y, z); root.add(rig);
  part(rig, GEO.torso, m.dark, 0, 0.22, 0, 0.48, 0.58, 0.44);
  const head = part(rig, GEO.head, m.skin, 0, 0.84, 0.02, 0.58, 0.58, 0.58);
  part(rig, GEO.sphere, m.shell, 0, 0.92, -0.02, 0.66, 0.54, 0.64);
  const visor = bar(rig, MAT.visor, 0, 0.90, 0.31, 0.48, 0.14, 0.10);
  let animated;
  if (id === 'kestrel') {
    animated = part(rig, GEO.cone, m.accent, 0, 1.30, -0.10, 0.27, 0.70, 0.25, 0, 0, -0.18);
    part(rig, GEO.wedge, m.shell, -0.47, 0.94, -0.03, 0.35, 0.54, 0.16, 0, 0, -0.70);
    part(rig, GEO.wedge, m.shell, 0.47, 0.94, -0.03, 0.35, 0.54, 0.16, 0, 0, 0.70);
  } else if (id === 'mantis') {
    animated = new THREE.Group(); animated.position.set(0, 1.16, -0.03); rig.add(animated);
    bar(animated, m.accent, -0.24, 0.24, 0, 0.07, 0.62, 0.07, -0.32);
    bar(animated, m.accent, 0.24, 0.24, 0, 0.07, 0.62, 0.07, 0.32);
    part(animated, GEO.sphere, m.accent, -0.34, 0.55, 0, 0.16, 0.16, 0.16);
    part(animated, GEO.sphere, m.accent, 0.34, 0.55, 0, 0.16, 0.16, 0.16);
  } else if (id === 'cobalt') {
    animated = bar(rig, m.accent, 0, 1.23, -0.04, 0.62, 0.13, 0.46);
    bar(rig, MAT.chrome, -0.46, 0.93, -0.02, 0.10, 0.62, 0.10);
    bar(rig, MAT.chrome, 0.46, 0.93, -0.02, 0.10, 0.62, 0.10);
  } else if (id === 'ember') {
    animated = new THREE.Group(); animated.position.set(0, 1.13, -0.12); rig.add(animated);
    for (let i = 0; i < 3; i++) part(animated, GEO.cone, m.accent, 0, i * 0.25, -i * 0.08, 0.28 - i * 0.04, 0.48, 0.20);
  } else if (id === 'saffron') {
    animated = part(rig, GEO.ring, m.accent, 0, 0.93, -0.38, 1.08, 1.08, 1.08);
  } else if (id === 'thistle') {
    animated = part(rig, GEO.cone, m.accent, 0, 1.40, -0.08, 0.62, 1.18, 0.58, 0, 0, -0.12);
    part(rig, GEO.cone, m.shell, -0.52, 1.03, -0.02, 0.22, 0.72, 0.20, 0, 0, -0.72);
    part(rig, GEO.cone, m.shell, 0.52, 1.03, -0.02, 0.22, 0.72, 0.20, 0, 0, 0.72);
  } else if (id === 'pewter') {
    animated = bar(rig, m.accent, 0, 1.28, -0.02, 0.40, 0.16, 0.40);
    part(rig, GEO.box, MAT.chrome, 0, 0.93, -0.03, 0.92, 0.72, 0.76);
    visor.position.z = 0.40;
  } else {
    animated = new THREE.Group(); animated.position.set(0, 1.22, -0.05); rig.add(animated);
    part(animated, GEO.octa, m.accent, -0.34, 0.10, 0, 0.55, 0.24, 0.30, 0, 0, -0.35);
    part(animated, GEO.octa, m.accent, 0.34, 0.10, 0, 0.55, 0.24, 0.30, 0, 0, 0.35);
    part(animated, GEO.octa, m.pale, 0, 0.27, 0, 0.50, 0.26, 0.30);
  }
  return { rig, head, animated };
}

function buildShell(id, s, m, animatedParts) {
  if (id === 'kestrel') {
    bar(s, m.shell, 0, .50, .05, 1.42, .48, 2.85);
    part(s, GEO.wedge, m.accent, 0, .48, 1.82, 1.25, 1.30, 1.25, Math.PI / 2, Math.PI / 4);
    bar(s, m.dark, 0, .76, -.88, 1.18, .42, 1.05); bar(s, m.pale, 0, .77, -1.43, 2.28, .10, .72);
    part(s, GEO.wedge, m.shell, -1.18, .76, -1.62, .42, .92, .22, 0, 0, -.25);
    part(s, GEO.wedge, m.shell, 1.18, .76, -1.62, .42, .92, .22, 0, 0, .25);
  } else if (id === 'mantis') {
    bar(s, m.dark, 0, .45, -.12, 1.14, .48, 2.52); bar(s, m.shell, 0, .72, -.42, .94, .46, 1.08);
    for (const side of [-1, 1]) {
      bar(s, m.shell, side * .65, .46, .96, .32, .28, 1.65, side * -.20);
      part(s, GEO.cone, m.accent, side * .88, .49, 1.82, .28, .70, .30, Math.PI / 2, 0, side * -.20);
    }
    bar(s, m.accent, 0, .72, -1.47, 1.60, .14, .42);
  } else if (id === 'cobalt') {
    bar(s, m.shell, 0, .55, -.08, 1.74, .62, 2.82); bar(s, m.dark, 0, .84, -.65, 1.40, .46, 1.08);
    for (const side of [-1, 1]) {
      part(s, GEO.cyl8, MAT.chrome, side * 1.08, .60, -.24, .90, 1.35, .90, Math.PI / 2);
      animatedParts.push(part(s, GEO.cyl8, m.accent, side * 1.08, .60, .47, .58, .10, .58, Math.PI / 2));
    }
    bar(s, m.pale, 0, .55, 1.55, 1.52, .16, .42);
  } else if (id === 'ember') {
    bar(s, m.dark, 0, .44, -.14, 1.46, .44, 3.20); bar(s, m.shell, 0, .63, .92, 1.18, .36, 1.68);
    part(s, GEO.wedge, m.accent, 0, .62, 1.86, 1.05, .78, 1.02, Math.PI / 2, Math.PI / 4);
    for (const side of [-1, 1]) { bar(s, MAT.chrome, side * .82, .86, -.72, .13, .92, .13); bar(s, MAT.chrome, side, .79, -.94, .12, .70, .12); }
    bar(s, m.accent, 0, .78, -1.57, 2.05, .10, .42);
  } else if (id === 'saffron') {
    bar(s, m.shell, 0, .58, -.12, 1.76, .70, 2.35); part(s, GEO.sphere, m.pale, 0, .70, 1.24, 1.48, .50, 1.12);
    for (const side of [-1, 1]) { part(s, GEO.sphere, m.dark, side * 1.02, .53, .94, .58, .52, .86); part(s, GEO.sphere, m.dark, side * 1.08, .59, -.93, .66, .62, .94); }
    bar(s, m.accent, 0, .64, -1.39, 1.84, .16, .36);
  } else if (id === 'thistle') {
    part(s, GEO.wedge, m.shell, 0, .52, .28, 2.40, 2.80, 1.70, Math.PI / 2, Math.PI / 4); bar(s, m.dark, 0, .70, -.62, 1.12, .48, 1.32);
    for (const side of [-1, 1]) { part(s, GEO.cone, m.accent, side * 1.20, .75, -.82, .34, .98, .28, 0, 0, side * -.22); part(s, GEO.cone, m.shell, side * .94, .55, 1.12, .30, .92, .25, Math.PI / 2); }
  } else if (id === 'pewter') {
    bar(s, m.dark, 0, .50, -.06, 1.88, .72, 2.68); bar(s, m.shell, 0, .86, -.36, 1.52, .72, 1.28); bar(s, m.pale, 0, .60, 1.46, 1.70, .44, .58);
    for (const side of [-1, 1]) { bar(s, MAT.chrome, side * .83, 1.30, -.42, .12, 1.04, .12); bar(s, MAT.chrome, side * .83, 1.78, -.42, .12, .12, 1.30); bar(s, m.accent, side * 1.06, .70, 1.22, .24, .34, .44); }
  } else {
    part(s, GEO.sphere, m.shell, 0, .55, 0, 1.95, .72, 2.56); part(s, GEO.sphere, m.pale, 0, .62, 1.23, 1.72, .52, .92); bar(s, m.dark, 0, .66, -1.26, 1.96, .20, .54);
    for (const side of [-1, 1]) { part(s, GEO.sphere, m.accent, side * .72, .94, 1.26, .45, .45, .45); part(s, GEO.sphere, MAT.visor, side * .72, .98, 1.54, .17, .17, .12); part(s, GEO.octa, m.dark, side * 1.06, .62, -.62, .56, .36, .78, 0, 0, side * .22); }
  }
}

const SPARKS_PER_SIDE = 4;

export function buildKart(colourHex, racerId = 'kestrel') {
  initShared();
  const id = PROFILES[racerId] ? racerId : 'kestrel', p = PROFILES[id], m = materialsFor(id, colourHex);
  const root = new THREE.Group(); root.name = 'kart-' + id;
  const shell = new THREE.Group(); root.add(shell);
  const animatedParts = []; buildShell(id, shell, m, animatedParts);
  const wheels = addWheels(root, p), driver = addDriver(root, m, id, p.driverY, p.driverZ);
  const sparks = [];
  for (const side of [-1, 1]) for (let i = 0; i < SPARKS_PER_SIDE; i++) {
    const sp = part(root, GEO.spark, MAT.sparkTier[0], side * p.wheelX, .22, p.rearZ, 1, 1, 1);
    sp.visible = false; sp.userData.side = side; sp.userData.phase = i / SPARKS_PER_SIDE; sparks.push(sp);
  }
  const flame = part(root, GEO.flame, MAT.flame, 0, .50, p.rearZ - 1.12, 1, 1, 1, Math.PI / 2); flame.visible = false;
  root.userData = { id, wheels, sparks, flame, shell, driver: driver.rig, head: driver.head, animated: driver.animated, animatedParts, spin: 0, wheelX: p.wheelX, rearZ: p.rearZ, driverBaseY: p.driverY };
  return root;
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');

export function syncKart(mesh, kart, track, dt, time) {
  mesh.position.set(kart.x, kart.y, kart.z);
  const proj = kart._proj, lean = -kart.slip * .45;
  const roll = lean + (proj && proj.ry !== undefined ? -Math.asin(ZC.clamp(proj.ry, -1, 1)) : 0);
  const pitch = proj && proj.ty !== undefined ? Math.asin(ZC.clamp(proj.ty, -1, 1)) : 0;
  _e.set(pitch, kart.bodyYaw, roll); _q.setFromEuler(_e); mesh.quaternion.slerp(_q, 1 - Math.exp(-18 * dt));

  const ud = mesh.userData, speedFrac = ZC.clamp01(Math.abs(kart.speed) / 38);
  ud.spin += kart.speed * dt * 2.2;
  for (let i = 0; i < ud.wheels.length; i++) {
    const w = ud.wheels[i]; w.rotation.x = ud.spin;
    if (i < 2) w.rotation.y = ZC.clamp(kart.slip * .6, -.5, .5);
  }
  const pulse = Math.sin(time * (10 + speedFrac * 13) + ud.wheelX) * speedFrac;
  ud.shell.position.y = pulse * .025; ud.driver.position.y = ud.driverBaseY + pulse * .045;
  ud.driver.rotation.z = ZC.clamp(-kart.slip * .22, -.20, .20);
  ud.head.rotation.y = Math.sin(time * 2.8 + ud.rearZ) * .055 + ZC.clamp(kart.slip * .16, -.12, .12);
  if (ud.animated) {
    if (ud.id === 'mantis') ud.animated.rotation.z = Math.sin(time * 8) * .09;
    else if (ud.id === 'saffron') ud.animated.rotation.z = time * .65;
    else if (ud.id === 'ember') ud.animated.scale.y = .92 + Math.sin(time * 13) * .08;
    else if (ud.id === 'moss') ud.animated.rotation.z = Math.sin(time * 3.5) * .13;
    else ud.animated.rotation.z = ZC.clamp(-kart.slip * .30, -.22, .22);
  }
  for (let i = 0; i < ud.animatedParts.length; i++) ud.animatedParts[i].rotation.z -= dt * (9 + speedFrac * 18);

  const tier = kart.drift.tier, sparking = kart.drift.active && tier > 0;
  for (let i = 0; i < ud.sparks.length; i++) {
    const sp = ud.sparks[i]; sp.visible = sparking; if (!sparking) continue;
    sp.material = MAT.sparkTier[Math.min(tier, 3) - 1];
    const ph = (time * 9 + sp.userData.phase * 6.28) % 1;
    sp.position.set(sp.userData.side * (ud.wheelX + ph * .5), .18 + ph * .75, ud.rearZ - .15 - ph * 1.5);
    sp.scale.setScalar(Math.max(.05, (1 - ph) * (.6 + tier * .22)));
  }
  ud.flame.visible = kart.boost > 0;
  if (ud.flame.visible) { const f = .6 + .4 * Math.sin(time * 40); ud.flame.scale.set(1, .7 + f * .9, 1); }
}
