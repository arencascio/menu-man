# V1.1 final marketing polish

Continued on `feature/super-tacos-demo`, preserving the existing uncommitted V1.1
work and unrelated AGENTS.md modification. All changes remain unstaged. No
commits, pushes, deployments, database writes, payment changes or email sends.

## Working Product and demo buttons

Home and Work now share the same introduction:

- Eyebrow: **WORKING PRODUCT**
- Heading: **See Menu Man in action**
- Copy: **This is a working restaurant demo, not a mockup. Go ahead, click around.**
- Primary red CTA: **EXPLORE LIVE DEMO**, `/r/super-tacos`.
- Secondary CTA: **I WANT A SITE LIKE THIS**, `/build-my-website`.

Removed the old supporting sentence and “Explore the product” link. The existing
Work hero/final “I WANT A SITE LIKE THIS” actions also lead to the intake page.
Analytics attributes remain attached to the corresponding actions.

The existing `square-play.svg` is served from `public/img/icons/` unchanged. Red section and green card demo actions use this
single decorative icon, with no arrow glyph or second icon. Unrelated primary
CTAs retain their arrows. Icons are 22px, cream/white against the colored buttons,
and hidden from assistive technology.

The approved photo, name/eyebrow overlay, compact card and section disclosure
remain. Body type is now 0.82rem. Final body text:

> A fully-featured restaurant website with a custom menu, item customization,
> simulated ordering, and a catering request preview.

Accuracy adjustment: the requested ending “catering requests” became “a catering
request preview.” The actual component explicitly disables Send request and says
that nothing is submitted or saved. Menu search, item customization and sample
ordering UI exist; no real order/payment or catering submission is promised.

## Featurettes

Both shared instances now start with all four panels closed through 820px.
Desktop starts with the first selected. `useSyncExternalStore` supplies a stable
server snapshot; desktop CSS reserves the initial panel before hydration.
This avoids opening then collapsing the first panel on mobile and avoids changing
desktop panel height during hydration. Existing inline expansion, one-open
behavior, keyboard controls, unique IDs, screenshots and reduced-motion styles
remain.

## Provider presentation

Owner clarification: **update the existing section on Services only**. The diagram
was not on Work, so no ecosystem section was added to Work.

The Services flow diagram is replaced by six typographic provider cards, with
Square larger and cream against the existing dark section. Names: Square, Clover,
Toast, DoorDash, Uber Eats and Grubhub. No provider logos, partnership badges,
certification claims, payment-processing claims or synchronization claims were
added. Text describes retaining the current ordering workflow while Menu Man
provides the customer-facing website. The row scrolls horizontally on mobile and
has keyboard focus treatment. No extra motion was needed.

## Mobile intake

The heading remains “Tell us about your restaurant.” The supporting sentence is
now exactly “Share what you have, what is not working, and where customers order
today.” Mobile top padding fell from 90px to 20px, heading type is 32px at phone
widths, group gaps are 12px and label/input spacing is 4px. Ordering choices share
one 44px row. Inputs/selects remain at least 46px tall.

At 320/412px the form starts at approximately y=286, inside the initial viewport.
Its measured height is approximately 1030/1016px. At 768px the form starts at
y=225 and is approximately 790px tall. Desktop retains its two-column layout.
Pricing is hidden from the mobile intro and repeated immediately before submit:
**$99/month**, **Plus a $299 one-time startup fee**. Desktop retains intro pricing.

All fields, names/mappings, required fields, maximum lengths, radio values,
select choices, honeypot, feedback/disclosure, submission handler, retry identity
and Resend integration remain. Failure/retry/success were exercised using browser
interception; no request reached the real lead endpoint.

## Local Super Tacos configuration

Root cause: this worktree contained no `.env.local` or other `.env` file, and the
shell had neither `NEXT_PUBLIC_SUPABASE_URL` nor `SUPABASE_SERVICE_ROLE_KEY`.
The existing server client therefore received an absent URL at initialization.
Next does not automatically read another worktree’s env files, nor does ordinary
`next dev` automatically select the custom name `.env.staging.local`.

Resolution performed locally:

