# Turntide Links verification

From the repository root, run `npm test -- --runInBand turntide-links` for the keeper's rules, then `npm test -- --runInBand` for the arcade.

Load the classic course and rules scripts in a VM with a window shim. Drive each authored hole from its tee using legal club, direction and power inputs. Check bank, airborne clearance, water recovery, both initial basin levels, a carried deck lie, a settled save/reload, replay bests and the scoreboard formula. Add the corresponding legal routes and mastery cases as each island lands.

Exercise the page from a local server and directly from disk. Check pointer aiming, keyboard fine adjustments and touch, completion/next/replay, reload during a shot, rank GET before matching POST via a local stub and offline completion. Inspect screenshots at 320×568, 390×844, 844×390, 768×1024, 1440×900 and 3840×2160 for chart readability, clipping and overflow. The catalog feature, rating group and leaderboard must all use turntide-links.

Run `node tools/turntide-browser-smoke.cjs` with Playwright on the Node module path. This checkout has it at `node_modules/.cache/tidelock/browser-deps/node_modules`. The harness starts its own loopback server and plays eight stamped holes, the sandbar crossing and an alternate low-pool replay. It checks a four-hole journal without an Orchard entry, reloads settled lies and the 5,600- and 11,000-point local rank/submit pairs. It checks disk play and saves the four Orchard tee journals, six-size tee screenshots, action frames and scorecards under `node_modules/.cache/turntide-links/browser`.

The Orchard VM checks use both incoming levels on every hole. A weak ramp shot must return west. A sunken barge cannot receive the chip that sticks on its raised deck. A plain chip runs into the far chute where the same shot with backspin holds. Reaching the islet on an inherited high pool still requires a fresh feed and a putt across the stone bridge. Draining the upper pool on a barge replay and carrying it through Twin Spillways earns a three-stroke Sluice card and raises the tour best to 11,100.

The full release requires coverage of holes 01–04, 05–08, 09–12, 13–16 and 17–20, their alternate paths and unlocks, and the ferry ending. Record exact results and outstanding checks in PROGRESS.md. A browser sweep does not supply human play, listening or device evidence.
