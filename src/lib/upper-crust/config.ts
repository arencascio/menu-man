import type { MenuSection } from "@/app/r/[slug]/MenuBrowser";
import type { MenuModifierGroup, MenuModifierOption } from "@/lib/cart/types";

// Local, synthetic identity. Never imported into a database or commerce policy.
export const upperCrust = {
  id: "30000000-0000-4000-8000-000000000002",
  slug: "upper-crust",
  name: "The Upper Crust Sandwich Shoppe",
  shortName: "Upper Crust",
  address: "3573 Main Street",
  locality: "Riverside, CA 92501",
  phone: "(951) 784-3149",
  hours: "Monday–Saturday 10 AM–5 PM · Sunday 11 AM–4 PM. Regular hours; holidays may differ.",
  providerUrl: "https://www.doordash.com/store/the-upper-crust-sandwich-shoppe-riverside-86182/",
  disclosure: "Unofficial website concept by Menu Man. Not affiliated with or operated by Upper Crust. Orders are simulated.",
  theme: { primary: "#28574c", accent: "#28574c", background: "#f6f0e3", surface: "#fffaf0", text: "#302c25", mutedText: "#6b6255", headingFont: "Georgia, Times New Roman, serif", bodyFont: "Arial, Helvetica, sans-serif", borderRadius: "6px" },
};

type FixtureOption = { name: string; priceCents?: number };

function optionId(groupId: string, name: string) {
  return `${groupId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`;
}

function group(
  id: string,
  name: string,
  choices: FixtureOption[],
  minSelections: number,
  maxSelections: number,
  sortOrder: number,
  visibleWhen?: MenuModifierGroup["visibleWhen"],
): MenuModifierGroup {
  return {
    id,
    name,
    description: null,
    minSelections,
    maxSelections,
    sortOrder,
    ...(visibleWhen ? { visibleWhen } : {}),
    options: choices.map(({ name: optionName, priceCents = 0 }, sort): MenuModifierOption => ({
      id: optionId(id, optionName),
      name: optionName,
      priceAdjustmentCents: priceCents,
      sortOrder: sort,
      isDefault: false,
    })),
  };
}

const sandwichFilling = group("uc-custom-filling", "Choose Filling", [
  { name: "Vegetarian (Includes Avocado)" }, { name: "Tuna Salad" }, { name: "Chicken Salad" },
  { name: "Pastrami" }, { name: "Egg Salad" }, { name: "Turkey" }, { name: "Corned Beef" },
  { name: "Roast Beef" }, { name: "Ham" },
], 1, 1, 0);

const sandwichBread = group("uc-custom-bread", "Bread Choice", [
  { name: "French Roll (If Available)" }, { name: "Indian Grain" }, { name: "Rye" },
  { name: "Sourdough" }, { name: "Whole Wheat" },
], 1, 1, 1);

const sandwichToppings = group("uc-custom-toppings", "Topping Choices", [
  { name: "Lettuce" }, { name: "Tomatos" }, { name: "Pickles" }, { name: "Cheese" },
  { name: "Onions" }, { name: "Sprouts" }, { name: "Mayo" }, { name: "Mustard" }, { name: "No Toppings" },
], 1, 9, 2);

const customSandwichSides = group("uc-custom-sides", "Side Choice", [
  { name: "Soup of the Day", priceCents: 100 }, { name: "Macaroni Salad" }, { name: "Pasta Salad" },
  { name: "Potato Salad" }, { name: "Chips" }, { name: "Fresh Fruit (Seasonal)" },
  { name: "Carrot Sticks" }, { name: "Cole Slaw" },
], 1, 1, 3);

const customSandwichExtras = group("uc-custom-extras", "Add Extras", [
  { name: "Cheese", priceCents: 50 }, { name: "Lettuce", priceCents: 50 }, { name: "Mayo", priceCents: 50 },
  { name: "Mustard", priceCents: 50 }, { name: "Onions", priceCents: 50 }, { name: "Pickles", priceCents: 50 },
  { name: "Sprouts", priceCents: 50 }, { name: "Tomato", priceCents: 50 },
  { name: "Avocado", priceCents: 200 }, { name: "Bacon", priceCents: 200 },
], 0, 10, 4);

const customSandwichRanch = group("uc-custom-carrot-ranch", "Ranch", [
  { name: "Ranch" },
], 0, 1, 5, { groupId: customSandwichSides.id, optionId: optionId(customSandwichSides.id, "Carrot Sticks") });

const customSandwichGroups = [
  sandwichFilling,
  sandwichBread,
  sandwichToppings,
  customSandwichSides,
  customSandwichExtras,
];

const verifiedCustomSandwichGroups = [...customSandwichGroups, customSandwichRanch];

