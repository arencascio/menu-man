// Local presentation QA only. Does not open restaurant, management, or payment routes.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const folder = ".playwright/v11";
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const variants = [[320, 568], [375, 667], [412, 915], [768, 1024], [1440, 900]];
const report = { layouts: [], checks: [], transfer: {}, media: [] };

async function prepare(page) {
  await page.route("**/*", (r) => ["localhost", "127.0.0.1"].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
  await page.addInitScript(() => {
    window.phoneEvents = []; window.phoneCLS = 0; window.pageCLS = 0;
    document.addEventListener("menu-man:phone-showcase", (e) => window.phoneEvents.push(e.detail));
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) {
        window.pageCLS += e.value;
        if (e.sources?.some((s) => s.node?.closest?.("[data-phone-showcase]"))) window.phoneCLS += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

async function playing(page, filename) {
  await page.waitForFunction((filename) => {
    const v = document.querySelector("video");
    return v?.currentSrc.includes(filename) && v.currentTime > .15 && !v.paused;
  }, filename, { timeout: 25000 }).catch(async (error) => {
    console.log(await page.locator("video").evaluate((v) => ({ html: v.outerHTML, paused: v.paused, readyState: v.readyState, currentTime: v.currentTime, error: v.error?.message })));
    throw error;
  });
}

async function networkMeter(page) {
  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  const requests = new Map();
  client.on("Network.requestWillBeSent", (e) => {
    if (e.request.url.endsWith(".mp4")) requests.set(e.requestId, { url: e.request.url, bodyBytes: 0, receivedEncodedBytes: 0 });
  });
  client.on("Network.responseReceived", (e) => {
    const r = requests.get(e.requestId);
    if (r) Object.assign(r, { status: e.response.status, mime: e.response.mimeType, contentRange: e.response.headers["Content-Range"], fromDiskCache: e.response.fromDiskCache, fromServiceWorker: e.response.fromServiceWorker, contentEncoding: e.response.headers["Content-Encoding"] ?? "identity" });
  });
  client.on("Network.dataReceived", (e) => {
    const r = requests.get(e.requestId);
    if (r) { r.bodyBytes += e.dataLength; r.receivedEncodedBytes += e.encodedDataLength; }
  });
  client.on("Network.loadingFinished", (e) => {
    const r = requests.get(e.requestId);
    if (r) Object.assign(r, { transferredBytes: e.encodedDataLength, finished: true });
  });
  client.on("Network.loadingFailed", (e) => {
    const r = requests.get(e.requestId);
    if (r) Object.assign(r, { aborted: true, error: e.errorText });
  });
  // Completed encoded lengths include HTTP headers. Aborted streams report observed
  // payload bytes separately; do not present their incomplete encoded counter as a total.
  return { client, requests, snapshot: () => [...requests.values()].map((r) => ({ ...r, measuredTransferredBytes: r.transferredBytes ?? null })) };
}

try {
  for (const [width, height] of variants) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "no-preference" });
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await prepare(page);
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await playing(page, "home.mp4");
    await page.waitForTimeout(650);
    const layout = await page.evaluate(({ width, height }) => {
      const rect = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, left: r.left, right: r.right }; };
      const sections = [...document.querySelectorAll("section")];
      const product = sections.find((s) => s.querySelector("h2")?.textContent.startsWith("A restaurant website"));
      const screen = document.querySelector("video").parentElement;
      const selector = document.querySelector('[aria-label="Choose a product preview"]');
      const showcase = product.querySelector('[aria-label="Restaurant website showcase"]');
      return { width, height, hero: rect(sections[0]), evidence: rect(sections[1]), process: rect(document.getElementById("how-it-works")), product: rect(product), screen: rect(screen), selector: rect(selector), overflow: document.documentElement.scrollWidth > innerWidth, showcaseCards: showcase.querySelectorAll("article").length, demoBeforeFeatures: Boolean(showcase.compareDocumentPosition(product.querySelector("[data-featurettes]")) & Node.DOCUMENT_POSITION_FOLLOWING), showcaseColumns: getComputedStyle(showcase).gridTemplateColumns };
    }, { width, height });
    assert.equal(layout.overflow, false);
    assert.ok(layout.screen.top < height - 100, "At least 100px of the screen must be in the initial fold");
    assert.ok(layout.selector.top >= layout.screen.bottom, "Selector must follow the phone");
    if (width === 1440) assert.ok(layout.hero.bottom <= height, "Desktop hero must fit in opening viewport");
    assert.equal(layout.showcaseCards, 1);
    assert.equal(layout.demoBeforeFeatures, true);
    await page.screenshot({ path: `${folder}/after-${width}.png` });
    if (width === 1440 || width === 412) {
      await page.locator("[data-phone-showcase]").screenshot({ path: `${folder}/reel-${width}.png` });
      await page.getByRole("button", { name: "Pause preview", exact: true }).click();
      await page.waitForFunction(() => document.querySelector("video").paused);
      await page.getByRole("button", { name: "Ordering", exact: true }).click();
      assert.equal(await page.locator("video").evaluate((v) => v.paused), true);
      await page.getByRole("button", { name: "Play preview", exact: true }).click();
      await playing(page, "ordering.mp4");
      assert.equal(await page.locator("video").evaluate((v) => v.muted && v.playsInline && !v.loop), true);
      const initialHeight = (await page.locator("[data-phone-showcase]").boundingBox()).height;
      // Native ended events, accelerated by seeking, must advance and then wrap.
      await page.locator("video").evaluate((v) => { v.currentTime = v.duration - .15; });
      await playing(page, "home.mp4");
      await page.locator("video").evaluate((v) => { v.currentTime = v.duration - .15; });
      await playing(page, "ordering.mp4");
      assert.equal((await page.locator("[data-phone-showcase]").boundingBox()).height, initialHeight);
      for (const name of ["Website", "Ordering", "Website"]) await page.getByRole("button", { name, exact: true }).click();
      await playing(page, "home.mp4");
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
      await page.waitForFunction(() => document.querySelector("video").paused);
      await page.locator("[data-phone-showcase]").scrollIntoViewIfNeeded();
      await playing(page, "home.mp4");
      const events = await page.evaluate(() => window.phoneEvents);
      assert.equal(events.filter((e) => e.type === "reel_advanced").length, 2);
      assert.equal(events.filter((e) => e.type === "playback_interaction").length, 2, "Automatic advancement is not engagement");
      await page.getByRole("link", { name: /Explore the restaurant demo/ }).evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
      await page.getByRole("link", { name: /Explore the restaurant demo/ }).click();
      assert.equal(await page.evaluate(() => window.phoneEvents.filter((e) => e.type === "demo_opened").length), 1);
      report.checks.push(`${width}: native auto-next + wrap, manual/rapid switching, pause/resume, offscreen, distinct hooks`);
    }
    if (width <= 768) {
      await page.evaluate(() => scrollTo(0, 0));
      const menu = page.getByRole("button", { name: "Open navigation", exact: true });
      await menu.click();
      const close = page.getByRole("button", { name: "Close navigation", exact: true });
      await close.waitFor(); assert.equal(await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "How It Works", exact: true }).evaluate((e) => e === document.activeElement), true);
      await page.locator("#marketing-navigation").evaluate((e) => Promise.all(e.getAnimations().map((a) => a.finished)));
      if (width === 320 || width === 375) await page.screenshot({ path: `${folder}/menu-${width}.png` });
      await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Shift+Tab");
      assert.equal(await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: /Build My Website/ }).evaluate((e) => e === document.activeElement), true);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.getElementById("marketing-navigation").dataset.menuState === "closed");
      assert.equal(await menu.evaluate((e) => e === document.activeElement), true);
      assert.notEqual(await page.evaluate(() => document.documentElement.style.overflow), "hidden");
      await menu.click();
      await page.getByRole("button", { name: "Close navigation backdrop" }).click({ position: { x: 3, y: height - (width <= 600 ? 64 : 72) - 3 } });
      assert.equal(await menu.getAttribute("aria-expanded"), "false");
      if (width === 375) {
        await menu.click();
        await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Free Website Review", exact: true }).click();
        await page.getByRole("dialog").waitFor();
        await page.waitForFunction(() => document.getElementById("marketing-navigation").dataset.menuState === "closed");
        assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
        assert.notEqual(await page.evaluate(() => document.documentElement.style.overflow), "hidden");
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
        assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");
      }
      report.checks.push(`${width}: mobile menu, backdrop, Escape, Tab wrap, focus restoration, scroll unlock`);
    }
    Object.assign(layout, await page.evaluate(() => ({ phoneCLS: window.phoneCLS, pageCLS: window.pageCLS })));
    assert.ok(layout.phoneCLS < .01); assert.deepEqual(errors, []);
    report.layouts.push(layout); await page.close();
  }

  // Clean cold-cache transfer run: no seeks, no inactive reel requests.
  const transfer = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  await prepare(transfer);
  const meter = await networkMeter(transfer);
  await transfer.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await playing(transfer, "home.mp4");
  for (let i = 0; i < 44 && !meter.snapshot().some((r) => r.finished); i++) await transfer.waitForTimeout(500);
  const first = meter.snapshot();
  assert.ok(first.length > 0 && first.every((r) => r.url.endsWith("home.mp4")));
  report.transfer.initial = first;
  console.log("Initial cold-cache video requests:", JSON.stringify(first));
  assert.ok(first.some((r) => r.finished), "Complete initial-reel transfer measurement");
  report.media.push(await transfer.locator("video").evaluate((v) => ({ file: "home", duration: v.duration, width: v.videoWidth, height: v.videoHeight })));
  await transfer.getByRole("button", { name: "Ordering", exact: true }).click();
  await playing(transfer, "ordering.mp4");
  for (let i = 0; i < 20 && !meter.snapshot().some((r) => r.url.endsWith("ordering.mp4") && r.finished); i++) await transfer.waitForTimeout(500);
  report.transfer.afterSelection = meter.snapshot();
  report.media.push(await transfer.locator("video").evaluate((v) => ({ file: "ordering", duration: v.duration, width: v.videoWidth, height: v.videoHeight })));
  await transfer.close();

  const reduced = await browser.newPage({ viewport: { width: 412, height: 915 }, reducedMotion: "reduce" });
  await prepare(reduced);
  const reducedRequests = []; reduced.on("request", (r) => { if (r.url().endsWith(".mp4")) reducedRequests.push(r.url()); });
  await reduced.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await reduced.getByRole("button", { name: "Ordering", exact: true }).click();
  assert.equal(await reduced.locator("video").evaluate((v) => v.hidden && v.paused), true);
  assert.equal(reducedRequests.length, 0);
  await reduced.locator("[data-phone-showcase]").screenshot({ path: `${folder}/reduced.png` });
  report.checks.push("Reduced motion: zero MP4 requests, still image, no automatic playlist");
  await reduced.close();

  const saver = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  await prepare(saver);
  await saver.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: Object.assign(new EventTarget(), { saveData: true }) }));
  const saverMeter = await networkMeter(saver);
  await saver.goto("http://localhost:3000", { waitUntil: "networkidle" });
  assert.equal(saverMeter.requests.size, 0);
  await saverMeter.client.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200 * 1024, uploadThroughput: 100 * 1024 });
  const began = Date.now();
  await saver.getByRole("button", { name: "Play preview", exact: true }).click();
  await playing(saver, "home.mp4");
  report.transfer.slowMobileFirstFrameMs = Date.now() - began;
  await saver.waitForTimeout(1000);
  await saver.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Services & Pricing", exact: true }).click();
  await saver.waitForURL("**/services");
  const count = saverMeter.requests.size;
  await saver.waitForTimeout(1200);
  assert.equal(saverMeter.requests.size, count);
  assert.equal(await saver.locator("video").count(), 0);
  report.transfer.slowAndUnmount = saverMeter.snapshot();
  report.checks.push("Data saver: zero automatic MP4 requests; explicit play at 150ms/200KiBps; no new video requests after client unmount");
  await saver.close();

  const failure = await browser.newPage({ reducedMotion: "no-preference" });
  await prepare(failure); await failure.route("**/*.mp4", (r) => r.abort());
  await failure.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await failure.getByRole("status").filter({ hasText: "Video unavailable" }).waitFor();
  assert.equal(await failure.locator("[data-phone-showcase] img").evaluate((e) => e.complete && e.naturalWidth > 0), true);
  report.checks.push("Network failure: real poster and disclosure remain visible");
  await failure.close();

  for (const name of ["home", "ordering"]) {
    const buffer = await readFile(`public/brand/previews/super-tacos-${name}.mp4`);
    const boxes = []; let offset = 0;
    while (offset + 8 <= buffer.length) { const size = buffer.readUInt32BE(offset); if (size < 8) break; boxes.push({ type: buffer.toString("ascii", offset + 4, offset + 8), offset, size }); offset += size; }
    report.media.push({ file: name, bytes: buffer.length, codec: buffer.includes(Buffer.from("avc1")) ? "H.264/AVC (avc1)" : "inspect manually", audioTrack: buffer.includes(Buffer.from("soun")), boxes, fastStart: boxes.find((b) => b.type === "moov")?.offset < boxes.find((b) => b.type === "mdat")?.offset });
  }
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
