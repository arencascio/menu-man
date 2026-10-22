# Super Tacos Sprint C.1 — local review

> **C.3 supersedes the catalog inventory and expected content-sync counts in this C.1/C.2 report.** See [Sprint C.3 local handoff](super-tacos-showcase-sprint-c3.md) for the current local state and pending guarded 016 artifact.

Branch: `feature/super-tacos-demo`. Existing uncommitted Sprint A/B/B.1 work is preserved. No database connection/write, schema change, Production change, payment activation, deployment, commit or push was performed. No dependency was added.

## Architecture and rollout boundary

- **Client content:** the revised catalog is `supabase/seeds/staging/super-tacos-demo.json`, now version `sprint-c2`. It drives the local offline fixture. Restaurant pages continue reading authoritative menu/modifier data from the existing server loader; there is no browser-only menu consolidation or new pricing engine.
- Gallery references use retained item IDs, so renames do not hide slides against either the installed 30-item catalog or the proposed 21-item catalog. Other restaurants retain their existing name-based gallery configuration.
- **System pieces:** optional review photos and supplied social artwork extend the existing components. `MenuCardImage` now handles failures both before and after hydration, using the existing neutral placeholder.
- **Variant:** catering keeps its existing layout and local request form, with structured tray/box selections and a shared summary formatter. All options are included in the fixed illustrative price. No inquiry submission, storage, email or booking is introduced.
- **Typography:** the supplied, unmodified Titan One TTF is self-hosted with `next/font/local`; its OFL and source hash are packaged. Only Super Tacos header/footer wordmarks receive the font class. Ordinary links/body typography and Armando's opt-out behavior are preserved.

**Staging still has the installed 30-item catalog.** Only the local fixture is revised. Do not rerun `014` or `015`; those files are unchanged. The old generator now stops rather than rebuilding the frozen activation installer from the new catalog. The separate `016` content sync is prepared, not executed.

## Revised inventory

All abbreviated IDs below use prefix `20000000-0000-4000-8000-000000000`. Tenant ID ends `001`, menu ID ends `002`, and section IDs remain `101`–`106`.

| Item ID | Product | Base price | Required product choice | Approved photo |
| --- | --- | --- | --- | --- |
| 201 | Street Taco | $3.50 | Taco filling | carne-asada-tacos |
| 204 | Grilled Steak Burrito | $12.95 | Salsa/extras | burrito |
| 205 | Burrito | $10.95 | Burrito filling | chicken-burrito |
| 206 | Black Bean Burrito | $8.95 | Salsa/extras | black-bean-burrito |
| 208 | Loaded Nachos | $9.45 | Topping | loaded-nachos |
| 209 | Quesadilla | $8.45 | Filling/topping | quesadilla |
| 210 | House Salsa Sampler | $6.95 | None | salsas |
| 221 | Breakfast Burrito | $10.45 | Breakfast filling | breakfast-burrito |
| 224 | Breakfast Quesadilla | $9.95 | Fixed egg/vegetable recipe | breakfast-quesadilla |
| 227 | Chips & Salsa | $4.50 | None | chips-and-salsa |
| 228 | Cinnamon Churros | $5.95 | Portion | churros |
| 229 | Two Cinnamon Churros | $3.95 | None | churros |
| 231 (new) | Horchata | $3.95 | Drink size | horchata |
| 232 (new) | Chilaquiles Divorciados | $12.95 | None | chilaquiles |
| 233 (new) | Loaded Rolled Tacos | $9.95 | Fixed chicken recipe | loaded-taquitos |
| 234 (new) | Chorizo Queso Fundido | $10.95 | Fixed chorizo recipe | queso-fundido |

There are 16 active dishes: 12 retained identities and four new products. Every active dish has a relevant approved photo. Five canonical items without suitable photographs are now archived from public placements while their item rows, IDs, order references and engagement history remain intact.

### Complete old-to-new identity policy

