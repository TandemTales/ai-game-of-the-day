'use strict';
/* State-informed legal-input pilot for the Verdant Aqueduct (B1-B5 + optional ferry landing).
   Plays the whole Tidal Abbey first with the abbey pilot, continues through the abbey
   beacon with PW.continueRegion (the same call main.js makes on "Continue"), then plays
   every Region 2 room sending ONLY inputs through PW.step. It reads hidden state to plan,
   so it proves reachability/solvability, NOT human fun.
   opts: { ferry: true|false (visit the optional ferry landing), seal: true|false (seal the
   quay dam before the valve), sanctuary: passed to the abbey pilot, abbey: false to start
   from a fresh spillway entry instead of playing the abbey (debug only) }. */
const REPO = require('path').resolve(__dirname, '..');
const path_ = require('path');
const G = 8, COLS = 128, ROWS = 96;
const ov = (x, y, r, w) => Math.hypot(x - Math.max(w.x, Math.min(x, w.x + w.w)), y - Math.max(w.y, Math.min(y, w.y + w.h))) < r;
const inR = (x, y, w) => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h;
const box = o => ({ x: o.x - o.r, y: o.y - o.r, w: 2 * o.r, h: 2 * o.r });

// Everything the engine treats as solid to walking (moveSolids): walls, closed gates and
// shutters, risen breakwaters, living growth, intact dams, mirrors/prism, turrets, live mortars.
function solids(s) {
  const l = s.walls.concat(s.gates.filter(g => !g.open), s.shutters.filter(x => !x.open),
    s.breakwaters.filter(b => b.risen), (s.growth || []).filter(g => g.alive), (s.dams || []).filter(d => d.hp > 0));
  for (const m of s.mirrors) l.push(box(m));
  for (const e of s.enemies) if (e.type === 'turret' || (e.type === 'mortar' && e.hp > 0)) l.push(box(e));
  return l;
}
function wetAt(s, x, y) {
  if (!s.water.some(w => w.active && inR(x, y, w))) return false;
  return !(s.bridges || []).some(b => !b.sunk && inR(x, y, b));
}
const gridCache = { key: null, grid: null };
function path(s, tx, ty, opts = {}) {
  const sol = solids(s), N = COLS * ROWS, r = 15;
  const cost = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const cell = (x, y) => Math.max(0, Math.min(ROWS - 1, Math.round(y / G))) * COLS + Math.max(0, Math.min(COLS - 1, Math.round(x / G)));
  const key = s.roomId + '|' + sol.map(w => w.x + ',' + w.y + ',' + w.w + ',' + w.h).join(';');
  if (gridCache.key !== key) {
    const grid = new Uint8Array(N);
    for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
      const x = cx * G, y = cy * G;
      grid[cy * COLS + cx] = x > r && y > r && x < 1024 - r && y < 768 - r && !sol.some(w => ov(x, y, r, w)) ? 1 : 0;
    }
    gridCache.key = key; gridCache.grid = grid;
  }
  const free = gridCache.grid.slice();
  const start = cell(s.player.x, s.player.y), goal = cell(tx, ty);
  free[start] = 1; free[goal] = 1;
  cost[start] = 0;
  const heap = [[0, start]];
  const push = e => { heap.push(e); let i = heap.length - 1; while (i) { const q = (i - 1) >> 1; if (heap[q][0] <= e[0]) break; heap[i] = heap[q]; i = q; } heap[i] = e; };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++; if (heap[c][0] >= last[0]) break; heap[i] = heap[c]; i = c; } heap[i] = last; } return top; };
  while (heap.length) {
    const [cc, c] = pop(); if (cc > cost[c]) continue;
    if (c === goal) break;
    const cx = c % COLS, cy = (c / COLS) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const n = ny * COLS + nx; if (!free[n]) continue;
      if (dx && dy && (!free[cy * COLS + nx] || !free[ny * COLS + cx])) continue;
      let step = dx && dy ? 1.414 : 1;
      if (wetAt(s, nx * G, ny * G)) step *= opts.water === 'block' ? 40 : opts.water === 'ok' ? 1.5 : 6;
      for (const a of opts.avoid || []) { const d = Math.hypot(nx * G - a.x, ny * G - a.y); if (d < a.r) step *= 8; }
      if (cost[c] + step < cost[n]) { cost[n] = cost[c] + step; prev[n] = c; push([cost[n], n]); }
    }
  }
  if (cost[goal] === Infinity) return null;
  const pts = []; for (let c = goal; c !== -1; c = prev[c]) pts.push([(c % COLS) * G, ((c / COLS) | 0) * G]);
  return pts.reverse();
}
function steer(s, tx, ty, opts) {
  const p = s.player;
  const d0 = Math.hypot(tx - p.x, ty - p.y);
  if (d0 < 2) return { mx: 0, my: 0, arrived: true };
  const pts = path(s, tx, ty, opts);
  if (!pts) return { mx: 0, my: 0, stuck: true };
  let t = pts[Math.min(pts.length - 1, 3)];
  if (pts.length <= 4) t = [tx, ty];
  const dx = t[0] - p.x, dy = t[1] - p.y, d = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, d / 3);
  return { mx: dx / d * k, my: dy / d * k };
}
function threat(s) {
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
  if (owner) { const dx = owner.x - p.x, dy = owner.y - p.y, d = Math.hypot(dx, dy) || 1; if ((dx / d) * ax + (dy / d) * ay >= .6) { ax = dx / d; ay = dy / d; } }
  Object.assign(input, { ax, ay, reflect: true, mx: 0, my: 0 });
  return true;
}
// Step out of any seed landing ring the warden is standing in (mortar lobs aim at where
// you stood at launch). Picks the free, preferably dry, direction that clears it fastest.
function dodgeLobs(s, input) {
  const p = s.player, sol = solids(s);
  const lob = (s.lobs || []).filter(l => Math.hypot(p.x - l.tx, p.y - l.ty) < l.r + p.r + 10)
    .sort((a, b) => (b.t / b.flight) - (a.t / a.flight))[0];
  if (!lob) return false;
  let best = null, bs = -Infinity;
  for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8, ux = Math.cos(a), uy = Math.sin(a);
    let ok = true;
    for (let d = 10; d <= 60; d += 10) if (sol.some(w => ov(p.x + ux * d, p.y + uy * d, p.r + 1, w))) { ok = false; break; }
    if (!ok) continue;
    const nx = p.x + ux * 60, ny = p.y + uy * 60;
    let score = Math.hypot(nx - lob.tx, ny - lob.ty);
    for (const o of s.lobs) if (o !== lob && Math.hypot(nx - o.tx, ny - o.ty) < o.r + p.r + 6) score -= 80;
    if (wetAt(s, nx, ny)) score -= 50;
    if (input.mx || input.my) score += 20 * (ux * input.mx + uy * input.my);
    if (score > bs) { bs = score; best = [ux, uy]; }
  }
  if (!best) return false;
  input.mx = best[0]; input.my = best[1]; input.reflect = false;
  return true;
}

