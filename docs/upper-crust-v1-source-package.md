# Upper Crust V1 source package

Reviewed 2026-10-26 on `feature/upper-crust-private-demo`, starting at
`6b1b1af`. Target RC `13a6dc45` was compared through Git objects only; it was
not modified. This is source packaging, not integration or deployment approval.

## Commit groups

- `b4cb3f8`: nine shared presentation files. Optional menu display/copy hooks,
  item typography tokens, navigation/carousel icons, photo viewer and carousel
  controls, mixed Google/Yelp reviews, and brand-scoped simulated checkout.
  Classification: System Pieces and presentation Variants. Defaults retain
  Super Tacos branding; no authoritative pricing, cart model, payment provider,
  checkout API, database, or modifier validation implementation was changed.
- `4704602`: 25 private Client Piece/support files: Homepage, Menu, About,
  informational Catering, simulated Checkout, shared header/footer, approved R3
  awning/gallery composition, stable-scale brick backgrounds, content/fixture,
  access/media guards, local launcher and remote-fetch guard. Only the Upper
  Crust hunks of the mixed proxy file were staged; Diagnostics and visual-study
  hunks remain in the working tree. One extra blank line at the end of
  `UpperCrustDetails.tsx` was removed for a clean diff check.
- The documentation/support commit containing this report adds the existing
  Boogaloo font with its OFL license/provenance and three existing Chrome QA
  scripts. It does not add screenshot, profile, result-log, or reference-photo bytes.

## Assets and exclusions

The 16-photo awning/gallery implementation and selected storefront composition
are preserved in source. The supplied image files remain present locally.
Publication authorization is not inferred from selection or local-review use.
No additional authorization was established during this packaging run.