The following paragraph records the C.1 mapping. C.2 keeps the IDs and prices for items that remain active, adapts IDs 204, 206 and 210 to match their photographs, and retires IDs 207, 211, 212, 223 and 226 for lack of a suitable photograph; the superseding inventory is in the addendum below. Salsa remains optional wherever group 501 is attached. The C.1 catalog retained ID 223 as a breakfast taco pair with an explicit `Eggs & potatoes` choice.

| Old item / ID | Retained product / explicit equivalent |
| --- | --- |
| Carne Asada Street Taco / 201 | Street Taco / Carne asada = $3.75 |
| Grilled Chicken Burrito / 205 | Burrito / Grilled chicken = $11.95 |
| Loaded Asada Nachos / 208 | Loaded Nachos / Carne asada = $13.45 |
| Cheese Quesadilla / 209 | Quesadilla / Cheese only = $8.45 |
| Sunrise Breakfast Burrito / 221 | Breakfast Burrito / Eggs & potatoes = $10.45 |
| Cinnamon Churros / 228 | Cinnamon Churros / Three churros = $5.95 |

The following rows are retained as historical, unorderable identities with inactive attachments and no menu placement; they are **not deleted or repurposed**:

| Old item / ID | New product ID | Explicit replacement choice / option ID |
| --- | --- | --- |
| Al Pastor Street Taco / 202 | 201 | Al pastor / 613 |
| Roasted Mushroom Taco / 203 | 201 | Roasted mushrooms / 615 |
| Citrus Carnitas Taco / 213 | 201 | Carnitas / 612 |
| Citrus Chicken Taco / 214 | 201 | Grilled chicken / 614 |
| Chile Lime Shrimp Taco / 215 | 201 | Grilled shrimp / 617 |
| Crispy Potato Taco / 216 | 201 | Crispy potato / 616 |
| Carnitas Burrito / 217 | 205 | Carnitas / 620 |
| Garden Burrito / 218 | 205 | Black bean & vegetables / 623 |
| Coastal Shrimp Burrito / 219 | 205 | Grilled shrimp / 624 |
| Chicken Quesadilla / 220 | 209 | Grilled chicken / 626 |
| Chorizo & Egg Burrito / 222 | 221 | Chorizo & eggs / 632 |
| Steak & Egg Burrito / 225 | 221 | Steak & eggs / 633 |
| Churros for Two / 230 | 228 | Six churros / 636 |

Existing item IDs, source keys, order snapshots and heart records are not reassigned. Hearts/favorites are not summed or transferred to another product. A favorite for an archived product remains associated with that historical ID and is omitted from the active menu. Old carts are not silently converted: retired items or canonical items missing newly required choices must be reconfigured before ordering. The existing server validator rejects them. Most equivalent configured prices are preserved; the potato taco changes from $3.25 to the new $3.50 taco base.

## Restaurant modifier configuration

All rows belong to the fixed Super Tacos tenant. Existing option IDs 601–610 and group IDs 501–504 remain intact. Nine active groups contain 35 active options. New product choices require exactly one explicit selection, with **no inferred filling or portion default**.

| Group | Min/max | Options and authoritative adjustments |
| --- | --- | --- |
| 501 Choose your salsa | 0/1 | Roja medium (default), Verde mild, No salsa: $0 |
| 502 A little extra | 0/3 | Guacamole +$1.50; cheese +$0.75; crema +$0.50 |
| 503 Choose your tortilla | 1/1 | Corn (default) $0; flour +$0.25 |
| 504 Drink size | 1/1 | Regular 16 oz (default) $0; large 24 oz +$1 |
| 505 Taco filling | 1/1 | Asada/carnitas/al pastor +$0.25; chicken/mushrooms/potato $0; shrimp +$1.25 |
| 506 Burrito filling | 1/1 | Asada +$2; chicken +$1; carnitas +$1.50; al pastor +$1; black bean/vegetables $0; shrimp +$3.50 |
| 507 Choose your topping | 1/1 | Cheese $0; chicken +$3; asada +$4; carnitas +$3.50; vegetables +$2.50; shrimp +$5 |
| 508 Breakfast filling | 1/1 | Eggs/potatoes $0; chorizo +$1; steak +$2.50; vegetables/eggs $0 |
| 509 Churro portion | 1/1 | Three $0; six +$4 |

