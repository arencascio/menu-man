import { expect, test as base } from "@playwright/test";

const stagingUrl = "https://menu-man-git-staging-arencascio.vercel.app";
const applicationOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? stagingUrl).origin;

function isAllowedNavigation(url: URL) {
  if (url.origin === applicationOrigin) return true;
  if (url.hostname === "accounts.google.com" || url.hostname === "github.com") return true;
  return url.hostname === "vercel.com" || url.hostname.endsWith(".vercel.com");
}

export const test = base.extend({
  context: async ({ context }, runFixture) => {
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (!request.isNavigationRequest() || isAllowedNavigation(new URL(request.url()))) {
        await route.continue();
        return;
      }
      await route.abort("blockedbyclient");
    });
    await runFixture(context);
  },
});

export { expect };
