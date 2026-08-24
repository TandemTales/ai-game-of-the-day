# Bayou Brawlers — Baseline Ledger

**Baseline date:** 23 August 2026  
**Project stage:** From-scratch browser vertical slice; live validation and fresh criticism underway  
**Primary benchmark:** *Teenage Mutant Ninja Turtles: Shredder’s Revenge*  
**Secondary references:** *Streets of Rage 4* and *River City Girls 2*

## Evidence statement

The supplied workspace initially contained only two environment PNGs. It did not contain a game engine project, source, executable, repository history, automated tests, gameplay recording, save data, or prior performance trace. The code now in this workspace is therefore a new vertical slice built around the supplied art and requested quality criteria. It is not evidence that an earlier game was upgraded.

This ledger separates three evidence classes:

- **Source-observed:** present in the current files and inspectable without running the game.
- **Declared target:** intended behavior or acceptance criteria; it is not proof that the behavior works.
- **Runtime-observed:** captured from the running local browser build with debug state, screenshots, input logs, or measured frame work.
- **Runtime pending:** still requires observation, repetition, a different device, or a fresh critic.

No source-only observation is treated as proof that the game feels responsive, readable, satisfying, stable, or benchmark-competitive. No reference timing has been invented.

## Supplied-material baseline

| Item | Source-observed evidence |
|---|---|
| Environment art | `BB_bg_swamp001.png`, SHA-256 `7F017A3AC7307C29E12DEE3ADA8DCF68310EFD69CDB0C662CE1E23C8E3EE2DC4` |
| Collision/barrier art | `BB_bg_swamp001_barrier.png`, SHA-256 `45F9082B439006E26CD5D150477129073A3E7D6CD4B1BD6C3B6F7F27E06E2E49` |
| Earlier source or executable | Not supplied |
| Earlier gameplay recording or frame data | Not supplied |
| Earlier test, build, save, or performance artifacts | Not supplied |
| Earlier version-control history | Not supplied |

## Current architecture

| Layer | Source-observed implementation | Evidence limitation / next proof |
|---|---|---|
| Runtime | Browser-native JavaScript modules; package version `0.1.0`; Node.js 18+ is used only for local serving and tests. No game engine or third-party runtime framework is declared. | The local Chromium build started without console errors; other browsers remain untested. |
| Build/run | `npm start` runs the local static server in `scripts/serve.mjs`; there is no compilation or asset pipeline. | A successful HTTP response does not prove interactive play. |
| Display | One `1280 × 720` canvas presented in a responsive 16:9 shell. | Scaling, focus, cropping, and readability need multiple viewport checks. |
| Simulation | `FIXED_STEP` is `1 / 60`; the intended simulation target is 60 updates per second. Input-buffer aging now uses active simulation time and pauses during hitstop. | Longer frame-pacing, catch-up, background-tab, and crowded-input measurements remain pending. |
| World | Side-scrolling world length is configured as `6900`; playable lane bounds are configured from `392` to `625`. | Camera, boundaries, navigation, and encounter pacing need a complete run. |
| Input | Keyboard and the first standard browser gamepad; action buffer configured at 150 ms; analog dead zone configured at 0.2; recent inputs carry frame/device tags. | Directional keyboard play and a frame-tagged four-input chain were observed live. Controller parity and edge-state drop rates remain pending. |
| Player | One playable brawler, Roux, with movement, sprint, dodge, jump/aerial, light chain, heavy launcher, dash attack, grab/pummel/throw, focus special, hitstun, knockdown, and wakeup behavior. | Every route, cancel, transition, visual alignment, and exploit case needs live replay. |
| Combat | Lane/height-aware contact helpers, armor outcomes, hitstop values, recoil/knockback/launch data, combo tracking, focus gain/use, effects, camera shake, and optional gamepad vibration. | Tuned values are provisional. Timing, satisfaction, clarity, and fairness are not source-verifiable. |
| Enemy AI | Stationary dummy plus grunt, rusher, ranger, and brute roles; bounded active attackers and inspectable AI state are intended. | Role separation, telegraphs, flanking, offscreen behavior, and pressure require live observation. |
| Boss | Captain Mire with health phases and cleave, charge, volley, and slam pattern families. | Learnability, vulnerability, repetition, health, duration, and failure recovery remain unmeasured. |
| World interactions | Source modules define breakable props, environmental hazards, pickups, projectiles, and visual effects. | Contact clarity, value, pacing, and edge cases need relevant rooms and the stage run. |
| Audio | Procedural Web Audio music and effects with master/music/SFX routing; no external sound assets or libraries. | Browser unlock behavior, balance, impact timing, comfort, and performance need listening tests. |
| UI | Title, difficulty, how-to, settings, pause, restart, results, replay, and development-progress surfaces. | Keyboard/gamepad navigation, focus order, comprehension, and restart time need direct tests. |
| Settings/accessibility | Declared controls include master/music/SFX volume, screen-shake amount, hit-flash toggle, reduced motion, high contrast, hold-to-sprint, damage assist, enemy damage, and difficulty. | Controls must be exercised in play. Full remapping and subtitles are not yet demonstrated. |
| Persistence | Settings and supported keyboard remaps are written to browser `localStorage` under `bayou-brawlers-settings-v1`; malformed JSON falls back to defaults. There is no campaign-progression save. | Test clean start, write, reload, browser reopen, malformed/partial data, reset, and future migration behavior. |
| Automated tests | `npm test` uses Node’s built-in test runner for `tests/*.test.mjs`. The 23 August 2026 regression run passed 16/16 checks covering input buffering, contact geometry, radial range, armor, seeded randomness, light activation, single and complete buffered chaining, roster roles, room registration, enemy/boss constructor contracts, renderer-prime identity isolation, debug-to-campaign reset, pause/resume input hygiene, and encounter checkpoint integrity. | Browser interaction and perceived quality still need separate live checks; this is focused regression coverage, not comprehensive coverage. |
| Test rooms | Sixteen room IDs are declared and the game has debug-room loading/cycling hooks. | Each room must be launched, checked for correct composition, and replayed after adjacent changes. |
| Debug/performance panel | Intended fields include player state, buffered input, animation frame, invulnerability, enemy state/health, active attackers, combo, damage/knockback, frame time, and recent input log. | Values must be verified against actual behavior; long-session memory is not covered by the panel alone. |

