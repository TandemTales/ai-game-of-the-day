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
  function mechanism(ctx, x, y, radius, rotation) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
    ctx.globalAlpha = .13;
    cog(ctx, 0, 0, radius, false);
    ctx.strokeStyle = '#79949b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, radius * .76, 0, TAU); ctx.stroke();
    for (var i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate(i * TAU / 6);
      line(ctx, radius * .28, 0, radius * .71, 0, '#6d8993', radius * .1);
      ctx.restore();
    }
    ctx.fillStyle = '#0a1d2b'; ctx.beginPath(); ctx.arc(0, 0, radius * .2, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.restore();
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
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    rounded(ctx, px + 2, py + 4, C - 2, C - 2, 4); ctx.fill();
    rounded(ctx, px + 1, py + 1, C - 2, C - 3, 4);
    var face = ctx.createLinearGradient(px, py, px + C, py + C);
    face.addColorStop(0, '#e1efed'); face.addColorStop(.12, L.COLORS[kind]);
    face.addColorStop(.62, L.COLORS[kind]); face.addColorStop(1, '#193546');
    ctx.fillStyle = face; ctx.fill();
    ctx.fillStyle = 'rgba(5,24,36,.13)';
    rounded(ctx, px + 5, py + 7, C - 10, C - 14, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.26)';
    rounded(ctx, px + 3, py + 3, C - 6, 5, 2); ctx.fill();
    ctx.fillStyle = 'rgba(6,20,32,.2)';
    rounded(ctx, px + 4, py + C - 7, C - 8, 3, 1); ctx.fill();
    rounded(ctx, px + 1.5, py + 1.5, C - 3, C - 4, 4);
    ctx.strokeStyle = 'rgba(255,255,255,.42)'; ctx.lineWidth = 1; ctx.stroke();
    line(ctx, px + 3, py + C - 5, px + 3, py + 7, 'rgba(255,255,255,.3)', 1);
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
    var well = ctx.createRadialGradient(160, 320, 25, 160, 320, 320);
    well.addColorStop(0, '#12283b'); well.addColorStop(.65, '#0d2132'); well.addColorStop(1, '#071726');
    ctx.fillStyle = well; ctx.fillRect(X, Y, 260, 520);
    ctx.save(); ctx.beginPath(); ctx.rect(X, Y, 260, 520); ctx.clip();
    mechanism(ctx, 82, 202, 77, phase * .035);
    mechanism(ctx, 240, 285, 103, -phase * .026 + .18);
    mechanism(ctx, 76, 458, 65, phase * .042);
    ctx.strokeStyle = 'rgba(173,184,156,.055)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(160, 320, 218, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(160, 320, 222, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(143,191,197,.105)'; ctx.lineWidth = 1;
    for (var x = 0; x <= 10; x++) {
      ctx.beginPath(); ctx.moveTo(X + x * C + .5, Y); ctx.lineTo(X + x * C + .5, Y + 520); ctx.stroke();
    }
    for (var y = 0; y <= 20; y++) {
      ctx.beginPath(); ctx.moveTo(X, Y + y * C + .5); ctx.lineTo(X + 260, Y + y * C + .5); ctx.stroke();
    }
    for (y = 5; y < 20; y += 5) {
      line(ctx, X + 1, Y + y * C + .5, X + 259, Y + y * C + .5, 'rgba(176,226,222,.21)', 1);
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
    if (s.last && time < 1.45 && s.last !== 'LOCKED' && s.last !== 'READY') {
      ctx.globalAlpha = Math.max(0, Math.min(1, (1.45 - time) * 2));
      ctx.fillStyle = '#0a1b2deb'; rounded(ctx, 67, 258, 186, 45, 6); ctx.fill();
      ctx.strokeStyle = '#e3bb72'; ctx.stroke();
      ctx.fillStyle = '#fff0c8'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(s.last, 160, 286, 172); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }
  }
  function dock(ctx, s, phase) {
    var plate = ctx.createLinearGradient(0, 595, 0, 666);
    plate.addColorStop(0, '#1e3a4c'); plate.addColorStop(1, '#0b1c2d');
    ctx.fillStyle = plate; rounded(ctx, 20, 593, 280, 73, 9); ctx.fill();
    ctx.strokeStyle = '#426879'; ctx.lineWidth = 1;
    rounded(ctx, 20.5, 593.5, 279, 72, 9); ctx.stroke();
    line(ctx, 153, 603, 153, 657, '#355a6a', 1);
    ctx.fillStyle = '#c4dadd'; ctx.font = 'bold 11px system-ui';
    ctx.fillText('UP NEXT', 32, 611); ctx.fillText('REWIND BANK', 168, 611);
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
    ctx.fillStyle = ready ? '#ffdfa0' : '#91abb5';
    ctx.font = ready ? 'bold 10.5px system-ui' : '11px system-ui';
    ctx.fillText(ready ? s.cogs + ' COGS · READY [U]' : s.cogs + ' / 3 COGS', 168, 660);
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
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1b3b4e'); bg.addColorStop(.52, '#0b2032'); bg.addColorStop(1, '#081724');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(182,219,215,.055)'; ctx.lineWidth = 1;
    for (var d = -h; d < w; d += 18) {
      ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + h, h); ctx.stroke();
    }
    ctx.fillStyle = '#d7edeb'; ctx.font = 'bold 14px system-ui';
    ctx.fillText('G E A R W E L L', 42, 30);
    cog(ctx, 28, 25, 7, true, phase * .14);
    ctx.fillStyle = '#ffdb94'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'right';
    ctx.fillText('LEVEL  ' + s.level, 298, 29); ctx.textAlign = 'left';
    line(ctx, 22, 39.5, 298, 39.5, '#547786', 1);
    line(ctx, 22, 40.5, 96, 40.5, '#d7ad68', 2);
    board(ctx, s, time, phase); dock(ctx, s, phase); feedback(ctx, scene, phase);
    ctx.restore();
  }
  GW.Render = { draw: draw };
})(window);
