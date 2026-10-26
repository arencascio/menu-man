import assert from "node:assert/strict";
import test from "node:test";
import { activeCartModifiers, activeModifierOptionIds, assertModifierConditions, transitionModifierOptionIds } from "./conditional-modifiers";
import { calculateCartSubtotalCents, cartReducer, createCartState, createModifierSelections, getCartLineSignature, getDefaultModifierOptionIds, getModifierValidationErrors } from "./cart";
import type { MenuModifierGroup } from "./types";
import { parseStoredCart } from "./storage";
import { createMenuCartLine, createMenuItemDraft, getCardAddMode } from "@/app/r/[slug]/menu-card-ordering";
import { createMenuModifierGroupResolver } from "@/app/r/[slug]/restaurant-menu-modifiers";
import { checkoutRequestSchema } from "@/lib/checkout/contracts";

const option = (id: string, priceAdjustmentCents = 0, isDefault = false) => ({ id, name: id, priceAdjustmentCents, sortOrder: 0, isDefault });
const side: MenuModifierGroup = { id: "side", name: "Side", description: null, minSelections: 1, maxSelections: 1, sortOrder: 0, options: [option("chips"), option("carrot"), option("drink", 200)] };
const ranch: MenuModifierGroup = { id: "ranch", name: "Ranch", description: null, minSelections: 0, maxSelections: 1, sortOrder: 1, options: [option("ranch-option", 50)], visibleWhen: { groupId: "side", optionId: "carrot" } };
const flavor: MenuModifierGroup = { id: "flavor", name: "Flavor", description: null, minSelections: 1, maxSelections: 1, sortOrder: 2, options: [option("cola", 100), option("tea")], visibleWhen: { groupId: "side", optionId: "drink" } };
const groups = [side, ranch, flavor];
const item = { id: "dish", name: "Dish", description: null, image_url: null, price_cents: 1000, is_orderable: true, modifierGroups: groups };
const selected = (...ids: string[]) => new Set(ids);

test("flat modifiers keep validation, defaults and pricing behavior", () => {
  assert.equal(getModifierValidationErrors([side], selected()).size, 1);
  assert.equal(getModifierValidationErrors([side], selected("chips")).size, 0);
  assert.deepEqual([...getDefaultModifierOptionIds([side])], []);
  assert.equal(createModifierSelections([side], selected("drink"))[0].priceAdjustmentCents, 200);
});

test("optional children are inactive until parent selected; required children block only while active", () => {
  assert.equal(getModifierValidationErrors(groups, selected("chips")).size, 0);
  assert.equal(getModifierValidationErrors(groups, selected("carrot")).size, 0);
  assert.equal(getModifierValidationErrors(groups, selected("drink")).has("flavor"), true);
  assert.equal(getModifierValidationErrors(groups, selected("drink", "cola")).size, 0);
  assert.equal(getModifierValidationErrors(groups, selected("carrot", "ranch-option", "tea")).has("flavor"), true);
});

test("parent switches and deselection remove stale children immediately", () => {
  const previous = selected("carrot", "ranch-option");
  const next = transitionModifierOptionIds(groups, previous, selected("drink", "ranch-option"));
  assert.deepEqual([...next], ["drink"]);
  assert.deepEqual([...transitionModifierOptionIds(groups, next, selected("cola"))], []);
  assert.deepEqual(createModifierSelections(groups, selected("chips", "ranch-option" )).map((s) => s.modifierOptionId), ["chips"]);
});

test("child defaults activate only under their root, independent of sort order", () => {
  const defaultSide = { ...side, options: [option("drink", 200, true)] };
  const defaultFlavor = { ...flavor, options: [option("tea", 0, true)] };
  assert.deepEqual([...getDefaultModifierOptionIds([defaultFlavor, defaultSide])], ["drink", "tea"]);
  assert.deepEqual([...getDefaultModifierOptionIds([defaultFlavor, side])], []);
  assert.deepEqual([...transitionModifierOptionIds([side, defaultFlavor], selected("chips"), selected("drink"))], ["drink", "tea"]);
});

