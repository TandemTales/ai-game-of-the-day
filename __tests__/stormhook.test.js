/* =====================================================================
   Stormhook — simulation tests.

   These assert on mechanics, not on pixels. The rope solver is the thing
   most worth pinning down: it is the game, and it is the part where a
   subtle regression is invisible in a screenshot but ruins the feel.
   ===================================================================== */
'use strict';

const { loadSH, input, run, snapshot, FIXED_DT } = require('./stormhook.harness');

describe('core', () => {
  test('seeded RNG is deterministic and reproducible across instances', () => {
    const a = loadSH().SH, b = loadSH().SH;
    a.setSeed(1234); b.setSeed(1234);
    const xs = [], ys = [];
    for (let i = 0; i < 64; i++) { xs.push(a.rand()); ys.push(b.rand()); }
    expect(xs).toEqual(ys);
    expect(xs.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Set(xs).size).toBeGreaterThan(60);      // not a stuck generator
  });

  test('math helpers behave at their edges', () => {
    const { SH } = loadSH();
    expect(SH.clamp(5, 0, 1)).toBe(1);
    expect(SH.clamp(-5, 0, 1)).toBe(0);
    expect(SH.smoothstep(2, 2, 2)).toBe(0);            // zero-width span, no NaN
    expect(SH.approach(0, 10, 3)).toBe(3);
    expect(SH.approach(10, 0, 3)).toBe(7);
    expect(SH.approach(1, 1, 3)).toBe(1);
    expect(SH.fmtNum(1234567)).toBe('1,234,567');
    expect(SH.fmtTime(65.5)).toBe('1:05.50');
  });

  test('storage degrades to the default instead of throwing when blocked', () => {
    const { SH, sandbox } = loadSH();
    sandbox.localStorage.setItem = () => { throw new Error('blocked'); };
    sandbox.localStorage.getItem = () => { throw new Error('blocked'); };
    expect(() => SH.store.set('k', 1)).not.toThrow();
    expect(SH.store.get('k', 'dflt')).toBe('dflt');
  });
});

describe('levels', () => {
  test('every level rasterises to a well-formed grid', () => {
    const { SH } = loadSH();
    expect(SH.Levels.count()).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < SH.Levels.count(); i++) {
      const lv = SH.Levels.get(i);
      expect(lv.grid.length).toBe(lv.h);
      lv.grid.forEach((row) => {
        expect(row.length).toBe(lv.w);
        expect(row).toMatch(/^[.#=oSX^]+$/);
      });
    }
  });

  test('get() is cached, so the grid is never rebuilt mid-run', () => {
    const { SH } = loadSH();
    expect(SH.Levels.get(0)).toBe(SH.Levels.get(0));
  });

  test('exactly one spawn and one beacon per level', () => {
    const { SH } = loadSH();
    for (let i = 0; i < SH.Levels.count(); i++) {
      const all = SH.Levels.get(i).grid.join('');
      expect(all.split('S').length - 1).toBe(1);
      expect(all.split('X').length - 1).toBe(1);
    }
  });
});

describe('world + body', () => {
  test('makeWorld places the player, beacon and every core', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    const lv = SH.Levels.get(0);
    expect(w.p.x).toBeGreaterThan(0);
    expect(w.beacon.x).toBeGreaterThan(w.p.x);
    expect(w.cores.length).toBe(lv.coreCount);
    expect(w.cores.length).toBeGreaterThan(0);
    expect(w.dead).toBe(false);
    expect(w.cleared).toBe(false);
  });

  test('the player is not spawned inside solid geometry, in any level', () => {
    const { SH } = loadSH();
    for (let i = 0; i < SH.Levels.count(); i++) {
      const w = SH.Physics.makeWorld(i);
      expect(SH.Physics.solidAtPoint(w, w.p.x, w.p.y)).toBe(false);
      expect(SH.Physics.solidAtPoint(w, w.beacon.x, w.beacon.y)).toBe(false);
    }
  });

  test('a dropped player falls, lands, and stops — no sinking, no jitter', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    w.p.y -= 100;
    run(SH, w, 240);
    expect(w.p.onGround).toBe(true);
    expect(Math.abs(w.p.vy)).toBeLessThan(30);
    expect(SH.Physics.solidAtPoint(w, w.p.x, w.p.y)).toBe(false);
    const restY = w.p.y;
    run(SH, w, 120);
    expect(Math.abs(w.p.y - restY)).toBeLessThan(1);   // fully at rest
  });

  test('the body never tunnels through the floor at high speed', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    w.p.vy = SH.TUNE.maxAirSpeed;
    run(SH, w, 300);
    expect(w.deathCause).not.toBe('fall');
    expect(w.p.y).toBeLessThan((w.h + 1) * SH.TILE);
  });
});

