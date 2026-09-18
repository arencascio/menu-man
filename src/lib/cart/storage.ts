import type { CartLine, StoredCart } from "./types";
import { MAX_CART_QUANTITY, MAX_SPECIAL_INSTRUCTIONS_LENGTH } from "./cart";

export const CART_STORAGE_KEY = "menu-man:cart:v1";

export function restaurantCartStorageKey(restaurantId: string) {
  return `${CART_STORAGE_KEY}:${restaurantId}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const line = value as Partial<CartLine>;

  return isNonEmptyString(line.lineId)
    && isNonEmptyString(line.menuItemId)
    && isNonEmptyString(line.sectionId)
    && isNonEmptyString(line.sectionName)
    && isNonEmptyString(line.itemName)
    && isPositiveInteger(line.quantity)
    && line.quantity <= MAX_CART_QUANTITY
    && isNonNegativeInteger(line.basePriceCents)
    && typeof line.specialInstructions === "string"
    && line.specialInstructions.length <= MAX_SPECIAL_INSTRUCTIONS_LENGTH
    && Array.isArray(line.selectedModifiers)
    && line.selectedModifiers.every((selection) => Boolean(
      selection
      && typeof selection === "object"
      && isNonEmptyString(selection.modifierGroupId)
      && isNonEmptyString(selection.modifierGroupName)
      && isNonEmptyString(selection.modifierOptionId)
      && isNonEmptyString(selection.modifierOptionName)
      && isNonNegativeInteger(selection.priceAdjustmentCents),
    ));
}

export function parseStoredCart(value: string | null): StoredCart | null {
  if (!value) return null;

  try {
    const cart = JSON.parse(value) as Partial<StoredCart>;
    if (
      cart.version !== 1
      || !isNonEmptyString(cart.restaurantId)
      || !isNonEmptyString(cart.currency)
      || !isNonEmptyString(cart.updatedAt)
      || !Array.isArray(cart.lines)
      || !cart.lines.every(isCartLine)
    ) {
      return null;
    }
    return cart as StoredCart;
  } catch {
    return null;
  }
}

export function loadRestaurantCart(storage: Storage, restaurantId: string, currency: string): StoredCart {
  const scopedKey = restaurantCartStorageKey(restaurantId);
  const scopedValue = storage.getItem(scopedKey);
  const scopedCart = parseStoredCart(scopedValue);

  if (scopedCart?.restaurantId === restaurantId) {
    return { ...scopedCart, currency };
  }
  if (scopedValue !== null) {
    storage.removeItem(scopedKey);
  }

  // Migrate the original global key without deleting a different restaurant's cart.
  const legacyValue = storage.getItem(CART_STORAGE_KEY);
  const legacyCart = parseStoredCart(legacyValue);
  if (legacyCart?.restaurantId === restaurantId) {
    const migratedCart = { ...legacyCart, currency };
    storage.setItem(scopedKey, JSON.stringify(migratedCart));
    storage.removeItem(CART_STORAGE_KEY);
    return migratedCart;
  }
  if (legacyValue !== null && !legacyCart) {
    storage.removeItem(CART_STORAGE_KEY);
  }

  return { version: 1, restaurantId, currency, lines: [], updatedAt: new Date().toISOString() };
}

export function saveRestaurantCart(storage: Storage, cart: Omit<StoredCart, "version" | "updatedAt">) {
  const storedCart: StoredCart = {
    ...cart,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  storage.setItem(restaurantCartStorageKey(cart.restaurantId), JSON.stringify(storedCart));
}
