(function (global) {
  'use strict';
  var FW = global.FW, ctx = null, master = null, muted = false, nextNote = 0, step = 0, music = false, noiseBuf = null;
  var BASS = [55, 55, 82.4, 55, 73.4, 73.4, 98, 73.4], LEAD = [0, 220, 0, 261.6, 0, 329.6, 293.7, 0];
  function init() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : .55; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function unlock() { if (init() && ctx.state === 'suspended') ctx.resume(); }
  function tone(f, t0, dur, type, vol, slide) {
    if (!ctx) return; var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + .02);
  }
  function noise(t0, dur, vol, freq) {
    if (!ctx) return; var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t0); f.frequency.exponentialRampToValueAtTime(80, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur);
  }
  function now() { return ctx ? ctx.currentTime : 0; }
  function event(e) {
    if (!ctx || muted) return; var t = now();
    switch (e.type) {
      case 'place': tone(200, t, .12, 'square', .18, 120); break;
      case 'boom': noise(t, .7, .9, 3000); tone(90, t, .5, 'sine', .7, 35); break;
      case 'bend': tone(880, t + .04, .25, 'triangle', .22, 1760); tone(1320, t + .09, .25, 'triangle', .15, 660); break;
      case 'crate': tone(300, t, .08, 'square', .1, 120); break;
      case 'kill': tone(520, t, .2, 'sawtooth', .22, 130); break;
      case 'multi': case 'chain': [523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + i * .06, .18, 'triangle', .18); }); break;
      case 'pickup': tone(660, t, .08, 'square', .16); tone(990, t + .08, .12, 'square', .16); break;
      case 'hurt': tone(330, t, .6, 'sawtooth', .3, 60); break;
      case 'clear': [392, 523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + i * .11, .3, 'triangle', .25); }); break;
      case 'over': [330, 262, 196, 131].forEach(function (f, i) { tone(f, t + i * .22, .4, 'sawtooth', .22); }); break;
    }
  }
  function tick(running, tension) {
    if (!ctx || muted || !running) { nextNote = 0; return; }
    var spb = tension ? .17 : .22, t = now();
    if (nextNote < t) nextNote = t + .05;
    while (nextNote < t + .15) {
      var i = step % 8;
      tone(BASS[i], nextNote, spb * .9, 'triangle', .22);
      if (step % 2 === 0) noise(nextNote, .05, .12, 6000);
      if (LEAD[i] && (step >> 3) % 2) tone(LEAD[i], nextNote, spb * .6, 'square', .05);
      nextNote += spb; step++;
    }
  }
  function mute(m) { muted = m; if (master) master.gain.value = m ? 0 : .55; }
  FW.Audio = { unlock: unlock, event: event, tick: tick, mute: mute, isMuted: function () { return muted; } };
})(window);
