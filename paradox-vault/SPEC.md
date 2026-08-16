# PARADOX VAULT — Module Contract (read this before editing any file)

A top-down time-loop heist game for the Bot Built Arcade. Plain ES5+/ES2017 **classic
scripts** (NO ES modules — the game must run from `file://` as well as over HTTP).
Everything hangs off one global: `window.PV`.

```
paradox-vault/
  index.html            loads css + all js in order, owns the DOM shell
  SPEC.md               this file
  assets/css/game.css   all styling for the DOM shell / HUD / menus
  assets/js/core.js     engine: RAF loop, input, math, RNG, storage, events   [OWNER: lead]
  assets/js/textures.js procedural material + decal baking                    [OWNER: agent-textures]
  assets/js/particles.js VFX particle system                                  [OWNER: agent-particles]
  assets/js/audio.js    Web Audio procedural music + SFX                      [OWNER: agent-audio]
  assets/js/levels.js   room templates + vault generator                      [OWNER: lead]
  assets/js/entities.js actors & devices                                      [OWNER: lead]
  assets/js/render.js   world renderer, lighting, post FX                     [OWNER: agent-render]
  assets/js/ui.js       HUD/menus/modals/tutorial glue                        [OWNER: agent-ui]
  assets/js/game.js     state machine, rules, scoring, leaderboard            [OWNER: lead]
```

**Never edit a file you do not own.** If you need a change in someone else's file,
report it in your final message instead.

Script load order in `index.html`:
`core → textures → particles → audio → levels → entities → render → ui → game`

---

## 0. Conventions

* No external network requests. No CDN fonts, no image files fetched at runtime
  (all art is generated procedurally into canvases at boot). The only network calls
  in the whole game are the two leaderboard `fetch`es in `game.js`.
* Everything must work offline / from `file://`.
* Target 60fps on a mid-range phone. Bake expensive art **once** at boot.
* Units: the world is measured in **tiles**. `PV.TILE = 64` world px per tile.
  Rendering scales the world canvas; never hardcode CSS pixels in world code.
* Colors live in `PV.PALETTE` (core.js). Use them; don't invent one-off hex codes
  in gameplay code. Art modules may use their own richer internal palettes.
* All modules must be safe to call before `init()` (no throw), and all `init()`
  calls are synchronous unless noted.

## 1. Coordinate + timing model

* `dt` is **seconds**, clamped to `<= 1/20`.
* The simulation is fixed-step at 120Hz inside `game.js`; render is once per RAF.
  This matters: **echo replay must be deterministic**, so all gameplay movement
  happens in `fixedUpdate(FIXED_DT)` with `FIXED_DT = 1/120`.
* A **loop** is `LOOP_TICKS = 2640` fixed ticks (= 22.0 s).

## 2. `PV` core surface (core.js) — already implemented, just use it

```js
PV.TILE                     // 64
PV.PALETTE                  // { void, floorA, floorB, wall, wallLit, brass, gold,
                            //   holo, holoDim, laser, alarm, relic, ink, paper, ... }
PV.clamp(v,a,b) PV.lerp(a,b,t) PV.smoothstep(a,b,t) PV.damp(a,b,l,dt)
PV.rand()                   // seeded, deterministic; PV.setSeed(n)
PV.randRange(a,b) PV.randInt(a,b) PV.pick(arr) PV.shuffle(arr)
PV.hash2(x,y)               // stable 0..1 from int pair, for texture variation
PV.now()                    // performance.now() ms
PV.store.get(k,def) PV.store.set(k,v)      // namespaced localStorage, never throws
PV.on(evt,fn) PV.off(evt,fn) PV.emit(evt,payload)   // tiny event bus
PV.Input                    // see §3
PV.Loop.start(update, render) PV.Loop.stop()
PV.isTouch  PV.isMobile  PV.dpr()
PV.makeCanvas(w,h)          // returns {canvas, ctx} offscreen, willReadFrequently:false
```

### Event bus events emitted by gameplay (subscribe freely)
| event | payload |
|---|---|
| `loop:rewind` | `{loopIndex, echoesLeft}` |
| `loop:tick` | `{ticksLeft, total}` (once per fixed tick — cheap listeners only) |
| `player:step` | `{x,y,surface}` |
| `player:dash` | `{x,y,dx,dy}` |
| `echo:spawn` | `{x,y,index}` |
| `echo:desync` | `{x,y}` |
| `device:activate` | `{kind,x,y}` |
| `device:deactivate` | `{kind,x,y}` |
| `laser:hit` | `{x,y}` |
| `sentry:alert` | `{x,y,level}` — level 0..1 |
| `sentry:spot` | `{x,y}` |
| `relic:grab` | `{x,y,value}` |
| `vault:clear` | `{score,...}` |
| `run:over` | `{score,...}` |
| `ui:sfx` | `{name}` |

