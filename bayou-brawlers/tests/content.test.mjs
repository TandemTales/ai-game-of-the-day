import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_PROFILES, Enemy, Boss } from '../src/enemies.js';
import { TEST_ROOMS } from '../src/config.js';

test('normal roster has distinct tactical profiles', () => {
  for (const type of ['grunt', 'rusher', 'ranger', 'brute']) assert.ok(ENEMY_PROFILES[type], `${type} profile missing`);
  const roles = new Set(['grunt', 'rusher', 'ranger', 'brute'].map((type) => ENEMY_PROFILES[type].role));
  assert.equal(roles.size, 4, 'enemy roster should expose four tactical roles');
  assert.ok((ENEMY_PROFILES.brute.armor || 0) > 0, 'brute must create an armor-break problem');
  assert.ok(Object.values(ENEMY_PROFILES.ranger.attacks).some((attack) => attack.projectileSpeed), 'ranger needs a real ranged attack');
});

test('all required combat test rooms are registered', () => {
  const required = ['stationary', 'weak-melee', 'aggressive', 'ranged', 'armored', 'opposite', 'mixed', 'surrounded', 'crowd', 'hazard', 'grab-throw', 'aerial', 'boundary', 'elite', 'boss', 'stress'];
  assert.deepEqual(TEST_ROOMS.map((room) => room.id), required);
});

test('enemy and boss constructors expose integration contract', () => {
  const grunt = new Enemy('grunt', 100, 500);
  const boss = new Boss(300, 520);
  for (const entity of [grunt, boss]) {
    for (const method of ['update', 'takeHit', 'draw', 'getHurtbox']) assert.equal(typeof entity[method], 'function');
    assert.ok(entity.maxHealth > 0);
    assert.equal(entity.dead, false);
  }
  assert.equal(boss.isBoss, true);
  assert.equal(boss.grabbable, false);
});

test('renderer-prime entities do not consume gameplay enemy identities', () => {
  const before = Number(new Enemy('grunt', 0, 500).id.split('-')[1]);
  const rendererOnly = new Enemy('ranger', 0, 500, {
    id: 'renderer-test', flankSign: 1, animationOffset: 0, applyDifficulty: false
  });
  const after = Number(new Enemy('grunt', 0, 500).id.split('-')[1]);
  assert.equal(rendererOnly.id, 'renderer-test');
  assert.equal(after, before + 1);
});
