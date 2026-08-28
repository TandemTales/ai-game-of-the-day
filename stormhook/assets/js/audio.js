/* =====================================================================
   STORMHOOK — audio.js   [OWNER: agent-audio]

   Procedural Web Audio. No files, no fetches — every sound is
   synthesised. The context is not created until a user gesture, and
   every entry point is a silent no-op where Web Audio is unavailable.

   FIRST PASS (lead-authored scaffold, 2026-08-27).
   ===================================================================== */
(function (global) {
  'use strict';

  var SH = global.SH || (global.SH = {});
  var A = SH.Audio = {};

  var ac = null, master = null, musicGain = null, sfxGain = null;
  var muted = false;
  var ready = false;
  var duckUntil = 0;

  A.init = function () {
    muted = !!SH.store.get('muted', false);
    /* Create on the first gesture — browsers require it, and creating
       eagerly logs a console warning we would then have to explain. */
    var kick = function () { A.resume(); };
    if (global.document) {
      global.document.addEventListener('pointerdown', kick, { once: true });
      global.document.addEventListener('keydown', kick, { once: true });
      global.document.addEventListener('touchstart', kick, { once: true });
    }
  };

  A.resume = function () {
    if (ready) { if (ac && ac.state === 'suspended') ac.resume(); return; }
    var Ctx = global.AudioContext || global.webkitAudioContext;
    if (!Ctx) return;
    try {
      ac = new Ctx();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.8;
      master.connect(ac.destination);
      musicGain = ac.createGain(); musicGain.gain.value = 0.35; musicGain.connect(master);
      sfxGain = ac.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
      ready = true;
    } catch (e) { ready = false; }
  };

  A.setMuted = function (b) {
    muted = !!b;
    SH.store.set('muted', muted);
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.02);
    SH.emit('muted', muted);
  };
  A.toggleMuted = function () { A.setMuted(!muted); };
  A.isMuted = function () { return muted; };
  A.duckFor = function (sec) { if (ac) duckUntil = ac.currentTime + sec; };

  function now() { return ac ? ac.currentTime : 0; }

  function env(node, t0, a, d, peak) {
    var g = node.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + a);
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  function tone(freq, type, a, d, peak, slideTo, dest) {
    if (!ready) return;
    var t0 = now();
    var o = ac.createOscillator();
    var g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + a + d);
    env(g, t0, a, d, peak);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t0); o.stop(t0 + a + d + 0.05);
  }

  function noise(dur, peak, filterHz, type) {
    if (!ready) return;
    var t0 = now();
    var n = Math.max(1, Math.floor(ac.sampleRate * dur));
    var buf = ac.createBuffer(1, n, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ac.createBufferSource(); src.buffer = buf;
    var f = ac.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = filterHz || 1200;
    var g = ac.createGain();
    env(g, t0, 0.005, dur, peak);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t0);
  }

  A.sfx = function (name, opts) {
    if (!ready || muted) return;
    opts = opts || {};
    switch (name) {
      case 'latch':
        tone(760, 'square', 0.005, 0.09, 0.16, 1180);
        noise(0.07, 0.10, 2600, 'highpass');
        break;
      case 'miss':
        tone(220, 'sawtooth', 0.005, 0.10, 0.06, 130);
        break;
      case 'release':
        tone(430, 'triangle', 0.004, 0.09, 0.07, 300);
        break;
      case 'dash':
        noise(0.16, 0.16, 900, 'bandpass');
        tone(180, 'sawtooth', 0.005, 0.16, 0.10, 520);
        break;
      case 'core':
        /* Rises with the combo — the sound is the score feedback. */
        var step = Math.min(opts.combo || 1, 12);
        var f = 520 * Math.pow(2, (step - 1) / 12);
        tone(f, 'triangle', 0.004, 0.16, 0.16, f * 1.5);
        tone(f * 2, 'sine', 0.004, 0.11, 0.07, f * 3);
        break;
      case 'comboBreak':
        tone(300, 'sine', 0.01, 0.22, 0.08, 150);
        break;
      case 'clear':
        [0, 4, 7, 12].forEach(function (semi, i) {
          global.setTimeout(function () {
            tone(440 * Math.pow(2, semi / 12), 'triangle', 0.01, 0.35, 0.14);
          }, i * 90);
        });
        break;
      case 'death':
        noise(0.5, 0.24, 700, 'lowpass');
        tone(150, 'sawtooth', 0.01, 0.45, 0.14, 48);
        break;
    }
  };

  /* A very small ambient bed: a low drone plus a slow wind sweep. Real
     music is agent-audio's job; this only keeps the game from being
     silent. */
  var bed = null;
  A.music = function (track) {
    if (!ready || muted) { A._pending = track; return; }
    A.stopMusic();
    if (track !== 'run') return;
    var t0 = now();
    var o1 = ac.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
    var o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = 82.5;
    var g = ac.createGain(); g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 2);
    var lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
    var lg = ac.createGain(); lg.gain.value = 0.22;
    lfo.connect(lg); lg.connect(g.gain);
    o1.connect(g); o2.connect(g); g.connect(musicGain);
    o1.start(t0); o2.start(t0); lfo.start(t0);
    bed = { o1: o1, o2: o2, lfo: lfo, g: g };
  };

  A.stopMusic = function () {
    if (!bed || !ac) return;
    var t0 = now();
    try {
      bed.g.gain.cancelScheduledValues(t0);
      bed.g.gain.setTargetAtTime(0.0001, t0, 0.15);
      bed.o1.stop(t0 + 0.6); bed.o2.stop(t0 + 0.6); bed.lfo.stop(t0 + 0.6);
    } catch (e) {}
    bed = null;
  };

  /* If music was asked for before the audio context existed, start it
     as soon as it does. */
  SH.on('phase', function () {
    if (ready && A._pending) { var t = A._pending; A._pending = null; A.music(t); }
  });

})(typeof window !== 'undefined' ? window : this);
