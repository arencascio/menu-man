# Marketing V1.3 consolidated copy inventory

Reviewed against Production baseline `9690021f0d14994e25305cb8f1617f189c6a0b6c` on 2026-10-23. Existing branch/worktree: `marketing/v1.3-polish`, nested under the staging-catering-v1 worktree. All changes remain local and uncommitted.

The owner's current V1.3 request is the approval source for the new wording. Historical review suggestions are not approvals. The current V1.2 release and source take precedence over older M.1/M.2 notes, including old pricing and cancellation terms.

## Already implemented before this consolidation

| Item | Evidence and disposition |
| --- | --- |
| Home hero | `src/app/page.tsx`: "Get more customers with a better restaurant website." Kept exactly. |
| Shared Home/Work working-product introduction | `MarketingComponents.tsx`: "See Menu Man in action", the working-demo introduction, EXPLORE LIVE DEMO to `/r/super-tacos`, and I WANT A SITE LIKE THIS to `/build-my-website`. Approved V1.1 content retained. |
| Approved showcase description | `src/lib/restaurant-showcases.ts` already contains exactly: "A custom restaurant website with a searchable menu, item customization, simulated checkout, and a catering request form." Retained on both Home and Work. |
| Fictional/demo disclosure | Shared showcase disclosure identifies fictional demonstrations; its description explicitly says simulated checkout. Retained. |
| Catering demo descriptions | Existing catering preview describes sample packages and prices for a fictional showcase, with no booking or real request submission. No restaurant copy or behavior changed. |
| Main navigation | How It Works to `/#how-it-works`; Services & Pricing to `/services`; Work to `/work`; Free Website Review opens the dialog; Build My Website to `/build-my-website`. Retained. |
| Services and footer cancellation links | Existing links lead to `/cancellation`. Retained. |
| Current pricing and billing timing | $300 setup at project start; no monthly charges during build; $99/month begins at completed launch; $0.50 per completed Menu Man pickup order, capped at $50/month. Existing provider links have no Menu Man per-order fee. Retained. Existing delivery-update add-on prices also remain unchanged. |
| Current Cancellation page | `src/app/cancellation/page.tsx` and `business-review-content.ts` unchanged. V1.2 policy includes cancellation/shutdown or paid-through service, restaurant-owned domains, 90-day export requests, no guaranteed restoration, current billing/refund terms, and possible reactivation/setup fees. |
| Provider logos/assets | Six approved fullmarks, public asset organization, fonts, imagery, and source provenance retained. |
| Favicon fix (existing local work) | Supplied `public/brand/MenuManVerySmol.svg`, versioned metadata `/brand/MenuManVerySmol.svg?v=1.3`, and deletion of conflicting `src/app/favicon.ico` retained. |
| Home FAQ cancellation link (existing local work) | "What happens if I cancel?" links directly to `/cancellation`. Retained. |
| Same-origin demo return links (existing local work) | Four Super Tacos sample-checkout return links use `/` instead of a Production hostname. Presentation/navigation only; simulated payment behavior retained. |
| Review submit label | GET MY FREE WEBSITE REVIEW already existed; retained as a distinct submit label. |

## Approved but not implemented at intake: now implemented

| Approved V1.3 item | Implementation |
| --- | --- |
| Work hero heading | "See Menu Man in action." |
| Work supporting text | "Explore Super Tacos, our interactive restaurant website demo. Browse the menu, try the ordering experience, and see what your customers could have at their fingertips." |
| Work primary CTA | EXPLORE SUPER TACOS to `/r/super-tacos`, reusing the approved demo icon. |
| Work secondary CTA | I WANT A SITE LIKE THIS to `/build-my-website`, with secondary link styling. |
| Clear Work hero disclosure | "Super Tacos is a fictional restaurant demo with simulated checkout." The existing showcase disclosure is also retained. |
| Review dialog description | "We'll take a look at how customers find your restaurant online, including your website, menu, hours, location, and ordering options. Then we'll show you where there's room to improve." |
| Supporting review CTA labels | Shared `CTA_LABELS.review` now reads Free Website Review, including Home, final CTA, default review buttons, and the dialog eyebrow. Navigation/footer already used this wording. |
| Review form submission | `CTA_LABELS.reviewSubmit` preserves GET MY FREE WEBSITE REVIEW on the submit button only. Fields, validation, persistence, analytics events, and delivery behavior are unchanged. |

No confirmed V1.3 copy item remains unimplemented.

## Proposed and awaiting owner approval

- Work metadata still describes an "illustrated product overview". Consider updating that description to match the interactive demo. This subjective metadata change was not approved, so it is unchanged.
- Earlier M.2 founder/About content remains unpublished and outside this release. Owner biography and publication approval are not inferred from earlier drafts.
- Optional consistency review: the new Work hero says EXPLORE SUPER TACOS while the previously approved shared product/card actions say EXPLORE LIVE DEMO / Explore live demo. Their destinations agree. Existing approved wording is preserved rather than globally renamed without approval.

## Superseded or rejected

