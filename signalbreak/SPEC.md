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
- [ ] Four squad roles with progression, equipment choices and injury recovery.
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
- [ ] 05 Rooftop Crossfire: elevation and alternate stairs.
- [ ] 06 Cargo Lift: powered moving-lift escort.
- [ ] 07 Open Clinic: medical-staff defense and coverage switching.
- [ ] 08 Antenna Rain: tower raid and alternating overwatch lanes.
- [ ] 09 Sluice Logic: water diversion changes routes.
- [ ] 10 Span Control: moving bridge capture.
- [ ] 11 Blackout: light/visibility infiltration.
- [ ] 12 Pump Siege: simultaneous pumps and reinforcements.
- [ ] 13 Paper Trail: evidence recovery before purge.
- [ ] 14 Two Keys: synchronized split-squad access.
- [ ] 15 Ghost Broadcast: decoy transmission redirects patrols.
- [ ] 16 Stolen Convoy: transport interception preserves evidence.
- [ ] 17 Outer Relay: network siege approaches.
- [ ] 18 Vertical Breach: floors and lifts.
- [ ] 19 Safe Corridor: defend/evacuate civilians.
- [ ] 20 Signalbreak: combined core shutdown and consequence-based epilogue.

Mission-boundary local saves, sequential unlocks and replay best scores now exist
for the four implemented missions. These do not satisfy squad progression,
equipment/injury recovery or persistent rescue/evidence consequences. Authored
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
| assets/js/campaign.js | lead: validated mission-boundary save/unlock/replay records |
| SPEC.md, TESTING.md, PROGRESS.md | lead: contract/evidence/handoff |
| ../__tests__/signalbreak.test.js | lead: deterministic rule and mission checks |
| ../tools/signalbreak-browser-smoke.cjs | lead: real-browser/input proof |
| ../tools/signalbreak-route.cjs | lead: deterministic legal-order QA planner, no state injection |

## First-playable API contract

Grid coordinates integer (x,y), origin top left. Tiles: . floor, # tall blocker,
c low cover, d circuit door, e exit, n network node, r rescue. Heights are separate.
No procedural randomness required; identical state/action gives identical outcome.

SB.Missions.operations contains the four authored missions, get(id) looks up an
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

Campaign saves use signalbreak-campaign-v1 in localStorage, validate contiguous
completed operations, and persist only mission-boundary selected/unlocked/best
records. No in-operation resume: reload restarts the selected operation. Storage
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
