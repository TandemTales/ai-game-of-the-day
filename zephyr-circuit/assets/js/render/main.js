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
import { buildItems, syncItems, disposeItems } from './items.js';
import { createFX } from './fx.js';

const ZC = window.ZC;

let stage = null;
let trackGroup = null;
let kartMeshes = [];
let itemGroup = null;
let fx = null;
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

/* ------------------------------------------------------------------
   Camera drama.

   The chase camera above is correct but inert: a boost, a shell hit and
   a quiet straight all look the same through it, and a standing start
   begins with the field already framed as if the race were underway.
   Everything below is presentation only — it moves the camera, never the
   simulation, so none of it can affect a lap time or the leaderboard.

   Three effects, all decaying springs so they cannot accumulate:

   * fovKick   a punch of field of view. Speed already widens the FOV
               smoothly; this is the impulse on top that makes the moment
               a boost *fires* legible, separately from the speed it
               produces.
   * shake     positional and aim jitter for impacts. Sampled from summed
               sines rather than Math.random so it is smooth at any frame
               rate and never a single-frame teleport.
   * roll      a small bank into a slide. A drifting kart already slides
               across frame; rolling the horizon with it is what makes
               that read as commitment rather than as a camera error.

   Plus an establishing shot over the grid, blended out before the lights
   go green so the player has the normal chase view in hand at GO.
   ------------------------------------------------------------------ */
const DRAMA = {
  boostFov: [5.5, 8.0, 11.0],   /* by drift tier */
  boostShake: [0.10, 0.16, 0.24],
  hitFov: -6.0,
  hitShake: 0.55,
  fallShake: 0.30,
  lapShake: 0.06,
  fovDecay: 3.4,                /* per second, exponential */
  shakeDecay: 3.8,
  maxShake: 0.7,
  rollAtFullSlip: 0.085,        /* radians */
  rollLambda: 6.0,
  introHoldFrom: 3.2,           /* countdown value where the intro is full */
  introDoneAt: 0.75,            /* ...and where it has fully handed over */
};

const _camWant = new THREE.Vector3();
const _aimWant = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _introPos = new THREE.Vector3();
const _introAim = new THREE.Vector3();
let _aimInit = false;

let _fovKick = 0;
let _shake = 0;
let _roll = 0;
let _dramaTime = 0;
let _focusKart = null;

/* Summed sines: smooth, deterministic, allocation-free, and continuous
   across a frame-rate change — which Math.random() is not. */
function jitter(t, seed) {
  return Math.sin(t * 31.7 + seed) * 0.6
       + Math.sin(t * 17.3 + seed * 2.7) * 0.3
       + Math.sin(t * 8.1 + seed * 5.1) * 0.1;
}

/* Only the kart the camera is actually watching may move the camera. In
   attract mode that is the leader, not the player. */
function dramaFor(kart) { return kart && kart === _focusKart; }

function addFov(v) {
  _fovKick += v;
  if (_fovKick > 18) _fovKick = 18;
  else if (_fovKick < -12) _fovKick = -12;
}
function addShake(v) {
  _shake += v;
  if (_shake > DRAMA.maxShake) _shake = DRAMA.maxShake;
}

function bindDrama() {
  ZC.on('kart:boost', (e) => {
    if (!e || !dramaFor(e.kart)) return;
    const t = Math.max(0, Math.min(2, e.tier | 0));
    addFov(DRAMA.boostFov[t]);
    addShake(DRAMA.boostShake[t]);
  });
  ZC.on('kart:hit', (e) => {
    if (!e || !dramaFor(e.kart)) return;
    addFov(DRAMA.hitFov);
    addShake(DRAMA.hitShake);
  });
  ZC.on('kart:shieldBreak', (e) => {
    if (!e || !dramaFor(e.kart)) return;
    addShake(DRAMA.hitShake * 0.5);
  });
  ZC.on('kart:fell', (k) => {
    if (!dramaFor(k)) return;
    addShake(DRAMA.fallShake);
  });
  ZC.on('kart:lap', (e) => {
    if (!e || !dramaFor(e.kart)) return;
    addShake(DRAMA.lapShake);
  });
  ZC.on('race:go', () => { addFov(4.5); addShake(0.12); });
}

