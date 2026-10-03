/* Blastwick - game loop, input, UI glue, leaderboard. */
(function () {
  'use strict';
  var BW = window.BW, R = BW.Render, A = BW.Audio, GAME_ID = 'blastwick';
  var cv = document.getElementById('cv'), g = cv.getContext('2d');
  var $ = function (id) { return document.getElementById(id); };
  var overlay = $('overlay'), banner = $('banner');
  var run = null, world = null, mode = 'title', acc = 0, last = 0, bombQueued = false, bannerT = 0;
  var keys = {}, stick = { x: 0, y: 0 }, submitting = false;

  function startRun() {
    run = { seed: (Math.random() * 1e6) | 0, round: 1, score: 0, lives: 3, carry: null };
    startRound();
  }
  function startRound() {
    world = BW.createWorld({ seed: run.seed, round: run.round, score: run.score, lives: run.lives, carry: run.carry });
    R.parts.length = 0; R.texts.length = 0; R.rings.length = 0;
    acc = 0; mode = 'play'; overlay.classList.remove('show');
    resize(); A.init(); A.startMusic(); A.setIntensity(Math.min(1, run.round / 6));
    say('ROUND ' + run.round, 1.6); hud();
  }
  function say(t, d) { banner.textContent = t; banner.classList.add('on'); bannerT = d; }

  function show(html) { overlay.innerHTML = '<div class="card">' + html + '</div>'; overlay.classList.add('show'); }

  function roundEnd() {
    if (world.state === 'won') {
      run.score = world.score; run.carry = BW.carryOf(world); mode = 'between';
      A.setIntensity(0);
      show('<h2>ROUND ' + run.round + ' CLEAR</h2><div class="res">' +
        '<span>Rivals blasted</span><span>' + world.kills + '</span><span>Bank shots</span><span>' + world.bankShots + '</span>' +
        '<span>Best chain</span><span>x' + world.bestChain + '</span><span>Time bonus</span><span>+' + world.timeBonus + '</span>' +
        '<span>Round bonus</span><span>+' + world.roundBonus + '</span><span>Score</span><span>' + run.score + '</span></div>' +
        '<button class="big" id="btnNext">Round ' + (run.round + 1) + ' &rarr;</button>');
      $('btnNext').onclick = function () { run.round++; A.ui(); startRound(); };
    } else {
      run.score = world.score; run.lives--; run.carry = null;
      if (run.lives > 0) {
        mode = 'between'; A.lose();
        show('<h2>BLOWN UP!</h2><p class="tag">' + run.lives + (run.lives === 1 ? ' life' : ' lives') + ' left</p><div class="res"><span>Score</span><span>' + run.score + '</span></div><button class="big" id="btnNext">Retry Round ' + run.round + '</button>');
        $('btnNext').onclick = function () { A.ui(); startRound(); };
      } else gameOver();
    }
    hud();
  }

  function gameOver() {
    mode = 'over'; A.lose(); A.stopMusic();
    show('<h2>GAME OVER</h2><div class="res"><span>Final score</span><span>' + run.score + '</span><span>Reached round</span><span>' + run.round + '</span></div>' +
      '<div id="lbBox"><p class="small">Checking leaderboard&hellip;</p></div>' +
      '<button class="big alt" id="btnAgain">Play Again</button>');
    $('btnAgain').onclick = function () { A.ui(); startRun(); };
    checkRank(run.score);
  }
  function checkRank(score) {
    var box = $('lbBox'), dest = '../leaderboard.html?gameId=' + encodeURIComponent(GAME_ID);
    function link() { box.innerHTML = '<p class="small"><a href="' + dest + '">View Leaderboard</a></p>'; }
    if (!score) { link(); return; }
    fetch('/api/leaderboard/rank?gameId=' + encodeURIComponent(GAME_ID) + '&score=' + encodeURIComponent(score), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var rank = d && Number(d.rank);
        if (!(rank > 0 && rank <= 20)) { link(); return; }
        box.innerHTML = '<p class="tag">New high score! You placed #' + rank + '</p><div class="nameRow"><input id="nm" maxlength="20" placeholder="Your name" autocomplete="off"><button class="big" id="btnSub" style="padding:10px 16px;font-size:15px">Submit</button></div>';
        $('btnSub').onclick = function () {
          if (submitting) return;
          var name = $('nm').value.trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
          if (!name) return;
          submitting = true;
          fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: GAME_ID, name: name, score: score }) })
            .then(function () { location.href = dest + '&highlightRank=' + encodeURIComponent(rank); })
            .catch(function () { submitting = false; link(); });
        };
      }).catch(link);
  }

  function hud() {
    if (!run) return;
    var w = world, p = w && w.actors[0];
    $('hScore').textContent = w ? w.score : run.score;
    $('hRound').textContent = run.round; $('hLives').textContent = run.lives;
    if (w) {
      var left = BW.COLLAPSE_START - w.t;
      $('hTime').textContent = left > 0 ? Math.floor(left / 60) + ':' + ('0' + Math.floor(left % 60)).slice(-2) : 'SUDDEN';
      $('hTime').style.color = left < 15 ? '#ff6a6a' : '';
      $('hKit').innerHTML = '&#128163;' + p.maxBombs + ' &#128293;' + p.range + ' &#9889;' + Math.round((p.speed - 3.6) / 0.45) + (p.shield ? ' &#128737;' : '');
    }
  }

  function resize() { R.resize(cv); R.resetCaches(); }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 150); });

  /* ---- input ---- */
  var KEYMAP = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
  window.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    var k = KEYMAP[e.code];
    if (k) { keys[k] = true; e.preventDefault(); }
    if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyX') { e.preventDefault(); if (!e.repeat) bombQueued = true; if (mode === 'title') $('btnStart').click(); }
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'KeyM') toggleMute();
    if (e.code === 'Enter') { var b = overlay.querySelector('.big'); if (overlay.classList.contains('show') && b) b.click(); }
  });
  window.addEventListener('keyup', function (e) { var k = KEYMAP[e.code]; if (k) keys[k] = false; });
  window.addEventListener('blur', function () { keys = {}; if (mode === 'play') togglePause(); });

  function togglePause() {
    if (mode === 'play') {
      mode = 'paused'; show('<h2>PAUSED</h2><button class="big" id="btnRes">Resume</button><p class="small"><a href="../index.html">Quit to Arcade</a></p>');
      $('btnRes').onclick = togglePause;
    } else if (mode === 'paused') { mode = 'play'; overlay.classList.remove('show'); last = performance.now(); }
  }
  function toggleMute() { A.setMuted(!A.isMuted()); $('btnMute').innerHTML = A.isMuted() ? '&#128263;' : '&#128266;'; }
  $('btnPause').onclick = togglePause; $('btnMute').onclick = toggleMute;
  $('btnStart').onclick = function () { A.init(); A.ui(); startRun(); };

  // touch stick
  var st = $('stick'), knob = $('knob'), sid = null;
  function stickMove(e) {
    var r = st.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = e.clientX - cx, dy = e.clientY - cy, m = Math.hypot(dx, dy), lim = r.width / 2;
    var k = m > lim ? lim / m : 1;
    knob.style.transform = 'translate(' + (dx * k) + 'px,' + (dy * k) + 'px)';
    stick.x = m > 12 ? dx / m : 0; stick.y = m > 12 ? dy / m : 0;
  }
  st.addEventListener('pointerdown', function (e) { sid = e.pointerId; st.setPointerCapture(sid); stickMove(e); e.preventDefault(); });
  st.addEventListener('pointermove', function (e) { if (e.pointerId === sid) stickMove(e); });
  function stickEnd(e) { if (e.pointerId === sid) { sid = null; stick.x = stick.y = 0; knob.style.transform = ''; } }
  st.addEventListener('pointerup', stickEnd); st.addEventListener('pointercancel', stickEnd);
  $('bombBtn').addEventListener('pointerdown', function (e) { bombQueued = true; e.preventDefault(); });

  function readInput() {
    var mx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), my = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
    if (!mx && !my) { mx = stick.x; my = stick.y; }
    var inp = { mx: mx, my: my, bomb: bombQueued }; bombQueued = false; return inp;
  }

  /* ---- loop ---- */
  var DT = 1 / 120;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode === 'play' && world) {
      acc += dt;
      var inp = readInput(), n = 0;
      while (acc >= DT && n++ < 12) {
        BW.step(world, DT, inp); inp.bomb = false; acc -= DT;
        if (world.events.length) { R.onEvents(world.events, world); A.handle(world.events); }
      }
      if (world.state !== 'play' && world.endT > (world.state === 'won' ? 1.4 : 1.5)) roundEnd();
      if (world.state === 'won' && world.endT < 0.05) say('ROUND CLEAR!', 1.4);
      hud();
    } else if (mode === 'title' || mode === 'between' || mode === 'over') bombQueued = false;
    R.update(dt);
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) banner.classList.remove('on'); }
    if (world) R.draw(g, world, cv); else { g.clearRect(0, 0, cv.width, cv.height); }
  }
  resize();
  // title screen backdrop: a live idle arena
  world = BW.createWorld({ seed: 11, round: 3 });
  window.BW.debug = { world: function () { return world; }, run: function () { return run; }, start: startRun, step: function (n) { for (var i = 0; i < n; i++) BW.step(world, DT, {}); } };
  last = performance.now(); requestAnimationFrame(frame);
  if (/[?&]autostart=1/.test(location.search)) startRun();
})();
