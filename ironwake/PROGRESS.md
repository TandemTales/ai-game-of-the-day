# Ironwake — Progress

## 2026-09-12 (Pacific) — nightly intent

Tonight is the first Saturday for this game (age five), so the forced release
threshold is not met. This bounded polish pass follows yesterday's independent
functional review: improve portrait threat/objective readability around tall
towers and make disabled enemies legible without relying on tiny weapon labels.
Preserve the five-chapter, twenty-objective campaign, touch/keyboard controls,
save/upgrade contract and existing regression gates. Re-run focused and full
tests plus the six-size browser/visibility/control smoke, inspect representative
mobile and desktop captures, and leave AAA visual/audio/VFX, physical-device,
human pacing and production leaderboard debt explicit. No release or `main`
change is planned tonight.

## 2026-09-12 (Pacific) — tactical readability pass and handoff

The lead integration pass keeps the campaign and controls unchanged while
making disabled salvage labels identify the chassis first (`ESCORT OFF` and
`ARTILLERY OFF`) with compact HEAVY/RAIL action text. Disabled artillery now
leans like the existing disabled escort cue. Offscreen threats receive a
larger type line, heavier edge rule and opaque urgency card while preserving
the existing collision-free placement, tether and input pass-through logic.
Landscape briefings use a compact, bounded card so the 844x390 save note is no
longer cut off. The field manual now explains the OFF/RIP presentation.

The archive checkpoint and archive regression workers inspected their single
owned files and made no changes: campaign state already exposes the required
target/type/disabled/weapon fields, and archives.cjs already has the relevant
browser coverage. No cross-file worker request remains.

Verification on pushed `dev` commit `4b905e2`: full Jest passes **367 tests in
15 suites**; changed JS passes `node --check`; `git diff --check` passes;
visibility fixtures pass at 320x568, 390x844, 844x390 and 1440x900; enemy
identity/lifecycle fixtures pass at those four sizes; the archive sweep passes
all six required viewports; six-size smoke passes collapse, keyboard/native
touch input, buttons, results/retry, rank-before-submit, clean console, no
external requests and no horizontal overflow; and native touch controls pass
all ten groups at 320x568, 390x844 and 844x390. I opened the refreshed disabled,
offscreen-threat, landscape-briefing, portrait, desktop and downsampled 4K
captures. These are fixture/browser and software-render evidence, not a
physical-device or human-enjoyment study.

Independent critic verdict remains **AAA FAIL / OURS LOSES** against freshly
verified official MechWarrior 5 Kestrel Lancers imagery. The final pass fixes
the specific disabled/offscreen/landscape readability debt but does not clear
the larger reference gap in authored materials, destruction/VFX/audio depth,
route composition and first-play onboarding. Human pacing, physical-device
performance, accessibility, production leaderboard connectivity and a fresh
post-patch independent A/B re-verdict remain open. No `.aaa-complete`, release,
Featured Game edit or `main` promotion is justified; forced release remains
Saturday September 19.

## September 11 — independent gameplay verdict and next priority

Final checkpoint: full Jest 360/360 in 15 suites; six-size browser smoke passed;
dedicated native control harness passed ten grouped checks at each of 320x568,
390x844 and 844x390. It checks actual projectile headings, exact native pointer
release, unrelated FIRE contacts, active simulation after interruption and
desktop compatibility. Lead inspected the six-size images, three final control
fixtures, critic touch combat/results and AAA comparison. No source changes
after tested implementation ae99d95; final commit adds regression/handoff only.

The independent critic completed Breakwater with actual keyboard/mouse and with
at most TWO native touch contacts using the new FIRE dragging. Keyboard won in
52.53 game seconds with 191 armor. Touch won in 59.43 seconds with 154 armor,
12 kills, one collapse kill and a stolen railgun; no page errors. Touch used
demolition, gun theft, venting, capture and escape. Read-only state-informed
planning makes these reachability/control results, not human fun or playtime
estimates. All-five-chapter touch completion and physical devices remain untested.

A naive keyboard variant using the same navigation but no demolition, punch,
theft, vent or boost lost at 67.50 seconds before clearing the first objective.
This supports a tactical distinction but does not isolate any single mechanic
or prove human skill improvement. Two earlier touch attempts had driver errors
(interrupted actions and selecting RIP beyond its real range); excluded from
product conclusions. Corrected fresh two-contact run completed.

