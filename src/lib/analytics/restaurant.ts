import { z } from "zod";
import { sanitizeCampaign } from "./marketing";
import type { AnalyticsEvent, RestaurantPageType } from "./types";

const syntheticSections = ["featured", "popular", "favorites"] as const;
const pageTypes = ["home", "menu", "location", "checkout", "payment", "confirmation"] as const;

// Paths are used locally for matching only. Neither paths nor dynamic segments are sent.
export function restaurantPageType(pathname: string): RestaurantPageType | undefined {
  const path = pathname.split(/[?#]/, 1)[0];
  if (/^\/r\/[^/]+$/.test(path)) return "home";
  const standard = path.match(/^\/r\/[^/]+\/(menu|location|checkout)$/);
  if (standard) return standard[1] as RestaurantPageType;
  const order = path.match(/^\/r\/[^/]+\/order\/[^/]+\/(payment|confirmation)$/);
  return order?.[1] as RestaurantPageType | undefined;
}

export function restaurantEventContext(event: AnalyticsEvent, pathname = "") {
  const page_type = event.pageType ?? restaurantPageType(pathname);
  let surface: string | undefined = page_type;
  if (event.name === "menu_search") surface = "menu_search";
  else if (event.name === "delivery_clicked" || event.name === "pickup_clicked") surface = "ordering_actions";
  else if (event.name === "cart_viewed" || event.name === "checkout_started") surface = "cart";
  else if (event.name === "order_created") surface = "checkout";
  else if ("sectionId" in event) surface = syntheticSections.includes(event.sectionId as typeof syntheticSections[number])
    ? event.sectionId : page_type === "home" ? "home" : "menu";
  if ("surface" in event && event.surface) surface = event.surface;
  return { ...(page_type ? { page_type } : {}), ...(surface ? { surface } : {}) };
}

export function createRestaurantPageVisits(send: (event: AnalyticsEvent) => void) {
  let currentPath: string | null = null;
  let lastRestaurant: string | null = null;
  let lastPage: { restaurantId: string; pageType: RestaurantPageType; expectedPath: string } | null = null;
  function observe(pathname: string) {
    const path = pathname.split(/[?#]/, 1)[0];
    if (path !== currentPath) { currentPath = path; lastRestaurant = null; }
  }
  function visit(restaurantId: string, pageType: RestaurantPageType, expectedPath: string, pathname: string) {
    observe(pathname);
    if (currentPath !== expectedPath || restaurantPageType(currentPath) !== pageType || lastRestaurant === restaurantId) return;
    lastRestaurant = restaurantId;
    lastPage = { restaurantId, pageType, expectedPath };
    try { send({ name: "page_view", restaurantId, pageType }); } catch { /* Never block navigation. */ }
  }
  return {
    observe, visit,
    restore(pathname: string) {
      lastRestaurant = null;
      if (lastPage) visit(lastPage.restaurantId, lastPage.pageType, lastPage.expectedPath, pathname);
    },
  };
}

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const item = z.object({ item_id: id, price_cents: count, quantity: count });
const totals = {
  currency: z.string().regex(/^[A-Z]{3}$/), value_cents: count,
  item_count: count, total_quantity: count, item_ids: z.array(id).max(1000), items: z.array(item).max(1000),
};
const base = z.object({
  analytics_scope: z.literal("restaurant"), restaurant_id: id,
  environment: z.enum(["production", "staging", "development", "unknown"]),
  page_type: z.enum(pageTypes).optional(),
  surface: z.enum(["home", "menu", "location", "featured", "popular", "favorites", "menu_search", "direct_link", "history", "ordering_actions", "cart", "checkout", "payment", "confirmation", "navigation", "footer", "hero", "header", "restaurant_information", "featured_gallery", "delivery_chooser", "pickup_chooser"]).optional(),
});
const section = base.extend({ section_id: id.refine((value) => !syntheticSections.includes(value as typeof syntheticSections[number])).optional() });
const hasSection = (value: { section_id?: string; surface?: string }) => Boolean(value.section_id)
  || syntheticSections.includes(value.surface as typeof syntheticSections[number]);
const schemas: Record<string, z.ZodType> = {
  page_view: base,
  category_selected: section.refine(hasSection),
  menu_search: base.extend({ query_length: count, result_count: count, zero_results: z.boolean() }),
  menu_favorite_changed: base.extend({ item_id: z.uuid(), liked: z.boolean() }),
  menu_item_expanded: section.extend({ item_id: id, price_cents: count, detail_mode: z.enum(["full", "quick"]).optional() }).refine(hasSection),
  menu_item_collapsed: section.extend({ item_id: id, price_cents: count, detail_mode: z.enum(["full", "quick"]).optional() }).refine(hasSection),
  phone_clicked: base, directions_clicked: base,
  delivery_clicked: base.extend({ provider_id: z.uuid().optional(), placement: z.enum(["hero", "header", "footer", "restaurant_information", "ordering_actions", "featured_gallery", "delivery_chooser", "pickup_chooser"]).optional() }),
  pickup_clicked: base.extend({ pickup_action: z.enum(["internal_selection", "external_departure"]).optional() }),
  add_to_cart: base.extend({ item_id: id, price_cents: count, quantity: count, value_cents: count, currency: totals.currency }),
  remove_from_cart: base.extend({ item_id: id, price_cents: count, quantity: count, value_cents: count, currency: totals.currency }),
  cart_viewed: base.extend(totals), checkout_started: base.extend(totals),
  order_created: base.extend({ ...totals, order_id: id, order_number: z.string().regex(/^\d{1,20}$/),
    tax_cents: count, tip_cents: count, pickup_mode: z.enum(["asap", "scheduled"]), idempotency_replay: z.boolean() }),
};
const sdk = z.object({
  token: z.string().max(200).optional(), distinct_id: id.optional(),
  $device_id: id.optional(), $session_id: id.optional(), $window_id: id.optional(),
  $lib: z.literal("web").optional(), $lib_version: z.string().regex(/^[\d.a-zA-Z_-]{1,40}$/).optional(),
  $insert_id: id.optional(),
});

// Final boundary, after SDK enrichment. No catalog display text, raw input, URLs,
// referrers, nested person properties, IP, or client-supplied extra keys survive.
export function sanitizeRestaurantCapture<T extends { event: string; properties: Record<string, unknown> }>(event: T): T | null {
  if (event.properties.analytics_scope !== "restaurant") return event;
  try {
    const schema = Object.hasOwn(schemas, event.event) ? schemas[event.event] : undefined;
    const parsed = schema?.safeParse(event.properties);
    const sdkProperties = sdk.safeParse(event.properties);
    if (!parsed?.success || !sdkProperties.success) return null;
    return { ...event, properties: { ...sdkProperties.data, ...parsed.data as Record<string, unknown>,
      ...sanitizeCampaign(event.properties), $process_person_profile: false, $geoip_disable: true } };
  } catch { return null; } // Invalid analytics must not interrupt restaurant behavior.
}

type SearchSection = { id: string; items: readonly { id: string; name: string; description: string | null }[] };

// Analytics counts canonical items, while the UI continues displaying all placements.
export function menuSearchMetrics(sections: readonly SearchSection[], normalizedQuery: string) {
  const matches = new Set<string>();
  for (const section of sections) {
    if (["featured", "popular", "favorites"].includes(section.id)) continue;
    for (const item of section.items) {
      if ([item.name, item.description || ""].join(" ").toLowerCase().includes(normalizedQuery)) matches.add(item.id);
    }
  }
  return { queryLength: normalizedQuery.length, resultCount: matches.size };
}
