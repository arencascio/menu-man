# Operations V1: owner lead inbox

Local implementation on `feature/super-tacos-demo`, October 22, 2026. **Not committed, remotely migrated, or deployed.** Existing durable-capture and form/email changes are preserved. `AGENTS.md` is untouched.

## Implemented scope

- `/ops`: New / follow-ups due / failed-or-uncertain email summaries, conspicuous email warning, unresolved newest-first inbox, status/form/view filters, newest/oldest/follow-up sorting, and 25-row pagination.
- `/ops/leads/[id]`: all submitted details, source/campaign/referrer category, email reference, owner status/notes/follow-up controls, last-contact time, notification state/attempts, and recent owner activity.
- `/ops/login` and scoped password/TOTP/sign-out POST routes. No registration, magic-link email, restaurant-membership activation, Gmail synchronization, scheduler, or new analytics service.
- All mutations use a specific protected endpoint and bounded RPCs. No generic database editor or public lead lookup is added.

## Authentication and data security

Reuse the existing Supabase SSR cookie-client plumbing with the publishable key and user session. Each protected page/action validates the user using server-side `auth.getUser()`, then checks `get_ops_access_v1`. Every data/mutation RPC independently checks the private owner allowlist, live Auth session ID/user association, active owner state, and required assurance level. A client role/email/user_metadata value or restaurant owner membership confers no authority.

`private.ops_owners` is empty after migration. Trusted provisioning must add the specifically approved Auth user UUID. `require_aal2` defaults to true; verified TOTP is the implemented second-factor flow. Do not disable it to make a fixture or an unprovisioned real account work. The local synthetic fixtures use their own UUIDs and sessions; no real owner identity was guessed or provisioned.

No service-role client is used by the inbox or its retry path. The original public ingestion endpoint retains its server-only service RPCs. Owner retries use user-scoped, owner-authorized wrappers around the existing claim/completion functions. All new private tables enable RLS and revoke direct table privileges from PUBLIC, anon, authenticated, and service_role. Existing lead/outbox direct-access revocations remain intact. Read access is through the owner-only bounded RPCs, not new public SELECT policies.

Operations defaults to HTTP 404 unless `MENU_MAN_OPS_ENABLED=true`. Once enabled, unauthenticated pages redirect to the sign-in page; a valid non-owner receives no lead data (404 pages / 403 actions). MFA-incomplete owner sessions can only complete verification. Missing configuration or data availability never renders a misleading empty inbox.

Pages render per request; no user data cache or lead-specific metadata is introduced. Titles/descriptions are constant. Operations sets no-store, noindex/nofollow, frame denial, and `same-origin` referrer policy. This policy allows ordinary same-origin form POSTs to supply the Origin needed for CSRF checks while suppressing referrers to external sites. Strict Origin and cross-site checks protect sign-in, sign-out, and mutations. Next dev normalizes Cache-Control to `no-store`; source additionally requests private/max-age=0. Native document navigation avoids retaining inbox records in a client-router navigation cache.

Production `/manage`, `/api/manage`, management callback/sign-out gates, Armando publication restrictions, and payment/demo behavior are preserved. The proxy adds only `/ops` session refresh and its disabled-by-default gate. Existing management response headers are unchanged. PostHog initialization is explicitly skipped on `/ops`; no owner data or actions are sent to analytics.

## Schema and owner actions

The second forward-only migration adds:

- `private.ops_owners`: explicit UUID allowlist, active flag, MFA requirement, timestamp, Auth user FK.
- Lead `internal_notes`, `follow_up_at`, `last_contacted_at`, optimistic `revision`, and an open-lead follow-up index.
- `private.marketing_lead_activity`: actor Auth UUID, lead ID, timestamp, change kind, and bounded change metadata. Status/follow-up changes and notification retry requests are audited. Notes edits record that a change occurred without duplicating the note body; this is not full note-version history.
- Auth/session predicates and restricted access, list, detail, update, retry-claim, and completion RPCs. No restaurant tables, memberships, or existing notification tables are altered.

