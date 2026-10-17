/* Shiftmaw audio: procedural Web Audio SFX and a looping bass/arp bed. Nothing is fetched. */
(function (global) {
  'use strict';
  var SM = global.SM = global.SM || {};
  var ctx = null, master = null, sfxGain = null, musGain = null, muted = false, noiseBuf = null, moteAlt = 0;
  var musicOn = false, nextBeat = 0, beat = 0, tempo = 1;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = global.AudioContext || global.webkitAudioContext; if (!AC) return;
    try {
      ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
      musGain = ctx.createGain(); musGain.gain.value = 0.32; musGain.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  function tone(f0, f1, dur, type, vol, delay, dest) {
    if (!ctx) return; var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, f0, f1, vol, delay, q) {
    if (!ctx) return; var t = ctx.currentTime + (delay || 0);
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q || 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t); s.stop(t + dur + 0.02);
  }

  var SFX = {
    mote: function () { moteAlt ^= 1; tone(moteAlt ? 520 : 660, moteAlt ? 640 : 800, 0.07, 'triangle', 0.16); },
    bloom: function () { tone(330, 880, 0.35, 'sine', 0.25); tone(495, 1320, 0.35, 'sine', 0.15, 0.04); },
    charge: function () { tone(660, 660, 0.09, 'triangle', 0.2); tone(990, 990, 0.14, 'triangle', 0.2, 0.08); },
    flip: function () { noise(0.32, 2400, 180, 0.5, 0, 0.9); tone(180, 70, 0.3, 'sawtooth', 0.22); tone(540, 1080, 0.18, 'sine', 0.12, 0.05); },
    flipdeny: function () { tone(140, 110, 0.14, 'square', 0.16); },
    pinch: function (o) { var n = (o && o.n) || 1; noise(0.22, 900, 90, 0.8, 0, 0.7); tone(110, 45, 0.28, 'sawtooth', 0.35); tone(520 * n, 1040 * n, 0.2, 'square', 0.12, 0.05); },
    eatghost: function () { tone(300, 1200, 0.2, 'square', 0.2); tone(600, 1800, 0.12, 'triangle', 0.14, 0.08); },
    fruit: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, f, 0.12, 'triangle', 0.2, i * 0.06); }); },
    die: function () { for (var i = 0; i < 9; i++) tone(700 - i * 62, 640 - i * 62, 0.15, 'square', 0.17, i * 0.1); noise(0.5, 400, 60, 0.4, 0.9); },
    ready: function () { [392, 523, 659].forEach(function (f, i) { tone(f, f, 0.16, 'triangle', 0.2, i * 0.18); }); },
    go: function () { tone(784, 784, 0.2, 'triangle', 0.25); },
    clear: function () { [523, 659, 784, 1046, 1318, 1568].forEach(function (f, i) { tone(f, f, 0.2, 'triangle', 0.22, i * 0.1); }); },
    life: function () { [880, 1175, 1568].forEach(function (f, i) { tone(f, f, 0.15, 'square', 0.14, i * 0.08); }); },
    over: function () { [440, 392, 330, 262].forEach(function (f, i) { tone(f, f * 0.98, 0.3, 'triangle', 0.22, i * 0.22); }); },
    ui: function () { tone(660, 880, 0.08, 'triangle', 0.15); }
  };

  /* music: minor bass line + sparse arp, 8th-note scheduler driven by update() */
  var BASS = [55, 55, 82.4, 55, 65.4, 65.4, 98, 65.4], ARP = [440, 523, 659, 523, 392, 494, 587, 494];
  function schedule() {
    if (!ctx || !musicOn || muted) return;
    var step = 0.2 / tempo;
    if (nextBeat < ctx.currentTime - 0.5) nextBeat = ctx.currentTime;
    while (nextBeat < ctx.currentTime + 0.25) {
      var i = beat % 8, t = nextBeat - ctx.currentTime;
      tone(BASS[i], BASS[i], step * 0.9, 'triangle', 0.5, t, musGain);
      if (i % 2 === 0) tone(ARP[(beat >> 1) % 8] * (beat % 32 < 16 ? 1 : 1.5), 0, step * 0.8, 'sine', 0.12, t, musGain);
      nextBeat += step; beat++;
    }
  }

  SM.Audio = {
    init: init,
    play: function (name, o) { if (ctx && !muted && SFX[name]) { try { SFX[name](o); } catch (e) { /* ignore */ } } },
    startMusic: function () { init(); musicOn = true; },
    stopMusic: function () { musicOn = false; },
    setTempo: function (t) { tempo = t; },
    update: schedule,
    toggleMute: function () { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; SM.store.set('muted', muted); return muted; },
    setMuted: function (m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.8; },
    isMuted: function () { return muted; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
