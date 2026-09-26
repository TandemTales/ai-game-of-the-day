# Prism Warden â€” testing

Run all regressions: node node_modules/jest/bin/jest.js --runInBand
Run focused mechanics: node node_modules/jest/bin/jest.js prism-warden --runInBand
Browser harness will live at prism-warden/tools/smoke.cjs; serves local HTTP and
uses installed Playwright/Chromium. Evidence ignored under node_modules/.cache.
Required sizes:320x568,390x844,844x390,768x1024,1440x900,3840x2160.
Inspect each PNG; assert console clean, no horizontal overflow, independent
keyboard aim/move, native simultaneous touch, pause/retry, result and mock scores.

Mechanics acceptance: ray stops at solid cover; shield intercept/aim works;
receiver charge decays/latches exactly once; closed gate collision; projectile
front-facing reflection versus rear hit; guardian exposure/sword timing; dodge
cooldown and grace; rescue gated by guardian; deterministic legal-input victory;
idle cannot win, intentional route can; sanctuary optional and meaningful.
VM fixtures establish mechanics/reachability, not enjoyment. Native real-clock
routes must use actual browser input and disclose state-informed planning.
No production score should be submitted during verification. Full campaign,
physical-device quality and human enjoyment remain unverified until built/tested.

## September20 verified scaffold

16 focused mechanics regressions include a complete legal-input route, deterministic
replay, no passive shield victory, receiver/score anti-farming, collision, dodge,
sword/exposure, sanctuary healing and rescue. Full suite18suites/410tests PASS.
Run `node prism-warden/tools/solvability.cjs` for the explicit simulation pilot:
won15.5667 simulation seconds,4HP,3cracks,score2000,optional sanctuary. No state
injection beyond Begin; hidden state steers inputs. This is not human playtime.

`node prism-warden/tools/smoke.cjs`: six required sizes pass normal keyboard,
simultaneous native move+mirror/release,44px controls,pause/replay,mock rank+submit,
console/overflow and no external game requests. Optical, guardian and result
screens are declared fixtures; those do not prove a legal full run. Lead inspected
all six viewport captures, small-phone intro/results and actual reference comparison.
Initial favicon404, landscape HP wrap and overlapping guardian/keeper labels fixed.
4K captures downsampled by image viewer. Evidence:
`node_modules/.cache/prism-warden/sep20-smoke/report.json` and adjacent PNGs.

`node prism-warden/tools/native-play.cjs keyboard,touch` runs normal-clock actual
browser keyboard/mouse and native CDP touch with read-only state/camera planning.
Optional argument `recovery` deliberately takes a real hit, retreats to the
sanctuary, heals and finishes; `mirror-baseline` tests a passive guard strategy.
Windows defaults use installed Playwright under
C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright
and Chromium under C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe.
Override PW_PLAYWRIGHT/PW_CHROME; set PW_SHOTS for output and PW_VIEWPORTS for smoke.
Local browser launch may require approved execution after sandbox spawn EPERM.

Independent critic initial desktop won21.70game seconds,hp2;native touch won33.28,
hp2. Mirror-only18scombat left guardian6/6,player3/6,no health-band score farming.
Actual recovery hp6->5->6 and then win48.07game seconds,hp5,score2050. Raw independent
report and captures are in ignored `node_modules/.cache/prism-warden/critic`.
A refined sidestep pilot is retained by the tracked native harness; later timings
may differ due input heuristic/browser scheduling. All are state-informed agents,
not human discovery, learning, enjoyment or physical touch hardware evidence.

Independent scene comparison used actual official Nintendo Link's Awakening image:
https://www.nintendo.com/en-gb/Games/Nintendo-Switch-games/The-Legend-of-Zelda-Link-s-Awakening-1514327.html
NON-BLIND OURS LOSES. No audio listening test, complete campaign, live leaderboard
submission, performance certification or AAA acceptance. Future expansion must
retain these negative findings and test the entire adventure before polish.

Lead tracked native reproduction: keyboard won35.40s,6HP,0hits,2100score. Initial
touch loss is preserved in native/play-report-keyboard,touch.json; pilot had a boundary heuristic that could pick a blocked escape direction. Clearance-aware sidestep plus
late dash changed only test inputs. Touch rerun won34.77s,5HP,1hit,2050score, no page
errors. Evidence in node_modules/.cache/prism-warden/native. Runtime unchanged.

