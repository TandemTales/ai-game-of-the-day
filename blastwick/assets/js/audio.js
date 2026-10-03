/* Blastwick - procedural WebAudio: SFX and a looping chiptune-ish groove. */
(function (root) {
  'use strict';
  var BW = root.BW = root.BW || {};
  var ctx = null, master, sfxBus, musBus, noiseBuf, muted = false, musicOn = false, nextT = 0, step = 0, timer = null, intensity = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
    var comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = 0.32; musBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function osc(type, f0, f1, dur, vol, bus, when) {
    if (!ctx) return; var t = when || ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, f0, f1, vol, type, bus, when) {
    if (!ctx) return; var t = when || ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type || 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t); s.stop(t + dur + 0.05);
  }

  var A = BW.Audio = {
    init: init,
    setMuted: function (m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; },
    isMuted: function () { return muted; },
    setIntensity: function (v) { intensity = v; },
    place: function () { osc('sine', 180, 60, 0.18, 0.5); noise(0.05, 2000, 500, 0.15, 'highpass'); },
    explode: function (chain, cells) {
      noise(0.7, 2400, 80, 0.9, 'lowpass'); osc('sawtooth', 120, 28, 0.6, 0.55);
      noise(0.25, 6000, 1200, 0.35, 'highpass');
      if (chain > 1) osc('square', 220 * Math.pow(1.122, Math.min(chain, 10)), 60, 0.25, 0.12);
    },
    bounce: function () { var f = 1318; osc('triangle', f, f * 1.5, 0.35, 0.3); osc('sine', f * 2, f * 3, 0.5, 0.18); },
    crate: function () { noise(0.12, 3000, 400, 0.4, 'bandpass'); osc('square', 140, 70, 0.08, 0.15); },
    pickup: function () { var t = ctx && ctx.currentTime; [523, 659, 784, 1047].forEach(function (f, i) { osc('square', f, 0, 0.12, 0.14, sfxBus, t + i * 0.06); }); },
    death: function () { osc('sawtooth', 400, 50, 0.7, 0.3); noise(0.5, 1800, 100, 0.4, 'lowpass'); },
    shield: function () { osc('triangle', 300, 900, 0.3, 0.3); },
    collapse: function () { noise(0.3, 500, 60, 0.6, 'lowpass'); osc('sine', 70, 30, 0.35, 0.5); },
    win: function () { var t = ctx && ctx.currentTime; [523, 659, 784, 1047, 1319].forEach(function (f, i) { osc('square', f, 0, 0.25, 0.16, sfxBus, t + i * 0.09); osc('triangle', f / 2, 0, 0.3, 0.2, sfxBus, t + i * 0.09); }); },
    lose: function () { var t = ctx && ctx.currentTime; [392, 330, 262, 196].forEach(function (f, i) { osc('sawtooth', f, f * 0.97, 0.3, 0.16, sfxBus, t + i * 0.16); }); },
    ui: function () { osc('square', 660, 880, 0.08, 0.12); },
    handle: function (events) {
      if (!ctx) return;
      var done = {};
      for (var i = 0; i < events.length; i++) {
        var e = events[i];
        if (e.type === 'explode') { if (!done.ex) { A.explode(e.chain, e.cells.length); done.ex = 1; } }
        else if (done[e.type]) continue;
        else if (e.type === 'place') A.place(); else if (e.type === 'bounce') A.bounce(); else if (e.type === 'crate') A.crate();
        else if (e.type === 'pickup') A.pickup(); else if (e.type === 'death') A.death(); else if (e.type === 'collapse') A.collapse();
        else if (e.type === 'shield') A.shield(); else if (e.type === 'won') A.win();
        done[e.type] = 1;
      }
    },
    startMusic: function () { if (!ctx || musicOn) return; musicOn = true; nextT = ctx.currentTime + 0.1; step = 0; sched(); },
    stopMusic: function () { musicOn = false; clearTimeout(timer); }
  };

  // 16-step groove in A minor; bass + arp + hats + kick
  var BASS = [57, 0, 57, 0, 57, 0, 60, 0, 55, 0, 55, 0, 55, 0, 52, 0];
  var ARP = [69, 72, 76, 72, 69, 72, 76, 81, 67, 71, 74, 71, 67, 71, 74, 79];
  function mf(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function sched() {
    if (!musicOn || !ctx) return;
    var spb = 0.15 - intensity * 0.02;
    while (nextT < ctx.currentTime + 0.3) {
      var s = step % 16, t = nextT;
      if (BASS[s]) osc('sawtooth', mf(BASS[s] - 12), 0, spb * 1.6, 0.25, musBus, t);
      if (s % 4 === 0) osc('sine', 130, 45, 0.16, 0.7, musBus, t);
      if (s % 2 === 1) noise(0.04, 9000, 6000, 0.12, 'highpass', musBus, t);
      if (s === 4 || s === 12) noise(0.12, 3000, 800, 0.2, 'bandpass', musBus, t);
      if (step % 64 >= 16 || intensity > 0.4) osc('square', mf(ARP[s]), 0, spb * 0.9, 0.07, musBus, t);
      nextT += spb; step++;
    }
    timer = setTimeout(sched, 60);
  }
})(window);
