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
  function plate(ctx, points, fill) {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
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
  // A furnace gallery recedes behind the glass: distant hot brick, middle
  // gantries and near cast pillars. Every layer stays darker than the ghost.
  function mechanism(ctx, phase, event, now) {
    ctx.save();
    var power = event ? Math.max(0, 1 - (now - event.at) / 1.3) : 0;
    var cold = event && event.rewind;
    var room = ctx.createLinearGradient(0, Y, 0, Y + 520);
    room.addColorStop(0, '#09151a'); room.addColorStop(.37, '#132629');
    room.addColorStop(.72, '#0e1e26'); room.addColorStop(1, '#05111b');
    ctx.fillStyle = room; ctx.fillRect(X, Y, 260, 520);
    // Rear wall is interrupted by a furnace mouth, not a bright decorative ring.
    plate(ctx, [[112,197],[211,197],[231,337],[94,337]], '#172728');
    for (var brick = 0; brick < 8; brick++) {
      var by = 204 + brick * 16;
      line(ctx, 110, by, 214, by, '#0b1b21', 2);
      for (var joint = 0; joint < 4; joint++) {
        var bx = 112 + joint * 30 + brick % 2 * 15;
        line(ctx, bx, by + 1, bx, by + 14, '#102023', 1);
      }
    }
    var heat = ctx.createRadialGradient(167, 282, 6, 167, 282, 122);
    heat.addColorStop(0, cold ? '#234148' : '#4a3827');
    heat.addColorStop(.36, cold ? '#162d34' : '#292b25');
    heat.addColorStop(1, '#0b1b2500');
    ctx.fillStyle = heat; ctx.fillRect(50, 150, 230, 270);
    plate(ctx, [[138,239],[190,239],[198,307],[130,307]], '#07151c');
    plate(ctx, [[146,248],[183,248],[187,297],[141,297]], cold ? '#203c42' : '#3a3024');
    for (var grate = 0; grate < 5; grate++) {
      line(ctx, 146 + grate * 8, 247, 141 + grate * 11, 299, '#101f24', 3);
    }
    line(ctx, 136, 307, 193, 307, cold ? '#34535a' : '#675037', 2);
    // Floor and ceiling converge on the same rear wall, giving a readable depth.
    plate(ctx, [[30,578],[112,325],[214,325],[290,578]], '#0a1921');
    plate(ctx, [[30,58],[290,58],[211,204],[113,204]], '#0a181e');
    for (var floor = 0; floor < 7; floor++) {
      var foot = 30 + floor * 44;
      line(ctx, foot, 578, 121 + floor * 14, 325, '#263637', .7);
    }
    for (var slab = 0; slab < 6; slab++) {
      var fy = 336 + slab * slab * 10;
      var spread = (fy - 325) / 253;
      line(ctx, 112 - 82 * spread, fy, 214 + 76 * spread, fy, '#1b2c31', 1);
      line(ctx, 112 - 82 * spread, fy + 2, 214 + 76 * spread, fy + 2, '#06131d', 2);
    }
    // Three decreasing gantries: lit inner bevels, dark undersides and cast feet.
    for (var bay = 2; bay >= 0; bay--) {
      var left = 43 + bay * 31, right = 282 - bay * 33;
      var top = 89 + bay * 46, bottom = 552 - bay * 87;
      var beam = 12 - bay * 2;
      plate(ctx, [[left,top+27],[left+24,top],[right-24,top],[right,top+27],
        [right,bottom],[right-beam,bottom],[right-beam,top+32],
        [right-28,top+beam],[left+28,top+beam],[left+beam,top+32],
        [left+beam,bottom],[left,bottom]], bay ? '#13252b' : '#1b2d30');
      line(ctx, left + beam, top + 32, left + beam, bottom - 4, '#405044', .7);
      line(ctx, left + 28, top + beam, right - 28, top + beam, '#3f4840', 1);
      line(ctx, right - beam, top + 32, right - beam, bottom, '#07131c', 3);
      line(ctx, left + 4, top + 29, left + 25, top + 5, '#455043', .7);
      for (var brace = 0; brace < 3; brace++) {
        var braceY = top + 55 + brace * (bottom - top - 70) / 3;
        line(ctx, left + 2, braceY, left + beam - 1, braceY + 11, '#07151d', 2);
        line(ctx, right - beam + 1, braceY, right - 2, braceY + 11, '#30413d', 1);
      }
    }
    // Suspended press and counterweight occupy the edges, leaving centre quiet.
    for (var chain = 0; chain < 2; chain++) {
      var cx = chain ? 257 : 65;
      line(ctx, cx, 73, cx, 343, '#050e17', 4);
      line(ctx, cx - 1, 73, cx - 1, 343, '#3b4840', .7);
      for (var link = 0; link < 25; link++) {
        var cy = 78 + link * 10 + (phase * 2 % 10);
        line(ctx, cx - 2, cy, cx + 2, cy + 3, '#32443e', .8);
      }
      var piston = ctx.createLinearGradient(cx - 8, 0, cx + 8, 0);
      piston.addColorStop(0, '#07151c'); piston.addColorStop(.32, '#3c4840');
      piston.addColorStop(.52, '#192d31'); piston.addColorStop(1, '#091820');
      ctx.fillStyle = piston; ctx.fillRect(cx - 7, 336, 14, 84);
      ctx.fillStyle = '#0b1b22'; ctx.fillRect(cx - 11, 345, 22, 8);
      line(ctx, cx - 10, 346, cx + 10, 346, '#445044', .8);
      ctx.fillRect(cx - 10, 410, 20, 9);
    }
    // Near left cast column breaks the middle silhouettes; only its bevel is lit.
    plate(ctx, [[30,58],[42,58],[42,184],[50,201],[50,546],[42,563],[42,578],[30,578]], '#07121a');
    line(ctx, 42, 70, 42, 184, '#4c4b3a', 1);
    line(ctx, 50, 202, 50, 544, '#38423b', 1);
    plate(ctx, [[279,58],[290,58],[290,578],[278,578],[273,550],[273,170],[279,150]], '#06121b');
    line(ctx, 273, 171, 273, 550, '#263d41', 1);
    // A shuttered work lamp establishes the warm source without lighting cells.
    ctx.fillStyle = '#0a171b'; ctx.fillRect(55, 110, 18, 31);
    var lamp = ctx.createRadialGradient(64, 125, 1, 64, 125, 104);
    lamp.addColorStop(0, cold ? 'rgba(113,199,203,.17)' : 'rgba(232,172,78,.2)');
    lamp.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lamp; ctx.fillRect(30, 58, 150, 190);
    for (var shutter = 0; shutter < 4; shutter++) {
      line(ctx, 59, 116 + shutter * 6, 69, 116 + shutter * 6, cold ? '#4c7776' : '#7b643b', 2);
    }
    // Atmospheric glass subdues the full room below the gameplay layer.
    ctx.fillStyle = 'rgba(3,13,22,.29)'; ctx.fillRect(X, Y, 260, 520);
    if (power) {
      var reflected = ctx.createRadialGradient(166, 286, 8, 166, 286, 230);
      reflected.addColorStop(0, cold ? 'rgba(116,217,232,' + power * .1 + ')' : 'rgba(255,187,78,' + power * .12 + ')');
      reflected.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = reflected; ctx.fillRect(X, Y, 260, 520);
      line(ctx, 136, 307, 193, 307, cold ? 'rgba(119,216,228,' + power * .45 + ')' : 'rgba(248,189,100,' + power * .45 + ')', 2);
    }
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
    // Cast enamel face: a warm lip, recessed panel and dark cut lower bevel.
    ctx.fillStyle = 'rgba(5,19,25,.24)';
    ctx.beginPath(); ctx.moveTo(px + 2, py + C - 7); ctx.lineTo(px + 7, py + C - 11);
    ctx.lineTo(px + C - 7, py + C - 11); ctx.lineTo(px + C - 2, py + C - 7);
    ctx.lineTo(px + C - 2, py + C - 3); ctx.lineTo(px + 2, py + C - 3); ctx.closePath(); ctx.fill();
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
  function board(ctx, s, time, phase, scene) {
    ctx.fillStyle = '#07121e'; rounded(ctx, 19, 47, 282, 542, 12); ctx.fill();
    var rim = ctx.createLinearGradient(19, 47, 301, 589);
    rim.addColorStop(0, '#ead6a2'); rim.addColorStop(.12, '#897d56');
    rim.addColorStop(.28, '#3b4944'); rim.addColorStop(.49, '#b39a65');
    rim.addColorStop(.54, '#4e523e'); rim.addColorStop(.82, '#c1ad79'); rim.addColorStop(1, '#534932');
    ctx.fillStyle = rim; rounded(ctx, 22, 50, 276, 536, 10); ctx.fill();
    ctx.fillStyle = '#081725'; rounded(ctx, 27, 55, 266, 526, 5); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(X, Y, 260, 520); ctx.clip();
    mechanism(ctx, phase, scene.event, phase);
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
  function dock(ctx, s, phase, event) {
    var plate = ctx.createLinearGradient(0, 595, 0, 666);
    var age = event ? phase - event.at : 2;
    var powered = event && age < 1.5 && (event.rewind || event.cogs || event.rows.length === 4);
    var received = powered ? Math.sin(Math.min(1, Math.max(0, age / 1.5)) * Math.PI) : 0;
    plate.addColorStop(0, powered ? (event.rewind ? '#244d5b' : '#56482b') : '#1e3a4c');
    plate.addColorStop(1, '#0b1c2d');
    ctx.fillStyle = plate; rounded(ctx, 20, 593, 280, 73, 9); ctx.fill();
    ctx.strokeStyle = '#426879'; ctx.lineWidth = 1;
    rounded(ctx, 20.5, 593.5, 279, 72, 9); ctx.stroke();
    line(ctx, 153, 603, 153, 657, '#355a6a', 1);
    if (powered) {
      // A broad reflected pool under the bank is legible even on the small well.
      var bankLight = ctx.createRadialGradient(222, 644, 8, 222, 644, 75);
      bankLight.addColorStop(0, event.rewind ? 'rgba(108,230,241,' + received * .25 + ')' : 'rgba(255,196,86,' + received * .35 + ')');
      bankLight.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.beginPath(); ctx.rect(155, 595, 143, 69); ctx.clip();
      ctx.fillStyle = bankLight; ctx.fillRect(155, 595, 143, 69); ctx.restore();
    }
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
  function feedback(ctx, scene, now, s) {
    var event = scene.event;
    if (!event) return;
    var age = Math.max(0, now - event.at), duration = event.rewind ? 1.45 : 1.5;
    if (age > duration) { scene.event = null; return; }
    var p = age / duration, fade = Math.pow(1 - p, 1.3);
    // Exclude the live piece and landing guide from reward overlays. Rules never pause.
    ctx.save(); ctx.beginPath(); ctx.rect(X, Y, 260, 520);
    if (s.piece) {
      var protectedCells = {};
      L.cells(s.piece).concat(L.cells(L.ghost(s))).forEach(function (cell) {
        var key = cell.x + ':' + cell.y;
        if (cell.y >= 0 && !protectedCells[key]) {
          protectedCells[key] = true; ctx.rect(X + cell.x * C, Y + cell.y * C, C, C);
        }
      });
    }
    ctx.clip('evenodd');
    if (!event.rewind) {
      event.rows.forEach(function (row, rowIndex) {
        var y = Y + row * C + C / 2;
        // Stage 1: a thin white-hot seam. Stage 2: two travelling weld fronts.
        var seam = Math.max(0, 1 - age / .2), sweep = Math.min(1, Math.max(0, (age - .08) / .4));
        line(ctx, X, y, X + 260, y, 'rgba(255,239,185,' + seam * .7 + ')', 2);
        if (age < .55) {
          for (var side = -1; side <= 1; side += 2) {
            var front = 160 + side * 130 * sweep;
            var glow = ctx.createRadialGradient(front, y, 0, front, y, 22);
            glow.addColorStop(0, 'rgba(255,233,161,' + fade * .5 + ')');
            glow.addColorStop(1, 'rgba(255,177,66,0)');
            ctx.fillStyle = glow; ctx.fillRect(front - 22, y - 12, 44, 24);
            line(ctx, front, y - 5, front, y + 5, 'rgba(255,249,215,' + fade + ')', 2);
          }
        }
        // Hot filings eject into the row gutters, then fall and extinguish.
        for (var i = 0; i < 14; i++) {
          var t = Math.max(0, age - .13 - i % 3 * .025);
          if (!t || t > .65) continue;
          var direction = i % 2 ? 1 : -1;
          var px = 160 + direction * Math.min(127, t * (180 + i * 19));
          var py = y - Math.sin(i * 4 + rowIndex) * 19 * t + 35 * t * t;
          line(ctx, px, py, px - direction * 4, py - 1, 'rgba(255,207,124,' + (1 - t / .65) * .8 + ')', i % 4 ? .8 : 1.5);
        }
      });
    }
    ctx.restore();
    // Stage 3: earned cogs travel down the outside rail, then seat in the bank.
    // Rewind reverses the same physical route: three paid cogs leave the bank.
    var flights = event.rewind ? 3 : Math.min(3, event.cogs);
    for (var gear = 0; gear < flights; gear++) {
      var delay = gear * .08, travel = Math.min(1, Math.max(0, (age - .22 - delay) / .7));
      if (age < .22 + delay || age > 1.18 + delay) continue;
      var eased = travel * travel * (3 - 2 * travel);
      var bankSlot = event.rewind ? gear : Math.min(2, event.bankBefore + gear);
      var bankX = 185 + bankSlot * 35;
      var sourceY = event.rewind ? 358 : Y + event.rows[event.rows.length - 1] * C + C / 2;
      var path = event.rewind ? 1 - eased : eased;
      // The flight bows into the 17px rail, avoiding all active cells.
      var gx, gy;
      if (path < .65) { gx = 303; gy = sourceY + (603 - sourceY) * path / .65; }
      else { gx = 303 + (bankX - 303) * (path - .65) / .35; gy = 603 + 33 * (path - .65) / .35; }
      ctx.save(); ctx.globalAlpha = travel > .9 ? (1 - travel) * 10 : 1;
      ctx.shadowColor = event.rewind ? '#8feaf2' : '#ffd47d'; ctx.shadowBlur = 10;
      cog(ctx, gx, gy, 6, true, (event.rewind ? -1 : 1) * age * 9); ctx.restore();
    }
    // Stage 4: the four-line surge feeds both rails before settling in the bank.
    if (!event.rewind && event.rows.length === 4) {
      var surge = Math.sin(Math.min(1, age / 1.5) * Math.PI);
      var fromY = Y + event.rows[0] * C;
      ctx.save(); ctx.shadowColor = '#ffbd55'; ctx.shadowBlur = 10;
      for (var rail = 0; rail < 2; rail++) {
        var railX = rail ? 295 : 25;
        line(ctx, railX, fromY, railX, 579, 'rgba(255,203,112,' + surge * .85 + ')', 2.5);
        line(ctx, railX, 578, rail ? 282 : 38, 586, 'rgba(255,223,150,' + surge + ')', 2);
      }
      ctx.restore();
      // The frame reflects the surge; foreground cells are never washed out.
      ctx.save(); ctx.strokeStyle = 'rgba(255,213,129,' + surge * .65 + ')'; ctx.lineWidth = 3;
      rounded(ctx, 21, 49, 278, 538, 10); ctx.stroke(); ctx.restore();
    }
    // Reverse-motion rail pulses belong to the paid rewind, rather than any clear.
    if (event.rewind) {
      for (var pulse = 0; pulse < 5; pulse++) {
        var railY = Y + 520 - ((age * 570 + pulse * 104) % 520);
        line(ctx, 25, railY, 25, railY + 24, 'rgba(142,235,243,' + fade * .9 + ')', 2);
        line(ctx, 295, railY, 295, railY + 24, 'rgba(142,235,243,' + fade * .9 + ')', 2);
      }
    } else if (event.cogs && age > .85) {
      var settle = Math.max(0, 1 - (age - .85) / .65);
      ctx.save(); ctx.strokeStyle = 'rgba(255,220,147,' + settle * .8 + ')'; ctx.lineWidth = 1.5;
      for (var bank = 0; bank < flights; bank++) {
        var slot = Math.min(2, event.bankBefore + bank);
        ctx.beginPath(); ctx.arc(185 + slot * 35, 636, 11 + (1 - settle) * 12, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = fade * .7;
    ctx.strokeStyle = event.rewind ? '#91e6ed' : '#ffe1a2'; ctx.lineWidth = 1.5;
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
        cogs: rewound ? 0 : Math.max(0, s.cogs - scene.cogs), bankBefore: scene.cogs };
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
    var eventAge = scene.event ? phase - scene.event.at : 2;
    var major = scene.event && eventAge < 1.5 && (scene.event.rewind || scene.event.rows.length === 4);
    cap.addColorStop(0, major ? (scene.event.rewind ? '#91ccd0' : '#dbc58b') : '#4a5147');
    cap.addColorStop(.15, major ? (scene.event.rewind ? '#365763' : '#6c5733') : '#303e3e');
    cap.addColorStop(1, major ? (scene.event.rewind ? '#173f50' : '#342b1c') : '#13242e');
    ctx.fillStyle = cap; rounded(ctx, 20, 9, 280, 33, 5); ctx.fill();
    line(ctx, 26, 10, 294, 10, major ? (scene.event.rewind ? '#b4f1f5' : '#ffe5a0') : '#9e9572', major ? 1.5 : .8);
    ctx.fillStyle = '#e5d9b4'; ctx.font = 'bold 13px system-ui';
    var announcing = s.last && time < 1.45 && s.last !== 'LOCKED' && s.last !== 'READY';
    ctx.fillStyle = announcing ? '#ffdfa0' : '#e5d9b4';
    ctx.font = announcing ? 'bold 12px system-ui' : 'bold 13px system-ui';
    ctx.fillText(announcing ? s.last : 'CHRONO FOUNDRY', 33, 30, 178);
    // The brass nameplate carries an explicit state, never unexplained meters.
    line(ctx, 222, 17, 222, 34, '#526058', .8);
    ctx.fillStyle = '#b5c7c6'; ctx.font = 'bold 10px system-ui';
    ctx.fillText('LV ' + String(s.level).padStart(2, '0'), 238, 29);
    board(ctx, s, time, phase, scene); dock(ctx, s, phase, scene.event); feedback(ctx, scene, phase, s);
    ctx.restore();
  }
  GW.Render = { draw: draw };
})(window);