test("selection bounds still apply to active child groups", () => {
  assert.equal(getModifierValidationErrors(groups, selected("drink", "cola", "tea")).has("flavor"), true);
});

test("conditional items use the full accessible customization form", () => {
  assert.equal(getCardAddMode(item), "full");
  assert.equal(getCardAddMode({ ...item, is_orderable: false }, true), "full");
  const flatPreview = { ...item, is_orderable: false, modifierGroups: [] };
  assert.equal(getCardAddMode(flatPreview, true), "direct");
  assert.equal(getCardAddMode(flatPreview), "full");
  assert.equal(getCardAddMode({ ...item, is_orderable: false, modifierGroups: [side] }, true), "quick");
});

test("multi-select parents preserve still-active siblings while clearing deselected children", () => {
  const multi = [{ ...side, minSelections: 0, maxSelections: 3 }, ranch, flavor];
  assert.equal(getModifierValidationErrors(multi, selected()).size, 0);
  const next = transitionModifierOptionIds(multi, selected("carrot", "ranch-option", "drink", "cola"), selected("drink", "cola", "ranch-option"));
  assert.deepEqual(next, selected("drink", "cola"));
  assert.equal(getModifierValidationErrors(multi, next).size, 0);
});

test("cart restoration never reapplies child defaults and condition changes prevent line merging", () => {
  const defaultItem = { ...item, modifierGroups: [side, { ...ranch, options: [option("ranch-option", 50, true)] }] };
  const line = createMenuCartLine(item, { id: "s", name: "s" }, "line", { selectedOptionIds: selected("carrot"), quantity: 1, specialInstructions: "" });
  assert.deepEqual(createMenuItemDraft(defaultItem, line).selectedOptionIds, selected("carrot"));
  const withChild = { ...line, selectedModifiers: createModifierSelections(groups, selected("carrot", "ranch-option")) };
  const changed = { ...withChild, selectedModifiers: withChild.selectedModifiers.map((selection) => selection.visibleWhen ? { ...selection, visibleWhen: { groupId: "side", optionId: "drink" } } : selection) };
  assert.notEqual(getCartLineSignature(withChild), getCartLineSignature(changed));
});

test("cart pricing, quantities, storage and edit restoration preserve active selections", () => {
  const draft = { selectedOptionIds: selected("drink", "cola"), quantity: 3, specialInstructions: "" };
  const line = createMenuCartLine(item, { id: "section", name: "Section" }, "line", draft);
  assert.equal(calculateCartSubtotalCents([line]), 3900);
  const saved = parseStoredCart(JSON.stringify({ version: 1, restaurantId: "tenant-a", currency: "USD", lines: [line], updatedAt: "now" }));
  assert.ok(saved);
  let state = cartReducer(createCartState("tenant-a", "USD"), { type: "hydrate", cart: saved });
  assert.deepEqual(createMenuItemDraft(item, state.lines[0]).selectedOptionIds, selected("drink", "cola"));
  const restored = createMenuItemDraft(item, state.lines[0]);
  restored.selectedOptionIds = transitionModifierOptionIds(groups, restored.selectedOptionIds, selected("carrot", "cola", "ranch-option"));
  const edited = createMenuCartLine(item, { id: "section", name: "Section" }, "line", restored);
  state = cartReducer(state, { type: "replace", line: edited });
  assert.equal(calculateCartSubtotalCents(state.lines), 3150);
  assert.equal(state.lines[0].quantity, 3);
});

