import assert from "node:assert/strict";
import test from "node:test";
import type { PickupAvailability } from "@/lib/checkout/contracts";
import { formatScheduledPickup, getDisplayedPickupIntent, getOrderingStatus } from "./ordering-status";

function availability(overrides: Partial<PickupAvailability> = {}): PickupAvailability {
  return {
    timezone: "America/Los_Angeles",
    generatedAt: "2026-09-27T18:00:00.000Z",
    currentlyOpen: true,
    asap: { enabled: true, available: true, estimatedPickupAt: "2026-09-27T18:20:00.000Z" },
    scheduled: { enabled: true, slots: [] },
    ...overrides,
  };
}

test("ordering status presents currently available ASAP pickup", () => {
  assert.deepEqual(getOrderingStatus(availability()), {
    state: "available",
    title: "Ordering for pickup",
    detail: "Pickup around 11:20 AM",
  });
});

test("ordering status presents the next pickup while closed, including special-hour closures", () => {
  const result = getOrderingStatus(availability({
    currentlyOpen: false,
    asap: { enabled: true, available: false, estimatedPickupAt: null },
    scheduled: { enabled: true, slots: [{ pickupAt: "2026-09-28T14:00:00.000Z", label: "Mon, Sep 28, 7:00 AM PDT" }] },
  }));
  assert.deepEqual(result, {
    state: "closed",
    title: "Pickup is currently closed",
    detail: "Next pickup: Mon, Sep 28, 7:00 AM PDT",
  });
});

test("ordering status does not call unavailable pickup a closure", () => {
  assert.deepEqual(getOrderingStatus(availability({
    currentlyOpen: true,
    asap: { enabled: false, available: false, estimatedPickupAt: null },
    scheduled: { enabled: false, slots: [] },
  })), {
    state: "unavailable",
    title: "Pickup is unavailable",
    detail: "No pickup times are currently available.",
  });
});

test("only currently valid restaurant pickup intents are displayed", () => {
  const current = availability({ scheduled: { enabled: true, slots: [{ pickupAt: "2026-09-28T14:00:00.000Z", label: "Mon, Sep 28, 7:00 AM PDT" }] } });
  assert.deepEqual(getDisplayedPickupIntent(current, { mode: "asap" }), { mode: "asap" });
  assert.deepEqual(getDisplayedPickupIntent(current, { mode: "scheduled", pickupAt: "2026-09-28T14:00:00.000Z" }), {
    mode: "scheduled", pickupAt: "2026-09-28T14:00:00.000Z",
  });
  assert.equal(getDisplayedPickupIntent(current, { mode: "scheduled", pickupAt: "2026-09-29T14:00:00.000Z" }), null);
  assert.equal(getDisplayedPickupIntent(current, { mode: "scheduled" }), null);
  assert.equal(getDisplayedPickupIntent(availability({ asap: { enabled: false, available: false, estimatedPickupAt: null } }), { mode: "asap" }), null);
});

test("scheduled pickup is formatted in the restaurant timezone", () => {
  assert.deepEqual(formatScheduledPickup("2026-09-28T14:50:00.000Z", "America/Los_Angeles"), { day: "Mon, Sep 28", time: "7:50 AM" });
});
