# Turntide Links · campaign and module contract

Approved November 27, 2026 Pacific when the user selected option 1. This contract covers the full release. The opening build delivers Gull Post, with the remaining islands visible in the pilot book as in development.

**Adventure golf.** The ferrymen of Gull Sound used to play a round at low tide. Their brass cups are the keys to the island locks. As the new keeper, play the old course to bring the ferry home. The interesting shot is often the one *before* the putt. Bank off a lock paddle to float a pontoon beneath tomorrow's tee, or leave the water low and chip from the mud.

**How a hole plays.** Read the contours, choose a putt or a lofted shot, set aim, power and spin, then watch the ball settle. Hitting a marked paddle transfers one water level between two basins. Preview which flats will surface, what will float and where the new current goes. A resting ball on a deck moves with it. Holing out opens the next lock. Each island carries its lock positions forward for four holes. A chart shows both the next tee and the ferry berth. Every inherited state has a playable recovery route.

| Island | Four authored holes in playing order |
| --- | --- |
| Gull Post | 01 Bank a putt around the bellhouse wall. 02 Chip across the dune lip and stop on a downslope. 03 Strike the paddle from the dry side to raise a stranded tee raft. 04 Play the high quay or drain to a sandbar and leave the ferry a channel. |
| Orchard Steps | 05 Climb dry terraces using a stone return ramp. 06 Float a fallen fruit barge into the gap and land aboard. 07 Use backspin to stop between two overflow chutes. 08 Feed the upper orchard pool, then putt from the island you just exposed below. |
| Tinwhistle Mill | 09 Bank through a stopped wheel's open spoke. 10 Reverse a millrace so it carries a missed approach back to the fairway. 11 Ride a rising deck under a low beam before chipping off. 12 Power the hoist with the mill sluice to bring the cup within reach. |
| Glassbird Flats | 13 Read depth poles to cross a submerged causeway. 14 Cut a dogleg by skipping a flat shot across a shallow pool. 15 Play around a marked nesting spit while drifting sideways on a reed raft. 16 Catch a cross-current to reach the bell buoy, then return to the lee-side green. |
| Homecoming Narrows | 17 Work two opposing locks to align the split fairway. 18 Reach the cup from a deck that tips as its mooring dries. 19 Choose which dock to drain for the pilot's approach, with a longer playable route from the other. 20 Escort the ferry through a three-lock staircase, playing each landing, and sink the last putt on the home quay. |

**Tour and mastery.** Clear each island to reopen its landing and add a page to the ferryman's pilot book. Mill backspin and the flats skip become available on earlier islands. Each hole has a stamped side target and a marked par. Save the lie, water levels, unlocked clubs and best cards. The final ferry takes the channel you prepared. The leaderboard sums per-hole bests: 1,000 for holing out, 100 per stroke under par or minus 100 per stroke over (floor 100), plus 250 for the stamp on that run.

**Controls and presentation.** Drag an aim line and tap a power scale, with separate loft, spin and confirm buttons. Mouse uses the same controls, arrows fine-aim and Space shoots. An oblique illustrated harbor chart uses contour hatching, wet stone, striped lock floats and a ball shadow that meets the splash or turf on contact. Give each island a distinct bell and each surface a distinct landing sound. The ferry's returning horn resolves the tour.

**Production risk and sequence.** A deck moving after a shot can make a fair miss look arbitrary. Use stepped basin states and deterministic shot physics. Days 1–2 prove a bank, a chip and a floating lie on one phone-readable hole. Days 3–5 author Gull Post and Orchard Steps and save complete lies. Days 6–8 build the Mill and Flats. Days 9–10 connect the Narrows finale, unlocks and replay scorecards. Days 11–14 exercise all 20 holes from reachable inherited states and review touch aiming, terrain reads, sound and impact feedback.

