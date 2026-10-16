import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { createMarketingAnalytics, createMarketingFormAnalytics, marketingClick, marketingCta, marketingEnvironment, sanitizeCampaign, sanitizeMarketingCapture } from "./marketing";
import { createLeadSubmitter, type LeadOutcome } from "../marketing-leads/client";
import type { MarketingEvent } from "./types";

function harness(allowed = () => true, storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">) {
  const events: Array<{ name: string; properties: Record<string, unknown> }> = [];
  const analytics = createMarketingAnalytics((name, properties) => events.push({ name, properties }), allowed, storage);
  return { analytics, events };
}

test("marketing environment distinguishes Vercel previews without guessing production for local or unknown builds", () => {
  assert.equal(marketingEnvironment("preview"), "staging");
  assert.equal(marketingEnvironment("production"), "production");
  assert.equal(marketingEnvironment("development"), "development");
  assert.equal(marketingEnvironment(), "unknown");
  assert.equal(marketingEnvironment("unexpected"), "unknown");
});

test("marketing pageviews cover initial/client navigation once per transition, excluding fragments, queries and restaurant routes", () => {
  const { analytics, events } = harness();
  analytics.visit("/", "?email=private@example.com");
  analytics.visit("/"); // hydration / Strict Mode replay / fragment-only navigation
  analytics.visit("/", "?different=query");
  analytics.visit("/services");
  analytics.visit("/work");
  analytics.visit("/build-my-website");
  analytics.visit("/r/armandos");
  analytics.visit("/r/super-tacos/menu");
  analytics.visit("/build-my-website"); // Returning from another route is a new visit.
  assert.deepEqual(events.map((event) => [event.name, event.properties.page]), [
    ["$pageview", "/"], ["$pageview", "/services"], ["$pageview", "/work"],
    ["$pageview", "/build-my-website"], ["$pageview", "/build-my-website"],
  ]);
  assert.doesNotMatch(JSON.stringify(events), /private|email|different|query|armandos|super-tacos/);
});

test("CTAs use stable explicit IDs/placements, never link text or href", () => {
  for (const cta of ["build_website", "website_review", "explore_product", "services_pricing", "site_like_this"] as const) {
    for (const placement of ["hero", "navigation", "section", "footer", "final_cta"] as const) {
      const attributes = marketingCta(cta, placement, cta === "website_review" ? "modal" : "page");
      const event = marketingClick({ marketingCta: attributes["data-marketing-cta"], marketingPlacement: placement,
        marketingDestination: attributes["data-marketing-destination"], href: "mailto:private@example.com", text: "Sensitive text" });
      assert.deepEqual(event, { name: "marketing_cta_clicked", cta_id: cta, placement, destination_type: cta === "website_review" ? "modal" : "page" });
    }
  }
  assert.equal(marketingClick({ marketingCta: "private@example.com", marketingPlacement: "hero", marketingDestination: "page" }), null);
  assert.equal(marketingClick({ marketingCta: "build_website", marketingPlacement: "arbitrary", marketingDestination: "page" }), null);
  assert.deepEqual(marketingClick({ marketingEmail: "website_review", marketingPlacement: "form", href: "mailto:private@example.com?body=secret" }),
    { name: "marketing_email_clicked", placement: "form", form_type: "website_review" });
  assert.deepEqual(marketingClick({ marketingEmail: "general", marketingPlacement: "footer" }), { name: "marketing_email_clicked", placement: "footer" });
});

test("form opening is idempotent under effect replay and starts once per meaningful-interaction instance", () => {
  for (const form of ["website_inquiry", "website_review"] as const) {
    const events: MarketingEvent[] = [];
    const tracker = createMarketingFormAnalytics(form, (event) => events.push(event));
    assert.equal(events.length, 0); // A mounted, closed review is not an opened form.
    tracker.open(); tracker.open(); tracker.start(); tracker.start(); tracker.start();
    assert.deepEqual(events.map((event) => event.name), ["marketing_form_opened", "marketing_form_started"]);
    tracker.close(); tracker.open(); tracker.start();
    assert.deepEqual(events.map((event) => event.name), ["marketing_form_opened", "marketing_form_started", "marketing_form_opened", "marketing_form_started"]);
    assert.ok(events.every((event) => "form_type" in event && event.form_type === form));
  }
});

test("only confirmed acceptance emits success, unchanged retries are deduped without changing delivery/idempotency", async () => {
  const outcomes: LeadOutcome[] = [];
  const bodies: Array<{ submissionId: string }> = [];
  let accepted = false;
  let ids = 0;
  const submit = createLeadSubmitter(async (_url, init) => {
    bodies.push(JSON.parse(init!.body as string));
    return accepted ? Response.json({ accepted: true }) : Response.json({ error: "private provider details" }, { status: 502 });
  }, () => `test-${++ids}`, (outcome) => outcomes.push(outcome));
  const values = { restaurantName: "Private restaurant", email: "owner@example.com", help: "Website", notes: "private notes" };
  assert.ok("error" in await submit(values, "website"));
  accepted = true;
  assert.deepEqual(await submit(values, "website"), { accepted: true });
  await submit(values, "website");
  await submit({ ...values, notes: "changed" }, "website");
  assert.deepEqual(outcomes, [{ status: "failed", category: "provider_failure" }, { status: "accepted" }, { status: "accepted" }]);
  assert.equal(bodies[0].submissionId, bodies[1].submissionId);
  assert.equal(bodies[1].submissionId, bodies[2].submissionId);
  assert.notEqual(bodies[2].submissionId, bodies[3].submissionId);
  assert.doesNotMatch(JSON.stringify(outcomes), /owner|restaurant|private|notes|test-/i);
});