Functional controls: independent opening-chapter PASS. AAA visuals: FAIL / OURS
LOSES to freshly downloaded official MechWarrior 5 Kestrel Lancers megacity art.
Critic and lead actually viewed the side-by-side; it was identified, NOT blind.
Reference wins material, environment and destruction detail. Audio/VFX have no
independent AAA pass. No shipping judge or completion marker; main untouched.

Next FIRST: make portrait threats and objectives readable around tall towers
and beyond the camera edge, then play again with ordinary users. Distinguish
disabled enemies without depending on tiny RIP GUN labels. Keep the new control
regressions and five-chapter scope. Human pacing/replay enjoyment, physical-device
performance and production leaderboard connectivity remain open. Release date
remains September19; tonight is Pacific Friday September11, age4.

Evidence: node_modules/.cache/ironwake/sep11-critic/gameplay-verdict.txt,
touch-after.json, keyboard/report.json, naive/report.json and comparison-sep11.png.
Official reference provenance is stored beside the comparison; no reference
assets were incorporated into the game.

## September 11 — touch aiming implementation checkpoint

Independent control review found that moving, firing and retargeting required
three fingers: FIRE captured its pointer but never used its drag to aim. Added
directional touch/pen FIRE dragging, a deadzone, player-relative aim while moving,
exclusive pointer ownership and current-camera crosshair updates. Field taps
still aim precisely; desktop aiming is retained. Cancel/pause/blur/resize/retry
clear controls. FIRE now says DRAG AIM on touch layouts; the manual explains it.

Full Jest: 360 tests / 15 suites pass. Final six-size smoke passes native touch,
keyboard, collapse, HOT, retry, mocked leaderboard, map pause and upgrade/save
reload with clean console, no external requests or horizontal overflow. Lead
opened all six final gameplay PNGs; 4K was downsampled by the viewer. Evidence:
node_modules/.cache/ironwake/sep11-final. Dedicated drag regressions and the
independent two-finger full chapter playtest are still in progress at this
checkpoint. No fun or AAA claim; main unchanged. Forced release September19.

## 2026-09-10 (Pacific) — exploration and pressure pass / handoff

The campaign now carries five explicit pressure profiles: the Drowned Ward
accelerates hunters, Glassline expands artillery danger, and the reactor and
fortress chapters use their own tuned hunter/artillery signatures. Counterattack
waves inherit the chapter profile. Nearby optional repair, capacitor and archive
caches now announce their type and distance in the command deck before their
automatic pickup, and chapter/final debriefs show the persistent archive count
and remaining story signals. The campaign scope, saves, upgrades, controls and
leaderboard flow are unchanged.

Verification on pushed `dev` commit `9b8878e`: focused Ironwake campaign tests
pass 17/17; full Jest passes 15 suites / 360 tests; changed JS passes
`node --check`; `git diff --check` passes; deterministic legal simulation
completes all five chapters; and elevated Chromium real-input campaign play
completes all five chapters with no page errors. The six-size smoke passes at
320x568, 390x844, 844x390, 768x1024, 1440x900 and 3840x2160 with collapse,
keyboard/touch input, results/retry, rank-before-submit, map pause,
upgrade/save reload, clean console, no external requests and no horizontal
overflow. I opened representative mobile, landscape, desktop, map, ending and
downsampled 4K PNGs. The first browser launch hit sandbox `spawn EPERM`; the
approved elevated retry passed.

No independent AAA critic or shipping judge was available, so the visual bar
remains unclaimed and no `.aaa-complete`, Featured Game edit, release, or
`main` promotion was made. Remaining debt is still authored material/VFX/audio
depth, physical-device performance, accessibility, human pacing feedback and
production leaderboard connectivity. Next run should use the new chapter
pressure in human play feedback before considering further balance changes.

## 2026-09-10 (Pacific) — nightly intent

Tonight’s bounded polish pass will use the completed campaign as the baseline and
target two player-facing gaps from the last handoff: make optional exploration
pay off more clearly in the moment, and make enemy pressure vary by chapter
without inflating the twenty-objective scope. I will preserve the campaign
save/upgrade contract, rerun the deterministic and real-input gates, and inspect
the affected mobile/desktop scenes. Independent AAA comparison and physical
device/accessibility proof remain unavailable; no release or `main` change is
planned.

