/* Cinderwick core: global namespace, constants, seeded RNG, small helpers. */
(function (root) {
  'use strict';
  var CW = root.CW = root.CW || {};
  CW.GAME_ID = 'cinderwick';
  CW.W = 15;            // grid columns
  CW.H = 13;            // grid rows
  CW.T = { FLOOR: 0, WALL: 1, CRATE: 2 };
  CW.PALETTE = {
    void: '#0b0706', floorA: '#3a2a22', floorB: '#33251e', wall: '#6b5a52',
    wallLit: '#8d786c', crate: '#a8692f', ember: '#ff8a2a', hot: '#ffd36b',
    fuse: '#ffcf70', ink: '#fff3e0', teal: '#46d6c1', danger: '#ff3d4a'
  };
  CW.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  CW.lerp = function (a, b, t) { return a + (b - a) * t; };
  // mulberry32: deterministic seeded generator returning a function () -> [0,1)
  CW.makeRng = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