---

## 3. `PV.Input` (core.js)

```js
PV.Input.init(rootEl, canvasEl)
PV.Input.axis          // {x,y} normalized -1..1, already deadzoned + clamped to unit circle
PV.Input.pressed(name) // edge: true only on the frame it went down. names:
                       // 'action','rewind','pause','restart','any'
PV.Input.down(name)
PV.Input.consume(name) // clears the edge
PV.Input.stick         // {active,cx,cy,dx,dy,radius} for drawing the virtual stick
PV.Input.pointer       // {x,y,down} in CSS px relative to canvas
PV.Input.update()      // called by the loop at the START of each frame
PV.Input.lateUpdate()  // called at END of frame; clears edges
```
Desktop: WASD/arrows = axis, `Space`/`E`/`Enter` = action, `R` = rewind, `Esc`/`P` = pause.
Touch: left-half drag = floating virtual stick, right-side buttons (DOM, owned by ui.js)
call `PV.Input.virtual('action', true/false)` / `PV.Input.virtual('rewind', ...)`.

---

## 4. `PV.Textures` — OWNER: agent-textures

Bakes every material used by the renderer into offscreen canvases at boot. **No
external images.** Everything is drawn with Canvas2D primitives + per-pixel noise.

```js
PV.Textures.init()            // synchronous; must complete in < ~400ms on a phone
PV.Textures.ready             // bool
PV.Textures.get(name)         // -> HTMLCanvasElement
PV.Textures.pattern(ctx,name) // -> CanvasPattern (cached, 'repeat')
PV.Textures.variant(name, i)  // -> HTMLCanvasElement, deterministic variant #i
```

### Required texture names (exact strings)

**Seamlessly tiling, 128×128** (they are tiled across the floor at 64px world tiles,
so they must tile at 128 and look right when drawn at 2 tiles):
| name | look |
|---|---|
| `floor.marble` | polished near-black marble, cool grey-blue veining, subtle specular sheen |
| `floor.marbleGold` | same marble but with fine gold-inlay veining |
| `floor.granite` | matte dark granite, fine speckle — used for service corridors |
| `floor.parquet` | dark walnut herringbone parquet with warm varnish |
| `floor.carpet` | deep oxblood woven carpet, visible weave, slight pile direction |
| `floor.grate` | brushed steel floor grate, holes with depth + rim highlight |
| `wall.stone` | dark limestone block face (for the wall *cap* top surface) |
| `wall.panel` | walnut wainscot panel with brass edge |
| `wall.concrete` | raw board-formed concrete |
| `metal.brushed` | brushed steel, anisotropic streaks |
| `metal.brass` | warm brass with fine circular brushing |
| `glass.frosted` | frosted glass with faint diagonal streaks (alpha varies) |
| `noise.grain` | 256×256 monochrome film grain, alpha only |
| `noise.blue` | 128×128 blue-noise (for dithering) |

**Decals / sprites (non-tiling, transparent background)**
| name | size | look |
|---|---|---|
| `decal.crack` ×4 variants | 128 | hairline floor cracks |
| `decal.scuff` ×4 variants | 128 | soft dark scuffs / dirt |
| `decal.medallion` | 256 | ornate art-deco brass floor medallion (radial sunburst + concentric rings) |
| `decal.rug` | 512×384 | ornate deco rug with fringe, oxblood + gold |
| `decal.dust` | 64 | soft round dust mote (radial gradient) |
| `decal.caustic` | 256 | soft light-caustic blob for the skylight |
| `icon.relic.crown` `icon.relic.orb` `icon.relic.mask` `icon.relic.blade` `icon.relic.chalice` | 128 | jewel-like treasure icons, gold + gem, with rim light. Drawn *unlit*; renderer adds glow. |
| `prop.column` | 128×256 | fluted deco column seen top-down-ish (cap + shaft shadow) |
| `prop.crate` | 128 | banded shipping crate, top-down |
| `prop.plant` | 128 | potted palm, top-down |
| `prop.bench` | 192×96 | museum bench, top-down |
| `prop.vitrine` | 128 | glass display case, top-down, empty |
| `vignette.soft` | 512 | radial black vignette (alpha) |

Quality bar: these must survive a 4K desktop screen. Build at 2× and downscale, use
multi-octave value noise, and always finish with a subtle contrast/curve pass so
nothing looks like flat CSS gradients. Add per-material specular streaks and
edge-darkening (ambient occlusion at the borders) so tiles read as physical.

`PV.Textures.get` must never return `null` — return a magenta 8×8 checker if a name
is unknown, and `console.warn` once.

---

## 5. `PV.Particles` — OWNER: agent-particles

A pooled, allocation-free particle system. Max 2500 live particles; degrade
gracefully (drop oldest) rather than stutter.

