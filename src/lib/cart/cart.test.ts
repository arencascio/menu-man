import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCartSubtotalCents,
  calculateLineTotalCents,
  cartReducer,
  createCartState,
  getCartLineSignature,
  getDefaultModifierOptionIds,
  getModifierValidationErrors,
  isMenuModifierOptionAvailable,
  resolveModifierPriceCents,
  shouldShowMaxSelectionGuidance,
} from "./cart";
import {
  CART_STORAGE_KEY,
  loadRestaurantCart,
  parseStoredCart,
  restaurantCartStorageKey,
  saveRestaurantCart,
} from "./storage";
import type { CartLine, MenuModifierGroup, MenuModifierOption } from "./types";
import { fingerprintCart } from "../payments/browser-session";

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

test("keeps persisted carts isolated when different restaurants are open", () => {
  const storage = new MemoryStorage();
  saveRestaurantCart(storage, {
    restaurantId: "restaurant-1",
    currency: "USD",
    lines: [line],
  });

  const cart = loadRestaurantCart(storage, "restaurant-2", "USD");
  assert.equal(cart.restaurantId, "restaurant-2");
  assert.equal(cart.lines.length, 0);
  assert.equal(
    parseStoredCart(storage.getItem(restaurantCartStorageKey("restaurant-1")))?.lines.length,
    1,
  );
});

test("migrates the matching legacy cart without deleting another restaurant's legacy cart", () => {
  const storage = new MemoryStorage();
  storage.setItem(CART_STORAGE_KEY, JSON.stringify({
    version: 1,
    restaurantId: "restaurant-1",
    currency: "USD",
    lines: [line],
    updatedAt: new Date(0).toISOString(),
  }));

  assert.equal(loadRestaurantCart(storage, "restaurant-2", "USD").lines.length, 0);
  assert.notEqual(storage.getItem(CART_STORAGE_KEY), null);

  assert.equal(loadRestaurantCart(storage, "restaurant-1", "USD").lines.length, 1);
  assert.equal(storage.getItem(CART_STORAGE_KEY), null);
  assert.equal(
    parseStoredCart(storage.getItem(restaurantCartStorageKey("restaurant-1")))?.lines.length,
    1,
  );
});

const simpleLine: CartLine = { ...line, quantity: 1, selectedModifiers: [] };

function addLines(...lines: CartLine[]) {
  return lines.reduce((state, line) => cartReducer(state, { type: "add", line }), createCartState("restaurant-1", "USD"));
}

for (const count of [2, 3]) {
  test(`identical simple item added ${count} times becomes one line with quantity ${count}`, () => {
    const state = addLines(...Array.from({ length: count }, (_, index) => ({ ...simpleLine, lineId: `add-${index}` })));
    assert.equal(state.lines.length, 1);
    assert.equal(state.lines[0].quantity, count);
    assert.equal(state.lines[0].lineId, "add-0");
    assert.equal(calculateCartSubtotalCents(state.lines), simpleLine.basePriceCents * count);
  });
}

test("identical customized additions merge quantities without changing snapshots", () => {
  const state = addLines(line, { ...line, lineId: "second", quantity: 3 });
  assert.deepEqual(state.lines, [{ ...line, quantity: 5 }]);
  assert.equal(calculateCartSubtotalCents(state.lines), 5750);
  assert.equal(line.quantity, 2);
});

test("normal, ingredient removal, extras, and different modifier groups/options remain separate", () => {
  const removal = { ...line.selectedModifiers[0], modifierGroupId: "removals", modifierOptionId: "no-cheese", priceAdjustmentCents: 0 };
  const variants = [
    simpleLine,
    { ...simpleLine, lineId: "removed", selectedModifiers: [removal] },
    { ...simpleLine, lineId: "extra", selectedModifiers: line.selectedModifiers },
    { ...simpleLine, lineId: "different-group", selectedModifiers: [{ ...removal, modifierGroupId: "other-removals" }] },
    { ...simpleLine, lineId: "different-option", selectedModifiers: [{ ...removal, modifierOptionId: "no-onion" }] },
    { ...simpleLine, lineId: "different-item", menuItemId: "item-2" },
  ];
  assert.equal(addLines(...variants).lines.length, variants.length);
});

test("modifier ordering and display labels do not affect equivalence", () => {
  const secondModifier = { ...line.selectedModifiers[0], modifierGroupId: "removals", modifierOptionId: "no-rice", priceAdjustmentCents: 0 };
  const original = { ...line, selectedModifiers: [...line.selectedModifiers, secondModifier] };
  const reordered = {
    ...original, lineId: "reordered", sectionId: "featured", sectionName: "Featured", itemName: "Updated label",
    selectedModifiers: [...original.selectedModifiers].reverse().map((modifier) => ({ ...modifier, modifierGroupName: "Updated group", modifierOptionName: "Updated option" })),
  };
  assert.equal(getCartLineSignature(original), getCartLineSignature(reordered));
  assert.deepEqual(addLines(original, reordered).lines, [{ ...original, quantity: 4 }]);
  assert.equal(original.selectedModifiers[0].modifierOptionId, "guacamole");
});

