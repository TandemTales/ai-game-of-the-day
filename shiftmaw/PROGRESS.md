# Shiftmaw — PROGRESS

## 2026-10-17 (scaffold night)
Intent: pick game, write SPEC/TESTING, build first playable vertical slice
(maze, player, 4 Hollows, phase flip, scoring, leaderboard), feature on index.

### Tonight's result (scaffold complete, playable)
- Done: `levels.js` (19x21 conservatory, validated solvable in both phases), `sim.js` (movement, 4 Hollow AIs, Phase Flip + pinch chain, blooms,
  fruit, lives, levels), `render.js` (2.5D raised walls, sprites, particles, ripples), `audio.js`, `ui.js`, `game.js`, leaderboard wiring,
  featured on root `index.html` with placeholder cover (engine capture).
- Tests: `npx jest shiftmaw` — 12 passing. Screenshots read at 390x844, 844x390, 1440x900, 320x568 (menu + play + flip). Console clean apart from the blocked gtag.
- Not yet critic-compared against shipped AAA references (scaffold night); **no AAA claim**.
- Known gaps / next run first: (1) only one maze — author 2–3 more with different phase-wall layouts; (2) blind side-by-side critic rounds for
  visuals (reference: Pac-Man Championship Edition DX), UI and audio; (3) wing sprite is nearly edge-on, make the moth read as a moth;
  (4) attract-mode demo behind the menu; (5) touch tuning on real devices; (6) replace placeholder cover art; (7) ghost eyes/skirt polish;
  (8) screenshot 768x1024 and 3840x2160 were captured but not yet inspected.
