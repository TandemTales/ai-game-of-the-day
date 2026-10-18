(function (global) {
  'use strict';
  var GR = global.GR, L = GR.Logic, A = GR.Audio, R = GR.Render;
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('maze'), panel = $('panel'), title = $('panel-title'), copy = $('panel-copy'), startBtn = $('start'),
    scoreEl = $('score'), livesEl = $('lives'), levelEl = $('level'), shutEl = $('shutters'), feedback = $('feedback');
  var game = L.newGame(1), mode = 'title', last = 0, clock = 0, submitted = false, clearTimer = 0, emberCount = 0;
  function fit() {
    var px = Math.min(3840, Math.round(Math.min(canvas.clientWidth || 640, canvas.clientHeight || 640) * (global.devicePixelRatio || 1)));
    px = Math.max(320, px); if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
  }
  function hud() {
    scoreEl.textContent = game.score.toLocaleString(); livesEl.textContent = Math.max(0, game.lives);
    levelEl.textContent = game.level;
    var amber = game.state === 0; shutEl.textContent = game.flip > 0 ? 'FLIPPING' : amber ? 'AMBER' : 'VIOLET';
    shutEl.className = amber ? 'amber' : 'violet';
  }
  function begin() {
    A.unlock(); game = L.newGame((Date.now() & 0xffff) + 1); mode = 'playing'; submitted = false; clearTimer = 0;
    panel.hidden = true; A.startMusic(1); feedback.textContent = 'EAT EVERY EMBER'; hud();
  }
  startBtn.addEventListener('click', begin);
  var KEYS = { ArrowUp: 0, w: 0, ArrowLeft: 1, a: 1, ArrowDown: 2, s: 2, ArrowRight: 3, d: 3 };
  document.addEventListener('keydown', function (e) {
    var d = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (d !== undefined) { e.preventDefault(); if (mode === 'playing') L.setDir(game, L.DIRS[d]); }
    else if (e.key === 'Enter' && mode !== 'playing') begin();
  });
  var dpad = $('dpad');
  dpad.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('button'); if (!b) return; e.preventDefault(); A.unlock();
    if (mode === 'playing') L.setDir(game, L.DIRS[Number(b.dataset.d)]);
  });
  var sx = 0, sy = 0, swiping = false;
  canvas.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; swiping = true; A.unlock(); });
  canvas.addEventListener('pointermove', function (e) {
    if (!swiping) return; var dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    var d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 1) : (dy > 0 ? 2 : 0);
    if (mode === 'playing') L.setDir(game, L.DIRS[d]); sx = e.clientX; sy = e.clientY;
  });
  global.addEventListener('pointerup', function () { swiping = false; });
  async function submit() {
    if (submitted || game.score <= 0 || global.location.protocol === 'file:') return; submitted = true;
    try {
      var res = await fetch('/api/leaderboard/rank?gameId=gloam-run&score=' + game.score);
      if (!res.ok) return; var rank = Number((await res.json()).rank);
      if (!Number.isFinite(rank) || rank < 1 || rank > 20) return;
      var name = global.prompt('Top 20! Rank #' + rank + '. Name for the leaderboard?'); if (name === null) return;
      name = String(name).trim().replace(/[^\w \-'.!]/g, '').slice(0, 20); if (!name) return;
      await fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'gloam-run', name: name, score: game.score }) });
    } catch (e) { /* offline play is fine */ }
  }
  function finish() {
    mode = 'end'; A.stopMusic(); panel.hidden = false; title.textContent = 'The gloam wins';
    copy.textContent = game.score.toLocaleString() + ' points · reached maze ' + game.level + ' · ' + game.flipCount + ' shutter flips';
    startBtn.textContent = 'RUN AGAIN'; submit();
  }
  var MSG = { rune: 'RUNE LIT · SHUTTERS FLIPPING', flip: 'SHUTTERS FLIPPED', flare: 'LANTERN FLARE · CATCH THE WISPS', hit: 'CAUGHT BY A WISP', clear: 'MAZE LIT' };
  function frame(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; clock += dt;
    if (mode === 'playing') {
      L.update(game, dt);
      var ev = L.drain(game); R.react(game, ev);
      ev.forEach(function (e) { A.sfx(e, ++emberCount); if (MSG[e]) feedback.textContent = MSG[e]; });
      if (game.cleared) { clearTimer += dt; if (clearTimer > 1.6) { L.nextLevel(game); clearTimer = 0; feedback.textContent = 'MAZE ' + game.level; } }
      if (game.over) finish();
      hud();
    }
    R.draw(canvas, game, clock, dt); requestAnimationFrame(frame);
  }
  fit(); global.addEventListener('resize', fit); requestAnimationFrame(frame);
  GR.Game = { get: function () { return game; }, begin: begin, mode: function () { return mode; } };
})(window);
