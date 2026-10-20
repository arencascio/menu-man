import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { TENANT, targetConfig, verifyBranch, safeFailure } from './super-tacos-db-target.mjs';

const root = new URL('../', import.meta.url);
const source = value => createHash('sha256').update(value).digest('hex');
const lockSql = `select pg_advisory_xact_lock(hashtextextended('public-demo:' || $1::text,0))`;
const quotaSql = `select source_hash, window_start::text, creation_count
  from public.checkout_creation_windows where restaurant_id=$1 order by source_hash,window_start`;

export function makeRequest(pickupAt) {
  return { menuId: '20000000-0000-4000-8000-000000000002', items: [{
    menuItemId: '20000000-0000-4000-8000-000000000201', quantity: 1,
    modifierOptionIds: ['20000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000607'],
    specialInstructions: null,
  }], customer: { name: 'Synthetic Quota Guest', phone: null, email: null },
  pickup: { mode: 'scheduled', pickupAt }, tipChoice: 'none', customTipCents: null,
  largeTipConfirmed: false, largeTipConfirmedSubtotalCents: null, orderNotes: null };
}

async function snapshot(client) {
  // Include complete rows so a failed transaction cannot hide partial snapshots,
  // counters, or cleanup of old quota windows. Never print these rows.
  const tables = ['orders', 'order_items', 'order_item_modifiers', 'restaurant_order_counters',
    'checkout_creation_windows', 'notification_outbox', 'payment_attempts', 'pickup_slot_reservations'];
  const result = {};
  for (const table of tables) {
    // Table names are a fixed internal allowlist. The fresh fixture is the only tenant.
    result[table] = (await client.query(`select coalesce(jsonb_agg(row_data order by row_data::text),'[]') as rows
      from (select to_jsonb(t) row_data from public.${table} t) data`)).rows[0].rows;
  }
  return result;
}

export function assertBoundary(results) {
  assert.equal(results.filter(result => result.ok).length, 1, 'Exactly one boundary request must commit');
  const failures = results.filter(result => !result.ok);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].error.code, 'P0001');
  assert.match(failures[0].error.message, /^MM_CHECKOUT_RATE_LIMITED\|/);
}

