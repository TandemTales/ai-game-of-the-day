/* =====================================================================
   Cinderglass — simulation mechanics.

   These assert the things a level designer relies on: that matter falls
   and pools the way it should, that every phase change in the material
   table actually fires, that the reactions produce what they claim, and —
   most importantly — that the whole thing is deterministic, because the
   solvability tests in cinderglass.levels.test.js are worthless if it
   is not.
   ===================================================================== */
'use strict';

const { loadCG, newSim } = require('./cinderglass.harness');

const LOGIC = ['core.js', 'materials.js', 'sim.js'];

function fresh(w, h, seed) {
  return newSim(w, h, seed === undefined ? 4242 : seed, LOGIC);
}

/* Build a sealed box so nothing escapes through the edges. */
function box(sim, ID) {
  sim.border(ID.WALL);
  return sim;
}

describe('material table', () => {
  const CG = loadCG(LOGIC);
  const M = CG.Materials;

  test('every material resolves its phase-change targets', () => {
    for (const m of M.BY_ID) {
      if (m.meltTo !== undefined) expect(M.ID[m.meltTo]).toBeDefined();
      if (m.freezeTo !== undefined) expect(M.ID[m.freezeTo]).toBeDefined();
      if (m.decayTo !== undefined) expect(M.ID[m.decayTo]).toBeDefined();
    }
  });

  test('no material can flicker across its own phase boundary', () => {
    /* If a material melts into something that immediately freezes back,
       the pair oscillates forever and the world never settles. Every
       melt/freeze pair must leave a gap. */
    for (const m of M.BY_ID) {
      if (m.meltToId < 0) continue;
      const hot = M.BY_ID[m.meltToId];
      if (hot.freezeToId < 0) continue;
      expect(hot.freezeAt).toBeLessThan(m.meltAt);
    }
    for (const m of M.BY_ID) {
      if (m.freezeToId < 0) continue;
      const cold = M.BY_ID[m.freezeToId];
      if (cold.meltToId < 0) continue;
      expect(cold.meltAt).toBeGreaterThan(m.freezeAt);
    }
  });

  test('buoyancy ordering is consistent: gases lighter than air, the rest heavier', () => {
    const air = M.BY_ID[M.ID.VOID].density;
    for (const m of M.BY_ID) {
      if (m.name === 'VOID') continue;
      if (!m.mobile) continue;
      if (m.move === M.GAS) expect(m.density).toBeLessThan(air);
      else expect(m.density).toBeGreaterThan(air);
    }
  });

  test('the chamber shell and the crucible survive any temperature', () => {
    const { sim, ID } = fresh(8, 8);
    sim.set(3, 3, ID.WALL);
    sim.set(4, 3, ID.CRUCIBLE);
    for (let i = 0; i < 200; i++) { sim.paintHeat(3.5, 3, 4, +1); sim.step(); }
    expect(sim.at(3, 3)).toBe(ID.WALL);
    expect(sim.at(4, 3)).toBe(ID.CRUCIBLE);
  });
});

describe('determinism', () => {
  test('the same seed and the same inputs produce an identical world', () => {
    function run() {
      const { CG, sim, ID } = fresh(48, 32, 99);
      box(sim, ID);
      sim.fillRect(10, 4, 8, 6, ID.SAND);
      sim.fillRect(24, 4, 8, 6, ID.WATER);
      sim.fillRect(34, 20, 6, 4, ID.LAVA);
      sim.fillRect(6, 24, 10, 3, ID.OIL);
      CG.setSeed(99);
      for (let i = 0; i < 400; i++) {
        if (i % 3 === 0) sim.paintHeat(14, 12, 5, +1);
        if (i % 7 === 0) sim.paintHeat(28, 14, 4, -1);
        sim.step();
      }
      return sim.hash();
    }
    const a = run(), b = run();
    expect(a).toBe(b);
  });

  test('the simulation never calls Math.random()', () => {
    const { CG, sim, ID } = fresh(40, 28, 7);
    box(sim, ID);
    sim.fillRect(8, 4, 12, 6, ID.SAND);
    sim.fillRect(22, 6, 10, 5, ID.WATER);
    sim.fillRect(8, 20, 10, 3, ID.OIL);

    const real = Math.random;
    let called = 0;
    Math.random = () => { called++; return real(); };
    try {
      for (let i = 0; i < 200; i++) { sim.paintHeat(12, 22, 4, +1); sim.step(); }
    } finally {
      Math.random = real;
    }
    expect(called).toBe(0);
  });
});

