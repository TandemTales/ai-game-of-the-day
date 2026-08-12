# Testing Paradox Vault (read before you touch anything)

Two independent layers, and you are expected to use both:

1. **`__tests__/paradox-vault.test.js`** — headless simulation. Fast, no browser,
   asserts on mechanics. This is what catches "the game silently became
   unwinnable".
2. **`paradox-vault/tools/screenshot.js`** — real headless Chromium. This is the
   only way to make a claim about how the game *looks* or whether the console
   is clean.

---

## 1. Simulation tests

```
npm test                      # whole repo
npx jest paradox-vault        # this game only
```

`__tests__/paradox-vault.harness.js` loads `core.js`, `levels.js` and
`entities.js` as classic scripts inside a `vm` context under a minimal browser
shim (stub canvas/DOM/localStorage), so real gameplay code runs with no browser.
It exports:

```js
loadPV(opts)                  // -> {PV, sandbox, window}; a fresh isolated PV per call
makeWorld(PV, vault)          // mirrors game.js buildWorld()
driveActor(PV, world, a, inp) // step an actor through an array of inputs
reachable(vault, sx, sy)      // flood fill of walkable tiles
```

Covered today: echo-replay determinism, RNG stability, `Recording`
round-tripping and capacity, collision against sealed maps, per-vault level
integrity **including solvability** (every relic and the exit reachable from
spawn), and the SPEC §8 scoring formula.

**The solvability test earns its keep** — it is what found that vault 5's door
was placed on a `#` wall tile, which sealed the mask relic away and made the
vault impossible to clear. `solidAt()` checks terrain *before* door state, so a
door on a wall tile can never open. If you author a door, put it on floor.

Note `Recording` quantises inputs to 1/127. Tapes built from cardinal
directions (0, ±1) sit on that grid and replay exactly; arbitrary analog values
will not round-trip bit-for-bit, and the desync system exists to absorb that.

## 2. Screenshots / browser checks

Serve the repo root, then run the harness:

```
npx --yes http-server -p 8900 -c-1 --silent .
node paradox-vault/tools/screenshot.js out --vp 390x844
node paradox-vault/tools/screenshot.js out          # sweeps all six viewports
```

Viewports: `320x568`, `390x844`, `844x390`, `768x1024`, `1440x900`, `3840x2160`.
Mobile ones get touch + a phone UA so the touch controls appear.

Flags: `--url` (default boots `?vault=1&auto=1`; drop `auto` to land on the
title/brief screens), `--script file.js` (JS evaluated in the page before the
screenshot, for driving gameplay), `--wait ms`.

Writes `out/<viewport>.png` and `out/report.json` with fps, console
errors/warnings, non-local network requests and a horizontal-scroll check.

If playwright/Chromium are not local to the repo, point at them:

```
PV_PLAYWRIGHT=/opt/node22/lib/node_modules/playwright \
PV_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
node paradox-vault/tools/screenshot.js out
```

**Actually open the PNGs.** A screenshot you did not look at verifies nothing.

### Query params (implemented in `game.js`)
* `?vault=N` — boot straight to vault N (**1-based**, so `?vault=6` is the
  `PV.Levels.get(5)` map, "Night Watch")
* `?vault=N&auto=1` — …and skip the mission brief

### Driving gameplay from a script

`PV.Input._down` is the raw button map:

```js
const D = PV.Input._down;
D.up = true;   // also: down, left, right, action, dash, rewind
```

Force the signature mechanic (spawns an echo):

```js
PV.Game.rewind();
```

State worth asserting on:

```js
PV.Game.state.phase   // 'boot'|'title'|'brief'|'playing'|'paused'|'clear'|'gameover'
PV.Game.world         // player, echoes, devices, relics, sentries, doors
PV.Loop.fps, PV.Loop.msAvg
PV.Particles.count
PV.Textures.bakeMs
PV.Render.camera      // {x,y,scale}
PV.Render.viewport()  // the rect the vault is framed into, after HUD insets
```

### Reading the fps number honestly

On a machine with no GPU (CI, most sandboxes) Chromium falls back to software
rasterisation and the reported fps is far below real hardware — measured ~11fps
at 1440x900 where a plain-canvas control workload in the *same* browser managed
58fps. Use the number to compare before/after, never to claim the game does or
does not hit 60fps. A real GPU check is still outstanding; see `PROGRESS.md`.

## Non-negotiables

* Console clean — no errors, no warnings. The single
  `googletagmanager`/`ERR_TUNNEL_CONNECTION_FAILED` error is the arcade's
  analytics being blocked by a sandbox proxy, not a game defect.
* No horizontal scrollbar at any width:
  `document.documentElement.scrollWidth <= window.innerWidth`
* 60fps with 6 echoes + full VFX.
* Works offline / from `file://` — no network fetches except the two
  leaderboard calls in `game.js`.
* Never edit a file you do not own. See the owner table in `SPEC.md`.
