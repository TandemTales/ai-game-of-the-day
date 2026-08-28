/* =====================================================================
   STORMHOOK — physics.js   [OWNER: lead]

   The player body, the tether, and the rope solver. This is the only
   module allowed to move the player (SPEC §1).

   Everything here is deterministic and fixed-step: no Math.random, no
   Date, no reads of anything that varies per frame rate. `step()` is one
   1/120s tick.
   ===================================================================== */
(function (global) {
  'use strict';

  var SH = global.SH || (global.SH = {});
  var P = SH.Physics = {};

  var TILE = 48;                     // mirrored from SH.TILE at init
  var EPS = 1e-6;

  /* ------------------------------------------------------------------
     Tile queries
     ------------------------------------------------------------------ */

  /* Levels are sealed left and right: off the side of the map reads as
     solid so the rope and body cannot leave. Above and below read as
     open — falling off the bottom is a legitimate way to die. */
  function tileAt(w, tx, ty) {
    if (tx < 0 || tx >= w.w) return '#';
    if (ty < 0 || ty >= w.h) return '.';
    return w.grid[ty].charAt(tx) || '.';
  }
  function isSolidChar(c) { return c === '#' || c === '='; }
  function solidAt(w, tx, ty) { return isSolidChar(tileAt(w, tx, ty)); }
  P.solidAt = solidAt;

  function solidAtPoint(w, x, y) {
    return solidAt(w, Math.floor(x / TILE), Math.floor(y / TILE));
  }
  P.solidAtPoint = solidAtPoint;

  /* ------------------------------------------------------------------
     Grid DDA. Walks the tiles a segment passes through, in order.
     `visit(tx,ty,tEnter,nx,ny)` returns true to stop the walk.
     ------------------------------------------------------------------ */
  function walkGrid(x0, y0, dx, dy, maxDist, visit) {
    var tx = Math.floor(x0 / TILE), ty = Math.floor(y0 / TILE);
    var stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
    var stepY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);
    var invDx = dx !== 0 ? 1 / dx : Infinity;
    var invDy = dy !== 0 ? 1 / dy : Infinity;

    var nextX = (tx + (stepX > 0 ? 1 : 0)) * TILE;
    var nextY = (ty + (stepY > 0 ? 1 : 0)) * TILE;
    var tMaxX = stepX !== 0 ? (nextX - x0) * invDx : Infinity;
    var tMaxY = stepY !== 0 ? (nextY - y0) * invDy : Infinity;
    var tDeltaX = stepX !== 0 ? TILE * Math.abs(invDx) : Infinity;
    var tDeltaY = stepY !== 0 ? TILE * Math.abs(invDy) : Infinity;

    var t = 0, nx = 0, ny = 0;
    var guard = 0, GUARD_MAX = 4096;
    if (visit(tx, ty, 0, 0, 0)) return;

    while (t <= maxDist && guard++ < GUARD_MAX) {
      if (tMaxX < tMaxY) {
        tx += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0;
      } else {
        ty += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY;
      }
      if (t > maxDist) return;
      if (visit(tx, ty, t, nx, ny)) return;
    }
  }

  /* Cast a ray. dx,dy need not be normalised — they are normalised here.
     Returns the first solid hit as {x,y,tx,ty,nx,ny,dist} or null. */
  P.rayCast = function (w, x, y, dx, dy, maxDist) {
    var l = SH.len(dx, dy);
    if (l < EPS) return null;
    dx /= l; dy /= l;
    var out = null;
    walkGrid(x, y, dx, dy, maxDist, function (tx, ty, t, nx, ny) {
      if (!solidAt(w, tx, ty)) return false;
      if (t === 0) {
        /* Started inside a solid tile — latch right where we are. */
        out = { x: x, y: y, tx: tx, ty: ty, nx: 0, ny: -1, dist: 0 };
        return true;
      }
      out = { x: x + dx * t, y: y + dy * t, tx: tx, ty: ty, nx: nx, ny: ny, dist: t };
      return true;
    });
    return out;
  };

  /* Is the straight segment a→b obstructed? Both ends are pulled in
     slightly so a pivot sitting on a surface does not report itself. */
  P.segBlocked = function (w, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var l = SH.len(dx, dy);
    if (l < 1e-3) return false;
    var ux = dx / l, uy = dy / l;
    var SHRINK = Math.min(1.2, l * 0.25);
    var sx = ax + ux * SHRINK, sy = ay + uy * SHRINK;
    var span = l - SHRINK * 2;
    if (span <= 0) return false;
    var blocked = false;
    walkGrid(sx, sy, ux, uy, span, function (tx, ty) {
      if (solidAt(w, tx, ty)) { blocked = true; return true; }
      return false;
    });
    return blocked;
  };

  /* ------------------------------------------------------------------
     World construction
     ------------------------------------------------------------------ */
  P.makeWorld = function (levelIndex) {
    TILE = SH.TILE;
    var lv = SH.Levels.get(levelIndex);
    var grid = lv.grid.slice();
    var w = {
      levelIndex: levelIndex,
      level: lv,
      grid: grid,
      w: lv.w,
      h: lv.h,
      p: { x: 0, y: 0, vx: 0, vy: 0, r: 15, onGround: false, dashCd: 0, alive: true,
           facing: 1, lastGroundT: 0 },
      hook: { attached: false, pivots: [], len: 0, aimX: 0, aimY: 0, t: 0, cool: 0 },
      cores: [],
      hazards: [],
      beacon: { x: 0, y: 0, hit: false },
      storm: { x: 0, speed: lv.stormSpeed || 0 },
      aim: { x: 0, y: 0 },
      airTime: 0,
      combo: 1,
      time: 0,
      cores_taken: 0,
      cleared: false,
      dead: false,
      deathCause: '',
      pending: []                      // drained by game.js each frame
    };

    for (var ty = 0; ty < lv.h; ty++) {
      for (var tx = 0; tx < lv.w; tx++) {
        var c = grid[ty].charAt(tx);
        var cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
        if (c === 'S') { w.p.x = cx; w.p.y = cy; }
        else if (c === 'X') { w.beacon.x = cx; w.beacon.y = cy; }
        else if (c === 'o') { w.cores.push({ x: cx, y: cy, taken: false, tx: tx, ty: ty }); }
        else if (c === '^') { w.hazards.push({ x: cx, y: cy, tx: tx, ty: ty }); }
      }
    }

    /* The storm starts a comfortable screen behind the player. */
    w.storm.x = w.p.x - lv.stormLead * TILE;
    w.aim.x = w.p.x + 200;
    w.aim.y = w.p.y - 120;
    return w;
  };

  /* ------------------------------------------------------------------
     Body vs tiles. A circle, not a box: it slides around hull corners
     instead of snagging on them, which matters constantly in a game
     where you are arcing past edges at speed.
     ------------------------------------------------------------------ */
  function resolveBody(w) {
    var p = w.p, r = p.r;
    p.onGround = false;

    for (var iter = 0; iter < 3; iter++) {
      var bestPen = 0, bnx = 0, bny = 0;
      var tx0 = Math.floor((p.x - r) / TILE), tx1 = Math.floor((p.x + r) / TILE);
      var ty0 = Math.floor((p.y - r) / TILE), ty1 = Math.floor((p.y + r) / TILE);

      for (var ty = ty0; ty <= ty1; ty++) {
        for (var tx = tx0; tx <= tx1; tx++) {
          if (!solidAt(w, tx, ty)) continue;
          var rx0 = tx * TILE, ry0 = ty * TILE, rx1 = rx0 + TILE, ry1 = ry0 + TILE;
          /* Closest point on the tile rect to the circle centre. */
          var qx = SH.clamp(p.x, rx0, rx1), qy = SH.clamp(p.y, ry0, ry1);
          var dx = p.x - qx, dy = p.y - qy;
          var d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;

          var d = Math.sqrt(d2), nx, ny, pen;
          if (d > EPS) {
            nx = dx / d; ny = dy / d; pen = r - d;
          } else {
            /* Centre is inside the tile — push out the shallowest face. */
            var left = p.x - rx0, right = rx1 - p.x, up = p.y - ry0, down = ry1 - p.y;
            var m = Math.min(left, right, up, down);
            if (m === left) { nx = -1; ny = 0; pen = left + r; }
            else if (m === right) { nx = 1; ny = 0; pen = right + r; }
            else if (m === up) { nx = 0; ny = -1; pen = up + r; }
            else { nx = 0; ny = 1; pen = down + r; }
          }
          if (pen > bestPen) { bestPen = pen; bnx = nx; bny = ny; }
        }
      }

      if (bestPen <= 0) break;
      p.x += bnx * bestPen;
      p.y += bny * bestPen;
      var vn = p.vx * bnx + p.vy * bny;
      if (vn < 0) { p.vx -= bnx * vn; p.vy -= bny * vn; }
      if (bny < -0.5) p.onGround = true;
    }
  }

  /* ------------------------------------------------------------------
     Rope: wrapping and unwrapping (SPEC §2b)
     ------------------------------------------------------------------ */

  function segSum(pivots) {
    var s = 0;
    for (var i = 0; i + 1 < pivots.length; i++) {
      s += SH.dist(pivots[i].x, pivots[i].y, pivots[i + 1].x, pivots[i + 1].y);
    }
    return s;
  }

  function crossSign(ax, ay, bx, by) {
    var c = ax * by - ay * bx;
    return c > 1e-9 ? 1 : (c < -1e-9 ? -1 : 0);
  }

  /* Is this tile-grid corner one a rope could actually catch on? It has
     to sit on a boundary — some solid around it and some air. */
  function cornerExposed(w, gx, gy) {
    var n = 0;
    if (solidAt(w, gx - 1, gy - 1)) n++;
    if (solidAt(w, gx, gy - 1)) n++;
    if (solidAt(w, gx - 1, gy)) n++;
    if (solidAt(w, gx, gy)) n++;
    return n >= 1 && n <= 3;
  }

  /* Nudge the pivot off the surface, away from whatever solid is there,
     so the two sub-segments do not immediately read as blocked. */
  function cornerPoint(w, gx, gy) {
    var px = gx * TILE, py = gy * TILE;
    var ax = 0, ay = 0;
    if (solidAt(w, gx - 1, gy - 1)) { ax += 1; ay += 1; }
    if (solidAt(w, gx, gy - 1)) { ax -= 1; ay += 1; }
    if (solidAt(w, gx - 1, gy)) { ax += 1; ay -= 1; }
    if (solidAt(w, gx, gy)) { ax -= 1; ay -= 1; }
    var l = SH.len(ax, ay);
    var OFF = 2.5;
    if (l > EPS) { px += (ax / l) * OFF; py += (ay / l) * OFF; }
    return { x: px, y: py };
  }

  /* The rope from `last` to the player is blocked. Find the corner it
     should catch on: the one giving the shortest unobstructed two-leg
     path. */
  function findWrapCorner(w, last, px, py) {
    var dx = px - last.x, dy = py - last.y;
    var l = SH.len(dx, dy);
    if (l < EPS) return null;
    var ux = dx / l, uy = dy / l;

    /* Collect the first handful of solid tiles the segment crosses. */
    var tiles = [], seen = {};
    walkGrid(last.x, last.y, ux, uy, l, function (tx, ty) {
      if (!solidAt(w, tx, ty)) return false;
      var k = tx + ',' + ty;
      if (!seen[k]) { seen[k] = 1; tiles.push([tx, ty]); }
      return tiles.length >= 6;
    });
    if (!tiles.length) return null;

    var best = null, bestCost = Infinity, cseen = {};
    for (var i = 0; i < tiles.length; i++) {
      var tx = tiles[i][0], ty = tiles[i][1];
      for (var oy = 0; oy <= 1; oy++) {
        for (var ox = 0; ox <= 1; ox++) {
          var gx = tx + ox, gy = ty + oy;
          var key = gx + ',' + gy;
          if (cseen[key]) continue;
          cseen[key] = 1;
          if (!cornerExposed(w, gx, gy)) continue;
          var c = cornerPoint(w, gx, gy);
          var cost = SH.dist(last.x, last.y, c.x, c.y) + SH.dist(c.x, c.y, px, py);
          if (cost >= bestCost) continue;
          if (P.segBlocked(w, last.x, last.y, c.x, c.y)) continue;
          if (P.segBlocked(w, c.x, c.y, px, py)) continue;
          bestCost = cost; best = c;
        }
      }
    }
    return best;
  }

  function updateRope(w) {
    var hk = w.hook, p = w.p;
    if (!hk.attached || !hk.pivots.length) return;

    /* --- unwrap: has the turn at the last pivot come undone? --- */
    var guard = 0;
    while (hk.pivots.length >= 2 && guard++ < 8) {
      var n = hk.pivots.length;
      var last = hk.pivots[n - 1], prev = hk.pivots[n - 2];
      var s = crossSign(last.x - prev.x, last.y - prev.y, p.x - last.x, p.y - last.y);
      if (s === last.s || s === 0) break;
      if (P.segBlocked(w, prev.x, prev.y, p.x, p.y)) break;
      hk.pivots.pop();
    }

    /* --- wrap: has the rope caught on something? --- */
    guard = 0;
    while (guard++ < 4) {
      var lastP = hk.pivots[hk.pivots.length - 1];
      if (!P.segBlocked(w, lastP.x, lastP.y, p.x, p.y)) break;
      var c = findWrapCorner(w, lastP, p.x, p.y);
      if (!c) break;
      c.s = crossSign(c.x - lastP.x, c.y - lastP.y, p.x - c.x, p.y - c.y);
      if (c.s === 0) break;
      hk.pivots.push(c);
    }
  }

  function applyRopeConstraint(w) {
    var hk = w.hook, p = w.p;
    if (!hk.attached || !hk.pivots.length) return;
    var last = hk.pivots[hk.pivots.length - 1];
    var used = segSum(hk.pivots);
    var eff = Math.max(SH.TUNE.minLen, hk.len - used);

    var dx = p.x - last.x, dy = p.y - last.y;
    var d = SH.len(dx, dy);
    if (d <= eff || d < EPS) return;         // slack rope does nothing

    var nx = dx / d, ny = dy / d;
    p.x = last.x + nx * eff;
    p.y = last.y + ny * eff;

    /* Kill the outward radial component only. The tangential component
       is kept in full — SPEC §2, that conservation is the game feel. */
    var vn = p.vx * nx + p.vy * ny;
    if (vn > 0) { p.vx -= nx * vn; p.vy -= ny * vn; }
  }

  /* ------------------------------------------------------------------
     Hook control
     ------------------------------------------------------------------ */
  P.fireHook = function (w) {
    var p = w.p, hk = w.hook;
    if (hk.cool > 0) return false;
    var dx = w.aim.x - p.x, dy = w.aim.y - p.y;
    if (SH.len(dx, dy) < EPS) return false;

    var hit = P.rayCast(w, p.x, p.y, dx, dy, SH.TUNE.maxRange);
    if (!hit) {
      hk.cool = 0.12;                        // a miss has a small cost
      w.pending.push({ type: 'hookMiss', x: p.x, y: p.y });
      return false;
    }

    /* Seat the anchor just off the surface it hit. */
    var ax = hit.x + hit.nx * 2, ay = hit.y + hit.ny * 2;
    hk.attached = true;
    hk.pivots = [{ x: ax, y: ay, s: 0 }];
    hk.len = SH.clamp(SH.dist(p.x, p.y, ax, ay), SH.TUNE.minLen, SH.TUNE.maxLen);
    hk.t = 0;
    hk.aimX = ax; hk.aimY = ay;
    w.pending.push({ type: 'hookHit', x: ax, y: ay });
    return true;
  };

  P.releaseHook = function (w) {
    var hk = w.hook;
    if (!hk.attached) return;
    hk.attached = false;
    hk.pivots = [];
    hk.t = 0;
    hk.cool = 0.05;
    w.pending.push({ type: 'hookRelease', x: w.p.x, y: w.p.y });
  };

  /* ------------------------------------------------------------------
     Pickups, hazards, storm
     ------------------------------------------------------------------ */
  function checkContacts(w) {
    var p = w.p;

    for (var i = 0; i < w.cores.length; i++) {
      var c = w.cores[i];
      if (c.taken) continue;
      if (SH.dist(p.x, p.y, c.x, c.y) < p.r + 20) {
        c.taken = true;
        w.cores_taken++;
        w.pending.push({ type: 'core', x: c.x, y: c.y, combo: w.combo });
      }
    }

    for (var j = 0; j < w.hazards.length; j++) {
      var hz = w.hazards[j];
      if (Math.abs(p.x - hz.x) < p.r + TILE * 0.36 &&
          Math.abs(p.y - hz.y) < p.r + TILE * 0.36) {
        kill(w, 'hazard');
        return;
      }
    }

    if (!w.cleared && SH.dist(p.x, p.y, w.beacon.x, w.beacon.y) < p.r + 30) {
      w.cleared = true;
      w.pending.push({ type: 'clear', x: w.beacon.x, y: w.beacon.y });
    }
  }

  function kill(w, cause) {
    if (w.dead || !w.p.alive) return;
    w.p.alive = false;
    w.dead = true;
    w.deathCause = cause;
    w.hook.attached = false;
    w.hook.pivots = [];
    w.pending.push({ type: 'death', cause: cause, x: w.p.x, y: w.p.y });
  }
  P.kill = kill;

  /* ------------------------------------------------------------------
     One fixed tick. The only mover.
     ------------------------------------------------------------------ */
  P.step = function (w, input, dt) {
    if (w.dead || w.cleared) {
      /* Still advance the clock-ish bits so VFX and the storm settle. */
      w.hook.cool = Math.max(0, w.hook.cool - dt);
      return;
    }

    TILE = SH.TILE;
    var T = SH.TUNE, p = w.p, hk = w.hook;
    w.time += dt;
    hk.cool = Math.max(0, hk.cool - dt);
    hk.t = Math.min(1, hk.t + dt * 14);
    p.dashCd = Math.max(0, p.dashCd - dt);

    /* --- hook input --- */
    if (input.hookPressed && !hk.attached) P.fireHook(w);
    if (input.hookReleased && hk.attached) P.releaseHook(w);

    /* --- reel --- */
    if (hk.attached && input.reel) {
      var used = segSum(hk.pivots);
      hk.len = SH.clamp(hk.len + input.reel * T.reelSpeed * dt,
                        used + T.minLen, T.maxLen);
    }

    /* --- dash --- */
    if (input.dashPressed && p.dashCd <= 0) {
      var ax = w.aim.x - p.x, ay = w.aim.y - p.y;
      var al = SH.len(ax, ay);
      if (al > EPS) {
        p.vx = (ax / al) * T.dashSpeed;
        p.vy = (ay / al) * T.dashSpeed;
        p.dashCd = T.dashCooldown;
        w.pending.push({ type: 'dash', x: p.x, y: p.y, dx: ax / al, dy: ay / al });
      }
    }

    /* --- forces --- */
    p.vy += T.gravity * dt;
    if (input.lean) p.vx += input.lean * T.leanAccel * dt;

    if (p.onGround) {
      p.vx = SH.damp(p.vx, 0, T.groundFriction * (input.lean ? 0.15 : 1), dt);
    } else {
      /* Quadratic-ish air drag, applied gently so swings stay lively. */
      var sp = SH.len(p.vx, p.vy);
      if (sp > 1) {
        var k = 1 - T.airDrag * dt * (0.4 + sp / T.maxAirSpeed);
        p.vx *= k; p.vy *= k;
      }
    }

    var spd = SH.len(p.vx, p.vy);
    if (spd > T.maxAirSpeed) { p.vx = p.vx / spd * T.maxAirSpeed; p.vy = p.vy / spd * T.maxAirSpeed; }

    /* --- integrate, then satisfy the rope, then the world --- */
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    updateRope(w);
    applyRopeConstraint(w);
    resolveBody(w);

    if (Math.abs(p.vx) > 8) p.facing = p.vx > 0 ? 1 : -1;

    /* --- airtime / combo (SPEC §8 rule 2) --- */
    if (p.onGround) {
      if (w.airTime > 0) w.pending.push({ type: 'comboBreak', at: w.airTime });
      w.airTime = 0;
    } else {
      w.airTime += dt;
    }
    w.combo = SH.clamp(1 + Math.floor(w.airTime / T.comboAirTime), 1, T.comboMax);

    /* --- storm --- */
    w.storm.x += w.storm.speed * dt;
    if (p.x - p.r < w.storm.x) { kill(w, 'storm'); return; }

    /* --- fell out of the world --- */
    if (p.y > (w.h + 4) * TILE) { kill(w, 'fall'); return; }

    checkContacts(w);
  };

  /* Effective rope length at the working end — render and UI both want
     this and neither should be re-deriving it. */
  P.ropeInfo = function (w) {
    var hk = w.hook;
    if (!hk.attached || !hk.pivots.length) return null;
    var used = segSum(hk.pivots);
    return {
      anchor: hk.pivots[0],
      last: hk.pivots[hk.pivots.length - 1],
      pivots: hk.pivots,
      used: used,
      eff: Math.max(SH.TUNE.minLen, hk.len - used),
      total: hk.len
    };
  };

})(typeof window !== 'undefined' ? window : this);