const grinderMeat = group("uc-grinder-two-meat", "Choice of Meat", [
  { name: "Pastrami" }, { name: "Mesquite Turkey" }, { name: "Corned Beef" },
  { name: "Roast Beef" }, { name: "Honey Baked Ham" },
], 2, 2, 0);

const grinderToppings = group("uc-grinder-two-toppings", "Topping Choices A", [
  { name: "Iceburg lettuce" }, { name: "Tomatos" }, { name: "Pickles" }, { name: "Cheese" },
  { name: "Onions" }, { name: "Mayo" }, { name: "Mustard" },
], 1, 7, 1);

const grinderFirstSide = group("uc-grinder-two-side-a", "Side Choice", [
  { name: "Soup of the Day", priceCents: 100 }, { name: "Fresh Fruit (Seasonal)" }, { name: "Chips" },
  { name: "Macaroni Salad" }, { name: "Carrot Sticks" }, { name: "Cole Slaw" },
  { name: "Potato Salad" }, { name: "Pasta Salad" },
], 1, 1, 2);

const grinderSecondSide = group("uc-grinder-two-side-b", "Side Choice", [
  { name: "Soup of the Day", priceCents: 100 }, { name: "Macaroni Salad" }, { name: "Pasta Salad" },
  { name: "Potato Salad" }, { name: "Chips" }, { name: "Fresh Fruit (Seasonal)" },
  { name: "Carrot Sticks" }, { name: "Cole Slaw" },
], 1, 1, 3);

const grinderExtras = group("uc-grinder-two-extras", "Add Extras", [
  { name: "Iceberg Lettuce" }, { name: "Tomato" }, { name: "Pickles" }, { name: "Cheese" },
  { name: "Onions" }, { name: "Mayo" }, { name: "Mustard" },
  { name: "Avocado", priceCents: 400 }, { name: "Bacon", priceCents: 400 },
], 0, 9, 4);

function carrotRanch(id: string, side: MenuModifierGroup, sortOrder: number) {
  return group(id, "Ranch", [{ name: "Ranch" }], 0, 1, sortOrder,
    { groupId: side.id, optionId: optionId(side.id, "Carrot Sticks") });
}

const grinderFirstSideRanch = carrotRanch("uc-grinder-two-carrot-ranch-a", grinderFirstSide, 5);

const grinderForTwoGroups = [
  grinderMeat, grinderToppings, grinderFirstSide, grinderSecondSide, grinderExtras,
  grinderFirstSideRanch,
  carrotRanch("uc-grinder-two-carrot-ranch-b", grinderSecondSide, 6),
];

const hawaiianToppings = group("uc-hawaiian-toppings", "Hawaiian Topping Choices", [
  { name: "Lettuce" }, { name: "Mayo" }, { name: "Pineapple" }, { name: "Swiss Cheese" },
], 0, 4, 1);

const frenchDipOnions = group("uc-french-dip-onions", "French Dip Other Toppings", [
  { name: "Onions" },
], 0, 1, 1);
const frenchDipCheese = group("uc-french-dip-cheese", "French Dip Cheese Choices", [
  { name: "Cheddar" }, { name: "Swiss" }, { name: "Provolone" },
], 0, 1, 2);
const bbqOnions = group("uc-bbq-onions", "BBQ Other Toppings", [{ name: "Onions" }], 0, 1, 1);
const bbqCheese = group("uc-bbq-cheese", "BBQ Cheese Choices", [
  { name: "Cheddar" }, { name: "Provolone" }, { name: "Swiss" },
], 0, 1, 2);
const bltToppings = group("uc-blt-toppings", "BLT Toppings", [
  { name: "Bacon" }, { name: "Iceburg Lettuce" }, { name: "Mayo" }, { name: "Tomatos" },
], 0, 4, 2);

const soupBread = group("uc-soup-bread", "Bread or Crackers", [
  { name: "Crackers" }, { name: "Rye" }, { name: "Indian Grain" }, { name: "Sourdough" },
  { name: "French Roll" }, { name: "Whole Wheat" },
], 0, 1, 0);

