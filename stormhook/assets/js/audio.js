/* =====================================================================
   STORMHOOK — audio.js   [OWNER: agent-audio]

   Procedural Web Audio. No files, no fetches, nothing vendored — every
   sound in this game, music included, is synthesised from oscillators,
   generated noise buffers and a generated convolution impulse.

   The context is never constructed before a user gesture and every
   entry point is a silent no-op where Web Audio is unavailable or
   blocked, so this file is safe to load under a bare shim.

   ---------------------------------------------------------------------
   SIGNAL FLOW

     music voices ─▶ musicBus ─▶ musicDuck ┐
     sfx voices   ─▶ sfxBus ───────────────┤
     ambience     ─▶ ambBus ───────────────┼─▶ preMaster ─▶ glue comp
     (sends)      ─▶ convolver ─▶ verbRtn ─┘                   │
                                                               ▼
                                       destination ◀─ master ◀─ limiter

   The glue compressor rides everything gently; the limiter after it is
   a brick wall so a dash + three cores + a thunder crack cannot clip.

   ---------------------------------------------------------------------
   THE SCORE — "Drowned Foundry"

   D aeolian, 8-bar progression, 16th-note scheduler with lookahead. Six
   layers (drone / pad / bass / foundry percussion / lead bells / high
   shimmer) gated by a 32-bar arrangement so the bed genuinely develops
   over ~95 seconds instead of looping a one-bar cell.

   It is REACTIVE, which is the whole point:

     intensity  0..1  from how close the storm front is. Raises tempo,
                      opens filters, forces percussion and bass in,
                      swells the storm noise bed, adds thunder.
     lift       0..1  from the airtime combo multiplier. Brings in the
                      lead bells, then the 16th shimmer, octave-doubles
                      the melody and brightens the pad. Play well and
                      the music literally gets bigger.

   A level clear plays a picardy-third cadence over the bed; the run
   bed resumes on the next level.
   ===================================================================== */
