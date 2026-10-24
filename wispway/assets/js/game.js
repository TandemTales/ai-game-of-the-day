(function (global) {
  'use strict';
  var WW = global.WW, L = WW.Logic, A = WW.Audio, R = WW.Render;
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('hall'), panel = $('panel'), title = $('panel-title'), copy = $('panel-copy'),
    startBtn = $('start'), flareBtn = $('flare'), muteBtn = $('mute'), feedback = $('feedback'),
    gatebar = $('gatebar'), gatefill = $('gatefill');
  var game = null, running = false, last = 0, acc = 0, clock = 0, submitted = false, muted = false;
  var demo = L.newGame(Date.now() & 0xffff); demo.status = 'demo';
  var msg = 'EAT EVERY EMBER', msgUntil = 0;

  function say(text, ms) { msg = text; msgUntil = performance.now() + (ms || 1800); }
  function hud(s) {
    $('score').textContent = s.score.toLocaleString(); $('best').textContent = Math.max(s.best, s.score).toLocaleString();
    $('level').textContent = s.level; $('lives').textContent = Math.max(0, s.lives);
    $('charges').textContent = s.charges;
    flareBtn.classList.toggle('ready', s.charges > 0);
    gatebar.hidden = !running; gatebar.classList.toggle('warn', s.warn);
    gatefill.style.transform = 'scaleX(' + Math.max(0, s.gateTimer / L.GATE_PERIOD) + ')';
    feedback.textContent = performance.now() < msgUntil ? msg : (s.fright > 0 ? 'GLOAMS ARE AFRAID!' : s.warn ? 'GATES SHIFTING!' : 'EAT EVERY EMBER');
  }
  var bestKey = 'wispway-best', bestSaved = 0;
  try { bestSaved = parseInt(localStorage.getItem(bestKey), 10) || 0; } catch (e) { }

  function begin() {
    A.unlock(); A.startDrone();
    game = L.newGame(Date.now() & 0xffffff); game.best = bestSaved;
    running = true; submitted = false; panel.hidden = true; acc = 0;
  }
  startBtn.addEventListener('click', begin);

  var EVT = { ember: 0, power: 'THE GLOAMS FLEE!', eatGloam: 'GOTCHA!', fruit: 'LANTERN FRUIT!', gateFlip: 'GATES SHIFTED', gateWarn: 'GATES ABOUT TO SHIFT!',
    flare: 'FLARE!', flareFail: 'NO FLARE CHARGE', charge: 'FLARE CHARGED', life: 'EXTRA LIFE!', clear: 'HALL CLEARED!', death: 'CAUGHT!' };
  function handle(events) {
    events.forEach(function (e) {
      A.event(e); R.event(e);
      if (EVT[e.type]) say(EVT[e.type], 1400);
      if (e.type === 'over') finish();
    });
  }

  async function finish() {
    running = false;
    if (game.score > bestSaved) { bestSaved = game.score; try { localStorage.setItem(bestKey, String(game.score)); } catch (e) { } }
    title.textContent = 'The hall goes dark'; copy.textContent = 'Final score ' + game.score.toLocaleString() + ' · reached level ' + game.level + '.';
    startBtn.textContent = 'PLAY AGAIN'; panel.hidden = false; A.stopDrone();
    if (global.location.protocol === 'file:' || submitted || game.score <= 0) return;
    submitted = true;
    try {
      var response = await fetch('/api/leaderboard/rank?gameId=wispway&score=' + game.score);
      if (!response.ok) return;
      var rank = (await response.json()).rank;
      if (!(rank && rank <= 20)) return;
      var name = global.prompt('Top 20! Rank #' + rank + '. Name for the leaderboard?');
      if (!name) return;
      await fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'wispway', name: name.slice(0, 20), score: game.score }) });
      copy.textContent += ' Submitted at rank #' + rank + '!';
    } catch (e) { /* offline: score stays local */ }
  }

  var DIRMAP = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  function steer(dx, dy) { if (running && game) L.setDir(game, dx, dy); }
  document.addEventListener('keydown', function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key, d = DIRMAP[k];
    if (d) { e.preventDefault(); steer(d[0], d[1]); A.unlock(); }
    else if (e.key === ' ' || e.key === 'f') { e.preventDefault(); if (running && !e.repeat) L.flare(game); }
    else if (e.key === 'Enter' && !running) begin();
    else if (e.key === 'm') muteBtn.click();
  });
  flareBtn.addEventListener('click', function () { if (running) L.flare(game); });
  muteBtn.addEventListener('click', function () {
    muted = !muted; A.setMuted(muted); if (!muted && running) A.startDrone();
    muteBtn.textContent = muted ? 'SOUND OFF' : 'SOUND ON'; muteBtn.setAttribute('aria-pressed', muted);
  });

  // swipe: direction re-evaluates as the finger travels, so one long drag can steer repeatedly
  var origin = null;
  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); origin = { x: e.clientX, y: e.clientY }; A.unlock(); });
  canvas.addEventListener('pointermove', function (e) {
    if (!origin) return;
    var dx = e.clientX - origin.x, dy = e.clientY - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
    if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1, 0); else steer(0, dy > 0 ? 1 : -1);
    origin = { x: e.clientX, y: e.clientY };
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { canvas.addEventListener(n, function () { origin = null; }); });
  document.addEventListener('visibilitychange', function () { last = 0; });

  function frame(ts) {
    var s = running ? game : demo;
    var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts; clock += dt;
    if (running) {
      acc += dt;
      while (acc >= 1 / 60) { L.step(game, 1 / 60); acc -= 1 / 60; handle(L.drain(game)); if (!running) break; }
    }
    R.draw(canvas, s, clock, dt);
    hud(s);
    global.requestAnimationFrame(frame);
  }
  global.WispwayDebug = { state: function () { return game || demo; }, start: begin };
  global.requestAnimationFrame(frame);
})(window);
