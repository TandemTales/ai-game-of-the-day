# Testing Wickfire

1. `npx jest wickfire` — `__tests__/wickfire.test.js` loads only `sim.js` in a `vm` context. Covers
   determinism, level solvability (exit reachable, spawn zone clear), wick laying, timerless charges,
   ignite/fuse detonation, failsafe, wick kill + combo scoring, crate/pickup/chain blasts, damage and game over,
   level clear, 60s enemy bounds.
2. Browser: serve the repo root (`npx http-server -p 8900 .`) and drive `wickfire/index.html` with Playwright
   (`/opt/node-tools/node_modules/playwright`). Sweep 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160;
   check console clean, no horizontal scroll, and actually read the PNGs. `window.WK.game.state` exposes the sim.

The jest layer does not exercise render/audio/game.js; only the browser sweep does.
