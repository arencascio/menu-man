# Conditional modifier concurrent-edit integrity correction

Prepared on `release/staging-rc-v1`, starting at `25376a4`, 2026-10-26.

## Correction and supported write contract

[Forward migration 47](../supabase/migrations/20261026175758_conditional_modifier_write_isolation.sql)
replaces only `private.enforce_modifier_depth_v1()`. The original 46 migrations
remain unchanged. No checkout function, public RPC signature, table data, tenant
policy, price calculation, or application logic is modified.

The validator now rejects INSERT/UPDATE rows with a non-null parent group when
the transaction uses REPEATABLE READ or SERIALIZABLE. It raises SQLSTATE `0A000`
with `MM_MODIFIER_WRITE_ISOLATION`, before waiting for the menu-item lock. The
caller must roll back and start a **new READ COMMITTED transaction**; retrying in
the existing snapshot is unsupported. PostgreSQL READ UNCOMMITTED is also accepted
because it has READ COMMITTED visibility.

| Operation | READ COMMITTED / READ UNCOMMITTED | REPEATABLE READ / SERIALIZABLE |
| --- | --- | --- |
| Insert/update retaining a conditional parent | Existing per-item serialization plus hierarchy checks | Fail closed with `0A000` |
| Flat/root insert/update, resulting parent null | Existing behavior | Existing behavior |
| Clear an attachment's parent | Existing behavior | Allowed: removes an edge |
| Reads, order creation, exact replay | No change | No new isolation restriction from this migration |

The restriction applies to **all writes whose resulting row is conditional**,
including metadata-only updates to an existing child, not just changes to its
parent IDs. Zero-row statements and native row/serialization conflicts can finish
or fail before the row trigger runs. This is an explicit conditional-configuration
write contract, not a promise that every database write supports every isolation
level. Flat modifiers retain their existing behavior.

