/* =====================================================================
   ZEPHYR CIRCUIT — render/scene.js
   Renderer, camera, lighting, sky and post-processing.
   Owner: agent-render (this first pass written by the lead).

   ESM: this half of the game is the only part that knows three.js exists.
   It reads window.ZC and never writes to it.
   ===================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const ZC = window.ZC;

/* Golden hour. Every colour in the game is mixed against these, so they
   live in one place rather than being sprinkled through the meshes. */
export const PALETTE = {
  skyTop:    0x1a2a52,
  skyMid:    0xe8794a,
  skyLow:    0xffc178,
  sun:       0xfff0c4,
  sunLight:  0xffd9a0,
  fill:      0x5b76b8,
  ground:    0x2a2340,
  fog:       0xd98a58,

  road:      0x3a3742,
  roadDark:  0x2e2c36,
  kerbA:     0xf2f2f2,
  kerbB:     0xd94f4f,
  line:      0xf6f0e2,
  grass:     0x5f8a52,
  grassDark: 0x44673d,
  rock:      0x6b5545,
  rockDark:  0x352a26,
};

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !ZC.isMobile,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ZC.isMobile ? 2 : 2));
    this.renderer.shadowMap.enabled = ZC.quality.shadows;
    /* PCFSoftShadowMap is deprecated in r185 and prints a warning on every
       boot, which breaks "console clean". PCFShadowMap is what it silently
       falls back to anyway. */
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.skyMid);
    /* Exponential fog sells distance on a low-poly scene and hides the
       draw-distance edge without a hard clip. Density is set against the
       island's actual size: at 0.0016 the far side of a 400m landmass was
       already half fog and the whole world read as one flat tan wash. */
    this.scene.fog = new THREE.FogExp2(PALETTE.fog, 0.00055);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 4000);
    this.camera.position.set(0, 12, 30);

    this._buildLights();
    this._buildSky();

    this.composer = null;
    this.bloom = null;
    this._buildComposer();

    this.resize();
  }

  _buildLights() {
    /* The sun: low, warm, and behind the start line so the opening
       straight runs into the light. */
    const sun = new THREE.DirectionalLight(PALETTE.sunLight, 2.6);
    sun.position.set(-260, 150, 320);
    sun.castShadow = ZC.quality.shadows;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(2048, 2048);
      const d = 240;
      sun.shadow.camera.left = -d;
      sun.shadow.camera.right = d;
      sun.shadow.camera.top = d;
      sun.shadow.camera.bottom = -d;
      sun.shadow.camera.near = 20;
      sun.shadow.camera.far = 900;
      sun.shadow.bias = -0.0016;
      sun.shadow.normalBias = 0.6;
    }
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    /* Sky/ground bounce. A single directional light on a low-poly scene
       leaves every shadowed face flat black; this is what keeps the
       undersides readable. */
    this.scene.add(new THREE.HemisphereLight(PALETTE.fill, PALETTE.ground, 1.15));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  }

  _buildSky() {
    /* A gradient dome rather than a texture: nothing is fetched, and the
       horizon colour can be matched to the fog exactly. */
    const geo = new THREE.SphereGeometry(2200, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(PALETTE.skyTop) },
        midColor: { value: new THREE.Color(PALETTE.skyMid) },
        lowColor: { value: new THREE.Color(PALETTE.skyLow) },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 topColor; uniform vec3 midColor; uniform vec3 lowColor;
        varying vec3 vWorld;
        void main() {
          float h = normalize(vWorld).y;
          vec3 c = mix(lowColor, midColor, smoothstep(-0.10, 0.16, h));
          c = mix(c, topColor, smoothstep(0.12, 0.62, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    /* The sun disc itself, sitting just inside the dome so bloom catches
       it and it reads as the source of the light. */
    const discGeo = new THREE.CircleGeometry(78, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: PALETTE.sun, fog: false, depthWrite: false, transparent: true, opacity: 0.95,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(-1120, 430, 1380);
    disc.lookAt(0, 120, 0);
    disc.frustumCulled = false;
    this.scene.add(disc);
    this.sunDisc = disc;
  }

  _buildComposer() {
    if (!ZC.quality.bloom) return;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      ZC.isMobile ? 0.42 : 0.62,   // strength
      0.85,                        // radius
      0.72                         // threshold — only genuinely bright things
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setQuality(tier) {
    const shadows = tier >= 2;
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      this.sun.castShadow = shadows;
      this.scene.traverse((o) => { if (o.isMesh) o.material.needsUpdate = true; });
    }
    if (this.bloom) this.bloom.strength = tier >= 2 ? 0.62 : (tier === 1 ? 0.4 : 0);
  }

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(w, h);
      const pr = this.renderer.getPixelRatio();
      if (this.bloom) this.bloom.setSize(w * pr, h * pr);
    }
  }

  /* Keep the sun's shadow frustum centred on the action, otherwise a
     240m box has to cover a 400m island and the shadows go to mush. */
  focusShadow(x, z) {
    if (!this.sun.castShadow) return;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x - 260, 150, z + 320);
    this.sun.target.updateMatrixWorld();
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
