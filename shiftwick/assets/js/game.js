/* SHIFTWICK glue: input, loop, HUD, overlays, leaderboard. */
(function (g) {
  'use strict';
  var SW = g.SW, GAME_ID = 'shiftwick', $ = function (id) { return document.getElementById(id); };
  var state = null, running = false, armed = false, best = 0, last = 0, acc = 0, paused = false;
  var FIXED = 1 / 120;
  try { best = +localStorage.getItem('shiftwick.best') || 0; } catch (e) {}
  var isTouch = ('ontouchstart' in g) || (navigator.maxTouchPoints > 0);
  if (isTouch) document.documentElement.classList.add('touch');

  var KEYDIR = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
  function setWant(d) { if (state) state.p.want = SW.DIRS[d]; }
  function doShift(d) { if (!state || !SW.tryShift(state, d)) { if (state && state.charges < 1) toast('No Shift charge - eat embers'); return; } setArmed(false); }
  function setArmed(a) { armed = a; var b = $('shiftbtn'); if (b) b.classList.toggle('armed', a); }
  function toast(t) { var e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove('on'); }, 1400); }

  g.addEventListener('keydown', function (e) {
    SW.Audio.init();
    if (e.code === 'KeyP' || e.code === 'Escape') { if (running) { paused = !paused; overlayPause(paused); } return; }
    if (e.code === 'Enter' && !running && !$('overlay').classList.contains('hidden') && !document.activeElement.matches('input')) { start(); return; }
    if (!running || paused) return;
    if (e.code === 'Space') { e.preventDefault(); setArmed(!armed); return; }
    if (e.code in KEYDIR) { e.preventDefault(); var d = KEYDIR[e.code]; if (e.shiftKey || armed) doShift(d); else setWant(d); }
  });

  // swipe + tap on the canvas
  var cv = $('sw-canvas'), sx = 0, sy = 0, sid = null, swiped = false;
  cv.addEventListener('pointerdown', function (e) { SW.Audio.init(); sid = e.pointerId; sx = e.clientX; sy = e.clientY; swiped = false; });
  cv.addEventListener('pointermove', function (e) {
    if (e.pointerId !== sid || !running || paused) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    var d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    if (armed) { if (!swiped) doShift(d); } else setWant(d);
    swiped = true; sx = e.clientX; sy = e.clientY;
  });
  cv.addEventListener('pointerup', function (e) { if (e.pointerId === sid) sid = null; });
  cv.addEventListener('pointercancel', function () { sid = null; });
  var sb = $('shiftbtn');
  sb.addEventListener('pointerdown', function (e) { e.preventDefault(); SW.Audio.init(); if (running) setArmed(!armed); });

  $('mute').addEventListener('click', function () { SW.Audio.setMuted(!SW.Audio.isMuted()); $('mute').textContent = SW.Audio.isMuted() ? '🔇 Sound off' : '🔊 Sound on'; });
  $('mute').textContent = SW.Audio.isMuted() ? '🔇 Sound off' : '🔊 Sound on';

  function hud() {
    if (!state) return;
    $('score').textContent = state.score.toLocaleString(); $('best').textContent = Math.max(best, state.score).toLocaleString();
    $('level').textContent = state.level + 1; $('lives').textContent = '♥'.repeat(Math.max(0, state.lives));
    var h = ''; for (var i = 0; i < state.maxCharges; i++) h += '<span class="pip' + (i < state.charges ? ' on' : '') + '"></span>';
    if ($('charges').getAttribute('data-h') !== h) { $('charges').innerHTML = h; $('charges').setAttribute('data-h', h); }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    if (state && running && !paused) {
      acc += dt;
      while (acc >= FIXED) { SW.step(state, FIXED); acc -= FIXED; }
      var ev = state.events; state.events = [];
      for (var i = 0; i < ev.length; i++) { SW.Render.event(ev[i]); SW.Audio.event(ev[i]); if (ev[i].type === 'over') gameOver(); if (ev[i].type === 'clear') toast('Maze cleared! Level ' + (state.level + 1)); }
      hud();
    }
    SW.Render.draw(state, { armed: armed });
  }

  function overlay(html) { var o = $('overlay'); o.innerHTML = '<div class="card">' + html + '</div>'; o.classList.remove('hidden'); }
  function hide() { $('overlay').classList.add('hidden'); }
  function overlayPause(p) { if (p) { overlay('<h1>Paused</h1><p class="sub">The flame waits.</p><button class="btn" id="resume">Resume</button>'); $('resume').onclick = function () { paused = false; hide(); }; } else hide(); }
  function menu() {
    overlay('<h1>SHIFTWICK</h1><p class="sub">You are a living flame. The Shades want you out.</p><ul>' +
      '<li>Eat every <b>ember</b>. Eat <b>moon-flames</b> to turn Shades pale &amp; snuffable.</li>' +
      '<li><b>Shift</b> slides your whole row or column one tile - reshaping the maze and stunning Shades riding it.</li>' +
      '<li>Move: <kbd>arrows</kbd>/<kbd>WASD</kbd> or swipe. Shift: <kbd>Shift</kbd>+direction, or <kbd>Space</kbd> then direction (touch: tap the SHIFT button, then swipe).</li>' +
      '<li>Charges refill over time and from moon-flames.</li></ul>' +
      '<button class="btn" id="go">Play</button><a class="btn ghost" href="../index.html">Back to Arcade</a>' + (best ? '<p class="sub">Best: ' + best.toLocaleString() + '</p>' : ''));
    $('go').onclick = start;
  }
  function start() {
    SW.Audio.init(); SW.Audio.drone(true);
    state = SW.create({ seed: (Date.now() & 0xffff) + 1 }); running = true; paused = false; acc = 0; setArmed(false); hide(); hud(); SW.Render.resize();
  }
  async function gameOver() {
    running = false; setArmed(false); SW.Audio.drone(false);
    var score = state.score, isBest = score > best;
    if (isBest) { best = score; try { localStorage.setItem('shiftwick.best', String(best)); } catch (e) {} }
    overlay('<h1>Snuffed Out</h1><div class="big">' + score.toLocaleString() + '</div><p class="sub">Level ' + (state.level + 1) + (isBest ? ' - new best!' : '') + '</p><div id="lbslot"></div>' +
      '<button class="btn" id="again">Play again</button><a class="btn ghost" href="../leaderboard.html?gameId=' + GAME_ID + '">Leaderboard</a>');
    $('again').onclick = start;
    if (g.location && g.location.protocol === 'file:') return;
    try {
      var res = await fetch('/api/leaderboard/rank?gameId=' + encodeURIComponent(GAME_ID) + '&score=' + encodeURIComponent(score), { headers: { Accept: 'application/json' } });
      if (!res.ok) return; var d = await res.json(), rank = Number(d && d.rank);
      if (!isFinite(rank) || rank <= 0 || rank > 20) return;
      $('lbslot').innerHTML = '<p class="sub">Rank <b>#' + rank + '</b> - sign the ledger</p><input id="nm" maxlength="20" placeholder="Your name" autocomplete="off"><button class="btn" id="sub">Submit</button>';
      $('sub').onclick = async function () {
        var name = String($('nm').value).trim().replace(/[^\w \-'.!]/g, '').slice(0, 20); if (!name) return;
        $('sub').disabled = true;
        try { await fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: GAME_ID, name: name, score: score }) }); $('lbslot').innerHTML = '<p class="sub">Submitted - rank #' + rank + '</p>'; } catch (e) { $('lbslot').innerHTML = '<p class="sub">Could not submit.</p>'; }
      };
    } catch (e) { /* offline */ }
  }

  SW.Render.init(cv);
  g.addEventListener('resize', function () { SW.Render.resize(); });
  g.addEventListener('blur', function () { if (running && !paused) { paused = true; overlayPause(true); } });
  state = SW.create({ seed: 4242 }); // attract backdrop
  menu(); requestAnimationFrame(frame);
  g.SW.debug = { start: start, get state() { return state; }, shift: doShift, want: setWant };
})(window);
