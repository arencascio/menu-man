# Public restaurant showcase handoff — Gate 3 preparation

Status: local preparation only. Nothing in this package authorizes Production SQL,
publication, a deployment, Vercel changes, or payment activation.

Prepared `content.sql` SHA256:
`aebea1a939d9b3c4fbb4b4f8b4c72c28cce5b039f5b6bdf3bbc19d1c3806b1f1`.

## Hosting and release boundary

Use the existing `menu-man` Next.js application and permanent custom-domain routes
`https://getmenuman.com/r/super-tacos` and `/r/armandos`. Their server-side loaders
use the deployment's database, with no connection override for a demo slug.
The Production Vercel environment is configured for `fullaiodvmilkdxyxnln`; the
feature Preview uses `jjvongzvtnzlvwdfcnjk` and remains behind Vercel protection.
Never point public Production at Staging or use a temporary bypass/share URL.

The earlier Gate 3 report incorrectly inferred missing Production records from
404s. `src/lib/public-restaurant-access.ts` and `src/proxy.ts` deliberately block
both slugs in Production. Their current data completeness is **unverified**.
The `restaurantShowcases[].routeEnabled` and `.published` switches remain false.
The first opens a verified permanent route; the second enables its marketing CTA
only after unauthenticated hosted QA. The CTA requires both. Marketing cards
therefore have no restaurant link yet. Each restaurant is released independently.

Classification: cart preview is a small **System Piece** capability; the fixed
Super Tacos identity, fictional content and release switches are **Client Pieces**.
Existing restaurant presentation variants are reused.

## Interactive, non-orderable menu

`is_orderable=false` previously hid modifier controls and Add to Cart. The new
explicit `cartPreview` capability preserves required/optional choices, quantity,
instructions, cart editing and integer-cent totals using the existing components
and restaurant-scoped localStorage cart. It never changes database orderability.
Favorites in this mode stay in browser state. Availability and active-payment
polling are skipped. Armando's retains the ordinary component defaults.

The cart identifies sample prices and disables checkout. A direct Super Tacos
checkout page renders an unavailable explanation before loading customer details.
This is reinforced by the existing authoritative order guard: the fixed demo
slug cannot call an order RPC in Production, even if demo/Sandbox flags are true.
Payment connection validation now occurs before status reads can drain events,
reconcile or expire a disabled demonstration's payment. Normal connections still
follow the existing payment path. Capability checks and provider policy remain.

No demo payment flags, merchant IDs, secrets or Square connections are added.

## Separately reviewable Production content package

Canonical generator: `scripts/prepare-super-tacos-public-release.mjs`.
Output: `supabase/releases/super-tacos-public/`:

- `content.sql`: a new-tenant-only transaction, independent of 014/015/016.
- `preflight.sql`: read-only schema, collision and baseline fingerprint checks.
- `verify.sql`: read-only exact content and baseline isolation checks.
- `armandos-preflight.sql`: read-only readiness summary for the existing real tenant.
- `manifest.json`: SHA256 hashes of generated SQL, generator, fixture, theme,
  all menu photographs, hero image and logo.

The content transaction stops for **any** existing Super Tacos slug/ID or reserved
identity in any target catalog table. It never adopts, upserts, deletes or repairs
an existing tenant. It creates only the 25 current items, six sections, nine groups,
35 options, placements/attachments, profile and illustrative hours. All items are
non-orderable, pickup/ASAP/scheduling are false, and `is_indexable=false`.
Historical Staging rows are not imported. No orders, payments, provider references,
visitors, analytics, memberships, delivery integrations or catering inquiries are
copied. No schema alterations are included.

The core schema's restaurant-insert trigger automatically creates notification
settings. The sole UPDATE disables those defaults **only for the new tenant just
created in this transaction**. The existing default refund-policy trigger also
runs normally; no refund/payment capability is granted or configured.

Runtime guards require the exact Production project, direct hostname
`db.fullaiodvmilkdxyxnln.supabase.co`, `postgres`, port 5432, database `postgres`,
client `verify-full`, `%APPDATA%\postgresql\root.crt`, and backend TLS. No pooler
hostname is guessed or accepted. If direct access is unavailable, stop for a
separately verified Production connection review; never substitute Staging.
The notification initialization trigger and every required content column must
exist. Missing/different Production schema is a stop condition, not permission
to apply Staging migrations.

The transaction requires a separately approved `publish-super-tacos-browse-only`
token, the operator's verified Production backup SHA256 and a preflight baseline
under 30 minutes old. The backup SHA parameter records the operator's attestation;
SQL cannot independently establish a backup file's provenance or completeness.
Review/verify that backup using the operator's Production backup process before
any execution. No backup is created or handled by the preparation tooling.

Before/after SHA256 fingerprints cover other tenants' affected content tables
and all existing payment configurations, references, payments, attempts, refunds
and orders. Any mismatch aborts. Normal concurrent business activity between
preflight and installation can invalidate the baseline: stop and inspect rather
than bypassing comparison or blindly retrying. SERIALIZABLE isolation, lock/
statement timeouts and ON_ERROR_STOP keep a failed transaction uncommitted.

