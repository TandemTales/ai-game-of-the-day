(function (global) {
  'use strict';
  var GR = global.GR, L = GR.Logic, A = GR.Audio, R = GR.Render;
  var canvas = document.getElementById('garden'), startButton = document.getElementById('start'),
    panel = document.getElementById('panel'), title = document.getElementById('panel-title'),
    description = document.getElementById('panel-copy'), scoreEl = document.getElementById('score'),
    levelEl = document.getElementById('level'), livesEl = document.getElementById('lives'),
    feedback = document.getElementById('feedback'), pad = document.getElementById('pad');
  var run = L.newRun(), state = { mode: 'title', submitted: false }, clock = 0, last = 0, acc = 0, hudKey = '';
  function updateHud() {
    var key = run.score + '|' + run.level + '|' + run.lives;
    if (key === hudKey) return; hudKey = key;
    scoreEl.textContent = run.score.toLocaleString(); levelEl.textContent = run.level; livesEl.textContent = Math.max(0, run.lives);
  }
  function play() {
    A.begin(); run = L.newRun(Date.now() % 100000 + 1); state.mode = 'playing'; state.submitted = false;
    panel.hidden = true; hudKey = ''; feedback.textContent = 'GATHER EVERY MOTE'; updateHud();
  }
  startButton.addEventListener('click', play);
  function steer(d) { if (state.mode === 'playing') { if (A.status() === 'blocked') A.unlock(); L.steer(run, d); } }
  var KEYS = { arrowup: 0, w: 0, arrowleft: 1, a: 1, arrowdown: 2, s: 2, arrowright: 3, d: 3 };
  document.addEventListener('keydown', function (e) {
    var d = KEYS[e.key.toLowerCase()];
    if (d !== undefined) { e.preventDefault(); steer(d); }
    else if (e.key === 'Enter' && state.mode !== 'playing') play();
  });
  pad.addEventListener('pointerdown', function (e) { var b = e.target.closest('button'); if (b) { e.preventDefault(); steer(+b.dataset.d); } });
  var sx = 0, sy = 0, tracking = false;
  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); sx = e.clientX; sy = e.clientY; tracking = true; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} });
  canvas.addEventListener('pointermove', function (e) {
    if (!tracking) return; var dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 1) : (dy > 0 ? 2 : 0)); sx = e.clientX; sy = e.clientY;
  });
  canvas.addEventListener('pointerup', function () { tracking = false; });
  canvas.addEventListener('pointercancel', function () { tracking = false; });
  async function submit() {
    if (state.submitted || run.score <= 0 || global.location.protocol === 'file:') return;
    state.submitted = true;
    try {
      var response = await fetch('/api/leaderboard/rank?gameId=gloam-run&score=' + run.score);
      if (!response.ok) return;
      var rank = Number((await response.json()).rank);
      if (!Number.isFinite(rank) || rank < 1 || rank > 20) return;
      var name = global.prompt('Top 20! Rank #' + rank + '. Name for the leaderboard?');
      if (name === null) return;
      name = String(name).trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
      if (!name) return;
      await fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'gloam-run', name: name, score: run.score }) });
    } catch (e) { /* Offline play is fully supported. */ }
  }
  function finish() {
    state.mode = 'end'; panel.hidden = false; title.textContent = 'The lights go out';
    description.textContent = run.score.toLocaleString() + ' points · level ' + run.level + ' · ' + run.eaten + ' Shades chased off';
    startButton.textContent = 'PLAY AGAIN'; submit();
  }
  function frame(ts) {
    var dt = Math.min(.05, (ts - (last || ts)) / 1000); last = ts; clock += dt;
    if (state.mode === 'playing') {
      // Peek at events for audio before the renderer drains them.
      var before = run.events.length; L.advance(run, dt);
      for (var i = before; i < run.events.length; i++) {
        var e = run.events[i];
        if (e.type === 'mote') A.mote(); else if (e.type === 'lantern') A.lantern(); else if (e.type === 'eat') A.eat(run.chain);
        else if (e.type === 'gates') { A.gates(); feedback.textContent = 'GATES TURNED'; }
        else if (e.type === 'die') A.die(); else if (e.type === 'bloom') A.bloom(); else if (e.type === 'clear') A.clear();
      }
      var near = 9; run.hunters.forEach(function (h) { if (h.mode !== 'scared' && h.mode !== 'house' && h.mode !== 'return') near = Math.min(near, Math.abs(h.x - run.wick.x) + Math.abs(h.y - run.wick.y)); });
      A.ambient(Math.max(0, 1 - near / 9));
      updateHud(); if (run.ended) finish();
    }
    R.draw(canvas, run, clock, state); requestAnimationFrame(frame);
  }
  updateHud(); requestAnimationFrame(frame);
  GR.Game = { getRun: function () { return run; }, getState: function () { return state; }, play: play, steer: steer };
})(window);
