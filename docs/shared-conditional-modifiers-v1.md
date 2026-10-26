# Shared conditional modifier groups V1

Implemented locally in `feature/shared-conditional-modifiers-v1`, based on
`45c7f209157e89ca22818afc0c110742ccf51a29`. Worktree:
`C:/menu-man/.worktrees/shared-conditional-modifiers-v1`.
Classification: System Piece. No restaurant fixture or archived catalog changes.

## Data contracts

The shared [MenuModifierGroup](../src/lib/cart/types.ts) accepts an optional
`visibleWhen: { groupId, optionId } | null`. Missing/null preserves unconditional
behavior. IDs refer to a root group and one of its options on the same item.
One root may reveal multiple children. Multi-select roots may activate several
children simultaneously. Children cannot trigger grandchildren; self references,
missing parents, invalid parent options and deeper nesting fail closed.

```ts
{
  id: "flavor",
  visibleWhen: { groupId: "side-choice", optionId: "drink" },
  name: "Flavor",
  description: null,
  minSelections: 1,
  maxSelections: 1,
  sortOrder: 1,
  options: [/* existing shared MenuModifierOption records */],
}
```

In the database, the relationship belongs to the item attachment, not the reusable
group. Nullable `parent_modifier_group_id` and `parent_modifier_option_id` columns
are added to `menu_item_modifier_groups`. Both must be set together. Composite
foreign keys require the same restaurant, item attachment and parent option group.
A trigger restricts nesting to one level and serializes attachment edits per item.
Parent relationship foreign keys are indexed. Existing rows remain unconditional.
Create root attachments before children. A child group can have only one triggering
option per item in this baseline; option quantities and recommendations are unchanged.

Cart modifier snapshots may carry the same optional condition as a local display/
storage hint. StoredCart remains version 1; flat snapshots and fingerprints retain
their existing shape. Line signatures include conditions only on conditional
snapshots, so changed relationship snapshots do not accidentally merge. The public
checkout request remains option IDs plus quantity, with no prices or conditions.

## Behavior and affected commerce paths

- Full customization renders each active child beneath its triggering option,
  using existing fieldsets, legends and native radio/checkbox keyboard behavior.
  Child groups have required/optional labels and indentation. No animation added.
  Conditional items use the full form rather than the quick-choice form.
- Shared validation checks min/max only on active groups and reports stale child
  selections as invalid. Parent switches clear inactive descendants immediately.
  Valid explicit child defaults apply on activation; cart restoration restores
  saved selections without reapplying defaults.
- Modifier serialization excludes inactive children. Cart hydration, add and edit
  normalize conditional snapshots; unit/subtotal calculations exclude inactive
  snapshots. Existing quantity limits and consolidation behavior are retained.
- Canonical menu loading resolves attachment conditions after item overrides. An
  inactive parent path omits its children while preserving unrelated root choices.
  Structurally malformed relationships fail closed.
- The SQL core rejects inactive/forged child option IDs before computing prices or
  persisting orders. The min/max loop visits only active groups. Canonical option
  and item-override prices still own all calculations, including zero overrides.
- The existing core transaction, immutable order/item/modifier snapshots and
  public checkout wrappers remain unchanged except the two activation predicates.
  A contract test compares the complete copied core against its prior definition.
  Idempotency replay, tips, taxes, pickup, payment, capabilities and notification
  behavior are retained; no payment/provider logic changed.

## Files changed

Contracts, state, pricing and storage:

- [types.ts](../src/lib/cart/types.ts)
- [conditional-modifiers.ts](../src/lib/cart/conditional-modifiers.ts)
- [cart.ts](../src/lib/cart/cart.ts)
- [storage.ts](../src/lib/cart/storage.ts)

Shared presentation and canonical data loading:

- [ModifierGroupFieldset.tsx](../src/app/r/[slug]/ModifierGroupFieldset.tsx)
- [OrderItemPanel.tsx](../src/app/r/[slug]/OrderItemPanel.tsx)
- [menu-browser.module.css](../src/app/r/[slug]/menu-browser.module.css)
- [menu-card-ordering.ts](../src/app/r/[slug]/menu-card-ordering.ts)
- [restaurant-menu-data.ts](../src/app/r/[slug]/restaurant-menu-data.ts)
- [restaurant-menu-modifiers.ts](../src/app/r/[slug]/restaurant-menu-modifiers.ts)

Migration, tests and verification harness:

