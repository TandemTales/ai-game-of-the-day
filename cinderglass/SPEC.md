# CINDERGLASS — Module Contract (read this before editing any file)

A falling-sand **thermodynamics puzzle** for the Bot Built Arcade. Plain ES5+/ES2017
**classic scripts** (NO ES modules — the game must run from `file://` as well as
over HTTP). Everything hangs off one global: `window.CG`.

```
cinderglass/
  index.html             loads css + all js in order, owns the DOM shell
  SPEC.md                this file
  TESTING.md             how to run the suite and the screenshot sweep
  PROGRESS.md            nightly build log / handoff
  assets/css/game.css    all styling for the DOM shell / HUD / menus   [OWNER: agent-ui]
  assets/js/core.js      engine: RAF loop, input, math, RNG, storage    [OWNER: lead]
  assets/js/materials.js the material table: physics constants + rules  [OWNER: lead]
  assets/js/sim.js       the cellular automaton (movement + heat)       [OWNER: lead]
  assets/js/levels.js    contract definitions + chamber generator       [OWNER: lead]
  assets/js/render.js    world renderer, emissive lighting, post FX     [OWNER: agent-render]
  assets/js/particles.js VFX above the grid (embers, steam wisps, glow) [OWNER: agent-particles]
  assets/js/audio.js     Web Audio procedural music + SFX               [OWNER: agent-audio]
  assets/js/ui.js        HUD / menus / modals / tutorial glue           [OWNER: agent-ui]
  assets/js/game.js      state machine, rules, scoring, leaderboard     [OWNER: lead]
  tools/screenshot.js    headless screenshot + smoke harness            [OWNER: lead]
```

**Never edit a file you do not own.** If you need a change in someone else's file,
report it in your final message instead and the lead will make it.

Script load order in `index.html`:
`core → materials → sim → levels → particles → audio → render → ui → game`

---

## 0. Conventions

* No external network requests. No CDN fonts, no image files fetched at runtime —
  all art is generated procedurally into canvases at boot. The only network calls
  in the whole game are the two leaderboard `fetch`es in `game.js`.
* Everything must work offline / from `file://`.
* Target 60fps on a mid-range phone. The simulation is the frame budget; art must
  be baked **once** at boot, never per-frame.
* Colors live in `CG.PALETTE` (core.js) and in the material table
  (`materials.js`). Do not invent one-off hex codes in gameplay code.
* All modules must be safe to call before `init()` (no throw), and every `init()`
  is synchronous unless noted.
* Every module registers itself as `CG.<Name>` and must not leak other globals.

---

## 1. The world model

The world is a **grid of cells**, not a tilemap of objects. Grid size is chosen
per chamber, `CG.Levels.W × CG.Levels.H`, currently `128 × 88` (11,264 cells). Cells are stored in parallel
typed arrays inside `CG.Sim`, never as JS objects:

```
mat   Uint8Array   material id (index into CG.Materials.BY_ID)
temp  Float32Array degrees "cg" — an arbitrary scale, water freezes at 0,
                   boils at 100, sand fuses near 700, stone melts near 1200
aux   Uint16Array  per-material scratch (gas lifetime counter)
dir   Int8Array    persistent lateral flow direction for fluids (-1, 0, +1)
```

Index of `(x, y)` is `y * W + x`. **`y` grows downward**; gravity is `+y`.

### 1.1 Simulation order — this is a correctness requirement, not a style note

`Sim.step()` runs one tick as four passes, in this exact order:

1. **Heat pass.** Explicit-Euler conduction across the 4-neighbourhood, plus
   emission/radiation for hot cells and per-material ambient bleed. Reads `temp`,
   writes `tempNext`, then swaps. Never in-place — in-place conduction is
   direction-biased and would make the sim non-deterministic under reordering.
2. **Reaction pass.** Per-cell phase changes and neighbour reactions from the
   material table (§2). Order-independent by construction: a reaction may only
   read the *current* cell and its neighbours' `mat`/`temp` and may only write the
   *current* cell, plus at most one flagged neighbour via the deferred write
   queue. Direct neighbour writes are forbidden.
3. **Movement pass.** Falling-sand displacement. Iterated **bottom row upward**,
   with the x-scan direction alternating per tick (`tick & 1`) so that piles do
   not lean permanently to one side. Fluids carry a persistent lateral
   direction in `sim.dir` and only reverse when blocked; picking a fresh
   direction each tick leaves a pool oscillating in a stable checkerboard
   instead of levelling.
4. **Delivery pass.** The crucible ingests anything that ends the tick
   *touching* it, not just matter that moved into it. Absorbing only on
   movement looks equivalent and is not: a pour that sets before it lands
   becomes a static solid sitting in the basin, which can never move again
   and so silently clogs the crucible forever.

