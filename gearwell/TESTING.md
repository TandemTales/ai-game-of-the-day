# Gearwell testing

- From the repository root on Windows: `node_modules/.bin/jest.cmd --runInBand --cacheDirectory node_modules/.cache/jest __tests__/gearwell.test.js`.
- Run `node --check` on every `gearwell/assets/js/*.js` and `git diff --check` before commits.
- Browser smoke: start, move/rotate/soft drop/hard drop, see score and next-piece preview, clear a line containing a glowing gear cell, reach three cogs, rewind, top out, and restart. Exercise both keyboard and touch input. On `file://`, play works and leaderboard is skipped.
- Inspect screenshots at 320×568, 390×844, 844×390, 768×1024, 1440×900, and 3840×2160. Check no app console errors, no external runtime requests, no horizontal scroll, and readable touch controls. A browser script does not establish human play, physical touch, audio quality, or hardware performance.
- Over HTTP, rank GET must precede any top-20 POST to `/api/leaderboard/submit`.