// "Select at least 1" uses checkboxes with no smaller displayed maximum.
// Preserve the full eight-option selection range, rather than forcing one.
const saladDressing = group("uc-salad-dressing", "Dressing Choice", [
  { name: "Caesar" }, { name: "Italian" }, { name: "Rasberry Vinegarette" },
  { name: "Thousand Island" }, { name: "Vidalia Onion Vinegarette" },
  { name: "Balsamic Vinegarette" }, { name: "Ranch" }, { name: "Blue Chesse" },
], 1, 8, 0);
const additionalSide = group("uc-additional-side", "Additional Side Order", [
  { name: "Potato Salad" }, { name: "Pasta Salad" }, { name: "Macaroni Salad" },
  { name: "Fresh Fruit (Seasonal)" }, { name: "Cole Slaw" }, { name: "Carrot Sticks w/Ranch" },
], 1, 1, 0);
const cookieSelection = group("uc-cookies", "Cookie Selection", [
  { name: "2 Reese's Peanut Butter Cookies" }, { name: "2 Chocolate Chip Cookies" },
  { name: "1 Reese’s Peanut Butter Cookie and 1 Chocolate Chip Cookie" },
], 1, 1, 0);
const drinkChoices = group("uc-drink-choices", "Drink Choices", [
  { name: "Coke" }, { name: "Diet Coke" }, { name: "Sprite" }, { name: "Dr. Pepper" },
  { name: "Lemonade" }, { name: "Raspberry Tea" }, { name: "Unsweetened Tea" },
], 1, 1, 0);

function item(id: string, name: string, priceCents: number, modifierGroups: MenuModifierGroup[] = []) {
  return {
    id: `uc-${id}`,
    name,
    description: null,
    price_cents: priceCents,
    image_url: null,
    is_orderable: false,
    modifierGroups: modifierGroups.map((modifierGroup, sortOrder) => ({ ...modifierGroup, sortOrder })),
  };
}

// Item names/prices below are transcribed from the signed-out DoorDash Delivery
// menu capture dated 2026-10-26. Description and image reuse rights were not
// established. Verified item groups and remaining source gaps are recorded in
// docs/upper-crust-modifier-evidence.md; no defaults or missing branches are inferred.
export const upperCrustSections: MenuSection[] = [
  { id: "uc-specialty", name: "Specialty Sandwiches", description: null, sort_order: 0, items: [
    item("italian-sub-one", "Italian Sub for one", 1495, [grinderToppings, customSandwichSides, customSandwichExtras, customSandwichRanch]),
    item("hawaiian", "Hawaiian", 1495, [customSandwichSides, hawaiianToppings, customSandwichExtras, customSandwichRanch]),
    item("grinder-one", "Grinder for one", 1495, [grinderToppings, grinderMeat, customSandwichSides, customSandwichExtras, customSandwichRanch]),
    item("french-dip", "French Dip", 1495, [customSandwichSides, frenchDipOnions, frenchDipCheese, customSandwichRanch]),
    item("bbq-beef", "BBQ Beef", 1395, [customSandwichSides, bbqOnions, bbqCheese, customSandwichRanch]),
    item("blt", "BLT", 1395, [sandwichBread, customSandwichSides, bltToppings, customSandwichExtras, customSandwichRanch]),
    item("grinder-two", "Grinder for Two", 2295, grinderForTwoGroups),
    item("italian-sub-two", "Italian Sub for Two", 2295, [grinderToppings, grinderFirstSide, grinderSecondSide, grinderExtras, grinderFirstSideRanch]),
  ] },
  { id: "uc-custom", name: "Custom Sandwiches", description: null, sort_order: 1, items: [
    item("custom", "Whole Custom Sandwich", 1495, verifiedCustomSandwichGroups),
    item("half-custom", "Half Custom Sandwich", 1395, verifiedCustomSandwichGroups),
  ] },
  { id: "uc-soups", name: "Soups", description: null, sort_order: 2, items: [
    item("soup-bowl", "Soup of the Day (Bowl)", 795, [soupBread]),
    item("soup-cup", "Soup of the Day (Cup)", 695, [soupBread]),
  ] },
  { id: "uc-salads", name: "Salads", description: null, sort_order: 3, items: [
    item("cobb-salad", "Cobb Salad", 1395, [saladDressing]),
    item("albacore-tuna-salad", "Albacore Tuna Salad", 1395, [saladDressing]),
    item("chef-salad", "Chef Salad", 1395, [saladDressing]),
    item("caesar-salad", "Caesar Salad", 1395),
    item("chicken-salad-salad", "Chicken Salad Salad", 1395, [saladDressing]),
    item("dinner-salad", "Dinner Salad", 1050, [saladDressing]),
  ] },
  { id: "uc-extras", name: "Extras", description: null, sort_order: 4, items: [
    item("side-orders", "Side Orders", 325, [additionalSide]),
    item("cheesecake", "Cheesecake", 375),
    item("chips", "Chips", 200),
    item("brownies", "Brownies", 325),
    item("two-cookies", "2 Cookies", 150, [cookieSelection]),
  ] },
  { id: "uc-drinks", name: "Drinks", description: null, sort_order: 5, items: [
    item("bottled-water", "Bottled Water", 200),
    item("large-drink", "Large Drink (20 oz)", 325, [drinkChoices]),
    item("small-drink", "Small Drink (16 oz)", 225, [drinkChoices]),
  ] },
];
