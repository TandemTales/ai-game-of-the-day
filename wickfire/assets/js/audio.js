/* WICKFIRE - procedural WebAudio. No assets. */
(function (global) {
  'use strict';
  var WF = global.WF = global.WF || {};
  var ac = null, master = null, muted = false, noiseBuf = null, musicT = 0, musicStep = 0, musicOn = false;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    try {
      ac = new AC();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  function tone(f0, f1, dur, type, vol, delay) {
    if (!ac) return;
    var t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, fHi, fLo, vol, delay) {
    if (!ac) return;
    var t = ac.currentTime + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = 'lowpass';
    f.frequency.setValueAtTime(fHi, t); f.frequency.exponentialRampToValueAtTime(fLo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  var sfx = {
    place: function () { tone(220, 110, 0.12, 'triangle', 0.25); },
    boom: function (e) { noise(0.7, 2400, 90, 0.9); tone(90, 30, 0.5, 'sine', 0.6); },
    crate: function () { noise(0.15, 3000, 600, 0.3); },
    spark: function () { noise(0.05, 7000, 3000, 0.08); },
    cut: function () { tone(1400, 500, 0.08, 'sawtooth', 0.15); noise(0.06, 6000, 2000, 0.2); },
    pickup: function () { tone(660, 0, 0.08, 'square', 0.15); tone(990, 0, 0.12, 'square', 0.15, 0.07); },
    kill: function () { tone(400, 80, 0.3, 'sawtooth', 0.25); },
    death: function () { tone(500, 60, 0.9, 'sawtooth', 0.3); noise(0.5, 1500, 100, 0.4); },
    chain: function (e) { for (var i = 0; i < Math.min(e.n, 6); i++) tone(440 * Math.pow(1.122, i * 2), 0, 0.12, 'square', 0.14, i * 0.06); },
    clear: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0, 0.25, 'triangle', 0.25, i * 0.12); }); },
    ui: function () { tone(520, 780, 0.07, 'square', 0.12); }
  };
  WF.audio = {
    init: init,
    play: function (name, ev) { if (!ac || muted || !sfx[name]) return; sfx[name](ev || {}); },
    setMuted: function (m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    isMuted: function () { return muted; },
    music: function (on) { musicOn = on; },
    /* called every frame; schedules a minor-key bass + arp loop */
    tick: function (dtIntensity) {
      if (!ac || muted || !musicOn) return;
      var now = ac.currentTime;
      if (musicT < now) { musicT = now + 0.05; }
      var bpm = 108 + (dtIntensity || 0) * 30, step = 60 / bpm / 2;
      var bass = [55, 55, 65.4, 55, 73.4, 55, 65.4, 49];
      var arp = [220, 262, 330, 262, 294, 349, 440, 349];
      while (musicT < now + 0.25) {
        var i = musicStep % 8, t = musicT - now;
        if (musicStep % 2 === 0) tone(bass[(musicStep / 2) % 8 | 0], 0, step * 1.6, 'triangle', 0.16, t);
        if (musicStep % 4 === 3 || musicStep % 8 === 6) tone(arp[i], 0, step * 0.8, 'square', 0.04, t);
        if (musicStep % 4 === 2) noise(0.05, 8000, 4000, 0.05, t);
        musicStep++; musicT += step;
      }
    }
  };
})(window);
