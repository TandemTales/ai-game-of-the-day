(function (global) {
  'use strict';
  var TL = global.TL = global.TL || {}, ctx, muted = false;
  function unlock() {
    try { if (!ctx) { var Audio = global.AudioContext || global.webkitAudioContext; if (Audio) ctx = new Audio(); }
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
    } catch (e) { ctx = null; }
  }
  function note(hz, start, length, gain) {
    if (!ctx || muted) return;
    var o = ctx.createOscillator(), v = ctx.createGain(), t = ctx.currentTime + start;
    o.type = 'sine'; o.frequency.setValueAtTime(hz, t);
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(gain, t + 0.012);
    v.gain.exponentialRampToValueAtTime(0.001, t + length);
    o.connect(v); v.connect(ctx.destination); o.start(t); o.stop(t + length + 0.01);
  }
  function play(event) {
    if (event === 'capture' || event === 'clear') [293.66, 369.99, 440, 587.33].forEach(function (f, i) { note(f, i * 0.075, 0.5, 0.09); });
    else if (event === 'hit') { note(100, 0, 0.5, 0.12); note(74, 0.1, 0.6, 0.1); }
    else if (event === 'pulse') [587.33, 440, 293.66].forEach(function (f, i) { note(f, i * 0.1, 0.65, 0.08); });
  }
  TL.Audio = { unlock: unlock, play: play, toggle: function () { muted = !muted; return muted; } };
})(window);
