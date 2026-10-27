import assert from "node:assert/strict";
import test from "node:test";
import { upperCrust, upperCrustSections } from "./config";
import {
  calculateCartSubtotalCents, calculateUnitPriceCents, cartReducer, createCartState,
  getCartLineSignature, getDefaultModifierOptionIds, getModifierValidationErrors,
} from "@/lib/cart/cart";
import { isModifierGroupActive, transitionModifierOptionIds } from "@/lib/cart/conditional-modifiers";
import { parseStoredCart } from "@/lib/cart/storage";
import { canAddMenuItemDirectly, createMenuCartLine, createMenuItemDraft } from "@/app/r/[slug]/menu-card-ordering";
import type { MenuModifierGroup } from "@/lib/cart/types";

const items = upperCrustSections.flatMap(({ items: entries }) => entries);
const item = (id: string) => items.find((entry) => entry.id === `uc-${id}`)!;
const groups = (id: string) => item(id).modifierGroups;
const findGroup = (id: string, name: string, occurrence = 0) => groups(id).filter((g) => g.name === name)[occurrence];
const option = (g: MenuModifierGroup, name: string) => g.options.find((o) => o.name === name)!.id;
const required = (id: string) => new Set(groups(id).filter((g) => !g.visibleWhen)
  .flatMap((g) => g.options.slice(0, g.minSelections).map((o) => o.id)));
const line = (id: string, selectedOptionIds = required(id), quantity = 1) => createMenuCartLine(
  item(id), { id: "uc-section", name: "Source fixture" }, id,
  { selectedOptionIds, quantity, specialInstructions: "No changes beyond selections" },
);

test("every item gates required choices and selects only configured defaults", () => {
  const requirements: Record<string, number> = {
    "italian-sub-one": 1, hawaiian: 1, "grinder-one": 2, "french-dip": 1,
    "bbq-beef": 1, blt: 2, "grinder-two": 3, "italian-sub-two": 2,
    custom: 3, "half-custom": 3, "soup-bowl": 0, "soup-cup": 0,
    "cobb-salad": 1, "albacore-tuna-salad": 1, "chef-salad": 1, "caesar-salad": 0,
    "chicken-salad-salad": 1, "dinner-salad": 1, "side-orders": 1,
    cheesecake: 0, chips: 0, brownies: 0, "two-cookies": 1,
    "bottled-water": 0, "large-drink": 1, "small-drink": 1,
  };
  assert.equal(Object.keys(requirements).length, items.length);
  for (const [id, count] of Object.entries(requirements)) {
    const defaults = getDefaultModifierOptionIds(groups(id));
    assert.deepEqual(createMenuItemDraft(item(id)).selectedOptionIds, defaults, id);
    assert.equal(getModifierValidationErrors(groups(id), new Set()).size, count, id);
    assert.equal(canAddMenuItemDirectly(item(id), true), count === 0, id);
    assert.equal(getModifierValidationErrors(groups(id), required(id)).size, 0, id);
    assert.equal(calculateUnitPriceCents(line(id, new Set())), item(id).price_cents, id);
    for (const g of groups(id)) {
      assert.ok(g.options.filter((o) => o.isDefault).length <= g.maxSelections, id);
      assert.ok(g.minSelections <= g.maxSelections && g.maxSelections <= g.options.length, id);
      assert.equal(new Set(g.options.map((o) => o.id)).size, g.options.length, id);
    }
  }
});

test("standard toppings start selected, can all be removed, and dressings permit multiple choices", () => {
  for (const id of ["custom", "half-custom"]) {
    const toppings = findGroup(id, "Topping Choices");
    assert.deepEqual([toppings.minSelections, toppings.maxSelections], [0, 8]);
    assert.equal(toppings.options.some((o) => o.name === "No Toppings"), false);
    const defaults = new Set([...required(id), ...getDefaultModifierOptionIds(groups(id))]);
    const side = findGroup(id, "Side Choice");
    defaults.delete(option(side, "Soup of the Day"));
    defaults.add(option(side, "Chips"));
    assert.deepEqual(new Set(toppings.options.filter((o) => o.isDefault).map((o) => o.id)),
      new Set(toppings.options.map((o) => o.id)));
    const selected = new Set(defaults);
    toppings.options.forEach((o) => selected.delete(o.id));
    assert.equal(getModifierValidationErrors(groups(id), selected).size, 0);
    assert.equal(calculateUnitPriceCents(line(id, selected)), item(id).price_cents);
    const added = createMenuCartLine(item(id), { id: "uc-section", name: "Source fixture" }, id,
      { selectedOptionIds: selected, quantity: 1, specialInstructions: "" });
    const editing = createMenuItemDraft(item(id), added);
    assert.deepEqual(editing.selectedOptionIds, selected);
  }
  for (const id of ["cobb-salad", "albacore-tuna-salad", "chef-salad", "chicken-salad-salad", "dinner-salad"]) {
    const dressing = findGroup(id, "Dressing Choice");
    assert.deepEqual(dressing.options.map((o) => o.name), [
      "Caesar", "Italian", "Rasberry Vinegarette", "Thousand Island",
      "Vidalia Onion Vinegarette", "Balsamic Vinegarette", "Ranch", "Blue Chesse",
    ]);
    assert.deepEqual([dressing.minSelections, dressing.maxSelections], [1, 8]);
    const selected = new Set(dressing.options.map((o) => o.id));
    assert.equal(getModifierValidationErrors(groups(id), selected).size, 0);
    assert.equal(calculateUnitPriceCents(line(id, selected)), item(id).price_cents);
  }
});

