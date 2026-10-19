(function (global) {
  'use strict';
  var GR = global.GR = global.GR || {}, ctx = null, master = null, state = 'idle', lastWaka = 0, droneNodes = null;
  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) { state = 'unavailable'; return null; }
    try { ctx = new AC(); master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination); } catch (e) { state = 'unavailable'; ctx = null; }
    return ctx;
  }
  function tone(freq, dur, type, vol, slide, when) {
    if (!ensure() || ctx.state !== 'running') return;
    var t = ctx.currentTime + (when || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .2, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
  }
  var api = {
    unlock: function () { if (ensure() && ctx.state === 'suspended') ctx.resume().then(function () { state = 'ok'; }, function () { state = 'blocked'; }); },
    begin: function () { api.unlock(); },
    status: function () { return !ctx ? state : ctx.state === 'running' ? 'ok' : ctx.state === 'suspended' ? 'blocked' : state; },
    mote: function () { var n = performance.now(); if (n - lastWaka < 60) return; lastWaka = n; tone(520 + (Math.floor(n / 130) % 2) * 160, .09, 'triangle', .12); },
    lantern: function () { tone(300, .4, 'sine', .25, 900); tone(600, .5, 'triangle', .12, 1500, .05); },
    eat: function (chain) { tone(400 * Math.pow(1.26, chain), .25, 'square', .12, 1400); },
    gates: function () { tone(180, .35, 'sawtooth', .14, 70); tone(540, .15, 'triangle', .15, 800, .12); },
    die: function () { for (var i = 0; i < 6; i++) tone(700 - i * 90, .18, 'sawtooth', .15, 200, i * .12); },
    bloom: function () { [660, 880, 1100].forEach(function (f, i) { tone(f, .15, 'triangle', .15, 0, i * .07); }); },
    clear: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, .3, 'triangle', .2, 0, i * .12); }); },
    ambient: function (danger) { // low heartbeat tied to how close the nearest hunter is
      if (!ensure() || ctx.state !== 'running') return;
      var n = performance.now(), gap = 900 - danger * 600;
      if (n - (api._beat || 0) > gap) { api._beat = n; tone(55 + danger * 25, .22, 'sine', .22); }
    }
  };
  GR.Audio = api;
})(window);
