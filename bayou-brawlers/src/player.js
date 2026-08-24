import { approach, clamp, hitOutcome, signOr } from './core.js';
import { LANE_BOTTOM, LANE_TOP } from './config.js';

const ATTACKS = {
  light1: {
    id: 'light1', label: 'Quick Jab', startup: 0.055, active: 0.07, recovery: 0.13,
    damage: 10, reach: 82, lane: 43, hitstun: 0.18, knockback: 55, hitstop: 0.045,
    focus: 7, sound: 'swingLight', impact: 'light', lunge: 32, cancel: 0.13
  },
  light2: {
    id: 'light2', label: 'Backfist', startup: 0.065, active: 0.075, recovery: 0.14,
    damage: 11, reach: 91, lane: 44, hitstun: 0.2, knockback: 62, hitstop: 0.052,
    focus: 7, sound: 'swingLight', impact: 'light', lunge: 38, cancel: 0.145
  },
  light3: {
    id: 'light3', label: 'Tail Sweep', startup: 0.085, active: 0.085, recovery: 0.17,
    damage: 13, reach: 112, behind: 35, lane: 54, hitstun: 0.24, knockback: 105,
    hitstop: 0.06, focus: 9, sound: 'swingHeavy', impact: 'sweep', lunge: 24,
    cancel: 0.18, sweep: true
  },
  light4: {
    id: 'light4', label: 'Dockbreaker', startup: 0.1, active: 0.085, recovery: 0.22,
    damage: 18, reach: 104, lane: 47, hitstun: 0.3, knockback: 230, knockdown: true,
    hitstop: 0.085, focus: 13, sound: 'swingHeavy', impact: 'heavy', lunge: 44,
    cancel: 0.24
  },
  heavy: {
    id: 'heavy', label: 'Rising Hook', startup: 0.12, active: 0.09, recovery: 0.25,
    damage: 22, reach: 98, lane: 46, hitstun: 0.34, knockback: 125, launch: 470,
    breaksArmor: true, hitstop: 0.09, focus: 14, sound: 'swingHeavy', impact: 'heavy',
    lunge: 26, cancel: 0.28
  },
  dash: {
    id: 'dash', label: 'Mudslide', startup: 0.07, active: 0.1, recovery: 0.2,
    damage: 17, reach: 122, lane: 49, hitstun: 0.3, knockback: 235, knockdown: true,
    hitstop: 0.075, focus: 11, sound: 'swingHeavy', impact: 'heavy', lunge: 145,
    cancel: 0.24
  },
  air: {
    id: 'air', label: 'Cypress Drop', startup: 0.06, active: 0.12, recovery: 0.12,
    damage: 16, reach: 92, lane: 49, height: 115, hitstun: 0.27, knockback: 145,
    knockdown: true, hitstop: 0.07, focus: 10, sound: 'swingHeavy', impact: 'heavy',
    lunge: 65, cancel: 0.2
  },
  pummel: {
    id: 'pummel', label: 'Body Blow', startup: 0.04, active: 0.04, recovery: 0.11,
    damage: 7, reach: 55, lane: 30, hitstun: 0.15, knockback: 0,
    hitstop: 0.045, focus: 5, sound: 'swingLight', impact: 'light', grabOnly: true
  },
  throw: {
    id: 'throw', label: 'Bayou Toss', startup: 0.08, active: 0.05, recovery: 0.22,
    damage: 24, hitstun: 0.42, knockback: 420, launch: 330, knockdown: true,
    hitstop: 0.095, focus: 16, sound: 'throw', impact: 'heavy', throw: true
  },
  special: {
    id: 'special', label: 'Gator Wake', startup: 0.16, active: 0.13, recovery: 0.27,
    damage: 26, radius: 168, lane: 110, hitstun: 0.36, knockback: 310,
    knockdown: true, breaksArmor: true, hitstop: 0.1, sound: 'special',
    impact: 'special', radial: true, focusCost: 35, invulnerability: 0.32
  }
};

let nextPlayerId = 1;

