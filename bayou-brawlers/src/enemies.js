import { approach, clamp, hitOutcome, signOr } from './core.js';
import { COLORS, LANE_BOTTOM, LANE_TOP, WORLD_LENGTH } from './config.js';

const TAU = Math.PI * 2;
const GRAVITY = 1180;
let nextEnemyId = 1;
let nextProjectileId = 1;

const freezeAttack = (attack) => Object.freeze(attack);
const freezeProfile = (profile) => Object.freeze({
  ...profile,
  attacks: Object.freeze(Object.fromEntries(
    Object.entries(profile.attacks || {}).map(([key, attack]) => [key, freezeAttack(attack)])
  ))
});

export const ENEMY_PROFILES = Object.freeze({
  grunt: freezeProfile({
    name: 'Bog Deckhand',
    role: 'melee',
    health: 72,
    speed: 142,
    acceleration: 760,
    width: 38,
    height: 82,
    laneSize: 30,
    armor: 0,
    pickupChance: 0.12,
    body: '#78945b',
    trim: '#d9bd73',
    attacks: {
      jab: {
        name: 'Deckhand Jab', telegraph: 0.32, active: 0.12, hitAt: 0.045,
        recovery: 0.46, cooldown: 0.34, damage: 9, reach: 76, lane: 34,
        hitstun: 0.2, knockback: 115, tell: 'jab', sound: 'enemySwing'
      },
      shove: {
        name: 'Shoulder Shove', telegraph: 0.46, active: 0.14, hitAt: 0.055,
        recovery: 0.62, cooldown: 0.52, damage: 13, reach: 70, lane: 38,
        hitstun: 0.26, knockback: 205, knockdown: true, tell: 'shove', sound: 'heavySwing'
      }
    }
  }),
  rusher: freezeProfile({
    name: 'Marsh Skirmisher',
    role: 'rusher',
    health: 54,
    speed: 204,
    acceleration: 1040,
    width: 34,
    height: 78,
    laneSize: 27,
    armor: 0,
    pickupChance: 0.1,
    body: '#9d5546',
    trim: '#f29a55',
    attacks: {
      lunge: {
        name: 'Reed-Knife Lunge', telegraph: 0.24, active: 0.19, hitAt: 0.075,
        recovery: 0.64, cooldown: 0.48, damage: 11, reach: 92, lane: 30,
        hitstun: 0.22, knockback: 155, movement: 345, tell: 'lunge', sound: 'enemyRush'
      },
      crosscut: {
        name: 'Crosscut', telegraph: 0.38, active: 0.14, hitAt: 0.05,
        recovery: 0.5, cooldown: 0.42, damage: 8, reach: 68, lane: 32,
        hitstun: 0.18, knockback: 105, tell: 'jab', sound: 'enemySwing'
      }
    }
  }),
  ranger: freezeProfile({
    name: 'Bayou Slinger',
    role: 'ranged',
    health: 48,
    speed: 126,
    acceleration: 650,
    width: 36,
    height: 80,
    laneSize: 28,
    armor: 0,
    pickupChance: 0.16,
    body: '#536f76',
    trim: '#73d0bf',
    attacks: {
      sling: {
        name: 'Mudpot Sling', telegraph: 0.62, active: 0.1, hitAt: 0.035,
        recovery: 0.74, cooldown: 0.85, damage: 8, projectileSpeed: 390,
        hitstun: 0.17, knockback: 90, tell: 'ranged', sound: 'slingRelease',
        color: '#8fe0c6'
      }
    }
  }),
  brute: freezeProfile({
    name: 'Levee Breaker',
    role: 'brute',
    health: 148,
    speed: 86,
    acceleration: 440,
    width: 56,
    height: 96,
    laneSize: 40,
    armor: 1,
    armorRecovery: 5.5,
    pickupChance: 0.24,
    body: '#596f3f',
    trim: '#d47d46',
    attacks: {
      hammer: {
        name: 'Mooring Hammer', telegraph: 0.64, active: 0.17, hitAt: 0.065,
        recovery: 0.82, cooldown: 0.7, damage: 19, reach: 100, lane: 46,
        hitstun: 0.34, knockback: 285, knockdown: true, tell: 'overhead', sound: 'heavySwing'
      },
      stomp: {
        name: 'Levee Stomp', telegraph: 0.78, active: 0.13, hitAt: 0.045,
        recovery: 0.94, cooldown: 1.05, damage: 15, reach: 84, behind: 84, lane: 82,
        radial: 94, radius: 94, hitstun: 0.3, knockback: 220, knockdown: true,
        tell: 'slam', sound: 'groundSlam', shake: 6
      }
    }
  }),
  dummy: freezeProfile({
    name: 'Cypress Training Dummy',
    role: 'dummy',
    health: 500,
    speed: 0,
    acceleration: 0,
    width: 42,
    height: 88,
    laneSize: 32,
    armor: 0,
    pickupChance: 0,
    body: '#806445',
    trim: '#e2c476',
    attacks: {}
  }),
  captainMire: freezeProfile({
    name: 'Captain Mire',
    role: 'boss',
    health: 720,
    speed: 116,
    acceleration: 620,
    width: 68,
    height: 112,
    laneSize: 48,
    armor: 0,
    pickupChance: 1,
    body: '#344f43',
    trim: '#f4b942',
    attacks: {
      cleave: {
        name: 'Cutlass Cleave', telegraph: 0.5, active: 0.17, hitAt: 0.06,
        recovery: 0.62, cooldown: 0.48, damage: 16, reach: 124, behind: 12, lane: 48,
        hitstun: 0.28, knockback: 215, tell: 'cleave', sound: 'bossSwing', shake: 2
      },
      charge: {
        name: 'Dredger Charge', telegraph: 0.72, active: 0.58, hitAt: 0.13,
        recovery: 0.9, cooldown: 0.78, damage: 21, reach: 116, lane: 42,
        hitstun: 0.38, knockback: 330, knockdown: true, movement: 430,
        tell: 'charge', sound: 'bossCharge', shake: 5
      },
      volley: {
        name: 'Mirelight Volley', telegraph: 0.82, active: 0.14, hitAt: 0.05,
        recovery: 0.72, cooldown: 0.7, damage: 10, projectileSpeed: 360,
        hitstun: 0.2, knockback: 125, tell: 'ranged', sound: 'mireVolley',
        color: '#c0ff72'
      },
      slam: {
        name: 'Captain\'s Undertow', telegraph: 0.92, active: 0.18, hitAt: 0.065,
        recovery: 1.02, cooldown: 0.9, damage: 23, reach: 118, behind: 118, lane: 105,
        radial: 132, radius: 132, hitstun: 0.42, knockback: 290, launch: 260, knockdown: true,
        tell: 'slam', sound: 'bossSlam', shake: 9
      }
    }
  })
});

function randomFrom(game) {
  return typeof game?.random === 'function' ? game.random() : Math.random();
}

