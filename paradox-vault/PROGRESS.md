# Paradox Vault — Progress Log

Newest entry at the top. This file is the handoff between nightly runs.

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
