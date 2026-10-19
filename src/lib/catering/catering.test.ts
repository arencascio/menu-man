import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { inquirySchema, cateringSettingsSchema, eventDateAllowed } from "./contracts";
import { createInquiryHandler, CateringError, cateringSource, boundedJson } from "./handler";
import { sanitizeRestaurantCapture, restaurantPageType } from "../analytics/restaurant";
import { createClient } from "@supabase/supabase-js";

const valid = {
  submissionId: "a1b2c3d4-1111-4111-8111-123456789012", name: "Test Customer", email: "test@example.invalid", phone: "",
  eventDate: "2027-06-20", guestCount: 30, eventDetails: "Test event", notes: "Test notes", companyFax: "",
};
function request(input: unknown = valid, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/restaurants/tenant-a/catering", {
    method: "POST", headers: { origin: "http://localhost", "content-type": "application/json", ...headers }, body: typeof input === "string" ? input : JSON.stringify(input),
  });
}
test("inquiry validation requires name, a real date, whole guests, and at least one valid contact", () => {
  assert.equal(inquirySchema.safeParse(valid).success, true);
  assert.equal(inquirySchema.safeParse({ ...valid, email: "", phone: "+1 (555) 123-4567" }).success, true);
  for (const bad of [{ name: " " }, { email: "", phone: "" }, { email: "invalid" }, { phone: "abc1234567" }, { eventDate: "2027-02-30" }, { guestCount: 1.5 }, { guestCount: 0 }, { guestCount: 100001 }, { notes: "x".repeat(2001) }, { restaurantId: "other-tenant" }]) {
    assert.equal(inquirySchema.safeParse({ ...valid, ...bad }).success, false, JSON.stringify(bad).slice(0, 80));
  }
});
test("settings default disabled and require accessible safe media", () => {
  assert.equal(cateringSettingsSchema.parse({}).enabled, false);
  assert.equal(cateringSettingsSchema.safeParse({ imageUrl: "javascript:alert(1)", imageAlt: "x" }).success, false);
  assert.equal(cateringSettingsSchema.safeParse({ imageUrl: "//example.invalid/x.jpg", imageAlt: "x" }).success, false);
  assert.equal(cateringSettingsSchema.safeParse({ imageUrl: "/img/photo.jpg", imageAlt: "" }).success, false);
  assert.equal(cateringSettingsSchema.safeParse({ imageUrl: "/img/photo.jpg", imageAlt: "Test photo" }).success, true);
});
test("event dates use restaurant timezone instead of browser/UTC midnight", () => {
  const now = new Date("2026-10-19T01:00:00Z");
  assert.equal(eventDateAllowed("2026-10-18", "America/Los_Angeles", now), true);
  assert.equal(eventDateAllowed("2026-10-17", "America/Los_Angeles", now), false);
  assert.equal(eventDateAllowed("2026-10-18", "UTC", now), false);
});
test("public handler rejects cross-origin, traps, invalid, oversized and malformed submissions without storage", async () => {
  let writes = 0;
  const handler = createInquiryHandler({ submit: async () => { writes++; return { replayed: false }; } });
  for (const [req, status] of [
    [request(valid, { origin: "https://evil.invalid" }), 403],
    [request({ ...valid, companyFax: "bot" }), 400], [request({ ...valid, email: "bad" }), 400],
    [request("{"), 400], [request("x".repeat(16385)), 413], [request(valid, { "content-type": "text/plain" }), 415],
    [request(valid, { "content-type": "application/json-fake" }), 415],
  ] as const) assert.equal((await handler(req, "tenant-a")).status, status);
  assert.equal(writes, 0);
});
test("stalled request bodies have a deadline and cancel the stream without accepting data", async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  const stalled = new Request("http://localhost/catering", { method: "POST", body, duplex: "half", headers: { "content-type": "application/json" } } as RequestInit & { duplex: string });
  await assert.rejects(boundedJson(stalled, 10), (error: unknown) => error instanceof CateringError && error.status === 408);
  assert.equal(cancelled, true);
});
test("chosen submission IDs and tenant slugs cannot allocate limiter buckets or bypass per-source attempts", async () => {
  let writes = 0;
  const handler = createInquiryHandler({ sourceSecret: "test-only", vercelEnvironment: "preview", submit: async () => { writes++; return { replayed: false }; } });
  for (let index = 0; index < 6; index++) {
    const req = request({ ...valid, submissionId: `a1b2c3d4-1111-4111-8111-${String(index).padStart(12, "0")}` }, { "x-vercel-forwarded-for": "192.0.2.10" });
    assert.equal((await handler(req, `tenant-${index}`)).status, index < 5 ? 200 : 429);
  }
  assert.equal(writes, 5);
  assert.equal((await handler(request(valid, { "x-vercel-forwarded-for": "192.0.2.11" }), "another-tenant")).status, 200);
});
test("public handler preserves tenant slug, submission ID and safe response on exact retry", async () => {
  let seen = false;
  const handler = createInquiryHandler({ submit: async (slug, input) => {
    assert.equal(slug, "tenant-a"); assert.equal(input.submissionId, valid.submissionId);
    const replayed = seen; seen = true; return { replayed };
  } });
  const first = await handler(request(), "tenant-a");
  assert.deepEqual(await first.json(), { accepted: true, replayed: false });
  assert.match(first.headers.get("cache-control")!, /no-store/);
  assert.deepEqual(await (await handler(request(), "tenant-a")).json(), { accepted: true, replayed: true });
});
test("handler never claims acceptance on quota, disabled tenant, idempotency conflict, or storage failure", async () => {
  for (const status of [404, 409, 429, 503]) {
    const handler = createInquiryHandler({ submit: async () => { throw new CateringError(status, "Safe failure"); } });
    const response = await handler(request(), "tenant-a");
    assert.equal(response.status, status);
    assert.equal((await response.json()).accepted, undefined);
  }
  const handler = createInquiryHandler({ submit: async () => { throw new Error("PRIVATE_DATABASE_ERROR"); } });
  assert.doesNotMatch(await (await handler(request(), "tenant-a")).text(), /PRIVATE_DATABASE_ERROR/);
});
test("source limiter ignores spoofed local IP and produces only secret-keyed tenant hashes", () => {
  const req = request(valid, { "x-vercel-forwarded-for": "192.0.2.10" });
  const other = request(valid, { "x-vercel-forwarded-for": "192.0.2.11" });
  assert.equal(cateringSource(req, "a", "secret"), cateringSource(other, "a", "secret"));
  assert.notEqual(cateringSource(req, "a", "secret", "preview"), cateringSource(other, "a", "secret", "preview"));
  assert.notEqual(cateringSource(req, "a", "secret", "preview"), cateringSource(req, "b", "secret", "preview"));
  assert.match(cateringSource(req, "a", "secret", "preview"), /^[0-9a-f]{64}$/);
});
test("the installed Supabase RPC transport obeys an abort deadline without making any network request", async () => {
  let called = false;
  const client = createClient("http://127.0.0.1:54321", "offline-placeholder", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (_url, init) => {
      called = true;
      const signal = init?.signal;
      assert.ok(signal);
      await new Promise<never>((_resolve, reject) => {
        if (signal.aborted) { reject(signal.reason); return; }
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
      throw new Error("Unreachable mocked transport");
    } },
  });
  const keepAlive = setTimeout(() => undefined, 1000);
  try {
    const { data, error } = await client.rpc("submit_catering_inquiry_v1", {}).abortSignal(AbortSignal.timeout(10));
    assert.equal(called, true); assert.equal(data, null); assert.ok(error);
  } finally { clearTimeout(keepAlive); }
});
test("catering analytics accept only bounded engagement with no customer or event details", () => {
  assert.equal(restaurantPageType("/r/test/catering?email=PRIVATE"), "catering");
  for (const event of ["page_view", "catering_form_started", "catering_inquiry_accepted"]) {
    const result = sanitizeRestaurantCapture({ event, properties: {
      analytics_scope: "restaurant", restaurant_id: "tenant-a", environment: "staging", page_type: "catering", surface: "catering",
      name: "PRIVATE", email: "PRIVATE", phone: "PRIVATE", notes: "PRIVATE", event_date: "PRIVATE", guest_count: "PRIVATE", inquiry_id: "PRIVATE",
    } });
    assert.ok(result); assert.doesNotMatch(JSON.stringify(result), /PRIVATE|guest_count|event_date|inquiry_id/);
  }
});
test("migration denies direct inquiry access and scopes every management RPC to the checked tenant", () => {
  const sql = readFileSync("supabase/migrations/202610190001_catering_inquiries_v1.sql", "utf8");
  for (const table of ["restaurant_catering_settings", "catering_inquiries", "catering_submission_windows"]) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(sql, /revoke all on public\.restaurant_catering_settings, public\.catering_inquiries, public\.catering_submission_windows from public, anon, authenticated, service_role/);
  const managedNames = ["get_managed_catering_settings_v1", "update_managed_catering_settings_v1", "list_managed_catering_inquiries_v1", "update_managed_catering_inquiry_v1"];
  for (const name of managedNames) {
    const body = sql.split(`create function public.${name}`)[1].split("$$;")[0];
    assert.match(body, /security definer set search_path = ''/);
    assert.match(body, /private\.require_restaurant_capability_v1\(p_restaurant_slug, 'manage_catering'\)/);
    assert.match(body, /access_record\.restaurant_id/);
  }
  assert.match(sql, /\('manager', 'manage_catering', false\), \('staff', 'manage_catering', false\)/);
  assert.match(sql, /submit_catering_inquiry_v1[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /insert into public\.restaurant_catering_settings[^;]*select[^;]*restaurants/);
});
test("migration exact replay precedes durable quotas and never reissues a notification recipient", () => {
  const sql = readFileSync("supabase/migrations/202610190001_catering_inquiries_v1.sql", "utf8");
  const submit = sql.split("create function public.submit_catering_inquiry_v1")[1].split("$$;")[0];
  assert.match(submit, /pg_advisory_xact_lock/);
  assert.ok(submit.indexOf("if existing.request_hash <> fingerprint") < submit.indexOf("insert into public.catering_submission_windows"));
  assert.match(submit, /return jsonb_build_object\('id', existing.id, 'replayed', true\)/);
  assert.match(submit, /then 60 else 5/);
  assert.match(submit, /MM_CATERING_RATE_LIMITED/);
  assert.match(submit, /config->>'enabled'/);
  for (const name of ["submit_catering_inquiry_v1", "update_managed_catering_settings_v1", "update_managed_catering_inquiry_v1", "complete_catering_notification_v1"]) {
    assert.match(sql.split(`create function public.${name}`)[1].split("$$;")[0], /set lock_timeout = '2s'/);
  }
});
