# Cinderglass — build log

## 2026-08-16 (Sun) — scaffold night 1

**Outcome: a playable vertical slice, verified in a real browser.** Menu →
briefing → pour → cleared → next contract works end to end. Five contracts,
each proven finishable by a recorded solve the test suite replays. 60
Cinderglass tests, 188 across the arcade, all green.

### What Cinderglass is

A falling-sand thermodynamics puzzle. The world is a `128 × 88` grid where
every cell has a material and a temperature. The player has exactly two
tools — a torch that pours heat in and a quench that pulls it out — and
nothing else. You never dig, place, drag or spawn. Shape is a *consequence*
of temperature: melt a plug and it drains, freeze a pool and it becomes
floor, bake a bed of sand and it runs and sets as glass.

See `SPEC.md` for the module contract, the material table and the
game-by-game argument for why this is distinct from everything else on the
site. Short version: no other arcade game is a simulation, and no other
one has a verb that isn't some form of shoot / hit / place / bounce /
steer / draft.

### Built tonight

| file | state |
|---|---|
| `SPEC.md` | complete, and kept in sync with what was actually built |
| `assets/js/core.js` | engine, brush input model for touch/mouse/keyboard |
| `assets/js/materials.js` | 19 materials as data, with phase changes + reactions |
| `assets/js/sim.js` | the four-pass cellular automaton — the heart |
| `assets/js/levels.js` | 5 contracts + reference solves |
| `assets/js/render.js` | baked colour ramps, emissive bloom, the heat field |
| `assets/js/game.js` | state machine, scoring, save/continue, leaderboard |
| `assets/js/ui.js` | HUD, screens, touch dock |
| `assets/css/game.css` | full shell, responsive to 320px |
| `assets/js/particles.js` | **working floor only** — for agent-particles |
| `assets/js/audio.js` | **working floor only** — for agent-audio |
| `tools/screenshot.js` | ported from paradox-vault |
| `TESTING.md` | complete |

### Five things the simulation had wrong, and how they were found

Every one of these was found by running the thing, not by reading it. They
are recorded because each is a trap the next change could fall back into.

1. **Air needed a real density.** Gas buoyancy is measured against air; with
   air at density zero, nothing could rise. Air is 0.20 now, and every gas
   is lighter than that while every powder and liquid is heavier.
2. **Fire has to stay with its fuel.** Flame modelled purely as a rising gas
   leaves the oil the tick it forms, so a pool lit at one end never caught
   along its length. Burning fuel is now its own liquid state (`BLAZE`) that
   stays put and radiates into its neighbours.
3. **A pool of liquid checkerboarded instead of levelling.** Fluids picking a
   fresh lateral direction every tick oscillate in place. They now carry a
   persistent direction and only reverse when blocked.
4. **Molten iron re-solidified in mid-air.** It sheds heat faster than
   anything else and had an 80-degree liquid window, so a pour could never
   reach a crucible. The window is 250 degrees now.
5. **The crucible silently clogged.** It only ingested matter that *moved*
   into it, so a pour that set before it landed became a static solid in the
   basin that could never move again. It now takes whatever touches it.

### Two things the level design had wrong

1. **Powders and liquids barely travel sideways.** The first draft's chambers
   moved material horizontally across a floor and were flatly unsolvable.
   Every chamber is vertical now — which is also how a real foundry is laid
   out, so this cost nothing.
2. **Lava cannot melt iron.** Lava forms a little over 1200° and cools from
   there; iron melts at 1500°. The original "Bloomery" premise — pour lava on
   the ingot — was thermodynamically impossible. The contract was rewritten
   so the torch does the work and the stone slab overhead is a *hazard*.

This is exactly what the reference solves exist to catch. If a tuning change
breaks one, the chamber got harder than it looks.

### Verified in a browser

Headless Chromium, all six required viewports (320x568, 390x844, 844x390,
768x1024, 1440x900, 3840x2160): **61fps everywhere, no horizontal scroll, no
console errors of our own.** A full contract was played from the menu through
the pour to the cleared screen. Screenshots were read, not just captured —
three of the fixes above came out of looking at them.

The only console error and the only external request are the Google tag
failing through the sandbox proxy, which matches every other game on the site.

## Where it is below the AAA bar

Honest list. **No critic loop has been run yet** — no discipline has a
blind side-by-side verdict against a shipped reference, because tonight was
scaffolding and there was nothing worth comparing until the last hour.

1. **Portrait wastes two thirds of the screen.** This is the single biggest
   visual problem and should be the next run's first job. The grid is
   `128 × 88` — a landscape shape — letterboxed into a 0.46-aspect phone, so
   the chamber occupies a band across the middle and the rest is black. Every
   chamber is a vertical shaft anyway, so the fix is a **portrait-shaped
   grid** (something near `88 × 128`). That means re-authoring all five
   chambers' coordinates *and* their reference solves, which is why it was
   not attempted at the end of a long night rather than because it is hard.
2. **particles.js and audio.js are floors, not art.** Sparks are flat discs;
   the audio is one filtered noise bed and three blips. Both need their
   owning agent and a critic loop.
3. **No textures.** Materials are a colour ramp plus per-cell value noise.
   Noita and Sandspiel both carry far more surface detail. The buttress
   reliefs are flat black holes rather than recessed masonry.
4. **The level ladder is verified, not playtested.** Each contract is proven
   *finishable*; none is proven *fun*. Cold Store in particular is a slow
   chamber where the interesting decision (kill the heat source first) is
   easy to miss, and Glassworks is close to a single long brush stroke.
5. **No tutorial beyond a hint string.** The premise — you are heat, and
   nothing moves because you moved it — is unusual enough to need teaching
   on screen, not in a toast.
6. **Only 5 contracts.** A shift is short. The material table already
   supports steel and combustion chambers that no contract uses.
7. **No screen-shake, no impact feedback, no transitions** between contracts.

## What the next run should do first

1. **Move to a portrait-shaped grid** and re-author the five chambers and
   their solves. Everything visual is downstream of this — there is no point
   polishing textures that are being viewed at a third of the size they
   should be. Do this before spawning any art agent.
2. Then fan out per `SPEC.md`'s ownership table: agent-render, agent-particles,
   agent-audio, agent-ui, each against a harsh blind-comparison critic.
   References worth naming: **Noita** and **Sandspiel** for pixel-sim fidelity
   and material legibility, **Opus Magnum** and **Baba Is You** for puzzle-game
   UI and typography.
3. Write contracts 6–8 using the combustion and steel materials that already
   exist and are unused.

Forced release Saturday is **2026-08-22**.
