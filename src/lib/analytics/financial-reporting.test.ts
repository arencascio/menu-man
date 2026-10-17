import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";
import * as financial from "./financial-reporting";
import { reportingRange } from "./reporting";

const restaurant = "20000000-0000-4000-8000-000000000001";
const other = "30000000-0000-4000-8000-000000000001";
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const range = reportingRange("7", new Date("2026-10-16T12:00:00Z"))!;
const connection = { restaurant_id: restaurant, environment: "sandbox", provider_key: "square" };
const payment = (n = 2, cents = 2500) => ({ id: id(n), restaurant_id: restaurant, order_id: id(n + 100), connection_id: id(9),
  currency: "USD", captured_cents: cents, succeeded_at: "2026-10-11T13:00:00+00:00", connection,
  order: { id: id(n + 100), restaurant_id: restaurant, order_status: "completed" } });
const refund = (n = 3, amount = 500) => ({ id: id(n), restaurant_id: restaurant, payment_id: id(2), connection_id: id(9),
  currency: "USD", amount_cents: amount, status: "succeeded", completed_at: "2026-10-12T13:00:00+00:00", connection,
  payment: { id: id(2), restaurant_id: restaurant, connection_id: id(9), currency: "USD", captured_cents: 2500, succeeded_at: "2026-10-11T13:00:00+00:00" } });

test("financial totals count unique capture-backed orders and individual successful partial refunds, not attempts or callbacks", () => {
  const result = financial.assembleFinancialReport(restaurant, "staging", range, [payment(), { ...payment(4, 4000), order: { ...payment(4).order, order_status: "cancelled" } }], [refund(), refund(5, 700)]);
  assert.equal(result.status, "ready"); if (result.status !== "ready") return;
  assert.equal(result.report.paidOrders, 2); assert.equal(result.report.completedPaidOrders, 1); assert.equal(result.report.cancelledPaidOrders, 1);
  assert.deepEqual(result.report.currencies, [{ currency: "USD", grossCents: 6500, refundCents: 1200, netCents: 5300 }]);
  // Refunded status/callback changes do not remove or add a captured payment.
  const fullyRefunded = financial.assembleFinancialReport(restaurant, "staging", range, [{ ...payment(), status: "refunded", refunded_cents: 2500 }], [refund(3, 2500)]);
  assert.equal(fullyRefunded.status === "ready" && fullyRefunded.report.currencies[0].netCents, 0);
  assert.throws(() => financial.assembleFinancialReport(restaurant, "staging", range, [payment(), payment()], []));
  assert.throws(() => financial.assembleFinancialReport(restaurant, "staging", range, [payment()], [refund(), refund()]));
});

test("refund completion dates include older-sale refunds, allow negative net and keep currencies separate", () => {
  const oldRefund = { ...refund(), payment: { ...refund().payment, succeeded_at: "2026-09-01T00:00:00Z" } };
  const result = financial.assembleFinancialReport(restaurant, "staging", range, [{ ...payment(), currency: "CAD" }], [oldRefund]);
  assert.equal(result.status, "ready"); if (result.status !== "ready") return;
  assert.deepEqual(result.report.currencies, [
    { currency: "CAD", grossCents: 2500, refundCents: 0, netCents: 2500 },
    { currency: "USD", grossCents: 0, refundCents: 500, netCents: -500 },
  ]);
});

test("financial parsing fails closed for cross-tenant joins, mismatched identities, environments and incomplete/invalid records", () => {
  for (const bad of [{ ...payment(), restaurant_id: other }, { ...payment(), order: { ...payment().order, restaurant_id: other } },
    { ...payment(), order_id: id(99) }, { ...payment(), connection: { ...connection, restaurant_id: other } },
    { ...payment(), connection: { ...connection, environment: "production" } }, { ...payment(), succeeded_at: null },
    { ...payment(), succeeded_at: range.until }, { ...payment(), captured_cents: 0 }, { ...payment(), captured_cents: -1 }]) {
    assert.throws(() => financial.assembleFinancialReport(restaurant, "staging", range, [bad], []));
  }
  for (const bad of [{ ...refund(), restaurant_id: other }, { ...refund(), status: "processing" }, { ...refund(), completed_at: null },
    { ...refund(), payment: { ...refund().payment, restaurant_id: other } }, { ...refund(), currency: "CAD" },
    { ...refund(), payment_id: id(99) }, { ...refund(), connection_id: id(99) }, { ...refund(), amount_cents: 2600 }]) {
    assert.throws(() => financial.assembleFinancialReport(restaurant, "staging", range, [], [bad]));
  }
  assert.throws(() => financial.assembleFinancialReport(restaurant, "staging", range, [], [refund(3, 2000), refund(4, 2000)]));
  const production = { ...payment(), connection: { ...connection, environment: "production" } };
  assert.equal(financial.assembleFinancialReport(restaurant, "production", range, [production], []).status, "ready");
  assert.throws(() => financial.assembleFinancialReport(restaurant, "production", range, [{ ...production, connection: { ...production.connection, provider_key: "fake" } }], []));
  assert.equal(financial.assembleFinancialReport(restaurant, "staging", range, [{ ...payment(), succeeded_at: range.from }], []).status, "ready");
});

