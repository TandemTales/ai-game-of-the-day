# PRISM WARDEN — The Drowned Beacons

## Concept and acceptance boundary

A top-down action adventure with the classic item-and-dungeon foundation, new IP,
and a mirror shield shared by combat and optical architecture. Keeper Sera carries
the last sun prism to five drowned beacons. Radio operator Ilex wants to relight
the crown; former keeper Nacre reveals why the eclipse engine must be redirected,
not merely destroyed. The ending restores safe channels and releases its keepers.
Numeric score rewards resolved encounters, returned shots, rescues and discoveries;
no grinding respawns or passive score. HTTP static site, local assets, no runtime
third-party dependencies; leaderboard uses the existing arcade endpoints.

## First playable — September 20 checkpoint ONLY

One authored Tidal Abbey courtyard. Catch the horizontal sunbeam with a raised
shield and aim it at the north receiver to latch open the gate. An optional side
receiver restores the sanctuary and changes the retreat choice. A sentinel fires
telegraphed projectiles: reflect them back to break its armor, then close for a
sword punish. A locked, unblockable lunge follows each hit or missed opening. Dodge avoids a committed attack but has a
cooldown. Free the keeper beyond the guardian for an explicit first-playable ending.
It must support independent move/aim on keyboard/mouse and simultaneous touch,
pause on focus loss, restart, score/results and explicit leaderboard submission.
Only implemented mechanics may be advertised in player-facing text.

## Complete-game acceptance: all five regions and 25 meaningful challenges

Each numbered item must be an authored encounter with a distinct spatial/mechanical
problem. A switch, renamed room, repeated wave or larger map is not enough. Major
regions contain connected traversable rooms, persistent shortcuts and optional
routes, not a menu selecting 25 copies of the prototype arena.

| Region | Five major challenges | New interaction / guardian / optional content |
| --- | --- | --- |
| 1 Tidal Abbey | A1 redirect under guard fire; A2 sluice crossing with rising-water cover; A3 escort Ilex through shutter corridors; A4 split the bell-tower light route; A5 duel the Bell Diver on changing dry ground | Mirror shield; water changes safe routes and beam access. Optional sanctuary shortcut; keeper chart exposes guardian armor route. |
| 2 Verdant Aqueduct | B1 carry a prism across root bridges; B2 cut growth while sustaining irrigation; B3 flank seed mortars via rotating channels; B4 rescue trapped ferrymen through a water-routing choice; B5 turn the Root Hart's charge into broken dams | Placeable prism retains a beam while you move. Optional ferryman ferry shortcut; seed lens opens a noncombat boss opening. |
| 3 Glass Kiln | C1 alternating furnace safe lanes; C2 anneal a bridge with controlled heat; C3 escort a cooling cart through crossfire; C4 route competing hot/cold beams through foundry locks; C5 Glass Weaver breaks and rebuilds arena cover | Heat changes glass solidity; lens polarity. Optional quench valve removes one late hazard; artisan yields a distinct weapon attachment. |
| 4 Night Observatory | D1 navigate by briefly revealed star paths; D2 align moving shutters under sniper pressure; D3 redirect a pursuing shade through split light; D4 defend Ilex while rotating telescope bridges; D5 fight the star twins with mutually shielding beams | Stored light burst and darkness navigation; mobile/linked targets. Optional sky chart gives finale route; liberated shade disables one crown sentry. |
| 5 Drowned Crown | E1 reveal the gulf crossing and open the descent seal; E2 redirect paired beams through opposed timed shutters and changing heat lanes; E3 traverse the switchback shoals through alternating high/low tides, use rising stones for cover, and return the Crown sentinel's volley; E4 turn the lighthouse to reveal two star spans; E5 return Crown artillery, expose the Keeper at a changing floor transition, interrupt its final pulse with stored light, then free Nacre and evacuate Ilex | Nacre remains captive until E5; the optional Keeper Archive opens a protected E3 recharge alcove and changes the final dialogue. E5's last beacon is gated on both rescue/evacuation flags. |

