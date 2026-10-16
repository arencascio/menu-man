# Restaurant analytics: Phases A.2-B.1

Browser restaurant events use the existing `trackEvent` -> PostHog adapter.
`before_send` runs the existing marketing filter and then the restaurant filter,
after SDK metadata is attached. Marketing events and settings are unchanged.
No server purchase delivery or commerce behavior is changed here.

## Outbound contract

Event names remain `page_view`, `category_selected`, `menu_search`,
`menu_item_expanded`, `menu_item_collapsed`, `phone_clicked`, `directions_clicked`,
`delivery_clicked`, `pickup_clicked`, `add_to_cart`, `remove_from_cart`,
`cart_viewed`, `checkout_started`, `order_created`, and `menu_favorite_changed`.

Every restaurant event retains `analytics_scope=restaurant`, `restaurant_id`,
and the trusted deployment `environment` from Phase A.1 (production, staging,
development, or unknown for missing/unrecognized configuration).

The event-specific schemas in `src/lib/analytics/restaurant.ts` allow:

| Events | Additional properties |
| --- | --- |
| Category selection | `section_id` |
| Search | `query_length`, `result_count`, `zero_results` |
| Item expansion/collapse | `section_id` when canonical, `item_id`, `price_cents`, optional `detail_mode` |
| Successful favorite action | Canonical UUID `item_id`, boolean `liked` |
| Cart addition/removal | `item_id`, `price_cents`, `quantity`, `value_cents`, `currency` |
| Cart view / checkout start | `currency`, `value_cents`, `item_count`, `total_quantity`, `item_ids`, `items` |
| Order created | Cart-summary fields plus `order_id`, `order_number`, `tax_cents`, `tip_cents`, `pickup_mode`, `idempotency_replay` |

Nested `items` retain only `item_id`, `price_cents`, and `quantity`. Display names
are deliberately omitted; resolve labels from the restaurant catalog in reporting.
Identifiers accept 1-128 ASCII letters, digits, underscores or hyphens; counts and
cent values must be nonnegative safe integers; currency is three uppercase letters.
Arrays are capped at 1000 entries. Unknown keys are stripped; unknown event names
or malformed required/allowlisted values cause the restaurant event to be dropped.

`page_type` and `surface` accept fixed enums only, as detailed below. The four campaign keys reuse marketing's
bounded campaign-code sanitizer. This preserves safe codes if supplied at the SDK
boundary; it does not introduce restaurant campaign persistence or accept arbitrary
extra fields from ordinary `trackEvent` calls.

SDK metadata retained: project token, anonymous distinct/device/session/window IDs,
library/version, insert ID. IDs and versions are format/length validated. The final
filter retains/enforces `$process_person_profile=false` and adds
`$geoip_disable=true`. Customer/contact data, notes, payment tokens/card details,
raw search text, catalog display text, raw errors, URLs, referrers, person-property
objects, IP and GeoIP fields are excluded from the client event properties.
Retained order amounts/identifiers describe the existing order event, not card data.

## Search semantics

`menu_search` is a **debounced interaction**, not a deliberate submitted search.
After the existing 200 ms pause, a changed trimmed/lowercase nonempty query emits
one event. A pause while typing can therefore produce multiple interactions.
The same normalized state does not emit again when casing/whitespace changes or
menu highlight/favorite placements rerender. Clearing is not an event; clearing
and later entering a term again is a new interaction.

Result counts deduplicate matching IDs in ordinary canonical sections. Featured,
Popular, and Favorites sections are excluded; repeated canonical placements also
count once. Matching still uses the existing lowercase name/description substring
rule. `zero_results` is derived from `result_count === 0` by the adapter.

The UI's search filtering, displayed placement count, section navigation, item
order, debounce, and local query state are unchanged. Its displayed result count
can exceed the unique-item analytics count. No raw query is passed to analytics.

## GeoIP and IP handling

The installed SDK declares `ip: false` deprecated and ineffective. Do not add it.
The existing supported `before_send` hook applies `$geoip_disable=true` only to
restaurant events. This requests no server GeoIP enrichment while preserving
marketing behavior. It does **not** prevent PostHog receiving the network IP.
Removing `$ip` in the browser does not prevent ingestion from adding it again.

