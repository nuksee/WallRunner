/**
 * Shared tuning constants for Milestone 1.
 *
 * C1–C3 expose their limits here so other components (and later the C4 course
 * generator) can read them without reaching into car internals. Units are
 * metres, seconds and kilograms; +y is up and the play plane is z = 0.
 *
 * Values are read every frame, so the dev tuning panel can edit them live.
 */

export const TUNING = {
  world: {
    /** Downward gravity while the car is not stuck to a surface, m/s². */
    gravity: 25,
  },

  /** C1 Car physics. */
  car: {
    length: 4.4,
    height: 0.9,
    mass: 1200,
    /** Auto-throttle target speed along the surface, m/s. */
    cruiseSpeed: 20,
    /** Auto-throttle acceleration toward cruise speed, m/s². */
    throttleAccel: 14,
    /** Deceleration back toward cruise speed when faster (e.g. downhill), m/s². */
    overspeedDrag: 8,
    /** Brake deceleration while held, m/s². Brake never reverses the car. */
    brakeDecel: 30,
    /** Spring that levels the car in the air, 1/s². 0 disables. */
    airRighting: 6,
    /** Suspension travel at rest, m (wheel centre to chassis mount). */
    suspensionRest: 0.4,
    /** Suspension natural frequency, Hz. Higher is stiffer. */
    suspensionHz: 2.6,
    /** Suspension damping ratio (1 = no bounce). */
    suspensionDamping: 0.45,
    wheelRadius: 0.48,
    /**
     * A roof contact counts as an upside-down landing when the surface faces
     * up within this cosine (1 = flat floor only).
     */
    upsideDownFloorCos: 0.5,
  },

  /** C2 Hop. */
  hop: {
    /** Height one hop reaches from rest under normal gravity, m. */
    height: 4.5,
    /** Fuel tank capacity. */
    fuelCapacity: 100,
    /** Fuel spent per hop. A hop needs at least this much in the tank. */
    fuelCost: 30,
    /** Fuel refilled per second while the wheels are on a surface. */
    refillRate: 22,
    /** Minimum time between hops, s. */
    cooldown: 0.12,
  },

  /** C3 Stick. */
  stick: {
    /** Auto-throttle target speed while stuck to a marked surface, m/s. */
    driveSpeed: 17,
    /** Pull toward the stuck surface, m/s². Replaces world gravity while stuck. */
    gravity: 40,
    /** How far beyond the wheels a marked surface can be and still hold the car, m. */
    reach: 1.2,
    /** How fast the car turns to match the surface it is stuck to, rad/s. */
    alignRate: 9,
    /** After a hop, stick ignores surfaces for this long so the car can leave, s. */
    hopRelease: 0.25,
  },
};

/** Hop launch speed derived from hop height: v = sqrt(2 g h), m/s. */
export const hopSpeed = (): number => Math.sqrt(2 * TUNING.world.gravity * TUNING.hop.height);
