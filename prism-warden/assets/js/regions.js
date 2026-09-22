(function (root) {
  'use strict';
  const PW = root.PW = root.PW || {};

  // The campaign map is authored data, not a promise that every chapter is playable yet.
  // Keeping the route here gives content work one stable source of truth as regions land.
  const regions = [
    {
      id: 'tidal-abbey', number: 1, name: 'Tidal Abbey', epithet: 'The drowned cloister',
      route: 'sunken cloister -> sluice court -> bell tower -> abbey beacon',
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
  PW.campaignContract = () => ({
    regions: regions.length,
    challenges: regions.reduce((total, region) => total + region.challenges.length, 0),
    firstPlayable: PW.FIRST_PLAYABLE.id,
    complete: false
  });
})(typeof window !== 'undefined' ? window : globalThis);
