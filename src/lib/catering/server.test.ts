import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as zod from "zod";
import * as contracts from "./contracts";
import * as handler from "./handler";

type Server = typeof import("./server");
class AccessError extends Error { constructor(public code: string, message: string) { super(message); } }
const tenantId = "a1b2c3d4-1111-4111-8111-123456789012";
function load(options: { authenticated?: boolean; rpcError?: string; replayed?: boolean; recipient?: string; emailConfigured?: boolean; send?: boolean; providerId?: string; restricted?: boolean; publicSettings?: unknown; publicError?: boolean; completionThrows?: boolean } = {}) {
  const calls: { identity: string; name: string; args: Record<string, unknown> }[] = [];
  const deadlines: number[] = [];
  let emailCount = 0;
  const rpc = (identity: string) => (name: string, args: Record<string, unknown>) => ({ abortSignal: async (signal: AbortSignal) => {
    assert.ok(signal instanceof AbortSignal);
    calls.push({ identity, name, args });
    if (name === "complete_catering_notification_v1" && options.completionThrows) throw new Error("PRIVATE_COMPLETION_FAILURE");
    if (options.rpcError) return { data: null, error: { message: options.rpcError } };
    if (name === "submit_catering_inquiry_v1") return { error: null, data: { id: tenantId, replayed: options.replayed ?? false, notificationRecipient: options.recipient ?? null } };
    if (name === "list_managed_catering_inquiries_v1") return { data: [], error: null };
    if (name === "get_managed_catering_settings_v1") return { data: {}, error: null };
    return { data: null, error: null };
  } });
  const modules: Record<string, unknown> = {
    "server-only": {}, react: { cache: (value: unknown) => value }, zod,
    "@/lib/supabase/server": { supabaseServer: { rpc: rpc("service-role"), from: () => ({ select: () => ({ eq: () => ({ abortSignal: (signal: AbortSignal) => ({ maybeSingle: async () => {
      assert.ok(signal instanceof AbortSignal);
      if (options.publicError) throw new Error("PRIVATE_CONFIG_TIMEOUT");
      return { data: options.publicSettings === undefined ? null : { settings: options.publicSettings }, error: null };
    } }) }) }) }) } },
    "@/lib/order-management/server": { ManagementError: AccessError, authenticatedClient: async () => {
      if (options.authenticated === false) throw new AccessError("UNAUTHENTICATED", "Sign in");
      return { rpc: rpc("authenticated-user") };
    } },
    "@/lib/public-restaurant-access": { isRestaurantPublicationRestricted: () => options.restricted === true },
    "@/lib/notifications/resend": { sendResendEmail: async (_key: string, email: Record<string, unknown>) => {
      emailCount++; assert.doesNotMatch(JSON.stringify(email), /PRIVATE_CUSTOMER/);
      return { succeeded: options.send !== false, providerMessageId: options.providerId ?? "offline-provider-id" };
    } },
    "./contracts": contracts, "./handler": handler,
  };
  const exported = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("src/lib/catering/server.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports: exported,
    require: (name: string) => { assert.ok(Object.hasOwn(modules, name), name); return modules[name]; },
    process: { env: { SUPABASE_SERVICE_ROLE_KEY: "offline-test-secret", VERCEL_ENV: "preview", ...(options.emailConfigured ? { RESEND_API_KEY: "offline-test-key", MENU_MAN_ORDER_EMAIL_FROM: "qa@example.invalid" } : {}) } },
    URL, AbortSignal: { timeout: (ms: number) => { deadlines.push(ms); return AbortSignal.timeout(ms); } },
  });
  return { api: exported as Server, calls, deadlines, emailCount: () => emailCount };
}
const input: contracts.InquiryInput = { submissionId: tenantId, name: "PRIVATE_CUSTOMER", email: "test@example.invalid", phone: "", eventDate: "2027-06-20", guestCount: 30, eventDetails: "PRIVATE_CUSTOMER", notes: "PRIVATE_CUSTOMER", companyFax: "" };
const request = () => new Request("http://localhost/api/restaurants/tenant-a/catering");