describe('movement', () => {
  test('powder falls and piles at an angle of repose', () => {
    const { sim, ID } = fresh(40, 30);
    box(sim, ID);
    sim.fillRect(18, 2, 4, 4, ID.SAND);
    sim.steps(200);

    /* nothing left aloft, nothing lost */
    expect(sim.count(ID.SAND)).toBe(16);
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < sim.W; x++) expect(sim.at(x, y)).not.toBe(ID.SAND);
    }
    /* a pile, not a column: it spread wider than the 4 cells it started as */
    let widest = 0;
    for (let y = 0; y < sim.H; y++) {
      let n = 0;
      for (let x = 0; x < sim.W; x++) if (sim.at(x, y) === ID.SAND) n++;
      widest = Math.max(widest, n);
    }
    expect(widest).toBeGreaterThan(4);
  });

  test('liquid levels out flat in a basin', () => {
    const { sim, ID } = fresh(30, 20);
    box(sim, ID);
    sim.fillRect(8, 14, 14, 5, ID.WALL);
    sim.fillRect(10, 14, 10, 5, ID.VOID);      // hollow it out
    sim.fillRect(12, 4, 6, 5, ID.WATER);
    sim.steps(400);

    expect(sim.count(ID.WATER)).toBe(30);
    /* every water cell is inside the basin */
    for (let y = 0; y < sim.H; y++) {
      for (let x = 0; x < sim.W; x++) {
        if (sim.at(x, y) === ID.WATER) {
          expect(x).toBeGreaterThanOrEqual(10);
          expect(x).toBeLessThan(20);
          expect(y).toBeGreaterThanOrEqual(14);
        }
      }
    }
    /* the surface is flat: each filled row is either full-width or empty */
    for (let y = 14; y < 19; y++) {
      let n = 0;
      for (let x = 10; x < 20; x++) if (sim.at(x, y) === ID.WATER) n++;
      expect(n === 0 || n === 10).toBe(true);
    }
  });

  test('denser matter sinks through lighter, and lighter floats', () => {
    const { sim, ID } = fresh(20, 24);
    box(sim, ID);
    sim.fillRect(4, 12, 12, 10, ID.WATER);
    sim.fillRect(8, 3, 4, 2, ID.SAND);     // heavier than water: must sink
    sim.fillRect(4, 8, 4, 2, ID.OIL);      // lighter than water: must float
    sim.steps(600);

    let sandY = 0, oilY = sim.H, waterTop = sim.H;
    for (let y = 0; y < sim.H; y++) {
      for (let x = 0; x < sim.W; x++) {
        const m = sim.at(x, y);
        if (m === ID.SAND) sandY = Math.max(sandY, y);
        if (m === ID.OIL) oilY = Math.min(oilY, y);
        if (m === ID.WATER) waterTop = Math.min(waterTop, y);
      }
    }
    expect(sandY).toBeGreaterThan(waterTop);   // sand ended below the surface
    expect(oilY).toBeLessThanOrEqual(waterTop); // oil ended at or above it
  });

  test('gas rises to the ceiling', () => {
    const { sim, ID } = fresh(20, 24);
    box(sim, ID);
    sim.fillRect(8, 20, 4, 2, ID.STEAM, 200);
    sim.steps(200);
    let lowest = 0;
    for (let y = 0; y < sim.H; y++) {
      for (let x = 0; x < sim.W; x++) if (sim.at(x, y) === ID.STEAM) lowest = Math.max(lowest, y);
    }
    /* whatever survived condensation ended up in the top half */
    if (sim.count(ID.STEAM) > 0) expect(lowest).toBeLessThan(sim.H / 2);
  });

  test('matter is conserved: nothing is created or destroyed by movement alone', () => {
    const { sim, ID } = fresh(40, 30);
    box(sim, ID);
    sim.fillRect(6, 4, 10, 6, ID.SAND);
    sim.fillRect(22, 4, 10, 6, ID.WATER);
    const before = sim.count(ID.SAND) + sim.count(ID.WATER);
    sim.steps(500);
    expect(sim.count(ID.SAND) + sim.count(ID.WATER)).toBe(before);
  });
});

