import assert from "node:assert/strict";
import test from "node:test";
import { assertModifierConditions } from "@/lib/cart/conditional-modifiers";
import { upperCrustSections } from "./config";

const expectedMenu = [
  ["Specialty Sandwiches", [
    ["Italian Sub for one", 1495], ["Hawaiian", 1495], ["Grinder for one", 1495], ["French Dip", 1495],
    ["BBQ Beef", 1395], ["BLT", 1395], ["Grinder for Two", 2295], ["Italian Sub for Two", 2295],
  ]],
  ["Custom Sandwiches", [["Whole Custom Sandwich", 1495], ["Half Custom Sandwich", 1395]]],
  ["Soups", [["Soup of the Day (Bowl)", 795], ["Soup of the Day (Cup)", 695]]],
  ["Salads", [
    ["Cobb Salad", 1395], ["Albacore Tuna Salad", 1395], ["Chef Salad", 1395], ["Caesar Salad", 1395],
    ["Chicken Salad Salad", 1395], ["Dinner Salad", 1050],
  ]],
  ["Extras", [["Side Orders", 325], ["Cheesecake", 375], ["Chips", 200], ["Brownies", 325], ["2 Cookies", 150]]],
  ["Drinks", [["Bottled Water", 200], ["Large Drink (20 oz)", 325], ["Small Drink (16 oz)", 225]]],
] as const;

test("Upper Crust fixture matches the captured DoorDash item and price inventory", () => {
  assert.deepEqual(upperCrustSections.map(({ name, items }) => [
    name,
    items.map(({ name: itemName, price_cents }) => [itemName, price_cents]),
  ]), expectedMenu);
  const items = upperCrustSections.flatMap(({ items: sectionItems }) => sectionItems);
  assert.equal(items.length, 26);
  assert.deepEqual(upperCrustSections.map(({ id, sort_order }) => [id, sort_order]), [
    ["uc-specialty", 0], ["uc-custom", 1], ["uc-soups", 2], ["uc-salads", 3], ["uc-extras", 4], ["uc-drinks", 5],
  ]);
  assert.equal(new Set(items.map(({ id }) => id)).size, items.length);
  assert.ok(items.every(({ is_orderable }) => is_orderable === false));
  assert.ok(items.find(({ id }) => id === "uc-hawaiian")?.description?.includes("pineapple"));
  assert.ok(items.find(({ id }) => id === "uc-custom")?.description?.includes("filling"));
  const matchedImages = Object.fromEntries(items.filter(({ image_url }) => image_url).map(({ id, image_url }) => [id, image_url]));
  assert.deepEqual(matchedImages, {
    "uc-italian-sub-one": "/r/upper-crust/media/italian%20sub.jpg",
    "uc-hawaiian": "/r/upper-crust/media/hawaiian%20sandwich.jpg",
    "uc-blt": "/r/upper-crust/media/blt.jpg",
    "uc-cobb-salad": "/r/upper-crust/media/cobb%20salad.jpg",
    "uc-brownies": "/r/upper-crust/media/brownie.jpg",
    "uc-custom": "/r/upper-crust/media/veggie%20sandwich.jpg",
  });
  assert.equal(items.filter(({ description }) => description).length, 22);
  for (const menuItem of items) assertModifierConditions(menuItem.modifierGroups);
});

test("verified custom sandwich choices include the conditional Carrot Sticks ranch group", () => {
  const custom = upperCrustSections.find(({ id }) => id === "uc-custom")!.items;
  const whole = custom.find(({ id }) => id === "uc-custom")!;
  const half = custom.find(({ id }) => id === "uc-half-custom")!;
  assert.deepEqual(
    half.modifierGroups.map(({ id }) => id),
    whole.modifierGroups.map(({ id }) => id),
  );
  assert.equal(half.modifierGroups.some(({ name }) => name === "Ranch"), true);

  const side = whole.modifierGroups.find(({ name }) => name === "Side Choice")!;
  const soup = side.options.find(({ name }) => name === "Soup of the Day")!;
  assert.equal(soup.priceAdjustmentCents, 100);
  const carrot = side.options.find(({ name }) => name === "Carrot Sticks")!;
  const ranch = whole.modifierGroups.find(({ name }) => name === "Ranch")!;
  assert.deepEqual(ranch.visibleWhen, { groupId: side.id, optionId: carrot.id });
  assert.equal(ranch.minSelections, 0);
  assert.equal(ranch.maxSelections, 1);
  assert.equal(ranch.options[0].priceAdjustmentCents, 0);

  const extras = whole.modifierGroups.find(({ name }) => name === "Add Extras")!;
  assert.equal(extras.minSelections, 0);
  assert.equal(extras.maxSelections, 10);
  assert.equal(extras.options.find(({ name }) => name === "Avocado")?.priceAdjustmentCents, 200);
  assert.equal(extras.options.find(({ name }) => name === "Bacon")?.priceAdjustmentCents, 200);
});

test("verified Grinder for Two and soup bowl requirements are represented independently", () => {
  const items = upperCrustSections.flatMap(({ items: sectionItems }) => sectionItems);
  const grinder = items.find(({ id }) => id === "uc-grinder-two")!;
  const sides = grinder.modifierGroups.filter(({ name }) => name === "Side Choice");
  assert.equal(sides.length, 2);
  assert.notEqual(sides[0].id, sides[1].id);
  assert.ok(sides.every(({ minSelections, maxSelections }) => minSelections === 1 && maxSelections === 1));
  assert.equal(grinder.modifierGroups.find(({ name }) => name === "Choice of Meat")?.minSelections, 2);
  assert.equal(grinder.modifierGroups.find(({ name }) => name === "Choice of Meat")?.maxSelections, 2);
  assert.equal(grinder.modifierGroups.find(({ name }) => name === "Add Extras")?.options.find(({ name }) => name === "Bacon")?.priceAdjustmentCents, 400);

  const soup = items.find(({ id }) => id === "uc-soup-bowl")!;
  const bread = soup.modifierGroups[0];
  assert.equal(bread.name, "Bread or Crackers");
  assert.equal(bread.minSelections, 0);
  assert.equal(bread.maxSelections, 1);
});
