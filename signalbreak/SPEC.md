# SIGNALBREAK — approved full-game and module contract

## Authorization and purpose

The user selected Signalbreak by name in this chat on November 2, 2026 Pacific,
after requesting more ambitious games and an explicit three-proposal choice.
This is proposal 2 in .arcade-agent/game-proposals.md, now selected, not pending.
Implementation started 2026-11-02; forced second-Saturday date 2026-11-14.

Four signal engineers liberate an occupied city by rewiring its infrastructure.
Classic XCOM/Fire Emblem-lineage squad tactics, original non-alien setting/IP.
The core twist is a shared power circuit: changing one node alters doors, lifts,
light and turret allegiance together, so a safe route can expose a flank elsewhere.
This is a substantial authored campaign, never a tiny arena with stat modifiers.

## Full-game acceptance checklist (do not silently shrink)

- [ ] Five substantial, visually distinct authored districts and all 20 operations.
- [x] Four squad roles with persistent progression, equipment choices and injury recovery.
- [ ] AP turns, meaningful movement, cover, LOS, elevation and overwatch.
- [ ] Shared circuits affecting doors, turrets, lights and functional lifts.
- [ ] Rescue and evidence choices with persistent district/campaign consequences.
- [ ] Mission-boundary save/resume and replay/mastery goals.
- [ ] Briefings, radio characters, escalating story and a complete finale/epilogue.
- [ ] Fair previews, no hidden mandatory loss, touch/keyboard and readable HUD.
- [ ] Full campaign paths tested; separate human/device/fun and AAA critic gates.

First playable may implement only the opening operation, labelled honestly. Do
not mark these full-game boxes complete from that slice. Add authored situations
before polishing one encounter repeatedly. Any material scope reduction needs
explicit user approval; time/usage limits are not approval.

## Implemented content ledger — November 2 content run

- [x] 01 Live Wire: opening cover/circuit/turret/rescue/extraction operation.
- [x] 02 Locked Manifest: new prison/evacuation wings and exclusive transfer relay;
  rescue registrar, withdraw squad and reroute without stranding engineers.
- [x] 03 Cut the Feed: new three-sector layout, west/east isolation and northern
  clinic bypass; safe interlock, technician rescue and loading-bay extraction.
- [x] 04 Night Freight: cargo-flank ambush, turn-four pursuit and repeating west/east boarding windows.
- [x] 05 Rooftop Crossfire: stair-only roof elevation, always-open north approach and relay-gated southern flank, rooftop uplink/keeper rescue/tram extraction.
- [x] 06 Cargo Lift: powered two-dock platform, shutter/operator/medicine escort, upper reception gate.
- [x] 07 Open Clinic: six telegraphed ward assaults, exclusive shield power and turret tradeoff.
- [x] 08 Antenna Rain: three stair approaches, alternating marked firing lanes, tower shutdown.
- [x] 09 Sluice Logic: exclusive drained crossings, safe rerouting, keeper rescue and outlet capture.
- [x] 10 Span Control: moving bridge capture, east rescue/bridgehead, west return lock and final ferry.
- [x] 11 Blackout: coupled lamps/service access/turret, dark acquisition and technician/link infiltration.
- [x] 12 Pump Siege: twin staffed pumps, consecutive pressure cycles and two-gallery reinforcements.
- [x] 13 Paper Trail: optional purge breaker and allied turret via the north gallery, or a short hostile-turret approach; copy evidence before the deadline, rescue the archivist and extract.
- [x] 14 Two Keys: clear separate stacks and sorting wings, activate both consoles in one turn with different engineers, regroup through the shared vault gate, rescue the cipher keeper and extract.
- [x] 15 Ghost Broadcast: optional decoy opens a north hatch and diverts two patrols to the south court, or take the open central route to recover evidence, rescue the operator and extract.
- [ ] 16 Stolen Convoy: transport interception preserves evidence.
- [ ] 17 Outer Relay: network siege approaches.
- [ ] 18 Vertical Breach: floors and lifts.
- [ ] 19 Safe Corridor: defend/evacuate civilians.
- [ ] 20 Signalbreak: combined core shutdown and consequence-based epilogue.