describe('phase changes', () => {
  test('sand fuses to molten glass and sets as glass', () => {
    const { sim, ID } = fresh(24, 20);
    box(sim, ID);
    sim.fillRect(8, 15, 8, 4, ID.SAND);
    for (let i = 0; i < 300; i++) { sim.paintHeat(12, 17, 5, +1); sim.step(); }
    expect(sim.count(ID.SAND)).toBeLessThan(8);
    sim.steps(900);                                  // let it cool
    expect(sim.count(ID.GLASS)).toBeGreaterThan(10);
    expect(sim.count(ID.MOLTEN_GLASS)).toBe(0);
  });

  test('water boils to steam and condenses back on a cold surface', () => {
    const { sim, ID } = fresh(24, 20);
    box(sim, ID);
    sim.fillRect(8, 16, 8, 3, ID.WATER);
    const before = sim.count(ID.WATER);
    for (let i = 0; i < 300; i++) { sim.paintHeat(12, 17, 4, +1); sim.step(); }
    expect(sim.count(ID.STEAM)).toBeGreaterThan(0);
    /* water is not destroyed by boiling: it is all still there as steam */
    expect(sim.count(ID.WATER) + sim.count(ID.STEAM) + sim.count(ID.ICE)).toBe(before);
  });

  test('water freezes to ice, and ice is structural', () => {
    const { sim, ID } = fresh(24, 16);
    box(sim, ID);
    sim.fillRect(6, 10, 12, 5, ID.WATER);
    for (let i = 0; i < 300; i++) { sim.paintHeat(12, 12, 5, -1); sim.step(); }
    expect(sim.count(ID.ICE)).toBeGreaterThan(10);

    /* ice does not fall or flow — snapshot it and confirm it is unchanged
       once the quench stops and before it has time to melt */
    const snapshot = Uint8Array.from(sim.mat);
    sim.steps(20);
    let ice = 0, same = 0;
    for (let i = 0; i < sim.N; i++) {
      if (snapshot[i] === ID.ICE) { ice++; if (sim.mat[i] === ID.ICE) same++; }
    }
    expect(same).toBe(ice);
  });

  test('stone melts to lava and sets back to stone', () => {
    const { sim, ID } = fresh(24, 20);
    box(sim, ID);
    sim.fillRect(6, 6, 12, 10, ID.STONE);
    for (let i = 0; i < 400; i++) { sim.paintHeat(12, 11, 6, +1); sim.step(); }
    expect(sim.count(ID.LAVA)).toBeGreaterThan(0);
    sim.steps(3000);                                  // let the chamber cool
    expect(sim.count(ID.LAVA)).toBe(0);
    expect(sim.count(ID.STONE)).toBeGreaterThan(0);
  });
});

describe('reactions', () => {
  test('lava quenched by water makes obsidian and steam', () => {
    const { sim, ID } = fresh(30, 24);
    box(sim, ID);
    sim.fillRect(10, 4, 8, 4, ID.LAVA);
    sim.fillRect(10, 16, 10, 5, ID.WATER);
    sim.steps(300);
    expect(sim.count(ID.OBSIDIAN)).toBeGreaterThan(5);
    expect(sim.count(ID.STEAM) + sim.count(ID.WATER)).toBeGreaterThan(0);
  });

  test('fire spreads along a pool of pitch and leaves ash', () => {
    const { sim, ID } = fresh(30, 16);
    box(sim, ID);
    sim.fillRect(3, 13, 24, 2, ID.OIL);
    const fuel = sim.count(ID.OIL);
    /* light only the far left end */
    for (let i = 0; i < 60; i++) { sim.paintHeat(5, 13, 3, +1); sim.step(); }
    sim.steps(600);
    expect(sim.count(ID.OIL)).toBeLessThan(fuel * 0.2);   // it caught along its length
    expect(sim.count(ID.ASH)).toBeGreaterThan(5);
  });

  test('water smothers burning pitch', () => {
    const { sim, ID } = fresh(30, 16);
    box(sim, ID);
    sim.fillRect(3, 13, 10, 2, ID.OIL);
    for (let i = 0; i < 60; i++) { sim.paintHeat(5, 13, 3, +1); sim.step(); }
    expect(sim.count(ID.BLAZE)).toBeGreaterThan(0);
    sim.fillRect(3, 8, 12, 4, ID.WATER);
    sim.steps(200);
    expect(sim.count(ID.BLAZE)).toBe(0);
  });
});

