# Restaurant desktop/mobile parity polish

Completed as a **System Piece** with an Armando's homepage composition change.

Desktop and mobile now use the same native cart dialog, focus containment, shared reference-counted scroll lock, and exit lifecycle. Desktop uses a centered panel up to 740px wide with thumbnails and text actions; mobile keeps its existing sheet density and icon actions. The menu remains mounted, retaining search, active category, category-strip position, and exact page scroll. Quantities, modifiers, consolidation, editing, removal, totals, and checkout routing use the existing cart implementation.

Empty cart triggers are white/neutral on both layouts, while populated triggers retain their active color and count. The broken-heart cart-empty illustration was the relevant existing empty state; it now uses the supplied Lucide frowning-face asset. No separate favorites-empty component existed.

Customer delivery action labels now consistently say **Order Delivery**. Provider destinations and chooser behavior remain intact. Each resolved homepage gallery slide links to `/r/[slug]/menu?item=<canonical-item-id>`, opening the existing item order dialog. California Burrito was checked end to end.

The homepage restores **Find your next favorite** at 20px with five compact, wrapping category buttons. They use published section identities and the existing dedicated menu section bookmarks. The compact variant suppresses eyebrow, paragraph, images, and extra CTA. The footer logo reuses the existing directional intersection/scroll reveal logic with a restrained 450ms opacity/transform reveal; only the logo moves.

Card add controls show the same smiley for 500ms at all breakpoints, then return to plus. Feedback transforms only the icon inside its fixed button footprint. Full item success also uses the smiley consistently. Item dialogs, including quick add, enter and exit with complementary opacity and an 8px horizontal transform over 180ms. The existing CSS-animation completion hook retains the native modal until exit finishes, preserving focus, Back/Forward, Escape, click-away, and deep-link behavior.

The selector previously used its own fixed-body `width: 100%` lock, allowing scrollbar removal to expand the background. It now shares the cart/item lock, which pins the pre-lock body width. Desktop retains native positioning and uses body clipping rather than creating a new scrolling ancestor, keeping sticky header/search/category chrome visible behind the modal. The old cart grid slot now uses `display: contents`, eliminating an otherwise empty 16px grid gap and scroll-anchor shift. Native modality keeps covered controls inert. Mobile retains its fixed-body lock.

Reduced motion removes decorative transforms/animations and uses static feedback; modal cleanup follows the actual remaining CSS animation rather than a fixed delay. Hero, information strip, gallery layout, patterns, SectionEdge, Location composition, menu density, image proportions, and commerce/backend behavior were not redesigned.

## Verification

Google Chrome QA used the existing staging configuration and confirmed Supabase ref `jjvongzvtnzlvwdfcnjk` through diagnostics. Viewports were 320, 412, 1024, and 1440px; mobile checks used touch emulation. Checks covered exact overlay state retention, sticky chrome, inert background, no horizontal shift/overflow, fixed card/button/image dimensions during feedback, selected gallery pickup, published section links, wrapping buttons, footer reveal, and reduced motion. Screenshots were reviewed at narrow mobile and desktop widths. These are browser-emulated checks, not physical-device testing.

Existing cart/browser regression scripts additionally cover consolidated rows, distinct configurations, modifier editing, quantity limits, touch scrolling, keyboard/focus behavior, confirmation cancellation, checkout navigation, modal exit retention, duplicate-submit protection, and history navigation. No orders were submitted.

- Focused tests: 5 passed.
- `npm test`: 258 passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed without warnings.
- `npm run build`: passed using existing staging environment variables.
- `git diff --check`: passed.

## Files changed

Presentation/interaction files under `src/app/r/[slug]/`:

- `CartPanel.tsx`, `CartLineRow.tsx`, `MenuBrowser.tsx`, `MenuIcon.tsx`, `OrderingStatus.tsx`
- `menu-browser.module.css`, `menu-surface-scroll.ts`
- `page.tsx`, `restaurant-menu-links.ts`, `RestaurantMenuIntro.tsx`, `restaurant-menu-intro.module.css`
- `RestaurantFooter.tsx`, `RestaurantFooterArtwork.tsx`, `restaurant-footer.module.css`

Assets, verification, and documentation:

- `public/img/icons/face-slightly-frowning.svg` (copy of the existing supplied icon)
- `src/app/r/[slug]/menu-surface-scroll.test.ts`
- `src/app/r/[slug]/restaurant-menu-links.test.ts`
- `scripts/run-tests.ts`, `scripts/restaurant-menu-route.test.ts`
- `scripts/cart-sheet.browser-qa.mjs`, `scripts/menu-ui-polish.browser-qa.mjs`
- `scripts/restaurant-parity.browser-qa.mjs`
- `docs/restaurant-parity-polish-report.md`
