/* =====================================================================
   Cinderglass — contract integrity.

   A chamber that cannot be finished is worse than a missing chamber: the
   player has no way to tell which it is. Every contract here is replayed
   with its own recorded reference solve and has to actually hit its quota
   inside its shift and its fuel.
   ===================================================================== */
'use strict';

const { loadCG } = require('./cinderglass.harness');

const CG = loadCG(['core.js', 'materials.js', 'sim.js', 'levels.js']);
const L = CG.Levels;
const MAT = CG.Materials;

describe('contract definitions', () => {
  test('there is at least one contract and every id is unique', () => {
    expect(L.LIST.length).toBeGreaterThan(0);
    const ids = L.LIST.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test.each(L.LIST.map((s) => [s.id, s]))('%s is well formed', (_id, spec) => {
    expect(typeof spec.name).toBe('string');
    expect(spec.blurb.length).toBeGreaterThan(0);
    expect(spec.hint.length).toBeGreaterThan(0);
    expect(['deliver', 'create']).toContain(spec.goal.kind);
    expect(MAT.ID[spec.goal.material]).toBeDefined();
    expect(spec.goal.amount).toBeGreaterThan(0);
    expect(spec.fuel).toBeGreaterThan(0);
    expect(spec.parTicks).toBeGreaterThan(0);
    expect(spec.hardTicks).toBeGreaterThan(spec.parTicks);
    expect(Array.isArray(spec.solution)).toBe(true);
  });

  test.each(L.LIST.map((s) => [s.id, s]))(
    '%s only asks for material that can reach where it is scored', (_id, spec) => {
      /* A `deliver` quota is met by matter falling into the crucible, so a
         static material could never satisfy one. */
      const m = MAT.BY_ID[MAT.ID[spec.goal.material]];
      if (spec.goal.kind === 'deliver') expect(m.mobile).toBe(true);
    });

  test.each(L.LIST.map((s, i) => [s.id, i]))('%s builds a sealed chamber', (_id, index) => {
    const sim = L.build(index);
    /* The boundary must be indestructible so no solution can ever leak out
       of the world. It need not all be WALL: a crucible sunk into the floor
       takes over part of the bottom edge, and is equally permanent. */
    const sealed = (x, y) => {
      const m = sim.at(x, y);
      expect(MAT.isIndestructible[m]).toBe(1);
    };
    for (let x = 0; x < sim.W; x++) { sealed(x, 0); sealed(x, sim.H - 1); }
    for (let y = 0; y < sim.H; y++) { sealed(0, y); sealed(sim.W - 1, y); }
  });

  test.each(L.LIST.map((s, i) => [s.id, i]))('%s builds identically every time', (_id, index) => {
    const a = L.build(index), b = L.build(index);
    expect(Buffer.from(a.mat)).toEqual(Buffer.from(b.mat));
    expect(a.hash()).toBe(b.hash());
  });

  test.each(L.LIST.map((s, i) => [s.id, i]))(
    '%s does not complete itself if the player does nothing', (_id, index) => {
      const sim = L.build(index);
      const spec = sim.spec;
      sim.steps(Math.min(spec.parTicks, 1500));
      expect(L.isComplete(sim, spec)).toBe(false);
    });
});

describe('solvability', () => {
  test.each(L.LIST.map((s, i) => [s.id, i]))(
    '%s is completed by its reference solve, inside the shift and the fuel', (_id, index) => {
      const sim = L.build(index);
      const spec = sim.spec;
      const solvedAt = L.replay(sim, spec, spec.solution);

      expect(solvedAt).toBeGreaterThanOrEqual(0);
      expect(solvedAt).toBeLessThan(spec.hardTicks);
      expect(sim.fuelUsed).toBeLessThanOrEqual(spec.fuel + 1);
    });

  test.each(L.LIST.map((s, i) => [s.id, i]))('%s replays deterministically', (_id, index) => {
    function run() {
      const sim = L.build(index);
      L.replay(sim, sim.spec, sim.spec.solution, 900);
      return sim.hash();
    }
    expect(run()).toBe(run());
  });
});
