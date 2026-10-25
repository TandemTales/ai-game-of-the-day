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
  restored board, lines, level, combo, serial, seed and next-piece queue,
  the same piece returned to its spawn position/orientation, removal of its
  drop points, consumed history, top-out/restart, and local GET-before-POST.
  The harness does not inject a prepared board or manufacture earned cogs.
- Checks DPR 2 backing dimensions and board aspect while resizing a live run
  portrait/landscape/portrait. Browser emulation remains separate from physical
  touch, speaker listening, human gameplay/fun, and hardware performance.

The harness also checks that DOM NEXT/REWIND labels stay inside the stage
at >=11px and counts at >=12px, and that an input-earned paid rewind updates bank readiness,
accessible button wording and disabled state. Inspect clear/rewind captures to
confirm header announcements leave active board cells unobstructed. Persistent
control labels distinguish soft drop, hard drop and the three-cog rewind cost.

The focused suite also exercises game-loop feedback under a browser shim:
non-clearing hard drops must not play the clear cue, gravity locks must play
the lock cue, and gravity line clears must play both cues and update status.
These controlled fixtures verify event routing, not speaker quality or latency.

The HTTP harness saves additional elapsed-time event stills:
`earned-clear-transport.png`, `earned-clear-receipt.png`,
`paid-rewind-transport.png`, and `paid-rewind-followup.png`. They follow legal
input-earned events with the live game running; open the sequence to review
rail transport and bank receipt. The follow-up runs gravity for at least two
seconds after rewind and asserts that the board remains restored and the same
piece can still move to a different placement. Still sequences do not establish motion
quality, actual device performance, or audio acceptance.

Rewind regressions cover hard drop, soft drop, and gravity locks. A retry
preserves earlier pieces' points and the upcoming sequence, removes points
earned since the returned piece spawned, and does not automatically repeat
the old placement on the next gravity tick.

## Repository suite runtime

Run `node node_modules/jest/bin/jest.js --runInBand --cacheDirectory node_modules/.cache/jest`
for the full repository suite. The October 24 run passed all 29 suites / 494 tests
in 268.925 seconds. `prism-warden.test.js` alone took 173.36 seconds and
`prism-warden-kiln.test.js` took 42.554 seconds. A 60-second wrapper cutoff cannot
establish a failure or completion of this suite. Let it continue in the background
while working, then collect its actual exit status. Keep those historical timings
distinct from a new run's result.
