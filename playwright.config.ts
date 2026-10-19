import { defineConfig, devices } from "@playwright/test";

const stagingUrl = "https://menu-man-git-staging-arencascio.vercel.app";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? stagingUrl;
const parsedBaseURL = new URL(baseURL);
const isLocalhost = ["localhost", "127.0.0.1"].includes(parsedBaseURL.hostname) && parsedBaseURL.protocol === "http:";
const isStaging = parsedBaseURL.hostname === "menu-man-git-staging-arencascio.vercel.app" && parsedBaseURL.protocol === "https:";

if ((!isLocalhost && !isStaging) || parsedBaseURL.pathname !== "/" || parsedBaseURL.search || parsedBaseURL.hash) {
  throw new Error("PLAYWRIGHT_BASE_URL must point to localhost or the Menu Man staging alias.");
}

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  testIgnore: ["**/*.authenticated.spec.ts", "**/*.auth.setup.ts"],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: ".playwright/html-report", open: "never" }]],
  outputDir: ".playwright/test-results",
  use: {
    baseURL,
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel: "chrome", viewport: { width: 412, height: 900 } },
    },
    {
      name: "small-mobile",
      use: { ...devices["Pixel 7"], channel: "chrome", viewport: { width: 320, height: 800 } },
    },
  ],
});