export class Player {
  constructor(x = 260, y = 520) {
    this.id = `player-${nextPlayerId++}`;
    this.name = 'Roux';
    this.type = 'player';
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.facing = 1;
    this.state = 'idle';
    this.stateTime = 0;
    this.health = 140;
    this.maxHealth = 140;
    this.focus = 40;
    this.maxFocus = 100;
    this.invulnerable = 0;
    this.dead = false;
    this.attack = null;
    this.attackTriggered = false;
    this.attackLanded = false;
    this.comboStep = 0;
    this.comboGrace = 0;
    this.grabbedTarget = null;
    this.grabPummels = 0;
    this.sprintTime = 0;
    this.moveHoldTime = 0;
    this.lastMove = { x: 1, y: 0 };
    this.flash = 0;
    this.animationFrame = 0;
    this.lastDamage = 0;
    this.lastKnockback = 0;
    this.stats = { damage: 0, hits: 0, maxCombo: 0, damageTaken: 0, dodges: 0 };
  }

  reset(x = 260, y = 520) {
    Object.assign(this, new Player(x, y));
  }

  get isGrounded() { return this.z <= 0.001; }
  get canAct() { return !this.dead && ['idle', 'move'].includes(this.state); }

  update(dt, game, input) {
    this.stateTime += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.comboGrace = Math.max(0, this.comboGrace - dt);
    if (this.comboGrace <= 0 && this.state !== 'attack') this.comboStep = 0;
    this.animationFrame = Math.floor(this.stateTime * 60);

    if (this.dead) {
      this.updateAir(dt, game);
      this.vx = approach(this.vx, 0, 480 * dt);
      this.x += this.vx * dt;
      return;
    }

    if (this.state === 'hurt' || this.state === 'down') {
      this.updateHurt(dt, game, input);
    } else if (this.state === 'dodge') {
      this.updateDodge(dt, game);
    } else if (this.state === 'attack') {
      this.updateAttack(dt, game, input);
    } else if (this.state === 'grab') {
      this.updateGrab(dt, game, input);
    } else if (this.state === 'jump') {
      this.updateJump(dt, game, input);
    } else {
      this.updateNeutral(dt, game, input);
    }

    if (this.state !== 'jump') this.updateAir(dt, game);
    this.constrain(game);
  }

