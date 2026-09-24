(function (root) {
  'use strict';
  const PW = root.PW = root.PW || {};

  // The campaign map is authored data, not a promise that every chapter is playable yet.
  // Keeping the route here gives content work one stable source of truth as regions land.
  const regions = [
    {
      id: 'tidal-abbey', number: 1, name: 'Tidal Abbey', epithet: 'The drowned cloister',
      route: 'sunken cloister -> sluice court -> bell tower -> abbey beacon',
      rooms: [{ id: 'cloister', name: 'Sunken Cloister' }, { id: 'sluice', name: 'Sluice Court' }, { id: 'shutters', name: 'Shutter Corridors' }, { id: 'bell-tower', name: 'Bell Tower' }, { id: 'beacon', name: 'Abbey Beacon' }, { id: 'sanctuary', name: 'Optional Sanctuary' }],
      links: [['cloister', 'sluice'], ['sluice', 'shutters'], ['shutters', 'bell-tower'], ['bell-tower', 'beacon'], ['sluice', 'sanctuary'], ['sanctuary', 'bell-tower']],
      challenges: [
        { id: 'A1', title: 'Sun Under Fire', mechanic: 'redirect a beam while a guard commits volleys', optional: 'sanctuary shortcut', guardian: 'Bell Diver' },
        { id: 'A2', title: 'Rising Sluice', mechanic: 'cross changing water cover while keeping a route lit', optional: 'floodgate release', guardian: 'Sluice Warden' },
        { id: 'A3', title: 'Shutter Escort', mechanic: 'escort Ilex through timed shutters and enemy fire', optional: 'keeper chart', guardian: 'Shutter Choir' },
        { id: 'A4', title: 'Split Bell Light', mechanic: 'divide one beam across the bell-tower route', optional: 'bell-rope shortcut', guardian: 'Twin Verger' },
        { id: 'A5', title: 'Bell Diver', mechanic: 'duel on dry ground that changes with the tide', optional: 'flooded archive', guardian: 'Bell Diver' }
      ],
      // Optional finds the results panel counts (main.js); the first missing hint is shown.
      discoveries: [
        { flag: 'lit:chapel', label: 'Chapel of Still Water', hint: 'the Chapel of Still Water lies south of the sluice' },
        { flag: 'chart', label: 'Keeper chart', hint: 'the keeper chart waits in the chapel' },
        { flag: 'pickup:abbey-heart', label: 'Tideglass heart', hint: 'the chapel reliquary opens in the font light' }
      ]
    },
    {
      id: 'verdant-aqueduct', number: 2, name: 'Verdant Aqueduct', epithet: 'The rootbound canals',
      route: 'abbey spillway -> rootbound pumphouse -> rotating channels -> ferryman quay -> hart reservoir (optional ferry landing shortcut)',
      rooms: [{ id: 'spillway', name: 'Abbey Spillway' }, { id: 'roots', name: 'Rootbound Pumphouse' }, { id: 'channels', name: 'Rotating Channels' }, { id: 'quay', name: 'Ferryman Quay' }, { id: 'reservoir', name: 'Hart Reservoir' }, { id: 'ferry', name: 'Ferry Landing' }],
      links: [['spillway', 'roots'], ['roots', 'channels'], ['channels', 'quay'], ['quay', 'reservoir'], ['quay', 'ferry'], ['ferry', 'reservoir']],
      challenges: [
        { id: 'B1', title: 'Prism on Root Bridges', mechanic: 'carry the placeable prism over sinking root bridges under turret fire and set it in the sunbeam so its light holds a gate open while you walk through', optional: 'ferry landing', guardian: 'Spillway Turret' },
        { id: 'B2', title: 'Irrigation Cut', mechanic: 'prism the sun down a thorn trench into a slow pump, slashing brambles as they regrow while a seed mortar lobs at you', optional: 'flank the pump mortar', guardian: 'Pump Mortar' },
        { id: 'B3', title: 'Rotating Seed Mortars', mechanic: 'three armoured mortars face the approach; flank them through a ring of channels that flood in rotation', optional: 'seed lens', guardian: 'Rampart Mortars' },
        { id: 'B4', title: 'Ferryman Rescue', mechanic: 'one-way levers route the water: seal the dam with light before the valve floats the skiff, or the ferry shortcut floods', optional: 'dry ferry shortcut', guardian: 'Quay Mortar' },
        { id: 'B5', title: 'Root Hart', mechanic: 'bait the hart\'s locked charge into timber dams; each broken dam floods dry ground', optional: 'seed lens', guardian: 'Root Hart' }
      ],
      discoveries: [
        { flag: 'dam-sealed', label: 'Dry ferry shortcut', hint: 'at the quay, light the sluice eye and pull the dam seal before the valve' },
        { flag: 'lens', label: 'Seed lens', hint: 'at the ferry landing, wedge the prism in the cut thorns' },
        { flag: 'pickup:ferry-heart', label: 'Ferry heart', hint: 'dash the long root east of the ferry stones' }
      ]
    },
    {
      id: 'glass-kiln', number: 3, name: 'Glass Kiln', epithet: 'The furnace below the tide',
      route: 'reservoir beacon -> furnace lanes -> annealed bridge -> cooling rail -> foundry locks -> Weaver arena',
      rooms: [{ id: 'furnace', name: 'Furnace Lanes' }, { id: 'bridge', name: 'Annealed Bridge' }, { id: 'rail', name: 'Cooling Rail' }, { id: 'foundry', name: 'Foundry Locks' }, { id: 'weaver', name: 'Glass Weaver Arena' }, { id: 'quench', name: 'Optional Quench Valve' }],
      links: [['furnace', 'bridge'], ['bridge', 'rail'], ['rail', 'foundry'], ['foundry', 'weaver'], ['furnace', 'quench'], ['quench', 'bridge']],
      challenges: [
        { id: 'C1', title: 'Alternating Furnace', mechanic: 'read heat pulses and cross the safe lane before it seals', optional: 'quench valve', guardian: 'Kiln Watch' },
        { id: 'C2', title: 'Annealed Bridge', mechanic: 'control heat to harden a temporary glass crossing', optional: 'artisan cache', guardian: 'Heatbound Mason' },
        { id: 'C3', title: 'Cooling Cart', mechanic: 'escort a cooling cart through crossfire and hot vents', optional: 'quench bypass', guardian: 'Cinder Porter' },
        { id: 'C4', title: 'Hot / Cold Locks', mechanic: 'route competing beams through foundry locks on opposite heat phases', optional: 'quenched vent route', guardian: 'Thermal Choir' },
        { id: 'C5', title: 'Glass Weaver', mechanic: 'fight the Weaver among cover that reforms with each kiln pulse', optional: 'Glass Edge attachment', guardian: 'Glass Weaver' }
      ],
      discoveries: [
        { flag: 'quench-valve', label: 'Quench valve spur', hint: 'the optional quench valve opens a dry return spur to the Annealed Bridge’s west bank' },
        { flag: 'kiln-edge', label: 'Glass Edge attachment', hint: 'a tempered attachment waits in the quench gallery' }
      ]
    },
    {
      id: 'night-observatory', number: 4, name: 'Night Observatory', epithet: 'The starless instrument',
      route: 'kiln lift -> star paths -> telescope bridges -> twin dome',
      rooms: [{ id: 'lift', name: 'Kiln Lift' }, { id: 'stars', name: 'Revealed Star Paths' }, { id: 'shutters', name: 'Moving Shutters' }, { id: 'bridges', name: 'Telescope Bridges' }, { id: 'dome', name: 'Twin Dome' }, { id: 'chart', name: 'Optional Sky Chart' }],
      links: [['lift', 'stars'], ['stars', 'shutters'], ['shutters', 'bridges'], ['bridges', 'dome'], ['stars', 'chart'], ['chart', 'bridges']],
      challenges: [
        { id: 'D1', title: 'Revealed Stars', mechanic: 'navigate paths visible only in brief light bursts', optional: 'sky chart', guardian: 'Observatory Shade' },
        { id: 'D2', title: 'Moving Shutters', mechanic: 'align mobile shutters under sniper pressure', optional: 'shutter key', guardian: 'Lens Sniper' },
        { id: 'D3', title: 'Split Shade', mechanic: 'redirect a pursuing shade through separated light', optional: 'liberated shade', guardian: 'Mirror Shade' },
        { id: 'D4', title: 'Rotating Telescope', mechanic: 'defend Ilex while telescope bridges rotate', optional: 'star map room', guardian: 'Telescope Choir' },
        { id: 'D5', title: 'Star Twins', mechanic: 'break two mutually shielding targets with linked beams', optional: 'dark lens cache', guardian: 'Star Twins' }
      ]
    },
    {
      id: 'drowned-crown', number: 5, name: 'Drowned Crown', epithet: 'The eclipse engine',
      route: 'observatory descent -> rotating galleries -> keeper circuit -> crown lens',
      rooms: [{ id: 'descent', name: 'Observatory Descent' }, { id: 'galleries', name: 'Rotating Galleries' }, { id: 'circuit', name: 'Keeper Circuit' }, { id: 'lighthouse', name: 'Moving Lighthouse' }, { id: 'crown', name: 'Crown Lens' }, { id: 'archive', name: 'Optional Keeper Archive' }],
      links: [['descent', 'galleries'], ['galleries', 'circuit'], ['circuit', 'lighthouse'], ['lighthouse', 'crown'], ['galleries', 'archive'], ['archive', 'circuit']],
      challenges: [
        { id: 'E1', title: 'Known Routes', mechanic: 'approach using the shortcuts and discoveries carried forward', optional: 'keeper archive', guardian: 'Crown Sentinels' },
        { id: 'E2', title: 'Rotating Galleries', mechanic: 'combine prism, polarity and stored light in moving rooms', optional: 'safe gallery', guardian: 'Gallery Warden' },
        { id: 'E3', title: 'Two Keeper Circuit', mechanic: 'rescue Nacre while holding separate circuits', optional: 'containment notes', guardian: 'Failing Containment' },
        { id: 'E4', title: 'Moving Lighthouse', mechanic: 'ascend lenses that change the safe route beneath you', optional: 'beacon route', guardian: 'Crown Ascendant' },
        { id: 'E5', title: 'Eclipse Keeper', mechanic: 'survive three phases and evacuate both keepers', optional: 'safe evacuation', guardian: 'Eclipse Keeper' }
      ]
    }
  ];

  const byId = Object.create(null);
  for (const region of regions) {
    byId[region.id] = region;
    for (const challenge of region.challenges) byId[challenge.id] = challenge;
  }

  PW.REGIONS = regions;
  PW.FIRST_PLAYABLE = {
    id: 'courtyard-checkpoint', regionId: 'tidal-abbey',
    label: 'Silent Courtyard', status: 'verified checkpoint',
    note: 'A1 pressure route is still ahead; this is the first playable slice.'
  };
  PW.regionById = id => byId[id] && byId[id].challenges ? byId[id] : null;
  PW.challengeById = id => byId[id] && byId[id].id === id && !byId[id].challenges ? byId[id] : null;
  PW.routeGraph = id => {
    const region = PW.regionById(id);
    if (!region) return null;
    const graph = Object.create(null);
    for (const room of region.rooms) graph[room.id] = [];
    for (const [from, to] of region.links) { graph[from].push(to); graph[to].push(from); }
    return graph;
  };
  PW.campaignContract = () => ({
    regions: regions.length,
    challenges: regions.reduce((total, region) => total + region.challenges.length, 0),
    firstPlayable: PW.FIRST_PLAYABLE.id,
    complete: false
  });

  // ---------------------------------------------------------------------------
  // Region 1 authored rooms (SPEC "Region 1 room engine contract", Sep22).
  // Every room is 1024x768; perimeter walls are split only where a doorway sits.
  // Exits live inside the doorway gap, always beyond any gate, and each exit's
  // spawn lands just inside the matching doorway of the destination room.
  // ---------------------------------------------------------------------------
  const W = 1024, H = 768;

  const cloister = {
    id: 'cloister', region: 'tidal-abbey', challenge: 'A1', name: 'Sunken Cloister', w: W, h: H,
    intro: 'Catch the sun on your mirror and hold it on the north seal while the wall turret hunts you: turn and return a shot to jam it, then aim.',
    spawn: { x: 190, y: 540 },
    // Courtyard geometry is preserved (index order too); only the east wall is split
    // for the door behind Ilex, and the extra piece is appended.
    walls: [
      { x: 24, y: 48, w: 24, h: 672 }, { x: 976, y: 48, w: 24, h: 48 },
      { x: 48, y: 48, w: 928, h: 32 }, { x: 48, y: 696, w: 928, h: 24 },
      { x: 700, y: 340, w: 24, h: 356 },
      { x: 325, y: 450, w: 90, h: 28 }, { x: 478, y: 210, w: 28, h: 66 },
      { x: 976, y: 176, w: 24, h: 544 }
    ],
    gates: [
      { id: 'cloister-gate', x: 700, y: 80, w: 24, h: 260, opensWhen: { receivers: ['gate'] },
        text: 'The cloister gate grinds open. The turret falls silent; the sentinel stirs.' },
      { id: 'cloister-door', x: 960, y: 96, w: 16, h: 80, opensWhen: { flag: 'ilex' },
        text: 'Ilex slides back the sluice-door bolt.' }
    ],
    emitters: [{ id: 'cloister-sun', x: 70, y: 340, dx: 1, dy: 0 }],
    receivers: [
      { id: 'gate', x: 550, y: 115, r: 19, kind: 'seal' },
      { id: 'sanctuary', x: 280, y: 620, r: 22, kind: 'sanctuary' }
    ],
    enemies: [
      { type: 'sentinel', id: 'abbey-sentinel', x: 845, y: 245, r: 27, hp: 6, wakeRadius: 210, wakeWhen: 'cloister-gate' },
      // Mounted on the west wall below the sun: every beam spot that reaches the seal is
      // in its sight and behind the raised mirror (verified), so you must jam it or take
      // the hit; the pillar and low wall shadow real cover just off the beam row.
      { type: 'turret', id: 'cloister-turret', x: 64, y: 496, r: 16, targets: 'player', interval: 2.6, delay: 4, until: 'cloister-gate' }
    ],
    rescue: { x: 914, y: 150, requires: ['abbey-sentinel'] },
    objectives: { seal: 'Light the north seal under fire', fight: 'Return its shots · strike the exposed sentinel', rescue: 'Free Ilex', exit: 'East door to the Sluice Court' },
    sanctuary: { x: 280, y: 620, r: 45, receiver: 'sanctuary' },
    exits: [{ id: 'to-sluice', x: 976, y: 96, w: 24, h: 80, to: 'sluice', spawn: { x: 84, y: 136 } }]
  };

  const sluice = {
    id: 'sluice', region: 'tidal-abbey', challenge: 'A2', name: 'Sluice Court', w: W, h: H,
    intro: 'The tide breathes: wade the lanes while they are shallow, shelter behind the risen stones, and from the island send the sun back to the seal behind you.',
    spawn: { x: 84, y: 136 },
    tide: { period: 10, offset: 3 },
    walls: [
      { x: 24, y: 48, w: 24, h: 48 }, { x: 24, y: 176, w: 24, h: 544 },
      { x: 976, y: 48, w: 24, h: 512 }, { x: 976, y: 640, w: 24, h: 80 },
      { x: 48, y: 48, w: 928, h: 32 },
      { x: 48, y: 696, w: 732, h: 24 }, { x: 860, y: 696, w: 116, h: 24 },
      // West bank: a buttress to shelter behind and a low wall that narrows the seal's sightline.
      { x: 180, y: 232, w: 44, h: 56 },
      { x: 160, y: 470, w: 96, h: 28 },
      // East bank: masonry around the exit and the chapel stair.
      { x: 776, y: 420, w: 120, h: 28 }
    ],
    gates: [{ id: 'sluice-gate', x: 952, y: 560, w: 24, h: 80, opensWhen: { receivers: ['sluice-seal'] },
      text: 'The sluice seal drinks the light; the east floodgate lifts and the turret stills.' }],
    emitters: [{ id: 'sluice-sun', x: 512, y: 92, dx: 0, dy: 1 }],
    receivers: [{ id: 'sluice-seal', x: 110, y: 628, r: 20, kind: 'seal' }],
    objectives: { seal: 'From the island, light the seal behind you', exit: 'East floodgate to the Shutter Corridors' },
    water: [
      { id: 'lane-west', x: 288, y: 80, w: 112, h: 616, when: 'high' },
      { id: 'lane-east', x: 624, y: 80, w: 112, h: 616, when: 'high' },
      { id: 'channel-north', x: 400, y: 80, w: 224, h: 112, when: 'high' },
      { id: 'channel-south', x: 400, y: 560, w: 224, h: 136, when: 'high' }
    ],
    breakwaters: [
      // Rises across the sunbeam at high tide: the island only receives light at low tide.
      { id: 'sun-weir', x: 488, y: 132, w: 48, h: 24, when: 'high' },
      { id: 'island-stone', x: 588, y: 300, w: 28, h: 120, when: 'high' },
      { id: 'bank-stone', x: 236, y: 380, w: 28, h: 110, when: 'high' }
    ],
    enemies: [
      { type: 'turret', id: 'sluice-turret', x: 952, y: 330, r: 16, targets: 'player', interval: 2.4, delay: 3, until: 'sluice-gate' }
    ],
    exits: [
      { id: 'to-cloister', x: 24, y: 96, w: 24, h: 80, to: 'cloister', spawn: { x: 936, y: 128 } },
      { id: 'to-shutters', x: 976, y: 560, w: 24, h: 80, to: 'shutters', spawn: { x: 84, y: 600 } },
      { id: 'to-sanctuary', x: 780, y: 696, w: 80, h: 24, to: 'sanctuary', spawn: { x: 820, y: 116 } }
    ]
  };

  const sanctuary = {
    id: 'sanctuary', region: 'tidal-abbey', challenge: null, name: 'Chapel of Still Water', w: W, h: H,
    intro: 'A quiet chapel: slash the lectern mirror to turn the light onto the font, then rest in its circle.',
    spawn: { x: 820, y: 116 },
    walls: [
      { x: 24, y: 48, w: 24, h: 672 },
      { x: 976, y: 48, w: 24, h: 332 }, { x: 976, y: 460, w: 24, h: 260 },
      { x: 48, y: 48, w: 732, h: 32 }, { x: 860, y: 48, w: 116, h: 32 },
      { x: 48, y: 696, w: 928, h: 24 },
      // Nave pillars and the reliquary alcove that holds the heart.
      { x: 300, y: 400, w: 32, h: 32 }, { x: 692, y: 400, w: 32, h: 32 },
      { x: 780, y: 540, w: 24, h: 76 }, { x: 780, y: 540, w: 196, h: 24 }
    ],
    gates: [{ id: 'reliquary', x: 780, y: 616, w: 24, h: 80, optional: true, opensWhen: { receivers: ['chapel'] },
      text: 'The reliquary grille lifts in the font light.' }],
    emitters: [{ id: 'chapel-sun', x: 60, y: 300, dx: 1, dy: 0 }],
    mirrors: [{ id: 'lectern-mirror', x: 512, y: 300, r: 16, split: false, dirs: [[1, 0], [0, 1]], index: 0 }],
    receivers: [{ id: 'chapel', x: 512, y: 600, r: 22, kind: 'sanctuary' }],
    sanctuary: { x: 512, y: 600, r: 48, receiver: 'chapel' },
    objectives: { seal: 'Turn the lectern mirror onto the font', exit: 'East stair to the Bell Tower' },
    pickups: [
      { id: 'keeper-chart', kind: 'chart', x: 150, y: 620, text: 'Keeper chart: the Bell Diver\'s armour seams. Returned shots expose it for longer.' },
      { id: 'abbey-heart', kind: 'heart', x: 900, y: 630, text: 'Tideglass heart: your maximum health rises by one.' }
    ],
    exits: [
      { id: 'to-sluice', x: 780, y: 48, w: 80, h: 32, to: 'sluice', spawn: { x: 820, y: 660 } },
      { id: 'to-bell-tower', x: 976, y: 380, w: 24, h: 80, to: 'bell-tower', spawn: { x: 948, y: 420 } }
    ]
  };

  const shutters = {
    id: 'shutters', region: 'tidal-abbey', challenge: 'A3', name: 'Shutter Corridors', w: W, h: H,
    intro: 'Stay close so Ilex keeps walking, read each shutter\'s rhythm, and put your mirror between her and the choir turrets.',
    spawn: { x: 84, y: 600 },
    walls: [
      { x: 24, y: 48, w: 24, h: 512 }, { x: 24, y: 640, w: 24, h: 80 },
      { x: 976, y: 48, w: 24, h: 48 }, { x: 976, y: 176, w: 24, h: 544 },
      { x: 48, y: 48, w: 928, h: 32 }, { x: 48, y: 696, w: 928, h: 24 },
      // Serpentine: lower hall runs east, middle hall west, upper hall east.
      { x: 48, y: 440, w: 760, h: 96 },
      { x: 216, y: 216, w: 760, h: 64 },
      // Choir alcove piers in the upper hall.
      { x: 560, y: 80, w: 40, h: 28 }
    ],
    gates: [{ id: 'shutter-gate', x: 952, y: 96, w: 24, h: 80, opensWhen: { flag: 'escorted' },
      text: 'Ilex throws the stair bolt. The choir falls silent.' }],
    shutters: [
      { id: 'shutter-1', x: 470, y: 536, w: 24, h: 160, period: 4, openFor: 2, offset: 0 },
      { id: 'shutter-2', x: 808, y: 476, w: 168, h: 24, period: 3, openFor: 1.5, offset: 1 },
      { id: 'shutter-3', x: 640, y: 280, w: 24, h: 160, period: 5, openFor: 2, offset: 0 },
      { id: 'shutter-4', x: 380, y: 280, w: 24, h: 160, period: 5, openFor: 2, offset: 2.5 },
      { id: 'shutter-5', x: 48, y: 236, w: 168, h: 24, period: 4.5, openFor: 1.5, offset: 0.3 },
      { id: 'shutter-6', x: 420, y: 80, w: 24, h: 136, period: 2.4, openFor: 1.2, offset: 0 },
      { id: 'shutter-7', x: 720, y: 80, w: 24, h: 136, period: 2.4, openFor: 1.2, offset: 1.2 }
    ],
    enemies: [
      // Lower hall teaches the job: a single choir behind Ilex; walk at her back, mirror up.
      { type: 'turret', id: 'choir-low', x: 64, y: 680, r: 16, targets: 'escort', interval: 2, delay: 4, until: 'shutter-gate' },
      // Middle hall crossfire: one choir ahead of Ilex, one behind her. Jam one, block the other.
      { type: 'turret', id: 'choir-west', x: 64, y: 360, r: 16, targets: 'escort', interval: 1.4, until: 'shutter-gate' },
      { type: 'turret', id: 'choir-rear', x: 952, y: 300, r: 16, targets: 'escort', interval: 1.4, until: 'shutter-gate' },
      // Upper hall: head-on down the corridor through open shutters, plus a rear choir
      // that fires through the alternate shutter while Ilex waits in a pocket.
      { type: 'turret', id: 'choir-east', x: 952, y: 200, r: 16, targets: 'escort', interval: 1.6, until: 'shutter-gate' },
      { type: 'turret', id: 'choir-high', x: 64, y: 100, r: 16, targets: 'escort', interval: 1.4, until: 'shutter-gate' }
    ],
    escort: { x: 150, y: 616, hp: 4, path: [[150, 616], [892, 616], [892, 360], [704, 360], [448, 360], [176, 360], [176, 148], [576, 148], [900, 148]] },
    escortExit: { x: 860, y: 96, w: 92, h: 110 },
    objectives: { escort: 'Keep Ilex close · shield her from the choir', exit: 'East stair to the Bell Tower' },
    exits: [
      { id: 'to-sluice', x: 24, y: 560, w: 24, h: 80, to: 'sluice', spawn: { x: 928, y: 600 } },
      { id: 'to-bell-tower', x: 976, y: 96, w: 24, h: 80, to: 'bell-tower', spawn: { x: 84, y: 136 } }
    ]
  };

  const bellTower = {
    id: 'bell-tower', region: 'tidal-abbey', challenge: 'A4', name: 'Bell Tower', w: W, h: H,
    intro: 'The lantern prism splits the sun in two: slash the tower mirrors until both bells beside the north door ring at once.',
    spawn: { x: 84, y: 136 },
    walls: [
      { x: 24, y: 48, w: 24, h: 48 }, { x: 24, y: 176, w: 24, h: 544 },
      { x: 976, y: 48, w: 24, h: 332 }, { x: 976, y: 460, w: 24, h: 260 },
      { x: 48, y: 48, w: 424, h: 32 }, { x: 552, y: 48, w: 424, h: 32 },
      { x: 48, y: 696, w: 928, h: 24 },
      // Bell niches either side of the north door: each bell hears only light rising straight up.
      { x: 320, y: 80, w: 24, h: 72 }, { x: 376, y: 80, w: 24, h: 72 },
      { x: 624, y: 80, w: 24, h: 72 }, { x: 680, y: 80, w: 24, h: 72 },
      // Lantern: the sun climbs a sealed shaft to the prism; only split light escapes.
      { x: 440, y: 520, w: 144, h: 52 }, { x: 440, y: 588, w: 64, h: 108 }, { x: 520, y: 588, w: 64, h: 108 },
      // Bell-rope vestibule behind the east grate (sanctuary shortcut).
      { x: 900, y: 356, w: 76, h: 24 }, { x: 900, y: 460, w: 76, h: 24 }
    ],
    gates: [
      { id: 'bell-gate', x: 472, y: 80, w: 80, h: 20, opensWhen: { receivers: ['bell-west', 'bell-east'] },
        text: 'Both bells ring as one. The beacon stair opens.' },
      { id: 'rope-gate', x: 900, y: 380, w: 20, h: 80, optional: true, opensWhen: { receivers: ['bell-west', 'bell-east'] },
        text: 'The bell-rope grate swings free: a shortcut down to the chapel.' }
    ],
    emitters: [{ id: 'tower-sun', x: 512, y: 684, dx: 0, dy: -1 }],
    mirrors: [
      { id: 'lantern-prism', x: 512, y: 580, r: 16, split: true, dirs: [[-1, 0], [1, 0]], index: 0 },
      { id: 'west-corner', x: 180, y: 580, r: 16, split: false, dirs: [[0, -1]], index: 0 },
      { id: 'east-corner', x: 844, y: 580, r: 16, split: false, dirs: [[0, -1]], index: 0 },
      { id: 'west-high', x: 180, y: 220, r: 16, split: false, dirs: [[0, -1], [-1, 0], [1, 0]], index: 0 },
      { id: 'east-high', x: 844, y: 300, r: 16, split: false, dirs: [[0, -1], [-1, 0], [1, 0]], index: 0 },
      { id: 'west-bell-mirror', x: 360, y: 300, r: 16, split: false, dirs: [[-1, 0], [0, 1], [0, -1]], index: 0 },
      { id: 'east-bell-mirror', x: 664, y: 220, r: 16, split: false, dirs: [[1, 0], [0, -1], [0, 1]], index: 0 }
    ],
    receivers: [
      { id: 'bell-west', x: 360, y: 112, r: 18, kind: 'bell' },
      { id: 'bell-east', x: 664, y: 112, r: 18, kind: 'bell' }
    ],
    objectives: { seal: 'Ring both bells at once', exit: 'North stair to the Abbey Beacon' },
    enemies: [
      { type: 'sentinel', id: 'verger', x: 512, y: 420, r: 27, hp: 6, wakeRadius: 190,
        patrol: [[300, 440], [724, 440], [724, 380], [300, 380]] }
    ],
    exits: [
      { id: 'to-shutters', x: 24, y: 96, w: 24, h: 80, to: 'shutters', spawn: { x: 928, y: 136 } },
      { id: 'to-beacon', x: 472, y: 48, w: 80, h: 32, to: 'beacon', spawn: { x: 512, y: 656 } },
      { id: 'to-sanctuary', x: 976, y: 380, w: 24, h: 80, to: 'sanctuary', spawn: { x: 920, y: 420 } }
    ]
  };

  const beacon = {
    id: 'beacon', region: 'tidal-abbey', challenge: 'A5', name: 'Abbey Beacon', w: W, h: H,
    intro: 'The Bell Diver hunts under the flood: keep to dry stone, dash its shockwave, return its bells, and strike when its armour opens.',
    spawn: { x: 512, y: 656 },
    tide: { period: 14, offset: 5 },
    walls: [
      { x: 24, y: 48, w: 24, h: 672 }, { x: 976, y: 48, w: 24, h: 672 },
      { x: 48, y: 48, w: 928, h: 32 },
      { x: 48, y: 696, w: 424, h: 24 }, { x: 552, y: 696, w: 424, h: 24 },
      // Drowned bell-frame piers at the corners of the flood ring.
      { x: 176, y: 192, w: 32, h: 32 }, { x: 816, y: 192, w: 32, h: 32 },
      { x: 176, y: 576, w: 32, h: 32 }, { x: 816, y: 576, w: 32, h: 32 }
    ],
    water: [
      { id: 'ring-north', x: 160, y: 176, w: 704, h: 112, when: 'high' },
      { id: 'ring-south', x: 160, y: 512, w: 704, h: 112, when: 'high' },
      { id: 'ring-west-upper', x: 160, y: 288, w: 208, h: 84, when: 'high' },
      { id: 'ring-west-lower', x: 160, y: 428, w: 208, h: 84, when: 'high' },
      { id: 'ring-east-upper', x: 656, y: 288, w: 208, h: 84, when: 'high' },
      { id: 'ring-east-lower', x: 656, y: 428, w: 208, h: 84, when: 'high' }
    ],
    breakwaters: [
      // Low-tide stones: cover from the bell volleys exactly when the Diver surfaces.
      { id: 'altar-stone-west', x: 408, y: 320, w: 36, h: 36, when: 'low' },
      { id: 'altar-stone-east', x: 580, y: 444, w: 36, h: 36, when: 'low' },
      { id: 'rim-stone-west', x: 76, y: 470, w: 48, h: 36, when: 'low' },
      { id: 'rim-stone-east', x: 900, y: 294, w: 48, h: 36, when: 'low' },
      // High-tide pilings flank the beacon approach.
      { id: 'piling-west', x: 420, y: 208, w: 28, h: 48, when: 'high' },
      { id: 'piling-east', x: 576, y: 208, w: 28, h: 48, when: 'high' }
    ],
    enemies: [{ type: 'diver', id: 'bell-diver', x: 512, y: 400, r: 30, hp: 10 }],
    // Lighting the abbey beacon clears Region 1 and hands the warden on to the aqueduct.
    beacon: { x: 512, y: 120, requires: ['bell-diver'], next: { room: 'spillway', spawn: { x: 110, y: 420 } } },
    objectives: { beacon: 'Reach the kindled beacon' },
    exits: [{ id: 'to-bell-tower', x: 472, y: 696, w: 80, h: 24, to: 'bell-tower', spawn: { x: 512, y: 120 } }]
  };

  // ---------------------------------------------------------------------------
  // Region 2 authored rooms (SPEC "Region 2 engine contract", Sep22 evening).
  // Entered one-way from the abbey beacon; inside the region every exit has a
  // matching way back. Water `when` flags come from levers ('valve',
  // 'dam-sealed'), latched receivers ('lit:<id>') and broken dams ('dam:<id>').
  // ---------------------------------------------------------------------------

  // B1: the prism is the only thing that can hold the gate. The sun falls on one
  // small islet strip; the seal it must reach is by the far wall and the hold gate
  // is 500 units away, so a mirror held by hand drops the gate before you arrive.
  const spillway = {
    id: 'spillway', region: 'verdant-aqueduct', challenge: 'B1', name: 'Abbey Spillway', w: W, h: H,
    intro: 'Cut into the bramble nook for the keeper\'s prism, cross the root bridges without stopping — they sink under a standing weight — and set the prism in the islet sunbeam. Only its light can hold the east gate open while you walk through.',
    spawn: { x: 110, y: 420 },
    walls: [
      { x: 24, y: 48, w: 24, h: 672 },
      { x: 976, y: 48, w: 24, h: 512 }, { x: 976, y: 640, w: 24, h: 80 },
      { x: 48, y: 48, w: 928, h: 32 }, { x: 48, y: 696, w: 928, h: 24 },
      // Bramble nook where the prism rests (its mouth is a one-time bramble).
      { x: 200, y: 80, w: 20, h: 140 }, { x: 48, y: 200, w: 92, h: 20 },
      // Spill pier: the sunbeam ends on it, so the prism only catches the sun on the
      // narrow strip north of the pier (its light then always lines up with the seal).
      { x: 492, y: 376, w: 36, h: 44 },
      // Gatehouse vestibule in the south-east corner.
      { x: 880, y: 516, w: 96, h: 24 }
    ],
    gates: [{ id: 'spill-gate', x: 880, y: 540, w: 20, h: 156, hold: true, opensWhen: { receivers: ['spill-seal'] },
      text: 'The spill gate lifts while the prism light holds. Go now!' }],
    growth: [{ id: 'nook-bramble', x: 140, y: 200, w: 60, h: 20, regrow: 0 }],
    pickups: [{ id: 'spill-prism', kind: 'prism', x: 120, y: 140,
      text: 'The keeper\'s prism! PRISM (Q) sets it where you aim; slash it to turn its light; press PRISM beside it to lift it.' }],
    emitters: [{ id: 'spill-sun', x: 510, y: 92, dx: 0, dy: 1 }],
    receivers: [{ id: 'spill-seal', x: 950, y: 346, r: 24, kind: 'seal', latch: false }],
    water: [
      { id: 'canal-west', x: 300, y: 80, w: 140, h: 616, when: 'always' },
      { id: 'canal-north', x: 440, y: 80, w: 140, h: 250, when: 'always' },
      { id: 'canal-south', x: 440, y: 470, w: 140, h: 226, when: 'always' },
      { id: 'canal-east', x: 580, y: 80, w: 160, h: 616, when: 'always' }
    ],
    bridges: [
      { id: 'root-west', x: 300, y: 420, w: 140, h: 44, hold: 1.0, recover: 2.5 },
      { id: 'root-east', x: 580, y: 420, w: 160, h: 44, hold: 1.1, recover: 2.5 }
    ],
    enemies: [
      // Covers both bridges and the islet: reflecting slows you to a crawl, and a
      // crawl sinks the roots, so cross between volleys or return one to jam it.
      { type: 'turret', id: 'spill-turret', x: 948, y: 150, r: 16, targets: 'player', interval: 2.8, delay: 1.6, until: 'spill-gate' }
    ],
    clearWhen: { gate: 'spill-gate' },
    objectives: { seal: 'Take the prism to the islet sunbeam · turn it onto the east seal', exit: 'Walk through the held gate to the pumphouse' },
    exits: [{ id: 'to-roots', x: 976, y: 560, w: 24, h: 80, to: 'roots', spawn: { x: 84, y: 600 } }]
  };

  // B2: the pump fills only while lit and never drains. Three bramble hedges stand
  // across the prism's light and regrow; they are too far apart for one slash or
  // one body to hold, so the circuit is kept alive by running the trench.
  const roots = {
    id: 'roots', region: 'verdant-aqueduct', challenge: 'B2', name: 'Rootbound Pumphouse', w: W, h: H,
    intro: 'The pump drinks light slowly. Set the prism in the cistern sunbeam and turn it east down the thorn trench, then slash the brambles as they grow back so the pump keeps filling. Keep moving: the mortar lobs seeds where you stand.',
    spawn: { x: 84, y: 600 },
    walls: [
      { x: 24, y: 48, w: 24, h: 512 }, { x: 24, y: 640, w: 24, h: 80 },
      { x: 976, y: 48, w: 24, h: 512 }, { x: 976, y: 640, w: 24, h: 80 },
      { x: 48, y: 48, w: 928, h: 32 }, { x: 48, y: 696, w: 928, h: 24 },
      // Sun step below the cistern: the sunbeam stops here, so the prism sits just above it.
      { x: 130, y: 340, w: 60, h: 32 },
      // Pump nook.
      { x: 900, y: 240, w: 76, h: 24 }, { x: 900, y: 356, w: 76, h: 24 },
      // Lock wall above the flooded east lock.
      { x: 800, y: 496, w: 176, h: 24 }
    ],
    emitters: [{ id: 'cistern-sun', x: 160, y: 92, dx: 0, dy: 1 }],
    receivers: [{ id: 'roots-pump', x: 936, y: 308, r: 24, kind: 'pump', fill: 8 }],
    growth: [
      { id: 'thorn-west', x: 360, y: 236, w: 32, h: 144, regrow: 4.5 },
      { id: 'thorn-mid', x: 560, y: 236, w: 32, h: 144, regrow: 4.5 },
      { id: 'thorn-east', x: 760, y: 236, w: 32, h: 144, regrow: 4.5 }
    ],
    water: [
      { id: 'cistern', x: 100, y: 80, w: 120, h: 210, when: 'always' },
      { id: 'east-lock', x: 800, y: 520, w: 176, h: 176, when: { notFlag: 'lit:roots-pump' } }
    ],
    gates: [{ id: 'lock-gate', x: 952, y: 560, w: 24, h: 80, opensWhen: { receivers: ['roots-pump'] },
      text: 'The pump is full: water surges up the aqueduct, the east lock drains and its gate swings open.' }],
    enemies: [
      // Plate faces the trench; flanking it from the south is optional (+200).
      { type: 'mortar', id: 'pump-mortar', x: 560, y: 560, r: 20, facing: [0, -1], hp: 2, interval: 3.0, delay: 2.5, range: 560 }
    ],
    clearWhen: { receivers: ['roots-pump'] },
    objectives: { seal: 'Fill the pump · keep the thorn trench cut', exit: 'East lock to the Rotating Channels' },
    exits: [
      { id: 'to-spillway', x: 24, y: 560, w: 24, h: 80, to: 'spillway', spawn: { x: 940, y: 600 } },
      { id: 'to-channels', x: 976, y: 560, w: 24, h: 80, to: 'channels', spawn: { x: 84, y: 384 } }
    ]
  };

  // B3: a rampart with three mortars set into it, plates facing the entry field.
  // Behind it the ring of channels floods one segment after another (north lane,
  // north bay, mid bay, south bay, south lane), so the dry way round moves.
  const RING = { period: 10, onFor: 3.5 };
  const channels = {
    id: 'channels', region: 'verdant-aqueduct', challenge: 'B3', name: 'Rotating Channels', w: W, h: H,
    intro: 'Three seed mortars face you, and their bark plates turn any blade. The channels flood one after another around the ring: follow the draining water behind the rampart and strike each mortar from the back.',
    spawn: { x: 84, y: 384 },
    walls: [
      { x: 24, y: 48, w: 24, h: 296 }, { x: 24, y: 424, w: 24, h: 296 },
      { x: 976, y: 48, w: 24, h: 296 }, { x: 976, y: 424, w: 24, h: 296 },
      { x: 48, y: 48, w: 928, h: 32 }, { x: 48, y: 696, w: 928, h: 24 },
      // Banks that wall the entry field off from the two lanes.
      { x: 260, y: 176, w: 420, h: 24 }, { x: 260, y: 568, w: 420, h: 24 },
      // Rampart: each mortar plugs a gap, plate facing west.
      { x: 640, y: 200, w: 40, h: 26 }, { x: 640, y: 274, w: 40, h: 86 },
      { x: 640, y: 408, w: 40, h: 86 }, { x: 640, y: 542, w: 40, h: 26 },
      // Bay walls behind the rampart; only a narrow towpath links the bays.
      { x: 720, y: 300, w: 256, h: 20 }, { x: 720, y: 448, w: 256, h: 20 }
    ],
    water: [
      // offset = period - 2k: segment k floods during [2k, 2k+3.5) of every 10s.
      { id: 'north-lane', x: 300, y: 80, w: 380, h: 96, when: 'cycle', period: RING.period, onFor: RING.onFor, offset: 0 },
      { id: 'north-bay', x: 680, y: 80, w: 296, h: 220, when: 'cycle', period: RING.period, onFor: RING.onFor, offset: 8 },
      { id: 'mid-bay', x: 680, y: 300, w: 296, h: 168, when: 'cycle', period: RING.period, onFor: RING.onFor, offset: 6 },
      { id: 'south-bay', x: 680, y: 468, w: 296, h: 228, when: 'cycle', period: RING.period, onFor: RING.onFor, offset: 4 },
      { id: 'south-lane', x: 300, y: 592, w: 380, h: 104, when: 'cycle', period: RING.period, onFor: RING.onFor, offset: 2 }
    ],
    enemies: [
      { type: 'mortar', id: 'mortar-north', x: 660, y: 250, r: 20, facing: [-1, 0], hp: 2, interval: 2.8, delay: 1.2, range: 560 },
      { type: 'mortar', id: 'mortar-mid', x: 660, y: 384, r: 20, facing: [-1, 0], hp: 2, interval: 2.8, delay: 2.1, range: 560 },
      { type: 'mortar', id: 'mortar-south', x: 660, y: 518, r: 20, facing: [-1, 0], hp: 2, interval: 2.8, delay: 3.0, range: 560 }
    ],
    gates: [{ id: 'channel-gate', x: 952, y: 344, w: 24, h: 80, opensWhen: { defeated: ['mortar-north', 'mortar-mid', 'mortar-south'] },
      text: 'The last mortar splits. The channel gate lifts toward the quay.' }],
    clearWhen: { defeated: ['mortar-north', 'mortar-mid', 'mortar-south'] },
    objectives: { fight: 'Flank the mortars · follow the draining channels behind them', gate: 'East gate to the Ferryman Quay', exit: 'East gate to the Ferryman Quay' },
    exits: [
      { id: 'to-roots', x: 24, y: 344, w: 24, h: 80, to: 'roots', spawn: { x: 930, y: 600 } },
      { id: 'to-quay', x: 976, y: 344, w: 24, h: 80, to: 'quay', spawn: { x: 84, y: 384 } }
    ]
  };

  // B4: the choice is one of order. The valve must be pulled to float the skiff,
  // and it floods the low quay (where the only sun spot is) for good. The shortcut
  // south to the ferry landing stays dry only if the dam seal went down first.
  const quay = {
    id: 'quay', region: 'verdant-aqueduct', challenge: 'B4', name: 'Ferryman Quay', w: W, h: H,
    intro: 'The ferrymen are stranded on the sandbar. The valve lever floats their skiff, but it floods the low quay, and the south shortcut to the ferry landing too unless the dam seal is already down. Light the sluice eye to reach the seal lever, or go straight for the valve.',
    spawn: { x: 84, y: 384 },
    walls: [
      { x: 24, y: 48, w: 24, h: 296 }, { x: 24, y: 424, w: 24, h: 296 },
      { x: 976, y: 48, w: 24, h: 296 }, { x: 976, y: 424, w: 24, h: 296 },
      { x: 48, y: 48, w: 928, h: 32 },
      { x: 48, y: 696, w: 424, h: 24 }, { x: 552, y: 696, w: 424, h: 24 },
      // Seal-lever alcove behind its grille.
      { x: 48, y: 414, w: 88, h: 16 }, { x: 48, y: 510, w: 88, h: 16 },
      // Sump stone: the low-quay sunbeam ends here, so only a short dry strip catches it.
      { x: 200, y: 590, w: 36, h: 40 },
      // Crate stack (cover from the mortar's line of approach).
      { x: 320, y: 340, w: 56, h: 40 }
    ],
    gates: [
      { id: 'skiff-boom', x: 572, y: 280, w: 56, h: 16, opensWhen: { flag: 'valve' },
        text: 'The valve roars open: the canal lifts the skiff free, its boom swings aside, and the low quay floods.' },
      { id: 'seal-grille', x: 120, y: 430, w: 16, h: 80, optional: true, opensWhen: { receivers: ['sluice-eye'] },
        text: 'The sluice eye drinks the light and its grille lifts: the dam-seal lever is within reach.' },
      // Both open the moment the ferrymen are free; the last text is the one that shows.
      { id: 'landing-gate', x: 472, y: 680, w: 80, h: 16, opensWhen: { flag: 'ferrymen' },
        text: 'The ferrymen unbar the landing stair.' },
      { id: 'quay-lock', x: 952, y: 344, w: 24, h: 80, opensWhen: { flag: 'ferrymen' },
        text: 'The ferrymen are free! They crank the east lock open and unbar the stair south to their landing.' }
    ],
    emitters: [{ id: 'quay-sun', x: 60, y: 610, dx: 1, dy: 0 }],
    receivers: [{ id: 'sluice-eye', x: 168, y: 470, r: 24, kind: 'seal' }],
    levers: [
      { id: 'seal-lever', x: 80, y: 470, flag: 'dam-sealed', text: 'The dam seal drops. When the valve opens, the south shortcut will stay dry.' },
      { id: 'valve-lever', x: 880, y: 320, flag: 'valve', text: 'The valve roars open: the canal lifts the skiff free and the low quay floods.' }
    ],
    water: [
      { id: 'canal-west', x: 48, y: 80, w: 472, h: 200, when: 'always' },
      { id: 'canal-east', x: 680, y: 80, w: 296, h: 200, when: 'always' },
      { id: 'canal-north', x: 520, y: 80, w: 160, h: 50, when: 'always' },
      { id: 'canal-south', x: 520, y: 220, w: 160, h: 60, when: 'always' },
      { id: 'sump', x: 48, y: 580, w: 102, h: 60, when: 'always' },
      { id: 'low-quay', x: 48, y: 540, w: 352, h: 156, when: { flag: 'valve' } },
      { id: 'shortcut-flood', x: 400, y: 470, w: 240, h: 226, when: { flag: 'valve', notFlag: 'dam-sealed' } }
    ],
    // The skiff: a mooring plank that sinks if you dawdle on it.
    bridges: [{ id: 'skiff', x: 580, y: 220, w: 40, h: 60, hold: 1.5, recover: 2 }],
    enemies: [
      { type: 'mortar', id: 'quay-mortar', x: 760, y: 520, r: 20, facing: [-1, 0], hp: 2, interval: 3.0, delay: 3, range: 520 }
    ],
    rescue: { x: 600, y: 172, requires: [], flag: 'ferrymen', requiresFlag: 'valve' },
    clearWhen: { rescue: true },
    objectives: { route: 'Pull the valve lever to float the skiff', rescue: 'Take the skiff to the ferrymen', gate: 'East lock to the Hart Reservoir · south to the ferry landing', exit: 'East lock to the Hart Reservoir · south to the ferry landing' },
    exits: [
      { id: 'to-channels', x: 24, y: 344, w: 24, h: 80, to: 'channels', spawn: { x: 930, y: 384 } },
      { id: 'to-reservoir', x: 976, y: 344, w: 24, h: 80, to: 'reservoir', spawn: { x: 84, y: 384 } },
      { id: 'to-ferry', x: 472, y: 696, w: 80, h: 24, to: 'ferry', spawn: { x: 512, y: 116 } }
    ]
  };

  // Optional: two short puzzles and the discoveries that change B5. The sun chute
  // is too narrow to hold the prism and the canal takes it below, so the only spot
  // that catches the light is inside the cut thorns, where it also stops the regrowth.
  // The lens eye sits on the stone bank west of the thorns; the grille it holds is
  // across the landing, so the prism (not a hand-held mirror) must keep it lit.
  const ferry = {
    id: 'ferry', region: 'verdant-aqueduct', challenge: null, name: 'Ferry Landing', w: W, h: H,
    intro: 'The ferrymen\'s landing. Ferry stones sink if you stand on them; dash the long root for the heart. Cut the thorns under the sun chute and wedge the prism in the gap, turned to the eye in the west bank: it holds the thorns back, and its light holds the lens grille open.',
    spawn: { x: 512, y: 116 },
    walls: [
      { x: 24, y: 48, w: 24, h: 672 },
      { x: 976, y: 48, w: 24, h: 512 }, { x: 976, y: 640, w: 24, h: 80 },
      { x: 48, y: 48, w: 424, h: 32 }, { x: 552, y: 48, w: 424, h: 32 },
      { x: 48, y: 696, w: 928, h: 24 },
      // Stone west bank (the lens eye is set in its face) and the sun chute.
      { x: 48, y: 80, w: 102, h: 220 },
      { x: 150, y: 80, w: 38, h: 160 }, { x: 212, y: 80, w: 28, h: 160 },
      // Lens vault.
      { x: 780, y: 80, w: 20, h: 80 }, { x: 780, y: 240, w: 196, h: 20 }
    ],
    emitters: [{ id: 'chute-sun', x: 200, y: 92, dx: 0, dy: 1 }],
    growth: [{ id: 'chute-thorns', x: 150, y: 240, w: 100, h: 60, regrow: 3 }],
    receivers: [{ id: 'lens-eye', x: 150, y: 270, r: 24, kind: 'seal', latch: false }],
    gates: [
      { id: 'lens-grille', x: 780, y: 160, w: 20, h: 80, hold: true, optional: true, opensWhen: { receivers: ['lens-eye'] },
        text: 'The lens grille rises while the light holds.' }
    ],
    pickups: [
      { id: 'seed-lens', kind: 'lens', x: 900, y: 160, text: 'Seed lens: it shows the Root Hart\'s grain. A hart stunned by timber stays open longer.' },
      { id: 'ferry-heart', kind: 'heart', x: 866, y: 390, text: 'Ferry heart: your maximum health rises by one.' }
    ],
    water: [
      { id: 'landing-flood', x: 300, y: 80, w: 440, h: 220, when: { flag: 'valve', notFlag: 'dam-sealed' } },
      { id: 'canal-west', x: 48, y: 300, w: 472, h: 170, when: 'always' },
      { id: 'canal-north', x: 520, y: 300, w: 140, h: 80, when: 'always' },
      { id: 'canal-south', x: 520, y: 420, w: 140, h: 50, when: 'always' },
      { id: 'canal-mid', x: 660, y: 300, w: 160, h: 170, when: 'always' },
      { id: 'canal-heart-n', x: 820, y: 300, w: 80, h: 60, when: 'always' },
      { id: 'canal-heart-s', x: 820, y: 420, w: 80, h: 50, when: 'always' },
      { id: 'canal-east', x: 900, y: 300, w: 76, h: 170, when: 'always' }
    ],
    bridges: [
      { id: 'ferry-stone-north', x: 570, y: 300, w: 40, h: 80, hold: 0.8, recover: 2 },
      { id: 'ferry-stone-south', x: 570, y: 420, w: 40, h: 50, hold: 0.8, recover: 2 },
      // Too long to walk before it sinks: dash across.
      { id: 'heart-root', x: 660, y: 384, w: 160, h: 32, hold: 0.75, recover: 2.5 }
    ],
    objectives: { exit: 'East pier to the Hart Reservoir' },
    exits: [
      { id: 'to-quay', x: 472, y: 48, w: 80, h: 32, to: 'quay', spawn: { x: 512, y: 656 } },
      { id: 'to-reservoir', x: 976, y: 560, w: 24, h: 80, to: 'reservoir', spawn: { x: 512, y: 656 } }
    ]
  };

  // B5: three timber dams hold back the reservoir. Each one takes two charges;
  // every broken dam floods the ground in front of it, so the dry arena shrinks
  // and the remaining dams sit in their own dry pockets. Stone only dazes.
  const reservoir = {
    id: 'reservoir', region: 'verdant-aqueduct', challenge: 'B5', name: 'Hart Reservoir', w: W, h: H,
    intro: 'The Root Hart guards the last beacon. Stand before a timber dam, let the hart lock its charge, then step aside: antlers in timber leave it stunned for your blade. Each broken dam floods the ground around it.',
    spawn: { x: 84, y: 384 },
    walls: [
      { x: 24, y: 48, w: 24, h: 296 }, { x: 24, y: 424, w: 24, h: 296 },
      { x: 976, y: 48, w: 24, h: 672 },
      { x: 48, y: 48, w: 928, h: 32 },
      { x: 48, y: 696, w: 424, h: 24 }, { x: 552, y: 696, w: 424, h: 24 },
      // Beacon alcove.
      { x: 400, y: 80, w: 24, h: 140 }, { x: 600, y: 80, w: 24, h: 140 },
      // South-east pool wall.
      { x: 824, y: 416, w: 152, h: 24 },
      // Stone pillars: baiting a charge into these only dazes the hart.
      { x: 250, y: 470, w: 40, h: 40 }, { x: 560, y: 560, w: 40, h: 40 }
    ],
    dams: [
      { id: 'dam-nw', x: 48, y: 196, w: 352, h: 24, hp: 2 },
      { id: 'dam-ne', x: 624, y: 196, w: 352, h: 24, hp: 2 },
      { id: 'dam-se', x: 800, y: 440, w: 24, h: 256, hp: 2 }
    ],
    water: [
      { id: 'pool-nw', x: 48, y: 80, w: 352, h: 116, when: 'always' },
      { id: 'pool-ne', x: 624, y: 80, w: 352, h: 116, when: 'always' },
      { id: 'pool-se', x: 824, y: 440, w: 152, h: 256, when: 'always' },
      { id: 'flood-nw', x: 48, y: 220, w: 352, h: 110, when: { flag: 'dam:dam-nw' } },
      { id: 'flood-ne', x: 624, y: 220, w: 352, h: 110, when: { flag: 'dam:dam-ne' } },
      { id: 'flood-se', x: 690, y: 440, w: 110, h: 256, when: { flag: 'dam:dam-se' } }
    ],
    enemies: [{ type: 'hart', id: 'root-hart', x: 540, y: 260, r: 34, hp: 8, wakeRadius: 380 }],
    beacon: { x: 512, y: 130, requires: ['root-hart'], next: { room: 'furnace', spawn: { x: 84, y: 384 } },
      text: 'The reservoir beacon steadies. Beyond it, the Glass Kiln breathes beneath the tide.' },
    objectives: { approach: 'Approach the Root Hart', beacon: 'Reach the reservoir beacon' },
    exits: [
      { id: 'to-quay', x: 24, y: 344, w: 24, h: 80, to: 'quay', spawn: { x: 930, y: 384 } },
      { id: 'to-ferry', x: 472, y: 696, w: 80, h: 24, to: 'ferry', spawn: { x: 930, y: 600 } }
    ]
  };

  // ---------------------------------------------------------------------------
  // Region 3 authored rooms. Heat is one deterministic room clock; each glass
  // patch says which half of that cycle it occupies. C1's broken divider makes
  // the intended route alternate upper/lower/upper (or lower/upper/lower).
  // ---------------------------------------------------------------------------
  const furnace = {
    id: 'furnace', region: 'glass-kiln', challenge: 'C1', name: 'Furnace Lanes', w: W, h: H,
    intro: 'Read the kiln pulse. The safe lane switches sides at the broken divider: in heat, take the lower west lane then the upper east lane; in cooling, reverse them. Return the Kiln Watch’s shots to open the east lock.',
    spawn: { x: 84, y: 384 },
    thermal: { period: 8, hotFor: 4, offset: 0 },
    walls: [
      { x: 24, y: 48, w: 24, h: 296 }, { x: 24, y: 424, w: 24, h: 296 },
      { x: 976, y: 48, w: 24, h: 296 }, { x: 976, y: 424, w: 24, h: 296 },
      { x: 48, y: 48, w: 928, h: 32 },
      { x: 48, y: 696, w: 424, h: 24 }, { x: 552, y: 696, w: 424, h: 24 },
      // A broken spine: enter either lane, switch through its middle gap, reunite at the east.
      { x: 160, y: 340, w: 300, h: 88 }, { x: 564, y: 340, w: 340, h: 88 },
      { x: 300, y: 176, w: 52, h: 52 }, { x: 700, y: 540, w: 52, h: 52 }
    ],
    glass: [
      { id: 'west-upper-hot', x: 168, y: 164, w: 280, h: 168, mode: 'hazard', when: 'hot' },
      { id: 'west-lower-cold', x: 168, y: 436, w: 280, h: 168, mode: 'hazard', when: 'cold' },
      { id: 'east-upper-cold', x: 576, y: 164, w: 312, h: 168, mode: 'hazard', when: 'cold' },
      { id: 'east-lower-hot', x: 576, y: 436, w: 312, h: 168, mode: 'hazard', when: 'hot' }
    ],
    gates: [{ id: 'furnace-lock', x: 952, y: 344, w: 24, h: 80, opensWhen: { defeated: ['kiln-watch'] },
      text: 'The Kiln Watch cracks. The furnace lock lifts.' }],
    enemies: [{ type: 'sentinel', id: 'kiln-watch', x: 920, y: 300, r: 27, hp: 6, wakeRadius: 430 }],
    clearWhen: { defeated: ['kiln-watch'] },
    objectives: { fight: 'Read the alternating lanes · return the Kiln Watch’s shots', exit: 'East lock to the Annealed Bridge' },
    exits: [
      { id: 'to-bridge', x: 976, y: 344, w: 24, h: 80, to: 'bridge', spawn: { x: 84, y: 384 } },
      { id: 'to-quench', x: 472, y: 696, w: 80, h: 24, to: 'quench', spawn: { x: 512, y: 116 } }
    ]
  };

  // C2's cold glass anneals into a traversable span over the hot channel. A
  // Reflected cooling light releases the east pressure lock. The banks confine
  // the always-wet channel to this broad span; the optional quench return reaches
  // only a dry pocket on the west bank.
  const annealedBridge = {
    id: 'bridge', region: 'glass-kiln', challenge: 'C2', name: 'Annealed Bridge', w: W, h: H,
    intro: 'Turn the foundry mirror down to the cooling eye, then cross when the glass anneals cold. The span reheats on the next pulse; dash between the warning and the flare.',
    spawn: { x: 84, y: 384 },
    thermal: { period: 10, hotFor: 5, offset: 1 },
    walls: [
      { x: 24, y: 48, w: 24, h: 296 }, { x: 24, y: 424, w: 24, h: 296 },
      { x: 976, y: 48, w: 24, h: 296 }, { x: 976, y: 424, w: 24, h: 296 },
      { x: 48, y: 48, w: 928, h: 32 },
      { x: 48, y: 696, w: 424, h: 24 }, { x: 552, y: 696, w: 424, h: 24 },
      // Channel walls leave a 68px center lane, comfortably wider than the
      // player's diameter. The upper west notch reaches the cooling mirror; the
      // lower west notch reaches the quench pocket. Both end before the channel.
      { x: 48, y: 280, w: 160, h: 70 }, { x: 272, y: 280, w: 680, h: 70 },
      { x: 48, y: 418, w: 160, h: 70 }, { x: 272, y: 418, w: 680, h: 70 },
      // The west-bank notch reaches the cooling mirror but dead-ends at this
      // upper channel wall, so it cannot become a route around the cold span.
      { x: 328, y: 80, w: 368, h: 200 },
      { x: 328, y: 488, w: 368, h: 208 }
    ],
    water: [{ id: 'kiln-channel', x: 328, y: 320, w: 368, h: 128, when: 'always' }],
    glass: [
      { id: 'annealed-span', x: 328, y: 352, w: 368, h: 64, mode: 'bridge', when: 'cold' },
      { id: 'reheating-span', x: 328, y: 352, w: 368, h: 64, mode: 'hazard', when: 'hot' }
    ],
    emitters: [{ id: 'bridge-sun', x: 92, y: 240, dx: 1, dy: 0 }],
    mirrors: [{ id: 'cooling-mirror', x: 280, y: 240, r: 17, split: false, dirs: [[0, 1], [1, 0]], index: 1 }],
    receivers: [{ id: 'cooling-eye', x: 280, y: 270, r: 20, kind: 'seal', text: 'The cooling eye opens the pressure lock.' }],
    gates: [{ id: 'bridge-lock', x: 952, y: 344, w: 24, h: 80, opensWhen: { receivers: ['cooling-eye'] },
      text: 'The cooling eye holds. The foundry lock swings east.' }],
    clearWhen: { receivers: ['cooling-eye'] },
    objectives: { seal: 'Turn the mirror down to the cooling eye', exit: 'Cross the glass span during its cold window · east lock to the Cooling Rail' },
    exits: [
      { id: 'to-furnace', x: 24, y: 344, w: 24, h: 80, to: 'furnace', spawn: { x: 930, y: 384 } },
      { id: 'to-rail', x: 976, y: 344, w: 24, h: 80, to: 'rail', spawn: { x: 84, y: 384 } },
      { id: 'to-quench', x: 112, y: 528, w: 64, h: 64, to: 'quench', spawn: { x: 900, y: 600 } }
    ]
  };

  // C3 reuses the proven escort controller for a distinct load: the cooling cart
  // travels the exposed center rail while the player jams two crossfire turrets.
  const rail = {
    id: 'rail', region: 'glass-kiln', challenge: 'C3', name: 'Cooling Rail', w: W, h: H,
    intro: 'Keep within a short run of the cooling cart so it advances. Two turrets sight the rail from opposite banks: return their volleys to jam them, keep the cart moving, and screen its exposed center track.',
    spawn: { x: 84, y: 384 },
    thermal: { period: 12, hotFor: 6, offset: 2 },
    walls: [
      { x: 24, y: 48, w: 24, h: 296 }, { x: 24, y: 424, w: 24, h: 296 },
      { x: 976, y: 48, w: 24, h: 296 }, { x: 976, y: 424, w: 24, h: 296 },
      { x: 48, y: 48, w: 928, h: 32 },
      { x: 48, y: 696, w: 928, h: 24 },
      // Two loading alcoves protect the player from the rail's alternating vent fields.
      { x: 272, y: 276, w: 48, h: 48 }, { x: 704, y: 444, w: 48, h: 48 }
    ],
    glass: [
      { id: 'north-vent', x: 196, y: 112, w: 650, h: 128, mode: 'hazard', when: 'hot' },
      { id: 'south-vent', x: 196, y: 528, w: 650, h: 128, mode: 'hazard', when: 'cold' }
    ],
    enemies: [
      { type: 'turret', id: 'rail-turret-north', x: 420, y: 260, r: 16, targets: 'escort', interval: 2.6, delay: 2.4 },
      { type: 'turret', id: 'rail-turret-south', x: 700, y: 508, r: 16, targets: 'escort', interval: 2.6, delay: 3.7 }
    ],
    escort: { name: 'Cooling Cart', x: 132, y: 384, hp: 5, flag: 'cart-delivered',
      text: 'The cooling cart reaches the foundry rail. Its chilled reservoir stabilizes the locks.',
      path: [[260, 384], [410, 384], [560, 384], [710, 384], [900, 384]] },
    escortExit: { x: 876, y: 344, w: 72, h: 80 },
    gates: [{ id: 'rail-lock', x: 952, y: 344, w: 24, h: 80, opensWhen: { flag: 'cart-delivered' },
      text: 'The cart reaches the switch. The foundry lock lifts.' }],
    clearWhen: { escort: true },
    objectives: { escort: 'Stay near the cart · return the turrets’ shots · keep it on the rail', exit: 'East lock to the Foundry Locks' },
    exits: [
      { id: 'to-bridge', x: 24, y: 344, w: 24, h: 80, to: 'bridge', spawn: { x: 930, y: 384 } },
      { id: 'to-foundry', x: 976, y: 344, w: 24, h: 80, to: 'foundry', spawn: { x: 84, y: 384 } }
    ]
  };

  // C4 makes two independently redirected rays depend on opposite halves of the
  // thermal clock. Each latched lock survives the phase change while the second
  // ray is routed, so the puzzle is timed in execution, not in arbitrary luck.
  const foundry = {
    id: 'foundry', region: 'glass-kiln', challenge: 'C4', name: 'Foundry Locks', w: W, h: H,
    intro: 'The hot lock accepts its ray only in heat; the cold lock only while the far screen cools clear. Slash each mirror toward its receiver in the matching phase. The first lock stays latched while you route the second.',
    spawn: { x: 84, y: 384 },
    thermal: { period: 12, hotFor: 6, offset: 0 },
    walls: [
      { x: 24, y: 48, w: 24, h: 296 }, { x: 24, y: 424, w: 24, h: 296 },
      { x: 976, y: 48, w: 24, h: 296 }, { x: 976, y: 424, w: 24, h: 296 },
      { x: 48, y: 48, w: 928, h: 32 }, { x: 48, y: 696, w: 928, h: 24 },
      // Dividing furnace wall leaves one guarded crossing between the two circuits.
      { x: 500, y: 80, w: 24, h: 264 }, { x: 500, y: 424, w: 24, h: 272 },
      { x: 276, y: 500, w: 44, h: 44 }, { x: 760, y: 220, w: 44, h: 44 }
    ],
    glass: [
      { id: 'hot-ray-screen', x: 208, y: 204, w: 28, h: 32, mode: 'solid', when: 'cold' },
      { id: 'cold-ray-screen', x: 816, y: 536, w: 28, h: 32, mode: 'solid', when: 'hot' }
    ],
    emitters: [
      { id: 'west-foundry-sun', x: 88, y: 220, dx: 1, dy: 0 },
      { id: 'east-foundry-sun', x: 936, y: 552, dx: -1, dy: 0 }
    ],
    mirrors: [
      { id: 'hot-lock-mirror', x: 360, y: 220, r: 17, split: false, dirs: [[0, 1], [1, 0]], index: 1 },
      { id: 'cold-lock-mirror', x: 664, y: 552, r: 17, split: false, dirs: [[0, -1], [-1, 0]], index: 1 }
    ],
    receivers: [
      { id: 'hot-lock', x: 360, y: 628, r: 24, kind: 'seal', text: 'The hot foundry lock latches.' },
      { id: 'cold-lock', x: 664, y: 144, r: 24, kind: 'seal', text: 'The cold foundry lock latches.' }
    ],
    gates: [{ id: 'weaver-gate', x: 952, y: 344, w: 24, h: 80, opensWhen: { receivers: ['hot-lock', 'cold-lock'] },
      text: 'Both foundry locks answer. The Weaver’s arena opens.' }],
    clearWhen: { receivers: ['hot-lock', 'cold-lock'] },
    objectives: { seal: 'Route the hot ray during heat, then the cold ray during cooling', exit: 'Both locks to the Glass Weaver arena' },
    exits: [
      { id: 'to-rail', x: 24, y: 344, w: 24, h: 80, to: 'rail', spawn: { x: 930, y: 384 } },
      { id: 'to-weaver', x: 976, y: 344, w: 24, h: 80, to: 'weaver', spawn: { x: 84, y: 384 } }
    ]
  };

  // The existing sentinel combat controller supplies the return-fire/exposure
  // loop. Alternating panes give the Weaver's arena rebuilding cover; a dedicated
  // multi-phase Weaver controller remains an integration debt, not a fake claim.
  const weaver = {
    id: 'weaver', region: 'glass-kiln', challenge: 'C5', name: 'Glass Weaver Arena', w: W, h: H,
    intro: 'The Weaver alternates a three-shot volley with five glass threads. Reflect the centered shard or slip through the gaps, then strike its open core.',
    spawn: { x: 84, y: 384 },
    thermal: { period: 14, hotFor: 7, offset: 2 },
    walls: [
      { x: 24, y: 48, w: 24, h: 296 }, { x: 24, y: 424, w: 24, h: 296 },
      { x: 976, y: 48, w: 24, h: 672 },
      { x: 48, y: 48, w: 424, h: 32 }, { x: 552, y: 48, w: 424, h: 32 },
      { x: 48, y: 696, w: 928, h: 24 },
      // Foundry crucible columns leave two readable orbit lanes.
      { x: 472, y: 250, w: 80, h: 44 }, { x: 472, y: 474, w: 80, h: 44 }
    ],
    glass: [
      { id: 'west-growing-pane', x: 300, y: 292, w: 48, h: 176, mode: 'solid', when: 'cold' },
      { id: 'west-fracture-field', x: 300, y: 292, w: 48, h: 176, mode: 'hazard', when: 'hot' },
      { id: 'east-growing-pane', x: 676, y: 292, w: 48, h: 176, mode: 'solid', when: 'hot' },
      { id: 'east-fracture-field', x: 676, y: 292, w: 48, h: 176, mode: 'hazard', when: 'cold' }
    ],
    enemies: [{ type: 'sentinel', id: 'glass-weaver', x: 800, y: 384, r: 32, hp: 10, wakeRadius: 440,
      text: 'The Glass Weaver’s frame buckles. The kiln beacon wakes beyond the crucible.' }],
    beacon: { x: 512, y: 138, requires: ['glass-weaver'],
      text: 'The Glass Kiln beacon steadies. The Observatory lift remains sealed beyond this chapter.' },
    clearWhen: { defeated: ['glass-weaver'] },
    objectives: { fight: 'Return the Weaver’s shots · strike when its glass frame opens', beacon: 'Reach the kiln beacon', exit: 'Defeat the Glass Weaver · reach the kiln beacon', won: 'Glass Kiln chapter complete · the Observatory passage remains sealed' },
    exits: [{ id: 'to-foundry', x: 24, y: 344, w: 24, h: 80, to: 'foundry', spawn: { x: 930, y: 384 } }]
  };

  // The valve room is an optional C1 detour. It awards a distinct pickup flag,
  // then opens a side entry into C2's dry west-bank pocket, so the player still
  // crosses the annealed span to leave the room.
  const quench = {
    id: 'quench', region: 'glass-kiln', challenge: null, name: 'Quench Gallery', w: W, h: H,
    intro: 'Pull the quench valve to open a dry return spur into the bridge room’s west bank. An artisan left a tempered attachment in the gallery.',
    spawn: { x: 512, y: 116 },
    walls: [
      { x: 24, y: 48, w: 424, h: 32 }, { x: 552, y: 48, w: 424, h: 32 },
      { x: 24, y: 80, w: 24, h: 640 },
      { x: 976, y: 48, w: 24, h: 296 }, { x: 976, y: 424, w: 24, h: 296 },
      { x: 48, y: 696, w: 928, h: 24 },
      { x: 250, y: 260, w: 120, h: 28 }, { x: 650, y: 476, w: 120, h: 28 }
    ],
    levers: [{ id: 'quench-valve', x: 840, y: 384, flag: 'quench-valve',
      text: 'The quench valve vents the furnace. A dry return spur opens to the bridge room’s west bank.' }],
    gates: [{ id: 'quench-side-gate', x: 952, y: 344, w: 24, h: 80, optional: true, opensWhen: { flag: 'quench-valve' },
      text: 'The dry return spur opens to the Annealed Bridge’s west bank.' }],
    pickups: [{ id: 'kiln-edge', kind: 'kiln-edge', x: 220, y: 600,
      text: 'Glass Edge attachment: a tempered tooth from the kiln artisan’s final set.' }],
    clearWhen: { flag: 'quench-valve' },
    objectives: { route: 'Pull the quench valve · take the Glass Edge', exit: 'Return spur to the Annealed Bridge’s west bank' },
    exits: [
      { id: 'to-furnace', x: 472, y: 48, w: 80, h: 32, to: 'furnace', spawn: { x: 512, y: 640 } },
      { id: 'to-bridge', x: 976, y: 344, w: 24, h: 80, to: 'bridge', spawn: { x: 240, y: 560 } }
    ]
  };

  const rooms = { cloister, sluice, sanctuary, shutters, 'bell-tower': bellTower, beacon,
    spillway, roots, channels, quay, ferry, reservoir,
    furnace, bridge: annealedBridge, rail, foundry, weaver, quench };
  PW.ROOMS = rooms;
  // Always hand out a fresh deep copy so runtime state can never mutate the authored data.
  PW.roomDef = id => Object.prototype.hasOwnProperty.call(rooms, id) ? JSON.parse(JSON.stringify(rooms[id])) : null;
})(typeof window !== 'undefined' ? window : globalThis);
