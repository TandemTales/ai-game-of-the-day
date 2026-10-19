(function (global) {
  'use strict';
  var GW = global.GW = global.GW || {}, ctx;
  function tone(freq, duration, shape, volume) {
    try {
      var AudioContext = global.AudioContext || global.webkitAudioContext;
      if (!AudioContext) return;
      ctx = ctx || new AudioContext(); if (ctx.state === 'suspended') ctx.resume();
      var osc = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime;
      osc.type = shape || 'triangle'; osc.frequency.setValueAtTime(freq, at);
      osc.frequency.exponentialRampToValueAtTime(Math.max(55, freq * .58), at + duration);
      gain.gain.setValueAtTime(volume || .045, at);
      gain.gain.exponentialRampToValueAtTime(.001, at + duration);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(at); osc.stop(at + duration);
    } catch (e) { /* The game remains playable without audio. */ }
  }
  GW.Audio = { move: function () { tone(225, .05, 'triangle', .018); },
    rotate: function () { tone(360, .08, 'sine', .035); },
    lock: function () { tone(130, .12, 'triangle', .05); },
    clear: function () { tone(650, .4, 'sine', .06); },
    rewind: function () { tone(480, .45, 'sawtooth', .025); } };
})(window);