## 2026-09-09 (Pacific) — nightly intent

Tonight’s bounded polish pass follows the completed campaign expansion. I will
re-run the full mechanic and browser gates, inspect the opening, a mid-campaign
biome, the Sovereign finale, and the mobile upgrade/map flows, then address the
largest still-visible campaign readability or presentation loss without adding
another district or inflating the twenty-objective scope. Any remaining AAA
debt—materials, authored VFX/audio, physical-device performance, human pacing
feedback and independent comparison—will remain explicit. No release or
`main` change is planned.

## 2026-09-09 (Pacific) — Sovereign presentation pass and handoff

The bounded renderer pass gives the Sovereign a forward-readable animated
shield ring: red while armored, cyan and larger during the exposed damage
window. It is a presentation-only cue; simulation, damage, timing, controls,
campaign scope and no-fetch behavior are unchanged. The exact exposed fixture
was captured at 1440x900 and visually inspected with the HUD reading `CORE
EXPOSED — FIRE`; the renderer error surface stayed hidden.

Verification on the pushed `dev` state: full Jest passes 15 suites / 359 tests;
`node --check ironwake/assets/js/render.js` and `git diff --check` pass;
`campaign-playthrough.cjs` completes all five chapters with legal deterministic
inputs; `native-campaign.cjs` completes all five chapters through real browser
keyboard/mouse input in 50.2 / 71.1 / 70.0 / 110.9 / 95.7 wall seconds; and the
full Chromium smoke passes 320x568, 390x844, 844x390, 768x1024, 1440x900 and
3840x2160 with collapse, movement, simultaneous touch, results/retry,
rank-before-submit, map pause, upgrade/save reload, clean console, no external
requests and no horizontal overflow. I opened the final 390x844, 1440x900,
downsampled 4K, and exposed-Sovereign PNGs.

No independent AAA critic or shipping judge was available, so no blind
comparison pass or release eligibility is claimed. The presentation is still
below the MechWarrior 5 bar in authored materials, VFX/audio depth and scene
complexity; physical-device performance, human campaign pacing, accessibility
and production leaderboard connectivity remain unproven. No `.aaa-complete`,
Featured Game edit, release, or `main` promotion was made. Next run should use
human campaign feedback to tune exploration incentives, enemy variety and
combat balance before adding more content.

## 2026-09-08 (Pacific) — nightly intent

Tonight’s bounded polish pass targets the two largest verified gaps from the
first playable: make demolition, flanking, heat and stolen-weapon choices
matter beyond easy direct fire, and deepen the authored city-block read with
stronger industrial landmarks/material layering. Logic and renderer workers
must stay in their single-file ownership lanes and obtain harsh independent
comparisons; the lead will integrate, verify all existing gates, and leave
release/main untouched. No new district or fortress scope is planned.

## 2026-09-08 (Pacific) — tactical logic unit

The deterministic simulation now gives the convoy formation and route choices
more weight without removing the direct-fire path: live escorts screen the
standard cannon from tanks, a completed rubble flank breaks the screen and
awards a one-time angle bonus plus per-tank flank kills, safe venting behind
cover awards a one-time reactor-cycle bonus, and the stolen heavy gun carries
slightly higher heat pressure. Public IW APIs and mission scope remain intact.

Lead regression coverage now proves screening, flank scoring/bypass, and safe
cover venting. Focused Ironwake tests pass 14/14; the full repository suite
passes 14 suites / 343 tests. The required independent gameplay critic was
not available before closeout, so this is not a fun or AAA verdict.

## 2026-09-08 (Pacific) — authored scene unit and handoff

The renderer now frames the block with procedural refinery yards, transit
gantries, road-edge markings and convoy-route staging. Building facades gain
service spines, rooftop machinery, beacons, varied facade accents and more
deliberate rubble; collapse effects now use typed debris/dust/explosion parts
and the fall lane is more explicit. Renderer API, picking, gameplay semantics,
framing, no-fetch policy and the existing performance safeguards are preserved.

