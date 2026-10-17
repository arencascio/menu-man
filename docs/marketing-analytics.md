# Marketing analytics

Explicit PostHog events cover only `/`, `/services`, `/work`, and
`/build-my-website`. The root client observer uses `usePathname` for initial loads
and client navigation. Repeated effects/unchanged paths, query-only changes and
fragment navigation do not create another pageview. Leaving marketing and returning
does create a new visit. Restaurant `page_view` and all existing commerce events
retain their existing provider contracts; they are not marketing `$pageview`s.

## Configuration and privacy

Reuses `src/instrumentation-client.ts` and the existing public PostHog project
configuration (`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`). No new
analytics service or credentials are added. The request-specific regional gate
below applies before PostHog initialization and to the existing optional GA4
loader. Marketing events are still sent only to PostHog.

Autocapture, automatic pageviews/pageleaves, recording, exception capture, flags,
heatmaps and performance capture remain disabled. Identity remains memory-only;
person profiles remain `never`. Marketing checks SDK initialization and its
existing opt-out state. No consent banner is displayed. Disabled/unavailable
PostHog and tracking exceptions never block UI,
navigation or lead delivery.

All marketing events have `analytics_scope=marketing`, `environment`, and `page`
(one of the four paths). `environment` maps Vercel's built-in
`NEXT_PUBLIC_VERCEL_ENV`: `preview` becomes `staging`, `production` stays
`production`, `development` stays `development`, and missing/unrecognized values
become `unknown` (never guessed as production). No project environment variables
are changed by this feature. Optional campaign properties are attached as described below. No form
values, names, emails, phones, submitted URLs, free text, submission IDs, raw
errors, link hrefs/text, full current URLs or referrers are sent by this layer.
The SDK `before_send` hook applies a final property allowlist **only** to scoped
marketing events, stripping automatic current/initial/referrer URL and nested
person properties. Existing SDK token, anonymous/session/window IDs, library
version and insert ID can remain; `$process_person_profile=false` is retained
so the SDK's no-profile instruction survives filtering. No new identity is created. Other events pass
through unchanged. See [PostHog's privacy hook documentation](https://posthog.com/docs/product-analytics/privacy).

## Event dictionary

| Event | Extra properties | Meaning |
| --- | --- | --- |
| `$pageview` | None | One marketing route transition, including initial arrival |
| `marketing_cta_clicked` | `cta_id`, `placement`, `destination_type` | Activation of an explicitly marked CTA; not a conversion |
| `marketing_form_opened` | `form_type` | Inquiry displayed, or review modal opened; one per open instance, resilient to Strict Mode effect replay |
| `marketing_form_started` | `form_type` | First change leaving a meaningful nonempty value or checkbox/radio selection, or autofilled values captured on submit; not focus/each keystroke/honeypot-only interaction |
| `marketing_lead_accepted` | `form_type` | Successful HTTP response with `accepted:true` from the existing email-provider acceptance handler |
| `marketing_lead_failed` | `form_type`, `failure_category` | Client URL validation, network/timeout, or unconfirmed/rejected server attempt |
| `marketing_email_clicked` | `placement`, optional `form_type` | Footer or form email fallback activated; never counts as an accepted lead |

`form_type`: `website_inquiry` or `website_review`.

`cta_id`: `build_website`, `website_review`, `explore_product`, `services_pricing`,
`site_like_this`. IDs do not depend on copy. CTA and email clicks use one delegated
capture-phase listener, which records the source page before Next navigation.

`placement`: `navigation`, `hero`, `section`, `final_cta`, `footer`, or `form`
(email fallbacks). `destination_type`: `page` or `modal` for CTAs.

`failure_category`: `validation` (including rejected origin/body), `network`
(including timeout), `rate_limit` (429), `provider_failure` (502), `configuration`
(503), or `unconfirmed` (other/unexpected responses). Native HTML constraint
validation prevents submit before the handler and is not counted as a failed
delivery attempt. Failure events never contain the response's error text.

## Campaign attribution

Allowlisted keys: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`.
Use campaign codes containing only ASCII letters/digits, underscores or hyphens,
starting with a letter/digit, maximum **64 characters** per value. Unsupported,
duplicate, malformed or overlong values are ignored. Never put personal details
in campaign codes. No other query parameter is collected.

Example business-card URL (routing unchanged):

```text
https://getmenuman.com/?utm_source=business-card&utm_medium=qr&utm_campaign=local-2026&utm_content=batch-a
```

The first nonempty valid campaign is retained across marketing navigation and
reloads in **tab-scoped sessionStorage** under `menu-man:marketing-campaign:v1`.
Only the four sanitized campaign codes are stored, with no identity or original
URL. A later campaign does not overwrite first touch or fill its missing fields.
Campaign storage is read/written only after regional eligibility is confirmed,
PostHog is initialized and capture is not opted out. A subsequent marketing
tracking call while denied or opted out clears it; storage failures fall back to
memory for the current document. Closing the tab ends normal session storage
lifetime (browser restore behavior may vary). No cookies/localStorage or anonymous
identity persistence are added. SDK anonymous identity still resets on reload,
so cross-reload attribution does not guarantee cross-reload visitor continuity.

## Counting limits

- Accepted events reflect provider acceptance, not inbox delivery or a sale.
- Success is a browser signal. Blocking, closing the tab, SDK/network failure or
  an ambiguous response can undercount accepted mail. There is no new server outbox.
- The existing submission UUID and delivery idempotency are unchanged. One
  submitter instance emits acceptance once for its last accepted UUID, even if
  the same accepted submission is retried. Reloads/new instances can count again;
  no submission ID or extra persistent deduplication identifier is sent to PostHog.
- Counts are best effort, not billing/accounting records. Form opens can exceed
  visits when someone reopens the review modal. A new modal instance can start again.
- The US-only regional gate below applies. Existing PostHog IP receipt and
  project-side GeoIP processing remain for eligible events; regional suppression
  does not change those settings. Do not place personal data in UTMs.

## Banner-free regional eligibility

Approved initial policy: optional analytics runs only for a reliably determined
`US` country. All other countries (including EU/UK), missing/invalid location,
failed requests and invalid responses deny analytics. This is the approved
product policy, not a claim that IP geolocation proves physical location.

`GET /api/analytics/eligibility` reads only Vercel's server-provided
`x-vercel-ip-country`, and only when server-side `VERCEL=1` and `VERCEL_ENV` is
`production` or `preview`. It returns only `{ "allowed": true | false }`, never
IP, country, city, region or coordinates. There are no URL, locale, cookie,
client-country-header or environment-variable country overrides. Local and
self-hosted runtimes deny even with spoofed Vercel-looking request headers.

Trust boundary: deploy directly behind Vercel ingress, where these geo headers
are supplied by the platform, as described in [Vercel's request headers](https://vercel.com/docs/headers/request-headers)
and [conditional analytics example](https://vercel.com/kb/guide/geolocation-script).
Do not self-host with manually set `VERCEL` flags or put an unreviewed proxy in
front of Vercel. A VPN/proxy can change the IP's inferred country. No application
code can prove a visitor's physical location or stop a modified browser from
calling a public analytics project directly.

The endpoint is `force-dynamic`, with `Cache-Control: private, no-store,
max-age=0`, `CDN-Cache-Control: no-store` and `Vercel-CDN-Cache-Control: no-store`.
The browser uses same-origin, non-cacheable fetch, rejects redirects and allows
five seconds before failing closed. No eligibility result is shared between
requests/users or persisted in browser storage. One in-memory decision is shared
across a document's interactions; a full document load checks again. A retained
document (including browser back/forward cache) retains its decision; changing
network/location mid-document is not continuously detected.

`initializePostHog()` now returns a shared promise. Until allowed, it never calls
`posthog.init`; capture and `before_send` also enforce the gate. Denial initializes
no PostHog instance. The GA4 loader likewise renders no scripts before allow.
Hydration, navigation and lead submission never wait for analytics. Marketing
visit/action callbacks wait in memory for the decision, preserve their original
source page/campaign, and then use the existing opt-out and deduplication rules.
No optional events or campaign storage writes occur before allow. Denied events
are discarded; existing campaign storage is cleared on the next tracking call.

Integration with the newer restaurant branch: retain this single eligibility
module and gated shared PostHog initializer/capture boundary; combine both
privacy filters in `before_send`. Keep Phase A/B restaurant context and property
contracts. Restaurant initial page tracking must wait for this initializer's
promise, just as the marketing bridge does, rather than losing early pageviews.
Do not create a separate restaurant region lookup or persistent decision.

### Validation before promotion

Unit fixtures inject server runtime/header inputs and mock the browser fetch/SDK;
Playwright intercepts the eligibility response locally. No test override exists
in application routes or production configuration.

1. Deploy the reviewed candidate to **Preview only** when authorized. Check
   `/api/analytics/eligibility` from actual US and non-US (EU/UK) network egress:
   expected allow/deny respectively. Check response cache headers and absence of
   `Age`/a cached `HIT` across alternating requests. No credentials are required.
2. From non-US egress, try `?country=US`, locale headers and forged
   `x-vercel-ip-country: US`/forwarded-IP headers. They must not turn denial into
   allow. Failure blocks promotion: investigate ingress rather than weakening
   the gate. Verify missing location is denied in unit/local fixtures.
3. In Chrome, confirm no PostHog or GA4 requests before eligibility resolves or
   when denied, errored, timed out or malformed. Check initial load, client
   navigation and both lead forms; mock lead delivery to avoid real mail.
4. On an allowed US Preview visit, check initial pageview once, CTA/form events,
   first-touch campaign across navigation and `environment=staging`. Check
   opt-out and privacy properties using the established staging workflow.
   Any live event test must use the designated staging project/test tags.

This task's localhost Chrome fixtures do not establish real Vercel ingress
spoof resistance, global CDN behavior or live PostHog ingestion. Those Preview
checks remain required before production approval. No Production settings change
is required; built-in Vercel server environment variables must be available.

## Suggested PostHog dashboard

Filter every production insight to `analytics_scope=marketing` AND
`environment=production`. Preview and Production currently share project entries
for the PostHog key/host; do not rely on separate projects to isolate their events.
For internal tests, use a campaign content code beginning `internal_qa_`, and
exclude `utm_content` containing `internal_qa_` while retaining unset values.
Do not exclude the legitimate `local_outreach` campaign itself. Use
`environment=staging` and `utm_content=internal_qa_20261016` for this staging QA.

1. Pageview trend and page breakdown using `$pageview` with custom `page`, rather
   than automatic URL properties that this layer intentionally removes.
2. CTA activation totals broken down by `cta_id`, `placement`, and `page`.
3. Separate inquiry and review funnels: `$pageview` → `marketing_form_opened` →
   `marketing_form_started` → `marketing_lead_accepted`, with consistent `form_type`
   on form events and an appropriate same-session conversion window.
4. Accepted leads by `utm_source`/`utm_campaign`/`utm_content` for card batches and
   outreach; keep direct/unattributed traffic visible.
5. Failed attempts by `failure_category` and `form_type`; email-fallback clicks
   alongside failures. Do not add fallback clicks to accepted-lead totals.

Use total event counts for leads and visitor/session funnels for engagement;
memory-only identity and browser opt-out can limit unique-user comparisons.
This implementation does not create dashboard objects remotely.

## Validation without sending events or email

```powershell
node --import=tsx --test src/lib/analytics/marketing.test.ts src/lib/marketing-leads/leads.test.ts src/lib/notifications/notifications.test.ts
node --import=tsx scripts/run-tests.ts
npx tsc --noEmit
npm run lint
```

If a local release worktree/dependencies exist under ignored `.vercel/`, use
`npm run lint -- --ignore-pattern '.vercel/**'` to exclude those operational
artifacts. This is the validation command used for this change; no ESLint
configuration change is needed.

Tests inject mocked capture/delivery responses and execute the SDK adapter against
a mock PostHog object; they do not initialize a real project. When manually checking
local UI, leave PostHog and email credentials unset. Use mocked accepted/failure
flows for success tracking; do not submit real leads or emit Production events as
part of automated validation. Any later staging/live analytics validation needs
an explicitly chosen test environment and separate deployment authorization.

## Implementation files and validation

Added:

- `src/app/MarketingAnalytics.tsx`: route observer and delegated marked clicks.
- `src/lib/analytics/marketing.ts`: pure contracts/helpers, lifecycle, attribution and SDK filter.
- `src/lib/analytics/marketing-client.ts`: existing SDK bridge and tab-session campaign storage.
- `src/lib/analytics/marketing.test.ts`: mocked analytics and submission regressions.
- `docs/marketing-analytics.md`: this event dictionary and operating guidance.

Updated:

- `src/lib/analytics/posthog.ts`, `types.ts`: scoped capture, opt-out check and event types.
- `src/app/layout.tsx`: mount the pathname observer.
- `src/app/MarketingComponents.tsx`, `MarketingInteractions.tsx`: stable CTA/email markers and review lifecycle.
- `src/app/MarketingLeadForm.tsx`, `src/lib/marketing-leads/client.ts`: opened/started events and safe confirmed outcomes, with retry deduplication.
- `src/app/page.tsx`, `services/page.tsx`, `work/page.tsx`: contextual CTA IDs/placements.
- `scripts/run-tests.ts`: include focused analytics regressions in the existing suite.

Validation completed: **25 focused tests**, **281 full regression tests**, TypeScript,
lint (excluding `.vercel` artifacts), diff checks, and optimized production build.
All four local marketing routes returned 200 with CTA metadata present, with
PostHog and email credentials disabled in the validation build/runtime. No real
analytics events, email, remote records or deployments were produced. Actual
browser SDK delivery in a chosen staging project remains a later manual check.
