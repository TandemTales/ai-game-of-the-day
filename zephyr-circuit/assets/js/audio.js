/* =====================================================================
   ZEPHYR CIRCUIT — audio.js
   Procedural racing mix: engine, tyres, drift charge, one-shots and music.
   Owner: agent-audio. This file intentionally has no asset or runtime fetch.

   The live graph and the OfflineAudioContext graph use the same synthesis
   functions. The latter is exposed through __renderOffline for the audio
   scope harness; it is diagnostic only and never runs during a race.
   ===================================================================== */
(function (global) {
  'use strict';

  var ZC = global.ZC || (global.ZC = {});
  var A = ZC.Audio = {};
  var TAU = Math.PI * 2;
  var ctx = null;
  var live = null;
  var muted = false;
  var initialized = false;

  var MUSIC_SECONDS = 16;
  var MUSIC_BPM = 126;
  var MUSIC_STEP = 60 / MUSIC_BPM / 2;
  var MUSIC_BAR = MUSIC_STEP * 8;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function num(v, fallback) { return typeof v === 'number' && isFinite(v) ? v : fallback; }
  function audioTime(c) { return num(c && c.currentTime, 0); }
  function has(c, name) { return !!(c && typeof c[name] === 'function'); }

  function safeConnect(node, target) {
    if (!node || !target || typeof node.connect !== 'function') return;
    try { node.connect(target); } catch (e) {}
  }

  function gain(c, value) {
    if (!has(c, 'createGain')) return null;
    var n = c.createGain();
    if (n.gain) n.gain.value = value;
    return n;
  }

  function filter(c, type, frequency, q) {
    if (!has(c, 'createBiquadFilter')) return null;
    var n = c.createBiquadFilter();
    n.type = type;
    if (n.frequency) n.frequency.value = frequency;
    if (n.Q) n.Q.value = q || 0.7;
    return n;
  }

  function pan(c, value) {
    if (!has(c, 'createStereoPanner')) return null;
    var n = c.createStereoPanner();
    if (n.pan) n.pan.value = value;
    return n;
  }

  function setParam(p, value, time, smooth) {
    if (!p) return;
    value = num(value, 0);
    time = num(time, 0);
    try {
      if (smooth && typeof p.setTargetAtTime === 'function') {
        p.setTargetAtTime(value, time, smooth);
      } else if (typeof p.setValueAtTime === 'function') {
        p.setValueAtTime(value, time);
      } else {
        p.value = value;
      }
    } catch (e) {
      try { p.value = value; } catch (ignore) {}
    }
  }

  function hashNoise(seed) {
    var x = (seed | 0) + 0x6D2B79F5;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967295 * 2 - 1;
  }

  function noiseBuffer(c, seconds, seed) {
    if (!has(c, 'createBuffer')) return null;
    var length = Math.max(1, Math.floor(c.sampleRate * seconds));
    var b = c.createBuffer(1, length, c.sampleRate);
    var d = b.getChannelData(0);
    var brown = 0;
    var pink = 0;
    for (var i = 0; i < length; i++) {
      var white = hashNoise(seed + i * 17);
      brown = brown * 0.985 + white * 0.12;
      pink = pink * 0.92 + white * 0.08;
      d[i] = clamp(white * 0.62 + brown * 0.45 + pink * 0.30, -1, 1);
    }
    return b;
  }

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  /* A small, loopable eight-bar cue: kick and hat establish motion, a warm
     minor pad gives the sky-island identity, and the syncopated lead leaves
     room for the engine and event stingers. It is generated once per graph. */
  function musicBuffer(c, seconds, variation) {
    if (!has(c, 'createBuffer')) return null;
    var rate = c.sampleRate;
    var length = Math.max(1, Math.floor(rate * seconds));
    var b = c.createBuffer(2, length, rate);
    var left = b.getChannelData(0), right = b.getChannelData(1);
    var roots = [50, 50, 46, 46, 53, 53, 48, 48];
    var lead = [0, 3, 7, 10, 7, 3, 2, 3, 0, 3, 7, 12, 10, 7, 3, 2];
    var chord = [0, 3, 7, 10];
    var barSeconds = MUSIC_BAR;
    var beatSeconds = MUSIC_STEP * 2;
    var level = variation === 'results' ? 0.82 : variation === 'menu' ? 0.68 : 1;
    var phase = variation === 'drift' ? 0.13 : 0;

    for (var i = 0; i < length; i++) {
      var t = i / rate;
      var barFloat = t / barSeconds;
      var bar = Math.floor(barFloat) % roots.length;
      var inBar = t - Math.floor(barFloat) * barSeconds;
      var beat = inBar / beatSeconds;
      var root = roots[bar];
      var l = 0, r = 0;

      var padEnv = 0.72 + 0.28 * Math.sin((inBar / barSeconds) * Math.PI);
      for (var ci = 0; ci < chord.length; ci++) {
        var hz = midi(root + chord[ci] + 12);
        var p = Math.sin(TAU * hz * t) * 0.010;
        p += Math.sin(TAU * (hz * 1.003) * t + 0.7) * 0.004;
        l += p * padEnv;
        r += Math.sin(TAU * (hz * 0.997) * t + 0.4) * 0.010 * padEnv;
      }

      var beatIndex = Math.floor(beat) % 4;
      var beatPhase = inBar - Math.floor(inBar / beatSeconds) * beatSeconds;
      var bassNote = root - (beatIndex === 2 ? 12 : 0);
      var bassEnv = Math.exp(-beatPhase * 7.5);
      var bass = Math.sin(TAU * midi(bassNote) * t) * 0.052 * bassEnv;
      bass += Math.sin(TAU * midi(bassNote + 12) * t) * 0.012 * bassEnv;
      l += bass; r += bass * 0.96;

      var step = Math.floor(inBar / MUSIC_STEP) % 16;
      var noteIndex = (step + bar * 3) % lead.length;
      var noteStart = inBar - Math.floor(inBar / MUSIC_STEP) * MUSIC_STEP;
      var noteEnv = Math.exp(-noteStart * 10.5);
      if (step % 4 !== 1 && step !== 13) {
        var note = root + 24 + lead[noteIndex];
        var leadHz = midi(note);
        var mel = Math.sin(TAU * leadHz * t + phase) * 0.020 * noteEnv;
        mel += Math.sin(TAU * leadHz * 2 * t) * 0.006 * noteEnv;
        l += mel * 0.74; r += mel * 1.15;
      }

      var kickPhase = t - Math.floor(t / beatSeconds) * beatSeconds;
      var kickEnv = Math.exp(-kickPhase * 25);
      var kickHz = 68 - 30 * (1 - Math.exp(-kickPhase * 18));
      var kick = Math.sin(TAU * kickHz * t) * 0.045 * kickEnv;
      l += kick; r += kick;
      var half = t - Math.floor((t + beatSeconds * 0.5) / beatSeconds) * beatSeconds;
      var snareEnv = Math.exp(-Math.abs(half) * 38);
      var snare = hashNoise(i + 7123) * 0.018 * snareEnv;
      if (Math.abs(half) < 0.025) { l += snare; r += snare * 0.9; }
      var hatPhase = t - Math.floor(t / MUSIC_STEP) * MUSIC_STEP;
      var hatEnv = Math.exp(-hatPhase * 62);
      var hat = hashNoise(i + 991) * 0.010 * hatEnv;
      l += hat * 0.78; r += hat * 1.12;

      var movement = Math.sin(TAU * t / (barSeconds * 2)) * 0.004;
      left[i] = clamp(l * level + movement, -0.7, 0.7);
      right[i] = clamp(r * level - movement, -0.7, 0.7);
    }
    return b;
  }

  function makeCompressor(c, source) {
    if (!has(c, 'createDynamicsCompressor')) return source;
    var comp = c.createDynamicsCompressor();
    if (comp.threshold) comp.threshold.value = -15;
    if (comp.knee) comp.knee.value = 18;
    if (comp.ratio) comp.ratio.value = 8;
    if (comp.attack) comp.attack.value = 0.003;
    if (comp.release) comp.release.value = 0.16;
    safeConnect(source, comp);
    return comp;
  }

  function createGraph(c, variation, offline) {
    if (!c || !has(c, 'createGain')) return null;
    var master = gain(c, offline ? 0.78 : (muted ? 0 : 0.78));
    var mix = gain(c, 0.92);
    var engineBus = gain(c, 0.82);
    var sfxBus = gain(c, 0.72);
    var musicBus = gain(c, 0.24);
    var scrubBus = gain(c, 0.42);
    var driftBus = gain(c, 0.44);
    if (!master || !mix || !engineBus || !sfxBus || !musicBus || !scrubBus || !driftBus) return null;

    safeConnect(engineBus, mix);
    safeConnect(sfxBus, mix);
    safeConnect(musicBus, mix);
    safeConnect(scrubBus, mix);
    safeConnect(driftBus, mix);
    var limited = makeCompressor(c, mix);
    safeConnect(limited, master);
    safeConnect(master, c.destination);

    var g = {
      ctx: c,
      master: master,
      musicBus: musicBus,
      engineBus: engineBus,
      sfxBus: sfxBus,
      scrubBus: scrubBus,
      driftBus: driftBus,
      gear: -1,
      tier: 0,
      musicGain: musicBus.gain,
      engine: {},
      scrub: {},
      drift: {}
    };

    var low = c.createOscillator(); low.type = 'sawtooth'; low.frequency.value = 55;
    var lowFilter = filter(c, 'lowpass', 680, 1.1);
    var lowGain = gain(c, 0.045);
    safeConnect(low, lowFilter || lowGain); safeConnect(lowFilter, lowGain); safeConnect(lowGain, engineBus);
    if (has(low, 'start')) low.start();

    var harmonic = c.createOscillator(); harmonic.type = 'square'; harmonic.frequency.value = 110;
    var harmonicFilter = filter(c, 'bandpass', 780, 1.5);
    var harmonicGain = gain(c, 0.012);
    safeConnect(harmonic, harmonicFilter || harmonicGain); safeConnect(harmonicFilter, harmonicGain); safeConnect(harmonicGain, engineBus);
    if (has(harmonic, 'start')) harmonic.start();

    var pulse = c.createOscillator(); pulse.type = 'triangle'; pulse.frequency.value = 165;
    var pulseGain = gain(c, 0.008);
    safeConnect(pulse, pulseGain); safeConnect(pulseGain, engineBus);
    if (has(pulse, 'start')) pulse.start();

    var exhaustSource = has(c, 'createBufferSource') ? c.createBufferSource() : null;
    var exhaustFilter = filter(c, 'lowpass', 300, 0.8);
    var exhaustGain = gain(c, 0.012);
    if (exhaustSource) {
      exhaustSource.buffer = noiseBuffer(c, 1.5, 4101); exhaustSource.loop = true;
      safeConnect(exhaustSource, exhaustFilter || exhaustGain); safeConnect(exhaustFilter, exhaustGain); safeConnect(exhaustGain, engineBus);
      if (has(exhaustSource, 'start')) exhaustSource.start();
    }
    g.engine.low = low;
    g.engine.lowFilter = lowFilter;
    g.engine.lowGain = lowGain;
    g.engine.harmonic = harmonic;
    g.engine.harmonicFilter = harmonicFilter;
    g.engine.harmonicGain = harmonicGain;
    g.engine.pulse = pulse;
    g.engine.pulseGain = pulseGain;
    g.engine.exhaustFilter = exhaustFilter;
    g.engine.exhaustGain = exhaustGain;

    var scrubSource = has(c, 'createBufferSource') ? c.createBufferSource() : null;
    var scrubHigh = filter(c, 'highpass', 520, 0.7);
    var scrubBand = filter(c, 'bandpass', 1850, 1.15);
    var scrubGain = gain(c, 0);
    var scrubPan = pan(c, 0);
    if (scrubSource) {
      scrubSource.buffer = noiseBuffer(c, 2, 773); scrubSource.loop = true;
      safeConnect(scrubSource, scrubHigh || scrubBand || scrubGain); safeConnect(scrubHigh, scrubBand || scrubGain); safeConnect(scrubBand, scrubGain);
      if (scrubPan) { safeConnect(scrubGain, scrubPan); safeConnect(scrubPan, scrubBus); }
      else safeConnect(scrubGain, scrubBus);
      if (has(scrubSource, 'start')) scrubSource.start();
    }
    var scrubLowSource = has(c, 'createBufferSource') ? c.createBufferSource() : null;
    var scrubLowFilter = filter(c, 'lowpass', 480, 0.9);
    var scrubLowGain = gain(c, 0);
    if (scrubLowSource) {
      scrubLowSource.buffer = noiseBuffer(c, 2, 774); scrubLowSource.loop = true;
      safeConnect(scrubLowSource, scrubLowFilter || scrubLowGain); safeConnect(scrubLowFilter, scrubLowGain); safeConnect(scrubLowGain, scrubBus);
      if (has(scrubLowSource, 'start')) scrubLowSource.start();
    }
    g.scrub.source = scrubSource;
    g.scrub.gain = scrubGain;
    g.scrub.lowGain = scrubLowGain;
    g.scrub.band = scrubBand;
    g.scrub.lowFilter = scrubLowFilter;
    g.scrub.pan = scrubPan;

    var drift = c.createOscillator(); drift.type = 'triangle'; drift.frequency.value = 220;
    var driftFilter = filter(c, 'bandpass', 700, 2.2);
    var driftGain = gain(c, 0);
    safeConnect(drift, driftFilter || driftGain); safeConnect(driftFilter, driftGain); safeConnect(driftGain, driftBus);
    if (has(drift, 'start')) drift.start();
    var driftSub = c.createOscillator(); driftSub.type = 'sine'; driftSub.frequency.value = 110;
    var driftSubGain = gain(c, 0);
    safeConnect(driftSub, driftSubGain); safeConnect(driftSubGain, driftBus);
    if (has(driftSub, 'start')) driftSub.start();
    g.drift.osc = drift;
    g.drift.filter = driftFilter;
    g.drift.gain = driftGain;
    g.drift.sub = driftSub;
    g.drift.subGain = driftSubGain;

    var mb = musicBuffer(c, MUSIC_SECONDS, variation || 'race');
    if (mb && has(c, 'createBufferSource')) {
      var music = c.createBufferSource(); music.buffer = mb; music.loop = true;
      safeConnect(music, musicBus);
      if (has(music, 'start')) music.start();
      g.music = music;
    }
    if (variation === 'menu') setParam(g.musicGain, 0.13, audioTime(c), offline ? 0 : 0.04);
    if (variation === 'drift') setParam(g.musicGain, 0.27, audioTime(c), offline ? 0 : 0.04);
    if (variation === 'results') setParam(g.musicGain, 0.18, audioTime(c), offline ? 0 : 0.04);
    return g;
  }

  function startEnvelope(p, t, attack, peak, hold, release) {
    if (!p) return;
    var a = t + Math.max(0.001, attack);
    var h = a + Math.max(0.001, hold);
    var r = h + Math.max(0.005, release);
    try {
      if (typeof p.cancelScheduledValues === 'function') p.cancelScheduledValues(t);
      if (typeof p.setValueAtTime === 'function') p.setValueAtTime(0.0001, t);
      if (typeof p.linearRampToValueAtTime === 'function') p.linearRampToValueAtTime(peak, a);
      if (typeof p.setValueAtTime === 'function') p.setValueAtTime(peak * 0.82, h);
      if (typeof p.exponentialRampToValueAtTime === 'function') p.exponentialRampToValueAtTime(0.0001, r);
      else if (typeof p.linearRampToValueAtTime === 'function') p.linearRampToValueAtTime(0, r);
    } catch (e) {}
    return r;
  }

  function tone(c, destination, opts) {
    if (!c || !destination || !has(c, 'createOscillator') || !has(c, 'createGain')) return;
    opts = opts || {};
    var t = num(opts.time, audioTime(c));
    var dur = Math.max(0.025, num(opts.duration, 0.2));
    var o = c.createOscillator(); o.type = opts.type || 'sine';
    var g = gain(c, 0);
    var f = opts.filter ? filter(c, opts.filter.type, opts.filter.frequency, opts.filter.q) : null;
    if (o.frequency) o.frequency.setValueAtTime(num(opts.frequency, 440), t);
    if (opts.toFrequency && o.frequency) {
      var to = Math.max(1, num(opts.toFrequency, opts.frequency));
      try {
        if (typeof o.frequency.exponentialRampToValueAtTime === 'function') o.frequency.exponentialRampToValueAtTime(to, t + dur);
        else o.frequency.setValueAtTime(to, t + dur);
      } catch (e) {}
    }
    if (opts.detune && o.detune) o.detune.value = opts.detune;
    safeConnect(o, f || g); safeConnect(f, g); safeConnect(g, destination);
    var end = startEnvelope(g.gain, t, num(opts.attack, 0.006), num(opts.volume, 0.08), dur * 0.62, dur * 0.38);
    try { o.start(t); o.stop(end + 0.025); } catch (e2) {}
  }

  function noiseBurst(c, destination, opts) {
    if (!c || !destination || !has(c, 'createBufferSource') || !has(c, 'createGain')) return;
    opts = opts || {};
    var t = num(opts.time, audioTime(c));
    var dur = Math.max(0.02, num(opts.duration, 0.2));
    var src = c.createBufferSource(); src.buffer = noiseBuffer(c, Math.max(0.3, dur + 0.08), num(opts.seed, 1200));
    var f = filter(c, opts.filterType || 'bandpass', num(opts.frequency, 1600), num(opts.q, 0.8));
    var g = gain(c, 0); var p = pan(c, num(opts.pan, 0));
    safeConnect(src, f); safeConnect(f, g); safeConnect(g, p || destination); safeConnect(p, destination);
    var end = startEnvelope(g.gain, t, num(opts.attack, 0.004), num(opts.volume, 0.08), dur * 0.42, dur * 0.58);
    try { src.start(t); src.stop(end + 0.02); } catch (e) {}
  }

  function playSfx(g, name, detail, at) {
    if (!g || !g.ctx || (muted && g === live)) return;
    var c = g.ctx, d = detail || {}, t = num(at, audioTime(c));
    var dest = g.sfxBus || g.master;
    var tier = clamp(Math.round(num(d.tier, 1)), 1, 3);
    var itemPitch = d.item === 'dart' ? 1.12 : d.item === 'thunderhead' ? 0.82 : d.item === 'aegis' ? 1.28 : 1;
    if (name === 'shift') {
      tone(c, dest, { time: t, frequency: 170, toFrequency: 92, duration: 0.105, type: 'square', volume: 0.055, filter: { type: 'lowpass', frequency: 720, q: 1 } });
      tone(c, dest, { time: t + 0.026, frequency: 640, toFrequency: 390, duration: 0.09, type: 'triangle', volume: 0.035, filter: { type: 'bandpass', frequency: 920, q: 1.5 } });
      noiseBurst(c, dest, { time: t, duration: 0.028, frequency: 2400, volume: 0.034, filterType: 'highpass', seed: 400 + tier });
    } else if (name === 'boost') {
      var base = 170 + tier * 34;
      tone(c, dest, { time: t, frequency: base, toFrequency: 560 + tier * 145, duration: 0.46 + tier * 0.08, type: 'sawtooth', volume: 0.065 + tier * 0.012, attack: 0.012, filter: { type: 'lowpass', frequency: 1450 + tier * 500, q: 1.1 } });
      tone(c, dest, { time: t + 0.025, frequency: base * 2.01, toFrequency: 920 + tier * 180, duration: 0.32, type: 'triangle', volume: 0.036 + tier * 0.008, filter: { type: 'highpass', frequency: 320, q: 0.7 } });
      noiseBurst(c, dest, { time: t, duration: 0.54, frequency: 2100 + tier * 380, volume: 0.048 + tier * 0.009, filterType: 'bandpass', q: 0.72, seed: 810 + tier, pan: 0.08 });
      tone(c, dest, { time: t, frequency: 72, toFrequency: 46, duration: 0.25, type: 'sine', volume: 0.065, filter: { type: 'lowpass', frequency: 260, q: 0.8 } });
    } else if (name === 'item') {
      tone(c, dest, { time: t, frequency: 420 * itemPitch, toFrequency: 760 * itemPitch, duration: 0.16, type: 'triangle', volume: 0.055, filter: { type: 'bandpass', frequency: 1100, q: 1.4 } });
      tone(c, dest, { time: t + 0.105, frequency: 640 * itemPitch, toFrequency: 1040 * itemPitch, duration: 0.19, type: 'sine', volume: 0.05, filter: { type: 'highpass', frequency: 240, q: 0.6 } });
      noiseBurst(c, dest, { time: t + 0.02, duration: 0.18, frequency: 2400, volume: 0.025, filterType: 'highpass', seed: 1200 + Math.round(itemPitch * 20), pan: -0.12 });
    } else if (name === 'pickup') {
      tone(c, dest, { time: t, frequency: 580, toFrequency: 900, duration: 0.12, type: 'sine', volume: 0.055, filter: { type: 'highpass', frequency: 360, q: 0.5 } });
      tone(c, dest, { time: t + 0.075, frequency: 860, toFrequency: 1380, duration: 0.17, type: 'triangle', volume: 0.05, filter: { type: 'highpass', frequency: 420, q: 0.5 } });
    } else if (name === 'impact') {
      tone(c, dest, { time: t, frequency: 118, toFrequency: 52, duration: 0.28, type: 'sine', volume: 0.11, filter: { type: 'lowpass', frequency: 300, q: 1.1 } });
      noiseBurst(c, dest, { time: t, duration: 0.16, frequency: 1550, volume: 0.09, filterType: 'bandpass', q: 0.9, seed: 2201, pan: -0.08 });
      tone(c, dest, { time: t + 0.018, frequency: 940, toFrequency: 370, duration: 0.11, type: 'square', volume: 0.045, filter: { type: 'highpass', frequency: 680, q: 0.8 } });
    } else if (name === 'shield') {
      tone(c, dest, { time: t, frequency: 480, toFrequency: 920, duration: 0.32, type: 'sine', volume: 0.065, filter: { type: 'bandpass', frequency: 1200, q: 2 } });
      tone(c, dest, { time: t + 0.04, frequency: 720, toFrequency: 1380, duration: 0.24, type: 'triangle', volume: 0.035, filter: { type: 'highpass', frequency: 620, q: 0.6 } });
    } else if (name === 'countdown' || name === 'light') {
      var count = num(d.count, 3);
      var cf = d.go ? 660 : (count <= 1 ? 392 : count === 2 ? 330 : 262);
      tone(c, dest, { time: t, frequency: cf, duration: d.go ? 0.46 : 0.19, type: d.go ? 'square' : 'triangle', volume: d.go ? 0.075 : 0.065, filter: { type: 'lowpass', frequency: d.go ? 2200 : 1500, q: 1.2 } });
      if (d.go) {
        tone(c, dest, { time: t + 0.045, frequency: 825, duration: 0.39, type: 'triangle', volume: 0.055, filter: { type: 'highpass', frequency: 420, q: 0.7 } });
        tone(c, dest, { time: t + 0.09, frequency: 990, duration: 0.32, type: 'sine', volume: 0.04, filter: { type: 'highpass', frequency: 500, q: 0.6 } });
      }
    } else if (name === 'go') {
      playSfx(g, 'countdown', { go: true }, t);
    } else if (name === 'lap') {
      tone(c, dest, { time: t, frequency: 523, toFrequency: 784, duration: 0.22, type: 'triangle', volume: 0.06, filter: { type: 'highpass', frequency: 260, q: 0.7 } });
      tone(c, dest, { time: t + 0.12, frequency: 659, toFrequency: 1047, duration: 0.28, type: 'sine', volume: 0.055, filter: { type: 'highpass', frequency: 310, q: 0.7 } });
      noiseBurst(c, dest, { time: t, duration: 0.35, frequency: 1850, volume: 0.032, filterType: 'bandpass', q: 0.6, seed: 3160, pan: 0.18 });
    } else if (name === 'fall') {
      tone(c, dest, { time: t, frequency: 390, toFrequency: 62, duration: 0.72, type: 'sawtooth', volume: 0.07, filter: { type: 'lowpass', frequency: 880, q: 1.3 } });
      noiseBurst(c, dest, { time: t, duration: 0.68, frequency: 820, volume: 0.044, filterType: 'bandpass', q: 0.62, seed: 5160, pan: -0.1 });
    } else if (name === 'spin') {
      tone(c, dest, { time: t, frequency: 160, toFrequency: 72, duration: 0.34, type: 'square', volume: 0.05, filter: { type: 'lowpass', frequency: 520, q: 1.1 } });
      noiseBurst(c, dest, { time: t, duration: 0.36, frequency: 730, volume: 0.035, filterType: 'bandpass', q: 0.8, seed: 6120 });
    } else if (name === 'finish' || name === 'results') {
      tone(c, dest, { time: t, frequency: 392, duration: 0.18, type: 'triangle', volume: 0.045, filter: { type: 'highpass', frequency: 250, q: 0.6 } });
      tone(c, dest, { time: t + 0.14, frequency: 523, duration: 0.18, type: 'triangle', volume: 0.05, filter: { type: 'highpass', frequency: 280, q: 0.6 } });
      tone(c, dest, { time: t + 0.28, frequency: 784, duration: 0.42, type: 'sine', volume: 0.06, filter: { type: 'highpass', frequency: 340, q: 0.6 } });
    } else if (name === 'drift-tier') {
      var tierHz = tier === 1 ? 440 : tier === 2 ? 660 : 990;
      tone(c, dest, { time: t, frequency: tierHz, toFrequency: tierHz * 1.35, duration: 0.16 + tier * 0.03, type: tier === 3 ? 'square' : 'triangle', volume: 0.04 + tier * 0.012, filter: { type: 'bandpass', frequency: 1500 + tier * 300, q: 1.8 } });
      tone(c, dest, { time: t + 0.025, frequency: tierHz * 2, duration: 0.11, type: 'sine', volume: 0.018 + tier * 0.006, filter: { type: 'highpass', frequency: 520, q: 0.6 } });
    }
  }

  function updateDrive(g, kart, t, offline) {
    if (!g || !kart) return;
    var maxSpeed = ZC.Kart && ZC.Kart.TUNE ? num(ZC.Kart.TUNE.maxSpeed, 27) : 27;
    var maxBoost = ZC.Kart && ZC.Kart.TUNE ? num(ZC.Kart.TUNE.boostSpeed, 38) : 38;
    var speed = Math.max(0, num(kart.speed, 0));
    var v = clamp(speed / Math.max(1, maxBoost), 0, 1.15);
    var slip = Math.abs(num(kart.slip, 0));
    var drift = kart.drift || {};
    var active = !!drift.active;
    var boost = num(kart.boost, 0) > 0;
    var gear = Math.min(3, Math.floor(clamp(speed / Math.max(1, maxSpeed), 0, 0.999) * 4));
    var within = clamp(speed / Math.max(1, maxSpeed) * 4 - gear, 0, 1);
    var load = clamp(0.15 + v * 0.62 + slip * 0.68 + (active ? 0.14 : 0) + (boost ? 0.18 : 0), 0, 1.25);
    var rpm = 48 + gear * 19 + within * 82 + load * 12 + (boost ? 25 : 0);
    var when = t;

    setParam(g.engine.low.frequency, rpm, when, offline ? 0 : 0.035);
    setParam(g.engine.harmonic.frequency, rpm * 2.01, when, offline ? 0 : 0.035);
    setParam(g.engine.pulse.frequency, rpm * 3.02, when, offline ? 0 : 0.035);
    setParam(g.engine.lowFilter && g.engine.lowFilter.frequency, 330 + load * 1420, when, offline ? 0 : 0.045);
    setParam(g.engine.harmonicFilter && g.engine.harmonicFilter.frequency, 560 + load * 1350, when, offline ? 0 : 0.045);
    setParam(g.engine.exhaustFilter && g.engine.exhaustFilter.frequency, 170 + load * 720, when, offline ? 0 : 0.055);
    setParam(g.engine.lowGain.gain, 0.012 + v * 0.036 + load * 0.017, when, offline ? 0 : 0.04);
    setParam(g.engine.harmonicGain.gain, 0.004 + load * 0.018, when, offline ? 0 : 0.04);
    setParam(g.engine.pulseGain.gain, 0.002 + load * 0.009, when, offline ? 0 : 0.04);
    setParam(g.engine.exhaustGain.gain, 0.003 + load * 0.020, when, offline ? 0 : 0.05);

    var slip01 = clamp(slip / 0.44, 0, 1.2);
    var scrub = active ? clamp(0.014 + slip01 * 0.060 + v * 0.014, 0, 0.105) : slip01 * 0.012;
    setParam(g.scrub.gain.gain, scrub, when, offline ? 0 : 0.035);
    setParam(g.scrub.lowGain.gain, scrub * 0.48, when, offline ? 0 : 0.04);
    setParam(g.scrub.band && g.scrub.band.frequency, 1100 + v * 1050 + slip01 * 900, when, offline ? 0 : 0.05);
    setParam(g.scrub.lowFilter && g.scrub.lowFilter.frequency, 260 + v * 420, when, offline ? 0 : 0.05);
    if (g.scrub.pan && g.scrub.pan.pan) setParam(g.scrub.pan.pan, clamp(num(drift.dir, 0) * 0.58, -0.72, 0.72), when, offline ? 0 : 0.04);

    var charge = clamp(num(drift.charge, 0) / 1.65, 0, 1);
    var driftLevel = active ? 0.004 + slip01 * 0.025 + charge * 0.012 : 0;
    setParam(g.drift.osc.frequency, 210 + charge * 760 + (num(drift.tier, 0) * 25), when, offline ? 0 : 0.04);
    setParam(g.drift.filter && g.drift.filter.frequency, 560 + charge * 1450, when, offline ? 0 : 0.05);
    setParam(g.drift.gain.gain, driftLevel, when, offline ? 0 : 0.04);
    setParam(g.drift.sub.frequency, 105 + charge * 160, when, offline ? 0 : 0.04);
    setParam(g.drift.subGain.gain, active ? driftLevel * 0.42 : 0, when, offline ? 0 : 0.04);

    if (!offline && g.gear >= 0 && gear !== g.gear && speed > 3) playSfx(g, 'shift', { tier: gear + 1 }, when);
    g.gear = gear;
    g.tier = num(drift.tier, 0);
  }

  function playerPayload(payload) {
    var k = payload && payload.kart ? payload.kart : payload;
    return k && k.isPlayer ? k : null;
  }

  A.init = function () {
    if (initialized) return !!ctx;
    initialized = true;
    try { muted = !!(ZC.store && ZC.store.get && ZC.store.get('muted', false)); } catch (e) { muted = false; }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e2) { ctx = null; return false; }
    return true;
  };

  function buildLive() {
    if (!ctx || live) return live;
    live = createGraph(ctx, 'race', false);
    return live;
  }

  A.resume = function () {
    if (!ctx && !A.init()) return false;
    try { if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume(); } catch (e) {}
    return !!buildLive();
  };

  A.toggleMute = function () {
    muted = !muted;
    try { if (ZC.store && ZC.store.set) ZC.store.set('muted', muted); } catch (e) {}
    if (live && live.master && live.master.gain) setParam(live.master.gain, muted ? 0 : 0.78, audioTime(ctx), 0.025);
    if (ZC.UI && ZC.UI.toast) ZC.UI.toast(muted ? 'Muted' : 'Sound on', 1000);
  };
  A.isMuted = function () { return muted; };

  A.update = function (kart, dt) {
    if (!ctx || !kart) return;
    if (!live) {
      if (!ctx.state || ctx.state === 'running') buildLive();
      else return;
    }
    if (!live) return;
    updateDrive(live, kart, audioTime(ctx), false);
    var race = ZC.Race && ZC.Race.state;
    var count = race && race.phase === 'countdown' ? Math.min(3, Math.max(0, Math.ceil(num(race.countdown, 0) - 0.2))) : 0;
    if (count > 0 && count < num(live.countdownMark, 4)) {
      playSfx(live, 'countdown', { count: count }, audioTime(ctx));
    }
    live.countdownMark = count;
  };

  A.sfx = function (name, detail) {
    if (!ctx || muted) return false;
    if (!live) buildLive();
    if (!live) return false;
    playSfx(live, name, detail, audioTime(ctx));
    return true;
  };

  /* The harness calls this without touching the live graph. A scenario is a
     scripted drive so the output proves engine load, drift charge, stingers
     and music rather than merely proving that a single oscillator exists. */
  A.__renderOffline = function (seconds, options) {
    var OC = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    if (!OC) return null;
    seconds = clamp(num(seconds, 20), 1, 90);
    options = options || {};
    var scenario = String(options.scenario || 'race');
    try {
      var rate = 48000;
      var offline = new OC(2, Math.ceil(seconds * rate), rate);
      var g = createGraph(offline, scenario, true);
      if (!g) return null;
      var player = { speed: 0, slip: 0, boost: 0, drift: { active: false, dir: 1, charge: 0, tier: 0 } };
      var t;
      if (scenario === 'menu') {
        setParam(g.musicGain, 0.15, 0, 0);
        for (t = 0; t < seconds; t += 1.9) playSfx(g, 'pickup', {}, t + 0.2);
      } else if (scenario === 'drift') {
        setParam(g.musicGain, 0.27, 0, 0);
        for (t = 0; t < seconds; t += 0.08) {
          var ds = clamp(t < 1.2 ? 8 + t * 10 : t < 4.7 ? 20 + (t - 1.2) * 2.0 : 25, 0, 27);
          var dc = t < 1.15 ? 0 : clamp((t - 1.15) / 3.5, 0, 1.65);
          var tier = dc >= 1.65 ? 3 : dc >= 0.95 ? 2 : dc >= 0.42 ? 1 : 0;
          var active = t >= 1.15 && t < 5.05;
          player.speed = ds; player.slip = active ? 0.34 + Math.min(0.10, (t - 1.15) * 0.03) : 0;
          player.boost = t >= 5.05 && t < 6.2 ? 1 : 0;
          player.drift.active = active; player.drift.charge = dc; player.drift.tier = tier;
          updateDrive(g, player, t, true);
        }
        playSfx(g, 'drift-tier', { tier: 1 }, 1.65);
        playSfx(g, 'drift-tier', { tier: 2 }, 2.62);
        playSfx(g, 'drift-tier', { tier: 3 }, 3.55);
        playSfx(g, 'boost', { tier: 3 }, 5.05);
      } else if (scenario === 'results') {
        setParam(g.musicGain, 0.19, 0, 0);
        playSfx(g, 'lap', {}, 0.55);
        playSfx(g, 'finish', {}, 1.15);
        playSfx(g, 'results', {}, 2.2);
        for (t = 0; t < seconds; t += 0.18) {
          player.speed = 8 + Math.sin(t * 2.1) * 2; player.slip = 0; player.boost = 0;
          player.drift.active = false; player.drift.charge = 0; player.drift.tier = 0;
          updateDrive(g, player, t, true);
        }
      } else {
        playSfx(g, 'countdown', { count: 3 }, 0.2);
        playSfx(g, 'countdown', { count: 2 }, 0.9);
        playSfx(g, 'countdown', { count: 1 }, 1.6);
        playSfx(g, 'go', {}, 2.3);
        for (t = 0; t < seconds; t += 0.09) {
          var rs = t < 2.3 ? t * 3.2 : clamp(7 + (t - 2.3) * 3.9 + Math.sin(t * 1.4) * 1.7, 0, 27);
          player.speed = rs; player.slip = t > 5.1 && t < 6.1 ? 0.37 : Math.abs(Math.sin(t * 0.53)) * 0.035;
          player.boost = t > 8.4 && t < 9.25 ? 0.8 : 0;
          player.drift.active = t > 5.1 && t < 6.1; player.drift.charge = player.drift.active ? (t - 5.1) * 0.8 : 0;
          player.drift.tier = player.drift.charge >= 0.95 ? 2 : player.drift.charge >= 0.42 ? 1 : 0;
          updateDrive(g, player, t, true);
        }
        playSfx(g, 'drift-tier', { tier: 1 }, 5.65);
        playSfx(g, 'drift-tier', { tier: 2 }, 6.25);
        playSfx(g, 'boost', { tier: 2 }, 6.9);
        playSfx(g, 'item', { item: 'gust' }, 9.0);
        playSfx(g, 'impact', {}, 10.2);
        playSfx(g, 'lap', {}, 12.4);
        playSfx(g, 'fall', {}, Math.min(seconds - 0.8, 14.4));
      }
      return offline.startRendering();
    } catch (e3) {
      return null;
    }
  };

  function on(event, handler) { if (ZC.on) ZC.on(event, handler); }
  on('kart:driftStart', function (k) { if (playerPayload(k)) A.sfx('drift-tier', { tier: 0 }); });
  on('kart:driftTier', function (e) { if (playerPayload(e)) A.sfx('drift-tier', { tier: e.tier }); });
  on('kart:boost', function (e) { var k = playerPayload(e); if (k) A.sfx('boost', e); });
  on('kart:hit', function (e) { if (playerPayload(e)) A.sfx('impact', e); });
  on('kart:shieldBreak', function (e) { if (playerPayload(e)) A.sfx('shield', e); });
  on('kart:spinEnd', function (k) { if (playerPayload(k)) A.sfx('spin'); });
  on('kart:lap', function (e) { if (playerPayload(e)) A.sfx('lap', e); });
  on('kart:finish', function (k) { if (playerPayload(k)) A.sfx('finish'); });
  on('kart:fell', function (k) { if (playerPayload(k)) A.sfx('fall'); });
  on('item:use', function (e) { if (playerPayload(e)) A.sfx('item', e); });
  on('item:pickup', function (e) { if (playerPayload(e)) A.sfx('pickup', e); });
  on('item:hit', function (e) { if (playerPayload(e) && !e.blocked) A.sfx('impact', e); });
  on('race:countdown', function (st) {
    var count = Math.min(3, Math.max(1, Math.ceil(num(st && st.countdown, 3) - 0.2)));
    if (live) live.countdownMark = count;
    A.sfx('countdown', { count: count });
  });
  on('race:go', function () { if (live) live.countdownMark = 0; A.sfx('go'); });
  on('race:results', function () { A.sfx('results'); });

})(window);
