# Fuseworks - module contract

## Concept

A top-down grid bomber in the classic arena-bomber tradition, with original characters and setting. You are a
fuse-tech scrapping rival bots in a clockwork foundry. Drop bombs to crack crates, collect blast/bomb/speed
upgrades, and clear each floor of bots. **Twist: prism tiles.** Glass prisms (`/` and `\`) sit on junctions and bend a
blast ray ninety degrees, spending range as it goes, so every bomb is a routing puzzle and chains wrap corners.
Score: kills (100/250/500), multi-kill and chain bonuses, crates, pickups, floor-clear and time/lives bonuses.
Endless escalating floors, 3 lives, 150 s per floor. Classic scripts on `window.FW`, procedural art/audio, no fetches.

## File ownership for polish nights

| File | Owner | Contract |
| --- | --- | --- |
| `index.html` | lead | DOM shell and script order |
| `assets/css/game.css` | UI owner | Responsive shell, HUD, touch controls |
| `assets/js/logic.js` | lead | Deterministic grid, blast/prism rules, bot AI, scoring |
| `assets/js/audio.js` | audio owner | Procedural SFX and looping music |
| `assets/js/render.js` | visual owner | Canvas tiles, actors, flames, particles |
| `assets/js/game.js` | lead | Input, lifecycle, leaderboard |

`FW.Logic.computeBlast(grid,x,y,range)` returns cells, crates, bend points and ray segments. `update(state,dt)` is
pure with respect to the DOM and emits `state.events` for audio/VFX. Leaderboard: rank GET then top-20 POST (`gameId=fuseworks`).

## Distinctness against every existing arcade game

| Existing game | Why Fuseworks differs |
| --- | --- |
| Aurora Tower Defense | No waves of paths or tower placement; positional bombing on a shared grid. |
| Bastion Builder | No formations or drafting. |
| Bayou Brawlers | No melee brawling; area denial by fuse timing. |
| Core Crisis | Not a base-defense shooter. |
| Crimson Descent | Single-screen grid, no dungeon traversal. |
| Emberfall Gauntlet | No real-time melee arena. |
| Ironwake | 2D tile puzzle-action, not 3D mech demolition. |
| Lumen Pinnacle | No climbing or light puzzle. |
| Midnight Menagerie | No creature collection. |
| Neon Brick Breaker | Bombs destroy crates but there is no ball or paddle. |
| Nova Striker | Grid movement, no projectiles or scrolling. |
| Paradox Vault | No time loops. |
| Prism Warden | Prisms reflect blasts, not sunlight puzzles; no exploration. |
| Pulse Loom | Not rhythm. |
| Stormhook | No grappling platforming. |
| Zephyr Circuit | No racing. |
