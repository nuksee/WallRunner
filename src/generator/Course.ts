import type RAPIER from '@dimforge/rapier3d-compat';
import type * as THREE from 'three';
import { TUNING } from '../config/tuning';
import { Emitter } from '../util/Emitter';
import { Random } from '../util/random';
import { Vec2, clamp, closestPointOnPolygon, convexDistance, convexOverlap, length, pointInConvex, sub, vec } from '../util/vec2';
import { BuiltChunk, CELL_RADIUS, ChunkBuilder } from './build';
import { ChunkContext, Template, introTemplates, runway, weightedTemplates } from './chunks';
import type { ChunkPlan } from './plan';
import { ReachState, checkChunk, currentLimits } from './reach';

/**
 * C4 Course generator: an endless course streamed in chunks from a seed.
 *
 * Each chunk is planned from a template, checked against the live hop and
 * stick limits (reach.ts), re-rolled easier if it fails, and only then built.
 * Chunks are built ahead of the car and freed behind it. The course reports
 * what the car runs into as events; it never touches the car or the rules.
 */

export type CourseEvents = {
  /** Fell below the course. */
  pit: [];
  /** Touched a fence. */
  hazard: [];
  /** Collected a charge cell. */
  pickup: [];
  /** Cleared a fence by less than the near-miss margin. */
  'near-miss': [];
};

const AHEAD = 260;
const BEHIND = 70;
const FIRST_X = -30;
const ATTEMPTS = 8;
const INTRO_KEY = 'wallrunner.introDone';

export class Course {
  readonly events = new Emitter<CourseEvents>();
  readonly start: Vec2 = vec(4, 1.6);
  /** Below this y the car has fallen into a pit. */
  readonly killY = -12;

  private readonly builder: ChunkBuilder;
  private chunks: BuiltChunk[] = [];
  private rng = new Random(1);
  private seedValue = 1;
  private nextX = FIRST_X;
  private chunkIndex = 0;
  private lastName = '';
  private queue: Template[] = [];
  private introEndX = -Infinity;
  private reach: ReachState = { fuel: 0, runway: 0 };
  /** Charge the generator expects the car to have at `nextX`, if it collects every on-path cell. */
  private ghostCharge = 0;
  /** Template names whose hint has shown this session. */
  private readonly taught = new Set<string>();
  /** Plans rejected by the reachability check (for the dev console). */
  rejected = 0;

  constructor(world: RAPIER.World, scene: THREE.Scene) {
    this.builder = new ChunkBuilder(world, scene);
  }

  get seed(): number {
    return this.seedValue;
  }

  /** Free every chunk and start a fresh course from `seed`. */
  reset(seed: number): void {
    for (const c of this.chunks) this.builder.dispose(c);
    this.chunks = [];
    this.seedValue = seed;
    this.rng = new Random(seed);
    this.nextX = FIRST_X;
    this.chunkIndex = 0;
    this.lastName = '';
    this.reach = { fuel: TUNING.hop.fuelCapacity, runway: 0 };
    this.ghostCharge = TUNING.rules.chargeCapacity;
    const intro = !readFlag(INTRO_KEY);
    this.queue = intro ? introTemplates() : [runway(60)];
    if (!intro) for (const name of ['start', 'pit', 'fences', 'wall', 'charge', 'loop']) this.taught.add(name);
    this.introEndX = -Infinity;
    this.update(this.start.x);
  }

  /** Build chunks ahead of `carX` and free those far behind it. */
  update(carX: number): void {
    while (this.nextX < carX + AHEAD) this.append();
    while (this.chunks.length > 1 && this.chunks[0].x1 < carX - BEHIND) this.builder.dispose(this.chunks.shift()!);
    if (carX > this.introEndX && this.introEndX > -Infinity) {
      writeFlag(INTRO_KEY);
      this.introEndX = -Infinity;
    }
  }

