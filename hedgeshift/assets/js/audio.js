(function (global) {
  'use strict';
  var HG = global.HG = global.HG || {};
  var ctx = null, master = null, flip = 0, enabled = true;
  function ensure() {
    if (ctx || !enabled) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext; if (!AC) { enabled = false; return null; }
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination); return ctx;
  }
  function tone(f, d, type, vol, slide, delay) {
    if (!ensure()) return; var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(d, vol, freq) {
    if (!ensure()) return; var t = ctx.currentTime, n = Math.floor(ctx.sampleRate * d), b = ctx.createBuffer(1, n, ctx.sampleRate), a = b.getChannelData(0);
    for (var i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq || 800; g.gain.value = vol || 0.3; s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  HG.Audio = {
    unlock: function () { var c = ensure(); if (c && c.state === 'suspended') c.resume(); },
    mute: function (m) { enabled = !m; if (master) master.gain.value = m ? 0 : 0.35; },
    play: function (e) {
      switch (e.t) {
        case 'dew': flip ^= 1; tone(flip ? 660 : 880, 0.07, 'triangle', 0.18); break;
        case 'lantern': tone(220, 0.35, 'sawtooth', 0.2, 3); tone(440, 0.4, 'sine', 0.2, 2, 0.05); break;
        case 'eatWisp': tone(300 + e.chain * 120, 0.22, 'square', 0.18, 2.5); break;
        case 'shift': noise(0.5, 0.35, 400); tone(90, 0.5, 'sine', 0.3, 0.5); break;
        case 'crush': noise(0.3, 0.5, 200); tone(120, 0.3, 'square', 0.25, 0.3); break;
        case 'squeeze': tone(500, 0.12, 'triangle', 0.2, 0.5); break;
        case 'death': tone(500, 0.9, 'sawtooth', 0.25, 0.1); break;
        case 'clear': [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.25, 1, i * 0.12); }); break;
        case 'start': tone(392, 0.15, 'triangle', 0.2); tone(588, 0.2, 'triangle', 0.2, 1, 0.12); break;
        case 'warn': tone(180, 0.08, 'square', 0.1); break;
        case 'over': tone(260, 0.8, 'sawtooth', 0.2, 0.3); break;
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
