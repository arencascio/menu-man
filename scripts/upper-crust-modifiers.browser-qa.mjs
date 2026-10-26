import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = "http://127.0.0.1:3213";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
await mkdir(".playwright/upper-crust-modifiers-qa", { recursive: true });

try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    const writes = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
    });
    await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    async function open(id, name) {
      await page.goto(`${base}/r/upper-crust/menu?item=uc-${id}`);
      const dialog = page.getByRole("dialog", { name: `Item details: ${name}` });
      await expect(dialog).toBeVisible();
      return dialog;
    }
    async function edit(name, quantity) {
      await page.getByRole("button", { name: new RegExp(`Cart \\(${quantity}\\)`) }).click();
      await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
      return page.getByRole("dialog", { name: `Item details: ${name}` });
    }
    let dialog = await open("half-custom", "Half Custom Sandwich");
    await expect(dialog.getByRole("button", { name: /Add to Cart/ })).toBeDisabled();
    await dialog.getByRole("radio", { name: "Turkey Included", exact: true }).check();
    await dialog.getByRole("radio", { name: "Whole Wheat Included", exact: true }).check();
    const toppings = dialog.getByRole("group", { name: "Topping Choices Required", exact: true });
    await toppings.getByRole("checkbox", { name: "No Toppings Included", exact: true }).check();
    await toppings.getByRole("checkbox", { name: "Lettuce Included", exact: true }).check();
    await dialog.getByRole("radio", { name: "Carrot Sticks Included", exact: true }).check();
    await dialog.getByRole("group", { name: "Ranch Optional", exact: true }).getByRole("radio", { name: "Ranch Included", exact: true }).check();
    await dialog.getByRole("checkbox", { name: "Avocado +$2.00", exact: true }).check();
    await expect(dialog.getByRole("button", { name: /Add to Cart.*\$15\.95/ })).toBeEnabled();
    await dialog.getByRole("button", { name: /Add to Cart/ }).click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    dialog = await edit("Half Custom Sandwich", 1);
    await expect(dialog.getByRole("checkbox", { name: "No Toppings Included", exact: true })).toBeChecked();
    await expect(dialog.getByRole("group", { name: "Topping Choices Required", exact: true }).getByRole("checkbox", { name: "Lettuce Included", exact: true })).toBeChecked();
    await expect(dialog.getByRole("radio", { name: "Ranch Included", exact: true })).toBeChecked();
    await expect(dialog.getByRole("checkbox", { name: "Avocado +$2.00", exact: true })).toBeChecked();
    await dialog.getByRole("radio", { name: "Chips Included", exact: true }).check();
    await expect(dialog.getByRole("group", { name: "Ranch Optional", exact: true })).toHaveCount(0);
    await dialog.getByRole("radio", { name: "Carrot Sticks Included", exact: true }).check();
    await expect(dialog.getByRole("radio", { name: "Ranch Included", exact: true })).not.toBeChecked();

    dialog = await open("grinder-two", "Grinder for Two");
    await expect(dialog.getByRole("button", { name: /Add to Cart/ })).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "Pastrami Included", exact: true }).check();
    await dialog.getByRole("checkbox", { name: "Mesquite Turkey Included", exact: true }).check();
    await expect(dialog.getByRole("checkbox", { name: "Roast Beef Included", exact: true })).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "Iceburg lettuce Included", exact: true }).check();
    let sides = dialog.getByRole("group", { name: "Side Choice Required · Choose 1", exact: true });
    await expect(sides).toHaveCount(2);
    for (const i of [0, 1]) {
      await sides.nth(i).getByRole("radio", { name: "Carrot Sticks Included", exact: true }).check();
      await sides.nth(i).getByRole("radio", { name: "Ranch Included", exact: true }).check();
    }
    await dialog.getByRole("checkbox", { name: "Bacon +$4.00", exact: true }).check();
    await expect(dialog.getByRole("button", { name: /Add to Cart.*\$26\.95/ })).toBeEnabled();
    await sides.nth(0).getByRole("radio", { name: "Soup of the Day +$1.00", exact: true }).check();
    await expect(sides.nth(0).getByRole("group", { name: "Ranch Optional", exact: true })).toHaveCount(0);
    await expect(sides.nth(1).getByRole("radio", { name: "Ranch Included", exact: true })).toBeChecked();
    await expect(dialog.getByRole("button", { name: /Add to Cart.*\$27\.95/ })).toBeEnabled();
    await sides.nth(1).getByRole("radio", { name: "Soup of the Day +$1.00", exact: true }).check();
    await expect(dialog.getByRole("button", { name: /Add to Cart.*\$28\.95/ })).toBeEnabled();
    for (const i of [0, 1]) {
      await sides.nth(i).getByRole("radio", { name: "Carrot Sticks Included", exact: true }).check();
      await expect(sides.nth(i).getByRole("radio", { name: "Ranch Included", exact: true })).not.toBeChecked();
      await sides.nth(i).getByRole("radio", { name: "Ranch Included", exact: true }).check();
    }
    await dialog.getByRole("button", { name: /Add to Cart/ }).click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    dialog = await edit("Grinder for Two", 2);
    sides = dialog.getByRole("group", { name: "Side Choice Required · Choose 1", exact: true });
    await expect(sides.nth(0).getByRole("radio", { name: "Ranch Included", exact: true })).toBeChecked();
    await expect(sides.nth(1).getByRole("radio", { name: "Ranch Included", exact: true })).toBeChecked();
    await expect(dialog.getByRole("button", { name: /Update Cart.*\$26\.95/ })).toBeEnabled();
    await dialog.screenshot({ path: `.playwright/upper-crust-modifiers-qa/grinder-${width}.png` });

    dialog = await open("cobb-salad", "Cobb Salad");
    await expect(dialog.getByRole("button", { name: /Add to Cart/ })).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "Caesar Included", exact: true }).check();
    await dialog.getByRole("checkbox", { name: "Italian Included", exact: true }).check();
    await expect(dialog.getByRole("checkbox", { name: "Caesar Included", exact: true })).toBeChecked();
    await expect(dialog.getByRole("checkbox", { name: "Italian Included", exact: true })).toBeChecked();
    await expect(dialog.getByRole("button", { name: /Add to Cart.*\$13\.95/ })).toBeEnabled();
    await dialog.screenshot({ path: `.playwright/upper-crust-modifiers-qa/salad-${width}.png` });
    for (const [id, name, selection, price] of [
      ["two-cookies", "2 Cookies", "2 Chocolate Chip Cookies Included", "1.50"],
      ["large-drink", "Large Drink (20 oz)", "Coke Included", "3.25"],
      ["small-drink", "Small Drink (16 oz)", "Raspberry Tea Included", "2.25"],
      ["side-orders", "Side Orders", "Carrot Sticks w/Ranch Included", "3.25"],
      ["soup-cup", "Soup of the Day (Cup)", "Crackers Included", "6.95"],
      ["soup-bowl", "Soup of the Day (Bowl)", "Crackers Included", "7.95"],
    ]) {
      dialog = await open(id, name);
      const add = dialog.getByRole("button", { name: /Add to Cart/ });
      if (!id.startsWith("soup-")) await expect(add).toBeDisabled();
      await dialog.getByRole("radio", { name: selection, exact: true }).check();
      await expect(dialog.getByRole("button", { name: new RegExp(`Add to Cart.*\\$${price.replace('.', '\\.')}`) })).toBeEnabled();
    }
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).resolves.toBe(true);
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
    results.push({ browser: "Chrome", width, status: "passed", browserErrors: errors.length, browserWrites: writes.length });
    await context.close();
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
