/* SHIFTWICK renderer: procedural candle-lit crypt. */
(function (g) {
  'use strict';
  var SW = g.SW, W = SW.W, H = SW.H;
  var R = SW.Render = {};
  var cv, ctx, T = 32, ox = 0, oy = 0, vw = 0, vh = 0, dpr = 1, tex = null, parts = [], shake = 0, floaters = [];
  var SHADE_COL = ['#ff5a6e', '#8f7bff', '#3fd0c9', '#ffb23f'];

  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function bakeTextures() {
    var S = 64, wall = mk(S, S), floor = mk(S, S), x, y, c;
    c = wall.getContext('2d');
    var gr = c.createLinearGradient(0, 0, S, S); gr.addColorStop(0, '#2c2540'); gr.addColorStop(1, '#1a1528');
    c.fillStyle = gr; c.fillRect(0, 0, S, S);
    var r = SW.rng(77);
    for (y = 0; y < 2; y++) for (x = 0; x < 2; x++) { // bricks
      var bx = x * 32 + (y ? -10 : 0);
      for (var k = 0; k < 3; k++) { var X = bx + k * 32, Y = y * 32; c.fillStyle = 'rgba(' + (60 + r() * 30 | 0) + ',' + (50 + r() * 20 | 0) + ',' + (90 + r() * 30 | 0) + ',.55)'; c.fillRect(X + 1.5, Y + 1.5, 29, 29); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(X + 1.5, Y + 1.5, 29, 3); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(X + 1.5, Y + 27, 29, 3); }
    }
    for (var i = 0; i < 260; i++) { c.fillStyle = 'rgba(0,0,0,' + r() * .18 + ')'; c.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
    c = floor.getContext('2d'); c.fillStyle = '#0d0a14'; c.fillRect(0, 0, S, S);
    for (i = 0; i < 180; i++) { c.fillStyle = 'rgba(' + (40 + r() * 30 | 0) + ',' + (30 + r() * 20 | 0) + ',' + (60 + r() * 30 | 0) + ',' + r() * .25 + ')'; c.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3); }
    c.strokeStyle = 'rgba(120,100,170,.10)'; c.strokeRect(.5, .5, S - 1, S - 1);
    tex = { wall: wall, floor: floor };
  }

  R.init = function (canvas) { cv = canvas; ctx = cv.getContext('2d'); bakeTextures(); R.resize(); };
  R.resize = function () {
    dpr = Math.min(2, g.devicePixelRatio || 1);
    vw = cv.clientWidth; vh = cv.clientHeight;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    var portrait = vh > vw;
    var hudTop = Math.max(54, vh * 0.075), hudBot = portrait ? Math.min(150, vh * 0.2) : 8;
    var availW = vw - (portrait ? 8 : 16), availH = vh - hudTop - hudBot - 8;
    T = Math.max(8, Math.floor(Math.min(availW / W, availH / H) * 4) / 4);
    ox = Math.round((vw - T * W) / 2); oy = Math.round(hudTop + (availH - T * H) / 2 + 4);
    R.layout = { T: T, ox: ox, oy: oy, vw: vw, vh: vh };
  };
  R.shake = function (a) { shake = Math.max(shake, a); };
  function burst(x, y, n, col, sp, life) { for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = (0.3 + Math.random()) * sp; parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * .3, life: life * (.5 + Math.random() * .7), max: life, col: col, r: 1 + Math.random() * 2 }); } }
  R.event = function (e) {
    if (e.type === 'ember') burst(e.x + .5, e.y + .5, 3, '#ffb347', 2.2, .45);
    else if (e.type === 'power') { burst(e.x + .5, e.y + .5, 28, '#fff2b0', 5, .8); shake = 3; }
    else if (e.type === 'snuff') { burst(e.x + .5, e.y + .5, 34, '#b9a7ff', 6, .9); floaters.push({ x: e.x + .5, y: e.y, t: 0, txt: '+' + e.pts }); shake = 5; }
    else if (e.type === 'die') { burst(e.x + .5, e.y + .5, 60, '#ffcf70', 7, 1.3); shake = 10; }
    else if (e.type === 'shift') { shake = 4; }
    else if (e.type === 'clear') { for (var i = 0; i < 6; i++) burst(Math.random() * W, Math.random() * H, 20, '#ffd76e', 5, 1.2); }
  };

  function sc(x, y) { return [ox + x * T, oy + y * T]; }

  function drawTile(s, x, y, dx, dy, lit) {
    var X = ox + (x + dx) * T, Y = oy + (y + dy) * T;
    if (s.wall[y][x]) {
      ctx.drawImage(tex.wall, X, Y, T + .5, T + .5);
      var up = y > 0 && !s.wall[y - 1][x];
      if (up) { ctx.fillStyle = 'rgba(255,200,130,' + (.18 * lit) + ')'; ctx.fillRect(X, Y, T, Math.max(1.5, T * .08)); }
      ctx.fillStyle = 'rgba(160,130,255,.06)'; ctx.fillRect(X, Y, T, T);
    } else {
      ctx.drawImage(tex.floor, X, Y, T + .5, T + .5);
      var v = s.pel[y][x];
      if (v === 1) {
        var fl = .75 + .25 * Math.sin(s.time * 6 + x * 1.7 + y * 2.3), cx = X + T / 2, cy = Y + T / 2, r = T * .1;
        var gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3.2); gg.addColorStop(0, 'rgba(255,170,60,' + (.55 * fl) + ')'); gg.addColorStop(1, 'rgba(255,120,20,0)');
        ctx.fillStyle = gg; ctx.fillRect(cx - r * 3.2, cy - r * 3.2, r * 6.4, r * 6.4);
        ctx.fillStyle = '#ffd88a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
      } else if (v === 2) {
        var pr = T * (.27 + .05 * Math.sin(s.time * 7)), cx2 = X + T / 2, cy2 = Y + T / 2;
        var g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, pr * 2.6); g2.addColorStop(0, 'rgba(255,255,255,.95)'); g2.addColorStop(.3, 'rgba(160,230,255,.7)'); g2.addColorStop(1, 'rgba(80,160,255,0)');
        ctx.fillStyle = g2; ctx.fillRect(cx2 - pr * 2.6, cy2 - pr * 2.6, pr * 5.2, pr * 5.2);
      }
    }
  }

  function actorPos(a) { return [a.tx + a.dx * a.t + .5, a.ty + a.dy * a.t + .5]; }

  function drawPlayer(s, a, lineOff) {
    var p = actorPos(a), X = ox + (p[0] + lineOff[0]) * T, Y = oy + (p[1] + lineOff[1]) * T;
    var dead = s.p.dead > 0, k = dead ? Math.max(0, s.p.dead / 1.4) : 1;
    var flick = 1 + .08 * Math.sin(s.time * 18) + .05 * Math.sin(s.time * 31);
    var rr = T * .62 * flick * k;
    var gl = ctx.createRadialGradient(X, Y, 0, X, Y, T * 3.4 * k); gl.addColorStop(0, 'rgba(255,200,100,.55)'); gl.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = gl; ctx.fillRect(X - T * 3.4, Y - T * 3.4, T * 6.8, T * 6.8);
    ctx.save(); ctx.translate(X, Y + T * .06); ctx.scale(k, k);
    // body: teardrop flame
    var sway = Math.sin(s.time * 9) * T * .04 + (a.dx || 0) * T * .05;
    var bg = ctx.createLinearGradient(0, -rr, 0, rr * .7); bg.addColorStop(0, '#fff6c8'); bg.addColorStop(.4, '#ffc247'); bg.addColorStop(1, '#ff6a1a');
    ctx.fillStyle = bg; ctx.beginPath();
    ctx.moveTo(sway, -rr * 1.15);
    ctx.bezierCurveTo(rr * .9, -rr * .35, rr * .85, rr * .75, 0, rr * .78);
    ctx.bezierCurveTo(-rr * .85, rr * .75, -rr * .9, -rr * .35, sway, -rr * 1.15); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.globalAlpha = .55; ctx.beginPath(); ctx.ellipse(0, rr * .2, rr * .32, rr * .42, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
    // eyes
    var ex = (a.dx || 0) * rr * .14, ey = (a.dy || 0) * rr * .12;
    ctx.fillStyle = '#2a1206'; ctx.beginPath(); ctx.ellipse(-rr * .25 + ex, rr * .05 + ey, rr * .09, rr * .15, 0, 0, 6.283); ctx.ellipse(rr * .25 + ex, rr * .05 + ey, rr * .09, rr * .15, 0, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  function drawShade(s, a, lineOff) {
    if (a.state === 'den' && false) return;
    var p = actorPos(a), X = ox + (p[0] + lineOff[0]) * T, Y = oy + (p[1] + lineOff[1]) * T, rr = T * .46;
    var col = SHADE_COL[a.id], dazed = a.dazed > 0, eyes = a.state === 'eyes';
    var blink = dazed && a.dazed < 1.4 && Math.floor(s.time * 8) % 2 === 0;
    if (!eyes) {
      var body = dazed ? (blink ? '#e8f4ff' : '#4a60d8') : col;
      var gl = ctx.createRadialGradient(X, Y, 0, X, Y, T * 1.5); gl.addColorStop(0, dazed ? 'rgba(120,150,255,.35)' : col + '66'); gl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gl; ctx.fillRect(X - T * 1.5, Y - T * 1.5, T * 3, T * 3);
      ctx.fillStyle = body; ctx.beginPath();
      ctx.arc(X, Y - rr * .1, rr, Math.PI, 0);
      var wob = Math.sin(s.time * 10 + a.id) * rr * .12;
      ctx.lineTo(X + rr, Y + rr * .9);
      for (var i = 0; i < 4; i++) { var xx = X + rr - (i + .5) * rr * .5; ctx.quadraticCurveTo(xx + rr * .12, Y + rr * (.55 + (i % 2 ? .0 : .0)) + wob * (i % 2 ? 1 : -1), X + rr - (i + 1) * rr * .5, Y + rr * .9); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(X - rr * .25, Y - rr * .45, rr * .35, rr * .22, -.5, 0, 6.283); ctx.fill();
    }
    var lx = (a.dx || 0) * rr * .12, ly = (a.dy || 0) * rr * .1;
    if (dazed && !eyes) { ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, T * .06); ctx.beginPath(); ctx.moveTo(X - rr * .5, Y - rr * .1); ctx.lineTo(X - rr * .15, Y + rr * .1); ctx.moveTo(X + rr * .5, Y - rr * .1); ctx.lineTo(X + rr * .15, Y + rr * .1); ctx.stroke(); }
    else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(X - rr * .34, Y - rr * .12, rr * .22, rr * .28, 0, 0, 6.283); ctx.ellipse(X + rr * .34, Y - rr * .12, rr * .22, rr * .28, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = eyes ? '#9fe' : '#111'; ctx.beginPath(); ctx.arc(X - rr * .34 + lx * 2, Y - rr * .1 + ly * 2, rr * .1, 0, 6.283); ctx.arc(X + rr * .34 + lx * 2, Y - rr * .1 + ly * 2, rr * .1, 0, 6.283); ctx.fill(); }
  }

  R.draw = function (s, ui) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#06040b'; ctx.fillRect(0, 0, vw, vh);
    var sx = 0, sy = 0; if (shake > .1) { sx = (Math.random() - .5) * shake; sy = (Math.random() - .5) * shake; shake *= .88; }
    ctx.save(); ctx.translate(sx, sy);
    var an = s && s.anim, x, y;
    var off = an ? -(1 - ease(an.t)) * an.dir : 0;
    // board background glow
    ctx.fillStyle = '#0b0813'; ctx.fillRect(ox - 6, oy - 6, T * W + 12, T * H + 12);
    if (s) {
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        if (an && ((an.axis === 'row' && y === an.idx && x > 0 && x < W - 1) || (an.axis === 'col' && x === an.idx && y > 0 && y < H - 1))) continue;
        drawTile(s, x, y, 0, 0, 1);
      }
      if (an) {
        ctx.save(); ctx.beginPath();
        if (an.axis === 'row') ctx.rect(ox + T, oy + an.idx * T, T * (W - 2), T); else ctx.rect(ox + an.idx * T, oy + T, T, T * (H - 2));
        ctx.clip();
        var n = an.axis === 'row' ? W - 2 : H - 2;
        for (var i = 1; i <= n; i++) for (var w = -1; w <= 1; w++) {
          var o = off + w * n;
          if (an.axis === 'row') drawTile(s, i, an.idx, o, 0, 1); else drawTile(s, an.idx, i, 0, o, 1);
        }
        // motion streaks
        ctx.fillStyle = 'rgba(255,220,160,' + (.25 * (1 - an.t)) + ')';
        if (an.axis === 'row') ctx.fillRect(ox + T, oy + an.idx * T, T * (W - 2), T); else ctx.fillRect(ox + an.idx * T, oy + T, T, T * (H - 2));
        ctx.restore();
      }
      // actors
      var lineOff = function (a) {
        if (!an) return [0, 0];
        var tx = a.tx, ty = a.ty;
        if (an.axis === 'row' && ty === an.idx) return [off, 0];
        if (an.axis === 'col' && tx === an.idx) return [0, off];
        return [0, 0];
      };
      s.shades.forEach(function (a) { if (a.state === 'den' || true) drawShade(s, a, lineOff(a)); });
      drawPlayer(s, s.p, lineOff(s.p));
      // lantern darkness
      var pp = actorPos(s.p), PX = ox + pp[0] * T, PY = oy + pp[1] * T;
      var dk = ctx.createRadialGradient(PX, PY, T * 2.5, PX, PY, T * 11); dk.addColorStop(0, 'rgba(4,2,10,0)'); dk.addColorStop(1, 'rgba(4,2,10,.72)');
      ctx.fillStyle = dk; ctx.fillRect(ox, oy, T * W, T * H);
      // selected-line hint
      if (ui && ui.armed) {
        ctx.fillStyle = 'rgba(255,214,120,.12)'; ctx.fillRect(ox + T, oy + s.p.ty * T, T * (W - 2), T); ctx.fillRect(ox + s.p.tx * T, oy + T, T, T * (H - 2));
        ctx.strokeStyle = 'rgba(255,214,120,.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(ox + T + .5, oy + s.p.ty * T + .5, T * (W - 2) - 1, T - 1); ctx.strokeRect(ox + s.p.tx * T + .5, oy + T + .5, T - 1, T * (H - 2) - 1);
      }
    }
    // particles
    var dt = 1 / 60;
    for (i = parts.length - 1; i >= 0; i--) {
      var q = parts[i]; q.life -= dt; if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 6 * dt;
      ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(ox + q.x * T, oy + q.y * T, q.r * (T / 28), 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (i = floaters.length - 1; i >= 0; i--) {
      var f = floaters[i]; f.t += dt; if (f.t > 1.1) { floaters.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - f.t / 1.1; ctx.fillStyle = '#e6dcff'; ctx.font = 'bold ' + Math.round(T * .6) + 'px system-ui,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(f.txt, ox + f.x * T, oy + (f.y - f.t * 1.2) * T);
    }
    ctx.globalAlpha = 1; ctx.restore();
    // board frame + vignette
    ctx.strokeStyle = 'rgba(255,190,110,.35)'; ctx.lineWidth = 2; ctx.strokeRect(ox - 1, oy - 1, T * W + 2, T * H + 2);
    var vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * .4, vw / 2, vh / 2, Math.max(vw, vh) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
  };
  function ease(t) { return 1 - Math.pow(1 - Math.min(1, t), 3); }
})(window);
