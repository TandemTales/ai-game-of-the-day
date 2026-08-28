# Zephyr Circuit — build log

## 2026-08-17 — scaffold night (direction change)

**Outcome: a playable 3D vertical slice, verified in a browser.** Eight
karts race three laps of a floating sky island at golden hour, with drift,
drift-boost, lap timing, placement, a live HUD and touch controls. 46
headless tests, 174 across the arcade, all green.

### Context

Cinderglass was deleted at the human's direction after they played it — the
loop was "paint heat and wait" and it was not fun. They chose a Super Mario
Kart clone with a new IP, asked to push for real 3D via three.js, and asked
for the scaffolding to be redone from scratch.

Two arcade rules changed in the same conversation, both recorded in
`.arcade-agent/current-game.md`:

* **The `file://` requirement is removed.** It was the only thing forcing
  classic non-module scripts.
* **Vendoring an OFL-licensed UI font is allowed.**

The no-third-party-fetch rule stands and should stay. Everything is
vendored: three.js r185 (ESM), its postprocessing passes, Outfit and
Bungee. No CDN, no runtime dependency on anyone else's uptime.

### Architecture, and why it is split in two

`SPEC.md` is authoritative. The load-bearing decisions:

1. **Everything derives from one closed centreline spline.** The road mesh,
   lap counting, the off-track test, respawn and the AI racing line are all
   projections against the same baked, uniform-arc-length segment arrays.
   Uniform spacing is what makes each query O(1) instead of a search.
2. **Pure logic is classic scripts on `window.ZC`; only the renderer is
   ESM.** Track maths, kart physics, AI and race rules import nothing and
   know nothing about three.js, so they load into the same `vm`-based Jest
   harness the rest of the arcade uses with no change to the repo's Jest
   config. Rendering needs a GPU and is verified by screenshots instead.
   **Do not "tidy" this into one module system.**

### Nine bugs, and how each was found

Not one of these was visible by reading the code.

**Track and physics — found by running headless probes:**

1. Gullwing Bay's first draft doubled back through the middle of the island
   and **overlapped its own road surface by 20m**, which silently breaks lap
   counting and the off-track test in that region. The circuit is now laid
   out as a ring whose bearing from the origin only decreases, making
   self-intersection geometrically impossible; the suite asserts 15m of
   edge clearance.
2. Camber was hand-authored per control point and drifted out of step with
   the geometry. It is derived from curvature at bake time now.
3. The shoulder was 3m wide, so a merely untidy line fell off the world.
4. **Molten-iron-style bug in the kart:** the acceleration step overshot its
   own speed cap because the last increment was not clamped.

**AI — found by racing a field and reading the results table:**

5. The corner-speed limit treated `steerMax` as a lateral acceleration and
   took `sqrt(a/k)`. It is a yaw **rate**, so the limit is
   `steerMax*steerFactor(v)/k`. The wrong formula braked to 9 m/s for
   corners the kart could take flat and turned 40-second laps into 1:25.
6. **Skill was not monotonic.** Raising it raised aggression, so the
   highest-rated driver drifted off every corner and finished last. Skill
   now buys precision and judgement. A field whose ratings do not predict
   the result is worse than no ratings.

**Renderer — found by looking at screenshots:**

7. r185's ESM build is split; `three.module.min.js` imports a
   `three.core.min.js` chunk that was not vendored, so nothing loaded at all.
8. **The road ribbon was wound backwards** and was back-face culled for
   several iterations. The circuit rendered with kerbs and a start line and
   *nothing between them*; what showed through was the island's rock
   underside, which read as "the road is brown and ribbed". The island
   interior had the same fault. Both are double-sided now.
9. Fog density was set for a small scene — at 0.0016 the far side of a 400m
   island was already half fog and the world was one flat tan wash.

Isolating #8 took hiding the island mesh and re-shooting. That trick is
written up in `TESTING.md`; it is the fastest way to turn "the ground looks
wrong" into "the road does not exist".

### Measured feel

* 0 to 97 km/h in about 4 seconds; drift boost peaks at 137 km/h.
* Crude centreline driver: 40s laps, no falls. Same driver drifting: 36.7s.
  **Drifting is worth ~3.7s a lap** — that is the skill ceiling working.
* Eight-kart field finishes in skill order, 13.4s from first to last over
  three laps, zero falls.

### Verified in a browser

All six required viewports boot, race and show a live HUD with **no
horizontal scroll** and no console errors of our own. HUD collisions found
and fixed at 844x390 (lap over clock, speed under the buttons) and at
390x844 (speed behind the steering pad). The camera now tilts down as the
aspect narrows, because three.js FOV is vertical and a portrait phone was
spending half the frame on sky.

**FPS here is not a real number** — the sandbox has no GPU, so Chromium
falls back to swiftshader. Treat it as relative only.

## 2026-08-18 — polish night 1 (in progress)

Plan, in the order the previous run recommended:

1. **`items.js`** — the item game. Pure logic, unit tested. Biggest missing
   piece of the genre.
2. **Two more circuits** in `tracks.js`, so the cup is a cup.
3. Fan out the render disciplines against blind side-by-side critics:
   road surface + island dressing + waterfalls (`render/scene.js`,
   `render/trackmesh.js`), eight distinct kart models (`render/karts.js`),
   and particles (`render/fx.js`, which does not exist yet).

Forced release was believed to be Saturday 2026-08-22 at the time; see the
2026-08-20 entry — it is actually 2026-08-29. Entry rewritten at the end of the run with what actually landed.

## 2026-08-19 — polish night 2 (in progress)

The 2026-08-18 run was killed mid-flight by the usage limit. What it
landed before dying, per the log: `items.js` (six items, rubber-banded
roulette, 28 tests), two more circuits so the cup is three tracks with
championship points, and `render/items.js` so boxes, shells, hazards and
shields are actually drawn. Baseline on entering tonight: **237 tests
green across the arcade.**

That closes the top two "do this first" items from the previous handoff.
Everything still outstanding is **visual**, which is exactly what the
critic loop exists for. Tonight is a render night — three disciplines,
each with its own blind side-by-side critic:

1. **agent-render** — `render/scene.js` + `render/trackmesh.js`. The road
   surface is flat dark grey with no racing line, no wear, no texture;
   the island is bare; and the waterfalls that were in the original pitch
   were never built.
