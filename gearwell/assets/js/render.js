(function (global) {
  'use strict';
  var GW = global.GW = global.GW || {}, L = GW.Logic;
  var X = 30, Y = 58, C = 26, TAU = Math.PI * 2;

  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }
  function line(ctx, x1, y1, x2, y2, color, width) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function cog(ctx, x, y, radius, lit) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = lit ? '#fbdc90' : '#324957';
    for (var i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate(i * TAU / 8);
      rounded(ctx, -2, -radius - 2, 4, 6, 1); ctx.fill(); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill();
    ctx.fillStyle = lit ? '#885a2e' : '#101e2c';
    ctx.beginPath(); ctx.arc(0, 0, radius * .48, 0, TAU); ctx.fill();
    ctx.strokeStyle = lit ? '#fff1bf' : '#5e7681'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, radius - .8, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function block(ctx, x, y, kind, gear, ghost) {
    var px = X + x * C, py = Y + y * C;
    if (ghost) {
      rounded(ctx, px + 2, py + 2, C - 4, C - 4, 4);
      ctx.fillStyle = 'rgba(207,238,237,.07)'; ctx.fill();
      ctx.strokeStyle = 'rgba(195,236,234,.48)'; ctx.lineWidth = 1.5; ctx.stroke();
      line(ctx, px + 7, py + C - 6, px + C - 7, py + C - 6, 'rgba(207,238,237,.28)', 1);
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    rounded(ctx, px + 2, py + 4, C - 2, C - 2, 4); ctx.fill();
    rounded(ctx, px + 1, py + 1, C - 2, C - 3, 4);
    ctx.fillStyle = L.COLORS[kind]; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.26)';
    rounded(ctx, px + 3, py + 3, C - 6, 5, 2); ctx.fill();
    ctx.fillStyle = 'rgba(6,20,32,.2)';
    rounded(ctx, px + 4, py + C - 7, C - 8, 3, 1); ctx.fill();
    rounded(ctx, px + 1.5, py + 1.5, C - 3, C - 4, 4);
    ctx.strokeStyle = 'rgba(255,255,255,.42)'; ctx.lineWidth = 1; ctx.stroke();
    line(ctx, px + 3, py + C - 5, px + 3, py + 7, 'rgba(255,255,255,.3)', 1);
    if (gear) {
      ctx.fillStyle = '#132536'; ctx.beginPath(); ctx.arc(px + 13, py + 14, 9, 0, TAU); ctx.fill();
      cog(ctx, px + 13, py + 14, 5, true);
    } else {
      line(ctx, px + C - 6, py + 10, px + C - 6, py + C - 8, 'rgba(255,255,255,.16)', 1);
    }
  }
  function rivet(ctx, x, y) {
    ctx.fillStyle = '#081421'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7c9ba3'; ctx.beginPath(); ctx.arc(x - .5, y - .5, 1, 0, TAU); ctx.fill();
  }
  function board(ctx, s, time) {
    ctx.fillStyle = '#07121e'; rounded(ctx, 19, 47, 282, 542, 12); ctx.fill();
    var rim = ctx.createLinearGradient(19, 47, 301, 589);
    rim.addColorStop(0, '#a0b9ba'); rim.addColorStop(.18, '#345468');
    rim.addColorStop(.5, '#19374b'); rim.addColorStop(.82, '#739195'); rim.addColorStop(1, '#183344');
    ctx.fillStyle = rim; rounded(ctx, 22, 50, 276, 536, 10); ctx.fill();
    ctx.fillStyle = '#081725'; rounded(ctx, 27, 55, 266, 526, 5); ctx.fill();
    var well = ctx.createRadialGradient(160, 320, 25, 160, 320, 320);
    well.addColorStop(0, '#12283b'); well.addColorStop(.65, '#0d2132'); well.addColorStop(1, '#071726');
    ctx.fillStyle = well; ctx.fillRect(X, Y, 260, 520);
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
    rivet(ctx, 24, 54); rivet(ctx, 296, 54); rivet(ctx, 24, 582); rivet(ctx, 296, 582);
    if (s.last && time < 1.45 && s.last !== 'LOCKED' && s.last !== 'READY') {
      ctx.globalAlpha = Math.max(0, Math.min(1, (1.45 - time) * 2));
      ctx.fillStyle = '#0a1b2deb'; rounded(ctx, 67, 258, 186, 45, 6); ctx.fill();
      ctx.strokeStyle = '#e3bb72'; ctx.stroke();
      ctx.fillStyle = '#fff0c8'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(s.last, 160, 286, 172); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }
  }
  function dock(ctx, s) {
    var plate = ctx.createLinearGradient(0, 595, 0, 666);
    plate.addColorStop(0, '#1e3a4c'); plate.addColorStop(1, '#0b1c2d');
    ctx.fillStyle = plate; rounded(ctx, 20, 593, 280, 73, 9); ctx.fill();
    ctx.strokeStyle = '#426879'; ctx.lineWidth = 1;
    rounded(ctx, 20.5, 593.5, 279, 72, 9); ctx.stroke();
    line(ctx, 153, 603, 153, 657, '#355a6a', 1);
    ctx.fillStyle = '#aac4c9'; ctx.font = 'bold 10px system-ui';
    ctx.fillText('UP NEXT', 32, 611); ctx.fillText('REWIND BANK', 168, 611);
    var next = s.queue[0];
    if (next) {
      var preview = { kind: next, x: 0, y: 0, rot: 0, gear: false }, cells = L.cells(preview);
      var minX = Math.min.apply(null, cells.map(function (c) { return c.x; }));
      var maxX = Math.max.apply(null, cells.map(function (c) { return c.x; }));
      var minY = Math.min.apply(null, cells.map(function (c) { return c.y; }));
      var startX = 88 - (maxX - minX + 1) * 7;
      cells.forEach(function (cell) {
        var px = startX + (cell.x - minX) * 14, py = 624 + (cell.y - minY) * 14;
        ctx.fillStyle = L.COLORS[next]; rounded(ctx, px, py, 12, 12, 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.24)'; rounded(ctx, px + 2, py + 2, 8, 2, 1); ctx.fill();
      });
    }
    var ready = s.cogs >= 3;
    for (var i = 0; i < 3; i++) cog(ctx, 185 + i * 35, 636, 8, i < s.cogs);
    ctx.fillStyle = ready ? '#ffdfa0' : '#91abb5';
    ctx.font = ready ? 'bold 10px system-ui' : '10px system-ui';
    ctx.fillText(ready ? s.cogs + ' COGS  ·  U TO REWIND' : s.cogs + ' / 3  ·  FILL TO REWIND', 168, 660);
  }
  function draw(canvas, s, time) {
    var ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1b3b4e'); bg.addColorStop(.52, '#0b2032'); bg.addColorStop(1, '#081724');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(182,219,215,.055)'; ctx.lineWidth = 1;
    for (var d = -h; d < w; d += 18) {
      ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + h, h); ctx.stroke();
    }
    ctx.fillStyle = '#d7edeb'; ctx.font = 'bold 14px system-ui';
    ctx.fillText('G E A R W E L L', 22, 30);
    ctx.fillStyle = '#ffdb94'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'right';
    ctx.fillText('LEVEL  ' + s.level, 298, 29); ctx.textAlign = 'left';
    line(ctx, 22, 39.5, 298, 39.5, '#547786', 1);
    line(ctx, 22, 40.5, 96, 40.5, '#d7ad68', 2);
    board(ctx, s, time); dock(ctx, s);
  }
  GW.Render = { draw: draw };
})(window);