Progression: after each of regions1–4 choose one of two mutually exclusive mods
with behavioral tradeoffs (mobile reflection vs wide guard; recoverable thrown
blade vs heavy close strike; prism recall vs second placement; burst stun vs burst
bridge duration). Regions unlock tools in a fixed order so every branch remains
solvable. Checkpoint save includes secured score, region, inventory, chosen mods,
rescues and discoveries. Retry rolls back only current region. Ending/new campaign
is explicit; chapter replay has no duplicate cumulative score exploit.

Exploration/replay: ten optional authored discoveries listed above with concrete
route/encounter/ending effects, not score-only pickups. Score cannot be farmed from
idle, repeated switches or unbounded returned shots. Full story: rescue Ilex,
reveal Nacre's failing containment, choose how to restore light, save both keepers
and finish an evacuation. Choice consequences must be visible in later encounters.

Ironwake floor: 5 connected regions >=5 chapters;25 challenges >=20 objectives;
5 guardians plus 3-phase climax;3 evolving traversal tools plus mirror/sword/dodge;
4 behavioral equipment decisions;10 consequential optional routes;characters,
checkpointed story and ending. These are promises, not completion credit. AAA
requires whole-game independent play and blind reference comparisons. Prior human
Orbit Orchard boredom and Ironwake depth complaints inform a stricter fun gate;
passing tests and content counts cannot clear it.

## Dependency-ordered schedule (verified saved routine: Sat/Sun 09:00 Pacific)

- Sep20 (today): scaffold core encounter, contracts, controls, tests. Slice only.
- Sep22–25 (completed first pass): authored connected regions1–4 and Region5's
  six rooms, stored light and Crown boss/rescue logic. Region5 has focused logic,
  route and rendering checks, but no full legal-input route yet.
- Sep26–27 (next expansion): prove and repair legal routes through E1–E5; build the
  four behavioral equipment choices, persistent campaign saves, consequential
  discoveries and full story/finale/ending; then play keyboard/touch and run the
  independent scope/fun rejection. Beginning-to-ending must exist before whole-game
  polish. This is the last scheduled build: do not assume weekdays.
- Oct3 (Saturday, age13): forced release wrap-up/tests/six sizes only. Record any
  missing scope as ambition failure; do not start new polish or redefine contract.

Schedule is aggressive with only two expansion runs. Build complete functional
content first, record unfinished dependencies honestly, and resume automatically.
If expansion overruns Sep27, dedicated polish is missed debt, not a scope cut.

## File ownership and stable simulation/render API

Only lead runs Git. Builders own exactly one file; ask lead for cross-file changes.

| Role | Single owned file |
| --- | --- |
| Simulation builder | assets/js/logic.js |
| Renderer builder | assets/js/render.js |
| Campaign content builder | assets/js/regions.js |
| Audio builder | assets/js/audio.js (PW.Audio: enable(bool), update(state,dt); reads state only) |
| Independent gameplay/presentation critic | read-only; evidence under ignored node_modules/.cache/prism-warden |
| Lead integration | main.js, HTML, CSS, tests, docs, tools and Git |

