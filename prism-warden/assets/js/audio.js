/* Prism Warden procedural audio: adaptive score + layered SFX, Web Audio only.
 * Classic script. Reads simulation state, never mutates it, never throws when
 * AudioContext is missing. PW.Audio = { enable(on), isEnabled(), update(s,dt), cue(name) }.
 */
(function (root) {
  'use strict';
  const PW = root.PW = root.PW || {};
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const semi = s => Math.pow(2, s / 12);
  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
  function xorshift(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // ---------------------------------------------------------------- score data
  const MODES = {
    ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    acoustic: [0, 2, 4, 6, 7, 9, 10], phrygdom: [0, 1, 4, 5, 7, 8, 10]
  };
  // Verdant Aqueduct: woody kalimba/flute/reed leads, flowing kalimba water arpeggios,
  // low hand-drum/log-drum pulse, plucked wood bass (kit:'wood' swaps the combat kit too).
  const V = { mel2: 'flute', counter: 'kalimba', pad: 'moss', bassInst: 'woodbass', kit: 'wood', drone: .5 };
  const verdant = o => Object.assign({}, V, o);
  // motif: [beat, scaleDegree, beats]. prog: chord root degree per bar of an 8-bar period.
  const SONGS = {
    cloister: { root: 50, mode: 'dorian', bpm: 80, meter: 4, prog: [0, 6, 3, 0, 0, 6, 4, 4],
      motif: [[0, 4, 1], [1, 3, .5], [1.5, 2, .5], [2, 3, 1.5], [3.5, 1, .5]],
      mel: 'pluck', mel2: 'bell', melOct: 1, counter: 'celesta', pulse: 'harp', pad: 'warm',
      padLevel: .8, verb: .38, echo: .24, drone: .8, seed: 11 },
    sluice: { root: 57, mode: 'aeolian', bpm: 96, meter: 4, prog: [0, 5, 2, 6, 0, 5, 3, 4],
      motif: [[0, 0, .5], [.5, 2, .5], [1, 4, 1], [2, 3, .5], [2.5, 2, .5], [3, 1, 1]],
      mel: 'ocarina', mel2: 'pluck', melOct: 0, counter: 'marimba', pulse: 'drops', pad: 'glass',
      padLevel: .6, verb: .32, echo: .3, drone: .6, seed: 23 },
    sanctuary: { root: 53, mode: 'lydian', bpm: 62, meter: 4, prog: [0, 1, 0, 1, 5, 4, 0, 1],
      motif: [[0, 7, 1.5], [1.5, 8, .5], [2, 9, 1], [3, 11, 1]],
      mel: 'celesta', mel2: 'ocarina', melOct: 0, counter: 'bell', pulse: 'slowharp', pad: 'choir',
      padLevel: 1, verb: .62, echo: .26, drone: .5, seed: 37, peaceful: true },
    shutters: { root: 52, mode: 'phrygian', bpm: 104, meter: 4, prog: [0, 1, 0, 6, 0, 1, 5, 6],
      motif: [[0, 7, .5], [.5, 8, .5], [1, 7, .5], [1.5, 6, .5], [2, 9, 1], [3, 8, 1]],
      mel: 'pluck', mel2: 'marimba', melOct: 0, counter: 'celesta', pulse: 'clock', pad: 'dark',
      padLevel: .6, verb: .26, echo: .18, drone: .7, seed: 41 },
    'bell-tower': { root: 55, mode: 'mixolydian', bpm: 100, meter: 3, prog: [0, 6, 3, 0, 0, 6, 4, 0],
      motif: [[0, 4, 1], [1, 2, .5], [1.5, 3, .5], [2, 4, 1]],
      mel: 'bell', mel2: 'pluck', melOct: 1, counter: 'celesta', pulse: 'toll', pad: 'warm',
      padLevel: .7, verb: .46, echo: .2, drone: .7, seed: 53 },
    beacon: { root: 48, mode: 'aeolian', bpm: 70, meter: 4, prog: [0, 5, 3, 4, 0, 5, 6, 4],
      motif: [[0, 4, 2], [2, 3, 1], [3, 2, 1]],
      mel: 'ocarina', mel2: 'bell', melOct: 1, counter: 'bell', pulse: 'slowharp', pad: 'dark',
      padLevel: .6, verb: .5, echo: .28, drone: .7, seed: 61 },
    boss: { root: 49, mode: 'harmonic', bpm: 132, meter: 4, prog: [0, 0, 5, 4, 0, 0, 5, 4],
      motif: [[0, 7, .5], [.5, 7, .25], [.75, 7, .25], [1, 11, .5], [1.5, 12, .5], [2, 11, 1], [3, 13, .5], [3.5, 14, .5]],
      mel: 'brass', mel2: 'bell', melOct: 0, counter: 'bell', pulse: 'drive', pad: 'dark',
      padLevel: .6, verb: .3, echo: .15, drone: 1, seed: 71, boss: true },
    victory: { root: 50, mode: 'lydian', bpm: 72, meter: 4, prog: [0, 1, 4, 0, 5, 1, 4, 0],
      motif: [[0, 4, 1], [1, 6, 1], [2, 7, 2]],
      mel: 'bell', mel2: 'celesta', melOct: 1, counter: 'celesta', pulse: 'harp', pad: 'choir',
      padLevel: .9, verb: .55, echo: .25, drone: .6, seed: 83, peaceful: true },
    // ---- Region 2: Verdant Aqueduct
    verdant: verdant({ root: 53, mode: 'acoustic', bpm: 88, meter: 4, prog: [0, 1, 4, 0, 5, 1, 3, 4],
      motif: [[0, 4, .5], [.5, 5, .5], [1, 7, 1], [2, 6, .5], [2.5, 4, .5], [3, 2, 1]],
      mel: 'kalimba', melOct: 1, pulse: 'stream', padLevel: .7, verb: .34, echo: .3, seed: 101 }),
    spillway: verdant({ root: 53, mode: 'acoustic', bpm: 92, meter: 4, prog: [0, 1, 4, 0, 5, 1, 6, 4],
      motif: [[0, 2, .5], [.5, 4, .5], [1, 7, 1.5], [2.5, 6, .5], [3, 4, 1]],
      mel: 'kalimba', melOct: 1, pulse: 'stream', padLevel: .7, verb: .32, echo: .3, seed: 103 }),
    roots: verdant({ root: 50, mode: 'dorian', bpm: 76, meter: 4, prog: [0, 3, 0, 6, 0, 3, 4, 4],
      motif: [[0, 4, 1.5], [1.5, 3, .5], [2, 2, 1], [3, 0, 1]],
      mel: 'flute', mel2: 'kalimba', melOct: 1, pulse: 'roots', pad: 'dark', padLevel: .7, verb: .44, echo: .22, drone: .8, seed: 107 }),
    channels: verdant({ root: 57, mode: 'mixolydian', bpm: 108, meter: 4, prog: [0, 6, 3, 0, 0, 6, 4, 4],
      motif: [[0, 0, .5], [.5, 2, .5], [1, 4, .5], [1.5, 6, .5], [2, 7, 1], [3, 4, 1]],
      mel: 'kalimba', mel2: 'reed', melOct: 1, pulse: 'stream', padLevel: .55, verb: .28, echo: .26, seed: 109 }),
    quay: verdant({ root: 52, mode: 'aeolian', bpm: 98, meter: 4, prog: [0, 5, 6, 0, 0, 5, 3, 4],
      motif: [[0, 4, .5], [.5, 4, .25], [.75, 3, .25], [1, 2, 1], [2, 4, .5], [2.5, 5, .5], [3, 4, 1]],
      mel: 'reed', mel2: 'kalimba', melOct: 0, pulse: 'handdrum', padLevel: .6, verb: .3, echo: .2, drone: .7, seed: 113 }),
    reservoir: verdant({ root: 48, mode: 'phrygian', bpm: 70, meter: 4, prog: [0, 1, 0, 6, 0, 1, 5, 6],
      motif: [[0, 4, 2], [2, 5, 1], [3, 4, 1]],
      mel: 'flute', mel2: 'kalimba', melOct: 1, pulse: 'roots', pad: 'dark', padLevel: .6, verb: .5, echo: .28, drone: 1, seed: 127 }),
    ferry: verdant({ root: 55, mode: 'acoustic', bpm: 84, meter: 3, prog: [0, 4, 1, 0, 5, 1, 4, 0],
      motif: [[0, 4, 1], [1, 5, .5], [1.5, 4, .5], [2, 2, 1]],
      mel: 'flute', mel2: 'kalimba', melOct: 1, pulse: 'rowing', padLevel: .8, verb: .4, echo: .3, seed: 131 }),
    hart: verdant({ root: 45, mode: 'phrygdom', bpm: 138, meter: 4, prog: [0, 0, 1, 0, 0, 0, 6, 1],
      motif: [[0, 7, .5], [.5, 8, .25], [.75, 7, .25], [1, 9, .5], [1.5, 8, .5], [2, 7, 1], [3, 8, .5], [3.5, 9, .5]],
      mel: 'reed', mel2: 'kalimba', melOct: 0, counter: 'kalimba', pulse: 'stampede', pad: 'dark',
      padLevel: .6, verb: .3, echo: .15, drone: 1, seed: 137, boss: true }),
    glade: verdant({ root: 53, mode: 'lydian', bpm: 72, meter: 4, prog: [0, 1, 4, 0, 5, 1, 4, 0],
      motif: [[0, 4, 1], [1, 6, 1], [2, 7, 2]],
      mel: 'kalimba', mel2: 'flute', melOct: 1, pulse: 'slowharp', pad: 'choir', padLevel: .9, verb: .55, echo: .25, seed: 139, peaceful: true })
  };
  const ROOM_SONG = { cloister: 'cloister', courtyard: 'cloister', sluice: 'sluice', sanctuary: 'sanctuary',
    shutters: 'shutters', 'bell-tower': 'bell-tower', beacon: 'beacon',
    spillway: 'spillway', roots: 'roots', channels: 'channels', quay: 'quay', reservoir: 'reservoir', ferry: 'ferry' };
  const VERDANT = 'verdant-aqueduct';

  // Estimated cue lengths (voice accounting) and priorities (2 = never dropped).
  const CUE_LEN = { slash: .2, dash: .3, shot: .15, return: .7, hurt: .45, catch: .6, tick: .1, latch: 2.2,
    bell: 3, sanctuary: 2.4, gate: 2, mirror: .25, telegraph: 1, windup: 1, lunge: .4, exposed: .9, enemyHit: .4,
    defeated: 2, wake: 1.6, jam: .6, tideRise: 1.9, tideFall: 1.9, tideHigh: 1.8, tideLow: 1.8,
    shutterClose: .7, shutterOpen: .4, shutterWarn: .3, escortHurt: .5, chart: 1, heart: 1.2, heal: .4,
    rescue: 1.6, submerge: 1, surface: 1, shockwave: 1.4, bossDefeated: 3.5, beacon: 3.5, won: 4,
    lost: 3, begin: 1.4, room: 1.2, ui: .1,
    prismGet: 1.4, prismPlace: .9, prismLift: .8, brambleCut: .4, brambleRegrow: .9, lever: 1.1, mortarCreak: .6,
    lobLaunch: 1, lobLand: .6, hartAim: 1, hartLock: .4, hartCharge: 1.3, hartImpact: .6, hartStun: 1.2,
    damHit: .8, damBreak: 3, cleared: 4.5 };
  const PRIORITY = { hurt: 2, return: 2, gate: 2, latch: 2, bell: 2, won: 2, lost: 2, beacon: 2,
    bossDefeated: 2, shockwave: 2, escortHurt: 2, defeated: 2, room: 2, begin: 2, windup: 2, heart: 2, chart: 2,
    prismGet: 2, prismPlace: 2, prismLift: 2, lever: 2, hartLock: 2, hartCharge: 2, damHit: 2, damBreak: 2, cleared: 2,
    shot: 0, tick: 0, mirror: 0, shutterWarn: 0, heal: 0, ui: 0, brambleRegrow: 0 };
  const MIN_GAP = { shot: .05, tick: .09, mirror: .06, heal: .3, slash: .05, enemyHit: .06, shutterWarn: .3, shutterClose: .12, shutterOpen: .2,
    brambleCut: .05, brambleRegrow: .35, lobLaunch: .08, lobLand: .08, mortarCreak: .15, hartAim: .3 };
  const SFX_MAX = 14, MUSIC_MAX = 56;
  const RAW_HZ = { gong: 1, handdrum: 1, logdrum: 1 }; // event 'midi' slot carries Hz (or null = default)

  // ---------------------------------------------------------------- engine
  function makeEngine(ctx, live) {
    const E = { ctx, live, sections: [], cur: null, sfxEnds: [], musEnds: [], last: {} };
    const sr = ctx.sampleRate;
    const NOISE = (() => {
      const b = ctx.createBuffer(1, sr * 2, sr), d = b.getChannelData(0), r = xorshift(99);
      for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
      return b;
    })();
    function impulse(seconds, decay) {
      const n = Math.floor(sr * seconds), pre = Math.floor(sr * .018), b = ctx.createBuffer(2, n, sr);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c), r = xorshift(1234 + c * 77);
        let lp = 0;
        for (let i = pre; i < n; i++) {
          const x = (i - pre) / (n - pre), k = .25 + .7 * x; // darker as it decays
          lp += (1 - k) * ((r() * 2 - 1) - lp);
          d[i] = lp * Math.pow(1 - x, decay) * (i - pre < sr * .004 ? (i - pre) / (sr * .004) : 1);
        }
      }
      return b;
    }
    // master chain: buses -> pre -> glue compressor -> limiter -> master(mute) -> out
    const master = ctx.createGain(); master.gain.value = live ? 0 : 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = .005; comp.release.value = .25;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = .001; limiter.release.value = .1;
    const pre = ctx.createGain(); pre.gain.value = .85;
    const dcBlock = ctx.createBiquadFilter(); dcBlock.type = 'highpass'; dcBlock.frequency.value = 22; dcBlock.Q.value = .5;
    pre.connect(dcBlock); dcBlock.connect(comp); comp.connect(limiter); limiter.connect(master); master.connect(ctx.destination);
    const musicBus = ctx.createGain(); musicBus.gain.value = .5; musicBus.connect(pre);
    const sfxBus = ctx.createGain(); sfxBus.gain.value = .8; sfxBus.connect(pre);
    const ambBus = ctx.createGain(); ambBus.gain.value = 1; ambBus.connect(pre);
    const verb = ctx.createConvolver(); verb.normalize = true; verb.buffer = impulse(3.2, 3.2);
    const verbIn = ctx.createBiquadFilter(); verbIn.type = 'highpass'; verbIn.frequency.value = 180;
    const verbOut = ctx.createGain(); verbOut.gain.value = .8;
    verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(pre);
    const sfxVerb = ctx.createGain(); sfxVerb.gain.value = .18; sfxVerb.connect(verbIn);
    E.master = master; E.limiter = limiter;
    if (live && ctx.createAnalyser) { E.analyser = ctx.createAnalyser(); E.analyser.fftSize = 2048; master.connect(E.analyser); }

    // ---- primitives
    const conn = (n, d) => { if (Array.isArray(d)) d.forEach(x => x && n.connect(x)); else if (d) n.connect(d); };
    function env(t, a, peak, dec) {
      const g = ctx.createGain(); peak = Math.max(peak, .00021);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + Math.max(.001, a));
      g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); g.gain.setValueAtTime(0, t + a + dec + .01);
      return g;
    }
    function tone(dest, t, type, f0, f1, a, peak, dec) {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + dec);
      const g = env(t, a, peak, dec); o.connect(g); conn(g, dest);
      o.start(t); o.stop(t + a + dec + .03); o.onended = () => g.disconnect();
      return o;
    }
    function noise(dest, t, type, f0, f1, q, a, peak, dec) {
      const s = ctx.createBufferSource(); s.buffer = NOISE; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + a + dec);
      const g = env(t, a, peak, dec); s.connect(f); f.connect(g); conn(g, dest);
      s.start(t, (t * 7.31) % 1.8); s.stop(t + a + dec + .03); s.onended = () => g.disconnect();
    }
    function fm(dest, t, f, ratio, index, a, peak, dec) {
      const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain();
      c.frequency.setValueAtTime(f, t); m.frequency.setValueAtTime(f * ratio, t);
      mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(f * index * .04 + .01, t + a + dec * .7);
      m.connect(mg); mg.connect(c.frequency);
      const g = env(t, a, peak, dec); c.connect(g); conn(g, dest);
      const end = t + a + dec + .03; c.start(t); m.start(t); c.stop(end); m.stop(end);
      c.onended = () => { g.disconnect(); mg.disconnect(); };
    }

    // ---- musical instruments: (dest, t, freq, durSeconds, vel)
    const INST = {
      pluck(d, t, f, dur, v) {
        const dec = Math.min(2.2, .4 + dur * 1.1), g = env(t, .004, .27 * v, dec);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .9;
        lp.frequency.setValueAtTime(Math.min(15000, f * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(160, f * 2.6), t + .5);
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o1.type = 'triangle'; o1.frequency.value = f; o2.frequency.value = f * 2.003; g2.gain.value = .3;
        o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); conn(g, d);
        const end = t + dec + .03; o1.start(t); o2.start(t); o1.stop(end); o2.stop(end); o1.onended = () => g.disconnect();
      },
      bell(d, t, f, dur, v) { fm(d, t, f, 3.5, 1.5, .002, .17 * v, Math.min(3.2, 1.2 + dur)); fm(d, t, f * 2, 1, .3, .002, .03 * v, .6); },
      celesta(d, t, f, dur, v) { fm(d, t, f, 4, .7, .002, .15 * v, Math.min(1.6, .5 + dur * .6)); },
      marimba(d, t, f, dur, v) {
        tone(d, t, 'sine', f, 0, .002, .15 * v, .45); tone(d, t, 'sine', f * 3.99, 0, .001, .05 * v, .06);
      },
      ocarina(d, t, f, dur, v) {
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f; g2.gain.value = .22;
        lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .007, t + Math.min(.45, dur * .8));
        lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
        const g = ctx.createGain(), pk = .15 * v, hold = Math.max(t + .06, t + dur - .04);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + .05); g.gain.setValueAtTime(pk * .9, hold);
        g.gain.linearRampToValueAtTime(0, hold + .18);
        o.connect(g); o2.connect(g2); g2.connect(g); conn(g, d);
        const end = hold + .2;[o, o2, lfo].forEach(x => { x.start(t); x.stop(end); }); o.onended = () => g.disconnect();
        noise(d, t, 'bandpass', f * 1.5, 0, 3, .02, .012 * v, .12);
      },
      brass(d, t, f, dur, v) {
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = o2.type = 'sawtooth';
        o.frequency.value = f; o2.frequency.value = f * 1.006;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.5;
        lp.frequency.setValueAtTime(f * 1.5, t); lp.frequency.linearRampToValueAtTime(f * 5, t + .06); lp.frequency.exponentialRampToValueAtTime(f * 2.6, t + .3);
        const g = ctx.createGain(), pk = .07 * v, hold = Math.max(t + .05, t + dur - .03);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + .03); g.gain.setValueAtTime(pk * .75, hold); g.gain.linearRampToValueAtTime(0, hold + .12);
        o.connect(lp); o2.connect(lp); lp.connect(g); conn(g, d);
        const end = hold + .14; o.start(t); o2.start(t); o.stop(end); o2.stop(end); o.onended = () => g.disconnect();
      },
      bass(d, t, f, dur, v) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
        const g = ctx.createGain(), pk = .11 * v;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + .015); g.gain.setTargetAtTime(pk * .5, t + .02, dur * .5);
        g.gain.setTargetAtTime(0, t + dur, .08);
        o.connect(lp); lp.connect(g); conn(g, d); o.start(t); o.stop(t + dur + .5); o.onended = () => g.disconnect();
      },
      sawbass(d, t, f, dur, v) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 5;
        lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(220, t + .16);
        const g = env(t, .004, .075 * v, Math.max(.12, dur)); o.connect(lp); lp.connect(g); conn(g, d);
        o.start(t); o.stop(t + dur + .06); o.onended = () => g.disconnect();
      },
      drum(d, t, f, dur, v) { tone(d, t, 'sine', 150, 52, .002, .36 * v, .34); noise(d, t, 'lowpass', 1600, 400, .7, .001, .12 * v, .05); },
      tom(d, t, f, dur, v) { tone(d, t, 'sine', 240, 110, .002, .22 * v, .22); noise(d, t, 'bandpass', 900, 0, 1, .001, .06 * v, .05); },
      shaker(d, t, f, dur, v) { noise(d, t, 'highpass', 7000, 0, .8, .004, .05 * v, .06); },
      tick(d, t, f, dur, v) { tone(d, t, 'sine', f || 1800, 0, .001, .07 * v, .035); noise(d, t, 'bandpass', 3500, 0, 5, .001, .05 * v, .02); },
      gong(d, t, f, dur, v) { fm(d, t, f, 1.41, 3, .004, .16 * v, 4); },
      // ---- Verdant Aqueduct voices
      kalimba(d, t, f, dur, v) { // sine tine + inharmonic overtone + soft thumb click
        tone(d, t, 'sine', f, 0, .003, .16 * v, Math.min(1.4, .45 + dur * .5));
        tone(d, t, 'sine', f * 5.4, 0, .001, .03 * v, .07);
        noise(d, t, 'bandpass', Math.min(9000, f * 3), 0, 2, .001, .018 * v, .012);
      },
      flute(d, t, f, dur, v) {
        INST.ocarina(d, t, f, dur, .8 * v);
        noise(d, t, 'bandpass', Math.min(9000, f * 2), 0, 1.6, .06, .014 * v, Math.max(.1, dur * .6));
      },
      reed(d, t, f, dur, v) { // nasal double reed
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = 'sawtooth'; o2.type = 'square';
        o.frequency.value = f; o2.frequency.value = f * 1.004;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.value = Math.min(6000, f * 3.2);
        const g = ctx.createGain(), pk = .08 * v, hold = Math.max(t + .05, t + dur - .03);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + .035); g.gain.setValueAtTime(pk * .8, hold); g.gain.linearRampToValueAtTime(0, hold + .1);
        const o2g = ctx.createGain(); o2g.gain.value = .35;
        o.connect(bp); o2.connect(o2g); o2g.connect(bp); bp.connect(g); conn(g, d);
        const end = hold + .12; o.start(t); o2.start(t); o.stop(end); o2.stop(end); o.onended = () => g.disconnect();
      },
      handdrum(d, t, f, dur, v) {
        const p = f || 118; tone(d, t, 'sine', p, p * .58, .002, .32 * v, .3);
        noise(d, t, 'bandpass', 760, 0, 1.2, .001, .09 * v, .04);
      },
      logdrum(d, t, f, dur, v) { const p = f || 220; tone(d, t, 'sine', p, p * .93, .001, .2 * v, .18); tone(d, t, 'sine', p * 2.71, 0, .001, .05 * v, .05); },
      woodbass(d, t, f, dur, v) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
        lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(260, t + .2);
        const g = env(t, .004, .15 * v, Math.min(1.2, .2 + dur * .7)); o.connect(lp); lp.connect(g); conn(g, d);
        o.start(t); o.stop(t + 1.5); o.onended = () => g.disconnect();
      },
      didge(d, t, f, dur, v) { // growling low drone with a wobbling formant
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.value = 480;
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 2.3; lg.gain.value = 220;
        lfo.connect(lg); lg.connect(bp.frequency);
        const g = ctx.createGain(), pk = .09 * v, end = t + Math.max(1, dur);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + .25); g.gain.setValueAtTime(pk, end - .4); g.gain.linearRampToValueAtTime(0, end);
        o.connect(bp); bp.connect(g); conn(g, d);
        o.start(t); lfo.start(t); o.stop(end + .02); lfo.stop(end + .02); o.onended = () => { g.disconnect(); lg.disconnect(); };
      }
    };
    function pad(d, t, freqs, dur, v, kind) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.value = kind === 'glass' ? 2400 : kind === 'dark' ? 650 : kind === 'moss' ? 850 : 1100; lp.Q.value = .4;
      const g = ctx.createGain(), pk = .026 * v, a = Math.min(1.4, dur * .35), end = t + dur + 1.2;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + a); g.gain.setValueAtTime(pk, t + dur);
      g.gain.linearRampToValueAtTime(0, end);
      let out = lp;
      if (kind === 'choir') { // two vowel formants for an 'oo/ah' wash
        const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), m = ctx.createGain();
        f1.type = f2.type = 'bandpass'; f1.frequency.value = 520; f2.frequency.value = 1100; f1.Q.value = 2; f2.Q.value = 3; m.gain.value = 2.2;
        lp.frequency.value = 3000; lp.connect(f1); lp.connect(f2); f1.connect(m); f2.connect(m); out = m;
      }
      out.connect(g); conn(g, d);
      const type = kind === 'choir' || kind === 'dark' ? 'sawtooth' : 'triangle', first = [];
      for (const f of freqs) for (const det of [-7, 7]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(end + .02); first.push(o);
      }
      if (first[0]) first[0].onended = () => g.disconnect();
    }

    // ---- sections (one per arrangement; crossfaded)
    function degMidi(c, deg, oct) {
      const m = MODES[c.mode], o = Math.floor(deg / 7), i = ((deg % 7) + 7) % 7;
      return c.root + 12 * (oct + o) + m[i];
    }
    function nearestChord(deg, chord) {
      let best = deg, bd = 99;
      for (let d = deg - 3; d <= deg + 3; d++) {
        const k = (((d - chord) % 7) + 7) % 7;
        if ((k === 0 || k === 2 || k === 4) && Math.abs(d - deg) < bd) { bd = Math.abs(d - deg); best = d; }
      }
      return best;
    }
    function makeSection(key, at) {
      const c = SONGS[key] || SONGS.cloister;
      const out = ctx.createGain(); out.gain.setValueAtTime(.0001, at); out.gain.setTargetAtTime(1, at, .7);
      out.connect(musicBus);
      const wet = ctx.createGain(); wet.gain.value = c.verb; out.connect(wet); wet.connect(verbIn);
      const main = ctx.createGain(); main.connect(out);
      const combat = ctx.createGain(); combat.gain.value = c.boss ? 1 : .0001; combat.connect(out);
      const intense = ctx.createGain(); intense.gain.value = .0001; intense.connect(out);
      // tempo-synced dotted-eighth echo for lead voices
      const echoIn = ctx.createGain(); echoIn.gain.value = c.echo;
      const dl = ctx.createDelay(2); dl.delayTime.value = 60 / c.bpm * .75;
      const fb = ctx.createGain(); fb.gain.value = .32; const elp = ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 4200;
      echoIn.connect(dl); dl.connect(elp); elp.connect(fb); fb.connect(dl); elp.connect(out);
      const sec = { key, c, out, main, combat, intense, echoIn, nextBeat: at + .05, beat: 0, rng: xorshift(c.seed),
        lastDeg: c.motif[c.motif.length - 1][1], bar: [], combatOn: !!c.boss, combatOff: -99, intenseOn: false, intenseOff: -99, endAt: 0, drone: [] };
      if (c.drone) { // sustained root/fifth bed with a slow breathing filter
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 2;
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = 160;
        lfo.connect(lg); lg.connect(lp.frequency);
        const dg = ctx.createGain(); dg.gain.value = .022 * c.drone; lp.connect(dg); dg.connect(main);
        for (const [m, type, lvl] of [[c.root - 12, 'sine', .7], [c.root - 5, 'sine', .45], [c.root, 'triangle', .5]]) {
          const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = mtof(m); og.gain.value = lvl;
          o.connect(og); og.connect(lp); o.start(at); sec.drone.push(o);
        }
        lfo.start(at); sec.drone.push(lfo);
      }
      return sec;
    }
    function composeBar(sec, bar) {
      const c = sec.c, r = sec.rng, M = c.meter, pos = bar % 8, cycle = Math.floor(bar / 8), chord = c.prog[pos];
      const ev = [], L = 'main';
      const push = (at, inst, midi, dur, vel, layer, lead) => ev.push({ at, inst, midi, dur, vel, layer: layer || L, lead });
      // pad + bass
      ev.push({ at: 0, pad: c.pad, midis: [chord, chord + 2, chord + 4].map(d => degMidi(c, d, 0)), dur: M, vel: c.padLevel, layer: L });
      if (c.pulse !== 'drive' && c.pulse !== 'clock' && c.pulse !== 'stampede') push(0, c.bassInst || 'bass', degMidi(c, chord, -1), M * .9, c.peaceful ? .6 : .8);
      // melody: 8-bar period (statement, answer, breath, half cadence, sequence, answer, breath, cadence)
      const rest = bar < 2 || cycle % 4 === 3;
      if (!rest) {
        let notes;
        const mot = c.motif;
        if (pos === 0) notes = mot.map(n => n.slice());
        else if (pos === 4) { const sh = chord - c.prog[0]; notes = mot.map(([a, d, u]) => [a, d + sh, u]); }
        else if (pos === 1 || pos === 5) {
          let d = sec.lastDeg;
          notes = mot.map(([a, , u], i) => { d += [-2, -1, -1, 1, 1, 2][Math.floor(r() * 6)]; d = clamp(d, -2, 14); if (i === 0) d = nearestChord(d, chord); return [a, d, u]; });
        } else if (pos === 2 || pos === 6) {
          const d = nearestChord(sec.lastDeg, chord); notes = [[0, d, M - 1.2], [M - 1, d + 1, .5], [M - .5, d + 2, .5]];
        } else if (pos === 3) {
          const d = nearestChord(sec.lastDeg, chord); notes = M === 3 ? [[0, d + 2, 1], [1, d + 1, .5], [1.5, d, 1.5]] : [[0, d + 2, 1], [1, d + 1, 1], [2, d, 2]];
        } else { const d = nearestChord(sec.lastDeg, chord); notes = [[0, d, M]]; }
        const inst = cycle % 2 ? c.mel2 : c.mel, oct = c.melOct + (inst === 'bell' && c.mel !== 'bell' ? 1 : 0);
        for (const [a, d, u] of notes) push(a, inst, degMidi(c, d, oct), u, .9, L, true);
        sec.lastDeg = notes[notes.length - 1][1];
      }
      // counter chime
      if (pos % 2 === 0 && r() < .55) push(M - 1 + (r() < .5 ? .5 : 0), c.counter, degMidi(c, chord + (r() < .5 ? 2 : 4), 2), 1, .5);
      // pulse layer
      const P = c.pulse;
      for (let e = 0; e < M * 2; e++) {
        const at = e / 2, accent = e % 2 === 0 ? 1 : .7;
        if (P === 'harp') push(at, 'pluck', degMidi(c, chord + [0, 2, 4, 7, 9, 7, 4, 2][e % 8], 0), .5, .38 * accent);
        else if (P === 'drops') { if (r() < .55) push(at, 'marimba', degMidi(c, chord + [0, 2, 4, 7][Math.floor(r() * 4)], 1), .5, .3 + r() * .3); }
        else if (P === 'clock') {
          push(at, 'tick', null, .1, accent * .8); if (e % 2 === 0) ev[ev.length - 1].freq = e % 4 === 0 ? 1900 : 1500; else ev[ev.length - 1].freq = 2600;
          push(at, 'bass', degMidi(c, chord + (e % 4 === 3 ? 4 : 0), -1), .45, .6 * accent);
        } else if (P === 'slowharp') { if (e % 2 === 0) push(at, 'pluck', degMidi(c, chord + [0, 4, 7, 9][(e / 2) % 4], 0), 1, .3); }
        else if (P === 'drive') push(at, 'sawbass', degMidi(c, chord + [0, 0, 7, 0, 0, 4, 7, 1][e % 8], -1), .45, accent);
      }
      if (P === 'toll') {
        push(0, 'bell', degMidi(c, chord, -1), M, .8);
        for (let e = 0; e < M * 3; e++) push(e / 3, 'pluck', degMidi(c, chord + [0, 2, 4][e % 3] + (e >= 3 ? 7 : 0), 0), .33, .26);
      }
      // ---- Verdant pulses
      if (P === 'stream') { // flowing sixteenth kalimba water arpeggio, swelling across the bar
        const wave = [0, 4, 7, 9, 11, 9, 7, 4], lift = cycle % 2 ? 2 : 0;
        for (let e = 0; e < M * 4; e++) {
          if (e % 4 !== 0 && r() < .18) continue;
          const sw = .55 + .45 * Math.sin((e / (M * 4)) * Math.PI);
          push(e / 4, 'kalimba', degMidi(c, chord + wave[e % 8] + (e >= 8 ? lift : 0), 0), .35, (e % 4 === 0 ? .42 : .26) * sw);
        }
        push(0, 'handdrum', null, .3, .5); if (M === 4) push(2.5, 'handdrum', null, .3, .32);
      } else if (P === 'roots') { // slow creaking log drum, low kalimba, sparse hand drum
        push(0, 'logdrum', 150, .3, .7); push(M / 2 + .5, 'logdrum', 112, .3, .45);
        push(M - .5, 'handdrum', 96, .3, .45);
        for (let e = 0; e < M; e += 2) push(e + 1, 'kalimba', degMidi(c, chord + [4, 7][(e / 2) % 2], 0), 1, .32);
        if (r() < .5) push(M - 1.5, 'woodbass', degMidi(c, chord + 4, -1), 1, .5);
      } else if (P === 'handdrum') { // quay: hand-drum groove with offbeat log slaps and kalimba chatter
        const pat = [1, 0, .5, .7, 0, .6, .5, .3];
        for (let e = 0; e < M * 2; e++) {
          if (pat[e % 8]) push(e / 2, e % 2 ? 'logdrum' : 'handdrum', e % 2 ? 330 : (e % 4 ? 150 : 110), .3, pat[e % 8] * .75);
          if (r() < .45) push(e / 2 + .25, 'kalimba', degMidi(c, chord + [0, 2, 4, 7][Math.floor(r() * 4)], 1), .3, .2 + r() * .15);
        }
      } else if (P === 'rowing') { // ferry: lilting triplet oar-strokes
        const pat = [0, 4, 7, 11, 7, 4];
        for (let e = 0; e < M * 2; e++) push(e / 2, 'kalimba', degMidi(c, chord + pat[e % 6], 0), .5, e % 2 ? .22 : .34);
        push(0, 'handdrum', 100, .3, .55); push(2, 'logdrum', 180, .3, .3);
      } else if (P === 'stampede') { // Root Hart: galloping hand drums over a driving wood bass
        for (let e = 0; e < M * 2; e++) push(e / 2, 'woodbass', degMidi(c, chord + [0, 0, 7, 0, 1, 0, 7, 0][e % 8], -1), .4, e % 2 ? .75 : 1);
        for (let e = 0; e < M * 4; e++) { const v = [1, 0, .45, .7][e % 4]; if (v) push(e / 4, 'handdrum', e % 8 === 0 ? 92 : 128, .2, v * .7); }
        push(1, 'logdrum', 260, .2, .7); push(3, 'logdrum', 260, .2, .7);
      }
      // combat layer: frame drums (hand drums in the Aqueduct), shaker, ostinato
      const wood = c.kit === 'wood', DR = wood ? 'handdrum' : 'drum', TOM = wood ? 'logdrum' : 'tom', OST = wood ? 'woodbass' : 'sawbass';
      const drums = M === 3 ? [[0, 1], [1.5, .55], [2, .8]] : [[0, 1], [1.5, .55], [2, .85], [3, .45], [3.5, .7]];
      for (const [a, v] of drums) push(a, DR, null, .3, v, 'combat');
      for (let e = 0; e < M * 2; e++) push(e / 2, 'shaker', null, .1, e % 2 ? .45 : .8, 'combat');
      if (P !== 'drive' && P !== 'stampede') for (let e = 0; e < M * 2; e++) push(e / 2, OST, degMidi(c, chord + [0, 0, 4, 0, 0, 4, 7, 2][e % 8], -1), .4, .7, 'combat');
      push(M - .5, TOM, null, .2, .6, 'combat');
      // Root Hart second phase: log-drum rolls, growling didgeridoo drone, high kalimba ostinato
      if (c.boss && wood) {
        for (let e = 0; e < M * 4; e++) if (e % 4 !== 0 && r() < .55) push(e / 4, 'logdrum', 200 + Math.floor(r() * 3) * 60, .15, .3 + r() * .3, 'intense');
        if (pos % 2 === 0) push(0, 'didge', degMidi(c, chord, -1), M * 2, .9, 'intense');
        for (let e = 0; e < M * 2; e++) push(e / 2, 'kalimba', degMidi(c, chord + [7, 8, 9, 8][e % 4], 1), .3, .3, 'intense');
      } else if (c.boss) {
      // boss second-phase layer: rolling toms, deep gong tolls, high bell ostinato
        for (let e = 0; e < M * 4; e++) if (e % 4 !== 0 && r() < .5) push(e / 4, 'tom', null, .15, .35 + r() * .3, 'intense');
        if (pos % 2 === 0) push(0, 'gong', mtof(c.root - 24), 4, .9, 'intense');
        for (let e = 0; e < M * 2; e++) push(e / 2, 'celesta', degMidi(c, chord + [7, 9, 11, 9][e % 4], 1), .4, .35, 'intense');
      }
      return ev;
    }
    function playEvent(sec, e, t) {
      const spb = 60 / sec.c.bpm, dur = e.dur * spb;
      const dest = e.layer === 'combat' ? sec.combat : e.layer === 'intense' ? sec.intense : sec.main;
      if (!admit(E.musEnds, t, t + dur + .5, MUSIC_MAX)) return;
      if (e.pad) return pad(dest, t, e.midis.map(mtof), dur, e.vel, e.pad);
      const f = RAW_HZ[e.inst] ? e.midi : e.midi != null ? mtof(e.midi) : e.freq;
      const d = e.lead ? [dest, sec.echoIn] : dest;
      INST[e.inst](d, t, f, dur, e.vel);
    }
    function scheduleSection(sec, until) {
      const c = sec.c, spb = 60 / c.bpm;
      if (E.live && sec.nextBeat < ctx.currentTime - .05) { // woke from throttling: skip, don't burst
        const skip = Math.ceil((ctx.currentTime - sec.nextBeat) / spb); sec.nextBeat += skip * spb; sec.beat += skip;
      }
      while (sec.nextBeat < until) {
        if (sec.endAt && sec.nextBeat > sec.endAt) return;
        const t = sec.nextBeat, bib = sec.beat % c.meter;
        if (bib === 0 || !sec.bar.length) sec.bar = composeBar(sec, Math.floor(sec.beat / c.meter));
        const combatLive = sec.combatOn || t < sec.combatOff + 5, intenseLive = sec.intenseOn || t < sec.intenseOff + 5;
        for (const e of sec.bar) {
          if (e.at < bib || e.at >= bib + 1) continue;
          if (e.layer === 'combat' && !combatLive) continue;
          if (e.layer === 'intense' && !intenseLive) continue;
          playEvent(sec, e, t + (e.at - bib) * spb);
        }
        sec.beat++; sec.nextBeat += spb;
      }
    }
    function admit(list, start, end, max, force) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i] < start) list.splice(i, 1);
      if (list.length >= max && !force) return false;
      list.push(end); return true;
    }
    function ramp(param, v, at, tc) { param.cancelScheduledValues(at); param.setTargetAtTime(Math.max(v, .0001), at, tc); }

    E.setMusic = function (d, at) {
      if (!d) return;
      if (at == null) at = ctx.currentTime;
      if (!E.cur || E.cur.key !== d.key) {
        if (E.cur) { const o = E.cur; ramp(o.out.gain, 0, at, .55); o.endAt = at + 3; o.drone.forEach(x => { try { x.stop(at + 3.2); } catch (e) { /* stopped */ } }); }
        E.cur = makeSection(d.key, at); E.sections.push(E.cur);
        const c = E.cur.c;
        if (E.hum) E.humBase = mtof(c.root + 24 + 7);
      }
      const s = E.cur, wantCombat = s.c.boss ? true : !!d.combat;
      if (wantCombat !== s.combatOn) {
        s.combatOn = wantCombat; if (!wantCombat) s.combatOff = at;
        ramp(s.combat.gain, wantCombat ? 1 : 0, at, wantCombat ? .35 : 1.4);
      }
      const wantIntense = !!(s.c.boss && d.intense);
      if (wantIntense !== s.intenseOn) { s.intenseOn = wantIntense; if (!wantIntense) s.intenseOff = at; ramp(s.intense.gain, wantIntense ? 1 : 0, at, .6); }
      const duck = d.duck ? .35 : 1;
      if (duck !== E.duck) { E.duck = duck; ramp(musicBus.gain, .5 * duck, at, .8); }
      if (E.amb) {
        const lvl = d.water ? .05 + .09 * num(d.tide) : 0;
        if (Math.abs(lvl - (E.ambLvl || 0)) > .004) { E.ambLvl = lvl; ramp(E.amb.gain, lvl, at, .5); ramp(E.ambLp.frequency, 280 + 700 * num(d.tide), at, .5); }
      }
    };
    E.schedule = function (until) {
      for (const s of E.sections) scheduleSection(s, until);
      const now = E.live ? ctx.currentTime : 0;
      E.sections = E.sections.filter(s => {
        if (!s.endAt || now < s.endAt + .5) return true;
        try { s.out.disconnect(); } catch (e) { /* gone */ }
        return false;
      });
    };
    // continuous beams hum + water ambience
    (function () {
      const hg = ctx.createGain(); hg.gain.value = .0001; hg.connect(sfxBus);
      const trem = ctx.createOscillator(), tg = ctx.createGain(); trem.frequency.value = 6; tg.gain.value = .3;
      const hv = ctx.createGain(); hv.gain.value = .7; trem.connect(tg); tg.connect(hv.gain); hv.connect(hg);
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o2.type = 'triangle';
      o1.connect(hv); const o2g = ctx.createGain(); o2g.gain.value = .25; o2.connect(o2g); o2g.connect(hv);
      o1.start(); o2.start(); trem.start();
      E.hum = { g: hg, o1, o2 }; E.humBase = 660;
      const s = ctx.createBufferSource(); s.buffer = NOISE; s.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      const ag = ctx.createGain(); ag.gain.value = .0001; s.connect(lp); lp.connect(ag); ag.connect(ambBus); s.start();
      E.amb = ag; E.ambLp = lp; E.ambLvl = 0;
    })();
    E.setBeam = function (on, charge, at) {
      if (at == null) at = ctx.currentTime;
      const f = E.humBase * (1 + .5 * clamp(charge, 0, 1));
      E.hum.o1.frequency.setTargetAtTime(f, at, .05); E.hum.o2.frequency.setTargetAtTime(f * 1.5, at, .05);
      if (on !== E.humOn) { E.humOn = on; ramp(E.hum.g.gain, on ? .03 : 0, at, on ? .04 : .12); }
    };
    E.setMuted = function (m, at) {
      if (at == null) at = ctx.currentTime;
      const p = master.gain; p.cancelScheduledValues(at); p.setValueAtTime(p.value, at); p.setTargetAtTime(m ? 0 : 1, at, .06);
    };

    // ---- SFX
    function arp(d, t, base, semis, step, kind, v) {
      semis.forEach((s, i) => kind === 'pluck' ? INST.pluck(d, t + i * step, base * semi(s), .4, v) :
        fm(d, t + i * step, base * semi(s), kind === 'glass' ? 4 : 3.5, kind === 'glass' ? .8 : 1.3, .002, .12 * v, 1.2));
    }
    const CUES = {
      ui(t, d) { INST.tick(d, t, 2200, .05, .8); },
      slash(t, d) { noise(d, t, 'bandpass', 1300, 5200, 1.3, .008, .32, .12); tone(d, t + .015, 'sine', 2900, 2400, .002, .035, .08); },
      dash(t, d) { noise(d, t, 'bandpass', 500, 2600, .8, .03, .3, .2); tone(d, t, 'sine', 240, 110, .005, .1, .16); },
      shot(t, d) { tone(d, t, 'triangle', 1180, 540, .002, .14, .1); tone(d, t, 'sine', 1770, 820, .002, .05, .07); noise(d, t, 'highpass', 3500, 0, .7, .001, .06, .02); },
      return(t, d, o) {
        fm(d, t, 1568, 3.01, 2.2, .001, .2, .6); fm(d, t + .05, 2349, 3.01, 1, .001, .09, .5);
        tone(d, t, 'sine', 900, 2200, .003, .1, .16); noise(d, t, 'highpass', 5000, 0, .7, .001, .18, .035);
      },
      hurt(t, d) {
        tone(d, t, 'sine', 190, 52, .003, .6, .3); noise(d, t, 'lowpass', 1400, 220, 1, .002, .38, .22);
        tone(d, t + .01, 'sawtooth', 233, 207, .004, .045, .32); tone(d, t + .01, 'sawtooth', 247, 220, .004, .045, .32);
      },
      catch(t, d, o) { arp(d, t, o.root * 2, [0, 7, 12, 19], .035, 'glass', .7); noise(d, t, 'highpass', 6000, 9000, .7, .02, .05, .3); },
      tick(t, d, o) { tone(d, t, 'sine', o.freq || 1200, 0, .002, .13, .07); tone(d, t, 'sine', (o.freq || 1200) * 2, 0, .001, .025, .03); },
      latch(t, d, o) {
        arp(d, t, o.root * 2, [0, 7, 12, 16, 19], .07, 'bell', 1.1); tone(d, t, 'sine', o.root / 2, 0, .3, .12, 1.6);
        noise(d, t, 'highpass', 5000, 11000, .7, .05, .06, .8);
      },
      bell(t, d, o) { fm(d, t, o.root, 2.76, 2.4, .002, .3, 3.2); fm(d, t, o.root * 2, 3.5, 1.2, .002, .12, 2); tone(d, t, 'sine', o.root / 2, 0, .01, .12, 2.5); },
      sanctuary(t, d, o) { arp(d, t, o.root * 2, [0, 4, 7, 11, 14], .1, 'glass', 1); tone(d, t, 'sine', o.root, 0, .4, .08, 1.8); },
      gate(t, d, o) {
        noise(d, t, 'lowpass', 180, 90, 1, .1, .5, 1.3); noise(d, t, 'bandpass', 650, 420, 3, .15, .14, 1.1);
        tone(d, t, 'sine', 55, 45, .1, .3, 1.2); tone(d, t + 1.1, 'sine', 110, 38, .002, .5, .45); noise(d, t + 1.1, 'lowpass', 900, 150, .8, .002, .3, .3);
        arp(d, t + .75, o.root * 2, [0, 3, 7, 14], .09, 'bell', .9);
      },
      mirror(t, d) {
        for (let i = 0; i < 3; i++) noise(d, t + i * .045, 'bandpass', 3000 + i * 400, 0, 5, .001, .22, .02);
        tone(d, t, 'sine', 720, 560, .001, .14, .08); tone(d, t + .13, 'sine', 980, 900, .001, .1, .1);
      },
      telegraph(t, d) { tone(d, t, 'triangle', 300, 900, .8, .14, .12); tone(d, t, 'sine', 600, 1800, .8, .06, .1); },
      windup(t, d) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(130, t + .85);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(250, t); lp.frequency.exponentialRampToValueAtTime(1500, t + .85);
        const g = env(t, .82, .13, .1); o.connect(lp); lp.connect(g); conn(g, d); o.start(t); o.stop(t + 1); o.onended = () => g.disconnect();
        tone(d, t + .6, 'square', 880, 880, .002, .02, .06); tone(d, t + .75, 'square', 880, 880, .002, .02, .06);
      },
      lunge(t, d) { noise(d, t, 'lowpass', 300, 2400, .8, .02, .4, .3); tone(d, t, 'sine', 210, 60, .003, .25, .3); },
      exposed(t, d) {
        for (let i = 0; i < 4; i++) noise(d, t + i * .03, 'highpass', 4000 + i * 900, 0, 1, .001, .14, .025);
        fm(d, t + .06, 1319, 4, 1, .002, .13, .5); fm(d, t + .18, 1976, 4, 1, .002, .12, .6);
      },
      enemyHit(t, d) { noise(d, t, 'bandpass', 900, 500, 1, .001, .4, .12); tone(d, t, 'sine', 220, 65, .002, .4, .2); fm(d, t, 740, 1.41, 2, .001, .08, .35); },
      defeated(t, d, o) {
        tone(d, t, 'sine', 120, 35, .004, .55, .8); noise(d, t, 'lowpass', 2400, 120, .8, .003, .4, .9);
        arp(d, t + .15, o.root * 4, [12, 7, 3, 0, -5], .09, 'bell', .8);
      },
      wake(t, d, o) { INST.gong(d, t, o.root / 2, 3, .9); tone(d, t, 'triangle', o.root, o.root * 2, .6, .05, .4); },
      jam(t, d) {
        for (let i = 0; i < 4; i++) tone(d, t + i * .07, 'square', 190 - i * 30, 90 - i * 12, .002, .11, .05);
        noise(d, t, 'bandpass', 2500, 800, 2, .002, .3, .35);
      },
      tideRise(t, d, o) { noise(d, t, 'lowpass', 180, 1100, 1, 1.2, .16, .6); fm(d, t, o.root / 2, 2.76, 1.5, .002, .14, 1.6); fm(d, t + .5, o.root / 2 * 1.5, 2.76, 1.5, .002, .12, 1.4); },
      tideFall(t, d, o) { noise(d, t, 'lowpass', 1100, 180, 1, 1.2, .16, .6); fm(d, t, o.root / 2 * 1.5, 2.76, 1.5, .002, .14, 1.6); fm(d, t + .5, o.root / 2, 2.76, 1.5, .002, .12, 1.4); },
      tideHigh(t, d) { noise(d, t, 'lowpass', 500, 1200, .8, .35, .22, 1.4); noise(d, t + .1, 'highpass', 3000, 1500, .5, .3, .05, 1); },
      tideLow(t, d) { noise(d, t, 'lowpass', 1100, 250, .8, .25, .2, 1.4); },
      shutterClose(t, d) {
        tone(d, t, 'sine', 115, 42, .002, .55, .35); noise(d, t, 'lowpass', 1000, 150, .9, .002, .45, .25);
        fm(d, t, 196, 1.41, 3, .001, .12, .55);
      },
      shutterOpen(t, d) { noise(d, t, 'bandpass', 500, 1600, 2, .06, .2, .22); tone(d, t, 'sine', 300, 520, .01, .12, .2); },
      shutterWarn(t, d) { INST.tick(d, t, 1400, .05, 2.2); INST.tick(d, t + .15, 1050, .05, 2.2); },
      escortHurt(t, d) {
        tone(d, t, 'triangle', 784, 560, .003, .16, .2); tone(d, t + .1, 'triangle', 622, 415, .003, .15, .26);
        tone(d, t, 'sine', 160, 70, .003, .25, .18);
      },
      chart(t, d, o) { for (let i = 0; i < 5; i++) noise(d, t + i * .03, 'bandpass', 2500, 0, 2, .003, .06, .03); arp(d, t + .12, o.root * 2, [0, 4, 7, 12], .08, 'pluck', 1.2); },
      heart(t, d, o) { arp(d, t, o.root * 2, [0, 4, 7, 11, 12, 16], .075, 'glass', 1); tone(d, t + .45, 'sine', o.root * 4, 0, .02, .05, .7); },
      heal(t, d, o) { tone(d, t, 'sine', o.root * 2, o.root * 3, .05, .1, .3); tone(d, t + .08, 'sine', o.root * 3, o.root * 4, .03, .05, .3); },
      rescue(t, d, o) { arp(d, t, o.root * 2, [0, 2, 4, 7, 9, 12], .09, 'bell', 1); },
      submerge(t, d) {
        tone(d, t, 'sine', 260, 55, .01, .28, .7); noise(d, t, 'lowpass', 700, 140, 1, .02, .26, .8);
        for (let i = 0; i < 6; i++) tone(d, t + .08 + i * .09, 'sine', 380 + ((i * 173) % 400), 900 + ((i * 97) % 500), .002, .05, .05);
      },
      surface(t, d) { noise(d, t, 'bandpass', 1500, 380, .7, .005, .4, .65); tone(d, t, 'sine', 70, 190, .08, .2, .45); },
      shockwave(t, d, o) {
        tone(d, t, 'sine', 95, 28, .004, .8, 1.1); noise(d, t, 'lowpass', 2200, 110, .8, .003, .55, .9);
        fm(d, t, o.root / 2, 1.41, 4, .002, .16, 1.3);
      },
      bossDefeated(t, d, o) {
        tone(d, t, 'sine', 110, 30, .004, .7, 1.4); noise(d, t, 'lowpass', 3000, 90, .8, .003, .5, 1.6);
        INST.gong(d, t, o.root / 2, 4, 1); arp(d, t + .3, o.root * 4, [12, 10, 7, 5, 3, 0, -2, -5], .11, 'bell', .8);
      },
      beacon(t, d, o) {
        const r = o.root; arp(d, t, r * 2, [0, 4, 7, 12, 16, 19, 24], .09, 'bell', 1);
        pad(d, t + .1, [r, r * semi(4), r * semi(7), r * 2].map(x => x * 2), 2.2, 2.2, 'choir');
      },
      won(t, d, o) { CUES.beacon(t, d, o); INST.gong(d, t, o.root / 2, 4, .6); },
      lost(t, d, o) {
        const r = o.root; [0, -2, -4, -5].forEach((s, i) => INST.ocarina(d, t + i * .42, r * 2 * semi(s), .4, 1.1));
        tone(d, t, 'sine', r / 2, r / 2.2, .3, .12, 2.4);
      },
      begin(t, d, o) { arp(d, t, o.root * 2, [0, 7, 12], .12, 'glass', 1); tone(d, t, 'sine', o.root, 0, .2, .06, 1); },
      room(t, d, o) { noise(d, t, 'bandpass', 300, 1500, 1, .25, .18, .55); fm(d, t + .2, o.root * 2, 4, .8, .002, .16, 1); },
      // ---- Region 2 cues
      prismGet(t, d, o) { arp(d, t, o.root * 2, [0, 4, 7, 11, 14, 19], .06, 'glass', .9); noise(d, t, 'highpass', 6000, 10000, .7, .05, .05, .8); tone(d, t, 'sine', o.root, 0, .1, .06, 1); },
      prismPlace(t, d, o) { // crystal set down on stone: soft thunk, then a ringing open fifth
        tone(d, t, 'sine', 190, 110, .002, .3, .14); noise(d, t, 'lowpass', 1800, 300, .8, .001, .16, .08);
        arp(d, t + .04, o.root * 4, [0, 7, 12], .035, 'glass', .75); noise(d, t + .03, 'highpass', 7000, 0, .7, .01, .04, .45);
      },
      prismLift(t, d, o) { // shimmer rising back into the satchel
        noise(d, t, 'highpass', 3500, 9000, .7, .15, .06, .3); tone(d, t, 'sine', 340, 780, .03, .08, .22);
        arp(d, t + .05, o.root * 4, [12, 7, 0], .05, 'glass', .6); tone(d, t + .22, 'sine', 90, 70, .002, .12, .1);
      },
      brambleCut(t, d) { // leafy rip + twig snaps
        noise(d, t, 'bandpass', 2600, 900, 1.8, .004, .3, .22);
        for (let i = 0; i < 3; i++) noise(d, t + .02 + i * .045, 'highpass', 3000 + i * 700, 0, 1, .001, .2, .018);
        tone(d, t, 'sine', 420, 150, .002, .12, .1);
      },
      brambleRegrow(t, d) { // soft creeping rustle
        noise(d, t, 'bandpass', 320, 1100, 3, .35, .07, .45); tone(d, t, 'triangle', 95, 135, .3, .035, .4);
      },
      lever(t, d, o) { // ratchet, wooden clack, confirming kalimba fifth
        for (let i = 0; i < 5; i++) INST.logdrum(d, t + i * .035, 900 + i * 60, .05, .35);
        tone(d, t + .2, 'sine', 170, 70, .002, .4, .22); noise(d, t + .2, 'lowpass', 1400, 200, .9, .001, .22, .12);
        INST.kalimba(d, t + .32, o.root * 2, .5, 1); INST.kalimba(d, t + .42, o.root * 3, .6, .9);
      },
      mortarCreak(t, d) { // bark mortar draws back: creaking wood
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(120, t + .45);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.value = 520;
        const g = env(t, .25, .32, .22); o.connect(bp); bp.connect(g); conn(g, d); o.start(t); o.stop(t + .5); o.onended = () => g.disconnect();
        for (let i = 0; i < 4; i++) noise(d, t + .06 + i * .09, 'bandpass', 1100 + i * 180, 0, 3, .001, .09, .03);
      },
      lobLaunch(t, d) { // hollow 'thoonk' + faint rising whistle over the arc
        tone(d, t, 'sine', 300, 85, .002, .38, .18); noise(d, t, 'lowpass', 1000, 200, .9, .002, .22, .14);
        tone(d, t + .1, 'sine', 700, 1300, .45, .02, .35);
      },
      lobLand(t, d) { // seed pod thump + dirt spray
        tone(d, t, 'sine', 120, 40, .003, .5, .32); noise(d, t, 'lowpass', 1700, 140, .8, .002, .32, .35);
        noise(d, t + .02, 'highpass', 2600, 1200, .7, .004, .06, .2);
      },
      hartAim(t, d) { // rough low growl (AM-roughened detuned saws)
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = o2.type = 'sawtooth';
        o1.frequency.setValueAtTime(58, t); o2.frequency.setValueAtTime(61.5, t);
        o1.frequency.linearRampToValueAtTime(74, t + .8); o2.frequency.linearRampToValueAtTime(78, t + .8);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(260, t); lp.frequency.linearRampToValueAtTime(650, t + .8);
        const am = ctx.createGain(); am.gain.value = .6; const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.type = 'square'; lfo.frequency.value = 23; lg.gain.value = .4;
        lfo.connect(lg); lg.connect(am.gain);
        const g = env(t, .3, .16, .6); o1.connect(lp); o2.connect(lp); lp.connect(am); am.connect(g); conn(g, d);
        const end = t + .95;[o1, o2, lfo].forEach(x => { x.start(t); x.stop(end); }); o1.onended = () => { g.disconnect(); lg.disconnect(); };
      },
      hartLock(t, d) { // snort + hoof stamp + two warning ticks: charge incoming
        noise(d, t, 'bandpass', 1300, 520, 1.1, .01, .22, .16); tone(d, t + .05, 'sine', 140, 55, .002, .38, .16);
        tone(d, t + .12, 'square', 988, 988, .002, .02, .05); tone(d, t + .22, 'square', 988, 988, .002, .02, .05);
      },
      hartCharge(t, d) { // accelerating hoofbeats, rumble and rushing air
        for (let i = 0; i < 7; i++) INST.handdrum(d, t + i * (.15 - i * .012), 88 + (i % 2) * 20, .1, .75);
        noise(d, t, 'lowpass', 180, 700, 1, .1, .22, 1); noise(d, t, 'bandpass', 500, 2600, .8, .2, .12, .7);
      },
      hartImpact(t, d) { tone(d, t, 'sine', 140, 42, .002, .5, .3); noise(d, t, 'lowpass', 1500, 180, .8, .001, .32, .25); },
      hartStun(t, d, o) { // dazed: wobbling chirps circle overhead, exposed shimmer
        [2637, 2349, 2637, 2093, 2349].forEach((f, i) => tone(d, t + .1 + i * .14, 'sine', f, f * .86, .004, .05, .1));
        fm(d, t + .05, o.root * 4, 4, 1, .002, .1, .6); noise(d, t, 'highpass', 5000, 0, 1, .001, .1, .04);
      },
      damHit(t, d) { // heavy timber crunch
        tone(d, t, 'sine', 95, 38, .003, .6, .45); noise(d, t, 'bandpass', 900, 280, 1.4, .002, .4, .35);
        for (let i = 0; i < 4; i++) noise(d, t + .03 + i * .05, 'highpass', 2200 + i * 500, 0, 1, .001, .14, .02);
        fm(d, t, 150, 1.41, 2.5, .002, .07, .5);
      },
      damBreak(t, d, o) { // splintering collapse, then the released water rushes through
        CUES.damHit(t, d, o);
        for (let i = 0; i < 6; i++) noise(d, t + .12 + i * .07, 'bandpass', 1400 + i * 350, 0, 2, .001, .12, .05);
        tone(d, t + .15, 'sine', 70, 30, .01, .45, .9);
        noise(d, t + .2, 'lowpass', 300, 1700, .9, .45, .34, 2.2); noise(d, t + .35, 'highpass', 3000, 1600, .6, .35, .07, 1.9);
      },
      cleared(t, d, o) { // Region cleared: kalimba/bell ascent over a hand-drum roll, choir bloom, low gong
        const r = o.root;
        for (let i = 0; i < 8; i++) INST.handdrum(d, t + i * .06, 110 + i * 6, .1, .25 + i * .06);
        [0, 4, 7, 9, 12, 16, 19, 24].forEach((s, i) => INST.kalimba(d, t + .5 + i * .085, r * 2 * semi(s), .6, 1.1));
        arp(d, t + .5, r * 2, [0, 7, 12, 16, 19, 24], .12, 'bell', .8);
        pad(d, t + .6, [r, r * semi(4), r * semi(7), r * 2].map(x => x * 2), 2.4, 2.2, 'choir');
        INST.gong(d, t + .5, r / 2, 4, .6);
      }
    };
    E.cue = function (name, t, o) {
      const fn = CUES[name]; if (!fn) return false;
      o = o || {}; if (t == null) t = ctx.currentTime + .005;
      const gap = MIN_GAP[name] || .03;
      if (E.last[name] != null && t - E.last[name] < gap && t >= E.last[name]) return false;
      const pr = PRIORITY[name] == null ? 1 : PRIORITY[name];
      if (!admit(E.sfxEnds, t, t + (CUE_LEN[name] || .5), pr === 2 ? 99 : pr === 0 ? SFX_MAX - 4 : SFX_MAX, pr === 2)) return false;
      E.last[name] = t;
      const song = SONGS[E.cur ? E.cur.key : 'cloister'];
      o.root = o.root || mtof(song.root + 12);
      const g = ctx.createGain(); g.gain.value = o.gain == null ? 1 : o.gain;
      let tail = g;
      if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); tail = p; }
      tail.connect(sfxBus); tail.connect(sfxVerb);
      fn(t, g, o);
      return true;
    };
    E.now = () => ctx.currentTime;
    E.start = function () {
      if (!E.live || E.timer) return;
      E.timer = setInterval(() => { try { E.schedule(ctx.currentTime + .15); } catch (e) { /* keep running */ } }, 25);
    };
    E.stop = function () { if (E.timer) { clearInterval(E.timer); E.timer = null; } };
    return E;
  }

  // ---------------------------------------------------------------- state diffing
  let engine = null, ctx = null, enabled = false, stopTimer = null, warned = false;
  let prev = null, chargeClock = 0, desired = { key: 'cloister', combat: false, intense: false, duck: false, water: false, tide: 0 };
  const log = [], counts = {};
  let bossFrame = -1;
  const idOf = (x, i) => (x && x.id != null ? String(x.id) : '#' + i);
  const list = a => (Array.isArray(a) ? a.filter(x => x && typeof x === 'object') : []);
  const isDiver = e => !!e && (e.type === 'diver' || /diver/i.test(String(e.id || '')));
  const isHart = e => !!e && (e.type === 'hart' || /hart/i.test(String(e.id || '')));
  const isBoss = e => isDiver(e) || isHart(e);
  const lobKey = (l, i) => (l.id != null ? String(l.id) : (l.owner != null ? l.owner : '') + ':' + Math.round(num(l.x0)) + ':' + Math.round(num(l.y0)) + ':' + Math.round(num(l.tx)) + ':' + Math.round(num(l.ty)));
  const SLEEP = /dormant|defeat|destroy|dead|silen|sleep|inactive/i;
  function awake(e) { return e && num(e.hp) > 0 && !SLEEP.test(String(e.phase || '')) && !e.silenced && !e.dormant && !e.destroyed; }

  function snap(s) {
    const p = s.player || {}, P = {
      ref: s, time: num(s.time), roomId: roomOf(s), status: s.status, hits: num(s.hits), returns: num(s.returns),
      hp: num(p.hp), maxHp: num(p.maxHp), dash: num(p.dashTime), slash: num(p.slashTime),
      caught: list(s.beams).some(b => b && b.kind && b.kind !== 'sun'),
      recv: {}, gates: {}, mirrors: {}, enemies: {}, shots: new Set(), shotCount: 0, shutters: {}, pickups: {},
      rings: new Set(), ringCount: list(s.rings).filter(r => r && r.hostile !== false).length,
      tideHigh: tideOn(s) ? !!s.tide.high : null, tideWarn: tideOn(s) ? num(s.tide.warning) : 0,
      escortHp: s.escort ? num(s.escort.hp) : null, freed: !!(s.rescue && s.rescue.freed),
      beacon: !!(s.beacon && (s.beacon.lit || s.beacon.active)),
      prism: p.prism || null, growth: {}, levers: {}, dams: {}, lobs: {}
    };
    list(s.growth).forEach((g, i) => { P.growth[idOf(g, i)] = g.alive !== false; });
    list(s.levers).forEach((l, i) => { P.levers[idOf(l, i)] = !!l.pulled; });
    list(s.dams).forEach((d, i) => { P.dams[idOf(d, i)] = { hp: num(d.hp), broken: !!d.broken }; });
    list(s.lobs).forEach((l, i) => { P.lobs[lobKey(l, i)] = { x: num(l.tx), y: num(l.ty) }; });
    list(s.receivers).forEach((r, i) => { P.recv[idOf(r, i)] = { charge: num(r.charge), active: !!r.active }; });
    list(s.gates).forEach((g, i) => { P.gates[idOf(g, i)] = !!g.open; });
    list(s.mirrors).forEach((m, i) => { P.mirrors[idOf(m, i)] = m.index; });
    list(s.enemies).forEach((e, i) => { P.enemies[idOf(e, i)] = { phase: e.phase, hp: num(e.hp), exposed: num(e.exposed), jam: jamOf(e), sub: e.submerged, locked: !!e.locked }; });
    list(s.shots).forEach((sh, i) => { if (sh && !sh.friendly) { P.shotCount++; if (sh.id != null) P.shots.add(sh.id); } });
    list(s.shutters).forEach((sh, i) => { P.shutters[idOf(sh, i)] = { open: sh.open !== false, phase: sh.phase, warn: num(sh.warning) }; });
    list(s.pickups).forEach((pk, i) => { P.pickups[idOf(pk, i)] = { got: !!(pk.collected || pk.taken || pk.got), kind: pk.kind }; });
    list(s.rings).forEach((r, i) => { if (r && r.id != null) P.rings.add(r.id); });
    return P;
  }
  function tideOn(s) { return !!(s.tide && s.tide.active !== false && typeof s.tide.level === 'number'); }
  function roomOf(s) { return s.roomId || (s.room && s.room.id) || 'courtyard'; }
  function jamOf(e) { const j = e.jam != null ? e.jam : e.jammed != null ? e.jammed : e.jamTime; return typeof j === 'boolean' ? (j ? 1 : 0) : num(j); }
  function panFor(s, x, y) {
    const p = s.player || {};
    if (typeof x !== 'number' || typeof p.x !== 'number') return {};
    const dx = x - p.x, dy = (y || 0) - (p.y || 0), dist = Math.hypot(dx, dy);
    return { pan: clamp(dx / 600, -.8, .8), gain: clamp(1.15 - dist / 1100, .4, 1), dist };
  }
  function emit(name, o) {
    log.push(name); if (log.length > 200) log.shift(); counts[name] = (counts[name] || 0) + 1;
    if (engine && enabled) { try { engine.cue(name, o && o.delay ? engine.now() + o.delay : null, o); } catch (e) { /* never break the game loop */ } }
  }

  function detect(s, dt) {
    const roomId = roomOf(s), t = num(s.time);
    if (!prev || prev.ref !== s || t < prev.time - 1e-6) { prev = snap(s); return; }
    if (roomId !== prev.roomId) { emit('room'); prev = snap(s); return; }
    const P = prev, p = s.player || {};
    if (s.status !== P.status) {
      if (s.status === 'won') emit(s.beacon || s.regionId ? 'won' : 'rescue');
      else if (s.status === 'cleared') emit('cleared', { delay: s.beacon && (s.beacon.lit || s.beacon.active) && !P.beacon ? 1.1 : 0 });
      else if (s.status === 'lost') emit('lost');
    }
    if (num(s.hits) > P.hits || (s.hits == null && num(p.hp) < P.hp)) emit('hurt');
    else if (num(p.hp) > P.hp && num(p.maxHp) === P.maxHp) emit('heal');
    if (num(s.returns) > P.returns) emit('return');
    if (num(p.dashTime) > P.dash + 1e-6) emit('dash');
    if (num(p.slashTime) > P.slash + 1e-6) emit('slash');
    const caught = list(s.beams).some(b => b && b.kind && b.kind !== 'sun');
    if (caught && !P.caught) emit('catch');
    // receivers: rising-charge ticks + latch
    let charging = 0, maxCharge = 0;
    list(s.receivers).forEach((r, i) => {
      const k = idOf(r, i), o = P.recv[k]; if (!o) return;
      if (r.active && !o.active) {
        emit(r.kind === 'bell' ? 'bell' : (r.kind === 'sanctuary' || r.id === 'sanctuary') ? 'sanctuary' : 'latch', panFor(s, r.x, r.y));
      } else if (!r.active && num(r.charge) > o.charge + 1e-6) { charging++; maxCharge = Math.max(maxCharge, num(r.charge)); }
    });
    chargeClock += num(dt);
    if (charging && chargeClock > .14) { chargeClock = 0; emit('tick', { freq: 700 * Math.pow(2, Math.floor(maxCharge * 8) * 2 / 12 * .75) }); }
    desired.beam = caught; desired.charge = maxCharge;
    list(s.gates).forEach((g, i) => { const k = idOf(g, i); if (g.open && P.gates[k] === false) emit('gate', panFor(s, g.x + (g.w || 0) / 2, g.y + (g.h || 0) / 2)); });
    list(s.mirrors).forEach((m, i) => { const k = idOf(m, i); if (k in P.mirrors && m.index !== P.mirrors[k]) emit('mirror', panFor(s, m.x, m.y)); });
    // Region 2 environment: dams (hart impacts), brambles, levers, placeable prism, mortar lobs
    let damHitNow = false;
    list(s.dams).forEach((d, i) => {
      const o = P.dams[idOf(d, i)]; if (!o) return; const pos = panFor(s, num(d.x) + num(d.w) / 2, num(d.y) + num(d.h) / 2);
      if ((d.broken && !o.broken) || (num(d.hp) <= 0 && o.hp > 0)) { emit('damBreak', pos); damHitNow = true; } else if (num(d.hp) < o.hp) { emit('damHit', pos); damHitNow = true; }
    });
    list(s.growth).forEach((g, i) => {
      const k = idOf(g, i); if (!(k in P.growth)) return; const alive = g.alive !== false;
      if (alive === P.growth[k]) return; const pos = panFor(s, num(g.x) + num(g.w) / 2, num(g.y) + num(g.h) / 2);
      if (!alive) emit('brambleCut', pos); else { if (pos.gain != null) pos.gain *= .6; emit('brambleRegrow', pos); }
    });
    list(s.levers).forEach((l, i) => { const k = idOf(l, i); if (l.pulled && P.levers[k] === false) emit('lever', panFor(s, l.x, l.y)); });
    const prism = p.prism || null;
    if (prism !== P.prism) {
      if (prism === 'placed') emit('prismPlace');
      else if (prism === 'carried' && P.prism === 'placed') emit('prismLift');
      else if (prism === 'carried' && !P.prism) emit('prismGet');
    }
    let lobsNew = 0; const lobSeen = {};
    list(s.lobs).forEach((l, i) => { const k = lobKey(l, i); lobSeen[k] = 1; if (!P.lobs[k] && lobsNew < 2) { lobsNew++; emit('lobLaunch', panFor(s, l.x0, l.y0)); } });
    let lobsGone = 0;
    for (const k in P.lobs) if (!lobSeen[k] && lobsGone < 2) { lobsGone++; emit('lobLand', panFor(s, P.lobs[k].x, P.lobs[k].y)); }
    list(s.enemies).forEach((e, i) => {
      const o = P.enemies[idOf(e, i)]; if (!o) return;
      const pos = panFor(s, e.x, e.y), ph = String(e.phase || ''), was = String(o.phase || ''), boss = isBoss(e);
      if (o.hp > 0 && (num(e.hp) <= 0 || (/defeat|destroy|dead/.test(ph) && !/defeat|destroy|dead/.test(was)))) { emit(boss ? 'bossDefeated' : 'defeated', pos); if (boss) bossFrame = t; return; }
      if (num(e.hp) < o.hp) emit('enemyHit', pos);
      let exposedCued = false;
      if (isHart(e)) { // Root Hart: aim growl, lock snort, charge stampede, impact, stun
        if (ph !== was) {
          if (/dormant/.test(was)) emit('wake', pos);
          if (ph === 'aim') emit('hartAim', pos);
          else if (ph === 'charge') emit('hartCharge', pos);
          else if (ph === 'exposed') emit('hartStun', pos);
          if (was === 'charge' && (ph === 'exposed' || ph === 'daze') && !damHitNow) emit('hartImpact', pos);
        }
        if (e.locked && !o.locked && ph === 'aim') emit('hartLock', pos);
        return;
      }
      if (e.type === 'mortar' && ph !== was && /telegraph|draw|wind/.test(ph)) { emit('mortarCreak', pos); return; }
      if (ph !== was) {
        if (/dormant|sleep/.test(was)) emit('wake', pos);
        if (/windup/.test(ph)) emit('windup', pos);
        else if (ph === 'lunge' || ph === 'charge') emit('lunge', pos);
        else if (/telegraph/.test(ph)) emit('telegraph', pos);
        else if (/jam/.test(ph)) emit('jam', pos);
        else if (/diving|dive|sink/.test(ph) || (/submerg/.test(ph) && !/diving|dive|sink/.test(was))) emit('submerge', pos);
        else if (/surfac|emerg/.test(ph)) emit('surface', pos);
        else if (ph === 'exposed') { emit('exposed', pos); exposedCued = true; }
      }
      if (!exposedCued && num(e.exposed) > 0 && o.exposed <= 0 && ph !== 'exposed') emit('exposed', pos);
      if (jamOf(e) > 0 && o.jam <= 0 && !/jam/.test(ph)) emit('jam', pos);
      if (typeof e.submerged === 'boolean' && typeof o.sub === 'boolean' && e.submerged !== o.sub && ph === was) emit(e.submerged ? 'submerge' : 'surface', pos);
    });
    // enemy fire: new hostile shot ids (or count increase for id-less shots)
    let newShots = 0, hostile = 0;
    for (const sh of list(s.shots)) {
      if (!sh || sh.friendly) continue; hostile++;
      if (sh.id != null && !P.shots.has(sh.id) && newShots < 3) { newShots++; emit('shot', panFor(s, sh.x, sh.y)); }
    }
    if (!newShots && hostile > P.shotCount && list(s.shots).every(sh => !sh || sh.id == null)) emit('shot');
    const rings = list(s.rings).filter(r => r && r.hostile !== false);
    if (rings.some(r => r.id != null && !P.rings.has(r.id)) || (rings.length > P.ringCount && rings.every(r => r.id == null))) {
      const r = rings[rings.length - 1] || {}; emit('shockwave', panFor(s, r.x, r.y));
    }
    if (tideOn(s) && P.tideHigh !== null) {
      const hi = !!s.tide.high, w = num(s.tide.warning);
      if (hi !== P.tideHigh) emit(hi ? 'tideHigh' : 'tideLow');
      else if (w > 0 && P.tideWarn <= 0) emit(hi ? 'tideFall' : 'tideRise');
    }
    list(s.shutters).forEach((sh, i) => {
      const o = P.shutters[idOf(sh, i)]; if (!o) return; const open = sh.open !== false, pos = panFor(s, sh.x + (sh.w || 0) / 2, sh.y + (sh.h || 0) / 2);
      if (pos.dist > 560) return; // only the doorways near Sera are worth hearing
      pos.gain *= clamp(1.2 - pos.dist / 500, .3, 1);
      if (o.open && !open) emit('shutterClose', pos); else if (!o.open && open) emit('shutterOpen', pos);
      else if ((num(sh.warning) > 0 && o.warn <= 0 && open) || (typeof sh.phase === 'string' && sh.phase !== o.phase && /warn|closing/.test(sh.phase))) emit('shutterWarn', pos);
    });
    if (s.escort && P.escortHp !== null && num(s.escort.hp) < P.escortHp) emit('escortHurt', panFor(s, s.escort.x, s.escort.y));
    const seen = {};
    list(s.pickups).forEach((pk, i) => {
      const k = idOf(pk, i), o = P.pickups[k]; seen[k] = 1;
      if (o && !o.got && (pk.collected || pk.taken || pk.got) && pk.kind !== 'prism') emit(pk.kind === 'heart' ? 'heart' : 'chart');
    });
    for (const k in P.pickups) if (!seen[k] && !P.pickups[k].got && P.pickups[k].kind !== 'prism') emit(P.pickups[k].kind === 'heart' ? 'heart' : 'chart');
    if (s.rescue && s.rescue.freed && !P.freed && s.status !== 'won') emit('rescue');
    if (s.beacon && (s.beacon.lit || s.beacon.active) && !P.beacon) emit('beacon', { delay: bossFrame === t ? 1.4 : 0 });
    prev = snap(s);
  }
  function score(s) {
    const roomId = roomOf(s), enemies = list(s.enemies), diver = enemies.find(isDiver), hart = enemies.find(isHart);
    const region = (s.room && s.room.region) || s.regionId, green = region === VERDANT;
    let key = ROOM_SONG[roomId] || (green ? 'verdant' : 'cloister');
    if (diver && awake(diver)) key = 'boss';
    if (hart && awake(hart)) key = 'hart';
    if (s.status === 'won' || s.status === 'cleared') key = green ? 'glade' : 'victory';
    desired.key = key;
    desired.combat = enemies.some(awake);
    const boss = key === 'hart' ? hart : diver;
    desired.intense = !!(boss && num(boss.hp) > 0 && num(boss.hp) <= num(boss.maxHp || (boss === hart ? 8 : 10)) / 2);
    desired.duck = s.status === 'lost';
    desired.water = tideOn(s) || list(s.water).length > 0;
    desired.tide = tideOn(s) ? clamp(num(s.tide.level), 0, 1) : .5;
  }

  function update(s, dt) {
    try {
      if (!s || typeof s !== 'object') return;
      detect(s, dt); score(s);
      if (engine && enabled) { engine.setMusic(desired); engine.setBeam(!!desired.beam && s.status === 'playing', desired.charge || 0); }
    } catch (e) {
      if (!warned) { warned = true; try { console.warn('PW.Audio.update', e); } catch (x) { /* no console */ } }
    }
  }
  function enable(on) {
    enabled = !!on;
    try {
      if (enabled) {
        if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return false;
        if (!engine) { ctx = new AC({ latencyHint: 'interactive' }); engine = makeEngine(ctx, true); }
        if (ctx.state !== 'running' && ctx.resume) { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); }
        engine.setMuted(false); engine.setMusic(desired); engine.start();
        return true;
      }
      if (engine) {
        engine.setMuted(true);
        if (stopTimer) clearTimeout(stopTimer);
        stopTimer = setTimeout(() => {
          stopTimer = null; if (enabled || !engine) return;
          engine.stop(); if (ctx.suspend) { const r = ctx.suspend(); if (r && r.catch) r.catch(() => {}); }
        }, 450);
      }
    } catch (e) { engine = null; ctx = null; enabled = false; return false; }
    return false;
  }
  function cue(name) {
    log.push(name); if (log.length > 200) log.shift();
    if (!engine || !enabled) return false;
    try { return engine.cue(name, null, {}); } catch (e) { return false; }
  }
  // Offline render path for verification tools: renders music timeline + cues to an AudioBuffer.
  function render(opts) {
    opts = opts || {};
    const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OAC) return Promise.reject(new Error('OfflineAudioContext unavailable'));
    const rate = opts.sampleRate || 44100, secs = opts.seconds || 20;
    const octx = new OAC(2, Math.ceil(rate * secs), rate), E = makeEngine(octx, false);
    const events = [];
    for (const m of opts.music || []) events.push({ t: m.t || 0, fn: () => E.setMusic(Object.assign({ key: 'cloister' }, m), m.t || 0) });
    for (const c of opts.cues || []) events.push({ t: c[0], fn: () => E.cue(c[1], c[0], Object.assign({}, c[2] || {})) });
    if (opts.muteAt != null) events.push({ t: opts.muteAt, fn: () => E.setMuted(true, opts.muteAt) });
    if (opts.beam) events.push({ t: opts.beam[0], fn: () => { E.setBeam(true, 0, opts.beam[0]); E.setBeam(false, 0, opts.beam[1]); } });
    events.sort((a, b) => a.t - b.t);
    for (const ev of events) { E.schedule(ev.t); ev.fn(); }
    E.schedule(secs);
    return octx.startRendering();
  }

  PW.Audio = {
    enable, cue, update,
    isEnabled: () => enabled,
    cues: () => Object.keys(CUE_LEN),
    songs: () => Object.keys(SONGS),
    _log: log,
    _counts: counts,
    _render: render,
    _analyser: () => (engine && engine.analyser) || null,
    _desired: () => Object.assign({}, desired)
  };
})(typeof window !== 'undefined' ? window : globalThis);
