# Super Tacos Sprint D.1 — local review handoff

Branch: `feature/super-tacos-demo`. HEAD remains
`2ee7312412142ad5ad3de6f860c02061e0dd76e1`.

## Changes and causes

- **System Piece: navigation.** The mobile scroll lock fixes the body and
  temporarily makes native `window.scrollY` zero. The header now reads the
  existing scroll-lock snapshot through `getMenuPageScrollY()`. It retains its
  compact/opaque state while the drawer is open. Internal mobile navigation
  runs after drawer dismissal and scroll restoration. A Home/Close row precedes
  the existing links.
- **System Piece: wordmark font.** The Next font class and theme brand rule both
  assigned font-family with equal specificity. An explicit font-family prop
  removes stylesheet-order dependence. Titan One remains self-hosted; its
  variable registration now lives in the persistent root layout, with preload
  disabled so unrelated pages need not fetch the font. Armando's artwork and
  theme font assignments are preserved.
- **Variant: social filmstrip.** A reusable client component loops the same five
  approved photographs at 20px/second. Duplicate visual cycles are hidden from
  assistive technology. Pointer gestures, decaying momentum, a delayed gradual
  automatic restart, arrow-key browsing, Previous/Next and Pause controls are
  included. Reduced motion disables automatic movement and inertia while
  retaining manual browsing. Animation uses refs and transforms, without React
  renders per frame or a new dependency.
- **Client Piece: demo interactions.** The original Menu Man bubble expands
  into one rounded container. Its hidden actions are inert. Escape closes it
  and restores trigger focus. No verified Menu Man telephone number was found
  in the inspected source; Contact Menu Man uses the already-published
  `hello@getmenuman.com` address.
- Super Tacos address/phone buttons open native contextual popovers, with
  outside-click/Escape dismissal and a Get a Site Like This link. They never
  call the fictional number or route to its fictional address. Other tenants
  retain their functional telephone and directions links.
- Location keeps Riverside/Magnolia Avenue/Tyler Street context, address,
  hours and phone. Repetitive location disclaimers are replaced by the exact
  requested disclosure once. The neighborhood map card uses shorter copy.
- Root HTML includes Next's documented `data-scroll-behavior="smooth"` opt-in.
  Existing reduced-motion CSS and anchor behavior are preserved.

## D.1 files

Under `src/app/r/[slug]/`:

- `RestaurantNavigation.tsx`, `restaurant-shell.module.css`
- `RestaurantWordmark.tsx`, `RestaurantShell.tsx`, `RestaurantFooter.tsx`
- `RestaurantSocialSection.tsx`, new `RestaurantPhotoFilmstrip.tsx`,
  `restaurant-photo-filmstrip.module.css`, `filmstrip-motion.ts`
- `DemoNotice.tsx`, `demo-notice.module.css`
- New `RestaurantDemoContact.tsx`, `restaurant-demo-contact.module.css`
- `RestaurantHoursLocation.tsx`, `RestaurantMapViews.tsx`, `location/page.tsx`

Other files:

- `src/app/layout.tsx`
- `src/lib/demo/brand-font.ts`, `src/lib/demo/presentation.ts`
- New `scripts/super-tacos-sprint-d1.test.ts`,
  `scripts/super-tacos-sprint-d1.browser-qa.mjs`,
  `scripts/fixtures/sprint-d1-armandos.mjs`
- Existing local Gate 3 QA helpers `scripts/public-showcase.browser-qa.mjs`
  and `scripts/super-tacos-demo-offline-backend.mjs` gain an explicit D.1 mode.
- This report.

The earlier Gate 3 marketing, public-demo safety, release preparation and all
other pre-existing worktree changes remain in place. No image assets, catalog
fixture, SQL, schema or payment implementation was changed by D.1.

## Validation

- `npx tsc --noEmit`: passed.
- ESLint scoped to D.1 application files and QA helpers: passed.
- `node --import=tsx scripts/super-tacos-sprint-d1.test.ts`: 6/6 passed,
  including both existing mobile/desktop nested scroll-lock regressions.
- `git diff --check`: passed.
- Google Chrome, isolated offline Next fixture server: passed at 320, 412,
  768 and 1440px. Checked scrolled home/menu drawer state, Close and Escape,
  return to top, Home → Menu → Location → Home, refresh/back/forward,
  computed font family and loaded primary font face, automatic filmstrip
  movement, mouse dragging, emulated touch dragging, reduced motion/manual
  arrow browsing, Pause, one expanding CTA, contact popovers/focus restoration,
  CTA/cart clearance and page overflow. No hydration errors or smooth-scroll
  warnings were observed in the final run.
- Armando navigation/menu smoke checks used a clearly isolated local fixture:
  its artwork, shrink opt-out, drawer dismissal and real-link behavior remain
  intact at all four widths. This fixture does not validate its live catalog,
  availability or fulfillment configuration.
- Prior passing Gate 3 commerce/API/cart/25-photo evidence is reused for those
  unchanged systems; the broad application suite was not rerun.
- Results/screenshots: ignored `.playwright/sprint-d1/`, including
  `results.json`, `home-top-*.png`, `scrolled-navigation-*.png` (mobile drawer
  widths), `location-contact-*.png`, `menu-man-expanded-*.png`,
  `filmstrip-*.png` and `armando-menu-*.png`.

All browser database requests were handled by the local fixture transport;
remote browser requests were blocked. Chrome touch checks are emulation,
not a physical iOS/Android browser certification.

The already-executed Staging 016 SHA256 remains:
`d9aa552827439f4b19cfa2a655e8ebaed3e80788bcdbe7582e5320090aeba993`.

## Remaining review / inputs

- No verified Menu Man business phone is configured in the inspected source.
  The email contact fallback is ready for review.
- Embedded map/Street View remains blocked on an approved neighborhood embed
  URL or configured Maps Embed API credentials. Existing presentation accepts
  Google-generated `/maps/embed?pb=...` URLs. Google documents obtaining these
  through [Share or embed map → Embed a map → Copy HTML](https://support.google.com/maps/answer/7101463?hl=en).
  Its [Maps Embed API](https://developers.google.com/maps/documentation/embed/quickstart)
  also supports maps/Street View, but requires a Google Cloud API key and
  billing setup. No key, fabricated embed token, scraped street image or
  invented storefront was added. The existing neighborhood link remains usable.
- Review the single-bubble CTA and filmstrip screenshots before release.

No database operations, payments activation, Vercel changes, commit, push,
merge or deployment occurred. Work is local and stopped for review.
