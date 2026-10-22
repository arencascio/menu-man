# Menu Man operations V1 plan

Reviewed against approved Production source `b45b9bde402a2adbdc9ad3652ccb355a61174f87` on 2026-10-21. This sprint implements only the inquiry email and required-field indicators described below. `/ops`, persistent marketing leads, workers, analytics additions, and migrations in this document are **proposed**, not implemented.

**Follow-up status, 2026-10-22:** The local durable-capture slice now implements lead/outbox/attempt persistence and the received acknowledgment; it has not been applied remotely or deployed. See [Operations V1 durable lead capture](operations-v1-durable-lead-capture.md) for exact scope, validation, approval requirements, and deferred owner/UI work. The inventory and decisions below remain the original planning baseline.

**Owner-inbox follow-up:** The local `/ops` interface and owner/session/MFA-protected RPCs are now implemented, still disabled by default and not remotely provisioned/deployed. See [Owner lead inbox handoff](operations-v1-owner-inbox.md). Original planning inventory below is historical.

No database connection, schema change, email send, publication change, or deployment was performed. Repository migrations describe intended capabilities, not proof of their presence in Production. `PROJECT_STATE.md` contains older Staging architecture/status sections; current source and the Super Tacos release package provide the more specific evidence for this plan. No live PostHog project/event inspection was available in this session, so event delivery and account settings are not asserted from source alone.

## 1. Existing capability inventory

