# Super Tacos production-schema rehearsal — Gate A.5

Run on 2026-10-21 against a restored copy of the verified public Production archive. No Production or Staging connection was used. The disposable PostgreSQL 17.11 server listened only on `127.0.0.1:55439` and was removed after the rehearsal.

## Archive and restored baseline

- Archive: `production-public-20261021T1913Z.dump`
- Expected and observed SHA256: `407feb3604efb37c4bb0149e74cdcbe379b5589dbfba254cfe098e78b834ee02`
- PostgreSQL archive source version: 17.6; restore/test server: 17.11.
- Restored public catalog before migration: 15 tables, 1 restaurant (Armando's), 311 menu items, 26 sections, 311 placements, 96 constraints, 40 indexes, and 5 functions.
- The existing `(section_id,item_id)` composite placement primary key was present.

The archive baseline matched `production-public-baseline.json`. The standalone `is_indexable` schema migration and its read-only schema verifier passed against the restored catalog. The public table, constraint, index, and function counts stayed at 15, 96, 40, and 5 after migration.

## Content rehearsal

The revised installer committed, and the release read-only verifier passed. Final Super Tacos counts were 25 items, 25 placements, 6 sections, 9 modifier groups, and 35 modifier options. All 25 items had `is_orderable=false`; the restaurant had `is_indexable=false`. Armando remained indexable.

An aggregate fingerprint over Armando's restaurant/menu/content/configuration rows and protected operational rows was `08ba56a6f69698333af671744694f7818c889e54aee06a0246d080c039037718` both before migration and after content installation. The release's own baseline content and protected-state checks also passed. Orders, order items, and order-item modifiers remained at zero; the archive's existing counter and modifier override remained at one each. The public archive has no payment activity rows.

Guard and transaction checks:

- Repeated install refused because the restaurant already existed; no second install occurred.
- A `super-tacos` slug collision refused without creating the demo restaurant.
- A reserved item ID collision refused without creating the demo restaurant.
- A local check constraint induced failure at the final ordering-settings insert. The transaction left zero Super Tacos rows across restaurants, menus, sections, items, placements, modifier groups/options/attachments, business hours, and ordering settings.

## Guard substitutions and artifact identity

Release files in `supabase/releases/super-tacos-public/` were not edited by this rehearsal. Their Production identity, approval, and backup checks remain intact. Temporary copies were generated under the disposable cluster directory. In those copies only, the exact Production host/user/database/port/TLS guard became a guard requiring the named `menu_man_gate_a5_*` database and `localqa` user; the separate approval/backup checks became a transaction-local `isolated-only` marker. The SQL content, schema assertions, collision and fingerprint checks, verification queries, and transaction boundaries were retained. Approval and backup values passed locally were `local-only` and `none`; no Production approval token or backup attestation was used.

Source and temporary local-copy SHA256 values:

| File | Release source SHA256 | Temporary local-copy SHA256 |
|---|---|---|
| `schema-prep.sql` | `aec46285d750bc142e594defa7dea294d9d9381aa41435c0574c50b326a1dcb4` | `c7d3136b9705916494cd4849ef986dcf7d0eacf30a02b40a5253890dde436ee2` |
| `schema-verify.sql` | `2a57f8cebedc489105a8492e04155468a2b027094c4fa4f80d3f5b127966879d` | `cd888b931209ed1f04818e872a7c3e964f65986e91c8a9a0c79d1e4084f3dcf9` |
| `preflight.sql` | `dbe2bfc1d9c23d1f3b04b4361178acc605ca7d1946b10ce52ba044f2650638b2` | `4ec5c10c4d914fc131eda69779607ebf108ef94cbb3d95d7e8b68ab8231c6dd2` |
| `content.sql` | `cc3f2b096bba99eb331b8495a0630d070c15f319464ba21dd2c8d6bf835d5a5b` | `8300481aa705f6af6dd93c59a40c1c5d0c1c5d8100d43f82c793cddcfde26a49` |
| `verify.sql` | `8271064cd1576cd68890b4bbe6e9052c4be7e4dddb793b02d3b38d53d2e815ea` | `2a763cf1bd554b74c5d468ef69bbecba290324e9a1bba2131812e82bab6773d6` |

## A.4 comparison and disposition

Results agree with Gate A.4: migration and content install passed; repeat, slug, and reserved-ID guards refused; and a late constraint failure rolled back all content. Gate A.5 confirms those outcomes against the actual restored Production DDL, including the existing functions and constraints absent from the synthetic fixture. No genuine Production-schema incompatibility was found, so no SQL or application repair was needed.

Database compatibility is cleared for the tested archive state. This is compatibility evidence only; the local derived files are not release artifacts or Production approval evidence.

## Files changed

Added this Gate A.5 report. No release SQL, application code, or private backup was changed. The report's SHA256 is recorded in the Gate A.5 run summary after final cleanup.
