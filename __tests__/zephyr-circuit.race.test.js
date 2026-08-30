/* =====================================================================
   Zephyr Circuit — AI drivers and the race loop.

   The property that matters most here is that skill is MONOTONIC. The
   first version of the brain raised aggression with skill — more gain,
   more nerve, a lower drift threshold — and the highest-rated driver
   finished last, sliding wide into the void. A field whose ratings do not
   predict the result is worse than no ratings at all.
   ===================================================================== */
'use strict';

const { loadZC } = require('./zephyr-circuit.harness');

const LOGIC = ['core.js', 'track.js', 'tracks.js', 'kart.js', 'items.js', 'ai.js', 'race.js'];

function fresh() {
  const ZC = loadZC(LOGIC);
  return { ZC, track: ZC.Tracks.get(0) };
}

/* One AI alone on the circuit, so nothing but its own driving decides
   the result. */
function solo(ZC, track, skill, maxSeconds) {
  ZC.setSeed(99);
  const kart = ZC.Kart.create({ id: 'a' });
  ZC.Kart.placeOnGrid(kart, track, 0, 8);
  const brain = ZC.AI.makeBrain({ skill, line: 0 });
  const dt = ZC.STEP_DT;
  let time = 0;
  const steps = Math.round((maxSeconds || 260) / dt);
  for (let i = 0; i < steps && !kart.finished; i++) {
    ZC.Kart.step(kart, ZC.AI.drive(kart, brain, track, time), track, dt);
    time += dt;
  }
  return kart;
}

function runField(ZC, seconds, opts) {
  ZC.Race.load(0, Object.assign({ attract: true }, opts || {}));
  const st = ZC.Race.state;
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) ZC.Race.update(dt);
  return st;
}

describe('AI drivers', () => {
  const { ZC, track } = fresh();
  const SKILLS = [0.5, 0.6, 0.7, 0.8, 0.9];
  const runs = SKILLS.map((s) => ({ skill: s, kart: solo(ZC, track, s) }));

  test('every skill level completes the race', () => {
    for (const r of runs) {
      expect(r.kart.finished).toBe(true);
      expect(r.kart.lap).toBe(track.laps);
    }
  });

  test('no AI falls off the circuit', () => {
    /* A computer driver that cannot stay on a road it can see the whole
       of is not a difficulty setting, it is a bug. */
    for (const r of runs) expect(r.kart.falls).toBe(0);
  });

  test('higher skill is strictly faster', () => {
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].kart.finishTime).toBeLessThan(runs[i - 1].kart.finishTime);
    }
  });

  test('lap times land in the 30-50 second band the circuit was built for', () => {
    for (const r of runs) {
      expect(r.kart.bestLap).toBeGreaterThan(30);
      expect(r.kart.bestLap).toBeLessThan(50);
    }
  });

  test('AI drives cleanly enough to stay mostly on the road', () => {
    const kart = ZC.Kart.create({ id: 'a' });
    ZC.Kart.placeOnGrid(kart, track, 0, 8);
    const brain = ZC.AI.makeBrain({ skill: 0.8, line: 0 });
    const dt = ZC.STEP_DT;
    let time = 0, off = 0, total = 0;
    for (let i = 0; i < 120 * 90 && !kart.finished; i++) {
      ZC.Kart.step(kart, ZC.AI.drive(kart, brain, track, time), track, dt);
      time += dt; total++;
      if (!kart.onRoad) off++;
    }
    expect(off / total).toBeLessThan(0.1);
  });

  test('the AI uses drift, and it makes it faster', () => {
    function run(allowDrift) {
      ZC.setSeed(99);
      const kart = ZC.Kart.create({ id: 'a' });
      ZC.Kart.placeOnGrid(kart, track, 0, 8);
      const brain = ZC.AI.makeBrain({ skill: 0.9, line: 0 });
      const dt = ZC.STEP_DT;
      let time = 0, drifted = 0;
      for (let i = 0; i < 120 * 260 && !kart.finished; i++) {
        const inp = ZC.AI.drive(kart, brain, track, time);
        if (!allowDrift) inp.drift = false;
        if (inp.drift) drifted++;
        ZC.Kart.step(kart, inp, track, dt);
        time += dt;
      }
      return { time: kart.finishTime, drifted };
    }
    const withDrift = run(true);
    const without = run(false);
    expect(withDrift.drifted).toBeGreaterThan(200);
    expect(withDrift.time).toBeLessThan(without.time);
  });
});

