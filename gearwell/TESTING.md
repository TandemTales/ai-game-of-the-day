# Gearwell testing

- From the repository root on Windows: `node_modules/.bin/jest.cmd --runInBand --cacheDirectory node_modules/.cache/jest __tests__/gearwell.test.js`.
- Run `node --check` on every `gearwell/assets/js/*.js` and `git diff --check` before commits.
- Browser smoke: start, move/rotate/soft drop/hard drop, see score and next-piece preview, clear a line containing a glowing gear cell, reach three cogs, rewind, top out, and restart. Exercise both keyboard and touch input. On `file://`, play works and leaderboard is skipped.
- Inspect screenshots at 320×568, 390×844, 844×390, 768×1024, 1440×900, and 3840×2160. Check no app console errors, no external runtime requests, no horizontal scroll, and readable touch controls. A browser script does not establish human play, physical touch, audio quality, or hardware performance.
- Over HTTP, rank GET must precede any top-20 POST to `/api/leaderboard/submit`.

## Repeatable HTTP browser check

With `playwright` resolvable by Node (an existing installation or `NODE_PATH`
pointing to the desktop bundled runtime), run from the repository root:

```powershell
node tools/gearwell-browser-smoke.cjs browser-smoke
```

The harness uses installed Edge on Windows, otherwise Playwright Chromium.
Set `GEARWELL_BROWSER_EXECUTABLE` to select a different Chromium executable.
It serves only this checkout on loopback and stubs rank/submit locally; it
does not write the production leaderboard. PNGs are saved under ignored
`node_modules/.cache/gearwell/browser-smoke/` and must be opened and read.

- Captures title and input-played board at all six required viewports; checks
  app warnings/errors, external requests, both scroll dimensions, and 44px
  control targets.
- Uses a placement planner plus real keyboard events to earn at least three
  cogs, captures the earned clear and bank, and taps rewind. Asserts its cost,
  restored board, consumed history, top-out/restart, and local GET-before-POST.
  The harness does not inject a prepared board or manufacture earned cogs.
- Checks DPR 2 backing dimensions and board aspect while resizing a live run
  portrait/landscape/portrait. Browser emulation remains separate from physical
  touch, speaker listening, human gameplay/fun, and hardware performance.
