/* =====================================================================
   CINDERGLASS — ui.js
   HUD, screens, modals and the touch controls.
   Owner: agent-ui (this first pass written by the lead).

   All DOM, no canvas: text stays crisp at any device pixel ratio and the
   controls get real hit targets for free. The renderer leaves a strip at
   the top and bottom of the canvas (game.js passes the padding into
   Render.layout) and everything here lives in those strips.
   ===================================================================== */
(function (global) {
  'use strict';

  var CG = global.CG || (global.CG = {});
  var G = null;                        // CG.Game, resolved at init
  var U = CG.UI = {};

  var root = null;
  var els = {};
  var toastTimer = 0;

  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function on(el, evt, fn) { el.addEventListener(evt, fn); return el; }

  /* A button that works for mouse, touch and keyboard alike. Using
     pointerdown rather than click keeps the tool switch instant on touch
     — a 300ms click delay on a control you press mid-pour is unusable. */
  function button(cls, html, fn, label) {
    var b = h('button', cls, html);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    on(b, 'pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); fn(e); });
    on(b, 'click', function (e) { e.preventDefault(); });
    on(b, 'keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); }
    });
    return b;
  }

  /* ------------------------------------------------------------------
     Build
     ------------------------------------------------------------------ */
  U.init = function (rootEl) {
    root = rootEl;
    G = CG.Game;
    if (!root) return;
    root.innerHTML = '';

    /* ---- top bar ---- */
    var top = els.top = h('div', 'cg-top');
    els.contract = h('div', 'cg-contract',
      '<span class="cg-ctitle">—</span><span class="cg-cidx"></span>');
    els.score = h('div', 'cg-score', '<span class="cg-slabel">Shift</span><span class="cg-sval">0</span>');
    top.appendChild(els.contract);
    top.appendChild(els.score);

    var gauges = els.gauges = h('div', 'cg-gauges');
    els.quota = gauge('quota', 'Quota');
    els.fuel = gauge('fuel', 'Fuel');
    els.shift = gauge('shift', 'Shift');
    gauges.appendChild(els.quota.el);
    gauges.appendChild(els.fuel.el);
    gauges.appendChild(els.shift.el);
    top.appendChild(gauges);
    root.appendChild(top);

    /* ---- bottom control dock ---- */
    var dock = els.dock = h('div', 'cg-dock');

    var tools = h('div', 'cg-tools');
    els.torch = button('cg-tool cg-torch is-on', toolFace('Torch', 'Heat'),
      function () { CG.Input.setTool(CG.TOOL_TORCH); }, 'Torch — pour heat in');
    els.quench = button('cg-tool cg-quench', toolFace('Quench', 'Chill'),
      function () { CG.Input.setTool(CG.TOOL_QUENCH); }, 'Quench — pull heat out');
    tools.appendChild(els.torch);
    tools.appendChild(els.quench);

    var sizes = h('div', 'cg-sizes');
    els.size = [];
    for (var i = 0; i < CG.BRUSH_RADII.length; i++) {
      (function (n) {
        var b = button('cg-size' + (n === 1 ? ' is-on' : ''),
          '<span class="cg-dot cg-dot' + n + '"></span>',
          function () { CG.Input.setSize(n); },
          'Brush size ' + (n + 1));
        els.size.push(b);
        sizes.appendChild(b);
      })(i);
    }

    var utils = h('div', 'cg-utils');
    els.pause = button('cg-util', '❚❚', function () { G.togglePause(); }, 'Pause');
    els.redo = button('cg-util', '⟲', function () { G.restartContract(); }, 'Restart contract');
    els.hint = button('cg-util', '?', function () { showHint(); }, 'Hint');
    utils.appendChild(els.hint);
    utils.appendChild(els.redo);
    utils.appendChild(els.pause);

    dock.appendChild(tools);
    dock.appendChild(sizes);
    dock.appendChild(utils);
    root.appendChild(dock);

    /* ---- overlay host ---- */
    els.overlay = h('div', 'cg-overlay');
    root.appendChild(els.overlay);

    els.toast = h('div', 'cg-toast');
    root.appendChild(els.toast);

    CG.on('input:tool', syncTool);
    CG.on('input:size', syncSize);
    CG.on('screen', onScreen);
    CG.on('fuel:empty', function () { U.toast('Fuel line is dry.', 1200); });

    syncTool();
    syncSize();
    onScreen(G.state.screen);
  };

  function toolFace(name, sub) {
    return '<span class="cg-tname">' + name + '</span><span class="cg-tsub">' + sub + '</span>';
  }

  function gauge(kind, label) {
    var el = h('div', 'cg-gauge cg-g-' + kind);
    var lab = h('span', 'cg-glabel', label);
    var bar = h('div', 'cg-gbar');
    var fill = h('i', 'cg-gfill');
    var val = h('span', 'cg-gval', '');
    bar.appendChild(fill);
    el.appendChild(lab); el.appendChild(bar); el.appendChild(val);
    return { el: el, fill: fill, val: val };
  }

  function syncTool() {
    if (!els.torch) return;
    var t = CG.Input.brush.tool;
    els.torch.classList.toggle('is-on', t === CG.TOOL_TORCH);
    els.quench.classList.toggle('is-on', t === CG.TOOL_QUENCH);
  }
  function syncSize() {
    if (!els.size) return;
    for (var i = 0; i < els.size.length; i++) {
      els.size[i].classList.toggle('is-on', i === CG.Input.brush.size);
    }
  }

  /* ------------------------------------------------------------------
     Per-frame HUD. Only the numbers that changed are written: touching
     DOM text every frame for three gauges is enough to show up on a
     phone, and none of these change more than a few times a second.
     ------------------------------------------------------------------ */
  var lastText = {};
  function setText(el, s) {
    if (lastText[el._k] === s) return;
    lastText[el._k] = s;
    el.textContent = s;
  }
  var keyN = 0;
  function key(el) { if (!el._k) el._k = 'k' + (keyN++); return el; }

  U.frame = function (st) {
    if (!root || !st.spec) return;

    var p = G.progress();
    var fuel = G.fuelFrac();
    var shift = G.shiftFrac();

    els.quota.fill.style.transform = 'scaleX(' + p.frac.toFixed(3) + ')';
    setText(key(els.quota.val), p.have + '/' + p.need);

    els.fuel.fill.style.transform = 'scaleX(' + fuel.toFixed(3) + ')';
    setText(key(els.fuel.val), Math.round(fuel * 100) + '%');
    els.fuel.el.classList.toggle('is-low', fuel < 0.2);

    els.shift.fill.style.transform = 'scaleX(' + (1 - shift).toFixed(3) + ')';
    setText(key(els.shift.val), CG.fmtTime((st.spec.hardTicks - st.ticks) / CG.TICK_HZ));
    els.shift.el.classList.toggle('is-low', shift > 0.8);

    setText(key(els.score.querySelector('.cg-sval')), CG.fmtNum(st.runScore));
    setText(key(els.contract.querySelector('.cg-ctitle')), st.spec.name);
    setText(key(els.contract.querySelector('.cg-cidx')),
      'Contract ' + (st.contractIndex + 1) + ' / ' + CG.Levels.count());
  };

  /* ------------------------------------------------------------------
     Screens
     ------------------------------------------------------------------ */
  function onScreen(s) {
    if (!els.overlay) return;
    var S = G.SCREEN;
    var playing = (s === S.PLAYING);
    root.classList.toggle('is-playing', playing);
    els.overlay.innerHTML = '';
    els.overlay.classList.toggle('is-open', !playing);
    if (playing) return;

    if (s === S.MENU) return screenMenu();
    if (s === S.BRIEFING) return screenBriefing();
    if (s === S.PAUSED) return screenPaused();
    if (s === S.CLEARED) return screenCleared();
    if (s === S.FAILED) return screenFailed();
    if (s === S.RUN_OVER) return screenRunOver();
  }

  function panel(cls) {
    var p = h('div', 'cg-panel ' + (cls || ''));
    els.overlay.appendChild(p);
    return p;
  }

  function screenMenu() {
    var p = panel('cg-menu');
    p.appendChild(h('h1', 'cg-logo', 'CINDERGLASS'));
    p.appendChild(h('p', 'cg-tag',
      'You are the heat. Nothing here moves because you moved it — ' +
      'melt, freeze, boil and fuse, and let the world do the rest.'));

    var acts = h('div', 'cg-acts');
    if (G.hasSave()) {
      acts.appendChild(button('cg-btn cg-primary', 'Resume Shift', function () { G.resumeRun(); }));
      acts.appendChild(button('cg-btn', 'New Shift', function () { G.startRun(0); }));
    } else {
      acts.appendChild(button('cg-btn cg-primary', 'Clock In', function () { G.startRun(0); }));
    }
    p.appendChild(acts);

    var best = G.best();
    if (best > 0) p.appendChild(h('p', 'cg-best', 'Best shift: <b>' + CG.fmtNum(best) + '</b>'));

    p.appendChild(h('div', 'cg-keys',
      '<b>Drag</b> to paint &nbsp;·&nbsp; <b>Right-drag</b> for the other tool<br>' +
      '<b>WASD / arrows</b> aim &nbsp;·&nbsp; <b>Space</b> paint &nbsp;·&nbsp; ' +
      '<b>Q / E</b> tool &nbsp;·&nbsp; <b>1–3</b> brush &nbsp;·&nbsp; <b>P</b> pause &nbsp;·&nbsp; <b>R</b> restart'));
    p.appendChild(backLink());
  }

  function screenBriefing() {
    var spec = G.state.spec;
    var p = panel('cg-brief');
    p.appendChild(h('div', 'cg-kicker', 'Contract ' + (G.state.contractIndex + 1) +
      ' of ' + CG.Levels.count()));
    p.appendChild(h('h2', null, spec.name));
    p.appendChild(h('p', 'cg-blurb', spec.blurb));

    var goal = h('div', 'cg-goal');
    var m = CG.Materials.get(spec.goal.material);
    goal.innerHTML =
      '<span class="cg-gverb">' + (spec.goal.kind === 'deliver' ? 'Deliver' : 'Cast') + '</span>' +
      '<span class="cg-gamt">' + spec.goal.amount + '</span>' +
      '<span class="cg-gmat">' + m.label + '</span>';
    p.appendChild(goal);

    var meta = h('div', 'cg-meta');
    meta.innerHTML =
      '<span>Shift <b>' + CG.fmtTime(spec.hardTicks / CG.TICK_HZ) + '</b></span>' +
      '<span>Par <b>' + CG.fmtTime(spec.parTicks / CG.TICK_HZ) + '</b></span>' +
      '<span>Fuel <b>' + CG.fmtNum(spec.fuel) + '</b></span>';
    p.appendChild(meta);

    p.appendChild(button('cg-btn cg-primary', 'Begin', function () { G.beginContract(); }));
    p.appendChild(button('cg-btn cg-ghost', 'Hint', function () { showHint(); }));
  }

  function screenPaused() {
    var p = panel('cg-paused');
    p.appendChild(h('h2', null, 'Paused'));
    p.appendChild(button('cg-btn cg-primary', 'Resume', function () { G.togglePause(); }));
    p.appendChild(button('cg-btn', 'Restart Contract', function () { G.restartContract(); }));
    p.appendChild(button('cg-btn cg-ghost', 'End Shift', function () { G.retireRun(); }));
    p.appendChild(backLink());
  }

  function breakdownRows(b) {
    var d = h('div', 'cg-break');
    function row(label, val, sub) {
      var r = h('div', 'cg-brow');
      r.innerHTML = '<span>' + label + (sub ? ' <i>' + sub + '</i>' : '') +
        '</span><b>' + CG.fmtNum(val) + '</b>';
      d.appendChild(r);
    }
    row('Contract', b.base);
    row(b.purityLabel, b.purity, Math.round(b.purityFrac * 100) + '%');
    row('Speed', b.speed, Math.round(b.speedFrac * 100) + '%');
    row('Thrift', b.thrift, Math.round(b.thriftFrac * 100) + '%');
    if (b.comboMult > 1) {
      var r = h('div', 'cg-brow cg-combo');
      r.innerHTML = '<span>Streak</span><b>×' + b.comboMult.toFixed(1) + '</b>';
      d.appendChild(r);
    }
    var tot = h('div', 'cg-brow cg-total');
    tot.innerHTML = '<span>Contract total</span><b>' + CG.fmtNum(b.total) + '</b>';
    d.appendChild(tot);
    return d;
  }

  function screenCleared() {
    var b = G.state.lastBreakdown;
    var p = panel('cg-cleared');
    p.appendChild(h('div', 'cg-kicker cg-good', 'Contract filled'));
    p.appendChild(h('h2', null, G.state.spec.name));
    p.appendChild(breakdownRows(b));
    p.appendChild(h('p', 'cg-runtotal', 'Shift total <b>' + CG.fmtNum(G.state.runScore) + '</b>'));
    var last = G.state.contractIndex >= CG.Levels.count() - 1;
    p.appendChild(button('cg-btn cg-primary', last ? 'Close the Shift' : 'Next Contract',
      function () { G.nextContract(); }));
  }

  function screenFailed() {
    var spec = G.state.spec;
    var p = G.progress();
    var el = panel('cg-failed');
    el.appendChild(h('div', 'cg-kicker cg-bad', 'Shift bell'));
    el.appendChild(h('h2', null, 'Quota short'));
    el.appendChild(h('p', 'cg-blurb',
      'The bell went with <b>' + p.have + '</b> of <b>' + p.need + '</b> ' +
      CG.Materials.get(spec.goal.material).label.toLowerCase() + ' to your name.'));
    el.appendChild(h('p', 'cg-hint-body', spec.hint));
    el.appendChild(button('cg-btn cg-primary', 'Run It Again', function () { G.restartContract(); }));
    el.appendChild(button('cg-btn cg-ghost', 'End Shift', function () { G.retireRun(); }));
  }

  function screenRunOver() {
    var st = G.state;
    var s = G.stats();
    var p = panel('cg-over');
    p.appendChild(h('div', 'cg-kicker', 'Shift closed'));
    p.appendChild(h('h2', 'cg-final', CG.fmtNum(st.runScore)));
    if (st.endReason) p.appendChild(h('p', 'cg-blurb', st.endReason));
    var d = h('div', 'cg-break');
    d.innerHTML =
      '<div class="cg-brow"><span>Contracts filled</span><b>' + s.contracts + '</b></div>' +
      '<div class="cg-brow"><span>Best contract</span><b>' + CG.fmtNum(s.bestContract) + '</b></div>' +
      '<div class="cg-brow"><span>Fuel burnt</span><b>' + CG.fmtNum(s.fuelBurnt) + '</b></div>';
    p.appendChild(d);
    p.appendChild(button('cg-btn cg-primary', 'New Shift', function () { G.startRun(0); }));
    p.appendChild(leaderLink());
    p.appendChild(backLink());
  }

  function backLink() {
    var a = h('a', 'cg-link', '← Back to Arcade');
    a.href = '../index.html';
    return a;
  }
  function leaderLink() {
    var a = h('a', 'cg-link', 'View Leaderboard');
    a.href = '../leaderboard.html?gameId=cinderglass';
    return a;
  }

  function showHint() {
    var spec = G.state.spec;
    if (!spec) return;
    U.toast(spec.hint, 6000);
  }

  /* ------------------------------------------------------------------
     Toast + prompt
     ------------------------------------------------------------------ */
  U.toast = function (msg, ms) {
    if (!els.toast) return;
    els.toast.innerHTML = msg;
    els.toast.classList.add('is-on');
    global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () {
      els.toast.classList.remove('is-on');
    }, ms || 2200);
  };

  U.prompt = function (opts) {
    return new Promise(function (resolve) {
      if (!els.overlay) { resolve(null); return; }
      var wrap = h('div', 'cg-modal');
      var p = h('div', 'cg-panel cg-promptp');
      p.appendChild(h('h2', null, opts.title || ''));
      if (opts.body) p.appendChild(h('p', 'cg-blurb', opts.body));
      var input = h('input', 'cg-input');
      input.type = 'text';
      input.maxLength = opts.maxLength || 20;
      input.placeholder = opts.placeholder || '';
      p.appendChild(input);
      var row = h('div', 'cg-acts');
      function done(v) { wrap.remove(); resolve(v); }
      row.appendChild(button('cg-btn cg-primary', 'Sign', function () { done(input.value); }));
      row.appendChild(button('cg-btn cg-ghost', 'Skip', function () { done(null); }));
      p.appendChild(row);
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

})(window);
