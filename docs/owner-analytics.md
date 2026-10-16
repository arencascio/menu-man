# Owner analytics MVP — Phase D.1

Implemented shared System Piece: `/manage/[slug]/analytics`. This is a server-rendered,
read-only dashboard using the existing management membership/authentication and
PostHog event contract. No visitor persistence or consent changes are included.
Product policy: Menu Man will not display cookie-consent popups. This MVP adds
no banner or durable visitor tracking; regional permissions and privacy controls
are separate work and do not block this event-count dashboard.

## Access and isolation

- `loadOwnerAnalytics` is the only reporting entry point and is `server-only`.
  It accepts a slug and range, never an authorized restaurant ID from a caller.
- Each request calls the existing authenticated `listRestaurantMemberships` RPC.
  That RPC filters by `auth.uid()`, active membership and active restaurant.
  The matching membership must explicitly have `memberRole=owner`; order,
  settings and team capabilities do not grant analytics access to other roles.
- Queries use the restaurant UUID from that membership. Membership is re-read
  before any reporting result is released; revocation, role changes, loss of
  access or changed membership/restaurant identity prevent returning the report.
- Management navigation shows Analytics only to owners. Hiding the link is not
  the authorization boundary; direct page requests go through the same server
  checks. Unauthenticated requests redirect to login; denied requests to /manage.
- No raw events, anonymous visitor IDs, queries or private credentials are sent
  to owners. The server selects aggregate counts and canonical item UUIDs only.
  Item names are read separately using the authenticated Supabase client with
  the authorized restaurant_id filter and the validated top-item UUIDs. Deleted,
  historical or unreadable catalog items retain an aggregate with an ID suffix
  label. Restaurant data is never changed.
- Reports are dynamic and unshared: existing `/manage/*` private/no-store headers,
  force-dynamic/revalidate=0, no React/global report cache, and no-store fetch.
  Authorization is rechecked on every server request. Revocation cannot erase
  HTML/data already delivered to a browser; this MVP has no live revocation poll.

## Server configuration

| Variable | Purpose |
| --- | --- |
| `POSTHOG_PERSONAL_API_KEY` | Private PostHog API key with `query:read`, restricted to the intended project. Server only; never use NEXT_PUBLIC or the public capture token. |
| `POSTHOG_PROJECT_ID` | Numeric project ID containing the restaurant events. |
| `POSTHOG_QUERY_HOST` | Optional; defaults to `https://us.posthog.com`. Only that host and `https://eu.posthog.com` are accepted. Use the private app/API host, not the `*.i.posthog.com` capture host. |

No variables were read out, created or changed during implementation. Actual
private-query credential availability and live query execution remain unverified.
Configure them privately in the intended environment before a read-only staging
smoke test; no account-setting change is required by the application code.

Environment is derived server-side: VERCEL_ENV production → production, preview
→ staging, development → development. An unknown Vercel value is unavailable,
even if another variable suggests staging. Outside Vercel, explicit
MENU_MAN_ENV=staging or NODE_ENV=development is supported. Missing/unrecognized
configuration never defaults to production. Client query parameters cannot
choose environment, project, host, SQL or restaurant ID.

Two parallel POST requests execute read-only HogQLQuery aggregates through
`/api/projects/{project}/query/`, with forced blocking refresh and a 12-second
timeout per request. Redirects are refused so authorization headers cannot be
redirected to another host. The queries are bounded to at most 90 daily rows and
10 ranked items. All interpolated literals are validated UUIDs, closed environment
enums or server-generated ISO timestamps; no slug or arbitrary client text enters
SQL. Incomplete, paginated, invalid, negative, inconsistent or failed responses
become unavailable, without logging provider response bodies or secrets.

Provider requirements: a project with query access and events using the Phase A/B
scope/environment/property contract. API quotas and project retention can limit
reporting; each dashboard update makes two query calls. The MVP intentionally has
no shared report cache or automatic refresh loop.