2. **agent-models** — `render/karts.js`. Eight racers that are the same
   primitive shell in eight paint colours. They need to read as eight
   characters.
3. **agent-particles** — `render/fx.js`, which does not exist yet. No
   drift sparks, no boost trail, no speed lines, no dust, no impact.

Lead keeps `main.js`, `index.html` and the SPEC. Entry rewritten at the
end of the run with what actually landed and each critic's verdict.

Forced release Saturday was believed to be **2026-08-22** at the time; see
the 2026-08-20 entry — it is actually **2026-08-29**.

## 2026-08-20 — polish night 3 (in progress)

**The forced release Saturday was recorded wrong, and is corrected tonight.**
Every prior entry says 2026-08-22. The rule is: forced release requires the
Pacific weekday to be Saturday **and** the game to be **9 or more days old**.
Zephyr Circuit started 2026-08-17, so on 2026-08-22 it is **5 days old** — it
skips that Saturday, which is exactly what the two-week cadence is for. The
real forced release is **Saturday 2026-08-29**, when it is 12 days old. That
is nine more nights after tonight, not two. Do not shorten it back.

Baseline entering tonight: **237 tests green** across the arcade. The
2026-08-19 run was killed by the usage limit after landing only the `fx.js`
stub and its frame-loop wiring, so all three render disciplines it planned
are still outstanding. Tonight runs them, each against a blind
side-by-side critic:

1. **agent-particles** — `render/fx.js`. Still the placeholder that returns
   empty callbacks. Drift sparks, boost trail, speed lines, dust, impacts.
2. **agent-track** — `render/trackmesh.js`. Road surface is flat dark grey;
   the island is bare; the waterfalls from the pitch were never built.
3. **agent-models** — `render/karts.js`. Eight racers that are one primitive
   shell in eight paint colours.

Lead keeps `main.js`, `scene.js`, `index.html`, the SPEC and all git.
Entry rewritten at the end of the run with what actually landed and each
critic's verdict.

## Where it is below the AAA bar

**No critic loop has been run.** No discipline has a blind side-by-side
verdict against Mario Kart 8, Super Mario Kart or Art of Rally. Tonight was
scaffolding.

1. **No items.** `items.js` is in the SPEC's ownership table and does not
   exist yet. A kart racer without an item game is missing half its design.
2. **One circuit.** The cup is one track, three laps. Needs at least three.
3. **Kart models are primitives.** Readable silhouette, no personality, no
   distinct characters — every racer is the same shell in a different
   colour.
4. **No shadows in practice.** They are implemented but the adaptive
   quality controller drops to tier 0 under swiftshader, so they were never
   really seen. Needs checking on real hardware, and the sun sits low
   enough that shadow acne is a live risk.
5. **The road surface is flat dark grey.** No texture, no racing line, no
   patching or wear. Kerbs carry all the visual information right now.
6. **The island is bare.** No trees, rocks, buildings, spectators, or
   anything at the edges. A sky island should have waterfalls pouring off
   it — that was in the pitch and is not built.
7. **Audio is a working floor**: one sawtooth engine, filtered noise scrub,
   four blips. No music.
8. **No countdown staging, no results-screen drama, no boost screen shake.**

## What the next run should do first

1. **Items** (`items.js`), because it is the biggest missing piece of the
   genre and it is pure logic, so it is testable.
2. **Two more circuits.** The track format makes this cheap; keep them
   star-shaped and let the suite check the clearance.
3. Then fan out per `SPEC.md`'s ownership table: agent-render (road surface,
   island dressing, waterfalls), agent-models (eight distinct karts),
   agent-particles (drift smoke, speed lines, boost trails), agent-audio,
   agent-ui — each against a harsh blind-comparison critic.

Forced release Saturday is **2026-08-29** (corrected 2026-08-20).

## 2026-08-23 — polish night 4

**Outcome: three major render disciplines landed and the game remains fully
working, but none earned an AAA critic pass. This is not release-ready.**
Pacific date was Sunday 2026-08-23, six days after the 2026-08-17 start, so no
release was attempted. Every implementation unit and critic-loop revision was
pushed independently; final implementation tip is `1d94401` before this
handoff-only commit.

### What landed

**Race effects (`render/fx.js`):** the existing pooled system is now
deterministic per track and has compact tier-colored rear-contact drift cores,
directional sparks and slip smoke, attached twin boost jets and wake, quieter
rival effects, collision-specific flash/debris, and much sparser
travel-projected speed lines. The last pass mirrors each kart's authored rear
axle instead of using one generic effect origin. API, pooling, quality tiers and
the allocation-free update path remain intact.

**Track world (`render/trackmesh.js`):** all three circuits now have a rubbered
groove, broken accent racing line, repair patches, explicit verges, four layered
waterfalls with mist, themed central landmarks, instanced vegetation,
satellite islands and a lit start gate. Gullwing Bay gets a lighthouse, Thermal
Spire crystals and Cirrus Run a turbine. Everything is generated once at build
time and the existing `buildTrack(track)` API is unchanged.

**Racer models (`render/karts.js`):** the field is no longer one shell in eight
colors. The eight IDs have distinct bird, mantis, turbine, hot-rod, sun,
thorn, armored and forest silhouettes; larger driver signatures; visible
arms/controls; connected axles, rails, cockpit backs and fenders; separated
paint, metal, rubber, canopy and emissive materials; and stronger steering,
wheel, suspension and driver motion. Geometry/material caches and the
allocation-free sync path remain.

### Harsh critic verdicts

Every first comparison was a **FAIL / ours loses** against real Mario Kart 8
Deluxe frames; the track critic also used Art of Rally. No lenient verdict was
converted into a pass.

* **FX — FAIL after two reviewed iterations.** The first frame lost because
  sparks, smoke and boost bloom were decorative and detached. The second
  preserved silhouettes but still lost on contact ownership and causal
  drift-charge-to-boost grammar. A final exact-axle/focus-kart pass landed
  afterward, but did not receive another independent verdict tonight; do not
  infer a pass.
* **Karts — FAIL after two reviewed iterations.** Color separation and
  archetype variety improved, but the critic still found character silhouettes,
  believable mechanical assembly, material separation and demonstrated motion
  below Mario Kart 8 Deluxe. A final silhouette/assembly/value pass landed
  afterward, but did not receive another independent verdict; do not infer a
  pass.
