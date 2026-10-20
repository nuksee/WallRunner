import { Vec2, vec } from '../util/vec2';

/**
 * A chunk plan is pure data: geometry, hazards, pickups and the moves the
 * player needs, in chunk-local metres (x from 0 to `length`, floor top at
 * y = 0). Plans are checked for reachability before anything is built, so
 * they never touch Three.js or Rapier.
 */

export type SurfaceKind = 'ground' | 'marked';

export interface Piece {
  /** Convex outline in the play plane, counter-clockwise. */
  outline: Vec2[];
  kind: SurfaceKind;
  /** Draw outline edges (off for the thin wedges of curved ramps). */
  edges: boolean;
}

/** Electric fence: touching the box ends the run (R1). */
export interface Hazard {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Pickup {
  x: number;
  y: number;
  /** On the route every player drives, so it counts toward the charge budget. */
  onPath: boolean;
}

export interface Hint {
  /** Shown once the car passes this x. `{hop}` / `{stick}` become control names. */
  x: number;
  text: string;
}

/** What the player has to do, for the reachability check. */
export type Challenge =
  /**
   * Leave the floor at `x` and cross `width` metres of nothing. `dropTo` is
   * the landing height relative to the take-off floor. `face` means the
   * target is a marked wall to grab rather than a floor to land on.
   */
  | { type: 'jump'; x: number; width: number; dropTo: number; target: 'floor' | 'face' }
  /** Hop over a hazard box starting at `x`. */
  | { type: 'fence'; x: number; width: number; height: number }
  /**
   * Stick from `x` until the car is back on the floor at `to`, driving `path`
   * metres on the way (refills fuel; no reaction gap needed before it).
   */
  | { type: 'stick'; x: number; to: number; path: number };

export interface ChunkPlan {
  name: string;
  length: number;
  pieces: Piece[];
  hazards: Hazard[];
  pickups: Pickup[];
  hints: Hint[];
  challenges: Challenge[];
}

/** Bottom of every floor piece; pits are open down to here. */
export const BOTTOM = -30;
/** Radius of the curved ramps where a wall meets a floor or ceiling, metres. */
export const FILLET = 7;

/** Collects the pieces of one chunk plan. */
export class PlanBuilder {
  private readonly plan: Omit<ChunkPlan, 'length'>;

  constructor(name: string) {
    this.plan = { name, pieces: [], hazards: [], pickups: [], hints: [], challenges: [] };
  }

  poly(outline: Vec2[], kind: SurfaceKind = 'ground', edges = true): this {
    this.plan.pieces.push({ outline, kind, edges });
    return this;
  }

  box(x1: number, y1: number, x2: number, y2: number, kind: SurfaceKind = 'ground'): this {
    return this.poly([vec(x1, y1), vec(x2, y1), vec(x2, y2), vec(x1, y2)], kind);
  }

  /** Floor strip whose top runs from (x1, y1) to (x2, y2). */
  strip(x1: number, y1: number, x2: number, y2: number, kind: SurfaceKind = 'ground'): this {
    return this.poly([vec(x1, BOTTOM), vec(x2, BOTTOM), vec(x2, y2), vec(x1, y1)], kind);
  }

  /**
   * Curved ramp filling the inside corner at `corner`: a quarter circle of
   * FILLET radius around `centre`, swept from angle `from` to `to` (degrees),
   * built from thin convex wedges so the car rolls from floor to wall smoothly.
   */
  fillet(corner: Vec2, centre: Vec2, from: number, to: number, kind: SurfaceKind = 'marked'): this {
    const steps = 10;
    const arc = Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
      return vec(centre.x + FILLET * Math.cos(a), centre.y + FILLET * Math.sin(a));
    });
    for (let i = 0; i < steps; i++) this.poly([corner, arc[i], arc[i + 1]], kind, false);
    return this;
  }

  /** Fence standing on the floor at height `base`. */
  fence(x: number, width: number, height: number, base = 0): this {
    this.plan.hazards.push({ x1: x, y1: base, x2: x + width, y2: base + height });
    this.plan.challenges.push({ type: 'fence', x, width, height });
    return this;
  }

  pickup(x: number, y: number, onPath = false): this {
    this.plan.pickups.push({ x, y, onPath });
    return this;
  }

  hint(x: number, text: string, show = true): this {
    if (show) this.plan.hints.push({ x, text });
    return this;
  }

  challenge(c: Challenge): this {
    this.plan.challenges.push(c);
    return this;
  }

  done(length: number): ChunkPlan {
    this.plan.challenges.sort((a, b) => a.x - b.x);
    return { ...this.plan, length };
  }
}
