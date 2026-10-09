# Fuse Echo — testing
- Logic: `npx jest __tests__/fuse-echo` (vm context, no browser): arena fairness, determinism, bomb/echo timing,
  chain reactions, collision/corner assist, bot suicide rate, round clear and game over.
- Visual: serve repo root (`python3 -m http.server`), drive with Playwright via `FE.game.start()`, `FE.game.press(code,down)`,
  `FE.game.bomb()`; check 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160. Read the PNGs.
- Console must be clean (the external gtag request fails in sandboxes without internet; ignore).
