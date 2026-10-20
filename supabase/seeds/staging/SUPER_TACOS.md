# Super Tacos staging fixture — Step 0A

The functional-demo successor is prepared separately in `015_super_tacos_demo.sql`
and documented in `docs/super-tacos-demo.md`. It is not activated by the local
implementation task. Do not rerun this legacy browse-only fixture after demo
activation; it is not a content-update or rollback procedure.

Status: prepared, not applied. This file documents a future manual operation;
it does not authorize database writes or deployment.

Classification: restaurant-specific data using existing System Pieces. No new
Variant, Client Piece, schema, presentation API, or commerce behavior.

## Fixture contract

`014_super_tacos.sql` creates one independent `super-tacos` tenant, one published
menu, four sections, twelve items (three per section), and twelve placements.
All IDs use the previously unused `20000000-0000-4000-8000-` namespace:
restaurant `000000000001`, menu `000000000002`, sections `000000000101`–`104`,
items `000000000201`–`212`, placements `000000000301`–`312`.
Source identity is restaurant-scoped (`menu-man-staging` plus stable item keys).
No Armando's or Test Kitchen records, assets, or configuration are reused.

Prices are sample USD amounts in integer cents. The restaurant is active and
its menu published so existing staging routes can render it; `is_indexable`
is false. `America/Los_Angeles`, `classic-red`, and empty theme overrides use
existing platform conventions. Logo, photography, contact/location details,
canonical domain, social URLs, and external ordering URLs remain null. No hours,
modifiers, delivery providers, payment connections, memberships, or orders are
created. Pickup, ASAP, and scheduled pickup are explicitly disabled, and every
item is non-orderable. The disabled settings use a sample zero tax rate, not a
verified restaurant tax configuration.

The seed is a single transaction with `ON_ERROR_STOP`. It requires both an
explicit staging marker and a verified project ref matching the actual psql
connection: either `db.<ref>.supabase.co`, or a Supabase pooler with user
`postgres.<ref>`. It intentionally rejects localhost, custom hosts, and other
connection forms. These checks cannot establish that a caller-supplied project
ref really is staging: verify that independently before invoking it.

Reruns restore the fixture's content, empty identity fields, noindex state,
disabled ordering, and non-orderable items using fixed primary keys. They do
not duplicate records. Identity conflicts, another menu, unexpected catalog
additions/cross-links, existing orders, payment connections, or delivery
providers abort and roll back. Nothing is deleted or silently adopted. Retire
or revise this seed before adding reviewed content, photography, or operational
configuration; rerunning it later would reset its sample-owned fields.

## Safe application procedure — only after writes are authorized

1. Confirm in the Supabase dashboard that the intended project is the existing
   **staging** project, distinct from production. Record its project ref from
   that independent source. Confirm the staging application points to it.
2. Confirm the target already has the repository's current schema, including
   `restaurants.is_indexable`, ordering settings, payment connections, and
   delivery providers. Do not run migrations, other fixtures, or the Armando's
   bootstrap sequence as part of this task. Missing schema should stop the work.
3. Review the SQL and existing `super-tacos`/reserved-ID records with read-only
   queries. Confirm any existing fixture is the expected one. Use the staging
   PostgreSQL **owner** connection, not a service-role API key. Capture any
   desired Armando's baseline before the operation for comparison afterward.
4. Install/use psql locally. In PowerShell at the repository root, set
   `$stagingProjectRef` to the independently verified ref. Supply the owner
   connection string privately in `MENU_MAN_STAGING_DATABASE_URL`; never commit
   it. Then run only:

   ```powershell
   if ([string]::IsNullOrWhiteSpace($stagingProjectRef) -or $stagingProjectRef -cnotmatch '^[a-z0-9]+$') {
     throw 'Set the independently verified staging project ref first.'
   }
   if ([string]::IsNullOrWhiteSpace($env:MENU_MAN_STAGING_DATABASE_URL)) {
     throw 'Set the staging owner connection string privately first.'
   }
   psql -X --dbname="$env:MENU_MAN_STAGING_DATABASE_URL" --set=ON_ERROR_STOP=1 --set=menu_man_environment=staging --set="menu_man_staging_project_ref=$stagingProjectRef" --file="supabase/seeds/staging/014_super_tacos.sql"
   if ($LASTEXITCODE -ne 0) { throw 'Super Tacos seed failed. Review the error; do not bypass guards.' }
   ```

   `-X` ignores local psql startup files. There is no application-level seed
   dry-run flag. Do not mistake this seed's guard flags for target verification.
5. Verify with read-only queries: one active/noindex restaurant, exactly one
   published menu, four active sections, twelve non-orderable tenant-owned
   items, twelve correctly linked placements, all three pickup flags false,
   zero payment connections/delivery providers/orders, and null ordering URLs.
   Compare the Armando's baseline. A second authorized invocation should retain
   those counts and IDs, demonstrating rerun behavior.
6. Once staged, check `/r/super-tacos`, `/r/super-tacos/menu`, and
   `/r/super-tacos/location` in Chrome on mobile and desktop. Empty imagery and
   missing location/hours are intentional at this stage. Do not submit orders.

## Publication boundary

This SQL stays outside automatic seeding and must never run against production.
Noindex is not access control. The centralized production publication restriction
includes Armando's and Super Tacos. Before any
future public release, separately review removal of Super Tacos publication gating and
verify Preview protection if private access is required. Keep production data,
marketing showcase links, and deployments unchanged until approval.

## Validation limits

Local static checks can verify fixture shape, fixed IDs, SQL structure against
committed schema, and guard configuration. They cannot prove PostgreSQL runtime
behavior, hosted permissions/schema state, rollback behavior, or route rendering.
Those checks require a separately authorized staging operation. Do not apply
the fixture merely to complete validation for Step 0A.
