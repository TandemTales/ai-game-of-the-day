/* Shiftmaw UI: builds the HUD, overlays and touch controls. No game rules here. */
(function (global) {
  'use strict';
  var SM = global.SM = global.SM || {};
  var UI = SM.UI = {}, root, el = {}, toastT = 0;

  function h(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  UI.init = function (handlers) {
    root = document.getElementById('sm-ui');
    var hud = h('div', 'sm-hud');
    hud.innerHTML = '<div class="sm-stat"><small>SCORE</small><b id="smScore">0</b></div>' +
      '<div class="sm-stat mid"><small id="smLevelL">LEVEL 1</small><div class="sm-lives" id="smLives"></div></div>' +
      '<div class="sm-stat right" style="margin-right:84px"><small>BEST</small><b id="smBest">0</b></div>';
    root.appendChild(hud);
    var btns = h('div', 'sm-btns');
    btns.innerHTML = '<button class="sm-ico" id="smPause" aria-label="Pause">❚❚</button><button class="sm-ico" id="smMute" aria-label="Toggle sound">♪</button>';
    root.appendChild(btns);

    var flip = h('button', 'sm-flip'); flip.id = 'smFlip'; flip.setAttribute('aria-label', 'Flip the maze phase');
    flip.innerHTML = '<span>FLIP</span><span class="sm-pips" id="smPips"></span><span class="sm-key">SPACE</span>';
    root.appendChild(flip);

    var dp = h('div', 'sm-dpad');
    dp.innerHTML = '<button class="u" aria-label="Up" data-d="0">▲</button><button class="l" aria-label="Left" data-d="1">◀</button><button class="d" aria-label="Down" data-d="2">▼</button><button class="r" aria-label="Right" data-d="3">▶</button>';
    root.appendChild(dp);
    root.appendChild(h('div', 'sm-banner')); el.banner = root.lastChild;
    root.appendChild(h('div', 'sm-toast')); el.toast = root.lastChild;

    el.menu = h('div', 'sm-overlay show');
    el.menu.innerHTML = '<div class="sm-card"><h1 class="sm-title">SHIFTMAW</h1><p class="sm-sub">The maze has two faces</p>' +
      '<ul class="sm-how"><li><i>←↑</i><span><b>Move</b> with arrows / WASD, swipe, or the pad. Eat every glowmote.</span></li>' +
      '<li><i>◐</i><span><b>Flip</b> (Space / button) swaps <b style="color:#ffbe46">Day</b> and <b style="color:#a97cff">Dusk</b> walls. Hollows caught inside a rising wall are <b>pinched</b> for 400, 800, 1600…</span></li>' +
      '<li><i>✿</i><span><b>Dusk blooms</b> stun every Hollow and refill a Flip charge. Every 50 motes grants one too — unspent charge pays 500 each.</span></li></ul>' +
      '<button class="sm-btn" id="smPlay">PLAY</button><a class="sm-btn alt" href="../index.html">ARCADE</a>' +
      '<div class="sm-meta" id="smMenuMeta"></div></div>';
    root.appendChild(el.menu);

    el.pause = h('div', 'sm-overlay');
    el.pause.innerHTML = '<div class="sm-card"><h1 class="sm-title" style="font-size:38px">PAUSED</h1><p class="sm-sub">Take a breath</p><button class="sm-btn" id="smResume">RESUME</button><button class="sm-btn alt" id="smQuit">QUIT RUN</button></div>';
    root.appendChild(el.pause);

    el.over = h('div', 'sm-overlay');
    el.over.innerHTML = '<div class="sm-card"><h1 class="sm-title" style="font-size:38px">RUN OVER</h1><p class="sm-sub" id="smOverSub">Final score</p><div class="sm-final" id="smFinal">0</div>' +
      '<div class="sm-stats"><div><b id="smStLevel">1</b><small>LEVEL</small></div><div><b id="smStPinch">0</b><small>PINCHES</small></div><div><b id="smStChain">0</b><small>BEST CHAIN</small></div></div>' +
      '<div class="sm-name" id="smNameBox"><div class="sm-sub" id="smRankMsg" style="margin:0 0 6px"></div><input id="smName" maxlength="20" placeholder="Your name" autocomplete="off" /><br /><button class="sm-btn" id="smSubmit" style="margin-top:8px">SUBMIT SCORE</button></div>' +
      '<button class="sm-btn" id="smAgain">PLAY AGAIN</button><a class="sm-btn alt" id="smBoard" href="../leaderboard.html?gameId=shiftmaw">LEADERBOARD</a></div>';
    root.appendChild(el.over);

    var $ = function (id) { return document.getElementById(id); };
    el.score = $('smScore'); el.best = $('smBest'); el.level = $('smLevelL'); el.lives = $('smLives'); el.pips = $('smPips'); el.flip = flip; el.dpad = dp; el.mute = $('smMute');
    $('smPlay').onclick = handlers.play; $('smResume').onclick = handlers.resume; $('smQuit').onclick = handlers.quit; $('smAgain').onclick = handlers.play;
    $('smPause').onclick = handlers.pause; el.mute.onclick = handlers.mute;
    $('smSubmit').onclick = handlers.submit;
    $('smName').addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') handlers.submit(); });
    var press = function (e) { e.preventDefault(); handlers.flip(); };
    flip.addEventListener('pointerdown', press);
    flip.addEventListener('keydown', function (e) { if (e.code === 'Space' || e.code === 'Enter') e.preventDefault(); });
    dp.addEventListener('pointerdown', function (e) { var b = e.target.closest('button'); if (b) { e.preventDefault(); handlers.dir(+b.getAttribute('data-d')); } });
    document.body.classList.toggle('touch', SM.isTouch);
    UI.orient();
    global.addEventListener('resize', UI.orient);
  };

  UI.orient = function () { document.body.classList.toggle('portrait', global.innerHeight >= global.innerWidth); };

  var lastHud = '';
  UI.hud = function (s, best, hudInfo) {
    var key = [s.score, s.lives, s.level, s.charge, best, s.phase, s.flipCd > 0 ? 1 : 0].join('|');
    if (key === lastHud) return; lastHud = key;
    el.score.textContent = SM.fmt(s.score); el.best.textContent = SM.fmt(Math.max(best, s.score)); el.level.textContent = 'LEVEL ' + s.level;
    var lv = ''; for (var i = 0; i < Math.max(0, s.lives - 1); i++) lv += '<span class="sm-life"></span>'; el.lives.innerHTML = lv;
    var pips = ''; for (i = 0; i < SM.Sim.MAX_CHARGE; i++) pips += '<span class="sm-pip' + (i < s.charge ? ' on' : '') + '"></span>';
    el.pips.innerHTML = pips;
    el.flip.setAttribute('data-ready', s.charge > 0 ? '1' : '0');
    var next = s.phase ? 'rgb(255,190,70)' : 'rgb(169,124,255)', glow = s.phase ? 'rgba(255,190,70,.5)' : 'rgba(169,124,255,.55)';
    el.flip.style.setProperty('--phase', next); el.flip.style.setProperty('--phase-glow', glow);
    el.flip.firstChild.textContent = s.phase ? 'TO DAY' : 'TO DUSK';
  };
  UI.setBestDisplay = function (b, extra) { el.best.textContent = SM.fmt(b); var m = document.getElementById('smMenuMeta'); if (m) m.innerHTML = (b ? 'Best: <b>' + SM.fmt(b) + '</b> · ' : '') + '<a href="../leaderboard.html?gameId=shiftmaw">Leaderboard</a>'; };
  UI.banner = function (html, ms) { el.banner.innerHTML = html; el.banner.classList.add('show'); clearTimeout(UI._bt); if (ms) UI._bt = setTimeout(function () { el.banner.classList.remove('show'); }, ms); };
  UI.hideBanner = function () { el.banner.classList.remove('show'); };
  UI.toast = function (t, ms) { el.toast.textContent = t; el.toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { el.toast.classList.remove('show'); }, ms || 2200); };
  UI.show = function (name, on) { el[name].classList.toggle('show', !!on); };
  UI.setMuted = function (m) { el.mute.textContent = m ? '✕' : '♪'; el.mute.setAttribute('aria-pressed', m ? 'true' : 'false'); };
  UI.showOver = function (s) {
    document.getElementById('smFinal').textContent = SM.fmt(s.score);
    document.getElementById('smStLevel').textContent = s.level; document.getElementById('smStPinch').textContent = s.stats.pinches; document.getElementById('smStChain').textContent = s.stats.bestChain;
    UI.show('over', true); document.getElementById('smNameBox').classList.remove('show');
  };
  UI.askName = function (rank) {
    var box = document.getElementById('smNameBox'); document.getElementById('smRankMsg').textContent = 'Top 20 — rank #' + rank; box.classList.add('show');
    var i = document.getElementById('smName'); i.value = SM.store.get('name', '') || ''; setTimeout(function () { try { i.focus(); } catch (e) { /* ignore */ } }, 50);
  };
  UI.nameValue = function () { return document.getElementById('smName').value; };
  UI.hideName = function () { document.getElementById('smNameBox').classList.remove('show'); };
  UI.padBottom = function () {
    if (!SM.isTouch) return 70;
    return global.innerHeight >= global.innerWidth ? 190 : 0;
  };
})(typeof window !== 'undefined' ? window : globalThis);
