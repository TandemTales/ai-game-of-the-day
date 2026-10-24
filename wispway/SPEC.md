# Wispway — module contract

## Concept

A maze chase in the classic arcade tradition, with original IP. You are a wisp
gathering every ember in a haunted hall while four Gloams hunt you, each with
a different pursuit rule. Power embers frighten the Gloams so they can be eaten
(200/400/800/1600 chain). Twists:

1. **Shifting lantern gates.** Amber (`a`) and cyan (`b`) gates swap open/closed
   every 16 s, with a 3 s flashing warning. A gate never closes on an occupied
   tile (it waits). The maze is authored so every ember is reachable in both
   phases (tested).
2. **Flare.** Every 25 embers earns a Flare charge (max 2). Flare stuns Gloams
   within 3.4 tiles for 2.4 s; stunned Gloams are harmless and cannot be eaten.

Score: embers 10, power 50, Gloam chain, lantern fruit, level-clear bonus,
extra life at 10,000. Scripts are classic, share `window.WW`, work from `file://`,
all art is procedural canvas. Leaderboard: rank GET then top-20 submit POST.

## File ownership for polish nights

| File | Owner | Contract |
| --- | --- | --- |
| `index.html` | lead | DOM shell and script order |
| `assets/css/game.css` | UI owner | Responsive shell, HUD, panels, controls |
| `assets/js/logic.js` | lead | Deterministic maze, AI, gates, flare, scoring |
| `assets/js/audio.js` | audio owner | Procedural Web Audio cues and drone |
| `assets/js/render.js` | visual owner | Canvas maze, actors, VFX |
| `assets/js/game.js` | lead | Input (keys/swipe/buttons), loop, leaderboard |

`WW.Logic.step(state, dt)` is fixed-step (1/60) and deterministic for a seed;
it emits `state.events` which `game.js` drains to audio and VFX.

## Gloam behaviours

Cinder targets the wisp; Mire targets four tiles ahead; Hush mirrors Cinder
around a point two tiles ahead; Dusk chases until within six tiles, then flees
to its corner. Scatter/chase cycles shorten with level. Gloams leave the house
on staggered timers; eaten Gloams return as eyes via BFS.

## Distinctness against every existing arcade game

| Existing game | Why Wispway differs |
| --- | --- |
| Aurora Tower Defense | No building or waves; you are the unit moving through a maze. |
| Bastion Builder | No formations or drafting. |
| Bayou Brawlers | No melee combat or scrolling. |
| Core Crisis | No turret or base defense. |
| Crimson Descent | Grid maze, not thrust-and-land physics. |
| Emberfall Gauntlet | No arena weapons or style swaps; evasion and routing only. |
| Ironwake | 2D tile maze, not 3D mech demolition. |
| Lumen Pinnacle | No pinball physics. |
| Midnight Menagerie | Real-time, no cards or turns. |
| Neon Brick Breaker | No paddle or ball. |
| Nova Striker | No shooting or free flight. |
| Paradox Vault | Real-time pursuit, no time-loop planning. |
| Prism Warden | No exploration, light puzzles or combat. |
| Pulse Loom | Spatial routing, not rhythm timing. |
| Stormhook | Grid movement, no grapple physics. |
| Zephyr Circuit | No vehicles or racing. |

Genre reference: classic arcade maze chase (Pac-Man, Namco). No Namco IP,
names, sprites, maze layout or audio is used.
