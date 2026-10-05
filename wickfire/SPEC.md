# WICKFIRE — Module Contract

A grid-arena bomb game in the Bomberman lineage (Super Bomberman / arcade foundation), new IP.
You are a fuse-wright in a collapsing powder mine. Plain classic scripts (no ES modules; runs from
`file://`), one global `window.WF`, all art and audio procedural, no external fetches.

## Concept and twist
15x13 grid, indestructible pillars, destructible crates, wandering/chasing/bombing foes, power-ups
(range, bombs, speed, fuse length). **Twist — the live fuse:** you trail a fuse of your last N tiles.
A blast touching any fuse tile ignites it; the burn races along it (0.07 s/tile), detonating every
bomb threaded on it and scorching anything standing on a burning tile — including you at the head.
**Cut** (X/Shift/CUT) severs the fuse at your tile: the detached piece stays on the map 14 s as a
remote detonator line, and the severed trail is no longer attached to you. Lay fuse, thread bombs,
cut, retreat, then set it off from afar. Cutting a burning trail is the emergency escape.
Score: crates 10, foes 100/200/300 (multiplied by foes per blast), chain bonus n²·25 per
multi-bomb chain, power-ups 50, level clear 500 + 5/s remaining. 3 lives, endless escalating levels.

## File ownership (one sub-agent per file; integration layer owned by the lead)
| File | Owner / role |
|---|---|
| `assets/js/logic.js` | Rules, determinism, enemies, fuse/chain, scoring. Pure, headless-tested. |
| `assets/js/render.js` | Canvas art: tiles, sprites, lighting, particles, HUD, touch-control art. |
| `assets/js/audio.js` | WebAudio SFX + adaptive music. |
| `assets/js/main.js` | Lead only: loop, keyboard/touch input, UI flow, leaderboard. |
| `assets/css/game.css`, `index.html` | Lead only. |

## Distinct from every existing arcade game
- **Ironwake** — 3D third-person mech demolition campaign; Wickfire is a top-down discrete-grid arena.
- **Stormhook** — side-view momentum grapple platformer; no grid, no bombs.
- **Zephyr Circuit** — 3D kart racer.
- **Paradox Vault** — time-loop stealth puzzle; Wickfire is real-time, score-chasing.
- **Lumen Pinnacle** — pinball.
- **Bayou Brawlers** — side-scrolling beat-em-up.
- **Crimson Descent** — precision lander.
- **Midnight Menagerie** — turn-based deck-builder.
- **Emberfall Gauntlet / Core Crisis / Nova Striker** — free-movement shooters and wave survival; Wickfire has no shooting, only placed timed explosives on a tile grid.
- **Bastion Builder / Aurora Tower Defense** — strategy/defense; no direct avatar chain-puzzle.
- **Neon Brick Breaker** — paddle/ball.
- **Prism Warden** — Zelda-like adventure with a mirror shield; Wickfire is a bounded arena with a fuse-routing mechanic.
