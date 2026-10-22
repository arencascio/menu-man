# Operations V1: durable lead capture

Local implementation on `feature/super-tacos-demo`, October 22, 2026. Not committed, applied remotely, or deployed. This is the persistence slice of [the operations plan](menu-man-operations-v1-plan.md); no `/ops` screens, owner enrollment, scheduler, or delivery webhook are implemented.

**Subsequent local slice:** [Owner lead inbox](operations-v1-owner-inbox.md) now adds `/ops`, protected owner actions and manual retry wrappers in a second migration. This capture handoff remains the historical first-slice baseline. Neither migration has been applied remotely; scheduler, delivery webhook and real-owner provisioning remain unimplemented.

## Infrastructure inspected

- Current endpoint, strict form validation, 16KB body limit, same-origin checks, honeypot, process-local hashed-IP limiter, Resend helper, UUID subjects and Reply-To, SSR Auth clients, restaurant membership authorization, and Production management/publication gates.
- Read-only project identity/catalog inspection: Staging `jjvongzvtnzlvwdfcnjk` and Production `fullaiodvmilkdxyxnln`, both PostgreSQL 17.6. Neither contains marketing lead tables or ops-owner functions. Staging has restaurant notification/catering/membership tables; Production's inspected catalog has none of those objects. No contacts/lead rows were queried and no remote writes were performed.
- Existing migration conventions use transactional forward SQL, fixed search paths, explicit RPC grants, and RLS. The new file was generated using `supabase migration new`. Supabase CLI's incidental tracked version-cache update was restored.

## Files changed in this slice

| File | Purpose |
| --- | --- |
| `supabase/migrations/20261022070256_marketing_lead_capture_v1.sql` | Three tables, indexes, RLS/revocations, three restricted RPCs. |
| `src/lib/marketing-leads/persistence.ts` | Store interface, RPC adapter, bounded context schema and safe outcomes. |
| `src/lib/marketing-leads/server.ts` | Lazy server-only Supabase service client with request timeouts; credentials never enter browser modules. |
| `src/lib/marketing-leads/context.ts` | Optional current source page, four campaign codes, referrer category; no identity/storage/analytics dependency. |
| `src/lib/marketing-leads/handler.ts` | Validate, atomically save, claim, send, complete; durable acknowledgment and redacted failures. |
| `src/app/api/marketing/leads/route.ts` | Supplies server-side persistence without changing endpoint or anti-abuse configuration. |
| `src/lib/marketing-leads/client.ts` | Sends optional context, requires `recorded:true`, preserves unchanged retry UUID. |
| `src/app/MarketingLeadForm.tsx` | New inquiries reset the UUID after accepted success; emits `marketing_lead_recorded`. |
| `src/app/MarketingInteractions.tsx` | Confirmation says received/saved rather than claiming provider acceptance. Preserves earlier required-field marks. |
| `src/lib/analytics/types.ts` | Adds the durable event without reinterpreting historical accepted events. |
| `src/lib/marketing-leads/leads.test.ts`, `persistence.test.ts`, `test-store.ts` | Existing payload/anti-abuse/email coverage plus persistence, deduplication, error, logging, and acknowledgment tests. |
| `src/lib/analytics/marketing.test.ts` | Updates mocked successful responses to include durable acknowledgment. |
| `scripts/run-tests.ts` | Registers the new focused suite for future ordinary test runs. |
| `scripts/test-marketing-lead-db.mjs` | Fresh local-only PG17 rehearsal, synthetic fixtures, permission/concurrency/recovery checks, cluster shutdown. |
| This handoff and the implementation-status note in the operations plan | Current behavior, approval requirements and remaining work. |

Earlier uncommitted subject/header and required-indicator work, including `contracts.ts`, `notifications/resend.ts`, and `page.module.css`, remains intact. `AGENTS.md` is untouched. No environment file or credential was changed.

## Schema and authorization

`public.marketing_leads` stores a server-generated UUID, permanently unique client submission UUID, inquiry type, immutable normalized form details, SHA-256 payload fingerprint, optional source/attribution, status initially `new`, and server creation/update timestamps. Creation time is the submission timestamp. Every form-specific field is retained. Personal data lives only in `details`, not duplicated into email snapshots or attempt logs.

