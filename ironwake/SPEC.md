# Ironwake — The Coast Campaign

Human feedback September 9: the city-block demo is too small. Build a larger
campaign with a story, multiple environments, exploration and additional mechanics.
This supersedes the one-block milestone. Combat and directed demolition remain core.

## Implemented campaign

1. Breakwater: occupied harbor, blockade, evacuation locks, coastal battery, escape.
2. The Drowned Ward: flooded neighborhoods, two pump stations, hunters, rail escape.
3. Glassline: desert rail works, artillery ridge, prisoner train, armored engine, junction.
4. Cinder Works: reactor couplings, forty-second uplink defense with three counterattacks.
5. Sovereign: two shield approaches, walking fortress with three phases, final rescue.

Twenty objectives across maps 200–270 world units wide (the demo was 72).
Mara Venn pilots the stolen mech; Orla coordinates the evacuation; Ivo sabotages
the fortress from inside. Briefings, objective radio, optional archives, and debriefs
carry the story through an ending. No arbitrary mission time limit.

## Gameplay

- Cannon, ripped heavy gun, ripped artillery railgun; heat and stationary venting.
- Aimed punches topple buildings. Rubble retains matching collision and blocks fire.
- Boost: 0.32-second burst, 4-second cooldown, brief damage immunity, solid collision.
- Hold F / INTERACT near an uncontested objective; defend the uplink inside its radius.
- Tanks, escort mechs, rushing hunters, telegraphed artillery, moving fortress.
- Water slows movement and cools the reactor; furnace vents damage armor.
- Optional repair, capacitor, and story-archive caches.
- Choose hull, cooling, or damage upgrade after each of the first four chapters.
- Local checkpoint saves at chapter boundaries and completed debriefs, including
  pending upgrade selection. Death retries the current chapter with its installed
  upgrades and incoming campaign score. No mid-combat save.
- Tactical map pauses combat. Blur/hidden tab also pauses; returning requires Resume.

## Files and shared API

`logic.js` retains the original deterministic one-block simulation API for regression
coverage: IW.createState(seed), IW.start(state), IW.step(state,input,dt).
It adds campaign hooks, per-state bounds, boost, railgun and damage modifiers.

`campaign.js`, loaded after logic.js, defines IW.CAMPAIGN, IW.createCampaignState(index,
upgrades,totals), IW.advance(state,upgrade), IW.campaignSave(state), and
IW.restoreCampaign(save). Campaign state adds chapter, biome, bounds, stage,
objectives, hazards, strikes, pickups, radio, upgrades and totals. Target membership
for elimination objectives is fixed at deployment; luring an enemy away cannot
complete an objective. Campaign update runs through the same combat simulation.

`render.js` is a Three.js projection of simulation state; it never mutates gameplay.
World geometry rebuilds when the buildings array changes and releases prior mission
resources. Rendering follows the player across large maps. Camera and shadow targets
follow together. Terrain, landmarks, architecture, hazards and fortress vary by chapter.

`main.js`, index.html and game.css own controls, HUD, briefings, map, saves, upgrade
selection, audio and explicit leaderboard submission. Touch has simultaneous MOVE,
FIRE, PUNCH, RIP, VENT, BOOST and INTERACT. Keyboard uses WASD/arrows, mouse,
E/right-click, Q, Space, Shift, F, and Tab/Escape for map/pause.

Touch FIRE doubles as a directional aim control: hold and drag from the press
point while moving with the other thumb. A 12px deadzone preserves the previous
aim on a simple press. Dragged aim follows the mech while moving and remains
until a new aim gesture; battlefield taps still provide precise aiming for
shots and punches. Cancel, pause, blur, resize and retry reset held input.

Three.js and its MIT license remain vendored. No external runtime asset requests.
Only the lead runs Git. Work stays on dev; no main release or AAA completion claim.

## Verification

- Existing demolition regression tests plus campaign mechanics/progression tests.
- `tools/campaign-playthrough.cjs`: deterministic complete campaign using legal
  simulation inputs; reads state for path planning. No health/position cheats.
- `tools/native-campaign.cjs`: state-informed pilot using actual browser keyboard and
  mouse, real clock, no simulation fast-forward. Browser evidence is separate from
  simulation proof and cannot establish human enjoyment.
- `tools/smoke.cjs`: six viewports, opening keyboard crush, simultaneous native touch,
  buttons, HUD, results, mock leaderboard, pause, upgrade and save reload fixtures.
- Inspect actual gameplay, chapter transition and environment screenshots.

## Nightly file ownership

| Role | Single owned file |
| --- | --- |
| Controls builder | assets/js/main.js |
| Controls regression builder | tools/touch-controls.cjs |
| Independent gameplay/control critic | Read-only; no game files |
| Lead integration | All other files, documentation and Git |

Builders must report cross-file needs to the lead. Critic remains independent.
