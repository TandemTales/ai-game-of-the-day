# Gloam Run — module contract

## Concept

Classic maze-chase arcade game in the lineage of the dot-chase greats, with original IP and a
new mechanic. Wick, a firefly, gathers every glow mote in a moonlit hedge maze while four Shades
hunt. Lanterns (power seeds) frighten the Shades so they can be chased off for chain points.
**Twist: Turnstile Gates.** Violet moonstone switches rotate every gate in the maze 90 degrees:
corridors that were open seal, sealed ones open. Shades re-route live, so a switch press can
trap hunters behind a gate or lock Wick out of safety. Moonstones sit in one-tile nooks beside
lanterns, so reaching one is a risk. Grid-based, deterministic movement, four distinct Shade
targeting rules, scatter/chase waves, bonus blooms, level ramp. Procedural art and Web Audio only;
classic scripts on `window.GR`, runs from `file://`.

## File ownership for polish nights

| File | Owner | Contract |
| --- | --- | --- |
| `index.html` | lead | DOM shell and script order |
| `assets/css/game.css` | UI owner | Responsive shell, HUD, d-pad, menus |
| `assets/js/logic.js` | lead | Deterministic maze, gates, Shade AI, scoring |
| `assets/js/audio.js` | audio owner | Procedural SFX, heartbeat proximity cue |
| `assets/js/render.js` | visual owner | Canvas hedges, actors, VFX |
| `assets/js/game.js` | lead | Input, lifecycle, leaderboard |

`GR.Logic.advance(run, dt)` is fixed-rule and deterministic given seed and inputs. `steer(run, dir)`
buffers a direction (0 up, 1 left, 2 down, 3 right). Run events (`mote`, `lantern`, `eat`, `gates`,
`die`, `bloom`, `clear`) are drained by the renderer; game.js reads them first for audio. Score:
mote 10, lantern 50, Shades 200/400/800/1600 chain, moonstone 25, bloom 500 x level, clear 1000 x level.

## Distinctness against every existing arcade game

| Existing game | Why Gloam Run differs |
| --- | --- |
| Aurora Tower Defense | No tower placement; you are the unit moving through a maze. |
| Bastion Builder | No drafting or auto-battles. |
| Bayou Brawlers | No melee combat. |
| Core Crisis | No shooting or base defense. |
| Crimson Descent | No thrust physics or landing. |
| Emberfall Gauntlet | No arena combat; you cannot hurt Shades except through lanterns. |
| Ironwake | No 3D mech demolition. |
| Lumen Pinnacle | No pinball physics. |
| Midnight Menagerie | No cards or creature collecting. |
| Neon Brick Breaker | No ball or paddle. |
| Nova Striker | No shooting. |
| Paradox Vault | Real-time pursuit, not time-loop planning. |
| Prism Warden | No exploration or items; one maze screen. |
| Pulse Loom | Spatial chase, not rhythm. |
| Stormhook | No grapple or platforming. |
| Zephyr Circuit | No vehicles. |

Inspired by the dot-chase maze genre (Pac-Man and its descendants). Maze layout, characters,
names, and the gate mechanic are original.
