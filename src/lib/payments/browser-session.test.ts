import assert from "node:assert/strict";
import test from "node:test";
import { fingerprintCart, loadActiveOrderMarker, saveActiveOrderMarker } from "./browser-session";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test("active order markers contain no checkout capability", () => {
  const storage = new MemoryStorage();
  saveActiveOrderMarker(storage, {
    version: 1,
    restaurantId: "restaurant-1",
    restaurantSlug: "armandos",
    orderId: "order-1",
    orderNumber: "1001",
    cartFingerprint: "abc123",
  });
  const serialized = storage.getItem("menu-man:active-payment:v1:restaurant-1") || "";
  assert.equal(serialized.includes("checkoutToken"), false);
  assert.equal(loadActiveOrderMarker(storage, "restaurant-1")?.orderId, "order-1");
});

test("cart fingerprints change when the submitted cart changes", async () => {
  const line = {
    lineId: "line-1",
    menuItemId: "item-1",
    sectionId: "section-1",
    sectionName: "Entrees",
    itemName: "Taco",
    quantity: 1,
    basePriceCents: 1000,
    selectedModifiers: [],
    specialInstructions: "",
  };
  assert.notEqual(await fingerprintCart([line]), await fingerprintCart([{ ...line, quantity: 2 }]));
});