## Supported input and controls

### Keyboard

| Action | Default input |
|---|---|
| Move in the lane | `WASD` or arrow keys |
| Light attack / combo | `J` |
| Heavy attack / launcher | `K` |
| Focus special | `L` |
| Jump / aerial action | `I` or `Space` |
| Dodge; hold while moving to sprint | Left or right `Shift` |
| Grab / pummel / throw context | `E` |
| Pause | `Escape` or `Enter` |
| Toggle debug overlay | `F1` |
| Previous / next test room | `[` / `]` while debug is active |

### Standard gamepad

The first browser-visible standard gamepad is targeted. Left stick controls movement. Face and shoulder buttons map to jump, dodge, light, heavy, grab, and special; the menu button pauses. Button-label presentation varies by controller and browser, so the actual mapping and prompts require device testing.

### Currently unsupported or unproven

- Touch input is not declared.
- Multiplayer controller assignment is not implemented or verified.
- Online play is not declared.
- Combat-action keyboard remapping and default restoration were demonstrated live; movement, pause, and gamepad remapping are not implemented.
- Keyboard rollover, simultaneous-input conflicts, focus loss, controller disconnect/reconnect, and multiple-controller behavior are runtime pending.

## Current content inventory

| Requested audit area | Current from-scratch slice | Evidence state |
|---|---|---|
| Playable characters | Roux; one complete-kit target | Source-observed; play identity pending |
| Normal enemies | Dummy, grunt, rusher, ranger, brute | Live role-state smoke checks passed; active-defense criticism pending |
| Bosses | Captain Mire | Live pattern-state smoke check passed; phases and complete fight pending |
| Stages | One swamp/bayou vertical-slice run | Source-observed structure; full pacing pending |
| Encounters | Normal, opposite-side, mixed, surrounded, crowd, elite, boss, and stress scenarios are represented in the lab plan | Composition and pacing pending |
| Hazards and objects | Hazard, breakable-prop, pickup, and projectile systems | Runtime interactions pending |
| Single player | Intended primary slice | Complete run pending |
| Multiplayer | Not currently implemented or verified | Not audited |
| Difficulty | Story, Brawler, Hard Boiled source presets | Balance and fairness pending |
| Scoring/reward | Score/combo result concepts, health/focus, pickups | Accuracy and incentive effects pending |
| Progression/save | Local settings persistence only; no campaign-progression save | Source-observed; reload/migration tests pending |
| Menus/interface | Title through results and replay shell | Title, settings, results, replay/title navigation observed live; end-to-end completion pending |
| Accessibility | Several visual, audio, motion, remap, and assist controls declared | Reduced motion, high contrast, combat-key remap, and reset observed live; full audit pending |
| Audio | Procedural music and event SFX | Live balance/readability pending |

## Required representative baseline session

The first session must be recorded from the running build. “Pending” is intentional; source review cannot satisfy these rows.

