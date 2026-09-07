# Orbit Orchard — Testing

## Planned gameplay gate (September 7 feedback)

The first collect-and-deliver contract is implemented. The three-contract
escalation and dash remain planned. Current tests cover seeded target supply,
choice locking, cargo/growth, first-target contact from starting mass, nursery
deposit exactly once, time cap, expiry/replay, idle baseline, repeated cargo
recovery without score farming and shared hit grace. Future milestones require:

- Correct-family cargo versus ordinary growth, explicit choice, full-capacity
  behavior, nursery overlap/entry, exactly-once deposits and replay reset.
- Three-contract victory, failure at zero time, capped time rewards, deterministic
  replenishment and enough eligible targets/routes for each starting mass.
- Hazard telegraph duration, shared collision grace, recoverable cargo loss, empty-cargo hits,
  safe nursery/exits, and passable routes at maximum player radius.
- Dash direction in both orientations, charge cap/refill, protected interval,
  simultaneous touch steering/dash, cancellation and editing-field shortcuts.
- Seeded complete routes plus idle, circular and greedy target-and-return baselines.
  A successful scripted route proves reachability, not enjoyable difficulty.
- Real browser complete runs with normal timers and actual input on keyboard and
  touch. Record the SPEC gameplay-gate playtest matrix and independent critic
  findings. Keep fixture-based smoke checks separate from this evidence.

Retain all six viewport regressions. New objectives, cargo, hazard warnings and
dash controls must fit without shrinking the established portrait arena into
an unreadable view. Any balance change requires fresh complete-run evidence.

## Headless logic suite

From the repository root:

```text
npx jest __tests__/orbit-orchard.test.js --runInBand
```

Before committing a broader change, run the full repository suite:

```text
npm test -- --runInBand
```

The suite loads `assets/js/game.js` in a browser-like VM and covers deterministic
field generation, start/reset behavior, keyboard steering, absorb eligibility,
growth and scoring, same-color links, gravity attraction, hazard penalties,
timer game-over, formatting, and the leaderboard URL contract.

## Browser smoke

Serve the repository root over HTTP, then open `orbit-orchard/index.html`.
Confirm:

1. The start card is visible and `Space` or `ENTER ORBIT` begins a run.
2. WASD/arrow keys move the seed; dragging on the canvas steers it on touch or mouse.
3. Small relics disappear into the seed, increase MASS, increase SCORE, and show a burst/event label.
4. Same-color pickups show `CONSTELLATION LINK` and raise the multiplier.
5. Gravity wells visibly pulse; touching one costs four seconds and pushes the seed away.
6. Deliver three matching targets at the nursery or let time expire; results distinguish delivery from failure. Clearing the field never wins.
7. The back link returns to `../index.html`.

The game has no external art, font, audio, or runtime data fetch. A local
analytics request must not be added to this new game's page.

## Responsive sweep

Check 320x568, 390x844, 844x390, 768x1024, 1440x900, and 3840x2160. Confirm
the requested canvas dimensions are respected by the browser, no horizontal
scrollbar exists, the start/game-over cards are fully readable, the HUD stays
legible, and the touch hint never blocks the seed. Visual checks count only
after opening and reading the screenshots.

## Repeatable Chromium smoke and screenshots (added 2026-09-06)

Run `node orbit-orchard/tools/smoke.js` with Playwright available. It starts its
own loopback-only static server and closes the browser and server afterward.
On this Windows desktop, the installed runtime can be used without downloading:

```powershell
$env:OO_PLAYWRIGHT = 'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:OO_CHROME = 'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe'
node orbit-orchard/tools/smoke.js
```

These are machine-specific paths; elsewhere install Playwright or point the two
variables at the local package/browser. Chromium may require sandbox execution
approval on Windows. No browser download is required on the current desktop.

Default output: `node_modules/.cache/orbit-orchard/latest/` (ignored by Git).
Each viewport produces ready/playing/over PNGs and `report.json`. `OO_SHOTS`
overrides the output directory; `OO_VIEWPORTS=1440x900` narrows a debugging run.
Omit `OO_VIEWPORTS` for the required complete six-size sweep.

Checks cover live keyboard and mouse input, native Chromium touch events on
mobile/tablet sizes, unobstructed buttons, unclipped cards, callsign typing,
Enter-to-submit, rank-before-submit with mocked local API responses, and replay.
Unexpected browser warnings/errors, third-party requests, and horizontal overflow
fail the check. Playing screenshots use a seeded simulation fixture; game-over
checks shorten the timer. This does not prove natural full-run balance, live
leaderboard service availability, actual device performance, or AAA visual quality.
Read the generated PNGs, including the physical landscape viewport boundary;
full-page screenshots alone can conceal a playfield extending below the fold.

The portrait regression checks the full rotated 5:8 arena and live HUD inside
320x568 and390x844. Keyboard right must move right on screen; pointer targets
must agree with the rendered transform. Results callsign, POST and Replant must
be visible without scrolling with44px minimum targets. The390px run resizes to
landscape and back, verifying the view updates without altering simulation.
Pure view tests cover world-corner reachability, distance preservation and all
four portrait steering directions. Screenshot fixtures use `OO.runtime.render()`
to follow the same backing-resolution and view path as live play.

## First delivery real-input baseline

Run `node orbit-orchard/tools/contracts-playtest.js` with the same OO_PLAYWRIGHT
and OO_CHROME environment variables as smoke.js. It runs seeds 7, 42 and 2026
through safe/risky contracts on desktop keyboard and native Chromium portrait
touch. Only the seed is assigned before start. Actual key/touch events steer to
the nearest eligible target, then return home; no player positions, cargo,
timers or simulation steps are injected. Reports and cargo/results PNGs go to
ignored node_modules/.cache/orbit-orchard/contracts-playtest (OO_SHOTS override).

This is a greedy reachability baseline, NOT human play or proof of fun. Record
wall and game time separately: browser load can slow the capped frame clock.
The report now records harvest/delivery score separately, final radius and pickup
count. Runs execute sequentially to reduce concurrent-render timing distortion;
wall and game time still differ. Compare score shares and radius as well as wins.
The full repeated-seed early/practiced matrix and independent gameplay acceptance
gate remain outstanding. Smoke's viewport/expiry fixtures are separate evidence.

September 7 tuning regressions also cover non-maximal three-target growth, a
legal ascending-size absorption bridge across 100 seeds (eligibility only, not
timed navigation), dominant short-trip delivery rewards, exact score accounting,
replay reset and recovery without duplicate points. Browser results use a
populated delivery fixture to expose long-stat wrapping and require callsign,
POST and Replant to fit the first portrait and landscape phone results screen.
