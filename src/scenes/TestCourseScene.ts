import Phaser from 'phaser';
import { Car, CarEvent } from '../car/Car';
import { Hop } from '../car/Hop';
import { Stick } from '../car/Stick';
import { TUNING } from '../config/tuning';
import { CourseInfo, buildTestCourse } from '../course/TestCourse';
import { Input } from '../input/Input';
import { Hud } from '../ui/Hud';

/** Seconds after a run ends before Hop restarts, so a mid-air tap doesn't skip the banner. */
const RESTART_DELAY = 0.5;

/**
 * Milestone 1 feel prototype: one handmade course, the car, and a bare
 * distance counter. A run ends on a pit, an upside-down landing, or the finish;
 * proper fail states and scoring belong to C5 (Milestone 2).
 */
export class TestCourseScene extends Phaser.Scene {
  private course!: CourseInfo;
  private car!: Car;
  private hop!: Hop;
  private stick!: Stick;
  private input6!: Input;
  private hud!: Hud;
  private bestX = 0;
  private runOverFor = -1;

  constructor() {
    super('TestCourse');
  }

  create(): void {
    this.bestX = 0;
    this.runOverFor = -1;
    this.cameras.main.setBackgroundColor('#0b0f17');

    this.course = buildTestCourse(this);
    this.car = new Car(this, this.course.start.x, this.course.start.y);
    this.hop = new Hop(this.car);
    this.stick = new Stick(this, this.car);
    this.input6 = new Input(this);
    this.hud = new Hud(this);

    const { bounds } = this.course;
    this.cameras.main
      .setBounds(bounds.x, bounds.y, bounds.width, bounds.height)
      .startFollow(this.car.sprite, true, 0.12, 0.12, -220, 60);

    this.car.events.on(CarEvent.UpsideDown, () => this.endRun('Upside down!'));
    this.input.keyboard?.on('keydown-R', () => this.scene.restart());

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__wallrunner = { scene: this, car: this.car, hop: this.hop, stick: this.stick };
    }
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    this.input6.update();

    if (this.runOverFor >= 0) {
      this.runOverFor += dt;
      if (this.runOverFor > RESTART_DELAY && this.input6.justPressed('hop')) this.scene.restart();
    }

    const playing = this.runOverFor < 0;
    this.stick.update(dt, playing && this.input6.isDown('stick'));
    this.hop.update(dt, playing && this.input6.justPressed('hop'));
    this.car.update(dt, !playing || this.input6.isDown('brake'));

    const { x, y } = this.car.position;
    this.bestX = Math.max(this.bestX, x - this.course.start.x);
    if (playing && y > this.course.killY) this.endRun('Fell in the pit');
    if (playing && x > this.course.finishX) this.endRun('Course clear!');

    this.hud.update(this.hop.fuel, this.hop.capacity, TUNING.hop.fuelCost, this.stick.isAttached, this.metres);
  }

  private get metres(): number {
    return this.bestX / TUNING.world.pxPerMetre;
  }

  private endRun(title: string): void {
    if (this.runOverFor >= 0) return;
    this.runOverFor = 0;
    this.hud.showRunOver(title, this.metres);
  }
}
