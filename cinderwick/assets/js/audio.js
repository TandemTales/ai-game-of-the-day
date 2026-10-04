/* Cinderwick audio: fully synthesised Web Audio sfx + procedural foundry music.
 * Zero external assets. Classic script; attaches CW.Audio.
 * API: init(), sfx(type, opts), music(on), setMuted(b), isMuted(), setTension(0..1)
 */
(function (root) {
  'use strict';
  var CW = root.CW = root.CW || {};

  var ctx = null, master = null, comp = null, limiter = null, shaper = null;
  var sfxBus = null, musicBus = null, revSend = null, convolver = null, revReturn = null;
  var noiseBuf = null;
  var muted = false, tension = 0, tensionSmooth = 0;
  var MASTER_LEVEL = 0.8;
  var MUSIC_LEVEL = 0.1;       // sits well under sfx
  var SFX_LEVEL = 0.85;

  // ---------- voice accounting / rate limiting ----------
  var MAX_WEIGHT = 56;         // total "voice weight" alive at once
  var voices = [];             // {end, w}
  var lastPlayed = {};         // type -> time
  var recentExp = [];          // explosion start times
  var MIN_GAP = { spark: 0.03, place: 0.04, cord: 0.05, ui: 0.03, kill: 0.04,
                  crate: 0.035, pickup: 0.05, strike: 0.05, exit: 0.1, hurry: 0.3 };
  var WEIGHT = { explode: 7, death: 5, win: 6, over: 5, level: 5, kill: 3, crate: 3,
                 place: 3, pickup: 3, exit: 3, hurry: 3, cord: 2, strike: 2, spark: 1, ui: 1 };
  var PRIORITY = { win: 1, death: 1, over: 1, level: 1 };

  function liveWeight(now) {
    var w = 0, keep = [];
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].end > now) { w += voices[i].w; keep.push(voices[i]); }
    }
    voices = keep;
    return w;
  }

  // ---------- context ----------
  function makeImpulse(c, secs, decay) {
    var rate = c.sampleRate, len = Math.floor(rate * secs);
    var buf = c.createBuffer(2, len, rate);
    var seed = 12345;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; }
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), lp = 0;
      for (var i = 0; i < len; i++) {
        var t = i / len;
        lp += (rnd() - lp) * (0.55 - 0.45 * t);   // darker as tail decays
        d[i] = lp * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1);
      }
    }
    return buf;
  }

  function buildGraph() {
    var c = ctx;
    master = c.createGain();
    master.gain.value = muted ? 0 : MASTER_LEVEL;
    comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.001; limiter.release.value = 0.08;
    // gentle soft clip as a final safety net
    shaper = c.createWaveShaper();
    var n = 1024, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * 1.15) / Math.tanh(1.15); }
    shaper.curve = curve;
    comp.connect(limiter); limiter.connect(shaper); shaper.connect(master); master.connect(c.destination);

    sfxBus = c.createGain(); sfxBus.gain.value = SFX_LEVEL; sfxBus.connect(comp);
    musicBus = c.createGain(); musicBus.gain.value = MUSIC_LEVEL; musicBus.connect(comp);

    convolver = c.createConvolver();
    convolver.buffer = makeImpulse(c, 1.6, 3.2);
    revSend = c.createGain(); revSend.gain.value = 1;
    revReturn = c.createGain(); revReturn.gain.value = 0.55;
    revSend.connect(convolver); convolver.connect(revReturn); revReturn.connect(comp);

    // shared white-noise buffer
    var len = Math.floor(c.sampleRate * 2);
    noiseBuf = c.createBuffer(1, len, c.sampleRate);
    var nd = noiseBuf.getChannelData(0), s = 987654321;
    for (var k = 0; k < len; k++) { s = (s * 1664525 + 1013904223) >>> 0; nd[k] = s / 4294967296 * 2 - 1; }
  }

  function init() {
    try {
      if (!ctx) {
        var AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        buildGraph();
        try {
          if (root.document && root.document.addEventListener) {
            root.document.addEventListener('visibilitychange', onVis);
          }
        } catch (e) { /* ignore */ }
      }
      if (ctx.state === 'suspended' && ctx.resume) {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  function onVis() {
    try {
      if (!ctx || ctx.constructor && ctx.constructor.name === 'OfflineAudioContext') return;
      if (root.document.hidden) { if (ctx.suspend) ctx.suspend().catch(function () {}); }
      else if (ctx.resume) ctx.resume().catch(function () {});
    } catch (e) { /* ignore */ }
  }

  // ---------- synth primitives ----------
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function finish(nodes, src) {
    src.onended = function () {
      for (var i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) {} }
    };
  }

  // Oscillator with exponential decay envelope. o: {attack, detune, lp, hp, rev, dest, vib:[hz,depthHz], curve}
  function osc(type, f0, f1, t, dur, g, o) {
    o = o || {};
    var dest = o.dest || sfxBus;
    var src = ctx.createOscillator(), amp = ctx.createGain(), nodes = [src, amp];
    src.type = type;
    src.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) src.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    if (o.detune) src.detune.value = o.detune;
    var att = o.attack || 0.004;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(g, t + att);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var tail = src;
    if (o.lp) { var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp; lp.Q.value = o.q || 0.7; tail.connect(lp); tail = lp; nodes.push(lp); }
    if (o.hp) { var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = o.hp; tail.connect(hp); tail = hp; nodes.push(hp); }
    tail.connect(amp); amp.connect(dest);
    if (o.rev) { var rs = ctx.createGain(); rs.gain.value = o.rev; amp.connect(rs); rs.connect(revSend); nodes.push(rs); }
    if (o.vib) {
      var l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1];
      l.connect(lg); lg.connect(src.frequency); l.start(t); l.stop(t + dur + 0.05);
      nodes.push(l, lg);
    }
    src.start(t); src.stop(t + dur + 0.05);
    finish(nodes, src);
    return src;
  }

  // Filtered noise burst. o: {type, f0, f1, q, attack, rev, dest}
  function noise(t, dur, g, o) {
    o = o || {};
    var dest = o.dest || sfxBus;
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), amp = ctx.createGain();
    var nodes = [src, f, amp];
    src.buffer = noiseBuf;
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f0 || 2000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
    f.Q.value = o.q || 0.8;
    var att = o.attack || 0.002;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(g, t + att);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(amp); amp.connect(dest);
    if (o.rev) { var rs = ctx.createGain(); rs.gain.value = o.rev; amp.connect(rs); rs.connect(revSend); nodes.push(rs); }
    src.start(t, Math.random() * (noiseBuf.duration - dur - 0.1), dur + 0.02);
    finish(nodes, src);
    return src;
  }

  // metallic clank: inharmonic square partials through bandpass
  function clank(t, base, g, dur, dest) {
    var ratios = [1, 2.76, 5.4, 8.93];
    for (var i = 0; i < ratios.length; i++) {
      osc('square', base * ratios[i], base * ratios[i] * 0.985, t, dur * (1 - i * 0.18), g / (1 + i * 0.9),
          { dest: dest, hp: 300, lp: 7000, attack: 0.001 });
    }
    noise(t, dur * 0.5, g * 0.9, { type: 'bandpass', f0: base * 4, q: 1.2, dest: dest });
  }

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // ---------- sfx ----------
  var PENT = [0, 2, 4, 7, 9];   // major pentatonic degrees (sounds good over everything)

  var SFX = {
    place: function (t) {
      osc('sine', 150, 55, t, 0.14, 0.7);
      osc('triangle', 520, 300, t, 0.05, 0.3);
      noise(t, 0.05, 0.4, { f0: 900, q: 0.9 });
      // fuse hiss
      noise(t + 0.03, 0.4, 0.18, { type: 'highpass', f0: 3200, attack: 0.05 });
      noise(t + 0.03, 0.4, 0.1, { type: 'bandpass', f0: 6500, q: 2, attack: 0.08 });
    },
    cord: function (t) {
      for (var i = 0; i < 4; i++) {
        noise(t + i * 0.035, 0.05, 0.5, { f0: rnd(1500, 2400), q: 3 });
      }
      osc('triangle', 95, 80, t, 0.16, 0.18);
    },
    explode: function (t, opts, scale) {
      var n = Math.max(1, Math.min(40, (opts && opts.chain) | 0 || 1));
      var inten = Math.min(1, 0.55 + 0.07 * n) * scale;
      var up = 1 + 0.035 * Math.min(n, 12);
      osc('sine', 95 * up, 28, t, 0.5, 0.95 * inten);                       // sub thump
      osc('sawtooth', 170 * up, 45, t, 0.38, 0.35 * inten, { lp: 700 });    // body
      noise(t, 0.14, 0.75 * inten, { type: 'highpass', f0: 1100 + n * 90, attack: 0.001 }); // crack
      noise(t, 0.65, 0.55 * inten, { type: 'lowpass', f0: 520, f1: 90, q: 0.5, attack: 0.004, rev: 0.5 }); // rumble
      var bits = 5 + Math.min(6, n);
      for (var i = 0; i < bits; i++) {                                         // debris rattle
        noise(t + 0.06 + Math.random() * 0.5, rnd(0.02, 0.06), rnd(0.12, 0.3) * inten,
              { f0: rnd(2200, 6500), q: 2.5 });
      }
      // rising pentatonic ding accent
      var step = n - 1, deg = PENT[step % 5] + 12 * Math.floor(step / 5);
      deg = Math.min(deg, 36);
      var f = mtof(69 + deg);   // A4 upward
      var dg = 0.22 * scale;
      osc('sine', f, f, t + 0.01, 0.55, dg, { rev: 0.6, attack: 0.002 });
      osc('triangle', f * 2, f * 2, t + 0.01, 0.3, dg * 0.4, { rev: 0.4, attack: 0.002 });
    },
    crate: function (t) {
      osc('square', 230, 100, t, 0.09, 0.3, { lp: 1500 });
      osc('triangle', 700, 350, t, 0.05, 0.25);
      for (var i = 0; i < 5; i++) {
        noise(t + i * 0.018 + Math.random() * 0.02, rnd(0.02, 0.05), rnd(0.2, 0.45), { f0: rnd(2500, 5500), q: 3 });
      }
    },
    kill: function (t) {
      osc('sine', 650, 140, t, 0.22, 0.5, { vib: [38, 90] });
      for (var i = 0; i < 6; i++) noise(t + i * 0.025, 0.035, 0.22, { f0: rnd(1200, 3800), q: 5 });
      osc('sine', 900, 200, t + 0.13, 0.07, 0.5);               // pop
      noise(t + 0.13, 0.06, 0.3, { f0: 1800, q: 1 });
    },
    pickup: function (t) {
      var notes = [72, 76, 79, 84];
      for (var i = 0; i < notes.length; i++) {
        var f = mtof(notes[i]);
        osc('triangle', f, f, t + i * 0.06, 0.22, 0.3, { rev: 0.3 });
        osc('square', f, f, t + i * 0.06, 0.1, 0.07, { lp: 3500 });
      }
    },
    death: function (t) {
      osc('sawtooth', 520, 105, t, 0.95, 0.32, { lp: 1600, vib: [7, 14], attack: 0.02, rev: 0.3 });
      osc('square', 262, 52, t, 0.95, 0.12, { lp: 900, attack: 0.02 });
      osc('sine', 120, 38, t + 0.55, 0.4, 0.8);
      noise(t + 0.55, 0.15, 0.4, { f0: 300, type: 'lowpass' });
    },
    win: function (t) {
      var seq = [[60, 0], [60, 0.12], [60, 0.24], [64, 0.36], [67, 0.6]];
      for (var i = 0; i < seq.length; i++) {
        var f = mtof(seq[i][0] + 12), dt = t + seq[i][1], d = i === 4 ? 0.9 : 0.16;
        osc('sawtooth', f, f, dt, d, 0.2, { lp: 3200, rev: 0.4, attack: 0.008 });
        osc('square', f, f, dt, d, 0.08, { lp: 2200, detune: 7 });
      }
      var chord = [72, 76, 79, 84];
      for (var j = 0; j < chord.length; j++) {
        var cf = mtof(chord[j]);
        osc('triangle', cf, cf, t + 0.6, 1.2, 0.15, { rev: 0.6, attack: 0.02 });
      }
      clank(t + 0.6, 520, 0.08, 0.4);
    },
    strike: function (t) {
      noise(t, 0.13, 0.5, { type: 'highpass', f0: 1800, f1: 9000, q: 1.5, attack: 0.003 });
      osc('triangle', 3200, 2600, t + 0.11, 0.03, 0.2);
      noise(t + 0.12, 0.2, 0.12, { type: 'highpass', f0: 4000, attack: 0.02 });
    },
    spark: function (t) {
      var k = 1 + Math.floor(Math.random() * 3);
      for (var i = 0; i < k; i++) noise(t + i * rnd(0.012, 0.03), 0.015, rnd(0.5, 0.9), { type: 'highpass', f0: rnd(3500, 7000) });
    },
    exit: function (t) {
      var fs = [880, 1320, 1760, 2217];
      for (var i = 0; i < fs.length; i++) {
        osc('sine', fs[i] * 0.97, fs[i] * 1.03, t + i * 0.04, 0.75, 0.1, { rev: 0.8, attack: 0.15, vib: [5 + i, 6] });
      }
      noise(t, 0.7, 0.1, { f0: 800, f1: 5000, q: 4, attack: 0.25, rev: 0.7 });
    },
    hurry: function (t) {
      var seq = [0, 0.17, 0.4, 0.57];
      for (var i = 0; i < seq.length; i++) {
        var f = (i % 2) ? 500 : 680;
        osc('sawtooth', f, f * 0.98, t + seq[i], 0.15, 0.22, { lp: 2400, attack: 0.006 });
        osc('square', f * 0.5, f * 0.5, t + seq[i], 0.15, 0.1, { lp: 1200 });
      }
    },
    level: function (t) {
      clank(t, 430, 0.1, 0.35);
      var n = [57, 60, 64, 69];
      for (var i = 0; i < n.length; i++) {
        var f = mtof(n[i]);
        osc('triangle', f, f, t + 0.1 + i * 0.075, 0.35, 0.26, { rev: 0.4 });
        osc('sawtooth', f, f, t + 0.1 + i * 0.075, 0.2, 0.06, { lp: 2000 });
      }
    },
    over: function (t) {
      var n = [57, 53, 50, 45];
      for (var i = 0; i < n.length; i++) {
        var f = mtof(n[i]);
        osc('sawtooth', f, f * 0.99, t + i * 0.3, 0.55, 0.2, { lp: 700, rev: 0.6, attack: 0.02, vib: [5, 3] });
        osc('sine', f / 2, f / 2, t + i * 0.3, 0.6, 0.3, { attack: 0.02 });
      }
      osc('sine', 80, 32, t + 1.2, 0.8, 0.5, { rev: 0.3 });
    },
    ui: function (t) {
      osc('sine', 1300, 900, t, 0.05, 0.5);
      noise(t, 0.015, 0.25, { type: 'highpass', f0: 4000 });
    }
  };

  var lastErr = null;
  function sfx(type, opts) {
    try {
      if (!ctx || !SFX[type]) return;
      var now = ctx.currentTime, t = now + 0.005;
      var w = WEIGHT[type] || 2;
      // per-type rate limit
      var gap = MIN_GAP[type];
      if (gap && lastPlayed[type] !== undefined && now - lastPlayed[type] < gap) return;
      // global voice cap
      var live = liveWeight(now);
      if (!PRIORITY[type] && live + w > MAX_WEIGHT) return;
      if (PRIORITY[type] && live + w > MAX_WEIGHT * 1.5) return;
      var scale = 1;
      if (type === 'explode') {
        var k = 0, keep = [];
        for (var i = 0; i < recentExp.length; i++) if (now - recentExp[i] < 0.1) { keep.push(recentExp[i]); k++; }
        recentExp = keep;
        if (k >= 5) return;                  // simultaneous pile-up: drop
        scale = 1 / (1 + 0.3 * k);           // quieter as they stack
        recentExp.push(now);
      }
      lastPlayed[type] = now;
      var dur = type === 'over' ? 2.2 : type === 'win' ? 1.9 : type === 'death' ? 1.1 : type === 'explode' ? 0.8 : 0.8;
      voices.push({ end: now + dur, w: w });
      SFX[type](t, opts, scale);
    } catch (e) { lastErr = e; /* never throw */ }
  }

  // ---------- music ----------
  var BPM_BASE = 118, SWING = 0.14;
  var CHORDS = [   // Am  F  C  G  (i VI III VII), root midi + chord tones
    { root: 33, tones: [57, 60, 64, 67] },
    { root: 29, tones: [53, 57, 60, 64] },
    { root: 36, tones: [55, 60, 64, 67] },
    { root: 31, tones: [55, 59, 62, 67] }
  ];
  var BASS_STEPS = { 0: 0, 3: 0, 6: 12, 8: 0, 10: 7, 14: 12 };   // step -> semitone offset
  var ARP = [0, 2, 1, 3, 2, 1, 3, 2, 0, 1, 2, 3, 1, 2, 3, 2];    // chord-tone index per 16th

  var mTimer = null, mOn = false, mStep = 0, mNext = 0, mSess = null, mBusy = false;
  var LOOKAHEAD = 0.18, TICK_MS = 25;

  function stepDur() {
    var bpm = BPM_BASE + 14 * tensionSmooth;
    return 60 / bpm / 4;
  }

  function scheduleStep(step, t) {
    var d = mSess;
    var tn = tensionSmooth;
    var bar = Math.floor(step / 16) % 4, s = step % 16;
    var ch = CHORDS[bar];
    var sd = stepDur();
    var swing = (s % 2) ? sd * SWING : 0;
    var tt = t + swing;

    // kick
    if (s % 4 === 0 || (tn > 0.8 && s === 14)) {
      osc('sine', 120, 42, t, 0.18, 0.9, { dest: d, attack: 0.002 });
      noise(t, 0.02, 0.2, { f0: 2500, dest: d });
    }
    // anvil on the backbeat
    if (s === 4 || s === 12) {
      clank(t, 380 + bar * 12, 0.18, 0.28, d);
      noise(t, 0.12, 0.35, { type: 'bandpass', f0: 1800, q: 0.7, dest: d });
    }
    // ticking metal hat: offbeat 8ths, then 16ths with tension
    var hat = (tn >= 0.55) ? true : (tn >= 0.25 ? s % 2 === 0 : s % 4 === 2);
    if (hat) {
      var accent = s % 4 === 2 ? 1 : 0.5;
      noise(tt, 0.035, 0.16 * accent, { type: 'highpass', f0: 6500, dest: d });
    }
    // random industrial clank accents with tension
    if (tn > 0.6 && (s === 7 || s === 15 || s === 11)) {
      clank(tt, 700 + Math.random() * 300, 0.07, 0.12, d);
    }
    // swung bass
    if (BASS_STEPS.hasOwnProperty(s)) {
      var m = ch.root + BASS_STEPS[s];
      var f = mtof(m);
      osc('sawtooth', f, f, tt, sd * 2.2, 0.38, { dest: d, lp: 300 + tn * 700, q: 4, attack: 0.005 });
      osc('square', f / 2, f / 2, tt, sd * 2.2, 0.25, { dest: d, lp: 180, attack: 0.005 });
    }
    // minor arpeggio lead (denser with tension)
    var arpOn = tn >= 0.55 ? true : (tn >= 0.25 ? s % 2 === 0 : (s % 4 === 0 || s % 8 === 3));
    if (arpOn) {
      var note = ch.tones[ARP[s] % ch.tones.length] + ((s >= 8 && tn > 0.3) ? 12 : 0);
      var lf = mtof(note);
      osc('square', lf, lf, tt, sd * 1.6, 0.11, { dest: d, lp: 900 + tn * 3600, q: 2, attack: 0.004, rev: 0.25 });
      osc('triangle', lf * 2, lf * 2, tt, sd * 1.2, 0.04, { dest: d, rev: 0.2 });
    }
    // pad: once per bar
    if (s === 0) {
      var pd = sd * 16;
      for (var i = 0; i < 3; i++) {
        var pf = mtof(ch.tones[i] - 12 + 12);
        osc('sawtooth', pf, pf, t, pd * 1.05, 0.07, { dest: d, lp: 500 + tn * 1200, attack: pd * 0.35, detune: (i - 1) * 9, rev: 0.4 });
      }
    }
  }

  function pump(horizon) {
    if (!mOn || !ctx || mBusy) return;
    mBusy = true;
    try {
      tensionSmooth += (tension - tensionSmooth) * 0.2;
      var limit = horizon !== undefined ? horizon : ctx.currentTime + LOOKAHEAD;
      var guard = 0;
      while (mNext < limit && guard++ < 4096) {
        scheduleStep(mStep, mNext);
        mNext += stepDur();
        mStep = (mStep + 1) % 64;
      }
    } catch (e) { lastErr = e; }
    mBusy = false;
  }

  function music(on) {
    try {
      if (on) {
        if (!ctx) return;
        if (mOn) return;
        mOn = true; mStep = 0;
        mSess = ctx.createGain();
        mSess.gain.setValueAtTime(0.0001, ctx.currentTime);
        mSess.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25);
        mSess.connect(musicBus);
        mNext = ctx.currentTime + 0.06;
        pump();
        if (mTimer) clearInterval(mTimer);
        mTimer = setInterval(pump, TICK_MS);
      } else {
        if (!mOn) return;
        mOn = false;
        if (mTimer) { clearInterval(mTimer); mTimer = null; }
        var s = mSess; mSess = null;
        if (s && ctx) {
          var now = ctx.currentTime;
          s.gain.cancelScheduledValues(now);
          s.gain.setValueAtTime(s.gain.value, now);
          s.gain.linearRampToValueAtTime(0.0001, now + 0.2);
          setTimeout(function () { try { s.disconnect(); } catch (e) {} }, 2500);
        }
      }
    } catch (e) { /* never throw */ }
  }

  function setMuted(b) {
    muted = !!b;
    try {
      if (master && ctx) {
        var now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(muted ? 0 : MASTER_LEVEL, now + 0.05);
      }
    } catch (e) { /* ignore */ }
  }
  function isMuted() { return muted; }
  function setTension(v) {
    v = +v; if (!(v >= 0)) v = 0; if (v > 1) v = 1;
    tension = v;
  }

  CW.Audio = {
    init: init, sfx: sfx, music: music, setMuted: setMuted, isMuted: isMuted, setTension: setTension,
    // test hooks (not part of the game API)
    _debug: {
      pumpTo: function (t) { tensionSmooth = tension; pump(t); },
      lastError: function () { return lastErr; },
      voices: function () { return voices.length; },
      ctx: function () { return ctx; },
      stepDur: stepDur
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
