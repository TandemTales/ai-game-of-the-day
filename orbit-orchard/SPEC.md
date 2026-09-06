# ORBIT ORCHARD — Module Contract

Orbit Orchard is a one-screen top-down score attack about steering a solar seed
through a derelict orbital greenhouse. Smaller relics are absorbed into the
seed, increasing its radius and the strength of its local gravity lens. Same-
color relics chain into constellation links; gravity wells are the risk route
that costs time and score. The run ends when the 65-second orbit decays or the
field is harvested.

The game runs over HTTP from the repository root with no third-party runtime
fetches. All art is procedural canvas drawing and all sound hooks are local
event cues, so the deterministic logic can be tested without a browser. The
global namespace is `window.OO`.

The roll-and-grow premise is informed by the official description of *Katamari
Damacy REROLL* (ball-rolling and object-collecting) while the greenhouse,
gravity-lens twist, constellation chaining, and score-attack structure are new:

- [Bandai Namco — Katamari Damacy REROLL](https://www.bandainamcoent.com/games/katamari-damacy-reroll)
- [Bandai Namco — Katamari Damacy Rolling LIVE](https://katamaridamacy-rolling-live.bn-ent.net/en/)

## Module ownership

This scaffold is intentionally small so the playable contract is testable
before visual polish begins. The lead integrates across files and is the only
person who runs Git.

| File | Owner | Responsibility |
| --- | --- | --- |
| `index.html` | lead | Accessible shell, HUD, overlay, touch canvas, leaderboard form, script order |
| `assets/css/game.css` | agent-ui | Responsive layout, greenhouse frame, HUD, overlays, mobile behavior |
| `assets/js/game.js` | agent-physics | `OO` state, deterministic field, steering, gravity, absorption, hazards, score, canvas renderer, input wiring, leaderboard |
| `SPEC.md` | lead | Concept, boundaries, ownership, distinctness contract |
| `TESTING.md` | lead | Headless checks, browser smoke, viewport sweep, manual controls |
| `PROGRESS.md` | lead | Handoff, verified behavior, critic verdicts, remaining debt |
| `__tests__/orbit-orchard.test.js` | lead | Deterministic mechanics and contract tests |

## Distinctness contract

Orbit Orchard must remain clearly different from every game currently in the
catalog, including older hidden entries:

| Existing game | Existing core loop | Why Orbit Orchard is distinct |
| --- | --- | --- |
| Stormhook | Grapple-swing momentum traversal | No tether, platforming, or level traversal; steer-and-absorb in one arena |
| Zephyr Circuit | 3D kart racing, drifting, items | No race, laps, opponents, or vehicle handling; growth changes the field |
| Paradox Vault | Time-loop stealth puzzle | No stealth, rewind, rooms, or echoes; real-time route risk and score chains |
| Bayou Brawlers | Side-scrolling melee combat | No attacks, enemies, combos, or scrolling beat-em-up stages |
| Aurora Tower Defense | Build towers to stop waves | No placement, base defense, or enemy waves; the player is the moving collector |
| Neon Brick Breaker | Paddle-and-ball brick destruction | No paddle, ricocheting ball, bricks, or power-up volley |
| Nova Striker / Core Crisis | Arena or twin-stick shooting | No weapons or shooting; relics are absorbed by size and proximity |
| Bastion Builder | Draft and upgrade an auto-battler base | No construction, drafting, or persistent base; mass is earned live in the field |
| Crimson Descent | Lander descent and touchdown | No thruster landing, vertical descent, or fuel-management verb |
| Emberfall Gauntlet / Midnight Menagerie | Wave-based arcade action | No combat waves or survival arena; the objective is harvesting a spatial ecology |
| Lumen Pinnacle | Pinball flippers and target banking | No flippers, ball physics, or table targets; steering and gravity are continuous |
| Ocean Explorer | Exploration | No discovery tour or collection checklist; every pickup directly changes physics and score |
| Memory Match | Pair-memory puzzle | No turn-based reveals or matching grid; movement and risk are continuous |

The twist is the gravity lens: growing is not only a score multiplier. A larger
seed visibly bends nearby relic trajectories, opening a choice between safe
small harvests and dangerous routes toward gravity wells.
