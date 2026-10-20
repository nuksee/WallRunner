import * as THREE from 'three';
import { Car } from '../car/Car';

/**
 * Side-on chase camera for the 2.5D view: sits off the play plane, slightly
 * behind and above the car, looks ahead in the direction of travel, and pulls
 * back as speed rises. Also drags the shadow-casting light along.
 */
export class ChaseCamera {
  readonly camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 400);
  private readonly focus = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private aspect = 16 / 9;

  constructor(
    private readonly car: Car,
    private readonly sun: THREE.DirectionalLight,
  ) {
    this.snap();
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Jump straight to the car (run start). */
  snap(): void {
    this.computeDesired();
    this.camera.position.copy(this.desired);
    this.camera.lookAt(this.focus);
  }

  update(dt: number): void {
    const prevFocus = this.focus.clone();
    this.computeDesired();
    const k = 1 - Math.exp(-dt * 5);
    this.camera.position.lerp(this.desired, k);
    this.focus.lerpVectors(prevFocus, this.focus, k);
    this.camera.lookAt(this.focus);

    const p = this.car.position;
    this.sun.position.set(p.x - 20, p.y + 40, 30);
    this.sun.target.position.set(p.x, p.y, 0);
  }

  private computeDesired(): void {
    const p = this.car.position;
    const v = this.car.velocity;
    const speed = Math.hypot(v.x, v.y);
    const lead = THREE.MathUtils.clamp(v.x * 0.45, -6, 10);
    // Narrow (portrait) screens need more distance to show the same stretch of course.
    const widthFactor = Math.max(1, 1.6 / this.aspect);
    const distance = (26 + speed * 0.35) * widthFactor;
    // Look from the roof side: above the car normally, level with it on a
    // ceiling, so the course's near faces never hide the car.
    const lift = 1.5 + 4 * Math.max(0, this.car.up.y);
    this.focus.set(p.x + lead, p.y + 1.5, 0);
    this.desired.set(p.x + lead - 7, p.y + lift, distance);
  }
}