function loadPW() {
  const fs = require('fs'), vm = require('vm'), ctx = { window: {}, Math, Number };
  vm.createContext(ctx);
  for (const f of ['regions.js', 'logic.js']) vm.runInContext(fs.readFileSync(path_.join(REPO, 'assets/js', f), 'utf8'), ctx);
  return ctx.window.PW;
}

function play(PW, opts) {
  opts = opts || {};
  PWref = PW;
  const log = [];
  let s;
  if (opts.abbey === false) {
    s = PW.create(); s.status = 'playing';
    PW.enterRoom(s, 'spillway', { x: 110, y: 420 }); // debug shortcut only (not used for verification)
  } else {
    const abbey = require(path_.join(REPO, 'tools/abbey-pilot.cjs'));
    s = abbey.play(PW, { sanctuary: opts.sanctuary !== false });
    log.push(...s.pilotLog.map(l => 'abbey: ' + l));
    delete s.pilotLog; delete s.pilotRetries;
    if (s.status !== 'cleared') { log.push('ABBEY did not clear: ' + s.status); s.pilotLog = log; return s; }
    log.push('abbey cleared -> next ' + JSON.stringify(s.next) + ' objective=' + s.objective);
    PW.continueRegion(s);
  }
  const plan = { ferry: opts.ferry !== false, seal: opts.seal !== false, ferryDone: false,
    prismLift: false };
  let frames = 0, retries = 0, slashT = 0, lastRoom = '', roomFrames = 0;
  const prevPlace = { v: false };
  const stepOnce = input => {
    if (input.slash) { if (slashT % 2) input.slash = false; slashT++; }
    if (input.place) { if (prevPlace.v) input.place = false; }
    prevPlace.v = !!input.place;
    PW.step(s, input, 1 / 60); frames++;
    if (s.status === 'lost') {
      log.push('LOST in ' + s.roomId + ' t=' + s.time.toFixed(1) + ' hp=' + s.player.hp + ' msg=' + s.message);
      retries++; PW.retryRoom(s);
    }
  };
  while (s.status === 'playing' && frames < 60 * 60 * 20 && retries < 25) {
    if (s.roomId !== lastRoom) {
      log.push('enter ' + s.roomId + ' t=' + s.time.toFixed(1) + ' hp=' + s.player.hp + '/' + s.player.maxHp +
        ' score=' + s.score + ' prism=' + s.player.prism + ' obj=' + s.objective);
      lastRoom = s.roomId; roomFrames = 0;
    }
    roomFrames++;
    const p = s.player, id = s.roomId;
    const input = { mx: 0, my: 0, ax: p.aimX, ay: p.aimY };
    const go = (x, y, o) => { const r = steer(s, x, y, o); input.mx = r.mx; input.my = r.my; return r; };
    const near = (x, y, d) => Math.hypot(p.x - x, p.y - y) <= d;
    const exitTo = to => { const ex = s.exits.find(e => e.to === to); go(ex.x + ex.w / 2, ex.y + ex.h / 2); };
    const aimAt = (x, y) => { const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1; input.ax = dx / d; input.ay = dy / d; };
    const aimDir = (ax, ay) => { input.ax = ax; input.ay = ay; };
    const prism = s.mirrors.find(m => m.portable);
    const onBridge = (s.bridges || []).find(b => inR(p.x, p.y, b));
    let dodged = false;
    const safety = () => { if (!onBridge) dodged = dodgeLobs(s, input); if (!dodged && !onBridge) guard(s, input); };

    if (id === 'spillway') {
      const bramble = s.growth[0], pick = s.pickups[0];
      const turret = s.enemies[0], gate = s.gates[0];
      const volleyNear = turret.phase === 'telegraph' || turret.phase === 'volley' || s.shots.some(x => !x.friendly);
      if (!p.prism) {
        if (bramble.alive) { if (!near(170, 250, 4)) go(170, 250); else { aimDir(0, -1); input.slash = true; } }
        else go(pick.x, pick.y);
        guard(s, input);
      } else if (p.prism === 'carried' && p.x < 440) {
        // West bank -> islet: wait on the bank for a volley to pass, then cross without stopping.
        if (!plan.crossing) {
          if (!near(286, 442, 4)) { go(286, 442); guard(s, input); }
          else if (volleyNear || s.bridges[0].load > 0) { guard(s, input); }
          else { plan.crossing = true; input.mx = 1; }
        } else { input.mx = 1; input.my = (442 - p.y) / 20; }
      } else if (p.prism === 'carried') {
        // On the islet: step to the strip north of the pier and set the prism aimed east.
        if (!near(476, 346, 3)) { go(476, 346, { water: 'block' }); if (!onBridge) guard(s, input); }
        else { aimDir(1, 0); input.place = true; }
      } else if (!gate.open && !(prism && prism.lit)) {
        log.push('spillway: prism not lit at ' + (prism && prism.x.toFixed(1) + ',' + prism.y.toFixed(1)));
        input.place = true; // lift and try again
      } else if (!gate.open) {
        guard(s, input); // light is charging the seal
      } else if (p.x < 580) {
        if (!near(566, 442, 4) && p.x < 560) go(566, 442, { water: 'block' });
        else if (s.bridges[1].load > 0 && p.x < 580) { /* let the root recover */ }
        else { input.mx = 1; input.my = (442 - p.y) / 20; }
      } else if (p.x < 740) { input.mx = 1; input.my = (442 - p.y) / 20; }
      else exitTo('roots');
    } else if (id === 'roots') {
      const pump = s.receivers[0];
      if (!pump.active) {
        if (p.prism === 'carried') {
          if (!near(126, 310, 3)) go(126, 310, { water: 'block' });
          else { aimDir(1, 0); input.place = true; }
        } else {
          const thorns = s.growth.slice().sort((a, b) => a.x - b.x);
          const alive = thorns.find(g => g.alive);
          const lobs = (s.lobs || []).map(l => ({ x: l.tx, y: l.ty, r: l.r + 24 }));
          if (alive) {
            const tx = alive.x + alive.w / 2, ty = 400;
            if (!near(tx, ty, 6)) go(tx, ty, { avoid: lobs });
            else { aimDir(0, -1); input.slash = true; }
          } else {
            // Everything is cut: wait under the hedge that regrows next.
            const next = thorns.slice().sort((a, b) => a.timer - b.timer)[0];
            const tx = next.x + next.w / 2, ty = 400;
            if (!near(tx, ty, 6)) go(tx, ty, { avoid: lobs });
          }
          dodgeLobs(s, input);
        }
      } else exitTo('channels');
    } else if (id === 'channels') {
      const order = ['mortar-north', 'mortar-mid', 'mortar-south'];
      const target = order.map(k => s.enemies.find(e => e.id === k)).find(e => e.hp > 0);
      if (target) {
        const bx = target.x + 56, by = target.y;
        if (!near(bx, by, 5)) {
          const r = go(bx, by, { water: 'block' });
          if (r.stuck) { input.mx = 0; input.my = 0; }
        } else { aimAt(target.x, target.y); input.slash = true; }
        if (!near(bx, by, 5) || (s.lobs || []).some(l => Math.hypot(p.x - l.tx, p.y - l.ty) < l.r + p.r + 10 && l.t / l.flight > .55)) {
          const before = [input.mx, input.my];
          if (dodgeLobs(s, input)) { input.slash = false; }
          else { input.mx = before[0]; input.my = before[1]; }
        }
      } else exitTo('quay');
    } else if (id === 'quay') {
      const eye = s.receivers[0], sealLever = s.levers.find(l => l.id === 'seal-lever'), valve = s.levers.find(l => l.id === 'valve-lever');
      const wantSeal = plan.seal && !s.flags.valve;
      if (wantSeal && !eye.active) {
        if (p.prism === 'carried') {
          if (!near(168, 644, 3)) go(168, 644, { water: 'block' });
          else { aimDir(0, -1); input.place = true; }
        } else { /* charging */ }
        safety();
      } else if (wantSeal && !sealLever.pulled) {
        if (p.prism === 'placed' && prism && near(prism.x, prism.y, 70)) { input.place = true; } // lift it again
        else if (!near(98, 470, 5)) go(98, 470);
        else { aimAt(sealLever.x, sealLever.y); input.slash = true; }
        if (!near(98, 470, 30)) safety();
      } else if (!valve.pulled) {
        if (!near(880, 356, 5)) go(880, 356); else { aimAt(valve.x, valve.y); input.slash = true; }
        if (!near(880, 356, 30)) safety();
      } else if (!s.rescue.freed) {
        if (!plan.skiff) { if (!near(600, 312, 4)) { go(600, 312, { water: 'block' }); safety(); } else { plan.skiff = true; input.my = -1; } }
        else { input.my = -1; input.mx = (600 - p.x) / 20; }
      } else if (p.y < 300) { input.my = 1; input.mx = (600 - p.x) / 20; }
      else if (plan.ferry && !plan.ferryDone) { exitTo('ferry'); safety(); }
      else { exitTo('reservoir'); safety(); }
    } else if (id === 'ferry') {
      const thorns = s.growth[0], lens = s.pickups.find(k => k.kind === 'lens'), heart = s.pickups.find(k => k.kind === 'heart');
      const grille = s.gates.find(g => g.id === 'lens-grille');
      const st = plan.fs || (plan.fs = { stage: 0 });
      const B = k => s.bridges.find(x => x.id === k);
      if (!lens.taken) {
        if (p.prism === 'carried') {
          // Cut the thorns from the east, step into the gap, set the prism facing the west eye.
          if (thorns.alive) { if (!near(272, 270, 4)) go(272, 270); else { aimDir(-1, 0); input.slash = true; } }
          else if (!near(234, 270, 3)) go(234, 270);
          else { aimDir(-1, 0); input.place = true; }
        } else if (!grille.open) { /* the eye is charging */ }
        else go(lens.x, lens.y);
      } else if (st.stage === 0) { // landing edge above the north ferry stone
        if (!near(590, 290, 3)) go(590, 290); else if (B('ferry-stone-north').load <= 0) st.stage = 1;
      } else if (st.stage === 1) { input.my = 1; input.mx = (590 - p.x) / 20; if (p.y > 386) st.stage = 2; }
      else if (st.stage === 2) { if (!near(646, 400, 3)) go(646, 400, { water: 'block' }); else if (B('heart-root').load <= 0 && p.dashCooldown <= 0) st.stage = 3; }
      else if (st.stage === 3) { // dash the long root
        input.mx = 1; input.my = (400 - p.y) / 20; if (p.x < 680) input.dash = true; if (p.x > 824) st.stage = 4;
      } else if (st.stage === 4) { if (!heart.taken) go(heart.x, heart.y, { water: 'block' }); else st.stage = 5; }
      else if (st.stage === 5) { if (!near(832, 400, 3)) go(832, 400, { water: 'block' }); else if (B('heart-root').load <= 0 && p.dashCooldown <= 0) st.stage = 6; }
      else if (st.stage === 6) { input.mx = -1; input.my = (400 - p.y) / 20; if (p.x > 800) input.dash = true; if (p.x < 656) st.stage = 7; }
      else if (st.stage === 7) { if (!near(590, 412, 3)) go(590, 412, { water: 'block' }); else if (B('ferry-stone-south').load <= 0) st.stage = 8; }
      else if (st.stage === 8) { input.my = 1; input.mx = (590 - p.x) / 20; if (p.y > 484) st.stage = 9; }
      else { plan.ferryDone = true; exitTo('reservoir'); }
    } else if (id === 'reservoir') {
      const h = s.enemies.find(e => e.type === 'hart');
      if (h.hp > 0) hartFight(s, h, input, plan, log);
      else go(s.beacon.x, s.beacon.y);
    }
    if (opts.trace && roomFrames % (opts.trace === true ? 30 : opts.trace) === 0) {
      log.push('  ' + id + ' t=' + s.time.toFixed(2) + ' p=' + p.x.toFixed(0) + ',' + p.y.toFixed(0) + ' hp=' + p.hp +
        ' in=' + [input.mx, input.my].map(v => (+v || 0).toFixed(2)).join(',') + (input.slash ? ' S' : '') + (input.place ? ' Q' : '') + (input.dash ? ' D' : '') + (input.reflect ? ' R' : '') +
        ' prism=' + p.prism + (prism ? '@' + prism.x.toFixed(0) + ',' + prism.y.toFixed(0) + (prism.lit ? '*' : '') : '') +
        ' msg=' + (s.message || '').slice(0, 50) + (opts.traceFn ? ' ' + opts.traceFn(s) : ''));
    }
    stepOnce(input);
    if (roomFrames > 60 * 240) { log.push('TIMEOUT in ' + s.roomId + ' obj=' + s.objective); break; }
  }
  log.push('END status=' + s.status + ' t=' + s.time.toFixed(1) + ' score=' + s.score + ' hp=' + s.player.hp + '/' + s.player.maxHp +
    ' retries=' + retries + ' cleared=' + JSON.stringify(s.cleared) + ' flags=' + Object.keys(s.flags).join(','));
  s.pilotLog = log; s.pilotRetries = retries;
  return s;
}

