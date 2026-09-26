# Sera walking cycles — September 26, 2026

Eight transparent atlases: `sera-walk-{s,sw,w,nw,n,ne,e,se}-v1.png`.
Each is 1536×320: six chronological 256×320 frames in a horizontal strip.
The existing idle sprites remain unchanged. Created with the built-in image
generator from each approved directional idle sprite.

Frames were selected from generated sheets, cropped with their alpha intact and
registered by the crown center. One common scale is used throughout each cycle;
foot extension never changes the scale of individual frames. The north cycle
reuses its passing pose between the two contacts.

## Playback

The renderer preloads every atlas and caches separately lit frames. It uses actual
player displacement for the gait: 96 world units per cycle, so slower reflection
and wading also slow the steps. Backpedaling reverses playback; aiming and strafing
remain independent. Stopping against a wall returns to idle. Paused duplicate
draws keep their pose; dashes, room jumps and long clock gaps do not advance a
walk. A missing atlas falls back to the approved idle sprite for that direction.
Animation state lives in a renderer WeakMap and never enters saves or simulation.

## Generation prompts

The initial prompt below was used for each direction, replacing DIRECTION with
the corresponding compass direction and view. Each input was the matching idle
sprite; north used `sera-keeper-topdown-v3.png`.

Use case: identity-preserve. Asset: production six-frame looping WALK animation sprite sheet for the attached Prism Warden character Sera. Reference is the exact approved idle sprite: preserve her identity, costume, proportions, colors, hair and detailed hand-painted style. All SIX frames face DIRECTION, with the same elevated top-down camera as reference. Do not turn the character during this sheet. Layout exactly THREE columns by TWO rows, read left-to-right top row then bottom row, equal square cells, one whole character per cell, feet near the same baseline and torso centered consistently; generous clear gutters. Six DISTINCT chronological poses of one full natural walking cycle: 1 left-foot forward contact/right-foot back; 2 left leg bears weight, right heel lifts and right knee begins swinging forward; 3 right knee passes supporting left leg; 4 right-foot forward contact/left-foot back; 5 right leg bears weight, left heel lifts and left knee begins swinging forward; 6 left knee passes supporting right leg. Frame 6 loops smoothly to frame 1. Clearly animate opposing legs and boot positions with foot lifts, subtle counter-swing of empty right arm, gentle braid and coat-hem swing and small torso bob. This is relaxed purposeful WALKING, not running or marching. Do NOT duplicate the same pose six times. Left forearm always carries the same bronze shield; no sword, no added gear. Keep auburn braided hair, ivory coat with dark teal trim/collar, leather belt, wristguards, boots and original facial features where visible. Keep the SAME face, head size and body size in EVERY frame. Soft top-left shading consistent with reference. Transparent PNG, actually transparent alpha outside the silhouettes, NO floor, NO cast shadows, NO scenery, NO colored backdrop, NO text, no labels or cell borders. Do not crop any limb, hair or shield.

The guided refinement prompt used a second reference showing six projected
skeletal poses, with anatomical left/right legs distinguished by guide colors.
The colors were guidance only, never part of the final sprites.

Create a SIX-FRAME LOOPING WALK CYCLE sprite sheet for Sera. Image 1 defines the exact painted character appearance. Image 2 defines REQUIRED distinct leg poses in chronological frame order; follow the blue (anatomical LEFT) and orange (RIGHT) leg silhouettes, but render legs in Sera's real dark teal leggings and brown boots. Top row contact-left, passing toward right, right step; bottom row opposite contact-right, passing toward left, left step. The legs MUST exchange forward and backward positions halfway through the cycle. This is animation, NOT six copies of the same pose. Entire character always faces DIRECTION, at the fixed elevated top-down camera of image 1. Keep the exact head, braid, cream-and-teal coat, bronze left-arm shield and same body proportions. Opposing arm swing and small coat/braid sway. Six equal cells in exactly 3 columns and 2 rows, identical scale and body-center placement. Empty right hand, no sword. Transparent PNG, no labels, no color guide visible, no ground, no cast shadows, no backdrop.

Targeted refinements corrected the front diagonal bottom-row leading legs and
the north passing frame's shield hand. A north proportion refinement enlarged
the head/hair by about 20 percent, broadened shoulders slightly and shortened
the lower legs to match the original back view while retaining overall height.
The south cycle combines the approved alternating contacts and passing poses
from its initial and guided sheets.

## Checks and preview

- `node node_modules/jest/bin/jest.js __tests__/prism-warden-animation.test.js --runInBand`
- `node prism-warden/tools/walking-art-smoke.cjs`
- `node prism-warden/tools/character-art-smoke.cjs`

The walking browser check uses legal movement, guard and slash simulation inputs
in all eight directions, checks frame selection and stop-to-idle, verifies that
drawing does not mutate state, and exercises a missing-atlas fallback. It saves
60 preview frames and a JSON report in ignored
`node_modules/.cache/prism-warden/walking-art/`. An animated GIF and MP4 in that
directory show the real actor renderer walking, then returning to idle.
