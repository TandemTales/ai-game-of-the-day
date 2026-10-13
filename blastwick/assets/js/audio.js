/* Blastwick - procedural WebAudio. Owner: audio. Namespace: BW.Audio */
(function (g) {
  'use strict';
  var BW = g.BW = g.BW || {};
  var ac = null, master = null, muted = false, musicOn = false, step = 0, nextT = 0, timer = null;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    var C = g.AudioContext || g.webkitAudioContext; if (!C) return;
    ac = new C(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
  }
  function tone(f, d, type, vol, slide, when) {
    if (!ac) return; var t = when || ac.currentTime, o = ac.createOscillator(), gn = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + d);
    gn.gain.setValueAtTime(vol || 0.2, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn); gn.connect(master); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(d, vol, hp) {
    if (!ac) return; var n = Math.floor(ac.sampleRate * d), buf = ac.createBuffer(1, n, ac.sampleRate), data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = hp || 900; gn.gain.value = vol || 0.5;
    s.connect(f); f.connect(gn); gn.connect(master); s.start();
  }

  var SCALE = [0, 3, 5, 7, 10, 12];
  function schedule() {
    if (!ac || !musicOn) return;
    while (nextT < ac.currentTime + 0.3) {
      var bar = Math.floor(step / 8) % 4, root = [110, 98, 130.8, 98][bar];
      if (step % 2 === 0) tone(root * (step % 8 === 4 ? 1.5 : 1), 0.18, 'triangle', 0.16, 0, nextT);
      if (step % 4 === 2) tone(root * 4 * Math.pow(2, SCALE[(step * 3 + bar) % 6] / 12), 0.12, 'square', 0.035, 0, nextT);
      nextT += 0.17; step++;
    }
  }

  BW.Audio = {
    init: init,
    toggleMute: function () { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    isMuted: function () { return muted; },
    music: function (on) {
      musicOn = on; if (!ac) return;
      if (on) { nextT = ac.currentTime + 0.05; if (!timer) timer = setInterval(schedule, 100); }
      else if (timer) { clearInterval(timer); timer = null; }
    },
    play: function (name, a) {
      if (!ac || muted) return;
      switch (name) {
        case 'place': tone(220, 0.1, 'sine', 0.25, 120); break;
        case 'boom': noise(0.5 + (a || 0) * 0.05, 0.9, 700 + (a || 0) * 250); tone(90 * (1 + (a || 0) * 0.12), 0.35, 'sawtooth', 0.25, 30); break;
        case 'crate': noise(0.15, 0.3, 2400); break;
        case 'kill': tone(520, 0.12, 'square', 0.15, 1100); break;
        case 'pickup': tone(660, 0.08, 'square', 0.15); tone(990, 0.12, 'square', 0.15, 0, ac.currentTime + 0.07); break;
        case 'chain': [0, 4, 7, 12].forEach(function (s, i) { tone(440 * Math.pow(2, s / 12), 0.14, 'triangle', 0.22, 0, ac.currentTime + i * 0.06); }); break;
        case 'death': tone(400, 0.7, 'sawtooth', 0.25, 40); break;
        case 'kind': tone(880, 0.06, 'square', 0.12); break;
        case 'tide': noise(0.9, 0.5, 400); tone(70, 0.8, 'sine', 0.3, 40); break;
        case 'clear': [0, 4, 7, 12, 16].forEach(function (s, i) { tone(392 * Math.pow(2, s / 12), 0.2, 'square', 0.15, 0, ac.currentTime + i * 0.09); }); break;
        case 'exit': tone(300, 0.4, 'sine', 0.2, 900); break;
        case 'shield': tone(300, 0.2, 'triangle', 0.25, 80); break;
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
