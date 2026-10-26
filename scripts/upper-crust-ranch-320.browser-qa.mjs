import { chromium, expect } from "@playwright/test";

const base = "http://127.0.0.1:3214";
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 320, height: 820 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  const writes = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort());

  await page.goto(`${base}/r/upper-crust/menu?item=uc-italian-sub-one`);
  let dialog = page.getByRole("dialog", { name: "Item details: Italian Sub for one" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Iceburg lettuce Included", exact: true }).check();
  await dialog.getByRole("radio", { name: "Carrot Sticks Included", exact: true }).check();
  let ranch = dialog.getByRole("group", { name: "Ranch Optional", exact: true });
  await expect(ranch).toHaveCount(1);
  await ranch.getByRole("radio", { name: "Ranch Included", exact: true }).check();
  await expect(dialog.getByRole("button", { name: /Add to Cart.*\$14\.95/ })).toBeEnabled();

  await page.goto(`${base}/r/upper-crust/menu?item=uc-italian-sub-two`);
  dialog = page.getByRole("dialog", { name: "Item details: Italian Sub for Two" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Iceburg lettuce Included", exact: true }).check();
  const sides = dialog.getByRole("group", { name: /Side Choice Required/ });
  await expect(sides).toHaveCount(2);
  await sides.nth(0).getByRole("radio", { name: "Carrot Sticks Included", exact: true }).check();
  ranch = dialog.getByRole("group", { name: "Ranch Optional", exact: true });
  await expect(ranch).toHaveCount(1);
  await sides.nth(1).getByRole("radio", { name: "Carrot Sticks Included", exact: true }).check();
  await expect(ranch).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: /Add to Cart.*\$22\.95/ })).toBeEnabled();
  await sides.nth(0).getByRole("radio", { name: "Fresh Fruit \(Seasonal\) Included", exact: true }).check();
  await expect(dialog.getByRole("group", { name: "Ranch Optional", exact: true })).toHaveCount(0);
  await expect(sides.nth(1).getByRole("radio", { name: "Carrot Sticks Included", exact: true })).toBeChecked();

  await expect(page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).resolves.toBe(true);
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
  console.log(JSON.stringify({ browser: "Chrome", width: 320, status: "passed", browserErrors: errors.length, browserWrites: writes.length }));
  await context.close();
} finally {
  await browser.close();
}
