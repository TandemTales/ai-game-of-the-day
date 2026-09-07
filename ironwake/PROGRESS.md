# Ironwake — Progress

## 2026-09-07 (Pacific) — selected / first playable intent

Human selected Ironwake and confirmed combat is central. Build the city-block
vertical slice: mech movement, ranged fire/melee, heat/venting, enemies that shoot
back, weapon theft and an aimed tower collapse capable of crushing the convoy.
Lead owns shell/input/audio/integration/tests. Single-file logic and renderer
builders with independent review. No full-game or AAA claim; no main promotion.

Updated the Weekend Bot Built Arcade Runner prompt through the app: future games
must propose three ambitious ideas, use vendored Three.js/generated2D where useful,
and demonstrate the core gameplay before standalone polish. Existing schedule,
model, dev discipline and second-Saturday release cadence preserved.

## 2026-09-07 — first city-block playable

Implemented the selected combat-first concept: articulated 3D mech movement and
mouse/touch aim, cannon and punch, enemies shooting back, reactor heat/overheat,
stationary vulnerable venting, disabled-escort heavy-gun theft, three-tank convoy,
directed two-second tower falls with progressively matching collision footprints,
rubble as persistent cover, crush bonuses, victory/escape/expiry and score/retry.
Three.js and MIT license vendored. Local synthesized combat cues with mute.
Catalog features Ironwake and retains Stormhook in More Games with exact rating
and leaderboard markup. Three districts/fortress boss remain future scope.

Lead integrated buffered short taps (quick E/click between RAF frames initially
vanished), deployment focus, accurate160armor meter, state-specific loss headings,
blocked-rubble shot feedback and mobile HOT display. Independent critic caught
LOCKED overflow at390; stacked phone readouts and HOT verified with real fire at
320/390. Lead image inspection additionally caught320results horizontal clipping
hidden by the outer viewport; fixed intrinsic grid/input sizing and added explicit
card/input/button bounds checks. No new renderer/logic features after verification.

Validation: full14suites/340tests pass,11 focused Ironwake tests pass after final
logic messaging change; syntax/diff checks pass. Six-size Chromium smoke verifies
normal-input opening tower crush, keyboard movement, simultaneous native touch
stick/fire and release, all44px action buttons, clean console including warnings,
no external runtime fetches, no horizontal overflow, HOT/results fixtures,
rank-before-submit mocked API and retry. Lead actually opened live/results at all
six sizes and the official comparison. 4K viewed downsampled; no native-resolution
sharpness claim. Expiry/HOT smoke fixtures do not count as natural mission proof.

Independent critic normal-clock actual-input missions (seed7, no injected state):

| Strategy/input | Result | Game seconds | Armor | Score | Notes |
| --- | --- | --- | --- | --- | --- |
| Planned demolition / keyboard | Won | 10.055 | 110 | 6599 | heavy theft,6kills,2collapses,overheat/vent |
| Planned demolition / native390touch | Won | 22.268 | 24 | 5147 | heavy theft,5kills,1collapse,overheat/vent |
| Direct fire / keyboard | Won | 9.955 | 115 | 5725 | no planned demolition,1incidental collapse |

These are critic-authored browser-input paths, not physical human enjoyment
studies. An earlier south-side route parked behind rubble and stalemated until
expiry; cover works, but needs better route communication. Added explicit
RUBBLE BLOCKS FIRE / FLANK warning after that finding. Keyboard comparison gives
planned demolition874more points, while directfire remains faster/equally viable.
The scaffold demonstrates the verbs; challenge/replay value is not established.

| Discipline | Standing |
| --- | --- |
| Combat/demolition first playable | Independent functional PASS |
| Controls and responsive shell | PASS at six sizes; physical devices untested |
| Gameplay fun and replay depth | Unproven; obtain human first-play response |
| Art / visual identity | AAA FAIL vs freshly fetched official MechWarrior5 reference |
| Audio / dedicated VFX | Starter local cues/effects, not independently AAA judged |

Reference comparison is identified, not blind; official source/provenance and
actual downloaded image in node_modules/.cache/ironwake/critic/provenance-and-verdict.txt.
Lead opened comparison-first-playable.png. Critic prefers reference material
depth/terrain/target presentation to current repeated facades and cube rubble.
No reference art incorporated into game. Evidence ignored under
node_modules/.cache/ironwake/final and critic; natural runs reported in
keyboard-flank.json,touch-flank.json,keyboard-direct.json.

Next: get human feedback on punching/toppling/shooting before expanding the
block. Improve tactical visibility on phones and feedback when cover blocks
shots. Tune authored encounters so maneuver, demolition timing and weapon theft
matter beyond easy direct fire. Then expand districts/boss without replacing
the core with farming. Keep all controls, recovery, collision and viewport gates.
No AAA completion marker or shipping judge; main untouched. Forced dateSep19.
