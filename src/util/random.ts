/** Small seeded random source (mulberry32), so a course can be rebuilt from its seed. */
export class Random {
  private state: number;

  constructor(readonly seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick by weight; entries with weight <= 0 are never picked. */
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
    let r = this.next() * total;
    for (const [item, w] of entries) {
      if (w <= 0) continue;
      r -= w;
      if (r < 0) return item;
    }
    return entries.find(([, w]) => w > 0)![0];
  }
}

export const randomSeed = (): number => Math.floor(Math.random() * 2 ** 31);
