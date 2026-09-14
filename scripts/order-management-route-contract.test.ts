import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

test("management UI has the three approved active columns and separate history", () => {
  const queue = source("src", "app", "manage", "[slug]", "orders", "OrderQueue.tsx");
  assert.match(queue, /\["new", "preparing", "ready"\] as const/);
  assert.match(queue, /Completed \/ history/);
  assert.doesNotMatch(queue, /\baccepted\b/i);
  for (const preset of ["Today", "Last 7 days", "Last 30 days", "Last 90 days", "Custom"]) {
    assert.match(queue, new RegExp(preset));
  }
});

test("management live updates are advisory and refetch authoritative server state", () => {
  const queue = source("src", "app", "manage", "[slug]", "orders", "OrderQueue.tsx");
  assert.match(queue, /supabase\.channel\(`restaurant:\$\{restaurantId\}:orders`/);
  assert.match(queue, /new BroadcastChannel\(`menu-man-orders:\$\{restaurantId\}`\)/);
  assert.match(queue, /fetch\(buildUrl\(targetView, cursor\), \{ cache: "no-store" \}\)/);
  assert.match(queue, /window\.setInterval\([^]*15_000/);
});

test("management data routes use authenticated RPCs and no-store responses", () => {
  const dataAccess = source("src", "lib", "order-management", "server.ts");
  const listRoute = source("src", "app", "api", "manage", "restaurants", "[slug]", "orders", "route.ts");
  const transitionRoute = source("src", "app", "api", "manage", "restaurants", "[slug]", "orders", "[orderId]", "fulfillment", "route.ts");
  assert.match(dataAccess, /auth\.getClaims\(\)/);
  assert.match(dataAccess, /list_managed_orders_v1/);
  assert.match(dataAccess, /transition_order_fulfillment_v1/);
  assert.doesNotMatch(dataAccess, /SUPABASE_SERVICE_ROLE_KEY|supabaseServer/);
  assert.match(listRoute, /private, no-store/);
  assert.match(dataAccess, /p_expected_version: input\.expectedVersion/);
  assert.match(transitionRoute, /fulfillmentTransitionRequestSchema\.safeParse/);
  assert.doesNotMatch(transitionRoute, /payment_status|total_cents|order_status/);
});

test("order detail renders the immutable operational snapshot and sanitized timeline", () => {
  const detail = source("src", "app", "manage", "[slug]", "orders", "[orderId]", "page.tsx");
  for (const text of ["Ordered items", "Operational timeline", "Customer", "Receipt", "Fulfillment:"]) {
    assert.match(detail, new RegExp(text));
  }
  assert.match(detail, /order\.orderNumber/);
  assert.match(detail, /order\.pickup\.pickupAt/);
  assert.match(detail, /order\.items\.map/);
});
