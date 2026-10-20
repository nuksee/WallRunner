import type RAPIER from '@dimforge/rapier3d-compat';
import type { Vec2 } from '../util/vec2';

/**
 * Registry of course surfaces, keyed by Rapier collider handle. The course
 * registers each piece; C3 Stick asks whether a collider is marked (L3) and
 * reads its outline on the play plane.
 */
export interface Surface {
  marked: boolean;
  /** Convex outline in the play plane (x, y), counter-clockwise. */
  outline: Vec2[];
}

const surfaces = new Map<number, Surface>();

export const registerSurface = (collider: RAPIER.Collider, surface: Surface): void => {
  surfaces.set(collider.handle, surface);
};

export const unregisterSurface = (collider: RAPIER.Collider): void => {
  surfaces.delete(collider.handle);
};

export const surfaceOf = (collider: RAPIER.Collider): Surface | undefined => surfaces.get(collider.handle);

export const allSurfaces = (): Array<[number, Surface]> => [...surfaces.entries()];

export const clearSurfaces = (): void => surfaces.clear();
