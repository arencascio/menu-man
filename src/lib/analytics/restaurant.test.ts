import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { createRestaurantPageVisits, menuSearchMetrics, restaurantEventContext, restaurantPageType, sanitizeRestaurantCapture } from "./restaurant";
import type { AnalyticsEvent } from "./types";
import { marketingEnvironment, sanitizeMarketingCapture } from "./marketing";

const context = { analytics_scope: "restaurant", environment: "staging", restaurant_id: "tenant-a" };
const unsafe = { query: "private@example.com", customer_name: "PRIVATE_NAME", phone: "+15550000000", address: "PRIVATE_ADDRESS",
  order_notes: "PRIVATE_NOTES", payment_token: "PRIVATE_PAYMENT", item_name: "PRIVATE_TEXT", section_name: "PRIVATE_TEXT",
  $current_url: "https://site/menu?email=private@example.com#private", $referrer: "https://referrer/private?name=PRIVATE_NAME",
  $set: { email: "private@example.com" }, $initial_person_info: { name: "PRIVATE_NAME" }, $ip: "192.0.2.1",
  $geoip_city_name: "PRIVATE_CITY", unknown: { customer: "PRIVATE_NAME" } };

test("restaurant final boundary strips raw input, URL/referrer and person metadata while preserving scoped identifiers and GeoIP control", () => {
  const result = sanitizeRestaurantCapture({ event: "menu_search", properties: { ...unsafe, ...context,
    query_length: 19, result_count: 0, zero_results: true, token: "mock", distinct_id: "anonymous",
    $process_person_profile: true, $geoip_disable: false, page_type: "menu", surface: "favorites",
    utm_source: "business_card", utm_campaign: "private@example.com", utm_medium: "https://private.example/" } });
  assert.deepEqual(result?.properties, { ...context, token: "mock", query_length: 19,
    result_count: 0, zero_results: true, page_type: "menu", surface: "favorites", utm_source: "business_card",
    $process_person_profile: false, $geoip_disable: true });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|private@|https:|192\.0\.2/);
});

test("restaurant nested cart/order payloads retain only identifiers, bounded numeric totals and currency", () => {
  const result = sanitizeRestaurantCapture({ event: "order_created", properties: { ...context, ...unsafe,
    order_id: "order-a", order_number: "1001", currency: "USD", value_cents: 1200, tax_cents: 100, tip_cents: 0,
    pickup_mode: "asap", idempotency_replay: false, item_count: 1, total_quantity: 1, item_ids: ["item-a"],
    item_names: ["PRIVATE_NAME"], items: [{ ...unsafe, item_id: "item-a", price_cents: 1100, quantity: 1 }] } });
  assert.equal(result?.properties.order_id, "order-a");
  assert.deepEqual(result?.properties.items, [{ item_id: "item-a", price_cents: 1100, quantity: 1 }]);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|private@|https:|item_name/);
});

test("invalid restaurant names, metadata values and malformed payloads fail closed without touching marketing events", () => {
  for (const event of ["unknown", "constructor", "toString"]) {
    assert.equal(sanitizeRestaurantCapture({ event, properties: context }), null);
  }
  for (const bad of [{ restaurant_id: "private@example.com" }, { environment: "https://private.example/" },
    { page_type: "/menu?email=private@example.com" }, { surface: "PRIVATE NOTES" }]) {
    assert.equal(sanitizeRestaurantCapture({ event: "page_view", properties: { ...context, ...bad } }), null);
  }
  assert.equal(sanitizeRestaurantCapture({ event: "menu_favorite_changed", properties: { ...context,
    item_id: "20000000-0000-4000-8000-000000000201", liked: "true" } }), null);
  assert.equal(sanitizeRestaurantCapture({ event: "menu_item_expanded", properties: { ...context,
    section_id: "section-a", item_id: "item-a", price_cents: 350, detail_mode: "private notes" } }), null);
  const marketing = { event: "$pageview", properties: { analytics_scope: "marketing", page: "/", utm_source: "card" } };
  assert.equal(sanitizeRestaurantCapture(marketing), marketing);
});

