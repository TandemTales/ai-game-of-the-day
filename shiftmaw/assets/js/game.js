/* Shiftmaw game shell: state machine (menu/playing/paused/over), main loop, event routing, leaderboard. */
(function (global) {
  'use strict';
  var SM = global.SM, GAME_ID = 'shiftmaw';
  var G = SM.Game = { mode: 'menu', sim: null, best: SM.store.get('best', 0), last: 0, time: 0, submitted: false, rank: 0 };

  function banner(e) {
    if (e.t === 'ready') SM.UI.banner('READY<small>LEVEL ' + G.sim.level + '</small>');
    else if (e.t === 'go') SM.UI.hideBanner();
    else if (e.t === 'clear') SM.UI.banner('MAZE CLEARED<small>SPARE CHARGE = 500 EACH</small>', 2400);
    else if (e.t === 'life') SM.UI.toast('Extra life!');
    else if (e.t === 'charge') SM.UI.toast('+1 Flip charge');
    else if (e.t === 'flipdeny') SM.UI.toast(e.why === 'charge' ? 'No Flip charge — eat motes or a bloom' : (e.why === 'blocked' ? 'Flip blocked — you are standing in a wall' : ''), 1200);
  }

  function route(events) {
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      SM.Render.onEvent(e); SM.Audio.play(e.t, e); banner(e);
      if (e.t === 'over') finish();
    }
    events.length = 0;
  }

  G.start = function () {
    SM.Audio.init(); SM.Audio.startMusic();
    G.sim = SM.Sim.create({ seed: (Date.now() & 0xffff) | 1 });
    G.mode = 'playing'; G.submitted = false;
    SM.Render.particles.length = 0; SM.Render.pops.length = 0; SM.Render.ripples.length = 0;
    SM.UI.show('menu', false); SM.UI.show('over', false); SM.UI.show('pause', false);
    route(G.sim.events);
  };

  G.pause = function (on) {
    if (G.mode === 'playing' && on !== false) { G.mode = 'paused'; SM.UI.show('pause', true); SM.Audio.stopMusic(); }
    else if (G.mode === 'paused' && on !== true) { G.mode = 'playing'; SM.UI.show('pause', false); SM.Audio.startMusic(); G.last = 0; }
  };

  G.quit = function () { G.mode = 'menu'; SM.UI.show('pause', false); SM.UI.show('menu', true); SM.Audio.stopMusic(); SM.UI.hideBanner(); SM.UI.setBestDisplay(G.best); };

  function finish() {
    var s = G.sim; G.mode = 'over'; SM.Audio.stopMusic();
    if (s.score > G.best) { G.best = s.score; SM.store.set('best', G.best); }
    SM.UI.hideBanner(); SM.UI.showOver(s); SM.UI.setBestDisplay(G.best);
    checkRank(s.score);
  }

  function checkRank(score) {
    G.rank = 0;
    if (!score || score <= 0 || (global.location && global.location.protocol === 'file:')) return;
    fetch('/api/leaderboard/rank?gameId=' + encodeURIComponent(GAME_ID) + '&score=' + encodeURIComponent(score), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { var rank = Number(d && d.rank); if (isFinite(rank) && rank > 0 && rank <= 20 && G.mode === 'over') { G.rank = rank; SM.UI.askName(rank); } })
      .catch(function () { /* offline: ignore */ });
  }

  G.submit = function () {
    if (G.submitted || !G.rank) return;
    var name = String(SM.UI.nameValue() || '').trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
    if (!name) { SM.UI.toast('Enter a name first'); return; }
    G.submitted = true; SM.store.set('name', name);
    fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: GAME_ID, name: name, score: G.sim.score }) })
      .then(function () { SM.UI.toast('Submitted — rank #' + G.rank); SM.UI.hideName(); })
      .catch(function () { G.submitted = false; SM.UI.toast('Could not submit — try again'); });
  };

  function frame(now) {
    global.requestAnimationFrame(frame);
    var dt = G.last ? Math.min(0.1, (now - G.last) / 1000) : 0; G.last = now; G.time += dt;
    var s = G.sim;
    if (G.mode === 'playing' && s) {
      SM.Sim.advance(s, dt); route(s.events);
      var left = s.motesLeft / (s.m.motes + s.m.blooms);
      SM.Audio.setTempo(1 + (1 - left) * 0.35 + (s.frightT > 0 ? 0.1 : 0)); SM.Audio.update();
    }
    if (s) { SM.Render.padBottom = SM.UI.padBottom(); SM.Render.draw(s, G.mode === 'playing' ? dt : 0.0001, G.time); SM.UI.hud(s, G.best); }
  }

  function boot() {
    SM.Audio.setMuted(SM.store.get('muted', false));
    SM.Render.init(document.getElementById('sm-canvas'));
    SM.UI.init({
      play: G.start, resume: function () { G.pause(false); }, quit: G.quit, pause: function () { G.pause(); },
      mute: function () { SM.Audio.init(); SM.UI.setMuted(SM.Audio.toggleMute()); },
      submit: G.submit, flip: function () { if (G.mode === 'playing') SM.Sim.flip(G.sim); },
      dir: function (d) { if (G.mode === 'playing') SM.Sim.setWant(G.sim, d); }
    });
    SM.UI.setMuted(SM.Audio.isMuted()); SM.UI.setBestDisplay(G.best);
    SM.Input.onDir = function (d) { if (G.mode === 'playing') SM.Sim.setWant(G.sim, d); };
    SM.Input.onFlip = function () { if (G.mode === 'playing') SM.Sim.flip(G.sim); else if (G.mode === 'menu' || G.mode === 'over') { var a = document.activeElement; if (!a || a.tagName !== 'INPUT') G.start(); } };
    SM.Input.onPause = function () { G.pause(); };
    SM.Input.onMute = function () { SM.UI.setMuted(SM.Audio.toggleMute()); };
    SM.Input.onAny = function () { SM.Audio.init(); };
    SM.Input.bindKeys(); SM.Input.bindSwipe(document.getElementById('sm-canvas'));
    global.addEventListener('resize', SM.Render.resize);
    document.addEventListener('visibilitychange', function () { if (document.hidden) G.pause(true); });
    G.sim = SM.Sim.create({ seed: 7 }); G.sim.events.length = 0; // attract backdrop behind the menu
    global.requestAnimationFrame(frame);
    global.__shiftmaw = G; // test hook for headless screenshots
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
