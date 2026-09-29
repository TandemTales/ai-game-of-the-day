/* Canvas renderer: glossy procedural gumdrops, jar, tilt animation, particles. Global GTR. */
(function (root) {
  'use strict';
  var PAL = [['#ff6b8b', '#b81e4a'], ['#ffcf4a', '#c98a08'], ['#5be08a', '#138a48'], ['#5bb8ff', '#1a5bb5'], ['#c284ff', '#6a2bb0']];
  var CELL = 48, particles = [], tiltAnim = 0, tiltFrom = 0, shake = 0;
  var sprites = [];
  function bake() {
    if (sprites.length) return;
    for (var c = 0; c < PAL.length; c++) {
      var cv = document.createElement('canvas'); cv.width = cv.height = CELL; var g = cv.getContext('2d'), r = CELL / 2 - 3;
      var gr = g.createRadialGradient(CELL * .38, CELL * .3, 2, CELL / 2, CELL / 2, r + 2); gr.addColorStop(0, '#fff'); gr.addColorStop(.25, PAL[c][0]); gr.addColorStop(1, PAL[c][1]);
      g.fillStyle = gr; g.beginPath(); g.ellipse(CELL / 2, CELL / 2 + 2, r, r - 1, 0, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(CELL * .36, CELL * .3, 6, 3.5, -.6, 0, 6.283); g.fill();
      // sugar sparkle dots
      g.fillStyle = 'rgba(255,255,255,.35)'; for (var i = 0; i < 9; i++) { var a = i * 2.4, d = (i % 3 + 1) * 5 + 3; g.fillRect(CELL / 2 + Math.cos(a) * d, CELL / 2 + 3 + Math.sin(a) * d, 1.6, 1.6); }
      sprites.push(cv);
    }
  }
  function spawnBurst(x, y, c, n) { for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, s = 80 + Math.random() * 240; particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 90, life: .6 + Math.random() * .4, t: 0, c: c, r: 2 + Math.random() * 3 }); } }
  function draw(ctx, cv, st, time) {
    bake(); var W = root.GT.W, H = root.GT.H, w = cv.width, h = cv.height, cs = Math.min(w / W, h / H), ox = (w - cs * W) / 2, oy = (h - cs * H) / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    if (tiltAnim > 0) { var k = tiltAnim / .55, ang = tiltFrom * .16 * Math.sin(k * Math.PI); ctx.translate(w / 2, h); ctx.rotate(ang); ctx.translate(-w / 2, -h); }
    // jar
    var jx = ox, jy = oy, jw = cs * W, jh = cs * H;
    var bg = ctx.createLinearGradient(0, jy, 0, jy + jh); bg.addColorStop(0, 'rgba(255,255,255,.07)'); bg.addColorStop(1, 'rgba(255,255,255,.14)');
    ctx.fillStyle = bg; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(jx - 4, jy - 4, jw + 8, jh + 8, 16) : ctx.rect(jx - 4, jy - 4, jw + 8, jh + 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,80,120,.10)'; ctx.fillRect(jx + cs * 2, jy, cs, cs * 2); // spawn danger lane
    function drop(x, y, c, a, scale) { var s = cs * (scale || 1); ctx.globalAlpha = a == null ? 1 : a; ctx.drawImage(sprites[c], jx + x * cs + (cs - s) / 2, jy + y * cs + (cs - s) / 2, s, s); ctx.globalAlpha = 1; }
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var c = st.grid[y][x]; if (c !== -1) { var wob = st.phase === 'tilt' ? Math.sin(time * 20 + x + y) * .04 : 0; drop(x, y + wob, c, 1); } }
    // group glow hint
    var groups = st.phase === 'play' ? [] : [];
    if (st.popping.length) { var p = 1 - Math.max(0, st.timer) / .34; st.popping.forEach(function (q) { drop(q.x, q.y, q.c, 1 - p, 1 + p * .6); }); }
    if (st.piece && st.status === 'playing') {
      var gh = root.GT.ghost(st); if (gh) gh.forEach(function (q) { if (q.y >= 0) { ctx.globalAlpha = .25; ctx.drawImage(sprites[q.c], jx + q.x * cs + cs * .1, jy + q.y * cs + cs * .1, cs * .8, cs * .8); ctx.globalAlpha = 1; } });
      root.GT.cellsOf(st.piece).forEach(function (q) { if (q.y >= 0) drop(q.x, q.y, q.c, 1); });
    }
    // tilt arrow
    if (st.tiltPending) { ctx.fillStyle = 'rgba(255,95,162,' + (.55 + .35 * Math.sin(time * 8)) + ')'; ctx.font = 'bold ' + (cs * .8) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(st.tiltDir < 0 ? '◀◀' : '▶▶', jx + jw / 2, jy + cs * 0.9); }
    ctx.restore();
    // particles (screen space of jar)
    for (var i = particles.length - 1; i >= 0; i--) { var q2 = particles[i]; ctx.globalAlpha = Math.max(0, 1 - q2.t / q2.life); ctx.fillStyle = PAL[q2.c][0]; ctx.beginPath(); ctx.arc(jx + q2.x * cs, jy + q2.y * cs, q2.r, 0, 6.283); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  function tick(dt) {
    if (tiltAnim > 0) tiltAnim = Math.max(0, tiltAnim - dt); if (shake > 0) shake = Math.max(0, shake - dt * 40);
    for (var i = particles.length - 1; i >= 0; i--) { var p = particles[i]; p.t += dt; p.vy += 600 * dt; p.x += p.vx * dt / 48; p.y += p.vy * dt / 48; if (p.t > p.life) particles.splice(i, 1); }
  }
  function onEvent(e, st) {
    if (e.type === 'pop') { st.popping.forEach(function (q) { spawnBurst(q.x + .5, q.y + .5, q.c, 4 + e.data.chain * 2); }); shake = Math.min(14, 3 + e.data.chain * 2.5); }
    else if (e.type === 'tilt') { tiltAnim = .55; tiltFrom = -e.data; shake = 8; }
  }
  function drawNext(ctx, cv, st) {
    bake(); ctx.clearRect(0, 0, cv.width, cv.height); var q = st.queue[0]; if (!q) return; var s = cv.width * .8, x = cv.width * .1;
    ctx.drawImage(sprites[q[1]], x, cv.height * .05, s, s); ctx.drawImage(sprites[q[0]], x, cv.height * .05 + s * 1.05, s, s);
  }
  root.GTR = { draw: draw, tick: tick, onEvent: onEvent, drawNext: drawNext };
})(typeof globalThis !== 'undefined' ? globalThis : this);