Attachments place the product choice first. Tacos 201 use 505/501/503/502; burritos 205 use 506/501/502; nachos 208 and quesadilla 209 use 507/501/502; breakfast 221 uses 508/501/502 and 223 uses 508/501/503/502; churros 228 use 509. No per-item override rows are needed. The established loader, integer-cent pricing, cart validation and `create_order_v1` SQL remain authoritative and unchanged. The existing SQL checks both min/max selections and rejects inactive, foreign or unattached options.

## Catering behavior

- **Taco Table — $180, serves 10:** three trays of ten tacos, independent filling selects, duplicates allowed. Defaults are asada/carnitas/chicken. All three tray labels and choices appear in the request summary and editable prefill.
- **Lunch Crowd — $168, serves 12:** two boxes of six burritos, independent fillings, plus wrapped/halved serving choice.
- **Celebration — $225, serves 15:** two trays of fifteen rolled tacos, independently chicken/potato; a cheese/vegetable quesadilla tray choice and salsa preference.
- Every option is included in its package price; there are no hidden or uncalculated option surcharges. These are sample values, not booking offers.
- Details stay in local component state. Sending remains disabled, Enter is prevented from submitting, and there is no backend inquiry, notification, storage or booking.

## Branding and approved assets

- The original 18 approved food derivatives remain. Two additional owner-supplied menu photographs were prepared without cropping: `Chilaquiles Divorciados.jpg` and `Chorizo Queso Fundido.jpg`. All 20 food sources and hashes are in `public/img/super-tacos/approved/provenance.json`.
- Five supplied stock portraits use face-centered 240px derivatives and circular CSS clipping. Automated attention crops were inspected; several missed faces, so explicit focal crops were applied and visually checked. Originals were preserved. Portrait source hashes and crop rectangles are in `approved/avatars/provenance.json`. The single sample-review disclosure explicitly says the pictured people did not provide the quotes; no pictured person is identified.
- The owner confirmed Titan One at `C:\menu-man\public\fonts\titan-one\TitanOne-Regular.ttf`; its SHA-256 matches the packaged TTF exactly. The original TTF, OFL and source hash are in `public/fonts/titan-one/`. The OFL came from the matching local `Downloads/Titan_One.zip` archive. No visitor-installed font is required.
- Supplied Instagram, TikTok and Facebook artwork came from the owner's supplied icon assets. These exact SVGs were checked for active/external content and rasterized to 96px transparent PNGs with original colors/proportions. Source paths, hashes and processing are in `approved/social/provenance.json`. The Instagram/Facebook sources match the previously packaged artwork; TikTok now uses its supplied mark. Original source files remain untouched.
- All profiles remain unconnected and inert. No live/fake profile URLs or endorsements were introduced. No new logo was added.

### Original auto-selected photo retirement

Current Super Tacos presentation, metadata and the revised local fixture use approved photos or neutral placeholders. The old remote-selection downloader is disabled. `sources.json` retains the eight original attribution records and marks them retired from current presentation.

**Physical deletion is deferred:** the installed Staging catalog and frozen activation history still reference `tacos.jpg`, `asada.jpg`, `burrito.jpg`, `churros.jpg`, `nachos.jpg`, `quesadilla.jpg`, `guacamole.jpg`, and `lemonade.jpg`. Deleting those now would break those references. After approved content sync and read-only verification show zero live references, they can be removed following another reference check. No other restaurant's image files were removed.

## Exact Staging content-sync requirements — not executed

Prepared artifacts:

1. `supabase/qa/super-tacos-installed-catalog-v1.json`: expected installed baseline (30 items, six sections, four groups, ten options).
2. `supabase/qa/super-tacos-content-backup.sql`: guarded, read-only content export with tenant/project metadata; no credentials, payment connections or customer/order data are exported.
3. `supabase/seeds/staging/016_super_tacos_content_c1.sql`: separate guarded content transaction. This is not an automatic migration/seed and is not an activation/payment installer.
4. `supabase/qa/super-tacos-content-verify.sql`: guarded read-only post-sync inventory.
5. `supabase/qa/super-tacos-content-c1-manifest.json`: exact hashes for the catalog, baseline and SQL files.
6. `scripts/sync-super-tacos-content.ps1`: local preview/verification by default. It connects only with both `-Execute` and the separately approved `sync-super-tacos-sprint-c2` token.

Future execution prerequisites:

- Separate review/approval of the exact manifest and `016` hash. The operator supplies `-ExpectedSqlSha256`; local catalog/SQL drift fails before connecting.
- Exact Staging `jjvongzvtnzlvwdfcnjk`, database `postgres`, direct host `db.jjvongzvtnzlvwdfcnjk.supabase.co` with user `postgres`, or a Supabase pooler with user `postgres.jjvongzvtnzlvwdfcnjk`. TLS is required. Wrapper uses `verify-full`, `psql -X -w`, and standard pgpass without reading/displaying it. Stop if certificates, credentials, psql, backup or any guard are unavailable.
- A fresh backup (within 24 hours), exported by the prepared read-only SQL, parsed and checked for exact tenant identity, item/placement/group/option/attachment inventory and prices. Retain the backup and SHA256 outside Git. The wrapper verifies it before any connection.
- The installed 30-item baseline must match, with no active/nonterminal orders, no unexpected override rows, no reserved ID collisions and no enabled catering submission. Any drift stops the transaction for review; the script does not repair or adopt unknown data.
- Transaction uses the demo advisory lock, tenant row locks, bounded timeouts, tenant-scoped DML, required-choice postconditions, and before/after checksums of other tenants' catalog rows.
- Expected result: **34 retained item rows, 16 active placements/items, 18 archived identities, six existing sections, nine active groups, 35 active options**. No hearts, orders, tax/ordering settings, payments or notification settings are modified. Retired image URLs are cleared; active item and restaurant hero URLs point to approved images, and the old logo URL is cleared.

Example future operator sequence, only after separate approval:

```powershell
# Use a verified connection and normal pgpass; do not paste credentials.
$connectionArgs = @('-h','aws-0-us-east-2.pooler.supabase.com','-p','5432','-U','postgres.jjvongzvtnzlvwdfcnjk','-d','postgres')
$targetArgs = @('-v','menu_man_environment=staging','-v','menu_man_staging_project_ref=jjvongzvtnzlvwdfcnjk','-v','menu_man_client_tls_mode=verify-full')
$backupPath = '<absolute backup path outside Git>'
# Pin and validate the installed trusted root. Preserve/restore process SSL settings.
$appDataPath = $env:APPDATA
if ([string]::IsNullOrWhiteSpace($appDataPath)) { throw 'APPDATA unavailable; stop.' }
$rootCandidate = Join-Path $appDataPath 'postgresql/root.crt'
$rootItem = Get-Item -LiteralPath $rootCandidate -ErrorAction Stop
if ($rootItem -isnot [System.IO.FileInfo] -or $rootItem.PSIsContainer) { throw 'Trusted root must be a regular file; stop.' }
$trustedRoot = (Resolve-Path -LiteralPath $rootCandidate -ErrorAction Stop).Path
$previousSslMode = $env:PGSSLMODE
$previousSslRootCert = $env:PGSSLROOTCERT
try {
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $trustedRoot
  # Confirm the actual psql \conninfo TLS format before each separate database operation.
  $preflight = (& psql -X -w @connectionArgs -c '\conninfo' 2>&1 | Out-String)
  $sslLines = @($preflight -split "\r?\n" | Where-Object { $_ -match '^\s*SSL connection\b' })
  $tlsLines = @($sslLines | Where-Object { $_ -match '^\s*SSL connection\s*\(\s*protocol:\s*TLS[^,\r\n]*,\s*cipher:\s*[^,\r\n]+(?:,|\))' })
  if ($LASTEXITCODE -ne 0 -or $sslLines.Count -ne 1 -or $tlsLines.Count -ne 1) { throw 'Verified TLS preflight failed; stop.' }
  if (Test-Path -LiteralPath $backupPath) { throw 'Choose a new backup filename; do not overwrite an existing backup.' }
  # psql writes UTF-8 directly, avoiding Windows pipeline encoding conversion.
  & psql -X -w -qAt @connectionArgs @targetArgs -o $backupPath -f supabase/qa/super-tacos-content-backup.sql
  if ($LASTEXITCODE -ne 0) { throw 'Backup failed; stop.' }
  $reviewedSqlSha = '<exact reviewed 016 SHA256 from the manifest>'
  ./scripts/sync-super-tacos-content.ps1 -BackupFile $backupPath -ExpectedSqlSha256 $reviewedSqlSha
  # The preceding command is a local preview only; review its output.
  # Only with separate explicit approval:
  ./scripts/sync-super-tacos-content.ps1 -BackupFile $backupPath -ExpectedSqlSha256 $reviewedSqlSha -Execute -Approval 'sync-super-tacos-sprint-c3'
  $preflight = (& psql -X -w @connectionArgs -c '\conninfo' 2>&1 | Out-String)
  $sslLines = @($preflight -split "\r?\n" | Where-Object { $_ -match '^\s*SSL connection\b' })
  $tlsLines = @($sslLines | Where-Object { $_ -match '^\s*SSL connection\s*\(\s*protocol:\s*TLS[^,\r\n]*,\s*cipher:\s*[^,\r\n]+(?:,|\))' })
  if ($LASTEXITCODE -ne 0 -or $sslLines.Count -ne 1 -or $tlsLines.Count -ne 1) { throw 'Verified TLS preflight failed; stop.' }
  & psql -X -w -qAt @connectionArgs @targetArgs -f supabase/qa/super-tacos-content-verify.sql
  if ($LASTEXITCODE -ne 0) { throw 'Read-only verification failed; stop.' }
} finally {
  if ($null -eq $previousSslMode) { Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue } else { $env:PGSSLMODE = $previousSslMode }
  if ($null -eq $previousSslRootCert) { Remove-Item Env:PGSSLROOTCERT -ErrorAction SilentlyContinue } else { $env:PGSSLROOTCERT = $previousSslRootCert }
}
```

Do not run `015` or the prepared guarded `016` during this sprint. The generated `016` file is for review only. If any prerequisite or guard fails, stop. Do not clear orders, change credentials/configuration, disable protections or modify another tenant to make a guard pass. Any old persisted cart must be reconfigured through the existing menu UI; there is no automatic choice inference or favorites migration.

## Files changed in C.1

- Catalog/content: `supabase/seeds/staging/super-tacos-demo.json`, `src/lib/demo/{presentation.ts,showcase-content.ts,menu-imagery.ts,catering-preview.ts,brand-font.ts}`.
- Presentation under `src/app/r/[slug]/`: `MenuCardImage.tsx`, `RestaurantReviews.tsx`, `restaurant-reviews.module.css`, `RestaurantSocialLinks.tsx`, `restaurant-social-links.module.css`, `RestaurantNavigation.tsx`, `RestaurantShell.tsx`, `RestaurantFooter.tsx`, `restaurant-shell.module.css`, `restaurant-footer.module.css`, `page.tsx`, `catering/RestaurantCateringPreview.tsx`.
- Assets: two food WebPs and updated food inventory; five avatar WebPs/inventory; three supplied social PNGs/inventory; Titan One TTF/OFL/inventory; retirement status in original `sources.json`.
- Preparation/operator scripts: `prepare-super-tacos-content-sync.mjs`, `sync-super-tacos-content.ps1`, `prepare-super-tacos-portraits.mjs`, `prepare-super-tacos-approved-images.mjs`, `prepare-super-tacos-demo.mjs`, disabled `download-super-tacos-photos.mjs`, updated `super-tacos-demo-offline-backend.mjs`.
- Prepared SQL/baseline/manifest: the five files listed above under `supabase/qa/` and `supabase/seeds/staging/016_super_tacos_content_c1.sql`.
- Tests: `src/lib/demo/catalog.test.ts`, `demo.test.ts`, `menu-imagery.test.ts`, `src/app/r/[slug]/menu-card-image.test.ts`, registration in `scripts/run-tests.ts`.
- Documentation: this report and a current-status note in the original demo runbook. Earlier Sprint A/B/B.1 work remains present and uncommitted.

