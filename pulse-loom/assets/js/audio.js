(function (global) {
  'use strict';
  var A = (global.PL = global.PL || {}).Audio = {};
  var ctx = null;
  A.unlock = function () {
    try {
      if (!ctx) ctx = new (global.AudioContext || global.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
  };
  function tone(frequency, duration, type, gain) {
    if (!ctx) return;
    var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = type; o.frequency.setValueAtTime(frequency, t);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + duration);
  }
  A.beat = function (beat) {
    if (beat % 4 === 0) tone(92, 0.16, 'sine', 0.14);
    else if (beat % 2 === 0) tone(156, 0.08, 'triangle', 0.07);
    else tone(800, 0.025, 'sine', 0.025);
  };
  A.hit = function (lane, perfect) {
    tone([220, 277.18, 329.63, 440][lane], perfect ? 0.45 : 0.25, 'triangle', 0.13);
  };
})(typeof window !== 'undefined' ? window : this);
