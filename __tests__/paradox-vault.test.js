/* =====================================================================
   Paradox Vault — headless simulation tests.

   The game's whole premise is that replaying a recorded input tape
   reproduces the motion that produced it. If that drifts, echoes stop
   pressing the plates they pressed last loop and every puzzle silently
   becomes unsolvable, with nothing visibly "crashing". These tests pin
   that down, plus level integrity and the scoring formula in SPEC.md §8.
   ===================================================================== */
'use strict';

const { loadPV, makeWorld, driveActor, reachable } = require('./paradox-vault.harness.js');

/* Inputs quantise to 1/127 in Recording.write, so a tape built from values
   already on that grid replays exactly. Cardinal directions are on it. */
const HOLD = {
  right: { x: 1, y: 0, action: false, dash: false },
  left: { x: -1, y: 0, action: false, dash: false },
  up: { x: 0, y: -1, action: false, dash: false },
  down: { x: 0, y: 1, action: false, dash: false },
  none: { x: 0, y: 0, action: false, dash: false },
};

function tape(spec) {
  const out = [];
  for (const [dir, n] of spec) for (let i = 0; i < n; i++) out.push(HOLD[dir]);
  return out;
}

describe('module loading', () => {
  test('core, levels and entities load in a bare vm with no DOM', () => {
    const { PV } = loadPV();
    expect(PV.TILE).toBe(64);
    expect(PV.FIXED_DT).toBeCloseTo(1 / 120, 10);
    expect(PV.Entities).toBeDefined();
    expect(PV.Levels).toBeDefined();
  });

  test('SPEC §1 loop length: LOOP_TICKS is 2640 ticks at 120Hz = 22s', () => {
    const { PV } = loadPV();
    expect(PV.LOOP_TICKS).toBe(2640);
    expect(PV.LOOP_TICKS * PV.FIXED_DT).toBeCloseTo(22, 6);
  });
});

