// Deliberately accepts only a direct, TLS-verified disposable Supabase branch.
export const STAGING = 'jjvongzvtnzlvwdfcnjk';
export const PRODUCTION = 'fullaiodvmilkdxyxnln';
export const TENANT = '20000000-0000-4000-8000-000000000001';

export function targetConfig(env) {
  const ref = env.QA_DEMO_BRANCH_REF;
  if (!/^[a-z]{20}$/.test(ref ?? '') || [STAGING, PRODUCTION].includes(ref)
    || env.QA_DEMO_BRANCH_CONFIRM !== `disposable-super-tacos:${ref}`) {
    throw new Error('Explicit disposable branch confirmation required');
  }
  let url;
  try { url = new URL(env.QA_DEMO_DATABASE_URL); } catch {
    throw new Error('Branch database URL required');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== `db.${ref}.supabase.co` || (url.port && url.port !== '5432')
    || url.pathname !== '/postgres' || url.username !== 'postgres' || !url.password
    || url.search || url.hash || !env.QA_DEMO_MANAGEMENT_TOKEN) {
    throw new Error('Direct branch database URL and read-only branch-inventory access required');
  }
  return { ref, token: env.QA_DEMO_MANAGEMENT_TOKEN, approval: env.QA_DEMO_BRANCH_CONFIRM,
    database: { host: url.hostname, port: 5432, database: 'postgres', user: 'postgres',
      password: decodeURIComponent(url.password), ssl: { rejectUnauthorized: true },
      application_name: 'menu-man-isolated-demo-qa', connectionTimeoutMillis: 10000,
      options: '-c statement_timeout=15000 -c lock_timeout=2000', sslnegotiation: 'postgres',
      statement_timeout: 15000, query_timeout: 20000, lock_timeout: 2000 } };
}

export function assertBranchInventory(rows, ref) {
  if (!Array.isArray(rows)) throw new Error('Unrecognized branch inventory');
  const matches = rows.filter(row => row?.project_ref === ref);
  const branch = matches[0];
  if (matches.length !== 1 || branch.parent_project_ref !== STAGING
    || branch.is_default !== false || branch.persistent !== false || branch.with_data !== false
    || branch.preview_project_status !== 'ACTIVE_HEALTHY' || branch.deletion_scheduled_at
    || !/^[0-9a-f-]{36}$/i.test(branch.id ?? '')) {
    throw new Error('Target is not a verified fresh disposable Staging development branch');
  }
}

export async function verifyBranch(config, fetcher = fetch) {
  const response = await fetcher(`https://api.supabase.com/v1/projects/${STAGING}/branches`, {
    headers: { Authorization: `Bearer ${config.token}` }, redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Branch inventory unavailable; no database connection attempted');
  assertBranchInventory(await response.json(), config.ref);
}

// Database and assertion errors can include SQL, credentials, and order capabilities.
// Emit only a locally chosen checkpoint and an allowlisted SQLSTATE.
export function safeFailure(checkpoint, error) {
  const code = /^[0-9A-Z]{5}$/.test(error?.code ?? '') ? error.code : 'unavailable';
  return `FAIL ${checkpoint}; SQLSTATE=${code}. Stop; inspect privately and discard the test branch.`;
}