// Root Hart: stand between the hart and a timber dam so its lane runs into the timber,
// sidestep once the aim locks, strike while it is stunned, return seed fans.
function hartFight(s, h, input, plan, log) {
  const p = s.player;
  const dams = s.dams.filter(d => d.hp > 0);
  const aimAt = (x, y) => { const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1; input.ax = dx / d; input.ay = dy / d; };
  const go = (x, y) => { const r = steer(s, x, y, { water: 'block' }); input.mx = r.mx; input.my = r.my; return r; };
  const dx = h.x - p.x, dy = h.y - p.y, dist = Math.hypot(dx, dy) || 1;
  aimAt(h.x, h.y);
  if (h.exposed > 0) {
    if (dist > h.r + 40) { const r = steer(s, h.x, h.y, { water: 'ok' }); input.mx = r.mx; input.my = r.my; }
    input.slash = dist < h.r + 52;
    return;
  }
  if (h.phase === 'charge' || (h.phase === 'aim' && h.locked)) {
    // Leave the locked lane: sidestep perpendicular, toward the side with more room.
    const px = -h.aimY, py = h.aimX;
    const rel = (p.x - h.x) * px + (p.y - h.y) * py;
    const sol = solids(s);
    const room = sgn => { let d = 0; for (; d < 120; d += 8) if (sol.some(w => ov(p.x + px * sgn * d, p.y + py * sgn * d, p.r + 2, w)) || wetAt(s, p.x + px * sgn * d, p.y + py * sgn * d)) break; return d; };
    let sgn = rel >= 0 ? 1 : -1;
    if (room(sgn) < 60 && room(-sgn) > room(sgn)) sgn = -sgn;
    input.mx = px * sgn; input.my = py * sgn;
    const lane = Math.abs(rel);
    if (h.phase === 'charge' && lane < h.r + p.r + 6 && p.dashCooldown <= 0) input.dash = true;
    return;
  }
  if (threat(s)) { guard(s, input); return; }
  // Choose a bait point: 95 units out from a dam face, on a straight lane from the hart
  // to that face that no stone (wall, pillar, other dam) interrupts.
  const others = solids(s);
  const laneClear = (x0, y0, x1, y1, dam) => {
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    for (const off of [-26, 0, 26]) {
      const ox = x0 - uy * off, oy = y0 + ux * off;
      const hit = PWref.raySegment(ox, oy, ux, uy, others.filter(w => w !== dam), L);
      if (hit.rect && hit.distance < L - 30) return false;
    }
    return true;
  };
  let best = null, bs = Infinity;
  for (const d of dams) {
    const horiz = d.w > d.h;
    const n = horiz ? [0, 1] : [-1, 0];
    const len = horiz ? d.w : d.h;
    for (let f = 50; f <= len - 50; f += 25) {
      const fx = horiz ? d.x + f : d.x, fy = horiz ? d.y + d.h : d.y + f;
      let ux = h.x - fx, uy = h.y - fy; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      if (ux * n[0] + uy * n[1] < .4 || ul > 620 || ul < 150) continue;
      const bx = fx + ux * 95, by = fy + uy * 95;
      if (wetAt(s, bx, by) || others.some(w => ov(bx, by, p.r + 4, w))) continue;
      if (!laneClear(h.x, h.y, fx, fy, d)) continue;
      const c = Math.hypot(bx - p.x, by - p.y);
      if (c < bs) { bs = c; best = { bx, by, d }; }
    }
  }
  if (!best) { go(512, 470); return; } // draw it into the open
  go(best.bx, best.by);
}

let PWref = null;
module.exports = { play, loadPW, REPO };
if (require.main === module) {
  const arg = process.argv.slice(2);
  const opts = { ferry: !arg.includes('noferry'), seal: !arg.includes('noseal'), abbey: !arg.includes('quick') };
  const s = play(loadPW(), opts);
  console.log(s.pilotLog.filter(l => !l.startsWith('abbey: enter')).join('\n'));
}
