# Proposed v1 file scope

Reviewed 2026-10-21 on `feature/super-tacos-demo`, HEAD `2ee7312412142ad5ad3de6f860c02061e0dd76e1`. No file is staged or committed by this review. This is an allowlist for a future authorized commit review, not a staging command. Recheck status/diff before use.

There are **98 files** in this candidate. Add new components, assets, tests and reports with their callers. Keep each generator, its manifests and generated artifacts together.

Scoped `.gitattributes` rules and Windows/Linux checkout hashes have been reviewed. The Super Tacos logo raw hash changed solely because its CRLF line endings were normalized; its provenance and Production manifest match the new LF bytes. SQL hashes remain unchanged. The SVG LF bytes equal its existing Git blob, so the SVG itself has no content change to commit.

## Application, branding, local QA and sprint handoffs (78)

- `.gitattributes`
- `.gitignore`
- `docs/marketing-sprint-m1.md`
- `docs/marketing-sprint-m2.md`
- `docs/super-tacos-sprint-d1.md`
- `docs/v1-combined-release-readiness.md`
- `docs/v1-release-file-scope.md`
- `img/icons/chef-hat.svg`
- `img/icons/hand-platter.svg`
- `img/icons/rotate-cw-clock.svg`
- `next.config.ts`
- `public/brand/MenuManPhone.svg`
- `public/brand/MenuManPhoneSmol.svg`
- `public/brand/menu-man-svg-sources.json`
- `public/brand/previews/sources.json`
- `public/brand/previews/super-tacos-mobile.png`
- `scripts/fixtures/sprint-d1-armandos.mjs`
- `scripts/marketing-m1.browser-qa.mjs`
- `scripts/marketing-m1.test.ts`
- `scripts/marketing-m2.browser-qa.mjs`
- `scripts/marketing-m2.test.ts`
- `scripts/public-showcase.browser-qa.mjs`
- `scripts/public-showcase.test.ts`
- `scripts/super-tacos-demo-offline-backend.mjs`
- `scripts/super-tacos-sprint-d1.browser-qa.mjs`
- `scripts/super-tacos-sprint-d1.test.ts`
- `src/app/MarketingCapabilities.tsx`
- `src/app/MarketingComponents.tsx`
- `src/app/MarketingIcon.tsx`
- `src/app/MarketingInteractions.tsx`
- `src/app/MarketingReveal.tsx`
- `src/app/RestaurantShowcases.tsx`
- `src/app/about/page.tsx`
- `src/app/build-my-website/page.tsx`
- `src/app/business-information.module.css`
- `src/app/business-review-content.ts`
- `src/app/cancellation/page.tsx`
- `src/app/layout.tsx`
- `src/app/marketing-content.ts`
- `src/app/marketing-reveal.module.css`
- `src/app/page.module.css`
- `src/app/page.tsx`
- `src/app/r/[slug]/CartPanel.tsx`
- `src/app/r/[slug]/DemoNotice.tsx`
- `src/app/r/[slug]/MenuBrowser.tsx`
- `src/app/r/[slug]/OrderItemPanel.tsx`
- `src/app/r/[slug]/RestaurantDemoContact.tsx`
- `src/app/r/[slug]/RestaurantFooter.tsx`
- `src/app/r/[slug]/RestaurantHoursLocation.tsx`
- `src/app/r/[slug]/RestaurantMapViews.tsx`
- `src/app/r/[slug]/RestaurantNavigation.tsx`
- `src/app/r/[slug]/RestaurantPhotoFilmstrip.tsx`
- `src/app/r/[slug]/RestaurantShell.tsx`
- `src/app/r/[slug]/RestaurantSocialSection.tsx`
- `src/app/r/[slug]/RestaurantWordmark.tsx`
- `src/app/r/[slug]/checkout/page.tsx`
- `src/app/r/[slug]/demo-notice.module.css`
- `src/app/r/[slug]/filmstrip-motion.ts`
- `src/app/r/[slug]/layout.tsx`
- `src/app/r/[slug]/location/page.tsx`
- `src/app/r/[slug]/menu-card-ordering.ts`
- `src/app/r/[slug]/menu/page.tsx`
- `src/app/r/[slug]/menu/restaurant-menu-page.module.css`
- `src/app/r/[slug]/restaurant-demo-contact.module.css`
- `src/app/r/[slug]/restaurant-photo-filmstrip.module.css`
- `src/app/r/[slug]/restaurant-shell.module.css`
- `src/app/restaurant-showcases.module.css`
- `src/app/services/page.tsx`
- `src/app/work/page.tsx`
- `src/lib/demo/brand-font.ts`
- `src/lib/demo/catalog.test.ts`
- `src/lib/demo/demo.test.ts`
- `src/lib/demo/presentation.ts`
- `src/lib/demo/server.integration.test.ts`
- `src/lib/marketing-business-pages.ts`
- `src/lib/payments/server.ts`
- `src/lib/public-restaurant-access.ts`
- `src/lib/restaurant-showcases.ts`

## Prepared Production package and read-only tooling (9)

- `docs/super-tacos-public-showcase-release.md`
- `scripts/check-super-tacos-public-release.ps1`
- `scripts/prepare-super-tacos-public-release.mjs`
- `scripts/public-release-guards.test.ps1`
- `supabase/releases/super-tacos-public/armandos-preflight.sql`
- `supabase/releases/super-tacos-public/content.sql`
- `supabase/releases/super-tacos-public/manifest.json`
- `supabase/releases/super-tacos-public/preflight.sql`
- `supabase/releases/super-tacos-public/verify.sql`

## Completed Gate 2 operational corrections and historical handoff (11)

- `docs/super-tacos-showcase-sprint-c1.md`
- `docs/super-tacos-showcase-sprint-c3.md`
- `public/img/super-tacos/approved/logo-provenance.json`
- `scripts/fixtures/super-tacos-psql18-conninfo.txt`
- `scripts/prepare-super-tacos-content-sync.mjs`
- `scripts/super-tacos-tls-preflight.test.ps1`
- `scripts/sync-super-tacos-content.ps1`
- `supabase/qa/super-tacos-content-backup.sql`
- `supabase/qa/super-tacos-content-c1-manifest.json`
- `supabase/qa/super-tacos-content-verify.sql`
- `supabase/seeds/staging/016_super_tacos_content_c1.sql`

## Preserved / excluded

- `AGENTS.md`: the existing heading change is preserved and excluded.
- `.activation-backups/`: explicitly ignored; contents were not inspected or inventoried.
- `.env*`, `.vercel/`, `.playwright/`, `.next/`, `.next-public-showcase-qa/`, test/build output, dependency directories and local logs are excluded.
- Owner source directories were not copied wholesale; packaged runtime assets and provenance records are included where needed.

The psql output fixture contains connection identity/TLS fields only, not credentials. Production SQL files are preparation artifacts; committing them does not authorize execution. The executed Staging 016 must never be rerun. See `v1-combined-release-readiness.md` for checks, limitations and approval gates.
