import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createLeadStore } from '../../src/lib/marketing-leads/persistence.ts';
import { detailSchema, inboxSchema } from '../../src/lib/ops/contracts.ts';
import { mutateOpsLead } from '../../src/lib/ops/actions.ts';

export const opsFunctions = {
  get_ops_access_v1: [], list_ops_leads_v1: ['p_view','p_status','p_type','p_sort','p_page'], get_ops_lead_v1: ['p_lead_id'],
  update_ops_lead_v1: ['p_lead_id','p_revision','p_status','p_notes','p_follow_up_at'], claim_ops_lead_notification_v1: ['p_lead_id'],
  complete_ops_lead_notification_v1: ['p_notification_id','p_token','p_state','p_provider_id','p_error_code','p_http_status'],
};
export async function runOpsChecks({pool,store,lead,from,context,dir,browser}) {
  assert.equal(pool.options.host,'127.0.0.1');
  assert.equal((await pool.query("select current_setting('server_version_num')::int/10000 major")).rows[0].major,17);
  // Minimal Auth contract fixture, not a replacement Auth implementation.
  await pool.query(`create schema auth; create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id));
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;`);
  await pool.query(await readFile(new URL('../../supabase/migrations/20261022073652_ops_owner_lead_inbox_v1.sql',import.meta.url),'utf8'));
  const owner=randomUUID(), other=randomUUID(), session=randomUUID(), otherSession=randomUUID();
  await pool.query('insert into auth.users values($1),($2)',[owner,other]);
  await pool.query('insert into auth.sessions values($1,$2),($3,$4)',[session,owner,otherSession,other]);
  const claims={sub:owner,session_id:session,aal:'aal2',role:'authenticated'};
  async function rpc(name,args={},identity=claims,role='authenticated') {
    const keys=opsFunctions[name]; assert.ok(keys);
    const client=await pool.connect();
    try {
      await client.query('begin'); await client.query(`set local role ${role==='anon'?'anon':'authenticated'}`);
      await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(identity)]);
      const result=await client.query(`select public.${name}(${keys.map((_,i)=>`$${i+1}`).join(',')}) result`,keys.map(key=>args[key]));
      await client.query('commit'); return result.rows[0].result;
    } catch(error) {await client.query('rollback');throw error;} finally {client.release();}
  }
  const listArgs={p_view:'open',p_status:'all',p_type:'all',p_sort:'newest',p_page:1};
  const notifications=createLeadStore(async(name,args)=>{
    const mapped=name==='claim_marketing_lead_notification_v1'?'claim_ops_lead_notification_v1':name==='complete_marketing_lead_notification_v1'?'complete_ops_lead_notification_v1':null;
    assert.ok(mapped);
    try {return {data:await rpc(mapped,args),error:null};} catch(error) {return {data:null,error:{message:error.message}};}
  });
  let checks=0;
  const check=async(name,fn)=>{await fn();checks++;console.log(`PASS ops ${name}`);};
  await check('empty allowlist, unauthenticated, non-owner and AAL1 fail closed',async()=>{
    assert.equal(await rpc('get_ops_access_v1'), 'denied');
    await pool.query('insert into private.ops_owners(user_id) values($1)',[owner]);
    assert.equal(await rpc('get_ops_access_v1',{}, {...claims,sub:other,session_id:otherSession}),'denied');
    assert.equal(await rpc('get_ops_access_v1',{}, {...claims,aal:'aal1'}),'mfa_required');
    for(const identity of [{},{...claims,sub:other,session_id:otherSession},{...claims,aal:'aal1'}]) {
      await assert.rejects(rpc('list_ops_leads_v1',listArgs,identity),error=>error.code==='42501');
      await assert.rejects(rpc('get_ops_lead_v1',{p_lead_id:randomUUID()},identity),error=>error.code==='42501');
      await assert.rejects(rpc('claim_ops_lead_notification_v1',{p_lead_id:randomUUID()},identity),error=>error.code==='42501');
    }
    await assert.rejects(rpc('get_ops_access_v1',{}, {},'anon'),error=>error.code==='42501');
  });
  let leadId;
  await check('authorized owner reads persisted leads and safe list/detail contracts',async()=>{
    leadId=await store.persist(lead({restaurantName:'Inbox Synthetic Restaurant',name:'Synthetic Owner'}),context,from);
    const list=inboxSchema.parse(await rpc('list_ops_leads_v1',listArgs));
    assert.ok(list.items.some(x=>x.id===leadId));
    const detail=detailSchema.parse(await rpc('get_ops_lead_v1',{p_lead_id:leadId}));
    assert.equal(detail.details.restaurantName,'Inbox Synthetic Restaurant');assert.equal(detail.status,'new');
    assert.equal('email' in list.items[0],false);
  });
  await check('status/notes/follow-up persist with optimistic revision and non-PII audit metadata',async()=>{
    const args={p_lead_id:leadId,p_revision:1,p_status:'contacted',p_notes:'Synthetic internal note',p_follow_up_at:'2026-01-01T12:00:00Z'};
    await rpc('update_ops_lead_v1',args);
    const detail=detailSchema.parse(await rpc('get_ops_lead_v1',{p_lead_id:leadId}));
    assert.equal(detail.notes,args.p_notes);assert.equal(detail.status,'contacted');assert.equal(detail.revision,2);assert.ok(detail.lastContactedAt);
    assert.equal(Date.parse(detail.followUpAt),Date.parse(args.p_follow_up_at));
    await assert.rejects(rpc('update_ops_lead_v1',args),/MM_OPS_CONFLICT/);
    await assert.rejects(rpc('update_ops_lead_v1',{...args,p_revision:2,p_status:'invalid'}),/MM_OPS_INVALID/);
    const activity=(await pool.query('select * from private.marketing_lead_activity where lead_id=$1',[leadId])).rows;
    assert.equal(activity.length,1);assert.equal(activity[0].actor_id,owner);assert.doesNotMatch(JSON.stringify(activity[0].changes),/Synthetic internal note/);
    const due=inboxSchema.parse(await rpc('list_ops_leads_v1',{...listArgs,p_view:'due'}));
    assert.ok(due.items.some(x=>x.id===leadId));
    await rpc('update_ops_lead_v1',{...args,p_revision:2,p_status:'won'});
    assert.equal((await rpc('list_ops_leads_v1',{...listArgs,p_view:'due'})).items.some(x=>x.id===leadId),false);
    await rpc('update_ops_lead_v1',{...args,p_revision:3,p_status:'waiting',p_follow_up_at:null});
    assert.equal((await rpc('get_ops_lead_v1',{p_lead_id:leadId})).followUpAt,null);
  });
  let failedId;
  await check('failed email is visible independent of Resend and eligible owner retry is exclusive',async()=>{
    const input=lead({restaurantName:'Failed Notification Synthetic'});
    failedId=await store.persist(input,context,from);
    const claim=await store.claim(failedId);
    await store.complete(claim,{state:'failed',providerId:null,errorCode:'provider_rejected',httpStatus:403});
    let detail=detailSchema.parse(await rpc('get_ops_lead_v1',{p_lead_id:failedId}));
    assert.equal(detail.notification.state,'failed');assert.equal(detail.attempts.length,1);
    assert.ok((await rpc('list_ops_leads_v1',{...listArgs,p_view:'notifications'})).items.some(x=>x.id===failedId));
    await pool.query("update private.marketing_lead_notifications set next_attempt_at=now()-interval '1 second' where lead_id=$1",[failedId]);
    let emails=0;
    const options={notifications,update:async()=>{},apiKey:'mock-only',fetcher:async(_url,init)=>{
      emails++;assert.equal(new Headers(init.headers).get('Idempotency-Key'),`marketing-lead/${input.submissionId}`);
      return Response.json({name:'mock-failure'},{status:503});
    }};
    const results=await Promise.allSettled([mutateOpsLead(failedId,{action:'retry'},options),mutateOpsLead(failedId,{action:'retry'},options)]);
    assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(emails,1);
    await assert.rejects(mutateOpsLead(failedId,{action:'retry'},options));assert.equal(emails,1);
    for(let attempt=3;attempt<=5;attempt++) {
      await pool.query("update private.marketing_lead_notifications set next_attempt_at=now()-interval '1 second' where lead_id=$1",[failedId]);
      await mutateOpsLead(failedId,{action:'retry'},options);
    }
    await pool.query("update private.marketing_lead_notifications set next_attempt_at=now()-interval '1 second' where lead_id=$1",[failedId]);
    await assert.rejects(mutateOpsLead(failedId,{action:'retry'},options));
    detail=detailSchema.parse(await rpc('get_ops_lead_v1',{p_lead_id:failedId}));
    assert.equal(detail.notification.attemptCount,5);assert.equal(detail.notification.retryEligible,false);assert.equal(emails,4);
  });
  await check('accepted, unknown, expired-window and missing-sender notifications cannot be retried',async()=>{
    for(const state of ['accepted','unknown','expired','sender']) {
      const id=await store.persist(lead(),context,state==='sender'?undefined:from);
      const claim=await store.claim(id);
      if(state==='accepted') await store.complete(claim,{state:'accepted',providerId:'mock-id',errorCode:null,httpStatus:200});
      else {
        await store.complete(claim,{state:'retryable',providerId:null,errorCode:'provider_unavailable',httpStatus:503});
        await pool.query("update private.marketing_lead_notifications set next_attempt_at=now()-interval '1 second' where lead_id=$1",[id]);
        if(state==='unknown') await pool.query("update private.marketing_lead_notifications set state='unknown' where lead_id=$1",[id]);
        if(state==='expired') await pool.query("update private.marketing_lead_notifications set first_attempt_at=now()-interval '24 hours' where lead_id=$1",[id]);
      }
      assert.equal(await rpc('claim_ops_lead_notification_v1',{p_lead_id:id}),null);
    }
  });
  await check('revocation and deleted Auth session immediately deny reads and writes',async()=>{
    await pool.query('update private.ops_owners set active=false where user_id=$1',[owner]);
    await assert.rejects(rpc('get_ops_lead_v1',{p_lead_id:leadId}),error=>error.code==='42501');
    await pool.query('update private.ops_owners set active=true where user_id=$1',[owner]);
    await pool.query('delete from auth.sessions where id=$1',[session]);
    await assert.rejects(rpc('list_ops_leads_v1',listArgs),error=>error.code==='42501');
    await pool.query('insert into auth.sessions values($1,$2)',[session,owner]);
    const nonowner={...claims,sub:other,session_id:otherSession};
    await assert.rejects(rpc('update_ops_lead_v1',{p_lead_id:leadId,p_revision:4,p_status:'spam',p_notes:'',p_follow_up_at:null},nonowner),error=>error.code==='42501');
  });
  await check('new private data remains inaccessible directly even to owner or service role',async()=>{
    for(const role of ['anon','authenticated','service_role']) {
      for(const table of ['private.ops_owners','private.marketing_lead_activity','public.marketing_leads','private.marketing_lead_notifications']) {
        const client=await pool.connect();
        try {
          await client.query('begin');await client.query(`set local role ${role}`);
          await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);
          await assert.rejects(client.query(`select * from ${table}`),error=>error.code==='42501');
          await client.query('rollback');
        } finally {await client.query('rollback');client.release();}
      }
    }
  });
  if(browser) {
    const { runOpsBrowser }=await import('./ops-owner-browser.mjs');
    await runOpsBrowser({pool,rpc,claims,other,otherSession,leadId,failedId,dir});
  }
  console.log(`PASS ${checks} owner-inbox PostgreSQL 17 groups`);
}
