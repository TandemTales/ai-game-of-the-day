# ZEPHYR CIRCUIT — Module Contract (read this before editing any file)

A 3D kart racer in the Super Mario Kart lineage, built on a vendored
**three.js r185**. Low-poly flat-shaded karts drifting around floating sky
islands at golden hour. Everything hangs off one global: `window.ZC`.

## 0. Module layout — a deliberate hybrid. Do not "tidy" it.

```
zephyr-circuit/
  index.html                     shell, import map, script order      [lead]
  SPEC.md / TESTING.md / PROGRESS.md

  assets/fonts/                  vendored OFL fonts (Outfit, Bungee)
  assets/js/vendor/              three.js r185 (module + core chunk) and its
                                 postprocessing passes — NEVER EDIT
  assets/css/game.css            DOM shell / HUD / menus              [agent-ui]

  ---- classic scripts: pure logic on window.ZC, unit tested ----
  assets/js/core.js              math, RNG, storage, events, input    [lead]
  assets/js/track.js             spline -> baked segments, projection [lead]
  assets/js/tracks.js            the track definitions                [lead]
  assets/js/kart.js              kart physics, drift and boost        [lead]
  assets/js/items.js             item definitions + roulette          [lead]
  assets/js/ai.js                AI drivers                           [agent-ai]
  assets/js/race.js              race state machine, laps, placement  [lead]
  assets/js/ui.js                HUD / menus / touch controls         [agent-ui]
  assets/js/audio.js             procedural engine note + music       [agent-audio]

  ---- ESM: the three.js render layer ----
  assets/js/render/scene.js      renderer, camera, lights, sky, post  [agent-render]
  assets/js/render/trackmesh.js  road / verge / island geometry       [agent-render]
  assets/js/render/karts.js      kart models and their animation      [agent-models]
  assets/js/render/items.js      boxes, projectiles, hazards, shields [agent-models]
  assets/js/render/fx.js         drift sparks, speed lines, dust      [agent-particles]
  assets/js/render/main.js       ESM entry — owns the RAF loop        [lead]

  tools/screenshot.js            headless screenshot + smoke harness  [lead]
```

**Never edit a file you do not own.** If you need a change in someone else's
file, report it in your final message and the lead will make it.

**Why the split.** Everything that can be tested without a GPU is a classic
script that knows nothing about three.js, so it loads into the `vm`-based Jest
harness the rest of the arcade already uses with no change to the repo's Jest
config. Only the renderer is ESM, because only the renderer needs three. Module
scripts are deferred, so every classic script has run and `window.ZC` is fully
populated before `render/main.js` boots.

**The render layer may read `ZC` freely. `ZC` may never read the render layer.**
If a logic module needs something from the renderer, the design is wrong.

Load order in `index.html`:
`core → track → tracks → kart → items → ai → race → ui → audio`, then the
module entry `render/main.js`.

### Conventions

* **No third-party runtime fetches.** Everything is vendored and served from
  our own origin. Same-origin fetches of files we authored are fine; the only
  ones in the game are the two leaderboard calls in `race.js`.
* All geometry and colour is generated procedurally at boot. There are no
  model or texture files, because none can be authored.
* Target 60fps on a mid-range phone. Build geometry **once**; never allocate
  in the frame loop. No `new THREE.Vector3()` inside `update()`.
* Every module registers itself as `ZC.<Name>` and leaks no other global.

---

## 1. The track model — read this before touching anything else

Everything in the game is derived from one thing: a **closed centerline
spline**. The road mesh, lap counting, the off-track test, respawn, the AI
racing line and item placement are all queries against it. Getting this right
is what makes the rest of the game tractable.

### 1.1 Authoring

A track in `tracks.js` is a list of control points, in metres:

```js
{ id, name, laps, points: [ { x, y, z, w, bank }, ... ], theme }
```

`w` is the road **half-width**; `bank` is the roll angle in radians, positive
banking into a left turn. A closed Catmull-Rom spline is fitted through the
points, and `w`/`bank` are interpolated along it.

### 1.2 Baking

`ZC.Track.bake(def)` samples the spline into `N` segments of roughly equal arc
length (~1.5 m each) and stores them in flat typed arrays — not objects, and
not `THREE.Vector3`s, because `track.js` must not know three.js exists:

```
px, py, pz      Float32Array   centerline position
tx, ty, tz      Float32Array   unit tangent (forward)
nx, ny, nz      Float32Array   unit normal (up, after banking)
rx, ry, rz      Float32Array   unit right (lateral)
halfWidth       Float32Array
s               Float32Array   arc length from the start line
curvature       Float32Array   signed 1/radius, for AI braking and camera lean
```

`bake()` is deterministic: same definition in, byte-identical arrays out. The
test suite asserts it.

### 1.3 Projection — the one query everything uses

```js
ZC.Track.project(track, x, y, z, hint) -> { seg, s, t, surfaceY, onRoad }
```

* `seg` nearest segment index, `s` distance along the track
* `t` **normalised** lateral offset: 0 at the centerline, ±1 at the road edge
* `surfaceY` the road surface height at that point, including banking
* `onRoad` is `|t| <= 1`

`hint` is the caller's previous `seg`. Karts move continuously, so the search
only scans a window around the hint — a full scan is O(N) and is only needed
when placing a kart from nothing. **Always pass the hint.** Forgetting it is
the single easiest way to make this game slow.

