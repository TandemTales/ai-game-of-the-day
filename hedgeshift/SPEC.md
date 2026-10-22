# Hedgeshift — module contract

## Concept

Pac-Man-style maze chase with new IP. A firefly eats dewdrops in a moonlit hedge
maze while four shadow wisps (Stalker, Ambusher, Mirror, Drifter) hunt it. Moon
lanterns scare wisps. **Twist:** the maze has two wall layers, Day and Dusk.
Every 14s (shortening each level to 8s) the hedge shifts, telegraphed for 2s by
an orange warning on cells about to close. Wisps caught in a closing wall are
"crushed" (+500) and respawn; the player is nudged to the nearest open cell
(combo reset). Clear all dewdrops to advance; wisps speed up each level.
Scripts are classic, load from `file://`, share `window.HG`, art is procedural.

## File ownership for polish nights

| File | Owner | Contract |
| --- | --- | --- |
| `index.html` | lead | DOM shell and script order |
| `assets/css/game.css` | UI owner | Responsive shell, HUD, menus, touch d-pad |
| `assets/js/logic.js` | lead | Deterministic map, movement, AI, shifts, scoring |
| `assets/js/audio.js` | audio owner | Procedural Web Audio cues, keyed by logic events |
| `assets/js/render.js` | visual owner | Canvas hedges, firefly, wisps, particles, telegraphing |
| `assets/js/game.js` | lead | Input (keys/swipe/d-pad), lifecycle, leaderboard |

`HG.Logic.create(seed, level)` returns state; `step(state, dt)` advances in fixed
1/60 ticks; `setWant(state, dir)` queues a direction (0 up,1 left,2 down,3 right);
`drainEvents` yields `dew, lantern, eatWisp, shift, crush, squeeze, death, clear, over`.
Same seed + inputs ⇒ same run. Both layers are verified fully connected by tests.

## Distinctness against every existing arcade game

| Existing game | Why Hedgeshift differs |
| --- | --- |
| Aurora Tower Defense / Bastion Builder / Core Crisis | No building or defending; pure pellet-routing under pursuit. |
| Bayou Brawlers / Emberfall Gauntlet | No combat or weapons; the player is unarmed and evades. |
| Crimson Descent | No physics lander or fuel. |
| Ironwake | No 3D mech or destruction. |
| Lumen Pinnacle / Neon Brick Breaker | No ball physics. |
| Midnight Menagerie | No cards or turns. |
| Nova Striker | No shooting. |
| Paradox Vault / Prism Warden | No stealth, loops, or light puzzles; moving walls are a shared-layout hazard, not a puzzle. |
| Pulse Loom | No rhythm timing. |
| Stormhook | No grapple platforming. |
| Zephyr Circuit | No racing. |

Maze-chase inspiration: the arcade classic Pac-Man (Namco). Characters, art,
audio and the shifting-hedge twist are original.
