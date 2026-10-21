# Gearwell — module contract

## Concept

Gearwell is a single-screen falling-block score attack inspired by the clarity and replayability of classic arcade puzzle games. A deterministic seven-piece bag feeds a 10×20 well. Every third piece carries one glowing gear cell; clearing the line containing that cell earns a cog. Three cogs buy one rewind of the last lock, restoring the board, piece, score, and bag so a player can correct a mistake. The cog cost persists. This gives a familiar line-clear game a visible risk/recovery decision without copying existing arcade IP. The art is drawn with Canvas; sound is synthesized with Web Audio; no runtime asset or font fetch is needed. Scripts use `window.GW` and work from `file://`.

## File ownership for polish nights

Only the lead runs Git and owns integration. A delegated worker owns exactly one file from this table per assignment.

| File | Owner | Responsibility |
| --- | --- | --- |
| `assets/js/logic.js` | agent-mechanics | Deterministic board rules, bag, scoring, rewind |
| `assets/js/render.js` | agent-render | Procedural table art and game-state drawing |
| `assets/js/audio.js` | agent-audio | Synthesized audio cues |
| `assets/css/game.css` | agent-ui | Responsive shell and touch controls |
| `assets/js/game.js` | lead | Input, game loop, leaderboard, DOM integration |
| `index.html` | lead | Accessible shell, script order, controls |
| `SPEC.md`, `TESTING.md`, `PROGRESS.md` | lead | Contract and handoff |
| `../__tests__/gearwell.test.js` | lead | Mechanical tests |
| `../tools/gearwell-browser-smoke.cjs` | lead | HTTP browser inputs, viewport captures, and leaderboard stub |

## Distinctness audit

The current catalog contains Pulse Loom (rhythm), Ironwake (mech action), Stormhook (swing platformer), Zephyr Circuit (racing), Paradox Vault (time-loop stealth puzzle), Emberfall Gauntlet (arena action), Core Crisis (survival shooter), Nova Striker (space shooter), Bastion Builder (strategy construction), Aurora Tower Defense (tower defense), Neon Brick Breaker (paddle ball), and Prism Warden (mirror adventure puzzle). Gearwell uses no avatar traversal, enemies, aiming, racing, musical timing, physics ball, or placed defenses: spatially packing falling tetrominoes and choosing when to spend an earned rewind is its entire loop.

The other top-level game directories also matter: Lumen Pinnacle is already a pinball table, so the initial Comet Foundry idea was rejected; Bayou Brawlers is a side-scrolling brawler; Crimson Descent is a room-based roguelike; Midnight Menagerie is a haunted deck-building roguelike. Gearwell has no flippers, combat, room traversal, or deck. The `level-editor` directory is a tool, not a game. This inventory is based on this checkout's directory contents and root catalog on 2026-10-18.

## Rules and acceptance

- 10×20 board, deterministic seven-piece bags, legal rotation with simple wall kicks, ghost landing guide, gravity that accelerates each ten cleared lines, soft and hard drop, and top-out.
- Single/double/triple/four-line scoring is 100/300/500/800 × level, plus a 50-point combo step; hard drops earn two points per row and soft drops one.
- A gear cell earns a cog only when its row clears. Three cogs rewind the most recent lock. Rewind restores score and sequence from before that lock while preserving the three-cog cost.
- Keyboard: arrows or WASD move and rotate, Space/Enter hard drop, U rewind. Touch buttons provide all required actions.
- Rank GET precedes a possible top-20 score POST. File playback skips leaderboard calls.

## Research notes

Arcade history was checked alongside SNES/N64, PS2/PS3, and Xbox 360 popularity. [Guinness](https://www.guinnessworldrecords.com/world-records/98519-highest-grossing-arcade-videogame) identifies Pac-Man's historical arcade reach; [Nintendo](https://www.nintendo.com/en-gb/News/2014/June/Mario-Kart-8-sells-more-than-1-2-million-units-worldwide-over-first-weekend-890619.html) documents the popularity of Mario Kart 64; [Xbox Wire](https://news.xbox.com/en-us/2010/01/11/the-top-20-live-games-of-2009/) shows Halo 3 and other large console genres. [Nintendo's Tetris 99 page](https://www.nintendo.com/us/store/products/tetris-99-switch/) describes the classic falling-block line-clear loop; Gearwell adds an earned rewind decision. Indie combinations such as [Yoku's Island Express](https://www.team17.com/games/yokus-island-express) and [Rollers of the Realm](https://www.gamedeveloper.com/design/postmortem-pinball-rpg-hybrid-i-rollers-of-the-realm-i-) suggested giving a classic loop one clear new decision. The previously unseen Lumen Pinnacle made pinball a duplicate, so Gearwell takes the missing falling-block category.
