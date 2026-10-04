# CINDERWICK — Fuse Foundry (Module Contract)

A grid-arena bomber in the Super Bomberman lineage (new IP, new twist) for the Bot Built Arcade.
Classic non-module scripts on one global, `window.CW`; runs from `file://`; all art and audio procedural.

## Concept
You are a foundry worker clearing collapsing forge floors of crates and ember critters. Place bombs,
blow crates for power-ups, find the hidden exit hatch, kill every critter, step on the hatch.

**Twist — the Fuse Cord.** Each bomb you place after the first is joined to the previous bomb by a
cord laid along the exact route you walked between the two placements (max 18 tiles, loops cut out).
Only the newest ("tail") bomb ticks (3.0 s). Earlier linked bombs are dormant. When any bomb
detonates, a spark runs down its cords (11 tiles/s) and ignites the neighbours, so the whole
chain goes off in sequence. `LIGHT` shortens the tail fuse to 0.25 s. Each explosion in a chain raises a
multiplier that applies to crate (10), critter (100) points, so you route cords and critters
to maximise chain length while standing somewhere safe.

Score = points x chain multiplier + 500 floor clear + 5/s remaining time + 250/life.
Leaderboard gameId `cinderwick`, higher is better.

## Files and owners
| File | Owner |
|---|---|
| `index.html`, `assets/css/game.css` | lead |
| `assets/js/core.js` namespace, constants, RNG | lead |
| `assets/js/sim.js` rules, levels, critters, chains (pure, no DOM) | lead |
| `assets/js/game.js` input, loop, HUD, menus, leaderboard | lead |
| `assets/js/render.js` canvas renderer + VFX (`CW.Render`) | agent-render |
| `assets/js/audio.js` Web Audio SFX + music (`CW.Audio`) | agent-audio |

Interfaces: `CW.Sim.newGame/step/placeBomb/strike/nextLevel`; `CW.Render.init/reset/update/fx/draw`;
`CW.Audio.init/sfx/music/setMuted/isMuted/setTension`. Sim emits `g.events` consumed by game.js and fanned to audio+render.

## Distinctness from every existing arcade game
- **Ironwake** (3D mech demolition): third-person 3D destruction vs. fixed-grid 2D tactical bombing.
- **Stormhook** (grapple platformer): momentum swinging vs. tile-lane positioning and timing.
- **Zephyr Circuit** (kart racing): racing vs. puzzle-arena clearing.
- **Paradox Vault** (time-loop stealth puzzle): rewind echoes vs. an explosive route-laying chain puzzle.
- **Lumen Pinnacle** (pinball): physics table vs. discrete grid.
- **Bayou Brawlers** (beat-em-up): melee scrolling vs. no direct attack at all; the bomb is the only verb.
- **Crimson Descent** (lander): thrust control vs. grid movement.
- **Midnight Menagerie** (deck-builder): cards vs. real-time action.
- **Emberfall Gauntlet** (arena survival) and **Core Crisis** (core defence): free-aim shooters vs. a maze of crates where terrain is created and destroyed by you.
- **Nova Striker** (space shooter), **Neon Brick Breaker** (paddle), **Bastion Builder**, **Aurora Tower Defense**: none combine a grid maze, destructible terrain and path-dependent chain reactions.
- **Prism Warden** (Zelda-like): adventure/exploration vs. compact score-attack arenas.