Owner saves validate a six-value status, at most 8,000 note characters, a finite bounded timestamp or null, and the expected revision. Simultaneous/stale edits cannot silently overwrite another save. A transition into Contacted stamps last-contact time; this is manual tracking, not evidence of a Gmail reply. A no-op save does not create a redundant audit entry.

Due follow-ups include only New/Contacted/Waiting leads. Won/Lost/Spam remain available under All leads and do not inflate overdue counts. A closed lead's email problem remains visible under notification problems. The detail form now accepts `America/Los_Angeles` date/time and sends canonical UTC to the existing mutation; inbox/detail summaries use the same Pacific zone. Clearing the field removes the follow-up. A nonexistent or newly ambiguous daylight-saving time is rejected; saving an unchanged repeated-hour value preserves its original instant.

## Notification recovery

The same immutable stored details, original sender, UUID subject/Gmail reference, recipient, template version and Resend idempotency key are used by first delivery and owner retries. Rendering/result classification was extracted into `marketing-leads/delivery.ts` and is covered by the unchanged capture regressions.

The retry button is enabled only when the database reports eligibility and server email configuration is present. The endpoint rechecks authorization/configuration and the database atomically claims the existing two-minute lease. A due permanent-rejection/configuration failure with an original sender can be reopened under the same rules; no payload edit, new delivery key, limit reset, or sender replacement is offered. Concurrent requests produce at most one send claim.

- Backoff, maximum five attempts, active-lease exclusion, and the conservative 23-hour first-attempt window remain enforced in PostgreSQL.
- Provider-accepted emails are never resent here. Acceptance is visibly distinguished from Gmail delivery.
- Unknown outcomes, expired safe windows, exhausted attempts, and missing original sender require reconciliation/repair outside this interface. The UI explains these blocks.
- Missing Resend credentials returns unavailable **before** consuming a manual claim. The lead stays readable. A send/completion uncertainty remains durable and must be checked via Refresh state.
- No guaranteed automatic drain or external scheduling service is added. Replies, delivery webhooks, and repaired/new notification generations remain future work.

## Changed-file inventory for this slice

| Paths | Purpose |
| --- | --- |
| `supabase/migrations/20261022073652_ops_owner_lead_inbox_v1.sql` | Owner allowlist, lead fields, audit table, access/read/mutation/retry RPCs. |
| `src/lib/ops/{access,contracts,server,http,auth-http,actions}.ts` | Authentication, validation, DAL, private HTTP boundaries, auth flow and bounded actions. |
| `src/lib/ops/ops.test.ts` | Focused access, action, retry, redaction and source-boundary tests. |
| `src/app/ops/{layout,page,error,Presentation}.tsx`, `ops.module.css` | Private shell, inbox, safe unavailable state, presentation and responsive utility styling. |
| `src/app/ops/login/page.tsx` | Owner password/TOTP sign-in UI. |
| `src/app/ops/auth/{sign-in,verify,sign-out}/route.ts` | Scoped auth POST routes. |
| `src/app/ops/leads/[id]/{page,LeadActions}.tsx`, `actions/route.ts` | Detail view and protected owner actions. |
| `src/lib/marketing-leads/delivery.ts`, `handler.ts` | Reuse exact first-send rendering/outcome handling for retries. |
| `src/proxy.ts`, `next.config.ts` | Ops gate/session refresh and private headers; existing management gates retained. |
| `src/lib/analytics/posthog.ts` | Skip SDK initialization on private operations routes. |
| `scripts/run-tests.ts`, `scripts/test-marketing-lead-db.mjs` | Register focused tests; opt-in owner/local browser rehearsal. |
| `scripts/qa/ops-owner-{inbox,browser}.mjs` | Synthetic PostgreSQL/Auth/Chrome checks, isolated from application runtime. |
| This handoff and status notes in the two operations documents | Current scope, validation and exact rollout sequence. |

