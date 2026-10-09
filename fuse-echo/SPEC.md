# FUSE ECHO — Module Contract

A grid-arena bomber for the Bot Built Arcade (classic Super Bomberman-style foundation, original IP).
Classic non-module scripts on one global, `window.FE`; runs from `file://`. All art is procedural
canvas drawing; all audio is Web Audio synthesis. No external fetches except the two leaderboard calls.

## Concept
15x13 arena of steel pillars and crates. Drop bombs, crack crates, grab Bomb/Flame/Speed pickups and
eliminate robot rivals. **Twist — the Echo:** every detonation leaves a ghost of its blast pattern that
**re-detonates 1.6 s later** (shown as dashed cyan cells plus a countdown ring on the bomb tile). Echoes
hurt everyone, chain-detonate bombs, but do not break crates. Echo kills score double; bomb chains multiply.
Run structure: 3 lives, escalating rounds (more/faster/smarter bots), score submitted to the leaderboard.

## Files and owners
| File | Owns |
|---|---|
| `assets/js/logic.js` | Pure deterministic model: arena, movement, bombs, echoes, chains, pickups, bot AI, scoring (no DOM) |
| `assets/js/render.js` | Canvas renderer, baked textures, particles, shake/flash |
| `assets/js/audio.js` | SFX and looping synth music |
| `assets/js/game.js` | Loop, input (keyboard + touch stick/bomb), HUD, menus, leaderboard |
| `assets/css/game.css` | HUD, panels, touch controls |
| `index.html` | DOM shell |
Sub-agents (polish nights) own exactly one of these each; integration stays with the lead.

## Rules
- Fixed 1/60 s step. Bomb fuse 2.2 s, blast 0.45 s, echo delay 1.6 s, echo blast 0.45 s.
- Score: crate 10 x chain (own bombs), kill 500 x (chain+1), echo kill x2, pickup 100, round clear 1000 + speed bonus.
- Leaderboard id `fuse-echo`: `GET /api/leaderboard/rank` then `POST /api/leaderboard/submit`.

## Why it is distinct from every existing arcade game
- **Ironwake** — 3D mech campaign; Fuse Echo is a top-down grid duel with no campaign.
- **Stormhook** — momentum grapple platformer; no traversal physics here, tile-locked tactical bombs.
- **Zephyr Circuit** — kart racing; no racing.
- **Paradox Vault** — time-loop stealth puzzle; its "echoes" are replayed self-clones, Fuse Echo's are delayed re-detonations in a PvE combat arena.
- **Prism Warden** — light-reflecting adventure; no exploration or light puzzles.
- **Emberfall Gauntlet / Core Crisis / Nova Striker** — real-time shooters and wave survival; this is area-denial with bombs, positioning and chain setups.
- **Bastion Builder / Aurora Tower Defense** — strategy/tower defense; no building or waves on paths.
- **Neon Brick Breaker** — paddle arcade; unrelated verb.
- **Lumen Pinnacle, Bayou Brawlers, Crimson Descent, Midnight Menagerie** — pinball, beat-em-up, lander, deck-builder: none involve bomb placement or grid area denial.
