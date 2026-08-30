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
  var coachT = 0, coachVisible = false, coachKey = '';
  var learned = { hook: false, reel: false, dash: false };

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
    els.hud.setAttribute('role', 'group');
    els.hud.setAttribute('aria-label', 'Run status');
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
    els.warn.setAttribute('role', 'alert');
    els.warn.setAttribute('aria-live', 'assertive');
    els.warn.setAttribute('aria-hidden', 'true');
    root.appendChild(els.warn);

    els.toast = el('div', 'sh-toast');
    els.toast.setAttribute('role', 'status');
    els.toast.setAttribute('aria-live', 'polite');
    root.appendChild(els.toast);

    els.pops = el('div', 'sh-pops');
    root.appendChild(els.pops);

    /* Compact first-action coach. Inline layout keeps this revision owned by
       ui.js; pointer-events stay off so aiming works through the affordance. */
    els.coach = el('div', 'sh-coach');
    els.coach.setAttribute('role', 'status');
    els.coach.setAttribute('aria-live', 'polite');
    els.coach.setAttribute('aria-hidden', 'true');
    els.coach.style.cssText =
      'position:absolute;left:50%;bottom:calc(64px + var(--safe-b));' +
      'transform:translate(-50%,8px);max-width:min(320px,calc(100vw - 112px));' +
      'padding:8px 12px;border:1px solid rgba(233,241,247,.18);border-radius:9px;' +
      'background:rgba(7,14,23,.78);box-shadow:0 8px 26px rgba(0,0,0,.35);' +
      'backdrop-filter:blur(5px);text-align:center;pointer-events:none;opacity:0;' +
      'transition:opacity .18s ease,transform .18s ease;z-index:6;';
    els.coachAction = el('b', 'sh-k');
    els.coachAction.style.cssText =
      'display:block;color:var(--gold);font-size:11px;line-height:1.2;margin-bottom:3px;';
    els.coachDetail = el('span', null);
    els.coachDetail.style.cssText =
      'display:block;color:rgba(233,241,247,.82);font:600 11px/1.35 var(--disp);';
    els.coach.appendChild(els.coachAction);
    els.coach.appendChild(els.coachDetail);
    root.appendChild(els.coach);

    /* --- screens --- */
    els.screen = el('div', 'sh-screen');
    els.screen.setAttribute('role', 'dialog');
    els.screen.setAttribute('aria-modal', 'true');
    root.appendChild(els.screen);

    els.back = el('a', 'sh-back', '← Arcade');
    els.back.href = '../index.html';
    els.back.setAttribute('aria-label', 'Back to Bot Built Arcade');
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

  function setHudVisibility(phase) {
    if (!els.hud) return;
    var visible = phase === 'playing' || phase === 'paused';
    els.hud.hidden = !visible;
    els.hud.style.display = visible ? '' : 'none';
    els.hud.setAttribute('aria-hidden', visible ? 'false' : 'true');
    els.hud.classList.toggle('is-dim', phase === 'paused');

    if (!visible) {
      if (els.warn) {
        els.warn.classList.remove('is-on');
        els.warn.setAttribute('aria-hidden', 'true');
      }
      if (root) root.classList.remove('sh-danger');
    }
    if (phase !== 'playing') hideCoach();
  }

  function hideCoach() {
    if (!els.coach) return;
    els.coach.style.opacity = '0';
    els.coach.style.transform = 'translate(-50%,8px)';
    els.coach.setAttribute('aria-hidden', 'true');
    coachVisible = false;
    coachKey = '';
  }

  function showCoach(key, action, detail) {
    if (!els.coach || coachT >= 11000) { hideCoach(); return; }
    if (coachKey !== key) {
      els.coachAction.textContent = action;
      els.coachDetail.textContent = detail;
      coachKey = key;
    }
    els.coach.style.opacity = '1';
    els.coach.style.transform = 'translate(-50%,0)';
    els.coach.setAttribute('aria-hidden', 'false');
    coachVisible = true;
  }

  function syncCoach(world, st) {
    if (!world || !st || st.phase !== 'playing' || coachT >= 11000) {
      hideCoach();
      return;
    }

    learned.hook = learned.hook || !!(world.hook && world.hook.attached);
    learned.reel = learned.reel || Math.abs(SH.Input.reel || 0) > 0;
    learned.dash = learned.dash || !!(world.p && world.p.dashCd > 0);

    if (!learned.hook) {
      showCoach('hook', SH.Input.isTouch ? 'HOLD TO HOOK' : 'HOLD MOUSE TO HOOK',
        'Aim at bright hull or girder surfaces');
    } else if (!learned.reel) {
      showCoach('reel', SH.Input.isTouch ? 'DRAG UP / DOWN TO REEL' : 'W / S TO REEL',
        SH.Input.isTouch ? 'Second finger dashes toward your aim' : 'A / D leans · Space dashes');
    } else if (!learned.dash) {
      showCoach('dash', SH.Input.isTouch ? 'SECOND FINGER TO DASH' : 'SPACE TO DASH',
        'Release the hook to carry your momentum');
    } else {
      hideCoach();
    }
  }

  function kicker(text) {
    var k = el('p', 'sh-k', text);
    k.style.margin = '0 0 8px';
    return k;
  }

  U.setScreen = function (name) {
    if (!els.screen) return;
    var s = els.screen;
    var labels = {
      title: 'Stormhook title screen',
      paused: 'Game paused',
      clear: 'Wreck extraction results',
      gameover: 'Run results'
    };
    s.innerHTML = '';
    s.className = 'sh-screen sh-screen--' + name;
    s.setAttribute('aria-label', labels[name] || 'Stormhook');
    root.classList.toggle('sh-playing', name === 'playing');
    setHudVisibility(name);

    if (name === 'playing' || name === 'boot') {
      s.classList.add('is-hidden');
      s.setAttribute('aria-hidden', 'true');
      return;
    }
    s.classList.remove('is-hidden');
    s.setAttribute('aria-hidden', 'false');

    var card = el('div', 'sh-card sh-card--' + name);
    var G = SH.Game, st = G.state;

    if (name === 'title') {
      card.appendChild(kicker('WRECK-FIELD SALVAGE DIVISION'));
      card.appendChild(el('h1', 'sh-title', 'STORMHOOK'));
      card.appendChild(el('p', 'sh-sub',
        'Salvage the wreck-fields ahead of the front. Point, latch, swing — and keep your boots off the deck.'));
      var how = el('div', 'sh-rows');
      how.setAttribute('aria-label', 'Controls');
      how.innerHTML = SH.Input.isTouch
        ? row('1 · LATCH', 'Hold at target') +
          row('2 · SHAPE ARC', 'Drag ↑↓ to reel') +
          row('3 · RELEASE', 'Lift · second finger dashes')
        : row('1 · LATCH', 'Hold mouse at target') +
          row('2 · SHAPE ARC', 'W/S reel · A/D lean') +
          row('3 · RELEASE', 'Lift mouse · Space dashes');
      card.appendChild(how);
      card.appendChild(el('p', 'sh-note',
        'Stay airborne to raise the multiplier. Landing resets it. R restarts · P pauses.'));
      var best = SH.store.get('best', 0);
      if (best > 0) card.appendChild(el('p', 'sh-best', 'Best run: ' + SH.fmtNum(best)));
      card.appendChild(btn('Begin the run', function () { SH.Game.startRun(0); }, 'sh-btn--go'));
    }

    else if (name === 'paused') {
      card.appendChild(kicker('RUN SUSPENDED'));
      card.appendChild(el('h2', null, 'Paused'));
      card.appendChild(el('p', 'sh-sub', 'Your momentum is held. Resume when you are ready to outrun the front.'));
      card.appendChild(btn('Resume', function () { SH.Game.togglePause(); }, 'sh-btn--go'));
      card.appendChild(btn('Restart level', function () { SH.Game.restartLevel(); }));
    }

    else if (name === 'clear') {
      var c = SH.Game.lastClear || {};
      card.appendChild(kicker('BEACON LOCK CONFIRMED'));
      card.appendChild(el('h2', null, 'Wreck extracted'));
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
      card.appendChild(kicker('EXPEDITION COMPLETE'));
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
    setHudVisibility(st.phase);
    if (st.phase !== 'playing' && st.phase !== 'paused') return;

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
        cb.setAttribute('aria-label', 'Score multiplier ' + world.combo);
        cb.classList.toggle('is-hot', world.combo >= 5);
        cb.classList.remove('is-bump'); void cb.offsetWidth; cb.classList.add('is-bump');
        lastCombo = world.combo;
      }
      cb.style.opacity = world.combo > 1 ? 1 : 0.82;
      cb.style.textShadow = world.combo > 1 ? '' :
        '0 2px 8px rgba(0,0,0,.9), 0 0 10px rgba(91,224,213,.34)';
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
    els.warn.setAttribute('aria-hidden', near ? 'false' : 'true');
    root.classList.toggle('sh-danger', near);
    syncCoach(world, st);
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
    if (coachVisible) coachT += dt * 1000;
    if (coachT >= 11000) hideCoach();
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
