import { attackConnects, clamp, FIXED_STEP, hitOutcome, radialConnects, seededRandom, signOr } from './core.js';
import { COLORS, DIFFICULTY, LANE_BOTTOM, LANE_TOP, TEST_ROOMS, VIEW_HEIGHT, VIEW_WIDTH, WORLD_LENGTH } from './config.js';
import { Player } from './player.js';
import { Boss, Enemy, Projectile } from './enemies.js';
import { BreakableProp, Effect, Hazard, Pickup } from './world.js';

class ComboTracker {
  constructor() { this.reset(); }
  reset() { this.count = 0; this.damage = 0; this.timer = 0; this.label = ''; this.score = 0; }
  hit(damage, label) {
    this.count++;
    this.damage += damage;
    this.timer = 1.65;
    this.label = label || '';
    this.score += Math.round(damage * (1 + Math.min(this.count, 20) * .08));
  }
  update(dt) {
    if (this.count <= 0) return;
    this.timer -= dt;
    if (this.timer <= 0) { this.count = 0; this.damage = 0; this.label = ''; }
  }
}

const ENCOUNTERS = [
  {
    id: 'landing', name: 'CROOKED LANDING', trigger: 680, arena: [560, 1450],
    intro: 'Clear the landing',
    waves: [
      [{ type: 'grunt', x: 1010, y: 470 }, { type: 'grunt', x: 1130, y: 575 }, { type: 'rusher', x: 1260, y: 510 }],
      [{ type: 'grunt', x: 920, y: 600 }, { type: 'rusher', x: 1310, y: 440 }]
    ],
    props: [{ type: 'crate', x: 810, y: 445 }]
  },
  {
    id: 'lantern', name: 'LANTERN BEND', trigger: 1810, arena: [1710, 2680],
    intro: 'Mind the crossfire',
    waves: [
      [{ type: 'ranger', x: 2360, y: 430 }, { type: 'grunt', x: 2150, y: 520 }, { type: 'grunt', x: 2440, y: 598 }],
      [{ type: 'ranger', x: 1900, y: 600 }, { type: 'rusher', x: 2370, y: 545 }, { type: 'rusher', x: 2260, y: 450 }]
    ],
    props: [{ type: 'barrel', x: 2200, y: 500 }, { type: 'crate', x: 2530, y: 610 }],
    hazards: [{ type: 'gas', x: 2010, y: 465, offset: 1.3 }]
  },
  {
    id: 'cypress', name: 'SPLIT CYPRESS', trigger: 3070, arena: [2960, 4020],
    intro: 'They are closing in',
    waves: [
      [{ type: 'grunt', x: 3220, y: 460 }, { type: 'grunt', x: 3860, y: 585 }, { type: 'rusher', x: 3900, y: 440 }, { type: 'ranger', x: 3160, y: 610 }],
      [{ type: 'brute', x: 3710, y: 515 }, { type: 'ranger', x: 3920, y: 430 }]
    ],
    props: [{ type: 'barrel', x: 3440, y: 610 }]
  },
  {
    id: 'ironjaw', name: 'IRONJAW CROSSING', trigger: 4380, arena: [4270, 5320],
    intro: 'An enforcer blocks the road',
    waves: [
      [{ type: 'brute', x: 4900, y: 520, elite: true, name: 'IRONJAW' }, { type: 'grunt', x: 4770, y: 440 }, { type: 'rusher', x: 5060, y: 590 }],
      [{ type: 'ranger', x: 4480, y: 445 }, { type: 'ranger', x: 5100, y: 600 }, { type: 'grunt', x: 4930, y: 520 }]
    ],
    props: [{ type: 'crate', x: 4580, y: 605 }],
    hazards: [{ type: 'gas', x: 4760, y: 470, offset: .4 }]
  },
  {
    id: 'boss', name: 'THE DROWNED DEPOT', trigger: 5660, arena: [5530, 6800],
    intro: 'Captain Mire', boss: true,
    waves: [[{ type: 'boss', x: 6420, y: 515 }]],
    props: [{ type: 'barrel', x: 5860, y: 445 }, { type: 'barrel', x: 6240, y: 610 }]
  }
];

export class Game {
  constructor(canvas, { input, audio, settings, onAnnounce, onPause, onComplete, onDefeat } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.input = input;
    this.audio = audio;
    this.settings = settings;
    this.onAnnounceCallback = onAnnounce;
    this.onPauseCallback = onPause;
    this.onCompleteCallback = onComplete;
    this.onDefeatCallback = onDefeat;
    this.player = new Player();
    this.enemies = [];
    this.projectiles = [];
    this.props = [];
    this.hazards = [];
    this.pickups = [];
    this.effects = [];
    this.activeAttackers = new Set();
    this.combo = new ComboTracker();
    this.camera = { x: 0, y: 0, shakeX: 0, shakeY: 0, trauma: 0 };
    this.worldBounds = { left: 45, right: WORLD_LENGTH - 45 };
    this.time = 0;
    this.frame = 0;
    this.inputTime = 0;
    this.playTime = 0;
    this.hitstop = 0;
    this.mode = 'title';
    this.score = 0;
    this.defeated = 0;
    this.encounters = [];
    this.currentEncounter = null;
    this.currentWave = -1;
    this.waveDelay = 0;
    this.completed = false;
    this.failureTimer = 0;
    this.debug = false;
    this.debugRoomIndex = 0;
    this.randomSource = seededRandom(0xba90b4a7);
    this.fpsSamples = [];
    this.frameTime = 0;
    this.maxFrameTime = 0;
    this.automation = null;
    this.rendererCache = [];
    this.background = new Image();
    this.barrier = new Image();
    this.assetsReady = false;
    this.background.src = 'BB_bg_swamp001.png';
    this.barrier.src = 'BB_bg_swamp001_barrier.png';
    this.ambient = Array.from({ length: 38 }, (_, i) => ({
      x: (i * 417 + 131) % WORLD_LENGTH,
      y: 150 + (i * 83) % 330,
      phase: i * .73,
      size: 1 + (i % 3) * .7
    }));
  }

