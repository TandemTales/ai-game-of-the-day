import { clamp, radialConnects, signOr } from './core.js';

let worldId = 1;

export class BreakableProp {
  constructor(type, x, y, options = {}) {
    this.id = `prop-${worldId++}`;
    this.type = type;
    this.name = type === 'barrel' ? 'Powder Barrel' : 'Supply Crate';
    this.x = x;
    this.y = y;
    this.z = 0;
    this.health = type === 'barrel' ? 28 : 36;
    this.maxHealth = this.health;
    this.dead = false;
    this.remove = false;
    this.flash = 0;
    this.wobble = 0;
    this.explosive = type === 'barrel';
    this.drop = options.drop || (type === 'crate' ? 'random' : null);
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.wobble = Math.max(0, this.wobble - dt * 7);
  }

  takeHit(attack, source, game) {
    if (this.dead) return false;
    const damage = Math.max(1, attack.damage || 1);
    this.health -= damage;
    this.flash = 0.08;
    this.wobble = 1;
    game.spawnImpact(this.x, this.y, 45, damage >= 18 ? 'heavy' : 'light', '#e2ba72');
    game.playSound(damage >= 18 ? 'hitHeavy' : 'hitLight', { pitch: 0.72 });
    if (this.health <= 0) this.break(source, game);
    return true;
  }

  break(source, game) {
    this.dead = true;
    this.remove = true;
    game.spawnImpact(this.x, this.y, 35, this.explosive ? 'explosion' : 'debris', this.explosive ? '#ff7043' : '#c28d52');
    if (this.explosive) {
      game.playSound('special', { pitch: 0.58, volume: 1.2 });
      game.addShake(12);
      game.environmentBlast(this.x, this.y, source, 180, 28);
    } else {
      game.playSound('hitHeavy', { pitch: 0.62 });
      game.dropPickup(this.x, this.y, 1, this.drop);
    }
  }

  draw(ctx, camera, options = {}) {
    const x = this.x - camera.x;
    const y = this.y - camera.y;
    const wobble = Math.sin(this.wobble * Math.PI * 3) * 0.08;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(wobble);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(0, 5, 35, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = options.highContrast ? '#fff7d6' : '#101510';
    ctx.lineWidth = options.highContrast ? 6 : 4;
    if (this.type === 'barrel') {
      const gradient = ctx.createLinearGradient(-24, -70, 25, -20);
      gradient.addColorStop(0, this.flash ? '#fff' : '#9b3f2d');
      gradient.addColorStop(.5, this.flash ? '#fff' : '#c75a34');
      gradient.addColorStop(1, this.flash ? '#fff' : '#642b25');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.roundRect(-24, -68, 48, 68, 13); ctx.stroke(); ctx.fill();
      ctx.strokeStyle = '#36251b'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(-23, -54); ctx.lineTo(23, -54); ctx.moveTo(-24, -14); ctx.lineTo(24, -14); ctx.stroke();
      ctx.fillStyle = '#f4b942';
      ctx.beginPath(); ctx.moveTo(-6, -47); ctx.lineTo(8, -47); ctx.lineTo(2, -34); ctx.lineTo(12, -34); ctx.lineTo(-5, -16); ctx.lineTo(-1, -30); ctx.lineTo(-11, -30); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = this.flash ? '#fff' : '#91643d';
      ctx.beginPath(); ctx.roundRect(-32, -58, 64, 58, 3); ctx.stroke(); ctx.fill();
      ctx.strokeStyle = '#4f3424'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(-28, -54); ctx.lineTo(28, -5); ctx.moveTo(28, -54); ctx.lineTo(-28, -5); ctx.stroke();
      ctx.strokeStyle = '#d2a15e'; ctx.lineWidth = 3; ctx.strokeRect(-28, -54, 56, 49);
    }
    if (options.debug) {
      ctx.strokeStyle = '#ffef72'; ctx.lineWidth = 1; ctx.strokeRect(-34, -72, 68, 72);
    }
    ctx.restore();
  }
}

export class Hazard {
  constructor(type, x, y, options = {}) {
    this.id = `hazard-${worldId++}`;
    this.type = type;
    this.name = type === 'gas' ? 'Marsh Gas Vent' : 'Snapping Mire';
    this.x = x;
    this.y = y;
    this.z = 0;
    this.radius = options.radius || 78;
    this.period = options.period || 3.2;
    this.telegraph = options.telegraph || 0.85;
    this.activeDuration = options.activeDuration || 0.55;
    this.clock = options.offset || 0;
    this.triggered = new Set();
    this.dead = false;
    this.remove = false;
    this.state = 'idle';
  }

  update(dt, game) {
    this.clock = (this.clock + dt) % this.period;
    const previous = this.state;
    if (this.clock >= this.period - this.telegraph) this.state = 'telegraph';
    else if (this.clock <= this.activeDuration) this.state = 'active';
    else this.state = 'idle';
    if (this.state !== previous && this.state === 'active') {
      this.triggered.clear();
      game.playSound('special', { pitch: 1.55, volume: 0.55 });
      game.spawnImpact(this.x, this.y, 0, 'gas', '#b5df66');
    }
    if (this.state === 'active') {
      const targets = [game.player, ...game.enemies];
      for (const target of targets) {
        if (this.triggered.has(target.id) || !radialConnects(this, target, this.radius)) continue;
        this.triggered.add(target.id);
        const source = { x: this.x, y: this.y, facing: signOr(target.x - this.x) };
        target.takeHit({ damage: 10, hitstun: .2, knockback: 105, knockdown: false }, source, game);
      }
    }
  }

