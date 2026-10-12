# Shiftwick - testing

Headless logic suite: `node node_modules/jest/bin/jest.js shiftwick --runInBand` (run `npm install` first).
Covers maze connectivity on 12 levels, determinism, scoring, ghost chain, death/gameover, shift
connectivity and entity legality across many seeds, and replay determinism.

Visual check: serve the repo root statically and drive Chromium (Playwright with
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). Start with `SWDebug.start()`; force a shift by
setting `SWDebug.state.nextShift = SWDebug.state.time`. Check 320x568, 390x844, 844x390, 768x1024,
1440x900, 3840x2160: console clean, no horizontal scroll, HUD readable, touch d-pad present on portrait touch.
