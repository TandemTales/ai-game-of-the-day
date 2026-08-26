/* =====================================================================
   ZEPHYR CIRCUIT — ui.js
   HUD, screens, and the touch controls.
   Owner: agent-ui (this first pass written by the lead).

   Classic script, DOM only — no canvas and no three.js. Text stays crisp
   at any device pixel ratio and the controls get real hit targets.
   ===================================================================== */
(function (global) {
  'use strict';

  var ZC = global.ZC || (global.ZC = {});
  var U = ZC.UI = {};
  var R = null;

  var root = null, els = {}, toastTimer = 0, countdownTimer = 0;

  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /* pointerdown rather than click: a 300ms delay on a control you press
     mid-corner is unusable */
  function button(cls, html, fn, label) {
    var b = h('button', cls, html);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation(); fn(e);
    });
    b.addEventListener('click', function (e) { e.preventDefault(); });
    return b;
  }

  /* A hold control: sets a virtual input for as long as it is held. */
  function holdPad(cls, html, name, label) {
    var b = h('div', cls, html);
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', label);
    function on(e) { e.preventDefault(); ZC.Input.virtual(name, true); b.classList.add('is-down'); }
    function off(e) { ZC.Input.virtual(name, false); b.classList.remove('is-down'); }
    b.addEventListener('pointerdown', on, { passive: false });
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
    return b;
  }

  U.init = function (rootEl) {
    root = rootEl;
    R = ZC.Race;
    if (!root) return;
    root.innerHTML = '';

    /* ---- HUD ---- */
    var hud = els.hud = h('div', 'zc-hud');
    els.place = h('div', 'zc-place',
      '<i>Position</i><b>1</b><span>st</span><small>/ 8</small>');
    els.lap = h('div', 'zc-lap',
      '<span class="zc-lbl">Lap</span><small class="zc-lap-track">Gullwing Bay</small><b>1/3</b>');
    els.timing = h('div', 'zc-timing',
      '<div class="zc-time"><span>Time</span><b>0:00.00</b></div>' +
      '<div class="zc-best"><span>Best</span><b>--:--.--</b></div>');
    els.speed = h('div', 'zc-speed',
      '<span class="zc-speed-kicker">Speed</span>' +
      '<div class="zc-speed-readout"><b>0</b><span>KM/H</span></div>' +
      '<i class="zc-speed-fill"></i>');
    els.charge = h('div', 'zc-charge', '<i></i>');
    els.item = holdPad('zc-item is-empty',
      '<span class="zc-item-label">Item</span>' +
      '<span class="zc-item-icon" aria-hidden="true">—</span>' +
      '<span class="zc-item-copy"><b>Empty</b><small>Hit a box</small></span>',
      'item', 'No item held');
    els.itemGlyph = els.item.querySelector('.zc-item-icon');
    els.itemName = els.item.querySelector('.zc-item-copy b');
    els.itemHint = els.item.querySelector('.zc-item-copy small');
    els.placeTotal = els.place.querySelector('small');
    els.lapTrack = els.lap.querySelector('.zc-lap-track');
    els.speedBar = els.speed.querySelector('.zc-speed-fill');
    els.chargeFill = els.charge.querySelector('i');
    hud.appendChild(els.place);
    hud.appendChild(els.lap);
    hud.appendChild(els.timing);
    hud.appendChild(els.speed);
    hud.appendChild(els.charge);
    hud.appendChild(els.item);
    root.appendChild(hud);

    els.countdown = h('div', 'zc-countdown',
      '<div class="zc-countdown-content">' +
        '<span class="zc-countdown-kicker">Get ready</span>' +
        '<b class="zc-countdown-value">3</b>' +
        '<span class="zc-countdown-sub">Hold drift to charge</span>' +
        '<small class="zc-countdown-track">Round 1 · Gullwing Bay</small>' +
      '</div>');
    els.countdown.setAttribute('role', 'status');
    els.countdown.setAttribute('aria-live', 'assertive');
    els.countdownValue = els.countdown.querySelector('.zc-countdown-value');
    els.countdownKicker = els.countdown.querySelector('.zc-countdown-kicker');
    els.countdownSub = els.countdown.querySelector('.zc-countdown-sub');
    els.countdownTrack = els.countdown.querySelector('.zc-countdown-track');
    root.appendChild(els.countdown);

    /* ---- touch controls ----
       Throttle is automatic (SPEC §4): a phone player cannot hold three
       controls at once. What is left is steer, drift and brake. */
    var pads = els.pads = h('div', 'zc-pads');
    pads.appendChild(holdPad('zc-pad zc-left', '<svg viewBox="0 0 24 24"><path d="M15 4 L7 12 L15 20 Z"/></svg>', 'left', 'Steer left'));
    pads.appendChild(holdPad('zc-pad zc-right', '<svg viewBox="0 0 24 24"><path d="M9 4 L17 12 L9 20 Z"/></svg>', 'right', 'Steer right'));
    var acts = h('div', 'zc-acts');
    acts.appendChild(holdPad('zc-pad zc-brake', 'BRAKE', 'brake', 'Brake'));
    acts.appendChild(holdPad('zc-pad zc-drift', 'DRIFT', 'drift', 'Drift'));
    pads.appendChild(acts);
    root.appendChild(pads);

    els.overlay = h('div', 'zc-overlay');
    root.appendChild(els.overlay);
    els.toast = h('div', 'zc-toast');
    root.appendChild(els.toast);

    ZC.on('screen', render);
    ZC.on('race:load', function () { render(R.state.phase); });
    ZC.on('race:go', function () { render(R.PHASE.RACING); });
    ZC.on('race:results', function () { render(R.PHASE.RESULTS); });
    ZC.on('kart:lap', function (e) {
      if (e.kart && e.kart.isPlayer && e.lap < R.state.track.laps) {
        U.toast('Lap ' + (e.lap + 1) + ' · ' + ZC.fmtLap(e.time), 1600);
      }
    });

    last = {};
    render(R.state.phase);
  };

  /* ------------------------------------------------------------------
     Per-frame HUD. Only writes text that actually changed — a racing HUD
     updates several fields at 60fps and naive DOM writes show up on a
     phone as jank.
     ------------------------------------------------------------------ */
  var last = {};
  function setText(el, key, s) {
    if (last[key] === s) return;
    last[key] = s;
    el.textContent = s;
  }

  U.frame = function (st) {
    if (!root || !st.player || !els.hud) return;
    var p = st.player;
    var racing = st.phase === R.PHASE.RACING || st.phase === R.PHASE.FINISHED;
    root.classList.toggle('is-racing', racing || st.phase === R.PHASE.COUNTDOWN);
    root.classList.toggle('is-countdown', st.phase === R.PHASE.COUNTDOWN);
    root.classList.toggle('is-results', st.phase === R.PHASE.RESULTS);
    root.classList.toggle('is-touch', ZC.isTouch);
    root.setAttribute('data-phase', st.phase);

    setText(els.place.querySelector('b'), 'place', String(p.place));
    setText(els.place.querySelector('span'), 'placeSuf', ZC.ordinal(p.place).replace(/^\d+/, ''));
    setText(els.placeTotal, 'placeTotal', '/ ' + st.karts.length);
    setText(els.lapTrack, 'lapTrack', st.track.name);
    setText(els.lap.querySelector('b'), 'lap',
      Math.min(p.lap + 1, st.track.laps) + '/' + st.track.laps);
    setText(els.timing.querySelector('.zc-time b'), 'time', ZC.fmtLap(p.raceTime - p.lapStart));
    setText(els.timing.querySelector('.zc-best b'), 'best', ZC.fmtLap(p.bestLap));
    var speedKmh = ZC.Kart.speedKmh(p);
    setText(els.speed.querySelector('b'), 'spd', String(Math.round(speedKmh)));
    els.speedBar.style.transform = 'scaleX(' + ZC.clamp01(speedKmh / 150).toFixed(3) + ')';

    /* Held item. This is both the at-a-glance slot and the touch use
       control: keeping those as one object makes the answer to "what do I
       have, and where do I press it?" immediate. During the roulette the
       real item glyphs cycle instead of showing a meaningless question
       mark, then the settled item locks in with its authored colour. */
    var rolling = p.itemRoll > 0;
    var def = !rolling && p.item && ZC.Items && ZC.Items.DEFS[p.item];
    var itemKey = 'empty';
    var itemGlyph = '—';
    var itemName = 'Empty';
    var itemHint = 'Hit a box';
    var itemColour = '#a79e93';
    if (rolling && ZC.Items) {
      var order = ZC.Items.ORDER;
      var rollIndex = Math.floor(st.time * 14) % order.length;
      var rollDef = ZC.Items.DEFS[order[rollIndex]];
      itemKey = 'roll-' + rollIndex;
      itemGlyph = rollDef.glyph;
      itemName = 'Roulette';
      itemHint = 'Choosing…';
      itemColour = '#' + ('000000' + rollDef.colour.toString(16)).slice(-6);
    } else if (def) {
      itemKey = def.id;
      itemGlyph = def.glyph;
      itemName = def.name;
      itemHint = ZC.isTouch ? 'Tap to use' : 'E / Ctrl to use';
      itemColour = '#' + ('000000' + def.colour.toString(16)).slice(-6);
    }
    if (last.itemKey !== itemKey) {
      last.itemKey = itemKey;
      els.itemGlyph.textContent = itemGlyph;
      els.itemName.textContent = itemName;
      els.itemHint.textContent = itemHint;
      els.item.style.setProperty('--item-colour', itemColour);
      els.item.setAttribute('aria-label', def ? 'Use ' + def.name :
        (rolling ? 'Item roulette spinning' : 'No item held'));
    }
    els.item.classList.toggle('has-item', !!def);
    els.item.classList.toggle('is-rolling', rolling);
    els.item.classList.toggle('is-empty', !def && !rolling);

    /* drift charge meter — the payout building, without looking away */
    var tier = p.drift.tier;
    var frac = 0;
    if (p.drift.active) {
      var tiers = ZC.Kart.TUNE.driftTiers;
      frac = ZC.clamp01(p.drift.charge / tiers[tiers.length - 1]);
    }
    els.charge.style.opacity = p.drift.active ? '1' : '0';
    els.chargeFill.style.transform = 'scaleX(' + frac.toFixed(3) + ')';
    els.charge.setAttribute('data-tier', String(tier));

    if (st.phase === R.PHASE.COUNTDOWN) {
      var n = Math.ceil(st.countdown - 0.2);
      var cdText = n > 0 ? String(n) : 'GO';
      var cdClass = n <= 0 ? 'is-go' : 'is-' + ZC.clamp(n, 1, 3);
      setText(els.countdownValue, 'cd', cdText);
      setText(els.countdownKicker, 'cdKicker', n > 0 ? 'Get ready' : 'Launch');
      setText(els.countdownSub, 'cdSub', n > 0 ? 'Hold drift to charge' : 'Full throttle');
      setText(els.countdownTrack, 'cdTrack',
        'Round ' + (st.round + 1) + ' · ' + st.track.name);
      if (last.cdClass !== cdClass) {
        last.cdClass = cdClass;
        els.countdown.className = 'zc-countdown is-on ' + cdClass;
      }
    } else if (els.countdown.className !== 'zc-countdown' && !countdownTimer) {
      countdownTimer = global.setTimeout(function () {
        els.countdown.className = 'zc-countdown';
        countdownTimer = 0;
      }, 420);
    }

    if (ZC.Audio && ZC.Audio.update) ZC.Audio.update(p, 0.016);
  };

  /* ------------------------------------------------------------------
     Screens
     ------------------------------------------------------------------ */
  function render(phase) {
    if (!els.overlay) return;
    var open = (phase === R.PHASE.ATTRACT || phase === R.PHASE.GRID ||
                phase === R.PHASE.RESULTS);
    els.overlay.innerHTML = '';
    els.overlay.classList.toggle('is-open', open);
    if (!open) return;
    if (phase === R.PHASE.ATTRACT) return screenMenu();
    if (phase === R.PHASE.GRID) return screenGrid();
    if (phase === R.PHASE.RESULTS) return screenResults();
  }

  function panel(cls) {
    var p = h('div', 'zc-panel ' + (cls || ''));
    els.overlay.appendChild(p);
    return p;
  }

  function startRace() {
    if (ZC.Audio && ZC.Audio.resume) ZC.Audio.resume();
    R.load(0, {});
    R.beginCountdown();
    render(R.PHASE.COUNTDOWN);
  }

  function screenMenu() {
    var p = panel('zc-menu');
    p.appendChild(h('h1', 'zc-logo', 'ZEPHYR<span>CIRCUIT</span>'));
    p.appendChild(h('p', 'zc-tag',
      'Eight karts. Three laps. One island, and a long way down.'));
    p.appendChild(button('zc-btn zc-primary', 'Race', startRace));

    var best = R.best();
    if (best > 0) p.appendChild(h('p', 'zc-best-line', 'Best cup: <b>' + ZC.fmtNum(best) + '</b>'));

    p.appendChild(h('div', 'zc-keys',
      '<b>W / ↑</b> throttle &nbsp;·&nbsp; <b>A D / ← →</b> steer &nbsp;·&nbsp; ' +
      '<b>Shift</b> drift &nbsp;·&nbsp; <b>S / ↓</b> brake<br>' +
      'Hold <b>drift</b> through a corner to bank a boost. Three tiers.'));
    var a = h('a', 'zc-link', '← Back to Arcade');
    a.href = '../index.html';
    p.appendChild(a);
  }

  function screenGrid() {
    var p = panel('zc-grid');
    p.appendChild(h('div', 'zc-grid-flag', 'Next circuit'));
    p.appendChild(h('div', 'zc-kicker',
      'Round ' + (R.state.round + 1) + ' / ' + R.CUP.length));
    p.appendChild(h('h2', null, R.state.track.name));
    p.appendChild(h('p', 'zc-tag', 'Three laps. One clean line.'));
    p.appendChild(h('div', 'zc-grid-meta',
      '<span><b>' + R.state.track.laps + '</b><small>LAPS</small></span>' +
      '<span><b>8</b><small>RACERS</small></span>' +
      '<span><b>' + Math.round(R.state.track.parTime) + 's</b><small>PAR</small></span>'));
    p.appendChild(button('zc-btn zc-primary', 'To the grid', function () {
      R.beginCountdown();
      render(R.PHASE.COUNTDOWN);
    }));
  }

  function screenResults() {
    var st = R.state;
    var res = st.results;
    var resultClass = res.place === 1 ? 'is-win' : (res.place <= 3 ? 'is-podium' : 'is-finish');
    var p = panel('zc-results ' + resultClass);
    p.appendChild(h('div', 'zc-result-overline',
      'Round ' + (st.round + 1) + ' · Chequered flag'));
    var hero = h('div', 'zc-result-hero');
    hero.appendChild(h('span', 'zc-finish-label', 'Finish'));
    hero.appendChild(h('h2', 'zc-finish', ZC.ordinal(res.place)));
    hero.appendChild(h('div', 'zc-result-meta',
      '<span><small>TIME</small><b>' + ZC.fmtLap(res.finishTime) + '</b></span>' +
      '<span><small>BEST LAP</small><b>' + ZC.fmtLap(res.bestLap) + '</b></span>'));
    p.appendChild(hero);
    p.appendChild(h('div', 'zc-section-head', '<span>Field standings</span><small>8 RACERS</small>'));

    var table = h('div', 'zc-table');
    var order = R.order();
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      var row = h('div', 'zc-row' + (k.isPlayer ? ' is-you' : ''));
      row.innerHTML =
        '<span class="zc-pos">' + k.place + '</span>' +
        '<span class="zc-name">' + k.name + '</span>' +
        '<span class="zc-t">' + (k.finished ? ZC.fmtLap(k.finishTime) : 'DNF') + '</span>';
      table.appendChild(row);
    }
    p.appendChild(table);

    p.appendChild(h('div', 'zc-score-head',
      '<span>Round score</span><b>+' + ZC.fmtNum(res.total) + '</b>'));
    var br = h('div', 'zc-break');
    br.innerHTML =
      '<div class="zc-brow"><span>Finish</span><b>' + res.points * 40 + '</b></div>' +
      '<div class="zc-brow"><span>Time</span><b>' + res.timeBonus + '</b></div>' +
      '<div class="zc-brow"><span>Clean</span><b>' + res.cleanBonus + '</b></div>' +
      '<div class="zc-brow"><span>Fastest lap</span><b>' + res.bestLapBonus + '</b></div>' +
      '<div class="zc-brow zc-total"><span>Total</span><b>' + ZC.fmtNum(res.total) + '</b></div>';
    p.appendChild(br);

    p.appendChild(button('zc-btn zc-primary', 'Race again', startRace));
    R.recordBest(st.cupScore);
    R.submitScore(st.cupScore);
  }

  U.toast = function (msg, ms) {
    if (!els.toast) return;
    els.toast.innerHTML = msg;
    els.toast.classList.add('is-on');
    global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () {
      els.toast.classList.remove('is-on');
    }, ms || 2000);
  };

  U.prompt = function (opts) {
    return new Promise(function (resolve) {
      if (!root) { resolve(null); return; }
      var wrap = h('div', 'zc-modal');
      var p = h('div', 'zc-panel');
      p.appendChild(h('h2', null, opts.title || ''));
      if (opts.body) p.appendChild(h('p', 'zc-tag', opts.body));
      var input = h('input', 'zc-input');
      input.type = 'text';
      input.maxLength = opts.maxLength || 20;
      input.placeholder = opts.placeholder || '';
      p.appendChild(input);
      function done(v) { wrap.remove(); resolve(v); }
      p.appendChild(button('zc-btn zc-primary', 'Sign', function () { done(input.value); }));
      p.appendChild(button('zc-btn zc-ghost', 'Skip', function () { done(null); }));
      wrap.appendChild(p);
      root.appendChild(wrap);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') done(input.value);
        if (e.key === 'Escape') done(null);
        e.stopPropagation();
      });
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 50);
    });
  };

  if (ZC.Audio && ZC.Audio.init) ZC.Audio.init();

})(window);
