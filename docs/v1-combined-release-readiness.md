# Menu Man v1 combined release review

Reviewed 2026-10-21. Branch: `feature/super-tacos-demo`.
HEAD: `2ee7312412142ad5ad3de6f860c02061e0dd76e1`.

## Verdict

**The local application candidate is ready for owner release review. Production
content execution and public publication are not ready or authorized.** No
failing focused application test remains. The next operational gate is an
explicitly authorized Production read-only readiness review. The optional
founder page does not block technical v1 readiness.

No database connection, SQL execution, deployment, Vercel setting change,
payment activation, commit, push or merge was performed in this review.

## Working tree and assets

- The tree remains intentionally uncommitted. Exact proposed file scope is in
  `v1-release-file-scope.md`; do not use an indiscriminate `git add .`.
- `AGENTS.md` has an existing Markdown heading change. It is preserved and kept
  separate from the proposed showcase/application scope.
- Found an untracked `.activation-backups/` folder without a Git exclusion.
  Added an explicit ignore rule. Its contents were not opened, changed or
  included in the file inventory. Environment files, `.vercel`, browser output,
  build directories and TypeScript build metadata remain ignored.
- No backup/archive/key/build-output path appears in the candidate file list.
  No new source-photo folder is being included. The intentional 421,298-byte
  `public/brand/previews/super-tacos-mobile.png` is a shipped Work-page asset;
  its source/hash record is included, unlike the ignored QA screenshots.
- Both finalized Menu Man SVGs and the three new imported icons must be added
  with their callers. Logo hashes match their provenance record; no raster
  layers, executable content or external dependencies were found. Navigation
  uses SMOL; footer uses the taller artwork. The old PNG is unused by these
  placements and is not substituted for the new vectors.
- Approved restaurant photos, social icons, avatars, Titan One and its licence,
  Bricolage and Manrope are already tracked. Local asset-import checks and all
  26 Production-package asset hashes pass. No absolute owner-machine path is
  used as an application runtime dependency. Provenance paths are records only.
- The local fixture is unchanged. The Production package matches its source,
  SQL and asset manifest. The Staging manifest also matches all five files.
  No content generator was rerun in this review.

**Newline issue resolved:** Git's system config sets `core.autocrlf=true` and the
repo previously had no `.gitattributes`. Git therefore checked ordinary text out
with CRLF on Windows while the same Git blobs check out as LF on Linux. In this
worktree `git ls-files --eol` confirmed the packaged Super Tacos SVG and its
provenance file as `i/lf w/crlf`; the SVG's LF-normalized bytes had a different
SHA256 than its reviewed raw CRLF bytes. Added path-scoped LF rules in
`.gitattributes` for the hash inputs, generated SQL/manifests, release helpers,
and reviewed Menu Man SVGs. No repository-wide rule or binary-image rule was
added. Normalized only the Super Tacos SVG's line endings and updated its two
asset-hash records; the vector artwork is unchanged. The installed-catalog
snapshot was already LF and its SHA did not change.

An isolated temporary Git repository was made from the 51 hash inputs and the
updated logo provenance record. Two fresh clones checked out with
`core.autocrlf=true` and `false` produced byte-identical files. All Staging and
Production manifest entries, brand SVG hashes, preview image provenance and the
read-only PowerShell release validation passed in both clones. The approved
Staging 016 hash remains exactly
`d9aa552827439f4b19cfa2a655e8ebaed3e80788bcdbe7582e5320090aeba993`.
No SQL file was rewritten or regenerated. The Super Tacos logo asset hash is
now `845bfd533ab3ad3fe601542d279292a06d7bbb4252a834f0fb88a6e1b2fa3115`
(previous CRLF bytes: `9ea45d92228954bc185bc7a60dccd2ab1dda490a159ab60f472f85b2575378b3`).

Already-executed **Staging** 016 SHA256 (historical; never rerun):
`d9aa552827439f4b19cfa2a655e8ebaed3e80788bcdbe7582e5320090aeba993`.

