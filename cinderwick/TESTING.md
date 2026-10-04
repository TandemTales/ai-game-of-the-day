# Cinderwick testing

Headless rules suite (vm context, no browser):
`node node_modules/jest/bin/jest.js cinderwick`

Covers: deterministic levels, safe start, hidden exit, bomb cap, flame geometry, cord laying, dormant
bombs, chain detonation and multiplier, deaths/respawn/game over, exit rules, collisions, determinism.

Visual/browser checks: serve the repo (`npx http-server` or `python3 -m http.server`), open
`/cinderwick/index.html` with Playwright Chromium at 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160;
check console clean and no horizontal scroll. `CW.Game.state()` exposes sim state for scripted play.