* **Track/environment — FAIL.** The S-curve, glowing gate and kerbs read, but
  the critic found the asphalt too black/flat, verges and vegetation too
  uniform, lighting interaction weak, and no waterfall visible as a normal
  racing hero vista. The implementation is a large step above the scaffold,
  not an AAA pass.

### Verification

* Full arcade Jest suite: **9/9 suites, 237/237 tests passed** after the final
  code changes.
* `node --check` and `git diff --check`: passed for every landed render file.
* Final moving-race screenshot sweep completed at **320x568, 390x844,
  844x390, 768x1024, 1440x900 and 3840x2160**. Lead read all six PNGs.
* Every viewport booted the renderer, ran an eight-kart race, and reported
  **no horizontal scroll**. There were no app page errors or console errors.
  The only console messages were the documented SwiftShader ReadPixels
  performance warnings; the Google tag remained the only non-local request.
* Touch controls and HUD remained visible at all four mobile/tablet sizes.
  The software-rendered FPS numbers are not hardware performance evidence.

### Current discipline status

* Logic/gameplay: **PASS** (237 tests; three tracks, items and cup intact).
* Browser boot/responsiveness/console: **PASS** at all required viewports.
* FX visual bar: **FAIL / final pass unjudged**.
* Kart visual bar: **FAIL / final pass unjudged**.
* Track/environment visual bar: **FAIL**.
* Audio, UI drama and real-hardware shadows: not advanced tonight and still
  below the stated AAA bar.

### Remaining AAA debt and next run first

1. **Track first.** Make the waterfall a mandatory chase-camera hero vista
   with a rock channel/basin, whitewater and wet contact; build a real
   curb-to-shoulder-to-groundcover hierarchy; vary and cluster props; lighten
   and materially break up the asphalt; then rerun the Art of Rally/Mario Kart
   critic. Scene lighting/exposure belongs to `scene.js`, not `trackmesh.js`.
2. Re-critic the final exact-axle FX and final kart silhouettes with moving,
   player-focused proof before changing them again. Their last revisions are
   **not passes merely because the run ended**.
3. Then take audio/music and countdown/results/camera drama as the next bounded
   disciplines. Check shadows on real GPU hardware rather than SwiftShader.

Forced release remains **Saturday 2026-08-29**. Until then, keep polishing; do
not ship early without every critic passing and the independent shipping judge.

## 2026-08-23 — held-item HUD follow-up

Players can now see the item they are carrying. The race HUD shows the item's
authored glyph, color and full name, distinguishes roulette and empty states,
and keeps the desktop `E / Ctrl` use hint visible. On touch screens the same
panel is also a large item-use button, so no extra control is required. This
uses the six procedural glyph/color definitions already owned by `items.js`;
new raster art was unnecessary and would have conflicted with the game's
code-native visual system.

Verification: the full arcade suite remains **9/9 suites, 237/237 tests
passed**; `node --check` and `git diff --check` passed. The held-item state was
visually inspected at **320x568, 390x844, 844x390, 768x1024, 1440x900 and
3840x2160** with no horizontal scroll or app console/page errors. The 320px
layout received a dedicated width correction so `Zephyr Dart` is not
truncated. A real pointer down/up on the touch panel consumed exactly one item,
changed the HUD to Empty, and left virtual input released.

## 2026-08-23 — polish night 5 intent

Tonight is a bounded visual pass, not release night: Pacific Sunday, six days
after the 2026-08-17 start. The forced release remains Saturday 2026-08-29.
The first priority is `render/trackmesh.js`: make the waterfall a mandatory
chase-camera hero vista, establish a clear curb-to-shoulder-to-groundcover
hierarchy, vary and cluster the props, and break up the asphalt enough to
survive a blind Mario Kart 8 Deluxe / Art of Rally comparison. In parallel,
the final `render/fx.js` and `render/karts.js` revisions will receive fresh
moving-race side-by-side critic verdicts; they are not passes merely because
the previous run ended. The lead will keep all integration files and git.

### Karts unit landed

`render/karts.js` now exposes cached wheel struts and subtle suspension travel
driven by speed, slip and vertical motion, so each wheel reads as part of a
working machine during a moving race. API, racer IDs, geometry/material caches
and the allocation-free sync path remain intact. Node syntax, browser reload,
and the Zephyr suite passed (109/109). The blind Mario Kart 8 Deluxe / Art of
Rally critic verdict is still pending; this is not an AAA pass yet.

### FX unit landed

`render/fx.js` now transforms effect anchors through kart pitch and roll plus
banked-road contact, and its boost/smoke anchors match the authored rear flame
offset. Pools, quality tiers, public API and the allocation-free update path
remain intact. Node syntax, static contract checks and the Zephyr suite passed
(109/109). The moving-race screenshot re-critic is still pending; no visual
pass is inferred from code review alone.

### Track/environment unit landed

`render/trackmesh.js` now adds procedural asphalt breakup, explicit
curb-to-shoulder-to-groundcover layers, clustered low cover and rocks, plus a
hero waterfall channel with wet contact, whitewater, basin and plunge-rock
staging. The existing `buildTrack(track)` API and frame-loop contract remain
unchanged. Node syntax, the Zephyr suite (109/109), and a 1440x900 browser
reload passed. The focused worker sweep reported a SwiftShader context-loss
risk and did not prove a clean mandatory waterfall vista, so the independent
track critic verdict is still pending.

### Critic loop 1 — all three disciplines failed

The independent blind comparisons were not lenient. Track/environment failed
against Nintendo's official Shy Guy Falls frame and an official Art of Rally
frame: asphalt and edge layers remained flat, props repeated, and the new
waterfall was not readable in the chase-camera proof. FX failed against Mario
Kart 8 Deluxe references because the stills did not prove tire-attached drift
sparks, a player-focused boost flame, readable slipstream, or collision grammar.
Karts failed against Mario Kart 8 Deluxe and Art of Rally because the silhouettes
still collapsed to box chassis plus cylinders, with weak mechanical assembly,
flat materials and primitive driver posture.

### FX critic-loop revision landed

`render/fx.js` now gives the focus kart larger tier-colored rear-contact sparks
with charge swell and inside-wheel bias, brighter authored boost cores and
directional flame trails, stronger relative-velocity wake, and larger
kart-rooted collision flashes/shards. The API, pools, quality tiers and
allocation-free update path remain intact. Node syntax and the Zephyr suite
(109/109) passed. A forced active-state screenshot was not completed, so the
new visual bar remains unjudged.

