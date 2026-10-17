import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { JsxEmit, ModuleKind, transpileModule } from "typescript";
import { createAnalyticsEligibility } from "./eligibility";
import { createMarketingAnalytics, marketingEnvironment, sanitizeMarketingCapture } from "./marketing";
import { restaurantEventContext, sanitizeRestaurantCapture } from "./restaurant";

function load<T>(file: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports = {};
  const compiled = transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText;
  runInNewContext(compiled, { exports, Response, ...globals, require(id: string) {
    if (id in modules) return modules[id];
    throw Error(`Unexpected module: ${id}`);
  } });
  return exports as T;
}

function endpoint(env: Record<string, string | undefined> = { VERCEL: "1", VERCEL_ENV: "production" }) {
  return load<{ GET(request: Request): Response }>("src/app/api/analytics/eligibility/route.ts", {}, { process: { env } }).GET;
}

test("only Vercel-provided US country is eligible; EU/UK, unknown and invalid countries deny", async () => {
  for (const environment of ["production", "preview"]) {
    const get = endpoint({ VERCEL: "1", VERCEL_ENV: environment });
    for (const country of ["US", "DE", "FR", "GB", "CA", "", "us", "USA", "US, DE", "XX"]) {
      const response = get(new Request("https://site.invalid/api/analytics/eligibility", { headers: { "x-vercel-ip-country": country } }));
      assert.deepEqual(await response.json(), { allowed: country === "US" });
      assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
      assert.equal(response.headers.get("cdn-cache-control"), "no-store");
      assert.equal(response.headers.get("vercel-cdn-cache-control"), "no-store");
      assert.equal(response.headers.get("set-cookie"), null);
    }
    assert.deepEqual(await get(new Request("https://site.invalid/api/analytics/eligibility")).json(), { allowed: false });
  }
});

test("local and unrecognized runtimes deny spoofed headers; query, locale and arbitrary headers never override country", async () => {
  for (const env of [{}, { VERCEL: "1", VERCEL_ENV: "development" }, { VERCEL_ENV: "production" }, { VERCEL: "1", VERCEL_ENV: "unknown" }]) {
    const response = endpoint(env)(new Request("https://site.invalid/api/analytics/eligibility?country=US&allowed=true", {
      headers: { "x-vercel-ip-country": "US", "x-vercel-id": "fake", "x-country": "US", "accept-language": "en-US" },
    }));
    assert.deepEqual(await response.json(), { allowed: false });
  }
  const response = endpoint()(new Request("https://site.invalid/api/analytics/eligibility?country=US&allowed=true", {
    headers: { "x-vercel-ip-country": "GB", "x-country": "US", "accept-language": "en-US", "x-forwarded-for": "127.0.0.1" },
  }));
  assert.deepEqual(await response.json(), { allowed: false });
});

test("client decision is non-cacheable, same-origin, shared per document, and denied until confirmed", async () => {
  let resolve!: (response: Response) => void;
  let calls = 0;
  const gate = createAnalyticsEligibility(async (url, options) => {
    calls++;
    assert.equal(url, "/api/analytics/eligibility");
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.mode, "same-origin");
    assert.equal(options?.redirect, "error");
    assert.ok(options?.signal instanceof AbortSignal);
    return new Promise((done) => { resolve = done; });
  });
  const first = gate.check();
  assert.equal(gate.check(), first);
  assert.equal(gate.isAllowed(), false);
  resolve(Response.json({ allowed: true }));
  assert.equal(await first, true);
  assert.equal(gate.isAllowed(), true);
  assert.equal(await gate.check(), true);
  assert.equal(calls, 1);
});

test("request errors, timeouts, redirects, bad HTTP and invalid response shapes all fail closed", async () => {
  const failures = [
    async () => { throw new TypeError("Network unavailable"); },
    async () => { throw new DOMException("Timed out", "TimeoutError"); },
    async () => Response.json({ allowed: true }, { status: 503 }),
    async () => new Response("not json", { headers: { "Content-Type": "application/json" } }),
    async () => new Response('{"allowed":true}', { headers: { "Content-Type": "text/html" } }),
    ...[{}, null, [], true, { allowed: "true" }, { allowed: false }, { allowed: true, country: "US" }].map((body) => async () => Response.json(body)),
    async () => { const response = Response.json({ allowed: true }); Object.defineProperty(response, "redirected", { value: true }); return response; },
  ];
  for (const failure of failures) {
    const gate = createAnalyticsEligibility(failure);
    assert.equal(await gate.check(), false);
    assert.equal(gate.isAllowed(), false);
  }
});

