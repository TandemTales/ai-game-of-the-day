# Testing Zephyr Circuit

The game is split so that everything testable without a GPU *is* tested
without a GPU, and only the renderer depends on a browser. See SPEC.md §0.

## Headless suite — the logic half

```
npm install            # once
npx jest zephyr        # 46 tests, ~16s
npx jest               # the whole arcade
```

| file | what it protects |
|---|---|
| `zephyr-circuit.track.test.js` | The baked centreline: uniform segments, an orthonormal frame everywhere, **that the circuit never crosses itself**, projection round-tripping to under one segment, camber derived and pointing into the corner, checkpoints tiling the lap. |
| `zephyr-circuit.kart.test.js` | Feel numbers (0-97km/h in ~4s, no pirouettes at rest, steering washing out at speed), the off-road cap, falling and respawn, drift charging through three tiers, and that **drifting is at least a second a lap faster than not drifting**. Plus the two hard invariants: no `Math.random`, fixed timestep. |
| `zephyr-circuit.race.test.js` | Eight AI drivers race, finish, and **finish in skill order** with nobody falling off; the grid has no duplicate slots; nobody moves before the lights; placement sorts by lap then distance; scoring rewards the win. |

`zephyr-circuit.harness.js` loads `core / track / tracks / kart / ai / race`
into a `vm` context under a browser shim. Everything under
`assets/js/render/` is ESM that imports three.js, needs a real GPU, and is
covered by the screenshot sweep instead.

**Never commit a failing suite.**

### Two properties worth defending specifically

* **The circuit must not cross itself.** Gullwing Bay's first draft doubled
  back through the middle of the island and overlapped its own road surface
  by 20m, which silently breaks lap counting and the off-track test in that
  region. Author circuits star-shaped about the origin — bearing from the
  origin changing monotonically all the way round — and the test asserts
  15m of edge clearance.
* **AI skill must be monotonic.** The first brain raised aggression with
  skill and the highest-rated driver finished last. A field whose ratings
  do not predict the result is worse than no ratings.

## Screenshot sweep — the render half

```
npx --yes http-server -p 8900 -c-1 --silent .
ZC_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  node zephyr-circuit/tools/screenshot.js /tmp/shots --wait 8000 --script drive.js
```

Writes `<viewport>.png` for 320x568, 390x844, 844x390, 768x1024, 1440x900
and 3840x2160, plus `report.json` with console errors, non-local requests,
a horizontal-scroll check, and race state.

`ZC_CHROME` is needed because the npm `playwright` version and the chromium
build in this sandbox do not match. Point it at whatever is in
`/opt/pw-browsers`.

`--script` takes a file evaluated as an **expression**, so it must be an
IIFE — `(() => { ... })()`. A bare arrow function evaluates to a function
that is never called and the drive silently does nothing.

A drive script that puts a real race on screen:

```js
(() => {
  ZC.Race.load(0, {});
  ZC.Race.state.phase = 'racing';
  ZC.Race.state.attractMode = true;      // AI drives the player too
  const el = document.querySelector('.zc-overlay');
  if (el) el.classList.remove('is-open');
})()
```

### Read the PNGs

Every render bug so far has been invisible to the report and obvious in the
image. The report happily said 61fps, no scrollbar, no console errors while
the road was entirely missing — back-face culled by a reversed winding —
and again while the whole island was the wrong colour. A screenshot nobody
looked at verifies nothing.

Useful isolation trick: hide one mesh and re-shoot.

```js
ZCRender.stage.scene.traverse(o => { if (o.name === 'island') o.visible = false; });
```

That is what turned "the ground looks wrong" into "the road does not exist".

### FPS in this sandbox is not a real number

There is no GPU here, so Chromium falls back to swiftshader and reports
single-digit frame rates with bloom enabled. Treat it as a **relative**
figure for comparing changes, never as a verdict on whether the game holds
60fps. Draw-call and triangle counts read through `renderer.info` are also
meaningless once the EffectComposer is in the pipeline, because the last
pass it measures is a fullscreen quad.

### Expected noise

* `ERR_TUNNEL_CONNECTION_FAILED` for the Google tag — the sandbox proxy
  blocks it. Every other game on the site does the same.
* A swiftshader `GPU stall due to ReadPixels` performance warning.

Anything else is a real finding.

## What to check by hand

* Console clean, no horizontal scrollbar, at all six viewports.
* Touch: steering pads in the bottom corners, drift and brake under the
  right thumb, and **throttle automatic** — no control needs a third digit.
* Keyboard: WASD/arrows, Shift to drift, S to brake.
* Gamepad: left stick steers, right trigger throttles, left trigger drifts.
* A kart that falls off the island is fished out and put back on the road.
