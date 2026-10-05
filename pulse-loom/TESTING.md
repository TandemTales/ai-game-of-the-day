# Pulse Loom testing

- Run `node_modules/.bin/jest.cmd --runInBand --cacheDirectory node_modules/.cache/jest __tests__/pulse-loom.test.js` from the repository root on Windows.
- For the full repository suite, omit the final test path. A workspace cache avoids sandbox temp-directory permission errors.
- Browser smoke: serve the repo root, open `/pulse-loom/index.html`, start the song, press D/F/J/K or tap each lane, observe score/combo feedback and a preview before each 32-beat rotation, finish the 128-beat chart, then retry. No external asset requests should occur.
- Check 320×568, 390×844, 844×390, 768×1024, 1440×900, 3840×2160 for clean console and no horizontal overflow. Inspect screenshots directly before claiming visual verification.
- Check `file://` play independently; leaderboard should be skipped there. Over HTTP, the rank GET must precede a top-20 score POST.
