# Restaurant analytics: Phases A.2-A.3

Browser restaurant events use the existing `trackEvent` -> PostHog adapter.
`before_send` runs the existing marketing filter and then the restaurant filter,
after SDK metadata is attached. Marketing events and settings are unchanged.
No server purchase delivery or commerce behavior is changed here.

## Outbound contract

Event names remain `page_view`, `category_selected`, `menu_search`,
`menu_item_expanded`, `menu_item_collapsed`, `phone_clicked`, `directions_clicked`,
`delivery_clicked`, `pickup_clicked`, `add_to_cart`, `remove_from_cart`,
`cart_viewed`, `checkout_started`, and `order_created`.

Every restaurant event retains `analytics_scope=restaurant`, `restaurant_id`,
and the trusted deployment `environment` from Phase A.1 (production, staging,
development, or unknown for missing/unrecognized configuration).

The event-specific schemas in `src/lib/analytics/restaurant.ts` allow:

| Events | Additional properties |
| --- | --- |
| Category selection | `section_id` |
| Search | `query_length`, `result_count`, `zero_results` |
| Item expansion/collapse | `section_id`, `item_id`, `price_cents` |
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

Phase B can add deep-linked item coverage, confirmed favorite events, and provider/action identity.
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
- This does not add item-view events for deep-link/history openings or favorite
  mutation events. Cart add/remove origins do not distinguish the originating
  synthetic section because those existing calls lack that context.
- Phone/directions default to current page, not exact header/footer placement.
  Pickup/delivery remain intent events without new provider identifiers.
- Optional GA4 delivery and server purchase outbox attribution are unchanged;
  the new bounded interaction context is applied in the PostHog adapter.

Later approved staging verification should walk all six routes with authorized
synthetic checkout fixtures, initial load, menu/location navigation, Back/Forward,
departure to marketing and return, query/fragment changes, and full-document cache
restoration where supported. Verify one event per view, correct tenant/type/surface,
no synthetic canonical section IDs, no URL/query/referrer/PII, retained GeoIP-disable
flag, and unchanged marketing events. Do not create real orders/payments merely
to test pageviews. Browser/ingestion verification has not been performed here.
