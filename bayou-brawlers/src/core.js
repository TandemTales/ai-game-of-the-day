export const FIXED_STEP = 1 / 60;
export const FRAME_MS = 1000 / 60;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, amount) => a + (b - a) * amount;
export const approach = (value, target, amount) =>
  value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
export const signOr = (value, fallback = 1) => value === 0 ? fallback : Math.sign(value);
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const laneDistance = (a, b) => Math.abs(a.y - b.y);
export const within = (value, min, max) => value >= min && value <= max;

export function seededRandom(seed = 0x9e3779b9) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export class TimedInputBuffer {
  constructor(windowMs = 140, limit = 24) {
    this.windowMs = windowMs;
    this.limit = limit;
    this.entries = [];
  }

  push(action, time, payload = null) {
    this.entries.push({ action, time, payload });
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
  }

  prune(now) {
    const earliest = now - this.windowMs;
    this.entries = this.entries.filter((entry) => entry.time >= earliest);
  }

  has(action, now) {
    this.prune(now);
    return this.entries.some((entry) => entry.action === action);
  }

  consume(action, now) {
    this.prune(now);
    const index = this.entries.findIndex((entry) => entry.action === action);
    if (index < 0) return null;
    return this.entries.splice(index, 1)[0];
  }

  clear(action = null) {
    this.entries = action ? this.entries.filter((entry) => entry.action !== action) : [];
  }
}

export function attackConnects(attacker, target, attack) {
  if (!attacker || !target || target.dead || target.invulnerable > 0) return false;
  const direction = attacker.facing || 1;
  const relativeX = (target.x - attacker.x) * direction;
  const forward = attack.reach ?? 82;
  const behind = attack.behind ?? 10;
  const lane = attack.lane ?? 42;
  const attackerHeight = attacker.z || 0;
  const targetHeight = target.z || 0;
  const heightTolerance = attack.height ?? 70;
  return relativeX >= -behind && relativeX <= forward
    && Math.abs(target.y - attacker.y) <= lane
    && Math.abs(targetHeight - attackerHeight) <= heightTolerance;
}

export function radialConnects(attacker, target, radius, laneScale = 0.72) {
  const dx = target.x - attacker.x;
  const dy = (target.y - attacker.y) / laneScale;
  return Math.hypot(dx, dy) <= radius && !target.dead && target.invulnerable <= 0;
}

export function hitOutcome(attack, target = {}) {
  const armor = target.armor || 0;
  const breaksArmor = Boolean(attack.breaksArmor);
  const guarded = armor > 0 && !breaksArmor;
  const damage = Math.max(1, Math.round((attack.damage || 1) * (guarded ? 0.45 : 1)));
  return {
    damage,
    hitstun: guarded ? Math.min(0.11, attack.hitstun || 0.16) : (attack.hitstun || 0.16),
    knockback: guarded ? (attack.knockback || 0) * 0.22 : (attack.knockback || 0),
    launch: guarded ? 0 : (attack.launch || 0),
    knockdown: !guarded && Boolean(attack.knockdown),
    armorBroken: breaksArmor && armor > 0,
    guarded
  };
}

export function formatFrames(seconds) {
  return Math.round(seconds / FIXED_STEP);
}

export function rectContains(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
