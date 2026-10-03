# Blastwick testing
* Logic: `npx jest blastwick` runs `__tests__/blastwick.test.js` (loads `logic.js` in a `vm` sandbox): determinism, spawn safety, blast/mirror geometry, bank-shot scoring, chain reactions, movement/bomb collision, AI-only full-match simulations (sudden death guarantees termination), AI aggression.
* Visuals: serve statically or open `index.html`; `?autostart=1` skips the title. `BW.debug` exposes `world()`, `start()`, `step(n)`. Sweep 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160 with Playwright (chromium at /opt/pw-browsers) and READ the PNGs.
* Touch: left stick, right BOMB button (pointer:coarse only).