describe('the tether', () => {
  function attachUp(SH, w) {
    w.aim.x = w.p.x;
    w.aim.y = w.p.y - SH.TUNE.maxRange;
    return SH.Physics.fireHook(w);
  }

  test('firing at reachable geometry attaches; firing into open air does not', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    expect(attachUp(SH, w)).toBe(true);
    expect(w.hook.attached).toBe(true);
    expect(w.hook.pivots.length).toBe(1);
    expect(w.hook.len).toBeGreaterThan(0);

    SH.Physics.releaseHook(w);
    expect(w.hook.attached).toBe(false);
    expect(w.hook.pivots.length).toBe(0);

    /* Straight down from a spawn that sits on the floor: the ray starts
       inside range of the floor, so aim at open sky far to the side
       instead, where nothing is within maxRange. */
    const w2 = SH.Physics.makeWorld(0);
    w2.p.x = 40 * SH.TILE; w2.p.y = 7 * SH.TILE;
    w2.aim.x = w2.p.x + 4; w2.aim.y = w2.p.y + SH.TUNE.maxRange;
    const hitDown = SH.Physics.fireHook(w2);
    if (!hitDown) expect(w2.hook.attached).toBe(false);
  });

  test('the anchor is seated outside the solid it latched to', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    attachUp(SH, w);
    const a = w.hook.pivots[0];
    expect(SH.Physics.solidAtPoint(w, a.x, a.y)).toBe(false);
  });

  test('a taut swing conserves speed: the rope removes radial, keeps tangential', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    /* Hang the player from the ceiling, out to the side and moving. */
    w.p.x = 32 * SH.TILE; w.p.y = 9 * SH.TILE;
    w.aim.x = w.p.x; w.aim.y = 0;
    expect(SH.Physics.fireHook(w)).toBe(true);
    /* Pull them sideways so the rope is taut and off-vertical. */
    w.p.x += w.hook.len * 0.55;
    w.p.vx = 0; w.p.vy = 0;

    const anchor = w.hook.pivots[0];
    let maxSpeed = 0;
    run(SH, w, 200, () => input({ hook: true }));
    const d = SH.dist(anchor.x, anchor.y, w.p.x, w.p.y);
    /* Still on the rope, never stretched past its length. */
    expect(w.hook.attached).toBe(true);
    expect(d).toBeLessThanOrEqual(w.hook.len + 1.5);
    /* And it actually swung — a pendulum released off-axis gains speed. */
    expect(SH.len(w.p.vx, w.p.vy)).toBeGreaterThan(100);
  });

  test('a pendulum does not gain energy: it never swings above its release height', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    w.p.x = 32 * SH.TILE; w.p.y = 4 * SH.TILE;
    w.aim.x = w.p.x; w.aim.y = 0;
    SH.Physics.fireHook(w);
    w.hook.len = 300;
    const anchor = w.hook.pivots[0];
    /* Start level with the anchor, at rest: the highest it may ever get
       back to is that same height, minus what drag has taken. */
    w.p.x = anchor.x + 300; w.p.y = anchor.y;
    w.p.vx = 0; w.p.vy = 0;
    const startY = w.p.y;

    let highest = Infinity;
    run(SH, w, 1200, () => {
      highest = Math.min(highest, w.p.y);
      return input({ hook: true });
    });
    expect(highest).toBeGreaterThanOrEqual(startY - 2);   // +y is down
  });

  test('reeling in shortens the rope and pulls the player toward the anchor', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    w.p.x = 32 * SH.TILE; w.p.y = 10 * SH.TILE;
    w.aim.x = w.p.x; w.aim.y = 0;
    SH.Physics.fireHook(w);
    const len0 = w.hook.len;
    const anchor = w.hook.pivots[0];
    const d0 = SH.dist(anchor.x, anchor.y, w.p.x, w.p.y);

    run(SH, w, 120, () => input({ hook: true, reel: -1 }));
    expect(w.hook.len).toBeLessThan(len0);
    expect(SH.dist(anchor.x, anchor.y, w.p.x, w.p.y)).toBeLessThan(d0);
    expect(w.hook.len).toBeGreaterThanOrEqual(SH.TUNE.minLen);
  });

  test('the rope length stays inside its tuned bounds however hard it is reeled', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    w.p.x = 32 * SH.TILE; w.p.y = 10 * SH.TILE;
    w.aim.x = w.p.x; w.aim.y = 0;
    SH.Physics.fireHook(w);
    run(SH, w, 900, () => input({ hook: true, reel: -1 }));
    expect(w.hook.len).toBeGreaterThanOrEqual(SH.TUNE.minLen - 0.001);
    run(SH, w, 900, () => input({ hook: true, reel: 1 }));
    expect(w.hook.len).toBeLessThanOrEqual(SH.TUNE.maxLen + 0.001);
  });

  test('releasing keeps the velocity the swing built', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    w.p.x = 32 * SH.TILE; w.p.y = 6 * SH.TILE;
    w.aim.x = w.p.x; w.aim.y = 0;
    SH.Physics.fireHook(w);
    w.p.x += w.hook.len * 0.6;
    run(SH, w, 90, () => input({ hook: true }));
    const before = { vx: w.p.vx, vy: w.p.vy };
    SH.Physics.releaseHook(w);
    expect(w.p.vx).toBe(before.vx);
    expect(w.p.vy).toBe(before.vy);
  });
});

