import type { AnalyticsEvent, AnalyticsProvider } from "./types";
import { isPostHogConfigured, posthogProvider } from "./posthog";

const analyticsProvider: AnalyticsProvider = {
  track(event) {
    if (!isPostHogConfigured()) return;
    try { posthogProvider.track(event); }
    catch { /* Analytics must not block restaurant behavior. */ }
  },
};

export function getAnalyticsProvider(): AnalyticsProvider {
  return analyticsProvider;
}

export function trackEvent(event: AnalyticsEvent) {
  getAnalyticsProvider().track(event);
}
