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

const wholeCustomSandwichGroups = [...customSandwichGroups, customSandwichRanch];

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

const grinderForTwoGroups = [grinderMeat, grinderToppings, grinderFirstSide, grinderSecondSide, grinderExtras];

const soupBread = group("uc-soup-bread", "Bread or Crackers", [
  { name: "Crackers" }, { name: "Rye" }, { name: "Indian Grain" }, { name: "Sourdough" },
  { name: "French Roll" }, { name: "Whole Wheat" },
], 0, 1, 0);

function item(id: string, name: string, priceCents: number, modifierGroups: MenuModifierGroup[] = []) {
  return {
    id: `uc-${id}`,
    name,
    description: null,
    price_cents: priceCents,
    image_url: null,
    is_orderable: false,
    modifierGroups,
  };
}

// Item names/prices below are transcribed from the signed-out DoorDash Delivery
// menu capture dated 2026-10-26. Description and image reuse rights were not
// established; uninspected modifier dialogs intentionally have no invented data.
export const upperCrustSections: MenuSection[] = [
  { id: "uc-specialty", name: "Specialty Sandwiches", description: null, sort_order: 0, items: [
    item("italian-sub-one", "Italian Sub for one", 1495),
    item("hawaiian", "Hawaiian", 1495),
    item("grinder-one", "Grinder for one", 1495),
    item("french-dip", "French Dip", 1495),
    item("bbq-beef", "BBQ Beef", 1395),
    item("blt", "BLT", 1395),
    item("grinder-two", "Grinder for Two", 2295, grinderForTwoGroups),
    item("italian-sub-two", "Italian Sub for Two", 2295),
  ] },
  { id: "uc-custom", name: "Custom Sandwiches", description: null, sort_order: 1, items: [
    item("custom", "Whole Custom Sandwich", 1495, wholeCustomSandwichGroups),
    item("half-custom", "Half Custom Sandwich", 1395, customSandwichGroups),
  ] },
  { id: "uc-soups", name: "Soups", description: null, sort_order: 2, items: [
    item("soup-bowl", "Soup of the Day (Bowl)", 795, [soupBread]),
    item("soup-cup", "Soup of the Day (Cup)", 695),
  ] },
  { id: "uc-salads", name: "Salads", description: null, sort_order: 3, items: [
    item("cobb-salad", "Cobb Salad", 1395),
    item("albacore-tuna-salad", "Albacore Tuna Salad", 1395),
    item("chef-salad", "Chef Salad", 1395),
    item("caesar-salad", "Caesar Salad", 1395),
    item("chicken-salad-salad", "Chicken Salad Salad", 1395),
    item("dinner-salad", "Dinner Salad", 1050),
  ] },
  { id: "uc-extras", name: "Extras", description: null, sort_order: 4, items: [
    item("side-orders", "Side Orders", 325),
    item("cheesecake", "Cheesecake", 375),
    item("chips", "Chips", 200),
    item("brownies", "Brownies", 325),
    item("two-cookies", "2 Cookies", 150),
  ] },
  { id: "uc-drinks", name: "drinks", description: null, sort_order: 5, items: [
    item("bottled-water", "Bottled Water", 200),
    item("large-drink", "Large Drink (20 oz)", 325),
    item("small-drink", "Small Drink (16 oz)", 225),
  ] },
];
