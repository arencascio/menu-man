import { expect } from '@playwright/test';

export async function runSprintD1(browser, base, output, results) {
  for (const width of [320,412,768,1440]) {
    const context = await browser.newContext({viewport:{width,height:900},hasTouch:width<=768,isMobile:width<=412,reducedMotion:'no-preference'});
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [], warnings = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if(e.type()==='warning')warnings.push(e.text()); });
    const header = page.locator('[data-restaurant-header]');
    const noOverflow = async () => expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const font = async () => {
      await page.evaluate(()=>document.fonts.ready);
      const brand = header.locator('[data-wordmark-font="custom"]');
      await expect.poll(()=>brand.evaluate(el=>getComputedStyle(el).fontFamily)).toMatch(/supertacos/i);
      const family = await brand.evaluate(el=>getComputedStyle(el).fontFamily);
      expect(family.toLowerCase()).toContain('supertacos');
      await expect.poll(()=>brand.evaluate(el=>document.fonts.check(`400 20px ${getComputedStyle(el).fontFamily.split(",")[0]}`))).toBe(true);
      return family;
    };
    const navigate = async (label, path) => {
      if(width<=1100) {
        await page.getByRole('button',{name:'Open navigation',exact:true}).click();
        const nav=page.getByRole('dialog',{name:'Super Tacos navigation',exact:true});
        await expect(nav.getByRole('link',{name:'Home',exact:true})).toBeVisible();
        await nav.getByRole('link',{name:label,exact:true}).click();
      } else if(label==='Home') await header.getByRole('link',{name:'Super Tacos home',exact:true}).click();
      else await header.getByRole('link',{name:label,exact:true}).click();
      await page.waitForURL(base+path);
      await expect(page.getByRole('dialog',{name:'Super Tacos navigation',exact:true})).toBeHidden();
      await font();
    };
    await page.goto(base+'/r/super-tacos');
    await expect(page.getByRole('heading',{name:'Good days. Great tacos.'})).toBeVisible();
    const originalFont = await font();
    await expect(header).toHaveAttribute('data-shrink-scrolled','false');
    await page.screenshot({path:`${output}/home-top-${width}.png`});
    await page.evaluate(()=>window.scrollTo({top:500,behavior:'instant'}));
    await expect(header).toHaveAttribute('data-shrink-scrolled','true');
    await page.waitForTimeout(400);
    const compact = await header.boundingBox();
    if(width<=1100) {
      await page.getByRole('button',{name:'Open navigation',exact:true}).click();
      await expect(page.getByRole('dialog',{name:'Super Tacos navigation',exact:true})).toBeVisible();
      await page.waitForTimeout(250);
      await expect(header).toHaveAttribute('data-shrink-scrolled','true');
      expect(Math.abs((await header.boundingBox()).height-compact.height)).toBeLessThan(1);
      await page.screenshot({path:`${output}/scrolled-navigation-${width}.png`});
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog',{name:'Super Tacos navigation',exact:true})).toBeHidden();
      expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(450);
    }
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await expect(header).toHaveAttribute('data-shrink-scrolled','false');
    await navigate('Menu','/r/super-tacos/menu');
    await expect(page.getByRole('button',{name:/Cart \(0\)/})).toBeVisible();
    await page.evaluate(()=>window.scrollTo({top:500,behavior:'instant'}));
    await expect(header).toHaveAttribute('data-shrink-scrolled','true');
    if(width<=1100) {
      const beforeX=(await header.boundingBox()).x;
      await page.getByRole('button',{name:'Open navigation',exact:true}).click();
      const menuNavigation=page.getByRole('dialog',{name:'Super Tacos navigation',exact:true});
      await expect(header).toHaveAttribute('data-shrink-scrolled','true');
      expect((await header.boundingBox()).x).toBe(beforeX);
      await menuNavigation.getByRole('button',{name:'Close navigation',exact:true}).click();
      await expect(menuNavigation).toBeHidden();
      expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(450);
    }
    const cartBox=await page.getByRole('button',{name:/Cart \(0\)/}).boundingBox();
    const bubbleBox=await page.getByRole('complementary',{name:'Made with Menu Man',exact:true}).boundingBox();
    expect(cartBox.y+cartBox.height).toBeLessThan(bubbleBox.y);
    await noOverflow();
    await navigate('Location','/r/super-tacos/location');
    await expect(page.getByText('Super Tacos is a demonstration restaurant. Location details are illustrative.',{exact:true})).toHaveCount(1);
    const phone = page.locator('#restaurant-information').getByRole('button',{name: /951/});
    await phone.click();
    const contact = page.getByRole('dialog',{name:'Calling this restaurant',exact:true});
    await expect(contact).toBeVisible();
    await expect(contact).toContainText('start a phone call');
    await page.keyboard.press('Escape');
    await expect(contact).toBeHidden();
    await expect(phone).toBeFocused();
    const address=page.locator('#restaurant-information address button[aria-haspopup="dialog"]');
    await address.click();
    await expect(page.getByRole('dialog',{name:'Restaurant directions',exact:true})).toBeVisible();
    await page.screenshot({path:`${output}/location-contact-${width}.png`});
    await page.keyboard.press('Escape');
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    await navigate('Home','/r/super-tacos');
    expect(await font()).toBe(originalFont);
    await page.goBack(); await page.waitForURL(base+'/r/super-tacos/location'); await font();
    await page.goForward(); await page.waitForURL(base+'/r/super-tacos'); await font();
    await page.reload(); await font();
    const widget=page.getByRole('complementary',{name:'Made with Menu Man',exact:true});
    await widget.getByRole('button',{name:'Made with Menu Man',exact:true}).click();
    await expect(widget).toHaveAttribute('data-open','true');
    await expect(widget.getByRole('link',{name:'Get a Website Like This'})).toBeVisible();
    await expect(widget.getByRole('link',{name:'Contact Menu Man'})).toHaveAttribute('href','mailto:hello@getmenuman.com');
    await page.waitForTimeout(400);
    await page.screenshot({path:`${output}/menu-man-expanded-${width}.png`});
    await page.keyboard.press('Escape');
    await expect(widget).toHaveAttribute('data-open','false');
    const strip=page.getByRole('group',{name:/Food photographs/});
    await strip.scrollIntoViewIfNeeded();
    const track=strip.locator('> div');
    const offset=()=>track.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41);
    const before=await offset(); await page.waitForTimeout(600); expect(Math.abs(await offset()-before)).toBeGreaterThan(2);
    const box=await strip.boundingBox();
    await page.mouse.move(box.x+box.width*0.75,box.y+100); await page.mouse.down();
    await page.mouse.move(box.x+box.width*0.25,box.y+100,{steps:12}); await page.mouse.up();
    await page.waitForTimeout(200); expect(Math.abs(await offset()-before)).toBeGreaterThan(50);
    await page.getByRole('button',{name:'Pause photos',exact:true}).click();
    await page.waitForTimeout(100);
    const held=await offset(); await page.waitForTimeout(200); expect(Math.abs(await offset()-held)).toBeLessThan(1);
    await strip.screenshot({path:`${output}/filmstrip-${width}.png`});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.getByRole('button',{name:'Resume photos',exact:true}).click();
    await page.waitForTimeout(100); const still=await offset(); await page.waitForTimeout(300); expect(await offset()).toBeCloseTo(still,0);
    await strip.focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(50); expect(await offset()).not.toBe(still);
    await noOverflow();
    if(width<=768) {
      await page.emulateMedia({reducedMotion:'no-preference'});
      await strip.scrollIntoViewIfNeeded();
      const touch=await context.newCDPSession(page); const area=await strip.boundingBox();
      const y=area.y+80; const x=area.x+area.width*0.75;
      const touchBefore=await offset(); const pageY=await page.evaluate(()=>scrollY);
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let i=1;i<=12;i++) { await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*8,y}]}); await page.waitForTimeout(16); }
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForTimeout(60);
      expect(Math.abs(await offset()-touchBefore)).toBeGreaterThan(50);
      expect(Math.abs(await page.evaluate(()=>scrollY)-pageY)).toBeLessThan(2);
      await touch.detach();
    }
    await page.goto(base+'/r/armandos/menu');
    await expect(page.getByRole('heading',{name:'Armandos Mexican Food menu',exact:true})).toBeAttached();
    await expect(header.locator('[data-brand-lockup]')).toHaveCount(1);
    await expect(header).not.toHaveAttribute('data-shrink-on-scroll','true');
    await expect(page.getByRole('complementary',{name:'Made with Menu Man',exact:true})).toHaveCount(0);
    await expect(header.locator('[data-wordmark-font="custom"]')).toHaveCount(0);
    await expect(page.locator('footer a[href="tel:2025550111"]')).toHaveCount(2);
    await expect(page.locator('footer a[href*="maps/search"]')).toHaveCount(2);
    const armandoBefore=await header.boundingBox();
    await page.evaluate(()=>window.scrollTo({top:500,behavior:'instant'}));
    await page.waitForTimeout(250);
    expect(Math.abs((await header.boundingBox()).height-armandoBefore.height)).toBeLessThan(1);
    if(width<=1100) {
      await page.getByRole('button',{name:'Open navigation',exact:true}).click();
      const armandoNav=page.getByRole('dialog',{name:'Armandos Mexican Food navigation',exact:true});
      await expect(armandoNav.getByRole('link',{name:'Home',exact:true})).toBeVisible();
      await page.keyboard.press('Escape'); await expect(armandoNav).toBeHidden();
    }
    await noOverflow();
    await page.screenshot({path:`${output}/armando-menu-${width}.png`});
    // HEAD already omits metadataBase. Record its existing Next development
    // warning explicitly; every other console warning remains a test failure.
    const existingMetadataWarning=warnings.filter(message=>message.includes('metadataBase property in metadata export is not set'));
    expect(errors).toEqual([]);
    expect(warnings.filter(message=>!existingMetadataWarning.includes(message))).toEqual([]);
    results.push({width,scrolledNavigation:true,fontRoutesAndHistory:true,filmstripAutoDragReducedMotion:true,singleCta:true,illustrativeContacts:true,armandoNavigationFixture:true,existingMetadataWarnings:existingMetadataWarning,otherConsoleWarnings:0,overflow:false});
    console.log(`Chrome Sprint D.1 ${width}px passed.`);
    await context.close();
  }
}
