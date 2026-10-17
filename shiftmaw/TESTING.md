# Shiftmaw — Testing

## Headless logic suite
`npx jest shiftmaw` — loads `levels.js` and `sim.js` directly (no DOM). Covers:
- every maze parses and every mote/bloom/fruit/start is reachable in **both** phases (level solvability);
- Day/Dusk wall solidity, nest rules;
- determinism for a seed; a greedy bot clears motes without entering walls;
- all four Hollows leave the nest; flip needs charge, cooldown, and is refused if it would entomb the player;
- pinch scoring and chain (400 + 800), life loss and game over, bloom fright and 200 ghost bonus, level clear and spare-charge bonus.
Never commit a failing suite.

## Visual / viewport checks
Serve the repo (`python3 -m http.server 8765`) and drive Chromium with `playwright-core`
(`executablePath: /opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `--no-sandbox`). The page exposes `window.__shiftmaw`
(`start()`, `.sim`) and `window.SM` for scripted input, e.g. `SM.Sim.setWant(__shiftmaw.sim, 1)`, `SM.Sim.flip(__shiftmaw.sim)`.
Check 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160: no horizontal scrollbar, console clean (the only expected error
offline is the blocked Google tag script), HUD readable, flip button and d-pad reachable on touch, maze fully visible.
Read the PNGs — a screenshot not looked at verifies nothing.
