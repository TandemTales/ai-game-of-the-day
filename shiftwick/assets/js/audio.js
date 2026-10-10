/* SHIFTWICK procedural audio. */
(function (g) {
  'use strict';
  var SW = g.SW, A = SW.Audio = {}, ac = null, master = null, muted = false, alt = 0, droneNodes = null;
  try { muted = localStorage.getItem('shiftwick.mute') === '1'; } catch (e) {}
  A.isMuted = function () { return muted; };
  A.init = function () {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    var C = g.AudioContext || g.webkitAudioContext; if (!C) return;
    ac = new C(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
  };
  A.setMuted = function (m) { muted = m; try { localStorage.setItem('shiftwick.mute', m ? '1' : '0'); } catch (e) {} if (master) master.gain.value = m ? 0 : 0.5; };
  function tone(f, d, type, vol, slide, delay) {
    if (!ac) return; var t = ac.currentTime + (delay || 0), o = ac.createOscillator(), gn = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + d);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol || .2, t + .01); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn); gn.connect(master); o.start(t); o.stop(t + d + .05);
  }
  function noise(d, vol, f0, f1) {
    if (!ac) return; var n = ac.sampleRate * d, b = ac.createBuffer(1, n, ac.sampleRate), ch = b.getChannelData(0);
    for (var i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    var s = ac.createBufferSource(); s.buffer = b; var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    var t = ac.currentTime; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + d);
    var gn = ac.createGain(); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(gn); gn.connect(master); s.start();
  }
  A.event = function (e) {
    if (!ac || muted) return;
    switch (e.type) {
      case 'ember': alt ^= 1; tone(alt ? 520 : 660, .07, 'triangle', .12, 1.1); break;
      case 'power': tone(330, .5, 'sawtooth', .12, 3); tone(660, .4, 'sine', .15, 2, .05); break;
      case 'snuff': tone(220, .25, 'square', .12, 4); tone(880, .3, 'triangle', .14, 1.5, .08); break;
      case 'shift': noise(.28, .5, 300, 3000); tone(110, .25, 'sawtooth', .15, .5); break;
      case 'die': tone(520, .9, 'sawtooth', .18, .12); noise(.6, .3, 2000, 200); break;
      case 'clear': [523, 659, 784, 1047].forEach(function (f, i) { tone(f, .35, 'triangle', .18, 1, i * .1); }); break;
      case 'charge': tone(880, .12, 'sine', .1); break;
      case 'over': tone(196, 1.2, 'sawtooth', .16, .5); break;
      case 'respawn': tone(392, .2, 'triangle', .14, 1.5); break;
    }
  };
  A.menu = function () { if (!ac || muted) return; tone(660, .1, 'triangle', .15, 1.3); };
  A.drone = function (on) {
    if (!ac) return;
    if (!on) { if (droneNodes) { try { droneNodes.o.forEach(function (o) { o.stop(); }); } catch (e) {} droneNodes = null; } return; }
    if (droneNodes) return;
    var gn = ac.createGain(); gn.gain.value = .05; gn.connect(master);
    var os = [55, 82.5, 110.4].map(function (f) { var o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(gn); o.start(); return o; });
    var lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .2; lg.gain.value = .025; lfo.connect(lg); lg.connect(gn.gain); lfo.start(); os.push(lfo);
    droneNodes = { o: os };
  };
})(window);
