# Operations V1: Staging release preparation

Read-only review on 2026-10-22. Approval gate only: no remote writes, application deployment, email send, commit, or push occurred. The intended Staging project is `jjvongzvtnzlvwdfcnjk`; Production is `fullaiodvmilkdxyxnln` and is excluded.

## Release inventory and Git isolation

This handoff began from the dirty source worktree at b45b9bde402a2adbdc9ad3652ccb355a61174f87. The reviewed operations slice is isolated on feature/operations-v1 at C:/menu-man/.worktrees/operations-v1. Use its verified local commit SHA for later Staging approval; the source worktree retains its uncommitted changes.

| Slice | Operations paths |
| --- | --- |
| Subjects, threading, required marks, saved acknowledgment | `src/lib/marketing-leads/contracts.ts`, `src/lib/notifications/resend.ts`, `src/app/MarketingInteractions.tsx`, required-mark hunks only in `src/app/page.module.css`, `src/app/MarketingLeadForm.tsx` |
| Durable intake, delivery, context | `src/app/api/marketing/leads/route.ts`, `src/lib/marketing-leads/{client,context,delivery,handler,persistence,server}.ts`, `src/lib/analytics/{posthog,types}.ts` |
| Private owner inbox and mutations | `src/app/ops/**`, `src/lib/ops/**`, `src/proxy.ts`, `next.config.ts` |
| Migrations | `supabase/migrations/20261022070256_marketing_lead_capture_v1.sql`, `supabase/migrations/20261022073652_ops_owner_lead_inbox_v1.sql` |
| Tests and handoff | `src/lib/marketing-leads/{leads,persistence}.test.ts`, `src/lib/marketing-leads/test-store.ts`, `src/lib/analytics/marketing.test.ts`, `src/lib/ops/ops.test.ts`, `scripts/{run-tests.ts,test-marketing-lead-db.mjs}`, `scripts/qa/ops-owner-{inbox,browser}.mjs`, `docs/menu-man-operations-v1-plan.md`, `docs/operations-v1-{durable-lead-capture,owner-inbox,staging-release-prep}.md` |

Exclude `AGENTS.md`, `src/app/services/page.tsx`, provider-logo hunks in `src/app/page.module.css`, cancellation changes, unrelated marketing work, environment files, and screenshots. The CSS file requires hunk selection; do not stage the whole file. Review the resulting staged diff and run `git diff --cached --check` before committing. No unrelated change currently shares an inseparable hunk with operations work.

## Migration and security review

Staging is active on PostgreSQL 17.6. Its migration history currently ends at `202610190002_catering_inquiry_deletion`; neither operations migration is applied. The first migration creates `public.marketing_leads`, two private notification tables, and three service-role-only RPCs. The second depends on those objects, adds the private owner allowlist/activity table and follow-up columns, and creates six authenticated RPCs whose bodies independently check owner UUID, live Auth session association, and AAL2. Both files have explicit `BEGIN`/`COMMIT`, RLS on every new table, direct table-access revocations, and bounded function grants. They are forward-only; replay is not idempotent. Apply each once, in filename order, only after confirming migration history.

Read-only catalog checks found no conflicting table or function names, no lead policies, and compatible `auth.users`, `auth.sessions`, and `auth.mfa_factors` columns. `pg_catalog.sha256(bytea)`, `pg_catalog.gen_random_uuid()`, `auth.uid()`, and `auth.jwt()` exist; `pgcrypto` and `uuid-ossp` are installed but no new extension is required. `service_role` has public-schema usage and bypass RLS for the narrowly granted ingestion RPCs. The existing private schema grants authenticated usage, so the migration's explicit private-function revocations matter. Public default table grants are broad; the explicit new-table revocations and RLS are essential. Confirm effective ACLs after migration. The existing 9/9 capture and 7/7 owner PostgreSQL 17.11 rehearsal groups cover transaction rollback, concurrent IDs, retry leases, direct-access denial, and owner actions; there is no catalog discrepancy requiring another local migration rehearsal.

Recovery: retain the checkpoint and migration SQL. Disable `/ops` through the Staging flag or deploy compatible prior UI code if necessary. Do not drop lead/outbox/history tables, replay migration files, or return to email-only success. An actual database restore is a separate downtime/data-loss decision.

## Owner auth readiness