  /**
   * Test the car's outline against fences, cells and the pit floor. Call once
   * per physics step during a run; fires course events.
   */
  check(hull: Vec2[], position: Vec2): void {
    if (position.y < this.killY) this.events.emit('pit');
    const margin = TUNING.rules.nearMissMargin;
    for (const chunk of this.chunks) {
      if (chunk.x1 < position.x - 10 || chunk.x0 > position.x + 10) continue;
      for (const h of chunk.hazards) {
        if (h.hit || h.passed) continue;
        if (convexOverlap(hull, h.outline)) {
          h.hit = true;
          this.events.emit('hazard');
          continue;
        }
        if (h.x2 > position.x - 8 && h.x1 < position.x + 8) h.closest = Math.min(h.closest, convexDistance(hull, h.outline));
        if (hull.every((p) => p.x > h.x2)) {
          h.passed = true;
          if (h.closest < margin) this.events.emit('near-miss');
        }
      }
      for (const p of chunk.pickups) {
        if (p.taken) continue;
        const inside = pointInConvex(p.position, hull);
        if (inside || length(sub(p.position, closestPointOnPolygon(p.position, hull))) < CELL_RADIUS) {
          p.taken = true;
          p.mesh.visible = false;
          this.events.emit('pickup');
        }
      }
    }
  }

  /** Hint for the stretch the car is on, or ''. */
  hintAt(x: number): string {
    let text = '';
    for (const c of this.chunks) for (const h of c.hints) if (x >= h.x && x < h.x + 70) text = h.text;
    return text;
  }

  animate(time: number): void {
    this.builder.animate(time);
    for (const c of this.chunks) {
      for (const p of c.pickups) p.mesh.rotation.y = time * 2.5;
    }
  }

  // ---- Generation ------------------------------------------------------------

  private append(): void {
    const plan = this.plan();
    const chunk = this.builder.build(plan, this.nextX, this.chunkIndex++);
    this.chunks.push(chunk);
    if (this.queue.length === 0 && plan.name === 'loop' && this.introEndX === -Infinity && !readFlag(INTRO_KEY)) {
      this.introEndX = chunk.x1;
    }

    const R = TUNING.rules;
    const seconds = plan.length / TUNING.car.cruiseSpeed;
    const drain = R.chargeDrain + (R.chargeDrainPerKm * Math.max(0, this.nextX)) / 1000;
    const cells = plan.pickups.filter((p) => p.onPath).length;
    this.ghostCharge = Math.min(R.chargeCapacity, this.ghostCharge - seconds * drain + cells * R.chargePerCell);
    this.nextX += plan.length;
    this.lastName = plan.name;
  }

  private plan(): ChunkPlan {
    const limits = currentLimits();
    const difficulty = clamp(this.nextX / TUNING.course.rampDistance, 0, 1);
    const R = TUNING.rules;
    // Cells to keep the budget above half a battery after a typical chunk.
    const drainAhead = (100 / TUNING.car.cruiseSpeed) * (R.chargeDrain + (R.chargeDrainPerKm * Math.max(0, this.nextX)) / 1000);
    const deficit = R.chargeCapacity * 0.5 + drainAhead - this.ghostCharge;
    const cells = clamp(Math.ceil(deficit / R.chargePerCell), 0, 5);
    const ctx = (d: number): ChunkContext => ({ rng: this.rng, difficulty: d, limits, cells, teach: true });

    const accept = (plan: ChunkPlan): ChunkPlan | null => {
      const result = checkChunk(plan, this.reach, limits);
      if (!result.ok) {
        this.rejected++;
        if (import.meta.env.DEV) console.debug('[course] rejected', result.reason);
        return null;
      }
      this.reach = result.exit;
      if (plan.hints.length) this.taught.add(plan.name);
      return plan;
    };

    const scripted = this.queue.shift();
    if (scripted) {
      const plan = accept(scripted(ctx(0)));
      if (plan) return plan;
    }

    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const d = difficulty * (1 - attempt / ATTEMPTS);
      const plan = this.rng.weighted(weightedTemplates(d))(ctx(d));
      if (plan.name === this.lastName) continue; // never the same template twice in a row
      // Each template's hint shows the first time it appears this session.
      if (this.taught.has(plan.name)) plan.hints = [];
      if (accept(plan)) return plan;
    }
    return accept(runway(24)(ctx(0)))!;
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Private mode or blocked storage: the intro just shows again next time.
  }
}
