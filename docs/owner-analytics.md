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
  Item names are read separately using the platform's existing server-only
  service-role catalog client, only after owner authorization, with the authorized restaurant_id filter
  and at most ten validated top-item UUIDs. Returned IDs and restaurant ownership
  are checked again before assigning labels. The client loads lazily so unavailable
  catalog configuration cannot prevent a report. No database permissions change.
  Retained same-tenant items can still be named when unpublished; no published-menu
  join is required for historical reporting. Deleted, invalid or unreadable items
  retain their ranking/count with the neutral label "Unavailable menu item";
  neither a UUID nor its suffix appears in that fallback. Restaurant data is never
  changed. The existing final membership recheck also protects enriched reports.
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

## Confirmed orders and captured amounts — D.3

The dashboard now includes a separate **Orders & captured sales** System Piece.
It reads existing `payments`, `refunds`, `orders`, and
`restaurant_payment_connections` using the existing server-only Supabase reader,
after the same owner membership authorization and before the final membership
recheck. There are no new permissions, RPCs, migrations, writes or PostHog financial
queries. No payment, attempt, refund, customer or provider records reach the browser;
only aggregate counts and amounts do. Financial availability is independent of
PostHog availability. Existing dynamic/private/no-store management behavior applies.

The shared 7/30/90 UTC calendar-date interval uses the same inclusive lower bound
and exclusive request-time upper bound as engagement reports; today is partial.

| Metric | Authoritative definition |
| --- | --- |
| Paid orders | Count of unique `payments` with `captured_cents > 0` and persisted `succeeded_at` inside the interval. The schema permits one payment summary per order. Includes later refunds/cancellations. Zero-value/free orders are not paid captures. |
| Completed paid orders | Subset of that capture cohort whose order is **currently** `completed`; not orders completed during the interval. There is no historical completion-date metric here. |
| Cancelled paid orders | Subset of that capture cohort whose order is **currently** `cancelled`. Captured money remains captured until a successful refund. Unpaid cancellations are not in this cohort. |
| Gross captured sales | Sum of `payments.captured_cents` by `succeeded_at`, separately per currency. Includes tax/tips; not pretax revenue, profit, fees or bank settlement. |
| Successful refunds | Sum of distinct `refunds.amount_cents` where `status=succeeded` and `completed_at` is inside the interval. Partial refunds are separate records; refunds of captures before the interval are included. Pending/failed/cancelled refunds are excluded. |
| Net captured sales | Gross captures less successful refunds **in the interval**, per currency. May be negative when older sales are refunded. Not the lifetime net of the capture cohort. |

Amounts use the application's existing integer-cent representation, not browser
events or order totals. Captures are counted from payment summaries, never payment
attempts, webhook callbacks or `order_created`. Callback replay does not create
additional payment/refund identities; the existing payment/refund application path
preserves `succeeded_at`/`completed_at` with `coalesce`. Do not sum cumulative
`payments.refunded_cents` for period refunds. The current schema records the single
full capture per payment, not a general incremental-capture ledger. Unsupported
chargebacks, disputes, fees, settlement and arbitrary accounting revenue are omitted.

Every read is scoped to the authorized membership restaurant, including embedded
connection ownership. Returned restaurant/order/payment identities and currencies
are validated again. Production accepts only production provider connections;
staging/development accept test and sandbox connections and prominently label
amounts **test money only**. This uses provider environment, not browser event
properties. There is no separate reliable internal/test-order flag within production
connections; a real production capture counts even if someone intended it as a test.

Reads paginate in 500-row pages with exact counts and a stable primary-key order.
All financial reads share a 12-second timeout budget.
At most 10,000 captures and 10,000 completed refunds per report are supported.
Missing counts, truncation, changing page counts, duplicate IDs, invalid joins or
amounts, query/credential failures, or any positive capture/successful refund with
an unassignable null transaction timestamp in the same restaurant/environment make
financial reporting unavailable. They never become zero or partial totals. Successful
empty queries show zero paid counts and an explicit no-transactions message, without
inventing a currency. Currencies are never added together.

