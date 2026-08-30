/* =====================================================================
   ZEPHYR CIRCUIT — render/items.js
   The item game, drawn: boxes, projectiles, hazards and shields.
   Owner: lead. See SPEC.md §0 and §2.5.

   ESM, because it needs three.js. Reads `ZC.Race.state.items` and never
   writes to it — the simulation in `items.js` is authoritative and knows
   nothing about this file.

   Everything here is POOLED and built once. Item boxes are a single
   InstancedMesh, so thirty of them cost one draw call; projectiles,
   hazards and shields come out of fixed-size pools that are hidden rather
   than created and destroyed. Nothing in this file allocates during a
   frame — the scratch objects are all at module scope. A kart racer that
   garbage-collects mid-corner is a kart racer that drops a frame exactly
   when the player is doing the hardest thing in the game.

   Item colours match `ZC.Items.DEFS[id].colour` so the thing flying at
   you is the same colour as the thing in the HUD slot. That is the whole
   readability contract of an item game.
   ===================================================================== */
import * as THREE from 'three';

const ZC = window.ZC;

const MAX_PROJECTILES = 16;
const MAX_HAZARDS = 16;
const MAX_SHIELDS = 8;

/* Scratch — hoisted so the frame loop allocates nothing. */
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);

function colourOf(id, fallback) {
  const def = ZC.Items && ZC.Items.DEFS[id];
  return new THREE.Color(def ? def.colour : (fallback || 0xffffff));
}

/* ------------------------------------------------------------------
   Item box.

   A translucent shell with a solid spinning core inside it, which is the
   shape every kart racer has converged on for a good reason: the shell
   reads as "a container, drive into it" from any angle, and the core
   spinning at a different rate reads as "this is live and unclaimed"
   even at a distance where the shell is four pixels wide.
   ------------------------------------------------------------------ */
function boxGeometry() {
  return new THREE.BoxGeometry(2.5, 2.5, 2.5);
}

function coreGeometry() {
  return new THREE.OctahedronGeometry(0.85, 0);
}

/* ------------------------------------------------------------------
   Build. One call per track load.
   ------------------------------------------------------------------ */
