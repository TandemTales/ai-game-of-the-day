/* Wickfire renderer: procedural tile atlas, lit wick/flames, actors, particles, post vignette. */
(function () {
  'use strict';
  var WK = window.WK = window.WK || {};
  var S = WK.sim, cv, cx, tile = 32, ox = 0, oy = 0, dpr = 1, vw = 0, vh = 0, atlas = {}, shake = 0, parts = [], popups = [], flash = 0;
  var topPad = 64, botPad = 0;

  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function h2(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }

  function bake() {
    var s = Math.round(tile * dpr), c, g, i, v;
    function noisy(g2, amt) { for (var k = 0; k < s * 2; k++) { g2.fillStyle = 'rgba(' + (h2(k, s) > 0.5 ? '255,255,255' : '0,0,0') + ',' + (h2(k, 3) * amt).toFixed(3) + ')'; g2.fillRect(Math.floor(h2(k, 1) * s), Math.floor(h2(k, 2) * s), Math.max(1, s / 16), Math.max(1, s / 16)); } }
    // floor variants
    atlas.floor = [];
    for (v = 0; v < 4; v++) {
      c = mk(s, s); g = c.getContext('2d');
      var gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, v % 2 ? '#3a3340' : '#403846'); gr.addColorStop(1, v % 2 ? '#2c2632' : '#322c38');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      noisy(g, 0.06);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = Math.max(1, s / 24); g.strokeRect(0.5, 0.5, s - 1, s - 1);
      g.strokeStyle = 'rgba(255,255,255,.05)'; g.strokeRect(s / 24 + 1, s / 24 + 1, s - 3, s - 3);
      if (v === 2) { g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.arc(s * .3, s * .65, s * .12, 0, 7); g.fill(); }
      atlas.floor.push(c);
    }
    // wall: riveted iron block
    c = mk(s, s); g = c.getContext('2d');
    gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#6c7482'); gr.addColorStop(1, '#3b414e');
    g.fillStyle = gr; g.fillRect(0, 0, s, s); noisy(g, 0.1);
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, 0, s, s * .08); g.fillRect(0, 0, s * .06, s);
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, s * .92, s, s * .08); g.fillRect(s * .94, 0, s * .06, s);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = Math.max(1, s / 20); g.strokeRect(s * .14, s * .14, s * .72, s * .72);
    [[.2, .2], [.8, .2], [.2, .8], [.8, .8]].forEach(function (p) {
      var rg = g.createRadialGradient(s * p[0] - s * .02, s * p[1] - s * .02, 0, s * p[0], s * p[1], s * .07);
      rg.addColorStop(0, '#d8dde6'); rg.addColorStop(1, '#4a5060'); g.fillStyle = rg; g.beginPath(); g.arc(s * p[0], s * p[1], s * .06, 0, 7); g.fill();
    });
    atlas.wall = c;
    // crate: planked wood with iron straps
    atlas.crate = [];
    for (v = 0; v < 2; v++) {
      c = mk(s, s); g = c.getContext('2d');
      g.fillStyle = v ? '#a9753f' : '#b5803f'; g.fillRect(s * .04, s * .04, s * .92, s * .92);
      for (i = 0; i < 4; i++) { g.fillStyle = 'rgba(' + (i % 2 ? '0,0,0,.12' : '255,220,160,.1') + ')'; g.fillRect(s * .04, s * (.04 + i * .23), s * .92, s * .23); g.fillStyle = 'rgba(40,20,5,.55)'; g.fillRect(s * .04, s * (.04 + i * .23), s * .92, Math.max(1, s * .02)); }
      for (i = 0; i < 18; i++) { g.strokeStyle = 'rgba(60,30,8,.25)'; g.beginPath(); var yy = s * (.08 + h2(i, v) * .84), xx = s * (.08 + h2(v, i) * .6); g.moveTo(xx, yy); g.lineTo(xx + s * .2, yy + s * .01); g.stroke(); }
      g.strokeStyle = '#2d2118'; g.lineWidth = Math.max(2, s * .06); g.strokeRect(s * .07, s * .07, s * .86, s * .86);
      g.beginPath(); g.moveTo(s * .07, s * .07); g.lineTo(s * .93, s * .93); g.moveTo(s * .93, s * .07); g.lineTo(s * .07, s * .93); g.lineWidth = Math.max(2, s * .08); g.strokeStyle = 'rgba(45,33,24,.9)'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(s * .04, s * .04, s * .92, s * .04);
      atlas.crate.push(c);
    }
    // keg charge
    c = mk(s, s); g = c.getContext('2d');
    var kg = g.createLinearGradient(s * .2, 0, s * .8, 0); kg.addColorStop(0, '#222'); kg.addColorStop(.35, '#5a5f6b'); kg.addColorStop(1, '#14161a');
    g.fillStyle = kg; g.beginPath(); g.ellipse(s * .5, s * .56, s * .31, s * .33, 0, 0, 7); g.fill();
    g.strokeStyle = '#c9923a'; g.lineWidth = Math.max(2, s * .05); [.4, .56, .72].forEach(function (yy2) { g.beginPath(); g.ellipse(s * .5, s * yy2, s * .3, s * .07, 0, 0, Math.PI); g.stroke(); });
    g.fillStyle = '#ffd67a'; g.font = 'bold ' + Math.round(s * .28) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✹', s * .5, s * .56);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(s * .38, s * .42, s * .05, s * .12, .3, 0, 7); g.fill();
    atlas.keg = c;
    atlas.s = s;
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = window.innerWidth; vh = window.innerHeight;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    var touch = document.body.classList.contains('touch');
    topPad = vw < 560 ? 54 : 64; botPad = touch ? (vw > vh ? 0 : Math.min(190, vh * 0.26)) : 0;
    var sidePad = touch && vw > vh ? 0 : 0;
    var availW = vw - 8 - sidePad, availH = vh - topPad - botPad - 6;
    tile = Math.max(16, Math.floor(Math.min(availW / S.W, availH / S.H)));
    ox = Math.floor((vw - tile * S.W) / 2); oy = topPad + Math.floor((availH - tile * S.H) / 2) + 2;
    bake();
  }

  function addPart(x, y, vx, vy, life, size, col, kind) { if (parts.length < 600) parts.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, size: size, col: col, kind: kind || 'spark' }); }

  function handleEvent(e) {
    var px = (e.x + 0.5), py = (e.y + 0.5), i;
    if (e.t === 'boom') {
      shake = Math.min(14, shake + 6 + e.range); flash = 0.25;
      for (i = 0; i < 26; i++) { var a = Math.random() * 6.28, sp = 1 + Math.random() * 5; addPart(px, py, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.6, 0.1 + Math.random() * 0.12, i % 3 ? '255,170,50' : '255,235,160'); }
      for (i = 0; i < 8; i++) addPart(px, py, (Math.random() - 0.5) * 1.5, -0.5 - Math.random(), 1 + Math.random(), 0.3 + Math.random() * 0.3, '70,60,70', 'smoke');
    } else if (e.t === 'crate') {
      for (i = 0; i < 12; i++) addPart(px, py, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, 0.6, 0.07 + Math.random() * 0.07, '160,105,50', 'chip');
    } else if (e.t === 'flame') {
      for (i = 0; i < 3; i++) addPart(px, py, (Math.random() - 0.5) * 2, -1 - Math.random() * 2, 0.4, 0.06, '255,200,90');
    } else if (e.t === 'kill') {
      popups.push({ x: e.x, y: e.y, text: '+' + e.pts + (e.combo > 1 ? '  x' + e.combo : ''), t: 1.2 });
      for (i = 0; i < 16; i++) { var a2 = Math.random() * 6.28; addPart(e.x, e.y, Math.cos(a2) * 3, Math.sin(a2) * 3, 0.7, 0.08, '40,35,45', 'smoke'); }
    } else if (e.t === 'pickup') {
      for (i = 0; i < 14; i++) { var a3 = i / 14 * 6.28; addPart(px, py, Math.cos(a3) * 3, Math.sin(a3) * 3, 0.5, 0.06, '150,255,200'); }
    } else if (e.t === 'hurt') { shake = 10; flash = 0.4; }
    else if (e.t === 'ignite') { for (i = 0; i < 10; i++) addPart(px, py, (Math.random() - 0.5) * 3, -Math.random() * 3, 0.5, 0.07, '255,220,120'); }
  }

  function glow(x, y, r, col, a) {
    var g = cx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
    cx.fillStyle = g; cx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  var ICON = { range: ['#ff7a3d', '✸'], charge: ['#c9c9d6', '●'], speed: ['#6fd0ff', '»'], wick: ['#ffd36a', '∿'], life: ['#ff5d8f', '♥'] };

  function drawPickup(p, t) {
    var x = ox + (p.x + .5) * tile, y = oy + (p.y + .5) * tile + Math.sin(t * 4 + p.x) * tile * .05, ic = ICON[p.kind];
    glow(x, y, tile * .8, '255,230,150', 0.28);
    cx.fillStyle = '#1b1722'; cx.beginPath(); cx.arc(x, y, tile * .34, 0, 7); cx.fill();
    cx.strokeStyle = ic[0]; cx.lineWidth = Math.max(2, tile * .07); cx.stroke();
    cx.fillStyle = ic[0]; cx.font = 'bold ' + Math.round(tile * .42) + 'px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(ic[1], x, y + 1);
  }

  function drawWick(tiles, t, burning) {
    if (!tiles.length) return;
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    var i, a, pts = tiles.filter(function (q) { return q.state < 2; });
    // rope: dark base, tan twist
    for (var pass = 0; pass < 2; pass++) {
      cx.beginPath();
      pts.forEach(function (q, k) { var x = ox + (q.x + .5) * tile, y = oy + (q.y + .5) * tile; if (k === 0) cx.moveTo(x, y); else cx.lineTo(x, y); });
      if (pts.length === 1) { cx.lineTo(ox + (pts[0].x + .5) * tile + .1, oy + (pts[0].y + .5) * tile); }
      if (pass === 0) { cx.strokeStyle = '#1a120a'; cx.lineWidth = tile * .2; } else { cx.strokeStyle = '#d9c08a'; cx.lineWidth = tile * .12; cx.setLineDash([tile * .1, tile * .08]); }
      cx.stroke(); cx.setLineDash([]);
    }
    pts.forEach(function (q) {
      var x = ox + (q.x + .5) * tile, y = oy + (q.y + .5) * tile;
      if (q.state === 1) {
        var fl = 0.75 + 0.25 * Math.sin(t * 40 + q.x * 3);
        cx.globalCompositeOperation = 'lighter';
        glow(x, y, tile * 1.25 * fl, '255,150,40', 0.65);
        glow(x, y, tile * .55, '255,240,170', 0.9);
        cx.globalCompositeOperation = 'source-over';
        cx.fillStyle = '#ffeaa0'; cx.beginPath(); cx.ellipse(x, y - tile * .08, tile * .16 * fl, tile * .3 * fl, 0, 0, 7); cx.fill();
      } else if (q.igniteAt !== null) { cx.globalCompositeOperation = 'lighter'; glow(x, y, tile * .6, '255,200,80', 0.6); cx.globalCompositeOperation = 'source-over'; }
    });
  }

  function drawPlayer(p, t) {
    var x = ox + p.x * tile, y = oy + p.y * tile;
    if (!p.alive) return;
    if (p.inv > 0 && Math.floor(t * 14) % 2) cx.globalAlpha = 0.45;
    var bob = p.moving ? Math.sin(p.stepT * 9) * tile * .04 : 0, s = tile;
    cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(x, y + s * .34, s * .26, s * .1, 0, 0, 7); cx.fill();
    // legs
    var lp = p.moving ? Math.sin(p.stepT * 9) * s * .09 : 0;
    cx.fillStyle = '#3d2f5a'; cx.fillRect(x - s * .17, y + s * .16 + bob, s * .13, s * .18 + lp); cx.fillRect(x + s * .04, y + s * .16 + bob, s * .13, s * .18 - lp);
    // body
    var bg = cx.createLinearGradient(x - s * .25, 0, x + s * .25, 0); bg.addColorStop(0, '#e87a2c'); bg.addColorStop(1, '#a8481a');
    cx.fillStyle = bg; cx.beginPath(); cx.roundRect ? cx.roundRect(x - s * .25, y - s * .12 + bob, s * .5, s * .36, s * .1) : cx.rect(x - s * .25, y - s * .12 + bob, s * .5, s * .36); cx.fill();
    cx.fillStyle = '#d7b46a'; cx.fillRect(x - s * .25, y + s * .08 + bob, s * .5, s * .05); // belt
    // head w/ helmet
    cx.fillStyle = '#f0c9a0'; cx.beginPath(); cx.arc(x, y - s * .2 + bob, s * .2, 0, 7); cx.fill();
    cx.fillStyle = '#c9a23a'; cx.beginPath(); cx.arc(x, y - s * .25 + bob, s * .22, Math.PI, 0); cx.fill(); cx.fillRect(x - s * .25, y - s * .26 + bob, s * .5, s * .05);
    // goggles
    var fx = [1, 0, -1, 0][p.dir] * s * .05, fy = [0, 1, 0, -1][p.dir] * s * .03;
    if (p.dir !== 3) {
      cx.fillStyle = '#243247'; cx.fillRect(x - s * .15 + fx, y - s * .22 + bob + fy, s * .3, s * .1);
      cx.fillStyle = '#9be8ff'; cx.fillRect(x - s * .12 + fx, y - s * .2 + bob + fy, s * .09, s * .06); cx.fillRect(x + s * .03 + fx, y - s * .2 + bob + fy, s * .09, s * .06);
    }
    // wick spool on back
    cx.fillStyle = '#d9c08a'; cx.beginPath(); cx.arc(x - [1, 0, -1, 0][p.dir] * s * .2, y + s * .02 + bob, s * .09, 0, 7); cx.fill();
    cx.globalAlpha = 1;
  }

  function drawEnemy(e, t) {
    var x = ox + e.x * tile, y = oy + e.y * tile, s = tile;
    if (!e.alive) { cx.globalAlpha = Math.max(0, e.dying / .5); s = tile * (1 + (0.5 - e.dying)); }
    var hunter = e.kind === 'hunter', wob = Math.sin(t * 8 + e.x * 2) * .05;
    cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(x, y + s * .32, s * .28, s * .09, 0, 0, 7); cx.fill();
    var g = cx.createRadialGradient(x - s * .1, y - s * .15, 0, x, y, s * .4);
    g.addColorStop(0, hunter ? '#a2285a' : '#58506a'); g.addColorStop(1, hunter ? '#3a0f26' : '#1e1a28');
    cx.fillStyle = g; cx.beginPath(); cx.ellipse(x, y + s * .05, s * (.3 + wob), s * (.31 - wob), 0, 0, 7); cx.fill();
    // tufts
    cx.fillStyle = hunter ? '#3a0f26' : '#1e1a28';
    for (var i = -1; i <= 1; i++) { cx.beginPath(); cx.moveTo(x + i * s * .14 - s * .06, y - s * .2); cx.lineTo(x + i * s * .14, y - s * .38 - Math.sin(t * 6 + i) * s * .03); cx.lineTo(x + i * s * .14 + s * .06, y - s * .2); cx.fill(); }
    // eyes
    cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x - s * .1, y - s * .02, s * .08, 0, 7); cx.arc(x + s * .1, y - s * .02, s * .08, 0, 7); cx.fill();
    cx.fillStyle = hunter ? '#ff2d55' : '#111'; var lx = (e.tx + .5 - e.x) * s * .1, ly = (e.ty + .5 - e.y) * s * .1;
    cx.beginPath(); cx.arc(x - s * .1 + lx, y - s * .02 + ly, s * .035, 0, 7); cx.arc(x + s * .1 + lx, y - s * .02 + ly, s * .035, 0, 7); cx.fill();
    if (hunter) { cx.strokeStyle = '#ff2d55'; cx.lineWidth = s * .04; cx.beginPath(); cx.moveTo(x - s * .2, y - s * .13); cx.lineTo(x - s * .02, y - s * .07); cx.moveTo(x + s * .2, y - s * .13); cx.lineTo(x + s * .02, y - s * .07); cx.stroke(); }
    cx.globalAlpha = 1;
  }

  function draw(g, t) {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = '#120f16'; cx.fillRect(0, 0, vw, vh);
    var sx = shake > 0.1 ? (Math.random() - .5) * shake : 0, sy = shake > 0.1 ? (Math.random() - .5) * shake : 0;
    shake *= 0.88;
    cx.save(); cx.translate(sx, sy);
    var x, y, i, tl = atlas.s;
    // board backing frame
    cx.fillStyle = '#07060a'; cx.fillRect(ox - 6, oy - 6, tile * S.W + 12, tile * S.H + 12);
    for (y = 0; y < S.H; y++) for (x = 0; x < S.W; x++) {
      var tt = g.tiles[y][x], px = ox + x * tile, py = oy + y * tile;
      cx.drawImage(atlas.floor[(x * 7 + y * 13) % 4], px, py, tile, tile);
      if (tt === S.T_WALL) cx.drawImage(atlas.wall, px, py, tile, tile);
    }
    // exit
    if (g.exitRevealed) {
      var ex = ox + (g.exit.x + .5) * tile, ey = oy + (g.exit.y + .5) * tile, open = g.exitOpen;
      cx.fillStyle = '#050407'; cx.beginPath(); cx.ellipse(ex, ey, tile * .38, tile * .38, 0, 0, 7); cx.fill();
      cx.strokeStyle = open ? '#7dffb2' : '#7a7080'; cx.lineWidth = tile * .08; cx.stroke();
      if (open) { cx.globalCompositeOperation = 'lighter'; glow(ex, ey, tile * (1.2 + Math.sin(t * 5) * .2), '90,255,170', 0.5); cx.globalCompositeOperation = 'source-over'; }
      else { cx.fillStyle = '#7a7080'; cx.font = 'bold ' + Math.round(tile * .3) + 'px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('🔒', ex, ey); }
    }
    g.pickups.forEach(function (p) { drawPickup(p, t); });
    // wicks beneath actors
    g.fuses.forEach(function (f) { drawWick(f.tiles, t); });
    drawWick(g.player.wick, t);
    // charges
    g.charges.forEach(function (c) {
      var px2 = ox + c.x * tile, py2 = oy + c.y * tile, pulse = 1 + Math.sin(t * 6 + c.x) * .03;
      cx.drawImage(atlas.keg, px2 - tile * (pulse - 1) / 2, py2 - tile * (pulse - 1) / 2, tile * pulse, tile * pulse);
      var dang = c.age > 10 ? Math.floor(t * 12) % 2 : 0;
      if (dang) { cx.fillStyle = 'rgba(255,60,40,.35)'; cx.fillRect(px2, py2, tile, tile); }
    });
    // crates over everything on the floor layer
    for (y = 0; y < S.H; y++) for (x = 0; x < S.W; x++) if (g.tiles[y][x] === S.T_CRATE) cx.drawImage(atlas.crate[(x + y) % 2], ox + x * tile, oy + y * tile, tile, tile);
    // actors, sorted by y
    var acts = []; g.enemies.forEach(function (e) { acts.push([e.y, function () { drawEnemy(e, t); }]); }); acts.push([g.player.y, function () { drawPlayer(g.player, t); }]);
    acts.sort(function (a, b) { return a[0] - b[0]; }).forEach(function (a) { a[1](); });
    // blasts (additive)
    cx.globalCompositeOperation = 'lighter';
    g.blasts.forEach(function (b) {
      var k = b.life / b.max, bx = ox + (b.x + .5) * tile, by = oy + (b.y + .5) * tile;
      glow(bx, by, tile * (1.0 + (1 - k) * .8), '255,140,40', .9 * k);
      glow(bx, by, tile * .6 * k + 2, '255,245,200', k);
    });
    cx.globalCompositeOperation = 'source-over';
    // particles
    var dt = 1 / 60;
    for (i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy = p.vy * 0.97 + (p.kind === 'smoke' ? -0.02 : 0.08);
      var a = p.life / p.max, px3 = ox + p.x * tile, py3 = oy + p.y * tile;
      if (p.kind === 'smoke') { cx.fillStyle = 'rgba(' + p.col + ',' + (a * .5).toFixed(2) + ')'; cx.beginPath(); cx.arc(px3, py3, tile * p.size * (2 - a), 0, 7); cx.fill(); }
      else { cx.globalCompositeOperation = p.kind === 'spark' ? 'lighter' : 'source-over'; cx.fillStyle = 'rgba(' + p.col + ',' + a.toFixed(2) + ')'; cx.fillRect(px3, py3, tile * p.size, tile * p.size); cx.globalCompositeOperation = 'source-over'; }
    }
    // popups
    cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.font = '800 ' + Math.round(tile * .5) + 'px system-ui,sans-serif';
    for (i = popups.length - 1; i >= 0; i--) {
      var q = popups[i]; q.t -= dt; if (q.t <= 0) { popups.splice(i, 1); continue; }
      var py4 = oy + (q.y - (1.2 - q.t) * 1.2) * tile, px4 = ox + q.x * tile;
      cx.globalAlpha = Math.min(1, q.t * 2); cx.lineWidth = 4; cx.strokeStyle = '#000'; cx.strokeText(q.text, px4, py4); cx.fillStyle = '#ffd36a'; cx.fillText(q.text, px4, py4); cx.globalAlpha = 1;
    }
    cx.restore();
    // vignette + flash
    var vg = cx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * .35, vw / 2, vh / 2, Math.max(vw, vh) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); cx.fillStyle = vg; cx.fillRect(0, 0, vw, vh);
    if (flash > 0) { cx.fillStyle = 'rgba(255,220,160,' + (flash * .5).toFixed(2) + ')'; cx.fillRect(0, 0, vw, vh); flash -= 0.03; }
  }

  WK.render = {
    init: function (canvas) { cv = canvas; cx = cv.getContext('2d'); resize(); window.addEventListener('resize', resize); window.addEventListener('orientationchange', function () { setTimeout(resize, 120); }); },
    resize: resize, draw: draw, event: handleEvent,
    reset: function () { parts.length = 0; popups.length = 0; },
    layout: function () { return { ox: ox, oy: oy, tile: tile }; }
  };
})();
