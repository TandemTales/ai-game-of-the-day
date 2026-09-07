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

## 2026-09-06 (Sunday, Pacific) — polish run intent

Focus this bounded run on greenhouse/seed/relic rendering and responsive UI.
Run the baseline tests, assign each implementation agent its single owned file,
and seek independent shipped-AAA screenshot comparisons. Verify the real browser
at all six required viewports before recording results. This is not release
night (started 2026-09-05); main stays at the existing release.

### UI checkpoint

Responsive cards now grow to fit instead of clipping the heading/score, mobile
readouts sit above the field, and callsign controls have usable touch targets.
The footer now describes the run rather than implementation details. Six-size
Chromium smoke with the pending renderer/input integration passed; 320px ready,
playing and over PNGs were opened and read. Full baseline Jest was 340/340.
Independent UI critic remains FAIL against official Katamari/Pikmin references:
phone arena is small and landscape needs a tighter height budget. Iterating on
that feedback next. Callsign shortcut repair is pending in the separate JS unit.

### Renderer and browser-regression checkpoint

Added layered greenhouse glazing, weathered deck seams, varied perimeter plants,
ceramic pods, faceted crystals, botanical rosettes, framed specimens, a solar
nucleus/leaf player silhouette and distinct pink warning wells. Mechanics remain
unchanged. Fixed document shortcuts stealing callsign typing/Enter and clear held
controls on blur or entry into an editable field.

Added tools/smoke.js and documented local Windows Chromium invocation. Dedicated
Jest passes 11/11 (full repository last checked 340/340). Six-viewport Chromium
checks pass, including native touch, callsign, mock rank/submit, restart, card
containment, no horizontal overflow and no console warnings/errors. Renderer
revision desktop PNG was opened and read. This smoke uses seeded visual fixtures
and shortened timer; it does not prove full-run balance or production leaderboard.

Independent renderer critic: FAIL on both comparisons against Nintendo's actual
Pikmin 4 gameplay screenshot. Second pass improves foliage, silhouette and hazard
separation, but the central scene still reads as a flat tray with sparse lighting
and isolated tokens rather than an authored greenhouse. No AAA claim; keep this
as progress and carry scene depth/material/story variety into the next run.

### Final responsive revision and handoff

The second CSS pass reduces active-phone chrome, uses the full phone width,
fits the complete live arena plus essential HUD inside 844x390, and expands the
4K layout. A browser regression now asserts native 8:5 canvas proportions and
physical landscape arena/readout containment. That regression passes.

All 18 final ready/playing/over PNGs across 320x568, 390x844, 844x390,
768x1024, 1440x900 and 3840x2160 were opened and visually inspected by the lead.
The independent critic also opened actual publisher reference screenshots and
paired them beside ours, then inspected both iterations. These were independent
identified comparisons, not identity-blind judgments; there is no blind-pass claim.
Local evidence is in node_modules/.cache/orbit-orchard/final/ and critic/;
these ignored artifacts can be regenerated using tools/smoke.js.

| Discipline | Final verdict | Remaining work |
| --- | --- | --- |
| Greenhouse / materials | FAIL vs Pikmin 4 | Authored scene depth, varied light/material response, stronger player focus and collectible scale/story |
| UI | FAIL vs Katamari Damacy REROLL | Portrait arena/player too small; first-screen Replant at 320px; further 4K hierarchy/scale tuning |
| Gameplay / audio / VFX | Not judged this run | Full-run routing/balance, actual audio implementation/review, dedicated VFX criticism |

References used by the independent critic:
- Nintendo Pikmin 4 official page: https://www.nintendo.com/en-gb/Games/Nintendo-Switch-games/Pikmin-4-2267217.html
- Actual treasure-hunt screenshot: https://www.nintendo.com/eu/media/images/08_content_images/games_6/nintendo_switch_7/nswitch_pikmin4/CI_NSwitch_Pikmin4_hunt_scr01.jpg
- Katamari Damacy REROLL publisher screenshots: https://store.steampowered.com/app/848350/Katamari_Damacy_REROLL/
- Actual rolling gameplay screenshot: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/848350/ss_6f8332bf0c21f7d5072e56655c3f77147c4832e7.1920x1080.jpg

