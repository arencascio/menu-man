# Restaurant visitor continuity — D.2.1 implementation

Status: **implemented locally, not deployed or verified in live PostHog**.
The D.0 assessment below records the original blocker and proposed design; its
"not implemented" statements describe that earlier state.

For a trusted U.S.-eligible request, restaurant events now receive a cryptographically
random `distinct_id` and matching `$device_id` scoped to `(environment,
restaurant_id)`. `$session_id` is a separate random visit ID; the shared SDK's
`$window_id`, `$insert_id`, person fields and other shared identity metadata are
removed at the final synchronous `before_send` boundary. The installed SDK's
actual intercepted Chrome request bodies were checked after this hook. Marketing
events continue using their existing memory-only SDK identity. Restaurant events
carry `identity_version=1` and `identity_mode=persistent|ephemeral`.

Version 1 is stored in first-party `localStorage` only after eligibility and the
SDK opt-out check pass. It has a fixed 90-day lifetime from creation; activity
does not extend expiry. A new visit ID starts after at least 30 minutes without
an eligible event. Web Locks serialize first creation, visit rollover and
withdrawal across tabs. Without usable storage or Web Locks, an in-document,
tenant-scoped ephemeral ID is used and labeled as such. Without secure random
UUID generation, restaurant capture is dropped. Unknown deployment environment
or denied/failed regional eligibility creates no restaurant identity.

An eligible visitor can turn off restaurant analytics in the restaurant footer.
Withdrawal suppresses further restaurant capture for that tenant, clears its
stored identity and persists a tenant-specific opt-out marker when storage works.
The visitor can turn it on again; that starts a fresh identity. If storage fails
during withdrawal, capture remains off in the current document and the control
states that the choice is session-only. Global PostHog opt-out also suppresses
capture; neither choice affects marketing identity or another restaurant.

Owner reporting must filter to `identity_version=1` and
`identity_mode=persistent` before presenting unique or returning browser counts.
It must use distinct visit IDs, not repeated pageviews, for returning status.
The existing owner dashboard is unchanged. Same-origin localStorage is accessible
to other same-origin scripts, and event ingestion still exposes network IP to
PostHog under the existing project settings. Client expiry/withdrawal does not
erase already-ingested events. The legacy optional GA4 restaurant path has its
own client identity and is **not** a source for D.2.1 visitor metrics; its
configuration should be reviewed before any claim of cross-provider identity
isolation. Full browser QA and live ingestion remain staging follow-ups.

## Historical D.0 assessment

Status: **blocked pending an analytics-storage permission mechanism/policy**.
No runtime identity or persistence changes were made. The design below is a
proposal, not functionality that is currently implemented or tested.

## Findings and blocker

- `src/instrumentation-client.ts` initializes one shared PostHog instance.
  `src/lib/analytics/posthog.ts` deliberately uses `persistence: "memory"`.
  Marketing and restaurant events share that instance and project configuration.
- Anonymous SDK identity survives client navigation in the current document;
  full document loads create new identities. No application `identify`, `alias`,
  stable identity bootstrap or persistent analytics identity manager was found.
- Restaurant attribution is bounded by `restaurant_id` and environment. That
  provides event/report scope, not identity isolation: the SDK's distinct/device/
  session/window identifiers can currently be shared across tenants visited in
  the same document, and with marketing events in that document.
- Marketing explicitly checks SDK opt-out state before capturing; restaurant
  capture relies on the SDK's own consent enforcement. Existing SDK consent
  storage is separate from analytics persistence. Memory-only analytics does not
  imply that the SDK cannot store an existing opt-out preference.
- No application analytics consent/preferences UI, explicit storage grant,
  withdrawal integration or documented permission rule was found. The installed
  SDK defaults to capture enabled, not persistence permission obtained. Its
  `opt_out_capturing_by_default` and `respect_dnt` defaults are false; this app
  does not override them. GPC handling is not implemented in the inspected app.
- Existing cart and favorite persistence is functional state and must not be
  reused as permission, identity or evidence of consent for analytics.

The missing prerequisite is a way for the restaurant adapter to establish when
analytics storage is permitted, including withdrawal and already-open tabs. An
SDK result of “not opted out” alone does not establish an affirmative storage
grant in contexts requiring one. This is an implementation/policy gap, not a
claim that every deployment or visitor necessarily requires the same consent
model. No blanket jurisdictional exemption is inferred from the restaurant's
address or the application's hosting location.

