# Lantern Moth progress

## 2026-10-20 (Pacific) - scaffolding night
Intent: pick the game, write SPEC/TESTING, build a playable vertical slice (maze logic, spiders,
gates, renderer, audio, touch/keyboard, leaderboard), add to root index as Featured Game.

### Scaffold result
- Playable vertical slice: deterministic logic (8 jest tests passing), canvas renderer (hedge walls, moth, spiders,
  gates, lighting pool, particles), procedural audio, keyboard/swipe/d-pad, leaderboard rank+submit, best score.
- Added as Featured Game in root `index.html` (Pulse Loom moved to More Games), cover `images/arcade/lantern-moth.svg`,
  and the leaderboard catalog.
- Screenshots read at 1440x900 and 390x844; console clean, no horizontal scroll at all six viewports. No critic
  blind comparisons yet (scaffold night) - AAA bar NOT yet met.
### Next run should
1. Run blind critic comparisons vs a shipped maze-chase (Pac-Man Championship Edition DX) for visuals and audio.
2. Add more mazes per night, a bonus fruit-like item, scatter/hunt tuning, ghost-eaten and gate-swing VFX, music.
3. Mobile portrait: use the empty space under the maze (larger d-pad, bigger canvas); verify d-pad on a touch emulation.
4. Replace the cover SVG with generated art if an image tool is available.