  updateNeutral(dt, game, input) {
    const dir = input.direction;
    const moving = Math.hypot(dir.x, dir.y) > 0.05;
    if (moving) {
      this.lastMove = { ...dir };
      if (Math.abs(dir.x) > 0.15) this.facing = signOr(dir.x, this.facing);
    }

    this.moveHoldTime = moving ? this.moveHoldTime + dt : 0;
    const sprinting = moving && (game.settings.holdToSprint
      ? input.held('dodge')
      : this.moveHoldTime > 0.32);
    this.sprintTime = sprinting ? this.sprintTime + dt : Math.max(0, this.sprintTime - dt * 3);
    const maxSpeed = sprinting && this.sprintTime > 0.12 ? 330 : 218;
    const acceleration = sprinting ? 1600 : 1900;
    this.vx = approach(this.vx, dir.x * maxSpeed, acceleration * dt);
    this.vy = approach(this.vy, dir.y * maxSpeed * 0.72, acceleration * 0.78 * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.setState(moving ? 'move' : 'idle', false);

    const now = input.simTime ?? performance.now();
    if (input.consume('special', now)) {
      if (this.focus >= ATTACKS.special.focusCost) {
        this.focus -= ATTACKS.special.focusCost;
        this.startAttack(ATTACKS.special, game);
      } else {
        game.announce('Not enough focus', 0.7);
        game.playSound('ui', { pitch: 0.7, volume: 0.5 });
      }
      return;
    }
    if (input.consume('jump', now)) {
      this.state = 'jump';
      this.stateTime = 0;
      this.z = 1;
      this.vz = 620;
      game.playSound('jump');
      return;
    }
    if (input.consume('grab', now)) {
      this.startGrab(game);
      return;
    }
    if (input.consume('heavy', now)) {
      this.startAttack(ATTACKS.heavy, game);
      return;
    }
    if (input.consume('light', now)) {
      const dashAttack = Math.abs(this.vx) > 275 || this.sprintTime > 0.18;
      this.comboStep = dashAttack ? 0 : 1;
      this.startAttack(dashAttack ? ATTACKS.dash : ATTACKS.light1, game);
      return;
    }
    if (input.consume('dodge', now)) this.startDodge(game);
  }

  updateAttack(dt, game, input) {
    const attack = this.attack;
    if (!attack) {
      this.setState('idle');
      return;
    }
    const total = attack.startup + attack.active + attack.recovery;
    const activeStart = attack.startup;
    const activeEnd = activeStart + attack.active;
    if (attack.invulnerability) this.invulnerable = Math.max(this.invulnerable, attack.invulnerability - this.stateTime);

    if (this.stateTime < activeEnd && attack.lunge) {
      const lungeWindow = Math.max(attack.active + attack.startup, 0.08);
      this.x += this.facing * attack.lunge * dt / lungeWindow;
    }

    if (!this.attackTriggered && this.stateTime >= activeStart) {
      this.attackTriggered = true;
      if (attack.throw && this.grabbedTarget) {
        game.throwGrab(this, this.grabbedTarget, attack);
        this.grabbedTarget = null;
      } else {
        game.performAttack(this, attack);
      }
    }

    const now = input.simTime ?? performance.now();
    const canCancel = this.stateTime >= (attack.cancel ?? activeEnd);
    if (canCancel && input.buffer.has('dodge', now) && !attack.throw) {
      input.consume('dodge', now);
      this.startDodge(game);
      return;
    }
    if (canCancel && input.buffer.has('special', now) && this.focus >= ATTACKS.special.focusCost) {
      input.consume('special', now);
      this.focus -= ATTACKS.special.focusCost;
      this.startAttack(ATTACKS.special, game);
      return;
    }
    if (canCancel && input.buffer.has('heavy', now) && ['light2', 'light3'].includes(attack.id)) {
      input.consume('heavy', now);
      this.startAttack(ATTACKS.heavy, game);
      return;
    }
    if (canCancel && input.buffer.has('light', now) && attack.id.startsWith('light')) {
      input.consume('light', now);
      this.comboStep = Math.min(4, this.comboStep + 1);
      this.startAttack(ATTACKS[`light${this.comboStep}`], game);
      return;
    }
    if (this.stateTime >= total) {
      this.comboGrace = this.attackLanded ? 0.34 : 0.12;
      this.attack = null;
      this.setState('idle');
    }
  }

  updateJump(dt, game, input) {
    const dir = input.direction;
    if (Math.abs(dir.x) > 0.15) this.facing = signOr(dir.x, this.facing);
    this.vx = approach(this.vx, dir.x * 230, 950 * dt);
    this.vy = approach(this.vy, dir.y * 150, 820 * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.updateAir(dt, game);
    const now = input.simTime ?? performance.now();
    if (!this.attack && (input.consume('light', now) || input.consume('heavy', now))) {
      this.startAttack(ATTACKS.air, game, true);
    } else if (this.attack) {
      const attack = this.attack;
      if (!this.attackTriggered && this.stateTime >= attack.startup) {
        this.attackTriggered = true;
        game.performAttack(this, attack);
      }
    }
    if (this.isGrounded) {
      this.attack = null;
      this.setState('idle');
      game.playSound('land', { volume: Math.min(1, Math.abs(this.vz) / 500) });
      game.spawnImpact(this.x, this.y, 0, 'dust', '#9e8c63');
    }
  }

  updateAir(dt, game) {
    if (this.z <= 0 && this.vz <= 0) {
      this.z = 0;
      this.vz = 0;
      return;
    }
    this.vz -= 1450 * dt;
    this.z += this.vz * dt;
    if (this.z <= 0) {
      this.z = 0;
      this.vz = 0;
    }
  }

  updateDodge(dt, game) {
    const duration = 0.31;
    const speed = this.stateTime < 0.2 ? 590 : 190;
    this.invulnerable = Math.max(this.invulnerable, 0.22 - this.stateTime);
    this.x += this.dodgeDirection.x * speed * dt;
    this.y += this.dodgeDirection.y * speed * 0.66 * dt;
    if (this.stateTime >= duration) this.setState('idle');
  }

  updateGrab(dt, game, input) {
    const target = this.grabbedTarget;
    if (!target || target.dead || target.remove) {
      this.grabbedTarget = null;
      this.setState('idle');
      return;
    }
    target.x = this.x + this.facing * 48;
    target.y = this.y - 2;
    target.facing = -this.facing;
    const now = input.simTime ?? performance.now();
    if (input.consume('light', now) && this.grabPummels < 2) {
      this.grabPummels++;
      game.damageGrabbed(this, target, ATTACKS.pummel);
      this.stateTime = Math.min(this.stateTime, 0.24);
      return;
    }
    if (input.consume('heavy', now) || input.consume('grab', now) || this.stateTime > 1.35) {
      this.startAttack(ATTACKS.throw, game);
    }
  }

  updateHurt(dt, game, input) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx = approach(this.vx, 0, 600 * dt);
    this.vy = approach(this.vy, 0, 500 * dt);
    this.updateAir(dt, game);
    if (this.state === 'hurt' && this.stateTime >= this.hurtDuration && this.isGrounded) {
      this.setState('idle');
      this.invulnerable = Math.max(this.invulnerable, 0.18);
    }
    if (this.state === 'down' && this.isGrounded && this.stateTime >= 0.72) {
      const now = input.simTime ?? performance.now();
      if (input.consume('dodge', now)) {
        this.setState('dodge');
        this.dodgeDirection = { x: -this.facing, y: 0 };
        this.invulnerable = 0.34;
      } else if (this.stateTime >= 1.02) {
        this.setState('idle');
        this.invulnerable = 0.55;
      }
    }
  }

  startAttack(attack, game, preserveJump = false) {
    this.attack = attack;
    this.attackTriggered = false;
    this.attackLanded = false;
    if (!preserveJump) this.state = 'attack';
    this.stateTime = 0;
    this.vx *= 0.28;
    this.vy *= 0.25;
    game.playSound(attack.sound, { pitch: 0.96 + game.random() * 0.08 });
  }

  startDodge(game) {
    const move = Math.hypot(this.lastMove.x, this.lastMove.y) > 0.1
      ? this.lastMove
      : { x: -this.facing, y: 0 };
    this.state = 'dodge';
    this.stateTime = 0;
    this.dodgeDirection = move;
    this.invulnerable = 0.24;
    this.attack = null;
    this.stats.dodges++;
    game.playSound('dodge');
    game.spawnImpact(this.x, this.y, 0, 'dust', '#9e8c63');
  }

  startGrab(game) {
    const target = game.tryGrab(this);
    if (!target) {
      this.startAttack({ ...ATTACKS.light1, id: 'grab-whiff', damage: 0, reach: 58, recovery: 0.16 }, game);
      return;
    }
    this.state = 'grab';
    this.stateTime = 0;
    this.grabbedTarget = target;
    this.grabPummels = 0;
    this.vx = this.vy = 0;
    game.playSound('grab');
  }

  takeHit(attack, source, game) {
    if (this.invulnerable > 0 || this.dead) return false;
    const outcome = hitOutcome({ ...attack, damage: (attack.damage || 1) * game.settings.enemyDamage }, this);
    this.health = Math.max(0, this.health - outcome.damage);
    this.stats.damageTaken += outcome.damage;
    this.lastDamage = outcome.damage;
    this.lastKnockback = outcome.knockback;
    this.flash = 0.08;
    this.attack = null;
    this.grabbedTarget = null;
    const direction = signOr(this.x - source.x, -source.facing);
    this.vx = direction * outcome.knockback;
    this.vy = (this.y - source.y) * 1.2;
    this.vz = outcome.launch;
    this.z = outcome.launch > 0 ? 2 : this.z;
    this.hurtDuration = Math.max(0.18, outcome.hitstun);
    this.state = outcome.knockdown || outcome.launch > 0 ? 'down' : 'hurt';
    this.stateTime = 0;
    game.playSound(this.health <= 0 ? 'KO' : 'hurt', { pitch: 0.9 + game.random() * 0.15 });
    game.spawnImpact(this.x, this.y, this.z + 55, outcome.knockdown ? 'heavy' : 'light', '#ff7043');
    game.addShake(outcome.knockdown ? 8 : 3);
    if (this.health <= 0) {
      this.dead = true;
      this.state = 'down';
      this.vz = Math.max(this.vz, 380);
      game.onPlayerDefeated();
    }
    return true;
  }

  onAttackHit(target, attack, damage, game) {
    this.attackLanded = true;
    this.focus = clamp(this.focus + (attack.focus || 0), 0, this.maxFocus);
    this.stats.damage += damage;
    this.stats.hits++;
    game.combo.hit(damage, attack.label);
    this.stats.maxCombo = Math.max(this.stats.maxCombo, game.combo.count);
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, this.maxHealth);
  }

