import assert from "node:assert/strict";
import { test } from "node:test";
import { mutateHeart, type HeartStore } from "./heart-mutation";
import { createHeartLimiter, heartVisitor } from "./heart-security";

function memoryStore() {
  const rows = new Set<string>();
  const key = (restaurantId: string, itemId: string, visitorKey: string) => `${restaurantId}:${itemId}:${visitorKey}`;
  const store: HeartStore = {
    async has(restaurantId, itemId, visitorKey) { return rows.has(key(restaurantId, itemId, visitorKey)); },
    async recent(restaurantId, itemId) { return [...rows].filter((row) => row.startsWith(`${restaurantId}:${itemId}:`)).length; },
    async add(restaurantId, itemId, visitorKey) { rows.add(key(restaurantId, itemId, visitorKey)); },
    async remove(restaurantId, itemId, visitorKey) { rows.delete(key(restaurantId, itemId, visitorKey)); },
    async count(restaurantId, itemId) { return [...rows].filter((row) => row.startsWith(`${restaurantId}:${itemId}:`)).length; },
  };
  return store;
}

test("signed anonymous visitor hearts once, sees the state later, and can unlike", async () => {
  const store = memoryStore();
  const issued = heartVisitor(undefined, "secret");
  const later = heartVisitor(issued.cookie, "secret");
  const input = { restaurantId: "a", itemId: "item", visitorKey: issued.key, sourceKey: null, liked: true };
  assert.deepEqual(await mutateHeart(store, input), { status: 200, body: { itemId: "item", liked: true, count: 1 } });
  assert.deepEqual(await mutateHeart(store, input), { status: 200, body: { itemId: "item", liked: true, count: 1 } });
  assert.equal(later.key, issued.key);
  assert.equal(await store.has("a", "item", later.key), true);
  assert.deepEqual(await mutateHeart(store, { ...input, liked: false }),
    { status: 200, body: { itemId: "item", liked: false, count: 0 } });
});

test("mutation limiter blocks new votes but does not block unlikes", async () => {
  const store = memoryStore();
  const limiter = createHeartLimiter(() => 1_000);
  for (let index = 0; index < 20; index++) {
    assert.equal((await mutateHeart(store, { restaurantId: "a", itemId: "item", visitorKey: `v${index}`,
      sourceKey: "one-network", liked: true }, limiter)).status, 200);
  }
  assert.equal((await mutateHeart(store, { restaurantId: "a", itemId: "item", visitorKey: "blocked",
    sourceKey: "one-network", liked: true }, limiter)).status, 429);
  assert.equal((await mutateHeart(store, { restaurantId: "a", itemId: "item", visitorKey: "v0",
    sourceKey: "one-network", liked: false }, limiter)).status, 200);
});