test("lead failures emit bounded safe categories, not response text; unavailable analytics cannot break success or failures", async () => {
  for (const [status, category] of [[400, "validation"], [429, "rate_limit"], [502, "provider_failure"], [503, "configuration"], [500, "unconfirmed"], [200, "unconfirmed"]] as const) {
    const outcomes: LeadOutcome[] = [];
    const submit = createLeadSubmitter(async () => Response.json({ error: "secret email owner@example.com" }, { status }), () => "id", (value) => outcomes.push(value));
    assert.ok("error" in await submit({}, "review"));
    assert.deepEqual(outcomes, [{ status: "failed", category }]);
  }
  for (const [fetcher, category] of [
    [async () => { throw Error("private network text"); }, "network"],
    [async () => new Response("invalid JSON"), "unconfirmed"],
  ] as const) {
    const outcomes: LeadOutcome[] = [];
    await createLeadSubmitter(fetcher, () => "id", (value) => outcomes.push(value))({}, "review");
    assert.deepEqual(outcomes, [{ status: "failed", category }]);
  }
  let calls = 0;
  const outcomes: LeadOutcome[] = [];
  const invalid = createLeadSubmitter(async () => { calls++; return Response.json({ accepted: true }); }, () => "id", (value) => outcomes.push(value));
  await invalid({ website: "restaurant" }, "review");
  assert.equal(calls, 0);
  assert.deepEqual(outcomes, [{ status: "failed", category: "validation" }]);
  const throwingObserver = () => { throw Error("analytics unavailable"); };
  assert.deepEqual(await createLeadSubmitter(async () => Response.json({ accepted: true }), () => "id", throwingObserver)({}, "website"), { accepted: true });
  assert.ok("error" in await createLeadSubmitter(async () => { throw Error("network"); }, () => "id", throwingObserver)({}, "website"));
});

test("pending duplicate submissions cannot emit acceptance before confirmation or duplicate tracking", async () => {
  let release!: (response: Response) => void;
  const outcomes: LeadOutcome[] = [];
  const submit = createLeadSubmitter(async () => new Promise<Response>((resolve) => { release = resolve; }), () => "id", (value) => outcomes.push(value));
  const first = submit({}, "review");
  assert.deepEqual(await submit({}, "review"), { busy: true });
  assert.equal(outcomes.length, 0);
  release(Response.json({ accepted: true })); await first;
  assert.deepEqual(outcomes, [{ status: "accepted" }]);
});

test("campaign allowlist is bounded and sanitized; first campaign survives navigation/reload using only tab-session storage", () => {
  assert.deepEqual(sanitizeCampaign({ utm_source: "business-card", utm_medium: "qr", utm_campaign: "local_2026", utm_content: "batch-a", email: "secret" }),
    { utm_source: "business-card", utm_medium: "qr", utm_campaign: "local_2026", utm_content: "batch-a" });
  for (const value of ["a".repeat(65), "owner@example.com", "https://restaurant.com", "private message", "line\nbreak", {}, ["qr"]]) {
    assert.deepEqual(sanitizeCampaign({ utm_source: value }), {});
  }
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const first = harness(() => true, storage);
  first.analytics.visit("/", "?utm_source=card&utm_medium=qr&utm_campaign=local&email=private@example.com&utm_content=owner%40example.com");
  first.analytics.visit("/work", "?utm_source=other");
  first.analytics.track({ name: "marketing_form_started", form_type: "website_review" }, "/work");
  assert.ok(first.events.every((event) => event.properties.utm_source === "card"));
  assert.doesNotMatch(JSON.stringify([...data]), /email|private|owner|other|distinct/);
  const reload = harness(() => true, storage); reload.analytics.visit("/services");
  assert.equal(reload.events[0].properties.utm_source, "card");
  const duplicate = harness(); duplicate.analytics.visit("/", "?utm_source=a&utm_source=b");
  assert.equal(duplicate.events[0].properties.utm_source, undefined);
});