No essential HUD clipping remains in inspected live states. At 320px the results
card is fully accessible by scrolling, but Replant is below the first viewport;
landscape results also extend vertically while Replant remains visible. Native
Chromium touch and mocked score submission passed; physical-device performance,
production leaderboard availability and a natural full-run playthrough were not
verified this run. Fixed 960x600 backing resolution remains a 4K sharpness debt.

Next run: begin with the browser harness, then prioritize a portrait camera/world
framing decision that enlarges the seed and pickups without distorting controls.
Develop one authored greenhouse composition with a strong light/focal hierarchy.
Continue independent criticism; do not treat this checkpoint as AAA completion.

Stopped after two bounded polish areas and a second critic iteration. No shipping
judge was run because both disciplines still fail. No .aaa-complete marker was
written, no release occurred, and main was not changed. Started 2026-09-05;
2026-09-12 is age 7 (polish), 2026-09-19 is age 14 (forced release).

Final verification: full repository Jest passed 14 suites / 340 tests; syntax
and git diff --check passed. All required work checkpoints were pushed to dev.

## 2026-09-07 (Monday, Pacific) — polish run intent

Focus on portrait playfield framing/control mapping and a compact results card
with Replant visible at 320x568. Give JS and CSS builders one file each; seek
independent shipped-AAA side-by-side criticism. Run mechanics and six-viewport
Chromium checks before pushing each working unit. Age two days: no forced release.

### Portrait framing and results checkpoint

The complete 960x600 world rotates clockwise for live portrait phones; mechanics
stay in world coordinates, keyboard controls follow screen directions, and
pointer input maps through the inverse view. Canvas backing follows display
size/DPR (DPR capped at two, maximum dimension 4096). Canvas labels stay upright.
At320x568 the field is257.5x412, about30% larger linearly than the prior fit;
at390x844 it is386x618, about60% larger. Both whole arenas and HUDs fit physically.
Results remove duplicate HUD and keep callsign/POST/Replant visible with44px+
targets. Browser checks caught and fixed first-input timing and intrinsic grid
clipping before this checkpoint.

Dedicated mechanics/view suite17/17 and full repository14 suites/346 tests pass.
Six-size Chromium smoke passes keyboard, inverse pointer targets, native touch,
orientation preservation, first-screen phone replay, mocked API form/replay,
console and overflow. Lead inspected both phone live states and320 results;
all six-size evidence saved in node_modules/.cache/orbit-orchard/sep07-pass2.
Independent critic's baseline UI and framing verdicts remain FAIL vs Katamari
Damacy REROLL/Pikmin4. Revised comparison pending; no AAA or release claim.

### Final cue revision and handoff

Pushed framing/results as e22a0e3 after intent 936996d. The second JS unit adds
upright event banners at minimum 11 CSS pixels, hazard penalties at minimum 9,
a small YOU marker that fades as the seed grows, and an in-field DRAG TO STEER
hint dismissed by the first steering input. The hint resets on replay and stays
outside deterministic simulation state. Documentation records the view contract.

Final dedicated suite: 17 passed; full repository at preceding checkpoint:
14 suites / 346 passed. Final syntax, diff whitespace and six-viewport Chromium
smoke pass. Checks now also cover display-sized backing resolution, first-input
hint dismissal and explicit portrait event fixtures. Lead actually opened all
22 final PNGs: ready/playing/over at six sizes plus phone onboarding/event states.
4K screenshots were displayed downsampled by the image viewer; this is layout
inspection, not a pixel-by-pixel 4K sharpness judgment. Evidence lives in ignored
node_modules/.cache/orbit-orchard/sep07-final/ and sep07-critic/.

Independent critic inspected baseline, pass2 and final real side-by-side sheets.
Functional phone framing/results/cues pass: no clipped controls or arena, upright
event numerals, clear YOU marker and steering hint inside the 320px viewport.
These are identified comparisons, not blind passes.

| Discipline | Final verdict | Remaining debt |
| --- | --- | --- |
| UI | FAIL vs Katamari Damacy REROLL | Dashboard-like hierarchy, decorative microtype, weak integrated identity; 4K card scale |
| Framing / readability | FAIL vs Pikmin 4 | Player silhouette still token-like, uniform prop distribution and weak scene depth; small hazard penalties |
| Gameplay / audio / VFX | Not judged | Natural full-run balance, audio implementation/review and dedicated effects critique |

