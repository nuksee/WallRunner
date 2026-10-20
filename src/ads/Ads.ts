/**
 * C8 Ads (P2): the one interface a web game portal's ad SDK will sit behind.
 * Stubbed in v1: no live ads. Portal SDKs (Poki, CrazyGames, GameDistribution)
 * all offer these two calls, so an adapter per portal implements this.
 */

export type AdPlacement = 'between-runs';

export interface Ads {
  /** Midgame interstitial. Resolves when the ad is closed or skipped; the game is paused meanwhile. */
  interstitial(placement: AdPlacement): Promise<void>;
  /**
   * Rewarded ad. Resolves true only if the player watched it to the end.
   * No v1 placement uses it: a reward that changes a run (a revive, extra
   * charge) needs its own leaderboard rule first.
   */
  rewarded(placement: AdPlacement): Promise<boolean>;
}

/**
 * v1 stub. Shows nothing and resolves at once, unless the page URL has
 * `?ads=debug`, which shows a placeholder card so the slots can be seen.
 */
export class StubAds implements Ads {
  private readonly debug = new URLSearchParams(location.search).get('ads') === 'debug';

  constructor(private readonly overlay: HTMLElement) {}

  interstitial(placement: AdPlacement): Promise<void> {
    return this.debug ? this.placeholder(`Interstitial ad (${placement})`).then(() => undefined) : Promise.resolve();
  }

  rewarded(placement: AdPlacement): Promise<boolean> {
    return this.debug ? this.placeholder(`Rewarded ad (${placement})`) : Promise.resolve(false);
  }

  private placeholder(label: string): Promise<boolean> {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'ad-placeholder';
      el.innerHTML = `<div><b>AD SLOT</b><span>${label}</span><small>Stub: no live ads in v1</small></div>`;
      this.overlay.appendChild(el);
      setTimeout(() => {
        el.remove();
        resolve(true);
      }, 1500);
    });
  }
}
