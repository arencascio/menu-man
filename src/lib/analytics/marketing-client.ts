import { createMarketingAnalytics } from "./marketing";
import { captureMarketingEvent, initializePostHog, isMarketingCaptureAllowed } from "./posthog";
import type { MarketingEvent } from "./types";

// Campaign codes only: no stored identity, form data, URL or referrer.
const storage = {
  getItem: (key: string) => window.sessionStorage.getItem(key),
  setItem: (key: string, value: string) => window.sessionStorage.setItem(key, value),
  removeItem: (key: string) => window.sessionStorage.removeItem(key),
};
const analytics = createMarketingAnalytics(captureMarketingEvent, isMarketingCaptureAllowed, storage);

// Hydration and navigation do not wait for the network. Retain source context
// until eligibility resolves; the underlying helper still deduplicates visits.
export const marketingAnalytics = {
  visit(path: string, search = "") {
    void initializePostHog().then(() => analytics.visit(path, search));
  },
};

export function trackMarketing(event: MarketingEvent) {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  void initializePostHog().then(() => analytics.track(event, pathname, search));
}
