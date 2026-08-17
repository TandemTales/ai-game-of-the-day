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

## Dependencies, and the rules as they now stand

Two arcade rules were changed by the human on 2026-08-17, in this session:

* **The `file://` requirement is removed.** It was the only thing forcing
  classic non-module scripts. Games must now work when served over HTTP from
  the repo root; that is how the site is actually played.
* **Vendoring an OFL-licensed UI font is allowed.**

What did **not** change, and should not: **no third-party runtime fetches.**
The site is static on Cloudflare Pages with no backend but the leaderboard
function, so a CDN would add an availability dependency and a third-party
request on every play in exchange for nothing. Everything is vendored into the
repo, served from our own origin. Same-origin fetches of files we authored are
fine — the leaderboard already does two.

### What is vendored

```
assets/js/vendor/three.module.min.js     three.js r185, ESM build
assets/js/vendor/addons/postprocessing/  EffectComposer, RenderPass, ShaderPass,
                                         OutputPass, UnrealBloomPass, FXAAPass,
                                         MaskPass, Pass
assets/js/vendor/addons/shaders/         Copy, Output, LuminosityHighPass, FXAA
assets/fonts/outfit-{500,700,900}.woff2  UI + HUD (SIL OFL)
assets/fonts/bungee-400.woff2            wordmark only (SIL OFL)
```

Both font licences are checked in beside the files, as is three's.

**Why r185 ESM and not the r160 UMD build.** With `file://` gone there was a
real choice. The last UMD build is r160, it prints a deprecation warning on
load (which would breach "console clean" unless the vendored file were
hand-edited), and it is the end of that line. The ESM build is current and its
`examples/jsm` post-processing passes are directly usable — which matters,
because bloom is a large part of making flat-shaded low-poly read as shipped
rather than as programmer art.

### Module layout — deliberate hybrid, do not "tidy" it

* **Pure game logic is classic scripts on `window.ZC`**: track geometry, kart
  physics, race rules, AI. These import nothing, know nothing about three.js,
  and are loaded with plain `<script>` tags. That is what keeps them testable
  in the `vm`-based Jest harness the rest of the arcade already uses, with no
  changes to the repo's Jest config.
* **Only the render layer is ESM**, loaded with `<script type="module">` and
  an import map for the bare `three` specifier. Module scripts are deferred,
  so every classic script has already run and `window.ZC` is fully populated
  before the renderer boots.

Rendering needs a real GPU and is verified by the screenshot sweep, not by
unit tests. Logic is verified by unit tests. The split follows that line.

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
