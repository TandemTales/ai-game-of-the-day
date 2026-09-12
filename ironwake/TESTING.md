# Ironwake — testing
## September 11 archive checkpoints and exploration journal

Full Jest: 367 tests / 15 suites PASS. Focused Ironwake: 38 tests / 2 suites.
New persistent cases cover current archive/score rollback on retry and unfinished
reload, won reload/retry/advance, legacy-ID validation/deduplication, and immutable
save snapshots/journal entries. No combat balance changes.

Run `node ironwake/tools/archives.cjs` with the same IW_PLAYWRIGHT, IW_CHROME,
IW_VIEWPORTS and IW_SHOTS options as smoke. It uses explicit pickup/completion
fixtures, then actual keyboard/mouse or native touchscreen UI to verify map
pause/resume, the supplies shortcut, disclosure controls, cache rows, hidden
unrecovered stories, expired-radio journal, retry/reload/advance and the full
five-entry ending/new campaign. It does not prove natural play or enjoyment.

Final archive sweep PASS all6sizes / 8 groups each / 42 screenshot fixtures at
2026-09-12T05:50:54.827Z. Narrow final lost-status follow-up at320 passed
05:52:14.685Z in archives-lost-copy: prior chapter SAVED, current chapter LOST.
Lead inspected representative final shortcut/full-journal/ending/lost-label PNGs.

Six-size smoke passed; lead inspected all6gameplay images (4K downsampled).
This smoke predates the top supplies shortcut; the dedicated final archive sweep
and independent native shortcut checks cover that final navigation change.
Evidence is ignored node_modules/.cache/ironwake/sep11-archives-smoke and archives.
Browser launch required authorized escalation after sandbox spawn EPERM.

Independent normal-clock state-informed actual-input Breakwater archive detours:
keyboard WON57.129s,218armor; native two-contact touch WON70.023s,149armor.
Both12kills/1crush/railgun/1archive/no page errors. Touch maximum2contacts.
Keyboard archive pickup19.282s; touch20.166s. Fresh stationary forward fire LOST
49.390s atobjective0, a weak baseline showing idle failure, not gameplay depth.
Initial touch pilot stopped4.21m from a4m repair pickup; a final-approach correction
was included in the winning rerun, which did not reach that same stall, so its
causal effect is unproven. Gameplay state/time/HP were not injected in play runs.
Keyboard page predates journal integration; winning touch includes journal but
predates shortcut. Later dedicated fixtures cover the final presentation.

Critic accepts functional scope, rejects AAA. Fresh official MW5 manual page20:
https://static.mw5mercs.com/docs/MW5Mercs_Game%20Manual.pdf
Actual side-by-side viewed by critic and lead; identified, not blind, and strategic
starmap versus mission map limits equivalence. Comparison predates shortcut;
separate independent native checks at320/390/844/1440 accept shortcut behavior.
Full verdict, actual play reports and comparison: ignored sep11-archive-critic.
Stories remain small optional detours for points/lore, not richer encounters.
Human enjoyment/scale feedback, unaided exploration, physical devices and AAA
art/audio/VFX remain unresolved. Main unchanged; no completion marker.

## September 11 enemy identity and full campaign controls

Final Jest: 363 tests / 15 suites PASS. `node ironwake/tools/enemy-identity.cjs`
passes all six standard viewports. It freezes presentation fixtures and inspects
actual scene geometry, source-specific strike poses, HP/salvage identity, stolen
weapons, removed actors/rings, reused IDs, revival, rebuild, retry and disposal.
It asserts simulation nonmutation and clean console/network behavior. This is
presentation/lifecycle evidence, not natural gameplay. Latest report passed at
2026-09-12T05:36:07.100Z in ignored node_modules/.cache/ironwake/enemy-identity.
Use the same IW_VIEWPORTS/IW_SHOTS and browser-path overrides as smoke.

After final renderer cleanup, all six smoke sizes and the complete visibility
harness (54 fixtures plus42camera-plane steps) passed. Lead viewed all six smoke
gameplay PNGs, phone artillery-action/320ripped fixtures and native fortress/ending
captures. 4K was downsampled by the viewer. Evidence: sep11-identity-final-smoke
and sep11-identity-final-visibility under the same ignored cache directory.

Independent native two-thumb touch completed all five chapters: 65.79,80.36,
83.05,125.50,71.81 seconds; 7m6s total,76kills/6crushes,340final armor,0/5archives.
At most two contacts and no page errors. Actual keyboard/mouse also completed
all five:52.48,68.54,69.27,116.63,97.90 seconds; no page errors. Both pilots read
state to plan but use ordinary input and real clock, with no gameplay-state writes
or time skipping. Pages loaded before final renderer fixes. A separate updated
renderer touch opening won63.57s/180armor before the last cleanup/ring corrections;
latest presentation fixtures cover those corrections. Results do not predict human
playtime, exploration, unaided learning or enjoyment. No physical-device claim.

Baseline deliberate opening: keyboard won51.69s/214armor; touch won65.60s/226armor.
Naive stationary forward fire lost49.39s at objective0. This contrasts strategies,
not an isolated balance experiment. Full campaign evidence: sep11-identity-keyboard
and sep11-identity-critic/touch-campaign. Critic accepted the functional scope.

