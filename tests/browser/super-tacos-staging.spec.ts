import { expect, test } from "@playwright/test";

test("Super Tacos public pages render and navigation/search work", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const homeResponse = await page.goto("/r/super-tacos");
  expect(homeResponse?.status()).toBe(200);
  await expect(page.locator("body")).toContainText("Super Tacos");
  await page.screenshot({ path: testInfo.outputPath("super-tacos-home.png"), fullPage: true });

  const menuHref = "/r/super-tacos/menu";
  if (testInfo.project.name !== "desktop") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("dialog").locator(`a[href="${menuHref}"]`).click();
  } else {
    await page.locator(`a[href="${menuHref}"]`).first().click();
  }
  await expect(page).toHaveURL(new RegExp(`${menuHref.replaceAll("/", "\\/")}$`));
  await expect(page.locator("body")).toContainText("Super Tacos");
  await expect(page.getByRole("navigation", { name: "Menu categories" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("super-tacos-menu.png"), fullPage: true });

  const search = page.getByPlaceholder("Search");
  await expect(search).toBeVisible();
  await search.fill("tacos");
  await expect(search).toHaveValue("tacos");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");

  const locationResponse = await page.goto("/r/super-tacos/location");
  expect(locationResponse?.status()).toBe(200);
  await expect(page.locator("body")).toContainText("Super Tacos");

  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(overflow.document, `horizontal overflow at ${overflow.viewport}px`).toBeLessThanOrEqual(overflow.viewport);
  expect(pageErrors, "uncaught browser exceptions").toEqual([]);

  await testInfo.attach("browser-console-errors.txt", {
    body: consoleErrors.length ? consoleErrors.join("\n") : "No browser console errors.",
    contentType: "text/plain",
  });
  if (consoleErrors.length) {
    console.error(`Browser console errors (${testInfo.project.name}):\n${consoleErrors.join("\n")}`);
  }
});
