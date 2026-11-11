// Thin wrapper over the static BVH and capsule controller derived from
// mshumer/Claude-of-Duty (MIT). See third_party/NOTICES.md.
import { StaticWorld } from './bvh.js';
import { CharacterController } from './character.js';
import { makeHitRecord, rayCapsule } from './math.js';
import { LAYER, MASK, surfaceName } from './surfaces.js';

export { LAYER, MASK };

/**
 * Collision for the whole game. Static level geometry goes in a BVH; moving
 * capsules (enemies) are registered as targets and ray-tested separately.
 *
 *   physics.addStatic(meshOrGroup, 'dirt')   before physics.build()
 *   physics.createCharacter({ radius, height })
 *   physics.trace(origin, dir, maxDist)      nearest of world and targets
 */
export class PhysicsSystem {
  static id = 'physics';
  static deps = [];

  init() {
    this.world = new StaticWorld();
    this.targets = new Set();
    this._hit = makeHitRecord();
    this._down = makeHitRecord();
    this.result = { hit: false, t: 0, point: [0, 0, 0], normal: [0, 1, 0], surface: 'dirt', target: null };
  }

  /** Add a Mesh, InstancedMesh or any Object3D tree as solid level geometry. */
  addStatic(object, surface, mask = LAYER.STATIC) {
    object.updateWorldMatrix(true, true);
    object.traverse((o) => {
      if ((o.isMesh || o.isInstancedMesh) && o.userData.solid !== false) {
        this.world.addMesh(o, surface ?? o.userData.surface, mask);
      }
    });
  }

  build() {
    this.world.build();
  }

  /** Lets level code query the ground while it is still placing things. */
  _ensureBuilt() {
    if (this.world.dirty) this.world.build();
  }

  createCharacter(opts = {}) {
    return new CharacterController(this.world, { radius: 0.32, height: 1.78, ...opts });
  }

  /** Register a shootable capsule: { ax,ay,az, bx,by,bz, r, owner }. */
  addTarget(t) {
    this.targets.add(t);
    return t;
  }

  removeTarget(t) {
    this.targets.delete(t);
  }

  /** Nearest hit of level geometry and registered targets, or result.hit=false. */
  trace(o, d, maxDist = 200, opts = {}) {
    const r = this.result;
    const hit = this._hit;
    r.hit = false;
    r.target = null;
    let best = maxDist;

    if (this.world.raycast(o[0], o[1], o[2], d[0], d[1], d[2], maxDist, opts.mask ?? MASK.WORLD, hit)) {
      best = hit.t;
      r.hit = true;
      r.t = hit.t;
      r.point[0] = hit.px;
      r.point[1] = hit.py;
      r.point[2] = hit.pz;
      r.normal[0] = hit.nx;
      r.normal[1] = hit.ny;
      r.normal[2] = hit.nz;
      r.surface = surfaceName(hit.surface);
    }

    if (opts.targets !== false) {
      for (const c of this.targets) {
        if (opts.ignore === c.owner) continue;
        const t = rayCapsule(o[0], o[1], o[2], d[0], d[1], d[2], c.ax, c.ay, c.az, c.bx, c.by, c.bz, c.r, best);
        if (t >= 0 && t < best) {
          best = t;
          r.hit = true;
          r.t = t;
          r.point[0] = o[0] + d[0] * t;
          r.point[1] = o[1] + d[1] * t;
          r.point[2] = o[2] + d[2] * t;
          r.normal[0] = -d[0];
          r.normal[1] = -d[1];
          r.normal[2] = -d[2];
          r.surface = 'flesh';
          r.target = c;
        }
      }
    }
    return r;
  }

  /** Clear line between two points against level geometry only. */
  lineOfSight(a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-5) return true;
    return !this.world.raycastAny(a[0], a[1], a[2], dx / len, dy / len, dz / len, len, MASK.SIGHT);
  }

  /** Height of the ground under (x, z), or null over a void. */
  /**
   * The ground under (x, z): the highest surface below `fromY`. Indoor levels with tall
   * solid furniture (racking, shelving) set `physics.probeY` just under its top, so the
   * tops never count as floor for pathing, spawns or enemies.
   */
  groundHeight(x, z, fromY = this.probeY ?? 200) {
    this._ensureBuilt();
    const hit = this._down;
    return this.world.raycast(x, fromY, z, 0, -1, 0, fromY + 200, MASK.WORLD, hit) ? hit.py : null;
  }
}
