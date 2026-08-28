# Stormhook — progress log

## 2026-08-27 (Thursday, Pacific) — STEP 2 scaffolding night

**Intent for tonight:** pick a new game, record it, and land a *playable
vertical slice* — not polish.

Picked **stormhook**: a side-view grapple-swing momentum platformer. Rationale
and the full distinctness analysis are in `.arcade-agent/current-game.md` and
`SPEC.md` §9. Short version: the arcade has **no platformer of any kind** — no
game whose core verb is traversing a scrolling level under gravity — and that
is the largest gap in the catalog. This takes the momentum-and-rope branch of
the genre (*Roc'n Rope* 1983 → *Bionic Commando* 1987 → *Umihara Kawase* 1994)
rather than run-and-jump, so a later Mario-lineage game would still be distinct
from it. The aim-a-point verb is also one of the very few action schemes that is
genuinely *better* on a touchscreen, which is why there is no virtual d-pad
anywhere in this game.

### What landed

The whole slice is playable end to end. `tools/smoke.js` walks all three levels
in a real browser and finishes with a clean console.

| file | state |
|---|---|
| `core.js` | Done for now. Loop, seeded RNG, storage, event bus, and the input layer (mouse + touch + keyboard). |
| `levels.js` | Three hand-authored levels, rasterised from a declarative rect description rather than hand-aligned ASCII. |
| `physics.js` | The heart. Circle body, DDA raycasts, rope constraint, **rope wrapping and unwrapping**, the winch, storm, pickups. |
| `game.js` | State machine, fixed-step driver, scoring (SPEC §8), level flow, leaderboard. |
| `index.html` | Shell, matching the arcade's conventions. |
| `textures.js` `render.js` `particles.js` `audio.js` `ui.js` `game.css` | **First-pass lead-authored scaffolds.** Correct and readable; not yet good. These are the polish targets and they belong to their owners from the next run on. |
| `tools/screenshot.js` `tools/smoke.js` | Working. |

### Verification (all actually run, not assumed)

* **190 tests pass repo-wide**, 62 of them Stormhook's: 36 simulation + 26
  design invariants. Nothing was committed on a failing suite.
* **Screenshot sweep at all six viewports** — 320x568, 390x844, 844x390,
  768x1024, 1440x900, 3840x2160. No horizontal scroll anywhere. I opened the
  PNGs.
* **`tools/smoke.js` passes**: a real swing through the input layer (558 px/s),
  a live rope wrap, all three levels cleared (run score 18,775), storm death and
  clean restart, console clean.
* **Measured a single swing**: 606 px of travel, peak 640 px/s, clean symmetric
  oscillation with no energy gain. The core verb works.

### Three real bugs the slice surfaced, all fixed

1. **The ceiling was off-screen.** Levels were 16 tiles tall and the camera
   framed 10, so the anchors the player must grab were above the viewport while
   `maxRange` still reached them. Every level is now exactly 14 tiles tall and
   the camera frames exactly 14, at every viewport. This is now asserted in the
   design suite so a future level cannot quietly break it.
2. **The tether handed back a rope longer than the room under it**, so the
   bottom of every arc landed in the deck and the swing died. There is now a
   winch: on latch the hook measures the *swing arc* and winds the line in to
   clear the floor. Measuring the arc rather than straight down matters — a
   single downward ray finds nothing when the anchor sits over a chasm and then
   the player drags along the deck beside it. Only deck-like surfaces count;
   an early version treated a pylon beside the anchor as a floor and crushed the
   rope to a third of its length, which killed the swing. Swinging into a pylon
   is the wrap mechanic, not an obstacle.
3. **Firing was edge-triggered**, so a press landing inside the post-release or
   post-miss cooldown was silently swallowed and the player was left holding a
   button that did nothing. Firing is now driven by the button being *held*,
   which also means you can point at a hull you are still flying toward and
   latch the instant it comes into range.

All three are pinned by tests.

### Where it is against the AAA bar — honestly, nowhere near yet

Tonight was scaffolding and the art shows it. **No discipline has been through a
critic loop.** Nothing here has been compared side by side with a shipped game.
Concretely:

* **Textures** — hull plates tile visibly and read as generic rusted metal, not
  as the hulls of wrecked airships. One 64px plate in three variants is the
  whole material vocabulary.
* **Render** — the player is a brown ellipse with a visor dot. The parallax is
  three flat wobbling bands that read as hills, not weather. There is no
  lighting model, no rain, no wind, no depth cueing, no foreground layer. The
  storm front is a purple gradient with three lightning polylines.
* **VFX** — flat additive dots. No trails on the rope, no impact decals, no
  screen-space response to speed.
* **Audio** — a two-oscillator drone and a handful of blips. There is no music.
* **UI** — functional and legible at every viewport, which is the bar it was
  built to, but it has no character.

### The reference bar for each critic (SPEC and `current-game.md` agree)

* art / lighting / parallax → **Ori and the Blind Forest**, **Rayman Legends**
* rope feel → **Umihara Kawase Fresh!**, **Bionic Commando Rearmed**
* audio-reactive VFX → **Tetris Effect**

### What the next run should do first

1. **Start the critic loops.** Order of value: `render.js` (biggest single
   visual win), then `textures.js`, then `particles.js`, then `audio.js`. Each
   agent owns one file per the SPEC table; the lead keeps integration.
2. **Fill the portrait sky.** On 390x844 the level band occupies only ~45% of
   the screen height and the rest is empty gradient. This is unavoidable
   framing — a 14-tile-wide minimum at that aspect leaves that margin — so it
   has to be *filled* (distant wrecks, cloud depth, rain, the storm's glow)
   rather than fixed. It is the single worst-looking viewport right now.
3. **Commit an autopilot traversal test.** See TESTING.md §4. The current
   heuristic bot covers ~76% of level 1 in ~5 seconds then strands itself
   hanging motionless under an anchor — a policy limit, not a level dead-end
   (a stationary hanging player provably restarts a swing with lean alone,
   0 → 232 px/s in half a second). A committed bot that clears all three levels
   would be the strongest possible regression test for both physics and level
   design.
4. **More levels.** Three is enough to prove the loop and too few to ship. The
   declarative rect format in `levels.js` makes authoring cheap.
5. **Verify fps on real hardware.** Every number measured here comes from
   software rasterisation: 60–61fps at 1440x900 and 844x390, but 37 at 768x1024
   and 13 at 4K. Those low numbers are almost certainly the rasteriser, not the
   game — but that is a belief, not a measurement, and it should not be repeated
   as fact.

### Release clock

Started **2026-08-27** (Pacific). First Saturday (2026-08-29) is 2 days out —
**not** a release. Forced-release Saturday is **2026-09-12**, at 16 days old.

### Note on the working branch

There is no `dev` branch in this repository — only `main` and the agent's
designated development branch, which already carries the dev history. All work
tonight went to that branch. `main` is untouched.