`private.marketing_lead_notifications` has one outbox item per lead: immutable sender and template version, stable delivery key, state, attempt count, lease token/expiry, first/last/next attempt timestamps, safe error category/HTTP status, provider message ID, and provider acceptance time. Acceptance does not mean inbox delivery. `private.marketing_lead_notification_attempts` records each started/completed attempt without copying contact fields, bodies, raw errors, or credentials.

All three tables have RLS enabled and no browser policies. Table privileges are explicitly revoked from PUBLIC, anon, authenticated, and service_role. Three fixed-search-path SECURITY DEFINER RPCs are executable only by service_role; they provide bounded ingestion, lease claim, and compare-and-set completion. No client/public read or mutation API is added. No existing private-schema privileges, Auth permissions, restaurant roles, payment configuration, or publication settings are altered. The future `/ops` owner gate remains required before any authenticated user can read records.

## Exact request behavior

1. Retain the existing origin, rate limit, content-type/body-size, strict Zod validation and honeypot checks. Earlier server-vs-HTML optional-field differences are intentionally preserved for payload compatibility.
2. `record_marketing_lead_v1` commits lead + queued outbox together. Same UUID and normalized details returns the same lead; changed inquiry type/details conflicts with HTTP 409. The database resolves concurrent requests. The first context/sender wins; retries cannot edit an existing lead or alter email content. A failed/unknown persistence response returns HTTP 503 with no received-success claim and no email attempt. Retrying the same UUID can recover an earlier commit whose acknowledgment was lost.
3. Claim a notification using a two-minute lease and append a started attempt. Accepted, failed, unknown, not-yet-due, and actively leased items are not sent again. Generate the existing subject/body/validated Reply-To from the stored immutable details and original sender. Use the same lowercase submission UUID in the subject, Gmail separation header, and Resend key on every retry.
4. Await the Resend request and completion RPC in the request itself. Successful provider acceptance saves its ID/time; transient failures or malformed successful responses become retryable; permanent rejection or missing email configuration becomes failed. Raw provider error strings are not stored or logged.
5. Return `{accepted:true, recorded:true}` once persistence was confirmed, regardless of email, claim, or completion failure. The visitor sees received/saved copy. A completion failure leaves the durable lease/attempt for recovery. No fire-and-forget process is relied upon. The browser accepts success only with the durable acknowledgment, preserves fields/UUID after failure, and gives an explicitly new inquiry a fresh UUID.

Optional context contains only one of four marketing paths, four bounded campaign codes, and a referrer category. No raw referrer URL/query, landing history, session identity, new cookies, or third-party analytics call is required. Context is available on the current page only; navigating away from campaign parameters does not add new tracking storage. Missing context is valid for old clients. Lead IDs/contact data are never added to behavioral events.

## Recovery and limitations

