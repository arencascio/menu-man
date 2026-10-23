# Marketing V1.4: navigation and SEO

Base: verified live Production commit 94846201eb05f4c0a616f25f8bc4c8ed37de7139, deployment dpl_wkc7DMKDgN1FnzRZYFwGB5UToBDe. Isolated branch marketing/v1.4-navigation-seo. No unfinished release-pipeline changes were included.

Scope: marketing presentation and technical SEO only. No Operations, Auth, database, payments, restaurant ordering, or infrastructure changes.

## Navigation

Approved header order: How We Help, Services & Pricing, See It Live, Free Website Review, Build My Website. The existing /#how-it-works anchor remains compatible. Review opens the existing modal and has an outlined secondary CTA; Build remains primary. Current page links use aria-current and a quiet CSS indicator. The existing compact menu is used through 1000px to accommodate all five actions; focus, Escape, backdrop, and reduced-motion behavior remain. MENU MAN and RESTAURANT WEBSITES remain visible, including on mobile.

Earlier checked-in marketing reports were audited for header decisions; the owner's V1.4 instructions supply the omitted approved labels and CTA treatment. Footer copy is unchanged.

## SEO before and after

Before: generic Services/Work/Build titles; no per-page marketing canonical or social metadata; Home could inherit a second Menu Man suffix. Marketing sitemap omitted the published Cancellation page and used environment-dependent origins.

After: exact owner-requested absolute titles; unique concise descriptions; self-referencing https://getmenuman.com canonicals and metadataBase for each of the five published marketing pages; Open Graph title, description, URL, site name, and existing Menu Man PNG; Twitter summary cards. Existing approved SVG favicon remains. No new artwork.

Organization JSON-LD appears once per marketing page with a stable @id, actual approved logo, URL, and public contact email. Services adds one Service referencing that organization. No location, reviews, ratings, coverage, awards, or customer claims were invented. Logo provenance is recorded in public/brand/menu-man-svg-sources.json.

The sitemap lists Home, Services, Work, Build My Website, and Cancellation at Production URLs. Existing published restaurant enumeration is retained, with Super Tacos explicitly excluded even if its data flag changes. Nonproduction still excludes tenant enumeration. Robots disallows all crawling on Preview and excludes /ops, /manage, /api/ in Production. Existing Operations/management noindex and Super Tacos layout noindex remain. Robots blocking is not a substitute for those noindex directives.

## Copy audit

Home already explains the managed website offering, searchable menus, hours/location, and ordering paths. Services explicitly covers design/building, hosting/SSL, technical upkeep, menu/content updates, hours/location updates, existing provider connections, and optional launch-ready Menu Man pickup ordering. Approved heroes, pricing, cancellation terms, and sales copy remain unchanged. No substantial new prose is needed or implemented; there are no pending owner copy proposals.

## Indexing and measurement readiness

Public DNS has a google-site-verification TXT record, observed October 23, 2026. This proves a verification token is configured; account access is needed to confirm an active verified Search Console property and sitemap submission/index coverage. No Bing verification metadata/file was found in source; Bing account ownership, imported Google verification, and sitemap submission cannot be confirmed from the repository. No third-party tracking or DNS was added. No llms.txt was added.

## Validation

Normal Production Turbopack build (Next 16.4.2), TypeScript, focused lint, 19 focused metadata/JSON-LD/origin/marketing tests, and git diff --check. Google Fonts needed an unsandboxed network build; the normal build succeeded without source workarounds. Local build uses the exact Staging URL and a nonfunctional placeholder server key, with no database queries required for marketing pages.

scripts/qa/marketing-v14.mjs uses Google Chrome explicitly to check five rendered page titles/canonicals/social metadata and parsed JSON-LD, seven viewport widths, all header labels, CTA modal/Escape behavior, active page links, the legacy anchor, robots, sitemap, and Operations noindex. Screenshots are local ignored QA artifacts under .playwright/marketing-v14. No leads are submitted.

Preview deployment and hosted verification follow the committed local checks. Production promotion is explicitly out of scope.