## Targeted validation

- TypeScript and targeted ESLint: passed. `git diff --check`: passed.
- **135 focused tests passed:** catalog identity mapping, gallery continuity, modifier configuration/prices, loader overrides/pagination, cart math/isolation, checkout contracts/replays/tips/pickup, catering restrictions, restaurant routes/actions, image scope/immutability and image failures before/after hydration.
- Offline server-fixture checks: missing filling, foreign option and archived item are rejected; two $6.50 premium tacos produce $13 subtotal, $1.07 tax, $1.95 tip and $16.02 total; exact replay preserves the same order. This is an in-memory fixture result, not PostgreSQL runtime evidence.
- Future wrapper tested locally with synthetic backup data: valid preview makes no database connection; Production target, unreviewed SQL hash and altered backup pricing are rejected before connecting.
- **Chrome at 320px, 412px, 1440px:** 21 cards; required meat blocks Add; premium choices update the existing $6.50 cart subtotal; all tray/box selections and duplicate fillings reach prefill; sample totals remain fixed; no inquiry/order POST; font is loaded from local assets; five circular portraits; supplied Instagram/Facebook marks; inert social profiles; approved route imagery; neutral image fallback; no retired-photo requests; no horizontal overflow. Armando's font/shrink opt-out and cart isolation pass with the synthetic comparison fixture.
- Follow-up **Chrome at 320px, 412px, 1440px:** all three supplied social icons load, profiles remain inert, Titan One is loaded, and there is no horizontal overflow. Screenshots/results: ignored `.playwright/showcase/c1-exact-assets-*`. TypeScript, focused content lint, 22 demo/catalog tests, asset provenance checks and `git diff --check` passed again for this follow-up; earlier 135-test evidence covers unchanged behavior.
- All **28 approved image/icon assets and the font** match their provenance hashes. The immutable `014`/`015` scripts have no diff.
- Screenshots/results: ignored `.playwright/showcase/c1-*`, including home/wordmark, avatars, social, footer, menu, required filling, tray summary, Catering, About and image fallback at each width. Circular crop inspection sheet: `avatar-crops-final.png`.

Visual review covered the desktop wordmark, small-screen avatar framing and mixed-tray summary. Review sample inventory, prices, representative food framing and supplied icon choices before commit. Earlier passing evidence is reused for unchanged navigation animations, review motion, selectors and payment behavior.

**Remaining limits:** no live Staging SQL, hosted checkout/payment, inquiry, or notification was exercised. The prepared SQL has static/contract review only; PostgreSQL execution remains a separate approval/validation step. Physical retirement of the old eight files waits for live catalog references to be removed and verified.

## Sprint C.2 addendum

The table and sync expectations above reflect C.2. The pending guarded 016 SQL, read-only verification SQL and manifest were regenerated locally from the C.2 fixture. The SQL verifies **34 retained rows, 16 active items and placements, six sections, nine active modifier groups and 35 active options**. Every active item must have an approved image URL. Five formerly active IDs are marked not orderable, have menu placements and modifier attachments deactivated, and have image references cleared; their rows and item IDs stay available to historical orders and favorites. The operator wrapper now requires the C.2 manifest and `sync-super-tacos-sprint-c2` approval token. Neither 015 nor 016 was run.

### Current active menu and photo mapping

Prices and item IDs are unchanged. IDs use the `200...` UUID prefix recorded above.

