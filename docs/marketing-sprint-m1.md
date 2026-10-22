# Marketing Sprint M.1 — local review handoff

Branch: `feature/super-tacos-demo`.
HEAD remains `2ee7312412142ad5ad3de6f860c02061e0dd76e1`.

## Scope and implementation

This is marketing presentation work. Sprint D.1 restaurant changes, the
prepared Gate 3 public-demo architecture, both showcase cards, and their
unpublished destinations are preserved. No restaurant presentation or commerce
source was edited for M.1.

### Finalized owner artwork

The actual source files were verified before implementation:

| Source | Use | viewBox |
| --- | --- | --- |
| `C:/menu-man/img/MenuManPhoneSmol.svg` | Marketing navigation | `0 0 469.387 530.246` |
| `C:/menu-man/img/MenuManPhone.svg` | Homepage/Work hero and footer branding | `0 0 469.387 923.785` |

Both files were copied unchanged into `public/brand/`. Inspection found no
image elements, embedded raster content, scripts, event handlers, external
dependencies or entity declarations. Source SHA256 values are recorded in
`public/brand/menu-man-svg-sources.json` and checked by the focused tests.
Marketing routes no longer reference `menu-man-phone.png`.

The sticky header is 72px at the mobile/tablet widths and 80px on desktop.
Its logo occupies 55px/63px respectively, preserving its natural ratio with
approximately 8px of vertical padding. The Menu Man wordmark remains alongside
it. The taller SVG retains its natural ratio in larger placements.

### Page polish

- **Shared marketing pieces:** `MarketingIcon`, `MarketingReveal`, and
  `MarketingCapabilities` are restricted to marketing routes. Existing SVG
  icon patterns are reused without a new package. The owner's local
  `hand-platter`, `chef-hat`, and `rotate-cw-clock` SVGs were copied into the
  existing icon folder. The available message-circle-question-mark and clock
  icons provide the closest existing message/history equivalents.
- **Sticky navigation:** stays in document flow, uses a measured header-height
  variable for anchor offsets, bounds the mobile drawer to the available
  viewport, preserves Escape/focus behavior, and resets its drawer state on
  desktop resize. Restaurant navigation is separate and unchanged.
- **Questions:** five numbered questions with the requested icon mappings and
  smile closing line. Padding drops from 110px to 56px on desktop and from
  78px to 44px on phones. Row padding, heading size, and the closing treatment
  are also tighter.
- **Process:** preserves the supplied three steps and copy, with numbered
  labels and sequential message/globe/clock icon entrances.
- **Capabilities:** three bordered native disclosure cards use the requested
  titles, copy and icons. Their summaries show the supplied copy, a clear
  Explore indicator, focus treatment, and mouse/touch feedback. Expansion is
  available through keyboard, pointer and touch.
- **Practical details:** reduced padding and row height, chevrons, expanded
  backgrounds, focus/hover/touch feedback, and native keyboard disclosures.
- **Final CTAs:** one shared centered heart-handshake treatment places the
  supporting sentence and buttons directly beneath the heading on Home,
  Services and Work.
- **Services:** the published `$99/month` is unchanged. The price card now
  prominently shows `$299 one-time startup fee`. All ten included services
  have their requested icon/number treatment. Existing optional prices are
  unchanged; delivery updates and Menu Man pickup ordering are explicitly
  labeled optional add-ons.
- **Cancellation:** a prominent disabled What happens if I cancel? button
  explains that details are being prepared. There is no broken destination,
  top-navigation link, cancellation policy, or M.2 implementation.
- **Work:** both prepared showcase cards remain. The redundant A large menu
  made easier to use section is removed. Existing feature tabs remain, with
  roving focus and Arrow/Home/End navigation, Explore/Viewing indicators,
  hover/focus/touch feedback, and a check icon for ordering. The mobile panel
  reuses the previously passing D.1 screenshot of the approved Super Tacos
  presentation; provenance/hash are recorded beside the asset. Only CSS crops
  its lower edge. No replacement artwork was generated. The clarity CTA uses
  sparkles and centered presentation.

### Motion and progressive enhancement

IntersectionObserver reveals the evidence items, process icons, capability
cards and final CTA with short opacity/10px movement and restrained stagger.
The observer disconnects after revealing a group; scrolling back does not
re-arm it. Transform/opacity do not change document geometry.

Server content is visible. Hydration only arms groups that are still below
the viewport, avoiding a visible hide/show flash. Already-visible content
stays visible. Reduced motion disables the reveal motion; switching to reduced
motion releases any armed groups. Keyboard focus also reveals a group.
Without JavaScript/IntersectionObserver, the content remains visible.

## M.1 files

Application:

- `src/app/MarketingComponents.tsx`
- `src/app/MarketingInteractions.tsx`
- New `src/app/MarketingIcon.tsx`, `MarketingReveal.tsx`,
  `MarketingCapabilities.tsx`, `marketing-reveal.module.css`
- `src/app/marketing-content.ts`, `page.module.css`, `page.tsx`
- `src/app/services/page.tsx`, `src/app/work/page.tsx`

Assets:

- `public/brand/MenuManPhoneSmol.svg`, `MenuManPhone.svg`,
  `menu-man-svg-sources.json`
- `public/brand/previews/super-tacos-mobile.png`, `sources.json`
- `public/img/icons/hand-platter.svg`, `chef-hat.svg`, `rotate-cw-clock.svg`

Validation/report:

- New `scripts/marketing-m1.test.ts`, `marketing-m1.browser-qa.mjs`
- Existing local `scripts/public-showcase.browser-qa.mjs` gains a marketing
  validation mode; the Gate 3/D.1 modes remain available.
- This report.

## Validation

- `npx tsc --noEmit`: passed.
- ESLint scoped to the M.1 TypeScript/TSX and QA helpers: passed.
- `node --import=tsx scripts/marketing-m1.test.ts`: 24/24 passed, including
  existing marketing analytics/lead regressions, unchanged monthly/add-on
  pricing, startup fee, artwork integrity and destination gating.
- `node scripts/public-showcase.browser-qa.mjs --marketing-m1`: Google Chrome
  checks at 320, 412, 768 and 1440px.
- Checked homepage, Services and Work; correct logo sizing/ratio; sticky
  positioning; mobile menu state/Escape/focus; anchor clearance; native card
  and FAQ keyboard/pointer expansion; one-time reveal state and reduced
  motion; no-JavaScript visibility; fee visibility; optional add-ons;
  cancellation gating; feature tab keyboard navigation; modal dismissal;
  all local CTA destinations; gated demo cards; and no horizontal overflow.
- No marketing submission was initiated. Browser POST requests are blocked
  by the QA helper; the isolated fixture server blocks remote data access.
- Screenshots/results are ignored under `.playwright/marketing-m1/`, including
  `results.json`, `home-hero-*`, `sticky-navigation-*`, `questions-*`,
  `process-*`, `capabilities-*`, `faq-*`, `services-pricing-*`,
  `work-interactions-*`, and `final-cta-*`.
- `git diff --check`: passed.

Prior passing D.1 restaurant/commerce evidence is reused because those systems
were not changed. The broad application suite was not run. Touch checks use
Chrome emulation, not physical-device testing.

## Review and release boundaries

No M.1 implementation blocker remains. Review the final screenshots and
owner SVG treatment before committing. Cancellation/data handoff content
remains intentionally deferred to M.2. Public restaurant demo destinations
remain gated pending their permanent-route release QA.

No database operations, Production writes, payment activation, Vercel changes,
commit, push, merge or deployment occurred. Work remains local for review.
