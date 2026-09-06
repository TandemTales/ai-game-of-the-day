# STORMHOOK — Module Contract (read this before editing any file)

A side-view grapple-swing momentum platformer for the Bot Built Arcade. Plain
ES5+/ES2017 **classic scripts** (NO ES modules — the game must run from
`file://` as well as over HTTP). Everything hangs off one global: `window.SH`.

```
stormhook/
  index.html             loads css + all js in order, owns the DOM shell   [OWNER: lead]
  SPEC.md                this file                                        [OWNER: lead]
  TESTING.md             how to verify                                    [OWNER: lead]
  PROGRESS.md            the nightly handoff log                          [OWNER: lead]
  assets/css/game.css    all styling for the DOM shell / HUD / menus      [OWNER: agent-ui]
  assets/js/core.js      engine: RAF loop, input, math, RNG, storage      [OWNER: lead]
  assets/js/textures.js  procedural material + sprite baking              [OWNER: agent-textures]
  assets/js/particles.js VFX particle system                              [OWNER: agent-vfx]
  assets/js/audio.js     Web Audio procedural music + SFX                 [OWNER: agent-audio]
  assets/js/levels.js    tile maps + level metadata                       [OWNER: lead]
  assets/js/physics.js   player body, tether rope solver, rope wrapping   [OWNER: lead]
  assets/js/render.js    world renderer, parallax, lighting, post FX      [OWNER: agent-render]
  assets/js/ui.js        HUD / menus / modals / touch hints               [OWNER: agent-ui]
  assets/js/game.js      state machine, rules, scoring, leaderboard       [OWNER: lead]
  tools/screenshot.js    headless Chromium viewport sweep                 [OWNER: lead]
  tools/smoke.js         headless Chromium integration run                [OWNER: lead]
```

**Never edit a file you do not own.** If you need a change in a file you do not
own, report it in your final message and the lead will make it.

Script load order in `index.html`:
`core → textures → particles → audio → levels → physics → render → ui → game`

---

## 0. Conventions

* **No external network requests.** No CDN fonts, no image files fetched at
  runtime — all art is generated procedurally into canvases at boot. The only
  network calls in the whole game are the two leaderboard `fetch`es in
  `game.js`. (Note: some older arcade games load Google Fonts. Do not copy that;
  copy `paradox-vault`, which does not.)
* Everything must work offline / from `file://`.
* Target 60fps on a mid-range phone. Bake expensive art **once** at boot.
* Units: the world is measured in **tiles**. `SH.TILE = 48` world px per tile.
  Rendering scales the world canvas; never hardcode CSS pixels in world code.
* Screen-space convention: **+x is right, +y is DOWN**. Gravity is `+y`.
* Colors live in `SH.PALETTE` (core.js). Gameplay code uses those; art modules
  may use richer internal palettes of their own.
* Every module must be safe to reference before `init()` (no throw), and every
  `init()` is synchronous unless explicitly noted.

## 1. Coordinate + timing model

* `dt` is **seconds**, clamped to `<= 1/20`.
* The simulation is **fixed-step at 120Hz** inside `game.js`
  (`FIXED_DT = 1/120`); render runs once per RAF. Fixed-step is not optional:
  rope constraint solving is position-based and becomes visibly springy under a
  variable step, and the replay/ghost feature planned for later needs
  determinism.
* All gameplay movement happens in `SH.Physics.step(world, input, FIXED_DT)`.
  Nothing outside `physics.js` may move the player.

## 2. The core verb

Aim a point → latch → swing → release. That is the whole game, and every design
decision defers to it.

* **Aim** is a world point, not a direction stick: the mouse cursor on desktop,
  the touch point on a phone. This is the reason the genre was chosen — it is
  one of the very few action control schemes that is *better* with a
  touchscreen, so there is no virtual d-pad anywhere in this game.
* **Latch** raycasts from the player toward the aim point, out to
  `SH.TUNE.maxRange`. It attaches to the first solid surface hit.
* **Swing** is a position-based distance constraint against the last rope pivot.
  When the constraint fires, the radial component of velocity is removed and the
  tangential component is kept in full — that conservation *is* the game feel.
  Do not add damping to the tangential component.
* **Release** simply drops the constraint. Velocity is untouched, so the player
  keeps everything the swing built. Releasing at the bottom of an arc converts
  the swing into horizontal speed; releasing at the top converts it into height.

### 2b. Rope wrapping (the signature mechanic)

The rope is a **polyline of pivots**, not a single segment. `pivots[0]` is the
anchor; the player hangs from `pivots[pivots.length-1]`.

* **Wrap:** when the segment from the last pivot to the player is obstructed by
  solid geometry, a new pivot is pushed at the blocking tile's exposed convex
  corner. This is what lets a player drop under a hull and swing around it.
