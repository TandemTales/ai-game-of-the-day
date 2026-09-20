(function (root) {
  'use strict';
  const PW = root.PW = root.PW || {};
  const TAU = Math.PI * 2;
  const C = { stone: '#364c51', light: '#829591', edge: '#192e36', gold: '#f3ca78', mint: '#8ff2ce', ink: '#102832' };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function view(s, width, height) {
    width = Math.max(1, width); height = Math.max(1, height);
    const closeScale = width < 650 ? Math.min(width / 500, height / 440) : 0;
    const scale = Math.max(width / 1024, height / 768, closeScale);
    const w = width / scale, h = height / scale;
    const p = s && s.player || { x: 190, y: 540 };
    return { x: clamp(p.x - w / 2, 0, 1024 - w), y: clamp(p.y - h / 2, 0, 768 - h), w, h, scale };
  }
  PW.view = view;
  PW.screenToWorld = function (s, w, h, x, y) {
    const v = view(s, w, h);
    return { x: v.x + x / v.scale, y: v.y + y / v.scale };
  };
  function path(ctx, pts, fill, stroke, lw) {
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function line(ctx, x, y, x2, y2, color, width) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width || 1; ctx.stroke();
  }
  function circle(ctx, x, y, r, color, stroke, width) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1; ctx.stroke(); }
  }
  function glow(ctx, x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'transparent');
    circle(ctx, x, y, r, g);
  }
  function text(ctx, str, x, y, size, color, align) {
    ctx.font = `600 ${size}px system-ui, sans-serif`; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#10202b'; ctx.strokeText(str, x, y); ctx.fillStyle = color || '#eff7e8'; ctx.fillText(str, x, y);
  }
  function slab(ctx, x, y, w, h, color) {
    ctx.fillStyle = '#071d27'; ctx.fillRect(x + 3, y + 8, w, h);
    ctx.fillStyle = color || C.stone; ctx.fillRect(x, y, w, h);
    line(ctx, x + 1, y + 1, x + w - 1, y + 1, '#81918b', 2);
    line(ctx, x + 1, y + 2, x + 1, y + h, '#556e70', 1);
    line(ctx, x + w, y + 2, x + w, y + h, '#132f39', 3);
    line(ctx, x + 2, y + h, x + w, y + h, '#102e37', 4);
  }
  function background(ctx, t) {
    const water = ctx.createLinearGradient(0, 0, 1024, 768);
    water.addColorStop(0, '#0a313e'); water.addColorStop(0.55, '#163f47'); water.addColorStop(1, '#071e2d');
    ctx.fillStyle = water; ctx.fillRect(0, 0, 1024, 768);
    for (let i = 0; i < 60; i++) {
      const x = (i * 193 + 21) % 1024, y = (i * 127 + 19) % 768;
      const wave = Math.sin(t * 0.7 + i) * 5;
      line(ctx, x + wave, y, x + 20 + (i % 4) * 9 + wave, y, i % 3 ? '#285664' : '#37666d', 1);
    }
    // Submerged old colonnade beneath the newly exposed courtyard.
    ctx.globalAlpha = 0.35;
    for (let x = 92; x < 980; x += 112) { circle(ctx, x, 28, 20, '#315965', '#416970', 2); circle(ctx, x, 735, 20, '#294b58'); }
    ctx.globalAlpha = 1;
    path(ctx, [[50, 61], [957, 61], [973, 705], [58, 705]], '#081c23');
    slab(ctx, 58, 66, 906, 628, '#344a4c');
    // Hand-set flagstones, deterministic chipped edges and weathering.
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 17; col++) {
        const x = 60 + col * 55 - (row % 2) * 27, y = 70 + row * 52;
        if (x < 59 || x + 52 > 960) continue;
        const n = (row * 29 + col * 17) % 11;
        ctx.fillStyle = ['#405453', '#3b5050', '#435654', '#394e50'][n % 4];
        ctx.fillRect(x + 1, y + 1, 52, 49);
        line(ctx, x + 3, y + 2, x + 48, y + 2, '#536562', 0.8);
        if (n < 3) {
          line(ctx, x + 15, y + 3, x + 22, y + 20, '#273f43', 1);
          line(ctx, x + 22, y + 20, x + 16, y + 30, '#273f43', 1);
        }
        if (n === 4) { ctx.fillStyle = '#3d655a'; ctx.fillRect(x + 3, y + 40, 16, 4); }
      }
    }
    // Inlaid optical track through the abbey's central nave.
    line(ctx, 88, 340, 687, 340, '#22393b', 23);
    line(ctx, 88, 328, 687, 328, '#7e8061', 2);
    line(ctx, 88, 352, 687, 352, '#7e8061', 2);
    circle(ctx, 550, 340, 49, '#354b4c', '#8b8b67', 2);
    circle(ctx, 550, 340, 39, null, '#647966', 1);
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8;
      line(ctx, 550 + Math.cos(a) * 40, 340 + Math.sin(a) * 40, 550 + Math.cos(a) * 47, 340 + Math.sin(a) * 47, '#a7a07b', 2);
    }
    line(ctx, 550, 123, 550, 310, '#687c6d', 2);
    for (let y = 151; y < 316; y += 33) path(ctx, [[547, y], [550, y - 4], [553, y], [550, y + 4]], '#9c9b71');
    // Ritual arena and sanctuary are identifiable even before their circuits light.
    circle(ctx, 845, 245, 105, '#314247', '#6d7870', 3);
    circle(ctx, 845, 245, 91, null, '#4e635f', 1);
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12;
      line(ctx, 845 + Math.cos(a) * 96, 245 + Math.sin(a) * 96, 845 + Math.cos(a) * 103, 245 + Math.sin(a) * 103, '#909279', 3);
    }
    circle(ctx, 280, 620, 41, '#2a4949', '#687b63', 2);
    path(ctx, [[244, 620], [280, 584], [316, 620], [280, 656]], null, '#6d816c', 1);
    // Shallow pools at the platform edge stay decorative; collision comes from state.
    ctx.fillStyle = '#21474a'; ctx.fillRect(68, 677, 883, 10);
    for (let i = 0; i < 25; i++) {
      const x = 88 + i * 35;
      line(ctx, x, 679, x + 16, 678 + Math.sin(t + i) * 2, '#47746d', 1);
    }
  }
  function wall(ctx, w) {
    if (![w.x, w.y, w.w, w.h].every(Number.isFinite)) return;
    ctx.fillStyle = '#0c242bcc'; ctx.fillRect(w.x + 8, w.y + 12, w.w, w.h);
    slab(ctx, w.x, w.y - 7, w.w, w.h, '#52605c');
    ctx.fillStyle = '#283e40'; ctx.fillRect(w.x, w.y + w.h - 7, w.w, 9);
    for (let x = w.x + 32; x < w.x + w.w; x += 40) line(ctx, x, w.y - 5, x, w.y + w.h - 9, '#344847', 2);
    for (let y = w.y + 29; y < w.y + w.h - 8; y += 34) line(ctx, w.x + 2, y, w.x + w.w - 2, y, '#334746', 2);
    ctx.fillStyle = '#536f58'; ctx.fillRect(w.x + 4, w.y - 5, Math.min(w.w - 8, 27), 3);
  }
  function receiver(ctx, r, t) {
    const lit = !!r.active, charge = clamp(Number(r.charge) || 0, 0, 1);
    const color = lit ? C.mint : C.gold;
    glow(ctx, r.x, r.y, lit ? 68 : 40, lit ? '#7bddbd33' : '#eebc6530');
    circle(ctx, r.x + 2, r.y + 6, 25, '#0a222b');
    circle(ctx, r.x, r.y, 23, '#263c42', '#afa780', 3);
    circle(ctx, r.x, r.y, 17, '#182e38', '#617778', 1);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; circle(ctx, r.x + Math.cos(a) * 22, r.y + Math.sin(a) * 22, 3, '#d8c38b'); }
    path(ctx, [[r.x, r.y - 12], [r.x + 9, r.y], [r.x, r.y + 12], [r.x - 9, r.y]], lit ? '#aff6d3' : '#697878', color, 2);
    if (charge > 0 && !lit) { ctx.beginPath(); ctx.arc(r.x, r.y, 29, -Math.PI / 2, -Math.PI / 2 + charge * TAU); ctx.strokeStyle = C.gold; ctx.lineWidth = 5; ctx.stroke(); }
    if (lit) circle(ctx, r.x, r.y, 29 + Math.sin(t * 2) * 2, null, '#8cd6b777', 1);
    text(ctx, r.id === 'gate' ? (lit ? 'GATE OPEN' : 'GATE LENS') : (lit ? 'SANCTUARY RESTORED' : 'SANCTUARY'), r.x, r.y + 41, 10, lit ? C.mint : '#d9d1b1');
  }
  function guardian(ctx, e, p, t) {
    const hp = Number(e.hp) || 0;
    if (hp <= 0) {
      circle(ctx, e.x, e.y, 25, '#273a3c');
      path(ctx, [[e.x - 22, e.y - 4], [e.x - 7, e.y - 19], [e.x + 4, e.y - 5], [e.x + 25, e.y + 7], [e.x + 4, e.y + 15], [e.x - 16, e.y + 9]], '#61716c', '#a9a384', 2);
      return;
    }
    const lunge = e.phase === 'lunge-windup' || e.phase === 'lunge';
    const warn = !lunge && /telegraph|charge|windup|aim/.test(e.phase || ''), exposed = !!e.exposed || e.phase === 'exposed';
    if (lunge) {
      const a = Math.atan2(e.aimY || 0, e.aimX === undefined ? -1 : e.aimX);
      const distance = e.phase === 'lunge' ? Math.max(0, (e.timer || 0) * 450) : 153;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      const alpha = e.phase === 'lunge' ? 0.44 : 0.2 + 0.1 * Math.sin(t * 16);
      ctx.fillStyle = `rgba(255,97,78,${alpha})`; ctx.fillRect(0, -31, distance + 29, 62);
      ctx.strokeStyle = '#ff9b87'; ctx.lineWidth = 2; ctx.strokeRect(0, -31, distance + 29, 62);
      for (let x = 27; x < distance + 12; x += 31) {
        line(ctx, x - 8, -12, x + 4, 0, '#ffd5ba', 3);
        line(ctx, x + 4, 0, x - 8, 12, '#ffd5ba', 3);
      }
      ctx.restore();
      circle(ctx, e.x, e.y, 35, null, '#ff977e', 3);
    }
    if (warn && p) {
      const a = Number.isFinite(e.aimX) ? Math.atan2(e.aimY, e.aimX) : Math.atan2(p.y - e.y, p.x - e.x);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      path(ctx, [[18, -7], [250, -22], [250, 22], [18, 7]], '#ff896128');
      ctx.setLineDash([8, 8]); line(ctx, 18, 0, 265, 0, '#ffc194b0', 2); ctx.setLineDash([]); ctx.restore();
      circle(ctx, e.x, e.y, 36 + Math.sin(t * 15) * 2, null, '#ffb382', 2);
    }
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.fillStyle = '#10252bbf'; ctx.beginPath(); ctx.ellipse(4, 17, 31, 15, 0, 0, TAU); ctx.fill();
    if (exposed) glow(ctx, 0, 0, 54, '#8effc866');
    path(ctx, [[-20, 18], [-21, -5], [-13, -25], [13, -25], [21, -5], [20, 18]], '#526769', '#a4aa97', 2);
    path(ctx, [[-26, 8], [-28, -7], [-17, -16], [-12, 5]], '#889289', '#bdbaa1', 2);
    path(ctx, [[26, 8], [28, -7], [17, -16], [12, 5]], '#7b8982', '#bdbaa1', 2);
    path(ctx, [[-15, -18], [-9, -31], [9, -31], [15, -18], [10, -8], [-10, -8]], '#acac94', '#293c40', 2);
    line(ctx, -9, -17, 9, -17, '#253e46', 5);
    line(ctx, -6, -17, 6, -17, lunge ? '#ff786b' : warn ? '#ffb582' : '#a7dfda', 2);
    path(ctx, [[0, -3], [9, 6], [0, 15], [-9, 6]], exposed ? '#b2ffdb' : '#cda978', '#172f38', 2);
    line(ctx, -13, 13, -15, 25, '#35464a', 8); line(ctx, 13, 13, 15, 25, '#35464a', 8);
    ctx.fillStyle = '#112c36'; ctx.fillRect(-29, -46, 58, 5);
    ctx.fillStyle = exposed ? C.mint : '#eda984'; ctx.fillRect(-28, -45, 56 * clamp(hp / (e.maxHp || hp), 0, 1), 3);
    text(ctx, exposed ? 'ARMOR OPEN' : lunge ? 'DODGE • UNBLOCKABLE' : warn ? 'RETURN THE SHOT' : 'BELL SENTINEL', 0, -57, 10, exposed ? C.mint : lunge ? '#ffb79c' : '#e5d7bd');
    ctx.restore();
  }
  function player(ctx, p, t) {
    ctx.save(); ctx.translate(p.x, p.y);
    const a = Math.atan2(p.aimY || 0, p.aimX === undefined ? 1 : p.aimX);
    ctx.fillStyle = '#092631af'; ctx.beginPath(); ctx.ellipse(2, 12, 19, 9, 0, 0, TAU); ctx.fill();
    if (p.invulnerable > 0 && Math.floor(t * 14) % 2) ctx.globalAlpha = 0.6;
    if (p.dashTime > 0) { ctx.save(); ctx.rotate(a); path(ctx, [[-45, -9], [-3, -13], [12, 0], [-3, 13], [-45, 9]], '#b4f3e34a'); ctx.restore(); }
    path(ctx, [[-10, -5], [-16, 16], [0, 21], [15, 15], [10, -5]], '#183942', '#75a9a1', 1.5);
    path(ctx, [[-4, -4], [-8, 14], [0, 19], [6, 13], [4, -5]], '#3f7e7d');
    circle(ctx, 0, -7, 10, '#c8c1a0', '#23424a', 2);
    path(ctx, [[-10, -8], [-6, -17], [5, -18], [11, -8], [6, -3], [-5, -3]], '#e1ddd0', '#668b89', 1.5);
    line(ctx, -5, -7, 6, -7, '#294d57', 3);
    ctx.save(); ctx.rotate(a);
    // Facing arrow is deliberately visible when the shield is down as well.
    path(ctx, [[29, 0], [23, -3], [23, 3]], p.reflecting ? C.mint : '#d3d9bb');
    if (p.reflecting) {
      glow(ctx, 18, 0, 34, '#c5f5d938');
      ctx.beginPath(); ctx.arc(0, 0, 23, -1.0, 1.0); ctx.strokeStyle = '#8cf2d3'; ctx.lineWidth = 4; ctx.stroke();
    }
    path(ctx, [[15, -13], [24, -8], [26, 5], [18, 13], [12, 5]], p.reflecting ? '#8adecb' : '#729398', C.gold, 2);
    path(ctx, [[17, -8], [22, -5], [21, 5], [17, 7]], '#e6ffdf');
    if (p.slashTime > 0) {
      ctx.beginPath(); ctx.arc(0, 0, 47, -1.4, 1.4); ctx.strokeStyle = '#f8e6b5bb'; ctx.lineWidth = 9; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 51, -1.25, 1.25); ctx.strokeStyle = '#fff6d3'; ctx.lineWidth = 2; ctx.stroke();
      path(ctx, [[8, 6], [48, -8], [39, 2], [11, 12]], '#f2edd5', '#bdc3af', 1);
    } else {
      path(ctx, [[2, 12], [28, 25], [24, 19], [6, 8]], '#d4d8c4', '#243c43', 1);
      line(ctx, 2, 14, 8, 6, '#d5ba77', 3);
    }
    ctx.restore(); ctx.restore();
  }
  function edges(ctx, s, v, width, height) {
    const objectives = [];
    const gate = (s.receivers || []).find(r => r.id === 'gate');
    if (gate && !gate.active) objectives.push({ x: gate.x, y: gate.y, label: 'GATE LENS', color: C.gold });
    else {
      const enemy = (s.enemies || []).find(e => e.hp > 0);
      if (enemy) objectives.push({ x: enemy.x, y: enemy.y, label: 'SENTINEL', color: '#efb38e' });
      else if (s.rescue && !s.rescue.freed) objectives.push({ x: s.rescue.x, y: s.rescue.y, label: 'KEEPER', color: C.mint });
    }
    const p = s.player || { x: 190, y: 540 };
    if (gate && !gate.active && Math.abs(p.y - 340) > 75) objectives.push({ x: 550, y: 340, label: 'SUNBEAM', color: C.gold });
    const indicators = [];
    for (const o of objectives) {
      const x = (o.x - v.x) * v.scale, y = (o.y - v.y) * v.scale;
      if (x > 20 && x < width - 20 && y > 20 && y < height - 20) continue;
      const cx = clamp(x, 58, Math.max(58, width - 58));
      let cy = clamp(y, 43, Math.max(43, height - 80));
      for (const previous of indicators) {
        if (Math.abs(cx - previous.x) < 96 && Math.abs(cy - previous.y) < 44) {
          cy = previous.y + 44 <= height - 38 ? previous.y + 44 : previous.y - 44;
        }
      }
      indicators.push({ x: cx, y: cy });
      const a = Math.atan2(y - cy, x - cx);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); path(ctx, [[12, 0], [-1, -6], [-1, 6]], o.color, '#102832', 2); ctx.restore();
      ctx.fillStyle = '#102b36dd'; ctx.fillRect(cx - 44, cy + 13, 88, 19);
      text(ctx, o.label, cx, cy + 23, 10, o.color);
    }
  }
  PW.draw = function (ctx, state, width, height, dpr) {
    if (!ctx || !width || !height) return;
    const s = state || {}, t = Number(s.time) || 0, v = view(s, width, height);
    ctx.save(); ctx.setTransform(dpr || 1, 0, 0, dpr || 1, 0, 0); ctx.clearRect(0, 0, width, height);
    ctx.save(); ctx.scale(v.scale, v.scale); ctx.translate(-v.x, -v.y);
    background(ctx, t);
    (s.walls || []).forEach(w => wall(ctx, w));
    for (const g of s.gates || []) {
      if (g.open) {
        line(ctx, g.x + g.w / 2, g.y, g.x + g.w / 2, g.y + g.h, '#8adac34a', 6);
      } else {
        ctx.fillStyle = '#183740bf'; ctx.fillRect(g.x, g.y, g.w, g.h);
        for (let y = g.y + 8; y < g.y + g.h; y += 18) line(ctx, g.x + 3, y, g.x + g.w - 3, y, '#d0b478', 4);
        line(ctx, g.x + 2, g.y, g.x + 2, g.y + g.h, '#779993', 4);
        line(ctx, g.x + g.w - 2, g.y, g.x + g.w - 2, g.y + g.h, '#779993', 4);
        text(ctx, 'SEALED', g.x + g.w / 2, g.y + g.h / 2, 9, C.gold);
      }
      circle(ctx, g.x + g.w / 2, g.y, 12, '#4e6b68', '#bcb28b', 2);
      circle(ctx, g.x + g.w / 2, g.y + g.h, 12, '#4e6b68', '#bcb28b', 2);
    }
    const emitter = s.emitter || { x: 70, y: 340 };
    glow(ctx, emitter.x, emitter.y, 65, '#edc67844');
    circle(ctx, emitter.x, emitter.y, 24, '#334c50', '#b1ac8c', 3);
    circle(ctx, emitter.x, emitter.y, 15, '#e9d398', '#fff2c2', 2);
    path(ctx, [[emitter.x - 8, emitter.y], [emitter.x, emitter.y - 11], [emitter.x + 8, emitter.y], [emitter.x, emitter.y + 11]], '#fff8d2');
    for (const b of s.beams || []) {
      const reflected = b.kind === 'reflected', color = reflected ? '#adffe3' : '#ffdb88';
      line(ctx, b.x1, b.y1, b.x2, b.y2, reflected ? '#87e9c822' : '#ffd98c22', 22);
      line(ctx, b.x1, b.y1, b.x2, b.y2, reflected ? '#a3ffd64f' : '#ffd68a50', 10);
      line(ctx, b.x1, b.y1, b.x2, b.y2, color, 3.5);
      line(ctx, b.x1, b.y1, b.x2, b.y2, '#fffce7', 1);
      glow(ctx, b.x2, b.y2, 20, reflected ? '#caffdd55' : '#ffe4a355');
    }
    (s.receivers || []).forEach(r => receiver(ctx, r, t));
    if (s.rescue) {
      const r = s.rescue;
      glow(ctx, r.x, r.y, 49, '#83edc733');
      circle(ctx, r.x, r.y + 10, 14, '#12303a');
      path(ctx, [[r.x, r.y - 5], [r.x + 11, r.y + 13], [r.x - 11, r.y + 13]], '#b1bca5', '#8df1cd', 1);
      circle(ctx, r.x, r.y - 8, 7, '#ddd0a6');
      if (!r.freed) {
        circle(ctx, r.x, r.y, 25, null, '#85dec29c', 2);
        for (let i = -1; i <= 1; i++) line(ctx, r.x + i * 13, r.y - 20, r.x + i * 13, r.y + 20, '#a0e8dc66', 2);
      }
      const activeGuardian = (s.enemies || []).some(e => e.hp > 0 && e.phase !== 'dormant');
      if (!activeGuardian) text(ctx, r.freed ? 'ILEX • SAFE' : 'KEEPER ILEX', r.x, r.y + 37, 10, C.mint);
    }
    (s.enemies || []).forEach(e => guardian(ctx, e, s.player, t));
    for (const b of s.shots || []) {
      const speed = Math.hypot(b.vx || 0, b.vy || 0) || 1, color = b.friendly ? C.mint : '#ffba8f';
      line(ctx, b.x - (b.vx || 0) / speed * 20, b.y - (b.vy || 0) / speed * 20, b.x, b.y, b.friendly ? '#86ffd688' : '#ff975e88', 5);
      glow(ctx, b.x, b.y, 22, b.friendly ? '#8effd455' : '#ffa96955');
      circle(ctx, b.x, b.y, 6, color, '#fff1c9', 1.5);
    }
    if (s.player) player(ctx, s.player, t);
    for (const p of s.particles || []) {
      ctx.globalAlpha = clamp((p.life || 0) * 2, 0, 1);
      circle(ctx, p.x, p.y, 2, p.kind === 'hit' ? '#ffad87' : '#e4f5c7');
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.75);
    vignette.addColorStop(0, 'transparent'); vignette.addColorStop(1, '#00132072');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
    edges(ctx, s, v, width, height);
    ctx.restore();
  };
})(typeof window !== 'undefined' ? window : globalThis);
