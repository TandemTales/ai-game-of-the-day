(function (global) {
  'use strict';
  var PL = global.PL, L = PL.Logic, A = PL.Audio;
  var canvas = document.getElementById('loom'), startButton = document.getElementById('start'),
    panel = document.getElementById('panel'), title = document.getElementById('panel-title'),
    description = document.getElementById('panel-copy'), scoreEl = document.getElementById('score'),
    comboEl = document.getElementById('combo'), sectionEl = document.getElementById('section'),
    feedback = document.getElementById('feedback');
  var run = L.newRun(), state = { mode: 'title', started: 0, lastBeat: -1,
    wall: 0, rotations: 0, lastSection: 0, submitted: false };
  function now() { return (performance.now() - state.started) / 1000; }
  function updateHud(time) {
    scoreEl.textContent = run.score.toLocaleString(); comboEl.textContent = run.combo;
    sectionEl.textContent = Math.min(4, Math.floor(time / (32 * L.BEAT)) + 1) + ' / 4';
    feedback.textContent = run.last || 'FOLLOW THE THREAD';
  }
  function play() {
    A.unlock(); run = L.newRun(); state.mode = 'playing'; state.started = performance.now();
    A.reset(); PL.Render.reset(); state.rotations = 0; state.lastSection = 0;
    state.lastBeat = -1; state.submitted = false; panel.hidden = true; updateHud(0);
  }
  startButton.addEventListener('click', play);
  function hit(lane) {
    if (state.mode !== 'playing') return;
    var time = now(), result = L.tap(run, lane, time), R = PL.Render;
    if (result) {
      var perfect = result === 'PERFECT', thread = run.lastBase;
      A.hit(lane, perfect, L.section(time));
      R.burst(lane, ['#f5bd65', '#fb718f', '#76d6da', '#b6a2ff'][thread], perfect);
      R.popup(perfect ? 'PERFECT' : (run.lastError < 0 ? 'EARLY' : 'LATE'), lane, perfect ? '#fff1cf' : '#9fb4d9');
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
    var y = (e.clientY - rect.top) / rect.height * 800 * canvas.height / canvas.width, lane = PL.Render.laneAt(x, y);
    if (lane >= 0) hit(lane);
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
    state.mode = 'end'; panel.hidden = false; A.finish();
    title.textContent = 'Song woven · Grade ' + L.grade(run);
    description.textContent = run.score.toLocaleString() + ' points · ' + run.perfects + ' perfect of ' +
      run.hits + ' hits · ' + run.misses + ' missed · ' + Math.round(L.accuracy(run) * 100) +
      '% accuracy · ' + run.bestCombo + ' best combo'; startButton.textContent = 'PLAY AGAIN'; submit();
  }
  function frame() {
    var time = state.mode === 'playing' ? now() : 0;
    if (state.mode === 'playing') {
      var beat = Math.floor(time / L.BEAT);
      state.lastBeat = beat;
      var missesBefore = run.misses;
      A.update(time, run.combo);
      L.advance(run, time);
      if (run.misses > missesBefore) { A.miss(); PL.Render.miss(run.lastMissLane); }
      var sec = L.section(time);
      if (sec !== state.lastSection) { state.lastSection = sec; A.rotate(); PL.Render.rotate(time); }
      updateHud(time);
      if (run.ended) finish();
    }
    state.wall = performance.now() / 1000; fit();
    PL.Render.draw(canvas, run, time, state); requestAnimationFrame(frame);
  }
  function fit() {
    var dpr = Math.min(2, global.devicePixelRatio || 1), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
  }
  global.addEventListener('resize', fit); fit();
  updateHud(0); requestAnimationFrame(frame);
  PL.Game = { getRun: function () { return run; }, getState: function () { return state; }, play: play, hit: hit };
})(window);
