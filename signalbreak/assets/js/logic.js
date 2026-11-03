(function (global) {
  'use strict';
  var SB = global.SB = global.SB || {};
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function newGame(id) {
    var missions = SB.Missions.operations || [SB.Missions.opening];
    var source = id === undefined ? SB.Missions.opening : missions.find(function (m) { return m.id === id; });
    if (!source) throw new Error('Unknown operation: ' + id);
    var m = clone(source);
    m.width = m.rows[0].length; m.height = m.rows.length;
    m.squad.forEach(function (u) { u.ap = 2; u.watch = false; u.extracted = false; });
    if (m.circuits) m.circuits.forEach(function (c) { c.controlled = !!c.controlled; c.scored = c.controlled; });
    m.turn = 1; m.network = m.circuits ? networkReady(m) : false; m.rescued = false; m.phase = 'player';
    m.score = 0; m.kills = 0; m.serial = 0; m.event = 'ready'; m.last = m.radio;
    m.log = ['Operation ' + String(m.sequence || 1).padStart(2, '0') + ' / ' + m.title + '. ' + (m.objectiveSummary || 'Take the circuit, rescue the worker, extract the squad.')];
    return m;
  }
  function tile(s, x, y) { return s.rows[y] && s.rows[y][x] || '#'; }
  function height(s, x, y) { var h = s.heights.find(function (p) { return p.x === x && p.y === y; }); return h ? h.z : 0; }
  function living(u) { return u.hp > 0 && !u.extracted; }
  function unit(s, id) { return s.squad.find(function (u) { return u.id === id; }); }
  function occupant(s, x, y) { return s.squad.concat(s.enemies).find(function (u) { return living(u) && u.x === x && u.y === y; }); }
  function circuitAt(s, x, y) {
    if (s.circuits) return s.circuits.find(function (c) { return c.x === x && c.y === y; }) || null;
    return x === s.node.x && y === s.node.y ? { id: 'main', label: 'Take the circuit', x: x, y: y, controlled: s.network } : null;
  }
  function doorOpen(s, x, y) {
    if (!s.circuits) return !!s.network;
    return s.circuits.some(function (c) { return c.controlled && (c.doors || []).some(function (d) { return d.x === x && d.y === y; }); });
  }
  function isolatesSquad(s, circuit) {
    if (!circuit.exclusiveGroup || !s.circuits.some(function (c) { return c.controlled && c.id !== circuit.id && c.exclusiveGroup === circuit.exclusiveGroup; })) return false;
    // Route previews must not strand the last active engineer behind a door whose
    // controller is on the other side. Ignore unit occupancy: allies can move.
    var routed = Object.assign({}, s, { circuits: s.circuits.map(function (c) {
      return Object.assign({}, c, { controlled: c.id === circuit.id || c.exclusiveGroup !== circuit.exclusiveGroup && c.controlled });
    }) });
    var queue = [{ x: circuit.x, y: circuit.y }], seen = {}, head = 0;
    seen[circuit.x + ',' + circuit.y] = true;
    while (head < queue.length) {
      var p = queue[head++];
      [[1,0],[0,1],[-1,0],[0,-1]].forEach(function (d) {
        var x = p.x + d[0], y = p.y + d[1], key = x + ',' + y;
        if (seen[key] || blocked(routed, x, y)) return;
        seen[key] = true; queue.push({ x: x, y: y });
      });
    }
    return s.squad.some(function (u) {
      if (!living(u) || seen[u.x + ',' + u.y]) return false;
      // A unit on the closing door can step back into the controller's region.
      return ![[1,0],[0,1],[-1,0],[0,-1]].some(function (d) { return tile(routed, u.x, u.y) === 'd' && seen[(u.x + d[0]) + ',' + (u.y + d[1])]; });
    });
  }
  function networkReady(s) {
    if (!s.circuits) return !!s.network;
    var required = s.objectives && s.objectives.requiredCircuits || s.circuits.map(function (c) { return c.id; });
    return required.every(function (id) { return s.circuits.some(function (c) { return c.id === id && c.controlled; }); });
  }
  function turretAllied(s) {
    return s.circuits ? s.circuits.some(function (c) { return c.turret && c.controlled; }) : !!s.network;
  }
  function objectiveStatus(s) {
    var required = s.circuits ? s.objectives && s.objectives.requiredCircuits || s.circuits.map(function (c) { return c.id; }) : ['main'];
    var status = required.map(function (id) {
      var c = s.circuits && s.circuits.find(function (entry) { return entry.id === id; });
      return { id: id, label: c ? c.label : 'Take the circuit', done: c ? !!c.controlled : !!s.network };
    });
    status.push({ id: 'rescue', label: s.objectives && s.objectives.rescueLabel || 'Rescue signal worker', done: !!s.rescued });
    status.push({ id: 'extract', label: 'Extract surviving engineers', done: s.phase === 'won' });
    return status;
  }
  function blocked(s, x, y) {
    var t = tile(s, x, y);
    return t === '#' || t === 'd' && !doorOpen(s, x, y) || !!s.turret && x === s.turret.x && y === s.turret.y;
  }
  function distance(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function path(s, actor, x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || blocked(s, x, y)) return null;
    var q = [{ x: actor.x, y: actor.y }], parents = {}, head = 0, key = function (a,b) { return a + ',' + b; };
    parents[key(actor.x, actor.y)] = null;
    while (head < q.length) {
      var p = q[head++];
      if (p.x === x && p.y === y) {
        var out = [], at = p;
        while (at) { out.unshift({ x: at.x, y: at.y }); at = parents[key(at.x, at.y)]; }
        return out;
      }
      [[1,0],[0,1],[-1,0],[0,-1]].forEach(function (d) {
        var nx = p.x + d[0], ny = p.y + d[1], k = key(nx, ny);
        if (Object.prototype.hasOwnProperty.call(parents, k) || blocked(s, nx, ny) || occupant(s, nx, ny)) return;
        parents[k] = p; q.push({ x: nx, y: ny });
      });
    }
    return null;
  }
  function visible(s, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, steps = Math.max(Math.abs(dx), Math.abs(dy)) * 4;
    for (var i = 1; i < steps; i++) {
      var x = Math.round(a.x + dx * i / steps), y = Math.round(a.y + dy * i / steps);
      if (x === a.x && y === a.y || x === b.x && y === b.y) continue;
      if (tile(s, x, y) === '#' || tile(s, x, y) === 'd' && !doorOpen(s, x, y)) return false;
    }
    return true;
  }
  function cover(s, target, from) {
    if (tile(s, target.x, target.y) === 'c') return 1;
    var dx = Math.sign(from.x - target.x), dy = Math.sign(from.y - target.y);
    if (Math.abs(from.x - target.x) >= Math.abs(from.y - target.y)) return /[#c]/.test(tile(s, target.x + dx, target.y)) ? 1 : 0;
    return /[#c]/.test(tile(s, target.x, target.y + dy)) ? 1 : 0;
  }
  function damage(s, from, target) { return Math.max(1, from.damage - cover(s, target, from) + (height(s, from.x, from.y) > height(s, target.x, target.y) ? 1 : 0)); }
  function canShoot(s, a, b) { return living(b) && distance(a, b) <= a.range && visible(s, a, b); }
  function preview(s, id, kind, x, y) {
    var a = unit(s, id), p = { legal: false, actorId: id, kind: kind, x: x, y: y, cost: 1, reason: '' };
    function fail(reason) { p.reason = reason; return p; }
    if (s.phase !== 'player') return fail('Operation is not accepting orders.');
    if (!a || !living(a)) return fail('Select an available engineer.');
    if (a.ap < 1) return fail('No AP. Select another engineer or end the turn.');
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= s.width || y >= s.height) return fail('Select a tile on the map.');
    if (kind === 'move') {
      if (occupant(s, x, y)) return fail('Tile occupied.');
      p.path = path(s, a, x, y);
      if (!p.path) return fail('Route blocked. Hack the circuit to open the security door.');
      p.cost = Math.ceil((p.path.length - 1) / a.stride);
      if (!p.cost || p.cost > a.ap) return fail('Beyond remaining movement AP.');
      p.reason = p.cost + ' AP · ' + (p.path.length - 1) + ' tiles · confirm move';
    } else if (kind === 'attack') {
      var target = s.enemies.find(function (e) { return living(e) && e.x === x && e.y === y; });
      if (!target) return fail('Select a hostile patrol.');
      if (!canShoot(s, a, target)) return fail('Target out of range or behind blocking cover.');
      p.targetId = target.id; p.damage = damage(s, a, target); p.cover = cover(s, target, a);
      p.reason = '1 AP · ' + p.damage + ' damage' + (p.cover ? ' · target in cover' : '') + ' · confirm shot';
    } else if (kind === 'hack') {
      var circuit = circuitAt(s, x, y);
      if (!circuit) return fail('Select an amber circuit node.');
      if (distance(a, circuit) > (a.role === 'ENGINEER' ? 2 : 1) || !visible(s, a, circuit)) return fail('Get adjacent with a clear signal; Nia can hack from two tiles.');
      if (circuit.controlled) return fail('Circuit already under our control.');
      var missing = (circuit.requires || []).filter(function (id) { return !s.circuits.some(function (c) { return c.id === id && c.controlled; }); });
      if (missing.length) return fail('Clinic supply interlock: complete ' + missing.map(function (id) { var c = s.circuits.find(function (entry) { return entry.id === id; }); return c ? c.label : id; }).join(' and ') + ' first.');
      if (s.circuits && isolatesSquad(s, circuit)) return fail('Reroute would strand an engineer. Bring every active engineer back to the controller side of the closing door first.');
      p.circuitId = circuit.id;
      var losesTurret = s.circuits && !circuit.turret && s.circuits.some(function (c) { return c.controlled && c.turret && c.exclusiveGroup && c.exclusiveGroup === circuit.exclusiveGroup; });
      p.reason = s.circuits ? '1 AP · ' + circuit.label + (circuit.exclusiveGroup ? ' · reroutes power away from the other route' : '') + (circuit.turret ? ' · turret becomes allied' : losesTurret ? ' · turret becomes HOSTILE' : '') : '1 AP · open door + take turret + restore lights';
    } else if (kind === 'rescue') {
      if (x !== s.rescue.x || y !== s.rescue.y || s.rescued) return fail('No worker to rescue here.');
      if (distance(a, s.rescue) > 1) return fail('Get adjacent to the worker.');
      p.reason = '1 AP · ' + (s.objectives && s.objectives.rescueLabel || 'release signal worker') + ' · +400 points';
    } else if (kind === 'heal') {
      var ally = s.squad.find(function (u) { return living(u) && u.x === x && u.y === y; });
      if (a.role !== 'MEDIC') return fail('Only Sol can apply field aid.');
      if (a.kits === 0) return fail('No field aid kits left this operation.');
      if (!ally || distance(a, ally) > 1 || ally.hp >= ally.maxHp) return fail('Select an injured adjacent engineer, including Sol.');
      p.targetId = ally.id; p.reason = '1 AP · heal 4 HP · uses one of two field kits';
    } else if (kind === 'watch') {
      if (a.watch) return fail('Overwatch already set.');
      p.reason = '1 AP · one reaction shot during the enemy turn';
    } else if (kind === 'extract') {
      if (tile(s, a.x, a.y) !== 'e') return fail(s.extractionLabel ? 'Stand on a tile in the ' + s.extractionLabel + '.' : 'Stand on an eastern extraction tile.');
      if (!networkReady(s) || !s.rescued) return fail('Complete the circuit objectives and rescue before extracting.');
      p.reason = '1 AP · extract ' + a.name;
    } else return fail('Unknown order.');
    p.legal = true; return p;
  }
  function log(s, text, event) {
    s.last = text; s.log.push(text); if (s.log.length > 8) s.log.shift();
    s.event = event || 'move'; s.serial++;
  }
  function strike(s, from, target, label) {
    var amount = damage(s, from, target); target.hp = Math.max(0, target.hp - amount);
    log(s, label + ' · ' + amount + ' damage' + (!target.hp ? ' · down' : ''), 'attack');
    if (!target.hp && s.enemies.indexOf(target) !== -1) { s.kills++; s.score += 150; }
  }
  function outcome(s) {
    if (s.phase === 'won' || s.phase === 'lost') return;
    if (!s.squad.some(function (u) { return u.hp > 0; })) { s.phase = 'lost'; log(s, 'Signal lost. The squad is down.', 'lost'); }
    else if (s.squad.every(function (u) { return u.hp <= 0 || u.extracted; })) {
      s.phase = 'won'; s.score += s.squad.filter(function (u) { return u.extracted; }).length * 250 + Math.max(0, 20 - s.turn) * 30;
      log(s, s.title + ' complete. The rescued crew is safe. Full campaign in development.', 'won');
    }
  }
  function commit(s, proposed) {
    if (!proposed || !proposed.legal) return false;
    var p = preview(s, proposed.actorId, proposed.kind, proposed.x, proposed.y);
    if (!p.legal) return false;
    var a = unit(s, p.actorId); a.ap -= p.cost;
    if (p.kind === 'move') { a.x = p.x; a.y = p.y; log(s, a.name + ' moved · ' + p.cost + ' AP'); }
    if (p.kind === 'attack') strike(s, a, s.enemies.find(function (e) { return e.id === p.targetId; }), a.name + ' fired');
    if (p.kind === 'hack') {
      if (s.circuits) {
        var circuit = circuitAt(s, p.x, p.y);
        if (circuit.exclusiveGroup) s.circuits.forEach(function (c) { if (c.exclusiveGroup === circuit.exclusiveGroup) c.controlled = false; });
        circuit.controlled = true;
        if (!circuit.scored) { s.score += 500; circuit.scored = true; }
        s.network = networkReady(s);
        log(s, circuit.label + ' · circuit routed' + (circuit.exclusiveGroup ? ' · alternate route closed' : ''), 'hack');
      } else { s.network = true; s.score += 500; log(s, 'CIRCUIT OURS · door open · turret allied · lights restored', 'hack'); }
    }
    if (p.kind === 'rescue') { s.rescued = true; s.score += 400; log(s, (s.objectives && s.objectives.rescueLabel || 'Worker freed') + ' · escort signal clear; extract the squad.', 'rescue'); }
    if (p.kind === 'heal') { var ally = unit(s, p.targetId); ally.hp = Math.min(ally.maxHp, ally.hp + 4); a.kits = (a.kits === undefined ? 2 : a.kits) - 1; log(s, 'Sol treated ' + ally.name + ' · +4 HP', 'heal'); }
    if (p.kind === 'watch') { a.watch = true; log(s, a.name + ' covering the approach', 'watch'); }
    if (p.kind === 'extract') { a.extracted = true; log(s, a.name + ' extracted', 'rescue'); }
    outcome(s); return true;
  }
  function endTurn(s) {
    if (s.phase !== 'player') return false;
    s.phase = 'enemy';
    if (s.turret) {
      var allied = turretAllied(s), targets = allied ? s.enemies : s.squad;
      var turretTarget = targets.filter(function (u) { return living(u) && canShoot(s, s.turret, u); })
        .sort(function (a,b) { return distance(s.turret, a) - distance(s.turret, b); })[0];
      if (turretTarget) strike(s, s.turret, turretTarget, allied ? 'Allied turret' : 'Hostile turret');
    }
    s.enemies.forEach(function (e) {
      if (!living(e)) return;
      var squad = s.squad.filter(living).sort(function (a,b) { return distance(e,a) - distance(e,b); }), target = squad[0];
      if (!target) return;
      if (!canShoot(s, e, target)) {
        var best = null;
        for (var y = 1; y < s.height - 1; y++) for (var x = 1; x < s.width - 1; x++) {
          if (occupant(s, x, y) || blocked(s, x, y)) continue;
          var dist = Math.abs(e.x - x) + Math.abs(e.y - y);
          if (dist > e.stride || distance({ x:x,y:y }, target) >= distance(e, target)) continue;
          var route = path(s, e, x, y);
          if (route && route.length - 1 <= e.stride && (!best || distance({x:x,y:y},target) < best.distance)) best = { route: route, distance: distance({x:x,y:y},target) };
        }
        if (best) for (var i = 1; i < best.route.length && living(e); i++) {
          e.x = best.route[i].x; e.y = best.route[i].y;
          s.squad.forEach(function (u) { if (living(e) && living(u) && u.watch && canShoot(s, u, e)) { u.watch = false; strike(s, u, e, u.name + ' overwatch'); } });
        }
      }
      // Re-evaluate after movement and reactions; dead/extracted targets never take fire.
      var available = s.squad.filter(function (u) { return canShoot(s, e, u); }).sort(function (a,b) { return distance(e,a) - distance(e,b); });
      if (living(e) && available.length) strike(s, e, available[0], e.name);
    });
    outcome(s);
    if (s.phase === 'lost' || s.phase === 'won') return true;
    s.turn++; s.phase = 'player'; s.squad.forEach(function (u) { if (living(u)) u.ap = 2; u.watch = false; });
    log(s, 'Turn ' + s.turn + ' · engineer AP refreshed', 'turn'); return true;
  }
  SB.Logic = { newGame: newGame, tile: tile, height: height, unit: unit, living: living, occupant: occupant,
    blocked: blocked, path: path, visible: visible, cover: cover, damage: damage, preview: preview, commit: commit, endTurn: endTurn,
    circuitAt: circuitAt, doorOpen: doorOpen, objectiveStatus: objectiveStatus, turretAllied: turretAllied };
})(window);
