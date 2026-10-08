# Pulse Loom — module contract

## Concept

Four-lane rhythm score attack. The player taps directly or uses D/F/J/K when
notes cross the judgment line. Every 32 beats (eight bars at four beats each),
the loom rotates one lane clockwise. The rotation is previewed for three beats.
One authored 128-beat chart, deterministic judgment, procedural Web Audio, a
numeric score, and a complete replay loop define the scaffold. Gameplay art is
drawn with Canvas/CSS over one locally bundled scenic WebP; no remote assets or
fonts are fetched. Scripts are classic, load from `file://`, and share `window.PL`.

## File ownership for polish nights

| File | Owner | Contract |
| --- | --- | --- |
| `index.html` | lead | DOM shell and script order |
| `assets/css/game.css` | UI owner | Responsive shell, HUD and menus |
| `assets/js/logic.js` | lead | Deterministic chart, timing, scoring |
| `assets/js/audio.js` | audio owner | Procedural beat and judgment sounds |
| `assets/js/render.js` | visual owner | Canvas world, notes and lane cues |
| `assets/js/game.js` | lead | Input, lifecycle and leaderboard |

`PL.Logic.chart()` returns ordered `{beat,time,base,lane,status}` notes. `tap`
judges within ±180 ms; ≤75 ms is perfect. `advance` marks misses after the
window. The same chart reappears on replay. Score is summed judgment points
times a capped combo multiplier. `PL.Game` owns DOM input and the two
leaderboard calls: rank GET, then top-20 submit POST.

## Distinctness against every existing arcade game

| Existing game | Why Pulse Loom differs |
| --- | --- |
| Aurora Tower Defense | No tower placement or waves; timing notes drives the run. |
| Bastion Builder | No tactical formations or defender drafting. |
| Bayou Brawlers | No fighting or enemy health. |
| Core Crisis | No shooting or base defense. |
| Crimson Descent | No dungeon combat or traversal. |
| Emberfall Gauntlet | No arena combat or style swaps. |
| Ironwake | No mech piloting or campaign missions. |
| Lumen Pinnacle | No traversal puzzle or ascent. |
| Midnight Menagerie | No creature management or collection loop. |
| Neon Brick Breaker | No paddle, ball, or destructible bricks. |
| Nova Striker | No shoot-em-up movement or projectiles. |
| Paradox Vault | No time-loop heist or echo planning. |
| Prism Warden | No exploration, combat, or sunlight puzzles. |
| Stormhook | No grappling physics or platform traversal. |
| Zephyr Circuit | No vehicle steering or racing line. |

The rhythm category is inspired by the timing clarity of Nintendo's Rhythm
Heaven and console note games. The rotating lane mapping, light-loom theme,
chart, music, and art are original. This is a scaffold, not AAA acceptance.
