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
    const errors = [];
    const providerMessageErrors = [];
    page.on("pageerror", e => {
      // Yelp's official one-shot listener JSON.parses every window message.
      // Vercel's Preview toolbar sends objects; retain this known provider
      // diagnostic while failing on every other exception. Never patch Yelp.
      if (e.message.includes('"[object Object]" is not valid JSON') && /https:\/\/www\.yelp\.com\/embed\/widgets\.js/.test(e.stack ?? "")) providerMessageErrors.push(e.message);
      else errors.push(e.message);
    });
    await page.goto(`${base}/r/upper-crust`);
    const rail = page.locator('[data-review-count="3"]');
    const section = page.getByRole("region", { name: "Reviews", exact: true });
    const composition = section.locator("..");
    await expect(rail).toBeVisible();
    await expect(rail.locator(":scope > article")).toHaveCount(3);
    await expect(rail.locator("blockquote")).toHaveCount(0);
    await expect(rail.locator("iframe.yelp-review")).toHaveCount(3, { timeout: 30000 });
    await expect.poll(() => page.frames().filter(f => f.url().includes("/embed/review/")).length, { timeout: 30000 }).toBe(3);
    const frames = page.frames().filter(f => f.url().includes("/embed/review/"));
    expect(frames).toHaveLength(3);
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
      expect(geometry).toEqual({ count: width <= 600 ? 1 : 2, fits: true, overflow: false, identities: true });
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
    await evidence("previous-wrap-moving"); await check(2);
    await evidence("previous-wrap-settled");
    await rail.focus(); await page.keyboard.press("Home"); await check(0);
    await next.click(); await check(1);
    await previous.click(); await check(0);
    await rail.focus(); await page.keyboard.press("End"); await check(2);
    await expect(section.locator('[aria-live="polite"]')).toContainText("Review 3 of 3");
    await page.keyboard.press("Home"); await check(0);
    await page.keyboard.press("ArrowRight"); await check(1);
    await page.keyboard.press("ArrowLeft"); await check(0);
    for (const [name, destination] of [["Google Reviews", "https://www.google.com/maps/"], ["Yelp Reviews", "https://www.yelp.com/biz/the-upper-crust-sandwich-shoppe-riverside"]]) {
      const link = composition.getByRole("link", { name, exact: false });
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
    // Next client navigation must preserve initialized iframe nodes too.
    await page.getByRole("link", { name: "Menu", exact: true }).first().click();
    await expect(rail).toBeHidden();
    await page.getByRole("link", { name: "The Upper Crust Sandwich Shoppe concept home", exact: true }).click();
    await expect(rail).toBeVisible();
    await check(0);
    expect(reloads).toBe(0);
    expect(errors).toEqual([]);
    await section.screenshot({ path: `${output}/${width}.png` });
    results.push({ width, providerSlides: 3, realProviderContent: true, iframeReloads: reloads, navigation: "passed", keyboard: "passed", reducedMotion: "passed", links: "passed", autoplayPause: width === 1440 ? "passed (natural 11-second timer)" : "shared desktop check", overflow: false, providerMessageErrors: providerMessageErrors.length, applicationErrors: errors.length });
    writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results.at(-1)));
    const recording = page.video();
    await context.close();
    await recording.saveAs(`${output}/${width}-interaction.webm`);
  }
} finally { await browser.close(); }
