import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const base='http://127.0.0.1:3122';
const output='.playwright/marketing-v12';
mkdirSync(output,{recursive:true});
const report={base,assetChecks:0,routes:[],viewports:[],chrome:'pending'};
const manifest=JSON.parse(readFileSync('docs/marketing-v1.2-assets.json','utf8'));
const files=new Set([...manifest.migrated.map(x=>x.destination),...manifest.providers.map(x=>x.file),'public/brand/MenuManPhone.svg','public/brand/MenuManPhoneSmol.svg']);
for(const file of files){const url=base+'/'+file.slice(7).split('/').map(encodeURIComponent).join('/');const response=await fetch(url);assert.equal(response.status,200,file);report.assetChecks++;}
for(const route of ['/','/services','/cancellation','/build-my-website']){
  const response=await fetch(base+route);assert.equal(response.status,200,route);const html=await response.text();
  if(route==='/services'){assert.ok(html.includes('href="/cancellation"'));assert.ok(html.includes('$300')&&html.includes('$99/month')&&html.includes('launch-date anniversary'));}
  if(route==='/cancellation'){assert.ok(html.includes('nonrefundable, except where required by law'));assert.ok(html.includes('no prorated refunds'));assert.ok(html.includes('within 90 days after cancellation'));assert.ok(html.includes('href="/services"'));}
  if(route==='/build-my-website')assert.ok(html.includes('$300')&&html.includes('$99/month')&&html.includes('at project start'));
  report.routes.push(route);
}
let browser;
try{browser=await chromium.launch({channel:'chrome',headless:true});report.chrome='launched';}
catch(error){report.chrome='blocked';report.chromeError=String(error);writeFileSync(output+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=2;}
if(browser){
  try{
    for(const width of [320,412,768,1440]){
      const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      await context.route('**/*',route=>{const req=route.request();if(new URL(req.url()).origin!==base||req.method()!=='GET')return route.abort();return route.continue();});
      const page=await context.newPage();const imageWarnings=[];page.on('console',message=>{if(message.text().includes('has either width or height modified'))imageWarnings.push(message.text());});
      await page.goto(base+'/services');await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);
      const cards=page.locator('[data-ordering-ecosystem] li');assert.equal(await cards.count(),6);
      await page.locator('[data-ordering-ecosystem]').scrollIntoViewIfNeeded();
      for(let i=0;i<6;i++){await cards.nth(i).scrollIntoViewIfNeeded();await cards.nth(i).locator('img').evaluate(img=>img.decode());await cards.nth(i).screenshot({path:output+'/provider-'+width+'-'+i+'.png'});}
      await page.locator('[data-ordering-ecosystem] ul').evaluate(n=>{n.scrollLeft=0;});
      const marks=await cards.evaluateAll(nodes=>nodes.map(n=>({name:n.getAttribute('aria-label'),text:n.innerText,bg:getComputedStyle(n).backgroundColor,height:n.getBoundingClientRect().height,loaded:!!n.querySelector('img')?.naturalWidth,fit:getComputedStyle(n.querySelector('img')).objectFit})));
      assert.deepEqual(marks.map(m=>m.name),['Square','Clover','Toast','DoorDash','Uber Eats','Grubhub']);assert.ok(marks.every(m=>m.loaded&&m.text===''&&m.fit==='contain'&&m.bg==='rgb(247, 243, 236)'));
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,'services overflow '+width);
      await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:output+`/services-pricing-${width}.png`});await page.getByRole('heading',{name:'Managed Restaurant Website',exact:true}).locator('..').screenshot({path:output+`/price-card-${width}.png`});
      await page.locator('[data-ordering-ecosystem]').scrollIntoViewIfNeeded();await page.screenshot({path:output+`/providers-${width}.png`});
      await page.getByRole('link',{name:'What happens if I cancel?',exact:true}).click();await page.waitForURL('**/cancellation');
      assert.equal(await page.locator('section#cancel,section#ownership-and-data,section#billing').count(),3);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'cancellation overflow '+width);
      await page.screenshot({path:output+`/cancellation-${width}.png`,fullPage:true});
      await page.getByRole('link',{name:'Back to Services & Pricing'}).click();await page.waitForURL('**/services');await page.goBack();await page.waitForURL('**/cancellation');
      await page.getByRole('link',{name:'Menu Man home',exact:true}).first().click();await page.waitForURL(base+'/');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'home overflow '+width);
      if(width<768){await page.getByRole('button',{name:'Open navigation'}).click();assert.equal(await page.locator('#marketing-navigation').isVisible(),true);}
      await page.goto(base+'/services');await page.waitForLoadState('networkidle');
      await page.getByRole('link',{name:'Cancellation & data handoff',exact:true}).click();await page.waitForURL('**/cancellation');
      await page.route('**/Square_Logo_2025_Black-fullmark.svg',route=>route.abort());await page.goto(base+'/services');
      await page.locator('[data-ordering-ecosystem]').scrollIntoViewIfNeeded();const fallback=page.locator('[data-logo-failed="true"]');await fallback.waitFor();assert.equal(await fallback.innerText(),'Square');assert.equal(await fallback.locator('img').count(),0);assert.equal(await fallback.evaluate(n=>n.getBoundingClientRect().height),marks[0].height);
      assert.deepEqual(imageWarnings,[],"intrinsic image dimension warnings");report.viewports.push({width,logos:true,backgrounds:true,noDuplicateLabels:true,noOverflow:true,cancellationNavigation:true,browserBack:true,homeNavigation:true,fallback:true});
      await context.close();
    }
    report.chrome='passed';
  }catch(error){report.chrome='failed';report.error=String(error);throw error;}
  finally{await browser.close();writeFileSync(output+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
}
