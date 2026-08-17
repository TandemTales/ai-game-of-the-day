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

Forced release Saturday is **2026-08-22**.