function updateCamera(kart, dt) {
  const yaw = kart.travelYaw;
  const fwdX = Math.sin(yaw), fwdZ = Math.cos(yaw);

  /* three.js FOV is vertical, so a tall portrait phone gets the same
     vertical angle as a desktop and spends the extra pixels on sky. Tilt
     the view down as the aspect narrows: sit higher, aim lower, and pull
     the look-ahead in. */
  const portrait = ZC.clamp01((1.2 - stage.camera.aspect) / 0.7);
  const height = CAM.height + portrait * 2.4;
  const lookHeight = CAM.lookHeight - portrait * 2.9;
  const lookAhead = CAM.lookAhead - portrait * 3.5;

  _camWant.set(
    kart.x - fwdX * CAM.distance,
    kart.y + height,
    kart.z - fwdZ * CAM.distance);

  /* never let the camera sink through the road on a crest */
  const proj = kart._proj;
  if (proj && proj.surfaceY !== undefined) {
    const floor = proj.surfaceY + 1.6;
    if (_camWant.y < floor) _camWant.y = floor;
  }

  _aimWant.set(
    kart.x + fwdX * lookAhead,
    kart.y + lookHeight,
    kart.z + fwdZ * lookAhead);

  /* The establishing shot. During GRID and COUNTDOWN the camera starts
     wide and low off the kart's shoulder and pushes in to the chase
     position, arriving before the lights go green. `race.js` counts
     `st.countdown` down from 3.2, so the blend is driven straight off
     that and needs no timer of its own — which also means a skipped or
     restarted countdown cannot leave the camera stranded. */
  const st = ZC.Race.state;
  let intro = 0;
  if (st.phase === ZC.Race.PHASE.COUNTDOWN || st.phase === ZC.Race.PHASE.GRID) {
    const c = st.phase === ZC.Race.PHASE.GRID ? DRAMA.introHoldFrom : st.countdown;
    intro = ZC.clamp01((c - DRAMA.introDoneAt) /
                       (DRAMA.introHoldFrom - DRAMA.introDoneAt));
    intro = intro * intro * (3 - 2 * intro);      /* smoothstep */
  }
  if (intro > 0) {
    /* swing round the kart's right shoulder, close to the deck, looking
       slightly up at the field */
    const ang = yaw + Math.PI * 0.62 + intro * 0.55;
    const dist = 6.4 + intro * 5.0;
    _introPos.set(
      kart.x + Math.sin(ang) * dist,
      kart.y + 1.35 + intro * 0.9,
      kart.z + Math.cos(ang) * dist);
    if (proj && proj.surfaceY !== undefined) {
      const f = proj.surfaceY + 0.9;
      if (_introPos.y < f) _introPos.y = f;
    }
    _introAim.set(kart.x, kart.y + 1.1, kart.z);
    _camWant.lerp(_introPos, intro);
    _aimWant.lerp(_introAim, intro);
  }

  if (!_aimInit) {
    stage.camera.position.copy(_camWant);
    _aim.copy(_aimWant);
    _aimInit = true;
  } else {
    /* Track the intro rig stiffly, or it lags its own move and arrives
       late; the chase spring is deliberately loose by comparison. */
    const lam = ZC.lerp(CAM.posLambda, 26, intro);
    const kp = 1 - Math.exp(-lam * dt);
    const ka = 1 - Math.exp(-ZC.lerp(CAM.aimLambda, 26, intro) * dt);
    stage.camera.position.lerp(_camWant, kp);
    _aim.lerp(_aimWant, ka);
  }

  /* ---- drama: decay first, then apply, so an impulse raised this frame
     is still felt this frame ---- */
  _dramaTime += dt;
  const dFov = Math.exp(-DRAMA.fovDecay * dt);
  const dShk = Math.exp(-DRAMA.shakeDecay * dt);
  _fovKick *= dFov; if (Math.abs(_fovKick) < 0.02) _fovKick = 0;
  _shake *= dShk;   if (_shake < 0.002) _shake = 0;

  if (_shake > 0) {
    const t = _dramaTime;
    const a = _shake;
    stage.camera.position.x += jitter(t, 1.7) * a * 0.55;
    stage.camera.position.y += jitter(t, 4.3) * a * 0.40;
    stage.camera.position.z += jitter(t, 9.1) * a * 0.55;
    _aim.x += jitter(t, 12.4) * a * 0.9;
    _aim.y += jitter(t, 15.8) * a * 0.7;
  }

  stage.camera.lookAt(_aim);

  /* Bank into a slide. Applied after lookAt so it rolls about the view
     axis; `slip` is signed, so the horizon tips the way the kart is
     actually sliding. Held small on purpose — past about 5 degrees this
     stops reading as commitment and starts reading as a bug. */
  const fullSlip = ZC.Kart.TUNE.driftSlip || 0.44;
  const wantRoll = -ZC.clamp(kart.slip / fullSlip, -1, 1) * DRAMA.rollAtFullSlip
                 * (kart.drift && kart.drift.active ? 1 : 0.45);
  _roll = ZC.damp(_roll, wantRoll * (1 - intro), DRAMA.rollLambda, dt);
  if (_roll > 1e-4 || _roll < -1e-4) stage.camera.rotateZ(_roll);

  const speedFrac = ZC.clamp01(kart.speed / ZC.Kart.TUNE.boostSpeed);
  let wantFov = ZC.lerp(CAM.baseFov, CAM.fovAtTopSpeed, speedFrac * speedFrac);
  /* the establishing shot is wider than the chase, which is what makes
     the push-in read as a push-in */
  wantFov = ZC.lerp(wantFov, 74, intro) + _fovKick;
  if (Math.abs(stage.camera.fov - wantFov) > 0.05) {
    /* the kick itself must land, not be smoothed away, so the follow is
       stiff while one is active */
    stage.camera.fov = ZC.damp(stage.camera.fov, wantFov,
                               _fovKick !== 0 ? 14 : 5, dt);
    stage.camera.updateProjectionMatrix();
  }
}
export function resetCamera() {
  _aimInit = false;
  _fovKick = 0;
  _shake = 0;
  _roll = 0;
}

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
  /* the racer id goes through as well as the colour: eight karts that
     differ only in paint read as one kart in eight liveries, and the
     roster is where their identity actually lives */
  kartMeshes = st.karts.map((k) => {
    const mesh = buildKart(k.colour, k.id);
    stage.scene.add(mesh);
    return mesh;
  });

  if (itemGroup) {
    stage.scene.remove(itemGroup);
    disposeItems(itemGroup);
    itemGroup = null;
  }
  if (st.items) {
    itemGroup = buildItems(st.track, st.items);
    stage.scene.add(itemGroup);
  }

  /* Particles are rebuilt with the scene so their pools sit in the live
     scene graph and nothing survives a track change. */
  if (fx) { fx.dispose(); fx = null; }
  fx = createFX(stage.scene, st.track);
  fx.setQuality(ZC.quality.tier);

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
    if (fx) fx.setQuality(ZC.quality.tier);
    qualityCooldown = 240;
  } else if (msAvg < 15 && ZC.quality.tier < 2) {
    ZC.quality.tier++;
    stage.setQuality(ZC.quality.tier);
    if (fx) fx.setQuality(ZC.quality.tier);
    qualityCooldown = 600;
  }
}

