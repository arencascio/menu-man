// Focused Chrome presentation QA. Blocks APIs and restaurant/management navigation.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const directory = ".playwright/refinement";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { pages: [], motion: {}, checks: [] };
const titles = ["Websites built for smartphones", "Search a huge menu in seconds.", "Make ordering easy", "Put the important details where customers expect them."];

async function prepare(page) {
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(u.hostname) && !/^\/(api|r|manage)\//.test(u.pathname) ? route.continue() : route.abort();
  });
  await page.addInitScript(() => {
    window.refineCLS = 0;
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.refineCLS += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
}

async function waitPlaying(page, clip = "home.mp4") {
  await page.waitForFunction((clip) => { const v = document.querySelector("video"); return v?.currentSrc.includes(clip) && !v.paused && v.currentTime > .2; }, clip, { timeout: 15000 });
}

try {
  for (const route of ["/", "/work"]) for (const width of [320, 412, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width === 320 ? 568 : width === 412 ? 915 : width === 768 ? 1024 : 900 }, hasTouch: width <= 768, reducedMotion: "no-preference" });
    const errors = []; page.on("pageerror", (e) => errors.push(e.message)); await prepare(page);
    await page.goto(`http://localhost:3000${route}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready); await waitPlaying(page); await page.waitForTimeout(650);
    const name = route === "/" ? "home" : "work";
    assert.equal(await page.locator("video").count(), 1, "No featurette/background video instances");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator("main").innerText().then((text) => text.includes("\u2014")), false);
    await page.screenshot({ path: `${directory}/${name}-${width}.png` });

    const showcases = page.locator("[data-restaurant-showcases]");
    assert.equal(await showcases.locator("article").count(), 1);
    assert.equal(await showcases.locator("article h3").innerText(), "Super Tacos");
    assert.equal(await showcases.locator('article img[data-nimg="fill"]').getAttribute("src").then((s) => s.includes("carnitas-tacos.webp")), true);
    assert.equal(await showcases.getByText("BOLD FOOD. A BRAND TO MATCH.", { exact: true }).count(), 1);
    assert.equal(await showcases.locator("article").innerText().then((s) => s.toLowerCase().includes("fictional")), false);
    assert.equal(await showcases.getByText("Restaurant showcases are fictional demonstrations.", { exact: true }).count(), 1);
    assert.equal(await showcases.getByRole("link", { name: "Explore live demo", exact: true }).getAttribute("href"), "/r/super-tacos");
    await showcases.scrollIntoViewIfNeeded();
    await showcases.locator('article img[data-nimg="fill"]').evaluate((img) => img.decode());
    assert.ok(await showcases.locator('article img[data-nimg="fill"]').evaluate((img) => img.naturalWidth > 0), "Approved showcase photo decoded");
    if (width === 1440 || width === 412) await showcases.screenshot({ path: `${directory}/${name}-card-${width}.png` });

    const features = page.locator("[data-featurettes]");
    const selectors = features.getByRole("button"); assert.equal(await selectors.count(), 4);
    for (let i = 0; i < 4; i++) assert.equal(await selectors.nth(i).innerText(), titles[i]);
    await selectors.nth(2).scrollIntoViewIfNeeded();
    await selectors.nth(2).click(); await page.waitForTimeout(450);
    assert.equal(await features.locator('button[aria-expanded="true"]').count(), 1);
    assert.equal(await features.locator('[data-open="true"] p').innerText(), "Give customers a clear path to pickup, delivery, and everything else you do.");
    assert.equal(await features.locator('[data-open="true"] h3').count(), 0, "No repeated panel title");
    const image = features.locator('[data-open="true"] figure img');
    await image.scrollIntoViewIfNeeded(); await image.evaluate((img) => img.decode());
    assert.equal(await image.getAttribute("src").then((s) => s.includes("ordering.webp")), true);
    if (width <= 768) {
      const placement = await features.locator('[data-open="true"]').evaluate((panel) => ({ panelTop: panel.getBoundingClientRect().top, buttonBottom: panel.previousElementSibling.getBoundingClientRect().bottom }));
      assert.ok(Math.abs(placement.panelTop - placement.buttonBottom) < 3, "Mobile detail must open immediately below its own selector");
      await selectors.nth(2).click(); await page.waitForTimeout(450);
      assert.equal(await features.locator('button[aria-expanded="true"]').count(), 0);
      await selectors.nth(0).click();
    } else {
      const dimensions = await features.boundingBox();
      await selectors.nth(2).focus(); await page.keyboard.press("ArrowDown");
      assert.equal(await selectors.nth(3).getAttribute("aria-expanded"), "true");
      assert.equal((await features.boundingBox()).height, dimensions.height, "Desktop panel dimensions stay stable");
      await page.keyboard.press("Home");
    }
    await page.waitForTimeout(500);
    assert.equal(await features.locator('[data-open="true"] p').innerText(), "Everything is easy to use - even on a small screen.");
    await features.screenshot({ path: `${directory}/${name}-features-${width}.png` });

    if (width <= 768) {
      const menu = page.getByRole("button", { name: "Open navigation", exact: true });
      await page.evaluate(() => scrollTo(0, 0)); await menu.tap();
      const nav = page.locator("#marketing-navigation");
      await page.waitForTimeout(550);
      assert.equal(await nav.getByText("Explore the website", { exact: true }).count(), 0);
      assert.equal(await nav.getByRole("button", { name: "Close navigation", exact: true }).count(), 0);
      assert.equal(await nav.getByRole("link", { name: "How It Works", exact: true }).evaluate((e) => e === document.activeElement), true);
      await page.screenshot({ path: `${directory}/${name}-menu-open-${width}.png` });
      await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Shift+Tab");
      assert.equal(await nav.getByRole("link", { name: /Build My Website/ }).evaluate((e) => e === document.activeElement), true);
      await page.keyboard.press("Escape");
      assert.equal(await nav.getAttribute("data-menu-state"), "closing");
      assert.equal(await nav.getAttribute("inert"), "");
      if (width === 412 && route === "/") { await page.waitForTimeout(200); await page.screenshot({ path: `${directory}/menu-collapsing-412.png` }); }
      await page.waitForFunction(() => document.getElementById("marketing-navigation").dataset.menuState === "closed");
      assert.equal(await menu.evaluate((e) => e === document.activeElement), true);
      assert.notEqual(await page.evaluate(() => document.documentElement.style.overflow), "hidden");
      assert.equal(await menu.locator("img").count(), 1);
      await menu.tap(); await page.waitForTimeout(550);
      await page.getByRole("button", { name: "Close navigation backdrop" }).tap({ position: { x: 3, y: (width === 320 ? 568 : width === 412 ? 915 : 1024) - (width <= 600 ? 64 : 72) - 3 } });
      await page.waitForFunction(() => document.getElementById("marketing-navigation").dataset.menuState === "closed");
    }

    if (route === "/work" && (width === 1440 || width === 412)) {
      await page.locator("[data-phone-showcase]").scrollIntoViewIfNeeded();
      await page.getByRole("button", { name: "Ordering", exact: true }).click(); await waitPlaying(page, "ordering.mp4");
      await page.getByRole("button", { name: "Website", exact: true }).click(); await waitPlaying(page);
    }
    const footer = page.getByRole("contentinfo");
    assert.equal(await footer.locator('[data-reveal-variant="footer"]').count(), 1);
    await footer.scrollIntoViewIfNeeded(); await page.waitForTimeout(1650);
    await footer.screenshot({ path: `${directory}/${name}-footer-${width}.png` });
    assert.equal(await footer.getByRole("link", { name: "hello@getmenuman.com", exact: true }).getAttribute("href"), "mailto:hello@getmenuman.com");
    assert.deepEqual(errors, []);
    report.pages.push({ route, width, footerHeight: (await footer.boundingBox()).height, showcaseWidth: (await showcases.locator("article").boundingBox()).width, featuretteHeight: (await features.boundingBox()).height, observedCLS: await page.evaluate(() => window.refineCLS) });
    await page.close();
  }

  // Exact reading choreography, including whole-card targets and meaningful entry.
  const motion = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  await prepare(motion); await motion.goto("http://localhost:3000", { waitUntil: "networkidle" });
  const process = motion.locator('[data-reveal-variant="process"]');
  assert.equal(await process.getAttribute("data-reveal-state"), "armed");
  const timing = await process.evaluate((list) => [...list.children].map((li) => ({ tag: li.tagName, duration: getComputedStyle(li).transitionDuration, delay: getComputedStyle(li).transitionDelay, nested: li.querySelectorAll("[data-reveal-item]").length })));
  assert.deepEqual(timing.map((t) => t.tag), ["LI", "LI", "LI"]);
  assert.ok(timing.every((t) => t.duration.split(",").every((v) => parseFloat(v) === .8) && t.nested === 0));
  assert.deepEqual(timing.map((t) => parseFloat(t.delay)), [0, .4, .8]);
  await process.evaluate((list) => {
    window.processEvents = [];
    for (const kind of ["transitionstart", "transitionend"]) list.addEventListener(kind, (event) => {
      if (event.target.parentElement === list && event.propertyName === "opacity") window.processEvents.push({ kind, card: [...list.children].indexOf(event.target), time: performance.now() });
    });
    scrollBy(0, list.getBoundingClientRect().top - innerHeight + 25);
  });
  await motion.waitForTimeout(150); assert.equal(await process.getAttribute("data-reveal-state"), "armed");
  await process.evaluate((list) => scrollBy(0, list.getBoundingClientRect().top - innerHeight * .5));
  await motion.waitForTimeout(550); await motion.screenshot({ path: `${directory}/process-sequence-mid.png` });
  await motion.waitForTimeout(1250);
  const events = await motion.evaluate(() => window.processEvents);
  const starts = events.filter((e) => e.kind === "transitionstart"); const ends = events.filter((e) => e.kind === "transitionend");
  assert.equal(starts.length, 3); assert.equal(ends.length, 3);
  assert.ok(Math.abs(starts[1].time - starts[0].time - 400) < 150); assert.ok(Math.abs(starts[2].time - starts[1].time - 400) < 150);
  assert.ok(ends.every((end) => Math.abs(end.time - starts.find((start) => start.card === end.card).time - 800) < 150));
  const footerLogo = motion.locator('footer [data-reveal-variant="footer"]');
  assert.equal(await footerLogo.getAttribute("data-reveal-state"), "armed");
  await footerLogo.scrollIntoViewIfNeeded(); await motion.waitForTimeout(650);
  await motion.getByRole("contentinfo").screenshot({ path: `${directory}/footer-turn-mid.png` });
  await motion.waitForTimeout(1000);
  assert.equal(await footerLogo.locator("[data-reveal-item]").evaluate((e) => getComputedStyle(e).transform), "none");
  report.motion = { timing, events, footerDurationMs: 1500, footerTurnDegrees: -75 };
  await motion.close();

  // Reduced-motion stills and video downloads on both actual marketing routes.
  for (const route of ["/", "/work"]) {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 }, reducedMotion: "reduce" }); await prepare(page);
    const videos = []; page.on("request", (r) => { if (/\.(mp4|webm)$/.test(r.url())) videos.push(r.url()); });
    await page.goto(`http://localhost:3000${route}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Ordering", exact: true }).click();
    assert.equal(videos.length, 0); assert.equal(await page.locator("video").evaluate((v) => v.hidden && v.paused), true);
    await page.locator("[data-featurettes]").getByRole("button", { name: "Make ordering easy", exact: true }).click();
    await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
    assert.equal(await page.locator('footer [data-reveal-item]').evaluate((e) => getComputedStyle(e).transform), "none");
    await page.close();
  }

  const manifest = JSON.parse(await readFile("public/brand/previews/featurettes/sources.json", "utf8"));
  for (const frame of manifest.frames) {
    assert.equal(createHash("sha256").update(await readFile(frame.source)).digest("hex"), frame.sourceSha256);
    assert.equal(createHash("sha256").update(await readFile(`public/brand/previews/featurettes/${frame.file}`)).digest("hex"), frame.sha256);
  }
  report.checks.push("Home and Work: four shared independent featurettes with exact owner copy", "One shared hero-photo card and section disclosure", "Inline mobile/desktop keyboard selector; no extra feature videos", "Menu expansion/reverse collapse, touch, keyboard and focus", "Whole-card 800ms/400ms choreography and one-time 1500ms footer turn", "Reduced motion: no MP4 requests on either route", "Approved-frame provenance hashes verified");
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