test("managed catering RPCs use authenticated user sessions, never service-role authority", async () => {
  const { api, calls } = load();
  await api.getManagedCateringSettings("tenant-a");
  await api.listCateringInquiries("tenant-a");
  await api.updateCateringInquiry("tenant-a", tenantId, "contacted", "new");
  await api.deleteCateringInquiry("tenant-a", tenantId, "closed");
  assert.equal(calls.every((call) => call.identity === "authenticated-user" && call.args.p_restaurant_slug === "tenant-a"), true);
  const denied = load({ authenticated: false });
  await assert.rejects(denied.api.listCateringInquiries("tenant-a"), /Sign in/);
  assert.equal(denied.calls.length, 0);
});
test("cross-tenant RPC denial propagates without querying through service-role or exposing PII", async () => {
  const { api, calls } = load({ rpcError: "MM_MANAGEMENT_FORBIDDEN|PRIVATE_CUSTOMER" });
  await assert.rejects(api.listCateringInquiries("tenant-b"), (error: unknown) => error instanceof AccessError && error.code === "FORBIDDEN" && !error.message.includes("PRIVATE_CUSTOMER"));
  assert.equal(calls.length, 1); assert.equal(calls[0].identity, "authenticated-user");
  await assert.rejects(api.deleteCateringInquiry("tenant-b", tenantId, "closed"), (error: unknown) => error instanceof AccessError && error.code === "FORBIDDEN");
  assert.equal(calls.at(-1)?.identity, "authenticated-user");
});

test("deleted submission replay reports gone without recreating acceptance", async () => {
  const local = load({ rpcError: "MM_CATERING_DELETED" });
  await assert.rejects(local.api.submitCateringInquiry("tenant-a", input, request()), (error: unknown) => error instanceof handler.CateringError && error.status === 410);
  assert.equal(local.calls.length, 1); assert.equal(local.emailCount(), 0);
});
test("stored inquiry succeeds when notification configuration is missing or delivery fails", async () => {
  for (const settings of [{ emailConfigured: false }, { emailConfigured: true, send: false }]) {
    const local = load({ ...settings, recipient: "owner@example.invalid" });
    assert.equal((await local.api.submitCateringInquiry("tenant-a", input, request())).replayed, false);
    assert.equal(local.calls.at(-1)?.args.p_status, settings.emailConfigured ? "failed" : "not_configured");
  }
});
test("exact retries do not trigger owner email again; notification content omits customer details", async () => {
  for (const replayed of [false, true]) {
    const local = load({ replayed, recipient: "owner@example.invalid", emailConfigured: true });
    await local.api.submitCateringInquiry("tenant-a", input, request());
    assert.equal(local.emailCount(), replayed ? 0 : 1);
    assert.equal(local.calls[0].args.p_restaurant_slug, "tenant-a");
    assert.match(String(local.calls[0].args.p_source_hash), /^[0-9a-f]{64}$/);
  }
});
test("publication restriction prevents submission before any database operation", async () => {
  const local = load({ restricted: true });
  await assert.rejects(local.api.submitCateringInquiry("armandos", input, request()), /unavailable/);
  assert.equal(local.calls.length, 0);
});
test("missing and malformed public configuration hides catering; explicit valid configuration enables it", async () => {
  for (const settings of [undefined, { enabled: "yes" }, { enabled: true, imageUrl: "javascript:alert(1)" }]) {
    assert.equal((await load({ publicSettings: settings }).api.getPublicCateringSettings(tenantId)).enabled, false);
  }
  assert.equal((await load({ publicSettings: { enabled: true } }).api.getPublicCateringSettings(tenantId)).enabled, true);
});
test("notification recipient accepted by the existing SQL email check cannot invalidate an already stored lead", async () => {
  // The existing SQL regex accepts this address; Zod/Resend validation rejects it.
  const local = load({ recipient: "a..b@example.com", emailConfigured: true });
  assert.equal((await local.api.submitCateringInquiry("tenant-a", input, request())).replayed, false);
  assert.equal(local.emailCount(), 0);
  assert.equal(local.calls.at(-1)?.args.p_status, "not_configured");
});
test("post-commit notification completion failure preserves successful storage response", async () => {
  const local = load({ recipient: "owner@example.invalid", completionThrows: true });
  assert.equal((await local.api.submitCateringInquiry("tenant-a", input, request())).replayed, false);
  assert.deepEqual(local.deadlines, [8000, 2000]);
});
test("configuration and management RPCs have explicit deadlines; config failures hide the feature", async () => {
  const local = load({ publicError: true });
  assert.equal((await local.api.getPublicCateringSettings(tenantId)).enabled, false);
  await local.api.listCateringInquiries("tenant-a");
  assert.deepEqual(local.deadlines, [2000, 8000]);
});
test("database abort responses never claim successful acceptance or expose error details", async () => {
  const local = load({ rpcError: "AbortError PRIVATE_CUSTOMER" });
  const submit = handler.createInquiryHandler({ submit: local.api.submitCateringInquiry });
  const req = new Request("http://localhost/api/restaurants/tenant-a/catering", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify(input) });
  const response = await submit(req, "tenant-a");
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /PRIVATE_CUSTOMER|accepted/);
});
test("a malformed provider success without a message ID is not reported as provider accepted", async () => {
  const local = load({ recipient: "owner@example.invalid", emailConfigured: true, providerId: "" });
  await local.api.submitCateringInquiry("tenant-a", input, request());
  assert.equal(local.calls.at(-1)?.args.p_status, "failed");
});
