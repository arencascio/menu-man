import assert from "node:assert/strict";
import test from "node:test";
import {
  fulfillmentTransitionRequestSchema,
  managedOrdersQuerySchema,
  nextFulfillmentStatus,
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
    capabilities: ["view_orders", "advance_fulfillment"],
  });
  assert.equal(membership.memberRole, "staff");
  assert.deepEqual(membership.capabilities, ["view_orders", "advance_fulfillment"]);
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
