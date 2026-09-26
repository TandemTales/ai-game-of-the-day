# Sera directional art — September 26, 2026

The approved north/back view, `sera-keeper-topdown-v3.png`, is unchanged.
Seven transparent painted views replace the procedural body at all other angles:
`sera-keeper-{s,sw,w,nw,ne,e,se}-v1.png`.

Created with the built-in image generator using the approved back sprite as the
identity/style reference. The accepted first sheet was cropped into directional
cells, preserving its generated alpha, and resized into 256×320 transparent frames.
Each figure occupies 296 pixels vertically, with 12-pixel top/bottom margins;
its crown centers on the frame so shield width does not shift the body sideways.
The source sheet was 1536×1024, arranged in four columns and two rows.
The generated north cell is intentionally unused. Runtime key lighting is the
same cached alpha-clipped treatment as the original back sprite.

## Accepted generation prompt

Use case: identity-preserve. Production 8-direction character turnaround sprite sheet for Prism Warden. Reference image is the approved BACK (north-facing) view of Sera; match this exact character, proportions, costume, detailed warm hand-painted game illustration rendering, linework and colors. Create a transparent PNG sheet, 4 columns by 2 rows, all eight fully separated full-body figures, identical scale and feet baseline within each cell, ample transparent gutters. Row 1 left to right: facing SOUTH (front), SOUTHWEST (front three-quarter looking screen-left), WEST (left profile), NORTHWEST (back three-quarter looking screen-left). Row 2 left to right: NORTH (back as reference), NORTHEAST (back three-quarter looking screen-right), EAST (right profile), SOUTHEAST (front three-quarter looking screen-right). Fixed elevated top-down game camera matching reference: look down at crown of head and shoulders, foreshortened lower body, all views share this elevation, no eye-level portraits. Preserve auburn copper hair with a long single thick braid down the back tied with a bronze cuff, ivory cream split coat with dark petrol-teal broad borders and sailor shoulder collar, bronze shoulder studs, brown leather belt and round bronze buckle, leather wrist guards and boots, dark teal leggings and belt pouch. Young adult woman with natural face and focused calm expression; front has the same detailed painted sculptural volume as reference. Round bronze mirror shield with lighthouse/star relief ALWAYS on her anatomical LEFT forearm; right hand empty relaxed, NO swords, no extra weapons or extra shields. Shield moves naturally with the actual orientation of the body. Soft upper-left lighting, precise outlined silhouette and richly shaded folds, no cast ground shadows, no floor, no scenery, no text, no grid lines. Each figure centered inside its equal-sized cell. Do not crop hair, shield or boots. True transparent background. Output a wide high resolution sheet.

## Verification

`node prism-warden/tools/character-art-smoke.cjs` exercises all eight views in
idle, mirror and slash poses, verifies eight distinct painted bodies without
simulation mutation, captures desktop and portrait scenes, and checks that a
missing directional asset still renders the procedural fallback. Evidence is
written under ignored `node_modules/.cache/prism-warden/character-art/`.