### 1.4 Lap validity

`s` alone cannot count laps: a kart that reverses over the start line would
score one. The track is divided into `CHECKPOINTS` (default 24) equal arcs. A
lap counts only when every checkpoint has been passed **in order** and the kart
then crosses `s = 0` travelling forward. Cutting a corner that skips a
checkpoint therefore cannot shorten a lap, which is what removes the need for
any separate anti-cheat geometry.

Respawn after falling uses the last passed checkpoint, placed on the
centerline, facing along the tangent.

---

## 2. Kart physics

Arcade, not simulation. One kart's state is a plain object; `ZC.Kart.step()`
is a pure function of (kart, input, track, dt) and touches nothing else, so the
whole field can be stepped deterministically in a test.

```js
{ x, y, z, yaw, speed, vy, slip, seg, s, t,
  drift: { active, dir, charge, tier }, boost, grounded, lap, checkpoint }
```

* **Steering** yaw rate scales with a speed curve — a kart that turns as
  sharply at 5 km/h as at 90 km/h feels broken in both places.
* **Drift** is the skill mechanic and the reason to play. Hold drift while
  turning: the kart's heading rotates further than its velocity, `charge`
  accumulates, and it crosses three tiers. Release for a boost sized by tier.
  Charge only accumulates while actually sliding, so holding drift down a
  straight earns nothing.
* **Off-road** (`|t| > 1`) applies a hard speed cap and extra drag.
* **Falling** off the island edge is `y` below the island floor: the kart is
  fished out and returned to the last checkpoint after a short delay.
* Gravity and a ground snap to `surfaceY` handle hills; there is no airborne
  control beyond keeping the current heading.

**`step()` must never call `Math.random()`.** All randomness comes from
`ZC.rand()`, seeded per race, so a replay of the same inputs produces the same
race. The test suite asserts this.

The simulation is **fixed-step at 120 Hz** with a maximum of 8 catch-up steps
per frame. Physics at a variable timestep makes drift charge frame-rate
dependent, which would make the leaderboard meaningless.

---

## 3. Race rules and scoring

`ZC.Race` owns the state machine: `attract → grid → countdown → racing →
finished → results`.

Placement is sorted by `(lap, s)` and recomputed once per tick, not per frame.

### Score

A run is a **cup**: the tracks in order, points per finish, one number at the
end.

```
finish points   1st..8th -> 15, 12, 10, 8, 6, 4, 2, 1
time bonus      up to 500 per track, scaled against the track's par time
clean bonus     200 per track with no falls
best lap        100 if you set the fastest lap of the race
```

Submitted once at cup end through the standard arcade endpoints:

```js
fetch('/api/leaderboard/rank?gameId=zephyr-circuit&score=' + score)
fetch('/api/leaderboard/submit', { method:'POST', body: JSON.stringify({ gameId:'zephyr-circuit', name, score }) })
```

---

## 4. Input parity — a hard requirement

| | accelerate | steer | drift | item |
|---|---|---|---|---|
| **Touch** | auto-accelerate; brake button | tilt-free: left/right thumb zones | hold drift button | tap item button |
| **Keyboard** | `W`/`↑`, brake `S`/`↓` | `A`/`D`, `←`/`→` | `Shift` / `Space` | `E` / `Ctrl` |
| **Gamepad** | right trigger | left stick | left trigger / `A` | `X` |

Touch **auto-accelerates**: a phone player cannot hold three controls at once,
and every shipped mobile kart racer does this. No control requires two hands to
reach, and no gesture needs two fingers.

---

## 5. Why Zephyr Circuit is distinct from every existing arcade game

The test is **genre AND core verb**, against each game currently on the site.
Core verb here is **drive** — steer, drift, boost, block.

| Game | Its genre / core verb | Why this is not that |
|---|---|---|
| **Paradox Vault** | Time-loop stealth puzzle; *move and rewind* | No time travel, no stealth, no puzzle. Racing is real-time and forward-only. |
| **Bayou Brawlers** | Beat-'em-up; *hit* | No combat, no health, no combos. |
| **Crimson Descent** | Lander physics; *thrust and balance* | Closest relative on the site — both are vehicles — but a lander is about killing momentum vertically against gravity, and a kart is about carrying momentum horizontally through corners against grip. Opposite skill. |
| **Emberfall Gauntlet** | Arena action-RPG; *fight* | No enemies to defeat, no character build. |
| **Core Crisis** | Arena/defense shooter; *shoot* | Items exist but there is no aiming-to-destroy loop; the goal is position, not kills. |
| **Nova Striker** | Bullet-hell; *dodge and shoot* | No projectile patterns, no dodging as the core skill. |
| **Bastion Builder** | Auto-battler; *draft and upgrade* | Nothing is chosen from a menu before play; every decision is made at speed. |
| **Aurora Tower Defense** | Tower defense; *place towers* | Nothing is placed. |
| **Neon Brick Breaker** | Breakout; *deflect a ball* | No paddle, no ball. |
| **Ocean Explorer** | Exploration; *steer and collect* | Shares "steer" only. There is no exploration and no collection; the whole game is competitive lap time against opponents. |
| **Memory Match** | Card matching; *flip and remember* | No hidden information. |

**Two firsts for the site.** It is the only racing game, and the only 3D game
of any kind. Nothing else on the arcade renders with WebGL or has a camera in
a world.
