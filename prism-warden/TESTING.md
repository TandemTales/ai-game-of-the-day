# Prism Warden — testing

Run all regressions: node node_modules/jest/bin/jest.js --runInBand
Run focused mechanics: node node_modules/jest/bin/jest.js prism-warden --runInBand
Browser harness will live at prism-warden/tools/smoke.cjs; serves local HTTP and
uses installed Playwright/Chromium. Evidence ignored under node_modules/.cache.
Required sizes:320x568,390x844,844x390,768x1024,1440x900,3840x2160.
Inspect each PNG; assert console clean, no horizontal overflow, independent
keyboard aim/move, native simultaneous touch, pause/retry, result and mock scores.

Mechanics acceptance: ray stops at solid cover; shield intercept/aim works;
receiver charge decays/latches exactly once; closed gate collision; projectile
front-facing reflection versus rear hit; guardian exposure/sword timing; dodge
cooldown and grace; rescue gated by guardian; deterministic legal-input victory;
idle cannot win, intentional route can; sanctuary optional and meaningful.
VM fixtures establish mechanics/reachability, not enjoyment. Native real-clock
routes must use actual browser input and disclose state-informed planning.
No production score should be submitted during verification. Full campaign,
physical-device quality and human enjoyment remain unverified until built/tested.
