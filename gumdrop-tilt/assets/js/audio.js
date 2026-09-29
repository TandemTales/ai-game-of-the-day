/* Procedural Web Audio: pops that rise in pitch with chain length. Global GTA. */
(function (root) {
  'use strict';
  var ctx = null, muted = false, master = null;
  function ensure() {
    if (ctx || muted) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination); return ctx;
  }
  function tone(freq, dur, type, vol, slide, delay) {
    if (muted || !ensure()) return; var t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  var SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  function note(i) { return 261.63 * Math.pow(2, SCALE[Math.min(i, SCALE.length - 1)] / 12); }
  root.GTA = {
    resume: function () { var c = ensure(); if (c && c.state === 'suspended') c.resume(); },
    setMuted: function (m) { muted = m; },
    play: function (e) {
      if (e.type === 'move') tone(520, 0.03, 'square', 0.04);
      else if (e.type === 'rotate') tone(700, 0.05, 'triangle', 0.08);
      else if (e.type === 'lock' || e.type === 'hard') tone(140, 0.12, 'sine', 0.35, 0.5);
      else if (e.type === 'pop') { var n = e.data.chain - 1; tone(note(n), 0.35, 'sine', 0.35); tone(note(n) * 2, 0.25, 'triangle', 0.18, 1, 0.04); tone(note(n) * 1.5, 0.3, 'sine', 0.15, 1, 0.08); }
      else if (e.type === 'tiltWarn') { tone(330, 0.15, 'square', 0.12); tone(330, 0.15, 'square', 0.12, 1, 0.2); }
      else if (e.type === 'tilt') { tone(220, 0.55, 'sawtooth', 0.2, 2.2); tone(110, 0.6, 'sine', 0.3, 0.6); }
      else if (e.type === 'allclear') { [0, 2, 4, 5, 7].forEach(function (k, i) { tone(note(k), 0.4, 'triangle', 0.25, 1, i * 0.09); }); }
      else if (e.type === 'gameover') { tone(300, 0.9, 'sawtooth', 0.25, 0.3); }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
