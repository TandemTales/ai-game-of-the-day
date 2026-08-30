/* =====================================================================
   STORMHOOK — game.js   [OWNER: lead]

   The integration layer: state machine, the fixed-step driver, scoring
   (SPEC §8), level progression, and the leaderboard.

   Scoring lives here and only here. Physics reports events; this file
   decides what they are worth.
   ===================================================================== */
(function (global) {
  'use strict';

  var SH = global.SH || (global.SH = {});
  var G = SH.Game = {};

  var GAME_ID = 'stormhook';
  var FIXED_DT = 1 / 120;
  var MAX_STEPS = 8;                  // never spiral-of-death on a slow frame

  G.state = {
    phase: 'boot',                    // boot|title|playing|clear|gameover|paused
    levelIndex: 0,
    runScore: 0,
    levelScore: 0,
    deaths: 0,
    bestCombo: 1,
    coresTotal: 0,
    submitted: false
  };
  G.world = null;

  var acc = 0;
  var canvas = null;
  var clearTimer = 0;
  var deathTimer = 0;

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(global.location.search || '');
    return m ? decodeURIComponent(m[1]) : null;
  }

  G.init = function () {
    canvas = global.document.getElementById('sh-canvas');
    if (!canvas) throw new Error('stormhook: #sh-canvas missing');

    SH.setSeed(0x5701c0de);
    if (SH.Textures && SH.Textures.init) SH.Textures.init();
    if (SH.Particles && SH.Particles.init) SH.Particles.init();
    if (SH.Audio && SH.Audio.init) SH.Audio.init();
    SH.Render.init(canvas);
    if (SH.UI && SH.UI.init) SH.UI.init();
    SH.Input.attach(canvas);

    global.addEventListener('resize', function () { SH.Render.resize(); });
    global.addEventListener('orientationchange', function () {
      global.setTimeout(function () { SH.Render.resize(); }, 120);
    });

    SH.on('key', onKey);

    var lv = parseInt(qs('level'), 10);
    var start = (isFinite(lv) && lv >= 1) ? Math.min(lv, SH.Levels.count()) - 1 : 0;

    if (qs('auto') === '1') {
      G.startRun(start);
    } else {
      G.state.levelIndex = start;
      setPhase('title');
    }

    SH.Loop.start(update, render);
  };

  function setPhase(p) {
    G.state.phase = p;
    if (SH.UI && SH.UI.setScreen) SH.UI.setScreen(p);
    SH.emit('phase', p);
  }
  G.setPhase = setPhase;

  function onKey(k) {
    var st = G.state;
    if (k === 'm') { if (SH.Audio && SH.Audio.toggleMuted) SH.Audio.toggleMuted(); return; }
    if (st.phase === 'title') {
      if (k === 'enter' || k === 'space') G.startRun(st.levelIndex);
      return;
    }
    if (st.phase === 'playing' || st.phase === 'paused') {
      if (k === 'p' || k === 'escape') G.togglePause();
      if (k === 'r') G.restartLevel();
      return;
    }
    if (st.phase === 'gameover' && (k === 'enter' || k === 'space')) G.startRun(0);
  }

  /* ------------------------------------------------------------------
     Run / level lifecycle
     ------------------------------------------------------------------ */
  G.startRun = function (levelIndex) {
    var st = G.state;
    st.levelIndex = levelIndex || 0;
    st.runScore = 0;
    st.levelScore = 0;
    st.deaths = 0;
    st.bestCombo = 1;
    st.coresTotal = 0;
    st.submitted = false;
    loadLevel(st.levelIndex);
    setPhase('playing');
    if (SH.Audio && SH.Audio.music) SH.Audio.music('run');
  };

  function loadLevel(i) {
    G.world = SH.Physics.makeWorld(i);
    G.state.levelScore = 0;
    acc = 0; clearTimer = 0; deathTimer = 0;
    SH.Input.reset();
    if (SH.Render.onLevel) SH.Render.onLevel(G.world);
    if (SH.Particles && SH.Particles.clear) SH.Particles.clear();
    SH.emit('level', G.world);
  }

  G.restartLevel = function () {
    loadLevel(G.state.levelIndex);
    setPhase('playing');
  };

  G.nextLevel = function () {
    var st = G.state;
    if (st.levelIndex + 1 >= SH.Levels.count()) { endRun(); return; }
    st.levelIndex++;
    loadLevel(st.levelIndex);
    setPhase('playing');
  };

  G.togglePause = function () {
    if (G.state.phase === 'playing') setPhase('paused');
    else if (G.state.phase === 'paused') setPhase('playing');
  };

  function endRun() {
    setPhase('gameover');
    if (SH.Audio && SH.Audio.music) SH.Audio.music('end');
    var best = SH.store.get('best', 0);
    if (G.state.runScore > best) SH.store.set('best', G.state.runScore);
    submitScore(G.state.runScore);
  }
  G.endRun = endRun;

  /* ------------------------------------------------------------------
     Scoring — SPEC §8. Nothing else in the codebase computes score.
     ------------------------------------------------------------------ */
  function addScore(n) {
    n = Math.round(n);
    G.state.levelScore += n;
    G.state.runScore += n;
    return n;
  }

  function drainEvents(w) {
    var st = G.state;
    for (var i = 0; i < w.pending.length; i++) {
      var e = w.pending[i];
      switch (e.type) {
        case 'core':
          st.coresTotal++;
          st.bestCombo = Math.max(st.bestCombo, e.combo);
          var got = addScore(SH.TUNE.coreValue * e.combo);
          if (SH.Particles.burst) SH.Particles.burst('core', e.x, e.y, { combo: e.combo });
          if (SH.UI.popScore) SH.UI.popScore(e.x, e.y, got, e.combo);
          if (SH.Audio.sfx) SH.Audio.sfx('core', { combo: e.combo });
          break;
        case 'hookHit':
          if (SH.Particles.burst) SH.Particles.burst('latch', e.x, e.y);
          if (SH.Audio.sfx) SH.Audio.sfx('latch');
          break;
        case 'hookMiss':
          if (SH.Audio.sfx) SH.Audio.sfx('miss');
          break;
        case 'hookRelease':
          if (SH.Audio.sfx) SH.Audio.sfx('release');
          break;
        case 'dash':
          if (SH.Particles.burst) SH.Particles.burst('dash', e.x, e.y, { dx: e.dx, dy: e.dy });
          if (SH.Audio.sfx) SH.Audio.sfx('dash');
          break;
        case 'comboBreak':
          if (e.at > SH.TUNE.comboAirTime * 3 && SH.Audio.sfx) SH.Audio.sfx('comboBreak');
          break;
        case 'clear':
          onClear(w);
          break;
        case 'death':
          onDeath(w, e);
          break;
      }
    }
    w.pending.length = 0;
  }

  function onClear(w) {
    /* SPEC §8 rule 3. */
    var bonus = SH.TUNE.beaconBonus +
                Math.max(0, Math.round((w.level.parTime - w.time) * 100));
    addScore(bonus);
    clearTimer = 0;
    G.lastClear = {
      bonus: bonus,
      time: w.time,
      par: w.level.parTime,
      cores: w.cores_taken,
      coresMax: w.cores.length,
      levelScore: G.state.levelScore
    };
    setPhase('clear');
    if (SH.Particles.burst) SH.Particles.burst('clear', w.beacon.x, w.beacon.y);
    if (SH.Audio.sfx) SH.Audio.sfx('clear');
  }

  function onDeath(w, e) {
    /* SPEC §8 rule 4: the level restarts; run score is kept. */
    G.state.deaths++;
    deathTimer = 0;
    if (SH.Particles.burst) SH.Particles.burst('death', e.x, e.y, { cause: e.cause });
    if (SH.Audio.sfx) SH.Audio.sfx('death', { cause: e.cause });
    if (SH.UI.toast) {
      SH.UI.toast(e.cause === 'storm' ? 'The front took you'
                : e.cause === 'hazard' ? 'Slag'
                : 'Lost to the deep', 1400);
    }
  }

  /* ------------------------------------------------------------------
     Frame
     ------------------------------------------------------------------ */
  function update(dt) {
    var st = G.state, w = G.world;

    if (SH.Particles && SH.Particles.update) SH.Particles.update(dt);
    if (SH.UI && SH.UI.update) SH.UI.update(dt);

    if (st.phase === 'playing' && w) {
      SH.Input.beginFrame();

      /* The aim point is a world position under the cursor/finger. */
      var aw = SH.Render.worldFromScreen(SH.Input.aim.x, SH.Input.aim.y);
      SH.Input.aimWorld.x = aw.x; SH.Input.aimWorld.y = aw.y;
      w.aim.x = aw.x; w.aim.y = aw.y;

      acc += dt;
      var steps = 0;
      while (acc >= FIXED_DT && steps < MAX_STEPS) {
        SH.Physics.step(w, SH.Input, FIXED_DT);
        acc -= FIXED_DT;
        steps++;
        /* One-shot edges must not fire on every substep of the frame. */
        SH.Input.hookPressed = false;
        SH.Input.hookReleased = false;
        SH.Input.dashPressed = false;
        if (w.dead || w.cleared) break;
      }
      if (steps >= MAX_STEPS) acc = 0;

      drainEvents(w);
      SH.Input.endFrame();

      if (w.dead) {
        deathTimer += dt;
        if (deathTimer > 1.0) G.restartLevel();
      }
    } else if (st.phase === 'clear') {
      clearTimer += dt;
      if (w) drainEvents(w);
    } else if (w) {
      drainEvents(w);
    }

    if (SH.Render.update) SH.Render.update(dt, w, st);
  }

  function render() {
    SH.Render.draw(G.world, G.state);
    if (SH.UI && SH.UI.hud) SH.UI.hud(G.world, G.state);
  }

  /* Advance past the clear screen. UI calls this from its button; the
     keyboard path goes through onKey. */
  G.continueFromClear = function () {
    if (G.state.phase !== 'clear') return;
    G.nextLevel();
  };
  SH.on('key', function (k) {
    if (G.state.phase === 'clear' && (k === 'enter' || k === 'space')) G.continueFromClear();
  });

  /* ------------------------------------------------------------------
     Leaderboard. The only two network calls in the game.
     ------------------------------------------------------------------ */
  async function submitScore(score) {
    if (G.state.submitted) return;
    G.state.submitted = true;
    score = Math.round(score);
    if (!(score > 0)) return;
    try {
      var res = await fetch('/api/leaderboard/rank?gameId=' + encodeURIComponent(GAME_ID) +
                            '&score=' + encodeURIComponent(score),
                            { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      var data = await res.json();
      var rank = Number(data && data.rank);
      if (!isFinite(rank) || rank <= 0 || rank > 20) return;

      var name = await SH.UI.prompt({
        title: 'Top 20 Salvage',
        body: 'You placed <b>#' + rank + '</b> with <b>' + SH.fmtNum(score) + '</b>. Sign the manifest.',
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
      if (SH.UI.toast) SH.UI.toast('🏆 Submitted — rank #' + rank, 2800);
    } catch (e) { /* offline: the game does not care */ }
  }
  G.submitScore = submitScore;

  /* ------------------------------------------------------------------ */
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () { G.init(); });
    } else {
      G.init();
    }
  }

})(typeof window !== 'undefined' ? window : this);
