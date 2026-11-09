# Signalbreak verification

From repository root:

```
.\node_modules\.bin\jest.cmd --runInBand --cacheDirectory node_modules/.cache/jest-nightly __tests__/signalbreak.test.js
.\node_modules\.bin\jest.cmd --runInBand --cacheDirectory node_modules/.cache/jest-nightly
node tools/signalbreak-browser-smoke.cjs
```

Rules tests load classic scripts in a vm with a browser-global shim. Verify
read-only previews, AP/path legality, blocked and circuit-door LOS, cover/height,
deterministic attacks/AI, overwatch, rescue, objective/extraction, win/loss,
fresh-state isolation and all eight authored operations' legal live-AI routes.
The 47 focused cases also cover exclusive relay/LOS/turret changes, repeated-score
protection, stranded-squad reroute refusal, clinic-interlock rejected-action
immutability, raised-tile projection picking across zooms, earned unlocks,
mission-boundary save/load, replay best scores and corrupt/gapped/denied storage.
The twenty-operation manifest is a contract, not twenty implemented levels.

Browser QA: local HTTP + optional Playwright/installed Edge, six required sizes
(320×568,390×844,844×390,768×1024,1440×900,3840×2160), no horizontal overflow,
clean console, no external gameplay requests, title/live/result PNGs opened by
the lead, real keyboard/pointer/native touch, preview→confirm, cancel, end turn,
hack-linked door/turret, loss/retry, operation score rank-before-submit with LOCAL
API mock only, file:// boot and DPR2 backing. Read screenshots, not just paths.

The harness now completes all eight missions through actual UI orders and live
AI, with no tactical-state injection. Locked Manifest, Night Freight, Rooftop Crossfire and Cargo Lift use native touch for
selection, movement, node targeting and confirmation throughout. It reloads to
the next earned briefing, validates best-score save records, holds the first
rank response until Next changes missions, and checks that the original score
is still posted. A separate denied-localStorage page must stay playable and
display its save warning. Separate loss fixtures are explicitly labelled.

In addition to the opening six-size sweep, all seven added maps have title/live captures
and native touch/raised-tile-picking/overflow/console/request checks at all six
sizes. Campaign debrief/mastery text is checked. Evidence includes results.json
and SHA-256 source-manifest.json in node_modules/.cache/signalbreak/browser-smoke.
Do not confuse these legal state-informed pilots with human balance/fun evidence.

Use ignored node_modules/.cache/signalbreak for evidence; Playwright can use the
existing ignored node_modules/.cache/tidelock/browser-deps install via NODE_PATH.

```
$env:NODE_PATH=(Resolve-Path node_modules/.cache/tidelock/browser-deps/node_modules).Path
node tools/signalbreak-browser-smoke.cjs
```

If that optional cache is absent, install Playwright only in ignored scratch,
without changing package.json/package-lock.json or downloading a new browser:

```
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD='1'
npm install --prefix node_modules/.cache/signalbreak/browser-deps --no-save --package-lock=false --ignore-scripts playwright@1.55.0
$env:NODE_PATH=(Resolve-Path node_modules/.cache/signalbreak/browser-deps/node_modules).Path
```

Full Jest normally needs five minutes. Real-device performance, speaker quality,
fresh-player comprehension/fun and independent AAA comparison remain unverified.

Night Freight coverage: repeating West1-2/transit3/East4-5/transit6 timetable,
wrong-platform/stale-confirm rejection without AP changes, occupied ambush entry
deferral, exactly-once deployment and a full player response before enemy action.
Old three-operation v1 saves retain results and unlock04. The browser pilot boards
all four through actual UI orders/live AI, with six-size title/live captures and
scroll-reachable briefing CTA. Current boarding/countdown uses a fixed map legend
to avoid overlapping phone-scale platform labels; optional mastery remains an
authored goal, not a persisted medal. No human/device/AAA evidence is implied.


Rooftop Crossfire coverage: all24-column rows and declared nodes; stair-only
movement both directions, southern powered door, route detour via northern stairs,
cross-cliff rescue/aid rejection, deterministic legal live-AI victory, and old
four-operation v1 save compatibility/unlock. Six-size exact new-map captures and
native touch raised tile picking; complete rooftop pilot uses native touch and
actual UI orders. No tactical state injection in victory paths. Lead inspected
all12 new title/live captures via contact sheets plus phone/desktop originals.
Contact sheets downsample4K; they do not prove full-resolution4K legibility.


