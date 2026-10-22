# Hedgeshift testing

- `npx jest hedgeshift` — headless logic tests (connectivity of both layers, determinism, shifts/crush, chain scoring, level scaling, wall safety).
- Browser smoke: serve repo root (`python3 -m http.server`), open `/hedgeshift/index.html`, press START, steer with arrows/WASD/swipe, watch the orange shift warning, finish a level, lose all lives, retry.
- Viewports: 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160 — clean console, no horizontal scroll. Read the screenshots.
- Over HTTP the rank GET precedes the top-20 submit POST; skipped on `file://`.
