(function (global) {
  'use strict';
  var GW = global.GW = global.GW || {}, L = GW.Logic;
  var X = 30, Y = 58, C = 26;
  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }
  function block(ctx, x, y, kind, gear, alpha) {
    var px = X + x * C, py = Y + y * C, color = L.COLORS[kind];
    ctx.globalAlpha = alpha;
    rounded(ctx, px + 1, py + 1, C - 2, C - 2, 5);
    ctx.fillStyle = color; ctx.fill();
    rounded(ctx, px + 3, py + 3, C - 6, 7, 3);
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fill();
    ctx.strokeStyle = 'rgba(13,21,32,.35)'; ctx.lineWidth = 1;
    rounded(ctx, px + 1.5, py + 1.5, C - 3, C - 3, 5); ctx.stroke();
    if (gear) {
      ctx.fillStyle = '#132036'; ctx.beginPath(); ctx.arc(px + C / 2, py + C / 2, 7, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff3b8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px + C / 2, py + C / 2, 4, 0, 7); ctx.stroke();
      ctx.fillStyle = '#fff3b8'; ctx.beginPath(); ctx.arc(px + C / 2, py + C / 2, 1.5, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function draw(canvas, s, time) {
    var ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#16283c'); bg.addColorStop(1, '#080f1e');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8fb3c1'; ctx.font = 'bold 12px system-ui';
    ctx.fillText('G E A R W E L L', 30, 32);
    ctx.fillStyle = '#f1c979'; ctx.textAlign = 'right'; ctx.fillText('LEVEL ' + s.level, 290, 32); ctx.textAlign = 'left';
    rounded(ctx, 23, 51, 274, 534, 10); ctx.fillStyle = '#3c5368'; ctx.fill();
    rounded(ctx, 28, 56, 264, 524, 5); ctx.fillStyle = '#0b1728'; ctx.fill();
    ctx.strokeStyle = 'rgba(123,176,194,.09)'; ctx.lineWidth = 1;
    for (var x = 0; x <= 10; x++) { ctx.beginPath(); ctx.moveTo(X + x * C, Y); ctx.lineTo(X + x * C, Y + 20 * C); ctx.stroke(); }
    for (var y = 0; y <= 20; y++) { ctx.beginPath(); ctx.moveTo(X, Y + y * C); ctx.lineTo(X + 10 * C, Y + y * C); ctx.stroke(); }
    for (y = 0; y < L.H; y++) for (x = 0; x < L.W; x++) {
      var cell = s.board[y][x]; if (cell) block(ctx, x, y, cell.kind, cell.gear, 1);
    }
    if (s.piece) {
      var g = L.ghost(s);
      L.cells(g).forEach(function (c) { if (c.y >= 0) block(ctx, c.x, c.y, g.kind, false, .18); });
      L.cells(s.piece).forEach(function (c) { if (c.y >= 0) block(ctx, c.x, c.y, s.piece.kind, c.gear, 1); });
    }
    ctx.fillStyle = '#a9becb'; ctx.font = '11px system-ui';
    ctx.fillText('NEXT', 30, 610); ctx.fillText('COGS', 170, 610);
    var next = s.queue[0];
    if (next) {
      var preview = { kind: next, x: 0, y: 0, rot: 0, gear: false };
      L.cells(preview).forEach(function (c) {
        rounded(ctx, 28 + c.x * 13, 614 + c.y * 13, 11, 11, 2);
        ctx.fillStyle = L.COLORS[next]; ctx.fill();
      });
    }
    for (x = 0; x < 3; x++) {
      ctx.beginPath(); ctx.arc(204 + x * 26, 630, 9, 0, 7);
      ctx.fillStyle = x < s.cogs ? '#f1c979' : '#273b4f'; ctx.fill();
      ctx.strokeStyle = '#d4a954'; ctx.stroke();
    }
    if (s.cogs >= 3) { ctx.fillStyle = '#f9dc9e'; ctx.fillText('REWIND READY', 170, 653); }
    else { ctx.fillStyle = '#718b9b'; ctx.fillText('3 COGS TO REWIND', 170, 653); }
    if (s.last && time < 2.1) {
      ctx.textAlign = 'center'; ctx.fillStyle = '#f7dcaa'; ctx.font = 'bold 12px system-ui';
      ctx.fillText(s.last, 160, 48); ctx.textAlign = 'left';
    }
  }
  GW.Render = { draw: draw };
})(window);
