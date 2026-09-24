'use strict';
/* Legal-input route check for Glass Kiln C1-C5. It continues from the actual
   Aqueduct beacon and sends every action through PW.step. Hidden state informs
   route choices; this demonstrates reachability, not human discovery or fun. */
const aqueduct = require('./aqueduct-pilot.cjs');
const { steer, solids, guard, threat, dodgeLobs } = aqueduct;

function play(PW, opts = {}) {
  let s, log = [];
  if (opts.fromKiln || opts.fromRoom) { s = PW.create({ room: opts.fromRoom || 'furnace' }); s.status = 'playing'; }
  else {
    s = aqueduct.play(PW);
    log = (s.pilotLog || []).map(line => 'aqueduct: ' + line);
    if (s.status !== 'cleared' || !s.next || s.next.room !== 'furnace') {
      s.kilnLog = log.concat('STOP: Aqueduct did not open the furnace.');
      return s;
    }
    PW.continueRegion(s);
  }
  let frames = 0, retries = 0, roomFrames = 0, lastRoom = '', slashEdge = false;
  const step = input => {
    input.slash = !!input.slash && !slashEdge;
    slashEdge = !!input.slash;
    PW.step(s, input, 1 / 60); frames++;
    if (s.status === 'lost') {
      log.push('LOST ' + s.roomId + ' t=' + s.time.toFixed(1) + ' hp=' + s.player.hp + ' ' + s.message);
      retries++; PW.retryRoom(s); roomFrames = 0;
    }
  };
  const playFrames = 60 * 60 * 16;
  while (s.status === 'playing' && frames < playFrames && retries < 12) {
    if (s.roomId !== lastRoom) {
      lastRoom = s.roomId; roomFrames = 0;
      log.push('enter ' + s.roomId + ' t=' + s.time.toFixed(1) + ' hp=' + s.player.hp + ' objective=' + s.objective);
    }
    roomFrames++;
    const input = { mx: 0, my: 0, ax: s.player.aimX, ay: s.player.aimY, reflect: true };
    const p = s.player, id = s.roomId;
    const aim = (x, y) => { const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1; input.ax = dx / d; input.ay = dy / d; };
    const go = (x, y, opts = {}) => {
      const hazards = (s.glass || []).filter(g => g.mode === 'hazard' && g.active)
        .map(g => ({ x: g.x + g.w / 2, y: g.y + g.h / 2, r: Math.hypot(g.w, g.h) / 2 + 30 }));
      const r = steer(s, x, y, Object.assign({ avoid: hazards }, opts));
      input.mx = r.mx; input.my = r.my;
      return r;
    };
    const exitTo = to => {
      const e = s.exits.find(x => x.to === to);
      if (e) go(e.x + e.w / 2, e.y + e.h / 2, { avoid: [] });
    };
    const duel = e => {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
      aim(e.x, e.y);
      if (dodgeLobs(s, input)) return;
      if (e.exposed > 0) {
        if (d > e.r + 40) go(e.x, e.y, { avoid: [] });
        input.slash = d < e.r + 54;
        return;
      }
      if (e.phase === 'lunge-windup' || e.phase === 'lunge') {
        let sx = -e.aimY, sy = e.aimX;
        if (solids(s).some(w => Math.hypot(p.x + sx * 64 - Math.max(w.x, Math.min(p.x + sx * 64, w.x + w.w)),
          p.y + sy * 64 - Math.max(w.y, Math.min(p.y + sy * 64, w.y + w.h))) < p.r + 3)) { sx = -sx; sy = -sy; }
        input.mx = sx; input.my = sy;
        if (e.phase === 'lunge' && d < 155 && p.dashCooldown <= 0) input.dash = true;
        return;
      }
      if (d > 270) go(e.x, e.y, { avoid: [] });
      else if (d < 130) { input.mx = -dx / d; input.my = -dy / d; }
      if (threat(s)) guard(s, input);
    };

    if (id === 'furnace') {
      const e = s.enemies.find(x => x.id === 'kiln-watch');
      if (e && e.hp > 0 && (e.phase !== 'dormant' || p.x > 790)) duel(e);
      else if (e && e.hp > 0) {
        let tx = 510, ty = 510;
        if (p.x >= 460 && p.x < 560) {
          if (p.y > 330 && s.thermal.hot) ty = 258;
          else if (p.y <= 330) ty = 258;
        } else if (p.x >= 560) { tx = 920; ty = 258; }
        go(tx, ty, { avoid: [] });
        if ((s.glass || []).some(g => g.mode === 'hazard' && g.active &&
          p.x + p.r > g.x && p.x - p.r < g.x + g.w && p.y + p.r > g.y && p.y - p.r < g.y + g.h) && p.dashCooldown <= 0) input.dash = true;
        if (opts.trace && roomFrames % 180 === 0) log.push('trace furnace x=' + p.x.toFixed(1) + ' y=' + p.y.toFixed(1) + ' target=' + tx + ',' + ty + ' hot=' + s.thermal.hot + ' phase=' + e.phase + ' hp=' + e.hp);
      } else exitTo('bridge');
    } else if (id === 'bridge') {
      const eye = s.receivers.find(r => r.id === 'cooling-eye');
      const m = s.mirrors.find(x => x.id === 'cooling-mirror');
      if (eye && !eye.active && m && m.index !== 0) {
        if (Math.hypot(p.x - m.x, p.y - m.y) > 48) go(m.x - 38, m.y + 24);
        else { aim(m.x, m.y); input.slash = true; }
      } else if (eye && !eye.active) {
        go(m.x - 38, m.y + 24);
      } else {
        if (p.x < 280 && s.thermal.hot) go(258, 384, { avoid: [] });
        else {
          go(988, 384, { avoid: [] });
          if (p.x >= 280 && p.x <= 744 && p.dashCooldown <= 0) input.dash = true;
        }
      }
      if (opts.trace && roomFrames % 300 === 0) log.push('trace bridge x=' + p.x.toFixed(1) + ' y=' + p.y.toFixed(1) + ' hot=' + s.thermal.hot + ' eye=' + (eye && eye.active) + ' span=' + ((s.glass.find(g => g.id === 'annealed-span') || {}).active) + ' wet=' + aqueduct.wetAt(s, p.x, p.y));
    } else if (id === 'rail') {
      const e = s.escort;
      if (e && !e.arrived) {
        const t = s.enemies.filter(x => x.type === 'turret' && x.hp > 0)
          .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0];
        if (t) {
          const dx = e.x - t.x, dy = e.y - t.y, d = Math.hypot(dx, dy) || 1;
          const bx = e.x - dx / d * 50, by = e.y - dy / d * 50;
          if (Math.hypot(p.x - bx, p.y - by) > 10) go(bx, by, { avoid: [] });
          aim(t.x, t.y);
          if (threat(s)) guard(s, input);
        } else go(Math.max(90, e.x - 45), e.y, { avoid: [] });
      } else exitTo('foundry');
    } else if (id === 'foundry') {
      const pair = [
        { rx: 'hot-lock', mid: 'hot-lock-mirror', hot: true },
        { rx: 'cold-lock', mid: 'cold-lock-mirror', hot: false }
      ];
      const next = pair.find(q => !s.receivers.find(r => r.id === q.rx).active);
      if (!next) exitTo('weaver');
      else {
        const m = s.mirrors.find(x => x.id === next.mid);
        if (m.index !== 0) {
          if (Math.hypot(p.x - m.x, p.y - m.y) > 48) go(m.x - 33, m.y + (m.y < 384 ? 22 : -22), { avoid: [] });
          else { aim(m.x, m.y); input.slash = true; }
        } else if (s.thermal.hot !== next.hot) {
          go(m.x - 33, m.y + (m.y < 384 ? 22 : -22), { avoid: [] });
        } else go(m.x - 33, m.y + (m.y < 384 ? 22 : -22), { avoid: [] });
      }
    } else if (id === 'weaver') {
      const e = s.enemies.find(x => x.id === 'glass-weaver');
      if (e && e.hp > 0) duel(e);
      else if (s.beacon) go(s.beacon.x, s.beacon.y, { avoid: [] });
    } else if (id === 'quench') {
      const lever = s.levers.find(x => x.id === 'quench-valve');
      const pickup = s.pickups.find(x => x.id === 'kiln-edge');
      if (lever && !lever.pulled && Math.hypot(p.x - lever.x, p.y - lever.y) > 58) go(lever.x, lever.y, { avoid: [] });
      else if (lever && !lever.pulled) { aim(lever.x, lever.y); input.slash = true; }
      else if (pickup && !pickup.taken) go(pickup.x, pickup.y, { avoid: [] });
      else exitTo('bridge');
    }
    if (opts.trace && id === 'foundry' && roomFrames % 300 === 0) {
      log.push('trace foundry x=' + p.x.toFixed(1) + ' y=' + p.y.toFixed(1) + ' hot=' + s.thermal.hot +
        ' mirrors=' + s.mirrors.map(m => m.id + ':' + m.index).join(',') + ' receivers=' + s.receivers.map(r => r.id + ':' + r.active + ':' + r.charge.toFixed(2)).join(','));
    }
    step(input);
    if (roomFrames > 60 * 180) { log.push('TIMEOUT ' + s.roomId + ' objective=' + s.objective); break; }
  }
  log.push('END status=' + s.status + ' t=' + s.time.toFixed(1) + ' hp=' + s.player.hp + '/' + s.player.maxHp +
    ' retries=' + retries + ' cleared=' + JSON.stringify(s.cleared) + ' flags=' + Object.keys(s.flags).join(','));
  s.kilnLog = log;
  return s;
}

module.exports = { play };
if (require.main === module) {
  const args = process.argv.slice(2);
  const from = args.find(arg => arg.startsWith('--from-'));
  const s = play(aqueduct.loadPW(), { fromKiln: from === '--from-kiln', fromRoom: from && from !== '--from-kiln' ? from.slice('--from-'.length) : null, trace: args.includes('--trace') });
  console.log((s.kilnLog || []).join('\n'));
}
