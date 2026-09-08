import type { AnalyticsEvent, AnalyticsProvider } from "./types";
import { isPostHogConfigured, posthogProvider } from "./posthog";

interface GtagWindow extends Window {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

const providerName = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER;
const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const ga4Provider: AnalyticsProvider = {
  track(event) {
    const win = window as GtagWindow;
    if (!win.gtag || !measurementId) return;
    const parameters: Record<string, string | number> = { restaurant_id: event.restaurantId };
    let eventName: string = event.name;

    if (event.name === "page_view") {
      eventName = "page_view";
    } else if (event.name === "category_selected") {
      eventName = "select_content";
      parameters.content_type = "menu_category";
      parameters.item_id = event.sectionId || "all";
    } else if (event.name === "menu_search") {
      eventName = "menu_search";
      parameters.query_length = event.queryLength;
      parameters.result_count = event.resultCount;
    } else if (event.name === "menu_item_expanded") {
      eventName = "view_item";
      parameters.item_id = event.itemId;
      parameters.section_id = event.sectionId;
    } else if (event.name === "menu_item_collapsed") {
      parameters.item_id = event.itemId;
      parameters.section_id = event.sectionId;
    }

    win.gtag("event", eventName, parameters);
  },
};

const configuredProviders: AnalyticsProvider[] = [];

if (providerName === "ga4" && measurementId) {
  configuredProviders.push(ga4Provider);
}

if (isPostHogConfigured()) {
  configuredProviders.push(posthogProvider);
}

const analyticsProvider: AnalyticsProvider = {
  track(event) {
    for (const provider of configuredProviders) {
      try {
        provider.track(event);
      } catch {
        // One provider must not block restaurant behavior or another provider.
      }
    }
  },
};

export function getAnalyticsProvider(): AnalyticsProvider {
  return analyticsProvider;
}

export function trackEvent(event: AnalyticsEvent) {
  getAnalyticsProvider().track(event);
}
