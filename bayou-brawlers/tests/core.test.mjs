import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attackConnects,
  FIXED_STEP,
  hitOutcome,
  radialConnects,
  seededRandom,
  TimedInputBuffer
} from '../src/core.js';
import { Player, PLAYER_ATTACKS } from '../src/player.js';

test('buffer preserves an early attack through a legal transition', () => {
  const buffer = new TimedInputBuffer(150);
  buffer.push('light', 1000, { frame: 60 });
  assert.equal(buffer.has('light', 1135), true);
  assert.equal(buffer.consume('light', 1135)?.payload.frame, 60);
  assert.equal(buffer.has('light', 1135), false);
});

test('buffer expires inputs outside its documented window', () => {
  const buffer = new TimedInputBuffer(150);
  buffer.push('heavy', 1000);
  assert.equal(buffer.consume('heavy', 1151), null);
});

test('attack alignment respects facing, reach, and vertical lane tolerance', () => {
  const attacker = { x: 100, y: 500, z: 0, facing: 1 };
  const target = { x: 180, y: 540, z: 0, invulnerable: 0, dead: false };
  assert.equal(attackConnects(attacker, target, { reach: 84, lane: 42 }), true);
  target.y = 544;
  assert.equal(attackConnects(attacker, target, { reach: 84, lane: 42 }), false);
  target.y = 500;
  target.x = 10;
  assert.equal(attackConnects(attacker, target, { reach: 120, lane: 42 }), false);
  attacker.facing = -1;
  assert.equal(attackConnects(attacker, target, { reach: 120, lane: 42 }), true);
});

test('radial special uses compressed lane distance for brawler perspective', () => {
  const attacker = { x: 100, y: 500 };
  const target = { x: 100, y: 590, invulnerable: 0, dead: false };
  assert.equal(radialConnects(attacker, target, 130), true);
  target.y = 610;
  assert.equal(radialConnects(attacker, target, 130), false);
});

test('armor reduces ordinary hits and is broken by the documented counter', () => {
  const guarded = hitOutcome({ damage: 20, knockback: 200, hitstun: .3 }, { armor: 1 });
  assert.equal(guarded.damage, 9);
  assert.equal(guarded.knockback, 44);
  assert.equal(guarded.guarded, true);
  const broken = hitOutcome({ damage: 20, knockback: 200, breaksArmor: true }, { armor: 1 });
  assert.equal(broken.damage, 20);
  assert.equal(broken.armorBroken, true);
});

test('seeded simulation randomness is reproducible', () => {
  const a = seededRandom(42);
  const b = seededRandom(42);
  assert.deepEqual(Array.from({ length: 12 }, a), Array.from({ length: 12 }, b));
});

test('light attack becomes active within four fixed frames', () => {
  const player = new Player();
  let activeFrame = 0;
  const game = {
    worldBounds: { left: 0, right: 2000 },
    random: () => .5,
    playSound() {},
    performAttack() { if (!activeFrame) activeFrame = frame; },
    spawnImpact() {},
    announce() {}
  };
  const input = {
    direction: { x: 0, y: 0 },
    buffer: new TimedInputBuffer(150),
    consume(action, now) { return this.buffer.consume(action, now); },
    held() { return false; }
  };
  player.startAttack(PLAYER_ATTACKS.light1, game);
  let frame = 0;
  for (frame = 1; frame <= 8; frame++) player.update(FIXED_STEP, game, input);
  assert.ok(activeFrame > 0 && activeFrame <= 4, `active frame was ${activeFrame}`);
});

test('buffered light input chains on the first legal cancel frame', () => {
  const player = new Player();
  const game = {
    worldBounds: { left: 0, right: 2000 },
    random: () => .5,
    playSound() {}, performAttack() {}, spawnImpact() {}, announce() {}
  };
  const input = {
    direction: { x: 0, y: 0 },
    buffer: new TimedInputBuffer(150),
    consume(action, now) { return this.buffer.consume(action, now); },
    held() { return false; }
  };
  player.comboStep = 1;
  player.startAttack(PLAYER_ATTACKS.light1, game);
  for (let frame = 0; frame < 6; frame++) player.update(FIXED_STEP, game, input);
  input.buffer.push('light', performance.now());
  for (let frame = 0; frame < 8 && player.attack?.id === 'light1'; frame++) {
    player.update(FIXED_STEP, game, input);
  }
  assert.equal(player.attack?.id, 'light2');
});

test('the complete four-hit route accepts one buffered input per cancel window', () => {
  const player = new Player();
  const attacks = [];
  const game = {
    worldBounds: { left: 0, right: 2000 },
    random: () => .5,
    playSound() {}, spawnImpact() {}, announce() {},
    performAttack(_player, attack) { attacks.push(attack.id); }
  };
  const input = {
    direction: { x: 0, y: 0 },
    buffer: new TimedInputBuffer(150),
    consume(action, now) { return this.buffer.consume(action, now); },
    held() { return false; }
  };
  player.comboStep = 1;
  player.startAttack(PLAYER_ATTACKS.light1, game);
  const queuedFor = new Set();
  for (let frame = 0; frame < 120; frame++) {
    const id = player.attack?.id;
    if (id && id !== 'light4' && player.stateTime >= .08 && !queuedFor.has(id)) {
      input.buffer.push('light', performance.now());
      queuedFor.add(id);
    }
    player.update(FIXED_STEP, game, input);
    if (!player.attack && attacks.length >= 4) break;
  }
  assert.deepEqual(attacks, ['light1', 'light2', 'light3', 'light4']);
});
