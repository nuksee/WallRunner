import RAPIER from '@dimforge/rapier3d-compat';
import { TUNING } from '../config/tuning';
import { Emitter } from '../util/Emitter';
import { Vec2, add, angleDelta, clamp, dot, normalize, rotate, scale, sub, vec } from '../util/vec2';

/**
 * C1 Car physics: auto-throttle, brake, gravity, suspension, rotation and
 * flip detection.
 *
 * The chassis is one Rapier body locked to the play plane (moves in x/y,
 * rotates about z). Two raycast wheels hold it up on springs. The car applies
 * its own gravity so C3 Stick can redirect "down" toward a marked surface.
 * Other components use the public methods and `events` only.
 */

export type CarEvents = {
  /** The roof hit a floor while the car was not stuck to anything. Fired once per run. */
  'upside-down': [];
  /** A thrust impulse was applied (C2 Hop). */
  thrust: [dir: Vec2];
};

export interface RayHit {
  collider: RAPIER.Collider;
  /** Unit surface normal in the play plane. */
  normal: Vec2;
  distance: number;
}

const WORLD_UP = vec(0, 1);
const HALF_DEPTH = 0.9;
/** Wheel mounts in chassis space, rear then front, at the chassis centre line so wheels tuck into the body. */
const WHEEL_X = [-1.45, 1.45];
const MOUNT_Y = 0;

export class Car {
  readonly events = new Emitter<CarEvents>();
  readonly body: RAPIER.RigidBody;

  /** Wheel rays from the last sense() call; null where the wheel hangs free. */
  wheelHits: Array<RayHit | null> = [null, null];
  /** Surface right in front of the nose, from the last sense() call. */
  aheadHit: RayHit | null = null;

  private readonly collider: RAPIER.Collider;
  private gravityDir: Vec2 = vec(0, -1);
  private gravityStrength = TUNING.world.gravity;
  private driveSpeed = TUNING.car.cruiseSpeed;
  private stuck = false;
  private crashed = false;
  /** Visual wheel spin, radians. */
  private wheelSpin = 0;