- Transient failures have exponential backoff from 60 seconds up to one hour, at most five attempts. An unchanged visitor retry can claim a due item, but there is **no guaranteed automatic drain** in this release. The durable backlog is ready for a separately approved operator retry path or worker.
- A crashed sender's expired lease can be reclaimed with the identical key/payload. The prior unfinished attempt becomes unknown. Completion with an older token cannot overwrite a newer attempt.
- Claims stop 23 hours after the first attempt, conservatively inside [Resend's 24-hour idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys), or after five attempts. Such records become `unknown` for reconciliation; they are not blindly resent. Failed configuration/permanent rejection also needs reviewed operator recovery. No public reset/resend endpoint or manual SQL execution is included.
- Template version 1, recipient constant, sender and immutable lead details must remain stable for retries. A future template or recipient change needs a versioned renderer/notification generation. The schema intentionally supports only the current template.
- Missing email configuration does not lose leads; it records a failed notification. Missing database configuration/schema fails closed. This source must **not** be deployed before the migration is approved/applied to the matching environment.
- A mounted form retains retry identity; refresh does not retain the submission UUID. A submission that never reaches the server cannot be recorded. Rate limiting remains per-process; durable/distributed abuse protection is a separate improvement.
- No delivery/bounce webhook, scheduler, owner UI, contact activity or follow-up fields are included. Provider acceptance is not delivery. No retention/purge runs.

## Plan adjustments

This vertical slice creates only the lead/outbox/attempt tables. `ops_owners`, activity history, follow-up management, delivery webhooks, and manual retry UI remain deferred. This avoids introducing unused owner authorization while providing durable capture now. Notification PII is not snapshotted: immutable details plus sender/template metadata reconstruct the fixed email. Source attribution is deliberately limited to safe context available on the current submission page. No new behavioral identity or cross-page storage was introduced.

## Validation

- Passed: TypeScript, targeted ESLint, **37/37** focused mocked lead/email/marketing analytics tests (zero failed/skipped), and `git diff --check`.
- Passed: **9/9** isolated PostgreSQL **17.11** rehearsal groups from a fresh cluster, loopback only, with synthetic data and Supabase-like role/default-grant fixtures. Tests cover persistence fields/timestamps, rollback after outbox failure, concurrent uniqueness/conflicts, first-context preservation, lease exclusion, completion and stale tokens, transient recovery, expired-key parking, browser-role table/RPC denials, RLS under an accidental SELECT grant, and preservation of existing private-schema privileges.
- This is a standalone additive-schema rehearsal, not a full restoration of either remote database. No historical migrations, payment tests, or remote data writes are needed for this slice.
- First Windows rehearsal attempt stalled on daemon output handles; the harness now ignores daemon stdio, bounds process execution, and stops the local cluster. The corrected rehearsal passes. Local database/log files remain under ignored `.playwright/marketing-lead-pg17-*`; no customer data is used.
- Chrome at 320/1440px, with all POST responses mocked and external requests blocked: DB-error copy retains fields/UUID, durable success copy, independently new inquiry UUID, Review no-website success, safe campaign context, and no horizontal overflow. Screenshots: ignored `.playwright/ops-foundation/durable-{build,review}-{320,1440}.png`.

Run focused checks:

```powershell
npx tsc --noEmit --incremental false
npx eslint src/app/MarketingLeadForm.tsx src/app/MarketingInteractions.tsx src/app/api/marketing/leads/route.ts src/lib/marketing-leads/*.ts src/lib/analytics/types.ts src/lib/analytics/marketing.test.ts scripts/test-marketing-lead-db.mjs scripts/run-tests.ts
node --import=tsx --test src/lib/marketing-leads/leads.test.ts src/lib/marketing-leads/persistence.test.ts src/lib/notifications/notifications.test.ts src/lib/analytics/marketing.test.ts
node --import=tsx scripts/test-marketing-lead-db.mjs
git diff --check
```

## Separate Staging approval and rollout requirements

1. Review and explicitly authorize **only** `20261022070256_marketing_lead_capture_v1.sql` against verified Staging `jjvongzvtnzlvwdfcnjk`. Recheck current schema/functions/grants for collisions and confirm backup/recovery readiness. Do not replay the historic migration chain or target Production.
2. Apply this additive migration through the supported migration process. Verify all three tables, indexes, restricted grants, RLS and RPC execution. No owner bootstrap is needed for ingestion; authenticated users remain denied.
3. Separately approve Staging application deployment and a controlled synthetic intake/email test. Existing server service-role key and verified Resend sender are reused; do not expose/pull credentials or alter DNS. Use an approved non-Production notification configuration for that test.
4. Verify a real Staging form creates one lead/outbox, independent retries do not duplicate it, and notification failure leaves it visible via authorized inspection. Confirm no change to management, Armando publication, Super Tacos simulation, or payment denials.
5. Production migration/deployment requires its own later explicit approval, current catalog/grant check, exact source revision, and compatible rollback plan. None is authorized or executed here.

Recovery/rollback: retain additive tables and acquired data; never drop saved leads to roll back application code. Do not restore the old email-only success contract after accepting durable leads. Use this compatible handler or a reviewed maintenance response if storage is unavailable. There is no new worker to disable. Table cleanup/data restoration requires separate authorization.

## Before `/ops` can display records

Implement the owner Auth UUID allowlist and separately scoped login/callback/session gate, server-side owner checks and RLS/read RPCs, then the bounded list/detail UI. Restaurant owner membership must not grant Menu Man operator access. Add activity/follow-up fields and explicit retry controls in a later reviewed migration; implement operator recovery for failed/unknown notifications before claiming automatic recovery. Keep Production `/manage` disabled and preserve all restaurant/payment gates. Approve retention and access policy before exposing contact records to an operator interface.
