# Active game

**orbit-orchard** — A solar seed rolls through a derelict orbital greenhouse,
absorbing smaller relics to grow, bending nearby gravity as its mass increases,
and chaining constellation harvests before the station's orbit decays. The
core verb is steer-and-absorb, with keyboard, mouse, and touch drag controls;
score comes from mass gained, risk routes, and timed constellation chains.

`started: 2026-09-05` (Pacific). This is 7 days old on 2026-09-12, so it keeps
polishing on its first Saturday; it is 14 days old on 2026-09-19, its forced
release Saturday under the literal Pacific Saturday + 9-days rule.

The implementation is intentionally distinct from every current arcade game:
it is a top-down absorb-and-grow score attack, not a grapple platformer,
racer, stealth loop, beat-em-up, defense/building game, brick breaker, shooter,
descent, pinball scaffold, exploration game, or memory puzzle.

---

## Previous release

**Active:** `orbit-orchard` is currently in development.

`stormhook/` was **released on 2026-09-05 (Pacific)** as a forced Saturday
release at 9 days old, and is marked complete by `stormhook/.aaa-complete`. It
is the featured game on the arcade home page and has been promoted to `main`.
Zephyr Circuit moved to the head of "More Games".

Read `stormhook/.aaa-complete` before assuming anything about its quality. It
shipped on the two-week clock, **not** on merit: the renderer and UI critics
both stood at **FAIL** against their shipped-AAA references, audio/VFX/textures
were never judged at all, and no shipping judge was ever run. What release night
verified is that the game is not broken — 329 tests green, all five levels
cleared in a real browser with a live 510 px/s swing and live rope wrapping, six
viewports swept with the PNGs actually read, console clean, no horizontal
scroll. One glaring defect was found and fixed on the night: the STORMHOOK
wordmark overflowed its card and clipped the final K on every viewport >= 768px.

## Previous next-run note

Go to **STEP 2** and pick a new game. Choose something clearly different in
genre *and* core verb from every existing arcade game, scaffold a playable
vertical slice, and record the new slug and `started:` date here before writing
any code — that start date is what sets its own forced-release Saturday.

### How the release clock actually works — earlier runs got this wrong

Stormhook's own log spent a week targeting 2026-09-12, which would have been its
**third** Saturday and a three-week cycle. The rule is literal and it is the
`started:` date in this file that feeds it: *Pacific Saturday + started 9 or
more days ago = forced release.* A game scaffolded tonight (Saturday) is 7 days
old on its first Saturday — under the threshold, keep polishing — and 14 days
old on its second, which is the release. Write the arithmetic into the new
game's `current-game.md` section and do not re-derive it from vibes.

A game scaffolded now is 7 days old on 2026-09-12 (keep polishing) and 14 days
old on **2026-09-19**, which is its release Saturday.

### Genres already used, so the next pick must avoid them

Grapple-swing momentum platformer (stormhook), 3D kart racing (zephyr-circuit),
time-loop stealth puzzle (paradox-vault), side-scrolling beat-em-up
(bayou-brawlers), tower defense (aurora-tower-defense), brick breaker
(neon-brick-breaker), twin-stick/arena shooter (nova-striker), base builder
(bastion-builder), roguelike descent (crimson-descent), arcade action
(core-crisis, emberfall-gauntlet, midnight-menagerie).

### Two rules the human changed on 2026-08-17, still in force

* **The `file://` requirement is removed.** Games must work when served over
  HTTP from the repo root; that is how the site is actually played. Classic
  non-module scripts are no longer mandatory.
* **Vendoring an OFL-licensed UI font is allowed.**

What did **not** change: **no third-party runtime fetches.** Everything is
vendored and served from our own origin.

### The verification lesson worth carrying to the next game

Stormhook shipped a fatal `ReferenceError` in `render.js` to `dev` for a full
day while its Jest suite stayed green at 308 tests, because a `vm`-based
harness never executes a draw path. **Build the new game with a real-browser
smoke test from the start** (`stormhook/tools/smoke.js` is the model: boot,
input-driven play, every level cleared, death and restart, console and network
assertions) and run it before every push. The headless browser *is* available
in this sandbox — Chromium at `/opt/pw-browsers`, only the npm driver missing;
see `stormhook/TESTING.md` for the exact two-minute recipe, including why
`SH_CHROME` is mandatory and why `npx playwright install` is the wrong fix.
Several runs wrongly recorded it as unavailable and fell back to code review.

Work happens on the `dev` branch. Never `main`, except for the STEP 4 promotion.
