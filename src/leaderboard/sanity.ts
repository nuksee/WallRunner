import type { RunResult } from '../rules/Rules';

/**
 * B2 basic sanity checks, run before a score is sent. The server repeats the
 * same checks in supabase/leaderboard.sql; change both together.
 */
export const LIMITS = {
  minDuration: 1,
  maxDuration: 7200,
  /** Average speed over a whole run, m/s, plus `distanceSlack` metres. */
  maxAverageSpeed: 30,
  distanceSlack: 20,
  /** Wall points per second (20/s, ceilings double). */
  maxWallPerSecond: 40,
  maxAirPerSecond: 30,
  nearMissPoints: 50,
  /** At most one fence every this many metres. */
  metresPerFence: 15,
} as const;

/** Why a run would be rejected, or null if it looks plausible. */
export function sanityProblem(r: RunResult): string | null {
  const L = LIMITS;
  const { wall, air, nearMiss } = r.style;
  const ok =
    ['pit', 'hazard', 'upside-down', 'charge'].includes(r.cause) &&
    r.duration >= L.minDuration &&
    r.duration <= L.maxDuration &&
    Math.min(r.score, r.distance, wall, air, nearMiss) >= 0 &&
    r.score === r.distance + wall + air + nearMiss &&
    r.distance <= r.duration * L.maxAverageSpeed + L.distanceSlack &&
    wall <= r.duration * L.maxWallPerSecond &&
    air <= r.duration * L.maxAirPerSecond &&
    nearMiss % L.nearMissPoints === 0 &&
    Math.floor(nearMiss / L.nearMissPoints) <= Math.floor(r.distance / L.metresPerFence) + 1;
  return ok ? null : 'Score failed the sanity check';
}
