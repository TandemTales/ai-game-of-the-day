# Signalbreak verification

From repository root:

```
.\node_modules\.bin\jest.cmd --runInBand --cacheDirectory node_modules/.cache/jest-nightly __tests__/signalbreak.test.js
.\node_modules\.bin\jest.cmd --runInBand --cacheDirectory node_modules/.cache/jest-nightly
node tools/signalbreak-browser-smoke.cjs
```

Rules tests load classic scripts in a vm with a browser-global shim. Verify
read-only previews, AP/path legality, blocked and circuit-door LOS, cover/height,
deterministic attacks/AI, overwatch, rescue, objective/extraction, win/loss,
fresh-state isolation and opening-operation solvability. The twenty planned
operations are a content contract, not twenty implemented levels.

Browser QA: local HTTP + optional Playwright/installed Edge, six required sizes
(320×568,390×844,844×390,768×1024,1440×900,3840×2160), no horizontal overflow,
clean console, no external gameplay requests, title/live/result PNGs opened by
the lead, real keyboard/pointer/native touch, preview→confirm, cancel, end turn,
hack-linked door/turret, loss/retry, operation score rank-before-submit with LOCAL
API mock only, file:// boot and DPR2 backing. Read screenshots, not just paths.

Use ignored node_modules/.cache/signalbreak for evidence; Playwright can use the
existing ignored node_modules/.cache/tidelock/browser-deps install via NODE_PATH.

```
$env:NODE_PATH=(Resolve-Path node_modules/.cache/tidelock/browser-deps/node_modules).Path
node tools/signalbreak-browser-smoke.cjs
```

If that optional cache is absent, install Playwright only in ignored scratch,
without changing package.json/package-lock.json or downloading a new browser:

```
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD='1'
npm install --prefix node_modules/.cache/signalbreak/browser-deps --no-save --package-lock=false --ignore-scripts playwright@1.55.0
$env:NODE_PATH=(Resolve-Path node_modules/.cache/signalbreak/browser-deps/node_modules).Path
```

Full Jest normally needs five minutes. Real-device performance, speaker quality,
fresh-player comprehension/fun and independent AAA comparison remain unverified.
