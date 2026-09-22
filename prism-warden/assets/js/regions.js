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
      ]
    },
    {
      id: 'verdant-aqueduct', number: 2, name: 'Verdant Aqueduct', epithet: 'The rootbound canals',
      route: 'abbey spillway -> root bridges -> ferryman quay -> hart reservoir',
      rooms: [{ id: 'spillway', name: 'Abbey Spillway' }, { id: 'roots', name: 'Root Bridges' }, { id: 'channels', name: 'Rotating Channels' }, { id: 'quay', name: 'Ferryman Quay' }, { id: 'reservoir', name: 'Hart Reservoir' }, { id: 'ferry', name: 'Optional Ferry' }],
      links: [['spillway', 'roots'], ['roots', 'channels'], ['channels', 'quay'], ['quay', 'reservoir'], ['quay', 'ferry'], ['ferry', 'reservoir']],
      challenges: [
        { id: 'B1', title: 'Prism on Root Bridges', mechanic: 'carry a placeable prism across bridges that flex underfoot', optional: 'ferryman ferry', guardian: 'Rootbound Bramble' },
        { id: 'B2', title: 'Irrigation Cut', mechanic: 'cut growth while sustaining the water circuit', optional: 'old pump room', guardian: 'Moss Engine' },
        { id: 'B3', title: 'Rotating Seed Mortars', mechanic: 'flank seed mortars through rotating channels', optional: 'seed lens', guardian: 'Canal Stag' },
        { id: 'B4', title: 'Ferryman Rescue', mechanic: 'route water toward trapped ferrymen without drowning the shortcut', optional: 'rescue skiff', guardian: 'Drowned Oarsman' },
        { id: 'B5', title: 'Root Hart', mechanic: 'turn a charging guardian into its own broken dams', optional: 'hart grove', guardian: 'Root Hart' }
      ]
    },
    {
      id: 'glass-kiln', number: 3, name: 'Glass Kiln', epithet: 'The furnace below the tide',
      route: 'reservoir lock -> furnace lanes -> cooling rail -> weaver foundry',
      rooms: [{ id: 'lock', name: 'Reservoir Lock' }, { id: 'furnace', name: 'Furnace Lanes' }, { id: 'bridge', name: 'Annealed Bridge' }, { id: 'rail', name: 'Cooling Rail' }, { id: 'foundry', name: 'Weaver Foundry' }, { id: 'quench', name: 'Optional Quench Valve' }],
      links: [['lock', 'furnace'], ['furnace', 'bridge'], ['bridge', 'rail'], ['rail', 'foundry'], ['furnace', 'quench'], ['quench', 'rail']],
      challenges: [
        { id: 'C1', title: 'Alternating Furnace', mechanic: 'read heat pulses and cross the safe lane before it seals', optional: 'quench valve', guardian: 'Kiln Watch' },
        { id: 'C2', title: 'Annealed Bridge', mechanic: 'control heat to harden a temporary glass crossing', optional: 'artisan cache', guardian: 'Heatbound Mason' },
        { id: 'C3', title: 'Cooling Cart', mechanic: 'escort a cooling cart through crossfire and hot vents', optional: 'vent bypass', guardian: 'Cinder Porter' },
        { id: 'C4', title: 'Hot / Cold Locks', mechanic: 'route competing beams through foundry locks', optional: 'lens polarity', guardian: 'Thermal Choir' },
        { id: 'C5', title: 'Glass Weaver', mechanic: 'fight a guardian that breaks and rebuilds cover', optional: 'weapon attachment', guardian: 'Glass Weaver' }
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
    beacon: { x: 512, y: 120, requires: ['bell-diver'] },
    objectives: { beacon: 'Reach the kindled beacon' },
    exits: [{ id: 'to-bell-tower', x: 472, y: 696, w: 80, h: 24, to: 'bell-tower', spawn: { x: 512, y: 120 } }]
  };

  const rooms = { cloister, sluice, sanctuary, shutters, 'bell-tower': bellTower, beacon };
  PW.ROOMS = rooms;
  // Always hand out a fresh deep copy so runtime state can never mutate the authored data.
  PW.roomDef = id => Object.prototype.hasOwnProperty.call(rooms, id) ? JSON.parse(JSON.stringify(rooms[id])) : null;
})(typeof window !== 'undefined' ? window : globalThis);