Critic freshly verified Nintendo/Bandai Namco/Steam source pages, then used cached
official screenshot downloads from September 6 because direct image refetch hit
proxy/TLS failures. No fresh-download claim. References:
- https://www.nintendo.com/en-gb/Games/Nintendo-Switch-games/Pikmin-4-2267217.html
- https://www.bandainamcoent.com/games/katamari-damacy-reroll
- https://store.steampowered.com/app/848350/Katamari_Damacy_REROLL/
Exact image URLs and provenance are also recorded in the September 6 entry and
ignored sep07-critic/provenance.txt. No reference imagery ships with the game.

Stopped after the bounded portrait/UI pass and one critic-driven cue revision.
Physical-device performance, natural full-run balance, real leaderboard service
and audio quality remain unverified. Next run should prioritize an authored
greenhouse lighting/depth composition and distinctive player silhouette; keep
this portrait/input regression suite. Do not repeat the resolved replay clipping.
No shipping judge, .aaa-complete or release: both AAA critics still fail. Main
was not changed. Active start remains September 5; forced release September 19.

## 2026-09-07 — human feedback: gameplay fails; revise next milestone

The human played the game and reports it is very boring and not challenging.
That overrides the prior recommendation to focus next on lighting and silhouette.
Gameplay is now FAIL from direct feedback, not merely unjudged. The earlier
passing tests and responsive screenshots do not establish fun or difficulty.

Updated SPEC.md with a concrete, staged redesign: choose a harvest contract,
collect requested relics and deliver cargo to a nursery; complete three escalating
contracts before time expires; navigate telegraphed moving hazard routes using
a limited directional dash. Safe/risky route choices, recoverable cargo loss,
delivery time rewards and repeatable seeds should make routing and timing matter.
Values in the plan are starting hypotheses to tune through real play.

Next run starts with ONE complete collect-and-deliver contract and a natural
full-run keyboard/touch playtest. Only then add escalating hazards and dash,
followed by replay/score tuning. Preserve the resolved portrait/input/results
work. Defer standalone visual polish until the SPEC gameplay gate passes.
TESTING.md now lists planned mechanics and real-play evidence requirements;
do not confuse those future checks with currently passing tests.

This update changes planning documents only; no new mechanics are implemented
and the user's complaint is not resolved by this plan alone. Start/release dates
remain September 5/September 19. No .aaa-complete or main promotion.

## 2026-09-07 (13:02 Pacific) — contract milestone intent

Implement the first playable choose/collect/deliver contract in response to human gameplay feedback. Preserve portrait controls and results. Single-file physics/UI builders, independent criticism, mechanic tests and real-input full-run checks precede any completion claim. Moving-hazard escalation and dash remain later milestones. No release this Monday.


### First delivery working checkpoint

Implemented one-trip prototype: safe Mint pods +600 or risky Gold diamonds +1400, three matching shape/color cargo, five seeded small targets per route, visible central nursery deposit, exactly-once reward/time cap and objective-based results. Ordinary growth persists. Existing wells now drop recoverable cargo with shared hit grace; recovered cargo cannot duplicate growth/points. Three-contract escalation and dash remain future work.

Fixed two exposed causes: portrait runtime was reusing already-rotated held input, and minimum gravity distance also prevented starting-mass contact with target relics. Added regression coverage and preserved screen-relative inputs.

Full repository passes 14 suites / 357 tests (28 Orbit Orchard); six-size Chromium smoke passes nursery choice targets, arena fit, input, results/replay, mocked leaderboard, clean console and no overflow. Independent critic completed normal-timer keyboard and native320px touch safe deliveries without simulation mutations. Initial automated 12-run greedy baseline also completed all routes, but it predates the final contact fix and will be rerun for final evidence.

Critic's preliminary verdict remains gameplay FAIL: safe route is one outbound/return decision, growth maxes too early, ordinary points overwhelm the delivery bonus. Actual side-by-side UI FAIL vs Katamari Damacy REROLL and scene/targets FAIL vs Pikmin4; official pages freshly verified, Sept6 cached reference screenshots disclosed. Collect-versus-return wording revised from critique. No AAA completion, shipping judge or release; main unchanged.

### Final review and next run

The compact phone HUD removes its redundant status row while playing, reclaiming
24px of portrait arena height. At 320x568 the committed field is 253x405 and the
nursery-choice field is 223x357; both fit vertically. At 390x844 the committed
field remains 386x618. Buttons remain at least 44px and objectives at least 11px.
Six-size supplemental nursery/committed/results checks passed. Lead opened PNGs
at all six sizes plus the critic's actual side-by-side; UI builder opened all
six nursery and results sets. The 4K image viewer downsampled to 2048px: this is
layout evidence, not a pixel-level sharpness judgment. Final smoke also asserts
held screen direction survives successive frames without being rotated twice.

