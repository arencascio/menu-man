import assert from "node:assert/strict";
import test from "node:test";
import type { PickupAvailability } from "@/lib/checkout/contracts";
import { groupPickupSlots, initialChooserSelection, isChooserSelectionAvailable } from "./pickup-time-chooser";

const first = "2026-09-28T23:50:00.000Z";
const second = "2026-09-29T00:10:00.000Z";
const third = "2026-09-29T14:00:00.000Z";

function availability(): PickupAvailability {
  return {
    timezone: "America/Los_Angeles",
    generatedAt: "2026-09-28T23:00:00.000Z",
    currentlyOpen: true,
    asap: { enabled: true, available: true, estimatedPickupAt: first },
    scheduled: { enabled: true, slots: [
      { pickupAt: first, label: "Mon, Sep 28, 4:50 PM PDT" },
      { pickupAt: second, label: "Mon, Sep 28, 5:10 PM PDT" },
      { pickupAt: third, label: "Tue, Sep 29, 7:00 AM PDT" },
    ] },
  };
}

test("Order Pickup defaults to ASAP but accepts an authoritative later slot", () => {
  const current = availability();
  assert.deepEqual(initialChooserSelection("order", current), { mode: "asap" });
  assert.equal(isChooserSelectionAvailable("order", current, { mode: "scheduled", pickupAt: second }), true);
});

test("Schedule Pickup never accepts ASAP and leaves future times unselected", () => {
  const current = availability();
  assert.equal(initialChooserSelection("schedule", current), null);
  assert.equal(isChooserSelectionAvailable("schedule", current, { mode: "asap" }), false);
  assert.equal(isChooserSelectionAvailable("schedule", current, { mode: "scheduled", pickupAt: first }), true);
});

test("rechecking availability rejects slots removed by hours, special hours, or capacity", () => {
  const current = availability();
  const selected = { mode: "scheduled" as const, pickupAt: second };
  current.scheduled.slots = current.scheduled.slots.filter((slot) => slot.pickupAt !== second);
  assert.equal(isChooserSelectionAvailable("order", current, selected), false);
  current.asap.available = false;
  assert.equal(isChooserSelectionAvailable("order", current, { mode: "asap" }), false);
  current.scheduled.slots = [];
  assert.equal(isChooserSelectionAvailable("schedule", current, selected), false);
});

test("slots group by restaurant local date across the UTC day boundary", () => {
  const groups = groupPickupSlots(availability());
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.slots.map((slot) => slot.pickupAt)), [[first, second], [third]]);
  assert.match(groups[0].label, /Monday, Sep 28, 2026/);
  assert.match(groups[1].label, /Tuesday, Sep 29, 2026/);
  assert.equal(groups[0].slots[1].label, "5:10 PM PDT");
});
