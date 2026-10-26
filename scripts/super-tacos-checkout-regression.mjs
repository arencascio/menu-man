// Run against the existing offline/public-showcase fixture server on port 3213.
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = 'http://127.0.0.1:3213';
const output = '.playwright/upper-crust';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage(), errors = [], writes = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
    await page.goto(base + '/r/super-tacos');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto(base + '/r/super-tacos/menu');
    await expect(page.getByRole('navigation', { name: 'Menu categories', exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search menu' }).fill('Mexican Coke');
    await page.getByRole('button', { name: 'Add Mexican Coke to cart', exact: true }).click();
    await page.getByRole('button', { name: /Cart \(1\)/ }).click();
    await page.getByRole('button', { name: 'Review sample order', exact: true }).click();
    await expect(page.locator('body')).toContainText('Super Tacos');
    await expect(page.getByRole('link', { name: 'Back to Menu Man' })).toHaveAttribute('href', '/');
    await expect(page.locator('body')).not.toContainText('Upper Crust');
    await page.getByRole('button', { name: 'Continue to demo payment' }).click();
    await page.getByRole('button', { name: 'Simulate payment', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'That’s a delicious-looking order.' })).toBeVisible();
    await expect(page.locator('body')).toContainText('ST-');
    await expect(page.getByRole('link', { name: 'Start another sample order' })).toHaveAttribute('href', '/r/super-tacos/menu');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]); expect(writes).toEqual([]);
    await page.screenshot({ path: `${output}/super-tacos-receipt-${width}.png`, fullPage: true });
    results.push({ width, status: 'passed', errors, writes });
    await context.close();
  }
  writeFileSync(`${output}/super-tacos-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
