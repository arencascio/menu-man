# Super Tacos — image integration and Sprint B.1

Local work on `feature/super-tacos-demo`. Existing uncommitted Sprint A/B changes are preserved. No commit, push, deployment, Supabase/schema/configuration changes, payment activation, or added dependency.

## Changes

- **Client content:** approved owner-supplied photographs replace the previous Super Tacos presentation images. The homepage hero uses `stock/carnitas tacos.jpg`. Branding stays text only across the header and footer.
- **System pieces:** compact bordered testimonial cards show three reviews on desktop, two at intermediate widths, and one on narrow screens. Initial avatars, concise sample quotes, keyboard controls, native touch scrolling, reduced motion, and a single sample disclosure replace the tall slides and finite counter. No autoplay.
- **System piece:** `RestaurantSocialLinks` supports configured Instagram, TikTok and Facebook URLs. Without URLs, Super Tacos displays inert profile previews, with no fake links.
- **Variant:** the existing catering preview now has specific sample packages, prices, structured choices, and package CTAs that prefill an on-page request preview. Choices remain synchronized between cards and the request context. Request-heading scroll clearance measures the shared header. Sending is disabled; Enter is prevented from submitting; no storage, API call, notification or booking is introduced.
- **Presentation polish:** delivery truck icons, About hearts and Catering platter icons reuse the shared icon component.
- **Shared CSS correction found during QA:** the fixed header could widen by 15px when a desktop modal hid the root scrollbar. Restaurant pages now reserve the root scrollbar gutter. The existing body-width scroll lock, nested surface handling, and ordering logic are preserved.

## Approved image mapping

Source: the supplied Windows `super tacos` directory and its `super tacos.zip`. No generated or searched images. Eighteen proportionally resized, uncropped WebP derivatives total approximately 6.75 MB. Original dimensions/hashes, derivative hashes, archive hash, processing and rights information are recorded in `public/img/super-tacos/approved/provenance.json`. Existing `sources.json` remains intact. Individual author/license records were not supplied; the manifest does not invent them.

| Approved source | Presentation use |
| --- | --- |
| `stock/carnitas tacos.jpg` | Homepage hero, Taco Table package, Citrus Carnitas Taco |
| `stock/foodiesfeed.com_preparing-mexican-burritos.jpg` | Homepage story |
| `stock/foodiesfeed.com_tortilla-chips-with-salsa.jpg` | Social feed, Chips & Salsa, Chips & Guacamole |
| `stock/salsas.jpg` | About food philosophy |
| `stock/StockSnap_UPG7YS3LGW.jpg` | About gathering section |
| `menu items/carne asada tacos.jpg` | About hero, Carne Asada Street Taco, featured gallery |
| `menu items/street tacos.jpg` | Social feed |
| `menu items/burrito.jpg` | Social feed, California Burrito, featured gallery |
| `menu items/chicken burrito.jpg` | Lunch Crowd package, Grilled Chicken Burrito |
| `menu items/black bean burrito.jpg` | Garden Burrito |
| `menu items/breakfast burrito.jpg` | Sunrise Breakfast Burrito |
| `menu items/breakfast quesadilla.jpg` | Breakfast Quesadilla, featured gallery |
| `menu items/churros.jpg` | Social feed, Cinnamon Churros, Churros for Two, featured gallery |
| `menu items/loaded nachos.jpg` | Catering hero, Loaded Asada Nachos, featured gallery |
| `menu items/quesadilla.jpg` | Cheese Quesadilla, Chicken Quesadilla |
| `menu items/shrimp tacos.jpg` | Chile Lime Shrimp Taco |
| `menu items/horchata.jpg` | Social feed only; never assigned to lemonade |
| `menu items/loaded taquitos.jpg` | Celebration package |

### Remaining menu image gaps

