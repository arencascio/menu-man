import assert from "node:assert/strict";
import test from "node:test";
import {
  fulfillmentTransitionRequestSchema,
  describeRestaurantAccessEvent,
  formatQueuePaymentLabel,
  managedOrdersQuerySchema,
  managedRefundRequestSchema,
  nextFulfillmentStatus,
  inviteRestaurantMemberRequestSchema,
  restaurantMembershipSchema,
  timingState,
} from "./contracts";

test("restaurant roles carry validated granular capabilities", () => {
  const membership = restaurantMembershipSchema.parse({
    membershipId: "11111111-1111-4111-8111-111111111111",
    restaurantId: "22222222-2222-4222-8222-222222222222",
    restaurantName: "Test Restaurant",
    restaurantSlug: "test-restaurant",
    restaurantTimezone: "America/Los_Angeles",
    memberRole: "staff",
    displayName: "Test Staff",
    capabilities: ["view_orders", "advance_fulfillment", "manage_notifications"],
  });
  assert.equal(membership.memberRole, "staff");
  assert.deepEqual(membership.capabilities, ["view_orders", "advance_fulfillment", "manage_notifications"]);
});

test("membership audit presentation shows friendly role and permission deltas", () => {
  const presentation = describeRestaurantAccessEvent({
    eventId: "42",
    targetMembershipId: "11111111-1111-4111-8111-111111111111",
    targetDisplayName: "Test Staff",
    actorDisplayName: "Test Owner",
    action: "membership.role_changed",
    previousState: { role: "staff", capabilities: ["view_orders", "view_customer_contact"] },
    nextState: { role: "manager", capabilities: ["view_orders", "manage_memberships", "manage_notifications"] },
    reason: null,
    metadata: {},
    createdAt: "2026-09-14T18:00:00Z",
  });
  assert.equal(presentation.title, "Role changed");
  assert.deepEqual(presentation.details, [
    "Staff → Manager",
    "Added: Manage team, Manage notifications",
    "Removed: View customer contact",
  ]);
});

test("team invitations validate identity, role, final permissions, and idempotency", () => {
  const invite = inviteRestaurantMemberRequestSchema.parse({
    email: " Employee@Example.com ",
    displayName: "Kitchen Lead",
    role: "manager",
    capabilities: ["view_orders", "manage_memberships", "view_orders"],
    clientActionId: "33333333-3333-4333-8333-333333333333",
  });
  assert.equal(invite.email, "employee@example.com");
  assert.deepEqual(invite.capabilities, ["manage_memberships", "view_orders"]);
  assert.equal(inviteRestaurantMemberRequestSchema.safeParse({
    ...invite,
    role: "administrator",
  }).success, false);
});

test("fulfillment progression is forward-only and has no accepted state", () => {
  assert.equal(nextFulfillmentStatus("new"), "preparing");
  assert.equal(nextFulfillmentStatus("preparing"), "ready");
  assert.equal(nextFulfillmentStatus("ready"), "completed");
  assert.equal(nextFulfillmentStatus("completed"), null);
  assert.equal(fulfillmentTransitionRequestSchema.safeParse({
    expectedVersion: 1,
    nextStatus: "accepted",
    clientActionId: "11111111-1111-4111-8111-111111111111",
  }).success, false);
});

test("due-soon begins at ten minutes and late begins after promised pickup", () => {
  const now = Date.parse("2026-09-14T18:00:00Z");
  assert.deepEqual(timingState("2026-09-14T18:10:00Z", now), { tone: "due", label: "Due in 10 min" });
  assert.deepEqual(timingState("2026-09-14T18:10:01Z", now), { tone: "normal", label: "Due in 11 min" });
  assert.deepEqual(timingState("2026-09-14T18:11:00Z", now), { tone: "normal", label: "Due in 11 min" });
  assert.deepEqual(timingState("2026-09-14T17:52:00Z", now), { tone: "late", label: "8 min late" });
});

test("history query requires complete cursors and ordered custom ranges", () => {
  assert.equal(managedOrdersQuerySchema.safeParse({ view: "history", from: "2026-09-01", to: "2026-09-14", limit: 50 }).success, true);
  assert.equal(managedOrdersQuerySchema.safeParse({ view: "history", from: "2026-09-14", to: "2026-09-01", limit: 50 }).success, false);
  assert.equal(managedOrdersQuerySchema.safeParse({ view: "history", cursorAt: "2026-09-14T18:00:00Z", limit: 50 }).success, false);
});

test("queue refund labels show one normalized status and one formatted amount", () => {
  assert.equal(formatQueuePaymentLabel("refunded", 1494), "REFUNDED · $14.94");
  assert.equal(formatQueuePaymentLabel("partially_refunded", 500), "PARTIALLY REFUNDED · $5.00");
  assert.equal(formatQueuePaymentLabel("paid", 0), "PAID");
});

test("managed refund intent requires positive cents, a trimmed reason, and a stable action id", () => {
  const parsed = managedRefundRequestSchema.parse({
    amountCents: 1250,
    reason: "  Customer request  ",
    clientActionId: "11111111-1111-4111-8111-111111111111",
  });
  assert.equal(parsed.reason, "Customer request");
  for (const amountCents of [0, -1, 1.5]) {
    assert.equal(managedRefundRequestSchema.safeParse({ ...parsed, amountCents }).success, false);
  }
  assert.equal(managedRefundRequestSchema.safeParse({ ...parsed, reason: "   " }).success, false);
  assert.equal(managedRefundRequestSchema.safeParse({ ...parsed, reason: "x".repeat(501) }).success, false);
});