test("topping defaults do not select paid extras or exclusive cheese choices", () => {
  for (const id of ["custom", "half-custom", "italian-sub-one", "italian-sub-two", "grinder-one", "grinder-two", "hawaiian", "french-dip", "bbq-beef", "blt"]) {
    const defaults = getDefaultModifierOptionIds(groups(id));
    for (const g of groups(id)) {
      const selectedDefaults = g.options.filter((o) => defaults.has(o.id));
      if (g.name === "Add Extras") assert.equal(selectedDefaults.length, 0, id);
      if (g.name === "French Dip Cheese Choices" || g.name === "BBQ Cheese Choices") assert.equal(selectedDefaults.length, 0, id);
    }
  }
  const extras = findGroup("custom", "Add Extras");
  const initial = new Set(getDefaultModifierOptionIds(groups("custom")));
  assert.equal(calculateUnitPriceCents(line("custom", initial)), item("custom").price_cents);
  initial.add(option(extras, "Avocado"));
  assert.equal(calculateUnitPriceCents(line("custom", initial)), item("custom").price_cents + 200);
});

test("Half and Whole custom Ranch activates only for Carrot Sticks without a default", () => {
  for (const id of ["custom", "half-custom"]) {
    const sides = findGroup(id, "Side Choice");
    const ranch = findGroup(id, "Ranch");
    const initial = required(id);
    assert.equal(isModifierGroupActive(ranch, initial), false);
    const next = new Set(initial);
    sides.options.forEach((o) => next.delete(o.id));
    next.add(option(sides, "Carrot Sticks"));
    const activated = transitionModifierOptionIds(groups(id), initial, next);
    assert.equal(isModifierGroupActive(ranch, activated), true);
    assert.equal(activated.has(ranch.options[0].id), false);
    activated.add(ranch.options[0].id);
    assert.equal(getModifierValidationErrors(groups(id), activated).size, 0);
    assert.equal(calculateUnitPriceCents(line(id, activated)), item(id).price_cents);
    const replaced = new Set(activated);
    replaced.delete(option(sides, "Carrot Sticks"));
    replaced.add(option(sides, "Chips"));
    const result = transitionModifierOptionIds(groups(id), activated, replaced);
    assert.equal(result.has(ranch.options[0].id), false);
    assert.equal(getModifierValidationErrors(groups(id), replaced).get(ranch.id), "This selection requires its parent option.");
  }
});

