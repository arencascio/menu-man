import posthog from "posthog-js";
import type { AnalyticsCartItem, AnalyticsEvent, AnalyticsProvider } from "./types";
import { marketingEnvironment, sanitizeMarketingCapture } from "./marketing";
import { restaurantEventContext, sanitizeRestaurantCapture } from "./restaurant";
import { analyticsEligibility, type VisitorArea } from "./eligibility";
import { restaurantIdentity, type RestaurantIdentity } from "./restaurant-identity";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

export function isPostHogConfigured() {
  return Boolean(posthogKey && posthogHost);
}

let initialization: Promise<void> | undefined;
let activeRestaurantCapture: { name: string; restaurantId: string; environment: string; identity: RestaurantIdentity } | null = null;

function sanitizeOutbound<T extends { event: string; properties: Record<string, unknown> }>(event: T): T | null {
  if (!analyticsEligibility.isAllowed()) return null;
  if (event.properties.analytics_scope === "marketing") return sanitizeMarketingCapture(event);
  if (event.properties.analytics_scope !== "restaurant") return null;
  const safe = sanitizeRestaurantCapture(event);
  if (!safe) return null;
  const active = activeRestaurantCapture;
  if (!active || safe.event !== active.name || safe.properties.restaurant_id !== active.restaurantId
    || safe.properties.environment !== active.environment) return null;
  return { ...safe, properties: { ...safe.properties,
    distinct_id: active.identity.distinctId, $device_id: active.identity.distinctId,
    $session_id: active.identity.visitId, identity_version: 1, identity_mode: active.identity.mode,
  } };
}

export function initializePostHog(): Promise<void> {
  if (typeof window !== "undefined" && /^\/ops(?:\/|$)/.test(window.location.pathname)) return Promise.resolve();
  if (!posthogKey || !posthogHost) return Promise.resolve();
  return initialization ??= (async () => {
    if (!await analyticsEligibility.check() || posthog.__loaded) return;

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
        before_send: (event) => event ? sanitizeOutbound(event) : null,
      });
    } catch {
      // Analytics must never prevent the restaurant experience from loading.
    }
  })().catch(() => { /* Eligibility and SDK failures never block the site. */ });
}

function isPostHogCaptureAllowed() {
  return analyticsEligibility.isAllowed() && posthog.__loaded && !posthog.has_opted_out_capturing();
}

export function isMarketingCaptureAllowed() {
  return isPostHogCaptureAllowed();
}

export function captureMarketingEvent(name: string, properties: Record<string, unknown>) {
  if (!isMarketingCaptureAllowed()) return;
  posthog.capture(name, { ...properties, analytics_scope: "marketing",
    environment: marketingEnvironment(process.env.NEXT_PUBLIC_VERCEL_ENV) });
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

  if (event.name === "delivery_clicked") {
    if (event.providerId !== undefined) properties.provider_id = event.providerId;
    if (event.placement !== undefined) properties.placement = event.placement;
  } else if (event.name === "pickup_clicked") {
    if (event.pickupAction !== undefined) properties.pickup_action = event.pickupAction;
  } else if (event.name === "category_selected") {
    if (!["featured", "popular", "favorites"].includes(event.sectionId)) properties.section_id = event.sectionId;
    properties.section_name = event.sectionName;
  } else if (event.name === "menu_search") {
    properties.query_length = event.queryLength;
    properties.result_count = event.resultCount;
    properties.zero_results = event.resultCount === 0;
  } else if (event.name === "menu_favorite_changed") {
    properties.item_id = event.itemId;
    properties.liked = event.liked;
  } else if (event.name === "menu_item_expanded" || event.name === "menu_item_collapsed") {
    if (event.detailMode) properties.detail_mode = event.detailMode;
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
    try {
      const properties = getPostHogProperties(event);
      const send = () => {
        try {
          if (!isPostHogCaptureAllowed()) return;
          const environment = properties.environment as string;
          const capture = (visitorArea?: VisitorArea) => {
            if (!isPostHogCaptureAllowed()) return;
            const eventProperties = event.name === "page_view"
              ? { ...properties, visitor_area: visitorArea ?? "unknown" }
              : properties;
            void restaurantIdentity.withIdentity(environment, event.restaurantId, isPostHogCaptureAllowed, (identity) => {
              if (!isPostHogCaptureAllowed()) return;
              activeRestaurantCapture = { name: event.name, restaurantId: event.restaurantId, environment, identity };
              try {
                // Avoid retaining this tenant's event in the shared SDK batch after withdrawal.
                posthog.capture(event.name, eventProperties, { send_instantly: true });
              } catch { /* Analytics must not interrupt restaurant interactions. */ }
              finally { activeRestaurantCapture = null; }
            }).catch(() => { /* Storage and browser-lock failures never block interactions. */ });
          };
          if (event.name === "page_view") {
            void analyticsEligibility.restaurantArea(event.restaurantId).then(capture).catch(() => capture("unknown"));
          } else capture();
        }
        catch { /* Analytics must not interrupt restaurant interactions. */ }
      };
      if (analyticsEligibility.isAllowed() && posthog.__loaded) send();
      else void initializePostHog().then(send);
    } catch {
      // A provider failure must not block UI behavior or other providers.
    }
  },
};
