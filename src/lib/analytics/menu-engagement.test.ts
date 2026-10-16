import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { createMenuEngagement } from "./menu-engagement";
import { restaurantEventContext, sanitizeRestaurantCapture } from "./restaurant";
import type { AnalyticsEvent } from "./types";

const itemId = "20000000-0000-4000-8000-000000000201";
const canonical = { id: "20000000-0000-4000-8000-000000000101", name: "Tacos", items: [{ id: itemId }] };
const detail = { item: { id: itemId, name: "Catalog taco", price_cents: 350 }, section: canonical, mode: "full" as const };
const browser = readFileSync("src/app/r/[slug]/MenuBrowser.tsx", "utf8").replace(/\r\n/g, "\n");
function harness() {
  const events: AnalyticsEvent[] = [];
  return { events, analytics: createMenuEngagement("tenant-a", (event) => events.push(event)) };
}

test("one opening/collapse per item lifecycle, including effect replay, promotion, history revisits and item switches", () => {
  const { analytics, events } = harness();
  analytics.sync(detail, "card", false, [canonical]);
  analytics.sync({ ...detail }, "card", false, [canonical]);
  analytics.sync(null, "card", false, [canonical]);
  analytics.sync(null, "card", false, [canonical]);
  analytics.sync(detail, "history", false, [canonical]);
  analytics.sync({ ...detail, item: { ...detail.item, id: "another-item" } }, "history", false, [canonical]);
  assert.deepEqual(events.map((event) => event.name), ["menu_item_expanded", "menu_item_collapsed", "menu_item_expanded", "menu_item_collapsed", "menu_item_expanded"]);
  const quick = harness();
  quick.analytics.sync({ ...detail, mode: "quick" }, "card", false, [canonical]);
  quick.analytics.sync(detail, "card", false, [canonical]);
  quick.analytics.sync(null, "card", false, [canonical]);
  assert.deepEqual(quick.events.map((event) => "detailMode" in event && event.detailMode), ["quick", "quick"]);
  assert.doesNotThrow(() => createMenuEngagement("tenant-a", () => { throw Error(); }).sync(detail, "card", false, [canonical]));
});

test("normal, search, Featured, Popular, Favorites, direct links, history and cart keep bounded meaningful origins", () => {
  for (const surface of ["featured", "popular", "favorites"]) {
    const { analytics, events } = harness();
    const synthetic = { ...canonical, id: surface };
    analytics.sync({ ...detail, section: synthetic }, "card", false, [synthetic, canonical]);
    const event = events[0];
    const properties = { analytics_scope: "restaurant", restaurant_id: "tenant-a", environment: "staging",
      ...restaurantEventContext(event, "/r/a/menu"), item_id: itemId, price_cents: 350, detail_mode: "full" };
    const filtered = sanitizeRestaurantCapture({ event: event.name, properties });
    assert.equal(filtered?.properties.surface, surface);
    assert.equal(Object.hasOwn(filtered?.properties ?? {}, "section_id"), false);
    for (const origin of ["direct_link", "history", "cart"] as const) {
      const linked = harness();
      linked.analytics.sync({ ...detail, section: synthetic }, origin, false, [synthetic, canonical]);
      const linkedEvent = linked.events[0];
      assert.equal("sectionId" in linkedEvent && linkedEvent.sectionId, canonical.id);
      assert.equal(restaurantEventContext(linkedEvent, "/r/a/menu").surface, origin);
    }
  }
  const search = harness();
  search.analytics.sync(detail, "card", true, [canonical]);
  assert.equal(restaurantEventContext(search.events[0], "/r/a/menu").surface, "menu_search");
});

