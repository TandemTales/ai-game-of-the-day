# Wickfire — PROGRESS

## 2026-10-10 (Sat PDT) — scaffolding night
Intent: pick game, write SPEC/TESTING, build a playable vertical slice (grid sim, enemies,
wick/fuse mechanic, render, audio, touch+kbd controls, leaderboard), feature it on the root page.

### Result (scaffolding night, 2026-10-10)
- Built: sim.js (tested, 10 jest tests pass), audio.js, render.js, game.js, game.css, index.html, SPEC/TESTING.
- Browser sweep at all 6 viewports: console clean, no horizontal scroll; screenshots read for 1440x900, 390x844, 844x390.
- Featured on root index.html with cover art `images/arcade/wickfire.webp` (in-game capture, not generated art).
- No critic/AAA comparison run yet (scaffold night). No `dev` branch exists; used the session branch.

### Below the AAA bar / next run should do first
1. Portrait phones: grid is only ~26px tiles with large dead space; consider zooming/scrolling camera or 11x13 portrait layout.
2. Art: actors are simple vector sprites; wants animation frames, enemy variety (3+ types), themed vault biomes, richer lighting.
3. Gameplay: add enemy types, boss vault every 5 levels, kick/throw/remote-ignite upgrades, 2-player versus.
4. Audio is basic synth; tune mix. Add pause-on-blur polish and tutorial first-run hints.
5. Blind side-by-side critic loop vs Super Bomberman / Bomberman 64 screenshots.
