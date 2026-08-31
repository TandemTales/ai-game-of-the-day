# Stormhook — progress log

## 2026-08-30T23:18:40-07:00 (Sunday, Pacific) — polish handoff

### What landed and was pushed

* `8a34380` — the renderer now derives sparse salvage rigs from real
  latchable surfaces. Each rig has suspension cables, a broken pressure-hull
  silhouette, a lit porthole, structural ribs, and a dangling line, so the
  route has recognizable world-space landmarks instead of isolated tile
  stamps. The beacon also throws a restrained world-anchored shaft through
  the weather and behind geometry.
* `4e9834a` — the title screen now presents the wreck field behind a split
  salvage briefing. The hook-line motif and `POINT · LATCH · RELEASE` cue are
  responsive at desktop and phone widths; controls and copy are unchanged.

### Verification actually performed

* Full repository Jest suite: **12 suites / 308 tests passed**. The changed
  renderer passed `node --check`, and `git diff --check` passed after restoring
  the original LF convention for the stylesheet.
* In-app browser visual sweep at **320x568, 390x844, 844x390, 768x1024,
  1440x900, and 3840x2160**: every capture remained in `playing`, matched its
  viewport width and height, had no horizontal overflow, and had no browser
  error/warning logs. I opened and read all six captures.
* Title captures at the default desktop size and 390x844 were read; the
  `Begin the run` button transitioned to `playing` with a live world and an
  alive player. The 390x844 gameplay capture also rendered the new route
  dressing without overflow.
* Standalone `stormhook/tools/screenshot.js` was not runnable because this
  checkout has no Playwright package and the global npm shim targets a missing
  module. The in-app browser supplied the visual evidence instead.

### Honest quality status

The route rigs and title scene are materially stronger in self-review, but no
independent critic worker was available in this run, so there is **no passing
blind side-by-side AAA verdict** to claim. The real-GPU performance gate also
remains unverified. Against the existing Ori/Rayman reference bar, the scene
still carries procedural stylization and the route needs more authored
landmark variety; the title is now a composed briefing but still needs an
independent comparison. No `.aaa-complete`, root Featured Game edit, release,
or `main` update was made.

### Next run

Start with an independent renderer/UI critic if the environment exposes one,
then inspect the worst remaining route-composition loss. Preserve the current
world-derived dressing, profile on real hardware before adding more draw cost,
and keep the forced-release target at **2026-09-12**. The outstanding autopilot
campaign regression remains separate from tonight's visual work.

## 2026-08-30 (Sunday, Pacific) — nightly intent

The active handoff is Stormhook, and tonight remains a bounded polish run;
forced release is Saturday 2026-09-12. I will focus on the largest verified
losses from the previous critic pass: route-readable wreck composition and
world-attached storm/light depth, with profiling before adding expensive draw
work. I will run the repository tests and the available real-browser checks
after each implementation unit, inspect representative captures, and record
any missing independent-critic or real-GPU evidence honestly. `main`, the root
Featured Game, and unrelated work remain out of scope.

## 2026-08-30 (Sunday, Pacific) — polish night intent

Stormhook is the active game; the superseded Lumen Pinnacle scaffold is not
tonight's target. This is a bounded polish run, not release night. Focus on two
high-value disciplines: first the world renderer and portrait sky depth, then
the UI's non-playing HUD leak and presentation hierarchy. Run each changed
file through the full test suite and a real-browser screenshot check before its
own commit/push. If the available environment cannot supply independent critic
workers, record that limitation plainly instead of inventing verdicts.

Tonight's starting bar remains honest: no discipline has a passing blind
side-by-side verdict, real-hardware performance is unverified, and `main` must
remain untouched.

### What landed and was pushed

* `c2264fc` — the HUD now exists only during play/pause, so score, salvage,
  level, time and storm warnings no longer leak through title or result screens.
* `2fa70f2` — renderer-local procedural storm layers, rain, wreck silhouettes,
  horizon haze and hull variation replaced the flat first-pass sky without
  consuming the simulation RNG.
* `47cef5d` — the browser smoke gate now recognizes the two failures that
  `TESTING.md` already documents as local-only: the sandbox-blocked Google tag
  and the static server's leaderboard 404. Other failed URLs and console noise
  still fail the gate.
* `aa7b33f` — a short first-run hook/reel/dash coach, stronger multiplier
  contrast, and a scannable three-action title flow improve touch and keyboard
  onboarding while retaining the non-playing HUD fix.
* `2de684f` — the orange capsule became a posed storm-salvager with helmet,
  visor, harness, winch pack and coat tails. Hulls gained repair plates, scars,
  oxidation and ribs; player/beacon light spill and restrained momentum cues
  make the traversal state more readable.

Every implementation unit was committed and pushed separately on `dev` after
its checks. `main`, the root Featured Game, and `.aaa-complete` were not touched.

### Verification actually performed

* **Repo tests:** 12 suites / **308 tests passed** after the final renderer and
  UI revisions; the three changed JavaScript files also pass `node --check`.
* **Real-browser campaign smoke:** passes boot, input-driven 485 px/s swing,
  two-pivot live rope wrap, all three clears (final score 18,738), gameover,
  storm death/restart, no horizontal scroll, expected local network behavior,
  and a clean console after the documented exclusions.
