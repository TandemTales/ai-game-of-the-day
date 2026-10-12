# SHIFTWICK - Module Contract

A maze-chase (Pac-Man lineage, original IP) for the Bot Built Arcade. Plain classic scripts, one
namespace each (`window.SW` logic, `SWRender`, `SWAudio`), runs from `file://`; all art and audio
procedural; only network calls are the two leaderboard fetches in `main.js`.

## Concept
You are a flame sprite in a haunted lantern-works. Eat every glow-mote while four shadow Hollows
hunt you; ember pellets let you scorch them. **Twist: the maze slides.** Every 9-17 s (faster on
later levels) a teal band telegraphs a row or column for ~2.6 s, then that line rotates one tile with
wraparound, carrying walls, motes, fruit, you and any Hollows on it. Shifts are validated so the
maze stays fully connected. Reading the warning, baiting Hollows onto a sliding line and escaping
along it is the skill ceiling.

## File ownership
| File | Owner | Role |
|---|---|---|
| `assets/js/logic.js` | lead | Pure deterministic rules: generator, movement, Hollow AI, shifts, scoring (tested headless) |
| `assets/js/render.js` | agent-render | Canvas drawing, VFX particles, HUD, shift telegraph/slide animation |
| `assets/js/audio.js` | agent-audio | Web Audio SFX + drone |
| `assets/js/main.js` | lead | Loop, input (keys, swipe, d-pad), overlays, leaderboard |
| `assets/css/game.css` | agent-ui | DOM chrome: overlays, buttons, d-pad |
| `index.html` | lead | Shell |

## Rules summary
Mote 10, ember 50, Hollow chain 200/400/800/1600, fruit 100-5000, clear 500 (+1000 if never hit),
extra life at 10000. Hollow personalities: Gloam chases directly, Murk ambushes 4 tiles ahead,
Dusk flanks using Gloam's position, Fret chases only from afar and flees when near.

## Why this is distinct from every existing arcade game
- Ironwake: 3D mech demolition. Shiftwick is a 2D tile maze with no combat verbs beyond eating.
- Stormhook: grapple-momentum platformer; no maze, no pursuers with AI targeting.
- Zephyr Circuit: kart racing.
- Paradox Vault: time-loop stealth puzzle; Shiftwick is real-time pursuit with a shifting grid.
- Prism Warden: top-down action-adventure with light puzzles.
- Emberfall Gauntlet / Core Crisis / Nova Striker: shooters and arena survival; Shiftwick has no shooting.
- Bastion Builder / Aurora Tower Defense: strategy/defense; Shiftwick is twitch routing.
- Neon Brick Breaker / Lumen Pinnacle: paddle and pinball physics; Shiftwick is a grid chase.
- Bayou Brawlers, Crimson Descent, Midnight Menagerie: brawler, lander, deck-builder.
