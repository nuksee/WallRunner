/** Milestone 1 HUD: fuel meter (C2), stick light (C3), bare distance counter, hints, run-over banner. */
export class Hud {
  private readonly fuelFill: HTMLElement;
  private readonly fuelTicks: HTMLElement;
  private readonly stickLight: HTMLElement;
  private readonly distance: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly banner: HTMLElement;
  private hintText = '';
  private tickCost = -1;

  constructor(overlay: HTMLElement) {
    overlay.insertAdjacentHTML(
      'beforeend',
      `<div class="hud-fuel"><span>FUEL</span><div class="fuel-bar"><div class="fuel-fill"></div><div class="fuel-ticks"></div></div><div class="stick-light" title="Stuck"></div></div>
       <div class="hud-distance">0 m</div>
       <div class="hud-hint"></div>
       <div class="hud-banner hidden"></div>`,
    );
    const q = (sel: string) => overlay.querySelector(sel) as HTMLElement;
    this.fuelFill = q('.fuel-fill');
    this.fuelTicks = q('.fuel-ticks');
    this.stickLight = q('.stick-light');
    this.distance = q('.hud-distance');
    this.hint = q('.hud-hint');
    this.banner = q('.hud-banner');
  }

  update(fuel: number, capacity: number, hopCost: number, stuck: boolean, metres: number): void {
    this.fuelFill.style.width = `${(100 * fuel) / capacity}%`;
    this.fuelFill.classList.toggle('low', fuel < hopCost);
    if (hopCost !== this.tickCost) {
      // Tick marks show how many hops the tank holds.
      this.tickCost = hopCost;
      this.fuelTicks.innerHTML = '';
      for (let f = hopCost; f < capacity; f += hopCost) {
        const tick = document.createElement('i');
        tick.style.left = `${(100 * f) / capacity}%`;
        this.fuelTicks.appendChild(tick);
      }
    }
    this.stickLight.classList.toggle('on', stuck);
    this.distance.textContent = `${Math.floor(metres)} m`;
  }

  showHint(text: string): void {
    if (text === this.hintText) return;
    this.hintText = text;
    this.hint.classList.remove('show');
    void this.hint.offsetWidth; // restart the fade-in
    this.hint.textContent = text;
    if (text) this.hint.classList.add('show');
  }

  showRunOver(title: string, metres: number, restartLabel: string): void {
    this.banner.innerHTML = `<strong>${title}</strong><span>${Math.floor(metres)} m</span><em>${restartLabel}</em>`;
    this.banner.classList.remove('hidden');
  }

  hideRunOver(): void {
    this.banner.classList.add('hidden');
  }
}
