# Gloam Run testing
- `npx jest gloam-run` from the repository root (tests in `__tests__/gloam-run.test.js`, logic loaded in a `vm` shim).
- Browser smoke: serve repo root, open `/gloam-run/index.html`, start, steer with arrows/WASD/swipe/d-pad, confirm embers, shutters flip on rune pads, wisps frighten, game over/clear flow, retry.
- Viewports: 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160; console clean, no horizontal scroll.
- Leaderboard skipped on `file://`; over HTTP rank GET precedes top-20 POST.
