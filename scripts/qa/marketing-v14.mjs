import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
const base = process.env.QA_BASE_URL || "http://localhost:3144";
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const routes = ["/", "/services", "/work", "/build-my-website", "/cancellation"];
const titles = ["Restaurant Website Design & Management | Menu Man", "Restaurant Website Design & Pricing | Menu Man", "Restaurant Website Demo | Menu Man", "Get a Restaurant Website | Menu Man", "Cancellation & Data Handoff | Menu Man"];
mkdirSync('.playwright/marketing-v14', {recursive:true});
try {
  if (process.env.QA_ACCESS_URL) await page.goto(process.env.QA_ACCESS_URL);
  for (const [index, route] of routes.entries()) {
    const response = await page.goto(base + route);
    assert.equal(response.status(), 200);
    assert.equal(await page.title(), titles[index]);
    const canonical = 'https://getmenuman.com' + (route === '/' ? '' : route);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonical);
    assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), canonical);
    assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), titles[index]);
    assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute('content'), 'summary');
    const entities = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.map(n => JSON.parse(n.textContent)));
    assert.equal(entities.filter(x => x['@type'] === 'Organization').length, 1);
    assert.equal(entities.filter(x => x['@type'] === 'Service').length, route === '/services' ? 1 : 0);
    if (route === '/') assert.equal(await page.locator('h1').innerText(), 'Get more customers with a better restaurant website.');
    if (['/services','/work','/build-my-website'].includes(route)) assert.equal(await page.locator('#marketing-navigation [aria-current="page"]').getAttribute('href'), route);
  }
  for (const width of [360, 390, 820, 900, 1001, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + '/');
    const toggle = page.getByRole('button', { name: 'Open navigation', exact:true });
    const mobile = await toggle.isVisible();
    if (mobile) await toggle.click();
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    assert.deepEqual((await nav.locator('a,button').allTextContents()).map(text => text.replace(/[^A-Za-z &]/g, '').replace(/ +/g, ' ').trim()), ['How We Help','Services & Pricing','See It Live','Free Website Review','Build My Website']);
    for (const control of await nav.locator('a,button').all()) {
      const rect = await control.boundingBox();
      assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width + 1, 'navigation fits ' + width);
    }
    assert.notEqual(await nav.getByRole('button', {name:'Free Website Review'}).evaluate(el=>getComputedStyle(el).borderTopStyle), 'none');
    await page.screenshot({ path: '.playwright/marketing-v14/nav-' + width + '.png' });
    await nav.getByRole('button', {name:'Free Website Review'}).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({state:'hidden'});
    if (mobile) {
      await toggle.click(); await page.keyboard.press('Escape');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    }
  }
  await page.setViewportSize({width:1440,height:900}); await page.goto(base + '/services');
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'How We Help'}).click();
  await page.waitForURL('**/#how-it-works');
  assert.ok(await page.locator('#how-it-works').isVisible());
  const robots = await context.request.get(base + '/robots.txt');
  assert.match(await robots.text(), /Sitemap: https:\/\/getmenuman.com\/sitemap.xml/);
  const sitemap = await context.request.get(base + '/sitemap.xml'); const xml=await sitemap.text();
  for(const route of routes) assert.ok(xml.includes('<loc>https://getmenuman.com'+(route==='/'?'':route)+'</loc>'));
  for(const path of ['/ops','/manage','super-tacos','localhost','.vercel.app']) assert.ok(!xml.includes(path));
  const ops = await context.request.get(base+'/ops'); assert.match(ops.headers()['x-robots-tag'] || '', /noindex/);
  assert.deepEqual(errors, []);
  console.log('PASS: 5 routes metadata/JSON-LD, 7 Chrome widths, navigation, CTA modal/Escape, legacy anchor, sitemap, robots, Operations noindex.');
} finally { await browser.close(); }
