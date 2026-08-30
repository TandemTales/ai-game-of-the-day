# Testing Stormhook (read before you touch anything)

Four independent layers, and you are expected to use all of them.

1. **`__tests__/stormhook.test.js`** — headless simulation. Fast, no browser.
   This is where the rope solver is pinned down, and the rope solver *is* the
   game.
2. **`__tests__/stormhook.design.test.js`** — design invariants: that the
   levels are actually playable, that the storm is a real clock, and that the
   campaign gets harder. See §1b.
3. **`stormhook/tools/screenshot.js`** — real headless Chromium. The only way
   to make a claim about how the game *looks* or whether the console is clean.
4. **`stormhook/tools/smoke.js`** — real browser, whole campaign. Covers the
   code paths the other three structurally cannot see. See §3.

**Know what each layer cannot see.** The jest harness loads only `core.js`,
`levels.js` and `physics.js`; `textures/particles/audio/render/ui/game` need a
real canvas and DOM, so a crash in any of them keeps `npm test` green. The
screenshot sweep photographs one level and never runs a level transition, a
death, or a run ending. That is what `smoke.js` is for — and on its first run it
immediately caught two things the unit tests could not: that a still-attached
tether yanks a teleported player back off the beacon, and that a wrapped rope
unwraps within ~300ms as the player falls out of the geometry.

---

## 1. Simulation tests

```
npm test                      # whole repo
npx jest stormhook            # this game only
```

`__tests__/stormhook.harness.js` loads `core.js`, `levels.js` and `physics.js`
as classic scripts inside a `vm` context under a minimal browser shim, so real
gameplay code runs with no browser. It exports:

```js
loadSH()                      // -> {SH, sandbox, window}; a fresh isolated SH per call
input(over)                   // a neutral input frame, with overrides
run(SH, world, n, each)       // n fixed ticks; `each` supplies per-tick input
snapshot(world)               // the state that must be reproducible tick-for-tick
FIXED_DT                      // 1/120
```

**Always call `loadSH()` per test.** The RNG seed and `SH.TUNE` are both global;
tests that share an instance leak into each other, and several tests here
deliberately mutate `TUNE.maxRange`.

Covered today: seeded-RNG determinism, math edges, storage degradation, level
rasterisation, body collision (landing, resting, no tunnelling at max speed),
latching, swing energy conservation *in both directions* (it must gain speed
off-axis and must never swing higher than it was released from), reeling
bounds, release preserving velocity, **rope wrapping and unwrapping**, pivot
thrash bounds, bit-identical replay of an input tape, the winch, and
hold-to-fire.

### A note on the two tests that look redundant

`a taut swing conserves speed` and `a pendulum does not gain energy` are
opposite failure modes of the same solver. Removing the radial velocity
component too aggressively kills the swing (the game becomes unplayable);
removing it too little pumps energy in every frame (the player accelerates to
the speed cap and the game becomes uncontrollable). One test catches each.

## 1b. Design invariants

```
npx jest stormhook.design
```

A walking game would prove solvability with a flood fill. This game has no
walking, so reachability is a question about **anchors**: at every point along
the run there must be latchable geometry within `maxRange`, or the player
arrives with nothing to grab and the run is over regardless of skill. That is
the invariant these tests encode, and it is the one a level edit is most likely
to break silently.

Asserted per level: spawn/beacon/cores/hazards all sit in open air; hazards are
never floating; **every half-tile column between spawn and beacon has an anchor
in range** from at least one of three sample heights; every core and the beacon
has an anchor in range; standing still loses to the storm; and par time is
actually beatable by the front. Plus: every level is exactly 14 tiles tall
(§2), and storm speed rises across the campaign.

Run it and it prints the campaign profile:

| # | level | wide | run | cores | storm px/s | par | req. avg px/s |
|---|-------|------|-----|-------|-----------|-----|---------------|
| 1 | Shallow Wrecks | 84 | 77 | 9 | 44 | 42 | 88 |
| 2 | The Chain Yard | 96 | 89 | 14 | 62 | 48 | 89 |
| 3 | Foundry Spine | 108 | 101 | 18 | 78 | 55 | 88 |

The required average speed is deliberately flat at ~88 px/s while the storm
climbs 44 → 78: the traversal demand stays constant and the *pressure* is what
increases. A measured single swing peaks at ~640 px/s, so par has a lot of
headroom — par is meant to be a bonus, not a wall.

## 2. Screenshots / browser checks

Serve the repo root, then run the harness:

```
npx --yes http-server -p 8900 -c-1 --silent .
node stormhook/tools/screenshot.js out --vp 390x844
node stormhook/tools/screenshot.js out          # sweeps all six viewports
```