test("every existing restaurant event keeps its name and meaningful identifiers under the bounded contract", () => {
  const properties = { ...context, section_id: "section-a", item_id: "20000000-0000-4000-8000-000000000201", liked: true, price_cents: 1000,
    query_length: 4, result_count: 1, zero_results: false, quantity: 1, value_cents: 1000, currency: "USD",
    item_count: 1, total_quantity: 1, item_ids: ["item-a"], items: [{ item_id: "item-a", price_cents: 1000, quantity: 1 }],
    order_id: "order-a", order_number: "1001", tax_cents: 0, tip_cents: 0, pickup_mode: "asap", idempotency_replay: false };
  for (const event of ["page_view", "category_selected", "menu_search", "menu_favorite_changed", "menu_item_expanded", "menu_item_collapsed",
    "phone_clicked", "directions_clicked", "delivery_clicked", "pickup_clicked", "add_to_cart", "remove_from_cart",
    "cart_viewed", "checkout_started", "order_created"]) {
    const result = sanitizeRestaurantCapture({ event, properties });
    assert.equal(result?.event, event);
    assert.equal(result?.properties.restaurant_id, "tenant-a");
    assert.equal(result?.properties.environment, "staging");
  }
});

test("menu search counts unique canonical matching items without mutating placements or item order", () => {
  const taco = { id: "taco", name: "Taco", description: "Grilled chicken" };
  const side = { id: "side", name: "Rice", description: null };
  const sections = [{ id: "featured", items: [taco] }, { id: "popular", items: [taco] },
    { id: "favorites", items: [taco] }, { id: "street-tacos", items: [taco, side] }, { id: "other", items: [taco] }];
  const before = structuredClone(sections);
  assert.deepEqual(menuSearchMetrics(sections, "taco"), { queryLength: 4, resultCount: 1 });
  assert.deepEqual(menuSearchMetrics(sections, "chicken"), { queryLength: 7, resultCount: 1 });
  assert.deepEqual(menuSearchMetrics(sections, "rice"), { queryLength: 4, resultCount: 1 });
  assert.deepEqual(menuSearchMetrics(sections, "nothing"), { queryLength: 7, resultCount: 0 });
  assert.deepEqual(menuSearchMetrics([{ id: "featured", items: [taco] }], "taco"), { queryLength: 4, resultCount: 0 });
  assert.deepEqual(sections, before);
});

test("menu retains normalized meaningful-state guard, 200ms debounce and presentation filtering independently of analytics", () => {
  const browser = readFileSync("src/app/r/[slug]/MenuBrowser.tsx", "utf8");
  assert.match(browser, /const nextSearch = searchInput\.trim\(\)\.toLowerCase\(\);\s*if \(nextSearch === search\) return;/);
  assert.match(browser, /if \(nextSearch\) \{\s*trackEvent\(\{ name: "menu_search", restaurantId, \.\.\.menuSearchMetrics\(menuSections, nextSearch\) \}\);\s*\}\s*\}, 200\)/);
  assert.match(browser, /const visibleSections = useMemo\(\(\) => menuSections\s*\.map\(/);
  assert.match(browser, /return \[item.name, item.description \|\| ""\][\s\S]*?\.includes\(search\)/);
});

