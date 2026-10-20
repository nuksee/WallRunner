import Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { Vec, add, angleDelta, dot, fromAngle, normalize, scale, vec } from '../util/vec';

/**
 * C1 Car physics: auto-throttle, brake, gravity, rotation and flip detection.
 *
 * The car is one Matter.js body that ignores world gravity and applies its own,
 * so C3 Stick can redirect "down" toward a marked surface. Everything else
 * talks to the car through this class's public methods and `events`.
 */

export const CarEvent = {
  /** The car's roof hit a floor while it was not stuck to anything. Fired once. */
  UpsideDown: 'upside-down',
  /** A thrust impulse was applied (C2 Hop). Payload: direction Vec. */
  Thrust: 'thrust',
} as const;

export interface Contact {
  body: MatterJS.BodyType;
  /** Unit surface normal pointing from the surface toward the car. */
  normal: Vec;
}

/** Matter velocities are per 1/60 s step; tuning is in px/s. */
const STEP_PER_SECOND = 60;
const WORLD_UP = vec(0, -1);
const TEXTURE_KEY = 'car';

interface MatterPair {
  bodyA: MatterJS.BodyType;
  bodyB: MatterJS.BodyType;
  collision: { normal: Vec; supports: Vec[] };
}

export class Car {
  readonly sprite: Phaser.Physics.Matter.Image;
  readonly body: MatterJS.BodyType;
  readonly events = new Phaser.Events.EventEmitter();

  private contactsThisStep: Contact[] = [];
  private gravityDir: Vec = vec(0, 1);
  private gravityStrength: number = TUNING.world.gravity;
  private driveSpeed: number = TUNING.car.cruiseSpeed;
  private readonly bodyApi: MatterJS.BodyFactory;
  private stuck = false;
  private crashed = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const { width, height, friction } = TUNING.car;
    Car.ensureTexture(scene, width, height);

    this.sprite = scene.matter.add.image(x, y, TEXTURE_KEY, undefined, {
      shape: { type: 'rectangle', width, height },
      chamfer: { radius: 8 },
      friction,
      frictionStatic: 0,
      frictionAir: 0,
      ignoreGravity: true,
      label: 'car',
    });
    this.body = this.sprite.body as MatterJS.BodyType;
    this.bodyApi = scene.matter.body;

