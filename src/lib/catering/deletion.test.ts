import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import * as zod from "zod";
import * as contracts from "./contracts";
import * as handler from "./handler";

const id = "a1b2c3d4-1111-4111-8111-123456789012";
const valid = { id, expectedStatus: "closed", confirm: "DELETE" };
function route(errorStatus?: number) {
  const calls: unknown[][] = [];
  const exports: { DELETE?: (r: Request, context: { params: Promise<{ slug: string }> }) => Promise<Response> } = {};
  runInNewContext(transpileModule(readFileSync("src/app/api/manage/restaurants/[slug]/catering/route.ts", "utf8"), {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText, { exports, Response, URL, require(name: string) {
    if (name === "zod") return zod;
    if (name === "@/lib/catering/contracts") return contracts;
    if (name === "@/lib/catering/handler") return handler;
    if (name === "@/lib/order-management/server") return { managementErrorStatus: () => errorStatus ?? 503 };
    if (name === "@/lib/catering/server") return { deleteCateringInquiry: async (...args: unknown[]) => {
      calls.push(args); if (errorStatus) throw new Error("PRIVATE_CUSTOMER");
    } };
    throw new Error(name);
  } });
  return { calls, call: (body: unknown, origin = "https://qa.example.com", contentType = "application/json") => exports.DELETE!(
    new Request("https://qa.example.com/api/manage/restaurants/tenant-b/catering", { method: "DELETE", headers: { origin, "Content-Type": contentType }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ slug: "tenant-b" }) },
  ) };
}

test("deletion requires same-origin JSON, exact confirmation, UUID and expected status", async () => {
  for (const [body, origin, contentType, status] of [
    [valid, "https://evil.example.com", "application/json", 403],
    [valid, "https://qa.example.com", "text/plain", 415],
    [{ ...valid, confirm: "yes" }, "https://qa.example.com", "application/json", 400],
    [{ ...valid, id: "wrong" }, "https://qa.example.com", "application/json", 400],
    [{ ...valid, expectedStatus: "unknown" }, "https://qa.example.com", "application/json", 400],
    [{ ...valid, restaurantId: id }, "https://qa.example.com", "application/json", 400],
  ] as const) {
    const local = route(); const response = await local.call(body, origin, contentType);
    assert.equal(response.status, status); assert.equal(local.calls.length, 0);
  }
  const local = route(); const response = await local.call(valid);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { deleted: true });
  assert.deepEqual(local.calls[0], ["tenant-b", id, "closed"]);
  assert.match(response.headers.get("cache-control")!, /no-store/);
});

test("denied, conflicting and unavailable deletion never claims success or exposes customer data", async () => {
  for (const status of [401, 403, 409, 503]) {
    const response = await route(status).call(valid);
    assert.equal(response.status, status); assert.doesNotMatch(await response.text(), /PRIVATE_CUSTOMER|deleted/);
  }
});

test("forward deletion migration is owner-only, tenant-scoped, and preserves anti-replay without PII", () => {
  const sql = readFileSync("supabase/migrations/202610190002_catering_inquiry_deletion.sql", "utf8");
  assert.match(sql, /alter table public\.catering_inquiry_deletions enable row level security/);
  assert.match(sql, /revoke all on public\.catering_inquiry_deletions from public, anon, authenticated, service_role/);
  assert.match(sql, /require_restaurant_capability_v1\(p_restaurant_slug, 'manage_catering'\)/);
  assert.match(sql, /access_record\.member_role <> 'owner'/);
  assert.match(sql, /where restaurant_id = access_record\.restaurant_id and id = p_inquiry_id and status = p_expected_status/);
  assert.match(sql, /where restaurant_id = access_record\.restaurant_id and id = lead\.id/);
  assert.match(sql, /set search_path = '' set lock_timeout = '2s'/);
  assert.match(sql, /grant execute on function public\.delete_managed_catering_inquiry_v1\(text, uuid, text\) to authenticated/);
  assert.ok(sql.indexOf("pg_advisory_xact_lock") < sql.indexOf("select * into lead"));
  assert.ok(sql.indexOf("insert into public.catering_inquiry_deletions") < sql.indexOf("delete from public.catering_inquiries"));
  const columns = sql.split("create table public.catering_inquiry_deletions (")[1].split(");")[0];
  assert.doesNotMatch(columns, /name|email|phone|notes|request_hash|event_details/);
  assert.match(sql, /before insert on public\.catering_inquiries/);
  assert.match(sql, /where restaurant_id = new\.restaurant_id and submission_id = new\.submission_id/);
  assert.match(sql, /MM_CATERING_DELETED/);
  assert.doesNotMatch(sql, /update public\.restaurants|delete from public\.catering_submission_windows|cron\.schedule/);
});