| Older wording/proposal | Current decision |
| --- | --- |
| Proposed Home hero: "Make it easier for customers to choose your restaurant." | Rejected for this release. Preserve the exact current Home hero. |
| Proposed Work hero: "Want a website like this?" and short fictional-demo description | Superseded by the explicit V1.3 Work heading and supporting text above. |
| Previous Work hero: "A closer look at the product." | Replaced by the approved V1.3 hero. |
| Proposed review scope: "We review your menu, mobile experience, hours, location, and ordering path." | Superseded by the owner's longer V1.3 dialog description. |
| Old supporting review copy: "Share the basics..." and "Free restaurant website review" | Replaced by the approved dialog description and standardized label. |
| Using GET MY FREE WEBSITE REVIEW for every supporting CTA | Superseded. Retain it only for form submission. |
| V1.1 "fully-featured" / "simulated ordering" / "catering request preview" showcase description | Superseded by the exact currently approved searchable-menu/item-customization/simulated-checkout/catering-form description. |
| Old "Explore the product" supporting link | Superseded by approved demo and site-inquiry actions; current navigation remains Work. |
| Older $299 startup wording | Superseded by V1.2's $300 setup at project start. |
| M.2 two-week export-request window and unpublished cancellation draft | Superseded by the approved current Cancellation page with a 90-day request window. No older terms restored. |
| Older typographic provider placeholders | Superseded by the approved V1.2 provider fullmarks. |
| Review comparison experience, invented promises, guarantees, or turnaround times | Excluded by the current owner instructions. No new promises or comparison UI added. |

## Final audit and release scope

Home, Services, Work, Build My Website, review dialog, FAQ, and Cancellation were reviewed. New customer-facing wording contains no em dashes. CTA destinations, pricing, cancellation policy, fictional disclosures, and the existing catering preview remain consistent. No subjective neighboring copy was independently rewritten.

The incidental AGENTS.md difference changed only the generated Next.js heading from `#` to `##`, matching `generate-agent-files.js`. It was restored to HEAD; it is not a release change. No restaurant CSS, dependencies, Next configuration, environment files, Auth, Operations, or database files were changed.

Validation is recorded below. Commit and deployment require owner final review; neither is performed in this task.

## Sources reviewed

- Current approved owner V1.3 request.
- [Marketing V1.2 release](marketing-v1.2-release.md), commit `cdc7a10`, retained in the combined Production baseline.
- [Original V1.3 copy review](marketing-v1.3-copy-review.md), consolidated in place here; its four subjective proposal rows were reconciled with the owner's explicit instructions.
- [V1.1 final polish history](final-marketing-polish-v11.md), commit `b45b9bd`, and [M.1 history](marketing-sprint-m1.md).
- [M.2 review history](marketing-sprint-m2.md), read with the newer V1.2 policy taking precedence.
- [Super Tacos showcase history](super-tacos-showcase-sprint-c1.md) and current showcase/catering source.
- Git ancestry: `9690021` includes Operations commits `ecb5d12` and `c3477f7` above marketing `cdc7a10`. This marketing branch starts at that exact baseline; Operations changes are retained without modification.
## Validation results

- Typecheck: `node node_modules/typescript/bin/tsc --noEmit --incremental false`, exit 0.
- Focused ESLint on the changed TS/TSX source: exit 0.
- Existing asset checks: `node --import=tsx --test --test-isolation=none scripts/marketing-v12.test.ts`, 3/3 pass. All 154 legacy replacements, supplied provider variants, and active asset references remain valid.
- Google Chrome with a local Webpack development server at `127.0.0.1:3133`: 15 route/viewport combinations pass at 320, 412, and 1440px across Home, Services, Work, Build My Website, and Cancellation. Exact approved hero/dialog copy, both Work destinations, review labels/submit distinction, FAQ cancellation link, mobile navigation, all rendered images, provider cards, pricing, and one versioned SVG favicon pass. No horizontal overflow or browser page errors. Work heading clearance also passes at all three widths.
- Reviewed screenshots of the desktop Work hero and 320px review dialog. Browser evidence is ignored under `.playwright/marketing-v13/`; no form was submitted. External/API requests were blocked. The local server used process-only placeholder configuration, with no credential or environment-file changes.
- `git diff --check`: passes. No new customer-facing em dashes. Current Cancellation policy source and restaurant CSS match the Production baseline. No Auth or Operations source changes.
- Production build: `npm run build`, exit 0, using Next.js 16.4.2 with Turbopack. Vercel's successful Production deployment for baseline `9690021` records the same command and toolchain. Local Webpack is not the deployed build toolchain; its CSS Modules purity checks reject two unchanged baseline selectors (`restaurant-delivery-chooser.module.css:95` and `restaurant-shell.module.css:21`). No CSS validation was disabled and no restaurant CSS was changed.

## Remaining release gate

The requested copy and retained local fixes passed the production build toolchain and are ready for Preview review. The local Webpack-only CSS Modules errors do not occur with the Turbopack toolchain used by the successful Production deployment. No restaurant CSS or bundler configuration was altered. Production promotion remains a separate approval gate.