### Track critic-loop revision landed

The first environment critic specifically found that the waterfall existed in
code but vanished from the chase proof. `render/trackmesh.js` now puts the
hero beside the opening racing line, brightens the asphalt breakup, uses a
camera-facing curtain for the short readable drop, and adds a depth-prioritized
foam splash/bubbles in front of the rock basin. The long fall, wet channel and
basin remain for depth. Node syntax and the Zephyr suite (109/109) passed, and
a fresh moving 1440x900 frame was inspected with the shoulder water curtain and
foam visible. The independent second critic verdict is still pending.

### Track presentation refinement

The opening curtain was too large and opaque in the six-viewport sweep, so the
track worker pulled it behind the basin, reduced its width/height/opacity,
restored normal depth testing and lowered the foam/bubble priority. The refined
390x844 and 1440x900 frames keep the water outside the mobile racing view and
show a smaller far-right basin accent on desktop. The full sweep covered
320x568, 390x844, 844x390, 768x1024, 1440x900 and 3840x2160 with no app errors
or horizontal scroll. The fresh critic verdict is pending.

### Karts critic-loop revision landed

`render/karts.js` now adds cached hub caps, toroidal wheel collars, visible
wheel wells, paired suspension/control arms, stronger structural value
separation, and per-profile driver lean, scale, shoulder, hand, steering-control
and posture variation. Eight IDs, exports, caches, dynamic steering/suspension
and allocation-free `syncKart` remain intact. Node syntax, the Zephyr suite
(109/109), and a moving 1440x900 browser frame passed. This revision still
needs an independent AAA critic verdict; SwiftShader is not real-GPU evidence.

### Critic loop 2 — all three disciplines still failed

The second blind environment comparison now acknowledged visible water but
still called it an overexposed cyan/white VFX slab rather than physical water,
with sparse dressing and weak material integration. The second FX comparison
found improved energy but ambiguous tire attachment, tier colors, boost
direction and collision semantics. The second kart comparison found better
color/accessory identity but still rejected the repeated chassis grammar,
primitive driver/control relationship and weak mechanical assembly.

### Track water-material revision landed

`render/trackmesh.js` replaces the bright hero curtain and splash materials with
subdued depth-tested Standard water, lower emissive intensity and opacity, and
narrow muted foam ribbons. The basin, wet channel, rocks, opening placement and
APIs remain. Node syntax, the Zephyr suite (109/109), and a fresh 1440x900
moving frame passed; the water was reported translucent teal behind the basin.

### FX grammar revision landed

`render/fx.js` now uses tighter rear-axle drift emission with explicit pale-blue,
blue, orange and pink tier palettes, a compact travel-aligned exhaust, darker
sparser generic streaks, and a separate short yellow collision flash with
smaller shards. Public API, pooling, quality tiers and the allocation-free
update path remain intact. Node syntax, static checks, the Zephyr suite
(109/109), and forced active 1440x900/390x844 frames passed. A fresh critic
verdict is still required.

## 2026-08-23 — polish night 5 handoff

This bounded Sunday pass is complete on `dev`; no release was attempted. The
forced release remains Saturday 2026-08-29. Track water was materially toned
down after the second critic called it an overexposed cyan slab, and the FX
pass now has tighter rear-axle emission, explicit tier palettes, compact
travel-aligned boost exhaust, darker speed lines and a separate collision
flash. Karts retain the stronger wheel assemblies, suspension and driver
postures from this run.

### Final verification

* Full arcade Jest suite: **9/9 suites, 237/237 tests passed**.
* `node --check` passed for `trackmesh.js`, `fx.js` and `karts.js`; `git diff --check` passed.
* The final moving-race sweep covered **320x568, 390x844, 844x390, 768x1024,
  1440x900 and 3840x2160**. All six reached `phase=racing`, had no horizontal
  scroll, and had no app page errors. SwiftShader `GPU stall due to
  ReadPixels` warnings and the existing Google tag requests are the only
  observed non-app noise.
* The revised FX active frame was independently reviewed against Nintendo's
  official Mario Kart 8 Deluxe presentation. **FAIL:** tire contact and
  effect ownership still read weakly; boost/collision direction is ambiguous;
  tier/state readability and material hierarchy remain below AAA.

### Current status and next run

Logic/gameplay and browser boot/responsiveness pass. The track/environment,
FX and kart visual disciplines still fail the independent AAA comparison;
audio, UI/camera drama and real-GPU shadow validation remain debt. The next
run should start by fixing tire/contact and effect ownership, then rerun the
track and kart critics before taking on audio, countdown/results drama and
camera presentation. No `.aaa-complete` was written, `.arcade-agent/current-game.md`
remains active for Zephyr Circuit, and `main` was not touched.

## 2026-08-24 — polish night 6 intent

Pacific Monday, seven days after the 2026-08-17 start: this is not release
night. Tonight is a bounded critic-led pass on the two most actionable visual
failures from the prior handoff: make drift/boost/collision effects visibly
belong to the focus kart's tires and travel direction in `render/fx.js`, and
make the track's curb-to-shoulder-to-groundcover and waterfall hero read as a
coherent racing environment in `render/trackmesh.js`. Each worker owns only
its SPEC-assigned file; the lead owns integration, tests, screenshots and git.
No release or `main` update is planned tonight.

## 2026-08-24 — polish night 6 handoff

Two file-isolated render passes landed and were pushed to `dev` as
`03e7534` and `2425cd1`. `render/trackmesh.js` now has a lighter, more
materially varied asphalt and shoulder ladder, clustered/value-varied growth,
subdued depth-tested waterfall sheets plus staggered low-poly stream columns,
and a slimmer start gate whose old emissive cone wings had read as floating
flags. `render/fx.js` now emits a short-lived bright core at the inside rear
tyre and strengthens the focus-kart contact flare while preserving the pooled,
allocation-free update path.

### Verification

* Full arcade Jest suite: **9/9 suites, 237/237 tests passed**.
* `node --check` passed for both changed render modules; the Zephyr logic suite
  remained **109/109**.
* Fresh in-app browser sweep covered **320x568, 390x844, 844x390, 768x1024,
  1440x900 and 3840x2160**. All six had exact viewport dimensions, no
  horizontal overflow, and no app errors or warnings. Desktop and mobile
  post-countdown PNGs were read from
  `C:\Users\jshun\AppData\Local\Temp\zephyr-night6-20260824`.

