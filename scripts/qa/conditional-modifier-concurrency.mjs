// Synthetic writes only. Requires the explicitly marked disposable PG17 cluster
// documented in docs/conditional-modifier-isolation-fix.md; never a hosted DB.
import pg from 'pg';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const { Client } = pg;

const unrepaired = process.argv.includes('--expect-unrepaired');
const database = unrepaired ? 'conditional_fix_unrepaired' : 'conditional_fix_candidate';
const output = path.resolve('.playwright/conditional-edit-fix');
const clients = [];
const results = [];
const config = {
  host: '127.0.0.1', port: 55448, user: 'conditional_fix_owner',
  database, ssl: false, application_name: 'conditional_modifier_integrity_regression',
};

async function connect() {
  const client = new Client(config);
  await client.connect();
  clients.push(client);
  const identity = (await client.query(`select pg_catalog.host(inet_server_addr()) host,
    inet_server_port() port, current_user role, current_database() db,
    current_setting('cluster_name') cluster, current_setting('data_directory') directory,
    current_setting('server_version_num')::int version`)).rows[0];
  assert.equal(identity.host, '127.0.0.1');
  assert.equal(identity.port, config.port);
  assert.equal(identity.role, config.user);
  assert.equal(identity.db, database);
  assert.equal(identity.cluster, 'menu_man_conditional_fix');
  assert.equal(path.resolve(identity.directory), path.join(output, 'data'));
  assert(identity.version >= 170000 && identity.version < 180000);
  await client.query("set statement_timeout = '12s'");
  return client;
}

async function fixture(client) {
  const f = Object.fromEntries(['tenant', 'menu', 'section', 'item', 'a', 'b', 'c',
    'child', 'oa', 'ob', 'oc', 'och'].map(key => [key, randomUUID()]));
  f.slug = `conditional-isolation-${randomUUID()}`;
  await client.query(`insert into public.restaurants(id,name,slug,currency,timezone)
    values($1,'Synthetic isolation fixture',$2,'USD','UTC')`, [f.tenant, f.slug]);
  await client.query(`insert into public.restaurant_ordering_settings(restaurant_id,
    pickup_enabled,asap_enabled,scheduled_pickup_enabled,advance_order_days,tax_strategy,tax_rate_basis_points)
    values($1,true,true,true,2,'restaurant_percentage',0)`, [f.tenant]);
  await client.query(`insert into public.restaurant_business_hours(restaurant_id,day_of_week,open_time,close_time)
    select $1,day,'00:00'::time,'23:59'::time from generate_series(0,6) day`, [f.tenant]);
  await client.query("insert into public.menus(id,restaurant_id,name,is_published) values($1,$2,'Synthetic',true)", [f.menu, f.tenant]);
  await client.query("insert into public.menu_sections(id,menu_id,name) values($1,$2,'Synthetic')", [f.section, f.menu]);
  await client.query(`insert into public.menu_items(id,restaurant_id,name,price_cents,is_orderable)
    values($1,$2,'Synthetic dish',1000,true)`, [f.item, f.tenant]);
  await client.query('insert into public.menu_section_items(section_id,item_id) values($1,$2)', [f.section, f.item]);
  for (const [group, option, name] of [[f.a, f.oa, 'A'], [f.b, f.ob, 'B'], [f.c, f.oc, 'C'], [f.child, f.och, 'Child']]) {
    await client.query('insert into public.modifier_groups(id,restaurant_id,name) values($1,$2,$3)', [group, f.tenant, name]);
    await client.query(`insert into public.modifier_options(id,restaurant_id,modifier_group_id,name,default_price_adjustment_cents)
      values($1,$2,$3,$4,$5)`, [option, f.tenant, group, name, group === f.child ? 50 : 0]);
  }
  for (const group of [f.a, f.b, f.c]) await attach(client, f, group);
  return f;
}

function attach(client, f, group = f.child, parent = null, option = null) {
  return client.query(`insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,
    modifier_group_id,min_selections,max_selections,parent_modifier_group_id,parent_modifier_option_id)
    values($1,$2,$3,0,1,$4,$5)`, [f.tenant, f.item, group, parent, option]);
}