The user's guardrail directs us not to force persistent storage when the needed
consent mechanism is absent. Accordingly, no dormant identity system, new banner,
global SDK persistence change or new default storage permission was introduced.

## Smallest safe follow-up design

1. Establish a restaurant-only storage permission contract: unknown/denied/granted,
   with a visitor-accessible choice and withdrawal where consent is required, or
   an explicitly documented applicable permission rule. Unknown must not permit
   persistent analytics storage. Existing SDK capture opt-out must always win.
   Specify whether denial also disables capture or preserves the existing allowed
   memory-only behavior. Do not silently change marketing's consent or identity.
2. Keep the existing SDK instance, memory configuration and restaurant adapter.
   Add one small restaurant identity helper after the permission contract exists.
   Use independent cryptographically random IDs for each canonical restaurant ID
   and trusted environment. Never derive IDs from a common browser/device seed,
   fingerprints, cart/favorite IDs, customer fields, URL parameters or identifiers
   supplied as ordinary event properties.
3. Persist a versioned, strictly validated record in first-party `localStorage`,
   keyed by environment and restaurant ID under the current origin. Store only
   random anonymous identity, fixed expiration and the minimal visit/activity
   state needed below. Use a **fixed 90-day lifetime** from creation, without
   extending it on each event. Rotate on expiry, invalid data or withdrawal.
   Expiration must be checked before every reuse, including in long-lived tabs.
   localStorage has no native TTL: stale data is deleted lazily on later access,
   not guaranteed physically removed at day 90 from an unopened browser.
4. In the existing final `before_send` boundary, validate the event first, then
   supply restaurant-owned `distinct_id` and `$device_id`. Replace `$session_id`
   with the restaurant visit ID and replace or omit `$window_id` using only a
   restaurant-specific document ID. Overriding distinct_id alone would still leak
   the shared SDK device/session/window correlation keys. Do not mutate global
   SDK identity, call `identify`/`alias`, create person profiles or forward any
   original shared identity fields on restaurant events. Marketing must pass
   through its existing independent sanitization and identity behavior unchanged.
   Fail closed for restaurant events if this final identity boundary fails.
5. Re-read scoped storage before events so tabs converge; invalidate caches on
   expiry, revocation and storage notifications. Read/write failures use separate
   restaurant-scoped in-memory fallback IDs without blocking the UI or generating
   a new ID per event. Opt-out suppresses capture and makes a best-effort removal
   of stored restaurant analytics state; it must never resurrect a cached ID.
   Add a bounded `identity_mode=persistent|ephemeral` property so owner metrics can
   exclude known fallback identities. No other payload expansion is needed.
6. Verify all of this using mocked SDK enrichment before considering deployment.
   Reuse the current event names, schemas, capture path and pageview observer.
   Cross-tab first-creation/visit-rollover races need explicit tests: localStorage
   is not an atomic compare-and-set store. Do not promise exact cross-tab counts
   without a tested coordination strategy, and do not block navigation for it.

This is feasible as a bounded extension at the existing outbound adapter; it is
not a recommendation for a second SDK, one SDK instance per tenant, a new event
pipeline or a global switch to SDK localStorage/cookie persistence. Final SDK
identity replacement needs regression coverage before being called implemented.

## Proposed reporting semantics

These definitions apply **after** the above design is implemented. They cannot
be accurately produced from the present memory-only identity history.

| Metric | Exact proposed definition |
| --- | --- |
| Unique anonymous browsers | Distinct persistent restaurant-scoped anonymous IDs with at least one received `page_view` in the reporting interval, filtered to the authorized restaurant and environment. Count the browser storage identity, not people, devices or households. |
| Returning browsers | Those eligible browser IDs with a visit overlapping the reporting interval and a different recorded visit that began earlier within the retained identity/history horizon. A second pageview/reload inside the same visit does not make a returning browser. For a returning rate among website visitors, intersect this set with the unique-pageview browser set above. |
| Sessions/visits | A restaurant-scoped group of received events sharing a visit ID. Start at the first eligible event; start another after **30 minutes or more** without eligible activity. Reuse across reloads/tabs while active. Tenant/environment changes use different visit state. Count distinct visit IDs, including action-only resumed visits; do not claim these are tab openings or physical visits to the restaurant. |
| Pageviews | Received existing `page_view` events: supported restaurant page entry, actual client transitions/revisits and full reloads. Preserve current replay/render/query/fragment deduplication. Item opening, a search and a fragment change are not pageviews. |

