# Cinderglass — build log

## 2026-08-16 (Sun) — scaffold night 1

**Intent:** STEP 2 scaffold. Paradox Vault shipped 2026-08-15, so tonight picks
and scaffolds a new game. Goal is a *playable vertical slice*, not polish.

Chosen: **Cinderglass**, a falling-sand thermodynamics puzzle. Core verb is
"change the temperature of matter" — you never dig or place, you only heat and
chill, and shape follows from phase changes. See `.arcade-agent/current-game.md`
for the pitch and `SPEC.md` for the distinctness argument.

Planned for tonight, in order (push after each):
1. `.arcade-agent/current-game.md` + this file. *(pushed first, before code)*
2. `SPEC.md` — module contract and file-ownership table.
3. `assets/js/sim.js` — the cellular-automata core. Everything depends on it.
4. `index.html` + `core.js` + `game.js` — shell, loop, input, state machine.
5. `render.js` — world renderer.
6. `levels.js` — contracts, plus win/score rules.
7. `audio.js` / `ui.js` / `css` — fan-out once the core is stable.
8. Jest suite + `TESTING.md`.

**Status: in progress.**
