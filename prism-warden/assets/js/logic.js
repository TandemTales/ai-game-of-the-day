/* Prism Warden simulation: data-driven room engine (Region 1 contract, Sep22).
 * Classic script on window.PW. Deterministic: no Math.random, no Date. */
(function (root) {
  'use strict';
  const PW = root.PW = root.PW || {};
  const EPS = 0.000001;
  const TAU = Math.PI * 2;
  const MAX_DEPTH = 8, MAX_SEGMENTS = 96;
  const LEASH = 220, WADE = .45, WADE_HURT = 1.4;
  const CHARGE_TIME = 1.2, DECAY_TIME = .65;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const length = (x, y) => Math.hypot(x, y);
  const arr = v => Array.isArray(v) ? v : [];
  const num = (v, d) => Number.isFinite(v) ? v : d;
  const PRISM_DIRS = [[1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1], [-Math.SQRT1_2, Math.SQRT1_2],
    [-1, 0], [-Math.SQRT1_2, -Math.SQRT1_2], [0, -1], [Math.SQRT1_2, -Math.SQRT1_2]];
  const copy = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

  // Slab intersection handles parallel rays, origins inside a wall, and corners.
  function raySegment(x, y, dx, dy, rects, max) {
    const magnitude = length(dx, dy);
    const limit = Number.isFinite(max) ? Math.max(0, max) : 1600;
    let distance = limit, hit = null;
    if (magnitude > EPS) {
      dx /= magnitude; dy /= magnitude;
      for (const rect of rects || []) {
        if (rect.open) continue;
        let near = -Infinity, far = Infinity, valid = true;
        for (const [origin, direction, low, high] of [
          [x, dx, rect.x, rect.x + rect.w], [y, dy, rect.y, rect.y + rect.h]
        ]) {
          if (Math.abs(direction) < EPS) {
            if (origin < low || origin > high) { valid = false; break; }
          } else {
            const a = (low - origin) / direction, b = (high - origin) / direction;
            near = Math.max(near, Math.min(a, b));
            far = Math.min(far, Math.max(a, b));
          }
        }
        if (valid && far >= Math.max(0, near) && Math.max(0, near) <= distance) {
          distance = Math.max(0, near); hit = rect;
        }
      }
    } else { dx = 0; dy = 0; distance = 0; }
    return { x: x + dx * distance, y: y + dy * distance, distance, rect: hit,
      x1: x, y1: y, x2: x + dx * distance, y2: y + dy * distance };
  }

  // ---------------------------------------------------------------- geometry
  function unit(dx, dy, fx, fy) {
    const m = length(dx, dy);
    return m > EPS ? [dx / m, dy / m] : [fx === undefined ? 1 : fx, fy || 0];
  }
  function overlapCircle(x, y, radius, wall) {
    return Math.hypot(x - clamp(x, wall.x, wall.x + wall.w),
      y - clamp(y, wall.y, wall.y + wall.h)) < radius - EPS;
  }
  function inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
  function segmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, ll = dx * dx + dy * dy;
    const t = ll > EPS ? clamp(((px - x1) * dx + (py - y1) * dy) / ll, 0, 1) : 0;
    return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
  }
  function moveBody(p, vx, vy, dt, walls) {
    // Small axis-separated steps prevent a dash tunnelling through narrow walls.
    const steps = Math.max(1, Math.ceil(length(vx, vy) * dt / 5));
    for (let i = 0; i < steps; i++) {
      const nx = p.x + vx * dt / steps;
      if (!walls.some(w => overlapCircle(nx, p.y, p.r, w))) p.x = nx;
      const ny = p.y + vy * dt / steps;
      if (!walls.some(w => overlapCircle(p.x, ny, p.r, w))) p.y = ny;
    }
  }
  const rectOf = o => ({ x: num(o.x, 0), y: num(o.y, 0), w: num(o.w, 0), h: num(o.h, 0) });

  // ------------------------------------------------------- built-in fallback
  // Reproduces the September20 courtyard so the game works without PW.ROOMS.
  const FALLBACK_CLOISTER = {
    id: 'cloister', region: 'tidal-abbey', challenge: 'A1', name: 'Sunken Cloister',
    w: 1024, h: 768, intro: 'Raise your mirror in the sunlight. Aim at the north receiver.',
    spawn: { x: 190, y: 540 },
    walls: [
      { x: 24, y: 48, w: 24, h: 672 }, { x: 976, y: 48, w: 24, h: 672 },
      { x: 48, y: 48, w: 928, h: 32 }, { x: 48, y: 696, w: 928, h: 24 },
      { x: 700, y: 340, w: 24, h: 356 },
      { x: 325, y: 450, w: 90, h: 28 }, { x: 478, y: 210, w: 28, h: 66 }
    ],
    gates: [{ id: 'north-gate', x: 700, y: 80, w: 24, h: 260, opensWhen: { receivers: ['gate'] } }],
    emitters: [{ id: 'sun', x: 70, y: 340, dx: 1, dy: 0 }],
    receivers: [{ id: 'gate', x: 550, y: 115, r: 19, kind: 'seal' },
      { id: 'sanctuary', x: 280, y: 620, r: 22, kind: 'sanctuary' }],
    enemies: [{ type: 'sentinel', id: 'abbey-sentinel', x: 845, y: 245, hp: 6,
      wakeWhen: 'north-gate', wakeRadius: 300 }],
    rescue: { x: 914, y: 150, requires: ['abbey-sentinel'], completes: true },
    sanctuary: { x: 280, y: 620, r: 45, receiver: 'sanctuary' },
    objectives: { seal: 'Light the cloister seal', rescue: 'Free Ilex beyond the gate' }
  };

  function lookupDef(id) {
    let def = null;
    if (typeof PW.roomDef === 'function') { try { def = PW.roomDef(id) || null; } catch (e) { def = null; } }
    if (!def && PW.ROOMS && PW.ROOMS[id]) def = PW.ROOMS[id];
    if (!def && id === 'cloister') def = FALLBACK_CLOISTER;
    return def ? copy(def) : null;
  }
  function roomName(id) {
    const d = (PW.ROOMS && PW.ROOMS[id]) || (id === 'cloister' ? FALLBACK_CLOISTER : null);
    if (d && d.name) return d.name;
    for (const region of arr(PW.REGIONS)) {
      const room = arr(region.rooms).find(r => r.id === id);
      if (room) return room.name;
    }
    return id;
  }
  function regionInfo(id) {
    const r = typeof PW.regionById === 'function' ? PW.regionById(id) : null;
    return r || arr(PW.REGIONS).find(x => x.id === id) || null;
  }
  function regionName(id) {
    const r = regionInfo(id);
    return r && r.name ? r.name : id === 'tidal-abbey' ? 'Tidal Abbey' : String(id || 'region').replace(/-/g, ' ');
  }

  // ---------------------------------------------------------- room building
  function makeEnemy(d, i) {
    const type = d.type || 'sentinel', id = d.id || type + '-' + i;
    const e = { type, id, x: num(d.x, 512), y: num(d.y, 384), phase: 'dormant', timer: 0,
      exposed: 0, aimX: -1, aimY: 0, volley: 0, shotsLeft: 0, shotTimer: 0, lastSlash: -1,
      locked: false, submerged: false };
    if (type === 'turret') {
      return Object.assign(e, { r: num(d.r, 20), hp: 1, maxHp: 1, invulnerable: true,
        phase: 'idle', timer: Math.max(.5, num(d.delay, 1.6)),
        interval: Math.max(.6, num(d.interval, 2.4)),
        targets: ['player', 'escort', 'nearest'].includes(d.targets) ? d.targets : 'player',
        until: d.until || null, jammedOnce: false });
    }
    if (d.text) e.text = String(d.text);
    if (type === 'diver') {
      const hp = Math.max(1, num(d.hp, 10));
      return Object.assign(e, { r: num(d.r, 30), hp, maxHp: hp, phase: 'submerged',
        submerged: true, timer: Math.max(.6, num(d.delay, 1.5)), rewardedCracks: [] });
    }
    if (type === 'mortar') {
      const hp = Math.max(1, num(d.hp, 2));
      const f = Array.isArray(d.facing) ? d.facing : [0, 1];
      const [fx, fy] = unit(num(f[0], 0), num(f[1], 1), 0, 1);
      return Object.assign(e, { r: num(d.r, 20), hp, maxHp: hp, phase: 'idle',
        facingX: fx, facingY: fy, timer: Math.max(0, num(d.delay, 1.0)),
        interval: Math.max(.8, num(d.interval, 2.8)), range: num(d.range, 560),
        aimX: fx, aimY: fy, clang: 0, flash: 0, lobs: 0 });
    }
    if (type === 'hart') {
      const hp = Math.max(1, num(d.hp, 8));
      return Object.assign(e, { r: num(d.r, 34), hp, maxHp: hp, phase: 'dormant',
        wakeRadius: num(d.wakeRadius, 420), aimDist: 0, lastImpact: null, stunned: false,
        charges: 0, flash: 0 });
    }
    const hp = Math.max(1, num(d.hp, 6));
    const patrol = arr(d.patrol).map(pt => Array.isArray(pt) ? [num(pt[0], e.x), num(pt[1], e.y)] : [num(pt.x, e.x), num(pt.y, e.y)]);
    return Object.assign(e, { type: 'sentinel', r: num(d.r, 27), hp, maxHp: hp,
      phase: patrol.length > 1 ? 'patrol' : 'dormant',
      wakeRadius: num(d.wakeRadius, 300), wakeWhen: d.wakeWhen || null,
      patrol, patrolIndex: 0, rewardedCracks: [] });
  }

  function buildRoom(def, id) {
    const w = num(def.w, 1024), h = num(def.h, 768);
    const room = {
      room: { id: def.id || id, name: def.name || roomName(id), challenge: def.challenge || null,
        region: def.region || 'tidal-abbey', w, h, intro: def.intro || '',
        objectives: def.objectives && typeof def.objectives === 'object' ? copy(def.objectives) : {},
        clearWhen: copy(def.clearWhen || def.clearsWhen || null) },
      spawn: def.spawn ? { x: num(def.spawn.x, w / 2), y: num(def.spawn.y, h / 2) } : { x: w / 2, y: h / 2 },
      roomTime: 0,
      walls: arr(def.walls).map(rectOf),
      gates: arr(def.gates).map((g, i) => Object.assign(rectOf(g), { id: g.id || 'gate-' + i,
        open: !!g.open, opensWhen: copy(g.opensWhen || null), optional: !!g.optional,
        main: !!g.main, text: g.text || null, hold: !!g.hold, held: false, opened: !!g.open })),
      emitters: arr(def.emitters).map((e, i) => {
        const [dx, dy] = unit(num(e.dx, 1), num(e.dy, 0));
        return { id: e.id || 'emitter-' + i, x: num(e.x, 0), y: num(e.y, 0), dx, dy };
      }),
      receivers: arr(def.receivers).map((r, i) => {
        const fill = num(r.fill, 0) > 0 ? r.fill : 0;
        const kind = r.kind || (fill ? 'pump' : 'seal');
        const out = { id: r.id || 'receiver-' + i, x: num(r.x, 0), y: num(r.y, 0), r: num(r.r, 19), kind,
          charge: 0, active: false, lit: false,
          latch: fill ? true : r.latch !== undefined ? !!r.latch : kind !== 'bell' };
        if (fill) out.fill = fill;
        if (r.text) out.text = String(r.text);
        return out;
      }),
      mirrors: arr(def.mirrors).map((m, i) => {
        let dirs = arr(m.dirs).filter(d => Array.isArray(d) && length(num(d[0], 0), num(d[1], 0)) > EPS)
          .map(d => unit(d[0], d[1]));
        if (!dirs.length) dirs = [[1, 0]];
        return { id: m.id || 'mirror-' + i, x: num(m.x, 0), y: num(m.y, 0), r: num(m.r, 16),
          split: !!m.split, dirs, index: clamp(Math.floor(num(m.index, 0)), 0, dirs.length - 1), lit: false };
      }),
      water: arr(def.water).map((wt, i) => withCycle(Object.assign(rectOf(wt), { id: wt.id || 'water-' + i,
        when: copy(wt.when) || 'always', active: false }), wt)),
      breakwaters: arr(def.breakwaters).map((b, i) => withCycle(Object.assign(rectOf(b), { id: b.id || 'breakwater-' + i,
        when: copy(b.when) || 'high', risen: false, held: false }), b)),
      bridges: arr(def.bridges).map((b, i) => Object.assign(rectOf(b), { id: b.id || 'bridge-' + i,
        hold: Math.max(.1, num(b.hold, 1)), recover: Math.max(0, num(b.recover, 2.5)),
        load: 0, sunk: false, timer: 0, occupied: false })),
      growth: arr(def.growth).map((g, i) => Object.assign(rectOf(g), { id: g.id || 'growth-' + i,
        regrow: Math.max(0, num(g.regrow, 5)), alive: g.alive === undefined ? true : !!g.alive,
        timer: 0, held: false })),
      levers: arr(def.levers).map((l, i) => ({ id: l.id || 'lever-' + i, x: num(l.x, 0), y: num(l.y, 0),
        flag: l.flag || 'lever:' + (l.id || i), text: l.text || null, pulled: false })),
      dams: arr(def.dams).map((d, i) => {
        const hp = Math.max(1, Math.floor(num(d.hp, 2)));
        return Object.assign(rectOf(d), { id: d.id || 'dam-' + i, hp, maxHp: hp, broken: false, hit: 0 });
      }),
      shutters: arr(def.shutters).map((sh, i) => {
        const period = Math.max(.5, num(sh.period, 4));
        return Object.assign(rectOf(sh), { id: sh.id || 'shutter-' + i, period,
          openFor: clamp(num(sh.openFor, period / 2), 0, period), offset: num(sh.offset, 0),
          open: true, phase: 0, warning: 0, held: false, closesIn: 0, opensIn: 0 });
      }),
      tideDef: def.tide && Number.isFinite(def.tide.period) && def.tide.period > 0 ?
        { period: def.tide.period, offset: num(def.tide.offset, 0) } : null,
      tide: { active: false, level: 0, high: false, warning: 0, next: 0, period: 0 },
      enemies: arr(def.enemies).map(makeEnemy),
      escort: def.escort ? { x: num(def.escort.x, 0), y: num(def.escort.y, 0), r: num(def.escort.r, 13),
        hp: num(def.escort.hp, 4), maxHp: num(def.escort.hp, 4),
        path: arr(def.escort.path).map(pt => Array.isArray(pt) ? [num(pt[0], 0), num(pt[1], 0)] : [num(pt.x, 0), num(pt.y, 0)]),
        index: 0, arrived: false, waiting: null, invulnerable: 0, wade: 0, flag: def.escort.flag || null,
        name: def.escort.name || 'Ilex', text: def.escort.text || null } : null,
      escortExit: def.escortExit ? rectOf(def.escortExit) : null,
      pickups: arr(def.pickups).map((pk, i) => ({ id: pk.id || 'pickup-' + i, kind: pk.kind || 'chart',
        x: num(pk.x, 0), y: num(pk.y, 0), text: pk.text || '', taken: false })),
      exits: arr(def.exits).map(ex => Object.assign(rectOf(ex), { to: ex.to,
        toName: ex.label || roomName(ex.to),
        spawn: ex.spawn ? { x: num(ex.spawn.x, 0), y: num(ex.spawn.y, 0) } : null })),
      beacon: def.beacon ? { x: num(def.beacon.x, 0), y: num(def.beacon.y, 0),
        requires: arr(def.beacon.requires).slice(), lit: false, reached: false, text: def.beacon.text || null,
        next: def.beacon.next && def.beacon.next.room ? copy(def.beacon.next) : null } : null,
      rescue: def.rescue ? { x: num(def.rescue.x, 0), y: num(def.rescue.y, 0),
        requires: Array.isArray(def.rescue.requires) ? def.rescue.requires.slice() : null,
        freed: false, completes: !!def.rescue.completes, text: def.rescue.text || null,
        flag: def.rescue.flag || 'ilex', requiresFlag: def.rescue.requiresFlag || null } : null,
      sanctuaryZone: def.sanctuary ? { x: num(def.sanctuary.x, 0), y: num(def.sanctuary.y, 0),
        r: num(def.sanctuary.r, 45), receiver: def.sanctuary.receiver || null, active: !def.sanctuary.receiver } : null
    };
    if (room.rescue && !room.rescue.requires) {
      room.rescue.requires = room.enemies.filter(e => e.type !== 'turret').map(e => e.id);
    }
    return room;
  }
  function withCycle(rect, d) {
    if (rect.when === 'cycle') {
      rect.period = Math.max(.2, num(d.period, 4));
      rect.onFor = clamp(num(d.onFor, rect.period / 2), 0, rect.period);
      rect.offset = num(d.offset, 0);
      rect.flipIn = 0;
    }
    return rect;
  }
  const ROOM_KEYS = ['room', 'spawn', 'roomTime', 'walls', 'gates', 'emitters', 'receivers',
    'mirrors', 'water', 'breakwaters', 'shutters', 'tideDef', 'tide', 'enemies', 'escort',
    'escortExit', 'pickups', 'exits', 'beacon', 'rescue', 'sanctuaryZone',
    'bridges', 'growth', 'levers', 'dams'];
  const ARRAY_KEYS = ['bridges', 'growth', 'levers', 'dams'];

  // ------------------------------------------------------------- utilities
  function announce(s, text, duration) { s.message = text || ''; s._messageTime = duration || 4; }
  function spark(s, x, y, kind, count) {
    for (let i = 0; i < count; i++) {
      const angle = i * 2.3999632297 + s.time;
      s.particles.push({ x, y, vx: Math.cos(angle) * (30 + i * 6),
        vy: Math.sin(angle) * (30 + i * 6), life: .65, maxLife: .65, kind });
    }
    if (s.particles.length > 400) s.particles.splice(0, s.particles.length - 400);
  }
  function award(s, key, amount) {
    if (s.rewards[key]) return false;
    s.rewards[key] = true; s.score += amount; return true;
  }
  const rkey = (s, what, id) => what + ':' + s.roomId + ':' + id;
  function blockers(s) {
    // Solid to beams, shots and movement.
    return s.walls.concat(s.gates.filter(g => !g.open), s.shutters.filter(sh => !sh.open),
      s.breakwaters.filter(b => b.risen), arr(s.growth).filter(g => g.alive),
      arr(s.dams).filter(d => d.hp > 0));
  }
  function moveSolids(s, self) {
    const list = blockers(s);
    for (const m of s.mirrors) list.push({ x: m.x - m.r, y: m.y - m.r, w: m.r * 2, h: m.r * 2 });
    for (const e of s.enemies) {
      if (e === self) continue;
      if (e.type === 'turret' || (e.type === 'mortar' && !isDefeated(e))) {
        list.push({ x: e.x - e.r, y: e.y - e.r, w: e.r * 2, h: e.r * 2 });
      }
    }
    return list;
  }
  function placedPrism(s) { return s.mirrors.find(m => m.portable) || null; }
  function isDefeated(e) { return e.hp <= 0 || e.phase === 'defeated' || e.phase === 'silent'; }
  function defeatedId(s, id) {
    const e = s.enemies.find(en => en.id === id);
    return e ? isDefeated(e) : true; // unknown ids never soft-lock a room
  }
  function gateOpen(s, id) {
    const g = s.gates.find(gt => gt.id === id);
    return g ? g.open : !!s.flags['gate:' + id];
  }
  function conditionMet(s, c) {
    if (!c || typeof c !== 'object') return false;
    let any = false, ok = true;
    if (Array.isArray(c.receivers)) {
      any = true;
      ok = ok && c.receivers.every(id => {
        const r = s.receivers.find(rx => rx.id === id);
        return r ? r.active : !!s.flags['lit:' + id];
      });
    }
    if (Array.isArray(c.defeated)) { any = true; ok = ok && c.defeated.every(id => defeatedId(s, id)); }
    if (typeof c.flag === 'string') { any = true; ok = ok && !!s.flags[c.flag]; }
    if (Array.isArray(c.flags)) { any = true; ok = ok && c.flags.every(f => !!s.flags[f]); }
    if (typeof c.gate === 'string') { any = true; ok = ok && gateOpen(s, c.gate); }
    if (c.rescue) { any = true; ok = ok && !!(s.rescue && s.rescue.freed); }
    if (c.escort) { any = true; ok = ok && !!(s.escort && s.escort.arrived); }
    if (c.beacon) { any = true; ok = ok && !!(s.beacon && s.beacon.reached); }
    return any && ok;
  }
  function bodies(s) {
    const list = [s.player];
    if (s.escort && s.escort.hp > 0) list.push(s.escort);
    for (const e of s.enemies) {
      if (e.hp <= 0 || e.type === 'turret' || e.type === 'mortar') continue;
      if (e.type === 'diver' && (e.submerged || e.phase === 'submerged')) continue;
      list.push(e);
    }
    return list;
  }
  function occupants(s) {
    // Bodies plus the placed prism: nothing solid ever materialises on top of them.
    const list = bodies(s), m = placedPrism(s);
    if (m) list.push(m);
    return list;
  }
  function tideMatch(s, when, rect) {
    if (when === 'high') return s.tide.high;
    if (when === 'low') return !s.tide.high;
    if (when === 'cycle' && rect && rect.period > 0) {
      let ph = (s.roomTime + rect.offset) % rect.period; if (ph < 0) ph += rect.period;
      const on = ph < rect.onFor;
      rect.flipIn = on ? rect.onFor - ph : rect.period - ph;
      return on;
    }
    if (when && typeof when === 'object') {
      let ok = true;
      if (typeof when.flag === 'string') ok = ok && !!s.flags[when.flag];
      if (typeof when.notFlag === 'string') ok = ok && !s.flags[when.notFlag];
      return ok;
    }
    return true;
  }
  function onDryBridge(s, body) {
    return arr(s.bridges).some(b => !b.sunk && inRect(body.x, body.y, b));
  }
  function inWater(s, body) {
    return s.water.some(w => w.active && inRect(body.x, body.y, w)) && !onDryBridge(s, body);
  }
  function losClear(s, x1, y1, x2, y2) {
    const d = length(x2 - x1, y2 - y1);
    return d < EPS || !raySegment(x1, y1, x2 - x1, y2 - y1, blockers(s), d).rect;
  }
  function freeSpot(s, x, y, r) {
    const solids = moveSolids(s);
    const ok = (px, py) => px > r && py > r && px < s.room.w - r && py < s.room.h - r &&
      !solids.some(w => overlapCircle(px, py, r, w));
    if (ok(x, y)) return { x, y };
    for (let rad = 8; rad <= 160; rad += 8) {
      for (let k = 0; k < 16; k++) {
        const a = k * TAU / 16, px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
        if (ok(px, py)) return { x: px, y: py };
      }
    }
    return { x, y };
  }

  // ------------------------------------------------------------ environment
  function environment(s, dt) {
    dt = dt || 0;
    const td = s.tideDef, t = s.roomTime, tide = s.tide;
    if (td) {
      let ph = ((t + td.offset) / td.period) % 1; if (ph < 0) ph += 1;
      tide.active = true; tide.period = td.period;
      tide.level = .5 - .5 * Math.cos(TAU * ph);
      tide.high = tide.level > .5;
      const next = ph < .25 ? .25 : ph < .75 ? .75 : 1.25;
      tide.next = (next - ph) * td.period;
      tide.warning = clamp(1 - tide.next / 1.5, 0, 1);
    } else {
      tide.active = false; tide.level = 0; tide.high = false; tide.warning = 0; tide.next = 0; tide.period = 0;
    }
    for (const w of s.water) w.active = tideMatch(s, w.when, w);
    const bs = occupants(s);
    for (const b of s.breakwaters) {
      if (!tideMatch(s, b.when, b)) { b.risen = false; b.held = false; continue; }
      if (b.risen) continue;
      // Stone never rises onto a body; it waits until the space is clear.
      b.held = bs.some(o => overlapCircle(o.x, o.y, o.r, b));
      if (!b.held) b.risen = true;
    }
    for (const sh of s.shutters) {
      let ph = (t + sh.offset) % sh.period; if (ph < 0) ph += sh.period;
      sh.phase = ph / sh.period;
      const wantOpen = ph < sh.openFor;
      sh.closesIn = wantOpen ? sh.openFor - ph : 0;
      sh.opensIn = wantOpen ? 0 : sh.period - ph;
      if (wantOpen) { sh.open = true; sh.held = false; }
      else if (sh.open) {
        // Never closes on a body: it stays open (held) until the doorway clears.
        sh.held = bs.some(o => overlapCircle(o.x, o.y, o.r, sh));
        if (!sh.held) sh.open = false;
      }
      sh.warning = sh.held ? 1 : sh.open ? clamp(1 - sh.closesIn / .75, 0, 1) : 0;
    }
    // Root bridges sag under any walking body, sink, then recover once left alone.
    const walkers = bs.filter(o => !o.portable);
    for (const br of arr(s.bridges)) {
      br.occupied = walkers.some(o => inRect(o.x, o.y, br));
      if (br.sunk) {
        if (br.occupied) br.timer = br.recover;
        else {
          br.timer = Math.max(0, br.timer - dt);
          if (br.timer <= 0) { br.sunk = false; br.load = 0; br.timer = 0; }
        }
      } else if (br.occupied) {
        br.load = clamp(br.load + dt / br.hold, 0, 1);
        if (br.load >= 1 - EPS) {
          br.load = 1; br.sunk = true; br.timer = br.recover;
          spark(s, br.x + br.w / 2, br.y + br.h / 2, 'water', 10);
          announce(s, 'A root bridge sinks! Never linger on the roots.', 2);
        }
      } else br.load = clamp(br.load - dt / br.hold, 0, 1);
    }
    for (const d of arr(s.dams)) d.hit = Math.max(0, (d.hit || 0) - dt);
    // Cut brambles regrow when their timer ends, unless something stands in them.
    for (const g of arr(s.growth)) {
      if (g.alive) { g.held = false; continue; }
      if (g.regrow <= 0) { g.timer = 0; continue; }
      g.timer = Math.max(0, g.timer - dt);
      if (g.timer > 0) { g.held = false; continue; }
      g.held = bs.some(o => overlapCircle(o.x, o.y, o.r, g));
      if (!g.held) { g.alive = true; spark(s, g.x + g.w / 2, g.y + g.h / 2, 'growth', 6); }
    }
  }

  // ------------------------------------------------------------------ beams
  function trace(s, x, y, dx, dy, kind, depth, skipMirror, usedPlayer, solids) {
    if (depth > MAX_DEPTH || s.beams.length >= MAX_SEGMENTS) return;
    const wall = raySegment(x, y, dx, dy, solids, 1600);
    let best = wall.distance, mirror = null, player = false;
    for (const m of s.mirrors) {
      if (m === skipMirror) continue;
      const t = (m.x - x) * dx + (m.y - y) * dy;
      if (t <= EPS || t >= best) continue;
      if (Math.abs((m.x - x) * dy - (m.y - y) * dx) <= m.r) { best = t; mirror = m; }
    }
    const p = s.player;
    if (!usedPlayer && p.reflecting) {
      const t = (p.x - x) * dx + (p.y - y) * dy;
      if (t > 1 && t < best && Math.abs((p.x - x) * dy - (p.y - y) * dx) <= 18) {
        best = t; player = true; mirror = null;
      }
    }
    if (mirror) {
      s.beams.push({ x1: x, y1: y, x2: mirror.x, y2: mirror.y, kind });
      mirror.lit = true;
      const dirs = mirror.split ? mirror.dirs : [mirror.dirs[mirror.index]];
      for (const d of dirs) {
        trace(s, mirror.x, mirror.y, d[0], d[1], mirror.portable ? 'prism' : mirror.split ? 'split' : 'reflected',
          depth + 1, mirror, usedPlayer, solids);
      }
    } else if (player) {
      s.beams.push({ x1: x, y1: y, x2: x + dx * best, y2: y + dy * best, kind });
      trace(s, p.x, p.y, p.aimX, p.aimY, 'reflected', depth + 1, null, true, solids);
    } else {
      s.beams.push({ x1: x, y1: y, x2: wall.x, y2: wall.y, kind });
    }
  }

  function light(s, dt) {
    const solids = blockers(s), p = s.player;
    s.beams = [];
    for (const m of s.mirrors) m.lit = false;
    for (const em of s.emitters) trace(s, em.x, em.y, em.dx, em.dy, 'sun', 0, null, false, solids);
    for (const r of s.receivers) {
      r.lit = s.beams.some(b => b.kind !== 'sun' && segmentDistance(r.x, r.y, b.x1, b.y1, b.x2, b.y2) <= r.r);
      if (r.latch && r.active) continue;
      // Pumps fill over `fill` seconds of light and never drain.
      if (r.fill > 0) r.charge = clamp(r.charge + (r.lit ? dt / r.fill : 0), 0, 1);
      else r.charge = clamp(r.charge + (r.lit ? dt / CHARGE_TIME : -dt / DECAY_TIME), 0, 1);
      if (r.charge >= 1 - EPS) {
        r.charge = 1;
        if (!r.active) {
          r.active = true;
          spark(s, r.x, r.y, 'light', r.latch ? 18 : 8);
          if (r.latch) latched(s, r, p);
          else s.rings.push({ x: r.x, y: r.y, r: r.r, maxR: r.r + 50, speed: 120, life: 1, hostile: false, kind: 'bell' });
        }
      } else if (!r.latch) r.active = false;
    }
  }
  function latched(s, r, p) {
    s.flags['lit:' + r.id] = true;
    s.rings.push({ x: r.x, y: r.y, r: r.r, maxR: r.r + 70, speed: 140, life: 1, hostile: false, kind: 'light' });
    if (r.kind === 'sanctuary') {
      p.hp = p.maxHp;
      award(s, rkey(s, 'rx', r.id), 150);
      announce(s, r.text || 'Sanctuary restored. Its circle heals you when you retreat.', 6);
    } else {
      award(s, rkey(s, 'rx', r.id), 250);
      announce(s, r.text || (r.kind === 'pump' ? 'The pump fills. Water surges down the channel.' : 'The seal drinks the light.'), 3);
    }
  }

  function updateGates(s) {
    let bs = null;
    for (const g of s.gates) {
      if (g.hold) {
        // Hold gates follow their condition but never close on a body or the prism.
        const met = !!g.opensWhen && conditionMet(s, g.opensWhen);
        if (met) {
          g.held = false;
          if (g.open) continue;
          g.open = true; s.flags['gate:' + g.id] = true;
          for (let i = 0; i < 3; i++) spark(s, g.x + g.w / 2, g.y + g.h * (i + .5) / 3, 'light', 4);
          if (!g.opened) { g.opened = true; announce(s, g.text || 'A gate lifts while the light holds.', 4); }
        } else if (g.open) {
          bs = bs || occupants(s);
          g.held = bs.some(o => overlapCircle(o.x, o.y, o.r, g));
          if (!g.held) { g.open = false; s.flags['gate:' + g.id] = false; }
        } else g.held = false;
        continue;
      }
      if (g.open || !g.opensWhen || !conditionMet(s, g.opensWhen)) continue;
      g.open = true; g.opened = true; s.flags['gate:' + g.id] = true;
      for (let i = 0; i < 3; i++) spark(s, g.x + g.w / 2, g.y + g.h * (i + .5) / 3, 'light', 6);
      announce(s, g.text || 'A gate grinds open.', 5);
    }
  }

  // ------------------------------------------------------------------ damage
  function hurt(s, cause) {
    const p = s.player;
    if (p.invulnerable > 0 || p.dashTime > 0 || s.status !== 'playing') return false;
    p.hp--; s.hits++; p.invulnerable = 1.05;
    spark(s, p.x, p.y, 'hurt', 10);
    if (p.hp <= 0) {
      p.hp = 0; s.status = 'lost'; p.reflecting = false;
      announce(s, 'The prism dims. Retry the room and read the telegraphs.', 8);
    } else {
      announce(s, cause === 'water' ? 'Deep water drags at you. Find dry stone.' :
        cause === 'ring' ? 'Shockwave! Dash through the ring or keep your distance.' :
          cause === 'lob' ? 'A seed bursts at your feet. Leave the landing ring or dash.' :
            cause === 'charge' ? 'The Root Hart tramples you. Sidestep its locked lane.' :
              'Face incoming shots with the mirror, or dash clear.', 2.3);
    }
    return true;
  }
  function hurtEscort(s) {
    const e = s.escort;
    if (!e || e.hp <= 0 || e.arrived || e.invulnerable > 0 || s.status !== 'playing') return false;
    e.hp--; e.invulnerable = 1.0;
    spark(s, e.x, e.y, 'hurt', 8);
    if (e.hp <= 0) {
      e.hp = 0; s.status = 'lost'; s.player.reflecting = false;
      announce(s, e.name + ' has fallen. Retry the room and shield ' + (e.name === 'Ilex' ? 'her' : 'them') + ' from the fire.', 8);
    } else announce(s, e.name + (e.name === 'Ilex' ? ' is hit! Stand between her and the turrets.' : ' is hit! Stand between them and the fire.'), 2.3);
    return true;
  }
  function removeShots(s, owner) { s.shots = s.shots.filter(sh => sh.friendly || sh.owner !== owner); }
  function defeat(s, e) {
    e.hp = 0; e.phase = 'defeated'; e.exposed = 0; e.timer = 0; e.submerged = false;
    s.flags['defeated:' + e.id] = true;
    removeShots(s, e.id);
    s.rings = s.rings.filter(r => r.owner !== e.id);
    spark(s, e.x, e.y, 'light', 24);
    if (e.type === 'diver') {
      award(s, rkey(s, 'defeat', e.id), 800);
      if (s.beacon) s.beacon.lit = true;
      announce(s, e.text || 'The Bell Diver sinks for good. The beacon kindles — reach it.', 7);
    } else if (e.type === 'hart') {
      award(s, rkey(s, 'defeat', e.id), 900);
      e.locked = false; e.stunned = false;
      if (s.beacon) s.beacon.lit = true;
      spark(s, e.x, e.y, 'growth', 20);
      announce(s, e.text || 'The Root Hart kneels into the moss. The beacon kindles — reach it.', 7);
    } else if (e.type === 'mortar') {
      award(s, rkey(s, 'defeat', e.id), 200);
      s.lobs = arr(s.lobs).filter(l => l.owner !== e.id);
      announce(s, e.text || 'The seed mortar splits and falls silent.', 3);
    } else {
      award(s, rkey(s, 'defeat', e.id), 400);
      announce(s, e.text || 'The sentinel falls.', 5);
    }
  }
  function returnedHit(s, e) {
    // A friendly (returned) shot touched enemy e. Returns true when it had an effect.
    if (isDefeated(e)) return false;
    if (e.type === 'mortar') return false; // the bark plate simply eats returned shots
    if (e.type === 'hart') {
      if (e.phase === 'dormant' || e.exposed > 0 || e.phase === 'stagger') return false;
      e.phase = 'stagger'; e.timer = .8; e.locked = false; s.returns++;
      spark(s, e.x, e.y, 'light', 12);
      announce(s, 'The seed cracks against its antlers. The hart staggers.', 2);
      return true;
    }
    if (e.type === 'turret') {
      e.phase = 'jammed'; e.timer = 5; e.shotsLeft = 0; e.locked = false; s.returns++;
      if (!e.jammedOnce) { e.jammedOnce = true; award(s, rkey(s, 'jam', e.id), 50); }
      spark(s, e.x, e.y, 'light', 10);
      announce(s, 'Turret jammed. Move while it sputters.', 2.5);
      return true;
    }
    if (e.type === 'diver') {
      if (e.submerged || e.exposed > 0 || !['volley-telegraph', 'volley-recover', 'recoil'].includes(e.phase)) return false;
      const t = s.flags.chart ? 4.5 : 3;
      e.exposed = t; e.phase = 'exposed'; e.timer = t; e.shotsLeft = 0; s.returns++;
      if (!e.rewardedCracks.includes(e.hp)) { e.rewardedCracks.push(e.hp); s.score += 100; }
      spark(s, e.x, e.y, 'light', 14);
      announce(s, 'The bell cracks open! Strike it now.', t);
      return true;
    }
    if (e.phase === 'dormant' || e.phase === 'patrol') return false;
    if (e.exposed > 0 || e.phase === 'lunge-windup' || e.phase === 'lunge') return false;
    e.exposed = 3.4; e.phase = 'exposed'; e.timer = 3.4; e.shotsLeft = 0; s.returns++;
    if (!e.rewardedCracks.includes(e.hp)) { e.rewardedCracks.push(e.hp); s.score += 100; }
    spark(s, e.x, e.y, 'light', 14);
    announce(s, 'Armor cracked! Close in and strike the exposed core.', 3.4);
    return true;
  }
  function slashHit(s, e) {
    e.hp = Math.max(0, e.hp - 2);
    e.exposed = 0;
    spark(s, e.x, e.y, 'slash', 14);
    if (e.hp === 0) { defeat(s, e); return; }
    if (e.type === 'diver') { e.phase = 'recoil'; e.timer = .7; return; }
    if (e.type === 'hart') { e.phase = 'recover'; e.timer = .6; e.stunned = false; e.locked = false; return; }
    beginLunge(s, e);
  }
  function beginLunge(s, e) {
    e.phase = 'lunge-windup'; e.timer = .9; e.exposed = 0;
    const dx = s.player.x - e.x, dy = s.player.y - e.y;
    const d = Math.max(EPS, length(dx, dy));
    e.aimX = dx / d; e.aimY = dy / d;
    announce(s, 'Red charge! Step aside or dash across its locked path.', 1.25);
  }
  function fire(s, e, angle, speed, dist, kind) {
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const shot = { id: s._nextShotId++, x: e.x + ux * dist, y: e.y + uy * dist,
      vx: ux * speed, vy: uy * speed, friendly: false, life: 5, r: 7, owner: e.id };
    if (kind) shot.kind = kind;
    s.shots.push(shot);
  }

  // ----------------------------------------------------------------- enemies
  function sentinelStep(s, e, dt) {
    const p = s.player;
    if (e.exposed > 0) {
      e.exposed = Math.max(0, e.exposed - dt);
      e.timer = e.exposed;
      if (!e.exposed) beginLunge(s, e);
      return;
    }
    if (e.phase === 'dormant' || e.phase === 'patrol') {
      const d = length(p.x - e.x, p.y - e.y);
      if ((!e.wakeWhen || gateOpen(s, e.wakeWhen)) && d < e.wakeRadius && losClear(s, e.x, e.y, p.x, p.y)) {
        e.phase = 'recover'; e.timer = .75;
        announce(s, 'The sentinel wakes. Mirror its bright shots back at it.', 3);
      } else if (e.phase === 'patrol') {
        const [tx, ty] = e.patrol[e.patrolIndex % e.patrol.length];
        const dx = tx - e.x, dy = ty - e.y, dd = length(dx, dy);
        if (dd < 4) e.patrolIndex = (e.patrolIndex + 1) % e.patrol.length;
        else {
          const sp = Math.min(70, dd / dt);
          e.aimX = dx / dd; e.aimY = dy / dd;
          moveBody(e, e.aimX * sp, e.aimY * sp, dt, moveSolids(s));
        }
      }
      return;
    }
    e.timer -= dt;
    if (e.phase === 'lunge-windup') {
      if (e.timer <= 0) { e.phase = 'lunge'; e.timer = .34; }
      return;
    }
    if (e.phase === 'lunge') {
      moveBody(e, e.aimX * 450, e.aimY * 450, dt, moveSolids(s));
      if (e.timer <= 0) { e.phase = 'recover'; e.timer = 1.05; }
      return;
    }
    if (e.phase === 'recover' && e.timer <= 0) {
      e.phase = 'telegraph'; e.timer = 1.05;
      const d = Math.max(EPS, length(p.x - e.x, p.y - e.y));
      e.aimX = (p.x - e.x) / d; e.aimY = (p.y - e.y) / d;
    } else if (e.phase === 'telegraph' && e.timer <= 0) {
      e.phase = 'attack'; e.timer = 1.45;
      e.shotsLeft = 3; e.shotTimer = 0; e.volley++;
    }
    if (e.phase === 'attack') {
      e.shotTimer -= dt;
      if (e.shotsLeft > 0 && e.shotTimer <= 0) {
        // The aim commits at the start of the full one-second telegraph.
        const offset = (3 - e.shotsLeft) * .055, side = e.volley % 2 ? 1 : -1;
        fire(s, e, Math.atan2(e.aimY, e.aimX) + offset * side, 245, 34);
        e.shotsLeft--; e.shotTimer += .18;
      }
      if (e.timer <= 0) beginLunge(s, e);
    }
  }

  function turretTarget(s, e) {
    const esc = s.escort && s.escort.hp > 0 && !s.escort.arrived ? s.escort : null;
    if (e.targets === 'escort') return esc || s.player;
    if (e.targets === 'nearest' && esc) {
      return length(esc.x - e.x, esc.y - e.y) < length(s.player.x - e.x, s.player.y - e.y) ? esc : s.player;
    }
    return s.player;
  }
  function turretStep(s, e, dt) {
    if (e.phase === 'silent') return;
    if (e.until && gateOpen(s, e.until)) {
      e.phase = 'silent'; e.timer = 0; e.shotsLeft = 0; e.locked = false;
      removeShots(s, e.id); spark(s, e.x, e.y, 'light', 8);
      return;
    }
    e.timer -= dt;
    if (e.phase === 'jammed') {
      if (e.timer <= 0) { e.phase = 'idle'; e.timer = e.interval * .5; }
      return;
    }
    const tgt = turretTarget(s, e);
    const aim = () => {
      const [ux, uy] = unit(tgt.x - e.x, tgt.y - e.y, e.aimX, e.aimY);
      e.aimX = ux; e.aimY = uy;
    };
    if (e.phase === 'idle') {
      if (e.timer <= 0) {
        e.timer = 0;
        if (losClear(s, e.x, e.y, tgt.x, tgt.y)) {
          e.phase = 'telegraph'; e.timer = 1.0; e.locked = false; aim();
        }
      }
      return;
    }
    if (e.phase === 'telegraph') {
      // Tracks for 0.6s, then locks for a readable final 0.4s.
      if (!e.locked) aim();
      if (e.timer <= .4) e.locked = true;
      if (e.timer <= 0) { e.phase = 'volley'; e.shotsLeft = 3; e.shotTimer = 0; e.volley++; e.timer = .6; }
      return;
    }
    if (e.phase === 'volley') {
      e.shotTimer -= dt;
      if (e.shotsLeft > 0 && e.shotTimer <= 0) {
        fire(s, e, Math.atan2(e.aimY, e.aimX), 230, e.r + 10);
        e.shotsLeft--; e.shotTimer += .2;
      }
      if (e.shotsLeft === 0 && e.timer <= 0) { e.phase = 'idle'; e.timer = e.interval; e.locked = false; }
    }
  }

  function surfaceSpot(s, e) {
    const p = s.player, solids = moveSolids(s), r = e.r + 6;
    const base = length(e.x - p.x, e.y - p.y) > 1 ? Math.atan2(e.y - p.y, e.x - p.x) : Math.atan2(-p.aimY, -p.aimX);
    const ok = (x, y) => x > r + 30 && y > r + 30 && x < s.room.w - r - 30 && y < s.room.h - r - 30 &&
      !solids.some(w => overlapCircle(x, y, r, w)) &&
      !s.water.some(w => w.active && overlapCircle(x, y, r, w)) &&
      !s.breakwaters.some(b => overlapCircle(x, y, r, b)) &&
      !s.exits.some(x2 => overlapCircle(x, y, r + 20, x2)) &&
      (!s.beacon || length(x - s.beacon.x, y - s.beacon.y) > 60);
    for (const rad of [130, 165, 100, 200]) {
      for (let k = 0; k < 16; k++) {
        const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8;
        const x = p.x + Math.cos(a) * rad, y = p.y + Math.sin(a) * rad;
        if (ok(x, y)) return { x, y };
      }
    }
    return null;
  }
  function diverStep(s, e, dt) {
    const p = s.player;
    // Without an authored tide the diver keeps its own 11s rhythm (7s surfaced).
    const high = s.tide.active ? s.tide.high : (s.roomTime % 11) >= 7;
    const rising = s.tide.active ? (!s.tide.high && s.tide.next < 2.2) : ((s.roomTime % 11) >= 5);
    const dive = () => { e.phase = 'diving'; e.timer = .6; e.exposed = 0; e.locked = false; };
    if (e.phase === 'exposed') {
      e.exposed = Math.max(0, e.exposed - dt); e.timer = e.exposed;
      if (!e.exposed) { e.phase = 'volley-recover'; e.timer = .6; }
      return;
    }
    e.timer -= dt;
    if (e.phase === 'submerged') {
      e.submerged = true;
      const dx = p.x - e.x, dy = p.y - e.y, d = length(dx, dy);
      if (d > 60) { const sp = Math.min(95, (d - 60) / dt); e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; }
      if (!high && !rising && e.timer <= 0) {
        const spot = surfaceSpot(s, e);
        if (spot) {
          e.x = spot.x; e.y = spot.y; e.phase = 'surfacing'; e.timer = .8;
          announce(s, 'The water boils — the Bell Diver rises!', 1.6);
        } else e.timer = .25;
      }
      return;
    }
    if (e.phase === 'surfacing') {
      if (e.timer <= 0) {
        e.submerged = false; e.phase = 'volley-telegraph'; e.timer = 1.15; e.locked = false;
        s.rings.push({ x: e.x, y: e.y, r: e.r, maxR: 150, speed: 280, life: 1, hostile: true,
          owner: e.id, hitPlayer: false, hitEscort: false, kind: 'shockwave' });
        spark(s, e.x, e.y, 'water', 16);
      }
      return;
    }
    if (e.phase === 'diving') {
      if (e.timer <= 0) { e.phase = 'submerged'; e.submerged = true; e.timer = 1.0; }
      return;
    }
    if (high) { dive(); return; }
    if (e.phase === 'volley-telegraph') {
      if (!e.locked) {
        const [ux, uy] = unit(p.x - e.x, p.y - e.y, e.aimX, e.aimY);
        e.aimX = ux; e.aimY = uy;
      }
      if (e.timer <= .35) e.locked = true;
      if (e.timer <= 0) {
        const base = Math.atan2(e.aimY, e.aimX);
        for (let i = 0; i < 5; i++) fire(s, e, base + (i - 2) * .2, 220, e.r + 8);
        if (e.hp <= e.maxHp / 2) {
          for (let i = 0; i < 8; i++) fire(s, e, i * Math.PI / 4 + (e.volley % 2) * Math.PI / 8, 160, e.r + 8);
        }
        e.volley++; e.phase = 'volley-recover'; e.timer = 1.0; e.locked = false;
      }
      return;
    }
    if ((e.phase === 'volley-recover' || e.phase === 'recoil') && e.timer <= 0) {
      e.phase = 'volley-telegraph'; e.timer = .85; e.locked = false;
    }
  }

  function mortarStep(s, e, dt) {
    const p = s.player;
    e.clang = Math.max(0, e.clang - dt); e.flash = Math.max(0, e.flash - dt);
    const d = length(p.x - e.x, p.y - e.y);
    e.timer -= dt;
    if (e.phase === 'idle') {
      if (e.timer <= 0) {
        e.timer = 0;
        if (d <= e.range) {
          e.phase = 'telegraph'; e.timer = .5;
          const [ux, uy] = unit(p.x - e.x, p.y - e.y, e.facingX, e.facingY);
          e.aimX = ux; e.aimY = uy;
        }
      }
      return;
    }
    if (e.phase === 'telegraph') {
      const [ux, uy] = unit(p.x - e.x, p.y - e.y, e.aimX, e.aimY);
      e.aimX = ux; e.aimY = uy;
      if (e.timer <= 0) {
        // Seeds arc over cover and land where the warden stood at launch.
        s.lobs.push({ id: s._nextShotId++, x0: e.x, y0: e.y, tx: p.x, ty: p.y, x: e.x, y: e.y,
          t: 0, u: 0, z: 0, flight: 1.1, r: 46, owner: e.id });
        e.lobs++; e.phase = 'idle'; e.timer = e.interval;
      }
    }
  }
  function lobs(s, dt) {
    const p = s.player, esc = s.escort, keep = [];
    for (const lob of s.lobs) {
      lob.t += dt;
      const u = clamp(lob.t / lob.flight, 0, 1);
      lob.u = u; lob.x = lob.x0 + (lob.tx - lob.x0) * u; lob.y = lob.y0 + (lob.ty - lob.y0) * u;
      lob.z = 4 * 90 * u * (1 - u);
      if (u < 1) { keep.push(lob); continue; }
      spark(s, lob.tx, lob.ty, 'seed', 10);
      s.rings.push({ x: lob.tx, y: lob.ty, r: 8, maxR: lob.r, speed: 180, life: 1, hostile: false, kind: 'lob' });
      if (s.status !== 'playing') continue;
      if (length(p.x - lob.tx, p.y - lob.ty) <= lob.r + p.r) hurt(s, 'lob');
      if (esc && esc.hp > 0 && !esc.arrived && length(esc.x - lob.tx, esc.y - lob.ty) <= lob.r + esc.r) hurtEscort(s);
    }
    s.lobs = keep;
  }

  function hartSolids(s, e) {
    // Every solid the hart can strike, with intact dams tagged so a charge can tell them apart.
    const list = moveSolids(s, e).map(r => ({ rect: r, dam: null }));
    for (const d of s.dams) if (d.hp > 0) for (const it of list) if (it.rect === d) it.dam = d;
    return list;
  }
  function hartUnstick(s, e) {
    const solids = moveSolids(s, e);
    const ok = (px, py) => px >= e.r && py >= e.r && px <= s.room.w - e.r && py <= s.room.h - e.r &&
      !solids.some(w => overlapCircle(px, py, e.r, w));
    if (ok(e.x, e.y)) return;
    for (let rad = 6; rad <= 240; rad += 6) {
      for (let k = 0; k < 16; k++) {
        const a = k * TAU / 16, px = e.x + Math.cos(a) * rad, py = e.y + Math.sin(a) * rad;
        if (ok(px, py)) { e.x = px; e.y = py; return; }
      }
    }
  }
  function hartImpact(s, e, hit) {
    const damLeft = () => s.dams.some(d => d.hp > 0);
    e.locked = false; e.charges++;
    s.rings.push({ x: e.x + e.aimX * e.r, y: e.y + e.aimY * e.r, r: 10, maxR: 90, speed: 260, life: 1,
      hostile: false, kind: 'impact' });
    if (hit && hit.dam) {
      const dam = hit.dam;
      dam.hp = Math.max(0, dam.hp - 1); dam.hit = .5;
      spark(s, e.x + e.aimX * e.r, e.y + e.aimY * e.r, 'wood', 14);
      e.lastImpact = 'dam';
      if (dam.hp === 0) {
        dam.broken = true; s.flags['dam:' + dam.id] = true;
        spark(s, dam.x + dam.w / 2, dam.y + dam.h / 2, 'water', 24);
      }
      const t = s.flags.lens ? 4.5 : 3.2;
      e.phase = 'stunned'; e.stunned = true; e.exposed = t; e.timer = t;
      announce(s, dam.hp === 0 ? 'The dam bursts! The hart reels — strike it now.' :
        'Antlers bite the timber. The hart is stunned — strike it now.', 3);
    } else if (!damLeft()) {
      // No dam remains: stone must serve, so the fight can never soft-lock.
      e.lastImpact = 'solid';
      spark(s, e.x + e.aimX * e.r, e.y + e.aimY * e.r, 'spark', 10);
      e.phase = 'stunned'; e.stunned = true; e.exposed = 2.4; e.timer = 2.4;
      announce(s, 'The hart cracks its antlers on stone. Strike!', 2.4);
    } else {
      e.lastImpact = 'solid';
      spark(s, e.x + e.aimX * e.r, e.y + e.aimY * e.r, 'spark', 8);
      e.phase = 'dazed'; e.timer = .9; e.exposed = 0;
      announce(s, 'Stone only dazes it. Bait the charge into a timber dam.', 2.2);
    }
  }
  function hartStep(s, e, dt) {
    const p = s.player, half = e.hp <= e.maxHp / 2;
    e.flash = Math.max(0, e.flash - dt);
    const stalkTime = () => half ? 1.0 : 1.3;
    const toPlayer = () => unit(p.x - e.x, p.y - e.y, e.aimX, e.aimY);
    if (e.phase === 'dormant') {
      if (length(p.x - e.x, p.y - e.y) < e.wakeRadius) {
        e.phase = 'stalk'; e.timer = stalkTime();
        announce(s, 'The Root Hart lowers its antlers. Bait its charge into the timber dams.', 3.5);
      }
      return;
    }
    hartUnstick(s, e);
    if (e.phase === 'stunned') {
      e.exposed = Math.max(0, e.exposed - dt); e.timer = e.exposed;
      if (!e.exposed) { e.phase = 'recover'; e.timer = .6; e.stunned = false; }
      return;
    }
    e.timer -= dt;
    if (e.phase === 'stalk') {
      const [ux, uy] = toPlayer();
      e.aimX = ux; e.aimY = uy;
      if (length(p.x - e.x, p.y - e.y) > e.r + p.r + 12) moveBody(e, ux * 60, uy * 60, dt, moveSolids(s, e));
      if (e.timer <= 0) { e.phase = 'aim'; e.timer = .9; e.locked = false; }
    } else if (e.phase === 'aim') {
      if (!e.locked) { const [ux, uy] = toPlayer(); e.aimX = ux; e.aimY = uy; }
      if (e.timer <= .35) e.locked = true;
      if (e.timer <= 0) {
        e.phase = 'charge'; e.timer = 1.3; e.locked = true;
        announce(s, 'Charge!', .8);
      }
    } else if (e.phase === 'charge') {
      const solids = hartSolids(s, e);
      const dist = 540 * Math.min(dt, Math.max(0, e.timer + dt));
      const n = Math.max(1, Math.ceil(dist / 4));
      for (let i = 0; i < n; i++) {
        const nx = e.x + e.aimX * dist / n, ny = e.y + e.aimY * dist / n;
        const hits = solids.filter(it => overlapCircle(nx, ny, e.r, it.rect));
        const out = nx < e.r || ny < e.r || nx > s.room.w - e.r || ny > s.room.h - e.r;
        if (hits.length || out) { hartImpact(s, e, hits.find(it => it.dam) || hits[0] || null); return; }
        e.x = nx; e.y = ny;
      }
      if (e.timer <= 0) { e.phase = 'recover'; e.timer = .6; e.locked = false; e.lastImpact = null; }
    } else if (e.phase === 'dazed' || e.phase === 'stagger') {
      if (e.timer <= 0) { e.phase = 'stalk'; e.timer = stalkTime(); }
    } else if (e.phase === 'recover') {
      if (e.timer <= 0) {
        if (half) {
          const [ux, uy] = toPlayer();
          const base = Math.atan2(uy, ux);
          for (let i = 0; i < 5; i++) fire(s, e, base + (i - 2) * .2, 220, e.r + 8, 'seed');
          e.volley++;
        }
        e.phase = 'stalk'; e.timer = stalkTime();
      }
    } else { e.phase = 'stalk'; e.timer = stalkTime(); }
    if (e.phase === 'aim' || e.phase === 'stalk') {
      e.aimDist = raySegment(e.x, e.y, e.aimX, e.aimY, moveSolids(s, e), 540 * 1.3).distance;
    }
  }

  // ------------------------------------------------------------------ escort
  function escortStep(s, dt) {
    const e = s.escort;
    if (!e || e.hp <= 0) return;
    e.invulnerable = Math.max(0, e.invulnerable - dt);
    if (e.arrived) { e.waiting = null; return; }
    if (s.escortExit && inRect(e.x, e.y, s.escortExit)) { arrive(s); return; }
    if (e.index >= e.path.length) { arrive(s); return; }
    const [tx, ty] = e.path[e.index];
    const dx = tx - e.x, dy = ty - e.y, d = length(dx, dy);
    if (d < 3) { e.index++; return; }
    if (length(s.player.x - e.x, s.player.y - e.y) > LEASH) { e.waiting = 'leash'; return; }
    if (raySegment(e.x, e.y, dx, dy, blockers(s), d).rect) { e.waiting = 'blocked'; return; }
    e.waiting = null;
    const wading = inWater(s, e);
    const sp = Math.min(120 * (wading ? WADE : 1), d / dt);
    moveBody(e, dx / d * sp, dy / d * sp, dt, moveSolids(s));
    if (wading) {
      e.wade += dt;
      if (e.wade >= WADE_HURT) { e.wade -= WADE_HURT; hurtEscort(s); }
    } else e.wade = Math.max(0, e.wade - dt);
  }
  function arrive(s) {
    const e = s.escort;
    e.arrived = true; e.waiting = null;
    s.flags.escorted = true; s.flags['escort:' + s.roomId] = true;
    if (e.flag) s.flags[e.flag] = true;
    award(s, rkey(s, 'escort', 'ilex'), 300 + e.hp * 50);
    spark(s, e.x, e.y, 'light', 18);
    announce(s, e.text || (e.name === 'Ilex' ? 'Ilex is through. "I can hold the stair from here."' : e.name + ' is through.'), 5);
  }

  // --------------------------------------------------------- room lifecycle
  function saveRoom(s) {
    if (!s.roomId) return;
    const data = {};
    for (const k of ROOM_KEYS) data[k] = s[k];
    s.roomStates[s.roomId] = data;
  }
  function calm(s) {
    // Re-entry resets transient combat phases so nothing ambushes a doorway.
    for (const e of s.enemies) {
      if (isDefeated(e)) continue;
      if (e.type === 'turret') {
        if (e.phase !== 'jammed') { e.phase = 'idle'; e.timer = Math.max(1.6, e.interval * .5); }
        e.shotsLeft = 0; e.locked = false;
      } else if (e.type === 'diver') {
        e.phase = 'submerged'; e.submerged = true; e.timer = 1.5; e.exposed = 0; e.locked = false;
      } else if (e.type === 'mortar') {
        e.phase = 'idle'; e.timer = Math.max(1.2, e.interval * .5); e.clang = 0; e.flash = 0;
      } else if (e.type === 'hart') {
        if (e.phase !== 'dormant') {
          e.phase = 'stalk'; e.timer = 1.3; e.exposed = 0; e.stunned = false; e.locked = false;
        }
      } else if (e.phase !== 'dormant' && e.phase !== 'patrol') {
        e.phase = 'recover'; e.timer = 1.2; e.exposed = 0; e.shotsLeft = 0;
      }
    }
    if (s.escort) s.escort.invulnerable = 0;
  }
  function snapshot(s) {
    // The region checkpoint is kept beside (never inside) the room snapshot.
    s._entry = null;
    const region = s._regionEntry;
    s._regionEntry = null;
    const p = s.player, hp = p.hp, inv = p.invulnerable;
    p.hp = p.maxHp; p.invulnerable = 0;
    s._entry = JSON.stringify(s);
    p.hp = hp; p.invulnerable = inv;
    s._regionEntry = region === undefined ? null : region;
  }
  function returnPrism(s) {
    // A placed prism always travels back to the satchel when the warden leaves its room.
    const p = s.player;
    if (p.prism !== 'placed') return false;
    s.mirrors = s.mirrors.filter(m => !m.portable);
    p.prism = 'carried'; s.prismRoom = null;
    return true;
  }
  function enterRoom(s, id, spawn) {
    if (!s || !id) return false;
    const stored = s.roomStates[id];
    const def = stored ? null : lookupDef(id);
    if (!stored && !def) return false;
    let prismBack = false;
    if (s.roomId && s.roomId !== id) { prismBack = returnPrism(s); saveRoom(s); }
    const data = stored || buildRoom(def, id);
    delete s.roomStates[id];
    for (const k of ROOM_KEYS) s[k] = data[k];
    for (const k of ARRAY_KEYS) if (!Array.isArray(s[k])) s[k] = [];
    // Never restore a stray portable prism from a saved room.
    if (s.mirrors.some(m => m.portable) && s.prismRoom !== id) s.mirrors = s.mirrors.filter(m => !m.portable);
    s.roomId = id;
    s.regionId = s.room.region || s.regionId || 'tidal-abbey';
    ensureCleared(s, s.regionId);
    if (stored) calm(s);
    s.emitter = s.emitters[0] || null;
    const p = s.player;
    const want = spawn && Number.isFinite(spawn.x) && Number.isFinite(spawn.y) ? spawn : s.spawn;
    const spot = freeSpot(s, want.x, want.y, p.r);
    p.x = spot.x; p.y = spot.y;
    p.dashTime = 0; p.slashTime = 0; p.reflecting = false;
    s.shots = []; s.rings = []; s.particles = []; s.beams = []; s.lobs = [];
    s.transition = 1; s._exitArmed = false; s._wade = 0; s._sanctuaryCooldown = 0;
    if (!s.visited.includes(id)) s.visited.push(id);
    environment(s);
    light(s, 0);
    s.sanctuary = sanctuaryActive(s);
    s.objective = objective(s);
    announce(s, prismBack ? (s.room.intro || s.room.name) + ' (The prism returns to your satchel.)' : s.room.intro || s.room.name, 5);
    snapshot(s);
    return true;
  }
  function retryRoom(s) {
    if (!s || !s._entry) return s;
    const json = s._entry, data = JSON.parse(json), region = s._regionEntry || null;
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, data);
    s._entry = json; s._regionEntry = region;
    s.status = 'playing';
    s.emitter = s.emitters[0] || null;
    s.transition = 1;
    announce(s, s.room.intro || s.room.name, 5);
    return s;
  }

  function authoredRegion(regionId) {
    if (regionId === 'tidal-abbey') return true;
    const rooms = PW.ROOMS && typeof PW.ROOMS === 'object' ? PW.ROOMS : {};
    return Object.keys(rooms).some(k => rooms[k] && rooms[k].region === regionId);
  }
  function ensureCleared(s, regionId) {
    const region = regionInfo(regionId);
    for (const c of region ? arr(region.challenges) : []) if (!(c.id in s.cleared)) s.cleared[c.id] = false;
  }
  function initialCleared() {
    // One key per challenge of every region that has authored rooms (see report: the
    // abbey pilot test compares cleared to exactly A1..A5 while Region 2 rooms are absent).
    const out = {};
    for (const region of arr(PW.REGIONS)) {
      if (!authoredRegion(region.id)) continue;
      for (const c of arr(region.challenges)) out[c.id] = false;
    }
    return out;
  }
  function checkpoint(s) {
    const entry = s._entry, region = s._regionEntry;
    s._entry = null; s._regionEntry = null;
    const json = JSON.stringify(s);
    s._entry = entry; s._regionEntry = region;
    return json;
  }
  function continueRegion(s) {
    if (!s || !s.next || !s.next.room) return s;
    const next = s.next;
    s.next = null;
    s.status = 'playing';
    s.player.hp = s.player.maxHp; s.player.invulnerable = 0;
    if (!enterRoom(s, next.room, next.spawn)) {
      s.next = next; s.status = 'cleared';
      announce(s, 'The way onward is not open yet.', 4);
      return s;
    }
    s._regionEntry = checkpoint(s);
    return s;
  }
  function restartRegion(s) {
    if (!s) return s;
    const region = s._regionEntry || null;
    let data;
    if (region) { data = JSON.parse(region); }
    else { data = create(); }
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, data);
    s._regionEntry = region;
    s.status = 'playing';
    s.emitter = s.emitters[0] || null;
    s.transition = 1;
    snapshot(s);
    announce(s, s.room.intro || s.room.name, 5);
    return s;
  }
  function create(opts) {
    opts = opts || {};
    const s = {
      status: 'ready', time: 0, score: 0, hits: 0, returns: 0,
      regionId: 'tidal-abbey', roomId: null, room: null,
      player: { x: 190, y: 540, r: 14, hp: 6, maxHp: 6, aimX: 1, aimY: 0,
        reflecting: false, slashTime: 0, slashCooldown: 0, dashTime: 0,
        dashCooldown: 0, invulnerable: 0, dashX: 1, dashY: 0, wading: false, prism: null },
      walls: [], gates: [], emitters: [], emitter: null, receivers: [], mirrors: [],
      water: [], breakwaters: [], shutters: [], tide: null, enemies: [], escort: null,
      bridges: [], growth: [], levers: [], dams: [], lobs: [], next: null, prismRoom: null,
      escortExit: null, pickups: [], exits: [], beacon: null, rescue: null,
      sanctuaryZone: null, sanctuary: false,
      beams: [], shots: [], particles: [], rings: [],
      flags: {}, cleared: initialCleared(), visited: [], roomStates: {}, rewards: {},
      objective: '', transition: 1, message: '',
      _slashHeld: false, _dashHeld: false, _slashSerial: 0, _nextShotId: 1,
      _sanctuaryCooldown: 0, _messageTime: 0, _exitArmed: false, _wade: 0, _entry: null,
      _placeHeld: false, _regionEntry: null
    };
    if (!enterRoom(s, opts.room || 'cloister', opts.spawn)) enterRoom(s, 'cloister');
    return s;
  }

  // -------------------------------------------------------------- objectives
  function sanctuaryActive(s) {
    const z = s.sanctuaryZone;
    if (z) {
      if (z.receiver) {
        const r = s.receivers.find(rx => rx.id === z.receiver);
        z.active = r ? r.active : !!s.flags['lit:' + z.receiver];
      } else z.active = true;
      return z.active;
    }
    return s.receivers.some(r => r.kind === 'sanctuary' && r.active);
  }
  function objective(s) {
    const O = (s.room && s.room.objectives) || {};
    if (s.status === 'won') return O.won || (s.regionId === 'tidal-abbey' ? 'The abbey beacon burns again' :
      'The ' + regionName(s.regionId) + ' beacon burns again');
    if (s.status === 'cleared') return O.cleared || regionName(s.regionId) + ' restored · continue onward';
    const diver = s.enemies.find(e => e.type === 'diver' && !isDefeated(e));
    if (diver) return O.boss || (diver.submerged || diver.phase === 'diving' ?
      'Hold dry ground · watch the tide' : 'Return fire · expose armor');
    const hart = s.enemies.find(e => e.type === 'hart' && !isDefeated(e));
    if (hart) {
      if (hart.phase === 'dormant') return O.approach || O.boss || 'Approach the Root Hart';
      if (hart.exposed > 0) return O.strike || 'Strike the stunned hart';
      return O.boss || (s.dams.some(d => d.hp > 0) ? 'Bait its charge into a timber dam' : 'Bait its charge into stone');
    }
    if (s.beacon && !s.beacon.reached) {
      if (s.beacon.lit || s.beacon.requires.every(id => defeatedId(s, id))) return O.beacon || 'Reach the beacon';
    }
    if (s.escort && !s.escort.arrived && s.escort.hp > 0) return O.escort || 'Escort Ilex to safety';
    const gate = s.gates.find(g => !g.open && g.opensWhen && !g.optional);
    if (gate) {
      const c = gate.opensWhen;
      if (Array.isArray(c.receivers) && !c.receivers.every(id => { const r = s.receivers.find(x => x.id === id); return r ? r.active : s.flags['lit:' + id]; })) {
        const bells = c.receivers.filter(id => { const r = s.receivers.find(x => x.id === id); return r && r.kind === 'bell'; }).length;
        return O.seal || (bells > 1 ? 'Light both bells at once' : bells ? 'Ring the bell with light' : 'Light the seal');
      }
      if (Array.isArray(c.defeated) && !c.defeated.every(id => defeatedId(s, id))) return O.fight || fightHint(s, c.defeated);
    }
    if (s.rescue && !s.rescue.freed) {
      if (!s.rescue.requires.every(id => defeatedId(s, id))) return O.fight || fightHint(s, s.rescue.requires);
      if (s.rescue.requiresFlag && !s.flags[s.rescue.requiresFlag]) return O.route || 'Open a way to them';
      return O.rescue || (s.rescue.flag === 'ilex' ? 'Free Ilex' : 'Free the ' + s.rescue.flag);
    }
    if (gate) return O.gate || 'Find a way through';
    if (s.sanctuaryZone && !s.sanctuaryZone.active) return O.seal || 'Restore the sanctuary light';
    if (O.exit) return O.exit;
    const exit = s.exits.find(x => !s.visited.includes(x.to)) || s.exits[0];
    return exit ? 'Continue to ' + exit.toName : '';
  }
  function fightHint(s, ids) {
    const alive = s.enemies.filter(e => ids.includes(e.id) && !isDefeated(e));
    if (alive.length && alive.every(e => e.type === 'mortar')) return 'Flank the mortars · strike behind the bark';
    return 'Return fire · expose armor';
  }
  function clearMet(s) {
    const c = s.room.clearWhen;
    if (c) return conditionMet(s, c);
    if (s.beacon) return s.beacon.lit || s.beacon.reached;
    const boss = s.enemies.find(e => e.type === 'diver' || e.type === 'hart');
    if (boss) return isDefeated(boss);
    if (s.escort) return s.escort.arrived;
    if (s.rescue) return s.rescue.freed;
    const main = s.gates.filter(g => g.main);
    const req = main.length ? main : s.gates.filter(g => !g.optional && g.opensWhen);
    return req.length > 0 && req.every(g => g.open);
  }
  function checkClear(s) {
    const ch = s.room.challenge;
    if (!ch || s.cleared[ch] === true || !clearMet(s)) return;
    s.cleared[ch] = true;
    award(s, 'clear:' + ch, 500);
    const info = typeof PW.challengeById === 'function' ? PW.challengeById(ch) : null;
    if (s.status === 'playing') announce(s, 'Challenge ' + ch + ' complete' + (info ? ': ' + info.title : '') + '.', 4);
  }

  // -------------------------------------------------------------------- step
  function projectiles(s, dt, solids) {
    const p = s.player, esc = s.escort, remaining = [];
    for (const shot of s.shots.slice()) {
      if (s.status !== 'playing') break;
      shot.life -= dt;
      const distance = length(shot.vx, shot.vy) * dt;
      const end = raySegment(shot.x, shot.y, shot.vx, shot.vy, solids, distance);
      const nx = end.x, ny = end.y;
      let consumed = false;
      if (shot.friendly) {
        for (const e of s.enemies) {
          if (isDefeated(e) || (e.type === 'diver' && (e.submerged || e.phase === 'surfacing'))) continue;
          if (segmentDistance(e.x, e.y, shot.x, shot.y, nx, ny) <= e.r + shot.r) {
            returnedHit(s, e); consumed = true; break;
          }
        }
      } else if (segmentDistance(p.x, p.y, shot.x, shot.y, nx, ny) <= p.r + shot.r + (p.reflecting ? 9 : 0)) {
        const speed = Math.max(EPS, length(shot.vx, shot.vy));
        const facing = p.aimX * (-shot.vx / speed) + p.aimY * (-shot.vy / speed);
        if (p.reflecting && facing >= .35) {
          shot.friendly = true; shot.vx = p.aimX * 390; shot.vy = p.aimY * 390;
          shot.x = p.x + p.aimX * 32; shot.y = p.y + p.aimY * 32;
          shot.life = 3;
          spark(s, shot.x, shot.y, 'light', 8);
          remaining.push(shot); continue;
        }
        hurt(s, 'shot'); consumed = true;
      } else if (esc && esc.hp > 0 && !esc.arrived &&
        segmentDistance(esc.x, esc.y, shot.x, shot.y, nx, ny) <= esc.r + shot.r) {
        hurtEscort(s); consumed = true;
      }
      if (!consumed && !end.rect && shot.life > 0) {
        shot.x = nx; shot.y = ny; remaining.push(shot);
      } else if (end.rect && !consumed) spark(s, nx, ny, shot.friendly ? 'light' : 'spark', 3);
    }
    if (s.status === 'playing') s.shots = remaining;
  }
  function rings(s, dt) {
    const p = s.player, esc = s.escort, keep = [];
    for (const ring of s.rings) {
      ring.r += ring.speed * dt;
      ring.life = clamp(1 - ring.r / ring.maxR, 0, 1);
      if (ring.hostile && s.status === 'playing') {
        if (!ring.hitPlayer && Math.abs(length(p.x - ring.x, p.y - ring.y) - ring.r) <= p.r + 8 &&
          losClear(s, ring.x, ring.y, p.x, p.y) && hurt(s, 'ring')) ring.hitPlayer = true;
        if (esc && !ring.hitEscort && esc.hp > 0 && !esc.arrived &&
          Math.abs(length(esc.x - ring.x, esc.y - ring.y) - ring.r) <= esc.r + 8 &&
          losClear(s, ring.x, ring.y, esc.x, esc.y) && hurtEscort(s)) ring.hitEscort = true;
      }
      if (ring.r < ring.maxR) keep.push(ring);
    }
    s.rings = keep;
  }
  function contactable(e) {
    if (isDefeated(e) || e.exposed > 0 || e.type === 'turret') return false;
    if (e.type === 'diver') return ['volley-telegraph', 'volley-recover', 'recoil'].includes(e.phase);
    if (e.type === 'mortar') return false;
    if (e.type === 'hart') return e.phase === 'charge';
    return true;
  }

  function step(s, input, dt) {
    if (!s || s.status !== 'playing') return s;
    input = input || {};
    dt = Number.isFinite(dt) ? clamp(dt, 0, 1 / 30) : 0;
    if (!dt) return s;
    s.time += dt; s.roomTime += dt;
    s.transition = Math.max(0, s.transition - dt / .6);
    const p = s.player;
    for (const key of ['slashTime', 'slashCooldown', 'dashTime', 'dashCooldown', 'invulnerable']) {
      p[key] = Math.max(0, p[key] - dt);
    }
    s._messageTime = Math.max(0, s._messageTime - dt);
    const ax = Number.isFinite(input.ax) ? input.ax : 0, ay = Number.isFinite(input.ay) ? input.ay : 0;
    const aimLength = length(ax, ay);
    if (aimLength > .01) { p.aimX = ax / aimLength; p.aimY = ay / aimLength; }
    let mx = Number.isFinite(input.mx) ? input.mx : 0, my = Number.isFinite(input.my) ? input.my : 0;
    const moveLength = length(mx, my);
    if (moveLength > 1) { mx /= moveLength; my /= moveLength; }
    if (input.dash && !s._dashHeld && p.dashCooldown <= 0) {
      p.dashTime = .18; p.dashCooldown = 1.15;
      p.dashX = moveLength > .01 ? mx / Math.max(EPS, length(mx, my)) : p.aimX;
      p.dashY = moveLength > .01 ? my / Math.max(EPS, length(mx, my)) : p.aimY;
      p.invulnerable = Math.max(p.invulnerable, .24);
      spark(s, p.x, p.y, 'dash', 7);
    }
    p.reflecting = !!input.reflect && p.dashTime <= 0 && p.slashTime <= 0;
    let slashed = false;
    if (input.slash && !s._slashHeld && p.slashCooldown <= 0 && p.dashTime <= 0) {
      p.slashTime = .22; p.slashCooldown = .43; p.reflecting = false; s._slashSerial++; slashed = true;
    }
    const placing = !!input.place && !s._placeHeld;
    s._slashHeld = !!input.slash; s._dashHeld = !!input.dash; s._placeHeld = !!input.place;
    if (placing) placeInput(s);
    if (slashed) {
      slashWorld(s);
      // A slash turns the nearest rotatable mirror within reach.
      let best = null, bd = 70;
      for (const m of s.mirrors) {
        const d = length(m.x - p.x, m.y - p.y);
        if (!m.split && m.dirs.length > 1 && d <= bd) { best = m; bd = d; }
      }
      if (best) {
        best.index = (best.index + 1) % best.dirs.length;
        spark(s, best.x, best.y, 'light', 6);
        s.rings.push({ x: best.x, y: best.y, r: best.r, maxR: best.r + 26, speed: 110, life: 1, hostile: false, kind: 'mirror' });
      }
    }

    environment(s, dt);
    p.wading = inWater(s, p);
    const speed = (p.reflecting ? 108 : 190) * (p.wading ? WADE : 1);
    const dashSpeed = 520 * (p.wading ? .7 : 1);
    moveBody(p, p.dashTime > 0 ? p.dashX * dashSpeed : mx * speed,
      p.dashTime > 0 ? p.dashY * dashSpeed : my * speed, dt, moveSolids(s));
    p.x = clamp(p.x, p.r, s.room.w - p.r); p.y = clamp(p.y, p.r, s.room.h - p.r);

    escortStep(s, dt);
    light(s, dt);
    updateGates(s);
    for (const e of s.enemies) {
      if (s.status !== 'playing') break;
      if (isDefeated(e) && e.type !== 'turret') continue;
      if (e.type === 'turret') turretStep(s, e, dt);
      else if (e.type === 'diver') diverStep(s, e, dt);
      else if (e.type === 'mortar') mortarStep(s, e, dt);
      else if (e.type === 'hart') hartStep(s, e, dt);
      else sentinelStep(s, e, dt);
    }
    projectiles(s, dt, blockers(s));
    rings(s, dt);
    if (s.status === 'playing') lobs(s, dt);

    const walls = blockers(s);
    for (const e of s.enemies) {
      if (s.status !== 'playing') break;
      if (isDefeated(e) || e.type === 'turret') continue;
      const dx = e.x - p.x, dy = e.y - p.y, dist = length(dx, dy);
      if (e.type === 'mortar') {
        if (p.slashTime > 0 && e.lastSlash !== s._slashSerial && dist < e.r + 54 &&
          (dx * p.aimX + dy * p.aimY) / Math.max(EPS, dist) > .1 &&
          !raySegment(p.x, p.y, dx, dy, walls, dist).rect) {
          e.lastSlash = s._slashSerial; mortarSlash(s, e);
        }
        continue;
      }
      if (e.exposed > 0 && p.slashTime > 0 && e.lastSlash !== s._slashSerial && dist < e.r + 54 &&
        (dx * p.aimX + dy * p.aimY) / Math.max(EPS, dist) > .1 &&
        !raySegment(p.x, p.y, dx, dy, walls, dist).rect) {
        e.lastSlash = s._slashSerial; slashHit(s, e);
      }
      if (contactable(e) && dist < p.r + e.r) hurt(s, e.type === 'hart' ? 'charge' : 'contact');
      const esc = s.escort;
      if (esc && contactable(e) && esc.hp > 0 && !esc.arrived && length(e.x - esc.x, e.y - esc.y) < esc.r + e.r) hurtEscort(s);
    }
    if (s.status !== 'playing') return finish(s, dt);

    // Deep water drags and wounds the wader.
    if (p.wading) {
      s._wade += dt;
      if (s._wade >= WADE_HURT) { s._wade -= WADE_HURT; hurt(s, 'water'); }
    } else s._wade = Math.max(0, s._wade - dt);
    if (s.status !== 'playing') return finish(s, dt);

    s.sanctuary = sanctuaryActive(s);
    const zone = s.sanctuaryZone;
    if (zone && zone.active && length(p.x - zone.x, p.y - zone.y) < zone.r) {
      s._sanctuaryCooldown -= dt;
      if (s._sanctuaryCooldown <= 0 && p.hp < p.maxHp) {
        p.hp++; s._sanctuaryCooldown = 1; spark(s, p.x, p.y, 'heal', 6);
      }
    } else s._sanctuaryCooldown = Math.max(0, s._sanctuaryCooldown - dt);

    for (const pk of s.pickups) {
      if (pk.taken || length(p.x - pk.x, p.y - pk.y) > p.r + 20) continue;
      pk.taken = true; s.flags['pickup:' + pk.id] = true;
      spark(s, pk.x, pk.y, 'light', 12);
      if (pk.kind === 'prism') {
        if (!p.prism) p.prism = 'carried';
        s.flags.prism = true;
        award(s, rkey(s, 'pickup', pk.id), 150);
        announce(s, pk.text || 'A keeper’s prism. Press PRISM (Q) to set it down and bend the light; press again beside it to lift it.', 7);
      } else if (pk.kind === 'heart') {
        p.maxHp++; p.hp = Math.min(p.maxHp, p.hp + 1);
        award(s, rkey(s, 'pickup', pk.id), 100);
        announce(s, pk.text || 'A keeper’s heart: +1 maximum health.', 5);
      } else {
        s.flags[pk.kind] = true;
        award(s, rkey(s, 'pickup', pk.id), 150);
        announce(s, pk.text || (pk.kind === 'chart' ? 'The keeper chart marks the Bell Diver’s seams: it stays exposed longer.' : 'Found something.'), 6);
      }
    }

    const rescue = s.rescue;
    if (rescue && !rescue.freed && rescue.requires.every(id => defeatedId(s, id)) &&
      (!rescue.requiresFlag || s.flags[rescue.requiresFlag]) &&
      length(p.x - rescue.x, p.y - rescue.y) < 42) {
      const rflag = rescue.flag || 'ilex';
      rescue.freed = true; s.flags[rflag] = true; s.flags['rescue:' + s.roomId] = true;
      award(s, rkey(s, 'rescue', rflag), 700 + p.hp * 50);
      spark(s, rescue.x, rescue.y, 'light', 25);
      if (rescue.completes) {
        s.status = 'won'; p.reflecting = false;
        announce(s, rescue.text || 'Ilex is free. The first beacon answers. Courtyard complete.', 8);
      } else announce(s, rescue.text || 'Ilex is free. "The sluice court is next — I’ll follow your light."', 6);
    }

    const beacon = s.beacon;
    if (beacon && !beacon.reached) {
      if (!beacon.lit && beacon.requires.every(id => defeatedId(s, id))) beacon.lit = true;
      if (beacon.lit && length(p.x - beacon.x, p.y - beacon.y) < 46) {
        beacon.reached = true; p.reflecting = false;
        // A beacon with `next` completes this region only; without it the game is won.
        s.status = beacon.next ? 'cleared' : 'won';
        if (beacon.next) s.next = copy(beacon.next);
        s.flags['beacon:' + s.regionId] = true;
        checkClear(s);
        award(s, 'beacon:' + s.regionId, 1000 + p.hp * 50);
        spark(s, beacon.x, beacon.y, 'light', 30);
        announce(s, beacon.text || (s.regionId === 'tidal-abbey' ?
          'The abbey beacon burns again. The Tidal Abbey is restored.' :
          'The ' + regionName(s.regionId) + ' beacon burns again. The ' + regionName(s.regionId) + ' is restored.'), 10);
      }
    }

    if (s.status === 'playing') {
      const touching = s.exits.find(x => overlapCircle(p.x, p.y, p.r, x));
      if (!touching) s._exitArmed = true;
      else if (s._exitArmed && touching.to) {
        if (enterRoom(s, touching.to, touching.spawn)) return s;
        s._exitArmed = false;
        announce(s, 'That way is sealed for now.', 2);
      }
    }
    checkClear(s);
    return finish(s, dt);
  }
  function finish(s, dt) {
    s.particles = s.particles.filter(particle => {
      particle.life -= dt;
      particle.x += (particle.vx || 0) * dt; particle.y += (particle.vy || 0) * dt;
      return particle.life > 0;
    });
    s.objective = objective(s);
    if (s._messageTime === 0 && s.status === 'playing') s.message = '';
    return s;
  }

  // ------------------------------------------------------------ tools & slash
  function placeInput(s) {
    const p = s.player;
    if (p.prism === 'carried') {
      const x = p.x + p.aimX * 34, y = p.y + p.aimY * 34, r = 14;
      const inside = x >= r && y >= r && x <= s.room.w - r && y <= s.room.h - r;
      const solid = moveSolids(s).some(w => overlapCircle(x, y, r, w));
      const wet = s.water.some(w => w.active && inRect(x, y, w));
      const bridge = s.bridges.some(b => overlapCircle(x, y, r, b));
      const crowded = bodies(s).some(o => o !== p && length(o.x - x, o.y - y) < o.r + r);
      if (!inside || solid || wet || bridge || crowded) {
        announce(s, 'The prism needs dry, open ground.', 2);
        return;
      }
      let index = Math.round(Math.atan2(p.aimY, p.aimX) / (Math.PI / 4)) % 8;
      if (index < 0) index += 8;
      s.mirrors.push({ id: 'prism', portable: true, x, y, r, split: false,
        dirs: PRISM_DIRS.map(d => d.slice()), index, lit: false });
      p.prism = 'placed'; s.prismRoom = s.roomId;
      spark(s, x, y, 'light', 10);
      s.rings.push({ x, y, r, maxR: r + 30, speed: 120, life: 1, hostile: false, kind: 'prism' });
      announce(s, 'Prism set. Slash beside it to turn it; press PRISM beside it to lift it.', 3);
      return;
    }
    if (p.prism === 'placed') {
      const m = placedPrism(s);
      if (!m) { p.prism = 'carried'; s.prismRoom = null; return; }
      if (length(m.x - p.x, m.y - p.y) > 80) { announce(s, 'Walk back to lift the prism.', 2); return; }
      s.mirrors = s.mirrors.filter(q => !q.portable);
      p.prism = 'carried'; s.prismRoom = null;
      spark(s, m.x, m.y, 'light', 8);
      announce(s, 'Prism lifted.', 1.5);
    }
  }
  function slashWorld(s) {
    const p = s.player;
    for (const g of s.growth) {
      if (!g.alive || !overlapCircle(p.x, p.y, 56, g)) continue;
      g.alive = false; g.timer = g.regrow; g.held = false;
      spark(s, g.x + g.w / 2, g.y + g.h / 2, 'growth', 12);
      announce(s, g.regrow > 0 ? 'Bramble cut. It will grow back.' : 'Bramble cut.', 1.6);
    }
    for (const l of s.levers) {
      if (l.pulled || length(l.x - p.x, l.y - p.y) > 60) continue;
      l.pulled = true; s.flags[l.flag] = true; s.flags['lever:' + l.id] = true;
      award(s, rkey(s, 'lever', l.id), 50);
      spark(s, l.x, l.y, 'light', 10);
      announce(s, l.text || 'The lever drops with a clunk.', 4);
    }
  }
  function mortarSlash(s, e) {
    const [ux, uy] = unit(s.player.x - e.x, s.player.y - e.y, -e.facingX, -e.facingY);
    if (ux * e.facingX + uy * e.facingY < .3) {
      e.hp = Math.max(0, e.hp - 1); e.flash = .35;
      spark(s, e.x, e.y, 'slash', 12);
      if (e.hp === 0) defeat(s, e);
      else announce(s, 'Through the soft bark! One more strike.', 1.6);
    } else {
      e.clang = .35;
      spark(s, e.x + e.facingX * e.r, e.y + e.facingY * e.r, 'spark', 8);
      s.rings.push({ x: e.x + e.facingX * e.r, y: e.y + e.facingY * e.r, r: 6, maxR: 34, speed: 140,
        life: 1, hostile: false, kind: 'clang' });
      announce(s, 'Clang! The bark plate faces you. Strike from behind or the side.', 2);
    }
  }

  PW.create = create;
  PW.step = step;
  PW.raySegment = raySegment;
  PW.enterRoom = enterRoom;
  PW.retryRoom = retryRoom;
  PW.continueRegion = continueRegion;
  PW.restartRegion = restartRegion;
  PW.announce = announce;
  PW.FALLBACK_CLOISTER = FALLBACK_CLOISTER;
})(typeof window !== 'undefined' ? window : globalThis);
