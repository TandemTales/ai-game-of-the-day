# Orbit Orchard — Progress

## 2026-09-05 (Saturday, Pacific) — scaffold

Selected after Stormhook's forced release. Orbit Orchard is a distinct
steer-and-absorb score attack: a solar seed rolls through a procedural orbital
greenhouse, grows by taking smaller relics, bends their trajectories with its
mass, links same-color harvests, and avoids timed gravity wells.

### Landed in the vertical slice

- Responsive HTTP shell with start and game-over overlays, HUD, touch/mouse drag
  guidance, keyboard controls, and the standard rank-first leaderboard flow.
- Deterministic global `OO` logic with 56 relics, four animated gravity wells,
  inertia, arena bounds, growth, score multipliers, same-color links, particles,
  a timer, and procedural greenhouse rendering.
- SPEC, testing contract, and root Jest coverage for the mechanics and API shape.

### Verified

- Dedicated Jest: 11 tests passed. Full repository Jest: 14 suites / 340 tests
  passed. `node --check orbit-orchard/assets/js/game.js` and `git diff --check`
  passed.
- Real-browser HTTP smoke in the Codex in-app browser: start overlay cleared,
  the seed moved from a drag, score/mass/time updated, the run reached natural
  `ORBIT DECAYED` with the final-score overlay, and `REPLANT` returned to a
  fresh `01:05` run. The initial and live canvas screenshots were opened and
  read; no horizontal overflow and no browser warning/error logs were found.
- Catalog wiring is present: Orbit Orchard is Featured Game with its own rate
  id and leaderboard link, and Stormhook is the first More Games entry.
- Intent was pushed as `e44020c`; the playable scaffold and catalog update were
  pushed as `bfc77fd` on `dev`.

### AAA / release gate

- No critic verdicts yet. No `.aaa-complete`, no release, and no `main`
  promotion are authorized on scaffold night.

### Next run

Read this file, `SPEC.md`, and `TESTING.md`. Run the dedicated and full Jest
suites plus a real-browser smoke and six-viewport screenshot sweep. Then take
two bounded polish areas—likely the greenhouse composition and the seed/relic
material language—through independent shipped-AAA side-by-side criticism.
