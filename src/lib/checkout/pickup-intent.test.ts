import assert from "node:assert/strict";
import test from "node:test";
import { readPickupIntent, savePickupIntent, takePickupIntent } from "./pickup-intent";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, value); },
  } as Storage;
}

test("pickup intents are restaurant scoped, short lived, and consumed once", () => {
  const session = storage();
  const now = Date.parse("2026-09-27T18:00:00.000Z");
  const pickupAt = "2026-09-28T18:40:00.000Z";
  savePickupIntent(session, "restaurant-a", { mode: "scheduled", pickupAt }, now);

  assert.equal(takePickupIntent(session, "restaurant-b", now), null);
  assert.deepEqual(takePickupIntent(session, "restaurant-a", now), { mode: "scheduled", pickupAt });
  assert.equal(takePickupIntent(session, "restaurant-a", now), null);
});

test("reading a pickup intent does not consume it", () => {
  const session = storage();
  const now = Date.parse("2026-09-27T18:00:00.000Z");
  savePickupIntent(session, "restaurant-a", { mode: "asap" }, now);

  assert.deepEqual(readPickupIntent(session, "restaurant-a", now), { mode: "asap" });
  assert.deepEqual(takePickupIntent(session, "restaurant-a", now), { mode: "asap" });
});

test("legacy scheduled intent still requests an explicit time in checkout", () => {
  const session = storage();
  const now = Date.parse("2026-09-27T18:00:00.000Z");
  session.setItem("menu-man:pickup-intent:v1:restaurant-a", JSON.stringify({
    version: 1, restaurantId: "restaurant-a", mode: "scheduled",
    expiresAt: new Date(now + 60_000).toISOString(),
  }));
  assert.deepEqual(takePickupIntent(session, "restaurant-a", now), { mode: "scheduled" });
});

test("malformed scheduled time is not handed to checkout", () => {
  const session = storage();
  const now = Date.parse("2026-09-27T18:00:00.000Z");
  session.setItem("menu-man:pickup-intent:v1:restaurant-a", JSON.stringify({
    version: 1, restaurantId: "restaurant-a", mode: "scheduled", pickupAt: "invalid",
    expiresAt: new Date(now + 60_000).toISOString(),
  }));
  assert.equal(takePickupIntent(session, "restaurant-a", now), null);
});

test("expired pickup intents are ignored", () => {
  const session = storage();
  const now = Date.parse("2026-09-27T18:00:00.000Z");
  savePickupIntent(session, "restaurant-a", { mode: "asap" }, now);

  assert.equal(takePickupIntent(session, "restaurant-a", now + (31 * 60 * 1_000)), null);
});
