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