Cargo Lift: 47 focused cases cover six legal live-AI victories/four survivors,
power/rescue interlocks, readonly previews, four rider offsets, deck terrain and
height, stale direction, empty recall, hostile/occupied docking rejection,
delivery extraction gate, both deck positions picking and five-map v1 saves.
Browser harness earns all eight missions and plays Cargo via native touch. All five
added maps have six-size title/live sweeps (36 map/viewport combinations total).
Cargo is narrative escorted supplies, not an independently damageable actor.


November6:47 focused cases now include all8 raw-stat deterministic routes and
an eight-operation consecutive persisted-growth campaign. Firstclear reward and
injury updates, replay anti-farming, equipment gates/stat tradeoffs, treatment,
role perks, nonstacking preparation, malformed/legacy saves all covered.
Clinic tests cover exact6assault timing, coverage/hp/loss freeze and extraction;
antenna tests cover lane copies/preview warnings/alternation/damage/shutdown.
Pilot fills deepest free lift slots and packs riders inward to handle different
movement stats without blocking later boarders. Browser earns all8missions,
plays new ones via native touch, checks equipment/save and disabled field edits,
keyboard summary behavior, plus a labelled saved-injury treatment fixture.
Preparation capture390wide; all7additional maps at6sizes=48total combinations.


November6 nightly Sluice Logic:53 focused cases pass, including nine base-stat
legal live-AI wins and consecutive earned-growth paths. Water tests cover path
changes/transparent fire, rescue/diversion interlocks, readonly previews/status,
occupied allied/hostile beds, stale confirmation rejection without mutation,
disconnected-squad rejection, legal connected east-bank switching, extraction
prerequisites, and eight-operation v1 save/gear/injury preservation/unlock.
Initial browser completed all nine earned missions, including Sluice through
native touch, but its sweep assumed (start.x+1,start.y) was walkable and hit an
authored Sluice wall. Corrected the harness to choose a legal adjacent target,
then still verify its real touch preview/confirmation. No runtime rule change.
Final stable-source browser/full-suite results pending below.

### November 6 nightly final verification and handoff

Pushed intent ac9e348 and operation09 content3ef65cd. Full repository31/31suites,
559/559tests PASS (344.345seconds), report node_modules/.cache/signalbreak-sluice-full.json.
One additional connected-east-bank safety test was added after that full-suite
snapshot; final complete Signalbreak53/53 PASS (66.47seconds), plus isolated new
case PASS. Runtime unchanged since the full suite. Syntax/diff checks PASS.

Final stable-source Edge PASS: opening six viewports plus48 additional-map/size
combinations (nine operations across six sizes overall). All nine earned-growth
actual-UI/live-AI wins have four survivors; Sluice native touch63orders/turn11/
3770points. Passed save/reload/unlock/gear/injury fixture, rank-before-submit and
delayed-score snapshot with local mocks, denied storage, file boot, DPR2, loss,
clean console/nooverflow/noexternalgame requests. Initial sandbox Edge blocked;
scoped elevated local-only retry succeeded. First sweep hit its fixed target
wall; corrected QA target selection, final complete rerun PASS. Production API
never contacted. Runtime hashes match final browser source-manifest.json at
2026-11-07T07:12:40.228Z. Lead opened all12 Sluice title/live frames via three contact
sheets plus original phone/live, earned north circuit, victory and comparison.
4K contact downsampled; no full-resolution4K readability proof.

Independent critic: ART/UI FAIL / OURS LOSES against official XCOM2 gameplay
https://store.steampowered.com/app/268500/XCOM_2/
Water/dry routes and legends coherent/readable on phone/desktop, no additional
substantive rules/readability blocker found. Encoding issue corrected before
final browser run. Tiny similar actors, sparse repeated slabs, missing machinery
identity and excessive empty viewport remain. Comparison artifact ignored:
node_modules/.cache/signalbreak/sluice-critic/sluice-side-by-side.png.
Different camera views, reference native615x346; not matching-angle HUD proof.
Audio/VFX remain unjudged; no physical-device, human-fun or GPU evidence.

