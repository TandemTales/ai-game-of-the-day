/**
 * BotBuiltArcade Sound Library
 * Defines available sounds and music for each game
 */

// Web Audio API sound generation for basic game sounds
class SoundGenerator {
  constructor(audioContext) {
    this.audioContext = audioContext;
  }

  // Generate a simple beep sound
  generateBeep(frequency = 440, duration = 0.1, type = 'sine') {
    if (!this.audioContext) return null;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
    
    return oscillator;
  }

  // Generate explosion sound
  generateExplosion(duration = 0.5) {
    if (!this.audioContext) return null;
    
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    source.start(this.audioContext.currentTime);
    
    return source;
  }

  // Generate shooting sound
  generateShoot(frequency = 800, duration = 0.1) {
    if (!this.audioContext) return null;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.3, this.audioContext.currentTime + duration);
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
    
    return oscillator;
  }

  // Generate power-up sound
  generatePowerUp() {
    if (!this.audioContext) return null;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.3);
    oscillator.type = 'triangle';
    
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.3);
    
    return oscillator;
  }

  // Generate UI click sound
  generateClick() {
    if (!this.audioContext) return null;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime);
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.05);
    
    return oscillator;
  }
}

// Sound library configuration for each game
const SOUND_LIBRARY = {
  // Global UI sounds used across all games
  global: {
    sounds: {
      click: { generator: 'click', description: 'Button click' },
      hover: { generator: 'beep', params: [600, 0.05], description: 'Button hover' },
      success: { generator: 'powerUp', description: 'Success/achievement' },
      error: { generator: 'beep', params: [200, 0.2, 'sawtooth'], description: 'Error/invalid action' }
    },
    music: {
      menu: { url: null, description: 'Main menu ambient music' }
    }
  },

  // Bastion Builder specific sounds
  'bastion-builder': {
    sounds: {
      place_wall: { generator: 'click', description: 'Wall placement' },
      place_cannon: { generator: 'beep', params: [400, 0.15], description: 'Cannon placement' },
      cannon_fire: { generator: 'shoot', params: [800, 0.1], description: 'Cannon firing' },
      explosion: { generator: 'explosion', params: [0.3], description: 'Ship destruction' },
      phase_change: { generator: 'beep', params: [660, 0.3, 'triangle'], description: 'Build to battle phase' },
      keep_damage: { generator: 'beep', params: [150, 0.4, 'sawtooth'], description: 'Keep taking damage' },
      wave_complete: { generator: 'powerUp', description: 'Wave completed' }
    },
    music: {
      build_phase: { url: null, description: 'Calm building music' },
      battle_phase: { url: null, description: 'Intense battle music' }
    }
  },

  // Nova Striker specific sounds
  'nova-striker': {
    sounds: {
      player_shoot: { generator: 'shoot', params: [1000, 0.08], description: 'Player shooting' },
      enemy_shoot: { generator: 'shoot', params: [600, 0.1], description: 'Enemy shooting' },
      enemy_hit: { generator: 'beep', params: [300, 0.1, 'square'], description: 'Enemy hit' },
      player_hit: { generator: 'beep', params: [200, 0.2, 'sawtooth'], description: 'Player hit' },
      enemy_destroy: { generator: 'explosion', params: [0.2], description: 'Enemy destroyed' },
      powerup_collect: { generator: 'powerUp', description: 'Power-up collected' },
      level_complete: { generator: 'powerUp', description: 'Level completed' }
    },
    music: {
      gameplay: { url: null, description: 'Fast-paced space combat music' }
    }
  },

  // Aurora Tower Defense specific sounds
  'aurora-tower-defense': {
    sounds: {
      tower_place: { generator: 'click', description: 'Tower placement' },
      tower_upgrade: { generator: 'powerUp', description: 'Tower upgrade' },
      tower_shoot: { generator: 'shoot', params: [700, 0.08], description: 'Tower shooting' },
      enemy_hit: { generator: 'beep', params: [400, 0.08], description: 'Enemy hit' },
      enemy_destroy: { generator: 'explosion', params: [0.15], description: 'Enemy destroyed' },
      wave_start: { generator: 'beep', params: [500, 0.3, 'triangle'], description: 'Wave starting' },
      base_damage: { generator: 'beep', params: [150, 0.4, 'sawtooth'], description: 'Base taking damage' }
    },
    music: {
      gameplay: { url: null, description: 'Strategic tower defense music' }
    }
  },

  // Ocean Explorer specific sounds
  'ocean-explorer': {
    sounds: {
      swim: { generator: 'beep', params: [300, 0.1, 'sine'], description: 'Swimming movement' },
      collect_treasure: { generator: 'powerUp', description: 'Treasure collected' },
      bubble: { generator: 'beep', params: [800, 0.05, 'sine'], description: 'Bubble effect' },
      danger: { generator: 'beep', params: [200, 0.3, 'sawtooth'], description: 'Danger warning' }
    },
    music: {
      underwater: { url: null, description: 'Calm underwater exploration music' }
    }
  },

  // Neon Brick Breaker specific sounds
  'neon-brick-breaker': {
    sounds: {
      paddle_hit: { generator: 'beep', params: [600, 0.05], description: 'Ball hitting paddle' },
      brick_hit: { generator: 'beep', params: [800, 0.08], description: 'Ball hitting brick' },
      brick_destroy: { generator: 'explosion', params: [0.1], description: 'Brick destroyed' },
      wall_hit: { generator: 'beep', params: [400, 0.1], description: 'Ball hitting wall' },
      ball_lost: { generator: 'beep', params: [150, 0.5, 'sawtooth'], description: 'Ball lost' },
      level_complete: { generator: 'powerUp', description: 'Level completed' }
    },
    music: {
      gameplay: { url: null, description: 'Energetic neon-style music' }
    }
  }
};

