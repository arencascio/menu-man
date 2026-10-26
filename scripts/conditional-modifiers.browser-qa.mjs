import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, unlinkSync, rmdirSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';

const routeDir = resolve('src/app/conditional-modifier-qa');
const routeFile = resolve(routeDir, 'page.tsx');
const base = 'http://127.0.0.1:3228';
const out = resolve('.playwright/conditional-modifiers');
if (existsSync(routeDir)) throw Error('Refusing to overwrite an existing QA route');
mkdirSync(out, { recursive: true });
mkdirSync(routeDir);
writeFileSync(routeFile, `import { notFound } from 'next/navigation';
import Fixture from '../../../tests/conditional-modifiers/Fixture';
export default function Page() {
  if (process.env.CONDITIONAL_MODIFIER_QA !== 'true' || process.env.NODE_ENV !== 'development') notFound();
  return <Fixture/>;
}`);
const log = openSync(resolve(out, 'next.log'), 'w');
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3228'], {
  cwd: process.cwd(), env: { ...process.env, CONDITIONAL_MODIFIER_QA: 'true', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', log, log], windowsHide: true,
});
let browser;
const results = [];
try {
  for (let attempt = 0; ; attempt++) {
    if (server.exitCode !== null) throw Error('QA server exited; inspect next.log');
    try { const response = await fetch(base + '/conditional-modifier-qa'); if (response.ok) break; } catch { /* startup */ }
    if (attempt > 100) throw Error('QA server startup timed out');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const width of [1440, 412, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], writes = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await context.route('**/*', (route) => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) { writes.push(request.url()); return route.abort(); }
      if (new URL(request.url()).origin !== base) return route.abort();
      return route.continue();
    });
    await page.goto(base + '/conditional-modifier-qa');
    const add = () => page.getByRole('button', { name: /Add to Cart/ });
    await expect(add()).toBeDisabled();
    await expect(page.getByRole('group', { name: /Flavor/ })).toHaveCount(0);
    await page.getByRole('radio', { name: 'Carrot Sticks Included', exact: true }).check();
    await expect(page.getByRole('group', { name: /Ranch Optional/ })).toBeVisible();
    await expect(add()).toBeEnabled();
    await page.getByRole('radio', { name: 'Add Ranch +$0.50', exact: true }).check();
    await expect(add()).toContainText('$10.50');
    await page.getByRole('radio', { name: 'Drink +$2.00', exact: true }).check();
    await expect(page.getByRole('group', { name: /Ranch Optional/ })).toHaveCount(0);
    await expect(add()).toBeDisabled();
    await expect(page.getByRole('group', { name: /Flavor Required/ })).toBeVisible();
    await page.getByRole('radio', { name: 'Cola +$1.00', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(add()).toBeEnabled();
    await expect(add()).toContainText('$13.00');
    await page.screenshot({ path: resolve(out, `required-${width}.png`), fullPage: true });
    await add().click();
    await expect(page.getByLabel('Cart subtotal cents')).toHaveText('1300');
    await page.getByRole('button', { name: 'Set saved quantity to three' }).click();
    await expect(page.getByLabel('Cart subtotal cents')).toHaveText('3900');
    await page.reload();
    await expect(page.getByLabel('Cart subtotal cents')).toHaveText('3900');
    await page.getByRole('button', { name: 'Edit saved item' }).click();
    await expect(page.getByRole('radio', { name: 'Cola +$1.00', exact: true })).toBeChecked();
    await page.getByRole('radio', { name: 'Carrot Sticks Included', exact: true }).check();
    await expect(page.getByRole('radio', { name: 'Add Ranch +$0.50', exact: true })).not.toBeChecked();
    await expect(page.getByRole('group', { name: /Flavor Required/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Update Cart/ }).click();
    await expect(page.getByLabel('Cart subtotal cents')).toHaveText('3000');
    await expect(page.getByLabel('Cart selections')).toHaveText('Carrot Sticks');
    await page.screenshot({ path: resolve(out, `edited-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]); expect(writes).toEqual([]);
    results.push({ width, passed: true, browserErrors: errors.length, writes: writes.length });
    await context.close();
  }
  writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser?.close();
  server.kill();
  closeSync(log);
  // Only remove the exact scratch route this process created; never recursively delete.
  unlinkSync(routeFile); rmdirSync(routeDir);
  // Remove only types generated for this temporary route, not the rest of Next's cache.
  for (const file of ['.next/dev/types/app/conditional-modifier-qa/page.ts', '.next/dev/types/validator.ts']) {
    if (existsSync(file)) unlinkSync(file);
  }
}
