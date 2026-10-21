# Marketing Sprint M.2 business readiness review

Branch: `feature/super-tacos-demo`.
HEAD remains `2ee7312412142ad5ad3de6f860c02061e0dd76e1`.

## Owner update — 2026-10-21

The owner has now approved the proposed cancellation/export terms as working
business policy. This supersedes the unresolved-policy status in the original
review below, which is retained as source-review history. The cancellation
draft now states cancel-anytime/no penalty, restaurant-owned domain control,
and a two-week request window for a standard export at no extra fee. The window
does not establish a deletion or backup-retention deadline. Proprietary
platform/template and custom migration exclusions appear in one discreet note;
nonpayment suspension is omitted from marketing copy.

Publication is still separately gated. Founder details remain optional release
follow-up and do not block technical v1 readiness. No executed service agreement,
billing/refund timing, export delivery SLA, deletion deadline or retention policy
is inferred from working-policy approval. See `v1-combined-release-readiness.md`
for current validation and release dependencies.

## Original M.2 review (before owner approval)

The cancellation and founder pages are prepared for local review. They are
not ready for public publication: policy confirmation and founder information
are still missing. No business terms have been adopted through this sprint.

## Pages and links

| Page or entry point | Local development | Hosted/unapproved state |
| --- | --- | --- |
| `/cancellation` | Review draft with proposed approach and expandable confirmation notes | 404 |
| Services “What happens if I cancel?” | Links to `/cancellation` | Disabled with review status |
| Footer cancellation link | Visible | Hidden |
| `/about` | Menu Man founder draft with explicit placeholders | 404 |
| Footer “About Menu Man” | Visible | Hidden |
| LinkedIn | Inert owner-URL placeholder | No fabricated destination |

The main navigation is unchanged. The founder page is distinct from
restaurant `/r/[slug]/about` routes. Both new pages have `noindex, nofollow`
metadata and remain absent from the sitemap. Noindex is supplementary;
the server route guard actually denies access in hosted environments.

Publication flags in `src/lib/marketing-business-pages.ts` remain `false`.
Review access is limited to development with no Vercel environment and an
unset, development or staging Menu Man environment. Production, unknown
environment labels and hosted Preview fail closed. Query parameters do not
enable preview access. There is no environment variable that publishes a page.

## Source review

The sources available for this review were working business documents, not
an executed service agreement:

1. Repository `business_model.md`: managed restaurant websites, existing
   ordering-provider positioning and $99 working base price. Its setup price
   is still TBD, and domain/cancellation/website ownership are open questions.
2. Owner file
   `C:/Users/cowbe/OneDrive/Documents/Menu Man/_product/Menu_Man_Product_Slate_v0.1.docx`:
   **Internal working draft**, v0.1, September 19, 2026. Paragraph numbers below
   refer to the nonempty document-body paragraphs extracted in document order.
   - 45–55: included website, hosting, domain connection, menu, routine updates,
     existing ordering links, SEO, analytics and human support.
   - 48 and 70: restaurant should generally own its domain and maintain/pay
     for its own third-party accounts/domains unless contracted otherwise.
   - 58–66 and 133–143: exclusions and separately scoped custom project work.
   - 176–179: cancellation terms **TBD**, to match the contract.
   - No two-week export window, free standard export entitlement, deletion
     deadline or backup-retention policy was found in this document.
3. Owner file
   `C:/Users/cowbe/OneDrive/Documents/Menu Man/_product/Menu_Man_Sales_Pitch_Framework_v0.1.md`:
   **Working sales strategy document**.
   - Lines 207–218: no long-term contract/cancel-anytime sales direction.
   - Lines 386–403: ownership/exit transparency and general domain ownership
     direction; says export and cancellation details need definition.
   - Lines 959–972: exports, cancellation, backups, handoff and continuity
     still need an operational answer.
4. Current marketing content/M.1 plus the owner's current M.2 instructions:
   authoritative public price is **$99/month plus $299 one-time startup fee**;
   established business contact is **hello@getmenuman.com**.

Source SHA256 values at review:

| Source | SHA256 |
| --- | --- |
| `business_model.md` | `39eef1357638f7c292f20e0c0651737277d5fb9cf9a6e5f465ef92187e53c806` |
| Product Slate DOCX | `e4d62860c11daf3a7917814f35033d97f7f3597bb5aff363fac22130ae1eab86` |
| Sales Framework Markdown | `1f03805fc96fa475e56d5f1b095d97eb80d5c24f7ae9b51025940032370710b3` |

### Older pricing conflicts

The product slate lists $149/month and a working $199 setup fee. The sales
framework contains an older $1/order, $30-cap proposal. These are not restored
or represented as current public prices. Current public pricing and optional
service prices from M.1 remain unchanged. The private source documents were
not edited or copied into public assets.

## Policy confirmation required

