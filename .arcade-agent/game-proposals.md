# Choose the next Bot Built Arcade game

status: selected
selected: 1. Turntide Links
selection-source: User replied "1" in the game-choice chat on 2026-11-27 Pacific.
proposed: 2026-11-22
timezone: America/Los_Angeles

Signalbreak shipped November 21. Its November 2 selection is recorded in its SPEC and in the previous version of this file at c5e2d7b. Tidelock is on hold. The three pitches below preserve the slate as presented. Implementation of Turntide Links began November 27 Pacific.

## 1. Turntide Links

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

## 2. The Midnight Dining Car

**Cooking and service management.** Run the dining car on the last overnight train before a mountain line closes. A porter knows who's changing trains, the pantry has one basket of mushrooms, and a sleeper table can wait. Do you make hot pies for the departing passengers or hold the oven for the bread that will feed two cars at dawn?

**How a service plays.** Read the carriage plan and departure board, choose a short menu from station produce, then prep, cook, hold and dispatch portions. A tray cart makes one trip at a time through connected cars. Park it at the wrong end and a perfect dish can miss its passenger. A base stock or dough can become two dishes. Freshness, shared burners and compartment deadlines make batching a choice. Time can be paused to inspect tickets and queue the next handoff. At each stop a returning passenger teaches a recipe when you deliver their requested meal.

| Stretch of line | Four authored services in timetable order |
| --- | --- |
| Copper Arcade | 01 Split breakfast between a quick counter and a departing porter. 02 Turn a single stockpot into two distinct orders. 03 Send a batch past an occupied trolley siding. 04 Serve both halves of a family seated across the dining-car door before their stop. |
| Plum Orchard Branch | 05 Buy fruit for either hand pies or a preserve that travels. 06 Stagger baking and cooling on a single rack. 07 Reload the cart from a platform stall during a short stop. 08 Serve the orchard pickers' shared supper using trimmings reserved during prep. |
| Snowglass Viaduct | 09 Load lidded dishes for the rough crossing. 10 Move a hot course into insulated storage before the tunnel cuts oven power. 11 Change trolley ends at the passing loop to reach a sleeper in time. 12 Bring two separately cooked courses to one anniversary table in the same delivery. |
| Lantern Junction | 13 Identify which ticket holders leave on the connecting train and pack their meals. 14 Send the pantry cart ahead before the carriages divide. 15 Replan a menu around crates delivered to the opposite half. 16 Reunite the two carts and finish a dish whose components traveled separately. |
| Daybreak Terminal | 17 Build breakfast around the ingredients carried over, with a station staple available for any pantry. 18 Reserve seats and oven space for the returning night crew. 19 Serve a moving farewell party as two tables exchange cars. 20 Cater the last platform banquet in three courses, choosing whose learned recipe receives the final toast. |

**Journey and mastery.** The passenger ledger records fulfilled promises, recipes and cleared services. A basic menu always reaches the next stop. Optional dishes earn alternate banquet toasts and can replace cumbersome recipes on a replay. Save pantry and itinerary at service boundaries, plus a resumable in-service snapshot on pause. Each service scores 500 for completion, 100 per correctly delivered ticket, 150 per fulfilled promise and 100 for zero waste. Only the best total per service contributes to the board.

**Controls and presentation.** Tap a ticket, station and destination, or use the matching numbered stations and arrow/Enter ticket selection. Long carriages fit a scrollable route strip above a fixed kitchen, and every drag has a tap alternative. Show the change from station mosaics through frosted carriage glass to a sunlit platform. Give simmer, oven, door and trolley distinct sounds and matching visible cues. Steam, lacquered tray reflections and window-lit passenger portraits carry the food and characters through the final dinner.

**Production risk and sequence.** Twenty busy shifts can become a repetitive tapping test. Commit to three cooking stations, one route diagram and the four different service problems per stretch above. Days 1–2 prove a missed connection and a successful alternate dispatch using touch and pause. Days 3–5 deliver Copper and Plum plus recipes and saves. Days 6–8 author Snowglass outages and the Lantern train split. Days 9–10 deliver Daybreak, pantry fallbacks and all banquet outcomes. Days 11–14 replay all services with minimal and well-stocked pantries, then review pacing, phone legibility and competing sound cues.