function reparent(client, f, group, parent, option) {
  return client.query(`update public.menu_item_modifier_groups set parent_modifier_group_id=$1,
    parent_modifier_option_id=$2 where menu_item_id=$3 and modifier_group_id=$4`, [parent, option, f.item, group]);
}

async function badRows(client, f) {
  return (await client.query(`select count(*)::int bad from public.menu_item_modifier_groups child
    left join public.menu_item_modifier_groups parent on parent.restaurant_id=child.restaurant_id
      and parent.menu_item_id=child.menu_item_id and parent.modifier_group_id=child.parent_modifier_group_id
    where child.menu_item_id=$1 and child.parent_modifier_group_id is not null
      and (parent.modifier_group_id is null or parent.parent_modifier_group_id is not null)`, [f.item])).rows[0].bad;
}

async function waitForLock(monitor, waiter, blocker) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const row = (await monitor.query(`select wait_event_type, pg_blocking_pids($1) blockers
      from pg_stat_activity where pid=$1`, [waiter])).rows[0];
    if (row?.wait_event_type === 'Lock' && row.blockers.includes(blocker)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error('Expected lock wait was not observed');
}

const outcome = promise => promise.then(result => ({ ok: true, rowCount: result.rowCount }))
  .catch(error => ({ ok: false, code: error.code, message: error.message }));
const requireError = (result, code) => { assert.equal(result.ok, false); assert.equal(result.code, code); };

