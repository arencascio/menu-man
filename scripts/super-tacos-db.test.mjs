// Offline harness tests only: never instantiate a DB client or contact Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { STAGING, PRODUCTION, targetConfig, assertBranchInventory, verifyBranch, safeFailure } from './super-tacos-db-target.mjs';
import { assertBoundary, concurrentBoundary, makeRequest } from './test-super-tacos-db.mjs';

const ref = 'abcdefghijklmnopqrst';
const env = () => ({ QA_DEMO_BRANCH_REF: ref, QA_DEMO_BRANCH_CONFIRM: `disposable-super-tacos:${ref}`,
  QA_DEMO_DATABASE_URL: `postgresql://postgres:synthetic-password@db.${ref}.supabase.co:5432/postgres`,
  QA_DEMO_MANAGEMENT_TOKEN: 'synthetic-management-token' });
const branch = () => ({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', project_ref: ref,
  parent_project_ref: STAGING, is_default: false, persistent: false, with_data: false,
  preview_project_status: 'ACTIVE_HEALTHY' });

test('only explicit direct TLS branch configuration is accepted; inherited PG options cannot route it', () => {
  const result = targetConfig({ ...env(), PGHOST: `db.${PRODUCTION}.supabase.co`, PGSSLMODE: 'disable',
    PGOPTIONS: '-c role=anon', PGSSLNEGOTIATION: 'direct' });
  assert.equal(result.database.host, `db.${ref}.supabase.co`);
  assert.equal(result.database.ssl.rejectUnauthorized, true);
  assert.equal(result.database.database, 'postgres');
  assert.equal(result.database.options, '-c statement_timeout=15000 -c lock_timeout=2000');
  assert.equal(result.database.sslnegotiation, 'postgres');
});

for (const forbidden of [STAGING, PRODUCTION]) {
  test(`rejects known shared project ${forbidden} before any network activity`, () => {
    const value = env();
    value.QA_DEMO_BRANCH_REF = forbidden;
    value.QA_DEMO_BRANCH_CONFIRM = `disposable-super-tacos:${forbidden}`;
    value.QA_DEMO_DATABASE_URL = `postgresql://postgres:secret@db.${forbidden}.supabase.co/postgres`;
    assert.throws(() => targetConfig(value));
  });
}

for (const url of [
  `postgres://postgres:secret@db.${STAGING}.supabase.co/postgres`,
  `postgres://postgres:secret@db.${PRODUCTION}.supabase.co/postgres`,
  `postgres://postgres.${ref}:secret@aws-0-us-east-1.pooler.supabase.com/postgres`,
  'postgres://postgres:secret@localhost/postgres',
  `postgres://postgres:secret@db.${ref}.supabase.co.evil.invalid/postgres`,
  `postgres://postgres:secret@db.${ref}.supabase.co:6543/postgres`,
  `postgres://postgres:secret@db.${ref}.supabase.co/other`,
  `postgres://postgres:secret@db.${ref}.supabase.co/postgres?host=db.${STAGING}.supabase.co`,
  `postgres://postgres:secret@db.${ref}.supabase.co/postgres?sslmode=disable`,
  `postgres://postgres:secret@db.${ref}.supabase.co/postgres#ignored`,
]) {
  test(`rejects ambiguous/overridden target ${url.replace('secret', 'REDACTED')}`, () => {
    assert.throws(() => targetConfig({ ...env(), QA_DEMO_DATABASE_URL: url }));
  });
}

test('missing confirmation or inventory credential fails closed', () => {
  for (const field of ['QA_DEMO_BRANCH_REF', 'QA_DEMO_BRANCH_CONFIRM', 'QA_DEMO_MANAGEMENT_TOKEN', 'QA_DEMO_DATABASE_URL']) {
    const value = env(); delete value[field];
    assert.throws(() => targetConfig(value));
  }
});

test('live inventory must identify a single data-less nonpersistent nondefault child of Staging', () => {
  assertBranchInventory([branch()], ref);
  for (const change of [{ parent_project_ref: PRODUCTION }, { with_data: true }, { with_data: undefined },
    { persistent: true }, { is_default: true }, { preview_project_status: 'INACTIVE' },
    { project_ref: STAGING }, { deletion_scheduled_at: '2026-01-01' }, { id: undefined }]) {
    assert.throws(() => assertBranchInventory([{ ...branch(), ...change }], ref));
  }
  for (const rows of [null, {}, [], [branch(), branch()]]) {
    assert.throws(() => assertBranchInventory(rows, ref));
  }
});