## Safe local and future read-only checks

Local, without a database connection:

```powershell
node scripts/prepare-super-tacos-public-release.mjs
powershell -NoProfile -File scripts/check-super-tacos-public-release.ps1 -Mode Validate
powershell -NoProfile -File scripts/public-release-guards.test.ps1
```

After separate authorization to run Production preflight:

```powershell
# pgpass must already contain the exact approved Production host/user entry.
# Do not read or display pgpass. Choose an ignored location outside Git for output.
powershell -NoProfile -File scripts/check-super-tacos-public-release.ps1 -Mode Preflight -BaselinePath <private-baseline-path>
```

The helper pins the existing regular-file root certificate, exact host/user/port,
`PGSSLMODE=verify-full` and `default_transaction_read_only=on`, and restores prior
environment settings in finally. It validates source, SQL and asset hashes before
connecting. It has **no Execute mode**. After a separately approved installation,
run the same helper with `-Mode Verify` and the original baseline. Fingerprints
must compare successfully before claiming tenant/payment isolation.
`-Mode ArmandoPreflight` runs only the separate readiness report using those same
pinned TLS and exact Production connection settings; it needs no Super Tacos baseline.

No Production preflight, schema probe, backup or content SQL was run during this
local Gate 3 task. The SQL still needs operator/schema review and a concrete
approved execution procedure with backup validation; it is not an execution approval.

## Armando's requirements

Do not treat Armando's as fictional or apply the Super Tacos IDs/content/commerce
policy to it. Production publication is currently explicitly gated. Before opening
it, use the prepared read-only report to establish the real Production tenant,
active published menu, sections, photos, actual ordering settings and presence of
an active payment route. Inspect its modifier correctness, owner permission to
showcase the site and media, and the intended live-ordering posture separately.
Provisional Staging menu/modifier data is not an approved Production import.
No Armando content write or activation is prepared here. Keep its CTA and route
gate closed until these checks pass.

## Marketing and release order

The existing homepage showcase area and `/work` gallery contain the same compact
two-card component. Approved local food imagery, concise benefit copy and a clear
fictional/ordering-unavailable disclosure distinguish the two presentations.
Armando's uses its existing local carnitas image; Super Tacos uses the approved
loaded-nachos photograph so the cards are visually distinct. The Super Tacos
restaurant hero retains its approved carnitas-tacos image.
The gallery and existing marketing flow remain in place; no additional sales page
or large marketing section is introduced.

1. Review the code, server safety change and new content artifacts/hashes.
2. Separately authorize Production read-only preflights and verify schema/data
   readiness for each restaurant. Stop if Super Tacos already exists or IDs collide.
3. Approve and deploy the safety/UI changes with all release switches false.
4. Separately approve a verified Production backup and the new-tenant content
   transaction/execution procedure. Install once, then run read-only verification
   with successful original baseline fingerprint comparison. Never run 015 or 016.
5. Approve opening **only** each ready route via its `routeEnabled` switch. Deploy that
   release and confirm an unauthenticated custom-domain visitor can browse it,
   customize/sample-cart Super Tacos, and cannot create orders or payments.
6. After hosted QA passes, approve setting that restaurant's `published` switch
   true and deploy the marketing link. If hosted QA fails, leave that link gated.
   Do not enable an Armando link just because Super Tacos is ready.

This task creates no commit and performs none of these release operations.

## Local validation evidence

Offline Google Chrome QA passed at 320px, 412px and 1440px, using the existing
fixture transport and a separate localhost port/build directory. Both the browser
and server blocked external requests. The 25 fixture items were explicitly
non-orderable, matching this Production package. All photographs loaded; Street
Taco and Super Taco required modifiers remained usable; the configured sample
Street Taco totaled $5.25; checkout stayed disabled. The direct checkout URL
displayed its unavailable explanation. Marketing cards, gating, catering and
horizontal overflow checks passed. Menu/cart interactions sent no POST requests.
A valid local order POST returned 503/ORDERING_DISABLED and a schema-valid payment
POST without a capability returned 401/INVALID_PAYMENT_SESSION. No provider call
or database write was made. Screenshots/results: `.playwright/public-showcase/`.

The focused regression runner passed 134/134 tests. It exercises Production order authorization with a
valid source, authenticated demo payment denials, ordinary Square/fake payment
behavior, cart/modifier rules, publication gates, noindex and package hashes.
The PowerShell tests cover parsing, local manifest validation and failure before
connection for missing APPDATA/certificate or an unsupported execution mode.
TypeScript, targeted ESLint, PowerShell guard tests and `git diff --check` passed.

Default Next/Turbopack was used for Chrome QA. An initial Webpack attempt hit the
already documented global-selector CSS-module incompatibility; the existing
restaurant CSS was not changed for it. No full test suite or live Production SQL
was run. Production schema, live content, backup provenance, secure connection
availability and unauthenticated hosted publication remain release prerequisites.
