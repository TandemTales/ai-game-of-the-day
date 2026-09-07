# ORBIT ORCHARD — Module Contract

Orbit Orchard is a one-screen top-down score attack about steering a solar seed
through a derelict orbital greenhouse. Smaller relics are absorbed into the
seed, increasing its radius and the strength of its local gravity lens. Same-
color relics chain into constellation links; gravity wells are the risk route
that costs time and score. The current first-delivery prototype ends when one three-relic contract is
delivered to the central nursery or the 65-second orbit decays.

The game runs over HTTP from the repository root with no third-party runtime
fetches. All art is procedural canvas drawing and all sound hooks are local
event cues, so the deterministic logic can be tested without a browser. The
global namespace is `window.OO`.

The simulation stays 960x600 in every orientation. Live portrait phones display
the entire world rotated clockwise in a 600x960 view; keys refer to screen
directions and pointer coordinates use the inverse rotation. Ready/results and
larger screens retain landscape framing. Display scaling preserves proportions
and uses a DPR-aware canvas backing capped at DPR2 and4096 pixels per dimension.
View changes must preserve world state and release held controls.

The roll-and-grow premise is informed by the official description of *Katamari
Damacy REROLL* (ball-rolling and object-collecting) while the greenhouse,
gravity-lens twist, constellation chaining, and score-attack structure are new:

