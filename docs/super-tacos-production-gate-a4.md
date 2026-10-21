# Gate A.4 isolated SQL execution

Tested on 2026-10-21 with PostgreSQL 17.11 in a disposable cluster bound only to `127.0.0.1:55417`. The database contained 15 public tables, a composite `(section_id,item_id)` placement primary key, relevant catalog/tenant foreign keys, indexes, and synthetic Armando rows. It was built from `scripts/qa/super-tacos-production-shaped.sql`; no live data or remote connection was used. No release SQL was applied to Production or Staging.

## Local substitution boundary

The unmodified `schema-prep.sql` and `content.sql` both rejected the local connection with `Exact Production identity and verified TLS required` (psql exit 3). The test copies under the temporary cluster directory were produced by `scripts/qa/prepare-super-tacos-local-sql-qa.mjs`. It replaces the exact Production host/user/database/port/TLS guard with a local database/user guard and the approval/backup requirement with a local-only marker. Local psql variables are `local-only` or `none`; no Production approval token or backup SHA is supplied. The copy retains schema checks, catalog inserts, collision checks, baseline fingerprints, content verification, and transaction boundaries. These copied artifacts are **not** Production release artifacts and their successful execution is not evidence that the unmodified release SQL can run locally.

## Results

- The schema migration and read-only schema verification passed. Synthetic Armando remained `is_indexable=true`; Super Tacos was `false` after installation.
- The local-only content copy committed. Read-only verification passed: 25 items, 25 placements, 6 sections, 9 modifier groups, 35 options, zero orderable items, zero demo operational records/counters/overrides, and unchanged baseline fingerprints.
- Repeated content installation, a `super-tacos` slug collision, a reserved item ID collision, and an Armando fingerprint change each rejected with psql exit 3 and no new demo restaurant.
- A local check constraint deliberately rejected the final ordering-settings insert. The earlier restaurant, items, options, and settings inserts all rolled back to zero rows.
- A repeated schema migration rejected `is_indexable already exists`; an empty-schema database rejected `Expected Production catalog absent`.

The first migration attempt exposed a real `name[] = text[]` error in the 15-table guard. The canonical generator and schema SQL now cast `c.relname::text` before `array_agg`. The generated preflight and content SQL were refreshed with the same cast; the manifest was regenerated and validated. No menu content, pricing, payments, or schema scope changed beyond the planned `is_indexable` column.

## Limits and remaining prerequisites

This fixture models the verified 15-table contract and relevant constraints; it is not a byte-for-byte dump of the live Production DDL. The five existing Production functions are not invoked by this release package and were not reproduced. A final read-only live schema/constraint comparison, verified Production backup and recovery evidence, separate schema/content approvals, secure Production connection, and gated deployment checks remain necessary. Do not reuse the local derived SQL or synthetic baseline as a Production approval or backup attestation.