| ID | Active menu item | Price | Approved photograph |
| --- | --- | ---: | --- |
| 201 | Street Taco | $3.50 | `carne-asada-tacos.webp` |
| 204 | Grilled Steak Burrito | $12.95 | `burrito.webp` |
| 205 | Burrito | $10.95 | `chicken-burrito.webp` |
| 206 | Black Bean Burrito | $8.95 | `black-bean-burrito.webp` |
| 208 | Loaded Nachos | $9.45 | `loaded-nachos.webp` |
| 209 | Quesadilla | $8.45 | `quesadilla.webp` |
| 210 | House Salsa Sampler | $6.95 | `salsas.webp` |
| 221 | Breakfast Burrito | $10.45 | `breakfast-burrito.webp` |
| 224 | Breakfast Quesadilla | $9.95 | `breakfast-quesadilla.webp` |
| 227 | Chips & Salsa | $4.50 | `chips-and-salsa.webp` |
| 228 | Cinnamon Churros | $5.95 | `churros.webp` |
| 229 | Two Cinnamon Churros | $3.95 | `churros.webp` |
| 231 | Horchata | $3.95 | `horchata.webp` |
| 232 | Chilaquiles Divorciados | $12.95 | `chilaquiles.webp` |
| 233 | Loaded Rolled Tacos | $9.95 | `loaded-taquitos.webp` |
| 234 | Chorizo Queso Fundido | $10.95 | `queso-fundido.webp` |

Retired from public menu placements for lack of a suitable photo: **207 Quesabirria Trio, 211 Rice & Beans, 212 Hibiscus Agua Fresca, 223 Breakfast Taco Pair and 226 Mint Lime Lemonade**. Their existing prices and records remain stored; their modifiers are disabled only for these archived menu items. Existing prices and active modifiers for all 16 remaining items are preserved.

The approved collection also includes images not assigned to individual menu cards: `carnitas-tacos.webp` remains the homepage hero; `burrito-preparation.webp` supports the About story; `taco-table.webp` supports Catering; `street-tacos.webp` appears in the social feed; and `shrimp-tacos.webp` depicts a selectable taco filling but there is no separate shrimp-only product. These images remain in the approved collection and are not used to misrepresent a different active dish.

### Other C.2 refinements

- Navigation and footer now render the text wordmark with one shared component and the packaged Titan One font. Header and footer retain their own size, placement and contrast; the footer reveal animation remains enabled. Armando's rendering path is unchanged.
- Desktop item-detail dialogs have a viewport-bounded height. The customization form scrolls independently while the Add to Cart action stays available; the media panel is constrained and centers the contained image. Mobile retains its existing full-screen, single-column detail presentation.
- Menu item data can carry separate optional `thumbnail` and `detail` focal points and zoom values. No schema/editor work or default framing change was introduced.
- Design-lab note only: adjacent compact menu sections may share a row on desktop above a configurable breakpoint. Keep each heading, section identity and anchor; keep mobile stacked; align the layout with sticky menu navigation. This is not implemented in C.2.

### C.2 validation

TypeScript (`npx tsc --noEmit`), targeted ESLint, `git diff --check`, and **26 focused catalog, image-scope, image-fallback, detail-frame and demo-policy tests passed**. The C.2 test suite verifies 16 photo-backed active items, five photo-based archival decisions, stable IDs/source keys/prices/modifier groups and generated sync guards.

**Chrome at 320px, 412px and 1440px passed:** 16 active menu cards with all photos loaded and no placeholders; no horizontal overflow; header/footer wordmarks use the same loaded Titan One font and weight; the footer animation appears; the desktop options form scrolls within the viewport-bounded detail modal while its image stays centered; the mobile detail stays full-screen and scrollable; Add remains disabled until a required filling is selected, then adds to cart; Armando's menu stays visible with its existing header opt-out and no Super Tacos wordmark font class. Screenshots and result JSON are in ignored `.playwright/showcase/c2-*` files.

The 016 SQL, read-only backup and verification files were regenerated and hash-manifested for C.2. Preparation output explicitly confirmed neither PostgreSQL script was executed. No database connection, write, Production change, payment change or deployment occurred.