// Audio integration helper
class GameAudioIntegrator {
  constructor(gameId) {
    this.gameId = gameId;
    this.audioManager = window.AudioManager;
    this.soundGenerator = new SoundGenerator(this.audioManager.audioContext);
    this.initialized = false;
  }

  // Initialize audio for the game
  async init() {
    if (this.initialized) return;
    
    const gameConfig = SOUND_LIBRARY[this.gameId];
    const globalConfig = SOUND_LIBRARY.global;
    
    if (!gameConfig && !globalConfig) {
      console.warn(`No audio configuration found for game: ${this.gameId}`);
      return;
    }

    // Load global sounds
    if (globalConfig) {
      await this.loadSounds(globalConfig.sounds, 'global');
    }

    // Load game-specific sounds
    if (gameConfig) {
      await this.loadSounds(gameConfig.sounds, this.gameId);
    }

    this.initialized = true;
    console.log(`Audio initialized for ${this.gameId}`);
  }

  // Load sounds from configuration
  async loadSounds(soundsConfig, prefix = '') {
    for (const [soundName, config] of Object.entries(soundsConfig)) {
      const fullName = prefix ? `${prefix}_${soundName}` : soundName;
      
      if (config.url) {
        // Load from URL
        await this.audioManager.loadSound(fullName, config.url);
      } else if (config.generator) {
        // Generate sound and store it
        this.generateAndStoreSound(fullName, config.generator, config.params || []);
      }
    }
  }

  // Generate and store a procedural sound
  generateAndStoreSound(name, generatorType, params) {
    // Create a wrapper function that generates the sound when called
    const soundWrapper = {
      play: () => {
        if (this.soundGenerator[`generate${generatorType.charAt(0).toUpperCase() + generatorType.slice(1)}`]) {
          this.soundGenerator[`generate${generatorType.charAt(0).toUpperCase() + generatorType.slice(1)}`](...params);
        }
      },
      cloneNode: () => soundWrapper // Return self for compatibility
    };
    
    this.audioManager.sounds.set(name, soundWrapper);
  }

  // Play a game-specific sound
  playSound(soundName, volume = 1.0) {
    const fullName = `${this.gameId}_${soundName}`;
    this.audioManager.playSound(fullName, volume);
  }

  // Play a global sound
  playGlobalSound(soundName, volume = 1.0) {
    const fullName = `global_${soundName}`;
    this.audioManager.playSound(fullName, volume);
  }

  // Play music for the game
  playMusic(musicName) {
    const fullName = `${this.gameId}_${musicName}`;
    this.audioManager.playMusic(fullName);
  }

  // Stop all audio
  stopAll() {
    this.audioManager.stopMusic();
  }
}

// Export for use in games
window.GameAudioIntegrator = GameAudioIntegrator;
window.SOUND_LIBRARY = SOUND_LIBRARY;

