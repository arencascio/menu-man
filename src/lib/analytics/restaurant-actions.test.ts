import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { JsxEmit, ModuleKind, transpileModule } from "typescript";
import { marketingEnvironment, sanitizeMarketingCapture } from "./marketing";
import { restaurantEventContext, sanitizeRestaurantCapture } from "./restaurant";
import { createMenuEngagement, menuCardSurface } from "./menu-engagement";

const providerId = "20000000-0000-4000-8000-000000000301";
const base = { analytics_scope: "restaurant", restaurant_id: "tenant-a", environment: "staging" };
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const component = (name: string) => read(`src/app/r/[slug]/${name}.tsx`);
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
function load(path: string, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports: Record<string, (...args: never[]) => unknown> = {};
  runInNewContext(transpileModule(read(path), { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText, {
    exports, ...globals, require(id: string) {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return exports;
}

test("action adapter retains canonical provider/source and pickup semantics, privacy and tenant context; only actions bypass batching", () => {
  const captures: { event: string; properties: Record<string, unknown> }[] = [];
  const options: unknown[] = [];
  let beforeSend: (event: typeof captures[number]) => typeof captures[number] | null;
  let fail = false;
  const sdk = { __loaded: false, has_opted_out_capturing: () => false,
    init(_key: string, config: { before_send: typeof beforeSend }) { beforeSend = config.before_send; this.__loaded = true; },
    capture(event: string, properties: Record<string, unknown>, opts: unknown) {
      if (fail) throw Error("SDK unavailable");
      const filtered = beforeSend({ event, properties: { ...properties,
        $current_url: "https://private.example/?email=private@example.com#private", $referrer: "https://private.example/", $ip: "192.0.2.1" } });
      if (filtered) { captures.push(plain(filtered)); options.push(plain(opts ?? null)); }
    },
  };
  const adapter = load("src/lib/analytics/posthog.ts", { "posthog-js": { default: sdk },
    "./marketing": { marketingEnvironment, sanitizeMarketingCapture }, "./restaurant": { restaurantEventContext, sanitizeRestaurantCapture } },
  { process: { env: { NEXT_PUBLIC_POSTHOG_KEY: "mock", NEXT_PUBLIC_POSTHOG_HOST: "https://mock.invalid", NEXT_PUBLIC_VERCEL_ENV: "preview" } },
    window: { location: { pathname: "/r/a/location" } } });
  adapter.initializePostHog();
  const provider = adapter.posthogProvider as unknown as { track(event: unknown): void };
  provider.track({ name: "delivery_clicked", restaurantId: "tenant-a", providerId, surface: "delivery_chooser", placement: "hero",
    url: "https://private.example/", providerName: "Private name", phone: "5555555555" });
  assert.deepEqual(captures[0], { event: "delivery_clicked", properties: { ...base, provider_id: providerId,
    page_type: "location", surface: "delivery_chooser", placement: "hero", $process_person_profile: false, $geoip_disable: true } });
  for (const pickupAction of ["internal_selection", "external_departure"]) {
    provider.track({ name: "pickup_clicked", restaurantId: "tenant-a", surface: "hero", pickupAction });
    assert.equal(captures.at(-1)?.properties.pickup_action, pickupAction);
  }
  for (const name of ["phone_clicked", "directions_clicked"]) for (const surface of ["header", "footer", "restaurant_information"]) {
    provider.track({ name, restaurantId: "tenant-a", surface });
    assert.equal(captures.at(-1)?.properties.surface, surface);
    assert.equal(captures.at(-1)?.event, name);
  }
  assert.equal(captures.length, 9); // One capture per action, no extra classification event.
  assert.ok(options.every((option) => JSON.stringify(option) === '{"send_instantly":true}'));
  provider.track({ name: "page_view", restaurantId: "tenant-b" });
  assert.equal(captures.at(-1)?.properties.restaurant_id, "tenant-b");
  assert.equal(options.at(-1), null);
  adapter.captureMarketingEvent(...["marketing_cta_clicked", { analytics_scope: "marketing", page: "/", cta_id: "build_website", placement: "hero", destination_type: "page" }] as never[]);
  assert.equal(captures.at(-1)?.properties.analytics_scope, "marketing");
  assert.equal(Object.hasOwn(captures.at(-1)!.properties, "restaurant_id"), false);
  assert.equal(options.at(-1), null);
  assert.doesNotMatch(JSON.stringify(captures), /private|555555|192\.0\.2/);
  fail = true;
  assert.doesNotThrow(() => provider.track({ name: "delivery_clicked", restaurantId: "tenant-a", providerId }));
});

test("missing providers remain unattributed, invalid identifiers/classifications fail closed, unrelated properties cannot leak", () => {
  const filter = (event: string, props: Record<string, unknown>) => sanitizeRestaurantCapture({ event, properties: { ...base, ...props } as Record<string, unknown> });
  assert.ok(filter("delivery_clicked", {}));
  for (const provider_id of ["DoorDash", "https://provider.example/", "", 123, null]) assert.equal(filter("delivery_clicked", { provider_id }), null);
  for (const props of [{ placement: "customer notes" }, { surface: "https://private.example/" }]) assert.equal(filter("delivery_clicked", props), null);
  assert.equal(filter("pickup_clicked", { pickup_action: "order_completed" }), null);
  assert.equal(filter("phone_clicked", { phone: "5555555555", address: "Private address", url: "https://private.example/", provider_id: providerId })?.properties.provider_id, undefined);
  const marketing = { event: "marketing_cta_clicked", properties: { analytics_scope: "marketing", placement: "hero" } };
  assert.equal(sanitizeRestaurantCapture(marketing), marketing);
});

test("tracked link emits once only on activation, preserves destinations/target and tolerates analytics failures", () => {
  const events: unknown[] = [];
  let fail = false;
  const actions = load("src/lib/analytics/restaurant-actions.ts", { "./client": { trackEvent(event: unknown) { if (fail) throw Error(); events.push(plain(event)); } } });
  const links = load("src/app/r/[slug]/TrackedRestaurantLink.tsx", { "@/lib/analytics/restaurant-actions": actions,
    "react/jsx-runtime": { jsx: (_tag: unknown, props: unknown) => props } });
  const props = { eventName: "delivery_clicked", restaurantId: "tenant-a", providerId, surface: "delivery_chooser", placement: "footer",
    href: "https://provider.example/private", target: "_blank", rel: "noreferrer", children: "Provider" };
  const link = links.default(...[props] as never[]) as { onClick(): void; href: string; target: string; rel: string };
  assert.equal(events.length, 0);
  assert.equal(link.href, props.href); assert.equal(link.target, "_blank"); assert.equal(link.rel, "noreferrer");
  link.onClick();
  assert.deepEqual(events, [{ name: "delivery_clicked", restaurantId: "tenant-a", providerId, surface: "delivery_chooser", placement: "footer" }]);
  fail = true;
  assert.doesNotThrow(() => link.onClick());
});

test("configured providers are tenant scoped, chooser emits only on departure and retains initiating surface", () => {
  const loader = read("src/app/r/[slug]/restaurant-delivery-options.ts");
  assert.match(loader, /select\("id, display_name,/);
  assert.match(loader, /\.eq\("restaurant_id", restaurantId\)/);
  assert.match(loader, /providerId: provider.id/);
  const chooser = component("RestaurantDeliveryChooser");
  assert.match(chooser, /chooser.open\(returnFocusRef\?\.current \?\? trigger, surface\)/);
  assert.match(chooser, /if \(!dialog \|\| options.length === 0\) return;[\s\S]*setPlacement\(surface\)/);
  assert.match(chooser, /eventName="delivery_clicked"\s*providerId=\{option.providerId\}\s*surface="delivery_chooser"\s*placement=\{placement\}/);
  assert.equal((chooser.match(/eventName="delivery_clicked"/g) ?? []).length, 1);
  assert.doesNotMatch(chooser, /trackEvent|trackRestaurantAction/); // Rendering/opening is not a departure.
});

test("existing action surfaces use explicit semantic context without altering mobile close or pickup confirmation", () => {
  for (const [file, surface] of [["RestaurantHero", "hero"], ["RestaurantOrderingActions", "ordering_actions"], ["RestaurantFeaturedGallerySlider", "featured_gallery"]]) {
    const source = component(file);
    assert.match(source, new RegExp(`surface="${surface}"`));
    assert.match(source, /pickupAction=\{action.trackingEvent === "pickup_clicked" \? \(action.external \? "external_departure" : "internal_selection"\) : undefined\}/);
  }
  for (const [file, surface] of [["RestaurantHoursLocation", "restaurant_information"], ["RestaurantFooter", "footer"]]) {
    assert.match(component(file), new RegExp(`<TrackedRestaurantLink surface="${surface}"`));
  }
  const navigation = component("RestaurantNavigation");
  assert.match(navigation, /trackRestaurantAction\("phone_clicked", restaurantId, \{ surface: "header" \}\)/);
  assert.match(navigation, /trackRestaurantAction\("directions_clicked", restaurantId, \{ surface: "header" \}\)/);
  assert.match(navigation, /if \(mobile\) requestClose\(\)/);
  assert.equal((navigation.match(/onClick=\{\(\) => handleAction\(item, mobile\)\}/g) ?? []).length, 2);
  const calls: unknown[] = [];
  let closes = 0;
  const start = navigation.indexOf("  const handleAction =");
  const handlerSource = navigation.slice(start, navigation.indexOf("  const links =", start));
  const handler = runInNewContext(transpileModule(`${handlerSource}\nhandleAction;`, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, {
    restaurantId: "tenant-a", trackRestaurantAction: (...args: unknown[]) => calls.push(plain(args)), requestClose: () => closes++,
  }) as (item: { href: string; icon?: string }, mobile: boolean) => void;
  handler({ href: "tel:5555555555", icon: "phone" }, true);
  handler({ href: "https://maps.example/private", icon: "directions" }, false);
  handler({ href: "/r/a/menu", icon: "menu" }, true);
  assert.deepEqual(calls, [["phone_clicked", "tenant-a", { surface: "header" }], ["directions_clicked", "tenant-a", { surface: "header" }]]);
  assert.equal(closes, 2);
  assert.match(component("RestaurantShell"), /restaurantId=\{restaurant.id\}/);
  assert.match(component("RestaurantPickupTimeChooser"), /if \(confirmedRef.current\) \{\s*trackEvent\(\{ name: "pickup_clicked", restaurantId, surface: "pickup_chooser", pickupAction: "internal_selection" \}\);/);
});

test("new cart adds preserve item-opening origin and synthetic/search surfaces without changing cart mutation semantics", () => {
  for (const surface of ["featured", "popular", "favorites"] as const) assert.equal(menuCardSurface(surface, true), surface);
  assert.equal(menuCardSurface("canonical-section", false), "menu");
  assert.equal(menuCardSurface("canonical-section", true), "menu_search");
  const tracker = createMenuEngagement("tenant-a", () => {});
  assert.equal(tracker.currentSurface(), undefined);
  const detail = { item: { id: "item-a", name: "Taco", price_cents: 350 }, section: { id: "section-a", name: "Tacos" }, mode: "quick" as const };
  tracker.sync(detail, "direct_link", false, []);
  assert.equal(tracker.currentSurface(), "direct_link");
  tracker.sync(null, "card", false, []);
  assert.equal(tracker.currentSurface(), undefined);
  const cart = read("src/app/r/[slug]/useRestaurantCart.ts");
  assert.match(cart, /dispatch\(\{ type: "add", line \}\);\s*trackLineChange\("add_to_cart", restaurantId, currency, line, line.quantity, surface\)/);
  const browser = component("MenuBrowser");
  assert.match(browser, /cart.addLine\(createDirectCartLine\(item, section, crypto.randomUUID\(\)\), menuCardSurface\(section.id, Boolean\(search\)\)\)/);
  assert.equal((browser.match(/cart.addLine\(line, engagement.currentSurface\(\)\)/g) ?? []).length, 2);
  const event = { name: "add_to_cart" as const, restaurantId: "tenant-a", itemId: "item-a", itemName: "Taco", priceCents: 350, quantity: 1, currency: "USD", surface: "featured" as const };
  assert.deepEqual(restaurantEventContext(event, "/r/a/menu"), { page_type: "menu", surface: "featured" });
  const cartEvents: unknown[] = [];
  const mutations: unknown[] = [];
  const hook = load("src/app/r/[slug]/useRestaurantCart.ts", {
    react: { useCallback: (fn: unknown) => fn, useMemo: (fn: () => unknown) => fn(), useEffect: () => {}, useRef: () => ({ current: false }),
      useReducer: (_reducer: unknown, initial: unknown) => [initial, (action: unknown) => mutations.push(plain(action))] },
    "@/lib/analytics/client": { trackEvent: (payload: unknown) => cartEvents.push(plain(payload)) },
    "@/lib/cart/cart": { createCartState: () => ({ lines: [] }), calculateCartSubtotalCents: () => 0, calculateUnitPriceCents: () => 350 },
    "@/lib/cart/storage": {}, "@/lib/payments/browser-session": {},
  });
  const state = hook.default(...["tenant-a", "USD"] as never[]) as { addLine(line: unknown, surface: string): void };
  const line = { menuItemId: "item-a", itemName: "Taco", quantity: 2 };
  state.addLine(line, "favorites");
  assert.deepEqual(mutations, [{ type: "add", line }]);
  assert.deepEqual(cartEvents, [{ name: "add_to_cart", restaurantId: "tenant-a", currency: "USD", itemId: "item-a", itemName: "Taco", priceCents: 350, quantity: 2, surface: "favorites" }]);
});
