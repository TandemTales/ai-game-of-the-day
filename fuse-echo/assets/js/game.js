/* Fuse Echo — glue: loop, input, HUD, menus, leaderboard. */
(function (global) {
  'use strict';
  var FE = global.FE, doc = global.document;
  var GAME_ID = 'fuse-echo';
  var $ = function (id) { return doc.getElementById(id); };
  var canvas = $('fe-canvas'), panel = $('fe-panel'), banner = $('fe-banner');
  var st = null, last = 0, acc = 0, running = false, paused = false, simTime = 0;
  var keys = {}, stick = { x: 0, y: 0 }, touchMode = false, lastAxis = 'x', bombQueued = false;
  var best = 0, submitted = false;
  try { best = Number(global.localStorage.getItem('fe.best')) || 0; } catch (e) {}

  var isTouch = ('ontouchstart' in global) || (global.navigator && global.navigator.maxTouchPoints > 0) ||
    (global.matchMedia && global.matchMedia('(pointer:coarse)').matches);

  /* ---------- layout ---------- */
  function layout() {
    var portrait = global.innerHeight > global.innerWidth;
    var bottom = (isTouch && portrait) ? 190 : 0;
    FE.Render.setInsets(56, bottom);
  }
  FE.Render.init(canvas);
  layout();
  global.addEventListener('resize', layout);
  global.addEventListener('orientationchange', function () { setTimeout(layout, 120); });

  /* ---------- panels ---------- */
  function showPanel(html) { panel.innerHTML = '<div class="card">' + html + '</div>'; panel.classList.add('on'); }
  function hidePanel() { panel.classList.remove('on'); panel.innerHTML = ''; }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function menu() {
    running = false;
    $('fe-hud').hidden = true; $('fe-touch').hidden = true;
    showPanel(
      '<div class="tag">BOT BUILT ARCADE</div><h1>FUSE ECHO</h1>' +
      '<p>Every blast comes back. Out-bomb the rival bots &mdash; and mind the <b style="color:#7df0ff">echo</b>.</p>' +
      '<div class="how">' +
      '<div><b>Move</b> Arrows / WASD or the stick</div>' +
      '<div><b>Bomb</b> Space / Enter or the red button</div>' +
      '<div><b>Echo</b> ~1.6s after a blast, the same fire pattern re-detonates. Ghost cells warn you.</div>' +
      '<div><b>Score</b> Bots caught in an echo pay double. Chains multiply.</div></div>' +
      (best ? '<p class="small">Best: ' + fmt(best) + '</p>' : '') +
      '<button class="btn" id="b-play">PLAY</button>' +
      '<a class="btn alt" href="../leaderboard.html?gameId=' + GAME_ID + '">LEADERBOARD</a>' +
      '<a class="btn alt" href="../index.html">BACK TO ARCADE</a>');
    $('b-play').onclick = function () { FE.Audio.unlock(); FE.Audio.sfx({ t: 'ui' }); startRun(); };
  }

  function startRun() {
    hidePanel();
    st = FE.newGame((Date.now() & 0xffffff) + 1);
    submitted = false;
    FE.Render.reset();
    FE.startRound(st, 1);
    $('fe-hud').hidden = false; $('fe-touch').hidden = !isTouch;
    paused = false; running = true; acc = 0; last = performance.now();
    FE.Audio.startMusic();
    announce('ROUND 1', 1.6);
    layout();
  }

  var bannerTimer = 0;
  function announce(text, secs) {
    banner.textContent = text; banner.classList.add('on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { banner.classList.remove('on'); }, (secs || 1.5) * 1000);
  }

  function clearPanel(ev) {
    var tb = ev.timeBonus;
    showPanel('<div class="tag">ROUND ' + ev.round + '</div><h2>ARENA CLEARED</h2>' +
      '<div class="stats"><div>Clear bonus<b>+1,000</b></div><div>Speed bonus<b>+' + fmt(tb) + '</b></div></div>' +
      '<div class="stats"><div>Score<b>' + fmt(st.score) + '</b></div><div>Lives<b>' + st.lives + '</b></div></div>' +
      '<button class="btn" id="b-next">NEXT ROUND</button>');
    var go = function () { if (st.state !== 'clear') return; hidePanel(); FE.nextRound(st); FE.Render.reset(); announce('ROUND ' + st.round, 1.6); acc = 0; last = performance.now(); };
    $('b-next').onclick = go;
    panel._go = go;
  }

  function overPanel() {
    FE.Audio.stopMusic();
    $('fe-touch').hidden = true;
    var isBest = st.score > best;
    if (isBest) { best = st.score; try { global.localStorage.setItem('fe.best', String(best)); } catch (e) {} }
    showPanel('<div class="tag">RUN OVER</div><h2>' + (isBest ? 'NEW BEST!' : 'GAME OVER') + '</h2>' +
      '<div class="stats"><div>Score<b>' + fmt(st.score) + '</b></div><div>Round<b>' + st.round + '</b></div><div>Bots down<b>' + st.kills + '</b></div></div>' +
      '<div id="lb-slot" class="small">Checking leaderboard&hellip;</div>' +
      '<button class="btn" id="b-again">PLAY AGAIN</button>' +
      '<a class="btn alt" href="../leaderboard.html?gameId=' + GAME_ID + '">LEADERBOARD</a>' +
      '<button class="btn alt" id="b-menu">MENU</button>');
    $('b-again').onclick = function () { startRun(); };
    $('b-menu').onclick = menu;
    submitScore(st.score);
  }

  /* ---------- leaderboard ---------- */
  function submitScore(score) {
    var slot = $('lb-slot');
    if (!score || score <= 0 || global.location.protocol === 'file:') { if (slot) slot.textContent = ''; return; }
    fetch('/api/leaderboard/rank?gameId=' + encodeURIComponent(GAME_ID) + '&score=' + encodeURIComponent(score), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var rank = d && Number(d.rank);
        slot = $('lb-slot');
        if (!slot) return;
        if (!rank || !isFinite(rank) || rank <= 0 || rank > 20) { slot.textContent = ''; return; }
        slot.innerHTML = 'Top 20! You placed <b style="color:#ffd23e">#' + rank + '</b>' +
          '<input id="lb-name" class="field" maxlength="20" placeholder="Your name" autocomplete="off"/>' +
          '<button class="btn" id="lb-send">SUBMIT SCORE</button>';
        $('lb-send').onclick = function () {
          var name = String($('lb-name').value || '').trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
          if (!name || submitted) return;
          submitted = true;
          fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: GAME_ID, name: name, score: score }) })
            .then(function () { $('lb-slot').innerHTML = 'Submitted &mdash; rank <b>#' + rank + '</b>'; })
            .catch(function () { submitted = false; $('lb-slot').textContent = 'Could not submit. Try again later.'; });
        };
      })
      .catch(function () { var s = $('lb-slot'); if (s) s.textContent = ''; });
  }

  function pause(on) {
    if (!running || st.state !== 'play') return;
    paused = on;
    if (on) {
      showPanel('<h2>PAUSED</h2><button class="btn" id="b-res">RESUME</button><button class="btn alt" id="b-quit">QUIT TO MENU</button>');
      $('b-res').onclick = function () { pause(false); };
      $('b-quit').onclick = function () { FE.Audio.stopMusic(); menu(); };
    } else { hidePanel(); last = performance.now(); acc = 0; }
  }

  /* ---------- input ---------- */
  function readInput() {
    var ix = 0, iy = 0;
    var l = keys.ArrowLeft || keys.KeyA, r = keys.ArrowRight || keys.KeyD, u = keys.ArrowUp || keys.KeyW, d = keys.ArrowDown || keys.KeyS;
    var kx = (r ? 1 : 0) - (l ? 1 : 0), ky = (d ? 1 : 0) - (u ? 1 : 0);
    if (kx || ky) {
      if (kx && ky) { ix = lastAxis === 'x' ? kx : 0; iy = lastAxis === 'y' ? ky : 0; }
      else { ix = kx; iy = ky; }
    } else if (stick.x || stick.y) {
      if (Math.abs(stick.x) > Math.abs(stick.y)) ix = Math.sign(stick.x); else iy = Math.sign(stick.y);
    }
    return [ix, iy];
  }

  doc.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyM') { FE.Audio.setMuted(!FE.Audio.isMuted()); syncMute(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { pause(!paused); e.preventDefault(); return; }
    if ((e.code === 'Space' || e.code === 'Enter') && panel.classList.contains('on') && panel._go && st && st.state === 'clear') { panel._go(); e.preventDefault(); return; }
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ') { if (!e.repeat) bombQueued = true; e.preventDefault(); }
    if (/^(Arrow|Key[WASD])/.test(e.code)) {
      if (!keys[e.code]) lastAxis = (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD') ? 'x' : 'y';
      keys[e.code] = true; e.preventDefault();
    }
    FE.Audio.unlock();
  });
  doc.addEventListener('keyup', function (e) { keys[e.code] = false; });
  global.addEventListener('blur', function () { keys = {}; if (running && st && st.state === 'play' && !paused) pause(true); });
  doc.addEventListener('visibilitychange', function () { if (doc.hidden && running && st && st.state === 'play' && !paused) pause(true); });

  // virtual stick
  (function () {
    var base = $('fe-stick'), knob = $('fe-knob'), id = null, cx = 0, cy = 0;
    function upd(e) {
      var dx = e.clientX - cx, dy = e.clientY - cy, m = Math.hypot(dx, dy), max = 52;
      if (m > max) { dx *= max / m; dy *= max / m; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      var dead = 14;
      stick.x = Math.abs(dx) > dead ? dx : 0; stick.y = Math.abs(dy) > dead ? dy : 0;
    }
    base.addEventListener('pointerdown', function (e) {
      id = e.pointerId; base.setPointerCapture(id);
      var r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      FE.Audio.unlock(); upd(e); e.preventDefault();
    });
    base.addEventListener('pointermove', function (e) { if (e.pointerId === id) upd(e); });
    function end(e) { if (e.pointerId !== id) return; id = null; stick.x = stick.y = 0; knob.style.transform = ''; }
    base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
    var bomb = $('fe-bomb');
    bomb.addEventListener('pointerdown', function (e) { bombQueued = true; FE.Audio.unlock(); e.preventDefault(); });
  })();

  function syncMute() { $('btn-mute').innerHTML = FE.Audio.isMuted() ? '&#128263;' : '&#128266;'; }
  $('btn-mute').onclick = function () { FE.Audio.setMuted(!FE.Audio.isMuted()); syncMute(); };
  $('btn-pause').onclick = function () { pause(!paused); };
  syncMute();

  /* ---------- main loop ---------- */
  function hud() {
    $('hud-score').textContent = fmt(st.score);
    $('hud-round').textContent = st.round;
    $('hud-lives').textContent = st.lives;
    var p = st.player;
    $('hud-kit').textContent = p.maxBombs + '💣 ' + p.range + '🔥';
  }

  function frame(now) {
    global.requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    simTime += dt;
    if (running && st && !paused) {
      acc += dt;
      while (acc >= FE.STEP) {
        if (st.state === 'play') {
          var inp = readInput();
          FE.setInput(st, inp[0], inp[1], bombQueued);
          bombQueued = false;
        }
        FE.step(st, FE.STEP);
        acc -= FE.STEP;
        FE.Render.updateFx(FE.STEP);
        var evs = FE.drainEvents(st);
        for (var i = 0; i < evs.length; i++) {
          var ev = evs[i];
          FE.Render.onEvent(ev); FE.Audio.sfx(ev);
          if (ev.t === 'clear') clearPanel(ev);
          if (ev.t === 'over') setTimeout(overPanel, 500);
          if (ev.t === 'death' && ev.player && st.lives > 1) announce('LIFE LOST', 1.3);
          if (ev.t === 'round' && ev.round === st.round && st.round > 1 && st.lives < 3) { /* retry or next */ }
        }
        if (st.state !== 'play') { bombQueued = false; }
      }
      var bots = 0; for (var k = 1; k < st.ents.length; k++) if (st.ents[k].alive) bots++;
      FE.Audio.setTension(bots <= 1 ? 1 : 0.3);
      hud();
    } else {
      FE.Render.updateFx(dt);
    }
    FE.Render.draw(st, simTime);
  }

  // test/debug hooks
  FE.game = {
    get state() { return st; },
    start: startRun, menu: menu,
    press: function (code, down) { keys[code] = !!down; },
    bomb: function () { bombQueued = true; }
  };

  menu();
  last = performance.now();
  global.requestAnimationFrame(frame);
})(window);
