# LUMEN PINNACLE — Module Contract

Lumen Pinnacle is a one-screen neon pinball table for the Bot Built Arcade.
The player keeps a luminous energy orb in play with two flippers, banks three
prism targets, threads the side lanes, and triggers a short multiball. The
slice is intentionally score-first and replayable: the only progression is
the player's growing command of shot angles, timing, and risk.

The game runs from the repo over HTTP, uses no third-party runtime fetches, and
keeps gameplay on the classic global namespace `window.LP` so the deterministic
logic can be exercised by Jest without a browser. All art is procedural canvas
art and all audio is synthesized with Web Audio.

## Module ownership

Each implementation worker owns exactly one file. The lead integrates across
files, owns the DOM shell and test contract, and is the only person who runs
Git.

| File | Owner | Responsibility |
| --- | --- | --- |
| `index.html` | lead | Accessible shell, HUD, overlay, touch controls, leaderboard form, script order |
| `assets/css/game.css` | agent-ui | Responsive layout, table frame, HUD, buttons, overlays, mobile behavior |
| `assets/js/game.js` | agent-physics | `LP` state, deterministic physics, collisions, scoring, particles, audio cues, canvas renderer, input wiring |
| `SPEC.md` | lead | Concept, boundaries, ownership, distinctness contract |
| `TESTING.md` | lead | Headless checks, browser sweep, manual controls |
| `PROGRESS.md` | lead | Handoff, verified behavior, critic verdicts, remaining debt |
| `__tests__/lumen-pinnacle.test.js` | lead | Deterministic mechanics and contract tests |

## Why this is distinct from every existing arcade game

* **Zephyr Circuit** is a 3D kart racer driven by steering and drifting. Lumen
  Pinnacle is a fixed-table physics game driven by flipper timing and shot
  placement.
* **Paradox Vault** is a top-down time-loop stealth heist. Lumen Pinnacle has
  no rooms, enemies, hiding, or rewind; its core verb is striking a moving orb.
* **Bayou Brawlers: Gearbound** is a side-scrolling beat-em-up. Lumen Pinnacle
  has no avatar traversal or attacks and never scrolls.
* **Aurora Tower Defense** is a placement-and-wave defense strategy game. Lumen
  Pinnacle has no build phase, path, tower, or wave; its targets are physical
  rebound surfaces.
* **Neon Brick Breaker** is a paddle game about returning a ball into a brick
  wall. Lumen Pinnacle uses two independently timed flippers, authored table
  geometry, bumpers, lanes, and a drain; clearing bricks is not the objective.
* **Nova Striker** is a twin-stick arena shooter. Lumen Pinnacle has no aiming,
  projectiles, enemies, or combat; the player shapes one ball's bounce.
* **Bastion Builder** is a base-building and cannon-defense game. Lumen
  Pinnacle has no resource economy or construction decisions.
* **Crimson Descent** is a roguelike descent through rooms. Lumen Pinnacle is a
  single deterministic table with no procedural room traversal or inventory.
* **Core Crisis, Emberfall Gauntlet, and Midnight Menagerie** are arcade-action
  experiences centered on character movement and combat hazards. Lumen
  Pinnacle is a physical toy-table score chase with flippers as the sole direct
  control surface.

The root page contains stale links to `memory-match` and `ocean-explorer`, but
neither directory exists in this checkout; this game also does not use their
names or their implied memory/exploration loops.

## Vertical-slice acceptance

The slice is playable when a player can start from the overlay, launch a ball,
operate both flippers from keyboard, pointer, or touch, hit bumpers and prism
targets, light all three targets to trigger multiball, drain through three
balls, see a final score, and submit that score through the leaderboard form.