**Design references.** The obstacle golf and shot shaping in the SNES game give the player a familiar starting point. The PS3 golf reference informed the separate aim and shot inputs. Coupled basins and ferry passage are the original campaign rules. [Nintendo on Kirby's Dream Course](https://www.nintendo.com/en-gb/Games/Super-Nintendo/Kirby-s-Dream-Course-758013.html) · [PlayStation on Hot Shots Golf: Out of Bounds](https://blog.playstation.com/2008/01/22/introducing-hot-shots-golf-out-of-bounds/)

## Runtime ownership and interfaces

Classic scripts share window.TL and run over HTTP and file URLs. No remote fonts or art. Load course, links, journal, render, audio, game in that order. Keep all game coordinates on a 720 × 450 harbor chart. Render at the current element aspect and device pixel ratio. The shot settles in deterministic fixed ticks independent of animation frame rate.

| Owner | Single file | Contract |
| --- | --- | --- |
| Course author | assets/js/course.js | TL.holes in play order. Stable id, name, par, hint, tee, cup, stamp, land rectangles, rails, low lips, optional slope, paddle and pontoon. Basin state carries between the four holes on each island. |
| Rules author | assets/js/links.js | TL.Links creates a lie, resolves a shot into frames and a settled result, applies lock transfers and scores a completed hole. Rules are independent of the DOM. |
| Campaign author | assets/js/journal.js | TL.Journal records settled results, inherited tees, unlocked holes and replay bests. The integration lead supplies storage and presents the journal. Load after links. |
| Chart illustrator | assets/js/render.js | TL.draw(canvas, hole, state, view) draws a procedural harbor, landmarks, terrain, deck, tide, cup, stamp, shadow, aim and ball. Read-only consumer of course and rules. |
| Sound designer | assets/js/audio.js | TL.Audio.setEnabled(boolean), unlock(), play(cue). User-gesture Web Audio synthesis, distinctive surfaces, switch, stamp and cup. Quiet by default. |
| Interface designer | assets/css/game.css | Responsive chart and keeper controls. Visible focus, readable labels, tap targets and normal scrolling on short screens. |
| Integration lead | index.html | Accessible controls, chart, scorecard, pilot book and Back to Arcade. |
| Integration lead | assets/js/game.js | Coordinate input, animation, storage, campaign progression, rank GET and optional name submit POST for gameId turntide-links. |
| Verification lead | ../__tests__/turntide-links.test.js | Rules, campaign, deterministic routes and storage cases using the same classic scripts as the browser. |

A contributor owns exactly one file per assignment. The lead integrates across file boundaries. Stage the opening as a working unit before the catalog spotlight changes.

## Water, shots and the keeper's journal

A marked paddle exchanges one step between connected basins. Show the opposite level and the next berth before taking a shot. A resting ball travels with its pontoon when the water finishes moving. Ground rails reflect a putt; elevation lets a chip clear low lips. Sand, slope, shallow crossings and moving decks must behave as drawn. A water miss returns the ball to a playable lie and charges the marked penalty. Hole-specific requirements must produce visible feedback. Each inherited water state needs a legal route. Do not award a cleared island, unlock a club or mark the ferry home before its actual objective.

Store a versioned journal with the settled lie, strokes, stamps, basin state, completed best cards and unlocked holes. Resolve each stroke atomically so reload during an animation cannot duplicate the score or consume an extra stroke. Use best scores over replays; do not erase a better card. Online scores are optional, use a numeric sum and ask before posting. Leave the local card available offline.

## Delivery checkpoints

1. Open Gull Post with bank, lip, paddle and two-route quay. Verify recovery and tee inheritance. Mark first playable until every approved island exists.
2. Build Orchard Steps, including terrace returns, movable fruit barge, controlled runoff and the upper/lower pool choice.
3. Build Tinwhistle Mill and Glassbird Flats, with backspin and water skip earned on tour and available on earlier scorecards.
4. Link both dock approaches through the final three-lock staircase, ferry ending and pilot book. Exercise reachable inherited states, best cards and both fast and recovery routes.
5. Review input, material/landing cues, score submissions, save/resume, viewport sweep and all 20 holes before release. Keep critic, browser, device and human evidence distinct.

## Game-by-game distinctness

| Existing game | Distinct decision in Turntide Links |
| --- | --- |
| Aurora Tower Defense · elemental tower defense | Set a ball's lie for the next stroke |
| Bastion Builder · formation strategy | Prepare a ferry channel |
| Bayou Brawlers · side-scrolling brawler, unlisted | Control a shot's landing and roll |
| Core Crisis · survival shooter | Plan a bank at rest |
| Crimson Descent · thruster landing, unlisted | Commit spin before launch, then play from the resulting lie |
| Emberfall Gauntlet · arena action | Strike a lock paddle to alter the fairway |
| Gearwell · falling-block puzzle | Shape a route across two water levels |
| Ironwake · mech demolition campaign | Raise a floating deck with a controlled stroke |
| Lumen Pinnacle · pinball, unlisted | Pick the stroke from a settled lie and retain lock state across holes |
| Midnight Menagerie · deck-building roguelike, unlisted | Learn the contours of a fixed course |
| Neon Brick Breaker · paddle arcade | Choose a landing, then walk to the next shot |
| Nova Striker · shoot 'em up | Decide when to spend a stroke changing a lock |
| Paradox Vault · time-loop stealth heist | Leave physical water levels for the next tee |
| Prism Warden · mirror-shield action adventure | Shape the ball's flight over terrain |
| Pulse Loom · lane rhythm | Set power directly and read a slope |
| Signalbreak · turn-based squad tactics | Plan a single ball's lie across connected holes |
| Stormhook · grapple platformer | Choose loft and spin before releasing each shot |
| Tidelock · territory capture, unlisted and on hold | Change water depth to move a ball and ferry |
| Zephyr Circuit · kart racing | Compare strokes and persistent course states |
