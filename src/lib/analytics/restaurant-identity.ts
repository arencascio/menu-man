const lifetimeMs = 90 * 24 * 60 * 60 * 1000;
const idleMs = 30 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const restaurantId = /^[a-zA-Z0-9_-]{1,128}$/;
const environments = new Set(["production", "staging", "development"]);

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type RecordV1 = {
  version: 1;
  distinctId: string;
  visitId: string;
  createdAt: number;
  expiresAt: number;
  visitStartedAt: number;
  lastActivityAt: number;
};
export type RestaurantIdentity = {
  distinctId: string;
  visitId: string;
  mode: "persistent" | "ephemeral";
};
type Dependencies = {
  storage: () => StorageLike | null;
  lock: <T>(name: string, task: () => T) => Promise<T>;
  randomId: () => string | null;
  now: () => number;
};

const browserDependencies: Dependencies = {
  storage: () => typeof window === "undefined" ? null : window.localStorage,
  lock: <T>(name: string, task: () => T): Promise<T> => {
    if (typeof navigator === "undefined" || !navigator.locks?.request) throw Error("Browser locks unavailable");
    return navigator.locks.request<T>(name, () => task());
  },
  randomId: () => globalThis.crypto?.randomUUID?.() ?? null,
  now: () => Date.now(),
};

function scope(environment: string, id: string) {
  if (!environments.has(environment) || !restaurantId.test(id)) return null;
  return `${environment}:${id}`;
}
function identityKey(key: string) { return `menu-man:restaurant-identity:v1:${key}`; }
function optOutKey(key: string) { return `menu-man:restaurant-analytics-off:v1:${key}`; }
function validRecord(value: unknown, now: number): value is RecordV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<RecordV1>;
  return record.version === 1 && typeof record.distinctId === "string" && uuid.test(record.distinctId)
    && typeof record.visitId === "string" && uuid.test(record.visitId)
    && Number.isSafeInteger(record.createdAt) && Number.isSafeInteger(record.expiresAt)
    && Number.isSafeInteger(record.visitStartedAt) && Number.isSafeInteger(record.lastActivityAt)
    && record.createdAt! >= 0 && record.expiresAt === record.createdAt! + lifetimeMs
    && record.createdAt! <= record.visitStartedAt! && record.visitStartedAt! <= record.lastActivityAt!
    && record.lastActivityAt! < record.expiresAt! && record.lastActivityAt! <= now
    && now < record.expiresAt!;
}

export function createRestaurantIdentity(deps: Dependencies = browserDependencies) {
  const ephemeral = new Map<string, RecordV1>();
  const memoryOptOut = new Set<string>();
  function fresh(now: number): RecordV1 | null {
    const distinctId = deps.randomId();
    const visitId = deps.randomId();
    if (!distinctId || !visitId || !uuid.test(distinctId) || !uuid.test(visitId)) return null;
    return { version: 1, distinctId, visitId, createdAt: now, expiresAt: now + lifetimeMs,
      visitStartedAt: now, lastActivityAt: now };
  }
  function advance(record: RecordV1, now: number): RecordV1 | null {
    if (now - record.lastActivityAt < idleMs) return { ...record, lastActivityAt: now };
    const visitId = deps.randomId();
    return visitId && uuid.test(visitId) ? { ...record, visitId, visitStartedAt: now, lastActivityAt: now } : null;
  }
  function fallback(key: string, now: number, deliver: (identity: RestaurantIdentity) => void) {
    const existing = ephemeral.get(key);
    const next = validRecord(existing, now) ? advance(existing, now) : fresh(now);
    if (!next) return;
    ephemeral.set(key, next);
    deliver({ distinctId: next.distinctId, visitId: next.visitId, mode: "ephemeral" });
  }
  return {
    async withIdentity(environment: string, id: string, allowed: () => boolean, deliver: (identity: RestaurantIdentity) => void) {
      const key = scope(environment, id);
      if (!key || !allowed() || memoryOptOut.has(key)) return;
      const now = deps.now();
      if (!Number.isSafeInteger(now) || now < 0) return;
      let store: StorageLike | null;
      try { store = deps.storage(); } catch { store = null; }
      if (!store) { fallback(key, now, deliver); return; }
      let delivered = false;
      const send = (identity: RestaurantIdentity) => { delivered = true; deliver(identity); };
      try {
        if (store.getItem(optOutKey(key)) === "1") { ephemeral.delete(key); return; }
        await deps.lock(identityKey(key), () => {
          if (!allowed() || memoryOptOut.has(key) || store.getItem(optOutKey(key)) === "1") return;
          const currentTime = deps.now();
          if (!Number.isSafeInteger(currentTime) || currentTime < 0) return;
          let stored: unknown;
          try { stored = JSON.parse(store.getItem(identityKey(key)) ?? "null"); } catch { stored = null; }
          const next = validRecord(stored, currentTime) ? advance(stored, currentTime) : fresh(currentTime);
          if (!next) return;
          try {
            store.setItem(identityKey(key), JSON.stringify(next));
            if (store.getItem(identityKey(key)) !== JSON.stringify(next)) throw Error("Storage write not retained");
          } catch { fallback(key, currentTime, send); return; }
          ephemeral.delete(key);
          send({ distinctId: next.distinctId, visitId: next.visitId, mode: "persistent" });
        });
      } catch {
        // Without an atomic cross-tab lock or usable storage, do not claim continuity.
        if (!delivered && allowed() && !memoryOptOut.has(key)) fallback(key, now, deliver);
      }
    },
    async isWithdrawn(environment: string, id: string, allowed: () => boolean) {
      const key = scope(environment, id);
      if (!key || !allowed()) return null;
      if (memoryOptOut.has(key)) return true;
      try { return deps.storage()?.getItem(optOutKey(key)) === "1"; }
      catch { return false; }
    },
    async withdraw(environment: string, id: string, allowed: () => boolean) {
      const key = scope(environment, id);
      if (!key || !allowed()) return false;
      ephemeral.delete(key);
      memoryOptOut.add(key);
      try {
        const store = deps.storage();
        if (!store) return false;
        await deps.lock(identityKey(key), () => {
          store.setItem(optOutKey(key), "1");
          if (store.getItem(optOutKey(key)) !== "1") throw Error("Withdrawal not retained");
          store.removeItem(identityKey(key));
          if (store.getItem(identityKey(key)) !== null) throw Error("Identity not removed");
        });
        memoryOptOut.delete(key);
        return true;
      } catch { return false; }
    },
    async resume(environment: string, id: string, allowed: () => boolean) {
      const key = scope(environment, id);
      if (!key || !allowed()) return false;
      try {
        const store = deps.storage();
        if (store) await deps.lock(identityKey(key), () => {
          store.removeItem(identityKey(key));
          store.removeItem(optOutKey(key));
          if (store.getItem(identityKey(key)) !== null || store.getItem(optOutKey(key)) !== null)
            throw Error("Preference not removed");
        });
      } catch { return false; }
      ephemeral.delete(key);
      memoryOptOut.delete(key);
      return true;
    },
  };
}

export const restaurantIdentity = createRestaurantIdentity();
