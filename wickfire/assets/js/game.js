/* Wickfire game shell: input, HUD, menus, touch controls, loop, leaderboard. */
(function () {
  'use strict';
  var WK = window.WK = window.WK || {};
  var S = WK.sim, GAME_ID = 'wickfire';
  var g = null, phase = 'menu', keys = {}, pressed = { drop: false, ignite: false }, joy = { x: 0, y: 0, id: null, bx: 0, by: 0 };
  var acc = 0, last = 0, t = 0, ui = {}, submitted = false, best = 0;
  try { best = Number(localStorage.getItem('wickfire.best')) || 0; } catch (e) {}

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function buildUI() {
    var root = $('wk-ui');
    root.innerHTML =
      '<div id="wk-hud" hidden>' +
        '<a class="wk-back" href="../index.html" aria-label="Back to Arcade">&larr;<span> Arcade</span></a>' +
        '<div class="wk-stat"><i>Score</i><b id="h-score">0</b></div>' +
        '<div class="wk-stat"><i>Level</i><b id="h-level">1</b></div>' +
        '<div class="wk-stat"><i>Lives</i><b id="h-lives">♥♥♥</b></div>' +
        '<div class="wk-stat wk-wide"><i>Wick</i><span class="wk-wickbar"><span id="h-wick"></span></span></div>' +
        '<div class="wk-stat wk-hide-sm"><i>Kegs</i><b id="h-kegs">1</b></div>' +
        '<button id="h-pause" class="wk-icon" aria-label="Pause">❚❚</button>' +
      '</div>' +
      '<div id="wk-combo" hidden></div>' +
      '<div id="wk-touch" hidden>' +
        '<div id="wk-joy"><div id="wk-joy-base"><div id="wk-joy-knob"></div></div></div>' +
        '<button id="t-light" class="wk-btn wk-btn-light" aria-label="Light the wick">LIGHT</button>' +
        '<button id="t-drop" class="wk-btn wk-btn-drop" aria-label="Drop charge">DROP</button>' +
      '</div>' +
      '<div id="wk-modal" class="wk-modal"></div>';
    ui.hud = $('wk-hud'); ui.touch = $('wk-touch'); ui.modal = $('wk-modal'); ui.combo = $('wk-combo');
  }

  function modal(html, cls) { ui.modal.className = 'wk-modal show ' + (cls || ''); ui.modal.innerHTML = '<div class="wk-card">' + html + '</div>'; }
  function closeModal() { ui.modal.className = 'wk-modal'; ui.modal.innerHTML = ''; }

  function showMenu() {
    phase = 'menu'; ui.hud.hidden = true; ui.touch.hidden = true;
    modal('<h1>WICKFIRE</h1><p class="sub">Lay the wick. Lure them over it. Light it.</p>' +
      '<ul class="how"><li><b>No timers.</b> Charges only blow when fire runs down your wick, or when another blast reaches them.</li>' +
      '<li>You trail wick behind you. <b>LIGHT</b> sets the trail burning from the far end &mdash; step off it!</li>' +
      '<li>Enemies standing on burning wick die. Chains multiply your score. Clear the vault, find the hatch.</li></ul>' +
      '<p class="keys">Move <kbd>WASD</kbd>/<kbd>&larr;&uarr;&darr;&rarr;</kbd> &middot; Drop <kbd>Space</kbd> &middot; Light <kbd>E</kbd>/<kbd>Shift</kbd> &middot; Pause <kbd>P</kbd></p>' +
      '<button class="wk-primary" id="m-play">Play</button>' +
      (best ? '<p class="best">Best: ' + fmt(best) + '</p>' : '') +
      '<a class="wk-link" href="../leaderboard.html?gameId=wickfire">View Leaderboard</a> <a class="wk-link" href="../index.html">Back to Arcade</a>');
    $('m-play').onclick = function () { WK.audio.unlock(); WK.audio.play('ui'); startGame(); };
  }

  function startGame() {
    g = S.newGame((Math.random() * 1e9) | 0); submitted = false;
    WK.render.reset(); closeModal(); phase = 'play';
    ui.hud.hidden = false; ui.touch.hidden = !document.body.classList.contains('touch');
    WK.audio.startMusic(); announce();
  }
  function announce() {
    ui.combo.hidden = false; ui.combo.className = 'show lvl'; ui.combo.textContent = 'VAULT ' + g.level;
    setTimeout(function () { if (ui.combo.className.indexOf('lvl') >= 0) { ui.combo.hidden = true; } }, 1400);
  }

  function pause(on) {
    if (phase === 'play' && on) { phase = 'pause'; modal('<h2>Paused</h2><button class="wk-primary" id="m-res">Resume</button><button class="wk-sec" id="m-mus">Music: ' + (WK.audio.music ? 'On' : 'Off') + '</button><button class="wk-sec" id="m-sfx">Sound: ' + (WK.audio.sfx ? 'On' : 'Off') + '</button><button class="wk-sec" id="m-quit">Quit run</button>');
      $('m-res').onclick = function () { pause(false); };
      $('m-mus').onclick = function () { WK.audio.setMusic(!WK.audio.music); pause(false); pause(true); };
      $('m-sfx').onclick = function () { WK.audio.setSfx(!WK.audio.sfx); pause(false); pause(true); };
      $('m-quit').onclick = function () { gameOver(); };
    } else if (phase === 'pause' && !on) { closeModal(); phase = 'play'; last = performance.now(); }
  }

  function gameOver() {
    phase = 'over'; ui.touch.hidden = true; WK.audio.stopMusic();
    var sc = Math.round(g.score); if (sc > best) { best = sc; try { localStorage.setItem('wickfire.best', String(sc)); } catch (e) {} }
    modal('<h2>Vault Lost</h2><p class="big">' + fmt(sc) + '</p><p class="sub">Reached vault ' + g.level + ' &middot; best chain x' + g.best + '</p><button class="wk-primary" id="m-again">Play again</button><a class="wk-link" href="../leaderboard.html?gameId=wickfire">View Leaderboard</a> <a class="wk-link" href="../index.html">Back to Arcade</a>');
    $('m-again').onclick = function () { WK.audio.play('ui'); startGame(); };
    submitScore(sc);
  }

  async function submitScore(score) {
    if (submitted || !(score > 0)) return; submitted = true;
    try {
      var res = await fetch('/api/leaderboard/rank?gameId=' + encodeURIComponent(GAME_ID) + '&score=' + encodeURIComponent(score), { headers: { Accept: 'application/json' } });
      if (!res.ok) return; var data = await res.json(); var rank = Number(data && data.rank);
      if (!isFinite(rank) || rank <= 0 || rank > 20) return;
      var name = window.prompt('Top 20! You placed #' + rank + ' with ' + fmt(score) + '. Enter your name:');
      if (name == null) return;
      name = String(name).trim().replace(/[^\w \-'.!]/g, '').slice(0, 20); if (!name) return;
      await fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: GAME_ID, name: name, score: score }) });
    } catch (e) { /* offline is fine */ }
  }

  function levelClear(e) {
    phase = 'clear';
    modal('<h2>Vault ' + e.level + ' Cleared</h2><p class="big">+' + fmt(e.bonus) + '</p><p class="sub">Score ' + fmt(g.score) + '</p><button class="wk-primary" id="m-next">Next vault</button>');
    $('m-next').onclick = function () { WK.audio.play('ui'); S.nextLevel(g); WK.render.reset(); closeModal(); phase = 'play'; announce(); last = performance.now(); };
  }

  // ---------- input ----------
  var KEYMAP = { ArrowLeft: 'l', a: 'l', ArrowRight: 'r', d: 'r', ArrowUp: 'u', w: 'u', ArrowDown: 'd', s: 'd' };
  window.addEventListener('keydown', function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYMAP[k]) { keys[KEYMAP[k]] = true; e.preventDefault(); }
    else if (k === ' ' || k === 'x') { if (!e.repeat) pressed.drop = true; e.preventDefault(); }
    else if (k === 'e' || k === 'Shift' || k === 'Enter' || k === 'z') { if (!e.repeat) pressed.ignite = true; e.preventDefault(); }
    else if (k === 'p' || k === 'Escape') { pause(phase === 'play'); }
    else if (k === 'm') { WK.audio.setMusic(!WK.audio.music); }
    if (phase === 'menu' && (k === 'Enter' || k === ' ')) { var b = $('m-play'); if (b) b.click(); }
  });
  window.addEventListener('keyup', function (e) { var k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (KEYMAP[k]) keys[KEYMAP[k]] = false; });
  window.addEventListener('blur', function () { keys = {}; joy.x = joy.y = 0; if (phase === 'play') pause(true); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && phase === 'play') pause(true); });

  function bindTouch() {
    document.body.classList.add('touch');
    var base = $('wk-joy-base'), knob = $('wk-joy-knob'), zone = $('wk-joy');
    function setKnob(dx, dy) { knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
    zone.addEventListener('pointerdown', function (e) { joy.id = e.pointerId; zone.setPointerCapture(e.pointerId); var r = base.getBoundingClientRect(); joy.bx = r.left + r.width / 2; joy.by = r.top + r.height / 2; mv(e); });
    function mv(e) {
      var dx = e.clientX - joy.bx, dy = e.clientY - joy.by, m = Math.hypot(dx, dy), R = 48, k = Math.min(1, m / R);
      if (m > 0) { joy.x = dx / m * k; joy.y = dy / m * k; } setKnob(joy.x * R, joy.y * R);
      if (k < 0.3) { joy.x = joy.y = 0; }
    }
    zone.addEventListener('pointermove', function (e) { if (e.pointerId === joy.id) mv(e); });
    function up(e) { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; setKnob(0, 0); } }
    zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
    $('t-drop').addEventListener('pointerdown', function (e) { e.preventDefault(); pressed.drop = true; });
    $('t-light').addEventListener('pointerdown', function (e) { e.preventDefault(); pressed.ignite = true; });
    ui.touch.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    WK.render.resize();
  }

  // ---------- HUD ----------
  var hv = {};
  function setText(id, v) { if (hv[id] !== v) { hv[id] = v; $(id).textContent = v; } }
  function hud() {
    var p = g.player;
    setText('h-score', fmt(g.score)); setText('h-level', String(g.level));
    setText('h-lives', new Array(p.lives + 1).join('♥') || '—'); setText('h-kegs', (p.maxCharges - g.charges.length) + '/' + p.maxCharges);
    var pct = Math.round(p.wick.length / p.wickMax * 100); if (hv.wick !== pct) { hv.wick = pct; $('h-wick').style.width = pct + '%'; }
    var c = ui.combo;
    if (g.combo > 1 && g.comboT > 0) { c.hidden = false; c.className = 'show'; c.textContent = 'CHAIN x' + g.combo; }
    else if (c.className.indexOf('lvl') < 0) c.hidden = true;
  }

  // ---------- loop ----------
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (phase === 'play' && g) {
      acc += dt;
      while (acc >= 1 / 60) {
        acc -= 1 / 60;
        var ix = (keys.r ? 1 : 0) - (keys.l ? 1 : 0) + joy.x, iy = (keys.d ? 1 : 0) - (keys.u ? 1 : 0) + joy.y;
        S.step(g, 1 / 60, { x: ix, y: iy, drop: pressed.drop, ignite: pressed.ignite });
        pressed.drop = pressed.ignite = false;
        var ev = g.events; g.events = [];
        for (var i = 0; i < ev.length; i++) {
          WK.render.event(ev[i]);
          if (WK.audio[ev[i].t] || ['drop', 'ignite', 'boom', 'crate', 'kill', 'pickup', 'hurt', 'over', 'clear'].indexOf(ev[i].t) >= 0) WK.audio.play(ev[i].t, ev[i]);
          if (ev[i].t === 'clear') { levelClear(ev[i]); }
          if (ev[i].t === 'over') { setTimeout(gameOver, 900); phase = 'dying'; }
        }
        if (phase !== 'play' && phase !== 'dying') break;
      }
      hud();
    } else if (phase === 'dying' && g) { S.step(g, dt, null); g.events = []; }
    if (g) WK.render.draw(g, t);
    else WK.render.draw(WK.demo, t);
  }

  function init() {
    buildUI();
    WK.render.init($('wk-canvas'));
    if (window.matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) bindTouch();
    $('h-pause').onclick = function () { pause(phase === 'play'); };
    WK.demo = S.newGame(20261010); WK.demo.player.inv = 1e9;
    showMenu();
    last = performance.now(); requestAnimationFrame(frame);
    document.addEventListener('pointerdown', function () { WK.audio.unlock(); }, { once: true });
  }
  WK.game = { get state() { return g; }, get phase() { return phase; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
