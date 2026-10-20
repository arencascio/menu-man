import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as policy from "./policy";
import * as contracts from "../payments/contracts";
import * as runtime from "../payments/runtime";
import * as state from "../payments/state";
import * as views from "../payments/view-contracts";
import * as webhook from "../payments/providers/square/webhook";
import { SquarePaymentProviderAdapter } from "../payments/providers/square/adapter";
import type { SquareGateway } from "../payments/providers/square/client";
import type { SquareSandboxConfig } from "../payments/providers/square/config";
import { acknowledgeStoredPaymentWebhook } from "../payments/webhook-acknowledgement";

// Execute the application modules, replacing only external I/O and server-only.
// Each VM owns its environment; no process credentials or real clients are used.
function load<T>(path: string, modules: Record<string, unknown>, env: Record<string, string>) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, process: { env }, console, Buffer, Response, Headers, setTimeout, clearTimeout,
    require(name: string) {
      if (!(name in modules)) throw new Error(`Unmocked dependency: ${name}`);
      return modules[name];
    },
    fetch() { throw new Error("Network forbidden in integration tests"); },
  });
  return exports as T;
}

const enabled = {
  MENU_MAN_ENV: "staging", VERCEL_ENV: "preview", MENU_MAN_ENABLE_PUBLIC_DEMO_PAYMENTS: "true",
  MENU_MAN_ENABLE_SQUARE_SANDBOX: "true", NEXT_PUBLIC_SUPABASE_URL: "https://jjvongzvtnzlvwdfcnjk.supabase.co",
  SQUARE_API_VERSION: "2026-08-19", SQUARE_DEMO_SANDBOX_APPLICATION_ID: "demo-app",
  SQUARE_DEMO_SANDBOX_ACCESS_TOKEN: "synthetic-unused-token", SQUARE_DEMO_SANDBOX_MERCHANT_ID: "demo-merchant",
  SQUARE_DEMO_SANDBOX_LOCATION_ID: "demo-location", SQUARE_DEMO_SANDBOX_WEBHOOK_SIGNATURE_KEY: "synthetic-signature-key",
  SQUARE_DEMO_SANDBOX_WEBHOOK_NOTIFICATION_URL: "https://preview.invalid/api/webhooks/payments/square/demo-sandbox",
};
const connectionId = "20000000-0000-4000-8000-000000000900";
const attemptId = "20000000-0000-4000-8000-000000001003";
const demoRow = {
  id: connectionId, restaurant_id: policy.SUPER_TACOS_ID, provider_key: "square", environment: "sandbox",
  provider_account_reference: "demo-merchant", provider_metadata: { publicDemo: true, locationId: "demo-location" },
};
type Row = Record<string, unknown>;
type DemoServer = {
  isDemoPaymentConnection(id: string): Promise<boolean>;
  verifyDemoCheckoutConfiguration(): Promise<void>;
};
type PaymentServer = {
  acceptPaymentWebhook(provider: string, body: string, headers: Headers, demoOnly: boolean): Promise<unknown>;
  processDuePaymentEvents(provider: string): Promise<unknown>;
  getPaymentSession(order: string, token: string): Promise<{ browserSession: unknown }>;
  submitPayment(order: string, token: string, key: string, source: string): Promise<unknown>;
};