export function buildItems(track, itemState) {
  const group = new THREE.Group();
  group.name = 'items';

  const boxes = (itemState && itemState.boxes) || [];
  const n = boxes.length;

  /* ---- boxes: two InstancedMeshes, shell and core ---- */
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xbfe9ff,
    emissive: 0x2b6f8c,
    emissiveIntensity: 0.9,
    metalness: 0.1,
    roughness: 0.25,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffd76a,
    emissive: 0xffa62b,
    emissiveIntensity: 1.6,
    metalness: 0.2,
    roughness: 0.35,
  });

  const shell = new THREE.InstancedMesh(boxGeometry(), shellMat, Math.max(1, n));
  const core = new THREE.InstancedMesh(coreGeometry(), coreMat, Math.max(1, n));
  shell.name = 'itemBoxShell';
  core.name = 'itemBoxCore';
  shell.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  core.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shell.frustumCulled = false;
  core.frustumCulled = false;
  shell.castShadow = false;
  shell.receiveShadow = false;
  group.add(shell, core);

  /* ---- projectiles ---- */
  const projectiles = [];
  const gustGeo = new THREE.TorusGeometry(0.95, 0.3, 6, 12);
  const dartGeo = new THREE.ConeGeometry(0.6, 2.1, 7);
  for (let i = 0; i < MAX_PROJECTILES; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.8,
      transparent: true, opacity: 0.95, roughness: 0.4, metalness: 0,
    });
    const mesh = new THREE.Mesh(gustGeo, mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    /* the alternate geometry rides along so a slot can be either kind
       without building anything mid-race */
    mesh.userData.gustGeo = gustGeo;
    mesh.userData.dartGeo = dartGeo;
    mesh.userData.kind = null;
    group.add(mesh);
    projectiles.push(mesh);
  }

  /* ---- hazards: a little cluster of puffs, so a Thunderhead reads as
     weather sitting on the road rather than as a ball ---- */
  const hazards = [];
  const puffGeo = new THREE.IcosahedronGeometry(0.78, 0);
  for (let i = 0; i < MAX_HAZARDS; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9a7bd6, emissive: 0x4b2f7a, emissiveIntensity: 0.8,
      roughness: 0.85, metalness: 0, flatShading: true,
    });
    const cloud = new THREE.Group();
    /* deterministic offsets — ZC.hash2, not Math.random, so the same
       hazard looks the same on a replay */
    for (let p = 0; p < 5; p++) {
      const puff = new THREE.Mesh(puffGeo, mat);
      const a = (p / 5) * Math.PI * 2;
      const r = 0.55 + ZC.hash2(i * 7 + p, p) * 0.35;
      puff.position.set(Math.cos(a) * r, ZC.hash2(p, i) * 0.35, Math.sin(a) * r);
      const s = 0.7 + ZC.hash2(p * 3, i * 5) * 0.55;
      puff.scale.setScalar(s);
      cloud.add(puff);
    }
    cloud.visible = false;
    group.add(cloud);
    hazards.push(cloud);
  }

  /* ---- shields ---- */
  const shields = [];
  /* Sized to hug ONE kart. At 2.5 it was wide enough to enclose three of
     them on the grid, which read as a team shield rather than as
     something the player is wearing. */
  const shieldGeo = new THREE.IcosahedronGeometry(1.95, 1);
  for (let i = 0; i < MAX_SHIELDS; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x7ee08a,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      wireframe: true,
    });
    const mesh = new THREE.Mesh(shieldGeo, mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    group.add(mesh);
    shields.push(mesh);
  }

  group.userData = {
    shell, core, projectiles, hazards, shields,
    boxCount: n,
    /* cached so sync() never calls new THREE.Color */
    colours: {
      gust: colourOf('gust', 0x8fe9ff),
      dart: colourOf('dart', 0xff5a6e),
    },
  };
  return group;
}

/* ------------------------------------------------------------------
   Sync. Called once a frame from render/main.js.
   ------------------------------------------------------------------ */
