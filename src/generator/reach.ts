import { TUNING, hopSpeed } from '../config/tuning';
import type { ChunkPlan } from './plan';

/**
 * C4 reachability check. Every chunk plan is run against the real hop and
 * stick limits from tuning.ts before it is built, so the course never asks
 * for a jump the car cannot make. Read live, so tuning-panel changes apply to
 * the next chunk generated.
 */

export interface Limits {
  /** Horizontal speed assumed for jumps, m/s (the slower of cruise and stick speed). */
  speed: number;
  /** Speed assumed for fuel refill, m/s (the faster one: less time on the ground per metre). */
  refillSpeed: number;
  gravity: number;
  hopSpeed: number;
  hopHeight: number;
  hopCost: number;
  fuelCapacity: number;
  refillRate: number;
  carLength: number;
  /** Share of the ideal reach a jump may use. */
  safety: number;
  /** Least flat ground before a jump or fence, m. */
  minRunway: number;
  /** Fuel that must be left after each challenge. */
  reserve: number;
}

export const currentLimits = (): Limits => {
  const speed = Math.min(TUNING.car.cruiseSpeed, TUNING.stick.driveSpeed);
  return {
    speed,
    refillSpeed: Math.max(TUNING.car.cruiseSpeed, TUNING.stick.driveSpeed),
    // Landings bounce the wheels off the ground for a moment; count on 80% of the refill.
    refillRate: TUNING.hop.refillRate * 0.8,
    gravity: TUNING.world.gravity,
    hopSpeed: hopSpeed(),
    hopHeight: TUNING.hop.height,
    hopCost: TUNING.hop.fuelCost,
    fuelCapacity: TUNING.hop.fuelCapacity,
    carLength: TUNING.car.length,
    safety: TUNING.course.reachSafety,
    minRunway: Math.max(8, TUNING.course.reactionTime * TUNING.car.cruiseSpeed),
    reserve: TUNING.course.spareHop * TUNING.hop.fuelCost,
  };
};

/** Hops a tank holding `fuel` can pay for. */
export const hopsFor = (L: Limits, fuel: number): number => Math.floor((fuel + 1e-6) / L.hopCost);

/**
 * Seconds the car spends above height `h` (relative to take-off) when it
 * hops from the floor and hops again at each apex, `hops` hops in all.
 * For h <= 0 this is the whole time until it falls back to h.
 */
export function timeAbove(L: Limits, hops: number, h: number): number {
  const { gravity: g, hopSpeed: v, hopHeight: H } = L;
  const apex = hops * H;
  if (hops < 1 || apex <= h) return 0;
  const rise = v / g;
  let before = 0;
  if (h > 0) {
    const k = Math.ceil(h / H);
    const within = h - (k - 1) * H;
    before = (k - 1) * rise + (v - Math.sqrt(Math.max(0, v * v - 2 * g * within))) / g;
  }
  return hops * rise + Math.sqrt((2 * (apex - h)) / g) - before;
}

/** Widest gap `hops` hops can cross with the safety margin. */
export function maxJump(L: Limits, hops: number, dropTo = 0, target: 'floor' | 'face' = 'floor'): number {
  const tail = target === 'face' ? L.carLength * 0.5 : L.carLength * 0.75;
  return L.speed * timeAbove(L, hops, dropTo) * L.safety - tail;
}

/** Car clearance needed above a fence, m. */
const FENCE_CLEARANCE = 0.4;

/** Longest fence `hops` hops can clear with the safety margin, for a fence of `height`. */
export function maxFence(L: Limits, hops: number, height: number): number {
  return L.speed * timeAbove(L, hops, height + FENCE_CLEARANCE) * L.safety - L.carLength;
}

/** Distance from a hop's launch to its apex at the faster speed, m: how far ahead of a fence the hop starts. */
export const hopLead = (L: Limits, hops = 1): number => L.refillSpeed * hops * (L.hopSpeed / L.gravity);

/** Furthest a jump of `hops` hops travels before touching down at `dropTo`, at the faster speed, m. */
export const hopFlight = (L: Limits, hops: number, dropTo = 0): number => L.refillSpeed * timeAbove(L, hops, dropTo);

/** What the check carries from one chunk to the next. */
export interface ReachState {
  /** Fuel the car can count on at the chunk start. */
  fuel: number;
  /** Ground driven since the car last touched down, m (negative while still in the air). */
  runway: number;
}

export type ReachResult = { ok: true; exit: ReachState } | { ok: false; reason: string };

/**
 * Walk the plan's challenges in order with a ghost car. Each jump or fence
 * becomes a flight from launch to touchdown; fuel refills only on the ground
 * between flights. Fails if a launch comes less than a reaction time after
 * the last touchdown, or a challenge needs more hops than the reach allows or
 * the tank holds (keeping a reserve for one fumbled press).
 */
export function checkChunk(plan: ChunkPlan, entry: ReachState, L: Limits = currentLimits()): ReachResult {
  let fuel = entry.fuel;
  /** Where the car last touched down, chunk-local. */
  let landed = -entry.runway;
  const refill = (metres: number) => {
    fuel = Math.min(L.fuelCapacity, fuel + (Math.max(0, metres) / L.refillSpeed) * L.refillRate);
  };
  const fail = (why: string): ReachResult => ({ ok: false, reason: `${plan.name}: ${why}` });

  for (const c of plan.challenges) {
    if (c.type === 'stick') {
      if (c.x < landed - 1e-6) return fail(`stick section at x=${c.x.toFixed(1)} starts mid-flight`);
      refill(c.x - landed + c.path);
      landed = c.to;
      continue;
    }

    // Fewest hops that make it, launching a car length before a gap's edge or
    // centring the arc over a fence, with the fuel refilled by then.
    let hops = 0;
    let launch = 0;
    let most = 0;
    for (let n = 1; n <= hopsFor(L, L.fuelCapacity) && !hops; n++) {
      const at = c.type === 'jump' ? c.x - 1 : c.x + c.width / 2 - hopLead(L, n);
      const tank = Math.min(L.fuelCapacity, fuel + (Math.max(0, at - landed) / L.refillSpeed) * L.refillRate);
      if (hopsFor(L, tank - L.reserve) < n) break;
      most = n;
      const fits = c.type === 'jump' ? maxJump(L, n, c.dropTo, c.target) >= c.width : maxFence(L, n, c.height) >= c.width;
      if (fits) [hops, launch] = [n, at];
    }
    if (!hops) {
      const what = c.type === 'jump' ? `${c.width.toFixed(1)} m jump` : `${c.height.toFixed(1)} m fence`;
      return fail(`${what} at x=${c.x.toFixed(1)} out of reach with ${most} hops`);
    }
    const ground = launch - landed;
    if (ground < L.minRunway) return fail(`only ${ground.toFixed(1)} m of ground before launching at x=${launch.toFixed(1)}`);
    refill(ground);
    fuel -= hops * L.hopCost;

    if (c.type === 'jump') {
      landed = c.target === 'face' ? c.x + c.width : Math.max(c.x + c.width, launch + hopFlight(L, hops, c.dropTo));
    } else {
      landed = launch + hopFlight(L, hops);
    }
  }

  refill(plan.length - landed);
  return { ok: true, exit: { fuel, runway: plan.length - landed } };
}
