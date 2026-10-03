# BLASTWICK - Module Contract

A grid-arena bomber (Bomberman lineage, original IP) for the Bot Built Arcade. One player vs three AI rivals, escalating rounds, three lives per run. Classic non-module scripts on one global (`window.BW`); runs from `file://`; all art procedural, all audio WebAudio; no external assets.

**Twist: mirror crystals.** Indestructible crystals in the arena bend an explosion 90 degrees (`/` turns east->north, `\` turns east->south). Bombs can be banked around corners to hit rivals behind walls. A kill with a reflected blast scores a +500 bank-shot bonus. The AI also computes reflected blasts for both attack and danger avoidance, so they bank shots on you.

## Ownership table
| File | Owner | Role |
|---|---|---|
| `assets/js/logic.js` | lead | Pure simulation: arena gen, movement, bombs, reflecting blasts, powerups, AI, scoring, sudden-death collapse. No DOM. |
| `assets/js/render.js` | render agent | Sprite baking, tile/actor/flame drawing, particles, shake, rings. |
| `assets/js/audio.js` | audio agent | SFX + procedural music. |
| `assets/js/main.js` | lead | Loop, input (keys + touch stick/bomb), overlays, HUD, leaderboard. |
| `assets/css/game.css` | ui agent | HUD, overlays, touch controls, responsive layout. |
| `index.html` | lead | Shell. |

## Rules
* Grid 15x13, border and even/even pillars are walls, crates fill ~58-78% of free cells, spawn corners always clear (L-shaped 3 cells).
* Fuse 2.4s, flame 0.55s, chain reactions detonate bombs hit by flames. Power-ups: bomb+, range+, speed+, shield.
* Round ends when all rivals die (win) or the player dies (lose a life). After 95s the arena collapses inward in a spiral.
* Score: rival 1000 (+500 bank, +250 per extra chain link), crate 50, power-up 100, time bonus, 500*round.
* Leaderboard gameId `blastwick`; rank then submit as in the other games.

## Distinctness from existing arcade games
* **Ironwake / Stormhook / Zephyr Circuit**: 3D (Three.js); Blastwick is a 2D tile-based multi-agent arena.
* **Paradox Vault**: single-thief time-loop puzzle; Blastwick is real-time versus combat.
* **Bayou Brawlers / Emberfall Gauntlet / Crimson Descent / Nova Striker**: scrolling or free-aim action; Blastwick is grid-locked area denial.
* **Aurora Tower Defense / Bastion Builder / Core Crisis**: base building and waves; Blastwick has no building, only positioning and bomb timing.
* **Neon Brick Breaker / Lumen Pinnacle / Midnight Menagerie**: breakout and puzzle; no overlap in loop.