// The observer owns the demo lock before either worker starts. We release it only
// after pg_stat_activity proves both independent worker backends are waiting.
// The short polling interval is for observing a condition, not delaying a click/query.
export async function concurrentBoundary(observer, workers, operation) {
  await observer.query('begin');
  let pending = [];
  try {
    await observer.query(lockSql, [TENANT]);
    const pids = await Promise.all(workers.map(async client =>
      (await client.query('select pg_backend_pid() pid')).rows[0].pid));
    assert.equal(new Set(pids).size, 2);
    pending = workers.map((client, i) => operation(client, i).then(
      value => ({ ok: true, value }), error => ({ ok: false, error })));
    const deadline = performance.now() + 1200;
    let blocked = false;
    while (performance.now() < deadline) {
      await observer.query('select pg_stat_clear_snapshot()');
      const state = await observer.query(`select count(*)::int n from pg_stat_activity
        where pid=any($1::int[]) and wait_event_type='Lock' and wait_event='advisory'`, [pids]);
      if (state.rows[0].n === 2) { blocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.ok(blocked, 'Both worker sessions must demonstrably contend on the demo lock');
  } finally {
    // Release even when the barrier assertion fails, then drain in-flight work.
    try { await observer.query('rollback'); } finally { await Promise.all(pending); }
  }
  const results = await Promise.all(pending);
  assertBoundary(results);
  return results;
}

export async function run(env = process.env) {
  let checkpoint = 'branch-target';
  const clients = [];
  const check = async (name, action) => {
    checkpoint = name;
    await action();
    console.log(`PASS ${name}`);
  };
  try {
    const config = targetConfig(env);
    // No DB client is instantiated until positive live branch inventory evidence.
    await verifyBranch(config);
    for (let i = 0; i < 3; i++) {
      const client = new pg.Client(config.database);
      clients.push(client);
      client.on('error', () => { /* Query failures are reported by checkpoint only. */ });
      await client.connect();
      const identity = (await client.query(`select current_database() db, session_user who,
        (select ssl from pg_stat_ssl where pid=pg_backend_pid()) tls`)).rows[0];
      assert.deepEqual(identity, { db: 'postgres', who: 'postgres', tls: true });
    }
    const [observer, ...workers] = clients;
    await check('schema-and-fresh-branch', async () => {
      const names = await readdir(new URL('supabase/migrations/', root));
      const expected = names.filter(name => /^\d+_.+\.sql$/.test(name)).map(name => name.split('_')[0]).sort();
      const recorded = (await observer.query('select version from supabase_migrations.schema_migrations order by version'))
        .rows.map(row => row.version);
      assert.deepEqual(recorded, expected, 'Branch must have this checkout schema, not a partial migration stack');
      assert.equal((await observer.query('select pg_try_advisory_lock(20000000,26) acquired')).rows[0].acquired, true);
      // Fresh setup is deliberately single-use; no destructive reset/cleanup path.
      await observer.query('begin');
      try {
        await observer.query(`select set_config('menu_man.isolated_branch',$1,true),
          set_config('menu_man.isolated_host',$2,true),set_config('menu_man.isolated_approval',$3,true)`,
        [config.ref, config.database.host, config.approval]);
        await observer.query(await readFile(new URL('supabase/qa/super-tacos-isolated-fixture.sql', root), 'utf8'));
        await observer.query(await readFile(new URL('supabase/qa/super-tacos-demo-protection.sql', root), 'utf8'));
        await observer.query('commit');
      } catch (error) { await observer.query('rollback'); throw error; }
      for (const worker of workers) await worker.query('set role service_role');
      const privileges = (await observer.query(`select
        has_function_privilege('anon','public.create_demo_order_v1(text,text,jsonb,text)','execute') anon,
        has_function_privilege('authenticated','public.create_demo_order_v1(text,text,jsonb,text)','execute') authenticated,
        has_function_privilege('service_role','public.create_demo_order_v1(text,text,jsonb,text)','execute') service`)).rows[0];
      assert.deepEqual(privileges, { anon: false, authenticated: false, service: true });
    });
    let windowStart;
    await check('stable-quota-window', async () => {
      const timing = (await observer.query(`select date_bin('10 minutes',clock_timestamp(),'2000-01-01'::timestamptz)::text start,
        extract(epoch from date_bin('10 minutes',clock_timestamp(),'2000-01-01'::timestamptz)+interval '10 minutes'-clock_timestamp())::float remaining`)).rows[0];
      assert.ok(timing.remaining >= 120, 'Wait until next quota window, then use a fresh branch');
      windowStart = timing.start;
    });
    const assertWindow = async () => assert.equal((await observer.query(`select
      date_bin('10 minutes',clock_timestamp(),'2000-01-01'::timestamptz)::text start`)).rows[0].start, windowStart);
    checkpoint = 'scheduled-slot-selection';
    const availability = (await workers[0].query("select public.get_pickup_availability_v1('super-tacos') data")).rows[0].data;
    // Choose a future slot safely beyond test duration, rather than today's first
    // slot which could become unavailable while the concurrency checks run.
    const slot = availability.scheduled?.slots?.find(candidate => Date.parse(candidate.pickupAt) > Date.now() + 3600000);
    assert.ok(slot, 'Fixture must expose a scheduled slot at least an hour ahead');
    const request = makeRequest(slot.pickupAt);
    const call = async (client, hash, key = randomUUID(), payload = request) => {
      const result = await client.query("select public.create_demo_order_v1('super-tacos',$1,$2::jsonb,$3) data", [key, payload, hash]);
      return { ...result.rows[0].data, key };
    };
    const unchangedOnError = async (operation, pattern, code = 'P0001') => {
      const before = await snapshot(observer);
      await assert.rejects(operation, error => error.code === code && pattern.test(error.message));
      assert.deepEqual(await snapshot(observer), before);
      await assertWindow();
    };
    const hash = source('source-boundary');
    let first;
    await check('canonical-failure-rolls-back-both-quotas', async () => {
      const invalid = structuredClone(request);
      invalid.items[0].menuItemId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      await unchangedOnError(() => call(workers[0], hash, randomUUID(), invalid), /^MM_ITEM_NOT_ON_MENU\|/);
    });
    await check('explicit-transaction-rollback', async () => {
      const before = await snapshot(observer);
      await workers[0].query('begin');
      try { await call(workers[0], hash); } finally { await workers[0].query('rollback'); }
      assert.deepEqual(await snapshot(observer), before);
    });
    await check('five-per-source-concurrent-boundary', async () => {
      for (let i = 0; i < 4; i++) {
        const order = await call(workers[0], hash);
        first ??= order;
      }
      await concurrentBoundary(observer, workers, client => call(client, hash));
      const counters = (await observer.query(quotaSql, [TENANT])).rows;
      assert.deepEqual(counters.map(row => row.creation_count), [5, 5]);
      assert.equal((await observer.query('select count(*)::int n from public.orders')).rows[0].n, 5);
      await unchangedOnError(() => call(workers[0], hash), /^MM_CHECKOUT_RATE_LIMITED\|/);
    });
    const replay = async () => {
      const before = await snapshot(observer);
      const result = await call(workers[0], hash, first.key);
      assert.equal(result.orderId, first.orderId);
      assert.equal(result.replayed, true);
      assert.deepEqual(await snapshot(observer), before);
    };
    await check('exact-replay-at-source-exhaustion', replay);
    await check('lock-timeout-fails-closed', async () => {
      await observer.query('begin');
      try {
        await observer.query(lockSql, [TENANT]);
        const started = performance.now();
        await unchangedOnError(() => call(workers[0], source('timeout')), /lock timeout/, '55P03');
        assert.ok(performance.now() - started >= 1500, 'Must hit actual server lock timeout');
      } finally { await observer.query('rollback'); }
    });
    await check('fifty-per-tenant-concurrent-boundary', async () => {
      // Real accepted orders fill the quota; no direct seeding/reset of counters.
      for (let i = 0; i < 44; i++) {
        await assertWindow();
        await call(workers[0], source(`tenant-fill-${i}`));
      }
      await concurrentBoundary(observer, workers, (client, i) => call(client, source(`tenant-edge-${i}`)));
      await assertWindow();
      assert.equal((await observer.query('select count(*)::int n from public.orders')).rows[0].n, 50);
      const global = (await observer.query(quotaSql, [TENANT])).rows.find(row => row.source_hash === '0'.repeat(64));
      assert.equal(global.creation_count, 50);
      const allCounters = (await observer.query(quotaSql, [TENANT])).rows;
      assert.equal(allCounters.filter(row => row.source_hash !== '0'.repeat(64))
        .reduce((sum, row) => sum + row.creation_count, 0), 50);
      // A fresh source increments its counter before hitting the global rejection:
      // verify that new row and every other write disappear with the failed call.
      await unchangedOnError(() => call(workers[0], source('global-rejected')), /^MM_CHECKOUT_RATE_LIMITED\|/);
    });
    await check('exact-replay-at-tenant-exhaustion', replay);
    await check('no-notifications-or-payment-work', async () => {
      for (const table of ['notification_outbox', 'payment_attempts', 'restaurant_payment_connections']) {
        assert.equal((await observer.query(`select count(*)::int n from public.${table}`)).rows[0].n, 0);
      }
      assert.equal((await observer.query("select count(*)::int n from public.orders where order_status <> 'pending_payment' or payment_status <> 'unpaid'")).rows[0].n, 0);
    });
    console.log('PASS isolated database suite. Discard this branch; retained synthetic unpaid orders: 50.');
    return true;
  } catch (error) {
    console.error(safeFailure(checkpoint, error));
    return false;
  } finally {
    await Promise.allSettled(clients.map(client => client.end()));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await run() ? 0 : 1;
}
