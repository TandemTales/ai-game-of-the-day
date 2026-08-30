/* =====================================================================
   ZEPHYR CIRCUIT — race.js
   The race state machine, the fixed-step loop, placement and scoring.
   Owner: lead. See SPEC.md §3.

   This is the integration point: it owns the karts and advances them.
   The renderer reads this and never writes to it.
   ===================================================================== */
(function (global) {
  'use strict';

  var ZC = global.ZC || (global.ZC = {});
  var T = ZC.Track;
  var R = ZC.Race = {};

  var GAME_ID = 'zephyr-circuit';

  var PHASE = R.PHASE = {
    ATTRACT: 'attract',
    GRID: 'grid',
    COUNTDOWN: 'countdown',
    RACING: 'racing',
    FINISHED: 'finished',
    RESULTS: 'results',
    /* the standings after the last round — the run's actual ending, and
       the only place a score is submitted */
    CUP: 'cup'
  };

  /* The cup is the run. A single race is not a score worth putting on a
     leaderboard: one bad Squall in the last corner would decide it, and
     the whole point of the item game is that one bad Squall CAN. Three
     circuits, championship points carried between them, is what makes the
     rubber band fair — it gives a good driver enough rounds for skill to
     out-vote luck, which is exactly why every kart racer is scored this
     way and none of them are scored on a single race. */
  R.CUP = ['gullwing-bay', 'thermal-spire', 'cirrus-run'];

  R.FIELD = 8;
  R.POINTS = [15, 12, 10, 8, 6, 4, 2, 1];

  /* Placeholder roster. agent-models will give these shells and liveries;
     the names and colours are the identity the HUD hangs on. */
  var ROSTER = R.ROSTER = [
    { id: 'kestrel',  name: 'Kestrel',  colour: 0xff7a2f, skill: 0.86 },
    { id: 'mantis',   name: 'Mantis',   colour: 0x7ee08a, skill: 0.80 },
    { id: 'cobalt',   name: 'Cobalt',   colour: 0x5aa9ff, skill: 0.76 },
    { id: 'ember',    name: 'Ember',    colour: 0xff4d5e, skill: 0.72 },
    { id: 'saffron',  name: 'Saffron',  colour: 0xffc94a, skill: 0.68 },
    { id: 'thistle',  name: 'Thistle',  colour: 0xb98cff, skill: 0.64 },
    { id: 'pewter',   name: 'Pewter',   colour: 0xc8ccd4, skill: 0.60 },
    { id: 'moss',     name: 'Moss',     colour: 0x4fbfa8, skill: 0.56 }
  ];

  R.state = {
    phase: PHASE.ATTRACT,
    trackIndex: 0,
    track: null,
    karts: [],
    player: null,
    brains: [],
    time: 0,
    countdown: 0,
    accumulator: 0,
    cupScore: 0,
    leaderboardFlowStarted: false,
    results: null,

    /* cup progress */
    round: 0,            // 0-based index into R.CUP
    standings: null,     // [{ id, name, colour, points, best }] , sorted
    roundResults: []     // one scoreRace() per completed round
  };

  var COUNTDOWN_SECONDS = 3.2;

  /* ------------------------------------------------------------------
     Setup
     ------------------------------------------------------------------ */
  R.load = function (trackIndex, opts) {
    opts = opts || {};
    var st = R.state;
    st.trackIndex = trackIndex;
    st.track = ZC.Tracks.get(trackIndex);
    st.time = 0;
    st.accumulator = 0;
    st.results = null;

    /* Seed from the track so a race is reproducible, which is what makes
       the AI's opening laps identical between two runs of a test. */
    ZC.setSeed(ZC.hashStr(st.track.id) ^ (opts.seed || 0));

    st.karts = [];
    st.brains = [];
    var playerIndex = opts.playerIndex === undefined ? R.FIELD - 1 : opts.playerIndex;

    for (var i = 0; i < R.FIELD; i++) {
      var spec = ROSTER[i % ROSTER.length];
      var kart = ZC.Kart.create({
        id: spec.id, name: spec.name, colour: spec.colour,
        isPlayer: (i === playerIndex)
      });
      ZC.Kart.placeOnGrid(kart, st.track, i, R.FIELD);
      kart.place = i + 1;
      st.karts.push(kart);
      /* Every kart gets a brain, the player's included: attract mode
         drives the player too, and a null here is a crash waiting for the
         first time anyone opens the menu. */
      st.brains.push(ZC.AI.makeBrain({ skill: spec.skill }));
      if (kart.isPlayer) st.player = kart;
    }

    /* Item boxes are laid out from the baked centreline, so they land on
       the tarmac on any circuit without being authored per track.
       `opts.items === false` races a clean field — the AI-skill-order
       test needs that, because items are a rubber band and their whole
       job is to stop the fastest driver simply winning. */
    st.items = ZC.Items ? ZC.Items.createState(st.track) : null;
    if (st.items) st.items.enabled = opts.items !== false;

    /* Two separate things that used to be one flag.

       `attract` is the menu background: the AI drives everybody AND the
       race never resolves, because a menu that stops after three laps is
       not a background. `autoDrive` is the AI driving everybody through a
       REAL race that starts, finishes and scores — which is what a
       headless test of the cup needs, and what the screenshot harness
       wants. Conflating them meant a cup could never reach its own
       standings screen without a human holding the throttle. */
    st.attractMode = !!opts.attract || !!opts.autoDrive;
    st.phase = opts.attract ? PHASE.ATTRACT : PHASE.GRID;
    st.countdown = COUNTDOWN_SECONDS;
    ZC.emit('race:load', st);
    return st;
  };

  R.beginCountdown = function () {
    R.state.phase = PHASE.COUNTDOWN;
    R.state.countdown = COUNTDOWN_SECONDS;
    ZC.emit('race:countdown', R.state);
  };

  R.restart = function () { R.load(R.state.trackIndex); R.beginCountdown(); };

  /* ------------------------------------------------------------------
     The cup
     ------------------------------------------------------------------ */

  /* Start a fresh cup at round 1. Championship points start empty, and
     every racer in the roster gets a row whether or not they score. */
  R.startCup = function (opts) {
    var st = R.state;
    st.round = 0;
    st.cupScore = 0;
    st.leaderboardFlowStarted = false;
    st.roundResults = [];
    st.standings = ROSTER.slice(0, R.FIELD).map(function (spec) {
      return { id: spec.id, name: spec.name, colour: spec.colour, points: 0, best: 0 };
    });
    st.cupOpts = opts || {};
    R.load(R.CUP[0], st.cupOpts);
    ZC.emit('cup:start', st);
    return st;
  };

  R.roundCount = function () { return R.CUP.length; };
  R.isLastRound = function () { return R.state.round >= R.CUP.length - 1; };

  /* Move to the next circuit, keeping the standings. Returns false when
     the cup is over — the caller shows the standings instead. */
  R.nextRound = function (opts) {
    var st = R.state;
    if (R.isLastRound()) return false;
    st.round++;
    /* the same options all the way through: a cup started under AI
       control must stay under AI control on round two */
    R.load(R.CUP[st.round], opts || st.cupOpts || {});
    ZC.emit('cup:round', st);
    return true;
  };

  function standingFor(st, id) {
    if (!st.standings) return null;
    for (var i = 0; i < st.standings.length; i++) {
      if (st.standings[i].id === id) return st.standings[i];
    }
    return null;
  }
  R.standingFor = standingFor;

  /* Award championship points for the round just finished and re-sort. */
  function awardPoints(st) {
    if (!st.standings) return;
    var order = _order;
    for (var i = 0; i < order.length; i++) {
      var row = standingFor(st, order[i].id);
      if (!row) continue;
      row.points += R.POINTS[ZC.clamp(i, 0, R.POINTS.length - 1)];
      if (order[i].bestLap > 0 && (!row.best || order[i].bestLap < row.best)) {
        row.best = order[i].bestLap;
      }
    }
    st.standings.sort(function (a, b) { return b.points - a.points; });
  }

  /* ------------------------------------------------------------------
     Placement — laps first, then distance round. Recomputed once a tick,
     not once a frame.
     ------------------------------------------------------------------ */
  var _order = [];
  function updatePlaces(st) {
    _order.length = 0;
    for (var i = 0; i < st.karts.length; i++) _order.push(st.karts[i]);
    _order.sort(function (a, b) {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      return b.progress - a.progress;
    });
    for (i = 0; i < _order.length; i++) _order[i].place = i + 1;
    return _order;
  }
  R.order = function () { return _order; };

  /* ------------------------------------------------------------------
     One fixed step of the whole field.
     ------------------------------------------------------------------ */
  var IDLE_INPUT = { throttle: 0, brake: 0, steer: 0, drift: false, item: false };

  function stepField(st, dt) {
    var i, j;
    var racing = (st.phase === PHASE.RACING || st.phase === PHASE.FINISHED ||
                  st.phase === PHASE.ATTRACT);

    for (i = 0; i < st.karts.length; i++) {
      var kart = st.karts[i];
      var input;
      if (!racing) {
        input = IDLE_INPUT;
      } else if (kart.isPlayer && !st.attractMode) {
        input = ZC.Input.state;
      } else {
        input = ZC.AI.drive(kart, st.brains[i], st.track, st.time);
      }
      ZC.Kart.step(kart, input, st.track, dt);
    }

    /* nudge overlapping karts apart — never a physical collision, because
       a realistic impact at the back of an eight-kart grid is
       unrecoverable and no fun */
    for (i = 0; i < st.karts.length; i++) {
      for (j = i + 1; j < st.karts.length; j++) {
        ZC.Kart.separate(st.karts[i], st.karts[j]);
      }
    }

    updatePlaces(st);

    /* Items run after placement, because the roulette is weighted by
       position and a kart that has just taken the lead should be drawing
       a leader's odds. */
    if (racing && st.items && ZC.Items) {
      ZC.Items.step(st.items, st.karts, st.track, dt, st.time);
      ZC.Items.aiStep(st.items, st.karts, st.track, st.time, isAIDriven);
      if (st.player && !st.attractMode) {
        ZC.Items.playerStep(st.items, st.player, st.karts, st.track,
          ZC.Input.state.item);
      }
    }
  }

  /* Who the computer is driving. In attract mode that is everybody. */
  function isAIDriven(kart) {
    return !kart.isPlayer || R.state.attractMode;
  }

  R.update = function (dt) {
    var st = R.state;
    if (!st.track) return;

    if (st.phase === PHASE.COUNTDOWN) {
      st.countdown -= dt;
      if (st.countdown <= 0) {
        st.phase = PHASE.RACING;
        st.time = 0;
        ZC.emit('race:go', st);
      }
    }

    if (st.phase === PHASE.RACING || st.phase === PHASE.FINISHED ||
        st.phase === PHASE.ATTRACT) {
      st.time += dt;
    }

    /* Fixed-step simulation, decoupled from the frame rate. Catch-up is
       capped: on a stall it is right to drop simulated time rather than
       spend the next frame trying to make it up and stalling again. */
    st.accumulator += dt;
    var steps = 0;
    while (st.accumulator >= ZC.STEP_DT && steps < ZC.MAX_CATCHUP) {
      st.accumulator -= ZC.STEP_DT;
      stepField(st, ZC.STEP_DT);
      steps++;
    }
    if (st.accumulator > ZC.STEP_DT * ZC.MAX_CATCHUP) st.accumulator = 0;

    if (st.phase === PHASE.RACING && st.player && st.player.finished) {
      st.phase = PHASE.FINISHED;
      ZC.emit('race:playerFinished', st);
    }
    if (st.phase === PHASE.FINISHED && allDone(st)) finish(st);
  };

  function allDone(st) {
    for (var i = 0; i < st.karts.length; i++) if (!st.karts[i].finished) return false;
    return true;
  }

  /* ------------------------------------------------------------------
     Scoring. See SPEC.md §3.
     ------------------------------------------------------------------ */
  R.scoreRace = function (st) {
    var p = st.player;
    var place = p.place;
    var points = R.POINTS[ZC.clamp(place - 1, 0, R.POINTS.length - 1)];

    /* time bonus against the circuit's par, capped so a heroic lap cannot
       out-earn actually winning */
    var par = st.track.parTime;
    var timeFrac = ZC.clamp01((par - p.finishTime) / (par * 0.35));
    var timeBonus = Math.round(500 * timeFrac);

    var cleanBonus = p.falls === 0 ? 200 : 0;

    var fastest = Infinity;
    for (var i = 0; i < st.karts.length; i++) {
      var b = st.karts[i].bestLap;
      if (b > 0 && b < fastest) fastest = b;
    }
    var bestLapBonus = (p.bestLap > 0 && p.bestLap <= fastest) ? 100 : 0;

    return {
      place: place, points: points,
      timeBonus: timeBonus, cleanBonus: cleanBonus, bestLapBonus: bestLapBonus,
      finishTime: p.finishTime, bestLap: p.bestLap, falls: p.falls,
      total: points * 40 + timeBonus + cleanBonus + bestLapBonus
    };
  };

  function finish(st) {
    st.results = R.scoreRace(st);
    st.cupScore += st.results.total;
    st.roundResults.push(st.results);
    awardPoints(st);
    st.phase = PHASE.RESULTS;
    ZC.emit('race:results', st);
  }

  /* Called by the UI from the round-results screen. Either sets up the
     next circuit or ends the cup. */
  R.advance = function () {
    var st = R.state;
    if (R.nextRound()) {
      st.phase = PHASE.GRID;
      return true;
    }
    /* The championship itself is worth something, or the cup would just
       be three scores added up and the standings table would be
       decoration. */
    st.cupBonus = R.CUP_BONUS[ZC.clamp(R.cupPlace() - 1, 0, R.CUP_BONUS.length - 1)];
    st.cupScore += st.cupBonus;
    st.phase = PHASE.CUP;
    ZC.emit('cup:end', st);
    return false;
  };

  R.CUP_BONUS = [1200, 800, 600, 400, 250, 150, 80, 40];

  /* Where the player finished the championship, 1-based. */
  R.cupPlace = function () {
    var st = R.state;
    if (!st.standings || !st.player) return 0;
    for (var i = 0; i < st.standings.length; i++) {
      if (st.standings[i].id === st.player.id) return i + 1;
    }
    return 0;
  };
  R.forceFinish = function () { finish(R.state); };

  /* ------------------------------------------------------------------
     Leaderboard
     ------------------------------------------------------------------ */
  R.submitScore = async function (score) {
    if (!score || score <= 0 || R.state.leaderboardFlowStarted) return;
    /* The final screen may be requested by more than one UI path. Claim
       the flow before its first await so only one rank check can ever open
       the name prompt or submit this cup. */
    R.state.leaderboardFlowStarted = true;
    try {
      var res = await fetch('/api/leaderboard/rank?gameId=' + encodeURIComponent(GAME_ID) +
        '&score=' + encodeURIComponent(score), { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      var data = await res.json();
      var rank = Number(data && data.rank);
      if (!isFinite(rank) || rank <= 0 || rank > 20) return;

      var name = await ZC.UI.prompt({
        title: 'Top 20 Cup',
        body: 'You placed <b>#' + rank + '</b> with <b>' + ZC.fmtNum(score) + '</b>. Sign the board.',
        placeholder: 'Your name', maxLength: 20
      });
      if (name == null) return;
      name = String(name).trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
      if (!name) return;
      await fetch('/api/leaderboard/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: GAME_ID, name: name, score: score })
      });
      ZC.UI.toast('🏆 Submitted — rank #' + rank, 2800);
    } catch (e) { /* offline: ignore */ }
  };

  R.best = function () { return ZC.store.get('best', 0); };
  R.recordBest = function (score) { if (score > R.best()) ZC.store.set('best', score); };

})(window);