Classic scripts: regions.js -> logic.js -> render.js -> audio.js -> main.js. Global window.PW.
Logic exports PW.create(), PW.step(state,input,dt), PW.raySegment(x,y,dx,dy,rects,max).
step uses dt seconds capped1/30. Main runs fixed1/60; no Math.random in simulation.
Input {mx,my,ax,ay,reflect,slash,dash}; move and aim unit vectors; slash/dash edge.
create returns status:'ready'; main sets 'playing' on explicit Begin.
World 1024x768, player start(190,540), radius14. State fields:
status, time, score, player:{x,y,hp,maxHp,aimX,aimY,reflecting,slashTime,dashTime,
dashCooldown,invulnerable}, walls:[{x,y,w,h}], gates:[{x,y,w,h,open}],
emitter:{x:70,y:340,dx:1,dy:0}, receivers:[{id,x,y,r,charge,active}],
beams:[{x1,y1,x2,y2,kind:'sun'|'reflected'}],
enemies:[{id,x,y,hp,maxHp,phase,timer,exposed}],
shots:[{x,y,vx,vy,friendly}], particles:[{x,y,life,kind}],
rescue:{x,y,freed}, sanctuary:boolean, hits, returns, message.
Receiver id 'gate' at(550,115); 'sanctuary' at(280,620).
Gate across upper-right courtyard {x:700,y:80,w:24,h:260}; guardian(845,245),
rescue(914,150). Walls form bounds and tactical cover; do not block beam-to-receiver
path from(550,340) to(550,115). Guardian cannot be killed through closed gate.
Sun beam stops at player while reflecting within18 units, outputs aim direction;
receiver latches after1.2 continuous seconds, decays when unlit. Sanctuary once
heals and grants discovery points. Returning a shot requires shield facing its
incoming direction; friendly shot exposes guardian for3.4s but does not damage health; sword deals2 of6 HP once per opening. Each strike closes armor and triggers a .9s locked lunge warning, .34s450px/s charge, then1.05s recovery. Unreflected volleys and expired exposure also trigger lunges. Guard cannot block body contact; dodge or sidestep.
Use clear telegraph/attack/recover phases, hit grace, fair retry and win state.
Renderer PW.draw(ctx,state,width,height,dpr) owns only rendering, never mutates
simulation. PW.view(state,width,height) -> {x,y,w,h,scale}; PW.screenToWorld(state,
width,height,x,y) handles camera. Camera follows player with clamped world bounds,
portrait shows nearby arena plus world-edge arrows to objectives. Screen coords
are CSS pixels, main handles backing-store DPR, draw handles scaling internally.

## Distinctness against every existing game

Ironwake: deliberate handheld optics/exploration versus mech demolition. Stormhook:
no grapple/momentum platforming. Zephyr: no racing. Paradox Vault: no recorded
echoes/time loops; live aimed action and persistent traversal. Lumen Pinnacle:
no ball/flippers. Bayou Brawlers: exploration and spatial optical combat rather
than scrolling combos. Crimson Descent: grounded combat rather than landing.
Midnight Menagerie: real-time optical combat rather than turn-based deck-building.
Emberfall: persistent authored regions, no arena wave survival. Core Crisis:
exploration and redirected enemy fire, no stationary core defense. Nova Striker:
no scrolling bullet-hell flight. Bastion Builder: direct character control, no
auto-battler. Aurora: no tower/path construction. Neon Brick Breaker: directly
aimed mirror on mobile character, no bouncing-ball paddle game. Hidden absent
Ocean Explorer: perilous combat/optical architecture rather than underwater
collection; Memory Match: real-time spatial action, no card matching. Cancelled
Orbit Orchard: authored skill gates and enemy patterns, no passive growth loop.

## Region 1 room engine contract (Sep22, authoritative for logic/regions/render)

Tidal Abbey becomes five connected rooms plus the optional sanctuary. Every room is
1024x768 world units (room.w/h carried for later regions). Rooms are authored data
in regions.js (`PW.ROOMS[id]`, `PW.roomDef(id)`); logic.js deep-copies a def on
first entry and keeps dynamic state in `s.roomStates[id]` when you leave, so
opened gates, jammed/destroyed enemies, collected pickups and lit receivers persist
(persistent shortcuts). Re-entry restores that state; never duplicates score.