async function run() {
  const monitor = await connect(), first = await connect(), second = await connect();
  const firstPid = (await first.query('select pg_backend_pid() pid')).rows[0].pid;
  const secondPid = (await second.query('select pg_backend_pid() pid')).rows[0].pid;
  const modes = unrepaired ? ['REPEATABLE READ'] : ['READ COMMITTED', 'READ UNCOMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'];
  for (const isolation of modes) {
    const f = await fixture(monitor);
    await first.query('begin');
    await second.query('begin isolation level ' + isolation);
    await second.query('select count(*) from public.menu_item_modifier_groups where menu_item_id=$1', [f.item]);
    await reparent(first, f, f.a, f.b, f.ob);
    const pending = outcome(reparent(second, f, f.b, f.a, f.oa));
    const snapshotMode = isolation === 'REPEATABLE READ' || isolation === 'SERIALIZABLE';
    if (!unrepaired && snapshotMode) {
      // Must fail before the item-lock wait; a lock timeout is not success.
      requireError(await pending, '0A000');
      await second.query('rollback');
      await first.query('commit');
    } else {
      await waitForLock(monitor, secondPid, firstPid);
      await first.query('commit');
      const result = await pending;
      if (unrepaired) { assert.equal(result.ok, true); await second.query('commit'); }
      else { requireError(result, 'P0001'); await second.query('rollback'); }
    }
    const invalid = await badRows(monitor, f);
    assert.equal(invalid, unrepaired ? 2 : 0);
    results.push({ test: 'competing cycle', isolation, invalidCommittedRows: invalid,
      result: unrepaired ? 'original defect reproduced' : snapshotMode ? '0A000 before lock wait' : 'second writer rejected after lock wait' });
  }
  if (unrepaired) return;

  for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE']) {
    const f = await fixture(monitor);
    await first.query('begin isolation level ' + isolation);
    await first.query('select count(*) from public.menu_item_modifier_groups');
    requireError(await outcome(attach(first, f, f.child, f.a, f.oa)), '0A000');
    await first.query('rollback');
    await first.query('begin isolation level ' + isolation);
    await first.query('update public.menu_item_modifier_groups set min_selections=0 where menu_item_id=$1', [f.item]);
    await attach(first, f);
    await first.query('commit');
    assert.equal(await badRows(monitor, f), 0);
    results.push({ test: 'conditional insert rejected; legitimate flat update/insert commits', isolation });
    await first.query('begin isolation level ' + isolation);
    await second.query('begin isolation level ' + isolation);
    await first.query('select count(*) from public.menu_item_modifier_groups');
    await second.query('select count(*) from public.menu_item_modifier_groups');
    const rejected = await Promise.all([
      outcome(reparent(first, f, f.a, f.b, f.ob)),
      outcome(reparent(second, f, f.b, f.a, f.oa)),
    ]);
    for (const result of rejected) requireError(result, '0A000');
    await first.query('rollback'); await second.query('rollback');
    assert.equal(await badRows(monitor, f), 0);
    results.push({ test: 'both snapshot-isolation writers fail closed', isolation });
  }

  // Independent conditional edits on the same item serialize and both succeed.
  {
    const f = await fixture(monitor);
    await first.query('begin'); await second.query('begin');
    await reparent(first, f, f.a, f.c, f.oc);
    const pending = outcome(reparent(second, f, f.b, f.c, f.oc));
    await waitForLock(monitor, secondPid, firstPid);
    await first.query('commit'); assert.equal((await pending).ok, true); await second.query('commit');
    assert.equal(await badRows(monitor, f), 0);
    results.push({ test: 'independent edges to one root both commit', isolation: 'READ COMMITTED' });
  }
  {
    const f = await fixture(monitor), other = await fixture(monitor);
    await first.query('begin'); await reparent(first, f, f.a, f.b, f.ob);
    await second.query('begin'); await reparent(second, other, other.a, other.b, other.ob);
    await second.query('commit'); // Completes while the unrelated first item is locked.
    await first.query('commit');
    assert.equal(await badRows(monitor, f), 0); assert.equal(await badRows(monitor, other), 0);
    results.push({ test: 'different-item edits both commit without global lock' });
  }
  {
    const f = await fixture(monitor), other = await fixture(monitor);
    requireError(await outcome(reparent(monitor, f, f.a, f.a, f.oa)), '23514');
    await reparent(monitor, f, f.a, f.b, f.ob);
    requireError(await outcome(reparent(monitor, f, f.c, f.a, f.oa)), 'P0001');
    requireError(await outcome(reparent(monitor, f, f.c, other.a, other.oa)), 'P0001');
    requireError(await outcome(attach(monitor, f, other.child)), '23503');
    requireError(await outcome(reparent(monitor, f, f.c, f.b, f.oa)), '23503');
    assert.equal(await badRows(monitor, f), 0);
    results.push({ test: 'self-cycle, excessive depth, foreign parent/group and wrong-group option rejected' });
  }
  {
    const f = await fixture(monitor);
    requireError(await outcome(monitor.query(`update public.menu_item_modifier_groups
      set parent_modifier_group_id=case when modifier_group_id=$1 then $2::uuid else $1::uuid end,
          parent_modifier_option_id=case when modifier_group_id=$1 then $3::uuid else $4::uuid end
      where menu_item_id=$5 and modifier_group_id in ($1,$2)`, [f.a, f.b, f.ob, f.oa, f.item])), 'P0001');
    assert.equal(await badRows(monitor, f), 0);
    results.push({ test: 'single-statement multi-row cycle rolls back' });
  }
  {
    const f = await fixture(monitor);
    await first.query('begin'); await second.query('begin');
    await attach(first, f, f.child, f.a, f.oa);
    const pending = outcome(attach(second, f, f.child, f.a, f.oa));
    await waitForLock(monitor, secondPid, firstPid); await first.query('commit');
    requireError(await pending, '23505'); await second.query('rollback');
    assert.equal(await badRows(monitor, f), 0);
    results.push({ test: 'concurrent duplicate child attachment rejects second writer' });
  }
  {
    const f = await fixture(monitor);
    await first.query('begin'); await second.query('begin');
    await first.query('delete from public.modifier_options where id=$1', [f.oa]);
    const pending = outcome(attach(second, f, f.child, f.a, f.oa));
    await waitForLock(monitor, secondPid, firstPid); await first.query('commit');
    requireError(await pending, '23503'); await second.query('rollback');
    assert.equal(await badRows(monitor, f), 0);
    results.push({ test: 'parent-option deletion vs child insertion leaves no orphan' });
  }
  {
    const f = await fixture(monitor); await attach(monitor, f, f.child, f.a, f.oa);
    await first.query('begin'); await second.query('begin');
    await first.query('delete from public.menu_item_modifier_groups where menu_item_id=$1 and modifier_group_id=$2', [f.item, f.a]);
    const pending = outcome(reparent(second, f, f.child, f.b, f.ob));
    await waitForLock(monitor, secondPid, firstPid); await first.query('commit');
    assert.equal((await pending).rowCount, 0); await second.query('commit');
    assert.equal(await badRows(monitor, f), 0);
    results.push({ test: 'parent deletion cascade vs child reparent leaves no orphan' });
  }
  {
    const f = await fixture(monitor); await attach(monitor, f, f.child, f.a, f.oa);
    const availability = (await monitor.query('select public.get_pickup_availability_v1($1,clock_timestamp()) v', [f.slug])).rows[0].v;
    const slot = availability.scheduled.slots.find(entry => Date.parse(entry.pickupAt) > Date.now() + 7200000);
    assert(slot);
    const request = { menuId: f.menu, items: [{ menuItemId: f.item, quantity: 2, modifierOptionIds: [f.oa, f.och], specialInstructions: null }],
      customer: { name: 'Synthetic Guest', phone: '(951) 555-0100', email: 'isolation@example.invalid' },
      pickup: { mode: 'scheduled', pickupAt: slot.pickupAt }, tipChoice: 'none', orderNotes: null };
    const key = randomUUID();
    const checkout = (id, body) => second.query('select public.create_order_v1($1,$2,$3::jsonb) result', [f.slug, id, JSON.stringify(body)]);
    await second.query('set role service_role');
    const order = (await checkout(key, request)).rows[0].result; assert.equal(order.subtotalCents, 2100);
    await reparent(first, f, f.child, f.b, f.ob);
    const before = (await monitor.query('select count(*)::int n from public.orders where restaurant_id=$1', [f.tenant])).rows[0].n;
    const number = (await monitor.query('select last_order_number::text n from public.restaurant_order_counters where restaurant_id=$1', [f.tenant])).rows[0].n;
    const stale = await outcome(checkout(randomUUID(), request)); requireError(stale, 'P0001'); assert(stale.message.startsWith('MM_INVALID_MODIFIERS|'));
    assert.equal((await monitor.query('select count(*)::int n from public.orders where restaurant_id=$1', [f.tenant])).rows[0].n, before);
    assert.equal((await monitor.query('select last_order_number::text n from public.restaurant_order_counters where restaurant_id=$1', [f.tenant])).rows[0].n, number);
    const replay = (await checkout(key, request)).rows[0].result; assert.equal(replay.orderId, order.orderId); assert.equal(replay.subtotalCents, 2100); assert.equal(replay.replayed, true);
    const fresh = structuredClone(request); fresh.items[0].modifierOptionIds = [f.ob, f.och];
    assert.equal((await checkout(randomUUID(), fresh)).rows[0].result.subtotalCents, 2100);
    await second.query('reset role');
    results.push({ test: 'committed edit rejects stale checkout without order/counter mutation; exact replay and fresh selection retain authoritative pricing' });
  }
  const invalid = (await monitor.query(`select count(*)::int bad from public.menu_item_modifier_groups child
    join public.menu_item_modifier_groups parent on parent.restaurant_id=child.restaurant_id
      and parent.menu_item_id=child.menu_item_id and parent.modifier_group_id=child.parent_modifier_group_id
    where parent.parent_modifier_group_id is not null`)).rows[0].bad;
  assert.equal(invalid, 0);
}

run().then(() => {
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, unrepaired ? 'original-reproduction.json' : 'repaired-regressions.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ passed: results.length, unrepaired, results }, null, 2));
}).catch(error => {
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: error.message, completed: results }, null, 2));
  console.error(error); process.exitCode = 1;
}).finally(async () => {
  for (const client of clients) { await client.query('rollback').catch(() => {}); await client.end(); }
});