test("distinct instructions remain separate while outer whitespace is normalized", () => {
  const state = addLines(
    simpleLine,
    { ...simpleLine, lineId: "no-cheese", specialInstructions: "no cheese" },
    { ...simpleLine, lineId: "same-note", specialInstructions: "  no cheese  " },
    { ...simpleLine, lineId: "other-note", specialInstructions: "extra crispy" },
  );
  assert.deepEqual(state.lines.map(({ specialInstructions, quantity }) => [specialInstructions, quantity]), [["", 1], ["no cheese", 2], ["extra crispy", 1]]);
});

test("price snapshot differences remain separate so consolidation cannot reprice stored lines", () => {
  const lines = [line, { ...line, lineId: "base-price", basePriceCents: 1200 }, {
    ...line, lineId: "modifier-price", selectedModifiers: [{ ...line.selectedModifiers[0], priceAdjustmentCents: 200 }],
  }];
  const state = addLines(...lines);
  assert.equal(state.lines.length, 3);
  assert.equal(calculateCartSubtotalCents(state.lines), calculateCartSubtotalCents(lines));
});

test("merged lines retain the 1-99 quantity rules and still decrement and remove by their retained ID", () => {
  let state = addLines(simpleLine, { ...simpleLine, lineId: "new", quantity: 98 }, { ...simpleLine, lineId: "at-limit" });
  assert.equal(state.lines.length, 1);
  assert.equal(state.lines[0].quantity, 99);
  state = cartReducer(state, { type: "set_quantity", lineId: simpleLine.lineId, quantity: 2 });
  assert.equal(state.lines[0].quantity, 2);
  state = cartReducer(state, { type: "set_quantity", lineId: simpleLine.lineId, quantity: 1 });
  assert.equal(state.lines[0].quantity, 1);
  state = cartReducer(state, { type: "set_quantity", lineId: simpleLine.lineId, quantity: 0 });
  assert.equal(state.lines[0].quantity, 1);
  state = cartReducer(state, { type: "remove", lineId: simpleLine.lineId });
  assert.equal(state.lines.length, 0);
});

test("edit-to-equivalent collision combines the edited quantity with the existing quantity", () => {
  const customized = { ...simpleLine, lineId: "custom", quantity: 2, specialInstructions: "no cheese" };
  const state = addLines({ ...simpleLine, quantity: 3 }, customized);
  const edited = cartReducer(state, { type: "replace", line: { ...customized, specialInstructions: "" } });
  assert.deepEqual(edited.lines, [{ ...simpleLine, quantity: 5 }]);
  assert.equal(state.lines.length, 2);
});

test("edit collisions over 99 retain both bounded lines without discarding quantities", () => {
  const customized = { ...simpleLine, lineId: "custom", quantity: 20, specialInstructions: "no cheese" };
  const state = addLines({ ...simpleLine, quantity: 90 }, customized);
  const edited = cartReducer(state, { type: "replace", line: { ...customized, specialInstructions: "" } });
  assert.deepEqual(edited.lines.map(({ quantity }) => quantity), [90, 20]);
  assert.equal(calculateCartSubtotalCents(edited.lines), simpleLine.basePriceCents * 110);
});

test("persistence and hydration preserve historical row shape, customized lines, and active-order fingerprints", async () => {
  const storage = new MemoryStorage();
  const historical = [simpleLine, { ...simpleLine, lineId: "duplicate" }, {
    ...simpleLine, lineId: "notes", specialInstructions: "no cheese",
  }, { ...line, lineId: "extras" }];
  saveRestaurantCart(storage, { restaurantId: "restaurant-1", currency: "USD", lines: historical });
  const loaded = loadRestaurantCart(storage, "restaurant-1", "USD");
  const hydrated = cartReducer(createCartState("restaurant-1", "USD"), { type: "hydrate", cart: loaded });
  assert.deepEqual(hydrated.lines, historical);
  assert.equal(await fingerprintCart(hydrated.lines), await fingerprintCart(historical));
  const added = cartReducer(hydrated, { type: "add", line: { ...simpleLine, lineId: "new" } });
  assert.deepEqual(added.lines.map(({ lineId, quantity }) => [lineId, quantity]), [[simpleLine.lineId, 3], ["notes", 1], ["extras", 2]]);
  saveRestaurantCart(storage, { restaurantId: "restaurant-1", currency: "USD", lines: added.lines });
  assert.deepEqual(loadRestaurantCart(storage, "restaurant-1", "USD").lines, added.lines);
  assert.equal(loadRestaurantCart(storage, "restaurant-2", "USD").lines.length, 0);
});

test("explicit additions preserve historical overflow quantities and never create a new overflow row", () => {
  const stored = { version: 1 as const, restaurantId: "restaurant-1", currency: "USD", updatedAt: new Date(0).toISOString(), lines: [
    { ...simpleLine, quantity: 99 }, { ...simpleLine, lineId: "overflow", quantity: 2 },
  ] };
  const hydrated = cartReducer(createCartState("restaurant-1", "USD"), { type: "hydrate", cart: stored });
  const added = cartReducer(hydrated, { type: "add", line: { ...simpleLine, lineId: "new" } });
  assert.deepEqual(added.lines.map(({ quantity }) => quantity), [99, 3]);
  assert.equal(calculateCartSubtotalCents(added.lines), simpleLine.basePriceCents * 102);
});
