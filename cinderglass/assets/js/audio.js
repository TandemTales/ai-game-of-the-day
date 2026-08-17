/* =====================================================================
   CINDERGLASS — audio.js
   Procedural Web Audio: a foundry room tone that follows how hot the
   chamber is, plus a handful of one-shots.
   Owner: agent-audio (this first pass written by the lead — a working
   floor, not the finished article).

   Everything is synthesised. No files are fetched, so the game still
   sounds like something when it is opened straight off the disk.
   ===================================================================== */
(function (global) {
  'use strict';

  var CG = global.CG || (global.CG = {});
  var A = CG.Audio = {};

  var ctx = null, master = null, bedGain = null, noiseSrc = null, filter = null;
  var muted = false, started = false;

  A.init = function () {
    muted = !!CG.store.get('muted', false);
    /* An AudioContext created before a user gesture starts suspended in
       every current browser, so it is built here and resumed on the first
       real interaction rather than being fought with. */
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  };

  function buildBed() {
    if (!ctx || started) return;
    started = true;

    /* pink-ish noise: the room tone of a furnace hall */
    var len = ctx.sampleRate * 2;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
    }
    noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;
    noiseSrc.loop = true;

    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 0.7;

    bedGain = ctx.createGain();
    bedGain.gain.value = 0.0;

    noiseSrc.connect(filter);
    filter.connect(bedGain);
    bedGain.connect(master);
    noiseSrc.start();
  }

  A.resume = function () {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    buildBed();
  };

  A.toggleMute = function () {
    muted = !muted;
    CG.store.set('muted', muted);
    if (master) master.gain.value = muted ? 0 : 0.5;
    if (CG.UI && CG.UI.toast) CG.UI.toast(muted ? 'Muted' : 'Sound on', 1000);
  };
  A.isMuted = function () { return muted; };

  /* The bed tracks the chamber: the hotter and busier it is, the more the
     room roars. Sampled rather than swept, for the same reason as the
     particle emitters. */
  var heatAvg = 0;
  A.update = function (sim, dt) {
    if (!ctx || !bedGain) return;
    var acc = 0;
    for (var s = 0; s < 96; s++) {
      var i = (CG.rand() * sim.N) | 0;
      acc += Math.max(0, sim.temp[i] - CG.AMBIENT);
    }
    var lvl = CG.clamp01(acc / 96 / 700);
    heatAvg = CG.damp(heatAvg, lvl, 2.2, dt);
    bedGain.gain.value = 0.05 + heatAvg * 0.30;
    filter.frequency.value = 240 + heatAvg * 900;
  };

  function blip(freq, dur, type, vol, sweepTo) {
    if (!ctx || muted) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol || 0.2, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }

  A.sfx = function (name) {
    if (!ctx) return;
    if (name === 'clear') {
      blip(392, 0.5, 'triangle', 0.22);
      setTimeout(function () { blip(587, 0.7, 'triangle', 0.2); }, 110);
    } else if (name === 'fail') {
      blip(180, 0.7, 'sawtooth', 0.16, 70);
    } else if (name === 'tick') {
      blip(880, 0.06, 'square', 0.06);
    }
  };

})(window);
