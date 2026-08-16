/* =====================================================================
   Paradox Vault — DESIGN invariants.

   The existing solvability test (paradox-vault.test.js) flood-fills the
   terrain and proves a path exists to every relic and to the exit. That
   check treats door tiles as walkable, because doors sit on floor
   terrain — so it proves "solvable IF every door is open", never that
   the doors can actually be opened, and it says nothing about whether
   the game's signature mechanic is needed at all.

   This suite asks the design questions instead.

   DEVICE MODEL (from SPEC §8 rule 4, and it matters):
     * `plate`    — signal is high only while an actor stands on it.
     * `terminal` — needs continuous standing adjacent.
       Both of the above therefore PIN AN ACTOR DOWN. Needing N of them
       high at the same moment costs N echoes, because the player is one
       actor and each echo is another, and somebody still has to be free
       to carry the relic.
     * `lever`    — toggles on interact and LATCHES. Costs no actor.
     * `receiver` — latches when a beam lands on it (route it with a
       pushable mirror). Costs no actor.

   So the echo cost of a vault is the minimum number of *held* signals
   that must be high simultaneously, searched over every reachable
   configuration of the latching ones.

   Not every vault is gated by doors: vault 4 is a pure laser-timing
   corridor and vault 6 is gated by a sentry's vision cone. Topological
   reachability cannot see those, so "is this vault gated at all" is
   asked as gated-by-signals OR gated-by-hazards, never by doors alone.
   ===================================================================== */
'use strict';

const { loadPV } = require('./paradox-vault.harness');

const { PV } = loadPV();
const CAMPAIGN = 10; // hand-authored vaults, before the endless remix

const HELD_TYPES = ['plate', 'terminal'];   // pin an actor down
const LATCH_TYPES = ['lever', 'receiver'];  // set once, stay set

/* ------------------------------------------------------------------
   Signal inventory
   ------------------------------------------------------------------ */
function devicesOf(vault, types) {
  return vault.objects.filter((o) => types.indexOf(o.t) !== -1 && o.sig);
}
function heldSignals(vault) {
  return [...new Set(devicesOf(vault, HELD_TYPES).map((o) => o.sig))];
}
function latchSignals(vault) {
  return [...new Set(devicesOf(vault, LATCH_TYPES).map((o) => o.sig))];
}
/** Bare identifiers appearing in a door's signal expression. */
function identsIn(expr) {
  return [...new Set(String(expr || '').match(/[A-Za-z_][A-Za-z0-9_]*/g) || [])];
}

/* ------------------------------------------------------------------
   Reachability with an explicit signal state.
   Unlike the harness `reachable`, a door tile is solid unless its
   expression evaluates true.
   ------------------------------------------------------------------ */
function reachableWithSignals(vault, signals) {
  const w = vault.w, h = vault.h;

  const doorExpr = new Map();
  for (const o of vault.objects) {
    if (o.t !== 'door') continue;
    const span = o.span || 1;
    for (let i = 0; i < span; i++) {
      const x = o.axis === 'h' ? o.x + i : o.x;
      const y = o.axis === 'h' ? o.y : o.y + i;
      doorExpr.set(y * w + x, o.sig);
    }
  }

  const blocked = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    if (vault.grid[y * w + x].solid) return true;
    const e = doorExpr.get(y * w + x);
    if (e === undefined) return false;
    return !PV.Levels.evalSignal(e, signals); // a shut door is solid
  };

  const seen = new Uint8Array(w * h);
  const sx = Math.floor(vault.spawn.x), sy = Math.floor(vault.spawn.y);
  if (blocked(sx, sy)) return seen;
  seen[sy * w + sx] = 1;
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (blocked(nx, ny)) continue;
      const i = ny * w + nx;
      if (seen[i]) continue;
      seen[i] = 1;
      q.push([nx, ny]);
    }
  }
  return seen;
}

const at = (seen, vault, fx, fy) => !!seen[Math.floor(fy) * vault.w + Math.floor(fx)];

/**
 * Everything a run needs must be reachable. Relics and the exit do not
 * have to be open at the SAME time — the loop lets you bank one relic,
 * rewind, and fetch the next — so each is checked against the state
 * independently and the union is what matters.
 */
