# Design Spec — The Shapeshifter (player character)

Hand-off spec for implementation. Data shapes below match what `index.html`
already uses (`characters[]`, `CHARACTER_UPGRADES`, `AUTO_LEVEL_GAINS`), so this
can be dropped in without inventing new structures.

Working name: **Mimsy Vole** (rename freely — `id: 'shapeshifter-pc'` is what the
code keys on). Note the enemy type `shapeshifter` already exists on the Airship
stage; keep the player id distinct to avoid collisions in `ENEMY_SPECIALS` and
`ENEMY_CHARACTER_SFX`.

---

## 1. Core mechanic

He turns into any enemy he has defeated, for a short time.

| Rule | Value |
|---|---|
| Transform duration | 12s base (720 frames) |
| Cooldown after a form ends | 6s base (360 frames) |
| Health | **Always his own.** Forms never change max or current HP |
| Basic (light) attack | The form's primary attack |
| Heavy attack | The form's second attack if it has one; otherwise his own heavy |
| Special | His own — *Rifle the Skin* (see below). Forms never override it |
| Movement speed | Averaged: `(his speed + form speed) / 2`, so fast forms still feel fast without trivialising slow ones |
| Form pool | Only enemy types he has personally defeated at least once, persisted per save |

**Why health is his own:** it keeps forms a pure offense/utility choice rather than
a survivability one, so turning into a 250 HP boss isn't strictly correct.

### Selecting a form
Transform opens a radial/list picker (reuse the character-sheet overlay pattern).
Pausing the action there is fine — it matches the existing level-up overlay.

### The "defeated" ledger
Add to the save slot (`SAVE_SLOT_KEY`):

```js
defeatedForms: {           // enemy type id -> times defeated
  'daphodilus': 14,
  'hiredGun': 3
}
```

Populate it in `damageEnemy()` where `enemy.hp <= 0` is handled, alongside the
existing score/XP award. Boss forms additionally require the matching unlock
upgrade (§4).

---

## 2. Base kit (no form active)

| Slot | Name | Effect |
|---|---|---|
| Light | Shifting Jab | Fast, short reach. 13 dmg |
| Heavy | Bone Rearrange | Wind-up overhead, 26 dmg, knockback 30 |
| Special | Rifle the Skin | Instantly transform into the **last enemy type he killed**, no picker. Cheap tempo option |
| Super | Legion | Transform and spawn two AI-controlled copies of the chosen form that fight for him for 8s |

Suggested stat line, in the same shape as the other `characters[]` entries:

```js
stats: { speed: 3.2, power: 0.95, range: 44, durability: 104 }
```

Deliberately median across the roster — his power is flexibility, not raw numbers.

---

## 3. Automatic level gains

Slot into `AUTO_LEVEL_GAINS` as the shapeshifter's column. Levels 3 and 5 keep the
roster-wide special/super unlocks so he isn't off-curve.

| Level | Gains |
|---|---|
| 2 | +8% max health, +1s transform duration |
| 3 | Unlock special ability use, +20 max power meter |
| 4 | +5% heavy attack damage, +5% movement speed |
| 5 | Unlock super special ability use, +20 max power meter |
| 6 | +8% max health, +1s transform duration |
| 7 | +5% basic attack damage, -1s transform cooldown |
| 8 | +10 max power meter, +5% heavy attack damage |
| 9 | +8% max health, +1s transform duration |
| 10 | +5% all damage, +10 max power meter, unlock final passive trait |

**Level 10 passive — Perfect Mimicry:** transformations no longer expire on a
timer; a form lasts until he takes damage equal to 25% of his max HP, then breaks.

---

## 4. Boss form unlocks

Five upgrades, each granting two stages' bosses, gated on having actually beaten
them. These are the character's spine — they should appear in the upgrade pool at
the listed `requiresLevel` and be **non-repeatable**.

| Upgrade id | Level | Grants (if defeated) |
|---|---|---|
| `borrowed-crown-i` | 2 | Mud Monster (S1), Sweetykins (S2) |
| `borrowed-crown-ii` | 4 | The Slais (S3), Lady Worthington (S4) |
| `borrowed-crown-iii` | 6 | Mr. Nibbles (S5), Mirror Master (S6) |
| `borrowed-crown-iv` | 8 | King Inkbeard (S7), Lodicrust (S8) |
| `borrowed-crown-v` | 10 | Origami Master (S9), Tinkering Tom (S10) |

**Boss forms are stronger and shorter:** duration is halved (6s base) and the
cooldown doubled (12s). They should feel like a spent resource, not a stance.

Boss form attack mapping — light / heavy:

| Boss | Light | Heavy |
|---|---|---|
| Mud Monster | Mud swipe | Mud trail slam (drops `mud-trail` patches) |
| Sweetykins | Charge ram | Assault flurry |
| The Slais | Dash strike | Lunge (with the same recovery window, as a cost) |
| Lady Worthington | Ranged hex bolt | Wide hex spread |
| Mr. Nibbles | Bite | Frenzy bite |
| Mirror Master | Mirror bolt | Summon one shadow clone ally |
| King Inkbeard | Cutlass | Summon a tattoo rat ally |
| Lodicrust | Sweeping claw | Portal pull (drags enemies toward him) |
| Origami Master | Paper storm | Fold dragon breath cone |
| Tinkering Tom | Wrench swing | Hydraulic press slam |

---

## 5. Upgrade pool

