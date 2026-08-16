# Paradox Vault — Progress Log

Newest entry at the top. This file is the handoff between nightly runs.

---

## 2026-08-15 — FORCED SATURDAY RELEASE (STEP 4)

Pacific date **Saturday 2026-08-15**. `paradox-vault` started 2026-08-11, so the
routine's STEP 1b forces a release tonight regardless of polish level. **No new
polish work is started this run.** Wrap-up only: tests, screenshot sweep, glaring
issues only, root `index.html` featured-game swap, `.aaa-complete`, promote to
`main`.

**Starting state on arrival.** `dev` at `86c977c`. No Friday agent run happened —
the last agent commit is `e7d1820 wip(paradox-vault): in-flight render/particles/
audio work from the discipline agents`, on top of which a human (jaroxby) pushed
ten Emberfall Gauntlet commits and then featured Emberfall Gauntlet on the home
page. That means:

* the render/particles/audio discipline work is in the tree **without recorded
  critic verdicts** — those three loops were cut off mid-flight, same as
  textures/UI were the run before;
* the outgoing featured game is **Emberfall Gauntlet**, not Bayou Brawlers as the
  2026-08-13 entry scouted. Tonight's index.html edit is adjusted accordingly.

Tonight's checklist, in order: full jest suite → `tools/smoke.js` → screenshot
sweep at all six viewports → fix only glaring defects → featured-game swap →
`.aaa-complete` with honest debt → push `dev` → fast-forward `main`.

### RELEASED. Everything below is what actually happened.

**Verification, all run against this build:**

| check | result |
|---|---|
| `npx jest` | 5 suites / **128 tests green** |
| `tools/smoke.js` | **13/13**, 0 console issues — boots, rewind accounting, all 10 vault transitions, late-vault rewind, run ends |
| screenshot sweep | all six viewports reach `playing`, **no h-scroll anywhere**, no console error but the known blocked gtag |
| touch controls | driven with **real pointer events** at 390x844 — see below |
| home page | asserted in-browser after the featured swap |

**Touch was the one release-blocker I had never seen exercised**, so I drove it
rather than reading the code and hoping. At 390x844 with `hasTouch`, a drag on
the left 62% of the screen engages the floating virtual stick (`active:true`,
full deflection `dx:62`) and moved the player **8.2 tiles**; tapping the
on-screen REWIND button spent an echo (3 → 2, one echo spawned, `loopIndex` +1).
Touch targets measure 74px (ACT) and 62px (REWIND). The stick renders clearly as
a large gold ring with a deflected knob. **Touch controls are fine.**

**One glaring defect found and fixed: the room was crushed to black.**

The screenshot sweep came back with the vault floor, the deco border band and
the player figure all effectively invisible at 1440x900. Rather than assume that
was the intended noir look, I stood the last critic-reviewed build (`bdac1e9`)
up in a second worktree on port 8901 and shot the same viewport side by side.
The old build was plainly more legible — so this was a **regression** introduced
by the uncritiqued render WIP, not an art choice.

Cause: agent-render's rework replaced "multiply by a flat grey, then screen the
lights back on" with a single multiply against a light buffer whose base level
is the ambient term. That architecture is *better*, but multiply can never
brighten, so `AMBIENT` alone now sets the black point of the whole image — and
it was left at `rgb(31,38,55)`. Anything the level does not directly light died.
The file's own comment calls that constant "the single most important number in
the renderer", which is exactly right.

Fixed by raising the pair to `rgb(60,70,94)` / `rgb(80,90,116)`. The room now
reads: marble floor texture, tile seams, the deco patterning on the red border
band, column depth, and the player. It keeps the new model's directional
shaping, so this is better than *both* the dark WIP and the pre-WIP build.
Re-ran jest (128 green) and smoke (13/13) after the change. Commit `881f710`.