Returning status should come from distinct visit history, not a boolean based on
whether a localStorage key already existed, and not a comparison against the
selected report's start date alone. If earlier retained history is unavailable,
returning status is unknown or a lower bound, not proven “new.” Establish the
history lookback and retention explicitly in the later reporting query.

## Counting and privacy limitations

- Browser restart/return continuity would hold only where the same origin/profile
  retains permitted storage and the record has not expired. Different browsers,
  profiles, devices, private windows and cleared/evicted storage create separate
  IDs. Shared browsers can undercount people; expiration/clearing can overcount
  browsers over longer intervals. These are not authenticated customer counts.
- Preview aliases, immutable deployment hosts and future custom domains have
  different origins and do not share localStorage. Do not join them by IP,
  fingerprint or a common seed. Separate environments must remain separate even
  when served on one origin. Unknown deployment classification must not obtain
  production identity or durable continuity by assumption.
- Without storage access or permission, ephemeral fallback cannot support reload,
  cross-tab or returning-browser continuity. Report that coverage separately;
  excluding it makes persistent-browser metrics a measurable subset, not a full
  count of all visitors.
- Simultaneous first visits/visit rollover in tabs, clock changes and interrupted
  writes can split identities/visits unless coordination is established. Treat
  malformed/future timestamps and unavailable crypto safely. No fingerprint
  fallback is acceptable.
- Consent changes/withdrawal, blockers, network loss and SDK suppression reduce
  observed counts. Do not retroactively merge pre-permission events into a new
  durable identity or retroactively classify old memory-only data as unique
  browsers. Use a documented rollout boundary for reporting.
- Ninety-day identity rotation bounds client reuse, not PostHog event retention.
  Existing event history is not deleted automatically by client rotation or
  withdrawal. Privacy notices/retention must distinguish these operations.
- Random durable IDs are pseudonymous tracking identifiers, not proof of absolute
  anonymity. Other scripts running on the same origin can access localStorage;
  tenant namespacing is logical isolation, not an origin security boundary.
  Owner reporting must still enforce restaurant authorization server-side.
- `$geoip_disable=true` suppresses restaurant GeoIP enrichment, not network-IP
  receipt. B.3 confirmed IP retention in the shared project. Tenant-specific IDs
  alone cannot prevent platform operators from correlating network metadata.
  No PostHog settings are changed by this task.

## Acceptance tests for the implementation follow-up

Use injected clocks, crypto and storage plus the existing mocked SDK/filter path:

- Same tenant ID across client transitions, fresh document instances, reloads,
  restarts simulated by new helper instances, and later visits within 90 days.
- Two tabs reuse a record; simultaneous empty-store creation and 30-minute
  rollover races have explicit tested behavior. Tenant A → B → A retains A's
  identity while B, marketing and other environments receive no A identifiers.
- Fixed expiry, 90-day rotation, idle boundary, active visits across tabs, invalid
  records, clock anomalies and visit return definitions are tested independently.
- Unknown/denied permission performs no identity-storage read/write; granted
  permission may persist; SDK opt-out wins; withdrawal affects open tabs and
  clears state without cached resurrection or retroactive linkage.
- Unavailable/throwing/quota-limited storage and unavailable crypto never block
  interactions and never send SDK shared identity keys as a fallback. Clearly
  distinguish ephemeral coverage from persistent-browser reporting eligibility.
- Final SDK enrichment cannot reintroduce shared distinct/device/session/window
  IDs. Existing allowlists, `$geoip_disable`, no-profile settings, names and
  pageview deduplication remain; marketing payload/identity/campaign tests pass.

No new continuity tests claim to pass in D.0 because continuity was not
implemented. Existing baseline validation passed: **36 focused analytics tests,
307 full regression tests, TypeScript, lint (excluding ignored .vercel artifacts)
and diff checks**. No live events, deployment, data writes or account changes.

## References

- [PostHog persistence and separate consent storage](https://posthog.com/docs/libraries/js/persistence).
- [PostHog privacy controls and final before_send hook](https://posthog.com/docs/product-analytics/privacy).
- Installed `posthog-js` 1.428.6: `posthog-core.js` final hook ordering,
  `sessionid.js` memory-mode behavior, and `@posthog/types/src/posthog-config.ts`
  opt-out/persistence/DNT settings.
- [Restaurant analytics contract](restaurant-analytics.md).

The immediate next implementation task should establish the restaurant analytics
storage permission/withdrawal contract. Durable identity can then be added to the
existing adapter and tested before building metrics that depend on continuity.
