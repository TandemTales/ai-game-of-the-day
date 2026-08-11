/* =====================================================================
   PARADOX VAULT — audio.js
   100% procedural Web Audio: master chain, shared marble-hall convolution
   reverb, a single look-ahead music scheduler and a pooled one-shot SFX
   engine. No audio files, no network, no base64 samples.
   Owner: agent-audio. See SPEC.md §6.
   ===================================================================== */
(function (global) {
  'use strict';

  var PV = global.PV || (global.PV = {});

  /* ==================================================================
     0. Constants / persisted keys
     ================================================================== */
  var K_MUTE = 'audio.muted';
  var K_MUS = 'audio.musicVol';
  var K_SFX = 'audio.sfxVol';

  /* Gain staging. These were tuned against the offline render harness:
     with the old values the bell stacks (rewind / relicBig / vaultClear)
     peaked at ~1.45 and the master compressor sat permanently squashed,
     which flattened the whole mix and made setTension inaudible. */
  var MASTER_LEVEL = 0.58;      // headroom below the limiter
  var MUSIC_LEVEL = 0.30;       // the bed sits well under the sfx
  var SFX_LEVEL = 0.72;
  var REVERB_RETURN = 0.50;

  var MAX_SFX_VOICES = 24;
  var LOOKAHEAD_MS = 25;        // scheduler wake period
  var SCHEDULE_AHEAD = 0.10;    // seconds of look-ahead
  var STEP_RATE_LIMIT = 0.110;  // footsteps
  var MERGE_WINDOW = 0.025;     // identical sfx merge window

  /* Per-name minimum re-trigger interval (seconds). Anything not listed
     falls back to MERGE_WINDOW. Lasers blink and receivers chatter, so
     they get their own, longer, guard. */
  var RATE_LIMIT = {
    step: STEP_RATE_LIMIT, stepCarpet: STEP_RATE_LIMIT,
    laserOn: 0.16, laserOff: 0.16, laserHit: 0.09,
    terminalBeep: 0.07, plateDown: 0.05, plateUp: 0.05,
    sentryPing: 0.30, uiHover: 0.05, countdown: 0.08
  };

  /* Local deterministic RNG. NOTE: deliberately NOT PV.rand() — advancing
     the shared seed would break deterministic level generation. */
  var _rs = 0x1a2b3c4d;
  function rnd() {
    _rs = (_rs + 0x6D2B79F5) | 0;
    var t = _rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rr(a, b) { return a + rnd() * (b - a); }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ==================================================================
     1. Envelope helpers  (everything gets a real curve, never a bare ramp)
     ================================================================== */
  function ampEnv(p, t, peak, atk, dec) {
    peak = Math.max(peak, 0.0004);
    p.cancelScheduledValues(t);
    p.setValueAtTime(0.00008, t);
    /* two-segment exponential attack = concave, punchy but click-free */
    p.exponentialRampToValueAtTime(peak * 0.55, t + atk * 0.42);
    p.exponentialRampToValueAtTime(peak, t + atk);
    p.exponentialRampToValueAtTime(0.00008, t + atk + dec);
    return atk + dec;
  }
  function susEnv(p, t, peak, atk, hold, rel) {
    peak = Math.max(peak, 0.0004);
    p.cancelScheduledValues(t);
    p.setValueAtTime(0.00008, t);
    p.exponentialRampToValueAtTime(peak * 0.6, t + atk * 0.4);
    p.exponentialRampToValueAtTime(peak, t + atk);
    p.setValueAtTime(peak, t + atk + hold);
    p.exponentialRampToValueAtTime(0.00008, t + atk + hold + rel);
    return atk + hold + rel;
  }
  function sweep(p, t, a, b, dur, curve) {
    p.cancelScheduledValues(t);
    p.setValueAtTime(Math.max(a, 0.0001), t);
    if (curve === 'lin') p.linearRampToValueAtTime(b, t + dur);
    else p.exponentialRampToValueAtTime(Math.max(b, 0.0001), t + dur);
  }

  /* ==================================================================
     2. Procedural buffers (generated once per engine, at unlock)
     ================================================================== */
  function makeNoise(ctx) {
    var sr = ctx.sampleRate, len = Math.floor(sr * 2.0);
    var buf = ctx.createBuffer(2, len, sr);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c), lp = 0;
      for (var i = 0; i < len; i++) {
        var w = rnd() * 2 - 1;
        lp += 0.16 * (w - lp);           /* a touch of pink tilt */
        d[i] = w * 0.72 + lp * 1.35;
      }
      /* strip DC */
      var mean = 0;
      for (i = 0; i < len; i++) mean += d[i];
      mean /= len;
      for (i = 0; i < len; i++) d[i] -= mean;
    }
    return buf;
  }

  /* Large marble hall: sparse early-reflection cluster + a diffused,
     progressively darkening exponential noise tail (~2.2 s). */
  function makeIR(ctx) {
    var sr = ctx.sampleRate, dur = 2.2, len = Math.floor(sr * dur);
    var buf = ctx.createBuffer(2, len, sr);
    var ER = [
      [0.0071, 0.62], [0.0113, 0.51], [0.0169, 0.44], [0.0231, 0.40],
      [0.0294, 0.34], [0.0372, 0.30], [0.0438, 0.27], [0.0531, 0.23],
      [0.0617, 0.20], [0.0738, 0.17], [0.0891, 0.14], [0.1043, 0.11]
    ];
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      var lp = 0, lpPrev = 0, hp = 0;
      var skew = c === 0 ? 1.0 : 1.037;       /* stereo decorrelation */
      for (var i = 0; i < len; i++) {
        var t = i / sr;
        var n = rnd() * 2 - 1;
        /* darkening one-pole */
        var k = lerp(0.60, 0.09, t / dur);
        lp += k * (n - lp);
        /* one-pole highpass to kill rumble + DC */
        hp = 0.994 * (hp + lp - lpPrev);
        lpPrev = lp;
        var build = Math.min(1, t / 0.020);
        var decay = Math.exp(-t * 3.05) * (1 - t / dur);
        d[i] = hp * build * decay * 0.9;
      }
      for (var e = 0; e < ER.length; e++) {
        var idx = Math.floor(ER[e][0] * skew * sr);
        if (idx < len - 4) {
          var a = ER[e][1] * (rnd() < 0.5 ? -1 : 1);
          d[idx] += a;
          d[idx + 1] += a * 0.55;
          d[idx + 2] += a * 0.22;
        }
      }
      /* normalise so the reverb send level is predictable */
      var mx = 0;
      for (i = 0; i < len; i++) { var v = d[i] < 0 ? -d[i] : d[i]; if (v > mx) mx = v; }
      if (mx > 0) { var g = 0.62 / mx; for (i = 0; i < len; i++) d[i] *= g; }
    }
    return buf;
  }

  /* Brickwall-ish output stage. Perfectly linear below `knee` so normal
     material is untouched, then a tanh soft knee that asymptotes to
     `ceil` — so the rendered peak can never reach 1.0 no matter how many
     one-shots land on the same sample. */
  function makeLimitCurve(knee, ceil) {
    var n = 8192, curve = new Float32Array(n);
    var span = ceil - knee;
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      var a = x < 0 ? -x : x, y;
      if (a <= knee) y = a;
      else y = knee + span * Math.tanh((a - knee) / span);
      curve[i] = x < 0 ? -y : y;
    }
    return curve;
  }

  function makeShaperCurve(amount) {
    var n = 1024, curve = new Float32Array(n), k = amount;
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      curve[i] = (1 + k) * x / (1 + k * Math.abs(x));
    }
    return curve;
  }

  /* ==================================================================
     3. Engine (master chain). One live engine; offline ones for self-test.
     ================================================================== */
  var _nodeCount = 0;      /* live nodes created by one-shot voices */
  var _sfxNodes = 0;       /* subset owned by sfx voices (leak-test target) */
  var _sfxVoices = [];     /* live sfx voices, for the cap */

  function makeEngine(ctx, live) {
    var E = { ctx: ctx, live: !!live };

    E.master = ctx.createGain();
    E.master.gain.value = MASTER_LEVEL;

    /* subsonic / DC trap — the heartbeat kick bottoms out near 36Hz and
       would otherwise leave a measurable DC offset in the render */
    E.dcHP = ctx.createBiquadFilter();
    E.dcHP.type = 'highpass';
    E.dcHP.frequency.value = 24;
    E.dcHP.Q.value = 0.707;

    E.comp = ctx.createDynamicsCompressor();
    try {
      E.comp.threshold.value = -13;
      E.comp.knee.value = 9;
      E.comp.ratio.value = 10;
      E.comp.attack.value = 0.0025;
      E.comp.release.value = 0.17;
    } catch (e) { /* older impls expose read-only props */ }

    /* hard ceiling after the compressor: guarantees |sample| < 1 */
    E.limiter = ctx.createWaveShaper();
    E.limiter.curve = makeLimitCurve(0.55, 0.965);
    E.limiter.oversample = '4x';

    E.master.connect(E.dcHP);
    E.dcHP.connect(E.comp);
    E.comp.connect(E.limiter);
    E.limiter.connect(ctx.destination);
    E.tap = E.limiter;          // analyser attach point

    E.musicBus = ctx.createGain();
    E.musicBus.gain.value = MUSIC_LEVEL;
    E.musicBus.connect(E.master);

    E.sfxBus = ctx.createGain();
    E.sfxBus.gain.value = SFX_LEVEL;
    E.sfxBus.connect(E.master);

    /* shared reverb on a SEND (never an insert) */
    E.conv = ctx.createConvolver();
    E.conv.normalize = false;
    E.conv.buffer = makeIR(ctx);
    E.revHP = ctx.createBiquadFilter();
    E.revHP.type = 'highpass';
    E.revHP.frequency.value = 180;
    E.revReturn = ctx.createGain();
    E.revReturn.gain.value = REVERB_RETURN;
    E.conv.connect(E.revHP);
    E.revHP.connect(E.revReturn);
    E.revReturn.connect(E.master);

    E.noise = makeNoise(ctx);
    E.curveSoft = makeShaperCurve(6);
    E.curveHard = makeShaperCurve(48);
    return E;
  }

  /* ==================================================================
     4. Voice — every node is stopped AND disconnected on death.
     ================================================================== */
  function Voice(E, chan, vol, owner) {
    this.E = E;
    this.chan = chan;
    this.vol = vol == null ? 1 : vol;
    this.nodes = [];
    this.srcs = [];
    this.pc = [];            /* [sourceNode, AudioParam] connections */
    this.dead = false;
    this.timer = 0;
    this.owner = owner || null;
    this.born = E.ctx.currentTime;
    if (owner) owner.push(this);
  }
  Voice.prototype.add = function (n) {
    this.nodes.push(n);
    if (this.E.live) { _nodeCount++; if (this.chan === 'sfx') _sfxNodes++; }
    return n;
  };
  Voice.prototype.g = function (val) {
    var n = this.E.ctx.createGain();
    n.gain.value = (val == null ? 1 : val);
    return this.add(n);
  };
  Voice.prototype.f = function (type, freq, q) {
    var n = this.E.ctx.createBiquadFilter();
    n.type = type || 'lowpass';
    n.frequency.value = freq || 1000;
    if (q != null) n.Q.value = q;
    return this.add(n);
  };
  Voice.prototype.o = function (type, freq) {
    var n = this.E.ctx.createOscillator();
    n.type = type || 'sine';
    n.frequency.value = freq || 440;
    this.srcs.push(n);
    return this.add(n);
  };
  Voice.prototype.nz = function (rate) {
    var n = this.E.ctx.createBufferSource();
    n.buffer = this.E.noise;
    n.loop = true;
    n.playbackRate.value = rate || 1;
    this.srcs.push(n);
    return this.add(n);
  };
  Voice.prototype.shape = function (hard) {
    var n = this.E.ctx.createWaveShaper();
    n.curve = hard ? this.E.curveHard : this.E.curveSoft;
    n.oversample = '2x';
    return this.add(n);
  };
  Voice.prototype.delay = function (time) {
    var n = this.E.ctx.createDelay(1.0);
    n.delayTime.value = time || 0.01;
    return this.add(n);
  };
  Voice.prototype.at = function (n, t, off) {
    try {
      if (n.buffer) n.start(t, off == null ? rnd() * 1.4 : off);
      else n.start(t);
    } catch (e) { /* already started */ }
    return n;
  };
  Voice.prototype.pconn = function (src, param) {
    try { src.connect(param); this.pc.push([src, param]); } catch (e) {}
  };
  Voice.prototype.finish = function (end) {
    var self = this;
    this.endAt = end;
    for (var i = 0; i < this.srcs.length; i++) {
      try { this.srcs[i].stop(end); } catch (e) {}
    }
    var last = this.srcs[this.srcs.length - 1];
    if (last) last.onended = function () { self.kill(); };
    if (this.E.live) {
      var ms = Math.max(0, (end - this.E.ctx.currentTime)) * 1000 + 350;
      this.timer = global.setTimeout(function () { self.kill(); }, ms);
    }
  };
  Voice.prototype.fadeKill = function (fade) {
    if (this.dead) return;
    var self = this, t = this.E.ctx.currentTime;
    if (this.out) {
      try {
        this.out.gain.cancelScheduledValues(t);
        this.out.gain.setValueAtTime(Math.max(this.out.gain.value, 0.0001), t);
        this.out.gain.exponentialRampToValueAtTime(0.00008, t + fade);
      } catch (e) {}
    }
    global.setTimeout(function () { self.kill(); }, fade * 1000 + 30);
  };
  Voice.prototype.kill = function () {
    if (this.dead) return;
    this.dead = true;
    if (this.timer) { global.clearTimeout(this.timer); this.timer = 0; }
    var i;
    for (i = 0; i < this.srcs.length; i++) {
      try { this.srcs[i].onended = null; } catch (e) {}
      try { this.srcs[i].stop(); } catch (e) {}
    }
    for (i = 0; i < this.pc.length; i++) {
      try { this.pc[i][0].disconnect(this.pc[i][1]); } catch (e) {}
    }
    for (i = 0; i < this.nodes.length; i++) {
      try { this.nodes[i].disconnect(); } catch (e) {}
      if (this.E.live) { _nodeCount--; if (this.chan === 'sfx') _sfxNodes--; }
    }
    this.nodes.length = 0; this.srcs.length = 0; this.pc.length = 0;
    if (this.owner) {
      var k = this.owner.indexOf(this);
      if (k >= 0) this.owner.splice(k, 1);
      this.owner = null;
    }
  };

  function makePan(E, v, pan) {
    var ctx = E.ctx, n;
    if (ctx.createStereoPanner) {
      n = ctx.createStereoPanner();
      n.pan.value = clamp(pan || 0, -1, 1);
    } else if (ctx.createPanner) {
      n = ctx.createPanner();
      try {
        n.panningModel = 'equalpower';
        var p = clamp(pan || 0, -1, 1);
        if (n.positionX) { n.positionX.value = p; n.positionY.value = 0; n.positionZ.value = 1 - Math.abs(p) * 0.5; }
        else n.setPosition(p, 0, 1 - Math.abs(p) * 0.5);
      } catch (e) {}
    } else {
      n = ctx.createGain();
    }
    return v.add(n);
  }

  /* ==================================================================
     5. Reusable timbre builders
     ================================================================== */
  /* metallic / bell partials — inharmonic ratios, per-partial decay */
  var BELL_RATIOS = [1.0, 2.01, 2.98, 4.16, 5.43, 6.79];
  function bell(v, dest, t, freq, dur, amp, bright, ratios) {
    var R = ratios || BELL_RATIOS;
    var n = bright ? R.length : 4;
    for (var i = 0; i < n; i++) {
      var o = v.o(i === 0 ? 'sine' : 'sine', freq * R[i]);
      o.detune.value = (rnd() * 2 - 1) * 6;
      var g = v.g(0);
      var a = amp * Math.pow(0.55, i) * (i === 0 ? 1 : 0.85);
      ampEnv(g.gain, t, a, 0.004 + i * 0.0012, dur * Math.pow(0.72, i));
      o.connect(g); g.connect(dest);
      v.at(o, t);
    }
    /* strike transient */
    var nzs = v.nz(1);
    var nf = v.f('bandpass', freq * 4.2, 3);
    var ng = v.g(0);
    ampEnv(ng.gain, t, amp * 0.5, 0.001, 0.028);
    nzs.connect(nf); nf.connect(ng); ng.connect(dest);
    v.at(nzs, t);
    return dur;
  }

  /* FM voice: mod -> carrier.frequency */
  function fmVoice(v, dest, t, carrier, ratio, index, atk, dec, amp, wave) {
    var c = v.o(wave || 'sine', carrier);
    var m = v.o('sine', carrier * ratio);
    var mg = v.g(carrier * index);
    ampEnv(mg.gain, t, carrier * index, 0.002, dec * 0.55);
    m.connect(mg); mg.connect(c.frequency);
    var g = v.g(0);
    ampEnv(g.gain, t, amp, atk, dec);
    c.connect(g); g.connect(dest);
    v.at(c, t); v.at(m, t);
    return { car: c, gain: g, out: g };
  }

  function noiseBurst(v, dest, t, dur, amp, ftype, f0, f1, q, atk) {
    var s = v.nz(1);
    var f = v.f(ftype || 'bandpass', f0, q == null ? 1 : q);
    if (f1 != null && f1 !== f0) sweep(f.frequency, t, f0, f1, dur);
    var g = v.g(0);
    ampEnv(g.gain, t, amp, atk == null ? 0.003 : atk, dur);
    s.connect(f); f.connect(g); g.connect(dest);
    v.at(s, t);
    return { src: s, filt: f, gain: g };
  }

  function thump(v, dest, t, f0, f1, dur, amp, wave) {
    var o = v.o(wave || 'sine', f0);
    sweep(o.frequency, t, f0, f1, dur * 0.7);
    var g = v.g(0);
    ampEnv(g.gain, t, amp, 0.004, dur);
    o.connect(g); g.connect(dest);
    v.at(o, t);
    return { osc: o, gain: g };
  }

  /* ==================================================================
     6. SFX definitions.  fn(E, v, t, r) -> duration (seconds)
        `v.dry` is the voice output; `v.wet(amount)` opens a reverb send.
     ================================================================== */
  var SFX = {};

  SFX.step = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.13);
    /* marble tap: tight bandpassed click + tiny body thud */
    noiseBurst(v, d, t, 0.045, 0.55, 'bandpass', 2100 * r, 1250 * r, 2.2, 0.0012);
    noiseBurst(v, d, t, 0.016, 0.30, 'highpass', 5200 * r, 6400 * r, 0.7, 0.0006);
    thump(v, d, t, 168 * r, 96 * r, 0.06, 0.22);
    return 0.11;
  };

  SFX.stepCarpet = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.05);
    noiseBurst(v, d, t, 0.075, 0.42, 'lowpass', 900 * r, 420 * r, 1.1, 0.004);
    thump(v, d, t, 120 * r, 72 * r, 0.08, 0.20);
    return 0.12;
  };

  SFX.dash = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.18);
    var s = v.nz(1.0);
    var bp = v.f('bandpass', 380, 3.4);
    bp.frequency.setValueAtTime(360 * r, t);
    bp.frequency.exponentialRampToValueAtTime(2900 * r, t + 0.10);
    bp.frequency.exponentialRampToValueAtTime(520 * r, t + 0.34);
    var g = v.g(0);
    susEnv(g.gain, t, 0.5, 0.02, 0.05, 0.24);
    s.connect(bp); bp.connect(g); g.connect(d);
    v.at(s, t);
    /* body: falling detuned saw pair */
    for (var i = 0; i < 2; i++) {
      var o = v.o('sawtooth', 260 * r);
      o.detune.value = i ? 11 : -9;
      sweep(o.frequency, t, 300 * r, 90 * r, 0.28);
      var lp = v.f('lowpass', 1400, 4);
      sweep(lp.frequency, t, 2200, 400, 0.3);
      var og = v.g(0);
      ampEnv(og.gain, t, 0.16, 0.012, 0.26);
      o.connect(lp); lp.connect(og); og.connect(d);
      v.at(o, t);
    }
    return 0.4;
  };

  SFX.uiClick = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.07);
    fmVoice(v, d, t, 940 * r, 2.41, 1.6, 0.002, 0.055, 0.30);
    noiseBurst(v, d, t, 0.014, 0.22, 'highpass', 3600, 5200, 0.8, 0.0006);
    return 0.09;
  };

  SFX.uiBack = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.09);
    fmVoice(v, d, t, 620 * r, 1.99, 1.1, 0.003, 0.07, 0.26);
    fmVoice(v, d, t + 0.055, 414 * r, 1.99, 1.3, 0.003, 0.10, 0.24);
    return 0.18;
  };

  SFX.uiHover = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.05);
    fmVoice(v, d, t, 1560 * r, 3.02, 0.7, 0.0015, 0.038, 0.17);
    noiseBurst(v, d, t, 0.010, 0.09, 'bandpass', 5200 * r, 6600 * r, 3, 0.0005);
    return 0.06;
  };

  /* ---- the signature sound ---------------------------------------- */
  SFX.rewind = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.42);
    var SW = 0.50;   /* swell length */

    /* Shape contract: EVERYTHING before the clunk swells from near-silence
       so the whole gesture reads as one intake of breath. The offline
       harness asserts the RMS envelope rises then falls. */
    function swellTo(p, peak, start) {
      /* 3-segment concave rise: audible early, still clearly building */
      p.cancelScheduledValues(t);
      p.setValueAtTime(0.00008, t);
      p.exponentialRampToValueAtTime(peak * (start || 0.035), t + SW * 0.30);
      p.exponentialRampToValueAtTime(peak * 0.34, t + SW * 0.70);
      p.exponentialRampToValueAtTime(peak, t + SW);
    }

    /* (a) reversed swell — filtered noise rising in gain AND pitch */
    var s = v.nz(0.72);
    sweep(s.playbackRate, t, 0.62, 1.9, SW);
    var bp = v.f('bandpass', 220, 1.5);
    sweep(bp.frequency, t, 220, 4200, SW);
    var sg = v.g(0.00008);
    swellTo(sg.gain, 0.40);
    sg.gain.exponentialRampToValueAtTime(0.00008, t + SW + 0.13);
    s.connect(bp); bp.connect(sg); sg.connect(d);
    v.at(s, t, 0.2);

    /* (b) detuned saws rising with the swell */
    for (var i = 0; i < 3; i++) {
      var o = v.o('sawtooth', 74);
      o.detune.value = (i - 1) * 14;
      sweep(o.frequency, t, 74 * (1 + i * 0.005), 430, SW);
      var lp = v.f('lowpass', 300, 7);
      sweep(lp.frequency, t, 300, 3400, SW);
      var og = v.g(0.00008);
      swellTo(og.gain, 0.13);
      og.gain.exponentialRampToValueAtTime(0.00008, t + SW + 0.10);
      o.connect(lp); lp.connect(og); og.connect(d);
      v.at(o, t);
    }

    /* (c) counter-motion: descending resonant sweep, also swelling */
    var o2 = v.o('triangle', 2400);
    sweep(o2.frequency, t, 2400, 118, SW + 0.16);
    var lp2 = v.f('lowpass', 4000, 11);
    sweep(lp2.frequency, t, 5200, 260, SW + 0.16);
    var g2 = v.g(0);
    swellTo(g2.gain, 0.20, 0.10);
    g2.gain.exponentialRampToValueAtTime(0.00008, t + SW + 0.22);
    o2.connect(lp2); lp2.connect(g2); g2.connect(d);
    v.at(o2, t);

    /* (c2) chrono flutter: a ring-modulated tremble that speeds up into
       the clunk — this is what sells "time is being rewound" */
    var fl = v.o('sine', 210);
    var flMul = v.g(0);
    var flLfo = v.o('square', 7);
    var flLfoG = v.g(0.9);
    flLfo.connect(flLfoG); flLfoG.connect(flMul.gain);
    v.pc.push([flLfoG, flMul.gain]);
    sweep(flLfo.frequency, t, 6, 46, SW);
    sweep(fl.frequency, t, 190, 470, SW);
    var flBp = v.f('bandpass', 900, 4);
    sweep(flBp.frequency, t, 700, 2600, SW);
    var flG = v.g(0);
    swellTo(flG.gain, 0.10, 0.06);
    flG.gain.exponentialRampToValueAtTime(0.00008, t + SW + 0.09);
    fl.connect(flMul); flMul.connect(flBp); flBp.connect(flG); flG.connect(d);
    v.at(fl, t); v.at(flLfo, t);

    /* (d) bright metallic clunk at the end of the swell. Partials are
       started a few hundred µs apart so they cannot sum in phase into a
       clipping spike. */
    var ct = t + SW;
    bell(v, d, ct, 288, 0.62, 0.26, true, [1, 1.73, 2.44, 3.61, 5.02, 7.13]);
    noiseBurst(v, d, ct, 0.10, 0.30, 'highpass', 2600, 900, 0.9, 0.001);
    thump(v, d, ct, 190, 62, 0.16, 0.24);
    /* shimmer tail into the hall */
    noiseBurst(v, d, ct + 0.02, 0.55, 0.09, 'bandpass', 7200, 3600, 5, 0.02);

    return SW + 0.85;
  };

  SFX.echoSpawn = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.48);
    /* materialising cluster: three detuned sines gliding up to a fifth */
    var base = 330 * r;
    for (var i = 0; i < 3; i++) {
      var o = v.o('sine', base * [0.5, 0.75, 1.0][i]);
      o.detune.value = (i - 1) * 9;
      sweep(o.frequency, t, base * [0.5, 0.75, 1.0][i] * 0.72, base * [1, 1.5, 2][i], 0.30);
      var g = v.g(0);
      susEnv(g.gain, t, 0.15 - i * 0.03, 0.06, 0.06, 0.42);
      o.connect(g); g.connect(d);
      v.at(o, t);
    }
    /* holo flutter: amplitude-gated noise through a high bandpass */
    var s = v.nz(1.25);
    var bp = v.f('bandpass', 1800, 6);
    sweep(bp.frequency, t, 1200, 5400, 0.34);
    var ng = v.g(0);
    ampEnv(ng.gain, t, 0.16, 0.02, 0.42);
    var trem = v.o('square', 27);
    var tg = v.g(0.55);
    trem.connect(tg); v.pc.push([tg, ng.gain]); tg.connect(ng.gain);
    v.at(trem, t);
    s.connect(bp); bp.connect(ng); ng.connect(d);
    v.at(s, t);
    return 0.62;
  };

  SFX.echoDesync = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.30);
    /* granular glitch stutter */
    var grains = 11;
    for (var i = 0; i < grains; i++) {
      var gt = t + i * 0.026 + rr(-0.004, 0.004);
      var gl = rr(0.014, 0.036);
      var s = v.nz(rr(0.55, 2.6));
      var bp = v.f('bandpass', rr(500, 4200), rr(3, 12));
      var g = v.g(0);
      /* hard-gated grain, but with a 1ms micro-fade so it never clicks */
      var pk = rr(0.12, 0.30);
      g.gain.setValueAtTime(0.00008, gt);
      g.gain.linearRampToValueAtTime(pk, gt + 0.0012);
      g.gain.setValueAtTime(pk, gt + gl);
      g.gain.linearRampToValueAtTime(0.00008, gt + gl + 0.0018);
      s.connect(bp); bp.connect(g); g.connect(d);
      v.at(s, gt, rnd() * 1.6);
    }
    /* ring-modulated tonal shard collapsing in pitch */
    var o = v.o('square', 620 * r);
    var ring = v.o('sine', 173);
    var rg = v.g(0);
    sweep(o.frequency, t, 700 * r, 190 * r, 0.34);
    var mult = v.g(0);
    o.connect(mult);
    v.pc.push([rg, mult.gain]);
    ring.connect(rg); rg.gain.value = 0.9; rg.connect(mult.gain);
    var lp = v.f('lowpass', 2600, 3);
    var og = v.g(0);
    ampEnv(og.gain, t, 0.20, 0.004, 0.34);
    mult.connect(lp); lp.connect(og); og.connect(d);
    v.at(o, t); v.at(ring, t);
    return 0.42;
  };

  SFX.plateDown = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.20);
    thump(v, d, t, 124 * r, 58 * r, 0.20, 0.42);
    noiseBurst(v, d, t, 0.05, 0.26, 'lowpass', 1500, 500, 1.2, 0.001);
    bell(v, d, t + 0.006, 430 * r, 0.16, 0.10, false, [1, 2.7, 4.1, 6.3]);
    return 0.30;
  };

  SFX.plateUp = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.18);
    thump(v, d, t, 190 * r, 260 * r, 0.09, 0.20);
    noiseBurst(v, d, t, 0.07, 0.20, 'bandpass', 1900, 3200, 2.4, 0.002);
    bell(v, d, t + 0.01, 720 * r, 0.20, 0.09, false, [1, 2.4, 3.9, 5.6]);
    return 0.30;
  };

  SFX.doorOpen = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.30);
    var DUR = 0.72;
    /* servo rumble: saw through a slowly opening resonant lowpass + LFO */
    var o = v.o('sawtooth', 54 * r);
    sweep(o.frequency, t, 46 * r, 72 * r, DUR);
    var lp = v.f('lowpass', 200, 6);
    sweep(lp.frequency, t, 170, 900, DUR * 0.8);
    var lfo = v.o('sine', 17);
    var lg = v.g(90);
    lfo.connect(lg); lg.connect(lp.frequency); v.pc.push([lg, lp.frequency]);
    var g = v.g(0);
    susEnv(g.gain, t, 0.30, 0.09, DUR * 0.55, 0.22);
    o.connect(lp); lp.connect(g); g.connect(d);
    v.at(o, t); v.at(lfo, t);
    /* stone-on-stone grind */
    noiseBurst(v, d, t + 0.02, DUR * 0.8, 0.16, 'bandpass', 620, 1500, 1.6, 0.10);
    /* seating clack */
    bell(v, d, t + DUR, 300, 0.30, 0.16, false, [1, 2.1, 3.4, 5.1]);
    thump(v, d, t + DUR, 110, 52, 0.16, 0.22);
    return DUR + 0.5;
  };

  SFX.doorClose = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.34);
    var DUR = 0.52;
    var o = v.o('sawtooth', 68 * r);
    sweep(o.frequency, t, 70 * r, 44 * r, DUR);
    var lp = v.f('lowpass', 700, 5);
    sweep(lp.frequency, t, 800, 170, DUR);
    var g = v.g(0);
    susEnv(g.gain, t, 0.28, 0.05, DUR * 0.5, 0.16);
    o.connect(lp); lp.connect(g); g.connect(d);
    v.at(o, t);
    noiseBurst(v, d, t, DUR * 0.9, 0.14, 'bandpass', 1400, 480, 1.4, 0.06);
    /* heavy clunk */
    var ct = t + DUR;
    thump(v, d, ct, 130, 44, 0.26, 0.50);
    bell(v, d, ct, 214, 0.40, 0.20, true, [1, 1.81, 2.66, 3.92, 5.5, 7.7]);
    noiseBurst(v, d, ct, 0.09, 0.24, 'lowpass', 2400, 700, 0.9, 0.001);
    return DUR + 0.7;
  };

  SFX.terminalBeep = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.14);
    fmVoice(v, d, t, 720 * r, 3.01, 0.9, 0.003, 0.085, 0.24, 'square');
    noiseBurst(v, d, t, 0.012, 0.10, 'highpass', 4200, 5200, 0.7, 0.0006);
    return 0.14;
  };

  SFX.terminalDone = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.30);
    var notes = [587.33, 783.99, 1174.66];   /* D5 G5 D6 */
    for (var i = 0; i < 3; i++) {
      var nt = t + i * 0.075;
      fmVoice(v, d, nt, notes[i] * r, 2.0, 0.55, 0.004, i === 2 ? 0.42 : 0.13, 0.22);
      bell(v, d, nt, notes[i] * r, i === 2 ? 0.5 : 0.16, 0.09, false, [1, 2.01, 3.02, 4.4]);
    }
    return 0.75;
  };

  SFX.laserOn = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.26);
    /* rising resonant zap */
    var o = v.o('sawtooth', 170 * r);
    sweep(o.frequency, t, 150 * r, 640 * r, 0.20);
    var bp = v.f('bandpass', 200, 14);
    sweep(bp.frequency, t, 200, 3600, 0.20);
    var g = v.g(0);
    susEnv(g.gain, t, 0.26, 0.014, 0.09, 0.16);
    o.connect(bp); bp.connect(g); g.connect(d);
    v.at(o, t);
    /* settles into a short beating hum (kept brief — blinking lasers
       re-trigger this constantly and a long drone turns to mud) */
    var ht = t + 0.13;
    for (var i = 0; i < 2; i++) {
      var h = v.o(i ? 'triangle' : 'sawtooth', (i ? 240.9 : 120) * r);
      h.detune.value = i ? 7 : -5;
      var hf = v.f('lowpass', 900, 2);
      sweep(hf.frequency, ht, 1400, 520, 0.34);
      var hg = v.g(0);
      susEnv(hg.gain, ht, i ? 0.030 : 0.048, 0.09, 0.16, 0.24);
      h.connect(hf); hf.connect(hg); hg.connect(d);
      v.at(h, ht);
    }
    noiseBurst(v, d, t, 0.12, 0.09, 'highpass', 3000, 6000, 0.8, 0.006);
    return 0.72;
  };

  SFX.laserOff = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.22);
    var o = v.o('sawtooth', 520 * r);
    sweep(o.frequency, t, 520 * r, 88 * r, 0.26);
    var bp = v.f('bandpass', 2600, 9);
    sweep(bp.frequency, t, 2600, 260, 0.26);
    var g = v.g(0);
    susEnv(g.gain, t, 0.22, 0.008, 0.06, 0.22);
    o.connect(bp); bp.connect(g); g.connect(d);
    v.at(o, t);
    noiseBurst(v, d, t, 0.24, 0.09, 'lowpass', 3200, 500, 1.1, 0.004);
    return 0.42;
  };

  SFX.laserHit = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.24);
    /* harsh ring-modulated discharge through a soft clipper */
    var sh = v.shape(true);
    var o = v.o('sawtooth', 320 * r);
    sweep(o.frequency, t, 420 * r, 130 * r, 0.22);
    var ring = v.o('square', 143);
    var mult = v.g(0);
    var rg = v.g(0.85);
    ring.connect(rg); rg.connect(mult.gain); v.pc.push([rg, mult.gain]);
    o.connect(mult);
    var bp = v.f('bandpass', 1500, 2.2);
    sweep(bp.frequency, t, 2600, 700, 0.22);
    var g = v.g(0);
    ampEnv(g.gain, t, 0.34, 0.002, 0.26);
    mult.connect(bp); bp.connect(sh); sh.connect(g); g.connect(d);
    v.at(o, t); v.at(ring, t);
    noiseBurst(v, d, t, 0.10, 0.26, 'highpass', 1800, 4200, 1.0, 0.001);
    thump(v, d, t, 150, 48, 0.18, 0.24);
    return 0.42;
  };

  SFX.alarm = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.38);
    var pitches = [622.25, 466.16];      /* Eb5 / Bb4 klaxon */
    var seg = 0.34;
    for (var i = 0; i < 4; i++) {
      var st = t + i * seg;
      var f = pitches[i % 2] * r;
      /* two slightly detuned saws -> audible phasing beat */
      for (var k = 0; k < 2; k++) {
        var o = v.o('sawtooth', f);
        o.detune.value = k ? 11 : -11;
        var bp = v.f('bandpass', f * 1.6, 3.2);
        var g = v.g(0);
        susEnv(g.gain, st, 0.15, 0.022, seg * 0.52, seg * 0.35);
        o.connect(bp); bp.connect(g); g.connect(d);
        v.at(o, st);
      }
      /* horn body */
      var sub = v.o('square', f * 0.5);
      var sg = v.g(0);
      var slp = v.f('lowpass', 1200, 1.4);
      susEnv(sg.gain, st, 0.075, 0.02, seg * 0.5, seg * 0.35);
      sub.connect(slp); slp.connect(sg); sg.connect(d);
      v.at(sub, st);
    }
    return seg * 4 + 0.5;
  };

  SFX.sentryPing = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.55);
    var o = v.o('sine', 1320 * r);
    o.detune.value = rr(-7, 7);
    sweep(o.frequency, t, 1420 * r, 1180 * r, 0.5);
    var bp = v.f('bandpass', 1400 * r, 1.4);
    sweep(bp.frequency, t, 2600 * r, 900 * r, 0.42);
    var g = v.g(0);
    ampEnv(g.gain, t, 0.20, 0.005, 0.55);
    o.connect(bp); bp.connect(g); g.connect(d);
    v.at(o, t);
    fmVoice(v, d, t, 1980 * r, 1.5, 0.35, 0.004, 0.30, 0.07);
    /* sonar air: a whisper of filtered noise riding the ping */
    noiseBurst(v, d, t, 0.30, 0.045, 'bandpass', 2400 * r, 4200 * r, 6, 0.012);
    return 0.8;
  };

  SFX.sentrySpot = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.34);
    /* brassy minor-2nd stab, twice */
    for (var i = 0; i < 2; i++) {
      var st = t + i * 0.14;
      for (var k = 0; k < 2; k++) {
        var f = (k ? 466.16 : 440) * r;
        var o = v.o('sawtooth', f);
        o.detune.value = k ? 8 : -8;
        var lp = v.f('lowpass', 900, 6);
        sweep(lp.frequency, st, 3200, 800, 0.16);
        var g = v.g(0);
        ampEnv(g.gain, st, 0.17, 0.005, 0.17);
        o.connect(lp); lp.connect(g); g.connect(d);
        v.at(o, st);
      }
    }
    thump(v, d, t, 180, 70, 0.2, 0.22);
    return 0.5;
  };

  SFX.relicGrab = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.52);
    /* bright bell arpeggio: Eb6 G6 Bb6 Eb7 */
    var arp = [1244.51, 1567.98, 1864.66, 2489.02];
    for (var i = 0; i < arp.length; i++) {
      var nt = t + i * 0.055;
      bell(v, d, nt, arp[i] * r, 0.55 - i * 0.06, 0.14, true);
    }
    /* shimmer: tremolo'd high noise band */
    var s = v.nz(1.5);
    var bp = v.f('bandpass', 6800, 4);
    sweep(bp.frequency, t, 5200, 9500, 0.5);
    var g = v.g(0);
    susEnv(g.gain, t, 0.075, 0.05, 0.15, 0.45);
    var trem = v.o('sine', 19);
    var tg = v.g(0.5);
    trem.connect(tg); tg.connect(g.gain); v.pc.push([tg, g.gain]);
    s.connect(bp); bp.connect(g); g.connect(d);
    v.at(s, t); v.at(trem, t);
    return 0.9;
  };

  SFX.relicBig = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.60);
    var arp = [622.25, 932.33, 1244.51, 1567.98, 1864.66, 2489.02];
    for (var i = 0; i < arp.length; i++) {
      bell(v, d, t + i * 0.05, arp[i] * r, 0.95 - i * 0.08, 0.13, true);
    }
    /* gong-ish low swell */
    var o = v.o('sine', 77.78);
    var o2 = v.o('triangle', 155.56);
    var g = v.g(0);
    var g2 = v.g(0);
    susEnv(g.gain, t, 0.24, 0.05, 0.20, 0.9);
    susEnv(g2.gain, t, 0.09, 0.07, 0.18, 0.8);
    var lp = v.f('lowpass', 400, 1.2);
    o.connect(g); o2.connect(g2); g.connect(lp); g2.connect(lp); lp.connect(d);
    v.at(o, t); v.at(o2, t);
    var s = v.nz(1.6);
    var bp = v.f('bandpass', 7600, 3);
    var sg = v.g(0);
    susEnv(sg.gain, t, 0.07, 0.09, 0.2, 0.7);
    s.connect(bp); bp.connect(sg); sg.connect(d);
    v.at(s, t);
    return 1.5;
  };

  SFX.vaultClear = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.62);
    /* Eb major triumph: Bb -> Eb with a bell stack + riser */
    var chord1 = [466.16, 587.33, 698.46];              /* Bb D F */
    var chord2 = [622.25, 783.99, 932.33, 1244.51];     /* Eb G Bb Eb */
    var i;
    for (i = 0; i < chord1.length; i++) bell(v, d, t, chord1[i] * r, 0.6, 0.11, true);
    for (i = 0; i < chord2.length; i++) bell(v, d, t + 0.30, chord2[i] * r, 1.5, 0.12, true);
    /* riser */
    var s = v.nz(1);
    var bp = v.f('bandpass', 500, 3);
    sweep(bp.frequency, t, 500, 8000, 0.30);
    sweep(s.playbackRate, t, 0.8, 1.9, 0.30);
    var g = v.g(0);
    g.gain.setValueAtTime(0.00008, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.29);
    g.gain.exponentialRampToValueAtTime(0.00008, t + 0.55);
    s.connect(bp); bp.connect(g); g.connect(d);
    v.at(s, t);
    /* sub landing */
    thump(v, d, t + 0.30, 155.56, 77.78, 1.1, 0.30);
    return 2.0;
  };

  SFX.fail = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.44);
    /* sinking detuned minor cluster */
    var f = [174.61, 185.0, 233.08];
    for (var i = 0; i < f.length; i++) {
      for (var k = 0; k < 2; k++) {
        var o = v.o('sawtooth', f[i]);
        o.detune.value = k ? 9 : -9;
        sweep(o.frequency, t, f[i], f[i] * 0.5, 1.2);
        var lp = v.f('lowpass', 1200, 3);
        sweep(lp.frequency, t, 1400, 220, 1.2);
        var g = v.g(0);
        susEnv(g.gain, t, 0.10, 0.05, 0.35, 0.85);
        o.connect(lp); lp.connect(g); g.connect(d);
        v.at(o, t);
      }
    }
    noiseBurst(v, d, t, 0.9, 0.10, 'lowpass', 2200, 260, 1.0, 0.05);
    thump(v, d, t + 0.9, 110, 40, 0.4, 0.34);
    return 1.7;
  };

  SFX.countdown = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.16);
    /* woodblock-ish tick */
    noiseBurst(v, d, t, 0.03, 0.32, 'bandpass', 2400 * r, 1500 * r, 8, 0.001);
    fmVoice(v, d, t, 1180 * r, 4.1, 1.2, 0.0015, 0.055, 0.16);
    return 0.1;
  };

  SFX.timeLow = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.30);
    for (var i = 0; i < 2; i++) {
      var st = t + i * 0.17;
      for (var k = 0; k < 2; k++) {
        var f = (k ? 311.13 : 293.66) * r;      /* minor 2nd rub */
        var o = v.o('triangle', f);
        o.detune.value = k ? 6 : -6;
        var g = v.g(0);
        ampEnv(g.gain, st, 0.14, 0.006, 0.20);
        var lp = v.f('lowpass', 1800, 3);
        sweep(lp.frequency, st, 3400, 620, 0.22);
        o.connect(lp); lp.connect(g); g.connect(d);
        v.at(o, st);
      }
      /* mallet click so it reads as a struck clock, not a bare tone */
      noiseBurst(v, d, st, 0.022, 0.16, 'bandpass', 2600 * r, 1700 * r, 6, 0.001);
    }
    return 0.5;
  };

  SFX.glass = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.46);
    noiseBurst(v, d, t, 0.10, 0.34, 'highpass', 2600, 5200, 0.8, 0.0008);
    for (var i = 0; i < 12; i++) {
      var gt = t + rr(0, 0.22);
      var f = rr(1800, 6800) * r;
      var o = v.o('sine', f);
      var g = v.g(0);
      ampEnv(g.gain, gt, rr(0.05, 0.13), 0.001, rr(0.05, 0.28));
      o.connect(g); g.connect(d);
      v.at(o, gt);
    }
    noiseBurst(v, d, t + 0.05, 0.5, 0.09, 'bandpass', 5000, 8500, 3, 0.01);
    return 0.85;
  };

  SFX.steam = function (E, v, t, r) {
    var d = v.dry;
    v.wet(0.24);
    var s = v.nz(1);
    var bp = v.f('bandpass', 1200, 1.1);
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.exponentialRampToValueAtTime(3400, t + 0.18);
    bp.frequency.exponentialRampToValueAtTime(1500, t + 0.8);
    var hp = v.f('highpass', 500, 0.7);
    var g = v.g(0);
    susEnv(g.gain, t, 0.20, 0.06, 0.24, 0.55);
    s.connect(bp); bp.connect(hp); hp.connect(g); g.connect(d);
    v.at(s, t);
    return 0.95;
  };

  /* ==================================================================
     7. Music — patterns
     ================================================================== */
  /* pad voicings (MIDI) + bass walking lines, C minor / dorian */
  var CH = {
    Cm7: [60, 63, 67, 70],
    Fm7: [60, 63, 65, 68],
    Abmaj7: [60, 63, 67, 68],
    G7: [59, 62, 65, 67],
    Dbmaj: [61, 65, 68, 72],
    Ab: [56, 60, 63, 68],
    Bb7: [58, 62, 65, 68],
    Eb: [58, 63, 67, 70],
    Ebhi: [63, 67, 70, 75]
  };

  var HEIST_BASS = [
    [36, 38, 39, 41],
    [43, 41, 39, 38],
    [41, 43, 44, 46],
    [48, 46, 44, 43],
    [44, 46, 48, 46],
    [43, 45, 46, 47],
    [36, 39, 43, 39],
    [41, 39, 38, 35]
  ];
  var HEIST_CHORDS = [CH.Cm7, CH.Cm7, CH.Fm7, CH.Fm7, CH.Abmaj7, CH.G7, CH.Cm7, CH.Cm7];
  /* vibraphone motif: bar -> { step: [midi...] } */
  var HEIST_VIB = [
    { 6: [75, 79] },
    { 12: [72] },
    { 4: [68, 72] },
    { 10: [70, 75] },
    { 0: [68, 72, 75] },
    { 8: [67, 71] },
    { 6: [75, 79], 14: [74] },
    { 2: [79], 5: [77], 8: [75], 11: [72], 14: [70] }   /* bar 7-8 variation */
  ];

  var MENU_CHORDS = [CH.Cm7, CH.Cm7, CH.Abmaj7, CH.Abmaj7, CH.Fm7, CH.Fm7, CH.G7, CH.G7];
  var MENU_VIB = [
    { 8: [72, 79] }, {}, { 4: [75] }, { 12: [70, 77] },
    { 0: [68] }, {}, { 6: [74, 79] }, { 10: [67] }
  ];

  var TENSE_BASS = [[36], [36], [37], [43]];
  var TENSE_CHORDS = [CH.Cm7, CH.Cm7, CH.Dbmaj, CH.G7];
  var TENSE_VIB = [{ 0: [75, 76] }, {}, { 0: [76, 77] }, { 8: [71, 72] }];

  var VICT_CHORDS = [CH.Ab, CH.Bb7, CH.Ebhi];
  var VICT_VIB = [
    { 0: [68], 2: [72], 4: [75], 6: [80] },
    { 0: [70], 2: [74], 4: [77], 6: [82] },
    { 0: [75, 79, 82, 87] }
  ];
  var VICT_BASS = [[44, 44, 44, 44], [46, 46, 46, 46], [51, 51, 51, 51]];

  var TRACKS = {
    menu: {
      bpm: 66, bars: 8, swing: 0.0, style: 'menu',
      chords: MENU_CHORDS, vib: MENU_VIB, bass: null,
      f0: 900, f1: 2600, padLevel: 0.42, vibLevel: 0.26, padCut: [420, 1500]
    },
    heist: {
      bpm: 92, bars: 8, swing: 0.16, style: 'heist',
      chords: HEIST_CHORDS, vib: HEIST_VIB, bass: HEIST_BASS,
      f0: 1100, f1: 7200, padLevel: 0.30, vibLevel: 0.30, padCut: [340, 1400]
    },
    tension: {
      bpm: 116, bars: 4, swing: 0.05, style: 'tension',
      chords: TENSE_CHORDS, vib: TENSE_VIB, bass: TENSE_BASS,
      f0: 2600, f1: 8000, padLevel: 0.30, vibLevel: 0.26, padCut: [700, 2600]
    },
    victory: {
      bpm: 104, bars: 3, swing: 0, style: 'victory', once: true,
      chords: VICT_CHORDS, vib: VICT_VIB, bass: VICT_BASS,
      f0: 6000, f1: 8000, padLevel: 0.34, vibLevel: 0.34, padCut: [900, 3200]
    }
  };

  /* ==================================================================
     8. Music engine
     ================================================================== */
  function newMusic(E, name, tension) {
    var ctx = E.ctx, def = TRACKS[name];
    var m = {
      E: E, name: name, def: def, bar: 0, step: 0,
      nextTime: 0, live: [], nodes: [], srcs: [], dead: false,
      tension: tension || 0, lastBass: 0, chordIdx: -1
    };

    function reg(n) { m.nodes.push(n); return n; }

    m.out = reg(ctx.createGain()); m.out.gain.value = 0.00008;
    m.wet = reg(ctx.createGain()); m.wet.gain.value = 0.00008;
    m.filt = reg(ctx.createBiquadFilter());
    m.filt.type = 'lowpass';
    m.filt.frequency.value = def.f0;
    m.filt.Q.value = 0.6;

    /* Dedicated tape-stop insert. It MUST be separate from m.filt / m.out:
       setTension() runs at 60Hz and calls cancelScheduledValues() on the
       params it owns, which would wipe the rewind sweep mid-flight. */
    m.tapeFilt = reg(ctx.createBiquadFilter());
    m.tapeFilt.type = 'lowpass';
    m.tapeFilt.frequency.value = 20000;
    m.tapeFilt.Q.value = 0.9;
    m.tapeGain = reg(ctx.createGain());
    m.tapeGain.gain.value = 1;

    m.out.connect(m.filt);
    m.filt.connect(m.tapeFilt);
    m.tapeFilt.connect(m.tapeGain);
    m.tapeGain.connect(E.musicBus);
    m.wet.connect(E.conv);

    /* per-part busses so setTension can move them independently */
    function part(level, wetAmt) {
      var g = reg(ctx.createGain());
      g.gain.value = level;
      g.connect(m.out);
      if (wetAmt > 0) {
        var s = reg(ctx.createGain());
        s.gain.value = wetAmt;
        g.connect(s); s.connect(m.wet);
      }
      return g;
    }
    m.gBass = part(0.95, 0.05);
    m.gHat = part(0.55, 0.22);
    m.gVib = part(def.vibLevel, 0.75);
    m.gPad = part(def.padLevel, 0.55);
    m.gShake = part(0.0001, 0.18);
    m.gKick = part(0.0001, 0.10);

    /* shared detune bus — used for the rewind tape-stop wobble */
    if (ctx.createConstantSource) {
      m.detune = reg(ctx.createConstantSource());
      m.detune.offset.value = 0;
      m.srcs.push(m.detune);
      try { m.detune.start(0); } catch (e) {}
    } else {
      m.detune = null;
    }

    /* ---- pad: detuned saw pairs through an LFO'd lowpass ---- */
    var pad = m.pad = { voices: [], cluster: null };
    pad.filter = reg(ctx.createBiquadFilter());
    pad.filter.type = 'lowpass';
    pad.filter.frequency.value = def.padCut[0];
    pad.filter.Q.value = 2.4;
    pad.filter.connect(m.gPad);
    pad.lfo = reg(ctx.createOscillator());
    pad.lfo.type = 'sine';
    pad.lfo.frequency.value = 0.055;
    pad.lfoGain = reg(ctx.createGain());
    pad.lfoGain.gain.value = (def.padCut[1] - def.padCut[0]) * 0.5;
    pad.lfo.connect(pad.lfoGain);
    pad.lfoGain.connect(pad.filter.frequency);
    m.srcs.push(pad.lfo);
    try { pad.lfo.start(0); } catch (e) {}

    function padVoice(gainVal) {
      var vg = reg(ctx.createGain());
      vg.gain.value = gainVal;
      vg.connect(pad.filter);
      var oscs = [];
      for (var k = 0; k < 2; k++) {
        var o = reg(ctx.createOscillator());
        o.type = 'sawtooth';
        o.frequency.value = 220;
        o.detune.value = k ? 8 : -8;
        o.connect(vg);
        m.srcs.push(o);
        if (m.detune) { try { m.detune.connect(o.detune); } catch (e) {} }
        try { o.start(0); } catch (e) {}
        oscs.push(o);
      }
      return { oscs: oscs, gain: vg };
    }
    for (var i = 0; i < 4; i++) pad.voices.push(padVoice(0.16));
    pad.cluster = padVoice(0.00008);     /* dissonant minor-2nd, tension only */

    applyTension(m, m.tension, ctx.currentTime, 0.001);
    return m;
  }

  function musicFadeIn(m, when, dur, target) {
    var g = m.out.gain, w = m.wet.gain;
    target = target == null ? 1 : target;
    g.cancelScheduledValues(when);
    g.setValueAtTime(Math.max(g.value, 0.00008), when);
    g.exponentialRampToValueAtTime(target, when + dur);
    w.cancelScheduledValues(when);
    w.setValueAtTime(Math.max(w.value, 0.00008), when);
    w.exponentialRampToValueAtTime(target * 0.6, when + dur);
  }

  function musicDispose(m, fadeMs) {
    if (!m || m.dead) return;
    m.dead = true;
    var ctx = m.E.ctx, t = ctx.currentTime;
    var fade = Math.max(0.02, (fadeMs == null ? 600 : fadeMs) / 1000);
    try {
      m.out.gain.cancelScheduledValues(t);
      m.out.gain.setValueAtTime(Math.max(m.out.gain.value, 0.00008), t);
      m.out.gain.exponentialRampToValueAtTime(0.00008, t + fade);
      m.wet.gain.cancelScheduledValues(t);
      m.wet.gain.setValueAtTime(Math.max(m.wet.gain.value, 0.00008), t);
      m.wet.gain.exponentialRampToValueAtTime(0.00008, t + fade);
    } catch (e) {}
    global.setTimeout(function () {
      while (m.live.length) m.live[0].kill();
      var i;
      for (i = 0; i < m.srcs.length; i++) { try { m.srcs[i].stop(); } catch (e) {} }
      for (i = 0; i < m.nodes.length; i++) { try { m.nodes[i].disconnect(); } catch (e) {} }
      m.nodes.length = 0; m.srcs.length = 0;
    }, fade * 1000 + 80);
  }

  function applyTension(m, t, when, tc) {
    if (!m || m.dead) return;
    var def = m.def;
    tc = tc == null ? 0.45 : tc;
    var base = def.style === 'tension' ? 1 : 0;
    var T = Math.max(t, base * 0.85);
    function ramp(p, val) {
      try {
        p.cancelScheduledValues(when);
        p.setTargetAtTime(Math.max(val, 0.00008), when, tc);
      } catch (e) {}
    }
    ramp(m.filt.frequency, lerp(def.f0, def.f1, T));
    ramp(m.pad.filter.frequency, lerp(def.padCut[0], def.padCut[1], T * 0.75));
    ramp(m.pad.cluster.gain, 0.00008 + T * T * 0.10);
    ramp(m.gShake.gain, 0.00008 + Math.max(0, T - 0.08) * 0.42);
    ramp(m.gKick.gain, 0.00008 + Math.max(0, T - 0.10) * 0.85);
    ramp(m.gHat.gain, 0.55 + T * 0.28);
    ramp(m.gBass.gain, 0.95 + T * 0.20);
    m.tension = t;
  }

  function setChord(m, notes, when) {
    var pad = m.pad, i;
    for (i = 0; i < pad.voices.length; i++) {
      var f = mtof(notes[i % notes.length] - 12);
      var oscs = pad.voices[i].oscs;
      for (var k = 0; k < oscs.length; k++) {
        try { oscs[k].frequency.setTargetAtTime(f, when, 0.14); } catch (e) {}
      }
    }
    /* the tension cluster sits a minor 2nd above the chord root */
    var cf = mtof(notes[0] - 12 + 1);
    for (i = 0; i < pad.cluster.oscs.length; i++) {
      try { pad.cluster.oscs[i].frequency.setTargetAtTime(cf, when, 0.14); } catch (e) {}
    }
  }

  function mvoice(m, vol) {
    var v = new Voice(m.E, 'music', vol, m.live);
    if (m.detune) v.detuneBus = m.detune;
    return v;
  }
  function mosc(m, v, type, freq) {
    var o = v.o(type, freq);
    if (m.detune) v.pconn(m.detune, o.detune);
    return o;
  }

  /* ---- instruments ---- */
  function playBass(m, t, freq, vel, dur) {
    var v = mvoice(m, vel);
    var o = mosc(m, v, 'sine', freq);
    var o2 = mosc(m, v, 'triangle', freq * 2);
    var lp = v.f('lowpass', 210, 1.4);
    var g = v.g(0), g2 = v.g(0);
    if (m.lastBass > 0) {
      o.frequency.setValueAtTime(m.lastBass, t);
      o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
      o2.frequency.setValueAtTime(m.lastBass * 2, t);
      o2.frequency.exponentialRampToValueAtTime(freq * 2, t + 0.05);
    }
    m.lastBass = freq;
    ampEnv(g.gain, t, 0.52 * vel, 0.014, dur);
    ampEnv(g2.gain, t, 0.10 * vel, 0.010, dur * 0.55);
    o.connect(g); g.connect(lp);
    o2.connect(g2); g2.connect(lp);
    lp.connect(m.gBass);
    v.at(o, t); v.at(o2, t);
    v.finish(t + dur + 0.08);
  }

  function playHat(m, t, vel, open) {
    var v = mvoice(m, vel);
    var s = v.nz(1.0);
    if (m.detune) v.pconn(m.detune, s.detune);
    var bp = v.f('bandpass', open ? 5200 : 7400, open ? 1.2 : 2.0);
    var hp = v.f('highpass', 3200, 0.7);
    var g = v.g(0);
    var dur = open ? 0.16 : 0.055;
    ampEnv(g.gain, t, 0.16 * vel, 0.0016, dur);
    s.connect(bp); bp.connect(hp); hp.connect(g); g.connect(m.gHat);
    v.at(s, t);
    v.finish(t + dur + 0.05);
  }

  function playShaker(m, t, vel) {
    var v = mvoice(m, vel);
    var s = v.nz(1.3);
    if (m.detune) v.pconn(m.detune, s.detune);
    var bp = v.f('highpass', 8200, 0.9);
    var g = v.g(0);
    ampEnv(g.gain, t, 0.12 * vel, 0.001, 0.032);
    s.connect(bp); bp.connect(g); g.connect(m.gShake);
    v.at(s, t);
    v.finish(t + 0.09);
  }

  function playKick(m, t, vel) {
    var v = mvoice(m, vel);
    var o = mosc(m, v, 'sine', 58);
    sweep(o.frequency, t, 62, 36, 0.09);
    var g = v.g(0);
    ampEnv(g.gain, t, 0.55 * vel, 0.005, 0.20);
    var sh = v.shape(false);
    o.connect(g); g.connect(sh); sh.connect(m.gKick);
    v.at(o, t);
    noiseBurst(v, m.gKick, t, 0.02, 0.10 * vel, 'lowpass', 1800, 600, 0.8, 0.001);
    v.finish(t + 0.30);
  }

  /* vibraphone / rhodes hybrid — 3 partials, fast attack, long ring */
  function playVib(m, t, midi, vel) {
    var v = mvoice(m, vel);
    var f = mtof(midi);
    var parts = [[1, 1.0, 1.9], [2.0, 0.34, 1.15], [4.02, 0.13, 0.55], [6.9, 0.05, 0.30]];
    for (var i = 0; i < parts.length; i++) {
      var o = mosc(m, v, 'sine', f * parts[i][0]);
      o.detune.value = (i % 2 ? 5 : -5);
      var g = v.g(0);
      ampEnv(g.gain, t, 0.20 * vel * parts[i][1], 0.004 + i * 0.001, parts[i][2]);
      o.connect(g); g.connect(m.gVib);
      v.at(o, t);
    }
    /* FM shimmer on the fundamental for a rhodes bite */
    var c = mosc(m, v, 'sine', f);
    var md = mosc(m, v, 'sine', f * 14.0);
    var mg = v.g(f * 0.9);
    ampEnv(mg.gain, t, f * 0.9, 0.002, 0.09);
    md.connect(mg); mg.connect(c.frequency);
    var cg = v.g(0);
    ampEnv(cg.gain, t, 0.07 * vel, 0.003, 0.22);
    c.connect(cg); cg.connect(m.gVib);
    v.at(c, t); v.at(md, t);
    /* tremolo (vibraphone motor) */
    v.finish(t + 2.1);
  }

  /* ---- one sequencer step (16th grid) ---- */
  function scheduleStep(m, bar, step, time) {
    var def = m.def, sp = 60 / def.bpm, sd = sp / 4;
    var T = def.style === 'tension' ? Math.max(0.8, m.tension) : m.tension;
    var swing = (step % 4 === 2) ? def.swing * sd : ((step % 4 === 3) ? def.swing * sd * 0.5 : 0);
    var t = time + swing;
    var bi = bar % def.chords.length;

    /* pad chord */
    if (step === 0) setChord(m, def.chords[bi], time);

    /* bass */
    if (def.bass) {
      var pat = def.bass[bar % def.bass.length];
      if (def.style === 'tension') {
        if (step % 2 === 0) {
          var root = pat[0];
          var n = (step % 8 === 0) ? root : (step % 4 === 0 ? root : root + 12);
          playBass(m, time, mtof(n), step % 4 === 0 ? 1 : 0.6, 0.16);
        }
      } else if (def.style === 'victory') {
        if (step % 8 === 0) playBass(m, time, mtof(pat[0]), 1, 0.7);
      } else {
        if (step % 4 === 0) {
          playBass(m, time, mtof(pat[step >> 2]), 0.95, sp * 0.82);
        } else if (step % 4 === 2 && T > 0.34) {
          /* tension: push the walk into eighths with a chromatic approach.
             Velocity eases in from zero so the extra note never pops. */
          var cur = pat[step >> 2];
          var nxt = pat[((step >> 2) + 1) % 4];
          var mid = nxt > cur ? nxt - 1 : (nxt < cur ? nxt + 1 : cur + 12);
          var ease = (T - 0.34) / 0.26;
          if (ease > 1) ease = 1;
          ease = ease * ease * (3 - 2 * ease);
          playBass(m, t, mtof(mid), 0.62 * ease, sp * 0.36);
        }
      }
    }

    /* brushed hats — swung 8ths */
    if (def.style === 'heist') {
      if (step % 2 === 0) {
        var accent = (step % 8 === 4) ? 1.0 : (step % 4 === 0 ? 0.72 : 0.5);
        playHat(m, t, accent, step % 8 === 6);
      }
    } else if (def.style === 'tension') {
      if (step % 2 === 0) playHat(m, t, step % 4 === 0 ? 0.8 : 0.55, false);
    }

    /* 16th shaker — tension layer */
    if (T > 0.08 && def.style !== 'menu' && def.style !== 'victory') {
      playShaker(m, time, (step % 4 === 0 ? 1.0 : 0.55) * Math.min(1, T + 0.15));
    }

    /* heartbeat kick — tension layer (lub-dub, tightening as t rises) */
    if (T > 0.10 && def.style !== 'menu' && def.style !== 'victory') {
      var gap = T > 0.7 ? 2 : 3;
      if (step === 0) playKick(m, time, 1.0);
      else if (step === gap) playKick(m, time, 0.62);
      else if (step === 8) playKick(m, time, 0.85);
      else if (step === 8 + gap) playKick(m, time, 0.52);
      else if (T > 0.85 && (step === 12 || step === 4)) playKick(m, time, 0.35);
    }
    if (def.style === 'victory' && step === 0) playKick(m, time, 0.8);

    /* vibraphone motif */
    var vb = def.vib[bar % def.vib.length];
    if (vb) {
      var hit = vb[step];
      if (hit) {
        for (var i = 0; i < hit.length; i++) {
          playVib(m, t + i * 0.012, hit[i], bar === def.bars - 1 ? 0.85 : 1.0);
        }
      }
    }
  }

  /* ==================================================================
     9. Public API
     ================================================================== */
  var A = PV.Audio = {};

  var E = null;                 /* live engine */
  var M = null;                 /* live music state */
  var _ready = false;
  var _inited = false;
  var _muted = !!PV.store.get(K_MUTE, false);
  var _musVol = clamp01(PV.store.get(K_MUS, 0.75));
  var _sfxVol = clamp01(PV.store.get(K_SFX, 0.9));
  var _tension = 0;
  var _pendingTrack = null;
  var _timer = 0;
  var _lastAt = Object.create(null);
  var _unlocking = false;

  Object.defineProperty(A, 'ready', { get: function () { return _ready; } });
  Object.defineProperty(A, 'ctx', { get: function () { return E ? E.ctx : null; } });
  Object.defineProperty(A, 'track', { get: function () { return M ? M.name : (_pendingTrack || null); } });
  Object.defineProperty(A, 'tension', { get: function () { return _tension; } });
  Object.defineProperty(A, 'muted', {
    get: function () { return _muted; },
    set: function (v) {
      _muted = !!v;
      PV.store.set(K_MUTE, _muted);
      if (E) {
        var t = E.ctx.currentTime;
        E.master.gain.cancelScheduledValues(t);
        E.master.gain.setTargetAtTime(_muted ? 0.00008 : MASTER_LEVEL, t, 0.035);
      }
      PV.emit('audio:muted', { muted: _muted });
    }
  });

  /* Post-limiter analyser tap (for UI visualisers / dev tooling). Lazily
     created; the node has no output connection, which is fine — Chrome
     still pulls it because it is downstream of an active source. */
  A.getAnalyser = function (fft) {
    if (!E) return null;
    if (!E.analyser) {
      E.analyser = E.ctx.createAnalyser();
      E.analyser.fftSize = fft || 2048;
      E.analyser.smoothingTimeConstant = 0.72;
      (E.tap || E.comp).connect(E.analyser);
      /* terminate the branch into a muted sink so every implementation is
         guaranteed to pull it (Chrome would anyway; Safari would not) */
      E.analyserSink = E.ctx.createGain();
      E.analyserSink.gain.value = 0;
      E.analyser.connect(E.analyserSink);
      E.analyserSink.connect(E.ctx.destination);
    }
    return E.analyser;
  };

  A.stats = function () {
    return {
      nodes: _nodeCount,
      sfxNodes: _sfxNodes,
      voices: _sfxVoices.length,
      musicVoices: M ? M.live.length : 0,
      track: M ? M.name : null,
      tension: _tension,
      state: E ? E.ctx.state : 'none',
      time: E ? E.ctx.currentTime : 0
    };
  };

  /* ---- init: wire the event bus only; never touches AudioContext ---- */
  var ACTIVATE_MAP = {
    plate: 'plateDown', lever: 'plateDown', door: 'doorOpen', pressureDoor: 'doorOpen',
    terminal: 'terminalDone', receiver: 'terminalBeep', laser: 'laserOn',
    vent: 'steam', mirror: 'plateUp'
  };
  var DEACTIVATE_MAP = {
    plate: 'plateUp', lever: 'plateUp', door: 'doorClose', pressureDoor: 'doorClose',
    terminal: 'terminalBeep', receiver: 'terminalBeep', laser: 'laserOff',
    vent: 'steam', mirror: 'plateUp'
  };
  /* per-kind tweaks so a blinking laser bank or a chattering receiver does
     not sit on top of the mix */
  var KIND_TRIM = { laser: 0.42, receiver: 0.34, plate: 0.8, lever: 0.9 };
  var DEACT_RATE = { receiver: 0.72, terminal: 0.66 };

  /* Gameplay coordinates are in TILES (PV.TILE is only for rendering).
     Returns {pan, vol} — pan across ~9 tiles, level rolling off past ~7. */
  var _sp = { pan: 0, vol: 1 };
  function spatial(x, y) {
    _sp.pan = 0; _sp.vol = 1;
    try {
      var st = PV.Game && PV.Game.state;
      var p = st && st.player;
      if (!p || typeof x !== 'number') return _sp;
      var dx = x - p.x;
      var dy = (typeof y === 'number' ? y - p.y : 0);
      _sp.pan = clamp(dx / 9, -1, 1) * 0.75;
      var d = Math.sqrt(dx * dx + dy * dy);
      /* inverse-ish rolloff, floored so nothing ever vanishes completely */
      _sp.vol = clamp(1 / (1 + Math.max(0, d - 3) * 0.16), 0.22, 1);
    } catch (e) { _sp.pan = 0; _sp.vol = 1; }
    return _sp;
  }
  function panFor(x) { return spatial(x, undefined).pan; }

  A.init = function () {
    if (_inited) return;
    _inited = true;

    PV.on('player:step', function (p) {
      p = p || {};
      var s = spatial(p.x, p.y);
      A.sfx(p.surface === 'carpet' || p.surface === 'rug' ? 'stepCarpet' : 'step',
        { pan: s.pan * 0.4, rate: 0.94 + rnd() * 0.12, vol: 0.85 * s.vol });
    });
    PV.on('player:dash', function (p) {
      p = p || {};
      A.sfx('dash', { pan: panFor(p.x) * 0.4 });
    });
    PV.on('loop:rewind', function () { A.sfx('rewind', { vol: 1 }); });
    PV.on('echo:spawn', function (p) { p = p || {}; A.sfx('echoSpawn', { pan: panFor(p.x) }); });
    PV.on('echo:desync', function (p) { p = p || {}; A.sfx('echoDesync', { pan: panFor(p.x) }); });
    PV.on('device:activate', function (p) {
      p = p || {};
      var s = spatial(p.x, p.y);
      A.sfx(ACTIVATE_MAP[p.kind] || 'plateDown',
        { pan: s.pan, vol: s.vol * (KIND_TRIM[p.kind] || 1) });
    });
    PV.on('device:deactivate', function (p) {
      p = p || {};
      var s = spatial(p.x, p.y);
      A.sfx(DEACTIVATE_MAP[p.kind] || 'plateUp',
        { pan: s.pan, vol: s.vol * (KIND_TRIM[p.kind] || 1) * 0.85,
          rate: DEACT_RATE[p.kind] || 1 });
    });
    PV.on('laser:hit', function (p) { p = p || {}; A.sfx('laserHit', { pan: panFor(p.x) }); });
    PV.on('sentry:spot', function (p) {
      p = p || {};
      var s = spatial(p.x, p.y);
      A.sfx('sentrySpot', { pan: s.pan, vol: 0.55 + s.vol * 0.45 });
    });
    /* sentry:alert is informational only — game.js owns setTension() */
    PV.on('sentry:alert', function (p) {
      p = p || {};
      var lv = typeof p.level === 'number' ? p.level : 0;
      var s = spatial(p.x, p.y);
      if (lv >= 0.995) A.sfx('alarm');
      else if (lv > 0.25) A.sfx('sentryPing', { pan: s.pan, vol: (0.35 + lv * 0.4) * s.vol });
    });
    PV.on('relic:grab', function (p) {
      p = p || {};
      A.sfx((p.value || 0) >= 500 ? 'relicBig' : 'relicGrab', { pan: panFor(p.x) });
    });
    PV.on('vault:clear', function () { A.sfx('vaultClear'); A.playMusic('victory'); });
    PV.on('run:over', function () { A.sfx('fail'); A.stopMusic(900); });
    PV.on('ui:sfx', function (p) { if (p && p.name) A.sfx(p.name, p); });

    /* cheap tick listener: last-5-seconds countdown ticks */
    var lastSec = -1;
    PV.on('loop:tick', function (p) {
      if (!p || !_ready) return;
      var s = Math.ceil(p.ticksLeft / 120);
      if (s === lastSec) return;
      lastSec = s;
      if (s > 0 && s <= 3) A.sfx('countdown', { vol: 0.6, rate: 1 + (3 - s) * 0.06 });
      else if (s === 5) A.sfx('timeLow', { vol: 0.5 });
    });
  };

  /* ---- unlock ---- */
  A.unlock = function () {
    if (_ready) {
      if (E && E.ctx.state === 'suspended') { try { E.ctx.resume(); } catch (e) {} }
      return true;
    }
    if (_unlocking) return false;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    _unlocking = true;
    try {
      var ctx = new AC({ latencyHint: 'interactive' });
      E = makeEngine(ctx, true);
    } catch (err) {
      _unlocking = false;
      if (global.console) console.warn('[PV.Audio] unlock failed', err);
      return false;
    }
    _unlocking = false;
    _ready = true;
    if (!_inited) A.init();

    /* apply persisted mix */
    E.master.gain.value = _muted ? 0.00008 : MASTER_LEVEL;
    E.musicBus.gain.value = MUSIC_LEVEL * _musVol;
    E.sfxBus.gain.value = SFX_LEVEL * _sfxVol;

    if (E.ctx.state === 'suspended') {
      try {
        var p = E.ctx.resume();
        if (p && p.then) p.catch(function () {});
      } catch (e) {}
    }
    /* a silent 1-sample blip satisfies the iOS unlock heuristic */
    try {
      var b = E.ctx.createBufferSource();
      b.buffer = E.ctx.createBuffer(1, 1, E.ctx.sampleRate);
      b.connect(E.ctx.destination);
      b.start(0);
      b.onended = function () { try { b.disconnect(); } catch (e) {} };
    } catch (e) {}

    if (!_timer) _timer = global.setInterval(schedulerTick, LOOKAHEAD_MS);

    if (_pendingTrack) {
      var pt = _pendingTrack;
      _pendingTrack = null;
      A.playMusic(pt);
    }
    PV.emit('audio:ready', {});
    return true;
  };

  A.suspend = function () {
    if (E && E.ctx.state === 'running') { try { E.ctx.suspend(); } catch (e) {} }
  };
  A.resume = function () {
    if (E && E.ctx.state !== 'running') { try { E.ctx.resume(); } catch (e) {} }
  };

  A.setMusicVolume = function (v) {
    _musVol = clamp01(typeof v === 'number' ? v : 0);
    PV.store.set(K_MUS, _musVol);
    if (E) {
      var t = E.ctx.currentTime;
      E.musicBus.gain.cancelScheduledValues(t);
      E.musicBus.gain.setTargetAtTime(Math.max(MUSIC_LEVEL * _musVol, 0.00008), t, 0.06);
    }
    return _musVol;
  };
  A.getMusicVolume = function () { return _musVol; };

  A.setSfxVolume = function (v) {
    _sfxVol = clamp01(typeof v === 'number' ? v : 0);
    PV.store.set(K_SFX, _sfxVol);
    if (E) {
      var t = E.ctx.currentTime;
      E.sfxBus.gain.cancelScheduledValues(t);
      E.sfxBus.gain.setTargetAtTime(Math.max(SFX_LEVEL * _sfxVol, 0.00008), t, 0.06);
    }
    return _sfxVol;
  };
  A.getSfxVolume = function () { return _sfxVol; };

  A.toggleMute = function () { A.muted = !_muted; return _muted; };

  /* ---- music transport ---- */
  A.playMusic = function (track) {
    if (!TRACKS[track]) return false;
    if (!_ready) { _pendingTrack = track; return false; }
    if (M && !M.dead && M.name === track) return true;
    if (M) { musicDispose(M, 700); M = null; }
    _tensionApplied = _tension; _tensionAppliedAt = E.ctx.currentTime;
    M = newMusic(E, track, _tension);
    var t0 = E.ctx.currentTime + 0.08;
    M.nextTime = t0;
    M.bar = 0; M.step = 0;
    musicFadeIn(M, t0, TRACKS[track].once ? 0.06 : 0.7, 1);
    return true;
  };

  A.stopMusic = function (fadeMs) {
    if (!_ready) { _pendingTrack = null; return; }
    if (M) { musicDispose(M, fadeMs == null ? 600 : fadeMs); M = null; }
  };

  /* setTension is called EVERY FRAME (60Hz) with a continuously varying
     value. Storing it is free; pushing 7 AudioParam automations 60×/s is
     not, and re-issuing setTargetAtTime that often makes the approach
     stair-step. So: keep the value always, but only re-arm the automation
     when it has actually moved, and never faster than ~20Hz. The
     setTargetAtTime time-constant does the rest of the smoothing. */
  var _tensionAppliedAt = -1;
  var _tensionApplied = -1;
  var TENSION_MIN_DT = 0.05;    // seconds between automation updates
  var TENSION_EPS = 0.004;      // ignore sub-perceptual jitter

  A.setTension = function (t) {
    _tension = clamp01(typeof t === 'number' ? t : 0);
    if (!M || M.dead || !E) return;
    var now = E.ctx.currentTime;
    var d = _tension - _tensionApplied;
    if (d < 0) d = -d;
    if (_tensionApplied >= 0 && d < TENSION_EPS) return;
    if (now - _tensionAppliedAt < TENSION_MIN_DT) return;
    _tensionAppliedAt = now;
    _tensionApplied = _tension;
    applyTension(M, _tension, now, 0.45);
  };

  /* ---- the ONE scheduler ---- */
  function schedulerTick() {
    if (!E || !M || M.dead) return;
    var ctx = E.ctx;
    if (ctx.state !== 'running') return;
    var def = M.def;
    var stepDur = (60 / def.bpm) / 4;
    var horizon = ctx.currentTime + SCHEDULE_AHEAD;
    var guard = 0;
    while (M.nextTime < horizon && guard++ < 64) {
      scheduleStep(M, M.bar, M.step, M.nextTime);
      M.step++;
      if (M.step >= 16) { M.step = 0; M.bar++; }
      M.nextTime += stepDur;
      if (def.once && M.bar >= def.bars) {
        var m = M; M = null;
        musicDispose(m, 2200);
        break;
      }
    }
    /* if the tab was backgrounded the clock may have run far ahead */
    if (M && M.nextTime < ctx.currentTime - 0.5) M.nextTime = ctx.currentTime + 0.02;
  }

  /* ---- sfx ---- */
  function makeSfxVoice(E2, name, opts, owner) {
    var o = opts || {};
    var vol = typeof o.vol === 'number' ? clamp(o.vol, 0, 4) : 1;
    var v = new Voice(E2, 'sfx', vol, owner);
    var out = v.g(vol);
    v.out = out;
    v.dry = out;
    var pan = makePan(E2, v, o.pan || 0);
    out.connect(pan);
    pan.connect(E2.sfxBus);
    v.wet = function (amt) {
      var s = v.g(amt);
      out.connect(s);
      s.connect(E2.conv);
      return s;
    };
    return v;
  }

  function enforceCap() {
    if (_sfxVoices.length <= MAX_SFX_VOICES) return;
    /* drop the quietest (ties broken by age) with a short fade */
    var over = _sfxVoices.length - MAX_SFX_VOICES;
    var sorted = _sfxVoices.slice().sort(function (a, b) {
      if (a.vol !== b.vol) return a.vol - b.vol;
      return a.born - b.born;
    });
    for (var i = 0; i < over; i++) sorted[i].fadeKill(0.012);
  }

  function playOn(E2, name, opts, when, owner) {
    var fn = SFX[name];
    if (!fn) return null;
    var o = opts || {};
    var r = typeof o.rate === 'number' ? clamp(o.rate, 0.25, 4) : 1;
    var v = makeSfxVoice(E2, name, o, owner);
    var dur = 0.2;
    try { dur = fn(E2, v, when, r) || 0.2; }
    catch (err) {
      if (global.console) console.warn('[PV.Audio] sfx build failed: ' + name, err);
      v.kill();
      return null;
    }
    v.finish(when + dur + 0.06);
    return v;
  }

  A.sfx = function (name, opts) {
    if (!_ready || _muted || !E) return false;
    if (!SFX[name]) return false;
    if (E.ctx.state !== 'running') {
      /* one cheap resume attempt; never queue */
      try { E.ctx.resume(); } catch (e) {}
      return false;
    }
    var now = E.ctx.currentTime;
    var last = _lastAt[name];
    if (last !== undefined) {
      var lim = RATE_LIMIT[name];
      if (lim !== undefined && now - last < lim) return false;
      if (now - last < MERGE_WINDOW) return false;   /* merge identical hits */
    }
    /* footsteps share one clock so hard<->carpet transitions cannot double up */
    if (name === 'step' || name === 'stepCarpet') {
      _lastAt.step = now; _lastAt.stepCarpet = now;
    }
    _lastAt[name] = now;
    var v = playOn(E, name, opts, now + 0.004, _sfxVoices);
    if (v) enforceCap();
    return !!v;
  };

  A.names = function () {
    var out = [];
    for (var k in SFX) if (SFX.hasOwnProperty(k)) out.push(k);
    return out;
  };
  A.tracks = function () {
    var out = [];
    for (var k in TRACKS) if (TRACKS.hasOwnProperty(k)) out.push(k);
    return out;
  };

  /* ---- rewind: also wobble the music bus (tape stop) ---- */
  function tapeStop() {
    if (!M || M.dead || !M.detune) return;
    var t = E.ctx.currentTime, p = M.detune.offset;
    try {
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(-950, t + 0.22);
      p.linearRampToValueAtTime(-860, t + 0.30);
      p.linearRampToValueAtTime(90, t + 0.52);
      p.linearRampToValueAtTime(-25, t + 0.60);
      p.linearRampToValueAtTime(0, t + 0.70);
    } catch (e) {}
    try {
      var g = M.tapeGain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(g.value, 0.0002), t);
      g.exponentialRampToValueAtTime(0.34, t + 0.18);
      g.exponentialRampToValueAtTime(1, t + 0.78);
    } catch (e) {}
    try {
      var f = M.tapeFilt.frequency;
      f.cancelScheduledValues(t);
      f.setValueAtTime(Math.max(f.value, 200), t);
      f.exponentialRampToValueAtTime(430, t + 0.22);
      f.exponentialRampToValueAtTime(20000, t + 0.85);
    } catch (e) {}
  }
  /* wrap sfx so the rewind one-shot always drags the music with it */
  var _rawSfx = A.sfx;
  A.sfx = function (name, opts) {
    var ok = _rawSfx(name, opts);
    if (ok && name === 'rewind') tapeStop();
    return ok;
  };

  /* ==================================================================
     10. Offline self-test hooks (used by the dev harness; harmless in game)
     ================================================================== */
  function offlineCtx(seconds) {
    var OC = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    if (!OC) return null;
    return new OC(2, Math.ceil(44100 * seconds), 44100);
  }

  A._offlineSfx = function (name, seconds, opts) {
    seconds = seconds || 3;
    var oc = offlineCtx(seconds);
    if (!oc || !SFX[name]) return Promise.reject(new Error('cannot render ' + name));
    var E2 = makeEngine(oc, false);
    playOn(E2, name, opts || {}, 0.05, null);
    return oc.startRendering();
  };

  A._offlineMusic = function (track, seconds, tension) {
    seconds = seconds || 8;
    var oc = offlineCtx(seconds);
    if (!oc || !TRACKS[track]) return Promise.reject(new Error('cannot render ' + track));
    var E2 = makeEngine(oc, false);
    var m = newMusic(E2, track, tension || 0);
    applyTension(m, tension || 0, 0, 0.001);
    musicFadeIn(m, 0.01, 0.12, 1);
    var stepDur = (60 / m.def.bpm) / 4;
    var t = 0.05, bar = 0, step = 0;
    while (t < seconds - 0.02) {
      scheduleStep(m, bar, step, t);
      step++;
      if (step >= 16) { step = 0; bar++; }
      if (m.def.once && bar >= m.def.bars) break;
      t += stepDur;
    }
    return oc.startRendering();
  };

})(window);
