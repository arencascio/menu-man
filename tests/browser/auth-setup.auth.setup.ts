import assert from "node:assert/strict";
import { chmod, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test } from "@playwright/test";
import {
  AUTHENTICATED_ROLES,
  getQaBaseUrl,
  readQaCredentials,
  roleLandingPath,
  roleSlug,
  storageStatePath,
} from "./staging-auth-config.mjs";
import { installStagingAuthGuard } from "./staging-auth-guard.mjs";

async function roleSessionIsUsable(context: import("@playwright/test").BrowserContext, role: string) {
  const page = context.pages()[0] ?? await context.newPage();
  const path = roleLandingPath(role);
  const response = await page.goto(new URL(path, getQaBaseUrl()).href, { waitUntil: "domcontentloaded" });
  return response?.status() === 200 && new URL(page.url()).pathname === path;
}

async function assertLocalStagingTarget(browser: import("@playwright/test").Browser) {
  const context = await browser.newContext();
  try {
    await installStagingAuthGuard(context);
    const page = context.pages()[0] ?? await context.newPage();
    const diagnosticsResponse = await page.goto(new URL("/diagnostics", getQaBaseUrl()).href, { waitUntil: "domcontentloaded" });
    assert.equal(diagnosticsResponse?.status(), 200, "Local QA app diagnostics must be reachable before authentication.");
    const diagnosticValues = await page.locator("dl div").evaluateAll((rows) => Object.fromEntries(rows.map((row) => [
      row.querySelector("dt")?.textContent?.trim() ?? "",
      row.querySelector("dd")?.textContent?.trim() ?? "",
    ])));
    assert.equal(diagnosticValues.Environment, "Local", "Authenticated QA must use the local application.");
    assert.equal(diagnosticValues["Supabase project"], "jjvongzvtnzlvwdfcnjk", "Local app must point to Menu Man Staging.");
  } finally {
    await context.close();
  }
}

async function saveRoleState(context: import("@playwright/test").BrowserContext, role: string) {
  const statePath = storageStatePath(role);
  assert.ok(statePath);
  await mkdir(dirname(statePath), { recursive: true, mode: 0o700 });
  await context.storageState({ path: statePath, indexedDB: true });
  if (process.platform !== "win32") await chmod(statePath, 0o600);
}

test("refresh reusable staging sessions for the configured QA roles", async ({ browser }) => {
  const credentials = readQaCredentials(process.env);
  await assertLocalStagingTarget(browser);

  for (const role of AUTHENTICATED_ROLES) {
    const statePath = storageStatePath(role);
    assert.ok(statePath);
    let context: import("@playwright/test").BrowserContext | undefined;
    try {
      context = await browser.newContext({ storageState: statePath });
      await installStagingAuthGuard(context);
      if (await roleSessionIsUsable(context, role)) {
        console.log(`Reused authenticated QA session for role: ${role}`);
        await saveRoleState(context, role);
        await context.close();
        continue;
      }
      await context.close();
      context = undefined;
    } catch {
      await context?.close();
      context = undefined;
    }

    context = await browser.newContext();
    await installStagingAuthGuard(context);
    const page = context.pages()[0] ?? await context.newPage();
    const path = roleLandingPath(role);
    const loginUrl = new URL("/manage/login", getQaBaseUrl());
    loginUrl.searchParams.set("next", path);
    await page.goto(loginUrl.href, { waitUntil: "domcontentloaded" });
    const emailInput = page.getByLabel("Email");
    const passwordInput = page.getByLabel("Password");
    await emailInput.fill(credentials[role].email);
    await passwordInput.fill(credentials[role].password);
    await page.getByRole("button", { name: "Sign in" }).click();
    try {
      await expect.poll(() => new URL(page.url()).pathname, {
        timeout: 30_000,
        message: `Staging sign-in for QA role ${role} did not reach its authorized route.`,
      }).toBe(path);
    } catch {
      // Playwright's failure context includes form values. Clear both inputs so
      // an invalid credential can never be copied into QA artifacts.
      await passwordInput.fill("").catch(() => {});
      await emailInput.fill("").catch(() => {});
      throw new Error(`Staging sign-in failed for QA role ${role}; verify that account's configured credentials.`);
    }
    const response = await page.goto(new URL(path, getQaBaseUrl()).href, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, `The ${role} session could not open its configured staging tenant route.`);
    assert.equal(new URL(page.url()).pathname, path, `The ${role} session did not resolve to its configured staging tenant.`);
    assert.ok(new URL(page.url()).pathname.includes(roleSlug(role)));
    await saveRoleState(context, role);
    await context.close();
  }
});