1. Read the owner's existing `C:/menu-man/.env.staging.local` into a separate
   process and verified the URL hostname exactly matched
   `jjvongzvtnzlvwdfcnjk.supabase.co` before copying any settings.
2. Created **this worktree's `.env.development.local`**, exclusively, with only
   the verified URL/service-role settings, `MENU_MAN_ENV=staging` and
   `MENU_MAN_STAGING_PROJECT_REF=jjvongzvtnzlvwdfcnjk`.
3. Confirmed Git ignores it. No credentials were printed, staged or documented.
   No payment flags, Square keys or email credentials were copied.
4. The existing Next dev server reloaded its environment. A read-only GET to
   `/r/super-tacos` returned HTTP 200 with Super Tacos content and without the
   missing-URL error. No checkout or database-write tests were run.

For a fresh worktree, provision the same development-only file with the intended
Staging credentials before `npm run dev`, verify the project ref first, then
restart dev if necessary. Keep env files at the worktree root, outside `src`.
Do not copy Production settings or invent a data fallback. Existing publication,
management and commerce protections were not changed. Local payment enablement
remains absent; the marketing demo CTA does not enable payments.

## Focused QA and screenshots

- Chrome: Home, Work, Services provider section and Build My Website at 320,
  412, 768 and 1440px; no horizontal page overflow.
- Shared copy/CTA destinations, one play icon per demo action, shared card,
  fully collapsed mobile panels, desktop first selection, inline expansion,
  one-open/collapse behavior and desktop keyboard selection passed.
- JavaScript-disabled server render and hydrated featurette dimensions matched
  within 2px on both routes at every width. Mobile mutation observations found
  no initially open panel. No page/hydration errors were observed.
- Mobile provider strip scrolls to every name; Square remains prominent.
- Pricing precedes submit on mobile; all eleven named form fields remain.
  Invalid-empty checks, intercepted failure, retained values, retry and success
  passed; retry reused the submission identity. All nine existing marketing-lead
  tests passed with mocks.
- Reduced-motion mobile Work starts closed and disables feature media animation.
- TypeScript, targeted ESLint and `git diff --check` passed. Existing phone,
  restaurant and commerce QA is reused; no broad QA was repeated.

Run: `node scripts/qa-final-marketing-polish.mjs` against local dev. The script
blocks remote requests and API/restaurant navigation, and mocks the lead POST.

Screenshots and report are in `.playwright/final-marketing-polish/`:

- `home-working-product-{320,412,768,1440}.png`
- `work-working-product-{320,412,768,1440}.png`
- `home-features-{320,412,768,1440}.png`
- `work-features-{320,412,768,1440}.png`
- `services-ecosystem-{320,412,768,1440}.png`
- `build-{320,412,768,1440}.png`
- `report.json`

Sticky headers are hidden only while capturing section screenshots so they do
not cover the content; page behavior is unchanged. The Next dev indicator is
local tooling. No new media or owner assets are required for this review.

## Exact files changed in this finishing pass

- `src/app/MarketingComponents.tsx`
- `src/app/page.tsx`
- `src/app/work/page.tsx`
- `src/app/RestaurantShowcases.tsx`
- `src/lib/restaurant-showcases.ts`
- `src/app/restaurant-showcases.module.css`
- `src/app/MarketingFeaturettes.tsx`
- `src/app/marketing-featurettes.module.css`
- `src/app/MarketingInteractions.tsx`
- `src/app/build-my-website/page.tsx`
- `src/app/services/page.tsx`
- `src/app/page.module.css`
- `public/img/icons/square-play.svg` (existing owner asset)
- `scripts/qa-final-marketing-polish.mjs` (new focused checks)
- `scripts/inspect-showcase-image.mjs`, `scripts/qa-marketing-refinement.mjs`
  (photo selectors distinguish the new decorative icon)
- `scripts/qa-final-copy-color.mjs` (current approved copy/CTA expectations)
- `docs/final-marketing-polish-v11.md` (this handoff)
- `.env.development.local` (ignored local configuration only)

Stopped for owner visual review. The only deliberate copy deviation is the
accurate catering-preview qualification described above.