| Topic | Evidence and review decision |
| --- | --- |
| Cancel anytime | Supported as sales direction, not verified contract language. Confirm cancellation method and any notice requirement. |
| No cancellation penalty | Not verified. No unconditional no-penalty promise is made. Confirm final charges/refunds separately. |
| Managed service ends | Proposed for review. Confirm effective cancellation date, billing-period relationship and hosting shutdown timing. No continued-hosting period is promised. |
| Domain ownership/control | General direction supported in the slate, framework and existing FAQ. Confirm registrar account ownership/access and responsibilities for the individual agreement. |
| Raw menu/business-information export | Proposed handoff scope. Confirm entitlement, fields, file format, delivery process and turnaround. No export endpoint or operational automation was built. |
| Two-week request window | Not verified in the reviewed sources. It appears only in a confirmation note, not as an offered deadline. |
| Standard export without added fee | Not verified. No free-export promise is made. |
| Source code/system/templates excluded | Proposed boundary needs owner/legal approval, including applicable licences. Not treated as already contracted. |
| Custom migrations excluded | Custom project work is separately scoped in the slate; exact migration exclusion/pricing still needs agreement approval. |
| Nonpayment suspension | No applicable service agreement was supplied in the reviewed sources. No suspension, notice, grace-period or restoration rule is invented. |
| Deletion and backups | No deletion date, backup-retention period or permanent-storage promise is established. An export-request window is explicitly distinguished from deletion timing. |

The cancellation page calls itself a local review draft, not a published
policy or agreement. Each topic exposes its unresolved points through a native
keyboard-accessible disclosure. Proposed terms remain tentative.

## Founder information still needed

- Owner-confirmed public name and personal introduction.
- Owner-supplied headshot and permission to use it.
- Owner-supplied LinkedIn URL, if desired.
- Approval of the final concise About copy.
- A verified business telephone number only if the owner wants one published;
  the existing email is sufficient meanwhile.

The sales framework contains “Aren” in an example pitch. An example was not
treated as a confirmed founder biography. No credentials, years in business,
customers, testimonials, personal history, telephone number or social URL were
invented. The About page currently uses the documented product purpose and
explicit introduction/photo/LinkedIn placeholders.

## Consistency changes

- Centralized the existing public business email for the new pages/footer.
- Added the existing $299 startup fee beside $99/month on the build inquiry
  page and in the monthly-plan FAQ; Services metadata includes both prices.
- Aligned the domain FAQ with the supported “restaurant should own and control
  its domain” direction, without guaranteeing an unverified registrar setup.
- Included/optional services and all optional prices remain unchanged.
- Both restaurant showcase cards, fictional-demo disclosure and unpublished
  demo-link gates remain intact. M.1 artwork/animation and D.1 restaurant work
  are preserved.

## Files added or modified in M.2

New application files:

- `src/lib/marketing-business-pages.ts`
- `src/app/cancellation/page.tsx`
- `src/app/about/page.tsx`
- `src/app/business-review-content.ts`
- `src/app/business-information.module.css`

Affected existing marketing files:

- `src/app/MarketingComponents.tsx`
- `src/app/services/page.tsx`
- `src/app/build-my-website/page.tsx`
- `src/app/marketing-content.ts`
- `src/app/page.module.css` — cancellation link styling only

Validation/handoff:

- `scripts/marketing-m2.test.ts`
- `scripts/marketing-m2.browser-qa.mjs`
- `scripts/public-showcase.browser-qa.mjs` — focused M.2 local/gate modes
- `scripts/marketing-m1.browser-qa.mjs` — local cancellation CTA assertion now
  expects the M.2 review link; the public fallback remains gated
- This report.

## Validation

- TypeScript `npx tsc --noEmit`: passed.
- Targeted ESLint: passed.
- `node --import=tsx scripts/marketing-m2.test.ts`: 29/29 passed, including
  existing marketing/lead/asset checks, publication environment cases,
  pre-render denial, pricing/contact consistency and unverified-term checks.
- Google Chrome local draft checks at **320, 412, 768 and 1440px**: passed.
  Services CTA, footer links, cancellation copy/review disclosures, keyboard
  expansion, 44px targets, About placeholders/email, local destinations,
  pricing on the inquiry page, noindex/sitemap exclusion, no horizontal
  overflow and no browser runtime errors were checked.
- Isolated local **hosted Preview environment simulation**: direct draft
  routes return 404; query-string bypass attempts fail; footer links are
  hidden; Services CTA is disabled. This is not a deployment or live hosted QA.
  Unit cases separately cover Production and unknown environment labels.
- `git diff --check`: passed.

Screenshots/results are ignored under `.playwright/marketing-m2/` and
`.playwright/marketing-m2-gated/`. Browser requests to remote origins and POST
submissions were blocked. No messages were sent. The existing offline server
intercepts database requests; no real database operations were performed.
Chrome mobile checks are emulation, not physical-device certification.
Prior M.1/D.1 evidence is reused for unchanged presentation/commerce paths.

## V1 release review status

**Ready for owner review; not approved for public publication.**

Before publication, supply/review the actual service agreement, resolve the
policy matrix, supply founder details, replace or remove draft placeholders
and review notes, and approve the final wording. Publication flags and any
SEO/sitemap changes require a separate explicit release step. Keep the
existing public-demo release gates independent.

No commits, pushes, merges, deployments, SQL execution, payment changes,
Vercel configuration changes or Production modifications occurred.
