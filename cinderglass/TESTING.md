# Testing Cinderglass

## Headless suite

```
npm install          # once
npx jest cinderglass # 60 tests, ~20s
npx jest             # the whole arcade, 188 tests
```

Two files, and they check different things:

* **`__tests__/cinderglass.sim.test.js`** — the simulation. Determinism (the
  same seed and inputs must produce a byte-identical world, and `step()` must
  never touch `Math.random()`), conservation of matter, buoyancy ordering,
  every phase change, every reaction, and the brush.
* **`__tests__/cinderglass.levels.test.js`** — the contracts. Every chamber is
  sealed, builds identically every time, does not complete itself if the
  player does nothing, and **is actually finishable**: each carries a recorded
  reference solve which the test replays against its real quota, shift clock
  and fuel budget.

`__tests__/cinderglass.harness.js` loads `core / materials / sim / levels` as
classic scripts into a `vm` context under a browser shim. render, particles,
audio, ui and game need a real canvas and DOM and are covered by the
screenshot sweep instead.

**Never commit a failing suite.** If a tuning change breaks a reference solve,
the chamber got harder than it looks — that is the test doing its job, not a
test that needs relaxing.

### Adding a contract

Add it to `CG.Levels.LIST` with a `solution`, then run the suite. Two traps
the existing chambers already fell into:

* Powders and liquids barely travel sideways. Chambers have to be **vertical**
  — source at the top, crucible at the bottom.
* A `deliver` quota can only name mobile matter. Glass, steel and obsidian are
  static the instant they set, so they need `kind: 'create'`.

## Screenshot sweep

Serve the repo root, then drive a headless browser at it:

```
npx --yes http-server -p 8900 -c-1 --silent .
CG_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  node cinderglass/tools/screenshot.js /tmp/shots --wait 1400 --script drive.js
```

Writes `<viewport>.png` for each of 320x568, 390x844, 844x390, 768x1024,
1440x900 and 3840x2160, plus `report.json` with measured fps, console
errors, any non-local network request, and a horizontal-scroll check.

`CG_CHROME` is needed because the npm `playwright` version and the chromium
build in this environment do not match; point it at whatever is under
`/opt/pw-browsers`.

`--script` takes a file whose contents are evaluated as an **expression**, so
it must be an IIFE — `(() => { ... })()`. A bare `() => {...}` evaluates to a
function that is never called, and the drive silently does nothing.

A useful drive script: start a contract, park the brush, hold the torch, and
stop the loop so the frame is still when the shot is taken.

```js
(() => {
  CG.Game.startRun(0);
  CG.Game.beginContract();
  const p = CG.Render.toScreen(64, 39);
  CG.Input.brush.x = p.x; CG.Input.brush.y = p.y;
  CG.Input.brush.inside = true;
  CG.Input.setSize(2);
  CG.Input.setTool(CG.TOOL_TORCH);
  CG.Input.brush.down = true;
  setTimeout(() => { CG.Input.brush.down = false; CG.Loop.stop(); }, 700);
})()
```

**Read the PNGs.** A screenshot nobody looked at verifies nothing. The report
will happily say 61fps and no scrollbar for a chamber rendering as a black
rectangle.

The one console error expected in this sandbox is the Google tag failing to
load through the proxy (`ERR_TUNNEL_CONNECTION_FAILED`), and the one external
request is that same tag. Both match every other game on the site. Anything
else is a real finding.

## What to check by hand

* Console clean, no horizontal scrollbar, at all six viewports.
* The control dock fits without wrapping at 320px wide.
* Touch: drag paints, both tool buttons and all three brush sizes are
  thumb-reachable, no gesture needs two fingers.
* Mouse: left-drag paints the selected tool, right-drag paints the other one.
* Keyboard: WASD/arrows aim, Space paints, Q/E switch tool, 1-3 brush size,
  P pause, R restart.