Included asset: [Boogaloo](../public/fonts/boogaloo/provenance.json), whose
embedded copyright/license names John Vargas Beltran and SIL OFL 1.1. The
accompanying [license](../public/fonts/boogaloo/OFL.txt) comes from
[Google Fonts](https://raw.githubusercontent.com/google/fonts/main/ofl/boogaloo/OFL.txt);
copyright spelling matches the font's embedded metadata. Font bytes are unchanged.

Excluded, preserved locally:

- `public/img/sandwich-shop/`: 16 awning photos, storefront/crop, and unused food
  images; no publication-rights record was found.
- `public/img/upper-crust/`: logo and brick image candidates; no publication-rights
  record was found. Active code uses `upper-crust.png` and `brickwall2.webp`.
- The five new Google/Yelp/Tripadvisor/pause icons: supplied/reference assets
  without a recorded publication license. Existing tracked icons are unchanged.
- `public/fonts/broadway/`: proprietary Microsoft/Monotype/URW copyright in the
  font metadata, without a demonstrated web redistribution license. Its unused
  CSS font-face declaration remains preserved; the font bytes are excluded.
- `.local-reference-media/`: explicitly local-review-only photographs, retained
  behind the private media route and excluded by the committed ignore rule.
- `.tmp/` and ignored `.playwright/`, browser profiles, screenshots, recordings,
  generated files, local environment files and credentials.
- Diagnostics pages/library/QA, its test-runner import and proxy hunks;
  `AGENTS.md` content-rule/generated-heading changes; formatting-only
  `tsconfig.json` changes.
- All development-study routes/scripts, unused sandwich/storefront illustrations,
  the superseded standalone Yelp carousel/components, stale page-QA script, and
  older handoff documents. The DoorDash research/blocker and inactive menu
  archive remain uncommitted for the separate full-menu iteration.

Consequently a clean checkout of these commits is **not visually self-contained**:
the referenced uncommitted images must receive publication authorization and be
packaged separately, or receive an approved replacement plan. No asset was
deleted, moved into Git, or silently substituted to conceal this gap.

## RC overlap and integration attention

The sole intersection between the packaged files and RC changes since `6b1b1af`
is [menu-browser.module.css](../src/app/r/[slug]/menu-browser.module.css). RC adds
the conditional-modifier indentation rule at the end; this source changes menu
presentation and typography earlier in the file. Preserve both during integration.
No trial merge or conflict resolution was performed.

The other shared files are `MenuBrowser.tsx`, `RestaurantCarouselIcon.tsx`,
`RestaurantNavigationIcon.tsx`, `RestaurantPhotoFilmstrip.tsx`,
`RestaurantReviews.tsx`, `SuperTacosDemoCheckout.tsx`, the filmstrip/review
stylesheets, and `src/proxy.ts`. They still need merged-tree review, especially
carousel focus/motion defaults and isolated simulated receipt storage.

`RestaurantReviews.tsx` currently embeds an Upper Crust Yelp business identifier
inside the optional shared Yelp rendering path. This is a presentation coupling
to review before wider reuse; it was preserved, not generalized during packaging.
The menu style prop/selectors are likewise explicitly named for Upper Crust.
No Upper Crust-specific authoritative commerce branch was introduced.

The source branch predates Conditional Modifiers V1 and dependency-security fixes.
Do not use its older core or package manifests to overwrite RC versions. Neither
package manifest nor any migration is included in this source package.

## Hosted-demo blockers

- The server layout, media route and proxy deliberately require explicit local
  opt-in, exact Staging project URL, `MENU_MAN_ENV=staging`, loopback Host and no
  Vercel environment. Hosted previews return 404. Upper Crust APIs remain denied
  even locally. Private/no-store and noindex/nofollow/noarchive headers remain.
- Local reference photos are outside Git and are not deployable content. Before
  hosting, approve content rights, package authorized assets, verify build traces,
  and design/test real deployment access protection in a separate task.
- Existing Google Maps/Yelp embeds and remote reviewer avatars require browser
  network access and provider availability. The server fetch guard is not a
  browser network firewall. Earlier all-offline QA does not certify these later
  embedded sections. Review display rights/provider terms before hosted use.
- The menu remains nine illustrative items with sample prices/options and
  `is_orderable: false`; only the existing browser-only preview makes them
  interactive. No full DoorDash catalog was imported. Retain disclosures and
  verify current hours, history claims and dated review snapshots before hosting.
- The Stoke `next/font/google` import requires font retrieval during a fresh
  build. Packaging did not introduce a new font service or build workaround.

## Validation and reused evidence

- Git connectivity check passed. Exact staged file lists and diffs were reviewed;
  each commit passes whitespace checks. Intended text is valid UTF-8 with no
  replacement/mojibake signatures. An encoding issue in the excluded awning
  study page was left untouched.
- Four focused access, page/media allowlist and Los Angeles hours tests passed.
- Fixture assertions passed: synthetic tenant ID, nine distinct item identities,
  four consistent groups, illustrative integer-cent prices, no defaults or live
  orderability, stable `uc-custom` link, 16 present local awning assets, and
  reference-media allowlist consistency.
- Active fixture matches its archived bytes, SHA-256
  `71ac7fb2f0f739416f4a0e98871afacb012007bbd6af836dd0c29eade4043431`.
- Reused local Upper Crust smoke results at 320/390/768/1440 and Super Tacos
  simulated-checkout results at 390/1440. Reused newer mixed-review results at
  320/412/1440: 14 cards, three genuine Yelp widgets, zero iframe reloads/removals,
  wraparound/keyboard/reduced-motion checks, and desktop timed autoplay/pause/resume.
  These are existing evidence, not newly run or complete current-page certification.
- The old `upper-crust-pages.browser-qa.mjs` expects "Build a Sammich" while current
  source says "Build a Sandwich", and includes study-route assumptions. It is
  excluded, not silently updated or cited as a current pass.
- No broad application suite, build, Chrome rerun, dependency audit, database
  mutation, deployment, push, or RC/worktree integration was performed.

Obtain exact committed file lists with `git show --format= --name-only <sha>`.
All unrelated pre-existing file bytes remain intact; the only source-byte cleanup
was the extra EOF blank line noted above. Integration and hosted publication remain
separate Director decisions.