function loadHandler(name: string, end: string, context: Record<string, unknown>) {
  const start = browser.indexOf(`  ${name === "toggleHeart" ? "async " : ""}function ${name}(`);
  const stop = browser.indexOf(end, start);
  assert.ok(start >= 0 && stop > start, `Find ${name} handler boundaries`);
  const source = browser.slice(start, stop);
  const exports: Record<string, (...args: unknown[]) => unknown> = {};
  runInNewContext(transpileModule(`${source}\nexports.handler = ${name};`, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, { exports, ...context });
  return exports.handler;
}

test("actual heart handler emits once after success or visitor-refresh retry, never for rejection/network/malformed success", async () => {
  for (const scenario of ["success", "unlike", "refresh", "rate_limit", "rejected", "network", "malformed", "mismatch", "wrong_status"] as const) {
    const { analytics, events } = harness();
    const liked = scenario !== "unlike";
    let requests = 0;
    const handler = loadHandler("toggleHeart", "\n  useEffect(() => {\n    if (!initialActivePayment", {
      pendingHearts: [], likedItemIds: liked ? [] : [itemId], heartCounts: { [itemId]: 1 }, restaurantSlug: "test",
      engagement: analytics,
      setPendingHearts: () => {}, setLikedItemIds: () => {}, setHeartCounts: () => {},
      fetch: async () => {
        requests++;
        if (scenario === "network") throw Error("Offline");
        const status = scenario === "rate_limit" ? 429 : scenario === "rejected" ? 403 : scenario === "refresh" && requests === 1 ? 428 : 200;
        return { ok: status === 200, status, headers: new Headers({ "X-Heart-Visitor-Refresh": "1" }),
          json: async () => scenario === "malformed" ? {} : { itemId: scenario === "mismatch" ? "wrong" : itemId, liked: scenario === "wrong_status" ? !liked : liked, count: 1, visitorKey: "PRIVATE_VISITOR" } };
      },
    });
    await handler(itemId);
    const succeeded = ["success", "unlike", "refresh"].includes(scenario);
    assert.equal(events.length, succeeded ? 1 : 0, scenario);
    if (succeeded) assert.deepEqual(events[0], { name: "menu_favorite_changed", restaurantId: "tenant-a", itemId, liked });
    assert.equal(requests, scenario === "refresh" ? 2 : 1);
    assert.doesNotMatch(JSON.stringify(events), /PRIVATE|visitor|count/);
  }
  assert.doesNotThrow(() => createMenuEngagement("tenant-a", () => { throw Error(); }).favoriteSucceeded(itemId, true, { itemId, liked: true, count: 1 }));
});

test("actual category handler does not suppress three rapid activations including clearing search and same-category repeat", () => {
  for (const search of ["", "taco"]) {
    const events: AnalyticsEvent[] = [];
    const handler = loadHandler("navigateToSection", "\n  function closeDetailSurface", {
      followActiveCategoryRef: { current: true }, search, searchInput: search,
      navigationIntentRef: {}, pendingSectionNavigationRef: {}, restaurantId: "tenant-a",
      clearSearchIntent: (id: string) => ({ kind: "section", sectionId: id }),
      setSearchInput: () => {}, setSearch: () => {}, closeSectionList: () => {},
      window: { matchMedia: () => ({ matches: false }) }, requestAnimationFrame: () => {}, scrollToSection: () => {},
      trackEvent: (event: AnalyticsEvent) => events.push(event),
    });
    handler(canonical, false); handler(canonical, false); handler(canonical, true);
    assert.equal(events.length, 3);
    for (const event of events) {
      const properties = { analytics_scope: "restaurant", restaurant_id: event.restaurantId, environment: "staging",
        ...restaurantEventContext(event, "/r/a/menu"), section_id: canonical.id };
      assert.ok(sanitizeRestaurantCapture({ event: event.name, properties }));
    }
  }
});

test("all detail entry paths feed one lifecycle observer without changing history or direct-link expansion", () => {
  assert.match(browser, /engagement\.sync\(detailClosing \? null : selectedDetail/);
  assert.doesNotMatch(browser, /name: "menu_item_expanded"|name: "menu_item_collapsed"/);
  assert.match(browser, /detailOriginRef\.current = event \? "history" : "direct_link"/);
  assert.match(browser, /detailOriginRef\.current = "card"/);
  assert.match(browser, /detailOriginRef\.current = "cart"/);
  assert.match(browser, /if \(!event && detailOpenRef.current\) return/);
  assert.match(browser, /window\.history\.pushState\(\{ \.\.\.window.history.state, menuItem: true \}/);
  assert.match(browser, /if \(!response.ok\) throw new Error\("Heart request failed"\)/);
});
