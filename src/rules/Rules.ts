import { TUNING } from '../config/tuning';
import { Emitter } from '../util/Emitter';

/**
 * C5 Rules and score: fail states, charge drain, distance and style bonuses
 * (R1, R2). Consumes run signals only; emits style awards as they happen and
 * exactly one result per run.
 */

export type CauseOfDeath = 'pit' | 'hazard' | 'upside-down' | 'charge';

export interface RunResult {
  /** Course seed, so a run can be replayed or sanity-checked (C7). */
  seed: number;
  /** Metres travelled, rounded down. */
  distance: number;
  /** Distance plus style points. */
  score: number;
  cause: CauseOfDeath;
  /** Seconds. */
  duration: number;
  style: { wall: number; air: number; nearMiss: number };
}

/** What the game reports to the rules during a run. */
export type RunSignals = {
  /** One physics step. `upY` is the y of the car's roof direction (1 = level, -1 = on a ceiling). */
  tick: [s: { dt: number; x: number; grounded: boolean; stuck: boolean; upY: number }];
  fail: [cause: Exclude<CauseOfDeath, 'charge'>];
  pickup: [];
  'near-miss': [];
};

export type RulesEvents = {
  /** A style bonus was awarded. */
  style: [label: string, points: number];
  result: [result: RunResult];
};

export class Rules {
  readonly events = new Emitter<RulesEvents>();

  charge: number = TUNING.rules.chargeCapacity;
  distance = 0;
  duration = 0;
  readonly style = { wall: 0, air: 0, nearMiss: 0 };

  private seed = 0;
  private startX = 0;
  private over = true;
  /** Running wall-run points and whether it touched a ceiling. */
  private wallRun = 0;
  private ceiling = false;
  private airtime = 0;

  constructor(signals: Emitter<RunSignals>) {
    signals.on('tick', (s) => this.tick(s));
    signals.on('fail', (cause) => this.finish(cause));
    signals.on('pickup', () => {
      if (!this.over) this.charge = Math.min(TUNING.rules.chargeCapacity, this.charge + TUNING.rules.chargePerCell);
    });
    signals.on('near-miss', () => {
      if (this.over) return;
      this.style.nearMiss += TUNING.rules.nearMissPoints;
      this.events.emit('style', 'Near miss', TUNING.rules.nearMissPoints);
    });
  }

  get isOver(): boolean {
    return this.over;
  }

  get score(): number {
    return Math.floor(this.distance) + this.style.wall + this.style.air + this.style.nearMiss;
  }

  /** Charge drained per second at the current distance. */
  get drainRate(): number {
    return TUNING.rules.chargeDrain + (TUNING.rules.chargeDrainPerKm * this.distance) / 1000;
  }

  start(seed: number, startX: number): void {
    this.seed = seed;
    this.startX = startX;
    this.over = false;
    this.charge = TUNING.rules.chargeCapacity;
    this.distance = 0;
    this.duration = 0;
    this.style.wall = this.style.air = this.style.nearMiss = 0;
    this.wallRun = 0;
    this.ceiling = false;
    this.airtime = 0;
  }

  private tick(s: RunSignals['tick'][0]): void {
    if (this.over) return;
    const R = TUNING.rules;
    this.duration += s.dt;
    this.distance = Math.max(this.distance, s.x - this.startX);

    // Wall and ceiling runs: stuck with the roof pointing sideways or down.
    if (s.stuck && s.upY < 0.5) {
      const onCeiling = s.upY < -0.5;
      this.ceiling ||= onCeiling;
      this.wallRun += R.wallPointsPerSecond * (onCeiling ? 2 : 1) * s.dt;
    } else if (this.wallRun > 0) {
      const points = Math.round(this.wallRun);
      if (points > 0) {
        this.style.wall += points;
        this.events.emit('style', this.ceiling ? 'Ceiling run' : 'Wall run', points);
      }
      this.wallRun = 0;
      this.ceiling = false;
    }

    // Airtime: wheels off everything and not stuck.
    if (!s.grounded && !s.stuck) {
      this.airtime += s.dt;
    } else if (this.airtime > 0) {
      const points = Math.round(Math.max(0, this.airtime - R.airtimeMin) * R.airPointsPerSecond);
      if (points > 0) {
        this.style.air += points;
        this.events.emit('style', `Air ${this.airtime.toFixed(1)} s`, points);
      }
      this.airtime = 0;
    }

    this.charge -= this.drainRate * s.dt;
    if (this.charge <= 0) {
      this.charge = 0;
      this.finish('charge');
    }
  }

  private finish(cause: CauseOfDeath): void {
    if (this.over) return;
    this.over = true;
    this.events.emit('result', {
      seed: this.seed,
      distance: Math.floor(this.distance),
      score: this.score,
      cause,
      duration: this.duration,
      style: { ...this.style },
    });
  }
}