test("specialty sandwich Ranch uses only the source-confirmed Carrot Sticks branch", () => {
  for (const id of ["italian-sub-one", "hawaiian", "grinder-one", "french-dip", "bbq-beef", "blt"]) {
    const side = findGroup(id, "Side Choice");
    const ranch = findGroup(id, "Ranch");
    assert.deepEqual(ranch.visibleWhen, { groupId: side.id, optionId: option(side, "Carrot Sticks") }, id);
    assert.deepEqual([ranch.minSelections, ranch.maxSelections], [0, 1], id);
    assert.equal(ranch.options[0].priceAdjustmentCents, 0, id);
    assert.equal(ranch.options[0].isDefault, false, id);

    const initial = required(id);
    assert.equal(isModifierGroupActive(ranch, initial), false, id);
    const changed = new Set(initial);
    side.options.forEach((o) => changed.delete(o.id));
    changed.add(option(side, "Carrot Sticks"));
    const active = transitionModifierOptionIds(groups(id), initial, changed);
    assert.equal(isModifierGroupActive(ranch, active), true, id);
    active.add(ranch.options[0].id);
    assert.equal(calculateUnitPriceCents(line(id, active)), item(id).price_cents, id);
    assert.equal(getModifierValidationErrors(groups(id), active).size, 0, id);
  }

  const id = "italian-sub-two";
  const sides = groups(id).filter((g) => g.name === "Side Choice");
  const ranches = groups(id).filter((g) => g.name === "Ranch");
  assert.equal(ranches.length, 1);
  assert.deepEqual(ranches[0].visibleWhen, { groupId: sides[0].id, optionId: option(sides[0], "Carrot Sticks") });
  const initial = required(id);
  const secondCarrot = new Set(initial);
  secondCarrot.delete(option(sides[1], "Soup of the Day"));
  secondCarrot.add(option(sides[1], "Carrot Sticks"));
  assert.equal(isModifierGroupActive(ranches[0], secondCarrot), false);
  const firstCarrot = new Set(secondCarrot);
  firstCarrot.delete(option(sides[0], "Soup of the Day"));
  firstCarrot.add(option(sides[0], "Carrot Sticks"));
  assert.equal(isModifierGroupActive(ranches[0], firstCarrot), true);
  firstCarrot.add(ranches[0].options[0].id);
  assert.equal(calculateUnitPriceCents(line(id, firstCarrot)), item(id).price_cents);
  const firstChanged = new Set(firstCarrot);
  firstChanged.delete(option(sides[0], "Carrot Sticks"));
  firstChanged.add(option(sides[0], "Fresh Fruit (Seasonal)"));
  const transitioned = transitionModifierOptionIds(groups(id), firstCarrot, firstChanged);
  assert.equal(transitioned.has(ranches[0].options[0].id), false);
  assert.equal(isModifierGroupActive(ranches[0], transitioned), false);
});

test("Grinder for Two has independent side and Ranch identities through transitions", () => {
  const id = "grinder-two";
  const sides = groups(id).filter((g) => g.name === "Side Choice");
  const ranches = groups(id).filter((g) => g.name === "Ranch");
  assert.equal(ranches.length, 2);
  const initial = required(id);
  const both = new Set(initial);
  sides.forEach((side, i) => {
    side.options.forEach((o) => both.delete(o.id));
    both.add(option(side, "Carrot Sticks"));
    assert.deepEqual(ranches[i].visibleWhen, { groupId: side.id, optionId: option(side, "Carrot Sticks") });
    both.add(ranches[i].options[0].id);
  });
  assert.notEqual(ranches[0].options[0].id, ranches[1].options[0].id);
  assert.equal(getModifierValidationErrors(groups(id), both).size, 0);
  const changed = new Set(both);
  changed.delete(option(sides[0], "Carrot Sticks"));
  changed.add(option(sides[0], "Soup of the Day"));
  const result = transitionModifierOptionIds(groups(id), both, changed);
  assert.equal(result.has(ranches[0].options[0].id), false);
  assert.equal(result.has(ranches[1].options[0].id), true);
  assert.equal(calculateUnitPriceCents(line(id, result)), 2395);
  const draft = createMenuItemDraft(item(id), line(id, both));
  assert.deepEqual(draft.selectedOptionIds, both);
});

test("dual sides and meat limits are enforced separately, including both soup upcharges", () => {
  for (const id of ["grinder-two", "italian-sub-two"]) {
    const selected = required(id);
    const sides = groups(id).filter((g) => g.name === "Side Choice");
    assert.equal(sides.length, 2);
    assert.notEqual(option(sides[0], "Soup of the Day"), option(sides[1], "Soup of the Day"));
    selected.delete(option(sides[1], "Soup of the Day"));
    assert.equal(getModifierValidationErrors(groups(id), selected).get(sides[1].id), "Select exactly 1.");
    selected.add(option(sides[1], "Soup of the Day"));
    const extras = findGroup(id, "Add Extras");
    extras.options.forEach((o) => selected.add(o.id));
    assert.equal(getModifierValidationErrors(groups(id), selected).size, 0);
    assert.equal(calculateUnitPriceCents(line(id, selected)), 3295);
    assert.equal(calculateCartSubtotalCents([line(id, selected, 2)]), 6590);
  }
  const meat = findGroup("grinder-one", "Choice of Meat");
  const selected = required("grinder-one");
  selected.delete(meat.options[1].id);
  assert.equal(getModifierValidationErrors(groups("grinder-one"), selected).get(meat.id), "Select exactly 2.");
  selected.add(meat.options[1].id);
  selected.add(meat.options[2].id);
  assert.equal(getModifierValidationErrors(groups("grinder-one"), selected).get(meat.id), "Select exactly 2.");
});

