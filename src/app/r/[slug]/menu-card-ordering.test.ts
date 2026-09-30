import assert from "node:assert/strict";
import test from "node:test";
import { canAddMenuItemDirectly, createDirectCartLine, createMenuCartLine, createMenuItemDraft, getCardAddMode, hasOptionalCustomization } from "./menu-card-ordering";
import type { MenuItem, MenuSection } from "./MenuBrowser";

const plain: MenuItem = { id: "item", name: "Dish", description: null, price_cents: 500, image_url: null, is_orderable: true, modifierGroups: [] };
const section: MenuSection = { id: "featured", name: "Featured", description: null, sort_order: -2, items: [plain] };

test("simple canonical items add from synthetic sections without changing item identity", () => {
  assert.equal(canAddMenuItemDirectly(plain), true);
  assert.equal(getCardAddMode(plain), "direct");
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

test("card add classifies small exact-one choices for the quick chooser", () => {
  const quick: MenuItem = { ...plain, modifierGroups: [{
    id: "meat", name: "Choose meat", description: null, minSelections: 1, maxSelections: 1, sortOrder: 0,
    options: [
      { id: "chicken", name: "Chicken", priceAdjustmentCents: 0, sortOrder: 0, isDefault: false },
      { id: "beef", name: "Beef", priceAdjustmentCents: 100, sortOrder: 1, isDefault: false },
    ],
  }] };
  assert.equal(getCardAddMode(quick), "quick");
  assert.equal(hasOptionalCustomization(quick), false);
  assert.equal(getCardAddMode({ ...quick, modifierGroups: [{ ...quick.modifierGroups[0], maxSelections: 2 }] }), "full");
  assert.equal(getCardAddMode({ ...quick, modifierGroups: Array.from({ length: 3 }, (_, index) => ({ ...quick.modifierGroups[0], id: `group-${index}` })) }), "full");
});

test("quick chooser advertises optional customization separately", () => {
  const required = {
    id: "meat", name: "Choose meat", description: null, minSelections: 1, maxSelections: 1, sortOrder: 0,
    options: [{ id: "chicken", name: "Chicken", priceAdjustmentCents: 0, sortOrder: 0, isDefault: false }],
  };
  const optional = {
    id: "extras", name: "Extras", description: null, minSelections: 0, maxSelections: 2, sortOrder: 1,
    options: [{ id: "cheese", name: "Cheese", priceAdjustmentCents: 100, sortOrder: 0, isDefault: false }],
  };
  const item = { ...plain, modifierGroups: [required, optional] };
  assert.equal(getCardAddMode(item), "quick");
  assert.equal(hasOptionalCustomization(item), true);
});

test("optional configured defaults use the same modifier pricing path as item details", () => {
  const item: MenuItem = { ...plain, modifierGroups: [{
    id: "group", name: "Extras", description: null, minSelections: 0, maxSelections: 1, sortOrder: 0,
    options: [{ id: "option", name: "Sauce", priceAdjustmentCents: 75, sortOrder: 0, isDefault: true }],
  }] };
  assert.equal(canAddMenuItemDirectly(item), true);
  assert.equal(createDirectCartLine(item, section, "line").selectedModifiers[0].priceAdjustmentCents, 75);
});

test("optional burrito removals and extras are recorded and restored when editing a cart line", () => {
  const item: MenuItem = { ...plain, modifierGroups: [
    {
      id: "remove-ingredients", name: "Remove ingredients", description: null,
      minSelections: 0, maxSelections: 14, sortOrder: 0,
      options: [
        { id: "no-rice", name: "No Rice", priceAdjustmentCents: 0, sortOrder: 0, isDefault: false },
        { id: "no-beans", name: "No Beans", priceAdjustmentCents: 0, sortOrder: 1, isDefault: false },
      ],
    },
    {
      id: "add-extras", name: "Add extras", description: null,
      minSelections: 0, maxSelections: 3, sortOrder: 1,
      options: [
        { id: "guacamole", name: "Guacamole", priceAdjustmentCents: 150, sortOrder: 0, isDefault: false },
        { id: "cheese", name: "Cheese", priceAdjustmentCents: 100, sortOrder: 1, isDefault: false },
      ],
    },
  ] };
  const draft = { selectedOptionIds: new Set(["no-rice", "guacamole"]), quantity: 2, specialInstructions: "extra crispy" };
  const line = createMenuCartLine(item, section, "line", draft);

  assert.equal(line.basePriceCents, 500);
  assert.deepEqual(line.selectedModifiers.map(({ modifierOptionName, priceAdjustmentCents }) => [modifierOptionName, priceAdjustmentCents]), [
    ["No Rice", 0],
    ["Guacamole", 150],
  ]);
  assert.deepEqual(createMenuItemDraft(item, line), draft);
});
