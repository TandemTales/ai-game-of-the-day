# Tidelock — module contract

## Concept

A classic Qix-lineage territory-capture game with original nautical IP. The
surveyor's cable leaves the safe shoreline and reconnects to claim every region
without a storm. Storms cut exposed cable; crossing your own cable costs a life.
Retracing your last segment is allowed. Gold buoys enclosed by a capture award
250 points and one charge (maximum three). Space or HOLD THE STORM consumes a
charge to freeze storms for 2.5 seconds while the tide clock keeps running.
Claim 60% to advance. Five charts, three cables, 90 seconds per chart, final
victory or loss, replay and numeric leaderboard define the playable scaffold.

Started: 2026-11-01 Pacific. Forced second-Saturday release: 2026-11-14.
FIRST PLAYABLE remains visible; no AAA acceptance or full campaign claim.

## Single-file ownership

Only the lead runs Git. Each polish assignment owns exactly one file; report
cross-file needs to the lead. A separate critic touches no implementation files.

| File | Owner / responsibility |
| --- | --- |
| index.html | lead: DOM, accessibility and script order |
| assets/js/logic.js | gameplay agent: deterministic simulation and capture |
| assets/js/render.js | renderer agent: chart materials, objects, lighting and VFX |
| assets/js/audio.js | audio agent: synthesized sound and audio lifecycle |
| assets/css/game.css | UI agent: responsive composition and control hierarchy |
| assets/js/game.js | lead: input, state machine, timing, DOM and leaderboard |
| SPEC.md, TESTING.md, PROGRESS.md | lead: contracts, evidence and handoff |
| ../__tests__/tidelock.test.js | lead: mechanics and solvability checks |
| ../tools/tidelock-browser-smoke.cjs | lead: browser and input proof |

Classic non-module scripts on window.TL, loaded logic → render → audio → game.
No runtime external assets or fonts. Canvas art and Web Audio are procedural.
The same local files run over HTTP and file://; file mode skips leaderboard.

## Simulation and interfaces

33×25 cells, border initially claimed; cells are 0 water / 1 safe land.
Player uses integer cell coordinates; storms use floating coordinates rounded
for wall occupancy. Coordinate origin is top left. Logic.tick seconds are clamped
to 0.05. UI holds cardinal direction and moves every 0.085 seconds; releasing
stops. A cable is open until it reconnects. Capture flood-fills from ALL storms,
preserving every storm-containing region. Claimed cells never revert.

TL.Logic: W, H, charts, index(x,y), newGame(seed), move(state,dx,dy),
tick(state,dt), pulse(state), next(state). All mutate only the supplied state.
State includes cells, player, anchor, trail, enemies, buoys, score, lives, stage,
charges, rescued, ratio, time, freeze, invulnerable, clear, over, won, serial,
event and last. serial increments for audio events; rendering never mutates state.
TL.Render.draw(canvas,state,seconds); TL.Audio.unlock/play/toggle.
TL.Game.start/getState/getMode are integration and browser-inspection surfaces.

Scoring: 10 per newly claimed water cell including cable, 250 per buoy, plus
ceil(remaining seconds)×20 + chart number×500 on each 60% clear. Safe shoreline
movement earns nothing. Lives/score/charges carry between charts; clock resets.
Top-20 rank GET precedes name prompt and submit POST; offline errors stay local.

## Inventory and distinctness

Scanned every top-level game directory and the root catalog, including games
absent from that catalog. level-editor is a tool; comet-foundry is an abandoned
empty scaffold directory, not an implemented game. No directory was deleted.

| Existing game | Genre / why Tidelock differs |
| --- | --- |
| Aurora Tower Defense | tower placement / no towers or wave economy |
| Bastion Builder | defensive strategy / no draft or siege formation |
| Bayou Brawlers | side-scrolling brawler / no melee combat or scrolling stages |
| Core Crisis | arena survival shooter / no firing or core defense |
| Crimson Descent | action descent / no descending platform traversal |
| Emberfall Gauntlet | action combat / no room-clearing attacks |
| Gearwell | falling-block puzzle / no pieces, stacking or line clears |
| Ironwake | mech demolition campaign / no weapons, destructible buildings or vehicle |
| Lumen Pinnacle | pinball, unlisted / no flippers or ball physics |
| Midnight Menagerie | spooky arcade action / no enemy combat; territory topology is the objective |
| Neon Brick Breaker | paddle/ball / no bouncing projectile or brick clears |
| Nova Striker | shoot 'em up / no bullet patterns or aiming |
| Paradox Vault | time-loop stealth / no replay clones, switches or heist |
| Prism Warden | mirror-shield adventure / no reflection combat or exploration inventory |
| Pulse Loom | rhythm / no beat chart or timed note judgments |
| Stormhook | grapple platformer / no gravity, swinging or platform physics |
| Zephyr Circuit | kart racing / no lap, vehicle handling or competing racers |

## Selection research (2026-11-01 Pacific)

Searched SNES/N64 best sellers (Super Mario World, Super Mario 64, Mario Kart),
PS2/PS3/Xbox 360 leaders (GTA, Halo, racing/action), arcade popularity (Pac-Man,
Galaga, Qix), and indie/mobile territory mechanics (Paper.io and modern Qix
variants). This selection contributes to the classic-mechanic majority; it is
not an assertion that Qix was the best-selling game or that the catalog already
meets an exact 80/20 ratio. Rejected kart, shooter, falling-block and pinball
ideas because they duplicate implemented core loops.

Sources: [Museum of the Game popularity list](https://www.arcade-museum.com/top100),
[original Qix manual](https://www.aurcade.com/games/manuals/00000172.pdf),
[Paper.io publisher](https://voodoo.io/games/paper-io),
[SNES best sellers](https://en.wikipedia.org/wiki/List_of_best-selling_Super_Nintendo_Entertainment_System_video_games),
[N64 best sellers](https://en.wikipedia.org/wiki/List_of_best-selling_Nintendo_64_video_games),
[PS2 US sales research](https://www.gamesradar.com/games/as-the-ps2-turns-25-its-top-20-best-selling-us-games-are-revealed-gta-is-still-on-top-and-kingdom-hearts-beats-final-fantasy-10/),
[PS3 best sellers](https://en.wikipedia.org/wiki/List_of_best-selling_PlayStation_3_video_games),
[Xbox 360 best sellers](https://en.wikipedia.org/wiki/List_of_best-selling_Xbox_360_video_games).

## Future quality gate

Scaffold only tonight. Polish runs must use one-file workers and independent
harsh side-by-side critics with actual shipped-game screenshots. Visual,
gameplay, UI, audio and VFX are all unjudged. Early release requires every
critic passing and a separate shipping judge. November 14 forced release uses
the standing functional blocker gate and honestly records cosmetic debt.