Mission-boundary local saves, sequential unlocks and replay best scores now exist
for the fifteen implemented missions. Squad progression, equipment and injury
recovery are implemented; persistent district rescue/evidence consequences remain. Authored
mastery targets appear in the HUD; no campaign medal/reward system exists yet.
Story debriefs appear on victory. The clinic is a protected prerequisite, not yet
a simulated supply economy. FIRST PLAYABLE remains visible throughout.

## Twenty-operation campaign contract

| District | Four distinct operations and authored rule combinations |
| --- | --- |
| Switchyard | 01 Live Wire: cover extraction and shared substation; 02 Locked Manifest: prisoner release through a routed door; 03 Cut the Feed: isolate two linked substations without losing the clinic supply; 04 Night Freight: rail ambush and moving escape window |
| Vertical Market | 05 Rooftop Crossfire: elevation and alternate stairs; 06 Cargo Lift: escort across a powered moving lift; 07 Open Clinic: defend medical staff while switching circuit coverage; 08 Antenna Rain: raid a signal tower under alternating overwatch lanes |
| Floodworks | 09 Sluice Logic: divert water to create/remove paths; 10 Span Control: capture a moving bridge; 11 Blackout: lights/visibility and silent infiltration; 12 Pump Siege: simultaneous pumps with reinforcements and extraction |
| Glass Archive | 13 Paper Trail: recover evidence before purge; 14 Two Keys: split-squad synchronized access; 15 Ghost Broadcast: transmit a decoy and redirect patrols; 16 Stolen Convoy: stop transport without destroying civilian evidence |
| Broadcast Citadel | 17 Outer Relay: network-controlled siege approaches; 18 Vertical Breach: multi-floor access and lifts; 19 Safe Corridor: defend and evacuate civilians; 20 Signalbreak: core shutdown combining network, positioning and squad roles, with final consequences from rescued staff/evidence |

Each operation requires distinct objective geometry/decisions, not a palette,
speed, stat or enemy-count variant. Optional rescue, information and efficiency
medals should reward mastery without requiring a restart after every injury.

## Systems, progression and narrative

1. Tactical turns: two AP per engineer, path and cost previews, move/attack/
   interact/overwatch, explicit confirm, deterministic combat predictions.
2. Geometry: blocking structures, low cover, elevation advantages, clear LOS.
3. Network: engineer hacks nodes; door passability, lights, lifts and turret
   allegiance change as a coupled system; enemies can contest circuits later.
4. Squad campaign: engineer/medic/scout/heavy roles; abilities/loadout upgrades,
   injuries and recovery, rescue resources and mission-boundary saves.
5. Campaign state: rescued staff/evidence change support/options in later missions.

Engineer Nia Vale leads. Medic Sol carries the clinic's evacuation list, scout
Rook knows the rooftops, heavy Ivo can hold a corridor. Radio operator Mara tracks
the occupation network. The Citadel shutdown returns control to district crews;
the epilogue reflects civilian rescue and archive evidence rather than just kills.

Score rewards primary objectives, rescues, squad survival and efficient turns;
final campaign leaderboard is numeric. A slice score is explicitly an operation
score and must not masquerade as a complete campaign score.

## Single-file ownership

Classic non-module scripts on window.SB, offline/file:// safe, all gameplay art
procedural, no external runtime fonts/assets. Load missions → logic → render →
audio → game. Lead owns integration and Git; a worker edits exactly one assigned
file and reports cross-file needs. Independent critics touch no runtime files.