describe('the race loop', () => {
  test('loads a full grid with one player and no duplicate slots', () => {
    const { ZC } = fresh();
    ZC.Race.load(0, { playerIndex: 7 });
    const st = ZC.Race.state;
    expect(st.karts.length).toBe(ZC.Race.FIELD);
    expect(st.karts.filter((k) => k.isPlayer).length).toBe(1);
    expect(st.player).toBe(st.karts[7]);
    /* every kart gets a brain, the player's included — attract mode
       drives the player too, and a null there crashes the menu */
    expect(st.brains.filter(Boolean).length).toBe(ZC.Race.FIELD);
    const spots = st.karts.map((k) => k.s.toFixed(2) + ':' + k.t.toFixed(2));
    expect(new Set(spots).size).toBe(ZC.Race.FIELD);
  });

  test('nobody moves before the lights go out', () => {
    const { ZC } = fresh();
    ZC.Race.load(0, {});
    const st = ZC.Race.state;
    const before = st.karts.map((k) => k.s);
    ZC.Race.beginCountdown();
    for (let t = 0; t < 2; t += 1 / 60) ZC.Race.update(1 / 60);
    expect(st.phase).toBe(ZC.Race.PHASE.COUNTDOWN);
    st.karts.forEach((k, i) => expect(k.s).toBeCloseTo(before[i], 5));
  });

  /* Items OFF for this one, and that is the point of the option existing.
     The item game is a rubber band whose entire job is to stop the fastest
     driver simply winning — a Squall from the back of the grid SHOULD cost
     the leader the race. Asserting skill order in a race with items would
     therefore be asserting that items do not work. What must stay true is
     that skill predicts the result of a CLEAN race; that is the invariant
     the AI brain is held to, and it is checked here. The item game gets
     its own suite. */
  test('a whole field races, finishes, and finishes in skill order', () => {
    const { ZC } = fresh();
    const st = runField(ZC, 400, { items: false });
    const order = ZC.Race.order();
    for (const k of st.karts) {
      expect(k.finished).toBe(true);
      expect(k.falls).toBe(0);
    }
    /* the roster is authored fastest-first */
    expect(order[0].id).toBe(ZC.Race.ROSTER[0].id);
    expect(order[order.length - 1].id).toBe(ZC.Race.ROSTER[ZC.Race.FIELD - 1].id);
  });

  test('the field finishes close enough together to be a race', () => {
    const { ZC } = fresh();
    runField(ZC, 400);
    const order = ZC.Race.order();
    const spread = order[order.length - 1].finishTime - order[0].finishTime;
    expect(spread).toBeGreaterThan(3);    // not a procession of clones
    expect(spread).toBeLessThan(45);      // not a walkover
  });

  test('placement sorts by lap first, then distance round', () => {
    const { ZC } = fresh();
    ZC.Race.load(0, { attract: true });
    const st = ZC.Race.state;
    for (let t = 0; t < 40; t += 1 / 60) ZC.Race.update(1 / 60);
    const order = ZC.Race.order();
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].progress).toBeGreaterThanOrEqual(order[i].progress);
      expect(order[i].place).toBe(i + 1);
    }
  });

  test('the same seed replays the same race', () => {
    function run() {
      const { ZC } = fresh();
      const st = runField(ZC, 60);
      return st.karts.map((k) => k.s.toFixed(4) + ':' + k.lap).join('|');
    }
    expect(run()).toBe(run());
  });

  test('scoring rewards the win, the clock and a clean race', () => {
    const { ZC } = fresh();
    const st = runField(ZC, 400);
    const winner = ZC.Race.order()[0];
    st.player = winner;
    const s = ZC.Race.scoreRace(st);
    expect(s.place).toBe(1);
    expect(s.points).toBe(ZC.Race.POINTS[0]);
    expect(s.cleanBonus).toBe(200);
    expect(s.total).toBeGreaterThan(s.points * 40);

    /* last place must score less than first */
    st.player = ZC.Race.order()[ZC.Race.FIELD - 1];
    expect(ZC.Race.scoreRace(st).total).toBeLessThan(s.total);
  });
});

