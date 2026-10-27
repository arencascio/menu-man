import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { configureUpperCrustQaAuth } from "./upper-crust-qa-auth.mjs";

const base = process.env.UPPER_CRUST_QA_URL ?? "http://127.0.0.1:3213";
const output = `.playwright/visual-fidelity/${process.env.UPPER_CRUST_VISUAL_PHASE ?? "after"}`;
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: process.env.HEADED !== "true" });
const results = [];
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    await configureUpperCrustQaAuth(context, base);
    const page = await context.newPage();
    await page.goto(`${base}/r/upper-crust`);
    const section = page.getByRole("region", { name: "Reviews", exact: true });
    const reviewRail = page.locator('[data-review-count="14"]');
    await expect(reviewRail.locator(":scope > article")).toHaveCount(14);
    await expect(reviewRail.locator("blockquote")).toHaveCount(11);
    await expect(section.locator("iframe.yelp-review")).toHaveCount(3, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    await page.locator("section").filter({ has: page.getByRole("heading", { level: 1 }) }).first().screenshot({ path: `${output}/hero-${width}.png` });
    await section.locator("..").screenshot({ path: `${output}/reviews-${width}.png` });
    await page.goto(`${base}/r/upper-crust/about`);
    const socialBar = page.locator('[aria-label="Social and review links"]');
    await expect(socialBar.getByRole("link")).toHaveCount(4);
    await expect(socialBar.getByText("4.7 / 5")).toBeVisible();
    await expect(socialBar.getByText("4.5 / 5")).toBeVisible();
    await expect(page.getByRole("list", { name: "Owner-supplied amenities" }).getByRole("listitem")).toHaveCount(7);
    const map = page.getByTitle("Map showing The Upper Crust Sandwich Shoppe in Riverside");
    await map.scrollIntoViewIfNeeded();
    const mapFrame = await map.elementHandle().then(handle => handle.contentFrame());
    await expect(mapFrame.getByRole("region", { name: "Map", exact: true })).toBeVisible({ timeout: 30000 });
    // Google's compact embed omits the business name at narrow widths. Its
    // provider Maps link still identifies the same source place by CID.
    await expect(mapFrame.getByRole("link", { name: /^(Open in )?Maps \(opens in new tab\)$/ })).toHaveAttribute("href", /cid=11819011477876750802/);
    await map.screenshot({ path: `${output}/map-${width}.png` });
    await expect(page.getByRole("link", { name: /3573 Main Street/ })).toHaveAttribute("href", /google.com\/maps\/dir/);
    await expect(page.getByRole("link", { name: "Open directions in Google Maps" })).toHaveCount(0);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.locator("#main-content").screenshot({ path: `${output}/about-${width}.png` });
    await socialBar.screenshot({ path: `${output}/about-social-${width}.png` });
    await page.getByRole("list", { name: "Owner-supplied amenities" }).screenshot({ path: `${output}/amenities-${width}.png` });
    await page.goto(`${base}/r/upper-crust/catering`);
    const call = page.getByRole("link", { name: "Call the Restaurant", exact: true });
    await expect(call).toBeVisible();
    await expect(call).toHaveAttribute("href", "tel:+19517843149");
    await call.click({ trial: true }); // Verify hit testing without placing a call.
    await expect(page.getByText("Contact the restaurant for current options, quantities, prices, minimums, lead times and policies.", { exact: true })).toBeVisible();
    await expect(page.getByText("Monday–Saturday", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator("#main-content").screenshot({ path: `${output}/catering-${width}.png` });
    results.push({ width, map: "provider content rendered", amenities: 7, socialLinks: 4, cateringCall: "visible, hit tested, correct tel", screenshots: 4 });
    writeFileSync(`${output}/results.json`, JSON.stringify({ base, results }, null, 2));
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
} finally { await browser.close(); }
