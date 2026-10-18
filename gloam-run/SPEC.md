# Gloam Run — module contract

## Concept
Maze chase in the Pac-Man lineage. Collect every ember to clear a maze; four wisps hunt with
distinct AI (chaser, ambusher, flanker, wanderer). Big embers let the lantern flare, turning
wisps frightened so they can be caught for chained points. Twist: **shutter gates** (tiles A and B).
Rune pads flip all shutters; A-gates are open while B-gates are closed, and vice versa. Wisps and
the player are blocked equally. Flips are previewed by a short pulse before they land. Deterministic
logic, procedural art/audio, plain scripts on `window.GR`, runs from `file://`.

## File ownership
| File | Owner | Contract |
| --- | --- | --- |
| `index.html` | lead | DOM shell, script order |
| `assets/css/game.css` | UI owner | Responsive shell, HUD, menus, touch controls |
| `assets/js/logic.js` | lead | Maze, movement, wisp AI, shutters, scoring |
| `assets/js/audio.js` | audio owner | Procedural Web Audio |
| `assets/js/render.js` | art owner | Canvas rendering and VFX |
| `assets/js/game.js` | lead | Input, loop, HUD, leaderboard |

## Distinctness
- Ironwake, Zephyr Circuit, Prism Warden, Stormhook: 3D/side/action-adventure; none is a grid maze.
- Paradox Vault: top-down stealth puzzle with time loops; Gloam Run is real-time pursuit on a grid.
- Midnight Menagerie, Bastion Builder, Aurora TD: turn-based or defense; no direct avatar chase.
- Nova Striker, Core Crisis, Emberfall Gauntlet: shooters/arena; Gloam Run has no shooting.
- Neon Brick Breaker, Lumen Pinnacle: paddle/pinball. Pulse Loom: rhythm. Crimson Descent: lander.
- Bayou Brawlers: beat-em-up. None has maze routing or switchable architecture.