No owner Auth UUID has been approved or entered into `private.ops_owners`. Staging has 10 Auth users, 9 with password hashes, and **zero verified TOTP factors**; these aggregate facts do not identify a suitable owner. Password provider enablement and a real password sign-in have not been verified. The owner must confirm the exact Staging UUID, confirm or securely provision its password identity, enroll and verify TOTP through a trusted Supabase Auth flow, and arrange a second supported factor or recovery process. Never share password, TOTP seed, code, or session in the issue/terminal. Then provision exactly that UUID with `active=true, require_aal2=true` through a trusted database operation. Restaurant membership, email address, or user metadata must not grant access. Hosted tests must prove anon, ordinary restaurant user, AAL1 owner, revoked owner, and expired-session denial.

## Approved rollout sequence to execute later

1. **Checkpoint (remote backup/read):** In the Staging Supabase Dashboard, confirm a restorable backup or PITR point covering the moment immediately before migration. Record its timestamp and restoration owner. If unavailable, make an approved logical backup with `supabase db dump` after checking the installed CLI help and securely store it. This is a remote read/export, not a schema write. Do not proceed without a recovery path.
2. **Identity (remote read):** Reconfirm project ref `jjvongzvtnzlvwdfcnjk`, API URL, migration head, object names, roles, and Auth contract. Abort on any other ref or unexpected drift.
3. **Schema (remote writes):** In the clean release worktree, use an approved Supabase CLI installation. Discover the installed `link`, `db push`, and `migration` flags with `--help`. Run `supabase link --project-ref jjvongzvtnzlvwdfcnjk`, `supabase migration list --linked`, and `supabase db push --linked --dry-run`. Proceed only if the dry run lists exactly `20261022070256_marketing_lead_capture_v1.sql` followed by `20261022073652_ops_owner_lead_inbox_v1.sql`; then run `supabase db push --linked`. Confirm both original versions in remote history. The CLI is not installed in this preparation environment, so its flags must be rechecked on the release host. Do not run the historical chain or target Production.
4. **Access checks (remote reads):** Verify all five new tables have RLS, direct grants are absent for anon/authenticated/service_role, ingestion RPCs execute only for service_role, owner RPCs only for authenticated, and private helper functions are not executable. Confirm no public Data API read returns lead records. Recheck migration history and existing private schema privileges.
5. **Owner (remote Auth/DB writes):** After the owner performs password/TOTP setup and confirms the Auth UUID, insert exactly that UUID in `private.ops_owners` with `active=true, require_aal2=true`. If a new Auth identity or password is needed, provision it through the approved secure Auth process. Do not weaken AAL2.
6. **Application (remote deployment/config writes):** From a clean operations-only commit, deploy that exact SHA to the Staging application with Staging-only `NEXT_PUBLIC_SUPABASE_URL`, publishable key, server-only service key, and approved notification settings. Enable `MENU_MAN_OPS_ENABLED=true` in Staging only. Record deployment ID and SHA. No Production configuration changes.
7. **Browser (remote reads and synthetic writes):** In Google Chrome, test password/TOTP flow, owner inbox/detail/mutations, denial cases, response headers, mobile and desktop routes, and unchanged management gates.
8. **Intake/notification (remote synthetic writes; possible email send):** Submit approved synthetic Build and Review inquiries, repeat one UUID/details, check one lead/outbox each, verify failure visibility and eligible retry. Do not send a real email until the test recipient and delivery behavior are approved. Use a controlled Staging transport or missing-credential failure first.

## Hosted acceptance checklist

- [ ] Synthetic website inquiry persists with lead/outbox IDs; independent submissions have distinct IDs and subjects.
- [ ] Identical UUID/details are idempotent; changed details conflict without a second lead.
- [ ] Approved controlled notification succeeds; provider acceptance is labeled separately from delivery.
- [ ] Failed notification preserves the lead, safe attempt history, and visible `/ops` warning.
- [ ] Due, eligible retry reuses the original key/content and appends one attempt; unsafe retry remains blocked.
- [ ] Owner changes status/notes, sets and clears follow-up in Pacific time; stored value is UTC; stale revision conflicts.
- [ ] Anonymous, restaurant-only, wrong-owner, revoked-owner, expired-session, and AAL1 access fail; TOTP elevates only the authorized owner.
- [ ] Public REST/RPC access cannot read lead or owner tables; `/ops` responses are private/no-store.
- [ ] Analytics and application logs contain no names, email addresses, free text, lead IDs, credentials, or TOTP material.
- [ ] Chrome at mobile and desktop widths shows usable inbox/detail/forms; Production management gates remain intact.

## Approval gate

Blocked on a recoverable Staging checkpoint, confirmed owner UUID and verified TOTP, password-provider/sign-in validation, exact Staging deployment target/configuration, and approved synthetic recipient/transport. Explicit authorization is required for the two migration writes, any Auth provisioning, allowlist insert, Staging flag change and deployment, hosted synthetic lead/mutation writes, and any controlled email send. No Production action is included.
