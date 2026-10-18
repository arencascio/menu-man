import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";
import { z } from "zod";
import * as reporting from "./reporting";
import type { FinancialState } from "./financial-reporting";
import type { RestaurantMembership } from "../order-management/contracts";

const now = new Date("2026-10-16T12:34:56.987Z");
const restaurantId = "20000000-0000-4000-8000-000000000001";
const otherId = "30000000-0000-4000-8000-000000000001";
const itemId = "20000000-0000-4000-8000-000000000201";
const owner: RestaurantMembership = { membershipId: "20000000-0000-4000-8000-000000000999", restaurantId,
  restaurantSlug: "super-tacos", restaurantName: "Super Tacos", restaurantTimezone: "America/Los_Angeles",
  memberRole: "owner", displayName: "Owner", capabilities: [] };
class ManagementError extends Error { constructor(public code: string, message: string) { super(message); } }
const daily = { error: null, hasMore: null, query_status: null, results: [["2026-10-16", 10, 6, 8, 4, 1, 2, 3, 4, 5, 1, 1]] };
const items = { error: null, hasMore: null, query_status: null, results: [[itemId, 5]] };
const audience = { error: null, hasMore: null, query_status: null, results: [[3, 4, 1, 7]] };
const read = (file: string) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");
function load(file: string, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  runInNewContext(transpileModule(read(file), { compilerOptions: { target: ScriptTarget.ES2017, module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText, {
    exports, ...globals, require(id: string) {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return exports;
}

function server(options: {
  memberships?: RestaurantMembership[][]; authError?: boolean; env?: Record<string, string | undefined>;
  failure?: "http" | "network" | "malformed" | "pending" | "empty"; audienceFailure?: boolean; audienceRows?: unknown;
  geographyFailure?: boolean; geographyRows?: unknown;
  namesError?: boolean;
  names?: unknown[]; catalogThrows?: boolean; itemRows?: [string, number][];
  financialUnavailable?: boolean;
} = {}) {
  const requests: { url: string; init: RequestInit }[] = [];
  const catalog: unknown[] = [];
  const diagnostics: unknown[][] = [];
  const financialReads: unknown[] = [];
  let authorizationReads = 0;
  const exports = load("src/lib/analytics/reporting-server.ts", {
    "server-only": {}, zod: { z },
    "./financial-reporting-server": { readOwnerFinancials: async (...args: unknown[]) => {
      financialReads.push(args);
      return options.financialUnavailable ? { status: "unavailable" } : { status: "ready", report: { ...(args[2] as object), environment: args[1], paidOrders: 2, completedPaidOrders: 1, cancelledPaidOrders: 0, currencies: [] } };
    } },
    "./reporting": { ...reporting, reportingRange: (value: unknown) => reporting.reportingRange(value, now) },
    "@/lib/order-management/server": { ManagementError,
      listRestaurantMemberships: async () => {
        authorizationReads++;
        if (options.authError) throw new ManagementError("UNAUTHENTICATED", "Sign in");
        return options.memberships?.[Math.min(authorizationReads - 1, options.memberships.length - 1)] ?? [owner];
      },
    },
    "@/lib/supabase/server": { supabaseServer: { from: (table: string) => {
      if (options.catalogThrows) throw Error("PRIVATE_CATALOG_CONFIGURATION");
      return { select: (columns: string) => ({ eq: (key: string, value: string) => ({ in: async (field: string, ids: string[]) => {
        catalog.push({ table, columns, key, value, field, ids });
        return { data: options.names ?? [{ id: itemId, restaurant_id: restaurantId, name: "<Sample taco>" }], error: options.namesError ? {} : null };
      } }) }) };
    } } },
  }, { process: { env: options.env ?? { POSTHOG_PERSONAL_API_KEY: "private-mock-key", POSTHOG_PROJECT_ID: "599948", VERCEL_ENV: "preview" } },
    AbortSignal, console: { error: (...args: unknown[]) => { diagnostics.push(args); } },
    fetch: async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      if (options.failure === "network") throw Error("PRIVATE_PROVIDER_DETAILS");
      const sql = JSON.parse(init.body as string).query.query as string;
      if (sql.includes("AS local_pageviews")) {
        if (options.geographyFailure) return { ok: false, status: 503 };
        return { ok: options.failure !== "http", status: options.failure === "http" ? 403 : 200,
          json: async () => options.failure === "malformed" ? { results: [["PRIVATE_RAW_EVENT"]] }
            : options.failure === "pending" ? { query_status: { complete: false } }
              : options.geographyRows ?? (options.failure === "empty" ? { results: [[0, 0, 0, 0, 0]] } : { results: [[3, 2, 1, 1, 3]] }) };
      }
      if (sql.includes("AS unique_browsers")) {
        if (options.audienceFailure) return { ok: false, status: 503 };
        return { ok: options.failure !== "http", status: options.failure === "http" ? 403 : 200,
          json: async () => options.failure === "malformed" ? { results: [["PRIVATE_RAW_EVENT"]] }
            : options.failure === "pending" ? { query_status: { complete: false } }
              : options.audienceRows ?? (options.failure === "empty" ? { results: [[0, 0, 0, 0]] } : audience) };
      }
      return { ok: options.failure !== "http", status: options.failure === "http" ? 403 : 200, json: async () => options.failure === "malformed" ? { results: [["PRIVATE_RAW_EVENT"]] }
        : options.failure === "pending" ? { query_status: { complete: false } }
          : options.failure === "empty" ? { results: [] } : sql.includes("GROUP BY day") ? daily : { ...items, results: options.itemRows ?? items.results } };
    },
  });
  return { load: exports.loadOwnerAnalytics as (slug: string, range?: unknown) => Promise<{ membership: RestaurantMembership; state: reporting.ReportingState; financialState: FinancialState }>, requests, catalog, diagnostics, financialReads, reads: () => authorizationReads };
}

test("reporting diagnostics contain only bounded status or schema fields, never credentials or raw data", async () => {
  for (const failure of ["http", "network", "malformed", "pending"] as const) {
    const harness = server({ failure });
    await harness.load("super-tacos", "7");
    assert.ok(harness.diagnostics.length);
    const output = JSON.stringify(harness.diagnostics);
    assert.doesNotMatch(output, /PRIVATE_|private-mock|SELECT|Bearer|restaurant_id|20000000/);
    if (failure === "http") assert.match(output, /"category":"http","status":403/);
    else if (failure === "network") assert.match(output, /request_or_aggregation/);
    else assert.match(output, /invalid_response/);
  }
  const success = server(); await success.load("super-tacos", "7");
  assert.equal(success.diagnostics.length, 0);
});

test("reporting range validates only 7/30/90 and uses UTC calendar days including partial today across DST/year boundaries", () => {
  assert.deepEqual(reporting.reportingRange("7", now), { days: 7, from: "2026-10-10T00:00:00.000Z", until: "2026-10-16T12:34:56.000Z" });
  assert.equal(reporting.reportingRange(undefined, now)?.days, 30);
  for (const input of [null, "", "07", 7, "8", "7 OR 1=1", ["7", "90"], { restaurantId }]) assert.equal(reporting.reportingRange(input, now), null);
  assert.equal(reporting.reportingRange("7", new Date("2027-01-02T00:00:00Z"))?.from, "2026-12-27T00:00:00.000Z");
  assert.equal(reporting.reportingRange("7", new Date("2026-11-03T12:00:00Z"))?.from, "2026-10-28T00:00:00.000Z");
  assert.equal(reporting.reportingRange("90", now)?.days, 90);
});

test("trusted reporting environment separates production/preview/local and fails closed on unknown deployment values", () => {
  assert.equal(reporting.reportingEnvironment({ VERCEL_ENV: "production", MENU_MAN_ENV: "staging" }), "production");
  assert.equal(reporting.reportingEnvironment({ VERCEL_ENV: "preview" }), "staging");
  assert.equal(reporting.reportingEnvironment({ VERCEL_ENV: "development" }), "development");
  assert.equal(reporting.reportingEnvironment({ MENU_MAN_ENV: "staging" }), "staging");
  assert.equal(reporting.reportingEnvironment({ NODE_ENV: "development" }), "development");
  assert.equal(reporting.reportingEnvironment({ VERCEL_ENV: "unknown", MENU_MAN_ENV: "staging" }), null);
  assert.equal(reporting.reportingEnvironment({}), null);
});

test("bounded queries enforce tenant/environment/scope/date and QA filters; audience returns only aggregate identities", () => {
  for (const environment of ["production", "staging", "development"] as const) {
    const queries = reporting.reportingQueries(restaurantId, environment, reporting.reportingRange("30", now)!);
    for (const sql of Object.values(queries)) {
      assert.ok(sql.includes(`properties.restaurant_id = '${restaurantId}'`));
      assert.ok(sql.includes(`properties.environment = '${environment}'`));
      assert.ok(sql.includes("properties.analytics_scope = 'restaurant'"));
      assert.match(sql, /timestamp >= toDateTime\('2026-(?:06-19|09-17) 00:00:00', 'UTC'\)/);
      assert.match(sql, /timestamp < toDateTime\('2026-10-16 12:34:56', 'UTC'\)/);
      assert.match(sql, /internal_qa_/);
      assert.doesNotMatch(sql, /\$pageview|SELECT \*|customer|properties\.query\b/i);
    }
    for (const sql of [queries.daily, queries.items]) assert.doesNotMatch(sql, /distinct_id|\$device_id/);
  assert.match(queries.audience, /event = 'page_view'/);
  assert.match(queries.geography, /properties\.visitor_area = 'local'/);
  assert.match(queries.geography, /properties\.visitor_area IS NULL OR properties\.visitor_area NOT IN/);
  assert.match(queries.geography, /event = 'page_view'/);
  assert.doesNotMatch(queries.geography, /distinct_id|\$device_id|SELECT \*/);
    assert.match(queries.audience, /identity_version = 1 AND properties.identity_mode = 'persistent'/);
    assert.match(queries.audience, /uniqExactIf\(properties\.\$session_id, timestamp >=/);
    assert.match(queries.audience, /uniqExact\(properties\.\$session_id\) AS recorded_visits/);
    assert.match(queries.audience, /countIf\(active_visits > 0 AND recorded_visits > 1\)/);
    assert.match(queries.audience, /toString\(properties\.\$device_id\) = toString\(distinct_id\)/);
    assert.doesNotMatch(queries.audience, /ORDER BY|LIMIT \d+|person_id|properties\.\$current_url/);
  }
  assert.throws(() => reporting.reportingQueries("' OR 1=1", "production", reporting.reportingRange("7", now)!));
  const dailySql = reporting.reportingQueries(restaurantId, "staging", reporting.reportingRange("7", now)!).daily;
  // Live HogQL rejects ClickHouse's two-argument toDate overload. Keep UTC explicit.
  assert.match(dailySql, /formatDateTime\(timestamp, '%Y-%m-%d', 'UTC'\) AS day/);
  assert.doesNotMatch(dailySql, /toDate\(/);
  assert.match(reporting.reportingQueries(restaurantId, "staging", reporting.reportingRange("7", now)!).items, /GROUP BY item_id ORDER BY openings DESC, item_id LIMIT 10/);
});

test("aggregates exact event meanings, fills only successful empty days and rejects incomplete/malformed/inconsistent results", () => {
  const range = reporting.reportingRange("7", now)!;
  const report = reporting.assembleReport(range, "staging", daily, items);
  assert.equal(report.daily.length, 7);
  assert.equal(report.daily[0].pageviews, 0);
  assert.deepEqual(report.totals, { pageviews: 10, menuViews: 6, itemOpenings: 8, searches: 4, zeroResults: 1, delivery: 2, pickup: 3, phone: 4, directions: 5, internalPickup: 1, externalPickup: 1 });
  assert.equal(report.popularItems[0].openings, 5);
  assert.equal(reporting.assembleReport(range, "production", { results: [] }, { results: [] }).totals.pageviews, 0);
  assert.equal(reporting.assembleReport(range, "staging", { ...daily, hasMore: false }, { ...items, hasMore: false }).totals.pageviews, 10);
  assert.equal(reporting.assembleReport(range, "staging", { ...daily, results: [], hasMore: null }, { ...items, results: [], hasMore: null }).totals.pageviews, 0);
  assert.throws(() => reporting.assembleReport(range, "staging", daily, { ...items, hasMore: true }));
  for (const bad of [{}, { results: [] , error: "PRIVATE_ERROR" }, { results: [], hasMore: true }, { results: [], query_status: { complete: false } },
    { results: [["2026-10-01", ...daily.results[0].slice(1)]] }, { results: [...daily.results, ...daily.results] }, { results: [["2026-10-16", -1]] }]) {
    assert.throws(() => reporting.assembleReport(range, "staging", bad, items));
  }
  assert.throws(() => reporting.assembleReport(range, "staging", { results: [["2026-10-16", 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]] }, { results: [] }));
  assert.throws(() => reporting.assembleReport(range, "staging", daily, { results: [[itemId, 100]] }));
});

test("audience aggregates validate distinct visit and browser counts without exposing identities", () => {
  assert.deepEqual(reporting.assembleAudience(audience, 10), {
    status: "ready", uniqueBrowsers: 3, visits: 4, returningBrowsers: 1, trackedPageviews: 7,
  });
  assert.deepEqual(reporting.assembleAudience({ results: [[0, 0, 0, 0]] }, 0), {
    status: "ready", uniqueBrowsers: 0, visits: 0, returningBrowsers: 0, trackedPageviews: 0,
  });
  for (const response of [{ results: [] }, { results: [[1, 1, 0, 1]], hasMore: true },
    { results: [[1, 1, 0, 1]], query_status: { complete: false } }, { results: [[1, 1, 0, 1], [0, 0, 0, 0]] },
    { results: [[1, 1, 2, 2]] }, { results: [[2, 1, 0, 2]] }, { results: [[1, 2, 0, 1]] },
    { results: [[1, 1, 0, 11]] }, { results: [["private-id", 1, 0, 1]] }]) {
    assert.throws(() => reporting.assembleAudience(response, 10));
  }
});

test("geography aggregation classifies all pageviews, includes historical missing properties as unknown, and rejects inconsistent data", () => {
  assert.deepEqual(reporting.assembleGeography({ results: [[3, 2, 1, 1, 3]] }, 10), {
    status: "ready", local: 3, sameState: 2, outOfState: 1, unknown: 4,
    classifiedPageviews: 7, unclassifiedPageviews: 3,
  });
  assert.deepEqual(reporting.assembleGeography({ results: [[0, 0, 0, 0, 0]] }, 0), {
    status: "ready", local: 0, sameState: 0, outOfState: 0, unknown: 0,
    classifiedPageviews: 0, unclassifiedPageviews: 0,
  });
  for (const response of [{ results: [] }, { results: [[1, 0, 0, 0, 0]], hasMore: true },
    { results: [[1, 0, 0, 0, 0]], query_status: { complete: false } },
    { results: [[1, 0, 0, 0, 0]] }, { results: [["raw-event", 0, 0, 0, 0]] }]) {
    assert.throws(() => reporting.assembleGeography(response, 10));
  }
});

test("audience result contract represents repeat pageviews, separate visits, prior-window returns and rotated identities", async () => {
  const cases = [
    { name: "three reloads in one visit", row: [1, 1, 0, 3], expected: [1, 1, 0] },
    { name: "two visits in the selected period", row: [1, 2, 1, 3], expected: [1, 2, 1] },
    { name: "one selected visit after a historical visit", row: [1, 1, 1, 2], expected: [1, 1, 1] },
    { name: "90-day identity rotation creates a separate browser", row: [2, 2, 0, 2], expected: [2, 2, 0] },
  ];
  for (const scenario of cases) {
    const result = await server({ audienceRows: { results: [scenario.row] } }).load("super-tacos", "7");
    assert.equal(result.state.status, "ready", scenario.name);
    if (result.state.status !== "ready" || result.state.report.audience.status !== "ready") continue;
    const { uniqueBrowsers, visits, returningBrowsers } = result.state.report.audience;
    assert.deepEqual([uniqueBrowsers, visits, returningBrowsers], scenario.expected, scenario.name);
    assert.equal(result.state.report.totals.pageviews, 10, "overall pageviews remain unchanged");
  }
});

test("audience query has a fixed 90-day prior lookback and counts pageview visits, not reloads or actions", () => {
  for (const days of [7, 30, 90] as const) {
    const range = reporting.reportingRange(String(days), now)!;
    const sql = reporting.reportingQueries(restaurantId, "staging", range).audience;
    const history = new Date(Date.parse(range.from) - 90 * 86_400_000).toISOString().slice(0, 19).replace("T", " ");
    assert.ok(sql.includes(`timestamp >= toDateTime('${history}', 'UTC')`));
    assert.ok(sql.includes(`timestamp >= toDateTime('${range.from.slice(0, 19).replace("T", " ")}', 'UTC')`));
    assert.match(sql, /uniqExactIf\(properties\.\$session_id, timestamp >=/);
    assert.match(sql, /uniqExact\(properties\.\$session_id\) AS recorded_visits/);
    assert.match(sql, /event = 'page_view'/);
    assert.doesNotMatch(sql, /menu_search|menu_item_expanded|\$pageview/);
  }
});

test("audience failures leave engagement available and genuinely empty periods show zero counts", async () => {
  const failed = await server({ audienceFailure: true }).load("super-tacos", "7");
  assert.equal(failed.state.status, "ready");
  if (failed.state.status === "ready") {
    assert.equal(failed.state.report.totals.pageviews, 10);
    assert.deepEqual(failed.state.report.audience, { status: "unavailable" });
    const html = renderToStaticMarkup(createElement(dashboard(), { state: failed.state }));
    assert.match(html, /Tracked-browser and visit metrics are unavailable/);
    assert.doesNotMatch(html, /Unique browsers<\/dt><dd>0/);
  }
  const empty = await server({ failure: "empty" }).load("super-tacos", "7");
  assert.equal(empty.state.status, "ready");
  if (empty.state.status === "ready") {
    assert.equal(empty.state.report.audience.status, "ready");
    const html = renderToStaticMarkup(createElement(dashboard(), { state: empty.state }));
    assert.match(html, /Unique browsers/);
    assert.match(html, /Observed return rate<\/dt><dd>Not available/);
  }
});

test("geography failures remain unavailable without changing traffic totals, and empty ranges stay empty", async () => {
  const failed = await server({ geographyFailure: true }).load("super-tacos", "7");
  assert.equal(failed.state.status, "ready");
  if (failed.state.status === "ready") {
    assert.equal(failed.state.report.totals.pageviews, 10);
    assert.deepEqual(failed.state.report.geography, { status: "unavailable" });
    const html = renderToStaticMarkup(createElement(dashboard(), { state: failed.state }));
    assert.match(html, /Geographic reporting is unavailable/);
    assert.doesNotMatch(html, /Local<\/dt><dd>0/);
  }
  const empty = await server({ failure: "empty" }).load("super-tacos", "7");
  assert.equal(empty.state.status, "ready");
  if (empty.state.status === "ready") {
    assert.deepEqual(empty.state.report.geography, {
      status: "ready", local: 0, sameState: 0, outOfState: 0, unknown: 0,
      classifiedPageviews: 0, unclassifiedPageviews: 0,
    });
    const html = renderToStaticMarkup(createElement(dashboard(), { state: empty.state }));
    assert.match(html, /No restaurant pageviews were recorded in this date range/);
  }
});

test("owner authorization is independent of order capabilities; unauthenticated/non-owner/other-tenant/revoked requests never query", async () => {
  const authorized = server();
  const result = await authorized.load("super-tacos", "7");
  assert.equal(result.state.status, "ready");
  assert.equal(authorized.requests.length, 4);
  assert.equal(authorized.reads(), 2);
  for (const memberships of [[], [{ ...owner, memberRole: "manager" as const, capabilities: ["view_orders" as const, "manage_memberships" as const] }], [{ ...owner, memberRole: "staff" as const }], [{ ...owner, restaurantSlug: "another", restaurantId: otherId }]]) {
    const denied = server({ memberships: [memberships] });
    await assert.rejects(denied.load("super-tacos", "7"), (error: unknown) => error instanceof ManagementError && error.code === "FORBIDDEN");
    assert.equal(denied.requests.length, 0);
    assert.equal(denied.catalog.length, 0);
    assert.equal(denied.financialReads.length, 0);
  }
  const loggedOut = server({ authError: true });
  await assert.rejects(loggedOut.load("super-tacos"), /Sign in/);
  assert.equal(loggedOut.requests.length, 0);
  assert.equal(loggedOut.financialReads.length, 0);
  const revoked = server({ memberships: [[owner], []] });
  await assert.rejects(revoked.load("super-tacos"), (error: unknown) => error instanceof ManagementError && error.code === "FORBIDDEN");
  assert.equal(revoked.reads(), 2);
});

test("financial reporting uses the authorized tenant and same range, independently of PostHog failures, and is withheld on revocation", async () => {
  for (const options of [{}, { failure: "http" as const }, { env: { VERCEL_ENV: "preview" } }]) {
    const harness = server(options);
    const result = await harness.load("super-tacos", "90");
    assert.equal(result.financialState.status, "ready");
    assert.deepEqual(JSON.parse(JSON.stringify(harness.financialReads)), [[restaurantId, "staging", reporting.reportingRange("90", now)]]);
  }
  const other = server({ memberships: [[{ ...owner, restaurantId: otherId }]] });
  await other.load("super-tacos", "7");
  assert.equal((other.financialReads[0] as unknown[])[0], otherId);
  const revoked = server({ memberships: [[owner], []] });
  await assert.rejects(revoked.load("super-tacos", "7"), /Owner access/);
  assert.equal(revoked.financialReads.length, 1);
  for (const [env, range] of [[{}, "7"], [{ VERCEL_ENV: "preview" }, "invalid"]] as const) {
    const invalid = server({ env }); await invalid.load("super-tacos", range);
    assert.equal(invalid.financialReads.length, 0);
  }
  const unavailable = await server({ financialUnavailable: true }).load("super-tacos", "7");
  assert.equal(unavailable.state.status, "ready");
  assert.equal(unavailable.financialState.status, "unavailable");
});

test("queries use membership IDs only, private server credentials and no-store fetch; responses expose aggregates only", async () => {
  const harness = server();
  const result = await harness.load("super-tacos", "7");
  for (const request of harness.requests) {
    assert.equal(request.url, "https://us.posthog.com/api/projects/599948/query/");
    assert.equal(request.init.cache, "no-store"); assert.equal(request.init.redirect, "error");
    assert.equal((request.init.headers as Record<string, string>).Authorization, "Bearer private-mock-key");
    assert.match(String(request.init.body), new RegExp(restaurantId));
  }
  assert.deepEqual(JSON.parse(JSON.stringify(harness.catalog)), [{ table: "menu_items", columns: "id, restaurant_id, name", key: "restaurant_id", value: restaurantId, field: "id", ids: [itemId] }]);
  assert.equal(result.state.status === "ready" && result.state.report.popularItems[0].label, "<Sample taco>");
  assert.doesNotMatch(JSON.stringify(result), /private-mock-key|HogQL|SELECT |distinct_id|Authorization/);
  const secondTenant = server({ memberships: [[{ ...owner, restaurantId: otherId }]] });
  await secondTenant.load("super-tacos", "7");
  assert.ok(secondTenant.requests.every((r) => !String(r.init.body).includes(restaurantId) && String(r.init.body).includes(otherId)));
});

test("owner catalog labels resolve current same-tenant items, including unpublished items, without changing ranking or counts", async () => {
  const secondItem = "20000000-0000-4000-8000-000000000202";
  const harness = server({ itemRows: [[itemId, 3], [secondItem, 2]], names: [
    { id: secondItem, restaurant_id: restaurantId, name: "Unpublished burrito", is_published: false },
    { id: itemId, restaurant_id: restaurantId, name: " Street taco " },
  ] });
  const result = await harness.load("super-tacos", "30");
  assert.equal(result.state.status, "ready");
  if (result.state.status !== "ready") return;
  assert.deepEqual(JSON.parse(JSON.stringify(result.state.report.popularItems)), [
    { itemId, openings: 3, label: "Street taco" },
    { itemId: secondItem, openings: 2, label: "Unpublished burrito" },
  ]);
  assert.equal(result.state.report.totals.itemOpenings, 8);
  assert.equal(result.state.report.days, 30);
  assert.equal(harness.reads(), 2);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.catalog)), [{ table: "menu_items", columns: "id, restaurant_id, name", key: "restaurant_id", value: restaurantId, field: "id", ids: [itemId, secondItem] }]);
});

test("catalog responses cannot label foreign tracked IDs or substitute another tenant's item name", async () => {
  const secondItem = "20000000-0000-4000-8000-000000000202";
  const foreignItem = "30000000-0000-4000-8000-000000000201";
  const harness = server({ itemRows: [[itemId, 3], [secondItem, 2], [foreignItem, 1]], names: [
    { id: itemId, restaurant_id: otherId, name: "OTHER_TENANT_NAME" },
    { id: secondItem, restaurant_id: restaurantId, name: "Safe burrito" },
    { id: foreignItem, restaurant_id: otherId, name: "FOREIGN_ITEM_NAME" },
    { id: "20000000-0000-4000-8000-000000000203", restaurant_id: restaurantId, name: "UNREQUESTED_ITEM_NAME" },
  ] });
  const result = await harness.load("super-tacos", "7");
  assert.equal(result.state.status, "ready");
  if (result.state.status !== "ready") return;
  assert.deepEqual(JSON.parse(JSON.stringify(result.state.report.popularItems.map((item) => [item.label, item.openings]))), [
    ["Unavailable menu item", 3], ["Safe burrito", 2], ["Unavailable menu item", 1],
  ]);
  assert.doesNotMatch(JSON.stringify(result), /OTHER_TENANT_NAME|FOREIGN_ITEM_NAME|UNREQUESTED_ITEM_NAME/);
});

test("deleted items and unavailable or invalid catalog reads retain counts with a neutral, escaped fallback", async () => {
  for (const options of [{ names: [] }, { namesError: true }, { catalogThrows: true },
    { names: [{ id: itemId, restaurant_id: restaurantId, name: "   " }] },
    { names: [{ id: itemId, name: "Missing tenant" }] }]) {
    const harness = server(options);
    const result = await harness.load("super-tacos", "90");
    assert.equal(result.state.status, "ready");
    if (result.state.status !== "ready") continue;
    assert.equal(result.state.report.popularItems[0].label, "Unavailable menu item");
    assert.equal(result.state.report.popularItems[0].openings, 5);
    assert.equal(result.state.report.days, 90);
    assert.equal(harness.diagnostics.length, 0);
    const html = renderToStaticMarkup(createElement(dashboard(), { state: result.state }));
    assert.match(html, /Unavailable menu item/);
    assert.doesNotMatch(html, new RegExp(itemId + "|" + itemId.slice(-6) + "|PRIVATE_"));
  }
  const empty = server({ failure: "empty" }); await empty.load("super-tacos");
  assert.equal(empty.catalog.length, 0);
});

test("missing configuration, unknown environment, malformed ranges and provider failures never become zero-valued reports", async () => {
  for (const env of [{ VERCEL_ENV: "preview" }, { VERCEL_ENV: "preview", POSTHOG_PERSONAL_API_KEY: "mock", POSTHOG_PROJECT_ID: "1", POSTHOG_QUERY_HOST: "https://untrusted.example" }]) {
    const harness = server({ env }); const result = await harness.load("super-tacos");
    assert.equal(result.state.status, "unavailable"); assert.equal(harness.requests.length, 0);
  }
  const unknown = server({ env: {} });
  assert.deepEqual(JSON.parse(JSON.stringify((await unknown.load("super-tacos")).state)), { status: "unavailable", reason: "environment" });
  const invalid = server(); assert.equal((await invalid.load("super-tacos", ["7", "90"])).state.status, "invalid_range"); assert.equal(invalid.requests.length, 0);
  for (const failure of ["http", "network", "malformed", "pending"] as const) {
    const result = await server({ failure }).load("super-tacos");
    assert.deepEqual(JSON.parse(JSON.stringify(result.state)), { status: "unavailable", reason: "provider" });
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|private-mock/);
  }
  const empty = await server({ failure: "empty" }).load("super-tacos");
  assert.equal(empty.state.status === "ready" && empty.state.report.totals.pageviews, 0);
});

const css = new Proxy({}, { get: (_target, name) => String(name) });
function dashboard() {
  return load("src/app/manage/[slug]/analytics/AnalyticsDashboard.tsx", { "react/jsx-runtime": jsx, "./analytics.module.css": { default: css } }).default as React.ComponentType<{ state: reporting.ReportingState }>;
}
test("dashboard renders truthful counts, no-search denominator, empty/failure states, escaped labels and accessible daily details", () => {
  const Component = dashboard();
  const report = reporting.assembleReport(reporting.reportingRange("7", now)!, "staging", daily, items);
  report.audience = reporting.assembleAudience(audience, report.totals.pageviews);
  report.geography = reporting.assembleGeography({ results: [[3, 2, 1, 1, 3]] }, report.totals.pageviews);
  report.popularItems[0].label = "<script>private()</script>";
  const html = renderToStaticMarkup(createElement(Component, { state: { status: "ready", report } }));
  for (const text of ["Website traffic", "Estimated pageview geography", "Menu engagement", "Customer actions", "25.0%", "33.3%", "30.0%", "20.0%", "partial", "UTC", "Daily totals", "not orders", "Unique browsers", "Returning browsers", "Visits", "Coverage among received events: 7 of 10", "Classification coverage: 7 of 10 pageviews (70.0%)", "3 pageviews had no valid location classification", "&lt;script&gt;"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /<script>|distinct_id|private-mock-key/);
  const empty = reporting.assembleReport(reporting.reportingRange("7", now)!, "staging", { results: [] }, { results: [] });
  empty.geography = reporting.assembleGeography({ results: [[0, 0, 0, 0, 0]] }, 0);
  const emptyHtml = renderToStaticMarkup(createElement(Component, { state: { status: "ready", report: empty } }));
  assert.match(emptyHtml, /No recorded website activity/); assert.match(emptyHtml, /No restaurant pageviews were recorded/); assert.match(emptyHtml, /Not available/);
  for (const reason of ["configuration", "provider", "environment"] as const) {
    const failed = renderToStaticMarkup(createElement(Component, { state: { status: "unavailable", reason } }));
    assert.match(failed, /Website engagement unavailable/); assert.doesNotMatch(failed, /<dd>|<svg/);
  }
  const styles = read("src/app/manage/[slug]/analytics/analytics.module.css");
  assert.match(styles, /repeat\(2, minmax\(0, 1fr\)\)/); assert.match(styles, /@media \(max-width: 600px\)/);
  assert.match(styles, /overflow-x: auto/); assert.match(styles, /grid-template-columns: minmax\(0, 1fr\)/);
});

test("management navigation exposes analytics to owners only, and page retains server authorization/dynamic rendering", () => {
  const Nav = load("src/app/manage/[slug]/ManagementNav.tsx", { "react/jsx-runtime": jsx,
    "next/link": { default: ({ children, ...props }: { children: React.ReactNode }) => createElement("a", props, children) },
    "../management.module.css": { default: css },
  }).default as React.ComponentType<{ slug: string; active: string; capabilities: string[]; memberRole: string }>;
  for (const role of ["owner", "manager", "staff"]) {
    const html = renderToStaticMarkup(createElement(Nav, { slug: "super-tacos", active: "analytics", capabilities: ["view_orders"], memberRole: role }));
    assert.equal(html.includes('/manage/super-tacos/analytics'), role === "owner");
  }
  const page = read("src/app/manage/[slug]/analytics/page.tsx");
  assert.match(page, /loadOwnerAnalytics\(slug, range\)/); assert.match(page, /force-dynamic/); assert.match(page, /revalidate = 0/);
  assert.match(page, /UNAUTHENTICATED/); assert.match(page, /FORBIDDEN/);
  assert.match(read("src/lib/analytics/reporting-server.ts"), /^import "server-only"/);
  for (const path of ["src/app/manage/[slug]/analytics/page.tsx", "src/app/manage/[slug]/analytics/AnalyticsDashboard.tsx", "src/lib/analytics/reporting.ts"]) {
    assert.doesNotMatch(read(path), /POSTHOG_PERSONAL_API_KEY|NEXT_PUBLIC_POSTHOG|identify\(|alias\(|localStorage|use client/);
  }
  const rpc = read("supabase/migrations/202609140001_order_management_foundation.sql");
  assert.match(rpc, /where membership.user_id = \(select auth.uid\(\)\)\s*and membership.status = 'active'/);
});

test("actual analytics page redirects unauthenticated/denied users and ignores client tenant/environment query inputs", async () => {
  const calls: unknown[] = [];
  let failure: string | null = null;
  const Component = dashboard();
  const page = load("src/app/manage/[slug]/analytics/page.tsx", {
    "react/jsx-runtime": jsx,
    "next/navigation": { redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } },
    "@/lib/order-management/server": { ManagementError },
    "@/lib/analytics/reporting-server": { loadOwnerAnalytics: async (...args: unknown[]) => {
      calls.push(args);
      if (failure) throw new ManagementError(failure, "PRIVATE_FAILURE");
      return { membership: owner, state: { status: "unavailable", reason: "configuration" } };
    } },
    "../ManagementNav": { default: () => createElement("nav", null, "Management") },
    "./AnalyticsDashboard": { default: Component }, "../../management.module.css": { default: css }, "./analytics.module.css": { default: css },
  }).default as (props: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, unknown>> }) => Promise<React.ReactElement>;
  const props = { params: Promise.resolve({ slug: "super-tacos" }), searchParams: Promise.resolve({ range: "7", restaurantId: otherId, environment: "production" }) };
  const html = renderToStaticMarkup(await page(props));
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["super-tacos", "7"]]);
  assert.match(html, /Super Tacos/); assert.match(html, /Last 7 days/); assert.match(html, /Website engagement unavailable/);
  assert.doesNotMatch(html, new RegExp(otherId));
  failure = "UNAUTHENTICATED";
  await assert.rejects(page(props), /REDIRECT:\/manage\/login\?next=%2Fmanage%2Fsuper-tacos%2Fanalytics/);
  failure = "FORBIDDEN";
  await assert.rejects(page(props), /REDIRECT:\/manage$/);
});

test("an owner without operational capabilities can reach analytics from the management entry page", async () => {
  const home = load("src/app/manage/page.tsx", {
    "react/jsx-runtime": jsx,
    "next/link": { default: () => null },
    "next/navigation": { redirect: (path: string) => { throw Error(`REDIRECT:${path}`); } },
    "@/lib/order-management/server": { ManagementError, listRestaurantMemberships: async () => [owner] },
    "./management.module.css": { default: css },
  }).default as () => Promise<React.ReactElement>;
  await assert.rejects(home(), /REDIRECT:\/manage\/super-tacos\/analytics$/);
});