References: [PostHog SQL Query API](https://posthog.com/docs/sql),
[private API authentication and rate limits](https://posthog.com/docs/api).

## Metrics and dates

The ranges are exactly 7, 30 or 90 UTC calendar dates, including today. Default
is 30; repeated, malformed or unsupported range values show an invalid-range
message and do not query PostHog. The lower bound is midnight UTC N−1 dates ago;
the exclusive upper bound is server request time truncated to seconds. Daily
grouping uses UTC explicitly, independent of restaurant and PostHog project
timezones. Today is partial and its cutoff is shown. At UTC midnight the newly
started date can contain zero observations. These are not rolling N×24-hour or
restaurant-local-day comparisons.

Both queries require restaurant_id, analytics_scope=restaurant, environment and
the same timestamp interval. Marketing `$pageview` is never counted. Explicit
`utm_content` values beginning `internal_qa_` are excluded, following the existing
internal QA campaign convention. Restaurant events do not otherwise carry a
reliable demo/internal flag: untagged QA traffic cannot be removed accurately.
Staging demo activity remains visible in its own authorized tenant/environment;
it never joins another restaurant's production report. Filtering event properties
is a data-quality operation, not an authorization mechanism. Public browser
events can be spoofed and must never be used as financial records.

| Display | Aggregate / meaning |
| --- | --- |
| Restaurant pageviews + daily trend | count of `page_view` across supported restaurant pages; includes reloads and legitimate revisits under the existing pageview contract. |
| Menu pageviews | `page_view` with `page_type=menu`. |
| Item openings | `menu_item_expanded`, including quick and full initial openings. A later reopening counts again. |
| Most-opened items | Top 10 valid canonical item UUIDs by opening count; ties sort by UUID. Placement/synthetic section IDs do not split canonical items. This is engagement, not units sold. |
| Search interactions | `menu_search`, meaning debounced meaningful search state, not a deliberate submitted search. |
| Zero-result count/rate | `menu_search` with boolean zero_results=true; count divided by all recorded search interactions. With no searches, rate is unavailable, not 0%. |
| Delivery-provider clicks | `delivery_clicked` activations, not chooser openings or confirmed external orders. |
| Pickup actions | `pickup_clicked` counts, with internal_selection, external_departure and unclassified subtotals. These are intent actions, not orders. |
| Telephone/directions clicks | `phone_clicked` / `directions_clicked`; neither proves a completed call or restaurant visit. |

The SVG daily trend has a semantic label and an expandable exact daily table.
Cards collapse to one column on mobile; navigation wraps; the daily table can
scroll within its container. Labels and catalog text are escaped by React.

Successful empty query results alone may produce zero counts and a clear
no-recorded-activity state. Missing configuration, provider failure, invalid
responses or unknown environment display unavailable and no metric cards.
Absence of received events does not prove absence of visitors. Instrumentation
rollout dates, retention, ingestion delay, blocked/opted-out capture and delivery
loss can produce partial coverage, including inside the 90-day range.

## Visitor-continuity integration point

Unique visitors/browsers, returning visitors, retention and cross-session funnels
are intentionally not calculated from document-lifetime SDK distinct IDs.
The dashboard explains their unavailability. No new analytics events or SDK
identity properties were introduced.

After the separate D.0 permission/identity contract is approved, add eligible
browser/visit aggregates alongside the existing reporting query contracts and
tests, with an explicit rollout cutoff and fallback-coverage definitions. Do not
reinterpret historical memory-only IDs as durable visitors or alter existing
pageview/action meanings. See [the D.0 assessment](restaurant-visitor-continuity.md).

## Validation and staging follow-up

- 11 focused tests cover date validation/UTC boundaries, environment separation,
  mandatory query filters, aggregation, owner-only access, cross-tenant denial,
  revocation during reporting, server credentials, scoped catalog reads,
  incomplete/error/empty states, escaped/accessible responsive markup, navigation
  visibility, owner entry routing and actual page login/denial redirects.
- Full regression suite: 318 tests passed. TypeScript, lint (excluding ignored
  .vercel artifacts), diff checks and production build passed.
- Local built-route smoke test: unauthenticated Super Tacos and another slug both
  returned 307 to the matching login next URL, private/no-store and noindex headers;
  a client-supplied restaurantId did not alter the destination or expose data.
- Chrome is unavailable in the connected browser tooling. Mobile/desktop visual
  browser QA remains pending; responsive rendering/CSS contracts passed automated
  tests. No other browser was substituted against repository instructions.
- Before deployment approval, configure the private query key/project on staging,
  sign in using an existing authorized owner, compare 7/30/90-day totals with the
  same PostHog filters, and verify 320px/412px/1440px presentation in Chrome.
  Check a non-owner and a revoked membership using existing approved accounts;
  no account or fixture writes are needed for the normal owner smoke test.
- No live PostHog queries/events, deployments, Supabase mutations, migrations,
  restaurant presentation changes or commerce changes were made during this task.