Prepared **Production** `content.sql` SHA256 (not executed or approved here):
`aebea1a939d9b3c4fbb4b4f8b4c72c28cce5b039f5b6bdf3bbc19d1c3806b1f1`.

## Restaurant and marketing review

Super Tacos uses the saved scroll position while modal body locking is active;
mobile navigation closes/unlocks before route changes. The compact header no
longer expands when opening the drawer at a scrolled position. Persistent local
font registration and explicit wordmark font selection survive route changes,
history and reload. Filmstrip auto motion, drag, touch swipe, keyboard controls,
pause and reduced motion pass. The Menu Man CTA expands inside one widget.
Location copy is concise; fictional phone/address actions display explanations
instead of calling or directing to the invented business. Armando's artwork,
shrink opt-out and ordinary contact behavior pass the isolated regression fixture.

Existing M.1 evidence covers sticky marketing navigation and anchor clearance,
SMOL logo proportions, compact numbered questions, process/card reveal-once
behavior, keyboard disclosures/tabs, reduced motion, final CTAs, the two gated
showcases and the phone preview. Measured navigation/logo heights were 72/55px
on mobile and 80/63px on desktop. Pricing remains **$99/month + $299 one-time
startup fee**; pickup ordering and delivery maintenance remain optional add-ons.
The central business contact remains `hello@getmenuman.com`.

The cancellation draft now reflects the owner's working-policy approval:
cancel anytime without penalty, restaurant-owned domain control, a two-week
post-cancellation request window and standard export without extra charge.
There is one discreet proprietary-system/custom-migration scope note. Nonpayment
suspension is omitted. The export window expressly does not establish a deletion
or backup-retention deadline. No billing/refund timing or export delivery SLA
has been invented. Working-policy approval does not itself publish the page.

Cancellation and founder pages remain unavailable in hosted environments;
Services shows a disabled cancellation CTA and footer links remain hidden there.
Local development permits review. Both pages remain noindex and outside the
sitemap. Founder name/introduction, headshot and optional LinkedIn URL are still
missing; no biography or telephone number was fabricated. A verified business
telephone and optional map/Street View embed are nonblocking follow-up inputs.
An actual service agreement and operational export process should be aligned
with the approved working policy separately; no contract was manufactured.

## Public demo safety

- Permanent destinations use the existing `/r/[slug]` application and its
  deployment-configured server data client. There is no per-demo Staging URL
  override. Production must remain on `fullaiodvmilkdxyxnln`; the protected,
  Staging-backed feature Preview is not the permanent marketing destination.
- Both `restaurantShowcases[].routeEnabled` and `.published` remain false.
  The Production proxy and route access checks deny unpublished restaurant
  routes. Marketing links require both switches. Neither grants commerce rights.
- Only the fixed Super Tacos identity receives local sample-cart capability.
  Nonorderable items can still expose modifiers, quantities and cart editing.
  Availability/payment polling is skipped; favorites are local in this mode.
  Existing cart storage validates tenant identity and uses restaurant-specific
  keys. Cross-tenant and legacy-cart isolation tests pass.
- Checkout is unavailable. A direct Production order request is rejected before
  order RPCs. Authenticated payment/session/status and webhook tests verify
  denial before provider/mutation calls, including mismatched environment flags.
  The existing payment-status correction validates the authoritative connection
  before event processing/reconciliation/expiration. Ordinary Square/fake paths
  also pass regression tests. No client flag can authorize a real demo order.
- Production demo payment policy rejects the fixed demo regardless of opt-in
  flags. The content package adds no Square connection/merchant configuration,
  disables pickup/ASAP/scheduled ordering and notifications, and imports no orders.
  No restaurant order can reach a notification-producing order path.
- Super Tacos is explicitly noindex in application metadata, the content package
  sets `is_indexable=false`, and sitemap/publication gates remain in force.

