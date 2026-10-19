import { defineConfig, devices } from "@playwright/test";
import {
  AUTHENTICATED_ROLES,
  getQaBaseUrl,
  loadQaEnv,
  readQaCredentials,
  storageStatePath,
} from "./tests/browser/staging-auth-config.mjs";

loadQaEnv();
readQaCredentials(process.env);
const qaBaseUrl = getQaBaseUrl();

const authSetupProject = "qa-auth-setup";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.authenticated.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: ".playwright/auth-report", open: "never" }]],
  outputDir: ".playwright/auth-results",
  use: {
    baseURL: qaBaseUrl,
    channel: "chrome",
    headless: true,
    // Auth setup handles credentials; avoid recording login pages or form state.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: authSetupProject,
      testMatch: "**/*.auth.setup.ts",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    ...AUTHENTICATED_ROLES.map((role) => ({
      name: `qa-${role}`,
      dependencies: [authSetupProject],
      testMatch: "**/*.authenticated.spec.ts",
      use: { ...devices["Desktop Chrome"], channel: "chrome", storageState: storageStatePath(role) },
    })),
    {
      name: "qa-anonymous",
      dependencies: [authSetupProject],
      testMatch: "**/*.authenticated.spec.ts",
      use: { ...devices["Desktop Chrome"], channel: "chrome", storageState: undefined },
    },
  ],
});
