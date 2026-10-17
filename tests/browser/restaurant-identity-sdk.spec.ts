import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { gunzipSync } from "node:zlib";

// A localhost-only page with the installed SDK and real application adapter.
// Every request is intercepted; this never contacts PostHog or a deployment.
test("installed PostHog SDK sends tenant-scoped restaurant identities without touching marketing identity", async ({ page }) => {
  const origin = "http://localhost:51770";
  const captured: Buffer[] = [];
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/analytics/eligibility") {
      await route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: '{"allowed":true}' });
    } else if (path === "/") {
      await route.fulfill({ status: 200, contentType: "text/html", body: "<html><body></body></html>" });
    } else {
      if (request.method() === "POST") captured.push(request.postDataBuffer() ?? Buffer.alloc(0));
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
  });
  await page.goto(origin);
  const bundle = await build({
    stdin: { contents: `import posthog from "posthog-js";
      import { initializePostHog, posthogProvider, captureMarketingEvent } from "./src/lib/analytics/posthog";
      import { analyticsEligibility } from "./src/lib/analytics/eligibility";
      window.analyticsTest = { posthog, initializePostHog, posthogProvider, captureMarketingEvent, analyticsEligibility };`,
      resolveDir: process.cwd(), sourcefile: "identity-test-entry.ts" },
    bundle: true, format: "iife", platform: "browser", write: false,
    define: { "process.env.NEXT_PUBLIC_POSTHOG_KEY": '"test-key"',
      "process.env.NEXT_PUBLIC_POSTHOG_HOST": JSON.stringify(origin),
      "process.env.NEXT_PUBLIC_VERCEL_ENV": '"preview"' },
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const events = await page.evaluate(async () => {
    const app = (window as typeof window & { analyticsTest: {
      posthog: { on(name: string, callback: (data: unknown) => void): void; get_distinct_id(): string;
        has_opted_out_capturing(): boolean; _is_bot(): boolean;
        set_config(config: Record<string, unknown>): void;
        capture(name: string, properties: Record<string, unknown>): unknown; __loaded: boolean };
      initializePostHog(): Promise<void>;
      captureMarketingEvent(name: string, properties: Record<string, unknown>): void;
      posthogProvider: { track(event: { name: string; restaurantId: string }): void };
      analyticsEligibility: { isAllowed(): boolean };
    } }).analyticsTest;
    await app.initializePostHog();
    // Playwright's headless user agent is intentionally filtered by PostHog.
    // Disable that filter only inside this fully intercepted local test page.
    app.posthog._is_bot = () => false;
    app.posthog.set_config({ disable_compression: true, request_batching: false });
    const outgoing: unknown[] = [];
    app.posthog.on("eventCaptured", (data) => outgoing.push(data));
    app.captureMarketingEvent("$pageview", { analytics_scope: "marketing", page: "/" });
    app.posthogProvider.track({ name: "page_view", restaurantId: "tenant-a" });
    app.posthogProvider.track({ name: "page_view", restaurantId: "tenant-b" });
    // A direct SDK call has no scoped identity context and must be rejected.
    app.posthog.capture("page_view",
      { analytics_scope: "restaurant", restaurant_id: "tenant-a", environment: "staging" });
    app.posthog.capture("unscoped", { note: "must not escape" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { outgoing, sdkDistinctId: app.posthog.get_distinct_id(), loaded: app.posthog.__loaded,
      allowed: app.analyticsEligibility.isAllowed(), optedOut: app.posthog.has_opted_out_capturing() };
  });
  expect(events.allowed).toBe(true);
  expect(events.loaded).toBe(true);
  expect(events.optedOut).toBe(false);
  const data = events.outgoing as { event: string; properties: Record<string, unknown> }[];
  expect(data.map((event) => event.event)).toEqual(["$pageview", "page_view", "page_view"]);
  const marketing = data[0].properties;
  const a = data[1].properties, b = data[2].properties;
  expect(marketing.distinct_id).toBe(events.sdkDistinctId);
  expect(a.distinct_id).not.toBe(marketing.distinct_id);
  expect(a.distinct_id).not.toBe(b.distinct_id);
  for (const tenant of [a, b]) {
    expect(tenant.identity_version).toBe(1);
    expect(tenant.identity_mode).toBe("persistent");
    expect(tenant.$device_id).toBe(tenant.distinct_id);
    expect(typeof tenant.$session_id).toBe("string");
    expect(tenant.$window_id).toBeUndefined();
    expect(tenant.$insert_id).toBeUndefined();
    expect(tenant.$geoip_disable).toBe(true);
    expect(tenant.$process_person_profile).toBe(false);
  }
  expect(a.$session_id).not.toBe(b.$session_id);
  expect(JSON.stringify(data)).not.toMatch(/\$current_url|\$referrer|\$set|email|phone/);
  expect(captured.length).toBe(3);
  const bodies = captured.map((payload) =>
    (payload[0] === 0x1f && payload[1] === 0x8b ? gunzipSync(payload) : payload).toString("utf8"));
  const delivered = bodies.flatMap((body) => (JSON.parse(body) as {
    batch: { event: string; uuid: string; properties: Record<string, unknown> }[] }).batch);
  expect(delivered.find((event) => event.properties.restaurant_id === "tenant-a")?.properties.distinct_id).toBe(a.distinct_id);
  expect(delivered.find((event) => event.properties.restaurant_id === "tenant-b")?.properties.distinct_id).toBe(b.distinct_id);
  expect(delivered.find((event) => event.event === "$pageview")?.properties.distinct_id).toBe(marketing.distinct_id);
  const restaurantEvents = delivered.filter((event) => event.properties.analytics_scope === "restaurant");
  expect(restaurantEvents[0].uuid).not.toBe(restaurantEvents[1].uuid);
  for (const event of restaurantEvents) {
    expect(event.properties.$window_id).toBeUndefined();
    expect(event.properties.$insert_id).toBeUndefined();
    expect(event.properties.$device_id).toBe(event.properties.distinct_id);
    expect(event.properties.$session_id).not.toBe(marketing.$session_id);
    expect(JSON.stringify(event)).not.toMatch(/\$current_url|\$referrer|\$set|email|phone/);
  }

  await page.reload();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const afterReload = await page.evaluate(async () => {
    const app = (window as typeof window & { analyticsTest: {
      posthog: { on(name: string, callback: (data: unknown) => void): void; _is_bot(): boolean; get_distinct_id(): string };
      initializePostHog(): Promise<void>; posthogProvider: { track(event: { name: string; restaurantId: string }): void };
    } }).analyticsTest;
    await app.initializePostHog();
    app.posthog._is_bot = () => false;
    const outgoing: unknown[] = [];
    app.posthog.on("eventCaptured", (data) => outgoing.push(data));
    app.posthogProvider.track({ name: "page_view", restaurantId: "tenant-a" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { outgoing, sdkDistinctId: app.posthog.get_distinct_id() };
  });
  const revisit = afterReload.outgoing as { event: string; properties: Record<string, unknown> }[];
  expect(revisit).toHaveLength(1);
  expect(revisit[0].properties.distinct_id).toBe(a.distinct_id);
  expect(revisit[0].properties.$session_id).toBe(a.$session_id);
  expect(revisit[0].properties.distinct_id).not.toBe(afterReload.sdkDistinctId);
});
