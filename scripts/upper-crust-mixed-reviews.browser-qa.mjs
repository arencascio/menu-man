// Run against scripts/start-upper-crust-local.mjs. Uses installed Google Chrome
// and genuine provider widgets; no database or commerce operations.
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const output = '.playwright/upper-crust-reviews';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const names = ['Bree H.', 'Diana C.', 'Michael P.'];

try {
  for (const width of (process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [1440, 412, 320])) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:3212/r/upper-crust');
    const rail = page.locator('[data-review-count="14"]');
    const section = rail.locator('xpath=ancestor::section');
    await expect(rail.locator(':scope > article')).toHaveCount(14);
    await expect(rail.locator('blockquote')).toHaveCount(11);
    await expect(rail.locator('iframe')).toHaveCount(3);
    await expect(page.locator('script[src="https://www.yelp.com/embed/widgets.js"]')).toHaveCount(1);
    await expect.poll(() => page.frames().filter(frame => frame.url().includes('/embed/review/')).length).toBe(3);
    const frames = page.frames().filter(frame => frame.url().includes('/embed/review/'));
    expect(frames.length).toBe(3);
    for (let i = 0; i < frames.length; i++) {
      await expect(frames[i].locator('body')).toContainText(names[i]);
      await expect(frames[i].getByRole('link', { name: 'Read more on Yelp' })).toBeVisible();
    }
    await rail.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    let frameReloads = 0;
    page.on('framenavigated', frame => { if (frames.includes(frame)) frameReloads++; });
    await rail.evaluate(element => {
      window.reviewIdentity = {
        slides: [...element.children],
        frames: [...element.querySelectorAll('iframe')],
        windows: [...element.querySelectorAll('iframe')].map(frame => frame.contentWindow),
        removals: 0,
      };
      new MutationObserver(mutations => {
        window.reviewIdentity.removals += mutations.reduce((total, mutation) => total + [...mutation.removedNodes].filter(node => node.nodeName === 'IFRAME' || node.querySelector?.('iframe')).length, 0);
      }).observe(element, { childList: true, subtree: true });
    });
    const next = section.getByRole('button', { name: 'Next testimonial', exact: true });
    const previous = section.getByRole('button', { name: 'Previous testimonial', exact: true });
    const active = () => rail.getAttribute('data-active-index').then(Number);
    const assertRest = async expected => {
      await expect(rail).toHaveAttribute('data-active-index', String(expected));
      const geometry = await rail.evaluate(element => {
        const box = element.getBoundingClientRect();
        const cards = [...element.children].map(child => ({ index: Number(child.dataset.reviewIndex), rect: child.getBoundingClientRect(), hidden: child.getAttribute('aria-hidden'), inert: child.inert }));
        const visible = cards.filter(card => card.rect.left >= box.left - 1 && card.rect.right <= box.right + 1 && card.rect.right > box.left && card.rect.left < box.right).sort((a,b) => a.rect.left-b.rect.left);
        return { visible: visible.map(card => ({ index: card.index, hidden: card.hidden, inert: card.inert })), count: Number(getComputedStyle(element).getPropertyValue('--review-visible')), heightFits: cards.every(card => card.rect.height <= box.height + 1), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(geometry.visible.map(card => card.index)).toEqual(Array.from({ length: width === 1440 ? 3 : 1 }, (_, i) => (expected + i) % 14));
      expect(geometry.visible.every(card => card.hidden === 'false' && !card.inert)).toBe(true);
      expect(geometry.heightFits).toBe(true);
      expect(geometry.overflow).toBe(false);
    };

    // Observe every animation frame at both circular boundaries. Any instant
    // visual-position recycling must be wholly outside the clipped viewport.
    async function watchBoundary(button, direction, label) {
      await rail.evaluate(element => {
        window.reviewMotion = [];
        const start = performance.now();
        const record = () => {
          const viewport = element.getBoundingClientRect();
          window.reviewMotion.push({ time: performance.now() - start, left: viewport.left, right: viewport.right, cards: [...element.children].map(child => { const box=child.getBoundingClientRect(); return { left: box.left, right: box.right }; }) });
          if (performance.now() - start < 650) requestAnimationFrame(record);
        };
        requestAnimationFrame(record);
      });
      await button.click();
      await page.waitForTimeout(160);
      await page.screenshot({ path: `${output}/${width}-${label}-mid.png` });
      await page.waitForTimeout(550);
      const samples = await page.evaluate(() => window.reviewMotion);
      expect(samples.length).toBeGreaterThan(8);
      let visibleJumps = 0;
      let visibleReverseSteps = 0;
      for (let s = 1; s < samples.length; s++) {
        const a = samples[s - 1], b = samples[s];
        for (let i = 0; i < a.cards.length; i++) {
          const before = a.cards[i], after = b.cards[i];
          const wasVisible = before.right > a.left + 1 && before.left < a.right - 1;
          const isVisible = after.right > b.left + 1 && after.left < b.right - 1;
          const delta = after.left - before.left;
          if ((wasVisible || isVisible) && Math.abs(delta) > (after.right - after.left) * .8) visibleJumps++;
          if ((wasVisible || isVisible) && delta * direction > 1) visibleReverseSteps++;
        }
      }
      expect(visibleJumps).toBe(0);
      expect(visibleReverseSteps).toBe(0);
      await page.screenshot({ path: `${output}/${width}-${label}-settled.png` });
      return { label, samples: samples.length, visibleJumps, visibleReverseSteps };
    }

    await assertRest(0);
    await page.screenshot({ path: `${output}/${width}-initial.png` });
    const wraps = [];
    for (let i = 1; i <= 16; i++) {
      if (i === 14) wraps.push(await watchBoundary(next, 1, 'next-wrap'));
      else { await next.click(); await page.waitForTimeout(470); }
      await assertRest(i % 14);
      if ([1, 3, 5].includes(i)) {
        const fit = await rail.locator(`:scope > [data-review-index="${i}"]`).evaluate(card => {
          const outer = card.getBoundingClientRect();
          const frame = card.querySelector('iframe').getBoundingClientRect();
          return { cardWidth: outer.width, frameWidth: frame.width, heightFits: frame.height <= outer.height + 1 };
        });
        expect(fit.frameWidth).toBeLessThanOrEqual(fit.cardWidth + 1);
        expect(fit.heightFits).toBe(true);
        await page.screenshot({path: `${output}/${width}-yelp-${i}.png`});
      }
    }
    for (let i = 1; i <= 5; i++) {
      if (i === 3) wraps.push(await watchBoundary(previous, -1, 'previous-wrap'));
      else { await previous.click(); await page.waitForTimeout(470); }
      await assertRest((2 - i + 14) % 14);
    }
    const identity = await rail.evaluate(element => ({
      slidesSame: [...element.children].every((slide, i) => slide === window.reviewIdentity.slides[i]),
      framesSame: [...element.querySelectorAll('iframe')].every((frame, i) => frame === window.reviewIdentity.frames[i] && frame.contentWindow === window.reviewIdentity.windows[i]),
      removals: window.reviewIdentity.removals,
    }));
    expect(identity).toEqual({ slidesSame: true, framesSame: true, removals: 0 });
    expect(frameReloads).toBe(0);

    await rail.focus();
    await page.keyboard.press('Home'); await page.waitForTimeout(50); await assertRest(0);
    await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(470); await assertRest(13);
    await expect(section.locator('[aria-live="polite"]')).toContainText('Review 14 of 14');
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(470); await assertRest(0);
    await page.keyboard.press('End'); await page.waitForTimeout(50); await assertRest(13);
    await page.keyboard.press('Home'); await page.waitForTimeout(50); await assertRest(0);
    await next.focus(); // Focus outside the viewport must not block resume.

    // Click original source links in both formats and check the opened target.
    const google = section.getByRole('link', { name: 'View on Google Maps' }).first();
    const googleHref = await google.getAttribute('href');
    const popupPromise = page.waitForEvent('popup');
    await google.click();
    const googlePopup = await popupPromise;
    await expect.poll(() => googlePopup.url()).not.toBe('about:blank');
    expect(googleHref).toBe('https://maps.app.goo.gl/1BYK7wbyz9az1e7A8');
    await googlePopup.close();
    await next.click(); await page.waitForTimeout(470); await assertRest(1);
    const yelpLink = frames[0].getByRole('link', { name: 'Read more on Yelp' });
    const yelpHref = await yelpLink.getAttribute('href');
    const yelpPopupPromise = page.waitForEvent('popup');
    // Playwright's iframe locator coordinates omit ancestor CSS scaling.
    // Click the actual painted link position with Chrome's native mouse input.
    const localLink = await yelpLink.evaluate(link => { const box=link.getBoundingClientRect(); return {x:box.x+box.width/2,y:box.y+box.height/2,viewportWidth:innerWidth}; });
    const iframeBox = await rail.locator('iframe').first().boundingBox();
    const scale = iframeBox.width / localLink.viewportWidth;
    await page.mouse.click(iframeBox.x + localLink.x * scale, iframeBox.y + localLink.y * scale);
    const yelpPopup = await yelpPopupPromise;
    expect(yelpHref).toContain('uFgzOfNbZyjh0QqCWNBwvQ');
    await yelpPopup.close();

    // Real wall-clock autoplay, pause, and one-click resume on the desktop.
    // The same responsive rail also gets preference/keyboard checks below.
    let autoplay = 'shared desktop timed check';
    if (width === 1440) {
      await next.focus();
      await page.mouse.move(0, 0);
      await section.getByRole('button', { name: 'Resume automatic advancement', exact: true }).click();
      for (let cycle = 1; cycle <= 3; cycle++) {
        await expect(rail).toHaveAttribute('data-active-index', String((1 + cycle) % 14), { timeout: 12500 });
      }
      await section.getByRole('button', { name: 'Pause automatic advancement', exact: true }).click();
      const pausedIndex = await active();
      await page.waitForTimeout(11500);
      expect(await active()).toBe(pausedIndex);
      await section.getByRole('button', { name: 'Resume automatic advancement', exact: true }).click();
      await expect(rail).toHaveAttribute('data-active-index', String((pausedIndex + 1) % 14), { timeout: 12500 });
      autoplay = '3 natural 11-second advances; 11.5-second pause; one-click resume advanced';
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(section.getByRole('button', { name: 'Automatic advancement disabled by reduced motion preference' })).toBeDisabled();
    await rail.focus(); await page.keyboard.press('Home'); await page.waitForTimeout(50);
    await next.click();
    await expect(rail).toHaveAttribute('data-active-index', '1');
    expect(await rail.locator(':scope > article').first().evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(.001);
    if (width === 1440) { await page.waitForTimeout(11500); expect(await active()).toBe(1); }
    await assertRest(1);
    for (let i = 0; i < frames.length; i++) await expect(frames[i].locator('body')).toContainText(names[i]);
    expect(frameReloads).toBe(0);
    expect(errors).toEqual([]);
    results.push({ width, browser: browser.version(), cards: 14, google: 11, genuineYelp: names, nextOperations: 16, previousOperations: 5, wraps, identity, frameReloads, keyboard: 'passed', links: 'passed', reducedMotion: 'passed', autoplay, overflow: false, runtimeErrors: errors });
    writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
} finally { await browser.close(); }