Final shared pilot check: keyboard34.52s/4HP and subsequent touch32.78s/4HP both won.
The latter includes settled result UI capture plus computed visible/in-bounds replay
and score form checks. Earlier native screenshots were taken during incomplete
panel painting; the500ms settled capture is the reviewed final result. No runtime
change. Later success does not by itself prove the earlier pilot-loss cause.

## September21 route-foundation verification

`node node_modules/jest/bin/jest.js prism-warden --runInBand` passes17/17,
including the five-region/25-challenge manifest and connected-room graph
contract. The full repository
suite passes18suites/411tests. `node prism-warden/tools/smoke.cjs` first hit the
known Windows Chromium `spawn EPERM` sandbox restriction; the same command with
approved outside-sandbox execution passed all six required sizes, clean console,
no horizontal overflow, no external requests, keyboard movement, simultaneous
native touch move/mirror/release,44px controls, pause/replay and mock
rank-before-submit. The route manifest is loaded through the browser shell.

The current report and PNGs are ignored evidence under
`node_modules/.cache/prism-warden/sep20-smoke/`; lead inspected all six playing
captures plus representative ready, guardian and result captures. This proves
the route foundation and existing checkpoint remain browser-safe, not that the
five-region campaign is playable, enjoyable or AAA. The prior non-blind Link's
Awakening comparison still reads OURS LOSES; no independent critic or shipping
judge was available on this run.

## September22 evening: Verdant Aqueduct

`node prism-warden/tools/aqueduct-pilot.cjs [noferry] [noseal]` plays the whole
game (abbey via abbey-pilot, then continueRegion) through B1-B5 with legal
inputs only. The focused suite runs it (full + no-ferry, determinism). Smoke now
asserts the abbey beacon gives 'cleared', Continue enters spillway, captures all
six aqueduct rooms, then a declared fixture wins at the reservoir beacon.
Linux: PW_CHROME=/opt/pw-browsers/chromium (Playwright from /opt/node22). If a
six-size run flakes on timing, rerun one size per process (PW_VIEWPORTS).

## September23 Glass Kiln route checks

`node prism-warden/tools/kiln-pilot.cjs` first plays the legal-input Aqueduct route,
continues through the reservoir beacon, then exercises C1-C5 through `PW.step`.
The pilot uses hidden simulation state to select routes and react to encounters;
it proves a deterministic route is available, not human discovery or enjoyment.
The optional Quench Gallery is checked for manifest connectivity; this route pilot
does not claim its pickup has a distinct combat effect.

Focused regression also checks active cold bridge movement/water cancellation,
thermal determinism, solid collision, hazard grace, idle challenge completion and
the C1-C5 pilot result. Run `node node_modules/jest/bin/jest.js prism-warden-kiln
--runInBand` for this set and the full command at the top before every commit.
`node prism-warden/tools/audio-audit.cjs` uses browser `OfflineAudioContext` to
render opening and Weaver arrangements plus phase/glass/boss cues; it checks finite,
non-silent samples and output headroom, but it does not substitute for a human listen.
The Glass Kiln authoring is a chapter increment: Regions 4-5, full campaign ending,
and a gameplay effect for Glass Edge are still debt. The C5-only Weaver pattern and
the bundled local basalt/glass floor layer must stay deterministic and retain the
procedural floor fallback when `Image` is unavailable or the asset fails to load.

## September24 Glass Kiln combat and visual follow-up

Focused Prism Warden suite passes2 suites / 35 tests, including a Weaver pattern
regression (telegraph, five shard launches, unchanged ordinary sentinel behavior)
and a legal route. The full state-informed route from the Abbey through the
Aqueduct and Kiln reaches the kiln beacon at307.9 simulated seconds,3/7 HP, with
A1-C5 cleared and no retries. This does not establish human discovery or enjoyment.