  setState(state, reset = true) {
    if (this.state === state) return;
    this.state = state;
    if (reset) this.stateTime = 0;
  }

  constrain(game) {
    this.x = clamp(this.x, game.worldBounds.left, game.worldBounds.right);
    this.y = clamp(this.y, LANE_TOP, LANE_BOTTOM);
  }

  getHurtbox() {
    return { x: this.x - 25, y: this.y - 72 - this.z, w: 50, h: 72 };
  }

  draw(ctx, camera, options = {}) {
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;
    const t = this.stateTime;
    const moving = this.state === 'move';
    const stride = moving ? Math.sin(t * (Math.abs(this.vx) > 260 ? 17 : 11)) : Math.sin(t * 3) * 0.16;
    const attackPose = this.attackPose();
    const dodgeLean = this.state === 'dodge' ? 0.55 * this.dodgeDirection.x : 0;
    const hurtLean = ['hurt', 'down'].includes(this.state) ? -0.34 * this.facing : 0;
    const bodyY = sy - this.z;
    const shadowScale = clamp(1 - this.z / 620, 0.42, 1);

    ctx.save();
    ctx.translate(sx, sy + 4);
    ctx.scale(shadowScale, shadowScale * 0.42);
    const shadow = ctx.createRadialGradient(0, 0, 5, 0, 0, 52);
    shadow.addColorStop(0, 'rgba(0,0,0,.48)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(sx, bodyY);
    ctx.scale(this.facing, 1);
    ctx.rotate(dodgeLean + hurtLean + attackPose.lean);
    const flash = this.flash > 0 && options.hitFlash !== false;
    const outline = options.highContrast ? '#fff7d6' : '#07100d';
    const skin = flash ? '#fff' : '#4ea861';
    const skinDark = flash ? '#fff' : '#2f7043';
    const belly = flash ? '#fff' : '#c9c979';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = outline;
    ctx.lineWidth = options.highContrast ? 7 : 5;

    this.drawAttackArc(ctx, options);

    // Tail: strong silhouette and a readable sweep during combo hit three.
    ctx.save();
    ctx.rotate(attackPose.tail);
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.moveTo(-18, -48);
    ctx.quadraticCurveTo(-72, -48, -105, -15);
    ctx.quadraticCurveTo(-58, -25, -10, -22);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();

    // Back leg then front leg.
    this.drawLimb(ctx, -13, -44, -18 - stride * 9, -4, 18, skinDark, outline);
    this.drawLimb(ctx, 13, -45, 18 + stride * 9, -3, 19, skin, outline);

    // Torso and wader belt.
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(0, -72, 31, 42, -0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = '#263d35';
    ctx.fillRect(-31, -62, 62, 21);
    ctx.strokeRect(-31, -62, 62, 21);
    ctx.fillStyle = '#f4b942';
    ctx.fillRect(-4, -64, 8, 24);

    // Far arm, then near striking arm.
    this.drawArm(ctx, -18, -84, -28 + attackPose.backArmX, -51 + attackPose.backArmY, skinDark, outline, 11);
    this.drawArm(ctx, 19, -85, 31 + attackPose.armX, -64 + attackPose.armY, skin, outline, attackPose.armSize);

    // Head and snout.
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(3, -119, 30, 25, 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(13, -124, 45, 23, 9);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.roundRect(18, -113, 39, 10, 5);
    ctx.fill();

    // Eyes, teeth and signature bandanna.
    ctx.fillStyle = '#f6efb5';
    ctx.beginPath(); ctx.arc(10, -130, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#081411';
    ctx.beginPath(); ctx.arc(13, -130, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4e8c9';
    ctx.beginPath(); ctx.moveTo(45, -104); ctx.lineTo(50, -96); ctx.lineTo(54, -105); ctx.fill();
    ctx.strokeStyle = outline;
    ctx.fillStyle = flash ? '#fff' : '#d9484c';
    ctx.beginPath();
    ctx.moveTo(-23, -125); ctx.quadraticCurveTo(5, -137, 31, -129);
    ctx.lineTo(28, -119); ctx.quadraticCurveTo(3, -126, -24, -116); ctx.closePath();
    ctx.stroke(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-22, -118); ctx.lineTo(-49, -103); ctx.lineTo(-28, -128); ctx.closePath(); ctx.stroke(); ctx.fill();

    if (this.state === 'dodge') {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#b9fff3';
      ctx.beginPath(); ctx.ellipse(-55, -70, 38, 12, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    if (options.debug) {
      ctx.save();
      ctx.strokeStyle = this.invulnerable > 0 ? '#5ee7ff' : '#ffef72';
      ctx.strokeRect(sx - 25, bodyY - 144, 50, 144);
      ctx.fillStyle = '#fff';
      ctx.font = '11px Consolas';
      ctx.fillText(`${this.state} f${this.animationFrame}`, sx - 38, bodyY - 154);
      ctx.restore();
    }
  }

  drawLimb(ctx, x1, y1, x2, y2, radius, color, outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = radius + 6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = radius;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  drawArm(ctx, x1, y1, x2, y2, color, outline, radius) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = radius + 7;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(x2 * .65, (y1 + y2) * .45, x2, y2); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = radius;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(x2 * .65, (y1 + y2) * .45, x2, y2); ctx.stroke();
    ctx.fillStyle = '#f4b942';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x2, y2, radius * .78, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
  }

  drawAttackArc(ctx, options = {}) {
    const attack = this.attack;
    if (!attack || this.state !== 'attack' || (!attack.id.startsWith('light') && attack.id !== 'dash')) return;
    const cueStart = attack.startup * 0.48;
    const cueEnd = attack.startup + attack.active + 0.045;
    if (this.stateTime < cueStart || this.stateTime > cueEnd) return;
    const progress = clamp((this.stateTime - cueStart) / Math.max(0.01, cueEnd - cueStart), 0, 1);
    const opacity = Math.sin(progress * Math.PI) * (options.reducedMotion ? 0.5 : 0.78);
    const reach = Math.max(48, (attack.reach || 82) * 0.72);
    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.strokeStyle = options.highContrast ? '#ffffff' : '#ffd166';
    ctx.lineWidth = attack.id === 'light4' || attack.id === 'dash' ? 9 : 6;
    ctx.beginPath();
    if (attack.id === 'light3') {
      ctx.ellipse(-5, -42, reach, 28, 0, Math.PI * 0.98, Math.PI * 1.92);
    } else {
      const drift = options.reducedMotion ? 0 : progress * 0.22;
      ctx.arc(13, -77, reach, -0.82 + drift, 0.22 + drift);
    }
    ctx.stroke();
    ctx.restore();
  }

  attackPose() {
    if (this.state === 'grab') return { lean: .08, armX: 33, armY: 3, backArmX: 29, backArmY: 1, armSize: 14, tail: -.1 };
    if (this.state !== 'attack' && !(this.state === 'jump' && this.attack)) {
      return { lean: 0, armX: 0, armY: 0, backArmX: 0, backArmY: 0, armSize: 13, tail: Math.sin(this.stateTime * 2.6) * .06 };
    }
    const id = this.attack?.id || 'light1';
    const progress = clamp(this.stateTime / Math.max(0.1, this.attack.startup + this.attack.active), 0, 1);
    const snap = Math.sin(progress * Math.PI);
    if (id === 'light3') return { lean: -.05, armX: 5, armY: -6, backArmX: -5, backArmY: 0, armSize: 14, tail: -1.65 * snap };
    if (id === 'heavy') return { lean: -.13, armX: 35 * snap, armY: -60 * snap, backArmX: -8, backArmY: 5, armSize: 17, tail: -.2 };
    if (id === 'special') return { lean: Math.sin(progress * Math.PI * 2) * .25, armX: 30 * snap, armY: -18, backArmX: -28 * snap, backArmY: -18, armSize: 19, tail: -1.1 * progress };
    if (id === 'air') return { lean: .55, armX: 42, armY: 25, backArmX: -8, backArmY: -4, armSize: 17, tail: -.7 };
    if (id === 'throw') return { lean: -.3 + progress * .7, armX: 40, armY: -30 + progress * 55, backArmX: 31, backArmY: -22 + progress * 48, armSize: 18, tail: -.35 };
    return { lean: .13 * snap, armX: 58 * snap, armY: -4 - 12 * snap, backArmX: -5, backArmY: 5, armSize: id === 'light4' || id === 'dash' ? 18 : 14, tail: -.15 * snap };
  }
}

export { ATTACKS as PLAYER_ATTACKS };
