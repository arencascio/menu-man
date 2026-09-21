import assert from "node:assert/strict";
import test from "node:test";
import { canAddMenuItemDirectly, createDirectCartLine } from "./menu-card-ordering";
import type { MenuItem, MenuSection } from "./MenuBrowser";

const plain: MenuItem = { id: "item", name: "Dish", description: null, price_cents: 500, image_url: null, is_orderable: true, modifierGroups: [] };
const section: MenuSection = { id: "featured", name: "Featured", description: null, sort_order: -2, items: [plain] };

test("simple canonical items add from synthetic sections without changing item identity", () => {
  assert.equal(canAddMenuItemDirectly(plain), true);
  assert.deepEqual(createDirectCartLine(plain, section, "line"), {
    lineId: "line", menuItemId: "item", sectionId: "featured", sectionName: "Featured", itemName: "Dish",
    quantity: 1, basePriceCents: 500, selectedModifiers: [], specialInstructions: "",
  });
});

test("required selections and unavailable items require detail or remain unavailable", () => {
  assert.equal(canAddMenuItemDirectly({ ...plain, is_orderable: false }), false);
  assert.equal(canAddMenuItemDirectly({ ...plain, modifierGroups: [{
    id: "group", name: "Choice", description: null, minSelections: 1, maxSelections: 1, sortOrder: 0,
    options: [{ id: "option", name: "Option", priceAdjustmentCents: 0, sortOrder: 0, isDefault: true }],
  }] }), false);
});

test("optional configured defaults use the same modifier pricing path as item details", () => {
  const item: MenuItem = { ...plain, modifierGroups: [{
    id: "group", name: "Extras", description: null, minSelections: 0, maxSelections: 1, sortOrder: 0,
    options: [{ id: "option", name: "Sauce", priceAdjustmentCents: 75, sortOrder: 0, isDefault: true }],
  }] };
  assert.equal(canAddMenuItemDirectly(item), true);
  assert.equal(createDirectCartLine(item, section, "line").selectedModifiers[0].priceAdjustmentCents, 75);
});
