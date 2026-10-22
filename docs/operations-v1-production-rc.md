# Combined Marketing + Operations V1 release candidate

Local integration review, 2026-10-22. Owner release review gate; no push, deployment, remote database/Auth write, configuration change, or email send.

## Source and integration

- Live getmenuman.com deployment was read-only verified READY on marketing SHA `cdc7a100b8612cf5975caff9de9bd2ad51f3816a`, deployment `dpl_7kJdyzSi8SXqJe9kCNDSMzH4nc69`.
- Worktree: `C:/menu-man/.worktrees/operations-production-rc`; branch: `feature/operations-production-rc`, based directly on that live SHA.
- Shared parent: `b45b9bde402a2adbdc9ad3652ccb355a61174f87`.
- Replayed Operations `8d01ed3ea165afa0abc9e0f652ff4ef1ce75fd12` as `ecb5d12`.
- Replayed Gmail correction `f64b2c09f804efb88306571bca47a2269fbc3b57` as `c3477f7`. This correction was already committed and deployed to Staging; no uncommitted correction remained to copy.
- No cherry-pick conflicts. Reviewed automatic merges in `MarketingInteractions.tsx` and `page.module.css`: live pricing/header asset references and provider styles are retained; only approved required markers and durable-save acknowledgment changes are added.
- All other 200 marketing changed paths (including removed legacy asset paths) match the live baseline. All 47 nonoverlapping original Operations paths match their reviewed source. The Gmail lead-detail file matches its source commit.
- Restaurant pages, menu, demo checkout/payment code, Production management gate, Armando privacy gate, assets, package manifests and AGENTS.md have no integration changes relative to live marketing.
- Gmail receives only recipient and approved subject, opens in a new tab, retains separate mailto fallback, and performs no send or lead-status mutation. Copying the displayed email into an existing Gmail tab remains available.
- Original worktrees were not edited, staged, reset, stashed or cleaned.

## Migration integrity

Only two narrow .gitattributes LF entries were added so Windows checkouts preserve the approved raw bytes. SQL content is unchanged from Operations; neither migration was executed here.

| File | SHA-256 |
| --- | --- |
| 20261022070256_marketing_lead_capture_v1.sql | 9ed9b49ddceee1ddf90269a72c841e9ab0fa53b0a4b268d9037e8d6f0a602bb0 |
| 20261022073652_ops_owner_lead_inbox_v1.sql | 0f0e2e1677a9e935166072c028bc1c9c653d7ad311e34107988037980e2d9dcb |

## Local validation

- 76/76 focused Node tests passed: marketing M.1/M.2 and V1.2 assets, lead submission/persistence/idempotency, notification/outbox failures and retry, owner authorization/MFA denial, Pacific follow-up, Gmail URL privacy, Production restaurant/management restrictions, and demo payment/order safety. All network/payment/email effects in these tests use existing mocks.
- ESLint passed for all changed TypeScript/TSX/MJS files.
- TypeScript `npx tsc --noEmit --incremental false` passed after Next generated fresh route types. The initial standalone check lacked generated LayoutProps; no source correction was required.
- Next.js 16.4.2 Turbopack production build passed. The first build lacked Supabase module-init values; the successful build used non-secret loopback placeholders and MENU_MAN_ENV=local. It is a local validation artifact, not a configured deployment artifact.
- Existing Chrome `scripts/qa-marketing-v12.mjs` passed: 175 asset HTTP checks; Home, Services, Cancellation and Build My Website routes; widths 320/412/768/1440; all six provider logos, warm surfaces, no duplicate labels/overflow, navigation and fallback. Artifacts remain ignored under .playwright/marketing-v12.
- Loopback next start with Production-mode gates and placeholder data configuration: /ops, /ops/login, /manage, /manage/login, /api/manage/memberships, /r/armandos and /r/armandos/menu all returned 404 using GET only. Ops flag was unset.
- Asset manifest/hash and source-reference checks passed: no root img dependency and no missing declared static assets.
- Reused the approved 16 PostgreSQL rehearsal groups. SQL and owner/durable pipeline implementations are unchanged, so no broad database rehearsal was repeated.
- No new credential/environment/backup paths in the release inventory; no real credentials were copied. git diff --check passed.
- Offline npm install initially lacked cached xtend; the unchanged lockfile installed successfully from the registry. A sandbox Node child-process EPERM was an execution-environment restriction; focused validation succeeded with authorized elevated execution.

