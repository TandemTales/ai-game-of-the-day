(function (global) {
  'use strict';
  var GW = global.GW, L = GW.Logic, A = GW.Audio;
  var canvas = document.getElementById('board'), panel = document.getElementById('panel');
  var title = document.getElementById('panel-title'), copy = document.getElementById('panel-copy');
  var startButton = document.getElementById('start'), scoreEl = document.getElementById('score');
  var linesEl = document.getElementById('lines'), levelEl = document.getElementById('level');
  var notice = document.getElementById('notice'), rewindButton = document.getElementById('rewind');
  var bankStatus = document.getElementById('bank-status');
  var state = L.newGame(), mode = 'title', last = performance.now(), noticeAt = 0, submitted = false;
  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect(), ratio = global.devicePixelRatio || 1;
    var width = Math.max(1, Math.round(rect.width * ratio));
    var height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
    }
  }
  if (global.ResizeObserver) new global.ResizeObserver(resizeCanvas).observe(canvas);
  global.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  function hud() {
    scoreEl.textContent = state.score.toLocaleString();
    linesEl.textContent = state.lines; levelEl.textContent = state.level;
    rewindButton.disabled = mode !== 'playing' || state.cogs < 3 || !state.history;
    var canRewind = !rewindButton.disabled;
    bankStatus.textContent = canRewind ? state.cogs + ' COGS' : state.cogs + ' / 3 COGS';
    bankStatus.classList.toggle('ready', canRewind);
    rewindButton.setAttribute('aria-label', canRewind ? 'Rewind last lock, spend three cogs' : 'Rewind needs three cogs and a locked piece');
    var status = state.last === 'LOCKED' ? 'Clear gears · earn rewinds' :
      state.last === 'LAST LOCK REWOUND' ? 'REWOUND · PLACE IT AGAIN' :
      state.last === 'READY' ? '3 cogs = 1 rewind' : state.last;
    if (notice.textContent !== status) notice.textContent = status;
  }
  function start() {
    state = L.newGame(); mode = 'playing'; submitted = false; panel.hidden = true;
    state.last = 'BUILD THE GEAR'; noticeAt = performance.now(); hud();
  }
  startButton.addEventListener('click', start);
  function end() {
    if (mode !== 'playing') return;
    mode = 'end'; panel.hidden = false; title.textContent = 'The well is full.';
    copy.textContent = state.score.toLocaleString() + ' points · ' + state.lines +
      (state.lines === 1 ? ' line cleared · level ' : ' lines cleared · level ') + state.level + '. Press Enter or play again.';
    startButton.textContent = 'PLAY AGAIN'; hud(); submit();
  }
  function act(action) {
    if (mode !== 'playing') return;
    var oldHistory = state.history, oldLines = state.lines, worked = false;
    if (action === 'left') worked = L.move(state, -1, 0);
    else if (action === 'right') worked = L.move(state, 1, 0);
    else if (action === 'rotate') worked = L.rotate(state);
    else if (action === 'down') { worked = L.move(state, 0, 1); if (worked) state.score++; else { L.lock(state); worked = true; } }
    else if (action === 'drop') { L.hardDrop(state); worked = true; }
    else if (action === 'rewind') worked = L.rewind(state);
    if (worked) {
      if (action === 'rotate') A.rotate();
      else if (action === 'rewind') A.rewind();
      else if (state.history !== oldHistory) A.lock();
      else A.move();
      if (state.lines > oldLines) A.clear();
      noticeAt = performance.now(); hud();
    }
    if (state.over) end();
  }
  document.addEventListener('keydown', function (e) {
    var action = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
      ArrowDown: 'down', s: 'down', ArrowUp: 'rotate', w: 'rotate', x: 'rotate',
      ' ': 'drop', Enter: mode === 'playing' ? 'drop' : 'start', u: 'rewind' }[e.key];
    if (!action) return;
    e.preventDefault(); if (action === 'start') start();
    else if (!(e.repeat && (action === 'rotate' || action === 'drop' || action === 'rewind'))) act(action);
  });
  document.querySelectorAll('[data-action]').forEach(function (button) {
    var timer = null, action = button.getAttribute('data-action');
    function stop() { if (timer) clearInterval(timer); timer = null; button.classList.remove('pressed'); }
    button.addEventListener('pointerdown', function (e) {
      e.preventDefault(); button.setPointerCapture(e.pointerId); button.classList.add('pressed');
      act(action);
      if (action === 'left' || action === 'right' || action === 'down')
        timer = setInterval(function () { act(action); }, 115);
    });
    button.addEventListener('pointerup', stop); button.addEventListener('pointercancel', stop);
    button.addEventListener('lostpointercapture', stop);
  });
  async function submit() {
    if (submitted || state.score <= 0 || global.location.protocol === 'file:') return;
    submitted = true;
    try {
      var response = await fetch('/api/leaderboard/rank?gameId=gearwell&score=' + state.score);
      if (!response.ok) return;
      var rank = Number((await response.json()).rank);
      if (!Number.isFinite(rank) || rank < 1 || rank > 20) return;
      var name = global.prompt('Top 20! Rank #' + rank + '. Name for the leaderboard?');
      if (name === null) return;
      name = String(name).trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
      if (!name) return;
      await fetch('/api/leaderboard/submit', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'gearwell', name: name, score: state.score }) });
    } catch (e) { /* Offline play continues. */ }
  }
  function frame(now) {
    var dt = Math.min(.1, (now - last) / 1000); last = now;
    if (mode === 'playing') {
      var oldHistory = state.history, oldLines = state.lines;
      L.tick(state, dt);
      if (state.history !== oldHistory) {
        A.lock(); if (state.lines > oldLines) A.clear();
        noticeAt = now;
      }
      hud(); if (state.over) end();
    }
    GW.Render.draw(canvas, state, (now - noticeAt) / 1000);
    global.requestAnimationFrame(frame);
  }
  hud(); global.requestAnimationFrame(frame);
  GW.Game = { start: start, act: act, getState: function () { return state; }, getMode: function () { return mode; } };
})(window);