Room def fields (all arrays optional, default empty):
`id, region:'tidal-abbey', challenge:'A1'..'A5'|null, name, w:1024, h:768, intro,
spawn:{x,y}, walls:[{x,y,w,h}],
gates:[{id,x,y,w,h,opensWhen:{receivers:[ids]}|{defeated:[enemyIds]}|{flag:name}}],
emitters:[{id,x,y,dx,dy}], receivers:[{id,x,y,r,kind:'seal'|'sanctuary'|'bell'}],
mirrors:[{id,x,y,r:16,split:false,dirs:[[dx,dy],..],index:0}]` - a beam touching a
mirror circle leaves along dirs[index] (split:false) or along EVERY dir (split:true);
a player slash within 70 units cycles index of a non-split mirror. Max beam depth 8.
`water:[{id,x,y,w,h,when:'high'|'low'}]` deep water when tide state matches: not
solid; player/escort wade at 45% speed and take 1 damage per 1.4s; never blocks beams
or shots. `breakwaters:[{id,x,y,w,h,when}]` stone that rises when tide state matches:
solid for movement, shots and beams; it will not rise while a body overlaps it.
`tide:{period,offset}|null` -> runtime `s.tide={level:0..1,high:bool,warning:0..1}`;
level=.5-.5cos(2pi(t+offset)/period), high when level>.5, warning ramps over the
1.5s before a change. `shutters:[{id,x,y,w,h,period,openFor,offset}]` solid for
everything while closed; will not close on a body. Runtime adds `.open` and `.phase`.
`enemies:[{type:'sentinel'|'turret'|'diver',id,x,y,...}]`:
- sentinel: the courtyard duel (return shot -> exposed 3.4s, slash 2 dmg, locked
  lunge), params hp, wakeRadius, wakeWhen gate id (dormant until that gate opens).
- turret: stationary and invulnerable. Telegraph 1.0s, then a 3-shot volley at its
  target (`targets:'player'|'escort'|'nearest'`), `interval` seconds between volleys.
  A returned shot jams it for 5s (score +50 only on its first jam). `until: gateId`
  silences it permanently once that gate opens.
- diver (Bell Diver, A5 boss): hp 10. Submerged (invulnerable, moves as a shadow)
  while tide is high; at low tide surfaces near the player on dry ground with a 0.8s
  telegraph then an expanding shockwave ring (radius to 150; dash or distance avoids),
  then bell volleys (5-shot fan; below half hp also an 8-way radial ring). Returned
  shot exposes 3s (4.5s with the keeper chart flag); slash deals 2. Dives again when
  the tide rises. Defeat lights the beacon.
`escort:{x,y,hp:4,path:[[x,y],...]}` Ilex walks waypoints at 120/s only while the
player is within 220 units and the next segment is not blocked by a closed shutter
or solid; enemy shots can hit her; hp 0 = loss. `escortExit:{x,y,w,h}`.
`rescue:{x,y,requires:[enemyIds]}`, `sanctuary:{x,y,r,receiver}` (heal circle while
its receiver is lit), `pickups:[{id,kind:'chart'|'heart',x,y,text}]` (chart sets
flags.chart; heart +1 maxHp), `beacon:{x,y,requires:[enemyIds]}` (reaching it after
the requirement completes the region: status 'won').
`exits:[{x,y,w,h,to,spawn:{x,y}}]` - touching an exit rect enters room `to` at
spawn. Exits sit beyond gates so gating is physical.

Runtime state keeps every existing courtyard field and adds: `regionId, roomId,
room:{id,name,challenge,w,h}, emitters, mirrors, water, breakwaters, shutters,
tide, escort, pickups, exits, beacon, flags:{}, cleared:{A1..}, visited:[],
roomStates:{}, objective, transition` (0..1 fade after entering a room, renderer only).
`s.emitter` aliases emitters[0] (or null); `s.rescue`, `s.sanctuary` stay.
Exports: `PW.create()` starts in 'cloister'; `PW.step`; `PW.raySegment`;
`PW.enterRoom(s,id,spawn)`; `PW.retryRoom(s)` restores the snapshot taken on room
entry (hp refilled to max at entry snapshot, score back to entry value). Loss
sets status 'lost'; main offers Retry room or Restart region.
Beams: `s.beams[{x1,y1,x2,y2,kind:'sun'|'reflected'|'split'}]`; any non-sun
segment lights receivers. Deterministic, no Math.random, dt capped 1/30.

