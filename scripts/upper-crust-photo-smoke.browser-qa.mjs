import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { configureUpperCrustQaAuth } from "./upper-crust-qa-auth.mjs";
const base = process.env.UPPER_CRUST_QA_URL ?? "http://127.0.0.1:3213";
const photos = [
  ["italian-sub-one", "Italian Sub for one", "italian sub.jpg"],
  ["hawaiian", "Hawaiian", "hawaiian sandwich.jpg"],
  ["blt", "BLT", "blt.jpg"],
  ["cobb-salad", "Cobb Salad", "cobb salad.jpg"],
  ["brownies", "Brownies", "brownie.jpg"],
  ["custom", "Whole Custom Sandwich", "veggie sandwich.jpg"],
];
mkdirSync(".playwright/upper-crust-photos", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await configureUpperCrustQaAuth(context, base);
    const page = await context.newPage();
    const writes = [], errors = [];
    page.on("request", r => { if (!["GET", "HEAD"].includes(r.method())) writes.push(r.url()); });
    page.on("pageerror", e => errors.push(e.message));
    for (const [id, name, file] of photos) {
      await page.goto(`${base}/r/upper-crust/menu?item=uc-${id}`);
      const dialog = page.getByRole("dialog", { name: `Item details: ${name}` });
      const image = dialog.getByRole("img", { name, exact: true });
      await expect(image).toHaveAttribute("src", `/r/upper-crust/media/${encodeURIComponent(file)}`);
      await expect.poll(() => image.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
      if (id === "custom") await dialog.screenshot({path:`.playwright/upper-crust-photos/custom-${width}.png`});
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      const card = page.locator('button[aria-haspopup="dialog"]').filter({hasText:name}).first();
      await card.scrollIntoViewIfNeeded();
      const cardImage = card.getByRole("img", { name, exact: true });
      await expect(cardImage).toHaveAttribute("src", `/r/upper-crust/media/${encodeURIComponent(file)}`);
      await expect.poll(() => cardImage.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    // Sample order, edit, and simulated checkout. No restaurant API writes.
    await page.goto(`${base}/r/upper-crust/menu?item=uc-brownies`);
    await page.getByRole("button", { name: /Add to Cart/ }).click();
    await page.getByRole("button", { name: /Cart \(1\)/ }).click();
    await page.getByRole("button", { name: "Edit Brownies", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Item details: Brownies" })).toBeVisible();
    await page.getByRole("button", { name: /Update Cart/ }).click();
    await page.goto(`${base}/r/upper-crust/checkout`);
    await expect(page.getByRole("heading", { name: "1 × Brownies", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Continue to demo payment" }).click();
    await page.getByRole("button", { name: "Simulate payment", exact: true }).click();
    await expect(page.getByText("No payment was taken.", { exact: true })).toBeVisible();
    await expect(page.getByText("No order was sent to a restaurant, and nothing will be prepared.", { exact: true })).toBeVisible();
    const optimizerStatus = await page.evaluate(async () => (await fetch("/_next/image?url=%2Fr%2Fupper-crust%2Fmedia%2Fveggie%2520sandwich.jpg&w=640&q=75")).status);
    expect([400, 404]).toContain(optimizerStatus);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
    console.log(JSON.stringify({ width, photoIdentities: photos.length, cardDetail: "passed", sampleAddEditCheckout: "passed", optimizerStatus, writes: 0, errors: 0 }));
    await context.close();
  }
} finally { await browser.close(); }
