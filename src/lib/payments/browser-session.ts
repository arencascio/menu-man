import type { CartLine } from "@/lib/cart/types";

export type ActiveOrderMarker = {
  version: 1;
  restaurantId: string;
  restaurantSlug: string;
  orderId: string;
  orderNumber: string;
  cartFingerprint: string;
};

export type CheckoutBroadcastEvent = "order_created" | "payment_changed" | "payment_terminal";

export function activeOrderStorageKey(restaurantId: string) {
  return `menu-man:active-payment:v1:${restaurantId}`;
}

export function checkoutBroadcastChannelName(restaurantId: string) {
  return `menu-man:checkout:v1:${restaurantId}`;
}

export function loadActiveOrderMarker(storage: Storage, restaurantId: string): ActiveOrderMarker | null {
  const raw = storage.getItem(activeOrderStorageKey(restaurantId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ActiveOrderMarker>;
    if (
      value.version !== 1
      || value.restaurantId !== restaurantId
      || typeof value.restaurantSlug !== "string"
      || typeof value.orderId !== "string"
      || typeof value.orderNumber !== "string"
      || typeof value.cartFingerprint !== "string"
    ) return null;
    return value as ActiveOrderMarker;
  } catch {
    return null;
  }
}

export function saveActiveOrderMarker(storage: Storage, marker: ActiveOrderMarker) {
  storage.setItem(activeOrderStorageKey(marker.restaurantId), JSON.stringify(marker));
}

export function removeActiveOrderMarker(storage: Storage, restaurantId: string) {
  storage.removeItem(activeOrderStorageKey(restaurantId));
}

export function broadcastCheckoutEvent(restaurantId: string, event: CheckoutBroadcastEvent) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(checkoutBroadcastChannelName(restaurantId));
  channel.postMessage({ event });
  channel.close();
}

export async function fingerprintCart(lines: readonly CartLine[]) {
  const canonical = JSON.stringify(lines.map((line) => ({
    lineId: line.lineId,
    menuItemId: line.menuItemId,
    quantity: line.quantity,
    modifierOptionIds: line.selectedModifiers.map((modifier) => modifier.modifierOptionId).sort(),
    specialInstructions: line.specialInstructions,
  })).sort((left, right) => left.lineId.localeCompare(right.lineId)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