Final validation after both units: `node --check` passes for logic and render;
the full repository suite passes 14 suites / 343 tests; elevated real Chromium
smoke passes 320x568, 390x844, 844x390, 768x1024, 1440x900 and 3840x2160 with
collapse, keyboard movement, simultaneous native touch, action-control bounds,
results/retry, rank-before-submit, clean console, no external requests and no
horizontal overflow. Representative mobile, desktop and downsampled 4K PNGs
were opened and read. No independent renderer critic or shipping judge
completed, so the prior MechWarrior 5 comparison remains FAIL/UNJUDGED and no
AAA or release claim is made. Remaining debt is authored material/VFX/audio
depth, physical-device GPU evidence, human first-play feedback and independent
AAA comparison.

## 2026-09-07 (Pacific) — nightly intent

Tonight's bounded polish pass targets tactical readability rather than adding
new mission scope: make the active tower target, convoy lane, and rubble/flank
relationship clearer in the 3D scene, then re-run the existing normal-input
combat and six-viewport gates. Preserve the playable combat verbs and leave
release/main untouched; any remaining visual debt will stay explicit in this
handoff.

## 2026-09-07 (Pacific) — tactical readability pass

Renderer-only polish adds a persistent world-space tower beacon and billboard:
PUNCH TOWER while a standing building is aligned, then FALL LINE through the
two-second collapse. The existing directional preview and footprint remain
unchanged; no logic, controls, timing, scoring, or mission scope changed.

Validation after the change: full repository Jest 14 suites / 340 tests passed;
render syntax and CRLF-aware diff checks passed. Real Chromium smoke passed all
six required viewports, normal-input tower crush, keyboard movement,
simultaneous native touch steering/fire and release, all 44px action controls,
retry reset, rank-before-submit, clean console, no external runtime requests,
and no horizontal overflow. I opened the 390x844, 1440x900, and downsampled
3840x2160 collapse captures; the FALL LINE cue is legible without covering the
combat lane.

No independent AAA critic or shipping judge was available this run. The visual
identity remains a low-poly scaffold below the MechWarrior 5 reference bar;
authored terrain/material depth, dedicated VFX/audio review, human first-play
feedback, and real-device GPU performance remain unproven. No .aaa-complete,
release, or main promotion.

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

## September 9 — The Coast Campaign

Human feedback: the combat is good for a demo, but one small level lasting about
a minute is inadequate. The first-playable-only plan above is superseded.

Implemented five chapters and twenty objectives: Breakwater, The Drowned Ward,
Glassline, Cinder Works, Sovereign. Maps span 200–270 units versus the demo's 72.
Mara, Orla and Ivo's evacuation/rescue story runs through briefings, objective
radio, optional archives, debriefs and a final ending. Explore without a mission
deadline. Added booster dodge, hold-to-interact captures, uplink defense with
three counterattacks, hunters, artillery telegraphs, ripped railgun, cooling water,
furnace vents, repair/capacitor caches, between-chapter module choices, local
checkpoints, persistent completed debriefs, tactical map/pause and campaign totals.
The walking Sovereign has three damage phases and vulnerable cooling windows.

Presentation: distinct ground/architecture/landmarks, desert armored train,
full-length collapsed rubble, world-following shadows/camera, optional cache
markers, flat hazard boundaries and a cyan silhouette behind occluding buildings.
The campaign camera is wider than the demo and leads toward the mech's aim.

Implementation checkpoint `3954fb6` pushed to dev. No main release.

Verification: 359 tests / 15 suites pass; six responsive viewport checks pass.
All five chapters complete in both deterministic input simulation and an actual
keyboard/mouse browser run. Browser chapter times: 51.8 / 70.1 / 70.8 / 111.7 /
86.6 seconds, with 191 / 281 / 199 / 236 / 235 armor remaining. The pilot reads
state for planning, so this is completion evidence, not a human playtime claim.
Fresh scene and ending fixtures separately validate train collision/presentation,
upgrade saves, completed-debrief reload and full campaign totals. See TESTING.md
for exact commands, screenshots, earlier failures and evidence boundaries.

Notable fixes during play: extended weapon-rip reach around rubble; fixed static
defender membership so luring a hunter away cannot clear an elimination mission;
made the boss cooling window attack-free; widened the camera after two native
harbor attempts suffered from poor visibility; prevented lethal environmental
damage from being undone by same-frame repair/extraction.

Next: human campaign feedback on pacing, exploration incentives, enemy variety
and combat balance. The world and story now have a complete campaign arc. Further
expansion should add authored encounters and decisions, rather than inflate timers.
No AAA claim; physical-device performance and production leaderboard remain untested.

