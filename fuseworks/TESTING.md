# Fuseworks testing

- `npx jest fuseworks` from the repo root: blast/prism geometry, deterministic connected floors, chains, scoring, bot containment, game over.
- Browser: serve repo root (`python3 -m http.server`), open `/fuseworks/index.html`, start, move with arrows/WASD, Space drops a bomb; on touch use the d-pad and BOMB button.
- Check 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160: clean console, no horizontal scroll. Read the screenshots.
- `file://` play works; leaderboard is skipped there. Over HTTP the rank GET precedes a top-20 POST.