### Honest quality status

The visual health checks pass and the road/gate presentation is materially
better, but this is **not an AAA critic pass**. The waterfall is still not a
hero vista in the inspected chase frame, the stylized island dressing remains
below Mario Kart 8 Deluxe / Art of Rally material richness, and the FX change
was not independently judged in a forced drift/boost/collision comparison
because the worker critic loops stalled and were closed. No `.aaa-complete`
was written, no shipping judge was run, and `main` was not touched.

Next run: obtain fresh independent track and FX side-by-side verdicts with
forced active states, then address the worst remaining visual loss before the
forced release Saturday 2026-08-29. Audio, UI/camera drama and real-GPU
shadow validation remain debt.

## 2026-08-25 — polish night 7 intent

Pacific Tuesday, eight days after the 2026-08-17 start. Not release night; the
forced release is Saturday 2026-08-29, so this is one of the last four polish
nights.

Three nights of critic loops on the three *visual* disciplines (track, FX,
karts) have each ended in a FAIL verdict, while two whole disciplines named as
debt in every handoff have never been worked on at all: **audio** is a 110-line
stub with one sawtooth oscillator, one noise band, five sine blips and **no
music of any kind**, and **UI/presentation drama** (countdown, results, HUD
hierarchy, touch affordances) has not been revisited since the scaffold. With
four nights left, the marginal value of a fourth grind on the same three render
files is far below taking those two zero-state disciplines to a real bar.

Tonight is therefore a bounded three-area pass:

1. **agent-audio** owns `assets/js/audio.js` — rebuild it as a real racing
   soundtrack and mix: layered load-dependent engine, gear shifts, tyre scrub
   tied to slip, a drift-charge riser with per-tier tone, boost, item, impact,
   countdown and lap stingers, and a procedural music bed. Verified by
   `OfflineAudioContext` renders inspected as spectrogram PNGs, not by
   assertion alone.
