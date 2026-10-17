# SHIFTMAW — Module Contract

A maze-chase arcade game for the Bot Built Arcade, in the lineage of classic dot-eating maze games (original IP, original maze).
Plain ES5 **classic scripts** on one global, `window.SM` (no modules — must run from `file://`). All art and audio are procedural.

## Concept
You are the **Maw**, a lantern moth eating **glowmotes** in a haunted conservatory while four **Hollows** (Brume, Wick, Murk, Dawdle) hunt you
with distinct personalities (chaser, ambusher, flanker, shy).
**The twist — Phase Flip.** Walls come in three kinds: permanent `#`, **Day** walls `A` (solid only in phase 0) and **Dusk** walls `B`
(solid only in phase 1). Spending one Flip charge swaps phase instantly. Any Hollow standing in a wall that becomes solid is **pinched**
(devoured for 400/800/1600/3200, chaining within one flip). Flips also reroute every chase, open escape lines and seal corridors.
The player may never flip into a wall (flip is refused). Charge: starts at 1 per level, +1 per 50 motes, +1 per Dusk bloom (max 3);
unspent charge converts to 500 each when the maze is cleared. Dusk blooms also frighten all Hollows (200/400/800/1600).
Score is a single number submitted to the leaderboard (`gameId = shiftmaw`).

## Files and owners
| File | Owns | Owner |
|---|---|---|
| `index.html` | DOM shell, script order | lead |
| `assets/css/game.css` | HUD, overlays, touch controls | agent-ui |
| `assets/js/core.js` | namespace, storage, keyboard + swipe input | lead |
| `assets/js/levels.js` | maze definitions, parsing, `solid()`, BFS, validation | lead |
| `assets/js/sim.js` | all rules: movement, AI, flip, scoring, levels (pure, headless) | lead |
| `assets/js/audio.js` | procedural SFX and music bed | agent-audio |
| `assets/js/render.js` | canvas renderer, sprites, particles, VFX | agent-render |
| `assets/js/ui.js` | HUD/overlay/touch-control DOM | agent-ui |
| `assets/js/game.js` | state machine, main loop, event routing, leaderboard | lead |

Load order: `core → levels → sim → audio → render → ui → game`. Never edit a file you do not own; report needed changes to the lead.
`sim.js` and `levels.js` must stay DOM-free (they are required by Jest). Sim emits events (`mote`, `bloom`, `flip`, `pinch`, `die`, …) into
`state.events`; the shell drains them for audio/VFX.

## Why Shiftmaw is distinct from every existing arcade game
| Existing game | Why Shiftmaw differs |
|---|---|
| Ironwake | 3D third-person mech demolition; Shiftmaw is a tile-based 2D maze chase. |
| Stormhook | Physics grapple-swing platformer; Shiftmaw has grid movement and pathing AI. |
| Zephyr Circuit | 3D kart racing; no racing here. |
| Paradox Vault | Time-loop stealth with replayed echoes; Shiftmaw has no loops or stealth — it is real-time pursuit where the *map* is the weapon. |
| Prism Warden | Light-puzzle adventure with items and regions; Shiftmaw is a single-screen score chase. |
| Emberfall Gauntlet | Arena survival with free movement; Shiftmaw is corridor-bound. |
| Core Crisis / Nova Striker | Shooters; Shiftmaw has no projectiles. |
| Bastion Builder / Aurora Tower Defense | Strategy and defense; Shiftmaw has no building or waves. |
| Neon Brick Breaker | Paddle/ball; no overlap in verb or space. |
| Lumen Pinnacle, Bayou Brawlers, Crimson Descent, Midnight Menagerie | Pinball / brawler / lander / deck-builder: none are maze chases. |
