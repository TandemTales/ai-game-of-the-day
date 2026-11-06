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
