# Super Tacos Production content release preparation — Gate C.1

Run on 2026-10-21. No Production or Staging connection or write was made. The
verified public backup remained unchanged and was restored into a disposable
PostgreSQL 17.11 instance bound to `127.0.0.1:55444`.

## Local restored-schema rehearsal

- Public archive SHA256 verified as
  `407feb3604efb37c4bb0149e74cdcbe379b5589dbfba254cfe098e78b834ee02`.
- The restored baseline had 15 tables, 1 restaurant (Armando), 311 menu items,
  26 sections, 311 placements, 96 constraints, 40 indexes and 5 functions.
- The previously approved `is_indexable` migration was applied to the local
  restore only. It produced `boolean NOT NULL DEFAULT true`; Armando remained
  indexable.
- The revised content installer and read-only verifier passed. Results were 25
  items, 25 placements, 6 sections, 9 modifier groups and 35 modifier options.
  All 25 items were non-orderable; the demo restaurant was nonindexable. Orders,
  order items and order-item modifiers remained at zero. The public archive has
  no payments relation.
- The verifier's other-tenant and protected-state fingerprints passed. Armando
  remained at 311 items, 26 sections, 311 placements and `is_indexable=true`.
- Repeated install, slug collision and reserved-ID collision each refused.
  A late ordering-settings constraint failure rolled back the installer; the
  summed Super Tacos rows across all inserted content tables were zero.

## Local-only guard substitutions

Temporary SQL copies were produced by
`scripts/qa/prepare-super-tacos-local-sql-qa.mjs` outside the repository. In
those copies, each exact Production identity/TLS `DO` guard was replaced with a
check for a `menu_man_gate_a4_*` database and `localqa` role. The separate
schema/content approval and backup guard was replaced by a transaction-local
`isolated-only` marker. The local psql variables were `local-only` and `none`;
the local libpq SSL mode was `disable`. The release SQL retains its Production
guards. These values and copies are not Production authorization or evidence.

| Temporary local SQL copy | Source SHA256 | Local-copy SHA256 |
|---|---|---|
| `schema-prep.sql` | `0dff0715f54310137b4e1b4ce5a97cef02c016796cc4ec4513a6e97c081251` | `fb713898154b10e642297d9bb4df6d8edb0f387bd9978be9bdae7ebd3ef06086` |
| `schema-verify.sql` | `b80d9972f04ebf7a5b793570368d450ee83eb1af7275667782fa3bf0dc2a8193` | `f8bf62f6ae01125cfe2b097ebb7c251f9f906a2177c5f31acbfd10b39e695e49` |
| `preflight.sql` | `57d9e5c0c05517450fa1b6fd3f0bbbb1f16509996cdab32682d2d4a741792783` | `580721a3de5e95bfae12fe5ae291c9ba1f66de86890d78f567960e55025901c2` |
| `content.sql` | `636cbdceb2a0fd2c9b3a19e464cd0eef65085629e2b6e3b63016ac98d7777d62` | `2aa82c4cb5081f172946000e23c37c643117ea7e16cdbcf0fd36cc896662e8b9` |
| `verify.sql` | `58c10190b8be5f971800710cc160b5bd592d3ef881a3cfe79f34e655edfea6f3` | `1fa911b8f192aeb6b6c8dba8998ed269349a835a86042d1ed6b0d2ff69422743` |

## Disposition

The former direct-host and backend `pg_stat_ssl` checks were incompatible with
the verified Session Pooler. The release SQL now pins the exact pooler hostname
and project-scoped username while requiring `sslmode=verify-full`. Client TLS
verification, certificate ACL/path validation, credential handling, service
override rejection, PostgreSQL 17 pinning and same-connection validation remain
the trusted wrapper's responsibility.

The wrapper now has a guarded `ContentInstall` mode. It requires the explicit
content approval sentinel, exact backup SHA with archive rehash, and a validated
fresh baseline. The sentinel is an invocation guard; separate owner
authorization is still required. No content execution mode was invoked against
Production. The migration, collision, tenant fingerprint, transaction and
browse-only safeguards remain in the release SQL.

Local Production-schema compatibility is cleared for owner review. A separate
owner authorization is still required before any Production content
installation. This rehearsal does not authorize or publish Super Tacos.