2. **agent-ui** owns `assets/js/ui.js` and `assets/css/game.css` (a single
   owner in SPEC.md's table, so no shared-file race) — countdown and results
   drama, HUD hierarchy and readability, touch affordances.
3. **agent-particles** owns `assets/js/render/fx.js` — the previous handoff's
   explicit next step: make drift, boost and collision effects visibly belong
   to the focus kart's tyres and travel direction.

Each worker owns only its SPEC-assigned files and loops against a separate
harsh critic. The lead owns integration, the test suite, the screenshot sweep
and every git command. No release and no `main` update is planned tonight.

### Lead work landed early (camera, tooling, harness)

Three lead-owned pieces are pushed ahead of the workers, so a dead run
still leaves them:

* **`tools/audioscope.js`** (new). The audio discipline has never had a
  verification path — audio cannot be seen in a screenshot and cannot be
  heard in this sandbox. The tool loads the game in headless Chromium,
  renders the audio graph offline through a `ZC.Audio.__renderOffline`
  hook, and writes per scenario a log-frequency STFT spectrogram, a
  peak/RMS waveform, a listenable WAV, and numeric stats (peak/RMS/crest,
  clipped samples, DC offset, silent fraction, spectral centroid track).
  The STFT and PNG encoding are pure Node: the ffmpeg in the Playwright
  bundle is a minimal 24-filter build with no `showspectrumpic`. Verified
  against a synthetic signal — a rising eight-harmonic saw plus a 4 kHz
  burst at t=2s — and both resolve correctly, with the centroid track
  rising monotonically 244→1763 Hz and spiking to 2974 Hz in exactly the
  burst window.
* **`render/main.js` camera drama.** The chase camera was correct but
  inert: a boost, a shell hit and a quiet straight looked identical, and a
  standing start opened already framed as if the race were underway. Added
  an FOV punch, impact shake (summed sines, not `Math.random`, so it is
  frame-rate independent and never a single-frame teleport), a small roll
  into a slide scaled off `Kart.TUNE.driftSlip`, and an establishing shot
  that starts low off the kart's shoulder during GRID/COUNTDOWN and pushes
  in to the chase position. The intro blend is driven off `st.countdown`
  rather than its own timer, so a skipped or restarted countdown cannot
  strand it. All of it moves the camera only, never the simulation, so
  none of it can touch a lap time. Only the kart the camera is watching
  may raise an impulse — in attract mode that is the leader.
  **Verified in-browser at 1440x900**: the forced countdown frame shows
  the low shoulder angle with the full field spread across frame, and the
  forced tier-2 drift frame shows the horizon rolled and the FOV widened.
* **`__tests__/zephyr-circuit.harness.js`**: `loadSandbox(files, opts)`
  now returns the sandbox alongside `ZC` and merges `opts.globals` before
  the modules run, so a test can supply a recording Web Audio shim.
  `loadZC` keeps its old signature; no existing test changed.

Suite stayed 109/109 across all three.

### Evidence captured for the FX brief

The forced tier-2 drift frame is direct corroboration of the three prior
critic FAILs on `render/fx.js`. In that frame the drift effect is two thin
pale-cyan streaks lying flat on the road several metres *behind* the kart,
one detached to the left entirely — they read as light trails, not as
tyres throwing sparks, and there is nothing at all at the wheel/road
contact point. The tier-2 boost produced **no visible flame or exhaust**:
with `kart:boost` fired every 120ms, the only on-screen difference between
"boosting at tier 2" and "cruising" was the camera FOV, which is lead code.
That is worth checking as a plain trigger bug before any redesign.

## 2026-08-26 — polish night 8 intent

Pacific Wednesday, nine days after the 2026-08-17 start. This is not release
night; the forced release remains Saturday 2026-08-29. The previous run
identified two concrete blockers rather than cosmetic debt: the audio plan
was not landed, and the FX trigger path showed no visible boost exhaust in a
forced active frame. Tonight is a bounded pass on three disjoint files/areas:

1. **agent-audio** owns `assets/js/audio.js`: turn the stub into a layered
   racing mix with load-dependent engine, tyre scrub, drift tiers, boost/item/
   impact/countdown/lap stingers, and a procedural music bed. Use the existing
   audioscope path for offline evidence; do not add runtime fetches.
2. **agent-ui** owns `assets/js/ui.js` and `assets/css/game.css`: improve
   countdown/results drama, HUD hierarchy/readability, and touch affordances.
3. **agent-particles** owns `assets/js/render/fx.js`: fix the observed boost
   trigger/ownership issue first, then make drift, boost, and collision effects
   visibly attach to the focus kart's tyres and travel direction.

The lead owns integration, tests, screenshots, PROGRESS, and every git
command. Each worker must edit only its SPEC-assigned file set and report a
harsh reference comparison; no release or `main` update is planned tonight.

## 2026-08-26 — polish night 8 handoff

Two bounded presentation units landed on `dev` and were pushed independently:
`cfbf09c` rebuilds `assets/js/audio.js` as a layered procedural race mix with
load-sensitive engine harmonics, gear shifts, tyre scrub, drift-tier tones,
boost/item/impact/countdown/lap/fall/finish stingers, and a loopable music
bed. `7494f4e` refreshes `assets/js/ui.js` and `assets/css/game.css` with
named HUD panels, a speed bar, clearer item affordance, staged countdown
card, richer results/score screen, and responsive touch labels/targets.

### Verification

* Full repository suite: **9/9 suites, 237/237 tests passed** after each
  landed unit. `node --check` passed for `audio.js`, `ui.js`, and the existing
  `render/fx.js`; `git diff --check` passed for the scoped changes.
* The in-app browser loaded the updated build on a fresh local port with no
  console errors. Exact viewport probes covered **320x568, 390x844,
  844x390, 768x1024, 1440x900, and 3840x2160**; every report matched its
  requested dimensions and had document/body widths equal to the viewport.
  I inspected the countdown frames, plus a transient forced-finish results
  frame at 1440x900. Touch emulation confirmed visible controls and safe
  target rectangles at 320x568 and 390x844. Evidence was saved to
  `C:\Users\jshun\AppData\Local\Temp\zephyr-night8-1440-countdown.png`
  and `C:\Users\jshun\AppData\Local\Temp\zephyr-night8-390-touch.png`.
* The audio worker's full/degraded WebAudio shim checks passed, but the
  audioscope could not run because this checkout has no `playwright` package;
  no spectrogram or real listening verdict is claimed.

### Honest critic status

* **Audio — FAIL / not AAA-cleared.** The worker compared against Mario Kart 8
  Deluxe and explicitly did not claim a pass; offline visual evidence was
  blocked by the missing Playwright dependency.
* **UI/presentation — UNJUDGED.** The worker inspected a Mario Kart 8 Deluxe
  reference and improved the hierarchy, but the fresh final blind comparison
  was interrupted. The lead's desktop countdown and results frames are clean,
  and the responsive/touch geometry passes, but this is not a critic pass.
* **FX — unchanged, FAIL retained.** The worker landed no safe patch. The
  previous forced-state evidence still shows detached drift streaks and no
  visible boost exhaust, so this remains the first priority.
* Track/environment and kart models remain below their prior AAA reference
  verdicts. No `.aaa-complete` was written and `main` was not touched.

### Next run

Start with `render/fx.js`: reproduce the missing boost exhaust, fix event/state
ownership and tyre attachment, and obtain a real independent side-by-side
verdict. Then rerun UI/audio critic evidence if time allows. Forced release is
Saturday **2026-08-29**; release night must only fix glaring blockers and must
not be delayed for cosmetic debt.

## 2026-08-27 — polish night 9 intent

Pacific Thursday, ten days after the 2026-08-17 start. This is not release
night; the forced release remains Saturday 2026-08-29. Tonight is bounded to
the highest-risk unresolved presentation issue first:

1. **agent-particles** owns `assets/js/render/fx.js`: reproduce the missing
   boost exhaust in a forced active frame, correct event/state ownership and
   tyre attachment, then obtain a fresh harsh side-by-side verdict against a
   shipped kart racer.
2. If the FX unit lands cleanly and time remains, rerun independent UI/audio
   critic evidence without changing their files unless a glaring defect is
   found.

The lead owns integration, tests, screenshots, this handoff, and every git
command. Preserve the unrelated `bayou-brawlers` edits. No release or `main`
update is planned tonight.

## 2026-08-27 — polish night 9 handoff

The FX trigger path was repaired and the tested work is pushed to `dev` in
`f77062d` (intent `ccae1f2`; first FX implementation `1a9c187`).
`render/fx.js` now resolves emitted kart events back to the correct roster
slot, transforms drift contact through the kart's authored rear geometry,
keeps twin boost outlets separate, broadens the streak texture so it reads as
an exhaust plume rather than a needle, and uses distinct warm/cyan outlet
colors with a restrained contact-core scale. The public FX API, pools,
quality tiers and allocation-free update path remain intact.

### Verification

* Full repository Jest suite: **9/9 suites, 237/237 tests passed** after the
  final FX changes. `node --check` and the scoped `git diff --check` passed.
* The forced active-state screenshot harness generated all required viewports:
  **320x568, 390x844, 844x390, 768x1024, 1440x900 and 3840x2160**. Every
  report reached `phase=racing`, had no horizontal scroll, and retained the
  touch controls where applicable. I inspected the desktop, portrait,
  landscape-phone and ultrawide PNGs. The 320px frame is usable but crowded;
  that is cosmetic debt, not a broken control layout.
* The cached Playwright + Edge fallback emitted SwiftShader/WebGL context and
  ReadPixels warnings plus the blocked Google tag request. Those are test
  infrastructure noise; this fallback cannot support a clean-console claim
  for the renderer.

### FX critic verdicts

Three independent blind comparisons this run remained **FAIL / ours loses**
against Nintendo's official Mario Kart 8 Deluxe presentation and drift
references. The first patch improved anchoring but still left detached-looking
drift and weak exhaust. The second comparison found the focus flare blown out
and the two outlets unreadable. The final comparison found the scene calmer,
but still rejected the oversized/overexposed contact flash, insufficiently
wheel-attached tiered sparks, and boost exhaust that does not read clearly from
the player kart. The exact remaining FX debt is: localize and reduce the
contact flash, preserve kart silhouettes, author distinct wheel-attached
drift-spark tiers, and add a clearly directional saturated rear exhaust plume.

### Current status and next run

Logic/gameplay and the responsive browser health probe remain passing. FX is
**FAIL** on the visual AAA bar. Track/environment and kart models retain their
prior **FAIL** verdicts; audio remains **FAIL/not AAA-cleared** and UI remains
**UNJUDGED**. No `.aaa-complete` was written, no shipping judge was run, and
`main` was not touched.

The next run is forced release Saturday **2026-08-29**. Do not start new
polish. Run the suite and screenshot sweep, then fix only glaring blockers
(crash, app console error, unreadable HUD, broken touch controls, or an
unclear/unfinishable race). Carry the cosmetic FX, track, model, audio, UI
drama and real-GPU shadow debt honestly into the release record.

## 2026-08-27 (Thursday evening, Pacific) — polish night 10 intent

**Correction first: this session started on the wrong branch.** It was cloned
from `main` (`93d0e5e`, 2026-08-23), which is only updated at release, so its
`.arcade-agent/current-game.md` still held the post-Paradox-Vault "no game is
active" state. Acting on that, the run scaffolded a whole new game
(`stormhook`, a grapple-swing platformer) on a side branch before the human
pointed out that `dev` exists. `dev` was never touched by it and neither was
`main`; the work is parked on `claude/dazzling-franklin-64a1bw` and is a
candidate for the next scaffolding night *after* Zephyr Circuit ships. The
process lesson: `git branch -a` only lists refs that were fetched. Check
`git ls-remote` before concluding a branch does not exist.

Tonight is therefore **polish night 10**, two nights before the forced release
Saturday **2026-08-29**.

Starting state, inherited from night 9: 237 tests green across 9 suites; FX
**FAIL** after three blind comparisons in one run; track/environment and kart
models **FAIL**; audio **FAIL**; UI **UNJUDGED**.

### Plan, and why this shape

FX took three critic rounds today and still failed, with each round producing a
reshaped verdict rather than a converging one. Hammering it a fourth time is
the lowest-expected-value move available. With two nights left and a *forced*
release — where cosmetic shortfalls are acceptable debt and only glaring
defects block — the priorities are:

1. **Judge the UNJUDGED.** UI has never had a blind side-by-side. An unjudged
   discipline going into a release is a hole in the record, and it is cheap to
   close. If it fails on something glaring (unreadable HUD, broken touch), that
   is a release blocker and has to be found tonight, not Saturday.
2. **Verify the release-blocking list directly** — crash, console errors,
   unreadable HUD, broken touch controls, an unfinishable race — across all six
   viewports, and fix anything glaring.
3. **Then, and only with time left, one focused FX unit** on the single most
   specific piece of the recorded debt rather than another broad pass.

Entries below are appended as work lands.

## 2026-08-27 (Thursday evening, Pacific) — polish night 10 handoff

Pushed to `dev`: `aaa2c6e` (intent), `e746e2f` (sticky panel action),
`17ca22d` (cup wiring).

### The find of the night: the cup was never wired up

`race.js` implemented the entire championship — `CUP = ['gullwing-bay',
'thermal-spire', 'cirrus-run']`, per-round points, standings, `nextRound()`,
`advance()`, `PHASE.CUP`, a placement bonus — and `race.test.js` covered all of
it, including that all three circuits get raced and the phase ends at `CUP`.
**`ui.js` never called any of it.** `startRace()` was `R.load(0, {})`, which
loads Gullwing Bay directly and bypasses the cup, and the results screen's only
button restarted that same race.

The shipped game was therefore **one track, replayed forever**. `thermal-spire`
and `cirrus-run` were unreachable, the standings and cup bonus were dead code,
and the grid screen advertised "Round 1 / 3" for a round that could never
advance. Nine polish nights and a green 237-test suite did not catch it, because
every test drove `race.js` directly and every screenshot was taken mid-race on
round 1.

Now wired: `startRace()` starts a cup; the results button reads **Next circuit**
and advances, or **Final standings** on the last round; and there is a
championship screen with placement, cup score, standings by points and the
bonus. `recordBest`/`submitScore` moved to the end of the cup — they had been
running on *every* round's results, posting a partial cup score up to three
times a run. (No leaderboard discontinuity: the game has not shipped, so there
are no existing scores.)

Verified by **clicking the real buttons** through a whole cup at 390x844:
gullwing-bay → thermal-spire → cirrus-run → championship, score accumulating
693 → 1590 → 2276 → 3476 with the bonus, no console errors.

### Also fixed

**A panel's primary action can no longer sit below the fold.** On a 568- or
390-tall viewport the results table pushed "Race again" out of view. It *was*
reachable — the panel scrolls (807px of content in a 530px box) and both a wheel
and a touch drag bring it back, so this was never a dead end and not the blocker
it first looked like — but the last visible row read as the end of the card and
nothing signalled a button underneath. The trailing action is now sticky to the
bottom of its own scroll box with the content fading out above it, and inert on
tall viewports. Also clears an in-flight lap-split toast when a screen takes
over; one was landing across the finish position.

### Verification

* Full repository Jest suite: **9/9 suites, 237/237** after every change.
  `node --check` and `git diff --check` clean.
* Six-viewport racing sweep re-run after both changes: all reach `phase=racing`,
  no horizontal scroll, only the known googletagmanager and SwiftShader noise.
* Results and championship screens checked at 320x568, 844x390, 390x844,
  768x1024 and 1440x900: primary action in view and hit-testable at every one.
  **These screens had never been screenshotted before tonight** — the sweep
  boots straight into a race, so it only ever photographed `racing`.
* The pale quads on the road are not a bug: they are the `road-patches` and
  `aggregate-scrub` decals at 0.2–0.3 opacity. The large pale wedge that shows
  in a finish-line frame is the celebration ring VFX, not a broken mesh — a
  full geometry audit for NaN and runaway vertices came back empty.

### A caveat about critic verdicts, recorded honestly

**I could not run a blind side-by-side comparison tonight.** The sandbox egress
proxy blocks the image hosts (`mario.wiki.gallery`, `nintendolife.com`,
`gameuidatabase.com`, `upload.wikimedia.org` all refused), so no reference
screenshot could be fetched and placed beside ours. I have therefore recorded
**no critic verdict** rather than a verdict I could not support. UI remains
**UNJUDGED**; FX, track/environment, models and audio keep their prior **FAIL**.

Whoever runs the release should note this when writing `.aaa-complete`: if
reference imagery cannot be fetched from this sandbox, then a recorded "blind
side-by-side" verdict needs to say what was actually compared.

### Deliberately not done

FX took three critic rounds on night 9 and failed all three, each with a
reshaped rather than converging verdict. A fourth broad pass was the lowest-value
move available with two nights left, so I left `render/fx.js` alone. The
recorded FX debt is unchanged: localize and reduce the contact flash, preserve
kart silhouettes, author wheel-attached drift-spark tiers, and add a directional
saturated rear exhaust plume.

### Rounds 2 and 3, looked at for the first time

Wiring the cup makes two circuits reachable that no player — and, as far as this
log shows, no previous run — has ever seen. So I raced and photographed both at
1440x900 before ending the night. Both are **sound**: they load, all eight karts
race, nobody goes off-road or falls, speeds sit at a normal ~97 km/h, no console
errors. Neither is a release blocker. But they are visibly behind Gullwing Bay,
which is the one everything has been polished against for nine nights:

* **Thermal Spire** is the weak one. Sparse scenery — largely empty fields with a
  handful of near-black, apparently unlit props on the horizon that read wrong
  against a bright sunset. No landmark and no spire, despite the name. Next to
  Gullwing Bay's waterfalls, rocks and gate it looks unfinished.
* **Cirrus Run** is in decent shape: trees, kerbs and sky all read well. One real
  defect — the sun and its bloom sit directly behind the RACE CLOCK panel in the
  top right and wash the `BEST` row out. `TIME` stays legible and the row is
  empty on lap 1, so this is not the "unreadable HUD" blocker, but it is close
  enough to fix. Likely a small opacity bump on `.zc-timing`; verify against all
  three circuits, because the sun is only behind the HUD on this one.

This is the honest trade the cup wiring makes: three circuits of uneven polish
instead of one polished circuit repeated forever, with the standings and cup
bonus finally alive. I think that is clearly the right side of the trade — the
game already advertised "Round 1 / 3" and a "Best cup" — but it is a judgement
call made two nights before release, and it is reversible in one line
(`startRace()` back to `R.load(0, {})`) if the human disagrees.

### Next run — Friday 2026-08-28, the last polish night

The release is **Saturday 2026-08-29**.

1. **Re-verify the cup end to end**, ideally with a human actually driving
   rather than attract mode. It is a new code path in the most important flow
   in the game, one night before release. That is the first thing to do.
2. **Dress Thermal Spire**, if only one thing gets done. It is the weakest thing
   a player will now see, and it is round 2 of 3. See the section above.
3. Fix the sun-behind-the-HUD wash on Cirrus Run.
4. Only then, if time remains, one narrow FX unit from the debt list above.
5. The release blurb and `.aaa-complete` should say three circuits, not one, and
   should carry the uneven-track-polish debt honestly.

## Run 2026-08-28 — final polish-night intent

Pacific Friday, one night before the forced release. First verify the newly
reachable three-round cup end to end and confirm there is no release-blocking
state or console error. Then take one bounded visual pass on Thermal Spire,
the weakest reachable circuit, and correct the Cirrus Run sun wash only if it
is still materially affecting the timing HUD. Preserve unrelated local work;
do not start broad FX rework on the eve of forced release. If the browser
harness can run, inspect fresh screenshots at the required viewports and
record exactly what was verified. The next run is release wrap-up only.

### Unit 1 — Thermal Spire landmark pass

`assets/js/render/trackmesh.js` now gives Thermal Spire a caldera, stepped
basalt crown, buttresses, lava bands, a flank seam and a glowing cap. The
change is isolated to the Thermal Spire landmark branch and adds no frame-loop
allocations. Syntax is clean. A forced chase-camera frame at 1440x900 shows
the new silhouette and a healthy race at 90 km/h with no console errors.

The worker's independent comparison against Art of Rally is **FAIL**: the
landmark gap is substantially addressed, but supporting volcanic terrain and
hero composition still trail the shipped reference. This is recorded as
cosmetic debt for the forced release rather than widened into a risky final
night environment rewrite.

Full Jest is green after the unit: **9 suites, 237 tests**.

### Unit 2 — timing contrast and touch proof

`assets/css/game.css` now gives `.zc-timing` a dark two-tone gradient, stronger
border and shadow, and an 8px backdrop blur. The patched Cirrus Run frame at
1440x900 computes the new gradient/contrast styles and keeps TIME and BEST
legible over the bright sky. Touch emulation at 390x844 exposed all four
controls — left/right steering, BRAKE and DRIFT — as pointer-active rectangles
inside the viewport, with no overflow.

The independent HUD/touch critic's Mario Kart 8 Deluxe comparison is **FAIL**:
the remaining gaps are a muddled timing hierarchy, supporting text that is not
robust enough over every bright/moving background, and a dense touch stack
that still reads more like debug UI than a shipped control surface.

### Cup verification and final-night evidence

An AI-driven cup smoke run completed the real UI path end to end: Round 1
Gullwing Bay results, Next circuit, Round 2 Thermal Spire results, Next circuit,
Round 3 Cirrus Run results, and the final championship screen. The observed
final screen showed **3 rounds**, **3,160 cup score**, and a **+1,200
championship bonus**. All three rounds completed without a visible fall or
console error. This was an unattended deterministic smoke run, not a claim of
human-driving quality.

The final six-size sweep covered 320x568, 390x844, 844x390, 768x1024,
1440x900 and 3840x2160. Every viewport reported exact dimensions, matching
scroll width/height, and no error or warning logs. A fresh patched Cirrus
chase frame and a touch-enabled 390x844 racing frame were read visually; the
representative captures are in the run's temporary QA artifacts. The full
repository suite is green: **9 suites, 237 tests**, and all render modules
pass `node --check`.

### Final critic record and release handoff

* **Thermal Spire / environment — FAIL** against Art of Rally. The new spire,
  caldera, basalt shelves, lava bands and cap improve the single landmark, but
  the critic still found no reliably readable hero structure in the chase
  composition, excessive empty asphalt, clipped dark foliage, and sparse,
  muddy supporting dressing.
* **HUD / touch — FAIL** against Mario Kart 8 Deluxe. The contrast pass fixes
  the specific Cirrus wash, but the critic still found hierarchy, all-background
  robustness and touch-stack density below the AAA bar.
* **FX, audio and prior environment/model disciplines — prior FAILs remain**;
  no new broad pass was started on the eve of forced release.

There is no `.aaa-complete` yet and `main` is untouched. The next run is the
forced Saturday 2026-08-29 release wrap-up: run the green suite and screenshot
blocker sweep, fix only a crash, console error, unreadable HUD, broken touch
control or incompletable race, then record the cosmetic debt and promote
`dev` to `main` if those blockers remain absent.
