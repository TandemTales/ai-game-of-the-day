(function (global) {
  'use strict';
  var A = (global.PL = global.PL || {}).Audio = {};
  var ctx = null, master = null, noise = null, currentBeat = 0;
  var audioZero = null, nextBeat = 0;
  var LEAD_IN = 0.16, LOOKAHEAD = 0.22;
  var liveSources = [];
  var roots = [146.83, 116.54, 98, 110]; // Dm, Bb, Gm, A7
  var minor = [0, 3, 7, 10], major = [0, 4, 7, 11];
  var dominant = [0, 4, 7, 10], addNine = [0, 4, 7, 14];
  // Four different eight-beat phrases per movement, with a new chord each phrase.
  var changes = [[0, -4, -7, -5], [0, -5, 2, 4], [0, -4, 3, 2], [0, 5, -2, 0]];
  var chords = [[minor, major, minor, dominant], [major, major, addNine, minor],
    [minor, major, major, dominant], [dominant, minor, minor, dominant]];
  var melodies = [
    [[0, null, 7, 10, null, 7, 3, null], [0, 4, null, 7, 11, 7, null, 4],
      [3, null, 7, 10, 12, 10, null, 7], [4, 7, 10, 12, 10, 7, 4, 0]],
    [[7, 11, null, 12, 11, null, 7, 4], [0, 4, 7, null, 11, 12, 11, 7],
      [7, null, 14, 12, 7, 4, 0, null], [3, 7, 10, 12, 10, 7, 3, 0]],
    [[0, null, 3, 7, 10, 7, 3, null], [7, 11, 12, 11, 7, null, 4, 0],
      [0, 4, 7, 11, 14, 11, 7, 4], [4, 7, 10, 12, 10, 7, 4, null]],
    [[12, 10, 7, 4, 12, 10, 7, 4], [12, 10, 7, 3, 12, 10, 7, 3],
      [0, 3, 7, 10, 12, 10, 7, 3], [4, 7, 10, 12, 14, 10, 7, null]]
  ];
  function pitch(root, semitones) { return root * Math.pow(2, semitones / 12); }
  function harmonyAt(beat) {
    if (beat >= 127) return { root: roots[0], chord: minor };
    var movement = Math.max(0, Math.min(3, Math.floor(beat / 32)));
    var phrase = Math.max(0, Math.min(3, Math.floor((beat % 32) / 8)));
    return { root: pitch(roots[movement], changes[movement][phrase]),
      chord: chords[movement][phrase] };
  }
  function track(source) {
    liveSources.push(source);
    source.onended = function () {
      var index = liveSources.indexOf(source);
      if (index !== -1) liveSources.splice(index, 1);
    };
  }
  function stopQueued() {
    var sources = liveSources.slice();
    liveSources.length = 0;
    for (var i = 0; i < sources.length; i++) {
      try { sources[i].stop(ctx.currentTime); } catch (e) { /* Already finished. */ }
    }
  }
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
      if (ctx.state === 'suspended') {
        var resume = ctx.resume();
        if (resume && resume.catch) resume.catch(function () {});
      }
    } catch (e) { ctx = null; master = null; noise = null; }
  };
  A.begin = function () {
    A.unlock();
    var resumed = Promise.resolve();
    try { if (ctx && ctx.state === 'suspended') resumed = ctx.resume(); }
    catch (e) { resumed = Promise.resolve(); }
    return Promise.resolve(resumed).catch(function () {}).then(function () {
      if (ctx) stopQueued();
      audioZero = ctx && ctx.state === 'running' ? ctx.currentTime + LEAD_IN : null;
      nextBeat = 0; currentBeat = 0;
      // Anchor the downbeat here: the first animation frame can arrive after
      // the lead-in on a cold browser start or a busy device.
      if (audioZero !== null) {
        playBeat(0, audioZero);
        nextBeat = 1;
      }
      return LEAD_IN;
    });
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
    track(oscillator);
    oscillator.start(start); oscillator.stop(start + duration + 0.01);
  }
  function hiss(start, duration, level, cutoff) {
    if (!ctx || !noise || !master) return;
    var source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = noise; filter.type = 'highpass'; filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter); filter.connect(gain); gain.connect(master);
    track(source);
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
    track(oscillator);
    oscillator.start(start); oscillator.stop(start + 0.23);
  }
  function playBeat(beat, start) {
    if (!ctx || beat >= 128) return;
    currentBeat = beat;
    var movement = Math.min(3, Math.floor(beat / 32));
    var bar = beat % 4, phrase = beat % 8;
    var phraseNumber = Math.floor((beat % 32) / 8);
    var harmony = harmonyAt(beat), root = harmony.root, chord = harmony.chord;

    // The last chart note lands on the tonic after the final dominant build.
    if (beat === 127) {
      voice(roots[0] / 2, start, 2.1, 'triangle', 0.12, 700);
      for (var finalNote = 0; finalNote < minor.length; finalNote++)
        voice(pitch(roots[0], minor[finalNote]), start + finalNote * 0.045,
          1.9, 'sine', 0.04);
      voice(roots[0] * 4, start + 0.15, 1.7, 'triangle', 0.04, 2400);
      return;
    }

    // Each movement changes both the harmony and the rhythm section.
    if (bar === 0 || (movement >= 1 && bar === 2) || (movement === 3 && bar === 3))
      kick(start, bar === 0);
    if ((movement === 0 && bar === 2) || (movement > 0 && (bar === 1 || bar === 3))) {
      hiss(start, 0.11, movement === 3 ? 0.085 : 0.065, 1200);
      voice(185, start, 0.09, 'triangle', 0.025);
    }
    if (beat % 2 || movement >= 2) hiss(start, 0.04, movement === 3 ? 0.025 : 0.014, 6000);
    var bassDegree = phrase === 6 ? chord[2] : phrase === 2 && phraseNumber % 2 ? chord[1] : 0;
    if (beat % 2 === 0) voice(pitch(root / 2, bassDegree),
      start, 0.3, 'triangle', 0.055, 520);
    if (bar === 0) {
      for (var i = 0; i < chord.length; i++)
        voice(pitch(root, chord[i]), start, 1.45, 'sine', 0.012);
    }
    var melody = melodies[movement][phraseNumber][phrase];
    if (melody !== null) voice(pitch(root * 2, melody), start, movement === 3 ? 0.2 : 0.29,
      movement >= 2 ? 'triangle' : 'sine', movement === 3 ? 0.043 : 0.034);

    // A rising, harmonically voiced turn announces the lane rotation.
    if (beat > 0 && beat % 32 === 0) {
      for (var step = 0; step < 4; step++)
        voice(pitch(root * 2, chord[step]), start + step * 0.095,
          0.42, 'triangle', 0.07, 2800);
    }
  }
  A.schedule = function (songTime, beatDuration) {
    if (!ctx || audioZero === null || !Number.isFinite(songTime) ||
        !Number.isFinite(beatDuration) || beatDuration <= 0) return;
    if (ctx.state === 'suspended') {
      stopQueued();
      var resume = ctx.resume();
      if (resume && resume.catch) resume.catch(function () {});
      return;
    }
    // AudioContext time can pause while performance time advances in a hidden tab.
    // Re-anchor to the song position and discard all beats already passed.
    if (Math.abs(ctx.currentTime - (audioZero + songTime)) > 0.25) {
      stopQueued();
      audioZero = ctx.currentTime - songTime;
    }
    nextBeat = Math.max(nextBeat, Math.max(0,
      Math.ceil((songTime - 0.025) / beatDuration)));
    while (nextBeat < 128 && audioZero + nextBeat * beatDuration <= ctx.currentTime + LOOKAHEAD) {
      var when = audioZero + nextBeat * beatDuration;
      if (when >= ctx.currentTime + 0.004) playBeat(nextBeat, when);
      nextBeat++;
    }
  };
  A.beat = function (beat) {
    // Compatibility for older callers. New games should use begin/schedule.
    if (ctx) playBeat(beat, ctx.currentTime + 0.006);
  };
  A.hit = function (lane, perfect, targetBeat) {
    if (!ctx || lane < 0 || lane > 3) return;
    var start = ctx.currentTime + 0.006;
    var harmony = harmonyAt(Number.isFinite(targetBeat) ? targetBeat : currentBeat);
    var root = harmony.root, chord = harmony.chord;
    var waves = ['sine', 'triangle', 'square', 'sawtooth'];
    var cutoffs = [0, 2300, 1200, 3100];
    voice(pitch(root * 2, chord[lane]), start, perfect ? 0.38 : 0.2,
      waves[lane], perfect ? 0.1 : 0.067, cutoffs[lane]);
    if (perfect) voice(pitch(root * 4, chord[lane]), start + 0.035, 0.24,
      'sine', 0.027);
  };
  A.miss = function () {
    if (!ctx || !master) return;
    var start = ctx.currentTime + 0.006;
    var oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(235, start);
    oscillator.frequency.exponentialRampToValueAtTime(115, start + 0.17);
    gain.gain.setValueAtTime(0.035, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.19);
    oscillator.connect(gain); gain.connect(master);
    track(oscillator);
    oscillator.start(start); oscillator.stop(start + 0.2);
    hiss(start, 0.075, 0.018, 1000);
  };
})(typeof window !== 'undefined' ? window : this);