Sources:
- [PostHog capture specification](https://github.com/PostHog/sdk-specs/blob/main/openspec/specs/capture/spec.md)
- [GeoIP implementation](https://github.com/PostHog/posthog-plugin-geoip/blob/main/index.ts)
- [PostHog IP storage controls](https://posthog.com/docs/privacy/data-storage)
- Installed `node_modules/@posthog/types/src/posthog-config.ts`, deprecated `ip` option.

Manual project setup, requiring approval and not performed here:

1. In the intended PostHog project, open **Settings > Project > General > IP data
   capture configuration** and enable **Discard client IP data**. Confirm the
   selected project before saving. Production and Preview currently share a
   project, so this setting also affects marketing and other events in that project.
2. Discarding IP storage still permits transformations to use the IP before discard;
   keep the restaurant `$geoip_disable` flag. Do not claim zero network-IP receipt.
3. For a later approved staging verification, use synthetic data, inspect the final
   browser capture payload and the ingested PostHog event. Confirm scope/environment,
   `$geoip_disable=true`, no raw query or URL/referrer, no person objects, no stored
   `$ip`, and no `$geoip_*` enrichment. Inspect both search results and zero results.
   Allow asynchronous ingestion time and account for opt-out/blockers.
4. Check a marketing event separately: its existing context/privacy contract must
   remain intact. Do not send real orders or lead emails for this check.

No project settings, live events, deployments, database writes, or historical event
deletions were performed. Existing historical events are not sanitized retroactively.

## Remaining work

Phase B.2 can add provider/action identity, precise placements and reporting.
Demo classification, restaurant first-touch attribution, safe checkout failures,
owner reporting, and server purchase delivery remain separate tasks. Current browser
order creation remains a best-effort observation of an unpaid order, not a purchase.

## Phase A.3: page and surface attribution

Supported `page_type` values correspond exactly to existing routes:

| Page type | Route shape (never sent as a property) |
| --- | --- |
| home | `/r/[slug]` |
| menu | `/r/[slug]/menu` |
| location | `/r/[slug]/location` |
| checkout | `/r/[slug]/checkout` |
| payment | `/r/[slug]/order/[orderId]/payment` |
| confirmation | `/r/[slug]/order/[orderId]/confirmation` |

Server-rendered successful pages supply explicit identity, page type and expected
pathname to the existing null-rendering tracker. Redirects and error branches do
not emit pageviews. The payment details query variant shares `page_type=payment`;
its analytics-only identity read fails open for the details UI. No query values or
order path segments enter the event. A payment/confirmation view is engagement,
not a replacement for authoritative order or purchase events.

The root restaurant observer watches `usePathname` only to invalidate the previous
view when navigation leaves the restaurant too. The existing marketing observer
is unchanged. The shared tracker keeps only the current local pathname, last
restaurant, and last rendered page's tracking context in document memory. Strict Mode
effect replay, remounts/rerenders without navigation, query changes and fragment
changes do not create another pageview. Navigating away and returning, including
Back/Forward and another order's same-type page, counts a new visit. Persisted
`pageshow` restores from browser back/forward cache count one revisit; ordinary
`pageshow` does not. Full reload starts a new document and counts a new visit.
There are no pageview IDs, storage keys, cookies, or history mutations.

The PostHog adapter derives interaction `page_type` from the current pathname at
capture time and sends only an enum. Explicit pageview types come from the page
tracker. For interactions, `surface` defaults to the page type, with these rules:

- Search: `menu_search`.
- Pickup/delivery actions: `ordering_actions` (not a provider or placement claim).
- Cart viewed / checkout started: `cart`.
- Order created: `checkout`.
- Category/item events: `featured`, `popular`, or `favorites` for synthetic sections;
  otherwise `home` on the homepage or `menu`.

Other allowed surfaces remain `navigation` and `footer`, but this phase does not
wire their individual placements. Existing allowed cart/checkout/payment/location/
confirmation/home/menu surfaces remain bounded. Synthetic section IDs are omitted
from category/item payloads and represented by surface instead. The final schema
rejects synthetic IDs in `section_id`; canonical section IDs remain unchanged.

Limits and Phase B gaps:

- Fast transitions skipped before a successful page tracker commits are not views.
  Provider unavailability/opt-out can undercount; a failed capture is not retried by
  effect replay. Hot reload can reset module state during development.
- A same-path navigation/reload wholly managed without a new document or pathname
  transition is treated as the same view. Query-only payment details are not an
  additional page type. Persisted document restoration is handled separately.
- Phase B.1 adds deep-link/history openings and confirmed favorite events below.
  Phase B.2 adds known new-add origins and external action attribution below.
  Quantity/replacement/removal attribution remains deferred to Phase C.
- Optional GA4 delivery and server purchase outbox attribution are unchanged;
  the new bounded interaction context is applied in the PostHog adapter.

Later approved staging verification should walk all six routes with authorized
synthetic checkout fixtures, initial load, menu/location navigation, Back/Forward,
departure to marketing and return, query/fragment changes, and full-document cache
restoration where supported. Verify one event per view, correct tenant/type/surface,
no synthetic canonical section IDs, no URL/query/referrer/PII, retained GeoIP-disable
flag, and unchanged marketing events. Do not create real orders/payments merely
to test pageviews. Browser/ingestion verification has not been performed here.

## Phase B.1: menu engagement

Classification: shared System Piece instrumentation using the existing adapter.
No section composition, item identity/order, scrolling, URL/history behavior,
heart requests/rate limits/persistence, or cart/payment business logic changes.

Item opening/collapse events now come from one observer of the committed detail
state, including closing state. Card, direct-link, popstate, quick-add, and cart-edit
entry paths feed it. Effect replay and selected-detail/section rerenders do not
duplicate the same active item's opening. Closing and reopening counts again;
switching items closes the old observation and opens the new one. Back-to-menu,
Escape, backdrop/close button and successful add closure share the same observer.
Unmount/abandonment is not treated as a reliable collapse signal, avoiding false
closes during React effect replay.

`detail_mode` is `full` or `quick`, describing **initial entry mode**. Promoting an
already-open quick panel to full customization does not count a second opening;
the matching collapsed event retains its initial mode and origin. This is an
item-opening metric, not a count of every panel-mode transition.

Item event `surface` precedence:

- Card from a synthetic section: `featured`, `popular`, or `favorites`, without a
  canonical `section_id`. A real category named Favorites still has its UUID.
- Ordinary card while searching: `menu_search`; otherwise `menu`.
- Initial `?item` link: `direct_link`. Browser history opening: `history`.
  These use the canonical section from ordinary sections for analytics even if the
  UI first resolves that item in a synthetic placement. This prevents attributing
  an inbound link to a Featured click that never happened.
- Cart edit: `cart`, with a canonical section ID where available.

No raw item query, URL, catalog text, or arbitrary origin is sent. Final schemas
allow only those surface enums and the two detail modes. Restaurant/environment/
page context, marketing privacy, no-profile flag and GeoIP-disable flag remain.

`menu_favorite_changed` is emitted only after the existing successful HTTP response
and JSON parse, and only when the body has the matching UUID `itemId`, requested
boolean `liked`, and a valid nonnegative integer count. Rejected, rate-limited,
network-failed, malformed or mismatched responses emit no successful event.
The existing 428 visitor-refresh retry can emit once after its final success.
Analytics failures cannot trigger UI rollback. No heart visitor cookie/key, source
hash, aggregate count or new identity is included in this event. Existing anonymous
PostHog SDK identity metadata remains under the existing privacy contract.
The metric counts confirmed successful requested actions, not a guaranteed change
in global totals: idempotent server operations and other tabs can affect totals.

Category investigation: the actual handler extracted from MenuBrowser emits all
three rapid activations in mocked execution, including same-category repeats,
search clearing and section-list navigation. Final schemas accept them. No category
deduplication or deliberate meaningful-change suppression exists. There is no
confirmed application defect to repair from the A.4 observation. That observation
lacked a network trace; browser dispatch timing, asynchronous ingestion, or delivery
loss remain unproven possibilities. No timers, delays, or navigation changes were
added. A separate approved staging reproduction should observe each action and
capture outgoing request/ingestion evidence before changing delivery behavior.

Validation is mocked/offline for this phase. Later staging verification is needed
for these new item/favorite events; no deployment, live events, real heart mutation,
or database writes were performed. Phase B.2 extends action attribution below;
owner reporting and authoritative server purchase delivery remain separate work.

## Phase B.2: external actions and ordering attribution

Shared System Piece instrumentation; no ordering configuration, navigation
destinations, cart reducer, checkout, payment, or restaurant content changes.
Existing names, tenant/environment/page context and final privacy filtering remain.

| Event | Additional bounded properties | Existing controls covered |
| --- | --- | --- |
| `delivery_clicked` | `provider_id`: configured provider-row UUID; `surface=delivery_chooser`; `placement`: initiating action surface | Chooser provider departure, opened from hero, ordering actions, featured gallery, header or footer |
| `pickup_clicked` | `pickup_action=internal_selection\|external_departure`; `surface` | Hero/ordering external pickup links, featured-gallery internal item/pickup links, successful pickup-chooser confirmation |
| `phone_clicked`, `directions_clicked` | `surface` | Header, restaurant information on home/location pages, footer |
| `add_to_cart` | Existing menu interaction `surface` when known | Ordinary/search/synthetic card additions and detail additions retaining their opening origin |

Action surfaces are exactly `hero`, `header`, `footer`, `restaurant_information`,
`ordering_actions`, `featured_gallery`, `delivery_chooser`, `pickup_chooser`.
Page type distinguishes restaurant information on home versus location pages.
No new phone/directions control was added to the hero. Delivery chooser rendering
and opening do not count as delivery clicks. Each actual provider activation
emits once; repeated deliberate activations are separate actions. The initiating
placement is refreshed on each chooser opening, including mobile header handoff.
Provider IDs come from the existing restaurant-scoped active-provider query, never
branding keys, names or destinations. Missing IDs retain an unattributed action
for compatibility; malformed supplied IDs cause only that analytics event to be
dropped. A direct delivery link without a configured provider likewise remains
unattributed. No destination URL, phone, address or arbitrary provider data is sent.

Pickup classification describes the action, not an order: explicitly configured
external links are departures; internal gallery selection and the chooser's
existing confirmed-success close are internal selection. Selecting an item and
later confirming pickup are distinct actions, not duplicate order conversions.
Cancelled/failed chooser interactions do not emit confirmation events.

Only new cart additions receive known source context. Editing/replacing lines,
quantity changes, removals and cart clearing retain existing semantics and page
fallbacks. `cart_viewed`/`checkout_started` retain `surface=cart`; no inferred
historical cart origin, new persistent metadata or confirmed-state claim is added.
Favorites/search/Featured/Popular origins remain surfaces, not section IDs.

The four action events use SDK `capture(..., { send_instantly: true })` to bypass
the in-memory batching interval without awaiting delivery or delaying navigation.
The installed `@posthog/types/src/capture.ts` documents normal active-page fetch
keepalive/retries and SDK unload-beacon handling. No forced transport, custom
flush, timeout, navigation blocking or delivery guarantee is added. Oversize/XHR
requests, offline use, browser termination, privacy blockers and ingestion failures
can still lose events; beacons do not prove ingestion. Other restaurant events and
marketing delivery/privacy behavior are unchanged. `$geoip_disable=true` and
profile/autocapture/recording restrictions remain enforced.

Validation uses mocked SDK responses and local regression tests only. After an
approved staging deployment, inspect received events and network requests for
each available provider/source, internal versus external pickup, contact actions,
and card/detail additions; check one capture per activation, correct scoped UUIDs,
bounded source/classification, GeoIP-disable and absence of destinations/PII.
Exercise mobile header-to-chooser handoff and immediate external departure without
delays; verify marketing events separately. Super Tacos has ordering/providers
disabled, so those cases require an already configured authorized staging tenant;
do not enable ordering or create orders merely to test attribution. This phase
does not verify actual ingestion or authoritative order/payment conversion.