| Scenario | Suggested route | Current result |
|---|---|---|
| Basic movement | Normal run plus `?debug=1&room=boundary` | Directional keyboard movement observed; boundary and controller repetitions pending |
| Basic attacks | `?debug=1&room=stationary` | Live light contact recorded; isolated whiff/edge repetitions pending |
| Complete normal combo | `?debug=1&room=stationary&script=combo` | Four inputs at frames 15/24/36/51 produced four hits and 52 damage; repetitions pending |
| Grab or throw | `?debug=1&room=grab-throw&script=grab` | Grab, pummel, and throw produced two hits and 31 damage |
| Aerial action | `?debug=1&room=aerial&script=aerial` | Jump/aerial route produced one hit and 16 damage |
| Special attack | `?debug=1&room=stationary&script=special` | Focus special produced one hit and 26 damage |
| One enemy | `?debug=1&room=weak-melee` | Melee approach/telegraph/attack observed; player recorded a 9-damage hit |
| Several enemies | `?debug=1&room=opposite` | Pending live recording |
| Mixed enemy types | `?debug=1&room=mixed` | Three roles cycled approach/telegraph/attack/recovery; attacker cap held at 2/2; active-defense review pending |
| Complete encounter | Normal run | Pending live recording |
| Boss encounter | `?debug=1&room=boss` plus normal run | Boss approach/pattern/recovery smoke check passed; phases and completion pending |
| Failure and restart | Normal run or boss lab | A fresh critic observed a clean normal-run failure/results/title flow after 2:31. Encounter checkpoint restoration is covered automatically; direct Brawl Again and live kill→restart score verification remain pending. |
| Multiplayer combat | No runnable multiplayer path | Not currently testable |

During the session, record concrete events: frame-tagged inputs; transitions; apparent-alignment misses; hit reaction and recovery; offscreen threats; telegraph failures; encounter start/end and downtime; failure/restart interval; crowded frame time; and any state that disagrees with the debug overlay.

## Reusable combat-test rooms

Launch a room with `index.html?debug=1&room=<id>`. With debug active, use `[` and `]` to cycle.

| ID | Intended case | Primary evidence to collect |
|---|---|---|
| `stationary` | Stationary target | Startup/active/recovery observation, visual reach, hitstop, recoil, damage, buffer consumption |
| `weak-melee` | Weak melee enemy | Approach, telegraph, punish, basic defeat time |
| `aggressive` | Aggressive enemy | Commit, dodge response, pressure, recovery |
| `ranged` | Ranged enemy | Keep-away spacing, projectile warning, offscreen rules |
| `armored` | Interruption-resistant enemy | Armor feedback, break rules, useful counters |
| `opposite` | Enemies from opposite sides | Facing, target choice, bounded attacker pressure |
| `mixed` | Mixed enemy group | Tactical role separation and crowd readability |
| `surrounded` | Surrounded player | Wakeup, dodge, crowd-control escape, fairness |
| `crowd` | Large crowd | Readability, active-attacker cap, effects load |
| `hazard` | Environmental hazard | Warning, collision, enemy/player interaction |
| `grab-throw` | Grab and throw | Acquisition, pummel, release, throw collision |
| `aerial` | Aerial combo | Launch height, follow-up, landing, boundary cases |
| `boundary` | Wall/boundary behavior | Clamp, collision, knockback, camera alignment |
| `elite` | Elite encounter | Armor, combined pressure, encounter escalation |
| `boss` | Boss pattern lab | Telegraph, vulnerability, phase and recovery clarity |
| `stress` | Maximum stress | Frame pacing, input delay, AI/effect/audio spikes, memory trend |

Debug instrumentation must stay disabled by default and remain toggleable/removable for a release build.

## Measurement ledger

| Measurement | Current evidence | Required method |
|---|---|---|
| Input response in frames | Automated light activation is within four fixed frames; live input frames recorded for one full chain | Repeat every transition on keyboard and controller; correlate input and first visible/state response. |
| Attack startup/active/recovery in observed frames | Pending | Capture stationary-lab footage with animation/state frames visible; reconcile against source timing. |
| Combo continuity / dropped inputs | One deterministic browser route completed four hits for 52 damage; complete-chain automated test passed | Repeat each route across early, middle, and late buffer timing; log attempts and failures. |
| Visual alignment versus collision | Pending | Record representative edge-of-range and lane-tolerance hits/misses with debug bounds. |
| Enemy defeat time / encounter duration | Pending | Time repeatable room and full encounter runs at each difficulty. |
| Boss pattern and encounter duration | Pending | Record first-seen and learned attempts; count repetitions and vulnerability windows. |
| Target frame rate | Declared 60 updates/second | Record frame-time distribution under normal, crowd, boss, and stress conditions. |
| Frame pacing | The independent pre-fix pass recorded 3.70/57.85 ms current/MAX at 18 enemies versus 1.80/15.12 ms stationary. After explicit decode plus real-context renderer priming, two direct stress loads sampled 2.00/22.00 ms and 2.10/17.63 ms versus 0.80/19.30 ms stationary, with no console errors. A hidden-actor warmup that regressed stationary MAX to 73 ms was removed. These snapshots are not a distribution. | Capture seeded 60-second p50/p95/p99 distributions and frames over 16.67/33.33 ms under normal, crowd, boss, and stress conditions. |
| Crowded-combat input delay | Pending | Correlate input frames with state response during the stress room. |
| Memory growth | Pending | Use browser performance/memory tooling over repeated rooms and an extended session where supported. |
| Initial load time | Pending | Measure cold and warm local loads on documented hardware/browser. |
| Failure-to-restart time | Pending | Measure from defeat confirmation to regained player control. |
| Settings/save persistence | Reduced motion, high contrast, screen-shake editing, combat-key remap, and default restoration were exercised; reload/reopen and malformed data remain pending | Change each setting, reload, reopen, reset, and inspect malformed/old data handling. |
| Automated test result | 16/16 passed on 23 August 2026 using Node’s built-in runner | Preserve exact output on each accepted change; add focused tests for changed behavior and keep browser/live checks separate. |

