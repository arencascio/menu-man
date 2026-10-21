# Proposed v1 release file scope

Reviewed 2026-10-21 on `feature/super-tacos-demo`, base `f1086732a4608413088b478dfea972f7de00f683`. HEAD is unchanged from that base; this ledger scopes current uncommitted intended release work for owner review and one future local commit. No file is staged or committed. Recheck diffs/status before staging.

The current candidate contains **42 intended files**, including this updated ledger. This list is a manual release ledger, not an instruction to stage the full worktree. Preserve and exclude the unrelated `AGENTS.md` modification and any unrelated worktree changes.

## Application, publication gates, compatibility and metadata (25)

- `docs/super-tacos-public-showcase-release.md`
- `docs/v1-scope-correction.md`
- `scripts/marketing-m1.browser-qa.mjs`
- `scripts/marketing-m1.test.ts`
- `scripts/public-restaurant-access.test.ts`
- `scripts/public-showcase.browser-qa.mjs`
- `scripts/public-showcase.test.ts`
- `src/app/RestaurantShowcases.tsx`
- `src/app/api/internal/notifications/deliver/route.ts`
- `src/app/api/restaurants/[slug]/hearts/route.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/r/[slug]/menu/page.tsx`
- `src/app/r/[slug]/restaurant-delivery-options.ts`
- `src/app/r/[slug]/restaurant-location-data.ts`
- `src/app/restaurant-showcases.module.css`
- `src/app/work/page.tsx`
- `src/lib/catering/server.test.ts`
- `src/lib/catering/server.ts`
- `src/lib/public-restaurant-access.ts`
- `src/lib/restaurant-showcases.ts`
- `src/lib/production-management-gate.ts`
- `src/lib/supabase/optional-relation.test.ts`
- `src/lib/supabase/optional-relation.ts`
- `src/proxy.ts`

## Production SQL release, integrity and local QA (12)

- `scripts/check-super-tacos-public-release.ps1`
- `scripts/prepare-super-tacos-public-release.mjs`
- `scripts/public-release-guards.test.ps1`
- `supabase/releases/super-tacos-public/armandos-preflight.sql`
- `supabase/releases/super-tacos-public/content.sql`
- `supabase/releases/super-tacos-public/manifest.json`
- `supabase/releases/super-tacos-public/preflight.sql`
- `supabase/releases/super-tacos-public/schema-prep.sql`
- `supabase/releases/super-tacos-public/schema-verify.sql`
- `supabase/releases/super-tacos-public/verify.sql`
- `scripts/qa/prepare-super-tacos-local-sql-qa.mjs`
- `scripts/qa/run-super-tacos-local-sql-qa.ps1`

The two QA scripts are explicitly local-only harness/source substitutions; their derived SQL was kept outside the release directory and is not included. The Production artifacts retain their exact Production identity, approval, backup SHA, baseline fingerprint and transaction guards.

## Gate A evidence (4)

- `docs/super-tacos-production-gate-a1.md`
- `docs/super-tacos-production-gate-a4.md`
- `docs/super-tacos-production-gate-a5.md`
- `scripts/qa/super-tacos-production-shaped.sql`

The Gate A.5 report records the verified restore hash and PostgreSQL 17.11 rehearsal. No backup data or customer records are included.

## Release ledger (1)

- `docs/v1-release-file-scope.md`

The scoped `.gitattributes` rules are already present at the base commit and unchanged in this delta. They remain limited to known hash-sensitive/generated text inputs and reviewed brand records; there is no repository-wide newline rule and no binary asset rule. Production SQL and manifest use LF. The Staging seed migration `supabase/seeds/staging/016_super_tacos_content_c1.sql` is unchanged from base and excluded from this delta.
## Exclusions and release prerequisites

- `AGENTS.md`: unrelated pre-existing modification; preserved and excluded.
- Production backup archives, backup manifests, credentials, certificates, PostgreSQL cluster files, temporary derived SQL, test output, browser captures, build output, and other local artifacts are excluded.
- Any other modified/untracked worktree paths outside this allowlist are unrelated and must remain unstaged.
- Current release SQL and source hashes are in `supabase/releases/super-tacos-public/manifest.json`; validate with `scripts/check-super-tacos-public-release.ps1 -Mode Validate`. Do not regenerate SQL unless its source changes intentionally.
- No database write, Production/Staging operation, deployment, commit, push, merge, payment activation or publication is authorized by this ledger. Remaining Production approval gates are covered in `docs/super-tacos-public-showcase-release.md` and the Gate A reports.