# Gloam Run testing

- Logic: `npx jest gloam-run` from the repo root (`__tests__/gloam-run.test.js`). Covers maze connectivity in both gate states, no permanent dead ends, gate rules, determinism, lantern/chain scoring, lives and level progression.
- Browser smoke: serve the repo root (`python3 -m http.server`), open `/gloam-run/index.html`, start, steer with arrows/WASD/swipe/pad, step on a violet moonstone and confirm gate colours flip (green = passable, red = sealed).
- Check 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160: clean console, no horizontal scroll, d-pad visible on touch. Read the screenshots.
- `file://` play works; leaderboard skipped there. Over HTTP the rank GET precedes the top-20 submit POST.
