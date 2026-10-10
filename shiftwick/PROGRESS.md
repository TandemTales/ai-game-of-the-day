# Shiftwick PROGRESS

## 2026-10-10 (scaffold night)
Intent: choose game, write SPEC/TESTING, build a playable vertical slice (maze, player, 4 Shades, Shift mechanic,
HUD, touch swipe + keyboard, leaderboard hook), add to root index as Featured.

### Result (scaffold night)
Playable vertical slice shipped to the branch: procedural braided maze (seeded, always connected), flame player,
4 Shades with distinct targeting + scatter/chase/dazed/eyes states, moon-flame power pellets, **Shift** mechanic
(row/column slide with animated wrap, charges refill over time and on moon-flames, riders dazed), combo scoring,
levels, lives, keyboard + swipe + SHIFT button, procedural audio, leaderboard hook, cover art from a real screenshot.
Verification: `npx jest shiftwick` 8/8; Playwright screenshots at 320x568, 390x844, 844x390, 768x1024, 1440x900,
3840x2160 — console clean, no horizontal scroll; phone-shift and desktop PNGs were read and looked correct.
No critic/AAA blind comparisons were run tonight (scaffold night) — all disciplines are below the AAA bar.

### Next run should do first
1. Polish night: critic comparison vs a shipped maze-chase (e.g. Pac-Man Championship Edition DX) for visuals; audio music loop;
   fruit/bonus items; title/attract screen; per-level maze themes; touch tuning of swipe thresholds; tutorial hint.
2. Add tests for ghost-house exit edge cases and shifting while a Shade is mid-tile.
3. Branch note: repo has no `dev`; work is on claude/beautiful-turing-40jiwt. Release is forced Saturday 2026-10-24.
