(function (global) {
  'use strict';
  var R = (global.PL = global.PL || {}).Render = {};
  var colors = ['#f5bd65', '#fb718f', '#76d6da', '#b6a2ff'];
  var TOP = 70, LINE = 500, H = 600, CX = 400, LANE = 146, SPEED = 220, FAR = 0.52;
  var particles = [], popups = [], shake = 0, rotateAt = -9, missFlash = [0, 0, 0, 0], press = [0, 0, 0, 0], clock = 0;
  var stars = [];
  for (var s = 0; s < 70; s++) stars.push([(s * 137.5) % 800, (s * 89.3) % 600, 0.4 + (s % 5) * 0.25, s % 4]);
  function depth(y) { return Math.max(0, Math.min(1, (y - TOP) / (LINE - TOP))); }
  function scale(y) { return FAR + (1 - FAR) * depth(y); }
  function lx(lane, y) { return CX + (lane - 1.5) * LANE * scale(y); }
  R.laneAt = function (x, y) {
    var sc = scale(Math.max(TOP, Math.min(LINE, y))), lane = Math.floor((x - CX) / (LANE * sc) + 2);
    return lane < 0 || lane > 3 ? -1 : lane;
  };
  R.reset = function () { particles.length = 0; popups.length = 0; shake = 0; rotateAt = -9; };
  R.burst = function (lane, color, perfect) {
    var n = perfect ? 26 : 12;
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 90 + Math.random() * (perfect ? 330 : 200);
      particles.push({ x: lx(lane, LINE), y: LINE, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, age: 0, c: color, r: 2 + Math.random() * 3 });
    }
    press[lane] = 1;
  };
  R.popup = function (text, lane, color) { popups.push({ t: text, x: lx(lane, LINE), y: LINE - 50, age: 0, c: color }); };
  R.miss = function (lane) { missFlash[lane] = 1; shake = 6; };
  R.rotate = function (time) { rotateAt = time; shake = 4; };
  function glow(ctx, c, b) { ctx.shadowColor = c; ctx.shadowBlur = b; }
  R.draw = function (canvas, run, time, state) {
    var ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, L = global.PL.Logic;
    var dt = Math.min(0.05, Math.max(0, (state.wall || 0) - clock)); clock = state.wall || 0;
    var beat = time / L.BEAT, section = L.section(time), pulse = Math.pow(1 - (beat % 1), 3);
    H = 800 * h / w; LINE = H - 100; SPEED = (LINE - TOP) / 2;
    ctx.setTransform(w / 800, 0, 0, w / 800, 0, 0);
    shake = Math.max(0, shake - dt * 24);
    if (shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    var tints = [['#101933', '#2a2347'], ['#0e2230', '#20324a'], ['#251334', '#4a2440'], ['#2b1a12', '#5a3320']][section];
    bg.addColorStop(0, tints[0]); bg.addColorStop(1, tints[1]);
    ctx.fillStyle = bg; ctx.fillRect(-10, -10, 820, H + 20);
    // Drifting stars of the four threads.
    stars.forEach(function (st) {
      var y = (st[1] / 600 * H + time * 6 * st[2]) % H;
      ctx.globalAlpha = 0.25 + 0.35 * st[2] * (0.6 + 0.4 * pulse); ctx.fillStyle = colors[st[3]];
      ctx.fillRect(st[0], y, st[2] * 2, st[2] * 2);
    });
    ctx.globalAlpha = 1;
    // Loom light rays converging on the vanishing point.
    var ray = ctx.createRadialGradient(CX, TOP - 30, 10, CX, TOP - 30, 520);
    ray.addColorStop(0, 'rgba(255,230,190,' + (0.16 + 0.1 * pulse) + ')'); ray.addColorStop(1, 'rgba(255,230,190,0)');
    ctx.fillStyle = ray; ctx.fillRect(0, 0, 800, H);
    // Highway.
    ctx.beginPath(); ctx.moveTo(lx(-0.5, TOP), TOP); ctx.lineTo(lx(3.5, TOP), TOP); ctx.lineTo(lx(3.5, LINE + 40), LINE + 40); ctx.lineTo(lx(-0.5, LINE + 40), LINE + 40); ctx.closePath();
    ctx.fillStyle = 'rgba(5,9,20,.72)'; ctx.fill(); ctx.strokeStyle = 'rgba(249,233,201,.35)'; ctx.lineWidth = 2; ctx.stroke();
    for (var i = 0; i <= 4; i++) {
      ctx.strokeStyle = 'rgba(249,233,201,' + (i % 4 ? 0.14 : 0.3) + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(lx(i - 0.5, TOP), TOP); ctx.lineTo(lx(i - 0.5, LINE + 40), LINE + 40); ctx.stroke();
    }
    // Thread order strip: shows which colour owns which lane right now, sliding on rotation.
    var shift = time >= 0 ? Math.floor(beat / 32) : 0, slide = Math.max(0, 1 - (time - rotateAt) / 0.6);
    for (var b = 0; b < 4; b++) {
      var lane = (b + shift) % 4, from = (lane + 3) % 4, pos = lane - (lane - from) * slide;
      var px = CX + (pos - 1.5) * LANE * 0.5, py = 40;
      glow(ctx, colors[b], 12); ctx.fillStyle = colors[b]; ctx.beginPath(); ctx.arc(px, py, 9, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0;
    }
    // Lane glow on press + miss flash.
    for (var k = 0; k < 4; k++) {
      press[k] = Math.max(0, press[k] - dt * 4); missFlash[k] = Math.max(0, missFlash[k] - dt * 3);
      var ga = press[k] * 0.22 + missFlash[k] * 0.3;
      if (ga > 0) {
        ctx.beginPath(); ctx.moveTo(lx(k - .5, TOP), TOP); ctx.lineTo(lx(k + .5, TOP), TOP); ctx.lineTo(lx(k + .5, LINE), LINE); ctx.lineTo(lx(k - .5, LINE), LINE); ctx.closePath();
        ctx.fillStyle = missFlash[k] > press[k] ? 'rgba(255,70,90,' + ga + ')' : 'rgba(255,245,220,' + ga + ')'; ctx.fill();
      }
    }
    // Beat lines.
    for (var bl = Math.ceil(beat); bl < Math.min(L.TOTAL_BEATS, beat + 5); bl++) {
      var yb = LINE - (bl * L.BEAT - time) * SPEED;
      if (yb >= TOP && yb < LINE) {
        ctx.strokeStyle = bl % 4 === 0 ? 'rgba(255,229,184,.35)' : 'rgba(255,255,255,.1)'; ctx.lineWidth = bl % 4 === 0 ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(lx(-.5, yb), yb); ctx.lineTo(lx(3.5, yb), yb); ctx.stroke();
      }
    }
    // Judgment targets.
    for (var t = 0; t < 4; t++) {
      var tx = lx(t, LINE), r = 36 + press[t] * 6 + pulse * 2;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(249,233,201,.9)'; glow(ctx, '#fff1cf', 8 + press[t] * 18);
      ctx.beginPath(); ctx.arc(tx, LINE, r, 0, 6.3); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,245,220,' + (0.08 + press[t] * 0.3) + ')'; ctx.fill();
      ctx.fillStyle = 'rgba(249,233,201,.85)'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(['D', 'F', 'J', 'K'][t], tx, LINE + 68);
    }
    // Notes: colour belongs to the thread, so rotation is visible as a colour changing lanes.
    run.notes.forEach(function (note) {
      if (note.status) return;
      var y = LINE - (note.time - time) * SPEED;
      if (y < TOP - 10 || y > LINE + 60) return;
      var sc = scale(y), x = lx(note.lane, y), c = colors[note.base], nw = 58 * sc, nh = 18 * sc;
      var fade = Math.min(1, (y - TOP + 10) / 60);
      ctx.globalAlpha = fade * (y > LINE + 20 ? 0.5 : 1);
      glow(ctx, c, 18 * sc); ctx.fillStyle = c;
      ctx.beginPath(); ctx.roundRect(x - nw, y - nh, nw * 2, nh * 2, 12 * sc); ctx.fill(); ctx.shadowBlur = 0;
      var hl = ctx.createLinearGradient(0, y - nh, 0, y + nh); hl.addColorStop(0, 'rgba(255,255,255,.7)'); hl.addColorStop(.5, 'rgba(255,255,255,0)'); hl.addColorStop(1, 'rgba(0,0,0,.25)');
      ctx.fillStyle = hl; ctx.beginPath(); ctx.roundRect(x - nw, y - nh, nw * 2, nh * 2, 12 * sc); ctx.fill();
      ctx.fillStyle = '#fff9e8'; ctx.fillRect(x - nw * .55, y - 2 * sc, nw * 1.1, 4 * sc);
      ctx.globalAlpha = 1;
    });
    // Particles + popups.
    particles = particles.filter(function (p) { return (p.age += dt) < p.life; });
    particles.forEach(function (p) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt;
      ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = p.c; glow(ctx, p.c, 8);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill();
    });
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    popups = popups.filter(function (p) { return (p.age += dt) < 0.7; });
    popups.forEach(function (p) {
      ctx.globalAlpha = 1 - p.age / 0.7; ctx.fillStyle = p.c; ctx.font = '900 ' + Math.round(22 + 8 * Math.max(0, 1 - p.age * 5)) + 'px system-ui';
      ctx.textAlign = 'center'; ctx.fillText(p.t, p.x, p.y - p.age * 70);
    });
    ctx.globalAlpha = 1;
    // Rotation warning and sweep.
    if (state.mode === 'playing' && (beat >= 29 && beat < 32 || beat >= 61 && beat < 64 || beat >= 93 && beat < 96)) {
      var n = Math.ceil(32 - beat % 32);
      ctx.fillStyle = 'rgba(249,233,201,' + (0.7 + 0.3 * pulse) + ')'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'center';
      glow(ctx, '#f5bd65', 14); ctx.fillText('LOOM ROTATES IN ' + n, CX, 112); ctx.shadowBlur = 0;
    }
    var sweep = (time - rotateAt) / 0.7;
    if (sweep >= 0 && sweep < 1) {
      ctx.fillStyle = 'rgba(255,240,210,' + 0.35 * (1 - sweep) + ')'; ctx.fillRect(0, TOP + sweep * (LINE - TOP) - 20, 800, 40);
    }
    // Progress thread.
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(40, H - 16, 720, 4);
    var prog = Math.max(0, Math.min(1, time / (L.TOTAL_BEATS * L.BEAT)));
    ctx.fillStyle = colors[section]; ctx.fillRect(40, H - 16, 720 * prog, 4);
  };
})(typeof window !== 'undefined' ? window : this);
