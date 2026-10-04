/* Cinderwick game shell: input, fixed-step loop, HUD, menus, leaderboard. */
(function (root) {
  'use strict';
  var CW = root.CW, S = CW.Sim, doc = root.document;
  var $ = function (id) { return doc.getElementById(id); };
  var canvas = $('cw-canvas'), overlay = $('cw-overlay'), hud = $('cw-hud'), touchUI = $('cw-touch'), chainEl = $('cw-chain');
  var g = null, mode = 'menu', paused = false, acc = 0, last = 0, shake = 0, hasTouch = false;
  var keys = {}, edge = { bomb: false, strike: false }, pad = { dx: 0, dy: 0, id: null };
  var best = 0, chainHide = 0;
  try { best = +localStorage.getItem('cinderwick.best') || 0; } catch (e) {}
  var API = CW.Game = {};

  function fmt(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function safe(fn) { try { return fn(); } catch (e) { if (root.console) console.error(e); } }

  // ---------- overlays ----------
  function show(html) { overlay.innerHTML = '<div class="card">' + html + '</div>'; overlay.classList.add('on'); }
  function hide() { overlay.classList.remove('on'); overlay.innerHTML = ''; }
  function menu() {
    mode = 'menu'; hud.hidden = true; touchUI.hidden = true;
    show('<h1>CINDERWICK</h1><p>Lay a burning fuse cord from bomb to bomb, then light the chain.</p>' +
      '<ul><li><b>Move</b> WASD / arrows / left stick</li><li><b>Bomb</b> Space / BOMB. Your next bomb is joined to the last by the path you walked.</li>' +
      '<li><b>Light</b> Shift or Z / LIGHT. Only the newest bomb ticks; when it blows, the spark runs the cord and detonates the rest, and chains multiply score.</li>' +
      '<li>Clear every critter, then reach the glowing hatch.</li></ul>' +
      '<p>Best <span class="stat">' + fmt(best) + '</span></p>' +
      '<button class="btn" id="b-start">Start</button><a class="btn alt" href="../index.html">Arcade</a>');
    $('b-start').onclick = function () { safe(CW.Audio.init); start(); };
  }
  function start() {
    hide(); g = S.newGame({ seed: (Date.now() % 100000) | 0, level: 1 });
    mode = 'play'; paused = false; hud.hidden = false; touchUI.hidden = !hasTouch;
    safe(function () { CW.Render.reset(); CW.Audio.music(true); });
    banner();
  }
  function banner() { chainEl.textContent = 'FLOOR ' + g.level; chainEl.classList.add('show'); chainHide = 1.6; }
  function levelWon() {
    mode = 'won'; safe(function () { CW.Audio.music(false); });
    show('<h2>Floor ' + g.level + ' cleared</h2><p>Time bonus <span class="stat">' + fmt(g.winBonus) + '</span></p>' +
      '<p>Score <span class="stat">' + fmt(g.score) + '</span> · Best chain <span class="stat">' + g.bestChain + '</span></p>' +
      '<button class="btn" id="b-next">Next floor</button>');
    $('b-next').onclick = function () { hide(); S.nextLevel(g); mode = 'play'; safe(function () { CW.Render.reset(); CW.Audio.music(true); }); banner(); };
  }
  function gameOver() {
    mode = 'over'; safe(function () { CW.Audio.music(false); });
    var isBest = g.score > best; if (isBest) { best = g.score; try { localStorage.setItem('cinderwick.best', String(best)); } catch (e) {} }
    show('<h2>Foundry lost</h2><p>Score <span class="stat">' + fmt(g.score) + '</span>' + (isBest ? ' — new best!' : '') + '</p>' +
      '<p>Floor ' + g.level + ' · Best chain <span class="stat">' + g.bestChain + '</span></p>' +
      '<button class="btn" id="b-again">Play again</button><a class="btn alt" href="../leaderboard.html?gameId=cinderwick">Leaderboard</a>');
    $('b-again').onclick = start;
    submitScore(g.score);
  }
  function pauseToggle() {
    if (mode !== 'play') return;
    paused = !paused;
    if (paused) { show('<h2>Paused</h2><button class="btn" id="b-res">Resume</button><button class="btn alt" id="b-quit">Quit run</button>');
      $('b-res').onclick = pauseToggle; $('b-quit').onclick = function () { paused = false; gameOver(); }; safe(function () { CW.Audio.music(false); }); }
    else { hide(); safe(function () { CW.Audio.music(true); }); }
  }

  // ---------- leaderboard ----------
  function submitScore(score) {
    if (!score || score <= 0 || root.location.protocol === 'file:') return;
    fetch('/api/leaderboard/rank?gameId=' + CW.GAME_ID + '&score=' + score, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var rank = d && Number(d.rank);
        if (!rank || rank > 20 || mode !== 'over') return;
        var card = overlay.querySelector('.card');
        var box = doc.createElement('div');
        box.innerHTML = '<p>Top 20! You placed <span class="stat">#' + rank + '</span>.</p><input id="lb-name" maxlength="20" placeholder="Your name" aria-label="Your name" />' +
          '<button class="btn" id="lb-send">Submit score</button>';
        card.insertBefore(box, card.querySelector('.btn'));
        $('lb-send').onclick = function () {
          var name = ($('lb-name').value || '').trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
          if (!name) return;
          $('lb-send').disabled = true;
          fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId: CW.GAME_ID, name: name, score: score }) })
            .then(function () { box.innerHTML = '<p>Submitted — rank #' + rank + '.</p>'; }, function () { $('lb-send').disabled = false; });
        };
      }).catch(function () {});
  }

  // ---------- input ----------
  var KEYMAP = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
  doc.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (KEYMAP[e.code]) { if (!keys[e.code]) keys.order = (keys.order || []).filter(function (c) { return c !== e.code; }).concat(e.code); keys[e.code] = true; e.preventDefault(); }
    else if (e.code === 'Space') { edge.bomb = true; e.preventDefault(); }
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyZ' || e.code === 'KeyE') { edge.strike = true; e.preventDefault(); }
    else if (e.code === 'Escape' || e.code === 'KeyP') pauseToggle();
    else if (e.code === 'Enter' && mode === 'menu') { safe(CW.Audio.init); start(); }
  });
  doc.addEventListener('keyup', function (e) { keys[e.code] = false; });
  root.addEventListener('blur', function () { keys = {}; if (mode === 'play' && !paused) pauseToggle(); });
  function keyDir() {
    var o = (keys.order || []).filter(function (c) { return keys[c]; });
    var c = o[o.length - 1]; if (!c) return [0, 0];
    var k = KEYMAP[c];
    return k === 'l' ? [-1, 0] : k === 'r' ? [1, 0] : k === 'u' ? [0, -1] : [0, 1];
  }
  function enableTouch() { if (hasTouch) return; hasTouch = true; if (mode === 'play') touchUI.hidden = false; }
  doc.addEventListener('touchstart', enableTouch, { passive: true });
  (function wireTouch() {
    var p = $('cw-pad'), st = $('cw-stick');
    function upd(e) {
      var r = p.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var vx = e.clientX - cx, vy = e.clientY - cy, len = Math.hypot(vx, vy), max = r.width / 2;
      var k = len > max ? max / len : 1;
      st.style.transform = 'translate(' + vx * k * 0.6 + 'px,' + vy * k * 0.6 + 'px)';
      if (len < max * 0.22) { pad.dx = 0; pad.dy = 0; }
      else if (Math.abs(vx) > Math.abs(vy)) { pad.dx = vx > 0 ? 1 : -1; pad.dy = 0; } else { pad.dy = vy > 0 ? 1 : -1; pad.dx = 0; }
    }
    p.addEventListener('pointerdown', function (e) { pad.id = e.pointerId; p.setPointerCapture(e.pointerId); upd(e); e.preventDefault(); });
    p.addEventListener('pointermove', function (e) { if (e.pointerId === pad.id) upd(e); });
    function up(e) { if (e.pointerId !== pad.id) return; pad.id = null; pad.dx = pad.dy = 0; st.style.transform = ''; }
    p.addEventListener('pointerup', up); p.addEventListener('pointercancel', up);
    $('cw-btn-bomb').addEventListener('pointerdown', function (e) { edge.bomb = true; e.preventDefault(); });
    $('cw-btn-strike').addEventListener('pointerdown', function (e) { edge.strike = true; e.preventDefault(); });
    $('hud-mute').addEventListener('click', function () { var m = !CW.Audio.isMuted(); CW.Audio.setMuted(m); $('hud-mute').textContent = m ? '🔇' : '🔊'; });
  })();

  // ---------- layout / loop ----------
  var dpr = 1;
  function resize() {
    dpr = Math.min(root.devicePixelRatio || 1, 3);
    var w = root.innerWidth, h = root.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  root.addEventListener('resize', resize);
  function arenaRect() {
    var w = root.innerWidth, h = root.innerHeight, top = 62, bottom = 0;
    if (hasTouch && h > w * 0.9) bottom = 190;     // portrait: controls live under the arena
    return { x: 0, y: top, w: w, h: Math.max(100, h - top - bottom) };
  }

  function handleEvents() {
    var ev = g.events; g.events = [];
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      safe(function () { CW.Audio.sfx(e.type, e); CW.Render.fx(e); });
      if (e.type === 'explode') shake = Math.min(1, shake + 0.12 + e.chain * 0.03);
      if (e.type === 'death') shake = 1;
      if (e.type === 'explode' && e.chain >= 2) { chainEl.textContent = 'CHAIN x' + e.chain; chainEl.classList.add('show'); chainHide = 1.4; }
      if (e.type === 'hurry') { chainEl.textContent = 'HURRY! Wisps hunt you'; chainEl.classList.add('show'); chainHide = 1.6; }
    }
  }
  function updateHud() {
    $('hud-score').textContent = fmt(g.score);
    $('hud-level').textContent = g.level;
    var tl = Math.ceil(g.timeLeft), tel = $('hud-time');
    tel.textContent = Math.floor(tl / 60) + ':' + ('0' + (tl % 60)).slice(-2);
    tel.className = 'hud-v' + (tl <= 20 ? ' warn' : '');
    $('hud-lives').textContent = Math.max(0, g.lives);
    $('hud-bombs').textContent = g.bombs.length + '/' + g.stats.maxBombs;
  }

  function frame(now) {
    root.requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (g && mode === 'play' && !paused) {
      acc += dt;
      var kd = keyDir(), dx = kd[0] || pad.dx, dy = kd[1] || pad.dy;
      while (acc >= 1 / 60) {
        S.step(g, 1 / 60, { dx: dx, dy: dy, bomb: edge.bomb, strike: edge.strike });
        edge.bomb = edge.strike = false; acc -= 1 / 60;
      }
      handleEvents();
      if (g.status === 'won') levelWon(); else if (g.status === 'over') gameOver();
      updateHud();
      var near = g.chain.count > 1 ? 1 : 0;
      safe(function () { CW.Audio.setTension(Math.min(1, (180 - g.timeLeft) / 180 * 0.6 + near * 0.4)); });
    }
    if (chainHide > 0) { chainHide -= dt; if (chainHide <= 0) chainEl.classList.remove('show'); }
    shake = Math.max(0, shake - dt * 2.2);
    safe(function () {
      CW.Render.update(dt);
      var r = arenaRect();
      if (g) CW.Render.draw(g, { t: now / 1000, w: root.innerWidth, h: root.innerHeight, dpr: dpr, rect: r, shake: shake, paused: paused || mode !== 'play' });
    });
  }

  // test / automation hook
  API.state = function () { return g; };
  API.mode = function () { return mode; };
  API.start = start;
  API.input = function (i) { if (i.bomb) edge.bomb = true; if (i.strike) edge.strike = true; };

  resize();
  safe(function () { CW.Render.init(canvas); });
  menu();
  root.requestAnimationFrame(frame);
})(window);