* **Unwrap:** a pivot pops when the turn it represents unwinds — the sign of the
  cross product `(pivot - prevPivot) × (player - pivot)` flips back past the
  sign recorded when the pivot was created.
* **Effective length** at the last pivot is
  `ropeLen - sum(|pivots[i+1] - pivots[i]|)`, floored at `SH.TUNE.minLen`.

Wrapping is the difference between "a rope" and "a rubber band pinned to a
wall". It is load-bearing; `__tests__/stormhook.test.js` asserts it.

## 3. `SH` core surface (core.js) — implemented, just use it

```js
SH.TILE                       // 48
SH.PALETTE                    // { sky, stormA, stormB, hullDark, hull, hullLit,
                              //   iron, rust, brass, cable, coreGlow, beacon,
                              //   sparkA, sparkB, ink, paper, danger, ... }
SH.TUNE                       // every gameplay constant, one object (see §5)

SH.clamp(v,a,b) SH.lerp(a,b,t) SH.smoothstep(a,b,t) SH.damp(a,b,l,dt)
SH.len(x,y) SH.dist(ax,ay,bx,by) SH.sign(v) SH.approach(a,b,d)
SH.rand()                     // seeded, deterministic
SH.setSeed(n) SH.randRange(a,b) SH.randInt(a,b) SH.pick(arr)
SH.fmtNum(n) SH.fmtTime(sec)

SH.store.get(k, dflt) SH.store.set(k, v) SH.store.del(k)   // namespaced, safe if blocked

SH.on(evt, fn) SH.off(evt, fn) SH.emit(evt, payload)       // tiny event bus

SH.Loop.start(updateFn, renderFn)  SH.Loop.stop()
SH.Loop.fps  SH.Loop.msAvg

SH.Input.aim                  // {x,y} in CSS px, canvas-relative
SH.Input.aimWorld             // {x,y} world px — render.js writes this each frame
SH.Input.hook                 // bool: is the latch button held right now
SH.Input.hookPressed          // bool: went down this frame
SH.Input.hookReleased         // bool: went up this frame
SH.Input.reel                 // -1 reel in, +1 pay out, 0 idle
SH.Input.lean                 // -1..+1 horizontal air lean
SH.Input.dashPressed          // bool
SH.Input.isTouch              // bool, set on first touch event
SH.Input._down                // raw key/button map — tests and tools drive this
SH.Input.beginFrame() SH.Input.endFrame()
SH.makeCanvas(w,h)            // -> {canvas, ctx}, willReadFrequently off
```

## 4. Level format (levels.js)

A level is a rectangular char grid plus metadata.

| char | meaning                                                      |
|------|--------------------------------------------------------------|
| `.`  | empty air                                                    |
| `#`  | solid hull — collides, and the rope can latch and wrap on it |
| `=`  | thin girder — solid, latchable (visually a beam, not a slab) |
| `o`  | salvage core (pickup, scores)                                |
| `S`  | player spawn (exactly one)                                   |
| `X`  | extraction beacon (exactly one — touching it clears the level)|
| `^`  | hazard — kills on contact                                    |

```js
SH.Levels.count()             // number of levels
SH.Levels.get(i)              // 0-based -> {id, name, grid:[string], w, h,
                              //   stormSpeed, parTime, hint}
SH.Levels.solidAt(lv, tx, ty) // true for '#' and '='; OOB above/below is open,
                              //   OOB left/right is solid (levels are sealed)
```

Every level must satisfy the invariants asserted in
`__tests__/stormhook.design.test.js`: exactly one `S` and one `X`, the beacon
reachable from spawn under the movement model, and every `o` reachable.

## 5. Tuning (`SH.TUNE`, core.js)

One flat object so a designer can retune without hunting. Physics reads it live.

```
gravity 2100      airDrag 0.06       leanAccel 900     maxAirSpeed 1500
maxRange 620      reelSpeed 340      minLen 46         maxLen 640
dashSpeed 980     dashCooldown 0.55  groundFriction 9
comboAirTime 0.6  comboMax 12        coreValue 120     beaconBonus 1500
```

## 6. Physics surface (physics.js)

```js
SH.Physics.makeWorld(levelIndex)   // -> world
SH.Physics.step(world, input, dt)  // ONE fixed tick; the only mover
SH.Physics.fireHook(world)         // latch toward world.aim; -> bool attached
SH.Physics.releaseHook(world)
SH.Physics.rayCast(world, x, y, dx, dy, maxDist)  // -> {hit,x,y,tx,ty,nx,ny}|null
SH.Physics.segBlocked(world, ax, ay, bx, by)      // -> bool
```

`world` shape (read freely from render/ui/game; write only in physics.js):