describe('rope wrapping (SPEC §2b — the signature mechanic)', () => {
  /* A pylon hangs from the ceiling at tiles x=26..27, y=2..6 in level 0.
     Swing past it and the rope must catch on its corner. */
  test('the rope wraps onto a pylon corner when the line is obstructed', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    /* Anchor on the ceiling to the LEFT of the pylon, player to the
       RIGHT and below it, so the straight line is cut by the pylon. */
    w.hook.attached = true;
    w.hook.pivots = [{ x: 23 * SH.TILE, y: 2 * SH.TILE + 2, s: 0 }];
    w.hook.len = 700;
    w.p.x = 30 * SH.TILE; w.p.y = 9 * SH.TILE;
    w.p.vx = 0; w.p.vy = 0;

    const anchor = w.hook.pivots[0];
    expect(SH.Physics.segBlocked(w, anchor.x, anchor.y, w.p.x, w.p.y)).toBe(true);

    run(SH, w, 30, () => input({ hook: true }));
    expect(w.hook.pivots.length).toBeGreaterThan(1);

    /* Every leg of the resulting polyline must be clear geometry. */
    const pv = w.hook.pivots;
    for (let i = 0; i + 1 < pv.length; i++) {
      expect(SH.Physics.segBlocked(w, pv[i].x, pv[i].y, pv[i + 1].x, pv[i + 1].y)).toBe(false);
    }
    const last = pv[pv.length - 1];
    expect(SH.Physics.segBlocked(w, last.x, last.y, w.p.x, w.p.y)).toBe(false);
  });

  test('a wrapped rope unwraps again when the swing comes back the other way', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    w.hook.attached = true;
    w.hook.pivots = [{ x: 23 * SH.TILE, y: 2 * SH.TILE + 2, s: 0 }];
    w.hook.len = 700;
    w.p.x = 30 * SH.TILE; w.p.y = 9 * SH.TILE;
    run(SH, w, 30, () => input({ hook: true }));
    const wrapped = w.hook.pivots.length;
    expect(wrapped).toBeGreaterThan(1);

    /* Put the player back on the anchor's own side of the pylon (which
       occupies tiles x=26..27); the turn unwinds. */
    w.p.x = 20 * SH.TILE; w.p.y = 8 * SH.TILE;
    w.p.vx = 0; w.p.vy = 0;
    run(SH, w, 60, () => input({ hook: true }));
    expect(w.hook.pivots.length).toBeLessThan(wrapped);
  });

  test('wrapping shortens the working rope rather than lengthening it', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    w.hook.attached = true;
    w.hook.pivots = [{ x: 23 * SH.TILE, y: 2 * SH.TILE + 2, s: 0 }];
    w.hook.len = 700;
    w.p.x = 30 * SH.TILE; w.p.y = 9 * SH.TILE;
    run(SH, w, 30, () => input({ hook: true }));
    const info = SH.Physics.ropeInfo(w);
    expect(info.pivots.length).toBeGreaterThan(1);
    expect(info.used).toBeGreaterThan(0);
    expect(info.eff).toBeLessThan(info.total);
    expect(info.eff).toBeGreaterThanOrEqual(SH.TUNE.minLen);
  });

  test('the pivot count stays bounded — no runaway wrap/unwrap thrash', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(2);
    w.storm.speed = 0;
    let maxPivots = 0;
    /* Fly around a wrap-heavy level swinging at whatever is overhead. */
    for (let k = 0; k < 8; k++) {
      w.p.x = (10 + k * 11) * SH.TILE;
      w.p.y = 9 * SH.TILE;
      w.p.vx = 400; w.p.vy = -200;
      w.aim.x = w.p.x + 60; w.aim.y = 0;
      w.hook.cool = 0;
      SH.Physics.fireHook(w);
      run(SH, w, 240, () => {
        maxPivots = Math.max(maxPivots, w.hook.pivots.length);
        return input({ hook: true });
      });
      w.dead = false; w.p.alive = true; w.cleared = false;
    }
    expect(maxPivots).toBeLessThan(24);
  });
});

