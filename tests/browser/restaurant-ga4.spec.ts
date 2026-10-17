import { expect, test } from "./fixtures";
import { build } from "esbuild";

test("GA4 is marketing-only across restaurant loads, navigation, and withdrawal", async ({ page }) => {
  test.skip(new URL(test.info().project.use.baseURL as string).hostname !== "localhost", "Local Chrome QA only");

  const googleRequests: string[] = [];
  // Keep all third-party traffic local to the test; Google requests below are fulfilled in Chrome.
  await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(test.info().project.use.baseURL as string).origin
    ? route.continue() : route.abort());
  await page.route("**/api/analytics/eligibility", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: '{"allowed":true}',
  }));
  await page.route(/https:\/\/(?:www\.)?(?:googletagmanager|google-analytics)\.com\//, (route) => {
    googleRequests.push(new URL(route.request().url()).pathname);
    if (route.request().url().includes("/gtag/js")) {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: `
        window.gtag = function(command, name) {
          if (command === 'event' && !window['ga-disable-G-TEST'])
            fetch('https://www.google-analytics.com/g/collect?test=1').catch(() => {});
        };
        const pushState = history.pushState;
        history.pushState = function() {
          const result = pushState.apply(this, arguments);
          window.gtag('event', 'automatic_history_pageview');
          return result;
        };
        addEventListener('popstate', () => window.gtag('event', 'automatic_history_pageview'));
      ` });
    }
    return route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/r/super-tacos");
  await expect(page).toHaveURL(/\/r\/super-tacos$/);
  await expect.poll(() => page.evaluate(() => (window as unknown as Record<string, unknown>)["ga-disable-G-TEST"])).toBe(true);
  expect(googleRequests).toEqual([]);

  await page.goto("/");
  await expect.poll(() => googleRequests.includes("/gtag/js")).toBe(true);
  await page.evaluate(() => (window as typeof window & { gtag: (...args: string[]) => void }).gtag("event", "marketing_check"));
  await expect.poll(() => googleRequests.includes("/g/collect")).toBe(true);
  googleRequests.length = 0;

  await page.evaluate(() => window.history.pushState({}, "", "/r/super-tacos"));
  await expect.poll(() => page.evaluate(() => (window as unknown as Record<string, unknown>)["ga-disable-G-TEST"])).toBe(true);
  await page.evaluate(() => (window as typeof window & { gtag: (...args: string[]) => void }).gtag("event", "restaurant_check"));
  expect(googleRequests).toEqual([]);

  await page.goBack();
  await expect.poll(() => page.evaluate(() => (window as unknown as Record<string, unknown>)["ga-disable-G-TEST"])).toBe(false);
  await expect.poll(() => googleRequests.includes("/g/collect")).toBe(true);
  googleRequests.length = 0;
  await page.goForward();
  await expect.poll(() => page.evaluate(() => (window as unknown as Record<string, unknown>)["ga-disable-G-TEST"])).toBe(true);
  expect(googleRequests).toEqual([]);

  await page.goto("/r/super-tacos");
  const identityBundle = await build({
    stdin: { contents: 'import { restaurantIdentity } from "./src/lib/analytics/restaurant-identity"; window.withdrawTest = restaurantIdentity.withdraw;',
      resolveDir: process.cwd(), sourcefile: "ga4-withdraw-test.ts" },
    bundle: true, format: "iife", platform: "browser", write: false,
  });
  await page.addScriptTag({ content: identityBundle.outputFiles[0].text });
  const withdrawn = await page.evaluate(async () => {
    const withdraw = (window as typeof window & { withdrawTest: typeof import("../../src/lib/analytics/restaurant-identity").restaurantIdentity.withdraw }).withdrawTest;
    return withdraw("development", "tenant-a", () => true);
  });
  expect(withdrawn).toBe(true);
  await page.reload();
  expect(googleRequests).toEqual([]);
});

test("denied eligibility loads no GA4 on marketing or restaurant routes", async ({ page }) => {
  test.skip(new URL(test.info().project.use.baseURL as string).hostname !== "localhost", "Local Chrome QA only");
  const googleRequests: string[] = [];
  await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(test.info().project.use.baseURL as string).origin
    ? route.continue() : route.abort());
  await page.route("**/api/analytics/eligibility", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: '{"allowed":false}',
  }));
  await page.route(/https:\/\/(?:www\.)?(?:googletagmanager|google-analytics)\.com\//, (route) => {
    googleRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 204, body: "" });
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.goto("/r/super-tacos");
  expect(googleRequests).toEqual([]);
});
