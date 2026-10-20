import { Random } from '../util/random';
import { vec } from '../util/vec2';
import { BOTTOM, ChunkPlan, FILLET, PlanBuilder } from './plan';
import { Limits, hopFlight, hopLead, maxFence, maxJump } from './reach';

/**
 * C4 chunk templates. Each one turns a difficulty (0 = first metres, 1 = full
 * ramp) and the live limits into a chunk plan. Templates aim inside the
 * limits; the reachability check in reach.ts has the final say.
 */

export interface ChunkContext {
  rng: Random;
  /** 0 to 1. */
  difficulty: number;
  limits: Limits;
  /** Charge cells to put on the main route, from the generator's charge budget. */
  cells: number;
  /** Show this template's teaching hint (first time it appears this session). */
  teach: boolean;
}

export type Template = (ctx: ChunkContext) => ChunkPlan;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Height of a charge cell over a floor, so driving past collects it. */
const CELL_Y = 1.2;

/** Flat lead-in every template starts with: long enough to react, with the budget charge cell. */
function leadIn(b: PlanBuilder, ctx: ChunkContext, extra = 1): number {
  const len = ctx.limits.minRunway + extra + ctx.rng.range(0, 6);
  pathCells(b, ctx);
  return len;
}

/**
 * The budget's charge cells, 2 m apart along the floor from `x`. The chunk
 * start is always on the ground (the check makes the car land a reaction
 * time before any take-off), so cells there cannot be hopped over by accident.
 */
function pathCells(b: PlanBuilder, ctx: ChunkContext, x = 1): void {
  for (let i = 0; i < ctx.cells; i++) b.pickup(x + 2 * i, CELL_Y, true);
}

/** Tallest wall the car could hop over with a full tank; walls above it need Stick. */
const mustStickHeight = (L: Limits): number => Math.floor(L.fuelCapacity / L.hopCost) * L.hopHeight + 1.5;

export const runway = (len?: number): Template => (ctx) => {
  const b = new PlanBuilder('runway');
  const length = len ?? ctx.rng.range(16, 30);
  b.strip(0, 0, length, 0);
  pathCells(b, ctx);
  return b.done(length);
};

/** Rolling slopes and ledges: no challenge, some airtime. */
export const bumps: Template = (ctx) => {
  const { rng, difficulty: d } = ctx;
  const b = new PlanBuilder('bumps');
  let x = 0;
  let y = 0;
  const step = (x2: number, y2: number) => {
    b.strip(x, y, x2, y2);
    x = x2;
    y = y2;
  };
  step(12, 0);
  pathCells(b, ctx);
  const count = 1 + Math.round(rng.range(0, 1 + d));
  for (let i = 0; i < count; i++) {
    const h = rng.range(1.5, lerp(2.5, 5, d));
    step(x + h * rng.range(2.6, 4), h);
    const plateau = rng.range(4, 10);
    if (rng.chance(0.5)) b.pickup(x + plateau / 2, h + CELL_Y, true);
    step(x + plateau, h);
    if (rng.chance(0.25 + 0.4 * d)) {
      // Ledge: drop straight off the edge.
      b.strip(x, 0, x + 10, 0);
      x += 10;
      y = 0;
    } else {
      step(x + h * rng.range(2.6, 4), 0);
    }
    step(x + rng.range(4, 8), 0);
  }
  step(x + 6, 0);
  return b.done(x);
};

function pitChunk(name: string, ctx: ChunkContext, width: number, hint: string): ChunkPlan {
  const { rng, difficulty: d, limits: L } = ctx;
  const b = new PlanBuilder(name);
  const edge = leadIn(b, ctx);
  b.strip(0, 0, edge, 0);
  b.challenge({ type: 'jump', x: edge, width, dropTo: 0, target: 'floor' });
  b.hint(edge - L.minRunway * 0.9, hint, ctx.teach);
  if (rng.chance(0.5)) b.pickup(edge + width / 2, L.hopHeight * 0.85 + 0.8);

  const land = edge + width;
  // Where a full-speed car actually touches down, which can be well past the edge.
  const touchdown = Math.max(land, edge - 1 + hopFlight(L, width > maxJump(L, 1) ? 2 : 1));
  let end = touchdown + rng.range(4, 10);
  if (d > 0.35 && rng.chance(0.5 * d)) {
    // Fence on the landing, a reaction time after touchdown.
    const h = rng.range(1.0, Math.min(2.4, L.hopHeight - 1.5));
    const w = rng.range(0.4, Math.max(0.5, Math.min(3, maxFence(L, 1, h) * 0.8)));
    const fx = touchdown + L.minRunway + hopLead(L) - w / 2 + rng.range(1, 6);
    b.fence(fx, w, h);
    end = fx + w / 2 + hopFlight(L, 1) - hopLead(L) + rng.range(4, 10);
  }
  b.strip(land, 0, end, 0);
  return b.done(end);
}

