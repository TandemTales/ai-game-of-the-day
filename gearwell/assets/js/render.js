(function (global) {
  'use strict';
  var GW = global.GW = global.GW || {}, L = GW.Logic;
  var X = 30, Y = 58, C = 26, TAU = Math.PI * 2;
  var scenes = new WeakMap();

  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }
  function line(ctx, x1, y1, x2, y2, color, width) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function cog(ctx, x, y, radius, lit, rotation) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation || 0);
    ctx.fillStyle = lit ? '#fbdc90' : '#324957';
    for (var i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate(i * TAU / 8);
      rounded(ctx, -radius * .24, -radius * 1.26, radius * .48, radius * .65, radius * .1); ctx.fill(); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill();
    ctx.fillStyle = lit ? '#885a2e' : '#101e2c';
    ctx.beginPath(); ctx.arc(0, 0, radius * .48, 0, TAU); ctx.fill();
    ctx.strokeStyle = lit ? '#fff1bf' : '#5e7681'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, radius - .8, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // The mechanism sits behind smoked glass, with one offset flywheel rather
  // than repeated decorative cogs. Keep its contrast below the landing guide.
  function mechanism(ctx, phase) {
    ctx.save();
    var shadow = ctx.createLinearGradient(X, 0, X + 260, 0);
    shadow.addColorStop(0, '#07131b'); shadow.addColorStop(.28, '#162c34');
    shadow.addColorStop(.7, '#102632'); shadow.addColorStop(1, '#06111d');
    ctx.fillStyle = shadow; ctx.fillRect(X, Y, 260, 520);
    for (var panel = 0; panel < 4; panel++) {
      var py = 85 + panel * 135;
      ctx.fillStyle = '#0a1b27'; ctx.fillRect(43, py, 234, 122);
      line(ctx, 44, py, 276, py, 'rgba(117,152,151,.12)', 1);
      line(ctx, 44, py + 121, 276, py + 121, '#030e18', 2);
      for (var bolt = 0; bolt < 2; bolt++) {
        ctx.fillStyle = '#283d43';
        ctx.beginPath(); ctx.arc(bolt ? 271 : 49, py + 7, 1.3, 0, TAU); ctx.fill();
      }
    }
    // A cast flywheel: shadowed rear rim, worn bevel and recessed spokes.
    ctx.save(); ctx.translate(241, 358);
    ctx.fillStyle = '#020b12';
    ctx.beginPath(); ctx.arc(4, 7, 132, 0, TAU); ctx.fill();
    var casting = ctx.createLinearGradient(-125, -125, 100, 115);
    casting.addColorStop(0, '#46514a'); casting.addColorStop(.2, '#263b3d');
    casting.addColorStop(.45, '#0b1a23'); casting.addColorStop(.76, '#334440');
    casting.addColorStop(1, '#111e25');
    ctx.fillStyle = casting;
    ctx.beginPath(); ctx.arc(0, 0, 129, 0, TAU); ctx.arc(0, 0, 103, TAU, 0, true); ctx.fill();
    ctx.strokeStyle = '#40524d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 128, Math.PI * 1.1, Math.PI * 1.8); ctx.stroke();
    ctx.strokeStyle = '#05121b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 105, 0, TAU); ctx.stroke();
    ctx.save(); ctx.rotate(-phase * .025);
    for (var spoke = 0; spoke < 9; spoke++) {
      ctx.rotate(TAU / 9);
      ctx.fillStyle = '#17292d';
      ctx.beginPath(); ctx.moveTo(23, -8); ctx.lineTo(103, -14);
      ctx.lineTo(108, 10); ctx.lineTo(23, 8); ctx.closePath(); ctx.fill();
      line(ctx, 31, -7, 102, -13, '#344740', 1);
      line(ctx, 30, 9, 102, 12, '#06111a', 3);
      // Paired bolts and scuffed rim marks remain subordinate to blocks.
      for (var screw = 0; screw < 2; screw++) {
        var sy = screw ? 17 : -17;
        ctx.fillStyle = '#07151c'; ctx.beginPath(); ctx.arc(117, sy, 3, 0, TAU); ctx.fill();
        line(ctx, 115, sy - 1, 118, sy - 1, '#526050', .8);
      }
      line(ctx, 122, -10, 124, -4, '#566047', .6);
      line(ctx, 111, 7, 119, 8, '#3e4d3e', .6);
    }
    ctx.restore();
    var hub = ctx.createLinearGradient(-25, -30, 25, 35);
    hub.addColorStop(0, '#526054'); hub.addColorStop(.2, '#2b3b3b');
    hub.addColorStop(.65, '#0d1d26'); hub.addColorStop(1, '#344640');
    ctx.fillStyle = hub; ctx.beginPath(); ctx.arc(0, 0, 31, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#09151f'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#07131d'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
    line(ctx, -7, -9, 7, -9, '#3c4e49', 1);
    ctx.restore();
    // Recessed conduit on the opposite side balances the wheel's mass.
    for (var pipe = 0; pipe < 3; pipe++) {
      var px = 49 + pipe * 11;
      line(ctx, px + 2, 77, px + 2, 565, '#030e16', 6);
      line(ctx, px, 77, px, 565, '#20343b', 4);
      line(ctx, px - 1, 77, px - 1, 565, '#2b4145', .6);
    }
    // A single warm work lamp and cold footlight give the machine direction.
    var amber = ctx.createRadialGradient(48, 89, 0, 48, 89, 240);
    amber.addColorStop(0, 'rgba(239,169,66,.16)'); amber.addColorStop(1, 'rgba(239,169,66,0)');
    ctx.fillStyle = amber; ctx.fillRect(X, Y, 260, 520);
    var blue = ctx.createRadialGradient(280, 563, 0, 280, 563, 240);
    blue.addColorStop(0, 'rgba(56,171,192,.15)'); blue.addColorStop(1, 'rgba(56,171,192,0)');
    ctx.fillStyle = blue; ctx.fillRect(X, Y, 260, 520);
    // Smoked safety glass keeps every cell of the foreground grid readable.
    ctx.fillStyle = 'rgba(4,14,24,.34)'; ctx.fillRect(X, Y, 260, 520);
    ctx.restore();
  }
  function block(ctx, x, y, kind, gear, ghost) {
    var px = X + x * C, py = Y + y * C;
    if (ghost) {
      rounded(ctx, px + 2, py + 2, C - 4, C - 4, 4);
      ctx.fillStyle = 'rgba(155,229,236,.11)'; ctx.fill();
      ctx.strokeStyle = '#081927'; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(195,244,246,.83)'; ctx.lineWidth = 1.5; ctx.stroke();
      line(ctx, px + 7, py + C - 6, px + C - 7, py + C - 6, 'rgba(207,238,237,.6)', 1);
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    rounded(ctx, px + 1, py + 3, C - 1, C - 1, 3); ctx.fill();
    rounded(ctx, px + 1, py + 1, C - 2, C - 3, 3);
    var face = ctx.createLinearGradient(px, py, px, py + C);
    face.addColorStop(0, '#d4e3d8'); face.addColorStop(.09, L.COLORS[kind]);
    face.addColorStop(.64, L.COLORS[kind]); face.addColorStop(1, '#233947');
    ctx.fillStyle = face; ctx.fill();
    // Enamel inset, cut bevels and tiny steel fastener marks.
    ctx.fillStyle = 'rgba(8,28,37,.17)';
    rounded(ctx, px + 4, py + 5, C - 8, C - 12, 1); ctx.fill();
    line(ctx, px + 4, py + 3, px + C - 5, py + 3, 'rgba(255,255,243,.65)', 1);
    line(ctx, px + 3, py + 4, px + 3, py + C - 6, 'rgba(255,255,237,.35)', 1);
    line(ctx, px + 4, py + C - 5, px + C - 4, py + C - 5, 'rgba(4,17,26,.44)', 2);
    line(ctx, px + C - 3, py + 5, px + C - 3, py + C - 5, 'rgba(3,18,27,.28)', 1);
    ctx.fillStyle = 'rgba(7,25,32,.35)';
    ctx.fillRect(px + 5, py + C - 8, 2, 1); ctx.fillRect(px + C - 7, py + C - 8, 2, 1);
    if (gear) {
      ctx.save(); ctx.shadowColor = '#ffd676'; ctx.shadowBlur = 9;
      ctx.fillStyle = '#132536'; ctx.beginPath(); ctx.arc(px + 13, py + 14, 9, 0, TAU); ctx.fill();
      cog(ctx, px + 13, py + 14, 5.5, true); ctx.restore();
    } else {
      line(ctx, px + C - 6, py + 10, px + C - 6, py + C - 8, 'rgba(255,255,255,.16)', 1);
    }
  }
  function rivet(ctx, x, y) {
    ctx.fillStyle = '#081421'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7c9ba3'; ctx.beginPath(); ctx.arc(x - .5, y - .5, 1, 0, TAU); ctx.fill();
  }
  function board(ctx, s, time, phase) {
    ctx.fillStyle = '#07121e'; rounded(ctx, 19, 47, 282, 542, 12); ctx.fill();
    var rim = ctx.createLinearGradient(19, 47, 301, 589);
    rim.addColorStop(0, '#ead6a2'); rim.addColorStop(.12, '#5d6c67');
    rim.addColorStop(.28, '#234253'); rim.addColorStop(.49, '#aa9265');
    rim.addColorStop(.54, '#3a4c4d'); rim.addColorStop(.82, '#a5b5a9'); rim.addColorStop(1, '#4d4a38');
    ctx.fillStyle = rim; rounded(ctx, 22, 50, 276, 536, 10); ctx.fill();
    ctx.fillStyle = '#081725'; rounded(ctx, 27, 55, 266, 526, 5); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(X, Y, 260, 520); ctx.clip();
    mechanism(ctx, phase);
    // Shadow where the chamber disappears under the overhanging brass frame.
    var depth = ctx.createLinearGradient(X, 0, X + 260, 0);
    depth.addColorStop(0, 'rgba(0,6,12,.65)'); depth.addColorStop(.09, 'rgba(0,6,12,0)');
    depth.addColorStop(.91, 'rgba(0,6,12,0)'); depth.addColorStop(1, 'rgba(0,6,12,.65)');
    ctx.fillStyle = depth; ctx.fillRect(X, Y, 260, 520); ctx.restore();
    ctx.strokeStyle = 'rgba(143,191,197,.085)'; ctx.lineWidth = 1;
    for (var x = 0; x <= 10; x++) {
      ctx.beginPath(); ctx.moveTo(X + x * C + .5, Y); ctx.lineTo(X + x * C + .5, Y + 520); ctx.stroke();
    }
    for (var y = 0; y <= 20; y++) {
      ctx.beginPath(); ctx.moveTo(X, Y + y * C + .5); ctx.lineTo(X + 260, Y + y * C + .5); ctx.stroke();
    }
    for (y = 5; y < 20; y += 5) {
      line(ctx, X + 1, Y + y * C + .5, X + 259, Y + y * C + .5, 'rgba(176,226,222,.14)', 1);
      line(ctx, 25, Y + y * C, 29, Y + y * C, '#9dbdc0', 1);
      line(ctx, 291, Y + y * C, 295, Y + y * C, '#9dbdc0', 1);
    }
    for (y = 0; y < L.H; y++) for (x = 0; x < L.W; x++) {
      var cell = s.board[y][x]; if (cell) block(ctx, x, y, cell.kind, cell.gear, false);
    }
    if (s.piece) {
      var ghost = L.ghost(s);
      L.cells(ghost).forEach(function (cell) {
        if (cell.y >= 0) block(ctx, cell.x, cell.y, ghost.kind, false, true);
      });
      L.cells(s.piece).forEach(function (cell) {
        if (cell.y >= 0) block(ctx, cell.x, cell.y, s.piece.kind, cell.gear, false);
      });
    }
    var shade = ctx.createLinearGradient(0, Y, 0, Y + 22);
    shade.addColorStop(0, 'rgba(3,12,22,.6)'); shade.addColorStop(1, 'rgba(3,12,22,0)');
    ctx.fillStyle = shade; ctx.fillRect(X, Y, 260, 22);
    ctx.strokeStyle = '#496f7e'; ctx.lineWidth = 1;
    rounded(ctx, 28.5, 56.5, 263, 523, 4); ctx.stroke();
    for (var rail = 0; rail < 2; rail++) {
      var rx = rail ? 294 : 25;
      line(ctx, rx, 77, rx, 558, '#07151f', 3);
      line(ctx, rx, 77, rx, 558, '#a6a481', .75);
      for (var tick = 0; tick < 20; tick++) {
        var ty = Y + tick * C + 13;
        line(ctx, rx - 1, ty, rx + 1, ty, tick % 5 === 4 ? '#f5cf87' : '#567781', 1.5);
      }
    }
    ctx.save(); ctx.shadowColor = '#030b13'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
    for (var corner = 0; corner < 4; corner++) {
      var cx = corner % 2 ? 296 : 24, cy = corner < 2 ? 54 : 582;
      ctx.save(); ctx.translate(cx, cy);
      if (corner % 2) ctx.scale(-1, 1);
      if (corner > 1) ctx.scale(1, -1);
      ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(26, -5);
      ctx.lineTo(21, 0); ctx.lineTo(5, 0); ctx.lineTo(0, 5);
      ctx.lineTo(0, 25); ctx.lineTo(-4, 30); ctx.closePath();
      ctx.fillStyle = '#9b875e'; ctx.fill(); ctx.shadowBlur = 0;
      line(ctx, -3, -4, 24, -4, '#f3dca2', 1);
      line(ctx, -3, -4, -3, 27, '#c0ad7d', 1);
      ctx.restore();
    }
    ctx.restore();
    for (var wheel = 0; wheel < 2; wheel++) {
      ctx.save(); ctx.shadowColor = '#000c14'; ctx.shadowBlur = 4;
      var wx = wheel ? 303 : 17, wy = wheel ? 438 : 196;
      cog(ctx, wx, wy, 8, true, phase * .1 * (wheel ? -1 : 1));
      ctx.restore();
      line(ctx, wx, wy + 14, wx, wy + 75, '#a39266', 1);
      line(ctx, wx + 2, wy + 14, wx + 2, wy + 75, '#314c55', 1);
    }
    rivet(ctx, 24, 54); rivet(ctx, 296, 54); rivet(ctx, 24, 582); rivet(ctx, 296, 582);
  }
  function dock(ctx, s, phase) {
    var plate = ctx.createLinearGradient(0, 595, 0, 666);
    plate.addColorStop(0, '#1e3a4c'); plate.addColorStop(1, '#0b1c2d');
    ctx.fillStyle = plate; rounded(ctx, 20, 593, 280, 73, 9); ctx.fill();
    ctx.strokeStyle = '#426879'; ctx.lineWidth = 1;
    rounded(ctx, 20.5, 593.5, 279, 72, 9); ctx.stroke();
    line(ctx, 153, 603, 153, 657, '#355a6a', 1);
    var next = s.queue[0];
    if (next) {
      var preview = { kind: next, x: 0, y: 0, rot: 0, gear: false }, cells = L.cells(preview);
      var minX = Math.min.apply(null, cells.map(function (c) { return c.x; }));
      var maxX = Math.max.apply(null, cells.map(function (c) { return c.x; }));
      var minY = Math.min.apply(null, cells.map(function (c) { return c.y; }));
      var startX = 88 - (maxX - minX + 1) * 8;
      cells.forEach(function (cell) {
        var px = startX + (cell.x - minX) * 16, py = 622 + (cell.y - minY) * 16;
        ctx.fillStyle = L.COLORS[next]; rounded(ctx, px, py, 14, 14, 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.24)'; rounded(ctx, px + 2, py + 2, 10, 2, 1); ctx.fill();
      });
    }
    var ready = s.cogs >= 3;
    for (var i = 0; i < 3; i++) {
      if (i < s.cogs) {
        ctx.save(); ctx.shadowColor = '#f8bd54'; ctx.shadowBlur = ready ? 11 : 5;
        cog(ctx, 185 + i * 35, 636, 8, true, ready ? phase * .3 * (i % 2 ? -1 : 1) : 0); ctx.restore();
      } else cog(ctx, 185 + i * 35, 636, 8, false);
    }

  }
  function clearedRows(s) {
    if (!s.history || !s.history.piece) return [];
    var rows = s.history.board.map(function (row) { return row.map(Boolean); });
    L.cells(s.history.piece).forEach(function (c) { if (c.y >= 0) rows[c.y][c.x] = true; });
    var result = [];
    rows.forEach(function (row, i) { if (row.every(Boolean)) result.push(i); });
    return result;
  }
  function feedback(ctx, scene, now) {
    var event = scene.event;
    if (!event) return;
    var age = now - event.at, duration = event.rewind ? 1.1 : .9;
    if (age > duration) { scene.event = null; return; }
    var p = age / duration, fade = Math.pow(1 - p, 1.5);
    ctx.save(); ctx.beginPath(); ctx.rect(X, Y, 260, 520); ctx.clip();
    if (event.rewind) {
      ctx.strokeStyle = 'rgba(147,234,244,' + fade * .8 + ')'; ctx.lineWidth = 2;
      for (var ring = 0; ring < 3; ring++) {
        var radius = Math.max(3, 295 * (1 - p) - ring * 52);
        ctx.beginPath(); ctx.arc(160, 318, radius, -TAU * p, TAU * (.68 - p)); ctx.stroke();
      }
      for (var ray = 0; ray < 18; ray++) {
        var angle = ray * TAU / 18 - p * 2;
        var r = 40 + (1 - p) * 240;
        line(ctx, 160 + Math.cos(angle) * r, 318 + Math.sin(angle) * r,
          160 + Math.cos(angle) * (r + 24), 318 + Math.sin(angle) * (r + 24),
          'rgba(141,231,243,' + fade * .75 + ')', 1.5);
      }
    } else {
      event.rows.forEach(function (row) {
        var y = Y + row * C + C / 2;
        var light = ctx.createLinearGradient(0, y - 18, 0, y + 18);
        light.addColorStop(0, 'rgba(255,211,132,0)');
        light.addColorStop(.5, 'rgba(255,227,163,' + fade * .65 + ')');
        light.addColorStop(1, 'rgba(255,211,132,0)');
        ctx.fillStyle = light; ctx.fillRect(X, y - 18, 260, 36);
        line(ctx, X, y, X + 260, y, 'rgba(255,249,214,' + fade + ')', 2);
        for (var i = 0; i < 22; i++) {
          var px = X + (i * 37 + row * 11) % 260;
          var py = y - (12 + i % 5 * 8) * p;
          ctx.fillStyle = 'rgba(255,220,152,' + fade + ')';
          ctx.fillRect(px + Math.sin(i * 2) * p * 18, py, i % 3 ? 1.5 : 3, i % 3 ? 4 : 3);
        }
      });
    }
    ctx.restore();
    if (event.cogs) {
      ctx.save(); ctx.globalAlpha = fade;
      for (var gear = 0; gear < Math.min(3, event.cogs); gear++) {
        var t = Math.min(1, p * 1.6), startY = Y + event.rows[event.rows.length - 1] * C;
        var gx = 160 + (25 + gear * 35) * t + Math.sin(t * Math.PI) * 35;
        var gy = startY + (636 - startY) * t;
        cog(ctx, gx, gy, 7, true, p * 5);
      }
      ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = fade;
    ctx.strokeStyle = event.rewind ? '#91e6ed' : '#ffe1a2'; ctx.lineWidth = 2;
    rounded(ctx, 22, 50, 276, 536, 10); ctx.stroke(); ctx.restore();
  }
  function draw(canvas, s, time) {
    var ctx = canvas.getContext('2d'), w = 320, h = 670;
    ctx.save(); ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
    var phase = global.performance.now() / 1000;
    var scene = scenes.get(canvas);
    if (!scene || scene.state !== s) {
      scene = { state: s, history: s.history, cogs: s.cogs, last: s.last, event: null };
      scenes.set(canvas, scene);
    }
    if (s.history !== scene.history) {
      var rows = clearedRows(s), rewound = s.last === 'LAST LOCK REWOUND';
      if (rows.length || rewound) scene.event = { at: phase, rewind: rewound, rows: rows,
        cogs: rewound ? 0 : Math.max(0, s.cogs - scene.cogs) };
      scene.history = s.history;
    }
    scene.cogs = s.cogs; scene.last = s.last;
    var bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#344548'); bg.addColorStop(.25, '#172b36');
    bg.addColorStop(.7, '#0b1b29'); bg.addColorStop(1, '#23434a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // Brushed housing: fine deterministic grain, shallow pressed seams.
    for (var grain = 0; grain < h; grain += 3) {
      ctx.fillStyle = grain % 9 ? 'rgba(1,9,16,.1)' : 'rgba(189,212,194,.035)';
      ctx.fillRect(0, grain, w, .6);
    }
    line(ctx, 9.5, 18, 9.5, 650, '#425358', 1);
    line(ctx, 310.5, 18, 310.5, 650, '#050f19', 1);
    var cap = ctx.createLinearGradient(0, 8, 0, 42);
    cap.addColorStop(0, '#4a5147'); cap.addColorStop(.15, '#303e3e');
    cap.addColorStop(1, '#13242e');
    ctx.fillStyle = cap; rounded(ctx, 20, 9, 280, 33, 5); ctx.fill();
    line(ctx, 26, 10, 294, 10, '#9e9572', .8);
    ctx.fillStyle = '#e5d9b4'; ctx.font = 'bold 13px system-ui';
    var announcing = s.last && time < 1.45 && s.last !== 'LOCKED' && s.last !== 'READY';
    ctx.fillStyle = announcing ? '#ffdfa0' : '#e5d9b4';
    ctx.font = announcing ? 'bold 12px system-ui' : 'bold 13px system-ui';
    ctx.fillText(announcing ? s.last : 'CHRONO FOUNDRY', 33, 30, 178);
    // The physical status strip replaces duplicated game and level branding.
    for (var lamp = 0; lamp < 8; lamp++) {
      ctx.fillStyle = lamp < 2 + s.lines % 7 ? '#e4b367' : '#354548';
      rounded(ctx, 224 + lamp * 8, 20, 4, 11, 1); ctx.fill();
    }
    board(ctx, s, time, phase); dock(ctx, s, phase); feedback(ctx, scene, phase);
    ctx.restore();
  }
  GW.Render = { draw: draw };
})(window);