* **Six-view screenshot sweep opened and read:** 320x568, 390x844, 844x390,
  768x1024, 1440x900 and 3840x2160 all remained in `playing`, matched their
  viewport widths, and had no horizontal scrollbar. The touch title at 390x844
  was also captured and read; the gameplay HUD is absent there.
* **Software-rasterizer FPS snapshot:** 50, 32, 29, 14, 31 and 6 fps in the
  viewport order above. This regressed from the scaffold's desktop/landscape
  numbers and makes performance an explicit next-run risk. It is not evidence
  of real-device GPU performance.
* The only screenshot console message was the project's blocked external
  Google tag (`ERR_NETWORK_ACCESS_DENIED`), the documented sandbox condition.

### Independent side-by-side verdicts after the revision loop

Both critics used real shipped-game captures, inspected the revised PNGs rather
than the code, and still returned **FAIL**.

* **Renderer — FAIL vs Ori and the Blind Forest / Rayman Legends.** The critic
  confirmed that the salvager silhouette, hull variation and motion cues are
  materially improved and no longer look like the scaffold. Stormhook still
  loses on route-focused composition, distinct depth planes, surface-reactive
  lighting, authored structures and environmental storytelling. Portrait still
  divides into long atmospheric bands; desktop still has a low-information
  center. The tutorial panel also competes with the character in portrait.
* **UI — FAIL vs Umihara Kawase Fresh! / Bionic Commando Rearmed.** The critic
  confirmed the HUD leak remains fixed, `×1` is now immediately readable, the
  player/tether relationship is clearer, and contextual touch onboarding is a
  real improvement. It still loses because the title is an oversized web-style
  card in an empty scene, the coach is detached from its target, bottom controls
  form competing zones, and the playfield hierarchy remains weaker than the
  commercial references.

No discipline has a passing AAA critic verdict, so this game is not eligible
for a quality-based release.

### Still below the bar / next run starts here

1. **Composition before more particles.** Build recognisable wreck structures
   and route landmarks around the actual traversal line; reduce the empty
   central field and break portrait's horizontal bands. This may require a
   coordinated `levels.js` + renderer night while preserving one-file ownership.
2. **Make light belong to the world.** Beacon/core light should affect nearby
   rain, cloud edges and hull planes instead of reading as cyan sprites pasted
   over them.
3. **Compose the title as a game scene.** Replace the floating web-card feeling
   with a visual hook/gesture demonstration and tie the first-action coach to
   the target or tether. Reconcile the coach with Arcade/audio control zones.
4. **Profile before adding render cost.** The software sweep fell to 31 fps at
   1440x900 and 6 fps at 4K. Measure draw hotspots and test a real GPU/device;
   keep visual reductions adaptive if needed.
5. The uncommitted autopilot campaign regression and additional levels remain
   outstanding from scaffolding night.

Forced-release Saturday remains **2026-09-12**. Today is Sunday 2026-08-30
Pacific, so this was correctly a polish run only.

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

* **191 tests pass repo-wide**, 63 of them Stormhook's: 37 simulation + 26
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

### A fourth bug, caught by screenshotting a screen the sweep had skipped

The viewport sweep boots with `?auto=1`, so it had **only ever rendered
gameplay** — no title, clear or gameover screen had been looked at once. Shooting
the title screen on a phone showed it explaining *the mouse and the W/S keys* to
a touch player. `Input.isTouch` was set by the first `touchstart`, and the title
screen — the one place the control scheme is explained — is always built before
any touch can have happened. It now asks `matchMedia('(pointer: coarse)')`
instead, i.e. capability rather than history. Verified in a real browser on both
a desktop and a touch context, and pinned by a test.

The lesson worth carrying: a screenshot harness that only ever visits one screen
is not a screenshot harness. Shoot the title, clear and gameover screens too.

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
2. **The HUD sits behind the title screen** showing `×1`, `0/9`, `0:00.00`. It
   is dimmed to 25% and behind the modal, so it reads as background texture
   rather than a defect, but it should simply be hidden outside `playing`.
   One line in `ui.js`, which belongs to agent-ui from this run on.
3. **Fill the portrait sky.** On 390x844 the level band occupies only ~45% of
   the screen height and the rest is empty gradient. This is unavoidable
   framing — a 14-tile-wide minimum at that aspect leaves that margin — so it
   has to be *filled* (distant wrecks, cloud depth, rain, the storm's glow)
   rather than fixed. It is the single worst-looking viewport right now.
4. **Commit an autopilot traversal test.** See TESTING.md §4. The current
   heuristic bot covers ~76% of level 1 in ~5 seconds then strands itself
   hanging motionless under an anchor — a policy limit, not a level dead-end
   (a stationary hanging player provably restarts a swing with lean alone,
   0 → 232 px/s in half a second). A committed bot that clears all three levels
   would be the strongest possible regression test for both physics and level
   design.
5. **More levels.** Three is enough to prove the loop and too few to ship. The
   declarative rect format in `levels.js` makes authoring cheap.
6. **Verify fps on real hardware.** Every number measured here comes from
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

## Run 2026-08-31

- Monday Pacific polish run on `dev`; forced release remains Saturday
  2026-09-12. This run will focus on the highest-value remaining route
  composition and performance risks, with fresh browser evidence where the
  available harness permits.
- First inspect the current renderer/UI output and existing tests, then make
  only bounded changes that preserve the playable slice. No release or
  `main` promotion is planned tonight.
