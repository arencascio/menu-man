import type { PickupSelection } from "./pickup-selection";

export const pickupIntentEvent = "menu-man:pickup-intent";

// Older saved intents requested scheduled pickup without a specific time.
export type PickupIntent = { mode: "asap" } | { mode: "scheduled"; pickupAt?: string };

type StoredPickupIntent = PickupIntent & {
  expiresAt: string;
  restaurantId: string;
  version: 1;
};

const PICKUP_INTENT_TTL_MS = 30 * 60 * 1_000;
const PICKUP_INTENT_PREFIX = "menu-man:pickup-intent:v1:";

function key(restaurantId: string) {
  return `${PICKUP_INTENT_PREFIX}${restaurantId}`;
}

export function savePickupIntent(storage: Storage, restaurantId: string, intent: PickupSelection, now = Date.now()) {
  const value: StoredPickupIntent = {
    ...intent,
    expiresAt: new Date(now + PICKUP_INTENT_TTL_MS).toISOString(),
    restaurantId,
    version: 1,
  };
  storage.setItem(key(restaurantId), JSON.stringify(value));
}

export function takePickupIntent(storage: Storage, restaurantId: string, now = Date.now()): PickupIntent | null {
  const storageKey = key(restaurantId);
  try {
    const candidate = JSON.parse(storage.getItem(storageKey) ?? "null") as Partial<StoredPickupIntent> | null;
    storage.removeItem(storageKey);
    if (
      candidate?.version !== 1
      || candidate.restaurantId !== restaurantId
      || (candidate.mode !== "asap" && candidate.mode !== "scheduled")
      || typeof candidate.expiresAt !== "string"
      || !Number.isFinite(Date.parse(candidate.expiresAt))
      || Date.parse(candidate.expiresAt) <= now
    ) return null;
    if (candidate.mode === "asap") return { mode: "asap" };
    if ("pickupAt" in candidate && candidate.pickupAt !== undefined) {
      if (typeof candidate.pickupAt !== "string" || !Number.isFinite(Date.parse(candidate.pickupAt))) return null;
      return { mode: "scheduled", pickupAt: candidate.pickupAt };
    }
    return { mode: "scheduled" };
  } catch {
    storage.removeItem(storageKey);
    return null;
  }
}
