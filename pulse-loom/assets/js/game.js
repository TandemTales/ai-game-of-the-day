(function (global) {
  'use strict';
  var PL = global.PL, L = PL.Logic, A = PL.Audio;
  var canvas = document.getElementById('loom'), startButton = document.getElementById('start'),
    panel = document.getElementById('panel'), title = document.getElementById('panel-title'),
    description = document.getElementById('panel-copy'), scoreEl = document.getElementById('score'),
    comboEl = document.getElementById('combo'), sectionEl = document.getElementById('section'),
    feedback = document.getElementById('feedback');
  var run = L.newRun(), state = { mode: 'title', started: 0,
    flashUntil: 0, flashLane: 0, submitted: false };
  function now() { return (performance.now() - state.started) / 1000; }
  function updateHud(time) {
    scoreEl.textContent = run.score.toLocaleString(); comboEl.textContent = run.combo;
    sectionEl.textContent = Math.max(1, Math.min(4, Math.floor(time / (32 * L.BEAT)) + 1)) + ' / 4';
    feedback.textContent = run.last || 'FOLLOW THE THREAD';
  }
  async function play() {
    if (state.mode === 'starting') return;
    state.mode = 'starting';
    var lead = await A.begin();
    run = L.newRun(); state.mode = 'playing'; state.started = performance.now() + lead * 1000;
    state.submitted = false; panel.hidden = true; updateHud(0);
  }
  startButton.addEventListener('click', play);
  function hit(lane) {
    if (state.mode !== 'playing') return;
    var time = now(), result = L.tap(run, lane, time);
    if (result) {
      A.hit(lane, result === 'PERFECT', Math.round(time / L.BEAT));
      state.flashLane = lane; state.flashUntil = time + .22;
      updateHud(time);
    }
  }
  document.addEventListener('keydown', function (e) {
    var lane = { d: 0, f: 1, j: 2, k: 3 }[e.key.toLowerCase()];
    if (lane !== undefined) { e.preventDefault(); if (!e.repeat) hit(lane); }
    else if (e.key === 'Enter' && state.mode !== 'playing') play();
  });
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width * 800;
    if (x >= 104 && x < 696) hit(Math.floor((x - 104) / 148));
  });
  async function submit() {
    if (state.submitted || run.score <= 0 || global.location.protocol === 'file:') return;
    state.submitted = true;
    try {
      var response = await fetch('/api/leaderboard/rank?gameId=pulse-loom&score=' + run.score);
      if (!response.ok) return;
      var rank = Number((await response.json()).rank);
      if (!Number.isFinite(rank) || rank < 1 || rank > 20) return;
      var name = global.prompt('Top 20! Rank #' + rank + '. Name for the leaderboard?');
      if (name === null) return;
      name = String(name).trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
      if (!name) return;
      await fetch('/api/leaderboard/submit', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'pulse-loom', name: name, score: run.score }) });
    } catch (e) { /* Offline play is fully supported. */ }
  }
  function finish() {
    state.mode = 'end'; panel.hidden = false; title.textContent = 'Song woven';
    description.textContent = run.score.toLocaleString() + ' points · ' + run.hits + ' hits · ' +
      run.bestCombo + ' best combo'; startButton.textContent = 'PLAY AGAIN'; submit();
  }
  function frame() {
    var time = state.mode === 'playing' ? now() : 0;
    if (state.mode === 'playing') {
      A.schedule(time, L.BEAT);
      var missesBefore = run.misses;
      L.advance(run, time);
      if (run.misses > missesBefore) A.miss();
      updateHud(time);
      if (run.ended) finish();
    }
    PL.Render.draw(canvas, run, time, state); requestAnimationFrame(frame);
  }
  updateHud(0); requestAnimationFrame(frame);
  PL.Game = { getRun: function () { return run; }, getState: function () { return state; }, play: play, hit: hit };
})(window);