`step()` must be a pure function of (grid state, `tick`) — **no `Math.random()`**.
All randomness comes from `CG.rng` seeded per chamber, so a replay of the same
inputs produces the same world. The test suite asserts this.

The sim runs at a **fixed 60 ticks/second**, decoupled from RAF, with a max of 4
catch-up ticks per frame (drop time rather than spiral).

### 1.2 Movement rules

Each material declares a `move` behaviour:

| behaviour  | rule |
|------------|------|
| `static`   | never moves (stone, glass, obsidian, ice, iron, wall, crucible) |
| `powder`   | falls down; else down-left/down-right; piles at its angle of repose |
| `liquid`   | falls down; else diagonals; else spreads sideways up to `flow` cells |
| `gas`      | rises; else diagonals up; else spreads; despawns at `lifetime` |

There is no `rigid` behaviour. Ice and glass are `static`: they hold their
shape where they set and never fall as a body. That is a design choice, not
an omission — an ice sheet is *structure*, and structure that collapses when
you thaw the cell under it would make freezing useless as a way to build.

Density decides displacement: a denser mobile cell swaps with a lighter mobile
cell below it (sand sinks through water, oil floats on water, steam rises through
everything).

---

## 2. Materials

`CG.Materials.BY_ID` is a frozen array; `CG.Materials.ID` maps name → id.
Every material declares at minimum:

```js
{ name, move, density, heatCapacity, conductivity, emissive,
  colorLo, colorHi,        // color ramp endpoints, sampled by temperature
  freezeAt, freezeTo,      // phase change when temp drops below
  meltAt,   meltTo,        // phase change when temp rises above
  reactions: [ { with, produce, produceOther, minTemp, chance, heat } ] }
```

Launch material set (a chamber may use a subset):

`VOID (air), WALL, CRUCIBLE, STONE, LAVA, OBSIDIAN, SAND, MOLTEN_GLASS, GLASS,
ICE, WATER, STEAM, OIL, BLAZE, EMBER, ASH, IRON, MOLTEN_IRON, STEEL`

Three of those exist for reasons worth stating, because they look redundant:

* **VOID has a density (0.20), not zero.** Gas buoyancy is measured against
  air, so with air at zero nothing can rise.
* **MOLTEN_GLASS** is separate from GLASS because molten glass has to *flow*
  to fill a mould and glass has to be static to hold a shape.
* **BLAZE** is burning fuel — a liquid that stays with the oil it came from.
  Fire modelled purely as a rising gas (EMBER) leaves its fuel the tick it
  forms, so a pool lit at one end never catches along its length. EMBER is
  the flame BLAZE throws off, not the thing that spreads.

Reactions that carry the puzzle vocabulary:

* `SAND` above `700` → `MOLTEN_GLASS`, which flows and sets to `GLASS` below `560`
* `LAVA` touching `WATER` → `OBSIDIAN` + `STEAM`, strongly exothermic
* `WATER` above `100` → `STEAM`; `STEAM` below `60` → `WATER` (condensation, so
  steam that hits a cold ceiling rains back down)
* `WATER` below `0` → `ICE`; `ICE` above `4` → `WATER`
* `STONE` above `1200` → `LAVA`; `LAVA` below `820` → `STONE`
* `IRON` above `1500` → `MOLTEN_IRON`, which stays liquid down to `1250`.
  That window is wide on purpose: molten iron sheds heat faster than
  anything else in the table, and with a freezing point just below its
  melting point a pour re-solidifies in mid-air and can never land.
* `MOLTEN_IRON` + `ASH` (carbon) above `1400` → `STEEL`
* `OIL` above `250` → `BLAZE` (burns in place, radiates into its
  neighbours, lights adjacent `OIL`, and decays to `ASH`)

Note what lava *cannot* do: it forms at a little over `1200` and cools from
there, so it can never melt iron. Any contract built on "pour lava on the
ingot" is unsolvable, and the reference solves in §4 exist to catch exactly
that class of mistake.

**`WALL` and `CRUCIBLE` are indestructible at every temperature.** They are the
chamber's guaranteed structure; no solution may rely on melting them.

---

## 3. The player's verb

The player has exactly **two tools** and no others:

* **Torch** — pours heat into a radial brush area, at `+K` per tick falling off
  with distance from the brush centre.
* **Quench** — removes heat over the same brush shape.

Held input applies continuously. Brush radius is adjustable (3 sizes). Fuel is a finite per-chamber resource that only the Torch consumes. It is
charged **per tick, in units of one second of the medium brush**
(`radius² / 6²`), not per cell touched: charging per cell makes the HUD
number meaningless to the player and swings it twentyfold between brush
sizes. Quench is free. Nothing else is ever placed, dug, dragged, or spawned by the player.
**If a design idea requires the player to place matter directly, it is out of
scope — it breaks the core premise.**

