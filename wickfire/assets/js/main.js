/* WICKFIRE - integration: loop, input (keyboard + touch), UI, leaderboard. */
(function (global) {
  'use strict';
  var WF = global.WF, GAME_ID = 'wickfire';
  var cv = document.getElementById('wf-canvas');
  var menu = document.getElementById('wf-menu'), over = document.getElementById('wf-over');
  var game = null, mode = 'menu', last = 0, now = 0, seed = 1;
  var keys = {}, order = [], pressed = { bomb: false, cut: false };
  var touch = ('ontouchstart' in global) || (global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
  var ctl = { pad: { x: 0, y: 0, r: 60 }, stick: { x: 0, y: 0 }, bomb: { x: 0, y: 0, r: 40, down: false }, cut: { x: 0, y: 0, r: 32, down: false }, ids: {} };
  var best = 0;
  try { best = +localStorage.getItem('wickfire.best') || 0; } catch (e) {}

  WF.render.init(cv);

  function layout() {
    var w = global.innerWidth, h = global.innerHeight, portrait = h > w;
    var reserve = touch && portrait ? Math.min(200, Math.round(h * 0.26)) : 0;
    WF.render.layout(w, h, reserve);
    var pr = Math.max(46, Math.min(70, Math.min(w, h) * 0.16));
    ctl.pad.r = pr; ctl.pad.x = pr + 18; ctl.bomb.r = pr * 0.62; ctl.cut.r = pr * 0.46;
    var by = portrait ? h - reserve / 2 : h - pr - 22;
    ctl.pad.y = by; ctl.bomb.x = w - ctl.bomb.r - 22; ctl.bomb.y = by + (portrait ? 6 : 0);
    ctl.cut.x = ctl.bomb.x - ctl.bomb.r - ctl.cut.r - 6; ctl.cut.y = by - (portrait ? 16 : ctl.bomb.r * 0.9);
    if (!portrait) { ctl.cut.x = ctl.bomb.x; ctl.cut.y = ctl.bomb.y - ctl.bomb.r - ctl.cut.r - 10; }
  }
  global.addEventListener('resize', layout); layout();

  /* ---- input ------------------------------------------------------ */
  var DIRKEYS = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd' };
  global.addEventListener('keydown', function (e) {
    WF.audio.init();
    var k = e.key;
    if (DIRKEYS[k]) { e.preventDefault(); if (!keys[DIRKEYS[k]]) { keys[DIRKEYS[k]] = true; order.push(DIRKEYS[k]); } return; }
    if (k === ' ' || k === 'Enter') { e.preventDefault(); if (mode === 'menu' && k === 'Enter') return start(); if (!e.repeat) pressed.bomb = true; }
    else if (k === 'x' || k === 'X' || k === 'Shift' || k === 'z' || k === 'Z') { if (!e.repeat) pressed.cut = true; }
    else if (k === 'p' || k === 'P' || k === 'Escape') togglePause();
    else if (k === 'm' || k === 'M') toggleMute();
  });
  global.addEventListener('keyup', function (e) {
    var d = DIRKEYS[e.key]; if (!d) return;
    keys[d] = false; order = order.filter(function (o) { return o !== d; });
  });
  global.addEventListener('blur', function () { keys = {}; order = []; if (mode === 'play') togglePause(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && mode === 'play') togglePause(); });

  function readDir() {
    var d = order[order.length - 1];
    var dx = d === 'r' ? 1 : d === 'l' ? -1 : 0, dy = d === 'd' ? 1 : d === 'u' ? -1 : 0;
    if (!dx && !dy && touch && (ctl.stick.x || ctl.stick.y)) {
      if (Math.abs(ctl.stick.x) > Math.abs(ctl.stick.y)) dx = Math.sign(ctl.stick.x); else dy = Math.sign(ctl.stick.y);
    }
    return { dx: dx, dy: dy };
  }

  function hit(c, x, y, pad) { var dx = x - c.x, dy = y - c.y, r = c.r + (pad || 0); return dx * dx + dy * dy <= r * r; }
  function ptr(e, down) {
    if (mode !== 'play') return;
    var id = e.pointerId, x = e.clientX, y = e.clientY;
    if (down) {
      WF.audio.init();
      if (hit(ctl.bomb, x, y, 16)) { ctl.bomb.down = true; ctl.ids[id] = 'bomb'; pressed.bomb = true; }
      else if (hit(ctl.cut, x, y, 16)) { ctl.cut.down = true; ctl.ids[id] = 'cut'; pressed.cut = true; }
      else if (x < global.innerWidth * 0.5 && touch) { ctl.ids[id] = 'pad'; }
    }
    if (ctl.ids[id] === 'pad') {
      var dx = x - ctl.pad.x, dy = y - ctl.pad.y, m = Math.sqrt(dx * dx + dy * dy);
      if (m < ctl.pad.r * 0.2) { ctl.stick.x = 0; ctl.stick.y = 0; }
      else { var k = Math.min(1, m / ctl.pad.r) / m; ctl.stick.x = dx * k; ctl.stick.y = dy * k; }
    }
  }
  cv.addEventListener('pointerdown', function (e) { ptr(e, true); try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
  cv.addEventListener('pointermove', function (e) { if (ctl.ids[e.pointerId]) ptr(e, false); });
  function up(e) {
    var t = ctl.ids[e.pointerId]; delete ctl.ids[e.pointerId];
    if (t === 'pad') { ctl.stick.x = 0; ctl.stick.y = 0; } else if (t === 'bomb') ctl.bomb.down = false; else if (t === 'cut') ctl.cut.down = false;
  }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---- flow ------------------------------------------------------- */
  function start() {
    WF.audio.init(); WF.audio.play('ui');
    seed = (Date.now() % 100000) + 1;
    game = WF.createGame(seed, 1, null);
    menu.hidden = true; over.hidden = true; mode = 'play';
    document.body.classList.add('playing'); WF.audio.music(true);
  }
  function togglePause() {
    if (mode === 'play') { mode = 'pause'; over.hidden = false; over.innerHTML = '<h2>Paused</h2><button class="wf-btn" id="wf-resume" type="button">Resume</button>'; document.getElementById('wf-resume').onclick = togglePause; }
    else if (mode === 'pause') { mode = 'play'; over.hidden = true; last = performance.now(); }
  }
  document.getElementById('wf-pause').onclick = togglePause;
  document.getElementById('wf-play').onclick = start;
  function toggleMute() { WF.audio.setMuted(!WF.audio.isMuted()); document.getElementById('wf-mute').textContent = 'Sound: ' + (WF.audio.isMuted() ? 'off' : 'on'); }
  document.getElementById('wf-mute').onclick = toggleMute;

  function endRun() {
    mode = 'over'; WF.audio.music(false); document.body.classList.remove('playing');
    var s = game.score, isBest = s > best;
    if (isBest) { best = s; try { localStorage.setItem('wickfire.best', String(best)); } catch (e) {} }
    over.hidden = false;
    over.innerHTML = '<h2>Mine Collapsed</h2><p class="stat">Score <b>' + s.toLocaleString() + '</b>' + (isBest ? ' - new best!' : '') + '</p>' +
      '<p class="stat">Level <b>' + game.level + '</b> &middot; Crates <b>' + game.stats.crates + '</b> &middot; Foes <b>' + game.stats.kills + '</b> &middot; Best chain <b>' + game.stats.bestChain + '</b></p>' +
      '<div id="wf-lb"></div><button class="wf-btn" id="wf-again" type="button">Play again</button><div class="links"><a href="../leaderboard.html?gameId=' + GAME_ID + '">Leaderboard</a><a href="../index.html">Back to Arcade</a></div>';
    document.getElementById('wf-again').onclick = start;
    submitScore(s);
  }

  function submitScore(score) {
    if (!score || score <= 0 || global.location.protocol === 'file:') return;
    fetch('/api/leaderboard/rank?gameId=' + encodeURIComponent(GAME_ID) + '&score=' + encodeURIComponent(score), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var rank = d && Number(d.rank);
        if (!rank || rank <= 0 || rank > 20) return;
        var box = document.getElementById('wf-lb'); if (!box) return;
        box.innerHTML = '<p class="stat">Rank <b>#' + rank + '</b> - sign the ledger</p><input id="wf-name" maxlength="20" placeholder="Your name" autocomplete="off"/><br/><button class="wf-btn" id="wf-sub" type="button">Submit</button>';
        document.getElementById('wf-sub').onclick = function () {
          var name = String(document.getElementById('wf-name').value || '').trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
          if (!name) return;
          fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: GAME_ID, name: name, score: score }) })
            .then(function () { box.innerHTML = '<p class="stat">Submitted - rank <b>#' + rank + '</b></p>'; })
            .catch(function () { box.innerHTML = '<p class="stat">Offline - not submitted.</p>'; });
        };
      }).catch(function () {});
  }

  /* ---- loop ------------------------------------------------------- */
  var SFX = { place: 1, boom: 1, crate: 1, spark: 1, cut: 1, pickup: 1, kill: 1, death: 1, chain: 1, clear: 1 };
  function frame(t) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t; now = t / 1000;
    if (mode === 'play' && game) {
      if (pressed.bomb) WF.dropBomb(game);
      if (pressed.cut) WF.cutFuse(game);
      pressed.bomb = pressed.cut = false;
      WF.step(game, dt, readDir());
      var sparks = 0;
      game.events.forEach(function (e) { if (SFX[e.type] && (e.type !== 'spark' || sparks++ < 2)) WF.audio.play(e.type, e); });
      WF.render.onEvents(game.events);
      WF.audio.tick(Math.min(1, (game.level - 1) / 8));
      if (game.status === 'dead' && game.statusT > 1.4) WF.respawn(game);
      else if (game.status === 'clear' && game.statusT > 2.2) game = WF.createGame(seed, game.level + 1, WF.carry(game));
      else if (game.status === 'over' && game.statusT > 1.4) endRun();
    }
    var g = game || (mode === 'menu' ? attract() : null);
    WF.render.draw(g, now, mode === 'pause' ? 0 : dt, null);
    if (touch && mode === 'play') WF.render.drawControls(ctl);
    if (game && game.status === 'clear') banner('LEVEL CLEAR  +' + (game.timeBonus * 1 + 500));
  }
  var attractGame = null;
  function attract() {
    if (!attractGame) attractGame = WF.createGame(3, 2, null);
    attractGame.player.inv = 99;
    return attractGame;
  }
  function banner(text) {
    var c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0);
    var s = Math.min(1, cv.width / 640);
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, cv.height / 2 - 40 * s, cv.width, 80 * s);
    c.fillStyle = '#ffd23d'; c.font = '800 ' + Math.round(34 * s) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, cv.width / 2, cv.height / 2);
  }
  requestAnimationFrame(frame);
  WF.debug = { get game() { return game; }, start: start };
})(window);