function adapter(gate: ReturnType<typeof createAnalyticsEligibility>, optedOut = false) {
  const captures: Array<{ name: string; properties: Record<string, unknown> }> = [];
  let initializations = 0;
  let beforeSend: (event: { event: string; properties: Record<string, unknown> }) => { event: string; properties: Record<string, unknown> } | null;
  const sdk = { __loaded: false, has_opted_out_capturing: () => optedOut,
    init(_key: string, config: { before_send: typeof beforeSend }) { initializations++; beforeSend = config.before_send; this.__loaded = true; },
    capture(name: string, properties: Record<string, unknown>) {
      const outgoing = beforeSend({ event: name, properties: { ...properties, distinct_id: "sdk-memory-id",
        $current_url: "https://example.invalid/?email=private@example.com" } });
      if (outgoing) captures.push({ name: outgoing.event, properties: outgoing.properties });
    },
  };
  const api = load<{
    initializePostHog(): Promise<void>;
    isMarketingCaptureAllowed(): boolean;
    captureMarketingEvent(name: string, properties: Record<string, unknown>): void;
    posthogProvider: { track(event: unknown): void };
  }>("src/lib/analytics/posthog.ts", {
    "posthog-js": { default: sdk }, "./eligibility": { analyticsEligibility: gate },
    "./marketing": { marketingEnvironment, sanitizeMarketingCapture },
    "./restaurant": { restaurantEventContext, sanitizeRestaurantCapture },
    "./restaurant-identity": { restaurantIdentity: { withIdentity: async (_environment: string, _restaurantId: string,
      allowed: () => boolean, deliver: (identity: unknown) => void) => {
      if (allowed()) deliver({ distinctId: "20000000-0000-4000-8000-000000000001",
        visitId: "20000000-0000-4000-8000-000000000002", mode: "persistent" });
    } } },
  }, { process: { env: { NEXT_PUBLIC_POSTHOG_KEY: "mock", NEXT_PUBLIC_POSTHOG_HOST: "https://mock.invalid", NEXT_PUBLIC_VERCEL_ENV: "production" } } });
  return { api, captures, initializations: () => initializations };
}

test("denied or failing eligibility never initializes PostHog or captures marketing/restaurant events", async () => {
  for (const fetcher of [async () => Response.json({ allowed: false }), async () => { throw Error(); }]) {
    const { api, captures, initializations } = adapter(createAnalyticsEligibility(fetcher));
    await api.initializePostHog();
    await api.initializePostHog();
    api.captureMarketingEvent("$pageview", { analytics_scope: "marketing", page: "/" });
    api.posthogProvider.track({ name: "page_view", restaurantId: "tenant" });
    assert.equal(api.isMarketingCaptureAllowed(), false);
    assert.equal(initializations(), 0);
    assert.equal(captures.length, 0);
  }
});

test("eligibility precedes initialization; opt-out still suppresses both capture paths", async () => {
  let resolve!: (response: Response) => void;
  const gate = createAnalyticsEligibility(() => new Promise((done) => { resolve = done; }));
  const { api, captures, initializations } = adapter(gate, true);
  const starting = api.initializePostHog();
  assert.equal(api.initializePostHog(), starting);
  api.captureMarketingEvent("$pageview", {});
  assert.equal(initializations(), 0);
  resolve(Response.json({ allowed: true }));
  await starting;
  assert.equal(initializations(), 1);
  api.captureMarketingEvent("$pageview", {});
  api.posthogProvider.track({ name: "page_view", restaurantId: "tenant" });
  assert.equal(captures.length, 0);
});

test("delayed initial load, effect replay, client navigation and form events retain source attribution once", async () => {
  let resolve!: (response: Response) => void;
  let storageAccesses = 0;
  const gate = createAnalyticsEligibility(() => new Promise((done) => { resolve = done; }));
  const { api, captures } = adapter(gate);
  const stored = new Map<string, string>();
  const storage = {
    getItem(key: string) { storageAccesses++; return stored.get(key) ?? null; },
    setItem(key: string, value: string) { storageAccesses++; stored.set(key, value); },
    removeItem(key: string) { stored.delete(key); },
  };
  const location = { pathname: "/", search: "?utm_source=business_card&utm_campaign=local_outreach" };
  const client = load<{ marketingAnalytics: { visit(path: string, search?: string): void }; trackMarketing(event: unknown): void }>(
    "src/lib/analytics/marketing-client.ts", { "./marketing": { createMarketingAnalytics }, "./posthog": api },
    { window: { location, sessionStorage: storage } },
  );
  client.marketingAnalytics.visit("/", location.search);
  client.marketingAnalytics.visit("/", location.search);
  client.trackMarketing({ name: "marketing_cta_clicked", cta_id: "build_website", placement: "hero", destination_type: "page" });
  location.pathname = "/build-my-website";
  location.search = "";
  client.marketingAnalytics.visit(location.pathname);
  client.trackMarketing({ name: "marketing_form_opened", form_type: "website_inquiry" });
  assert.equal(captures.length, 0);
  assert.equal(storageAccesses, 0);
  resolve(Response.json({ allowed: true }));
  await api.initializePostHog();
  assert.deepEqual(captures.map(({ name, properties }) => [name, properties.page]), [
    ["$pageview", "/"], ["marketing_cta_clicked", "/"], ["$pageview", "/build-my-website"], ["marketing_form_opened", "/build-my-website"],
  ]);
  for (const event of captures) {
    assert.equal(event.properties.utm_source, "business_card");
    assert.equal(event.properties.analytics_scope, "marketing");
    assert.equal(event.properties.environment, "production");
  }
  client.marketingAnalytics.visit("/");
  await api.initializePostHog();
  assert.equal(captures.at(-1)?.properties.page, "/");
  assert.equal(captures.length, 5);
});