**Featured-game swap** (`8b56a98`). Paradox Vault is now the featured game.
Note the 2026-08-13 scouting above was stale: the outgoing featured game was
**Emberfall Gauntlet**, not Bayou Brawlers — a human featured Emberfall on
2026-08-14. Rotating it out meant dropping `li[data-id="emberfall-gauntlet"]`
from *two* places, both of which hide the featured game's duplicate `<li>`: the
`/* Hide removed games */` CSS rule and the `DOMContentLoaded` `querySelectorAll`
removal. Asserted in-browser afterwards: featured heading, play href,
`leaderboard.html?gameId=paradox-vault`, `.rate[data-id="paradox-vault"]` with
five stars and a `<span class="score">` immediately after it, Emberfall visible
in More Games, no page errors, no h-scroll. Per the earlier scout note,
paradox-vault was **not** added to the hide list and has no `<li>` of its own
yet — whoever rotates it out next should add one.

**Observation, deliberately not acted on:** `bayou-brawlers` is still in both
hide lists from when *it* was rotated out of the featured slot, so it is
currently invisible on the site rather than sitting in More Games. That may be
intentional (the CSS rule is titled "Hide removed games"), so I left it alone —
but if it was an oversight during the last rotation, that is where to look.

**Critic verdicts: there are none, and the release does not pretend otherwise.**
All five disciplines — textures, UI, render, particles, audio — had their critic
loops cut off mid-flight across three consecutive killed runs. No blind
side-by-side was ever completed, and no shipping judge was run. That is allowed
for a forced Saturday release and forbidden for a quality-based one; this was
the former. `.aaa-complete` records it in exactly those terms, along with ten
items of carried debt — the big ones being that **audio has never been heard by
anything**, the 60fps target is unverifiable in this GPU-less sandbox, `bakeMs`
is over the phone budget, and only 5 of 10 vaults truly require the time-loop
mechanic.

**Next run: STEP 2, pick a new game.** `.arcade-agent/current-game.md` has been
updated to say no game is active.

---

## 2026-08-13 — polish night (STEP 3), in progress

Pacific date Thursday 2026-08-13. Not release night. Release is forced Saturday
2026-08-15, so **this run and one more (Friday) are all that is left**.

**Starting state confirmed on arrival:** `dev` at `d90dc60`, full suite green
(4 suites / 81 tests). Last run's `wip(paradox-vault)` texture + HUD work is in
the tree but neither `agent-textures` nor `agent-ui` ever recorded a critic
verdict — they were cut off mid-loop.

**Tonight's plan**, aimed squarely at the three disciplines that have had *no*
critic pass at all (PROGRESS 2026-08-12, item 4):

1. `agent-particles` — `particles.js`. VFX has never been looked at.
2. `agent-render` — `render.js`. The player figure reads as an indistinct blob,
   props/actors are unarticulated, and this is also where the fill-rate problem
   lives (68.5% of samples in `drawImage`). Art **and** raster cost together.
3. `agent-audio` — `audio.js`. Never heard. Critic loop adapted for sound:
   offline-render the score to a buffer, compare spectrum/structure against a
   named shipped AAA stealth soundtrack rather than screenshots.

Each loops against a separate harsh critic doing a blind side-by-side against a
named shipped AAA title. Lead keeps `index.html`, `game.js`, `core.js`,
`levels.js`, `entities.js` and all integration.

### Lead work completed and verified this run

**Leaderboard path exercised end-to-end** — this was flagged unexercised in the
2026-08-12 entry. Drove a real headless run to `gameover` with `fetch` stubbed to
record calls, and confirmed the whole chain fires in order:

```
GET  /api/leaderboard/rank?gameId=paradox-vault&score=12345   -> {rank:3}
     PV.UI.prompt "Top 20 Score ... You placed #3 with 12,345"
POST /api/leaderboard/submit  {"gameId":"paradox-vault","name":"...","score":12345}
     toast "🏆 Submitted — rank #3",  phase 'gameover'
```

Payloads were then checked against the actual Cloudflare Functions
(`functions/api/leaderboard/{rank,submit}.ts`) and match their contracts exactly:
`rank` wants `gameId` + `score` on the query string, `submit` wants
`{gameId,name,score}` as JSON. Console clean apart from the known gtag block.
**The arcade integration is no longer an unknown.**

**Vault design verified** — PROGRESS 2026-08-12 item 5 said the solvability test
"proves a path exists, not that a vault is interesting". New suite
`__tests__/paradox-vault.design.test.js`, **47 tests**, closes that gap. The old
check flood-fills terrain and treats door tiles as walkable, so it only ever
proved *"solvable if every door happens to be open"*. The new suite models the
devices properly — plates/terminals pin an actor down (N simultaneous holds cost
N echoes), levers/receivers latch and cost nothing — and derives each vault's
true echo cost by searching every latch configuration.