- [Bandai Namco — Katamari Damacy REROLL](https://www.bandainamcoent.com/games/katamari-damacy-reroll)
- [Bandai Namco — Katamari Damacy Rolling LIVE](https://katamaridamacy-rolling-live.bn-ent.net/en/)

## Gameplay redesign — priority over standalone visual polish

Human feedback on September 7: the game is boring and not challenging. Treat
gameplay as failing, not merely unjudged. Milestone one is implemented: choose
safe Mint pods (+1000) or risky Gold diamonds (+2400), collect three matching
shape/color relics, then deliver to the nursery. Five seeded small targets per
route provide spares; unrelated pickups still grant growth. Cargo loss is
recoverable without duplicate score/growth, and wells share 0.9-second grace.
The first delivery ends this prototype, adds eight seconds capped at 65, and
records 1/1 delivered. This is NOT the planned three-contract game below.
Moving hazard schedules, dash and score/replay tuning remain unimplemented.
The human gameplay failure remains unresolved until the acceptance gate passes.

September 7 incentive checkpoint: each absorption adds 24% of relic area to
growth (formerly 82%), with radius capped at 42 (formerly 66). All generated
props remain eventually absorbable. Ordinary gravity reaches 180 world units
(formerly 340), strength caps at 64; authored targets retain their 90-unit lens
and nursery exclusion. Harvest pays 8 + round(2 * relic radius), with a 12-point
same-color link before the existing multiplier. Results separate harvest and
delivery points. These are tested tuning hypotheses, not a gameplay pass:
greedy routes still complete easily, and efficient clean routes do not reliably
outscore detours with incidental harvest. Add planned pressure and limited dash
next; do not mistake further numerical adjustment for the missing route decisions.

### Problem and intended experience

The original slice increased collection reach and speed with rapid growth,
pulled relics from a broad area, and finished only on expiry or field clearance.
The first contract and slower growth now bound that snowball, but hazards still
move only five units around fixed centers. There is still little reason to
change plans, resist easy pickups, or time an action.

Keep the satisfying roll-and-grow core, but make a run about choosing a route,
committing to a harvest, then getting it home under pressure. A player should
have an objective in the first five seconds, face a route decision within ten,
and recognize why a skilled attempt outperforms simply sweeping the arena.
Difficulty must come from readable decisions and execution, not tiny pickups,
unannounced damage, arbitrary speed increases, or extra decorative meters.

### Planned loop and rules

Complete three nursery contracts before the orbit expires. Each contract is a
collect-and-deliver trip within the same visible arena. All numeric values below
are initial tuning hypotheses, not evidence of balanced or enjoyable gameplay.

| System | Planned behavior | Decision it creates |
| --- | --- | --- |
| Harvest contracts | At the nursery, choose one of two visible target families; collect 3, then 4, then 5 matching relics for successive contracts, and return to deposit. Identify families by shape and color. | Choose a safe nearby route or a richer route through danger. |
| Carry and deposit | Matching pickups fill cargo while still growing the seed. Other pickups grant ordinary growth/base score but do not reset cargo or complete the contract. A full cargo requires returning to the nursery. | Keep growing or commit to the delivery while time and exposed cargo are at risk. |
| Escalating routes | Contract one teaches delivery with a slow sweeping hazard; contract two introduces a second crossing route; contract three alternates clearly marked dangerous lanes. | Read safe windows, anticipate intersections, and reroute instead of tracing the same collection circle. |
| Limited dash | A short directional burst with a brief protected interval; start with one charge, earn one per deposit, cap at two. No passive refill. | Spend a charge on a risky pickup route or save it to protect the return trip. |

Contract choices must show target symbol/count and bonus before commitment. The
safer option is selected by default; choosing it must be quick with keyboard or
touch, without a modal interrupting steering. The riskier option uses a marked
cluster beyond a hazard route and awards a larger delivery bonus. Use authored
route templates with seeded variation so risk is designed rather than inferred
from randomly scattered objects. Do not label a route risky unless it is.

Keep the initial 65-second timer. Deposits one and two initially grant eight
seconds, capped at 65 remaining, to reward efficient play without enabling an
endless loop. Deposit three wins the run. Expiry fails the objective but retains
earned score. Clearing loose relics no longer ends the run; replenish the next
contract's designed clusters deterministically. Existing growth persists between
contracts, but higher mass must not trivialize the final route.

A hazard collision initially costs four seconds, one carried target (if any),
and the active score combo, with clear knockback and a shared 0.9-second damage
grace period. Deposited contracts and growth are retained. Replace the existing
flat score deduction with this rule; avoid piling unrelated penalties together.
Lost cargo returns as a recoverable eligible relic at a nearby safe position;
never delete the last available target needed to finish. Provide spare eligible
targets in each route template and test recovery after repeated hits.
An empty-cargo collision still costs time. Hazard warnings last at least one
second; neither spawn nor activate a hazard on the player, inside the nursery,
or across every viable exit. Late-game pressure must leave a navigable opening
at the maximum player radius. Keep a safe deposit area but prevent completing
objectives by camping in it: required harvest clusters are outside its pull range.

Dash uses the current steering direction, falling back to the last nonzero
direction when stationary. Start tuning at 0.3 seconds of burst with protection
only for its first 0.15 seconds; show the protected interval distinctly. Space
dashes during play and retains start/replay behavior outside play. A dedicated
44px-or-larger touch button triggers dash while another finger continues to
steer. Pointer/keyboard parity, simultaneous touch, released keys, and rotated
portrait mapping are required. Display charges and recharge-on-delivery clearly.
Do not add weapons, separate attack controls, or an upgrade tree in this pass.

Scoring keeps ordinary harvest points and existing same-family chains, then adds
an explicitly shown delivery bonus (larger for the risky route). Award a remaining
time bonus only on the third delivery. Score each deposit exactly once. Results
show contracts completed, best chain, hits, and time alongside score so players
can identify a specific improvement for their next attempt. Replay retains the
seed for route learning; an optional New Orchard action selects a new seed.
The numeric leaderboard and rank-before-submit API remain unchanged.

### Implementation order and stop points

1. **Make one contract enjoyable.** Implement visible target choice, cargo,
   nursery deposit, timer reward and objective-based results. Keep current
   controls, with enough accessible small targets to finish from starting mass.
   Run complete keyboard and touch attempts. If delivery feels like chores or
   repeated empty travel, shorten routes and improve choice before adding systems.
2. **Add pressure and an answer to it.** Implement the three-stage hazard schedule,
   warnings, shared hit grace and limited dash. Add one mechanic at a time, then
   play a natural full run. Tune hazard route geometry and dash value together.
   Keep the arena readable at 320x568; solve presentation issues that affect play.
3. **Establish replay value.** Tune safe versus risky choices, score bonuses and
   seeded cluster layouts using repeated full runs. Provide useful result feedback.
   Keep only mechanics that players actually use to make different decisions.
4. **Return to visual/audio polish** once the gameplay acceptance gate below
   passes. Existing AAA visual debts remain; they cannot substitute for this gate.

The lead owns integration and tests; keep single-file ownership below until a
deliberate module split is recorded. Implement in working, tested checkpoints on
dev. This redesign does not restart the game's date or change the release clock.

### Gameplay acceptance gate

Use real playthroughs, not shortened timers, injected cargo, or screenshots as
proof of this gate. Scripted checks support fairness and reproducibility but do
not prove fun. Record seed, device/input, choices, deliveries, hits and outcome.

- A first-time player can explain the target, deposit destination and dash use
  after a short attempt. Required information stays visible on both phone sizes.
- A practiced player can win on keyboard and touch without exploiting hazard
  grace or camping. Each contract has a demonstrably reachable supply of eligible
  targets and a safe timing window for a grown seed.
- Idle and simple circular-sweep baselines cannot complete contracts. A greedy
  nearest-target-and-return baseline should consistently lose to planned routes on
  the same seed; if it wins just as easily, redesign the objective/pressure.
- Play at least three fixed seeds twice on each input method. Compare early and
  practiced attempts; record whether routing and dash timing improve completion
  or score. Treat this as formative tuning, not a statistical difficulty claim.
- An independent gameplay critic plays full runs and tries to reject the claim
  that the game is engaging: are there distinct viable routes, recoverable
  mistakes, useful dash timing, and a reason to replay? Record concrete examples.
  A screenshot comparison cannot pass this criterion. Human feedback that it is
  still boring remains an unresolved gameplay failure regardless of test results.

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
