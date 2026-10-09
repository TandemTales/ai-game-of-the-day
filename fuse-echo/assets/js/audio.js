/* Fuse Echo — procedural Web Audio: SFX + a small looping synth track. */
(function (global) {
  'use strict';
  var FE = global.FE;
  var A = FE.Audio = {};
  var ac = null, master, sfxBus, musBus, muted = false, noiseBuf, musicOn = false, nextT = 0, step = 0, timer = null, tension = 0;

  try { muted = global.localStorage.getItem('fe.muted') === '1'; } catch (e) {}

  function ensure() {
    if (ac) return ac;
    var C = global.AudioContext || global.webkitAudioContext;
    if (!C) return null;
    ac = new C();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8;
    var comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musBus = ac.createGain(); musBus.gain.value = 0.22; musBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }
  A.unlock = function () { var c = ensure(); if (c && c.state === 'suspended') c.resume(); };
  A.isMuted = function () { return muted; };
  A.setMuted = function (m) {
    muted = !!m;
    try { global.localStorage.setItem('fe.muted', muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.value = muted ? 0 : 0.8;
  };

  function tone(type, f0, f1, dur, vol, when, bus) {
    if (!ac) return;
    var t = (when || ac.currentTime);
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, f0, f1, vol, q, type) {
    if (!ac) return;
    var t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type || 'lowpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  A.sfx = function (ev) {
    if (!ensure() || muted) return;
    switch (ev.t) {
      case 'place': tone('square', 220, 110, 0.12, 0.25); tone('sine', 90, 60, 0.15, 0.4); break;
      case 'boom':
        noise(0.8, 3500, 90, 0.9, 0.8); tone('sine', 120, 28, 0.6, 0.9);
        if (ev.chain) tone('sawtooth', 300 + ev.chain * 120, 80, 0.3, 0.15);
        break;
      case 'echo':
        tone('sine', 900, 1800, 0.5, 0.25); tone('triangle', 450, 900, 0.5, 0.2);
        noise(0.6, 6000, 300, 0.4, 3, 'bandpass'); tone('sine', 90, 40, 0.5, 0.6);
        break;
      case 'crate': noise(0.2, 2000, 400, 0.35, 1); break;
      case 'pickup': [523, 659, 784, 1046].forEach(function (f, i) { tone('square', f, f, 0.1, 0.18, ac.currentTime + i * 0.05); }); break;
      case 'death': tone('sawtooth', 500, 40, 0.7, 0.4); noise(0.5, 2000, 100, 0.4); break;
      case 'kill': tone('square', 700, 1400, 0.12, 0.25); tone('square', 1050, 2100, 0.18, 0.2, ac.currentTime + 0.08); break;
      case 'clear': [392, 523, 659, 784, 1046].forEach(function (f, i) { tone('triangle', f, f, 0.3, 0.3, ac.currentTime + i * 0.1); }); break;
      case 'over': [330, 262, 220, 165].forEach(function (f, i) { tone('sawtooth', f, f * 0.98, 0.4, 0.25, ac.currentTime + i * 0.2); }); break;
      case 'round': tone('square', 330, 660, 0.25, 0.2); break;
      case 'ui': tone('square', 600, 900, 0.08, 0.15); break;
    }
  };

  /* simple 16-step minor groove */
  var BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 49, 0];
  var ARP = [220, 262, 330, 262, 220, 262, 330, 392, 196, 233, 294, 233, 196, 233, 294, 349];
  function schedule() {
    if (!ac || !musicOn) return;
    while (nextT < ac.currentTime + 0.2) {
      var bpm = 112 + tension * 22, sd = 60 / bpm / 4, i = step % 16, bar = Math.floor(step / 16) % 4;
      var tr = [1, 1, 1.125, 0.89][bar];
      if (BASS[i]) tone('sawtooth', BASS[i] * tr, BASS[i] * tr, sd * 1.7, 0.5, nextT, musBus);
      if (i % 2 === 0 || tension > 0.5) tone('square', ARP[i] * tr, ARP[i] * tr, sd * 0.8, 0.14, nextT, musBus);
      if (i % 4 === 0) tone('sine', 120, 45, 0.12, 0.8, nextT, musBus);
      if (i % 8 === 4) { // snare
        var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 1800;
        g.gain.setValueAtTime(0.5, nextT); g.gain.exponentialRampToValueAtTime(0.001, nextT + 0.12);
        s.connect(f); f.connect(g); g.connect(musBus); s.start(nextT); s.stop(nextT + 0.15);
      }
      if (i % 2 === 1) { // hat
        var h = ac.createBufferSource(), hf = ac.createBiquadFilter(), hg = ac.createGain();
        h.buffer = noiseBuf; hf.type = 'highpass'; hf.frequency.value = 7000;
        hg.gain.setValueAtTime(0.18, nextT); hg.gain.exponentialRampToValueAtTime(0.001, nextT + 0.04);
        h.connect(hf); hf.connect(hg); hg.connect(musBus); h.start(nextT); h.stop(nextT + 0.05);
      }
      nextT += sd; step++;
    }
  }
  A.startMusic = function () {
    if (!ensure() || musicOn) return;
    musicOn = true; nextT = ac.currentTime + 0.05; step = 0;
    timer = setInterval(schedule, 60);
  };
  A.stopMusic = function () { musicOn = false; if (timer) { clearInterval(timer); timer = null; } };
  A.setTension = function (t) { tension = Math.max(0, Math.min(1, t)); };
})(window);
