/* Shiftwick - canvas renderer. All art procedural. Exposes window.SWRender. */
(function (root) {
  'use strict';
  var SW = root.SW, R = root.SWRender = {};
  var W = SW.W, H = SW.H, DIRS = SW.DIRS;
  var particles = [], floaters = [], shake = 0, flash = 0;
  var floorTex = null, floorTs = 0, vignette = null, vigKey = '';
  var GHOST_COL = { gloam: '#ff4d3d', murk: '#ff7ad9', dusk: '#4fd6ff', fret: '#ffb347' };

  R.layout = function (cw, ch, touch) {
    var top = 70, bottom = touch ? 132 : 40;
    var availH = ch - top - bottom, availW = cw - 12;
    var ts = Math.floor(Math.min(availW / W, availH / H));
    if (ts < 8) ts = Math.max(8, Math.floor(Math.min(availW / W, (ch - top - 8) / H)));
    var ox = Math.floor((cw - ts * W) / 2), oy = top + Math.max(0, Math.floor((availH - ts * H) / 2));
    return { ts: ts, ox: ox, oy: oy, cw: cw, ch: ch };
  };

  function bakeFloor(ts) {
    var c = document.createElement('canvas'); c.width = ts * 4; c.height = ts * 4;
    var g = c.getContext('2d');
    g.fillStyle = '#100a08'; g.fillRect(0, 0, c.width, c.height);
    for (var i = 0; i < 380; i++) {
      var x = Math.random() * c.width, y = Math.random() * c.height, a = Math.random() * 0.06;
      g.fillStyle = 'rgba(255,200,140,' + a + ')'; g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    g.strokeStyle = 'rgba(255,170,80,0.05)'; g.lineWidth = 1;
    for (var k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * ts + .5, 0); g.lineTo(k * ts + .5, c.height); g.moveTo(0, k * ts + .5); g.lineTo(c.width, k * ts + .5); g.stroke(); }
    floorTex = c; floorTs = ts;
  }

  R.event = function (ev, v, s) {
    var ts = v.ts;
    function pos(c, r) { return { x: v.ox + (c + .5) * ts, y: v.oy + (r + .5) * ts }; }
    if (ev.t === 'mote') { var p0 = pos(s.player.x, s.player.y); burst(p0.x, p0.y, 3, '#ffe39a', ts * 0.12, 0.35); }
    else if (ev.t === 'ember') { var p1 = pos(s.player.x, s.player.y); burst(p1.x, p1.y, 26, '#ff8a3c', ts * 0.4, 0.8); flash = 0.25; }
    else if (ev.t === 'ghost') { var g = s.ghosts.filter(function (q) { return q.mode === 'eaten'; })[0]; if (g) { var p2 = pos(g.x, g.y); burst(p2.x, p2.y, 30, '#7fd8ff', ts * 0.5, 0.9); } shake = 6; }
    else if (ev.t === 'die') { var p3 = pos(s.player.x, s.player.y); burst(p3.x, p3.y, 50, '#ffb347', ts * 0.6, 1.2); shake = 12; }
    else if (ev.t === 'slide') shake = 9;
    else if (ev.t === 'score' && ev.why !== 'mote' && ev.x != null) { var p4 = pos(ev.x, ev.y); floaters.push({ x: p4.x, y: p4.y, t: 0, txt: '+' + ev.n, big: ev.why !== 'ember' }); }
    else if (ev.t === 'clear') flash = 0.5;
  };
  function burst(x, y, n, col, speed, life) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, sp = speed * (0.3 + Math.random() * 1.6) * 6;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: life * (0.5 + Math.random() * 0.7), t: 0, col: col, r: 1 + Math.random() * 2.5 });
    }
    if (particles.length > 600) particles.splice(0, particles.length - 600);
  }

  function ease(t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); }

  R.draw = function (ctx, s, v, time, dt) {
    var ts = v.ts, ox = v.ox, oy = v.oy, cw = v.cw, ch = v.ch;
    if (floorTs !== ts) bakeFloor(ts);
    // background
    var bg = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.1, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    bg.addColorStop(0, '#1a0f09'); bg.addColorStop(1, '#050304');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    if (shake > 0.2) { ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake *= Math.pow(0.001, dt); }
    var sh = s.shift, slideE = 1;
    if (sh && sh.phase === 'slide') slideE = ease(sh.t / sh.dur);
    function lineOffset(axis, idx) { // offset in tiles for a tile on the sliding line
      if (!sh || sh.phase !== 'slide' || sh.axis !== axis || sh.index !== idx) return 0;
      return -sh.dir * (1 - slideE);
    }
    // board plate
    ctx.fillStyle = ctx.createPattern(floorTex, 'repeat');
    ctx.fillRect(ox, oy, ts * W, ts * H);
    // light pools from player + embers (additive)
    ctx.globalCompositeOperation = 'lighter';
    var px = ox + (s.player.x + .5) * ts, py = oy + (s.player.y + .5) * ts;
    var flick = 0.85 + 0.15 * Math.sin(time * 17) + 0.05 * Math.sin(time * 31);
    var lg = ctx.createRadialGradient(px, py, 0, px, py, ts * 7 * flick);
    lg.addColorStop(0, 'rgba(255,150,60,0.38)'); lg.addColorStop(1, 'rgba(255,100,20,0)');
    ctx.fillStyle = lg; ctx.fillRect(ox, oy, ts * W, ts * H);
    ctx.globalCompositeOperation = 'source-over';

    // walls: fill + edges (clip to board)
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy, ts * W, ts * H); ctx.clip();
    var r, c, cell, edge = new Path2D(), wallsDrawn = 0;
    for (r = 0; r < H; r++) for (c = 0; c < W; c++) {
      cell = s.cells[r][c];
      var offs = [0];
      var isRowLine = sh && sh.phase === 'slide' && sh.axis === 'row' && sh.index === r && c >= 1 && c <= W - 2;
      var isColLine = sh && sh.phase === 'slide' && sh.axis === 'col' && sh.index === c && r >= 1 && r <= H - 2;
      var dx = 0, dy = 0;
      if (isRowLine) { dx = lineOffset('row', r); offs = [0, dx > 0 ? -(W - 2) : (W - 2)]; }
      if (isColLine) { dy = lineOffset('col', c); offs = [0, dy > 0 ? -(H - 2) : (H - 2)]; }
      for (var oi = 0; oi < offs.length; oi++) {
        var tx = c + (isRowLine ? dx + (oi ? offs[1] : 0) : 0), ty = r + (isColLine ? dy + (oi ? offs[1] : 0) : 0);
        if (isRowLine && (tx < 0.5 - 1 || tx > W - 1.5 + 1)) continue;
        if (isColLine && (ty < 0.5 - 1 || ty > H - 1.5 + 1)) continue;
        if (oi && isRowLine && (tx < 0 || tx > W - 1)) continue;
        var x = ox + tx * ts, y = oy + ty * ts;
        if (cell.w) {
          wallsDrawn++;
          ctx.fillStyle = '#2a1a10'; ctx.fillRect(x, y, ts + .5, ts + .5);
          ctx.fillStyle = 'rgba(255,190,110,0.06)'; ctx.fillRect(x + ts * .12, y + ts * .12, ts * .76, ts * .76);
          // edges toward floor
          var ew = function (cc, rr) { return cc < 0 || cc >= W || rr < 0 || rr >= H || s.cells[rr][cc].w; };
          if (!ew(c, r - 1)) { edge.moveTo(x, y + .5); edge.lineTo(x + ts, y + .5); }
          if (!ew(c, r + 1)) { edge.moveTo(x, y + ts - .5); edge.lineTo(x + ts, y + ts - .5); }
          if (!ew(c - 1, r)) { edge.moveTo(x + .5, y); edge.lineTo(x + .5, y + ts); }
          if (!ew(c + 1, r)) { edge.moveTo(x + ts - .5, y); edge.lineTo(x + ts - .5, y + ts); }
        } else if (cell.item) {
          var cx = x + ts / 2, cy = y + ts / 2;
          if (cell.item === 1) {
            var gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, ts * .3);
            gl.addColorStop(0, 'rgba(255,240,180,.95)'); gl.addColorStop(.4, 'rgba(255,200,100,.55)'); gl.addColorStop(1, 'rgba(255,160,60,0)');
            ctx.fillStyle = gl; ctx.fillRect(cx - ts * .3, cy - ts * .3, ts * .6, ts * .6);
          } else {
            var pr = ts * (.28 + .06 * Math.sin(time * 6));
            var eg = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr * 1.8);
            eg.addColorStop(0, '#fff6d0'); eg.addColorStop(.35, '#ff9a3c'); eg.addColorStop(1, 'rgba(255,80,20,0)');
            ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(cx, cy, pr * 1.8, 0, 6.283); ctx.fill();
          }
        }
      }
    }
    // telegraph band
    if (sh && sh.phase === 'warn') {
      var pulse = 0.5 + 0.5 * Math.sin(time * 14), k = sh.t / sh.dur;
      ctx.fillStyle = 'rgba(91,227,208,' + (0.1 + 0.18 * pulse * (0.4 + k)) + ')';
      if (sh.axis === 'row') ctx.fillRect(ox + ts, oy + sh.index * ts, ts * (W - 2), ts);
      else ctx.fillRect(ox + sh.index * ts, oy + ts, ts, ts * (H - 2));
      ctx.fillStyle = 'rgba(160,255,240,' + (0.5 + 0.5 * pulse) + ')';
      var n = sh.axis === 'row' ? W - 2 : H - 2;
      for (var i = 0; i < n; i += 2) {
        var ph = ((time * 3 * sh.dir) % 2 + 2) % 2, cp = i + ph;
        var ax = sh.axis === 'row' ? ox + (1 + cp + .5) * ts : ox + (sh.index + .5) * ts;
        var ay = sh.axis === 'row' ? oy + (sh.index + .5) * ts : oy + (1 + cp + .5) * ts;
        if (cp >= n) continue;
        arrow(ctx, ax, ay, ts * .22, sh.axis === 'row' ? (sh.dir > 0 ? 'right' : 'left') : (sh.dir > 0 ? 'down' : 'up'));
      }
    }
    ctx.restore();
    // wall edge glow (two passes), clipped
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, ts * W, ts * H); ctx.clip();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(255,140,40,0.22)'; ctx.lineWidth = Math.max(4, ts * .34); ctx.stroke(edge);
    ctx.strokeStyle = 'rgba(255,190,100,0.95)'; ctx.lineWidth = Math.max(1.5, ts * .09); ctx.stroke(edge);
    ctx.restore();
    // ghost-house door
    var dr = SW.HOUSE.door;
    ctx.fillStyle = 'rgba(255,120,200,.8)'; ctx.fillRect(ox + dr.c * ts + 1, oy + dr.r * ts + ts * .42, ts - 2, ts * .16);

    // fruit
    if (s.fruit) drawFruit(ctx, ox + (s.fruit.c + .5) * ts, oy + (s.fruit.r + .5) * ts, ts, s.fruit.kind, time);
    // actors
    function actorXY(e) {
      var x = e.x, y = e.y;
      if (sh && sh.phase === 'slide') {
        var rr = Math.round(e.y), cc = Math.round(e.x);
        if (sh.axis === 'row' && rr === sh.index) x += lineOffset('row', rr);
        if (sh.axis === 'col' && cc === sh.index) y += lineOffset('col', cc);
      }
      return { x: ox + (x + .5) * ts, y: oy + (y + .5) * ts };
    }
    s.ghosts.forEach(function (g) { var p = actorXY(g); drawGhost(ctx, g, p.x, p.y, ts, time, s); });
    var pp = actorXY(s.player);
    if (s.status !== 'dying') drawPlayer(ctx, s.player, pp.x, pp.y, ts, time, s);
    else drawDying(ctx, pp.x, pp.y, ts, s);

    // particles / floaters
    for (var pi = particles.length - 1; pi >= 0; pi--) {
      var q = particles[pi]; q.t += dt; if (q.t > q.life) { particles.splice(pi, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96;
      ctx.globalAlpha = 1 - q.t / q.life; ctx.fillStyle = q.col;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.font = 'bold ' + Math.round(ts * .7) + 'px Georgia,serif';
    for (var fi = floaters.length - 1; fi >= 0; fi--) {
      var f = floaters[fi]; f.t += dt; if (f.t > 1) { floaters.splice(fi, 1); continue; }
      ctx.globalAlpha = 1 - f.t; ctx.fillStyle = f.big ? '#7fffe8' : '#ffd27a';
      ctx.fillText(f.txt, f.x, f.y - f.t * ts * 1.5);
    }
    ctx.globalAlpha = 1;
    if (flash > 0) { ctx.fillStyle = 'rgba(255,220,160,' + flash * .5 + ')'; ctx.fillRect(0, 0, cw, ch); flash = Math.max(0, flash - dt * 1.4); }
    ctx.restore();

    // vignette
    var vk = cw + 'x' + ch;
    if (vigKey !== vk) {
      var vc = document.createElement('canvas'); vc.width = cw; vc.height = ch; var vg = vc.getContext('2d');
      var gr = vg.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * .35, cw / 2, ch / 2, Math.max(cw, ch) * .75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.65)');
      vg.fillStyle = gr; vg.fillRect(0, 0, cw, ch); vignette = vc; vigKey = vk;
    }
    ctx.drawImage(vignette, 0, 0);
    drawHud(ctx, s, v);
    // banners
    if (s.status === 'ready') banner(ctx, v, s.readyLeft > 0 && s.time === 0 ? 'READY' : 'READY!', '#ffd27a');
    if (s.status === 'levelclear') banner(ctx, v, s.hitThisLevel ? 'LEVEL CLEAR' : 'PERFECT!', '#7fffe8');
    if (sh && sh.phase === 'warn') {
      var secs = Math.max(0, sh.dur - sh.t);
      ctx.fillStyle = 'rgba(160,255,240,' + (0.7 + 0.3 * Math.sin(time * 14)) + ')';
      ctx.font = 'bold ' + Math.round(Math.max(12, ts * .6)) + 'px Georgia,serif'; ctx.textAlign = 'center';
      ctx.fillText('THE ' + (sh.axis === 'row' ? 'ROW' : 'COLUMN') + ' SHIFTS ' + secs.toFixed(1), cw / 2, 66);
    }
  };

  function banner(ctx, v, txt, col) {
    ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold ' + Math.round(v.ts * 1.4) + 'px Georgia,serif';
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(txt, v.cw / 2 + 2, v.oy + v.ts * 12.3 + 2);
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.fillText(txt, v.cw / 2, v.oy + v.ts * 12.3);
    ctx.restore();
  }
  function arrow(ctx, x, y, r, dir) {
    var d = DIRS[dir]; ctx.beginPath();
    ctx.moveTo(x + d[0] * r * 1.4, y + d[1] * r * 1.4);
    ctx.lineTo(x - d[0] * r + d[1] * r, y - d[1] * r + d[0] * r);
    ctx.lineTo(x - d[0] * r - d[1] * r, y - d[1] * r - d[0] * r); ctx.closePath(); ctx.fill();
  }
  function drawHud(ctx, s, v) {
    var f = Math.max(14, Math.min(22, v.cw / 22));
    ctx.textBaseline = 'alphabetic'; ctx.font = 'bold ' + f + 'px Georgia,serif';
    ctx.fillStyle = '#ffd27a'; ctx.textAlign = 'center';
    ctx.fillText('SCORE ' + s.score, v.cw / 2, 26);
    ctx.font = f * .7 + 'px Georgia,serif'; ctx.fillStyle = '#d9b98a';
    ctx.fillText('LEVEL ' + s.level + '   •   HOLLOWS ' + s.stats.ghosts, v.cw / 2, 43);
    for (var i = 0; i < s.lives - 1; i++) drawFlameIcon(ctx, v.cw / 2 + (i - (s.lives - 2) / 2) * (f * 1.1) + 0, v.oy + v.ts * H + Math.min(20, v.ts * .9), f * .42);
    // next shift meter
    if (s.status === 'playing' && !s.shift) {
      var left = Math.max(0, s.nextShift - s.time), total = s.params.shiftEvery, k = 1 - Math.min(1, left / total);
      var bw = Math.min(220, v.cw * .5);
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(v.cw / 2 - bw / 2, 52, bw, 3);
      ctx.fillStyle = k > .8 ? '#5be3d0' : '#c08a4a'; ctx.fillRect(v.cw / 2 - bw / 2, 52, bw * k, 3);
    }
  }
  function drawFlameIcon(ctx, x, y, r) { flamePath(ctx, x, y, r, 0); ctx.fillStyle = '#ff9a3c'; ctx.fill(); }
  function flamePath(ctx, x, y, r, wob) {
    ctx.beginPath(); ctx.moveTo(x, y - r * 1.5 + wob);
    ctx.bezierCurveTo(x + r * 1.1, y - r * .4, x + r * 1.1, y + r * .95, x, y + r * .95);
    ctx.bezierCurveTo(x - r * 1.1, y + r * .95, x - r * 1.1, y - r * .4, x, y - r * 1.5 + wob); ctx.closePath();
  }
  function drawPlayer(ctx, p, x, y, ts, time, s) {
    var r = ts * .4, wob = Math.sin(time * 18) * r * .12;
    var dirv = DIRS[p.dir] || [0, 0], lean = p.moving ? 0.25 : 0;
    ctx.save(); ctx.translate(x, y); ctx.rotate(dirv[0] * lean);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3);
    g.addColorStop(0, 'rgba(255,170,60,.5)'); g.addColorStop(1, 'rgba(255,100,20,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(-r * 3, -r * 3, r * 6, r * 6); ctx.globalCompositeOperation = 'source-over';
    flamePath(ctx, 0, 0, r, wob); var fg = ctx.createLinearGradient(0, -r * 1.5, 0, r);
    fg.addColorStop(0, '#fff2b0'); fg.addColorStop(.5, '#ffa63a'); fg.addColorStop(1, '#e23f12'); ctx.fillStyle = fg; ctx.fill();
    flamePath(ctx, 0, r * .25, r * .55, wob * .5); ctx.fillStyle = 'rgba(255,255,230,.85)'; ctx.fill();
    ctx.fillStyle = '#2a0f05'; var ex = dirv[0] * r * .22, ey = dirv[1] * r * .15 - r * .05;
    ctx.beginPath(); ctx.arc(-r * .32 + ex, ey, r * .13, 0, 6.283); ctx.arc(r * .32 + ex, ey, r * .13, 0, 6.283); ctx.fill();
    ctx.restore();
    if (p.moving && Math.random() < .5) particles.push({ x: x - dirv[0] * r, y: y - dirv[1] * r, vx: -dirv[0] * 20, vy: -30, life: .4, t: 0, col: '#ffb347', r: 1.5 });
  }
  function drawDying(ctx, x, y, ts, s) {
    var k = 1 - Math.max(0, s.dyingLeft) / 1.6, r = ts * .4 * (1 - k);
    if (r <= 0) return;
    flamePath(ctx, x, y, r, 0); ctx.fillStyle = 'rgba(255,150,50,' + (1 - k) + ')'; ctx.fill();
  }
  function drawGhost(ctx, g, x, y, ts, time, s) {
    var r = ts * .42, col = GHOST_COL[g.name], afraid = g.frightened, eaten = g.mode === 'eaten';
    var blink = afraid && s.frightLeft < 2 && Math.floor(time * 6) % 2 === 0;
    if (!eaten) {
      ctx.save(); ctx.translate(x, y + Math.sin(time * 6 + g.name.length) * r * .08);
      var body = afraid ? (blink ? '#f4f4ff' : '#2f4bd6') : col;
      var gl = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
      gl.addColorStop(0, afraid ? 'rgba(90,120,255,.35)' : 'rgba(255,90,60,.0)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gl; ctx.fillRect(-r * 2.2, -r * 2.2, r * 4.4, r * 4.4);
      ctx.beginPath(); ctx.moveTo(-r, r);
      ctx.lineTo(-r, -r * .2); ctx.arc(0, -r * .2, r, Math.PI, 0); ctx.lineTo(r, r);
      var n = 4, w = 2 * r / n;
      for (var i = 0; i < n; i++) { var bx = r - i * w; ctx.quadraticCurveTo(bx - w / 2, r + (Math.sin(time * 9 + i) > 0 ? r * .35 : -r * .1), bx - w, r); }
      ctx.closePath();
      var bg = ctx.createLinearGradient(0, -r, 0, r);
      bg.addColorStop(0, body); bg.addColorStop(1, afraid ? '#16205f' : '#2a0c1c'); ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    // eyes
    var d = DIRS[g.dir] || [0, 0];
    ctx.fillStyle = afraid ? '#ffe9a8' : '#fff';
    if (afraid && !eaten) {
      ctx.fillRect(x - r * .5, y - r * .35, r * .22, r * .22); ctx.fillRect(x + r * .28, y - r * .35, r * .22, r * .22);
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (var m = 0; m < 5; m++) ctx.lineTo(x - r * .55 + m * r * .275, y + r * .25 + (m % 2) * r * .15); ctx.stroke();
    } else {
      [-1, 1].forEach(function (sd) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + sd * r * .38, y - r * .2, r * .26, r * .33, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = eaten ? '#6fe' : '#17102a'; ctx.beginPath(); ctx.arc(x + sd * r * .38 + d[0] * r * .12, y - r * .2 + d[1] * r * .15, r * .13, 0, 6.283); ctx.fill();
      });
    }
  }
  var FRUITS = ['#ff4d6d', '#ffa23a', '#7bd34e', '#b86bff', '#5be3d0', '#ffd23a', '#ff7ad9', '#fff'];
  function drawFruit(ctx, x, y, ts, kind, time) {
    var r = ts * .3 + Math.sin(time * 5) * ts * .02, col = FRUITS[kind % FRUITS.length];
    var g = ctx.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r * 1.2);
    g.addColorStop(0, '#fff'); g.addColorStop(.3, col); g.addColorStop(1, '#3a0d1a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#7bd34e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + r * .5, y - r * 1.4, x + r * .9, y - r * 1.1); ctx.stroke();
  }
})(typeof window !== 'undefined' ? window : this);
