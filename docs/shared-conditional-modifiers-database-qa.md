# Conditional modifiers — disposable database QA

Date: 2026-10-26. Branch: `feature/shared-conditional-modifiers-v1`.

## Result

The pending [conditional migration](../supabase/migrations/20261026075607_conditional_modifier_groups.sql)
applied successfully and its expanded database contract passed. No migration or
application defect was demonstrated. The only source correction was a syntax fix
in the prepared SQL test: parenthesize a CASE expression in an IF comparison.
Additional SQL assertions cover parent switching, replay, privileges, conflicting
attachments, wrong-group parent options, incomplete conditions and self nesting.

Ready for Director/Shared integration review of this capability. Broader QA is
not all green: five older database suites fail identically before and after the
migration. Those baseline failures require an explicit integration disposition;
they were not hidden, bypassed or repaired through unrelated checkout changes.

## Explicit isolation verification

The system PostgreSQL binaries lacked bootstrap data. A portable PostgreSQL 18.6
runtime was extracted under the worktree's ignored QA directory. No installed
service or existing cluster was changed. Runtime provenance:
`https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64-binaries.zip`.

Before tests, verified both owned process identity and server-reported values:

| Field | Verified value |
| --- | --- |
| Server/listen address | `127.0.0.1` only |
| Port | `55438` |
| Cluster | `menu_man_conditional_qa` |
| Role | `conditional_qa_owner` |
| Main database | `conditional_modifiers_qa` |
| Baseline database | `conditional_modifiers_baseline` |
| Data directory | `C:/menu-man/.worktrees/shared-conditional-modifiers-v1/.playwright/conditional-modifiers-db/data` |
| Engine | PostgreSQL 18.6, native Windows |

The runner uses explicit loopback host, port, role and database parameters, no
psql startup file, ON_ERROR_STOP, and clears inherited PG/DATABASE/SUPABASE
environment settings. It rechecks the owned cluster identity before operations.
Neither hosted Supabase project was connected to. No hosted credentials were used.

## Migration execution and environment limits

- Main database: all **44 ordered migration files**, including the pending file,
  applied successfully.
- Control database: the prior **43 ordered migrations**, without conditional
  modifiers, applied separately, with the same synthetic legacy lookup fixtures.
- Real pgcrypto and PostgreSQL constraint, transaction, role and PL/pgSQL semantics
  were used. No core SQL, checkout wrapper, pricing function or trigger was mocked.
- This was PostgreSQL database QA, not a full running Supabase stack. Minimal
  local `auth.users`/`auth.uid`, Storage tables, Realtime API and cron registration
  scaffolding supplied Supabase-owned infrastructure contracts.
- Windows has no pg_cron extension here. In an ignored execution copy only, its
  CREATE EXTENSION statement was omitted and cron.schedule recorded jobs without
  executing a scheduler. Source migrations were unchanged. Payment retry functions
  were invoked directly by their existing tests.
- Realtime delivery, GoTrue sessions, Storage service behavior, scheduled job
  execution and PostgREST schema-cache behavior were not tested.
- Legacy contracts used synthetic local restaurant/menu records with the expected
  lookup keys. No real restaurant database or menu fixture file was modified.
  Local provider records were synthetic; no provider network API was called.

## Conditional database assertions

The expanded [024 SQL contract](../supabase/tests/024_conditional_modifiers_contract.sql)
passed through the public database checkout entry point:

1. Flat root selection compatibility, including an inactive required child.
2. One-level root/child attachments and correct canonical activation.
3. Required active-child enforcement; omission is rejected.
4. Optional child omitted and selected cases.
5. Stale, wrong-parent, forged and foreign-tenant option rejection; failed requests
   create no orders.
6. Parent switching leaves no payable child prices or child snapshots.
7. Child upcharges, quantity multiplication, zero item override, authoritative
   pricing despite a forged price field, and immutable order/item/modifier snapshots.
8. Same-tenant/group ownership through composite foreign keys and option validation.
9. Exact conditional-order replay after its parent becomes unavailable, plus
   conflicting-payload replay rejection.
10. Duplicate/conflicting child attachments, wrong-group parent options, partial
    relationships, foreign parents, second-level nesting and self parenting rejected.
11. Service-role public entry permission retained; anonymous/authenticated callers
    and direct service-role core/helper execution remain disallowed.

## Existing SQL contract results

All suites below were executed in the isolated databases. A PASS means the whole
unmodified suite completed; failures were not counted as partial passes.

| SQL suite | With migration | Without migration | Finding |
| --- | --- | --- | --- |
| 001 schema | FAIL | FAIL | Older assertion inspects create_order_base_v1 for fingerprint internals now in create_order_core_v1. |
| 002 checkout | FAIL | FAIL | Old custom-tip rejection-message expectation does not match the current wrapper. |
| 004 payments | FAIL | FAIL | PL/pgSQL test block references undeclared abandonment_response. |
| 006 pickup availability | FAIL | FAIL | Early/final-boundary availability fixture assertion fails. |
| 015 final payment pickup | FAIL | FAIL | Suite disables pickup without clearing enabled modes, violating restaurant_ordering_settings_modes_check. |
| 016 pickup capacity | PASS | PASS | Existing slot reservation and capacity contracts preserved. |
| 019 payment/refund monotonicity | PASS | PASS | Existing payment/refund state contracts preserved. |
| 020 webhook retry worker | PASS | PASS | Worker contracts pass through direct invocation; cron scheduling not exercised. |
| 021 exact checkout replay | PASS | PASS | Existing replay, checkout and persistence contracts preserved. |
| 022 checkout creation abuse limit | PASS | PASS | Limiting, retry and replay contracts preserved. |
| 024 conditional modifiers | PASS | Not applicable | New conditional database assertions pass. |

Initial local setup failures were corrected only in ignored QA scaffolding:
the extensions search_path was configured, the local synthetic Square sandbox
record was supplied for suite 019, and test-kitchen mode defaults were adjusted.
The final-payment suite still fails on its own later invalid settings update on
both databases. No application code was changed to accommodate these suites.

## Audit, changes and integration requirements

Final main-database audit: **0 orders**, **0 conditional test tenants**, two parent
columns present, service_role execute on the public entry true, and on the internal
core false. Test transactions rolled back. Both disposable databases were then
dropped and the owned loopback cluster stopped. QA files/logs remain ignored under
`.playwright/conditional-modifiers-db/` for inspection.

Files changed for this QA task:

- [024 SQL contract](../supabase/tests/024_conditional_modifiers_contract.sql):
  demonstrated test syntax correction and expanded assertions.
- This report.
- Ignored disposable runtime, scaffold, identity/migration/test logs and cleanup
  evidence; no deployment configuration changes.

No browser QA or application test suite was repeated. No TypeScript or UI code
changed. No commits, merges, deployments, hosted migrations or real orders occurred.

Integration requirements:

1. Director/Shared/QA review the successful conditional database checks and assign
   disposition for the five reproducible baseline suite failures.
2. Retain the prior migration-first rollout requirement; enable no conditional
   restaurant data until compatible app versions are serving.
3. Before any hosted execution, obtain separate authorization and verify target
   identity and out-of-band schema/function drift. This local test grants none.
4. A real Supabase environment still needs its infrastructure/schema-cache smoke
   checks. Concurrent configuration edits were not separately stress tested.
