# Testing
- Rules: `npx jest gumdrop` (loads logic.js in a `vm` context; asserts determinism, grouping, chains, slide, tilt, game over).
- Visual: serve statically or open `index.html`; drive `window.__gt.act('hard'|'left'|...)` from Playwright and screenshot at
  320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160. Console must be clean; no horizontal scroll.
