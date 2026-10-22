(function (global) {
  'use strict';
  var HG = global.HG, L = HG.Logic, doc = global.document;
  var canvas = doc.getElementById('maze'), state = L.create(Date.now() & 0xffff), last = 0, clock = 0, submitted = false;
  var el = function (id) { return doc.getElementById(id); };
  var panel = el('panel'), title = el('panel-title'), copy = el('panel-copy'), startBtn = el('start');
  HG.Render.size(canvas);

  function hud() {
    el('score').textContent = state.score.toLocaleString(); el('lives').textContent = '♥'.repeat(Math.max(0, state.lives));
    el('level').textContent = state.level;
    var sh = Math.max(0, state.shiftTimer); el('shift-fill').style.width = (100 * (1 - sh / state.params.shift)) + '%';
    el('shift-label').textContent = (state.layer ? 'DUSK' : 'DAY') + (state.shiftWarn ? ' · SHIFTING!' : '');
  }
  function begin(fresh) {
    HG.Audio.unlock(); if (fresh) { state = L.create(Date.now() & 0xffff); submitted = false; }
    panel.hidden = true; el('hint').hidden = false;
  }
  startBtn.addEventListener('click', function () { begin(state.mode === 'over'); });

  var KEYS = { ArrowUp: 0, w: 0, W: 0, ArrowLeft: 1, a: 1, A: 1, ArrowDown: 2, s: 2, S: 2, ArrowRight: 3, d: 3, D: 3 };
  doc.addEventListener('keydown', function (e) {
    if (KEYS[e.key] === undefined) { if (e.key === 'Enter' && !panel.hidden) startBtn.click(); return; }
    e.preventDefault(); HG.Audio.unlock(); if (!panel.hidden && state.mode !== 'over') begin(false); L.setWant(state, KEYS[e.key]);
  });
  Array.prototype.forEach.call(doc.querySelectorAll('[data-dir]'), function (b) {
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); HG.Audio.unlock(); L.setWant(state, +b.getAttribute('data-dir')); });
  });
  var sx, sy;
  canvas.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; HG.Audio.unlock(); });
  canvas.addEventListener('pointermove', function (e) {
    if (sx === undefined) return; var dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    L.setWant(state, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 1) : (dy > 0 ? 2 : 0)); sx = e.clientX; sy = e.clientY;
  });
  canvas.addEventListener('pointerup', function () { sx = undefined; });
  canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  el('mute').addEventListener('click', function (e) { var m = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', m); HG.Audio.mute(m); });

  async function submit() {
    if (submitted || global.location.protocol === 'file:') return; submitted = true;
    try {
      var rs = await fetch('/api/leaderboard/rank?gameId=hedgeshift&score=' + state.score);
      if (!rs.ok) return; var rank = Number((await rs.json()).rank);
      if (!isFinite(rank) || rank < 1 || rank > 20) return;
      var name = global.prompt('Top 20! Rank #' + rank + '. Name for the leaderboard?'); if (name === null) return;
      name = String(name).trim().replace(/[^\w \-'.!]/g, '').slice(0, 20); if (!name) return;
      await fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: 'hedgeshift', name: name, score: state.score }) });
    } catch (err) { /* offline play is fine */ }
  }

  function frame(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; clock += dt;
    L.step(state, dt);
    L.drainEvents(state).forEach(function (e) {
      HG.Audio.play(e); HG.Render.onEvent(e);
      if (e.t === 'over') { title.textContent = 'Lights out'; copy.textContent = state.score.toLocaleString() + ' points · ' + state.crushes + ' hedge crushes · best wisp chain ' + state.bestChain; startBtn.textContent = 'PLAY AGAIN'; panel.hidden = false; submit(); }
      if (e.t === 'clear') setTimeout(function () { state = L.nextLevel(state); }, 1400);
    });
    if (state.shiftWarn && state.mode === 'playing' && Math.floor(clock * 4) !== Math.floor((clock - dt) * 4)) HG.Audio.play({ t: 'warn' });
    HG.Render.draw(canvas, state, dt, clock); hud();
    global.requestAnimationFrame(frame);
  }
  global.HG.state = function () { return state; };
  global.requestAnimationFrame(frame);
})(window);
