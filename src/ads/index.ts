import { type Ads, StubAds } from './Ads';

export type { AdPlacement, Ads } from './Ads';

/** The ad service for this build. Only the stub exists until a portal is chosen. */
export const createAds = (overlay: HTMLElement): Ads => new StubAds(overlay);