export function syncItems(group, itemState, karts, time, dt) {
  if (!group || !itemState) return;
  const u = group.userData;

  /* ---- boxes ----
     A collected box is scaled to zero rather than hidden, because an
     InstancedMesh has no per-instance visibility. It pops back with a
     little overshoot as it respawns, which is the cheapest possible way
     to tell the player the road is armed again. */
  const boxes = itemState.boxes;
  const count = Math.min(boxes.length, u.boxCount);
  for (let i = 0; i < count; i++) {
    const box = boxes[i];
    let s = 1;
    if (!box.alive) {
      s = 0;
    } else if (box.timer > 0) {
      s = 0;
    }
    /* respawn pop: `timer` counts down to 0 and is then cleared, so use
       the first moments of being alive again */
    const bob = Math.sin(time * 2.1 + i * 0.7) * 0.28;
    _pos.set(box.x, box.y + 1.7 + bob, box.z);

    _q.setFromAxisAngle(_up, time * 0.9 + i * 0.31);
    _scale.setScalar(s);
    _m4.compose(_pos, _q, _scale);
    u.shell.setMatrixAt(i, _m4);

    /* the core spins the other way, faster, and tumbles */
    _q.setFromAxisAngle(_up, -time * 2.3 - i * 0.5);
    _scale.setScalar(s * (0.95 + Math.sin(time * 3 + i) * 0.06));
    _m4.compose(_pos, _q, _scale);
    u.core.setMatrixAt(i, _m4);
  }
  u.shell.count = count;
  u.core.count = count;
  u.shell.instanceMatrix.needsUpdate = true;
  u.core.instanceMatrix.needsUpdate = true;

  /* ---- projectiles ---- */
  const projs = itemState.projectiles;
  for (let i = 0; i < u.projectiles.length; i++) {
    const mesh = u.projectiles[i];
    const p = i < projs.length ? projs[i] : null;
    if (!p) { mesh.visible = false; continue; }

    if (mesh.userData.kind !== p.kind) {
      mesh.userData.kind = p.kind;
      mesh.geometry = (p.kind === 'dart') ? mesh.userData.dartGeo : mesh.userData.gustGeo;
      const c = (p.kind === 'dart') ? u.colours.dart : u.colours.gust;
      mesh.material.color.copy(c);
      mesh.material.emissive.copy(c);
    }
    mesh.visible = true;

    /* Heading from where it was last frame. Both shapes are authored with
       their axis along +Y, so both want the same "lie down and point along
       the road" quaternion; only the spin differs. Doing this as a pair of
       quaternions rather than Euler angles avoids caring what order three
       applies rotations in, which is exactly the sort of detail that ends
       up looking fine on a straight and wrong in a corner. */
    const dx = p.x - (mesh.userData.lastX === undefined ? p.x : mesh.userData.lastX);
    const dz = p.z - (mesh.userData.lastZ === undefined ? p.z : mesh.userData.lastZ);
    if (dx * dx + dz * dz > 1e-6) mesh.userData.yaw = Math.atan2(dx, dz);
    mesh.userData.lastX = p.x;
    mesh.userData.lastZ = p.z;

    _q.setFromAxisAngle(_up, mesh.userData.yaw || 0);
    mesh.quaternion.copy(_q);
    if (p.kind === 'dart') {
      /* nose down the road, and rifle about its own axis */
      mesh.rotateX(Math.PI / 2);
      mesh.rotateY(time * 9);
    } else {
      /* a Gust is a ring travelling face-on, rolling as it goes */
      mesh.rotateX(Math.PI / 2);
      mesh.rotateZ(time * 6);
    }
    /* fade the last half second so it does not simply vanish */
    const fade = ZC.clamp01(p.life / 0.6);
    mesh.material.opacity = 0.35 + 0.6 * fade;
    const puff = 1 + Math.sin(time * 18 + i) * 0.08;
    mesh.scale.setScalar(puff);
  }

  /* ---- hazards ---- */
  const hz = itemState.hazards;
  for (let i = 0; i < u.hazards.length; i++) {
    const cloud = u.hazards[i];
    const h = i < hz.length ? hz[i] : null;
    if (!h) { cloud.visible = false; continue; }
    cloud.visible = true;
    /* it settles onto the road over its first moments, so a dropped
       Thunderhead reads as having been dropped */
    const drop = ZC.clamp01(h.age / 0.45);
    cloud.position.set(h.x, h.y + 1.1 + (1 - drop) * 1.6, h.z);
    cloud.rotation.y = time * 0.35 + i;
    /* and blinks out rather than disappearing */
    const dying = h.life < 1.5 ? (Math.sin(h.life * 22) > -0.2) : true;
    cloud.visible = dying;
    const s = 0.5 + 0.5 * drop;
    cloud.scale.setScalar(s);
  }

  /* ---- shields ---- */
  let used = 0;
  for (let i = 0; i < karts.length && used < u.shields.length; i++) {
    const k = karts[i];
    if (!(k.shield > 0) || k.falling) continue;
    const mesh = u.shields[used++];
    mesh.visible = true;
    mesh.position.set(k.x, k.y + 0.75, k.z);
    mesh.rotation.y = time * 1.4;
    mesh.rotation.x = time * 0.7;
    /* pulse harder as it runs out, so the last second is a warning */
    const urgency = k.shield < 2.5 ? (0.55 + 0.45 * Math.sin(time * 14)) : 1;
    mesh.material.opacity = 0.16 + 0.18 * urgency;
    mesh.scale.setScalar(1 + Math.sin(time * 3.5 + i) * 0.04);
  }
  for (let i = used; i < u.shields.length; i++) u.shields[i].visible = false;
}

/* Free the geometry a track's item layer owns. Materials are per-layer
   too, so they go with it. */
export function disposeItems(group) {
  if (!group) return;
  group.traverse((o) => {
    if (o.isMesh || o.isInstancedMesh) {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      if (o.material && o.material.dispose) o.material.dispose();
    }
  });
}