Earlier uncommitted work remains separate in the working diff. The Next QA process may regenerate ignored build/type outputs; its incidental tracked tsconfig rewrite is restored after QA. No local environment file or secret is added to this release.

## Validation and reproduction

Final local results: **42/42 focused tests passed**, **7/7 owner-inbox PostgreSQL groups passed**, and **9/9 existing durable-capture PostgreSQL groups passed**. TypeScript, targeted ESLint and `git diff --check` passed. Chrome passed at **320, 412 and 1440px**. Reviewed screenshots are in ignored `.playwright/marketing-lead-pg17-X4d9Na/inbox-{320,412,1440}.png` and `detail-{320,412,1440}.png`.

Browser QA found and corrected an actual ordinary-form/CSRF integration issue by applying `same-origin` referrer policy to `/ops`. Initial harness failures also included loopback-origin normalization, a Next-dev cache-header expectation, a timezone-sensitive timestamp comparison and an overly strict select locator. The final runs passed without weakening authorization, Origin validation, or retry limits.

Use the installed PostgreSQL 17 tools on Windows and Google Chrome. Commands accept no remote database URL:

```powershell
npx tsc --noEmit --incremental false
npx eslint src/app/ops src/lib/ops src/lib/marketing-leads/delivery.ts src/lib/marketing-leads/handler.ts src/proxy.ts src/lib/analytics/posthog.ts next.config.ts scripts/test-marketing-lead-db.mjs scripts/qa/ops-owner-inbox.mjs scripts/qa/ops-owner-browser.mjs scripts/run-tests.ts
node --import=tsx --test src/lib/ops/ops.test.ts src/lib/marketing-leads/leads.test.ts src/lib/marketing-leads/persistence.test.ts src/lib/notifications/notifications.test.ts src/lib/analytics/marketing.test.ts
node --import=tsx scripts/test-marketing-lead-db.mjs --ops
node --import=tsx scripts/test-marketing-lead-db.mjs --ops-browser
git diff --check
```

The rehearsal creates synthetic roles/Auth tables in fresh loopback PostgreSQL **17.11**, applies the two local migrations, and stops the cluster afterward. It retains the original nine capture groups and adds owner-access, update/audit, retry, revocation, and direct-access-denial groups. The browser mode launches a separate local Next process and a test-only Auth/Data API wire fixture backed by those database RPCs. It uses no production auth bypass, fixture mode in `/ops`, real credentials, or real email. External browser requests are blocked and Resend credentials are cleared in the test process.

Browser coverage targets 320, 412 and 1440px; anonymous and valid non-owner sessions; password + TOTP; owner list/detail and saved changes; follow-up filtering; failed notification visibility; absent-email configuration; CSRF denial; logout; no sensitive metadata; no horizontal overflow; and retained Production management/Armando 404 gates. Provider send success/failure and concurrent retry behavior are tested with mocked delivery against the real local RPCs, not a live Gmail inbox.

This is an additive-schema/Auth-contract rehearsal, not a complete local Supabase GoTrue/PostgREST installation or a full remote database restore. Hosted password/TOTP/cookie/cache behavior still needs an explicitly authorized Staging pass. No remote database connection or real email is used in this inbox sprint. Earlier browser harness corrections are documented in the task report; they do not justify relaxing access checks.

## Exact Staging release sequence — separate approval required

1. Verify Staging is **`jjvongzvtnzlvwdfcnjk`** using supported read-only identity/catalog checks. Compare current object names, function signatures/grants, and Auth `users`/`sessions` contract; verify backup/recovery readiness. Staging already has its own private schema, restaurant notification/catering tables and roles. Do not replay the historical migration chain or reuse restaurant-owner permissions.
2. Review/approve/apply in order **only**:
   - `20261022070256_marketing_lead_capture_v1.sql`
   - `20261022073652_ops_owner_lead_inbox_v1.sql`
   The first creates the self-contained durable pipeline. The second depends on it and adds owner access. Recheck RLS, revocations, role execution, and unchanged existing private-schema privileges. Neither file provisions an owner or changes Auth provider configuration.