Viewports: `320x568`, `390x844`, `844x390`, `768x1024`, `1440x900`, `3840x2160`.
Mobile ones get touch + a phone UA.

Flags: `--url` (default boots `?level=1&auto=1`; drop `auto` to land on the
title screen), `--script file.js` (JS evaluated in the page before the
screenshot, for driving gameplay), `--wait ms`.

Writes `out/<viewport>.png` and `out/report.json` with fps, console
errors/warnings, non-local network requests, the camera scale, visible tile
counts, live pivot count, and a horizontal-scroll check.

If playwright/Chromium are not local to the repo, point at them:

```
SH_PLAYWRIGHT=/opt/node22/lib/node_modules/playwright \
SH_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
node stormhook/tools/screenshot.js out
```

**Actually open the PNGs.** A screenshot you did not look at verifies nothing.

### Driving gameplay from a script

Aim is a **screen** point, because that is what a cursor or a finger is;
`game.js` converts it through the camera every frame. So drive it that way:

```js
SH.Input.aim.x = innerWidth * 0.62;
SH.Input.aim.y = innerHeight * 0.12;
SH.Input._down.hook = true;       // also: dash, w, s, a, d
```

Writing `world.aim` directly does not work — it is overwritten each frame.

State worth asserting on:

```js
SH.Game.state.phase      // 'boot'|'title'|'playing'|'paused'|'clear'|'gameover'
SH.Game.world            // p, hook, cores, beacon, storm, combo, airTime
SH.Game.world.hook.pivots.length   // >1 means the rope is wrapped
SH.Physics.ropeInfo(SH.Game.world) // {anchor,last,pivots,used,eff,total}
SH.Loop.fps, SH.Loop.msAvg
SH.Particles.count, SH.Textures.bakeMs
SH.Render.camera         // {x,y,scale}
```

### Query params (implemented in `game.js`)
* `?level=N` — boot straight to level N (**1-based**)
* `?level=N&auto=1` — …and skip the title screen

### Reading the fps number honestly

On a machine with no GPU (CI, this sandbox) Chromium falls back to software
rasterisation and the reported fps is far below real hardware — this build
measures 60–61fps at 1440x900 and 844x390, but 37 at 768x1024 and 13 at 4K,
which is a rasteriser limit, not a game limit. Use the number to compare
before/after, never to claim the game does or does not hit 60fps. **A real GPU
check is still outstanding.**

## 3. Integration smoke test — run this before any release

```
npx --yes http-server -p 8900 -c-1 --silent .
SH_PLAYWRIGHT=/opt/node22/lib/node_modules/playwright \
SH_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
node stormhook/tools/smoke.js
```

Boots the game, drives a real swing **through the input layer**, forces a rope
wrap in a live frame, walks every level to its beacon, checks the clear and
gameover screens and the accumulated score, kills the player with the storm and
checks the level restarts, then checks layout and console.

**Exits non-zero** on any throw or unexpected console output, so it can gate a
release. `--levels N` shortens the walk; `--url` points it elsewhere.

Two tolerated failures, both environmental rather than defects:
* the arcade's `googletagmanager` tag, blocked by the sandbox proxy — present on
  every game page in this project;
* a 404 on `/api/leaderboard/rank` at run end, because that endpoint only exists
  on Cloudflare Pages (see `functions/`). The smoke test tracks failed request
  **URLs**, so a 404 on anything else still fails the run.

## 4. The autopilot (development aid, not a gate)

There is a heuristic bot in the scratch work — not committed — that scans for
the best anchor ahead, latches, releases when past the anchor and rising, and
reels while descending. It covers ~76% of level 1 in about 5 seconds (≈570
px/s average) before its release policy strands it hanging motionless under an
anchor. **It is a bot-policy limit, not a level dead-end** — a stationary
hanging player provably restarts a swing with lean alone (verified: 0 → 232
px/s in half a second). Turning this into a committed traversal test is
outstanding work; see `PROGRESS.md`.

## Non-negotiables

* Console clean — the two tolerated entries above and nothing else.
* No horizontal scrollbar at any width:
  `document.documentElement.scrollWidth <= window.innerWidth`
* Every level is exactly **14 tiles tall** and the camera frames exactly 14.
  An anchor off the top of the screen is an anchor the player cannot plan
  around, and `maxRange` (13 tiles) reaches further than a cropped view shows.
* Works offline / from `file://` — no network fetches except the two
  leaderboard calls in `game.js`. No CDN fonts (some older arcade games load
  Google Fonts; do not copy that).
* Never edit a file you do not own. See the owner table in `SPEC.md`.
