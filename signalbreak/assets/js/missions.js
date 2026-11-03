(function (global) {
  'use strict';
  var SB = global.SB = global.SB || {};
  SB.Missions = {
    manifest: [
      ['Switchyard', 'Live Wire', 'Locked Manifest', 'Cut the Feed', 'Night Freight'],
      ['Vertical Market', 'Rooftop Crossfire', 'Cargo Lift', 'Open Clinic', 'Antenna Rain'],
      ['Floodworks', 'Sluice Logic', 'Span Control', 'Blackout', 'Pump Siege'],
      ['Glass Archive', 'Paper Trail', 'Two Keys', 'Ghost Broadcast', 'Stolen Convoy'],
      ['Broadcast Citadel', 'Outer Relay', 'Vertical Breach', 'Safe Corridor', 'Signalbreak']
    ],
    opening: {
      id: 'live-wire', title: 'Live Wire', district: 'Switchyard',
      briefing: 'The occupation runs this yard from a single circuit. Take the substation, free the signal worker, then get every surviving engineer to the eastern extraction zone.',
      radio: 'MARA / A switched circuit opens the security door and brings its turret onto our side. Get Nia to the amber node.',
      rows: [
        '##################',
        '#.......#........#',
        '#....c..#..c.....#',
        '#.......#....c...#',
        '#..c....#........#',
        '#.......#..c.....#',
        '#.....n.d........#',
        '#..c....#........#',
        '#.......#..c.....#',
        '#.......#...r....#',
        '#.......#.....eee#',
        '##################'
      ],
      heights: [{ x: 11, y: 2, z: 1 }, { x: 12, y: 2, z: 1 }, { x: 13, y: 2, z: 1 }, { x: 14, y: 2, z: 1 }],
      squad: [
        { id: 'nia', name: 'Nia', role: 'ENGINEER', x: 2, y: 4, hp: 10, maxHp: 10, damage: 3, range: 7, stride: 4, color: '#e9be74' },
        { id: 'sol', name: 'Sol', role: 'MEDIC', x: 2, y: 5, hp: 10, maxHp: 10, damage: 3, range: 6, stride: 4, color: '#88d2bc' },
        { id: 'rook', name: 'Rook', role: 'SCOUT', x: 2, y: 6, hp: 9, maxHp: 9, damage: 3, range: 8, stride: 5, color: '#a1c9e8' },
        { id: 'ivo', name: 'Ivo', role: 'HEAVY', x: 2, y: 7, hp: 12, maxHp: 12, damage: 4, range: 7, stride: 3, color: '#de9a82' }
      ],
      enemies: [
        { id: 'guard-a', name: 'Yard patrol', x: 11, y: 4, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
        { id: 'guard-b', name: 'Relay guard', x: 14, y: 7, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
        { id: 'guard-c', name: 'Exit sentry', x: 15, y: 9, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 }
      ],
      turret: { x: 12, y: 3, range: 8, damage: 3 }, node: { x: 6, y: 6 }, rescue: { x: 12, y: 9 }
    }
  };
})(window);