describe('determinism', () => {
  test('identical input tapes produce bit-identical worlds', () => {
    const { SH: A } = loadSH();
    const { SH: B } = loadSH();
    const tape = [];
    for (let i = 0; i < 900; i++) {
      tape.push(input({
        hook: i > 30 && i < 500,
        hookPressed: i === 31,
        hookReleased: i === 500,
        reel: i % 180 < 60 ? -1 : (i % 180 < 120 ? 1 : 0),
        lean: ((i / 90) | 0) % 2 ? 1 : -1,
        dashPressed: i === 600,
      }));
    }
    function play(SH) {
      const w = SH.Physics.makeWorld(1);
      const seen = [];
      for (let i = 0; i < tape.length; i++) {
        w.aim.x = w.p.x + 120 * Math.cos(i * 0.05);
        w.aim.y = w.p.y - 300;
        SH.Physics.step(w, tape[i], FIXED_DT);
        if (i % 100 === 0) seen.push(snapshot(w));
      }
      seen.push(snapshot(w));
      return seen;
    }
    expect(play(A)).toEqual(play(B));
  });

  test('physics uses no wall clock and no unseeded randomness', () => {
    const fs = require('fs');
    const path = require('path');
    const raw = fs.readFileSync(
      path.join(__dirname, '..', 'stormhook', 'assets', 'js', 'physics.js'), 'utf8');
    /* Strip comments first — the file's own header says it uses none of
       these, and that sentence should not fail its own test. */
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now|performance\.now/);
  });
});

describe('scoring inputs and fail states (SPEC §8)', () => {
  test('the combo multiplier climbs with airtime and resets the moment you land', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    expect(w.combo).toBe(1);

    /* Hang in the air on a rope and let airtime accumulate. */
    w.p.x = 32 * SH.TILE; w.p.y = 8 * SH.TILE;
    w.aim.x = w.p.x; w.aim.y = 0;
    SH.Physics.fireHook(w);
    run(SH, w, 600, () => input({ hook: true }));
    expect(w.airTime).toBeGreaterThan(4);
    expect(w.combo).toBeGreaterThan(4);

    /* Now put them on the ground. */
    SH.Physics.releaseHook(w);
    run(SH, w, 600);
    expect(w.p.onGround).toBe(true);
    expect(w.airTime).toBe(0);
    expect(w.combo).toBe(1);
  });

  test('the combo is capped', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    w.airTime = 9999;
    SH.Physics.step(w, input(), FIXED_DT);
    expect(w.combo).toBe(SH.TUNE.comboMax);
  });

  test('collecting a core fires exactly one event and never repeats', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    const c = w.cores[0];
    w.p.x = c.x; w.p.y = c.y; w.p.vx = 0; w.p.vy = 0;
    w.pending.length = 0;
    SH.Physics.step(w, input(), FIXED_DT);
    let got = w.pending.filter((e) => e.type === 'core');
    expect(got.length).toBe(1);
    expect(got[0].combo).toBeGreaterThanOrEqual(1);
    expect(c.taken).toBe(true);

    w.pending.length = 0;
    run(SH, w, 30);
    expect(w.pending.filter((e) => e.type === 'core').length).toBe(0);
    expect(w.cores_taken).toBe(1);
  });

  test('the storm front kills, and does so exactly once', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.x = w.p.x + 10;
    w.pending.length = 0;
    run(SH, w, 10);
    expect(w.dead).toBe(true);
    expect(w.deathCause).toBe('storm');
    expect(w.pending.filter((e) => e.type === 'death').length).toBe(1);
    run(SH, w, 60);
    expect(w.pending.filter((e) => e.type === 'death').length).toBe(1);
  });

  test('hazard tiles kill on contact', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(1);
    w.storm.speed = 0;
    const hz = w.hazards[0];
    expect(hz).toBeTruthy();
    w.p.x = hz.x; w.p.y = hz.y;
    run(SH, w, 4);
    expect(w.dead).toBe(true);
    expect(w.deathCause).toBe('hazard');
  });

  test('touching the beacon clears the level', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.speed = 0;
    w.p.x = w.beacon.x; w.p.y = w.beacon.y; w.p.vx = 0; w.p.vy = 0;
    run(SH, w, 4);
    expect(w.cleared).toBe(true);
    expect(w.dead).toBe(false);
  });

  test('a dead world stops simulating — no movement after death', () => {
    const { SH } = loadSH();
    const w = SH.Physics.makeWorld(0);
    w.storm.x = w.p.x + 10;
    run(SH, w, 10);
    expect(w.dead).toBe(true);
    const at = { x: w.p.x, y: w.p.y };
    run(SH, w, 120);
    expect(w.p.x).toBe(at.x);
    expect(w.p.y).toBe(at.y);
  });
});