function difficultyValue(game, key, fallback = 1) {
  const value = Number(game?.difficulty?.[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function worldEdges(game) {
  const bounds = game?.worldBounds || {};
  const left = bounds.left ?? bounds.minX ?? bounds.x ?? 0;
  const right = bounds.right ?? bounds.maxX ??
    (Number.isFinite(bounds.width) ? left + bounds.width : WORLD_LENGTH);
  const top = bounds.top ?? bounds.minY ?? bounds.laneTop ?? LANE_TOP;
  const bottom = bounds.bottom ?? bounds.maxY ?? bounds.laneBottom ?? LANE_BOTTOM;
  return { left, right, top, bottom };
}

function entityOnScreen(game, entity, margin = 80) {
  return typeof game?.isOnScreen !== 'function' || game.isOnScreen(entity, margin);
}

function cameraPosition(camera) {
  return {
    x: camera?.x ?? camera?.left ?? camera?.offsetX ?? 0,
    y: camera?.y ?? camera?.top ?? camera?.offsetY ?? 0,
    shakeX: camera?.shakeX ?? 0,
    shakeY: camera?.shakeY ?? 0
  };
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawHealthBar(ctx, x, y, width, ratio, color) {
  ctx.fillStyle = 'rgba(4, 12, 10, 0.82)';
  roundedRect(ctx, x - width / 2 - 2, y - 2, width + 4, 8, 4);
  ctx.fill();
  ctx.fillStyle = color;
  roundedRect(ctx, x - width / 2, y, width * clamp(ratio, 0, 1), 4, 2);
  ctx.fill();
}

export class Enemy {
  constructor(type, x, y, opts = {}) {
    const profile = ENEMY_PROFILES[type] || ENEMY_PROFILES.grunt;
    this.id = opts.id ?? `enemy-${nextEnemyId++}`;
    this.type = ENEMY_PROFILES[type] ? type : 'grunt';
    this.profile = profile;
    this.name = opts.name ?? profile.name;
    this.x = Number.isFinite(x) ? x : 0;
    this.y = Number.isFinite(y) ? y : (LANE_TOP + LANE_BOTTOM) / 2;
    this.z = opts.z ?? 0;
    this.vx = opts.vx ?? 0;
    this.vy = opts.vy ?? 0;
    this.vz = opts.vz ?? 0;
    this.facing = opts.facing === -1 ? -1 : 1;
    this.state = opts.state ?? 'idle';
    this.stateTime = opts.stateTime ?? 0;

    this.elite = Boolean(opts.elite);
    this.isBoss = profile.role === 'boss';
    this.team = opts.team ?? 'enemy';
    this.grabbable = opts.grabbable ?? (!this.isBoss && this.type !== 'brute');
    this.score = opts.score ?? (this.isBoss ? 2500 : this.elite ? 450 :
      this.type === 'brute' ? 240 : this.type === 'ranger' ? 175 : this.type === 'rusher' ? 140 : 100);
    this.aggressionScale = Math.max(0.2, opts.aggressionScale ?? 1);
    this.damageScale = Math.max(0.1, opts.damageScale ?? (this.elite ? 1.18 : 1));
    this.speedScale = Math.max(0.2, opts.speedScale ?? (this.elite ? 1.06 : 1));

    const explicitDifficulty = opts.difficulty?.enemyHealth;
    const initialHealthScale = (Number.isFinite(opts.healthScale) ? opts.healthScale : 1) *
      (Number.isFinite(explicitDifficulty) ? explicitDifficulty : 1) * (this.elite ? 1.42 : 1);
    this.maxHealth = Math.max(1, Math.round((opts.maxHealth ?? profile.health) * initialHealthScale));
    this.health = clamp(opts.health ?? this.maxHealth, 0, this.maxHealth);
    this.dead = Boolean(opts.dead || this.health <= 0);
    this.remove = Boolean(opts.remove);
    this.invulnerable = Math.max(0, opts.invulnerable ?? 0);
    this.armor = Math.max(0, opts.armor ?? Math.max(profile.armor ?? 0, this.elite ? 1 : 0));
    this.attackToken = null;

    this.width = opts.width ?? profile.width;
    this.height = opts.height ?? profile.height;
    this.laneSize = opts.laneSize ?? profile.laneSize;
    this.cooldown = Math.max(0, opts.cooldown ?? 0.15);
    this.phase = opts.phase ?? 1;
    this.phaseName = opts.phaseName ?? '';
    this.telegraphTarget = null;
    this.hitFlash = 0;

    this._difficultyApplied = Number.isFinite(explicitDifficulty) || opts.applyDifficulty === false;
    this._baseArmor = this.armor;
    this._armorRecovery = null;
    this._activeAttack = null;
    this._didStrike = false;
    this._defeatReported = false;
    this._pendingKnockdown = false;
    this._flankSign = opts.flankSign ?? (nextEnemyId % 2 ? 1 : -1);
    this._decisionTime = 0;
    this._attackCount = 0;
    this._animationTime = opts.animationOffset ?? nextEnemyId * 0.37;

    if (this.dead) {
      this.state = 'defeated';
      this.health = 0;
    }
  }

  update(dt, game) {
    if (!Number.isFinite(dt) || dt <= 0 || this.remove) return;
    dt = Math.min(dt, 0.05);
    this._applyDifficulty(game);
    this.stateTime += dt;
    this._animationTime += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this._decisionTime = Math.max(0, this._decisionTime - dt);

    if (this._armorRecovery != null) {
      this._armorRecovery = Math.max(0, this._armorRecovery - dt);
      if (this._armorRecovery === 0 && !this.dead && !['hurt', 'down', 'getup'].includes(this.state)) {
        this.armor = this._baseArmor;
        this._armorRecovery = null;
        game?.spawnImpact?.(this.x, this.y, this.z + this.height * 0.55, 'armorReady', COLORS.gold);
      }
    }

    if (this.dead) {
      this._updateDefeated(dt, game);
      this._integrate(dt, game);
      return;
    }

    switch (this.state) {
      case 'hurt':
        this._updateHurt(dt, game);
        break;
      case 'down':
        this.vx = approach(this.vx, 0, 520 * dt);
        this.vy = approach(this.vy, 0, 520 * dt);
        if (this.stateTime >= (this.type === 'captainMire' ? 0.42 : 0.7)) this._setState('getup');
        break;
      case 'getup':
        this.vx = approach(this.vx, 0, 680 * dt);
        this.vy = approach(this.vy, 0, 680 * dt);
        this.invulnerable = Math.max(this.invulnerable, 0.08);
        if (this.stateTime >= 0.4) this._setState('idle');
        break;
      case 'grabbed':
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
        this.z = 0;
        if (game?.player?.grabbedTarget !== this) this._setState('idle');
        break;
      case 'telegraph':
        this._updateTelegraph(dt, game);
        break;
      case 'attack':
        this._updateAttack(dt, game);
        break;
      case 'recovery':
        this.vx = approach(this.vx, 0, this.profile.acceleration * 0.75 * dt);
        this.vy = approach(this.vy, 0, this.profile.acceleration * 0.75 * dt);
        if (this.stateTime >= (this._activeAttack?.recovery ?? 0.45)) {
          this._activeAttack = null;
          this._setState('idle');
        }
        break;
      case 'phaseChange':
        this._updateSpecialState(dt, game);
        break;
      default:
        this._updateAI(dt, game);
        break;
    }

    this._integrate(dt, game);
  }

  takeHit(attack = {}, source = null, game = null) {
    if (this.dead || this.remove || this.invulnerable > 0) return false;
    const outcome = hitOutcome(attack, this);
    this.health = Math.max(0, this.health - outcome.damage);
    this.hitFlash = 0.09;

    const impactX = this.x - this.facing * this.width * 0.18;
    const impactZ = this.z + this.height * 0.58;
    if (outcome.guarded) {
      game?.spawnImpact?.(impactX, this.y, impactZ, 'armor', COLORS.gold);
      game?.playSound?.('armorHit', { volume: 0.72, pitch: 0.96 });
      game?.addShake?.(1.5);
    } else {
      game?.spawnImpact?.(impactX, this.y, impactZ, outcome.armorBroken ? 'armorBreak' : 'enemyHit',
        outcome.armorBroken ? COLORS.gold : COLORS.ember);
      game?.playSound?.(outcome.armorBroken ? 'armorBreak' : 'enemyHit', {
        volume: outcome.knockdown ? 0.9 : 0.72,
        pitch: this.type === 'brute' || this.type === 'captainMire' ? 0.82 : 1
      });
      game?.addShake?.(outcome.knockdown ? 4 : 2);
    }

    if (outcome.armorBroken) {
      this.armor = 0;
      this._armorRecovery = (this.profile.armorRecovery ?? 0) > 0
        ? this.profile.armorRecovery
        : null;
    }

    const hitDirection = source
      ? signOr(this.x - source.x, source.facing ?? this.facing)
      : -this.facing;
    this.vx = hitDirection * outcome.knockback;
    this.vy += (attack.laneKnockback ?? 0) * (source && this.y < source.y ? -1 : 1);
    this.vz = Math.max(this.vz, outcome.launch);
    this._pendingKnockdown = outcome.knockdown || outcome.launch > 0;
    if (this.profile.role === 'dummy') {
      this.vx = 0;
      this.vy = 0;
      this.vz = 0;
      this._pendingKnockdown = false;
    }

    if (this.health <= 0) {
      this._defeat(source, game, outcome);
    } else if (!outcome.guarded) {
      this._releaseAttackToken(game);
      this._activeAttack = null;
      this.cooldown = Math.max(this.cooldown, 0.18);
      this.invulnerable = Math.max(this.invulnerable, 0.035);
      this._setState('hurt');
      this._hurtDuration = Math.max(0.08, outcome.hitstun);
    }

    return { ...outcome, killed: this.dead, health: this.health };
  }

  draw(ctx, camera = {}, options = {}) {
    if (!ctx || this.remove) return;
    const view = cameraPosition(camera);
    const screenX = this.x - view.x + view.shakeX;
    const groundY = this.y - view.y + view.shakeY;
    const screenY = groundY - this.z;
    const defeatedFade = this.dead ? clamp(1 - Math.max(0, this.stateTime - 0.58) / 0.58, 0, 1) : 1;
    if (defeatedFade <= 0) return;

    ctx.save();
    ctx.globalAlpha *= defeatedFade;
    ctx.fillStyle = 'rgba(2, 11, 8, 0.35)';
    ctx.beginPath();
    ctx.ellipse(screenX, groundY + 3, this.width * 0.66, this.laneSize * 0.36, 0, 0, TAU);
    ctx.fill();

    if (this.state === 'telegraph' && this._activeAttack) {
      this._drawTelegraph(ctx, screenX, groundY, options, view);
    }
    if (this.state === 'recovery' && this.type === 'captainMire') {
      this._drawBossRecoveryCue(ctx, screenX, screenY, groundY, options);
    }

    ctx.translate(screenX, screenY);
    ctx.scale(this.facing, 1);
    const walkAmount = ['idle', 'approach', 'retreat', 'flank'].includes(this.state)
      ? Math.sin(this._animationTime * 10) : 0;
    const hurtLean = this.state === 'hurt' ? -0.18 : 0;
    const recovering = this.state === 'recovery';
    const recoveryLean = recovering ? (this.type === 'captainMire' ? 0.31 : 0.08) : 0;
    const roleLean = this.type === 'rusher' && ['approach', 'flank'].includes(this.state) ? -0.11
      : this.type === 'ranger' && this.state === 'retreat' ? 0.08 : 0;
    ctx.rotate(hurtLean + recoveryLean + roleLean);
    if (recovering) ctx.translate(0, this.type === 'captainMire' ? 18 : 4);
    ctx.translate(0, Math.abs(walkAmount) * -1.8);
    this._drawBody(ctx, options, walkAmount);
    ctx.restore();

    const showHealth = options.showEnemyHealth || (this.type !== 'captainMire' && this.health < this.maxHealth);
    if (showHealth && !this.dead) {
      drawHealthBar(ctx, screenX, screenY - this.height - 17,
        this.type === 'captainMire' ? 118 : Math.max(38, this.width),
        this.health / this.maxHealth,
        this.type === 'captainMire' ? COLORS.gold : COLORS.blood);
    }

    if (options.debug) this._drawDebug(ctx, screenX, groundY, view);
  }

  getHurtbox() {
    const halfWidth = this.width * 0.43;
    const halfLane = this.laneSize * 0.5;
    const visualTop = this.y - this.z - this.height;
    return {
      x: this.x - halfWidth,
      y: visualTop,
      z: this.z,
      w: halfWidth * 2,
      h: this.height,
      width: halfWidth * 2,
      height: this.height,
      lane: this.laneSize,
      left: this.x - halfWidth,
      right: this.x + halfWidth,
      top: visualTop,
      bottom: this.y - this.z,
      laneTop: this.y - halfLane,
      laneBottom: this.y + halfLane,
      zBottom: this.z,
      zTop: this.z + this.height,
      owner: this
    };
  }

  _applyDifficulty(game) {
    if (this._difficultyApplied) return;
    const scale = difficultyValue(game, 'enemyHealth');
    if (scale !== 1) {
      const ratio = this.health / this.maxHealth;
      this.maxHealth = Math.max(1, Math.round(this.maxHealth * scale));
      this.health = Math.max(1, Math.round(this.maxHealth * ratio));
    }
    this._difficultyApplied = true;
  }

  _setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  _releaseAttackToken(game) {
    if (this.attackToken == null) return;
    game?.releaseAttackToken?.(this);
    this.attackToken = null;
  }

  _claimAttackToken(game) {
    if (!entityOnScreen(game, this, 72)) return false;
    if (typeof game?.canEnemyAttack === 'function' && !game.canEnemyAttack(this)) return false;
    if (typeof game?.claimAttackToken === 'function') {
      const token = game.claimAttackToken(this);
      if (token === false) return false;
      this.attackToken = token ?? true;
    } else {
      this.attackToken = true;
    }
    return true;
  }

  _startAttack(key, game) {
    const attack = this.profile.attacks[key];
    if (!attack || this.cooldown > 0 || !this._claimAttackToken(game)) return false;
    const target = game?.player;
    this._activeAttack = { ...attack, key };
    this._didStrike = false;
    this.telegraphTarget = target ? {
      x: target.x,
      y: target.y,
      z: target.z ?? 0
    } : { x: this.x + this.facing * (attack.reach ?? 90), y: this.y, z: 0 };
    if (target && Math.abs(target.x - this.x) > 3) this.facing = signOr(target.x - this.x, this.facing);
    this.vx = 0;
    this.vy = 0;
    this._setState('telegraph');
    game?.playSound?.('enemyTelegraph', {
      volume: this.type === 'captainMire' ? 0.78 : 0.5,
      pitch: this.type === 'brute' ? 0.78 : 1.04
    });
    return true;
  }

  _updateTelegraph(dt, game) {
    const attack = this._activeAttack;
    if (!attack) {
      this._releaseAttackToken(game);
      this._setState('idle');
      return;
    }
    this.vx = approach(this.vx, 0, this.profile.acceleration * 1.4 * dt);
    this.vy = approach(this.vy, 0, this.profile.acceleration * 1.4 * dt);
    if (!entityOnScreen(game, this, 90)) {
      this._cancelAttack(game, 0.2);
      return;
    }
    if (this.stateTime >= attack.telegraph) {
      this._setState('attack');
      if ((attack.hitAt ?? 0) === 0) this._strike(game);
    }
  }

  _updateAttack(dt, game) {
    const attack = this._activeAttack;
    if (!attack) {
      this._releaseAttackToken(game);
      this._setState('idle');
      return;
    }
    if (attack.movement) {
      this.vx = this.facing * attack.movement;
      this.vy = approach(this.vy, 0, this.profile.acceleration * dt);
    } else {
      this.vx = approach(this.vx, 0, this.profile.acceleration * dt);
      this.vy = approach(this.vy, 0, this.profile.acceleration * dt);
    }
    if (!this._didStrike && this.stateTime >= (attack.hitAt ?? 0.04)) this._strike(game);
    if (this.stateTime >= attack.active) this._enterRecovery(game);
  }

  _strike(game) {
    if (this._didStrike) return;
    this._didStrike = true;
    const attack = this._activeAttack;
    if (!attack || !entityOnScreen(game, this, 96)) return;
    const damage = Math.max(1, Math.round(
      attack.damage * this.damageScale * difficultyValue(game, 'enemyDamage')
    ));
    if (attack.projectileSpeed) {
      this._fireProjectile(game, attack, damage);
    } else {
      const spec = { ...attack, damage, attackerType: this.type };
      game?.performAttack?.(this, spec);
      if (attack.shake) game?.addShake?.(attack.shake);
    }
    game?.playSound?.(attack.sound ?? 'enemySwing', {
      volume: this.type === 'captainMire' ? 0.95 : 0.68,
      pitch: this.type === 'brute' ? 0.82 : 1
    });
  }

  _fireProjectile(game, attack, damage) {
    const target = this.telegraphTarget || game?.player || { x: this.x + this.facing * 200, y: this.y, z: 0 };
    const startX = this.x + this.facing * (this.width * 0.48 + 8);
    const startY = this.y;
    const startZ = this.z + this.height * 0.66;
    const dx = target.x - startX;
    const dy = target.y - startY;
    const planarDistance = Math.max(1, Math.hypot(dx, dy));
    const speed = attack.projectileSpeed;
    const flightTime = planarDistance / speed;
    const projectile = new Projectile(
      this.type === 'captainMire' ? 'mirelight' : 'mudpot',
      startX,
      startY,
      {
        z: startZ,
        vx: dx / planarDistance * speed,
        vy: dy / planarDistance * speed,
        vz: ((target.z ?? 0) + 42 - startZ) / Math.max(0.15, flightTime),
        owner: this,
        damage,
        hitstun: attack.hitstun,
        knockback: attack.knockback,
        color: attack.color,
        life: clamp(flightTime + 0.7, 0.8, 2.2)
      }
    );
    game?.spawnProjectile?.(projectile);
  }

  _enterRecovery(game) {
    const attack = this._activeAttack;
    this._releaseAttackToken(game);
    this.cooldown = Math.max(this.cooldown,
      (attack?.cooldown ?? 0.4) / (difficultyValue(game, 'aggression') * this.aggressionScale));
    this._attackCount += 1;
    this._setState('recovery');
  }

  _cancelAttack(game, cooldown = 0.25) {
    this._releaseAttackToken(game);
    this._activeAttack = null;
    this.cooldown = Math.max(this.cooldown, cooldown);
    this._setState('idle');
  }

  _updateAI(dt, game) {
    const target = game?.player;
    if (!target || target.dead) {
      this.vx = approach(this.vx, 0, this.profile.acceleration * dt);
      this.vy = approach(this.vy, 0, this.profile.acceleration * dt);
      this._setState('idle');
      return;
    }
    if (this.profile.role === 'dummy') {
      this.vx = approach(this.vx, 0, 900 * dt);
      this.vy = approach(this.vy, 0, 900 * dt);
      this.state = 'idle';
      return;
    }

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX > 4) this.facing = signOr(dx, this.facing);

    switch (this.profile.role) {
      case 'rusher':
        this._updateRusherAI(dt, game, target, absX, absY);
        break;
      case 'ranged':
        this._updateRangerAI(dt, game, target, absX, absY);
        break;
      case 'brute':
        this._updateBruteAI(dt, game, target, absX, absY);
        break;
      default:
        this._updateGruntAI(dt, game, target, absX, absY);
        break;
    }
  }

  _updateGruntAI(dt, game, target, absX, absY) {
    const laneTarget = clamp(target.y + this._flankSign * 24, LANE_TOP, LANE_BOTTOM);
    if (absX <= 75 && absY <= 36 && this.cooldown <= 0) {
      const key = this._attackCount % 3 === 2 ? 'shove' : 'jab';
      if (this._startAttack(key, game)) return;
    }
    const stopX = target.x - signOr(target.x - this.x, this.facing) * 58;
    this._steerToward(stopX, laneTarget, this.profile.speed * this.speedScale, dt);
    this.state = absY > 42 ? 'flank' : 'approach';
  }

  _updateRusherAI(dt, game, target, absX, absY) {
    if (absX <= 116 && absY <= 31 && this.cooldown <= 0) {
      const key = this._attackCount % 4 === 3 ? 'crosscut' : 'lunge';
      if (this._startAttack(key, game)) return;
    }
    const sideOffset = absX > 175 ? this._flankSign * 44 : this._flankSign * 12;
    const laneTarget = clamp(target.y + sideOffset, LANE_TOP, LANE_BOTTOM);
    const stopX = target.x - signOr(target.x - this.x, this.facing) * 82;
    this._steerToward(stopX, laneTarget, this.profile.speed * this.speedScale, dt);
    this.state = absY > 34 ? 'flank' : 'approach';
  }

  _updateRangerAI(dt, game, target, absX, absY) {
    const signedAway = signOr(this.x - target.x, -this.facing);
    const desiredLane = clamp(target.y + this._flankSign * 54, LANE_TOP, LANE_BOTTOM);
    if (absX < 165) {
      this._steerToward(this.x + signedAway * 150, desiredLane, this.profile.speed * this.speedScale * 1.12, dt);
      this.state = 'retreat';
      return;
    }
    if (absX > 365 || absY > 82) {
      const stopX = target.x + signedAway * 270;
      this._steerToward(stopX, desiredLane, this.profile.speed * this.speedScale, dt);
      this.state = absY > 70 ? 'flank' : 'approach';
      return;
    }
    this.vx = approach(this.vx, 0, this.profile.acceleration * dt);
    this.vy = approach(this.vy, 0, this.profile.acceleration * dt);
    this.state = 'idle';
    if (this.cooldown <= 0) this._startAttack('sling', game);
  }

  _updateBruteAI(dt, game, target, absX, absY) {
    if (absX <= 108 && absY <= 52 && this.cooldown <= 0) {
      const key = this._attackCount % 3 === 2 ? 'stomp' : 'hammer';
      if (this._startAttack(key, game)) return;
    }
    const stopX = target.x - signOr(target.x - this.x, this.facing) * 82;
    this._steerToward(stopX, target.y, this.profile.speed * this.speedScale, dt);
    this.state = 'approach';
  }

  _steerToward(targetX, targetY, speed, dt) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const weightedLength = Math.max(1, Math.hypot(dx, dy * 1.25));
    const desiredVx = Math.abs(dx) < 3 ? 0 : dx / weightedLength * speed;
    const desiredVy = Math.abs(dy) < 2 ? 0 : dy / weightedLength * speed;
    this.vx = approach(this.vx, desiredVx, this.profile.acceleration * dt);
    this.vy = approach(this.vy, desiredVy, this.profile.acceleration * dt);
    if (Math.abs(dx) > 5) this.facing = signOr(dx, this.facing);
  }

  _updateHurt(dt, game) {
    this.vx = approach(this.vx, 0, 460 * dt);
    this.vy = approach(this.vy, 0, 460 * dt);
    if (this.stateTime >= (this._hurtDuration ?? 0.16) && this.z <= 0) {
      if (this._pendingKnockdown) {
        this._pendingKnockdown = false;
        this._setState('down');
      } else {
        this._setState('idle');
      }
    }
  }

  _updateSpecialState(dt, game) {
    this.vx = approach(this.vx, 0, this.profile.acceleration * dt);
    this.vy = approach(this.vy, 0, this.profile.acceleration * dt);
    if (this.stateTime >= 0.8) this._setState('idle');
  }

  _integrate(dt, game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.z > 0 || this.vz !== 0) {
      this.z += this.vz * dt;
      this.vz -= GRAVITY * dt;
      if (this.z <= 0) {
        const landedHard = this.vz < -380;
        this.z = 0;
        this.vz = 0;
        if (landedHard) game?.spawnImpact?.(this.x, this.y, 0, 'land', '#c6b47a');
        if (!this.dead && this._pendingKnockdown && this.state === 'hurt') {
          this._pendingKnockdown = false;
          this._setState('down');
        }
      }
    }

    const bounds = worldEdges(game);
    const inset = this.width * 0.25;
    this.x = clamp(this.x, bounds.left + inset, bounds.right - inset);
    this.y = clamp(this.y, bounds.top, bounds.bottom);
  }

  _defeat(source, game, outcome) {
    this.health = 0;
    this.dead = true;
    this.invulnerable = 99;
    this._releaseAttackToken(game);
    this._activeAttack = null;
    this._pendingKnockdown = false;
    this._setState('defeated');
    this.vz = Math.max(this.vz, outcome.launch || (outcome.knockdown ? 150 : 70));
    this.vx *= 1.18;
    game?.playSound?.(this.type === 'captainMire' ? 'bossDefeated' : 'enemyDefeated', {
      volume: this.type === 'captainMire' ? 1 : 0.78,
      pitch: this.type === 'brute' ? 0.76 : 1
    });
    if (!this._defeatReported) {
      this._defeatReported = true;
      game?.onEnemyDefeated?.(this, source);
      game?.dropPickup?.(this.x, this.y, this.profile.pickupChance ?? 0);
    }
  }

  _updateDefeated(dt, game) {
    this.vx = approach(this.vx, 0, 260 * dt);
    this.vy = approach(this.vy, 0, 260 * dt);
    if (this.stateTime >= (this.type === 'captainMire' ? 2 : 1.16) && this.z === 0) this.remove = true;
  }

  _drawTelegraph(ctx, screenX, groundY, options, view) {
    const attack = this._activeAttack;
    const progress = clamp(this.stateTime / Math.max(0.01, attack.telegraph), 0, 1);
    const pulse = options.reducedMotion ? 0 : Math.sin(progress * Math.PI * 6) * 0.06;
    const reach = attack.radius ?? (attack.movement
      ? (attack.reach ?? 0) + attack.movement * attack.active
      : attack.reach ?? 260);
    ctx.save();
    const bossWarning = this.type === 'captainMire';
    ctx.globalAlpha = (bossWarning ? 0.34 : 0.2) + progress * (bossWarning ? 0.58 : 0.48) + pulse;
    ctx.strokeStyle = options.highContrast ? '#ffffff' : (attack.color ?? (bossWarning ? '#ff9d42' : COLORS.ember));
    ctx.fillStyle = options.highContrast ? 'rgba(255,255,255,0.2)' : (bossWarning ? '#ff6f2c' : 'rgba(255, 91, 58, 0.13)');
    ctx.lineWidth = (bossWarning ? 3.5 : 2) + progress * 2;
    if (bossWarning) {
      ctx.shadowColor = '#ff7a2f';
      ctx.shadowBlur = 8;
    }
    ctx.setLineDash(bossWarning ? [] : [8, 7]);
    if (attack.radial) {
      ctx.beginPath();
      ctx.ellipse(screenX, groundY, reach, (attack.lane ?? reach) * 0.48, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (attack.projectileSpeed) {
      const targetX = (this.telegraphTarget?.x ?? this.x + this.facing * 280) - view.x + view.shakeX;
      const targetY = (this.telegraphTarget?.y ?? this.y) - view.y + view.shakeY;
      ctx.beginPath();
      ctx.moveTo(screenX, groundY - this.height * 0.55);
      ctx.lineTo(targetX, targetY - 38);
      ctx.stroke();
    } else {
      const direction = this.facing;
      ctx.beginPath();
      ctx.moveTo(screenX, groundY);
      ctx.lineTo(screenX + direction * reach, groundY - (attack.lane ?? 36) * 0.45);
      ctx.lineTo(screenX + direction * reach, groundY + (attack.lane ?? 36) * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (bossWarning) {
        ctx.fillStyle = options.highContrast ? '#ffffff' : '#fff0a8';
        ctx.shadowBlur = 0;
        for (const amount of [0.36, 0.68]) {
          const markerX = screenX + direction * reach * amount;
          ctx.beginPath();
          ctx.moveTo(markerX + direction * 13, groundY);
          ctx.lineTo(markerX - direction * 8, groundY - 9);
          ctx.lineTo(markerX - direction * 8, groundY + 9);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawBossRecoveryCue(ctx, screenX, screenY, groundY, options) {
    const duration = Math.max(0.01, this._activeAttack?.recovery ?? 0.6);
    const progress = clamp(this.stateTime / duration, 0, 1);
    const pulse = options.reducedMotion ? 0 : Math.sin(progress * Math.PI * 4) * 0.07;
    ctx.save();
    ctx.globalAlpha = 0.72 + pulse;
    ctx.strokeStyle = options.highContrast ? '#ffffff' : '#b9ff9c';
    ctx.fillStyle = options.highContrast ? 'rgba(255,255,255,0.12)' : 'rgba(80, 218, 146, 0.18)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(screenX, groundY + 2, 70, 27, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = options.highContrast ? '#ffffff' : '#ffe183';
    for (let i = 0; i < 3; i++) {
      const x = screenX - 30 + i * 30;
      const y = screenY - this.height - 17 - (i % 2) * 8;
      const radius = i === 1 ? 6 : 4.5;
      ctx.beginPath();
      for (let point = 0; point < 10; point++) {
        const angle = -Math.PI / 2 + point * Math.PI / 5;
        const r = point % 2 ? radius * 0.42 : radius;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (point === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  _drawBody(ctx, options, walkAmount) {
    const profile = this.profile;
    const flash = this.hitFlash > 0 && options.hitFlash !== false;
    const body = flash ? '#fff7d6' : (options.highContrast ? '#f6f1d3' : profile.body);
    const trim = options.highContrast ? '#ffcf43' : profile.trim;
    const w = this.width;
    const h = this.height;
    const attacking = this.state === 'attack';
    const telegraphing = this.state === 'telegraph';
    const recovering = this.state === 'recovery';
    const armReach = attacking ? w * 0.75 : telegraphing ? -w * 0.32 : recovering ? w * 0.1 : w * 0.28;
    const armHeight = attacking ? 0.59 : recovering ? 0.27 : telegraphing ? 0.72 : 0.43;

    if (this.type === 'dummy') {
      ctx.fillStyle = '#60482e';
      ctx.fillRect(-6, -h * 0.82, 12, h * 0.82);
      ctx.fillStyle = body;
      roundedRect(ctx, -w / 2, -h, w, h * 0.54, 9);
      ctx.fill();
      ctx.strokeStyle = trim;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 3, -h * 0.68);
      ctx.lineTo(w / 2 - 3, -h * 0.68);
      ctx.stroke();
      ctx.fillStyle = '#3b2a1d';
      ctx.beginPath();
      ctx.arc(-8, -h * 0.82, 3, 0, TAU);
      ctx.arc(8, -h * 0.82, 3, 0, TAU);
      ctx.fill();
      return;
    }

    ctx.strokeStyle = '#15231d';
    ctx.lineCap = 'round';
    ctx.lineWidth = this.type === 'brute' || this.type === 'captainMire' ? 11 : 8;
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, -h * 0.35);
    ctx.lineTo(-w * 0.24 + walkAmount * 2, -3);
    ctx.moveTo(w * 0.18, -h * 0.35);
    ctx.lineTo(w * 0.25 - walkAmount * 2, -3);
    ctx.stroke();

    ctx.fillStyle = body;
    roundedRect(ctx, -w * 0.44, -h * 0.76, w * 0.88, h * 0.48, w * 0.17);
    ctx.fill();
    ctx.strokeStyle = '#1a2821';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = body;
    ctx.lineWidth = this.type === 'brute' || this.type === 'captainMire' ? 13 : 9;
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, -h * 0.67);
    ctx.lineTo(-w * 0.58, -h * 0.42);
    ctx.moveTo(w * 0.34, -h * 0.67);
    ctx.lineTo(armReach, -h * armHeight);
    ctx.stroke();

    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, -h * 0.86, w * 0.27, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#1a2821';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = trim;
    if (this.type === 'ranger') {
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.94, w * 0.48, 6, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(-w * 0.2, -h * 1.03, w * 0.4, h * 0.1);
      ctx.strokeStyle = '#e4d2a3';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-w * 0.34, -h * 0.43);
      ctx.lineTo(w * 0.63, -h * 0.82);
      ctx.moveTo(w * 0.63, -h * 0.82);
      ctx.lineTo(w * 0.82, -h * 0.94);
      ctx.moveTo(w * 0.63, -h * 0.82);
      ctx.lineTo(w * 0.86, -h * 0.72);
      ctx.stroke();
      ctx.fillStyle = trim;
      ctx.beginPath();
      ctx.arc(-w * 0.42, -h * 0.46, w * 0.17, 0, TAU);
      ctx.fill();
    } else if (this.type === 'rusher') {
      ctx.fillRect(-w * 0.3, -h * 0.92, w * 0.6, 7);
      ctx.beginPath();
      ctx.moveTo(-w * 0.26, -h * 0.89);
      ctx.lineTo(-w * 0.55, -h * 0.75);
      ctx.lineTo(-w * 0.25, -h * 0.78);
      ctx.fill();
      ctx.fillStyle = '#d9e7d7';
      for (const y of [-0.66, -0.49]) {
        ctx.beginPath();
        ctx.moveTo(w * 0.42, h * y);
        ctx.lineTo(w * 0.95, h * (y + 0.05));
        ctx.lineTo(w * 0.46, h * (y + 0.14));
        ctx.closePath();
        ctx.fill();
      }
    } else if (this.type === 'brute') {
      ctx.fillRect(-w * 0.48, -h * 0.72, w * 0.96, 10);
      ctx.fillStyle = trim;
      ctx.strokeStyle = '#1a2821';
      ctx.lineWidth = 4;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(side * w * 0.48, -h * 0.67, w * 0.23, h * 0.14, side * 0.18, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      if (this.armor > 0) {
        ctx.strokeStyle = COLORS.gold;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -h * 0.56, w * 0.48, Math.PI * 0.9, Math.PI * 2.1);
        ctx.stroke();
      }
    } else if (this.type === 'captainMire') {
      ctx.fillRect(-w * 0.39, -h * 0.73, w * 0.78, 7);
      ctx.beginPath();
      ctx.moveTo(-w * 0.48, -h * 0.96);
      ctx.quadraticCurveTo(0, -h * 1.15, w * 0.5, -h * 0.96);
      ctx.lineTo(w * 0.32, -h * 0.86);
      ctx.lineTo(-w * 0.33, -h * 0.86);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#18251e';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = trim;
      ctx.lineWidth = 6;
      ctx.beginPath();
      if (telegraphing) {
        ctx.moveTo(w * 0.25, -h * 0.68);
        ctx.lineTo(-w * 0.5, -h * 0.98);
      } else if (attacking) {
        ctx.moveTo(w * 0.42, -h * 0.59);
        ctx.lineTo(w * 1.03, -h * 0.62);
      } else if (recovering) {
        ctx.moveTo(w * 0.12, -h * 0.28);
        ctx.lineTo(w * 0.62, h * 0.01);
      } else {
        ctx.moveTo(w * 0.39, -h * 0.58);
        ctx.lineTo(w * 0.78, -h * 0.66);
      }
      ctx.stroke();
      if (telegraphing) {
        ctx.globalAlpha *= 0.72;
        ctx.strokeStyle = '#ff9d42';
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.arc(0, -h * 0.62, w * 0.74, Math.PI * 1.03, Math.PI * 1.48);
        ctx.stroke();
      }
    } else {
      ctx.fillRect(-w * 0.3, -h * 0.75, w * 0.6, 6);
      ctx.strokeStyle = '#d6bd83';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-w * 0.32, -h * 0.34);
      ctx.lineTo(-w * 0.72, -h * 0.98);
      ctx.arc(-w * 0.56, -h * 1.01, w * 0.17, Math.PI * 0.96, Math.PI * 1.9);
      ctx.stroke();
    }

    ctx.fillStyle = '#f2e6bf';
    ctx.beginPath();
    ctx.arc(w * 0.1, -h * 0.87, 2.4, 0, TAU);
    ctx.fill();
  }

  _drawDebug(ctx, screenX, groundY) {
    const box = this.getHurtbox();
    ctx.save();
    ctx.strokeStyle = '#5ee7ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX - box.width / 2, groundY - this.z - box.height, box.width, box.height);
    ctx.fillStyle = 'rgba(8, 20, 17, 0.86)';
    const label = `${this.type} ${this.state} ${Math.ceil(this.health)}/${this.maxHealth}`;
    ctx.font = '11px monospace';
    const width = ctx.measureText(label).width + 8;
    ctx.fillRect(screenX - width / 2, groundY - this.z - box.height - 33, width, 16);
    ctx.fillStyle = '#f4e8c9';
    ctx.textAlign = 'center';
    ctx.fillText(label, screenX, groundY - this.z - box.height - 21);
    if (this.attackToken != null) {
      ctx.fillStyle = COLORS.ember;
      ctx.beginPath();
      ctx.arc(screenX, groundY - this.z - box.height - 40, 4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

export class Boss extends Enemy {
  constructor(type, x, y, opts = {}) {
    if (typeof type === 'number') {
      opts = y && typeof y === 'object' ? y : (opts || {});
      y = x;
      x = type;
      type = 'captainMire';
    }
    super(type === 'captainMire' ? type : 'captainMire', x, y, opts);
    this.name = 'Captain Mire';
    this.phase = opts.phase ?? 1;
    this.phaseName = ['Sounding the Depths', 'Rising Mire', 'Last Light'][this.phase - 1];
    this._patternIndex = opts.patternIndex ?? 0;
    this._phaseAnnounced = this.phase;
    this._phasePulseDone = false;
    this._armorSuppressed = 0;
  }

  update(dt, game) {
    if (!this.dead && !this.remove) {
      const healthRatio = this.health / Math.max(1, this.maxHealth);
      const desiredPhase = healthRatio <= 0.34 ? 3 : healthRatio <= 0.67 ? 2 : 1;
      if (desiredPhase > this.phase && this.state !== 'phaseChange') this._beginPhase(desiredPhase, game);
      this._armorSuppressed = Math.max(0, this._armorSuppressed - Math.max(0, dt || 0));
      const chargeArmor = this.state === 'telegraph' && this._activeAttack?.key === 'charge';
      this.armor = chargeArmor && this._armorSuppressed <= 0 ? 1 : 0;
    }
    super.update(dt, game);
  }

  takeHit(attack = {}, source = null, game = null) {
    const result = super.takeHit(attack, source, game);
    if (result?.armorBroken) this._armorSuppressed = 1.1;
    return result;
  }

  _beginPhase(phase, game) {
    this.phase = phase;
    this.phaseName = ['Sounding the Depths', 'Rising Mire', 'Last Light'][phase - 1];
    this._phaseAnnounced = phase;
    this._phasePulseDone = false;
    this._activeAttack = null;
    this._releaseAttackToken(game);
    this.invulnerable = Math.max(this.invulnerable, 1.05);
    this.vx = 0;
    this.vy = 0;
    this._setState('phaseChange');
    game?.playSound?.('bossPhase', { volume: 1, pitch: phase === 3 ? 1.08 : 0.92 });
    game?.addShake?.(5);
  }

  _updateSpecialState(dt, game) {
    this.vx = approach(this.vx, 0, this.profile.acceleration * dt);
    this.vy = approach(this.vy, 0, this.profile.acceleration * dt);
    if (!this._phasePulseDone && this.stateTime >= 0.48) {
      this._phasePulseDone = true;
      game?.spawnImpact?.(this.x, this.y, 0, 'mirePulse', this.phase === 3 ? COLORS.ember : COLORS.gold);
      game?.addShake?.(7);
    }
    if (this.stateTime >= 1.05) {
      this.invulnerable = 0;
      this.cooldown = 0.3;
      this._setState('idle');
    }
  }

  _updateAI(dt, game) {
    const target = game?.player;
    if (!target || target.dead) {
      this.vx = approach(this.vx, 0, this.profile.acceleration * dt);
      this.vy = approach(this.vy, 0, this.profile.acceleration * dt);
      return;
    }
    const patterns = {
      1: ['cleave', 'cleave', 'volley'],
      2: ['charge', 'cleave', 'volley', 'slam'],
      3: ['volley', 'charge', 'slam', 'cleave', 'slam']
    };
    const pattern = patterns[this.phase];
    const key = pattern[this._patternIndex % pattern.length];
    const dx = target.x - this.x;
    const absX = Math.abs(dx);
    const absY = Math.abs(target.y - this.y);
    if (absX > 4) this.facing = signOr(dx, this.facing);

    const ready = this.cooldown <= 0;
    const canStart = key === 'volley'
      ? absX >= 135 && absX <= 470 && absY <= 100
      : key === 'charge'
        ? absX >= 105 && absX <= 390 && absY <= 44
        : key === 'slam'
          ? absX <= 122 && absY <= 80
          : absX <= 126 && absY <= 50;
    if (ready && canStart && this._startAttack(key, game)) {
      this._patternIndex += 1;
      return;
    }

    let desiredDistance = key === 'volley' ? 275 : key === 'charge' ? 235 : key === 'slam' ? 72 : 92;
    const direction = signOr(dx, this.facing);
    const targetX = target.x - direction * desiredDistance;
    const laneOffset = key === 'volley' ? (this._patternIndex % 2 ? 58 : -58) : 0;
    const targetY = clamp(target.y + laneOffset, LANE_TOP, LANE_BOTTOM);
    const phaseSpeed = this.profile.speed * (1 + (this.phase - 1) * 0.12);
    this._steerToward(targetX, targetY, phaseSpeed, dt);
    this.state = Math.abs(targetY - this.y) > 42 ? 'flank' : 'approach';
  }

  _fireProjectile(game, attack, damage) {
    const target = this.telegraphTarget || game?.player || { x: this.x + this.facing * 260, y: this.y, z: 0 };
    const spreads = this.phase === 1 ? [0] : this.phase === 2 ? [-34, 34] : [-52, 0, 52];
    for (const laneSpread of spreads) {
      const startX = this.x + this.facing * (this.width * 0.48 + 10);
      const startY = this.y;
      const startZ = this.z + this.height * 0.7;
      const dx = target.x - startX;
      const dy = target.y + laneSpread - startY;
      const planarDistance = Math.max(1, Math.hypot(dx, dy));
      const speed = attack.projectileSpeed + (this.phase - 1) * 18;
      const flightTime = planarDistance / speed;
      game?.spawnProjectile?.(new Projectile('mirelight', startX, startY, {
        z: startZ,
        vx: dx / planarDistance * speed,
        vy: dy / planarDistance * speed,
        vz: ((target.z ?? 0) + 42 - startZ) / Math.max(0.15, flightTime),
        owner: this,
        damage,
        hitstun: attack.hitstun,
        knockback: attack.knockback,
        color: attack.color,
        radius: 12,
        life: clamp(flightTime + 0.75, 0.85, 2.3)
      }));
    }
  }

  _drawBody(ctx, options, walkAmount) {
    super._drawBody(ctx, options, walkAmount);
    if (this.state === 'phaseChange') {
      const progress = clamp(this.stateTime / 1.05, 0, 1);
      ctx.save();
      ctx.globalAlpha = (1 - progress) * 0.75;
      ctx.strokeStyle = this.phase === 3 ? COLORS.ember : COLORS.gold;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, -this.height * 0.5, 34 + progress * 62, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
}

export class Projectile {
  constructor(type, x, y, opts = {}) {
    this.id = opts.id ?? `projectile-${nextProjectileId++}`;
    this.type = type || 'enemyProjectile';
    this.name = opts.name ?? (this.type === 'mirelight' ? 'Mirelight' : 'Mudpot');
    this.x = Number.isFinite(x) ? x : 0;
    this.y = Number.isFinite(y) ? y : 0;
    this.z = opts.z ?? 42;
    this.vx = opts.vx ?? 0;
    this.vy = opts.vy ?? 0;
    this.vz = opts.vz ?? 0;
    this.facing = opts.facing ?? signOr(this.vx, 1);
    this.state = 'flying';
    this.stateTime = 0;
    this.health = 1;
    this.maxHealth = 1;
    this.dead = false;
    this.remove = false;
    this.invulnerable = 0;
    this.armor = 0;
    this.attackToken = null;

    this.owner = opts.owner ?? null;
    this.damage = opts.damage ?? 8;
    this.hitstun = opts.hitstun ?? 0.18;
    this.knockback = opts.knockback ?? 105;
    this.knockdown = Boolean(opts.knockdown);
    this.radius = opts.radius ?? (this.type === 'mirelight' ? 11 : 9);
    this.laneRadius = opts.laneRadius ?? 18;
    this.heightRadius = opts.heightRadius ?? 34;
    this.color = opts.color ?? (this.type === 'mirelight' ? '#c0ff72' : '#8fe0c6');
    this.life = opts.life ?? 1.8;
    this.gravity = opts.gravity ?? 0;
    this._rotation = opts.rotation ?? 0;
  }

  update(dt, game) {
    if (!Number.isFinite(dt) || dt <= 0 || this.remove) return;
    dt = Math.min(dt, 0.05);
    this.stateTime += dt;
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    this.vz -= this.gravity * dt;
    this._rotation += dt * signOr(this.vx, 1) * 8;

    if (this.life <= 0 || this.z < -30) {
      this.remove = true;
      return;
    }
    const bounds = worldEdges(game);
    if (this.x < bounds.left - 120 || this.x > bounds.right + 120 ||
      this.y < bounds.top - 100 || this.y > bounds.bottom + 100) {
      this.remove = true;
      return;
    }

    const player = game?.player;
    if (!player || player.dead || player.invulnerable > 0 || !entityOnScreen(game, this, 32)) return;
    const playerBox = player.getHurtbox?.();
    const playerZ = player.z ?? 0;
    const playerHeight = player.height ?? playerBox?.height ?? playerBox?.h ?? 78;
    const playerWidth = player.width ?? playerBox?.width ?? playerBox?.w ?? 38;
    const connects = Math.abs(player.x - this.x) <= this.radius + playerWidth * 0.42 &&
      Math.abs(player.y - this.y) <= this.laneRadius + (player.laneSize ?? 26) * 0.5 &&
      this.z >= playerZ - this.heightRadius && this.z <= playerZ + playerHeight + this.heightRadius * 0.25;
    if (!connects) return;

    const attack = {
      name: this.name,
      damage: this.damage,
      hitstun: this.hitstun,
      knockback: this.knockback,
      knockdown: this.knockdown,
      projectile: true
    };
    if (typeof player.takeHit === 'function') {
      player.takeHit(attack, this.owner ?? this, game);
    } else {
      game?.performAttack?.(this, { ...attack, reach: this.radius * 2, behind: this.radius * 2, lane: this.laneRadius });
    }
    game?.spawnImpact?.(this.x, this.y, this.z, 'projectileHit', this.color);
    game?.playSound?.('projectileHit', { volume: 0.7, pitch: this.type === 'mirelight' ? 1.08 : 0.92 });
    this.dead = true;
    this.state = 'spent';
    this.remove = true;
  }

  takeHit(attack = {}, source = null, game = null) {
    if (this.remove || this.dead) return false;
    this.health = 0;
    this.dead = true;
    this.state = 'spent';
    this.remove = true;
    game?.spawnImpact?.(this.x, this.y, this.z, 'projectileBreak', this.color);
    game?.playSound?.('projectileBreak', { volume: 0.55, pitch: 1.18 });
    return { damage: 1, killed: true, reflectedBy: source ?? null, attack };
  }

  draw(ctx, camera = {}, options = {}) {
    if (!ctx || this.remove) return;
    const view = cameraPosition(camera);
    const x = this.x - view.x + view.shakeX;
    const y = this.y - view.y - this.z + view.shakeY;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this._rotation);
    if (!options.reducedMotion) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.ellipse(-signOr(this.vx, 1) * 12, 0, this.radius * 1.7, this.radius * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = options.highContrast ? '#ffffff' : this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#173025';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(-this.radius * 0.25, -this.radius * 0.3, this.radius * 0.28, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (options.debug) {
      ctx.strokeStyle = '#b79cff';
      ctx.strokeRect(x - this.radius, y - this.radius, this.radius * 2, this.radius * 2);
    }
  }

  getHurtbox() {
    const visualY = this.y - this.z - this.radius;
    return {
      x: this.x - this.radius,
      y: visualY,
      z: this.z - this.radius,
      w: this.radius * 2,
      h: this.radius * 2,
      width: this.radius * 2,
      height: this.radius * 2,
      lane: this.laneRadius * 2,
      left: this.x - this.radius,
      right: this.x + this.radius,
      top: visualY,
      bottom: visualY + this.radius * 2,
      laneTop: this.y - this.laneRadius,
      laneBottom: this.y + this.laneRadius,
      zBottom: this.z - this.radius,
      zTop: this.z + this.radius,
      owner: this
    };
  }
}
