import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.Image = class FakeImage {
  constructor() {
    this.complete = true;
    this.naturalWidth = 1;
    this.naturalHeight = 1;
  }
};

const { Game } = await import('../src/game.js');

function makeGame() {
  const input = {
    buffer: {
      clears: 0,
      clear() { this.clears++; }
    },
    clearFrame() {},
    update() {},
    pressed(action) { return action === 'pause' && this.pausePressed; },
    bindings: {}
  };
  const audio = {
    setIntensity() {},
    startMusic() {},
    play() {}
  };
  const game = new Game({ getContext: () => ({}) }, {
    input,
    audio,
    settings: {
      difficulty: 'normal', screenShake: 1, reducedMotion: false,
      hitFlash: true, damageAssist: 1, enemyDamage: 1
    }
  });
  return { game, input };
}

test('normal start clears a prior debug-room identity', () => {
  const { game, input } = makeGame();
  game.testRoomId = 'stationary';
  game.testRoomName = 'Stationary Target';
  game.start('normal');
  assert.equal(game.testRoomId, null);
  assert.equal(game.testRoomName, '');
  assert.ok(input.buffer.clears > 0);
});

test('pause input toggles back to play and clears queued combat actions', () => {
  const { game, input } = makeGame();
  game.start('normal');
  game.pause();
  const clearsBeforeResume = input.buffer.clears;
  input.pausePressed = true;
  game.update(1 / 60);
  assert.equal(game.mode, 'playing');
  assert.ok(input.buffer.clears > clearsBeforeResume);
});

test('restart restores encounter scoring checkpoint without rewinding elapsed time', () => {
  const { game, input } = makeGame();
  game.start('normal');
  const encounter = game.encounters[0];
  game.player.health = 83;
  game.player.focus = 61;
  game.player.stats.damage = 144;
  game.score = 420;
  game.defeated = 3;
  game.combo.score = 91;
  game.playTime = 12;
  game.startEncounter(encounter);

  game.score = 9999;
  game.defeated = 22;
  game.combo.score = 777;
  game.player.stats.damage = 9001;
  game.playTime = 28;
  game.restartCurrentEncounter();

  assert.equal(game.score, 420);
  assert.equal(game.defeated, 3);
  assert.equal(game.combo.score, 91);
  assert.equal(game.player.stats.damage, 144);
  assert.equal(game.player.health, 83);
  assert.equal(game.player.focus, 61);
  assert.equal(game.playTime, 28);
  assert.ok(input.buffer.clears > 0);
});
