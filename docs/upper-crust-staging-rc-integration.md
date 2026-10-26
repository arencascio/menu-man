# Upper Crust V1 staging RC integration

Integrated 2026-10-26 on `release/staging-rc-v1`, starting at `13a6dc45`.
The source worktree and its remaining changes were not modified.

| Approved source | RC commit | Group |
| --- | --- | --- |
| `b4cb3f8` | `003321a` | Shared presentation |
| `4704602` | `54fedea` | Private site, fixture and access guards |
| `fc758a0` | `ff820f1` | Licensed font, QA support and source report |

All three cherry-picks applied without manual conflicts. Git auto-merged
[menu-browser.module.css](../src/app/r/[slug]/menu-browser.module.css).
Compared with the approved source stylesheet, the merged file differs only by
the RC's retained `.dependentModifierGroup` rule. Its indentation and the Upper
Crust typography/layout rules are both present. No product decisions or conflict
resolution changes were required.

The dependency manifests, migrations, cart/checkout core, item panel,
card-ordering classifier and test runner are byte-for-byte unchanged from
`13a6dc45`. The nine-item illustrative Upper Crust fixture and synthetic tenant
identity remain intact. No excluded media, proprietary fonts, study routes,
Diagnostics changes or browser artifacts were imported.

## Validation

- Next route type generation and TypeScript passed.
- ESLint passed.
- Standard Turbopack production build passed with the two filesystem-tracing
  warnings described below. Build configuration used process-only loopback
  placeholders; no credentials or environment files were changed.
- Focused conditional/flat cart, canonical modifiers, checkout source/replay,
  menu navigation/scroll/ordering, Upper Crust access/hours, and existing
  migration contracts: **99/99 passed**. This includes all 40 migration contracts;
  no database was contacted or migration executed.
- Google Chrome conditional lifecycle at 1440/412/320 passed: parent/child
  activation, child reset, required validation, authoritative fixture amounts,
  cart persistence/quantity/editing, no horizontal overflow, no page errors or
  browser writes.
- Google Chrome against the production build at 1440/320 passed: local private
  Homepage/About/Menu routes, R3 awning presence and photo advance, 14 review
  cards, mobile navigation, flat required customization, persisted cart,
  brand-isolated simulated checkout/UC receipt and no payment inputs. No page
  errors or browser write requests. Expected missing-image 404s were recorded,
  not replaced. This is behavior verification, not visual approval of incomplete
  pages or a fresh live-provider widget check.
- Production/Vercel-mode pages and media returned 404; a native HTTP non-loopback
  Host probe and a local order-API POST probe returned 404. Private robots/cache
  protection remains. An initial Node fetch Host-override probe did not transmit
  the intended Host; the native HTTP check corrected that test-harness issue.
- Prior source Chrome evidence is reused for unchanged detailed visual/review
  behavior and Super Tacos defaults. No broad application suite was repeated;
  this task does not change the established four-failure application baseline.
- Git scope/whitespace/connectivity checks passed. Temporary conditional QA route
  was removed and local test servers were stopped. Raw QA output remains ignored
  under `.playwright/upper-crust-integration/` and `.playwright/conditional-modifiers/`.

## Hosted-release blockers

The private layout, proxy and media handler intentionally require local opt-in,
the exact Staging project URL, staging application mode, loopback Host and absence
of Vercel environment markers. Hosted operation remains denied; deployment access
protection is a separate Director decision. All commerce remains simulated and
Upper Crust order APIs remain denied even locally.

The [media handler](../src/app/r/upper-crust/reference-media/[asset]/route.ts)
causes Turbopack's two dynamic-filesystem warnings. Its generated trace contains
1,097 entries, including 452 source files, 253 public files and 51 documents.
No environment files, Git metadata or browser artifacts were found in this trace.
Trace scoping/exclusion must be addressed and revalidated before a hosted release;
the runtime access gate alone does not prevent build-time packaging. No tracing
configuration or source behavior was changed during this integration.

External dependencies remain Google Maps iframe, Yelp widget script/iframes and
Google reviewer avatars at runtime, plus Stoke retrieval through `next/font/google`
at build time. Targeted local behavior QA blocked external browser requests;
it does not establish live-provider availability. Rights, provider terms, dated
rating snapshots and restaurant facts need disposition before hosted use.

There are **25 absent public-file references** and **7 local-reference routes
without packaged image bytes**. These are intentional exclusions inherited from
source packaging. They prevent complete visual rendering from a clean checkout.
The Broadway font-face declaration is unused; its proprietary font remains absent.
Some pause-image references serve optional non-SVG presentation paths. No asset
was fabricated or substituted. The licensed Boogaloo font is present.

## Exact absent references

Public files (relative to public/):

- `img/icons/Google_Symbol_0.svg`
- `img/icons/yelp icon.svg`
- `img/icons/tripadvisor wordmark.svg`
- `img/upper-crust/upper-crust.png`
- `img/sandwich-shop/storefront-crop.png`
- `img/upper-crust/brickwall2.webp`
- `fonts/broadway/Broadway-Regular.ttf`
- `img/icons/google-g.png`
- `img/icons/pause.svg`
- `img/sandwich-shop/awning-carousel/blt.jpg`
- `img/sandwich-shop/awning-carousel/brownie.jpg`
- `img/sandwich-shop/awning-carousel/chicken salad.jpg`
- `img/sandwich-shop/awning-carousel/cobb salad.jpg`
- `img/sandwich-shop/awning-carousel/corned beef.jpg`
- `img/sandwich-shop/awning-carousel/hawaiian sandwich.jpg`
- `img/sandwich-shop/awning-carousel/italian sub.jpg`
- `img/sandwich-shop/awning-carousel/pastrami and corned beef.jpg`
- `img/sandwich-shop/awning-carousel/pastrami and roast beef.jpg`
- `img/sandwich-shop/awning-carousel/pastrami on sourdough with potato salad.jpg`
- `img/sandwich-shop/awning-carousel/pastrami.jpg`
- `img/sandwich-shop/awning-carousel/tuna on wheat with clam chowder.jpg`
- `img/sandwich-shop/awning-carousel/turkey and ham on a crossaint with poblano soup.jpg`
- `img/sandwich-shop/awning-carousel/Veggie sandwich and tomato florentine soup.jpg`
- `img/sandwich-shop/awning-carousel/veggie sandwich with turkey.jpg`
- `img/sandwich-shop/awning-carousel/veggie sandwich.jpg`

Unpackaged local-reference media routes:

- `/r/upper-crust/reference-media/front-door.jpg`
- `/r/upper-crust/reference-media/hanging-sign.jpg`
- `/r/upper-crust/reference-media/patio.jpg`
- `/r/upper-crust/reference-media/dining.jpg`
- `/r/upper-crust/reference-media/takeaway.jpg`
- `/r/upper-crust/reference-media/desserts.jpg`
- `/r/upper-crust/reference-media/front.jpg`