/* ------------------------------------------------------------------
   Frame
   ------------------------------------------------------------------ */
/* reused every frame so the loop allocates nothing */
const _fxCtx = { karts: null, player: null, camera: null, dt: 0, time: 0, phase: '' };

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
  if (itemGroup) syncItems(itemGroup, st.items, st.karts, time, dt);

  /* In attract mode the camera rides the leader, which is what makes the
     menu background look like a race rather than like a screensaver. */
  const focus = (st.phase === ZC.Race.PHASE.ATTRACT)
    ? (ZC.Race.order()[0] || st.player)
    : st.player;
  /* Camera drama is only ever raised by the kart the camera is on, so
     the handlers need to know who that is. Kept here rather than looked
     up per event: eight karts boosting into a corner would otherwise
     re-sort the field once per boost. */
  _focusKart = focus;
  /* `window.__lockCam` lets a screenshot drive script park the camera
     somewhere useful — an overview of the whole island, say — without the
     chase camera yanking it back every frame. Debug affordance only;
     nothing in the game sets it. */
  if (focus && !window.__lockCam) {
    updateCamera(focus, dt);
    stage.focusShadow(focus.x, focus.z);
  }

  /* after the camera, so billboards and speed lines use this frame's view */
  if (fx) {
    _fxCtx.karts = st.karts; _fxCtx.player = focus; _fxCtx.camera = stage.camera;
    _fxCtx.dt = dt; _fxCtx.time = time; _fxCtx.phase = st.phase;
    fx.update(_fxCtx);
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
  bindDrama();

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
    get fx() { return fx; },
  };
  ZC.emit('render:ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
