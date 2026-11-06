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
  // Authored operations only. The manifest above remains the full twenty-operation
  // contract; unbuilt entries never become duplicate playable placeholders.
  var opening = SB.Missions.opening;
  var squad = function (positions) {
    return opening.squad.map(function (u, i) {
      var copy = JSON.parse(JSON.stringify(u));
      copy.x = positions[i][0]; copy.y = positions[i][1];
      return copy;
    });
  };
  var locked = {
    id: 'locked-manifest', title: 'Locked Manifest', district: 'Switchyard', sequence: 2,
    briefing: 'The yard registrar has been locked in the upper records block. One transfer relay can power either the prison door or the southern evacuation gate, never both. Release the registrar, bring your squad back out of the prison, then reroute the relay for extraction.',
    radio: 'MARA / Prison relay first. The amber node at the south of the yard reroutes power to evacuation, closing the prison and returning its turret to occupation control. Get everyone clear before you switch.',
    objectiveSummary: 'Open prison route, free the registrar, then reroute power to the evacuation gate. Keep the squad outside the prison when switching.',
    extractionLabel: 'southern evacuation wing',
    objectives: { requiredCircuits: ['evac'], rescueLabel: 'Free the detained registrar' },
    rows: [
      '######################',
      '#.........#..........#',
      '#...c.....#..c.......#',
      '#.........#......r...#',
      '#......n..d..........#',
      '#..c......#..c.......#',
      '#.........#..........#',
      '#.........############',
      '#..............#.....#',
      '#....c.........#..c..#',
      '#......n.......d..eee#',
      '#.........c....#..eee#',
      '#..............#.....#',
      '######################'
    ],
    heights: [{ x: 13, y: 2, z: 1 }, { x: 14, y: 2, z: 1 }, { x: 15, y: 2, z: 1 }],
    squad: squad([[2, 8], [2, 9], [2, 10], [2, 11]]),
    enemies: [
      { id: 'yard-officer', name: 'Transfer officer', x: 8, y: 3, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
      { id: 'records-guard', name: 'Records guard', x: 14, y: 2, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
      { id: 'cell-warden', name: 'Cell warden', x: 18, y: 5, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
      { id: 'evac-sentry', name: 'Evacuation sentry', x: 19, y: 9, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 }
    ],
    turret: { x: 18, y: 6, range: 7, damage: 3 },
    node: { x: 7, y: 4 }, rescue: { x: 17, y: 3 },
    circuits: [
      { id: 'prison', label: 'Prison route', x: 7, y: 4, controlled: false, doors: [{ x: 10, y: 4 }], exclusiveGroup: 'transfer', turret: true },
      { id: 'evac', label: 'Evacuation route', x: 7, y: 10, controlled: false, doors: [{ x: 15, y: 10 }], exclusiveGroup: 'transfer' }
    ],
    mastery: 'Free the registrar and extract all four engineers in fourteen turns or fewer.',
    debrief: 'The registrar names the clinic as the next occupation target. Her manifest reveals two supply feeds and a bypass the patrols have overlooked.'
  };
  var feed = {
    id: 'cut-the-feed', title: 'Cut the Feed', district: 'Switchyard', sequence: 3,
    briefing: 'Two occupation substations share the clinic supply. Isolate the western feed to reach the service court. Restore the clinic bypass in the northern ward before isolating the eastern feed; its safety interlock will refuse an unsafe cut. Free the clinic technician, then extract through the eastern loading bay.',
    radio: 'SOL / The northern bypass keeps the clinic alive. Split the squad between the ward and the eastern feed if you can protect both approaches. The second isolator will not cut until the bypass is carrying the load.',
    objectiveSummary: 'Isolate west feed, restore the northern clinic bypass, then isolate east feed. Rescue the clinic technician and extract from the loading bay.',
    extractionLabel: 'eastern loading bay',
    objectives: { requiredCircuits: ['west', 'clinic', 'east'], rescueLabel: 'Rescue the clinic technician' },
    rows: [
      '########################',
      '#.......#.......#......#',
      '#.......#...n...#......#',
      '#..c....#..c....#..c...#',
      '#.......#...r...#......#',
      '#....n..d.......#......#',
      '#.......#..c....#......#',
      '#.......#.......#......#',
      '#.......#.#####.#......#',
      '#..c....#.......#..c...#',
      '#.......#....n..#......#',
      '#.......#..c....d......#',
      '#.......#.......#..c...#',
      '#.......#.......#...eee#',
      '#.......#.......#...eee#',
      '########################'
    ],
    heights: [{ x: 10, y: 3, z: 1 }, { x: 11, y: 3, z: 1 }, { x: 12, y: 3, z: 1 }, { x: 19, y: 9, z: 1 }, { x: 20, y: 9, z: 1 }],
    squad: squad([[2, 10], [2, 11], [2, 12], [2, 13]]),
    enemies: [
      { id: 'service-patrol', name: 'Service patrol', x: 11, y: 7, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
      { id: 'clinic-guard', name: 'Ward guard', x: 14, y: 3, hp: 5, maxHp: 5, damage: 2, range: 5, stride: 3 },
      { id: 'feed-enforcer', name: 'Feed enforcer', x: 20, y: 10, hp: 7, maxHp: 7, damage: 2, range: 6, stride: 3 },
      { id: 'loading-sentry', name: 'Loading sentry', x: 21, y: 13, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 }
    ],
    turret: { x: 20, y: 4, range: 8, damage: 3 },
    node: { x: 5, y: 5 }, rescue: { x: 12, y: 4 },
    circuits: [
      { id: 'west', label: 'West feed isolated', x: 5, y: 5, controlled: false, doors: [{ x: 8, y: 5 }] },
      { id: 'clinic', label: 'Clinic bypass restored', x: 12, y: 2, controlled: false, doors: [] },
      { id: 'east', label: 'East feed isolated', x: 13, y: 10, controlled: false, doors: [{ x: 16, y: 11 }], requires: ['clinic'], turret: true }
    ],
    mastery: 'Keep every engineer standing, preserve the clinic supply and extract in sixteen turns or fewer.',
    debrief: 'The clinic is lit and the occupation feeds are silent. Mara traces the next escape window to a night freight train. Its dispatcher knows a route into the Vertical Market.'
  };
  var freight = {
    id: 'night-freight', title: 'Night Freight', district: 'Switchyard', sequence: 4,
    briefing: 'A freight shuttle is our only route into the Vertical Market. Capture the points relay to open both yard gates and turn the loading turret. Rescue the dispatcher in the northern signal box, then board from the marked platforms. The train stops at West for two turns, travels for one, stops at East for two, then travels for one before repeating. Rear patrols arrive on turn four. Missing a train never ends the operation: hold cover and catch the next circuit.',
    radio: 'MARA / West boards on turns 1-2, East on 4-5; the six-turn timetable repeats. Leave one AP to board. Rear patrols enter from the southeast on turn four. Clear the cargo flanks before splitting the squad between platforms.',
    objectiveSummary: 'Capture the points relay, rescue the dispatcher, and board the freight at the currently open platform. Two-turn stops alternate with one-turn travel; the timetable repeats every six turns. Southeast ambush: turn 4.',
    extractionLabel: 'active freight platform',
    objectives: { requiredCircuits: ['points'], rescueLabel: 'Rescue the freight dispatcher' },
    rows: [
      '######################',
      '#.........#..........#',
      '#...c.....#..c.......#',
      '#.........#......r...#',
      '#......n..d..........#',
      '#..c......#.####.....#',
      '#.........#.####.....#',
      '#.........#..........#',
      '#....c....#..ee..ee..#',
      '#.........#..c...c...#',
      '#.........d..........#',
      '#..c......#..........#',
      '#.........#..........#',
      '######################'
    ],
    heights: [{ x: 13, y: 2, z: 1 }, { x: 14, y: 2, z: 1 }, { x: 15, y: 2, z: 1 }],
    squad: squad([[2, 4], [2, 5], [2, 6], [2, 7]]),
    enemies: [
      { id: 'freight-officer', name: 'Points officer', x: 8, y: 2, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
      { id: 'freight-lookout', name: 'Signal-box lookout', x: 18, y: 2, hp: 6, maxHp: 6, damage: 2, range: 6, stride: 2 },
      { id: 'freight-loader', name: 'Cargo patrol', x: 16, y: 10, hp: 7, maxHp: 7, damage: 2, range: 5, stride: 3 }
    ],
    turret: { x: 18, y: 6, range: 7, damage: 3 },
    node: { x: 7, y: 4 }, rescue: { x: 17, y: 3 },
    circuits: [
      { id: 'points', label: 'Freight points secured', x: 7, y: 4, controlled: false, doors: [{ x: 10, y: 4 }, { x: 10, y: 10 }], turret: true }
    ],
    freight: {
      dwell: 2, transit: 1,
      stops: [
        { label: 'West platform', tiles: [{ x: 13, y: 8 }, { x: 14, y: 8 }] },
        { label: 'East platform', tiles: [{ x: 17, y: 8 }, { x: 18, y: 8 }] }
      ]
    },
    ambush: {
      turn: 4,
      enemies: [
        { id: 'freight-rear-a', name: 'Rear pursuit', x: 20, y: 10, hp: 5, maxHp: 5, damage: 2, range: 5, stride: 3 },
        { id: 'freight-rear-b', name: 'Rail interceptor', x: 20, y: 11, hp: 5, maxHp: 5, damage: 2, range: 4, stride: 3 }
      ]
    },
    mastery: 'Rescue the dispatcher, defeat the rear ambush and board all four engineers in fourteen turns or fewer.',
    debrief: 'The last engineer climbs aboard and the dispatcher sends the freight uphill. Switchyard crews reclaim their gates and clinic. Ahead, rooftop antennae rise above the Vertical Market. The squad prepares to climb into Rooftop Crossfire.'
  };
  var rooftopHeights = [];
  for (var roofY = 2; roofY <= 12; roofY++) for (var roofX = 8; roofX <= 21; roofX++) {
    rooftopHeights.push({ x: roofX, y: roofY, z: 2 });
  }
  var rooftop = {
    id: 'rooftop-crossfire', title: 'Rooftop Crossfire', district: 'Vertical Market', sequence: 5,
    briefing: 'The freight dispatcher has brought us beneath the occupied market roofs. The north stairs are always open but face the lookout crossfire. A street-level service relay opens the southern stairs and turns the rooftop turret, creating a second approach beside the trapped antenna keeper. Secure that relay and the rooftop uplink, rescue the keeper, then extract from the eastern tram roof. Engineers cannot climb sheer roof edges: use either marked stair.',
    radio: 'ROOK / North stairs at (7,4); south stairs at (7,11). The amber street relay at (5,10) opens the south gate and turns their turret. Split your approach around the kiosks; high ground gives one extra damage against the street.',
    objectiveSummary: 'Take the street service relay and rooftop uplink. Use the north stairs or unlock the southern flank; rescue the antenna keeper, then extract at the tram roof.',
    extractionLabel: 'eastern tram roof',
    objectives: { requiredCircuits: ['market-service', 'roof-uplink'], rescueLabel: 'Rescue the antenna keeper' },
    rows: [
      '########################',
      '#......................#',
      '#......................#',
      '#...###.......c........#',
      '#..c.....c..##....nc...#',
      '#...........##.......c.#',
      '#...###...c.##.c.......#',
      '#...................ee.#',
      '#....c.....c....##..ee.#',
      '#...............##.....#',
      '#....n............rc...#',
      '#.......d.##..c........#',
      '#.....c................#',
      '#......................#',
      '#......................#',
      '########################'
    ],
    heights: rooftopHeights,
    maxStepHeight: 0,
    climbLinks: [
      { from: { x: 7, y: 4 }, to: { x: 8, y: 4 } },
      { from: { x: 7, y: 11 }, to: { x: 8, y: 11 } }
    ],
    stairs: [
      { label: 'North stairs', x: 7, y: 4, toX: 8, toY: 4 },
      { label: 'South stairs / service relay', x: 7, y: 11, toX: 8, toY: 11 }
    ],
    squad: squad([[2, 8], [2, 9], [2, 10], [2, 11]]),
    enemies: [
      { id: 'market-enforcer', name: 'Street enforcer', x: 6, y: 9, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
      { id: 'north-lookout', name: 'North roof lookout', x: 10, y: 3, hp: 6, maxHp: 6, damage: 2, range: 6, stride: 2 },
      { id: 'uplink-marksman', name: 'Uplink marksman', x: 20, y: 4, hp: 6, maxHp: 6, damage: 2, range: 6, stride: 2 },
      { id: 'roof-warden', name: 'Antenna warden', x: 19, y: 11, hp: 7, maxHp: 7, damage: 2, range: 5, stride: 3 }
    ],
    turret: { x: 19, y: 6, range: 7, damage: 3 },
    node: { x: 5, y: 10 }, rescue: { x: 18, y: 10 },
    circuits: [
      { id: 'market-service', label: 'Market service relay', x: 5, y: 10, controlled: false, doors: [{ x: 8, y: 11 }], turret: true },
      { id: 'roof-uplink', label: 'Rooftop uplink secured', x: 18, y: 4, controlled: false, doors: [] }
    ],
    mastery: 'Use both stair approaches, rescue the keeper and extract all four engineers in sixteen turns or fewer.',
    debrief: 'The antenna keeper connects Mara to the market rooftops. The freight route is secure, and the tram roof becomes a civilian refuge. The keeper points to a stranded cargo lift: its medical supplies must reach the clinic. Its operator needs the squad to restore the hoist and escort the medicine across the shaft.'
  };
  var cargoHeights = [];
  for (var cargoY = 1; cargoY <= 14; cargoY++) for (var cargoX = 15; cargoX <= 22; cargoX++) {
    cargoHeights.push({ x: cargoX, y: cargoY, z: 2 });
  }
  var cargo = {
    id: 'cargo-lift', title: 'Cargo Lift', district: 'Vertical Market', sequence: 6,
    briefing: 'The market clinic has no safe supply road. Its medicine and lift operator are trapped behind the loading-dock shutter, while occupation sentries hold the clinic terrace across a sheer service shaft. Take the hoist relay to open that shutter and turn the upper turret. Rescue the operator and medical cargo, board the four-square platform at (8,6), then select an engineer and tap the platform or a dock console to HACK-dispatch it for one AP. Every engineer aboard rides together. Clear the upper terrace, take the reception circuit and extract through its eastern gate. The lift can be recalled empty from either dock; nobody must be left behind.',
    radio: 'SOL / Hoist relay (4,9), operator (5,2). Board all four platform squares before dispatch if you want one crossing. The low console is (7,5); the upper console is (15,5). Platform riders can dispatch too. Secure reception at (18,10) after delivery.',
    objectiveSummary: 'Power the hoist, rescue the operator and medicine, deliver the cargo across the lift, secure clinic reception, and extract the squad.',
    extractionLabel: 'clinic evacuation balcony',
    objectives: { requiredCircuits: ['hoist', 'reception'], rescueLabel: 'Rescue lift operator and medical cargo' },
    rows: [
      '########################',
      '#.......#######.....####',
      '#.c..r..#######.....#..#',
      '#.......#######.c...#ee#',
      '#####d#########.....dee#',
      '#......n#######n....#..#',
      '#.......#######..c..#..#',
      '#.......#######.....####',
      '#.....c.#######........#',
      '#...n...#######........#',
      '#.......#######...n..c.#',
      '#..c....#######........#',
      '#.......#######....c...#',
      '#.......#######........#',
      '#.......#######........#',
      '########################'
    ],
    heights: cargoHeights,
    maxStepHeight: 0,
    squad: squad([[2,10],[2,11],[2,12],[2,13]]),
    enemies: [
      { id: 'dock-inspector', name: 'Dock inspector', x: 5, y: 8, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
      { id: 'shutter-guard', name: 'Shutter guard', x: 4, y: 2, hp: 5, maxHp: 5, damage: 2, range: 5, stride: 2 },
      { id: 'terrace-sentry', name: 'Terrace sentry', x: 18, y: 6, hp: 7, maxHp: 7, damage: 2, range: 6, stride: 2 },
      { id: 'reception-warden', name: 'Reception warden', x: 20, y: 11, hp: 7, maxHp: 7, damage: 2, range: 5, stride: 3 }
    ],
    turret: { x: 19, y: 3, range: 6, damage: 3 },
    node: { x: 4, y: 9 }, rescue: { x: 5, y: 2 },
    circuits: [
      { id: 'hoist', label: 'Hoist relay and terrace turret', x: 4, y: 9, controlled: false, doors: [{ x: 5, y: 4 }], turret: true },
      { id: 'reception', label: 'Clinic reception secured', x: 18, y: 10, controlled: false, doors: [{ x: 20, y: 4 }] }
    ],
    lift: {
      position: 0, poweredBy: 'hoist', size: 2, delivered: false,
      stops: [
        { x: 8, y: 6, z: 0, label: 'Loading dock', console: { x: 7, y: 5 } },
        { x: 13, y: 6, z: 2, label: 'Clinic terrace', console: { x: 15, y: 5 } }
      ]
    },
    mastery: 'Deliver the medicine and extract all four engineers in eighteen turns or fewer; carry the whole squad on the first ascent.',
    debrief: 'The operator locks the medicine crates into the clinic loading bay. Sol recognizes names from the evacuation list, and Mara gets the staff onto a protected channel. The clinic now has supplies, but its defenders are scattered across two power zones. Open Clinic remains in development.'
  };
  SB.Missions.operations = [opening, locked, feed, freight, rooftop, cargo];
  SB.Missions.get = function (id) {
    return SB.Missions.operations.find(function (mission) { return mission.id === id; }) || null;
  };
})(window);
