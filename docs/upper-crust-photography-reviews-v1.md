# Upper Crust photography and provider reviews V1

Baseline: `8531a659ed3bb0b60217b377377703e03e4e347f`, fetched from `origin/staging` on 2026-10-27. Work is isolated on `feature/upper-crust-photography-reviews-v1`; the canonical staging and original source checkouts were not modified.

Classification: Upper Crust **Client Piece**, with a minimal **System Piece** change allowing the existing reviews carousel to render official Yelp slides without text-review fixtures. No commerce engine, database, prices, descriptions, modifier choices, or checkout changes.

## Photography: 6 of 26 items

The [item map](./upper-crust-item-photo-map.md) retains all five existing mappings. The sixth mapping uses existing approved bytes, not an additional download:

| Item | Local source / protected asset | Identity confidence | Permission basis |
| --- | --- | --- | --- |
| `uc-custom` — Whole Custom Sandwich | `media/upper-crust/approved/awning-carousel/veggie sandwich.jpg`; original owner archive: `C:/Users/cowbe/OneDrive/Documents/Menu Man/_logo and branding/sandwich shop/upper crust vibe/carousel/veggie sandwich.jpg` | High for the pictured vegetarian configuration: owner caption identifies it, both halves are visible, and the merchant's Whole Custom Sandwich dialog explicitly offers Vegetarian (Includes Avocado). Does not represent every filling or imply a preset. | Existing exact-byte owner attestation in the [manifest](./upper-crust-hosted-asset-manifest.json), protected staging Preview only. |

### Source investigation

