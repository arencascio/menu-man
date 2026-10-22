import { chromium } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [route, widths] of [["/", [320, 412, 1440]], ["/work", [320, 412, 1440]]]) {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: width === 320 ? 568 : width === 412 ? 915 : 900 } });
      await page.route("**/*", (request) => {
        const url = new URL(request.request().url());
        return url.hostname === "localhost" && !/^\/(api|r)\//.test(url.pathname) ? request.continue() : request.abort();
      });
      await page.goto(`http://localhost:3000${route}`, { waitUntil: "domcontentloaded" });
      const image = await page.locator('[data-restaurant-showcases] article img[data-nimg="fill"]').evaluate((img) => {
        const rect = img.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, cardWidth: rect.width, cardHeight: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight, naturalWidth: img.naturalWidth, renderedSrc: img.currentSrc, sizes: img.sizes, loading: img.loading };
      });
      const expectedLoading = route === "/work" ? "eager" : "lazy";
      if (image.loading !== expectedLoading) throw new Error(`${route} ${width}: expected ${expectedLoading}, got ${image.loading}`);
      if (width <= 600 && image.sizes !== "(max-width: 600px) calc(100vw - 32px), (max-width: 700px) 92vw, 420px") {
        throw new Error(`${route} ${width}: inaccurate mobile sizes ${image.sizes}`);
      }
      console.log(JSON.stringify({ route, width, ...image }));
      await page.close();
    }
  }
} finally { await browser.close(); }
