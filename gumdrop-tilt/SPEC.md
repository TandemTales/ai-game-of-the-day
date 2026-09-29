# GUMDROP TILT — Module Contract

A chain-reaction falling-gumdrop puzzler (Puyo Puyo / Puzzle Fighter lineage, original IP) for the Bot Built Arcade,
with one twist: **the jar tilts**. Classic non-module scripts on one global (`GT`); runs from `file://`; all art procedural.

## Core loop
6x12 jar. Pairs (pivot + satellite) fall; four or more orthogonally touching gumdrops of one colour pop; gumdrops above
fall and may pop again (chain). Chain, group-size and colour-count bonuses follow the Puyo scoring shape. Every 8 locked pieces
the jar **tilts**: two pieces before, a warning arrow shows the lean direction; on tilt each row slides toward that wall, the stack
re-settles, and any pops it causes are worth double. Clearing the jar pays +3000. Stack into the spawn lane to lose.

## Files and owners
| File | Owner | Role |
|---|---|---|
| assets/js/logic.js | lead | deterministic rules, no DOM, unit-tested |
| assets/js/audio.js | agent-audio | procedural Web Audio SFX (global `GTA`) |
| assets/js/render.js | agent-render | gumdrop sprites, jar, tilt animation, particles (global `GTR`) |
| assets/js/main.js | lead | input (keys, touch, swipe), loop, HUD, leaderboard |
| assets/css/game.css | agent-ui | layout, HUD, overlays, touch pad |
| index.html | lead | shell |

## Distinctness from existing arcade games
- Ironwake: 3D mech combat - none. Stormhook: grapple platformer. Zephyr Circuit: kart racer. Paradox Vault: top-down time-loop heist.
- Bayou Brawlers: side-scrolling brawler. Crimson Descent: lander. Emberfall Gauntlet / Core Crisis / Nova Striker: action shooters.
- Bastion Builder / Aurora TD: strategy/tower defence. Neon Brick Breaker / Lumen Pinnacle: paddle and pinball. Ocean Explorer / Memory Match: casual.
Gumdrop Tilt is the arcade's only falling-block chain puzzler, and the tilt mechanic (lateral slosh with 2x cascades) is its own hook.
