/* Wickfire audio: procedural Web Audio SFX + a small looping foundry groove. */
(function () {
  'use strict';
  var WK = window.WK = window.WK || {};
  var ac = null, master = null, musicOn = true, sfxOn = true, mTimer = null, step = 0, noiseBuf = null;
  function ensure() {
    if (ac) return ac;
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ac = new C(); master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
    return ac;
  }
  function tone(f, dur, type, vol, slide, when) {
    if (!ac || !sfxOn) return;
    var t = ac.currentTime + (when || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, lp, hp, when) {
    if (!ac || !sfxOn) return;
    var t = ac.currentTime + (when || 0), s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    s.buffer = noiseBuf; f.type = hp ? 'highpass' : 'lowpass'; f.frequency.setValueAtTime(lp || 1200, t);
    if (!hp) f.frequency.exponentialRampToValueAtTime(100, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  var sfx = {
    drop: function () { tone(180, 0.12, 'triangle', 0.3, 0.5); noise(0.05, 0.12, 900); },
    ignite: function () { noise(0.7, 0.16, 5000, true); tone(900, 0.5, 'sawtooth', 0.05, 2.2); },
    flame: function () { noise(0.1, 0.05, 6000, true); },
    boom: function (e) { noise(0.7, 0.55, 1800); tone(90, 0.5, 'sine', 0.5, 0.3); },
    crate: function () { noise(0.12, 0.18, 2500); },
    kill: function (e) { var c = Math.min(6, e.combo || 1); tone(330 * Math.pow(1.122, c * 2), 0.18, 'square', 0.16, 1.5); tone(660 * Math.pow(1.122, c * 2), 0.22, 'triangle', 0.14, 1.2, 0.07); },
    pickup: function () { tone(523, 0.08, 'square', 0.14); tone(784, 0.14, 'square', 0.14, 1, 0.07); tone(1046, 0.2, 'triangle', 0.14, 1, 0.14); },
    hurt: function () { tone(220, 0.4, 'sawtooth', 0.3, 0.3); noise(0.3, 0.3, 700); },
    clear: function () { [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, 0.25, 'square', 0.14, 1, i * 0.09); }); },
    over: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.4, 'triangle', 0.25, 0.95, i * 0.2); }); },
    ui: function () { tone(660, 0.06, 'square', 0.1); }
  };
  // Minor-key groove: bass + arp, 8th-note grid.
  var BASS = [55, 55, 65.4, 55, 73.4, 55, 65.4, 49];
  var ARP = [220, 261.6, 329.6, 261.6, 293.7, 349.2, 440, 349.2];
  function tick() {
    if (!ac || !musicOn || ac.state !== 'running') return;
    var i = step++ % 32, bar = Math.floor(i / 8), k = i % 8;
    var root = [1, 1, 1.189, 0.89][bar];
    if (k % 2 === 0) tone(BASS[k] * root * 2, 0.22, 'triangle', 0.16, 0.9);
    tone(ARP[(k + bar) % 8] * root, 0.12, 'square', 0.035);
    if (k === 4) noise(0.08, 0.06, 4000, true);
    if (k === 0) noise(0.06, 0.1, 400);
  }
  WK.audio = {
    unlock: function () { if (ensure() && ac.state === 'suspended') ac.resume(); },
    play: function (n, e) { if (ensure() && sfx[n]) sfx[n](e || {}); },
    startMusic: function () { if (!ensure() || mTimer) return; mTimer = setInterval(tick, 190); },
    stopMusic: function () { clearInterval(mTimer); mTimer = null; },
    setMusic: function (b) { musicOn = b; }, setSfx: function (b) { sfxOn = b; },
    get music() { return musicOn; }, get sfx() { return sfxOn; }
  };
})();