test("saved inactive child snapshots cannot contribute prices, selections or restored drafts", () => {
  const modifiers = createModifierSelections(groups, selected("carrot", "ranch-option"));
  const stale = [createModifierSelections(groups, selected("chips"))[0], modifiers[1]];
  assert.deepEqual(activeCartModifiers(stale).map((s) => s.modifierOptionId), ["chips"]);
  const line = { ...createMenuCartLine(item, { id: "s", name: "s" }, "line", { selectedOptionIds: selected("chips"), quantity: 2, specialInstructions: "" }), selectedModifiers: stale };
  assert.equal(calculateCartSubtotalCents([line]), 2000);
  const state = cartReducer(createCartState("a", "USD"), { type: "add", line });
  assert.equal(state.lines[0].selectedModifiers.length, 1);
  assert.deepEqual(createMenuItemDraft(item, line).selectedOptionIds, selected("chips"));
});

test("broken relationships, self references and second nesting level fail closed", () => {
  assert.throws(() => assertModifierConditions([ranch]));
  assert.throws(() => activeModifierOptionIds([side, { ...ranch, visibleWhen: { groupId: "ranch", optionId: "ranch-option" } }], selected()));
  assert.throws(() => assertModifierConditions([side, ranch, { ...flavor, visibleWhen: { groupId: "ranch", optionId: "ranch-option" } }]));
});

test("conditional attachments resolve per item with canonical option overrides", () => {
  const rows = groups.map((g) => ({ id: g.id, name: g.name, description: null, is_active: true }));
  const options = groups.flatMap((g) => g.options.map((o) => ({ id: o.id, modifier_group_id: g.id, name: o.name, default_price_adjustment_cents: o.priceAdjustmentCents, sort_order: 0, is_default: false, is_active: true })));
  const attachments = ["tenant-a-item", "tenant-b-item"].flatMap((menu_item_id) => groups.map((g) => ({ menu_item_id, modifier_group_id: g.id, min_selections: g.minSelections, max_selections: g.maxSelections, sort_order: 0, is_active: true, parent_modifier_group_id: g.visibleWhen?.groupId, parent_modifier_option_id: g.visibleWhen?.optionId })));
  const resolve = createMenuModifierGroupResolver(rows, options, attachments, [{ menu_item_id: "tenant-a-item", modifier_group_id: "flavor", modifier_option_id: "cola", price_adjustment_cents: 0, sort_order: null, is_active: true }]);
  assert.equal(resolve("tenant-a-item").find((g) => g.id === "flavor")!.options[0].priceAdjustmentCents, 0);
  assert.equal(resolve("tenant-b-item").find((g) => g.id === "flavor")!.options[0].priceAdjustmentCents, 100);
  assert.deepEqual(resolve("tenant-b-item").find((g) => g.id === "ranch")!.visibleWhen, ranch.visibleWhen);
  assert.deepEqual(resolve("unknown-item"), []);
  const disabledParent = createMenuModifierGroupResolver(rows, options, attachments, [{ menu_item_id: "tenant-a-item", modifier_group_id: "side", modifier_option_id: "carrot", price_adjustment_cents: null, sort_order: null, is_active: false }]);
  assert.equal(disabledParent("tenant-a-item").some((group) => group.id === "ranch"), false);
  assert.equal(disabledParent("tenant-a-item").some((group) => group.id === "side"), true);
});

test("checkout public schema continues to reject forged price and condition fields", () => {
  const request = { menuId: "10000000-0000-4000-8000-000000000001", items: [{ menuItemId: "20000000-0000-4000-8000-000000000001", quantity: 1, modifierOptionIds: ["30000000-0000-4000-8000-000000000001"] }], customer: { name: "Test Guest" }, pickup: { mode: "asap" }, tipChoice: "none" };
  assert.equal(checkoutRequestSchema.safeParse(request).success, true);
  assert.equal(checkoutRequestSchema.safeParse({ ...request, items: [{ ...request.items[0], priceAdjustmentCents: 0 }] }).success, false);
  assert.equal(checkoutRequestSchema.safeParse({ ...request, items: [{ ...request.items[0], visibleWhen: null }] }).success, false);
});
