(function (global) {
  'use strict';
  var A = (global.PL = global.PL || {}).Audio = {};
  var ctx = null, master = null, noise = null, movement = 0;
  var pendingBeat = -1, beatQueued = false;
  var roots = [146.83, 116.54, 98, 110]; // Dm, Bb, Gm, A7
  var chords = [[0, 3, 7, 10], [0, 4, 7, 11], [0, 3, 7, 10], [0, 4, 7, 10]];
  var melodies = [
    [0, null, 7, 10, null, 7, 3, null],
    [7, 11, null, 12, 11, null, 7, 4],
    [3, null, 7, 10, 12, 10, null, 7],
    [12, 10, 7, 4, 12, 10, 7, 4]
  ];
  function pitch(root, semitones) { return root * Math.pow(2, semitones / 12); }
  A.unlock = function () {
    try {
      if (!ctx) {
        ctx = new (global.AudioContext || global.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.72;
        var limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -18; limiter.ratio.value = 3;
        master.connect(limiter); limiter.connect(ctx.destination);
        noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.18), ctx.sampleRate);
        var data = noise.getChannelData(0);
        for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; master = null; noise = null; }
  };
  function voice(frequency, start, duration, wave, level, cutoff) {
    if (!ctx || !master) return;
    var oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    if (cutoff) {
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = cutoff;
      gain.connect(filter); filter.connect(master);
    } else gain.connect(master);
    oscillator.start(start); oscillator.stop(start + duration + 0.01);
  }
  function hiss(start, duration, level, cutoff) {
    if (!ctx || !noise || !master) return;
    var source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = noise; filter.type = 'highpass'; filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter); filter.connect(gain); gain.connect(master);
    source.start(start); source.stop(start + duration);
  }
  function kick(start, strong) {
    if (!ctx || !master) return;
    var oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(strong ? 145 : 120, start);
    oscillator.frequency.exponentialRampToValueAtTime(48, start + 0.15);
    gain.gain.setValueAtTime(strong ? 0.17 : 0.12, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
    oscillator.connect(gain); gain.connect(master);
    oscillator.start(start); oscillator.stop(start + 0.23);
  }
  function playBeat(beat) {
    if (!ctx || beat >= 128) return;
    movement = Math.min(3, Math.floor(beat / 32));
    var bar = beat % 4, phrase = beat % 8, start = ctx.currentTime + 0.006;
    var root = roots[movement], chord = chords[movement];

    // Each movement changes both the harmony and the rhythm section.
    if (bar === 0 || (movement >= 1 && bar === 2) || (movement === 3 && bar === 3))
      kick(start, bar === 0);
    if ((movement === 0 && bar === 2) || (movement > 0 && (bar === 1 || bar === 3))) {
      hiss(start, 0.11, movement === 3 ? 0.085 : 0.065, 1200);
      voice(185, start, 0.09, 'triangle', 0.025);
    }
    if (beat % 2 || movement >= 2) hiss(start, 0.04, movement === 3 ? 0.025 : 0.014, 6000);
    if (beat % 2 === 0) voice(pitch(root / 2, beat % 8 === 6 ? 7 : 0),
      start, 0.3, 'triangle', 0.055, 520);
    if (bar === 0) {
      for (var i = 0; i < chord.length; i++)
        voice(pitch(root, chord[i]), start, 1.45, 'sine', 0.012);
    }
    var melody = melodies[movement][phrase];
    if (melody !== null) voice(pitch(root * 2, melody), start, movement === 3 ? 0.2 : 0.29,
      movement >= 2 ? 'triangle' : 'sine', movement === 3 ? 0.043 : 0.034);

    // A rising, harmonically voiced turn announces the lane rotation.
    if (beat > 0 && beat % 32 === 0) {
      for (var step = 0; step < 4; step++)
        voice(pitch(root * 2, chord[step]), start + step * 0.095,
          0.42, 'triangle', 0.07, 2800);
    }
  }
  A.beat = function (beat) {
    // The game may replay many missed beats in one frame after a hidden tab wakes.
    // Keep only the newest beat so that recovery never produces an audio burst.
    pendingBeat = beat;
    if (beatQueued) return;
    beatQueued = true;
    Promise.resolve().then(function () {
      beatQueued = false;
      playBeat(pendingBeat);
    });
  };
  A.hit = function (lane, perfect) {
    if (!ctx || lane < 0 || lane > 3) return;
    var start = ctx.currentTime + 0.006, root = roots[movement], chord = chords[movement];
    var waves = ['sine', 'triangle', 'square', 'sawtooth'];
    var cutoffs = [0, 2300, 1200, 3100];
    voice(pitch(root * 2, chord[lane]), start, perfect ? 0.38 : 0.2,
      waves[lane], perfect ? 0.1 : 0.067, cutoffs[lane]);
    if (perfect) voice(pitch(root * 4, chord[lane]), start + 0.035, 0.24,
      'sine', 0.027);
  };
})(typeof window !== 'undefined' ? window : this);
