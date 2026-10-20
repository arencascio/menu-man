// Run only with start-super-tacos-demo-offline.mjs. No shared staging writes.
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base='http://127.0.0.1:3000';
mkdirSync('.playwright/super-tacos-demo',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try {
 for(const width of [320,412,1440]){
  const context=await browser.newContext({viewport:{width,height:width===1440?1000:900}});
  // Only localhost traffic can leave Chrome. Server preload independently
  // blocks remote services; neither layer is an application bypass.
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const checkOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.goto(base+'/r/super-tacos');
  await expect(page.getByRole('heading',{name:'Super flavor.',exact:true})).toBeVisible();
  const cta=page.getByRole('link',{name:'Build a demo order',exact:true});
  await expect(cta).toBeVisible();await checkOverflow();
  const contained=await cta.evaluate(el=>{const c=el.getBoundingClientRect(),h=el.closest('section').getBoundingClientRect();return c.bottom<=h.bottom&&c.top>=h.top;});expect(contained).toBe(true);
  await page.screenshot({path:`.playwright/super-tacos-demo/home-${width}.png`,fullPage:true});
  await cta.click();await expect(page.getByRole('navigation',{name:'Menu categories'})).toBeVisible();
  await checkOverflow();
  await page.getByRole('button',{name:/^Carne Asada Street Taco/}).click();
  const dialog=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Carne Asada Street Taco',exact:true})});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Guacamole/).check();
  await dialog.getByLabel(/Flour tortilla/).check();
  await expect(dialog.getByRole('button',{name:/Add to Cart/})).toContainText('$5.50');
  await page.screenshot({path:`.playwright/super-tacos-demo/customization-${width}.png`,fullPage:true});
  await dialog.getByRole('button',{name:/Add to Cart/}).click();
  await expect(page.getByRole('button',{name:/Cart \(1\)/})).toBeVisible();
  if(await dialog.isVisible())await page.keyboard.press('Escape');
  await page.getByRole('button',{name:/Cart \(1\)/}).click();
  await page.getByRole('button',{name:'Continue to Checkout',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Review your order'})).toBeVisible();
  await expect(page.getByLabel(/^Name/)).toHaveValue('Demo Guest');
  await expect(page.getByLabel(/^Email/)).toHaveAttribute('readonly','');
  await checkOverflow();await page.screenshot({path:`.playwright/super-tacos-demo/checkout-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Continue to Payment',exact:true}).click();
  await expect(page).toHaveURL(/\/payment$/,{timeout:20000});
  await expect(page.getByRole('group',{name:'Demo payment',exact:true})).toBeVisible();
  await expect(page.getByRole('radio',{name:'Demo payment — no charge',exact:true})).toBeChecked();
  await expect(page.getByRole('radio',{name:'Demo payment — no charge',exact:true})).toBeDisabled();
  expect(await page.locator('iframe').count()).toBe(0);
  await checkOverflow();await page.screenshot({path:`.playwright/super-tacos-demo/payment-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Place demo order',exact:true}).click();
  await expect(page).toHaveURL(/\/confirmation$/,{timeout:20000});
  await expect(page.getByText(/No money was charged/)).toBeVisible();
  await checkOverflow();await page.screenshot({path:`.playwright/super-tacos-demo/confirmation-${width}.png`,fullPage:true});
  expect(errors).toEqual([]);
  results.push({width,home:true,customization:true,cart:true,checkout:true,lockedPayment:true,confirmation:true,overflow:false,pageErrors:errors.length});
  await context.close();
 }
 writeFileSync('.playwright/super-tacos-demo/summary.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));
}finally{await browser.close();}
