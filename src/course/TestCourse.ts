import Phaser from 'phaser';
import { MARKED_SURFACE_LABEL } from '../config/tuning';
import { Vec, vec } from '../util/vec';

/**
 * Milestone 1 handmade test course. Not the C4 generator: a fixed layout that
 * exercises each move once, left to right:
 *
 *   flat start, gentle bump (sloped strip for C1)
 *   pit                one hop clears it
 *   wall run           marked wall too tall to hop; stick up and over
 *   hop-only gap       nothing to stick to; two or three hops
 *   loop and ceiling   floor -> marked wall -> marked ceiling -> around its
 *                      end -> back on top: one full floor-wall-ceiling loop
 *   finish line
 */

export interface CourseInfo {
  start: Vec;
  finishX: number;
  /** Below this y the car has fallen into a pit. */
  killY: number;
  bounds: Phaser.Geom.Rectangle;
}

const FLOOR_Y = 600;
const DEPTH = 1100;

const COLORS = {
  ground: 0x2b3245,
  groundEdge: 0x56607a,
  marked: 0x0f6f8c,
  markedEdge: 0x4cc9f0,
  finish: 0xffd166,
};

type Kind = 'ground' | 'marked';

export function buildTestCourse(scene: Phaser.Scene): CourseInfo {
  const g = scene.add.graphics().setDepth(-1);

  const poly = (points: Vec[], kind: Kind): void => {
    const centre = scene.matter.vertices.centre(points);
    scene.matter.add.fromVertices(centre.x, centre.y, points, {
      isStatic: true,
      friction: 0.02,
      label: kind === 'marked' ? MARKED_SURFACE_LABEL : 'ground',
    });
    const fill = kind === 'marked' ? COLORS.marked : COLORS.ground;
    const edge = kind === 'marked' ? COLORS.markedEdge : COLORS.groundEdge;
    g.fillStyle(fill).fillPoints(points, true);
    g.lineStyle(kind === 'marked' ? 4 : 2, edge).strokePoints(points, true);
  };

  const box = (x1: number, y1: number, x2: number, y2: number, kind: Kind = 'ground'): void =>
    poly([vec(x1, y1), vec(x2, y1), vec(x2, y2), vec(x1, y2)], kind);

  /** Floor strip whose top runs from (x1, y1) to (x2, y2). */
  const strip = (x1: number, y1: number, x2: number, y2: number, kind: Kind = 'ground'): void =>
    poly([vec(x1, y1), vec(x2, y2), vec(x2, DEPTH), vec(x1, DEPTH)], kind);

  // Start and a gentle bump (flat and sloped strip for C1).
  strip(-400, FLOOR_Y, 1200, FLOOR_Y);
  strip(1200, FLOOR_Y, 1500, FLOOR_Y - 80);
  strip(1500, FLOOR_Y - 80, 1800, FLOOR_Y - 80);
  strip(1800, FLOOR_Y - 80, 2100, FLOOR_Y);
  strip(2100, FLOOR_Y, 2600, FLOOR_Y);

  // Pit: 220 px, one hop.
  strip(2820, FLOOR_Y, 3600, FLOOR_Y);

  // Wall run: marked block taller than three hops, marked landing strip behind it.
  box(3600, FLOOR_Y - 460, 3700, FLOOR_Y, 'marked');
  strip(3700, FLOOR_Y, 4200, FLOOR_Y, 'marked');
  strip(4200, FLOOR_Y, 4500, FLOOR_Y);

  // Hop-only gap: 600 px, nothing marked.
  strip(5100, FLOOR_Y, 6100, FLOOR_Y);

  // Loop and ceiling section, a "7" shape: marked column face, marked arm
  // overhead, unmarked block behind them that ramps back down.
  const armTop = FLOOR_Y - 310;
  const armBottom = FLOOR_Y - 270;
  box(6100, armBottom, 6160, FLOOR_Y, 'marked'); // wall
  box(5500, armTop, 6160, armBottom, 'marked'); // ceiling (underside) and its top
  box(6160, armTop, 6700, FLOOR_Y);
  strip(6700, armTop, 7100, FLOOR_Y);
  strip(7100, FLOOR_Y, 8200, FLOOR_Y);
  box(8200, FLOOR_Y - 400, 8300, FLOOR_Y); // end stop

  const finishX = 7600;
  g.fillStyle(COLORS.finish, 0.9);
  for (let i = 0; i < 8; i++) g.fillRect(finishX - 4, FLOOR_Y - 160 + i * 20, 8, 10);

  return {
    start: vec(150, FLOOR_Y - 40),
    finishX,
    killY: FLOOR_Y + 200,
    bounds: new Phaser.Geom.Rectangle(-400, -200, 8700, FLOOR_Y + 400),
  };
}
