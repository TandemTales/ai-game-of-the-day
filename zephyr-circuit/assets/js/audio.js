/* =====================================================================
   ZEPHYR CIRCUIT — audio.js
   Procedural engine note, tyre scrub and one-shots.
   Owner: agent-audio (this first pass written by the lead — a working
   floor, not the finished article).

   Everything is synthesised. Nothing is fetched.
   ===================================================================== */
(function (global) {
  'use strict';
  var ZC = global.ZC || (global.ZC = {});
  var A = ZC.Audio = {};

  var ctx = null, master = null, engine = null, engineGain = null;
  var scrub = null, scrubGain = null, scrubFilter = null;
  var muted = false, started = false;

  A.init = function () {
    muted = !!ZC.store.get('muted', false);
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.45;
    master.connect(ctx.destination);
  };

  function build() {
    if (!ctx || started) return;
    started = true;

    /* Engine: a sawtooth whose pitch tracks road speed, through a lowpass
       so it growls rather than buzzes. */
    engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 60;
    var ef = ctx.createBiquadFilter();
    ef.type = 'lowpass'; ef.frequency.value = 900; ef.Q.value = 3;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engine.connect(ef); ef.connect(engineGain); engineGain.connect(master);
    engine.start();

    /* Tyre scrub: filtered noise, opened up while sliding. */
    var len = ctx.sampleRate * 2;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    scrub = ctx.createBufferSource();
    scrub.buffer = buf; scrub.loop = true;
    scrubFilter = ctx.createBiquadFilter();
    scrubFilter.type = 'bandpass'; scrubFilter.frequency.value = 1800; scrubFilter.Q.value = 1.2;
    scrubGain = ctx.createGain(); scrubGain.gain.value = 0;
    scrub.connect(scrubFilter); scrubFilter.connect(scrubGain); scrubGain.connect(master);
    scrub.start();
  }

  A.resume = function () {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    build();
  };

  A.toggleMute = function () {
    muted = !muted;
    ZC.store.set('muted', muted);
    if (master) master.gain.value = muted ? 0 : 0.45;
    if (ZC.UI && ZC.UI.toast) ZC.UI.toast(muted ? 'Muted' : 'Sound on', 1000);
  };
  A.isMuted = function () { return muted; };

  A.update = function (kart, dt) {
    if (!ctx || !engineGain || !kart) return;
    var v = Math.max(0, kart.speed) / ZC.Kart.TUNE.maxSpeed;
    /* Step the pitch through four "gears" so acceleration has shape
       instead of one long siren rise. */
    var gear = Math.min(3, Math.floor(v * 3.4));
    var within = ZC.clamp01(v * 3.4 - gear);
    engine.frequency.value = 58 + gear * 16 + within * 70 + (kart.boost > 0 ? 40 : 0);
    engineGain.gain.value = 0.06 + v * 0.10;
    scrubGain.gain.value = kart.drift.active ? 0.05 + Math.abs(kart.slip) * 0.16 : 0;
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
    if (name === 'boost') blip(320, 0.35, 'square', 0.16, 880);
    else if (name === 'lap') blip(660, 0.25, 'triangle', 0.18);
    else if (name === 'light') blip(440, 0.18, 'square', 0.14);
    else if (name === 'go') { blip(880, 0.5, 'square', 0.2); }
    else if (name === 'fall') blip(300, 0.6, 'sawtooth', 0.14, 90);
  };

  ZC.on('kart:boost', function (e) { if (e.kart && e.kart.isPlayer) A.sfx('boost'); });
  ZC.on('kart:lap', function (e) { if (e.kart && e.kart.isPlayer) A.sfx('lap'); });
  ZC.on('kart:fell', function (k) { if (k && k.isPlayer) A.sfx('fall'); });

})(window);
