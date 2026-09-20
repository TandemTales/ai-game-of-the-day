(function (root) {
  'use strict';
  const PW = root.PW = root.PW || {};
  const EPS = 0.000001;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const length = (x, y) => Math.hypot(x, y);

  // Slab intersection handles parallel rays, origins inside a wall, and corners.
  function raySegment(x, y, dx, dy, rects, max) {
    const magnitude = length(dx, dy);
    const limit = Number.isFinite(max) ? Math.max(0, max) : 1600;
    let distance = limit, hit = null;
    if (magnitude > EPS) {
      dx /= magnitude; dy /= magnitude;
      for (const rect of rects || []) {
        if (rect.open) continue;
        let near = -Infinity, far = Infinity, valid = true;
        for (const [origin, direction, low, high] of [
          [x, dx, rect.x, rect.x + rect.w], [y, dy, rect.y, rect.y + rect.h]
        ]) {
          if (Math.abs(direction) < EPS) {
            if (origin < low || origin > high) { valid = false; break; }
          } else {
            const a = (low - origin) / direction, b = (high - origin) / direction;
            near = Math.max(near, Math.min(a, b));
            far = Math.min(far, Math.max(a, b));
          }
        }
        if (valid && far >= Math.max(0, near) && Math.max(0, near) <= distance) {
          distance = Math.max(0, near); hit = rect;
        }
      }
    } else { dx = 0; dy = 0; distance = 0; }
    return { x: x + dx * distance, y: y + dy * distance, distance, rect: hit,
      x1: x, y1: y, x2: x + dx * distance, y2: y + dy * distance };
  }

  function create() {
    return {
      status: 'ready', time: 0, score: 0, hits: 0, returns: 0,
      player: { x: 190, y: 540, r: 14, hp: 6, maxHp: 6, aimX: 1, aimY: 0,
        reflecting: false, slashTime: 0, slashCooldown: 0, dashTime: 0,
        dashCooldown: 0, invulnerable: 0, dashX: 1, dashY: 0 },
      walls: [
        { x: 24, y: 48, w: 24, h: 672 }, { x: 976, y: 48, w: 24, h: 672 },
        { x: 48, y: 48, w: 928, h: 32 }, { x: 48, y: 696, w: 928, h: 24 },
        { x: 700, y: 340, w: 24, h: 356 },
        { x: 325, y: 450, w: 90, h: 28 }, { x: 478, y: 210, w: 28, h: 66 }
      ],
      gates: [{ x: 700, y: 80, w: 24, h: 260, open: false }],
      emitter: { x: 70, y: 340, dx: 1, dy: 0 },
      receivers: [
        { id: 'gate', x: 550, y: 115, r: 19, charge: 0, active: false },
        { id: 'sanctuary', x: 280, y: 620, r: 22, charge: 0, active: false }
      ],
      beams: [{ x1: 70, y1: 340, x2: 700, y2: 340, kind: 'sun' }],
      enemies: [{ id: 'abbey-sentinel', x: 845, y: 245, r: 27, hp: 6, maxHp: 6,
        phase: 'dormant', timer: 0, exposed: 0, aimX: -1, aimY: 0,
        volley: 0, shotsLeft: 0, shotTimer: 0, rewardedCracks: [] }],
      shots: [], particles: [], rescue: { x: 914, y: 150, freed: false },
      sanctuary: false, message: 'Raise your mirror in the sunlight. Aim at the north receiver.',
      _slashHeld: false, _dashHeld: false, _slashSerial: 0, _nextShotId: 1,
      _sanctuaryCooldown: 0, _messageTime: 8
    };
  }

  function announce(s, text, duration) { s.message = text; s._messageTime = duration || 4; }
  function spark(s, x, y, kind, count) {
    for (let i = 0; i < count; i++) {
      const angle = i * 2.3999632297 + s.time;
      s.particles.push({ x, y, vx: Math.cos(angle) * (30 + i * 6),
        vy: Math.sin(angle) * (30 + i * 6), life: .65, maxLife: .65, kind });
    }
  }
  function solids(s) { return s.walls.concat(s.gates.filter(g => !g.open)); }
  function overlapCircle(x, y, radius, wall) {
    return Math.hypot(x - clamp(x, wall.x, wall.x + wall.w),
      y - clamp(y, wall.y, wall.y + wall.h)) < radius - EPS;
  }
  function movePlayer(p, vx, vy, dt, walls) {
    // Small axis-separated steps prevent a dash tunnelling through narrow walls.
    const steps = Math.max(1, Math.ceil(length(vx, vy) * dt / 5));
    for (let i = 0; i < steps; i++) {
      const nx = p.x + vx * dt / steps;
      if (!walls.some(w => overlapCircle(nx, p.y, p.r, w))) p.x = nx;
      const ny = p.y + vy * dt / steps;
      if (!walls.some(w => overlapCircle(p.x, ny, p.r, w))) p.y = ny;
    }
  }
  function segmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, ll = dx * dx + dy * dy;
    const t = ll > EPS ? clamp(((px - x1) * dx + (py - y1) * dy) / ll, 0, 1) : 0;
    return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
  }

  function sunlight(s, dt, walls) {
    const p = s.player, emitter = s.emitter;
    const end = raySegment(emitter.x, emitter.y, emitter.dx, emitter.dy, walls, 1300);
    const t = (p.x - emitter.x) * emitter.dx + (p.y - emitter.y) * emitter.dy;
    const perpendicular = Math.abs((p.x - emitter.x) * emitter.dy - (p.y - emitter.y) * emitter.dx);
    s.beams = [];
    const caught = p.reflecting && t > 0 && t < end.distance && perpendicular <= 18;
    s.beams.push({ x1: emitter.x, y1: emitter.y,
      x2: caught ? p.x : end.x, y2: caught ? emitter.y : end.y, kind: 'sun' });
    let reflected = null;
    if (caught) {
      const out = raySegment(p.x, p.y, p.aimX, p.aimY, walls, 1300);
      reflected = { x1: p.x, y1: p.y, x2: out.x, y2: out.y, kind: 'reflected' };
      s.beams.push(reflected);
    }
    for (const receiver of s.receivers) {
      if (receiver.active) continue;
      const lit = reflected && segmentDistance(receiver.x, receiver.y,
        reflected.x1, reflected.y1, reflected.x2, reflected.y2) <= receiver.r;
      receiver.charge = clamp(receiver.charge + (lit ? dt / 1.2 : -dt / .65), 0, 1);
      if (receiver.charge >= 1 - EPS) {
        receiver.active = true; receiver.charge = 1;
        spark(s, receiver.x, receiver.y, 'light', 18);
        if (receiver.id === 'gate') {
          s.gates[0].open = true; s.score += 250;
          announce(s, 'Gate opened. Face the sentinel and return its bright shots.', 6);
        } else {
          s.sanctuary = true; p.hp = p.maxHp; s.score += 150;
          announce(s, 'Sanctuary restored. Its circle heals you when you retreat.', 6);
        }
      }
    }
  }

  function hurt(s) {
    const p = s.player;
    if (p.invulnerable > 0 || p.dashTime > 0) return;
    p.hp--; s.hits++; p.invulnerable = 1.05;
    spark(s, p.x, p.y, 'hurt', 10);
    if (p.hp <= 0) {
      p.hp = 0; s.status = 'lost'; p.reflecting = false;
      announce(s, 'The prism dims. Retry the courtyard and face incoming shots.');
    } else announce(s, 'Face incoming shots with the mirror, or dash clear.', 2.3);
  }
  function damageSentinel(s, enemy, amount, returned) {
    if (enemy.hp <= 0 || !s.gates[0].open) return;
    if (returned) {
      if (enemy.exposed > 0 || enemy.phase === 'lunge-windup' || enemy.phase === 'lunge') return;
      enemy.exposed = 3.4; enemy.phase = 'exposed'; enemy.timer = 3.4;
      enemy.shotsLeft = 0; s.returns++;
      if (!enemy.rewardedCracks.includes(enemy.hp)) {
        enemy.rewardedCracks.push(enemy.hp); s.score += 100;
      }
      spark(s, enemy.x, enemy.y, 'light', 14);
      announce(s, 'Armor cracked! Close in and strike the exposed core.', 3.4);
      return;
    }
    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.exposed = 0;
    spark(s, enemy.x, enemy.y, 'slash', 14);
    if (enemy.hp === 0) {
      enemy.phase = 'defeated'; enemy.exposed = 0; enemy.timer = 0;
      s.shots = s.shots.filter(shot => shot.friendly);
      s.score += 400;
      announce(s, 'The sentinel falls. Reach the keeper beside the north beacon.', 7);
    } else beginLunge(s, enemy);
  }
  function beginLunge(s, enemy) {
    enemy.phase = 'lunge-windup'; enemy.timer = .9; enemy.exposed = 0;
    const dx = s.player.x - enemy.x, dy = s.player.y - enemy.y;
    const d = Math.max(EPS, length(dx, dy));
    enemy.aimX = dx / d; enemy.aimY = dy / d;
    announce(s, 'Red charge! Step aside or dash across its locked path.', 1.25);
  }

  function sentinel(s, dt) {
    const p = s.player;
    for (const enemy of s.enemies) {
      if (enemy.hp <= 0) continue;
      if (enemy.exposed > 0) {
        enemy.exposed = Math.max(0, enemy.exposed - dt);
        enemy.timer = enemy.exposed;
        if (!enemy.exposed) beginLunge(s, enemy);
        continue;
      }
      if (enemy.phase === 'dormant') {
        if (s.gates[0].open && p.x > 650) { enemy.phase = 'recover'; enemy.timer = .75; }
        continue;
      }
      enemy.timer -= dt;
      if (enemy.phase === 'lunge-windup') {
        if (enemy.timer <= 0) { enemy.phase = 'lunge'; enemy.timer = .34; }
        continue;
      }
      if (enemy.phase === 'lunge') {
        movePlayer(enemy, enemy.aimX * 450, enemy.aimY * 450, dt, solids(s));
        if (enemy.timer <= 0) { enemy.phase = 'recover'; enemy.timer = 1.05; }
        continue;
      }
      if (enemy.phase === 'recover' && enemy.timer <= 0) {
        enemy.phase = 'telegraph'; enemy.timer = 1.05;
        const d = Math.max(EPS, length(p.x - enemy.x, p.y - enemy.y));
        enemy.aimX = (p.x - enemy.x) / d; enemy.aimY = (p.y - enemy.y) / d;
      } else if (enemy.phase === 'telegraph' && enemy.timer <= 0) {
        enemy.phase = 'attack'; enemy.timer = 1.45;
        enemy.shotsLeft = 3; enemy.shotTimer = 0; enemy.volley++;
      }
      if (enemy.phase === 'attack') {
        enemy.shotTimer -= dt;
        if (enemy.shotsLeft > 0 && enemy.shotTimer <= 0) {
          // The aim commits at the start of the full one-second telegraph.
          const offset = (3 - enemy.shotsLeft) * .055;
          const side = enemy.volley % 2 ? 1 : -1;
          const angle = Math.atan2(enemy.aimY, enemy.aimX) + offset * side;
          const ux = Math.cos(angle), uy = Math.sin(angle);
          s.shots.push({ id: s._nextShotId++, x: enemy.x + ux * 34,
            y: enemy.y + uy * 34, vx: ux * 245, vy: uy * 245,
            friendly: false, life: 5, r: 7 });
          enemy.shotsLeft--; enemy.shotTimer += .18;
        }
        if (enemy.timer <= 0) beginLunge(s, enemy);
      }
    }
  }

  function projectiles(s, dt, walls) {
    const p = s.player, remaining = [];
    // Damage may clear the live list; iterate a stable snapshot and retain only
    // friendly missiles after defeat so a simultaneous last shot cannot kill you.
    for (const shot of s.shots.slice()) {
      if (!shot.friendly && s.enemies.every(e => e.hp <= 0)) continue;
      shot.life -= dt;
      const distance = length(shot.vx, shot.vy) * dt;
      const end = raySegment(shot.x, shot.y, shot.vx, shot.vy, walls, distance);
      const nx = end.x, ny = end.y;
      let consumed = false;
      if (shot.friendly) {
        for (const enemy of s.enemies) {
          if (enemy.hp > 0 && segmentDistance(enemy.x, enemy.y, shot.x, shot.y, nx, ny) <= enemy.r + shot.r) {
            damageSentinel(s, enemy, 1, true); consumed = true; break;
          }
        }
      } else if (segmentDistance(p.x, p.y, shot.x, shot.y, nx, ny) <= p.r + shot.r + (p.reflecting ? 9 : 0)) {
        const speed = Math.max(EPS, length(shot.vx, shot.vy));
        const facing = p.aimX * (-shot.vx / speed) + p.aimY * (-shot.vy / speed);
        if (p.reflecting && facing >= .35) {
          shot.friendly = true; shot.vx = p.aimX * 390; shot.vy = p.aimY * 390;
          shot.x = p.x + p.aimX * 32; shot.y = p.y + p.aimY * 32;
          shot.life = 3;
          spark(s, shot.x, shot.y, 'light', 8);
          remaining.push(shot); continue;
        }
        hurt(s); consumed = true;
      }
      if (!consumed && !end.rect && shot.life > 0) {
        shot.x = nx; shot.y = ny; remaining.push(shot);
      }
    }
    s.shots = remaining.filter(shot => shot.friendly || s.enemies.some(e => e.hp > 0));
  }

  function step(s, input, dt) {
    if (!s || s.status !== 'playing') return s;
    input = input || {};
    dt = Number.isFinite(dt) ? clamp(dt, 0, 1 / 30) : 0;
    if (!dt) return s;
    s.time += dt;
    const p = s.player, walls = solids(s);
    for (const key of ['slashTime', 'slashCooldown', 'dashTime', 'dashCooldown', 'invulnerable']) {
      p[key] = Math.max(0, p[key] - dt);
    }
    s._messageTime = Math.max(0, s._messageTime - dt);
    const ax = Number.isFinite(input.ax) ? input.ax : 0, ay = Number.isFinite(input.ay) ? input.ay : 0;
    const aimLength = length(ax, ay);
    if (aimLength > .01) { p.aimX = ax / aimLength; p.aimY = ay / aimLength; }
    let mx = Number.isFinite(input.mx) ? input.mx : 0, my = Number.isFinite(input.my) ? input.my : 0;
    const moveLength = length(mx, my);
    if (moveLength > 1) { mx /= moveLength; my /= moveLength; }
    if (input.dash && !s._dashHeld && p.dashCooldown <= 0) {
      p.dashTime = .18; p.dashCooldown = 1.15;
      p.dashX = moveLength > .01 ? mx / Math.max(EPS, length(mx, my)) : p.aimX;
      p.dashY = moveLength > .01 ? my / Math.max(EPS, length(mx, my)) : p.aimY;
      p.invulnerable = Math.max(p.invulnerable, .24);
      spark(s, p.x, p.y, 'dash', 7);
    }
    p.reflecting = !!input.reflect && p.dashTime <= 0 && p.slashTime <= 0;
    if (input.slash && !s._slashHeld && p.slashCooldown <= 0 && p.dashTime <= 0) {
      p.slashTime = .22; p.slashCooldown = .43; p.reflecting = false; s._slashSerial++;
    }
    s._slashHeld = !!input.slash; s._dashHeld = !!input.dash;
    const speed = p.reflecting ? 108 : 190;
    movePlayer(p, p.dashTime > 0 ? p.dashX * 520 : mx * speed,
      p.dashTime > 0 ? p.dashY * 520 : my * speed, dt, walls);
    sunlight(s, dt, walls);
    sentinel(s, dt);
    projectiles(s, dt, walls);
    for (const enemy of s.enemies) {
      const dx = enemy.x - p.x, dy = enemy.y - p.y, dist = length(dx, dy);
      if (enemy.hp > 0 && enemy.exposed > 0 && p.slashTime > 0 &&
        enemy.lastSlash !== s._slashSerial && dist < 81 &&
        (dx * p.aimX + dy * p.aimY) / Math.max(EPS, dist) > .1 &&
        !raySegment(p.x, p.y, dx, dy, walls, dist).rect) {
        enemy.lastSlash = s._slashSerial; damageSentinel(s, enemy, 2, false);
      }
      if (enemy.hp > 0 && dist < p.r + enemy.r && enemy.exposed <= 0) hurt(s);
    }
    if (s.sanctuary && length(p.x - 280, p.y - 620) < 45) {
      s._sanctuaryCooldown -= dt;
      if (s._sanctuaryCooldown <= 0 && p.hp < p.maxHp && s.status === 'playing') {
        p.hp++; s._sanctuaryCooldown = 1; spark(s, p.x, p.y, 'heal', 6);
      }
    } else s._sanctuaryCooldown = Math.max(0, s._sanctuaryCooldown - dt);
    if (s.status === 'playing' && !s.rescue.freed && s.gates[0].open &&
      s.enemies.every(e => e.hp <= 0) && length(p.x - s.rescue.x, p.y - s.rescue.y) < 42) {
      s.rescue.freed = true; s.status = 'won'; p.reflecting = false;
      s.score += 700 + p.hp * 50;
      announce(s, 'Ilex is free. The first beacon answers. Courtyard complete.');
      spark(s, s.rescue.x, s.rescue.y, 'light', 25);
    }
    s.particles = s.particles.filter(particle => {
      particle.life -= dt;
      particle.x += (particle.vx || 0) * dt; particle.y += (particle.vy || 0) * dt;
      return particle.life > 0;
    });
    if (s._messageTime === 0 && s.status === 'playing') {
      s.message = !s.gates[0].open ? 'Catch the sunbeam with your mirror. Light the north receiver.' :
        s.enemies.some(e => e.hp > 0) ? 'Mirror incoming shots. Strike while the sentinel is exposed.' :
          'Reach Ilex at the northeast beacon.';
    }
    return s;
  }

  PW.create = create;
  PW.step = step;
  PW.raySegment = raySegment;
})(typeof window !== 'undefined' ? window : globalThis);
