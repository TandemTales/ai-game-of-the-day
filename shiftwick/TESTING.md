# Shiftwick testing
- Logic: `npx jest shiftwick` (loads `assets/js/logic.js` in a `vm` context: determinism, connectivity over 60 seeds,
  shift reversibility, rider safety, scoring, level clear).
- Visual: serve statically or open `index.html`; drive via `SW.debug.start()/shift(dir)/want(dir)`. Check 320x568,
  390x844, 844x390, 768x1024, 1440x900, 3840x2160; console clean; no horizontal scroll.
