# Ironwake — testing

From repository root: `node node_modules/jest/bin/jest.js --runInBand`.
Focused: `node node_modules/jest/bin/jest.js __tests__/ironwake.test.js --runInBand`.
The pure VM suite checks deterministic replay, directed progressive collapse,
crush timing, heat/venting, incoming fire, theft/proximity/exactly-once score,
solid tower/rubble collision, victory/escape/expiry and reset. Unit fixtures are
not natural play or fun evidence.

Run `node ironwake/tools/smoke.cjs` for an HTTP server and headless Chromium.
It closes both afterward. Windows defaults use the installed Playwright at
`C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`
and Chromium at
`C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe`.
Override with IW_PLAYWRIGHT and IW_CHROME elsewhere. Browser launch may need
approved execution outside the sandbox. No browser download is required here.

IW_VIEWPORTS can narrow debugging, for example `390x844,1440x900`; default checks
320x568,390x844,844x390,768x1024,1440x900,3840x2160. IW_SHOTS overrides output
(default ignored node_modules/.cache/ironwake/smoke). Read the PNGs; 4K may be
downsampled by the viewer. Check shader/WebGL warnings as well as page errors.

Smoke uses real input for deployment, opening aimed punch/tank crush, keyboard
movement and simultaneous native touch stick+fire/release. HOT and expiry are
explicit state fixtures for HUD wrapping, results, retry and mocked rank/submit;
they do NOT prove a naturally completed mission. Input taps are buffered across
frames so quick keyboard/pointer actions are not dropped.

## Normal-input first mission

Start on seed7. Aim through the first tower toward the road and punch. The
first tank should be crushed as the tower reaches it, not at the start of its
fall. Turn to the nearby escort, punch it disabled, approach and rip its gun.
Flank the fallen tower to the west and cross to the north side of the road.
Use the heavy gun against remaining tanks; vent between bursts. Standing south
of the fallen tower and firing through rubble should be blocked and explain
that a flank is needed. Destroyed structures stay cover, not perpetual kill zones.

Record real keyboard and native touch full runs with normal100-second clock:
HP, heat, theft, direct/collapse kills, outcome and elapsed game/wall time. No
injected position/HP/cargo/timer for gameplay evidence. Renderer.project(x,z)
supports read-only targeting in browser harnesses. Native touch must combine
stick steering with aim and actions. Test input cancellation/blur/retry.

Independent critic should contrast naive direct fire with deliberate demolition
and flanking. A win proves reachability, not fun; await human response to the
first playable before declaring the core engaging. Art is a 3D low-poly scaffold,
not AAA. Full districts/fortress boss and physical-device performance unverified.
