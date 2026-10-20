import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { registerSurface, unregisterSurface } from '../course/Surfaces';
import { Random } from '../util/random';
import { Vec2, vec } from '../util/vec2';
import type { ChunkPlan, Hazard, Hint, SurfaceKind } from './plan';

/** Depth of the course pieces along z, metres. */
export const DEPTH = 5;
/** Charge cell pickup radius, m. */
export const CELL_RADIUS = 0.7;

export interface BuiltPickup {
  position: Vec2;
  mesh: THREE.Object3D;
  taken: boolean;
}

export interface BuiltHazard extends Hazard {
  /** Outline for overlap tests. */
  outline: Vec2[];
  hit: boolean;
  /** Closest the car has come, m. */
  closest: number;
  passed: boolean;
}

/** A chunk turned into Rapier colliders and Three.js meshes, at world x `x0`. */
export interface BuiltChunk {
  plan: ChunkPlan;
  x0: number;
  x1: number;
  body: RAPIER.RigidBody;
  colliders: RAPIER.Collider[];
  group: THREE.Group;
  hazards: BuiltHazard[];
  pickups: BuiltPickup[];
  hints: Hint[];
}

/** Builds and frees chunks. Materials and shared geometry live as long as the course. */
export class ChunkBuilder {
  private readonly materials: Record<SurfaceKind, THREE.Material> = {
    ground: new THREE.MeshStandardMaterial({ color: 0x3a4459, roughness: 0.85 }),
    marked: new THREE.MeshStandardMaterial({ color: 0x0c5a73, emissive: 0x19b8e6, emissiveIntensity: 0.55, roughness: 0.4 }),
  };
  private readonly edgeMaterials: Record<SurfaceKind, THREE.LineBasicMaterial> = {
    ground: new THREE.LineBasicMaterial({ color: 0x4a5670 }),
    marked: new THREE.LineBasicMaterial({ color: 0x7fe3ff }),
  };
  readonly fenceMaterial = new THREE.MeshStandardMaterial({
    color: 0xff2040,
    emissive: 0xff2040,
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  private readonly fenceEdge = new THREE.LineBasicMaterial({ color: 0xff8095 });
  private readonly postMaterial = new THREE.MeshStandardMaterial({ color: 0x20242e, metalness: 0.5, roughness: 0.5 });
  private readonly cellMaterial = new THREE.MeshStandardMaterial({ color: 0x7cff6b, emissive: 0x4dff3a, emissiveIntensity: 0.9 });
  private readonly cellGeometry = new THREE.OctahedronGeometry(0.55);
  private readonly backdropMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2133, roughness: 1 });

  constructor(
    private readonly world: RAPIER.World,
    private readonly scene: THREE.Scene,
  ) {}

  build(plan: ChunkPlan, x0: number, index: number): BuiltChunk {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const group = new THREE.Group();
    const colliders: RAPIER.Collider[] = [];
    const shift = (p: Vec2) => vec(p.x + x0, p.y);

    for (const piece of plan.pieces) {
      const outline = piece.outline.map(shift);
      const points = new Float32Array(outline.length * 6);
      outline.forEach((p, i) => points.set([p.x, p.y, -DEPTH / 2, p.x, p.y, DEPTH / 2], i * 6));
      const desc = RAPIER.ColliderDesc.convexHull(points);
      if (!desc) throw new Error(`Course piece in ${plan.name} is not convex`);
      const collider = this.world.createCollider(desc.setFriction(0.8), body);
      registerSurface(collider, { marked: piece.kind === 'marked', outline });
      colliders.push(collider);

      const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, p.y)));
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false });
      geometry.translate(0, 0, -DEPTH / 2);
      const mesh = new THREE.Mesh(geometry, this.materials[piece.kind]);
      mesh.receiveShadow = true;
      mesh.castShadow = piece.kind === 'marked';
      group.add(mesh);
      if (piece.edges) group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), this.edgeMaterials[piece.kind]));
    }

    const hazards = plan.hazards.map((h): BuiltHazard => {
      const x1 = h.x1 + x0;
      const x2 = h.x2 + x0;
      this.addFence(group, x1, h.y1, x2, h.y2);
      return {
        x1,
        y1: h.y1,
        x2,
        y2: h.y2,
        outline: [vec(x1, h.y1), vec(x2, h.y1), vec(x2, h.y2), vec(x1, h.y2)],
        hit: false,
        closest: Infinity,
        passed: false,
      };
    });

    const pickups = plan.pickups.map((p): BuiltPickup => {
      const mesh = new THREE.Mesh(this.cellGeometry, this.cellMaterial);
      mesh.position.set(p.x + x0, p.y, 0);
      group.add(mesh);
      return { position: vec(p.x + x0, p.y), mesh, taken: false };
    });

    this.addBackdrop(group, x0, x0 + plan.length, index);
    this.scene.add(group);
    return {
      plan,
      x0,
      x1: x0 + plan.length,
      body,
      colliders,
      group,
      hazards,
      pickups,
      hints: plan.hints.map((h) => ({ x: h.x + x0, text: h.text })),
    };
  }

  dispose(chunk: BuiltChunk): void {
    for (const c of chunk.colliders) unregisterSurface(c);
    this.world.removeRigidBody(chunk.body);
    this.scene.remove(chunk.group);
    chunk.group.traverse((o) => {
      const g = (o as THREE.Mesh).geometry;
      if (g && g !== this.cellGeometry) g.dispose();
    });
  }

  /** Glowing translucent box between two posts at each end. */
  private addFence(group: THREE.Group, x1: number, y1: number, x2: number, y2: number): void {
    const w = Math.max(0.05, x2 - x1);
    const h = y2 - y1;
    const field = new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH * 0.9), this.fenceMaterial);
    field.position.set((x1 + x2) / 2, y1 + h / 2, 0);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(field.geometry), this.fenceEdge);
    edges.position.copy(field.position);
    group.add(field, edges);
    for (const x of [x1, x2]) {
      for (const z of [-DEPTH * 0.45, DEPTH * 0.45]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, h + 0.3, 0.2), this.postMaterial);
        post.position.set(x, y1 + (h + 0.3) / 2, z);
        post.castShadow = true;
        group.add(post);
      }
    }
  }

  /** Distant blocks behind the course so the camera move reads as depth. */
  private addBackdrop(group: THREE.Group, from: number, to: number, index: number): void {
    const rng = new Random(index * 7919 + 13);
    for (let x = from; x < to; x += 9) {
      const h = 8 + rng.next() * 40;
      const w = 4 + rng.next() * 6;
      const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), this.backdropMaterial);
      block.position.set(x + rng.next() * 6, h / 2 - 10, -40 - rng.next() * 50);
      group.add(block);
    }
  }

  /** Spin the cells and pulse the fences. */
  animate(time: number): void {
    this.cellMaterial.emissiveIntensity = 0.7 + 0.3 * Math.sin(time * 5);
    this.fenceMaterial.emissiveIntensity = 0.8 + 0.4 * Math.sin(time * 14);
    this.fenceMaterial.opacity = 0.3 + 0.1 * Math.sin(time * 14);
  }
}
