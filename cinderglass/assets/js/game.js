/* =====================================================================
   CINDERGLASS — game.js
   State machine, the shift rules, scoring, save/continue and the
   leaderboard. Owns the integration between every other module.
   Owner: lead. See SPEC.md §4.
   ===================================================================== */
(function (global) {
  'use strict';

  var CG = global.CG || (global.CG = {});
  var MAT = CG.Materials;
  var L = CG.Levels;

  var GAME_ID = 'cinderglass';

  var G = CG.Game = {};

  /* Screens. `briefing` and the two end screens are modal DOM over a
     still-running simulation, so the chamber keeps breathing behind them. */
  var SCREEN = {
    MENU: 'menu',
    BRIEFING: 'briefing',
    PLAYING: 'playing',
    PAUSED: 'paused',
    CLEARED: 'cleared',
    FAILED: 'failed',
    RUN_OVER: 'runOver'
  };
  G.SCREEN = SCREEN;

  var canvas = null;

  G.state = {
    screen: SCREEN.MENU,
    contractIndex: 0,
    runScore: 0,
    combo: 0,
    sim: null,
    spec: null,
    ticks: 0,
    accumulator: 0,
    lastBreakdown: null,
    restartedThisContract: false
  };

  var runStats = { contracts: 0, delivered: 0, fuelBurnt: 0, bestContract: 0 };

  /* ------------------------------------------------------------------
     Scoring. See SPEC.md §4.

     `purity` means two different things depending on the contract, and
     pretending otherwise would be worse than admitting it: for a delivery
     you are judged on how much of what reached the crucible was the thing
     asked for, and for a casting there is nothing to mix, so you are
     judged on how far past quota you got instead.
     ------------------------------------------------------------------ */
  var BASE = 1000, MAX_PURITY = 500, MAX_SPEED = 750, MAX_THRIFT = 400;

  G.scoreContract = function (sim, spec, ticks) {
    var goalId = MAT.ID[spec.goal.material];
    var have = (spec.goal.kind === 'create') ? sim.count(goalId) : sim.absorbed[goalId];

    var purityFrac;
    if (spec.goal.kind === 'deliver') {
      purityFrac = sim.absorbedTotal > 0 ? (sim.absorbed[goalId] / sim.absorbedTotal) : 0;
    } else {
      /* overshoot: 50% above quota is a full score */
      purityFrac = CG.clamp01((have / spec.goal.amount - 1) / 0.5);
    }

    var speedFrac = CG.clamp01(spec.parTicks / Math.max(1, ticks));
    var thriftFrac = CG.clamp01(1 - sim.fuelUsed / Math.max(1, spec.fuel));

    var base = BASE;
    var purity = Math.round(MAX_PURITY * purityFrac);
    var speed = Math.round(MAX_SPEED * speedFrac);
    var thrift = Math.round(MAX_THRIFT * thriftFrac);
    var subtotal = base + purity + speed + thrift;
    var comboMult = 1 + 0.1 * G.state.combo;
    var total = Math.round(subtotal * comboMult);

    return {
      base: base, purity: purity, speed: speed, thrift: thrift,
      purityFrac: purityFrac, speedFrac: speedFrac, thriftFrac: thriftFrac,
      subtotal: subtotal, comboMult: comboMult, total: total,
      have: have, need: spec.goal.amount,
      purityLabel: spec.goal.kind === 'deliver' ? 'Purity' : 'Yield'
    };
  };

  /* ------------------------------------------------------------------
     Contract lifecycle
     ------------------------------------------------------------------ */
  function loadContract(index) {
    var st = G.state;
    st.contractIndex = index;
    st.sim = L.build(index);
    st.spec = st.sim.spec;
    st.ticks = 0;
    st.accumulator = 0;
    CG.Render.setSim(st.sim);
    if (CG.Particles && CG.Particles.reset) CG.Particles.reset();
    CG.emit('contract:load', st.spec);
  }

  G.startRun = function (fromIndex) {
    var st = G.state;
    st.runScore = 0;
    st.combo = 0;
    st.restartedThisContract = false;
    runStats = { contracts: 0, delivered: 0, fuelBurnt: 0, bestContract: 0 };
    loadContract(fromIndex || 0);
    setScreen(SCREEN.BRIEFING);
  };

  G.beginContract = function () {
    setScreen(SCREEN.PLAYING);
    if (CG.Audio && CG.Audio.resume) CG.Audio.resume();
  };

  G.restartContract = function () {
    var st = G.state;
    st.restartedThisContract = true;
    st.combo = 0;
    loadContract(st.contractIndex);
    setScreen(SCREEN.PLAYING);
  };

  G.nextContract = function () {
    var st = G.state;
    var next = st.contractIndex + 1;
    if (next >= L.count()) { endRun('Every contract on the board, cleared.'); return; }
    st.restartedThisContract = false;
    loadContract(next);
    saveProgress();
    setScreen(SCREEN.BRIEFING);
  };

  function completeContract() {
    var st = G.state;
    var b = G.scoreContract(st.sim, st.spec, st.ticks);
    st.lastBreakdown = b;
    st.runScore += b.total;
    st.combo = st.restartedThisContract ? 0 : st.combo + 1;
    runStats.contracts++;
    runStats.delivered += b.have;
    runStats.fuelBurnt += st.sim.fuelUsed;
    if (b.total > runStats.bestContract) runStats.bestContract = b.total;
    setScreen(SCREEN.CLEARED);
    if (CG.Audio && CG.Audio.sfx) CG.Audio.sfx('clear');
  }

  function failContract() {
    G.state.combo = 0;
    setScreen(SCREEN.FAILED);
    if (CG.Audio && CG.Audio.sfx) CG.Audio.sfx('fail');
  }

  function endRun(reason) {
    G.state.endReason = reason || '';
    clearSave();
    setScreen(SCREEN.RUN_OVER);
    submitScore(G.state.runScore);
  }
  G.endRun = endRun;

  G.retireRun = function () {
    endRun('You closed the books early. The score stands.');
  };

  function setScreen(s) {
    G.state.screen = s;
    CG.emit('screen', s);
  }
  G.setScreen = setScreen;

  G.togglePause = function () {
    var st = G.state;
    if (st.screen === SCREEN.PLAYING) setScreen(SCREEN.PAUSED);
    else if (st.screen === SCREEN.PAUSED) setScreen(SCREEN.PLAYING);
  };

  /* ------------------------------------------------------------------
     The tick
     ------------------------------------------------------------------ */
  function applyBrush(sim, spec) {
    var I = CG.Input;
    if (!I.brush.down) return;

    var cell = CG.Render.toCell(I.brush.x, I.brush.y);
    /* off the chamber entirely — the HUD lives out there */
    if (cell.x < -2 || cell.y < -2 || cell.x > sim.W + 2 || cell.y > sim.H + 2) return;

    var torch = I.effectiveTool() === CG.TOOL_TORCH;
    if (torch && sim.fuelUsed >= spec.fuel) {
      CG.emit('fuel:empty');
      return;
    }
    sim.paintHeat(cell.x, cell.y, I.radius(), torch ? +1 : -1);
    if (CG.Particles && CG.Particles.brush) {
      CG.Particles.brush(cell.x, cell.y, I.radius(), torch);
    }
  }

  function update(dt) {
    var st = G.state;

    if (CG.Input.pressed('pause')) { CG.Input.consume('pause'); G.togglePause(); }
    if (CG.Input.pressed('mute')) {
      CG.Input.consume('mute');
      if (CG.Audio && CG.Audio.toggleMute) CG.Audio.toggleMute();
    }

    if (st.screen !== SCREEN.PLAYING || !st.sim) return;

    if (CG.Input.pressed('restart')) { CG.Input.consume('restart'); G.restartContract(); return; }

    var sim = st.sim, spec = st.spec;

    /* Fixed 60Hz simulation, decoupled from the frame rate. Catch-up is
       capped: on a stall it is right to drop simulated time rather than
       spend the next frame trying to make it up and stalling again. */
    st.accumulator += dt;
    var steps = 0;
    while (st.accumulator >= CG.TICK_DT && steps < CG.MAX_CATCHUP) {
      st.accumulator -= CG.TICK_DT;
      applyBrush(sim, spec);
      sim.step();
      st.ticks++;
      steps++;
    }
    if (st.accumulator > CG.TICK_DT * CG.MAX_CATCHUP) st.accumulator = 0;

    if (CG.Particles && CG.Particles.update) CG.Particles.update(sim, dt);
    if (CG.Audio && CG.Audio.update) CG.Audio.update(sim, dt);

    if (L.isComplete(sim, spec)) { completeContract(); return; }
    if (st.ticks >= spec.hardTicks) { failContract(); return; }
  }

  /* Measure the HUD strips rather than guessing them. The dock shrinks
     through three breakpoints, so a hardcoded height either overlaps the
     controls on a small screen or strands the chamber high on a tall one.
     Cached per resize: offsetHeight forces layout, and this runs every
     frame. */
  var padTop = 64, padBottom = 108, padsDirty = true;
  function measurePads() {
    if (!padsDirty) return;
    padsDirty = false;
    var top = document.querySelector('.cg-top');
    var dock = document.querySelector('.cg-dock');
    if (top && top.offsetHeight) padTop = top.offsetHeight + 6;
    if (dock && dock.offsetHeight) padBottom = dock.offsetHeight + 6;
  }
  G.invalidatePads = function () { padsDirty = true; };

  function render(dt) {
    var st = G.state;
    measurePads();
    CG.Render.layout(Math.round(padTop * CG.dpr()), Math.round(padBottom * CG.dpr()));
    CG.Render.draw(CG.now() / 1000, CG.Loop.frame);
    if (CG.UI && CG.UI.frame) CG.UI.frame(st);
    adaptQuality();
  }

  /* Drop effects before dropping frames. The simulation is the thing that
     must not slow down; bloom is not. */
  var qualityCooldown = 0;
  function adaptQuality() {
    qualityCooldown--;
    if (qualityCooldown > 0) return;
    var ms = CG.Loop.msAvg;
    if (ms > 26 && CG.quality.tier > 0) {
      CG.quality.tier--;
      CG.quality.bloom = CG.quality.tier > 0;
      CG.quality.heatHaze = CG.quality.tier >= 2;
      qualityCooldown = 240;
    } else if (ms < 15 && CG.quality.tier < 2) {
      CG.quality.tier++;
      CG.quality.bloom = true;
      qualityCooldown = 600;
    }
  }

  /* ------------------------------------------------------------------
     Leaderboard
     ------------------------------------------------------------------ */
  async function submitScore(score) {
    if (!score || score <= 0) return;
    if (global.location && global.location.protocol === 'file:') return;
    try {
      var res = await fetch('/api/leaderboard/rank?gameId=' + encodeURIComponent(GAME_ID) +
        '&score=' + encodeURIComponent(score), { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      var data = await res.json();
      var rank = Number(data && data.rank);
      if (!isFinite(rank) || rank <= 0 || rank > 20) return;

      var name = await CG.UI.prompt({
        title: 'Top 20 Shift',
        body: 'You placed <b>#' + rank + '</b> with <b>' + CG.fmtNum(score) + '</b>. Sign the ledger.',
        placeholder: 'Your name',
        maxLength: 20
      });
      if (name == null) return;
      name = String(name).trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
      if (!name) return;
      await fetch('/api/leaderboard/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: GAME_ID, name: name, score: score })
      });
      CG.UI.toast('🏆 Submitted — rank #' + rank, 2800);
    } catch (e) { /* offline: ignore */ }
  }

  /* ------------------------------------------------------------------
     Save / continue — between contracts only. A shift in progress is not
     saved: half a melted chamber is not a state worth restoring.
     ------------------------------------------------------------------ */
  function saveProgress() {
    CG.store.set('save', {
      v: 1,
      contractIndex: G.state.contractIndex,
      runScore: G.state.runScore,
      combo: G.state.combo,
      stats: runStats,
      at: Date.now()
    });
  }
  function clearSave() { CG.store.del('save'); }

  G.hasSave = function () {
    var s = CG.store.get('save', null);
    return !!(s && s.v === 1 && s.contractIndex > 0 && s.contractIndex < L.count());
  };
  G.resumeRun = function () {
    var s = CG.store.get('save', null);
    if (!s) { G.startRun(0); return; }
    G.state.runScore = s.runScore || 0;
    G.state.combo = s.combo || 0;
    runStats = s.stats || runStats;
    G.state.restartedThisContract = false;
    loadContract(CG.clamp(s.contractIndex | 0, 0, L.count() - 1));
    setScreen(SCREEN.BRIEFING);
  };

  G.stats = function () { return runStats; };
  G.best = function () { return CG.store.get('best', 0); };
  function recordBest(score) {
    if (score > G.best()) CG.store.set('best', score);
  }
  CG.on('screen', function (s) {
    if (s === SCREEN.RUN_OVER) recordBest(G.state.runScore);
  });

  /* Progress for the HUD, recomputed once per frame rather than per cell. */
  G.progress = function () {
    var st = G.state;
    if (!st.sim || !st.spec) return { have: 0, need: 1, frac: 0 };
    return L.progress(st.sim, st.spec);
  };
  G.fuelFrac = function () {
    var st = G.state;
    if (!st.sim || !st.spec) return 1;
    return CG.clamp01(1 - st.sim.fuelUsed / st.spec.fuel);
  };
  G.shiftFrac = function () {
    var st = G.state;
    if (!st.spec) return 0;
    return CG.clamp01(st.ticks / st.spec.hardTicks);
  };

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function resize() {
    if (!canvas) return;
    var dpr = CG.dpr();
    var w = Math.max(1, Math.round(global.innerWidth * dpr));
    var h = Math.max(1, Math.round(global.innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    canvas.style.width = global.innerWidth + 'px';
    canvas.style.height = global.innerHeight + 'px';
  }

  G.boot = function () {
    canvas = document.getElementById('cg-canvas');
    if (!canvas) { console.error('[CG] no canvas'); return; }

    resize();
    CG.Input.init(canvas);
    CG.Render.init(canvas);
    if (CG.Audio && CG.Audio.init) CG.Audio.init();
    if (CG.Particles && CG.Particles.init) CG.Particles.init();
    if (CG.UI && CG.UI.init) CG.UI.init(document.getElementById('cg-ui'));
    G.invalidatePads();

    /* start the brush in the middle so a keyboard player has something
       to steer before they touch the mouse */
    CG.Input.brush.x = canvas.width / 2;
    CG.Input.brush.y = canvas.height / 2;

    global.addEventListener('resize', function () { resize(); G.invalidatePads(); });
    global.addEventListener('orientationchange', function () {
      setTimeout(function () { resize(); G.invalidatePads(); }, 120);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && G.state.screen === SCREEN.PLAYING) G.togglePause();
    });

    /* A chamber to look at behind the menu, rather than an empty screen. */
    loadContract(0);
    setScreen(SCREEN.MENU);

    CG.Loop.start(update, render);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', G.boot);
  } else {
    G.boot();
  }

})(window);