## Production prerequisites: separate approval and work

1. Review this exact candidate and approve a separate combined Staging deployment/hosted acceptance run with Staging-only credentials and branch-scoped ops flag. Local tests do not replace hosted owner/MFA and inquiry lifecycle acceptance.
2. Before any Production migration, verify fullaiodvmilkdxyxnln identity, current catalog/history, collisions and recovery checkpoint. Apply only the two approved migrations in order with correct migration tracking, then verify RLS/grants and existing data safeguards. Public lead intake now requires the durable schema even if /ops is disabled.
3. Confirm an appropriate Production Auth account, password login, verified TOTP/AAL2 and separately approved explicit owner allowlist row. The Staging owner UUID/allowlist does not establish Production access.
4. Review Production-only server settings and notification delivery/recipient approval. Never copy Staging credentials or assume its owner configuration applies to Production. A Production ops flag change needs separate authorization; /manage restrictions remain enforced.
5. Obtain separate push/deployment approval for the reviewed candidate; rebuild with the intended deployment environment. No Production rollout, database/Auth write, notification send, Vercel/DNS change or push was performed in this task.

## Exact candidate file inventory relative to live marketing
- `.gitattributes`
- `docs/menu-man-operations-v1-plan.md`
- `docs/operations-v1-durable-lead-capture.md`
- `docs/operations-v1-owner-inbox.md`
- `docs/operations-v1-production-rc.md`
- `docs/operations-v1-staging-release-prep.md`
- `next.config.ts`
- `scripts/qa/ops-owner-browser.mjs`
- `scripts/qa/ops-owner-inbox.mjs`
- `scripts/run-tests.ts`
- `scripts/test-marketing-lead-db.mjs`
- `src/app/api/marketing/leads/route.ts`
- `src/app/MarketingInteractions.tsx`
- `src/app/MarketingLeadForm.tsx`
- `src/app/ops/auth/sign-in/route.ts`
- `src/app/ops/auth/sign-out/route.ts`
- `src/app/ops/auth/verify/route.ts`
- `src/app/ops/error.tsx`
- `src/app/ops/layout.tsx`
- `src/app/ops/leads/[id]/actions/route.ts`
- `src/app/ops/leads/[id]/LeadActions.tsx`
- `src/app/ops/leads/[id]/page.tsx`
- `src/app/ops/login/page.tsx`
- `src/app/ops/ops.module.css`
- `src/app/ops/page.tsx`
- `src/app/ops/Presentation.tsx`
- `src/app/page.module.css`
- `src/lib/analytics/marketing.test.ts`
- `src/lib/analytics/posthog.ts`
- `src/lib/analytics/types.ts`
- `src/lib/marketing-leads/client.ts`
- `src/lib/marketing-leads/context.ts`
- `src/lib/marketing-leads/contracts.ts`
- `src/lib/marketing-leads/delivery.ts`
- `src/lib/marketing-leads/handler.ts`
- `src/lib/marketing-leads/leads.test.ts`
- `src/lib/marketing-leads/persistence.test.ts`
- `src/lib/marketing-leads/persistence.ts`
- `src/lib/marketing-leads/server.ts`
- `src/lib/marketing-leads/test-store.ts`
- `src/lib/notifications/resend.ts`
- `src/lib/ops/access.ts`
- `src/lib/ops/actions.ts`
- `src/lib/ops/auth-http.ts`
- `src/lib/ops/contracts.ts`
- `src/lib/ops/email-links.test.ts`
- `src/lib/ops/email-links.ts`
- `src/lib/ops/http.ts`
- `src/lib/ops/ops.test.ts`
- `src/lib/ops/pacific-time.ts`
- `src/lib/ops/server.ts`
- `src/proxy.ts`
- `supabase/migrations/20261022070256_marketing_lead_capture_v1.sql`
- `supabase/migrations/20261022073652_ops_owner_lead_inbox_v1.sql`