```js
PV.Particles.init()
PV.Particles.update(dt)
PV.Particles.draw(ctx, layer)   // layer: 'ground' | 'air'  (ground = under actors)
PV.Particles.emit(type, x, y, opts)   // opts: {dx,dy,count,scale,color,angle,spread,life}
PV.Particles.clear()
PV.Particles.count              // live count, for the debug overlay
```

Required `type` strings, and what they should look like:
| type | layer | look |
|---|---|---|
| `dust` | ground | small pale motes kicked up by footsteps, fade + drift |
| `sparkGold` | air | hot gold sparks with gravity + short trails |
| `sparkRed` | air | alarm sparks |
| `holoShard` | air | cyan angular shards that spawn when an echo appears/desyncs, fading with a scanline flicker |
| `smoke` | air | soft dark volumetric puff, expands + rises slightly |
| `glassShard` | ground | bright shards with specular flash |
| `emberFloat` | air | slow warm floating embers (ambient) |
| `motes` | air | ambient gold dust motes drifting in light shafts — long-lived |
| `ripple` | ground | expanding thin ring (used for interactions and rewind) |
| `chrono` | air | rewind FX: cyan/violet streaks converging on a point |
| `steam` | air | white vent steam |
| `confetti` | air | vault-clear celebration, gold + teal foil that tumbles (needs 3D-ish flip) |
| `bloodless` | ground | short dark impact splat for sentry hits (no gore — energy discharge) |

The system additively blends `sparkGold`, `sparkRed`, `holoShard`, `chrono`, `motes`.
Everything else is source-over. Sort within a layer by type so blend modes batch.

Particles must look **cinematic**: use per-particle rotation, non-uniform scale,
soft radial falloff sprites baked once at init (do NOT call `createRadialGradient`
per particle per frame), and velocity-stretched trails for sparks.

---

## 6. `PV.Audio` — OWNER: agent-audio

100% procedural Web Audio. No audio files. Must not create the AudioContext until a
user gesture; `PV.Audio.unlock()` is called by ui.js on the first tap/keypress.

```js
PV.Audio.unlock()                 // safe to call many times
PV.Audio.ready                    // bool
PV.Audio.muted                    // getter/setter, persisted via PV.store
PV.Audio.setMusicVolume(v) PV.Audio.setSfxVolume(v)   // 0..1, persisted
PV.Audio.playMusic(track)         // 'menu' | 'heist' | 'tension' | 'victory'
PV.Audio.stopMusic(fadeMs)
PV.Audio.setTension(t)            // 0..1 — smoothly morphs the 'heist' bed:
                                  // adds percussion, raises filter, adds dissonance
PV.Audio.sfx(name, opts)          // opts: {vol, rate, pan (-1..1)}
```

Required sfx names: `step`, `stepCarpet`, `dash`, `uiClick`, `uiBack`, `uiHover`,
`rewind`, `echoSpawn`, `echoDesync`, `plateDown`, `plateUp`, `doorOpen`, `doorClose`,
`terminalBeep`, `terminalDone`, `laserOn`, `laserOff`, `laserHit`, `alarm`,
`sentryPing`, `sentrySpot`, `relicGrab`, `relicBig`, `vaultClear`, `fail`,
`countdown`, `timeLow`, `glass`, `steam`.

Music direction: a slinky, tense heist score — upright-bass-ish sub pluck, brushed
hats, rhodes/vibraphone stabs in a minor mode, and a slow filtered pad. `tension`
layers in a rising cluster. Everything must be beat-locked to a single scheduler
clock so `setTension` transitions never click. Keep total CPU under ~3% — use a few
long-lived nodes and scheduled envelopes, never one node per frame.

`PV.Audio` also self-subscribes to the event bus (§2) so gameplay code does not need
to call `sfx()` for common events — subscribe in `init()` to `player:step`,
`loop:rewind`, `echo:spawn`, `echo:desync`, `device:activate`, `device:deactivate`,
`laser:hit`, `sentry:spot`, `relic:grab`, `vault:clear`, `run:over`, `ui:sfx`.

---

## 7. `PV.UI` — OWNER: agent-ui  (owns `assets/css/game.css` and the DOM inside
`#pv-ui`, and only the markup between `<!-- UI:START -->` / `<!-- UI:END -->` in
index.html)

```js
PV.UI.init()
PV.UI.showScreen(name)   // 'boot'|'title'|'brief'|'hud'|'pause'|'clear'|'gameover'|'help'
PV.UI.setHUD(state)      // called every render frame with the HUD view-model, see below
PV.UI.toast(msg, ms)
PV.UI.modal({title, body, buttons:[{label,cls,onClick}]})
PV.UI.closeModal()
PV.UI.prompt({title, body, placeholder, maxLength}) -> Promise<string|null>
PV.UI.setBrief(vault)    // mission brief card before a vault starts
PV.UI.setResults(res)    // fill the clear/gameover screen
PV.UI.flash(kind)        // 'alarm' | 'rewind' | 'grab' — full-screen tint pulse
```

