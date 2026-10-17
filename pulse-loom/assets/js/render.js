(function (global) {
  'use strict';
  var R = (global.PL = global.PL || {}).Render = {};
  var colors = ['#ffca75', '#ff7698', '#74e2df', '#b9a8ff'];
  var keys = ['D', 'F', 'J', 'K'];
  var left = 104, laneW = 148, top = 91, line = 506, X = 0;
  var chamber = null, chamberState = 0;
  var conductor = null, conductorState = 0;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(v) { return v * v * (3 - 2 * v); }
  function center(i) { return left + (i + .5) * laneW; }
  function strand(i, section) { return colors[(i - section + 4) % 4]; }
  // Upper notes part around the performer, then settle into their original
  // lane centers before the judgment line. Input and scoring remain unchanged.
  function noteCenter(i, y) {
    var spread = [-17, -68, 68, 17][i];
    return center(i) + spread * ease(clamp((line - y) / (line - top), 0, 1));
  }

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

  function loadConductor() {
    if (conductorState || typeof global.Image !== 'function') return;
    conductorState = 1;
    try {
      conductor = new global.Image();
      conductor.onload = function () {
        conductorState = conductor.naturalWidth && conductor.naturalHeight ? 2 : -1;
      };
      conductor.onerror = function () { conductorState = -1; };
      conductor.src = 'assets/art/thread-conductor.webp';
    } catch (e) { conductorState = -1; }
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
    ctx.save(); ctx.globalAlpha = portrait ? .98 : .90;
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

  function loomWorld(ctx, beat, section, state, time, run) {
    var cy = 290 + X * .49, phase = beat * .13;
    var beatLight = Math.pow(1 - (beat - Math.floor(beat)), 3);
    var hitAge = time - state.judgeAt;
    var hit = state.judge && state.judge !== 'MISS' && hitAge >= 0 ?
      Math.pow(clamp(1 - hitAge / .5, 0, 1), 1.4) : 0;
    var charge = clamp(run.combo / 24, 0, 1);
    ctx.save();
    // Three fixed scenic planes make the performer occupy a physical stage.
    // Their edges sit outside the receptor path and respond to the downbeat.
    var wing = colors[section];
    var rear = ctx.createLinearGradient(0, top, 0, line);
    rear.addColorStop(0, 'rgba(16,19,44,.82)');
    rear.addColorStop(.58, 'rgba(54,42,91,.38)');
    rear.addColorStop(1, 'rgba(7,13,29,0)');
    ctx.fillStyle = rear;
    ctx.beginPath(); ctx.moveTo(153, top + 8); ctx.lineTo(647, top + 8);
    ctx.lineTo(584, cy + 100); ctx.lineTo(216, cy + 100); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = wing; ctx.globalAlpha = .36 + beatLight * .32;
    ctx.lineWidth = 5; ctx.shadowColor = wing; ctx.shadowBlur = 19;
    ctx.beginPath(); ctx.moveTo(153, top + 8); ctx.lineTo(235, cy + 125);
    ctx.moveTo(647, top + 8); ctx.lineTo(565, cy + 125); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    for (var stair = 0; stair < 3; stair++) {
      var sy = cy + 120 + stair * 24;
      ctx.fillStyle = stair % 2 ? 'rgba(22,20,48,.70)' : 'rgba(56,43,82,.58)';
      ctx.beginPath(); ctx.moveTo(245 - stair * 31, sy);
      ctx.lineTo(555 + stair * 31, sy);
      ctx.lineTo(578 + stair * 34, sy + 18);
      ctx.lineTo(222 - stair * 34, sy + 18); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,219,172,' + (.19 + beatLight * .15) + ')';
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(245 - stair * 31, sy);
      ctx.lineTo(555 + stair * 31, sy); ctx.stroke();
    }
    // The performer stands in a recessed pool of light. The diverging floor
    // seams and the small rear arch give the inset four-lane board a horizon.
    var stageFloor = cy + 143;
    var floorGlow = ctx.createRadialGradient(400, stageFloor, 12, 400, stageFloor, 254);
    floorGlow.addColorStop(0, 'rgba(255,212,160,' + (.31 + beatLight * .16 + hit * .20) + ')');
    floorGlow.addColorStop(.52, 'rgba(134,92,163,.13)');
    floorGlow.addColorStop(1, 'rgba(44,43,89,0)');
    ctx.fillStyle = floorGlow; ctx.fillRect(125, stageFloor - 190, 550, 360);
    ctx.fillStyle = 'rgba(8,13,30,.72)';
    ctx.beginPath(); ctx.ellipse(400, stageFloor + 17, 224, 38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,222,166,' + (.34 + beatLight * .23) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(400, stageFloor + 17, 224, 38, 0, 0, Math.PI * 2); ctx.stroke();
    for (var seamIndex = -2; seamIndex <= 2; seamIndex++) {
      ctx.strokeStyle = colors[(seamIndex + 6 + section) % 4];
      ctx.globalAlpha = .12 + charge * .13 + beatLight * .08;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(400 + seamIndex * 48, stageFloor + 9);
      ctx.lineTo(400 + seamIndex * 137, line + 40); ctx.stroke();
    }
    ctx.globalAlpha = 1;
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
      ctx.globalAlpha = (X > 100 ? .08 : .17) + beatLight * .15;
      ctx.lineWidth = 3 + beatLight * 2;
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10 + beatLight * 18;
      ctx.beginPath(); ctx.moveTo(400, cy);
      ctx.bezierCurveTo(400 + swing, cy - 110, rayX - swing, top + 130, rayX, top);
      ctx.stroke();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.translate(400, cy);
    for (var strandIndex = 0; strandIndex < 4 && X <= 100; strandIndex++) {
      var color = colors[strandIndex], end = center((strandIndex + section) % 4) - 400;
       ctx.strokeStyle = color; ctx.globalAlpha = .10 + beatLight * .065; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(end, top - cy);
      ctx.bezierCurveTo(end * .55, -100, end * -.3, 70, end, line - cy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // A faceted thread dancer gives the mechanism a readable moving subject.
    // It is behind all notes; its crown and hands react to the actual hit.
    loadConductor();
    if (conductorState === 2) {
      var height = 420 + Math.min(X * .14, 70);
      var width = height * conductor.naturalWidth / conductor.naturalHeight;
      // Four held conducting stances change on the beat. A judged hit cuts
      // across the current stance toward its lane instead of merely bobbing.
      var poses = [-1, -.2, 1, .2], beatIndex = Math.floor(beat);
      var poseBlend = ease(clamp((beat - beatIndex) / .19, 0, 1));
      var pose = poses[(beatIndex + 3) % 4] * (1 - poseBlend) +
        poses[beatIndex % 4] * poseBlend;
      var strikeSide = state.judgeLane < 2 ? -1 : 1;
      ctx.translate(pose * 18 + strikeSide * hit * 24,
        -beatLight * 12 - hit * 17);
      ctx.rotate(pose * .105 + strikeSide * hit * .15);
      ctx.scale(1 + beatLight * .025 + hit * .06,
        1 + beatLight * .03 - hit * .045);
      // A dark soft pool behind the performer separates the silhouette from the
      // lane overlays, then a section-colored rim light outlines it.
      var scrim = ctx.createRadialGradient(0, -height * .06, 10, 0, -height * .06, height * .52);
      scrim.addColorStop(0, 'rgba(4,7,20,.78)'); scrim.addColorStop(.6, 'rgba(4,7,20,.45)');
      scrim.addColorStop(1, 'rgba(4,7,20,0)');
      ctx.fillStyle = scrim; ctx.shadowBlur = 0;
      ctx.fillRect(-width, -height * .62, width * 2, height * 1.2);
      // The source art has translucent cloth. An opaque tailored backing keeps
      // the torso legible when the stage and notes move through its silhouette.
      var coat = ctx.createLinearGradient(0, -height * .38, 0, height * .46);
      coat.addColorStop(0, '#24233c'); coat.addColorStop(.55, '#111629');
      coat.addColorStop(1, '#080e20');
      ctx.fillStyle = coat; ctx.strokeStyle = colors[section];
      ctx.lineWidth = 3; ctx.shadowColor = colors[section];
      ctx.shadowBlur = 20 + beatLight * 11 + hit * 23;
      ctx.beginPath(); ctx.moveTo(0, -height * .48);
      ctx.bezierCurveTo(width * .13, -height * .48, width * .15, -height * .33, width * .19, -height * .28);
      ctx.bezierCurveTo(width * .35, -height * .23, width * .43, -height * .04, width * .45, height * .26);
      ctx.quadraticCurveTo(width * .18, height * .14, width * .07, height * .44);
      ctx.lineTo(-width * .07, height * .44);
      ctx.quadraticCurveTo(-width * .18, height * .14, -width * .45, height * .26);
      ctx.bezierCurveTo(-width * .43, -height * .04, -width * .35, -height * .23, -width * .19, -height * .28);
      ctx.bezierCurveTo(-width * .15, -height * .33, -width * .13, -height * .48, 0, -height * .48);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.drawImage(conductor, -width / 2, -height * .53, width, height);
      // Opaque sleeves form four readable poses over the source illustration.
      // The judged side makes a downstroke; the free hand lifts on the beat.
      for (var hand = -1; hand <= 1; hand += 2) {
        var striking = hit > .01 && strikeSide === hand;
        var gesture = beatLight * .35 + (hand === Math.sign(pose) ? .28 : 0);
        var raisedX = hand * (width * .39 + gesture * 13);
        var raisedY = -height * (.31 + gesture * .10);
        var targetX = (center(state.judgeLane) - 400) * .44;
        var hx = striking ? raisedX * (1 - hit) + targetX * hit : raisedX;
        var hy = striking ? raisedY * (1 - hit) + height * .07 * hit : raisedY;
        var handColor = colors[(section + (hand < 0 ? 1 : 2)) % 4];
        var shoulderX = hand * width * .105, shoulderY = -height * .23;
        ctx.lineCap = 'round';
        if (striking) {
          ctx.strokeStyle = handColor; ctx.globalAlpha = hit * .43;
          ctx.lineWidth = 15; ctx.shadowColor = handColor; ctx.shadowBlur = 22;
          ctx.beginPath(); ctx.moveTo(raisedX, raisedY);
          ctx.quadraticCurveTo(hand * width * .52, -height * .03, hx, hy);
          ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = '#10192e';
        ctx.shadowColor = '#060a19'; ctx.shadowBlur = 12;
        ctx.lineWidth = 29;
        ctx.beginPath(); ctx.moveTo(shoulderX, shoulderY);
        ctx.quadraticCurveTo(hand * width * .29, -height * (.20 + gesture * .10) + hit * 24, hx, hy);
        ctx.stroke();
        ctx.strokeStyle = handColor; ctx.shadowColor = handColor;
        ctx.shadowBlur = 9 + gesture * 20 + hit * 15;
        ctx.globalAlpha = .72 + gesture * .2 + hit * .08;
        ctx.lineWidth = 4 + gesture * 3 + (striking ? hit * 3 : 0);
        ctx.beginPath(); ctx.moveTo(shoulderX, shoulderY);
        ctx.quadraticCurveTo(hand * width * .29, -height * (.20 + gesture * .10) + hit * 24, hx, hy);
        ctx.stroke();
        ctx.fillStyle = '#f9e8cd'; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(hx, hy, 8 + gesture * 4 + (striking ? hit * 5 : 0), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = handColor; ctx.lineWidth = 2 + gesture * 2;
        ctx.beginPath();
        ctx.arc(hx, hy, 17 + gesture * 15 + (striking ? hit * 11 : 0),
          -Math.PI * .72 + hand * beat * .08,
          Math.PI * .62 + hand * beat * .08); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.restore();
      return;
    }
    var lift = beatLight * 5 + hit * 11;
    ctx.translate(0, -lift);
    // Give the masked conductor a larger, gently swaying stage silhouette.
    // Notes are painted later, so their timing shapes remain the top layer.
    ctx.rotate(Math.sin(beat * .24) * .07 + hit * .035);
    ctx.scale(1.3 + hit * .08, 1.3 + hit * .08);
    for (var arm = -1; arm <= 1; arm += 2) {
      var spread = 133 + charge * 18 + hit * 27;
      ctx.strokeStyle = colors[arm < 0 ? (section + 1) % 4 : (section + 2) % 4];
      ctx.globalAlpha = .56 + hit * .29; ctx.lineWidth = 8 + hit * 5;
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14 + hit * 28;
      ctx.beginPath(); ctx.moveTo(arm * 39, 37);
      ctx.bezierCurveTo(arm * 77, 29, arm * 80, -32 - hit * 12,
        arm * spread, -38 - hit * 26); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff0c9'; ctx.globalAlpha = .88;
      ctx.beginPath(); ctx.arc(arm * spread, -38 - hit * 26, 7 + hit * 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    var robe = ctx.createLinearGradient(0, -42, 0, 157);
    robe.addColorStop(0, colors[section]); robe.addColorStop(.36, '#718aa5');
    robe.addColorStop(.72, '#314760'); robe.addColorStop(1, '#14263f');
    ctx.fillStyle = robe; ctx.strokeStyle = 'rgba(255,236,199,.87)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -50); ctx.bezierCurveTo(37, -36, 49, -8, 56, 19);
    ctx.bezierCurveTo(69, 91, 99, 111, 118, 150);
    ctx.quadraticCurveTo(0, 114, -118, 150);
    ctx.bezierCurveTo(-99, 111, -69, 91, -56, 19);
    ctx.bezierCurveTo(-49, -8, -37, -36, 0, -50); ctx.fill(); ctx.stroke();
    // Faceted shoulder pieces and long lit folds make the silhouette read as
    // an onstage conductor instead of another circular instrument.
    for (var side = -1; side <= 1; side += 2) {
      ctx.fillStyle = side < 0 ? '#b6748d' : '#72a8b8';
      ctx.globalAlpha = .86;
      ctx.beginPath(); ctx.moveTo(side * 19, -37); ctx.lineTo(side * 56, -17);
      ctx.lineTo(side * 70, 12); ctx.lineTo(side * 38, 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffe1b4'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(side * 25, -28); ctx.lineTo(side * 55, -10);
      ctx.lineTo(side * 62, 5); ctx.stroke();
      ctx.globalAlpha = .42 + beatLight * .25 + hit * .22;
      ctx.strokeStyle = colors[(section + (side < 0 ? 1 : 2)) % 4];
      ctx.beginPath(); ctx.moveTo(side * 31, 19);
      ctx.bezierCurveTo(side * 42, 58, side * 60, 95, side * 82, 135); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (var seam = -1; seam <= 1; seam += 2) {
      ctx.strokeStyle = colors[seam < 0 ? (section + 1) % 4 : (section + 2) % 4];
      ctx.globalAlpha = .5 + charge * .24 + hit * .2; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(seam * 25, 0);
      ctx.bezierCurveTo(seam * 30, 50, seam * 63, 92, seam * 86, 133);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Mask, crown and eyes stay crisp when the wheel rotates behind them.
    ctx.shadowColor = '#ffdeb2'; ctx.shadowBlur = 16 + beatLight * 12 + hit * 24;
    ctx.fillStyle = '#f9dfb5';
    ctx.beginPath(); ctx.moveTo(0, -83); ctx.lineTo(35, -58);
    ctx.lineTo(32, -15); ctx.lineTo(0, 8); ctx.lineTo(-32, -15);
    ctx.lineTo(-35, -58); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#34435a';
    ctx.beginPath(); ctx.moveTo(0, -73); ctx.lineTo(25, -52);
    ctx.lineTo(21, -21); ctx.lineTo(0, -6); ctx.lineTo(-21, -21);
    ctx.lineTo(-25, -52); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff9df'; ctx.shadowColor = '#fff0ae'; ctx.shadowBlur = 12 + hit * 20;
    ctx.beginPath(); ctx.moveTo(-20, -40); ctx.lineTo(-4, -35); ctx.lineTo(-19, -31);
    ctx.moveTo(20, -40); ctx.lineTo(4, -35); ctx.lineTo(19, -31); ctx.fill();
    ctx.shadowBlur = 0;
    for (var crown = -2; crown <= 2; crown++) {
      var crownX = crown * 18, tipY = -113 - (2 - Math.abs(crown)) * 8 - hit * 12;
      ctx.strokeStyle = colors[(crown + 6 + section) % 4];
      ctx.lineWidth = 3 + beatLight * 2;
      ctx.beginPath(); ctx.moveTo(crownX * .5, -79);
      ctx.quadraticCurveTo(crownX, -97, crownX, tipY); ctx.stroke();
      ctx.fillStyle = '#fff4dc'; ctx.beginPath();
      ctx.arc(crownX, tipY, 3 + hit * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function loom(ctx, beat, section, state, time, run) {
    var board = ctx.createLinearGradient(0, top, 0, 553 + X);
    board.addColorStop(0, chamberState === 2 ? 'rgba(7,13,29,.10)' : 'rgba(7,13,29,.67)');
    board.addColorStop(1, chamberState === 2 ? 'rgba(10,18,39,.38)' : 'rgba(10,18,39,.91)');
    ctx.shadowColor = '#050816'; ctx.shadowBlur = 30;
    ctx.fillStyle = board; ctx.beginPath(); ctx.roundRect(left - 13, top - 14, laneW * 4 + 26, 479 + X, 18); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(172,184,232,.33)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(left - 13, top - 14, laneW * 4 + 26, 479 + X, 18); ctx.stroke();
    loomWorld(ctx, beat, section, state, time, run);
    // Dark glass gives the notes four quiet, uninterrupted travel paths while
    // leaving the thread dancer visible through the center of the stage.
    for (var lane = 0; lane < 4; lane++) {
      var x = left + lane * laneW, hue = strand(lane, section);
      var fill = ctx.createLinearGradient(0, top, 0, line);
      // The middle strands are a window onto the performer. Keep the lower
      // timing area dark while letting the face and moving arms read clearly.
      var glass = lane === 1 || lane === 2 ? (X > 100 ? .035 : .07) : (X > 100 ? .20 : .31);
      fill.addColorStop(0, 'rgba(5,11,27,' + glass + ')');
      fill.addColorStop(.6, 'rgba(5,11,27,' + (glass + .03) + ')');
      fill.addColorStop(1, 'rgba(5,11,27,.65)');
      ctx.fillStyle = fill; ctx.fillRect(x + 2, top, laneW - 4, line - top + 40);
      if (state.flashUntil > time && state.flashLane === lane) {
        var heat = clamp((state.flashUntil - time) / .22, 0, 1);
        var light = ctx.createLinearGradient(0, line - 175, 0, line + 35);
        light.addColorStop(0, 'rgba(255,255,255,0)');
        light.addColorStop(1, hue);
        ctx.globalAlpha = heat * .38; ctx.fillStyle = light;
        ctx.fillRect(x + 3, line - 175, laneW - 6, 211);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = hue; ctx.globalAlpha = .34;
      ctx.fillRect(x + 5, top, 2, line - top + 40);
      ctx.fillRect(x + laneW - 7, top, 2, line - top + 40);
      ctx.globalAlpha = 1;
      if (lane > 0) {
        ctx.strokeStyle = 'rgba(180,198,241,.16)'; ctx.beginPath();
        ctx.moveTo(x, top); ctx.lineTo(x, 553 + X); ctx.stroke();
      }
      // A quiet curved rail explains the visual path before it converges on
      // the fixed receptor. Notes themselves always sit above this rail.
       ctx.save(); ctx.strokeStyle = hue; ctx.globalAlpha = X > 100 ? .20 : .28;
       ctx.lineWidth = X > 100 ? 3 : 2; ctx.shadowColor = hue; ctx.shadowBlur = 9;
      ctx.beginPath();
      for (var step = 0; step <= 12; step++) {
        var railY = top + (line - top) * step / 12;
        if (step) ctx.lineTo(noteCenter(lane, railY), railY);
        else ctx.moveTo(noteCenter(lane, railY), railY);
      }
      ctx.stroke(); ctx.restore();
      var pulse = .5 + .5 * Math.cos((beat - Math.floor(beat)) * Math.PI * 2);
      var receptorRadius = X > 100 ? 53 : 47;
      ctx.fillStyle = '#060d20'; ctx.globalAlpha = .96;
      ctx.beginPath(); ctx.arc(center(lane), line, receptorRadius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hue; ctx.globalAlpha = .29 + pulse * .17;
      ctx.beginPath(); ctx.arc(center(lane), line, receptorRadius - 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = hue; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(center(lane), line, receptorRadius - 10, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,249,231,.92)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(center(lane), line, receptorRadius - 18, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = hue; ctx.globalAlpha = .65;
      ctx.fillRect(center(lane) - 17, 550 + X, 34, 2);
      ctx.globalAlpha = 1;
    }
    ctx.shadowColor = '#ffe3a9'; ctx.shadowBlur = 14;
    ctx.strokeStyle = '#fff3d5'; ctx.lineWidth = 5; ctx.beginPath();
    ctx.moveTo(left, line); ctx.lineTo(left + 4 * laneW, line); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff8e8'; ctx.fillRect(left, line - 2, 4 * laneW, 3);
    // Put the key labels over the judgment line and inside the receptors so
    // they remain visible above the progress strip on short landscapes.
    ctx.font = '900 ' + (X > 100 ? 34 : 30) + 'px system-ui'; ctx.textAlign = 'center';
    ctx.shadowColor = '#050a1a'; ctx.shadowBlur = 8;
    for (var key = 0; key < 4; key++) {
      ctx.strokeStyle = '#07101f'; ctx.lineWidth = 5;
      ctx.strokeText(keys[key], center(key), line + 21);
      ctx.fillText(keys[key], center(key), line + 21);
    }
    ctx.shadowBlur = 0;
  }

  function beatGrid(ctx, beat, time, logic) {
    var performerY = 290 + X * .49;
    for (var b = Math.ceil(beat); b < Math.min(logic.TOTAL_BEATS, beat + 5); b++) {
      var y = line - (b * logic.BEAT - time) * 220;
      if (y < top || y >= line) continue;
      ctx.strokeStyle = b % 4 === 0 ? 'rgba(255,230,185,.34)' : 'rgba(221,229,255,.10)';
      ctx.lineWidth = b % 4 === 0 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(left, y);
      if (y > performerY - 145 && y < performerY + 95) {
        // Keep the beat count at the edges without drawing through the face.
        ctx.lineTo(left + laneW * 1.18, y);
        ctx.moveTo(left + laneW * 2.82, y);
      }
      ctx.lineTo(left + 4 * laneW, y); ctx.stroke();
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
      var x = noteCenter(note.lane, y), hue = colors[note.base];
      var w = 130 - 30 * ease(clamp((line - y) / (line - top), 0, 1));
      ctx.shadowColor = hue; ctx.shadowBlur = 20;
      ctx.fillStyle = '#050b1a'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 27, w, 54, 15); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = hue; ctx.beginPath(); ctx.roundRect(x - w / 2 + 4, y - 23, w - 8, 46, 12); ctx.fill();
      ctx.strokeStyle = '#fff9eb'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(x - w / 2 + 4, y - 23, w - 8, 46, 12); ctx.stroke();
      ctx.fillStyle = '#102039'; ctx.beginPath(); ctx.roundRect(x - w / 2 + 13, y - 15, w - 26, 30, 7); ctx.fill();
      ctx.fillStyle = '#fff9ee'; ctx.fillRect(x - (w - 64) / 2, y - 3, w - 64, 6);
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = hue; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - w / 2 + 1, y - 12); ctx.lineTo(x - w / 2 + 1, y + 12);
      ctx.moveTo(x + w / 2 - 1, y - 12); ctx.lineTo(x + w / 2 - 1, y + 12); ctx.stroke();
      ctx.globalAlpha = .58; ctx.fillStyle = hue;
      ctx.fillRect(x - (w - 50) / 2, y - 26, w - 50, 3); ctx.globalAlpha = 1;
    });
  }

  function hitLight(ctx, state, time, section) {
    var age = time - state.judgeAt;
    if (!state.judge || state.judge === 'MISS' || age < 0 || age >= .5 || state.judgeLane < 0) return;
    var heat = Math.pow(1 - age / .5, 1.3);
    var x = center(state.judgeLane), hue = strand(state.judgeLane, section);
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
    // The conductor visibly throws a thread from the nearer hand to the struck
    // receptor; the bright tip travels the arc, then sparks fan out of the key.
    var cy = 290 + X * .49;
    var hx = 400 + (x - 400) * .44;
    var hy = cy + (420 + Math.min(X * .14, 70)) * .07;
    var travel = clamp(age / .16, 0, 1), tt = ease(travel);
    var cx1 = hx + (x - hx) * .15, cy1 = hy - 70, cx2 = x, cy2 = line - 170;
    function bez(t, a, b, c, d) {
      var u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
    }
    ctx.lineCap = 'round'; ctx.shadowBlur = 16;
    ctx.strokeStyle = '#fff3cf'; ctx.shadowColor = hue; ctx.shadowBlur = 24; ctx.globalAlpha = Math.min(1, heat * 1.1); ctx.lineWidth = 4 + heat * 4;
    ctx.beginPath(); ctx.moveTo(hx, hy);
    for (var k = 1; k <= 18; k++) {
      var t = tt * k / 18;
      ctx.lineTo(bez(t, hx, cx1, cx2, x), bez(t, hy, cy1, cy2, line - 6));
    }
    ctx.stroke();
    ctx.fillStyle = '#fff8e2'; ctx.globalAlpha = heat;
    ctx.beginPath();
    ctx.arc(bez(tt, hx, cx1, cx2, x), bez(tt, hy, cy1, cy2, line - 6), 6 + heat * 3, 0, Math.PI * 2);
    ctx.fill();
    if (age > .1) {
      var burst = (age - .1) / .4;
      ctx.fillStyle = '#fff4d0';
      for (var sp = 0; sp < 14; sp++) {
        var ang = -Math.PI * (.08 + .84 * ((sp * 0.618) % 1));
        var dist = (26 + 62 * ((sp * 0.37) % 1)) * ease(clamp(burst, 0, 1));
        ctx.globalAlpha = Math.max(0, 1 - burst) * .9;
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * dist, line - 6 + Math.sin(ang) * dist, 2.6 * (1 - burst * .6), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function performanceLight(ctx, beat, section, state, time) {
    var cy = 290 + X * .49, phase = beat - Math.floor(beat);
    var pulse = Math.pow(1 - phase, 3);
    var age = time - state.judgeAt;
    var hit = state.judge && state.judge !== 'MISS' && age >= 0 ?
      Math.pow(clamp(1 - age / .5, 0, 1), 1.5) : 0;
    var hue = colors[section];
    ctx.save();
    // A successful strike cues the stage toward its receptor. The light lands
    // on the conductor first, then tracks toward the struck side while the
    // playable notes remain a separate foreground layer.
    var aim = hit ? (center(state.judgeLane) - 400) * .28 * hit :
      Math.sin(beat * .16) * 30;
    var beam = ctx.createLinearGradient(0, top, 0, cy + 160);
    beam.addColorStop(0, 'rgba(255,248,218,.03)');
    beam.addColorStop(.42, 'rgba(255,228,181,.23)');
    beam.addColorStop(1, 'rgba(255,225,172,0)');
    ctx.fillStyle = beam; ctx.globalAlpha = .72 + pulse * .16 + hit * .12;
    ctx.beginPath(); ctx.moveTo(355 + aim * .2, top);
    ctx.lineTo(445 + aim * .2, top);
    ctx.lineTo(548 + aim, cy + 160);
    ctx.lineTo(252 + aim, cy + 160); ctx.closePath(); ctx.fill();
    var focus = ctx.createRadialGradient(400 + aim, cy - 22, 8,
      400 + aim, cy - 22, 205);
    focus.addColorStop(0, 'rgba(255,242,201,.46)');
    focus.addColorStop(.45, 'rgba(165,204,241,.14)');
    focus.addColorStop(1, 'rgba(165,204,241,0)');
    ctx.fillStyle = focus; ctx.globalAlpha = .82 + pulse * .12 + hit * .06;
    ctx.fillRect(185 + aim, cy - 235, 430, 430);
    // Four practical fixtures give the hall a scored lighting sequence. They
    // run down the wings, away from both the upper notes and the timing row.
    for (var side = 0; side < 2; side++) {
      var x = side ? 741 : 59, travel = top + ((beat * 73 + side * 210) % (line - top));
      var wingColor = colors[(section + side) % 4];
      ctx.strokeStyle = wingColor; ctx.shadowColor = wingColor;
      ctx.shadowBlur = 19 + pulse * 13 + hit * 18;
      ctx.globalAlpha = .42 + pulse * .25 + hit * .12;
      ctx.lineWidth = 17 + pulse * 5;
      ctx.beginPath(); ctx.moveTo(x, top + 8); ctx.lineTo(x, line - 8); ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#fff0d5'; ctx.lineWidth = 3;
      ctx.globalAlpha = .37 + pulse * .32 + hit * .18;
      ctx.beginPath(); ctx.moveTo(x, top + 8); ctx.lineTo(x, line - 8); ctx.stroke();
      ctx.globalAlpha = .95; ctx.fillStyle = '#fff6dd';
      ctx.beginPath(); ctx.arc(x, travel, 5 + pulse * 3, 0, Math.PI * 2); ctx.fill();
      for (var bulb = 0; bulb < 4; bulb++) {
        var by = top + 35 + bulb * (line - top - 70) / 3;
        var active = Math.pow(Math.max(0, Math.cos(phase * Math.PI * 2 - bulb * .8 - side)), 4);
        ctx.fillStyle = wingColor; ctx.globalAlpha = .25 + active * .55 + hit * .12;
        ctx.beginPath(); ctx.arc(x + (side ? -15 : 15), by, 4 + active * 2, 0, Math.PI * 2); ctx.fill();
      }
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
    ctx.fillStyle = 'rgba(8,13,29,.96)'; ctx.beginPath(); ctx.roundRect(130, 2, 540, 40, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(255,225,172,.68)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(130, 2, 540, 40, 9); ctx.stroke();
    ctx.fillStyle = '#fff0cf'; ctx.font = '900 ' + (X > 100 ? 29 : 21) + 'px system-ui';
    ctx.textAlign = 'center'; ctx.shadowColor = '#050817'; ctx.shadowBlur = 7;
    ctx.fillText(preview ? 'ROTATE IN ' + Math.ceil(next - beat) + (Math.ceil(next - beat) === 1 ? ' BEAT' : ' BEATS') : 'LANES ROTATED', 400, X > 100 ? 27 : 26);
    ctx.shadowBlur = 0;
    for (var base = 0; base < 4; base++) {
      var from = center((base + current) % 4);
      var to = center((base + current + 1) % 4);
      if (to < from) to += 4 * laneW;
      var x = from + (to - from) * amount;
      if (x > center(3) + laneW / 2) x -= 4 * laneW;
      ctx.strokeStyle = colors[base]; ctx.globalAlpha = opacity * .55; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(from, 38); ctx.lineTo(x, 38); ctx.stroke();
      ctx.globalAlpha = opacity; ctx.shadowColor = colors[base]; ctx.shadowBlur = 8;
      ctx.fillStyle = colors[base]; ctx.beginPath(); ctx.arc(x, 38, 3, 0, Math.PI * 2); ctx.fill();
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

  function feedbackFx(ctx, section, state, time, run, foreground) {
    // The HTML song rail covers the canvas foot on compact layouts. Place
    // feedback just above the receptor rings, leaving the tap row readable.
    var tint = colors[section];
    var age2 = time - state.judgeAt;
    if (foreground && state.judge && age2 >= 0 && age2 < .65) {
      var a = clamp((.65 - age2) / .24, 0, 1);
      var cx = state.judgeLane >= 0 ? center(state.judgeLane) : 400;
      var col = state.judge === 'PERFECT' ? '#fff0b8' : state.judge === 'GOOD' ? '#8ee8e6' : '#ff7a8c';
      var miss = state.judge === 'MISS';
      var panelW = miss ? 154 : 202;
      var panelH = miss ? 48 : 57;
      cx = clamp(cx, left + panelW / 2, left + 4 * laneW - panelW / 2);
      var panelY = line - panelH - 55 - Math.min(age2 * 8, 4);
      ctx.save(); ctx.textAlign = 'center'; ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(5,12,29,.96)';
      ctx.beginPath(); ctx.roundRect(cx - panelW / 2, panelY, panelW, panelH, 12); ctx.fill();
      ctx.strokeStyle = col; ctx.shadowColor = col;
      ctx.shadowBlur = 14 + 12 * clamp(1 - age2 / .18, 0, 1);
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(cx - panelW / 2, panelY, panelW, panelH, 12); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = col;
      ctx.fillRect(cx - panelW / 2 + 11, panelY + 5, panelW - 22, 3);
      ctx.font = '900 ' + (miss ? 30 : 36) + 'px system-ui';
      ctx.shadowColor = '#050817'; ctx.shadowBlur = 6;
      ctx.fillText(state.judge, cx, panelY + 34);
      if (!miss) {
        var multiplier = Math.min(4, 1 + Math.floor((run.combo - 1) / 10));
        ctx.shadowBlur = 0; ctx.font = '900 19px system-ui';
        ctx.fillText('+' + (state.judge === 'PERFECT' ? 100 : 55) * multiplier,
          cx, panelY + 52);
      }
      ctx.restore();
    }
    if (!foreground && run.combo > 1 && state.judge !== 'MISS' && age2 >= 0 && age2 < .45) {
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
    performanceLight(ctx, beat, section, state, time);
    loom(ctx, beat, section, state, time, run);
    hitLight(ctx, state, time, section);
    beatGrid(ctx, beat, time, logic);
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
    feedbackFx(ctx, section, state, time, run, false);
    notes(ctx, run, time);
    feedbackFx(ctx, section, state, time, run, true);
    rotation(ctx, beat);
    songProgress(ctx, beat, logic.TOTAL_BEATS);
  };
})(typeof window !== 'undefined' ? window : this);