These are current authoritative application records, not an atomic financial ledger
snapshot or a statement reconciled with the provider. Multiple read requests may see
concurrent updates. Late webhook processing can change a historical interval; current
fulfillment classifications can also change. Refresh after operational activity settles
when comparing totals. No new financial records or real test orders are needed for QA.

Staging follow-up (requires a separately authorized deployment): sign in manually
with an existing owner in temporary Playwright Chrome. Compare 7/30/90-day counts
and per-currency sums to read-only staging queries on these same timestamps,
restaurant and provider environments. Use existing captures/refunds, including
partial refunds and cancellations if available; mark absent cases test-only. Check
anonymous/non-owner/cross-tenant denial and unavailable reporting without changing
memberships, records, permissions or provider settings. Recheck 320/412/1440 layouts.

Local D.3 validation: 23 focused reporting tests and 330 full regressions pass,
including financial/payment/cancellation contracts. TypeScript, lint on changed
code and production build pass. Playwright Google Chrome 155 component rendering
on localhost passed populated/empty/unavailable states at 320/412/1440, including
large amounts, separate currencies and negative net. Screenshots are ignored under
`.playwright/d3-dashboard/`. This uses sample aggregates and the real component/CSS;
authenticated full-route/live database verification remains a staging follow-up.
Repository-wide lint also completes with two existing warnings in the ignored
`.playwright/trace-dashboard-400.mjs` diagnostic. Unrelated local project-state
edits have pre-existing trailing whitespace; the D.3 diff itself is clean.

## D.2.2 tracked-browser audience metrics

The dashboard now adds one aggregate-only PostHog query. It filters to the
authorized restaurant, trusted environment, `analytics_scope=restaurant`,
`page_view`, `identity_version=1`, `identity_mode=persistent`, valid UUID
`distinct_id` and `$session_id`, and matching `$device_id`. Legacy and ephemeral
events remain in ordinary pageview totals but never in audience counts. The
query returns four numbers only; neither browser IDs nor raw events reach the
owner response. It uses the same private, no-store Query API request and final
owner-membership recheck as the other reports.

For each selected 7/30/90-day UTC window, unique browsers are distinct eligible
IDs with a received pageview; visits are distinct visit IDs with a pageview;
returning browsers have a different, earlier recorded pageview visit within the
bounded 90-day historical lookback. Repeated pageviews in one visit do not create
a return. Observed return rate is returning browsers divided by unique browsers;
it is unavailable when that denominator is zero. Today retains the existing
partial-day cutoff. Coverage is shown as persistent-identity pageviews out of all
recorded restaurant pageviews, rather than claiming all visitors are counted.

The history query spans at most 180 UTC days for a 90-day report and groups on
the provider side, returning a single aggregate row. It adds one query request
per dashboard load; the existing 12-second timeout applies. An incomplete or
failed audience query shows an unavailable audience section while valid
engagement and financial reports remain available. A valid empty aggregate
shows zero browsers and visits. Returning counts/rates are observed lower bounds:
events from before rollout, outside the 90-day lookback, blocked delivery, or
prior to identity rotation cannot establish an earlier visit. A rotated or
cleared browser ID can be counted as a new browser; these are not people or
cross-device retention metrics. No visitor-tracking behavior changed here.

Before staging release, compare all ranges to independent PostHog queries using
these exact filters and inspect an authorized owner dashboard at mobile/desktop
widths. See [visitor-continuity semantics](restaurant-visitor-continuity.md).

## Validation and staging follow-up

- 15 focused tests cover date validation/UTC boundaries, environment separation,
  mandatory query filters, aggregation, owner-only access, cross-tenant denial,
  revocation during reporting, server credentials, scoped catalog reads,
  incomplete/error/empty states, escaped/accessible responsive markup, navigation
  visibility, owner entry routing and actual page login/denial redirects.
- Full regression suite: 322 tests passed. TypeScript, lint (excluding ignored
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
