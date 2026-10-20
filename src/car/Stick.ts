import Phaser from 'phaser';
import { MARKED_SURFACE_LABEL, TUNING } from '../config/tuning';
import { Vec, closestPointOnPolygon, dot, length, normalize, scale, sub } from '../util/vec';
import { Car, CarEvent, Contact } from './Car';

/**
 * C3 Stick: while the Stick action is held, the car clings to marked surfaces
 * (L3, P1). "Down" becomes the surface, so the car drives up walls, across
 * ceilings and around corners. Releasing, or hopping, drops it.
 */
export class Stick {
  private attached: MatterJS.BodyType | null = null;
  private releaseTimer = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly car: Car,
  ) {
    car.events.on(CarEvent.Thrust, () => {
      this.releaseTimer = TUNING.stick.hopRelease;
      this.detach();
    });
  }

  get isAttached(): boolean {
    return this.attached !== null;
  }

  /** Call once per frame, before Car.update. */
  update(dt: number, held: boolean): void {
    this.releaseTimer = Math.max(0, this.releaseTimer - dt);
    if (!held || this.releaseTimer > 0 || this.car.isCrashed) {
      this.detach();
      return;
    }

    const surface = this.pickSurface();
    if (!surface) {
      this.detach();
      return;
    }
    this.attached = surface;
    this.holdTo(surface, dt);
  }

  // ---- Internals ----------------------------------------------------------

  private holdTo(surface: MatterJS.BodyType, dt: number): void {
    const car = this.car;
    // Normal from the nearest point on the surface: the face normal on a flat
    // face, and a direction that sweeps around the edge at a convex corner.
    // (Matter's own contact normals can point along an end face at seams.)
    const normal = this.normalFrom(surface);

    car.setStuck(true);
    car.setGravityOverride(scale(normal, -1), TUNING.stick.gravity);
    car.setDriveSpeed(TUNING.stick.driveSpeed);
    car.rotateToward(Car.angleForUp(normal), TUNING.stick.alignRate * dt);

    if (!car.contacts.some((c) => c.body === surface)) {
      // Rounding a convex corner: cancel motion away from the surface so the car orbits the edge.
      const v = car.velocity;
      const away = dot(v, normal);
      if (away > 0) car.setVelocity(sub(v, scale(normal, away)));
    }
  }

  private pickSurface(): MatterJS.BodyType | null {
    const car = this.car;
    const marked = car.contacts.filter((c) => isMarked(c.body));

    // 1. Nose into a marked surface: climb onto it (floor to wall, wall to ceiling).
    const ahead = marked.find((c) => dot(c.normal, car.forward) < -0.5);
    if (ahead) return ahead.body;

    // 2. Wheels still on the current surface.
    const onWheels = (c: Contact) => dot(c.normal, car.up) > 0.5;
    if (this.attached && marked.some((c) => c.body === this.attached && onWheels(c))) return this.attached;

    // 3. Wheels on unmarked ground: nothing to stick to.
    if (car.contacts.some((c) => !isMarked(c.body) && onWheels(c))) return null;

    // 4. Mid-corner or just off the current surface's edge: hold while it is within reach.
    if (this.attached && this.distanceTo(this.attached) <= this.reach) return this.attached;

    // 5. Touching a new marked surface: take the one under the wheels.
    if (marked.length > 0) return bestUnderWheels(marked, car.up).body;

    // 6. In the air: grab the nearest marked surface within reach.
    return this.nearestMarked();
  }

  private get reach(): number {
    return TUNING.car.height / 2 + TUNING.stick.reach;
  }

  private nearestMarked(): MatterJS.BodyType | null {
    const bodies = this.scene.matter.world.getAllBodies() as MatterJS.BodyType[];
    let best: MatterJS.BodyType | null = null;
    let bestDist = this.reach;
    for (const body of bodies) {
      if (!isMarked(body)) continue;
      const d = this.distanceTo(body);
      if (d <= bestDist) {
        best = body;
        bestDist = d;
      }
    }
    return best;
  }

  private distanceTo(body: MatterJS.BodyType): number {
    const p = this.car.position;
    return length(sub(p, closestPointOnPolygon(p, body.vertices ?? [])));
  }

  private normalFrom(body: MatterJS.BodyType): Vec {
    const p = this.car.position;
    return normalize(sub(p, closestPointOnPolygon(p, body.vertices ?? [])));
  }

  private detach(): void {
    if (!this.attached) return;
    this.attached = null;
    this.car.setStuck(false);
    this.car.setGravityOverride(null);
    this.car.setDriveSpeed();
  }
}

const isMarked = (body: MatterJS.BodyType): boolean => body.label === MARKED_SURFACE_LABEL;

const bestUnderWheels = (contacts: Contact[], up: Vec): Contact =>
  contacts.reduce((best, c) => (dot(c.normal, up) > dot(best.normal, up) ? c : best));
