(function (global) {
  'use strict';
  var WW = global.WW = global.WW || {};
  var ctx = null, master = null, drone = null, flip = 0, muted = false;
  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); } catch (e) { ctx = null; }
    return ctx;
  }
  function tone(freq, dur, type, vol, slide, delay) {
    var c = ensure(); if (!c || muted) return;
    var t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    var c = ensure(); if (!c || muted) return;
    var n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.frequency.value = freq || 800; g.gain.value = vol || 0.2;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  var A = WW.Audio = {};
  A.unlock = function () { var c = ensure(); if (c && c.state === 'suspended') c.resume(); };
  A.status = function () { var c = ensure(); return !c ? 'unavailable' : c.state === 'running' ? 'ready' : 'blocked'; };
  A.setMuted = function (m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; if (m) A.stopDrone(); };
  A.startDrone = function () {
    var c = ensure(); if (!c || drone || muted) return;
    var o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o1.type = 'sine'; o1.frequency.value = 55; o2.type = 'triangle'; o2.frequency.value = 82.6;
    g.gain.value = 0.05; lfo.frequency.value = 0.25; lg.gain.value = 0.02;
    lfo.connect(lg); lg.connect(g.gain);
    o1.connect(g); o2.connect(g); g.connect(master); o1.start(); o2.start(); lfo.start();
    drone = { stop: function () { try { o1.stop(); o2.stop(); lfo.stop(); } catch (e) { } } };
  };
  A.stopDrone = function () { if (drone) { drone.stop(); drone = null; } };
  A.event = function (e) {
    switch (e.type) {
      case 'ember': flip ^= 1; tone(flip ? 520 : 660, 0.07, 'triangle', 0.12); break;
      case 'power': tone(220, 0.4, 'sawtooth', 0.12, 880); tone(330, 0.4, 'sine', 0.1, 990); break;
      case 'eatGloam': tone(300, 0.3, 'square', 0.1, 1400); noise(0.15, 0.12, 2000); break;
      case 'fruit': tone(880, 0.1, 'triangle', 0.15); tone(1320, 0.18, 'triangle', 0.15, null, 0.09); break;
      case 'fruitSpawn': tone(1000, 0.12, 'sine', 0.08); break;
      case 'death': tone(500, 1.1, 'sawtooth', 0.14, 60); noise(0.5, 0.1, 400); break;
      case 'gateWarn': tone(180, 0.12, 'square', 0.06); break;
      case 'gateFlip': tone(70, 0.4, 'sine', 0.3, 40); noise(0.25, 0.14, 300); break;
      case 'flare': tone(1200, 0.5, 'sine', 0.14, 300); noise(0.3, 0.14, 3000); break;
      case 'flareFail': tone(140, 0.12, 'square', 0.07); break;
      case 'charge': tone(660, 0.1, 'sine', 0.12); tone(990, 0.2, 'sine', 0.12, null, 0.08); break;
      case 'clear': [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.14, null, i * 0.11); }); break;
      case 'life': [784, 988, 1318].forEach(function (f, i) { tone(f, 0.2, 'sine', 0.14, null, i * 0.08); }); break;
      case 'ready': [392, 523, 659].forEach(function (f, i) { tone(f, 0.18, 'triangle', 0.12, null, i * 0.12); }); break;
      case 'over': tone(300, 1.4, 'triangle', 0.14, 70); break;
    }
  };
})(window);