The updated browser smoke passes 320x568,390x844,844x390,768x1024,1440x900 and
3840x2160. Each run checks keyboard/touch, pause/retry/replay, mock rank/submit,
console, external requests and horizontal overflow. Lead opened all six Region3
room screenshots at390x844, all six framed Weaver-thread screenshots across the
required sizes, plus the 1440x900 furnace and C5 captures and the downsampled4K
C5 capture. The room title is allowed to fade before those fixtures are captured.
The local generated WebP is requested same-origin only. Renderer VM checks pass for
both missing `Image` fallback and async asset load/static-cache rebuild.

The OfflineAudioContext audit again produced finite five-second renders at44.1kHz
with opening RMS .0568/peak .4216 and boss RMS .0936/peak .5594. Listening and
physical-device playback remain unverified. Latest gameplay and visual critic
verdicts are both OURS LOSES; see the latest dated PROGRESS entry for remaining debt.

## September24 final renderer verification

`node node_modules/jest/bin/jest.js prism-warden --runInBand`: 2 suites / 35 tests
pass. The final six-size `tools/smoke.cjs` pass loads
`assets/img/kiln-basalt-glass.webp` same-origin in every viewport and checks clean
console, no external requests or horizontal overflow, touch/keyboard, pause, retry,
replay and mock leaderboard. Current inspected captures and `report.json` are under
`node_modules/.cache/prism-warden/final-post-render/`. VM fallback checks cover both
missing `Image` and failed image loading. These checks do not establish human play.
The latest independent gameplay and visual critics still report OURS LOSES; see
PROGRESS for their reasoning, audio-listening limits and unfinished campaign scope.

## September25 Night Observatory

Full integrated repository suite:20 suites/438 tests PASS. Observatory adds9 tests
covering authored connectivity, charge/acquisition/held burst, finite reveal/fall
recovery, safe refill without farming, retry rollback, idle failure, linked twin
vulnerability, deterministic D1-D5 legal route and optional refuge consequences.
The old18-room assertion now checks25 authored rooms against the first4 manifest
regions; the Kiln route now expects cleared/next stars rather than final victory.

Run `node prism-warden/tools/observatory-pilot.cjs` for D1-D5 or add `--whole`
for the actual Abbey->Aqueduct->Kiln->Observatory chain. Latest outcomes: local D1-D5
57.33 simulated seconds,3/6HP; whole A1-D5 365.20 simulated seconds,4/7HP. Inputs
only through PW.step, no health/position/score injection, no retries; hidden state
steers the agent, so neither outcome establishes human duration or enjoyment.

The extended `tools/smoke.cjs` passes all6 required sizes, console/external-request/
overflow checks, keyboard and simultaneous native touch, retry/continue/replay,
mocked leaderboard and local-asset HTTP200 checks. Evidence is ignored under
node_modules/.cache/prism-warden/observatory-smoke. Lead viewed all6 sizes plus the
independent real reference comparison. For final path-hiding/label/four-action UI
changes run `node prism-warden/tools/observatory-visual.cjs`; output is under
observatory-final. All6 sizes and no-Image fallback pass; actual R/native touch
spends charge, all4 mobile actions have visible44px targets. Lead inspected final
captures;4K viewed downsampled2048x1152. Fixtures test layout, not lawful completion.

Independent normal-clock actual keyboard/touch D1 routes passed from a declared
stars-room entry (10.13/14.38 seconds,6HP, clean console). This does NOT constitute
whole-adventure normal-clock or physical-device play. Critic comparison is nonblind:
AAA FAIL / OURS LOSES, complete scope FAIL, fun not accepted. Final hidden-path and
beacon-label corrections received a scoped PASS. Audio listening, full human input
playthroughs, persistent saves and live leaderboard submission remain unverified.

## September25 Drowned Crown first pass

`node node_modules/jest/bin/jest.js prism-warden --runInBand` passes4 suites / 47
tests. `prism-warden-crown.test.js` checks the five-region reciprocal graph,
Observatory continuation into E1, the three phase gates and post-boss evacuation.
The phase test uses a returned-shot fixture, latches both circuits to isolate the
floor-transition condition, and advances the real cycle; the evacuation test uses
declared boss-defeat state, guides Ilex through the actual follow path, and reaches
the beacon through the opened gate. These fixtures do not establish a legal full
E1–E5 route.

