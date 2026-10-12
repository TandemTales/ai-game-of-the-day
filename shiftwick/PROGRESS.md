# Shiftwick progress

## 2026-10-11 (scaffolding night)
Intent: pick game, write SPEC/TESTING, build playable vertical slice (maze, 4 Hollows, sliding rows, scoring, leaderboard, touch+keys).

### Result of scaffolding night
Done: SPEC/TESTING; logic.js (generator, 4 Hollow AIs, sliding lines with connectivity validation, scoring, levels);
render.js (neon-edged walls, glowing motes, flame sprite, hollows, particles, telegraph band, slide anim);
audio.js; main.js (keys/swipe/d-pad, pause, leaderboard); root index.html featured + grid card with generated cover.
Tests: 13/13 pass. Screenshots read at 390x844, 1440x900, 844x390; console clean, no hscroll at all six sizes.
Not yet done / below AAA bar: no critic blind comparisons run; character sprites are simple paths; walls are flat
glowing outlines (no texture depth); no music, only SFX+drone; no tutorial hints; Hollow AI not playtested for fairness;
no mid-game save; difficulty curve untuned; Hollow scatter/chase timers are placeholders.
Next run: polish night - (1) render/wall+character art vs a shipped maze-chase (e.g. Pac-Man Championship Edition DX),
(2) audio music loop, (3) tutorial + shift fairness tuning. Release Saturday: 2026-10-24 (age >= 9 days on Sat).