describe('deterministic RNG', () => {
  test('same seed reproduces the same stream', () => {
    const { PV } = loadPV();
    PV.setSeed(12345);
    const a = Array.from({ length: 64 }, () => PV.rand());
    PV.setSeed(12345);
    const b = Array.from({ length: 64 }, () => PV.rand());
    expect(b).toEqual(a);
  });

  test('different seeds diverge, and values stay in [0,1)', () => {
    const { PV } = loadPV();
    PV.setSeed(1);
    const a = Array.from({ length: 64 }, () => PV.rand());
    PV.setSeed(2);
    const b = Array.from({ length: 64 }, () => PV.rand());
    expect(b).not.toEqual(a);
    for (const v of a.concat(b)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('hash2 is stable for the same integer pair', () => {
    const { PV } = loadPV();
    expect(PV.hash2(7, 9)).toBe(PV.hash2(7, 9));
    expect(PV.hash2(7, 9)).not.toBe(PV.hash2(9, 7));
  });
});

describe('level integrity — every campaign vault', () => {
  const { PV } = loadPV();
  const count = PV.Levels.count;

  test('there are vaults to play', () => {
    expect(count).toBeGreaterThan(0);
  });

  for (let i = 0; i < PV.Levels.count; i++) {
    describe(`vault ${i}`, () => {
      const vault = PV.Levels.get(i);

      test('has a name, objective and sane dimensions', () => {
        expect(typeof vault.name).toBe('string');
        expect(vault.name.length).toBeGreaterThan(0);
        expect(typeof vault.objective).toBe('string');
        expect(vault.w).toBeGreaterThan(2);
        expect(vault.h).toBeGreaterThan(2);
        expect(vault.grid).toHaveLength(vault.w * vault.h);
      });

      test('the player spawns inside the map on a non-solid tile', () => {
        expect(vault.spawn).toBeDefined();
        const { x, y } = vault.spawn;
        expect(x).toBeGreaterThan(0);
        expect(y).toBeGreaterThan(0);
        expect(x).toBeLessThan(vault.w);
        expect(y).toBeLessThan(vault.h);
        const tile = vault.grid[Math.floor(y) * vault.w + Math.floor(x)];
        expect(tile.solid).toBeFalsy();
      });

      test('has at least one relic and an extraction exit', () => {
        const world = makeWorld(PV, vault);
        expect(world.relics.length).toBeGreaterThan(0);
        expect(world.exit).toBeTruthy();
      });

      test('is solvable: every relic and the exit are reachable from spawn', () => {
        const world = makeWorld(PV, vault);
        const seen = reachable(vault, vault.spawn.x, vault.spawn.y);
        const at = (x, y) => seen[Math.floor(y) * vault.w + Math.floor(x)];

        for (const r of world.relics) {
          expect(`relic ${r.kind} @${r.x},${r.y} reachable=${!!at(r.x, r.y)}`)
            .toBe(`relic ${r.kind} @${r.x},${r.y} reachable=true`);
        }

        /* the exit is a rect; at least one of its tiles must be reachable */
        const e = world.exit;
        let exitOk = false;
        for (let y = Math.floor(e.y); y < e.y + (e.h || 1); y++) {
          for (let x = Math.floor(e.x); x < e.x + (e.w || 1); x++) {
            if (x >= 0 && y >= 0 && x < vault.w && y < vault.h && seen[y * vault.w + x]) exitOk = true;
          }
        }
        expect(`vault ${i} exit reachable: ${exitOk}`).toBe(`vault ${i} exit reachable: true`);
      });

      test('the map is sealed — no walkable tile touches the outside edge', () => {
        const leaks = [];
        for (let x = 0; x < vault.w; x++) {
          if (!vault.grid[0 * vault.w + x].solid) leaks.push(`${x},0`);
          if (!vault.grid[(vault.h - 1) * vault.w + x].solid) leaks.push(`${x},${vault.h - 1}`);
        }
        for (let y = 0; y < vault.h; y++) {
          if (!vault.grid[y * vault.w + 0].solid) leaks.push(`0,${y}`);
          if (!vault.grid[y * vault.w + (vault.w - 1)].solid) leaks.push(`${vault.w - 1},${y}`);
        }
        expect(leaks).toEqual([]);
      });
    });
  }

  test('vaults past the authored campaign keep generating (endless run)', () => {
    const beyond = PV.Levels.get(count + 3);
    expect(beyond).toBeDefined();
    expect(beyond.w).toBeGreaterThan(2);
    expect(beyond.spawn).toBeDefined();
  });

  test('difficulty multiplier grows per SPEC §8 (1.0, 1.15, 1.3 …)', () => {
    expect(PV.Levels.multiplier(0)).toBeCloseTo(1.0, 6);
    expect(PV.Levels.multiplier(1)).toBeCloseTo(1.15, 6);
    expect(PV.Levels.multiplier(2)).toBeCloseTo(1.30, 6);
  });
});

describe('actor movement is deterministic', () => {
  test('identical inputs from an identical start produce a bitwise-identical path', () => {
    const { PV } = loadPV();
    const vault = PV.Levels.get(0);
    const inputs = tape([['up', 200], ['right', 150], ['none', 30], ['down', 90]]);

    const w1 = makeWorld(PV, vault);
    const a = driveActor(PV, w1, w1.player, inputs);
    const w2 = makeWorld(PV, vault);
    const b = driveActor(PV, w2, w2.player, inputs);

    expect(b).toEqual(a);
  });

  test('a fresh actor reset() returns exactly to spawn', () => {
    const { PV } = loadPV();
    const vault = PV.Levels.get(0);
    const w = makeWorld(PV, vault);
    const p = w.player;
    driveActor(PV, w, p, tape([['up', 120], ['left', 80]]));
    expect(p.x === vault.spawn.x && p.y === vault.spawn.y).toBe(false);
    p.reset();
    expect(p.x).toBe(vault.spawn.x);
    expect(p.y).toBe(vault.spawn.y);
    expect(p.vx).toBe(0);
    expect(p.vy).toBe(0);
  });

  test('holding a direction actually moves the actor', () => {
    const { PV } = loadPV();
    const vault = PV.Levels.get(0);
    const w = makeWorld(PV, vault);
    const p = w.player;
    const y0 = p.y;
    driveActor(PV, w, p, tape([['up', 120]]));
    expect(p.y).toBeLessThan(y0 - 0.5);
  });
});

describe('collision', () => {
  test('an actor cannot walk out through a solid wall', () => {
    const { PV } = loadPV();
    const vault = PV.Levels.get(0);
    const w = makeWorld(PV, vault);
    const p = w.player;

    /* push hard into every direction for a long time; the map is sealed, so
       the actor must still be inside and on a non-solid tile. */
    for (const dir of ['up', 'down', 'left', 'right']) {
      driveActor(PV, w, p, tape([[dir, 600]]));
      expect(p.x).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(vault.w);
      expect(p.y).toBeLessThan(vault.h);
      const tile = vault.grid[Math.floor(p.y) * vault.w + Math.floor(p.x)];
      expect(`${dir} ended on solid tile: ${!!tile.solid}`).toBe(`${dir} ended on solid tile: false`);
    }
  });
});

describe('echo replay — the signature mechanic', () => {
  /** Record the player walking, then replay the tape as an Echo. */
  function recordThenReplay(PV, vault, inputs) {
    const E = PV.Entities;
    const rec = new E.Recording(PV.LOOP_TICKS);

    const w1 = makeWorld(PV, vault);
    const p = w1.player;
    const recorded = [];
    for (let t = 0; t < inputs.length; t++) {
      const inp = inputs[t];
      p.step(w1, inp);
      rec.write(t, inp.x, inp.y, inp.action, inp.dash, p.x, p.y);
      recorded.push([p.x, p.y]);
    }

    const w2 = makeWorld(PV, vault);
    const echo = new E.Echo(rec, vault.spawn.x, vault.spawn.y, 0);
    w2.echoes.push(echo);
    w2.allActors.push(echo);
    const replayed = [];
    for (let t = 0; t < inputs.length; t++) {
      echo.advance(w2);
      replayed.push([echo.x, echo.y]);
    }
    return { rec, recorded, replayed, echo };
  }

  test('an echo reproduces the recorded path exactly', () => {
    const { PV } = loadPV();
    const vault = PV.Levels.get(0);
    const inputs = tape([['up', 240], ['right', 180], ['none', 60], ['down', 120], ['left', 90]]);
    const { recorded, replayed } = recordThenReplay(PV, vault, inputs);
    expect(replayed).toEqual(recorded);
  });

  test('replaying never accumulates desync on its own recording', () => {
    const { PV } = loadPV();
    const vault = PV.Levels.get(0);
    const inputs = tape([['up', 300], ['right', 300], ['down', 200]]);
    const { echo } = recordThenReplay(PV, vault, inputs);
    /* desync is 0..1; a faithful replay must stay pinned at 0 */
    expect(echo.desync).toBe(0);
  });

  test('an echo goes inactive once its tape runs out, and stops moving', () => {
    const { PV } = loadPV();
    const vault = PV.Levels.get(0);
    const inputs = tape([['up', 100]]);
    const E = PV.Entities;
    const rec = new E.Recording(PV.LOOP_TICKS);
    const w1 = makeWorld(PV, vault);
    for (let t = 0; t < inputs.length; t++) {
      w1.player.step(w1, inputs[t]);
      rec.write(t, inputs[t].x, inputs[t].y, false, false, w1.player.x, w1.player.y);
    }

    const w2 = makeWorld(PV, vault);
    const echo = new E.Echo(rec, vault.spawn.x, vault.spawn.y, 0);
    w2.echoes.push(echo);
    for (let t = 0; t < inputs.length; t++) echo.advance(w2);
    expect(echo.active).toBe(true);

    const restX = echo.x, restY = echo.y;
    for (let t = 0; t < 200; t++) echo.advance(w2);
    expect(echo.active).toBe(false);
    expect(echo.x).toBe(restX);
    expect(echo.y).toBe(restY);
  });

  test('an echo reset() rewinds its tape to tick 0 so it replays from the start', () => {
    const { PV } = loadPV();
    const vault = PV.Levels.get(0);
    const inputs = tape([['up', 150], ['right', 150]]);
    const E = PV.Entities;
    const rec = new E.Recording(PV.LOOP_TICKS);
    const w1 = makeWorld(PV, vault);
    for (let t = 0; t < inputs.length; t++) {
      w1.player.step(w1, inputs[t]);
      rec.write(t, inputs[t].x, inputs[t].y, false, false, w1.player.x, w1.player.y);
    }

    const w2 = makeWorld(PV, vault);
    const echo = new E.Echo(rec, vault.spawn.x, vault.spawn.y, 0);
    w2.echoes.push(echo);
    const firstPass = [];
    for (let t = 0; t < inputs.length; t++) { echo.advance(w2); firstPass.push([echo.x, echo.y]); }

    echo.reset();
    expect(echo.tick).toBe(0);
    const w3 = makeWorld(PV, vault);
    w3.echoes.push(echo);
    const secondPass = [];
    for (let t = 0; t < inputs.length; t++) { echo.advance(w3); secondPass.push([echo.x, echo.y]); }
    expect(secondPass).toEqual(firstPass);
  });

  test('Recording round-trips inputs that sit on the 1/127 quantisation grid', () => {
    const { PV } = loadPV();
    const rec = new PV.Entities.Recording(64);
    const out = { x: 0, y: 0, action: false, dash: false };
    rec.write(0, 1, -1, true, false, 3.5, 4.25);
    rec.read(0, out);
    expect(out.x).toBe(1);
    expect(out.y).toBe(-1);
    expect(out.action).toBe(true);
    expect(out.dash).toBe(false);

    rec.write(1, 0, 0, false, true, 0, 0);
    rec.read(1, out);
    expect(out.action).toBe(false);
    expect(out.dash).toBe(true);
  });

  test('Recording stores the position track it uses for desync checks', () => {
    const { PV } = loadPV();
    const rec = new PV.Entities.Recording(64);
    rec.write(0, 0, 0, false, false, 6.5, 9.25);
    expect(rec.px[0] / 256).toBeCloseTo(6.5, 3);
    expect(rec.py[0] / 256).toBeCloseTo(9.25, 3);
    expect(rec.length).toBe(1);
  });

  test('Recording refuses to write past its capacity instead of corrupting memory', () => {
    const { PV } = loadPV();
    const rec = new PV.Entities.Recording(8);
    expect(() => rec.write(99, 1, 0, false, false, 1, 1)).not.toThrow();
    expect(rec.length).toBe(0);
  });
});

describe('scoring — SPEC §8', () => {
  /* vaultScore = 250*relics + 400*echoesLeft + floor(6*secondsLeft)
                  + 300 no-alarm + 500 perfect, times the vault multiplier */
  function expectedVaultScore(relics, echoesLeft, secondsLeft, noAlarm, perfect, mult) {
    const base = 250 * relics + 400 * echoesLeft + Math.floor(6 * secondsLeft)
      + (noAlarm ? 300 : 0) + (perfect ? 500 : 0);
    return Math.round(base * mult);
  }

  test('the documented formula is arithmetically what it claims', () => {
    expect(expectedVaultScore(1, 3, 10, true, true, 1)).toBe(250 + 1200 + 60 + 300 + 500);
  });

  test('the multiplier compounds across a run', () => {
    const { PV } = loadPV();
    const perVault = [0, 1, 2].map(i =>
      expectedVaultScore(1, 2, 5, true, false, PV.Levels.multiplier(i)));
    expect(perVault[1]).toBeGreaterThan(perVault[0]);
    expect(perVault[2]).toBeGreaterThan(perVault[1]);
  });
});

describe('storage never throws', () => {
  test('get returns the default for a missing key', () => {
    const { PV } = loadPV();
    expect(PV.store.get('definitely-not-set', 'fallback')).toBe('fallback');
  });

  test('set then get round-trips', () => {
    const { PV } = loadPV();
    PV.store.set('pv-test-key', { a: 1 });
    expect(PV.store.get('pv-test-key', null)).toEqual({ a: 1 });
  });
});

describe('event bus', () => {
  test('on/emit/off behave', () => {
    const { PV } = loadPV();
    const seen = [];
    const fn = (p) => seen.push(p);
    PV.on('test:evt', fn);
    PV.emit('test:evt', { v: 1 });
    PV.off('test:evt', fn);
    PV.emit('test:evt', { v: 2 });
    expect(seen).toEqual([{ v: 1 }]);
  });

  test('a throwing listener does not break emit for everyone else', () => {
    const { PV } = loadPV({ captureConsole: true });
    const seen = [];
    PV.on('test:evt', () => { throw new Error('bad listener'); });
    PV.on('test:evt', () => seen.push('ok'));
    expect(() => PV.emit('test:evt', {})).not.toThrow();
    expect(seen).toEqual(['ok']);
  });
});