Rooms: A1 cloister (courtyard redirect while a turret fires, then sentinel duel,
free Ilex) -> A2 sluice (tidal crossing: water lanes vs rising breakwater cover
under turret fire, light the sluice seal) -> [optional sanctuary: heal circle,
keeper chart, heart; shortcut to bell tower] -> A3 shutters (escort Ilex through
timed shutters, turrets target her) -> A4 bell tower (splitter plus slash-rotated
mirrors must light two bells at once; a sentinel verger patrols) -> A5 beacon
(Bell Diver on tide-changing dry ground; reach beacon = region complete).

## Region 2 engine contract (Sep22 evening, authoritative for logic/regions/render/audio)

Region 2 Verdant Aqueduct follows the Abbey beacon. All Region 1 fields and
behaviour stay unchanged; everything below is additive. Room ids are globally
unique: spillway (B1), roots (B2), channels (B3), quay (B4), reservoir (B5),
ferry (optional). regions.js may rename rooms in the manifest to match.

Region flow: a beacon def may carry `next:{room,spawn}`. Reaching such a beacon
sets `s.status='cleared'` (region complete, not game over) and `s.next`.
`PW.continueRegion(s)` enters `next.room`, sets status 'playing' and stores a
region checkpoint (`s._regionEntry`). `PW.restartRegion(s)` restores that
checkpoint (or `PW.create()` state when none). A beacon without `next` still
sets 'won' (final region built so far). `s.cleared` has keys for every
challenge of every region in PW.REGIONS. Region id comes from `room.region`.

