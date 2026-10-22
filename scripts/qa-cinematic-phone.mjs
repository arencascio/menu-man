// Focused local Chrome component checks. No restaurant navigation or database access.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

await mkdir(".playwright/visual-v1", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [1440, 412, 320, 768]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "no-preference" });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/*", (route) => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.addInitScript(() => {
      window.showcaseEvents = [];
      window.showcaseShifts = [];
      document.addEventListener("menu-man:phone-showcase", (e) => window.showcaseEvents.push(e.detail));
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput && entry.sources?.some((s) => s.node?.closest?.("[data-phone-showcase]"))) window.showcaseShifts.push(entry.value);
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    const root = page.locator("[data-phone-showcase]");
    await root.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("video")?.currentTime > .3, null, { timeout: 12000 }).catch(async (error) => {
      console.log(await root.evaluate((e) => ({ motion: e.dataset.motion, videoError: e.querySelector("video")?.error?.message })));
      throw error;
    });
    const video = page.locator("video");
    const initial = await root.boundingBox();
    assert.equal(await video.evaluate((v) => v.muted && !v.loop && v.playsInline && !v.paused), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (width === 1440 || width === 412) {
      await root.screenshot({ path: `.playwright/visual-v1/phone-${width}.png` });
      assert.equal(await page.evaluate(() => window.showcaseEvents.some((e) => e.type !== "viewport_entered")), false, "Autoplay must emit no engagement events");
      await page.getByRole("button", { name: "Pause preview", exact: true }).click();
      assert.equal(await video.evaluate((v) => v.paused), true);
      await page.getByRole("button", { name: "Play preview", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector("video").paused);
      await page.getByRole("button", { name: "Ordering", exact: true }).click();
      await page.waitForFunction(() => { const v = document.querySelector("video"); return v.currentSrc.includes("ordering.mp4") && v.currentTime > .2; });
      await video.evaluate((v) => { v.currentTime = Math.min(23, v.duration - 1); });
      await page.waitForTimeout(250);
      await root.screenshot({ path: `.playwright/visual-v1/ordering-${width}.png` });
      if (width === 1440) {
        for (const time of [10, 27]) {
          await video.evaluate((v, t) => { v.currentTime = t; }, time);
          await page.waitForTimeout(200);
          await root.screenshot({ path: `.playwright/visual-v1/ordering-shot-${time}.png` });
        }
      }
      const after = await root.boundingBox();
      assert.equal(initial.height, after.height, "Reel switch must preserve component height");
      // Rapid changes must not turn interrupted play() calls into permanent failures.
      for (const name of ["Website", "Ordering", "Website"]) await page.getByRole("button", { name, exact: true }).click();
      await page.waitForFunction(() => { const v = document.querySelector("video"); return v.currentSrc.includes("home.mp4") && v.currentTime > .2; });
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
      await page.waitForFunction(() => document.querySelector("video").paused);
      await root.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => !document.querySelector("video").paused);
      // Verify the event without opening a restaurant route.
      await page.getByRole("link", { name: /Explore the restaurant demo/ }).evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
      await page.getByRole("link", { name: /Explore the restaurant demo/ }).click();
      const events = await page.evaluate(() => window.showcaseEvents);
      assert.equal(events.filter((e) => e.type === "viewport_entered").length, 2);
      assert.ok(events.some((e) => e.type === "reel_selected"));
      assert.ok(events.some((e) => e.type === "playback_interaction"));
      assert.ok(events.some((e) => e.type === "demo_opened"));
    }
    const shifts = await page.evaluate(() => window.showcaseShifts.reduce((a, b) => a + b, 0));
    assert.ok(shifts < .01, `Component layout shift ${shifts}`);
    assert.deepEqual(pageErrors, []);
    results.push({ width, componentLayoutShift: shifts, passed: true });
    await page.close();
  }
  const reduced = await browser.newPage({ reducedMotion: "reduce", viewport: { width: 412, height: 1000 } });
  const requestedVideos = [];
  reduced.on("request", (r) => { if (r.url().endsWith(".mp4")) requestedVideos.push(r.url()); });
  await reduced.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await reduced.locator("[data-phone-showcase]").scrollIntoViewIfNeeded();
  await reduced.getByRole("button", { name: "Ordering", exact: true }).click();
  assert.equal(await reduced.locator("video").evaluate((v) => v.hidden && v.paused), true);
  assert.equal(requestedVideos.length, 0, "Reduced motion must not download videos");
  await reduced.locator("[data-phone-showcase]").screenshot({ path: ".playwright/visual-v1/reduced-motion.png" });
  const failure = await browser.newPage({ reducedMotion: "no-preference" });
  await failure.route("**/*.mp4", (route) => route.abort());
  await failure.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await failure.locator("[data-phone-showcase]").scrollIntoViewIfNeeded();
  await failure.getByRole("status").filter({ hasText: "Video unavailable" }).waitFor();
  assert.equal(await failure.locator("[data-phone-showcase] img").evaluate((img) => img.complete && img.naturalWidth > 0), true);
  console.log(JSON.stringify({ results, reducedMotion: "poster only; zero video requests", failure: "poster + status", hooks: "explicit interactions only" }, null, 2));
} finally { await browser.close(); }
