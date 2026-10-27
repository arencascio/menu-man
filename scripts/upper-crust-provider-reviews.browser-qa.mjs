// Uses actual official Yelp responses in Google Chrome; never substitutes cards.
import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { configureUpperCrustQaAuth } from "./upper-crust-qa-auth.mjs";

const base = process.env.UPPER_CRUST_QA_URL ?? "http://127.0.0.1:3213";
const output = ".playwright/visual-fidelity/interactions";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: process.env.HEADED !== "true" });
const results = [];
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 },
      recordVideo: { dir: `${output}/videos`, size: {width, height:1000} },
      ...(process.env.UPPER_CRUST_QA_STORAGE ? { storageState: process.env.UPPER_CRUST_QA_STORAGE } : {}),
    });
    await configureUpperCrustQaAuth(context, base);
    const page = await context.newPage();
    if (width === 390) {
      await page.route("https://www.yelp.com/embed/widgets.js", async route => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        await route.continue();
      });
    }
    const errors = [];
    const providerMessageErrors = [];
    page.on("pageerror", e => {
      // Yelp's official one-shot listener JSON.parses every window message.
      // Vercel's Preview toolbar sends objects; retain this known provider
      // diagnostic while failing on every other exception. Never patch Yelp.
      if (e.message.includes('"[object Object]" is not valid JSON') && /https:\/\/www\.yelp\.com\/embed\/widgets\.js/.test(e.stack ?? "")) providerMessageErrors.push(e.message);
      else errors.push(e.message);
    });
    const directVisitStarted = Date.now();
    await page.goto(`${base}/r/upper-crust`);
    const rail = page.locator('[data-review-count="14"]');
    const section = page.getByRole("region", { name: "Reviews", exact: true });
    const composition = section.locator("..");
    await expect(rail).toBeVisible();
    await expect(rail.locator(":scope > article")).toHaveCount(14);
    await expect(rail.locator("blockquote")).toHaveCount(11);
    await expect(rail).toContainText("I’ve been visiting The Upper Crust");
    await expect(rail).toContainText("I don’t know which was better");
    await expect(rail).not.toContainText("â€™");
    await expect(rail.locator("iframe.yelp-review")).toHaveCount(3, { timeout: 30000 });
    await expect.poll(() => page.frames().filter(f => f.url().includes("/embed/review/")).length, { timeout: 30000 }).toBe(3);
    const frames = page.frames().filter(f => f.url().includes("/embed/review/"));
    expect(frames).toHaveLength(3);
    const directVisitReadyMs = Date.now() - directVisitStarted;
    for (const [i, name] of ["Bree H.", "Diana C.", "Michael P."].entries()) {
      await expect(frames[i].locator("body")).toContainText(name, { timeout: 30000 });
      await expect(frames[i].getByRole("link", { name: "Read more on Yelp" })).toHaveCount(1);
      // Preserve the provider's complete card/branding, including at 320px.
      expect(await frames[i].locator(".review").evaluate(el => el.getBoundingClientRect().right <= innerWidth + 1)).toBe(true);
    }
    await rail.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    let reloads = 0;
    page.on("framenavigated", f => { if (frames.includes(f)) reloads++; });
    await rail.evaluate(el => { window.ucReviewFrames = [...el.querySelectorAll("iframe")]; });
    const next = section.getByRole("button", { name: "Next testimonial", exact: true });
    const previous = section.getByRole("button", { name: "Previous testimonial", exact: true });
    async function check(index) {
      await expect(rail).toHaveAttribute("data-active-index", String(index));
      await page.waitForTimeout(500);
      const geometry = await rail.evaluate(el => {
        const box = el.getBoundingClientRect();
        const visible = [...el.children].filter(c => c.getAttribute("aria-hidden") === "false");
        return {
          count: visible.length,
          fits: visible.every(c => { const r = c.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1 && r.height <= box.height + 1 && !c.inert; }),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          identities: window.ucReviewFrames.every((f, i) => f === el.querySelectorAll("iframe")[i]),
        };
      });
      expect(geometry).toEqual({ count: width <= 600 ? 1 : width <= 1000 ? 2 : 3, fits: true, overflow: false, identities: true });
    }
    async function evidence(label) {
      await composition.screenshot({ path: `${output}/${width}-${label}.png` });
    }
    await check(0);
    await evidence("initial");
    for (const n of [1, 2, 0, 1]) {
      await next.click();
      await page.waitForTimeout(100);
      await evidence(`next-${n}-moving`);
      await check(n);
      await evidence(`next-${n}-settled`);
    }
    await rail.focus(); await page.keyboard.press("Home"); await check(0);
    await previous.click(); await page.waitForTimeout(100);
    await evidence("previous-wrap-moving"); await check(13);
    await evidence("previous-wrap-settled");
    await rail.focus(); await page.keyboard.press("Home"); await check(0);
    await next.click(); await check(1);
    await previous.click(); await check(0);
    await rail.focus(); await page.keyboard.press("End"); await check(13);
    await expect(section.locator('[aria-live="polite"]')).toContainText("Review 14 of 14");
    await page.keyboard.press("Home"); await check(0);
    await page.keyboard.press("ArrowRight"); await check(1);
    await page.keyboard.press("ArrowLeft"); await check(0);
    expect(reloads).toBe(0);
    for (const [name, destination] of [[/Google reviews/i, "https://www.google.com/maps/"], [/Yelp reviews/i, "https://www.yelp.com/biz/the-upper-crust-sandwich-shoppe-riverside"]]) {
      const link = page.getByRole("link", { name });
      expect(await link.getAttribute("href")).toContain(destination);
      const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
      await popup.waitForLoadState("domcontentloaded");
      expect(popup.url()).not.toBe("about:blank");
      await popup.close();
    }
    if (width === 1440) {
      await page.mouse.move(0, 0);
      await section.getByRole("button", { name: "Resume automatic advancement", exact: true }).click();
      await expect(rail).toHaveAttribute("data-active-index", "1", { timeout: 12500 });
      await evidence("autoplay-advanced");
      await section.getByRole("button", { name: "Pause automatic advancement", exact: true }).click();
      await page.waitForTimeout(11500);
      await expect(rail).toHaveAttribute("data-active-index", "1");
      await evidence("paused-after-11-seconds");
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(section.getByRole("button", { name: "Automatic advancement disabled by reduced motion preference" })).toBeDisabled();
    await rail.focus(); await page.keyboard.press("Home"); await check(0);
    expect(await rail.locator("article").first().evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThanOrEqual(.001);
    // About-to-home client navigation must initialize the embeds on first entry.
    await page.goto(`${base}/r/upper-crust/about`);
    await page.getByRole("link", { name: "The Upper Crust Sandwich Shoppe concept home", exact: true }).click();
    const navigatedRail = page.locator('[data-review-count="14"]');
    await expect(navigatedRail.locator("blockquote")).toHaveCount(11);
    await expect(navigatedRail.locator("iframe.yelp-review")).toHaveCount(3, { timeout: 30000 });
    await expect.poll(() => page.frames().filter(f => f.url().includes("/embed/review/")).length, { timeout: 30000 }).toBe(3);
    await page.reload();
    const reloadedRail = page.locator('[data-review-count="14"]');
    await expect(reloadedRail.locator(":scope > article")).toHaveCount(14);
    await expect(reloadedRail.locator("blockquote")).toHaveCount(11);
    await expect(reloadedRail.locator("iframe.yelp-review")).toHaveCount(3, { timeout: 30000 });
    if (width === 390) expect(directVisitReadyMs).toBeGreaterThanOrEqual(4500);
    expect(errors).toEqual([]);
    await reloadedRail.locator("..").screenshot({ path: `${output}/${width}.png` });
    results.push({ width, totalCards: 14, googleCards: 11, yelpCards: 3, realProviderContent: true, iframeReloadsDuringMovement: reloads, aboutToHome: "passed", refresh: "passed", slowScriptLoad: width === 390 ? `${directVisitReadyMs}ms` : "not throttled at this width", keyboard: "passed", reducedMotion: "passed", links: "passed", autoplayPause: width === 1440 ? "passed (natural 11-second timer)" : "shared desktop check", overflow: false, providerMessageErrors: providerMessageErrors.length, applicationErrors: errors.length });
    writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results.at(-1)));
    const recording = page.video();
    await context.close();
    await recording.saveAs(`${output}/${width}-interaction.webm`);
  }
} finally { await browser.close(); }