HUD view-model passed to `setHUD`:
```js
{ loopPct:0..1, ticksLeft, secondsLeft, loopIndex, echoesLeft, echoesMax,
  relicsHeld, relicsTotal, score, combo, alert:0..1, vaultName, vaultIndex,
  objective: 'string', canRewind: bool, carrying: 'crown'|null }
```

Style bar: this is an art-deco heist. Think brass rules, thin engraved hairlines,
letterpress-y numerals, a teal/gold duotone, glassmorphism used *sparingly* and
correctly (backdrop-filter with a real border + inner highlight). The HUD must never
occlude gameplay on a 375×667 phone in portrait **or** landscape, and must look
composed (not floaty) on a 3840×2160 desktop. Use `clamp()`/`svh`/safe-area insets.
Every interactive element needs a real pressed/hover/focus-visible state and
`touch-action: manipulation`. Respect `prefers-reduced-motion`.

The one game font is loaded from `index.html` — a `@font-face`-free stack:
`ui.js`/CSS must use the stack defined in `game.css` `--font-display` /
`--font-ui`, built only from web-safe fonts. (The arcade site uses 'Press Start 2P'
from Google Fonts on its own pages; **this game must not fetch it** — keep offline.)

---

## 8. Gameplay contract (lead-owned, listed so other modules can read state)

State is split in two. **`PV.Game.state` is run/meta state only** — it is not the
simulation:
```js
PV.Game.state = {
  phase: 'boot'|'title'|'brief'|'playing'|'rewinding'|'paused'|'clear'|'gameover',
  vaultIndex, vault,        // vault = the parsed level from PV.Levels.get()
  loopIndex,                // 0-based, increments on every rewind
  echoesLeft, echoesMax,
  score, runScore
}
```

**`PV.Game.world` is the simulation** — everything that ticks lives here, in
separate typed arrays rather than one `devices` list:
```js
PV.Game.world = {
  vault, tick, ticksLeft, loopTicks,
  player: Actor, echoes: [Echo], allActors: [Actor],
  plates, levers, terminals, receivers, doors, lasers, mirrors, vents,
  relics, sentries, props, lamps, skylights,       // all arrays
  exit: Exit, signals, doorAt,                     // doorAt is a w*h tile index
  alert, alertTarget, rewindFx, phase, desyncs, caught, relicsHeldByAny
}
```

Do not read gameplay values off `PV.Game.state` — `tick`, `echoes`, `player`,
`relics`, `sentries` and `alert` are all on `world`. The HUD gets its own
flattened view-model (§7), built once per frame in `game.js`; read that rather
than reaching into `world` from UI code.

### Rules
1. Each loop lasts 22 s (2640 ticks). Player inputs are recorded per tick.
2. On rewind (manual `R` or timer expiry) the world resets to its initial state and a
   new Echo is spawned that replays the just-finished recording. All prior echoes
   replay too, from tick 0.
3. Echoes are solid to devices (they press plates, hold terminals, trip lasers) but
   **pass through the player** — touching one costs nothing, but standing where an
   echo *started* pushes you out.
4. Devices: `plate` (held while stood on), `lever` (toggle on interact), `terminal`
   (needs `T` continuous seconds of standing adjacent), `door` (opens on its linked
   signal), `laser` (kills on contact → forced rewind, costs an echo),
   `mirror` (pushable, reflects lasers), `vent` (pushes actors), `pressureDoor`.
5. Sentries patrol a route with a vision cone. Seeing the player or an echo raises
   `alert`; at 1.0 the alarm forces a rewind and costs an echo.
6. Relics: pick up by walking over, must be carried to the `exit`. Carrying slows you
   5% and makes your light brighter (higher sentry detection radius).
7. The vault is cleared when all required relics are banked at the exit.
8. Running out of echoes with relics still out = run over.

### Scoring (game.js)
`vaultScore = 250*relics + 400*(echoesLeft) + floor(6*secondsLeftOnFinalLoop) + noAlarmBonus(300) + perfectBonus(500 if 0 desyncs)`, times a difficulty multiplier that grows 1.0, 1.15, 1.3 … per vault. Total run score is submitted to
`/api/leaderboard/*` with `gameId = 'paradox-vault'` exactly as the other games do.

---

## 9. Definition of done for every module

* Zero console errors or warnings in Chrome desktop **and** mobile emulation.
* No layout shift, no horizontal scrollbar, at 320px, 375px, 768px, 1440px, 3840px.
* 60fps with 6 echoes + 3 sentries + full VFX on a 4× CPU throttle.
* Passes a blind side-by-side visual comparison against a shipped AAA game in the
  stealth/heist genre. That is the bar, not "looks good for a browser game".
