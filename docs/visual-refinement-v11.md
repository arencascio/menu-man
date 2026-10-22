# Menu Man V1.1 visual refinement handoff

## Scope and preserved work

Continued on `feature/super-tacos-demo` from the existing uncommitted cinematic
phone, playlist, navigation and density work. Preserved both original MP4s,
existing CTAs, analytics hooks and the unrelated AGENTS.md heading modification.
No staging, commits, pushes, deployments, database operations, payment changes,
restaurant behavior changes or other worktree edits were performed.

This handoff supersedes the earlier V1.1 recommendation to remove duplicated
feature explanations. The four featurettes intentionally remain on **both**
Home and Work, using one component with independent state and unique IDs.

## Presentation changes

- `MarketingFeaturettes.tsx` and its scoped stylesheet provide four shared
  featurettes. Desktop uses a keyboard-accessible selector with a stable adjacent
  panel; mobile opens the selected detail immediately under its own heading,
  permits one open item and allows all items to close. Icons precede titles.
  Panels do not repeat their heading. Exact owner-approved smartphone and
  ordering copy is shared by both pages. No marketing em dashes were added.
- Static, genuine frames demonstrate mobile UI, search results, pickup/delivery
  actions and hours/location. A stable media slot accommodates a future manual
  player. No extra feature videos or autoplay downloads were introduced.
- Home and Work share the same compact Super Tacos showcase card. It uses the
  approved carnitas hero photograph, in-image restaurant name and uppercase
  eyebrow, short body copy and one prominent **Explore live demo** CTA with an
  external arrow to `/r/super-tacos`. One fictional-demonstration disclosure sits
  outside the grid. Mobile photography is shorter; desktop supports three
  columns when more approved cards exist.
- Work now uses the same cinematic reel as Home. Its final CTA is centered.
- Mobile navigation uses the real `menu.svg` in a 44px square. The duplicate
  inner heading and close button are removed. The panel expands from and
  reverses toward the square using 520ms clipping/translation and a 450ms fade.
  Escape, backdrop dismissal, focus trap/restoration and scroll locking remain.
- Phone annotations have compact padding, constrained widths and shorter mobile
  labels; the third annotation is omitted at the narrowest size.
- Mobile footer spacing is reduced while preserving navigation, contact and
  legal links with 44px minimum interactive heights.

## Motion

- General marketing reveals: 850ms entrance with 240ms reading stagger.
- Process: the entire three cards, including icons, headings and descriptions,
  enter over 800ms with 0/400/800ms delays. The observer excludes the bottom 16%
  of the viewport and requires intersection before starting. Cards stay visible
  after their first entrance.
- Shared footer logo: one 1500ms Y-axis entrance from -75 degrees with a subtle
  16px downward settle. Duration and angle are component properties. Its layout
  space is reserved. It is used in every shared marketing footer.
- Reduced motion removes these transforms/transitions and keeps content visible.
  The existing reel uses its static poster with no automatic MP4 requests.

## Approved media and loading cost

| Asset | Bytes | Notes |
| --- | ---: | --- |
| Homepage MP4 | 4,894,337 | Original unchanged, 700 x 1516, approximately 30s |
| Ordering MP4 | 3,944,159 | Original unchanged, 700 x 1516, approximately 29s |
| Clean reel poster | 90,288 | Full-size homepage frame at 1s |
| Mobile feature frame | 85,080 | Homepage at 1s |
| Search feature frame | 40,038 | Ordering at 20s |
| Ordering feature frame | 9,192 | Homepage pickup/delivery actions at 1s |
| Information feature frame | 38,658 | Homepage at 29s |

The four feature images total 172,968 bytes before Next image optimization.
The clean poster replaces the old fallback containing a development marker;
the original PNG is retained. The capture script and `sources.json` record
timestamps, crop rectangles, dimensions and source/output SHA-256 hashes.
No application UI was fabricated or retouched.

Both MP4s together are 8,838,496 bytes (8.43 MiB), a meaningful mobile loading
cost. The existing player attaches only the active source and pauses offscreen;
reduced motion and data saver keep automatic playback disabled. Shorter approved
edits remain the useful next media improvement. No new animation dependencies.
The MP4s and new frames are visible to Git and are not ignored.

## Focused validation

- Chrome, Home and Work, 320 / 412 / 768 / 1440px: no horizontal overflow;
  approved card photo decoded; exact copy, disclosure and link verified;
  all four featurette selectors, inline mobile panels, collapse behavior,
  desktop keyboard selection and stable panel dimensions checked.
- Mobile touch, keyboard, Escape, backdrop, reverse closing state, focus
  restoration and scroll unlock passed at all three mobile/tablet widths.
- Work reel switches to the actual Ordering footage and back at 412/1440px.
  The existing phone component QA passed all four widths, including rapid
  switching, pause/resume, offscreen pause, playback failure poster/status,
  reduced motion and explicit-interaction analytics hooks. Autoplay emits no
  engagement event. Earlier playlist/data-saver/load-cost validation is reused.
- Actual process transition events measured 400ms start spacing and 800ms
  durations. A near-bottom partial appearance did not start the sequence.
  Footer finished at its untransformed position and reduced motion stayed still.
- Reduced motion on both routes made zero MP4 requests. Exactly one video
  element exists per route; featurettes add none. Frame provenance hashes passed.
- Development-page observed CLS was below 0.001 in the refinement run;
  the separate component run remained below 0.002. These are local development
  observations, not production Core Web Vitals or a full performance audit.
- Focused ESLint, TypeScript (`tsc --noEmit --incremental false`) and
  `git diff --check` passed. Existing platform/commerce test evidence is reused;
  no broad platform suite was run for these presentation changes.

Reproduction: `node scripts/qa-marketing-refinement.mjs` and
`node scripts/qa-cinematic-phone.mjs`, against the existing local dev server.
The refinement script blocks API, restaurant and management requests.

## Owner review and remaining media

Screenshots and structured report: `.playwright/refinement/`.
Useful captures: `work-1440.png`, `home-320.png`,
`home-features-1440.png`, `home-features-412.png`, `home-card-412.png`,
`home-menu-open-320.png`, `menu-collapsing-412.png`,
`process-sequence-mid.png`, `footer-turn-mid.png`, `home-footer-320.png`.

Review live interactions at `http://localhost:3000` and `/work`.

No new media is needed to review this sprint. Later owner inputs remain a
shorter menu-browsing edit, an approved complete customization/simulated-checkout
recording and a separate Staging-only management recording. The supplied
Ordering footage shows customization and a sample cart with checkout unavailable;
the presentation makes no claim that it demonstrates completed live ordering.
Any future 3-5s search micro-reel should keep a static poster, explicit playback,
`preload="none"`, deferred sources and reduced-motion/data-saver handling.

Stopped for owner screenshot and interaction review. All work remains uncommitted.
