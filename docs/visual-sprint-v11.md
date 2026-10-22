# V1.1 — density and cinematic reel polish: local review

Built on the uncommitted V.1 work at production commit
`e240fdbe14913340d5bea7d981ea18f10087d036`. The existing phone component,
wrapper, footage and poster were inspected first. The unrelated AGENTS.md
heading edit remains unchanged. This handoff supersedes V.1 density and native
single-video-loop behavior; V.1 remains a historical record.

## Presentation changes

- **Hero:** smaller mobile heading, 16px top padding, tighter copy/CTA spacing,
  64px mobile header, and an intrinsic phone stage replacing fixed empty height.
  Full desktop composition fits within 1440×900. At 320×568, the screen starts
  around y=418, giving roughly 150px of visible product immediately. The entire
  mobile hero remains scrollable; it is not squeezed into one short viewport.
  Heading/body/CTA content is retained, with no fixed-height content clipping.
- **Evidence:** tighter padding, heading/copy gaps and stat typography. Both
  statistics remain side by side on mobile. Approved numbers, wording and source
  link are unchanged.
- **How It Works:** compact desktop three-column row; mobile steps use a narrow
  icon/number rail beside the text. Original messages are unchanged. The section
  is ~511px at 375px/412px and ~583px at 320px, where its copy needs slightly more
  than a 568px viewport. Text is not hidden to force a fold target.
- **Working Product:** the real Super Tacos card precedes the supporting cards.
  On desktop its introduction sits beside the single card, using previously
  empty space. The underlying showcase grid supports three real demos per row
  at wide widths, two at medium widths, and one on mobile. No restaurant or
  placeholder was added. The mobile showcase remains full width and unchanged
  in its image/card sizing. Capability cards have smaller gaps, icons and padding.
- **Mobile navigation:** dark green panel, paprika edge, panel heading, explicit
  close control, backdrop and separated links. Focus enters the panel, Tab wraps,
  Escape/backdrop/close dismiss it, and focus returns to the menu button. Root
  scroll locking is independent of the review dialog's body lock, so opening
  that dialog does not leave the document locked after dismissal.

## Before / after section heights

Rounded CSS pixels, measured after fonts loaded in the same local Chrome setup.
`before` is the actual initial uncommitted V.1 work, not the old production SVG.
All copy, factual claims and primary CTA destinations remain unchanged.

| Viewport | Hero | Evidence | How It Works | Working Product |
| --- | ---: | ---: | ---: | ---: |
| 320×568 | 1348 → 902 | 815 → 377 | 1017 → 583 | 1969 → 1651 |
| 375×667 | 1447 → 990 | 815 → 356 | 1017 → 511 | 1934 → 1554 |
| 412×915 | 1472 → 1014 | 751 → 337 | 979 → 511 | 1855 → 1529 |
| 768×1024 | 1333 → 999 | 542 → 321 | 847 → 456 | 1855 → 1334 |
| 1440×900 | 1045 → 761 | 406 → 244 | 547 → 408 | 1779 → 821 |

Desktop hero ends at y≈841 including the existing 80px header. At mobile widths,
the phone screen now starts near y=418/427/421 instead of y=828/833/830.
Raw baseline and final geometry: `.playwright/v11/before.json`, `after.json`,
and `report.json`.

## Phone and playlist

The existing CSS frame, gentle perspective, shadow and native scroll animation
remain. Website/Ordering now sits below the phone in a thinner segmented control.
It renders configured reels only, leaving natural room for a later approved
third reel without an empty Management option.

Native `ended` events advance to the next available reel and wrap to the first.
Manual selection and explicit pause remain available, including during rapid
switches. Pausing then selecting another reel retains the paused preference.
Offscreen and hidden-document playback pauses. Only the active reel is mounted;
sources are deferred until its screen intersects. Unmounted video resources are
released after real DOM detachment, respecting React development Strict Mode's
ref replay. This also removed duplicate startup requests found during QA.

Both intrusive screen badges were removed. One nearby caption accurately
discloses the fictional demo and, for Ordering, that no real order/payment occurs.
The first callout is **Custom website**. Mobile labels are shorter and squarer,
with the right callout moved above recorded pickup controls. The third callout
is hidden at 320px. No additional bubbles were added. Playback controls remain
keyboard accessible with visible focus and an unobtrusive visual treatment.

Reduced motion uses the real still, disables frame motion and requests no video.
Where `navigator.connection.saveData` is available and true, each reel requires
explicit Play; an automatically selected next reel returns to its poster until
the user chooses Play. This avoids silently downloading a playlist on data saver.
Network/playback failures retain the poster and an accessible status caption.

## Measured video transfer and encoding

Chrome DevTools Protocol, HTTP cache disabled, local dev server, completed 206
range responses, `Content-Encoding: identity`, no disk/service-worker cache:

| Clip | Source bytes | Actual received body bytes | Completed encoded transfer bytes, including HTTP headers |
| --- | ---: | ---: | ---: |
| Website | 4,894,337 | 4,894,337 | 4,894,675 |
| Ordering | 3,944,159 | 3,944,159 | 3,944,497 |
| Both selected | 8,838,496 | 8,838,496 | 8,839,172 |