**Design references.** The arcade ancestor makes assembly progress visible in the food itself. Vertigo Gaming's kitchen management gives menu choice consequences during service. The single-track trolley and timetable turn the dining room into a routing problem of its own. [Hamster on arcade Burger Time](https://www.arcadearchives.com/en/title/aca-123/) · [Vertigo Gaming's Cook, Serve, Delicious! 2!! press kit](https://www.vertigogaming.net/csd2presskit/)

## 3. The Quiet Migration

**Wildlife photography and field deduction.** The town has lit its autumn lanterns, but the ribbonwings have flown past the festival meadow. Follow the missing flock from the old observatory to its winter roost. At the glasshouse, two flocks look identical in a photograph. Only one hands its young a seed before it flies. Catch that exchange, trace where the seeds came from and learn which exit the family needs.

**How a survey plays.** Choose a hide and one of three watches (dawn, noon or dusk). Inspect tracks and sightlines, advance or pause the watch and frame a behavior with the camera. Pin two observations to a specific prediction about food, shelter or passage. Test it by changing one authored feature, such as turning down a lamp or opening a shutter. On the next watch, visible animal behavior confirms the prediction or gives you evidence to revise it. Disturbance alters who appears in the foreground. A failed attempt can be repeated immediately from the hide. Sound clues always have a visual equivalent.

| Landscape | Four authored field investigations |
| --- | --- |
| Bell Orchard | 01 Distinguish a feeding call from a warning by photographing its aftermath. 02 Match a split seed husk to the bird that opens it. 03 Use two perches to identify who carries food to the hidden nest. 04 Compare dusk arrivals with the festival lamp lit and shaded, then mark the first passage. |
| The Paper Marsh | 05 Separate a moving reflection from an actual second bird using a second hide. 06 Identify the reed island used at high water from bent stems and a landing. 07 Catch a ferry wake interrupting a feeding exchange and test the sheltered inlet. 08 Follow the reed carrier, then uncover a resting pool that both flocks can reach. |
| Widow's Glasshouse | 09 Distinguish a family from lookalikes by recording the seed handoff. 10 Trace the fruit stain on a bird's breast to one of two growing rooms. 11 Shade a pane to break a false sky reflection and photograph the changed approach. 12 Open the exit that leads the family to food and watch the juvenile follow. |
| Kitewire Ridge | 13 Map the updraft using drifting tufts and the first circling bird. 14 Find the sheltered perch a juvenile can reach between gusts. 15 Distinguish a lookout's warning silhouette from a hunting kite by how the flock responds. 16 Test two windsock positions to mark a crossing used by adults and young together. |
| The Winter Bowl | 17 Identify which arriving birds came through the orchard by their feeding habit. 18 Pair midday tracks with a dusk silhouette to locate the nursery roost. 19 Use the ridge watch and the marsh landing record to choose a sheltered approach for the late family. 20 Pick a winter corridor from the accumulated evidence, adjust its final landmark, and photograph the family's complete arrival for the town atlas. |

**Journey and mastery.** A verified passage adds a stop to the migration map. Earlier pairs of observations become usable evidence in later chapters. Optional undisturbed plates unlock alternate atlas spreads and a second documented winter corridor. The epilogue shows the route you proved and which family behaviors you recorded. Save journal, hides, habitat decisions, current watch and best assignment scores locally. Each case contributes up to 1,000 points: 500 for a verified prediction, 300 for the identifying behavior in frame and 200 for an undisturbed plate. Revisit a hide with a later vantage or new knowledge to improve its best.

**Controls and presentation.** Tap to switch hides, drag or arrow-pan the viewfinder, and tap shutter or use Space. Large previous/next controls scrub an observed watch, with a click-or-tap pair selector in the journal. Use layered cut-paper panoramas and distinct wing, beak and tail poses, with a close inspection view for held frames. Animate the food handoff and the juvenile's hesitation before flight. Each family has a call drawn as a recognizable shape on the watch strip. Their calls form the dawn chorus at the ending.

**Production risk and sequence.** A small bird behind foliage can turn reasoning into a pixel hunt. Use named sightlines and discrete illustrated poses with generous framing tolerance. Days 1–2 build a complete prediction, reversible intervention and observable outcome in the orchard. Days 3–5 author all Orchard and Marsh cases, the journal and save/restore. Days 6–8 add the Glasshouse and Ridge, including animation, alternate explanations and evidence links. Days 9–10 author the Winter Bowl, both corridors and atlas scoring. Days 11–14 trace every clue from a fresh journal, check phone framing with sound off and seek a fresh-player solve for ambiguous deductions.

**Design references.** N64 Pokémon Snap gives observation a shutter button. Beyond Good & Evil on PS2 made a camera a working tool for a protagonist. The Xbox 360 Viva Piñata sequel demonstrates an environment that changes which creatures visit. Here the photograph supplies evidence for a prediction the player can test in the next watch. [Nintendo on Pokémon Snap](https://www.nintendo.com/en-gb/Games/Nintendo-64/Pokemon-Snap-269668.html) · [PlayStation on Beyond Good & Evil](https://blog.playstation.com/?p=37402) · [Xbox's Viva Piñata: Trouble in Paradise guide](https://nxeassets.xbox.com/shaxam/0201/02/6c/026c770b-0675-48e5-8a86-eb4ede267022.PDF?v=1)

## Comparison with the repository

The root catalog has 14 game cards. Five more playable game directories have local entries. Each row names the existing game's core action and the decision each proposal adds. The empty comet-foundry directory has no runtime. The level-editor directory contains an authoring tool.

| Existing game and genre | Turntide Links | The Midnight Dining Car | The Quiet Migration |
| --- | --- | --- | --- |
| Aurora Tower Defense · elemental tower defense | Set a ball's lie for the next stroke | Allocate a burner to a batch | Trace a visitor to its food source |
| Bastion Builder · formation strategy | Prepare a ferry channel | Choose a menu the train can serve | Test which habitat change attracts a flock |
| Bayou Brawlers · side-scrolling brawler, unlisted | Control a shot's landing and roll | Time a course for a departing table | Identify a bird by what it does next |
| Core Crisis · survival shooter | Plan a bank at rest | Queue cooking and dispatch | Choose a quiet hide for an observation |
| Crimson Descent · thruster landing, unlisted | Commit spin before launch, then play from the resulting lie | Sequence multiple tables' orders | Compare a flight path across watches |
| Emberfall Gauntlet · arena action | Strike a lock paddle to alter the fairway | Budget stock across courses | Use a warning reaction as evidence |
| Gearwell · falling-block puzzle | Shape a route across two water levels | Choose how to split a prepared batch | Link two records to a prediction |
| Ironwake · mech demolition campaign | Raise a floating deck with a controlled stroke | Reconnect meals when carriages rejoin | Verify an intervention by observing the return |
| Lumen Pinnacle · pinball, unlisted | Pick the stroke from a settled lie and retain lock state across holes | Set destinations for perishable plates | Frame an identifiable pose in a held scene |
| Midnight Menagerie · deck-building roguelike, unlisted | Learn the contours of a fixed course | Plan from known tickets and station stocks | Build and test an explanation from field records |
| Neon Brick Breaker · paddle arcade | Choose a landing, then walk to the next shot | Make a cart trip serve several tables | Change a sightline to disprove a reflection |
| Nova Striker · shoot 'em up | Decide when to spend a stroke changing a lock | Use train stops as deadlines | Capture a particular exchange between two animals |
| Paradox Vault · time-loop stealth heist | Leave physical water levels for the next tee | Prepare tomorrow's menu from today's stores | Compare observations of independent animal behavior across watches |
| Prism Warden · mirror-shield action adventure | Shape the ball's flight over terrain | Split a dinner across two service routes | Use a changed flight path to infer a reflection hazard |
| Pulse Loom · lane rhythm | Set power directly and read a slope | Reorder tasks against passenger departures | Read a call in context at a chosen pace |
| Signalbreak · turn-based squad tactics | Plan a single ball's lie across connected holes | Dispatch food through a working train | Confirm an ecological prediction through observation |
| Stormhook · grapple platformer | Choose loft and spin before releasing each shot | Alternate cooking, holding and dispatch | Move between observation posts to corroborate a sighting |
| Tidelock · territory capture, unlisted and on hold | Change water depth to move a ball and ferry | Move prepared dishes through a timetable | Establish a corridor by linking behavior to habitat |
| Zephyr Circuit · kart racing | Compare strokes and persistent course states | Coordinate passengers with different destinations | Trace where a flock went from physical evidence |

**Original recommendation.** The Quiet Migration was recommended for its fieldwork. The user selected Turntide Links.
