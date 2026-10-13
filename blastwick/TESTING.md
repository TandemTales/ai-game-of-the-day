# Blastwick testing
- `npx jest blastwick` — loads `logic.js` in a `vm` context: determinism, collision, fuse/blast, chain scoring, blast shapes, stage clear, tide, solvability.
- Visual: serve repo statically, drive with Playwright (Chromium at /opt/pw-browsers), `BW.debug.start()` and `BW.debug.st` expose state. Check 320x568, 390x844, 844x390, 768x1024, 1440x900, 3840x2160; no horizontal scroll; console clean (the Google tag fails offline only).
