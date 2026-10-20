import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Car } from '../car/Car';
import { Hop } from '../car/Hop';
import { Stick } from '../car/Stick';
import { TUNING } from '../config/tuning';
import { Course } from '../generator/Course';
import { Input } from '../input/Input';
import { CarView } from '../render/CarView';
import { ChaseCamera } from '../render/ChaseCamera';
import { CauseOfDeath, Rules, RunResult, RunSignals } from '../rules/Rules';
import { Hud } from '../ui/Hud';
import { createTuningPanel } from '../ui/TuningPanel';
import { Emitter } from '../util/Emitter';
import { randomSeed } from '../util/random';
import { scale } from '../util/vec2';

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
/** Seconds after a run ends before Hop restarts, so a mid-air tap doesn't skip the results. */
const RESTART_DELAY = 0.8;
const BEST_KEY = 'wallrunner.best';

const DEATH_TITLES: Record<CauseOfDeath, string> = {
  pit: 'Fell in a pit',
  hazard: 'Zapped by a fence',
  'upside-down': 'Landed on the roof',
  charge: 'Out of charge',
};

/**
 * Milestone 2: the endless generated course (C4) with fail states, charge and
 * scoring (C5) around the M1 car. Wires components together through events.
 */
export class Game {
  readonly world: RAPIER.World;
  readonly car: Car;
  readonly hop: Hop;
  readonly stick: Stick;
  readonly course: Course;
  readonly rules: Rules;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: ChaseCamera;
  private readonly carView: CarView;
  private readonly input: Input;
  private readonly hud: Hud;
  private readonly signals = new Emitter<RunSignals>();

  private accumulator = 0;
  private lastTime = 0;
  private best = readBest();
  /** Seconds since the run ended, or -1 while playing. */
  runOverFor = -1;
  lastResult: RunResult | null = null;

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
    this.course = new Course(this.world, this.scene);
    this.course.reset(randomSeed());

    this.car = new Car(this.world, this.course.start.x, this.course.start.y);
    this.hop = new Hop(this.car);
    this.stick = new Stick(this.world, this.car);
    this.carView = new CarView(this.car, this.scene);
    this.camera = new ChaseCamera(this.car, sun);
    this.rules = new Rules(this.signals);

    this.input = new Input(overlay);
    this.hud = new Hud(overlay);
    createTuningPanel(overlay, () => this.restart());

    this.car.events.on('upside-down', () => this.signals.emit('fail', 'upside-down'));
    this.course.events.on('pit', () => this.signals.emit('fail', 'pit'));
    this.course.events.on('hazard', () => {
      this.car.setVelocity(scale(this.car.velocity, 0.25));
      this.signals.emit('fail', 'hazard');
    });
    this.course.events.on('pickup', () => this.signals.emit('pickup'));
    this.course.events.on('near-miss', () => this.signals.emit('near-miss'));
    this.rules.events.on('style', (label, points) => this.hud.popup(label, points));
    this.rules.events.on('result', (result) => this.endRun(result));

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR') this.restart();
    });
    window.addEventListener('resize', () => this.resize());
    this.resize();
    // Compile every shader now so the first fence or cell on screen doesn't stall a frame.
    this.renderer.compile(this.scene, this.camera.camera);
    this.rules.start(this.course.seed, this.course.start.x);
  }

  start(): void {
    this.lastTime = performance.now();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  /** New run on a new course. */
  restart(seed = randomSeed()): void {
    const { x, y } = this.course.start;
    this.stick.reset();
    this.car.reset(x, y);
    this.hop.reset();
    this.course.reset(seed);
    this.rules.start(seed, x);
    this.camera.snap();
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

    let playing = this.runOverFor < 0;
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
      if (playing) {
        this.course.check(this.car.hull, this.car.position);
        const { x } = this.car.position;
        this.signals.emit('tick', {
          dt: STEP,
          x,
          grounded: this.car.isGrounded,
          stuck: this.car.isStuck,
          upY: this.car.up.y,
        });
        playing = !this.rules.isOver;
      }
    }

    const { x } = this.car.position;
    this.course.update(x);
    this.course.animate(time / 1000);

    const hint = playing ? this.course.hintAt(x) : '';
    this.hud.showHint(hint.replace(/\{(hop|stick)\}/g, (_, a: 'hop' | 'stick') => this.input.label(a)));
    this.hud.update({
      fuel: this.hop.fuel,
      capacity: this.hop.capacity,
      hopCost: TUNING.hop.fuelCost,
      stuck: this.stick.isAttached,
      charge: this.rules.charge / TUNING.rules.chargeCapacity,
      score: this.rules.score,
      metres: this.rules.distance,
    });

    this.carView.update(dt);
    this.camera.update(dt);
    this.renderer.render(this.scene, this.camera.camera);
  }

  private endRun(result: RunResult): void {
    this.runOverFor = 0;
    this.lastResult = result;
    const isBest = result.score > this.best;
    if (isBest) {
      this.best = result.score;
      writeBest(result.score);
    }
    this.hud.showRunOver(DEATH_TITLES[result.cause], result, this.best, isBest, `${this.input.label('hop')} to run again`);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.setAspect(w / h);
  }
}

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Storage blocked: the best score lasts for this visit only.
  }
}