test("opt-out suppresses events and clears campaign data; blocked storage and failed sinks never interfere", () => {
  const removed: string[] = [];
  const blocked = harness(() => false, { getItem: () => { throw Error(); }, setItem: () => { throw Error(); }, removeItem: (key) => { removed.push(key); } });
  blocked.analytics.visit("/"); blocked.analytics.track({ name: "marketing_form_opened", form_type: "website_review" }, "/");
  assert.equal(blocked.events.length, 0); assert.equal(removed.length, 2);
  const memory = harness(() => true, { getItem: () => { throw Error(); }, setItem: () => { throw Error(); }, removeItem: () => {} });
  memory.analytics.visit("/", "?utm_source=card"); memory.analytics.visit("/work");
  assert.equal(memory.events[1].properties.utm_source, "card");
  const broken = createMarketingAnalytics(() => { throw Error(); }, () => true);
  assert.doesNotThrow(() => broken.visit("/"));
  assert.doesNotThrow(() => broken.track({ name: "marketing_email_clicked", placement: "footer" }, "/"));
  assert.doesNotThrow(() => createMarketingFormAnalytics("website_review", () => { throw Error(); }).open());
});

test("PostHog initialization and final outbound filter preserve restaurant events while removing automatic marketing URL/PII properties", () => {
  const captures: Array<{ event: string; properties: Record<string, unknown> }> = [];
  let config: Record<string, unknown> = {};
  let optedOut = false;
  const sdk = { __loaded: false, has_opted_out_capturing: () => optedOut,
    init(_key: string, settings: Record<string, unknown>) { config = settings; this.__loaded = true; },
    capture(event: string, properties: Record<string, unknown>) {
      const before = config.before_send as (event: { event: string; properties: Record<string, unknown> } | null) => { event: string; properties: Record<string, unknown> } | null;
      const result = before({ event, properties: { ...properties, token: "test-token", distinct_id: "anonymous", "$current_url": "https://site/?email=private@example.com", "$referrer": "https://private.example/", "$set_once": { "$initial_current_url": "private URL" }, "$initial_person_info": { email: "private@example.com" } } });
      if (result) captures.push(result);
    },
  };
  const source = readFileSync("src/lib/analytics/posthog.ts", "utf8");
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  const exports: { initializePostHog?: () => void; captureMarketingEvent?: (name: string, properties: Record<string, unknown>) => void; posthogProvider?: { track(event: unknown): void } } = {};
  runInNewContext(compiled, { exports, process: { env: { NEXT_PUBLIC_POSTHOG_KEY: "mock", NEXT_PUBLIC_POSTHOG_HOST: "https://mock.invalid", NEXT_PUBLIC_VERCEL_ENV: "preview" } }, require(id: string) {
    if (id === "posthog-js") return { default: sdk };
    if (id === "./marketing") return { marketingEnvironment, sanitizeMarketingCapture };
    throw Error(id);
  } });
  exports.captureMarketingEvent!("$pageview", {}); assert.equal(captures.length, 0);
  exports.initializePostHog!(); exports.initializePostHog!();
  for (const name of ["autocapture", "capture_pageview", "capture_pageleave", "save_campaign_params", "save_referrer"]) assert.equal(config[name], false);
  assert.equal(config.disable_session_recording, true); assert.equal(config.person_profiles, "never"); assert.equal(config.persistence, "memory");
  exports.captureMarketingEvent!("$pageview", { analytics_scope: "marketing", page: "/", utm_source: "card" });
  assert.deepEqual(JSON.parse(JSON.stringify(captures[0])), { event: "$pageview", properties: { token: "test-token", distinct_id: "anonymous", analytics_scope: "marketing", environment: "staging", page: "/", utm_source: "card" } });
  assert.doesNotMatch(JSON.stringify(captures[0]), /private|url|referrer|email|\$set/);
  optedOut = true; exports.captureMarketingEvent!("$pageview", {}); assert.equal(captures.length, 1);
  optedOut = false; exports.posthogProvider!.track({ name: "page_view", restaurantId: "tenant" });
  assert.equal(captures[1].event, "page_view"); assert.equal(captures[1].properties.restaurant_id, "tenant");
  const restaurant = { properties: { restaurant_id: "tenant", query: "tacos" } };
  assert.equal(sanitizeMarketingCapture(restaurant), restaurant);
});

test("UI wiring uses one delegated click listener and pathname effects; lead success never comes from a click", () => {
  const tracker = readFileSync("src/app/MarketingAnalytics.tsx", "utf8");
  assert.match(tracker, /usePathname/); assert.match(tracker, /\[pathname\]/);
  assert.match(tracker, /addEventListener\("click", clicked, true\)/); assert.match(tracker, /removeEventListener\("click", clicked, true\)/);
  assert.doesNotMatch(tracker, /searchParams|\.href|\.textContent|\.value/);
  const hook = readFileSync("src/app/MarketingLeadForm.tsx", "utf8");
  assert.match(hook, /type === "website"\) open\(\)/);
  assert.match(hook, /key !== "companyFax" && value.trim\(\)/);
  assert.match(hook, /outcome.status === "accepted"/);
  assert.doesNotMatch(hook, /trackMarketing\([^\n]*(values|emailHref|error:)/);
  const interactions = readFileSync("src/app/MarketingInteractions.tsx", "utf8");
  assert.match(interactions, /if \(openedRef.current\) return/); assert.match(interactions, /trackOpen\(\)/); assert.match(interactions, /trackClose\(\)/);
});
