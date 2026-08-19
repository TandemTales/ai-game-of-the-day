/* =====================================================================
   ZEPHYR CIRCUIT — render/fx.js
   Particles and screen effects: drift sparks, boost trails, speed lines,
   dust, impacts, respawn.
   Owner: agent-particles. See SPEC.md §0.

   ESM. Reads window.ZC and the karts it is handed; never writes to ZC.

   ---------------------------------------------------------------------
   CONTRACT — main.js (lead) calls exactly these. Do not change the
   signatures; if you need more, report it and the lead will wire it.

     createFX(scene, track) -> fx
       Build every buffer and material ONCE, here. The frame loop must not
       allocate: no `new THREE.Vector3()` in update(), no geometry
       rebuilds, no material creation. Use pooled BufferGeometry with
       pre-allocated attributes and move the live count, or InstancedMesh
       with a per-frame instance count.

     fx.update(ctx)
       ctx = { karts, player, camera, dt, time, phase }
         karts   the full field, ZC.Race.state.karts, in roster order
         player  the kart the camera is following (may be an AI in attract)
         camera  the live THREE.PerspectiveCamera
         dt      seconds since the last frame, already clamped to <= 1/20
         time    seconds since page load, monotonic
         phase   ZC.Race.state.phase
     fx.setQuality(tier)   0 low, 1 medium, 2 high. Scale particle budgets.
     fx.dispose()          free geometry/materials when the scene rebuilds.
                           Also remove any ZC.on listeners you registered.

   ---------------------------------------------------------------------
   Kart fields (the real ones — see kart.js K.create):
     x, y, z, travelYaw (direction of motion), bodyYaw (where the shell
     points), speed, vy, slip, grounded, onRoad, surfaceY, seg, s,
     t (normalised lateral, |t|>1 is off-road),
     drift:{active,dir,charge,tier}, boost (seconds remaining),
     item, itemRoll, spin, spinAngle, shield, falling, respawnTimer,
     lap, place, finished, colour, id, isPlayer

   Events already emitted by the logic half — subscribe with ZC.on(name,
   fn); this is cheaper and more exact than diffing state:
     kart:driftStart {kart}      kart:driftTier {kart, tier}
     kart:boost {kart, ...}      kart:fell {kart}
     kart:hit {kart, source}     kart:spinEnd {kart}
     kart:shieldBreak {kart}     kart:lap {kart}
     kart:finish {kart}
     item:pickup / item:use / item:hit / item:expire / item:boxReturn
     race:countdown / race:go / race:results
   Register listeners in createFX and drop them in dispose(). Do the work
   in update() — a listener should only push into a queue or spawn from a
   pool, never build geometry.
   ===================================================================== */

/* Placeholder implementation: correct shape, no effects yet.
   agent-particles replaces the body of this file. */
export function createFX(/* scene, track */) {
  return {
    update() {},
    setQuality() {},
    dispose() {},
  };
}
