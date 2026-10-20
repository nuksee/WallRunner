import { TUNING, hopSpeed } from '../config/tuning';
import { Car } from './Car';

/**
 * C2 Hop: thruster impulse out of the car's roof, paid for from a fuel tank
 * that refills while the wheels are on a surface. An empty tank blocks hops.
 */
export class Hop {
  private fuelLevel = TUNING.hop.fuelCapacity;
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

  reset(): void {
    this.fuelLevel = TUNING.hop.fuelCapacity;
    this.cooldownLeft = 0;
  }

  /** Call once per physics step. `pressed` is true on the step the Hop action went down. */
  update(dt: number, pressed: boolean): void {
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    if (this.car.isGrounded) {
      this.fuelLevel = Math.min(TUNING.hop.fuelCapacity, this.fuelLevel + TUNING.hop.refillRate * dt);
    }
    if (pressed && this.canHop && !this.car.isCrashed) {
      this.fuelLevel -= TUNING.hop.fuelCost;
      this.cooldownLeft = TUNING.hop.cooldown;
      this.car.thrust(this.car.up, hopSpeed());
    }
  }
}