- [migration](../supabase/migrations/20261026075607_conditional_modifier_groups.sql)
- [prepared database contract](../supabase/tests/024_conditional_modifiers_contract.sql)
- [conditional unit tests](../src/lib/cart/conditional-modifiers.test.ts)
- [migration contract tests](../scripts/conditional-modifiers-contract.test.ts)
- [test registration](../scripts/run-tests.ts)
- [migration sequence registration](../scripts/migration-contract.test.ts)
- [Chrome QA runner](../scripts/conditional-modifiers.browser-qa.mjs)
- [synthetic browser fixture](../tests/conditional-modifiers/Fixture.tsx)
- This report.

## Verification

- `npm test`: **405/405 passed**, including the broader existing commerce suite.
- `npx tsc --noEmit --incremental false`: passed after Next route type generation.
- Targeted ESLint: passed. `git diff --check`: passed.
- Google Chrome, Playwright `channel: 'chrome'`, widths **1440, 412, 320**, reduced
  motion: passed. Checked conditional appearance/disappearance, required-child
  blocking, optional-child omission/selection, parent switching, keyboard selection,
  upcharges, totals, quantity changes, reload, edit restoration, stale-child removal
  and no horizontal overflow. Screenshots visually inspected at all three widths.
  Zero browser errors and zero write requests; external requests blocked.
- Synthetic harness uses the real OrderItemPanel, useRestaurantCart and shared
  draft/cart helpers. It creates a guarded temporary local route and removes it
  afterward. No QA route remains in the app. This is component-lifecycle QA, not a
  live restaurant/database/payment end-to-end order.
- Screenshots and results are local ignored files under
  `.playwright/conditional-modifiers/`. Run `node scripts/conditional-modifiers.browser-qa.mjs`
  from this worktree to reproduce; it uses loopback port 3228 and installed Chrome.
- No database migration or SQL test was executed. The prepared rollback-only SQL
  contract covers public-RPC rejection of stale/inactive/wrong-parent/cross-tenant
  selections, required and optional children, disabled parent overrides, canonical
  zero overrides, quantity totals, order snapshots and relationship constraints.
  Those are **prepared database assertions, not claimed passing database tests**.

## Integration and remaining risks

1. Obtain separate database-release authorization. Verify the exact target project
   before any execution; Staging must be `jjvongzvtnzlvwdfcnjk`, Production is
   `fullaiodvmilkdxyxnln`. Nothing was applied or connected in this task.
2. Review and apply the new migration through the normal release process. It
   assumes the existing ordered migration chain and `create_order_core_v1` are
   present and unmodified. Run the prepared SQL contract and existing commerce SQL
   suites in an authorized disposable environment. SQL runtime behavior, syntax,
   concurrent configuration edits and live PostgREST loading remain unverified.
3. Refresh PostgREST schema metadata as required by the release process, then
   deploy the shared app. The new loader requires the two columns; deploying app
   code before the migration fails closed. No missing-column fallback is added.
4. Keep all conditions null until every serving application version supports this
   contract. An old application would render conditional groups as unconditional.
   Only then configure restaurant-specific attachment relationships separately.
   No restaurant was enabled or imported by this task.
5. Before an application rollback to an older version, disable conditional child
   attachments and remove/review affected active carts. Simply nulling a child
   relationship makes it an unconditional group, which can alter required choices.
6. In-flight saved carts created before conditions were configured have no local
   condition hints. The database still rejects invalid selections; editing under
   the current catalog reconstructs selections. Snapshot hints are never an
   authorization or price authority.

No commits, merges, deployments, real orders, database mutations, Upper Crust
changes, recommendation functionality or unrelated presentation changes occurred.
All existing worktrees and their uncommitted changes were preserved.

## Follow-up migration lineage review

The pending migration is **ready for isolated database execution**, subject to
separate authorization. No historical-copy behavior regression was found in the
repository's ordered migration chain. No functional SQL correction was necessary;
only explanatory lineage comments were added to the pending migration.

The effective core originated in `202609080007`, was replaced by the fingerprint
ambiguity fix in `202609110001`, then renamed to `create_order_base_v1` by
`202609130002` and to `create_order_core_v1` by `202609160002`. No subsequent
migration replaces that body before this pending migration. After removing only
the two conditional activation predicates, the new core matches the effective
pre-migration body exactly.

Current new-order call chain:

```text
create_order_with_abuse_limit_v1   (202610010003)
  → create_order_v1               (202610010001 exact replay)
  → create_order_before_exact_replay_v1
                                 (202609270001 pickup lock and final recheck)
  → create_order_unlocked_v1      (202609160002 custom tip cap/confirmation)
  → create_order_base_v1          (202609160002 required customer data/normalization)
  → create_order_core_v1          (202609110001 body, renamed twice)
```

