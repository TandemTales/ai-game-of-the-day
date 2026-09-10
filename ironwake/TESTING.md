# Ironwake — testing

## September 9 campaign verification (supersedes demo scope below)

Full suite: **359 tests in 15 suites passed**. Focused Ironwake: 30 tests.
The added campaign suite covers objective sequencing, fixed defender membership,
captures, boost/collision, telegraphed artillery, water/fire, caches, counterattack
waves, boss invulnerability/exposure/phases, upgrades, checkpoint/debrief reload,
final chapter bounds, and lethal hazard ordering.

`node ironwake/tools/campaign-playthrough.cjs` completes all five chapters through
legal deterministic simulation inputs. It uses state-aware pathfinding, with no
teleports, enemy deletion, health refills, altered cooldowns or skipped objectives.
Recorded chapter times: 53.2, 68.7, 67.8, 108.3, 106.3 seconds. This is an informed
automated route, not a prediction of human playtime or proof of enjoyment.

`node ironwake/tools/native-campaign.cjs` uses actual mouse and keyboard events.
Set `IW_NATIVE_CHAPTERS=5` to play the complete campaign. The pilot reads state to
plan, but uses the ordinary UI, input handlers and real simulation clock. The full
browser run completed all five chapters and the rescue, choosing armor/damage/
armor/damage between chapters. Chapter times were 51.8, 70.1, 70.8, 111.7, 86.6
seconds; surviving armor was 191, 281, 199, 236, 235. No browser page errors.
Two earlier narrow-camera harbor attempts died at the final battery. Widening
the camera and leading toward aim made that route readable and successful.
The final train scenery/collision was added after this native run loaded; the
complete simulation route and a fresh browser environment fixture passed afterward.

Six viewport smoke passed at 320x568, 390x844, 844x390, 768x1024, 1440x900,
3840x2160: opening real-input tower crush, movement, native simultaneous touch,
six 44px+ actions, HOT layout, defeat/retry, mocked rank-before-submit, map pause,
upgrade selection and checkpoint reload. A fresh 1440x900 follow-up checked all
biome scenes, saved final campaign totals and the ending's new-campaign action.
No console errors/warnings or external runtime requests. Defeat, chapter win,
environment presentation and ending checks are explicitly state fixtures; they
are separate from the real-input complete campaign run.

Lead inspected actual native combat from the harbor, flooded ward, desert and
fortress, plus fresh biome, mobile upgrade, map, ending and six-size smoke images.
Presentation fixes include a wider campaign camera, an occlusion silhouette,
chapter-specific architecture, matching full-length rubble, a visible armored
train, and flat hazard boundaries (the first thick torus rims were misleading).

Ignored evidence: `node_modules/.cache/ironwake/campaign-final`,
`native-campaign`, and `campaign-simulation.jsonl`. `report.json` in the smoke
directory represents the most recent run/filter; screenshots from all sizes
are retained. All verification commands are tracked and reproducible.

Limits: automated play is state-informed and does not establish human fun,
accessibility on physical devices, or production leaderboard connectivity.
This is a compact complete campaign, not an AAA release. Main remains unchanged.

## Historical one-block prototype evidence

From repository root: `node node_modules/jest/bin/jest.js --runInBand`.
Focused: `node node_modules/jest/bin/jest.js __tests__/ironwake.test.js --runInBand`.
The pure VM suite checks deterministic replay, directed progressive collapse,
crush timing, heat/venting, incoming fire, theft/proximity/exactly-once score,
solid tower/rubble collision, victory/escape/expiry and reset. Unit fixtures are
not natural play or fun evidence.

Run `node ironwake/tools/smoke.cjs` for an HTTP server and headless Chromium.
It closes both afterward. Windows defaults use the installed Playwright at
`C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`
and Chromium at
`C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe`.
Override with IW_PLAYWRIGHT and IW_CHROME elsewhere. Browser launch may need
approved execution outside the sandbox. No browser download is required here.

IW_VIEWPORTS can narrow debugging, for example `390x844,1440x900`; default checks
320x568,390x844,844x390,768x1024,1440x900,3840x2160. IW_SHOTS overrides output
(default ignored node_modules/.cache/ironwake/smoke). Read the PNGs; 4K may be
downsampled by the viewer. Check shader/WebGL warnings as well as page errors.

Smoke uses real input for deployment, opening aimed punch/tank crush, keyboard
movement and simultaneous native touch stick+fire/release. HOT and expiry are
explicit state fixtures for HUD wrapping, results, retry and mocked rank/submit;
they do NOT prove a naturally completed mission. Input taps are buffered across
frames so quick keyboard/pointer actions are not dropped.

## Normal-input first mission

Start on seed7. Aim through the first tower toward the road and punch. The
first tank should be crushed as the tower reaches it, not at the start of its
fall. Turn to the nearby escort, punch it disabled, approach and rip its gun.
Flank the fallen tower to the west and cross to the north side of the road.
Use the heavy gun against remaining tanks; vent between bursts. Standing south
of the fallen tower and firing through rubble should be blocked and explain
that a flank is needed. Destroyed structures stay cover, not perpetual kill zones.

Record real keyboard and native touch full runs with normal100-second clock:
HP, heat, theft, direct/collapse kills, outcome and elapsed game/wall time. No
injected position/HP/cargo/timer for gameplay evidence. Renderer.project(x,z)
supports read-only targeting in browser harnesses. Native touch must combine
stick steering with aim and actions. Test input cancellation/blur/retry.

Independent critic should contrast naive direct fire with deliberate demolition
and flanking. A win proves reachability, not fun; await human response to the
first playable before declaring the core engaging. Art is a 3D low-poly scaffold,
not AAA. Full districts/fortress boss and physical-device performance unverified.
