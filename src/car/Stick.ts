import type RAPIER from '@dimforge/rapier3d-compat';
import { TUNING } from '../config/tuning';
import { allSurfaces, surfaceOf } from '../course/Surfaces';
import { Vec2, closestPointOnPolygon, dot, length, normalize, scale, sub } from '../util/vec2';
import { Car, RayHit } from './Car';

/**
 * C3 Stick: while the Stick action is held, the car clings to marked surfaces
 * (L3, P1). "Down" becomes the surface, so the car drives up walls, across
 * ceilings and around corners. Releasing, or hopping, drops it.
 */
export class Stick {
  /** Collider handle of the surface the car is stuck to. */
  private attached: number | null = null;
  private releaseTimer = 0;

  constructor(
    private readonly world: RAPIER.World,
    private readonly car: Car,
  ) {
    car.events.on('thrust', () => {
      this.releaseTimer = TUNING.stick.hopRelease;
      this.detach();
    });
  }

  get isAttached(): boolean {
    return this.attached !== null;
  }

  reset(): void {
    this.attached = null;
    this.releaseTimer = 0;
  }

  /** Call once per physics step, after Car.sense and before Car.step. */
  update(dt: number, held: boolean): void {
    this.releaseTimer = Math.max(0, this.releaseTimer - dt);
    if (!held || this.releaseTimer > 0 || this.car.isCrashed) {
      this.detach();
      return;
    }
    const surface = this.pickSurface();
    if (surface === null) {
      this.detach();
      return;
    }
    this.attached = surface;
    this.holdTo(surface);
  }

  // ---- Internals ----------------------------------------------------------

  private holdTo(handle: number): void {
    const car = this.car;
    // Normal from the nearest point on the surface: the face normal on a flat
    // face, and a direction that sweeps around the edge at a convex corner.
    const normal = this.normalFrom(handle);

    car.setStuck(true);
    car.setGravityOverride(scale(normal, -1), TUNING.stick.gravity);
    car.setDriveSpeed(TUNING.stick.driveSpeed);
    car.turnToward(Car.angleForUp(normal), TUNING.stick.alignRate);

    if (!car.wheelHits.some((h) => h?.collider.handle === handle)) {
      // Rounding a convex corner: cancel motion away from the surface so the car orbits the edge.
      const v = car.velocity;
      const away = dot(v, normal);
      if (away > 0) car.setVelocity(sub(v, scale(normal, away)));
    }
  }

  private pickSurface(): number | null {
    const car = this.car;
    const wheels = car.wheelHits.filter((h): h is RayHit => h !== null);
    const marked = (h: RayHit) => surfaceOf(h.collider)?.marked === true;

    // 1. Nose into a marked surface: climb onto it (floor to wall, wall to ceiling).
    const ahead = car.aheadHit;
    if (ahead && marked(ahead) && dot(ahead.normal, car.forward) < -0.5) return ahead.collider.handle;

    // 2. Wheels still on the current surface.
    if (this.attached !== null && wheels.some((h) => h.collider.handle === this.attached)) return this.attached;

    // 3. Wheels on unmarked ground: nothing to stick to.
    if (wheels.some((h) => !marked(h))) return null;

    // 4. Mid-corner or just off the current surface's edge: hold while it is within reach.
    if (this.attached !== null && this.distanceTo(this.attached) <= this.reach) return this.attached;

    // 5. Wheels on a new marked surface.
    const onMarked = wheels.find(marked);
    if (onMarked) return onMarked.collider.handle;

    // 6. In the air: grab the nearest marked surface within reach.
    return this.nearestMarked();
  }

  /** Centre-to-surface distance that still counts as holding on. */
  private get reach(): number {
    const { suspensionRest, wheelRadius } = TUNING.car;
    return suspensionRest + wheelRadius + TUNING.stick.reach;
  }

  private nearestMarked(): number | null {
    let best: number | null = null;
    let bestDist = this.reach;
    for (const [handle, surface] of allSurfaces()) {
      if (!surface.marked) continue;
      const d = this.distanceTo(handle);
      if (d <= bestDist) {
        best = handle;
        bestDist = d;
      }
    }
    return best;
  }

  private distanceTo(handle: number): number {
    return length(this.offsetFrom(handle));
  }

  private normalFrom(handle: number): Vec2 {
    return normalize(this.offsetFrom(handle));
  }

  private offsetFrom(handle: number): Vec2 {
    const p = this.car.position;
    const outline = surfaceOf(this.world.getCollider(handle))?.outline ?? [];
    return outline.length ? sub(p, closestPointOnPolygon(p, outline)) : { x: Infinity, y: Infinity };
  }

  private detach(): void {
    if (this.attached === null) return;
    this.attached = null;
    this.car.setStuck(false);
    this.car.setGravityOverride(null);
    this.car.setDriveSpeed(null);
  }
}
