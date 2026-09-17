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
  assert.match(queue, /order\.itemCount/);
  assert.match(queue, /order\.totalCents/);
  assert.match(queue, /formatQueuePaymentLabel/);
  assert.doesNotMatch(queue, /refundedCents \/ 100} refunded/);
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
  assert.match(detail, /data-exception-actions-slot="reserved"/);
});

test("refund management accepts intent only and keeps provider authority server-side", () => {
  const action = source("src", "app", "manage", "[slug]", "orders", "[orderId]", "RefundAction.tsx");
  const route = source("src", "app", "api", "manage", "restaurants", "[slug]", "orders", "[orderId]", "refunds", "route.ts");
  const server = source("src", "lib", "order-management", "server.ts");
  assert.match(action, /Full remaining refund/);
  assert.match(action, /Partial refund/);
  assert.match(action, /original payment method/i);
  assert.doesNotMatch(action, /window\.confirm|confirm\s*\(/);
  assert.match(route, /managedRefundRequestSchema\.safeParse/);
  assert.match(route, /executeReservedRefund/);
  assert.doesNotMatch(route, /providerPaymentReference|payment_status|refunded_cents|currency:/);
  assert.match(server, /reserve_managed_refund_v1/);
  assert.match(server, /p_client_action_id: input\.clientActionId/);
});

test("team management uses trusted routes, final permissions, and an audited lifecycle", () => {
  const team = source("src", "app", "manage", "[slug]", "team", "TeamManager.tsx");
  const teamServer = source("src", "lib", "order-management", "team-server.ts");
  const teamRoute = source("src", "app", "api", "manage", "restaurants", "[slug]", "team", "route.ts");
  const callback = source("src", "app", "auth", "callback", "route.ts");
  assert.match(team, /Final permissions/);
  assert.match(team, /Sensitive/);
  assert.match(team, /Resend invite/);
  assert.match(team, /Reinstate/);
  assert.match(teamServer, /auth\.admin\.inviteUserByEmail/);
  assert.match(teamServer, /authorize_restaurant_member_invite_v1/);
  assert.match(teamServer, /provision_restaurant_member_v1/);
  assert.match(teamRoute, /private, no-store/);
  assert.match(callback, /activate_my_restaurant_memberships_v1/);
  assert.doesNotMatch(team, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("order detail fulfillment clears pending state and immediately advances its authoritative action", () => {
  const action = source("src", "app", "manage", "[slug]", "orders", "[orderId]", "FulfillmentAction.tsx");
  const route = source("src", "app", "api", "manage", "restaurants", "[slug]", "orders", "[orderId]", "fulfillment", "route.ts");
  assert.match(action, /fulfillmentTransitionResultSchema\.parse\(payload\)/);
  assert.match(action, /setCurrent\(\{ status: result\.status, version: result\.version \}\)/);
  assert.match(action, /router\.refresh\(\)/);
  assert.match(action, /finally \{ setPending\(false\); \}/);
  assert.match(action, /setError\(updateError instanceof Error/);
  assert.match(route, /revalidatePath\(`\/manage\/\$\{slug\}\/orders\/\$\{orderId\}`\)/);
});

test("revoked management access clears protected data and stops polling and realtime", () => {
  const queue = source("src", "app", "manage", "[slug]", "orders", "OrderQueue.tsx");
  const guard = source("src", "app", "manage", "[slug]", "orders", "[orderId]", "OrderDetailAccessGuard.tsx");
  assert.match(queue, /setPage\(\{ orders: \[\], nextCursor: null \}\)/);
  assert.match(queue, /if \(accessLost\) return;/);
  assert.match(queue, /removeChannel\(channel\)/);
  assert.match(guard, /response\.status === 403/);
  assert.match(guard, /if \(accessLost\) return <AccessRevoked/);
});

test("management headers show member display name and role", () => {
  for (const parts of [
    ["src", "app", "manage", "[slug]", "orders", "page.tsx"],
    ["src", "app", "manage", "[slug]", "team", "page.tsx"],
  ]) {
    const page = source(...parts);
    assert.match(page, /membership\.displayName/);
    assert.match(page, /membership\.memberRole/);
  }
});

test("management home exposes a selector for users with multiple restaurant memberships", () => {
  const page = source("src", "app", "manage", "page.tsx");
  assert.match(page, /memberships\.length === 1/);
  assert.match(page, /Choose a restaurant/);
  assert.match(page, /memberships\.map/);
  assert.match(page, /membership\.restaurantSlug/);
});

test("restaurant staging fixtures can be excluded from indexing across customer routes", () => {
  const layout = source("src", "app", "r", "[slug]", "layout.tsx");
  const sitemap = source("src", "app", "sitemap.ts");
  assert.match(layout, /is_indexable/);
  assert.match(layout, /index: false, follow: false/);
  assert.match(sitemap, /\.eq\("is_indexable", true\)/);
});

test("CSV export is server streamed with attachment and no-store headers", () => {
  const route = source("src", "app", "api", "manage", "restaurants", "[slug]", "orders", "export", "route.ts");
  const queue = source("src", "app", "manage", "[slug]", "orders", "OrderQueue.tsx");
  assert.match(route, /ReadableStream/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /private, no-store/);
  assert.match(route, /createManagedOrderExportPager/);
  assert.match(queue, /Download CSV/);
  assert.match(queue, /dateBasis/);
});

test("notification settings and delivery stay behind server authorization", () => {
  const settings = source("src", "app", "api", "manage", "restaurants", "[slug]", "settings", "notifications", "route.ts");
  const worker = source("src", "app", "api", "internal", "notifications", "deliver", "route.ts");
  const delivery = source("src", "lib", "notifications", "worker.ts");
  const nav = source("src", "app", "manage", "[slug]", "ManagementNav.tsx");
  assert.match(settings, /updateNotificationSettingsRequestSchema\.safeParse/);
  assert.match(settings, /private, no-store/);
  assert.match(worker, /process\.env\.CRON_SECRET/);
  assert.match(delivery, /process\.env\.RESEND_API_KEY/);
  assert.match(delivery, /process\.env\.MENU_MAN_ORDER_EMAIL_FROM/);
  assert.doesNotMatch(nav, /RESEND_API_KEY/);
  assert.match(nav, /manage_notifications/);
});

test("revoked access can recover only after an authoritative membership refetch", () => {
  const revoked = source("src", "app", "manage", "[slug]", "AccessRevoked.tsx");
  const route = source("src", "app", "api", "manage", "memberships", "route.ts");
  assert.match(revoked, /fetch\("\/api\/manage\/memberships", \{ cache: "no-store" \}\)/);
  assert.match(revoked, /window\.location\.reload\(\)/);
  assert.match(route, /listRestaurantMemberships/);
  assert.match(route, /private, no-store/);
});
