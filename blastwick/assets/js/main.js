/* Blastwick - input, game loop, HUD, screens, leaderboard. Owner: main. */
(function (g) {
  'use strict';
  var BW = g.BW, L = BW.Logic, GAME_ID = 'blastwick';
  var cv = document.getElementById('bw-canvas'), ctx = cv.getContext('2d');
  var ov = document.getElementById('bw-overlay'), touchUI = document.getElementById('bw-touch');
  var isTouch = ('ontouchstart' in g) || (navigator.maxTouchPoints > 0);
  var st = null, mode = 'title', last = 0, time = 0, dpr = 1, lay = null, keys = {}, pressed = {};
  var stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 }, touchBomb = false, touchKind = false;
  var best = 0;
  try { best = +localStorage.getItem('bw_best') || 0; } catch (e) {}

  function resize() {
    dpr = Math.min(2, g.devicePixelRatio || 1);
    var w = g.innerWidth, h = g.innerHeight;
    cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    lay = BW.Render.layout(w, h, isTouch);
    touchUI.style.display = isTouch ? 'block' : 'none';
  }
  g.addEventListener('resize', resize); g.addEventListener('orientationchange', resize);

  /* ---------- input ---------- */
  var MAP = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
  g.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (MAP[e.code]) { keys[MAP[e.code]] = true; e.preventDefault(); }
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'Enter') { pressed.bomb = true; e.preventDefault(); if (mode === 'title') start(); }
    if (e.code === 'KeyX' || e.code === 'KeyQ' || e.code === 'ShiftLeft') pressed.kind = true;
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'KeyM') mute();
  });
  g.addEventListener('keyup', function (e) { if (MAP[e.code]) keys[MAP[e.code]] = false; });
  g.addEventListener('blur', function () { keys = {}; if (mode === 'play') togglePause(true); });

  var zone = document.getElementById('bw-stick');
  function stickMove(e) {
    var dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, m = Math.sqrt(dx * dx + dy * dy), R = 48;
    if (m > R) { dx = dx / m * R; dy = dy / m * R; m = R; }
    stick.x = m < 10 ? 0 : dx / R; stick.y = m < 10 ? 0 : dy / R;
    var knob = document.getElementById('bw-knob'); knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }
  zone.addEventListener('pointerdown', function (e) {
    stick.id = e.pointerId; zone.setPointerCapture(e.pointerId);
    var r = zone.getBoundingClientRect(); stick.ox = r.left + r.width / 2; stick.oy = r.top + r.height / 2; stickMove(e); e.preventDefault();
  });
  zone.addEventListener('pointermove', function (e) { if (e.pointerId === stick.id) stickMove(e); });
  function stickEnd(e) { if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; document.getElementById('bw-knob').style.transform = ''; } }
  zone.addEventListener('pointerup', stickEnd); zone.addEventListener('pointercancel', stickEnd);
  document.getElementById('bw-btn-bomb').addEventListener('pointerdown', function (e) { pressed.bomb = true; e.preventDefault(); });
  document.getElementById('bw-btn-kind').addEventListener('pointerdown', function (e) { pressed.kind = true; e.preventDefault(); });
  document.getElementById('bw-pause').addEventListener('click', function () { togglePause(); });
  document.getElementById('bw-mute').addEventListener('click', mute);
  function mute() { var m = BW.Audio.toggleMute(); document.getElementById('bw-mute').textContent = m ? '🔇' : '🔊'; }
  function readInput() {
    var ax = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), ay = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
    if (stick.x || stick.y) { ax = stick.x; ay = stick.y; }
    var inp = { ax: ax, ay: ay, bomb: pressed.bomb, kind: pressed.kind };
    pressed = {};
    return inp;
  }

  /* ---------- screens ---------- */
  function show(html) { ov.innerHTML = html; ov.style.display = 'flex'; }
  function hide() { ov.style.display = 'none'; ov.innerHTML = ''; }
  function title() {
    mode = 'title';
    show('<div class="card"><h1>BLASTWICK</h1><p class="tag">Light the fuse. Chain the blast. Beat the tide.</p>' +
      '<ul class="how"><li><b>Bombs</b> destroy crates and wisps — and set off any bomb they touch.</li>' +
      '<li><b>Chain reactions</b> multiply points. Plan long fuse lines.</li>' +
      '<li><b>Fuse colours</b> change the blast: <i class="k1">cross</i>, <i class="k2">diagonal</i>, <i class="k3">ring</i>. Find them in crates.</li>' +
      '<li><b>The tide</b> floods the arena from the edges. Defeat every wisp, then reach the glowing gate.</li></ul>' +
      '<p class="keys">' + (isTouch ? 'Stick to move · BOMB button · FUSE to switch colour' : 'Arrows/WASD move · Space bomb · X switch fuse · P pause · M mute') + '</p>' +
      '<button id="bw-start" class="big">Play</button>' + (best ? '<p class="best">Best: ' + best.toLocaleString() + '</p>' : '') +
      '<a class="back" href="../index.html">← Back to Arcade</a></div>');
    document.getElementById('bw-start').onclick = start;
  }
  function start() {
    BW.Audio.init(); BW.Audio.music(true);
    BW.Render.clearFx();
    st = L.newGame((Date.now() & 0xffffff) ^ 0x5bd1e995);
    hide(); mode = 'play'; last = performance.now(); banner('STAGE 1', 1.6);
  }
  function togglePause(force) {
    if (mode === 'play') { mode = 'pause'; show('<div class="card"><h2>Paused</h2><button id="bw-resume" class="big">Resume</button><a class="back" href="../index.html">← Back to Arcade</a></div>'); document.getElementById('bw-resume').onclick = togglePause; BW.Audio.music(false); }
    else if (mode === 'pause' && !force) { hide(); mode = 'play'; last = performance.now(); BW.Audio.music(true); }
  }
  var bannerText = '', bannerT = 0;
  function banner(s, t) { bannerText = s; bannerT = t; }

  function gameOver() {
    mode = 'over'; BW.Audio.music(false);
    var score = st.score;
    if (score > best) { best = score; try { localStorage.setItem('bw_best', best); } catch (e) {} }
    show('<div class="card"><h2>Fuse burned out</h2><p class="big-score">' + score.toLocaleString() + '</p><p>Reached stage ' + st.stage + '</p>' +
      '<div id="bw-lb"></div><button id="bw-again" class="big">Play again</button>' +
      '<a class="back" href="../leaderboard.html?gameId=' + GAME_ID + '">View Leaderboard</a> <a class="back" href="../index.html">← Back to Arcade</a></div>');
    document.getElementById('bw-again').onclick = start;
    submitScore(score);
  }
  async function submitScore(score) {
    if (!score || score <= 0 || g.location.protocol === 'file:') return;
    var box = document.getElementById('bw-lb');
    try {
      var res = await fetch('/api/leaderboard/rank?gameId=' + encodeURIComponent(GAME_ID) + '&score=' + encodeURIComponent(score), { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      var data = await res.json(), rank = Number(data && data.rank);
      if (!isFinite(rank) || rank <= 0 || rank > 20) return;
      box.innerHTML = '<p>Top 20! Rank <b>#' + rank + '</b></p><form id="bw-form"><input id="bw-name" maxlength="20" placeholder="Your name" autocomplete="off"/><button class="big" type="submit">Submit</button></form>';
      document.getElementById('bw-form').onsubmit = async function (ev) {
        ev.preventDefault();
        var name = document.getElementById('bw-name').value.trim().replace(/[^\w \-'.!]/g, '').slice(0, 20);
        if (!name) return;
        box.innerHTML = '<p>Submitting…</p>';
        try {
          await fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: GAME_ID, name: name, score: score }) });
          box.innerHTML = '<p>🏆 Submitted — rank #' + rank + '</p>';
        } catch (e) { box.innerHTML = '<p>Could not submit.</p>'; }
      };
    } catch (e) { /* offline */ }
  }

  /* ---------- HUD ---------- */
  function hud(c) {
    var w = lay.cw, h = lay.hud, f = Math.floor(h * 0.36);
    c.fillStyle = 'rgba(8,10,28,0.85)'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(120,140,255,0.25)'; c.fillRect(0, h - 1, w, 1);
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = '#9aa4ff'; c.font = '700 ' + Math.floor(f * 0.6) + 'px system-ui,sans-serif';
    c.fillText('SCORE', 12, h * 0.3);
    c.fillStyle = '#fff'; c.font = '900 ' + f + 'px system-ui,sans-serif'; c.fillText(st.score.toLocaleString(), 12, h * 0.68);
    c.textAlign = 'center'; c.fillStyle = '#9aa4ff'; c.font = '700 ' + Math.floor(f * 0.6) + 'px system-ui,sans-serif';
    c.fillText('STAGE ' + st.stage, w * (w < 560 ? 0.33 : 0.42), h * 0.3);
    var tl = Math.max(0, st.cfg.tideDelay - st.time);
    c.fillStyle = tl > 0 ? '#fff' : '#6cc4ff'; c.font = '900 ' + Math.floor(f * 0.8) + 'px system-ui,sans-serif';
    c.fillText(tl > 0 ? 'TIDE ' + Math.ceil(tl) + 's' : (st.tideRing >= 3 ? 'FLOODED' : 'TIDE RISING'), w * (w < 560 ? 0.33 : 0.42), h * 0.68);
    // lives + fuse
    c.textAlign = 'left'; c.font = '900 ' + Math.floor(f * 0.9) + 'px system-ui,sans-serif'; c.fillStyle = '#ff6aa0';
    var hx = w * (w < 560 ? 0.5 : 0.58); c.fillText('♥'.repeat(Math.max(0, st.lives)) + (st.shield ? ' ◈' : ''), hx, h * 0.3);
    var kx = hx, ky = h * 0.7;
    L.KINDS.forEach(function (k, i) {
      var col = BW.Render.KCOL[k], on = st.unlocked[k], sel = st.kind === k, r = h * 0.15;
      c.globalAlpha = on ? 1 : 0.25; c.fillStyle = col[0]; c.beginPath(); c.arc(kx + i * r * 2.7 + r, ky, r, 0, 6.283); c.fill();
      if (sel) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(kx + i * r * 2.7 + r, ky, r + 3, 0, 6.283); c.stroke(); }
      c.globalAlpha = 1;
    });
    c.fillStyle = '#c8cdff'; c.font = '700 ' + Math.floor(f * 0.55) + 'px system-ui,sans-serif';
    if (w >= 560) c.fillText('×' + st.maxBombs + '  R' + st.range, kx + h * 0.15 * 8.6, ky);
  }

  /* ---------- loop ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!lay) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (st) {
      if (mode === 'play') {
        time += dt;
        L.update(st, dt, readInput());
        st.events.forEach(function (e) {
          var A = BW.Audio;
          if (e.type === 'boom') A.play('boom', e.depth); else if (e.type === 'place') A.play('place');
          else if (e.type === 'crate') A.play('crate'); else if (e.type === 'kill') A.play('kill');
          else if (e.type === 'pickup') A.play('pickup'); else if (e.type === 'chain') A.play('chain');
          else if (e.type === 'death') A.play('death'); else if (e.type === 'kind') A.play('kind');
          else if (e.type === 'tide') A.play('tide'); else if (e.type === 'clear') { A.play('clear'); banner('STAGE CLEAR +' + e.bonus.toLocaleString(), 1.6); }
          else if (e.type === 'exit-open') { A.play('exit'); banner('GATE OPEN', 1.2); }
          else if (e.type === 'shield-break') A.play('shield');
          else if (e.type === 'stage') banner('STAGE ' + e.stage, 1.6);
        });
        if (st.over && mode === 'play') { setTimeout(function () { if (mode === 'play') gameOver(); }, 900); mode = 'dying'; }
      } else if (mode === 'dying') { time += dt; L.update(st, dt, {}); }
      BW.Render.draw(ctx, st, lay, time, mode === 'play' || mode === 'dying' ? dt : 0);
      hud(ctx);
      if (bannerT > 0) {
        bannerT -= dt; ctx.save(); ctx.globalAlpha = Math.min(1, bannerT * 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '900 ' + Math.floor(Math.min(lay.cw / 12, 54)) + 'px system-ui,sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.fillStyle = '#ffe36b';
        ctx.strokeText(bannerText, lay.cw / 2, lay.oy + lay.ts * 6.5); ctx.fillText(bannerText, lay.cw / 2, lay.oy + lay.ts * 6.5); ctx.restore();
      }
    } else {
      ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, lay.cw, lay.ch);
    }
  }

  g.BW.debug = { get st() { return st; }, get mode() { return mode; }, start: start };
  resize(); title(); requestAnimationFrame(function (t) { last = t; frame(t); });
})(window);
