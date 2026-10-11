# WICKFIRE — Module Contract

A grid-arena blaster in the lineage of Super Bomberman / Dyna Blaster, built on new IP with one
rule change: **there are no bomb timers**. Classic scripts on one global `window.WK` (runs from `file://`).
All art and audio are procedural; the only network calls are the two leaderboard fetches in `game.js`.

## Concept
You are a foundry blaster clearing sealed ore vaults (15x11 grid, riveted walls, destructible crates).
Walking pays out **wick** behind you (length capped by `wickMax`). **DROP** places a powder keg on your
tile. **LIGHT** detaches the current wick as a fuse and ignites its far end; flame runs toward you at
7 tiles/s, detonating every keg it touches and killing anything standing on burning wick. Blasts also
ignite wick, so chains cascade. Enemies (Sootlings) walk across wick - lure them, step off, light.
Kegs left unlit self-detonate after 14s (failsafe). Clear all enemies, then reach the hatch hidden under a
crate. Endless vaults, escalating enemy count/hunters; score = crates, kills x chain multiplier (+50 for wick
kills), pickups, time/lives clear bonus. Pickups: range, kegs, speed, wick length, life.

## Files and owners
| file | role | owner |
|---|---|---|
| `assets/js/sim.js` | pure simulation: level gen, wick/fuse, charges, blasts, enemies, scoring | lead |
| `assets/js/audio.js` | Web Audio SFX + looping groove | audio agent |
| `assets/js/render.js` | tile atlas, lighting, actors, particles, shake, vignette | render agent |
| `assets/js/game.js` | input (kbd + touch), HUD, menus, loop, leaderboard | lead |
| `assets/css/game.css` | HUD/menu/touch styling | ui agent |
| `index.html` | DOM shell, script order sim→audio→render→game | lead |

Sub-agents edit only their file. `sim.js` must stay DOM-free (loaded in jest `vm`).

## Why it is distinct from every existing arcade game
- **Ironwake** — 3D mech demolition; Wickfire is 2D tile-grid tactics with route-laying.
- **Stormhook** — momentum grapple platformer; no physics traversal here.
- **Zephyr Circuit** — kart racing.
- **Paradox Vault** — time-loop stealth puzzle; Wickfire is real-time and score-chasing, no replay.
- **Lumen Pinnacle** — pinball.  **Neon Brick Breaker** — paddle arcade.
- **Bayou Brawlers** — scrolling brawler; **Emberfall Gauntlet** / **Core Crisis** / **Nova Striker** — free-aim shooters/survival.
- **Bastion Builder / Aurora Tower Defense** — build-and-wait defense; Wickfire has no building phase.
- **Crimson Descent** — precision lander; **Midnight Menagerie** — turn-based deck crawler.
- **Prism Warden** — Zelda-style adventure with light routing. Wickfire's wick also "routes" a resource, but
  in a discrete grid arena with a bomb-chain score loop, not an adventure with equipment and regions.
No existing game is a grid-maze bomber, and none turns the *route you walked* into the weapon.
