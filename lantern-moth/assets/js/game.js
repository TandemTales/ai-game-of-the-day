(function (global) {
  'use strict';
  var LM = global.LM, L = LM.Logic, A = LM.Audio, R = LM.Render;
  function $(id) { return document.getElementById(id); }
  var canvas = $('maze'), panel = $('panel'), title = $('panel-title'), copy = $('panel-copy'), startBtn = $('start'),
    scoreEl = $('score'), livesEl = $('lives'), levelEl = $('level'), bestEl = $('best'), toast = $('toast'),
    feedback = $('feedback'), muteBtn = $('mute');
  var run = L.newRun(1), mode = 'title', last = 0, acc = 0, clock = 0, submitted = false, best = 0, toastUntil = 0;
  try { best = Number(global.localStorage.getItem('lantern-moth-best')) || 0; } catch (e) { best = 0; }
  function hud() {
    scoreEl.textContent = run.score.toLocaleString(); livesEl.textContent = Math.max(0, run.lives);
    levelEl.textContent = run.level; bestEl.textContent = Math.max(best, run.score).toLocaleString();
  }
  function start() {
    A.unlock(); run = L.newRun((Date.now() & 0xffff) || 1); mode = 'playing'; submitted = false; panel.hidden = true;
    feedback.textContent = 'Eat every firefly'; hud();
  }
  startBtn.addEventListener('click', start);
  muteBtn.addEventListener('click', function () {
    var m = !A.isMuted(); A.setMuted(m); muteBtn.setAttribute('aria-pressed', String(m)); muteBtn.textContent = m ? 'Sound off' : 'Sound on';
  });
  function steer(d) { if (mode !== 'playing') return; A.unlock(); L.setDir(run, d); }
  var KEYS = { arrowup: 0, w: 0, arrowright: 1, d: 1, arrowdown: 2, s: 2, arrowleft: 3, a: 3 };
  document.addEventListener('keydown', function (e) {
    var d = KEYS[e.key.toLowerCase()];
    if (d !== undefined) { e.preventDefault(); steer(d); }
    else if (e.key === 'Enter' && mode !== 'playing') start();
  });
  Array.prototype.forEach.call(document.querySelectorAll('.dpad button'), function (b) {
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); steer(Number(b.dataset.d)); });
  });
  var touch = null;
  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); touch = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointermove', function (e) {
    if (!touch) return;
    var dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)); touch = { x: e.clientX, y: e.clientY };
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { canvas.addEventListener(n, function () { touch = null; }); });
  async function submit() {
    if (submitted || run.score <= 0 || global.location.protocol === 'file:') return;
    submitted = true;
    try {
      var response = await fetch('/api/leaderboard/rank?gameId=lantern-moth&score=' + run.score);
      if (!response.ok) return;
      var rank = Number((await response.json()).rank);
      if (!Number.isFinite(rank) || rank < 1 || rank > 20) return;
      var name = global.prompt('Top 20! Rank #' + rank + '. Name for the leaderboard?');
      if (name === null) return;
      name = String(name).trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
      if (!name) return;
      await fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'lantern-moth', name: name, score: run.score }) });
    } catch (e) { /* Offline play is fully supported. */ }
  }
  function finish() {
    mode = 'end'; if (run.score > best) { best = run.score; try { global.localStorage.setItem('lantern-moth-best', String(best)); } catch (e) {} }
    title.textContent = 'Lights out'; copy.textContent = run.score.toLocaleString() + ' points · night ' + run.level + ' · ' +
      run.stats.seeds + ' fireflies · ' + run.stats.spiders + ' spiders caught';
    startBtn.textContent = 'PLAY AGAIN'; panel.hidden = false; hud(); submit();
  }
  function frame(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; clock += dt;
    if (mode === 'playing' && !document.hidden) {
      acc += dt;
      while (acc >= 1 / 60) { L.step(run, 1 / 60); acc -= 1 / 60; }
      R.consume(run, run.events);
      run.events.forEach(function (e) {
        A.play(e);
        if (e.type === 'warn') { toast.hidden = false; toastUntil = clock + 1.6; }
        if (e.type === 'clear') feedback.textContent = 'Night cleared!';
      });
      run.events.length = 0;
      if (toastUntil && clock > toastUntil) { toast.hidden = true; toastUntil = 0; }
      hud();
      if (run.over) finish();
    }
    R.draw(canvas, run, clock, dt);
    requestAnimationFrame(frame);
  }
  hud(); requestAnimationFrame(frame);
  LM.Game = { getRun: function () { return run; }, start: start, steer: steer };
})(window);