function load(file: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, unknown> = {};
  runInNewContext(transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ScriptTarget.ES2017, module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText, {
    exports, AbortSignal, require(name: string) { assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`); return dependencies[name]; },
  });
  return exports;
}

function reader(options: { error?: boolean; missingCount?: boolean; truncated?: boolean; undated?: boolean; throws?: boolean; many?: boolean; changedCount?: boolean; overLimit?: boolean } = {}) {
  const calls: { table: string; steps: unknown[][] }[] = [];
  const client = { from(table: string) {
    if (options.throws) throw Error("PRIVATE_SECRET");
    const call = { table, steps: [] as unknown[][] }; calls.push(call);
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "gt", "gte", "lt", "order", "limit", "is", "range", "abortSignal"]) chain[method] = (...args: unknown[]) => { call.steps.push([method, ...args]); return chain; };
    chain.then = (resolve: (data: unknown) => unknown) => {
      const undated = call.steps.some(([key]) => key === "is");
      const offset = Number(call.steps.find(([method]) => method === "range")?.[1] ?? 0);
      const all = undated ? [] : table === "payments" ? options.many ? Array.from({ length: 1001 }, (_, i) => payment(i + 1000)) : [payment()] : [refund()];
      const data = all.slice(offset, offset + 500);
      return Promise.resolve({ data, error: options.error ? { message: "PRIVATE_ERROR" } : null,
        count: options.missingCount ? null : undated ? (options.undated ? 1 : 0) : options.overLimit ? 10001 : options.truncated ? 1005 : all.length + (options.changedCount && offset > 0 ? 1 : 0) }).then(resolve);
    };
    return chain;
  } };
  const exports = load("src/lib/analytics/financial-reporting-server.ts", { "server-only": {}, "./financial-reporting": financial,
    "@/lib/supabase/server": { supabaseServer: client } });
  return { calls, read: exports.readOwnerFinancials as (restaurantId: string, env: string, dates: typeof range) => Promise<financial.FinancialState> };
}

test("financial reader uses existing server-only client, scopes all reads by tenant and provider environment, and selects no private details", async () => {
  const harness = reader();
  const result = await harness.read(restaurant, "staging", range);
  assert.equal(result.status, "ready"); assert.equal(harness.calls.length, 4);
  for (const call of harness.calls) {
    assert.ok(call.steps.some((s) => JSON.stringify(s) === JSON.stringify(["eq", "restaurant_id", restaurant])));
    assert.ok(call.steps.some((s) => JSON.stringify(s) === JSON.stringify(["eq", "connection.restaurant_id", restaurant])));
    assert.ok(call.steps.some((s) => JSON.stringify(s) === JSON.stringify(["in", "connection.environment", ["test", "sandbox"]])));
    const columns = String(call.steps[0][1]);
    assert.doesNotMatch(columns, /customer|phone|email|notes|provider_metadata|token|secret|attempt|webhook/);
    assert.ok(call.steps.some((s) => s[0] === "abortSignal"));
  }
  for (const call of harness.calls.slice(0, 2)) {
    const timestamp = call.table === "payments" ? "succeeded_at" : "completed_at";
    assert.ok(call.steps.some((s) => JSON.stringify(s) === JSON.stringify(["gte", timestamp, range.from])));
    assert.ok(call.steps.some((s) => JSON.stringify(s) === JSON.stringify(["lt", timestamp, range.until])));
    assert.ok(call.steps.some((s) => JSON.stringify(s) === JSON.stringify(["range", 0, 499])));
  }
  const prod = reader(); await prod.read(restaurant, "production", range);
  assert.ok(prod.calls.every((call) => call.steps.some((s) => JSON.stringify(s) === JSON.stringify(["in", "connection.environment", ["production"]]))));
  assert.doesNotMatch(JSON.stringify(result), /restaurant_id|connection_id|payment_id|order_id|PRIVATE/);
  assert.match(readFileSync("src/lib/analytics/financial-reporting-server.ts", "utf8"), /^import "server-only"/);
});

test("database failures, missing exact counts, truncated results and undated captures/refunds never report zero or partial financial totals", async () => {
  for (const options of [{ error: true }, { missingCount: true }, { truncated: true }, { undated: true }, { throws: true }, { overLimit: true }, { many: true, changedCount: true }]) {
    const result = await reader(options).read(restaurant, "staging", range);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { status: "unavailable" });
  }
});

test("financial reader paginates beyond the default API row cap without losing counts", async () => {
  const result = await reader({ many: true }).read(restaurant, "staging", range);
  assert.equal(result.status, "ready"); if (result.status !== "ready") return;
  assert.equal(result.report.paidOrders, 1001);
  assert.equal(result.report.currencies[0].grossCents, 2502500);
});

test("financial dashboard distinguishes captures, refunds, test money, legitimate empty ranges and unavailable data independently of PostHog", () => {
  const css = new Proxy({}, { get: (_target, name) => String(name) });
  const Component = load("src/app/manage/[slug]/analytics/AnalyticsDashboard.tsx", { "react/jsx-runtime": jsx, "./analytics.module.css": { default: css } }).default as React.ComponentType<{ state: { status: "unavailable"; reason: "configuration" }; financialState: financial.FinancialState }>;
  const render = (financialState: financial.FinancialState) => renderToStaticMarkup(createElement(Component, { state: { status: "unavailable", reason: "configuration" }, financialState }));
  const html = render(financial.assembleFinancialReport(restaurant, "staging", range, [payment()], [refund()]));
  for (const text of ["Test money only", "Paid orders", "Completed paid orders", "Cancelled paid orders", "$25.00", "$5.00", "$20.00", "tax and tips", "not profit", "UTC", "Website engagement unavailable"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /20000000|PRIVATE|customer_name/);
  const unavailable = render({ status: "unavailable" });
  assert.match(unavailable, /captured sales unavailable/); assert.doesNotMatch(unavailable, /<dd>|\$0/);
  const empty = render(financial.assembleFinancialReport(restaurant, "staging", range, [], []));
  assert.match(empty, /No captured payments or successful refunds/); assert.match(empty, /<dd>0/); assert.doesNotMatch(empty, /\$0/);
});
