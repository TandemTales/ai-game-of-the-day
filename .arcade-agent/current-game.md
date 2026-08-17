# Active game

**Slug:** `cinderglass/`
**Title:** Cinderglass
**started: 2026-08-16** (Pacific)
**Forced release Saturday: 2026-08-22** (Pacific)

## Pitch

Cinderglass is a **falling-sand thermodynamics puzzle**. Every pixel of the world
is a simulated grain of matter with a temperature, and your *only* tool is heat:
one brush that pours warmth in, one that pulls it out. You never dig, never
place blocks, never move anything directly. You melt a stone wall into lava so it
drains away, freeze a waterfall into an ice bridge, boil a cistern into steam that
rises through a vent and condenses on the ceiling as rain, or bake a dune into a
sheet of glass to seal a leak. Shape is a *consequence* of temperature — that is
the whole game.

Each contract gives you a foundry chamber and a quota: deliver N units of a
target material (glass, obsidian, steel, pure water) into the crucible before
the shift bell. Materials transform through real phase changes and reactions
(sand + heat → glass, lava + water → obsidian + steam, ice → water → steam →
cloud → rain), so the solution is always a chain of state changes you set up and
then watch run. Score is quota × purity × time bonus, minus fuel burnt — a single
number for the leaderboard.

## Why it is distinct

Core verb is **"change the temperature of matter"**. No existing arcade game has
a simulation/sandbox-puzzle genre, a cellular-automata world, or a verb that
isn't some form of shoot / hit / place / bounce / steer / draft. Full game-by-game
justification lives in `cinderglass/SPEC.md`.

## Quality references for critics

The bar for the blind side-by-side comparisons is **Noita** (pixel-sim fidelity,
emissive lighting, material readability), **Sandspiel** (material palette and
particle legibility), and **Opus Magnum / Baba Is You** (UI, typography, and
puzzle-game presentation polish). "Good for a browser game" is a failed critique.

## Next run

Read `cinderglass/PROGRESS.md` first, then `cinderglass/SPEC.md` (authoritative,
including the file-ownership table), then `cinderglass/TESTING.md`.

Work happens on the `dev` branch. Never `main`, except for the STEP 4 promotion.
