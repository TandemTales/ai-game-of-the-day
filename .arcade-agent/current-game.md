# Active game

**Slug:** `zephyr-circuit/`
**Title:** Zephyr Circuit
**started: 2026-08-17** (Pacific)
**Forced release Saturday: 2026-08-22** (Pacific)

## Pitch

Zephyr Circuit is a **3D kart racer** in the Super Mario Kart lineage, built
with **three.js** — low-poly flat-shaded karts drifting around floating sky
islands at golden hour, with waterfalls pouring off the edges into nothing.
Eight racers, a cup of tracks, items, and a drift-boost you charge by holding
a slide through a corner. Fall off the edge and you get fished out and dropped
back on the road, a few seconds poorer.

Core verb is **drive** — steer, drift, boost, block. Nothing else on the site
races.

## Direction change (read this before assuming history)

The previous pick, **Cinderglass**, was scaffolded on 2026-08-16 and
**deleted on 2026-08-17 at the human's direction**: the loop was "paint heat
and wait", and it was not fun. The whole directory and its tests were removed
rather than left as a dead branch. Do not resurrect it.

The human chose this direction explicitly, including the three.js bet, with
the instruction to push for it and redo the scaffolding from scratch.

## Why it is distinct

No racing game exists on the site, and no 3D game of any kind. Full
game-by-game justification lives in `zephyr-circuit/SPEC.md`.

## The three.js constraint, and how it is satisfied

three.js is **vendored into the repo** as a UMD build at
`zephyr-circuit/assets/js/vendor/three.min.js`, loaded with a plain `<script>`
tag and used through the `THREE` global. No CDN, no ES modules, no import
maps, no third-party runtime fetch. All geometry, colour and sky are generated
procedurally at boot — there are no model or texture files.

Vendoring rather than a CDN is deliberate and should stay: the site is static
on Cloudflare Pages with no backend but the leaderboard function, so a CDN
would add an availability dependency and a third-party request on every play
in exchange for nothing.

**Version is pinned to r160** because that is the last three.js release
shipping a UMD build — verified: r159 and r160 ship `build/three.min.js`, and
by r166 the builds are ESM-only. This only matters while the arcade requires
`file://` support, which is what forces classic scripts. r160 is comfortably
sufficient here: everything a low-poly kart racer needs (BufferGeometry,
flat-shaded materials, shadow maps, fog, instancing) has been stable since
~r140, and what r185 adds over it is WebGPU and node materials, neither of
which this game would use.

**Open question put to the human on 2026-08-17, not yet answered:** whether
`file://` support stays a hard rule or is demoted to a nice-to-have (demoting
it would unlock current three.js via vendored ESM), and whether vendoring an
OFL-licensed UI font is allowed. Neither blocks this game — the r160 plan
works under either answer. If the answer arrives, record it here.

## Quality references for critics

The bar for blind side-by-side comparisons is **Mario Kart 8 Deluxe** (kart
feel, drift-boost readability, track staging), **Super Mario Kart** (the
original's clarity and item balance), and **Art of Rally** (what low-poly
flat-shaded racing looks like when it is done to a shipped standard). "Good
for a browser game" is a failed critique.

## Next run

Read `zephyr-circuit/PROGRESS.md` first, then `zephyr-circuit/SPEC.md`
(authoritative, including the file-ownership table), then `TESTING.md`.

Work happens on the `dev` branch. Never `main`, except for the STEP 4 promotion.