test("verified single sandwich extras use cents and free optional choices stay free", () => {
  for (const id of ["custom", "half-custom", "italian-sub-one", "grinder-one", "hawaiian", "blt"]) {
    const selected = required(id); // includes Soup of the Day +$1.00
    const extras = findGroup(id, "Add Extras");
    assert.deepEqual(extras.options.map((o) => o.priceAdjustmentCents), [50, 50, 50, 50, 50, 50, 50, 50, 200, 200]);
    extras.options.forEach((o) => selected.add(o.id));
    assert.equal(getModifierValidationErrors(groups(id), selected).size, 0);
    assert.equal(calculateUnitPriceCents(line(id, selected)), item(id).price_cents + 900);
  }
  for (const [id, cheeseName] of [["french-dip", "French Dip Cheese Choices"], ["bbq-beef", "BBQ Cheese Choices"]]) {
    const selected = required(id);
    const cheese = findGroup(id, cheeseName);
    selected.add(cheese.options[0].id);
    assert.equal(calculateUnitPriceCents(line(id, selected)), item(id).price_cents + 100);
    selected.add(cheese.options[1].id);
    assert.equal(getModifierValidationErrors(groups(id), selected).get(cheese.id), "Select no more than 1.");
  }
});

test("configuration, independent Ranch, quantities and prices survive storage, hydrate and edit", () => {
  const id = "grinder-two";
  const selected = required(id);
  groups(id).filter((g) => g.name === "Side Choice").forEach((side) => {
    side.options.forEach((o) => selected.delete(o.id));
    selected.add(option(side, "Carrot Sticks"));
  });
  groups(id).filter((g) => g.name === "Ranch").forEach((ranch) => selected.add(ranch.options[0].id));
  selected.add(option(findGroup(id, "Add Extras"), "Bacon"));
  const original = line(id, selected, 2);
  const saved = parseStoredCart(JSON.stringify({
    version: 1, restaurantId: upperCrust.id, currency: "USD", lines: [original], updatedAt: "2026-10-26",
  }));
  assert.ok(saved);
  let cart = cartReducer(createCartState(upperCrust.id, "USD"), { type: "hydrate", cart: saved });
  const draft = createMenuItemDraft(item(id), cart.lines[0]);
  assert.deepEqual(draft.selectedOptionIds, selected);
  assert.equal(draft.quantity, 2);
  assert.equal(draft.specialInstructions, original.specialInstructions);
  assert.equal(calculateCartSubtotalCents(cart.lines), 5390);
  const edited = createMenuCartLine(item(id), { id: original.sectionId, name: original.sectionName }, id, { ...draft, quantity: 3 });
  cart = cartReducer(cart, { type: "replace", line: edited });
  assert.equal(calculateCartSubtotalCents(cart.lines), 8085);
  assert.equal(getCartLineSignature(original), getCartLineSignature(edited));
  const withoutRanch = new Set(selected);
  withoutRanch.delete(findGroup(id, "Ranch").options[0].id);
  assert.notEqual(getCartLineSignature(original), getCartLineSignature(line(id, withoutRanch, 2)));
});

test("standalone side, cookies, drink and soup choices preserve exact source inventories", () => {
  assert.deepEqual(findGroup("side-orders", "Additional Side Order").options.map((o) => o.name), [
    "Potato Salad", "Pasta Salad", "Macaroni Salad", "Fresh Fruit (Seasonal)", "Cole Slaw", "Carrot Sticks w/Ranch",
  ]);
  assert.deepEqual(findGroup("two-cookies", "Cookie Selection").options.map((o) => o.name), [
    "2 Reese's Peanut Butter Cookies", "2 Chocolate Chip Cookies", "1 Reese’s Peanut Butter Cookie and 1 Chocolate Chip Cookie",
  ]);
  for (const id of ["large-drink", "small-drink"]) {
    const drink = findGroup(id, "Drink Choices");
    assert.deepEqual(drink.options.map((o) => o.name), ["Coke", "Diet Coke", "Sprite", "Dr. Pepper", "Lemonade", "Raspberry Tea", "Unsweetened Tea"]);
    assert.deepEqual([drink.minSelections, drink.maxSelections], [1, 1]);
  }
  for (const id of ["soup-bowl", "soup-cup"]) {
    const bread = findGroup(id, "Bread or Crackers");
    assert.deepEqual(bread.options.map((o) => o.name), ["Crackers", "Rye", "Indian Grain", "Sourdough", "French Roll", "Whole Wheat"]);
    assert.deepEqual([bread.minSelections, bread.maxSelections], [0, 1]);
    assert.equal(calculateUnitPriceCents(line(id, new Set([bread.options[0].id]))), item(id).price_cents);
  }
  // Source descriptions and cross-sell recommendations do not establish missing item options.
  assert.deepEqual(item("caesar-salad").modifierGroups, []);
  assert.ok(items.every((entry) => entry.modifierGroups.every((g) => !g.name.startsWith("Recommended"))));
});