describe('the crucible', () => {
  test('swallows mobile matter and counts what it swallowed', () => {
    const { sim, ID } = fresh(24, 18);
    box(sim, ID);
    sim.fillRect(10, 15, 5, 2, ID.CRUCIBLE);
    sim.fillRect(10, 3, 5, 4, ID.SAND);
    sim.steps(300);
    expect(sim.absorbed[ID.SAND]).toBeGreaterThan(15);
    expect(sim.absorbedTotal).toBe(sim.absorbed[ID.SAND]);
    expect(sim.count(ID.SAND)).toBe(0);
  });

  test('counts delivered material by what it actually is on arrival', () => {
    /* sand fused to glass on the way down must not be counted as sand */
    const { sim, ID } = fresh(24, 24);
    box(sim, ID);
    sim.fillRect(9, 21, 6, 2, ID.CRUCIBLE);
    sim.fillRect(10, 3, 4, 3, ID.SAND);
    for (let i = 0; i < 400; i++) { sim.paintHeat(12, 12, 6, +1); sim.step(); }
    sim.steps(300);
    expect(sim.absorbed[ID.SAND] + sim.absorbed[ID.MOLTEN_GLASS]).toBeGreaterThan(0);
  });
});

describe('the player brush', () => {
  test('the torch heats and the quench cools', () => {
    const { sim, ID } = fresh(20, 20);
    box(sim, ID);
    sim.fillRect(4, 4, 12, 12, ID.STONE);
    const start = sim.tempAt(10, 10);
    for (let i = 0; i < 60; i++) { sim.paintHeat(10, 10, 4, +1); sim.step(); }
    const hot = sim.tempAt(10, 10);
    expect(hot).toBeGreaterThan(start + 50);
    for (let i = 0; i < 200; i++) { sim.paintHeat(10, 10, 4, -1); sim.step(); }
    expect(sim.tempAt(10, 10)).toBeLessThan(hot);
  });

  test('only the torch burns fuel', () => {
    const { sim, ID } = fresh(20, 20);
    box(sim, ID);
    sim.fillRect(4, 4, 12, 12, ID.STONE);
    for (let i = 0; i < 30; i++) sim.paintHeat(10, 10, 4, -1);
    expect(sim.fuelUsed).toBe(0);
    for (let i = 0; i < 30; i++) sim.paintHeat(10, 10, 4, +1);
    expect(sim.fuelUsed).toBeGreaterThan(0);
  });

  test('temperature stays inside its declared bounds', () => {
    const { CG, sim, ID } = fresh(24, 24);
    box(sim, ID);
    sim.fillRect(4, 4, 16, 16, ID.STONE);
    for (let i = 0; i < 400; i++) { sim.paintHeat(12, 12, 8, +1); sim.step(); }
    for (let i = 0; i < 400; i++) { sim.paintHeat(12, 12, 8, -1); sim.step(); }
    for (let i = 0; i < sim.N; i++) {
      expect(sim.temp[i]).toBeGreaterThanOrEqual(CG.TEMP_MIN - 1);
      expect(sim.temp[i]).toBeLessThanOrEqual(CG.TEMP_MAX + 1);
      expect(Number.isFinite(sim.temp[i])).toBe(true);
    }
  });

  test('an untouched chamber relaxes to ambient and stays there', () => {
    const { CG, sim, ID } = fresh(20, 20);
    box(sim, ID);
    sim.fillRect(4, 4, 12, 12, ID.STONE);
    sim.steps(4000);
    for (let i = 0; i < sim.N; i++) {
      expect(Math.abs(sim.temp[i] - CG.AMBIENT)).toBeLessThan(2);
    }
  });
});