test("real adapter wiring applies the final filter after mocked SDK enrichment, ignores extra call properties, and never throws on analytics failure", async () => {
  let beforeSend: (event: { event: string; properties: Record<string, unknown> }) => unknown;
  const captures: unknown[] = [];
  let fail = false;
  const sdk = { __loaded: false, has_opted_out_capturing: () => false,
    init(_key: string, config: Record<string, unknown>) { beforeSend = config.before_send as typeof beforeSend; this.__loaded = true; },
    capture(event: string, properties: Record<string, unknown>) {
      if (fail) throw Error("Provider unavailable");
      captures.push(beforeSend({ event, properties: { ...unsafe, ...properties } }));
    },
  };
  const source = readFileSync("src/lib/analytics/posthog.ts", "utf8");
  const exports: { initializePostHog?: () => Promise<void>; posthogProvider?: { track(event: unknown): void } } = {};
  const identity = { distinctId: "20000000-0000-4000-8000-000000000001", visitId: "20000000-0000-4000-8000-000000000002", mode: "persistent" };
  runInNewContext(transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, {
    exports, process: { env: { NEXT_PUBLIC_POSTHOG_KEY: "mock", NEXT_PUBLIC_POSTHOG_HOST: "https://mock.invalid", NEXT_PUBLIC_VERCEL_ENV: "preview" } },
    require(id: string) {
      if (id === "posthog-js") return { default: sdk };
      if (id === "./marketing") return { marketingEnvironment, sanitizeMarketingCapture };
      if (id === "./restaurant") return { restaurantEventContext, sanitizeRestaurantCapture };
      if (id === "./eligibility") return { analyticsEligibility: { check: async () => true, isAllowed: () => true } };
      if (id === "./restaurant-identity") return { restaurantIdentity: { withIdentity: async (_env: string, _id: string, _allowed: () => boolean, deliver: (identity: unknown) => void) => deliver(identity) } };
      throw Error(id);
    },
  });
  await exports.initializePostHog!();
  exports.posthogProvider!.track({ name: "menu_search", restaurantId: "tenant-a", query: "private@example.com", queryLength: 19, resultCount: 0,
    analytics_scope: "marketing", environment: "production", customer: unsafe });
  await new Promise(setImmediate);
  assert.deepEqual(JSON.parse(JSON.stringify(captures)), [{ event: "menu_search", properties: { ...context,
    surface: "menu_search", query_length: 19, result_count: 0, zero_results: true, $process_person_profile: false, $geoip_disable: true,
    distinct_id: identity.distinctId, $device_id: identity.distinctId, $session_id: identity.visitId, identity_version: 1, identity_mode: "persistent" } }]);
  const canonicalItem = "20000000-0000-4000-8000-000000000201";
  exports.posthogProvider!.track({ name: "menu_favorite_changed", restaurantId: "tenant-a", itemId: canonicalItem, liked: true,
    visitorKey: "PRIVATE_VISITOR", email: "private@example.com" });
  await new Promise(setImmediate);
  assert.deepEqual(JSON.parse(JSON.stringify(captures[1])), { event: "menu_favorite_changed", properties: { ...context,
    item_id: canonicalItem, liked: true, $process_person_profile: false, $geoip_disable: true,
    distinct_id: identity.distinctId, $device_id: identity.distinctId, $session_id: identity.visitId, identity_version: 1, identity_mode: "persistent" } });
  exports.posthogProvider!.track({ name: "menu_item_expanded", restaurantId: "tenant-a", itemId: canonicalItem,
    itemName: "PRIVATE_TEXT", priceCents: 350, sectionId: "featured", sectionName: "PRIVATE_TEXT", surface: "featured", detailMode: "quick" });
  await new Promise(setImmediate);
  assert.deepEqual(JSON.parse(JSON.stringify(captures[2])), { event: "menu_item_expanded", properties: { ...context,
    surface: "featured", item_id: canonicalItem, price_cents: 350, detail_mode: "quick", $process_person_profile: false, $geoip_disable: true,
    distinct_id: identity.distinctId, $device_id: identity.distinctId, $session_id: identity.visitId, identity_version: 1, identity_mode: "persistent" } });
  fail = true;
  assert.doesNotThrow(() => exports.posthogProvider!.track({ name: "page_view", restaurantId: "tenant-a" }));
});