Drop into `CHARACTER_UPGRADES['shapeshifter-pc']`, same object shape as the
existing entries (`{ id, name, tag, description }`, plus optional `requiresLevel`
and `repeatable`).

```js
'shapeshifter-pc': [
  // --- Attack ---
  { id: 'borrowed-instinct', name: 'Borrowed Instinct', tag: 'Attack', description: 'Attacks in an enemy form deal 15% more damage.' },
  { id: 'muscle-memory', name: 'Muscle Memory', tag: 'Attack', description: 'Repeating a form you used this stage adds 10% damage, stacking to 30%.' },
  { id: 'stolen-reach', name: 'Stolen Reach', tag: 'Attack', description: 'Form attacks gain the longer of your reach and theirs.' },

  // --- Heavy ---
  { id: 'second-nature', name: 'Second Nature', tag: 'Heavy', description: 'Forms without a second attack borrow your Bone Rearrange as their heavy.' },
  { id: 'violent-transition', name: 'Violent Transition', tag: 'Heavy', description: 'Transforming deals damage in a small radius and knocks enemies back.' },

  // --- Special ---
  { id: 'quick-change', name: 'Quick Change', tag: 'Special', description: 'Transform cooldown reduced by 3 seconds.' },
  { id: 'deep-wardrobe', name: 'Deep Wardrobe', tag: 'Special', description: 'Transform duration increased by 4 seconds.' },
  { id: 'flesh-recall', name: 'Flesh Recall', tag: 'Special', description: 'Rifle the Skin can pick any of your three most recent kills.' },
  { id: 'clean-break', name: 'Clean Break', tag: 'Special', description: 'Ending a form early refunds half its remaining cooldown.' },

  // --- Super ---
  { id: 'legion-of-two', name: 'Legion of Two', tag: 'Super', description: 'Legion spawns a third copy.' },
  { id: 'lasting-legion', name: 'Lasting Legion', tag: 'Super', description: 'Legion copies last 5 seconds longer.' },
  { id: 'martyr-copies', name: 'Martyr Copies', tag: 'Super', description: 'Legion copies explode for area damage when they expire.' },

  // --- Utility ---
  { id: 'thick-hide', name: 'Thick Hide', tag: 'Utility', description: 'Take 12% less damage while transformed.' },
  { id: 'unremarkable', name: 'Unremarkable', tag: 'Utility', description: 'Enemies of your current form are 40% less likely to target you.' },
  { id: 'trophy-hunter', name: 'Trophy Hunter', tag: 'Utility', description: 'First time you defeat a new enemy type, immediately gain a transform charge.' },
  { id: 'shed-skin', name: 'Shed Skin', tag: 'Utility', description: 'When a form expires, cleanse all debuffs and gain 1s of invulnerability.' },

  // --- Boss forms ---
  { id: 'borrowed-crown-i',   name: 'Borrowed Crown I',   tag: 'Special', requiresLevel: 2,  description: 'Take the shape of the Mud Monster and Sweetykins, once defeated.' },
  { id: 'borrowed-crown-ii',  name: 'Borrowed Crown II',  tag: 'Special', requiresLevel: 4,  description: 'Take the shape of The Slais and Lady Worthington, once defeated.' },
  { id: 'borrowed-crown-iii', name: 'Borrowed Crown III', tag: 'Special', requiresLevel: 6,  description: 'Take the shape of Mr. Nibbles and the Mirror Master, once defeated.' },
  { id: 'borrowed-crown-iv',  name: 'Borrowed Crown IV',  tag: 'Special', requiresLevel: 8,  description: 'Take the shape of King Inkbeard and Lodicrust, once defeated.' },
  { id: 'borrowed-crown-v',   name: 'Borrowed Crown V',   tag: 'Special', requiresLevel: 10, description: 'Take the shape of the Origami Master and Tinkering Tom, once defeated.' }
]
```

---

## 6. Implementation notes

**Rendering.** Reuse the shadow-clone approach already added for Mirror Master
(`createShadowClone`): swap `animation.tracks` to the target's bundle and keep the
player entity otherwise intact. For enemy forms that is
`assets.enemyAnimations[type]`; the player keeps `charData` for HUD purposes, so
`getPlayerAnimTrack` needs a guard to prefer an active form's tracks.

Suggested: add `player.formTracks` and have the draw path use it when set.

**Attack wiring.** `performPlayerAttack` already branches on `characterId` for
special cases (`shunky-rooster`, ranged attackers, AoE attackers). Add an early
branch: if `player.activeForm`, resolve damage/range/VFX from a
`FORM_ATTACK_PROFILES[formType]` table rather than `getCharacterTuning`.

**Balance guardrail.** Form damage should be normalised, not raw — an enemy that
deals 9 to the player should not deal 9 as the player. Scale by
`player.attackPower` and a per-tier constant:

```js
const FORM_DAMAGE_SCALE = { small: 1.6, medium: 1.4, elite: 1.2, boss: 0.85 };
```

Boss forms sit below 1.0 deliberately — their value is their moveset and reach,
not their numbers.

**Audio.** Forms should use the form's `ENEMY_CHARACTER_SFX` entry for attack
sounds and the player's own for hit/killed, so damage feedback stays consistent.
Note three enemies currently borrow other enemies' audio (`bayouBriar`, `quakes`,
`shapeshifter`) — see the comments in `ENEMY_CHARACTER_SFX`.