The historical custom-tip wrappers from `202609130002`, `202609150002` and
`202609160001` were superseded by the September 16 wrapper, not folded into the
renamed core. The pending migration leaves the effective wrappers byte-for-byte
unchanged. Exact replay still bypasses reinterpreting committed orders through
current menu/required-field/tip/availability settings. New-order abuse limiting,
source-hash handling, retry timing, idempotency locks, pickup locks/rechecks,
custom-tip limits and confirmation remain on the same call path.

Later helper changes are also retained: special-hours and DST pickup rules
(`202609130001`, `202609170002`, `202609180001`), the capacity-filtering availability
wrapper and payment-time slot reservations (`202609280001`), post-order payment
views (`202609110002`, `202609160001`), fulfillment/notification triggers
(`202609140001`, `202609150001`), and later payment/refund/cancellation protections.
The new core continues to call the current named helpers and insert the same
snapshots; it does not recreate their historical definitions or disable triggers.

The core remains `(text, text, jsonb) → jsonb`, `SECURITY DEFINER`, empty
`search_path`. `CREATE OR REPLACE` retains its identity, ownership and dependencies;
its execute permission remains revoked from public, anon, authenticated and
service_role. Internal wrappers remain non-callable by those roles; public entry
points retain service_role-only execution. Both new private functions have explicit
execute revocations. Parent relationship foreign keys, supporting indexes, the
private schema and trigger dependencies occur in the correct migration order.

Conditional activation is canonical: the selected-ID eligibility count applies
the private activation helper before pricing and insertion, so a forged inactive
child fails with `MM_INVALID_MODIFIERS`. The same helper gates the min/max loop.
Parent attachment, group, option and per-item override availability must all pass.
Pricing, quantities, taxes, tips, counter allocation and persisted modifier prices
remain based on the validated IDs and canonical database values.

Follow-up validation (no application/browser QA repeated):

- Seven focused static contract tests: lineage, effective wrappers/ACLs/signatures,
  active call chain, dependencies/order, exact core comparison and canonical gates.
- Forty migration contract tests.
- TypeScript, targeted ESLint and whitespace checks.
- Offline PostgreSQL 18 WASM parser (`libpg-query@18.2.1`, ephemeral npm cache,
  no project dependency): all 12 migration statements parsed; both PL/pgSQL
  functions and the SQL-language activation body parsed separately. No database
  connection, migration execution or database mutation was involved.
- AGENTS.md had no diff; nothing needed removal. No UI/application code changed.

Remaining execution checks: actual target catalog/owner/ACL state and any
out-of-band function drift, target-version semantic resolution, migration
application, SQL rejection/pricing/persistence assertions and concurrency behavior.
Offline parsing and repository lineage cannot prove those runtime properties.
There are no identified static blockers. Run the prepared rollback-only database
contract only in a separately authorized isolated environment; this review does
not authorize any database execution or release.

## Staging RC integration (2026-10-26)

Applied source commit `44add219` onto `release/staging-rc-v1` at `6b1b1af`.
Resolved the test-runner conflict by retaining both demo and conditional tests;
retained `cartPreview` in card-add classification while routing conditional items
to the full customization form. The item panel retains the newer customizable
capability, sample presentation and image framing. Shared CSS retains both sets
of styles. Added preview classification assertions for flat and conditional items.

The migration manifest now lists both existing Operations migrations before the
conditional migration: 46 unique, ordered files. Every existing migration remains
unchanged; the conditional migration matches the source commit and the prior
disposable database execution copy. No database execution was repeated.

Merged-tree validation:

- TypeScript with generated Next route types and targeted ESLint passed.
- Standard Next.js 16.4.2 Turbopack production build passed using process-only
  loopback placeholders, without real credentials or deployment configuration.
- Application suite: 466/470 passed. The four remaining failures match retained
  `6b1b1af` baseline evidence: heart-handler analytics, action-surface source
  contracts, sitemap fixture assumptions and historical Super Tacos contact copy.
  No new failures; the fifth baseline failure, the migration manifest, is fixed.
- Focused conditional/flat cart, canonical modifier loading, checkout validation,
  replay and migration-lineage contracts: 91/91 passed.
- Google Chrome conditional lifecycle QA passed at 1440/412/320 with zero browser
  errors, write requests or horizontal overflow. Temporary QA route was removed.
- Next dev normalized the generated AGENTS.md block heading; retained per its
  instructions. No application configuration or dependency manifests changed.

Prior isolated PostgreSQL evidence is reused; the five legacy SQL failures remain
unchanged and require release disposition. Hosted PostgreSQL 17/Supabase,
PostgREST schema-cache and concurrent attachment-edit checks remain release gates.
Apply schema before app rollout and enable no conditional restaurant data until
all serving versions support it. No Upper Crust work, other worktree changes,
Supabase mutations, push or deployment occurred during this integration.
