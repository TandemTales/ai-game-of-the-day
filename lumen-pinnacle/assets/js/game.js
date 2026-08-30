(function (root) {
  'use strict';

  var LP = root.LP = root.LP || {};
  var TAU = Math.PI * 2;
  var WIDTH = 720;
  var HEIGHT = 1080;
  var MIN_X = 68;
  var MAX_X = WIDTH - 68;
  var MIN_Y = 78;
  var DRAIN_Y = HEIGHT + 28;
  var GRAVITY = 760;
  var FIXED_DT = 1 / 60;

  LP.WIDTH = WIDTH;
  LP.HEIGHT = HEIGHT;
  LP.GAME_ID = 'lumen-pinnacle';

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function distance(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function formatScore(score) { return String(Math.max(0, Math.floor(score))).padStart(6, '0'); }
  function nextRandom(state) {
    state.seed = (Math.imul(1664525, state.seed) + 1013904223) >>> 0;
    return state.seed / 4294967296;
  }

  function makeBall(x, y, vx, vy, bonus) {
    return { x: x, y: y, vx: vx, vy: vy, r: 12, active: true, bonus: !!bonus, hitCooldown: 0 };
  }

  function createState(seed) {
    return {
      seed: (seed == null ? 0x1a7e5eed : seed) >>> 0,
      status: 'ready',
      time: 0,
      score: 0,
      multiplier: 1,
      ballsRemaining: 3,
      targets: [false, false, false],
      balls: [makeBall(590, 930, 0, 0, false)],
      flippers: { left: 0, right: 0 },
      input: { left: false, right: false },
      respawnTimer: 0,
      multiballTimer: 0,
      laneCooldown: [0, 0],
      comboTimer: 0,
      combo: 0,
      flash: 0,
      shake: 0,
      event: { text: 'TABLE READY', ttl: 0, color: '#65f6ee' },
      particles: [],
      trail: [],
      audioEvents: []
    };
  }
  LP.createState = createState;
  LP.formatScore = formatScore;

  function emit(state, text, color) {
    state.event.text = text;
    state.event.ttl = 1.3;
    state.event.color = color || '#65f6ee';
  }
  function cue(state, name) { state.audioEvents.push(name); }
  function burst(state, x, y, color, count, power) {
    for (var i = 0; i < count; i += 1) {
      var angle = nextRandom(state) * TAU;
      var speed = (power || 130) * (0.35 + nextRandom(state) * 0.8);
      state.particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .45 + nextRandom(state) * .55, max: 1, color: color, size: 2 + nextRandom(state) * 4 });
    }
  }
  function score(state, points, label, color, x, y) {
    var total = Math.round(points * state.multiplier);
    state.score += total;
    state.combo += 1;
    state.comboTimer = 2.6;
    state.flash = Math.min(1, state.flash + .25);
    emit(state, label + '  +' + total, color);
    if (x != null) burst(state, x, y, color || '#65f6ee', 8, 120);
  }
  LP.scoreFor = function (base, multiplier) { return Math.round(base * Math.max(1, multiplier)); };

  function launch(state) {
    var main = state.balls[0];
    main.x = 590;
    main.y = 930;
    main.vx = -180;
    main.vy = -700;
    main.active = true;
    main.bonus = false;
    state.respawnTimer = 0;
    cue(state, 'launch');
  }
  function start(state) {
    if (state.status === 'playing') return false;
    state.status = 'playing';
    state.score = 0;
    state.multiplier = 1;
    state.ballsRemaining = 3;
    state.targets = [false, false, false];
    state.balls = [makeBall(590, 930, 0, 0, false)];
    state.multiballTimer = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.audioEvents.length = 0;
    emit(state, 'MAKE IT GLOW', '#65f6ee');
    launch(state);
    return true;
  }
  LP.start = start;
  LP.launch = launch;

  function flipperPose(side, value) {
    var left = side === 'left';
    var pivot = { x: left ? 246 : 474, y: 906 };
    var rest = left ? 0.38 : Math.PI - 0.38;
    var raised = left ? -0.35 : Math.PI + 0.35;
    var angle = rest + (raised - rest) * clamp(value, 0, 1);
    return { pivot: pivot, tip: { x: pivot.x + Math.cos(angle) * 154, y: pivot.y + Math.sin(angle) * 154 }, angle: angle };
  }
  LP.flipperPose = flipperPose;

  function reflectBall(ball, nx, ny, boost) {
    var dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
    }
    ball.vx *= boost || 1.02;
    ball.vy *= boost || 1.02;
  }

  var bumpers = [
    { x: 224, y: 292, r: 51, color: '#65f6ee' },
    { x: 496, y: 292, r: 51, color: '#ff6cb9' },
    { x: 360, y: 424, r: 57, color: '#9b7bff' }
  ];
  var targets = [
    { x: 135, y: 568, w: 126, h: 25, color: '#65f6ee' },
    { x: 297, y: 540, w: 126, h: 25, color: '#ffc86b' },
    { x: 459, y: 568, w: 126, h: 25, color: '#ff6cb9' }
  ];
  LP.bumpers = bumpers;
  LP.targets = targets;

  function collideBumper(state, ball, bumper) {
    var dx = ball.x - bumper.x;
    var dy = ball.y - bumper.y;
    var d = Math.hypot(dx, dy);
    var limit = bumper.r + ball.r;
    if (d >= limit || d === 0 || ball.hitCooldown > 0) return false;
    var nx = dx / d;
    var ny = dy / d;
    ball.x = bumper.x + nx * (limit + 1);
    ball.y = bumper.y + ny * (limit + 1);
    reflectBall(ball, nx, ny, 1.16);
    ball.vx += nx * 110;
    ball.vy += ny * 110;
    ball.hitCooldown = .08;
    score(state, 100, 'BUMPER', bumper.color, bumper.x, bumper.y);
    cue(state, 'bumper');
    burst(state, bumper.x + nx * bumper.r, bumper.y + ny * bumper.r, bumper.color, 12, 180);
    state.shake = Math.min(1, state.shake + .25);
    return true;
  }

  function collideTarget(state, ball, target, index) {
    var cx = clamp(ball.x, target.x, target.x + target.w);
    var cy = clamp(ball.y, target.y, target.y + target.h);
    var dx = ball.x - cx;
    var dy = ball.y - cy;
    if (dx * dx + dy * dy > ball.r * ball.r || ball.hitCooldown > 0) return false;
    if (Math.abs(dx) > Math.abs(dy)) {
      ball.vx = Math.sign(dx || ball.vx) * Math.abs(ball.vx || 300) * 1.04;
      ball.x = cx + Math.sign(dx || 1) * (ball.r + 1);
    } else {
      ball.vy = Math.sign(dy || ball.vy) * Math.abs(ball.vy || 300) * 1.04;
      ball.y = cy + Math.sign(dy || 1) * (ball.r + 1);
    }
    ball.hitCooldown = .09;
    if (!state.targets[index]) {
      state.targets[index] = true;
      score(state, 250, 'PRISM ' + (index + 1), target.color, target.x + target.w / 2, target.y);
      cue(state, 'target');
      if (state.targets[0] && state.targets[1] && state.targets[2]) {
        state.targets = [false, false, false];
        state.multiplier = clamp(state.multiplier + 1, 1, 5);
        state.multiballTimer = 10;
        state.balls.push(makeBall(350, 320, 290, 300, true));
        state.balls.push(makeBall(370, 340, -300, 260, true));
        score(state, 1800, 'PINNACLE MULTIBALL', '#ffc86b', 360, 380);
        cue(state, 'multiball');
        burst(state, 360, 380, '#ffc86b', 40, 260);
        state.shake = 1;
      }
    }
    return true;
  }

  function collideFlipper(state, ball, side, raised) {
    if (!raised || ball.y < 830 || ball.vy < -80) return false;
    var pose = flipperPose(side, state.flippers[side]);
    var ax = pose.pivot.x;
    var ay = pose.pivot.y;
    var bx = pose.tip.x;
    var by = pose.tip.y;
    var vx = bx - ax;
    var vy = by - ay;
    var len2 = vx * vx + vy * vy;
    var t = clamp(((ball.x - ax) * vx + (ball.y - ay) * vy) / len2, 0, 1);
    var px = ax + vx * t;
    var py = ay + vy * t;
    var dx = ball.x - px;
    var dy = ball.y - py;
    if (dx * dx + dy * dy > (ball.r + 13) * (ball.r + 13)) return false;
    var n = Math.hypot(dx, dy) || 1;
    ball.x = px + (dx / n) * (ball.r + 14);
    ball.y = py + (dy / n) * (ball.r + 14);
    ball.vy = -Math.max(410, Math.abs(ball.vy) * .92 + 210);
    ball.vx += (ball.x - pose.pivot.x) * (side === 'left' ? 1.8 : -1.8);
    ball.hitCooldown = .07;
    score(state, 25, side.toUpperCase() + ' FLIP', '#d8e2f4', ball.x, ball.y);
    cue(state, 'flipper');
    return true;
  }

  function drain(state, index) {
    var ball = state.balls[index];
    if (ball.bonus) {
      state.balls.splice(index, 1);
      return;
    }
    state.ballsRemaining -= 1;
    ball.active = false;
    if (state.ballsRemaining <= 0) {
      state.status = 'over';
      state.multiballTimer = 0;
      state.balls = [ball];
      emit(state, 'TABLE DRAINED', '#ff6cb9');
      cue(state, 'drain');
      burst(state, ball.x, HEIGHT - 78, '#ff6cb9', 24, 210);
      return;
    }
    state.respawnTimer = .8;
    emit(state, 'BALL ' + state.ballsRemaining + ' / RELAUNCH', '#ffc86b');
    cue(state, 'drain');
    burst(state, ball.x, HEIGHT - 78, '#ff6cb9', 18, 150);
  }

  function updateBall(state, ball, dt) {
    if (!ball.active) return;
    ball.hitCooldown = Math.max(0, ball.hitCooldown - dt);
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < MIN_X + ball.r) { ball.x = MIN_X + ball.r; ball.vx = Math.abs(ball.vx) * 1.01; cue(state, 'wall'); }
    if (ball.x > MAX_X - ball.r) { ball.x = MAX_X - ball.r; ball.vx = -Math.abs(ball.vx) * 1.01; cue(state, 'wall'); }
    if (ball.y < MIN_Y + ball.r) { ball.y = MIN_Y + ball.r; ball.vy = Math.abs(ball.vy) * 1.01; cue(state, 'wall'); }
    bumpers.forEach(function (bumper) { collideBumper(state, ball, bumper); });
    targets.forEach(function (target, index) { collideTarget(state, ball, target, index); });
    collideFlipper(state, ball, 'left', state.flippers.left > .45);
    collideFlipper(state, ball, 'right', state.flippers.right > .45);
    if (ball.y < 250 && ball.x < 135 && state.laneCooldown[0] <= 0) {
      state.laneCooldown[0] = 1.2;
      score(state, 150, 'LEFT LANE', '#65f6ee', 110, 180);
      cue(state, 'lane');
    }
    if (ball.y < 250 && ball.x > 585 && state.laneCooldown[1] <= 0) {
      state.laneCooldown[1] = 1.2;
      score(state, 150, 'RIGHT LANE', '#ff6cb9', 610, 180);
      cue(state, 'lane');
    }
    if (ball.y > DRAIN_Y) ball.active = false;
  }

  function step(state, input, dt) {
    if (!state || state.status !== 'playing') return state;
    dt = clamp(Number(dt) || FIXED_DT, 0, .05);
    input = input || state.input;
    state.time += dt;
    state.input.left = !!input.left;
    state.input.right = !!input.right;
    state.flippers.left += ((state.input.left ? 1 : 0) - state.flippers.left) * Math.min(1, dt * 18);
    state.flippers.right += ((state.input.right ? 1 : 0) - state.flippers.right) * Math.min(1, dt * 18);
    state.laneCooldown[0] = Math.max(0, state.laneCooldown[0] - dt);
    state.laneCooldown[1] = Math.max(0, state.laneCooldown[1] - dt);
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer === 0) state.combo = 0;
    state.event.ttl = Math.max(0, state.event.ttl - dt);
    state.flash = Math.max(0, state.flash - dt * 1.6);
    state.shake = Math.max(0, state.shake - dt * 2.5);
    if (state.multiballTimer > 0) {
      state.multiballTimer = Math.max(0, state.multiballTimer - dt);
      if (state.multiballTimer === 0) state.balls = state.balls.filter(function (ball) { return !ball.bonus; });
    }
    if (!state.balls[0].active && state.ballsRemaining > 0) {
      state.respawnTimer -= dt;
      if (state.respawnTimer <= 0) launch(state);
    }
    for (var i = state.balls.length - 1; i >= 0; i -= 1) {
      var ball = state.balls[i];
      if (ball.active) updateBall(state, ball, dt);
      if (ball.active === false && ball.y > DRAIN_Y - 20) drain(state, i);
    }
    state.particles = state.particles.filter(function (particle) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= .97;
      particle.vy = particle.vy * .97 + 100 * dt;
      return particle.life > 0;
    });
    var main = state.balls[0];
    if (main && main.active && (state.trail.length === 0 || distance(main.x, main.y, state.trail[state.trail.length - 1].x, state.trail[state.trail.length - 1].y) > 8)) {
      state.trail.push({ x: main.x, y: main.y, life: 1 });
      if (state.trail.length > 18) state.trail.shift();
    }
    state.trail.forEach(function (point) { point.life -= dt * 1.8; });
    state.trail = state.trail.filter(function (point) { return point.life > 0; });
    return state;
  }
  LP.step = step;

  function drawRoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function glowCircle(ctx, x, y, radius, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.shadowBlur = radius * .9;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function render(state, ctx) {
    if (!ctx) return;
    var shakeX = state.shake ? Math.sin(state.time * 70) * state.shake * 4 : 0;
    var shakeY = state.shake ? Math.cos(state.time * 61) * state.shake * 3 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.clearRect(-8, -8, WIDTH + 16, HEIGHT + 16);
    var bg = ctx.createRadialGradient(360, 420, 90, 360, 520, 720);
    bg.addColorStop(0, '#17152f'); bg.addColorStop(.5, '#0b1023'); bg.addColorStop(1, '#04050d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    for (var grid = 0; grid < 18; grid += 1) {
      ctx.strokeStyle = 'rgba(117, 146, 214, .07)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(50, 110 + grid * 52); ctx.lineTo(670, 110 + grid * 52); ctx.stroke();
    }
    drawRoundRect(ctx, 46, 48, 628, 986, 76);
    ctx.fillStyle = '#0c1022'; ctx.fill();
    ctx.strokeStyle = 'rgba(130, 157, 228, .46)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = 'rgba(101, 246, 238, .14)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.save();
    drawRoundRect(ctx, 67, 69, 586, 946, 62); ctx.clip();
    var inner = ctx.createLinearGradient(0, 70, 0, 1015);
    inner.addColorStop(0, '#131838'); inner.addColorStop(.5, '#0e1730'); inner.addColorStop(1, '#101326');
    ctx.fillStyle = inner; ctx.fillRect(67, 69, 586, 946);
    ctx.fillStyle = 'rgba(101, 246, 238, .045)'; ctx.fillRect(90, 86, 3, 830); ctx.fillRect(627, 86, 3, 830);
    for (var star = 0; star < 42; star += 1) {
      var sx = 92 + ((star * 97) % 530); var sy = 108 + ((star * 173) % 650);
      ctx.fillStyle = star % 3 === 0 ? 'rgba(255,108,185,.45)' : 'rgba(101,246,238,.34)';
      ctx.fillRect(sx, sy, star % 4 === 0 ? 3 : 2, star % 4 === 0 ? 3 : 2);
    }
    // The crown and shot lanes.
    ctx.strokeStyle = 'rgba(101,246,238,.32)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(110, 246); ctx.lineTo(110, 156); ctx.quadraticCurveTo(110, 105, 170, 105); ctx.lineTo(550, 105); ctx.quadraticCurveTo(610, 105, 610, 156); ctx.lineTo(610, 246); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,108,185,.24)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(127, 247); ctx.lineTo(127, 160); ctx.quadraticCurveTo(127, 122, 174, 122); ctx.lineTo(546, 122); ctx.quadraticCurveTo(593, 122, 593, 160); ctx.lineTo(593, 247); ctx.stroke();
    ctx.fillStyle = 'rgba(8,9,24,.6)'; drawRoundRect(ctx, 167, 86, 386, 70, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(155,123,255,.55)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#aeb8d3'; ctx.font = '700 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('LUMEN // PINNACLE', 360, 116);
    ctx.fillStyle = '#6879a2'; ctx.font = '10px system-ui'; ctx.fillText('BANK THE LIGHT', 360, 137);
    // Side lane arrows.
    [0, 1].forEach(function (lane) {
      var x = lane ? 610 : 110;
      ctx.strokeStyle = lane ? 'rgba(255,108,185,.72)' : 'rgba(101,246,238,.72)'; ctx.lineWidth = 3;
      for (var arrow = 0; arrow < 3; arrow += 1) {
        var ay = 175 + arrow * 45;
        ctx.beginPath(); ctx.moveTo(x - (lane ? -9 : 9), ay - 8); ctx.lineTo(x, ay); ctx.lineTo(x - (lane ? -9 : 9), ay + 8); ctx.stroke();
      }
    });
    // Bumpers.
    bumpers.forEach(function (bumper, index) {
      var pulse = 1 + Math.sin(state.time * 4 + index * 1.7) * .04;
      ctx.save(); ctx.translate(bumper.x, bumper.y); ctx.scale(pulse, pulse);
      ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, bumper.r + 10, 0, TAU); ctx.stroke();
      ctx.strokeStyle = bumper.color; ctx.lineWidth = 4; ctx.shadowBlur = 18; ctx.shadowColor = bumper.color; ctx.beginPath(); ctx.arc(0, 0, bumper.r, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(11,14,35,.92)'; ctx.beginPath(); ctx.arc(0, 0, bumper.r - 8, 0, TAU); ctx.fill();
      glowCircle(ctx, 0, 0, 11, bumper.color, .88);
      ctx.fillStyle = '#f4f8ff'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(index === 2 ? 'CORE' : 'ORB', 0, 4);
      ctx.restore();
    });
    // Prism bank.
    targets.forEach(function (target, index) {
      var lit = state.targets[index];
      var gradient = ctx.createLinearGradient(target.x, target.y, target.x + target.w, target.y);
      gradient.addColorStop(0, lit ? target.color : '#26304b'); gradient.addColorStop(1, lit ? '#f5f8ff' : '#1a2038');
      drawRoundRect(ctx, target.x, target.y, target.w, target.h, 8); ctx.fillStyle = gradient; ctx.fill();
      ctx.strokeStyle = lit ? target.color : 'rgba(200,215,245,.25)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = lit ? '#10142a' : '#7a88a6'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('PRISM ' + (index + 1), target.x + target.w / 2, target.y + 17);
    });
    // Table guide geometry.
    ctx.strokeStyle = 'rgba(155,123,255,.32)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(105, 680); ctx.quadraticCurveTo(116, 770, 175, 820); ctx.moveTo(615, 680); ctx.quadraticCurveTo(604, 770, 545, 820); ctx.stroke();
    ctx.strokeStyle = 'rgba(101,246,238,.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(162, 660); ctx.quadraticCurveTo(200, 750, 260, 800); ctx.moveTo(558, 660); ctx.quadraticCurveTo(520, 750, 460, 800); ctx.stroke();
    // Bonus marker.
    ctx.save(); ctx.translate(360, 690); ctx.rotate(Math.sin(state.time * 1.5) * .04); ctx.strokeStyle = state.multiballTimer > 0 ? '#ffc86b' : 'rgba(255,200,107,.28)'; ctx.lineWidth = 3; ctx.shadowBlur = state.multiballTimer > 0 ? 22 : 0; ctx.shadowColor = '#ffc86b'; ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.stroke(); ctx.fillStyle = state.multiballTimer > 0 ? 'rgba(255,200,107,.18)' : 'rgba(255,200,107,.05)'; ctx.fill(); ctx.fillStyle = '#ffc86b'; ctx.font = '700 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(state.multiballTimer > 0 ? 'MULTIBALL' : 'MULTI', 0, 3); ctx.restore();
    // Apron and drains.
    ctx.fillStyle = '#070914'; ctx.beginPath(); ctx.moveTo(112, 1015); ctx.lineTo(608, 1015); ctx.lineTo(510, 866); ctx.lineTo(210, 866); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,108,185,.22)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(210, 866); ctx.lineTo(112, 1015); ctx.moveTo(510, 866); ctx.lineTo(608, 1015); ctx.stroke();
    ctx.restore();
    // Particles and ball trail.
    state.trail.forEach(function (point, index) { glowCircle(ctx, point.x, point.y, 3 + index * .14, '#65f6ee', point.life * .18); });
    state.particles.forEach(function (particle) { glowCircle(ctx, particle.x, particle.y, particle.size, particle.color, clamp(particle.life / particle.max, 0, 1)); });
    // Flippers.
    ['left', 'right'].forEach(function (side) {
      var pose = flipperPose(side, state.flippers[side]);
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(4,6,15,.9)'; ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(pose.pivot.x, pose.pivot.y); ctx.lineTo(pose.tip.x, pose.tip.y); ctx.stroke();
      ctx.strokeStyle = side === 'left' ? '#65f6ee' : '#ff6cb9'; ctx.lineWidth = 24; ctx.shadowBlur = 16; ctx.shadowColor = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(pose.pivot.x, pose.pivot.y); ctx.lineTo(pose.tip.x, pose.tip.y); ctx.stroke();
      ctx.strokeStyle = '#eaf5ff'; ctx.globalAlpha = .55; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(pose.pivot.x + 4, pose.pivot.y - 3); ctx.lineTo(pose.tip.x - (side === 'left' ? 8 : -8), pose.tip.y - 3); ctx.stroke();
      ctx.restore();
      glowCircle(ctx, pose.pivot.x, pose.pivot.y, 17, side === 'left' ? '#65f6ee' : '#ff6cb9', .8);
      glowCircle(ctx, pose.pivot.x, pose.pivot.y, 7, '#f4f8ff', .8);
    });
    // Balls.
    state.balls.forEach(function (ball) {
      if (!ball.active) return;
      glowCircle(ctx, ball.x, ball.y, ball.r + 7, ball.bonus ? '#ffc86b' : '#e6ffff', .18);
      var ballGradient = ctx.createRadialGradient(ball.x - 4, ball.y - 5, 1, ball.x, ball.y, ball.r);
      ballGradient.addColorStop(0, '#ffffff'); ballGradient.addColorStop(.35, ball.bonus ? '#ffc86b' : '#d9ffff'); ballGradient.addColorStop(1, ball.bonus ? '#ff8e5b' : '#5bcbd4');
      ctx.fillStyle = ballGradient; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = ball.bonus ? '#ffc86b' : '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    if (state.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (state.flash * .08) + ')'; ctx.fillRect(67, 69, 586, 946); }
    if (state.event.ttl > 0 && state.status === 'playing') {
      ctx.save(); ctx.globalAlpha = clamp(state.event.ttl, 0, 1); ctx.textAlign = 'center'; ctx.font = '800 16px system-ui'; ctx.fillStyle = state.event.color; ctx.shadowBlur = 16; ctx.shadowColor = state.event.color; ctx.fillText(state.event.text, 360, 770); ctx.restore();
    }
    ctx.restore();
  }
  LP.render = render;

  function createAudio() {
    var AudioContext = root.AudioContext || root.webkitAudioContext;
    if (!AudioContext) return function () {};
    var context;
    return function (name) {
      try {
        context = context || new AudioContext();
        if (context.state === 'suspended') context.resume();
        var frequencies = { launch: 220, bumper: 430, target: 660, flipper: 170, lane: 520, multiball: 880, drain: 90, wall: 260 };
        var oscillator = context.createOscillator(); var gain = context.createGain();
        oscillator.type = name === 'multiball' ? 'sine' : 'triangle'; oscillator.frequency.value = frequencies[name] || 300;
        gain.gain.setValueAtTime(.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(name === 'drain' ? .06 : .035, context.currentTime + .008); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + (name === 'multiball' ? .34 : .12));
        oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .36);
      } catch (error) { /* Audio is an enhancement; gameplay remains usable. */ }
    };
  }

  function submitScore(scoreValue, name, resultNode) {
    var cleanName = String(name || 'PLAYER').trim().slice(0, 20) || 'PLAYER';
    var rankUrl = '/api/leaderboard/rank?gameId=' + encodeURIComponent(LP.GAME_ID) + '&score=' + encodeURIComponent(Math.floor(scoreValue));
    return fetch(rankUrl).then(function (rankResponse) {
      if (!rankResponse.ok) throw new Error('rank unavailable');
      return rankResponse.json();
    }).then(function (rank) {
      return fetch('/api/leaderboard/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: LP.GAME_ID, score: Math.floor(scoreValue), name: cleanName }) }).then(function (submitResponse) {
        if (!submitResponse.ok) throw new Error('submit unavailable');
        return submitResponse.json().then(function (submitted) { return { rank: submitted.rank || rank.rank }; });
      });
    }).then(function (response) {
      if (resultNode) resultNode.textContent = response.rank ? 'POSTED — RANK #' + response.rank : 'SCORE POSTED';
      return response;
    }).catch(function () {
      if (resultNode) resultNode.textContent = 'LEADERBOARD OFFLINE — SCORE KEPT LOCAL';
      return { offline: true };
    });
  }
  LP.submitScore = submitScore;

  function boot() {
    var canvas = root.document && root.document.getElementById('gameCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var state = createState();
    var input = { left: false, right: false };
    var audio = createAudio();
    var last = performance.now();
    var accumulator = 0;
    var overlay = root.document.getElementById('screenOverlay');
    var startCard = root.document.getElementById('startCard');
    var gameOverCard = root.document.getElementById('gameOverCard');
    var statusText = root.document.getElementById('statusText');
    function updateHud() {
      root.document.getElementById('scoreValue').textContent = formatScore(state.score);
      root.document.getElementById('multiplierValue').textContent = '×' + state.multiplier;
      root.document.getElementById('ballsValue').textContent = state.ballsRemaining;
      var lit = state.targets.filter(Boolean).length;
      root.document.getElementById('bankValue').textContent = lit + '/3';
      state.targets.forEach(function (on, index) { root.document.getElementById('prism' + index).classList.toggle('lit', on); });
      statusText.textContent = state.status === 'playing' ? (state.multiballTimer > 0 ? 'MULTIBALL ACTIVE' : 'TABLE LIVE') : state.status === 'over' ? 'RUN COMPLETE' : 'TABLE READY';
      if (state.status === 'over') {
        root.document.getElementById('finalScore').textContent = formatScore(state.score);
        startCard.hidden = true; gameOverCard.hidden = false; overlay.hidden = false;
      }
    }
    function begin() { start(state); startCard.hidden = true; gameOverCard.hidden = true; overlay.hidden = true; }
    function setFlipper(side, down) { input[side] = down; state.input[side] = down; if (down) audio('flipper'); }
    function bindButton(id, side) {
      var button = root.document.getElementById(id);
      ['pointerdown', 'touchstart'].forEach(function (eventName) { button.addEventListener(eventName, function (event) { event.preventDefault(); setFlipper(side, true); }); });
      ['pointerup', 'pointercancel', 'pointerleave', 'touchend', 'touchcancel'].forEach(function (eventName) { button.addEventListener(eventName, function (event) { event.preventDefault(); setFlipper(side, false); }); });
    }
    bindButton('leftFlipper', 'left'); bindButton('rightFlipper', 'right');
    root.document.getElementById('startButton').addEventListener('click', begin);
    root.document.getElementById('replayButton').addEventListener('click', begin);
    root.document.getElementById('scoreForm').addEventListener('submit', function (event) { event.preventDefault(); submitScore(state.score, root.document.getElementById('playerName').value, root.document.getElementById('scoreResult')); });
    root.document.addEventListener('keydown', function (event) {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') { event.preventDefault(); setFlipper('left', true); }
      if (event.code === 'ArrowRight' || event.code === 'KeyD') { event.preventDefault(); setFlipper('right', true); }
      if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); if (state.status !== 'playing') begin(); }
    });
    root.document.addEventListener('keyup', function (event) {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') setFlipper('left', false);
      if (event.code === 'ArrowRight' || event.code === 'KeyD') setFlipper('right', false);
    });
    canvas.addEventListener('pointerdown', function () { if (state.status !== 'playing') begin(); });
    function frame(now) {
      var elapsed = Math.min(.1, (now - last) / 1000); last = now; accumulator += elapsed;
      while (accumulator >= FIXED_DT) { step(state, input, FIXED_DT); accumulator -= FIXED_DT; }
      while (state.audioEvents.length) audio(state.audioEvents.shift());
      render(state, ctx); updateHud(); root.requestAnimationFrame(frame);
    }
    updateHud(); root.requestAnimationFrame(frame);
  }
  LP.boot = boot;
  if (root.document) root.addEventListener('load', boot);
}(typeof window !== 'undefined' ? window : globalThis));
