// Run against a local staging-backed server and an isolated Chrome profile:
// node scripts/cart-sheet.browser-qa.mjs
// Chrome must expose its DevTools endpoint on port 9223. No orders are submitted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = 'http://localhost:3100';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  assert.ok((await (await fetch(base + '/diagnostics')).text()).includes('jjvongzvtnzlvwdfcnjk'), 'QA requires Menu Man staging');
  for (const name of ['square-pen', 'trash', 'check']) assert.equal((await fetch(base + '/img/icons/' + name + '.svg')).status, 200, name + ' icon is served');
  const page = (await (await fetch('http://localhost:9223/json')).json()).find(p => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => ws.onopen = resolve);
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(m.error); else p.resolve(m.result); } };
  const call = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, {resolve, reject}); ws.send(JSON.stringify({id:i, method, params})); });
  const run = async expression => { const r = await call('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true}); if (r.exceptionDetails) throw r.exceptionDetails; return r.result.value; };
  const click = async expression => { assert.equal(await run(`(()=>{const e=${expression};if(!e||e.disabled)return false;e.click();return true})()`), true, expression); await pause(300); };
  const shot = async name => { fs.mkdirSync('node_modules/.cache', {recursive:true}); fs.writeFileSync('node_modules/.cache/cart-sheet-' + name + '.png', Buffer.from((await call('Page.captureScreenshot')).data, 'base64')); };
  const cartButton = '[...document.querySelectorAll("button")].find(e=>e.textContent.trim().startsWith("Cart ("))';
  const row = index => `[...document.querySelectorAll('aside[aria-label="Your cart"] article')][${index}]`;
  const rows = () => run(`(()=>{const p=document.querySelector('aside[aria-label="Your cart"]');return [...p.querySelectorAll('article')].map(e=>({name:e.querySelector('h3').textContent,quantity:Number(e.querySelector('input[aria-label=Quantity]').value),notes:e.querySelector('[class*=cartInstructions]')?.textContent||'',total:e.querySelector('strong').textContent}))})()`);
  const setInput = async (selector, value, textarea=false) => { await run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${textarea?'HTMLTextAreaElement':'HTMLInputElement'}.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`); await pause(350); };
  const swipe = async (index, dx, dy=0) => {
    const point = await run(`(()=>{const e=${row(index)},r=e.querySelector('h3').getBoundingClientRect();return {x:Math.min(innerWidth-85,Math.max(90,r.x+35)),y:r.y+8}})()`);
    await call('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[point]});
    for(let i=1;i<=5;i++){await call('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:point.x+dx*i/5,y:point.y+dy*i/5}]});await pause(35);}
    await call('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]}); await pause(250);
  };
  const escape = async () => { await call('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent', {type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(350); };
  const tab = async (shift = false) => { await call('Input.dispatchKeyEvent', {type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:shift?8:0});await call('Input.dispatchKeyEvent', {type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:shift?8:0}); };
  const tap = async expression => {
    const p = await run(`(()=>{const e=${expression},r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:document.elementFromPoint(x,y)?.closest('button')===e}})()`);
    assert.equal(p.hit, true, 'Action receives actual touch');
    await call('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await call('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});await pause(350);
  };
  const menuState = () => run(`(()=>{const n=document.querySelector('nav[aria-label="Menu categories"]');return {y:scrollY,search:document.querySelector('input[type=search]').value,categoryLeft:n.scrollLeft,active:n.querySelector('[aria-pressed=true]')?.textContent||''}})()`);
  await call('Page.enable');
  for (const width of [412,320,1440]) {
    const mobile = width < 761;
    await call('Emulation.setDeviceMetricsOverride', {width,height:915,deviceScaleFactor:1,mobile});
    await call('Emulation.setTouchEmulationEnabled', {enabled:mobile});
    await call('Page.navigate', {url:base+'/r/armandos/menu'}); await pause(1800);
    await run('localStorage.clear();sessionStorage.clear()');await call('Page.reload');await pause(1800);
    for (const name of ['Carne Asada Fries','Carne Asada Fries','Carne Asada Fries','Super Nachos','California Burrito','Caldo de Camarón','Adobada Burrito','Asada Burrito with Cheese','Asada Burrito with Cheese and Sour Cream']) {
      await click(`document.querySelector('button[aria-label=${JSON.stringify('Add '+name+' to cart')}]')`);
      assert.equal(await run('Boolean(document.querySelector("dialog[open]"))'),false);
    }
    await setInput('input[type=search]', 'burrito');await pause(350);
    await run('window.scrollTo({top:1200,behavior:"instant"})');await pause(350);
    await run('(()=>{const n=document.querySelector(`nav[aria-label="Menu categories"]`);n.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));n.scrollLeft=200})()');await pause(250);
    const before = await menuState();await click(cartButton);
    let result = await rows();assert.equal(result.length,7);assert.equal(result[0].quantity,3);assert.equal(result[0].total,'$56.97');
    if (mobile) {
      const sheet = await run(`(()=>{const d=document.querySelector('dialog[aria-label=Cart]'),p=d.querySelector('aside'),l=p.querySelector('[class*=cartLines]'),h=p.querySelector('[class*=cartHeader]'),f=p.querySelector('[class*=cartFooter]');const cards=[...l.querySelectorAll('article')];return {modal:d.matches(':modal'),height:d.getBoundingClientRect().height,listHeight:l.clientHeight,scrollHeight:l.scrollHeight,rows:cards.map(e=>e.getBoundingClientRect().height),thumbnail:cards[0].querySelector('[class*=cartThumbnail]').getBoundingClientRect().width,stepper:cards[0].querySelector('button[aria-label="Increase quantity"]').getBoundingClientRect().height,headerY:h.getBoundingClientRect().y,footerY:f.getBoundingClientRect().y,controlsDisplay:getComputedStyle(document.querySelector('input[type=search]').closest('[class*=controls]')).display,locked:document.body.style.position,focus:document.activeElement.getAttribute('aria-label'),overflow:d.scrollWidth>d.clientWidth}})()`);
      assert.equal(sheet.modal,true);assert.ok(sheet.height<=915*.92);assert.equal(sheet.locked,'fixed');assert.equal(sheet.controlsDisplay,'grid');assert.equal(sheet.focus,'Close cart');assert.equal(sheet.overflow,false);assert.ok(sheet.rows.filter(h=>h<150).length>=4);assert.ok(sheet.thumbnail>=48&&sheet.thumbnail<=64);assert.equal(sheet.stepper,36);
      console.log('PASS',width,'sheet, consolidated rows, density, thumbnail, stepper, focus',JSON.stringify(sheet));await shot(width+'-rows');
      // Covered controls cannot take focus through the native modal.
      assert.equal(await run(`(()=>{${cartButton}.focus();return document.activeElement.getAttribute('aria-label')})()`),'Close cart');
      await run('document.querySelector("aside [class*=checkoutButton]").focus()');await tab();assert.equal(await run('document.activeElement.getAttribute("aria-label")'),'Close cart');await tab(true);assert.equal(await run('document.activeElement.textContent'),'Continue to Checkout');
      await click(`${row(0)}.querySelector('button[aria-label="Increase quantity"]')`);assert.equal((await rows())[0].quantity,4);
      await click(`${row(0)}.querySelector('button[aria-label="Decrease quantity"]')`);assert.equal((await rows())[0].quantity,3);
      await swipe(0,-85);assert.equal(await run(`${row(0)}.dataset.revealed`),'remove');assert.equal((await rows()).length,7);await shot(width+'-swipe-delete');
      await swipe(1,85);assert.equal(await run(`${row(1)}.dataset.revealed`),'edit');assert.equal(await run('document.querySelectorAll("article[data-revealed]").length'),1);
      await swipe(2,4,-100);assert.equal(await run('document.querySelectorAll("article[data-revealed]").length'),0);
      assert.ok(await run('document.querySelector("aside [class*=cartLines]").scrollTop')>0,'Vertical touch scroll remains natural');
      const pinned=await run('(()=>{const p=document.querySelector("aside[aria-label=\\"Your cart\\"]");return {headerY:p.querySelector("[class*=cartHeader]").getBoundingClientRect().y,footerY:p.querySelector("[class*=cartFooter]").getBoundingClientRect().y}})()');assert.equal(pinned.headerY,sheet.headerY);assert.equal(pinned.footerY,sheet.footerY);
      await run('document.querySelector("aside [class*=cartLines]").scrollTop=0');await pause(200);
      await swipe(0,85);await tap(`${row(0)}.querySelector('[data-cart-swipe-action]:not(:disabled)')`);
      assert.equal(await run('document.querySelectorAll("dialog[open]").length'),2);
      await setInput('dialog[open][aria-label^="Item details"] textarea','no cheese',true);
      await click('document.querySelector(`dialog[aria-label^="Item details"] button[type=submit]`)');await pause(400);
      assert.equal((await rows())[0].notes,'no cheese');assert.equal((await rows())[0].quantity,3);assert.equal(await run('document.body.style.position'),'fixed');
      assert.equal(await run('document.activeElement.getAttribute("aria-label")'),'Edit Carne Asada Fries');
      await swipe(1,-85);await tap(`${row(1)}.querySelector('[data-cart-swipe-action]:not(:disabled)')`);assert.equal((await rows()).length,6);
      assert.equal(await run('document.activeElement.getAttribute("aria-label")'),'Close cart');
      await escape();assert.equal(await run('Boolean(document.querySelector("dialog[open]"))'),false);assert.equal(await run('document.body.style.position'),'');
      const after=await menuState();assert.deepEqual(after,before,'Exact menu scroll, query, category strip and active context survive sheet/edit/close');assert.equal(await run(`document.activeElement===${cartButton}`),true);
      console.log('PASS',width,'both swipe directions, reveal-only removal, one-row reveal, vertical scroll, sticky header/footer, nested edit, exact menu state, Escape/focus');
      await click('document.querySelector(`button[aria-label="Clear search"]`)');await click('document.querySelector(`button[aria-label="Add Carne Asada Fries to cart"]`)');await click(cartButton);
      result=await rows();assert.equal(result.filter(e=>e.name==='Carne Asada Fries').length,2);
      await click(`${row(0)}.querySelector('[class*=cartLineActions] button[aria-label="Edit Carne Asada Fries"]')`);
      await setInput('dialog[aria-label^="Item details"] textarea','',true);await click('document.querySelector(`dialog[aria-label^="Item details"] button[type=submit]`)');await pause(400);
      result=await rows();assert.equal(result.filter(e=>e.name==='Carne Asada Fries').length,1);assert.equal(result[0].quantity,4);
      await setInput('aside article input[aria-label=Quantity]','99');assert.equal(await run(`${row(0)}.querySelector('button[aria-label="Increase quantity"]').disabled`),true);
      await setInput('aside article input[aria-label=Quantity]','4');
      await click('document.querySelector("[data-cart-close]")');
      await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      const feedback=await run('(()=>{const b=document.querySelector(`button[aria-label="Add Carne Asada Fries to cart"]`);b.click();return new Promise(resolve=>setTimeout(()=>resolve({added:b.dataset.added,animation:getComputedStyle(b).animationName,pulse:getComputedStyle(document.querySelector("[class*=cartCountPulse]")).animationName}),100))})()');assert.equal(feedback.added,'true');assert.equal(feedback.animation,'none');assert.equal(feedback.pulse,'none');await pause(500);assert.equal(await run('document.querySelector(`button[aria-label="Add Carne Asada Fries to cart"]`).dataset.added'),'false');
      await click(cartButton);assert.equal(await run('getComputedStyle(document.querySelector("dialog[aria-label=Cart]")).animationName'),'none');assert.equal(await run('getComputedStyle(document.querySelector("[class*=cartRowSurface]")).transitionDuration'),'0s');
      await call('Emulation.setEmulatedMedia',{features:[]});
      console.log('PASS',width,'distinct configurations, edit collision quantity 4, max 99, 500ms feedback, reduced motion');
    } else {
      assert.equal(await run('Boolean(document.querySelector("dialog[aria-label=Cart]"))'),false);assert.equal(await run('document.body.style.position'),'');
      assert.equal(await run('getComputedStyle(document.querySelector("input[type=search]").closest("[class*=controls]")).display'),'grid');
      assert.equal(await run(`${row(0)}.querySelector('[class*=cartLineActions] button').textContent`),'Edit');assert.equal(await run('Boolean(document.querySelector("aside [class*=cartThumbnail]"))'),false);
      await click(`${row(0)}.querySelector('button[aria-label="Increase quantity"]')`);assert.equal((await rows())[0].quantity,4);await click(`${row(0)}.querySelector('button[aria-label="Decrease quantity"]')`);assert.equal((await rows())[0].quantity,3);
      await shot(width+'-desktop');console.log('PASS',width,'desktop remains in flow with text actions; consolidated quantities update');
    }
    assert.equal(await run('document.documentElement.scrollWidth>innerWidth'),false);
    await click('document.querySelector("aside [class*=checkoutButton]")');await pause(1500);assert.equal(await run('location.pathname'),'/r/armandos/checkout');assert.equal(await run('document.body.style.position'),'');await shot(width+'-checkout');
    console.log('PASS',width,'checkout routing, released scroll lock, no overflow');
  }
  ws.close();
})().catch(error=>{console.error(error);process.exit(1)});