AAA visual FAIL / OURS LOSES against official MechWarrior5 Kestrel Lancers.
Fresh reference: https://mw5mercs.com/dlc/legend-of-the-kestrel-lancers and its
megacity-biome-01.jpg image. Actual comparison PNGs and provenance are in
sep11-identity-critic. A/B is identified, not blind; updated fixture versus promo
is limited, supplemented by baseline actual gameplay. World detail, architecture,
materials, destruction and atmosphere remain substantially below that reference.
Audio/VFX quality and production leaderboard remain unjudged. Main unchanged.

## September 11 tactical visibility follow-up

Run `node ironwake/tools/visibility.cjs` for focused browser presentation fixtures.
It uses the same installed Playwright/Chromium paths and IW_VIEWPORTS/IW_SHOTS
options as smoke. Fixtures freeze/replace state, then check rendered text,
marker bounds, input pass-through, camera occlusion, disabled weapon identity,
offscreen guidance and lifecycle cleanup. They do not establish enjoyment.
Final run passed all six sizes: 54 screenshot fixtures plus 42 camera-plane
steps, geometry/stage/chapter refresh, text bounds, crowd priority, input
pass-through, lifecycle cleanup and rendering without gameplay-state mutation.
No console warnings/errors or external requests. Report status passed at
2026-09-12T04:36:59.740Z; earlier partial runs superseded.
Evidence: ignored node_modules/.cache/ironwake/sep11-visibility.

Full Jest remains 360 tests / 15 suites passing. Six-size smoke passed at all
standard sizes after compact landscape cards and the field manual update;
later offscreen fallback/projection changes are covered by focused visibility
regressions. Smoke evidence: sep11-visibility-final. Mock leaderboard submission
checks request ordering only. Chromium needed approved escalation after EPERM.

Independent normal-clock actual-input opening chapter: keyboard WON in 52.025
seconds with 200 armor; native two-contact touch WON in 62.617 with 212 armor.
Both recorded 12 kills, 1 collapse kill, railgun and no page errors. Pilots use
read-only state for planning, not injected health, positions, timers or skipped
objectives. These runs used the first visibility revision; later presentation
fixes are covered by fixtures. No human enjoyment, physical-device or full-campaign
touch claim. The current deterministic pilot also completed all five chapters.

Independent side-by-side comparison: functional visibility PASS for tested scope;
AAA visual FAIL / OURS LOSES versus official MechWarrior 5 Kestrel Lancers.
Comparison is identified, not blind. Official page freshly verified; exact image
cached earlier September 11 reused after fresh image retrieval failed, with
provenance. Lead inspected the composite and actual native-touch combat image.
Reference, verdict and real-input reports: sep11-visibility-critic.

## September 11 touch combat verification

Full Jest: 360 tests / 15 suites passed. Six-size `tools/smoke.cjs` passed
at all default viewports with the changed controls and FIRE hint. Lead opened
all six final gameplay screenshots plus phone briefing/results/map and landscape
upgrade screens. 4K was viewed downsampled; no physical-device claim.

Run `node ironwake/tools/touch-controls.cjs` for native CDP touch regressions
at 320x568, 390x844 and 844x390. It uses the same IW_PLAYWRIGHT/IW_CHROME paths
as the smoke tool; IW_VIEWPORTS and IW_SHOTS optionally override sizes/output.
All three sizes passed ten grouped checks: tap aim, deadzone, simultaneous
movement/fire, four drag directions with actual projectile headings, capture
outside the button, unrelated pointer isolation, releases, pause/blur/resize/
retry, cancellation and desktop mouse/right-click/keyboard compatibility.
Browser console and page errors are checked.

The final report is dated 2026-09-12T03:51:31.199Z. A native pointer-event
observer verifies exactly which contact releases, because installed Chromium
1155's partial touchEnd behavior differs from current CDP documentation.
Interrupted-input fixtures explicitly resume the simulation before asserting
that no queued shots, punches, boosts or movement occur. Earlier exploratory
harness reports are superseded by this complete three-viewport run.

These are deliberately isolated controls fixtures: an empty arena and stopped
frames verify that lifecycle boundaries discard queued actions as well as held
ones. Blur is dispatched as an event; resize uses the browser viewport API.
They are not natural campaign play, physical touch-device or enjoyment evidence.
The separate independent critic uses native inputs with normal simulation time
and read-only state-informed planning for full opening-chapter play.

Independent fresh Breakwater results: keyboard deliberate route won in 52.53
game seconds with 191 armor; 390x844 touch with at most two simultaneous contacts
won in 59.43 seconds with 154 armor, 12 kills, one collapse kill and railgun.
The native touch route performed demolition, theft, venting, capture and escape.
Both had no page errors. A naive fire-only keyboard variant lost at 67.50 seconds
before objective one. This is strategy contrast, not an isolated balance test.
Two touch driver attempts were discarded for action-release/range mistakes;
only the corrected fresh run counts. The critic and lead inspected actual touch
combat/results and the identified official MW5 side-by-side (AAA visual FAIL).
Detailed provenance, per-step touch log and verdict: sep11-critic under the same
ignored evidence directory. Full-campaign touch and human enjoyment are unproven.

Ignored evidence: node_modules/.cache/ironwake/sep11-controls/report.json and
PNGs; sep11-final holds the six-size smoke. A sandbox Chromium launch failed
with spawn EPERM; the authorized elevated launch passed. Both browser harnesses
use local HTTP servers. Smoke mocks leaderboard calls; control fixtures never
submit scores.

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
