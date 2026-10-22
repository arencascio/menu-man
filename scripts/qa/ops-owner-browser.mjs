// Test-only local Auth/Data API wire fixture. Never imported by application code.
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { open } from 'node:fs/promises';
import { createHmac, randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';
import { opsFunctions } from './ops-owner-inbox.mjs';

export async function runOpsBrowser({pool,rpc,claims,other,otherSession,leadId,failedId,dir}) {
  assert.equal(pool.options.host,'127.0.0.1');
  const tokens=new Map(); const factor=randomUUID(); let leadReads=0;
  function session(identity) {
    const now=Math.floor(Date.now()/1000);
    const payload={...identity,aud:'authenticated',iat:now,exp:now+3600};
    const segments=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify(payload)).toString('base64url')];
    const token=`${segments.join('.')}.${createHmac('sha256','local-synthetic-only').update(segments.join('.')).digest('base64url')}`;
    tokens.set(token,identity);
    return {access_token:token,token_type:'bearer',expires_in:3600,refresh_token:randomUUID(),user:user(identity)};
  }
  function user(identity) {return {id:identity.sub,aud:'authenticated',role:'authenticated',email:identity.sub===claims.sub?'owner@example.test':'other@example.test',
    app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-01-01T00:00:00Z',
    factors:identity.sub===claims.sub?[{id:factor,status:'verified',factor_type:'totp',friendly_name:'Synthetic authenticator'}]:[]};}
  const bridge=http.createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const send=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body));};
    try {
      const url=new URL(req.url,'http://127.0.0.1');
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
      const identity=tokens.get((req.headers.authorization??'').replace(/^Bearer /i,''));
      if(url.pathname==='/auth/v1/token' && url.searchParams.get('grant_type')==='password') {
        if(body.password!=='synthetic-password' || !['owner@example.test','other@example.test'].includes(body.email)) return send(400,{msg:'Invalid synthetic credentials'});
        const identity=body.email==='owner@example.test'?{...claims,aal:'aal1'}:{...claims,sub:other,session_id:otherSession,aal:'aal1'};
        await pool.query('insert into auth.sessions values($1,$2) on conflict do nothing',[identity.session_id,identity.sub]);
        return send(200,session(identity));
      }
      if(url.pathname==='/auth/v1/user') return identity?send(200,user(identity)):send(401,{msg:'No synthetic session'});
      if(url.pathname==='/auth/v1/logout') {
        if(identity) {await pool.query('delete from auth.sessions where id=$1',[identity.session_id]);tokens.delete((req.headers.authorization??'').replace(/^Bearer /i,''));}
        res.writeHead(204);return res.end();
      }
      if(identity && url.pathname===`/auth/v1/factors/${factor}/challenge`) return send(200,{id:randomUUID(),expires_at:Math.floor(Date.now()/1000)+300,type:'totp'});
      if(identity && url.pathname===`/auth/v1/factors/${factor}/verify`) return body.code==='123456'?send(200,session({...identity,aal:'aal2'})):send(400,{msg:'Invalid synthetic code'});
      if(url.pathname.startsWith('/rest/v1/rpc/')) {
        const name=url.pathname.split('/').at(-1);
        if(!opsFunctions[name]) return send(404,{message:'RPC unavailable'});
        if(['list_ops_leads_v1','get_ops_lead_v1'].includes(name)) leadReads++;
        try {return send(200,await rpc(name,body,identity??{},identity?'authenticated':'anon'));}
        catch(error) {return send(error.code==='42501'?403:400,{code:error.code,message:error.message});}
      }
      return send(404,{message:'Local fixture endpoint unavailable'});
    } catch {return send(500,{message:'Local fixture failed'});}
  });
  await new Promise(resolve=>bridge.listen(0,'127.0.0.1',resolve));
  const bridgeOrigin=`http://127.0.0.1:${bridge.address().port}`;
  const appPort=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
  const origin=`http://localhost:${appPort}`;
  const log=await open(path.join(dir,'next-ops-qa.log'),'a');
  const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(appPort)],{
    cwd:process.cwd(),windowsHide:true,stdio:['ignore',log.fd,log.fd],env:{...process.env,
      MENU_MAN_OPS_ENABLED:'true',MENU_MAN_ENV:'production',MENU_MAN_OFFLINE_DEMO_QA:'true',MENU_MAN_PUBLIC_SHOWCASE_QA:'true',
      NEXT_PUBLIC_SUPABASE_URL:bridgeOrigin,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-synthetic-publishable',SUPABASE_SERVICE_ROLE_KEY:'',
      RESEND_API_KEY:'',NEXT_PUBLIC_POSTHOG_KEY:'',NEXT_PUBLIC_ANALYTICS_PROVIDER:'none',
    },
  });
  let browser;
  try {
    const deadline=Date.now()+90_000;
    let ready=false;
    while(Date.now()<deadline && child.exitCode===null) {
      try {const response=await fetch(`${origin}/ops/login`,{signal:AbortSignal.timeout(3000)});if(response.status===200){ready=true;break;}}catch{}
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    assert.ok(ready,`Local Next QA server did not become ready; inspect ${dir}/next-ops-qa.log`);
    browser=await chromium.launch({channel:'chrome',headless:true});
    const context=await browser.newContext();
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage();
    let response=await page.goto(`${origin}/ops`);
    assert.ok(page.url().includes('/ops/login'));assert.doesNotMatch(await page.content(),/Inbox Synthetic|synthetic@example.com/);
    response=await context.request.post(`${origin}/ops/leads/${leadId}/actions`,{headers:{Origin:origin},data:{action:'save',revision:4,status:'won',notes:'Unauthorized',followUpAt:null}});
    assert.equal(response.status(),401,await response.text());assert.equal(leadReads,0);
    await page.locator('[name=email]').fill('other@example.test');await page.locator('[name=password]').fill('synthetic-password');
    await Promise.all([page.waitForURL('**/ops/login?result=denied'),page.getByRole('button',{name:'Sign in',exact:true}).click()]);
    response=await page.goto(`${origin}/ops/leads/${leadId}`);assert.ok(page.url().includes('/ops/login') || response.status()===404);
    assert.doesNotMatch(await page.content(),/Inbox Synthetic|synthetic@example.com/);assert.equal(leadReads,0);
    // Also test a still-valid non-owner session, independently of sign-in UI.
    await pool.query('insert into auth.sessions values($1,$2) on conflict do nothing',[otherSession,other]);
    const cookies=[];
    const auth=createServerClient(bridgeOrigin,'local-synthetic-publishable',{cookies:{getAll:()=>[],setAll:values=>cookies.push(...values)}});
    await auth.auth.setSession(session({...claims,sub:other,session_id:otherSession,aal:'aal1'}));
    await context.addCookies(cookies.filter(cookie=>cookie.value).map(cookie=>({name:cookie.name,value:cookie.value,url:origin})));
    response=await page.goto(`${origin}/ops/leads/${leadId}`);assert.equal(response.status(),404);
    assert.doesNotMatch(await page.content(),/Inbox Synthetic|synthetic@example.com/);
    response=await context.request.post(`${origin}/ops/leads/${leadId}/actions`,{headers:{Origin:origin},data:{action:'retry'}});
    assert.equal(response.status(),403);assert.equal(leadReads,0);
    await context.clearCookies();
    await page.goto(`${origin}/ops/login`);
    await page.locator('[name=email]').fill('owner@example.test');await page.locator('[name=password]').fill('synthetic-password');
    await Promise.all([page.waitForURL('**/ops/login?result=mfa'),page.getByRole('button',{name:'Sign in',exact:true}).click()]);
    assert.equal(leadReads,0);
    await page.locator('[name=code]').fill('123456');
    await Promise.all([page.waitForURL(`${origin}/ops`),page.getByRole('button',{name:'Verify authenticator'}).click()]);
    await page.getByRole('heading',{name:'Lead inbox',exact:true}).waitFor();
    for(const width of [320,412,1440]) {
      await page.setViewportSize({width,height:1000});
      response=await page.goto(`${origin}/ops`);
      // Next dev normalizes Cache-Control to no-store; production source also
      // explicitly requests private/max-age=0 in proxy and route headers.
      assert.match(response.headers()['cache-control'],/no-store/);assert.doesNotMatch(response.headers()['cache-control'],/public|s-maxage/);
      assert.equal(response.headers()['x-robots-tag'],'noindex, nofollow');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(dir,`inbox-${width}.png`),fullPage:true});
      await page.goto(`${origin}/ops/leads/${leadId}`);
      await page.getByRole('heading',{name:'Lead details',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const title=await page.title();assert.doesNotMatch(title,/Synthetic|synthetic@example/);
      await page.screenshot({path:path.join(dir,`detail-${width}.png`),fullPage:true});
    }
    await page.getByLabel('Internal notes').fill('Browser synthetic owner note');
    await page.locator('aside select[name=status]').selectOption('waiting');
    await page.getByLabel('Follow-up date and time (Pacific)').fill('2026-01-01T12:00');
    await Promise.all([page.waitForURL('**?result=saved'),page.getByRole('button',{name:'Save lead'}).click()]);
    assert.equal(await page.getByLabel('Internal notes').inputValue(),'Browser synthetic owner note');
    assert.equal(Date.parse((await rpc('get_ops_lead_v1',{p_lead_id:leadId})).followUpAt),Date.parse('2026-01-01T20:00:00Z'));
    await page.goto(`${origin}/ops?view=due`);await page.getByRole('link',{name:'Inbox Synthetic Restaurant',exact:true}).waitFor();
    await page.goto(`${origin}/ops/leads/${failedId}`);
    assert.ok(await page.getByRole('button',{name:'Retry notification'}).isDisabled());
    assert.match(await page.locator('main').innerText(),/safely stored|safely stored/i);
    response=await context.request.post(`${origin}/ops/leads/${failedId}/actions`,{headers:{Origin:origin},data:{action:'retry'}});assert.equal(response.status(),503);
    response=await context.request.post(`${origin}/ops/leads/${leadId}/actions`,{headers:{Origin:'https://attacker.example'},data:{action:'retry'}});assert.equal(response.status(),403);
    for(const url of ['/manage','/auth/callback','/r/armandos']) {response=await context.request.get(origin+url);assert.equal(response.status(),404);}
    await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/ops/login');
    await page.goto(`${origin}/ops/leads/${leadId}`);assert.ok(page.url().includes('/ops/login'));assert.doesNotMatch(await page.content(),/Browser synthetic owner note|Inbox Synthetic/);
    await context.close();
    console.log('PASS Chrome: anonymous/non-owner denial; password + TOTP; owner list/detail/edit; failed email; CSRF; sign-out; Production gates; 320/412/1440px layouts');
  } finally {
    if(browser) await browser.close();
    if(child.exitCode===null && child.pid) spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    await log.close();await new Promise(resolve=>bridge.close(resolve));
  }
}
