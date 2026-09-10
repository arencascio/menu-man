import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCartSubtotalCents,
  calculateLineTotalCents,
  cartReducer,
  createCartState,
  getDefaultModifierOptionIds,
  getModifierValidationErrors,
  isMenuModifierOptionAvailable,
  resolveModifierPriceCents,
  shouldShowMaxSelectionGuidance,
} from "./cart";
import { CART_STORAGE_KEY, loadRestaurantCart, parseStoredCart } from "./storage";
import type { CartLine, MenuModifierGroup, MenuModifierOption } from "./types";

const line: CartLine = {
  lineId: "line-1",
  menuItemId: "item-1",
  sectionId: "section-1",
  sectionName: "Combos",
  itemName: "Two Tostadas",
  quantity: 2,
  basePriceCents: 1000,
  selectedModifiers: [{
    modifierGroupId: "extras",
    modifierGroupName: "Add extras",
    modifierOptionId: "guacamole",
    modifierOptionName: "Guacamole",
    priceAdjustmentCents: 150,
  }],
  specialInstructions: "",
};

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function option(id: string, isDefault = false): MenuModifierOption {
  return {
    id,
    name: id,
    priceAdjustmentCents: 0,
    sortOrder: 0,
    isDefault,
  };
}

test("resolves item-specific modifier pricing before the reusable option default", () => {
  assert.equal(resolveModifierPriceCents(200, 150), 200);
  assert.equal(resolveModifierPriceCents(0, 150), 0);
  assert.equal(resolveModifierPriceCents(null, 150), 150);
  assert.equal(resolveModifierPriceCents(undefined, undefined), 0);
});

test("excludes inactive modifier groups, attachments, options, and item overrides", () => {
  assert.equal(isMenuModifierOptionAvailable(true, true, true, undefined), true);
  assert.equal(isMenuModifierOptionAvailable(false, true, true, undefined), false);
  assert.equal(isMenuModifierOptionAvailable(true, false, true, undefined), false);
  assert.equal(isMenuModifierOptionAvailable(true, true, false, undefined), false);
  assert.equal(isMenuModifierOptionAvailable(true, true, true, false), false);
});

test("calculates configured unit, line, and cart totals in integer cents", () => {
  assert.equal(calculateLineTotalCents(line), 2300);
  assert.equal(calculateCartSubtotalCents([line, { ...line, lineId: "line-2", quantity: 1 }]), 3450);
});

test("rejects required exactly-one with no selection and no inferred default", () => {
  const groups: MenuModifierGroup[] = [{
    id: "meat",
    name: "Choose your meat",
    description: null,
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 0,
    options: [
      { ...option("asada"), name: "Carne Asada" },
      { ...option("chicken"), name: "Chicken", sortOrder: 1 },
    ],
  }];

  assert.equal(getModifierValidationErrors(groups, new Set()).get("meat"), "Select exactly 1.");
  assert.equal(getModifierValidationErrors(groups, new Set(["asada"])).size, 0);
  assert.equal(getModifierValidationErrors(groups, new Set(["asada", "chicken"])).get("meat"), "Select exactly 1.");
});

test("applies an explicit default only when it satisfies the item's min/max rules", () => {
  const validGroup: MenuModifierGroup = {
    id: "valid",
    name: "Valid",
    description: null,
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 0,
    options: [option("default", true), option("not-default")],
  };
  const noDefaultGroup: MenuModifierGroup = {
    ...validGroup,
    id: "none",
    options: [option("none-a"), option("none-b")],
  };
  const tooManyDefaultsGroup: MenuModifierGroup = {
    ...validGroup,
    id: "too-many",
    options: [option("too-many-a", true), option("too-many-b", true)],
  };
  const tooFewDefaultsGroup: MenuModifierGroup = {
    ...validGroup,
    id: "too-few",
    minSelections: 2,
    maxSelections: 3,
    options: [option("too-few-a", true), option("too-few-b"), option("too-few-c")],
  };

  assert.deepEqual(
    [...getDefaultModifierOptionIds([validGroup, noDefaultGroup, tooManyDefaultsGroup, tooFewDefaultsGroup])],
    ["default"],
  );
});

test("shows max guidance only when active option count makes the limit meaningful", () => {
  const group: MenuModifierGroup = {
    id: "extras",
    name: "Extras",
    description: null,
    minSelections: 0,
    maxSelections: 4,
    sortOrder: 0,
    options: [option("1"), option("2"), option("3")],
  };

  assert.equal(shouldShowMaxSelectionGuidance(group), false);
  assert.equal(shouldShowMaxSelectionGuidance({ ...group, options: [...group.options, option("4"), option("5")] }), true);
  assert.equal(shouldShowMaxSelectionGuidance({ ...group, minSelections: 1, maxSelections: 1 }), false);
});

test("rejects a selection over a group's configured maximum", () => {
  const group: MenuModifierGroup = {
    id: "extras",
    name: "Extras",
    description: null,
    minSelections: 0,
    maxSelections: 4,
    sortOrder: 0,
    options: [option("1"), option("2"), option("3"), option("4"), option("5")],
  };

  assert.equal(
    getModifierValidationErrors([group], new Set(group.options.map(({ id }) => id))).get("extras"),
    "Select no more than 4.",
  );
});

test("adds, replaces, changes quantity, removes, and clears cart lines", () => {
  let state = { ...createCartState("restaurant-1", "USD"), hydrated: true };
  state = cartReducer(state, { type: "add", line });
  assert.equal(state.lines.length, 1);
  state = cartReducer(state, { type: "set_quantity", lineId: line.lineId, quantity: 3 });
  assert.equal(state.lines[0].quantity, 3);
  state = cartReducer(state, { type: "replace", line: { ...line, itemName: "Edited" } });
  assert.equal(state.lines[0].itemName, "Edited");
  state = cartReducer(state, { type: "remove", lineId: line.lineId });
  assert.equal(state.lines.length, 0);
  state = cartReducer({ ...state, lines: [line] }, { type: "clear" });
  assert.equal(state.lines.length, 0);
});

test("rejects malformed persisted cart data", () => {
  assert.equal(parseStoredCart("not json"), null);
  assert.equal(parseStoredCart(JSON.stringify({ version: 2 })), null);
  assert.equal(parseStoredCart(JSON.stringify({
    version: 1,
    restaurantId: "restaurant-1",
    currency: "USD",
    lines: [line],
    updatedAt: new Date(0).toISOString(),
  }))?.lines.length, 1);
});

test("isolates persisted carts by restaurant", () => {
  const storage = new MemoryStorage();
  storage.setItem(CART_STORAGE_KEY, JSON.stringify({
    version: 1,
    restaurantId: "restaurant-1",
    currency: "USD",
    lines: [line],
    updatedAt: new Date(0).toISOString(),
  }));

  const cart = loadRestaurantCart(storage, "restaurant-2", "USD");
  assert.equal(cart.restaurantId, "restaurant-2");
  assert.equal(cart.lines.length, 0);
  assert.equal(storage.getItem(CART_STORAGE_KEY), null);
});
