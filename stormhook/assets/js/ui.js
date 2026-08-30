/* =====================================================================
   STORMHOOK — ui.js   [OWNER: agent-ui]

   The DOM layer: HUD, screens, toasts, the score-submit modal. The world
   canvas draws no text — everything readable is DOM, so it scales with
   the device and stays crisp at any DPR.

   FIRST PASS (lead-authored scaffold, 2026-08-27).
   ===================================================================== */
(function (global) {
  'use strict';

  var SH = global.SH || (global.SH = {});
  var U = SH.UI = {};

  var root = null, els = {};
  var toastT = 0;
  var pops = [];

  function el(tag, cls, html) {
    var d = global.document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }

  U.init = function () {
    root = global.document.getElementById('sh-ui');
    if (!root) return;
    root.innerHTML = '';

    /* --- HUD --- */
    els.hud = el('div', 'sh-hud');
    els.hud.innerHTML =
      '<div class="sh-hud-left">' +
        '<div class="sh-stat"><span class="sh-k">SCORE</span><b id="sh-score">0</b></div>' +
        '<div class="sh-stat"><span class="sh-k">SALVAGE</span><b id="sh-cores">0/0</b></div>' +
      '</div>' +
      '<div class="sh-hud-mid">' +
        '<div id="sh-combo" class="sh-combo">×1</div>' +
        '<div id="sh-air" class="sh-air"><i></i></div>' +
      '</div>' +
      '<div class="sh-hud-right">' +
        '<div class="sh-stat"><span class="sh-k">LEVEL</span><b id="sh-level">1</b></div>' +
        '<div class="sh-stat"><span class="sh-k">TIME</span><b id="sh-time">0:00.00</b></div>' +
      '</div>';
    root.appendChild(els.hud);

    els.warn = el('div', 'sh-warn', 'THE FRONT IS ON YOU');
    root.appendChild(els.warn);

    els.toast = el('div', 'sh-toast');
    root.appendChild(els.toast);

    els.pops = el('div', 'sh-pops');
    root.appendChild(els.pops);

    /* --- screens --- */
    els.screen = el('div', 'sh-screen');
    root.appendChild(els.screen);

    els.back = el('a', 'sh-back', '← Arcade');
    els.back.href = '../index.html';
    root.appendChild(els.back);

    els.mute = el('button', 'sh-mute', '♪');
    els.mute.setAttribute('aria-label', 'Toggle sound');
    els.mute.addEventListener('click', function (e) {
      e.preventDefault();
      SH.Audio.resume();
      SH.Audio.toggleMuted();
      syncMute();
    });
    root.appendChild(els.mute);
    SH.on('muted', syncMute);

    U.setScreen('boot');
  };

  function syncMute() {
    if (!els.mute) return;
    var m = SH.Audio.isMuted && SH.Audio.isMuted();
    els.mute.textContent = m ? '♪̸' : '♪';
    els.mute.classList.toggle('is-muted', !!m);
  }

  function btn(label, fn, cls) {
    var b = el('button', 'sh-btn ' + (cls || ''), label);
    b.addEventListener('click', function (e) {
      e.preventDefault();
      SH.Audio.resume();
      fn();
    });
    return b;
  }

  U.setScreen = function (name) {
    if (!els.screen) return;
    var s = els.screen;
    s.innerHTML = '';
    s.className = 'sh-screen sh-screen--' + name;
    root.classList.toggle('sh-playing', name === 'playing');

    if (name === 'playing' || name === 'boot') { s.classList.add('is-hidden'); return; }
    s.classList.remove('is-hidden');

    var card = el('div', 'sh-card');
    var G = SH.Game, st = G.state;

    if (name === 'title') {
      card.appendChild(el('h1', 'sh-title', 'STORMHOOK'));
      card.appendChild(el('p', 'sh-sub',
        'Salvage the wreck-fields ahead of the front. Point, latch, swing — and keep your boots off the deck.'));
      var how = el('div', 'sh-how');
      how.innerHTML = SH.Input.isTouch
        ? '<b>Touch and hold</b> anywhere to fire the tether at that point.<br>' +
          '<b>Drag up / down</b> while held to reel in or pay out.<br>' +
          '<b>Second finger</b> to dash toward your aim.'
        : '<b>Hold the left mouse button</b> to fire the tether where you point.<br>' +
          '<b>W / S</b> (or the wheel) reel in and pay out. <b>A / D</b> lean.<br>' +
          '<b>Space</b> dashes toward the cursor. <b>R</b> restarts, <b>P</b> pauses.';
      card.appendChild(how);
      card.appendChild(el('p', 'sh-note',
        'Your score multiplier climbs the longer you stay airborne. Landing costs you all of it.'));
      var best = SH.store.get('best', 0);
      if (best > 0) card.appendChild(el('p', 'sh-best', 'Best run: ' + SH.fmtNum(best)));
      card.appendChild(btn('Begin the run', function () { SH.Game.startRun(0); }, 'sh-btn--go'));
    }

    else if (name === 'paused') {
      card.appendChild(el('h2', null, 'Paused'));
      card.appendChild(btn('Resume', function () { SH.Game.togglePause(); }, 'sh-btn--go'));
      card.appendChild(btn('Restart level', function () { SH.Game.restartLevel(); }));
    }

    else if (name === 'clear') {
      var c = SH.Game.lastClear || {};
      card.appendChild(el('h2', null, 'Extracted'));
      var t = el('div', 'sh-rows');
      t.innerHTML =
        row('Salvage', (c.cores || 0) + ' / ' + (c.coresMax || 0)) +
        row('Time', SH.fmtTime(c.time || 0) + ' <span class="sh-dim">par ' + SH.fmtTime(c.par || 0) + '</span>') +
        row('Extraction bonus', '+' + SH.fmtNum(c.bonus || 0)) +
        row('Level total', SH.fmtNum(c.levelScore || 0), true);
      card.appendChild(t);
      var last = st.levelIndex + 1 >= SH.Levels.count();
      card.appendChild(btn(last ? 'Finish run' : 'Next wreck', function () {
        SH.Game.continueFromClear();
      }, 'sh-btn--go'));
    }

    else if (name === 'gameover') {
      card.appendChild(el('h2', null, 'Run complete'));
      var g = el('div', 'sh-rows');
      g.innerHTML =
        row('Salvage recovered', String(st.coresTotal)) +
        row('Best multiplier', '×' + st.bestCombo) +
        row('Wrecks lost', String(st.deaths)) +
        row('Final score', SH.fmtNum(st.runScore), true);
      card.appendChild(g);
      card.appendChild(btn('Run it again', function () { SH.Game.startRun(0); }, 'sh-btn--go'));
      var lb = el('a', 'sh-btn sh-btn--ghost', 'View leaderboard');
      lb.href = '../leaderboard.html?gameId=stormhook';
      card.appendChild(lb);
    }

    s.appendChild(card);
  };

  function row(k, v, strong) {
    return '<div class="sh-row' + (strong ? ' is-strong' : '') + '">' +
           '<span>' + k + '</span><b>' + v + '</b></div>';
  }

  /* ------------------------------------------------------------------
     Per-frame HUD
     ------------------------------------------------------------------ */
  var lastScore = -1, lastCombo = -1;
  U.hud = function (world, st) {
    if (!els.hud || !world || !st) return;
    if (st.phase !== 'playing') { els.hud.classList.add('is-dim'); }
    else els.hud.classList.remove('is-dim');

    var sc = global.document.getElementById('sh-score');
    if (sc && st.runScore !== lastScore) {
      sc.textContent = SH.fmtNum(st.runScore);
      sc.classList.remove('is-bump');
      void sc.offsetWidth;
      sc.classList.add('is-bump');
      lastScore = st.runScore;
    }

    setText('sh-cores', world.cores_taken + '/' + world.cores.length);
    setText('sh-level', (st.levelIndex + 1) + '/' + SH.Levels.count());
    setText('sh-time', SH.fmtTime(world.time));

    var cb = global.document.getElementById('sh-combo');
    if (cb) {
      if (world.combo !== lastCombo) {
        cb.textContent = '×' + world.combo;
        cb.classList.toggle('is-hot', world.combo >= 5);
        cb.classList.remove('is-bump'); void cb.offsetWidth; cb.classList.add('is-bump');
        lastCombo = world.combo;
      }
      cb.style.opacity = world.combo > 1 ? 1 : 0.35;
    }
    var air = global.document.getElementById('sh-air');
    if (air && air.firstChild) {
      var frac = (world.airTime % SH.TUNE.comboAirTime) / SH.TUNE.comboAirTime;
      air.firstChild.style.width = (world.combo >= SH.TUNE.comboMax ? 100 : frac * 100) + '%';
    }

    /* Storm proximity warning. */
    var gap = world.p.x - world.storm.x;
    var near = gap < 340 && !world.dead && st.phase === 'playing';
    els.warn.classList.toggle('is-on', near);
    root.classList.toggle('sh-danger', near);
  };

  function setText(id, v) {
    var n = global.document.getElementById(id);
    if (n && n.textContent !== v) n.textContent = v;
  }

  /* Floating score numbers at the pickup, in screen space. */
  U.popScore = function (wx, wy, amount, combo) {
    if (!els.pops || !SH.Render.worldToScreen) return;
    var p = SH.Render.worldToScreen(wx, wy);
    var d = el('div', 'sh-pop' + (combo >= 5 ? ' is-hot' : ''), '+' + SH.fmtNum(amount));
    d.style.left = p.x + 'px';
    d.style.top = p.y + 'px';
    els.pops.appendChild(d);
    pops.push({ node: d, t: 0 });
    if (pops.length > 24) { var old = pops.shift(); if (old.node.parentNode) old.node.remove(); }
  };

  U.update = function (dt) {
    for (var i = pops.length - 1; i >= 0; i--) {
      var p = pops[i];
      p.t += dt;
      if (p.t > 0.95) { if (p.node.parentNode) p.node.remove(); pops.splice(i, 1); }
    }
    if (toastT > 0) {
      toastT -= dt * 1000;
      if (toastT <= 0 && els.toast) els.toast.classList.remove('is-on');
    }
  };

  U.toast = function (msg, ms) {
    if (!els.toast) return;
    els.toast.innerHTML = msg;
    els.toast.classList.add('is-on');
    toastT = ms || 2000;
  };

  /* A DOM modal, so it is keyboard-accessible and the on-screen keyboard
     works on a phone. */
  U.prompt = function (o) {
    o = o || {};
    return new Promise(function (resolve) {
      if (!root) { resolve(null); return; }
      var back = el('div', 'sh-modal');
      var card = el('div', 'sh-card sh-card--modal');
      card.appendChild(el('h2', null, o.title || ''));
      if (o.body) card.appendChild(el('p', 'sh-sub', o.body));
      var inp = global.document.createElement('input');
      inp.type = 'text';
      inp.className = 'sh-input';
      inp.placeholder = o.placeholder || '';
      inp.maxLength = o.maxLength || 20;
      card.appendChild(inp);
      var rowEl = el('div', 'sh-modal-actions');
      function done(v) { back.remove(); resolve(v); }
      rowEl.appendChild(btn('Submit', function () { done(inp.value); }, 'sh-btn--go'));
      rowEl.appendChild(btn('Skip', function () { done(null); }, 'sh-btn--ghost'));
      card.appendChild(rowEl);
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); done(inp.value); }
        if (e.key === 'Escape') { e.preventDefault(); done(null); }
        e.stopPropagation();
      });
      back.appendChild(card);
      root.appendChild(back);
      global.setTimeout(function () { try { inp.focus(); } catch (e) {} }, 30);
    });
  };

})(typeof window !== 'undefined' ? window : this);