The initial run requested Website once and **zero Ordering bytes**. Ordering
was requested once after selection, with no inactive preload. The full initial
4.89MB autoplay payload remains sizable for mobile despite fast-start metadata.

Both supplied files are 700×1516 H.264/AVC (`avc1`), silent, with `moov` before
`mdat`. Browser durations are 30.119s and 28.733s (roughly 1.30 and 1.10Mbps).
The files were inspected, not re-encoded or overwritten.

At 150ms latency and 200KiB/s download in Chrome emulation, explicit data-saver
Play reached a first frame in about **1.18s**. The unmount test observed 509,258
payload bytes before deliberate navigation canceled the active request; CDP does
not provide a complete final encoded total for that aborted response, so none is
claimed. No new video requests occurred after client navigation to Services.
These are local browser measurements, not CDN/field performance guarantees.

Recommended owner derivatives: 8–12 seconds, native portrait ratio, 24/30fps,
H.264, yuv420p, no audio, fast-start, ~2s keyframes. Try CRF 26–29 and a slow
encoder preset, with an approximately 800–1100kbps budget for a 10s clip targeting
**1–1.5MB**. Review search text, prices and modifier labels before accepting any
compression. Keep originals and write new derivative files. Optional WebM may
precede the MP4 fallback in reel sources when supplied and approved.

## Event hooks

Existing bubbling `menu-man:phone-showcase` hooks remain provider-neutral:

| Type | Meaning |
| --- | --- |
| `viewport_entered` | Once per reel per mount when that screen is visible; exposure only |
| `reel_selected` | User explicitly chose a different reel |
| `reel_advanced` | Native end-of-video automatic next/wrap; **not engagement** |
| `playback_interaction` | User explicitly activated Pause/Play, with `action` |
| `demo_opened` | User clicked the interactive restaurant demo link |

Payload contains configured `reelId`, `type`, and optional playback `action`.
Autoplay/`playing` does not emit an engagement conversion. No analytics provider,
network forwarding, new tracking platform or existing CTA contract was changed.

## Focused validation and review artifacts

Passed `npx tsc --noEmit`, targeted ESLint, updated V.1 component checks, the new
`node scripts/qa-visual-v11.mjs` checks, and `git diff --check`. Git's LF/CRLF
advisory is not a whitespace-check failure.

Chrome covered 320×568, 375×667, 412×915, 768×1024 and 1440×900: initial product
visibility, no horizontal overflow, selector placement, real-demo ordering,
reel-switch height stability, rapid switching, native automatic advance/wrap,
manual pause, offscreen resume, keyboard controls, navigation dismissal/focus,
review-dialog scroll-lock handoff, reduced motion, network failure, data saver,
slow playback, actual transferred bytes and client unmount cleanup. Final
development CLS observations were below 0.0003 for the page/component in this
run; these are observations, not a production Lighthouse/Core Web Vitals audit.
Existing restaurant/payment regression evidence is reused.

Local screenshots under `.playwright/v11/`:

- `before-320.png`, `before-1440.png`: initial uncommitted baseline.
- `after-320.png`, `after-375.png`, `after-412.png`, `after-768.png`, `after-1440.png`: final initial folds.
- `reel-412.png`, `reel-1440.png`: complete reel presentation.
- `menu-320.png`, `menu-375.png`: open navigation.
- `evidence-375.png`, `process-375.png`, `product-375.png`, and desktop equivalents: condensed sections.
- `reduced.png`: motion preference fallback.

The Next development indicator outside product footage is local tooling and
does not appear in production. The existing fallback still itself has an older
development marker; that owner poster should be replaced with a clean capture.

## Files and next owner inputs

V1.1 changes: `src/app/page.tsx`, `page.module.css`,
`restaurant-showcases.module.css`, `MarketingInteractions.tsx`,
`CinematicPhoneShowcase.tsx`, `marketing-phone-showcase.module.css`,
`marketing-phone-reels.ts`, `scripts/qa-visual-v11.mjs`, two playlist expectations
in `scripts/qa-cinematic-phone.mjs`, and this handoff. The V.1 wrapper, approved
source media, existing V.1 document and unrelated AGENTS.md edit are preserved.

Owner inputs still needed: shorter approved menu-browsing footage, a complete
actual customization/simulated-checkout recording, and clean matching posters.
The current Ordering clip shows customization and a cart with checkout unavailable;
its callout remains **Sample cart**. Management footage remains absent and
Staging-only; no management option or public media path was added.

Recommendation for later: replace the three overlapping capability cards with
one compact proof list tied to actual reel moments and the live demo. Keep deeper
feature explanations on Work, rather than repeating the reel callouts. This sprint
retains the existing feature system with reduced visual weight.

All work remains unstaged/uncommitted for owner review. No push, deployment,
database/environment/publication change, payment change or other worktree edit.