test("restaurant route classification emits only supported bounded page types, never dynamic paths or query data", () => {
  for (const [path, page] of [["/r/tenant", "home"], ["/r/tenant/menu", "menu"], ["/r/tenant/location", "location"],
    ["/r/tenant/checkout", "checkout"], ["/r/tenant/order/private-order/payment", "payment"],
    ["/r/tenant/order/private-order/confirmation", "confirmation"]]) {
    assert.equal(restaurantPageType(`${path}?email=private@example.com#PRIVATE`), page);
  }
  for (const path of ["/", "/manage/tenant", "/r/tenant/catering", "/r/tenant/menu/unknown", "https://site/r/tenant/menu"]) {
    assert.equal(restaurantPageType(path), undefined);
  }
  const result = restaurantEventContext({ name: "phone_clicked", restaurantId: "tenant-a" }, "/r/tenant/location?email=private@example.com#PRIVATE");
  assert.deepEqual(result, { page_type: "location", surface: "location" });
  assert.doesNotMatch(JSON.stringify(result), /private|PRIVATE|\/r\//);
});

test("page visits deduplicate replay/renders/fragments and retain client, Back/Forward, same-type-order and tenant revisits", () => {
  const events: AnalyticsEvent[] = [];
  const visits = createRestaurantPageVisits((event) => events.push(event));
  const home = "/r/a", menu = "/r/a/menu";
  visits.observe(home);
  visits.visit("tenant-a", "home", home, home); // initial mount
  visits.visit("tenant-a", "home", home, home); // Strict Mode replay / render
  visits.visit("tenant-a", "home", home, `${home}?private=value#fragment`);
  visits.visit("tenant-a", "home", home, menu); // previous page still mounted
  visits.visit("tenant-a", "menu", menu, menu); // child effect before root effect
  visits.observe(menu);
  visits.observe(home); // browser Back
  visits.visit("tenant-a", "home", home, home);
  visits.observe(menu); // browser Forward
  visits.visit("tenant-a", "menu", menu, menu);
  visits.observe("/services"); // leave restaurant then revisit same menu
  visits.visit("tenant-a", "menu", menu, menu);
  visits.visit("tenant-b", "menu", "/r/b/menu", "/r/b/menu");
  for (const order of ["one", "two", "one"]) {
    const path = `/r/a/order/${order}/payment`;
    visits.visit("tenant-a", "payment", path, path);
  }
  assert.deepEqual(events.map((event) => [event.restaurantId, event.pageType]), [
    ["tenant-a", "home"], ["tenant-a", "menu"], ["tenant-a", "home"], ["tenant-a", "menu"],
    ["tenant-a", "menu"], ["tenant-b", "menu"], ["tenant-a", "payment"], ["tenant-a", "payment"], ["tenant-a", "payment"],
  ]);
  assert.doesNotMatch(JSON.stringify(events), /\/r\/|private|fragment/);
  assert.doesNotThrow(() => createRestaurantPageVisits(() => { throw Error("SDK failure"); }).visit("tenant-a", "home", home, home));
});

test("browser document restoration counts a revisit once, and does not turn query changes or unrelated pages into restaurant views", () => {
  const events: AnalyticsEvent[] = [];
  const visits = createRestaurantPageVisits((event) => events.push(event));
  visits.visit("tenant-a", "menu", "/r/a/menu", "/r/a/menu");
  visits.restore("/r/a/menu"); // persisted pageshow after browser Back to this document
  visits.visit("tenant-a", "menu", "/r/a/menu", "/r/a/menu"); // subsequent effect replay
  assert.equal(events.length, 2);
  visits.observe("/services");
  visits.restore("/services");
  assert.equal(events.length, 2);
  visits.visit("tenant-a", "menu", "/r/a/menu", "/r/a/menu");
  visits.visit("tenant-a", "menu", "/r/a/menu", "/r/a/menu?item=private#favorite");
  assert.equal(events.length, 3);
});

test("synthetic menu sections are surfaces, not canonical section IDs, and invalid contexts fail closed", () => {
  for (const sectionId of ["featured", "popular", "favorites"]) {
    const event: AnalyticsEvent = { name: "menu_item_expanded", restaurantId: "tenant-a", sectionId, sectionName: "PRIVATE",
      itemId: "item-a", itemName: "PRIVATE", priceCents: 1000 };
    const attributed = restaurantEventContext(event, "/r/a/menu");
    assert.deepEqual(attributed, { page_type: "menu", surface: sectionId });
    const properties = { ...context, ...attributed, item_id: "item-a", price_cents: 1000 };
    assert.ok(sanitizeRestaurantCapture({ event: event.name, properties }));
    assert.equal(sanitizeRestaurantCapture({ event: event.name, properties: { ...properties, section_id: sectionId } }), null);
  }
  for (const invalid of [{ page_type: "private@example.com" }, { surface: "/r/a/menu?private=value" }]) {
    assert.equal(sanitizeRestaurantCapture({ event: "page_view", properties: { ...context, ...invalid } }), null);
  }
  assert.deepEqual(restaurantEventContext({ name: "menu_search", restaurantId: "tenant-a", queryLength: 4, resultCount: 1 }, "/r/a/menu"),
    { page_type: "menu", surface: "menu_search" });
  assert.deepEqual(restaurantEventContext({ name: "pickup_clicked", restaurantId: "tenant-a" }, "/r/a"),
    { page_type: "home", surface: "ordering_actions" });
});

test("all six successful route surfaces mount their own tracker and root observes departures without changing marketing tracking", () => {
  const routes = [["page.tsx", "home"], ["menu/page.tsx", "menu"], ["location/page.tsx", "location"], ["checkout/page.tsx", "checkout"],
    ["order/[orderId]/payment/page.tsx", "payment"], ["order/[orderId]/confirmation/page.tsx", "confirmation"]];
  for (const [file, type] of routes) {
    assert.match(readFileSync(`src/app/r/[slug]/${file}`, "utf8"), new RegExp(`PageViewTracker restaurantId=\\{restaurant.id\\} pageType="${type}" path=`));
  }
  const tracker = readFileSync("src/app/r/[slug]/PageViewTracker.tsx", "utf8");
  assert.match(tracker, /visits\.visit\(restaurantId, pageType, path, pathname\)/);
  assert.match(tracker, /\[restaurantId, pageType, path, pathname\]/);
  assert.doesNotMatch(tracker, /searchParams|localStorage|sessionStorage|randomUUID/);
  const root = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(root, /<RestaurantNavigationObserver \/>/);
  assert.match(root, /<MarketingAnalytics \/>/);
});

test("tracker effects replay safely and persisted pageshow is the only document-restoration trigger", () => {
  const events: AnalyticsEvent[] = [];
  const effects: Array<() => void | (() => void)> = [];
  const listeners = new Map<string, (event: { persisted: boolean }) => void>();
  let pathname = "/r/a/menu";
  const windowMock = { location: { pathname },
    addEventListener(name: string, callback: (event: { persisted: boolean }) => void) { listeners.set(name, callback); },
    removeEventListener(name: string) { listeners.delete(name); },
  };
  const exports: { default?: (props: { restaurantId: string; pageType: string; path: string }) => null; RestaurantNavigationObserver?: () => null } = {};
  const source = readFileSync("src/app/r/[slug]/PageViewTracker.tsx", "utf8");
  runInNewContext(transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, {
    exports, window: windowMock, require(id: string) {
      if (id === "react") return { useEffect: (callback: () => void) => effects.push(callback) };
      if (id === "next/navigation") return { usePathname: () => pathname };
      if (id === "@/lib/analytics/client") return { trackEvent: (event: AnalyticsEvent) => events.push(event) };
      if (id === "@/lib/analytics/restaurant") return { createRestaurantPageVisits };
      throw Error(id);
    },
  });
  exports.RestaurantNavigationObserver!();
  exports.default!({ restaurantId: "tenant-a", pageType: "menu", path: pathname });
  // Descendant effect first, followed by root effects; then Strict Mode cleanup/replay.
  const cleanups = effects.slice().reverse().map((effect) => effect());
  cleanups.forEach((cleanup) => { if (typeof cleanup === "function") cleanup(); });
  effects.forEach((effect) => effect());
  assert.equal(events.length, 1);
  listeners.get("pageshow")!({ persisted: false });
  assert.equal(events.length, 1);
  listeners.get("pageshow")!({ persisted: true });
  assert.equal(events.length, 2);
  effects.forEach((effect) => effect());
  assert.equal(events.length, 2);
  pathname = "/services";
  effects.length = 0;
  exports.RestaurantNavigationObserver!();
  effects.forEach((effect) => effect());
  pathname = "/r/a/menu";
  effects.length = 0;
  exports.default!({ restaurantId: "tenant-a", pageType: "menu", path: pathname });
  effects.forEach((effect) => effect());
  assert.equal(events.length, 3);
});
