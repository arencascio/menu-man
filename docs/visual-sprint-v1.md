# Visual Sprint V.1 — cinematic phone showcase

Local review only, based on production commit `e240fdbe14913340d5bea7d981ea18f10087d036`.

## Existing work preserved

The initial worktree had an unrelated AGENTS.md heading edit, the homepage's
`MarketingPhoneShowcase` integration, an untracked client component/CSS module,
and two owner-supplied untracked MP4s. The earlier implementation already had
a CSS phone, Website/Ordering buttons, a homepage still, muted inline looping,
reduced-motion fallback, and viewport pausing. This sprint evolves that work.
Hero copy, primary CTAs, navigation, existing analytics, restaurant logic,
payments, and environment configuration are untouched.

Classification: **System Piece**, scoped to marketing presentation.

## Component

`CinematicPhoneShowcase` receives a nonempty reel list and optional demo link.
`MarketingPhoneShowcase` composes it with public, approved Super Tacos content
from `marketing-phone-reels.ts`. Each reel supplies its label, description,
MP4/WebM source list, poster/alt text, disclosure, caption, and three features.

The existing layered frame now has a subtle depth edge, a one-time 16px entrance,
and desktop native CSS scroll progression from -7° to -3° yaw. Unsupported
scroll timelines retain the static perspective; mobile stays nearly frontal.
Only transforms/opacity animate. No scroll listeners, mouse tracking, perpetual
floating, libraries, dependencies, or 3D engine were added.

The reserved screen ratio matches the supplied 700×1516 recordings. The poster
is always beneath the video; each new reel fades in on `playing`, keeping the
screen filled while it loads. Reel selection does not change component height.
The existing phone/caption spacing is retained. Pause/play is keyboard accessible,
with 44px targets and visible focus styles. Demo ordering is explicitly simulated.

Only the selected reel receives sources, after the component enters the viewport.
Reduced motion uses still imagery and removes video sources, including when the
preference changes live. Video pauses offscreen, in hidden documents, and on
explicit Pause. Playback errors expose a status message and the real homepage
still. The ordering fallback accurately identifies that still as the homepage,
rather than presenting it as an ordering screenshot. Aborted play requests during
reel changes do not permanently disable playback.

## Approved assets and owner capture plan

| Asset | Current status | Size / duration |
| --- | --- | --- |
| `public/brand/previews/super-tacos-home.mp4` | Existing approved website footage, retained | 4,894,337 bytes; 30.12s |
| `public/brand/previews/super-tacos-ordering.mp4` | Existing approved menu/ordering footage, retained | 3,944,159 bytes; 28.73s |
| `public/brand/previews/super-tacos-mobile.png` | Existing approved homepage fallback | 421,298 bytes |
| Separate menu browsing reel A | Owner capture/edit still needed for a focused short reel | Target 8–12s |
| Separate customization + simulated checkout reel B | Owner capture/edit still needed for a focused short reel | Target 12–18s |
| Management preview reel C | Not supplied; **Staging only** | Target 10–15s |

The two current recordings retain Website/Ordering labels. No third public reel,
invented application recording, or fabricated management preview is rendered.
Review at 10s confirms actual item customization; review at 27s shows the sample
cart with checkout unavailable in that recording. The callout therefore says
**Sample cart**, not checkout. A fresh approved B recording is required to tell
the full simulated-checkout story, even if the current live demo now supports it.

Capture/encoding contract:

- Capture actual approved product UI without a device bezel, browser chrome,
  development overlays, cursor highlights, or private data. Keep important UI
  outside rounded screen corners. Do not stretch or reframe different ratios.
- Portrait 700×1516 or an exact proportional resolution; 24/30fps. MP4 H.264,
  yuv420p, fast-start metadata, roughly 2s keyframes, audio removed. Optional
  WebM VP9 may precede MP4 in `sources`; do not add nonexistent source paths.
- Aim for approximately 1–2MB per short reel while keeping menu text readable.
  Existing footage totals 8.84MB; website autoplay can fetch 4.89MB, with the
  second clip requested only after selection. This is a sizable mobile payload;
  shortening the recordings is the next useful optimization. No re-encoding was
  done without reviewing image quality against the originals.
- Supply a clean matching WebP/JPEG/PNG poster for each reel. The current shared
  still includes the old development indicator at its lower edge; a clean owner
  poster would improve reduced-motion/error presentation. Do not retouch product
  behavior or generate replacement UI imagery.
- A: browse real menu categories, search, then scroll through photo cards.
- B: open a real item, select supported modifiers, review the sample cart, and
  show the clearly simulated checkout result. No real purchase or payment.
- C: record only a synthetic Staging restaurant/account and approved management
  actions. Exclude customer/contact details, secrets, real orders, and revenue.
  Keep C outside `public/` and outside the public reel config. A later approved
  Staging-only host must enforce server-side environment gating and protected
  asset access; hiding a tab is not protection. No management access occurred here.

## Analytics hooks

The component bubbles `menu-man:phone-showcase` DOM CustomEvents. It does not
send network analytics or alter the provider/event contracts. Subscribe at
`document` or the component root. Payload contains only configured `reelId`,
`type`, and optional `action` (`pause`/`play`).

| `type` | Trigger / interpretation |
| --- | --- |
| `viewport_entered` | Once per mount; exposure only, **not engagement** |
| `playback_interaction` | Explicit Pause/Play control activation |
| `demo_opened` | Explicit click on the interactive restaurant demo link |
| `reel_selected` | Explicit selection of a different reel |

Autoplay and native `playing` callbacks never emit engagement events. Hook
installation, consent filtering, and provider forwarding remain separate work.

## Focused validation

Run local dev on port 3000, then `node scripts/qa-cinematic-phone.mjs` using
installed Google Chrome. This component check blocks external browser requests
and prevents demo navigation, so it does not open restaurant/database flows.
It covers desktop/mobile playback, rapid switching, manual pause/resume,
offscreen pause/resume, stable reel geometry, component layout shifts, hook
semantics, reduced motion with zero MP4 requests, and forced network failure.
Review screenshots under `.playwright/visual-v1/`. Existing application regression
results are reused; no broad commerce suite is required for this presentation work.

Final checks passed in installed Google Chrome at 320, 412, 768, and 1440px.
Component-attributed layout shift was 0.001464, 0.001137, 0.000610, and 0.000227
respectively (development measurement, not a production Lighthouse/Core Web
Vitals audit). Reel-switch height was unchanged; no horizontal page overflow or
browser runtime errors occurred. Explicit event assertions, rapid switching,
manual pause/resume, actual screen offscreen pause/resume, network failure, and
reduced motion passed. Reduced motion requested zero MP4s. Focused ESLint and
TypeScript checks passed. No dependency or source footage size was added.

The QA runner uses `http://localhost:3000`: the owner's existing server blocks
127.0.0.1 dev hydration/HMR resources, which initially prevented client startup.
No dev-server origin configuration was changed.

No commit, staging, push, deployment, database operation, or other worktree edit.
