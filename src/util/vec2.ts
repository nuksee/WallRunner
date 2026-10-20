/** Minimal 2D vector helpers for the play plane (+x right, +y up). */

export interface Vec2 {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);

export const normalize = (a: Vec2): Vec2 => {
  const len = length(a);
  return len > 1e-9 ? { x: a.x / len, y: a.y / len } : { x: 0, y: 0 };
};

/** Rotate a vector by `angle` radians (counter-clockwise). */
export const rotate = (a: Vec2, angle: number): Vec2 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};

/** Shortest signed difference `to - from` wrapped to (-π, π]. */
export const angleDelta = (from: number, to: number): number => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
};

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Closest point to `p` on a convex polygon's boundary. */
export const closestPointOnPolygon = (p: Vec2, vertices: readonly Vec2[]): Vec2 => {
  let best = vertices[0];
  let bestDist = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const ab = sub(b, a);
    const lenSq = dot(ab, ab);
    const t = lenSq > 0 ? clamp(dot(sub(p, a), ab) / lenSq, 0, 1) : 0;
    const q = add(a, scale(ab, t));
    const d = length(sub(p, q));
    if (d < bestDist) {
      bestDist = d;
      best = q;
    }
  }
  return best;
};

/** True when `p` lies inside a counter-clockwise convex polygon. */
export const pointInConvex = (p: Vec2, vertices: readonly Vec2[]): boolean => {
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0) return false;
  }
  return true;
};

/** Separating-axis test for two convex polygons (either winding). */
export const convexOverlap = (a: readonly Vec2[], b: readonly Vec2[]): boolean => {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const axis = vec(q.y - p.y, p.x - q.x);
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const v of a) {
        const d = dot(v, axis);
        minA = Math.min(minA, d);
        maxA = Math.max(maxA, d);
      }
      for (const v of b) {
        const d = dot(v, axis);
        minB = Math.min(minB, d);
        maxB = Math.max(maxB, d);
      }
      if (maxA < minB || maxB < minA) return false;
    }
  }
  return true;
};

/** Gap between two convex polygons, 0 when they overlap. */
export const convexDistance = (a: readonly Vec2[], b: readonly Vec2[]): number => {
  if (convexOverlap(a, b)) return 0;
  let best = Infinity;
  for (const p of a) best = Math.min(best, length(sub(p, closestPointOnPolygon(p, b))));
  for (const p of b) best = Math.min(best, length(sub(p, closestPointOnPolygon(p, a))));
  return best;
};
