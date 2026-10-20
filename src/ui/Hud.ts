import type { RunResult } from '../rules/Rules';

export interface HudState {
  fuel: number;
  capacity: number;
  hopCost: number;
  stuck: boolean;
  /** Battery level, 0 to 1. */
  charge: number;
  score: number;
  metres: number;
}

/** HUD: fuel meter (C2), stick light (C3), charge, score and distance (C5), hints, style pop-ups, results. */
export class Hud {
  private readonly fuelFill: HTMLElement;
  private readonly fuelTicks: HTMLElement;
  private readonly stickLight: HTMLElement;
  private readonly chargeFill: HTMLElement;
  private readonly score: HTMLElement;
  private readonly distance: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly popups: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly summary: HTMLElement;
  /** Where the results screen shows the leaderboard (C7 fills it). */
  readonly boardSlot: HTMLElement;
  private hintText = '';
  private tickCost = -1;

  constructor(overlay: HTMLElement) {
    overlay.insertAdjacentHTML(
      'beforeend',
      `<div class="hud-meters">
         <div class="hud-row"><span>FUEL</span><div class="bar"><div class="fill fuel-fill"></div><div class="fuel-ticks"></div></div><div class="stick-light" title="Stuck"></div></div>
         <div class="hud-row"><span>CHARGE</span><div class="bar"><div class="fill charge-fill"></div></div></div>
       </div>
       <div class="hud-score"><b>0</b><span>0 m</span></div>
       <div class="hud-hint"></div>
       <div class="hud-popups"></div>
       <div class="hud-banner hidden"><div class="run-summary"></div><div class="run-board"></div></div>`,
    );
    const q = (sel: string) => overlay.querySelector(sel) as HTMLElement;
    this.fuelFill = q('.fuel-fill');
    this.fuelTicks = q('.fuel-ticks');
    this.stickLight = q('.stick-light');
    this.chargeFill = q('.charge-fill');
    this.score = q('.hud-score b');
    this.distance = q('.hud-score span');
    this.hint = q('.hud-hint');
    this.popups = q('.hud-popups');
    this.banner = q('.hud-banner');
    this.summary = q('.run-summary');
    this.boardSlot = q('.run-board');
  }

  update(s: HudState): void {
    this.fuelFill.style.width = `${(100 * s.fuel) / s.capacity}%`;
    this.fuelFill.classList.toggle('low', s.fuel < s.hopCost);
    if (s.hopCost !== this.tickCost) {
      // Tick marks show how many hops the tank holds.
      this.tickCost = s.hopCost;
      this.fuelTicks.innerHTML = '';
      for (let f = s.hopCost; f < s.capacity; f += s.hopCost) {
        const tick = document.createElement('i');
        tick.style.left = `${(100 * f) / s.capacity}%`;
        this.fuelTicks.appendChild(tick);
      }
    }
    this.stickLight.classList.toggle('on', s.stuck);
    this.chargeFill.style.width = `${100 * s.charge}%`;
    this.chargeFill.classList.toggle('low', s.charge < 0.25);
    this.score.textContent = String(s.score);
    this.distance.textContent = `${Math.floor(s.metres)} m`;
  }

  showHint(text: string): void {
    if (text === this.hintText) return;
    this.hintText = text;
    this.hint.classList.remove('show');
    void this.hint.offsetWidth; // restart the fade-in
    this.hint.textContent = text;
    if (text) this.hint.classList.add('show');
  }

  /** Floating "+points" label for a style bonus. */
  popup(label: string, points: number): void {
    const el = document.createElement('div');
    el.className = 'popup';
    el.innerHTML = `${label} <b>+${points}</b>`;
    this.popups.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  showRunOver(title: string, r: RunResult, best: number, isBest: boolean, restartLabel: string): void {
    const row = (label: string, value: string) => `<tr><td>${label}</td><td>${value}</td></tr>`;
    this.summary.innerHTML = `
      <strong>${title}</strong>
      <span class="final">${r.score}</span>
      <small>${isBest ? 'New best!' : `Best ${best}`}</small>
      <table>
        ${row('Distance', `${r.distance} m`)}
        ${row('Wall runs', `+${r.style.wall}`)}
        ${row('Airtime', `+${r.style.air}`)}
        ${row('Near misses', `+${r.style.nearMiss}`)}
        ${row('Time', `${r.duration.toFixed(1)} s`)}
      </table>
      <em>${restartLabel}</em>`;
    this.banner.classList.toggle('best', isBest);
    this.banner.classList.remove('hidden');
    this.popups.innerHTML = '';
  }

  hideRunOver(): void {
    this.banner.classList.add('hidden');
  }
}
