import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Vec2, vec } from '../util/vec2';
import { clearSurfaces, registerSurface } from './Surfaces';

/**
 * Milestone 1 handmade test course. Not the C4 generator: a short, fixed
 * layout that teaches one move at a time, left to right:
 *
 *   flat start and a gentle bump    (C1 on flat and sloped ground)
 *   pit                             one hop clears it
 *   wall run                        glowing wall too tall to hop; stick up and over
 *   hop-only gap                    nothing to stick to; two hops
 *   loop and ceiling                floor -> wall -> ceiling -> around its end -> on top
 *   finish line
 *
 * Units are metres; the floor top is y = 0 and play happens at z = 0.
 */

export interface Hint {
  /** Show the hint once the car passes this x. `{hop}` / `{stick}` become the control names. */
  x: number;
  text: string;
}

export interface CourseInfo {
  start: Vec2;
  finishX: number;
  /** Below this y the car has fallen into a pit. */
  killY: number;
  hints: Hint[];
}

type Kind = 'ground' | 'marked';

/** Depth of the course pieces along z, metres. */
const DEPTH = 5;
const BOTTOM = -30;

export function buildTestCourse(world: RAPIER.World, scene: THREE.Scene): CourseInfo {
  clearSurfaces();
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

  const materials: Record<Kind, THREE.Material> = {
    ground: new THREE.MeshStandardMaterial({ color: 0x3a4459, roughness: 0.85 }),
    marked: new THREE.MeshStandardMaterial({
      color: 0x0c5a73,
      emissive: 0x19b8e6,
      emissiveIntensity: 0.55,
      roughness: 0.4,
    }),
  };
  const edgeMaterials: Record<Kind, THREE.LineBasicMaterial> = {
    ground: new THREE.LineBasicMaterial({ color: 0x4a5670 }),
    marked: new THREE.LineBasicMaterial({ color: 0x7fe3ff }),
  };

  /** One convex piece, outline counter-clockwise in the play plane. */
  const poly = (outline: Vec2[], kind: Kind): void => {
    const points = new Float32Array(outline.length * 6);
    outline.forEach((p, i) => {
      points.set([p.x, p.y, -DEPTH / 2, p.x, p.y, DEPTH / 2], i * 6);
    });
    const desc = RAPIER.ColliderDesc.convexHull(points);
    if (!desc) throw new Error('Course piece is not convex');
    const collider = world.createCollider(desc.setFriction(0.8), body);
    registerSurface(collider, { marked: kind === 'marked', outline });

    const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, p.y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false });
    geometry.translate(0, 0, -DEPTH / 2);
    const mesh = new THREE.Mesh(geometry, materials[kind]);
    mesh.receiveShadow = true;
    mesh.castShadow = kind === 'marked';
    scene.add(mesh);
    scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), edgeMaterials[kind]));
  };

  const box = (x1: number, y1: number, x2: number, y2: number, kind: Kind = 'ground'): void =>
    poly([vec(x1, y1), vec(x2, y1), vec(x2, y2), vec(x1, y2)], kind);

  /** Floor strip whose top runs from (x1, y1) to (x2, y2). */
  const strip = (x1: number, y1: number, x2: number, y2: number, kind: Kind = 'ground'): void =>
    poly([vec(x1, BOTTOM), vec(x2, BOTTOM), vec(x2, y2), vec(x1, y1)], kind);

  // Start and a gentle bump.
  strip(-30, 0, 40, 0);
  strip(40, 0, 52, 2.5);
  strip(52, 2.5, 60, 2.5);
  strip(60, 2.5, 72, 0);
  strip(72, 0, 95, 0);

  // Pit: 11 m, one hop.
  strip(106, 0, 140, 0);

  // Wall run: glowing block taller than three hops, glowing landing strip behind it.
  box(140, 0, 145, 16, 'marked');
  strip(145, 0, 170, 0, 'marked');
  strip(170, 0, 185, 0);

  // Hop-only gap: 30 m, nothing to stick to.
  strip(215, 0, 270, 0);

  // Loop and ceiling, a "7" shape: glowing wall and overhead arm, solid block
  // behind them that ramps back down.
  box(268, 0, 270, 12, 'marked'); // wall
  box(238, 12, 270, 14, 'marked'); // ceiling underside, end and top
  box(270, 0, 300, 14);
  strip(300, 14, 318, 0);
  strip(318, 0, 400, 0);
  box(400, 0, 404, 12); // end stop

  const finishX = 360;
  addFinishLine(scene, finishX);
  addBackdrop(scene);

  return {
    start: vec(4, 1.6),
    finishX,
    killY: -12,
    hints: [
      { x: 0, text: 'The car drives itself. Press {hop} to jump.' },
      { x: 78, text: 'Pit ahead: jump it with {hop}' },
      { x: 118, text: 'Hold {stick} to drive up the glowing wall' },
      { x: 186, text: 'Big gap: jump, then jump again in mid-air' },
      { x: 222, text: 'Hold {stick} through the loop' },
      { x: 300, text: 'Nice. Run it again faster?' },
    ],
  };
}

function addFinishLine(scene: THREE.Scene, x: number): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb703, emissiveIntensity: 0.6 });
  for (const z of [-DEPTH / 2, DEPTH / 2]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), mat);
    post.position.set(x, 3, z);
    scene.add(post);
  }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, DEPTH), mat);
  banner.position.set(x, 6, 0);
  scene.add(banner);
}

/** Distant blocks behind the course so the camera move reads as depth. */
function addBackdrop(scene: THREE.Scene): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a2133, roughness: 1 });
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = -60; x < 460; x += 9) {
    const h = 8 + rand() * 40;
    const w = 4 + rand() * 6;
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    block.position.set(x + rand() * 6, h / 2 - 10, -40 - rand() * 50);
    scene.add(block);
  }
}
