# Zephyr Circuit — build log

## 2026-08-17 — scaffold night (direction change)

**Context.** Cinderglass was deleted at the human's direction after they
played it: the loop was "paint heat and wait" and it was not fun. They chose a
Super Mario Kart clone with a new IP, explicitly asked to push for real 3D via
three.js, and asked for the scaffolding to be redone from scratch.

Two arcade rules were changed in the same conversation: the `file://`
requirement is **removed**, and vendoring an OFL-licensed UI font is
**allowed**. The no-third-party-fetch rule stands. See
`.arcade-agent/current-game.md`.

**Intent tonight:** a playable vertical slice — one track, one kart, drive it,
chase camera, laps counting. Not eight racers, not items.

Order of work, pushing after each:
1. Vendored deps + rule decisions recorded. *(done, pushed)*
2. `SPEC.md` — module contract, and the track model everything derives from.
3. `core.js`, `track.js`, `tracks.js` — the foundation.
4. `kart.js` — physics, drift, boost.
5. `race.js` — state machine, laps.
6. `render/*` — scene, track mesh, camera.
7. `index.html`, `ui.js`, `game.css`.
8. Jest suite + screenshot sweep.

**Status: in progress.**
