/* =====================================================================
   Zephyr Circuit — the track model.

   Everything in the game is a query against the baked centerline: the
   road mesh, lap counting, the off-track test, respawn and the AI line.
   If this file is wrong, nothing above it can be right.
   ===================================================================== */
'use strict';

const { loadZC } = require('./zephyr-circuit.harness');

const ZC = loadZC(['core.js', 'track.js', 'tracks.js']);
const T = ZC.Track;
const TRACKS = ZC.Tracks.LIST;

/* Smallest centre-to-centre distance between two parts of the road that
   are far apart along it. This is the self-intersection test. */
function minSelfDistance(track, minArc) {
  let worst = Infinity, wa = 0, wb = 0;
  for (let i = 0; i < track.count; i += 2) {
    for (let j = i + 2; j < track.count; j += 2) {
      const raw = Math.abs(track.s[j] - track.s[i]);
      const arc = Math.min(raw, track.length - raw);
      if (arc < minArc) continue;
      const dx = track.px[i] - track.px[j];
      const dy = track.py[i] - track.py[j];
      const dz = track.pz[i] - track.pz[j];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < worst) { worst = d; wa = i; wb = j; }
    }
  }
  return { d: worst, a: wa, b: wb };
}

describe.each(TRACKS.map((d, i) => [d.id, i]))('%s', (_id, index) => {
  const track = ZC.Tracks.get(index);

  test('bakes to a closed loop of uniform segments', () => {
    expect(track.count).toBeGreaterThan(100);
    expect(track.ds).toBeGreaterThan(0);
    expect(Math.abs(track.length - track.count * track.ds)).toBeLessThan(1e-3);
    /* the loop must actually close */
    const gap = Math.hypot(
      track.px[0] - track.px[track.count - 1],
      track.py[0] - track.py[track.count - 1],
      track.pz[0] - track.pz[track.count - 1]);
    expect(gap).toBeLessThan(track.ds * 1.5);
  });

  test('is a lap length that races in the 35-50 second range', () => {
    expect(track.length).toBeGreaterThan(700);
    expect(track.length).toBeLessThan(1400);
  });

  test('has an orthonormal frame at every segment', () => {
    for (let i = 0; i < track.count; i++) {
      const tl = Math.hypot(track.tx[i], track.ty[i], track.tz[i]);
      const rl = Math.hypot(track.rx[i], track.ry[i], track.rz[i]);
      const nl = Math.hypot(track.nx[i], track.ny[i], track.nz[i]);
      expect(Math.abs(tl - 1)).toBeLessThan(1e-4);
      expect(Math.abs(rl - 1)).toBeLessThan(1e-4);
      expect(Math.abs(nl - 1)).toBeLessThan(1e-4);
      const dot = track.tx[i] * track.rx[i] + track.ty[i] * track.ry[i] + track.tz[i] * track.rz[i];
      expect(Math.abs(dot)).toBeLessThan(1e-4);
    }
  });

  test('never crosses or touches itself', () => {
    /* The first draft of Gullwing Bay doubled back through the middle of
       the island and overlapped its own surface by 20m, which silently
       broke lap counting and the off-track test in that region. Road
       edges must clear each other by a real margin, not merely miss. */
    const near = minSelfDistance(track, 80);
    const edges = near.d - track.halfWidth[near.a] - track.halfWidth[near.b];
    expect(edges).toBeGreaterThan(15);
  });

  test('has no corner tighter than a kart can physically take', () => {
    let maxK = 0;
    for (let i = 0; i < track.count; i++) maxK = Math.max(maxK, Math.abs(track.curvature[i]));
    /* radius must exceed the turning circle at the speed you can carry */
    expect(1 / maxK).toBeGreaterThan(12);
  });

  test('camber is derived, capped, and points into the corner', () => {
    const def = TRACKS[index];
    if (!def.autoBank) return;
    const cap = def.maxBank === undefined ? 0.20 : def.maxBank;
    let agree = 0, counted = 0;
    for (let i = 0; i < track.count; i++) {
      expect(Math.abs(track.bank[i])).toBeLessThanOrEqual(cap + 1e-3);
      /* only judge where the corner is meaningful; camber is smoothed, so
         it lags slightly through transitions and straights are ~0 */
      if (Math.abs(track.curvature[i]) > 0.012) {
        counted++;
        if (Math.sign(track.bank[i]) === Math.sign(track.curvature[i])) agree++;
      }
    }
    expect(counted).toBeGreaterThan(20);
    expect(agree / counted).toBeGreaterThan(0.9);
  });

  test('bakes identically every time', () => {
    const a = ZC.Track.bake(TRACKS[index]);
    const b = ZC.Track.bake(TRACKS[index]);
    expect(Buffer.from(a.px.buffer)).toEqual(Buffer.from(b.px.buffer));
    expect(Buffer.from(a.rx.buffer)).toEqual(Buffer.from(b.rx.buffer));
    expect(Buffer.from(a.bank.buffer)).toEqual(Buffer.from(b.bank.buffer));
    expect(a.length).toBe(b.length);
  });

  test('projection round-trips a point back to where it was placed', () => {
    let worstS = 0, worstT = 0;
    let hint = -1;
    for (let k = 0; k < 1500; k++) {
      const s = track.length * k / 1500;
      const t = Math.sin(k * 0.37) * 0.85;
      const p = T.pointAt(track, s, t);
      const pr = T.project(track, p.x, p.y, p.z, hint);
      hint = pr.seg;
      worstS = Math.max(worstS, Math.abs(T.deltaS(track, s, pr.s)));
      worstT = Math.max(worstT, Math.abs(t - pr.t));
    }
    expect(worstS).toBeLessThan(track.ds);
    expect(worstT).toBeLessThan(0.02);
  });

  test('a full scan agrees with a hinted scan', () => {
    /* The hinted path is what karts use every tick; the full scan is what
       respawn and grid placement use. They must not disagree, or a kart
       teleports on respawn. */
    for (let k = 0; k < 300; k++) {
      const s = track.length * k / 300;
      const t = ((k % 5) / 5) * 1.4 - 0.7;
      const p = T.pointAt(track, s, t);
      const full = T.project(track, p.x, p.y, p.z, -1);
      const hinted = T.project(track, p.x, p.y, p.z, full.seg);
      expect(Math.abs(T.deltaS(track, full.s, hinted.s))).toBeLessThan(0.05);
    }
  });

  test('surfaceY follows the camber across the road', () => {
    /* On a banked corner the road edge is genuinely higher than the
       centre; if surfaceY ignored camber, karts would float or sink. */
    let sawTilt = false;
    for (let k = 0; k < 400; k++) {
      const s = track.length * k / 400;
      const left = T.pointAt(track, s, -0.9);
      const right = T.pointAt(track, s, 0.9);
      const pl = T.project(track, left.x, left.y, left.z, -1);
      const pr = T.project(track, right.x, right.y, right.z, -1);
      expect(Math.abs(pl.surfaceY - left.y)).toBeLessThan(0.35);
      expect(Math.abs(pr.surfaceY - right.y)).toBeLessThan(0.35);
      if (Math.abs(pl.surfaceY - pr.surfaceY) > 0.5) sawTilt = true;
    }
    expect(sawTilt).toBe(true);
  });

  test('onRoad is true across the road and false past the edge', () => {
    for (let k = 0; k < 200; k++) {
      const s = track.length * k / 200;
      const inside = T.pointAt(track, s, 0.6);
      const outside = T.pointAt(track, s, 1.9);
      expect(T.project(track, inside.x, inside.y, inside.z, -1).onRoad).toBe(true);
      expect(T.project(track, outside.x, outside.y, outside.z, -1).onRoad).toBe(false);
    }
  });

  test('checkpoints tile the lap in order with no gaps', () => {
    const seen = new Set();
    for (let k = 0; k < 4000; k++) {
      seen.add(T.checkpointAt(track, track.length * k / 4000));
    }
    expect(seen.size).toBe(track.checkpoints);
    expect(T.checkpointAt(track, 0)).toBe(0);
    expect(T.checkpointAt(track, track.length - 0.001)).toBe(track.checkpoints - 1);
  });

  test('deltaS takes the short way round the loop', () => {
    expect(T.deltaS(track, 10, 20)).toBeCloseTo(10, 5);
    expect(T.deltaS(track, track.length - 5, 5)).toBeCloseTo(10, 5);
    expect(T.deltaS(track, 5, track.length - 5)).toBeCloseTo(-10, 5);
  });

  test('the starting grid fits on the road and lines up behind the line', () => {
    for (let place = 0; place < 8; place++) {
      const slot = ZC.Tracks.gridSlot(track, place, 8);
      expect(Math.abs(slot.t)).toBeLessThan(0.8);
      const p = T.pointAt(track, slot.s, slot.t);
      const pr = T.project(track, p.x, p.y, p.z, -1);
      expect(pr.onRoad).toBe(true);
    }
    /* pole sits ahead of last place */
    const pole = ZC.Tracks.gridSlot(track, 0, 8);
    const last = ZC.Tracks.gridSlot(track, 7, 8);
    expect(T.deltaS(track, last.s, pole.s)).toBeGreaterThan(0);
  });
});
