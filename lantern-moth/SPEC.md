# Lantern Moth - module contract

## Concept

Classic maze chase (Pac-Man lineage, wholly original theme and art). A moth glides
through a 17x15 night-hedge maze eating firefly seeds while four spiders hunt it.
Four lanterns scare the spiders for a few seconds so they can be eaten for chained
points (200/400/800/1600). **Twist - living gates:** thorn gates in two groups (A, B)
swing on an 8 s beat, A open while B shut and vice versa. A shut gate blocks entry for
moth and spiders alike; every swing is telegraphed 1.6 s ahead by flicker, a toast and
a tick sound. Clear all seeds to advance a "night" (faster spiders, shorter lantern).
Score = seeds 10, lantern 50, spiders chained, level bonus, extra life every 10,000.
Scripts are classic, share `window.LM`, run from `file://`; all art is procedural canvas.

## File ownership for polish nights

| File | Owner | Contract |
| --- | --- | --- |
| `index.html` | lead | DOM shell and script order |
| `assets/css/game.css` | UI owner | Responsive shell, HUD, d-pad, panels |
| `assets/js/logic.js` | lead | Deterministic maze, movement, spider AI, gates, scoring |
| `assets/js/audio.js` | audio owner | Procedural WebAudio sfx and drone |
| `assets/js/render.js` | visual owner | Canvas hedges, moth, spiders, lighting, particles |
| `assets/js/game.js` | lead | Input (keys, swipe, d-pad), loop, leaderboard |

`LM.Logic.step(run, dt)` is fixed-step and deterministic (seeded RNG); it pushes events
(`seed lantern eat death gate warn clear life over`) consumed by render/audio.
Spider personalities: Stalker chases, Weaver aims 4 ahead, Shade flanks via Stalker, Drifter
chases when far and retreats when near; all scatter to corners in periodic breaks.

## Distinctness against every existing arcade game

| Existing game | Why Lantern Moth differs |
| --- | --- |
| Aurora Tower Defense | No building or waves; you are the avatar in a maze. |
| Bastion Builder | No drafting or formations. |
| Bayou Brawlers | No combat or health bars. |
| Core Crisis | No shooting or base defense. |
| Crimson Descent | No lander physics. |
| Emberfall Gauntlet | No arena combat. |
| Ironwake | No 3D mech demolition. |
| Lumen Pinnacle | No pinball. |
| Midnight Menagerie | No cards or dungeon crawling. |
| Neon Brick Breaker | No paddle or bricks. |
| Nova Striker | No free-flying shooter. |
| Paradox Vault | No time loops or stealth planning. |
| Prism Warden | No exploration or light puzzles. |
| Pulse Loom | No rhythm timing; routing and risk drive score. |
| Stormhook | No grapple platforming. |
| Zephyr Circuit | No racing. |

Reference lineage: the 1980 arcade maze-chase genre. Theme, names, maze, gates and art are original.
