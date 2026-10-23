(function (global) {
  'use strict';
  var FW = global.FW, L = FW.Logic, A = FW.Audio, $ = function (id) { return document.getElementById(id); };
  var canvas = $('board'), panel = $('panel'), startBtn = $('start'), title = $('panel-title'), copy = $('panel-copy');
  var s = L.newGame({ seed: 1337 }), mode = 'title', last = 0, submitted = false, keys = {}, seed = 1337, best = 0;
  try { best = Number(localStorage.getItem('fuseworks-best')) || 0; } catch (e) { /* storage optional */ }

  function hud() {
    $('score').textContent = s.score.toLocaleString(); $('lives').textContent = Math.max(0, s.lives);
    $('floor').textContent = s.level; $('time').textContent = Math.ceil(s.timeLeft);
    $('power').textContent = s.power; $('bombs').textContent = s.maxBombs;
    $('time').parentNode.classList.toggle('warn', s.timeLeft < 20);
  }
  function start(fresh) {
    A.unlock();
    if (fresh || mode === 'over' || mode === 'title') { seed = (Date.now() % 90000) + 1; s = L.newGame({ seed: seed }); submitted = false; }
    mode = 'play'; panel.hidden = true; last = performance.now();
  }
  startBtn.addEventListener('click', function () { start(true); });

  function dirFromKeys() {
    var dx = 0, dy = 0;
    if (keys.ArrowLeft || keys.a) dx = -1; else if (keys.ArrowRight || keys.d) dx = 1;
    else if (keys.ArrowUp || keys.w) dy = -1; else if (keys.ArrowDown || keys.s) dy = 1;
    return [dx, dy];
  }
  function applyInput() { var d = dirFromKeys(), t = touchDir; L.setDir(s, d[0] || t[0], d[1] || t[1]); }
  var touchDir = [0, 0];
  document.addEventListener('keydown', function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].indexOf(k) >= 0) e.preventDefault();
    if (k === 'Enter' && mode !== 'play') { start(true); return; }
    if (k === 'p' && (mode === 'play' || mode === 'pause')) { toggleSound(false); mode = mode === 'play' ? 'pause' : 'play'; last = performance.now(); return; }
    if (k === 'm') { toggleSound(true); return; }
    if (e.repeat) { keys[k] = true; return; }
    keys[k] = true;
    if ((k === ' ' || k === 'x' || k === 'Enter') && mode === 'play') { A.unlock(); L.placeBomb(s); }
    applyInput();
  });
  document.addEventListener('keyup', function (e) { delete keys[e.key.length === 1 ? e.key.toLowerCase() : e.key]; applyInput(); });
  function toggleSound(flip) { if (flip) { A.mute(!A.isMuted()); $('mute').setAttribute('aria-pressed', A.isMuted()); $('mute').textContent = A.isMuted() ? '🔇' : '🔊'; } }
  $('mute').addEventListener('click', function () { toggleSound(true); });

  // Touch: d-pad buttons and bomb button.
  Array.prototype.forEach.call(document.querySelectorAll('[data-dir]'), function (b) {
    var d = b.getAttribute('data-dir').split(',').map(Number);
    function on(e) { e.preventDefault(); A.unlock(); touchDir = d; applyInput(); }
    function off(e) { e.preventDefault(); touchDir = [0, 0]; applyInput(); }
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  });
  $('bomb-btn').addEventListener('pointerdown', function (e) { e.preventDefault(); A.unlock(); if (mode === 'play') L.placeBomb(s); });

  async function submit() {
    if (submitted || s.score <= 0 || global.location.protocol === 'file:') return;
    submitted = true;
    try {
      var r = await fetch('/api/leaderboard/rank?gameId=fuseworks&score=' + s.score);
      if (!r.ok) return;
      var rank = Number((await r.json()).rank);
      if (!Number.isFinite(rank) || rank < 1 || rank > 20) return;
      var name = global.prompt('Top 20! Rank #' + rank + '. Name for the leaderboard?');
      if (name === null) return;
      name = String(name).trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
      if (!name) return;
      await fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'fuseworks', name: name, score: s.score }) });
    } catch (e) { /* offline play is supported */ }
  }

  function frame(ts) {
    var dt = Math.min(.1, (ts - last) / 1000); last = ts;
    if (mode === 'play') {
      applyInput(); L.update(s, dt);
      s.events.forEach(A.event);
      A.tick(true, s.timeLeft < 20);
      if (s.phase === 'next') { s = L.nextLevel(s); }
      if (s.phase === 'over') { mode = 'over'; if (s.score > best) { best = s.score; try { localStorage.setItem('fuseworks-best', best); } catch (e) { /* ok */ } }
        panel.hidden = false; title.textContent = 'Foundry lost'; copy.textContent = s.score.toLocaleString() + ' points · floor ' + s.level + ' · best ' + best.toLocaleString();
        startBtn.textContent = 'PLAY AGAIN'; submit(); }
    } else A.tick(false);
    hud(); FW.Render.draw(canvas, s, ts / 1000);
    if (s.phase === 'clear') $('banner').textContent = 'FLOOR ' + s.level + ' CLEARED'; else $('banner').textContent = '';
    requestAnimationFrame(frame);
  }
  function fit() { var p = global.matchMedia && global.matchMedia('(max-width: 700px) and (orientation: portrait)').matches; canvas.width = 728; canvas.height = 616; }
  fit(); global.addEventListener('resize', fit);
  requestAnimationFrame(function (t) { last = t; frame(t); });
  FW.Game = { state: function () { return s; }, start: start };
})(window);
