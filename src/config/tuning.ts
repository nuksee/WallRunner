/**
 * Shared tuning constants.
 *
 * C1–C3 expose their limits here so the C4 course generator and C5 rules can
 * read them without reaching into car internals. Units are
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

  /** C4 Course generator. */
  course: {
    /** Distance over which difficulty ramps from 0 to 1, m. */
    rampDistance: 2500,
    /**
     * Share of the computed hop reach a gap may use (0–1). The rest is slack
     * for late presses and imperfect timing.
     */
    reachSafety: 0.78,
    /** Fuel the check keeps in reserve after every challenge, as a share of one hop (slack for a wasted hop). */
    spareHop: 0.5,
    /** Least ground between touching down and the next take-off, as seconds of driving at cruise speed. */
    reactionTime: 0.5,
  },

  /** C5 Rules and score. */
  rules: {
    /** Battery capacity. The run ends when it hits zero (R1). */
    chargeCapacity: 100,
    /** Charge drained per second at the start of a run. */
    chargeDrain: 2.4,
    /** Extra drain per second for every kilometre travelled. */
    chargeDrainPerKm: 1.2,
    /** Charge restored by one charge cell. */
    chargePerCell: 28,
    /** Style points per second stuck to a wall (R2). Ceilings score double. */
    wallPointsPerSecond: 20,
    /** Airtime shorter than this earns nothing, s. */
    airtimeMin: 0.7,
    /** Style points per second of airtime beyond the minimum. */
    airPointsPerSecond: 30,
    /** Style points for passing a hazard closer than `nearMissMargin` without touching it. */
    nearMissPoints: 50,
    /** How close counts as a near miss, m. */
    nearMissMargin: 1.1,
  },

  /** C8 Ads. */
  ads: {
    /** Show an interstitial before every Nth new run (0 = never). */
    interstitialEveryRuns: 3,
    /** Least time between interstitials, s. Portals usually require a gap. */
    interstitialMinGap: 90,
  },
};

const DEFAULTS = snapshot();

/**
 * True when any gameplay value differs from the shipped defaults. Tuned runs
 * are not sent to the global leaderboard (ad settings don't count).
 */
export const isTuned = (): boolean => snapshot() !== DEFAULTS;

function snapshot(): string {
  const { ads: _ads, ...gameplay } = TUNING;
  return JSON.stringify(gameplay);
}

/** Hop launch speed derived from hop height: v = sqrt(2 g h), m/s. */
export const hopSpeed = (): number => Math.sqrt(2 * TUNING.world.gravity * TUNING.hop.height);
