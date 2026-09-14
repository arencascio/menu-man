import assert from "node:assert/strict";
import test from "node:test";
import { formatPickupDateTime } from "./pickup-presentation";

test("pickup snapshot formatting uses the restaurant timezone", () => {
  const formatted = formatPickupDateTime(
    "2026-09-14T17:30:00.000Z",
    "America/Los_Angeles",
  );
  assert.match(formatted, /Mon, Sep 14/);
  assert.match(formatted, /10:30 AM/);
  assert.match(formatted, /PDT/);
});

test("pickup snapshot formatting fails safely for an invalid timezone", () => {
  assert.equal(formatPickupDateTime("2026-09-14T17:30:00.000Z", "Invalid/Zone"), "2026-09-14T17:30:00.000Z");
});
