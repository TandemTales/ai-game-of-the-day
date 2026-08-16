# Design Spec — Companion Build Orders

Companions previously rolled **random** upgrades at recruit time
(`applyRandomCompanionUpgrades`), so the same ally could arrive useless or
dominant from run to run, and the encounter difficulty around them could not be
tuned. Each character now has a fixed build order.

This is **implemented** in `index.html` as `COMPANION_UPGRADE_PLANS` /
`applyCompanionUpgradePlan`. This document records the reasoning so the lists can
be revised deliberately.

---

## How it works

- Index 0 is the **level-2** pick, index 1 the level-3 pick, and so on.
- Companions currently recruit at **level 6** (`getCompanionRecruitLevel`), so only
  the first five entries are used today. The lists run to nine so raising the
  recruit level needs no further work.
- Entries are validated against the character's real upgrade pool and skipped if
  the companion is below the upgrade's `requiresLevel`. Ordering is chosen so that
  guard never actually fires — verified for every character at every level 2–10.

## Selection principle

Companions are AI-controlled and **cannot time inputs**. Every pick favours:

1. **Always-on passives** over anything requiring a window or a combo.
2. **Survivability early** — a dead companion contributes nothing, and they
   recruit with 75% max HP, 85% attack power and 92% speed.
3. **Damage that lands automatically** — auras, on-hit riders, wider areas.

Deliberately avoided: upgrades keyed to blocking, dodging on reaction, or precise
super timing, since the companion AI does not use those well.

---

## The build orders

Bold = the five that matter at the current recruit level of 6.

### Billy Boxby — freeze control
**`cold-barrel`** → **`permafrost-boots`** → **`deep-chill-blast`** → **`lingering-chill`** → **`ice-in-the-veins`** → `snap-frost` → `hard-freeze` → `shatter-shock` → `black-ice`

Opens with the passive slow rider, then hazard resistance so he survives the swamp
and mansion stages. Freeze duration extensions pay off without any timing.

### Green Fairy — charm support
**`irritating-pollen`** → **`float-step`** → **`fairy-flurry`** → **`deeper-enchantment`** → **`bewitching-presence`** → `sweet-sting` → `royal-command` → `perfect-glamour` → `helpful-friends`

Charm is the strongest thing an ally can do for the player, so duration
(`deeper-enchantment`) comes early. `perfect-glamour` sits at level 9; its gate was
lowered from 10 to 7 so it is reachable at all.

### Shunky Rooster — beam bruiser
**`staggering-blast`** → **`reinforced-plating`** → **`shockwave`** → **`focused-chest-ray`** → **`heavy-frame`** → `penetrating-beam` → `armor-overcharge` → `power-dynamo` → `core-boost`

Two defensive picks early because he is stationary while firing. `focused-chest-ray`
over `broad-chest-ray` since the beam now hits a single target.

### Grimma the Feared — reach and roots
**`long-lash`** → **`sadists-grace`** → **`cruel-crack`** → **`dancers-step`** → **`deeper-shadows`** → `barbed-snap` → `black-halo` → `whip-mastery` → `hungry-dark`

`dancers-step` is gated to level 5 and is placed exactly there. Reach first — the
AI keeps its distance poorly, so a longer whip covers for it.

### Possumatli — evasive skirmisher
**`rapid-strikes`** → **`possum-nerves`** → **`sweeping-staff`** → **`longer-feint`** → **`spirit-mastery`** → `extended-reach` → `tornado-staff` → `master-of-the-bayou-path` → `knockdown`

Attack speed and sweeping AoE suit an AI that mostly walks into crowds.

### Rustbucket — turret support
**`faster-draw`** → **`steel-sheriff`** → **`piercing-shot`** → **`extended-sentry`** → **`auto-loader`** → `hardened-rounds` → `targeting-upgrade` → `quick-reboot` → `gyro-stabilizers`

Sentry mode is the ideal companion ability: he plants and contributes without
needing positioning. `extended-sentry` early.

### Scarlett Glumpkin — poison zoner
**`toxic-blend`** → **`thornproof-gloves`** → **`volatile-seeds`** → **`deep-roots`** → **`compound-formula`** → `wider-scatter` → `carnivorous-bloom` → `wild-growth` → `toxic-bind`

Damage-over-time is the most AI-proof damage in the game — it keeps ticking
regardless of what the companion does next.

### Old Man Croc — frontline
**`powerful-bite`** → **`thick-hide`** → **`bone-crunch`** → **`long-roll`** → **`swamp-hunger`** → `lockjaw` → `predator-rush` → `cold-blooded` → `mauling-grip`

Built to soak. `swamp-hunger` gives sustain so he can hold a line unattended.

---

## Verification

Confirmed in-browser:

- All 72 upgrade ids resolve against their character's real pool; no duplicates.
- All 8 playable characters have a plan.
- Building the same companion twice yields identical upgrades (deterministic).
- No plan entry conflicts with a `requiresLevel` gate at any level 2–10.

---

## Related change

`perfect-glamour` (Green Fairy) was gated at `requiresLevel: 10`, which in practice
meant it almost never appeared in a run. Lowered to **7**, so a charm build can
reach it while it still has levels left to pay off.
