import { runSprintD1 } from "./super-tacos-sprint-d1.browser-qa.mjs";
import { runMarketingM1 } from "./marketing-m1.browser-qa.mjs";
import { runMarketingM2 } from "./marketing-m2.browser-qa.mjs";
// Local Chrome only. An isolated Next process uses synthetic credentials and
// the existing offline fixture transport; neither layer can contact Supabase.
import { chromium, expect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
const base = 'http://127.0.0.1:3107';
const sprintD1 = process.argv.includes('--sprint-d1');
const marketingM1 = process.argv.includes('--marketing-m1');
const businessHosted = process.argv.includes('--marketing-m2-gated');
const marketingM2 = businessHosted || process.argv.includes('--marketing-m2');
const output = businessHosted ? '.playwright/marketing-m2-gated' : marketingM2 ? '.playwright/marketing-m2' : marketingM1 ? '.playwright/marketing-m1' : sprintD1 ? '.playwright/sprint-d1' : '.playwright/public-showcase';
const catalog = JSON.parse(readFileSync('supabase/seeds/staging/super-tacos-demo.json','utf8'));
const originalTsconfig = readFileSync('tsconfig.json','utf8');
mkdirSync(output,{recursive:true});
const server = spawn(process.execPath, ['--import',new URL('./super-tacos-demo-offline-backend.mjs',import.meta.url).href,'node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3107'], {
  stdio: ['ignore','pipe','pipe'],
  env: { ...process.env, MENU_MAN_SPRINT_D1_QA:sprintD1?'true':'false', MENU_MAN_OFFLINE_DEMO_QA:'true', MENU_MAN_PUBLIC_SHOWCASE_QA:'true',
    NEXT_PUBLIC_SUPABASE_URL:'https://jjvongzvtnzlvwdfcnjk.supabase.co', SUPABASE_SERVICE_ROLE_KEY:'offline-only-unused-key',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'offline-only-public-key', NEXT_PUBLIC_SUPABASE_ANON_KEY:'offline-only-public-key',
    MENU_MAN_ENV:'staging', VERCEL_ENV:businessHosted?'preview':'', ...(businessHosted?{VERCEL_URL:'marketing-review.invalid'}:{}), MENU_MAN_ENABLE_PUBLIC_DEMO_PAYMENTS:'false', MENU_MAN_ENABLE_SQUARE_SANDBOX:'false',
    NEXT_PUBLIC_POSTHOG_KEY:'', NEXT_PUBLIC_GA4_MEASUREMENT_ID:'', RESEND_API_KEY:'', MENU_MAN_ORDER_EMAIL_FROM:'' },
});
let serverLog = '';
server.stdout.on('data',s=>{ serverLog += s; if(String(s).includes('Ready'))console.log('Isolated offline Next server ready.'); });
server.stderr.on('data',s=>{ serverLog += s; });
let browser, activePage;
const results=[];
try {
  let ready=false;
  for(let attempt=0;attempt<90;attempt++) {
    if(server.exitCode!==null)throw new Error('Isolated Next server exited: '+serverLog.slice(-1500));
    try { const response=await fetch(base,{signal:AbortSignal.timeout(5000)}); if(response.ok){ready=true;break;} } catch { /* Server is still starting. */ }
    await delay(1000);
  }
  if(!ready)throw new Error('Isolated server startup timed out: '+serverLog.slice(-1800));
  browser=await chromium.launch({channel:'chrome',headless:true});
  if(marketingM2) await runMarketingM2(browser,base,output,results,businessHosted);
  else if(marketingM1) await runMarketingM1(browser,base,output,results);
  else if(sprintD1) await runSprintD1(browser,base,output,results);
  else for(const width of [320,412,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    const page=await context.newPage();
    activePage=page;
    const errors=[],mutations=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(r.method()==='POST')mutations.push(new URL(r.url()).pathname);});
    const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const path of ['/work','/']) {
      await page.goto(base+path);
      const showcases=page.getByRole('region',{name:'Restaurant website showcase',exact:true});
      await expect(showcases.getByRole('heading')).toHaveCount(1);
      await expect(showcases.getByRole('link',{name:/Explore Live Demo/})).toHaveCount(0);
      await expect(showcases.getByText('Live demo coming soon')).toHaveCount(1);
      await expect(showcases.locator('img')).toHaveCount(1);
      await showcases.scrollIntoViewIfNeeded();
      await expect.poll(()=>showcases.locator('img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
      await noOverflow();
      await showcases.screenshot({path:`${output}/${path==='/work'?'work':'home'}-${width}.png`});
    }
    await page.goto(base+'/r/super-tacos');
    await expect(page.getByRole('heading',{name:'Good days. Great tacos.'})).toBeVisible();
    await noOverflow();
    await page.screenshot({path:`${output}/restaurant-home-${width}.png`});
    await page.goto(base+'/r/super-tacos/menu');
    await expect(page.getByRole('complementary',{name:'Fictional restaurant demo'})).toBeVisible();
    const cards=page.locator('button[aria-haspopup="dialog"][aria-expanded]');
    await expect(cards).toHaveCount(25);
    // Menu images mount only near the viewport. Check every approved photo
    // after scrolling its card into view, rather than counting eager requests.
    for(const card of await cards.all()) {
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('img')).toBeVisible();
      await expect.poll(()=>card.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    }
    await page.getByRole('complementary',{name:'Fictional restaurant demo'}).scrollIntoViewIfNeeded();
    await noOverflow();
    await page.screenshot({path:`${output}/menu-${width}.png`});
    await page.locator('button[aria-haspopup="dialog"]').filter({has:page.getByRole('img',{name:'Street Taco',exact:true})}).click();
    const detail=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Street Taco',exact:true})});
    await expect(detail).toBeVisible();
    const filling=catalog.modifierGroups.find(g=>g.number===5).options[0];
    const guacamole=catalog.modifierGroups.find(g=>g.number===2).options.find(o=>/guacamole/i.test(o.name));
    await detail.getByLabel(new RegExp(filling.name,'i')).check();
    await detail.getByLabel(new RegExp(guacamole.name,'i')).check();
    const total='$'+((350+filling.price+guacamole.price)/100).toFixed(2);
    const add=detail.getByRole('button',{name:/Add to Cart/});
    await expect(add).toContainText(total);
    await detail.screenshot({path:`${output}/customization-${width}.png`});
    await add.click();
    await expect(detail).toBeHidden();
    await page.getByRole('button',{name:/Cart \(1\)/}).click();
    const cart=page.getByRole('dialog',{name:'Cart',exact:true});
    await expect(cart).toContainText(total);
    await expect(cart.getByRole('button',{name:'Checkout unavailable in demo'})).toBeDisabled();
    await noOverflow();
    await cart.screenshot({path:`${output}/cart-${width}.png`});
    await page.getByRole('button',{name:'Close cart',exact:true}).click();
    await expect(cart).toBeHidden();
    await page.locator('button[aria-haspopup="dialog"]').filter({has:page.getByRole('img',{name:'Super Taco',exact:true})}).click();
    const signature=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Super Taco',exact:true})});
    await signature.getByLabel(new RegExp(filling.name,'i')).check();
    await expect(signature.getByRole('button',{name:/Add to Cart/})).toBeEnabled();
    await page.keyboard.press('Escape');
    await page.goto(base+'/r/super-tacos/checkout');
    await expect(page.getByRole('heading',{name:'Checkout is unavailable in this demo.'})).toBeVisible();
    await expect(page.getByRole('button',{name:/Payment/})).toHaveCount(0);
    await noOverflow();
    await page.screenshot({path:`${output}/checkout-disabled-${width}.png`});
    await page.goto(base+'/r/super-tacos/catering');
    await expect(page.getByRole('heading',{name:"Just a taste of what's possible."})).toBeVisible();
    await noOverflow();
    expect(mutations).toEqual([]);
    expect(errors).toEqual([]);
    const response=await context.request.post(base+'/api/restaurants/super-tacos/orders',{headers:{'idempotency-key':crypto.randomUUID()},data:{
      menuId:catalog.menuId,customer:{name:'Demo Guest',email:'guest@example.invalid',phone:'2025550142'},pickup:{mode:'asap'},tipChoice:'none',items:[{menuItemId:'20000000-0000-4000-8000-000000000201',quantity:1,modifierOptionIds:[]}],
    }});
    expect(response.status()).toBe(503);
    expect((await response.json()).error.code).toBe('ORDERING_DISABLED');
    const payment=await context.request.post(base+'/api/orders/20000000-0000-4000-8000-000000001001/payments',{data:{clientAttemptKey:crypto.randomUUID(),paymentMethodToken:'demo:square-sandbox'}});
    expect(payment.status()).toBe(401);
    expect((await payment.json()).error.code).toBe('INVALID_PAYMENT_SESSION');
    results.push({width,photos:25,customization:true,cartTotal:total,checkoutDisabled:true,orderApiStatus:response.status(),paymentApiStatus:payment.status(),uiPostRequests:mutations.length,overflow:false});
    console.log(`Chrome ${width}px showcase, customization, cart and API checks passed.`);
    await context.close();
  }
  writeFileSync(output+'/results.json',JSON.stringify(results,null,2));
} catch(error) {
  writeFileSync(output+'/server-error.log',serverLog);
  if(activePage&&!activePage.isClosed()) {
    await activePage.screenshot({path:output+'/failure.png'});
    writeFileSync(output+'/failure-dom.txt',await activePage.locator('body').innerText());
  }
  throw error;
} finally {
  await browser?.close();
  if(server.pid) {
    if(process.platform==='win32') {try{execFileSync('taskkill',['/pid',String(server.pid),'/T','/F'],{stdio:'ignore'});}catch{/* Already stopped. */}}
    else server.kill('SIGTERM');
  }
  // Next adds its generated type paths. Restore only that automatic change;
  // retain any concurrent, unrelated edits to the user's TypeScript settings.
  const current=JSON.parse(readFileSync('tsconfig.json','utf8'));
  current.include=current.include.filter(path=>!path.startsWith('.next-public-showcase-qa/'));
  if(JSON.stringify(current)===JSON.stringify(JSON.parse(originalTsconfig)))writeFileSync('tsconfig.json',originalTsconfig);
}
