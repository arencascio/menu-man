import posthog from "posthog-js";
import type { AnalyticsCartItem, AnalyticsEvent, AnalyticsProvider } from "./types";
import { marketingEnvironment, sanitizeMarketingCapture } from "./marketing";
import { restaurantEventContext, sanitizeRestaurantCapture } from "./restaurant";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

export function isPostHogConfigured() {
  return Boolean(posthogKey && posthogHost);
}

export function initializePostHog() {
  if (!posthogKey || !posthogHost || posthog.__loaded) return;

  try {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      defaults: "2026-05-30",
      advanced_disable_flags: true,
      autocapture: false,
      capture_dead_clicks: false,
      capture_exceptions: false,
      capture_heatmaps: false,
      capture_pageleave: false,
      capture_pageview: false,
      capture_performance: false,
      disable_external_dependency_loading: true,
      disable_session_recording: true,
      disableDeviceModel: true,
      person_profiles: "never",
      persistence: "memory",
      rageclick: false,
      save_campaign_params: false,
      save_referrer: false,
      before_send: (event) => event ? sanitizeRestaurantCapture(sanitizeMarketingCapture(event)) : null,
    });
  } catch {
    // Analytics must never prevent the restaurant experience from loading.
  }
}

export function isMarketingCaptureAllowed() {
  return posthog.__loaded && !posthog.has_opted_out_capturing();
}

export function captureMarketingEvent(name: string, properties: Record<string, unknown>) {
  if (!isMarketingCaptureAllowed()) return;
  posthog.capture(name, { ...properties, environment: marketingEnvironment(process.env.NEXT_PUBLIC_VERCEL_ENV) });
}

function getPostHogItem(item: AnalyticsCartItem) {
  return {
    item_id: item.itemId,
    item_name: item.itemName,
    price_cents: item.priceCents,
    quantity: item.quantity,
  };
}

function getPostHogProperties(event: AnalyticsEvent): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    analytics_scope: "restaurant",
    environment: marketingEnvironment(process.env.NEXT_PUBLIC_VERCEL_ENV),
    restaurant_id: event.restaurantId,
    ...restaurantEventContext(event, typeof window === "undefined" ? "" : window.location.pathname),
  };

  if (event.name === "category_selected") {
    if (!["featured", "popular", "favorites"].includes(event.sectionId)) properties.section_id = event.sectionId;
    properties.section_name = event.sectionName;
  } else if (event.name === "menu_search") {
    properties.query_length = event.queryLength;
    properties.result_count = event.resultCount;
    properties.zero_results = event.resultCount === 0;
  } else if (event.name === "menu_item_expanded" || event.name === "menu_item_collapsed") {
    properties.item_id = event.itemId;
    properties.item_name = event.itemName;
    properties.price_cents = event.priceCents;
    if (!["featured", "popular", "favorites"].includes(event.sectionId)) properties.section_id = event.sectionId;
    properties.section_name = event.sectionName;
  } else if (event.name === "add_to_cart" || event.name === "remove_from_cart") {
    properties.item_id = event.itemId;
    properties.item_name = event.itemName;
    properties.price_cents = event.priceCents;
    properties.quantity = event.quantity;
    properties.value_cents = event.priceCents * event.quantity;
    properties.currency = event.currency;
  } else if (event.name === "cart_viewed" || event.name === "checkout_started") {
    properties.currency = event.currency;
    properties.value_cents = event.valueCents;
    properties.item_count = event.items.length;
    properties.total_quantity = event.items.reduce((total, item) => total + item.quantity, 0);
    properties.item_ids = event.items.map((item) => item.itemId);
    properties.item_names = event.items.map((item) => item.itemName);
    properties.items = event.items.map(getPostHogItem);
  } else if (event.name === "order_created") {
    properties.order_id = event.orderId;
    properties.order_number = event.orderNumber;
    properties.currency = event.currency;
    properties.value_cents = event.valueCents;
    properties.tax_cents = event.taxCents;
    properties.tip_cents = event.tipCents;
    properties.pickup_mode = event.pickupMode;
    properties.idempotency_replay = event.replayed;
    properties.item_count = event.items.length;
    properties.total_quantity = event.items.reduce((total, item) => total + item.quantity, 0);
    properties.item_ids = event.items.map((item) => item.itemId);
    properties.item_names = event.items.map((item) => item.itemName);
    properties.items = event.items.map(getPostHogItem);
  }

  return properties;
}

export const posthogProvider: AnalyticsProvider = {
  track(event) {
    if (!posthog.__loaded) return;

    try {
      posthog.capture(event.name, getPostHogProperties(event));
    } catch {
      // A provider failure must not block UI behavior or other providers.
    }
  },
};
