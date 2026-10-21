# Super Tacos Showcase — Sprint B

Local work on `feature/super-tacos-demo`, preserving the uncommitted Sprint A presentation and validation cleanup. No commit, push, deployment, external configuration, database write, migration, payment activation, or new dependency.

## Scope and classification

- **System Pieces:** `RestaurantReviews`, `RestaurantSocialSection`, and `RestaurantStorySection`. They accept restaurant content as props and use the existing theme tokens. Reviews support optional individual stars and source attribution; sample reviews supply neither platform branding nor aggregate scores. Social profiles render links only when URLs are supplied.
- **Variant:** `RestaurantCateringPreview`, a presentation-only alternative within the existing Catering v1 route. The demo always selects this component, which imports no inquiry form and contains no form, inputs, or submission handler. Ordinary tenants still require enabled catering settings.
- **Client content and composition:** fictional Super Tacos copy and sample menus live in `src/lib/demo/showcase-content.ts`. No founding date, award, actual staff, real premises, verified review, or live social profile is claimed.
- **Existing pattern reused:** Sprint A's `RestaurantFooterReveal` remains enabled and was verified, including reduced motion. No second footer animation was added.

## Local presentation

- Home: existing hero/gallery → photo-led story → testimonial carousel → existing hours/location → social photo strip → existing footer.
- `/r/super-tacos/about`: existing split hero, two configured story sections, direct menu links, and a discreet fictional-showcase note.
- `/r/super-tacos/catering`: existing shell/hero/footer around sample packages, illustrative serving sizes, example process, and a clear unavailable-inquiry explanation. No prices, bookings, or submission claims.
- Menu and Location retain their Sprint A content and behavior. About and Catering links are composed into the shared navigation/footer with a small duplicate-safe page-link helper.

## Files introduced

- `src/lib/demo/showcase-content.ts`
- `src/app/r/[slug]/RestaurantReviews.tsx`, `restaurant-reviews.module.css`
- `src/app/r/[slug]/RestaurantSocialSection.tsx`, `restaurant-social-section.module.css`
- `src/app/r/[slug]/RestaurantStorySection.tsx`, `restaurant-story-section.module.css`
- `src/app/r/[slug]/about/page.tsx`, `about/restaurant-about-page.module.css`
- `src/app/r/[slug]/catering/RestaurantCateringPreview.tsx`, `catering/restaurant-catering-preview.module.css`

## Existing files integrated

- `src/lib/demo/presentation.ts`
- `src/app/r/[slug]/page.tsx`, `RestaurantShell.tsx`, `RestaurantFooter.tsx`
- `src/app/r/[slug]/restaurant-navigation-actions.ts`
- `src/app/r/[slug]/catering/page.tsx`

The completed home hero, navigation positioning/styles, footer animation, commerce, APIs, tenant-isolation rules, public image files, and attribution records were not redesigned or changed by Sprint B.

## Validation

- TypeScript `--noEmit`: passed.
- Targeted ESLint on new/integrated TypeScript components and content: passed.
- 29 existing focused catering and restaurant-route tests: passed. These cover disabled configuration, safe acceptance claims, tenant boundaries, public visibility, and the menu/location route contracts.
- Chrome at **320px, 412px, 1440px** with the existing offline QA fixture: all five restaurant routes render; reviews pass previous/next, Home/End/arrow-key, and reduced-motion checks; mobile also passes native touch swiping. Social photographs load as browsed, missing social URLs produce no outbound links, and pages have no horizontal document overflow.
- About is reached through desktop and mobile navigation. Its CTA points directly to the restaurant-aware menu path.
- Catering has three example packages, zero forms/inputs/submit buttons, and zero catering POST requests during QA. Armando's disabled catering route still returns 404 and its header remains opted out of shrinking.
- Existing footer reveal becomes visible on scroll and disables transitions for reduced motion. Existing Sprint A evidence is reused for unchanged checkout, selectors, and header/menu behavior.
- Screenshots and the QA results JSON are in ignored `.playwright/showcase/sprint-b-*`. Full-page screenshots can show the footer brand hidden while above the footer; the separate footer captures show the completed reveal.

## Limits and review status

Ready for local visual review; no implementation blocker. Reviews, social feed, story, packages, and serving sizes are explicitly illustrative. Live content/profile URLs and the owner's curated image collection remain future inputs. Existing approved photographs are reused and `public/img/super-tacos/sources.json` is preserved. QA used synthetic local data and made no live Supabase or provider calls.