3. Confirm the exact **Staging owner Auth UUID** with the owner before any allowlist write. Reuse the appropriate existing confirmed Supabase account. Password sign-in must be enabled, the owner must have a usable password and a verified TOTP factor, and recovery must be arranged through a trusted supported account process. This sprint does not enroll a real factor, create/invite users, send recovery email, or provide an enrollment/recovery UI. An unprovisioned account intentionally cannot enter the inbox.
4. Separately authorize trusted provisioning of that UUID into `private.ops_owners` with `active=true, require_aal2=true`. No email-based bootstrap, user_metadata role, or restaurant-owner promotion. Verify that a different restaurant account remains denied. Do not insert a fixture UUID or disable MFA to bypass missing setup.
5. Verify existing server settings: `NEXT_PUBLIC_SUPABASE_URL` must identify Staging, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for SSR user sessions, `SUPABASE_SERVICE_ROLE_KEY` server-only for the existing public ingestion path, and the existing `RESEND_API_KEY` / `MENU_MAN_LEAD_EMAIL_FROM` for notifications. Do not expose service keys or alter DNS. Ops does not require a second Auth project or callback redirect configuration for this password/TOTP flow.
6. Separately approve the exact application deployment and `MENU_MAN_OPS_ENABLED=true` **on Staging only** after schema and owner setup. Keep the flag unset/false in Production. Retain Production management denial and publication/payment restrictions. Do not deploy this source ahead of the durable-capture migration: public intake deliberately fails closed without its schema.
7. With explicit synthetic-data/write approval, create one Build and one Review inquiry through the Staging endpoint using approved synthetic contacts and recorded submission UUIDs. Confirm one durable lead/outbox per UUID and unchanged retry deduplication. No customer information is needed.
8. For email outage QA, prefer a missing-credential test before any send: the lead must be saved and visible as failed while the manual retry button is unavailable. Any Staging configuration change requires separate approval. To exercise actual provider failure and recovery, use a separately approved Staging-only mock/sandbox transport or approved controlled mailbox; no real delivery test is authorized by this task. Retain original sender/payload, wait for backoff, and verify exactly one eligible lease and attempt. Never reset limits/unknown outcomes with ad hoc SQL.
9. Hosted acceptance must cover password/TOTP cookies, anon/non-owner/revoked-owner denial, private headers, owner edits and conflicts, failed-email visibility and safeguards, logout, and unchanged restaurant/management gates. Only then consider a separately approved Production migration/config/application release. Production identity is **`fullaiodvmilkdxyxnln`** and no Production operations enablement is included here.

Rollback: disable the ops flag or roll back compatible UI code; retain all leads, outbox/attempt history, notes and audit data. Keep durable intake on compatible code or a reviewed maintenance response, never restore misleading email-only received success. Revoke owner access through its active flag when separately authorized. No down migration or data deletion is supplied. No worker/scheduler was added to disable.

## Remaining blockers before hosted use

- Owner confirmation/provisioning of the correct Staging Auth UUID, usable password, verified TOTP and recovery process.
- Separate approvals for both migrations, owner allowlist write, Staging environment flag/application deployment, and synthetic hosted QA.
- Hosted Supabase/Auth verification; local wire fixtures cannot certify account/provider/cookie settings.
- Email delivery tracking, expired/unknown notification reconciliation, sender/template repair/new generations and automatic recovery remain out of scope. Provider acceptance must not be represented as delivery.

Stop for owner review. No commit, push, deployment, remote database write, payment/publication change, or real email is included.