| Area | Actual implementation and limits |
| --- | --- |
| Marketing events | `src/app/MarketingAnalytics.tsx`, `src/lib/analytics/marketing*.ts`: explicit `$pageview`, `marketing_cta_clicked`, `marketing_form_opened`, `marketing_form_started`, `marketing_lead_accepted`, `marketing_lead_failed`, and `marketing_email_clicked` on Home, Services, Work, and Build My Website. CTA IDs and placement are metadata, not scraped link text. Exceptions do not block navigation or submission. |
| Attribution | Four sanitized codes (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`) are retained in sessionStorage after eligible capture. No raw referrer or first landing page is retained; the current event page is recorded. These codes and session identity are **not attached to lead submissions**. |
| Provider wiring | `posthog.ts` initializes the existing PostHog SDK when keys and eligibility permit. Scoped events use property allowlists. A read-only Vercel configuration check found `NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4`; that selector controls the separate `AnalyticsScripts.tsx` loader, not the PostHog adapter. The GA loader has `send_page_view:false`; no explicit `gtag('event', ...)` calls were found. A loaded GA script does not establish a working GA funnel. |
| Privacy and identity | Eligibility requires trusted Vercel ingress with US country information; missing/non-US decisions deny capture. PostHog autocapture, replay, profiles, automatic pageviews, and performance capture are disabled. Marketing SDK identity is memory-only. Restaurant identity is independently scoped by tenant/environment, with a 90-day local record, 30-minute visit window, and withdrawal control. Regional eligibility and opt-out are not a complete consent-management design. |
| Demo engagement | Restaurant events include page views, menu search length/result count (not raw query), item expansion/customization surfaces, cart actions, pickup/delivery, phone, and directions. Search and catalog properties are sanitized. Phone reels emit `menu-man:phone-showcase` DOM hooks, but no application subscriber forwards them to PostHog. The shared card's demo link has no explicit marketing CTA metadata; the red Working Product CTA does. |
| Simulated checkout | `SuperTacosDemoCheckout.tsx` creates a browser-local receipt. It has no simulated-completion analytics event and does not create a real order/payment. Automatic reel advance and autoplay are not engagement. |
| Marketing leads | `MarketingLeadForm.tsx` and `marketing-leads/client.ts` submit both forms to `/api/marketing/leads`. A client-generated UUID and unchanged-payload fingerprint preserve retry identity; a synchronous lock prevents concurrent clicks. Values survive failures in component state. Refresh loses that state. No lead table, marketing lead RPC, or `/ops` implementation was found in repository source/migrations. |
| Email | The Node route validates a strict Zod payload, origin, JSON type/size, honeypot, and process-local rate limit. It calls Resend directly with a fixed recipient, configured sender, validated customer Reply-To, escaped HTML/plain text, and `marketing-lead/<submissionId>` idempotency key. Only a nonempty provider ID yields `accepted:true`. Acceptance is not inbox delivery; provider IDs/errors are not persisted by this handler. No durable retries or lead delivery webhook exists. |
| Existing data machinery | `202609150001_notifications_multitenant.sql` defines restaurant notification outbox/attempts; payment migrations define `analytics_outbox` for verified purchase events. Catering migrations define tenant-scoped inquiry persistence. These are useful patterns, not a marketing lead store or authority to replay them into Production. |
| Authentication/access | Supabase SSR cookie clients already exist in `src/lib/supabase/admin-{server,browser}.ts`. Restaurant management validates claims, then uses tenant membership/capability RPCs. A restaurant `owner` is not the Menu Man operator. `src/proxy.ts` and `production-management-gate.ts` deny Production `/manage`, `/api/manage`, and existing management auth callback/sign-out paths. |
| Reporting | Restaurant reporting already uses server-only PostHog queries with configured project/key, bounded ranges, and membership/capability authorization. It is routed through restaurant management and is not an available Production operations dashboard. Unknown/unavailable results are distinguished from zero. |

### Small fixes in this sprint

- Resend subjects become `[MM-<submission UUID>] Website inquiry — <restaurant>` or `[MM-<submission UUID>] Free website review — <restaurant>`. Full UUIDs, rather than timestamps or short prefixes, identify independent submissions. Unchanged retries keep the same subject and provider key.
- Each lead supplies a stable, form-specific `X-Entity-Ref-ID`. No `In-Reply-To`, `References`, or custom `Message-ID` is added. Sender configuration is unchanged; Reply-To already used the validated submitter address and remains so. Subject context removes control characters, bounds the restaurant label, and substitutes a generic label for pasted email/URL/phone patterns. Contact fields and notes remain in the body.
- Required marks follow existing HTML rules: Build requires restaurant, name, email, city, ordering-choice group, and help selection; Review requires restaurant, email, and website unless “I don't have a website” is selected. The website mark changes with that condition. Existing `required`, disabled state, fields, layouts, endpoint, and validators are retained.
- Browser/server validation are not identical today: server schema permits empty name/city/ordering choice even though Build's HTML requires them. This sprint does not silently tighten that contract; reconcile it explicitly in the persistent-ingestion phase.

Resend documents [custom Gmail separation headers](https://resend.com/changelog/custom-email-headers) and provider-assigned [Message-ID/thread reply behavior](https://resend.com/changelog/message-id-for-sent-emails). Mocked tests establish the outgoing payload, not Gmail's final inbox grouping; a controlled non-Production inbox check needs separate email-send approval.

## 2. Lead-loss and attribution risks

1. Email is currently the only durable business artifact. Missing configuration, provider rejection, browser abandonment, or an ignored error can leave no application lead. A success response means provider acceptance, not delivery, follow-up, or a saved CRM record.
2. Retry identity exists only in the mounted submitter. Changed fields create another UUID; refresh loses it. Reusing “Back to the form” with identical details can retain the prior UUID. A later explicit new-inquiry reset must distinguish a fresh inquiry from a retry. The public server has no permanent same-ID/different-payload conflict check.
3. Resend's idempotency window is finite; it is not a permanent lead uniqueness constraint. The limiter is per process, resets on cold starts, and is not distributed abuse protection.
4. There is no delivery/bounce history, pending-notification inbox, overdue list, or independent source of truth when Gmail notifications fail. Existing inbox history cannot be reliably reconstructed from application data; no automatic historical import is proposed.
5. Campaign context ends at analytics. Marketing memory identity and restaurant identity cannot currently support a reliable joined visitor funnel. Mailto fallback clicks, blocked analytics, non-US traffic, and provider failures make analytics counts incomplete.
6. Phone hooks and receipt-completion gaps undercount demonstrated engagement. Existing demo restaurant events lack a universal `is_demo` marker. Do not infer sales, real orders, or payment conversions from them.
7. There is no comprehensive owner/synthetic exclusion in marketing reporting. No live provider ingestion/consent/project-settings audit was done here. PII filtering in code does not prove provider-side IP handling or legal compliance.

## 3. Smallest sustainable analytics approach

Keep the installed **PostHog** integration for behavioral reporting and Supabase for operational leads. Do not build an event warehouse or custom chart engine. Start `/ops/analytics` with an explanatory summary and owner link to a saved PostHog dashboard. Add a few bounded, server-side aggregate cards only after event quality is demonstrated. Reuse the server-query pattern, not restaurant membership as authorization; no browser analytics API key with read privileges and no arbitrary query proxy.

Resolve the redundant GA loader's purpose with the owner before later changing configuration. Avoid sending the same explicit funnel into two providers. This sprint changes neither provider nor configuration. Review PostHog [privacy controls](https://posthog.com/docs/product-analytics/privacy) and [consent responsibilities](https://posthog.com/docs/privacy) before adding identity or attribution storage. Keep replay, autocapture, person profiles, free-text capture, and automatic URL capture disabled.

### Proposed event contract additions

| Meaning | Existing/recommended event and rule |
| --- | --- |
| Page / CTA | Retain scoped `$pageview` and `marketing_cta_clicked`; add an explicit safe destination identity for demo vs intake where current CTA IDs are ambiguous. |
| Demo opened | Add `marketing_demo_opened` to intentional demo-link activation; include bounded placement and demo identifier. Cover the card, red CTA, and phone link once each. |
| Video engaged | Add `marketing_video_engaged` after explicit Play or manual reel selection followed by playback. Use reel ID/action only. Exposure, autoplay, scrolling, and automatic advance remain separate/non-engagement. |
| Search / customization | Keep `menu_search` and `menu_item_expanded` with validated metrics/surface; use `detail_mode` to distinguish full/quick customization. Add `is_demo=true` to demo reporting context. No raw query or instructions. |
| Simulated completion | Add `demo_simulated_checkout_completed` once per newly generated browser sample receipt. Mark `is_demo=true`, `simulated=true`; never emit `purchase`, revenue, `order_created`, or real payment success. |
| Form / result | Keep started/failed events. When persistence is implemented, distinguish `marketing_lead_recorded` from notification accepted/delivered. Do not reinterpret historical `marketing_lead_accepted` as a persisted lead. |

Use allowlisted campaign codes, first landing path from the four marketing routes, referrer category (search/social/known domain/direct/other), environment, and a consent-permitted random funnel/session UUID. Never capture raw query strings, submitted website URLs, full referrers, names, emails, phones, notes, payment information, or lead/submission IDs. Keep anonymous funnel identifiers separate from the operational lead ID; do not identify a PostHog person with a contact address. Optional attribution may be saved privately on the lead without requiring behavioral tracking to submit.

A future session key should have an explicit short inactivity lifetime and withdrawal behavior. Join marketing to the public demonstration only when permitted; do not join identities across real restaurant tenants. With tracking denied, record no behavioral event and retain only necessary first-party lead form/source metadata. Keep lead intake available independently of analytics and campaign-storage failures.

Exclude non-Production environments in business dashboards. Add an authenticated owner QA mode backed by a signed server-issued cookie, checked by the eligibility endpoint, plus explicit synthetic labels in controlled Staging tests. Do not trust a public query flag as authorization, depend on unstable memory-only owner IDs, or erase historical observations. Require new dashboards to exclude QA/synthetic traffic and separate demo engagement from restaurant business outcomes.

## 4. Minimal lead data model and delivery contract

Five small tables, isolated from restaurant/order tables, are sufficient:

| Proposed object | Required data/constraints |
| --- | --- |
| `private.ops_owners` | Auth user UUID primary key referencing `auth.users`, active/revoked state, created/updated timestamps. Trusted bootstrap only; no self-enrollment. |
| `public.marketing_leads` | Server UUID PK; unique client submission UUID; canonical payload fingerprint; source form; restaurant/contact/name/phone/city/website/order-provider/help/notes fields with current bounds; lifecycle status; next follow-up, last-contact timestamp; created/updated times and optimistic version. Separate bounded attribution JSON and synthetic/environment flags. |
| `public.marketing_lead_activity` | UUID PK, lead FK, actor UUID, type (`note`, `contact`, `status`, `follow_up`), bounded note/change data, timestamp. Notes append to a timeline; server supplies actor/time. |
| `private.marketing_lead_notifications` | UUID PK, lead FK, notification generation, unique stable delivery key, immutable send-payload snapshot/hash, fixed destination, state, attempt count, next retry time, lease token/expiry, provider email ID, accepted/delivery timestamps, safe error code. Unique `(lead_id, generation)`. |
| `private.marketing_lead_notification_attempts` | Attempt/event UUID PK, notification FK, attempt number, outcome/code/times, provider event ID unique when present. No raw webhook bodies, credentials, or echoed PII errors. |

Statuses: **New / Contacted / Waiting / Won / Lost / Spam**. `New`, `Contacted`, and `Waiting` remain open. “Overdue” is an open lead with a follow-up time before now; “Needs attention” also includes open leads with no follow-up and unresolved notification failures. Delivery state never closes a lead. A manual “Contacted” action records last-contact time; Gmail reply tracking is manual.

### Ingestion and notification sequence

1. Validate origin, payload, existing field rules, and abuse limits. Future schema/HTML alignment must be deliberate and versioned. Email-address validation is not proof of mailbox ownership.
2. One restricted server RPC transaction inserts the lead, initial activity, and pending notification. Same submission UUID + same canonical fingerprint returns the saved lead without new mail; a different fingerprint returns a conflict. Database uniqueness, not a process lock, arbitrates concurrent requests.
3. Confirm to the visitor **only after commit**. A future response such as `recorded:true` means saved, even if notification is pending; update client copy/analytics alongside that contract. A failed save returns failure and preserves form values for retry. No design can save a request that never reaches the server.
4. Attempt a send after recording, without making the lead depend on email success. A small scheduled worker recovers pending/retryable notifications. Reuse lease/attempt patterns from existing notification code, not its commerce-specific table dependencies.
5. Claims must be atomic and bounded (row locks/skip-locked), with expiring leases and compare-and-set completion. Retry transient failures with bounded backoff/jitter and the identical immutable payload/key. Permanent failures remain visible for owner action; show provider outage separately from zero pending leads.
6. Resend's [24-hour idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys) limits automatic ambiguous-send retries. Before that boundary, retry with the same key; beyond it, park an unknown outcome for reconciliation/manual decision instead of blindly creating a duplicate. Exactly-once lead creation does not imply exactly-once email delivery forever.
7. Add a narrowly scoped Resend delivery webhook when implementing delivery tracking. Verify the signature over the raw body, enforce timestamp/replay protections, persist a unique event ID and safe delivery fields, and handle duplicate/out-of-order events. Never regress delivered/bounced state based on an older “sent” event. [Resend verification contract](https://resend.com/docs/webhooks/verify-webhooks-requests).

Notification states distinguish `queued`, `sending`, `accepted`, `delivered`, `bounced`, `complained`, `failed`, and `unknown`. The dashboard always retains the lead. Owner-approved resend creates a new notification generation with a visible duplicate-delivery warning when prior outcome is ambiguous. Keep current sender/domain and validated Reply-To; no Gmail integration is needed.

## 5. Dashboard screens

- `/ops`: New, overdue, and notification-problem counts; compact attention list, not a broad business dashboard.
- `/ops/leads`: default open leads; New/Overdue/All views; status, form, notification state and date filters; paginated search by restaurant/contact (queries remain first-party and unlogged). Stable order by follow-up/creation plus UUID; no unbounded exports.
- `/ops/leads/[id]`: contact details, source/attribution, status, append-only notes, follow-up date, last-contact action, and notification timeline/retry controls. Show the unique email reference to find the Gmail conversation. Escape all stored text; never render arbitrary HTML or fetch a lead's supplied URL server-side.
- `/ops/analytics`: initially link to vetted PostHog insights; later 7/30/90-day aggregate views with definitions, freshness, unavailable states, and QA/demo filters. No contacts, inbox content, real order management, or payment controls.

Use the owner's selected display timezone and store dates in UTC. Keep the initial experience usable on a phone. No drag-and-drop pipeline, automation builder, attachments, client accounts, or bidirectional email sync.

## 6. Owner access and data protection

Reuse Supabase Auth and SSR cookie-client plumbing. Add a separate `/ops/login` UI using existing sign-in primitives, plus an exact `/ops` return-path allowlist. Existing management login/callback code hardcodes `/manage` and its callback activates restaurant memberships; do not reuse those routes wholesale. Keep Production `/manage`, `/api/manage`, `/auth/callback`, and `/auth/sign-out` gates intact. If recovery/callback/sign-out is needed for ops, implement explicitly scoped `/ops/auth/*` routes without membership activation or broad redirects.

Protect every ops server page, route handler, action, report, and data operation: verify the Supabase session, then query active `ops_owners` by immutable auth UUID. Do not trust email text, `user_metadata`, an unsigned cookie, a client hidden route, or any restaurant role as global-owner authority. Check revocation on every operation; require fresh user/session validation and MFA for owner writes as the chosen authentication policy. Claims verification alone does not give immediate session revocation; account for the [SSR session lifecycle](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

Enable RLS on both public lead tables and private operations tables. Revoke anonymous access and default/public function execution. Authenticated read policies permit only an active ops owner; no restaurant-member policy applies. Owner mutations go through bounded RPCs that recheck owner access, set the actor internally, enforce versions/constraints, and append history transactionally. For any SECURITY DEFINER function, use a fixed empty search path, qualified objects, explicit grants, and an internal authorization check; RLS does not by itself constrain a bypassing privileged client. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

Public ingestion and worker RPCs are service-role-only and narrowly scoped; that credential stays server-only. No direct browser service-role client, generic database API, public lead lookup by UUID, or publicly cached ops response. Use `private, no-store`, noindex, same-origin/CSRF checks on mutations, rate-limited login/retry, and scrub PII/tokens from logs and monitoring. Add `/ops` session refresh to the proxy without relaxing its existing gates. A separate ops enable flag defaults to disabled until an owner exists and end-to-end Staging authorization checks pass.

## 7. Staged implementation sequence

1. **This pass:** subject/header and required marks with mocks; review this plan. No ops routes or database objects.
2. **Schema rehearsal:** separately approved additive migrations on disposable PostgreSQL **17**, using a verified Production-shaped schema and synthetic data; then Staging **`jjvongzvtnzlvwdfcnjk`** only. Fail closed on target mismatch. Do not use real lead contacts as fixtures.
3. **Persistence first:** atomic lead/outbox ingestion and client acknowledgment semantics, concurrency/conflict tests, and a non-Production sender. Keep existing email path until the coordinated cutover; do not send twice during transition.
4. **Private inbox:** ops owner bootstrap, auth gate/RLS tests, lead list/detail/status/notes/follow-up and manual contact tracking. Keep restaurant management disabled in Production.
5. **Reliability:** leased worker, retry states, signed webhook and reconciliation; test crashes and ambiguous sends before enabling the schedule. Verify the selected hosting plan supports the required retry cadence; an explicit owner Retry remains available.
6. **Analytics quality:** bridge only the missing explicit events, safe attribution/session contract, QA exclusion and approved consent behavior. Validate the real project with read-only access before relying on funnel counts; then create a minimal dashboard.
7. **Production cutover:** only after separate approval for the exact schema, owner bootstrap, configuration, and application SHA. Monitor saved leads and pending notifications independently of email delivery.

## 8. Exact Production migration requirements

Production is **`fullaiodvmilkdxyxnln`**, not Staging. No migration is authored or executed in this sprint. Before implementation, obtain a read-only current schema/grants comparison and approved backup/recovery evidence. Production's historical catalog is not equivalent to the full Staging migration chain.

The eventual reviewed release must contain only these operations additions:

1. The five objects in section 4, `pgcrypto`/UUID support only if actually absent, their FKs/checks, and bounded field constraints. Do not alter restaurant memberships, catalog, order, payment, or existing notification tables.
2. Unique submission UUID and fingerprint conflict handling; unique notification generation/key and webhook event ID; indexes for `(status, next_follow_up_at, id)`, creation/form filtering, lead activity chronology, and due notification leases. Start with bounded parameterized `ILIKE` search; add no speculative search extension.
3. An active-owner predicate, atomic submit RPC, owner mutation RPCs, worker claim/complete RPCs and delivery-event RPC with exact privilege separation. Explicitly revoke defaults before granting only intended authenticated/service roles. RLS and grants must reject direct anon and unrelated tenant access.
4. Trusted bootstrap of the **verified Production Auth user UUID** into the new allowlist under separate database-write authorization. No restaurant owner promotion or edits to `auth.users`; absence of the allowlist entry keeps ops closed.
5. Database tests and a dedicated preflight/verification script asserting exact target, required objects/privileges, schema version, no unrelated DDL, and existing Armando/demo/payment/management restrictions. Rehearse against PostgreSQL 17 and then Staging. Do not run broad historic migrations or seed SQL in Production.
6. Separate deployment/configuration checklist: existing verified sender/key unchanged; approve any worker schedule, webhook signing secret and narrowly enabled ops flag independently. No DNS or payment settings are required. Do not claim delivery tracking until the signed webhook is configured and tested.

Apply additive schema before the compatible app cutover; acceptance requires a saved lead transaction, not an email alone. Roll back the app/ops flag without dropping acquired leads or notification history. Pause the new worker explicitly if rolling back delivery code. Do not automatically roll back to an email-only handler after accepting persistent leads; prepare a compatible maintenance response if persistence is unavailable. Data restoration/drop commands require their own review.

## 9. Focused tests and acceptance criteria

**Small fixes now:** mocked Resend tests cover independent same-restaurant UUID subjects, stable retry subject/key/reference, distinct forms, safe subject context, fixed sender/recipient, validated Reply-To and no reply-thread headers. Run existing lead failure/origin/honeypot/size/limiter tests and the shared notification helper suite. TypeScript, targeted ESLint and diff checks. Chrome checks required marks at mobile/desktop, conditionally required Review website, unchanged optional fields/radio semantics, and no network submissions.

Current validation passed: TypeScript (`--noEmit --incremental false`), targeted ESLint, 17/17 mocked lead/notification tests, and `git diff --check`. Google Chrome checks at 320, 412, and 1440px passed for both forms, red indicators, existing native required fields, the conditional website toggle, dialog bounds, and no horizontal page overflow. All POST and external requests were blocked; no synthetic lead or real email was sent. Local review images are in ignored `.playwright/ops-foundation/build-{320,412,1440}.png` and `review-{320,412,1440}.png`. The initial browser run exposed a test-locator error; correcting the locator required no application change.

**Later persistence/access acceptance:** concurrent identical submissions yield one lead/outbox; changed payload with the same key conflicts; database failures never report recorded success; email outage does not lose a saved lead. New/overdue leads remain visible until explicitly resolved. Double-click, timeout, refresh/retry, stale versions and actor spoofing are covered. Anonymous, non-owner, revoked owner, and restaurant-owner access all fail at both HTTP and database/RPC layers, including cross-tenant tests. Production management stays 404; Armando remains private and Super Tacos nonorderable/nonindexable.

**Later reliability/analytics acceptance:** workers recover after crashes/lease expiry without concurrent double sends; duplicate/old/forged webhook events cannot corrupt state; ambiguous >24-hour sends require review. Mocks and an explicitly authorized non-Production inbox prove Reply-To, separate Gmail threads and delivery state. Analytics blocked/denied/unavailable never blocks lead recording; allowlists reject contacts, URLs, notes and raw search text. Owner QA is excluded, simulated receipts never emit real commerce events, and reports show unavailable/stale separately from zero. No replay is enabled by default.

## 10. Owner decisions before implementation

- Confirm the Production and Staging owner Auth UUIDs and MFA/recovery policy. Recommendation: one explicit operator initially; no public ops enrollment.
- Approve lead/notes retention and deletion policy. Suggested starting policy for review: purge Spam/Lost PII after 90 days, review inactive open leads at 12 months, retain only necessary won-client records under a separately chosen policy. No automatic purge before approval.
- Confirm reporting geography/consent and short-lived funnel identity policy. Existing US eligibility remains until reviewed; do not broaden capture by assumption. Confirm whether GA4 still serves a purpose.
- Choose a follow-up display timezone (recommend `America/Los_Angeles`) and acceptable notification recovery cadence within the existing hosting plan. No new paid queue is assumed.
- Approve a controlled Staging delivery/Gmail test and, later, exact Production schema/configuration/application releases separately. Historical Gmail import is outside this plan.

No additional CRM platform, Gmail synchronization, restaurant management expansion, payment activation, or publication change is required for this foundation.
