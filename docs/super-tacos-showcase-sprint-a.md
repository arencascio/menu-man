# Super Tacos Showcase Sprint A

Implemented locally on `feature/super-tacos-demo`, based on
`4355739542c753b05855828101779d3d4d970f7a`. Reviewed October 20, 2026.

## Changes

| Classification | Result |
| --- | --- |
| Variant | Opt-in `transparent` and `solid` navigation treatments. The homepage overlays the photograph and becomes solid after scrolling; internal Super Tacos routes use solid. Other restaurants retain their existing header styles. |
| Variant | Existing full-photo hero with a showcase treatment, concise copy, pickup/menu links, and delivery trigger. Existing illustrative imagery is retained. |
| System Piece | Optional illustrative provider cards in the existing delivery chooser. Their data type contains no URL; cards render without links or ordering actions. Actual configured delivery links retain their existing behavior and take precedence. |
| System Piece fix | Pickup and delivery now acquire the existing reference-counted `lockMenuPageScroll` lock. This preserves the measured body width when the scrollbar disappears, blocks background scrolling, and restores the original styles and position. Both dialogs also use the existing focus containment helper. |
| Variant | Editorial hours/location layout using the existing `BusinessHours` component and published data. Super Tacos omits its fictional contact/address fields on the homepage and presents an explicit absent-address message. Real addresses and directions remain supported by the component. |
| Client presentation configuration | Super Tacos copy, illustrative providers, and gallery choices live in `src/lib/demo/presentation.ts`. Five existing photographs feed the existing responsive gallery. The redundant ordering section is removed from this homepage composition. |

## Changed files

- `src/lib/demo/presentation.ts`: Super Tacos presentation configuration; existing demo theme helper unchanged.
- `src/app/r/[slug]/RestaurantShell.tsx` and `RestaurantNavigation.tsx`: variant composition, scroll state, and illustrative delivery configuration.
- `src/app/r/[slug]/RestaurantHero.tsx` and `restaurant-page.module.css`: optional showcase treatment, logo visibility and menu link.
- `src/app/r/[slug]/RestaurantHoursLocation.tsx` and `restaurant-hours-location.module.css`: editorial variant.
- `src/app/r/[slug]/RestaurantDeliveryChooser.tsx` and `restaurant-delivery-chooser.module.css`: illustrative cards and shared scroll lock.
- `src/app/r/[slug]/RestaurantPickupTimeChooser.tsx`: shared scroll lock and focus containment.
- `src/app/r/[slug]/restaurant-shell.module.css`: opt-in navigation styling.
- `src/app/r/[slug]/page.tsx`: homepage composition, gallery configuration, hours/location inputs.
- `AGENTS.md`: Next dev automatically normalized the heading in its generated rules block from H1 to H2; retained per repository instructions.

## Validation

- TypeScript: `npx tsc --noEmit` passed.
- ESLint: all eight changed TypeScript/TSX files passed.
- `git diff --check` passed.
- Existing focused tests: **12/12 passed** across `menu-surface-scroll`, `pickup-time-chooser`, `ordering-status`, and delivery-provider branding. Tests were imported directly with `node --import=tsx` because Node's test file glob treated the literal `[slug]` directory as a pattern.
- Google Chrome: **320, 412, 1440px** journeys passed with zero page errors and no document overflow. Covered transparent/solid headers, scroll transition, hero links, provider preview with no destination links, mobile navigation and delivery handoff, keyboard focus containment/restoration, Escape/close/backdrop dismissal, gallery arrows/keyboard/native touch swipe, published hours with no address/map/phone link, and reduced motion. Reduced motion suppressed gallery autoplay beyond its seven-second interval.
- Modal regression: Super Tacos pickup and illustrative delivery, and Armando's pickup and configured delivery, each measured **0px horizontal movement**. Desktop checks used Chrome's actual **15px** scrollbar, with Playwright's default scrollbar hiding disabled. An additional forced **18px** scrollbar check preserved the content width for both restaurants' pickup choosers and Armando's delivery chooser.
- Actual mobile backdrop touch swipes were blocked at 320/412px; closing restored the initial 250px page scroll position exactly.
- Menu regression smoke check: tortilla/guacamole customization produced the expected **$5.50** total and added one item to the cart. No order or payment was submitted.

QA used local fixtures through the actual application routes and shared components.
The Armando's fixture uses synthetic catalog data to exercise its ordinary shell,
configured delivery links, and pickup chooser; it is not a hosted content audit.
Chrome and the server interceptor blocked outbound service requests. The local
process set both demo payment and Square enable flags to `false` and used dummy
Supabase keys. Existing checkout/payment evidence is retained; the full suite was
not rerun and no new live payment/runtime claim is made.

Local QA helpers, JSON results, and screenshots are under the ignored
`.playwright/showcase/` directory. Useful images include `home-{320,412,1440}.png`,
`scrolled-{320,412}.png`, `demo-delivery-{320,412,1440}.png`,
`super-tacos-menu-{320,412,1440}.png`, and
`armandos-classic-scrollbar-1440.png`. The helpers are `start.mjs`, `qa.mjs`,
`scrollbar.mjs`, and `mobile-final.mjs`.

## Remaining issues and scope

No blocking issue was found in the requested local routes. Photography remains
illustrative as requested. Hosted visual verification remains outside this local
sprint. No dependencies, commerce logic, scheduling logic, database/schema,
payment gates, admin features, or checkout disclosures were changed. Nothing was
committed, pushed, deployed, or written to Supabase. The pre-existing
`.activation-backups/` artifact was preserved.
