import type { AnalyticsCartItem, AnalyticsEvent, AnalyticsProvider } from "./types";
import { isPostHogConfigured, posthogProvider } from "./posthog";

interface GtagWindow extends Window {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

const providerName = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER;
const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

function getGa4Item(item: AnalyticsCartItem) {
  return {
    item_id: item.itemId,
    item_name: item.itemName,
    price: item.priceCents / 100,
    quantity: item.quantity,
  };
}

const ga4Provider: AnalyticsProvider = {
  track(event) {
    const win = window as GtagWindow;
    if (!win.gtag || !measurementId) return;
    const parameters: Record<string, unknown> = { restaurant_id: event.restaurantId };
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
    } else if (event.name === "add_to_cart" || event.name === "remove_from_cart") {
      parameters.currency = event.currency;
      parameters.value = (event.priceCents * event.quantity) / 100;
      parameters.items = [
        getGa4Item({
          itemId: event.itemId,
          itemName: event.itemName,
          priceCents: event.priceCents,
          quantity: event.quantity,
        }),
      ];
    } else if (event.name === "cart_viewed" || event.name === "checkout_started") {
      eventName = event.name === "cart_viewed" ? "view_cart" : "begin_checkout";
      parameters.currency = event.currency;
      parameters.value = event.valueCents / 100;
      parameters.items = event.items.map(getGa4Item);
    } else if (event.name === "purchase") {
      parameters.transaction_id = event.transactionId;
      parameters.currency = event.currency;
      parameters.value = event.revenueCents / 100;
      parameters.items = event.items.map(getGa4Item);
    } else if (event.name === "order_created") {
      parameters.order_id = event.orderId;
      parameters.order_number = event.orderNumber;
      parameters.currency = event.currency;
      parameters.value = event.valueCents / 100;
      parameters.tax = event.taxCents / 100;
      parameters.tip = event.tipCents / 100;
      parameters.pickup_mode = event.pickupMode;
      parameters.idempotency_replay = event.replayed;
      parameters.items = event.items.map(getGa4Item);
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