function reachTargets(vault, signals) {
  const seen = reachableWithSignals(vault, signals);
  const got = { relics: new Set(), exit: false };
  vault.objects.forEach((o, i) => {
    if (o.t === 'relic' && at(seen, vault, o.x, o.y)) got.relics.add(i);
    if (o.t === 'exit' && at(seen, vault, o.x + (o.w || 1) / 2, o.y + (o.h || 1) / 2)) got.exit = true;
  });
  return got;
}

function allRelicIdx(vault) {
  const s = new Set();
  vault.objects.forEach((o, i) => { if (o.t === 'relic') s.add(i); });
  return s;
}

/** Every subset of `arr`, as arrays. */
function subsets(arr) {
  const out = [];
  for (let m = 0; m < (1 << arr.length); m++) {
    const s = [];
    for (let i = 0; i < arr.length; i++) if (m & (1 << i)) s.push(arr[i]);
    out.push(s);
  }
  return out;
}

/**
 * Minimum simultaneous HELD signals to clear the vault, searched over
 * every latch configuration. Returns a number, or null if no
 * configuration reaches every relic and the exit.
 */
function echoCost(vault) {
  const held = heldSignals(vault);
  const latch = latchSignals(vault);
  const wantRelics = allRelicIdx(vault);
  let best = null;

  for (const latchOn of subsets(latch)) {
    // Collect what this latch config can reach across held configs,
    // tracking the largest number of held signals any single state needs.
    for (const heldOn of subsets(held)) {
      const signals = {};
      latchOn.forEach((s) => { signals[s] = true; });
      heldOn.forEach((s) => { signals[s] = true; });
      const got = reachTargets(vault, signals);

      // A single state that reaches every relic and the exit.
      const complete = got.exit && [...wantRelics].every((i) => got.relics.has(i));
      if (complete && (best === null || heldOn.length < best)) best = heldOn.length;
    }
  }

  if (best !== null) return best;

  // No single state does it all. Allow the loop to be used across states:
  // union the reachable targets over states, costing the worst state.
  for (const latchOn of subsets(latch)) {
    const union = { relics: new Set(), exit: false };
    let worst = 0;
    for (const heldOn of subsets(held)) {
      const signals = {};
      latchOn.forEach((s) => { signals[s] = true; });
      heldOn.forEach((s) => { signals[s] = true; });
      const got = reachTargets(vault, signals);
      const adds = [...got.relics].some((i) => !union.relics.has(i)) || (got.exit && !union.exit);
      if (adds) {
        got.relics.forEach((i) => union.relics.add(i));
        if (got.exit) union.exit = true;
        worst = Math.max(worst, heldOn.length);
      }
    }
    if (union.exit && [...wantRelics].every((i) => union.relics.has(i))) {
      if (best === null || worst < best) best = worst;
    }
  }
  return best;
}

function hasHazard(vault) {
  return vault.objects.some((o) => o.t === 'laser' || o.t === 'sentry');
}

const vaults = [];
for (let i = 0; i < CAMPAIGN; i++) vaults.push(PV.Levels.get(i));

/* ================================================================== */

describe('design: every door can actually be opened', () => {
  test.each(vaults.map((v, i) => [i + 1, v]))(
    'vault %i — every signal a door references is produced by some device',
    (_n, vault) => {
      const produced = new Set([...heldSignals(vault), ...latchSignals(vault)]);
      for (const o of vault.objects) {
        if (o.t !== 'door') continue;
        for (const id of identsIn(o.sig)) {
          // A door wired to a signal nothing produces can never open —
          // exactly the class of authoring bug that sealed vault 5's
          // mask relic away in an earlier build.
          expect(produced.has(id)).toBe(true);
        }
      }
    }
  );

  test.each(vaults.map((v, i) => [i + 1, v]))('vault %i — doors sit on floor, never on wall terrain', (_n, vault) => {
    // solidAt() checks terrain BEFORE door state, so a door authored on
    // a '#' tile can never open no matter what its signal does.
    for (const o of vault.objects) {
      if (o.t !== 'door') continue;
      const span = o.span || 1;
      for (let i = 0; i < span; i++) {
        const x = o.axis === 'h' ? o.x + i : o.x;
        const y = o.axis === 'h' ? o.y : o.y + i;
        expect(vault.grid[y * vault.w + x].solid).toBeFalsy();
      }
    }
  });
});

