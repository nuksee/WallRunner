import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Car } from '../car/Car';
import { Hop } from '../car/Hop';
import { Stick } from '../car/Stick';
import { TUNING } from '../config/tuning';
import { CourseInfo, buildTestCourse } from '../course/TestCourse';
import { Input } from '../input/Input';
import { CarView } from '../render/CarView';
import { ChaseCamera } from '../render/ChaseCamera';
import { Hud } from '../ui/Hud';
import { createTuningPanel } from '../ui/TuningPanel';

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
/** Seconds after a run ends before Hop restarts, so a mid-air tap doesn't skip the banner. */
const RESTART_DELAY = 0.5;

/**
 * Milestone 1 feel prototype: one handmade course, the car, and a bare
 * distance counter. A run ends on a pit, an upside-down landing, or the finish;
 * proper fail states and scoring belong to C5 (Milestone 2).
 */
export class Game {
  readonly world: RAPIER.World;
  readonly car: Car;
  readonly hop: Hop;
  readonly stick: Stick;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: ChaseCamera;
  private readonly carView: CarView;
  private readonly course: CourseInfo;
  private readonly input: Input;
  private readonly hud: Hud;

  private accumulator = 0;
  private lastTime = 0;
  private bestX = 0;
  /** Seconds since the run ended, or -1 while playing. */
  runOverFor = -1;

  constructor(container: HTMLElement, overlay: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0b0f17);
    this.scene.fog = new THREE.Fog(0x0b0f17, 60, 160);
    this.scene.add(new THREE.HemisphereLight(0x9fb6ff, 0x1a1f2b, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-20, 40, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 30, bottom: -30, near: 1, far: 150 });
    this.scene.add(sun, sun.target);

    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.world.timestep = STEP;
    this.course = buildTestCourse(this.world, this.scene);

    this.car = new Car(this.world, this.course.start.x, this.course.start.y);
    this.hop = new Hop(this.car);
    this.stick = new Stick(this.world, this.car);
    this.carView = new CarView(this.car, this.scene);
    this.camera = new ChaseCamera(this.car, sun);

    this.input = new Input(overlay);
    this.hud = new Hud(overlay);
    createTuningPanel(overlay, () => this.restart());

    this.car.events.on('upside-down', () => this.endRun('Upside down!'));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR') this.restart();
    });
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  start(): void {
    this.lastTime = performance.now();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  restart(): void {
    const { x, y } = this.course.start;
    this.car.reset(x, y);
    this.hop.reset();
    this.stick.reset();
    this.camera.snap();
    this.bestX = 0;
    this.runOverFor = -1;
    this.hud.hideRunOver();
  }

  private frame(time: number): void {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.input.update();

    if (this.runOverFor >= 0) {
      this.runOverFor += dt;
      if (this.runOverFor > RESTART_DELAY && this.input.justPressed('hop')) this.restart();
    }

    const playing = this.runOverFor < 0;
    let hopPressed = playing && this.input.justPressed('hop');
    this.accumulator = Math.min(this.accumulator + dt, STEP * MAX_STEPS_PER_FRAME);
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      this.car.sense();
      this.stick.update(STEP, playing && this.input.isDown('stick'));
      this.hop.update(STEP, hopPressed);
      hopPressed = false;
      this.car.step(STEP, !playing || this.input.isDown('brake'));
      this.world.step();
    }

    const { x, y } = this.car.position;
    this.bestX = Math.max(this.bestX, x - this.course.start.x);
    if (playing && y < this.course.killY) this.endRun('Fell in the pit');
    if (playing && x > this.course.finishX) this.endRun('Course clear!');

    const hint = [...this.course.hints].reverse().find((h) => x >= h.x);
    this.hud.showHint(
      playing && hint ? hint.text.replace(/\{(hop|stick)\}/g, (_, a: 'hop' | 'stick') => this.input.label(a)) : '',
    );
    this.hud.update(this.hop.fuel, this.hop.capacity, TUNING.hop.fuelCost, this.stick.isAttached, this.bestX);

    this.carView.update(dt);
    this.camera.update(dt);
    this.renderer.render(this.scene, this.camera.camera);
  }

  private endRun(title: string): void {
    if (this.runOverFor >= 0) return;
    this.runOverFor = 0;
    this.hud.showRunOver(title, this.bestX, `${this.input.label('hop')} to run again`);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.setAspect(w / h);
  }
}
