import { access } from "node:fs/promises";
import { chromium } from "@playwright/test";
import {
  AUTHENTICATED_ROLES,
  getQaBaseUrl,
  loadQaEnv,
  roleLandingPath,
  roleSlug,
  storageStatePath,
} from "../tests/browser/staging-auth-config.mjs";
import { installStagingAuthGuard } from "../tests/browser/staging-auth-guard.mjs";

loadQaEnv();
const qaBaseUrl = getQaBaseUrl();
const role = process.argv[2];
if (!AUTHENTICATED_ROLES.includes(role)) {
  throw new Error(`Choose one of these authenticated QA roles: ${AUTHENTICATED_ROLES.join(", ")}.`);
}
const statePath = storageStatePath(role);
try { await access(statePath); }
catch {
  throw new Error(`No saved session exists for ${role}. Set QA_BASE_URL to localhost, then run npm run qa:auth -- --project=qa-${role}.`);
}

const browser = await chromium.launch({ channel: "chrome", headless: false });
try {
  const context = await browser.newContext({ storageState: statePath });
  await installStagingAuthGuard(context);
  const page = await context.newPage();
  const path = roleLandingPath(role);
  const response = await page.goto(new URL(path, qaBaseUrl).href, { waitUntil: "domcontentloaded" });
  if (response?.status() !== 200 || new URL(page.url()).pathname !== path) {
    throw new Error(`The saved ${role} session expired or no longer has access. Set QA_BASE_URL to localhost and refresh it with npm run qa:auth -- --project=qa-${role}.`);
  }
  console.log(`Opened local Staging-backed Chrome for ${role} on ${roleSlug(role)}. Close the window normally when finished.`);
  await new Promise((resolve) => browser.once("disconnected", resolve));
} finally {
  await browser.close().catch(() => {});
}
