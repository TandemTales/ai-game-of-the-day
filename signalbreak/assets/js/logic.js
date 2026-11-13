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
  function liftAt(s, x, y) {
    if (!s.lift) return false;
    var stop = s.lift.stops[s.lift.position], size = s.lift.size;
    return x >= stop.x && x < stop.x + size && y >= stop.y && y < stop.y + size;
  }
  function liftControlAt(s, x, y) {
    return !!s.lift && (liftAt(s, x, y) || s.lift.stops.some(function (stop) {
      return stop.console.x === x && stop.console.y === y;
    }));
  }
  function liftStatus(s) {
    if (!s.lift) return null;
    var lift = s.lift, stop = lift.stops[lift.position], next = (lift.position + 1) % lift.stops.length;
    return { position: lift.position, x: stop.x, y: stop.y, z: stop.z, size: lift.size,
      label: stop.label, destination: next, nextLabel: lift.stops[next].label,
      powered: !!s.circuits && s.circuits.some(function (c) { return c.id === lift.poweredBy && c.controlled; }),
      delivered: !!lift.delivered, passengers: s.squad.filter(function (u) { return living(u) && liftAt(s, u.x, u.y); }).length };
  }
  function waterRouteAt(s, x, y) {
    if (!s.water) return null;
    return s.water.routes.find(function (route) {
      return route.tiles.some(function (p) { return p.x === x && p.y === y; });
    }) || null;
  }
  function waterStatus(s) {
    return !s.water ? [] : s.water.routes.map(function (route) {
      var drained = (s.circuits || []).some(function (c) { return c.id === route.circuitId && c.controlled; });
      return { circuitId: route.circuitId, label: route.label, drained: drained, tiles: clone(route.tiles) };
    });
  }
  function tile(s, x, y) {
    if (liftAt(s, x, y)) return '.';
    var route = waterRouteAt(s, x, y);
    if (route) return (s.circuits || []).some(function (c) { return c.id === route.circuitId && c.controlled; }) ? '.' : 'w';
    return s.rows[y] && s.rows[y][x] || '#';
  }
  function height(s, x, y) {
    if (liftAt(s, x, y)) return s.lift.stops[s.lift.position].z;
    var h = s.heights.find(function (p) { return p.x === x && p.y === y; }); return h ? h.z : 0;
  }
  function climbLinked(s, a, b) {
    return (s.climbLinks || []).some(function (link) {
      return link.from.x === a.x && link.from.y === a.y && link.to.x === b.x && link.to.y === b.y ||
        link.to.x === a.x && link.to.y === a.y && link.from.x === b.x && link.from.y === b.y;
    });
  }
  function canStep(s, a, b) {
    if (distance(a, b) !== 1 || blocked(s, b.x, b.y)) return false;
    // Legacy operations retain their original traversable raised cover. New
    // districts opt into real cliff edges and explicitly authored stair links.
    return s.maxStepHeight === undefined || Math.abs(height(s, a.x, a.y) - height(s, b.x, b.y)) <= s.maxStepHeight || climbLinked(s, a, b);
  }
  function canReachAdjacent(s, a, b) {
    return distance(a, b) <= 1 && (s.maxStepHeight === undefined || height(s, a.x, a.y) === height(s, b.x, b.y) || climbLinked(s, a, b));
  }
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
    var changesWater = s.water && s.water.routes.some(function (route) { return route.circuitId === circuit.id; });
    if (!changesWater && (!circuit.exclusiveGroup || !s.circuits.some(function (c) { return c.controlled && c.id !== circuit.id && c.exclusiveGroup === circuit.exclusiveGroup; }))) return false;
    // Route previews must not strand the last active engineer behind a door whose
    // controller is on the other side. Ignore unit occupancy: allies can move.
    var routed = Object.assign({}, s, { circuits: s.circuits.map(function (c) {
      return Object.assign({}, c, { controlled: c.id === circuit.id || (!circuit.exclusiveGroup || c.exclusiveGroup !== circuit.exclusiveGroup) && c.controlled });
    }) });
    // Flooding an occupied bed is never an attack or a way to erase a patrol.
    // Validate before spending AP, including confirmations made before movement.
    if (changesWater && s.squad.concat(s.enemies).some(function (u) {
      return living(u) && tile(routed, u.x, u.y) === 'w';
    })) return true;
    var queue = [{ x: circuit.x, y: circuit.y }], seen = {}, head = 0;
    seen[circuit.x + ',' + circuit.y] = true;
    while (head < queue.length) {
      var p = queue[head++];
      [[1,0],[0,1],[-1,0],[0,-1]].forEach(function (d) {
        var x = p.x + d[0], y = p.y + d[1], key = x + ',' + y;
        if (seen[key] || !canStep(routed, p, { x: x, y: y })) return;
        seen[key] = true; queue.push({ x: x, y: y });
      });
    }
    return s.squad.some(function (u) {
      if (!living(u) || seen[u.x + ',' + u.y]) return false;
      // A unit on the closing door can step back into the controller's region.
      return ![[1,0],[0,1],[-1,0],[0,-1]].some(function (d) { return tile(routed, u.x, u.y) === 'd' && seen[(u.x + d[0]) + ',' + (u.y + d[1])] && canStep(routed, u, { x: u.x + d[0], y: u.y + d[1] }); });
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
  function extractionStatus(s) {
    if (!s.freight) {
      var tiles = [];
      s.rows.forEach(function (row, y) { for (var x = 0; x < row.length; x++) if (row[x] === 'e') tiles.push({ x: x, y: y }); });
      return { open: true, label: s.extractionLabel || 'Extraction zone', tiles: tiles, turnsUntilChange: null, nextLabel: null };
    }
    // Every stop has a dwell followed by transit. Missing a train never closes
    // the mission permanently: the same fully telegraphed schedule repeats.
    var f = s.freight, span = f.dwell + f.transit;
    var elapsed = (s.turn - 1) % (span * f.stops.length);
    var index = Math.floor(elapsed / span), offset = elapsed % span;
    var open = offset < f.dwell, next = f.stops[(index + 1) % f.stops.length];
    return { open: open, label: open ? f.stops[index].label : 'Train in transit',
      tiles: open ? f.stops[index].tiles.map(function (p) { return { x: p.x, y: p.y }; }) : [],
      turnsUntilChange: open ? f.dwell - offset : span - offset, nextLabel: next.label };
  }
  function freightMessage(s) {
    var f = extractionStatus(s);
    return f.open ? f.label + ' boarding OPEN · ' + f.turnsUntilChange + ' player turn(s) remaining' :
      'Train in transit · ' + f.nextLabel + ' opens in ' + f.turnsUntilChange + ' turn(s)';
  }
  function broadcastStatus(s) {
    if (!s.broadcast) return null;
    var broadcast = s.broadcast;
    return {
      active: s.circuits.some(function (c) { return c.id === broadcast.circuitId && c.controlled; }),
      destination: { x: broadcast.destination.x, y: broadcast.destination.y },
      destinationLabel: broadcast.destinationLabel,
      patrols: s.enemies.filter(function (e) {
        return living(e) && broadcast.patrolIds.indexOf(e.id) !== -1;
      }).map(function (e) { return { id: e.id, x: e.x, y: e.y }; })
    };
  }
  function deployAmbush(s) {
    if (!s.ambush || s.turn < s.ambush.turn) return;
    var deployed = s.ambush.deployed = s.ambush.deployed || {};
    s.ambush.enemies.forEach(function (entry) {
      if (deployed[entry.id]) return;
      if (s.enemies.some(function (e) { return e.id === entry.id; })) { deployed[entry.id] = true; return; }
      // A squad member holding an entry tile delays that patrol instead of
      // receiving an overlapping enemy or an unannounced adjacent spawn.
      if (blocked(s, entry.x, entry.y) || occupant(s, entry.x, entry.y)) return;
      s.enemies.push(clone(entry)); deployed[entry.id] = true;
      log(s, entry.name + ' entered at (' + entry.x + ', ' + entry.y + ') · acts next enemy turn', 'turn');
    });
  }
  function defenseStatus(s) {
    if (!s.defense) return null;
    var d = s.defense, done = d.elapsed >= d.rounds;
    var lane = done ? null : d.schedule[d.elapsed % d.schedule.length];
    var circuitId = lane === null ? null : d.covers[lane];
    return { done: done, lane: lane, circuitId: circuitId,
      protected: !done && (s.circuits || []).some(function (c) { return c.id === circuitId && c.controlled; }),
      hp: d.hp, elapsed: d.elapsed, rounds: d.rounds };
  }
  function pumpStatus(s) {
    if (!s.pumps) return null;
    var pumps = s.pumps.circuitIds.map(function (id) {
      var circuit = (s.circuits || []).find(function (c) { return c.id === id; });
      return { id: id, label: circuit ? circuit.label : id,
        x: circuit ? circuit.x : null, y: circuit ? circuit.y : null,
        controlled: !!circuit && !!circuit.controlled,
        staffed: !!circuit && s.squad.some(function (u) { return living(u) && distance(u, circuit) <= 1; }) };
    });
    return { done: s.pumps.elapsed >= s.pumps.rounds, elapsed: s.pumps.elapsed,
      rounds: s.pumps.rounds, ready: pumps.length > 0 && pumps.every(function (p) { return p.controlled && p.staffed; }), pumps: pumps };
  }
  function resolvePumps(s) {
    var status = pumpStatus(s);
    if (!status || status.done || s.phase === 'lost' || s.phase === 'won') return;
    var previous = s.pumps.elapsed;
    s.pumps.elapsed = status.ready ? previous + 1 : 0;
    if (s.pumps.elapsed >= s.pumps.rounds) {
      s.score += 500;
      log(s, 'Twin pump pressure stabilized / ' + s.pumps.rounds + ' consecutive cycles / +500 points. Engineers may leave the controls.', 'hack');
    } else if (status.ready) {
      log(s, 'Twin pump pressure / ' + s.pumps.elapsed + '/' + s.pumps.rounds + ' consecutive cycles. Keep both powered controls staffed through the next enemy turn.', 'turn');
    } else if (previous > 0) {
      log(s, 'Twin pump pressure reset to 0/' + s.pumps.rounds + ': both powered controls need a living engineer on or next to them after enemy fire.', 'turn');
    }
  }
  function keyPairStatus(s) {
    if (!s.keyPair) return null;
    var pair = s.keyPair;
    return { opened: pair.opened, armedId: pair.armed ? pair.armed.id : null,
      keys: pair.circuitIds.map(function (id) {
        var key = s.circuits.find(function (c) { return c.id === id; });
        return { id: id, label: key.label, x: key.x, y: key.y };
      }) };
  }
  function confirmKey(s, circuit, actor) {
    var pair = s.keyPair;
    if (!pair.armed) {
      pair.armed = { id: circuit.id, actorId: actor.id, turn: s.turn };
      log(s, circuit.label + ' armed · confirm the other key with a different engineer before End Turn.', 'hack');
      return;
    }
    s.circuits.forEach(function (key) {
      if (pair.circuitIds.indexOf(key.id) === -1) return;
      key.controlled = true; key.scored = true;
    });
    pair.opened = true; pair.armed = null;
    s.score += 500; s.network = networkReady(s);
    log(s, 'Keys synchronized · gate open' + (s.turret && turretAllied(s) ? ' · turret allied' : '') + ' · +500 points', 'hack');
  }
  function archiveStatus(s) {
    if (!s.archive) return null;
    var evidence = s.circuits.find(function (c) { return c.id === s.archive.evidenceCircuit; });
    var breaker = s.circuits.find(function (c) { return c.id === s.archive.delayCircuit; });
    var secured = evidence.controlled, delayed = breaker.controlled, purged = !!s.archive.purged;
    var deadline = s.archive.deadline + (delayed ? s.archive.extension : 0);
    return {
      secured: secured, delayed: delayed, deadline: deadline, purged: purged,
      remaining: secured || purged ? 0 : Math.max(0, deadline - s.turn + 1),
      evidence: { x: evidence.x, y: evidence.y }, breaker: { x: breaker.x, y: breaker.y }
    };
  }
  function resolvePurge(s) {
    var archive = archiveStatus(s);
    if (!archive || archive.secured || s.turn < archive.deadline) return;
    s.archive.purged = true;
    s.phase = 'lost';
    log(s, 'Archive purged. The evidence was erased. Retry and copy it before the deadline.', 'lost');
  }
  function activeLane(s) {
    if (!s.lanes || !s.lanes.patterns.length || (s.circuits || []).some(function (c) { return c.id === s.lanes.disabledBy && c.controlled; })) return null;
    var patterns = s.lanes.patterns, index = (s.turn - 1) % patterns.length;
    return { label: patterns[index].label, tiles: clone(patterns[index].tiles), index: index,
      damage: s.lanes.damage, nextLabel: patterns[(index + 1) % patterns.length].label };
  }
  function resolveDefense(s) {
    var status = defenseStatus(s);
    if (!status || status.done) return;
    var d = s.defense;
    d.elapsed++;
    if (!status.protected) d.hp = Math.max(0, d.hp - 2);
    log(s, d.label + ' / ' + status.lane + ' assault ' + d.elapsed + '/' + d.rounds +
      (status.protected ? ' blocked by powered coverage' : ' breached coverage / -2 staff HP') + ' / ' + d.hp + '/' + d.maxHp + ' HP', 'turn');
    if (d.hp <= 0) { s.phase = 'lost'; log(s, d.label + ' lost. Restore the announced coverage before each end turn.', 'lost'); }
    else if (d.elapsed >= d.rounds) log(s, d.label + ' survived the assault. Rescue and extraction may proceed.', 'rescue');
  }
  function resolveLane(s) {
    var lane = activeLane(s);
    if (!lane) return;
    s.squad.forEach(function (u) {
      if (!living(u) || !lane.tiles.some(function (t) { return t.x === u.x && t.y === u.y; })) return;
      u.hp = Math.max(0, u.hp - lane.damage);
      log(s, lane.label + ' hit ' + u.name + ' / ' + lane.damage + ' damage' + (!u.hp ? ' / down' : ''), 'attack');
    });
  }
  function objectiveStatus(s) {
    var required = s.circuits ? s.objectives && s.objectives.requiredCircuits || s.circuits.map(function (c) { return c.id; }) : ['main'];
    var status = required.map(function (id) {
      var c = s.circuits && s.circuits.find(function (entry) { return entry.id === id; });
      return { id: id, label: c ? c.label : 'Take the circuit', done: c ? !!c.controlled : !!s.network };
    });
    var archive = archiveStatus(s);
    if (archive) {
      var purgeLabel = archive.secured ? 'Evidence secured / purge stopped' :
        archive.purged ? 'Purge complete / evidence erased' :
        'Purge at end of turn ' + archive.deadline + ' / ' +
          (archive.remaining === 1 ? 'FINAL TURN to copy evidence' : archive.remaining + ' turns left to copy evidence');
      status.unshift({ id: 'archive-purge', label: purgeLabel, done: archive.secured });
    }
    var pair = keyPairStatus(s);
    if (pair) {
      var pendingKey = pair.armedId && pair.keys.find(function (key) { return key.id !== pair.armedId; });
      var pairLabel = pair.opened ? 'Both keys synchronized / gate open' :
        s.keyPair.failed ? 'Paired access requires two surviving engineers / retry operation' :
        pendingKey ? 'One key armed / HACK ' + pendingKey.label + ' with another engineer before End Turn' :
        'Gate locked / HACK both keys with different engineers in the same turn';
      status.unshift({ id: 'key-pair', label: pairLabel, done: pair.opened });
    }
    var broadcast = broadcastStatus(s);
    if (broadcast) {
      status.unshift({ id: 'broadcast', label: broadcast.active ?
        'Decoy active / north hatch open / ' + (broadcast.patrols.length ?
          broadcast.patrols.length + ' marked patrols routed to ' + broadcast.destinationLabel : 'no marked patrols remain') :
        'Optional: HACK the transmitter to open the north hatch and divert marked patrols to ' + broadcast.destinationLabel,
        done: broadcast.active });
    }
    status.push({ id: 'rescue', label: s.objectives && s.objectives.rescueLabel || 'Rescue signal worker', done: !!s.rescued });
    if (s.lift) {
      var lift = liftStatus(s);
      var bridge = s.lift.kind === 'bridge';
      status.push({ id: 'cargo', label: bridge ? (lift.delivered ? 'River span crossed with engineers aboard' : 'Capture the moving span and cross to the east bridgehead') : lift.delivered ? 'Medical cargo delivered to clinic terrace' : 'Escort the rescued operator and medical cargo to clinic terrace', done: lift.delivered });
      status.push({ id: 'lift', label: (bridge ? 'Moving span: ' : 'Lift: ') + lift.label + ' / ' + (lift.powered ? 'powered' : bridge ? 'restore bridge motor power' : 'restore hoist power') +
        ' / ' + lift.passengers + ' aboard. Board the 2x2 platform; HACK its deck or a dock console to send it to ' + lift.nextLabel + '.', done: lift.powered });
    }
    if (s.defense) {
      var defense = defenseStatus(s);
      status.push({ id: 'defense', label: s.defense.label + ': ' + defense.hp + '/' + s.defense.maxHp + ' HP / ' + defense.elapsed + '/' + defense.rounds + ' assaults survived' +
        (defense.done ? ' / defense complete' : ' / NEXT END TURN: ' + defense.lane + ' / ' + (defense.protected ? 'COVERED' : 'UNPROTECTED (-2 HP)')), done: defense.done && defense.hp > 0 });
    }
    if (s.pumps) {
      var pumps = pumpStatus(s);
      status.push({ id: 'pumps', label: 'Twin pump pressure: ' + pumps.elapsed + '/' + pumps.rounds + ' consecutive cycles' +
        (pumps.done ? ' / STABLE: engineers may leave controls' : ' / NEXT END TURN after enemy fire: ' + (pumps.ready ? 'READY' : 'NOT READY') +
          '. Keep a living engineer on or within 1 tile of EACH powered pump; interrupted coverage resets progress to zero. ' +
          pumps.pumps.map(function (p) { return p.label + ': ' + (p.controlled ? 'powered' : 'unpowered') + ', ' + (p.staffed ? 'staffed' : 'UNSTAFFED'); }).join(' / ')), done: pumps.done });
    }
    if (s.lanes) {
      var lane = activeLane(s);
      status.push({ id: 'lanes', label: lane ? 'NEXT END TURN: ' + lane.label + ' / ' + lane.damage + ' damage on marked tiles / then ' + lane.nextLabel : 'Tower overwatch lanes disabled', done: !lane });
    }
    waterStatus(s).forEach(function (route) {
      status.push({ id: route.circuitId + '-water', label: route.label + ': ' + (route.drained ? 'DRAINED / walkable' : 'FLOODED / impassable') + ' / rerouting cannot flood occupied tiles or isolate engineers', done: route.drained });
    });
    if (s.lighting) {
      var lamps = (s.lighting.zones || []).some(function (zone) { return (s.circuits || []).some(function (c) { return c.id === zone.circuitId && c.controlled; }); });
      status.push({ id: 'lighting', label: 'Work lamps ' + (lamps ? 'ON: illuminated targets can be spotted across clear sight; fire still needs weapon range' : 'OFF: targets in darkness can only be spotted within ' + s.lighting.darkRange + ' tiles') + '. All silhouettes are shown on the tactical plan; darkness limits targeting and enemy pursuit, not map knowledge.', done: !lamps });
    }
    if (s.freight) status.push({ id: 'freight', label: freightMessage(s), done: extractionStatus(s).open });
    if (s.ambush) {
      var pending = s.ambush.enemies.filter(function (e) { return !(s.ambush.deployed && s.ambush.deployed[e.id]); });
      status.push({ id: 'ambush', label: pending.length ? (s.ambush.label || 'Rail ambush') + ': ' + pending.length + ' patrol(s) at marked entries ' +
        (s.turn < s.ambush.turn ? 'on turn ' + s.ambush.turn : 'waiting for clear entry tiles') : (s.ambush.label || 'Rail ambush') + ' deployed', done: !pending.length });
    }
    status.push({ id: 'extract', label: 'Extract surviving engineers', done: s.phase === 'won' });
    return status;
  }
  function blocked(s, x, y) {
    var t = tile(s, x, y);
    return t === '#' || t === 'w' || t === 'd' && !doorOpen(s, x, y) || !!s.turret && x === s.turret.x && y === s.turret.y;
  }
  function distance(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function path(s, actor, x, y, radius) {
    radius = radius || 0;
    if (!Number.isInteger(x) || !Number.isInteger(y) || (!radius && blocked(s, x, y))) return null;
    var target = { x: x, y: y };
    var q = [{ x: actor.x, y: actor.y }], parents = {}, head = 0, key = function (a,b) { return a + ',' + b; };
    parents[key(actor.x, actor.y)] = null;
    while (head < q.length) {
      var p = q[head++];
      if (radius ? distance(p, target) <= radius : p.x === x && p.y === y) {
        var out = [], at = p;
        while (at) { out.unshift({ x: at.x, y: at.y }); at = parents[key(at.x, at.y)]; }
        return out;
      }
      [[1,0],[0,1],[-1,0],[0,-1]].forEach(function (d) {
        var nx = p.x + d[0], ny = p.y + d[1], k = key(nx, ny);
        if (Object.prototype.hasOwnProperty.call(parents, k) || !canStep(s, p, { x: nx, y: ny }) || occupant(s, nx, ny)) return;
        parents[k] = p; q.push({ x: nx, y: ny });
      });
    }
    return null;
  }
  function opaque(s, x, y) {
    var openShaft = s.lift && s.lift.kind !== 'bridge' && x >= 8 && x <= 14 && y > 0 && y < s.height - 1;
    return tile(s, x, y) === '#' && !openShaft;
  }
  function visible(s, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, steps = Math.max(Math.abs(dx), Math.abs(dy)) * 4;
    for (var i = 1; i < steps; i++) {
      var x = Math.round(a.x + dx * i / steps), y = Math.round(a.y + dy * i / steps);
      if (x === a.x && y === a.y || x === b.x && y === b.y) continue;
      if (opaque(s, x, y) || tile(s, x, y) === 'd' && !doorOpen(s, x, y)) return false;
    }
    return true;
  }
  function lit(s, x, y) {
    if (!s.lighting) return true;
    return (s.lighting.zones || []).some(function (zone) {
      return distance(zone, { x: x, y: y }) <= zone.radius &&
        (s.circuits || []).some(function (c) { return c.id === zone.circuitId && c.controlled; });
    });
  }
  function detected(s, observer, target) {
    return !s.lighting || distance(observer, target) <= s.lighting.darkRange || lit(s, target.x, target.y);
  }
  function cover(s, target, from) {
    if (tile(s, target.x, target.y) === 'c') return 1;
    var dx = Math.sign(from.x - target.x), dy = Math.sign(from.y - target.y);
    var x = target.x, y = target.y;
    if (Math.abs(from.x - target.x) >= Math.abs(from.y - target.y)) x += dx; else y += dy;
    return tile(s, x, y) === 'c' || opaque(s, x, y) ? 1 : 0;
  }
  function damage(s, from, target) { return Math.max(1, from.damage - cover(s, target, from) + (height(s, from.x, from.y) > height(s, target.x, target.y) ? 1 : 0)); }
  function canShoot(s, a, b) { return living(b) && distance(a, b) <= a.range && visible(s, a, b) && detected(s, a, b); }
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
      if (!p.path && s.water) return fail('Route blocked. Drain a marked channel from its sluice control; flooded water is impassable.');
      if (!p.path) return fail(s.maxStepHeight !== undefined ? 'Route blocked. Use marked stairs between roof levels and route power to open security doors.' : 'Route blocked. Hack the circuit to open the security door.');
      p.cost = Math.ceil((p.path.length - 1) / a.stride);
      if (!p.cost || p.cost > a.ap) return fail('Beyond remaining movement AP.');
      p.reason = p.cost + ' AP · ' + (p.path.length - 1) + ' tiles · confirm move';
      if (s.lighting) {
        p.illuminated = lit(s, x, y);
        p.reason += p.illuminated ? ' / LIT destination: enemies with clear sight may pursue and fire at normal range' : ' / DARK destination: enemies must be within ' + s.lighting.darkRange + ' tiles to spot you';
      }
      var lane = activeLane(s);
      if (lane && lane.tiles.some(function (t) { return t.x === x && t.y === y; })) {
        p.hazardDamage = lane.damage;
        p.reason += ' / WARNING: ' + lane.label + ' deals ' + lane.damage + ' damage here at end turn';
      }
    } else if (kind === 'attack') {
      var target = s.enemies.find(function (e) { return living(e) && e.x === x && e.y === y; });
      if (!target) return fail('Select a hostile patrol.');
      if (!detected(s, a, target)) return fail('Target in darkness. Move within ' + s.lighting.darkRange + ' tiles or restore its work lamps.');
      if (!canShoot(s, a, target)) return fail('Target out of range or behind blocking cover.');
      p.targetId = target.id; p.damage = damage(s, a, target); p.cover = cover(s, target, a);
      p.reason = '1 AP · ' + p.damage + ' damage' + (p.cover ? ' · target in cover' : '') + ' · confirm shot';
    } else if (kind === 'hack' && liftControlAt(s, x, y)) {
      var lift = liftStatus(s), targetControl = { x: x, y: y };
      var vehicle = s.lift.kind === 'bridge' ? 'moving span' : 'lift';
      // The deck is its own control. Fixed consoles can recall the empty lift,
      // keeping either landing recoverable after a split-squad crossing.
      if (height(s, a.x, a.y) !== height(s, x, y) || distance(a, targetControl) > (a.role === 'ENGINEER' ? (a.hackRange || 2) : 1) || !visible(s, a, targetControl)) return fail('Reach a ' + vehicle + ' deck control or a dock console on your level.');
      if (!lift.powered) return fail(s.lift.kind === 'bridge' ? 'Restore the bridge motor circuit before operating the moving span.' : 'Restore the hoist circuit before operating the lift.');
      if (s.lift.requiresRescue !== false && !s.rescued && !s.lift.delivered) return fail('Rescue the lift operator and load the medical cargo before departing.');
      if (s.enemies.some(function (u) { return living(u) && liftAt(s, u.x, u.y); })) return fail('Clear hostile patrols off the ' + vehicle + ' before departure.');
      var destination = s.lift.stops[lift.destination];
      for (var ly = 0; ly < s.lift.size; ly++) for (var lx = 0; lx < s.lift.size; lx++) {
        var dx = destination.x + lx, dy = destination.y + ly;
        if (occupant(s, dx, dy) || s.turret && s.turret.x === dx && s.turret.y === dy) return fail('Clear the destination ' + vehicle + ' platform before departure.');
      }
      p.lift = true; p.liftFrom = lift.position; p.liftTo = lift.destination;
      p.reason = '1 AP · send ' + (s.lift.kind === 'bridge' ? 'moving span' : 'lift') + ' to ' + lift.nextLabel + ' · carries ' + lift.passengers + ' engineer(s)' + (s.lift.kind !== 'bridge' && !lift.delivered ? ' and medical cargo' : '') + ' · engineers off the deck stay behind';
    } else if (kind === 'hack') {
      var circuit = circuitAt(s, x, y);
      if (!circuit) return fail('Select an amber circuit node.');
      if (distance(a, circuit) > (a.role === 'ENGINEER' ? (a.hackRange || 2) : 1) || !visible(s, a, circuit)) return fail('Get within ' + (a.role === 'ENGINEER' ? (a.hackRange || 2) : 1) + ' tile(s) with a clear signal.');
      if (circuit.controlled) return fail('Circuit already under our control.');
      if (circuit.requiresDark && s.lighting && (s.lighting.zones || []).some(function (zone) { return (s.circuits || []).some(function (c) { return c.id === zone.circuitId && c.controlled; }); })) return fail('Blackout interlock: switch off the work lamps before capturing this control.');
      if (circuit.requiresRescue && !s.rescued) return fail('Rescue interlock: evacuate the worker before diverting this route.');
      if (circuit.requiresLiftDock !== undefined && (!s.lift || s.lift.position !== circuit.requiresLiftDock)) return fail('Bridge interlock: dock the moving span at the required bank before capturing this control.');
      if (circuit.requiresBridgeDelivery && (!s.lift || !s.lift.delivered)) return fail('Bridge interlock: carry engineers across the river before capturing this control.');
      var missing = (circuit.requires || []).filter(function (id) { return !s.circuits.some(function (c) { return c.id === id && c.controlled; }); });
      if (missing.length) return fail((s.lift && s.lift.kind === 'bridge' ? 'Bridge interlock: complete ' : s.water ? 'Sluice interlock: complete ' : 'Clinic supply interlock: complete ') + missing.map(function (id) { var c = s.circuits.find(function (entry) { return entry.id === id; }); return c ? c.label : id; }).join(' and ') + ' first.');
      if (s.circuits && isolatesSquad(s, circuit)) return fail(s.water ? 'Sluice safety interlock: clear living units from the channel that will flood and keep every active engineer connected to this control through the new dry route.' : 'Reroute would strand an engineer. Bring every active engineer back to the controller side of the closing door first.');
      p.circuitId = circuit.id;
      var losesTurret = s.circuits && !circuit.turret && s.circuits.some(function (c) { return c.controlled && c.turret && c.exclusiveGroup && c.exclusiveGroup === circuit.exclusiveGroup; });
      p.reason = s.circuits ? '1 AP · ' + circuit.label + (circuit.exclusiveGroup ? ' · reroutes power away from the other route' : '') + (circuit.turret ? ' · turret becomes allied' : losesTurret ? ' · turret becomes HOSTILE' : '') : '1 AP · open door + take turret + restore lights';
      if (s.water && s.water.routes.some(function (route) { return route.circuitId === circuit.id; })) p.reason += ' · drains this channel; alternate channel floods immediately';
      if (s.lighting) {
        var controlsLamps = (s.lighting.zones || []).some(function (zone) { return zone.circuitId === circuit.id; });
        var cutsLamps = !controlsLamps && circuit.exclusiveGroup && (s.lighting.zones || []).some(function (zone) { return s.circuits.some(function (c) { return c.id === zone.circuitId && c.exclusiveGroup === circuit.exclusiveGroup; }); });
        if (controlsLamps) p.reason += ' · work lamps ON: illuminated targets visible at normal range';
        else if (cutsLamps) p.reason += ' · work lamps OFF: dark targets only visible within ' + s.lighting.darkRange + ' tiles';
      }
      if (s.archive && (circuit.id === s.archive.evidenceCircuit || circuit.id === s.archive.delayCircuit)) {
        var archive = archiveStatus(s);
        p.archivePreview = [s.turn, archive.deadline, archive.secured].join('/');
        if (circuit.id === s.archive.evidenceCircuit) {
          p.reason = '1 AP · copy the evidence and stop the purge';
        } else {
          p.reason = '1 AP · open the north route and ally the turret' +
            (archive.secured ? '' : ' · delay purge to end of turn ' + (archive.deadline + s.archive.extension));
        }
      }
      if (s.keyPair && s.keyPair.circuitIds.indexOf(circuit.id) !== -1) {
        var armed = s.keyPair.armed;
        if (armed && armed.id === circuit.id) return fail(circuit.label + ' is armed. HACK the other key before End Turn.');
        if (armed && armed.actorId === a.id) return fail('Use a different engineer to HACK the second key before End Turn.');
        p.keyPairPreview = [s.turn, armed && armed.id, armed && armed.actorId].join('/');
        p.reason = armed ? '1 AP · synchronize both keys and open the gate' :
          '1 AP · arm ' + circuit.label + ' · HACK the other key with a different engineer before End Turn';
      }
      if (s.broadcast && circuit.id === s.broadcast.circuitId) {
        p.reason = '1 AP · open the north hatch · marked patrols head to ' + s.broadcast.destinationLabel +
          ' on enemy turns and can still fire';
      }
    } else if (kind === 'rescue') {
      if (x !== s.rescue.x || y !== s.rescue.y || s.rescued) return fail('No worker to rescue here.');
      if (s.objectives && (s.objectives.rescueRequires || []).some(function (id) { return !(s.circuits || []).some(function (c) { return c.id === id && c.controlled; }); })) return fail('Restore the rescue route circuit before evacuating the worker.');
      if (!canReachAdjacent(s, a, s.rescue)) return fail('Get adjacent to the worker on the same level or a connecting stair.');
      p.reason = '1 AP · ' + (s.objectives && s.objectives.rescueLabel || 'release signal worker') + ' · +400 points';
    } else if (kind === 'heal') {
      var ally = s.squad.find(function (u) { return living(u) && u.x === x && u.y === y; });
      if (a.role !== 'MEDIC') return fail('Only Sol can apply field aid.');
      if (a.kits === 0) return fail('No field aid kits left this operation.');
      if (!ally || !canReachAdjacent(s, a, ally) || ally.hp >= ally.maxHp) return fail('Select an injured adjacent engineer on this level or a connecting stair, including Sol.');
      p.targetId = ally.id; p.reason = '1 AP · heal 4 HP · uses one field kit (' + (a.kits === undefined ? 2 : a.kits) + ' remaining)';
    } else if (kind === 'watch') {
      if (a.watch) return fail('Overwatch already set.');
      p.reason = '1 AP · one reaction shot during the enemy turn';
    } else if (kind === 'extract') {
      if (tile(s, a.x, a.y) !== 'e') return fail(s.extractionLabel ? 'Stand on a tile in the ' + s.extractionLabel + '.' : 'Stand on an eastern extraction tile.');
      if (s.freight) {
        var boarding = extractionStatus(s);
        if (!boarding.open) return fail(freightMessage(s) + '. Windows repeat; wait safely or prepare the next platform.');
        if (!boarding.tiles.some(function (t) { return t.x === a.x && t.y === a.y; })) return fail('Board at ' + boarding.label + ' now. ' + boarding.nextLabel + ' is the next stop.');
      }
      if (s.defense && (s.defense.hp <= 0 || !defenseStatus(s).done)) return fail('Protect the clinic staff through all ' + s.defense.rounds + ' assaults before extracting.');
      if (s.pumps && !pumpStatus(s).done) return fail('Stabilize twin pump pressure for ' + s.pumps.rounds + ' consecutive end turns before extracting. Both powered controls need a living engineer on or within 1 tile after enemy fire; interrupted coverage resets progress.');
      if (s.lift && !s.lift.delivered) return fail(s.lift.kind === 'bridge' ? 'Carry engineers across the river on the moving span before extracting.' : 'Deliver the rescued operator and medical cargo on the lift before extracting.');
      if (s.archive && !archiveStatus(s).secured) return fail('Copy the Archive evidence before extracting.');
      if (s.keyPair && !s.keyPair.opened) return fail('Synchronize both keys before extracting.');
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
    else if (s.keyPair && !s.keyPair.opened && s.squad.filter(living).length < 2) {
      s.keyPair.failed = true; s.phase = 'lost';
      log(s, 'Paired access needs two surviving engineers. Retry to open the gate.', 'lost');
    }
    else if (s.squad.every(function (u) { return u.hp <= 0 || u.extracted; })) {
      s.phase = 'won'; s.score += s.squad.filter(function (u) { return u.extracted; }).length * 250 + Math.max(0, 20 - s.turn) * 30;
      log(s, s.title + ' complete. The rescued crew is safe. Full campaign in development.', 'won');
    }
  }
  function commit(s, proposed) {
    if (!proposed || !proposed.legal) return false;
    var p = preview(s, proposed.actorId, proposed.kind, proposed.x, proposed.y);
    if (!p.legal) return false;
    if ((p.lift || proposed.lift) && (!p.lift || !proposed.lift || p.liftFrom !== proposed.liftFrom || p.liftTo !== proposed.liftTo)) return false;
    if (p.archivePreview !== proposed.archivePreview || p.keyPairPreview !== proposed.keyPairPreview) return false;
    var a = unit(s, p.actorId); a.ap -= p.cost;
    if (p.kind === 'move') { a.x = p.x; a.y = p.y; log(s, a.name + ' moved · ' + p.cost + ' AP'); }
    if (p.kind === 'attack') strike(s, a, s.enemies.find(function (e) { return e.id === p.targetId; }), a.name + ' fired');
    if (p.kind === 'hack' && p.lift) {
      var from = s.lift.stops[p.liftFrom], to = s.lift.stops[p.liftTo];
      var passengers = s.squad.filter(function (u) { return living(u) && liftAt(s, u.x, u.y); });
      passengers.forEach(function (u) { u.x += to.x - from.x; u.y += to.y - from.y; });
      s.lift.position = p.liftTo;
      var bridge = s.lift.kind === 'bridge';
      if (p.liftTo === 1 && (bridge ? passengers.length > 0 : s.rescued)) s.lift.delivered = true;
      log(s, (bridge ? 'Moving span reached ' : 'Cargo lift reached ') + to.label + ' · ' + passengers.length + ' engineer(s) carried' + (s.lift.delivered ? bridge ? ' · east crossing secured' : ' · medical cargo delivered' : ''), 'hack');
    }
    if (p.kind === 'hack' && !p.lift) {
      if (s.circuits) {
        var circuit = circuitAt(s, p.x, p.y);
        if (p.keyPairPreview) confirmKey(s, circuit, a);
        else {
          if (circuit.exclusiveGroup) s.circuits.forEach(function (c) { if (c.exclusiveGroup === circuit.exclusiveGroup) c.controlled = false; });
          circuit.controlled = true;
          if (!circuit.scored) { s.score += 500; circuit.scored = true; }
          s.network = networkReady(s);
          if (s.archive && circuit.id === s.archive.evidenceCircuit) {
            log(s, 'Evidence copied. Purge stopped. Rescue the archivist and extract.', 'hack');
          } else if (s.archive && circuit.id === s.archive.delayCircuit) {
            var archive = archiveStatus(s);
            log(s, 'North route open · turret allied' +
              (archive.secured ? '' : ' · purge delayed to end of turn ' + archive.deadline), 'hack');
          } else if (s.broadcast && circuit.id === s.broadcast.circuitId) {
            log(s, 'Decoy transmitting · north hatch open · marked patrols head to ' + s.broadcast.destinationLabel, 'hack');
          } else {
            log(s, circuit.label + ' · circuit routed' + (circuit.exclusiveGroup ? ' · alternate route closed' : ''), 'hack');
          }
        }
      } else { s.network = true; s.score += 500; log(s, 'CIRCUIT OURS · door open · turret allied · lights restored', 'hack'); }
    }
    if (p.kind === 'rescue') { s.rescued = true; s.score += 400; log(s, (s.objectives && s.objectives.rescueLabel || 'Worker freed') + ' · escort signal clear; extract the squad.', 'rescue'); }
    if (p.kind === 'heal') { var ally = unit(s, p.targetId); ally.hp = Math.min(ally.maxHp, ally.hp + 4); a.kits = (a.kits === undefined ? 2 : a.kits) - 1; log(s, 'Sol treated ' + ally.name + ' · +4 HP', 'heal'); }
    if (p.kind === 'watch') { a.watch = true; log(s, a.name + ' covering the approach', 'watch'); }
    if (p.kind === 'extract') { a.extracted = true; log(s, a.name + ' extracted', 'rescue'); }
    outcome(s); return true;
  }
  function enemyApproachPath(s, enemy, target) {
    var best = null, startDistance = distance(enemy, target);
    for (var y = 1; y < s.height - 1; y++) for (var x = 1; x < s.width - 1; x++) {
      if (occupant(s, x, y) || blocked(s, x, y) || Math.abs(enemy.x - x) + Math.abs(enemy.y - y) > enemy.stride) continue;
      var remaining = Math.abs(x - target.x) + Math.abs(y - target.y);
      if (remaining >= startDistance) continue;
      var route = path(s, enemy, x, y);
      if (route && route.length - 1 <= enemy.stride && (!best || remaining < best.distance)) best = { route: route, distance: remaining };
    }
    return best && best.route;
  }
  function endTurn(s) {
    if (s.phase !== 'player') return false;
    var expiredKey = s.keyPair && s.keyPair.armed;
    if (expiredKey) s.keyPair.armed = null;
    s.phase = 'enemy';
    if (s.turret) {
      var allied = turretAllied(s), targets = allied ? s.enemies : s.squad;
      var turretTarget = targets.filter(function (u) { return living(u) && canShoot(s, s.turret, u); })
        .sort(function (a,b) { return distance(s.turret, a) - distance(s.turret, b); })[0];
      if (turretTarget) strike(s, s.turret, turretTarget, allied ? 'Allied turret' : 'Hostile turret');
    }
    var broadcast = broadcastStatus(s);
    s.enemies.forEach(function (e) {
      if (!living(e)) return;
      var squad = s.squad.filter(function (u) { return living(u) && (!s.lighting || detected(s, e, u) && visible(s, e, u)); }).sort(function (a,b) { return distance(e,a) - distance(e,b); }), target = squad[0];
      var redirected = broadcast && broadcast.active && s.broadcast.patrolIds.indexOf(e.id) !== -1;
      if (!target && !redirected) return;
      var route = null;
      if (redirected) route = path(s, e, broadcast.destination.x, broadcast.destination.y, 2);
      else if (!canShoot(s, e, target)) route = enemyApproachPath(s, e, target);
      if (route) for (var i = 1; i < route.length && i <= e.stride && living(e); i++) {
        e.x = route[i].x; e.y = route[i].y;
        s.squad.forEach(function (u) { if (living(e) && living(u) && u.watch && canShoot(s, u, e)) { u.watch = false; strike(s, u, e, u.name + ' overwatch'); } });
      }
      // Re-evaluate after movement and reactions; dead/extracted targets never take fire.
      var available = s.squad.filter(function (u) { return canShoot(s, e, u); }).sort(function (a,b) { return distance(e,a) - distance(e,b); });
      if (living(e) && available.length) strike(s, e, available[0], e.name);
    });
    resolveDefense(s);
    if (s.phase !== 'lost') resolveLane(s);
    if (s.phase !== 'lost') resolvePumps(s);
    outcome(s);
    if (s.phase === 'enemy') resolvePurge(s);
    if (s.phase === 'lost' || s.phase === 'won') return true;
    s.turn++; s.phase = 'player'; s.squad.forEach(function (u) { if (living(u)) u.ap = 2; u.watch = false; });
    log(s, 'Turn ' + s.turn + ' · engineer AP refreshed', 'turn');
    deployAmbush(s);
    if (s.freight) log(s, freightMessage(s), 'turn');
    if (expiredKey) log(s, 'Key expired · confirm both keys in the same turn. Both controls are ready again.', 'turn');
    return true;
  }
  SB.Logic = { newGame: newGame, tile: tile, height: height, unit: unit, living: living, occupant: occupant,
    blocked: blocked, canStep: canStep, path: path, visible: visible, lit: lit, detected: detected, cover: cover, damage: damage, preview: preview, commit: commit, endTurn: endTurn,
    waterStatus: waterStatus, waterRouteAt: waterRouteAt, liftAt: liftAt, liftStatus: liftStatus, liftControlAt: liftControlAt, defenseStatus: defenseStatus, pumpStatus: pumpStatus, keyPairStatus: keyPairStatus, archiveStatus: archiveStatus, activeLane: activeLane,
    circuitAt: circuitAt, doorOpen: doorOpen, objectiveStatus: objectiveStatus, turretAllied: turretAllied, extractionStatus: extractionStatus, broadcastStatus: broadcastStatus };
})(window);