`node prism-warden/tools/crown-visual.cjs` captures each authored Region5 room and
the boss forms/result panel at all six required sizes. Current run passes all six
with zero console errors, external requests or horizontal overflow; mobile
slash/dodge/prism/burst targets are each at least44px and onscreen. PNGs and
`report.json` are ignored under `node_modules/.cache/prism-warden/crown-visual/`.
Lead reviewed the room and boss sheets plus the phone, landscape, desktop and 4K
captures; declared boss/result states prove layout/rendering, not legal play. Full
Region5 route, normal-clock campaign, human play, physical touch, audio listening,
complete ending/save/equipment scope and AAA acceptance remain open.

## September26 full repository verification

`node node_modules/jest/bin/jest.js --runInBand` passes **21 suites / 443 tests**.
The Tidal Abbey legal-input pilot now reaches its beacon through the repaired
north stair; the chained Aqueduct and Kiln pilots also reach their beacons.
`node prism-warden/tools/crown-visual.cjs` passes all six listed viewport sizes,
with no console errors, external requests or horizontal overflow. It asserts
44px mobile action targets, the portrait message/touch-dock gap, landscape
message suppression and the result overlay, title, story and cleared combat
message. The browser harness transitions from `playing` to `won`, but seeds the
win flags. Visual phase/result states are fixtures and do not prove a full-play
Crown victory. The final captures were inspected at 320x568, 844x390, 1440x900
and 3840x2160; the short-portrait card's discoveries, restart action, score-name
field, submit action and leaderboard link fit above the touch dock, and the
compact-landscape boss label/bar clear the HUD.


## September26 weekend progression and whole-route verification

`node prism-warden/tools/crown-pilot.cjs --whole` reaches the ending through legal
PW.step inputs and public continuation APIs: all25 challenges, 437.52 simulated
seconds,2/7HP,37600score,zero retries. Independent critic reproduced the baseline.
`--whole --archive` also obtains the Keeper Archive and its alcove consequence:
447.32 seconds,1/7HP,37650score,zero retries. These times are simulated, not human
playtimes. No invulnerability, health, position, enemy or circuit injection occurs
in these routes. The always-east/slash `--naive` loss is only a no-autowin baseline.

Three public-beacon-selected runs cover every equipment choice:
`--whole --loadout=anchor` (444.07s,3/7HP),
`--whole --loadout=throwing` (437.52s,2/7HP), and
`--whole --loadout=alternate` (420.10s,1/7HP). Prior pilots release Mirror before
ordinary melee/optical rotation with Returning Blade. Thus these prove branch
completion, not active mastery of throwing or dual optical placement. Focused
`prism-warden-equipment.test.js` separately verifies behavior and tradeoffs,
projectile obstruction, phase clamps and independent prism placement.

`prism-warden-save.test.js` verifies pending/selected debrief saves, region rollback,
secured score/discoveries/equipment, won state, malformed active/stored rooms and
nonfatal denied/full storage. `tools/progression-smoke.cjs` uses declared completed-
beacon fixtures and actual browser choice/touch/keyboard interactions to verify all
four decisions, repeated reloads before/after selection, checkpoint rollback, blade
and two prisms, four acquired touch actions, and pause help at all six sizes.
Evidence: node_modules/.cache/prism-warden/sep26-progression/.

`tools/smoke.cjs` now selects equipment before continuation and expects the
Observatory to continue into the Crown, correcting its stale final-win assertion.
It checks keyboard/native touch, pause/retry/replay, mock leaderboard, local assets,
console/network and horizontal overflow. Evidence: sep26-weekend-smoke/.
Local Chromium needs approved execution after sandbox spawn EPERM.

Critic evidence: sep26-weekend-critic/review.md and current-side-by-side.png.
Comparison is NON-BLIND, uses a fresh official Nintendo page but a cached official
Link's Awakening image after fresh raw-image retrieval failed. Equipment/save
increment scoped PASS; AAA FAIL / OURS LOSES; complete scope FAIL; fun unproven.
No physical-device, full normal-clock campaign, audio-listening or live leaderboard
acceptance is claimed.

Final weekend full Jest result: **23 suites / 458 tests PASS**. Added legal E1–E5 route and Archive burst-crossing regression; final combined acquired-action six-size browser sweep PASS.
