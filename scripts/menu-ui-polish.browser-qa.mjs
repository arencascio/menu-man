// Local Chrome CDP QA only. Requires the authorized staging project; never submits orders.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.QA_BASE_URL || 'http://localhost:3100';
const phase1 = process.argv.includes('--phase1');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
assert.ok((await (await fetch(base + '/diagnostics')).text()).includes('jjvongzvtnzlvwdfcnjk'));
for (const icon of ['heart-crack', 'sparkles', 'face-slightly-smiling']) assert.equal((await fetch(base + '/img/icons/' + icon + '.svg')).status, 200);
const page = (await (await fetch('http://localhost:9223/json')).json()).find(p => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => ws.onopen = resolve);
let id = 0; const pending = new Map();
ws.onmessage = event => { const m = JSON.parse(event.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if(m.error) p.reject(m.error); else p.resolve(m.result); } };
const call = (method, params={}) => new Promise((resolve,reject) => { const i=++id; pending.set(i,{resolve,reject}); ws.send(JSON.stringify({id:i,method,params})); });
const run = async expression => { const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const wait = async expression => { for(let i=0;i<200;i++){if(await run(expression)) return; await pause(50);} throw new Error('Timed out: '+expression); };
const click = async selector => { assert.equal(await run('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e||e.disabled)return false;e.click();return true})()'),true,selector); await pause(250); };
const key = async (key,code,virtual,shift=false) => { await call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual,modifiers:shift?8:0}); await call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual}); await pause(250); };
const tapPoint = async (x,y) => { await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]}); await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); };
const cart = 'button[class*=cartButton]';
const clear = 'aside button[class*=clearCartButton]';
const state = () => run('JSON.stringify(Object.entries(localStorage).filter(([k])=>k.includes("cart")))');
const screenshot = async name => { fs.mkdirSync('node_modules/.cache',{recursive:true}); fs.writeFileSync('node_modules/.cache/menu-ui-'+name+'.png',Buffer.from((await call('Page.captureScreenshot')).data,'base64')); };
await call('Page.enable');
try {
  for(const width of (process.env.QA_WIDTH ? [Number(process.env.QA_WIDTH)] : [412,320,1440])) {
    const mobile=width<761;
    await call('Emulation.setDeviceMetricsOverride',{width,height:915,deviceScaleFactor:1,mobile});
    await call('Emulation.setTouchEmulationEnabled',{enabled:mobile});
    await call('Page.navigate',{url:base+'/r/armandos/menu'});
    await wait('Boolean(document.querySelector("input[type=search]"))'); await pause(1500);
    await run('localStorage.clear();sessionStorage.clear()'); await call('Page.reload'); await pause(600);
    await wait('Boolean(document.querySelector("button[aria-label=\\"Add Carne Asada Fries to cart\\"]"))'); await pause(1000);
    const geometry=await run('(()=>{return [...document.querySelectorAll("[class*=itemCard]")].map(c=>{const h=c.querySelector("[class*=heartButton]"),a=c.querySelector("[class*=cardAddButton]");if(!a)return null;const x=h.getBoundingClientRect(),y=a.getBoundingClientRect();return {heart:x.width,add:y.width,heartHeight:x.height,addHeight:y.height,countAccessible:!!document.getElementById(h.getAttribute("aria-describedby")),badgeInside:!c.querySelector("[class*=heartCount]")||h.contains(c.querySelector("[class*=heartCount]"))}}).filter(Boolean)})()');
    assert.ok(geometry.length>0); assert.ok(geometry.every(g=>g.heart===g.add&&g.heartHeight===g.addHeight&&g.countAccessible&&g.badgeInside));
    const budget=await run('(()=>{const d=document.querySelector("[class*=itemDescription]"),p=d.parentElement,t=p.querySelector("[class*=itemName]");window.qaTitle=t;window.qaOriginal=t.textContent;window.qaOriginalHeight=p.getBoundingClientRect().height;t.textContent="Dish";return true})()'); assert.ok(budget); await pause(150);
    await run('(()=>{const t=window.qaTitle,lh=parseFloat(getComputedStyle(t).lineHeight);while(t.getBoundingClientRect().height<lh*2.9&&t.textContent.length<1000)t.textContent+=" delicious"})()'); await pause(150);
    const long=await run('(()=>{const t=window.qaTitle,p=t.parentElement,d=p.querySelector("[class*=itemDescription]"),price=p.querySelector("[class*=price]");return {titleLines:Math.round(t.getBoundingClientRect().height/parseFloat(getComputedStyle(t).lineHeight)),descriptionLines:Number(p.style.getPropertyValue("--description-lines")),height:p.getBoundingClientRect().height,original:window.qaOriginalHeight,overlap:t.getBoundingClientRect().bottom>price.getBoundingClientRect().top}})()');
    assert.equal(long.titleLines,3);assert.equal(long.descriptionLines,mobile?0:1);assert.equal(long.overlap,false);assert.ok(long.height<=long.original+2,JSON.stringify(long));
    await run('(()=>{const t=window.qaTitle,lh=parseFloat(getComputedStyle(t).lineHeight);while(t.getBoundingClientRect().height<lh*4.9&&t.textContent.length<1500)t.textContent+=" delicious"})()');await pause(150);
    assert.equal(await run('window.qaTitle.parentElement.style.getPropertyValue("--description-lines")'),'0');
    assert.ok(await run('window.qaTitle.parentElement.getBoundingClientRect().height>window.qaOriginalHeight'));
    await run('window.qaTitle.textContent=window.qaOriginal');await pause(150);
    await click('button[aria-label="Add Carne Asada Fries to cart"]'); await click(cart);
    const original=await state();await click(clear);assert.equal(await state(),original);
    assert.equal(await run('document.activeElement.hasAttribute("data-clear-cancel")'),true);
    await run('document.querySelector("[data-cart-close]").focus()');assert.equal(await run('document.activeElement.hasAttribute("data-clear-cancel")'),true);
    await key('Tab','Tab',9,true);assert.equal(await run('document.activeElement.textContent'),'Yes, clear cart');await key('Tab','Tab',9);assert.equal(await run('document.activeElement.textContent'),'Cancel');
    await click('[data-clear-cancel]');assert.equal(await state(),original);assert.equal(await run('document.activeElement.className.includes("clearCartButton")'),true);
    await click(clear);await key('Escape','Escape',27);assert.equal(await state(),original);assert.equal(await run('Boolean(document.querySelector("dialog[class*=cartConfirmation][open]"))'),false);
    await click(clear);await click('dialog[class*=cartConfirmation] button[class*=checkoutButton]');await wait('document.querySelector("[class*=cartEmpty]")?.textContent === "Your cart is empty"');
    assert.equal(await run('document.querySelectorAll("aside article").length'),0);
    if(mobile) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:480,deviceScaleFactor:1,mobile});await pause(250);
      const empty=await run('(()=>{const p=document.querySelector("aside[class*=cartPanel]"),h=p.querySelector("[class*=cartHeader]").getBoundingClientRect(),e=p.querySelector("[class*=cartEmpty]").getBoundingClientRect(),s=p.getBoundingClientRect();return {center:Math.abs((e.top+e.bottom)/2-(h.bottom+s.bottom)/2),overflow:p.scrollHeight>p.clientHeight,icon:p.querySelector("[class*=cartEmpty] [class*=menuIcon]").getBoundingClientRect().width}})()');assert.ok(empty.center<2);assert.equal(empty.overflow,false);assert.equal(empty.icon,72);await screenshot(width+'-empty-short');
      await call('Emulation.setDeviceMetricsOverride',{width,height:915,deviceScaleFactor:1,mobile});
    }
    await click('[data-cart-close]');assert.equal(await run('document.activeElement.className.includes("cartButton")'),mobile);
    if(mobile) {
      // Native modal background interception: place a test target directly under an outside tap.
      await run('(()=>{const b=document.createElement("button");b.id="qa-underlay";b.style="position:fixed;left:12px;bottom:12px;width:80px;height:44px;z-index:99";b.textContent="Underlay";window.qaClicks=0;b.onclick=()=>window.qaClicks++;document.body.append(b)})()');
      await click('button[aria-label="Open navigation"]');assert.equal(await run('document.querySelector("dialog[class*=navigationDialog]").matches(":modal")'),true);
      await tapPoint(40,880);await pause(40);assert.equal(await run('window.qaClicks'),0);assert.equal(await run('document.querySelector("dialog[class*=navigationDialog]").open'),true);
      await tapPoint(40,880);assert.equal(await run('window.qaClicks'),0);
      await pause(250);assert.equal(await run('document.querySelector("dialog[class*=navigationDialog]").open'),false);assert.equal(await run('document.activeElement.getAttribute("aria-label")'),'Open navigation');
      await run('document.querySelector("#qa-underlay").remove()');
      await click('button[aria-label="Open navigation"]');await key('Escape','Escape',27);assert.equal(await run('document.querySelector("dialog[class*=navigationDialog]").open'),false);
      await click('button[aria-label="Open navigation"]');await click('dialog[class*=navigationDialog] button[aria-haspopup=dialog]');
      assert.equal(await run('document.querySelector("dialog[class*=navigationDialog]").open'),false);assert.equal(await run('document.querySelectorAll("dialog[open]").length'),1);assert.equal(await run('document.querySelector("button[aria-label=\\"Close delivery options\\"]").closest("dialog").open'),true);
      await click('button[aria-label="Close delivery options"]');assert.equal(await run('document.body.style.position'),'');assert.equal(await run('document.activeElement.getAttribute("aria-label")'),'Open navigation');
      for(let n=0;n<4;n++){await click('button[aria-label="Open navigation"]');await run('document.querySelector("dialog[class*=navigationDialog] button[aria-label=\\"Close navigation\\"]").click();document.querySelector("dialog[class*=navigationDialog] button[aria-label=\\"Close navigation\\"]").click()');await pause(250);assert.equal(await run('document.querySelectorAll("dialog[open]").length'),0);}
    }
    if(!phase1) {
      await click('button[aria-label="Add Carne Asada Fries to cart"]');await click(cart);
      if(mobile){await run('document.querySelector("[data-cart-close]").click()');await pause(50);assert.equal(await run('document.querySelector("dialog[aria-label=Cart]").open'),true);assert.equal(await run('document.body.style.position'),'fixed');await pause(300);assert.equal(await run('document.querySelectorAll("dialog[open]").length'),0);}else await click('[data-cart-close]');
      await run('(()=>{const b=[...document.querySelectorAll("[class*=itemCard] > button")].find(e=>e.textContent.includes("Carne Asada Fries"));b.click()})()');await wait('Boolean(document.querySelector("dialog[aria-label^=\\"Item details\\"][open]"))');await pause(300);
      const beforeAdd=await run('Number(document.querySelector("button[class*=cartButton]").textContent.match(/[0-9]+/)[0])');
      await run(`window.qaRandom=Math.random;Math.random=()=>${width===320?.8:.2}`);
      await run('(()=>{const form=document.querySelector("dialog[aria-label^=\\"Item details\\"] form");form.requestSubmit();form.requestSubmit();form.requestSubmit()})()');await pause(100);
      assert.equal(await run('Number(document.querySelector("button[class*=cartButton]").textContent.match(/[0-9]+/)[0])'),beforeAdd+1);
      assert.equal(await run('document.querySelector("dialog[aria-label^=\\"Item details\\"] button[type=submit]").dataset.success'), 'true');assert.equal(await run('document.querySelector("dialog[aria-label^=\\"Item details\\"] button[type=submit]").disabled'),true);
      assert.ok(await run(`document.querySelector('[class*=detailSuccess] [class*=menuIcon]').style.maskImage.includes('${width===320?'face-slightly-smiling':'sparkles'}')`));
      await run('Math.random=window.qaRandom');await screenshot(width+'-success');
      await wait('!document.querySelector("dialog[aria-label^=\\"Item details\\"][open]")');assert.equal(await run('document.body.style.position'),'');
      await run('(()=>{const b=[...document.querySelectorAll("[class*=itemCard] > button")].find(e=>e.textContent.includes("Carne Asada Fries"));b.click()})()');await pause(300);await run('document.querySelector("[data-detail-close]").click()');await pause(50);assert.equal(await run('document.querySelector("dialog[aria-label^=\\"Item details\\"]").open'),true);await pause(300);assert.equal(await run('document.querySelectorAll("dialog[open]").length'),0);
      await run('(()=>{const b=[...document.querySelectorAll("[class*=itemCard] > button")].find(e=>e.textContent.includes("Carne Asada Fries"));b.click()})()');await pause(300);await run('history.back()');await pause(50);assert.equal(await run('document.querySelector("dialog[aria-label^=\\"Item details\\"]").open'),true);await pause(300);assert.equal(await run('document.querySelectorAll("dialog[open]").length'),0);
      await run('(()=>{const b=[...document.querySelectorAll("[class*=itemCard] > button")].find(e=>e.textContent.includes("Carne Asada Fries"));b.click()})()');await pause(300);await run('history.back()');await pause(50);await run('history.forward()');await pause(350);
      assert.equal(await run('document.querySelector("dialog[aria-label^=\\"Item details\\"]").open'),true);await click('[data-detail-close]');
      // A capped cart mutation must leave the detail open, without success feedback.
      await click(cart);await run('(()=>{const e=document.querySelector("aside article input[aria-label=Quantity]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"99");e.dispatchEvent(new Event("input",{bubbles:true}))})()');await pause(200);await click('[data-cart-close]');
      await run('(()=>{const b=[...document.querySelectorAll("[class*=itemCard] > button")].find(e=>e.textContent.includes("Carne Asada Fries"));b.click()})()');await pause(300);await run('document.querySelector("dialog[aria-label^=\\"Item details\\"] form").requestSubmit()');await pause(500);
      assert.equal(await run('document.querySelector("dialog[aria-label^=\\"Item details\\"]").open'),true);assert.equal(await run('document.querySelector("dialog[aria-label^=\\"Item details\\"] button[type=submit]").dataset.success'),'false');assert.ok(await run('document.querySelector("dialog[aria-label^=\\"Item details\\"] [role=alert]").textContent.includes("quantity limit")'));await click('[data-detail-close]');
      await click(cart);await run('(()=>{const e=document.querySelector("aside article input[aria-label=Quantity]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"2");e.dispatchEvent(new Event("input",{bubbles:true}))})()');await pause(200);await click('[data-cart-close]');
      if(mobile) for(let n=0;n<3;n++){await click(cart);await run('document.querySelector("[data-cart-close]").click();document.querySelector("[data-cart-close]").click()');await pause(280);assert.equal(await run('document.querySelectorAll("dialog[open]").length'),0);assert.equal(await run('document.body.style.position'),'');}
      await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      await click(cart);await click('[data-cart-close]');assert.equal(await run('document.querySelectorAll("dialog[open]").length'),0);
      await run('(()=>{const b=[...document.querySelectorAll("[class*=itemCard] > button")].find(e=>e.textContent.includes("Carne Asada Fries"));b.click()})()');await pause(100);assert.equal(await run('getComputedStyle(document.querySelector("dialog[aria-label^=\\"Item details\\"]")).animationName'),'none');
      await run('document.querySelector("dialog[aria-label^=\\"Item details\\"] form").requestSubmit()');await pause(250);assert.equal(await run('document.querySelectorAll("dialog[open]").length'),0);
      if(mobile){await click('button[aria-label="Open navigation"]');assert.equal(await run('getComputedStyle(document.querySelector("[class*=mobileNavigation]")).animationName'),'none');await click('dialog[class*=navigationDialog] button[aria-haspopup=dialog]');await click('button[aria-label="Close delivery options"]');assert.equal(await run('document.querySelectorAll("dialog[open]").length'),0);}
      await call('Emulation.setEmulatedMedia',{features:[]});
    }
    assert.equal(await run('document.documentElement.scrollWidth>innerWidth'),false);await screenshot(width+'-menu');
    await call('Page.navigate',{url:base+'/r/armandos/location'});await wait('Boolean(document.querySelector("#restaurant-information"))');assert.equal(await run('document.querySelector("#restaurant-information").textContent.includes("Find us")'),false);assert.equal(await run('document.documentElement.scrollWidth>innerWidth'),false);await screenshot(width+'-location');
    console.log('PASS',width,phase1?'Phase 1 layout, confirmation, empty state, nav backdrop/handoff':'layout, confirmation, nav handoff, exits, add feedback, duplicate guard, reduced motion');
  }
} finally { ws.close(); }
