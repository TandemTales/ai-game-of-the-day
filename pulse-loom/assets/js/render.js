(function (global) {
  'use strict';
  var R = (global.PL = global.PL || {}).Render = {};
  var colors = ['#ffca75', '#ff7698', '#74e2df', '#b9a8ff'];
  var keys = ['D', 'F', 'J', 'K'];
  var left = 104, laneW = 148, top = 91, line = 506, X = 0;
  var chamber = null, chamberState = 0;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(v) { return v * v * (3 - 2 * v); }
  function center(i) { return left + (i + .5) * laneW; }
  function strand(i, section) { return colors[(i - section + 4) % 4]; }

  function loadChamber() {
    if (chamberState || typeof global.Image !== 'function') return;
    chamberState = 1;
    try {
      chamber = new global.Image();
      chamber.onload = function () {
        chamberState = chamber.naturalWidth && chamber.naturalHeight ? 2 : -1;
      };
      chamber.onerror = function () { chamberState = -1; };
      chamber.src = 'assets/art/loom-chamber.webp';
    } catch (e) { chamberState = -1; }
  }

  function scenicLayer(ctx) {
    loadChamber();
    if (chamberState !== 2) return;
    var portrait = X > 0;
    // Fill the tall camera with the hall rather than placing a short 4:3
    // image in its middle. The cropped wings return as narrow side curtains.
    var scale = portrait ? Math.max(800 / chamber.naturalWidth, (600 + X) / chamber.naturalHeight) :
      Math.min(800 / chamber.naturalWidth, 600 / chamber.naturalHeight);
    var w = chamber.naturalWidth * scale, h = chamber.naturalHeight * scale;
    var x = (800 - w) / 2, y = (600 + X - h) / 2;
    ctx.save(); ctx.globalAlpha = portrait ? .88 : .77;
    ctx.drawImage(chamber, x, y, w, h);
    if (portrait) {
      ctx.globalAlpha = .62;
      ctx.drawImage(chamber, 0, 0, chamber.naturalWidth * .2, chamber.naturalHeight,
        0, 0, 102, 600 + X);
      ctx.drawImage(chamber, chamber.naturalWidth * .8, 0,
        chamber.naturalWidth * .2, chamber.naturalHeight, 698, 0, 102, 600 + X);
      var floorShade = ctx.createLinearGradient(0, 0, 0, 600 + X);
      floorShade.addColorStop(0, 'rgba(7,11,23,.06)');
      floorShade.addColorStop(.65, 'rgba(7,11,23,.10)');
      floorShade.addColorStop(1, 'rgba(7,11,23,.36)');
      ctx.globalAlpha = 1; ctx.fillStyle = floorShade;
      ctx.fillRect(0, 0, 800, 600 + X);
    }
    ctx.restore();
  }

  function backdrop(ctx, beat) {
    var bg = ctx.createLinearGradient(0, 0, 800, 600);
    bg.addColorStop(0, '#12142b'); bg.addColorStop(.52, '#101b2e'); bg.addColorStop(1, '#090f20');
    ctx.fillStyle = bg; ctx.fillRect(-800, -1000, 2400, 2600);
    var halo = ctx.createRadialGradient(400, 288, 12, 400, 288, 430);
    halo.addColorStop(0, 'rgba(91,78,157,.29)');
    halo.addColorStop(.65, 'rgba(42,74,105,.12)');
    halo.addColorStop(1, 'rgba(4,8,20,0)');
    ctx.fillStyle = halo; ctx.fillRect(-800, -1000, 2400, 2600);
    scenicLayer(ctx);
    for (var i = 0; i < 48; i++) {
      var x = (i * 181 + 57) % 800, y = (i * 127 + 29) % 600;
      ctx.fillStyle = 'rgba(213,226,255,' + (.10 + .12 * (1 + Math.sin(beat * .8 + i)) / 2) + ')';
      ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
    }
    // The four suspended looms extend behind the playfield. Keeping their
    // strongest edges outside the lanes gives the stage depth without hiding notes.
    var beatLight = Math.pow(1 - (beat - Math.floor(beat)), 4);
    ctx.save();
    for (var side = 0; side < 2; side++) {
      var edge = side ? 800 : 0, inner = side ? 704 : 96;
      var tower = ctx.createLinearGradient(edge, 0, inner, 0);
      tower.addColorStop(0, '#080d1b');
      tower.addColorStop(.75, '#27314a');
      tower.addColorStop(1, '#090f21');
      ctx.globalAlpha = chamberState === 2 ? .34 : 1;
      ctx.fillStyle = tower;
      ctx.beginPath(); ctx.moveTo(edge, -30); ctx.lineTo(inner, 67);
      ctx.lineTo(inner, 600 + X); ctx.lineTo(edge, 660 + X); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(236,206,170,' + (.23 + beatLight * .30) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(inner, 67); ctx.lineTo(inner, 600 + X); ctx.stroke();
      for (var spoke = 0; spoke < 8; spoke++) {
        var sy = 91 + spoke * (68 + X / 10);
        ctx.strokeStyle = 'rgba(183,185,222,.14)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(edge, sy - 25); ctx.lineTo(inner, sy); ctx.stroke();
        ctx.fillStyle = colors[spoke % 4]; ctx.globalAlpha = .13 + beatLight * .12;
        ctx.beginPath(); ctx.arc(inner, sy, 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      for (var bobbin = 0; bobbin < 4; bobbin++) {
        var by = 175 + bobbin * (119 + X / 6), bx = side ? 755 : 45;
        ctx.shadowColor = colors[bobbin]; ctx.shadowBlur = 16 + beatLight * 17;
        ctx.fillStyle = '#091124'; ctx.strokeStyle = colors[bobbin];
        ctx.globalAlpha = .72; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(bx, by, 23, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(bx, by, 10 + beatLight * 3, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
    }
    ctx.strokeStyle = 'rgba(255,230,189,' + (.13 + beatLight * .12) + ')';
    ctx.lineWidth = 2;
    for (var arch = 0; arch < 3; arch++) {
      ctx.beginPath();
      ctx.moveTo(98 + arch * 13, 112 + arch * 45);
      ctx.quadraticCurveTo(400, -93 + arch * 35, 702 - arch * 13, 112 + arch * 45);
      ctx.stroke();
    }
    ctx.restore();
  }

  function loomWorld(ctx, beat, section) {
    var cy = 290 + X * .49, phase = beat * .13;
    var beatLight = Math.pow(1 - (beat - Math.floor(beat)), 3);
    ctx.save();
    // The spindle is the scene's live subject: light travels up its heart
    // and out along the warp on each beat, behind every playable note.
    var well = ctx.createRadialGradient(400, cy, 6, 400, cy, 285);
    well.addColorStop(0, 'rgba(255,228,183,.42)');
    well.addColorStop(.36, 'rgba(113,167,208,.22)');
    well.addColorStop(1, 'rgba(14,22,42,0)');
    ctx.fillStyle = well; ctx.fillRect(100, cy - 295, 600, 590);
    var shaft = ctx.createLinearGradient(365, 0, 435, 0);
    shaft.addColorStop(0, 'rgba(153,205,246,0)');
    shaft.addColorStop(.44, 'rgba(155,211,255,.18)');
    shaft.addColorStop(.5, 'rgba(255,238,187,.50)');
    shaft.addColorStop(.56, 'rgba(255,158,202,.19)');
    shaft.addColorStop(1, 'rgba(179,165,255,0)');
    ctx.globalAlpha = .65 + beatLight * .28;
    ctx.fillStyle = shaft; ctx.fillRect(365, top, 70, line - top);
    ctx.globalAlpha = 1;
    for (var ray = 0; ray < 4; ray++) {
      var rayX = center(ray), swing = Math.sin(phase * 2 + ray * 1.7) * 18;
      ctx.strokeStyle = colors[(ray + section) % 4];
      ctx.globalAlpha = .26 + beatLight * .27;
      ctx.lineWidth = 3 + beatLight * 2;
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10 + beatLight * 18;
      ctx.beginPath(); ctx.moveTo(400, cy);
      ctx.bezierCurveTo(400 + swing, cy - 110, rayX - swing, top + 130, rayX, top);
      ctx.stroke();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.translate(400, cy); ctx.rotate(phase);
    for (var ring = 0; ring < 3; ring++) {
      ctx.strokeStyle = ring === 0 ? 'rgba(255,231,186,.70)' : 'rgba(166,218,255,.40)';
      ctx.lineWidth = ring === 0 ? 8 : 3;
      ctx.shadowColor = ring === 0 ? '#ffd595' : '#80c7ff';
      ctx.shadowBlur = 12 + beatLight * 18;
      ctx.beginPath(); ctx.arc(0, 0, 72 + ring * 43, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (var tooth = 0; tooth < 16; tooth++) {
      var angle = tooth * Math.PI / 8;
      ctx.strokeStyle = colors[(tooth + section) % 4];
      ctx.globalAlpha = .47 + .23 * beatLight;
      ctx.lineWidth = tooth % 4 === 0 ? 5 : 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 155, Math.sin(angle) * 155);
      ctx.lineTo(Math.cos(angle) * 177, Math.sin(angle) * 177);
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.rotate(-phase);
    for (var strandIndex = 0; strandIndex < 4; strandIndex++) {
      var color = colors[strandIndex], end = center((strandIndex + section) % 4) - 400;
      ctx.strokeStyle = color; ctx.globalAlpha = .40 + beatLight * .16; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(end, top - cy);
      ctx.bezierCurveTo(end * .55, -100, end * -.3, 70, end, line - cy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = colors[section]; ctx.shadowBlur = 28 + beatLight * 24;
    ctx.fillStyle = '#26364c'; ctx.strokeStyle = 'rgba(255,241,206,.90)'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -48); ctx.lineTo(39, 0); ctx.lineTo(0, 48); ctx.lineTo(-39, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff8df'; ctx.globalAlpha = .8 + beatLight * .2;
    ctx.beginPath(); ctx.arc(0, 0, 13 + 5 * beatLight, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function loom(ctx, beat, section, state, time) {
    var board = ctx.createLinearGradient(0, top, 0, 553 + X);
    board.addColorStop(0, chamberState === 2 ? 'rgba(7,13,29,.34)' : 'rgba(7,13,29,.76)');
    board.addColorStop(1, chamberState === 2 ? 'rgba(10,18,39,.67)' : 'rgba(10,18,39,.94)');
    ctx.shadowColor = '#050816'; ctx.shadowBlur = 30;
    ctx.fillStyle = board; ctx.beginPath(); ctx.roundRect(left - 13, top - 14, laneW * 4 + 26, 479 + X, 18); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(172,184,232,.33)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(left - 13, top - 14, laneW * 4 + 26, 479 + X, 18); ctx.stroke();
    loomWorld(ctx, beat, section);
    ctx.strokeStyle = 'rgba(189,200,247,.08)'; ctx.lineWidth = 1;
    for (var thread = 0; thread < 9; thread++) {
      var start = left - 13 + thread * 77;
      ctx.beginPath(); ctx.moveTo(start, top); ctx.lineTo(400 + (start - 400) * .72, line); ctx.stroke();
    }
    for (var lane = 0; lane < 4; lane++) {
      var x = left + lane * laneW, hue = strand(lane, section);
      var fill = ctx.createLinearGradient(0, top, 0, line);
      fill.addColorStop(0, 'rgba(255,255,255,.015)');
      fill.addColorStop(1, 'rgba(255,255,255,.06)');
      ctx.fillStyle = fill; ctx.fillRect(x + 3, top, laneW - 6, line - top + 39);
      if (state.flashUntil > time && state.flashLane === lane) {
        var heat = clamp((state.flashUntil - time) / .22, 0, 1);
        var light = ctx.createLinearGradient(0, line - 175, 0, line + 35);
        light.addColorStop(0, 'rgba(255,255,255,0)');
        light.addColorStop(1, hue);
        ctx.globalAlpha = heat * .38; ctx.fillStyle = light;
        ctx.fillRect(x + 3, line - 175, laneW - 6, 211);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = hue; ctx.globalAlpha = .12;
      ctx.fillRect(x + 8, top, 3, line - top + 40);
      ctx.fillRect(x + laneW - 11, top, 3, line - top + 40);
      ctx.globalAlpha = 1;
      if (lane > 0) {
        ctx.strokeStyle = 'rgba(180,198,241,.16)'; ctx.beginPath();
        ctx.moveTo(x, top); ctx.lineTo(x, 553 + X); ctx.stroke();
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
      ctx.fillText(keys[lane], center(lane), 543 + X);
      ctx.fillStyle = hue; ctx.globalAlpha = .65;
      ctx.fillRect(center(lane) - 17, 550 + X, 34, 2);
      ctx.globalAlpha = 1;
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
        ctx.fillStyle = '#ffe9bf'; ctx.globalAlpha = .52;
        ctx.beginPath(); ctx.moveTo(left + 4 * laneW + 10, y);
        ctx.lineTo(left + 4 * laneW + 16, y + 6);
        ctx.lineTo(left + 4 * laneW + 22, y);
        ctx.lineTo(left + 4 * laneW + 16, y - 6);
        ctx.fill(); ctx.globalAlpha = 1;
      }
    }
  }

  function notes(ctx, run, time) {
    run.notes.forEach(function (note) {
      if (note.status) return;
      var y = line - (note.time - time) * 220;
      if (y < top - 24 || y > line + 40) return;
      var x = center(note.lane), hue = colors[note.base];
      ctx.shadowColor = hue; ctx.shadowBlur = 27;
      ctx.fillStyle = hue; ctx.beginPath(); ctx.roundRect(x - 50, y - 18, 100, 36, 12); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,.82)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x - 50, y - 18, 100, 36, 12); ctx.stroke();
      ctx.fillStyle = 'rgba(9,15,30,.70)'; ctx.beginPath(); ctx.roundRect(x - 42, y - 11, 84, 22, 6); ctx.fill();
      ctx.fillStyle = '#fff9ee'; ctx.fillRect(x - 27, y - 2, 54, 4);
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = hue; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 57, y - 9); ctx.lineTo(x - 57, y + 9);
      ctx.moveTo(x + 57, y - 9); ctx.lineTo(x + 57, y + 9); ctx.stroke();
      ctx.globalAlpha = .48; ctx.fillStyle = hue;
      ctx.fillRect(x - 34, y - 23, 68, 2); ctx.globalAlpha = 1;
    });
  }

  function hitLight(ctx, state, time, section) {
    if (state.flashUntil <= time) return;
    var heat = clamp((state.flashUntil - time) / .22, 0, 1);
    var x = center(state.flashLane), hue = strand(state.flashLane, section);
    ctx.save();
    var bloom = ctx.createRadialGradient(x, line - 68, 16, x, line - 68, 270);
    bloom.addColorStop(0, hue); bloom.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bloom; ctx.globalAlpha = heat * .22;
    ctx.fillRect(x - 270, line - 338, 540, 540);
    // Light runs up the two edges of the struck strand, behind incoming notes.
    ctx.strokeStyle = hue; ctx.shadowColor = hue; ctx.shadowBlur = 22;
    for (var side = -1; side <= 1; side += 2) {
      ctx.globalAlpha = heat * .6; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x + side * 66, line);
      ctx.bezierCurveTo(x + side * 82, line - 105,
        x + side * 48, top + 132, x + side * 64, top); ctx.stroke();
    }
    ctx.restore();
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
    ctx.fillStyle = 'rgba(8,13,29,.96)'; ctx.beginPath(); ctx.roundRect(130, 5, 540, 69, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,225,172,.68)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(130, 5, 540, 69, 14); ctx.stroke();
    ctx.fillStyle = '#fff0cf'; ctx.font = '800 22px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(preview ? 'SHIFT  →  ' + Math.ceil(next - beat) : 'THREADS SHIFTED', 400, 30);
    for (var base = 0; base < 4; base++) {
      var from = center((base + current) % 4);
      var to = center((base + current + 1) % 4);
      if (to < from) to += 4 * laneW;
      var x = from + (to - from) * amount;
      if (x > center(3) + laneW / 2) x -= 4 * laneW;
      ctx.strokeStyle = colors[base]; ctx.globalAlpha = opacity * .4; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(from, 51); ctx.lineTo(x, 60); ctx.stroke();
      ctx.globalAlpha = opacity; ctx.shadowColor = colors[base]; ctx.shadowBlur = 13;
      ctx.fillStyle = colors[base]; ctx.beginPath(); ctx.arc(x, 57, 10, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function stageFx(ctx, beat, section, state, time, run) {
    var f = beat - Math.floor(beat), kick = Math.pow(1 - f, 3);
    var tint = colors[section];
    // Beat shockwave rings radiating from the loom's heart.
    ctx.save(); ctx.strokeStyle = tint; ctx.lineWidth = 2;
    for (var k = 0; k < 3; k++) {
      var age = (f + k) / 3;
      ctx.globalAlpha = (1 - age) * (.16 + .16 * kick);
      ctx.beginPath(); ctx.ellipse(400, 290 + X * .49, 120 + age * 380,
        90 + age * 280, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = .05 + .07 * kick; ctx.fillStyle = tint;
    ctx.fillRect(-800, -1000, 2400, 2600);
    ctx.restore();
    // Side pillars: combo energy meters that rise with the chain.
    var energy = clamp(run.combo / 40, 0, 1);
    [[30, -1], [770, 1]].forEach(function (p) {
      var h = 70 + energy * 330;
      var g = ctx.createLinearGradient(0, 553 + X - h, 0, 553 + X);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, tint);
      ctx.globalAlpha = .35 + .35 * kick * energy; ctx.fillStyle = g;
      ctx.fillRect(p[0] - 14, 553 + X - h, 28, h);
      ctx.globalAlpha = .6; ctx.fillStyle = '#fff4dc';
      ctx.fillRect(p[0] - 14, 551 + X, 28, 3);
    });
    ctx.globalAlpha = 1;
  }

  function songProgress(ctx, beat, totalBeats) {
    var progress = clamp(beat / totalBeats, 0, 1);
    var y = top + 10, h = line - top - 23, x = 720;
    ctx.save();
    ctx.fillStyle = 'rgba(6,12,27,.76)';
    ctx.beginPath(); ctx.roundRect(x - 5, y - 7, 13, h + 14, 7); ctx.fill();
    ctx.fillStyle = 'rgba(238,224,194,.28)'; ctx.fillRect(x, y, 3, h);
    var filled = h * progress;
    var track = ctx.createLinearGradient(0, y + h, 0, y);
    track.addColorStop(0, colors[0]); track.addColorStop(.33, colors[1]);
    track.addColorStop(.66, colors[2]); track.addColorStop(1, colors[3]);
    ctx.fillStyle = track; ctx.shadowColor = colors[Math.min(3, Math.floor(progress * 4))];
    ctx.shadowBlur = 10; ctx.fillRect(x - 1, y + h - filled, 5, filled);
    ctx.shadowBlur = 0;
    for (var mark = 1; mark < 4; mark++) {
      var markY = y + h * (1 - mark / 4);
      ctx.fillStyle = '#e9d7bd'; ctx.globalAlpha = .65;
      ctx.fillRect(x - 4, markY, 11, 1);
    }
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff4dc';
    ctx.shadowColor = colors[Math.min(3, Math.floor(progress * 4))]; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(x + 1, y + h - filled, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function feedbackFx(ctx, section, state, time, run) {
    // Draw above notes and the board: the former pre-board pass hid these cues.
    var tint = colors[section];
    var age2 = time - state.judgeAt;
    if (state.judge && age2 >= 0 && age2 < .6) {
      var a = 1 - age2 / .6, cx = state.judgeLane >= 0 ? center(state.judgeLane) : 400;
      var col = state.judge === 'PERFECT' ? '#fff0b8' : state.judge === 'GOOD' ? '#8ee8e6' : '#ff7a8c';
      ctx.save(); ctx.textAlign = 'center'; ctx.globalAlpha = a;
      ctx.font = '900 ' + (state.judge === 'PERFECT' ? 40 : 29) + 'px system-ui';
      ctx.shadowColor = '#050817'; ctx.shadowBlur = 12; ctx.lineWidth = 5;
      ctx.strokeStyle = '#101626';
      ctx.strokeText(state.judge, cx, line - 86 - age2 * 72);
      ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.fillStyle = col;
      ctx.fillText(state.judge, cx, line - 86 - age2 * 72);
      if (state.judge !== 'MISS') {
        var multiplier = Math.min(4, 1 + Math.floor((run.combo - 1) / 10));
        ctx.shadowBlur = 12; ctx.font = '900 19px system-ui';
        ctx.fillText('+' + (state.judge === 'PERFECT' ? 100 : 55) * multiplier,
          cx, line - 51 - age2 * 96);
      }
      ctx.restore();
    }
    if (run.combo > 1 && state.judge !== 'MISS' && age2 >= 0 && age2 < .45) {
      var impact = clamp(1 - age2 / .22, 0, 1);
      var cy = line - 161;
      ctx.save(); ctx.textAlign = 'center';
      ctx.globalAlpha = clamp((.45 - age2) / .2, 0, 1);
      ctx.fillStyle = 'rgba(8,13,29,.75)';
      ctx.beginPath(); ctx.roundRect(329, cy - 63, 142, 83, 16); ctx.fill();
      ctx.strokeStyle = tint; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(329, cy - 63, 142, 83, 16); ctx.stroke();
      ctx.font = '900 ' + (48 + impact * 12) + 'px Georgia, serif';
      ctx.shadowColor = tint; ctx.shadowBlur = 14 + impact * 17;
      ctx.fillStyle = '#fff4dc'; ctx.fillText(String(run.combo), 400, cy - 14);
      ctx.shadowBlur = 0; ctx.font = '800 13px system-ui'; ctx.fillStyle = tint;
      ctx.fillText('COMBO', 400, cy + 6);
      ctx.restore();
    }
  }

  // Landscape shows the full 800x600 stage; portrait zooms on the board and
  // lets the backdrop fill the extra height.
  R.view = function (canvas) {
    if (canvas.height > canvas.width * 0.9) {
      var s = canvas.width / 680, lh = canvas.height / s;
      X = Math.max(0, lh - 600 - 40); line = 506 + X;
      return { s: s, ox: -60, oy: 0 };
    }
    X = 0; line = 506;
    return { s: canvas.width / 800, ox: 0, oy: (canvas.height / (canvas.width / 800) - 600) / 2 };
  };

  R.draw = function (canvas, run, time, state) {
    var ctx = canvas.getContext('2d'), logic = global.PL.Logic;
    var beat = time / logic.BEAT, section = clamp(Math.floor(beat / 32), 0, 3);
    var v = R.view(canvas);
    ctx.setTransform(v.s, 0, 0, v.s, v.ox * v.s, v.oy * v.s);
    backdrop(ctx, beat); stageFx(ctx, beat, section, state, time, run);
    loom(ctx, beat, section, state, time);
    hitLight(ctx, state, time, section);
    beatGrid(ctx, beat, time, logic); notes(ctx, run, time);
    if (state.flashUntil > time) {
      var intensity = clamp((state.flashUntil - time) / .22, 0, 1);
      var travel = 1 - intensity, x = center(state.flashLane);
      var hue = strand(state.flashLane, section);
      ctx.save();
      var burst = ctx.createRadialGradient(x, line, 5, x, line, 116);
      burst.addColorStop(0, 'rgba(255,248,224,.7)');
      burst.addColorStop(.27, hue);
      burst.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = intensity * .28; ctx.fillStyle = burst;
      ctx.fillRect(x - 116, line - 116, 232, 232);
      ctx.strokeStyle = hue; ctx.shadowColor = hue; ctx.shadowBlur = 20;
      ctx.globalAlpha = intensity * .5; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(left, line - 1); ctx.lineTo(left + 4 * laneW, line - 1); ctx.stroke();
      for (var ray = 0; ray < 12; ray++) {
        var angle = Math.PI * (ray / 6 + .1), near = 46 + travel * 13, far = near + 25 + travel * 31;
        ctx.globalAlpha = intensity * (ray % 3 === 0 ? .8 : .42);
        ctx.lineWidth = ray % 3 === 0 ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * near, line + Math.sin(angle) * near);
        ctx.lineTo(x + Math.cos(angle) * far, line + Math.sin(angle) * far);
        ctx.stroke();
      }
      ctx.strokeStyle = hue; ctx.shadowColor = hue; ctx.shadowBlur = 19;
      ctx.globalAlpha = intensity * .85; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, line, 32 + travel * 53, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      for (var i = 0; i < 13; i++) {
        var spread = ((i * 7) % 13 - 6) * 5;
        var distance = 19 + travel * (53 + i % 4 * 12);
        var px = x + spread * (1 + travel * .72);
        var py = line - distance;
        ctx.globalAlpha = intensity * (.43 + (i % 3) * .17);
        ctx.lineWidth = i % 3 === 0 ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(px, py + 12); ctx.lineTo(px + spread * .08, py); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = intensity * .74; ctx.fillStyle = '#fff9e8';
      ctx.beginPath(); ctx.arc(x, line, 7 + travel * 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    feedbackFx(ctx, section, state, time, run);
    rotation(ctx, beat);
    songProgress(ctx, beat, logic.TOTAL_BEATS);
  };
})(typeof window !== 'undefined' ? window : this);
