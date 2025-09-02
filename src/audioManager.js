/**
 * BotBuiltArcade Global Audio Manager
 * Provides consistent audio experience across all games
 */

class AudioManager {
  constructor() {
    this.sounds = new Map();
    this.music = new Map();
    this.soundEnabled = true;
    this.musicEnabled = true;
    this.masterVolume = 0.7;
    this.soundVolume = 0.8;
    this.musicVolume = 0.5;
    this.currentMusic = null;
    this.musicFadeInterval = null;
    
    // Load settings from localStorage
    this.loadSettings();
    
    // Initialize Web Audio Context for better control
    this.audioContext = null;
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported, falling back to HTML5 audio');
    }
  }

  // Resume audio context on user interaction (required by browsers)
  resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // Load audio settings from localStorage
  loadSettings() {
    const settings = localStorage.getItem('botbuiltarcade_audio_settings');
    if (settings) {
      try {
        const parsed = JSON.parse(settings);
        this.soundEnabled = parsed.soundEnabled !== false;
        this.musicEnabled = parsed.musicEnabled !== false;
        this.masterVolume = parsed.masterVolume || 0.7;
        this.soundVolume = parsed.soundVolume || 0.8;
        this.musicVolume = parsed.musicVolume || 0.5;
      } catch (e) {
        console.warn('Failed to load audio settings');
      }
    }
  }

  // Save audio settings to localStorage
  saveSettings() {
    const settings = {
      soundEnabled: this.soundEnabled,
      musicEnabled: this.musicEnabled,
      masterVolume: this.masterVolume,
      soundVolume: this.soundVolume,
      musicVolume: this.musicVolume
    };
    localStorage.setItem('botbuiltarcade_audio_settings', JSON.stringify(settings));
  }

  // Preload a sound effect
  async loadSound(name, url) {
    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.volume = this.soundVolume * this.masterVolume;
      
      return new Promise((resolve, reject) => {
        audio.addEventListener('canplaythrough', () => {
          this.sounds.set(name, audio);
          resolve(audio);
        });
        audio.addEventListener('error', reject);
        audio.load();
      });
    } catch (e) {
      console.warn(`Failed to load sound: ${name}`, e);
    }
  }

  // Preload background music
  async loadMusic(name, url) {
    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.loop = true;
      audio.volume = this.musicVolume * this.masterVolume;
      
      return new Promise((resolve, reject) => {
        audio.addEventListener('canplaythrough', () => {
          this.music.set(name, audio);
          resolve(audio);
        });
        audio.addEventListener('error', reject);
        audio.load();
      });
    } catch (e) {
      console.warn(`Failed to load music: ${name}`, e);
    }
  }

  // Play a sound effect
  playSound(name, volume = 1.0) {
    if (!this.soundEnabled) return;
    
    this.resumeAudioContext();
    
    const sound = this.sounds.get(name);
    if (sound) {
      try {
        // Clone the audio for overlapping sounds
        const audioClone = sound.cloneNode();
        audioClone.volume = Math.min(1.0, volume * this.soundVolume * this.masterVolume);
        audioClone.play().catch(e => console.warn(`Failed to play sound: ${name}`, e));
      } catch (e) {
        console.warn(`Failed to play sound: ${name}`, e);
      }
    }
  }

  // Play background music with fade in
  playMusic(name, fadeInDuration = 1000) {
    if (!this.musicEnabled) return;
    
    this.resumeAudioContext();
    
    const music = this.music.get(name);
    if (music && music !== this.currentMusic) {
      // Fade out current music first
      if (this.currentMusic) {
        this.fadeOutMusic(500).then(() => {
          this.startMusic(music, fadeInDuration);
        });
      } else {
        this.startMusic(music, fadeInDuration);
      }
    }
  }

  // Start playing music with fade in
  startMusic(music, fadeInDuration) {
    this.currentMusic = music;
    music.volume = 0;
    music.currentTime = 0;
    
    music.play().then(() => {
      this.fadeInMusic(music, fadeInDuration);
    }).catch(e => console.warn('Failed to play music', e));
  }

  // Fade in music
  fadeInMusic(music, duration) {
    const targetVolume = this.musicVolume * this.masterVolume;
    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = targetVolume / steps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      currentStep++;
      music.volume = Math.min(targetVolume, volumeStep * currentStep);
      
      if (currentStep >= steps) {
        clearInterval(fadeInterval);
        music.volume = targetVolume;
      }
    }, stepDuration);
  }

  // Fade out current music
  fadeOutMusic(duration = 1000) {
    return new Promise((resolve) => {
      if (!this.currentMusic) {
        resolve();
        return;
      }

      const music = this.currentMusic;
      const startVolume = music.volume;
      const steps = 20;
      const stepDuration = duration / steps;
      const volumeStep = startVolume / steps;
      let currentStep = 0;

      const fadeInterval = setInterval(() => {
        currentStep++;
        music.volume = Math.max(0, startVolume - (volumeStep * currentStep));
        
        if (currentStep >= steps || music.volume <= 0) {
          clearInterval(fadeInterval);
          music.pause();
          music.volume = startVolume;
          if (music === this.currentMusic) {
            this.currentMusic = null;
          }
          resolve();
        }
      }, stepDuration);
    });
  }

  // Stop all music
  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic.currentTime = 0;
      this.currentMusic = null;
    }
  }

  // Update volume settings
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
    this.saveSettings();
  }

  setSoundVolume(volume) {
    this.soundVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
    this.saveSettings();
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
    this.saveSettings();
  }

  // Update all audio volumes
  updateAllVolumes() {
    // Update sound effects volumes
    for (const sound of this.sounds.values()) {
      sound.volume = this.soundVolume * this.masterVolume;
    }
    
    // Update music volumes
    for (const music of this.music.values()) {
      music.volume = this.musicVolume * this.masterVolume;
    }
  }

  // Toggle sound effects
  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    this.saveSettings();
    return this.soundEnabled;
  }

  // Toggle music
  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (!this.musicEnabled && this.currentMusic) {
      this.stopMusic();
    }
    this.saveSettings();
    return this.musicEnabled;
  }

  // Get current settings
  getSettings() {
    return {
      soundEnabled: this.soundEnabled,
      musicEnabled: this.musicEnabled,
      masterVolume: this.masterVolume,
      soundVolume: this.soundVolume,
      musicVolume: this.musicVolume
    };
  }

  // Cleanup
  destroy() {
    this.stopMusic();
    if (this.musicFadeInterval) {
      clearInterval(this.musicFadeInterval);
    }
    this.sounds.clear();
    this.music.clear();
  }
}

// Create global instance
window.AudioManager = window.AudioManager || new AudioManager();

// Auto-resume audio context on user interaction
document.addEventListener('click', () => window.AudioManager.resumeAudioContext(), { once: true });
document.addEventListener('touchstart', () => window.AudioManager.resumeAudioContext(), { once: true });
document.addEventListener('keydown', () => window.AudioManager.resumeAudioContext(), { once: true });

