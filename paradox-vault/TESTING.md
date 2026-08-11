# Testing Paradox Vault (read before you touch anything)

## Run it

A no-cache dev server is already running at **http://127.0.0.1:8900** serving the
repo root. If it is not up, start it with:

```
node "C:/Users/jshun/AppData/Local/Temp/claude/C--dev-tandem-tales-ai-game-of-the-day/0f6fe2f2-75d3-423d-bc00-f7f318f224d6/scratchpad/devserver.js"
```

Game URL: `http://127.0.0.1:8900/paradox-vault/index.html`

Useful query params (implemented in `game.js`):
* `?vault=N` — boot straight to vault N (1-based, 1..10)
* `?vault=N&auto=1` — …and skip the mission brief, straight into play

## Use the REAL Chrome tools, not the in-app browser pane

Use `mcp__claude-in-chrome__*`. The in-app `mcp__Claude_Browser__*` pane does not
composite, so `requestAnimationFrame` never runs and the game will appear frozen.

1. `mcp__claude-in-chrome__tabs_context_mcp` `{createIfEmpty:true}` to get a tabId
2. `mcp__claude-in-chrome__navigate`
3. `mcp__claude-in-chrome__computer` `{action:'screenshot'}`

**The tab pauses rAF whenever it is not the visible tab.** Any `javascript_tool`
call can steal focus, so the pattern that works is: navigate → screenshot (this
makes the tab visible and lets frames run) → screenshot again for the state you
want. If a screenshot shows the boot loader, just take another one.

## Driving gameplay without a keyboard

`PV.Input._down` is the raw button map. Set flags from `javascript_tool` to move:

```js
const D = PV.Input._down;
D.up = true;            // also: down, left, right, action, dash, rewind
```

Because rAF is paused while the tab is hidden, install a self-driving script and
then take screenshots to let it run:

```js
window.__bot = (seq) => { /* see below */ };
```

Handy state to assert on:

```js
PV.Game.state.phase        // 'boot'|'title'|'brief'|'playing'|'paused'|'clear'|'gameover'
PV.Game.world              // player, echoes, devices, relics, sentries
PV.Loop.fps, PV.Loop.msAvg
PV.Particles.count
PV.Textures.bakeMs, PV.Textures.names
PV.Render.camera           // {x,y,scale}
```

Force a rewind (spawns an echo, which is the signature mechanic and the thing
most worth looking at):

```js
PV.Game.rewind();
```

## Non-negotiables

* Console must be clean — no errors, no warnings.
* No horizontal scrollbar at any width:
  `document.documentElement.scrollWidth <= window.innerWidth`
* Must hold 60fps with 6 echoes + full VFX.
* Everything must work offline / from `file://` — no network fetches except the
  two leaderboard calls in `game.js`.
* Never edit a file you do not own. See the owner table in `SPEC.md`.