  async load() {
    const waitFor = (image) => image.complete && image.naturalWidth
      ? Promise.resolve()
      : new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; });
    await Promise.all([waitFor(this.background), waitFor(this.barrier)]);
    await Promise.all([this.background, this.barrier].map((image) =>
      typeof image.decode === 'function' ? image.decode().catch(() => {}) : Promise.resolve()));
    this.ctx.fillStyle = '#07140f';
    this.ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    for (const image of [this.background, this.barrier]) {
      if (!image.naturalWidth || !image.naturalHeight) continue;
      const sourceWidth = Math.min(image.naturalWidth, VIEW_WIDTH);
      this.ctx.drawImage(image, 0, 0, sourceWidth, image.naturalHeight, 0, 0, VIEW_WIDTH, 570);
    }
    this.assetsReady = true;
    this.primeRenderer();
  }

  primeRenderer() {
    const previousMode = this.mode;
    const previousDifficulty = this.difficulty;
    this.mode = 'title';
    this.render(0);
    const options = {
      reducedMotion: true, highContrast: false, hitFlash: true,
      showEnemyHealth: false, debug: false, time: 0
    };
    const camera = { x: 0, y: 0, shakeX: 0, shakeY: 0 };
    if (this.rendererCache.length === 0) {
      const warm = (id, animationOffset) => ({
        id: `renderer-${id}`, flankSign: 1, animationOffset, applyDifficulty: false
      });
      this.rendererCache = [
        new Enemy('grunt', 500, 510, warm('grunt', 0)),
        new Enemy('rusher', 620, 550, warm('rusher', 0.4)),
        new Enemy('ranger', 740, 470, warm('ranger', 0.8)),
        new Enemy('brute', 850, 540, warm('brute', 1.2)),
        new Boss(990, 520, warm('boss', 1.6)), new BreakableProp('crate', 1120, 580),
        new Hazard('gas', 1180, 540), new Pickup('health', 1060, 470),
        new Effect(930, 520, 30, 'heavy', COLORS.gold)
      ];
    }
    for (const entity of this.rendererCache) entity.draw(this.ctx, camera, options);
    this.difficulty = DIFFICULTY.normal;
    this.mode = 'playing';
    this.drawHUD(this.ctx);
    this.mode = previousMode;
    this.difficulty = previousDifficulty;
  }

  start(difficulty = 'normal', options = {}) {
    this.settings.difficulty = difficulty;
    this.difficulty = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.player = new Player(options.testRoom ? 920 : 210, 520);
    this.enemies = [];
    this.projectiles = [];
    this.props = [];
    this.hazards = [];
    this.pickups = [];
    this.effects = [];
    this.activeAttackers.clear();
    this.combo.reset();
    this.camera.x = options.testRoom ? 350 : 0;
    this.camera.trauma = 0;
    this.worldBounds = { left: 45, right: WORLD_LENGTH - 45 };
    this.time = 0;
    this.frame = 0;
    this.inputTime = 0;
    this.playTime = 0;
    this.score = 0;
    this.defeated = 0;
    this.hitstop = 0;
    this.completed = false;
    this.failureTimer = 0;
    this.testRoomId = null;
    this.testRoomName = '';
    this.input.buffer.clear();
    this.input.clearFrame();
    this.mode = 'playing';
    this.currentEncounter = null;
    this.currentWave = -1;
    this.encounters = ENCOUNTERS.map((entry) => ({ ...entry, status: 'waiting', spawnedProps: false }));
    this.debug = Boolean(options.debug);
    this.automation = this.debug && options.script
      ? { name: options.script, step: 0, elapsed: 0 }
      : null;
    if (options.testRoom) this.loadTestRoom(options.testRoom);
    this.audio?.setIntensity(0);
    this.audio?.startMusic();
    this.announce(options.testRoom ? `TEST LAB · ${this.testRoomName}` : 'CROOKED LANDING', 1.2);
  }

  quit() {
    this.mode = 'title';
    this.audio?.setIntensity(0);
    this.currentEncounter = null;
    this.input.buffer.clear();
    this.input.clearFrame();
  }

  restartCurrentEncounter() {
    const room = this.testRoomId;
    if (room) {
      this.mode = 'playing';
      this.failureTimer = 0;
      this.loadTestRoom(room);
      this.onPauseCallback?.(false);
      return;
    }
    const encounter = this.currentEncounter
      || [...this.encounters].reverse().find((entry) => entry.status === 'complete')
      || this.encounters.find((entry) => entry.status === 'waiting');
    if (!encounter) {
      this.start(this.settings.difficulty || 'normal');
      this.onPauseCallback?.(false);
      return;
    }
    this.enemies = [];
    this.projectiles = [];
    this.props = [];
    this.hazards = [];
    this.pickups = [];
    this.effects = [];
    this.activeAttackers.clear();
    const checkpoint = encounter.checkpoint;
    this.player = new Player(encounter.arena[0] + 125, checkpoint?.playerY ?? 520);
    if (checkpoint) {
      this.player.health = checkpoint.health;
      this.player.focus = checkpoint.focus;
      this.player.stats = { ...checkpoint.playerStats };
      this.score = checkpoint.score;
      this.defeated = checkpoint.defeated;
    } else {
      this.player.focus = 55;
    }
    this.combo.reset();
    if (checkpoint) this.combo.score = checkpoint.comboScore;
    this.hitstop = 0;
    this.input.buffer.clear();
    this.input.clearFrame();
    this.failureTimer = 0;
    this.completed = false;
    this.mode = 'playing';
    encounter.status = 'waiting';
    encounter.spawnedProps = false;
    const index = this.encounters.indexOf(encounter);
    for (let i = index + 1; i < this.encounters.length; i++) {
      this.encounters[i].status = 'waiting';
      this.encounters[i].spawnedProps = false;
    }
    this.startEncounter(encounter);
    this.onPauseCallback?.(false);
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.input.buffer.clear();
    this.input.clearFrame();
    this.onPauseCallback?.(true);
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.input.buffer.clear();
    this.input.clearFrame();
    this.mode = 'playing';
    this.onPauseCallback?.(false);
  }

  update(dt) {
    this.time += dt;
    if (this.mode === 'paused') {
      this.input.update(this.inputTime, this.frame);
      if (this.input.pressed('pause')) this.resume();
      else this.input.clearFrame();
      return;
    }
    if (this.mode !== 'playing') return;
    this.playTime += dt;
    this.frame++;
    if (this.hitstop <= 0) this.inputTime += dt * 1000;
    this.input.update(this.inputTime, this.frame);
    this.updateAutomation(dt);

    if (this.input.pressed('pause')) {
      this.input.clearFrame();
      this.pause();
      return;
    }
    if (this.input.pressed('debug')) this.debug = !this.debug;
    if (this.debug && this.input.pressed('nextRoom')) this.cycleTestRoom(1);
    if (this.debug && this.input.pressed('previousRoom')) this.cycleTestRoom(-1);

    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      this.updateCamera(dt, true);
      this.input.clearFrame();
      return;
    }

    this.combo.update(dt);
    this.player.update(dt, this, this.input);
    for (const enemy of this.enemies) enemy.update(dt, this);
    for (const projectile of this.projectiles) projectile.update(dt, this);
    for (const prop of this.props) prop.update(dt, this);
    for (const hazard of this.hazards) hazard.update(dt, this);
    for (const pickup of this.pickups) pickup.update(dt, this);
    for (const effect of this.effects) effect.update(dt);
    this.separateActors();
    this.cleanup();

    if (!this.testRoomId) this.updateEncounters(dt);
    if (this.failureTimer > 0) {
      this.failureTimer -= dt;
      if (this.failureTimer <= 0) {
        this.mode = 'defeated';
        this.audio?.setIntensity(0);
        this.updateCamera(dt);
        this.input.clearFrame();
        this.onDefeatCallback?.(this.getResults());
        return;
      }
    }
    this.updateCamera(dt);
    this.audio?.setIntensity(this.currentEncounter ? (this.currentEncounter.boss ? 1 : .62) : .18);
    this.input.clearFrame();
  }

  updateAutomation(dt) {
    const automation = this.automation;
    if (!automation) return;
    automation.elapsed += dt;
    const press = (action) => {
      this.input.press(action, performance.now(), 'automation');
      automation.step++;
    };
    if (automation.elapsed < .24) return;
    const attackId = this.player.attack?.id;
    switch (automation.name) {
      case 'combo':
        if (automation.step === 0 && this.player.canAct) press('light');
        else if (automation.step === 1 && attackId === 'light1' && this.player.stateTime >= .08) press('light');
        else if (automation.step === 2 && attackId === 'light2' && this.player.stateTime >= .08) press('light');
        else if (automation.step === 3 && attackId === 'light3' && this.player.stateTime >= .1) press('light');
        break;
      case 'launcher':
        if (automation.step === 0 && this.player.canAct) press('light');
        else if (automation.step === 1 && attackId === 'light1' && this.player.stateTime >= .08) press('light');
        else if (automation.step === 2 && attackId === 'light2' && this.player.stateTime >= .08) press('heavy');
        break;
      case 'grab':
        if (automation.step === 0 && this.player.canAct) press('grab');
        else if (automation.step === 1 && this.player.state === 'grab' && this.player.stateTime >= .2) press('light');
        else if (automation.step === 2 && this.player.state === 'grab' && this.player.stateTime >= .48) press('heavy');
        break;
      case 'aerial':
        if (automation.step === 0 && this.player.canAct) press('jump');
        else if (automation.step === 1 && this.player.state === 'jump' && this.player.z >= 45) press('light');
        break;
      case 'special':
        if (automation.step === 0 && this.player.canAct) press('special');
        break;
    }
  }

  updateEncounters(dt) {
    if (this.currentEncounter) {
      const living = this.enemies.filter((enemy) => !enemy.dead && !enemy.remove);
      if (living.length === 0) {
        if (this.waveDelay <= 0) this.waveDelay = .75;
        this.waveDelay -= dt;
        if (this.waveDelay <= 0) {
          if (this.currentWave + 1 < this.currentEncounter.waves.length) this.spawnWave(this.currentEncounter, this.currentWave + 1);
          else this.completeEncounter(this.currentEncounter);
        }
      }
      return;
    }
    const next = this.encounters.find((entry) => entry.status === 'waiting' && this.player.x >= entry.trigger);
    if (next) this.startEncounter(next);
  }

  startEncounter(encounter) {
    if (!encounter.checkpoint) {
      encounter.checkpoint = {
        health: this.player.health,
        focus: this.player.focus,
        playerY: this.player.y,
        playerStats: { ...this.player.stats },
        score: this.score,
        defeated: this.defeated,
        comboScore: this.combo.score
      };
    }
    encounter.status = 'active';
    this.currentEncounter = encounter;
    this.currentWave = -1;
    this.waveDelay = 0;
    this.worldBounds.left = encounter.arena[0];
    this.worldBounds.right = encounter.arena[1];
    this.player.x = clamp(this.player.x, encounter.arena[0] + 35, encounter.arena[1] - 35);
    if (!encounter.spawnedProps) {
      for (const prop of encounter.props || []) this.props.push(new BreakableProp(prop.type, prop.x, prop.y, prop));
      for (const hazard of encounter.hazards || []) this.hazards.push(new Hazard(hazard.type, hazard.x, hazard.y, hazard));
      encounter.spawnedProps = true;
    }
    this.playSound(encounter.boss ? 'boss' : 'encounter');
    this.announce(encounter.intro, 1.15);
    this.spawnWave(encounter, 0);
  }

  spawnWave(encounter, index) {
    this.currentWave = index;
    this.waveDelay = 0;
    for (const spawn of encounter.waves[index]) {
      const enemy = spawn.type === 'boss'
        ? new Boss(spawn.x, spawn.y, spawn)
        : new Enemy(spawn.type, spawn.x, spawn.y, spawn);
      this.enemies.push(enemy);
    }
    if (index > 0) this.announce(`Reinforcements · Wave ${index + 1}`, .8);
  }

  completeEncounter(encounter) {
    encounter.status = 'complete';
    this.currentEncounter = null;
    this.currentWave = -1;
    this.worldBounds.left = 45;
    this.worldBounds.right = WORLD_LENGTH - 45;
    this.activeAttackers.clear();
    this.score += encounter.boss ? 5000 : 850;
    if (encounter.boss) {
      this.completed = true;
      this.mode = 'complete';
      this.audio?.setIntensity(0);
      this.playSound('victory');
      this.announce('THE BAYOU IS QUIET', 2);
      setTimeout(() => this.onCompleteCallback?.(this.getResults()), 1200);
    } else {
      this.playSound('pickup', { pitch: .8 });
      this.announce('Path Clear', .85);
      this.dropPickup(this.player.x + 100, this.player.y, 1, this.player.health < 75 ? 'health' : 'focus');
    }
  }

  performAttack(attacker, attack) {
    const playerAttack = attacker === this.player || attacker.team === 'player';
    const effectiveAttack = playerAttack
      ? { ...attack, damage: (attack.damage || 0) * (this.settings.damageAssist || 1) }
      : attack;
    const targets = playerAttack ? [...this.enemies, ...this.props] : [this.player];
    let hits = 0;
    for (const target of targets) {
      if (target.dead || target.remove) continue;
      const connects = effectiveAttack.radial
        ? radialConnects(attacker, target, effectiveAttack.radius || 120)
        : attackConnects(attacker, target, effectiveAttack);
      if (!connects) continue;
      const before = target.health ?? 0;
      if (!target.takeHit?.(effectiveAttack, attacker, this)) continue;
      const damage = Math.max(0, before - (target.health ?? before));
      hits++;
      if (playerAttack && target.type !== 'barrel' && target.type !== 'crate') attacker.onAttackHit?.(target, effectiveAttack, damage, this);
      this.spawnImpact(target.x, target.y, (target.z || 0) + 52, effectiveAttack.impact || 'light', effectiveAttack.radial ? COLORS.focus : COLORS.gold);
    }
    if (hits > 0) {
      const outcome = hitOutcome(effectiveAttack);
      this.hitstop = Math.max(this.hitstop, effectiveAttack.hitstop || .045);
      this.playSound(effectiveAttack.damage >= 18 ? 'hitHeavy' : 'hitLight', { pitch: .93 + this.random() * .12 });
      this.addShake(effectiveAttack.radial ? 11 : effectiveAttack.damage >= 18 ? 6 : 2.8);
      this.rumble(effectiveAttack.radial ? .8 : effectiveAttack.damage >= 18 ? .55 : .26, effectiveAttack.radial ? 130 : 70);
      return outcome;
    }
    return null;
  }

  tryGrab(player) {
    let target = null;
    let best = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.remove || enemy.grabbable === false || enemy.state === 'down' || enemy.invulnerable > 0) continue;
      const forward = (enemy.x - player.x) * player.facing;
      const lane = Math.abs(enemy.y - player.y);
      if (forward < 4 || forward > 72 || lane > 34) continue;
      const score = forward + lane;
      if (score < best) { target = enemy; best = score; }
    }
    if (target) {
      this.releaseAttackToken(target);
      target.state = 'grabbed';
      target.stateTime = 0;
      target.vx = target.vy = target.vz = 0;
    }
    return target;
  }

  damageGrabbed(player, target, attack) {
    const before = target.health;
    target.invulnerable = 0;
    target.takeHit(attack, player, this);
    const damage = Math.max(0, before - target.health);
    if (!target.dead) { target.state = 'grabbed'; target.stateTime = 0; target.vx = target.vy = target.vz = 0; }
    player.onAttackHit(target, attack, damage, this);
    this.hitstop = Math.max(this.hitstop, attack.hitstop);
  }

  throwGrab(player, target, attack) {
    target.invulnerable = 0;
    target.state = 'hurt';
    const before = target.health;
    target.takeHit(attack, player, this);
    player.onAttackHit(target, attack, Math.max(0, before - target.health), this);
    this.hitstop = Math.max(this.hitstop, attack.hitstop);
    this.addShake(7);
  }

  environmentBlast(x, y, source, radius, damage) {
    for (const target of [this.player, ...this.enemies]) {
      if (target.dead || !radialConnects({ x, y }, target, radius)) continue;
      const blastSource = { x, y, facing: signOr(target.x - x) };
      target.takeHit({ damage, hitstun: .35, knockback: 330, launch: 260, knockdown: true, breaksArmor: true }, blastSource, this);
    }
  }

  spawnProjectile(projectile) { this.projectiles.push(projectile); }
  spawnImpact(x, y, z, kind = 'light', color = COLORS.gold) { this.effects.push(new Effect(x, y, z, kind, color)); }
  playSound(name, options) {
    const aliases = {
      armorHit: 'block', armorBreak: 'hitHeavy', enemyHit: 'hitLight',
      enemyTelegraph: 'ui', enemySwing: 'swingLight', projectileHit: 'hitLight',
      heavySwing: 'swingHeavy', enemyRush: 'dodge', slingRelease: 'throw',
      groundSlam: 'special', bossSwing: 'swingHeavy', bossCharge: 'special',
      mireVolley: 'special', bossSlam: 'special', bossPhase: 'encounter',
      bossDefeated: 'victory', enemyDefeated: 'KO', projectileBreak: 'block'
    };
    this.audio?.play(aliases[name] || name, options);
  }
  random() { return this.randomSource(); }
  addShake(amount) { this.camera.trauma = clamp(this.camera.trauma + amount / 20 * this.settings.screenShake, 0, 1); }

  rumble(strength, duration) {
    const pad = navigator.getGamepads?.()[0];
    if (!pad?.vibrationActuator || this.settings.reducedMotion) return;
    pad.vibrationActuator.playEffect?.('dual-rumble', {
      duration,
      strongMagnitude: strength,
      weakMagnitude: strength * .55
    }).catch?.(() => {});
  }

  canEnemyAttack(enemy) {
    if (!this.isOnScreen(enemy, 30) || this.player.dead || this.mode !== 'playing') return false;
    if (enemy instanceof Boss) return true;
    const limit = this.difficulty.aggression > 1.1 ? 3 : 2;
    return this.activeAttackers.has(enemy.id) || this.activeAttackers.size < limit;
  }

  claimAttackToken(enemy) {
    if (!this.canEnemyAttack(enemy)) return false;
    this.activeAttackers.add(enemy.id);
    enemy.attackToken = true;
    return true;
  }

  releaseAttackToken(enemy) {
    this.activeAttackers.delete(enemy.id);
    enemy.attackToken = false;
  }

  onEnemyDefeated(enemy) {
    this.releaseAttackToken(enemy);
    this.defeated++;
    this.score += Math.round((enemy.score || 100) * (1 + Math.min(this.combo.count, 12) * .05));
    if (enemy.isBoss) this.addShake(16);
  }

  onPlayerDefeated() {
    this.combo.update(99);
    this.activeAttackers.clear();
    this.failureTimer = 1.2;
    this.addShake(14);
  }

  dropPickup(x, y, chance = .25, forced = null) {
    if (this.random() > chance) return;
    const type = forced === 'random' || !forced ? (this.player.health < 70 ? 'health' : 'focus') : forced;
    this.pickups.push(new Pickup(type, x, y));
  }

  isOnScreen(entity, margin = 80) {
    const x = entity.x - this.camera.x;
    return x >= -margin && x <= VIEW_WIDTH + margin;
  }

  separateActors() {
    const actors = [this.player, ...this.enemies.filter((enemy) => !enemy.dead && enemy.state !== 'grabbed')];
    for (let i = 0; i < actors.length; i++) {
      for (let j = i + 1; j < actors.length; j++) {
        const a = actors[i]; const b = actors[j];
        const dx = b.x - a.x; const dy = (b.y - a.y) * 1.5;
        const d = Math.hypot(dx, dy);
        const min = 58;
        if (d <= 0 || d >= min) continue;
        const push = (min - d) * .5;
        const nx = dx / d; const ny = dy / d;
        if (!['attack', 'dodge', 'down'].includes(a.state)) { a.x -= nx * push; a.y -= ny * push / 1.5; }
        if (!['attack', 'dodge', 'down'].includes(b.state)) { b.x += nx * push; b.y += ny * push / 1.5; }
      }
    }
  }

  cleanup() {
    this.enemies = this.enemies.filter((entry) => !entry.remove);
    this.projectiles = this.projectiles.filter((entry) => !entry.remove);
    this.props = this.props.filter((entry) => !entry.remove);
    this.hazards = this.hazards.filter((entry) => !entry.remove);
    this.pickups = this.pickups.filter((entry) => !entry.remove);
    this.effects = this.effects.filter((entry) => !entry.remove);
  }

  updateCamera(dt, frozen = false) {
    const targetX = clamp(this.player.x - VIEW_WIDTH * .38, 0, WORLD_LENGTH - VIEW_WIDTH);
    const follow = 1 - Math.pow(.0008, dt);
    if (!frozen) this.camera.x += (targetX - this.camera.x) * follow;
    this.camera.trauma = Math.max(0, this.camera.trauma - dt * 1.75);
    const shake = this.settings.reducedMotion ? 0 : this.camera.trauma * this.camera.trauma * 16;
    this.camera.shakeX = (this.random() * 2 - 1) * shake;
    this.camera.shakeY = (this.random() * 2 - 1) * shake * .62;
  }

  render(interpolation = 0) {
    const ctx = this.ctx;
    const camera = { x: this.camera.x - this.camera.shakeX, y: this.camera.y - this.camera.shakeY };
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.drawBackground(ctx, camera);
    this.drawWorld(ctx, camera);
    if (this.mode !== 'title') this.drawHUD(ctx);
    if (this.debug) this.drawDebug(ctx, camera);
  }

  drawBackground(ctx, camera) {
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
    sky.addColorStop(0, '#071a19'); sky.addColorStop(.55, '#183c30'); sky.addColorStop(1, '#14251d');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    if (this.assetsReady && this.background.naturalWidth) {
      const bgHeight = 570;
      const sourceWidth = this.background.naturalHeight * (VIEW_WIDTH / bgHeight);
      const sourceTravel = Math.max(0, this.background.naturalWidth - sourceWidth);
      const cameraTravel = Math.max(1, WORLD_LENGTH - VIEW_WIDTH);
      const sourceX = clamp(camera.x / cameraTravel, 0, 1) * sourceTravel;
      ctx.drawImage(
        this.background,
        sourceX, 0, sourceWidth, this.background.naturalHeight,
        0, -5, VIEW_WIDTH, bgHeight
      );
      // Dim the photoreal panorama into a cohesive playfield and preserve silhouettes.
      const veil = ctx.createLinearGradient(0, 0, 0, 570);
      veil.addColorStop(0, 'rgba(5,22,19,.08)');
      veil.addColorStop(.72, 'rgba(5,19,15,.13)');
      veil.addColorStop(1, 'rgba(5,15,12,.76)');
      ctx.fillStyle = veil; ctx.fillRect(0, 0, VIEW_WIDTH, 590);
    }

    const ground = ctx.createLinearGradient(0, 370, 0, VIEW_HEIGHT);
    ground.addColorStop(0, 'rgba(35,68,48,.82)');
    ground.addColorStop(.35, '#18382b');
    ground.addColorStop(1, '#0b2019');
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.moveTo(0, 380);
    for (let x = -40; x <= VIEW_WIDTH + 60; x += 80) {
      const worldX = x + camera.x;
      ctx.lineTo(x, 382 + Math.sin(worldX * .006) * 10 + Math.sin(worldX * .019) * 4);
    }
    ctx.lineTo(VIEW_WIDTH, VIEW_HEIGHT); ctx.lineTo(0, VIEW_HEIGHT); ctx.closePath(); ctx.fill();

    // Lane texture and shallow reflective seams.
    ctx.save();
    for (let i = 0; i < 12; i++) {
      const wx = (i * 647 - camera.x * .9) % (VIEW_WIDTH + 220) - 100;
      const wy = 430 + (i * 47) % 240;
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(116,190,145,.17)' : 'rgba(7,20,16,.25)';
      ctx.lineWidth = 2 + (i % 4);
      ctx.beginPath(); ctx.ellipse(wx, wy, 48 + (i % 5) * 15, 7 + (i % 3) * 3, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    // Location-specific procedural docks ground the panoramic art.
    for (const start of [150, 1450, 2740, 4100, 5400]) this.drawDock(ctx, start - camera.x, 628, 520);

    // Fireflies are deterministic and readable at low opacity.
    ctx.save();
    for (const mote of this.ambient) {
      const x = mote.x - camera.x * .72;
      if (x < -20 || x > VIEW_WIDTH + 20) continue;
      const y = mote.y + Math.sin(this.time * 1.7 + mote.phase) * 12;
      const a = .18 + (Math.sin(this.time * 2.3 + mote.phase) + 1) * .2;
      ctx.globalAlpha = a; ctx.fillStyle = '#e8f58b'; ctx.shadowColor = '#c7ff74'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y, mote.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    if (this.currentEncounter && !this.testRoomId) {
      const [left, right] = this.currentEncounter.arena;
      this.drawArenaGate(ctx, left - camera.x, true);
      this.drawArenaGate(ctx, right - camera.x, false);
    }
  }

  drawDock(ctx, x, y, width) {
    if (x > VIEW_WIDTH + 100 || x + width < -100) return;
    ctx.save();
    ctx.fillStyle = 'rgba(62,44,29,.55)';
    ctx.strokeStyle = 'rgba(11,17,13,.65)';
    ctx.lineWidth = 4;
    for (let px = x; px < x + width; px += 58) {
      ctx.beginPath(); ctx.roundRect(px, y - 54 + Math.sin(px * .02) * 3, 53, 92, 4); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(181,130,70,.18)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px + 7, y - 47); ctx.lineTo(px + 45, y + 27); ctx.stroke();
      ctx.strokeStyle = 'rgba(11,17,13,.65)'; ctx.lineWidth = 4;
    }
    ctx.restore();
  }

  drawArenaGate(ctx, x, left) {
    if (x < -60 || x > VIEW_WIDTH + 60) return;
    ctx.save(); ctx.translate(x, 0);
    const gradient = ctx.createLinearGradient(0, 350, 0, 680);
    gradient.addColorStop(0, 'rgba(255,112,67,0)'); gradient.addColorStop(1, 'rgba(255,112,67,.42)');
    ctx.fillStyle = gradient; ctx.fillRect(left ? -25 : 0, 350, 25, 340);
    ctx.strokeStyle = '#ff7043'; ctx.lineWidth = 4; ctx.setLineDash([14, 9]);
    ctx.beginPath(); ctx.moveTo(0, 380); ctx.lineTo(0, 670); ctx.stroke();
    ctx.restore();
  }

  drawWorld(ctx, camera) {
    const options = {
      debug: this.debug,
      highContrast: this.settings.highContrast,
      hitFlash: this.settings.hitFlash,
      reducedMotion: this.settings.reducedMotion
    };
    for (const hazard of this.hazards) hazard.draw(ctx, camera, options);
    const drawable = [...this.props, ...this.pickups, ...this.enemies, this.player]
      .filter((entry) => !entry.remove)
      .sort((a, b) => (a.y || 0) - (b.y || 0));
    for (const entity of drawable) entity.draw(ctx, camera, options);
    for (const projectile of this.projectiles) projectile.draw(ctx, camera, options);
    for (const effect of this.effects) effect.draw(ctx, camera, options);
  }

  drawHUD(ctx) {
    ctx.save();
    ctx.textBaseline = 'middle';
    // Player identity card.
    ctx.fillStyle = 'rgba(4,13,10,.84)';
    ctx.beginPath(); ctx.roundRect(28, 25, 390, 92, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(244,185,66,.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = COLORS.gold; ctx.font = '900 16px Trebuchet MS'; ctx.fillText('ROUX', 50, 48);
    ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(50, 63, 330, 20);
    const hp = this.player.health / this.player.maxHealth;
    const healthGradient = ctx.createLinearGradient(50, 0, 380, 0);
    healthGradient.addColorStop(0, hp < .3 ? '#ff7043' : '#63c174'); healthGradient.addColorStop(1, hp < .3 ? '#e33b35' : '#b6d86d');
    ctx.fillStyle = healthGradient; ctx.fillRect(50, 63, 330 * hp, 20);
    ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(50, 91, 280, 9);
    ctx.fillStyle = COLORS.focus; ctx.fillRect(50, 91, 280 * (this.player.focus / this.player.maxFocus), 9);
    ctx.font = '700 10px Trebuchet MS'; ctx.fillStyle = '#e8f6e4'; ctx.fillText(`${Math.ceil(this.player.health)} / ${this.player.maxHealth}`, 291, 74);
    ctx.fillStyle = COLORS.focus; ctx.fillText('FOCUS', 338, 96);

    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.cream; ctx.font = '900 18px Trebuchet MS'; ctx.fillText(String(this.score + this.combo.score).padStart(7, '0'), 1240, 40);
    ctx.font = '700 10px Trebuchet MS'; ctx.fillStyle = 'rgba(244,232,201,.62)'; ctx.fillText('SCORE', 1240, 60);

    if (this.combo.count > 1) {
      const scale = 1 + Math.min(.18, this.combo.count * .008);
      ctx.save(); ctx.translate(1180, 130); ctx.scale(scale, scale); ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.gold; ctx.font = 'italic 900 46px Trebuchet MS'; ctx.fillText(`${this.combo.count}×`, 0, 0);
      ctx.fillStyle = '#fff'; ctx.font = '800 12px Trebuchet MS'; ctx.fillText(this.combo.count >= 20 ? 'SWAMP STORM' : this.combo.count >= 10 ? 'MIRE MAYHEM' : 'COMBO', 0, 27);
      ctx.restore();
    }

    const boss = this.enemies.find((enemy) => enemy.isBoss && !enemy.dead);
    if (boss) {
      const width = 620; const x = (VIEW_WIDTH - width) / 2;
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '900 13px Trebuchet MS'; ctx.fillText('CAPTAIN MIRE', VIEW_WIDTH / 2, 646);
      ctx.fillStyle = 'rgba(0,0,0,.68)'; ctx.fillRect(x, 661, width, 18);
      ctx.fillStyle = '#bd4d67'; ctx.fillRect(x + 3, 664, (width - 6) * (boss.health / boss.maxHealth), 12);
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.strokeRect(x, 661, width, 18);
    } else if (this.currentEncounter) {
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(4,13,10,.72)'; ctx.fillRect(470, 25, 340, 38);
      ctx.fillStyle = COLORS.cream; ctx.font = '800 12px Trebuchet MS';
      const living = this.enemies.filter((enemy) => !enemy.dead).length;
      ctx.fillText(`${this.currentEncounter.name} · ${living} REMAIN`, 640, 45);
    }

    if (!this.currentEncounter && !this.testRoomId && !this.completed) {
      const next = this.encounters.find((entry) => entry.status === 'waiting');
      if (next) {
        const progress = clamp(this.player.x / WORLD_LENGTH, 0, 1);
        ctx.fillStyle = 'rgba(4,13,10,.58)'; ctx.fillRect(470, 30, 340, 8);
        ctx.fillStyle = COLORS.gold; ctx.fillRect(470, 30, 340 * progress, 8);
        ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(244,232,201,.8)'; ctx.font = '700 11px Trebuchet MS';
        ctx.fillText('MOVE RIGHT · FOLLOW THE LANTERNS', 640, 55);
      }
    }
    ctx.restore();
  }

  drawDebug(ctx, camera) {
    // Hit geometry and lane bounds.
    ctx.save();
    ctx.strokeStyle = 'rgba(94,231,255,.42)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, LANE_TOP); ctx.lineTo(VIEW_WIDTH, LANE_TOP); ctx.moveTo(0, LANE_BOTTOM); ctx.lineTo(VIEW_WIDTH, LANE_BOTTOM); ctx.stroke();
    if (this.assetsReady && this.barrier.naturalWidth) {
      ctx.globalAlpha = .07;
      const sourceWidth = this.barrier.naturalHeight * (VIEW_WIDTH / 570);
      const sourceTravel = Math.max(0, this.barrier.naturalWidth - sourceWidth);
      const cameraTravel = Math.max(1, WORLD_LENGTH - VIEW_WIDTH);
      const sourceX = clamp(camera.x / cameraTravel, 0, 1) * sourceTravel;
      ctx.drawImage(this.barrier, sourceX, 0, sourceWidth, this.barrier.naturalHeight, 0, -5, VIEW_WIDTH, 570);
    }
    ctx.restore();
  }

  getDebugText() {
    const buffered = this.input.buffer.entries.map((entry) => `${entry.action}@${entry.payload?.frame ?? '?'}`).join(', ') || '—';
    const inputLog = this.input.log.slice(0, 6).map((entry) => `${entry.action}@${entry.frame}`).join(', ') || '—';
    const enemyStates = this.enemies.slice(0, 7).map((enemy) =>
      `${enemy.name}:${enemy.state}${enemy.attackToken ? '*' : ''} ${Math.ceil(enemy.health)}/${enemy.maxHealth} @${enemy.x.toFixed(0)},${enemy.y.toFixed(0)}`
    ).join('\n');
    return [
      `TEST: ${this.testRoomName || 'Campaign'}  [ / ] cycle`,
      `FRAME: ${this.frame}  STEP: ${(FIXED_STEP * 1000).toFixed(2)}ms`,
      `FRAME TIME: ${this.frameTime.toFixed(2)}ms  MAX: ${this.maxFrameTime.toFixed(2)}ms`,
      `PLAYER: ${this.player.state}${this.player.attack ? `/${this.player.attack.id}` : ''}  ANIM f${this.player.animationFrame}`,
      `CHAIN STEP: ${this.player.comboStep}  GRACE:${this.player.comboGrace.toFixed(3)}s`,
      `POS: ${this.player.x.toFixed(1)},${this.player.y.toFixed(1)}  Z:${this.player.z.toFixed(1)}`,
      `BUFFER: ${buffered}`,
      `INPUT LOG: ${inputLog}`,
      `INVULN: ${this.player.invulnerable.toFixed(3)}s`,
      `COMBO: ${this.combo.count}  DMG:${this.combo.damage}`,
      `LAST HIT: ${this.player.lastDamage}  KB:${this.player.lastKnockback.toFixed(0)}`,
      `ATTACKERS: ${this.activeAttackers.size}/${this.difficulty?.aggression > 1.1 ? 3 : 2}`,
      `ENEMIES (${this.enemies.length}):`, enemyStates || '—',
      '', 'F1 debug · [ ] rooms'
    ].join('\n');
  }

  loadTestRoom(id) {
    const index = Math.max(0, TEST_ROOMS.findIndex((room) => room.id === id));
    this.debugRoomIndex = index;
    const room = TEST_ROOMS[index];
    this.testRoomId = room.id;
    this.testRoomName = room.name;
    this.enemies = [];
    this.projectiles = [];
    this.props = [];
    this.hazards = [];
    this.pickups = [];
    this.effects = [];
    this.activeAttackers.clear();
    this.combo.reset();
    this.hitstop = 0;
    this.failureTimer = 0;
    this.input.buffer.clear();
    this.input.clearFrame();
    this.player = new Player(920, 520);
    this.worldBounds = { left: 420, right: 1710 };
    this.camera.x = 350;
    const add = (type, x, y, opts = {}) => this.enemies.push(type === 'boss' ? new Boss(x, y, opts) : new Enemy(type, x, y, opts));
    switch (room.id) {
      case 'stationary': this.player.x = 1090; add('dummy', 1180, 520); break;
      case 'weak-melee': add('grunt', 1180, 520, { healthScale: .5 }); break;
      case 'aggressive': add('rusher', 1210, 520, { aggressionScale: 1.5 }); break;
      case 'ranged': add('ranger', 1350, 500); break;
      case 'armored': add('brute', 1200, 520); break;
      case 'opposite': add('grunt', 700, 500); add('grunt', 1260, 540); break;
      case 'mixed': add('grunt', 1190, 450); add('rusher', 1270, 560); add('ranger', 1430, 610); break;
      case 'surrounded': add('grunt', 780, 470); add('grunt', 1080, 470); add('rusher', 790, 590); add('rusher', 1100, 590); break;
      case 'crowd': for (let i = 0; i < 10; i++) add(i % 3 === 0 ? 'rusher' : 'grunt', 650 + i * 95, 430 + (i % 4) * 55); break;
      case 'hazard': add('grunt', 1250, 500); this.hazards.push(new Hazard('gas', 1080, 520)); this.props.push(new BreakableProp('barrel', 1320, 590)); break;
      case 'grab-throw': this.player.x = 985; add('dummy', 1050, 520, { healthScale: 3 }); add('grunt', 1260, 550); break;
      case 'aerial': this.player.x = 1070; add('dummy', 1150, 520, { healthScale: 4 }); break;
      case 'boundary': add('brute', 1570, 520); this.player.x = 1450; break;
      case 'elite': add('brute', 1240, 520, { elite: true, name: 'IRONJAW' }); add('grunt', 1370, 450); break;
      case 'boss': add('boss', 1320, 520); break;
      case 'stress': for (let i = 0; i < 18; i++) add(i % 5 === 0 ? 'ranger' : i % 4 === 0 ? 'brute' : i % 2 ? 'rusher' : 'grunt', 560 + i * 64, 420 + (i % 5) * 48); for (let i = 0; i < 5; i++) this.props.push(new BreakableProp(i % 2 ? 'barrel' : 'crate', 720 + i * 180, 430 + (i % 3) * 80)); break;
    }
    this.announce(`TEST LAB · ${room.name}`, .8);
  }

  cycleTestRoom(direction) {
    const next = (this.debugRoomIndex + direction + TEST_ROOMS.length) % TEST_ROOMS.length;
    this.loadTestRoom(TEST_ROOMS[next].id);
  }

  announce(text, duration = 1) { this.onAnnounceCallback?.(text, duration); }

  recordFrameTime(ms) {
    this.frameTime = ms;
    this.maxFrameTime = Math.max(this.maxFrameTime * .999, ms);
    this.fpsSamples.push(ms);
    if (this.fpsSamples.length > 180) this.fpsSamples.shift();
  }

  getResults() {
    const averageMs = this.fpsSamples.length ? this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length : 0;
    return {
      victory: this.completed,
      score: this.score + this.combo.score,
      time: this.playTime,
      enemies: this.defeated,
      damage: this.player.stats.damage,
      maxCombo: this.player.stats.maxCombo,
      damageTaken: this.player.stats.damageTaken,
      averageFrameMs: averageMs,
      maxFrameMs: this.maxFrameTime
    };
  }
}
