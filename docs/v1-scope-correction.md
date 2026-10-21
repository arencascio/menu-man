# V1 scope correction — Super Tacos only

Reviewed locally on `feature/super-tacos-demo`. This addendum supersedes any earlier Gate 3 or release-handoff wording that presents Armando's as a public v1 showcase. It does not authorize a database operation, deployment, route opening, or marketing publication.

## Public marketing scope

Super Tacos is the sole restaurant showcase for Menu Man v1. It is a fictional demonstration. The homepage and `/work` retain a single Super Tacos card and concise fictional-demo disclosure. Its restaurant route and its marketing destination remain independently gated (`routeEnabled: false`, `published: false`); no public demo CTA resolves until the relevant release approvals and hosted QA are complete. The Work page uses a centered single-showcase layout.

Armando's is removed from public-facing marketing cards, copy, and showcase registry. It remains internal platform code, data, fixtures, tests, diagnostics, and a real-restaurant Production tenant. Its deliberate Production publication restriction remains enforced independently of the marketing registry. It is not represented as a Menu Man client or commissioned showcase.

`docs/super-tacos-public-showcase-release.md` is a historical technical handoff. Its prior two-showcase, Armando-publication language is superseded for v1 marketing by this addendum. Preserve its SQL and route-gate history for technical review; do not infer publication authorization from it.

The existing 98-file ledger in `docs/v1-release-file-scope.md` predates this scope correction. Refresh its count and allowlist before any future staging/commit review; do not treat it as a current exact inventory.

## Production path remains database-backed

The planned Super Tacos route continues to use the existing Production restaurant data path and shared restaurant presentation. Do not introduce a fixture-backed public-demo architecture. The prepared 15-table Production installer remains the candidate content package, subject to fresh review and separate approval. No order, payment, visitor, or analytics data is part of that package, and demo commerce remains blocked server-side.

## Gate A.3: Production management boundary

Production management is outside v1 scope. The application has 17 `/manage` page modules and 20 `/api/manage` route modules. The sign-in and password-reset pages use Supabase Auth; authenticated pages and APIs depend on membership/capability RPCs absent from Production. `/auth/callback` also calls the absent membership-activation RPC. The two `/auth` route handlers serve management only. No management Server Actions were found. The separate `/api/internal/notifications/deliver` handler calls the absent outbox claim RPC; no cron is declared in `vercel.json`, but the endpoint must still be closed in Production.

The Production-only gate returns a private, nonindexable 404 for `/manage/**`, `/api/manage/**`, `/auth/callback`, and `/auth/sign-out` before session refresh. The notification-delivery handler returns the same result before checking its cron secret or calling the worker. Staging continues through its existing authentication and capability checks. This gate grants no restaurant access and does not change public restaurant or commerce routes. Production management can be restored only through a separate, authorized compatibility release.

## Remaining compatibility blockers and shortest safe sequence

1. **Prove recovery first.** In Supabase Dashboard, collect evidence for a completed Production backup/recovery point, scope, integrity, and restore-to-isolated-target capability. Test tenant-specific recovery planning without exporting customer records or restoring over Production. Current local evidence does not establish that a usable backup exists.
2. **Run genuine isolated SQL tests.** Execute the actual narrow migration, installer, collision/repeat guards, rollback path, and verifier against a disposable Production-shaped PostgreSQL environment. The available local PostgreSQL installation is incomplete (`postgres.bki` missing); no equivalent isolated SQL execution has passed. Do not simulate a pass or install new infrastructure without the appropriate authorization.
3. **Review and approve the narrow schema change.** Separately approve only `restaurants.is_indexable boolean NOT NULL DEFAULT true`, after confirming current schema preconditions and backup readiness.
4. **Deploy only after compatibility validation, with both public gates closed.** Verify the public marketing site, sitemap, restaurant route restrictions, server-side demo order/payment denials, and the Production-only management/notification gate. Staging management remains available. Production management compatibility is a later, separate scope.
5. **Separately approve and execute the guarded Super Tacos content package.** Require fresh Production preflight, backup attestation, exact artifact hashes, deterministic ID/collision guards, transaction checks, and read-only verification.
6. **Separately approve route publication and unauthenticated hosted QA.** Verify the browse-only catalog and direct server-side order/payment denials. Keep the marketing CTA unpublished until that QA passes and publication is explicitly approved.

No Production or Staging writes, deployment, route publication, or payment activation were performed for this scope correction.
