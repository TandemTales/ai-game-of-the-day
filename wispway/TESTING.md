# Wispway testing

- Logic: `npx jest wispway` from the repository root (loads `logic.js` in a `vm` context; covers maze
  validity and reachability in both gate phases, determinism, scoring, gates, flare, lives, level clear, tunnel).
- Browser smoke: serve the repo root (`python3 -m http.server`), open `/wispway/index.html`, press START, steer
  with arrows/WASD or swipe, press Space for Flare, lose all lives, retry. No external requests; console clean.
- Viewports: 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160; no horizontal scroll. Read the PNGs.
- `file://` play works; leaderboard is skipped. Over HTTP the rank GET precedes the submit POST.
