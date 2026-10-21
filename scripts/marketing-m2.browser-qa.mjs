import { expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

export async function runMarketingM2(browser, base, output, results, hostedGate=false) {
  if(hostedGate) {
    const context=await browser.newContext({viewport:{width:412,height:1000}});
    await context.route('**/*',route=>route.request().method()!=='POST'&&new URL(route.request().url()).origin===base?route.continue():route.abort());
    const page=await context.newPage();
    for(const path of ['/cancellation','/about','/cancellation?review=true','/about?preview=1']) {
      const response=await page.goto(base+path);
      expect(response.status(),path).toBe(404);
      await expect(page.getByRole('heading',{name:'What happens if I cancel?',exact:true})).toHaveCount(0);
      await expect(page.getByRole('heading',{name:'The person behind Menu Man.',exact:true})).toHaveCount(0);
      expect(await page.locator('body').innerText()).not.toContain('two-week');
    }
    await page.goto(base+'/services');
    await expect(page.getByRole('button',{name:'What happens if I cancel?',exact:true})).toBeDisabled();
    await expect(page.locator('a[href="/cancellation"], a[href="/about"]')).toHaveCount(0);
    await page.screenshot({path:`${output}/hosted-gate-closed.png`});
    results.push({hostedEnvironment:'simulated Preview in an isolated local server',directRoutes404:true,queryBypassDenied:true,footerLinksHidden:true,servicesCtaDisabled:true});
    await context.close();
    console.log('Local hosted-environment simulation: M.2 route and link gates passed.');
    return;
  }
  for(const width of [320,412,768,1440]) {
    const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<=768,isMobile:width<=412,reducedMotion:'reduce'});
    const errors=[],mutations=[];
    await context.route('**/*',route=>{
      const request=route.request();
      if(request.method()==='POST'){mutations.push(request.url());return route.abort();}
      return new URL(request.url()).origin===base?route.continue():route.abort();
    });
    const page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
    const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const localLinks=async()=>{
      const paths=await page.locator('a[href]').evaluateAll(links=>[...new Set(links.map(link=>link.getAttribute('href')))].filter(path=>path.startsWith('/')));
      for(const path of paths)expect((await context.request.get(base+path.split('#')[0])).status(),path).toBe(200);
    };
    try {
      await page.goto(base+'/services');
      const cta=page.getByRole('link',{name:'What happens if I cancel?',exact:true});
      await expect(cta).toHaveAttribute('href','/cancellation');
      await cta.click(); await page.waitForURL(base+'/cancellation');
      await expect(page.getByRole('heading',{name:'What happens if I cancel?',exact:true})).toBeVisible();
      await expect(page.getByRole('complementary',{name:'Publication review status'})).toContainText('publication pending');
      await expect.poll(()=>page.locator('meta[name="robots"]').evaluateAll(tags=>tags.length>0&&tags.every(tag=>/noindex.*nofollow/.test(tag.getAttribute('content')??'')))).toBe(true);
      await expect(page.locator('main section')).toHaveCount(6);
      await page.evaluate(()=>document.fonts.ready);
      await noOverflow(); await page.screenshot({path:`${output}/cancellation-top-${width}.png`});
      await page.locator('#export').scrollIntoViewIfNeeded();
      await expect(page.locator('#export')).toContainText('within two weeks after cancellation');
      await expect(page.locator('#export')).toContainText('no additional fee');
      await expect(page.locator('main')).not.toContainText(/nonpayment|suspension/i);
      await page.screenshot({path:`${output}/export-policy-${width}.png`});
      await expect(page.locator('#retention')).toContainText('does not set a deletion deadline');
      await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
      await localLinks();
      const footer=page.getByRole('navigation',{name:'Footer navigation'});
      await footer.getByRole('link',{name:'About Menu Man',exact:true}).click();
      await page.waitForURL(base+'/about');
      await expect(page.getByRole('heading',{name:'The person behind Menu Man.',exact:true})).toBeVisible();
      await expect(page.getByRole('complementary',{name:'Publication review status'})).toContainText('owner review required');
      await expect(page.getByRole('img',{name:'Placeholder for an owner-supplied founder headshot'})).toBeVisible();
      await expect(page.locator('a[href*="linkedin"]')).toHaveCount(0);
      await expect(page.getByText('LinkedIn profile — owner URL needed',{exact:true})).toHaveAttribute('aria-disabled','true');
      await expect(page.getByRole('link',{name:'Email the person behind Menu Man'})).toHaveAttribute('href','mailto:hello@getmenuman.com');
      await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
      await expect(page.getByRole('navigation',{name:'Main navigation'}).locator('a[href="/about"], a[href="/cancellation"]')).toHaveCount(0);
      await page.evaluate(()=>document.fonts.ready);
      await noOverflow(); await page.screenshot({path:`${output}/about-${width}.png`});
      await localLinks();
      await page.goto(base+'/build-my-website');
      await expect(page.getByText('$99/month',{exact:true})).toBeVisible();
      await expect(page.getByText('Plus a $299 one-time startup fee',{exact:true})).toBeVisible();
      await noOverflow();
      const sitemap=await (await context.request.get(base+'/sitemap.xml')).text();
      expect(sitemap).not.toContain('/cancellation'); expect(sitemap).not.toContain('/about');
      expect(errors).toEqual([]); expect(mutations).toEqual([]);
      results.push({width,cancellationLocalLink:true,approvedWorkingPolicy:true,publicationPending:true,exportNotDeletion:true,aboutPlaceholders:true,contact:'hello@getmenuman.com',pricing:'$99/month + $299 startup',linksPass:true,noIndex:true,noOverflow:true,postRequests:0});
      console.log(`Chrome Marketing M.2 ${width}px passed.`);
    } catch(error) {
      await page.screenshot({path:`${output}/failure-${width}.png`});
      writeFileSync(`${output}/failure-${width}.txt`,await page.locator('body').innerText());
      throw error;
    } finally {await context.close();}
  }
}
