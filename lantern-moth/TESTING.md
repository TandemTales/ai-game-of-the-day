# Lantern Moth testing

- `npx jest __tests__/lantern-moth.test.js` from the repo root: maze shape, seed reachability with both gate sets,
  gate timing, eating/scoring, determinism, lantern + chain scoring, death/game over, level advance.
- Browser smoke: serve the repo root, open `/lantern-moth/index.html`, start, steer with arrows/WASD/swipe/d-pad,
  watch the gate warning toast and a gate swing, grab a lantern and eat a spider, lose all lives, retry.
- Check 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160: clean console, no horizontal scroll. Read the PNGs.
- `file://` play works; leaderboard is skipped there. Over HTTP the rank GET precedes a top-20 submit POST.