## September 11 — touch combat and campaign usability audit

Tonight: verify the current campaign, independently critique normal-input play,
then fix concrete touch combat/control problems and regression-check the six
viewports. Gameplay remains unproven; no standalone art polish or release planned.
Pacific Friday, age4; forced release September19. Only the lead runs Git.

## September 11 — tactical visibility follow-up (21:25 Pacific)

Tonight: improve readable nearby threat and disabled-weapon identity through
tower occlusion, and active-objective guidance outside the camera. Preserve
combat balance and two-thumb controls. Independent normal-input gameplay and
reference criticism, focused visibility fixtures and six-size smoke follow.
Friday age4; no release. Human fun and AAA visual gates remain unresolved.


Message correction: disabled artillery now identifies its railgun; disabled
escorts identify their heavy gun. Combat behavior is unchanged. Baseline full
360-test suite passed, and the current deterministic legal-input pilot completed
all five chapters (53.2/69.2/68.2/105.0/72.5 game seconds). This establishes
solvability for that informed route, not human pacing or enjoyment.

Visibility checkpoint: fixed-pixel nearby threat names/health and disabled weapon
identity remain readable through buildings. Gold active-objective guidance
includes distance and offscreen direction. Marker placement avoids the cockpit,
HUD and controls; priority preserves active threats among disabled wrecks.
Field manual explains the signals. Initial six-size smoke and 36 visibility
fixtures pass; full Jest remains 360/15. Final crowding/transition regression
and independent criticism are still in progress. No AAA or human fun claim.

Visibility implementation pushed as 494d0df after message fix ffd0609 and intent
a9490ba. Review fixed three concrete issues: salvage crowded live threats out;
nearby offscreen threats had no reachable label slot at320; far-front objectives
were classified as behind the camera. Labels now use camera depth, finite
projection and free space along panel boundaries. Compact landscape cards and
OBSCURED wording avoid clutter and confusing camera obstruction with shot cover.

Independent actual-input opening chapter: keyboard WON52.025s/200armor, two-contact
touch WON62.617s/212armor; each12kills/1collapse kill/railgun/no page errors.
The pilots read state for planning. They establish reachability, not human fun or
causal balance improvement. Small final presentation fixes followed these runs.
Final independent16fixtures across320/390/844/1440 retain objectives, including
the coastal-battery transition with disabled lock defenders. An older actual-play
comparison screenshot lacks its gold marker; historical cause is unproven.
Latest targeted fixtures supersede it for objective visibility only.

Discipline verdicts: functional tactical visibility PASS for tested scope;
AAA visuals FAIL/OURS LOSES versus official MechWarrior5 Kestrel Lancers. Actual
side-by-side is identified, not blind. Fresh official page; reference screenshot
cached earlier September11 with provenance after fresh image retrieval failed.
Lead inspected the composite, native touch combat, and gameplay at all six smoke
sizes (4K downsampled by viewer). No uninspected PNG is claimed as visual proof.
Audio/VFX remain unjudged; human enjoyment/learning, all-five-chapter touch,
physical-device performance and production leaderboard remain unverified.

Next FIRST: human phone play focusing on locating lock defenders and choosing
flank/vent routes without internal state. Dense labels still consume battlefield
space and lower-priority labels can be omitted. Improve chassis silhouettes and
threat presentation in response to play evidence; do not merely inflate timers
or count technical passes as fun. Art/material/environment/destruction depth
remains far below AAA. No completion marker, shipping judge, or main release.
Friday September11 age4; scheduled forced release remains September19.

Final expanded visibility harness PASS: 54 screenshot fixtures across all six
standard viewports, plus42 camera-plane steps. Verified text bounds (including
offscreen OBSCURED labels), crowd priority, far-front vs behind directions,
geometry changes, stage/chapter reused IDs, resize, pause/resume, real retry,
ready/lost/won cleanup and dispose. Renderer preserves JSON gameplay state;
no console warnings/errors/external requests. Final report04:36:59.740Z in
node_modules/.cache/ironwake/sep11-visibility/report.json. Earlier incomplete
runs are superseded. Lead inspected final crowded320, offscreen320, occluded390
and salvage844 images in addition to all-six smoke images and critic evidence.
Commands and exact evidence limits are in TESTING.md. No further work started.

