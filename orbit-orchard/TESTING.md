# Orbit Orchard — Testing

## Headless logic suite

From the repository root:

```text
npx jest __tests__/orbit-orchard.test.js --runInBand
```

Before committing a broader change, run the full repository suite:

```text
npm test -- --runInBand
```

The suite loads `assets/js/game.js` in a browser-like VM and covers deterministic
field generation, start/reset behavior, keyboard steering, absorb eligibility,
growth and scoring, same-color links, gravity attraction, hazard penalties,
timer game-over, formatting, and the leaderboard URL contract.

## Browser smoke

Serve the repository root over HTTP, then open `orbit-orchard/index.html`.
Confirm:

1. The start card is visible and `Space` or `ENTER ORBIT` begins a run.
2. WASD/arrow keys move the seed; dragging on the canvas steers it on touch or mouse.
3. Small relics disappear into the seed, increase MASS, increase SCORE, and show a burst/event label.
4. Same-color pickups show `CONSTELLATION LINK` and raise the multiplier.
5. Gravity wells visibly pulse; touching one costs four seconds and pushes the seed away.
6. Let the timer expire or harvest the field; the final-score card appears and the offline leaderboard message is friendly.
7. The back link returns to `../index.html`.

The game has no external art, font, audio, or runtime data fetch. A local
analytics request must not be added to this new game's page.

## Responsive sweep

Check 320x568, 390x844, 844x390, 768x1024, 1440x900, and 3840x2160. Confirm
the requested canvas dimensions are respected by the browser, no horizontal
scrollbar exists, the start/game-over cards are fully readable, the HUD stays
legible, and the touch hint never blocks the seed. Visual checks count only
after opening and reading the screenshots.