  constructor(private readonly world: RAPIER.World, x: number, y: number) {
    const { length, height, mass } = TUNING.car;
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, 0)
        .enabledTranslations(true, true, false)
        .enabledRotations(false, false, true)
        .setGravityScale(0)
        .setCcdEnabled(true),
    );
    const r = 0.2;
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.roundCuboid(length / 2 - r, height / 2 - r, HALF_DEPTH - r, r)
        .setMass(mass)
        // Frictionless even against grippy ground (Rapier averages friction by
        // default): traction comes from the throttle, so a scraping nose must slide.
        .setFriction(0)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setRestitution(0),
      this.body,
    );
  }

  // ---- Read-only state ----------------------------------------------------

  get position(): Vec2 {
    const t = this.body.translation();
    return vec(t.x, t.y);
  }

  /** Rotation about z, radians (0 = level, facing +x). */
  get angle(): number {
    const q = this.body.rotation();
    return 2 * Math.atan2(q.z, q.w);
  }

  get forward(): Vec2 {
    return rotate(vec(1, 0), this.angle);
  }

  get up(): Vec2 {
    return rotate(vec(0, 1), this.angle);
  }

  get velocity(): Vec2 {
    const v = this.body.linvel();
    return vec(v.x, v.y);
  }

  get isGrounded(): boolean {
    return this.wheelHits.some((h) => h !== null);
  }

  get isCrashed(): boolean {
    return this.crashed;
  }

  get isStuck(): boolean {
    return this.stuck;
  }

  /** Wheel centres in chassis space plus spin angle, for rendering. */
  get wheelVisuals(): Array<{ x: number; y: number; spin: number }> {
    const { suspensionRest, wheelRadius } = TUNING.car;
    return WHEEL_X.map((x, i) => {
      const hit = this.wheelHits[i];
      const drop = hit ? clamp(hit.distance - wheelRadius, 0, suspensionRest) : suspensionRest;
      return { x, y: MOUNT_Y - drop, spin: this.wheelSpin };
    });
  }

  /** The car angle whose roof points along `up`. */
  static angleForUp(up: Vec2): number {
    return Math.atan2(-up.x, up.y);
  }

  // ---- Commands from other components -------------------------------------

  setVelocity(v: Vec2): void {
    this.body.setLinvel({ x: v.x, y: v.y, z: 0 }, true);
  }

  /** Replace world gravity with a pull toward a surface (C3), or pass null to restore it. */
  setGravityOverride(dir: Vec2 | null, strength: number = TUNING.world.gravity): void {
    this.gravityDir = dir ? normalize(dir) : vec(0, -1);
    this.gravityStrength = dir ? strength : TUNING.world.gravity;
  }

  setDriveSpeed(speed: number | null): void {
    this.driveSpeed = speed ?? TUNING.car.cruiseSpeed;
  }

  /** While stuck, air righting and upside-down detection are off. */
  setStuck(stuck: boolean): void {
    this.stuck = stuck;
  }

  /** Turn toward `targetAngle`, no faster than `maxRate` rad/s. */
  turnToward(targetAngle: number, maxRate: number): void {
    const omega = clamp(angleDelta(this.angle, targetAngle) * 12, -maxRate, maxRate);
    this.body.setAngvel({ x: 0, y: 0, z: omega }, true);
  }

  /** Thruster impulse: raise the speed along `dir` to at least `speed` m/s. */
  thrust(dir: Vec2, speed: number): void {
    const d = normalize(dir);
    const v = this.velocity;
    const along = dot(v, d);
    if (along < speed) this.setVelocity(add(v, scale(d, speed - along)));
    this.events.emit('thrust', d);
  }

  /** Put the car back at the start of a run. */
  reset(x: number, y: number): void {
    this.body.setTranslation({ x, y, z: 0 }, true);
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.setGravityOverride(null);
    this.setDriveSpeed(null);
    this.stuck = false;
    this.crashed = false;
    this.wheelHits = [null, null];
    this.aheadHit = null;
  }

  // ---- Per-step update ------------------------------------------------------

  /** Cast the wheel, nose and roof rays. Call once per physics step, before the others. */
  sense(): void {
    const { length, suspensionRest, wheelRadius } = TUNING.car;
    const down = scale(this.up, -1);
    this.wheelHits = WHEEL_X.map((x) => this.cast(this.toWorld(vec(x, MOUNT_Y)), down, suspensionRest + wheelRadius));
    this.aheadHit = this.cast(this.position, this.forward, length / 2 + 0.8);
    this.detectUpsideDown();
  }

  /** Apply gravity, suspension, throttle and brake for one physics step. */
  step(dt: number, braking: boolean): void {
    const m = this.body.mass();
    const g = scale(this.gravityDir, this.gravityStrength * m * dt);
    this.body.applyImpulse({ x: g.x, y: g.y, z: 0 }, true);

    this.applySuspension(dt);

    const grounded = this.wheelHits.filter((h): h is RayHit => h !== null);
    if (grounded.length > 0) this.drive(grounded, dt, braking);
    else if (!this.stuck) this.rightInAir(dt);

    this.wheelSpin -= (dot(this.velocity, this.forward) / TUNING.car.wheelRadius) * dt;
  }

  // ---- Internals --------------------------------------------------------------

  private applySuspension(dt: number): void {
    const { mass, suspensionRest, suspensionHz, suspensionDamping, wheelRadius } = TUNING.car;
    const springMass = mass / 2;
    const k = springMass * (2 * Math.PI * suspensionHz) ** 2;
    const c = 2 * suspensionDamping * Math.sqrt(k * springMass);
    const up = this.up;
    const v = this.velocity;
    const omega = this.body.angvel().z;
    const centre = this.position;

    WHEEL_X.forEach((x, i) => {
      const hit = this.wheelHits[i];
      if (!hit) return;
      const mount = this.toWorld(vec(x, MOUNT_Y));
      const r = sub(mount, centre);
      const pointVel = add(v, vec(-omega * r.y, omega * r.x));
      const compression = suspensionRest + wheelRadius - hit.distance;
      const force = Math.max(0, k * compression - c * dot(pointVel, up));
      const j = scale(up, force * dt);
      this.body.applyImpulseAtPoint({ x: j.x, y: j.y, z: 0 }, { x: mount.x, y: mount.y, z: 0 }, true);
    });
  }

  private drive(grounded: RayHit[], dt: number, braking: boolean): void {
    const n = normalize(grounded.reduce((sum, h) => add(sum, h.normal), vec(0, 0)));
    const fwd = this.forward;
    const tangent = normalize(sub(fwd, scale(n, dot(fwd, n))));
    const speed = dot(this.velocity, tangent);
    const { throttleAccel, brakeDecel, overspeedDrag } = TUNING.car;

    let dv = 0;
    if (braking) dv = -Math.min(brakeDecel * dt, Math.max(0, speed));
    else if (speed < this.driveSpeed) dv = Math.min(throttleAccel * dt, this.driveSpeed - speed);
    else dv = -Math.min(overspeedDrag * dt, speed - this.driveSpeed);

    const j = scale(tangent, dv * this.body.mass());
    this.body.applyImpulse({ x: j.x, y: j.y, z: 0 }, true);
  }

  /** Critically damped spring back to level so short falls land on the wheels. */
  private rightInAir(dt: number): void {
    const k = TUNING.car.airRighting;
    if (k <= 0) return;
    const omega = this.body.angvel().z;
    const accel = k * angleDelta(this.angle, 0) - 2 * Math.sqrt(k) * omega;
    this.body.setAngvel({ x: 0, y: 0, z: omega + accel * dt }, true);
  }

  private detectUpsideDown(): void {
    if (this.crashed || this.stuck || dot(this.up, WORLD_UP) >= 0) return;
    const { length, height, upsideDownFloorCos } = TUNING.car;
    const up = this.up;
    for (const x of [-length * 0.35, 0, length * 0.35]) {
      const hit = this.cast(this.toWorld(vec(x, 0)), up, height / 2 + 0.25);
      if (hit && dot(hit.normal, WORLD_UP) > upsideDownFloorCos) {
        this.crashed = true;
        this.events.emit('upside-down');
        return;
      }
    }
  }

  private cast(origin: Vec2, dir: Vec2, maxDistance: number): RayHit | null {
    const ray = new RAPIER.Ray({ x: origin.x, y: origin.y, z: 0 }, { x: dir.x, y: dir.y, z: 0 });
    const hit = this.world.castRayAndGetNormal(ray, maxDistance, true, undefined, undefined, this.collider, this.body);
    if (!hit) return null;
    return { collider: hit.collider, normal: normalize(vec(hit.normal.x, hit.normal.y)), distance: hit.timeOfImpact };
  }

  private toWorld(local: Vec2): Vec2 {
    return add(this.position, rotate(local, this.angle));
  }
}
