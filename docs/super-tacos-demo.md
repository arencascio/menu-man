# Super Tacos functional demo — local implementation

Base: canonical Staging `45c7f209157e89ca22818afc0c110742ccf51a29`.
Branch: `feature/super-tacos-demo` in the existing integration worktree.
Status: implemented locally; **no remote fixture, environment, deployment, or payment operations performed**.

Super Tacos is fictional. Presentation is a Client Piece composed from the existing
restaurant shell, split-photo hero, theme tokens, menu, customization, cart,
checkout, payment reconciliation, confirmation, and authorized order management.
The demo policy is a small System Piece around existing commerce; it adds no
payment adapter, authentication scheme, or alternate order/pricing engine.

## Prepared restaurant content

- 30 priced/orderable items, six categories, four reusable modifier groups.
  Salsa/tortilla/drink size enforce required selections; extras have bounded choices.
  Existing 12 item IDs and menu/tenant IDs are preserved. No existing orders are
  rewritten. Catalog: `supabase/seeds/staging/super-tacos-demo.json`.
- Original vector logo, green/citrus/cream identity, licensed photo hero. Shared
  `src/lib/demo/theme.json` feeds both prepared DB settings and demo checkout.
- Illustrative hours: 9am–10pm daily, America/Los_Angeles; ASAP and scheduled
  pickup use the normal SQL availability/capacity checks. Sample tax is 8.25%;
  this is a demonstration value, not a tax determination. Three-day scheduling,
  20-minute lead/cutoff, 15-minute intervals, ten orders per interval.
