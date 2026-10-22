// Targeted presentation QA. Marketing submission is intercepted; no emails or DB writes.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const out = ".playwright/final-marketing-polish";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];
const captureStyle = "header { visibility: hidden !important; }";
const fields = ["restaurantName", "name", "email", "phone", "city", "website", "onlineOrdering", "orderingProviders", "help", "notes", "companyFax"];
async function prepare(page) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "localhost" && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/r/") ? route.continue() : route.abort();
  });
}
try {
  for (const width of [320, 412, 768, 1440]) {
    const viewport = { width, height: width === 320 ? 568 : width === 412 ? 915 : width === 768 ? 1024 : 900 };
    for (const route of ["/", "/work"]) {
      const staticPage = await browser.newPage({ viewport, javaScriptEnabled: false });
      await prepare(staticPage); await staticPage.goto(`http://localhost:3000${route}`);
      const staticHeight = await staticPage.locator("[data-featurettes]").evaluate((root) => root.getBoundingClientRect().height);
      await staticPage.close();
      const page = await browser.newPage({ viewport }); const errors = [];
      page.on("pageerror", (e) => errors.push(e.message)); await prepare(page);
      await page.addInitScript(() => {
        window.openPanels = [];
        new MutationObserver((records) => { for (const record of records) if (record.target.matches?.('[data-featurettes] [data-open="true"]')) window.openPanels.push(record.target.id); }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-open"] });
      });
      await page.goto(`http://localhost:3000${route}`); await page.evaluate(() => document.fonts.ready);
      const features = page.locator("[data-featurettes]");
      await page.waitForTimeout(200);
      assert.equal(await features.locator('button[aria-expanded="true"]').count(), width <= 820 ? 0 : 1);
      assert.ok(Math.abs((await features.boundingBox()).height - staticHeight) < 2, "SSR and hydrated featurette dimensions match");
      if (width <= 820) assert.deepEqual(await page.evaluate(() => window.openPanels), [], "Mobile never flashes open during hydration");
      const section = page.locator("[data-working-product]").locator("..");
      assert.equal(await section.getByRole("heading", { name: "See Menu Man in action", exact: true }).count(), 1);
      assert.equal(await section.getByText("This is a working restaurant demo, not a mockup. Go ahead, click around.", { exact: true }).count(), 1);
      const primary = section.getByRole("link", { name: "EXPLORE LIVE DEMO", exact: true });
      assert.equal(await primary.getAttribute("href"), "/r/super-tacos");
      assert.equal(await primary.evaluate((link) => getComputedStyle(link).backgroundColor), "rgb(233, 75, 53)");
      assert.equal(await section.getByRole("link", { name: "I WANT A SITE LIKE THIS", exact: true }).getAttribute("href"), "/build-my-website");
      const card = section.locator("[data-restaurant-showcases]");
      assert.ok((await card.innerText()).includes("A fully-featured restaurant website with a custom menu, item customization, simulated ordering, and a catering request preview."));
      for (const link of [primary, card.getByRole("link", { name: "Explore live demo", exact: true })]) {
        assert.equal(await link.locator("img").count(), 1);
        assert.equal(await link.locator("svg").count(), 0);
        assert.equal(await link.locator("img").getAttribute("aria-hidden"), "true");
        assert.equal(await link.locator("img").getAttribute("src").then((src) => src.includes("square-play")), true);
        assert.ok(!/[↗→]/.test(await link.innerText()));
      }
      await card.scrollIntoViewIfNeeded(); await card.locator('article img[data-nimg="fill"]').evaluate((img) => img.decode());
      await features.screenshot({ path: `${out}/${route === "/" ? "home" : "work"}-features-${width}.png`, style: captureStyle });
      await section.screenshot({ path: `${out}/${route === "/" ? "home" : "work"}-working-product-${width}.png`, style: captureStyle });
      const selectors = features.getByRole("button");
      await selectors.nth(2).click(); await page.waitForTimeout(450);
      assert.equal(await features.locator('button[aria-expanded="true"]').count(), 1);
      if (width <= 820) {
        const inline = await features.locator('[data-open="true"]').evaluate((panel) => Math.abs(panel.getBoundingClientRect().top - panel.previousElementSibling.getBoundingClientRect().bottom));
        assert.ok(inline < 3); await selectors.nth(2).click(); await page.waitForTimeout(450);
        assert.equal(await features.locator('button[aria-expanded="true"]').count(), 0);
      } else {
        await selectors.nth(2).focus(); await page.keyboard.press("ArrowDown");
        assert.equal(await selectors.nth(3).getAttribute("aria-expanded"), "true");
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      report.push({ route, width, featuretteInitialHeight: staticHeight, initialOpen: width <= 820 ? 0 : 1, hydrationHeightStable: true });
      await page.close();
    }
    const services = await browser.newPage({ viewport }); await prepare(services);
    await services.goto("http://localhost:3000/services");
    const ecosystem = services.locator("[data-ordering-ecosystem]");
    assert.equal(await ecosystem.getByRole("heading").innerText(), "Your ordering setup does not have to change.");
    assert.deepEqual(await ecosystem.locator("li").allTextContents(), ["Square", "Clover", "Toast", "DoorDash", "Uber Eats", "Grubhub"]);
    await ecosystem.screenshot({ path: `${out}/services-ecosystem-${width}.png`, style: captureStyle });
    if (width <= 820) {
      await ecosystem.locator("ul").evaluate((strip) => strip.scrollLeft = strip.scrollWidth);
      assert.ok(await ecosystem.locator("li").last().evaluate((item) => item.getBoundingClientRect().right <= innerWidth));
    }
    assert.equal(await services.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await services.close();

    const build = await browser.newPage({ viewport }); await prepare(build);
    await build.goto("http://localhost:3000/build-my-website"); await build.evaluate(() => document.fonts.ready);
    const form = build.locator("main form");
    for (const name of fields) assert.ok(await form.locator(`[name="${name}"]`).count() >= 1, `${name} retained`);
    assert.equal(await form.evaluate((node) => node.checkValidity()), false);
    const pricing = form.getByText("$99/month", { exact: true });
    assert.equal(await pricing.isVisible(), width <= 820);
    if (width <= 820) assert.equal(await pricing.evaluate((node) => node.parentElement.nextElementSibling?.getAttribute("type")), "submit");
    const geometry = await form.evaluate((node) => ({ top: node.getBoundingClientRect().top, height: node.getBoundingClientRect().height, minInput: Math.min(...[...node.querySelectorAll('input:not([type="radio"]):not([name="companyFax"]), select')].map((input) => input.getBoundingClientRect().height)) }));
    assert.ok(geometry.minInput >= 44);
    if (width <= 820) assert.ok(geometry.top < viewport.height, "Form starts in the initial viewport");
    await build.locator("main").screenshot({ path: `${out}/build-${width}.png`, style: captureStyle });
    assert.equal(await build.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (width === 412) {
      const submissions = [];
      await build.route("**/api/marketing/leads", (route) => { submissions.push(route.request().postDataJSON()); return route.fulfill({ status: submissions.length === 1 ? 503 : 200, json: submissions.length === 1 ? { error: "QA simulated delivery failure" } : { accepted: true } }); });
      for (const [name, value] of Object.entries({ restaurantName: "QA Restaurant", name: "QA Owner", email: "qa@example.invalid", phone: "555-0100", city: "QA City", website: "example.invalid", orderingProviders: "Square", notes: "Local intercepted QA" })) await form.locator(`[name="${name}"]`).fill(value);
      await form.locator('[name="onlineOrdering"][value="yes"]').check();
      await form.locator('[name="help"]').selectOption({ label: "Build my first website" });
      await form.getByRole("button", { name: /BUILD MY WEBSITE/ }).click();
      await build.getByRole("alert").filter({ hasText: "QA simulated delivery failure" }).waitFor();
      assert.equal(await form.locator('[name="restaurantName"]').inputValue(), "QA Restaurant");
      await form.getByRole("button", { name: /BUILD MY WEBSITE/ }).click();
      await build.getByRole("heading", { name: "Your inquiry has been sent." }).waitFor();
      assert.equal(submissions.length, 2);
      for (const name of fields) assert.ok(name in submissions[0], `${name} remains in the payload`);
      assert.equal(submissions[0].submissionId, submissions[1].submissionId);
      report.push({ formSubmission: "intercepted failure, preserved values, retry and success; no email sent" });
    }
    report.push({ route: "/build-my-website", width, ...geometry });
    await build.close();
  }
  const reduced = await browser.newPage({ viewport: { width: 412, height: 915 }, reducedMotion: "reduce" });
  await prepare(reduced); await reduced.goto("http://localhost:3000/work");
  const reducedFeatures = reduced.locator("[data-featurettes]");
  assert.equal(await reducedFeatures.locator('button[aria-expanded="true"]').count(), 0);
  await reducedFeatures.getByRole("button").first().click();
  assert.equal(await reducedFeatures.locator('[data-open="true"] figure').evaluate((media) => getComputedStyle(media).animationName), "none");
  await reduced.close();
  report.push({ reducedMotion: "closed initial mobile state; no feature media entrance animation" });
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
