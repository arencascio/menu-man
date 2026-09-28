import assert from "node:assert/strict";
import test from "node:test";
import { savePickupIntent, takePickupIntent } from "./pickup-intent";

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
  savePickupIntent(session, "restaurant-a", { mode: "scheduled" }, now);

  assert.equal(takePickupIntent(session, "restaurant-b", now), null);
  assert.deepEqual(takePickupIntent(session, "restaurant-a", now), { mode: "scheduled" });
  assert.equal(takePickupIntent(session, "restaurant-a", now), null);
});

test("expired pickup intents are ignored", () => {
  const session = storage();
  const now = Date.parse("2026-09-27T18:00:00.000Z");
  savePickupIntent(session, "restaurant-a", { mode: "asap" }, now);

  assert.equal(takePickupIntent(session, "restaurant-a", now + (31 * 60 * 1_000)), null);
});
