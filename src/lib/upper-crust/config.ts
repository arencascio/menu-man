import type { MenuSection } from "@/app/r/[slug]/MenuBrowser";
import type { MenuModifierGroup } from "@/lib/cart/types";

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

function group(id: string, name: string, names: string[], min = 1, max = 1, sort = 0): MenuModifierGroup {
  return { id, name, description: null, minSelections: min, maxSelections: max, sortOrder: sort,
    options: names.map((name, i) => ({ id: `${id}-${i}`, name, priceAdjustmentCents: 0, sortOrder: i, isDefault: false })) };
}

// Tenant-owned fixture attachments, not additions to the shared product model.
export const sandwichGroups = [
  group("uc-bread", "Choose your bread", ["French roll", "Sourdough", "Whole wheat", "Rye", "Croissant"], 1, 1, 0),
  group("uc-protein", "Choose your protein", ["Mesquite turkey", "Ham", "Roast beef", "Pastrami", "Chicken salad", "Vegetarian"], 1, 1, 1),
  group("uc-toppings", "Make it yours", ["Lettuce", "Tomato", "Pickles", "Onion", "Sprouts", "Mayo", "Mustard", "Swiss cheese", "Provolone", "Cheddar"], 0, 10, 2),
  group("uc-side", "Choose your side", ["Potato salad", "Pasta salad", "Cole slaw", "Carrot sticks", "Chips"], 1, 1, 3),
];

function item(id: string, name: string, description: string | null, price: number, groups: MenuModifierGroup[] = []) {
  return { id: `uc-${id}`, name, description, price_cents: price, image_url: null, is_orderable: false, modifierGroups: groups };
}

// Names/categories corroborated by public listings. Original short descriptions.
// Every amount and modifier combination is illustrative, never a current quote.
export const upperCrustSections: MenuSection[] = [
  { id: "uc-custom", name: "Build it your way", description: null, sort_order: 0, items: [
    item("custom", "Whole Custom Sandwich", null, 1200, sandwichGroups),
  ] },
  { id: "uc-specialty", name: "Specialty sandwiches", description: null, sort_order: 1, items: [
    item("french-dip", "French Dip", null, 1300, [sandwichGroups[3]]),
    item("blt", "BLT", null, 1100, [sandwichGroups[0], sandwichGroups[3]]),
    item("hawaiian", "Hawaiian", null, 1300, [sandwichGroups[3]]),
    item("bbq", "BBQ Beef", null, 1200, [sandwichGroups[3]]),
  ] },
  { id: "uc-soups", name: "Soups & salads", description: null, sort_order: 2, items: [
    item("soup", "Soup of the Day", null, 500),
    item("chef", "Chef Salad", null, 1100),
  ] },
  { id: "uc-extras", name: "Sides & sweets", description: null, sort_order: 3, items: [
    item("potato", "Potato Salad", null, 300),
    item("brownie", "Brownie", null, 300),
  ] },
];