Fifteen of thirty items have an approved photo assignment. Unmatched items use the existing image placeholder: Al Pastor Street Taco, Roasted Mushroom Taco, Bean & Cheese Burrito, Quesabirria Trio, Rice & Beans, Hibiscus Agua Fresca, Citrus Chicken Taco, Crispy Potato Taco, Carnitas Burrito, Coastal Shrimp Burrito, Chorizo & Egg Burrito, Breakfast Taco Pair, Steak & Egg Burrito, Mint Lime Lemonade and Churro Bites.

These are sample dish-family matches, not exact recipe or portion photographs. In particular, fries are not confirmed in the California Burrito photo; fillings cannot be confirmed in the generic quesadilla; Garden Burrito mushrooms are not verified; the chips photograph includes multiple dips; churro counts/sauces may differ. Review these assignments before commit. Menu names, descriptions, prices, IDs, modifiers and availability are unchanged. Image overrides are applied only for the fixed demo tenant at the presentation route boundary; other tenants retain their original images.

## Files changed in B.1

- `public/img/super-tacos/approved/` — 18 images and `provenance.json`.
- `scripts/prepare-super-tacos-approved-images.mjs`, `scripts/run-tests.ts`.
- `src/lib/demo/{presentation.ts,showcase-content.ts,menu-imagery.ts,menu-imagery.test.ts}`.
- Under `src/app/r/[slug]/`: `page.tsx`, `menu/page.tsx`, `about/page.tsx`, `RestaurantHero.tsx`, `RestaurantFeaturedGallerySlider.tsx`, `RestaurantNavigation.tsx`, `RestaurantNavigationIcon.tsx`, `restaurant-navigation-actions.ts`, `RestaurantShell.tsx`, `RestaurantFooter.tsx`, `restaurant-page.module.css`, `restaurant-shell.module.css`.
- Reviews: `RestaurantReviews.tsx`, `restaurant-reviews.module.css`.
- Social: `RestaurantSocialSection.tsx`, new `RestaurantSocialLinks.tsx`, new `restaurant-social-links.module.css`.
- Catering: `catering/RestaurantCateringPreview.tsx`, `catering/restaurant-catering-preview.module.css`.
- This report. Earlier Sprint A/B files and unrelated changes remain uncommitted.

## Validation

- TypeScript `--noEmit` and targeted ESLint: passed.
- 68 focused tests: passed. Includes demo image scope/immutability, menu routes/links/engagement, menu card ordering, nested scroll locks, cart calculations/isolation and catering guards. Explicit imports ensure Windows includes tests under literal `[slug]` paths.
- All 18 prepared-image hashes verified against the provenance manifest.
- Chrome at **320px, 412px, 1440px**: approved hero and route imagery load; text branding; review visibility is 1/1/3 cards; keyboard/reduced-motion behavior; inert social profiles; all package choices/CTAs prefill correctly; disabled sending and Enter create no catering POST; no horizontal page overflow.
- Mobile review swiping passes at 320px and 412px. Menu controls sit directly below the compact header (within 1px). Item detail images use the approved mapping. Home scroll/restore and delivery modal width stability pass.
- Both restaurants pass cart additions and pickup modal checks with no header width shift. Armando's functioning delivery destination is preserved; its header remains opted out of shrinking; disabled catering remains 404.
- `git diff --check`: passed.

QA used the existing synthetic local backend with external requests blocked. It did not validate against live Supabase or send actual inquiries/orders. Passing Sprint A evidence is reused for unchanged payment/checkout behavior and footer animation.

## Visual review

Final screenshots and result JSON files are in ignored `.playwright/showcase/sprint-b1-*`, including home, hero, reviews, social, About, Catering, request and menu views at all three widths. Review hero cropping, dish/portion matches, sample package values, and the compact review treatment before commit. Food sources are uncropped on disk; responsive hero/cards still use their existing cover framing. Full-page captures can show the footer brand before its scroll-triggered reveal, as in the earlier sprint evidence.
