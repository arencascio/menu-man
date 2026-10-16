import { createMarketingAnalytics } from "./marketing";
import { captureMarketingEvent, isMarketingCaptureAllowed } from "./posthog";
import type { MarketingEvent } from "./types";

// Campaign codes only: no stored identity, form data, URL or referrer.
const storage = {
  getItem: (key: string) => window.sessionStorage.getItem(key),
  setItem: (key: string, value: string) => window.sessionStorage.setItem(key, value),
  removeItem: (key: string) => window.sessionStorage.removeItem(key),
};
export const marketingAnalytics = createMarketingAnalytics(captureMarketingEvent, isMarketingCaptureAllowed, storage);

export function trackMarketing(event: MarketingEvent) {
  if (typeof window === "undefined") return;
  marketingAnalytics.track(event, window.location.pathname, window.location.search);
}
