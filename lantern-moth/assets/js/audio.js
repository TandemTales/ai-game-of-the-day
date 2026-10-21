(function (global) {
  'use strict';
  var LM = global.LM = global.LM || {};
  var ctx = null, master = null, flip = 0, drone = null, muted = false;
  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); } catch (e) { ctx = null; }
    return ctx;
  }
  function tone(freq, dur, type, vol, slide, delay) {
    if (!ensure() || muted) return;
    var t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq) {
    if (!ensure() || muted) return;
    var n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = freq || 600; g.gain.value = vol || 0.2;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  function startDrone() {
    if (!ensure() || drone || muted) return;
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 55; o2.frequency.value = 55.7;
    f.type = 'lowpass'; f.frequency.value = 220; g.gain.value = 0.05;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master); o1.start(); o2.start();
    drone = { stop: function () { try { o1.stop(); o2.stop(); } catch (e) {} drone = null; } };
  }
  LM.Audio = {
    unlock: function () { var c = ensure(); if (c && c.state === 'suspended') c.resume(); startDrone(); },
    status: function () { return ctx ? ctx.state : 'idle'; },
    setMuted: function (m) { muted = m; if (m && drone) drone.stop(); else if (!m) startDrone(); },
    isMuted: function () { return muted; },
    play: function (ev) {
      switch (ev.type) {
        case 'seed': flip ^= 1; tone(flip ? 620 : 780, 0.07, 'triangle', 0.12); break;
        case 'lantern': tone(220, 0.5, 'sawtooth', 0.12, 4); tone(660, 0.4, 'sine', 0.15, 2, 0.05); break;
        case 'eat': [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.12, 'square', 0.09, 1, i * 0.05); }); break;
        case 'death': tone(600, 1.2, 'sawtooth', 0.15, 0.08); noise(0.5, 0.12, 300); break;
        case 'gate': noise(0.35, 0.18, 220); tone(90, 0.3, 'square', 0.1, 0.6); break;
        case 'warn': tone(880, 0.06, 'square', 0.05); tone(880, 0.06, 'square', 0.05, 1, 0.18); break;
        case 'clear': [392, 494, 587, 784, 988].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.16, 1, i * 0.1); }); break;
        case 'life': [784, 988, 1175].forEach(function (f, i) { tone(f, 0.15, 'sine', 0.15, 1, i * 0.08); }); break;
        case 'over': [330, 262, 196, 131].forEach(function (f, i) { tone(f, 0.4, 'triangle', 0.15, 1, i * 0.25); }); break;
      }
    }
  };
})(window);
