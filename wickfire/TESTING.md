# Wickfire testing

- Headless: `npx jest wickfire` loads `assets/js/logic.js` in a `vm` context and asserts determinism,
  level connectivity, movement, blast geometry, chain scoring, fuse propagation/cut escape, enemy
  kills, death/respawn/game over, and a seeded random-play simulation.
- Visual: serve the repo root (`python3 -m http.server`), drive with Playwright (Chromium at
  `/opt/pw-browsers`), screenshot 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160 and READ
  the PNGs. `WF.debug.game` exposes live state. Check console clean and no horizontal scrollbar.
- Manual: keyboard (arrows/WASD, Space, X/Shift, P pause, M mute); touch (left stick, BOMB, CUT).