1. Reviewed the owner archive, original source checkout, all 16 protected gallery photos, local reference photos, and local archive filenames. No additional item-identified original food set or Upper Crust scraper export was found.
2. The [public merchant menu for store 86182](https://order.online/en/store/the-upper-crust-sandwich-shoppe-86182) loaded normally in an existing browser session. Inspected all categories, image alt names, observed asset URLs, and item dialogs. No login, CAPTCHA solving, or challenge bypass was used. Its background reCAPTCHA reported a connectivity error, but menu/item dialogs remained accessible.
3. The existing scraper's `scrape-doordash.js` was inspected, including `findFeeds`, `feedsFromNextScripts`, `downloadImage`, `raw-menu.json`, `menu.csv`, and `images/` output. Existing output was for Armando's, not Upper Crust. Its prior challenged DoorDash run was not repeated. No new scraper was built: the accessible merchant menu provided the relevant item identity and photo inventory.
4. Other local restaurant source files contain storefront/reference imagery or the same gallery, not verified photos for the remaining fixture items.

Two full-size merchant assets were downloaded through the normal displayed-image browser download for visual inspection only. Neither is bundled or committed:

| Merchant item | Observed original asset | Decision |
| --- | --- | --- |
| Whole Custom Sandwich | `https://doordash-static.s3.amazonaws.com/media/photosV2/c16960e9-5054-4e81-b0af-e06710ee9451-retina-large.jpg` (displayed through CDN `fit=contain,width=1920,format=auto,quality=50,metadata=none,anim=false`) | Shows a vegetarian sandwich. Authorization beyond the existing 26 exact manifest files is not established; use the already approved vegetarian photo instead. A CDN `photosV2` path alone does not establish ownership. |
| Chicken Salad Salad | `https://doordash-static.s3.amazonaws.com/media/photos/065aac16-f4f4-443f-96aa-ec0c4a31d074-retina-large.jpg` (same displayed CDN transform) | **Rejected identity mismatch**: photo shows sliced chicken breast, while this menu item is scoop-style chicken salad on greens. Do not assign despite the item label. |

No new image bytes or allowlist entries were added. All 26 original bundle hashes and protection boundaries remain intact. No public media copies or DoorDash hotlinks are introduced.

### Remaining 20 items

| Item IDs | Reason no image assigned |
| --- | --- |
| `uc-half-custom`, `uc-grinder-one`, `uc-grinder-two`, `uc-soup-bowl`, `uc-dinner-salad` | Merchant photos are explicitly under `/media/ugc/`; customer photographs are outside the established permission. Existing gallery photos do not verify these exact portions/items. |
| `uc-french-dip`, `uc-bbq-beef` | Merchant photos are under `/media/yelp/`; no corresponding approved exact-item original was found. |
| `uc-chicken-salad-salad` | Merchant photograph is visually the wrong preparation. Existing `chicken salad.jpg` is a sandwich, not this salad entree. |
| `uc-italian-sub-two`, `uc-soup-cup`, `uc-albacore-tuna-salad`, `uc-chef-salad`, `uc-caesar-salad`, `uc-side-orders`, `uc-cheesecake`, `uc-chips`, `uc-two-cookies`, `uc-bottled-water`, `uc-large-drink`, `uc-small-drink` | No verified, permitted, exact-item photo found. No copying a one-person photo to a two-person item or guessing among side/dessert assortments. |

## Provider reviews

Yelp's [official embed guidance](https://www.yelp-support.com/article/How-do-I-embed-or-share-Yelp-content-on-another-website?l=en_US) permits embedding recommended reviews. The original official `widgets.js` mechanism successfully returned genuine review content for all three original IDs on 2026-10-27:

| Review ID | Provider-rendered author | Result |
| --- | --- | --- |
| `uFgzOfNbZyjh0QqCWNBwvQ` | Bree H. | Official iframe renders content, attribution, provider branding and Read more on Yelp link. |
| `eR40QqkXykPzWkunBsJLHQ` | Diana C. | Same. |
| `7nNmA6Ir_ZFQ8lD8UJn8cg` | Michael P. | Same. |

The business review page itself presented a device-verification interstitial; it was not bypassed. Verification therefore relies on the actual official embed responses, not a separately scraped recommendation listing. The provider currently serves all three as supported embeds. Provider-owned ratings/counts inside the live widgets are not copied or frozen in our code.

The user's V1 instruction authorizes the official Yelp integration. This adds no locally recreated Yelp card, screenshot, reviewer quote/avatar copy, or provider artwork. The official script owns its iframe contents/attribution, links, branding and analytics frame. Iframes stay mounted and retain node identity during slide changes and Upper Crust client navigation. The script loads once after hydration. While on another Upper Crust route, the persistent review region is hidden and auto-advance stops.

Repository inspection found no existing approved Google Places reviews client, route, or API integration. Google Reviews remains linked immediately below the heading, alongside Yelp Reviews. No old hardcoded Google quotations, author names, remote avatars, new billed service or API key was restored.

## Focused validation

- Local Chrome: real official provider content, three slides, previous/next/wrap, Home/End/arrows, accessible manual announcements, reduced motion, natural 11-second auto-advance/pause, and outbound Google/Yelp links.
- Widths 320, 390, 768, 1440px: responsive layout; no horizontal page overflow; stable iframe identity and zero iframe reloads while advancing and navigating menu → home. Mobile controls sit below the card to preserve reading width.
- Six photo identities: menu-card and detail images load at all four widths. Sample add/edit/simulated checkout succeeds with zero network writes.
- Existing menu/modifier Chrome checks pass at all four menu widths and 390/1440px modifier widths; defaults, zero toppings, paid extras, Ranch and cart editing preserved.
- Existing access/config/protected-media tests pass 18/18 (including proxy guards); original 26 asset hashes remain unchanged. Targeted ESLint and clean Next type generation/TypeScript pass.

The Next.js 16.4.2 Turbopack production build passes with local locked dependencies, including TypeScript. A fresh production-server run passes the photo/simulated-checkout checks, provider-carousel checks, and 20 route/viewport protected-presentation checks. The media route build trace includes exactly 26 approved files and no public/reference-media copies. Hosted verification gates staging promotion; the final integration report records its exact SHA and URL.
