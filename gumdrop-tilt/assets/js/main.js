/* Integration: input, loop, HUD, leaderboard. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var GT = window.GT, st = GT.createState(Date.now() & 0xffff), cv = $('jar'), ctx = cv.getContext('2d'), nx = $('next'), nctx = nx.getContext('2d');
  var paused = false, last = 0, time = 0, softHeld = false, bannerT = 0;
  function fit() { var r = $('stage').getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2), cs = Math.min(r.width / GT.W, r.height / GT.H); cv.style.width = cs * GT.W + 'px'; cv.style.height = cs * GT.H + 'px'; cv.width = Math.round(cs * GT.W * d); cv.height = Math.round(cs * GT.H * d); nx.width = 80; nx.height = 120; }
  window.addEventListener('resize', fit); fit();
  function banner(t) { var b = $('banner'); b.textContent = t; b.classList.add('on'); bannerT = 1.2; }
  function begin() { st = GT.createState(Date.now() & 0xffff); GT.start(st); $('overlay').classList.add('hidden'); $('scoreForm').hidden = true; paused = false; window.GTA.resume(); cv.focus(); }
  $('startBtn').onclick = begin;
  $('mute').onclick = function () { var m = $('mute').getAttribute('aria-pressed') !== 'true'; $('mute').setAttribute('aria-pressed', m); $('mute').textContent = m ? 'SOUND OFF' : 'SOUND ON'; window.GTA.setMuted(m); };
  function act(a) {
    if (st.status !== 'playing' || paused) return; window.GTA.resume();
    if (a === 'left') GT.move(st, -1); else if (a === 'right') GT.move(st, 1); else if (a === 'rotL') GT.rotate(st, -1); else if (a === 'rotR') GT.rotate(st, 1);
    else if (a === 'down') GT.softDrop(st); else if (a === 'hard') GT.hardDrop(st);
  }
  function pause(p) { if (st.status !== 'playing') return; paused = p; if (p) { $('title').innerHTML = 'PAUSED'; $('startBtn').textContent = 'RESUME'; $('startBtn').onclick = function () { pause(false); }; $('overlay').classList.remove('hidden'); } else { $('overlay').classList.add('hidden'); $('startBtn').textContent = 'PLAY'; $('startBtn').onclick = begin; } }
  var keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rotR', z: 'rotL', Z: 'rotL', x: 'rotR', X: 'rotR', ' ': 'hard' };
  window.addEventListener('keydown', function (e) { if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { pause(!paused); return; } var a = keys[e.key]; if (a) { e.preventDefault(); act(a); } });
  document.querySelectorAll('#pad button').forEach(function (b) { b.addEventListener('pointerdown', function (e) { e.preventDefault(); act(b.dataset.a); }); });
  // touch on board: horizontal drag moves, tap rotates, swipe down soft drops, flick down hard drops
  var tp = null;
  cv.addEventListener('pointerdown', function (e) { tp = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', function (e) {
    if (!tp) return; var cs = cv.clientWidth / GT.W;
    while (e.clientX - tp.x > cs * .8) { act('right'); tp.x += cs * .8; tp.moved = true; } while (tp.x - e.clientX > cs * .8) { act('left'); tp.x -= cs * .8; tp.moved = true; }
    while (e.clientY - tp.y > cs * .8) { act('down'); tp.y += cs * .8; tp.moved = true; }
  });
  cv.addEventListener('pointerup', function (e) { if (!tp) return; var dy = e.clientY - tp.sy, dt = performance.now() - tp.t; if (!tp.moved) act('rotR'); else if (dy > cv.clientHeight * .3 && dt < 250) act('hard'); tp = null; });
  function hud() {
    $('score').textContent = Math.floor(st.score).toLocaleString(); $('chain').textContent = st.maxChain;
    var left = Math.max(0, GT.TILT_EVERY - st.sinceTilt), t = $('tilt'); t.textContent = left; t.className = st.tiltPending ? 'warn' : '';
  }
  function finish() {
    $('title').innerHTML = 'JAR <span>OVERFLOW</span>'; $('blurb').textContent = 'Final score ' + Math.floor(st.score).toLocaleString() + ' · best chain ' + st.maxChain + '.'; $('startBtn').textContent = 'PLAY AGAIN'; $('startBtn').onclick = begin;
    $('scoreForm').hidden = false; $('scoreStatus').textContent = ''; $('overlay').classList.remove('hidden');
  }
  $('scoreForm').addEventListener('submit', async function (e) {
    e.preventDefault(); var btn = e.target.querySelector('button'); btn.disabled = true; var score = Math.max(0, Math.floor(st.score));
    try {
      var r = await fetch('/api/leaderboard/rank?gameId=gumdrop-tilt&score=' + score); if (!r.ok) throw Error('rank'); await r.json();
      var p = await fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: 'gumdrop-tilt', score: score, name: $('callsign').value.trim().slice(0, 20) || 'ANON' }) });
      if (!p.ok) throw Error('submit'); var d = await p.json(); $('scoreStatus').textContent = d.rank ? 'POSTED · RANK #' + d.rank : 'SCORE POSTED';
    } catch (err) { $('scoreStatus').textContent = 'Leaderboard unavailable. Your score is still here.'; } finally { btn.disabled = false; }
  });
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; time += dt;
    if (!paused) {
      var was = st.status; if (softHeld) { /* reserved */ } GT.update(st, dt);
      GT.drainEvents(st).forEach(function (e) {
        window.GTA.play(e); window.GTR.onEvent(e, st);
        if (e.type === 'pop' && e.data.chain >= 2) banner(e.data.chain + '-CHAIN!' + (e.data.tilt ? ' ×2 TILT' : ''));
        if (e.type === 'tiltWarn') banner('TILT INCOMING ' + (e.data < 0 ? '◀' : '▶'));
        if (e.type === 'tilt') banner('SLOSH!'); if (e.type === 'allclear') banner('ALL CLEAR +3000');
      });
      if (was === 'playing' && st.status === 'lost') finish();
      window.GTR.tick(dt);
    }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('on'); }
    window.GTR.draw(ctx, cv, st, time); window.GTR.drawNext(nctx, nx, st); hud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__gt = { get state() { return st; }, begin: begin, act: act };
})();
