(function (global) {
  'use strict';
  var R = (global.PL = global.PL || {}).Render = {};
  var colors = ['#f5bd65', '#fb718f', '#76d6da', '#b6a2ff'];
  R.draw = function (canvas, run, time, state) {
    var ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    var sx = w / 800, sy = h / 600;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    var bg = ctx.createLinearGradient(0, 0, 800, 600);
    bg.addColorStop(0, '#101627'); bg.addColorStop(0.58, '#202037'); bg.addColorStop(1, '#0d1524');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = 'rgba(247,201,131,.04)';
    for (var j = 0; j < 30; j++) ctx.fillRect((j * 181 + 57) % 800, (j * 127 + 29) % 600, 2, 2);
    var left = 104, laneW = 148, top = 64, line = 506;
    ctx.fillStyle = 'rgba(5,10,22,.6)'; ctx.fillRect(left - 10, top, 4 * laneW + 20, 486);
    for (var i = 0; i < 4; i++) {
      var x = left + i * laneW;
      ctx.fillStyle = colors[i]; ctx.globalAlpha = 0.08; ctx.fillRect(x + 2, top, laneW - 4, 486); ctx.globalAlpha = 1;
      ctx.strokeStyle = colors[i]; ctx.globalAlpha = 0.35; ctx.strokeRect(x + 2, top, laneW - 4, 486); ctx.globalAlpha = 1;
      ctx.fillStyle = colors[i]; ctx.font = 'bold 21px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(['D', 'F', 'J', 'K'][i], x + laneW / 2, 548);
      ctx.beginPath(); ctx.arc(x + laneW / 2, line, 30, 0, Math.PI * 2);
      ctx.strokeStyle = colors[i]; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.strokeStyle = '#f9e9c9'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(left, line); ctx.lineTo(left + 4 * laneW, line); ctx.stroke();
    var beat = time / global.PL.Logic.BEAT;
    for (var b = Math.ceil(beat); b < Math.min(global.PL.Logic.TOTAL_BEATS, beat + 5); b++) {
      var yb = line - (b * global.PL.Logic.BEAT - time) * 220;
      if (yb >= top && yb < line) {
        ctx.strokeStyle = b % 4 === 0 ? 'rgba(255,229,184,.3)' : 'rgba(255,255,255,.1)';
        ctx.lineWidth = b % 4 === 0 ? 2 : 1; ctx.beginPath(); ctx.moveTo(left, yb); ctx.lineTo(left + 4 * laneW, yb); ctx.stroke();
      }
    }
    run.notes.forEach(function (note) {
      if (note.status) return;
      var y = line - (note.time - time) * 220;
      if (y < top - 20 || y > line + 40) return;
      var x = left + (note.lane + .5) * laneW;
      ctx.shadowColor = colors[note.lane]; ctx.shadowBlur = 20;
      ctx.fillStyle = colors[note.lane]; ctx.beginPath(); ctx.roundRect(x - 43, y - 15, 86, 30, 12); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff9e8'; ctx.fillRect(x - 29, y - 2, 58, 4);
    });
    if (state.flashUntil > time) {
      var fx = left + (state.flashLane + .5) * laneW;
      ctx.fillStyle = colors[state.flashLane]; ctx.globalAlpha = (state.flashUntil - time) * 2.5;
      ctx.beginPath(); ctx.arc(fx, line, 44, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (beat >= 29 && beat < 32 || beat >= 61 && beat < 64 || beat >= 93 && beat < 96) {
      ctx.fillStyle = '#f9e9c9'; ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('LOOM ROTATES IN ' + Math.ceil(32 - beat % 32), 400, 105);
    }
  };
})(typeof window !== 'undefined' ? window : this);
