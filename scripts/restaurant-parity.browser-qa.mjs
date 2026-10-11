// Local Chrome CDP QA only. Requires the authorized staging project; never submits orders.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.QA_BASE_URL || 'http://localhost:3100';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
assert.ok((await (await fetch(base + '/diagnostics')).text()).includes('jjvongzvtnzlvwdfcnjk'));
for (const icon of ['face-slightly-frowning', 'face-slightly-smiling']) assert.equal((await fetch(base + '/img/icons/' + icon + '.svg')).status, 200);
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
const screenshot = async name => { fs.mkdirSync('node_modules/.cache',{recursive:true}); fs.writeFileSync('node_modules/.cache/menu-ui-'+name+'.png',Buffer.from((await call('Page.captureScreenshot')).data,'base64')); };
await call('Page.enable');
try {
  for (const width of (process.env.QA_WIDTH ? [Number(process.env.QA_WIDTH)] : [320, 412, 1024, 1440])) {
    await call('Emulation.setDeviceMetricsOverride', {width,height:915,deviceScaleFactor:1,mobile:width<=760});
    await call('Emulation.setTouchEmulationEnabled', {enabled:width<=760});
    await call('Page.navigate', {url:base+'/r/armandos/menu'});
    await wait('Boolean(document.querySelector("button[class*=cardAddButton]"))'); await pause(1600);
    await run('localStorage.clear();sessionStorage.clear()'); await call('Page.reload'); await pause(1600);
    assert.equal(await run('getComputedStyle(document.querySelector("button[class*=cartButton]")).backgroundColor'), 'rgb(255, 255, 255)');
    const add='button[aria-label="Add Carne Asada Fries to cart"]';
    const geometry=() => run(`(()=>{const b=document.querySelector(${JSON.stringify(add)}),c=b.closest('[class*=itemCard]'),i=c.querySelector('img');return [b,c,i].filter(Boolean).map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]})})()`);
    const before=await geometry();
    await run(`document.querySelector(${JSON.stringify(add)}).click()`); await pause(100);
    assert.deepEqual(await geometry(),before);
    assert.ok((await run(`getComputedStyle(document.querySelector(${JSON.stringify(add)}).querySelector('span')).maskImage`)).includes('face-slightly-smiling'));
    await pause(600); assert.ok((await run(`getComputedStyle(document.querySelector(${JSON.stringify(add)}).querySelector('span')).maskImage`)).includes('plus'));
    await run(`(()=>{const e=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'burrito');e.dispatchEvent(new Event('input',{bubbles:true}))})()`); await pause(500);
    await run(`window.scrollTo({top:1200,behavior:'instant'});document.querySelector('nav[aria-label="Menu categories"]').scrollLeft=150`); await pause(400);
    const menuState=()=>run(`(()=>{const n=document.querySelector('nav[aria-label="Menu categories"]'),h=document.querySelector('header'),s=document.querySelector('input[type=search]');return {y:scrollY,search:s.value,category:n.scrollLeft,active:n.querySelector('[aria-pressed=true]')?.textContent,headerX:h.getBoundingClientRect().x,searchX:s.getBoundingClientRect().x}})()`);
    for(const selector of ['button[class*=cartButton]','button[aria-label="Browse all menu sections"]','button[aria-haspopup=dialog][class*=cardOpen]']) {
      // Item opener class is discovered from the visible menu card, preserving its canonical identity.
      const target=selector.includes('cardOpen') ? await run(`document.querySelector('[class*=itemCard] button[aria-haspopup=dialog]')?.getAttribute('class')`) : null;
      const actual=target ? 'button.'+target.trim().split(/\s+/).join('.') : selector;
      const saved=await menuState(); await click(actual);
      assert.equal(await run('Boolean(document.querySelector("dialog:modal"))'),true);
      if(width>760) {
        const during=await menuState(); assert.deepEqual(during,saved);
        assert.ok(await run(`document.querySelector('header').getBoundingClientRect().bottom>0`),'sticky header remains visible');
      }
      assert.equal(await run(`(()=>{const s=document.querySelector('input[type=search]');s.focus();return document.activeElement===s})()`),false);
      await key('Escape','Escape',27); await pause(150);
      assert.deepEqual(await menuState(),saved);
      assert.equal(await run('document.documentElement.scrollWidth>innerWidth'),false);
    }
    await screenshot('parity-menu-'+width);
    await call('Page.navigate',{url:base+'/r/armandos'}); await wait('Boolean(document.getElementById("restaurant-menu"))'); await pause(1400);
    const intro=await run(`(()=>{const s=document.getElementById('restaurant-menu');return {title:s.querySelector('h2').textContent,extra:s.querySelectorAll('p,img').length,font:parseFloat(getComputedStyle(s.querySelector('h2')).fontSize),links:[...s.querySelectorAll('a')].map(e=>e.getAttribute('href')),height:s.getBoundingClientRect().height}})()`);
    assert.equal(intro.title,'Find your next favorite'); assert.equal(intro.extra,0); assert.ok(intro.font<=22); assert.equal(intro.links.length,5);
    assert.ok(intro.links.every(h=>h.startsWith('/r/armandos/menu#restaurant-menu-section-')));
    assert.equal(await run('document.documentElement.scrollWidth>innerWidth'),false);
    const footer='footer [class*=brandReveal]';
    await run('window.scrollTo({top:document.body.scrollHeight,behavior:"instant"})'); await pause(600);
    assert.equal(await run(`getComputedStyle(document.querySelector('${footer}')).opacity`),'1');
    assert.equal(await run(`getComputedStyle(document.querySelector('${footer}')).transform`),'none');
    await screenshot('parity-footer-'+width);
    const pickup=await run(`(()=>{const a=[...document.querySelectorAll('a')].find(e=>e.textContent.includes('Order Pickup')&&e.getAttribute('href')?.includes('?item='));return a?.getAttribute('href')})()`);
    assert.ok(pickup,'gallery retains selected canonical item');
    await call('Page.navigate',{url:base+pickup}); await wait('Boolean(document.querySelector("dialog:modal"))'); await pause(500);
    assert.ok(await run(`document.querySelector('dialog:modal').getAttribute('aria-label').includes('California Burrito')`));
    await key('Escape','Escape',27);
    await call('Page.navigate',{url:base+intro.links[0]}); await wait('Boolean(document.querySelector("input[type=search]"))'); await pause(1500);
    assert.ok(await run(`Boolean(document.getElementById(decodeURIComponent(location.hash.slice(1))))`));
    console.log('PASS parity',width,'neutral cart, fixed feedback footprint, overlay state/chrome, homepage links, footer reveal, selected gallery pickup');
  }
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await click('button[class*=cartButton]');
  assert.equal(await run(`getComputedStyle(document.querySelector('dialog:modal')).animationName`),'none'); await key('Escape','Escape',27);
  await call('Page.navigate',{url:base+'/r/armandos'}); await wait('Boolean(document.querySelector("footer [class*=brandReveal]"))'); await pause(600);
  assert.equal(await run(`getComputedStyle(document.querySelector('footer [class*=brandReveal]')).transform`),'none');
  assert.equal(await run(`getComputedStyle(document.querySelector('footer [class*=brandReveal]')).transitionDuration`),'0s');
  console.log('PASS reduced-motion cart and footer');
} finally { await call('Emulation.setEmulatedMedia',{features:[]}); ws.close(); }