describe('design: every vault is clearable, and within its echo budget', () => {
  test.each(vaults.map((v, i) => [i + 1, v]))('vault %i', (_n, vault) => {
    const cost = echoCost(vault);
    expect(cost).not.toBeNull();          // some configuration clears it
    expect(cost).toBeLessThanOrEqual(vault.echoes);
  });
});

describe('design: the time loop is load-bearing', () => {
  test('vault 1 is the tutorial — deliberately ungated', () => {
    expect(echoCost(vaults[0])).toBe(0);
    expect(hasHazard(vaults[0])).toBe(false);
  });

  test.each(vaults.slice(1).map((v, i) => [i + 2, v]))(
    'vault %i is gated by something — held signals or a hazard',
    (_n, vault) => {
      // A vault you can stroll through with no device actuated and
      // nothing to dodge has a decorative rewind button.
      const gated = echoCost(vault) > 0 || hasHazard(vault);
      expect(gated).toBe(true);
    }
  );

  test('at least half the campaign needs an echo held, not just hazard dodging', () => {
    // If almost every vault were a timing corridor, the time-loop hook
    // would be doing far less work than the pitch claims.
    const needEcho = vaults.filter((v) => echoCost(v) > 0).length;
    expect(needEcho).toBeGreaterThanOrEqual(Math.ceil(CAMPAIGN / 2));
  });
});

describe('design: the campaign ramps', () => {
  test('the back half is at least as demanding as the front half', () => {
    const cost = vaults.map(echoCost);
    const front = cost.slice(0, 5).reduce((a, b) => a + b, 0);
    const back = cost.slice(5).reduce((a, b) => a + b, 0);
    expect(back).toBeGreaterThanOrEqual(front);
  });

  test('echo budget never shrinks as the campaign goes on', () => {
    for (let i = 1; i < CAMPAIGN; i++) {
      expect(vaults[i].echoes).toBeGreaterThanOrEqual(vaults[i - 1].echoes);
    }
  });

  test('the score multiplier grows with depth', () => {
    for (let i = 1; i < CAMPAIGN; i++) {
      expect(PV.Levels.multiplier(i)).toBeGreaterThan(PV.Levels.multiplier(i - 1));
    }
  });

  test('every vault has a name, an objective and a hint for the brief screen', () => {
    for (const v of vaults) {
      expect(v.name.length).toBeGreaterThan(0);
      expect(v.objective.length).toBeGreaterThan(10);
      expect(typeof v.hint).toBe('string');
      expect(v.hint.length).toBeGreaterThan(10);
    }
  });
});

describe('design: the endless remix stays playable', () => {
  test('remixed vaults keep enough echoes for their own locks', () => {
    for (let i = CAMPAIGN; i < CAMPAIGN + 12; i++) {
      const v = PV.Levels.get(i);
      const cost = echoCost(v);
      expect(cost).not.toBeNull();
      expect(cost).toBeLessThanOrEqual(v.echoes);
      expect(v.loopSeconds).toBeGreaterThanOrEqual(14);
      expect(v.echoes).toBeGreaterThanOrEqual(2);
    }
  });
});

/* Printed for a human to judge feel; the assertion is trivial. */
describe('design: profile', () => {
  test('campaign difficulty profile', () => {
    const rows = vaults.map((v, i) => {
      const cost = echoCost(v);
      return `  ${String(i + 1).padStart(2)}  ${v.name.padEnd(20)} ` +
        `relics:${v.relicCount} echoes:${v.echoes} loop:${v.loopSeconds}s ` +
        `echoCost:${cost === null ? 'UNCLEARABLE' : cost} ` +
        `${hasHazard(v) ? 'hazards' : '       '} ` +
        `slack:${cost === null ? '-' : v.echoes - cost}`;
    });
    // eslint-disable-next-line no-console
    console.log('\nParadox Vault — campaign profile\n' + rows.join('\n') + '\n');
    expect(rows.length).toBe(CAMPAIGN);
  });
});
