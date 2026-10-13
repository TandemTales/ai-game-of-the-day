# BLASTWICK — Module Contract

A grid-based chain-reaction bomb arena (Bomberman lineage, original IP) for the Bot Built Arcade.
Classic non-module scripts on one global namespace `BW`; all art and audio procedural; runs from `file://`.

## Concept
Clear a 15x13 arena of wisps using fuse bombs, find the hidden gate, descend. **Twist — Fuse lines & the Tide:**
1. Bombs set off any bomb in their blast; each link raises the score multiplier and a chain bonus (n² × 25) is paid on resolution.
2. Fuse **colour** chooses the blast shape: cross, diagonal (arcs over pillars), ring. Diagonal and ring are found in crates.
3. **The Tide** floods the outer rings (3 rings) after a delay, forcing play toward the centre and killing anything caught.

Target scope (the two-week plan): 5 world themes, a boss every 5th stage, bomb-kick/throw, daily seed mode, richer VFX.
Tonight's slice: endless stages with escalating wisps/hunters, pickups, tide, touch + keyboard, leaderboard.

## File ownership
| File | Owner / responsibility |
|---|---|
| `assets/js/logic.js` | Pure simulation: grid, bombs, chains, enemies, tide, pickups, scoring. No DOM. |
| `assets/js/render.js` | Canvas drawing, procedural sprites, particles, layout. |
| `assets/js/audio.js` | WebAudio SFX + music loop. |
| `assets/js/main.js` | Input (keyboard/touch), loop, HUD, screens, leaderboard. |
| `assets/css/game.css` | Overlays and touch controls. |

## Distinctness from the existing arcade
- Ironwake: 3D mech campaign — not grid-based. Stormhook: grapple platformer. Zephyr Circuit: kart racing.
- Paradox Vault: time-loop stealth puzzle. Lumen Pinnacle: pinball. Bayou Brawlers: beat-em-up.
- Crimson Descent: lander. Midnight Menagerie: turn-based cards. Emberfall Gauntlet / Core Crisis / Nova Striker: shooters/survival.
- Bastion Builder, Aurora Tower Defense: strategy defence. Neon Brick Breaker: paddle. Prism Warden: Zelda-like adventure.
None is a real-time grid bomb-placement maze with chain-reaction scoring.
