import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.UPPER_CRUST_PREVIEW_QA_URL ?? "http://localhost:3311";
const forbiddenRequests = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/^\/(?:r\/upper-crust\/reference-media|img\/(?:sandwich-shop|upper-crust)|img\/icons\/(?:google_symbol_0\.svg|yelp(?:%20| )icon\.svg|tripadvisor(?:%20| )wordmark\.svg)|img\/super-tacos\/approved\/social)/i.test(url.pathname)
      || url.pathname === "/_next/image" && /(?:sandwich-shop|upper-crust|reference-media)/i.test(url.searchParams.get("url") ?? "")
      || /googleusercontent\.com|google\.com\/maps\/embed|yelp\.com\/.*(?:review|widget)/i.test(url.href)) {
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
      assert.equal(await page.locator("iframe").count(), 0, `${width}px ${route}: third-party embeds`);
      const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
      assert.ok(widths.content <= widths.viewport + 1, `${width}px ${route}: horizontal overflow (${widths.content}px)`);
    }
  }

  assert.deepEqual(forbiddenRequests, [], "protected Preview did not request unapproved media or embeds");
  console.log(`Protected Preview browser QA passed: 20 Upper Crust route/viewport combinations at ${baseUrl}.`);
} finally {
  await browser.close();
}
