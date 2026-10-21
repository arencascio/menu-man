import { expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

export async function runMarketingM1(browser, base, output, results) {
  for (const width of [320, 412, 768, 1440]) {
    const context = await browser.newContext({viewport:{width,height:1000},hasTouch:width<=768,isMobile:width<=412,reducedMotion:'no-preference'});
    const page = await context.newPage();
    const errors=[], mutations=[];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => {
      const request=route.request();
      if(request.method()==='POST') { mutations.push(new URL(request.url()).pathname); return route.abort(); }
      return new URL(request.url()).origin===base ? route.continue() : route.abort();
    });
    const header=page.locator('header');
    const nav=page.getByRole('navigation',{name:'Main navigation',exact:true});
    const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const settle=async()=>{ await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(550); };
    const checkLinks=async()=>{
      const hrefs=await page.locator('a[href]').evaluateAll(links=>[...new Set(links.map(a=>a.getAttribute('href')))].filter(href=>href.startsWith('/')));
      for(const href of hrefs) {
        expect(href).not.toMatch(/^\/r\//);
        const response=await context.request.get(base+href.split('#')[0]);
        expect(response.status(),href).toBe(200);
      }
    };
    try {
      await page.goto(base+'/');
      await expect(page.getByRole('heading',{name:'Get more customers with a better restaurant website.',exact:true})).toBeVisible();
      await settle();
      const logo=header.locator('img');
      await expect(logo).toHaveAttribute('src','/brand/MenuManPhoneSmol.svg');
      expect(await logo.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
      const logoBox=await logo.boundingBox(); const headerBox=await header.boundingBox();
      expect(logoBox.height).toBeGreaterThanOrEqual(width<=820?54:62);
      expect(Math.abs(logoBox.width/logoBox.height-469.387/530.246)).toBeLessThan(0.01);
      expect(headerBox.height).toBe(width<=820?72:80);
      await page.screenshot({path:`${output}/home-hero-${width}.png`});
      await page.evaluate(()=>window.scrollTo({top:500,behavior:'instant'}));
      await expect.poll(()=>header.evaluate(el=>el.getBoundingClientRect().top)).toBe(0);
      if(width<=820) {
        const menu=header.locator('button[aria-controls="marketing-navigation"]');
        await menu.click(); await expect(menu).toHaveAttribute('aria-expanded','true');
        await expect(nav.getByRole('link',{name:'Work',exact:true})).toBeVisible();
        expect((await header.boundingBox()).height).toBe(headerBox.height);
        await page.screenshot({path:`${output}/sticky-navigation-${width}.png`});
        await page.keyboard.press('Escape'); await expect(menu).toHaveAttribute('aria-expanded','false'); await expect(menu).toBeFocused();
        expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(450);
        await menu.click();
      }
      await nav.getByRole('link',{name:'How It Works',exact:true}).click();
      const process=page.locator('#how-it-works');
      await expect.poll(()=>process.evaluate(el=>el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(headerBox.height+10);
      const processReveal=process.locator('[data-marketing-reveal]');
      await expect(processReveal).toHaveAttribute('data-reveal-state','visible');
      await settle();
      const iconDelays=await processReveal.locator('[data-reveal-item]').evaluateAll(elements=>elements.map(el=>getComputedStyle(el).transitionDelay));
      expect(new Set(iconDelays).size).toBe(3);
      await processReveal.evaluate(el=>{window.__m1Replays=[];new MutationObserver(()=>window.__m1Replays.push(el.dataset.revealState)).observe(el,{attributes:true,attributeFilter:['data-reveal-state']});});
      const processHeight=await process.evaluate(el=>el.getBoundingClientRect().height);
      await process.screenshot({path:`${output}/process-${width}.png`});
      const questions=page.locator('section').filter({has:page.getByRole('heading',{name:'Hungry customers are looking for a few simple answers.',exact:true})});
      await questions.scrollIntoViewIfNeeded(); await settle();
      await expect(questions.locator('li')).toHaveCount(5);
      for(const icon of ['utensils','dollar','moon','map','cart','smile'])await expect(questions.locator(`[data-marketing-icon="${icon}"]`)).toHaveCount(1);
      await questions.screenshot({path:`${output}/questions-${width}.png`});
      const capabilities=page.locator('details').filter({has:page.getByText('Explore this capability',{exact:true})});
      await expect(capabilities).toHaveCount(3);
      await capabilities.first().scrollIntoViewIfNeeded(); await settle();
      const summary=capabilities.first().locator('summary');
      await summary.focus(); await page.keyboard.press('Enter');
      await expect(capabilities.first()).toHaveAttribute('open','');
      await page.keyboard.press('Space'); await expect(capabilities.first()).not.toHaveAttribute('open','');
      await summary.click(); await expect(capabilities.first()).toHaveAttribute('open','');
      await page.screenshot({path:`${output}/capabilities-${width}.png`});
      const showcase=page.getByRole('region',{name:'Restaurant website showcase',exact:true});
      await expect(showcase.locator('article')).toHaveCount(1);
      await expect(showcase.getByText('Live demo coming soon')).toHaveCount(1);
      await expect(showcase.getByRole('link')).toHaveCount(0);
      const faq=page.locator('section').filter({has:page.getByRole('heading',{name:'The practical details.',exact:true})});
      const faqSummary=faq.locator('summary').first();
      await faqSummary.scrollIntoViewIfNeeded(); await faqSummary.focus(); await page.keyboard.press('Enter');
      await expect(faq.locator('details').first()).toHaveAttribute('open','');
      expect((await faqSummary.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await faq.screenshot({path:`${output}/faq-${width}.png`});
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await process.scrollIntoViewIfNeeded(); await settle();
      expect(await process.evaluate(el=>el.getBoundingClientRect().height)).toBe(processHeight);
      expect(await page.evaluate(()=>window.__m1Replays)).not.toContain('armed');
      const final=page.locator('section').filter({has:page.getByRole('heading',{name:"Let's make your website feel as welcoming as your front door.",exact:true})});
      await final.scrollIntoViewIfNeeded(); await settle();
      await expect(final.locator('[data-marketing-icon="heart"]')).toBeVisible();
      expect(await final.evaluate(el=>getComputedStyle(el.querySelector('h2').parentElement.parentElement).textAlign)).toBe('center');
      await final.screenshot({path:`${output}/final-cta-${width}.png`});
      await noOverflow(); await checkLinks();

      await page.goto(base+'/services'); await settle();
      await expect(page.getByRole('heading',{name:'A complete restaurant website, managed for you.',exact:true})).toBeVisible();
      await expect(page.getByText('$99/month',{exact:true})).toBeVisible();
      await expect(page.getByText('$299 one-time startup fee',{exact:true})).toBeVisible();
      await page.screenshot({path:`${output}/services-pricing-${width}.png`});
      await expect(page.locator('[data-marketing-icon="platter"]')).toHaveCount(1);
      await expect(page.locator('div').filter({has:page.getByText('Managed, mobile-first restaurant website',{exact:true})}).last()).toBeAttached();
      for(const text of ['Delivery app updates','Menu Man pickup ordering']) await expect(page.getByRole('heading',{name:text,exact:true})).toHaveCount(1);
      const cancellation=page.getByRole('link',{name:'What happens if I cancel?',exact:true});
      await cancellation.scrollIntoViewIfNeeded(); await expect(cancellation).toHaveAttribute('href','/cancellation');
      await expect(nav.getByText('What happens if I cancel?')).toHaveCount(0);
      await noOverflow(); await checkLinks();

      await page.goto(base+'/work'); await settle();
      await expect(page.getByRole('heading',{name:'A large menu made easier to use.',exact:true})).toHaveCount(0);
      await expect(page.getByRole('region',{name:'Restaurant website showcase',exact:true}).locator('article')).toHaveCount(1);
      const tabs=page.getByRole('tablist',{name:'Restaurant website features'});
      const mobile=tabs.getByRole('tab',{name:/Built for the phone/});
      await mobile.scrollIntoViewIfNeeded(); await mobile.focus(); await page.keyboard.press('ArrowRight');
      await expect(tabs.getByRole('tab',{name:/Search a huge menu/})).toHaveAttribute('aria-selected','true');
      await page.keyboard.press('ArrowRight');
      await expect(tabs.getByRole('tab',{name:/Make ordering obvious/})).toHaveAttribute('aria-selected','true');
      await expect(page.getByRole('tabpanel').locator('[data-marketing-icon="check"]')).toBeVisible();
      await tabs.getByRole('tab',{name:/Built for the phone/}).click();
      await expect(page.getByRole('tabpanel')).toContainText("The menu, hours, location, and ordering path stay easy to reach on a small screen.");
      const preview=page.getByRole('img',{name:'Super Tacos demonstration website on a phone-sized screen',exact:true});
      await expect(preview).toBeVisible();
      await expect.poll(()=>preview.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
      await page.screenshot({path:`${output}/work-interactions-${width}.png`});
      await noOverflow(); await checkLinks();
      await page.getByRole('button',{name:'GET MY FREE WEBSITE REVIEW',exact:true}).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);

      await page.emulateMedia({reducedMotion:'reduce'});
      await page.goto(base+'/'); await settle();
      const groups=page.locator('[data-marketing-reveal]');
      expect(await groups.evaluateAll(elements=>elements.every(el=>el.dataset.revealState!=='armed'))).toBe(true);
      const reduceStyles=await page.locator('[data-reveal-item]').evaluateAll(elements=>elements.map(el=>({opacity:getComputedStyle(el).opacity,transform:getComputedStyle(el).transform})));
      expect(reduceStyles.every(style=>style.opacity==='1'&&style.transform==='none')).toBe(true);
      await noOverflow();
      expect(mutations).toEqual([]); expect(errors).toEqual([]);
      results.push({width,logoHeight:logoBox.height,headerHeight:headerBox.height,sticky:true,anchorOffset:true,capabilities:true,faq:true,oneTimeMotion:true,reducedMotion:true,pricing:'$99/month + $299 startup',showcasesGated:true,ctaDestinations:true,workTabs:true,postRequests:mutations.length,overflow:false});
      console.log(`Chrome Marketing M.1 ${width}px passed.`);
    } catch(error) {
      await page.screenshot({path:`${output}/failure-${width}.png`});
      writeFileSync(`${output}/failure-${width}.txt`,await page.locator('body').innerText());
      throw error;
    } finally { await context.close(); }
  }
  const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:412,height:1000}});
  await noJs.route('**/*',route=>route.request().method()!=='POST'&&new URL(route.request().url()).origin===base?route.continue():route.abort());
  const page=await noJs.newPage();
  await page.goto(base+'/');
  expect(await page.locator('[data-reveal-item]').evaluateAll(elements=>elements.every(el=>getComputedStyle(el).opacity==='1'))).toBe(true);
  await noJs.close();
}
