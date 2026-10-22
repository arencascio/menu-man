# Marketing V1.2 release review

Worktree: `C:/menu-man/.worktrees/marketing-v1.2`
Branch: `release/marketing-v1.2`
Parent baseline: `b45b9bde402a2adbdc9ad3652ccb355a61174f87`

## Scope

Services retains its approved heading and provider paragraph. The six supplied fullmarks remain ordered Square, Clover, Toast, DoorDash, Uber Eats, Grubhub, with warm off-white card backgrounds, per-logo intrinsic dimensions from the SVG viewBoxes (rounded to pixels), natural aspect ratios, accessible names, and error fallbacks. Square's original SVG is unchanged: its former pure white surface was CSS.

The public `/cancellation` route uses three sections and is linked from Services and the footer. It covers cancellation without penalty, immediate shutdown or service through the paid-through date, restaurant-owned domains, a standard restaurant-information export request within 90 days after cancellation, and possible longer preservation of design/function without guaranteed restoration. Setup and subscription payments are nonrefundable and there are no prorated refunds for unused subscription time, except where required by law. Reactivation/setup fees may apply if a former customer returns.

Public pricing is $300 setup at project start, no monthly charges while building, and $99/month starting at completed launch with monthly anniversary renewals. Services, inquiry copy, shared pricing and FAQ agree.

The manual process is in [cancellation-export-procedure.md](cancellation-export-procedure.md). No cancellation, data retention/deletion, billing, payment, or restoration automation is added. Before publication the owner must assign the primary/backup operators and confirm private export storage, reminders, shutdown and billing cancellation processes. This task performed none of those operational actions.

## Asset audit

`marketing-v1.2-assets.json` maps every one of the production baseline's 154 legacy `img/` files to an unchanged public replacement, with content hashes. The main staging worktree's 149-file set was separately verified as a matching subset. Binary assets were compared byte-for-byte; SVG comparisons normalize only CRLF to LF. All 19 supplied provider branding variants are preserved with hashes, including the six active fullmarks. Four supplied DoorDash SVGs retain their original whitespace-only blank lines; narrow Git whitespace attributes exempt only those vendor files from blank-at-EOL warnings. Compact delivery selectors remain in `public/img/icons/`.

The active public torn-edge variant is unchanged. The distinct original is preserved in `public/img/edges/source-originals/`. Armando's migrated folder contains only the supplied restaurant logos and taco photograph; no customer records, exports, or credentials are added. Existing browser URLs such as `/img/pepper.svg` and `/img/carnitas-tacos-bg.jpg` remain valid. Required static imports now use public paths; no active root `img/` imports remain.

Exact scoped Git paths are in [marketing-v1.2-inventory.txt](marketing-v1.2-inventory.txt). Operations source, lead persistence, analytics changes, AGENTS.md, Next configuration/proxy changes, credentials, backups, dependency trees and temporary QA files are excluded. The source and Operations worktrees were only read. This release starts from production and does not merge Operations V1.

## Validation

- Generated local Next.js route types, then TypeScript with `--noEmit --incremental false`: passed.
- Targeted ESLint and Git diff whitespace checks: passed.
- 32 focused marketing/mock lead and analytics/asset/reference tests: passed, plus the existing delivery-icon assertions.
- 175 local asset HTTP checks and Home, Services, Cancellation, Build My Website routes: passed.
- Google Chrome at 320, 412, 768, 1440px: passed logo loading, warm surfaces, no duplicate labels, no page overflow, cancellation/footer navigation, browser Back, Home navigation, and forced logo-error fallback without card height shift.
- Screenshots were visually reviewed for all four widths. Local artifacts are in ignored `.playwright/marketing-v12/`, including provider cards, provider sections, pricing cards and cancellation pages. The Next development indicator can appear in these local screenshots.

Commands:

```powershell
node node_modules/next/dist/bin/next typegen
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --import=tsx --test scripts/marketing-m2.test.ts scripts/marketing-v12.test.ts 'src/app/r/[slug]/RestaurantDeliveryProviderIcon.test.ts'
node scripts/qa-marketing-v12.mjs
```

The V1.2 QA script expects the isolated local server at `127.0.0.1:3122`. It blocks external browser requests and non-GET requests. No credentials were copied. Local QA used placeholder data configuration and never requested a restaurant data route or submitted a form. Next agent detection was suppressed only in the temporary QA process to honor the instruction not to modify AGENTS.md. Historical M.1/M.2 documents and their old manual browser scripts describe those releases; the current V1.2 policy/pricing acceptance is the test and QA script above.

## Release actions

One local marketing release commit is authorized after scope and checks pass. No push, deployment, database action, payment operation, or source/Operations worktree edit is authorized or performed. Owner visual and release review remains before publication.
