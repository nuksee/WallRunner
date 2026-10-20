import GUI from 'lil-gui';
import { TUNING } from '../config/tuning';

/**
 * Tuning panel: live sliders over the shared constants in tuning.ts.
 * Toggle with the gear button or the T key. "Copy values" puts the current
 * numbers on the clipboard so good settings can be pasted back into tuning.ts.
 */
export function createTuningPanel(overlay: HTMLElement, onRestart: () => void): void {
  const gui = new GUI({ title: 'Tuning', width: 300 });
  gui.domElement.classList.add('tuning-panel');
  gui.hide();

  const car = gui.addFolder('Car (C1)');
  car.add(TUNING.car, 'cruiseSpeed', 5, 45, 0.5).name('speed (m/s)');
  car.add(TUNING.car, 'throttleAccel', 2, 60, 1).name('acceleration');
  car.add(TUNING.car, 'brakeDecel', 5, 80, 1).name('brake');
  car.add(TUNING.car, 'airRighting', 0, 60, 1).name('air self-righting');
  car.add(TUNING.car, 'suspensionHz', 0.8, 6, 0.1).name('suspension stiffness (Hz)');
  car.add(TUNING.car, 'suspensionDamping', 0.05, 1.5, 0.05).name('suspension damping');
  car.add(TUNING.car, 'suspensionRest', 0.2, 1.2, 0.05).name('suspension travel (m)');
  car.add(TUNING.world, 'gravity', 5, 60, 1).name('gravity (m/s²)');

  const hop = gui.addFolder('Hop (C2)');
  hop.add(TUNING.hop, 'height', 1, 12, 0.25).name('hop height (m)');
  hop.add(TUNING.hop, 'fuelCost', 5, 100, 1).name('fuel per hop');
  hop.add(TUNING.hop, 'refillRate', 0, 100, 1).name('refill / s');

  const stick = gui.addFolder('Stick (C3)');
  stick.add(TUNING.stick, 'driveSpeed', 5, 40, 0.5).name('stick speed (m/s)');
  stick.add(TUNING.stick, 'gravity', 10, 120, 1).name('stick pull (m/s²)');
  stick.add(TUNING.stick, 'alignRate', 2, 25, 0.5).name('turn rate (rad/s)');
  stick.add(TUNING.stick, 'reach', 0, 4, 0.1).name('reach (m)');

  const course = gui.addFolder('Course (C4)').close();
  course.add(TUNING.course, 'rampDistance', 300, 8000, 100).name('difficulty ramp (m)');
  course.add(TUNING.course, 'reachSafety', 0.4, 1, 0.01).name('jump reach used');
  course.add(TUNING.course, 'spareHop', 0, 1, 0.05).name('spare fuel (hops)');
  course.add(TUNING.course, 'reactionTime', 0.3, 2, 0.05).name('reaction time (s)');

  const rules = gui.addFolder('Rules (C5)').close();
  rules.add(TUNING.rules, 'chargeDrain', 0, 10, 0.1).name('charge drain / s');
  rules.add(TUNING.rules, 'chargeDrainPerKm', 0, 5, 0.1).name('extra drain per km');
  rules.add(TUNING.rules, 'chargePerCell', 5, 100, 1).name('charge per cell');
  rules.add(TUNING.rules, 'wallPointsPerSecond', 0, 100, 1).name('wall pts / s');
  rules.add(TUNING.rules, 'airPointsPerSecond', 0, 100, 1).name('air pts / s');
  rules.add(TUNING.rules, 'nearMissPoints', 0, 200, 5).name('near-miss pts');

  gui.add({ restart: onRestart }, 'restart').name('Restart run (R)');
  gui.add({ copy: () => navigator.clipboard?.writeText(JSON.stringify(TUNING, null, 2)) }, 'copy').name('Copy values');

  const toggle = () => (gui._hidden ? gui.show() : gui.hide());
  const button = document.createElement('button');
  button.className = 'tuning-toggle';
  button.textContent = '⚙';
  button.title = 'Tuning (T)';
  button.addEventListener('click', toggle);
  overlay.appendChild(button);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyT') toggle();
  });
}