export const pit: Template = (ctx) => {
  const max = maxJump(ctx.limits, 1);
  const width = Math.max(6, max * lerp(0.5, 0.97, Math.min(1, ctx.difficulty * 1.3) * ctx.rng.range(0.6, 1)));
  return pitChunk('pit', ctx, width, 'Pit ahead: jump it with {hop}');
};

/** Wider than one hop: needs a second hop in mid-air. */
export const gap: Template = (ctx) => {
  const L = ctx.limits;
  const lo = maxJump(L, 1) + 1.5;
  const hi = Math.max(lo + 1, maxJump(L, 2) * lerp(0.8, 0.97, ctx.difficulty));
  return pitChunk('gap', ctx, ctx.rng.range(lo, hi), 'Wide gap: jump, then jump again in mid-air');
};

export const fences: Template = (ctx) => {
  const { rng, difficulty: d, limits: L } = ctx;
  const b = new PlanBuilder('fences');
  let x = leadIn(b, ctx, hopLead(L));
  b.hint(Math.max(0, x - hopLead(L) - L.minRunway), 'Red fences zap on contact: jump them', ctx.teach);
  const count = d < 0.3 ? 1 : 1 + Math.round(rng.range(0, 1.5));
  let end = x;
  for (let i = 0; i < count; i++) {
    const h = rng.range(1.0, lerp(1.6, Math.min(2.8, L.hopHeight - 1.2), d));
    const w = rng.range(0.4, Math.max(0.5, Math.min(lerp(1.2, 4, d), maxFence(L, 1, h) * 0.9)));
    b.fence(x - w / 2, w, h);
    end = x + w / 2;
    // Next centre: this hop's touchdown, a reaction time, then the next hop's lead.
    x += hopFlight(L, 1) + L.minRunway + rng.range(1, 6);
  }
  end += hopFlight(L, 1) - hopLead(L) + 4;
  b.strip(0, 0, end, 0);
  return b.done(end);
};

/** Glowing wall too tall to hop: stick up the face, over the top, down the far ramp. */
export const wallRun: Template = (ctx) => {
  const { rng, difficulty: d, limits: L } = ctx;
  const b = new PlanBuilder('wall');
  const start = leadIn(b, ctx);
  const wallX = start + FILLET;
  const height = Math.min(22, Math.max(10, mustStickHeight(L)) + rng.range(0, lerp(1, 5, d)));
  const thick = rng.range(4.5, 6);
  b.hint(start - L.minRunway * 0.6, 'Hold {stick} to drive up the glowing wall', ctx.teach);

  b.strip(0, 0, wallX, 0);
  b.box(wallX, BOTTOM, wallX + thick, height, 'marked');
  b.fillet(vec(wallX, 0), vec(wallX - FILLET, FILLET), -90, 0);
  b.fillet(vec(wallX + thick, 0), vec(wallX + thick + FILLET, FILLET), 180, 270);
  b.challenge({ type: 'stick', x: start, to: wallX + thick + FILLET, path: 2 * height + thick });

  const landEnd = wallX + thick + rng.range(18, 24);
  b.strip(wallX + thick, 0, landEnd, 0, 'marked');
  const end = landEnd + rng.range(6, 12);
  b.strip(landEnd, 0, end, 0);

  if (rng.chance(0.6)) b.pickup(wallX - 1.3, height * rng.range(0.5, 0.8));
  if (rng.chance(0.4)) b.pickup(wallX + thick / 2, height + 1.3);
  return b.done(end);
};

/**
 * The "7": glowing wall up to an overhead arm that points back over the
 * approach. Drive up, along the ceiling, round the arm's end and back over
 * the top, then down the ramp.
 */
