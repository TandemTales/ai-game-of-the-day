(function (global) {
  'use strict';
  var TL = global.TL, L = TL.Logic, A = TL.Audio;
  var canvas = document.getElementById('chart-canvas'), panel = document.getElementById('panel');
  var title = document.getElementById('title'), copy = document.getElementById('copy'), tip = document.getElementById('tip');
  var startButton = document.getElementById('start'), pulseButton = document.getElementById('pulse');
  var state = L.newGame(), mode = 'title', dir = null, repeat = 0, last = performance.now(), submitted = false;
  var dirs = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  function resize() {
    var r = canvas.getBoundingClientRect(), d = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * d)); canvas.height = Math.max(1, Math.round(r.height * d));
  }
  global.addEventListener('resize', resize);
  if (global.ResizeObserver) new global.ResizeObserver(resize).observe(canvas);
  resize();
  function hud() {
    document.getElementById('score').textContent = state.score.toLocaleString();
    document.getElementById('claimed').textContent = Math.floor(state.ratio * 100) + '%';
    document.getElementById('lives').textContent = state.lives;
    document.getElementById('time').textContent = Math.ceil(state.time);
    document.getElementById('chart').textContent = '0' + (state.stage + 1) + ' / ' + L.charts[state.stage].toUpperCase();
    document.getElementById('charges').textContent = state.freeze > 0 ? 'HELD · ' + state.freeze.toFixed(1) + 's' : state.charges + (state.charges === 1 ? ' PULSE' : ' PULSES');
    pulseButton.disabled = mode !== 'playing' || !state.charges || state.freeze > 0;
    document.getElementById('notice').textContent = state.last;
    document.getElementById('pause').disabled = mode !== 'playing' && mode !== 'paused';
  }
  function launch() {
    A.unlock(); dir = null; repeat = 0;
    if (mode === 'paused') { mode = 'playing'; }
    else if (mode === 'clear') { L.next(state); mode = 'playing'; }
    else { state = L.newGame(); mode = 'playing'; submitted = false; }
    panel.hidden = true; document.getElementById('pause').textContent = 'Pause'; hud();
    startButton.blur();
  }
  async function submit() {
    if (submitted || !state.score || global.location.protocol === 'file:') return;
    submitted = true;
    try {
      var response = await fetch('/api/leaderboard/rank?gameId=tidelock&score=' + state.score);
      if (!response.ok) return;
      var rank = Number((await response.json()).rank);
      if (!Number.isFinite(rank) || rank < 1 || rank > 20) return;
      var name = global.prompt('Top 20! Rank #' + rank + '. Name for the leaderboard?');
      if (name === null) return;
      name = String(name).trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
      if (!name) return;
      await fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'tidelock', name: name, score: state.score }) });
    } catch (e) { document.getElementById('notice').textContent = 'Score saved for this voyage. Leaderboard offline.'; }
  }
  function finish() {
    dir = null; panel.hidden = false; tip.textContent = state.rescued + ' buoys rescued · ' + (state.stage + 1) + ' / 5 charts reached';
    document.getElementById('kicker').textContent = state.clear && !state.over ? 'PASSAGE SECURED' : 'VOYAGE LOG';
    title.textContent = state.won ? 'The coast is clear.' : state.clear ? 'Safe water.' : 'The tide returns.';
    copy.textContent = state.score.toLocaleString() + ' points · ' + Math.floor(state.ratio * 100) + '% safe water. ' + state.last;
    mode = state.over ? 'end' : 'clear'; startButton.textContent = state.over ? 'SAIL AGAIN ↗' : 'NEXT CHART ↗';
    if (state.over) submit(); hud();
  }
  function pause() {
    if (mode === 'paused') { launch(); return; }
    if (mode !== 'playing') return;
    mode = 'paused'; dir = null; panel.hidden = false; title.textContent = 'At anchor.';
    copy.textContent = 'The chart is held. Your cable and tide clock will wait.';
    tip.textContent = 'Resume when you are ready to set sail.'; startButton.textContent = 'RESUME VOYAGE ↗';
    document.getElementById('kicker').textContent = 'PAUSED'; document.getElementById('pause').textContent = 'Resume'; hud();
  }
  function steer(name) {
    if (mode !== 'playing') return;
    A.unlock(); dir = name; repeat = 0; L.move(state, dirs[name][0], dirs[name][1]);
  }
  var keys = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (keys[key]) { e.preventDefault(); if (!e.repeat) steer(keys[key]); }
    else if (key === ' ') { e.preventDefault(); if (!e.repeat && mode === 'playing') { A.unlock(); L.pulse(state); } }
    else if (key === 'p' || key === 'Escape') { e.preventDefault(); if (!e.repeat) pause(); }
    else if (key === 'Enter' && mode !== 'playing' && e.target.tagName !== 'BUTTON') { e.preventDefault(); launch(); }
  });
  document.addEventListener('keyup', function (e) { var key = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (keys[key] === dir) dir = null; });
  document.querySelectorAll('[data-dir]').forEach(function (b) {
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); b.setPointerCapture(e.pointerId); steer(b.dataset.dir); });
    function release() { if (dir === b.dataset.dir) dir = null; }
    b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
  });
  startButton.addEventListener('click', launch); document.getElementById('pause').addEventListener('click', pause);
  pulseButton.addEventListener('click', function () { if (mode === 'playing') { A.unlock(); L.pulse(state); } });
  document.getElementById('sound').addEventListener('click', function (e) {
    A.unlock(); var muted = A.toggle(); e.currentTarget.textContent = muted ? 'Sound off' : 'Sound on'; e.currentTarget.setAttribute('aria-pressed', String(muted));
  });
  global.addEventListener('blur', function () { dir = null; if (mode === 'playing') pause(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && mode === 'playing') pause(); });
  var serial = state.serial;
  function frame(now) {
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (mode === 'playing') {
      L.tick(state, dt);
      if (!state.over && !state.clear && dir) { repeat += dt; if (repeat >= 0.085) { repeat -= 0.085; L.move(state, dirs[dir][0], dirs[dir][1]); } }
      if (serial !== state.serial) { A.play(state.event); serial = state.serial; }
      if (state.over || state.clear) finish();
    }
    hud(); TL.Render.draw(canvas, state, now / 1000); global.requestAnimationFrame(frame);
  }
  TL.Game = { start: launch, getState: function () { return state; }, getMode: function () { return mode; } };
  hud(); global.requestAnimationFrame(frame);
})(window);
