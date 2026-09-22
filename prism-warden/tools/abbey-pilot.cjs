'use strict';
/* State-informed legal-input pilot for the authored Tidal Abbey (A1-A5 + sanctuary).
   Reads hidden state to plan, so it proves reachability/solvability, NOT human fun. */
const G = 8;
const ov = (x, y, r, w) => Math.hypot(x - Math.max(w.x, Math.min(x, w.x + w.w)), y - Math.max(w.y, Math.min(y, w.y + w.h))) < r;
function solids(s) {
  const l = s.walls.concat(s.gates.filter(g => !g.open), s.shutters.filter(x => !x.open), s.breakwaters.filter(b => b.risen));
  for (const m of s.mirrors) l.push({ x: m.x - m.r, y: m.y - m.r, w: 2 * m.r, h: 2 * m.r });
  for (const e of s.enemies) if (e.type === 'turret') l.push({ x: e.x - e.r, y: e.y - e.r, w: 2 * e.r, h: 2 * e.r });
  return l;
}
const gridCache = { key: null, grid: null };
function path(s, tx, ty, opts = {}) {
  const sol = solids(s), cols = 128, rows = 96, N = cols * rows;
  const r = 15;
  const cost = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const cell = (x, y) => Math.round(y / G) * cols + Math.round(x / G);
  // The walkable grid only changes when the solid layout does, so cache it per layout.
  const key = s.roomId + '|' + sol.map(w => w.x + ',' + w.y + ',' + w.w + ',' + w.h).join(';');
  if (gridCache.key !== key) {
    const grid = new Uint8Array(N);
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const x = cx * G, y = cy * G;
      grid[cy * cols + cx] = x > r && y > r && x < 1024 - r && y < 768 - r && !sol.some(w => ov(x, y, r, w)) ? 1 : 0;
    }
    gridCache.key = key; gridCache.grid = grid;
  }
  const free = gridCache.grid.slice();
  const wet = (x, y) => s.water.some(w => w.active && x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h);
  const start = cell(s.player.x, s.player.y), goal = cell(tx, ty);
  free[start] = 1;
  cost[start] = 0;
  // Binary heap of [cost, cell]; stale entries are skipped on pop.
  const heap = [[0, start]];
  const push = e => { heap.push(e); let i = heap.length - 1; while (i) { const q = (i - 1) >> 1; if (heap[q][0] <= e[0]) break; heap[i] = heap[q]; i = q; } heap[i] = e; };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++; if (heap[c][0] >= last[0]) break; heap[i] = heap[c]; i = c; } heap[i] = last; } return top; };
  while (heap.length) {
    const [cc, c] = pop(); if (cc > cost[c]) continue;
    if (c === goal) break;
    const cx = c % cols, cy = (c / cols) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const n = ny * cols + nx; if (!free[n]) continue;
      if (dx && dy && (!free[cy * cols + nx] || !free[ny * cols + cx])) continue;
      let step = dx && dy ? 1.414 : 1; if (opts.avoidWater !== false && wet(nx * G, ny * G)) step *= 6;
      if (opts.avoid) { const d = Math.hypot(nx * G - opts.avoid.x, ny * G - opts.avoid.y); if (d < opts.avoid.r) step *= 8; }
      if (cost[c] + step < cost[n]) { cost[n] = cost[c] + step; prev[n] = c; push([cost[n], n]); }
    }
  }
  if (cost[goal] === Infinity) return null;
  const pts = []; for (let c = goal; c !== -1; c = prev[c]) pts.push([(c % cols) * G, ((c / cols) | 0) * G]);
  return pts.reverse();
}
function steer(s, tx, ty, opts) {
  const p = s.player;
  if (Math.hypot(tx - p.x, ty - p.y) < 3) return { mx: 0, my: 0 };
  const pts = path(s, tx, ty, opts);
  if (!pts) return { mx: 0, my: 0, stuck: true };
  let t = pts[Math.min(pts.length - 1, 3)];
  if (pts.length <= 4) t = [tx, ty];
  const dx = t[0] - p.x, dy = t[1] - p.y, d = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, d / 3);
  return { mx: dx / d * k, my: dy / d * k };
}
function threat(s) {
  // nearest incoming hostile shot likely to hit within 0.45s
  const p = s.player; let best = null, bt = .45;
  for (const sh of s.shots) {
    if (sh.friendly) continue;
    const rx = p.x - sh.x, ry = p.y - sh.y, v2 = sh.vx * sh.vx + sh.vy * sh.vy;
    const t = (rx * sh.vx + ry * sh.vy) / v2; if (t < 0 || t > bt) continue;
    const cx = sh.x + sh.vx * t - p.x, cy = sh.y + sh.vy * t - p.y;
    if (Math.hypot(cx, cy) < p.r + sh.r + 10) { best = sh; bt = t; }
  }
  return best;
}
function guard(s, input) {
  const sh = threat(s); if (!sh) return false;
  const p = s.player, owner = s.enemies.find(e => e.id === sh.owner);
  const sp = Math.hypot(sh.vx, sh.vy);
  let ax = -sh.vx / sp, ay = -sh.vy / sp;
  if (owner) { const dx = owner.x - p.x, dy = owner.y - p.y, d = Math.hypot(dx, dy); if ((dx / d) * ax + (dy / d) * ay >= .6) { ax = dx / d; ay = dy / d; } }
  Object.assign(input, { ax, ay, reflect: true, mx: 0, my: 0 });
  return true;
}
function play(PW, opts) {
  opts = opts || {}; const log = [];
  const s = PW.create(); s.status = 'playing';
  let frames = 0, retries = 0, slashT = 0, lastRoom = '', roomFrames = 0;
  const plan = { sanctuaryDone: false, visitSanctuary: opts.sanctuary !== false };
  const stepOnce = input => {
    if (input.slash) { if (slashT % 2) input.slash = false; slashT++; }
    PW.step(s, input, 1 / 60); frames++;
    if (s.status === 'lost') { log.push('LOST in ' + s.roomId + ' t=' + s.time.toFixed(1) + ' hp=' + s.player.hp + ' esc=' + (s.escort && s.escort.hp) + ' msg=' + s.message); retries++; PW.retryRoom(s); }
  };
  while (s.status === 'playing' && frames < 60 * 60 * 20 && retries < 25) {
    if (s.roomId !== lastRoom) { log.push('enter ' + s.roomId + ' t=' + s.time.toFixed(1) + ' hp=' + s.player.hp + '/' + s.player.maxHp + ' score=' + s.score + ' obj=' + s.objective); lastRoom = s.roomId; roomFrames = 0; }
    roomFrames++;
    const input = { mx: 0, my: 0, ax: s.player.aimX, ay: s.player.aimY };
    const p = s.player, id = s.roomId;
    const go = (x, y, o) => Object.assign(input, steer(s, x, y, o));
    const exitTo = to => { const ex = s.exits.find(e => e.to === to); go(ex.x + ex.w / 2, ex.y + ex.h / 2); };
    const aimAt = (x, y) => { const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1; input.ax = dx / d; input.ay = dy / d; };
    const duel = e => {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      aimAt(e.x, e.y);
      if (e.exposed > 0) { if (d > 60) go(e.x, e.y); input.slash = d < e.r + 50; return; }
      if (e.phase === 'lunge-windup' || e.phase === 'lunge') {
        let sx = -e.aimY, sy = e.aimX; const tx = p.x + sx * 60, ty = p.y + sy * 60;
        if (solids(s).some(w => ov(tx, ty, 16, w))) { sx = -sx; sy = -sy; }
        input.mx = sx; input.my = sy; input.dash = e.phase === 'lunge' && d < 150; return;
      }
      if (d < 150) { input.mx = -dx / d; input.my = -dy / d; } else if (d > 260) go(e.x, e.y);
      input.reflect = true;
    };
    if (id === 'cloister') {
      const turret = s.enemies.find(e => e.type === 'turret');
      const sent = s.enemies.find(e => e.type === 'sentinel');
      if (!s.gates[0].open) {
        if (Math.hypot(p.x - 76, p.y - 336) > 4) go(76, 336);
        else if (turret.phase === 'volley' || (turret.phase === 'telegraph' && turret.timer < .3)) { aimAt(turret.x, turret.y); input.reflect = true; }
        else { input.ax = Math.cos(335 * Math.PI / 180); input.ay = Math.sin(335 * Math.PI / 180); input.reflect = true; }
        if (!guard(s, input)) {} ;
      } else if (sent.hp > 0) {
        if (sent.phase === 'dormant') go(sent.x - 120, sent.y); else duel(sent);
        if (sent.exposed <= 0 && sent.phase !== 'lunge-windup' && sent.phase !== 'lunge') guard(s, input);
      } else if (!s.rescue.freed) go(s.rescue.x, s.rescue.y);
      else exitTo('sluice');
    } else if (id === 'sluice') {
      const seal = s.receivers[0];
      if (!seal.active) {
        const spot = [496, 300];
        if (Math.hypot(p.x - spot[0], p.y - spot[1]) > 4) go(spot[0], spot[1]);
        else { input.ax = Math.cos(140 * Math.PI / 180); input.ay = Math.sin(140 * Math.PI / 180); input.reflect = true; }
        guard(s, input);
      } else if (plan.visitSanctuary && !plan.sanctuaryDone) exitTo('sanctuary');
      else exitTo('shutters');
    } else if (id === 'sanctuary') {
      const m = s.mirrors[0], chart = s.pickups.find(k => k.kind === 'chart');
      if (m.index !== 1) { if (Math.hypot(p.x - m.x, p.y - m.y) > 50) go(m.x - 40, m.y + 30); else input.slash = true; }
      else if (!chart.taken) go(chart.x, chart.y);
      else if (!s.sanctuaryZone.active || p.hp < p.maxHp) go(s.sanctuaryZone.x, s.sanctuaryZone.y);
      else { plan.sanctuaryDone = true; exitTo('sluice'); }
    } else if (id === 'shutters') {
      const esc = s.escort;
      if (!esc.arrived) {
        const tele = s.enemies.filter(e => e.type === 'turret' && (e.phase === 'telegraph' || e.phase === 'volley'));
        const next = esc.path[Math.min(esc.index, esc.path.length - 1)];
        let tx = esc.x + (next[0] - esc.x) * .0, ty = esc.y;
        if (tele.length) {
          const t = tele[0], dx = t.x - esc.x, dy = t.y - esc.y, d = Math.hypot(dx, dy) || 1;
          tx = esc.x + dx / d * 38; ty = esc.y + dy / d * 38; aimAt(t.x, t.y); input.reflect = true;
        } else { const dx = next[0] - esc.x, dy = next[1] - esc.y, d = Math.hypot(dx, dy) || 1; tx = esc.x + dx / d * 50; ty = esc.y + dy / d * 50; }
        if (Math.hypot(tx - p.x, ty - p.y) > 6) { const r = steer(s, tx, ty); input.mx = r.mx; input.my = r.my; }
        guard(s, input);
      } else exitTo('bell-tower');
    } else if (id === 'bell-tower') {
      const want = { 'west-high': 2, 'east-high': 1, 'west-bell-mirror': 2, 'east-bell-mirror': 1 };
      const m = s.mirrors.find(q => want[q.id] !== undefined && q.index !== want[q.id]);
      const verger = s.enemies.find(e => e.type === 'sentinel');
      if (verger.hp > 0 && verger.phase !== 'patrol' && verger.phase !== 'dormant') { duel(verger); if (verger.exposed <= 0 && !/lunge/.test(verger.phase)) guard(s, input); }
      else if (m) {
        if (Math.hypot(p.x - m.x, p.y - m.y) > 55) go(m.x + (m.x < 512 ? 0 : 0), m.y + 45, { avoid: { x: verger.x, y: verger.y, r: 200 } });
        else input.slash = true;
      } else if (!s.gates[0].open) { go(512, 200); }
      else exitTo('beacon');
    } else if (id === 'beacon') {
      const d = s.enemies[0];
      if (d.hp > 0) {
        const dx = d.x - p.x, dy = d.y - p.y, dist = Math.hypot(dx, dy);
        aimAt(d.x, d.y);
        if (d.phase === 'surfacing' || (d.phase === 'volley-telegraph' && s.rings.some(r => r.hostile))) {
          const ring = s.rings.find(r => r.hostile);
          if (ring && Math.abs(Math.hypot(p.x - ring.x, p.y - ring.y) - ring.r) < 40 && p.dashCooldown <= 0) { input.mx = -dx / (dist || 1); input.my = -dy / (dist || 1); input.dash = true; }
          else if (dist < 170) { const r = steer(s, p.x - dx / dist * 80, p.y - dy / dist * 80); input.mx = r.mx; input.my = r.my; }
        } else if (d.exposed > 0) { if (dist > 55) go(d.x, d.y); input.slash = dist < d.r + 50; }
        else if (d.submerged) { go(512, 400); }
        else { input.reflect = true; guard(s, input); if (dist < 120) { input.mx = -dx / dist; input.my = -dy / dist; } }
      } else go(s.beacon.x, s.beacon.y);
    }
    stepOnce(input);
    if (roomFrames > 60 * 240) { log.push('TIMEOUT in ' + s.roomId + ' obj=' + s.objective); break; }
  }
  log.push('END status=' + s.status + ' t=' + s.time.toFixed(1) + ' score=' + s.score + ' hp=' + s.player.hp + ' retries=' + retries + ' cleared=' + JSON.stringify(s.cleared) + ' flags=' + Object.keys(s.flags).join(','));
  s.pilotLog = log; s.pilotRetries = retries;
  return s;
}
function loadPW() {
  const fs = require('fs'), vm = require('vm'), path = require('path'), ctx = { window: {}, Math, Number };
  vm.createContext(ctx);
  for (const f of ['regions.js', 'logic.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/', f), 'utf8'), ctx);
  return ctx.window.PW;
}
module.exports = { play, loadPW };
if (require.main === module) { const s = play(loadPW(), { sanctuary: process.argv[2] !== 'direct' }); console.log(s.pilotLog.join('\n')); }
