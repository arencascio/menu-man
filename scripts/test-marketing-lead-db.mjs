// Always creates a fresh local-only PostgreSQL 17 cluster. No URL/env-file input.
// Run: node --import=tsx scripts/test-marketing-lead-db.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createLeadStore } from '../src/lib/marketing-leads/persistence.ts';
import { leadSchema } from '../src/lib/marketing-leads/contracts.ts';
import { createLeadHandler } from '../src/lib/marketing-leads/handler.ts';

const bin = 'C:/Program Files/PostgreSQL/17/bin';
const root = path.resolve('.playwright');
await mkdir(root, { recursive: true });
const dir = await mkdtemp(path.join(root, 'marketing-lead-pg17-'));
const dataDir = path.join(dir, 'data');
const log = path.join(dir, 'postgres.log');
const run = (exe, args) => {
  const result = spawnSync(path.join(bin, `${exe}.exe`), args, {
    encoding: 'utf8', windowsHide: true, stdio: exe === 'pg_ctl' ? 'ignore' : 'pipe', timeout: 60_000,
  });
  if (result.status !== 0) throw new Error(`Local ${exe} failed; inspect ignored rehearsal output at ${dir}`);
  return result.stdout;
};
assert.match(run('postgres', ['--version']), /PostgreSQL\) 17\./);
const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
});
let started = false;
let pool;
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };
try {
  run('initdb', ['-D', dataDir, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--locale=C']);
  run('pg_ctl', ['-D', dataDir, '-l', log, '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  started = true;
  pool = new pg.Pool({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres', max: 8 });
  const db = await pool.connect();
  try {
    assert.equal((await db.query("select current_setting('server_version_num')::integer / 10000 major")).rows[0].major, 17);
    await db.query(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      create table public.existing_release_sentinel(id integer primary key); insert into public.existing_release_sentinel values(1);`);
    await db.query(await readFile(new URL('../supabase/migrations/20261022070256_marketing_lead_capture_v1.sql', import.meta.url), 'utf8'));
  } finally { db.release(); }
  const functions = {
    record_marketing_lead_v1: ['p_submission_id','p_type','p_details','p_context','p_from'],
    claim_marketing_lead_notification_v1: ['p_lead_id'],
    complete_marketing_lead_notification_v1: ['p_notification_id','p_token','p_state','p_provider_id','p_error_code','p_http_status'],
  };
  const store = createLeadStore(async (name, args) => {
    const keys = functions[name];
    assert.ok(keys, 'Only fixed RPC names are permitted');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('set local role service_role');
      const result = await client.query(`select public.${name}(${keys.map((_,i) => `$${i+1}`).join(',')}) result`, keys.map(key => args[key]));
      await client.query('commit');
      return { data: result.rows[0].result, error: null };
    } catch (error) {
      await client.query('rollback');
      return { data: null, error: { message: error.message } };
    } finally { client.release(); }
  });
  const lead = (overrides={}) => leadSchema.parse({ type:'website', submissionId:randomUUID(),restaurantName:'Synthetic Local Restaurant',email:'synthetic@example.com',help:'Website',...overrides });
  const context = { sourcePage:'/build-my-website', attribution:{utm_source:'local_qa', referrer:'direct'} };
  const from = 'Menu Man <hello@getmenuman.com>';
  const request = body => new Request('https://getmenuman.com/api/marketing/leads', {
    method:'POST',headers:{origin:'https://getmenuman.com','Content-Type':'application/json'},body:JSON.stringify(body),
  });
  const count = async () => (await pool.query('select count(*)::int n from public.marketing_leads')).rows[0].n;
  let saved;
  await check('atomic persistence, all form fields, source, attribution, New status and timestamps', async () => {
    const input=lead({name:'Synthetic Owner',phone:'5551234567',city:'Town',website:'restaurant.com',onlineOrdering:'yes',orderingProviders:'Square',notes:'Synthetic notes'});
    saved = await store.persist(input,context,from);
    const row=(await pool.query('select * from public.marketing_leads where id=$1',[saved])).rows[0];
    assert.equal(row.status,'new'); assert.equal(row.details.name,input.name); assert.equal(row.details.notes,input.notes);
    assert.equal(row.source_page,context.sourcePage); assert.deepEqual(row.attribution,context.attribution);
    assert.ok(row.created_at instanceof Date); assert.ok(row.updated_at instanceof Date);
    const n=(await pool.query('select * from private.marketing_lead_notifications where lead_id=$1',[saved])).rows[0];
    assert.equal(n.state,'queued'); assert.equal(n.attempt_count,0);
    assert.equal(n.delivery_key,`marketing-lead/${input.submissionId}`);
    assert.equal('email' in n,false);
  });
  await check('concurrent same-ID requests persist exactly one lead and one outbox', async () => {
    const input=lead(); const before=await count();
    const ids=await Promise.all(Array.from({length:5},()=>store.persist(input,context,from)));
    assert.equal(new Set(ids).size,1); assert.equal(await count(),before+1);
    assert.equal((await pool.query('select count(*)::int n from private.marketing_lead_notifications where lead_id=$1',[ids[0]])).rows[0].n,1);
    await assert.rejects(store.persist({...input,notes:'Changed'},context,from), {message:'Lead submission conflict'});
    assert.equal(await store.persist(input,{attribution:{}},'Other sender'),ids[0]);
    assert.equal((await pool.query('select sender from private.marketing_lead_notifications where lead_id=$1',[ids[0]])).rows[0].sender,from);
  });
  await check('invalid DB payloads and aborted outbox insert leave no partial lead', async () => {
    const before=await count();
    await assert.rejects(store.persist({...lead(),email:'bad'},context,from));
    await pool.query(`create function public.local_rehearsal_failure() returns trigger language plpgsql as $$ begin raise exception 'synthetic failure'; end $$;
      create trigger local_rehearsal_failure before insert on private.marketing_lead_notifications for each row execute function public.local_rehearsal_failure();`);
    try { await assert.rejects(store.persist(lead(),context,from)); } finally {
      await pool.query('drop trigger local_rehearsal_failure on private.marketing_lead_notifications; drop function public.local_rehearsal_failure()');
    }
    assert.equal(await count(),before);
  });
  await check('only one simultaneous notification lease, safe completion and duplicate exclusion', async () => {
    const claims=await Promise.all([store.claim(saved),store.claim(saved)]);
    assert.equal(claims.filter(Boolean).length,1);
    const claim=claims.find(Boolean);
    assert.equal(claim.lead.restaurantName,'Synthetic Local Restaurant');
    await assert.rejects(store.complete({...claim,token:randomUUID()},{state:'accepted',providerId:'mock-id',errorCode:null,httpStatus:200}));
    await store.complete(claim,{state:'accepted',providerId:'mock-id',errorCode:null,httpStatus:200});
    assert.equal(await store.claim(saved),null);
    const row=(await pool.query('select * from private.marketing_lead_notifications where lead_id=$1',[saved])).rows[0];
    assert.equal(row.provider_message_id,'mock-id'); assert.ok(row.accepted_at); assert.equal(row.attempt_count,1);
  });
  await check('real handler saves before mocked email; failed email preserves lead and attempt state', async () => {
    for (const type of ['website','review']) {
      let emails=0;
      const input=lead({type,noWebsite:true});
      const send=createLeadHandler({store,apiKey:'test',from,allow:()=>true,fetcher:async()=>{
        emails++;
        assert.equal((await pool.query('select count(*)::int n from public.marketing_leads where submission_id=$1',[input.submissionId])).rows[0].n,1);
        return Response.json({name:'private user data'}, {status:503});
      }});
      assert.deepEqual(await (await send(request(input))).json(),{accepted:true,recorded:true});
      assert.deepEqual(await (await send(request(input))).json(),{accepted:true,recorded:true});
      assert.equal(emails,1,'Backoff suppresses immediate retries');
      const row=(await pool.query('select n.* from private.marketing_lead_notifications n join public.marketing_leads l on l.id=n.lead_id where l.submission_id=$1',[input.submissionId])).rows[0];
      assert.equal(row.state,'retryable'); assert.equal(row.error_code,'provider_unavailable'); assert.equal(row.last_http_status,503);
      assert.ok(row.last_attempt_at); assert.equal(row.attempt_count,1);
      await pool.query("update private.marketing_lead_notifications set next_attempt_at=now()-interval '1 second' where id=$1",[row.id]);
      const recovery=await store.claim(row.lead_id);
      assert.ok(recovery); assert.equal(recovery.lead.submissionId,input.submissionId);
      await store.complete(recovery,{state:'accepted',providerId:'mock-recovered',errorCode:null,httpStatus:200});
      assert.equal((await pool.query('select count(*)::int n from private.marketing_lead_notification_attempts where notification_id=$1',[row.id])).rows[0].n,2);
    }
  });
  await check('handler database failure and invalid submission cannot acknowledge or send', async () => {
    const before=await count(); let sends=0;
    const send=createLeadHandler({store,apiKey:'test',from,allow:()=>true,fetcher:async()=>{sends++;return Response.json({id:'unexpected'});}});
    assert.equal((await send(request({...lead(),email:'bad'}))).status,400);
    const broken=createLeadHandler({store:{...store,persist:async()=>{throw Error('private data');}},apiKey:'test',from});
    const response=await broken(request(lead()));
    assert.equal(response.status,503); assert.doesNotMatch(await response.text(),/private|recorded|accepted/);
    assert.equal(await count(),before); assert.equal(sends,0);
  });
  await check('expired lease recovers; old attempt cannot complete; >23h ambiguity parks without resend', async () => {
    const id=await store.persist(lead(),context,from);
    const first=await store.claim(id);
    await pool.query("update private.marketing_lead_notifications set lease_expires_at=now()-interval '1 second' where lead_id=$1",[id]);
    const second=await store.claim(id); assert.ok(second); assert.notEqual(second.token,first.token);
    await assert.rejects(store.complete(first,{state:'accepted',providerId:'stale',errorCode:null,httpStatus:200}));
    await pool.query("update private.marketing_lead_notifications set lease_expires_at=now()-interval '1 second',first_attempt_at=now()-interval '24 hours' where lead_id=$1",[id]);
    assert.equal(await store.claim(id),null);
    assert.equal((await pool.query('select state from private.marketing_lead_notifications where lead_id=$1',[id])).rows[0].state,'unknown');
  });
  await check('anon/authenticated lack SELECT/INSERT/UPDATE/DELETE and RPC execution; RLS also denies rows', async () => {
    const client=await pool.connect();
    try {
      for(const role of ['anon','authenticated']) {
        for(const sql of ['select * from public.marketing_leads','delete from public.marketing_leads',"update public.marketing_leads set status='won'",'insert into public.marketing_leads default values',
          'select * from private.marketing_lead_notifications','select * from private.marketing_lead_notification_attempts',
          'select public.claim_marketing_lead_notification_v1(null)',
          'select public.record_marketing_lead_v1(null,null,null,null,null)',
          'select public.complete_marketing_lead_notification_v1(null,null,null,null,null,null)']) {
          await client.query('begin'); await client.query(`set local role ${role}`);
          await assert.rejects(client.query(sql),error=>error.code==='42501'); await client.query('rollback');
        }
        // Defense in depth: an accidental future table grant must not expose rows.
        await client.query(`grant select on public.marketing_leads to ${role}`);
        await client.query('begin'); await client.query(`set local role ${role}`);
        assert.equal((await client.query('select count(*)::int n from public.marketing_leads')).rows[0].n,0);
        await client.query('rollback'); await client.query(`revoke select on public.marketing_leads from ${role}`);
      }
      assert.equal((await client.query('select count(*)::int n from public.existing_release_sentinel')).rows[0].n,1);
    } finally { await client.query('rollback'); client.release(); }
  });
  await check('additive migration also supports an existing private schema without changing its privileges', async () => {
    await pool.query('create database staging_shape');
    const client=new pg.Client({host:'127.0.0.1',port,user:'postgres',database:'staging_shape'});
    await client.connect();
    try {
      await client.query(`create schema private; grant usage on schema private to authenticated;
        create table private.existing_staging_sentinel(id integer); grant select on private.existing_staging_sentinel to authenticated;`);
      const before=(await client.query("select nspacl::text acl from pg_namespace where nspname='private'")).rows[0].acl;
      await client.query(await readFile(new URL('../supabase/migrations/20261022070256_marketing_lead_capture_v1.sql', import.meta.url),'utf8'));
      assert.equal((await client.query("select nspacl::text acl from pg_namespace where nspname='private'")).rows[0].acl,before);
      assert.equal((await client.query("select has_table_privilege('authenticated','private.existing_staging_sentinel','SELECT') allowed")).rows[0].allowed,true);
      assert.equal((await client.query("select has_table_privilege('authenticated','private.marketing_lead_notifications','SELECT') allowed")).rows[0].allowed,false);
    } finally {await client.end();}
  });
  if (process.argv.includes('--ops') || process.argv.includes('--ops-browser')) {
    const { runOpsChecks } = await import('./qa/ops-owner-inbox.mjs');
    await runOpsChecks({ pool, store, lead, from, context, dir, browser: process.argv.includes('--ops-browser') });
  }
  console.log(`PASS ${checks} lead-capture PostgreSQL 17 rehearsal groups; local synthetic data only. Cluster output: ${dir}`);
} finally {
  if(pool) await pool.end();
  if(started) run('pg_ctl',['-D',dataDir,'-m','fast','-w','stop']);
}