function harness(row: Row | null = demoRow, env: Record<string, string> = enabled, lookupError = false) {
  const reads: { table: string; filters: Row }[] = [];
  const calls: { name: string; args: Row }[] = [];
  const gatewayCalls: Row[] = [];
  const tables: Record<string, Row[]> = {
    restaurant_payment_connections: row ? [row] : [],
    payment_provider_references: [{ provider_key: "square", environment: "sandbox", reference_kind: "location", external_id: "demo-location", connection_id: connectionId }],
    payment_attempts: [{ id: attemptId, connection_id: connectionId, provider_payment_reference: "sandbox-payment" }],
    refunds: [{ id: attemptId, connection_id: connectionId, provider_refund_reference: "sandbox-refund" }],
  };
  const provider = row?.provider_key === "fake" ? "fake" : "square";
  const status = {
    paymentId: "20000000-0000-4000-8000-000000001001", orderId: "20000000-0000-4000-8000-000000001002",
    connectionId, provider, providerEnvironment: provider === "fake" ? "test" : "sandbox",
    status: "requires_payment_method", orderStatus: "pending_payment", paymentStatus: "unpaid", captureMode: "automatic",
    amountCents: 595, currency: "USD", paymentDueAt: "2026-10-20T20:00:00Z", paidAt: null, latestAttempt: null,
  };
  const db = {
    from(table: string) {
      assert.ok(table in tables, `Unexpected table: ${table}`);
      const filters: Row = {};
      let fields = "";
      const query = {
        select(selected: string) { fields = selected; return query; },
        eq(key: string, value: unknown) { filters[key] = value; return query; },
        async single() {
          reads.push({ table, filters: { ...filters } });
          const data = tables[table].find(item => Object.entries(filters).every(([key, value]) => item[key] === value)) ?? null;
          const denied = lookupError && fields.includes("restaurant_id");
          return { data: denied ? null : data, error: denied ? { message: "lookup denied" } : null };
        },
        maybeSingle() { return query.single(); },
      };
      return query;
    },
    async rpc(name: string, args: Row) {
      calls.push({ name, args });
      if (name === "authorize_payment_session_v1") return { data: status, error: null };
      if (name === "reserve_payment_attempt_v1") return { data: {
        attemptId, paymentId: status.paymentId, connectionId, provider, providerEnvironment: status.providerEnvironment,
        providerIdempotencyKey: "authoritative-key", amountCents: 595, currency: "USD", captureMode: "automatic", replayed: false,
      }, error: null };
      assert.ok(["ingest_payment_webhook_v1", "record_payment_command_result_v1", "drain_due_payment_webhooks_v1"].includes(name), name);
      return { data: { webhookEventId: "stored-event", inserted: true }, error: null };
    },
  };
  const localRuntime = {
    isSquareSandboxRuntimeEnabled: () => runtime.squareSandboxRuntimeAllowed({ menuManEnvironment: env.MENU_MAN_ENV, vercelEnvironment: env.VERCEL_ENV, explicitlyEnabled: env.MENU_MAN_ENABLE_SQUARE_SANDBOX }),
    isFakePaymentRuntimeEnabled: () => true,
  };
  const config = load("src/lib/payments/providers/square/config.ts", { "../../runtime": localRuntime }, env);
  class OfflineSquareAdapter extends SquarePaymentProviderAdapter {
    constructor(settings: SquareSandboxConfig) {
      // Signature verification/normalization are real. Any provider I/O is fatal.
      super(settings, new Proxy({} as SquareGateway, { get() { return () => { throw new Error("Square I/O forbidden"); }; } }));
    }
  }
  const resolver = load<DemoServer>("src/lib/demo/server.ts", {
    "server-only": {}, "node:crypto": crypto, "@/lib/supabase/server": { supabaseServer: db }, "./policy": policy,
    "@/lib/payments/providers/square/config": config,
    "@/lib/payments/providers/square/adapter": { SquarePaymentProviderAdapter: OfflineSquareAdapter },
  }, env);
  const ordinarySession = { mode: "embedded", provider, publicConfig: { ordinary: true } };
  const payments = load<PaymentServer>("src/lib/payments/server.ts", {
    "server-only": {}, "node:crypto": crypto, "@/lib/supabase/server": { supabaseServer: db }, "./contracts": contracts,
    "./runtime": localRuntime, "./state": state, "./view-contracts": views, "./providers/fake/adapter": {},
    "@/lib/demo/server": resolver, "@/lib/demo/policy": policy,
    "./registry": { getPaymentProvider(key: string) {
      assert.equal(key, provider);
      return {
        createBrowserSession: async () => ordinarySession,
        createPayment: async (input: Row) => { gatewayCalls.push(input); return { status: "processing", providerStatus: "PENDING" }; },
      };
    } },
  }, env);
  const route = load<{ POST(request: Request): Promise<Response> }>("src/app/api/webhooks/payments/square/demo-sandbox/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/payments/server": payments, "@/lib/demo/policy": policy,
    "@/lib/payments/providers/square/webhook": webhook,
    "@/lib/payments/webhook-acknowledgement": { acknowledgeStoredPaymentWebhook },
  }, env);
  return { resolver, payments, route, calls, reads, tables, gatewayCalls, ordinarySession };
}

test("real resolver accepts aligned demo connection and fails closed for absent/denied records", async () => {
  const h = harness();
  assert.equal(await h.resolver.isDemoPaymentConnection(connectionId), true);
  assert.deepEqual(h.reads, [{ table: "restaurant_payment_connections", filters: { id: connectionId } }]);
  for (const fixture of [harness(null), harness(demoRow, enabled, true)]) {
    await assert.rejects(fixture.resolver.isDemoPaymentConnection(connectionId), /could not be verified/);
    assert.equal(fixture.calls.length, 0);
  }
  await assert.rejects(h.resolver.isDemoPaymentConnection("missing"), /could not be verified/);
});