Armando's is a real, separately restricted restaurant, not automatically a
fictional/sample-cart tenant. A Production 404 is not evidence of absent data.
Its prepared read-only summary still requires a real data/media/modifier audit,
owner permission and a separate decision about intended ordering. There is no
approved Armando Production import or payment activation in this package.
Super Tacos readiness does not open Armando's route or marketing link.

## Production content package assessment

Reviewed generator, manifest, all four SQL artifacts and the read-only helper in
`supabase/releases/super-tacos-public/` and the associated scripts.

| Requirement | Review result |
| --- | --- |
| Target | Exact Production reference, direct `db.fullaiodvmilkdxyxnln.supabase.co`, `postgres`, port 5432, database `postgres`; verify-full, pinned APPDATA root and backend TLS. No inferred pooler fallback. |
| Identity | Deterministic reserved UUID namespace; rejects an existing Super Tacos slug/ID or reserved ID in any target catalog identity table. No adoption, upsert or client overwrite. |
| Content | New tenant with 25 current items, 6 sections, 9 groups and 35 options. Staging's 18 historical records and all operational/visitor/analytics/payment data are not imported. |
| Commerce | All items nonorderable, pickup disabled, notifications disabled only for the newly created tenant. No Square configuration, schema changes or live inquiry integration. |
| Preconditions | Required columns and notification initialization trigger; separate approval token, backup SHA attestation and baseline not older than 30 minutes or in the future. |
| Atomicity | ON_ERROR_STOP, SERIALIZABLE transaction, advisory transaction lock, lock/statement timeouts; content/identity/security/fingerprint failure prevents commit. |
| Isolation | Before/after other-tenant content and global payment/order fingerprints; post-install read-only verification must match the original baseline before claiming isolation. |
| Verifier | Exact expected content and scoped counts, disabled commerce, operational-record absence and baseline comparisons; read-only transaction ends with ROLLBACK. |

**Gate C blockers:** byte-stable checkout rules/validation above are unresolved,
and there is deliberately no Production Execute wrapper. The
backup hash is an operator attestation, not independent proof of backup contents,
freshness or restorability. A concrete reviewed execution procedure and verified
Production backup process are required before execution approval. Live schema,
ID collisions, connection availability and backup access are unverified. The
read-only helper does not fill these execution/backup gaps.

The fingerprints include all existing orders/payments. Legitimate concurrent
business activity can invalidate a baseline between checks; their full-table
cost and the 30-second statement limit are unmeasured in Production. Establish
an acceptable operational window/strategy without bypassing these guards.
An isolation failure after COMMIT requires investigation, not a blind rerun or
an assertion that ordinary concurrent activity proves an unintended write.

## Validation and limits

Fresh focused checks in this review:

- TypeScript and ESLint over changed/new TypeScript, TSX and MJS files: passed.
- Public-showcase safety/cart/payment/modifier/package tests: **134/134**.
- Marketing/M.2 tests including M.1, publication gates and approved policy:
  **29/29**. D.1 focused tests: **6/6**.
- PowerShell Production release parse/hash/fail-closed checks: passed, no
  connection. Historical Staging TLS parser cases: **17/17**, no connection.
- Chrome D.1 and updated M.2 checks at **320, 412, 768 and 1440px**: passed;
  hosted-environment simulation denied direct/query bypass routes as expected.
  Screenshots were inspected at mobile and desktop widths. No horizontal
  overflow or runtime error was detected. D.1 console capture now covers all
  warnings: the only warning observed was the pre-existing missing `metadataBase`
  warning, confirmed against HEAD; no additional warning was accepted.
- `git diff --check`: passed in final validation.
- Release hash/PowerShell validation passed in both clean temporary clones.

Reused passing evidence: M.1 Chrome results at all four widths, progressive
enhancement/no-JavaScript and reduced-motion checks; prior Gate 3 local Chrome
25-photo/modifier/$5.25 cart/disabled-checkout/API-denial results at 320/412/1440;
and the owner's completed Gate 2 Staging verification. Historical C.3 failed-
attempt prose is explicitly superseded. No fresh live Staging or Production
verification is claimed. Ignored `.playwright/` results are local evidence, not
commit candidates. Chrome mobile is emulation, not physical-device certification.

