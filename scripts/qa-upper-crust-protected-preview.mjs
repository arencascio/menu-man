import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.UPPER_CRUST_PREVIEW_QA_URL ?? "http://localhost:3311";
const forbiddenRequests = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  page.on("request", (request) => {
    const url = new URL(request.url());
    const aboutMap = new URL(page.url()).pathname === "/r/upper-crust/about" && /google\.com\/maps\/embed/i.test(url.href);
    if (/^\/(?:r\/upper-crust\/reference-media|img\/(?:sandwich-shop|upper-crust)|img\/icons\/(?:google_symbol_0\.svg|yelp(?:%20| )icon\.svg|tripadvisor(?:%20| )wordmark\.svg)|img\/super-tacos\/approved\/social)/i.test(url.pathname)
      || url.pathname === "/_next/image" && /(?:sandwich-shop|upper-crust|reference-media)/i.test(url.searchParams.get("url") ?? "")
      || /googleusercontent\.com|yelp\.com\/.*(?:review|widget)/i.test(url.href)
      || /google\.com\/maps\/embed/i.test(url.href) && !aboutMap) {
      forbiddenRequests.push(url.href);
    }
  });
  page.on("pageerror", (error) => { throw error; });

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/r/upper-crust", "/r/upper-crust/menu", "/r/upper-crust/about", "/r/upper-crust/catering", "/r/upper-crust/checkout"]) {
      const response = await page.goto(new URL(route, baseUrl).href, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200, `${width}px ${route}`);
      assert.equal(await page.locator("[data-protected-preview='true']").count(), 1, `${width}px ${route}: preview rendering`);
      assert.equal(await page.locator("iframe").count(), route === "/r/upper-crust/about" ? 1 : 0, `${width}px ${route}: expected map embed only on About`);
      if (route === "/r/upper-crust") {
        await assert.doesNotReject(() => page.getByRole("heading", { name: "Reviews", exact: true }).waitFor());
        await assert.doesNotReject(() => page.getByRole("link", { name: "Google Reviews" }).waitFor());
        await assert.doesNotReject(() => page.getByRole("link", { name: "Yelp Reviews" }).waitFor());
      }
      if (route === "/r/upper-crust/about") {
        await assert.doesNotReject(() => page.getByTitle("Map showing The Upper Crust Sandwich Shoppe in Riverside").waitFor());
        await assert.doesNotReject(() => page.getByRole("link", { name: "Open directions in Google Maps" }).waitFor());
        for (const label of ["Google Reviews", "Yelp Reviews", "Facebook", "Instagram"]) {
          await assert.doesNotReject(() => page.getByRole("link", { name: label, exact: true }).first().waitFor());
        }
      }
      if (route === "/r/upper-crust/catering") {
        await assert.doesNotReject(() => page.getByText("Contact the restaurant for current options, quantities, prices, minimums, lead times and policies.", { exact: true }).waitFor());
        await assert.doesNotReject(() => page.getByRole("link", { name: "Call the Restaurant", exact: true }).waitFor());
        await assert.doesNotReject(() => page.getByText("Monday–Saturday", { exact: false }).waitFor());
        await assert.doesNotReject(() => page.getByText("11 AM–4 PM", { exact: true }).waitFor());
      }
      const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
      assert.ok(widths.content <= widths.viewport + 1, `${width}px ${route}: horizontal overflow (${widths.content}px)`);
    }
  }

  const approvedMedia = await page.request.get(new URL("/r/upper-crust/media/blt.jpg", baseUrl).href);
  assert.equal(approvedMedia.status(), 200, "approved protected media route");
  assert.match(approvedMedia.headers()["cache-control"] ?? "", /private, no-store/);
  assert.match(approvedMedia.headers()["x-robots-tag"] ?? "", /noindex/);
  assert.equal((await page.request.get(new URL("/r/upper-crust/media/not-approved.jpg", baseUrl).href)).status(), 404);

  assert.deepEqual(forbiddenRequests, [], "protected Preview did not request unapproved media or embeds");
  console.log(`Protected Preview browser QA passed: 20 Upper Crust route/viewport combinations at ${baseUrl}.`);
} finally {
  await browser.close();
}
