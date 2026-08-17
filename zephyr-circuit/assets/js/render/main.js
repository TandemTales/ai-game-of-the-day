/* =====================================================================
   ZEPHYR CIRCUIT — render/main.js
   ESM entry point. Owns the RAF loop, the chase camera, and the bridge
   between the pure-logic half of the game and three.js.
   Owner: lead. See SPEC.md §0.

   Direction of dependency is one way and must stay that way: this file
   reads window.ZC and never writes to it.
   ===================================================================== */
import * as THREE from 'three';
import { Stage } from './scene.js';
import { buildTrack } from './trackmesh.js';
import { buildKart, syncKart } from './karts.js';

const ZC = window.ZC;

let stage = null;
let trackGroup = null;
let kartMeshes = [];
let running = false;
let lastTime = 0;
let frame = 0;
let msAvg = 16.7;

/* ------------------------------------------------------------------
   Chase camera.

   Springs toward a point behind and above the kart. Two details do most
   of the work: the camera follows the direction of TRAVEL rather than
   the body, so a drifting kart slides sideways across the screen instead
   of dragging the view around with it; and the field of view opens with
   speed, which is most of what makes a boost feel fast.
   ------------------------------------------------------------------ */
const CAM = {
  distance: 11.6,
  height: 5.3,
  lookAhead: 15,
  lookHeight: 1.9,
  baseFov: 62,
  fovAtTopSpeed: 76,
  posLambda: 9.0,
  aimLambda: 11.0,
};

const _camWant = new THREE.Vector3();
const _aimWant = new THREE.Vector3();
const _aim = new THREE.Vector3();
let _aimInit = false;

function updateCamera(kart, dt) {
  const yaw = kart.travelYaw;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);

  _camWant.set(
    kart.x - fx * CAM.distance,
    kart.y + CAM.height,
    kart.z - fz * CAM.distance);

  /* never let the camera sink through the road on a crest */
  const proj = kart._proj;
  if (proj && proj.surfaceY !== undefined) {
    const floor = proj.surfaceY + 1.6;
    if (_camWant.y < floor) _camWant.y = floor;
  }

  _aimWant.set(
    kart.x + fx * CAM.lookAhead,
    kart.y + CAM.lookHeight,
    kart.z + fz * CAM.lookAhead);

  if (!_aimInit) {
    stage.camera.position.copy(_camWant);
    _aim.copy(_aimWant);
    _aimInit = true;
  } else {
    const kp = 1 - Math.exp(-CAM.posLambda * dt);
    const ka = 1 - Math.exp(-CAM.aimLambda * dt);
    stage.camera.position.lerp(_camWant, kp);
    _aim.lerp(_aimWant, ka);
  }
  stage.camera.lookAt(_aim);

  const speedFrac = ZC.clamp01(kart.speed / ZC.Kart.TUNE.boostSpeed);
  const wantFov = ZC.lerp(CAM.baseFov, CAM.fovAtTopSpeed, speedFrac * speedFrac);
  if (Math.abs(stage.camera.fov - wantFov) > 0.05) {
    stage.camera.fov = ZC.damp(stage.camera.fov, wantFov, 5, dt);
    stage.camera.updateProjectionMatrix();
  }
}
export function resetCamera() { _aimInit = false; }

/* ------------------------------------------------------------------
   Scene assembly
   ------------------------------------------------------------------ */
function buildScene() {
  const st = ZC.Race.state;

  if (trackGroup) {
    stage.scene.remove(trackGroup);
    disposeTree(trackGroup);
  }
  trackGroup = buildTrack(st.track);
  stage.scene.add(trackGroup);

  for (const m of kartMeshes) { stage.scene.remove(m); disposeTree(m); }
  kartMeshes = st.karts.map((k) => {
    const mesh = buildKart(k.colour);
    stage.scene.add(mesh);
    return mesh;
  });

  resetCamera();
}

function disposeTree(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.geometry && o.geometry.dispose && !o.geometry.__shared) o.geometry.dispose();
  });
}

/* Effects budget goes before frame rate does: the simulation is fixed
   step and must not slow down, but bloom and shadows can. */
let qualityCooldown = 0;
function adaptQuality() {
  if (--qualityCooldown > 0) return;
  if (msAvg > 27 && ZC.quality.tier > 0) {
    ZC.quality.tier--;
    stage.setQuality(ZC.quality.tier);
    qualityCooldown = 240;
  } else if (msAvg < 15 && ZC.quality.tier < 2) {
    ZC.quality.tier++;
    stage.setQuality(ZC.quality.tier);
    qualityCooldown = 600;
  }
}

/* ------------------------------------------------------------------
   Frame
   ------------------------------------------------------------------ */
function tick(now) {
  if (!running) return;
  requestAnimationFrame(tick);

  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (!(dt > 0)) dt = 1 / 60;
  msAvg = msAvg * 0.92 + (dt * 1000) * 0.08;
  dt = Math.min(dt, 1 / 20);
  frame++;

  ZC.Input.update(dt);

  const st = ZC.Race.state;
  ZC.Race.update(dt);

  const time = now / 1000;
  for (let i = 0; i < kartMeshes.length; i++) {
    syncKart(kartMeshes[i], st.karts[i], st.track, dt, time);
  }

  /* In attract mode the camera rides the leader, which is what makes the
     menu background look like a race rather than like a screensaver. */
  const focus = (st.phase === ZC.Race.PHASE.ATTRACT)
    ? (ZC.Race.order()[0] || st.player)
    : st.player;
  if (focus && !window.__lockCam) {
    updateCamera(focus, dt);
    stage.focusShadow(focus.x, focus.z);
  }

  if (ZC.UI && ZC.UI.frame) ZC.UI.frame(st);

  stage.render();
  ZC.Input.lateUpdate();
  adaptQuality();
}

/* ------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------ */
export function boot() {
  const canvas = document.getElementById('zc-canvas');
  if (!canvas) { console.error('[ZC] no canvas'); return; }

  stage = new Stage(canvas);
  ZC.Input.init(canvas);

  ZC.Race.load(0, { attract: true });
  buildScene();

  if (ZC.UI && ZC.UI.init) ZC.UI.init(document.getElementById('zc-ui'));

  window.addEventListener('resize', () => stage.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => stage.resize(), 120));

  ZC.on('race:load', () => buildScene());
  ZC.on('race:rebuild', () => buildScene());

  running = true;
  lastTime = performance.now();
  requestAnimationFrame(tick);

  /* Handle for the screenshot harness and for debugging from the console.
     Deliberately the only thing this module puts on window. */
  window.ZCRender = {
    stage,
    get fps() { return 1000 / msAvg; },
    get frame() { return frame; },
    rebuild: buildScene,
    resetCamera,
  };
  ZC.emit('render:ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
