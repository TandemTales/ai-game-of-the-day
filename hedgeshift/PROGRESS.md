# Hedgeshift progress

## 2026-10-22 (Pacific 2026-10-22, scaffold night)
Intent: choose and scaffold Hedgeshift (Pac-Man-style maze chase with a
two-layer shifting hedge). Goal tonight: playable vertical slice, deterministic
logic + tests, root catalog entry. No AAA polish yet.

### Scaffold night result
- Added logic.js (15x15 two-layer maze, 4 wisp AIs, shift/crush, levels), audio.js, render.js, game.js, CSS, index.html, SPEC/TESTING, cover SVG, root catalog Featured entry (Pulse Loom moved to More Games).
- 11 jest tests pass. Playwright screenshots at 390x844, 1440x900, 320x568, 844x390 read; console clean, no horizontal overflow. 768x1024 and 3840x2160 not yet checked.
- Not yet AAA; no critic comparisons run (scaffold night).

### Next run should do first
1. Polish visuals (hedge textures, firefly/wisp art, lighting) vs a real Pac-Man CE / Pac-Man Championship screenshot via critic loop.
2. Add a bonus fruit ("dew bloom"), intro/ready banners, shift-layer ghost preview, wisp-house.
3. Audio music loop; mobile control tuning; more maze variety per level (2-3 authored maps).
4. Verify 768x1024 and 3840x2160.