/* =====================================================================
   The cup.

   A single race is not a score worth putting on a leaderboard: the item
   game exists precisely so that one Squall in the last corner can decide
   a race, and a leaderboard built on that measures luck. Three circuits
   with championship points carried between them gives skill enough rounds
   to out-vote the rubber band.
   ===================================================================== */
describe('the cup', () => {
  function playRound(ZC, seconds) {
    ZC.Race.beginCountdown();
    for (let t = 0; t < (seconds || 400); t += 1 / 60) {
      ZC.Race.update(1 / 60);
      if (ZC.Race.state.phase === ZC.Race.PHASE.RESULTS) return true;
    }
    return false;
  }

  test('runs every circuit in order and ends on the standings', () => {
    const { ZC } = fresh();
    ZC.Race.startCup({ autoDrive: true });
    expect(ZC.Race.state.round).toBe(0);
    expect(ZC.Race.roundCount()).toBe(ZC.Race.CUP.length);
    expect(ZC.Race.CUP.length).toBeGreaterThanOrEqual(3);

    const seen = [];
    for (let r = 0; r < ZC.Race.CUP.length; r++) {
      seen.push(ZC.Race.state.track.id);
      expect(playRound(ZC)).toBe(true);
      const more = ZC.Race.advance();
      expect(more).toBe(r < ZC.Race.CUP.length - 1);
    }
    expect(seen).toEqual(ZC.Race.CUP);
    expect(ZC.Race.state.phase).toBe(ZC.Race.PHASE.CUP);
  });

  test('championship points accumulate and every racer has a row', () => {
    const { ZC } = fresh();
    ZC.Race.startCup({ autoDrive: true });
    expect(ZC.Race.state.standings.length).toBe(ZC.Race.FIELD);
    expect(ZC.Race.state.standings.every((s) => s.points === 0)).toBe(true);

    playRound(ZC);
    const afterOne = ZC.Race.state.standings.map((s) => s.points);
    /* one race, so the top row must hold exactly the win's points */
    expect(afterOne[0]).toBe(ZC.Race.POINTS[0]);
    const totalOne = afterOne.reduce((a, b) => a + b, 0);
    expect(totalOne).toBe(ZC.Race.POINTS.reduce((a, b) => a + b, 0));

    ZC.Race.advance();
    playRound(ZC);
    const totalTwo = ZC.Race.state.standings.reduce((a, s) => a + s.points, 0);
    expect(totalTwo).toBe(totalOne * 2);

    /* and the table stays sorted */
    const pts = ZC.Race.state.standings.map((s) => s.points);
    for (let i = 1; i < pts.length; i++) expect(pts[i - 1]).toBeGreaterThanOrEqual(pts[i]);
  });

  test('the score grows every round and the championship itself pays', () => {
    const { ZC } = fresh();
    ZC.Race.startCup({ autoDrive: true });
    let last = 0;
    for (let r = 0; r < ZC.Race.CUP.length; r++) {
      playRound(ZC);
      const st = ZC.Race.state;
      expect(st.cupScore).toBeGreaterThan(last);
      expect(st.roundResults.length).toBe(r + 1);
      last = st.cupScore;
      ZC.Race.advance();
    }
    const st = ZC.Race.state;
    expect(st.cupBonus).toBeGreaterThan(0);
    expect(st.cupScore).toBe(last + st.cupBonus);
    /* winning the cup must be worth more than losing it */
    expect(ZC.Race.CUP_BONUS[0]).toBeGreaterThan(
      ZC.Race.CUP_BONUS[ZC.Race.CUP_BONUS.length - 1]);
  });

  test('a fresh cup forgets the previous one', () => {
    const { ZC } = fresh();
    ZC.Race.startCup({ autoDrive: true });
    playRound(ZC);
    expect(ZC.Race.state.cupScore).toBeGreaterThan(0);
    ZC.Race.startCup({ autoDrive: true });
    expect(ZC.Race.state.cupScore).toBe(0);
    expect(ZC.Race.state.round).toBe(0);
    expect(ZC.Race.state.roundResults.length).toBe(0);
    expect(ZC.Race.state.standings.every((s) => s.points === 0)).toBe(true);
  });

  test('every circuit in the cup is a real, baked track', () => {
    const { ZC } = fresh();
    for (const id of ZC.Race.CUP) {
      const track = ZC.Tracks.get(id);
      expect(track).toBeTruthy();
      expect(track.count).toBeGreaterThan(100);
    }
  });
});
