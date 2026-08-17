/* =====================================================================
   CINDERGLASS — sim.js
   The cellular automaton: heat conduction, phase change, reactions and
   falling-sand movement.
   Owner: lead. See SPEC.md §1 — the three-pass order there is a
   correctness requirement, not a style preference.

   Hard rule: this file must never call Math.random(). Every stochastic
   decision draws from CG.rand(), which is seeded per chamber, so the
   same chamber replayed with the same inputs produces the same world.
   `__tests__/cinderglass.sim.test.js` asserts exactly that.
   ===================================================================== */
(function (global) {
  'use strict';

  var CG = global.CG || (global.CG = {});
  var MAT = CG.Materials;

  /* Tuning constants. These are the dials that decide how the game feels;
     they are gathered here rather than scattered through the passes. */
  var HEAT_RATE     = 0.30;   // conduction scale per tick
  var HEAT_STABLE   = 0.85;   // max total conduction coefficient per cell
  var RADIATE_SCALE = 0.020;  // how fast materials shed heat to ambient
  var TORCH_POWER   = 16.0;   // energy per tick at the centre of the brush
  var QUENCH_POWER  = 13.0;
  var BURN_SPREAD   = 2.2;    // share of a flame's heat pushed into neighbours
  var LATENT_SHARE  = 0.25;   // latent heat handed to each of 4 neighbours

  var VOID = 0;

  function Sim(w, h, seed) {
    this.W = w | 0;
    this.H = h | 0;
    this.N = this.W * this.H;
    this.seed = (seed >>> 0) || 1;

    this.mat = new Uint8Array(this.N);
    this.temp = new Float32Array(this.N);
    this.tempNext = new Float32Array(this.N);
    this.aux = new Uint16Array(this.N);      // gas lifetime / per-material scratch
    this.reacted = new Uint8Array(this.N);   // one reaction per cell per tick
    this.moved = new Uint8Array(this.N);     // one move per cell per tick

    /* Persistent lateral flow direction for fluids (-1, 0, +1). Without
       this a spreading pool checkerboards: each surface cell picks a fresh
       direction every tick and oscillates in place instead of levelling. */
    this.dir = new Int8Array(this.N);

    /* How much of each material the crucible has swallowed. */
    this.absorbed = new Uint32Array(MAT.COUNT);
    this.absorbedTotal = 0;
    /* Ring buffer of recent absorptions, for the UI's delivery ticker. */
    this.absorbEvents = [];

    this.tick = 0;
    this.fuelUsed = 0;

    this.temp.fill(CG.AMBIENT);
    this.tempNext.fill(CG.AMBIENT);
  }

  Sim.prototype.idx = function (x, y) { return y * this.W + x; };
  Sim.prototype.inBounds = function (x, y) {
    return x >= 0 && y >= 0 && x < this.W && y < this.H;
  };
  Sim.prototype.at = function (x, y) {
    return this.inBounds(x, y) ? this.mat[y * this.W + x] : MAT.ID.WALL;
  };
  Sim.prototype.tempAt = function (x, y) {
    return this.inBounds(x, y) ? this.temp[y * this.W + x] : CG.AMBIENT;
  };

  /* ------------------------------------------------------------------
     Authoring helpers — used by levels.js to paint a chamber, and by the
     tests to build a scenario. `t` is optional; the material's default
     temperature is used when it is omitted.
     ------------------------------------------------------------------ */
  Sim.prototype.set = function (x, y, id, t) {
    if (!this.inBounds(x, y)) return;
    var i = y * this.W + x;
    this.mat[i] = id;
    this.temp[i] = (t === undefined) ? MAT.defaultTemp(id) : t;
    this.aux[i] = 0;
    this.dir[i] = 0;
  };
  Sim.prototype.fillRect = function (x0, y0, w, h, id, t) {
    for (var y = y0; y < y0 + h; y++) {
      for (var x = x0; x < x0 + w; x++) this.set(x, y, id, t);
    }
  };
  Sim.prototype.fillCircle = function (cx, cy, r, id, t) {
    var r2 = r * r;
    for (var y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, id, t);
      }
    }
  };
  Sim.prototype.border = function (id) {
    var x, y;
    for (x = 0; x < this.W; x++) { this.set(x, 0, id); this.set(x, this.H - 1, id); }
    for (y = 0; y < this.H; y++) { this.set(0, y, id); this.set(this.W - 1, y, id); }
  };
  Sim.prototype.count = function (id) {
    var n = 0;
    for (var i = 0; i < this.N; i++) if (this.mat[i] === id) n++;
    return n;
  };

  /* ------------------------------------------------------------------
     The player's verb: paint heat into (or out of) a disc.

     `sign` is +1 for the torch and -1 for the quench. Returns the fuel
     actually consumed, so game.js can stop the torch at empty without
     needing to know the brush shape.
     ------------------------------------------------------------------ */
  Sim.prototype.paintHeat = function (cx, cy, radius, sign, scale) {
    var power = (sign > 0 ? TORCH_POWER : -QUENCH_POWER) * (scale === undefined ? 1 : scale);
    var r = radius, r2 = r * r;
    var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.W - 1, Math.ceil(cx + r));
    var y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.H - 1, Math.ceil(cy + r));
    var spent = 0;
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var dx = x - cx, dy = y - cy;
        var d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        var i = y * this.W + x;
        var id = this.mat[i];
        /* The chamber shell is a heat sink the player cannot drive. */
        if (id === MAT.ID.WALL) continue;
        var falloff = 1 - Math.sqrt(d2) / r;
        falloff = falloff * falloff * (3 - 2 * falloff);      // smoothstep
        var delta = power * falloff * MAT.invHeatCapacity[id];
        var t = this.temp[i] + delta;
        this.temp[i] = t < CG.TEMP_MIN ? CG.TEMP_MIN : (t > CG.TEMP_MAX ? CG.TEMP_MAX : t);
        spent += falloff;
      }
    }
    if (sign > 0) this.fuelUsed += spent;
    return spent;
  };

  /* ------------------------------------------------------------------
     PASS 1 — heat.

     Explicit Euler conduction over the 4-neighbourhood, written to a
     second buffer and swapped. Doing this in place would bias heat flow
     in the scan direction and break determinism under reordering.

     The per-cell coefficient sum is clamped to HEAT_STABLE, which is what
     keeps an explicit scheme from oscillating when a highly conductive
     material sits next to a low-heat-capacity one.
     ------------------------------------------------------------------ */
  Sim.prototype.heatPass = function () {
    var W = this.W, H = this.H;
    var mat = this.mat, temp = this.temp, next = this.tempNext;
    var cond = MAT.conductivity, invHC = MAT.invHeatCapacity, rad = MAT.radiate;
    var ambient = CG.AMBIENT;

    for (var y = 0; y < H; y++) {
      var row = y * W;
      for (var x = 0; x < W; x++) {
        var i = row + x;
        var id = mat[i];
        var ti = temp[i];
        var ca = cond[id] * HEAT_RATE * invHC[id];

        var acc = 0, wsum = 0, k;

        if (x > 0)      { k = ca * cond[mat[i - 1]]; acc += k * (temp[i - 1] - ti); wsum += k; }
        if (x < W - 1)  { k = ca * cond[mat[i + 1]]; acc += k * (temp[i + 1] - ti); wsum += k; }
        if (y > 0)      { k = ca * cond[mat[i - W]]; acc += k * (temp[i - W] - ti); wsum += k; }
        if (y < H - 1)  { k = ca * cond[mat[i + W]]; acc += k * (temp[i + W] - ti); wsum += k; }

        if (wsum > HEAT_STABLE) acc *= HEAT_STABLE / wsum;

        /* Radiation / ambient bleed. */
        var t = ti + acc + (ambient - ti) * rad[id] * RADIATE_SCALE;

        next[i] = t < CG.TEMP_MIN ? CG.TEMP_MIN : (t > CG.TEMP_MAX ? CG.TEMP_MAX : t);
      }
    }

    var swap = this.temp; this.temp = this.tempNext; this.tempNext = swap;
  };

  /* Hand latent heat to (or take it from) the 4 neighbours. Phase change
     happens at a fixed temperature in reality; modelling it by pushing the
     energy outward is both closer to the physics and — crucially — what
     stops a boundary cell flickering across its own threshold forever. */
  Sim.prototype._spreadLatent = function (i, amount) {
    var W = this.W, H = this.H, N = this.N;
    var x = i % W, y = (i / W) | 0;
    var temp = this.temp, mat = this.mat, invHC = MAT.invHeatCapacity;
    var each = amount * LATENT_SHARE;
    var j;
    if (x > 0)     { j = i - 1; temp[j] += each * invHC[mat[j]]; }
    if (x < W - 1) { j = i + 1; temp[j] += each * invHC[mat[j]]; }
    if (y > 0)     { j = i - W; temp[j] += each * invHC[mat[j]]; }
    if (y < H - 1 && (j = i + W) < N) { temp[j] += each * invHC[mat[j]]; }
  };

  /* ------------------------------------------------------------------
     PASS 2 — phase changes, decay and neighbour reactions.

     Pair reactions only look at the right and down neighbours, so each
     unordered pair is visited exactly once per tick regardless of scan
     direction. A cell that has already reacted is skipped for the rest of
     the tick, which keeps the pass order-independent in practice.
     ------------------------------------------------------------------ */
  Sim.prototype.reactPass = function () {
    var W = this.W, H = this.H;
    var mat = this.mat, temp = this.temp, aux = this.aux, reacted = this.reacted;
    var N = MAT.COUNT, RX = MAT.RX;
    var freezeAt = MAT.freezeAt, meltAt = MAT.meltAt;
    var freezeTo = MAT.freezeToId, meltTo = MAT.meltToId;
    var latent = MAT.latent, latentMelt = MAT.latentMelt;
    var lifetime = MAT.lifetimeArr, decayTo = MAT.decayToId, burn = MAT.burnArr;
    var invHC = MAT.invHeatCapacity;

    reacted.fill(0);

    var i, x, y, id, t;

    /* --- 2a. single-cell transitions ------------------------------- */
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        id = mat[i];
        if (id === VOID || MAT.isIndestructible[id]) continue;
        t = temp[i];

        /* Burning materials pump heat into themselves *and* their
           surroundings for as long as they live. The outward share is what
           makes fire spread: flame is a gas, so it leaves the fuel almost
           immediately, and without radiated heat a pool of oil lit at one
           end would never catch along its length. */
        if (burn[id] > 0) {
          temp[i] = t = t + burn[id] * invHC[id];
          this._spreadLatent(i, burn[id] * BURN_SPREAD);
        }

        /* Gas lifetime. Flames burn out into ash; steam declared with a
           lifetime simply disperses. */
        if (lifetime[id] > 0) {
          aux[i]++;
          if (aux[i] >= lifetime[id]) {
            mat[i] = decayTo[id] >= 0 ? decayTo[id] : VOID;
            aux[i] = 0;
            reacted[i] = 1;
            continue;
          }
        }

        if (meltTo[id] >= 0 && t >= meltAt[id]) {
          mat[i] = meltTo[id];
          temp[i] = meltAt[id] + 0.5;
          aux[i] = 0;
          this._spreadLatent(i, -latentMelt[id]);
          reacted[i] = 1;
        } else if (freezeTo[id] >= 0 && t <= freezeAt[id]) {
          mat[i] = freezeTo[id];
          temp[i] = freezeAt[id] - 0.5;
          aux[i] = 0;
          this._spreadLatent(i, latent[id]);
          reacted[i] = 1;
        }
      }
    }

    /* --- 2b. pair reactions ---------------------------------------- */
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        if (reacted[i]) continue;
        id = mat[i];
        if (id === VOID) continue;

        /* right neighbour, then down neighbour */
        for (var d = 0; d < 2; d++) {
          var j;
          if (d === 0) { if (x >= W - 1) continue; j = i + 1; }
          else { if (y >= H - 1) continue; j = i + W; }
          if (reacted[j]) continue;

          var jd = mat[j];
          var rule = RX[id * N + jd];
          if (!rule) continue;
          if (Math.max(temp[i], temp[j]) < rule.minTemp) continue;
          if (rule.chance < 1 && CG.rand() >= rule.chance) continue;

          mat[i] = rule.becomes;
          mat[j] = rule.otherBecomes;
          temp[i] += rule.heat * invHC[rule.becomes];
          temp[j] += rule.heatOther * invHC[rule.otherBecomes];
          aux[i] = 0; aux[j] = 0;
          reacted[i] = 1; reacted[j] = 1;
          id = mat[i];
          break;
        }
      }
    }
  };

  /* ------------------------------------------------------------------
     PASS 3 — movement.

     Bottom row upward so a falling column resolves in one tick instead of
     one cell per tick. The x-scan direction alternates with the tick
     parity, otherwise every pile leans the same way forever.
     ------------------------------------------------------------------ */

  /* Can a cell of material `a` displace what is currently in cell j?
     Denser mobile matter sinks; lighter mobile matter rises. Static
     materials are immovable and never displaced. */
  Sim.prototype._canEnter = function (a, j, downward) {
    var b = this.mat[j];
    if (b === a) return false;
    if (MAT.isAbsorber[b]) return true;              // crucible swallows it
    if (!MAT.isMobile[b]) return false;
    var da = MAT.density[a], db = MAT.density[b];
    return downward ? (db < da) : (db > da);
  };

  Sim.prototype._swap = function (i, j) {
    var mat = this.mat, temp = this.temp, aux = this.aux;

    /* Delivery: mobile matter entering the crucible is consumed. */
    if (MAT.isAbsorber[mat[j]]) {
      var id = mat[i];
      this.absorbed[id]++;
      this.absorbedTotal++;
      /* the crucible takes the heat with it */
      temp[j] += (temp[i] - temp[j]) * 0.15;
      mat[i] = VOID;
      temp[i] = CG.AMBIENT;
      aux[i] = 0;
      this.dir[i] = 0;
      this.absorbEvents.push(id);
      if (this.absorbEvents.length > 64) this.absorbEvents.shift();
      this.moved[j] = 1;
      return;
    }

    var m = mat[i]; mat[i] = mat[j]; mat[j] = m;
    var t = temp[i]; temp[i] = temp[j]; temp[j] = t;
    var a = aux[i]; aux[i] = aux[j]; aux[j] = a;
    var d = this.dir[i]; this.dir[i] = this.dir[j]; this.dir[j] = d;
    this.moved[j] = 1;
  };

  Sim.prototype.movePass = function () {
    var W = this.W, H = this.H;
    var mat = this.mat, moved = this.moved;
    var kind = MAT.moveKind, flow = MAT.flowRate, repose = MAT.reposeArr;
    var LIQUID = MAT.LIQUID, POWDER = MAT.POWDER, GAS = MAT.GAS;

    moved.fill(0);

    var leftFirst = (this.tick & 1) === 0;

    for (var y = H - 1; y >= 0; y--) {
      for (var n = 0; n < W; n++) {
        var x = leftFirst ? n : (W - 1 - n);
        var i = y * W + x;
        if (moved[i]) continue;
        var id = mat[i];
        if (id === VOID || !MAT.isMobile[id]) continue;

        var k = kind[id];
        var dir = k === GAS ? -1 : 1;                 // gases go up
        var ny = y + dir;
        if (ny < 0 || ny >= H) {
          /* Gas that reaches the ceiling of an open chamber just sits. */
          continue;
        }
        var down = (dir === 1);

        /* 1. straight along gravity */
        var j = i + dir * W;
        if (this._canEnter(id, j, down)) { this._swap(i, j); continue; }

        /* 2. diagonals. Powders check their angle of repose first: a
              high-repose powder prefers to stack rather than slide. */
        if (k === POWDER && repose[id] > 0 && CG.rand() < repose[id]) {
          /* stayed put this tick — but still allow sinking through liquid
             below, which the straight test above already handled */
        } else {
          var first = ((this.tick + x + y) & 1) === 0 ? -1 : 1;
          for (var s = 0; s < 2; s++) {
            var sx = x + (s === 0 ? first : -first);
            if (sx < 0 || sx >= W) continue;
            var dj = ny * W + sx;
            /* do not squeeze diagonally through a solid corner */
            if (!MAT.isMobile[mat[y * W + sx]] && !MAT.isAbsorber[mat[y * W + sx]]) continue;
            if (this._canEnter(id, dj, down)) { this._swap(i, dj); break; }
          }
          if (mat[i] !== id) continue;
        }

        /* 3. lateral spread — what makes liquids level out and gases fill
              a chamber.

              A fluid keeps travelling in the direction it was already
              going and only reverses when that way is blocked. Picking a
              fresh direction every tick instead leaves a pool oscillating
              in a stable checkerboard rather than settling flat.

              One cell per tick is 60 cells/second, which is fast enough
              for a pour to find a drain across a chamber and slow enough
              that the surface reads as a fluid rather than a teleport. */
        var fr = flow[id];
        if (fr > 0 && (k === LIQUID || k === GAS)) {
          /* `flow` doubles as viscosity: water (5) spreads every tick,
             lava and molten glass (2) only sometimes, so a pour of them
             reads as thick and slow without any extra state. */
          if (fr < 5 && CG.rand() * 5 >= fr) continue;

          var step = this.dir[i];
          if (step === 0) step = (CG.rand() < 0.5) ? -1 : 1;

          var lateral = 0;
          for (var attempt = 0; attempt < 2; attempt++) {
            var lx = x + step;
            if (lx >= 0 && lx < W && this._canEnter(id, y * W + lx, down)) {
              lateral = step;
              break;
            }
            step = -step;                            // blocked: turn around
          }

          if (lateral !== 0) {
            this.dir[i] = lateral;
            this._swap(i, i + lateral);
          } else {
            this.dir[i] = 0;
          }
        }
      }
    }
  };

  /* ------------------------------------------------------------------
     One simulation tick.
     ------------------------------------------------------------------ */
  Sim.prototype.step = function () {
    this.heatPass();
    this.reactPass();
    this.movePass();
    this.tick++;
  };

  /* Deterministic multi-tick advance, used by the tests and by the
     catch-up path in game.js. */
  Sim.prototype.steps = function (n) {
    for (var i = 0; i < n; i++) this.step();
  };

  /* A stable fingerprint of the whole world. Two runs that agree here
     agree everywhere; the determinism test compares these. */
  Sim.prototype.hash = function () {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < this.N; i++) {
      h ^= this.mat[i];
      h = Math.imul(h, 16777619) >>> 0;
      h ^= (this.temp[i] * 8) | 0;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  };

  CG.Sim = Sim;

})(window);