No full suite or Production build was run. Existing handoffs document a Webpack
CSS global-selector incompatibility; local Chrome uses default Next/Turbopack.
The actual deployment build and environment must pass Gate B before promotion.
Current Production configuration, protected Preview and public custom-domain
behavior have not been re-queried in this local review.

## Exact separately approved release sequence

**A — Production read-only preflight and backup readiness.** Obtain explicit
read-only Production authorization and secure operator access. Verify exact
project/environment, approved root/TLS, schema/trigger compatibility, empty
reserved identities and backup availability. Use only the read-only helper and
reviewed preflight. Audit Armando independently; keep it closed if incomplete.
Prepare/review backup validation, restore scope and the missing execution
procedure. No content installation is implied by A. Stop on every guard failure.

**B — Safety/application deployment with all routes gated.** After source review
and separately authorized commit/push/deployment, pin the reviewed source commit
and artifacts, with byte-stable manifest validation from the clean release
checkout. Build with the established Production database configuration;
confirm no Staging or offline-QA override, no demo payment opt-in and no changes
to other clients. Deploy the safety/UI application with both restaurant route
and marketing switches false, and business pages unpublished. Verify public 404s
and ordinary-tenant regressions. This needs deployment authorization, not SQL
authorization. Do not deploy before validating the build/environment.

**C — Separate guarded Production content installation.** Only after B's safety
code is confirmed active, approve the exact package SHA, reviewed execution
procedure, verified backup and content scope. Create/validate the approved
backup using that procedure, then capture a fresh preflight baseline immediately
before installation (A's earlier baseline may now be stale). Supply the distinct
`publish-super-tacos-browse-only` approval only under this explicit authorization.
Install once; run the prepared read-only verifier against the original baseline.
Do not use Staging 015/016. An existing tenant/collision/schema/TLS/hash/backup/
fingerprint failure stops the release. After an ambiguous result, inspect
read-only before any retry. No route publication is included in C.

**D — Explicit route-publication approval.** After C's content and isolation
checks pass, authorize opening only Super Tacos `routeEnabled`, leaving its
`published=false`. This is another code/deployment approval. Keep Armando and
optional business pages gated unless independently approved. Payments remain off.

**E — Unauthenticated public hosted QA.** Test the permanent custom-domain route
without Preview/share/bypass credentials at 320/412/1440: all 25 photos, required
modifiers, sample-cart totals/editing, nav, filmstrip, contact safety, noindex and
console behavior. Confirm checkout disabled and direct order/payment denials
with the reviewed safe test procedure, without initiating a real payment or
restaurant notification. Recheck other-tenant/cart isolation. Confirm the deployed
application uses Production, not Staging. Failed QA keeps marketing unpublished;
close the route through an authorized rollback if necessary.

**F — Marketing showcase CTA publication approval.** Only after E passes, obtain
explicit approval to set that restaurant's `published=true` and deploy its
homepage/Work link. Check unauthenticated links, desktop/mobile and the fictional
disclosure. Do not enable Armando's CTA as a side effect. Cancellation publication
and founder publication are separate optional approvals; unfinished About content
does not block the technical showcase release.

Rollback planning belongs in B/C approvals: close publication gates first if a
public failure occurs; retain server safety rather than rolling back to an
unsafe application. Pre-commit SQL failures roll back transactionally. A committed
new tenant is not removed or reinstalled automatically; any recovery requires
read-only diagnosis and separately approved, tenant-scoped action. Do not restore
an entire Production database over unrelated clients as a routine undo.

The artifact checkout issue is resolved, so the release file set is ready for
local commit review after the owner inspects this delta. Gate C still requires
the separate Production execution/backup prerequisites above. None of A–F is
authorized by this report.