test("restaurant events wait for eligibility, then retain current tenant, environment and privacy boundary", async () => {
  let resolve!: (response: Response) => void;
  const gate = createAnalyticsEligibility(() => new Promise((done) => { resolve = done; }));
  const { api, captures, initializations } = adapter(gate);
  api.posthogProvider.track({ name: "page_view", restaurantId: "tenant-a", pageType: "home" });
  api.posthogProvider.track({ name: "menu_search", restaurantId: "tenant-b", queryLength: 7, resultCount: 0, query: "private@example.com" });
  assert.equal(initializations(), 0);
  assert.equal(captures.length, 0);
  resolve(Response.json({ allowed: true }));
  await api.initializePostHog();
  await new Promise(setImmediate);
  assert.equal(initializations(), 1);
  assert.deepEqual(captures.map(({ name, properties }) => [name, properties.restaurant_id, properties.environment]), [
    ["page_view", "tenant-a", "production"], ["menu_search", "tenant-b", "production"],
  ]);
  for (const { properties } of captures) {
    assert.equal(properties.analytics_scope, "restaurant");
    assert.equal(properties.$geoip_disable, true);
    assert.doesNotMatch(JSON.stringify(properties), /private@|current_url/);
  }
});

test("restaurant events queued during a denied or failed decision are discarded", async () => {
  for (const result of [() => Response.json({ allowed: false }), () => { throw Error("network unavailable"); }]) {
    let resolve!: (response: Response) => void;
    let reject!: (error: Error) => void;
    const gate = createAnalyticsEligibility(() => new Promise((done, fail) => { resolve = done; reject = fail; }));
    const { api, captures, initializations } = adapter(gate);
    api.posthogProvider.track({ name: "page_view", restaurantId: "tenant-a", pageType: "home" });
    try { resolve(result()); } catch (error) { reject(error as Error); }
    await api.initializePostHog();
    await new Promise(setImmediate);
    assert.equal(initializations(), 0);
    assert.equal(captures.length, 0);
  }
});

test("restaurant events never reach GA4, including after eligibility and withdrawal", () => {
  const events: unknown[][] = [];
  const app = load<{ trackEvent(event: unknown): void }>("src/lib/analytics/client.ts", {
    "./posthog": { isPostHogConfigured: () => false, posthogProvider: { track() {} } },
  }, { process: { env: { NEXT_PUBLIC_ANALYTICS_PROVIDER: "ga4", NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TEST" } },
    window: { gtag: (...args: unknown[]) => events.push(args) } });
  app.trackEvent({ name: "page_view", restaurantId: "tenant-a" });
  app.trackEvent({ name: "menu_item_expanded", restaurantId: "tenant-a", itemId: "item-a" });
  app.trackEvent({ name: "phone_clicked", restaurantId: "tenant-a" });
  assert.deepEqual(events, []);
});

test("GA4 loads only on eligible marketing routes and is disabled on restaurant navigation", async () => {
  for (const eligible of [false, true]) {
    let allowed = false;
    let pathname = "/";
    const effects: Array<() => void> = [];
    const layoutEffects: Array<() => void> = [];
    const win: Record<string, unknown> = {
      history: { pushState() {}, replaceState() {} },
      addEventListener() {}, removeEventListener() {},
    };
    const component = load<{ default(): unknown }>("src/app/AnalyticsScripts.tsx", {
      "next/script": { default: "Script" },
      "next/navigation": { usePathname: () => pathname },
      react: { useState: () => [allowed, (value: boolean) => { allowed = value; }], useEffect: (effect: () => void) => { effects.push(effect); },
        useLayoutEffect: (effect: () => void) => { layoutEffects.push(effect); } },
      "@/lib/analytics/eligibility": { analyticsEligibility: { check: async () => eligible } },
      "@/lib/analytics/marketing": { marketingPages: ["/", "/services", "/work", "/build-my-website"] },
      "react/jsx-runtime": { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }), Fragment: "Fragment" },
    }, { process: { env: { NEXT_PUBLIC_ANALYTICS_PROVIDER: "ga4", NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TEST" } }, window: win });
    assert.equal(component.default(), null);
    layoutEffects[0]();
    layoutEffects[1]();
    assert.equal(win["ga-disable-G-TEST"], false);
    effects[0]();
    assert.equal(component.default(), null);
    await new Promise(setImmediate);
    const rendered = component.default();
    assert.equal(rendered === null, !eligible);
    if (eligible) assert.match(JSON.stringify(rendered), /googletagmanager\.com/);
    pathname = "/r/super-tacos/menu";
    assert.equal(component.default(), null);
    layoutEffects.at(-2)!();
    assert.equal(win["ga-disable-G-TEST"], true);
    pathname = "/services";
    component.default();
    layoutEffects.at(-2)!();
    assert.equal(win["ga-disable-G-TEST"], false);
  }
});
