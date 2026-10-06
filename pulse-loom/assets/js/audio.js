(function (global) {
  'use strict';
  var A = (global.PL = global.PL || {}).Audio = {};
  var ctx = null, master = null, bus = null, noiseBuf = null, nextStep = 0, muted = false;
  var BEAT = 60 / 112, STEP = BEAT / 2, LOOKAHEAD = 0.3;
  var CHORDS = [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]]; // Am F C G
  var PENT = [69, 72, 74, 76];
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  A.unlock = function () {
    try {
      if (!ctx) {
        ctx = new (global.AudioContext || global.webkitAudioContext)();
        var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
        master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
        bus = ctx.createGain();
        var delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(), tone = ctx.createBiquadFilter();
        delay.delayTime.value = BEAT * 0.75; fb.gain.value = 0.34; wet.gain.value = 0.28;
        tone.type = 'lowpass'; tone.frequency.value = 2600;
        bus.connect(master); bus.connect(delay); delay.connect(tone); tone.connect(fb); fb.connect(delay);
        tone.connect(wet); wet.connect(master); master.connect(comp); comp.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0), seed = 7;
        for (var i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 1073741823 - 1; }
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
  };
  A.setMuted = function (m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.8; };
  A.isMuted = function () { return muted; };
  A.reset = function () { nextStep = 0; };
  function osc(type, f, t, dur, peak, attack, dest, detune) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || bus); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function noise(t, dur, peak, freq, kind) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = kind; f.frequency.value = freq;
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur);
  }
  function kick(t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.3);
  }
  function step(i, t, intensity) {
    var beat = i / 2, bar = Math.floor(beat / 4), inBar = i % 8, section = Math.min(3, Math.floor(beat / 32));
    var chord = CHORDS[bar % 4];
    if (beat < 4) { if (i % 2 === 0) osc('sine', 800, t, 0.05, 0.05, 0.002); return; }
    if (inBar % 4 === 0) kick(t);
    if (inBar === 4 && section >= 2) { noise(t, 0.16, 0.16, 1800, 'bandpass'); osc('triangle', 190, t, 0.1, 0.12, 0.002); }
    if (i % 2 === 1) noise(t, 0.04, 0.05 + 0.02 * section, 7500, 'highpass');
    else if (section >= 1 && inBar % 4 === 2) noise(t, 0.1, 0.07, 7000, 'highpass');
    // Bass: rolling eighths with an octave jump.
    var bm = chord[0] - (inBar % 4 === 3 ? -12 : 0);
    if (inBar !== 5) osc('sawtooth', hz(bm), t, STEP * 1.6, 0.13, 0.005, bus);
    // Pad enters in movement II.
    if (section >= 1 && inBar === 0) chord.forEach(function (m, k) {
      osc('triangle', hz(m + 12), t, BEAT * 4, 0.05, 0.4, bus, k * 5 - 5);
    });
    // Arpeggio enters in III, doubles up in IV; swells with the player's combo.
    if (section >= 2 || (section >= 1 && intensity > 0.5)) {
      var arp = chord[inBar % 3] + 24 + (inBar > 5 ? 12 : 0);
      osc('square', hz(arp), t, STEP * 1.4, 0.03 + 0.03 * intensity, 0.004, bus);
    }
    if (section === 3 && i % 2 === 0) osc('sawtooth', hz(chord[(inBar / 2) % 3] + 36), t, STEP * 2, 0.025, 0.01, bus, 7);
  }
  // Schedule the song against the audio clock as a pure function of game time.
  A.update = function (time, combo) {
    if (!ctx || ctx.state !== 'running') return;
    var intensity = Math.min(1, (combo || 0) / 30), base = ctx.currentTime - time;
    while (nextStep * STEP < time + LOOKAHEAD && nextStep < 256) {
      var t = base + nextStep * STEP;
      if (t >= ctx.currentTime - 0.02) step(nextStep, Math.max(t, ctx.currentTime), intensity);
      nextStep++;
    }
  };
  A.hit = function (lane, perfect, section) {
    if (!ctx) return;
    var t = ctx.currentTime, m = PENT[lane] + (perfect ? 12 : 0);
    osc('sine', hz(m), t, perfect ? 0.7 : 0.35, 0.2, 0.002, bus);
    osc('triangle', hz(m + 12), t, perfect ? 0.45 : 0.2, 0.08, 0.002, bus);
    if (perfect) osc('sine', hz(m + 19), t, 0.5, 0.05, 0.002, bus);
    noise(t, 0.05, 0.08, 4500, 'highpass');
  };
  A.miss = function () {
    if (!ctx) return;
    var t = ctx.currentTime;
    osc('sawtooth', 110, t, 0.18, 0.08, 0.002, bus).frequency.exponentialRampToValueAtTime(55, t + 0.18);
  };
  A.rotate = function () {
    if (!ctx) return;
    var t = ctx.currentTime, o = osc('sawtooth', 220, t, 0.7, 0.07, 0.15, bus);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.6);
  };
  A.finish = function () {
    if (!ctx) return;
    var t = ctx.currentTime;
    [57, 60, 64, 69, 72].forEach(function (m, k) { osc('triangle', hz(m), t + k * 0.09, 1.6, 0.1, 0.01, bus); });
  };
})(typeof window !== 'undefined' ? window : this);
