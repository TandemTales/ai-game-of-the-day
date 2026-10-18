(function (global) {
  'use strict';
  var A = (global.GR = global.GR || {}).Audio = {};
  var ctx = null, master = null, musicOn = false, nextNote = 0, step = 0, status = 'unavailable', tick = null;
  var scale = [0, 3, 7, 10, 12, 15];
  var bass = [55, 55, 65.41, 49];
  function tone(freq, t, dur, type, vol, slide) {
    if (!ctx) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  A.status = function () { return status; };
  A.unlock = function () {
    if (!ctx) {
      var C = global.AudioContext || global.webkitAudioContext;
      if (!C) { status = 'unavailable'; return; }
      try {
        ctx = new C(); master = ctx.createGain(); master.gain.value = 0.5;
        var comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
      } catch (e) { ctx = null; status = 'unavailable'; return; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    status = ctx.state === 'running' ? 'ready' : 'blocked';
  };
  A.startMusic = function (level) {
    A.unlock(); if (!ctx || musicOn) return; musicOn = true; nextNote = ctx.currentTime + 0.1; step = 0;
    var spd = 0.19 / Math.min(1.4, 1 + (level - 1) * 0.05);
    tick = global.setInterval(function () {
      if (!ctx || !musicOn) return;
      while (nextNote < ctx.currentTime + 0.25) {
        var bar = Math.floor(step / 16) % 4, s = step % 16;
        if (s % 4 === 0) tone(bass[bar], nextNote, spd * 3.6, 'triangle', 0.16);
        if (s % 2 === 1 || s % 8 === 6) {
          var n = scale[(step * 3 + bar * 2) % scale.length];
          tone(bass[bar] * 4 * Math.pow(2, n / 12), nextNote, spd * 1.6, 'sine', 0.05);
        }
        if (s === 0 && bar % 2 === 0) tone(bass[bar] * 8, nextNote, spd * 6, 'sine', 0.02);
        nextNote += spd; step++;
      }
    }, 60);
  };
  A.stopMusic = function () { musicOn = false; if (tick) global.clearInterval(tick); tick = null; };
  A.sfx = function (name, n) {
    if (!ctx || ctx.state !== 'running') { if (ctx && ctx.state === 'suspended') status = 'blocked'; return; }
    var t = ctx.currentTime;
    if (name === 'ember') tone(520 + (n % 2) * 90, t, 0.07, 'square', 0.05);
    else if (name === 'flare') { tone(220, t, 0.5, 'sawtooth', 0.09, 880); tone(440, t, 0.4, 'sine', 0.08, 1320); }
    else if (name === 'rune') { tone(330, t, 0.25, 'triangle', 0.1, 660); tone(495, t + 0.1, 0.25, 'triangle', 0.08, 990); }
    else if (name === 'flip') { tone(110, t, 0.3, 'square', 0.12, 55); tone(660, t, 0.08, 'square', 0.06); }
    else if (name === 'eat') { tone(300, t, 0.3, 'square', 0.1, 1200); }
    else if (name === 'hit') { tone(400, t, 0.8, 'sawtooth', 0.12, 40); }
    else if (name === 'clear') { [0, 4, 7, 12, 16].forEach(function (s, i) { tone(330 * Math.pow(2, s / 12), t + i * 0.09, 0.3, 'triangle', 0.1); }); }
    else if (name === 'over') { [0, -3, -7, -12].forEach(function (s, i) { tone(330 * Math.pow(2, s / 12), t + i * 0.2, 0.5, 'sawtooth', 0.08); }); }
  };
})(window);
