# Active game

**Lumen Pinnacle** (`lumen-pinnacle/`)

A jewel-box neon pinball table for the Bot Built Arcade. The player controls
left and right flippers to keep a luminous energy orb alive, banks shots into
three prism targets, threads multiplier lanes, and starts a short multiball
when the table is mastered. It is a score-first classic arcade game with
mouse, touch, and keyboard controls, designed to be clearly distinct from the
catalog's racing, combat, puzzle-stealth, defense, builder, shooter, and
descent games.

`started: 2026-08-29` (Pacific)

This is a new-game scaffolding night. Build a playable vertical slice first;
the forced release Saturday is 2026-09-12.

## Catalog inventory used for the selection

3D kart racing (zephyr-circuit), time-loop stealth puzzle (paradox-vault),
side-scrolling beat-em-up (bayou-brawlers), tower defense
(aurora-tower-defense), brick breaker (neon-brick-breaker), twin-stick/arena
shooter (nova-striker), base builder (bastion-builder), roguelike descent
(crimson-descent), and arcade-action variants (core-crisis,
emberfall-gauntlet, midnight-menagerie). The root page also has stale links to
`memory-match` and `ocean-explorer`, but those directories are absent.

## Working rules

The game must run over HTTP from the repo root with no third-party runtime
fetches. Vendored assets are allowed. Work happens on `dev`; `main` is touched
only during STEP 4 promotion.
