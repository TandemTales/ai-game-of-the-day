/* Shiftwick - glue: loop, input, overlays, leaderboard. */
(function (root) {
  'use strict';
  var SW = root.SW, SWR = root.SWRender, AU = root.SWAudio, doc = root.document;
  var GAME_ID = 'shiftwick';
  var canvas = doc.getElementById('sw-canvas'), ctx = canvas.getContext('2d');
  var overlay = doc.getElementById('sw-overlay'), dpad = doc.getElementById('sw-dpad'), pauseBtn = doc.getElementById('sw-pause');
  var touch = ('ontouchstart' in root) || (navigator.maxTouchPoints > 0);
  var state = SW.create({ seed: 1013 }), mode = 'title', view = null, last = 0, clock = 0, paused = false;
  var best = 0;
  try { best = +localStorage.getItem('shiftwick.best') || 0; } catch (e) {}

  function resize() {
    var dpr = Math.min(2, root.devicePixelRatio || 1), w = root.innerWidth, h = root.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    view = SWR.layout(w, h, touch && h > w * 0.9); view.dpr = dpr;
    dpad.classList.toggle('on', touch && h > w * 0.9 && mode === 'play');
  }
  root.addEventListener('resize', resize);

  function show(html) { overlay.innerHTML = '<div class="sw-card">' + html + '</div>'; overlay.classList.add('on'); }
  function hide() { overlay.classList.remove('on'); overlay.innerHTML = ''; }
  function title() {
    mode = 'title'; resize();
    show('<h1>SHIFTWICK</h1><p class="sub">The maze is alive. Read the warnings.</p>' +
      '<p>Eat every glow-mote. Four Hollows hunt you &mdash; grab an <b style="color:#ffb347">ember</b> to scorch them.</p>' +
      '<p>Every few seconds a <b style="color:#5be3d0">row or column slides</b> one tile, carrying walls, motes, you and the Hollows with it. A teal band shows what is about to move.</p>' +
      '<p class="sw-keys">' + (touch ? 'Swipe or use the pad to steer.' : 'Arrow keys / WASD to steer &bull; P to pause') + '</p>' +
      (best ? '<p class="sw-keys">Best: ' + best + '</p>' : '') +
      '<button class="sw-btn" id="sw-go" type="button">Play</button>' +
      '<button class="sw-btn alt" id="sw-mute" type="button">Sound: ' + (AU.muted ? 'off' : 'on') + '</button>');
    doc.getElementById('sw-go').onclick = startGame;
    doc.getElementById('sw-mute').onclick = function () { AU.setMuted(!AU.muted); title(); };
  }
  function startGame() {
    AU.unlock(); state = SW.create({ seed: 1013 }); mode = 'play'; hide(); resize(); AU.play('ready');
  }
  root.SWDebug = { get state() { return state; }, start: startGame };

  function gameOver() {
    mode = 'over'; dpad.classList.remove('on');
    var sc = state.score; if (sc > best) { best = sc; try { localStorage.setItem('shiftwick.best', String(sc)); } catch (e) {} }
    show('<h2>The wick burns out</h2><p>Score <b style="font-size:26px;color:#ffd27a">' + sc + '</b></p>' +
      '<p class="sw-keys">Level ' + state.level + ' &bull; ' + state.stats.ghosts + ' Hollows scorched &bull; ' + state.stats.shifts + ' shifts survived</p>' +
      '<div id="sw-rank"></div><button class="sw-btn" id="sw-again" type="button">Play again</button><a class="sw-btn alt" href="../leaderboard.html?gameId=' + GAME_ID + '">Leaderboard</a>' +
      '<br><a class="sw-keys" href="../index.html" style="display:inline-block;margin-top:12px;color:#d9b98a">Back to Arcade</a>');
    doc.getElementById('sw-again').onclick = startGame;
    submitScore(sc);
  }
  async function submitScore(score) {
    if (!score || score <= 0 || root.location.protocol === 'file:') return;
    try {
      var res = await fetch('/api/leaderboard/rank?gameId=' + encodeURIComponent(GAME_ID) + '&score=' + encodeURIComponent(score), { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      var data = await res.json(), rank = Number(data && data.rank);
      if (!isFinite(rank) || rank <= 0 || rank > 20) return;
      var box = doc.getElementById('sw-rank'); if (!box) return;
      box.innerHTML = '<p>Top 20! You placed <b>#' + rank + '</b>.</p><input id="sw-name" maxlength="20" placeholder="Your name" aria-label="Your name"><br><button class="sw-btn" id="sw-sub" type="button">Submit score</button>';
      doc.getElementById('sw-sub').onclick = async function () {
        var name = doc.getElementById('sw-name').value.trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
        if (!name) return;
        try {
          await fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: GAME_ID, name: name, score: score }) });
          box.innerHTML = '<p>Submitted &mdash; rank #' + rank + '</p>';
        } catch (e) { box.innerHTML = '<p>Could not reach the leaderboard.</p>'; }
      };
    } catch (e) { /* offline */ }
  }

  function pause(on) {
    if (mode !== 'play') return;
    paused = on;
    if (on) { show('<h2>Paused</h2><button class="sw-btn" id="sw-res" type="button">Resume</button><button class="sw-btn alt" id="sw-quit" type="button">Quit</button>'); doc.getElementById('sw-res').onclick = function () { pause(false); }; doc.getElementById('sw-quit').onclick = function () { paused = false; title(); }; }
    else { hide(); last = 0; }
  }
  pauseBtn.onclick = function () { pause(!paused); };
  doc.addEventListener('visibilitychange', function () { if (doc.hidden && mode === 'play') pause(true); });

  // input
  var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { pause(!paused); return; }
    if (e.key === 'm' || e.key === 'M') { AU.setMuted(!AU.muted); return; }
    if ((e.key === 'Enter' || e.key === ' ') && mode === 'title') { startGame(); e.preventDefault(); return; }
    var d = KEYS[e.key]; if (d && mode === 'play' && !paused) { SW.setDir(state, d); e.preventDefault(); }
  });
  var tx = 0, ty = 0, tid = null;
  canvas.addEventListener('pointerdown', function (e) { tx = e.clientX; ty = e.clientY; tid = e.pointerId; AU.unlock(); });
  canvas.addEventListener('pointermove', function (e) {
    if (tid !== e.pointerId || mode !== 'play' || paused) return;
    var dx = e.clientX - tx, dy = e.clientY - ty;
    if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
    SW.setDir(state, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    tx = e.clientX; ty = e.clientY;
  });
  canvas.addEventListener('pointerup', function () { tid = null; });
  Array.prototype.forEach.call(dpad.querySelectorAll('button'), function (b) {
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); SW.setDir(state, b.getAttribute('data-dir')); });
  });

  function frame(ms) {
    var t = ms / 1000; if (!last) last = t; var dt = Math.min(0.05, t - last); last = t; clock += dt;
    if (mode === 'play' && !paused) {
      SW.step(state, dt);
      SW.drainEvents(state).forEach(function (ev) {
        SWR.event(ev, view, state);
        if (ev.t === 'mote') AU.play('mote'); else if (ev.t === 'ember') AU.play('ember'); else if (ev.t === 'ghost') AU.play('ghost', ev.n);
        else if (ev.t === 'die') AU.play('die'); else if (ev.t === 'warn') AU.play('warn'); else if (ev.t === 'slide') AU.play('slide');
        else if (ev.t === 'clear') AU.play('clear'); else if (ev.t === 'fruitget') AU.play('fruit'); else if (ev.t === 'extra') AU.play('extra');
        else if (ev.t === 'level') AU.play('ready');
      });
      AU.setTension(state.shift ? 1 : (state.frightLeft > 0 ? 0.6 : 0.2));
      if (state.status === 'gameover') gameOver();
    }
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    SWR.draw(ctx, state, view, clock, dt);
    root.requestAnimationFrame(frame);
  }
  resize(); title();
  root.requestAnimationFrame(frame);
})(window);
