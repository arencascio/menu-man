import { chromium, expect } from "@playwright/test";

const base = "http://127.0.0.1:3213";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];

try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    const writes = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
    });
    await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await page.goto(`${base}/r/upper-crust/menu?item=uc-custom`);

    await expect(page.getByRole("heading", { name: "Specialty Sandwiches" })).toBeVisible();
    for (const category of ["Custom Sandwiches", "Soups", "Salads", "Extras", "drinks"]) {
      await expect(page.getByRole("heading", { name: category })).toBeVisible();
    }
    for (const [name, price] of [
      ["Italian Sub for one", "$14.95"], ["Grinder for Two", "$22.95"], ["Whole Custom Sandwich", "$14.95"],
      ["Soup of the Day (Bowl)", "$7.95"], ["Chicken Salad Salad", "$13.95"], ["2 Cookies", "$1.50"],
      ["Large Drink (20 oz)", "$3.25"],
    ]) {
      await expect(page.getByRole("button", { name: `${name} ${price}`, exact: false }).first()).toBeVisible();
    }
    const imagePage = await context.newPage();
    await imagePage.goto(`${base}/r/upper-crust/menu`);
    for (const [name, file] of [
      ["Italian Sub for one", "italian sub.jpg"], ["Hawaiian", "hawaiian sandwich.jpg"],
      ["BLT", "blt.jpg"], ["Cobb Salad", "cobb salad.jpg"], ["Brownies", "brownie.jpg"],
    ]) {
      await imagePage.getByRole("button", { name: new RegExp(name) }).first().scrollIntoViewIfNeeded();
      const image = imagePage.getByRole("img", { name, exact: true });
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute("src", `/r/upper-crust/media/${encodeURIComponent(file)}`);
      await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
    }
    await expect(imagePage.getByText("Lettuce, mayo, pineapple, and Swiss cheese, with a choice of side.", { exact: true })).toBeVisible();
    await imagePage.close();
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).resolves.toBe(true);

    const dialog = page.getByRole("dialog", { name: "Item details: Whole Custom Sandwich" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Add to Cart/ })).toBeDisabled();
    await dialog.getByRole("radio", { name: "Vegetarian (Includes Avocado) Included" }).check();
    await dialog.getByRole("radio", { name: "French Roll (If Available) Included" }).check();
    await expect(dialog.getByRole("group", { name: /Topping Choices Optional/ }).getByRole("checkbox", { name: "Lettuce Included" })).toBeChecked();
    await dialog.getByRole("radio", { name: "Soup of the Day +$1.00" }).check();
    await expect(dialog.getByRole("button", { name: /Add to Cart.*\$15\.95/ })).toBeEnabled();
    await dialog.getByRole("checkbox", { name: "Bacon +$2.00" }).check();
    await expect(dialog.getByRole("button", { name: /Add to Cart.*\$17\.95/ })).toBeEnabled();
    await dialog.getByRole("radio", { name: "Carrot Sticks Included" }).check();
    const ranch = dialog.getByRole("group", { name: "Ranch Optional" });
    await expect(ranch).toBeVisible();
    await ranch.getByRole("radio", { name: "Ranch Included" }).check();
    await expect(dialog.getByRole("button", { name: /Add to Cart.*\$16\.95/ })).toBeEnabled();
    await dialog.getByRole("button", { name: /Add to Cart.*\$16\.95/ }).click();

    await page.getByRole("button", { name: /Cart \(1\)/ }).click();
    const cart = page.getByRole("complementary", { name: "Your cart" });
    await expect(cart).toContainText("Whole Custom Sandwich");
    await expect(cart).toContainText("Carrot Sticks");
    await expect(cart).toContainText("Ranch");
    await expect(cart).toContainText("Bacon");
    await expect(cart).toContainText("$16.95");
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).resolves.toBe(true);
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
    results.push({ width, status: "passed", browserErrors: errors.length, browserWrites: writes.length });
    await context.close();
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
