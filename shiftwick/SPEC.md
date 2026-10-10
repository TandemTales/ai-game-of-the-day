# SHIFTWICK — Module Contract

A maze-chase for the Bot Built Arcade (Pac-Man lineage, original IP). You are a living candle-flame eating embers
while four Shades hunt you. **Twist:** the maze is a sliding labyrinth. Spend a Shift charge to slide the entire row or
column you stand in one tile (interior wraps), reshaping every path, carrying embers and any Shade in that line with
it, and dazing those Shades so they can be snuffed for points. Classic non-module scripts on global `SW`; all art
procedural; runs from `file://`.

| File | Owner | Role |
|---|---|---|
| `assets/js/logic.js` | lead | pure simulation: maze gen, shift, actors, scoring (headless-testable) |
| `assets/js/render.js` | agent-render | canvas renderer, lighting, slide animation, particles |
| `assets/js/audio.js` | agent-audio | procedural Web Audio |
| `assets/js/game.js` | lead | input, loop, HUD, overlays, leaderboard (`/api/leaderboard/rank` + `/submit`, gameId `shiftwick`) |
| `assets/css/game.css` | agent-ui | HUD / menu / touch styling |
| `index.html` | lead | shell |

Rules: sim is fixed-step 120 Hz and deterministic for a given seed; actors always stand on open tiles after a shift;
every generated maze is fully connected; border ring is never shifted.

## Distinctness from existing arcade games
- Ironwake (3D mech demolition), Stormhook (grapple platformer), Zephyr Circuit (kart racing), Paradox Vault (time-loop
  stealth), Lumen Pinnacle (pinball), Bayou Brawlers (beat-em-up), Crimson Descent (lander), Midnight Menagerie
  (deck-builder), Emberfall Gauntlet (arena survival), Core Crisis (core-defense shooter), Nova Striker (vertical
  shooter), Bastion Builder / Aurora Tower Defense (strategy), Neon Brick Breaker (paddle), Prism Warden (light-puzzle
  adventure): none is a grid maze-chase, and none lets the player mutate the level topology mid-run as its core verb.