  draw(ctx, camera, options = {}) {
    const x = this.x - camera.x;
    const y = this.y - camera.y;
    ctx.save();
    ctx.translate(x, y);
    const alpha = this.state === 'idle' ? .22 : this.state === 'telegraph' ? .62 : .9;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.state === 'active' ? '#b5df66' : '#6b8051';
    ctx.strokeStyle = this.state === 'active' ? '#edff9e' : '#a5b47f';
    ctx.lineWidth = this.state === 'telegraph' ? 5 : 2;
    const pulse = this.state === 'telegraph' ? 1 + Math.sin(this.clock * 18) * .1 : 1;
    ctx.scale(pulse, pulse * .44);
    ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (this.state === 'active') {
      ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = '#d8ff77';
      for (let i = 0; i < 7; i++) {
        const phase = (this.clock * 2 + i / 7) % 1;
        ctx.beginPath(); ctx.arc(x + Math.sin(i * 2.4) * 45, y - phase * 95, 5 + phase * 8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    if (options.debug) {
      ctx.save(); ctx.strokeStyle = '#ff72ed'; ctx.strokeRect(x - this.radius, y - 25, this.radius * 2, 50); ctx.restore();
    }
  }
}

export class Pickup {
  constructor(type, x, y, options = {}) {
    this.id = `pickup-${worldId++}`;
    this.type = type;
    this.name = type === 'health' ? 'Cypress Tonic' : 'Firefly Jar';
    this.x = x;
    this.y = y;
    this.z = 22;
    this.age = 0;
    this.life = options.life || 16;
    this.dead = false;
    this.remove = false;
    this.amount = options.amount || (type === 'health' ? 32 : 35);
  }

  update(dt, game) {
    this.age += dt;
    if (this.age > this.life) this.remove = true;
    if (Math.hypot(game.player.x - this.x, (game.player.y - this.y) * 1.35) < 54) {
      if (this.type === 'health') game.player.heal(this.amount);
      else game.player.focus = clamp(game.player.focus + this.amount, 0, game.player.maxFocus);
      this.remove = true;
      game.playSound('pickup', { pitch: this.type === 'health' ? .9 : 1.2 });
      game.spawnImpact(this.x, this.y, 36, 'pickup', this.type === 'health' ? '#63c174' : '#5ee7ff');
      game.announce(`${this.name} +${this.amount}`, .8);
    }
  }

  draw(ctx, camera, options = {}) {
    const x = this.x - camera.x;
    const y = this.y - camera.y - this.z - Math.sin(this.age * 4) * 6;
    ctx.save();
    ctx.translate(x, y);
    const color = this.type === 'health' ? '#63c174' : '#5ee7ff';
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.fillStyle = '#19362d'; ctx.strokeStyle = options.highContrast ? '#fff' : color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-14, -28, 28, 32, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color;
    if (this.type === 'health') {
      ctx.fillRect(-4, -20, 8, 17); ctx.fillRect(-9, -15, 18, 7);
    } else {
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-6 + i * 6, -12 + (i % 2) * 5, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
}

export class Effect {
  constructor(x, y, z, kind, color) {
    this.x = x; this.y = y; this.z = z; this.kind = kind; this.color = color;
    this.age = 0;
    this.life = ['explosion', 'special'].includes(kind) ? .55 : kind === 'gas' ? .8 : .32;
    this.remove = false;
    const count = kind === 'explosion' ? 24 : kind === 'special' ? 18 : kind === 'debris' ? 14 : 9;
    this.bits = Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i / count) + Math.random() * .5;
      const speed = (kind === 'explosion' ? 170 : 90) + Math.random() * 160;
      return { angle, speed, size: 2 + Math.random() * (kind === 'heavy' ? 7 : 4), spin: Math.random() * 8 };
    });
  }

  update(dt) {
    this.age += dt;
    if (this.age >= this.life) this.remove = true;
  }

  draw(ctx, camera, options = {}) {
    const p = clamp(this.age / this.life, 0, 1);
    const x = this.x - camera.x;
    const y = this.y - camera.y - this.z;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.translate(x, y);
    if (['heavy', 'special', 'explosion'].includes(this.kind)) {
      ctx.strokeStyle = this.color; ctx.lineWidth = 9 * (1 - p);
      ctx.beginPath(); ctx.arc(0, 0, 18 + p * (this.kind === 'explosion' ? 125 : 70), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = this.color;
    for (const bit of this.bits) {
      const travel = bit.speed * this.age;
      const px = Math.cos(bit.angle) * travel;
      const py = Math.sin(bit.angle) * travel * .65 + this.age * this.age * 120;
      ctx.save(); ctx.translate(px, py); ctx.rotate(bit.spin * this.age);
      ctx.fillRect(-bit.size * .5, -bit.size * .5, bit.size * (this.kind === 'debris' ? 2 : 1), bit.size);
      ctx.restore();
    }
    ctx.restore();
  }
}