## September 11 — bounded enemy-readability pass (22:24 Pacific)

Manual rerun; schedule unchanged. STOP absent. Friday September11, age4:
no forced release and no main changes. Baseline dev clean and current.
Intended focus: distinguish hunters/artillery/tanks by chassis and communicate
attack roles without adding more tactical-card clutter. Before standalone art,
independent normal-input gameplay criticism checks deliberate versus naive play
and native touch campaign coverage. Builders own one file each; only lead runs Git.
Focused render regressions and six viewport smoke will gate working checkpoints.
AAA comparison remains mandatory and failure will be recorded without release.

Attack-source checkpoint: pending hunter/artillery/boss strikes now retain their
actual source enemy ID so presentation can follow a real warning, not guess from
a cooldown. No targeting, fuse, damage or movement changes. Focused34tests pass,
including source/fuse/target persistence after an attacker is disabled. Full
baseline360tests passed before delegation. Artillery weapon theft also identified
a renderer defect: barrel remains attached; renderer builder correcting it.

Source/weapon-removal checkpoint: full363tests/15suites passed; no balance changes.

Enemy presentation checkpoint: hunters have a low reverse-joint stance and paired
ground hammers; artillery has a braced base and elevated split rails; tanks keep
tracks. Hammer motion and rail recoil follow an actual source-tagged pending
strike. Disabled artillery loses its weapon after theft. Tags clear taller models.
Regression review found stale chassis after entity removal and orphan ground rings;
both now clean up with their owners, and rings follow actor positions. Reused IDs
and revived wreck poses reset correctly. No combat balance changes.

Final full363tests/15suites PASS. New enemy-identity harness passes all six sizes,
including source-specific cues, theft, cleanup, replacement, disposal and simulation
nonmutation. Final six-size smoke and54visibility fixtures/42camera-plane steps
also PASS after cleanup. Lead inspected all six final gameplay images (4K
downsampled), phone artillery action/320ripped and the identified updated comparison.
Functional presentation scope accepted independently; AAA visuals FAIL/OURS LOSES.

Renderer checkpoint ace7772 pushed. Independent native two-thumb full campaign
completed all five:65.79/80.36/83.05/125.50/71.81s;7m6s total,76kills/6crushes,
340armor,0/5archives,maximum2contacts,no page errors. Root native keyboard/mouse
also completed all five:52.48/68.54/69.27/116.63/97.90s,no errors. Both pages loaded
before final presentation fixes. Separate updated-render touch opening won63.57s
with180armor before final ring/removal fixes; final fixtures cover later changes.
Lead inspected native fortress fights and the touch ending. These informed routes
establish functional progression, not human duration, enjoyment or exploration.

Baseline deliberate keyboard won51.69s/214armor; touch won65.60s/226armor. Naive
stationary fire lost49.39s at objective0. No balance tuning from that comparison.
Independent critic accepts functional scope and rejects AAA. Fresh official MW5
megacity reference and actual side-by-side viewed; identified, not blind. Updated
isolated fixture comparison is limited and supplemented by baseline campaign view.

Next FIRST: human phone feedback on unaided threat recognition and choosing routes.
The informed seven-minute campaign does not settle the original scale complaint;
do not claim the human is satisfied. Richer authored exploration/encounters,
architecture, materials, destruction and atmosphere remain debt. Improve concrete
play decisions and world variety, not timers or repeated objectives. Audio/VFX and
physical devices remain unjudged. No completion marker or shipping judge invoked.
This bounded pass ends on dev; main unchanged. Friday age4, forced release remains
September19. Automation prompt/schedule hash unchanged. Exact checks: TESTING.md.

## September 11 — archive exploration and checkpoint integrity (22:44 Pacific)

STOP absent; dev pulled clean. Friday age4, no release; September19 remains the
forced Saturday. Tonight checks optional archive discovery, readable recovered
story entries and chapter checkpoint consistency. Prior full campaigns collected
0/5 archives; that is a coverage gap, not proof people dislike exploration.
Intended bounded work: preserve collected stories in a mission journal, expose
useful map cache information, and fix archive retry/reload inconsistencies if
reproduced. Independent gameplay criticism and normal-input archive routes gate
claims. Tests precede every commit; only lead runs Git. AAA remains unpassed.