```js
{
  level, grid, w, h,                 // tile data
  p: { x, y, vx, vy, r, onGround, dashCd, alive },
  hook: { attached, pivots:[{x,y,s}], len, aimX, aimY, firing, t },
  cores: [{x,y,taken}], beacon:{x,y,hit}, hazards:[...],
  storm: { x, speed },
  aim: { x, y },
  airTime, combo, score, time, cleared, dead
}
```

## 7. Contracts the art + audio modules must honour

Each of these is one file, one owner, and is called from `game.js`/`render.js`
only through the surface listed here. Adding to your own surface is fine;
changing someone else's is not.

```js
SH.Textures.init()            // bake everything once; sets SH.Textures.bakeMs
SH.Textures.get(name)         // -> canvas
SH.Render.init(canvas) SH.Render.resize() SH.Render.draw(world, alpha)
SH.Render.camera              // {x,y,scale}
SH.Render.viewport()          // world rect currently framed, after HUD insets
SH.Render.worldFromScreen(x,y)// -> {x,y}; this is what feeds SH.Input.aimWorld
SH.Particles.init() SH.Particles.update(dt) SH.Particles.draw(ctx, cam)
SH.Particles.burst(kind, x, y, opts) SH.Particles.count
SH.Audio.init() SH.Audio.sfx(name, opts) SH.Audio.music(track)
SH.Audio.setMuted(b) SH.Audio.duckFor(sec)
SH.UI.init() SH.UI.setScreen(name) SH.UI.hud(world) SH.UI.toast(msg, ms)
SH.UI.prompt({title, body, placeholder, maxLength})  // -> Promise<string|null>
```

`SH.Audio` must never construct an `AudioContext` before a user gesture, and
must degrade silently where Web Audio is unavailable.

## 8. Scoring (game.js owns this; do not compute score anywhere else)

1. A salvage core is worth `TUNE.coreValue × comboMult`.
2. `comboMult` is `1 + floor(airTime / TUNE.comboAirTime)`, capped at
   `TUNE.comboMax`. `airTime` accumulates only while the player is **not**
   touching ground, and resets to 0 the instant they do. Landing is the cost.
3. Reaching the beacon adds `TUNE.beaconBonus + max(0, round((parTime - time) * 100))`.
4. Death costs the level's banked combo but not the run score; the level restarts.
5. Final run score is the sum over cleared levels, submitted once at run end.

## 9. Why this is distinct from every game already in the arcade

The bar is not "different theme" — it is a different core verb.

| existing game | what it is | why Stormhook is not that |
|---|---|---|
| **Paradox Vault** | top-down time-loop stealth puzzle; the verb is *plan a route and replay it* | Side view, no stealth, no time loop, no puzzle-solving. Stormhook is real-time physics traversal — the challenge is executing an arc, not deducing a plan. |
| **Bayou Brawlers** | side-scrolling beat-'em-up; the verb is *combo an enemy on the ground* | Shares only "side view". Stormhook has no melee and no enemy health; the player is airborne almost the entire time and combat is not a mechanic at all. |
| **Crimson Descent** | lunar-lander; the verb is *null your velocity to zero and touch down softly* | The closest existing game, and still opposite: Crimson Descent is about *destroying* momentum on a fixed screen; Stormhook is about *conserving* it across a scrolling level. Thrust vectoring vs rope tension are different simulations and different skills. |
| **Emberfall Gauntlet** | arena wave combat with style-swapping | Fixed arena, enemy waves, melee. Stormhook has no arena, no waves, no enemies. |
| **Core Crisis** | shooter / base defense; the verb is *aim and shoot a swarm* | Aiming is where the similarity stops — Stormhook's aim attaches the player to the world instead of emitting a projectile. Nothing is destroyed. |
| **Nova Striker** | bullet-hell shmup; auto-scroll, dodge, fire | Autoscroll dodging vs player-driven traversal. No bullets, no firing. |
| **Bastion Builder** | auto-battler; the verb is *draft and place, then watch* | No avatar at all in that game. Stormhook is 100% moment-to-moment execution. |
| **Aurora Tower Defense** | tower defense; place, upgrade, watch a lane | Same: no avatar, no dexterity. |
| **Neon Brick Breaker** | paddle-and-ball on one screen | Indirect control of a ball vs direct control of a body. Single screen vs scrolling level. |
| **Ocean Explorer** | slow exploration | Opposite pacing; Stormhook punishes hesitation with an advancing storm. |
| **Memory Match** | card matching | No overlap. |
| **Midnight Menagerie** | single-screen arcade toy | No overlap. |

The categorical gap it fills: **there is currently no platformer of any kind in
the arcade** — no game whose core verb is traversing a scrolling level under
gravity. Stormhook is the first, and it takes the momentum-and-rope branch of
that genre (*Roc'n Rope* 1983 → *Bionic Commando* 1987 → *Umihara Kawase* 1994)
rather than the run-and-jump branch, so it stays distinct from anything a later
Mario-lineage game might add.
