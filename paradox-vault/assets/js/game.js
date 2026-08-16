/* =====================================================================
   PARADOX VAULT — game.js
   World assembly, the fixed-step simulation, the loop/rewind rules,
   scoring, save/continue and leaderboard submission.
   Owner: lead. See SPEC.md §8.
   ===================================================================== */
(function (global) {
  'use strict';
  var PV = global.PV;
  var E = PV.Entities;
  var T = PV.TILE;
  var FD = PV.FIXED_DT;
  var GAME_ID = 'paradox-vault';

  /* ------------------------------------------------------------------
     Safety shims — the game must still boot if an optional module is
     missing (e.g. while a module is being hot-swapped in development).
     ------------------------------------------------------------------ */
  function stubUI() {
    var noop = function () {};
    return {
      init: noop, showScreen: noop, setHUD: noop, toast: noop,
      modal: noop, closeModal: noop, setBrief: noop, setResults: noop,
      flash: noop, setBootProgress: noop,
      prompt: function (o) {
        var v = global.prompt((o && o.title) || 'Name', '');
        return Promise.resolve(v);
      }
    };
  }
  function stubParticles() {
    var noop = function () {};
    return { init: noop, update: noop, draw: noop, emit: noop, clear: noop, count: 0 };
  }
  function stubAudio() {
    var noop = function () {};
    return {
      init: noop, unlock: noop, ready: false, muted: false,
      setMusicVolume: noop, setSfxVolume: noop, playMusic: noop,
      stopMusic: noop, setTension: noop, sfx: noop
    };
  }
  function stubTextures() {
    var made = null;
    return {
      init: function () { this.ready = false; },
      ready: false,
      get: function () {
        if (!made) { made = PV.makeCanvas(8, 8).canvas; }
        return made;
      },
      variant: function () { return null; },
      pattern: function () { return null; },
      names: []
    };
  }

  /* ------------------------------------------------------------------
     Game state
     ------------------------------------------------------------------ */
  var G = PV.Game = {
    state: {
      phase: 'boot',
      vaultIndex: 0,
      loopIndex: 0,
      score: 0,
      runScore: 0
    },
    world: null
  };

  var world = null;
  var accumulator = 0;
  var rec = null;              // current loop recording
  var pendingRewind = false;
  var rewindT = 0;
  var vaultStartScore = 0;
  var runStats = null;
  var hudVM = {
    loopPct: 1, ticksLeft: 0, secondsLeft: 0, loopIndex: 0,
    echoesLeft: 0, echoesMax: 0, relicsHeld: 0, relicsBanked: 0, relicsTotal: 0,
    score: 0, combo: 1, alert: 0, vaultName: '', vaultWing: '', vaultIndex: 0,
    objective: '', canRewind: true, carrying: null, hint: '', desyncs: 0
  };

  /* ------------------------------------------------------------------
     World construction
     ------------------------------------------------------------------ */
  function buildWorld(vault) {
    var w = {
      vault: vault,
      tick: 0,
      ticksLeft: 0,
      loopTicks: Math.round(vault.loopSeconds / FD),
      signals: Object.create(null),
      doorAt: new Array(vault.w * vault.h),
      plates: [], levers: [], terminals: [], receivers: [], doors: [],
      lasers: [], mirrors: [], vents: [], relics: [], sentries: [],
      props: [], lamps: [], skylights: [],
      echoes: [], allActors: [],
      exit: null,
      player: new E.Actor(vault.spawn.x, vault.spawn.y, false, -1),
      alert: 0, alertTarget: 0,
      rewindFx: 0,
      phase: 'playing',
      desyncs: 0,
      caught: 0,
      relicsHeldByAny: 0,
      onStep: onAnyStep
    };

    for (var i = 0; i < vault.objects.length; i++) {
      var o = vault.objects[i];
      switch (o.t) {
        case 'plate': w.plates.push(new E.Plate(o)); break;
        case 'lever': w.levers.push(new E.Lever(o)); break;
        case 'terminal': w.terminals.push(new E.Terminal(o)); break;
        case 'receiver': w.receivers.push(new E.Receiver(o)); break;
        case 'door': w.doors.push(new E.Door(o, vault)); break;
        case 'laser': w.lasers.push(new E.Laser(o)); break;
        case 'mirror': w.mirrors.push(new E.Mirror(o)); break;
        case 'vent': w.vents.push(new E.Vent(o)); break;
        case 'relic': w.relics.push(new E.Relic(o, w.relics.length)); break;
        case 'sentry': w.sentries.push(new E.Sentry(o)); break;
        case 'exit': w.exit = new E.Exit(o); break;
        case 'prop': w.props.push({ x: o.x, y: o.y, kind: o.kind }); break;
        case 'lamp': w.lamps.push(o); break;
        case 'skylight': w.skylights.push(o); break;
        default: break;
      }
    }

    /* index doors by tile for fast solid lookups */
    for (var d = 0; d < w.doors.length; d++) {
      var dr = w.doors[d];
      for (var k = 0; k < dr.tiles.length; k++) {
        var tl = dr.tiles[k];
        if (tl.x >= 0 && tl.y >= 0 && tl.x < vault.w && tl.y < vault.h) {
          w.doorAt[tl.y * vault.w + tl.x] = dr;
        }
      }
    }

    if (!w.exit) w.exit = new E.Exit({ x: Math.floor(vault.spawn.x) - 1, y: Math.floor(vault.spawn.y) - 1, w: 2, h: 2 });

    rebuildActorList(w);
    return w;
  }

  function rebuildActorList(w) {
    w.allActors.length = 0;
    w.allActors.push(w.player);
    for (var i = 0; i < w.echoes.length; i++) w.allActors.push(w.echoes[i]);
  }

  function onAnyStep(a) {
    if (!PV.Particles) return;
    var surf = PV.surfaceAt(world.vault, a.x, a.y);
    if (surf === 'soft') return;
    PV.Particles.emit('dust', a.x * T, a.y * T + T * 0.24, {
      count: a.isEcho ? 2 : 4,
      scale: a.isEcho ? 0.7 : 1,
      color: a.isEcho ? '#7fe6ff' : '#cbd6e8'
    });
  }

  /* ------------------------------------------------------------------
     Loop lifecycle
     ------------------------------------------------------------------ */
  function resetLoopState(w) {
    var i;
    w.tick = 0;
    w.ticksLeft = w.loopTicks;
    w.player.reset();
    w.player.x = w.vault.spawn.x; w.player.y = w.vault.spawn.y;
    for (i = 0; i < w.echoes.length; i++) w.echoes[i].reset();
    for (i = 0; i < w.relics.length; i++) if (!w.relics[i].banked) w.relics[i].reset();
    for (i = 0; i < w.sentries.length; i++) w.sentries[i].reset();
    for (i = 0; i < w.mirrors.length; i++) {
      w.mirrors[i].x = w.mirrors[i].homeX; w.mirrors[i].y = w.mirrors[i].homeY;
    }
    for (i = 0; i < w.lasers.length; i++) w.lasers[i].time = 0;
    for (i = 0; i < w.terminals.length; i++) { w.terminals[i].progress = 0; w.terminals[i].on = false; }
    for (i = 0; i < w.levers.length; i++) w.levers[i].on = false;
    for (i = 0; i < w.doors.length; i++) { w.doors[i].open = false; w.doors[i].anim = 0; }
    w.alert = 0; w.alertTarget = 0;
    w.signals = Object.create(null);
    rebuildActorList(w);
  }

  function startVault(index) {
    var vault = PV.Levels.get(index);
    world = G.world = buildWorld(vault);
    G.state.vaultIndex = index;
    G.state.vault = vault;
    G.state.loopIndex = 0;
    G.state.echoesMax = vault.echoes;
    G.state.echoesLeft = vault.echoes;
    vaultStartScore = G.state.runScore;
    world.desyncs = 0;
    world.caught = 0;
    rec = new E.Recording(world.loopTicks + 8);
    resetLoopState(world);
    PV.Render.invalidate();
    seedAmbientMotes();
    setPhase('brief');
    PV.UI.setBrief({
      index: index,
      name: vault.name,
      wing: vault.wing,
      objective: vault.objective,
      hint: vault.hint,
      relics: vault.relicCount,
      echoes: vault.echoes,
      loopSeconds: vault.loopSeconds,
      multiplier: PV.Levels.multiplier(index)
    });
    PV.UI.showScreen('brief');
  }

  function beginPlay() {
    setPhase('playing');
    PV.UI.showScreen('hud');
    PV.Audio.playMusic('heist');
  }

  function seedAmbientMotes() {
    if (!PV.Particles) return;
    PV.Particles.clear();
    var v = world.vault;
    for (var i = 0; i < world.skylights.length; i++) {
      var sk = world.skylights[i];
      PV.Particles.emit('motes', (sk.x + sk.w / 2) * T, (sk.y + sk.h / 2) * T, {
        count: PV.quality.tier >= 2 ? 46 : 24,
        spread: Math.max(sk.w, sk.h) * T * 0.55
      });
    }
    if (world.skylights.length === 0) {
      PV.Particles.emit('motes', v.w * T / 2, v.h * T / 2, {
        count: 24, spread: Math.max(v.w, v.h) * T * 0.4
      });
    }
  }

  /* Spend an echo and rewind. reason: 'timer' | 'manual' | 'laser' | 'alarm' */
  function doRewind(reason) {
    if (world.phase !== 'playing') return;

    var recorded = rec.length > 6;
    var spend = (reason !== 'manual') || recorded;

    if (spend && G.state.echoesLeft <= 0) {
      endRun(false, 'You ran out of echoes.');
      return;
    }

    /* bank any relic the player is carrying? No — carried relics return. */
    if (world.player.carrying) {
      world.player.carrying.held = null;
      world.player.carrying = null;
    }

    if (recorded) {
      var echo = new E.Echo(rec, world.vault.spawn.x, world.vault.spawn.y, world.echoes.length);
      world.echoes.push(echo);
      G.state.echoesLeft = Math.max(0, G.state.echoesLeft - 1);
    }

    G.state.loopIndex++;
    rec = new E.Recording(world.loopTicks + 8);
    resetLoopState(world);

    world.rewindFx = 1;
    rewindT = 0.85;
    PV.Render.shake(0.55);
    PV.emit('loop:rewind', { loopIndex: G.state.loopIndex, echoesLeft: G.state.echoesLeft, reason: reason });
    if (PV.Particles) {
      PV.Particles.emit('chrono', world.vault.spawn.x * T, world.vault.spawn.y * T, { count: 70 });
      PV.Particles.emit('holoShard', world.vault.spawn.x * T, world.vault.spawn.y * T, { count: 22 });
    }
    PV.UI.flash('rewind');
    if (world.echoes.length) PV.emit('echo:spawn', { x: world.vault.spawn.x, y: world.vault.spawn.y, index: world.echoes.length - 1 });
    seedAmbientMotes();
  }

  /* ------------------------------------------------------------------
     Fixed-step simulation
     ------------------------------------------------------------------ */
  var inpBuf = { x: 0, y: 0, action: false, dash: false };

  function fixedUpdate(w) {
    var i;

    /* ---- gather player input ---- */
    inpBuf.x = PV.Input.axis.x;
    inpBuf.y = PV.Input.axis.y;
    inpBuf.action = PV.Input.down('action');
    inpBuf.dash = PV.Input.down('dash');

    rec.write(w.tick, inpBuf.x, inpBuf.y, inpBuf.action, inpBuf.dash, w.player.x, w.player.y);
    /* Play back exactly what was recorded. The tape quantises the stick to
       int8, so if we stepped with the raw float the echo would replay a
       fractionally different input and slowly drift off the path you walked. */
    rec.read(w.tick, inpBuf);

    /* ---- advance echoes first so devices see their state this tick ---- */
    for (i = 0; i < w.echoes.length; i++) w.echoes[i].advance(w);

    /* ---- player ---- */
    w.player.step(w, inpBuf);
    w.player.interacting = inpBuf.action;

    /* ---- signals rebuild ---- */
    var S = w.signals;
    for (var key in S) S[key] = false;

    for (i = 0; i < w.plates.length; i++) w.plates[i].update(w);
    for (i = 0; i < w.levers.length; i++) w.levers[i].update(w);
    for (i = 0; i < w.terminals.length; i++) w.terminals[i].update(w);
    for (i = 0; i < w.receivers.length; i++) w.receivers[i].update(w);
    for (i = 0; i < w.vents.length; i++) w.vents[i].update(w);
    for (i = 0; i < w.lasers.length; i++) w.lasers[i].update(w);
    for (i = 0; i < w.doors.length; i++) w.doors[i].update(w);

    /* receivers are resolved by the laser pass, so re-evaluate doors that
       depend on them one tick later — cheap and imperceptible. */

    /* ---- sentries ---- */
    w.alertTarget = 0;
    for (i = 0; i < w.sentries.length; i++) w.sentries[i].update(w);
    w.alert = PV.damp(w.alert, w.alertTarget, w.alertTarget > w.alert ? 6 : 1.6, FD);

    /* ---- relics ---- */
    w.relicsHeldByAny = 0;
    for (i = 0; i < w.relics.length; i++) {
      var r = w.relics[i];
      if (r.banked) continue;
      if (r.held) {
        r.x = r.held.x; r.y = r.held.y;
        w.relicsHeldByAny++;
        if (!r.held.alive || !r.held.active) { r.held.carrying = null; r.held = null; r.reset(); }
        continue;
      }
      /* pick up */
      for (var a = 0; a < w.allActors.length; a++) {
        var act = w.allActors[a];
        if (!act.alive || !act.active || act.carrying) continue;
        if (PV.dist2(act.x, act.y, r.x, r.y) < 0.42 * 0.42) {
          act.carrying = r; r.held = act;
          if (!act.isEcho) {
            PV.emit('relic:grab', { x: r.x, y: r.y, value: r.value });
            PV.UI.flash('grab');
            if (PV.Particles) PV.Particles.emit('sparkGold', r.x * T, r.y * T, { count: 26 });
          }
          break;
        }
      }
    }

    /* ---- laser contact ---- */
    for (i = 0; i < w.lasers.length; i++) {
      var L = w.lasers[i];
      if (!L.on || L.beamKind === 'soft') continue;
      if (L.hits(w.player.x, w.player.y, w.player.radius)) {
        PV.emit('laser:hit', { x: w.player.x, y: w.player.y });
        if (PV.Particles) PV.Particles.emit('sparkRed', w.player.x * T, w.player.y * T, { count: 34 });
        w.caught++;
        pendingRewind = 'laser';
        return;
      }
    }

    /* ---- alarm ---- */
    if (w.alert >= 0.999) {
      w.caught++;
      pendingRewind = 'alarm';
      return;
    }

    /* ---- extraction ---- */
    if (w.player.carrying && w.exit.contains(w.player)) {
      var rel = w.player.carrying;
      rel.banked = true; rel.held = null;
      w.player.carrying = null;
      G.state.runScore += 250 * rel.value;
      PV.emit('relic:grab', { x: w.player.x, y: w.player.y, value: rel.value });
      if (PV.Particles) {
        PV.Particles.emit('sparkGold', w.exit.cx * T, w.exit.cy * T, { count: 40 });
        PV.Particles.emit('ripple', w.exit.cx * T, w.exit.cy * T, { count: 3, scale: 3 });
      }
      PV.Render.shake(0.25);
      var remaining = 0;
      for (var q = 0; q < w.relics.length; q++) if (!w.relics[q].banked) remaining++;
      if (remaining === 0) { clearVault(); return; }
    }

    /* ---- desync tally ---- */
    for (i = 0; i < w.echoes.length; i++) {
      if (w.echoes[i].desync > 0.6 && !w.echoes[i]._counted) {
        w.echoes[i]._counted = true;
        w.desyncs++;
      }
    }

    w.tick++;
    w.ticksLeft = w.loopTicks - w.tick;
    if (w.ticksLeft <= 0) pendingRewind = 'timer';
  }

  /* ------------------------------------------------------------------
     Vault clear / run end
     ------------------------------------------------------------------ */
  function clearVault() {
    var w = world;
    setPhase('clear');
    var secondsLeft = w.ticksLeft * FD;
    var mult = PV.Levels.multiplier(w.vault.index);

    var relicPts = 0;
    for (var i = 0; i < w.relics.length; i++) relicPts += 250 * w.relics[i].value;
    var echoPts = 400 * G.state.echoesLeft;
    var timePts = Math.floor(6 * secondsLeft);
    var noAlarm = w.caught === 0 ? 300 : 0;
    var perfect = w.desyncs === 0 ? 500 : 0;
    var subtotal = relicPts + echoPts + timePts + noAlarm + perfect;
    var total = Math.round(subtotal * mult);

    /* relicPts were already banked incrementally as 250*value; correct for it */
    G.state.runScore = vaultStartScore + total;

    runStats.vaultsCleared++;
    runStats.echoesSaved += G.state.echoesLeft;
    if (noAlarm) runStats.cleanVaults++;

    PV.emit('vault:clear', { score: total });
    PV.Audio.playMusic('victory');
    if (PV.Particles) {
      PV.Particles.emit('confetti', w.exit.cx * T, w.exit.cy * T, { count: 90 });
      PV.Particles.emit('sparkGold', w.exit.cx * T, w.exit.cy * T, { count: 50 });
    }
    PV.Render.shake(0.4);

    saveProgress();

    PV.UI.setResults({
      kind: 'clear',
      vaultName: w.vault.name,
      vaultIndex: w.vault.index,
      lines: [
        { label: 'Relics recovered', value: relicPts },
        { label: 'Echoes unspent  ×' + G.state.echoesLeft, value: echoPts },
        { label: 'Time remaining  ' + secondsLeft.toFixed(1) + 's', value: timePts },
        { label: 'Silent run', value: noAlarm },
        { label: 'No paradox', value: perfect }
      ],
      multiplier: mult,
      total: total,
      runScore: G.state.runScore,
      loops: G.state.loopIndex + 1,
      nextName: PV.Levels.get(w.vault.index + 1).name
    });
    PV.UI.showScreen('clear');
  }

  function endRun(won, reason) {
    setPhase('gameover');
    PV.Audio.playMusic('menu');
    PV.emit('run:over', { score: G.state.runScore });
    var best = PV.store.get('best', 0);
    var isBest = G.state.runScore > best;
    if (isBest) PV.store.set('best', G.state.runScore);
    clearSave();
    PV.UI.setResults({
      kind: 'gameover',
      reason: reason,
      total: G.state.runScore,
      best: Math.max(best, G.state.runScore),
      isBest: isBest,
      vaultsCleared: runStats.vaultsCleared,
      deepest: G.state.vaultIndex + 1,
      loops: runStats.totalLoops + G.state.loopIndex
    });
    PV.UI.showScreen('gameover');
    submitScore(G.state.runScore).catch(function () {});
  }

  G.nextVault = function () {
    runStats.totalLoops += G.state.loopIndex + 1;
    startVault(G.state.vaultIndex + 1);
  };
  G.retireRun = function () {
    endRun(true, 'You walked away with the score. Wise.');
  };

  /* ------------------------------------------------------------------
     Leaderboard
     ------------------------------------------------------------------ */
  async function submitScore(score) {
    if (!score || score <= 0) return;
    if (global.location && global.location.protocol === 'file:') return;
    try {
      var res = await fetch('/api/leaderboard/rank?gameId=' + encodeURIComponent(GAME_ID) + '&score=' + encodeURIComponent(score), {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return;
      var data = await res.json();
      var rank = Number(data && data.rank);
      if (!isFinite(rank) || rank <= 0 || rank > 20) return;

      var name = await PV.UI.prompt({
        title: 'Top 20 Score',
        body: 'You placed <b>#' + rank + '</b> with <b>' + PV.fmtNum(score) + '</b>. Sign the ledger.',
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
      PV.UI.toast('🏆 Submitted — rank #' + rank, 2800);
    } catch (e) { /* offline: ignore */ }
  }

  /* ------------------------------------------------------------------
     Save / continue (between vaults only — a run is not saved mid-loop)
     ------------------------------------------------------------------ */
  function saveProgress() {
    PV.store.set('save', {
      v: 1,
      vaultIndex: G.state.vaultIndex + 1,
      runScore: G.state.runScore,
      stats: runStats,
      at: Date.now()
    });
  }
  function clearSave() { PV.store.del('save'); }
  G.hasSave = function () {
    var s = PV.store.get('save', null);
    return !!(s && s.v === 1 && s.vaultIndex > 0);
  };
  G.continueRun = function () {
    var s = PV.store.get('save', null);
    if (!s) { G.newRun(); return; }
    runStats = s.stats || freshStats();
    G.state.runScore = s.runScore || 0;
    startVault(s.vaultIndex || 0);
  };

  function freshStats() {
    return { vaultsCleared: 0, echoesSaved: 0, cleanVaults: 0, totalLoops: 0 };
  }

  G.newRun = function () {
    clearSave();
    runStats = freshStats();
    G.state.runScore = 0;
    startVault(0);
  };

  G.beginPlay = beginPlay;
  G.rewind = function () { doRewind('manual'); };
  G.restartVault = function () {
    var idx = G.state.vaultIndex;
    G.state.runScore = vaultStartScore;
    startVault(idx);
  };

  function setPhase(p) {
    G.state.phase = p;
    if (world) world.phase = p;
  }

  G.pause = function () {
    if (G.state.phase !== 'playing') return;
    setPhase('paused');
    PV.UI.showScreen('pause');
  };
  G.resume = function () {
    if (G.state.phase !== 'paused') return;
    setPhase('playing');
    PV.UI.showScreen('hud');
  };
  G.quitToTitle = function () {
    setPhase('title');
    PV.Audio.playMusic('menu');
    PV.UI.showScreen('title');
  };

  /* ------------------------------------------------------------------
     Frame
     ------------------------------------------------------------------ */
  var qualityTimer = 0;

  function update(dt) {
    var phase = G.state.phase;

    /* pause / resume hotkey */
    if (PV.Input.pressed('pause')) {
      PV.Input.consume('pause');
      if (phase === 'playing') G.pause();
      else if (phase === 'paused') G.resume();
    }

    if (phase === 'playing' && world) {
      if (PV.Input.pressed('rewind')) {
        PV.Input.consume('rewind');
        doRewind('manual');
      }
      accumulator += dt;
      var steps = 0;
      while (accumulator >= FD && steps < 12) {
        accumulator -= FD;
        steps++;
        fixedUpdate(world);
        if (pendingRewind) {
          var reason = pendingRewind;
          pendingRewind = false;
          if (reason === 'laser' || reason === 'alarm') {
            PV.UI.flash('alarm');
            PV.Render.shake(0.8);
          }
          doRewind(reason);
          break;
        }
      }
      if (steps >= 12) accumulator = 0;
    }

    if (world) {
      rewindT = Math.max(0, rewindT - dt);
      world.rewindFx = PV.damp(world.rewindFx, rewindT > 0 ? Math.min(1, rewindT / 0.5) : 0, 12, dt);
      /* tension follows alarm + clock pressure */
      var pressure = world ? PV.clamp(1 - (world.ticksLeft / world.loopTicks), 0, 1) : 0;
      PV.Audio.setTension(PV.clamp(Math.max(world.alert, pressure * 0.55), 0, 1));
    }

    if (PV.Particles) PV.Particles.update(dt);

    /* adaptive quality */
    qualityTimer += dt;
    if (qualityTimer > 2) {
      qualityTimer = 0;
      var ms = PV.Loop.msAvg;
      if (ms > 26 && PV.quality.tier > 0) {
        PV.quality.tier--;
        PV.quality.bloom = PV.quality.tier >= 1;
        PV.quality.grain = PV.quality.tier >= 1;
        PV.quality.maxParticles = [500, 1200, 2500][PV.quality.tier];
        PV.Render.resize();
      } else if (ms < 13.5 && PV.quality.tier < 2 && !PV.isMobile) {
        PV.quality.tier++;
        PV.quality.bloom = true;
        PV.quality.grain = true;
        PV.quality.maxParticles = [500, 1200, 2500][PV.quality.tier];
        PV.Render.resize();
      }
    }
  }

  function render(dt) {
    if (!world) { drawIdle(); return; }
    var focusX = world.player.x * T, focusY = world.player.y * T;
    PV.Render.frameCamera(world, dt, focusX, focusY);
    fillHUD();
    PV.Render.draw(world, dt, hudVM);
    if (G.state.phase === 'playing' || G.state.phase === 'paused') PV.UI.setHUD(hudVM);
  }

  function fillHUD() {
    var w = world;
    hudVM.ticksLeft = w.ticksLeft;
    hudVM.secondsLeft = Math.max(0, w.ticksLeft * FD);
    hudVM.loopPct = PV.clamp(w.ticksLeft / w.loopTicks, 0, 1);
    hudVM.loopIndex = G.state.loopIndex;
    hudVM.echoesLeft = G.state.echoesLeft;
    hudVM.echoesMax = G.state.echoesMax;
    hudVM.score = G.state.runScore;
    hudVM.alert = w.alert;
    hudVM.vaultName = w.vault.name;
    hudVM.vaultWing = w.vault.wing;
    hudVM.vaultIndex = w.vault.index;
    hudVM.objective = w.vault.objective;
    hudVM.hint = w.vault.hint;
    hudVM.canRewind = G.state.echoesLeft > 0;
    hudVM.carrying = w.player.carrying ? w.player.carrying.kind : null;
    hudVM.desyncs = w.desyncs;
    var banked = 0, total = w.relics.length;
    for (var i = 0; i < total; i++) if (w.relics[i].banked) banked++;
    hudVM.relicsBanked = banked;
    hudVM.relicsTotal = total;
    hudVM.relicsHeld = w.player.carrying ? 1 : 0;
    hudVM.combo = PV.Levels.multiplier(w.vault.index);
  }

  var idleCanvas = null;
  function drawIdle() {
    var c = PV.Render.view;
    var ctx = document.getElementById('pv-canvas').getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var W = ctx.canvas.width, H = ctx.canvas.height;
    var t = PV.now() * 0.0004;
    var g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.max(W, H) * 0.8);
    g.addColorStop(0, '#171c28');
    g.addColorStop(0.5, '#0a0d14');
    g.addColorStop(1, '#04060a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    /* slow rotating deco rings behind the menu */
    ctx.save();
    ctx.translate(W / 2, H * 0.42);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 5; i++) {
      var r = Math.min(W, H) * (0.16 + i * 0.09);
      ctx.strokeStyle = 'rgba(201,162,39,' + (0.10 - i * 0.014).toFixed(3) + ')';
      ctx.lineWidth = 2 + i;
      ctx.beginPath();
      var seg = 12 + i * 4;
      for (var k = 0; k < seg; k++) {
        var a0 = (k / seg) * PV.TAU + t * (i % 2 ? 1 : -1) * (1 + i * 0.3);
        var a1 = a0 + PV.TAU / seg * 0.55;
        ctx.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
        ctx.arc(0, 0, r, a0, a1);
      }
      ctx.stroke();
    }
    ctx.restore();
    if (PV.Particles) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      PV.Particles.draw(ctx, 'air');
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function boot() {
    if (!PV.UI) PV.UI = stubUI();
    if (!PV.Particles) PV.Particles = stubParticles();
    if (!PV.Audio) PV.Audio = stubAudio();
    if (!PV.Textures) PV.Textures = stubTextures();

    var canvas = document.getElementById('pv-canvas');
    PV.Render.init(canvas);
    PV.Input.init(document.body, canvas);
    PV.UI.init();
    PV.UI.showScreen('boot');

    /* stagger the heavy bakes over a couple of frames so the boot screen
       actually paints before we block the main thread */
    var steps = [
      ['Milling brass…', function () { PV.Textures.init(); }],
      ['Polishing marble…', function () { PV.Particles.init(); }],
      ['Winding the clock…', function () { PV.Audio.init(); }],
      ['Arming the grid…', function () { PV.Levels.get(0); }]
    ];
    var si = 0;
    function nextStep() {
      if (si >= steps.length) { finishBoot(); return; }
      var s = steps[si];
      PV.UI.setBootProgress(si / steps.length, s[0]);
      /* setTimeout, not rAF: a backgrounded tab pauses rAF entirely and the
         loader would stall forever if the player switched tabs while loading */
      global.setTimeout(function () {
        try { s[1](); } catch (e) { console.error('[PV] boot step failed: ' + s[0], e); }
        si++;
        nextStep();
      }, 24);
    }
    nextStep();

    function finishBoot() {
      PV.UI.setBootProgress(1, 'Ready');
      runStats = freshStats();
      setPhase('title');
      PV.UI.showScreen('title');
      PV.Loop.start(update, render);
      PV.emit('boot:done', {});

      /* ?vault=N jumps straight into a vault — handy for sharing a specific
         floor and for automated checks. Menus still work normally. */
      var q = (global.location && global.location.search) || '';
      var m = /[?&]vault=(\d+)/.exec(q);
      if (m) {
        runStats = freshStats();
        G.state.runScore = 0;
        startVault(Math.max(0, parseInt(m[1], 10) - 1));
        if (/[?&]auto=1/.test(q)) beginPlay();
      }
    }

    /* UI wiring — action names come from ui.js nav() calls */
    PV.on('ui:newHeist', function () { G.newRun(); });
    PV.on('ui:newRun', function () { G.newRun(); });
    PV.on('ui:continue', function () { G.continueRun(); });
    PV.on('ui:begin', function () { beginPlay(); });
    PV.on('ui:pause', function () { G.pause(); });
    PV.on('ui:resume', function () { G.resume(); });
    PV.on('ui:restart', function () { G.restartVault(); beginPlay(); });
    PV.on('ui:next', function () { G.nextVault(); });
    PV.on('ui:retire', function () { G.retireRun(); });
    PV.on('ui:quit', function () { G.quitToTitle(); });
    PV.on('ui:rewind', function () { doRewind('manual'); });
    PV.on('ui:submit', function () { submitScore(G.state.runScore).catch(function () {}); });
    PV.on('ui:quality', function () { PV.Render.resize(); PV.Render.invalidate(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window);
