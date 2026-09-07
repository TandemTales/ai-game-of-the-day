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
  var NURSERY = { x: 480, y: 300, radius: 54 };
  var CONTRACTS = {
    safe: { kind: 0, color: 0, symbol: '●', name: 'Mint pods', bonus: 600, cluster: { x: 278, y: 300 } },
    risky: { kind: 1, color: 1, symbol: '◆', name: 'Gold diamonds', bonus: 1400, cluster: { x: 859, y: 150 } }
  };
  OO.NURSERY = NURSERY;
  OO.CONTRACTS = CONTRACTS;
  function atNursery(state) { return distance(state.player.x, state.player.y, NURSERY.x, NURSERY.y) <= NURSERY.radius; }
  function matchesContract(state, relic) {
    var choice = CONTRACTS[state.contract.choice];
    return relic.kind === choice.kind && relic.color === choice.color;
  }
  function chooseContract(state, id) {
    if (!CONTRACTS[id] || state.status !== 'playing' || state.contract.committed || !atNursery(state)) return false;
    state.contract.choice = id;
    return true;
  }
  function deposit(state) {
    var contract = state.contract;
    if (state.status !== 'playing' || state.timeLeft <= 0 || !atNursery(state) || !contract.committed || contract.delivered || contract.cargo < contract.capacity) return false;
    contract.delivered = true;
    contract.cargo = 0;
    state.contractsCompleted += 1;
    state.score += CONTRACTS[contract.choice].bonus;
    state.timeLeft = Math.min(65, state.timeLeft + 8);
    state.outcome = 'delivered';
    finish(state, 'FIRST CONTRACT DELIVERED');
    return true;
  }
  OO.atNursery = atNursery;
  OO.matchesContract = matchesContract;
  OO.chooseContract = chooseContract;
  OO.deposit = deposit;

  OO.WIDTH = WIDTH;
  OO.HEIGHT = HEIGHT;
  OO.GAME_ID = 'orbit-orchard';
  OO.PALETTE = PALETTE.slice();

  // The simulation always stays 960x600. Portrait turns the complete deck a
  // quarter-turn so small screens can show larger specimens without cropping.
  function createView(width, height) {
    var rotated = height > width;
    var viewWidth = rotated ? HEIGHT : WIDTH;
    var viewHeight = rotated ? WIDTH : HEIGHT;
    return {
      rotated: rotated, width: viewWidth, height: viewHeight,
      scale: Math.max(.01, Math.min(width / viewWidth, height / viewHeight))
    };
  }
  function worldToView(point, view) {
    return view.rotated ? { x: HEIGHT - point.y, y: point.x } : { x: point.x, y: point.y };
  }
  function viewToWorld(point, view) {
    return view.rotated ? { x: point.y, y: HEIGHT - point.x } : { x: point.x, y: point.y };
  }
  function screenInput(input, view) {
    if (!view.rotated) return input;
    return {
      up: input.right, down: input.left, left: input.up, right: input.down,
      pointerActive: input.pointerActive, pointerX: input.pointerX, pointerY: input.pointerY
    };
  }
  OO.createView = createView;
  OO.worldToView = worldToView;
  OO.viewToWorld = viewToWorld;
  OO.screenInput = screenInput;

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
    // Shape AND color identify a contract; reserve both target families for
    // authored clusters beyond the nursery's harvest reach.
    relics.forEach(function (relic) {
      if ((relic.kind === 0 && relic.color === 0) || (relic.kind === 1 && relic.color === 1)) relic.color = 2;
    });
    Object.keys(CONTRACTS).forEach(function (id) {
      var choice = CONTRACTS[id];
      [[-18,-26],[17,-24],[0,5],[-20,31],[18,32]].forEach(function (offset) {
        var relic = makeRelic(choice.cluster.x + offset[0] + randomBetween(source, -4, 4), choice.cluster.y + offset[1] + randomBetween(source, -4, 4), 11, choice.color, choice.kind, nextRandom(source) * TAU);
        relic.target = id;
        relics.push(relic);
      });
    });
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

  OO.buildField = buildField;

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
      contract: { choice: 'safe', committed: false, capacity: 3, cargo: 0, delivered: false },
      contractsCompleted: 0,
      bestChain: 0,
      hits: 0,
      damageGrace: 0,
      outcome: null,
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
    // Dropped cargo already awarded growth and score on its original pickup.
    if (relic.recovered) {
      if (!matchesContract(state, relic) || state.contract.cargo >= state.contract.capacity || relic.cooldown > 0) return false;
      relic.active = false;
      state.contract.cargo += 1;
      emit(state, 'CARGO RECOVERED  ' + state.contract.cargo + '/3', PALETTE[relic.color]);
      return true;
    }
    relic.active = false;
    if (state.contract.committed && matchesContract(state, relic) && state.contract.cargo < state.contract.capacity) state.contract.cargo += 1;
    state.absorbed += 1;
    var sameColor = state.lastColor === relic.color;
    state.combo = sameColor ? state.combo + 1 : 1;
    state.bestChain = Math.max(state.bestChain, state.combo);
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
    emit(state, state.contract.cargo === state.contract.capacity ? 'CARGO FULL · RETURN TO NURSERY' : label + '  +' + total, PALETTE[relic.color]);
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
    state.event = { text: 'PICK 3 · RETURN TO NURSERY', ttl: 1.5, color: '#78f5d1' };
    cue(state, 'start');
    return true;
  }
  OO.start = start;

  function finish(state, message) {
    if (state.status !== 'playing') return;
    state.status = 'over';
    if (!state.outcome) state.outcome = 'expired';
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
    state.relics.forEach(function (relic) {
      if (!relic.active) return;
      relic.cooldown = Math.max(0, relic.cooldown - dt);
      var dx = player.x - relic.x;
      var dy = player.y - relic.y;
      var contactDistance = Math.hypot(dx, dy);
      var d = Math.max(28, contactDistance);
      var influence = relic.target || relic.recovered ? (atNursery(state) ? 0 : clamp(1 - d / 90, 0, 1)) : clamp(1 - d / 340, 0, 1);
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
      if (relic.cooldown <= 0 && contactDistance < player.radius + relic.radius && OO.canAbsorb(player.radius, relic.radius)) absorb(state, relic);
    });
    // A cleared field is never a delivery.
  }

  function updateHazards(state, dt) {
    var player = state.player;
    state.hazards.forEach(function (hazard) {
      hazard.phase += hazard.speed * dt;
      hazard.cooldown = Math.max(0, hazard.cooldown - dt);
      var hx = hazard.x + Math.cos(hazard.phase) * 5;
      var hy = hazard.y + Math.sin(hazard.phase * 1.4) * 5;
      if (distance(player.x, player.y, hx, hy) < player.radius + hazard.radius && hazard.cooldown <= 0 && state.damageGrace <= 0 && !atNursery(state)) {
        hazard.cooldown = 1.0;
        state.timeLeft = Math.max(0, state.timeLeft - 4);
        state.damageGrace = 0.9;
        state.hits += 1;
        state.combo = 0; state.multiplier = 1; state.comboTimer = 0; state.lastColor = -1;
        if (state.contract.cargo > 0) {
          state.contract.cargo -= 1;
          var choice = CONTRACTS[state.contract.choice];
          var lostX = player.x, lostY = player.y;
          // Nudge toward the protected center until safely clear of all wells.
          for (var attempt = 0; attempt < 20; attempt += 1) {
            if (state.hazards.every(function (well) { return distance(lostX, lostY, well.x, well.y) > well.radius + 90; })) break;
            lostX = lerp(lostX, NURSERY.x, .2); lostY = lerp(lostY, NURSERY.y, .2);
          }
          var lost = makeRelic(lostX, lostY, 11, choice.color, choice.kind, 0);
          lost.recovered = true; lost.target = state.contract.choice; lost.cooldown = .9;
          state.relics.push(lost);
        }
        state.flash = Math.min(1, state.flash + 0.5);
        state.shake = Math.min(1, state.shake + 0.35);
        var nx = player.x - hx;
        var ny = player.y - hy;
        if (nx === 0 && ny === 0) { nx = NURSERY.x - hx; ny = NURSERY.y - hy; }
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
    state.damageGrace = Math.max(0, state.damageGrace - safeDt);
    if (state.timeLeft <= 0) { finish(state, 'CONTRACT EXPIRED'); return state; }
    state.input = input || state.input;
    updatePlayer(state, state.input, safeDt);
    if (!state.contract.committed && !atNursery(state)) state.contract.committed = true;
    updateRelics(state, safeDt);
    updateHazards(state, safeDt);
    updateParticles(state, safeDt);
    if (state.timeLeft <= 0) finish(state, 'CONTRACT EXPIRED');
    else deposit(state);
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

  function disc(ctx, x, y, radius, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
  }

  function polygon(ctx, radius, sides, rotation) {
    ctx.beginPath();
    for (var i = 0; i < sides; i += 1) {
      var angle = i * TAU / sides + (rotation || 0);
      if (i === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.closePath();
  }

  function drawPlanter(ctx, x, y, flip, variety) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, flip);
    var width = variety === 1 ? 152 : 104;
    ctx.fillStyle = '#152e31'; roundRect(ctx, -width / 2, -9, width, 22, 5); ctx.fill();
    ctx.strokeStyle = '#53645a'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#091918'; roundRect(ctx, -width / 2 + 5, -5, width - 10, 13, 3); ctx.fill();
    ctx.save(); ctx.shadowColor = 'rgba(0,8,10,.75)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = -3;
    var source = { seed: 4561 + Math.floor(x) * 31 + variety * 257 };
    for (var i = 0; i < 9; i += 1) {
      var stem = randomBetween(source, -width / 2 + 9, width / 2 - 9);
      var height = randomBetween(source, 17, variety === 1 ? 46 : 36);
      var lean = randomBetween(source, -20, 20);
      ctx.strokeStyle = '#6a8660'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(stem, 6); ctx.quadraticCurveTo(stem + lean, -height * .4, stem + lean, -height); ctx.stroke();
      for (var j = 0; j < 5; j += 1) {
        var fraction = (j + 1) / 6;
        var lx = stem + lean * fraction;
        var ly = -height * fraction;
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(j % 2 ? -.9 : .9);
        var length = (1 - fraction * .4) * (variety === 1 ? 16 : 12);
        var leaf = ctx.createLinearGradient(0, 0, 0, -length);
        leaf.addColorStop(0, '#214a40'); leaf.addColorStop(1, i % 3 ? '#578563' : '#7f9870'); ctx.fillStyle = leaf;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-6, -length * .4, -3, -length, 0, -length);
        ctx.bezierCurveTo(7, -length * .8, 6, -length * .2, 0, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(169,188,125,.25)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -length * .8); ctx.stroke(); ctx.restore();
      }
      if (i % 4 === 0) {
        disc(ctx, stem + lean, -height, 3.6, '#bd9264');
        disc(ctx, stem + lean - 1, -height - 1, 1.6, '#e2d296');
      }
    }
    ctx.restore();
    ctx.fillStyle = '#9b9a75'; ctx.fillRect(-width / 2 + 11, 9, 15, 2);
    ctx.restore();
  }

  function drawBackground(ctx, state) {
    var bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bg.addColorStop(0, '#102e38'); bg.addColorStop(.48, '#091b27'); bg.addColorStop(1, '#172833');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    // Beyond the greenhouse glass: a quiet planetary limb and distant stars.
    var planet = ctx.createRadialGradient(826, -145, 100, 826, -145, 435);
    planet.addColorStop(0, '#497e7c'); planet.addColorStop(.8, '#294c59'); planet.addColorStop(.98, '#4c8990'); planet.addColorStop(1, 'rgba(91,163,169,0)');
    disc(ctx, 826, -145, 435, planet);
    state.stars.forEach(function (star) {
      disc(ctx, star.x, star.y, star.r * .6, 'rgba(187,229,224,' + (star.a * .5).toFixed(3) + ')');
    });
    // Recessed glass deck: large panes leave an uncluttered harvesting surface.
    var deck = ctx.createLinearGradient(0, EDGE, 0, HEIGHT - EDGE);
    deck.addColorStop(0, 'rgba(14,36,39,.72)'); deck.addColorStop(.55, 'rgba(9,26,33,.92)'); deck.addColorStop(1, 'rgba(19,40,41,.96)');
    ctx.shadowColor = '#010c15'; ctx.shadowBlur = 24;
    ctx.fillStyle = deck; roundRect(ctx, EDGE, EDGE, WIDTH - EDGE * 2, HEIGHT - EDGE * 2, 26); ctx.fill();
    ctx.shadowBlur = 0; ctx.save(); ctx.clip();
    for (var x = 48; x < WIDTH; x += 144) {
      ctx.strokeStyle = 'rgba(135,175,158,.085)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, EDGE); ctx.lineTo(x, HEIGHT - EDGE); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,4,12,.35)'; ctx.beginPath(); ctx.moveTo(x + 2, EDGE); ctx.lineTo(x + 2, HEIGHT - EDGE); ctx.stroke();
    }
    for (var y = 90; y < HEIGHT; y += 140) {
      ctx.strokeStyle = 'rgba(135,175,158,.08)'; ctx.beginPath(); ctx.moveTo(EDGE, y); ctx.lineTo(WIDTH - EDGE, y); ctx.stroke();
    }
    // A restrained shaft of sunlight suggests overhead greenhouse ribs.
    ctx.fillStyle = 'rgba(211,234,188,.024)';
    for (var light = 0; light < 4; light += 1) {
      ctx.beginPath(); ctx.moveTo(400 + light * 148, 34); ctx.lineTo(450 + light * 148, 34);
      ctx.lineTo(110 + light * 148, 566); ctx.lineTo(65 + light * 148, 566); ctx.fill();
    }
    var pool = ctx.createRadialGradient(480, 275, 30, 480, 300, 420);
    pool.addColorStop(0, 'rgba(91,149,111,.095)'); pool.addColorStop(1, 'rgba(8,17,29,0)');
    ctx.fillStyle = pool; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = 'rgba(183,199,154,.075)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(480, 300, 340, 214, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(480, 300, 347, 221, 0, 0, TAU); ctx.stroke();
    // Weathering is concentrated at panel edges, leaving the harvest path quiet.
    var patina = { seed: 93557 };
    for (var wear = 0; wear < 110; wear += 1) {
      var wx = randomBetween(patina, 44, WIDTH - 44);
      var wy = randomBetween(patina, 42, HEIGHT - 42);
      var edgeFade = Math.max(Math.abs(wx - 480) / 480, Math.abs(wy - 300) / 300);
      ctx.strokeStyle = 'rgba(165,194,173,' + (.012 + edgeFade * .027).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + randomBetween(patina, 2, 16), wy - 2); ctx.stroke();
    }
    var frost = ctx.createLinearGradient(0, 34, 0, 115);
    frost.addColorStop(0, 'rgba(150,182,134,.12)'); frost.addColorStop(1, 'rgba(150,182,134,0)');
    ctx.fillStyle = frost; ctx.fillRect(34, 34, WIDTH - 68, 81);
    ctx.restore();
    // Structural rim, glass seal, brass fasteners and recessed grow lights.
    ctx.strokeStyle = '#314c4e'; ctx.lineWidth = 7;
    roundRect(ctx, 29, 29, WIDTH - 58, HEIGHT - 58, 29); ctx.stroke();
    ctx.strokeStyle = '#758a77'; ctx.lineWidth = 1;
    roundRect(ctx, 27, 27, WIDTH - 54, HEIGHT - 54, 29); ctx.stroke();
    ctx.strokeStyle = 'rgba(161,211,170,.35)';
    roundRect(ctx, EDGE, EDGE, WIDTH - EDGE * 2, HEIGHT - EDGE * 2, 26); ctx.stroke();
    for (var k = 0; k < 7; k += 1) {
      var bx = 82 + k * 133;
      disc(ctx, bx, 29, 2.6, '#b8ad80'); disc(ctx, bx, HEIGHT - 29, 2.6, '#b8ad80');
      ctx.fillStyle = '#071a20'; ctx.fillRect(bx - 1, 28, 2, 1); ctx.fillRect(bx - 1, HEIGHT - 30, 2, 1);
    }
    for (var side = 0; side < 2; side += 1) {
      var sx = side ? WIDTH - 22 : 17;
      for (var v = 0; v < 6; v += 1) {
        ctx.fillStyle = '#526f67'; ctx.fillRect(sx, 106 + v * 66, 5, 34);
        ctx.fillStyle = '#b8d9ac'; ctx.fillRect(sx + 1, 108 + v * 66, 2, 28);
      }
    }
    drawPlanter(ctx, 141, 11, -1, 1); drawPlanter(ctx, 837, 12, -1, 0);
    drawPlanter(ctx, 104, 590, 1, 0); drawPlanter(ctx, 763, 591, 1, 1);
    ctx.restore();
  }

  function drawHazard(ctx, hazard, time) {
    var x = hazard.x + Math.cos(hazard.phase) * 5;
    var y = hazard.y + Math.sin(hazard.phase * 1.4) * 5;
    var r = hazard.radius;
    ctx.save(); ctx.translate(x, y);
    var glow = ctx.createRadialGradient(0, 0, r * .75, 0, 0, r + 23);
    glow.addColorStop(0, 'rgba(245,74,92,.24)'); glow.addColorStop(1, 'rgba(245,74,92,0)');
    disc(ctx, 0, 0, r + 23, glow);
    ctx.rotate(time * hazard.speed * .6);
    ctx.strokeStyle = '#c56572'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r + 7, .15, Math.PI - .15); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r + 7, Math.PI + .15, TAU - .15); ctx.stroke();
    for (var i = 0; i < 8; i += 1) {
      ctx.save(); ctx.rotate(i * TAU / 8);
      ctx.fillStyle = i % 2 ? '#bb5267' : '#f3b5af'; ctx.fillRect(r + 5, -2, 6, 4); ctx.restore();
    }
    disc(ctx, 0, 0, r, '#040b13');
    ctx.strokeStyle = '#fa97a5'; ctx.lineWidth = 1; ctx.stroke();
    for (var ring = 0; ring < 3; ring += 1) {
      ctx.strokeStyle = 'rgba(206,71,102,' + (.4 - ring * .09) + ')';
      ctx.beginPath(); ctx.ellipse(0, 0, r * (.8 - ring * .17), r * (.4 - ring * .06), time * .4 + ring, .5, 5.2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawRelic(ctx, relic, time, playerRadius) {
    var color = PALETTE[relic.color];
    var r = relic.radius;
    var bob = Math.sin(time * 2.2 + relic.phase) * 1.5;
    var eligible = OO.canAbsorb(playerRadius, r);
    ctx.save(); ctx.translate(relic.x, relic.y + bob);
    ctx.fillStyle = 'rgba(1,8,14,.4)'; ctx.beginPath(); ctx.ellipse(2, r * .55 + 3, r * .95, r * .42, 0, 0, TAU); ctx.fill();
    ctx.rotate(relic.phase + time * .16);
    if (relic.kind === 0) {
      // Glazed pollen pod: rounded ceramic shell and a luminous seed seam.
      var glaze = ctx.createRadialGradient(-r * .4, -r * .4, .1, r * .12, r * .15, r * 1.2);
      glaze.addColorStop(0, '#fff1ce'); glaze.addColorStop(.35, color); glaze.addColorStop(1, '#244653');
      disc(ctx, 0, 0, r, glaze);
      ctx.strokeStyle = 'rgba(9,37,45,.65)'; ctx.lineWidth = Math.max(1, r * .13);
      ctx.beginPath(); ctx.ellipse(0, 0, r * .37, r * .9, -.5, 0, TAU); ctx.stroke();
      disc(ctx, -r * .33, -r * .4, r * .16, '#fff9db');
    } else if (relic.kind === 1) {
      // Cut mineral: three separate illuminated facets, no shared blob silhouette.
      ctx.beginPath(); ctx.moveTo(0, -r * 1.14); ctx.lineTo(r * .82, 0); ctx.lineTo(0, r * 1.14); ctx.lineTo(-r * .82, 0); ctx.closePath();
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#dbf7ed'; ctx.lineWidth = .8; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,228,.6)'; ctx.beginPath(); ctx.moveTo(0, -r * 1.14); ctx.lineTo(0, r * .25); ctx.lineTo(-r * .82, 0); ctx.fill();
      ctx.fillStyle = 'rgba(8,37,61,.55)'; ctx.beginPath(); ctx.moveTo(0, r * 1.14); ctx.lineTo(0, -r * .25); ctx.lineTo(r * .82, 0); ctx.fill();
    } else if (relic.kind === 2) {
      // Preserved bloom: overlapping fleshy petals around a golden pollen crown.
      for (var petal = 0; petal < 5; petal += 1) {
        ctx.save(); ctx.rotate(petal * TAU / 5);
        var leaf = ctx.createLinearGradient(0, -r, 0, 1);
        leaf.addColorStop(0, color); leaf.addColorStop(1, '#23464c'); ctx.fillStyle = leaf;
        ctx.beginPath(); ctx.ellipse(0, -r * .42, r * .4, r * .65, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(233,247,211,.35)'; ctx.lineWidth = .7; ctx.stroke(); ctx.restore();
      }
      disc(ctx, 0, 0, r * .3, '#e8d69b'); disc(ctx, -r * .06, -r * .07, r * .12, '#fff9d2');
    } else {
      // Brass-framed specimen capsule; large harvests look heavier and protected.
      ctx.shadowColor = '#000b11'; ctx.shadowBlur = 7;
      polygon(ctx, r, 6, Math.PI / 6); ctx.fillStyle = '#29464c'; ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = eligible ? '#c2c59c' : '#758785'; ctx.lineWidth = 2; ctx.stroke();
      polygon(ctx, r * .81, 6, Math.PI / 6);
      var glass = ctx.createLinearGradient(-r, -r, r, r);
      glass.addColorStop(0, '#79948b'); glass.addColorStop(.38, '#1d3b45'); glass.addColorStop(1, '#102a35');
      ctx.fillStyle = glass; ctx.fill(); ctx.strokeStyle = '#172c33'; ctx.lineWidth = 1; ctx.stroke();
      for (var leafIndex = 0; leafIndex < 3; leafIndex += 1) {
        ctx.save(); ctx.rotate(leafIndex * TAU / 3);
        ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, -r * .22, r * .17, r * .36, .5, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(245,255,229,.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * .1, -r * .4); ctx.stroke(); ctx.restore();
      }
      disc(ctx, 0, 0, r * .15, '#ead59c');
      ctx.strokeStyle = 'rgba(226,253,226,.5)'; ctx.beginPath(); ctx.moveTo(-r * .56, -r * .38); ctx.lineTo(-r * .15, -r * .62); ctx.stroke();
      for (var bolt = 0; bolt < 6; bolt += 1) disc(ctx, Math.cos(bolt * TAU / 6 + Math.PI / 6) * r * .94, Math.sin(bolt * TAU / 6 + Math.PI / 6) * r * .94, 1.5, '#d3be86');
    }
    ctx.restore();
    // A small external harvest marker is shared by every collectable material.
    if (eligible) {
      ctx.save(); ctx.strokeStyle = '#d9edbd'; ctx.globalAlpha = .75; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(relic.x, relic.y + bob, r + 4, -1.85, -1.3); ctx.stroke(); ctx.restore();
    }
  }

  function drawPlayer(ctx, state) {
    var p = state.player;
    var r = p.radius;
    ctx.save();
    state.trail.forEach(function (dot, index) {
      ctx.globalAlpha = dot.life * .085;
      disc(ctx, dot.x, dot.y, dot.r * (.55 + index / 60), '#a6e7c1');
    });
    ctx.globalAlpha = 1;
    ctx.translate(p.x, p.y);
    var glow = ctx.createRadialGradient(0, 0, r * .6, 0, 0, r * 2.8);
    glow.addColorStop(0, 'rgba(230,199,111,.22)'); glow.addColorStop(.48, 'rgba(135,217,163,.09)'); glow.addColorStop(1, 'rgba(135,217,163,0)');
    disc(ctx, 0, 0, r * 2.8, glow);
    // Broken orbital arcs keep the controllable seed recognizable at every size.
    ctx.save(); ctx.rotate(state.time * .4);
    ctx.strokeStyle = 'rgba(185,245,207,.6)'; ctx.lineWidth = 1.2;
    for (var arc = 0; arc < 3; arc += 1) {
      ctx.beginPath(); ctx.arc(0, 0, r + 7 + state.gravityBloom * 7, arc * TAU / 3, arc * TAU / 3 + 1.25); ctx.stroke();
    }
    ctx.restore();
    // Two orbiting cotyledons give the solar seed a botanical silhouette.
    ctx.save(); ctx.rotate(-.65 + Math.sin(state.time * .8) * .12);
    for (var cotyledon = 0; cotyledon < 2; cotyledon += 1) {
      ctx.save(); ctx.rotate(cotyledon * Math.PI);
      var shoot = ctx.createLinearGradient(r * .7, 0, r * 1.5, 0);
      shoot.addColorStop(0, '#67b395'); shoot.addColorStop(1, '#ecf7bf'); ctx.fillStyle = shoot;
      ctx.beginPath(); ctx.moveTo(r * .72, 0); ctx.bezierCurveTo(r, -r * .56, r * 1.47, -r * .35, r * 1.45, -r * .2);
      ctx.bezierCurveTo(r * 1.36, r * .07, r, r * .18, r * .72, 0); ctx.fill();
      ctx.strokeStyle = '#cceabe'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r * .8, 0); ctx.lineTo(r * 1.33, -r * .2); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(0,7,10,.55)'; ctx.beginPath(); ctx.ellipse(3, r * .65, r, r * .55, 0, 0, TAU); ctx.fill();
    var body = ctx.createRadialGradient(-r * .33, -r * .4, 1, r * .15, r * .2, r * 1.3);
    body.addColorStop(0, '#ffffe5'); body.addColorStop(.33, '#d0f1c3'); body.addColorStop(.65, '#6ab79a'); body.addColorStop(1, '#234c50');
    disc(ctx, 0, 0, r, body); ctx.strokeStyle = '#effcce'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); ctx.rotate(p.spin * .28);
    for (var seam = 0; seam < 3; seam += 1) {
      ctx.save(); ctx.rotate(seam * TAU / 3);
      ctx.strokeStyle = 'rgba(22,87,72,.65)'; ctx.lineWidth = Math.max(1, r * .055);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-r * .6, -r * .1, -r * .52, -r * .62, 0, -r * .93); ctx.stroke(); ctx.restore();
    }
    var core = ctx.createRadialGradient(-r * .1, -r * .1, 0, 0, 0, r * .43);
    core.addColorStop(0, '#fffde5'); core.addColorStop(.43, '#ffe5a0'); core.addColorStop(1, '#bf843f');
    disc(ctx, 0, 0, r * .43, core); ctx.strokeStyle = '#fff1ba'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,226,.85)'; ctx.lineWidth = Math.max(1.5, r * .07);
    ctx.beginPath(); ctx.arc(-r * .06, -r * .07, r * .75, 3.55, 4.5); ctx.stroke();
    // Heading notch differentiates the player from round pollen pods.
    var heading = Math.hypot(p.vx, p.vy) > 6 ? Math.atan2(p.vy, p.vx) : -Math.PI / 2;
    ctx.rotate(heading); ctx.fillStyle = '#fff4bb';
    ctx.beginPath(); ctx.moveTo(r + 12, 0); ctx.lineTo(r + 7, -3); ctx.lineTo(r + 7, 3); ctx.fill();
    ctx.restore();
  }

  function draw(ctx, state, view) {
    if (!ctx || !state) return;
    view = view || createView(WIDTH, HEIGHT);
    ctx.save();
    ctx.setTransform(ctx.canvas.width / view.width, 0, 0, ctx.canvas.height / view.height, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.save();
    if (state.shake > 0) ctx.translate(Math.sin(state.time * 70) * state.shake * 3, Math.cos(state.time * 61) * state.shake * 2);
    if (view.rotated) { ctx.translate(HEIGHT, 0); ctx.rotate(Math.PI / 2); }
    drawBackground(ctx, state);
    // A quiet landing ring remains visible while the player is away harvesting.
    var fullCargo = state.contract.cargo === state.contract.capacity;
    disc(ctx, NURSERY.x, NURSERY.y, NURSERY.radius, 'rgba(120,245,209,.08)');
    ctx.strokeStyle = fullCargo ? '#eaffbf' : '#79b8a1'; ctx.lineWidth = fullCargo ? 4 : 2;
    ctx.beginPath(); ctx.arc(NURSERY.x, NURSERY.y, NURSERY.radius, 0, TAU); ctx.stroke();
    state.relics.forEach(function (relic) {
      if (!relic.active || !matchesContract(state, relic)) return;
      ctx.strokeStyle = PALETTE[relic.color]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(relic.x, relic.y, relic.radius + 8, 0, TAU); ctx.stroke();
    });
    state.hazards.forEach(function (hazard) { drawHazard(ctx, hazard, state.time); });
    state.relics.forEach(function (relic) { if (relic.active) drawRelic(ctx, relic, state.time, state.player.radius); });
    drawPlayer(ctx, state);
    state.particles.forEach(function (particle) {
      ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1);
      ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, TAU); ctx.fill();
    });
    ctx.restore();
    ctx.globalAlpha = 1;
    // Labels live in screen space so the rotated deck never turns reading or
    // danger cues sideways. Their sizes still match the world drawing scale.
    ctx.fillStyle = '#81978b'; ctx.font = '600 8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('ORBITAL CONSERVATORY  /  SECTOR 07', view.width / 2, 16);
    ctx.fillStyle = '#648079';
    ctx.fillText('GLASS DECK  ·  ZERO-G CULTIVATION', view.width / 2, view.height - 11);
    var displayScale = view.scale || 1;
    var nurseryPoint = worldToView(NURSERY, view);
    ctx.fillStyle = fullCargo ? '#edffd6' : '#b4d5c2';
    ctx.font = '800 ' + Math.max(12, 10 / displayScale) + 'px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(fullCargo ? 'DELIVER HERE' : 'NURSERY', nurseryPoint.x, nurseryPoint.y + NURSERY.radius + 13 / displayScale);
    if (state.status === 'playing' && state.contract.cargo < state.contract.capacity) {
      var choice = CONTRACTS[state.contract.choice];
      var clusterPoint = worldToView(choice.cluster, view);
      var tag = choice.symbol + ' ' + (state.contract.choice === 'safe' ? 'MINT' : 'GOLD');
      ctx.fillStyle = PALETTE[choice.color];
      ctx.font = '800 ' + Math.max(12, 10 / displayScale) + 'px system-ui, sans-serif';
      ctx.fillText(tag, clamp(clusterPoint.x, 35 / displayScale, view.width - 35 / displayScale), Math.max(54 / displayScale, clusterPoint.y - 58));
    }
    state.hazards.forEach(function (hazard) {
      var point = worldToView({ x: hazard.x + Math.cos(hazard.phase) * 5, y: hazard.y + Math.sin(hazard.phase * 1.4) * 5 }, view);
      ctx.fillStyle = '#f1b8bc'; ctx.font = '700 ' + Math.max(8, 9 / displayScale) + 'px monospace';
      ctx.fillText('−4s', point.x, point.y + hazard.radius + 23);
    });
    if (state.status === 'playing' && state.player.radius < 32) {
      var seedPoint = worldToView(state.player, view);
      var labelY = Math.min(view.height - 17 / displayScale, seedPoint.y + state.player.radius + 13 / displayScale);
      ctx.globalAlpha = clamp((32 - state.player.radius) / 8, 0, 1);
      ctx.fillStyle = 'rgba(3,19,22,.9)';
      roundRect(ctx, seedPoint.x - 17 / displayScale, labelY - 7 / displayScale, 34 / displayScale, 14 / displayScale, 5 / displayScale); ctx.fill();
      ctx.fillStyle = '#e6ffcc'; ctx.font = '800 ' + 9 / displayScale + 'px system-ui, sans-serif';
      ctx.textBaseline = 'middle'; ctx.fillText('YOU', seedPoint.x, labelY);
      ctx.globalAlpha = 1;
    }
    if (state.status === 'playing' && view.showSteeringHint) {
      var hintY = view.height - 20 / displayScale;
      ctx.fillStyle = 'rgba(3,19,22,.93)';
      roundRect(ctx, view.width / 2 - 65 / displayScale, hintY - 11 / displayScale, 130 / displayScale, 22 / displayScale, 7 / displayScale); ctx.fill();
      ctx.fillStyle = '#e0f6d9'; ctx.font = '700 ' + 10 / displayScale + 'px system-ui, sans-serif';
      ctx.textBaseline = 'middle'; ctx.fillText('DRAG TO STEER', view.width / 2, hintY);
    }
    if (state.event.ttl > 0) {
      var alpha = clamp(state.event.ttl * 1.5, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = '700 ' + Math.max(11, 11 / displayScale) + 'px system-ui, sans-serif';
      var eventWidth = Math.min(view.width - 24, Math.max(284, ctx.measureText(state.event.text).width + 28 / displayScale));
      var eventHeight = Math.max(32, 26 / displayScale);
      ctx.fillStyle = 'rgba(4,11,20,.92)'; roundRect(ctx, view.width / 2 - eventWidth / 2, 18, eventWidth, eventHeight, eventHeight / 2); ctx.fill();
      ctx.strokeStyle = state.event.color; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = state.event.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(state.event.text, view.width / 2, 18 + eventHeight / 2, eventWidth - 20 / displayScale);
    }
    if (state.flash > 0) {
      ctx.globalAlpha = state.flash * .09; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, view.width, view.height);
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
    var contractBar = root.document.getElementById('contractBar');
    var contractObjective = root.document.getElementById('contractObjective');
    var safeContractButton = root.document.getElementById('safeContractButton');
    var riskyContractButton = root.document.getElementById('riskyContractButton');
    var resultEyebrow = root.document.getElementById('resultEyebrow');
    var resultTitle = root.document.getElementById('resultTitle');
    var resultStats = root.document.getElementById('resultStats');
    var last = 0;
    var animation = null;
    var view = createView(WIDTH, HEIGHT);
    var hasSteered = false;

    function syncView() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var nextView = createView(rect.width, rect.height);
      if (nextView.rotated !== view.rotated) clearControls();
      view = nextView;
      view.showSteeringHint = !hasSteered;
      // Bound GPU memory on oversized displays, while preserving Retina detail.
      var resolution = Math.min(root.devicePixelRatio || 1, 2, 4096 / Math.max(rect.width, rect.height));
      var pixelWidth = Math.max(1, Math.round(rect.width * resolution));
      var pixelHeight = Math.max(1, Math.round(rect.height * resolution));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth; canvas.height = pixelHeight;
      }
      if (OO.runtime) OO.runtime.view = view;
    }
    function render() { syncView(); draw(ctx, state, view); }

    function setStatus(text) { if (statusNode) statusNode.textContent = text; }
    function syncOverlay() {
      var playing = state.status === 'playing';
      overlay.hidden = playing;
      startCard.hidden = playing || state.status === 'over';
      gameOverCard.hidden = playing || state.status !== 'over';
      if (state.status === 'over' && finalScoreNode) finalScoreNode.textContent = formatScore(state.score);
      if (hintNode) hintNode.hidden = playing;
      if (contractBar) contractBar.hidden = !playing;
      if (state.status === 'over') {
        if (resultEyebrow) resultEyebrow.textContent = state.outcome === 'delivered' ? 'FIRST DELIVERY' : 'CONTRACT EXPIRED';
        if (resultTitle) resultTitle.textContent = state.outcome === 'delivered' ? 'Delivery complete' : 'Cargo left adrift';
        if (resultStats) resultStats.textContent = state.contractsCompleted + '/1 delivered · Best chain ' + state.bestChain + ' · Hits ' + state.hits + ' · ' + formatTime(state.timeLeft) + ' left';
      }
    }
    function syncHud() {
      if (scoreNode) scoreNode.textContent = formatScore(state.score);
      if (massNode) massNode.textContent = Math.round(state.player.radius * state.player.radius);
      if (comboNode) comboNode.textContent = '×' + state.multiplier + (state.combo > 1 ? ' / ' + state.combo : '');
      if (timeNode) timeNode.textContent = formatTime(state.timeLeft);
      var choice = CONTRACTS[state.contract.choice];
      if (contractObjective) contractObjective.textContent = choice.symbol + ' ' + choice.name + ' · ' + state.contract.cargo + '/3 · ' + (state.contract.cargo === 3 ? 'Return to nursery' : 'Collect 3');
      [[safeContractButton, 'safe'], [riskyContractButton, 'risky']].forEach(function (entry) {
        if (!entry[0]) return;
        entry[0].hidden = state.contract.committed;
        entry[0].setAttribute('aria-pressed', String(state.contract.choice === entry[1]));
      });
      setStatus(state.status === 'playing' ? (state.contract.cargo === 3 ? 'RETURN TO NURSERY' : 'FIRST CONTRACT') : state.status === 'over' ? (state.outcome === 'delivered' ? 'DELIVERY COMPLETE' : 'CONTRACT EXPIRED') : 'SEED DORMANT');
    }
    function pointerPosition(event) {
      syncView();
      var rect = canvas.getBoundingClientRect();
      var point = viewToWorld({ x: (event.clientX - rect.left) / rect.width * view.width, y: (event.clientY - rect.top) / rect.height * view.height }, view);
      state.input.pointerX = clamp(point.x, EDGE, WIDTH - EDGE);
      state.input.pointerY = clamp(point.y, EDGE, HEIGHT - EDGE);
    }
    function begin() { if (start(state)) { hasSteered = false; syncOverlay(); syncHud(); syncView(); if (canvas.focus) canvas.focus(); } }
    function selectContract(id) { if (chooseContract(state, id)) { syncHud(); render(); } }
    if (safeContractButton) safeContractButton.addEventListener('click', function () { selectContract('safe'); });
    if (riskyContractButton) riskyContractButton.addEventListener('click', function () { selectContract('risky'); });
    startButton.addEventListener('click', begin);
    replayButton.addEventListener('click', begin);
    canvas.addEventListener('pointerdown', function (event) {
      if (state.status === 'ready') begin();
      pointerPosition(event); state.input.pointerActive = true; hasSteered = true; canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', function (event) { if (state.input.pointerActive) pointerPosition(event); });
    canvas.addEventListener('pointerup', function () { state.input.pointerActive = false; });
    canvas.addEventListener('pointercancel', function () { state.input.pointerActive = false; });
    function editingText(target) {
      return !!(target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || '')));
    }
    function clearControls() {
      state.input.up = false; state.input.down = false;
      state.input.left = false; state.input.right = false;
      state.input.pointerActive = false;
    }
    root.addEventListener('blur', clearControls);
    root.document.addEventListener('focusin', function (event) { if (editingText(event.target)) clearControls(); });
    root.document.addEventListener('keydown', function (event) {
      if (editingText(event.target)) return;
      var key = event.key.toLowerCase();
      var map = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
      if (map[key]) { state.input[map[key]] = true; hasSteered = true; event.preventDefault(); }
      if ((key === '1' || key === '2') && state.status === 'playing') { selectContract(key === '1' ? 'safe' : 'risky'); event.preventDefault(); }
      if ((key === ' ' || key === 'enter') && state.status !== 'playing') { begin(); event.preventDefault(); }
    });
    root.document.addEventListener('keyup', function (event) {
      if (editingText(event.target)) return;
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
      syncView();
      if (state.status === 'playing') {
        // Keep held controls in screen coordinates; do not rotate the prior
        // frame's already transformed input again on portrait displays.
        var heldInput = state.input;
        step(state, screenInput(heldInput, view), elapsed);
        state.input = heldInput;
      }
      draw(ctx, state, view);
      syncOverlay(); syncHud();
      animation = root.requestAnimationFrame(frame);
    }
    syncOverlay(); syncHud();
    animation = root.requestAnimationFrame(frame);
    OO.runtime = { state: state, canvas: canvas, view: view, render: render, stop: function () { if (animation) root.cancelAnimationFrame(animation); } };
  }

  OO.init = init;
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init);
    else init();
  }
}(typeof window !== 'undefined' ? window : globalThis));
