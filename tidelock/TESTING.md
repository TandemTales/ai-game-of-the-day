# Tidelock verification

From repository root on Windows:

```
.\node_modules\.bin\jest.cmd --runInBand --cacheDirectory node_modules/.cache/jest-nightly __tests__/tidelock.test.js
.\node_modules\.bin\jest.cmd --runInBand --cacheDirectory node_modules/.cache/jest-nightly
node tools/tidelock-browser-smoke.cjs
```

Full repository Jest normally needs five minutes. The mechanics suite loads the
classic logic script in a Node vm with window and standard built-ins; no DOM,
external art, timer fakery or production leaderboard is needed. It covers seeded
simulation, boundaries, region ownership with multiple storms, score/rescue
accounting, retraction and self-cross loss, live cable collision, pulse expiry,
five-chart legal capture topology, terminal state and long-run wall occupancy.
Parked storms in solvability tests prove topology; they do not prove human
difficulty or live-avoidance balance.

Browser harness uses optional local Playwright and installed Edge (same pattern
as Gearwell), a local HTTP server and a LOCAL mock leaderboard. It must check
320×568, 390×844, 844×390, 768×1024, 1440×900 and 3840×2160; title and live PNGs,
clean console, no external game requests, no horizontal overflow, >=44px touch
targets, real keyboard and touch input, release/pause/retry, capture/pulse,
chart advance, loss, rank-before-submit and file:// boot. Open the PNGs yourself.
Also check DPR2 backing resolution and the actual Featured Game art/rating links
with Gearwell retained once in the older-game catalog.
Ignored evidence lives in node_modules/.cache/tidelock/browser-smoke.

If Playwright is absent, install it only in ignored scratch and set NODE_PATH:

```
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD='1'
npm install --prefix node_modules/.cache/tidelock/browser-deps --no-save --package-lock=false --ignore-scripts playwright@1.55.0
$env:NODE_PATH=(Resolve-Path node_modules/.cache/tidelock/browser-deps/node_modules).Path
node tools/tidelock-browser-smoke.cjs
```

An Edge sandbox launch failure is not game evidence; rerun the scoped harness
with authorized access. No project dependency or lockfile change is required.

Device performance, real speakers, touch hardware, first-play understanding,
fun, motion comparisons and AAA quality remain separate acceptance gates.