export const loop: Template = (ctx) => {
  const { rng, difficulty: d, limits: L } = ctx;
  const b = new PlanBuilder('loop');
  const arm = rng.range(20, lerp(26, 34, d));
  const height = rng.range(14, 18);
  const start = Math.max(leadIn(b, ctx), arm + 6 - FILLET);
  const wallX = start + FILLET;
  b.hint(start - L.minRunway * 0.6, 'Hold {stick} through the loop', ctx.teach);

  b.strip(0, 0, wallX, 0);
  b.box(wallX, 0, wallX + 2, height, 'marked'); // wall
  b.box(wallX + 2 - arm, height, wallX + 2, height + 2, 'marked'); // arm: underside, end and top
  b.fillet(vec(wallX, 0), vec(wallX - FILLET, FILLET), -90, 0); // floor to wall
  b.fillet(vec(wallX, height), vec(wallX - FILLET, height - FILLET), 0, 90); // wall to ceiling
  b.box(wallX + 2, 0, wallX + 30, height + 2);
  const rampEnd = wallX + 30 + (height + 2) * 1.3;
  b.strip(wallX + 30, height + 2, rampEnd, 0);
  b.challenge({ type: 'stick', x: start, to: wallX + 2, path: 2 * height + 2 * arm });

  if (rng.chance(0.6)) b.pickup(wallX - arm / 2, height - 1.2);
  const end = rampEnd + rng.range(8, 14);
  b.strip(rampEnd, 0, end, 0);
  return b.done(end);
};

/** Pit too deep to survive, with a glowing wall on the far side: jump at it and stick. */
export const wallBridge: Template = (ctx) => {
  const { rng, difficulty: d, limits: L } = ctx;
  const b = new PlanBuilder('bridge');
  const edge = leadIn(b, ctx);
  const width = Math.max(6, maxJump(L, 1, -3, 'face') * lerp(0.45, 0.9, d) * rng.range(0.8, 1));
  const faceX = edge + width;
  const height = rng.range(8, 13);
  const thick = rng.range(4.5, 6);
  b.hint(edge - L.minRunway * 0.9, 'Jump at the wall and hold {stick} to grab it', ctx.teach);

  b.strip(0, 0, edge, 0);
  b.challenge({ type: 'jump', x: edge, width, dropTo: -3, target: 'face' });
  b.box(faceX, BOTTOM, faceX + thick, height, 'marked');
  b.fillet(vec(faceX + thick, 0), vec(faceX + thick + FILLET, FILLET), 180, 270);
  b.challenge({ type: 'stick', x: faceX, to: faceX + thick + FILLET, path: 2 * height + thick });
  const landEnd = faceX + thick + rng.range(16, 22);
  b.strip(faceX + thick, 0, landEnd, 0, 'marked');
  const end = landEnd + rng.range(6, 12);
  b.strip(landEnd, 0, end, 0);
  if (rng.chance(0.5)) b.pickup(faceX - 1.3, height * 0.6);
  return b.done(end);
};

/** Random templates and their weights at difficulty `d`. */
export const weightedTemplates = (d: number): Array<readonly [Template, number]> => [
  [runway(), lerp(0.8, 0.3, d)],
  [bumps, 1.1],
  [pit, 2],
  [fences, d < 0.05 ? 0.5 : 1.6],
  [wallRun, 1.4],
  [loop, 1],
  [gap, d < 0.15 ? 0 : 1.2],
  [wallBridge, d < 0.2 ? 0 : 1.4],
];

/** First-run lesson order: one new move or fail state per stretch. */
export const introTemplates = (): Template[] => [
  () => {
    const b = new PlanBuilder('start');
    b.strip(0, 0, 60, 0);
    b.hint(30, 'The car drives itself. Press {hop} to jump.');
    return b.done(60);
  },
  (ctx) => pitChunk('pit', { ...ctx, difficulty: 0 }, Math.min(10, maxJump(ctx.limits, 1)), 'Pit ahead: jump it with {hop}'),
  (ctx) => {
    const b = new PlanBuilder('fences');
    const x = ctx.limits.minRunway + hopLead(ctx.limits) + 6;
    b.hint(4, 'Red fences zap on contact: jump them');
    b.fence(x, 0.6, 1.3);
    b.strip(0, 0, x + 24, 0);
    return b.done(x + 24);
  },
  (ctx) => wallRun({ ...ctx, difficulty: 0, teach: true }),
  () => {
    const b = new PlanBuilder('charge');
    b.strip(0, 0, 40, 0);
    b.pickup(22, CELL_Y, true);
    b.hint(4, 'Green cells recharge your battery. Grab them!');
    return b.done(40);
  },
  (ctx) => loop({ ...ctx, difficulty: 0, teach: true }),
];
