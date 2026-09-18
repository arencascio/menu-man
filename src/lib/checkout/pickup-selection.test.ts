import assert from "node:assert/strict";
import test from "node:test";
import type { PickupAvailability } from "./contracts";
import { isPickupSelectionAvailable, resolvePickupSelection } from "./pickup-selection";

const FIRST_SLOT = "2026-09-14T17:30:00.000Z";
const SECOND_SLOT = "2026-09-14T17:45:00.000Z";

function availability(overrides: Partial<PickupAvailability> = {}): PickupAvailability {
  return {
    timezone: "America/Los_Angeles",
    generatedAt: "2026-09-14T17:00:00.000Z",
    currentlyOpen: true,
    asap: { enabled: true, available: true, estimatedPickupAt: FIRST_SLOT },
    scheduled: {
      enabled: true,
      slots: [
        { pickupAt: FIRST_SLOT, label: "Mon, Sep 14, 10:30 AM PDT" },
        { pickupAt: SECOND_SLOT, label: "Mon, Sep 14, 10:45 AM PDT" },
      ],
    },
    ...overrides,
  };
}

test("checkout defaults to ASAP when it is currently available", () => {
  assert.deepEqual(resolvePickupSelection(availability()), { mode: "asap" });
});

test("checkout requires an explicit scheduled selection when ASAP is unavailable", () => {
  assert.equal(resolvePickupSelection(availability({
    currentlyOpen: false,
    asap: { enabled: true, available: false, estimatedPickupAt: null },
  })), null);
});

test("checkout preserves a scheduled selection while the server still offers it", () => {
  const current = { mode: "scheduled" as const, pickupAt: SECOND_SLOT };
  assert.deepEqual(resolvePickupSelection(availability(), current), current);
  assert.equal(isPickupSelectionAvailable(availability(), current), true);
});

test("checkout replaces a stale scheduled selection with current server availability", () => {
  const stale = { mode: "scheduled" as const, pickupAt: "2026-09-14T17:15:00.000Z" };
  assert.equal(isPickupSelectionAvailable(availability(), stale), false);
  assert.deepEqual(resolvePickupSelection(availability(), stale), { mode: "asap" });
});

test("checkout exposes no selectable pickup when the server offers none", () => {
  const unavailable = availability({
    asap: { enabled: true, available: false, estimatedPickupAt: null },
    scheduled: { enabled: true, slots: [] },
  });
  assert.equal(resolvePickupSelection(unavailable), null);
  assert.equal(isPickupSelectionAvailable(null, { mode: "asap" }), false);
});