Why a restriction: the original menu-item `SELECT ... FOR UPDATE` serializes
writers without changing that row's MVCC version. A waiting snapshot-isolation
transaction can still validate against old attachment relationships. Another
advisory/row lock would not refresh its snapshot. Supporting conditional writes
under those levels would need a genuine version/write conflict or a different
snapshot-safe invariant design. This repair avoids new guard tables, synthetic
menu-item updates/timestamp changes, and changes to the existing commerce path.
See [PostgreSQL 17 isolation semantics](https://www.postgresql.org/docs/17/transaction-iso.html).

The original READ COMMITTED graph checks and item lock remain intact. Their
volatile trigger queries can see commits after a lock wait. FK/CHECK constraints
still enforce same-tenant/item/group relationships, parent option membership,
paired parent values and self-parent rejection. Higher-isolation flat/root writes
do not add hierarchy edges; deletes and clearing a parent only remove edges.

## Safe installation

The migration takes a SHARE ROW EXCLUSIVE lock on the attachment table, waiting
for existing writers before examining the graph and installing the guard. Under
READ COMMITTED, that subsequent examination sees their committed state. Installation
itself rejects snapshot isolation. Any existing child whose parent is absent or
is itself a child causes `MM_INVALID_MODIFIER_HIERARCHY` / `23514` and rollback.
There is no automatic data repair or grandfathering of invalid graphs.

Apply migrations 46 and 47 in order in a separately approved release, before
enabling conditional configuration writes. Keep attachment writes quiesced across
that sequence; the first migration alone retains the old race. The table lock is
held only for migration 47's validation/function replacement transaction. Review
target lock contention and existing graph validity during the hosted preflight.

The trigger/function OIDs, owner, ACL, SECURITY DEFINER status and empty search
path were verified unchanged by CREATE OR REPLACE. Direct execution remains
revoked for public, anon, authenticated and service_role. The checkout core body
hash was unchanged. No new API privilege or PostgREST-exposed function is added.
Migration 46's parent-column schema-cache check remains a separate hosted gate.

## PostgreSQL 17 evidence

Disposable native PostgreSQL **17.11** (`170011`), loopback `127.0.0.1:55448`,
cluster `menu_man_conditional_fix`, owner `conditional_fix_owner`, under this
worktree's ignored `.playwright/conditional-edit-fix/data`. No installed service
or other worktree was changed. The Supabase-compatible synthetic grants, RLS,
Auth/Storage/Realtime/cron scaffolding from the prior gate were reused; no remote
service or provider was called. PostgreSQL constraints and transaction semantics
are real; cron registration is a non-running local shim.

Before repair, the original mixed READ COMMITTED / REPEATABLE READ schedule was
reproduced again: B established an old snapshot, A changed A -> B, B waited then
changed B -> A, and both committed. A fresh query found **two invalid graph rows**.
The new migration correctly refused this already-tainted database. A fresh
baseline clone then accepted migrations 46 and 47 in order.

The persistent [database regression runner](../scripts/qa/conditional-modifier-concurrency.mjs)
passed **16 scenario groups** after repair:

1. READ COMMITTED competing-cycle schedule: observed lock wait, then second edit
   rejected with the existing depth error; no cycle committed.
2. READ UNCOMMITTED: same valid behavior.
3. Mixed READ COMMITTED / REPEATABLE READ: snapshot writer rejected with `0A000`
   before the item-lock wait.
4. Mixed READ COMMITTED / SERIALIZABLE: same fail-closed behavior.
5. Conditional insert rejected under REPEATABLE READ; legitimate flat insert/update
   committed under the same isolation.
6. Both competing REPEATABLE READ writers rejected.
7. Conditional insert rejected under SERIALIZABLE; flat insert/update committed.
8. Both competing SERIALIZABLE writers rejected.
9. Independent edges to one root on the same item serialized and both committed.
10. Edits on different items committed without a global runtime lock.
11. Self-cycle, excessive depth, foreign parent/group and wrong-group option rejected.
12. Single-statement multi-row cycle rolled back atomically.
13. Concurrent duplicate child insert rejected with unique violation.
14. Parent-option deletion versus child insertion left no orphan.
15. Parent deletion/cascade versus child reparenting left no orphan.
16. A committed parent edit rejected stale checkout without an order or counter
    change; exact replay retained its original snapshot, and a fresh valid
    selection retained authoritative pricing (2 x [1000 + 50] = 2100 cents).

The final repaired database contained **zero invalid hierarchy rows**. Snapshot
mode cases assert `0A000`, not a timeout/deadlock. READ COMMITTED cases monitor
`pg_blocking_pids` to prove the intended concurrent lock wait occurred.

Additional verification:

- Unmodified SQL suite **024 passed** after migration 47, including canonical
  pricing, forged/cross-tenant/stale selections, required children, snapshots,
  exact replay and execute grants.
- **93/93 focused application/migration tests passed**, including all 40 migration
  contracts and the amended ordered manifest. Targeted ESLint passed.
- Original 46 migration hashes match the prior gate. New file is the only schema
  addition. Function/trigger identity and checkout body compatibility passed.
- Installation rejected an invalid existing graph and rejected execution under
  a snapshot-isolation transaction.
- Historical suite 006 disposition, unrelated baseline failures, browser QA and
  application builds were not reinvestigated; no presentation/runtime app code changed.
- Disposable databases were dropped and the owned cluster stopped after validation.

## Reproduction and remaining release gates

The runner intentionally refuses any server other than the explicitly marked
local PG17 test cluster/database/data directory. It uses existing `pg`, explicit
loopback connections and synthetic tenants only. It does not provision a database
or require hosted credentials.

After creating the disposable cluster and Supabase-compatible scaffold, populate
`conditional_fix_unrepaired` with the original 46 migrations and
`conditional_fix_candidate` with all 47 migrations. The local cluster must use
the identity above and data directory `.playwright/conditional-edit-fix/data`.
Then, from the repository root:

```powershell
node scripts/qa/conditional-modifier-concurrency.mjs --expect-unrepaired
node scripts/qa/conditional-modifier-concurrency.mjs
node --import=tsx --test src/lib/cart/cart.test.ts src/lib/cart/conditional-modifiers.test.ts scripts/conditional-modifiers-contract.test.ts src/lib/checkout/contracts.test.ts src/lib/checkout/replay.test.ts src/lib/checkout/source.test.ts 'src/app/r/[slug]/menu-card-ordering.test.ts' 'src/app/r/[slug]/restaurant-menu-modifiers.test.ts' scripts/migration-contract.test.ts
```

The first command deliberately reproduces bad committed data in the unrepaired
disposable database. Never target a hosted or shared database. A passing run does
not authorize any migration application. The setup/cleanup runner and raw logs
for this execution are ignored under `.playwright/conditional-edit-fix/`.

**The demonstrated concurrent-edit blocker is corrected within the stated write
contract.** Callers using snapshot-isolation transactions for conditional catalog
writes must adopt a fresh READ COMMITTED transaction. Ordinary multi-row/item
work can still encounter native deadlocks/serialization errors and must roll
back/retry appropriately; this patch does not promise deadlock-free editing.
Unsupported writes must not be retried in the same snapshot.

Target identity, applied history, existing-data validity, hosted ownership/ACLs,
PostgREST cache and deployment sequencing still require their separately approved
Staging gate. No hosted mutation, push, deployment, fixture content import, or
environment configuration change occurred here.