Independent critic used actual normal-timer keyboard and native touch controls,
without simulation injection. Safe keyboard seed2105201829: one delivery,
zero hits, score9391, 17.19s left. Safe320px touch seed2105318966: one delivery,
zero hits, score11530, 39.9s left. A390px risky attempt seed2105432060 expired
with four hits, score9976, and visibly recoverable cargo. Screenshot and decision
pauses consumed substantial time in these attempts, so neither timings nor the
risky failure establish balance. The critic confirms the loop is usable and
continues to reject overall gameplay quality.

| Discipline | Final standing | Evidence / debt |
| --- | --- | --- |
| Gameplay | FAIL | Safe out-and-back has little decision pressure; maximum growth before deposit; pickup score overshadows objective; greedy baseline wins |
| Contract UI | Functional pass; AAA FAIL vs Katamari Damacy REROLL | Readable choices/cargo/results, but dashboard identity and scale remain below reference |
| Scene / targets | AAA FAIL vs Pikmin 4 | Target rings help identification; token-like props, weak depth and hero silhouette remain |
| Audio / dedicated VFX | Unjudged | No independent acceptance evidence |

Comparisons were identified, not blind passes. Official pages were freshly
verified by the critic; comparison imagery used disclosed September6 cached
publisher screenshots. Sources:
- https://www.nintendo.com/en-gb/Games/Nintendo-Switch-games/Pikmin-4-2267217.html
- https://www.bandainamcoent.com/games/katamari-damacy-reroll
- https://store.steampowered.com/app/848350/Katamari_Damacy_REROLL/

Next run first: tune the existing trip's growth and objective incentives against
the recorded greedy baseline. A600/1400 deposit is too small alongside thousands
of incidental pickup points, and reaching radius66 before delivery removes
collection choices. Then introduce the planned telegraphed moving pressure and
limited dash in separately playable checkpoints; preserve recovery, safe exits
and portrait controls. Do not treat this first1/1 prototype as the planned
three-contract victory. Human boredom feedback remains unresolved. Defer art
polish until the gameplay gate passes; full repeated early/practiced seed matrix,
physical-device performance and live production leaderboard remain unverified.

Stopped after one complete contract milestone and its responsive integration.
No shipping judge, .aaa-complete, or main promotion. Work remains on dev; forced
release date remains September19. Ignored evidence: contracts-verified (smoke),
contract-css (supplemental layouts), contracts-critic (plays/comparison), and
contracts-playtest-final (normal-input greedy runs), under
node_modules/.cache/orbit-orchard/.

Final refreshed real-input baseline (same final JS, normal clock; 12/12 delivered):

| Seed | Input | Route | Hits | Score | Game seconds |
| --- | --- | --- | --- | --- | --- |
| 7 | keyboard | safe | 0 | 4810 | 6.83 |
| 7 | touch | safe | 0 | 4426 | 5.82 |
| 7 | keyboard | risky | 8 | 7977 | 17.92 |
| 7 | touch | risky | 4 | 6571 | 13.55 |
| 42 | keyboard | safe | 0 | 2666 | 7.40 |
| 42 | touch | safe | 0 | 2168 | 6.65 |
| 42 | keyboard | risky | 6 | 8098 | 17.42 |
| 42 | touch | risky | 6 | 7039 | 13.60 |
| 2026 | keyboard | safe | 0 | 3366 | 7.22 |
| 2026 | touch | safe | 0 | 2922 | 5.90 |
| 2026 | keyboard | risky | 7 | 7980 | 17.24 |
| 2026 | touch | risky | 5 | 6751 | 13.10 |

All six safe runs had zero hits; risky runs survived four to eight hits.
This greedy nearest-target-then-return baseline wins every attempt, so the
challenge acceptance gate remains FAIL. Wall/game time differ under concurrent
Chromium load; full report records both. This is automated reachability evidence,
not human fun testing. Final tests remain357/357; final six-size smoke includes
the sustained portrait held-input regression and passes. Final critic CSS
comparison and provenance are in contracts-critic/comparison-contract-final-css.png
and provenance-and-verdict.txt. No outstanding functional blocker was reported.
