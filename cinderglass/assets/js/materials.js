/* =====================================================================
   CINDERGLASS — materials.js
   The material table: physics constants, phase changes and reactions.
   Owner: lead. See SPEC.md §2.

   This file is *data*. sim.js reads it and knows nothing about any
   specific material; render.js reads the color ramps. Adding a material
   here is the only thing needed to put it in the world.
   ===================================================================== */
(function (global) {
  'use strict';

  var CG = global.CG || (global.CG = {});
  var M = CG.Materials = {};

  /* Movement behaviours — see SPEC.md §1.2 */
  var STATIC = M.STATIC = 0;
  var POWDER = M.POWDER = 1;
  var LIQUID = M.LIQUID = 2;
  var GAS    = M.GAS    = 3;

  /* ------------------------------------------------------------------
     The table.

     density        displacement ordering; a heavier mobile cell sinks
                    through a lighter one, and a lighter one rises through
                    a heavier one. Air is 0.20, so anything below that
                    floats and anything above it falls.
     heatCapacity   J-ish per degree. Big = slow to heat *and* slow to cool.
     conductivity   0..1, fraction of the temperature gap moved per tick
                    across one face. The pair conductivity is the product.
     radiate        0..1, how fast it sheds heat to ambient on its own.
                    Gases and emissive materials shed fast; stone barely.
     emissive       0..1, how much light it throws into the lighting pass.
                    Scaled by temperature in render.js.
     glowFrom       temperature at which emissive light starts to show.
     colorLo/Hi     color ramp endpoints, sampled between rampLo..rampHi.
     grain          0..1 per-cell value noise applied to the color.
     freezeAt/To    below this temperature, become that material.
     meltAt/To      above this temperature, become that material.
     latent         degrees of temperature consumed (melt) or released
                    (freeze) by the transition — this is what stops a
                    cell flickering across its own phase boundary.
     flow           liquids only: max sideways spread attempts per tick.
     repose         powders only: 0 = flows like water, 1 = never slides.
     lifetime       gases only: ticks before it despawns (0 = never).
     absorbs        true for the crucible: mobile matter entering is
                    consumed and counted.
     indestructible never transforms at any temperature.
     ------------------------------------------------------------------ */
  var TABLE = [
    {
      name: 'VOID', label: 'Air',
      /* Air has a real density: it is what gas buoyancy is measured
         against. Steam and flame are lighter than it and therefore rise;
         every powder and liquid is heavier and therefore falls. */
      move: GAS, density: 0.20,
      heatCapacity: 0.35, conductivity: 0.10, radiate: 0.060,
      emissive: 0, colorLo: '#07060a', colorHi: '#07060a',
      rampLo: 0, rampHi: 1, grain: 0,
      air: true
    },
    {
      name: 'WALL', label: 'Foundry Wall',
      move: STATIC, density: 99,
      heatCapacity: 6.0, conductivity: 0.06, radiate: 0.004,
      emissive: 0, colorLo: '#191722', colorHi: '#4a3128',
      rampLo: 0, rampHi: 1400, grain: 0.16,
      indestructible: true
    },
    {
      name: 'CRUCIBLE', label: 'Crucible',
      move: STATIC, density: 99,
      heatCapacity: 8.0, conductivity: 0.10, radiate: 0.004,
      emissive: 0.20, glowFrom: 300, colorLo: '#3b2a16', colorHi: '#ffb347',
      rampLo: 0, rampHi: 1600, grain: 0.10,
      indestructible: true, absorbs: true
    },

    /* ---- rock cycle -------------------------------------------------- */
    {
      name: 'STONE', label: 'Stone',
      move: STATIC, density: 2.6,
      heatCapacity: 2.4, conductivity: 0.13, radiate: 0.006,
      emissive: 0.35, glowFrom: 500, colorLo: '#3a3742', colorHi: '#ff7b3a',
      rampLo: 0, rampHi: 1200, grain: 0.18,
      meltAt: 1200, meltTo: 'LAVA', latent: 90
    },
    {
      name: 'LAVA', label: 'Lava',
      move: LIQUID, density: 2.5, flow: 2,
      heatCapacity: 2.2, conductivity: 0.22, radiate: 0.055,
      emissive: 1.0, glowFrom: 500, colorLo: '#8c1c05', colorHi: '#fff0b4',
      rampLo: 700, rampHi: 1900, grain: 0.10,
      freezeAt: 820, freezeTo: 'STONE', latent: 90
    },
    {
      name: 'OBSIDIAN', label: 'Obsidian',
      move: STATIC, density: 2.4,
      heatCapacity: 2.6, conductivity: 0.11, radiate: 0.006,
      emissive: 0.30, glowFrom: 700, colorLo: '#100c18', colorHi: '#ff6a2a',
      rampLo: 0, rampHi: 1400, grain: 0.09,
      meltAt: 1350, meltTo: 'LAVA', latent: 90
    },

    /* ---- the glass line ---------------------------------------------- */
    {
      name: 'SAND', label: 'Sand',
      move: POWDER, density: 1.7, repose: 0.22,
      heatCapacity: 1.5, conductivity: 0.11, radiate: 0.012,
      emissive: 0.45, glowFrom: 420, colorLo: '#c8a86a', colorHi: '#ffe6a8',
      rampLo: 0, rampHi: 900, grain: 0.22,
      meltAt: 700, meltTo: 'MOLTEN_GLASS', latent: 70
    },
    {
      name: 'MOLTEN_GLASS', label: 'Molten Glass',
      move: LIQUID, density: 1.9, flow: 2,
      heatCapacity: 1.6, conductivity: 0.19, radiate: 0.048,
      emissive: 0.95, glowFrom: 450, colorLo: '#c26a12', colorHi: '#fff6d0',
      rampLo: 500, rampHi: 1300, grain: 0.07,
      freezeAt: 560, freezeTo: 'GLASS', latent: 70
    },
    {
      name: 'GLASS', label: 'Glass',
      move: STATIC, density: 2.0,
      heatCapacity: 1.7, conductivity: 0.14, radiate: 0.010,
      emissive: 0.25, glowFrom: 400, colorLo: '#8fd3e4', colorHi: '#ffcf8a',
      rampLo: 0, rampHi: 900, grain: 0.06,
      translucent: true,
      meltAt: 900, meltTo: 'MOLTEN_GLASS', latent: 70
    },

    /* ---- the water line ---------------------------------------------- */
    {
      name: 'ICE', label: 'Ice',
      move: STATIC, density: 0.92,
      heatCapacity: 2.0, conductivity: 0.20, radiate: 0.016,
      emissive: 0, colorLo: '#9fe4ff', colorHi: '#d8f6ff',
      rampLo: -60, rampHi: 2, grain: 0.10,
      translucent: true,
      meltAt: 4, meltTo: 'WATER', latent: 55
    },
    {
      name: 'WATER', label: 'Water',
      move: LIQUID, density: 1.0, flow: 5,
      heatCapacity: 4.2, conductivity: 0.26, radiate: 0.022,
      emissive: 0, colorLo: '#1d5c8f', colorHi: '#5ba7c9',
      rampLo: 0, rampHi: 100, grain: 0.06,
      translucent: true,
      freezeAt: 0, freezeTo: 'ICE', latent: 55,
      meltAt: 100, meltTo: 'STEAM', latent2: 120
    },
    {
      name: 'STEAM', label: 'Steam',
      move: GAS, density: 0.12, flow: 3, lifetime: 0,
      heatCapacity: 0.9, conductivity: 0.16, radiate: 0.075,
      emissive: 0.05, glowFrom: 300, colorLo: '#8fa6b4', colorHi: '#f2f7fb',
      rampLo: 40, rampHi: 400, grain: 0.14,
      translucent: true,
      freezeAt: 62, freezeTo: 'WATER', latent: 120
    },

    /* ---- combustion --------------------------------------------------- */
    {
      name: 'OIL', label: 'Pitch Oil',
      move: LIQUID, density: 0.82, flow: 4,
      heatCapacity: 1.9, conductivity: 0.13, radiate: 0.016,
      emissive: 0, colorLo: '#241a2b', colorHi: '#6b4a2a',
      rampLo: 0, rampHi: 260, grain: 0.10,
      meltAt: 250, meltTo: 'BLAZE', latent: 0
    },
    {
      /* Burning pitch. Fire has to stay *with* its fuel to propagate: a
         flame modelled purely as a rising gas leaves the oil the instant
         it forms, so a pool lit at one end never catches along its length.
         BLAZE is the burning fuel itself — still a liquid, so it flows —
         and it is what radiates enough heat sideways to light its
         neighbours. EMBER is the flame it throws off, and is decorative
         plus dangerous rather than the thing that spreads. */
      name: 'BLAZE', label: 'Burning Pitch',
      move: LIQUID, density: 0.80, flow: 3, lifetime: 150,
      heatCapacity: 1.2, conductivity: 0.24, radiate: 0.085,
      emissive: 1.0, glowFrom: 180, colorLo: '#ff6410', colorHi: '#fff3cc',
      rampLo: 260, rampHi: 1200, grain: 0.16,
      decayTo: 'ASH', burn: 26
    },
    {
      name: 'EMBER', label: 'Flame',
      move: GAS, density: 0.06, flow: 2, lifetime: 90,
      heatCapacity: 0.5, conductivity: 0.20, radiate: 0.090,
      emissive: 1.0, glowFrom: 120, colorLo: '#ff5a10', colorHi: '#fff3c0',
      rampLo: 200, rampHi: 1100, grain: 0.18,
      decayTo: 'VOID', burn: 16
    },
    {
      name: 'ASH', label: 'Ash',
      move: POWDER, density: 0.55, repose: 0.45,
      heatCapacity: 1.1, conductivity: 0.09, radiate: 0.026,
      emissive: 0.30, glowFrom: 260, colorLo: '#494249', colorHi: '#ff8a44',
      rampLo: 0, rampHi: 800, grain: 0.24
    },

    /* ---- the steel line ------------------------------------------------ */
    {
      name: 'IRON', label: 'Pig Iron',
      move: STATIC, density: 7.2,
      heatCapacity: 3.0, conductivity: 0.42, radiate: 0.010,
      emissive: 0.55, glowFrom: 480, colorLo: '#6d6f78', colorHi: '#ffd07a',
      rampLo: 0, rampHi: 1500, grain: 0.12,
      meltAt: 1500, meltTo: 'MOLTEN_IRON', latent: 110
    },
    {
      name: 'MOLTEN_IRON', label: 'Molten Iron',
      move: LIQUID, density: 6.9, flow: 3,
      heatCapacity: 2.8, conductivity: 0.40, radiate: 0.040,
      emissive: 1.0, glowFrom: 600, colorLo: '#c8500c', colorHi: '#fffbe6',
      rampLo: 900, rampHi: 2100, grain: 0.07,
      /* A wide liquid window on purpose. Iron melts at 1500 and molten
         iron is the fastest-cooling thing in the table; with a freezing
         point just below its melting point a pour re-solidifies in mid-air
         after a handful of cells and can never reach a crucible. */
      freezeAt: 1250, freezeTo: 'IRON', latent: 110
    },
    {
      name: 'STEEL', label: 'Steel',
      move: STATIC, density: 7.6,
      heatCapacity: 3.1, conductivity: 0.44, radiate: 0.009,
      emissive: 0.50, glowFrom: 500, colorLo: '#9aa6bb', colorHi: '#ffe0a0',
      rampLo: 0, rampHi: 1600, grain: 0.10,
      meltAt: 1650, meltTo: 'MOLTEN_IRON', latent: 110
    }
  ];

  /* ------------------------------------------------------------------
     Neighbour reactions.

     Read as: when `a` is adjacent to `b` and the hotter of the two is at
     least `minTemp`, then with probability `chance` per tick, `a` becomes
     `becomes` and `b` becomes `otherBecomes`. `heat` is dumped into both
     cells (negative = endothermic).

     Reactions are declared once and registered for both orderings, so the
     pass does not depend on which cell it visits first.
     ------------------------------------------------------------------ */
  var REACTIONS = [
    /* Lava quenched by water: the classic. Makes obsidian, flashes the
       water to steam, and throws off a lot of heat doing it. */
    {
      a: 'LAVA', b: 'WATER',
      becomes: 'OBSIDIAN', otherBecomes: 'STEAM',
      minTemp: 700, chance: 0.85, heat: 60, heatOther: 220
    },
    /* Lava on ice skips straight past liquid water. */
    {
      a: 'LAVA', b: 'ICE',
      becomes: 'OBSIDIAN', otherBecomes: 'STEAM',
      minTemp: 700, chance: 0.55, heat: 20, heatOther: 200
    },
    /* Carburising: molten iron in contact with ash (carbon) becomes steel.
       Slow, so a big pour needs a real bed of ash, not a stray fleck. */
    {
      a: 'MOLTEN_IRON', b: 'ASH',
      becomes: 'STEEL', otherBecomes: 'VOID',
      minTemp: 1400, chance: 0.16, heat: -40, heatOther: 0
    },
    /* Ignition chain: burning pitch lights the pitch it touches. The
       radiated heat alone would get there eventually; this makes the
       spread crisp enough to read as fire. */
    {
      a: 'BLAZE', b: 'OIL',
      becomes: 'BLAZE', otherBecomes: 'BLAZE',
      minTemp: 240, chance: 0.22, heat: 0, heatOther: 0
    },
    /* Flame gas licking up off the burning fuel. Reactions are registered
       in both directions, so this also fires as "air with blaze below". */
    {
      a: 'BLAZE', b: 'VOID',
      becomes: 'BLAZE', otherBecomes: 'EMBER',
      minTemp: 220, chance: 0.10, heat: 0, heatOther: 0
    },
    /* Loose flame still lights pitch it drifts into. */
    {
      a: 'EMBER', b: 'OIL',
      becomes: 'EMBER', otherBecomes: 'BLAZE',
      minTemp: 200, chance: 0.35, heat: 0, heatOther: 0
    },
    /* Water smothers fire. */
    {
      a: 'BLAZE', b: 'WATER',
      becomes: 'ASH', otherBecomes: 'STEAM',
      minTemp: -999, chance: 0.55, heat: -300, heatOther: 120
    },
    {
      a: 'EMBER', b: 'WATER',
      becomes: 'VOID', otherBecomes: 'STEAM',
      minTemp: -999, chance: 0.70, heat: 0, heatOther: 60
    },
    /* Molten glass poured onto water skins over instantly. */
    {
      a: 'MOLTEN_GLASS', b: 'WATER',
      becomes: 'GLASS', otherBecomes: 'STEAM',
      minTemp: 500, chance: 0.70, heat: -120, heatOther: 160
    }
  ];

  /* ------------------------------------------------------------------
     Build: resolve names to ids and freeze.
     ------------------------------------------------------------------ */
  var ID = M.ID = {};
  var BY_ID = M.BY_ID = [];
  var NAMES = M.NAMES = [];

  var i, m;
  for (i = 0; i < TABLE.length; i++) {
    ID[TABLE[i].name] = i;
    NAMES.push(TABLE[i].name);
  }

  function idOf(name) {
    var v = ID[name];
    if (v === undefined) throw new Error('[CG] unknown material: ' + name);
    return v;
  }
  M.idOf = idOf;

  for (i = 0; i < TABLE.length; i++) {
    m = TABLE[i];
    m.id = i;
    /* defaults so sim.js never has to test for undefined */
    m.flow = m.flow || 0;
    m.repose = (m.repose === undefined) ? 0 : m.repose;
    m.lifetime = m.lifetime || 0;
    m.glowFrom = (m.glowFrom === undefined) ? 1e9 : m.glowFrom;
    m.emissive = m.emissive || 0;
    m.grain = m.grain || 0;
    m.latent = m.latent || 0;
    m.burn = m.burn || 0;
    m.air = !!m.air;
    m.absorbs = !!m.absorbs;
    m.translucent = !!m.translucent;
    m.indestructible = !!m.indestructible;
    m.mobile = (m.move !== STATIC);

    /* Phase-change targets as ids. -1 means "no transition that way",
       which lets the sim branch on a cheap integer compare. */
    m.freezeToId = (m.freezeTo === undefined) ? -1 : idOf(m.freezeTo);
    m.meltToId = (m.meltTo === undefined) ? -1 : idOf(m.meltTo);
    m.decayToId = (m.decayTo === undefined) ? -1 : idOf(m.decayTo);
    if (m.freezeAt === undefined) m.freezeAt = -1e9;
    if (m.meltAt === undefined) m.meltAt = 1e9;
    /* latent2 lets water declare a different latent heat for boiling
       than for freezing; everything else reuses `latent`. */
    m.latentMelt = (m.latent2 === undefined) ? m.latent : m.latent2;

    /* Inverse heat capacity, precomputed — the conduction inner loop runs
       on every cell every tick and must not divide. */
    m.invHeatCapacity = 1 / (m.heatCapacity || 1);

    BY_ID.push(m);
  }

  /* Reaction lookup, indexed [aId * N + bId] -> rule (registered both ways) */
  var N = BY_ID.length;
  M.COUNT = N;
  var RX = M.RX = new Array(N * N);
  for (i = 0; i < REACTIONS.length; i++) {
    var r = REACTIONS[i];
    var ai = idOf(r.a), bi = idOf(r.b);
    var fwd = {
      becomes: idOf(r.becomes),
      otherBecomes: idOf(r.otherBecomes),
      minTemp: (r.minTemp === undefined) ? -1e9 : r.minTemp,
      chance: (r.chance === undefined) ? 1 : r.chance,
      heat: r.heat || 0,
      heatOther: r.heatOther || 0
    };
    var rev = {
      becomes: fwd.otherBecomes,
      otherBecomes: fwd.becomes,
      minTemp: fwd.minTemp,
      chance: fwd.chance,
      heat: fwd.heatOther,
      heatOther: fwd.heat
    };
    RX[ai * N + bi] = fwd;
    if (!RX[bi * N + ai]) RX[bi * N + ai] = rev;
  }

  /* Flat typed-array mirrors of the hot fields. The sim reads these
     instead of walking object properties — it is measurably faster and
     keeps the inner loops free of megamorphic property access. */
  M.density = new Float32Array(N);
  M.conductivity = new Float32Array(N);
  M.invHeatCapacity = new Float32Array(N);
  M.radiate = new Float32Array(N);
  M.moveKind = new Uint8Array(N);
  M.flowRate = new Uint8Array(N);
  M.freezeAt = new Float32Array(N);
  M.meltAt = new Float32Array(N);
  M.freezeToId = new Int8Array(N);
  M.meltToId = new Int8Array(N);
  M.latent = new Float32Array(N);
  M.latentMelt = new Float32Array(N);
  M.reposeArr = new Float32Array(N);
  M.lifetimeArr = new Uint16Array(N);
  M.decayToId = new Int8Array(N);
  M.burnArr = new Float32Array(N);
  M.isMobile = new Uint8Array(N);
  M.isAir = new Uint8Array(N);
  M.isAbsorber = new Uint8Array(N);
  M.isIndestructible = new Uint8Array(N);

  for (i = 0; i < N; i++) {
    m = BY_ID[i];
    M.density[i] = m.density;
    M.conductivity[i] = m.conductivity;
    M.invHeatCapacity[i] = m.invHeatCapacity;
    M.radiate[i] = m.radiate;
    M.moveKind[i] = m.move;
    M.flowRate[i] = m.flow;
    M.freezeAt[i] = m.freezeAt;
    M.meltAt[i] = m.meltAt;
    M.freezeToId[i] = m.freezeToId;
    M.meltToId[i] = m.meltToId;
    M.latent[i] = m.latent;
    M.latentMelt[i] = m.latentMelt;
    M.reposeArr[i] = m.repose;
    M.lifetimeArr[i] = m.lifetime;
    M.decayToId[i] = m.decayToId;
    M.burnArr[i] = m.burn;
    M.isMobile[i] = m.mobile ? 1 : 0;
    M.isAir[i] = m.air ? 1 : 0;
    M.isAbsorber[i] = m.absorbs ? 1 : 0;
    M.isIndestructible[i] = m.indestructible ? 1 : 0;
  }

  M.get = function (idOrName) {
    return typeof idOrName === 'string' ? BY_ID[idOf(idOrName)] : BY_ID[idOrName];
  };

  /* The starting temperature a material is spawned at when a chamber is
     built without an explicit one — a lava pool should not begin frozen. */
  M.defaultTemp = function (id) {
    var mm = BY_ID[id];
    if (!mm) return CG.AMBIENT;
    if (mm.name === 'LAVA') return 1150;
    if (mm.name === 'MOLTEN_IRON') return 1700;
    if (mm.name === 'MOLTEN_GLASS') return 850;
    if (mm.name === 'EMBER') return 700;
    if (mm.name === 'ICE') return -12;
    if (mm.name === 'STEAM') return 140;
    return CG.AMBIENT;
  };

  Object.freeze(REACTIONS);

})(window);
