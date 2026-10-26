import assert from "node:assert/strict";
import test from "node:test";
import { upperCrustToday } from "./site-content";

test("today hours change at Los Angeles midnight rather than UTC midnight", () => {
  assert.deepEqual(upperCrustToday(new Date("2026-10-26T06:59:00Z")), { day: "Sunday", hours: "11 AM–4 PM" });
  assert.deepEqual(upperCrustToday(new Date("2026-10-26T07:00:00Z")), { day: "Monday", hours: "10 AM–5 PM" });
  assert.deepEqual(upperCrustToday(new Date("2026-11-02T07:59:00Z")), { day: "Sunday", hours: "11 AM–4 PM" });
  assert.deepEqual(upperCrustToday(new Date("2026-11-02T08:00:00Z")), { day: "Monday", hours: "10 AM–5 PM" });
});
