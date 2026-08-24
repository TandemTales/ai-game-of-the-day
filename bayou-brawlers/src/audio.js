const DEFAULT_VOLUMES = Object.freeze({
  master: 0.75,
  music: 0.45,
  sfx: 0.8
});

const INTENSITY_PRESETS = Object.freeze({
  calm: 0.12,
  low: 0.25,
  normal: 0.45,
  medium: 0.55,
  high: 0.8,
  boss: 1
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export class AudioEngine {
  constructor(settings = {}) {
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.compressor = null;
    this.noiseBuffer = null;

    this.volumes = { ...DEFAULT_VOLUMES };
    this.intensity = INTENSITY_PRESETS.normal;
    this.musicRequested = false;
    this.musicTimer = null;
    this.musicOutput = null;
    this.musicStep = 0;
    this.musicNextTime = 0;
    this.musicBpm = 88;
    this.setVolumes(settings);
  }

  async unlock() {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return false;

    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContextClass({ latencyHint: 'interactive' });
      this._buildGraph();
    }

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch {
        return false;
      }
    }

    if (this.context.state !== 'running') return false;

    // A one-frame silent source completes the unlock path on older mobile browsers.
    const source = this.context.createBufferSource();
    source.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
    source.connect(this.masterGain);
    source.start();
    source.onended = () => source.disconnect();

    this._applyVolumes(true);
    if (this.musicRequested) this._beginMusic();
    return true;
  }

  setVolumes(settings = {}) {
    this.volumes.master = this._volumeFrom(settings, 'masterVolume', 'master', this.volumes.master);
    this.volumes.music = this._volumeFrom(settings, 'musicVolume', 'music', this.volumes.music);
    this.volumes.sfx = this._volumeFrom(settings, 'sfxVolume', 'sfx', this.volumes.sfx);
    this._applyVolumes(false);
    return { ...this.volumes };
  }

  startMusic() {
    this.musicRequested = true;
    if (!this.context || this.context.state !== 'running') return false;
    this._beginMusic();
    return true;
  }

  setIntensity(level) {
    const requested = typeof level === 'string'
      ? INTENSITY_PRESETS[level.toLowerCase()]
      : Number(level);
    this.intensity = clamp(Number.isFinite(requested) ? requested : this.intensity, 0, 1);
    return this.intensity;
  }

  play(name, options = {}) {
    if (!this.context || this.context.state !== 'running') return false;

    const volume = clamp(finiteOr(options.volume, 1), 0, 2);
    if (volume === 0) return true;

    const pan = clamp(finiteOr(options.pan, 0), -1, 1);
    const pitch = clamp(finiteOr(options.pitch ?? options.rate, 1), 0.5, 2);
    const delay = clamp(finiteOr(options.delay, 0), 0, 2);
    const requestedTime = finiteOr(options.when, this.context.currentTime + delay);
    const time = Math.max(this.context.currentTime, requestedTime);
    const output = this._eventOutput(volume, pan);

    let duration = 0;
    switch (name) {
      case 'swingLight': duration = this._swingLight(output, time, pitch); break;
      case 'swingHeavy': duration = this._swingHeavy(output, time, pitch); break;
      case 'hitLight': duration = this._hitLight(output, time, pitch); break;
      case 'hitHeavy': duration = this._hitHeavy(output, time, pitch); break;
      case 'block': duration = this._block(output, time, pitch); break;
      case 'dodge': duration = this._dodge(output, time, pitch); break;
      case 'jump': duration = this._jump(output, time, pitch); break;
      case 'land': duration = this._land(output, time, pitch); break;
      case 'grab': duration = this._grab(output, time, pitch); break;
      case 'throw': duration = this._throw(output, time, pitch); break;
      case 'special': duration = this._special(output, time, pitch); break;
      case 'hurt': duration = this._hurt(output, time, pitch); break;
      case 'KO': duration = this._ko(output, time, pitch); break;
      case 'pickup': duration = this._pickup(output, time, pitch); break;
      case 'encounter': duration = this._encounter(output, time, pitch); break;
      case 'boss': duration = this._boss(output, time, pitch); break;
      case 'victory': duration = this._victory(output, time, pitch); break;
      case 'ui': duration = this._ui(output, time, pitch); break;
      default:
        output.disconnect();
        return false;
    }

    this._retireOutput(output, time + duration);
    return true;
  }

  stopMusic() {
    this.musicRequested = false;
    if (this.musicTimer !== null) {
      globalThis.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }

    if (!this.musicOutput || !this.context) return;
    const output = this.musicOutput;
    this.musicOutput = null;
    const now = this.context.currentTime;
    output.gain.cancelScheduledValues(now);
    output.gain.setValueAtTime(Math.max(0.0001, output.gain.value), now);
    output.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    globalThis.setTimeout(() => {
      try { output.disconnect(); } catch { /* Already disconnected. */ }
    }, 240);
  }

  _volumeFrom(settings, longKey, shortKey, fallback) {
    const value = settings[longKey] ?? settings[shortKey];
    return clamp(finiteOr(value, fallback), 0, 1);
  }

  _buildGraph() {
    const context = this.context;
    this.masterGain = context.createGain();
    this.musicGain = context.createGain();
    this.sfxGain = context.createGain();
    this.compressor = context.createDynamicsCompressor();

    this.compressor.threshold.value = -10;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.18;

    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.compressor);
    this.compressor.connect(context.destination);
    this._applyVolumes(true);
  }

  _applyVolumes(immediate) {
    if (!this.context || !this.masterGain) return;
    const time = this.context.currentTime;
    const pairs = [
      [this.masterGain, this.volumes.master],
      [this.musicGain, this.volumes.music],
      [this.sfxGain, this.volumes.sfx]
    ];
    for (const [node, value] of pairs) {
      node.gain.cancelScheduledValues(time);
      if (immediate) node.gain.setValueAtTime(value, time);
      else node.gain.setTargetAtTime(value, time, 0.018);
    }
  }

  _eventOutput(volume, pan) {
    const output = this.context.createGain();
    output.gain.value = volume;
    if (typeof this.context.createStereoPanner === 'function') {
      const panner = this.context.createStereoPanner();
      panner.pan.value = pan;
      output.connect(panner);
      panner.connect(this.sfxGain);
      output._panner = panner;
    } else {
      output.connect(this.sfxGain);
    }
    return output;
  }

  _retireOutput(output, endTime) {
    const wait = Math.max(0, (endTime - this.context.currentTime) * 1000) + 100;
    globalThis.setTimeout(() => {
      try { output.disconnect(); } catch { /* Already disconnected. */ }
      try { output._panner?.disconnect(); } catch { /* Already disconnected. */ }
    }, wait);
  }

  _tone(target, options) {
    const time = options.time;
    const attack = Math.max(0.001, options.attack ?? 0.003);
    const duration = Math.max(0.005, options.duration ?? 0.08);
    const release = Math.max(0.005, options.release ?? 0.08);
    const end = time + attack + duration + release;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.setValueAtTime(Math.max(1, options.frequency), time);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, options.endFrequency),
        time + attack + duration
      );
    }
    if (options.detune) oscillator.detune.setValueAtTime(options.detune, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, options.gain ?? 0.1), time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(target);
    oscillator.start(time);
    oscillator.stop(end + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    return end;
  }

  _noise(target, options) {
    const time = options.time;
    const attack = Math.max(0.001, options.attack ?? 0.002);
    const duration = Math.max(0.005, options.duration ?? 0.05);
    const release = Math.max(0.005, options.release ?? 0.06);
    const end = time + attack + duration + release;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = this._getNoiseBuffer();
    source.playbackRate.value = options.rate ?? 1;
    filter.type = options.filter ?? 'bandpass';
    filter.frequency.setValueAtTime(Math.max(20, options.frequency ?? 1500), time);
    if (options.endFrequency) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(20, options.endFrequency),
        time + attack + duration
      );
    }
    filter.Q.value = options.q ?? 0.8;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, options.gain ?? 0.08), time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(target);
    source.start(time);
    source.stop(end + 0.02);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    return end;
  }

  _getNoiseBuffer() {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.max(1, Math.floor(this.context.sampleRate * 0.75));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.35 + white * 0.65;
      channel[i] = previous;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  _swingLight(out, time, pitch) {
    this._noise(out, { time, gain: 0.16, filter: 'bandpass', frequency: 2600 * pitch, endFrequency: 850 * pitch, q: 0.65, attack: 0.004, duration: 0.045, release: 0.07, rate: 1.4 });
    this._tone(out, { time, gain: 0.045, type: 'triangle', frequency: 520 * pitch, endFrequency: 210 * pitch, attack: 0.002, duration: 0.04, release: 0.05 });
    return 0.2;
  }

  _swingHeavy(out, time, pitch) {
    this._noise(out, { time, gain: 0.23, filter: 'lowpass', frequency: 1800 * pitch, endFrequency: 260 * pitch, q: 1.1, attack: 0.008, duration: 0.11, release: 0.12, rate: 0.72 });
    this._tone(out, { time, gain: 0.085, type: 'sawtooth', frequency: 210 * pitch, endFrequency: 72 * pitch, attack: 0.004, duration: 0.1, release: 0.1 });
    return 0.35;
  }

  _hitLight(out, time, pitch) {
    this._noise(out, { time, gain: 0.3, filter: 'highpass', frequency: 1800 * pitch, q: 0.5, attack: 0.001, duration: 0.012, release: 0.045 });
    this._tone(out, { time, gain: 0.18, type: 'triangle', frequency: 145 * pitch, endFrequency: 82 * pitch, attack: 0.001, duration: 0.025, release: 0.07 });
    return 0.16;
  }

  _hitHeavy(out, time, pitch) {
    this._noise(out, { time, gain: 0.42, filter: 'bandpass', frequency: 820 * pitch, endFrequency: 230 * pitch, q: 0.7, attack: 0.001, duration: 0.035, release: 0.12 });
    this._tone(out, { time, gain: 0.32, type: 'sine', frequency: 118 * pitch, endFrequency: 38 * pitch, attack: 0.001, duration: 0.065, release: 0.18 });
    this._tone(out, { time: time + 0.012, gain: 0.1, type: 'square', frequency: 205 * pitch, endFrequency: 92 * pitch, attack: 0.001, duration: 0.025, release: 0.06 });
    return 0.36;
  }

  _block(out, time, pitch) {
    this._noise(out, { time, gain: 0.18, filter: 'highpass', frequency: 3600 * pitch, q: 1.6, attack: 0.001, duration: 0.015, release: 0.09 });
    this._tone(out, { time, gain: 0.13, type: 'sine', frequency: 780 * pitch, endFrequency: 750 * pitch, attack: 0.001, duration: 0.05, release: 0.18 });
    this._tone(out, { time, gain: 0.07, type: 'sine', frequency: 1183 * pitch, endFrequency: 1110 * pitch, attack: 0.001, duration: 0.035, release: 0.2 });
    return 0.34;
  }

  _dodge(out, time, pitch) {
    this._noise(out, { time, gain: 0.14, filter: 'bandpass', frequency: 430 * pitch, endFrequency: 3100 * pitch, q: 0.8, attack: 0.012, duration: 0.09, release: 0.11, rate: 1.25 });
    this._tone(out, { time, gain: 0.035, type: 'sine', frequency: 170 * pitch, endFrequency: 340 * pitch, attack: 0.008, duration: 0.07, release: 0.08 });
    return 0.3;
  }

  _jump(out, time, pitch) {
    this._tone(out, { time, gain: 0.12, type: 'triangle', frequency: 175 * pitch, endFrequency: 405 * pitch, attack: 0.004, duration: 0.09, release: 0.1 });
    this._noise(out, { time, gain: 0.055, filter: 'highpass', frequency: 1200 * pitch, attack: 0.004, duration: 0.035, release: 0.07 });
    return 0.25;
  }

  _land(out, time, pitch) {
    this._tone(out, { time, gain: 0.2, type: 'sine', frequency: 92 * pitch, endFrequency: 42 * pitch, attack: 0.001, duration: 0.045, release: 0.13 });
    this._noise(out, { time, gain: 0.2, filter: 'lowpass', frequency: 520 * pitch, endFrequency: 150 * pitch, attack: 0.001, duration: 0.025, release: 0.1, rate: 0.62 });
    return 0.24;
  }

  _grab(out, time, pitch) {
    this._noise(out, { time, gain: 0.22, filter: 'bandpass', frequency: 1250 * pitch, endFrequency: 520 * pitch, q: 1.2, attack: 0.001, duration: 0.018, release: 0.06 });
    this._tone(out, { time: time + 0.018, gain: 0.11, type: 'square', frequency: 128 * pitch, endFrequency: 106 * pitch, attack: 0.001, duration: 0.03, release: 0.08 });
    return 0.18;
  }

  _throw(out, time, pitch) {
    this._noise(out, { time, gain: 0.2, filter: 'bandpass', frequency: 1800 * pitch, endFrequency: 300 * pitch, q: 0.65, attack: 0.006, duration: 0.12, release: 0.11, rate: 0.8 });
    this._tone(out, { time, gain: 0.12, type: 'sawtooth', frequency: 165 * pitch, endFrequency: 58 * pitch, attack: 0.003, duration: 0.11, release: 0.12 });
    this._tone(out, { time: time + 0.14, gain: 0.23, type: 'sine', frequency: 82 * pitch, endFrequency: 36 * pitch, attack: 0.001, duration: 0.045, release: 0.13 });
    return 0.45;
  }

  _special(out, time, pitch) {
    this._tone(out, { time, gain: 0.12, type: 'sawtooth', frequency: 105 * pitch, endFrequency: 680 * pitch, attack: 0.015, duration: 0.2, release: 0.15 });
    this._tone(out, { time: time + 0.02, gain: 0.1, type: 'triangle', frequency: 158 * pitch, endFrequency: 920 * pitch, attack: 0.01, duration: 0.19, release: 0.16 });
    this._noise(out, { time: time + 0.15, gain: 0.24, filter: 'bandpass', frequency: 800 * pitch, endFrequency: 4200 * pitch, q: 0.8, attack: 0.008, duration: 0.11, release: 0.2 });
    this._tone(out, { time: time + 0.25, gain: 0.23, type: 'sine', frequency: 132 * pitch, endFrequency: 44 * pitch, attack: 0.001, duration: 0.06, release: 0.25 });
    return 0.7;
  }

  _hurt(out, time, pitch) {
    this._tone(out, { time, gain: 0.12, type: 'sawtooth', frequency: 235 * pitch, endFrequency: 118 * pitch, attack: 0.003, duration: 0.09, release: 0.12 });
    this._tone(out, { time: time + 0.018, gain: 0.07, type: 'square', frequency: 315 * pitch, endFrequency: 172 * pitch, attack: 0.003, duration: 0.07, release: 0.1 });
    return 0.3;
  }

  _ko(out, time, pitch) {
    this._hitHeavy(out, time, pitch * 0.82);
    this._tone(out, { time: time + 0.07, gain: 0.18, type: 'sawtooth', frequency: 155 * pitch, endFrequency: 42 * pitch, attack: 0.008, duration: 0.32, release: 0.35 });
    this._noise(out, { time: time + 0.08, gain: 0.14, filter: 'lowpass', frequency: 900 * pitch, endFrequency: 120 * pitch, attack: 0.003, duration: 0.18, release: 0.3 });
    return 0.95;
  }

  _pickup(out, time, pitch) {
    [0, 0.065, 0.13].forEach((offset, index) => {
      const notes = [523.25, 659.25, 783.99];
      this._tone(out, { time: time + offset, gain: 0.09, type: 'sine', frequency: notes[index] * pitch, attack: 0.002, duration: 0.035, release: 0.13 });
    });
    return 0.42;
  }

  _encounter(out, time, pitch) {
    this._tone(out, { time, gain: 0.22, type: 'sine', frequency: 88 * pitch, endFrequency: 42 * pitch, attack: 0.002, duration: 0.07, release: 0.2 });
    this._tone(out, { time: time + 0.08, gain: 0.09, type: 'triangle', frequency: 293.66 * pitch, attack: 0.004, duration: 0.08, release: 0.18 });
    this._tone(out, { time: time + 0.19, gain: 0.1, type: 'triangle', frequency: 349.23 * pitch, attack: 0.004, duration: 0.09, release: 0.2 });
    return 0.55;
  }

  _boss(out, time, pitch) {
    this._tone(out, { time, gain: 0.28, type: 'sawtooth', frequency: 73.42 * pitch, endFrequency: 55 * pitch, attack: 0.025, duration: 0.45, release: 0.35 });
    this._tone(out, { time, gain: 0.2, type: 'sine', frequency: 110 * pitch, endFrequency: 82.41 * pitch, attack: 0.02, duration: 0.48, release: 0.38 });
    this._noise(out, { time, gain: 0.12, filter: 'lowpass', frequency: 470 * pitch, endFrequency: 130 * pitch, attack: 0.018, duration: 0.32, release: 0.4, rate: 0.55 });
    [0, 0.23, 0.46].forEach((offset) => {
      this._tone(out, { time: time + offset, gain: 0.18, type: 'sine', frequency: 74 * pitch, endFrequency: 35 * pitch, attack: 0.001, duration: 0.055, release: 0.15 });
    });
    return 1.15;
  }

  _victory(out, time, pitch) {
    const notes = [293.66, 349.23, 440, 587.33, 698.46];
    notes.forEach((frequency, index) => {
      const offset = index * 0.105;
      this._tone(out, { time: time + offset, gain: index === notes.length - 1 ? 0.14 : 0.1, type: 'triangle', frequency: frequency * pitch, attack: 0.004, duration: index === notes.length - 1 ? 0.18 : 0.055, release: index === notes.length - 1 ? 0.42 : 0.14 });
      this._tone(out, { time: time + offset, gain: 0.035, type: 'sine', frequency: frequency * pitch * 2, attack: 0.003, duration: 0.05, release: 0.18 });
    });
    return 1.25;
  }

  _ui(out, time, pitch) {
    this._tone(out, { time, gain: 0.075, type: 'sine', frequency: 610 * pitch, endFrequency: 720 * pitch, attack: 0.002, duration: 0.025, release: 0.07 });
    return 0.14;
  }

  _beginMusic() {
    if (this.musicTimer !== null || !this.musicRequested) return;
    this.musicOutput = this.context.createGain();
    this.musicOutput.gain.setValueAtTime(0.0001, this.context.currentTime);
    this.musicOutput.gain.exponentialRampToValueAtTime(1, this.context.currentTime + 0.32);
    this.musicOutput.connect(this.musicGain);
    this.musicStep = 0;
    this.musicNextTime = this.context.currentTime + 0.05;
    this._scheduleMusic();
    this.musicTimer = globalThis.setInterval(() => this._scheduleMusic(), 70);
  }

  _scheduleMusic() {
    if (!this.context || !this.musicOutput || !this.musicRequested) return;
    const stepDuration = (60 / this.musicBpm) / 4;
    const now = this.context.currentTime;
    if (this.musicNextTime < now - stepDuration) this.musicNextTime = now + 0.04;
    while (this.musicNextTime < now + 0.2) {
      this._musicStep(this.musicStep, this.musicNextTime);
      this.musicStep += 1;
      this.musicNextTime += stepDuration;
    }
  }

  _musicStep(stepNumber, time) {
    const step = stepNumber % 16;
    const bar = Math.floor(stepNumber / 16);
    const intensity = this.intensity;
    const out = this.musicOutput;
    if (!out) return;

    if (step === 0 || step === 8 || (intensity > 0.72 && step === 10)) {
      this._musicKick(out, time, step === 0 ? 1 : 0.78);
    }
    if (step === 4 || step === 12) this._musicBrush(out, time, step === 12 ? 0.92 : 0.78);
    if ((intensity > 0.15 && [2, 6, 10, 14].includes(step))
      || (intensity > 0.68 && step % 2 === 1)) {
      this._musicShaker(out, time, step % 4 === 2 ? 1 : 0.62);
    }

    const bassPattern = {
      0: 73.42,
      3: 73.42,
      6: 110,
      8: 65.41,
      11: 87.31,
      14: 110
    };
    if (bassPattern[step] && (step === 0 || step === 8 || intensity > 0.28)) {
      this._musicBass(out, time, bassPattern[step], step === 0 || step === 8 ? 1 : 0.72);
    }

    if (step === 0) this._musicDrone(out, time, bar);
    if (intensity > 0.38 && [3, 7, 11, 15].includes(step)) {
      const phrases = [293.66, 349.23, 392, 440, 523.25, 440, 392, 349.23];
      const note = phrases[(bar * 2 + Math.floor(step / 4)) % phrases.length];
      this._musicPluck(out, time, note, step === 15 ? 0.75 : 1);
    }
    if (intensity > 0.82 && (step === 5 || step === 13)) {
      this._musicPluck(out, time, step === 5 ? 587.33 : 523.25, 0.7);
    }
    if (intensity < 0.7 && step === 15 && bar % 4 === 3) this._musicCroak(out, time);
  }

  _musicKick(out, time, strength) {
    this._tone(out, { time, gain: 0.13 * strength, type: 'sine', frequency: 105, endFrequency: 43, attack: 0.001, duration: 0.055, release: 0.16 });
    this._noise(out, { time, gain: 0.018 * strength, filter: 'lowpass', frequency: 260, attack: 0.001, duration: 0.012, release: 0.04 });
  }

  _musicBrush(out, time, strength) {
    this._noise(out, { time, gain: 0.045 * strength, filter: 'bandpass', frequency: 1650, endFrequency: 920, q: 0.55, attack: 0.003, duration: 0.035, release: 0.1, rate: 0.84 });
    this._tone(out, { time, gain: 0.028 * strength, type: 'triangle', frequency: 164, endFrequency: 118, attack: 0.001, duration: 0.025, release: 0.07 });
  }

  _musicShaker(out, time, strength) {
    this._noise(out, { time, gain: 0.018 * strength, filter: 'highpass', frequency: 5100, q: 0.35, attack: 0.001, duration: 0.014, release: 0.045, rate: 1.55 });
  }

  _musicBass(out, time, frequency, strength) {
    this._tone(out, { time, gain: 0.075 * strength, type: 'triangle', frequency, endFrequency: frequency * 0.985, attack: 0.008, duration: 0.12, release: 0.16 });
    this._tone(out, { time, gain: 0.022 * strength, type: 'sine', frequency: frequency / 2, attack: 0.006, duration: 0.1, release: 0.14 });
  }

  _musicDrone(out, time, bar) {
    const alternate = bar % 4 >= 2;
    const root = alternate ? 65.41 : 73.42;
    const fifth = alternate ? 98 : 110;
    this._tone(out, { time, gain: 0.016, type: 'sine', frequency: root, attack: 0.16, duration: 1.7, release: 0.7 });
    this._tone(out, { time, gain: 0.009, type: 'triangle', frequency: fifth, attack: 0.22, duration: 1.45, release: 0.75 });
  }

  _musicPluck(out, time, frequency, strength) {
    this._tone(out, { time, gain: 0.034 * strength, type: 'triangle', frequency, endFrequency: frequency * 0.995, attack: 0.002, duration: 0.045, release: 0.16 });
    this._tone(out, { time, gain: 0.012 * strength, type: 'sine', frequency: frequency * 2.01, attack: 0.001, duration: 0.025, release: 0.1 });
  }

  _musicCroak(out, time) {
    this._tone(out, { time, gain: 0.017, type: 'sine', frequency: 176, endFrequency: 122, attack: 0.012, duration: 0.07, release: 0.09 });
    this._tone(out, { time: time + 0.105, gain: 0.012, type: 'sine', frequency: 158, endFrequency: 111, attack: 0.01, duration: 0.055, release: 0.08 });
  }
}
