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
    debrief: 'The operator locks the medicine crates into the clinic loading bay. Sol recognizes names from the evacuation list, and Mara gets the staff onto a protected channel. The clinic now has supplies, but its defenders are scattered across two power zones. The squad must now hold Open Clinic while its staff evacuate under alternating attacks.'
  };
  var clinic = {
    id: 'open-clinic', title: 'Open Clinic', district: 'Vertical Market', sequence: 7,
    briefing: 'The medicine is here, but occupation batteries are ranging the clinic wards. Hold through six announced assaults while the staff prepare to evacuate. The north and south shield feeds share one supply: HACK the announced feed before ending each turn. A wrong feed costs two of the staff\'s eight health; four missed shields lose the operation. North power also allies the atrium turret; south power shields the other ward but returns that turret to the occupation. Patrols attack your engineers while the batteries attack the staff. Rescue the staff, complete the defense, then extract at the ambulance court.',
    radio: 'SOL / First assault: NORTH. Feeds at (9,7) and (11,7); the center tile (10,7) can reach both. The sequence is north, south, south, north, south, north. Keep Ivo watching the west service door; reinforcements enter on turn three.',
    objectiveSummary: 'Protect six alternating ward assaults, rescue the medical staff, and extract at the southeast ambulance court.',
    extractionLabel: 'ambulance court',
    objectives: { requiredCircuits: [], rescueLabel: 'Evacuate the medical staff' },
    rows: [
      '########################',
      '#......................#',
      '#......#........#......#',
      '#..c.c.#........#.c.c..#',
      '#......#........#......#',
      '#......#c.r.c...#......#',
      '#.##.##..........##.##.#',
      '#........n.n...........#',
      '#......................#',
      '#.....c.......c....##..#',
      '#..##..................#',
      '#......c..........c....#',
      '#.............c.....eee#',
      '#...................eee#',
      '#......................#',
      '########################'
    ],
    heights: [{ x: 3, y: 3, z: 1 }, { x: 20, y: 3, z: 1 }],
    squad: squad([[8,8],[9,9],[10,9],[11,9]]),
    enemies: [
      { id: 'west-orderly-hunter', name: 'West ward raider', x: 4, y: 3, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
      { id: 'east-orderly-hunter', name: 'East ward raider', x: 19, y: 3, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
      { id: 'ambulance-blocker', name: 'Ambulance interceptor', x: 18, y: 12, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 }
    ],
    turret: { x: 16, y: 7, range: 5, damage: 2 },
    node: { x: 9, y: 7 }, rescue: { x: 10, y: 5 },
    circuits: [
      { id: 'north-feed', label: 'North ward shield / allied turret', x: 9, y: 7, controlled: false, exclusiveGroup: 'clinic-feed', doors: [], turret: true },
      { id: 'south-feed', label: 'South ward shield / hostile turret', x: 11, y: 7, controlled: false, exclusiveGroup: 'clinic-feed', doors: [] }
    ],
    defense: { rounds: 6, elapsed: 0, hp: 8, maxHp: 8, schedule: ['north','south','south','north','south','north'], covers: { north: 'north-feed', south: 'south-feed' }, label: 'Clinic staff', x: 10, y: 5 },
    ambush: { turn: 3, label: 'Clinic reinforcements', enemies: [
      { id: 'clinic-service-pursuit', name: 'Service-door pursuit', x: 2, y: 13, hp: 5, maxHp: 5, damage: 2, range: 4, stride: 3 },
      { id: 'clinic-court-pursuit', name: 'Court pursuit', x: 21, y: 10, hp: 5, maxHp: 5, damage: 2, range: 4, stride: 3 }
    ] },
    mastery: 'Protect all six assaults without staff damage and extract all four engineers in fourteen turns or fewer.',
    debrief: 'The staff roll the last stretcher into the ambulance court. Sol keeps a copy of the clinic roster, and the market crews raise white lights above the wards. Mara traces the battery orders to the antenna tower. Disable that command signal in Antenna Rain before the occupation redirects its guns toward Floodworks.'
  };
  var antennaHeights = [];
  for (var antennaY = 3; antennaY <= 10; antennaY++) for (var antennaX = 10; antennaX <= 15; antennaX++) {
    antennaHeights.push({ x: antennaX, y: antennaY, z: 2 });
  }
  var antenna = {
    id: 'antenna-rain', title: 'Antenna Rain', district: 'Vertical Market', sequence: 8,
    briefing: 'The occupation antenna tower directs sweeping sniper lanes across the market approaches. North and south lanes alternate every enemy turn; each engineer ending a turn on the announced lane takes two damage, even behind low cover. The raised tower is above those lanes. Take the street service relay to open the west tower stair and ally its turret, or use the exposed north stair. Climb the tower and HACK its command node to silence both lanes permanently. Rescue the antenna technician, descend the east stair, and extract along the Floodworks access road.',
    radio: 'ROOK / NORTH sweeps first, then SOUTH, repeating. Read the marked lane before ending your turn. Service relay (5,11), west stair (9,7), open north stair (12,2), tower control (13,5), east descent (15,9). The tower terrace is safe from the sweeps.',
    objectiveSummary: 'Take the service relay, climb the tower to silence alternating firing lanes, rescue its technician and reach the Floodworks road.',
    extractionLabel: 'Floodworks access road',
    objectives: { requiredCircuits: ['antenna-service','tower'], rescueLabel: 'Rescue the antenna technician' },
    rows: [
      '########################',
      '#......................#',
      '#......................#',
      '#....c..c..............#',
      '#.....##...c..c..##....#',
      '#............n.........#',
      '#.....##..........##...#',
      '#..c......d.##.......c.#',
      '#...##......#....c.....#',
      '#......c...c..r........#',
      '#......................#',
      '#....n.............##..#',
      '#.......##..........eee#',
      '#..................ceee#',
      '#......................#',
      '########################'
    ],
    heights: antennaHeights, maxStepHeight: 0,
    climbLinks: [
      { from: { x: 9, y: 7 }, to: { x: 10, y: 7 } },
      { from: { x: 12, y: 2 }, to: { x: 12, y: 3 } },
      { from: { x: 15, y: 9 }, to: { x: 16, y: 9 } }
    ],
    stairs: [
      { label: 'West relay stair', x: 9, y: 7, toX: 10, toY: 7 },
      { label: 'North exposed stair', x: 12, y: 2, toX: 12, toY: 3 },
      { label: 'East descent', x: 15, y: 9, toX: 16, toY: 9 }
    ],
    squad: squad([[3,12],[3,13],[4,13],[5,13]]),
    enemies: [
      { id: 'antenna-relay-guard', name: 'Relay guard', x: 7, y: 11, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
      { id: 'antenna-controller', name: 'Tower controller', x: 14, y: 4, hp: 6, maxHp: 6, damage: 2, range: 6, stride: 2 },
      { id: 'antenna-keeper', name: 'Terrace enforcer', x: 13, y: 9, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 2 },
      { id: 'antenna-east-patrol', name: 'Road patrol', x: 18, y: 8, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 }
    ],
    turret: { x: 15, y: 6, range: 7, damage: 2 },
    node: { x: 5, y: 11 }, rescue: { x: 14, y: 9 },
    circuits: [
      { id: 'antenna-service', label: 'Tower stair relay / allied turret', x: 5, y: 11, controlled: false, doors: [{ x: 10, y: 7 }], turret: true },
      { id: 'tower', label: 'Antenna command silenced', x: 13, y: 5, controlled: false, doors: [] }
    ],
    lanes: { disabledBy: 'tower', damage: 2, patterns: [
      { label: 'North firing lane', tiles: [{"x":3,"y":5},{"x":4,"y":5},{"x":5,"y":5},{"x":6,"y":5},{"x":7,"y":5},{"x":8,"y":5},{"x":9,"y":5},{"x":16,"y":5},{"x":17,"y":5},{"x":18,"y":5},{"x":19,"y":5},{"x":20,"y":5}] },
      { label: 'South firing lane', tiles: [{"x":3,"y":10},{"x":4,"y":10},{"x":5,"y":10},{"x":6,"y":10},{"x":7,"y":10},{"x":8,"y":10},{"x":9,"y":10},{"x":16,"y":10},{"x":17,"y":10},{"x":18,"y":10},{"x":19,"y":10},{"x":20,"y":10}] }
    ] },
    mastery: 'Silence the antenna without taking lane damage and extract all four engineers in sixteen turns or fewer.',
    debrief: 'The sweeping sights go dark. Below the tower, clinic crews and freight operators restore the market routes together. The technician gives Mara a map of occupation pumps beneath the city. Follow the spillway into Floodworks: the sluice keeper is trapped beyond its flooded crossings.'
  };
  var sluice = {
    id: 'sluice-logic', title: 'Sluice Logic', district: 'Floodworks', sequence: 9,
    briefing: 'Floodworks is divided by a live spillway. The north and south drainage feeds share one pump: draining either three-square crossing floods the other immediately. HACK the north feed to expose the northern channel bed and ally the east-bank turret. Cross to rescue the sluice keeper, then bring engineers off that channel before HACKing the south feed. The east-bank towpath connects both crossings, so a split squad can regroup there or on the west bank. The interlock refuses to flood anyone or strand an engineer. South drainage restores the occupation turret; move onto the southern towpath beyond its range before switching. Secure the southern outlet after the rescue, then extract through the southeast maintenance gate. Flooded water blocks movement but does not stop gunfire.',
    radio: 'MARA / North drainage (7,4) first. Keeper (18,3), south drainage (7,11), outlet (18,11). Keep an engineer west to switch the pump. The dry towpath at x13 connects the east yards. Every engineer and hostile must be clear of the three old crossing squares before rerouting. There is no time limit: confirm the new route before committing.',
    objectiveSummary: 'Drain the north crossing, rescue the keeper, divert to the south crossing, capture the outlet and extract all surviving engineers.',
    extractionLabel: 'southeast maintenance gate',
    objectives: { requiredCircuits: ['outlet'], rescueLabel: 'Rescue the sluice keeper', rescueRequires: ['north-drain'] },
    rows: [
      '########################',
      '#.........www..........#',
      '#..###....www..####....#',
      '#.....c...www.....r....#',
      '#......n..www..c.......#',
      '#.........www......c...#',
      '#...c.....www..c.......#',
      '#.###.....www.##########',
      '#.........www..........#',
      '#.....c...www..c.......#',
      '#..##.....www.......c..#',
      '#......n..www.....n....#',
      '#...c.....www.......eee#',
      '#.........www.......eee#',
      '#.........www..........#',
      '########################'
    ],
    heights: [],
    squad: squad([[2,10],[2,11],[2,12],[3,12]]),
    enemies: [
      { id: 'sluice-inspector', name: 'Pump inspector', x: 6, y: 8, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
      { id: 'sluice-north-sentry', name: 'Spillway sentry', x: 16, y: 4, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 2 },
      { id: 'sluice-towpath-patrol', name: 'Towpath patrol', x: 17, y: 12, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
      { id: 'sluice-outlet-warden', name: 'Outlet warden', x: 20, y: 10, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 2 }
    ],
    turret: { x: 19, y: 5, range: 6, damage: 2 },
    node: { x: 7, y: 4 }, rescue: { x: 18, y: 3 },
    circuits: [
      { id: 'north-drain', label: 'Drain north crossing / allied turret', x: 7, y: 4, controlled: false, exclusiveGroup: 'sluice', doors: [], turret: true },
      { id: 'south-drain', label: 'Drain south crossing / hostile turret', x: 7, y: 11, controlled: false, exclusiveGroup: 'sluice', doors: [], requiresRescue: true },
      { id: 'outlet', label: 'Southern outlet secured', x: 18, y: 11, controlled: false, doors: [], requires: ['south-drain'] }
    ],
    water: { routes: [
      { circuitId: 'north-drain', label: 'North spillway crossing', tiles: [{ x: 10, y: 4 }, { x: 11, y: 4 }, { x: 12, y: 4 }] },
      { circuitId: 'south-drain', label: 'South spillway crossing', tiles: [{ x: 10, y: 11 }, { x: 11, y: 11 }, { x: 12, y: 11 }] }
    ] },
    mastery: 'Clear all four patrols, rescue the keeper and extract all four engineers in eighteen turns or fewer.',
    debrief: 'The keeper closes the overflow baffles as the last engineer reaches the maintenance gate. The clinic receives clean water, but the occupied river span still blocks the repair crews. Mara marks the next approach: capture the moving bridge in Span Control. The remaining eleven operations, including the Citadel finale, are still in development.'
  };
  var span = {
    id: 'span-control', title: 'Span Control', district: 'Floodworks', sequence: 10,
    briefing: 'Repair crews cannot cross the river until both bridge locks are ours. The transfer bridge is a movable two-by-two deck, not a permanent crossing. HACK the west drive to power it and ally the east-bank turret. MOVE onto the deck, then HACK the deck or either fixed console to ferry its riders across. You can travel before rescuing the keeper. On the east bank, rescue the bridge keeper and capture the bridgehead while the deck is docked east. Return the deck and an engineer west to release the mechanical lock; this opens the east maintenance gate. Recall the bridge from either bank as often as needed, ferry the remaining squad east, and extract through the gate. Counterattack teams arrive on both banks on turn five. Water blocks walking but not gunfire.',
    radio: 'MARA / Drive (5,10), west console (7,5), east console (16,5). Deck berths at (8,6) and (14,6), covering two-by-two squares. Keeper (21,4), east bridgehead (20,10), west lock (5,3), gate (20,12). Keep a clear landing for returning riders. HACK dispatch costs one AP and moves everyone aboard; fixed consoles also recall an empty deck.',
    objectiveSummary: 'Power and board the transfer bridge, rescue the east keeper, capture the east bridgehead, return west to release the lock, then ferry the squad east to extraction.',
    extractionLabel: 'east maintenance road',
    objectives: { requiredCircuits: ['span-drive','bridgehead','west-release'], rescueLabel: 'Rescue the bridge keeper' },
    rows: [
      '##########################',
      '#.......wwwwwwww.........#',
      '#.......wwwwwwww..##.....#',
      '#..##n..wwwwwwww.........#',
      '#.......wwwwwwww.c...r...#',
      '#...c..nwwwwwwwwn........#',
      '#.......wwwwwwww...c..##.#',
      '#.##....wwwwwwww.........#',
      '#.....c.wwwwwwww......c..#',
      '#.......wwwwwwww.##......#',
      '#.c..n..wwwwwwww....n....#',
      '#.......wwwwwwww..c......#',
      '#....c..wwwwwwww####d#####',
      '#.......wwwwwwww.......c.#',
      '#....##.wwwwwwww.........#',
      '#.......wwwwwwww....ceee.#',
      '#.......wwwwwwww.....eee.#',
      '##########################'
    ],
    heights: [],
    squad: squad([[2,11],[2,12],[3,12],[3,13]]),
    enemies: [
      { id: 'span-drive-guard', name: 'Drive-house guard', x: 4, y: 8, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 3 },
      { id: 'span-east-sentry', name: 'East berth sentry', x: 18, y: 6, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 2 },
      { id: 'span-keeper-guard', name: 'Keeper escort', x: 22, y: 3, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 2 },
      { id: 'span-lock-guard', name: 'Bridgehead controller', x: 22, y: 10, hp: 6, maxHp: 6, damage: 2, range: 5, stride: 2 }
    ],
    turret: { x: 20, y: 7, range: 6, damage: 2 },
    node: { x: 5, y: 10 }, rescue: { x: 21, y: 4 },
    circuits: [
      { id: 'span-drive', label: 'Bridge drive / allied turret', x: 5, y: 10, controlled: false, doors: [], turret: true },
      { id: 'bridgehead', label: 'East bridgehead captured', x: 20, y: 10, controlled: false, doors: [], requiresRescue: true, requiresLiftDock: 1 },
      { id: 'west-release', label: 'West mechanical lock / east gate', x: 5, y: 3, controlled: false, doors: [{ x: 20, y: 12 }], requires: ['bridgehead'], requiresRescue: true, requiresLiftDock: 0, requiresBridgeDelivery: true }
    ],
    lift: {
      kind: 'bridge', poweredBy: 'span-drive', requiresRescue: false, position: 0, size: 2, delivered: false,
      stops: [
        { x: 8, y: 6, z: 0, label: 'West bridge berth', console: { x: 7, y: 5 } },
        { x: 14, y: 6, z: 0, label: 'East bridge berth', console: { x: 16, y: 5 } }
      ]
    },
    ambush: { turn: 5, label: 'Bridge counterattack', enemies: [
      { id: 'span-west-counterattack', name: 'West lock raider', x: 2, y: 2, hp: 5, maxHp: 5, damage: 2, range: 4, stride: 3 },
      { id: 'span-east-counterattack', name: 'East berth raider', x: 24, y: 8, hp: 5, maxHp: 5, damage: 2, range: 4, stride: 3 }
    ] },
    mastery: 'Capture both bridge locks and extract all four engineers in twenty-four turns or fewer; keep every engineer standing during the return crossing.',
    debrief: 'The west lock releases and the bridge crew takes the controls. Repair teams cross behind the squad while Mara receives the keeper\'s access chart. The occupation has hidden its next relay in the dark pumping tunnels: Blackout will test light and visibility. Ten of twenty operations are playable; the Archive, Citadel and campaign ending remain in development.'
  };
  SB.Missions.operations = [opening, locked, feed, freight, rooftop, cargo, clinic, antenna, sluice, span];
  SB.Missions.get = function (id) {
    return SB.Missions.operations.find(function (mission) { return mission.id === id; }) || null;
  };
})(window);
