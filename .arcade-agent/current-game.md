# Active game

**None.** No game is currently in development.

`zephyr-circuit/` was **released on 2026-08-29 (Pacific)** as a forced Saturday
release at 12 days old, and is marked complete by `zephyr-circuit/.aaa-complete`.
It is the featured game on the arcade home page and has been promoted to `main`.
Paradox Vault moved to the head of "More Games".

Read `zephyr-circuit/.aaa-complete` before assuming anything about its quality.
It shipped on the two-week clock, **not** on merit: no discipline ever recorded
a passing blind side-by-side critic verdict, and no shipping judge was run. What
release night verified is that the game is not broken — 237 tests green, all
three circuits completable with 8/8 karts finishing, six viewports swept with
the PNGs actually read, console clean, touch controls working. The carried debt
— FX, environment, kart models, audio, HUD/UI, and the total absence of
real-GPU validation — is listed in that file.

## Next run

Go to **STEP 2** and pick a new game. Choose something clearly different in
genre *and* core verb from every existing arcade game, scaffold a playable
vertical slice, and record the new slug and `started:` date here before writing
any code — that start date is what sets its own forced-release Saturday.

A game scaffolded now is 6 days old on 2026-09-05 (keep polishing) and 13 days
old on **2026-09-12**, which is its release Saturday.

### Genres already used, so the next pick must avoid them

3D kart racing (zephyr-circuit), time-loop stealth puzzle (paradox-vault),
side-scrolling beat-em-up (bayou-brawlers), tower defense
(aurora-tower-defense), brick breaker (neon-brick-breaker), twin-stick/arena
shooter (nova-striker), base builder (bastion-builder), roguelike descent
(crimson-descent), arcade action (core-crisis, emberfall-gauntlet,
midnight-menagerie).

### Two rules the human changed on 2026-08-17, still in force

* **The `file://` requirement is removed.** Games must work when served over
  HTTP from the repo root; that is how the site is actually played. Classic
  non-module scripts are no longer mandatory.
* **Vendoring an OFL-licensed UI font is allowed.**

What did **not** change: **no third-party runtime fetches.** Everything is
vendored and served from our own origin. Zephyr Circuit's hybrid layout —
pure logic as classic scripts on one global namespace so the `vm`-based Jest
harness can test it, renderer as ESM — is a good pattern to reuse if the next
game needs a heavy render dependency.

Work happens on the `dev` branch. Never `main`, except for the STEP 4 promotion.