| File | Single owner / responsibility |
| --- | --- |
| index.html | lead: shell, script order, accessibility |
| assets/js/missions.js | content worker: authored mission definitions/story |
| assets/js/logic.js | gameplay worker: pure tactical simulation and rules |
| assets/js/render.js | renderer worker: isometric chart, actors, lighting and VFX |
| assets/js/audio.js | audio worker: procedural sound and audio lifecycle |
| assets/css/game.css | UI worker: responsive composition/touch/readability |
| assets/js/game.js | lead: input, previews/confirmation, HUD/state, save/leaderboard |
| assets/js/campaign.js | campaign worker: validated save/unlock/replay and squad progression; lead integrates |
| SPEC.md, TESTING.md, PROGRESS.md | lead: contract/evidence/handoff |
| ../__tests__/signalbreak.test.js | lead: deterministic rule and mission checks |
| ../tools/signalbreak-browser-smoke.cjs | lead: real-browser/input proof |
| ../tools/signalbreak-route.cjs | lead: deterministic legal-order QA planner, no state injection |

## First-playable API contract

Grid coordinates integer (x,y), origin top left. Tiles: . floor, # tall blocker,
c low cover, d circuit door, e exit, n network node, r rescue. Heights are separate.
No procedural randomness required; identical state/action gives identical outcome.

SB.Missions.operations contains the fifteen authored missions, get(id) looks up an
implemented mission, and manifest holds the full twenty-operation contract.
SB.Logic.newGame(id?) returns a fresh chosen operation (default Live Wire) and
rejects unknown IDs. SB.Logic.preview(state,actorId,
kind,x,y) is read-only and returns legal/action/cost/path/predicted damage/reason.
SB.Logic.commit(state,preview) revalidates the current state before mutation.
SB.Logic.endTurn(state) resolves friendly turret/overwatch and deterministic AI,
then refreshes living squad AP. Invalid actions spend nothing. No action after
won/lost. SB.Logic.visible/path are shared by UI, AI and tests; render never changes
rules. SB.Render.draw returns the projection used for inverse pointer mapping.

Only implemented operation data is playable. Planned manifest entries
must not silently turn into duplicate missions or unlock nonfunctional buttons.

New operation circuits name their node, controlled state, linked doors, optional
turret, exclusive routing group and prerequisites. circuitAt/doorOpen/turretAllied
are shared by render/input/rules; objectiveStatus supplies mission-specific HUD
goals. Closing a mutually exclusive route cannot strand active squad members.
Each circuit capture scores once, including repeated transfers. Raised-tile
selection uses displayed height-adjusted diamond centers.

Two Keys uses two consoles that share a vault gate. The first confirmation arms
one key for the current player turn. A different engineer confirms the other key
to latch both circuits and score the pair once. Ending the turn early clears
the armed key. The map and objective list read the same keyPairStatus accessor.

Ghost Broadcast uses an optional transmitter to open the north hatch and route
two marked patrols toward the south loading court. On each enemy turn a marked
patrol follows a shortest open path toward a tile within two spaces of the
court. It moves at most its normal stride, can take overwatch fire en route and
can still shoot. The guarded central route is always open. Copy the convoy
transmission to ally the turret and enable the operator rescue, then extract at
the roof stairs. The map and objective list share read-only broadcastStatus.

Campaign saves use signalbreak-campaign-v1 in localStorage, validate contiguous
completed operations, and persist mission-boundary selected/unlocked/best
records and validated squad progression. No in-operation resume: reload restarts the selected operation. Storage
failure is visible and leaves in-tab progress functional. Operation score remains
the temporary numeric leaderboard metric; mixed operation lengths/circuit counts
are not a balanced final campaign ranking. Before release, replace it with the
approved full-campaign scoring path. Rank requests snapshot the completed result
so a delayed reply cannot submit the next operation's score.

## Distinctness

| Existing game | Why Signalbreak is different |
| --- | --- |
| Aurora Tower Defense | manually command a mobile AP squad; no tower/wave economy |
| Bastion Builder | per-unit turn, LOS and circuit choices; no build/auto-battle |
| Bayou Brawlers | tactical previews/turns; no side-scrolling melee |
| Core Crisis | finite authored operations; no real-time survival arena |
| Crimson Descent | squad objectives; no action descent |
| Emberfall Gauntlet | AP/cover/network planning; no action gauntlet |
| Gearwell | no pieces/stacking/line clears |
| Ironwake | four engineers and infrastructure tactics; no real-time mech demolition |
| Lumen Pinnacle | no ball/flipper physics |
| Midnight Menagerie | deliberate squad command; no arcade arena loop |
| Neon Brick Breaker | no paddle/projectile rebound |
| Nova Striker | no bullet dodging or real-time aiming |
| Paradox Vault | no replay clones/time-loop heist |
| Prism Warden | no mirror combat or optical-action adventure |
| Pulse Loom | no music-note judgment |
| Stormhook | no swinging/platforming |
| Zephyr Circuit | no kart racing |
| Tidelock, on hold | no territory flood fill/exposed cable |