Placeable prism (tool): pickup `kind:'prism'` sets `s.player.prism='carried'` and
`flags.prism`. New input edge `place` (key Q / touch PRISM). Carried -> placed at
player + aim*34 if that spot is inside the room, clear of solids and not in active
water or on a bridge (else message "The prism needs dry, open ground").
The placed prism is a mirror `{id:'prism', portable:true, r:14, split:false,
dirs: 8 compass unit vectors clockwise from east, index: nearest to aim}`
appended to `s.mirrors`; slash rotates it 45 degrees like any rotatable mirror.
Its outgoing beam kind is 'prism' (lights receivers; renderer tints it).
`place` within 80 of the placed prism picks it back up; farther away shows
"Walk back to lift the prism". Leaving a room returns a placed prism to the
satchel (removed from that room's saved state). `player.prism` is null |
'carried' | 'placed'; `s.prismRoom` names the room holding it.

Hold gates: gate `hold:true` is open exactly while `opensWhen` is met, but never
closes on a body (stays open, `held:true`, until clear). Text only on first open.
Non-latching receivers already exist (`latch:false`).

Fill receivers: receiver `fill:<seconds>` (kind 'pump'): charge rises dt/fill
while lit and never decays; latches active at 1.

Conditional environment: every water/breakwater `when` may also be
'always' | 'cycle' (rect fields `period,onFor,offset`: active during the first
onFor seconds of each period; runtime `flipIn` seconds to next change) |
`{flag:'x'}` | `{notFlag:'y'}` | `{flag:'x',notFlag:'y'}` (flags on s.flags).

Root bridges: `bridges:[{id,x,y,w,h,hold:1.0,recover:2.5}]` walkable decks that
cancel water beneath them. A body centred on an unsunk bridge is dry. Load builds
while any body stands on it; at `hold` seconds it sinks (`sunk:true`, water
beneath now counts) and recovers after `recover` seconds with nobody on it.
Runtime `load` 0..1, `sunk`, `timer`. Never blocks movement, beams or shots.

Growth: `growth:[{id,x,y,w,h,regrow:5}]` brambles solid to movement, beams and
shots while `alive`. A slash with the player within 56 units of the rect cuts it
(`alive:false`, `timer=regrow`); it regrows when timer ends unless a body
overlaps (`held`). `regrow:0` never regrows. Runtime `alive,timer,held`. No score.

Levers: `levers:[{id,x,y,flag,text}]` one-way: slash within 60 sets
`flags[flag]=true`, `pulled:true`, announces text, +50 once.

Rescue generalised: rescue def may add `flag:'ferrymen'` (default 'ilex') and
`requiresFlag:'x'`; `completes` still ends the game when true.

Dams: `dams:[{id,x,y,w,h,hp:2}]` timber dams, solid to everything while hp>0.
Only a charging Root Hart damages them (1 per charge); at 0 they break,
`broken:true`, `flags['dam:'+id]=true` (use for water `when:{flag}` floods).

Mortar enemy `{type:'mortar',id,x,y,r:20,facing:[dx,dy],hp:2,interval:2.8,
delay,range:560}`: armoured bark plate faces `facing`. While player within range:
idle -> telegraph .5s -> lob a seed at the player's position then:
`s.lobs:[{x0,y0,tx,ty,t,flight:1.1,r:46,owner}]` lands after flight; a landing
within r (+player.r) hurts unless dodging. Lobs arc: walls do not stop them.
Slash from behind/side (dot(unit(player-mortar),facing) < .3) deals 1; a frontal
slash clangs. Returned shots do nothing. Defeat +200. Counts for `defeated`.

Root Hart `{type:'hart',id,x,y,r:34,hp:8}` (B5 guardian): dormant until the
player is within 420 -> stalk (walk toward player 60/s, 1.3s; 1.0s below half hp)
-> aim .9s (tracks, locks for final .35s; runtime aimX/aimY, locked) -> charge
540/s along aim for up to 1.3s. A charge ends on first contact with a solid: an
intact dam takes 1 damage and the hart is stunned/exposed 3.2s (4.5s with
flags.lens); any other solid gives a .9s daze with no exposure unless no intact
dam remains (then 2.4s exposed, so it can never soft-lock). Contact during
charge hurts. Exposed slash deals 2 then 'recover' .6s. Below half hp, each
recover ends with a 5-seed reflectable fan; a returned seed staggers .8s.
Defeat +900 and lights the beacon.

Renderer needs: region palette for all six Region 2 rooms; portable prism
(distinct from bronze mirrors, shows aim notch); 'prism' beam colour; pump
receiver with fill ring; bridges (sag with load, sunk state); growth (alive,
regrowing warning when timer<1, stump when cut); levers; dams (hp 2 cracked, 1,
broken rubble); mortar with facing plate + lob arcs and landing reticles;
Root Hart with aim lane telegraph, charge streak, stunned/exposed state.
Audio needs: Region 2 room songs and cues for prism place/lift, bramble cut,
lever, mortar lob/land, hart charge/impact, dam break, region cleared.

## Region 3 engine contract (Sep23, additive to Regions 1-2)

The Glass Kiln is a connected five-room chapter following the Verdant Aqueduct: `furnace` (C1), `bridge` (C2), `rail` (C3), `foundry` (C4), and `weaver` (C5), plus the optional `quench` route. Reservoir continuation enters `furnace`; each challenge exit reaches the next room. C5 clears the built chapter only; until Regions 4-5 exist, the UI and docs must not claim the full campaign or ending is complete. Existing room persistence, retry, scoring and deterministic simulation contracts stay in force.

A room may define `thermal:{period,hotFor,offset}`. Logic derives `s.thermal={hot,phase,flipIn}` deterministically from room time; a retry resets to the room snapshot. Optional `glass:[{id,x,y,w,h,mode,when}]` objects use `mode:'solid'|'hazard'|'bridge'` and `when:'hot'|'cold'`. Logic exposes each object's current `active` state. Active solids block movement and optical/projectile paths; active hazards apply bounded, telegraphed damage; active bridges cancel underlying water for a body on the span and never block movement or rays. Renderer distinguishes molten hazard glass, cover and annealed walkways, and retains a readout of the current phase and next change. Kiln floors use the bundled `assets/img/kiln-basalt-glass.webp` over deterministic procedural platework; it is a local-only visual treatment with a procedural fallback when image loading is unavailable or fails. Other game art and all audio remain procedural; no runtime third-party asset or font requests are allowed.

C1 alternates timed furnace lanes; C2 makes an annealed bridge crossing; C3 escorts a cooling cart through furnace hazards; C4 routes beams through competing hot/cold foundry locks; C5 uses the Glass Weaver's telegraphed alternating three-shot volley and five parallel glass-thread curtain, with the center thread reflectable and a recovery window for returned-shot exposure and close strikes. The dedicated pattern is C5-only; ordinary sentinels retain their existing combat controller. The optional quench valve opens a route to C2's far bank; its pickup currently sets only a generic discovery flag and does not grant a distinct combat behavior. Player-facing wording must describe only working mechanics. Completing C5 ends this chapter, not the full campaign; Regions 4-5, equipment progression and the ending remain unbuilt.

## Region 4 implemented contract — September25 expansion

Night Observatory follows the Weaver beacon: stars (D1), obs-shutters (D2),
shade (D3), telescope (D4), twins (D5). obs-chart and shade-vault are optional
reciprocal detours. The twin beacon continues into the Drowned Crown; it does not
end the campaign.

Stored-light pickup sets flags['stored-light'] and player.lightCharge=1. R / BURST
spends a full charge, exposes nearby shades or a linked twin pair, and reveals
starPaths for six seconds. Wells and catching beams recharge in two seconds.
Inactive paths hide their internal route; bank edges remain visible. Unsupported
void crossings return to the last permanent landing with bounded damage. Telescope
paths use alignTo:{mirror,index}; slash rotates the instrument, occupied spans hold
until their passengers leave, and Ilex waits before unsupported gaps. Room state
and retry snapshots include these mechanics; snapshots remain in memory only.

D2 shutters alternate optical windows under committed sniper fire. D3's pursuing
shade has a locked dash and can be exposed by split light or a burst; exposure
must be followed by a sword strike. D5 twins orbit and shield one another; burst
interrupts the body/link, while a surviving orphan can also be opened by returned
fire. Burst alone deals no damage or score. Optional chart and keeper rescue each
open a different protected recharge refuge in D5. Beyond the current archive/well
and refuge effects, their promised consequences remain incomplete. D4 snipers
forecast Ilex's movement at aim lock; the east-bank shot
lane makes shielding consequential, but a naive full-health route still survives
with damage, so the independent defense-depth objection remains unresolved.

The Drowned Crown now has a first authored pass, but its E1–E5 rooms have no full
legal-input route evidence yet. Four mutually exclusive equipment decisions,
persistent campaign saves, the promised polarity/loadout behaviors, the full
optional-discovery consequences, and the actual ending remain acceptance gaps. The
original complete-game contract above is unchanged. Prove the campaign and build
those gaps before standalone art polish. September26/27 remain available scheduled
expansion runs; October3 is wrap-up and forced release.

## Region 5 first authored contract — September26

The Night Observatory's D5 beacon enters Drowned Crown E1 (`descent`), followed by
E2 `galleries`, E3 `circuit` (displayed as Switchback Shoal), E4 `lighthouse`, and
E5 `crown`; the optional `archive` loops from E2 back to E3. E1 reveals a stored-
light star span to the descent seal. E2 latches two separate beam receivers across
opposed shutters. E3 instead crosses four alternating high/low tide shoals, uses
cycle-raised breakwaters as cover, and opens its lighthouse stair by defeating the
Crown sentinel. It no longer releases Nacre; the Keeper holds her until E5. The
optional Archive opens an E3 recharge alcove and sets its finale dialogue flag.
E4 reveals one aligned star span at a time and requires both sides of the lighthouse
axis. In E5, only a returned shot from the named Crown artillery opens phase one;
phase two needs both live circuits at a cycle-floor change; phase three needs a
close stored-light interrupt. Defeating the Keeper opens Nacre's cage. The final
beacon requires both Nacre's rescue and Ilex's evacuation flag.

The four-turn Shoal has a direct PW simulation traversal and the Crown fixture
tests cover graph links, boss phase conditions and final-gate state. These checks
are not a normal-clock, legal-input E1–E5 campaign run, nor evidence of player
discovery, pacing, completion, or AAA acceptance. Revalidate the shoal route under
ordinary tide timing and demonstrate the full chapter before treating authored
data as playable.
