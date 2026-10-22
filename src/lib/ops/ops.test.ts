import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { verifyOpsAccess, OpsError, opsEnabled } from "./access";
import { mutateOpsLead } from "./actions";
import { mutationSchema, querySchema } from "./contracts";
import { sameOrigin, boundedBody, opsFailure } from "./http";
import { pacificInput, pacificToUtc } from "./pacific-time";
import { memoryLeadStore } from "../marketing-leads/test-store";
import { leadSchema } from "../marketing-leads/contracts";

const id = "20000000-0000-4000-8000-000000000999";
test("Pacific follow-up input stores UTC across standard and daylight time", () => {
  assert.equal(pacificToUtc("2026-01-15T09:30"), "2026-01-15T17:30:00.000Z");
  assert.equal(pacificToUtc("2026-07-15T09:30"), "2026-07-15T16:30:00.000Z");
  assert.equal(pacificInput("2026-07-15T16:30:00.000Z"), "2026-07-15T09:30");
  assert.equal(pacificToUtc(""), null);
  assert.throws(() => pacificToUtc("2026-03-08T02:30"), /does not exist/);
  assert.throws(() => pacificToUtc("2026-11-01T01:30"), /occurs twice/);
  assert.equal(pacificToUtc("2026-11-01T01:30", "2026-11-01T08:30:00.000Z"), "2026-11-01T08:30:00.000Z");
});
test("ops authentication fails closed before any owner/lead query; explicit owner authorization is required", async () => {
  let calls = 0;
  const access = async () => { calls++; return "authorized"; };
  for (const [enabled, user, status] of [[false, null, 404], [true, null, 401]] as const) {
    await assert.rejects(verifyOpsAccess({ enabled, user: async () => user, access }), error => error instanceof OpsError && error.status === status);
  }
  assert.equal(calls, 0);
  for (const [result, status] of [["denied", 403], ["mfa_required", 428], [undefined, 403]]) {
    await assert.rejects(verifyOpsAccess({ enabled: true, user: async () => ({ id }), access: async () => result }), error => error instanceof OpsError && error.status === status);
  }
  assert.equal(await verifyOpsAccess({ enabled: true, user: async () => ({ id }), access }), id);
  assert.equal(opsEnabled({}), false); assert.equal(opsEnabled({ MENU_MAN_OPS_ENABLED: "1" }), false);
});
test("owner mutations validate exact fields and bounded dates, notes and revisions", async () => {
  const valid = { action: "save", revision: 1, status: "waiting", notes: "Owner notes", followUpAt: "2026-10-22T18:00:00.000Z" };
  const updates: unknown[] = [];
  const notifications = memoryLeadStore().store;
  assert.deepEqual(await mutateOpsLead(id, valid, { update: async args => { updates.push(args); }, notifications }), { saved: true });
  assert.deepEqual(updates, [{ p_lead_id: id, p_revision: 1, p_status: "waiting", p_notes: "Owner notes", p_follow_up_at: valid.followUpAt }]);
  for (const input of [{ ...valid, status: "published" }, { ...valid, notes: "x".repeat(8001) }, { ...valid, revision: 0 },
    { ...valid, followUpAt: "tomorrow" }, { ...valid, actor: id }, { action: "retry", resetLimit: true }]) {
    await assert.rejects(mutateOpsLead(id, input, { update: async () => { throw Error("Unexpected write"); }, notifications }), OpsError);
  }
  assert.equal(mutationSchema.safeParse({ ...valid, followUpAt: null }).success, true);
  assert.deepEqual(querySchema.parse({}), { view: "open", status: "all", type: "all", sort: "newest", page: 1 });
});
test("retry reuses stored email/key and exclusive claim; provider failure leaves the lead and safe outcome", async () => {
  const memory = memoryLeadStore();
  const lead = leadSchema.parse({ type: "website", submissionId: id, restaurantName: "Synthetic", email: "synthetic@example.com", help: "Website" });
  const leadId = await memory.store.persist(lead, { attribution: {} }, "Menu Man <hello@getmenuman.com>");
  let sends = 0;
  const options = { update: async () => {}, notifications: memory.store, apiKey: "mock", fetcher: async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    sends++; assert.equal(new Headers(init?.headers).get("Idempotency-Key"), `marketing-lead/${id}`);
    const message = JSON.parse(String(init?.body)); assert.equal(message.reply_to, lead.email);
    return Response.json({ name: "private PII credential" }, { status: 503 });
  } };
  assert.deepEqual(await mutateOpsLead(leadId, { action: "retry" }, options), { saved: true, notification: "retryable" });
  await assert.rejects(mutateOpsLead(leadId, { action: "retry" }, options), error => error instanceof OpsError && error.status === 409);
  assert.equal(sends, 1); assert.equal(memory.leads.size, 1);
  assert.doesNotMatch(JSON.stringify([...memory.outcomes.values()]), /PII|credential|synthetic@example/);
  await assert.rejects(mutateOpsLead(leadId, { action: "retry" }, { ...options, apiKey: undefined }), error => error instanceof OpsError && error.status === 503);
});
test("mutation origin/body limits and errors expose no credentials or raw exception", async () => {
  const request = (origin: string) => new Request("https://getmenuman.com/ops/leads/id/actions", { method: "POST", headers: { origin }, body: "x".repeat(100) });
  assert.throws(() => sameOrigin(request("https://attacker.example")), OpsError);
  assert.doesNotThrow(() => sameOrigin(request("https://getmenuman.com")));
  await assert.rejects(boundedBody(request("https://getmenuman.com"), 20), OpsError);
  const response = opsFailure(Error("credential and private notes"));
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.doesNotMatch(await response.text(), /credential|private notes/);
});
test("owner pages, RPC paths, cache headers and metadata have no public/service-role shortcut", () => {
  const server = readFileSync("src/lib/ops/server.ts", "utf8");
  assert.match(server, /import "server-only"/); assert.match(server, /auth\.getUser\(/);
  assert.match(server, /get_ops_access_v1/); assert.doesNotMatch(server, /SERVICE_ROLE|user_metadata|supabaseServer|unstable_cache/);
  const action = readFileSync("src/app/ops/leads/[id]/actions/route.ts", "utf8");
  assert.match(action, /sameOrigin\(request\)/); assert.match(action, /await opsClient\(\)/);
  const layout = readFileSync("src/app/ops/layout.tsx", "utf8");
  assert.match(layout, /force-dynamic/); assert.doesNotMatch(layout, /restaurantName|email|internal_notes/);
  const proxy = readFileSync("src/proxy.ts", "utf8");
  assert.match(proxy, /isProductionManagementDisabled\(\) && isManagementOnlyPath/);
  assert.match(proxy, /MENU_MAN_OPS_ENABLED !== "true"/);
  const auth = readFileSync("src/lib/ops/auth-http.ts", "utf8");
  assert.match(auth, /challengeAndVerify/); assert.doesNotMatch(auth, /activate_my_restaurant|signInWithOtp|console\.|signUp/);
});
