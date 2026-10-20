import { HOP_SPEED, TUNING } from '../config/tuning';
import { Car } from './Car';

/**
 * C2 Hop: thruster impulse out of the car's roof, paid for from a fuel tank
 * that refills while the car is on a surface. An empty tank blocks hops.
 */
export class Hop {
  private fuelLevel: number = TUNING.hop.fuelCapacity;
  private cooldownLeft = 0;

  constructor(private readonly car: Car) {}

  get fuel(): number {
    return this.fuelLevel;
  }

  get capacity(): number {
    return TUNING.hop.fuelCapacity;
  }

  get canHop(): boolean {
    return this.fuelLevel >= TUNING.hop.fuelCost && this.cooldownLeft <= 0;
  }

  /** Call once per frame. `pressed` is true on the frame the Hop action went down. */
  update(dt: number, pressed: boolean): void {
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);

    if (this.car.isGrounded) {
      this.fuelLevel = Math.min(TUNING.hop.fuelCapacity, this.fuelLevel + TUNING.hop.refillRate * dt);
    }

    if (pressed && this.canHop && !this.car.isCrashed) {
      this.fuelLevel -= TUNING.hop.fuelCost;
      this.cooldownLeft = TUNING.hop.cooldown;
      this.car.thrust(this.car.up, HOP_SPEED);
    }
  }
}