Input parity is a hard requirement:

* **Touch** — drag to paint; tool switch and brush size are thumb-reachable
  buttons; no gesture requires two fingers.
* **Mouse** — left-drag paints the active tool, right-drag paints the other one.
* **Keyboard** — arrow/WASD move a cursor, `Space` paints, `Q`/`E` switch tool,
  `1`–`3` brush size, `P` pause, `R` restart.

---

## 4. A contract (level)

`CG.Levels.LIST` is an ordered array. Each entry:

```js
{ id, name, blurb, hint, teaches,
  build(sim),                     // paints the starting chamber into the grid
  goal: { kind, material, amount },
  fuel, parTicks, hardTicks,
  solution }                      // reference solve, replayed by the tests
```

`goal.kind` is one of two, because a foundry does two different things:

* **`deliver`** — N cells of the material must reach the crucible. Only
  mobile matter can do this, so the target is always a liquid or a powder.
* **`create`** — N cells must exist in the world at once. This is how solid
  products are scored: glass, steel and obsidian are static the instant they
  set and can never be poured into anything. You are casting them.

`solution` is a list of `[fromTick, toTick, x, y, radius, sign]` brush
strokes. `cinderglass.levels.test.js` replays it and asserts the quota is
met inside the shift and the fuel. They are deliberately crude — one brush
parked in one place — so a chamber that only passes under expert play does
not pass here.

Win: the goal is met.
Lose: fuel exhausted **and** no path to the quota remains — in practice the run
ends on the shift bell (`hardTicks`) or player restart. A chamber must never be
able to reach an unwinnable-but-not-detected state; `levels.test.js` asserts every
chamber is solvable by a recorded input script.

### Scoring (`game.js` owns this)

```
base    = 1000 per contract cleared
purity  = up to  500  — fraction of delivered cells at the exact target material
speed   = up to  750  — scaled by (parTicks / actualTicks), capped at 1.5×
thrift  = up to  400  — fraction of fuel unspent
combo   = +10% per contract cleared without restarting
```

Score is an integer, monotonically increasing across a run, and submitted once at
run end via the standard arcade endpoints:

```js
fetch('/api/leaderboard/rank?gameId=cinderglass&score=' + score)
fetch('/api/leaderboard/submit', { method:'POST', body: JSON.stringify({ gameId:'cinderglass', name, score }) })
```

Submission is skipped when `location.protocol === 'file:'`.

---

## 5. Why Cinderglass is distinct from every existing arcade game

The test is **genre AND core verb**, against each game currently on the site.

| Game | Its genre / core verb | Why Cinderglass is not that |
|---|---|---|
| **Paradox Vault** | Time-loop stealth-puzzle; verb = *move and rewind*, replaying past selves | Cinderglass has no avatar, no movement, and no time travel. The player is a disembodied heat source; the world's state advances forward only, and the challenge is thermodynamic causality rather than temporal causality. |
| **Bayou Brawlers** | Side-scrolling beat-'em-up; verb = *hit* | No characters, no combat, no combos, no health bars. |
| **Crimson Descent** | Lander physics; verb = *thrust and balance* | Nothing is piloted. The player never controls a body's momentum. |
| **Emberfall Gauntlet** | Arena action-RPG; verb = *swap style and fight* | Shares only a fire motif. No enemies, no waves, no melee. |
| **Core Crisis** | Arena/defense shooter; verb = *shoot* | Nothing is aimed at a target to destroy it; there is no projectile in the game. |
| **Nova Striker** | Bullet-hell shmup; verb = *dodge and shoot* | No player ship, no bullets, no dodging; the sim is not adversarial. |
| **Bastion Builder** | Auto-battler; verb = *draft and upgrade* | No roster, no units, no pre-battle loadout; every decision is made live and continuously, not chosen from a menu. |
| **Aurora Tower Defense** | Tower defense; verb = *place towers on a path* | Nothing is placed, and no enemy walks a path. The "flow" being managed is matter under gravity, not a lane of attackers. |
| **Neon Brick Breaker** | Breakout; verb = *deflect a ball* | No paddle, no ball, no reflex-timing element. |
| **Ocean Explorer** | Exploration; verb = *steer/collect* | No navigation and nothing to collect by touching it. |
| **Memory Match** | Card matching; verb = *flip and remember* | No hidden information; the whole board state is always visible. |

**The novel verb.** Every game above resolves player intent by *directly* moving,
placing, or striking something. Cinderglass never does. The player's only output
is a scalar field — temperature — and every visible change is the simulation's
*consequence*, not the player's action. That indirection is the design, and it is
what no other game in this arcade does.

**The novel genre.** There is no simulation-sandbox or cellular-automata game on
the site at all. Cinderglass is the first.
