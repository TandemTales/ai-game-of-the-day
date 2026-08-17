/* =====================================================================
   CINDERGLASS — levels.js
   Contract definitions and the chamber builders.
   Owner: lead. See SPEC.md §4.

   A contract is a chamber plus a quota. Two kinds of quota exist, because
   a foundry does two different things:

     deliver — N cells of a material must reach the crucible. Only mobile
               matter can do this, so the target is always a liquid or a
               powder (lava, molten iron, molten glass, sand, water).
     create  — N cells of a material must exist in the world at once. This
               is how solid products are scored: glass, steel and obsidian
               are static the instant they set, so they can never be poured
               into anything. You are casting them, not pouring them.

   Every builder is a pure function of (sim) and must be deterministic:
   the seed is set before it runs, so two builds of the same contract
   produce byte-identical chambers.
   ===================================================================== */
(function (global) {
  'use strict';

  var CG = global.CG || (global.CG = {});
  var MAT = CG.Materials;
  var ID = MAT.ID;

  var L = CG.Levels = {};

  /* Default chamber size. Chosen so a cell is ~3px on a 390px-wide phone
     and ~10px on a 1440px desktop: coarse enough that the brush is easy to
     aim with a thumb, fine enough that a pour reads as a fluid. */
  L.W = 128;
  L.H = 88;

  /* ------------------------------------------------------------------
     Chamber-building helpers. These keep the builders readable and, more
     importantly, keep the *shell* consistent: every chamber is sealed by
     an indestructible wall, so no solution can ever leak out of the world.
     ------------------------------------------------------------------ */

  function shell(sim, thickness) {
    var t = thickness || 2;
    sim.fillRect(0, 0, sim.W, t, ID.WALL);
    sim.fillRect(0, sim.H - t, sim.W, t, ID.WALL);
    sim.fillRect(0, 0, t, sim.H, ID.WALL);
    sim.fillRect(sim.W - t, 0, t, sim.H, ID.WALL);
  }

  /* A crucible basin sunk into the floor: an open mouth `w` wide with
     absorbing walls around it, so matter that falls in is caught. */
  function crucible(sim, cx, w, depth) {
    var x0 = Math.round(cx - w / 2);
    var y0 = sim.H - 2 - depth;
    sim.fillRect(x0 - 2, y0, w + 4, depth + 2, ID.CRUCIBLE);
    sim.fillRect(x0, y0, w, depth, ID.VOID);
    return { x: cx, y: y0, w: w, depth: depth };
  }

  /* A hopper: a walled funnel holding `mat`, with a mouth at the bottom
     that is plugged by `plug`. Melting or breaking the plug releases it. */
  function hopper(sim, cx, top, w, h, mat, plug, plugH) {
    var x0 = Math.round(cx - w / 2);
    sim.fillRect(x0 - 2, top, 2, h + 2, ID.WALL);
    sim.fillRect(x0 + w, top, 2, h + 2, ID.WALL);
    sim.fillRect(x0, top + h, w, plugH || 3, plug);
    sim.fillRect(x0, top, w, h, mat);
  }

  /* A sloped ledge, one cell per step, for routing matter sideways. */
  function ramp(sim, x0, y0, len, dx, dy, thick, mat) {
    var x = x0, y = y0;
    for (var i = 0; i < len; i++) {
      sim.fillRect(x, y, 1, thick || 2, mat === undefined ? ID.STONE : mat);
      x += dx;
      if ((i % Math.max(1, Math.round(1 / Math.abs(dy || 0.5)))) === 0) y += (dy > 0 ? 1 : (dy < 0 ? -1 : 0));
    }
  }

  /* ------------------------------------------------------------------
     The contracts.
     ------------------------------------------------------------------ */
  L.LIST = [
    /* ---------------------------------------------------------------
       1. COLD START — teaches the torch and the premise.
       A hopper of sand is held shut by a plug of ice. Warm the plug and
       it becomes water, drains away, and the sand follows it down.
       --------------------------------------------------------------- */
    {
      id: 'cold-start',
      solution: [[0, 500, 64, 39, 10, +1]],
      name: 'Cold Start',
      blurb: 'The night shift left the hopper frozen shut. Thaw it.',
      hint: 'Hold the torch on the pale blue plug. Ice becomes water, water drains away, and the sand comes down behind it.',
      teaches: 'torch',
      goal: { kind: 'deliver', material: 'SAND', amount: 80 },
      fuel: 900, parTicks: 240, hardTicks: 3600,
      build: function (sim) {
        shell(sim);
        crucible(sim, 64, 22, 8);
        hopper(sim, 64, 12, 18, 26, ID.SAND, ID.ICE, 4);
      }
    },

    /* ---------------------------------------------------------------
       2. COLD STORE — teaches the quench, and teaches killing a heat
       source rather than fighting its symptom. A cistern sits on a stone
       floor with a lava vein running underneath it. You can chill the
       surface of the pool all shift and watch the vein melt it back, or
       you can set the vein to stone first and then freeze in peace.
       --------------------------------------------------------------- */
    {
      id: 'cold-store',
      solution: [[0, 1400, 64, 78, 10, -1], [1400, 4200, 64, 64, 10, -1]],
      name: 'Cold Store',
      blurb: 'The ice house sits on a live vein. Deal with the vein.',
      hint: 'Chilling the pool works, but the lava underneath keeps undoing it. Set the vein to stone first — lava freezes below 820° — then freeze the water.',
      teaches: 'quench',
      goal: { kind: 'create', material: 'ICE', amount: 140 },
      fuel: 600, parTicks: 2200, hardTicks: 6600,
      build: function (sim) {
        shell(sim);
        /* the cistern */
        sim.fillRect(32, 34, 3, 40, ID.WALL);
        sim.fillRect(93, 34, 3, 40, ID.WALL);
        sim.fillRect(32, 71, 64, 3, ID.STONE);       // the floor it shares
        sim.fillRect(35, 58, 58, 13, ID.WATER);
        /* the vein, immediately below that floor */
        sim.fillRect(35, 74, 58, 8, ID.LAVA);
        sim.fillRect(32, 82, 64, 3, ID.WALL);
      }
    },

    /* ---------------------------------------------------------------
       3. GLASSWORKS — the first real conversion. A bed of sand in a
       casting tray, and nothing else to hide behind.
       --------------------------------------------------------------- */
    {
      id: 'glassworks',
      solution: [[0, 700, 40, 64, 10, +1], [700, 1400, 64, 64, 10, +1], [1400, 2100, 88, 64, 10, +1]],
      name: 'Glassworks',
      blurb: 'Sand in, glass out. The oldest trick in the foundry.',
      hint: 'Sand fuses near 700°. Work the widest brush along the bed until it runs, let it level out, then let it cool below 560° to set — or chill it yourself and save the shift time.',
      teaches: 'phase',
      goal: { kind: 'create', material: 'GLASS', amount: 150 },
      fuel: 7000, parTicks: 2400, hardTicks: 7200,
      build: function (sim) {
        shell(sim);
        sim.fillRect(18, 70, 92, 5, ID.WALL);        // the tray
        sim.fillRect(18, 56, 3, 16, ID.WALL);
        sim.fillRect(107, 56, 3, 16, ID.WALL);
        sim.fillRect(24, 58, 80, 12, ID.SAND);
      }
    },

    /* ---------------------------------------------------------------
       4. BLACKGLASS — the reaction as the product. A cistern of water is
       held above a lava pool by an ice plug. Drop the water and every
       cell of it turns a cell of lava to obsidian.
       --------------------------------------------------------------- */
    {
      id: 'blackglass',
      solution: [[0, 700, 64, 40, 10, +1]],
      name: 'Blackglass',
      blurb: 'Water and lava make something harder than either. Introduce them.',
      hint: 'Melt the ice holding the cistern shut. Water hitting lava flashes to steam and leaves obsidian behind — one cell of water for one cell of stone glass.',
      teaches: 'reaction',
      goal: { kind: 'create', material: 'OBSIDIAN', amount: 70 },
      fuel: 900, parTicks: 900, hardTicks: 6000,
      build: function (sim) {
        shell(sim);
        /* The lava pan. Water setting on lava leaves an obsidian crust,
           and the crust seals what is underneath — so one pour is worth
           roughly one surface layer, and the pan has to be as wide as the
           quota is deep. The cistern is matched to it for the same reason:
           a narrow pour only glazes the middle. */
        sim.fillRect(20, 60, 3, 22, ID.WALL);
        sim.fillRect(105, 60, 3, 22, ID.WALL);
        sim.fillRect(20, 78, 88, 4, ID.WALL);
        sim.fillRect(23, 64, 82, 14, ID.LAVA);
        /* the cistern above, plugged with ice */
        sim.fillRect(20, 14, 3, 28, ID.WALL);
        sim.fillRect(105, 14, 3, 28, ID.WALL);
        sim.fillRect(23, 38, 82, 4, ID.ICE);
        sim.fillRect(23, 20, 82, 18, ID.WATER);
      }
    },

    /* ---------------------------------------------------------------
       5. BLOOMERY — chaining heat sources. The torch plateaus below
       iron's melting point no matter how long you hold it; lava does not.
       Tap the shelf, pour it over the ingot, catch what runs off.
       --------------------------------------------------------------- */
    {
      id: 'bloomery',
      solution: [[0, 9000, 64, 68, 6, +1]],
      name: 'Bloomery',
      blurb: 'The ingot needs 1500 degrees and the ceiling gives out at 1200. Be precise.',
      hint: 'Iron needs 1500° and holds heat better than anything else here, so keep the brush tight on the ingot and do not waste fuel warming the room. The slab overhead melts at 1200° — splash heat around and it will drop on your pour.',
      teaches: 'chaining',
      goal: { kind: 'deliver', material: 'MOLTEN_IRON', amount: 30 },
      fuel: 5500, parTicks: 2400, hardTicks: 9000,
      build: function (sim) {
        shell(sim);
        crucible(sim, 64, 20, 9);
        /* The ingot, bridging a gap directly over the crucible. It is
           deliberately small: iron has the highest heat capacity and the
           highest conductivity in the table, so a big block is more
           thermal mass than a whole shift of fuel can lift to 1500°. */
        sim.fillRect(44, 70, 13, 3, ID.WALL);
        sim.fillRect(71, 70, 13, 3, ID.WALL);
        sim.fillRect(57, 66, 14, 4, ID.IRON);
        /* The stone slab overhead is a hazard, not a tool. Lava tops out
           near 1200° — below iron's melting point — so it can never do
           this job for you, but heat the room carelessly and it comes
           down on your pour as slag. */
        sim.fillRect(50, 30, 6, 12, ID.WALL);
        sim.fillRect(72, 30, 6, 12, ID.WALL);
        sim.fillRect(48, 16, 32, 14, ID.STONE);
      }
    }
  ];

  /* ------------------------------------------------------------------
     Reference solutions.

     Each contract carries a `solution`: a list of brush strokes as
     [fromTick, toTick, x, y, radius, sign], where sign is +1 for the torch
     and -1 for the quench. `cinderglass.levels.test.js` replays them and
     asserts the quota is actually met inside the shift and the fuel.

     These are deliberately crude — one brush parked in one place — so that
     a chamber which only passes under expert play does not pass here. If a
     tuning change breaks one of these, the chamber got harder than it
     looks, and that is worth knowing before a player finds out.
     ------------------------------------------------------------------ */
  L.replay = function (sim, spec, strokes, maxTicks) {
    var limit = Math.min(maxTicks === undefined ? spec.hardTicks : maxTicks, spec.hardTicks);
    var solvedAt = -1;
    for (var t = 0; t < limit; t++) {
      for (var k = 0; k < strokes.length; k++) {
        var st = strokes[k];
        if (t < st[0] || t >= st[1]) continue;
        if (st[5] > 0 && sim.fuelUsed >= spec.fuel) continue;   // out of fuel
        sim.paintHeat(st[2], st[3], st[4], st[5]);
      }
      sim.step();
      if (solvedAt < 0 && L.isComplete(sim, spec)) solvedAt = t;
    }
    return solvedAt;
  };

  /* ------------------------------------------------------------------
     Construction.
     ------------------------------------------------------------------ */
  L.count = function () { return L.LIST.length; };

  L.byId = function (id) {
    for (var i = 0; i < L.LIST.length; i++) if (L.LIST[i].id === id) return L.LIST[i];
    return null;
  };

  /* Build contract `index` into a fresh Sim and return it. The seed is
     derived from the contract id so a chamber is identical every time it
     is played, which is what makes a leaderboard score comparable. */
  L.build = function (index) {
    var spec = L.LIST[((index % L.LIST.length) + L.LIST.length) % L.LIST.length];
    var seed = 0;
    for (var i = 0; i < spec.id.length; i++) seed = (Math.imul(seed, 31) + spec.id.charCodeAt(i)) | 0;
    seed = (seed ^ 0x5bf03635) >>> 0;

    CG.setSeed(seed);
    var sim = new CG.Sim(L.W, L.H, seed);
    spec.build(sim);
    /* the builder runs before any tick, so re-seed for the simulation
       itself and leave the world exactly as authored */
    CG.setSeed(seed);
    sim.spec = spec;
    return sim;
  };

  /* How far along the quota is, 0..1, plus the raw count. game.js owns
     what to do about it; this just reads the world. */
  L.progress = function (sim, spec) {
    var g = spec.goal;
    var id = MAT.ID[g.material];
    var have = (g.kind === 'create') ? sim.count(id) : sim.absorbed[id];
    return { have: have, need: g.amount, frac: CG.clamp01(have / g.amount) };
  };

  L.isComplete = function (sim, spec) {
    return L.progress(sim, spec).have >= spec.goal.amount;
  };

})(window);
