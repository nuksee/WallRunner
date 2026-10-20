/** Minimal 2D vector helpers on plain {x, y} objects (Matter.js style). */

export interface Vec {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const length = (a: Vec): number => Math.hypot(a.x, a.y);

export const normalize = (a: Vec): Vec => {
  const len = length(a);
  return len > 1e-9 ? { x: a.x / len, y: a.y / len } : { x: 0, y: 0 };
};

/** Unit vector pointing along `angle` (radians, Phaser/Matter convention: y down). */
export const fromAngle = (angle: number): Vec => ({ x: Math.cos(angle), y: Math.sin(angle) });

/** Shortest signed difference `to - from` wrapped to (-π, π]. */
export const angleDelta = (from: number, to: number): number => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
};

/** Closest point to `p` on a convex polygon's boundary. */
export const closestPointOnPolygon = (p: Vec, vertices: readonly Vec[]): Vec => {
  let best = vertices[0];
  let bestDist = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const ab = sub(b, a);
    const lenSq = dot(ab, ab);
    const t = lenSq > 0 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / lenSq)) : 0;
    const q = add(a, scale(ab, t));
    const d = length(sub(p, q));
    if (d < bestDist) {
      bestDist = d;
      best = q;
    }
  }
  return best;
};
