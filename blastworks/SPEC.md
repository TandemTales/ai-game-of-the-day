# Blastworks — Module Contract

Grid-arena bomber (Super Bomberman lineage, original IP) with the **Pressure** twist: each
bomb adds +14 to a shared gauge (bleeds when no bombs are live); at 100 a **Quake** instantly
detonates every bomb on the board, owner-agnostic. Classic non-module scripts on `window.BW`.

| File | Owner |
|---|---|
| assets/js/logic.js | lead (pure, deterministic sim; unit tested under `vm`) |
| assets/js/render.js | agent-render |
| assets/js/audio.js | agent-audio |
| assets/js/main.js | lead (input, HUD, leaderboard) |
| assets/css/game.css, index.html | agent-ui |

## Distinct from existing arcade games
Only grid-based, turn-tile bomber: Ironwake/Stormhook/Zephyr are 3D; Paradox Vault is a time-loop
stealth heist; Prism Warden is real-time action-adventure; Neon Brick Breaker, Aurora/Bastion are
paddle/tower-defense; Nova Striker/Core Crisis are shooters. None has tile-locked bombing, chain
reactions or a shared global-pressure mechanic.
