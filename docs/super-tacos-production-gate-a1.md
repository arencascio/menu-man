# Super Tacos Production compatibility — Gate A.1

Prepared locally from v1 commit `f1086732a4608413088b478dfea972f7de00f683`.
Production is `fullaiodvmilkdxyxnln`; Staging is `jjvongzvtnzlvwdfcnjk`.
This package authorizes no database operation, deployment, or publication.

## Production shape and minimum change

Gate A read-only inspection confirmed 15 public tables, five public functions,
one Armando restaurant, a composite `(section_id, item_id)` primary key on
`menu_section_items`, and no `restaurants.is_indexable`. The Supabase migration
inventory is empty and `supabase_migrations.schema_migrations` is absent. Never
replay the Staging migration chain in Production.

`supabase/releases/super-tacos-public/schema-prep.sql` is a standalone,
forward-only migration. It adds only `restaurants.is_indexable boolean not null
default true`. The existing Armando row remains indexable. The migration
requires the exact Production direct connection, verified TLS, the 15-table
shape, one Armando row, absent Super Tacos, the composite placement key, a
separate schema approval token and a verified backup SHA attestation. It uses
a two-second lock timeout, a 30-second statement timeout and one transaction.
An existing column or changed baseline is a stop, including after an ambiguous
execution result. Do not rerun blindly. `schema-verify.sql` is read-only and
checks column type/default/nullability, Armando, table shape and demo absence.
The backup SHA input is an operator attestation, not proof that a backup exists.

No new table, function, policy or index is required for the browse-only demo.
The existing server client uses the service role; Production's public catalog
tables have RLS enabled and no anon/authenticated SELECT grant. The demo's
interactive cart and favorites stay in the browser. Its 25 items are active
and non-orderable, with pickup, ASAP and scheduling disabled.

## Content release changes

`scripts/prepare-super-tacos-public-release.mjs` now emits ten content tables
that exist in Production. Menu placements use the composite key without an
`id`. Notification and payment tables, triggers and Staging-only optional
tables are absent from the installer. The exact 15-table contract is checked
before installation. Preflight rejects an existing slug, tenant identity or
reserved ID. The installation remains serializable, tenant-scoped, new-tenant
only and transactional, with no upsert, delete, order, payment, visitor or
analytics import. Approval, backup attestation, TLS and freshness guards remain.

Before/after fingerprints cover every existing Production public table:
other-tenant rows in the ten content tables, and all rows of the five existing
operational tables (modifier overrides, orders, order items, order item
modifiers and order counters). A mismatch aborts. The read-only verifier checks
the exact new catalog and the same baseline. The previously prepared package
hash is superseded; all current artifacts are listed in `manifest.json`.

## Backup and recovery evidence required before any Production write

1. Identify the actual backup source and a completed backup for project
   `fullaiodvmilkdxyxnln`. Record its creation time, recovery point and the
   operator responsible. A scheduled-backup setting alone is insufficient.
2. Prove scope: schema and data for all 15 current public tables, Armando's
   restaurant/menu/modifier relationships and any relevant auth or storage
   metadata. Record what is excluded. Never put backup data in Git.
3. Validate an independently recorded checksum or provider integrity result,
   backup size/catalogue and secure storage location. A SHA parameter passed
   to SQL cannot verify backup contents or restorability.
4. Demonstrate a restore to an isolated target or equivalent tested recovery
   procedure, including table/row counts, Armando relationships, credentials,
   downtime and recovery-point expectations. Do not restore over Production
   during this review.
5. Capture fresh read-only preflight fingerprints immediately before each
   separately approved write. Concurrent Armando activity can make a baseline
   stale; investigate a mismatch instead of weakening the guard.

Before a transaction commits, any failed migration or installer transaction
rolls back. After the demo installation commits, prefer a separately approved,
tenant-scoped correction backed by read-only diagnosis and protection of
historical/order references. A full project restore could erase later Armando
activity and requires its own outage, data-loss and reconciliation decision.
No Production backup or restore feasibility was verified in Gate A.1.

### Gate A.2 operator check in Supabase Dashboard

For project `fullaiodvmilkdxyxnln`, open **Database > Backups** without starting
a restore. Record the backup type (daily or PITR), latest completed recovery
point and timezone, retained recovery range, backup status, and whether a
download or restore-to-new-project option is actually available. Preserve a
redacted screenshot or provider backup identifier, not customer records or
credentials. Confirm from the backup documentation and project configuration
that the chosen recovery point covers the public schema, Armando's restaurant,
menu, modifier and order records, and any required Auth metadata. Check Storage
objects separately; database backups contain Storage metadata, not object
bytes. Record integrity evidence (provider completion/status or a checksum for
an independently held logical backup) and a previously tested restore record.

If no isolated restore has been tested, restoration remains unproven. A project
restore can replace later Armando activity, so document the recovery point,
downtime, and reconciliation owner. Tenant-specific recovery instead requires
a separately reviewed extract and replay plan that selects only Super Tacos
identities and protects Armando's related rows. No Production restore or export
was performed for Gate A.2.

## Application compatibility and release gates

The candidate keeps the Super Tacos restaurant route and marketing link closed;
Armando's route remains independently restricted and absent from v1 marketing.
After the narrow migration, the gated app's sitemap and restaurant metadata
can read `is_indexable` without the missing-column error. Optional delivery,
featured, heart-count, special-hours and catering relations fall back only
when the named relation is absent; other errors remain visible. The fixed
Super Tacos hearts API keeps demo favorites local and rejects direct writes.
Core menu sections, items and modifiers use the existing Production tables.
Checkout and direct order/payment denials remain server-side.

This is a static compatibility assessment for the gated public-demo path, not
an executed application/database test or a clearance for every admin and
commerce feature in the 48-table Staging application. Gate A.3 removes
Production management from v1 scope. The candidate now returns 404 for its
management UI/API/auth paths before their absent management RPCs can run, and
for the notification-delivery handler before `claim_notification_outbox_v1`.
Staging management remains available. No cron is declared in the repository's
`vercel.json`, but deployment settings still need inspection. Legacy
payment/order APIs outside the restaurant route gate require capability
tokens or runtime switches, and their newer payment
functions are absent. They fail closed for ordinary unauthenticated requests,
but legacy sessions and operational callers need a separate compatibility
decision. Do not add the 48-table Staging schema merely to make these paths
work. The optional missing-relation paths need hosted observation after any
approved deployment. Neither route publication nor the content installer
follows automatically from this package.

## Isolated validation status and next approvals

The local PostgreSQL client binaries are present, but the installed PostgreSQL
18 package lacks the server catalogue `postgres.bki`; `initdb` could not create
a disposable cluster. No complete PostgreSQL 17 installation was found in PATH,
the Windows installation registry/services, or the standard directories checked.
WSL is not installed and no container runtime was found.
Read-only Production metadata confirmed the 15 tables, the installer columns,
the composite placement key, and the absence of restaurant-insertion triggers.
This is not an isolated execution test. SQL execution, repeat-install and
collision behavior still need real PostgreSQL validation before Production
approval.

Separate approvals remain necessary for: a verified backup and schema
migration; gated application deployment; the revised content artifact and
execution procedure; route opening; unauthenticated hosted QA; and marketing
CTA publication. Armando publication and any payment activation are separate.
