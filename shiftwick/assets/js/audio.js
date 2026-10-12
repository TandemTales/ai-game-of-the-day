/* Shiftwick - procedural Web Audio. All sounds synthesised; safe if audio unavailable. */
(function (root) {
  'use strict';
  var A = root.SWAudio = { muted: false };
  var ctx = null, master = null, flip = 0, drone = null;
  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }
  A.unlock = function () { var c = ensure(); if (c && c.state === 'suspended') c.resume(); startDrone(); };
  function tone(freq, dur, type, vol, slideTo, when) {
    var c = ensure(); if (!c || A.muted) return;
    var t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, f0, f1) {
    var c = ensure(); if (!c || A.muted) return;
    var n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource(); src.buffer = b;
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    var t = c.currentTime; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  function startDrone() {
    var c = ensure(); if (!c || drone || A.muted) return;
    var o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 55; o2.frequency.value = 55.7;
    f.type = 'lowpass'; f.frequency.value = 220; g.gain.value = 0.045;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master); o1.start(); o2.start();
    drone = { g: g, f: f };
  }
  A.setTension = function (x) { if (drone && ctx) { drone.f.frequency.setTargetAtTime(180 + 500 * x, ctx.currentTime, 0.3); } };
  A.setMuted = function (m) { A.muted = m; if (drone) drone.g.gain.value = m ? 0 : 0.045; };
  A.play = function (name, arg) {
    switch (name) {
      case 'mote': flip ^= 1; tone(flip ? 520 : 660, 0.07, 'triangle', 0.12); break;
      case 'ember': tone(180, 0.4, 'sawtooth', 0.16, 720); noise(0.3, 0.2, 400, 3000); break;
      case 'ghost': tone(300 + 120 * (arg || 1), 0.25, 'square', 0.14, 1200); break;
      case 'fruit': tone(880, 0.1, 'triangle', 0.16); tone(1320, 0.18, 'triangle', 0.16, null, 0.08); break;
      case 'warn': tone(440, 0.12, 'sine', 0.12); tone(330, 0.2, 'sine', 0.12, null, 0.14); break;
      case 'slide': noise(0.5, 0.35, 200, 1800); tone(90, 0.45, 'sawtooth', 0.12, 45); break;
      case 'die': tone(520, 0.9, 'sawtooth', 0.18, 40); noise(0.7, 0.2, 2000, 120); break;
      case 'clear': [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.28, 'triangle', 0.16, null, i * 0.12); }); break;
      case 'extra': tone(784, 0.15, 'square', 0.12); tone(1175, 0.3, 'square', 0.12, null, 0.15); break;
      case 'ready': tone(330, 0.2, 'triangle', 0.12); tone(440, 0.2, 'triangle', 0.12, null, 0.2); tone(660, 0.3, 'triangle', 0.14, null, 0.4); break;
      case 'gameover': tone(330, 0.5, 'sawtooth', 0.15, 80); break;
    }
  };
})(typeof window !== 'undefined' ? window : this);
