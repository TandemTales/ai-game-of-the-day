(function (global) {
  'use strict';
  var R = (global.PL = global.PL || {}).Render = {};
  var colors = ['#ffca75', '#ff7698', '#74e2df', '#b9a8ff'];
  var keys = ['D', 'F', 'J', 'K'];
  var left = 104, laneW = 148, top = 91, line = 506;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(v) { return v * v * (3 - 2 * v); }
  function center(i) { return left + (i + .5) * laneW; }
  function strand(i, section) { return colors[(i - section + 4) % 4]; }

  function backdrop(ctx, beat) {
    var bg = ctx.createLinearGradient(0, 0, 800, 600);
    bg.addColorStop(0, '#12142b'); bg.addColorStop(.52, '#101b2e'); bg.addColorStop(1, '#090f20');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 800, 600);
    var halo = ctx.createRadialGradient(400, 288, 12, 400, 288, 430);
    halo.addColorStop(0, 'rgba(91,78,157,.29)');
    halo.addColorStop(.65, 'rgba(42,74,105,.12)');
    halo.addColorStop(1, 'rgba(4,8,20,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 800, 600);
    for (var i = 0; i < 48; i++) {
      var x = (i * 181 + 57) % 800, y = (i * 127 + 29) % 600;
      ctx.fillStyle = 'rgba(213,226,255,' + (.10 + .12 * (1 + Math.sin(beat * .8 + i)) / 2) + ')';
      ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
    }
    ctx.strokeStyle = 'rgba(164,174,228,.06)'; ctx.lineWidth = 1;
    for (var r = 0; r < 5; r++) {
      ctx.beginPath(); ctx.ellipse(400, 320, 290 + r * 40, 175 + r * 30, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function loom(ctx, beat, section) {
    var board = ctx.createLinearGradient(0, top, 0, 553);
    board.addColorStop(0, 'rgba(7,13,29,.76)'); board.addColorStop(1, 'rgba(10,18,39,.94)');
    ctx.shadowColor = '#050816'; ctx.shadowBlur = 30;
    ctx.fillStyle = board; ctx.beginPath(); ctx.roundRect(left - 13, top - 14, laneW * 4 + 26, 479, 18); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(172,184,232,.33)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(left - 13, top - 14, laneW * 4 + 26, 479, 18); ctx.stroke();
    for (var lane = 0; lane < 4; lane++) {
      var x = left + lane * laneW, hue = strand(lane, section);
      var fill = ctx.createLinearGradient(0, top, 0, line);
      fill.addColorStop(0, 'rgba(255,255,255,.015)');
      fill.addColorStop(1, 'rgba(255,255,255,.06)');
      ctx.fillStyle = fill; ctx.fillRect(x + 3, top, laneW - 6, line - top + 39);
      ctx.fillStyle = hue; ctx.globalAlpha = .12;
      ctx.fillRect(x + 8, top, 3, line - top + 40);
      ctx.fillRect(x + laneW - 11, top, 3, line - top + 40);
      ctx.globalAlpha = 1;
      if (lane > 0) {
        ctx.strokeStyle = 'rgba(180,198,241,.16)'; ctx.beginPath();
        ctx.moveTo(x, top); ctx.lineTo(x, 553); ctx.stroke();
      }
      var pulse = .5 + .5 * Math.cos((beat - Math.floor(beat)) * Math.PI * 2);
      ctx.fillStyle = hue; ctx.globalAlpha = .23 + pulse * .09;
      ctx.beginPath(); ctx.arc(center(lane), line, 42, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = hue; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(center(lane), line, 31, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,249,231,.56)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(center(lane), line, 23, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f8eddf'; ctx.font = '800 19px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(keys[lane], center(lane), 543);
    }
    ctx.shadowColor = '#ffe3a9'; ctx.shadowBlur = 17;
    ctx.strokeStyle = '#ffe7b6'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(left, line); ctx.lineTo(left + 4 * laneW, line); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff8e8'; ctx.fillRect(left, line - 1, 4 * laneW, 2);
  }

  function beatGrid(ctx, beat, time, logic) {
    for (var b = Math.ceil(beat); b < Math.min(logic.TOTAL_BEATS, beat + 5); b++) {
      var y = line - (b * logic.BEAT - time) * 220;
      if (y < top || y >= line) continue;
      ctx.strokeStyle = b % 4 === 0 ? 'rgba(255,230,185,.34)' : 'rgba(221,229,255,.10)';
      ctx.lineWidth = b % 4 === 0 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + 4 * laneW, y); ctx.stroke();
      if (b % 4 === 0) {
        ctx.fillStyle = 'rgba(255,230,185,.64)'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'right';
        ctx.fillText(String(Math.floor(b / 4) + 1).padStart(2, '0'), left - 21, y + 4);
      }
    }
  }

  function notes(ctx, run, time) {
    run.notes.forEach(function (note) {
      if (note.status) return;
      var y = line - (note.time - time) * 220;
      if (y < top - 24 || y > line + 40) return;
      var x = center(note.lane), hue = colors[note.base];
      ctx.shadowColor = hue; ctx.shadowBlur = 24;
      ctx.fillStyle = hue; ctx.beginPath(); ctx.roundRect(x - 46, y - 17, 92, 34, 13); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,.82)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x - 46, y - 17, 92, 34, 13); ctx.stroke();
      ctx.fillStyle = 'rgba(9,15,30,.53)'; ctx.beginPath(); ctx.roundRect(x - 37, y - 10, 74, 20, 8); ctx.fill();
      ctx.fillStyle = '#fff9ee'; ctx.fillRect(x - 24, y - 2, 48, 4);
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    });
  }

  function rotation(ctx, beat) {
    var section = Math.floor(beat / 32), next = (section + 1) * 32;
    var preview = section < 3 && beat >= next - 3 && beat < next;
    var settling = section > 0 && section < 4 && beat < section * 32 + .85;
    if (!preview && !settling) return;
    var amount = preview ? ease(clamp((beat - (next - 3)) / 3, 0, 1)) : 1;
    var opacity = settling ? 1 - (beat - section * 32) / .85 : 1;
    var current = preview ? section : section - 1;
    ctx.save(); ctx.globalAlpha = opacity;
    ctx.fillStyle = 'rgba(8,13,29,.95)'; ctx.beginPath(); ctx.roundRect(130, 94, 540, 85, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,225,172,.68)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(130, 94, 540, 85, 14); ctx.stroke();
    ctx.fillStyle = '#fff0cf'; ctx.font = '800 16px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(preview ? 'LOOM SHIFT  →  ' + Math.ceil(next - beat) + ' BEATS' : 'NEW THREAD POSITION', 400, 119);
    for (var base = 0; base < 4; base++) {
      var from = center((base + current) % 4);
      var to = center((base + current + 1) % 4);
      if (to < from) to += 4 * laneW;
      var x = from + (to - from) * amount;
      if (x > center(3) + laneW / 2) x -= 4 * laneW;
      ctx.strokeStyle = colors[base]; ctx.globalAlpha = opacity * .4; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(from, 143); ctx.lineTo(x, 156); ctx.stroke();
      ctx.globalAlpha = opacity; ctx.shadowColor = colors[base]; ctx.shadowBlur = 13;
      ctx.fillStyle = colors[base]; ctx.beginPath(); ctx.arc(x, 150, 8, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  R.draw = function (canvas, run, time, state) {
    var ctx = canvas.getContext('2d'), logic = global.PL.Logic;
    var beat = time / logic.BEAT, section = Math.min(3, Math.floor(beat / 32));
    ctx.setTransform(canvas.width / 800, 0, 0, canvas.height / 600, 0, 0);
    backdrop(ctx, beat); loom(ctx, beat, section); beatGrid(ctx, beat, time, logic); notes(ctx, run, time);
    if (state.flashUntil > time) {
      var intensity = clamp((state.flashUntil - time) / .22, 0, 1);
      ctx.globalAlpha = intensity * .56; ctx.fillStyle = strand(state.flashLane, section);
      ctx.beginPath(); ctx.arc(center(state.flashLane), line, 34 + (1 - intensity) * 48, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    rotation(ctx, beat);
  };
})(typeof window !== 'undefined' ? window : this);
