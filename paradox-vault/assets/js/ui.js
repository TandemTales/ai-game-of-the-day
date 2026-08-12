/* =====================================================================
   PARADOX VAULT — ui.js
   Owner: agent-ui.  Builds the ENTIRE UI DOM inside #pv-ui at init().
   Nothing is expected to exist in the page except <canvas id="pv-canvas">.
   See SPEC.md §7.
   ===================================================================== */
(function (global) {
  'use strict';

  var PV = global.PV || (global.PV = {});
  var D = global.document;
  var NSSVG = 'http://www.w3.org/2000/svg';
  var raf = global.requestAnimationFrame ?
    global.requestAnimationFrame.bind(global) : function (f) { return setTimeout(f, 16); };
  var caf = global.cancelAnimationFrame ?
    global.cancelAnimationFrame.bind(global) : clearTimeout;

  /* ================================================================
     Tiny DOM helpers
     ================================================================ */
  function h(tag, cls, txt) {
    var e = D.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.textContent = txt;
    return e;
  }
  function sv(tag, attrs) {
    var e = D.createElementNS(NSSVG, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]);
    return parent;
  }
  function fmtNum(n) {
    if (PV.fmtNum) return PV.fmtNum(n);
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  function sfx(name) { try { PV.emit && PV.emit('ui:sfx', { name: name }); } catch (e) {} }
  function nav(action, data) {
    sfx(action === 'back' || action === 'quit' ? 'uiBack' : 'uiClick');
    try {
      PV.emit && PV.emit('ui:nav', { action: action, data: data || null });
      PV.emit && PV.emit('ui:' + action, data || {});
    } catch (e) {}
  }

  /* stepped brass frame: <div.pv-fr><div.pv-in/></div> */
  function frame(cls) {
    var root = h('div', 'pv-fr' + (cls ? ' ' + cls : ''));
    var body = h('div', 'pv-in');
    root.appendChild(body);
    return { el: root, body: body };
  }

  function hoverable(el) {
    el.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse') sfx('uiHover');
    });
    return el;
  }

  function button(label, cls, onClick) {
    var b = h('button', 'pv-btn' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    var s = h('span', null, label);
    b.appendChild(s);
    b._label = s;
    if (onClick) b.addEventListener('click', function (ev) { onClick(ev); });
    return hoverable(b);
  }
  function setLabel(b, t) { if (b && b._label && b._label.textContent !== t) b._label.textContent = t; }

  function iconBtn(title, pathD, onClick) {
    var b = h('button', 'pv-iconbtn');
    b.type = 'button';
    b.setAttribute('aria-label', title);
    b.title = title;
    var s = sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(sv('path', { d: pathD }));
    b.appendChild(s);
    if (onClick) b.addEventListener('click', onClick);
    return hoverable(b);
  }

  function divider() {
    var d = h('div', 'pv-div');
    return add(d, h('i', 'pv-rule'), h('i', 'pv-div__dia'), h('i', 'pv-rule'));
  }

  function linkRow() {
    var w = h('nav', 'pv-links');
    w.setAttribute('aria-label', 'Arcade navigation');
    var a = h('a', 'pv-link', '← Back to Arcade');
    a.href = '../index.html';
    var b = h('a', 'pv-link', '🏆 Leaderboard');
    b.href = '../leaderboard.html?gameId=paradox-vault';
    a.addEventListener('click', function () { sfx('uiBack'); });
    b.addEventListener('click', function () { sfx('uiClick'); });
    return add(w, hoverable(a), hoverable(b));
  }

  function statCell(key, val, sub) {
    var c = h('div', 'pv-stat');
    var k = h('div', 'pv-stat__k', key);
    var v = h('div', 'pv-stat__v');
    v.textContent = val;
    if (sub) { var s = h('small', null, ' ' + sub); v.appendChild(s); }
    add(c, k, v);
    c._v = v;
    return c;
  }

  /* ================================================================
     Settings model
     ================================================================ */
  var K = {
    muted: 'ui.muted', music: 'ui.musicVol', sfx: 'ui.sfxVol',
    quality: 'ui.quality', reduce: 'ui.reduceMotion'
  };
  var prefersReduce = false;
  try {
    prefersReduce = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) {}

  var S = {
    muted: false, music: 0.7, sfx: 0.85,
    quality: (PV.quality && typeof PV.quality.tier === 'number') ? PV.quality.tier : 2,
    reduce: prefersReduce
  };

  function loadSettings() {
    if (!PV.store) return;
    S.muted = !!PV.store.get(K.muted, S.muted);
    S.music = clamp01(Number(PV.store.get(K.music, S.music)));
    S.sfx = clamp01(Number(PV.store.get(K.sfx, S.sfx)));
    var q = PV.store.get(K.quality, S.quality);
    S.quality = (q === 0 || q === 1 || q === 2) ? q : S.quality;
    S.reduce = !!PV.store.get(K.reduce, S.reduce);
  }
  function saveSettings() {
    if (!PV.store) return;
    PV.store.set(K.muted, S.muted);
    PV.store.set(K.music, S.music);
    PV.store.set(K.sfx, S.sfx);
    PV.store.set(K.quality, S.quality);
    PV.store.set(K.reduce, S.reduce);
  }
  function applySettings(emitQuality) {
    var A = PV.Audio;
    if (A) {
      try { if ('muted' in A) A.muted = S.muted; } catch (e) {}
      try { if (A.setMusicVolume) A.setMusicVolume(S.music); } catch (e) {}
      try { if (A.setSfxVolume) A.setSfxVolume(S.sfx); } catch (e) {}
    }
    if (PV.quality) PV.quality.tier = S.quality;
    if (root) root.setAttribute('data-motion', S.reduce ? 'reduce' : 'full');
    if (emitQuality) { try { PV.emit && PV.emit('ui:quality', { tier: S.quality }); } catch (e) {} }
  }
  function motionOff() { return S.reduce; }

  /* ================================================================
     Module state
     ================================================================ */
  var UI = PV.UI = PV.UI || {};
  var inited = false;
  var root = null;
  var screens = {};
  var cur = '';
  var prevScreen = 'title';
  var el = {};            /* long-lived element refs */
  var touchVisible = false;

  /* ================================================================
     BUILD — screens
     ================================================================ */

  function makeScreen(name, extraCls) {
    var s = h('section', 'pv-screen pv-screen--' + name + (extraCls ? ' ' + extraCls : ''));
    s.setAttribute('data-screen', name);
    s.setAttribute('aria-hidden', 'true');
    screens[name] = s;
    return s;
  }

  /* ---------------- BOOT ---------------- */
  function buildBoot() {
    var s = makeScreen('boot');
    var body = h('div', 'pv-screen__body');
    var wrap = h('div', 'pv-boot');

    add(wrap,
      h('p', 'pv-eyebrow', 'Bot Built Arcade'),
      h('div', 'pv-dial'));

    var bar = h('div', 'pv-bar');
    var t = h('div', 'pv-bar__t');
    var f = h('div', 'pv-bar__f');
    add(t, f); add(bar, t);
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Loading');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', '0');

    var lbl = h('div', 'pv-boot__label', 'Cracking the tumblers');
    add(wrap, bar, lbl);
    add(body, wrap);
    add(s, body);

    el.bootFill = f; el.bootBar = bar; el.bootLabel = lbl;
    return s;
  }

  /* ---------------- TITLE ---------------- */
  function buildTitle() {
    var s = makeScreen('title');
    var body = h('div', 'pv-screen__body pv-stagger');

    var logo = h('div', 'pv-logo');
    var main = h('h1', 'pv-logo__main', 'Paradox');
    var subRow = h('div', 'pv-logo__sub');
    add(subRow, h('i', 'pv-rule'), h('span', 'pv-logo__vault', 'Vault'), h('i', 'pv-rule'));
    add(logo, h('div', 'pv-logo__arc'), main, subRow);

    var tag = h('p', 'pv-tagline', 'Rob the vault. Then help yourself do it.');

    var menu = h('div', 'pv-menu');
    var bNew = button('New Heist', 'pv-btn--primary', function () {
      nav('newHeist');
    });
    var bCont = button('Continue', null, function () { nav('continue'); });
    bCont.style.display = 'none';
    var bHelp = button('How to Play', null, function () { UI.showScreen('help'); sfx('uiClick'); });
    var bSet = button('Settings', 'pv-btn--ghost', function () { openSettings(); });
    add(menu, bNew, bCont, bHelp, bSet);

    var best = h('div', 'pv-best');
    var bl = h('span', null, 'Best Haul');
    var bv = h('b', 'pv-num', '0');
    add(best, bl, bv);

    add(body, logo, tag, menu, best, linkRow());

    /* wide-screen backdrop: deco rays, concentric brass arcs and a horizon
       rule so a 4K window is not an empty black field behind the card. */
    var deco = h('div', 'pv-deco');
    add(deco,
      h('i', 'pv-deco__rays'),
      h('i', 'pv-deco__rings'),
      h('i', 'pv-deco__horizon'),
      h('i', 'pv-deco__fanL'),
      h('i', 'pv-deco__fanR'));

    add(s, deco, body, h('div', 'pv-ver', 'v' + (PV.VERSION || '1.0.0')));

    el.titleFirst = bNew;
    el.btnContinue = bCont;
    el.bestVal = bv;
    return s;
  }

  /* ---------------- BRIEF ---------------- */
  function buildBrief() {
    var s = makeScreen('brief');
    var body = h('div', 'pv-screen__body pv-stagger');

    var f = frame('pv-card pv-brief pv-fr--glass');
    var hdr = h('div', 'pv-brief__hdr');
    var left = h('div', 'pv-brief__id');
    var title = h('h2', 'pv-h pv-h--gold pv-brief__title', 'The Grand Foyer');
    var wing = h('p', 'pv-brief__wing', 'Ground Floor');
    add(left, h('p', 'pv-eyebrow', 'Mission Dossier'), title, wing);
    var floor = h('div', 'pv-brief__floor');
    var floorK = h('span', 'pv-brief__floor-k', 'Floor');
    var floorV = h('b', 'pv-num', '01');
    add(floor, floorK, floorV);
    add(hdr, left, floor);

    var obj = h('p', 'pv-brief__obj', 'Lift every relic and reach the service exit before the loop resets.');

    var grid = h('div', 'pv-brief__grid');
    var cRelic = statCell('Relics', '0');
    var cEcho = statCell('Echoes', '0');
    var cLoop = statCell('Loop', '22', 's');
    var cMult = statCell('Payout', '×1');
    add(grid, cRelic, cEcho, cLoop, cMult);

    var hint = h('div', 'pv-brief__hint');
    var hintT = h('span', 'pv-brief__hint-t', '');
    add(hint, h('span', 'pv-brief__hint-k', 'Field note'), hintT);

    var begin = button('Begin', 'pv-btn--primary', function () { nav('begin'); });
    var back = button('Abort', 'pv-btn--ghost pv-btn--sm', function () { nav('quit'); UI.showScreen('title'); });
    var row = h('div', 'pv-sheet__menu');
    add(row, begin, back);

    var stamp = h('div', 'pv-stamp', 'Classified');

    add(f.body, hdr, divider(), obj, grid, hint, divider(), row, stamp);
    add(body, f.el, linkRow());
    add(s, body);

    el.briefTitle = title;
    el.briefWing = wing;
    el.briefFloor = floorV;
    el.briefObj = obj;
    el.briefHint = hint;
    el.briefHintT = hintT;
    el.briefRelic = cRelic._v;
    el.briefEcho = cEcho._v;
    el.briefLoop = cLoop._v;
    el.briefMult = cMult._v;
    el.briefBegin = begin;
    return s;
  }

  /* ---------------- HUD ----------------
     One instrument panel: a stepped brass plate with four engraved cells
     (LOOP · ECHOES · MISSION · SCORE) and the pause key docked at its edge.
     Nothing else floats in the corners.                                  */
  var RING_R = 45;
  var RING_C = 2 * Math.PI * RING_R;

  function buildLoopDial() {
    var loop = h('div', 'pv-loop');
    loop.style.setProperty('--circ', RING_C.toFixed(3));
    loop.style.setProperty('--pct', '1');
    loop.setAttribute('role', 'timer');
    loop.setAttribute('aria-label', 'Loop time remaining');

    var svg = sv('svg', { viewBox: '0 0 110 110', 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(sv('circle', { cx: 55, cy: 55, r: 52.5, 'class': 'pv-loop__bg' }));
    /* engraved dial ticks — 44 minor, every 4th major (11 = one per 2 s) */
    for (var i = 0; i < 44; i++) {
      var a = (i / 44) * Math.PI * 2;
      var maj = (i % 4 === 0);
      var r1 = 52, r2 = maj ? 45.2 : 48.6;
      svg.appendChild(sv('line', {
        x1: (55 + Math.cos(a) * r1).toFixed(2), y1: (55 + Math.sin(a) * r1).toFixed(2),
        x2: (55 + Math.cos(a) * r2).toFixed(2), y2: (55 + Math.sin(a) * r2).toFixed(2),
        'class': maj ? 'pv-loop__tick is-maj' : 'pv-loop__tick'
      }));
    }
    svg.appendChild(sv('circle', { cx: 55, cy: 55, r: RING_R, 'class': 'pv-loop__trk' }));
    svg.appendChild(sv('circle', { cx: 55, cy: 55, r: RING_R, 'class': 'pv-loop__glow' }));
    svg.appendChild(sv('circle', { cx: 55, cy: 55, r: RING_R, 'class': 'pv-loop__arc' }));

    var face = h('div', 'pv-loop__face');
    var secEl = h('div', 'pv-loop__sec pv-num');
    var big = h('b', null, '22');
    var dec = h('small', null, '.0');
    add(secEl, big, dec);
    var idxEl = h('div', 'pv-loop__idx', 'Loop 1');
    add(face, secEl, idxEl);
    add(loop, svg, face);

    el.loop = loop; el.loopBig = big; el.loopDec = dec; el.loopIdx = idxEl;
    return loop;
  }

  function buildHud() {
    var s = makeScreen('hud');
    var hud = h('div', 'pv-hud');
    /* full-width brass rail the console marquee hangs from; JS parks it on the
       plate's bottom edge so it reads as one continuous engraved line. */
    var rail = h('i', 'pv-rail');
    var con = h('div', 'pv-console');
    var plate = frame('pv-plate');
    plate.body.classList.add('pv-plate__in');

    /* ---- 1. LOOP ---------------------------------------------------- */
    var cLoop = h('div', 'pv-cell pv-cell--loop');
    add(cLoop, buildLoopDial());

    /* ---- 2. ECHOES -------------------------------------------------- */
    var cEcho = h('div', 'pv-cell pv-cell--echo');
    var pipWrap = h('div', 'pv-pips');
    pipWrap.setAttribute('role', 'img');
    var echoFoot = h('div', 'pv-echo__foot');
    var kb = h('kbd', 'pv-kbd', 'R');
    var tg = h('span', 'pv-echo__glyph', '↺');
    add(echoFoot, kb, tg, h('span', 'pv-echo__word', 'Rewind'));
    add(cEcho, h('div', 'pv-cell__k', 'Echoes'), pipWrap, echoFoot);

    /* ---- 3. MISSION ------------------------------------------------- */
    var cMis = h('div', 'pv-cell pv-cell--mission');
    var vaultEl = h('div', 'pv-vault');
    var objEl = h('div', 'pv-objective');
    add(cMis, vaultEl, objEl);

    /* ---- 4. SCORE --------------------------------------------------- */
    var cScore = h('div', 'pv-cell pv-cell--score');
    var scoreV = h('div', 'pv-score__v pv-num', '0');
    scoreV.setAttribute('aria-hidden', 'true');
    var chips = h('div', 'pv-chipwrap');
    var relicChip = h('div', 'pv-chip pv-chip--relic');
    var relicV = h('span', 'pv-num', '0/0');
    add(relicChip, h('i', 'pv-chip__gem'), h('span', 'pv-chip__k', 'Relics'), relicV);
    var comboChip = h('div', 'pv-chip pv-chip--combo is-hidden');
    var comboV = h('span', 'pv-num', '×1');
    add(comboChip, comboV);
    var carryChip = h('div', 'pv-chip pv-chip--carry is-hidden');
    var carryV = h('span', 'pv-chip__k', '');
    add(carryChip, h('i', 'pv-chip__gem'), carryV);
    add(chips, carryChip, comboChip, relicChip);
    add(cScore, h('div', 'pv-cell__k', 'Score'), scoreV, chips);

    /* ---- 5. PAUSE --------------------------------------------------- */
    var pause = iconBtn('Pause', 'M8 5h3.1v14H8zM12.9 5H16v14h-3.1z', function () { nav('pause'); });
    pause.classList.add('pv-console__pause');

    add(plate.body, cLoop, cEcho, cMis, cScore, pause);

    /* ---- alert hazard bar, tucked under the plate ------------------- */
    var alert = h('div', 'pv-alert');
    alert.style.setProperty('--pct', '0');
    var at = h('div', 'pv-alert__t');
    var af = h('div', 'pv-alert__f');
    add(at, af);
    add(alert, at, h('div', 'pv-alert__lbl', 'Alert'));

    add(con, plate.el, alert);

    /* --- live region for score --- */
    var live = h('div', 'pv-sr');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');

    add(hud, rail, con, live);
    add(s, hud, buildTouch());

    el.hud = hud; el.rail = rail; el.console = con; el.plate = plate.el;
    el.pipWrap = pipWrap; el.pips = [];
    el.echoCell = cEcho; el.echoFoot = echoFoot;
    el.vault = vaultEl; el.objective = objEl;
    el.alert = alert; el.alertFill = af;
    el.scoreV = scoreV; el.scoreLive = live; el.scoreCell = cScore;
    el.relicV = relicV; el.relicChip = relicChip;
    el.comboChip = comboChip; el.comboV = comboV;
    el.carryChip = carryChip; el.carryV = carryV;
    return s;
  }

  /* ---------------- TOUCH CONTROLS ---------------- */
  function bindHold(btn, name) {
    function dn(e) {
      if (btn.disabled) return;
      btn.classList.add('is-down');
      if (PV.Input && PV.Input.virtual) PV.Input.virtual(name, true);
      try { btn.setPointerCapture(e.pointerId); } catch (x) {}
      if (e.cancelable) e.preventDefault();
    }
    function up(e) {
      if (!btn.classList.contains('is-down')) return;
      btn.classList.remove('is-down');
      if (PV.Input && PV.Input.virtual) PV.Input.virtual(name, false);
      if (e && e.cancelable) e.preventDefault();
    }
    btn.addEventListener('pointerdown', dn);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function touchButton(cls, glyph, label, name) {
    var b = h('button', 'pv-tbtn ' + cls);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    add(b, h('span', 'pv-tbtn__glyph', glyph), h('span', 'pv-tbtn__lbl', label));
    bindHold(b, name);
    return b;
  }

  function buildTouch() {
    var t = h('div', 'pv-touch');
    var act = touchButton('pv-tbtn--action', '◉', 'Act', 'action');
    var rew = touchButton('pv-tbtn--rewind', '↺', 'Rewind', 'rewind');
    add(t, rew, act);
    el.touchWrap = t; el.btnAction = act; el.btnRewind = rew;
    return t;
  }

  /* ---------------- PAUSE ---------------- */
  function buildPause() {
    var s = makeScreen('pause');
    var body = h('div', 'pv-screen__body pv-stagger');
    var f = frame('pv-card pv-sheet pv-fr--glass');

    add(f.body,
      h('p', 'pv-eyebrow', 'Heist Suspended'),
      h('h2', 'pv-h pv-h--gold pv-sheet__title', 'Paused'),
      divider());

    var menu = h('div', 'pv-sheet__menu');
    var resume = button('Resume', 'pv-btn--primary', function () { nav('resume'); });
    var row = h('div', 'pv-row2');
    add(row,
      button('How to Play', null, function () { UI.showScreen('help'); sfx('uiClick'); }),
      button('Settings', null, function () { openSettings(); }));
    var restart = button('Restart Vault', 'pv-btn--ghost', function () {
      confirmThen('Restart this vault?', 'Your loop progress and echoes will be lost.', function () { nav('restart'); });
    });
    var quit = button('Abandon Heist', 'pv-btn--danger', function () {
      confirmThen('Abandon the heist?', 'You will return to the title screen. This run ends here.', function () { nav('quit'); });
    });
    add(menu, resume, row, restart, quit);

    add(f.body, menu, linkRow());
    add(body, f.el);
    add(s, body);
    el.pauseFirst = resume;
    return s;
  }

  /* ---------------- RESULTS (clear / gameover) ---------------- */
  function buildResults(name, winning) {
    var s = makeScreen(name, winning ? 'pv-res--win' : 'pv-res--lose');
    var body = h('div', 'pv-screen__body pv-stagger');
    var f = frame('pv-card pv-sheet pv-fr--glass');

    var head = h('div', 'pv-res__head');
    var eyebrow = h('p', 'pv-eyebrow', winning ? 'Vault Secured' : 'Run Terminated');
    var verdict = h('h2', 'pv-res__verdict', winning ? 'Clean Getaway' : 'Busted');
    var sub = h('p', 'pv-sub', '');
    add(head, eyebrow, verdict, sub);

    var lines = h('div', 'pv-lines');

    var bestRow = h('div', 'pv-res__best');
    var bestV = h('b', 'pv-num', '0');
    var badge = h('span', 'pv-newbest', 'New Best');
    badge.style.display = 'none';
    add(bestRow, h('span', null, 'Best'), bestV, badge);

    var submit = h('div', 'pv-submit');
    submit.setAttribute('data-state', 'idle');
    submit.setAttribute('aria-live', 'polite');

    var next = h('div', 'pv-res__next');
    next.style.display = 'none';
    var nextV = h('b', null, '');
    add(next, h('span', null, 'Up next'), nextV);

    var menu = h('div', 'pv-sheet__menu');
    var primary = button(winning ? 'Next Vault' : 'New Heist', 'pv-btn--primary', function () {
      nav(winning ? 'next' : 'newHeist');
    });
    var row = h('div', 'pv-row2');
    var subBtn = button('Submit Score', null, function () { nav('submit'); });
    var titleBtn = button('Title Screen', 'pv-btn--ghost', function () { nav('quit'); UI.showScreen('title'); });
    add(row, subBtn, titleBtn);
    var retire = winning ? button('Walk Away', 'pv-btn--ghost pv-btn--sm', function () {
      confirmThen('Walk away with the haul?', 'The run ends here and your score is banked.', function () { nav('retire'); });
    }) : null;
    add(menu, primary, row, retire);

    add(f.body, head, divider(), lines, bestRow, submit, next, menu, linkRow());
    add(body, f.el);
    add(s, body);

    var refs = {
      screen: s, eyebrow: eyebrow, verdict: verdict, sub: sub,
      lines: lines, bestV: bestV, badge: badge, submit: submit,
      next: next, nextV: nextV,
      primary: primary, subBtn: subBtn, rows: [], anims: [], first: primary
    };
    return refs;
  }

  /* ---------------- HELP ---------------- */
  function loopCell(tag, dots, paths, caption) {
    var wrap = h('div');
    var cell = h('div', 'pv-loopcell');
    add(cell, h('div', 'pv-loopcell__tag', tag));
    var g = sv('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false' });
    g.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%');
    var i;
    for (i = 0; i < paths.length; i++) {
      g.appendChild(sv('polyline', {
        points: paths[i].pts, fill: 'none', stroke: paths[i].c,
        'stroke-width': 2, 'stroke-dasharray': '4 4', opacity: paths[i].o || 0.55,
        'stroke-linecap': 'round'
      }));
    }
    /* goal */
    g.appendChild(sv('rect', {
      x: 74, y: 18, width: 12, height: 12, fill: 'none',
      stroke: '#ffcf5c', 'stroke-width': 2, transform: 'rotate(45 80 24)'
    }));
    for (i = 0; i < dots.length; i++) {
      var d = dots[i];
      g.appendChild(sv('circle', { cx: d.x, cy: d.y, r: 6.5, fill: d.c, opacity: d.o || 1 }));
      g.appendChild(sv('circle', { cx: d.x, cy: d.y, r: 6.5, fill: 'none', stroke: 'rgba(255,255,255,.5)', 'stroke-width': 1 }));
    }
    add(cell, g);
    add(wrap, cell, h('p', 'pv-help__p', caption));
    return wrap;
  }

  function buildHelp() {
    var s = makeScreen('help');
    var body = h('div', 'pv-screen__body pv-stagger');
    var f = frame('pv-card pv-help pv-fr--glass');

    add(f.body,
      h('p', 'pv-eyebrow', 'Field Manual'),
      h('h2', 'pv-h pv-h--gold pv-sheet__title', 'How to Play'),
      divider());

    var scroll = h('div', 'pv-scroll');
    var cols = h('div', 'pv-help__cols');

    /* controls */
    var ctrl = h('div');
    add(ctrl, h('p', 'pv-eyebrow', 'Controls'));
    var keys = h('div', 'pv-keys');
    var rows = [
      ['W A S D  /  ←↑↓→', 'Move'],
      ['SPACE  /  E', 'Interact · grab · hold'],
      ['R', 'Rewind the loop now'],
      ['SHIFT', 'Dash'],
      ['ESC  /  P', 'Pause'],
      ['M', 'Mute']
    ];
    for (var i = 0; i < rows.length; i++) {
      var r = h('div', 'pv-keys__row');
      add(r, h('span', 'pv-k', rows[i][0]), h('span', null, rows[i][1]));
      add(keys, r);
    }
    add(ctrl, keys);
    add(ctrl, h('p', 'pv-eyebrow', 'Touch'));
    var touchKeys = h('div', 'pv-keys');
    var trows = [
      ['DRAG', 'Left of the screen — floating stick'],
      ['◉', 'Right thumb — interact'],
      ['↺', 'Right thumb — rewind'],
      ['‖', 'Top-right — pause']
    ];
    for (var j = 0; j < trows.length; j++) {
      var tr2 = h('div', 'pv-keys__row');
      add(tr2, h('span', 'pv-k', trows[j][0]), h('span', null, trows[j][1]));
      add(touchKeys, tr2);
    }
    add(ctrl, touchKeys);

    /* time loop diagram */
    var mech = h('div');
    add(mech, h('p', 'pv-eyebrow', 'The Time Loop'));
    var diagram = h('div', 'pv-diagram');
    var loops = h('div', 'pv-loops');
    var GOLD = '#ffd76e', HOLO = '#5ff0ff';
    add(loops,
      loopCell('Loop 1',
        [{ x: 22, y: 78, c: GOLD }],
        [{ pts: '22,78 40,60 55,52', c: GOLD }],
        'You run 22 seconds. Every step is recorded.'),
      loopCell('Loop 2',
        [{ x: 55, y: 52, c: HOLO, o: .85 }, { x: 24, y: 44, c: GOLD }],
        [{ pts: '22,78 40,60 55,52', c: HOLO, o: .4 }, { pts: '22,78 24,60 24,44', c: GOLD }],
        'Rewind. A cyan echo replays loop 1 — holding the plate for you.'),
      loopCell('Loop 3',
        [{ x: 55, y: 52, c: HOLO, o: .7 }, { x: 24, y: 44, c: HOLO, o: .7 }, { x: 80, y: 24, c: GOLD }],
        [{ pts: '22,78 40,60 55,52', c: HOLO, o: .3 }, { pts: '22,78 24,60 24,44', c: HOLO, o: .3 }, { pts: '22,78 50,70 80,24', c: GOLD }],
        'Two echoes hold two doors. You walk straight to the relic.'));
    add(diagram, loops);

    var legend = h('div', 'pv-legend');
    var l1 = h('span'); l1.innerHTML = '';
    var li1 = h('i'); li1.style.background = GOLD;
    var li2 = h('i'); li2.style.background = HOLO;
    var li3 = h('i'); li3.style.cssText = 'background:none;box-shadow:inset 0 0 0 2px rgba(255,207,92,.7);border-radius:0;transform:rotate(45deg)';
    add(legend,
      add(h('span', null, ''), li1, D.createTextNode('You')),
      add(h('span', null, ''), li2, D.createTextNode('Echo of a past you')),
      add(h('span', null, ''), li3, D.createTextNode('Relic / exit')));
    add(diagram, legend);
    add(mech, diagram);

    var p1 = h('p', 'pv-help__p');
    p1.innerHTML = 'Each loop lasts <b>22 seconds</b>. When the ring empties — or you press ' +
      '<span class="hi">R</span> — time rewinds, the vault resets, and a ' +
      '<span class="hi">cyan echo</span> of your last run appears and repeats it <b>exactly</b>. ' +
      'Echoes press plates, hold terminals and trip lasers, so a puzzle that needs three ' +
      'people at once needs three of <b>you</b>.';
    var p2 = h('p', 'pv-help__p');
    p2.innerHTML = 'You have a limited <span class="hi">echo budget</span>. Dying to a laser or ' +
      'tripping the <span style="color:#ff5a3c">alarm</span> forces a rewind and burns one. ' +
      'Carry every <span class="gd">relic</span> to the exit before you run out.';
    add(mech, p1, p2);

    add(cols, ctrl, mech);
    add(scroll, cols);
    add(f.body, scroll);

    var back = button('Back', 'pv-btn--ghost', function () {
      sfx('uiBack');
      UI.showScreen(prevScreen === 'help' ? 'title' : prevScreen);
    });
    var menu = h('div', 'pv-sheet__menu');
    add(menu, back);
    add(f.body, menu);

    add(body, f.el);
    add(s, body);
    el.helpFirst = back;
    return s;
  }

  /* ---------------- SETTINGS SHEET ---------------- */
  function toggleCtl(labelText, get, set) {
    var b = h('button', 'pv-toggle');
    b.type = 'button';
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-label', labelText);
    function sync() { b.setAttribute('aria-checked', get() ? 'true' : 'false'); }
    b.addEventListener('click', function () {
      set(!get()); sync(); sfx('uiClick');
    });
    sync();
    b._sync = sync;
    return hoverable(b);
  }

  function sliderCtl(labelText, get, set) {
    var wrap = h('div', 'pv-setrow__c');
    var inp = h('input', 'pv-slider');
    inp.type = 'range'; inp.min = '0'; inp.max = '100'; inp.step = '1';
    inp.setAttribute('aria-label', labelText);
    var out = h('div', 'pv-setrow__v', '0%');
    function sync() {
      var v = Math.round(get() * 100);
      inp.value = String(v);
      inp.style.setProperty('--fill', v + '%');
      out.textContent = v + '%';
    }
    inp.addEventListener('input', function () {
      set(clamp01(Number(inp.value) / 100));
      sync();
    });
    inp.addEventListener('change', function () { sfx('uiClick'); });
    sync();
    wrap._sync = sync;
    add(wrap, inp, out);
    return wrap;
  }

  function segCtl(labelText, options, get, set) {
    var g = h('div', 'pv-seg');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', labelText);
    var btns = [];
    function sync() {
      for (var i = 0; i < btns.length; i++) {
        btns[i].setAttribute('aria-pressed', get() === options[i].v ? 'true' : 'false');
      }
    }
    for (var i = 0; i < options.length; i++) {
      (function (o) {
        var b = h('button', 'pv-seg__b', o.k);
        b.type = 'button';
        b.addEventListener('click', function () { set(o.v); sync(); sfx('uiClick'); });
        btns.push(hoverable(b));
        add(g, b);
      })(options[i]);
    }
    sync();
    g._sync = sync;
    return g;
  }

  function settingsRow(key, ctl) {
    var r = h('div', 'pv-setrow');
    add(r, h('div', 'pv-setrow__k', key));
    if (ctl.classList && ctl.classList.contains('pv-setrow__c')) add(r, ctl);
    else { var c = h('div', 'pv-setrow__c'); add(c, ctl); add(r, c); }
    return r;
  }

  function buildSettings() {
    var wrap = h('div', 'pv-modalwrap');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Settings');
    var f = frame('pv-card pv-modal pv-fr--glass');

    add(f.body,
      h('p', 'pv-eyebrow', 'Configuration'),
      h('h2', 'pv-h pv-h--gold pv-modal__title', 'Settings'),
      divider());

    var set = h('div', 'pv-set');

    var muteT = toggleCtl('Mute all audio',
      function () { return S.muted; },
      function (v) { S.muted = v; applySettings(false); saveSettings(); });

    var musicS = sliderCtl('Music volume',
      function () { return S.music; },
      function (v) { S.music = v; applySettings(false); saveSettings(); });

    var sfxS = sliderCtl('Sound effects volume',
      function () { return S.sfx; },
      function (v) { S.sfx = v; applySettings(false); saveSettings(); });

    var qual = segCtl('Graphics quality',
      [{ k: 'Low', v: 0 }, { k: 'Med', v: 1 }, { k: 'High', v: 2 }],
      function () { return S.quality; },
      function (v) { S.quality = v; applySettings(true); saveSettings(); });

    var motionT = toggleCtl('Reduce motion',
      function () { return S.reduce; },
      function (v) { S.reduce = v; applySettings(false); saveSettings(); });

    add(set,
      settingsRow('Mute', muteT),
      settingsRow('Music', musicS),
      settingsRow('Effects', sfxS),
      settingsRow('Quality', qual),
      settingsRow('Reduce Motion', motionT));

    var close = button('Done', 'pv-btn--primary', function () { closeSettings(); });
    var menu = h('div', 'pv-sheet__menu');
    add(menu, close);
    add(f.body, set, menu);
    add(wrap, f.el);

    wrap.addEventListener('pointerdown', function (e) {
      if (e.target === wrap) closeSettings();
    });

    el.settings = wrap;
    el.settingsSync = function () {
      muteT._sync(); musicS._sync(); sfxS._sync(); qual._sync(); motionT._sync();
    };
    el.settingsFirst = close;
    return wrap;
  }

  function openSettings() {
    sfx('uiClick');
    el.settingsSync();
    el.settings.classList.add('is-on');
    focusIn(el.settings);
  }
  function closeSettings() {
    sfx('uiBack');
    el.settings.classList.remove('is-on');
    focusIn(screens[cur]);
  }

  /* ---------------- GENERIC MODAL ---------------- */
  function buildModal() {
    var wrap = h('div', 'pv-modalwrap');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    var f = frame('pv-card pv-modal pv-fr--glass');
    var title = h('h2', 'pv-h pv-h--gold pv-modal__title', '');
    var bodyEl = h('div', 'pv-modal__body');
    var extra = h('div');
    extra.style.display = 'none';
    var btns = h('div', 'pv-modal__btns');
    add(f.body, title, divider(), bodyEl, extra, btns);
    add(wrap, f.el);
    el.modal = wrap; el.modalTitle = title; el.modalBody = bodyEl;
    el.modalExtra = extra; el.modalBtns = btns;
    return wrap;
  }

  function focusIn(container) {
    if (!container) return;
    var t = container.querySelector('.pv-btn:not([disabled]), .pv-input, button:not([disabled])');
    if (t && t.focus) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
  }

  function confirmThen(title, body, onYes) {
    UI.modal({
      title: title,
      body: body,
      buttons: [
        { label: 'Cancel', cls: 'pv-btn--ghost', onClick: function () { UI.closeModal(); } },
        { label: 'Confirm', cls: 'pv-btn--danger', onClick: function () { UI.closeModal(); onYes(); } }
      ]
    });
  }

  /* ================================================================
     LAYOUT INSETS
     The renderer frames the vault into whatever rectangle we leave it.
     We are the only module that knows how tall the console marquee and
     the touch cluster actually are, so we measure the real boxes and
     declare them via PV.Render.setInsets(top,right,bottom,left).
     Only PERMANENT chrome counts — never modals, toasts or the flash.
     The same numbers are published as CSS custom properties so the
     toast stack can sit clear of the thumb buttons.
     ================================================================ */
  var ins = { t: -1, b: -1, railY: -1 };
  var layoutRaf = 0;

  function boxOf(node) {
    if (!node) return null;
    var r;
    try { r = node.getBoundingClientRect(); } catch (e) { return null; }
    if (!r || (r.width <= 0 && r.height <= 0)) return null;
    return r;
  }

  function measureLayout() {
    layoutRaf = 0;
    if (!inited || !root) return;
    var vw = global.innerWidth || (D.documentElement && D.documentElement.clientWidth) || 0;
    var vh = global.innerHeight || (D.documentElement && D.documentElement.clientHeight) || 0;
    if (!vw || !vh) return;

    /* --- top: the console marquee (plate + alert rail), always present --- */
    var top = 0, railY = 0;
    var con = boxOf(el.console);
    if (con) top = con.bottom;
    var plate = boxOf(el.plate);
    railY = plate ? plate.bottom : top;

    /* --- bottom: the touch cluster, only while it is actually on screen --- */
    var bottom = 0;
    var btns = [el.btnAction, el.btnRewind], lo = Infinity;
    for (var i = 0; i < btns.length; i++) {
      var b = boxOf(btns[i]);
      if (b && b.top < lo) lo = b.top;
    }
    if (lo < Infinity) bottom = vh - lo;

    /* Be conservative: never let the HUD claim so much that the room is
       squeezed, and never report a negative or absurd number. */
    var cap = vh * 0.34;
    top = Math.round(PV.clamp ? PV.clamp(top, 0, cap) : Math.max(0, Math.min(top, cap)));
    bottom = Math.round(PV.clamp ? PV.clamp(bottom, 0, cap) : Math.max(0, Math.min(bottom, cap)));

    if (top !== ins.t || bottom !== ins.b) {
      ins.t = top; ins.b = bottom;
      root.style.setProperty('--pv-ins-t', top + 'px');
      root.style.setProperty('--pv-ins-b', bottom + 'px');
      if (PV.Render && PV.Render.setInsets) {
        try { PV.Render.setInsets(top, 0, bottom, 0); } catch (e) {}
      }
    }
    railY = Math.round(railY);
    if (railY !== ins.railY && el.rail) {
      ins.railY = railY;
      el.rail.style.top = railY + 'px';
    }
  }

  function relayout() {
    if (!inited) return;
    if (layoutRaf) return;
    layoutRaf = raf(measureLayout);
  }
  UI.relayout = relayout;

  function watchLayout() {
    global.addEventListener('resize', relayout, { passive: true });
    global.addEventListener('orientationchange', relayout, { passive: true });
    if (global.visualViewport && global.visualViewport.addEventListener) {
      global.visualViewport.addEventListener('resize', relayout, { passive: true });
    }
    if (global.ResizeObserver) {
      try {
        var ro = new global.ResizeObserver(relayout);
        ro.observe(el.console);
        if (el.touchWrap) ro.observe(el.touchWrap);
      } catch (e) {}
    }
    /* fonts / first paint can settle a frame or two late */
    relayout();
    setTimeout(relayout, 60);
    setTimeout(relayout, 260);
    setTimeout(relayout, 900);
  }

  /* ================================================================
     PUBLIC API
     ================================================================ */

  UI.init = function () {
    if (inited) return;
    inited = true;

    root = D.getElementById('pv-ui');
    if (!root) {
      root = D.createElement('div');
      root.id = 'pv-ui';
      (D.body || D.documentElement).appendChild(root);
    }
    while (root.firstChild) root.removeChild(root.firstChild);
    root.setAttribute('data-screen', 'boot');

    loadSettings();

    /* screens (order = paint order; hud sits under menus) */
    add(root, buildHud());
    add(root, buildBoot());
    add(root, buildTitle());
    add(root, buildBrief());
    add(root, buildPause());
    el.resClear = buildResults('clear', true);
    el.resOver = buildResults('gameover', false);
    add(root, el.resClear.screen, el.resOver.screen);
    add(root, buildHelp());

    /* overlays */
    el.toasts = h('div', 'pv-toasts');
    el.toasts.setAttribute('aria-live', 'polite');
    el.toasts.setAttribute('aria-atomic', 'false');
    add(root, el.toasts);
    add(root, buildModal());
    add(root, buildSettings());
    el.flash = h('div', 'pv-flash');
    add(root, el.flash);

    applySettings(false);
    UI.setTouchVisible(!!PV.isTouch);
    UI.setBest(PV.store ? (PV.store.get('best', 0) || 0) : 0);
    autoContinue();

    /* audio unlock on first gesture anywhere */
    function unlock() {
      if (PV.Audio && PV.Audio.unlock) { try { PV.Audio.unlock(); } catch (e) {} }
      global.removeEventListener('pointerdown', unlock, true);
      global.removeEventListener('keydown', unlock, true);
      global.removeEventListener('touchstart', unlock, true);
    }
    global.addEventListener('pointerdown', unlock, true);
    global.addEventListener('keydown', unlock, true);
    global.addEventListener('touchstart', unlock, true);

    /* Esc closes the top-most overlay */
    D.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.code !== 'Escape') return;
      if (el.settings.classList.contains('is-on')) { closeSettings(); e.stopPropagation(); return; }
      if (el.modal.classList.contains('is-on')) { UI.closeModal(); e.stopPropagation(); }
    }, true);

    /* first touch on any real pointer switches the touch controls on */
    global.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' && !touchVisible) UI.setTouchVisible(true);
    }, true);

    UI.showScreen('boot');
    watchLayout();
  };

  UI.showScreen = function (name) {
    if (!inited) UI.init();
    if (!screens[name] || cur === name) return;
    if (cur && cur !== 'help') prevScreen = cur;
    cur = name;
    root.setAttribute('data-screen', name);
    for (var k in screens) {
      var on = (k === name);
      screens[k].classList.toggle('is-on', on);
      screens[k].setAttribute('aria-hidden', on ? 'false' : 'true');
    }
    if (name !== 'hud' && name !== 'boot') {
      var f = screens[name].querySelector('.pv-btn:not([disabled])');
      if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} }
    } else if (D.activeElement && D.activeElement.blur && D.activeElement !== D.body) {
      try { D.activeElement.blur(); } catch (e) {}
    }
    if (name === 'clear') revealResults(el.resClear);
    if (name === 'gameover') revealResults(el.resOver);
    relayout();
  };

  UI.screen = function () { return cur; };

  UI.setBootProgress = function (p, label) {
    if (!inited) UI.init();
    p = clamp01(Number(p) || 0);
    el.bootFill.style.setProperty('--pct', p.toFixed(3));
    el.bootBar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    if (label != null && el.bootLabel.textContent !== label) el.bootLabel.textContent = label;
  };

  UI.setBest = function (n) {
    if (!inited) return;
    el.bestVal.textContent = fmtNum(n || 0);
  };

  UI.setContinueAvailable = function (v) {
    if (!inited) return;
    el.btnContinue.style.display = v ? '' : 'none';
  };
  function autoContinue() {
    var has = false;
    if (PV.store) {
      var s = PV.store.get('save', null);
      if (!s) s = PV.store.get('run', null);
      has = !!s;
    }
    UI.setContinueAvailable(has);
  }

  UI.setTouchVisible = function (v) {
    if (touchVisible === !!v && root && root.getAttribute('data-touch')) return;
    touchVisible = !!v;
    if (root) root.setAttribute('data-touch', touchVisible ? '1' : '0');
    relayout();
  };

  /* ---------------- setHUD (allocation-light, DOM-diffed) ---------------- */
  var L = {
    pct: -1, secTenths: -1, state: '', loopIdx: -1,
    echoesLeft: -1, echoesMax: -1,
    relicsHeld: -1, relicsTotal: -1,
    scoreShown: -1, scoreTarget: 0, scoreDisp: 0,
    combo: -1, comboOn: null,
    alertQ: -1, alertOn: null, alertHigh: null,
    vault: '', objective: '', canRewind: null, carrying: ' ',
    liveAt: 0, liveVal: -1
  };

  function ensurePips(n) {
    var pips = el.pips;
    while (pips.length < n) {
      var p = h('i', 'pv-pip');
      p.appendChild(h('i', 'pv-pip__c'));
      el.pipWrap.appendChild(p);
      pips.push(p);
    }
    while (pips.length > n) {
      el.pipWrap.removeChild(pips.pop());
    }
    el.pipWrap.setAttribute('aria-label', n + ' echoes remaining');
  }

  /* fire the "an echo was just spent" animation on the pips that flipped */
  function spendPips(from, to) {
    if (motionOff()) return;
    for (var i = to; i < from && i < el.pips.length; i++) {
      var p = el.pips[i];
      p.classList.remove('is-spending');
      void p.offsetWidth;
      p.classList.add('is-spending');
    }
  }

  UI.setHUD = function (st) {
    if (!inited || !st) return;

    /* ---- loop ring ---- */
    var pct = (typeof st.loopPct === 'number') ? clamp01(st.loopPct) : 1;
    var q = (pct * 500) | 0;
    if (q !== L.pct) { L.pct = q; el.loop.style.setProperty('--pct', (q / 500).toFixed(4)); }

    var sec = (typeof st.secondsLeft === 'number') ? st.secondsLeft : pct * 22;
    if (sec < 0) sec = 0;
    var tenths = (sec * 10) | 0;
    if (tenths !== L.secTenths) {
      L.secTenths = tenths;
      el.loopBig.textContent = String((tenths / 10) | 0);
      el.loopDec.textContent = '.' + (tenths % 10);
    }
    var state = sec <= 5 ? 'danger' : (sec <= 9 ? 'warn' : 'ok');
    if (state !== L.state) {
      L.state = state;
      el.loop.setAttribute('data-state', state);
      el.console.setAttribute('data-state', state);
    }

    var li = (st.loopIndex | 0) + 1;
    if (li !== L.loopIdx) { L.loopIdx = li; el.loopIdx.textContent = 'Loop ' + li; }

    /* ---- echo pips ---- */
    var emax = st.echoesMax | 0, eleft = st.echoesLeft | 0;
    if (emax !== L.echoesMax) {
      L.echoesMax = emax; L.echoesLeft = -1;
      ensurePips(emax);
      el.echoCell.style.display = emax > 0 ? '' : 'none';
    }
    if (eleft !== L.echoesLeft) {
      var prevEchoes = L.echoesLeft;
      L.echoesLeft = eleft;
      for (var i = 0; i < el.pips.length; i++) {
        var full = i < eleft;
        var p = el.pips[i];
        if (full) { p.classList.add('is-full'); p.classList.remove('is-spent'); }
        else { p.classList.remove('is-full'); p.classList.add('is-spent'); }
      }
      if (prevEchoes >= 0 && eleft < prevEchoes) spendPips(prevEchoes, eleft);
      el.echoCell.setAttribute('data-low', eleft <= 1 ? '1' : '0');
    }

    /* ---- relics: banked at the exit, not merely carried ---- */
    var rh = (st.relicsBanked != null ? st.relicsBanked : st.relicsHeld) | 0;
    var rt = st.relicsTotal | 0;
    if (rh !== L.relicsHeld || rt !== L.relicsTotal) {
      var gainedRelic = (L.relicsHeld >= 0 && rh > L.relicsHeld);
      L.relicsHeld = rh; L.relicsTotal = rt;
      el.relicV.textContent = rh + '/' + rt;
      if (gainedRelic && !motionOff()) {
        el.relicChip.classList.remove('pv-chip--bump');
        void el.relicChip.offsetWidth;
        el.relicChip.classList.add('pv-chip--bump');
      }
    }

    /* ---- score (rolling count-up) ---- */
    var target = st.score || 0;
    if (target !== L.scoreTarget) {
      L.scoreTarget = target;
      if (motionOff()) L.scoreDisp = target;
    }
    if (L.scoreDisp !== target) {
      var d = target - L.scoreDisp;
      var step = Math.abs(d) * 0.16;
      if (step < 1) step = 1;
      if (Math.abs(d) <= step) L.scoreDisp = target;
      else L.scoreDisp += (d > 0 ? step : -step);
    }
    var sv2 = Math.round(L.scoreDisp);
    if (sv2 !== L.scoreShown) {
      if (sv2 > L.scoreShown && L.scoreShown >= 0) el.scoreCell.setAttribute('data-live', '1');
      L.scoreShown = sv2;
      el.scoreV.textContent = fmtNum(sv2);
      if (sv2 === L.scoreTarget) el.scoreCell.setAttribute('data-live', '0');
    }
    /* throttled screen-reader announcement */
    if (target !== L.liveVal) {
      var now = PV.now ? PV.now() : Date.now();
      if (now - L.liveAt > 1600) {
        L.liveAt = now; L.liveVal = target;
        el.scoreLive.textContent = 'Score ' + fmtNum(target);
      }
    }

    /* ---- vault multiplier (game.js sends the difficulty multiplier here) ---- */
    var combo = Math.round((Number(st.combo) || 1) * 100);
    if (combo !== L.combo) {
      var wasOn = L.comboOn;
      L.combo = combo;
      el.comboV.textContent = '×' + (combo % 100 === 0 ? (combo / 100).toFixed(0) : (combo / 100).toFixed(2));
      var on = combo > 100;
      if (on !== wasOn) {
        L.comboOn = on;
        el.comboChip.classList.toggle('is-hidden', !on);
      }
      if (on && wasOn === false && !motionOff()) {
        el.comboChip.classList.remove('pv-chip--bump');
        void el.comboChip.offsetWidth;
        el.comboChip.classList.add('pv-chip--bump');
      }
    }

    /* ---- alert meter ---- */
    var al = typeof st.alert === 'number' ? clamp01(st.alert) : 0;
    var aq = (al * 100) | 0;
    if (aq !== L.alertQ) {
      L.alertQ = aq;
      el.alert.style.setProperty('--pct', (aq / 100).toFixed(2));
      var aon = aq > 0;
      if (aon !== L.alertOn) { L.alertOn = aon; el.alert.classList.toggle('is-on', aon); }
      var ahigh = aq >= 70;
      if (ahigh !== L.alertHigh) {
        L.alertHigh = ahigh;
        el.alert.setAttribute('data-state', ahigh ? 'high' : 'low');
        el.console.setAttribute('data-alarm', ahigh ? '1' : '0');
      }
    }

    /* ---- text ---- */
    var vn = st.vaultName || '';
    if (vn !== L.vault) {
      L.vault = vn;
      el.vault.textContent = st.vaultWing ? (vn + ' · ' + st.vaultWing) : vn;
      el.vault.title = vn;
      relayout();
    }
    var ob = st.objective || '';
    if (ob !== L.objective) {
      L.objective = ob;
      el.objective.textContent = ob;
      el.objective.title = ob;
      el.objective.style.display = ob ? '' : 'none';
      relayout();
    }

    /* ---- rewind affordance ---- */
    var cr = st.canRewind !== false;
    if (cr !== L.canRewind) {
      L.canRewind = cr;
      el.echoFoot.classList.toggle('is-off', !cr);
      el.btnRewind.disabled = !cr;
    }

    /* ---- carrying ---- */
    var car = st.carrying || '';
    if (car !== L.carrying) {
      L.carrying = car;
      el.carryChip.classList.toggle('is-hidden', !car);
      if (car) el.carryV.textContent = String(car).toUpperCase();
    }
  };

  /* ---------------- brief ---------------- */
  function setStat(node, txt) {
    if (!node) return;
    if (node.firstChild && node.firstChild.nodeType === 3) node.firstChild.nodeValue = txt;
    else node.insertBefore(D.createTextNode(txt), node.firstChild);
  }

  UI.setBrief = function (v) {
    if (!inited) UI.init();
    v = v || {};
    var name = v.name || v.vaultName || 'Unnamed Vault';
    var floor = (v.floor != null) ? v.floor :
      ((v.index != null) ? (v.index | 0) + 1 :
        ((v.vaultIndex != null) ? (v.vaultIndex | 0) + 1 : 1));
    var relics = (v.relics != null) ? v.relics :
      ((v.relicCount != null) ? v.relicCount : (v.relicsTotal != null ? v.relicsTotal : 0));
    var echoes = (v.echoBudget != null) ? v.echoBudget :
      ((v.echoesMax != null) ? v.echoesMax : (v.echoes != null ? v.echoes : 0));
    var obj = v.objective || 'Lift every relic and reach the exit before your echoes run out.';
    var loopSec = Math.round(v.loopSeconds || 22);
    var mult = Number(v.multiplier) || 1;

    el.briefTitle.textContent = name;
    el.briefWing.textContent = v.wing || '';
    el.briefWing.style.display = v.wing ? '' : 'none';
    el.briefFloor.textContent = (floor < 10 ? '0' : '') + floor;
    el.briefObj.textContent = obj;
    el.briefHintT.textContent = v.hint || '';
    el.briefHint.style.display = v.hint ? '' : 'none';
    setStat(el.briefRelic, String(relics));
    setStat(el.briefEcho, String(echoes));
    setStat(el.briefLoop, String(loopSec));
    setStat(el.briefMult, '×' + (mult % 1 === 0 ? mult.toFixed(0) : mult.toFixed(2)));
  };

  /* ---------------- results ---------------- */
  function makeLine(label, value, cls) {
    var r = h('div', 'pv-line' + (cls ? ' ' + cls : ''));
    var k = h('div', 'pv-line__k', label);
    var dots = h('i', 'pv-line__dots');
    var v = h('div', 'pv-line__v pv-num', '0');
    add(r, k, dots, v);
    r._v = v; r._target = value;
    return r;
  }

  UI.setResults = function (res) {
    if (!inited) UI.init();
    res = res || {};
    var win = (res.kind === 'clear') ? true : (res.kind === 'gameover' ? false :
      ((res.cleared != null) ? !!res.cleared :
        (res.win != null ? !!res.win : (cur !== 'gameover'))));
    var R = win ? el.resClear : el.resOver;
    var i;

    if (res.title) R.verdict.textContent = res.title;
    else R.verdict.textContent = win ? 'Clean Getaway' : 'Busted';
    if (res.eyebrow) R.eyebrow.textContent = res.eyebrow;
    var loops = res.loops | 0;
    R.sub.textContent = res.subtitle || res.reason ||
      (win ? ((res.vaultName ? res.vaultName + ' cleared' : 'Vault cleared') +
              (loops ? ' in ' + loops + ' loop' + (loops === 1 ? '' : 's') + '.' : '.'))
           : 'Out of echoes. Out of time.');

    /* breakdown */
    while (R.lines.firstChild) R.lines.removeChild(R.lines.firstChild);
    R.rows.length = 0;
    var bd = res.breakdown || res.lines || [];
    if (!bd.length && !win) {
      bd = [
        { label: 'Vaults cleared', value: res.vaultsCleared | 0, plain: true },
        { label: 'Deepest floor', value: res.deepest | 0, plain: true },
        { label: 'Loops burned', value: loops, plain: true }
      ];
    }
    var row;
    for (i = 0; i < bd.length; i++) {
      var it = bd[i];
      var label = it.label != null ? it.label : (it.k != null ? it.k : '');
      var value = Number(it.value != null ? it.value : (it.v != null ? it.v : 0)) || 0;
      var cls = it.plain ? 'pv-line--plain' : (it.bonus || value > 0 ? '' : 'pv-line--zero');
      row = makeLine(label, value, cls);
      row._suffix = it.suffix || '';
      row._prefix = it.prefix || '';
      R.lines.appendChild(row);
      R.rows.push(row);
    }

    var total = (res.total != null) ? res.total : (res.score != null ? res.score : 0);
    var mult = Number(res.multiplier) || 0;
    var totalLabel = win ? 'Vault Score' : 'Final Score';
    row = makeLine(totalLabel, Number(total) || 0, 'pv-line--total');
    if (win && mult > 1.001) {
      var mb = h('span', 'pv-mult', '×' + mult.toFixed(2));
      row.firstChild.appendChild(mb);
    }
    row._suffix = ''; row._prefix = '';
    R.lines.appendChild(row);
    R.rows.push(row);

    if (win && res.runScore != null) {
      row = makeLine('Run Total', Number(res.runScore) || 0, 'pv-line--run');
      row._suffix = ''; row._prefix = '';
      R.lines.appendChild(row);
      R.rows.push(row);
    }

    /* best */
    var best = (res.best != null) ? res.best : (PV.store ? (PV.store.get('best', 0) || 0) : 0);
    R.bestV.textContent = fmtNum(best);
    R.badge.style.display = (res.isBest || res.newBest) ? '' : 'none';
    UI.setBest(best);

    if (R.next) {
      var nn = win ? (res.nextName || '') : '';
      R.next.style.display = nn ? '' : 'none';
      R.nextV.textContent = nn;
    }

    UI.setSubmitState(res.submit || res.submitState || 'idle', res.submitText);

    if (cur === 'clear' || cur === 'gameover') revealResults(R);
  };

  UI.setSubmitState = function (state, text) {
    if (!inited) return;
    var targets = [el.resClear, el.resOver];
    for (var i = 0; i < targets.length; i++) {
      var R = targets[i];
      var n = R.submit;
      while (n.firstChild) n.removeChild(n.firstChild);
      n.setAttribute('data-state', state || 'idle');
      if (state === 'sending') {
        add(n, h('i', 'pv-spin'), h('span', null, text || 'Submitting to the leaderboard…'));
        R.subBtn.disabled = true;
      } else if (state === 'ok') {
        n.textContent = text || '✓ Score submitted';
        R.subBtn.disabled = true;
      } else if (state === 'err') {
        n.textContent = text || 'Could not reach the leaderboard';
        R.subBtn.disabled = false;
      } else {
        n.textContent = text || '';
        R.subBtn.disabled = false;
      }
    }
  };

  function revealResults(R) {
    var i;
    for (i = 0; i < R.anims.length; i++) caf(R.anims[i]);
    R.anims.length = 0;
    var reduced = motionOff();
    for (i = 0; i < R.rows.length; i++) {
      (function (row, idx) {
        var delay = idx * 130;
        row.classList.remove('is-in');
        row.style.animationDelay = (delay / 1000) + 's';
        void row.offsetWidth;
        row.classList.add('is-in');
        if (reduced) {
          row._v.textContent = (row._prefix || '') + fmtNum(row._target) + (row._suffix || '');
          row.style.opacity = '1';
          return;
        }
        var start = 0, t0 = 0;
        function step(t) {
          if (!t0) t0 = t;
          var e = (t - t0 - delay) / 480;
          if (e < 0) { R.anims[idx] = raf(step); return; }
          if (e > 1) e = 1;
          var k = 1 - Math.pow(1 - e, 3);
          row._v.textContent = (row._prefix || '') + fmtNum(start + (row._target - start) * k) + (row._suffix || '');
          if (e < 1) R.anims[idx] = raf(step);
        }
        R.anims[idx] = raf(step);
      })(R.rows[i], i);
    }
  }

  /* ---------------- toast ---------------- */
  var toastQ = [];
  UI.toast = function (msg, ms) {
    if (!inited) UI.init();
    if (msg == null) return;
    ms = ms || 2200;
    var t = h('div', 'pv-toast');
    add(t, h('span', null, String(msg)));
    el.toasts.appendChild(t);
    toastQ.push(t);
    while (toastQ.length > 3) {
      var old = toastQ.shift();
      if (old.parentNode) old.parentNode.removeChild(old);
    }
    var killed = false;
    function kill() {
      if (killed) return;
      killed = true;
      t.classList.add('is-out');
      setTimeout(function () {
        if (t.parentNode) t.parentNode.removeChild(t);
        var ix = toastQ.indexOf(t); if (ix >= 0) toastQ.splice(ix, 1);
      }, 320);
    }
    setTimeout(kill, ms);
    return t;
  };

  /* ---------------- modal ---------------- */
  UI.modal = function (opts) {
    if (!inited) UI.init();
    opts = opts || {};
    el.modalTitle.textContent = opts.title || '';
    el.modalTitle.style.display = opts.title ? '' : 'none';
    if (opts.html) { el.modalBody.innerHTML = opts.html; }
    else { el.modalBody.textContent = opts.body || ''; }
    el.modalBody.style.display = (opts.body || opts.html) ? '' : 'none';
    el.modalExtra.style.display = 'none';
    while (el.modalExtra.firstChild) el.modalExtra.removeChild(el.modalExtra.firstChild);
    while (el.modalBtns.firstChild) el.modalBtns.removeChild(el.modalBtns.firstChild);

    var btns = opts.buttons || [{ label: 'OK', cls: 'pv-btn--primary', onClick: UI.closeModal }];
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        var node = button(b.label || 'OK', b.cls || '', function () {
          sfx(b.cls && b.cls.indexOf('ghost') >= 0 ? 'uiBack' : 'uiClick');
          if (b.onClick) b.onClick();
        });
        el.modalBtns.appendChild(node);
      })(btns[i]);
    }
    el.modal.classList.add('is-on');
    focusIn(el.modal);
    return el.modal;
  };

  UI.closeModal = function () {
    if (!inited) return;
    el.modal.classList.remove('is-on');
    focusIn(screens[cur]);
  };

  UI.prompt = function (opts) {
    if (!inited) UI.init();
    opts = opts || {};
    return new Promise(function (resolve) {
      var done = false;
      function finish(val) {
        if (done) return;
        done = true;
        UI.closeModal();
        resolve(val);
      }
      UI.modal({
        title: opts.title || 'Enter your name',
        body: opts.body || '',
        buttons: [
          { label: 'Cancel', cls: 'pv-btn--ghost', onClick: function () { finish(null); } },
          { label: opts.okLabel || 'Submit', cls: 'pv-btn--primary', onClick: function () { finish(input.value.trim() || null); } }
        ]
      });
      var input = h('input', 'pv-input');
      input.type = 'text';
      input.placeholder = opts.placeholder || 'AGENT';
      input.maxLength = opts.maxLength || 16;
      input.setAttribute('aria-label', opts.title || 'Input');
      if (opts.value) input.value = opts.value;
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); finish(input.value.trim() || null); }
        if (e.key === 'Escape') { e.preventDefault(); finish(null); }
      });
      el.modalExtra.appendChild(input);
      el.modalExtra.style.display = '';
      setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e) {} }, 40);
    });
  };

  /* ---------------- flash ---------------- */
  var flashTimer = 0;
  UI.flash = function (kind) {
    if (!inited) return;
    kind = kind || 'grab';
    var f = el.flash;
    f.setAttribute('data-kind', kind);
    f.classList.remove('is-on');
    void f.offsetWidth;
    f.classList.add('is-on');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { f.classList.remove('is-on'); }, 700);
  };

  /* expose settings for other modules (read-only-ish) */
  UI.settings = S;
  UI.openSettings = openSettings;
  UI.closeSettings = closeSettings;

  /* auto-init when the DOM is ready so a bare page still works */
  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', function () { if (!inited) UI.init(); });
  }

})(window);
