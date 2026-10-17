/* Shiftmaw core: namespace helpers, storage, input. Classic script, no modules. */
(function (global) {
  'use strict';
  var SM = global.SM = global.SM || {};
  var PREFIX = 'shiftmaw:';

  SM.store = {
    get: function (k, d) { try { var v = global.localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { global.localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  SM.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  SM.lerp = function (a, b, t) { return a + (b - a) * t; };
  SM.fmt = function (n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  SM.isTouch = ('ontouchstart' in global) || (global.navigator && global.navigator.maxTouchPoints > 0);

  /* Input: keyboard + swipe. Emits via callbacks set on SM.Input.on{Dir,Flip,Pause,Mute} */
  var KEYDIR = { ArrowUp: 0, KeyW: 0, ArrowLeft: 1, KeyA: 1, ArrowDown: 2, KeyS: 2, ArrowRight: 3, KeyD: 3 };
  var I = SM.Input = { onDir: null, onFlip: null, onPause: null, onMute: null, onAny: null, held: {} };

  I.bindKeys = function () {
    global.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var code = e.code;
      if (I.onAny) I.onAny(e);
      if (code in KEYDIR) { e.preventDefault(); if (I.onDir) I.onDir(KEYDIR[code]); }
      else if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') { e.preventDefault(); if (!e.repeat && I.onFlip) I.onFlip(); }
      else if (code === 'KeyP' || code === 'Escape') { if (!e.repeat && I.onPause) I.onPause(); }
      else if (code === 'KeyM') { if (!e.repeat && I.onMute) I.onMute(); }
    });
  };

  /* Swipe on an element: direction fires as soon as the finger travels `min` px, then re-bases so
     the player can chain turns without lifting. */
  I.bindSwipe = function (el) {
    var sx = 0, sy = 0, id = null, min = 16;
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      id = e.pointerId; sx = e.clientX; sy = e.clientY;
      if (I.onAny) I.onAny(e);
      try { el.setPointerCapture(id); } catch (x) { /* noop */ }
    });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerId !== id) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) < min && Math.abs(dy) < min) return;
      var d = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 3) : (dy < 0 ? 0 : 2);
      if (I.onDir) I.onDir(d);
      sx = e.clientX; sy = e.clientY;
    });
    var end = function (e) { if (e.pointerId === id) id = null; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.style.touchAction = 'none';
  };
})(typeof window !== 'undefined' ? window : globalThis);
