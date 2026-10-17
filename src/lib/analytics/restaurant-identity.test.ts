import assert from "node:assert/strict";
import test from "node:test";
import { createRestaurantIdentity, type RestaurantIdentity } from "./restaurant-identity";

const day = 24 * 60 * 60 * 1000;
const minute = 60 * 1000;
function harness() {
  const values = new Map<string, string>();
  const queues = new Map<string, Promise<void>>();
  let time = 1_800_000_000_000;
  let sequence = 1;
  let reads = 0;
  const storage = {
    getItem(key: string) { reads++; return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
  };
  const deps = {
    storage: () => storage,
    lock: async <T>(key: string, task: () => T) => {
      const previous = queues.get(key) ?? Promise.resolve();
      let release!: () => void;
      const next = new Promise<void>((done) => { release = done; });
      queues.set(key, previous.then(() => next));
      await previous;
      try { return await task(); } finally { release(); }
    },
    randomId: () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
    now: () => time,
  };
  return { deps, values, storage, setTime: (value: number) => { time = value; }, now: () => time, reads: () => reads };
}
async function receive(manager: ReturnType<typeof createRestaurantIdentity>, environment = "staging", tenant = "tenant-a", allowed = () => true) {
  const received: RestaurantIdentity[] = [];
  await manager.withIdentity(environment, tenant, allowed, (identity) => { received.push(identity); });
  return received[0] ?? null;
}

test("identity survives reloads and tabs, while 30-minute inactivity starts a separate visit", async () => {
  const h = harness();
  const tabA = createRestaurantIdentity(h.deps);
  const first = await receive(tabA);
  assert.equal(first?.mode, "persistent");
  h.setTime(h.now() + 29 * minute);
  const tabB = createRestaurantIdentity(h.deps);
  const sameVisit = await receive(tabB);
  assert.equal(sameVisit?.distinctId, first?.distinctId);
  assert.equal(sameVisit?.visitId, first?.visitId);
  h.setTime(h.now() + 30 * minute);
  const returnVisit = await receive(tabA);
  assert.equal(returnVisit?.distinctId, first?.distinctId);
  assert.notEqual(returnVisit?.visitId, first?.visitId);
  assert.equal((await receive(tabB))?.visitId, returnVisit?.visitId);
});

test("90-day expiry is fixed from creation, and tenant/environment identities never overlap", async () => {
  const h = harness();
  const manager = createRestaurantIdentity(h.deps);
  const first = await receive(manager);
  assert.notEqual((await receive(manager, "staging", "tenant-b"))?.distinctId, first?.distinctId);
  assert.notEqual((await receive(manager, "production", "tenant-a"))?.distinctId, first?.distinctId);
  h.setTime(h.now() + 89 * day);
  assert.equal((await receive(manager))?.distinctId, first?.distinctId);
  h.setTime(h.now() + day);
  const rotated = await receive(createRestaurantIdentity(h.deps));
  assert.notEqual(rotated?.distinctId, first?.distinctId);
  assert.equal(rotated?.mode, "persistent");
});

test("cross-tab first creation and simultaneous visit rollover converge under the browser lock", async () => {
  const h = harness();
  const a = createRestaurantIdentity(h.deps), b = createRestaurantIdentity(h.deps);
  const [firstA, firstB] = await Promise.all([receive(a), receive(b)]);
  assert.equal(firstA?.distinctId, firstB?.distinctId);
  assert.equal(firstA?.visitId, firstB?.visitId);
  h.setTime(h.now() + 30 * minute);
  const [nextA, nextB] = await Promise.all([receive(a), receive(b)]);
  assert.equal(nextA?.visitId, nextB?.visitId);
  assert.notEqual(nextA?.visitId, firstA?.visitId);
});

test("withdrawal clears only the tenant identity and suppresses open tabs until resumed", async () => {
  const h = harness();
  const a = createRestaurantIdentity(h.deps), b = createRestaurantIdentity(h.deps);
  const first = await receive(a);
  const other = await receive(a, "staging", "tenant-b");
  assert.equal(await a.withdraw("staging", "tenant-a", () => true), true);
  assert.equal(await a.isWithdrawn("staging", "tenant-a", () => true), true);
  assert.equal(await receive(b), null);
  assert.equal((await receive(b, "staging", "tenant-b"))?.distinctId, other?.distinctId);
  await b.resume("staging", "tenant-a", () => true);
  const resumed = await receive(a);
  assert.notEqual(resumed?.distinctId, first?.distinctId);
});

test("denied and unknown environments never touch analytics storage or random identity", async () => {
  const h = harness();
  const manager = createRestaurantIdentity(h.deps);
  assert.equal(await receive(manager, "staging", "tenant-a", () => false), null);
  assert.equal(await receive(manager, "unknown"), null);
  assert.equal(await manager.isWithdrawn("staging", "tenant-a", () => false), null);
  assert.equal(await manager.withdraw("staging", "tenant-a", () => false), false);
  assert.equal(h.reads(), 0);
  assert.equal(h.values.size, 0);
});

test("unavailable storage or cross-tab locking uses separate ephemeral identities", async () => {
  const h = harness();
  const blocked = { ...h.deps, storage: () => null };
  const a = createRestaurantIdentity(blocked), b = createRestaurantIdentity(blocked);
  const first = await receive(a);
  assert.equal(first?.mode, "ephemeral");
  assert.equal((await receive(a))?.distinctId, first?.distinctId);
  assert.notEqual((await receive(b))?.distinctId, first?.distinctId);
  const noLock = createRestaurantIdentity({ ...h.deps, lock: async () => { throw Error("locks unavailable"); } });
  assert.equal((await receive(noLock))?.mode, "ephemeral");
  assert.equal(h.values.size, 0);
});

test("malformed state rotates; unavailable crypto drops analytics rather than sharing SDK identity", async () => {
  const h = harness();
  h.values.set("menu-man:restaurant-identity:v1:staging:tenant-a", '{"distinctId":"marketing-id"}');
  assert.equal((await receive(createRestaurantIdentity(h.deps)))?.mode, "persistent");
  h.values.clear();
  const noCrypto = createRestaurantIdentity({ ...h.deps, randomId: () => null });
  assert.equal(await receive(noCrypto), null);
});

test("storage failure and local withdrawal retain safe in-document behavior", async () => {
  const h = harness();
  const failing = createRestaurantIdentity({ ...h.deps, storage: () => ({
    getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); }, removeItem() { throw Error("blocked"); },
  }) });
  assert.equal((await receive(failing))?.mode, "ephemeral");
  assert.equal(await failing.withdraw("staging", "tenant-a", () => true), false);
  assert.equal(await receive(failing), null);
  assert.equal(await failing.resume("staging", "tenant-a", () => true), false);
  assert.equal(await receive(failing), null);
});