Findings, all now asserted and green:

| # | vault | relics | echoes | loop | echo cost | gated by |
|---|---|---|---|---|---|---|
| 1 | The Grand Foyer | 1 | 3 | 22s | 0 | nothing — tutorial, by design |
| 2 | Weighing Room | 1 | 3 | 20s | 1 | plate |
| 3 | Twin Locks | 1 | 4 | 20s | 2 | two plates at once |
| 4 | The Long Gallery | 1 | 4 | 22s | 0 | laser timing |
| 5 | Records Uplink | 1 | 4 | 22s | 2 | two terminals |
| 6 | Night Watch | 2 | 4 | 24s | 0 | sentry vision |
| 7 | Hall of Refraction | 1 | 5 | 24s | 0 | mirror → receiver latch |
| 8 | Portrait Gallery | 3 | 5 | 24s | 2 | plates + hazards |
| 9 | Deep Storage | 2 | 5 | 24s | 2 | plates + hazards |
| 10 | The Paradox Vault | 3 | 6 | 26s | 3 | three holds + hazards |

Every vault clears inside its own echo budget with slack 2–5. Every signal a
door references is produced by some device, and no door sits on wall terrain
(the bug class that sealed vault 5's mask relic in an earlier build) — both are
now permanent assertions. The back half of the campaign is more demanding than
the front, and the endless "Lockdown" remix stays clearable for 12 cycles.

A caveat worth carrying: vaults 4, 6 and 7 have echo cost **0** — they are gated
by hazards or by a latching receiver, not by holding a signal. That is
legitimate design variety, but it means only 5 of 10 vaults genuinely require
the signature mechanic. The suite asserts that ratio does not get worse.

Full suite is now **5 suites / 128 tests green**.

**New guard: `paradox-vault/tools/smoke.js`.** While testing progression I hit a
`ReferenceError: propCache is not defined` in `R.invalidate()` (render.js), which
`startVault()` calls on **every vault transition** — so the game would have
crashed the instant a player finished vault 1. Both the jest suite and the
screenshot sweep were green through it, and structurally always would be: jest
loads only core/levels/entities, and the screenshot tool boots one vault and
photographs it. `smoke.js` walks all ten vaults, rewinds early and late, ends the
run, and exits non-zero on any throw or unexpected console output. Run it before
any release. (The defect itself is agent-render's file and was reported to it.)

### The GPU framerate question is CLOSED as un-answerable here — stop retrying it

The 2026-08-12 entry made "confirm framerate on real GPU hardware" the next run's
first job. It cannot be done in this sandbox, and I established that rather than
assuming it. There is no `/dev/dri`, no `lspci`, no `glxinfo`, and Chromium
reports the same software rasteriser under **every** launch configuration tried:

| launch args | WebGL renderer |
|---|---|
| *(defaults)* | ANGLE (Google, Vulkan 1.3.0 (**SwiftShader** Device (Subzero)), SwiftShader driver) |
| `--use-gl=angle` | identical |
| `--enable-gpu-rasterization --ignore-gpu-blocklist` | identical |

So every fps number any run records here — including all of tonight's — is
software-rasterised and is **only** valid as a relative before/after measure.
A future nightly run in this same sandbox will get the same answer; do not spend
budget re-testing it. Closing the 60fps line in SPEC §9 needs a human to open
the game on real hardware. **Treat it as permanent carried debt, not a to-do.**

What *is* actionable here, and was handed to `agent-render`: cutting the number
of full-screen composites. That is unambiguously correct work whether or not a
real GPU would have absorbed the cost.

### Release prep — the exact root `index.html` edit, scouted so Saturday need not

Featured block lives at `index.html` around line 327. Swap its contents and move
the outgoing featured game (**Bayou Brawlers: Gearbound**, `bayou-brawlers`) into
the top of the `More Games` `<ul id="games">` list at ~line 357. Note the two
markup shapes differ:

* **Featured**: `<div class="featured">` with `<h2>Featured Game: NAME</h2>`, a
  `<p>` blurb, `.play-btn`, a `.leaderboard-btn` to
  `leaderboard.html?gameId=<slug>`, then `<div class="rate" data-id="<slug>">`
  holding five `<span data-star="N">★</span>`, then `<span class="score"></span>`.
  The `data-id` sits on the `.rate` div here.
* **More Games `<li>`**: `data-id` sits on the **`<li>`** instead, the `.rate` div
  is bare, and the play/leaderboard links live in a `<div class="actions">` after
  a `<p class="game-description">`.

There is a comment in the file at line 324 stating the rule: the `.rate` div needs
a unique `data-id` with a `<span class="score"></span> `immediately after it, or
the rating system breaks when rotating featured games.

Also note lines 120–126: a `/* Hide removed games */` CSS rule hides
`li[data-id]` for `midnight-menagerie`, `crimson-descent`, `ocean-explorer` and
`memory-match`. Do not add `paradox-vault` to that list.

---

## 2026-08-12 — polish night (STEP 3)

**Starting state.** No `PROGRESS.md` and no `.arcade-agent/` existed; the
previous run left only the commit "Paradox Vault Pass 1" on `dev`. The game had
**never been verified** — no tests, and `TESTING.md` documented a Windows temp
path and Chrome MCP tools that do not exist on this runner, so the documented
way to look at the game did not work.

### Verification infrastructure built this run (this is the big one)

* `__tests__/paradox-vault.harness.js` — loads `core.js`, `levels.js`,
  `entities.js` as classic scripts in a `vm` under a minimal browser shim.
  Exports `loadPV / makeWorld / driveActor / reachable`.
* `__tests__/paradox-vault.test.js` — **75 tests**, all passing. Covers
  echo-replay determinism, RNG stability, `Recording` round-trip + capacity,
  collision against sealed maps, per-vault integrity **including solvability**,
  and the SPEC §8 scoring formula. Full repo suite: **4 suites / 81 tests green**.
* `paradox-vault/tools/screenshot.js` — real headless Chromium (Playwright).
  Sweeps all six required viewports, writes PNGs + a `report.json` with fps,
  console errors, non-local requests and a horizontal-scroll check.
* `TESTING.md` rewritten around what actually works here.

### Bugs found and fixed

1. **Vault 5 "Night Watch" was unwinnable.** Its door is declared at tile
   `(6,4)`, but that tile's terrain was `#` wall. `solidAt()` checks terrain
   *before* door state, so the door could never open; the inner chamber holding
   the `mask` relic (and the plate) was sealed off, and the vault needs both
   relics to clear. Every other door in the game sits on floor terrain, so the
   map was the typo — opened `(6,4)` to marble. Caught by the new solvability
   test, then re-confirmed in a real browser (`solidAt` false, door open,
   console clean).
2. **The camera cropped the vault on portrait phones.** `frameCamera` biased
   zoom toward `max(fitW, fitH)`; on a portrait phone viewing a landscape room
   `fitH` is far looser, so it zoomed ~40% past the fitting scale and pushed the
   left/right walls off screen — at 390x844 the right-hand column and the
   extraction pad were **not visible at all**. Now zooms toward the *no-margin*
   tight fit, which eats margin but can never crop the room. Verified by
   screenshot before/after. Desktop framing essentially unchanged
   (scale 1.143 → 1.135 at 1440x900).
3. Added `PV.Render.setInsets()` / `PV.Render.viewport()` so `ui.js` can declare
   the CSS px its permanent chrome covers and the room is framed into what is
   left. The light-buffer transform now routes through the same helper (it
   duplicated the centring maths and would otherwise have slid off the scene).
4. Film-grain `CanvasPattern` was rebuilt every frame; now cached.
5. `jest` was collecting the shared harness as an empty suite — scoped
   `testMatch` to `*.test.js`.

### Measured baseline (honest)

| viewport | boots | phase reached | console | h-scroll |
|---|---|---|---|---|
| 320x568, 390x844, 844x390, 768x1024, 1440x900 | yes | `playing` | clean* | none |
| 3840x2160 | yes | `playing` | clean* | none (screenshot needs a raised timeout — very slow to rasterise) |

\* the only console error is `googletagmanager` blocked by the sandbox proxy —
the arcade's analytics, present on every game page, not a game defect. Note it
*does* mean the game is not actually offline-clean per SPEC §0; the tag is in
`index.html`, matching the other arcade games. Left as-is deliberately.

Gameplay driven headlessly: movement, `PV.Game.rewind()`, echo spawn and
`echoesLeft` decrement all behave. Console clean through a rewind.

**Rewind accounting verified**: exactly one echo spawned and one `echoesLeft`
consumed per rewind, `loopIndex` +1 each time, capped correctly at `echoesMax`.
(An earlier reading suggesting +2 per rewind was a sampling artifact — the
snapshot was taken mid-transition, before the rewind had settled.)

**End-to-end vault clear verified** (this had never been exercised): driving
vault 1 with a BFS autopilot that respects `PV.solidAt`, the player picks up the
crown, banks it at the exit, and the vault clears — `phase: 'clear'`,
`runScore: 2360`, clean console. Banking is automatic on `exit.contains(player)`,
no action press needed. Note the leaderboard is **not** called on vault clear;
`submitScore` only fires on run-over, which is correct but means the leaderboard
path itself is still unexercised end-to-end.

### PERFORMANCE — the biggest open question, do not skip

Measured at 1440x900, dpr 1: **~11 fps**, `Render.draw` ≈ 66 ms/frame, with the
*emptiest* scene in the game (0 sentries, 0 devices, 1 relic). CPU profile:
**68.5% of all samples are in `drawImage`**; game logic is free.

Ablation at 1440x900: all-on 11 → grain off 13 → bloom off 14 → both off 16 fps.
Cost tracks pixel count (16 → 21 → 29 fps at render scale 1 / 0.75 / 0.5), i.e.
the pipeline is fill-rate bound: several full-screen composites with `multiply` /
`screen` / `lighter` / `overlay`, plus bloom (bright-pass + 8 offset draws) and a
full-screen grain pass.

**Caveat, and it is a big one:** this runner has no GPU, so Chromium software-
rasterises. A control workload in the *same* browser (fullscreen fill + 400
transformed sprites) held **58 fps**, so the harness is not the bottleneck and
the game genuinely does far more raster work than that control — but a real
GPU-composited canvas may well absorb it. **No claim is made here that the game
does or does not hit 60fps on real hardware. That check is still outstanding and
should be the next run's first job**, on a machine with GPU acceleration.

`PV.Textures.bakeMs` is **370–450 ms** on a fast desktop. SPEC §4 budgets
"< ~400ms on a phone". Already at/over budget before a phone's slower CPU.

### Sub-agents this run

`agent-ui` (`ui.js` + `game.css`) and `agent-textures` (`textures.js`) were
briefed with confirmed defects and the mandatory critic loop (fetch real
screenshots of a named shipped AAA game, side-by-side, "which looks better and
why"). Their outcomes are recorded in the section below as they land.

Confirmed defects handed to them:
* **agent-ui** — at 390x844 and 320x568 the "REWIND" label and echo pips collide
  with the loop-timer ring in the top bar. Also to wire `PV.Render.setInsets`.
* **agent-textures** — `prop.column` reads as a flat grey plastic cylinder (most
  prominent prop in the opening room); floors read muddy and low-contrast;
  `prop.plant` is a green scribble. Hard constraint: **must not increase
  `bakeMs`**.

### Still below the AAA bar / next run should tackle first

1. **Confirm framerate on real GPU hardware.** Everything above is
   software-rasterised. Until this is done, the 60fps line in SPEC §9 is
   unverified — do not let anyone declare the game shipped on the strength of
   this run's numbers.
2. `bakeMs` is over the phone budget.
3. Portrait phones still show a lot of dead space: a 16x12 room in a 9:19.5
   viewport is inherently small even now that it is no longer cropped. Worth
   considering portrait-aware framing or taller vault layouts.
4. The remaining disciplines have had no critic pass at all this run:
   `particles.js`, `audio.js`, and the renderer's own actor/prop art
   (`render.js`). The player figure reads as a small indistinct blob at 1440x900.
5. Nothing has been play-tested for *difficulty* or puzzle quality — the
   solvability test proves a path exists, not that a vault is interesting.

**No discipline has yet passed a blind side-by-side critic comparison, so this
game is nowhere near ready to ship.** Do not add it to the root `index.html`.
