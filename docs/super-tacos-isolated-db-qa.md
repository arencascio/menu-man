# Disposable Super Tacos PostgreSQL tests

Prepared against feature commit `00623fa2`. This harness has offline validation;
real PostgreSQL results remain an approval-gated activation prerequisite. It never
runs as part of application tests, migrations, seeds, or deployment.

## Execution prerequisites

Obtain approval before creating/using an isolated Supabase development branch.
Create a **nonpersistent, nondefault, data-less child of Menu Man Staging**
(`jjvongzvtnzlvwdfcnjk`), with no copied data, Auth users, workers, external
webhooks, or application deployments. The branch must be ACTIVE_HEALTHY and have
the exact repository migration version list applied, including all checkout
dependencies. This runner does not apply/repair migrations or provision anything.
Do not run the manual Staging installers. Branches do not inherit restaurant rows.

Use Node 22+ and `npm ci`. The only added direct dependency is development-only
`pg@8.23.1`; independent `pg.Client` instances provide real PostgreSQL sessions.
No Square credentials, service-role JWT, public Supabase key, CLI link, or email
credentials are required. The runner cannot invoke Square or an email provider.

After approval, configure a local **gitignored** `.env.demo-db.local` with:

```dotenv
QA_DEMO_BRANCH_REF=<exact-20-letter-development-project-reference>
QA_DEMO_BRANCH_CONFIRM=disposable-super-tacos:<same-reference>
QA_DEMO_DATABASE_URL=postgresql://postgres:<URL-encoded-branch-DB-password>@db.<same-reference>.supabase.co:5432/postgres
QA_DEMO_MANAGEMENT_TOKEN=<operator-supplied-token-with-branch-inventory-read-access>
```

Never paste actual values into reports. The Management API credential only needs
read access to the Staging parent's branch inventory. No stored CLI credentials
are accessed. The direct DB endpoint requires IPv6/network reachability and a
trusted TLS certificate chain; use a trusted CA via Node's supported CA setup if
needed. Do not disable certificate verification. Poolers, local addresses,
alternate database names/users/ports, URI options and shared project targets are
deliberately refused. An inaccessible/changed inventory response fails closed.

Run from this worktree, only after branch execution approval:

```powershell
npm run qa:demo:db
```

The runner first uses the documented read-only
[`GET /v1/projects/{ref}/branches`](https://supabase.com/docs/reference/api/v1-list-all-branches)
to verify the target is a unique data-less disposable Staging child. Then each
independent DB session verifies TLS, database and login identity. Production
`fullaiodvmilkdxyxnln` and Staging itself are never accepted as test targets.

## What executes

The fixture transaction refuses existing restaurants, orders, notification rows,
payment connections or Auth users. It inserts one nonindexable synthetic tenant,
one menu/section/item, two required modifier groups/options, seven UTC hours rows,
pickup settings, and disabled notification preferences. It installs the **existing,
unchanged** protection SQL in the same transaction. It creates no payment route,
credentials, memberships or outbound notification work.

An observer session and two `service_role` worker sessions exercise actual RPCs:

- Canonical order rejection rolls back both quota counters and all order state.
- Explicit transaction rollback removes an otherwise successful creation.
- Four orders followed by two genuinely blocked/concurrent requests yield exactly
  one more order; source count remains five, and further requests are denied.
- Exact replay at source exhaustion consumes no quota or order state.
- Holding the actual advisory lock causes the RPC's real two-second lock timeout;
  the failed call leaves a complete database snapshot unchanged.
- Real accepted requests reach 49 total orders; two concurrent sources yield
  exactly one more order, reaching 50. A fresh rejected source leaves no counter
  behind, proving rollback after the first limiter succeeds and the second fails.
- Replay at tenant exhaustion still succeeds without writes. No payment attempts,
  payment connections or notification outbox rows exist; orders remain unpaid.

The concurrency barrier queries `pg_stat_activity` to prove both distinct worker
backends are waiting on the demo advisory lock before release. All lock releases
use `finally`; connection, query, observation and API waits are bounded. A run must
start with at least two minutes remaining in its fixed quota window and fail if
the window changes. No quota seeding/reset disguises the real 5/50 behavior.

This is deliberately single-use: successful execution retains **50 synthetic
unpaid orders** in the disposable branch. A failure can also retain earlier
committed test data. Discard the entire branch through the separately approved
infrastructure procedure afterward. Never clean it by running shared-Staging SQL,
and never merge the fixture/protection setup into the parent branch. No automatic
cleanup, reset, branch deletion, or migration-history write is performed.

## Offline checks

```powershell
node scripts/super-tacos-db.test.mjs
node --check scripts/test-super-tacos-db.mjs
npx eslint scripts/test-super-tacos-db.mjs scripts/super-tacos-db-target.mjs scripts/super-tacos-db.test.mjs
git diff --check
```

These validate target rejection, inventory evidence, safe diagnostics, boundary
assertions, lock-release orchestration, and the minimal fixture contract. They
do not prove SQL execution, quotas, races or transaction rollback; only an approved
real branch run can establish those results. Existing Staging installer/runtime
guards and completed application validation remain unchanged.
