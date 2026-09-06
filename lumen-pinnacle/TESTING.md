# Lumen Pinnacle — Testing

## Headless logic suite

From the repository root:

```text
npx jest __tests__/lumen-pinnacle.test.js --runInBand
```

The suite loads `assets/js/game.js` in a small browser-like VM context and
covers deterministic initialization, fixed-step motion, wall and bumper
collisions, flipper input, target completion, multiball, drain/game-over
handling, score calculation, and the leaderboard URL contract.

Before committing a broader change, run the full repository suite:

```text
npm test -- --runInBand
```

## Browser smoke

Serve the repository root over HTTP, then open `lumen-pinnacle/index.html`.
Confirm:

1. Start with the overlay button or `Space`.
2. Hold `ArrowLeft`/`A` and `ArrowRight`/`D` independently; the flippers
   visibly lift and release.
3. Tap the two on-screen flipper controls on a touch viewport.
4. Confirm the score, multiplier, target lamps, ball count, and event banner
   update while the ball is in play.
5. Drain all three balls and verify the final score overlay appears. A name
   can be submitted; a local API-less run should show a friendly unavailable
   message rather than throw an uncaught error.

## Responsive sweep

Check the game at 320x568, 390x844, 844x390, 768x1024, 1440x900, and
3840x2160. Confirm no horizontal scrollbar, no clipped start/game-over overlay,
touch controls inside the viewport on portrait and landscape, and a readable
score rail at every size. Visual checks count only after opening and reading
the screenshots.

The slice has no external art or font requests. The analytics tag inherited by
some older games is intentionally omitted here so a local smoke run stays
console-clean.