(function (global) {
  'use strict';

  var SH = global.SH || (global.SH = {});
  var A = SH.Audio = {};

  /* ------------------------------------------------------------------
     Module state
     ------------------------------------------------------------------ */
  var ac = null;
  var ready = false;
  var muted = false;
  var selfDrive = true;             // cleared if the lead calls A.update()
  var rafId = 0;

  var preMaster = null, glue = null, limiter = null, master = null;
  var musicBus = null, musicDuck = null, sfxBus = null, ambBus = null;
  var verbIn = null, verbOut = null;
  var noiseBuf = null, pinkBuf = null;

  var MASTER_LEVEL = 0.86;
  var duckUntil = 0;

  /* Reactive parameters, smoothed in tick(). */
  var intensity = 0, intensityT = 0;
  var lift = 0, liftT = 0;

  /* ------------------------------------------------------------------
     A local PRNG. Deliberately NOT SH.rand(): that generator is seeded
     and shared with gameplay, and pulling from it here would desync the
     simulation. Audio must never be able to change the game.
     ------------------------------------------------------------------ */
  var rngState = 0x9e3779b9;
  function rnd() {
    rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
    var t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rndR(a, b) { return a + (b - a) * rnd(); }
  /* A second, independent stream for musical decisions so that changing
     the noise seeding does not change the melody. */
  function hash32(n) {
    n |= 0; n = Math.imul(n ^ (n >>> 16), 2246822507);
    n = Math.imul(n ^ (n >>> 13), 3266489909);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /* ------------------------------------------------------------------
     Lifecycle
     ------------------------------------------------------------------ */
  A.init = function () {
    try { muted = !!(SH.store && SH.store.get('muted', false)); } catch (e) { muted = false; }
    /* Create on the first gesture — browsers require it, and creating
       eagerly logs a console warning we would then have to explain. */
    var kick = function () { A.resume(); };
    if (global.document && global.document.addEventListener) {
      try {
        global.document.addEventListener('pointerdown', kick, { once: true });
        global.document.addEventListener('keydown', kick, { once: true });
        global.document.addEventListener('touchstart', kick, { once: true });
      } catch (e2) { /* no DOM: nothing to hook */ }
    }
  };

  A.resume = function () {
    if (ready) {
      try { if (ac && ac.state === 'suspended') ac.resume(); } catch (e) {}
      return;
    }
    var Ctx = global.AudioContext || global.webkitAudioContext;
    if (!Ctx) return;
    try {
      ac = new Ctx();
      buildGraph();
      ready = true;
    } catch (e) { ac = null; ready = false; return; }
    startDrive();
    if (A._pending) { var t = A._pending; A._pending = null; A.music(t); }
  };

  A.setMuted = function (b) {
    muted = !!b;
    try { if (SH.store) SH.store.set('muted', muted); } catch (e) {}
    if (master && ac) {
      try { master.gain.setTargetAtTime(muted ? 0.0 : MASTER_LEVEL, ac.currentTime, 0.02); }
      catch (e2) {}
    }
    try { SH.emit('muted', muted); } catch (e3) {}
  };
  A.toggleMuted = function () { A.setMuted(!muted); };
  A.isMuted = function () { return muted; };

  A.duckFor = function (sec) {
    if (!ready || !musicDuck) return;
    var t = ac.currentTime;
    var until = t + Math.max(0.05, sec || 0.3);
    if (until <= duckUntil) return;                 // a longer duck already owns the bed
    duckUntil = until;
    try {
      var g = musicDuck.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0.32, t + 0.035);
      g.setValueAtTime(0.32, until);
      g.linearRampToValueAtTime(1.0, until + 0.32);
    } catch (e) {}
  };

  function now() { return ac ? ac.currentTime + 0.002 : 0; }

  /* ------------------------------------------------------------------
     Graph
     ------------------------------------------------------------------ */
  function buildGraph() {
    master = ac.createGain();
    master.gain.value = muted ? 0 : MASTER_LEVEL;
    master.connect(ac.destination);

    /* Brick wall. Fast attack, short release, huge ratio: this is the
       thing that stops six simultaneous transients from clipping. */
    limiter = ac.createDynamicsCompressor();
    setP(limiter.threshold, -2.0);
    setP(limiter.knee, 0.0);
    setP(limiter.ratio, 20.0);
    setP(limiter.attack, 0.0008);
    setP(limiter.release, 0.06);
    limiter.connect(master);

    /* Glue. Slow, gentle, musical — it makes the mix breathe with the
       percussion rather than catching peaks. */
    glue = ac.createDynamicsCompressor();
    setP(glue.threshold, -19.0);
    setP(glue.knee, 12.0);
    setP(glue.ratio, 3.0);
    setP(glue.attack, 0.006);
    setP(glue.release, 0.17);
    glue.connect(limiter);

    preMaster = ac.createGain(); preMaster.gain.value = 1.0;
    preMaster.connect(glue);

    musicBus = ac.createGain(); musicBus.gain.value = 0.50;
    musicDuck = ac.createGain(); musicDuck.gain.value = 1.0;
    musicBus.connect(musicDuck); musicDuck.connect(preMaster);

    sfxBus = ac.createGain(); sfxBus.gain.value = 0.80;
    sfxBus.connect(preMaster);

    ambBus = ac.createGain(); ambBus.gain.value = 0.55;
    ambBus.connect(preMaster);

    /* Convolution reverb from a generated impulse: a big wet iron room.
       Everything that wants space sends to it; nothing runs through it. */
    verbIn = ac.createGain(); verbIn.gain.value = 1.0;
    var conv = null;
    try {
      conv = ac.createConvolver();
      conv.normalize = false;
      conv.buffer = makeIR(2.35, 0.38);
    } catch (e) { conv = null; }
    var verbTone = ac.createBiquadFilter();
    verbTone.type = 'highpass'; verbTone.frequency.value = 180;
    verbOut = ac.createGain(); verbOut.gain.value = 0.34;
    if (conv) { verbIn.connect(conv); conv.connect(verbTone); }
    else { verbIn.connect(verbTone); }
    verbTone.connect(verbOut); verbOut.connect(preMaster);

    noiseBuf = makeNoise(2.0);
    pinkBuf = makePink(6.0);
  }

  function setP(param, v) { try { param.value = v; } catch (e) {} }

  /* White noise, mono, one shared buffer. Every noise voice reads it
     from a random offset — cheaper than allocating per shot and it
     never repeats audibly. */
  function makeNoise(sec) {
    var n = Math.max(1, Math.floor(ac.sampleRate * sec));
    var b = ac.createBuffer(1, n, ac.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
    return b;
  }

  /* Pink noise (Paul Kellett's economy filter), stereo, seam-crossfaded
     so it loops without the click a raw buffer loop gives you. */
  function makePink(sec) {
    var sr = ac.sampleRate;
    var xf = Math.floor(sr * 0.25);
    var n = Math.max(2, Math.floor(sr * sec));
    var b = ac.createBuffer(2, n, sr);
    for (var ch = 0; ch < 2; ch++) {
      var tmp = new Float32Array(n + xf);
      var b0 = 0, b1 = 0, b2 = 0;
      for (var i = 0; i < n + xf; i++) {
        var w = rnd() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.0990460;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        tmp[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
      }
      var d = b.getChannelData(ch);
      for (var j = 0; j < n; j++) d[j] = tmp[j];
      for (var k = 0; k < xf; k++) {
        var f = k / xf;
        d[k] = tmp[k] * f + tmp[n + k] * (1 - f);
      }
    }
    return b;
  }

  /* A generated impulse response: a handful of discrete early
     reflections in front of an exponentially decaying, progressively
     darkening noise tail. Reads as a large flooded iron hall. */
  function makeIR(sec, decay) {
    var sr = ac.sampleRate;
    var n = Math.max(1, Math.floor(sr * sec));
    var b = ac.createBuffer(2, n, sr);
    var early = [0.011, 0.019, 0.031, 0.047, 0.058, 0.083, 0.107, 0.139];
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch);
      var lp = 0, hp = 0;
      for (var i = 0; i < n; i++) {
        var t = i / n;
        /* Cutoff falls with time: the tail loses its top as it decays. */
        var k = 0.42 * (1 - t) * (1 - t) + 0.02;
        lp += k * ((rnd() * 2 - 1) - lp);
        hp = 0.996 * (hp + lp);
        var env = Math.pow(1 - t, 1 / Math.max(0.05, decay)) * Math.exp(-3.1 * t);
        d[i] = hp * env * 0.55;
      }
      for (var e = 0; e < early.length; e++) {
        var idx = Math.floor((early[e] + (ch ? 0.004 : 0)) * sr);
        if (idx < n) d[idx] += (rnd() < 0.5 ? -1 : 1) * (0.62 - e * 0.06);
      }
      /* 2 ms fade-in kills the pre-echo tick on the direct impulse. */
      var fi = Math.floor(sr * 0.002);
      for (var f = 0; f < fi && f < n; f++) d[f] *= f / fi;
    }
    return b;
  }

  /* ------------------------------------------------------------------
     Voice primitives
     ------------------------------------------------------------------ */
  function gain(v) { var g = ac.createGain(); g.gain.value = v; return g; }

  function panner(p) {
    if (!p || !ac.createStereoPanner) return null;
    var n = ac.createStereoPanner();
    n.pan.value = Math.max(-1, Math.min(1, p));
    return n;
  }

  /* node -> [pan] -> dest, plus an optional parallel reverb send. */
  function route(node, dest, pan, sendAmt) {
    var out = node;
    var pn = panner(pan);
    if (pn) { node.connect(pn); out = pn; }
    out.connect(dest || sfxBus);
    if (sendAmt > 0 && verbIn) {
      var s = gain(sendAmt);
      out.connect(s); s.connect(verbIn);
    }
    return out;
  }

  /* Percussive envelope: near-instant attack, exponential fall. */
  function perc(param, t, atk, dec, peak) {
    peak = Math.max(0.00012, peak);
    param.setValueAtTime(0.00012, t);
    param.exponentialRampToValueAtTime(peak, t + Math.max(0.0006, atk));
    param.exponentialRampToValueAtTime(0.00012, t + atk + Math.max(0.01, dec));
    param.setValueAtTime(0, t + atk + dec + 0.005);
  }

  /* Sustained envelope with a real release. */
  function adsr(param, t, atk, dec, sus, hold, rel, peak) {
    peak = Math.max(0.00012, peak);
    param.setValueAtTime(0.00012, t);
    param.exponentialRampToValueAtTime(peak, t + atk);
    param.exponentialRampToValueAtTime(Math.max(0.00012, peak * sus), t + atk + dec);
    param.setValueAtTime(Math.max(0.00012, peak * sus), t + atk + dec + hold);
    param.exponentialRampToValueAtTime(0.00012, t + atk + dec + hold + rel);
    param.setValueAtTime(0, t + atk + dec + hold + rel + 0.005);
  }

  function osc(type, f, t) {
    var o = ac.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(Math.max(0.01, f), t);
    return o;
  }

  /* A white-noise burst read from a random offset of the shared buffer. */
  function noiseSrc(t, rate) {
    var s = ac.createBufferSource();
    s.buffer = noiseBuf;
    s.playbackRate.value = rate || 1;
    return s;
  }
  function startNoise(s, t, dur) {
    var off = rnd() * Math.max(0.01, noiseBuf.duration - dur - 0.02);
    try { s.start(t, off, dur + 0.02); } catch (e) { try { s.start(t); } catch (e2) {} }
  }

  function bq(type, f, q) {
    var b = ac.createBiquadFilter();
    b.type = type;
    b.frequency.setValueAtTime(Math.max(10, f), ac.currentTime);
    if (q != null) b.Q.value = q;
    return b;
  }

  /* Filtered noise body — the workhorse behind whooshes, impacts and
     air. `f0 -> f1` sweeps the filter across the life of the sound. */
  function noiseBody(t, dur, peak, type, f0, f1, q, dest, pan, sendAmt) {
    var s = noiseSrc(t, 1);
    var f = bq(type || 'bandpass', f0, q == null ? 1 : q);
    f.frequency.setValueAtTime(Math.max(20, f0), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1 || f0), t + dur);
    var g = gain(0);
    perc(g.gain, t, Math.min(0.02, dur * 0.15), dur, peak);
    s.connect(f); f.connect(g);
    route(g, dest, pan, sendAmt);
    startNoise(s, t, dur + 0.08);
    try { s.stop(t + dur + 0.1); } catch (e) {}
    return g;
  }

  /* An inharmonic struck-metal partial stack. This is the sonic
     signature of the whole game: derelict iron hulls being hit. */
  var METAL_RATIOS = [1.0, 1.71, 2.76, 3.94, 5.42, 6.81];
  function metal(t, f, dur, peak, dest, pan, sendAmt, spread) {
    spread = spread == null ? 1 : spread;
    var sum = gain(1);
    for (var i = 0; i < METAL_RATIOS.length; i++) {
      var r = 1 + (METAL_RATIOS[i] - 1) * spread;
      var o = osc(i < 2 ? 'triangle' : 'sine', f * r * (1 + (rnd() - 0.5) * 0.008), t);
      var g = gain(0);
      var amp = peak * Math.pow(0.62, i);
      var dd = dur * Math.pow(0.72, i);
      perc(g.gain, t, 0.0012, dd, amp);
      /* Slight downward drift: struck metal detunes as it rings out. */
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f * r * 0.985), t + dd);
      o.connect(g); g.connect(sum);
      o.start(t); try { o.stop(t + dd + 0.05); } catch (e) {}
    }
    route(sum, dest, pan, sendAmt);
    return sum;
  }

  /* Two-operator FM bell. Inharmonic ratio, fast modulator decay. */
  function bell(t, f, dur, peak, ratio, index, dest, pan, sendAmt) {
    var car = osc('sine', f, t);
    var mod = osc('sine', f * (ratio || 3.51), t);
    var mg = gain(0);
    perc(mg.gain, t, 0.001, dur * 0.35, f * (index || 4));
    mod.connect(mg); mg.connect(car.frequency);
    var g = gain(0);
    perc(g.gain, t, 0.003, dur, peak);
    car.connect(g);
    route(g, dest, pan, sendAmt);
    car.start(t); mod.start(t);
    try { car.stop(t + dur + 0.08); mod.stop(t + dur + 0.08); } catch (e) {}
    return g;
  }

  /* ------------------------------------------------------------------
     SFX
     ------------------------------------------------------------------ */

  /* The tether launcher. Plays under BOTH latch and miss, because
     firing is the same physical act either way — only the far end
     differs. Pneumatic thump + the line paying out. */
  function fireLayer(t, pan) {
    var thump = osc('sine', 190, t);
    thump.frequency.exponentialRampToValueAtTime(74, t + 0.07);
    var tg = gain(0);
    perc(tg.gain, t, 0.002, 0.09, 0.34);
    thump.connect(tg); route(tg, sfxBus, pan * 0.4, 0.05);
    thump.start(t); try { thump.stop(t + 0.16); } catch (e) {}

    /* Gas escape. */
    noiseBody(t, 0.13, 0.20, 'highpass', 2600, 5200, 0.7, sfxBus, pan * 0.5, 0.06);
    /* Line whistling out — a rising resonant band. */
    noiseBody(t + 0.012, 0.17, 0.13, 'bandpass', 900, 2400, 7, sfxBus, pan * 0.7, 0.10);
  }

  var SFX = {

    /* Firing with no target: the launcher, then the line slapping air
       and going slack. Deliberately hollow — it must feel like a
       failure without being harsh, because you will hear it a lot. */
    miss: function (t, o) {
      var pan = o.pan || 0;
      fireLayer(t, pan);
      noiseBody(t + 0.06, 0.24, 0.11, 'bandpass', 1500, 320, 3.5, sfxBus, pan, 0.10);
      var dud = osc('triangle', 168, t + 0.05);
      dud.frequency.exponentialRampToValueAtTime(96, t + 0.28);
      var g = gain(0);
      perc(g.gain, t + 0.05, 0.006, 0.23, 0.10);
      dud.connect(g); route(g, sfxBus, pan * 0.3, 0.08);
      dud.start(t + 0.05); try { dud.stop(t + 0.34); } catch (e) {}
    },

    /* The magnet finds iron. Launcher + a hard metal-on-metal strike +
       the magnetic grab: a resonant filter snapping shut on a saw.
       This is the most important sound in the game; it fires on every
       successful input and has to feel like a solid mechanical event. */
    latch: function (t, o) {
      var pan = o.pan || 0;
      fireLayer(t, pan);
      var ts = t + 0.02;
      /* Transient: the click of contact. */
      noiseBody(ts, 0.03, 0.42, 'highpass', 4200, 7000, 0.7, sfxBus, pan, 0.05);
      /* Body: struck hull plate. */
      metal(ts, 470, 0.30, 0.26, sfxBus, pan * 0.5, 0.20, 1);
      /* The magnetic clamp — a downward resonant sweep. */
      var mo = osc('sawtooth', 320, ts);
      mo.frequency.exponentialRampToValueAtTime(120, ts + 0.10);
      var mf = bq('lowpass', 3400, 9);
      mf.frequency.setValueAtTime(3400, ts);
      mf.frequency.exponentialRampToValueAtTime(420, ts + 0.13);
      var mg = gain(0);
      perc(mg.gain, ts, 0.002, 0.14, 0.20);
      mo.connect(mf); mf.connect(mg); route(mg, sfxBus, pan * 0.3, 0.10);
      mo.start(ts); try { mo.stop(ts + 0.22); } catch (e) {}
      /* Sub thud so it lands in the body, not just the ears. */
      var sub = osc('sine', 120, ts);
      sub.frequency.exponentialRampToValueAtTime(52, ts + 0.11);
      var sg = gain(0);
      perc(sg.gain, ts, 0.002, 0.13, 0.30);
      sub.connect(sg); sg.connect(sfxBus);
      sub.start(ts); try { sub.stop(ts + 0.22); } catch (e) {}
    },

    /* Letting go at the top of the arc. Rising then falling air with a
       doppler bend — the sound of being flung, not of a button. */
    release: function (t, o) {
      var pan = o.pan || 0;
      var sp = clamp01((o.speed || 500) / 1100);
      var g = gain(0);
      var s = noiseSrc(t, 1);
      var f = bq('bandpass', 700, 2.2);
      f.frequency.setValueAtTime(620, t);
      f.frequency.exponentialRampToValueAtTime(2300 + 1400 * sp, t + 0.10);
      f.frequency.exponentialRampToValueAtTime(480, t + 0.34);
      perc(g.gain, t, 0.018, 0.32, 0.15 + 0.10 * sp);
      s.connect(f); f.connect(g);
      route(g, sfxBus, pan * 0.8, 0.14);
      startNoise(s, t, 0.4);
      try { s.stop(t + 0.42); } catch (e) {}
      /* The clamp releasing. */
      metal(t, 880, 0.09, 0.07, sfxBus, -pan * 0.5, 0.12, 0.7);
      /* A soft upward tone: the game telling you momentum was kept. */
      var lift2 = osc('triangle', 300, t);
      lift2.frequency.exponentialRampToValueAtTime(520 + 260 * sp, t + 0.16);
      var lg = gain(0);
      perc(lg.gain, t, 0.01, 0.17, 0.055);
      lift2.connect(lg); route(lg, sfxBus, pan * 0.4, 0.18);
      lift2.start(t); try { lift2.stop(t + 0.3); } catch (e) {}
    },

    /* Air dash: a compressed shove. Short, punchy, no tail — the tail
       would smear into the swing that follows it. */
    dash: function (t, o) {
      var pan = o.pan || 0;
      noiseBody(t, 0.20, 0.30, 'bandpass', 2600, 380, 1.6, sfxBus, pan, 0.10);
      var sub = osc('sine', 150, t);
      sub.frequency.exponentialRampToValueAtTime(46, t + 0.17);
      var sg = gain(0);
      perc(sg.gain, t, 0.003, 0.18, 0.34);
      sub.connect(sg); sg.connect(sfxBus);
      sub.start(t); try { sub.stop(t + 0.28); } catch (e) {}
      var saw = osc('sawtooth', 210, t);
      saw.frequency.exponentialRampToValueAtTime(620, t + 0.13);
      var sf = bq('bandpass', 900, 4);
      var g2 = gain(0);
      perc(g2.gain, t, 0.004, 0.14, 0.10);
      saw.connect(sf); sf.connect(g2); route(g2, sfxBus, pan * 0.6, 0.08);
      saw.start(t); try { saw.stop(t + 0.24); } catch (e) {}
    },

    /* Salvage core. Pitch steps with the combo (SPEC §8) up a minor
       pentatonic so a long chain reads as a rising phrase rather than a
       chromatic siren. Sends hard to the reverb — the cores are the
       shiny thing in a dark mix. */
    core: function (t, o) {
      var step = Math.max(1, Math.min(o.combo || 1, 12));
      var PENT = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27];
      var m = 74 + PENT[step - 1];
      var f = mtof(m);
      /* Contact tick. */
      noiseBody(t, 0.022, 0.20, 'highpass', 5200, 8600, 0.7, sfxBus, 0, 0.06);
      bell(t, f, 0.62, 0.20, 2.01, 3.2, sfxBus, -0.12, 0.30);
      bell(t + 0.014, f * 2, 0.42, 0.09, 3.51, 2.0, sfxBus, 0.18, 0.34);
      /* A fifth beneath, so high combos gain weight rather than just
         getting shriller. */
      if (step > 3) bell(t + 0.006, f * 0.5, 0.5, 0.07 + 0.005 * step, 1.41, 1.6, sfxBus, 0.05, 0.24);
      var sub = osc('sine', mtof(m - 24), t);
      var sg = gain(0);
      perc(sg.gain, t, 0.004, 0.20, 0.13);
      sub.connect(sg); sg.connect(sfxBus);
      sub.start(t); try { sub.stop(t + 0.3); } catch (e) {}
      A.duckFor(0.10);
    },

    /* The combo multiplier stepping up mid-air. A two-note grace figure
       that climbs with the step — deliberately smaller than a core so a
       core landing on a step-up still reads as the bigger event. */
    comboUp: function (t, o) {
      var step = Math.max(2, Math.min(o.combo || 2, 12));
      var m = 79 + ((step - 2) % 5) * 2 + Math.floor((step - 2) / 5) * 12;
      bell(t, mtof(m), 0.14, 0.075, 5.0, 1.4, sfxBus, -0.25, 0.22);
      bell(t + 0.055, mtof(m + 7), 0.26, 0.095, 5.0, 1.6, sfxBus, 0.25, 0.30);
    },

    /* Landing and losing the chain. Dull, closed, no sparkle. */
    comboBreak: function (t) {
      noiseBody(t, 0.24, 0.13, 'lowpass', 1500, 240, 1.0, sfxBus, 0, 0.06);
      var o1 = osc('triangle', 250, t);
      o1.frequency.exponentialRampToValueAtTime(112, t + 0.26);
      var g = gain(0);
      perc(g.gain, t, 0.008, 0.26, 0.11);
      o1.connect(g); route(g, sfxBus, 0, 0.05);
      o1.start(t); try { o1.stop(t + 0.36); } catch (e) {}
    },

    /* The rope catching a corner. Tiny, dry, woody-metal — this fires
       often and must never become fatiguing. */
    wrap: function (t, o) {
      var pan = o.pan || 0;
      noiseBody(t, 0.030, 0.16, 'bandpass', 2300, 1500, 6, sfxBus, pan, 0.10);
      metal(t, 1150, 0.075, 0.075, sfxBus, pan, 0.14, 0.55);
    },
    unwrap: function (t, o) {
      var pan = o.pan || 0;
      noiseBody(t, 0.026, 0.09, 'bandpass', 1700, 1100, 5, sfxBus, pan, 0.08);
    },

    /* Winch ratchet. One tooth. The tick() emitter spaces these by rope
       distance travelled, so reeling sounds like a mechanism turning at
       the speed you are actually pulling. */
    reel: function (t, o) {
      var up = (o.dir || 1) > 0;
      noiseBody(t, 0.018, 0.085, 'bandpass', up ? 2100 : 1600, up ? 2600 : 1250, 9,
                sfxBus, (o.pan || 0) * 0.5, 0.05);
      var k = osc('square', up ? 780 : 620, t);
      var g = gain(0);
      perc(g.gain, t, 0.001, 0.022, 0.045);
      k.connect(g); g.connect(sfxBus);
      k.start(t); try { k.stop(t + 0.05); } catch (e) {}
    },

    /* Extraction. A rising picardy arpeggio into a struck beacon bell,
       ducked so it sits on top of the score's cadence. */
    clear: function (t) {
      A.duckFor(1.5);
      var seq = [0, 4, 7, 11, 12, 16, 19];
      for (var i = 0; i < seq.length; i++) {
        var tt = t + i * 0.082;
        bell(tt, mtof(62 + seq[i]), 0.9 - i * 0.05, 0.15 - i * 0.012,
             2.0, 2.4, sfxBus, (i % 2 ? 0.3 : -0.3), 0.34);
      }
      var tb = t + seq.length * 0.082;
      metal(tb, 294, 1.5, 0.22, sfxBus, 0, 0.42, 1);
      var sub = osc('sine', 73.4, tb);
      var sg = gain(0);
      adsr(sg.gain, tb, 0.02, 0.3, 0.5, 0.5, 0.9, 0.22);
      sub.connect(sg); sg.connect(sfxBus);
      sub.start(tb); try { sub.stop(tb + 2.4); } catch (e) {}
      noiseBody(tb, 1.1, 0.09, 'highpass', 5200, 1400, 0.6, sfxBus, 0, 0.4);
    },

    /* Death. Impact, then the hull tearing, then the drop into water.
       Ducks the bed hard so the failure lands in silence. */
    death: function (t, o) {
      A.duckFor(1.1);
      var cause = o.cause || '';
      /* Impact. */
      noiseBody(t, 0.06, 0.46, 'highpass', 2600, 900, 0.7, sfxBus, 0, 0.16);
      metal(t, 190, 0.9, 0.24, sfxBus, -0.1, 0.34, 1);
      var sub = osc('sine', 132, t);
      sub.frequency.exponentialRampToValueAtTime(34, t + 0.55);
      var sg = gain(0);
      perc(sg.gain, t, 0.003, 0.62, 0.42);
      sub.connect(sg); sg.connect(sfxBus);
      sub.start(t); try { sub.stop(t + 0.8); } catch (e) {}
      /* Tail: cause-coloured. The storm swallows you; slag hisses;
         falling is a long dark drop. */
      if (cause === 'storm') {
        noiseBody(t + 0.02, 1.5, 0.26, 'lowpass', 2200, 220, 0.9, sfxBus, 0, 0.30);
        noiseBody(t + 0.10, 1.2, 0.10, 'bandpass', 480, 140, 1.4, sfxBus, 0.2, 0.26);
      } else if (cause === 'hazard') {
        noiseBody(t + 0.02, 0.9, 0.20, 'bandpass', 3400, 1200, 1.2, sfxBus, 0, 0.24);
        noiseBody(t + 0.05, 1.1, 0.12, 'lowpass', 900, 200, 0.9, sfxBus, 0, 0.22);
      } else {
        noiseBody(t + 0.02, 1.3, 0.18, 'lowpass', 1400, 150, 0.9, sfxBus, 0, 0.28);
      }
      /* A dying fall in the harmony. */
      var d1 = osc('sawtooth', 146.8, t + 0.03);
      d1.frequency.exponentialRampToValueAtTime(46, t + 1.0);
      var df = bq('lowpass', 1600, 4);
      df.frequency.exponentialRampToValueAtTime(180, t + 1.0);
      var dg = gain(0);
      perc(dg.gain, t + 0.03, 0.02, 1.0, 0.16);
      d1.connect(df); df.connect(dg); route(dg, sfxBus, 0, 0.22);
      d1.start(t + 0.03); try { d1.stop(t + 1.3); } catch (e) {}
    },

    /* Lightning over the front. Crack, then the roll. Emitted by tick()
       at a rate that rises as the storm closes, so the weather is
       audibly getting closer even when nothing else happens. */
    thunder: function (t, o) {
      var near = clamp01(o.near == null ? 0.5 : o.near);
      var pan = (o.pan == null ? -0.5 : o.pan);
      A.duckFor(0.35 + 0.5 * near);
      /* Crack. */
      noiseBody(t, 0.05 + 0.05 * near, 0.10 + 0.34 * near, 'highpass',
                3800, 1200, 0.7, ambBus, pan, 0.34);
      /* Roll: a long low body that slowly closes down. */
      var s = noiseSrc(t, 0.55);
      var f = bq('lowpass', 900, 1.1);
      f.frequency.setValueAtTime(700 + 700 * near, t);
      f.frequency.exponentialRampToValueAtTime(90, t + 1.8 + near);
      var g = gain(0);
      var dur = 1.7 + 1.3 * near;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.08 + 0.30 * near, t + 0.12 + 0.2 * near);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.gain.setValueAtTime(0, t + dur + 0.02);
      s.connect(f); f.connect(g);
      route(g, ambBus, pan * 0.6, 0.42);
      startNoise(s, t, dur + 0.1);
      try { s.stop(t + dur + 0.15); } catch (e) {}
      /* Sub pressure wave. */
      var sub = osc('sine', 44, t + 0.02);
      sub.frequency.exponentialRampToValueAtTime(26, t + 1.0);
      var sg = gain(0);
      perc(sg.gain, t + 0.02, 0.05, 0.95, 0.10 + 0.22 * near);
      sub.connect(sg); sg.connect(ambBus);
      sub.start(t + 0.02); try { sub.stop(t + 1.4); } catch (e) {}
    },

    /* UI. Small, dry, out of the way of everything else. */
    ui: function (t, o) {
      bell(t, mtof(o.up ? 84 : 79), 0.12, 0.06, 4.0, 1.2, sfxBus, 0, 0.10);
    }
  };

  A.sfx = function (name, opts) {
    if (!ready || muted) return;
    try {
      var fn = SFX[name];
      if (!fn) return;
      fn(now(), opts || {});
    } catch (e) { /* audio must never be able to break a frame */ }
  };

  /* ------------------------------------------------------------------
     THE SCORE
     ------------------------------------------------------------------ */

  /* D aeolian. Eight bars, one chord per bar, written so the last two
     bars pull hard back to the tonic — the loop point should feel like
     a corner being turned, not a splice. */
  var PROG = [
    { r: 38, q: [0, 3, 7, 10] },     // Dm7      — home
    { r: 38, q: [0, 3, 7, 14] },     // Dm add9
    { r: 34, q: [0, 4, 7, 11] },     // Bbmaj7
    { r: 41, q: [0, 4, 7, 14] },     // F add9
    { r: 38, q: [0, 3, 7, 10] },     // Dm7
    { r: 43, q: [0, 3, 7, 10] },     // Gm7
    { r: 34, q: [0, 4, 7, 11] },     // Bbmaj7
    { r: 45, q: [0, 3, 7, 10] }      // Am7 -> back to Dm
  ];
  /* Under pressure the last bar becomes a dominant with a flat ninth:
     the same progression, but it stops resolving comfortably. */
  var TENSE_LAST = { r: 45, q: [0, 4, 7, 13] };

  var PENT = [0, 3, 5, 7, 10];

  /* 16-step bass rhythm masks; the arrangement picks one per bar. */
  var BASS_MASKS = [
    [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0],
    [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1]
  ];

  var mus = null;                 // the running score, or null
  var schedTimer = 0;

  function musicNodesStop(t) {
    if (!mus) return;
    for (var i = 0; i < mus.hold.length; i++) {
      try { mus.hold[i].stop(t); } catch (e) {}
    }
    mus.hold.length = 0;
  }

  A.music = function (track) {
    if (!ready) { A._pending = track; return; }
    if (mus && mus.track === track) return;      // idempotent — no restart stutter
    A.stopMusic();
    if (!track || track === 'none') return;
    try { startTrack(track); } catch (e) { mus = null; }
  };

  A.stopMusic = function () {
    if (schedTimer) { global.clearInterval(schedTimer); schedTimer = 0; }
    if (!mus || !ac) { mus = null; return; }
    var t = ac.currentTime;
    try {
      mus.out.gain.cancelScheduledValues(t);
      mus.out.gain.setValueAtTime(mus.out.gain.value, t);
      mus.out.gain.linearRampToValueAtTime(0.0001, t + 0.45);
    } catch (e) {}
    musicNodesStop(t + 0.55);
    mus = null;
  };

  function startTrack(track) {
    var t0 = now();
    var out = gain(0.0001);
    out.connect(musicBus);
    out.gain.linearRampToValueAtTime(1.0, t0 + (track === 'run' ? 1.6 : 0.8));

    mus = {
      track: track,
      out: out,
      hold: [],
      step: 0,
      nextTime: t0 + 0.08,
      t0: t0,
      chord: PROG[0],
      seed: (Math.floor(t0 * 97) & 1023),
      lastReel: 0
    };

    /* --- the drone: three detuned saws under a moving lowpass. It is
       the floor of the mix and never stops while the track runs. --- */
    var dsum = gain(1);
    var dfil = bq('lowpass', 320, 3.2);
    var dgn = gain(track === 'run' ? 0.19 : 0.13);
    dsum.connect(dfil); dfil.connect(dgn); dgn.connect(out);
    var det = [-7, 0, 7];
    mus.drone = [];
    for (var i = 0; i < 3; i++) {
      var o = osc(i === 1 ? 'triangle' : 'sawtooth', mtof(26) * Math.pow(2, det[i] / 1200), t0);
      var g = gain(i === 1 ? 0.5 : 0.3);
      o.connect(g); g.connect(dsum);
      o.start(t0); mus.hold.push(o);
      mus.drone.push(o);
    }
    /* A fifth above, quieter, for body. */
    var o5 = osc('sawtooth', mtof(33), t0);
    var g5 = gain(0.16);
    o5.connect(g5); g5.connect(dsum);
    o5.start(t0); mus.hold.push(o5); mus.drone.push(o5);
    mus.droneFilter = dfil;
    mus.droneGain = dgn;

    /* Slow movement in the drone so it is never static. */
    var lfo = osc('sine', 0.055, t0);
    var lg = gain(60);
    lfo.connect(lg); lg.connect(dfil.frequency);
    lfo.start(t0); mus.hold.push(lfo);

    /* --- the weather bed: looping pink noise, opened by intensity.
       Sits on ambBus so it survives music ducking. --- */
    var st = ac.createBufferSource();
    st.buffer = pinkBuf; st.loop = true;
    var stf = bq('lowpass', 380, 0.9);
    var sth = bq('highpass', 90, 0.7);
    var stg = gain(0.03);
    st.connect(sth); sth.connect(stf); stf.connect(stg); stg.connect(ambBus);
    st.start(t0); mus.hold.push(st);
    mus.stormFilter = stf;
    mus.stormGain = stg;

    /* Sub rumble under the weather. */
    var rb = osc('sine', 37, t0);
    var rg = gain(0.02);
    rb.connect(rg); rg.connect(ambBus);
    rb.start(t0); mus.hold.push(rb);
    mus.rumbleGain = rg;

    if (track === 'run') {
      schedTimer = global.setInterval(function () {
        try { pump(ac.currentTime + 0.30); } catch (e) {}
      }, 40);
      pump(t0 + 0.30);
    } else if (track === 'end') {
      /* Post-run: no pulse. The drone plus a slow falling chorale. */
      outro(t0);
    }
  }

  function outro(t0) {
    var chords = [PROG[0], PROG[5], PROG[2], PROG[7], PROG[0]];
    for (var i = 0; i < chords.length; i++) {
      var t = t0 + 0.4 + i * 2.6;
      padChord(t, chords[i], 2.9, 0.055, 0.35);
      if (i < chords.length - 1) {
        bell(t + 0.1, mtof(chords[i].r + 24 + PENT[i % 5]), 2.2, 0.055,
             2.0, 2.2, mus.out, (i % 2 ? 0.3 : -0.3), 0.42);
      }
    }
  }

  /* Bar-level bookkeeping shared by the layers. */
  function chordForBar(bar) {
    var idx = bar % 8;
    if (idx === 7 && intensity > 0.55) return TENSE_LAST;
    return PROG[idx];
  }

  function pump(horizon) {
    if (!mus || mus.track !== 'run') return;
    var guard = 0;
    while (mus.nextTime < horizon && guard++ < 512) {
      var spb = 60 / bpm();
      var stepDur = spb / 4;
      if (!muted) scheduleStep(mus.nextTime, mus.step, stepDur);
      mus.nextTime += stepDur;
      mus.step++;
    }
  }

  function bpm() { return 82 + 26 * intensity + 4 * lift; }

  /* ---- layer voices --------------------------------------------- */

  function padChord(t, ch, dur, vel, sendAmt) {
    var tones = ch.q;
    for (var i = 0; i < tones.length; i++) {
      var m = ch.r + 12 + tones[i];
      for (var d = 0; d < 2; d++) {
        var o = osc(d ? 'triangle' : 'sawtooth',
                    mtof(m) * Math.pow(2, (d ? 7 : -7) / 1200), t);
        var f = bq('lowpass', 620 + 900 * lift + 320 * intensity, 0.9);
        var g = gain(0);
        adsr(g.gain, t, 0.55, 0.5, 0.72, Math.max(0.05, dur - 1.4), 1.1,
             vel * (d ? 0.55 : 1.0));
        o.connect(f); f.connect(g);
        route(g, mus.out, (i - 1.5) * 0.28 * (d ? -1 : 1), sendAmt);
        o.start(t);
        try { o.stop(t + dur + 1.6); } catch (e) {}
      }
    }
  }

  function bassNote(t, m, dur, vel) {
    var o = osc('sawtooth', mtof(m), t);
    var o2 = osc('square', mtof(m) * 1.004, t);
    var f = bq('lowpass', 180, 7);
    f.frequency.setValueAtTime(240 + 900 * vel, t);
    f.frequency.exponentialRampToValueAtTime(160 + 600 * intensity, t + dur * 0.9);
    var g = gain(0);
    perc(g.gain, t, 0.004, dur, vel * 0.30);
    var g2 = gain(0.35);
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g);
    route(g, mus.out, 0, 0.05);
    /* Sub reinforcement — the bass has to be felt on a phone speaker
       through the harmonic, so keep the fundamental clean. */
    var sub = osc('sine', mtof(m - 12), t);
    var sg = gain(0);
    perc(sg.gain, t, 0.006, dur * 0.85, vel * 0.20);
    sub.connect(sg); sg.connect(mus.out);
    o.start(t); o2.start(t); sub.start(t);
    try { o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1); sub.stop(t + dur + 0.1); } catch (e) {}
  }

  function kick(t, vel) {
    var o = osc('sine', 150, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.075);
    var g = gain(0);
    perc(g.gain, t, 0.002, 0.22, 0.34 * vel);
    o.connect(g); g.connect(mus.out);
    o.start(t); try { o.stop(t + 0.33); } catch (e) {}
    noiseBody(t, 0.012, 0.10 * vel, 'highpass', 3200, 5000, 0.7, mus.out, 0, 0.03);
  }

  /* The foundry: a struck iron plate on the backbeat. This is the
     percussion identity of the score — not a drum kit, a workshop. */
  function clank(t, vel, pitch) {
    metal(t, pitch || 330, 0.28, 0.10 * vel, mus.out, (rnd() - 0.5) * 0.5, 0.26, 1);
    noiseBody(t, 0.02, 0.11 * vel, 'highpass', 4600, 7200, 0.7, mus.out, 0, 0.10);
  }

  function hat(t, vel) {
    noiseBody(t, 0.028 + rnd() * 0.02, 0.055 * vel, 'highpass', 6800, 9000, 0.7,
              mus.out, (rnd() - 0.5) * 0.7, 0.05);
  }

  /* ---- the arrangement ------------------------------------------- */
  /*
     Sections are 8 bars. Over 32 bars (~95s at the base tempo) the bed
     builds from a bare drone to the full stack and then strips back, so
     a listener never hears the same texture twice in a minute. The
     reactive parameters can force layers in early: a closing storm
     brings percussion and bass, a high combo brings the melody.
  */
  function scheduleStep(t, step, stepDur) {
    var bar = Math.floor(step / 16);
    var s16 = step % 16;
    var sec = Math.floor(bar / 8) % 4;
    var ch = chordForBar(bar);
    var dens = intensity, lft = lift;

    var wantPad = true;
    var wantBass = sec >= 1 || dens > 0.30;
    var wantPerc = sec >= 1 || dens > 0.22;
    var wantFull = sec >= 2 || dens > 0.62;
    var wantLead = sec >= 2 || lft > 0.28;
    var wantShim = (sec >= 3 && lft > 0.05) || lft > 0.62;

    /* --- bar boundary: retune the drone, place the pad --- */
    if (s16 === 0) {
      mus.chord = ch;
      var droneRoot = ch.r - 12;
      var freqs = [mtof(droneRoot) * Math.pow(2, -7 / 1200),
                   mtof(droneRoot),
                   mtof(droneRoot) * Math.pow(2, 7 / 1200),
                   mtof(droneRoot + 7)];
      for (var d = 0; d < mus.drone.length; d++) {
        try {
          mus.drone[d].frequency.cancelScheduledValues(t);
          mus.drone[d].frequency.setTargetAtTime(freqs[d], t, 0.25);
        } catch (e) {}
      }
      if (wantPad && bar % 2 === 0) {
        padChord(t, ch, stepDur * 32, 0.050 + 0.022 * lft, 0.30 + 0.14 * lft);
      }
      /* A swell into every fourth bar so the form has punctuation. */
      if (bar % 4 === 3) {
        noiseBody(t, stepDur * 16, 0.05 + 0.06 * dens, 'bandpass', 260, 2400, 1.2,
                  mus.out, 0, 0.34);
      }
    }

    /* --- bass --- */
    if (wantBass) {
      var mask = BASS_MASKS[(bar + (sec === 3 ? 2 : 0)) % BASS_MASKS.length];
      if (mask[s16]) {
        var pick = hash32(bar * 71 + s16 * 13 + mus.seed);
        var deg = pick < 0.6 ? 0 : (pick < 0.85 ? 7 : 12);
        var vel = 0.7 + 0.3 * ((s16 % 4) === 0 ? 1 : 0.55) + 0.18 * dens;
        bassNote(t, ch.r - 12 + deg, stepDur * (s16 % 4 === 0 ? 2.2 : 1.4), Math.min(1.15, vel));
      }
    }

    /* --- percussion --- */
    if (wantPerc) {
      if (s16 === 0 || s16 === 6 || s16 === 10 || (dens > 0.5 && s16 === 14)) {
        kick(t, s16 === 0 ? 1.0 : 0.78);
      }
      if (s16 === 4 || s16 === 12) {
        clank(t, 0.85 + 0.3 * dens, s16 === 4 ? 330 : 392);
      }
      if (wantFull && (s16 === 7 || s16 === 15) && hash32(step + mus.seed) > 0.45) {
        clank(t, 0.4, 494);
      }
      if (dens > 0.30 || sec >= 2) {
        if (s16 % 2 === 1) hat(t, 0.55 + 0.45 * hash32(step * 7 + mus.seed));
        if (dens > 0.7 && s16 % 2 === 0 && s16 % 4 !== 0) hat(t, 0.3);
      }
    }

    /* --- lead bells: a melody regenerated every 4-bar phrase --- */
    if (wantLead) {
      var phrase = Math.floor(bar / 4);
      var h = hash32(phrase * 9176 + s16 * 31 + bar * 137 + mus.seed);
      var onBeat = (s16 % 4 === 0);
      var density = 0.16 + 0.26 * lft + (onBeat ? 0.22 : 0);
      if (h < density) {
        var pi = Math.floor(hash32(phrase * 613 + step * 17 + mus.seed) * 5);
        var oct = hash32(step * 3 + phrase * 41 + mus.seed) > 0.72 ? 12 : 0;
        var lm = ch.r + 24 + PENT[pi] + oct;
        var lvel = 0.075 + 0.075 * lft;
        bell(t, mtof(lm), 0.7 + 0.5 * lft, lvel, 2.01, 2.6 + 1.6 * lft,
             mus.out, (hash32(step * 5) - 0.5) * 0.7, 0.34 + 0.14 * lft);
        /* At a high multiplier the melody doubles an octave up: the
           single clearest "you are doing well" signal in the score. */
        if (lft > 0.55) {
          bell(t + 0.012, mtof(lm + 12), 0.45, lvel * 0.5, 3.51, 2.0,
               mus.out, -(hash32(step * 5) - 0.5) * 0.7, 0.40);
        }
      }
    }

    /* --- 16th shimmer: only at high combo, the reward texture --- */
    if (wantShim && s16 % 2 === 0) {
      var si = Math.floor(hash32(step * 23 + mus.seed) * ch.q.length);
      var sm = ch.r + 36 + ch.q[si];
      bell(t, mtof(sm), 0.22, 0.030 * (0.5 + lft), 5.0, 1.4,
           mus.out, ((step % 4) / 3 - 0.5) * 1.2, 0.42);
    }
  }

  /* ------------------------------------------------------------------
     A cadence when the level clears. The bed keeps running under it —
     the resolution is a layer, not a cut.
     ------------------------------------------------------------------ */
  function clearCadence() {
    if (!mus || !ready) return;
    var t = now();
    /* iv - bVI - V - I(major): a picardy third, the oldest trick there
       is for "you made it". */
    var seq = [
      { r: 43, q: [0, 3, 7, 10], d: 0.62 },
      { r: 34, q: [0, 4, 7, 11], d: 0.62 },
      { r: 45, q: [0, 4, 7, 10], d: 0.62 },
      { r: 38, q: [0, 4, 7, 11], d: 2.4 }
    ];
    var tt = t;
    for (var i = 0; i < seq.length; i++) {
      padChord(tt, seq[i], seq[i].d + 0.6, 0.075, 0.40);
      bell(tt, mtof(seq[i].r + 24), 1.1, 0.075, 2.0, 2.2, mus.out,
           (i % 2 ? 0.28 : -0.28), 0.42);
      tt += seq[i].d;
    }
  }

  /* ------------------------------------------------------------------
     The reactive tick. Reads the live world and moves the mix. It also
     synthesises the events game.js does not emit — rope wrap, winch
     ratchet, combo step-ups, rope tension, thunder — so none of this
     needs a change in a file this module does not own.
     ------------------------------------------------------------------ */
  var prev = {
    pivots: 0, attached: false, target: 0, combo: 1, phase: '',
    reelAcc: 0, thunderAt: 0, alive: true
  };
  var tension = null;
  var lastTickAt = 0;

  function ensureTension() {
    if (tension || !ready) return;
    var t = now();
    var s = ac.createBufferSource();
    s.buffer = pinkBuf; s.loop = true;
    var bp = bq('bandpass', 300, 9);
    var g = gain(0.0001);
    /* A slow flutter so the creak lives rather than sitting still. */
    var lfo = osc('sine', 4.3, t);
    var lg = gain(70);
    lfo.connect(lg); lg.connect(bp.frequency);
    s.connect(bp); bp.connect(g);
    route(g, sfxBus, 0, 0.16);
    s.start(t); lfo.start(t);
    tension = { src: s, filt: bp, gain: g, lfo: lfo };
  }

  function killTension() {
    if (!tension) return;
    var t = now();
    var tn = tension; tension = null;
    try {
      tn.gain.gain.cancelScheduledValues(t);
      tn.gain.gain.setTargetAtTime(0.0001, t, 0.05);
      tn.src.stop(t + 0.4); tn.lfo.stop(t + 0.4);
    } catch (e) {}
  }

  function tick(dt) {
    if (!ready) return;
    dt = Math.min(0.1, Math.max(0.001, dt || 0.016));

    var w = (SH.Game && SH.Game.world) || null;
    var phase = (SH.Game && SH.Game.state && SH.Game.state.phase) || '';

    /* ---- targets ---- */
    intensityT = 0; liftT = 0;
    if (w && phase === 'playing' && !w.dead) {
      var d = w.p.x - w.storm.x;
      if (w.storm.speed > 0) {
        /* 1 at ~2 tiles away, 0 at ~20 tiles away. */
        intensityT = clamp01(1 - (d - 96) / 900);
      }
      var cm = (SH.TUNE && SH.TUNE.comboMax) || 12;
      liftT = clamp01(((w.combo || 1) - 1) / Math.max(1, cm - 1));
    } else if (phase === 'clear') {
      liftT = lift * 0.6;
    }

    intensity = intensity + (intensityT - intensity) * (1 - Math.exp(-1.8 * dt));
    lift = lift + (liftT - lift) * (1 - Math.exp(-3.2 * dt));

    /* ---- push the reactive parameters into the running graph ---- */
    if (mus) {
      var t = ac.currentTime;
      try {
        mus.droneFilter.frequency.setTargetAtTime(300 + 1500 * intensity + 500 * lift, t, 0.25);
        mus.droneGain.gain.setTargetAtTime(0.16 + 0.10 * intensity, t, 0.4);
        mus.stormFilter.frequency.setTargetAtTime(300 + 2600 * intensity, t, 0.5);
        mus.stormGain.gain.setTargetAtTime(0.022 + 0.20 * intensity, t, 0.5);
        mus.rumbleGain.gain.setTargetAtTime(0.012 + 0.075 * intensity, t, 0.6);
      } catch (e) {}
    }

    /* ---- events game.js does not emit ---- */
    if (w && phase === 'playing') {
      var hk = w.hook;
      var pan = 0;
      if (SH.Render && SH.Render.camera) {
        pan = clamp01(((w.p.x - SH.Render.camera.x) / 900) + 0.5) * 2 - 1;
        pan *= 0.5;
      }

      /* Rope wrapping onto a corner. */
      if (hk.attached && hk.pivots.length > prev.pivots && prev.attached) {
        A.sfx('wrap', { pan: pan });
      } else if (hk.attached && hk.pivots.length < prev.pivots && prev.attached) {
        A.sfx('unwrap', { pan: pan });
      }

      /* Winch ratchet, spaced by rope distance actually travelled. */
      if (hk.attached && prev.attached) {
        var dl = hk.target - prev.target;
        prev.reelAcc += Math.abs(dl);
        if (prev.reelAcc > 34) {
          prev.reelAcc = 0;
          A.sfx('reel', { dir: dl > 0 ? 1 : -1, pan: pan });
        }
      } else { prev.reelAcc = 0; }

      /* Rope tension: a live creak whose pitch and level follow the
         load on the line. Silent the instant the rope is dropped. */
      if (hk.attached) {
        ensureTension();
        if (tension) {
          var sp = Math.sqrt(w.p.vx * w.p.vx + w.p.vy * w.p.vy);
          var load = clamp01(sp / 1000);
          var tt2 = ac.currentTime;
          try {
            tension.gain.gain.setTargetAtTime(0.006 + 0.075 * load * load, tt2, 0.08);
            tension.filt.frequency.setTargetAtTime(190 + 520 * load, tt2, 0.10);
            tension.filt.Q.setTargetAtTime(6 + 12 * load, tt2, 0.2);
          } catch (e) {}
        }
      } else if (tension) {
        killTension();
      }

      /* Combo step-up. game.js only tells us when a chain breaks. */
      var combo = w.combo || 1;
      if (combo > prev.combo && combo > 1) A.sfx('comboUp', { combo: combo });
      prev.combo = combo;

      /* Lightning. Rate rises as the front closes, so the weather is
         audibly hunting you even on an empty stretch of level. */
      if (intensity > 0.12) {
        var nowT = ac.currentTime;
        if (prev.thunderAt === 0) prev.thunderAt = nowT + 3;
        if (nowT > prev.thunderAt) {
          A.sfx('thunder', { near: intensity, pan: -0.4 - 0.3 * rnd() });
          prev.thunderAt = nowT + rndR(2.2, 7.5) * (1.25 - intensity);
        }
      }

      prev.pivots = hk.pivots.length;
      prev.attached = hk.attached;
      prev.target = hk.target;
    } else {
      if (tension) killTension();
      prev.pivots = 0; prev.attached = false; prev.combo = 1; prev.thunderAt = 0;
    }

    /* ---- phase transitions ---- */
    if (phase !== prev.phase) {
      if (phase === 'clear') clearCadence();
      if (phase === 'paused' && musicDuck) A.duckFor(9999);
      if (phase === 'playing' && prev.phase === 'paused' && musicDuck) {
        try {
          var tp = ac.currentTime;
          duckUntil = 0;
          musicDuck.gain.cancelScheduledValues(tp);
          musicDuck.gain.setValueAtTime(musicDuck.gain.value, tp);
          musicDuck.gain.linearRampToValueAtTime(1, tp + 0.3);
        } catch (e) {}
      }
      prev.phase = phase;
    }
  }

  /* The lead may drive this from game.js's update for a tighter loop;
     until then it self-drives off rAF so no other file has to change. */
  A.update = function (dt) {
    selfDrive = false;
    if (rafId && global.cancelAnimationFrame) {
      global.cancelAnimationFrame(rafId); rafId = 0;
    }
    try { tick(dt); } catch (e) {}
  };

  function startDrive() {
    if (!selfDrive || rafId || !global.requestAnimationFrame) return;
    var last = 0;
    var step = function (ts) {
      rafId = global.requestAnimationFrame(step);
      var dt = last ? (ts - last) / 1000 : 0.016;
      last = ts;
      try { tick(dt); } catch (e) {}
    };
    rafId = global.requestAnimationFrame(step);
  }

  /* Direct control, for anyone who wants to drive the score explicitly
     rather than let it read the world. */
  A.setIntensity = function (v) { intensity = intensityT = clamp01(v); };
  A.setLift = function (v) { lift = liftT = clamp01(v); };
  A.getIntensity = function () { return intensity; };
  A.getLift = function () { return lift; };

  /* ------------------------------------------------------------------
     Late start: music asked for before the context existed.
     ------------------------------------------------------------------ */
  try {
    SH.on('phase', function () {
      if (ready && A._pending) { var t = A._pending; A._pending = null; A.music(t); }
    });
  } catch (e) {}

  /* ------------------------------------------------------------------
     Offline-render hooks. Used only by the analysis tooling: they let a
     scratch harness render this exact synthesis code into an
     OfflineAudioContext and measure it. Harmless in the game.
     ------------------------------------------------------------------ */
  A._debug = {
    attach: function (ctx) {
      ac = ctx; muted = false; selfDrive = false; mus = null;
      if (schedTimer) { global.clearInterval(schedTimer); schedTimer = 0; }
      tension = null; duckUntil = 0;
      rngState = 0x9e3779b9;
      buildGraph();
      ready = true;
      return true;
    },
    set: function (o) {
      if (o && o.intensity != null) intensity = intensityT = clamp01(o.intensity);
      if (o && o.lift != null) lift = liftT = clamp01(o.lift);
    },
    /* Schedule `sec` seconds of the running track in one synchronous
       pass — the interval scheduler never fires under offline render. */
    pump: function (sec) { pump(sec); },
    cadence: function () { clearCadence(); },
    names: function () { var k = [], n; for (n in SFX) k.push(n); return k; },
    state: function () {
      return { ready: ready, muted: muted, track: mus && mus.track,
               intensity: intensity, lift: lift, bpm: bpm(), step: mus && mus.step };
    }
  };

})(typeof window !== 'undefined' ? window : this);