test("real resolver denies disabled demo, seller/location mismatch and foreign demo markers", async () => {
  const disabled = { ...enabled, MENU_MAN_ENABLE_PUBLIC_DEMO_PAYMENTS: "false" };
  const cases = [
    harness(demoRow, disabled),
    harness({ ...demoRow, provider_account_reference: "different-merchant" }),
    harness({ ...demoRow, provider_metadata: { publicDemo: true, locationId: "different-location" } }),
    harness({ ...demoRow, restaurant_id: "foreign-tenant" }),
  ];
  for (const h of cases) {
    await assert.rejects(h.resolver.isDemoPaymentConnection(connectionId), /unavailable|alignment|does not match/);
    assert.equal(h.calls.length, 0);
  }
});

for (const provider of ["square", "fake"]) {
  test(`ordinary ${provider} session and payment retain source/amount with demo disabled and unconfigured`, async () => {
    const h = harness({ ...demoRow, restaurant_id: "ordinary-tenant", provider_key: provider, environment: provider === "fake" ? "test" : "sandbox", provider_metadata: {} }, {
      MENU_MAN_ENV: "staging", VERCEL_ENV: "preview", MENU_MAN_ENABLE_SQUARE_SANDBOX: "true",
      MENU_MAN_ENABLE_PUBLIC_DEMO_PAYMENTS: "false",
    });
    assert.equal(await h.resolver.isDemoPaymentConnection(connectionId), false);
    const session = await h.payments.getPaymentSession("order", "capability");
    assert.equal(session.browserSession, h.ordinarySession);
    h.calls.length = 0;
    await h.payments.submitPayment("order", "capability", "client-key", "ordinary-source");
    assert.equal(h.gatewayCalls.length, 1);
    assert.equal(h.gatewayCalls[0].paymentMethodToken, "ordinary-source");
    assert.equal(h.gatewayCalls[0].provider, provider);
    assert.equal(h.gatewayCalls[0].amountCents, 595);
    assert.equal(h.gatewayCalls[0].providerIdempotencyKey, "authoritative-key");
    assert.deepEqual(h.calls.map(call => call.name), ["authorize_payment_session_v1", "reserve_payment_attempt_v1", "record_payment_command_result_v1", "drain_due_payment_webhooks_v1", "authorize_payment_session_v1"]);
  });
}

function signedEvent(kind: "payment" | "refund", signatureKey = enabled.SQUARE_DEMO_SANDBOX_WEBHOOK_SIGNATURE_KEY) {
  const object = kind === "payment"
    ? { payment: { id: "sandbox-payment", status: "COMPLETED", reference_id: attemptId, location_id: "demo-location", amount_money: { amount: 595, currency: "USD" } } }
    : { refund: { id: "sandbox-refund", payment_id: "sandbox-payment", status: "COMPLETED", location_id: "demo-location", amount_money: { amount: 595, currency: "USD" } } };
  const body = JSON.stringify({ event_id: `event-${kind}`, type: `${kind}.updated`, merchant_id: "demo-merchant", created_at: "2026-10-20T20:00:00Z", data: { object } });
  const signature = crypto.createHmac("sha256", signatureKey).update(enabled.SQUARE_DEMO_SANDBOX_WEBHOOK_NOTIFICATION_URL + body).digest("base64");
  return new Request(enabled.SQUARE_DEMO_SANDBOX_WEBHOOK_NOTIFICATION_URL, { method: "POST", body, headers: { "x-square-hmacsha256-signature": signature } });
}

for (const kind of ["payment", "refund"] as const) {
  test(`signed demo ${kind} webhook rejects foreign connection before any state-changing RPC or drain`, async () => {
    for (const metadata of [{}, demoRow.provider_metadata]) {
      const h = harness({ ...demoRow, restaurant_id: "foreign-tenant", provider_metadata: metadata });
      const before = JSON.stringify(h.tables);
      const response = await h.route.POST(signedEvent(kind));
      assert.equal(response.status, 500);
      assert.ok(h.reads.some(read => read.table === "restaurant_payment_connections" && read.filters.id === connectionId));
      assert.equal(h.calls.length, 0, "Must not ingest/drain events or mutate orders/payments");
      assert.equal(JSON.stringify(h.tables), before);
      assert.equal(h.gatewayCalls.length, 0);
    }
  });
}

test("real signed webhook path accepts own connection; invalid signature or lookup failure cannot mutate state", async () => {
  const own = harness();
  assert.equal((await own.route.POST(signedEvent("payment"))).status, 200);
  assert.deepEqual(own.calls.map(call => call.name), ["ingest_payment_webhook_v1", "drain_due_payment_webhooks_v1"]);
  assert.equal(own.calls[0].args.p_connection_id, connectionId);
  const invalid = harness();
  assert.equal((await invalid.route.POST(signedEvent("payment", "wrong-signature-key"))).status, 403);
  assert.equal(invalid.calls.length, 0);
  const denied = harness(demoRow, enabled, true);
  assert.equal((await denied.route.POST(signedEvent("payment"))).status, 500);
  assert.equal(denied.calls.length, 0);
});