test('inventory request is read-only, fixed to Staging parent, refuses redirects and authorization failures', async () => {
  const config = targetConfig(env());
  await verifyBranch(config, async (url, options) => {
    assert.equal(url, `https://api.supabase.com/v1/projects/${STAGING}/branches`);
    assert.equal(options.method, undefined); // Fetch defaults to GET.
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-management-token');
    return { ok: true, json: async () => [branch()] };
  });
  await assert.rejects(() => verifyBranch(config, async () => ({ ok: false })), /unavailable/);
  await assert.rejects(() => verifyBranch(config, async () => ({ ok: true, json: async () => ({}) })), /inventory/);
});

test('safe failure output cannot expose credentials, SQL, customer data, or order capabilities', () => {
  const output = safeFailure('quota-boundary', { code: 'P0001',
    message: env().QA_DEMO_DATABASE_URL, detail: 'private customer / order access token', stack: 'select secret' });
  assert.equal(output, 'FAIL quota-boundary; SQLSTATE=P0001. Stop; inspect privately and discard the test branch.');
  assert.match(safeFailure('target', { code: 'password-should-not-leak' }), /SQLSTATE=unavailable/);
});

test('boundary verifier rejects two successes, two failures, timeout and wrong business errors', () => {
  const denied = { ok: false, error: { code: 'P0001', message: 'MM_CHECKOUT_RATE_LIMITED|600' } };
  assertBoundary([{ ok: true }, denied]);
  for (const results of [[{ ok: true }, { ok: true }], [denied, denied],
    [{ ok: true }, { ok: false, error: { code: '55P03', message: 'lock timeout' } }],
    [{ ok: true }, { ok: false, error: { code: 'P0001', message: 'MM_ITEM_NOT_ON_MENU|invalid' } }]]) {
    assert.throws(() => assertBoundary(results));
  }
});

test('concurrency barrier observes distinct waiting sessions before releasing and drains work', async () => {
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const observer = { query: async sql => {
    events.push(sql);
    if (sql === 'rollback') release();
    return { rows: [{ n: 2 }] };
  } };
  const workers = [10, 11].map(pid => ({ query: async () => ({ rows: [{ pid }] }) }));
  const result = await concurrentBoundary(observer, workers, async (_, i) => {
    events.push(`worker-${i}`);
    await gate;
    if (i) throw { code: 'P0001', message: 'MM_CHECKOUT_RATE_LIMITED|600' };
    return { orderId: 'synthetic' };
  });
  assert.equal(result.length, 2);
  assert.ok(events.indexOf('worker-1') < events.indexOf('rollback'));
  assert.ok(events.findIndex(value => value.includes('pg_stat_activity')) < events.indexOf('rollback'));
  assert.ok(events.includes('select pg_stat_clear_snapshot()'));
});

test('concurrency barrier always releases the lock after a failed checkpoint', async () => {
  const events = [];
  const observer = { query: async sql => { events.push(sql); return { rows: [] }; } };
  const workers = [0, 1].map(() => ({ query: async () => ({ rows: [{ pid: 10 }] }) }));
  await assert.rejects(() => concurrentBoundary(observer, workers, async () => ({})));
  assert.equal(events.at(-1), 'rollback');
});

test('fixture remains synthetic, insert-only, rejects populated branches, and has only one orderable item', async () => {
  const sql = await readFile(new URL('../supabase/qa/super-tacos-isolated-fixture.sql', import.meta.url), 'utf8');
  assert.match(sql, /exists\(select 1 from auth.users\)/);
  for (const shared of [STAGING, PRODUCTION]) assert.ok(sql.includes(shared));
  assert.doesNotMatch(sql, /\b(update|delete|truncate|drop|grant|create function)\b/i);
  assert.equal((sql.match(/insert into public.menu_items\(/g) ?? []).length, 1);
  assert.doesNotMatch(sql, /insert into public\.(restaurant_payment_connections|orders|restaurant_memberships)/);
  assert.match(sql, /false,false,false,false,false,null/);
  const request = makeRequest('2030-01-01T12:00:00Z');
  assert.equal(request.customer.email, null);
  assert.equal(request.customer.phone, null);
  for (const id of [request.menuId, request.items[0].menuItemId, ...request.items[0].modifierOptionIds]) {
    assert.ok(sql.includes(id), 'Fixture must contain every canonical request catalog identity');
  }
});
