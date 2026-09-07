# Ironwake — first playable contract

Combat-first 3D mech demolition selected by the human. The intended full game
has three dense districts and a moving fortress boss. Today's vertical slice
is ONE city block: fight, manage heat, rip a gun from a disabled escort, and aim
a building collapse into the convoy. No farming/salvage chores. Leaderboard score
rewards convoy kills, collapse kills and surviving the mission.

## Ownership (only the lead runs Git)

| File | Owner | Responsibility |
| --- | --- | --- |
| assets/js/logic.js | physics builder | Pure deterministic simulation, combat, collapse, enemies, heat, victory |
| assets/js/render.js | renderer builder | Three.js scene, art, animation, camera, ground picking |
| assets/js/main.js | lead | Input, HUD, lifecycle, audio, leaderboard |
| index.html | lead | Shell and accessible controls |
| assets/css/game.css | lead | Responsive full-screen play layout |
| tools/smoke.cjs | lead | Browser evidence / real input |
| __tests__/ironwake.test.js (root) | lead | Mechanics and reproducibility |
| SPEC.md / TESTING.md / PROGRESS.md | lead | Integration and honest handoff |

## Shared API — agree changes with lead

logic.js is classic script exposing globalThis.IW, no DOM dependencies:
IW.createState(seed=7), IW.start(state), IW.step(state,input,dt).
State: seed,status ('ready','playing','won','lost'),time,timeLeft,score,kills,
collapseKills, message, player, buildings[], enemies[], projectiles[], effects[].
Player: x,z,angle,hp,heat,overheated,weapon ('cannon' or 'heavy'), fireCooldown,
punchCooldown. All X/Z positions are world coordinates, Y is height.
Input: moveX,moveZ (-1..1), aimX,aimZ (absolute world point), fire,punch,vent,rip.
Held action booleans repeat only after simulation cooldown; dt capped .05.
Building: id,x,z,w,d,h,hp,maxHp,status ('standing','falling','rubble'),
fallX,fallZ,fallProgress (0..1), color optional. Collapse direction follows
the final destabilizing attack's direction. Ground footprint damage/collision
must follow the animated fall, not instant arbitrary radial damage.
Enemy: id,type ('tank','escort'),x,z,hp,maxHp,angle,alive,disabled,weaponTaken,
cooldown. Tanks are convoy objective, escorts shoot back and yield a heavy gun.
Projectile: id,x,z,y,vx,vz,owner,life. Effects: id,type,x,z,life,maxLife.
Renderer may use optional fields with defaults. Logic agent documents additions.

render.js ES module imports './vendor/three.module.min.js', exports
createRenderer(canvas) returning {render(state,dt),resize(),pick(clientX,clientY),dispose()}.
pick returns world {x,z} via ground raycast. Render a readable stylized industrial
city with heavy articulated mech, roads, striped supports, directional collapse
preview, convoy/tanks, muzzle/projectile effects and convincing tower fall.
Camera elevated 3/4 follow with generous forward framing, no orbit-control UI.
The world includes road at z=-6, tanks travel along x; towers near road.
Renderer derives visuals solely from simulation and never mutates gameplay.

## Controls and fairness

WASD/arrows move in world X/Z screen-aligned where practical; mouse aims,
left click fires, right click or E punches, Q rips a nearby disabled escort's
gun, Space vents (stationary/vulnerable). Touch left stick moves; tap field aims;
separate 44px+ FIRE/PUNCH/RIP/VENT controls support simultaneous steering.
Show health/heat/convoy objective, overheat and stolen-weapon state. Start/retry,
win/loss, score/rank/submit and Back to Arcade must work. Full mission timer.
No third-party runtime fetches; Three.js and MIT license vendored from existing
repo. Deterministic collision/mechanics, capped DPR and geometry/effect lifetime.

## Distinctness inventory

| Existing game | Genre | Ironwake distinction |
| --- | --- | --- |
| Stormhook | grapple platformer | 3D vehicle combat and structural demolition, no rope |
| Zephyr Circuit | kart racing | combat/destruction objectives, no laps |
| Paradox Vault | time-loop stealth | direct mech assault, no loops |
| Bayou Brawlers | scrolling brawler | 3D city geometry, ranged combat and aimed structural collapse |
| Crimson Descent | lander descent | ground mech tactics, no lander |
| Emberfall Gauntlet / Midnight Menagerie | wave action | authored convoy interception and demolition |
| Core Crisis / Nova Striker | arena shooters | destructible 3D cover and falling-tower attacks |
| Bastion Builder | base building | pilot a mech, no construction |
| Aurora Tower Defense | tower defense | mobile assault, no placed defenses |
| Neon Brick Breaker | brick breaker | direct mech control, no ball/paddle |
| Lumen Pinnacle | pinball | directed attack/collapse rather than table physics |
| Ocean Explorer | exploration | authored combat objective |
| Memory Match | card memory | real-time spatial action |

## Acceptance

First playable must demonstrate normal-input combat, incoming damage, useful
venting, weapon theft and a deliberately aimed tower crush. Check naive direct
fire versus demolition rather than calling a scripted win fun. Test all six
standing viewports, real keyboard and simultaneous native touch, restart/reset,
leaderboard rank-before-submit, clean browser console and no horizontal overflow.
Independent critic must reject weak gameplay and compare actual images with a
shipped reference. No AAA or release claim at scaffolding stage.
