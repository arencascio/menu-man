import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const output = ".playwright/v11-release-polish";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [412, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width === 412 ? 915 : 900 } });
    await page.goto("http://localhost:3000/work");
    const conversion = page.locator("[data-work-conversion]");
    const positions = await conversion.locator(":scope > *").evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { tag: node.tagName, text: node.textContent?.trim(), center: rect.left + rect.width / 2, width: rect.width };
    }));
    const sectionBox = await conversion.boundingBox();
    for (const item of positions) assert.ok(Math.abs(item.center - (sectionBox.x + sectionBox.width / 2)) < 2, `Work conversion ${item.tag} is centered at ${width}px (center=${item.center}, section=${sectionBox.x + sectionBox.width / 2})`);
    assert.equal(await conversion.getByRole("heading", { name: "Want this kind of clarity for your restaurant?" }).count(), 1);
    assert.equal(await conversion.getByRole("link").getAttribute("href"), "/build-my-website");
    const description = await page.locator('[data-restaurant="super-tacos"] > div:nth-child(2) > p').textContent();
    assert.equal(description, "A custom restaurant website with a searchable menu, item customization, simulated checkout, and a catering request form.");
    await conversion.screenshot({ path: `${output}/work-conversion-${width}.png` });
    await page.close();
  }

  for (const width of [412, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width === 412 ? 915 : 900 } });
    await page.goto("http://localhost:3000/");
    assert.equal(await page.locator('[data-restaurant="super-tacos"] > div:nth-child(2) > p').textContent(), "A custom restaurant website with a searchable menu, item customization, simulated checkout, and a catering request form.");
    await page.close();
  }

  for (const width of [320, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width === 320 ? 700 : 900 } });
    for (const route of ["/r/super-tacos", "/r/super-tacos/menu", "/r/super-tacos/catering"]) {
      const response = await page.goto(`http://localhost:3000${route}`);
      assert.equal(response?.status(), 200, `${route} responds at ${width}px`);
      const back = page.getByRole("link", { name: "← Back to Menu Man" });
      assert.equal(await back.getAttribute("href"), "https://getmenuman.com/");
      const linkRect = await back.boundingBox();
      assert.ok(linkRect && linkRect.width <= width - 24 && linkRect.y < 180, `back link is visible near the top at ${width}px (rect=${JSON.stringify(linkRect)})`);
      if (route === "/r/super-tacos") {
        const headerRect = await page.locator("[data-restaurant-header]").boundingBox();
        assert.ok(headerRect && linkRect.y >= headerRect.y + headerRect.height, `back link does not overlap the restaurant header at ${width}px (link=${JSON.stringify(linkRect)}, header=${JSON.stringify(headerRect)})`);
      }
      if (route.endsWith("/menu")) {
        assert.equal(await page.locator('a[href="/r/super-tacos/menu"]').count() > 0, true, "restaurant menu navigation remains present");
        assert.equal(await page.locator('a[href="/r/super-tacos/catering"]').count() > 0, true, "restaurant catering navigation remains present");
      }
      if (route.endsWith("/catering")) {
        assert.equal(await page.getByText("Try the request experience. Details stay on this page and cannot be sent. This preview does not create an inquiry or confirm a booking.").count(), 1);
        assert.equal(await page.getByText("Nothing is submitted or saved. No booking is made.").count(), 1);
      }
      if (route === "/r/super-tacos") await page.screenshot({ path: `${output}/super-tacos-${width}.png`, fullPage: false });
    }
    await page.goto("http://localhost:3000/r/super-tacos/menu");
    await page.evaluate(() => localStorage.setItem("menu-man:cart:v1:20000000-0000-4000-8000-000000000001", JSON.stringify({
      version: 1, restaurantId: "20000000-0000-4000-8000-000000000001", currency: "USD", updatedAt: new Date().toISOString(),
      lines: [{ lineId: "qa-line", menuItemId: "qa-item", sectionId: "qa-section", sectionName: "Sample", itemName: "Sample taco", quantity: 1, basePriceCents: 500, selectedModifiers: [], specialInstructions: "" }],
    })));
    await page.goto("http://localhost:3000/r/super-tacos/checkout");
    const back = page.getByRole("link", { name: "← Back to Menu Man" });
    assert.equal(await back.getAttribute("href"), "https://getmenuman.com/");
    await page.getByRole("button", { name: "Continue to demo payment" }).click();
    assert.equal(await page.getByRole("heading", { name: "A simple, simulated payment." }).count(), 1);
    assert.equal(await back.getAttribute("href"), "https://getmenuman.com/");
    await page.screenshot({ path: `${output}/simulated-checkout-${width}.png`, fullPage: false });
    await page.close();
  }
  console.log(`Focused release polish QA passed. Screenshots: ${output}`);
} finally { await browser.close(); }