- Fictional address: 123 Demo Plaza, Demo Springs, CA 00000, explicitly marked
  “fictional — do not visit.” No generated map/directions link for the demo ID.
  Reserved phone +1-202-555-0142 uses NANPA's
  [fictional 555-0100–0199 range](https://nanpa.com/numbering/555-line-numbers).
  Checkout uses a fixed Demo Guest identity and `guest@example.invalid`; entered
  contact values are replaced server-side. No identity permissions are provisioned.
- Catering remains disabled; this task does not enable an inquiry channel.

## Real photography and licenses

Eight downloaded photographs; no AI imagery. Exact source pages, authors,
download URLs, retrieval dates, and SHA-256 hashes are in
`public/img/super-tacos/sources.json`. Photos are illustrative rather than claims
that the fictional dishes were photographed. Some catalog items deliberately have
no photo rather than attaching an inaccurate shrimp/drink photograph.

| Assets | Photographer | License |
|---|---|---|
| tacos | We The Creators | [Unsplash](https://unsplash.com/license) |
| asada | Andrea Lacasse | Unsplash |
| burrito | Gaby Aziz | Unsplash |
| churros | WantTo Create | Unsplash |
| nachos | Alejandro Aznar | [Pexels](https://www.pexels.com/license/) |
| quesadilla | ROMAN ODINTSOV | Pexels |
| guacamole | Suzy Hazelwood | Pexels |
| lemonade | Ebru DOĞAN | Pexels |

The photo preparation script can refresh bytes from those public sources; it is
never run by builds or deployment. Review license/source changes before rerunning.

## Payment and abuse boundaries

- Fixed synthetic tenant ID `20000000-0000-4000-8000-000000000001` is verified
  from the authoritative payment connection, never a client “demo” flag.
- Public demo requires exact Staging Supabase hostname
  `jjvongzvtnzlvwdfcnjk.supabase.co`, `MENU_MAN_ENV=staging`, non-Production
  Vercel environment, and both explicit demo/Sandbox enable flags. Missing source
  identity, limiter RPC, configuration or seller/location alignment fails closed
  before order creation. Production `fullaiodvmilkdxyxnln` cannot pass this gate.
- Payment UI has one locked/preselected “Demo payment — no charge” choice, no
  Square card form or iframe. Only a demo sentinel is accepted by the server; it
  is replaced with Square's documented `cnon:card-nonce-ok` test source.
  [Square Sandbox payment sources](https://developer.squareup.com/docs/devtools/sandbox/payments).
  Any arbitrary card/token/fake-provider source for this tenant is rejected before
  attempt reservation. The Square SDK remains hardcoded to Sandbox.
- A dedicated Sandbox seller/location and dedicated server-only credentials are
  required. Existing merchant/location references are unique: the installer aborts
  rather than adopting/reassigning another restaurant's references. Original
  `SQUARE_SANDBOX_*` behavior is retained for other tenants.
- Pricing, modifiers, pickup, tax, tips, idempotency, session capabilities and
  payment-event transitions remain authoritative in existing SQL functions.
  The new wrapper serializes this tenant's creation transactions and limits new
  orders to **5/source/10min and 50/tenant/10min**. Exact retries bypass quota;
  failed creation rolls quota back. No unbounded fallback is permitted.
- A transaction-local entry marker plus demo-only INSERT trigger blocks older
  Preview builds/direct ordinary order RPCs from bypassing the wrapper. It does
  not change ordinary tenants' order creation. Public/authenticated roles cannot
  execute the demo RPC. The service-role credential remains server-only.
- Notification preferences are false and constrained false. A demo-only outbox
  trigger suppresses all order/customer/owner email inserts and updates even if a
  later order transition tries to enqueue one. No mail provider is invoked by QA.
  Catering must stay disabled; enabling it is outside this activation contract.
- Existing authenticated fulfillment supports placed → confirmed → preparing →
  ready → completed. No public management access, automatic owner grants, or
  simulated authorization is added. Sandbox refunds/reconciliation use the same
  dedicated adapter configuration. Demo financials remain staging/test totals;
  existing Production reports select only Production payment environments.

## Local validation

`node scripts/start-super-tacos-demo-offline.mjs` starts Next on 127.0.0.1:3000
with dummy credentials and an explicit test-process-only fetch interceptor.
It substitutes an in-memory fixture for Supabase and Square and rejects other
remote service requests. It is never imported by application code.

In a second PowerShell terminal:

```powershell
node scripts/super-tacos-demo.browser-qa.mjs
```

Chrome additionally blocks all non-localhost requests. It exercises real app UI
and API routing at 320/412/1440: home CTA, required customization, +$1.50 guacamole,
+$0.25 flour tortilla, $5.50 cart subtotal, checkout, locked payment without an
iframe, reconciliation and explicit no-charge confirmation. Artifacts stay under
ignored `.playwright/super-tacos-demo/`.

Recorded validation: 404/404 regressions (15 new demo tests), TypeScript, ESLint,
Next production-mode build using the isolated backend, and all three Chrome
journeys passed. The build is a validation artifact using dummy/offline data;
rebuild with reviewed Staging configuration for any approved deployment.

These results do **not** establish hosted SQL runtime behavior, real concurrent
database quotas, live Square API/webhook delivery, or Super Tacos owner access.
No local PostgreSQL runtime was available. The SQL verification scripts are
prepared but have not been executed. Existing management authorization/lifecycle
regressions pass; an actual authorized owner session remains an activation check.

Application coverage follow-up: 22/22 focused demo tests passed, including seven
new integration tests executing the actual connection resolver, configuration
loader, webhook route, signature verification, normalization and tenant checks.
Database I/O and ordinary payment adapters use synthetic in-memory test doubles;
Square gateway operations are forbidden. Foreign payment/refund events are
rejected before any ingest/drain RPC. Ordinary Square/fake sessions and payment
submissions retain their source and authoritative amount with demo configuration
absent. Typecheck, targeted lint and diff checks passed; no application changes
were needed. The earlier 404/404 regression, build and Chrome evidence is retained,
not rerun or represented as a new full-suite result. Real PostgreSQL concurrency
validation remains a deferred Staging activation gate, not a commit prerequisite.

## Approval gates and exact activation sequence

Nothing below is authorized by this implementation task.

1. Review/commit this bounded diff and the generated installer. Prepare a dedicated
   Square **Sandbox** test seller/location without touching any existing seller.
   Verify it is US/USD/active and its references are unused in Staging. Configure
   the names below in an approved Staging/Preview deployment only; no Production
   values or existing `SQUARE_SANDBOX_*` values should be changed.
2. After deployment/configuration approval, deploy the reviewed code with
   `MENU_MAN_ENABLE_PUBLIC_DEMO_PAYMENTS=false`. Verify source SHA and diagnostics
   identify Staging. Do not reuse the offline build output. The current public
   demo webhook endpoint must remain 404 while the flag is off.
3. After **separate database activation approval**, privately supply the owner
   connection in `MENU_MAN_STAGING_DATABASE_URL`, and dedicated **non-secret**
   Sandbox merchant/location IDs in the two PowerShell variables below. Independently
   confirm the project in Supabase, retain an approved backup/export of Super Tacos'
   current configuration, then run only the guarded installer:

   ```powershell
   psql -X --dbname="$env:MENU_MAN_STAGING_DATABASE_URL" --set=ON_ERROR_STOP=1 `
     --set=menu_man_environment=staging `
     --set=menu_man_staging_project_ref=jjvongzvtnzlvwdfcnjk `
     --set=approve_super_tacos_demo=activate-super-tacos-demo `
     --set="square_merchant_id=$demoSandboxMerchantId" `
     --set="square_location_id=$demoSandboxLocationId" `
     --file=supabase/seeds/staging/015_super_tacos_demo.sql
   if ($LASTEXITCODE -ne 0) { throw 'Demo activation failed. Stop; do not bypass guards.' }
   ```

   The transaction verifies actual direct/pooler project identity, exact original
   fixture shape, no existing operational orders/connections/hours/modifiers,
   reserved-ID collisions, disabled catering and unused Sandbox references. Any
   discrepancy aborts. No other tenant data or existing memberships are changed.
   This is a one-time optional Staging installer, not a schema migration bundle;
   do not mark unrelated migrations applied, run db push, or run it on Production.
   Do not rerun `014_super_tacos.sql` or this installer after activation.
4. Execute `supabase/tests/025_super_tacos_demo_readonly.sql`. With approval for
   synthetic transactional QA, execute `026_super_tacos_demo_transactional.sql`
   (ends with ROLLBACK) and independently test real concurrent sessions. Verify
   5/source quota, tenant/global quota, exact replay at exhaustion, invalid
   modifier rollback, anonymous/authenticated denial, and legacy RPC denial.
   Do not claim concurrency proven from the offline backend. Stop on discrepancy.
5. After runtime activation/deployment approval, set the demo flag true in Preview
   and rebuild/deploy from an isolated verified source export outside the parent
   Vercel linkage. Enable the dedicated Square webhook subscription pointing to
   `/api/webhooks/payments/square/demo-sandbox`; verify signed Sandbox events can
   reach it through deployment protection. Do not disable protection broadly.
   Before opening the demo, retire or restrict obsolete deployments that share
   Staging credentials. The SQL trigger blocks their new order inserts, but it
   does not replace their existing-order read/replay code or card-entry UI. An
   older application baseline is not an approved rollback target while this
   fixture is active. This operational check is an activation blocker, not a
   claim that every historical deployment implements the new demo policy.
6. Run a low-volume, approved staging-backed test with the supported test source.
   Check tampered payment token rejection, exact retry, snapshot/tax/modifier
   amounts, actual Square Sandbox completion and webhook/reconciliation, no
   outbox rows, and no card-entry UI. Sign in with an **already authorized**
   Super Tacos owner and exercise the fulfillment lifecycle; if none exists,
   request a separately reviewed membership operation rather than manufacturing
   access. Keep other restaurants unchanged. Review demo-order retention/cleanup
   separately; no automatic deletion policy is introduced.

Required deployment configuration names (server-only unless already public):

- Existing Staging Supabase URL/public key/service-role key and `MENU_MAN_ENV=staging`.
- `MENU_MAN_ENABLE_SQUARE_SANDBOX=true`; `SQUARE_API_VERSION=2026-08-19`.
- `SQUARE_DEMO_SANDBOX_APPLICATION_ID`, `SQUARE_DEMO_SANDBOX_ACCESS_TOKEN`,
  `SQUARE_DEMO_SANDBOX_MERCHANT_ID`, `SQUARE_DEMO_SANDBOX_LOCATION_ID`,
  `SQUARE_DEMO_SANDBOX_WEBHOOK_SIGNATURE_KEY`,
  `SQUARE_DEMO_SANDBOX_WEBHOOK_NOTIFICATION_URL` (HTTPS, dedicated demo endpoint).
- `MENU_MAN_ENABLE_PUBLIC_DEMO_PAYMENTS` defaults to disabled unless exactly `true`.
- No real email credentials are required for the demo. No Production configuration
  or publication change is part of this release. Super Tacos remains noindex and
  restricted by the existing Production publication policy.

Recovery: disable the demo flag and redeploy to stop new submissions; review pending
Sandbox attempts before resuming. Any DB disable/cleanup requires approval. Preserve
orders, idempotency keys, references and security triggers/constraints. Do not drop
the protections as an application rollback step: older Preview builds must stay
unable to create demo orders. Reconcile outstanding test payments before retiring
the dedicated Sandbox seller. No automatic data deletion or source rollback runs.
