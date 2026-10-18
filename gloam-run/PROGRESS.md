# Gloam Run progress

## 2026-10-18 (scaffold night)
Intent: choose game, write SPEC/TESTING, build a playable vertical slice (one maze, shutters, four wisps, scoring, touch + keyboard), add to arcade as Featured.

### Result (end of scaffold night)
- Built: deterministic logic (`logic.js`: 19x19 maze, shutter gates A/B, 4 rune pads with 0.9s preview + cooldown, four wisp AIs, lantern flare chain scoring, lives, level ramp), procedural audio, canvas renderer (hedge walls, gates, runes, embers, wisps, lantern darkness, particles, shake), keyboard/swipe/d-pad input, leaderboard hook, SVG cover art.
- Root `index.html`: Gloam Run is Featured; Pulse Loom remains in the game grid.
- Tests: `npx jest gloam-run` — 7 passing (reachability of all embers across shutter states, shutter rules, scoring, rune flip, determinism, flare/eat/hit, game over/next level).
- Verified: headless Chromium sweep at 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160: no console errors, no horizontal overflow; read 1440 and 390 gameplay screenshots.
- Not done / next run first: no AAA critic passes yet (no side-by-side vs. a shipped reference). Needs: richer art (wall textures, character sprites, wisp animation), wisp-house door visuals, more mazes/levels (only one layout), bonus fruit-style pickups, pause, audio mix pass, better title screen, mobile layout review of the 844x390 and 3840x2160 shots, fright audio.
- Branch note: no `dev` branch exists; commits go to claude/beautiful-turing-ldoilu. `main` untouched (Pulse Loom's release has also not reached main; a human must promote).