    const world = scene.matter.world;
    world.on('beforeupdate', this.clearContacts, this);
    world.on('collisionstart', this.collectContacts, this);
    world.on('collisionactive', this.collectContacts, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      world.off('beforeupdate', this.clearContacts, this);
      world.off('collisionstart', this.collectContacts, this);
      world.off('collisionactive', this.collectContacts, this);
      this.events.removeAllListeners();
    });
  }

  // ---- Read-only state -------------------------------------------------

  get position(): Vec {
    return vec(this.body.position.x, this.body.position.y);
  }

  get angle(): number {
    return this.body.angle;
  }

  /** Unit vector the car drives toward. */
  get forward(): Vec {
    return fromAngle(this.body.angle);
  }

  /** Unit vector out of the car's roof. */
  get up(): Vec {
    return vec(Math.sin(this.body.angle), -Math.cos(this.body.angle));
  }

  /** Velocity in px/s. */
  get velocity(): Vec {
    return scale(this.bodyApi.getVelocity(this.body), STEP_PER_SECOND);
  }

  /** Surfaces touched during the last physics step. */
  get contacts(): readonly Contact[] {
    return this.contactsThisStep;
  }

  /** True when the wheels (not the roof or nose) touch a surface. */
  get isGrounded(): boolean {
    return this.wheelContacts().length > 0;
  }

  get isCrashed(): boolean {
    return this.crashed;
  }

  /** Converts a car angle to the roof direction it produces. */
  static angleForUp(up: Vec): number {
    return Math.atan2(up.x, -up.y);
  }

  // ---- Commands from other components ---------------------------------

  setVelocity(v: Vec): void {
    this.bodyApi.setVelocity(this.body, scale(v, 1 / STEP_PER_SECOND));
  }

  /** Replace world gravity with a pull toward a surface (C3), or pass null to restore it. */
  setGravityOverride(dir: Vec | null, strength: number = TUNING.world.gravity): void {
    this.gravityDir = dir ? normalize(dir) : vec(0, 1);
    this.gravityStrength = dir ? strength : TUNING.world.gravity;
  }

  setDriveSpeed(speed: number = TUNING.car.cruiseSpeed): void {
    this.driveSpeed = speed;
  }

  /** While stuck, air righting and upside-down detection are off. */
  setStuck(stuck: boolean): void {
    this.stuck = stuck;
  }

  /** Turn toward `targetAngle` by at most `maxStep` radians this frame. */
  rotateToward(targetAngle: number, maxStep: number): void {
    const d = angleDelta(this.body.angle, targetAngle);
    this.bodyApi.setAngle(this.body, this.body.angle + Phaser.Math.Clamp(d, -maxStep, maxStep));
    this.bodyApi.setAngularVelocity(this.body, 0);
  }

  /** Thruster impulse: set the speed along `dir` to at least `speed` px/s. */
  thrust(dir: Vec, speed: number): void {
    const d = normalize(dir);
    const v = this.velocity;
    const along = dot(v, d);
    if (along < speed) this.setVelocity(add(v, scale(d, speed - along)));
    this.events.emit(CarEvent.Thrust, d);
  }

  // ---- Per-frame update -------------------------------------------------

  update(dt: number, braking: boolean): void {
    let v = add(this.velocity, scale(this.gravityDir, this.gravityStrength * dt));

    const wheels = this.wheelContacts();
    if (wheels.length > 0) {
      v = this.driveAlongSurface(v, wheels, dt, braking);
    } else if (!this.stuck) {
      this.rightInAir(dt);
    }

    this.setVelocity(v);
    this.detectUpsideDown();
  }

  // ---- Internals ----------------------------------------------------------

  private driveAlongSurface(v: Vec, wheels: Contact[], dt: number, braking: boolean): Vec {
    const n = normalize(wheels.reduce((sum, c) => add(sum, c.normal), vec(0, 0)));
    const fwd = this.forward;
    const tangent = normalize(add(fwd, scale(n, -dot(fwd, n))));
    const speed = dot(v, tangent);

    if (braking) {
      if (speed > 0) return add(v, scale(tangent, -Math.min(TUNING.car.brakeDecel * dt, speed)));
      return v;
    }
    if (speed < this.driveSpeed) {
      return add(v, scale(tangent, Math.min(TUNING.car.throttleAccel * dt, this.driveSpeed - speed)));
    }
    return add(v, scale(tangent, -Math.min(TUNING.car.overspeedDrag * dt, speed - this.driveSpeed)));
  }

  /** Critically damped spring back to level so short falls land on the wheels. */
  private rightInAir(dt: number): void {
    const k = TUNING.car.airRighting;
    if (k <= 0) return;
    const omega = this.bodyApi.getAngularVelocity(this.body) * STEP_PER_SECOND;
    const error = angleDelta(this.body.angle, 0);
    const accel = k * error - 2 * Math.sqrt(k) * omega;
    this.bodyApi.setAngularVelocity(this.body, (omega + accel * dt) / STEP_PER_SECOND);
  }

  private detectUpsideDown(): void {
    if (this.crashed || this.stuck) return;
    if (dot(this.up, WORLD_UP) >= 0) return;
    const up = this.up;
    const roofOnFloor = this.contactsThisStep.some(
      (c) => dot(c.normal, WORLD_UP) > TUNING.car.upsideDownFloorCos && dot(c.normal, up) < -0.5,
    );
    if (roofOnFloor) {
      this.crashed = true;
      this.events.emit(CarEvent.UpsideDown);
    }
  }

  private wheelContacts(): Contact[] {
    const up = this.up;
    return this.contactsThisStep.filter((c) => dot(c.normal, up) > 0.5);
  }

  private clearContacts(): void {
    this.contactsThisStep = [];
  }

  private collectContacts(event: { pairs: MatterPair[] }): void {
    for (const pair of event.pairs) {
      const isA = pair.bodyA === this.body || pair.bodyA.parent === this.body;
      const isB = pair.bodyB === this.body || pair.bodyB.parent === this.body;
      if (isA === isB) continue;
      const other = isA ? pair.bodyB : pair.bodyA;
      if (other.isSensor) continue;

      // Orient the normal so it points from the surface toward the car.
      let normal = vec(pair.collision.normal.x, pair.collision.normal.y);
      const anchor = pair.collision.supports[0] ?? other.position;
      const toCar = vec(this.body.position.x - anchor.x, this.body.position.y - anchor.y);
      if (dot(normal, toCar) < 0) normal = scale(normal, -1);

      if (!this.contactsThisStep.some((c) => c.body === other)) {
        this.contactsThisStep.push({ body: other, normal });
      }
    }
  }

  private static ensureTexture(scene: Phaser.Scene, w: number, h: number): void {
    if (scene.textures.exists(TEXTURE_KEY)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    // Placeholder art: low wedge body, glass canopy, two wheels.
    g.fillStyle(0xe8edf5);
    g.fillRoundedRect(0, h * 0.3, w, h * 0.45, 6);
    g.fillStyle(0x4cc9f0);
    g.fillRoundedRect(w * 0.3, h * 0.08, w * 0.4, h * 0.3, 5);
    g.fillStyle(0xff4d6d);
    g.fillRect(w - 6, h * 0.38, 5, 4);
    g.fillStyle(0x1b1f2a);
    g.fillCircle(w * 0.2, h * 0.78, h * 0.22);
    g.fillCircle(w * 0.8, h * 0.78, h * 0.22);
    g.generateTexture(TEXTURE_KEY, w, h);
    g.destroy();
  }
}