## Delivery sequence

Opening combat/network/rescue/extraction slice → full tactical rules and four
role abilities → Switchyard/Market authored operations → campaign/save/progression
→ Floodworks → Archive → Citadel/finale → whole-campaign input/solvability and
save checks → independent gameplay/visual/UI/audio/VFX critics and revisions.
Full scope first; successful automated routes are not human-fun or AAA evidence.


## Rooftop Crossfire traversal contract - November 4 Pacific

Operation05 opts into maxStepHeight:0 and bidirectional orthogonal climbLinks.
Only marked stairs cross height boundaries; path previews, enemy movement and
reroute connectivity share canStep. The south stair landing is a relay-controlled
door, while north stairs remain open. Rescue/field aid cannot reach through a
cliff edge. Earlier operations retain their existing traversable raised cover.
The service relay also allies the rooftop turret; a separate upper uplink and
keeper rescue gate eastern tram-roof extraction. Heights confer the existing
+1 downhill damage. Both stair routes are authored; optional mastery remains a
stated goal rather than a tracked medal. Squad growth/equipment/injuries remain
unimplemented follow-on work, not satisfied by mission unlocks.


## Cargo Lift contract - November 5 Pacific

Operation06 adds a 2x2 moving platform between the loading dock and raised clinic
terrace with no foot crossing of the shaft. Hoist power opens the rescue shutter
and allies the turret. Rescue loads the operator/medicine narratively; cargo is
not an independently damageable actor. MOVE to board; select HACK then target the
active deck or fixed dock console to dispatch for1AP. Living riders retain offsets.
Empty recalls supported; hostile riders/occupied destinations/stale confirmations
are rejected without AP loss. Delivery persists and gates extraction alongside
rescue and reception. Dynamic terrain/height is shared by paths, AI and picking.
Six of twenty operations exist. Progression/equipment/injury, visibility,
consequences and finale remain; optional mastery is not yet persisted medals.


## November 6 expansion: squad progression and completed Vertical Market

Eight of twenty operations playable; no finale or full campaign acceptance.
Open Clinic protects medical staff through six announced north/south assaults.
The correct exclusive relay absorbs the next strike; wrong coverage costs2 of8
staffHP. North coverage also allies the turret; south leaves it hostile. Both
relays remain reachable, and extraction waits for six assaults and living staff.
Ordinary patrols threaten the squad; marked reinforcements enter on turn3.
Antenna Rain alternates north/south marked firing bands for2HP at end turn only;
walking through is safe. Capturing tower control disables the bands. Three
stairs, one powered door, raised tower and separate service relay create routes.

First clears award1XP per extracted engineer and2medical supplies per rescue.
Downed engineers recover with injury2; belowhalfHP gives at least injury1;
healthy first clears recover one injury. Each injury costs2maximumHP at next
deployment (minimum4HP). Treat any injury for1supply before deployment.
Replays improve best scores but never repeat XP/supply/recovery awards. Two
starting supplies plus earned rewards prevent mandatory purchases/replay grind.
Ranks at2/4XP add1/2maxHP; Sol gains third kit and Rook+1stride at2XP; Nia gains
3-tile hacking and Ivo+1damage at4XP. Before deployment choose standard kit,
armor(+2HP/-1stride,1XP), boots(+1stride/-1range,1XP), optics(+1range/-2HP,2XP).
Mission definitions stay immutable; prepare applies once to fresh state.
Existing v1 saves migrate each validated completed mission into1XP and2supplies,
with no retroactive injuries. Schema/version/key remain compatible; malformed
rosters are bounded by contiguous validated completion count. Field preparation
shows effects and survives reload; mid-operation loadout changes are disabled.

