# Bayou Brawlers

Bayou Brawlers is a from-scratch, browser-native side-scrolling brawler vertical slice built around two locally supplied swamp images. The goal is to prove responsive movement, readable combat contact, distinct enemy pressure, a short encounter arc, and one boss before any system is expanded into a full game.

This workspace did **not** include an earlier runnable game or source tree. The new slice now has focused runtime measurements, regression checks, and independent criticism, while unproven quality gates remain explicitly open. See the [baseline ledger](docs/BASELINE.md) and [30-category benchmark matrix](docs/BENCHMARK_MATRIX.md).

## Quick start

Requirements: Node.js 18 or newer and a modern desktop browser.

On Windows, `PLAY_BAYOU.cmd` starts the local server and opens the game. The equivalent terminal command is:

```powershell
npm start
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). Keep the terminal open while playing. The project is served as native browser modules; opening `index.html` directly is not the supported run path.

To use another port:

```powershell
npm start -- 4180
```

The server binds only to `127.0.0.1`. It does not publish the game or expose it to the local network.

## Automated tests

```powershell
npm test
```

The command uses Node’s built-in test runner. Passing source-level tests are a regression signal, not a substitute for playing the running build. Combat alignment, input feel, audiovisual timing, camera behavior, crowded readability, browser performance, settings persistence, and restart flow still need their corresponding live checks.

The latest recorded run on 23 August 2026 passed **16/16** focused checks. The suite covers input-buffer retention/expiry, facing/reach/lane and radial contact, armor outcomes, seeded randomness, light-attack activation, single-transition and complete four-hit buffered chaining, enemy-role contracts, the complete test-room registry, enemy/boss construction contracts, renderer-prime identity isolation, debug-to-campaign state reset, pause/resume input hygiene, and score-safe encounter restart checkpoints. Re-run it after every accepted change; the count and result may evolve with the project.

## Controls

### Keyboard

| Action | Default |
|---|---|
| Move through the lane | `WASD` or arrow keys |
| Light attack / continue light combo | `J` |
| Heavy attack / launcher | `K` |
| Focus special | `L` |
| Jump / aerial attack setup | `I` or `Space` |
| Dodge; hold while moving to sprint | Left or right `Shift` |
| Grab; light pummels, heavy or grab throws | `E` |
| Pause / resume request | `Escape` or `Enter` |
| Toggle debug overlay | `F1` |
| Previous / next test room | `[` / `]` while debug is active |

Light attacks form a chain. A heavy input after the middle light hits branches into the launcher. Use a light or heavy attack in the air for Cypress Drop. The special consumes focus; successful attacks restore focus. Sprint into light for the dash attack. Dodge direction follows the last meaningful movement direction.

### Standard gamepad

The browser’s first standard-mapped gamepad is used.

| Action | Standard mapping |
|---|---|
| Move | Left stick |
| Jump | South face button / button 0 |
| Dodge / sprint | East face button / button 1 |
| Light attack | West face button / button 2 |
| Heavy attack | North face button / button 3 |
| Grab | Left shoulder / button 4 |
| Special | Right shoulder / button 5 |
| Pause | Menu / button 9 |

Controller labels, vibration support, reconnect behavior, simultaneous keyboard/controller use, and device parity depend on the browser and hardware and must be tested. Touch and multiplayer controller assignment are not implemented.

## Debug overlay and combat-test rooms

Start directly in a room with debug enabled:

```text
http://127.0.0.1:4173/index.html?debug=1&room=stationary
```

The query contract is:

```text
index.html?debug=1&room=<id>
```

- `debug=1` bypasses the title flow, turns on the overlay, and starts a test room.
- `room=<id>` selects one of the exact IDs below.
- If `debug=1` is present without a valid room, the stationary room is used.
- `F1` toggles the overlay during play.
- `[` and `]` cycle rooms while debug is active.

| Room ID | Purpose |
|---|---|
| `stationary` | Stationary target for reach, timing, reaction, damage, and input-buffer checks |
| `weak-melee` | Basic melee approach, telegraph, punish, and defeat flow |
| `aggressive` | Fast committed pressure and dodge/recovery checks |
| `ranged` | Keep-away behavior, projectile warning, and offscreen rules |
| `armored` | Armor feedback, interruption resistance, and armor-break behavior |
| `opposite` | Two-sided pressure, facing, target selection, and attacker limits |
| `mixed` | Combined melee, rush, range, and armor role readability |
| `surrounded` | Wakeup, dodge, crowd-control escape, and fairness |
| `crowd` | Large-group readability, AI coordination, and effects load |
| `hazard` | Environmental warning, collision, and enemy/player interaction |
| `grab-throw` | Acquisition, pummel, throw, release, and crowd interaction |
| `aerial` | Launcher, aerial follow-up, landing, and height-tolerance behavior |
| `boundary` | World clamp, knockback, wall-adjacent contact, and camera framing |
| `elite` | Armored elite pressure and encounter escalation |
| `boss` | Captain Mire telegraph, pattern, phase, vulnerability, and recovery lab |
| `stress` | Worst-case crowd, AI, projectile, effect, audio, and frame-pacing load |

The text overlay reports the current test room, simulation frame, fixed-step target, current/max sampled frame time, player state and animation frame, position/height, buffered inputs, invulnerability, combo count/damage, last-hit damage/knockback, active-attacker count, and up to seven enemy name/state summaries. Debug canvas drawings add collision bounds and state/health labels; the input manager retains a short frame-tagged recent-event log for instrumentation. Verify debug values against the visible result; debug output is evidence only when it agrees with the actual interaction.

Debug is off during the normal title-screen flow. Do not ship a production build with test-room query access or debug UI enabled without an explicit release gate.

## Settings, accessibility, and local state

The settings screen currently exposes:

- Master, music, and effects volume categories.
- Screen-shake amount.
- Hit-flash on/off.
- Reduced motion.
- High-contrast outlines.
- Hold-to-sprint preference; when disabled, sustained movement transitions to automatic sprint.
- Incoming-damage and player-damage assists.
- Keyboard remapping for light, heavy, special, jump, dodge/sprint, and grab.
- Story, Brawler, and Hard Boiled difficulty presets in the start flow.

Settings and remapped keys are stored locally in the browser under `bayou-brawlers-settings-v1`. “Restore Defaults” writes the current defaults and restores default action bindings. Malformed JSON falls back to defaults on load; type/range validation and future-schema migration still need explicit coverage.

There is no campaign-progression save, cloud save, account, telemetry, or network service. Before calling persistence complete, test clean start, modify, reload, browser reopen, reset, malformed data, and future-version compatibility. The hold-to-sprint preference and all other settings must also be confirmed in the running interaction; visibility in the menu alone is not proof that every code path honors it.

## Current vertical slice

- Playable character: Roux, a close-range bayou brawler with a four-hit light chain, launcher, aerial drop, dash attack, grab/pummel/throw, dodge/wakeup, and focus-powered radial special.
- Normal roster: Bog Deckhand (`grunt`), Marsh Skirmisher (`rusher`), Bayou Slinger (`ranger`), Levee Breaker (`brute`), and Cypress Training Dummy (`dummy`).
- Boss: Captain Mire (`captainMire`), with cleave, charge, volley, and slam pattern families and phase escalation.
- World interactions: breakable props, pickups, environmental hazards, and projectiles.
- Experience shell: title, how-to, difficulty, settings/accessibility, pause, restart, results, replay, progress dashboard, and a short swamp run.
- Audio: procedural Web Audio music and effects with no downloaded sound library.
- Scope: single player. Multiplayer and full-campaign progression are not implemented or quality-gate approved.

Every timing and balance value is provisional until the relevant live test and critic review. Do not use source constants as evidence that the interaction matches a commercial reference.

## Project map

```text
index.html                    Game shell and menus
styles.css                   Game/UI presentation
progress.html                Development progress ledger
progress.css                 Progress-page presentation
progress.js                  Ten-system evidence/status data and filters
src/main.js                  Browser boot, menu flow, settings, persistence, loop
src/game.js                  Integration, encounters, combat resolution, camera, HUD, debug rooms
src/player.js                Roux movement, combat states, procedural drawing
src/enemies.js               Enemy roster, boss, projectiles, AI, drawing
src/world.js                 Props, hazards, pickups, effects
src/input.js                 Keyboard/gamepad mapping, buffering, input log
src/audio.js                 Procedural Web Audio music and event effects
src/core.js                  Fixed-step constants and pure combat/math helpers
src/config.js                View/world/settings/difficulty/test-room configuration
scripts/serve.mjs            Local no-store static server
PLAY_BAYOU.cmd               Windows one-step local launcher
tests/                       Focused automated regression tests
docs/BASELINE.md             Provenance, architecture, baseline plan, evidence gaps
docs/BENCHMARK_MATRIX.md     Thirty-category comparison and test matrix
```

## Development evidence workflow

1. Reproduce one observable problem in the running build.
2. Preserve a recording, frame trace, input log, screenshot, test result, or performance sample.
3. Make the smallest coherent change that tests one proposed cause.
4. Run `npm test`.
5. Replay the relevant test room and adjacent systems.
6. Compare performance and local settings/state before and after.
7. Give the build—not the builder summary—to a fresh critic.
8. Record the critic’s verdict and the single biggest remaining gap on [the progress page](progress.html).

The allowed progress statuses are exact: **Not Audited**, **Baseline Recorded**, **In Development**, **Awaiting Critic Review**, **Needs Revision**, **Retesting**, **Vertical Slice Approved**, **Applied to Full Game**, **Regression Found**, and **Quality Gate Passed**. Code completion alone does not advance a quality gate.

## Assets and dependencies

The project uses no external CDN, web font, image, music, sound-effect, game-engine, or runtime-package dependency. The only image assets are the two supplied local files:

- `BB_bg_swamp001.png`
- `BB_bg_swamp001_barrier.png`

Characters, enemies, UI elements, effects, and debug visuals are drawn in project code. Music and sound effects are synthesized at runtime with Web Audio. The reference games are quality benchmarks only; their characters, artwork, animation, interface, audio, exact mechanics, and numerical values are not included.

## Known limits before the first quality-gate pass

- A running browser baseline and independent critic passes are recorded, but the complete campaign and independent approval of the second boss-readability revision remain open.
- No reference-game frame measurements have been collected.
- Automated tests cannot establish perceived feel or browser audiovisual behavior.
- Full controller/browser coverage, performance profiling, soak testing, and restart timing remain pending.
- Settings behavior and accessibility coverage require direct end-to-end verification.
- Multiplayer, additional characters, full progression, save migration, credits, and a complete campaign are outside the current proof slice.
- The progress dashboard deliberately shows zero passed quality gates until evidence exists.
