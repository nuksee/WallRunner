/**
 * Shared tuning constants for Milestone 1.
 *
 * C1–C3 expose their limits here so other components (and later the C4 course
 * generator) can read them without reaching into car internals. Units are
 * pixels and seconds unless a name says otherwise.
 */

export const TUNING = {
  world: {
    /** Downward gravity applied to the car while it is not stuck to a surface, px/s². */
    gravity: 1800,
    /** Pixels per metre for the distance counter. */
    pxPerMetre: 20,
  },

  /** C1 Car physics. */
  car: {
    width: 64,
    height: 24,
    /** Auto-throttle target speed along the surface, px/s. */
    cruiseSpeed: 420,
    /** Auto-throttle acceleration toward cruise speed, px/s². */
    throttleAccel: 900,
    /** Deceleration back toward cruise speed when faster (e.g. downhill), px/s². */
    overspeedDrag: 500,
    /** Brake deceleration while held, px/s². Brake never reverses the car. */
    brakeDecel: 1400,
    /** Stiffness of the spring that levels the car in the air, 1/s². 0 disables. */
    airRighting: 12,
    /**
     * Chassis friction (Matter.js 0..1). Kept at 0: traction comes from the
     * auto-throttle and brake, so Matter's solver doesn't eat the drive speed.
     */
    friction: 0,
    /**
     * A roof contact counts as an upside-down landing when the surface faces
     * up within this cosine (1 = flat floor only).
     */
    upsideDownFloorCos: 0.5,
  },

  /** C2 Hop. */
  hop: {
    /** Height one hop reaches from rest under normal gravity, px. */
    height: 140,
    /** Fuel tank capacity. */
    fuelCapacity: 100,
    /** Fuel spent per hop. A hop needs at least this much in the tank. */
    fuelCost: 30,
    /** Fuel refilled per second while the car is on a surface. */
    refillRate: 20,
    /** Minimum time between hops, s. */
    cooldown: 0.12,
  },

  /** C3 Stick. */
  stick: {
    /** Auto-throttle target speed while stuck to a marked surface, px/s. */
    driveSpeed: 380,
    /** Pull toward the stuck surface, px/s². Replaces world gravity while stuck. */
    gravity: 2600,
    /** How far beyond the chassis a marked surface can be and still hold the car, px. */
    reach: 22,
    /** How fast the car turns to match the surface it is stuck to, rad/s. */
    alignRate: 18,
    /** After a hop, stick ignores surfaces for this long so the car can leave, s. */
    hopRelease: 0.2,
  },
} as const;

/** Matter.js body label for surfaces the car can stick to (L3). */
export const MARKED_SURFACE_LABEL = 'marked-surface';

/** Hop launch speed derived from hop height: v = sqrt(2 g h), px/s. */
export const HOP_SPEED = Math.sqrt(2 * TUNING.world.gravity * TUNING.hop.height);
