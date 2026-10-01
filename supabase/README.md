# Supabase database lifecycle

`supabase/migrations/` is the authoritative ordered schema for bootstrapping a
clean Menu Man environment. Apply every migration in filename order. The files
under `scripts/*.sql` predate migration tracking and remain historical,
production-upgrade artifacts; they are not sufficient to initialize an empty
database and must not be mixed into a clean bootstrap.

The baseline includes the catalog, restaurant profile/hours, source identity,
image storage, themes, SEO, modifiers, order snapshots, ordering configuration,
checkout functions, provider-neutral payment records and state functions,
webhook/audit/outbox infrastructure, indexes, constraints, RLS, triggers, and explicit grants.
Schema migrations contain no Armando or staging operational values.

Payment webhook events are stored before the Square route acknowledges them.
Migration `202609300002_payment_event_retry_worker.sql` installs a one-minute
Supabase Cron drain in each database where it is applied, including staging.
The drain locks eligible events, retries application with bounded backoff,
and leaves an event in `permanent_failure` after eight failed attempts.
Operators can inspect `processing_status`, `attempt_count`, `next_attempt_at`,
and `last_error` on `public.payment_webhook_events`; a permanent failure needs
investigation and an explicit retry decision. The immediate webhook drain is
best effort after durable ingestion. The database schedule provides retry
without customer traffic or a Vercel production-only cron job.

```sql
select id, provider_key, provider_event_id,
       normalized_event ->> 'kind' as event_type,
       processing_status, attempt_count, last_error, available_at, next_attempt_at,
       received_at, processed_at
from public.payment_webhook_events
where processing_status = 'permanent_failure'
order by received_at;
```

For a hosted staging project, link the Supabase CLI only after checking the
project ref, then use `supabase db push`. Never push this baseline to the
existing production project until its legacy migration state has been audited
and reconciled separately.

Staging data is opt-in under `supabase/seeds/staging/`. There is intentionally no
automatic `supabase/seed.sql`. See that directory's README for the interleaved
restaurant seed, TypeScript menu import, operational seed, modifier seed, fake
payment connection seed, optional fixed Square Sandbox connection seed, and
contract-test sequence.

Database contract tests under `supabase/tests/` are plain SQL suitable for
`psql -v ON_ERROR_STOP=1 -f <file>`. The checkout test wraps order creation in a
transaction and rolls it back. The payment contract test similarly verifies
success, replay, out-of-order events, refunds, and late-success quarantine in a
rolled-back transaction. The Square contract additionally verifies the real-
provider connection, verified webhook and reconciliation sources, sanitized
persistence, deduplication, purchase outbox, and refund transition path. The
pickup availability contract creates rollback-only fixtures with fixed clocks
for hours, lead-time, cutoff, closed-period, timezone, DST, and order
revalidation boundaries.

The order-management migration adds Supabase Auth-backed restaurant
memberships, role presets plus explicit capability overrides, RLS/restricted
RPC boundaries, a separate forward-only fulfillment state, append-only actor
audit events, private PII-free Realtime invalidations, cursor history reads,
and an export-ready cursor read model. Its staging contract runs only after a
first owner has been invited and bootstrapped.