Next content: Floodworks09SluiceLogic and10SpanControl, then visibility/blackout.
District consequences, persisted mastery medals and final campaign score remain.


## November 6 nightly expansion: Sluice Logic

Nine of twenty operations now exist across three of five districts (only the
first Floodworks operation is implemented). Sluice Logic is a distinct24x16
spillway: permanent water separates west controls from two east yards linked by
a narrow towpath. North drainage opens one three-tile crossing and allies the
turret; rescue the keeper before switching to south drainage, which floods the
north bed and returns turret control to the occupation. South drainage enables
the independent outlet circuit and southeast extraction. All living units must
be clear of the closing bed; every active engineer must remain connected to the
chosen control through candidate terrain. Rejected/stale orders spend no AP.
Water is impassable but transparent to fire and gives no cover. Dry-bed/water
markings and objective HUD use the same terrain state. Rescue interlocks enforce
the authored sequence; there is no timer or flooding damage mechanic.

Span Control, Blackout and Pump Siege remain planned, as do all Archive/Citadel
operations. FIRST PLAYABLE remains; no scope reduction or AAA completion claim.


## November 7 Span Control contract

Ten of twenty operations exist. Operation10 uses a26x18 river layout, a2x2
horizontal transfer span and fixed recall controls on both banks. Power allies
the east turret. Transport can precede rescue; a living rider reaching the east
berth records the crossing, while empty recalls do not. Rescue the east keeper
and capture the bridgehead with the span docked east, return it west to release
the mechanical lock, then ferry the remaining squad east through the opened gate.
A turn-five two-bank counterattack contests the return. Both sides can recall
the empty span; water is impassable and transparent, masonry remains opaque.
Previews revalidate dock, rescue, prior capture, hostile riders and destinations
without spending AP on rejection. Cargo Lift keeps its rescue-first semantics.
The span reuses tested rider transport; cross-bank return/capture is the new
objective combination. No automatic bridge timer or flooding damage is implied.

NEXT:11Blackout visibility/light infiltration,12PumpSiege, then Archive/Citadel.
District consequences, tracked mastery, final campaign score and ending remain.


## November 8 Blackout contract

Eleven of twenty operations exist. Operation11 is a24x18 pumping tunnel with
an always-open covered central avenue and switch-controlled southern bypass.
Work lamps expose targets within two authored Manhattan pools; lit targets can
be acquired anywhere along geometric sight, while shots still require weapon
range. In darkness both sides/turrets/overwatch only target within two tiles.
Unspotted patrols idle; no pursuit memory, sound, alarm or hidden enemy fog is
claimed. All silhouettes stay on the tactical plan. Interactions use geometric
LOS independently, preserving engineer three-tile signal upgrades.
Blackout turns lamps off, opens the bypass and allies the turret. Optional
relighting reverses those effects; safely connected squad required for reroute.
Rescue technician then capture Archive link with blackout active/lamps off,
extract north. Readonly light previews and stale confirmations share the rules.
Pump Siege, Archive, Citadel, consequences, tracked mastery, final campaign
score and ending remain required. FIRST PLAYABLE remains visible.


## November 10 Pump Siege contract

Twelve of twenty operations now exist; Floodworks is four of four. Operation12
is a24x18 twin-gallery defense separated from the lower keeper/extraction floor
by a spill channel with four narrow bridges. Independently hack west/east pumps;
west also allies the turret. Each needs a living engineer on or within cardinal
distance1 at the end of enemy attacks and lane damage for3consecutive end turns.
Missing power/staffing resets incomplete pressure to0; third cycle latches
permanently and scores500once. Downed/extracted engineers cannot staff pumps.
Turn4 two-gallery reinforcements contest the hold. Rescue keeper and regroup
southeast after stabilization. HUD/footprint markers share readonly pumpStatus;
queued extraction revalidates pressure. No unannounced flooding timer/damage.
Archive13-16 and Citadel17-20, district consequences, tracked mastery, final
campaign scoring and ending remain required. FIRST PLAYABLE stays visible.