Checkpoint integrity unit: reproduced current-chapter archive surviving retry
while its score reset. Authored archive IDs now define the incoming chapter
checkpoint. Retry/unfinished reload discard current-chapter archives; completed
reload retains them; advancing banks them. Version1 saves remain compatible,
invalid/duplicate/future IDs are filtered and save snapshots no longer alias state.
Added IW.archiveEntries for recovered authored text and secured status. Four
persistent regression cases pass; full367tests/15suites PASS. UI and independent
archive-route/browser criticism are still in progress. No combat balance change.

Journal/map checkpoint: recovered authored stories can be reread after radio
expiry in the paused map and debrief. Unfound stories stay hidden. Optional cache
list shows type, direct distance and north-up compass direction. A top Supplies &
Archives shortcut addresses phone discoverability without extra combat HUD.
Current, secured and lost archive labels explain the checkpoint behavior.
Full367tests passed, focused38pass; six-size smoke passed with no errors and lead
viewed all6gameplay PNGs (4K downsampled). Initial expanded archive harness passes
48grouped checks and36fixtures; final shortcut/lost-label verification in progress.
Independent fresh normal-clock keyboard archive detour won57.129s218armor;
corrected two-contact touch won70.023s149armor. Both12kills/1crush/1archive;
naive stationary firing lost49.390s atobjective0. State-informed actual inputs,
not human enjoyment or physical-device proof. One earlier touch pilot stalled
4.21m from a repair cache with4m pickup radius. A corrected pilot rerun won but
did not reach that same stall, so the correction is not causally verified.
AAA map/journal OURS LOSES versus fresh official MW5 manual starmap screenshot.
Comparison identified and cross-map-type, not blind; no release support.

Final handoff: checkpoint fix cf5ea6a and journal8751460 pushed after intentd8f440b.
Final dedicated archives harness PASS all6sizes,8groups each,42PNGs, report
2026-09-12T05:50:54.827Z. Final lost-copy follow-up fresh320 PASS05:52:14.685Z:
prior archive SAVED, current archive LOST WITH MECH. Lead viewed final320shortcut,
390full journal,844full ending, lost/banked320, native touch combat/debrief and
actual official comparison, in addition to six-size smoke gameplay. Console and
external-runtime checks clean. API smoke is mocked, not production verification.

Next FIRST: authored optional encounters/revelations that change a later tactical
choice, plus unaided human phone feedback. A600-point lore detour and readable
journal do not resolve the scale/boredom complaint. Do not inflate timers or mark
AAA complete from green tests. Art/materials/world density/destruction/audio/VFX,
physical devices and production leaderboard remain unjudged/below bar. No shipping
judge or .aaa-complete; main unchanged. Friday age4; forced release September19.
This bounded pass closes on dev. Exact commands/evidence limits in TESTING.md.

## September 12 — optional battery sabotage (19:37 Pacific)

STOP absent; dev pulled clean. Saturday age5, no release; forced release September19.
Bounded intent: turn the Breakwater archive detour into an optional tactical route.
Recovered ferry command codes reveal a remote battery relay; reaching it and holding
INTERACT can disable the two artillery units before the final battery assault.
The ordinary combat route stays available. Record acquisition, interruptible hack,
exactly-once consequences and retry/reload behavior; explain the route in map/journal.
Single-file campaign and regression builders plus an independent gameplay critic;
lead owns UI/docs/Git. Test each pushed checkpoint. Human fun/scale feedback remains
unresolved, and AAA comparison failure remains release-blocking outside forced night.

Sabotage implementation checkpoint: ferry archive unlocks the optional relay;
uninterrupted five-second native INTERACT hold disables only surviving coastal
artillery for ordinary kill credit. Existing live shells persist; destroyed units
are not resurrected or rewarded again. Retry/unfinished reload reset the route,
won saves retain its outcome. Map signals explain the detour and hold/reset rules;
journal records outcome; nearby relay gets a HUD-safe marker and progress bar.
Full379tests/16suites PASS, including12new sabotage regression cases. Initial
relay browser sweep passes all6sizes; lead viewed phone/landscape fixtures and
found the world relay hidden by foreground architecture, then added the tactical
marker. Final sweep underway; independent real-input baseline keyboard/touch
both won. Optional-route play and harsh reference verdict still pending.
