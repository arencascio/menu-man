# Shared restaurant UI polish

Classification: **System Piece**. Both phases are implemented in shared restaurant components. Restaurant content, favorites mutations, cart reducer/signatures, pricing, checkout, database, and management behavior retain their existing implementations. No dependencies were added.

## Result

- Card titles and descriptions share four text lines on desktop and three on mobile. Full titles remain visible; longer titles reduce description space before growing the card.
- Favorites counts sit inside their heart buttons, with accessible count descriptions and pressed state. Card heart/+ controls share the same outer diameter: 36px desktop, 34px mobile.
- Cart rows have no swipe handlers, pointer capture, hidden swipe actions, or swipe transforms. Explicit Edit/Remove remain available. The unused swipe helpers remain isolated.
- Clear cart opens a native confirmation dialog with Cancel focused, an inert underlying cart, contained keyboard focus, Escape dismissal, and focus return. Individual removal remains immediate.
- Empty carts center the supplied 72px heart-crack icon and “Your cart is empty” in the available content area, including short viewports.
- Mobile navigation uses a native modal backdrop and a 180ms entrance/exit. Outside taps are consumed through exit. Delivery opens after navigation closes and returns focus to the hamburger.
- The Location card no longer shows “Find us”; its existing content and colors remain.
- Mobile cart exits take 220ms while retaining the modal and scroll lock. Full item details reveal rightward and exit leftward over 220ms.
- Successful full-detail additions show a randomly selected Sparkles/smiling-face confirmation for 360ms before exiting. Feedback observes the committed cart quantity for that exact configuration. Capped additions show an error and keep the detail open. A synchronous submission guard prevents duplicate additions, and order fields stay disabled during feedback/exit.
- Reduced motion removes overlay movement; successful additions get a 120ms static confirmation.

## Validation

- Focused tests: **33 passed**.
- `npm test`: **256 passed**.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed without warnings.
- `npm run build`: passed with the repository's staging environment.
- `git diff --check`: passed.
- Google Chrome checks: **320px, 412px, 1440px**, plus 480px-high mobile viewports. QA used staging Supabase project `jjvongzvtnzlvwdfcnjk`, verified through diagnostics.
- Browser coverage includes title geometry, matched controls/count accessibility, confirmation/cancel/Escape, centered empty state, actual outside taps without click-through, Delivery handoff, touch scrolling, pinned cart header/footer, explicit edit/remove, customization and consolidation, exact menu scroll/search/category restoration, modal retention through exits, both feedback icons, duplicate submits, quantity-limit failures, rapid repeated dismissal and back/forward, reduced motion, checkout routing, and horizontal overflow.
- QA used Chrome viewport/touch emulation. No physical-device Safari validation was performed.

The built-app checks are reproducible with an isolated Chrome DevTools endpoint on port 9223 and a staging-backed server on port 3100:

```text
node scripts/menu-ui-polish.browser-qa.mjs
node scripts/cart-sheet.browser-qa.mjs
```

`QA_BASE_URL` can select another verified staging-backed localhost server. `--phase1` limits the first script to Phase 1; `QA_WIDTH` can select one viewport. Neither script submits orders.

## Files changed

Under `src/app/r/[slug]/`:

- `MenuBrowser.tsx`
- `MenuCardText.tsx` (new)
- `MenuFavoriteButton.tsx` (new)
- `CartPanel.tsx`
- `CartLineRow.tsx`
- `OrderItemPanel.tsx`
- `MenuIcon.tsx`
- `RestaurantNavigation.tsx`
- `RestaurantDeliveryChooser.tsx`
- `RestaurantHoursLocation.tsx`
- `menu-browser.module.css`
- `restaurant-shell.module.css`
- `menu-card-text.ts` (new)
- `menu-card-text.test.ts` (new)
- `menu-card-ordering.ts`
- `menu-card-ordering.test.ts`
- `overlay-focus.ts` (new)
- `useExitAnimation.ts` (new)

Other files:

- `scripts/run-tests.ts`
- `scripts/cart-sheet.browser-qa.mjs`
- `scripts/menu-ui-polish.browser-qa.mjs` (new)
- `public/img/icons/heart-crack.svg` (served copy)
- `public/img/icons/sparkles.svg` (served copy)
- `public/img/icons/face-slightly-smiling.svg` (served copy)
- `docs/menu-ui-polish-report.md` (this report)

The three supplied originals under `img/icons/` were already untracked when work began and remain unmodified.