## Independent runtime criticism

The fresh-play critic exercised the title, onboarding, settings/accessibility, difficulty selection, a normal Brawler run through failure, stationary and mixed combat rooms, and the boss lab. Menus, hierarchy, accessibility breadth, clean failure handling, and reliable control registration were the strongest observations. The critic’s largest gameplay gap was combat readability without debug text: light whiffs lacked a strong range cue, normal enemy silhouettes relied heavily on color, and Captain Mire’s recovery pose did not clearly advertise a punish window. Light-chain arcs and shape-first enemy accessories were added and await labels-off criticism. A first boss-pose revision failed its focused retest; the second adds solid orange lane geometry/chevrons and a deep weapon-to-floor slump with a green opening ring and stagger sparks, without changing timing or damage. It is captured labels-off locally but still lacks a successful independent pass because the critic’s follow-up browser input timed out.

The stress critic observed the active-attacker cap holding at 2/2 in normal, crowd, hazard, and 18-enemy stress rooms with no console warnings or errors. The same pass found visual congestion near the player and 50–58 ms maximum frame-work spikes on stress loads. Short post-priming retests reduced direct-load maxima to 17.63–22.00 ms, but this is not enough evidence to pass the performance gate; tail distribution, input latency under live pressure, and heap growth remain unresolved.

## Strongest existing foundations to preserve

These are architectural observations, not claims about feel:

- The supplied swamp artwork gives the slice a distinct bayou identity.
- The implementation stays local and dependency-light, reducing build complexity and third-party asset risk.
- Fixed-step simulation, seeded randomness, frame-tagged input logging, bounded attacker intent, and targeted test-room IDs create useful hooks for repeatable testing.
- The single-character vertical-slice scope keeps unproven combat decisions from spreading prematurely.
- Debug-readable state and comfort settings are being designed alongside combat rather than appended at the end.

## Largest current blockers and regression risks

1. **Incomplete live baseline:** core routes, isolated roles, a normal-run failure, and fresh criticism are now observed, but the complete campaign, boundary/wakeup cases, controller, boss completion, and long stress distribution remain open.
2. **Parallel integration risk:** source modules were created from scratch in parallel. Their contracts must be integrated and tested as one product, not judged independently.
3. **Unproven timing:** source constants are provisional and must not be presented as benchmark-equivalent.
4. **Visual/collision drift:** procedural character rendering and mathematical contact can disagree even when each is internally consistent.
5. **Input-state edges:** buffering across hitstun, wakeup, landing, grab, attack recovery, pause, and focus loss can regress easily.
6. **Crowd coupling:** AI limits, camera, effects, audio, collision, and frame pacing can each pass alone but fail together.
7. **Save/settings compatibility:** persistence requires reload, reset, malformed-data, and future-schema protection; source defaults alone are insufficient.
8. **Accessibility completeness:** declared settings need functional checks; remapping, subtitles where necessary, flash reduction breadth, and focus/navigation remain gaps.
9. **Multiplayer:** no multiplayer path exists. It must remain explicitly unverified rather than silently treated as passed.
10. **Content breadth:** one short slice cannot establish full-campaign pacing, progression, character differentiation, or repetition quality.

## Immediate quality-gate sequence

1. Start the local build and confirm title-to-play startup without console errors.
2. Run the automated suite and preserve its exact result.
3. Record the representative baseline session and all sixteen room-entry checks.
4. Establish response, contact, frame-pacing, load, restart, and persistence measurements on documented hardware/browser.
5. Fix only the single largest input/movement problem first; replay and regress before moving to combat contact.
6. Send each accepted change to a fresh critic who plays the build without relying on the builder’s summary.
7. Keep every system below an approval/pass status until its runtime evidence, regression checks, and critic verdict exist.

The companion [benchmark matrix](BENCHMARK_MATRIX.md) defines the full 30-category comparison and test plan without inventing reference measurements.
