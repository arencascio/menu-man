import type { TipChoice } from "./contracts";
import type { PickupSelection } from "./pickup-selection";

export const CHECKOUT_DRAFT_TTL_MS = 2 * 60 * 60 * 1_000;
const CHECKOUT_DRAFT_PREFIX = "menu-man:checkout-draft:v1:";

export type CheckoutDraft = {
  version: 1;
  restaurantId: string;
  expiresAt: string;
  customerName: string;
  phone: string;
  email: string;
  pickup: PickupSelection;
  tipChoice: TipChoice;
  customTipAmount: string;
  orderNotes: string;
};

function key(restaurantId: string) {
  return `${CHECKOUT_DRAFT_PREFIX}${restaurantId}`;
}

function isString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isPickupSelection(value: unknown): value is PickupSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pickup = value as Partial<PickupSelection>;
  return pickup.mode === "asap"
    || (pickup.mode === "scheduled" && isString(pickup.pickupAt, 100) && pickup.pickupAt.length > 0);
}

const tipChoices = new Set<TipChoice>([
  "none", "10_percent", "15_percent", "20_percent", "custom",
]);

export function loadCheckoutDraft(
  storage: Storage,
  restaurantId: string,
  now = Date.now(),
): CheckoutDraft | null {
  const storageKey = key(restaurantId);
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<CheckoutDraft>;
    if (
      draft.version !== 1
      || draft.restaurantId !== restaurantId
      || !isString(draft.expiresAt, 100)
      || !Number.isFinite(Date.parse(draft.expiresAt))
      || Date.parse(draft.expiresAt) <= now
      || !isString(draft.customerName, 100)
      || !isString(draft.phone, 30)
      || !isString(draft.email, 254)
      || !isPickupSelection(draft.pickup)
      || !tipChoices.has(draft.tipChoice as TipChoice)
      || !isString(draft.customTipAmount, 30)
      || !isString(draft.orderNotes, 500)
    ) {
      storage.removeItem(storageKey);
      return null;
    }
    return draft as CheckoutDraft;
  } catch {
    storage.removeItem(storageKey);
    return null;
  }
}

export function saveCheckoutDraft(
  storage: Storage,
  draft: Omit<CheckoutDraft, "version" | "expiresAt">,
  now = Date.now(),
) {
  const stored: CheckoutDraft = {
    ...draft,
    version: 1,
    expiresAt: new Date(now + CHECKOUT_DRAFT_TTL_MS).toISOString(),
  };
  storage.setItem(key(draft.restaurantId), JSON.stringify(stored));
}

export function clearCheckoutDraft(storage: Storage, restaurantId: string) {
  storage.removeItem(key(restaurantId));
}
