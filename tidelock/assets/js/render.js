(function (global) {
  'use strict';
  var TL = global.TL = global.TL || {};
  function draw(canvas, s, time) {
    var c = canvas.getContext('2d'), w = canvas.width, h = canvas.height, L = TL.Logic;
    c.clearRect(0, 0, w, h);
    var unit = Math.min(w / (L.W + 3), h / (L.H + 3)), ox = (w - L.W * unit) / 2, oy = (h - L.H * unit) / 2;
    var g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#123840'); g.addColorStop(1, '#061c2a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.save(); c.translate(ox, oy); c.scale(unit, unit);
    c.strokeStyle = '#27535a'; c.lineWidth = 0.025;
    // Bathymetric contours: stable, procedural, and deliberately quiet under play.
    for (var row = 0; row < 15; row++) {
      c.beginPath();
      for (var x = 0; x < L.W; x += 0.25) {
        var y = row * 2 + Math.sin(x * 0.3 + row * 0.9) * 1.4;
        if (!x) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    for (var y = 0; y < L.H; y++) for (var x = 0; x < L.W; x++) {
      if (s.cells[L.index(x, y)]) {
        var edge = !x || !y || x === L.W - 1 || y === L.H - 1;
        c.fillStyle = edge ? '#8d9b86' : ((x * 13 + y * 7) % 5 ? '#3c7770' : '#498278');
        c.fillRect(x, y, 1, 1);
        c.fillStyle = edge ? '#c5c1a0' : '#80b3a0'; c.fillRect(x, y, 1, 0.07);
        c.strokeStyle = '#102e32'; c.lineWidth = 0.035; c.strokeRect(x, y, 1, 1);
      } else {
        c.fillStyle = '#32606a'; c.fillRect(x + 0.48, y + 0.48, 0.045, 0.045);
      }
    }
    // Compass rose is chart ornament; hazards and buoys have their own silhouettes.
    c.save(); c.translate(27, 5); c.strokeStyle = '#487179'; c.lineWidth = 0.06;
    c.beginPath(); c.arc(0, 0, 2.5, 0, Math.PI * 2); c.stroke();
    for (var a = 0; a < 8; a++) {
      c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(0, -3.1); c.lineTo(0.3, 0); c.lineTo(0, 1); c.closePath(); c.stroke();
    } c.restore();
    s.buoys.forEach(function (b) {
      if (b.saved) return;
      var bob = Math.sin(time * 2 + b.x) * 0.08;
      c.save(); c.translate(b.x + 0.5, b.y + 0.5 + bob);
      c.strokeStyle = '#dcb978'; c.lineWidth = 0.055;
      c.beginPath(); c.arc(0, 0, 0.65 + Math.sin(time * 2) * 0.07, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#ffe2a1'; c.beginPath(); c.moveTo(0, -0.45); c.lineTo(0.32, 0); c.lineTo(0, 0.45); c.lineTo(-0.32, 0); c.closePath(); c.fill();
      c.restore();
    });
    if (s.trail.length) {
      c.strokeStyle = '#ffd697'; c.lineWidth = 0.2; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(s.anchor.x + 0.5, s.anchor.y + 0.5);
      s.trail.forEach(function (p) { c.lineTo(p.x + 0.5, p.y + 0.5); }); c.stroke();
      s.trail.forEach(function (p) { c.fillStyle = '#fff2cc'; c.fillRect(p.x + 0.36, p.y + 0.36, 0.28, 0.28); });
    }
    s.enemies.forEach(function (e, i) {
      c.save(); c.translate(e.x + 0.5, e.y + 0.5); c.rotate(time * (s.freeze ? 0.1 : 1.5) + i);
      var glow = c.createRadialGradient(0, 0, 0, 0, 0, 2);
      glow.addColorStop(0, s.freeze ? '#8edacb80' : '#ef775380'); glow.addColorStop(1, '#ef775300');
      c.fillStyle = glow; c.fillRect(-2, -2, 4, 4);
      c.strokeStyle = s.freeze ? '#bcfff0' : '#ff9873'; c.lineWidth = 0.12;
      for (var a = 0; a < 3; a++) {
        c.rotate(Math.PI * 2 / 3); c.beginPath(); c.moveTo(-0.8, 0.5); c.quadraticCurveTo(-0.7, -1.2, 0.6, -0.25); c.stroke();
      }
      c.fillStyle = '#fff1cb'; c.beginPath(); c.arc(0, 0, 0.16, 0, Math.PI * 2); c.fill(); c.restore();
    });
    c.save(); c.translate(s.player.x + 0.5, s.player.y + 0.5);
    if (!s.invulnerable || Math.floor(time * 12) % 2) {
      c.fillStyle = '#fff9d5'; c.strokeStyle = '#0a3439'; c.lineWidth = 0.1;
      c.beginPath(); c.moveTo(0, -0.65); c.lineTo(0.5, 0.45); c.lineTo(0, 0.23); c.lineTo(-0.5, 0.45); c.closePath(); c.fill(); c.stroke();
    } c.restore();
    c.restore();
    c.strokeStyle = '#bbbf9e'; c.lineWidth = Math.max(1, unit * 0.08); c.strokeRect(ox - unit * 0.3, oy - unit * 0.3, (L.W + 0.6) * unit, (L.H + 0.6) * unit);
  }
  TL.Render = { draw: draw };
})(window);
