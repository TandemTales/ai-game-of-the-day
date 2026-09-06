(function (root) {
  'use strict';

  var OO = root.OO = root.OO || {};
  var TAU = Math.PI * 2;
  var WIDTH = 960;
  var HEIGHT = 600;
  var EDGE = 34;
  var FIXED_DT = 1 / 60;
  var PALETTE = ['#78f5d1', '#ffc66d', '#ff7cae', '#8ca4ff'];
  var NAMES = ['MINT', 'SOL', 'ROSE', 'AZURE'];

  OO.WIDTH = WIDTH;
  OO.HEIGHT = HEIGHT;
  OO.GAME_ID = 'orbit-orchard';
  OO.PALETTE = PALETTE.slice();

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function distance(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function formatScore(score) { return String(Math.max(0, Math.floor(score))).padStart(6, '0'); }
  function formatTime(seconds) {
    var safe = Math.max(0, Math.ceil(seconds));
    return String(Math.floor(safe / 60)).padStart(2, '0') + ':' + String(safe % 60).padStart(2, '0');
  }
  function nextRandom(source) {
    source.seed = (Math.imul(1664525, source.seed) + 1013904223) >>> 0;
    return source.seed / 4294967296;
  }
  function randomBetween(source, min, max) { return min + (max - min) * nextRandom(source); }
  function scoreFor(base, multiplier) { return Math.round(base * Math.max(1, multiplier || 1)); }

  function makeRelic(x, y, radius, color, kind, phase) {
    return {
      x: x, y: y, radius: radius, color: color, kind: kind,
      vx: 0, vy: 0, phase: phase || 0, active: true, cooldown: 0
    };
  }

  function buildField(seed) {
    var source = { seed: (seed == null ? 0x0b17cafe : seed) >>> 0 };
    var relics = [];
    var stars = [];
    var i;
    for (i = 0; i < 44; i += 1) {
      var radius = 6 + nextRandom(source) * 11;
      relics.push(makeRelic(
        randomBetween(source, 74, WIDTH - 74),
        randomBetween(source, 72, HEIGHT - 72),
        radius,
        Math.floor(nextRandom(source) * PALETTE.length),
        Math.floor(nextRandom(source) * 3),
        nextRandom(source) * TAU
      ));
    }
    for (i = 0; i < 12; i += 1) {
      relics.push(makeRelic(
        randomBetween(source, 70, WIDTH - 70),
        randomBetween(source, 70, HEIGHT - 70),
        20 + nextRandom(source) * 12,
        i % PALETTE.length,
        3,
        nextRandom(source) * TAU
      ));
    }
    for (i = 0; i < 80; i += 1) {
      stars.push({
        x: randomBetween(source, EDGE, WIDTH - EDGE),
        y: randomBetween(source, EDGE, HEIGHT - EDGE),
        r: 0.5 + nextRandom(source) * 1.8,
        a: 0.18 + nextRandom(source) * 0.5,
        phase: nextRandom(source) * TAU
      });
    }
    return { relics: relics, stars: stars };
  }

  function makeHazards() {
    return [
      { x: 178, y: 160, radius: 24, phase: 0.4, speed: 0.8, cooldown: 0 },
      { x: 790, y: 156, radius: 19, phase: 2.1, speed: -0.55, cooldown: 0 },
      { x: 770, y: 446, radius: 28, phase: 4.2, speed: 0.65, cooldown: 0 },
      { x: 194, y: 450, radius: 17, phase: 5.3, speed: -0.45, cooldown: 0 }
    ];
  }

  function createState(seed) {
    var field = buildField(seed);
    return {
      seed: (seed == null ? 0x0b17cafe : seed) >>> 0,
      status: 'ready',
      time: 0,
      timeLeft: 65,
      score: 0,
      multiplier: 1,
      combo: 0,
      comboTimer: 0,
      lastColor: -1,
      absorbed: 0,
      mass: 256,
      event: { text: 'ORCHARD DORMANT', ttl: 0, color: '#78f5d1' },
      player: { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0, radius: 16, spin: 0 },
      input: { up: false, down: false, left: false, right: false, pointerActive: false, pointerX: WIDTH / 2, pointerY: HEIGHT / 2 },
      relics: field.relics,
      stars: field.stars,
      hazards: makeHazards(),
      particles: [],
      trail: [],
      flash: 0,
      shake: 0,
      gravityBloom: 0,
      audioEvents: []
    };
  }
  OO.createState = createState;
  OO.formatScore = formatScore;
  OO.formatTime = formatTime;
  OO.scoreFor = scoreFor;

  function emit(state, text, color) {
    state.event.text = text;
    state.event.ttl = 1.35;
    state.event.color = color || '#78f5d1';
  }
  function cue(state, name) { state.audioEvents.push(name); }
  function burst(state, x, y, color, count, power) {
    var source = { seed: (state.seed + state.absorbed * 977 + Math.floor(state.time * 1000)) >>> 0 };
    for (var i = 0; i < count; i += 1) {
      var angle = nextRandom(source) * TAU;
      var speed = (power || 110) * (0.35 + nextRandom(source) * 0.85);
      state.particles.push({
        x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.42 + nextRandom(source) * 0.7, max: 1, color: color, size: 1.5 + nextRandom(source) * 3.8
      });
    }
  }

  function absorb(state, relic) {
    if (!relic || !relic.active) return false;
    var player = state.player;
    relic.active = false;
    state.absorbed += 1;
    var sameColor = state.lastColor === relic.color;
    state.combo = sameColor ? state.combo + 1 : 1;
    state.comboTimer = 2.5;
    state.multiplier = clamp(1 + Math.floor(state.combo / 4), 1, 6);
    var base = 30 + Math.round(relic.radius * 9);
    var total = scoreFor(base, state.multiplier);
    if (sameColor) total += scoreFor(80, state.multiplier);
    state.score += total;
    state.mass = Math.round(player.radius * player.radius);
    player.radius = Math.min(66, Math.sqrt(player.radius * player.radius + relic.radius * relic.radius * 0.82));
    state.mass = Math.round(player.radius * player.radius);
    state.lastColor = relic.color;
    state.gravityBloom = 1;
    state.flash = Math.min(1, state.flash + 0.32);
    state.shake = Math.min(1, state.shake + 0.12);
    var label = sameColor ? 'CONSTELLATION LINK' : NAMES[relic.color] + ' RELIC';
    emit(state, label + '  +' + total, PALETTE[relic.color]);
    burst(state, relic.x, relic.y, PALETTE[relic.color], sameColor ? 18 : 10, sameColor ? 170 : 125);
    cue(state, sameColor ? 'link' : 'absorb');
    return true;
  }
  OO.absorb = absorb;
  OO.canAbsorb = function (playerRadius, relicRadius) { return relicRadius <= playerRadius * 0.96; };

  function resetInto(target, source) {
    Object.keys(target).forEach(function (key) { delete target[key]; });
    Object.keys(source).forEach(function (key) { target[key] = source[key]; });
    return target;
  }

  function start(state) {
    if (state.status === 'playing') return false;
    var fresh = createState(state.seed);
    resetInto(state, fresh);
    state.status = 'playing';
    state.timeLeft = 65;
    state.event = { text: 'ROLL THE ORCHARD', ttl: 1.5, color: '#78f5d1' };
    cue(state, 'start');
    return true;
  }
  OO.start = start;

  function finish(state, message) {
    if (state.status !== 'playing') return;
    state.status = 'over';
    emit(state, message || 'ORBIT DECAYED', '#ff7cae');
    cue(state, 'over');
    burst(state, state.player.x, state.player.y, '#ff7cae', 28, 190);
  }

  function updatePlayer(state, input, dt) {
    var player = state.player;
    var dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (input.pointerActive) {
      dx = input.pointerX - player.x;
      dy = input.pointerY - player.y;
      var pointerDistance = Math.hypot(dx, dy);
      if (pointerDistance > 8) { dx /= pointerDistance; dy /= pointerDistance; }
      else { dx = 0; dy = 0; }
    } else {
      var keyDistance = Math.hypot(dx, dy);
      if (keyDistance > 0) { dx /= keyDistance; dy /= keyDistance; }
    }
    var maxSpeed = 170 + player.radius * 3.8;
    var accel = input.pointerActive ? 580 : 460;
    player.vx += dx * accel * dt;
    player.vy += dy * accel * dt;
    var speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed) {
      player.vx = player.vx / speed * maxSpeed;
      player.vy = player.vy / speed * maxSpeed;
    }
    var drag = Math.pow(0.0007, dt);
    player.vx *= drag;
    player.vy *= drag;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    if (player.x < EDGE + player.radius) { player.x = EDGE + player.radius; player.vx = Math.abs(player.vx) * 0.52; }
    if (player.x > WIDTH - EDGE - player.radius) { player.x = WIDTH - EDGE - player.radius; player.vx = -Math.abs(player.vx) * 0.52; }
    if (player.y < EDGE + player.radius) { player.y = EDGE + player.radius; player.vy = Math.abs(player.vy) * 0.52; }
    if (player.y > HEIGHT - EDGE - player.radius) { player.y = HEIGHT - EDGE - player.radius; player.vy = -Math.abs(player.vy) * 0.52; }
    player.spin += (Math.hypot(player.vx, player.vy) / Math.max(1, player.radius)) * dt;
  }

  function updateRelics(state, dt) {
    var player = state.player;
    var gravity = 12 + player.radius * 1.65;
    var activeCount = 0;
    state.relics.forEach(function (relic) {
      if (!relic.active) return;
      activeCount += 1;
      relic.cooldown = Math.max(0, relic.cooldown - dt);
      var dx = player.x - relic.x;
      var dy = player.y - relic.y;
      var d = Math.max(28, Math.hypot(dx, dy));
      var influence = clamp(1 - d / 340, 0, 1);
      relic.vx += dx / d * gravity * influence * dt;
      relic.vy += dy / d * gravity * influence * dt;
      relic.vx *= Math.pow(0.06, dt);
      relic.vy *= Math.pow(0.06, dt);
      relic.x += relic.vx * dt;
      relic.y += relic.vy * dt;
      if (relic.x < EDGE + relic.radius) { relic.x = EDGE + relic.radius; relic.vx = Math.abs(relic.vx) * 0.45; }
      if (relic.x > WIDTH - EDGE - relic.radius) { relic.x = WIDTH - EDGE - relic.radius; relic.vx = -Math.abs(relic.vx) * 0.45; }
      if (relic.y < EDGE + relic.radius) { relic.y = EDGE + relic.radius; relic.vy = Math.abs(relic.vy) * 0.45; }
      if (relic.y > HEIGHT - EDGE - relic.radius) { relic.y = HEIGHT - EDGE - relic.radius; relic.vy = -Math.abs(relic.vy) * 0.45; }
      if (d < player.radius + relic.radius && OO.canAbsorb(player.radius, relic.radius)) absorb(state, relic);
    });
    if (activeCount === 0) finish(state, 'ORCHARD HARVESTED');
  }

  function updateHazards(state, dt) {
    var player = state.player;
    state.hazards.forEach(function (hazard) {
      hazard.phase += hazard.speed * dt;
      hazard.cooldown = Math.max(0, hazard.cooldown - dt);
      var hx = hazard.x + Math.cos(hazard.phase) * 5;
      var hy = hazard.y + Math.sin(hazard.phase * 1.4) * 5;
      if (distance(player.x, player.y, hx, hy) < player.radius + hazard.radius && hazard.cooldown <= 0) {
        hazard.cooldown = 1.0;
        state.timeLeft = Math.max(0, state.timeLeft - 4);
        state.score = Math.max(0, state.score - 90);
        state.flash = Math.min(1, state.flash + 0.5);
        state.shake = Math.min(1, state.shake + 0.35);
        var nx = player.x - hx;
        var ny = player.y - hy;
        var nd = Math.hypot(nx, ny) || 1;
        player.vx += nx / nd * 280;
        player.vy += ny / nd * 280;
        emit(state, 'GRAVITY WELL  −4 SEC', '#ff7cae');
        burst(state, hx, hy, '#ff7cae', 16, 180);
        cue(state, 'hazard');
      }
    });
  }

  function updateParticles(state, dt) {
    state.particles = state.particles.filter(function (particle) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(0.04, dt);
      particle.vy *= Math.pow(0.04, dt);
      return particle.life > 0;
    });
    state.trail.push({ x: state.player.x, y: state.player.y, r: state.player.radius, life: 1 });
    if (state.trail.length > 20) state.trail.shift();
    state.trail.forEach(function (dot) { dot.life -= dt * 2.4; });
    state.trail = state.trail.filter(function (dot) { return dot.life > 0; });
  }

  function step(state, input, dt) {
    if (!state || state.status !== 'playing') return state;
    var safeDt = clamp(dt == null ? FIXED_DT : dt, 0, 0.05);
    state.time += safeDt;
    state.timeLeft = Math.max(0, state.timeLeft - safeDt);
    state.event.ttl = Math.max(0, state.event.ttl - safeDt);
    state.flash = Math.max(0, state.flash - safeDt * 1.8);
    state.shake = Math.max(0, state.shake - safeDt * 1.9);
    state.gravityBloom = Math.max(0, state.gravityBloom - safeDt * 0.8);
    state.comboTimer = Math.max(0, state.comboTimer - safeDt);
    if (state.comboTimer === 0) { state.combo = 0; state.multiplier = 1; state.lastColor = -1; }
    state.input = input || state.input;
    updatePlayer(state, state.input, safeDt);
    updateRelics(state, safeDt);
    updateHazards(state, safeDt);
    updateParticles(state, safeDt);
    if (state.timeLeft <= 0) finish(state, 'ORBIT DECAYED');
    return state;
  }
  OO.step = step;

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawBackground(ctx, state) {
    var bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bg.addColorStop(0, '#061c2a');
    bg.addColorStop(0.48, '#081a24');
    bg.addColorStop(1, '#170f27');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    ctx.globalAlpha = 0.8;
    state.stars.forEach(function (star) {
      var alpha = star.a * (0.72 + Math.sin(state.time * 1.5 + star.phase) * 0.28);
      ctx.fillStyle = 'rgba(177,236,255,' + alpha.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, TAU); ctx.fill();
    });
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(115, 240, 213, 0.09)';
    ctx.lineWidth = 1;
    for (var x = 64; x < WIDTH; x += 96) {
      ctx.beginPath(); ctx.moveTo(x, EDGE); ctx.lineTo(x - 120, HEIGHT - EDGE); ctx.stroke();
    }
    for (var y = 76; y < HEIGHT - 20; y += 88) {
      ctx.beginPath(); ctx.moveTo(EDGE, y); ctx.lineTo(WIDTH - EDGE, y + 18); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 198, 109, 0.12)';
    ctx.setLineDash([5, 12]);
    ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, 205 + Math.sin(state.time * 0.45) * 4, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, 330 + Math.sin(state.time * 0.3 + 1) * 6, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(118, 245, 209, 0.23)';
    ctx.lineWidth = 2;
    roundRect(ctx, EDGE, EDGE, WIDTH - EDGE * 2, HEIGHT - EDGE * 2, 26);
    ctx.stroke();
    ctx.restore();
  }

  function drawHazard(ctx, hazard, time) {
    var x = hazard.x + Math.cos(hazard.phase) * 5;
    var y = hazard.y + Math.sin(hazard.phase * 1.4) * 5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * hazard.speed);
    ctx.strokeStyle = 'rgba(255,124,174,.32)';
    ctx.lineWidth = 2;
    for (var i = 0; i < 3; i += 1) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath(); ctx.ellipse(0, 0, hazard.radius + 9 + i * 5, hazard.radius - 5 + i * 3, 0, 0, TAU); ctx.stroke();
    }
    var glow = ctx.createRadialGradient(0, 0, 2, 0, 0, hazard.radius + 13);
    glow.addColorStop(0, '#080713'); glow.addColorStop(.5, 'rgba(15,7,29,.95)'); glow.addColorStop(1, 'rgba(255,72,130,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, hazard.radius + 16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#020207'; ctx.beginPath(); ctx.arc(0, 0, hazard.radius, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,124,174,.75)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, hazard.radius, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function drawRelic(ctx, relic, time) {
    var color = PALETTE[relic.color];
    var bob = Math.sin(time * 2.2 + relic.phase) * 2.2;
    ctx.save();
    ctx.translate(relic.x, relic.y + bob);
    ctx.rotate(relic.phase + time * 0.35);
    ctx.globalAlpha = relic.active ? 1 : 0;
    ctx.shadowColor = color; ctx.shadowBlur = relic.kind === 3 ? 22 : 13;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (relic.kind === 0) {
      ctx.arc(0, 0, relic.radius, 0, TAU);
    } else if (relic.kind === 1) {
      ctx.moveTo(0, -relic.radius * 1.2); ctx.lineTo(relic.radius, 0); ctx.lineTo(0, relic.radius * 1.2); ctx.lineTo(-relic.radius, 0); ctx.closePath();
    } else {
      for (var i = 0; i < 6; i += 1) { var angle = i * TAU / 6; var px = Math.cos(angle) * relic.radius; var py = Math.sin(angle) * relic.radius; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.closePath();
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.68)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(-relic.radius * .25, -relic.radius * .28, Math.max(1.2, relic.radius * .18), 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function drawPlayer(ctx, state) {
    var p = state.player;
    state.trail.forEach(function (dot) {
      ctx.globalAlpha = dot.life * 0.18;
      ctx.fillStyle = '#78f5d1'; ctx.beginPath(); ctx.arc(dot.x, dot.y, dot.r * (0.45 + dot.life * 0.25), 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin * 0.45);
    var radius = p.radius;
    var glow = ctx.createRadialGradient(0, 0, radius * .2, 0, 0, radius * 2.6);
    glow.addColorStop(0, 'rgba(120,245,209,.42)'); glow.addColorStop(1, 'rgba(120,245,209,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, radius * 2.6, 0, TAU); ctx.fill();
    if (state.gravityBloom > 0.01 || radius > 23) {
      ctx.globalAlpha = 0.3 + Math.min(.45, radius / 120);
      ctx.strokeStyle = '#78f5d1'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, radius + 10 + Math.sin(state.time * 5) * 2, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.shadowColor = '#78f5d1'; ctx.shadowBlur = 18;
    var body = ctx.createRadialGradient(-radius * .3, -radius * .35, 1, 0, 0, radius * 1.3);
    body.addColorStop(0, '#f1fff9'); body.addColorStop(.23, '#78f5d1'); body.addColorStop(1, '#247f82');
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#d7fff1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(9,67,74,.8)'; ctx.lineWidth = Math.max(1, radius * .08);
    ctx.beginPath(); ctx.moveTo(-radius * .6, radius * .38); ctx.quadraticCurveTo(0, radius * .66, radius * .58, radius * .25); ctx.stroke();
    ctx.fillStyle = '#ffc66d'; ctx.beginPath(); ctx.ellipse(radius * .45, -radius * .42, radius * .22, radius * .1, -.45, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function draw(ctx, state) {
    if (!ctx || !state) return;
    ctx.save();
    if (state.shake > 0) ctx.translate(Math.sin(state.time * 70) * state.shake * 3, Math.cos(state.time * 61) * state.shake * 2);
    drawBackground(ctx, state);
    state.hazards.forEach(function (hazard) { drawHazard(ctx, hazard, state.time); });
    state.relics.forEach(function (relic) { if (relic.active) drawRelic(ctx, relic, state.time); });
    drawPlayer(ctx, state);
    state.particles.forEach(function (particle) {
      ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1);
      ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (state.event.ttl > 0) {
      var alpha = clamp(state.event.ttl * 1.5, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(4,11,20,.76)'; roundRect(ctx, WIDTH / 2 - 142, 18, 284, 32, 16); ctx.fill();
      ctx.strokeStyle = state.event.color; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = state.event.color; ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(state.event.text, WIDTH / 2, 34);
    }
    if (state.flash > 0) {
      ctx.globalAlpha = state.flash * .09; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    ctx.restore();
  }
  OO.draw = draw;

  function submitScore(scoreValue, name, resultNode) {
    var cleanName = String(name || 'PLAYER').trim().replace(/[^\w \-'.!]/g, '').slice(0, 20) || 'PLAYER';
    var score = Math.floor(scoreValue);
    var rankUrl = '/api/leaderboard/rank?gameId=' + encodeURIComponent(OO.GAME_ID) + '&score=' + encodeURIComponent(score);
    return root.fetch(rankUrl, { headers: { 'Accept': 'application/json' } }).then(function (rankResponse) {
      if (!rankResponse.ok) throw new Error('rank unavailable');
      return rankResponse.json();
    }).then(function (rank) {
      return root.fetch('/api/leaderboard/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: OO.GAME_ID, score: score, name: cleanName })
      }).then(function (submitResponse) {
        if (!submitResponse.ok) throw new Error('submit unavailable');
        return submitResponse.json().then(function (submitted) { return { rank: submitted.rank || rank.rank }; });
      });
    }).then(function (response) {
      if (resultNode) resultNode.textContent = response.rank ? 'Posted — rank #' + response.rank : 'Score posted.';
      return response;
    }).catch(function () {
      if (resultNode) resultNode.textContent = 'Leaderboard unavailable here — score kept locally.';
      return { offline: true };
    });
  }
  OO.submitScore = submitScore;

  function init() {
    if (!root.document) return;
    var canvas = root.document.getElementById('gameCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var state = createState(Date.now() >>> 0);
    var overlay = root.document.getElementById('screenOverlay');
    var startCard = root.document.getElementById('startCard');
    var gameOverCard = root.document.getElementById('gameOverCard');
    var startButton = root.document.getElementById('startButton');
    var replayButton = root.document.getElementById('replayButton');
    var form = root.document.getElementById('scoreForm');
    var scoreNode = root.document.getElementById('scoreValue');
    var massNode = root.document.getElementById('massValue');
    var comboNode = root.document.getElementById('comboValue');
    var timeNode = root.document.getElementById('timeValue');
    var statusNode = root.document.getElementById('statusText');
    var finalScoreNode = root.document.getElementById('finalScore');
    var resultNode = root.document.getElementById('scoreResult');
    var hintNode = root.document.getElementById('touchHint');
    var last = 0;
    var animation = null;

    function setStatus(text) { if (statusNode) statusNode.textContent = text; }
    function syncOverlay() {
      var playing = state.status === 'playing';
      overlay.hidden = playing;
      startCard.hidden = playing || state.status === 'over';
      gameOverCard.hidden = playing || state.status !== 'over';
      if (state.status === 'over' && finalScoreNode) finalScoreNode.textContent = formatScore(state.score);
      if (hintNode) hintNode.hidden = playing;
    }
    function syncHud() {
      if (scoreNode) scoreNode.textContent = formatScore(state.score);
      if (massNode) massNode.textContent = Math.round(state.player.radius * state.player.radius);
      if (comboNode) comboNode.textContent = '×' + state.multiplier + (state.combo > 1 ? ' / ' + state.combo : '');
      if (timeNode) timeNode.textContent = formatTime(state.timeLeft);
      setStatus(state.status === 'playing' ? 'ORBIT STABLE' : state.status === 'over' ? 'ORBIT DECAYED' : 'SEED DORMANT');
    }
    function pointerPosition(event) {
      var rect = canvas.getBoundingClientRect();
      state.input.pointerX = clamp((event.clientX - rect.left) / rect.width * WIDTH, EDGE, WIDTH - EDGE);
      state.input.pointerY = clamp((event.clientY - rect.top) / rect.height * HEIGHT, EDGE, HEIGHT - EDGE);
    }
    function begin() { if (start(state)) { syncOverlay(); syncHud(); if (canvas.focus) canvas.focus(); } }
    startButton.addEventListener('click', begin);
    replayButton.addEventListener('click', begin);
    canvas.addEventListener('pointerdown', function (event) {
      pointerPosition(event); state.input.pointerActive = true; canvas.setPointerCapture(event.pointerId); if (state.status === 'ready') begin();
    });
    canvas.addEventListener('pointermove', function (event) { if (state.input.pointerActive) pointerPosition(event); });
    canvas.addEventListener('pointerup', function () { state.input.pointerActive = false; });
    canvas.addEventListener('pointercancel', function () { state.input.pointerActive = false; });
    root.document.addEventListener('keydown', function (event) {
      var key = event.key.toLowerCase();
      var map = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
      if (map[key]) { state.input[map[key]] = true; event.preventDefault(); }
      if ((key === ' ' || key === 'enter') && state.status !== 'playing') { begin(); event.preventDefault(); }
    });
    root.document.addEventListener('keyup', function (event) {
      var key = event.key.toLowerCase();
      var map = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
      if (map[key]) state.input[map[key]] = false;
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var nameNode = root.document.getElementById('playerName');
      submitScore(state.score, nameNode && nameNode.value, resultNode);
    });
    function frame(now) {
      if (!last) last = now;
      var elapsed = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (state.status === 'playing') step(state, state.input, elapsed);
      draw(ctx, state);
      syncOverlay(); syncHud();
      animation = root.requestAnimationFrame(frame);
    }
    syncOverlay(); syncHud();
    animation = root.requestAnimationFrame(frame);
    OO.runtime = { state: state, canvas: canvas, stop: function () { if (animation) root.cancelAnimationFrame(animation); } };
  }

  OO.init = init;
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init);
    else init();
  }
}(typeof window !== 'undefined' ? window : globalThis));