NEXT FIRST:10SpanControl moving bridge capture, then11Blackout visibility and
12PumpSiege. Nine of twenty operations across three districts; Floodworks only
one of four, eleven total still required. Preserve roster/gear/injury/v1 saves,
base/grown-route proofs, Tidelock and all approved breadth. District consequences,
tracked mastery, final campaign score and Citadel ending remain required. FIRST
PLAYABLE stays. No .aaa-complete, main/catalog/release action. ForcedNovember14.


## November 7 Span Control focused verification

Focused58/58PASS, including ten base-stat/live-AI routes and a consecutive
persisted-growth campaign. Span tests cover pre-rescue loaded crossings/rider
offsets, vacated water/transparent LOS, empty recall anti-delivery, occupied and
hostile decks, dock/rescue/crossing prerequisites, stale dispatch and circuit
confirmations with byte-identical rejected state, and nine-clear v1 migration.
Span base route wins turn14/four survivors. Browser harness now includes all10
actual-UI earned-growth victories and all10maps/six required sizes (60total
combinations). Full-suite/browser final results recorded in the handoff below.


## November 7 final browser and independent review

Pushed intent e5ba7b6 and operation10 b59ad96 todev. Focused58/58PASS
(72.135seconds), syntax and scoped whitespace checks PASS. Full repository
31/31suites565/565testsPASS,347.074seconds exit0; report
node_modules/.cache/signalbreak-span-full.json. Stable-source Edge PASS:
ten earned-growth actual-UI/live-AI victories, each four survivors. Span uses
native touch,76orders/turn13/4010points. Base-stat route turn14/four survivors.
Opening six-size sweep plus54additional map/viewport combinations=60total.
No overflow/app warnings/errors/external gameplay requests. Save/reload/unlock,
equipment/field locks/treatment fixture, locally mocked rank-before-submit and
delayed score snapshot, denied storage, file boot, DPR2, loss/retry all PASS.
Initial sandbox Edge launch blocked; scoped elevated local-only retry succeeded.
Production API never contacted. Runtime hashes match source-manifest.json at
2026-11-08T07:09:16.023Z. Lead opened all12Span title/play frames via three
contact sheets plus phone live, power capture, victory and side-by-side originals.
4K contact downsampled; no full-resolution4K legibility claim.

Independent ART/UI FAIL / OURS LOSES against freshly fetched official XCOM2:
https://store.steampowered.com/app/268500/XCOM_2/
No additional substantive rules/readability blocker found. Tiny similar actors,
repeated flat slabs/water, sparse bridge machinery and empty lower viewport
remain. Minor blocked-move advice is generic security-door wording. Audio/VFX
remain unjudged; no human-fun/device/speaker/GPU evidence or AAA claim.
Comparison: node_modules/.cache/signalbreak/span-critic/span-side-by-side.png;
different views, native615x346 reference labelled. Critics did not clear quality.

NEXT FIRST:11Blackout light/visibility infiltration, then12PumpSiege. Campaign
10/20; Floodworks2/4, Archive/Citadel still absent. Preserve roster/v1 saves,
base/grown legal routes, all approved scope, Tidelock and FIRST PLAYABLE.
District consequences, tracked mastery, final campaign score and finale remain.
No .aaa-complete/catalog/main/release action. Saturday age5; forcedNov14.


## November 8 Blackout coverage

Focused64/64PASS (80.083seconds). Eleven base-stat deterministic live-AI routes
and consecutive earned-growth campaign each extract four. New cases verify
lamp/door/turret coupling, readonly light previews, two-tile dark detection,
idle unspotted patrols vs illuminated pursuit/fire, immutable stale shots and
Archive captures, rescue/darkness interlocks, geometric three-tile engineer
signals and ten-clear v1 migration. Browser harness extended to11earned wins
and66map/viewport combinations, native touch for Blackout, local-only rank mocks.
Final browser/full-suite/critic evidence follows in PROGRESS; not claimed yet.

Final November8:64focused and571full-repository tests PASS; stable-source Edge
11actual-UI/native-touch/live-AI earned wins (all4survivors),66map/size checks,
source-manifest2026-11-09T07:08:24.723Z matches current runtime. Lead opened all12
Blackout title/live via3contacts plus final phone/switch/victory/comparison.
See PROGRESS final handoff for checks, harness retries and evidence limits.
Independent ART/UI FAIL; no AAA/device/humanfun/audio/GPU proof.
