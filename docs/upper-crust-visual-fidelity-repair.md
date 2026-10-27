# Upper Crust visual fidelity repair

Baseline: `937b84aa8d84c8ee0153b974f003dedea84ddcf6`. Feature only; Director/owner visual approval is required before staging promotion.

## References and scope

Client Piece: Upper Crust presentation. The only System Piece adjustment is the existing shared carousel's provider-slide positioning; text-only restaurant carousels retain their existing scrolling path. No commerce or database changes.

Compared protected staging against the original `upper-crust-demo` source worktree, its source fidelity audit, and saved `upper-crust-geometry/home-1440x768.png`, `upper-crust-reviews/1440-initial.png`, and About correction screenshots. The current source's social-strip styling supplies the cream boxes, borders, spacing, provider/social identity and hierarchy. Historical hero CSS also contained the 520px limit: removing that limit is the owner's requested correction, rather than a claim that an older commit had a different ceiling.

## Corrections

- Visually hide the Reviews heading again while retaining its accessible section name. Remove generic review buttons; share one Upper Crust social/review strip with About, immediately above the carousel.
- Restore the cream strip, recognizable provider and social artwork, scores, counts and explicit checked dates. Google: 4.7/401; Yelp: 4.5/881, checked October 27, 2026. Sources and asset licenses are recorded separately in [provider branding provenance](./upper-crust-provider-branding.json).
- Use the current official Google G with its supplied clear space and the official Yelp favicon as a business-page shortcut. Google guidance prohibits decorative stars beside its branding; Yelp's distinctive rating-star artwork belongs in its official embeds/dynamic badges. Consequently the old custom five-star lockups are not reproduced. Official Yelp cards retain all provider stars, attribution, links and branding.
- Replace modulo jumps with prepare/move/settle positions. A card is recycled only outside the viewport. Three persistent Yelp frames now use two desktop slots and one mobile slot, leaving one offscreen card for actual wrap movement. No cloned cards, fabricated reviews, iframe reparenting or initialization on slide changes. Stable rail height accommodates the provider's varying card heights without clipping.
- Restore the larger two-line desktop hero heading and photo-driven height using the square storefront crop. Preserve wood/cream/green framing and the awning. Remove the later 840px short landscape override; restore the original 760px stack and tall `1 / 1.15` food window on narrow screens. Header/navigation remain unchanged.
- Replace improvised amenity paths with the named subjects from the existing Lucide visual language: paw, baby, group, umbrella and vegan. Preserve labels/facts and the original smile; use the same Lucide bird artwork as the shared icon. No exact original files for the five improvised subjects were available; this is documented rather than presented as pixel-identical asset recovery. Full upstream license accompanies the distributed icons.
- Separate `storefrontActions` (absolute overlay) from `cateringActions` (normal content flow). The prominent Call the Restaurant link uses `tel:+19517843149`. Approved wording, hours, photo, map/directions and disclosure remain.
- All 26 menu items, descriptions, prices, modifiers and six verified menu-image mappings are unchanged. No image scraping.

## Google review cards remain incomplete

No existing approved Places review integration was found. The old recorded quotations and remote avatars have not been restored. A Google review link and dated numeric summary are present; there are **zero Google review slides** and three genuine Yelp slides.

Completing the original mixed composition needs an authorized Google review feed with the required source/author attribution and permitted caching/display, or documented reviewer consent for supplied excerpts and any portraits. A new billed Places service/key requires separate approval. No paid service or API key was created or exposed. This carousel must not be described as fully restored until that content gap is resolved.

## Focused validation and evidence

- 26 focused unit/contract tests cover access/proxy/media/optimizer boundaries, unchanged fixture inventory, presentation and forward/reverse carousel positions (including every wrap endpoint).
- Targeted ESLint, clean Next type generation, TypeScript and production build pass. No layout/shared-type workaround.
- Actual Google Chrome at 320, 390, 768 and 1440px: genuine Yelp cards, forward/reverse/wrap movement, keyboard Home/End/arrows, reduced motion, source links and navigation preserving iframe identity; zero iframe reloads and application errors locally. Natural 11-second autoplay and subsequent 11.5-second pause checked at desktop.
- Six menu images retain correct card/detail identity. Sample add/edit/simulated checkout passes at all four widths, without restaurant API writes.
- Local before/after screenshots, consecutive moving/settled frames and four Chrome videos live in the ignored `.playwright/visual-fidelity/` evidence folder. Keep provider-review screenshots as private QA evidence, outside public assets and source control.
- Hosted feature Preview must retain SSO, finite protected media/private-no-store, denial of alternate routes and optimizer bypass, and be reviewed at the exact pushed SHA. No automatic staging promotion.

Reproduce with [visual route QA](../scripts/upper-crust-visual-fidelity.browser-qa.mjs), [provider interaction QA](../scripts/upper-crust-provider-reviews.browser-qa.mjs) and the existing [photo/checkout smoke check](../scripts/upper-crust-photo-smoke.browser-qa.mjs). Hosted scripts use existing origin-scoped authentication through [the QA helper](../scripts/upper-crust-qa-auth.mjs).
