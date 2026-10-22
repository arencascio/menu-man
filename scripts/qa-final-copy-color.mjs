// Focused Chrome screenshot and copy/layout checks for the V1.1 final pass.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const output = ".playwright/final-copy-color";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [320, 412, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width === 320 ? 568 : width === 412 ? 915 : 1000 } });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.hostname === "localhost" && !/^\/(api|r)\//.test(url.pathname) ? route.continue() : route.abort();
    });
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    for (const image of await page.locator("main img").all()) {
      if (!(await image.isVisible())) continue;
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((img) => img.decode().catch(() => undefined));
    }
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1650);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${output}/home-${width}.png`, fullPage: true, animations: "disabled" });

    const result = await page.evaluate(() => {
      const headings = [...document.querySelectorAll("h2")];
      const findHeading = (value) => headings.find((heading) => heading.textContent?.trim() === value);
      const problemHeading = findHeading("Customers look online before they choose.");
      const questionHeading = findHeading("Give customers what they're looking for.");
      const reviewHeading = findHeading("See how your restaurant looks online.");
      const productTitle = findHeading("See Menu Man in action");
      const process = document.querySelector("#how-it-works");
      const menu = document.querySelector("#marketing-navigation");
      const box = questionHeading.getBoundingClientRect();
      return {
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        problemTitle: problemHeading?.textContent?.trim(),
        problemCopy: problemHeading?.parentElement.querySelector("p")?.textContent?.trim(),
        questionsTitle: questionHeading?.textContent?.trim(),
        questionsTitleHeight: box.height,
        oneLineHeading: box.height <= parseFloat(getComputedStyle(questionHeading).lineHeight) + 1,
        faqCount: document.querySelectorAll("details").length,
        forest: getComputedStyle(process).backgroundColor,
        menuForest: getComputedStyle(menu).backgroundColor,
        processAnimation: [...process.querySelector("ol").children].map((card) => ({ duration: getComputedStyle(card).transitionDuration, delay: getComputedStyle(card).transitionDelay })),
        reviewHeight: reviewHeading?.closest("section").getBoundingClientRect().height,
        faqSummaryMinHeight: getComputedStyle(document.querySelector("details summary")).minHeight,
        productTitle: productTitle?.textContent?.trim(),
        productCopy: productTitle?.parentElement.querySelector("p:not(:first-child)")?.textContent?.trim(),
        liveDemo: [...productTitle?.parentElement.querySelectorAll("a") ?? []].find((link) => /explore live demo/i.test(link.textContent))?.getAttribute("href"),
      };
    });
    assert.equal(result.documentWidth, width, "No horizontal overflow");
    assert.equal(result.problemTitle, "Customers look online before they choose.");
    assert.equal(result.problemCopy, "A great restaurant can still lose a customer when its menu, hours, or ordering options are hard to find.");
    assert.equal(result.questionsTitle, "Give customers what they're looking for.");
    assert.equal(result.faqCount, 8);
    assert.equal(result.forest, "rgb(22, 59, 50)");
    if (width <= 820) assert.equal(result.menuForest, result.forest);
    assert.deepEqual(result.processAnimation.map((card) => card.delay), ["0s", "0.4s", "0.8s"]);
    assert.ok(result.processAnimation.every((card) => card.duration.split(", ").every((duration) => parseFloat(duration) === .8)));
    assert.equal(result.productTitle, "See Menu Man in action");
    assert.equal(result.productCopy, "This is a working restaurant demo, not a mockup. Go ahead, click around.");
    assert.equal(result.liveDemo, "/r/super-tacos");
    if (width === 1440) assert.equal(result.oneLineHeading, true, "Customer questions heading fits on one desktop line");
    results.push(result);
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
